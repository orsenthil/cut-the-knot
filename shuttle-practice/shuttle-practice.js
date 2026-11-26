"use strict";

/*
 * The page for Shuttle Puzzle Practice: a canvas of numbered poles with the
 * target written under them. Press on a pole and drag to another to draw a
 * shuttle at that height; Verify checks the walks against the target. The
 * rules are in shuttle-practice-core.js.
 *
 * Keyboard: the canvas holds a cursor (a pole and a height). Arrows move it,
 * Enter starts a shuttle, Enter on another pole finishes it, Escape cancels.
 */

(function () {
  const Core = ShuttlePracticeCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const hintEl = document.getElementById("hint");
  const hintBox = document.getElementById("hintBox");
  const polesInput = document.getElementById("polesInput");
  const removeBtn = document.getElementById("removeBtn");
  const verifyBtn = document.getElementById("verifyBtn");
  const resetBtn = document.getElementById("resetBtn");

  const W = canvas.width, H = canvas.height;
  const Y_MIN = 60, Y_MAX = H - 60;
  const HIT_W = 30, KNOT_R = 6;
  const KEY_STEP = 6; // rows per arrow press

  let state = Core.start({});
  let pending = null; // {a, h, x, keyboard}
  let cursor = { pole: 0, h: Math.round(Core.ROWS / 2) };
  let focused = false;

  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const poleX = (p) => ((p + 1) * W) / (state.n + 1);
  const yOf = (h) => Y_MIN + (h / Core.ROWS) * (Y_MAX - Y_MIN);
  const hOf = (y) => Math.round(((y - Y_MIN) / (Y_MAX - Y_MIN)) * Core.ROWS);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function poleAt(x, y) {
    if (!(y > Y_MIN && y < Y_MAX)) return null;
    for (let p = 0; p < state.n; p++) if (x > poleX(p) - HIT_W && x < poleX(p) + HIT_W) return p;
    return null;
  }

  function toBoard(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }

  function draw() {
    const ink = css("--ink"), accent = css("--accent"), muted = css("--muted");
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    for (let p = 0; p < state.n; p++) {
      ctx.beginPath(); ctx.moveTo(poleX(p), Y_MIN); ctx.lineTo(poleX(p), Y_MAX); ctx.stroke();
    }
    for (const b of state.bars) {
      const y = yOf(b.h);
      ctx.strokeStyle = ink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(poleX(b.a), y); ctx.lineTo(poleX(b.b), y); ctx.stroke();
      ctx.fillStyle = accent;
      for (const p of [b.a, b.b]) { ctx.beginPath(); ctx.arc(poleX(p), y, KNOT_R, 0, 2 * Math.PI); ctx.fill(); }
    }
    if (pending) {
      const y = yOf(pending.h);
      ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(poleX(pending.a), y); ctx.lineTo(pending.x, y); ctx.stroke();
      ctx.setLineDash([]);
    }
    const size = state.n > 12 ? 20 : 26;
    ctx.font = `600 ${size}px ${css("--font")}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const labels = Core.bottomLabels(state);
    for (let p = 0; p < state.n; p++) {
      ctx.fillStyle = ink; ctx.fillText(String(p + 1), poleX(p), Y_MIN - 26);
      ctx.fillStyle = accent; ctx.fillText(String(labels[p]), poleX(p), Y_MAX + 28);
    }
    if (focused) {
      ctx.strokeStyle = accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(poleX(cursor.pole), yOf(cursor.h), KNOT_R + 6, 0, 2 * Math.PI); ctx.stroke();
      if (pending && pending.keyboard) {
        ctx.fillStyle = muted; ctx.font = `22px ${css("--font")}`;
        ctx.fillText("Enter on another pole: finish · Esc: cancel", W / 2, H - 10);
      }
    }
  }

  function render() {
    // Keep poles a fingertip apart: a wide board slides sideways instead of shrinking.
    canvas.style.minWidth = `${(state.n + 1) * 2.4}rem`;
    draw();
    removeBtn.disabled = state.bars.length === 0;
    hintEl.hidden = !hintBox.checked;
    hintEl.textContent = "";
    if (hintBox.checked) {
      const t = document.createElement("div");
      t.textContent = "Transpositions: " + (Core.product(state) || "none yet");
      const c = document.createElement("div");
      c.textContent = "Target in cycles: " + Core.cycles(state.goal);
      hintEl.append(t, c);
    }
    if (window.Track) window.Track.state({ n: state.n, goal: state.goal, bars: state.bars, verdict: state.verdict });
  }

  function guide() {
    if (state.verdict) return say(Core.message(state), Core.outcome(state) || undefined);
    say(state.bars.length
      ? `${state.bars.length} shuttle${state.bars.length === 1 ? "" : "s"}. Press Verify when every top should reach its number.`
      : "Each number under a pole is the top that should end there. Drag between poles to draw shuttles.");
  }

  function finishShuttle(b) {
    const { a, h } = pending;
    pending = null;
    if (b === null || b === a) { render(); return; }
    const r = Core.addBar(state, a, b, h);
    if (r.state) { state = r.state; render(); guide(); }
    else { render(); if (r.refused) say(r.refused); }
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.focus();
    const { x, y } = toBoard(e);
    const p = poleAt(x, y);
    if (p === null) return;
    const h = hOf(y);
    if (state.bars.some((b) => b.h === h)) { say(Core.MSG.height); return; }
    pending = { a: p, h, x };
    canvas.setPointerCapture(e.pointerId);
    render();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pending || pending.keyboard) return;
    pending.x = toBoard(e).x;
    draw();
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!pending || pending.keyboard) return;
    const { x, y } = toBoard(e);
    finishShuttle(poleAt(x, Math.min(Math.max(y, Y_MIN + 1), Y_MAX - 1)));
  });
  canvas.addEventListener("pointercancel", () => { if (pending && !pending.keyboard) { pending = null; render(); } });

  canvas.addEventListener("focus", () => { focused = true; draw(); });
  canvas.addEventListener("blur", () => { focused = false; draw(); });
  canvas.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "ArrowLeft") cursor.pole = Math.max(0, cursor.pole - 1);
    else if (k === "ArrowRight") cursor.pole = Math.min(state.n - 1, cursor.pole + 1);
    else if (k === "ArrowUp") cursor.h = Math.max(KEY_STEP, cursor.h - KEY_STEP);
    else if (k === "ArrowDown") cursor.h = Math.min(Core.ROWS - KEY_STEP, cursor.h + KEY_STEP);
    else if (k === "Escape") pending = null;
    else if (k === "Enter" || k === " ") {
      if (!pending) {
        if (state.bars.some((b) => b.h === cursor.h)) { say(Core.MSG.height); e.preventDefault(); return; }
        pending = { a: cursor.pole, h: cursor.h, x: poleX(cursor.pole), keyboard: true };
      } else if (pending.keyboard) {
        if (pending.a !== cursor.pole) { finishShuttle(cursor.pole); e.preventDefault(); return; }
      }
    } else return;
    e.preventDefault();
    if (pending && pending.keyboard) pending.x = poleX(cursor.pole);
    draw();
  });

  verifyBtn.addEventListener("click", () => { state = Core.verify(state); render(); guide(); });
  removeBtn.addEventListener("click", () => { const s = Core.removeLast(state); if (s) { state = s; render(); guide(); } });
  function fresh() {
    pending = null;
    const n = Math.min(Core.MAX_N, Math.max(Core.MIN_N, Math.round(Number(polesInput.value) || Core.DEFAULT_N)));
    polesInput.value = String(n);
    state = Core.start({ n });
    cursor.pole = Math.min(cursor.pole, n - 1);
    render();
    guide();
  }
  resetBtn.addEventListener("click", fresh);
  polesInput.addEventListener("change", fresh);
  hintBox.addEventListener("change", render);
  window.addEventListener("themechange", draw);

  render();
  guide();
})();
