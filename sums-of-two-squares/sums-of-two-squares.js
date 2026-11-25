"use strict";

/*
 * The page for Sums of Two Squares: drawing and input only. The chart shows
 * the grid (when it is not too dense), the circle of radius sqrt(n), and a dot
 * at every grid point on it.
 */

(function () {
  const Core = TwoSquaresCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const nEl = document.getElementById("n");
  const nOut = document.getElementById("nOut");
  const W = canvas.width, H = canvas.height;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const records = Core.records(Core.MAX_N).map(([n]) => n);
  const currentN = () => Core.clampN(nEl.value);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function draw(n) {
    const r = Math.sqrt(n), half = Math.ceil(r) + 1, s = Math.min(W, H) / (2 * half + 0.5), cx = W / 2, cy = H / 2;
    ctx.clearRect(0, 0, W, H);
    if (half <= 26) {
      ctx.fillStyle = css("--border-strong");
      for (let a = -half; a <= half; a++) for (let b = -half; b <= half; b++) { ctx.beginPath(); ctx.arc(cx + a * s, cy - b * s, Math.max(1.5, s / 9), 0, 2 * Math.PI); ctx.fill(); }
    }
    ctx.strokeStyle = css("--muted"); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    ctx.strokeStyle = css("--accent"); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r * s, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = css("--bad"); ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2;
    for (const [a, b] of Core.points(n)) { ctx.beginPath(); ctx.arc(cx + a * s, cy - b * s, Math.max(4, Math.min(9, s / 2.5)), 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); }
  }

  const power = (p, e) => (e > 1 ? `${p}^${e}` : `${p}`);

  function update() {
    const n = currentN(), r = Core.r2Brute(n), w = Core.ways(n);
    nOut.textContent = n;
    const f = Core.factor(n).map(([p, e]) => power(p, e)).join(" · ");
    const wtxt = w.length ? w.map(([a, b]) => `${a}² + ${b}²`).join("  =  ") : "none";
    readout.textContent = `${n} = ${f}\n${r} dots on the circle (Jacobi: 4 (d1 − d3) = ${Core.r2Formula(n)})\nways: ${wtxt}`;
    draw(n);
    const rec = records.includes(n);
    if (rec) say(`${n} is a record: ${r} dots, more than any smaller number.`, "done");
    else say(r === 0 ? `${n} is not a sum of two squares at all.` : "", null);
    if (typeof Track !== "undefined" && Track.state) Track.state({ n, r2: r, ways: w });
  }

  nEl.addEventListener("input", update);
  document.getElementById("nextBtn").addEventListener("click", () => {
    const n = currentN(), next = records.find((x) => x > n) || records[0];
    nEl.value = next; update();
  });
  document.getElementById("resetBtn").addEventListener("click", () => { nEl.value = 25; update(); });
  window.addEventListener("themechange", update);
  update();
})();
