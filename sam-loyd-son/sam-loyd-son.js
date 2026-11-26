"use strict";

/*
 * The page for Sam Loyd's Son's Dissection: drawing and input only; the
 * geometry is in sam-loyd-son-core.js. One canvas shows the square cut into
 * four pieces on the left and, on the right, the dashed outline of the
 * figure they seem to make, with its grid of cells. Drag a piece there (it
 * snaps in when close; the trapezoids turn as they go), use the buttons
 * under the picture, or press Animate to move the pieces one after another
 * as the applet does. Cheat nudges one corner of each piece to hide the
 * flaw; Size picks the Fibonacci numbers.
 */

(function () {
  const Core = SamLoydSonCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const animBtn = document.getElementById("animBtn");
  const resetBtn = document.getElementById("resetBtn");
  const cheatBox = document.getElementById("cheatBox");
  const sizeSel = document.getElementById("sizeSel");
  const piecesEl = document.getElementById("pieceBtns");
  const W = canvas.width, H = canvas.height;
  const PAD = 0.6;
  const HUES = [200, 30, 135, 290];

  let state = Core.start({});
  let order = [0, 1, 2, 3];
  let drag = null;
  let timer = null;
  let geo = null;

  function layout() {
    const S = Core.sizes(state.n);
    const scale = Math.min(W / (S.world.w + 2 * PAD), (H - 40) / (S.world.h + 2 * PAD));
    const ox = (W - scale * S.world.w) / 2, oy = (H - 40 - scale * S.world.h) / 2;
    geo = { S, scale, ox, oy };
  }
  const px = (x) => geo.ox + x * geo.scale, py = (y) => geo.oy + y * geo.scale;
  const cx = (x) => (x - geo.ox) / geo.scale, cy = (y) => (y - geo.oy) / geo.scale;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function path(poly) {
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))));
    ctx.closePath();
  }

  function draw() {
    layout();
    const { S, scale } = geo;
    const ink = css("--ink"), muted = css("--muted");
    ctx.fillStyle = css("--stage");
    ctx.fillRect(0, 0, W, H);
    // the figure's grid and outline
    const F = S.figure;
    const fig = Core.figure(state.n).map(([x, y]) => [x + F.x, y + F.y]);
    if (scale >= 5) {
      ctx.save();
      path(fig); ctx.clip();
      ctx.strokeStyle = muted; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      for (let i = 0; i <= F.w; i++) { ctx.beginPath(); ctx.moveTo(px(F.x + i), py(F.y)); ctx.lineTo(px(F.x + i), py(F.y + F.h)); ctx.stroke(); }
      for (let j = 0; j <= F.h; j++) { ctx.beginPath(); ctx.moveTo(px(F.x), py(F.y + j)); ctx.lineTo(px(F.x + F.w), py(F.y + j)); ctx.stroke(); }
      ctx.restore();
    }
    path(fig);
    ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    // the square's outline
    ctx.strokeStyle = muted; ctx.lineWidth = 1;
    ctx.strokeRect(px(S.square.x), py(S.square.y), S.c * scale, S.c * scale);
    for (const id of order) {
      path(Core.shapeOf(state, id));
      ctx.fillStyle = `hsl(${HUES[id]}, 65%, 62%)`;
      ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.stroke();
    }
    const k = Core.counts(state.n);
    ctx.fillStyle = muted; ctx.font = "bold 24px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`${S.c} × ${S.c} = ${k.square}`, px(S.square.x + S.c / 2), H - 8);
    ctx.fillText(`${k.figure} cells?`, px(F.x + F.w / 2), H - 8);
  }

  function updateButtons() {
    piecesEl.textContent = "";
    for (const def of Core.pieces(state.n, state.cheat)) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.id = def.id;
      const placed = state.pieces[def.id].placed;
      b.textContent = (placed ? "Take back the " : "Put in the ") + def.name;
      b.setAttribute("aria-pressed", placed ? "true" : "false");
      b.style.borderColor = `hsl(${HUES[def.id]}, 65%, 52%)`;
      piecesEl.appendChild(b);
    }
    cheatBox.checked = state.cheat;
    sizeSel.value = String(state.n);
  }

  function render() {
    draw();
    updateButtons();
    if (window.Track) window.Track.state({ n: state.n, cheat: state.cheat, placed: state.pieces.map((p) => p.placed), explored: state.explored });
  }

  function announce() {
    const placed = state.pieces.filter((p) => p.placed).length;
    if (placed < 4) return say(placed ? `${placed} of 4 pieces are in the figure.` : "");
    const { c } = Core.sizes(state.n);
    const k = Core.counts(state.n);
    if (state.n === Core.MIN_N) return say(`The ${c} × ${c} pieces cannot even look right: the middle row of this figure has no thickness.`, "done");
    if (state.cheat) return say(`With Cheat on, one corner of each piece is nudged, so the pieces seem to fill ${k.figure} cells exactly. Turn Cheat off to see the truth.`, "done");
    if (k.figure < k.square) say(`All four pieces are in. The figure counts ${k.figure} cells, but the square had ${k.square}: along the long slanted cut the pieces overlap by one cell.`, "done");
    else say(`All four pieces are in. The figure counts ${k.figure} cells, but the square had only ${k.square}: a thin gap of one cell runs along the long slanted cut.`, "done");
  }

  function apply(m) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    announce();
    return true;
  }

  const world = (e) => {
    const r = canvas.getBoundingClientRect();
    return [cx(((e.clientX - r.left) * W) / r.width), cy(((e.clientY - r.top) * H) / r.height)];
  };
  const hit = (pt, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (timer) return;
    const p = world(e);
    for (let k = order.length - 1; k >= 0; k--) {
      const id = order[k];
      const poly = Core.shapeOf(state, id);
      if (hit(p, poly)) {
        const mid = Core.middle(poly);
        drag = { id, dx: mid[0] - p[0], dy: mid[1] - p[1] };
        order = order.filter((v) => v !== id).concat(id);
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = world(e);
    const next = Core.move(state, { type: "drag", id: drag.id, x: p[0] + drag.dx, y: p[1] + drag.dy });
    if (next) { state = next; render(); }
  });
  const end = () => { if (drag) { drag = null; announce(); } };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  piecesEl.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || timer) return;
    const id = Number(b.dataset.id);
    apply({ type: state.pieces[id].placed ? "unplace" : "place", id });
    const nb = piecesEl.querySelector(`button[data-id="${id}"]`);
    if (nb) nb.focus();
  });

  function setBusy(busy) {
    // The applet greys out Animate, Reset and the size while the pieces move.
    animBtn.disabled = busy;
    resetBtn.disabled = busy;
    sizeSel.disabled = busy;
    piecesEl.querySelectorAll("button").forEach((b) => (b.disabled = busy));
  }

  /** Run: each piece in turn slides (and turns) to its place in 50 steps of 10 ms. */
  animBtn.addEventListener("click", () => {
    const todo = state.pieces.filter((p) => !p.placed).map((p) => p.id);
    if (!todo.length) return;
    say("Moving the pieces…");
    let i = 0, step = 0;
    const from = todo.map((id) => state.pieces[id].f);
    setBusy(true);
    timer = setInterval(() => {
      step++;
      const id = todo[i];
      const f = from[i] + (1 - from[i]) * (step / Core.STEPS);
      state = Core.move(state, { type: "toward", id, f });
      render();
      setBusy(true);
      if (step >= Core.STEPS) { step = 0; i++; }
      if (i >= todo.length) {
        clearInterval(timer);
        timer = null;
        setBusy(false);
        animBtn.disabled = true; // as in the applet, until Reset
        announce();
        resetBtn.focus();
      }
    }, 10);
  });

  function restart(m) {
    if (timer) return;
    apply(m);
    order = [0, 1, 2, 3];
    animBtn.disabled = false;
    say(`Back to the ${state.n === Core.MIN_N ? "3 × 3" : Core.sizes(state.n).c + " × " + Core.sizes(state.n).c} square.`);
  }
  resetBtn.addEventListener("click", () => restart({ type: "reset" }));
  cheatBox.addEventListener("change", () => restart({ type: "cheat", value: cheatBox.checked }));
  sizeSel.addEventListener("change", () => restart({ type: "n", value: Number(sizeSel.value) }));
  window.addEventListener("themechange", render);

  for (let n = Core.MIN_N; n <= Core.MAX_N; n++) {
    const o = document.createElement("option");
    const S = Core.sizes(n);
    o.value = String(n);
    o.textContent = `${S.c} × ${S.c}`;
    sizeSel.appendChild(o);
  }
  render();
})();
