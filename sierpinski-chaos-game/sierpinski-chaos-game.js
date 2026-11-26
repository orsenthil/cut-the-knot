"use strict";

/*
 * The page for Sierpinski Gasket via Chaos Game: drawing and input only;
 * the steps are in sierpinski-chaos-game-core.js. The canvas shows triangle
 * ABC; its corners, and the triangle itself, can be dragged (which wipes
 * the dots). Start / Stop / Continue run the game, one dot every Delay
 * milliseconds; with a small delay several dots are drawn per frame. Dots
 * are kept on a second, off-screen canvas so they stay when the triangle
 * is redrawn. Show iterations draws the last move: the line from the old
 * point (red) to the chosen corner, and the new point (blue) halfway along.
 */

(function () {
  const Core = SierpinskiChaosGameCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const dots = document.createElement("canvas");
  dots.width = W; dots.height = H;
  const dctx = dots.getContext("2d");
  const statusEl = document.getElementById("status");
  const countEl = document.getElementById("count");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const contBtn = document.getElementById("contBtn");
  const delayIn = document.getElementById("delayInput");
  const pixelIn = document.getElementById("pixelInput");
  const iterBox = document.getElementById("iterBox");
  const cornerBtns = document.getElementById("cornerBtns");

  let state = Core.start({ width: W, height: H });
  let running = false, timer = null, raf = null, drag = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const clampInput = (el, r) => { const v = Math.max(r.min, Math.min(r.max, Math.round(Number(el.value)))); el.value = String(Number.isFinite(v) ? v : r.def); return Number(el.value); };

  function plot(p) {
    const k = clampInput(pixelIn, Core.PIXEL);
    dctx.fillStyle = css("--text");
    dctx.fillRect(Math.round(p.x - k / 2), Math.round(p.y - k / 2), k, k);
  }

  function draw() {
    ctx.fillStyle = css("--surface");
    ctx.fillRect(0, 0, W, H);
    const { A, B, C } = state;
    ctx.strokeStyle = css("--border-strong"); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath(); ctx.stroke();
    ctx.drawImage(dots, 0, 0);
    if (iterBox.checked && running && state.Q && state.V) {
      ctx.strokeStyle = css("--muted"); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(state.Q.x, state.Q.y); ctx.lineTo(state.V.x, state.V.y); ctx.stroke();
      for (const [p, col] of [[state.Q, css("--bad")], [state.P, css("--accent")]]) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI); ctx.fill();
      }
    }
    ctx.fillStyle = css("--ink"); ctx.font = `italic 600 22px ${css("--font")}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const g = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
    for (const k of ["A", "B", "C"]) {
      const p = state[k];
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI); ctx.fillStyle = css("--accent"); ctx.fill();
      const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 1;
      ctx.fillStyle = css("--ink"); ctx.fillText(k, p.x + (dx / d) * 22, p.y + (dy / d) * 22);
    }
    countEl.textContent = `${state.count} point${state.count === 1 ? "" : "s"}`;
  }

  function sync() {
    startBtn.disabled = running;
    contBtn.disabled = running || state.count === 0;
    stopBtn.disabled = !running;
    if (window.Track) window.Track.state({ A: state.A, B: state.B, C: state.C, count: state.count });
  }

  function tick(n) {
    for (let i = 0; i < n; i++) { state = Core.step(state, Math.random()); plot(state.P); }
    draw();
  }

  function schedule() {
    clearTimeout(timer); cancelAnimationFrame(raf);
    if (!running) return;
    const delay = clampInput(delayIn, Core.DELAY);
    if (delay >= 16) timer = setTimeout(() => { tick(1); schedule(); }, delay);
    else raf = requestAnimationFrame(() => { tick(Math.min(400, Math.ceil(16 / Math.max(delay, 0.04)))); schedule(); });
  }

  function go() { running = true; sync(); say("Each new dot lands halfway between the last dot and a corner picked at random."); schedule(); }
  function stop() { running = false; schedule(); sync(); draw(); say(`Stopped after ${state.count} points. Do they fall into the holes?`); }

  /** Moving the triangle stops the run and wipes the dots, as in the applet. */
  function wipe(next) {
    state = next;
    running = false; schedule();
    dctx.clearRect(0, 0, W, H);
    sync(); draw();
  }

  startBtn.addEventListener("click", go);
  contBtn.addEventListener("click", go);
  stopBtn.addEventListener("click", stop);
  delayIn.addEventListener("change", () => { clampInput(delayIn, Core.DELAY); schedule(); });
  pixelIn.addEventListener("change", () => clampInput(pixelIn, Core.PIXEL));
  iterBox.addEventListener("change", draw);

  const toBoard = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
  function insideTri(p) {
    const [a, b, c] = Core.barycentric(state, p);
    return a >= 0 && b >= 0 && c >= 0;
  }
  canvas.addEventListener("pointerdown", (e) => {
    const p = toBoard(e);
    const hit = ["A", "B", "C"].find((k) => Math.hypot(state[k].x - p.x, state[k].y - p.y) < 20);
    if (hit) drag = { corner: hit };
    else if (insideTri(p)) drag = { last: p };
    else return;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    wipe(state);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = toBoard(e);
    const x = Math.max(0, Math.min(W, p.x)), y = Math.max(0, Math.min(H, p.y));
    if (drag.corner) wipe(Core.moveCorner(state, drag.corner, x, y));
    else { wipe(Core.moveTriangle(state, p.x - drag.last.x, p.y - drag.last.y)); drag.last = p; }
  });
  const end = () => { if (drag) { drag = null; say("Press Start to play the chaos game in this triangle."); } };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  // Keyboard: pick a corner button, then move it with the arrow keys.
  cornerBtns.addEventListener("keydown", (e) => {
    const k = e.target.dataset && e.target.dataset.corner;
    if (!k) return;
    const d = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key];
    if (!d) return;
    e.preventDefault();
    const p = state[k];
    wipe(Core.moveCorner(state, k, Math.max(0, Math.min(W, p.x + d[0])), Math.max(0, Math.min(H, p.y + d[1]))));
    say(`Corner ${k} moved. Press Start to play again.`);
  });

  window.addEventListener("themechange", () => {
    // Dots were drawn in the old ink: wipe them rather than mix two colours.
    wipe({ ...state, P: null, Q: null, V: null, count: 0 });
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && running) stop(); });

  sync(); draw();
  say("Press Start. You can drag the corners, or the whole triangle, first.");
})();
