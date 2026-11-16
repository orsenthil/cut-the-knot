"use strict";

/*
 * The page for Trans Example: a canvas of vertical lines. In Draw mode a
 * press-drag-release from one line to another adds a shuttle at the pressed
 * height; in Verify mode a click walks a line from the top and numbers the
 * bottom it reaches. The rules live in trans-example-core.js.
 *
 * Keyboard: the canvas holds a cursor (a line and a height). Arrows move it,
 * Enter starts a shuttle in Draw mode or traces the line in Verify mode,
 * Enter again finishes the shuttle on the cursor's line, Escape cancels.
 */

(function () {
  const Core = TransExampleCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const drawBtn = document.getElementById("drawBtn");
  const verifyBtn = document.getElementById("verifyBtn");
  const polesInput = document.getElementById("polesInput");
  const removeBtn = document.getElementById("removeBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Logical board size; the canvas scales to its box (the applet was 400x300).
  const W = canvas.width;
  const H = canvas.height;
  const Y_MIN = 40;
  const Y_MAX = H - 60;
  const HIT_W = 30;
  const KNOT_R = 6;
  const STEPS = 48; // keyboard height slots between the tops and bottoms

  let state = Core.start({});
  let pending = null; // shuttle being dragged: {a, h, x}
  let cursor = { pole: 0, step: Math.round(STEPS / 2) };
  let focused = false;
  let announce = null; // the applet's one-line refusal message

  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const poleX = p => ((p + 1) * W) / (state.n + 1);
  const yOf = h => Y_MIN + h * (Y_MAX - Y_MIN);
  const hOf = y => (y - Y_MIN) / (Y_MAX - Y_MIN);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function guidance() {
    if (Core.result(state) === "done") {
      say(`All ${state.n} lines traced — every top reached a different bottom.`, "done");
      return;
    }
    if (announce) { say(announce); return; }
    if (state.mode === "draw") {
      say(state.bars.length === 0
        ? "Drag from one line to another to draw a shuttle."
        : `${state.bars.length} shuttle${state.bars.length === 1 ? "" : "s"}. Choose Verify to follow the lines.`);
    } else {
      const traced = state.labels.filter(l => l > 0).length;
      say(`Click a line to follow it from the top. ${traced} of ${state.n} traced.`);
    }
  }

  function poleAt(x, y) {
    if (!(y > Y_MIN && y < Y_MAX)) return null;
    for (let p = 0; p < state.n; p++) {
      if (x > poleX(p) - HIT_W && x < poleX(p) + HIT_W) return p;
    }
    return null;
  }

  function toBoard(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * (canvas.width / rect.width),
      y: (ev.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  /* ------------------------------------------------------------ drawing */

  function draw() {
    const ink = css("--ink");
    const accent = css("--accent");
    const muted = css("--muted");
    ctx.clearRect(0, 0, W, H);

    // The lines.
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (let p = 0; p < state.n; p++) {
      ctx.beginPath();
      ctx.moveTo(poleX(p), Y_MIN);
      ctx.lineTo(poleX(p), Y_MAX);
      ctx.stroke();
    }

    // The shuttles, with a knot at each end.
    for (const b of state.bars) {
      const y = yOf(b.h);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(poleX(b.a), y);
      ctx.lineTo(poleX(b.b), y);
      ctx.stroke();
      ctx.fillStyle = accent;
      for (const p of [b.a, b.b]) {
        ctx.beginPath();
        ctx.arc(poleX(p), y, KNOT_R, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // A shuttle still being dragged follows the pointer.
    if (pending) {
      const y = yOf(pending.h);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(poleX(pending.a), y);
      ctx.lineTo(pending.x, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The itinerary of the last verified line.
    if (state.mode === "verify" && state.itinerary) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.beginPath();
      state.itinerary.points.forEach((pt, i) => {
        const x = poleX(pt.pole);
        const y = yOf(pt.h);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Numbers: tops in Verify mode, bottoms once reached.
    ctx.fillStyle = ink;
    ctx.font = "600 26px " + css("--font");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let p = 0; p < state.n; p++) {
      if (state.mode === "verify") ctx.fillText(String(p + 1), poleX(p), Y_MIN - 20);
      if (state.labels[p] > 0) {
        ctx.fillStyle = accent;
        ctx.fillText(String(state.labels[p]), poleX(p), Y_MAX + 26);
        ctx.fillStyle = ink;
      }
    }

    // The keyboard cursor.
    if (focused) {
      const x = poleX(cursor.pole);
      const y = yOf(cursor.step / STEPS);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, KNOT_R + 6, 0, Math.PI * 2);
      ctx.stroke();
      if (pending && pending.keyboard) {
        ctx.fillStyle = muted;
        ctx.font = "24px " + css("--font");
        ctx.fillText("Enter: finish here · Esc: cancel", W / 2, H - 14);
      }
    }
  }

  function render() {
    draw();
    removeBtn.disabled = state.mode !== "draw" || state.bars.length === 0;
    drawBtn.setAttribute("aria-pressed", String(state.mode === "draw"));
    verifyBtn.setAttribute("aria-pressed", String(state.mode === "verify"));
    if (window.Track) window.Track.state(state);
  }

  /* ------------------------------------------------------------- actions */

  function afterChange() {
    announce = null;
    render();
    guidance();
  }

  function refuse() {
    announce = "This location is occupied! Select another.";
    pending = null;
    render();
    guidance();
  }

  // Finish a drag (or a keyboard shuttle) on pole b, as mouseReleased does.
  function finishShuttle(b) {
    const a = pending.a;
    const h = pending.h;
    pending = null;
    if (b === null || b === a) { render(); return; } // cancel, as the applet does
    if (Core.occupied(state, b, h)) { refuse(); return; }
    const next = Core.addBar(state, a, b, h);
    if (next) { state = next; afterChange(); } else { render(); }
  }

  function verifyPole(p) {
    if (p === null) return;
    const next = Core.trace(state, p);
    if (next) { state = next; afterChange(); }
  }

  /* -------------------------------------------------------- pointer input */

  canvas.addEventListener("pointerdown", ev => {
    ev.preventDefault();
    canvas.focus();
    const { x, y } = toBoard(ev);
    const p = poleAt(x, y);
    if (state.mode === "draw") {
      if (p === null) return;
      const h = hOf(y);
      if (Core.occupied(state, p, h)) { refuse(); return; }
      pending = { a: p, h, x };
      canvas.setPointerCapture(ev.pointerId);
      render();
    }
  });

  canvas.addEventListener("pointermove", ev => {
    if (!pending || pending.keyboard) return;
    pending.x = toBoard(ev).x;
    draw();
  });

  canvas.addEventListener("pointerup", ev => {
    const { x, y } = toBoard(ev);
    const p = poleAt(x, y);
    if (state.mode === "draw") {
      if (pending && !pending.keyboard) finishShuttle(p);
    } else {
      verifyPole(p);
    }
  });

  canvas.addEventListener("pointercancel", () => {
    if (pending && !pending.keyboard) { pending = null; render(); }
  });

  /* ------------------------------------------------------- keyboard input */

  canvas.addEventListener("focus", () => { focused = true; draw(); });
  canvas.addEventListener("blur", () => { focused = false; draw(); });

  canvas.addEventListener("keydown", ev => {
    const key = ev.key;
    let handled = true;
    if (key === "ArrowLeft") cursor.pole = Math.max(0, cursor.pole - 1);
    else if (key === "ArrowRight") cursor.pole = Math.min(state.n - 1, cursor.pole + 1);
    else if (key === "ArrowUp") cursor.step = Math.max(1, cursor.step - 1);
    else if (key === "ArrowDown") cursor.step = Math.min(STEPS - 1, cursor.step + 1);
    else if (key === "Escape") { if (pending) { pending = null; } }
    else if (key === "Enter" || key === " ") {
      if (state.mode === "verify") {
        verifyPole(cursor.pole);
      } else if (!pending) {
        const h = cursor.step / STEPS;
        if (Core.occupied(state, cursor.pole, h)) { refuse(); handled = true; ev.preventDefault(); return; }
        pending = { a: cursor.pole, h, x: poleX(cursor.pole), keyboard: true };
      } else if (pending.keyboard) {
        finishShuttle(cursor.pole);
      }
    } else handled = false;
    if (handled) {
      ev.preventDefault();
      if (state.n <= cursor.pole) cursor.pole = state.n - 1;
      draw();
    }
  });

  /* ------------------------------------------------------------- controls */

  drawBtn.addEventListener("click", () => {
    pending = null;
    state = Core.setMode(state, "draw");
    afterChange();
  });

  verifyBtn.addEventListener("click", () => {
    pending = null;
    state = Core.setMode(state, "verify");
    afterChange();
  });

  polesInput.addEventListener("change", () => {
    const n = Math.min(Core.MAX_POLES, Math.max(Core.MIN_POLES, Math.round(Number(polesInput.value) || Core.DEFAULT_POLES)));
    polesInput.value = String(n);
    pending = null;
    state = Core.setPoles(state, n);
    cursor.pole = Math.min(cursor.pole, n - 1);
    afterChange();
  });

  removeBtn.addEventListener("click", () => {
    const next = Core.removeLast(state);
    if (next) { state = next; afterChange(); }
  });

  resetBtn.addEventListener("click", () => {
    pending = null;
    state = Core.reset(state);
    afterChange();
  });

  window.addEventListener("themechange", draw);

  render();
  guidance();
})();