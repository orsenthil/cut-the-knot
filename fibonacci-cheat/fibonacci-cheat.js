"use strict";

/*
 * The page for A Faulty Dissection: drawing and input only; the geometry is in
 * fibonacci-cheat-core.js. One canvas shows the 8 x 8 square cut into four pieces and an outline of
 * the 5 x 13 rectangle. Drag a piece into the rectangle (it snaps in when it is close, the
 * triangles turning as they go), or use the four buttons, or press Animate. "Honest pieces" shows
 * the true shapes in the rectangle, with the gap of area 1 the applet hides.
 */

(function () {
  const Core = FibonacciCheatCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const animBtn = document.getElementById("animBtn");
  const resetBtn = document.getElementById("resetBtn");
  const honestBox = document.getElementById("honestBox");
  const piecesEl = document.getElementById("pieceBtns");
  const W = canvas.width, H = canvas.height;
  const SCALE = Math.min(W / Core.WORLD.w, H / Core.WORLD.h);
  const OX = (W - SCALE * Core.WORLD.w) / 2, OY = (H - SCALE * Core.WORLD.h) / 2;
  const px = (x) => OX + x * SCALE, py = (y) => OY + y * SCALE;
  const cx = (x) => (x - OX) / SCALE, cy = (y) => (y - OY) / SCALE;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let state = Core.start({});
  let order = [0, 1, 2, 3]; // drawing order, last on top
  let drag = null;
  let timer = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }
  const tok = (st, n, f) => st.getPropertyValue(n).trim() || f;
  const HUES = [200, 30, 135, 290];

  function path(poly) { ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)))); ctx.closePath(); }

  function draw() {
    const st = getComputedStyle(document.documentElement);
    const stage = tok(st, "--stage", "#f3f5f8"), ink = tok(st, "--ink", "#1f2430"), muted = tok(st, "--muted", "#5d6472"), accent = tok(st, "--accent", "#5b4ee8");
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = stage; ctx.fillRect(0, 0, W, H);
    // the rectangle's outline, with its grid
    const R = Core.RECT;
    ctx.strokeStyle = muted; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
    for (let i = 0; i <= R.w; i++) { ctx.beginPath(); ctx.moveTo(px(R.x + i), py(R.y)); ctx.lineTo(px(R.x + i), py(R.y + R.h)); ctx.stroke(); }
    for (let j = 0; j <= R.h; j++) { ctx.beginPath(); ctx.moveTo(px(R.x), py(R.y + j)); ctx.lineTo(px(R.x + R.w), py(R.y + j)); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.strokeRect(px(R.x), py(R.y), R.w * SCALE, R.h * SCALE);
    ctx.setLineDash([]);
    for (const id of order) {
      const poly = Core.shapeOf(state, id);
      path(poly);
      ctx.fillStyle = `hsl(${HUES[id]}, 65%, 62%)`; ctx.fill();
      ctx.lineWidth = state.pieces[id].placed ? 1.5 : 2; ctx.strokeStyle = ink; ctx.stroke();
    }
    ctx.fillStyle = muted; ctx.font = `${Math.max(11, SCALE * 0.55)}px system-ui, sans-serif`; ctx.textAlign = "center";
    ctx.fillText("8 × 8 = 64", px(4), py(Core.SQUARE.y + 8) + SCALE * 0.8);
    ctx.fillText("5 × 13 = 65", px(R.x + R.w / 2), py(R.y + R.h) + SCALE * 0.8);
  }

  function updateButtons() {
    piecesEl.textContent = "";
    for (const def of Core.PIECES) {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.id = def.id;
      const placed = state.pieces[def.id].placed;
      b.textContent = (placed ? "Take back " : "Put in ") + def.name;
      b.setAttribute("aria-pressed", placed ? "true" : "false");
      b.style.borderColor = `hsl(${HUES[def.id]}, 65%, 52%)`;
      piecesEl.appendChild(b);
    }
    honestBox.checked = state.honest;
  }

  function render() {
    draw(); updateButtons();
    if (window.Track) window.Track.state({ ...state, pieces: state.pieces.map((p) => ({ id: p.id, f: p.f, placed: p.placed })) });
  }

  function announce() {
    const placed = state.pieces.filter((p) => p.placed).length;
    if (placed === 4) say(state.honest ? "The true pieces: they cover 64 cells of the rectangle and leave a thin gap of 1 cell along the diagonal." : "All four pieces fill the rectangle: 64 = 65?! Turn on Honest pieces to find the missing cell.");
    else say(placed ? `${placed} of 4 pieces are in the rectangle.` : "");
  }

  function apply(m) { const next = Core.move(state, m); if (!next) return false; state = next; render(); announce(); return true; }

  const world = (e) => { const r = canvas.getBoundingClientRect(); return [cx(((e.clientX - r.left) * W) / r.width), cy(((e.clientY - r.top) * H) / r.height)]; };
  const hit = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };

  canvas.addEventListener("pointerdown", (e) => {
    stopAnim();
    const p = world(e);
    for (let k = order.length - 1; k >= 0; k--) {
      const id = order[k];
      if (hit(p, Core.shapeOf(state, id))) {
        const mid = Core.middle(Core.shapeOf(state, id));
        drag = { id, dx: mid[0] - p[0], dy: mid[1] - p[1] };
        order = order.filter((v) => v !== id).concat(id);
        canvas.setPointerCapture(e.pointerId); e.preventDefault();
        return;
      }
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = world(e);
    const was = state.pieces[drag.id].placed;
    const next = Core.move(state, { type: "drag", id: drag.id, x: p[0] + drag.dx, y: p[1] + drag.dy });
    if (!next) return;
    state = next; render();
    if (!was && state.pieces[drag.id].placed) announce();
  });
  const end = () => { if (drag) { drag = null; announce(); } };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

  piecesEl.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    stopAnim();
    const id = Number(b.dataset.id);
    apply({ type: state.pieces[id].placed ? "unplace" : "place", id });
    const nb = piecesEl.querySelector(`button[data-id="${id}"]`); if (nb) nb.focus();
  });

  function stopAnim() { if (timer) { clearInterval(timer); timer = null; animBtn.textContent = "Animate"; } }
  animBtn.addEventListener("click", () => {
    if (timer) { stopAnim(); return; }
    const back = state.pieces.every((p) => p.placed);
    if (reduced) { apply({ type: "toward", f: back ? 0 : 1 }); return; }
    let step = 0;
    animBtn.textContent = "Stop";
    timer = setInterval(() => {
      step++;
      const f = back ? 1 - step / Core.STEPS : step / Core.STEPS;
      state = Core.move(state, { type: "toward", f: Math.max(0, Math.min(1, f)) }); render();
      if (step >= Core.STEPS) { stopAnim(); announce(); }
    }, 30);
  });
  resetBtn.addEventListener("click", () => { stopAnim(); state = Core.move(state, { type: "reset" }); order = [0, 1, 2, 3]; render(); say("Back to the square."); });
  honestBox.addEventListener("change", () => { state = Core.move(state, { type: "honest", value: honestBox.checked }); render(); announce(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopAnim(); });
  window.addEventListener("themechange", render);

  render();
})();
