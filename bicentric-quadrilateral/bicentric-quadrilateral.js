"use strict";

/*
 * Browser view of Bicentric Quadrilateral. All the geometry is in
 * bicentric-quadrilateral-core.js; this file only draws it and takes input.
 *
 * The play area shows one circle with four dots on it. The tangents at those
 * dots meet in the corners of an outer quadrilateral, which always has the
 * circle as its incircle. Drag a dot (or focus the picture and use 1-4 and the
 * arrow keys) to reshape it. When the diagonals of the four dots cross at right
 * angles the outer quadrilateral also gets a circumcircle, and the status line
 * says so in words.
 */

(() => {
  const C = BicentricQuadrilateralCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const bicentricBtn = document.getElementById("bicentricBtn");
  const namesCheck = document.getElementById("namesCheck");

  // The applet's own drawing size. All positions are in these logical units,
  // so the position is the same at every screen size.
  const W = 400;
  const H = 260;
  const LABELS = ["A", "B", "C", "D"];
  const OUTER = ["P", "Q", "R", "S"];

  let state = null;
  let message = "";
  let tokens = {};
  let view = { scale: 1, ox: 0, oy: 0 };

  function refreshTokens() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name) => cs.getPropertyValue(name).trim();
    tokens = {
      stage: get("--stage"),
      ink: get("--ink"),
      muted: get("--muted"),
      text: get("--text"),
      accent: get("--accent"),
      soft: get("--accent-soft"),
      boardA: get("--board-a"),
      highlight: get("--highlight"),
      good: get("--good"),
    };
  }

  /** The status line doubles as the record's "demo explored" signal. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function line(a, b, colour, width, dash) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function dot(p, radius, colour, ring) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = colour;
    ctx.fill();
    if (ring) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = ring;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function label(p, text, colour, dx, dy) {
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillStyle = colour;
    ctx.fillText(text, p.x + (dx || 8), p.y + (dy || -8));
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(200, rect.width);
    const cssH = Math.max(120, rect.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const scale = Math.min(cssW / W, cssH / H);
    const ox = (cssW - W * scale) / 2;
    const oy = (cssH - H * scale) / 2;
    view = { scale, ox, oy };
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, 0, W, H);
    const g = C.geometry(state);
    if (!g.drawable) {
      ctx.fillStyle = tokens.muted;
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText("Move the dots apart to see the drawing.", 20, H / 2);
      return;
    }
    const { center, radius, A, B, Cc, D, P, Q, R, S, E, O, feet } = {
      center: g.center, radius: g.radius, A: g.A, B: g.B, Cc: g.C, D: g.D,
      P: g.P, Q: g.Q, R: g.R, S: g.S, E: g.E, O: g.O, feet: g.feet,
    };

    // The inner circle is the incircle of the outer quadrilateral.
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = tokens.soft;
    ctx.fill();
    ctx.strokeStyle = tokens.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // The four corners of the outer quadrilateral.
    const outer = [P, Q, R, S];
    ctx.beginPath();
    ctx.moveTo(P.x, P.y);
    for (const v of [Q, R, S]) ctx.lineTo(v.x, v.y);
    ctx.closePath();
    ctx.fillStyle = tokens.boardA;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = tokens.ink;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tangent segments from each contact point to its two corners.
    line(A, P, tokens.muted, 1);
    line(A, S, tokens.muted, 1);
    line(B, Q, tokens.muted, 1);
    line(B, P, tokens.muted, 1);
    line(Cc, R, tokens.muted, 1);
    line(Cc, Q, tokens.muted, 1);
    line(D, S, tokens.muted, 1);
    line(D, R, tokens.muted, 1);

    // The cyclic quadrilateral and its two diagonals.
    line(A, B, tokens.ink, 1.5);
    line(B, Cc, tokens.ink, 1.5);
    line(Cc, D, tokens.ink, 1.5);
    line(D, A, tokens.ink, 1.5);
    line(A, Cc, tokens.muted, 1, [5, 5]);
    line(B, D, tokens.muted, 1, [5, 5]);

    // The feet of the perpendiculars from E to the four sides.
    for (const f of feet) dot(f, 2.5, tokens.highlight);

    if (g.orthodiagonal) {
      // The outer quadrilateral now has a circumcircle through all four corners.
      ctx.beginPath();
      ctx.arc(O.x, O.y, g.circumradius, 0, 2 * Math.PI);
      ctx.strokeStyle = tokens.good;
      ctx.lineWidth = 2;
      ctx.stroke();
      for (const v of outer) line(O, v, tokens.good, 1, [4, 4]);
      // I, E and O on one line: show the whole segment.
      line(center, O, tokens.highlight, 3);
      dot(E, 5, tokens.good);
      dot(O, 5, tokens.good);
    }

    // The four draggable dots and the selected one's ring.
    const vertices = [A, B, Cc, D];
    vertices.forEach((v, i) => dot(v, 5, tokens.ink, i === state.selected ? tokens.accent : null));
    outer.forEach((v) => dot(v, 3.5, tokens.muted));

    // The circle's centre I and its radius handle.
    dot(center, 3.5, tokens.accent);
    dot({ x: center.x, y: center.y - radius }, 4, tokens.accent, tokens.stage);

    if (state.showNames) {
      vertices.forEach((v, i) => label(v, LABELS[i], tokens.text));
      outer.forEach((v, i) => label(v, OUTER[i], tokens.text, 6, -10));
      label(center, "I", tokens.text, -16, -10);
      if (g.orthodiagonal) {
        label(E, "E", tokens.good, -16, -10);
        label(O, "O", tokens.good, 8, -10);
      }
    }
  }

  function render() {
    const g = C.geometry(state);
    let text = message ? message + " " : "";
    text += g.orthodiagonal
      ? "The diagonals cross at right angles, so the outer quadrilateral has an incircle and a circumcircle; I, E and O lie on one line."
      : "The four dots stay on the circle and the outer sides keep touching it, but the diagonals are not at right angles yet.";
    say(text, "done");
    draw();
    if (window.Track) {
      window.Track.state({
        center: { x: state.center.x, y: state.center.y },
        radius: state.radius,
        angles: state.angles.slice(),
        showNames: state.showNames,
        selected: state.selected,
        bicentric: Boolean(g.orthodiagonal),
      });
    }
  }

  function act(next, words) {
    if (next === state) return;
    state = next;
    message = words;
    render();
  }

  function pointerPosition(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left - view.ox) / view.scale,
      y: (ev.clientY - rect.top - view.oy) / view.scale,
    };
  }

  function maxRadius() {
    const c = state.center;
    return Math.max(C.MIN_RADIUS, Math.min(C.MAX_RADIUS,
      Math.min(c.x, c.y, W - c.x, H - c.y) - 6));
  }

  let drag = null;
  canvas.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    canvas.focus();
    const p = pointerPosition(ev);
    const h = C.handles(state);
    const vertices = [h.A, h.B, h.C, h.D];
    let nearest = -1;
    let best = 18;
    vertices.forEach((v, i) => {
      const d = C.distance(p, v);
      if (d < best) { best = d; nearest = i; }
    });
    if (nearest >= 0) drag = { kind: "vertex", index: nearest };
    else if (C.distance(p, h.center) < 12) drag = { kind: "center" };
    else if (C.distance(p, h.radiusHandle) < 14) drag = { kind: "radius" };
    if (drag) canvas.setPointerCapture(ev.pointerId);
  });

  canvas.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    ev.preventDefault();
    const p = pointerPosition(ev);
    if (drag.kind === "vertex") {
      const h = C.handles(state);
      const target = Math.atan2(p.y - h.center.y, p.x - h.center.x);
      let delta = target - state.angles[drag.index];
      delta = ((delta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      act(C.move(state, { type: "rotate", index: drag.index, delta }),
        "You dragged point " + LABELS[drag.index] + " around the circle.");
    } else if (drag.kind === "center") {
      const x = Math.max(8, Math.min(W - 8, p.x));
      const y = Math.max(8, Math.min(H - 8, p.y));
      act(C.move(state, { type: "center", x, y }), "You moved the circle's centre.");
    } else if (drag.kind === "radius") {
      act(C.move(state, { type: "radius", value: C.distance(p, state.center) }),
        "You changed the circle's size.");
    }
  });

  function endDrag() { drag = null; }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("keydown", (ev) => {
    if (ev.key >= "1" && ev.key <= "4") {
      act(C.move(state, { type: "select", index: Number(ev.key) - 1 }),
        "You selected point " + LABELS[Number(ev.key) - 1] + ".");
      ev.preventDefault();
      return;
    }
    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      const step = (ev.shiftKey ? 0.1 : 0.02) * (ev.key === "ArrowRight" ? 1 : -1);
      act(C.move(state, { type: "rotate", index: state.selected, delta: step }),
        "You turned point " + LABELS[state.selected] + " with the arrow keys.");
      ev.preventDefault();
      return;
    }
    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      const step = (ev.shiftKey ? 16 : 4) * (ev.key === "ArrowUp" ? 1 : -1);
      act(C.move(state, { type: "radius", value: Math.min(maxRadius(), state.radius + step) }),
        "You changed the circle's size with the arrow keys.");
      ev.preventDefault();
      return;
    }
    if (ev.key === "b" || ev.key === "B") {
      act(C.move(state, { type: "bicentric" }), "I made the diagonals cross at right angles.");
      ev.preventDefault();
      return;
    }
    if (ev.key === "n" || ev.key === "N") {
      const value = !state.showNames;
      namesCheck.checked = value;
      act(C.move(state, { type: "names", value }),
        value ? "Names are now shown." : "Names are now hidden.");
      ev.preventDefault();
    }
  });

  function reset() {
    state = C.start({
      center: { x: W / 2, y: H / 2 },
      radius: Math.round(Math.min(W, H) / 6),
      angles: C.DEFAULT_ANGLES.slice(),
      showNames: namesCheck.checked,
    });
    message = "Back to the starting picture; the diagonals are not at right angles.";
    render();
  }

  resetBtn.addEventListener("click", reset);
  bicentricBtn.addEventListener("click", () =>
    act(C.move(state, { type: "bicentric" }), "I made the diagonals cross at right angles."));
  namesCheck.addEventListener("change", () =>
    act(C.move(state, { type: "names", value: namesCheck.checked }),
      namesCheck.checked ? "Names are now shown." : "Names are now hidden."));

  window.addEventListener("themechange", () => { refreshTokens(); draw(); });
  window.addEventListener("resize", () => draw());

  refreshTokens();
  reset();
})();
