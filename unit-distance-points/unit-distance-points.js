"use strict";

/*
 * The page for Unit Distance Points: drawing and input only. The board shows
 * the plane from x = -3.2 to 3.2; the ruler in the corner is one unit long.
 * Dragging pulls a point onto the nearest exact unit distance (the core's
 * snap), so a mouse can reach "exactly 1".
 */

(function () {
  const Core = UnitDistanceCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const nEl = document.getElementById("n");
  const nOut = document.getElementById("nOut");
  const readout = document.getElementById("readout");
  const W = canvas.width, H = canvas.height, SCALE = 100, R = 11;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const toPx = (p) => ({ x: W / 2 + p.x * SCALE, y: H / 2 - p.y * SCALE });
  const toWorld = (x, y) => ({ x: (x - W / 2) / SCALE, y: (H / 2 - y) / SCALE });

  let n = Core.clampN(nEl.value), pts = Core.start(n), sel = 0, drag = -1, revealed = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const ps = Core.pairs(pts);
    ctx.lineWidth = 3; ctx.strokeStyle = css("--good");
    for (const [i, j] of ps) { const a = toPx(pts[i]), b = toPx(pts[j]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    pts.forEach((p, i) => {
      const q = toPx(p);
      ctx.beginPath(); ctx.arc(q.x, q.y, R, 0, 2 * Math.PI);
      ctx.fillStyle = css("--accent"); ctx.fill();
      ctx.lineWidth = i === sel ? 4 : 2; ctx.strokeStyle = css("--ink"); ctx.stroke();
    });
    // the ruler: one unit
    ctx.strokeStyle = css("--ink"); ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(20, H - 24); ctx.lineTo(20 + SCALE, H - 24); ctx.moveTo(20, H - 32); ctx.lineTo(20, H - 16); ctx.moveTo(20 + SCALE, H - 32); ctx.lineTo(20 + SCALE, H - 16); ctx.stroke();
    ctx.fillStyle = css("--muted"); ctx.font = "20px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText("1 step", 20 + SCALE + 10, H - 18);
  }

  function update() {
    const c = Core.count(pts), target = Core.TARGETS[n];
    readout.textContent = `${n} points · ${c} pairs one step apart · target ${target}`;
    draw();
    if (!revealed && c >= target) say(`Yes! ${c} pairs for ${n} points, the most there can be.`, "win");
    else if (!revealed) say("", null);
    if (typeof Track !== "undefined" && Track.state) Track.state({ n, points: pts.map((p) => ({ x: p.x, y: p.y })), pairs: c, target });
  }

  function reset(newN) {
    n = Core.clampN(newN === undefined ? nEl.value : newN);
    nEl.value = n; nOut.textContent = n;
    pts = Core.start(n); sel = 0; revealed = false;
    update();
  }

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  function move(i, w) {
    const lim = (v, m) => Math.max(-m, Math.min(m, v));
    pts[i] = Core.snap(pts, i, lim(w.x, 3.1), lim(w.y, 2.0), 0.14);
    revealed = false;
    update();
  }

  canvas.addEventListener("pointerdown", (e) => {
    const m = pick(e);
    let best = -1, bd = 26;
    pts.forEach((p, i) => { const q = toPx(p), d = Math.hypot(q.x - m.x, q.y - m.y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { drag = best; sel = best; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; update(); }
  });
  canvas.addEventListener("pointermove", (e) => { if (drag >= 0) { const m = pick(e); move(drag, toWorld(m.x, m.y)); } });
  const release = () => { drag = -1; canvas.style.cursor = "grab"; };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.01 : 0.05, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (e.key === " " || e.key === "Enter") { sel = (sel + 1) % n; update(); e.preventDefault(); }
    else if (d) { move(sel, { x: pts[sel].x + d[0], y: pts[sel].y + d[1] }); e.preventDefault(); }
  });

  nEl.addEventListener("input", () => reset());
  document.getElementById("resetBtn").addEventListener("click", () => reset());
  document.getElementById("showBtn").addEventListener("click", () => {
    pts = Core.witness(n); revealed = true; update();
    say(`This arrangement has ${Core.count(pts)} pairs. Can you find a different one?`, null);
  });
  window.addEventListener("themechange", draw);
  reset(n);
})();
