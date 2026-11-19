"use strict";

/*
 * Browser view of Cavalieri's Principle. All the rules and the drag arithmetic
 * live in cavalieri-core.js; this file only draws the two stacks and takes
 * input. In Horizontal mode the two stacks sit side by side and the strips are
 * wide; in Vertical mode one sits above the other and the strips stand up. Each
 * strip's two draggable bars are drawn as dots, and the matching strip in the
 * other stack is always the same length. Pointer drags, arrow keys and the
 * nudge buttons all move the selected handle; the canvas keeps focus so the
 * keyboard path never strands the player.
 */

(function () {
  const Core = CavalieriCore;
  const canvas = document.getElementById("cavalieriCanvas");
  const ctx = canvas.getContext("2d");
  const box = document.getElementById("canvasBox");
  const nInput = document.getElementById("nInput");
  const nOut = document.getElementById("nOut");
  const horizontalRadio = document.getElementById("horizontalRadio");
  const verticalRadio = document.getElementById("verticalRadio");
  const linesInput = document.getElementById("linesInput");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const backBtn = document.getElementById("backBtn");
  const fwdBtn = document.getElementById("fwdBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");

  const PAD = 24;
  const NUDGE = 0.04;
  const HIT = 16; // generous touch target around a bar, in CSS pixels

  let state = null;
  let tokens = {};
  let selected = { kind: "bar", which: "b", index: 0 };
  let dragging = false;
  let dpr = 1;

  function refreshTokens() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name) => cs.getPropertyValue(name).trim();
    tokens = {
      stage: get("--stage"),
      ink: get("--ink"),
      muted: get("--muted"),
      accent: get("--accent"),
      good: get("--good"),
      bad: get("--bad"),
      highlight: get("--highlight"),
      border: get("--border-strong") || get("--border"),
    };
  }

  /** Shows a line under the picture. "done" marks this demo as explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function areaSentence() {
    return `Both stacks still cover ${Core.areas(state).left.toFixed(2)} square units each.`;
  }

  /* ------------------------------------------------------------ geometry */

  function layout() {
    const w = canvas.clientWidth || box.clientWidth || 320;
    const h = canvas.clientHeight || 320;
    const n = state.n;
    if (!state.vertical) {
      const figW = (w - 3 * PAD) / 2;
      return {
        w, h, n, vertical: false, strip: (h - 2 * PAD) / n,
        left: { x: PAD, y: PAD, w: figW, h: h - 2 * PAD },
        right: { x: PAD * 2 + figW, y: PAD, w: figW, h: h - 2 * PAD },
      };
    }
    const figH = (h - 3 * PAD) / 2;
    return {
      w, h, n, vertical: true, strip: (w - 2 * PAD) / n,
      right: { x: PAD, y: PAD, w: w - 2 * PAD, h: figH },
      left: { x: PAD, y: PAD * 2 + figH, w: w - 2 * PAD, h: figH },
    };
  }

  /** The centre of level i's slot in a figure. */
  function slotCentre(fig, g, i) {
    return g.vertical
      ? { x: fig.x + (i + 0.5) * g.strip, y: fig.y }
      : { x: fig.x, y: fig.y + (i + 0.5) * g.strip };
  }

  /** Every draggable point, with its CSS-pixel position and its identity. */
  function handles(g) {
    const out = [];
    for (let i = 0; i < state.n; i++) {
      const level = state.levels[i];
      const c = slotCentre(g.right, g, i);
      out.push({
        kind: "bar", which: "a", index: i,
        x: g.vertical ? c.x : g.right.x + level.barA * g.right.w,
        y: g.vertical ? g.right.y + level.barA * g.right.h : c.y,
        label: `lower or left bar of strip ${i + 1}`,
      });
      out.push({
        kind: "bar", which: "b", index: i,
        x: g.vertical ? c.x : g.right.x + level.barB * g.right.w,
        y: g.vertical ? g.right.y + level.barB * g.right.h : c.y,
        label: `upper or right bar of strip ${i + 1}`,
      });
      const lc = slotCentre(g.left, g, i);
      out.push({
        kind: "left", index: i,
        x: g.vertical ? lc.x : g.left.x + level.leftPos * g.left.w,
        y: g.vertical ? g.left.y + level.leftPos * g.left.h : lc.y,
        label: `left stack strip ${i + 1}`,
      });
    }
    return out;
  }

  /* -------------------------------------------------------------- drawing */

  function parseHex(colour) {
    const m = /^#([0-9a-f]{6})$/i.exec((colour || "").trim());
    return m ? parseInt(m[1], 16) : null;
  }

  function stripColour(t) {
    const g = parseHex(tokens.good) || 0x15803d;
    const b = parseHex(tokens.bad) || 0xc2362b;
    const mix = (shift) => Math.round(((g >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
    return `rgb(${mix(16)}, ${mix(8)}, ${mix(0)})`;
  }

  function drawRect(fig, pos, span, i, g) {
    ctx.fillStyle = stripColour(state.n === 1 ? 0 : i / (state.n - 1));
    ctx.strokeStyle = tokens.ink;
    ctx.lineWidth = 1;
    if (g.vertical) {
      const x = fig.x + i * g.strip;
      const y = fig.y + pos * fig.h;
      ctx.fillRect(x, y, g.strip, span * fig.h);
      ctx.strokeRect(x, y, g.strip, span * fig.h);
    } else {
      const x = fig.x + pos * fig.w;
      const y = fig.y + i * g.strip;
      ctx.fillRect(x, y, span * fig.w, g.strip);
      ctx.strokeRect(x, y, span * fig.w, g.strip);
    }
  }

  function draw() {
    if (!state) return;
    const g = layout();
    const w = g.w;
    const h = g.h;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, 0, w, h);

    // The parallel guide lines: the "cuts" at which Cavalieri compares lengths.
    if (state.showLines) {
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      for (let i = 0; i <= state.n; i++) {
        ctx.beginPath();
        if (g.vertical) {
          const x = g.left.x + i * g.strip;
          ctx.moveTo(x, PAD);
          ctx.lineTo(x, h - PAD);
        } else {
          const y = g.left.y + i * g.strip;
          ctx.moveTo(PAD, y);
          ctx.lineTo(w - PAD, y);
        }
        ctx.stroke();
      }
    }

    // The strips themselves: left stack and right stack, matched level by level.
    for (let i = 0; i < state.n; i++) {
      const level = state.levels[i];
      const rightPos = Math.min(level.barA, level.barB);
      const rightSpan = Math.abs(Core.rightSpan(level, state.vertical));
      drawRect(g.right, rightPos, rightSpan, i, g);
      drawRect(g.left, level.leftPos, level.leftSpan, i, g);
    }

    // The two parallel boundary lines at the ends of each stack.
    ctx.strokeStyle = tokens.ink;
    ctx.lineWidth = 2;
    for (const fig of [g.left, g.right]) {
      ctx.beginPath();
      if (g.vertical) {
        ctx.moveTo(fig.x, fig.y); ctx.lineTo(fig.x, fig.y + fig.h);
        ctx.moveTo(fig.x + fig.w, fig.y); ctx.lineTo(fig.x + fig.w, fig.y + fig.h);
      } else {
        ctx.moveTo(fig.x, fig.y); ctx.lineTo(fig.x + fig.w, fig.y);
        ctx.moveTo(fig.x, fig.y + fig.h); ctx.lineTo(fig.x + fig.w, fig.y + fig.h);
      }
      ctx.stroke();
    }

    // The draggable bars as small dots; the chosen one gets an accent ring.
    for (const hd of handles(g)) {
      const isSelected = hd.kind === selected.kind && hd.index === selected.index &&
        (hd.kind === "left" || hd.which === selected.which);
      ctx.beginPath();
      ctx.arc(hd.x, hd.y, isSelected ? 6 : 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = hd.kind === "left" ? tokens.muted : tokens.accent;
      ctx.fill();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(hd.x, hd.y, HIT / 2, 0, 2 * Math.PI);
        ctx.strokeStyle = tokens.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hd.x, hd.y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = tokens.highlight;
        ctx.fill();
      }
    }

    // Small captions saying which stack is which.
    ctx.fillStyle = tokens.muted;
    ctx.font = "0.85rem system-ui, sans-serif";
    if (g.vertical) {
      ctx.fillText("bars you can move", PAD + 4, PAD - 7);
      ctx.fillText("strips you can slide", PAD + 4, g.left.y - 6);
    } else {
      ctx.fillText("slide whole strips", PAD + 2, PAD - 7);
      ctx.fillText("move the bars", g.right.x + 2, PAD - 7);
    }
  }

  /* --------------------------------------------------------------- actions */

  function render(message) {
    nInput.value = String(state.n);
    nOut.textContent = String(state.n);
    horizontalRadio.checked = !state.vertical;
    verticalRadio.checked = state.vertical;
    linesInput.checked = state.showLines;
    selected.index = Math.min(selected.index, state.n - 1);

    say((message || `At the start every strip is the same length. ${areaSentence()}`), "done");
    draw();
    if (window.Track) window.Track.state(state);
  }

  /** Keep a dragged bar inside its figure and the strip non-degenerate. */
  function clampBar(index, which, raw) {
    const level = state.levels[index];
    if (state.vertical) {
      return which === "a"
        ? Math.max(level.barB + 0.02, Math.min(1, raw))
        : Math.max(0, Math.min(level.barA - 0.02, raw));
    }
    return which === "a"
      ? Math.max(0, Math.min(level.barB - 0.02, raw))
      : Math.max(level.barA + 0.02, Math.min(1, raw));
  }

  function moveHandle(handle, raw) {
    const i = handle.index;
    if (handle.kind === "bar") {
      const value = clampBar(i, handle.which, raw);
      const before = Core.sliceLength(state, i).left;
      const next = Core.dragBar(state, i, handle.which, value);
      if (next === state) return;
      const after = Core.sliceLength(next, i).left;
      state = next;
      const word = after > before + 1e-6 ? "longer" : after < before - 1e-6 ? "shorter" : "the same";
      render(`Strip ${i + 1}: you moved a bar and that strip is now ${after.toFixed(2)} long (${word}); ` +
        `the matching strip in the other stack became the same length. ${areaSentence()}`);
    } else {
      const level = state.levels[i];
      const value = Math.max(0, Math.min(1 - level.leftSpan, raw));
      state = Core.slideLeft(state, i, value);
      render(`Strip ${i + 1}: you slid a strip in the left stack sideways. Its length did not change, ` +
        `and the right stack stayed the same. ${areaSentence()}`);
    }
  }

  function pointerValue(handle, ev, g) {
    const rect = canvas.getBoundingClientRect();
    // Map through canvas.width / rect.width so the board can shrink on a phone.
    const scale = canvas.width / Math.max(1, rect.width);
    const px = (ev.clientX - rect.left) * scale / dpr;
    const py = (ev.clientY - rect.top) * scale / dpr;
    if (!g.vertical) {
      const fig = handle.kind === "left" ? g.left : g.right;
      return (px - fig.x) / fig.w;
    }
    const fig = handle.kind === "left" ? g.left : g.right;
    return (py - fig.y) / fig.h;
  }

  function nearestHandle(ev) {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / Math.max(1, rect.width);
    const px = (ev.clientX - rect.left) * scale / dpr;
    const py = (ev.clientY - rect.top) * scale / dpr;
    let best = null;
    let bestDist = HIT;
    for (const hd of handles(layout())) {
      const d = Math.hypot(hd.x - px, hd.y - py);
      if (d < bestDist) { bestDist = d; best = hd; }
    }
    return best;
  }

  function cycle(delta) {
    const total = state.n * 3;
    const flat = selected.index * 3 + (selected.kind === "bar" ? (selected.which === "a" ? 0 : 1) : 2);
    const nextFlat = (flat + delta + total) % total;
    selected = {
      index: Math.floor(nextFlat / 3),
      kind: nextFlat % 3 === 2 ? "left" : "bar",
      which: nextFlat % 3 === 0 ? "a" : "b",
    };
    render(`Selected ${selected.kind === "left" ? "a strip in the left stack" : "a bar in the right stack"} ` +
      `at strip ${selected.index + 1}. ${areaSentence()}`);
    canvas.focus();
  }

  function nudge(sign) {
    const level = state.levels[selected.index];
    const current = selected.kind === "bar"
      ? (selected.which === "a" ? level.barA : level.barB)
      : level.leftPos;
    const hd = selected.kind === "bar"
      ? { kind: "bar", which: selected.which, index: selected.index }
      : { kind: "left", index: selected.index };
    moveHandle(hd, current + sign * NUDGE);
  }

  /* ----------------------------------------------------------- listeners */

  canvas.addEventListener("pointerdown", (ev) => {
    const hd = nearestHandle(ev);
    if (!hd) return;
    selected = { kind: hd.kind, which: hd.which, index: hd.index };
    dragging = true;
    canvas.setPointerCapture(ev.pointerId);
    canvas.focus();
    ev.preventDefault();
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const g = layout();
    moveHandle(selected, pointerValue(selected, ev, g));
    ev.preventDefault();
  });
  const stopDrag = () => { dragging = false; };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);

  canvas.addEventListener("keydown", (ev) => {
    const k = ev.key;
    if (k === "ArrowLeft" || k === "ArrowUp" || k === "ArrowRight" || k === "ArrowDown") {
      const sign = (k === "ArrowLeft" || k === "ArrowUp") ? -1 : 1;
      nudge(sign);
      ev.preventDefault();
      canvas.focus();
    } else if (k === "[") {
      cycle(-1); ev.preventDefault();
    } else if (k === "]") {
      cycle(1); ev.preventDefault();
    }
  });

  nInput.addEventListener("input", () => {
    state = Core.setN(state, Number(nInput.value));
    render(`Now ${state.n} thinner strips in each stack, laid out afresh. ${areaSentence()}`);
  });
  horizontalRadio.addEventListener("change", () => {
    if (!horizontalRadio.checked) return;
    state = Core.setVertical(state, false);
    render("The two stacks are now side by side again, each strip fresh and full length. " + areaSentence());
  });
  verticalRadio.addEventListener("change", () => {
    if (!verticalRadio.checked) return;
    state = Core.setVertical(state, true);
    render("The two stacks are now one above the other, each strip fresh and full length. " + areaSentence());
  });
  linesInput.addEventListener("change", () => {
    state = Core.setShowLines(state, linesInput.checked);
    render(`The parallel guide lines are now ${state.showLines ? "on" : "off"}; ` +
      `the strips and their areas are unchanged. ${areaSentence()}`);
  });

  prevBtn.addEventListener("click", () => cycle(-1));
  nextBtn.addEventListener("click", () => cycle(1));
  backBtn.addEventListener("click", () => nudge(-1));
  fwdBtn.addEventListener("click", () => nudge(1));
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render("Back to the start: every strip is full length and the two stacks match. " + areaSentence());
    canvas.focus();
  });

  window.addEventListener("themechange", () => { refreshTokens(); draw(); });
  window.addEventListener("resize", draw);

  refreshTokens();
  state = Core.start({ n: Number(nInput.value) });
  render();
})();
