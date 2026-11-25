"use strict";

/*
 * The page for Grid Spacing Dial: drawing and input only. The grid fills the
 * canvas whatever its size. All unit pairs are drawn as thin lines (for the
 * larger grids that is a lot, so they are faint), and the pairs of the chosen
 * "focus" dot are drawn bold. Winning means setting the dial to the best c2.
 */

(function () {
  const Core = GridDialCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const cEl = document.getElementById("c");
  const cOut = document.getElementById("cOut");
  const kEl = document.getElementById("k");
  const W = canvas.width, H = canvas.height;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  let k = Core.clampK(kEl.value), focus = [Math.floor(k / 2), Math.floor(k / 2)], bestCache = {}, won = false;
  const best = () => bestCache[k] || (bestCache[k] = Core.best(k));

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const cell = () => Math.min(W, H) / (k + 0.5);
  const at = (x, y) => ({ x: W / 2 + (x - (k - 1) / 2) * cell(), y: H / 2 + (y - (k - 1) / 2) * cell() });

  function draw(c2) {
    ctx.clearRect(0, 0, W, H);
    const s = cell();
    // every unit pair, faint
    const vecs = Core.vectors(k, c2).filter(([a, b]) => a > 0 || (a === 0 && b > 0));
    ctx.strokeStyle = css("--border-strong"); ctx.lineWidth = 1;
    if (vecs.length && Core.count(k, c2) <= 3000) {
      ctx.beginPath();
      for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) for (const [a, b] of vecs) {
        const u = x + a, v = y + b;
        if (u < 0 || v < 0 || u >= k || v >= k) continue;
        const p = at(x, y), q = at(u, v); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 3; ctx.strokeStyle = css("--accent");
    const f = at(focus[0], focus[1]);
    for (const [u, v] of Core.neighbours(k, c2, focus[0], focus[1])) { const q = at(u, v); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    ctx.fillStyle = css("--muted");
    for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) { const p = at(x, y); ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, s / 8), 0, 2 * Math.PI); ctx.fill(); }
    ctx.fillStyle = css("--accent"); ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(5, s / 4), 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  }

  function update() {
    const c2 = Core.clampC2(k, cEl.value), n = Core.count(k, c2), b = best();
    cOut.textContent = c2;
    const nb = Core.neighbours(k, c2, focus[0], focus[1]).length;
    readout.textContent = `${k} × ${k} grid at spacing 1/√${c2} = ${(1 / Math.sqrt(c2)).toFixed(3)}\n` +
      `${n} pairs exactly one step apart · the big dot has ${nb}\n` +
      `most known for this grid: ${b.count} (c² = ${b.c2})`;
    draw(c2);
    if (n === b.count) { won = true; say(`That is the best dial for a ${k} × ${k} grid: ${n} pairs. Try another grid size.`, "win"); }
    else say(n === 0 ? "No pairs at all at this setting." : "", null);
    if (typeof Track !== "undefined" && Track.state) Track.state({ k, c2, count: n, best: b });
  }

  function setRange() { cEl.max = Core.maxC2(k); }
  cEl.addEventListener("input", update);
  kEl.addEventListener("change", () => { k = Core.clampK(kEl.value); focus = [Math.floor(k / 2), Math.floor(k / 2)]; setRange(); cEl.value = Math.min(cEl.value, cEl.max); update(); });
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect(), mx = (e.clientX - r.left) * (W / r.width), my = (e.clientY - r.top) * (H / r.height), s = cell();
    focus = [Math.max(0, Math.min(k - 1, Math.round((mx - W / 2) / s + (k - 1) / 2))), Math.max(0, Math.min(k - 1, Math.round((my - H / 2) / s + (k - 1) / 2)))];
    update();
  });
  document.getElementById("resetBtn").addEventListener("click", () => { cEl.value = 1; focus = [Math.floor(k / 2), Math.floor(k / 2)]; update(); });
  document.getElementById("showBtn").addEventListener("click", () => { cEl.value = best().c2; update(); });
  window.addEventListener("themechange", update);
  setRange();
  update();
})();
