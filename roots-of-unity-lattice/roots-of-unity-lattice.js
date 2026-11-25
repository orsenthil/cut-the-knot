"use strict";

/*
 * The page for Roots of Unity Lattice: drawing and input only. The cloud is
 * fitted to the canvas. Every unit pair is a faint line (when there are not
 * too many); the chosen point's neighbours get bold lines.
 */

(function () {
  const Core = RootsCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const mEl = document.getElementById("m");
  const rEl = document.getElementById("r");
  const rOut = document.getElementById("rOut");
  const W = canvas.width, H = canvas.height, PAD = 24;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  let pts = [], view = null, focus = 0, pairs = 0;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function fit() {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const s = Math.min((W - 2 * PAD) / Math.max(x1 - x0, 1e-6), (H - 2 * PAD) / Math.max(y1 - y0, 1e-6));
    view = { s, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  const px = (p) => ({ x: W / 2 + (p.x - view.cx) * view.s, y: H / 2 - (p.y - view.cy) * view.s });

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const m = Core.clampM(mEl.value), nb = Core.neighbours(pts, focus);
    if (pairs <= 2500) {
      ctx.strokeStyle = css("--border-strong"); ctx.lineWidth = 1; ctx.beginPath();
      const roots = Core.unitVectors(m), index = new Map(pts.map((p, i) => [p.a.join(","), i]));
      for (let i = 0; i < pts.length; i++) for (const u of roots) {
        const j = index.get(pts[i].a.map((v, k) => v + u[k]).join(","));
        if (j !== undefined && j > i) { const a = px(pts[i]), b = px(pts[j]); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      }
      ctx.stroke();
    }
    const f = px(pts[focus]);
    ctx.strokeStyle = css("--accent"); ctx.lineWidth = 3;
    for (const j of nb) { const q = px(pts[j]); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    ctx.fillStyle = css("--muted");
    const rad = Math.max(1.5, Math.min(4, 120 / Math.sqrt(pts.length)));
    for (const p of pts) { const q = px(p); ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, 2 * Math.PI); ctx.fill(); }
    ctx.fillStyle = css("--accent"); ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.x, f.y, 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  }

  function rebuild() {
    const m = Core.clampM(mEl.value), cap = Core.maxR(m);
    rEl.max = cap;
    const r = Math.min(Number(rEl.value), cap);
    rEl.value = r; rOut.textContent = r;
    pts = Core.build(m, r);
    pairs = Core.countByRoots(m, pts);
    fit();
    focus = pts.findIndex((p) => p.a.every((v) => v === Math.floor((r + 1) / 2)));
    if (focus < 0) focus = 0;
    update(m, r);
  }

  function update(m, r) {
    m = m || Core.clampM(mEl.value); r = r || Number(rEl.value);
    const g = Core.bestSquareGrid(pts.length), nb = Core.neighbours(pts, focus).length;
    readout.textContent = `m = ${m}: ${Core.phi(m)} independent arrows, each used 0 to ${r} times\n` +
      `${pts.length.toLocaleString("en")} points → ${pairs.toLocaleString("en")} unit pairs; the chosen point has ${nb}\n` +
      `best square grid, ${g.n.toLocaleString("en")} points (${g.k} × ${g.k}): ${g.count.toLocaleString("en")} unit pairs`;
    draw();
    if (pairs > g.count) say(`Ahead of the square grid: ${pairs.toLocaleString("en")} against ${g.count.toLocaleString("en")}.`, "done");
    else say(`Behind the square grid: ${pairs.toLocaleString("en")} against ${g.count.toLocaleString("en")}. Try other settings.`, "done");
    if (typeof Track !== "undefined" && Track.state) Track.state({ m, r, n: pts.length, pairs, grid: g.count });
  }

  mEl.addEventListener("change", rebuild);
  rEl.addEventListener("input", rebuild);
  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect(), mx = (e.clientX - rect.left) * (W / rect.width), my = (e.clientY - rect.top) * (H / rect.height);
    let best = focus, bd = Infinity;
    pts.forEach((p, i) => { const q = px(p), d = Math.hypot(q.x - mx, q.y - my); if (d < bd) { bd = d; best = i; } });
    focus = best; update();
  });
  document.getElementById("resetBtn").addEventListener("click", () => { mEl.value = "12"; rEl.value = 2; rebuild(); });
  window.addEventListener("themechange", draw);
  rebuild();
})();
