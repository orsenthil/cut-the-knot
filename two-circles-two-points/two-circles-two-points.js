"use strict";

/*
 * The page for Two Circles, Two Points: drawing and input only. Two dots A and
 * B, a circle of radius 1 round each, and a mark at every place the circles
 * cross. The board shows x from -3.2 to 3.2 (100 pixels to the unit).
 */

(function () {
  const Core = TwoCirclesCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const nEl = document.getElementById("n");
  const nOut = document.getElementById("nOut");
  const W = canvas.width, H = canvas.height, S = 100, R = 11;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const toPx = (p) => ({ x: W / 2 + p.x * S, y: H / 2 - p.y * S });
  const toWorld = (x, y) => ({ x: (x - W / 2) / S, y: (H / 2 - y) / S });
  const start = () => [{ x: -1.5, y: 0 }, { x: 1.5, y: 0.3 }];

  let pts = start(), sel = 0, drag = -1, sawTwo = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function draw(meets) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 3;
    pts.forEach((p, i) => {
      const q = toPx(p);
      ctx.strokeStyle = i ? css("--accent") : css("--good");
      ctx.beginPath(); ctx.arc(q.x, q.y, S, 0, 2 * Math.PI); ctx.stroke();
    });
    ctx.strokeStyle = css("--muted"); ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
    const a = toPx(pts[0]), b = toPx(pts[1]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    for (const m of meets) {
      const q = toPx(m);
      ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, 2 * Math.PI); ctx.fillStyle = css("--bad"); ctx.fill();
      ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2; ctx.stroke();
    }
    pts.forEach((p, i) => {
      const q = toPx(p);
      ctx.beginPath(); ctx.arc(q.x, q.y, R, 0, 2 * Math.PI);
      ctx.fillStyle = i ? css("--accent") : css("--good"); ctx.fill();
      ctx.lineWidth = i === sel ? 4 : 2; ctx.strokeStyle = css("--ink"); ctx.stroke();
    });
  }

  function update() {
    const meets = Core.commonNeighbours(pts[0], pts[1]);
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const n = Core.clampN(nEl.value);
    nOut.textContent = n;
    readout.textContent = `Dots ${d.toFixed(2)} apart: the circles cross in ${meets.length} place${meets.length === 1 ? "" : "s"}.\n` +
      `With ${n} points at most ${Core.edgeLimit(n)} pairs can be one step apart (about n^1.5 / 1.41 = ${Math.round(Math.pow(n, 1.5) / Math.SQRT2)}).`;
    draw(meets);
    if (meets.length === 2) { sawTwo = true; say("Two crossings, the most two circles can have. A third is impossible.", "win"); }
    else if (sawTwo) say("", null);
    if (typeof Track !== "undefined" && Track.state) Track.state({ a: { x: +pts[0].x.toFixed(3), y: +pts[0].y.toFixed(3) }, b: { x: +pts[1].x.toFixed(3), y: +pts[1].y.toFixed(3) }, crossings: meets.length, n });
  }

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  function move(i, w) {
    const lim = (v, m) => Math.max(-m, Math.min(m, v));
    pts[i] = { x: lim(w.x, 3.1), y: lim(w.y, 2.0) };
    if (i === 1) pts[1] = Core.separate(pts[0], pts[1]); else { const o = Core.separate(pts[1], pts[0]); pts[0] = o; }
    update();
  }
  canvas.addEventListener("pointerdown", (e) => {
    const m = pick(e);
    let best = -1, bd = 30;
    pts.forEach((p, i) => { const q = toPx(p), d = Math.hypot(q.x - m.x, q.y - m.y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { drag = best; sel = best; canvas.setPointerCapture(e.pointerId); update(); }
  });
  canvas.addEventListener("pointermove", (e) => { if (drag >= 0) { const m = pick(e); move(drag, toWorld(m.x, m.y)); } });
  const release = () => { drag = -1; };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.01 : 0.05, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (e.key === " " || e.key === "Enter") { sel = 1 - sel; update(); e.preventDefault(); }
    else if (d) { move(sel, { x: pts[sel].x + d[0], y: pts[sel].y + d[1] }); e.preventDefault(); }
  });
  nEl.addEventListener("input", update);
  document.getElementById("resetBtn").addEventListener("click", () => { pts = start(); sel = 0; sawTwo = false; say("", null); update(); });
  window.addEventListener("themechange", update);
  update();
})();
