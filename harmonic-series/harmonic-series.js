"use strict";

/*
 * The page for the Harmonic Series: drawing and input only. The chart puts
 * log10(n) along the bottom, so the sum H(n) shows up as a nearly straight
 * climbing line (it grows like ln n), above Oresme's staircase 1 + k/2.
 */

(function () {
  const Core = HarmonicSeriesCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const eEl = document.getElementById("e");
  const nOut = document.getElementById("nOut");
  const readout = document.getElementById("readout");
  const resetBtn = document.getElementById("resetBtn");

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const currentN = () => Core.clampN(Math.round(Math.pow(10, Number(eEl.value))));

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function draw(n) {
    const pts = Core.series(n, 400);
    const W = canvas.width, H = canvas.height, L = 70, R = 14, T = 20, B = 46;
    const span = Math.max(Math.log10(n), 0.3);
    const top = Math.max(2, pts[pts.length - 1].sum * 1.08);
    const fx = (v) => L + (Math.log10(v) / span) * (W - L - R);
    const fy = (v) => T + (1 - v / top) * (H - T - B);
    ctx.clearRect(0, 0, W, H);
    ctx.font = "22px system-ui, sans-serif"; ctx.fillStyle = css("--muted"); ctx.strokeStyle = css("--border-strong"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
    ctx.textAlign = "right"; ctx.fillText(top.toFixed(1), L - 8, T + 14); ctx.fillText("0", L - 8, H - B);
    ctx.textAlign = "center"; ctx.fillText("n = 1", L + 22, H - 12); ctx.textAlign = "right"; ctx.fillText("n = " + n.toLocaleString("en"), W - R, H - 12);
    // Oresme's staircase: 1 + k/2 from n = 2^k on
    ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath();
    let first = true;
    for (let k = 0; 2 ** k <= n; k++) {
      const x0 = fx(2 ** k), x1 = fx(Math.min(n, 2 ** (k + 1))), y = fy(1 + k / 2);
      if (first) { ctx.moveTo(x0, y); first = false; } else ctx.lineTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = css("--accent"); ctx.lineWidth = 3.5; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(fx(p.n), fy(p.sum)) : ctx.moveTo(fx(p.n), fy(p.sum))));
    ctx.stroke();
  }

  function update() {
    const n = currentN();
    const a = Core.at(n);
    nOut.textContent = n.toLocaleString("en");
    const fmt = (v) => v.toFixed(5);
    readout.textContent = [
      `1 + 1/2 + … + 1/${n.toLocaleString("en")} = ${fmt(a.sum)}`,
      `ln n + γ = ${fmt(a.approx)}  (the gap is ${a.gap.toExponential(2)})`,
      `Oresme: ${a.blocks} whole block${a.blocks === 1 ? "" : "s"} of at least ½, so at least ${a.oresmeBound}`,
      `Terms needed to pass 1, 2, 3, 4, 5, 6: ${a.toPass.slice(0, 6).map((p) => p.terms.toLocaleString("en")).join(", ")}`,
    ].join("\n");
    draw(n);
    say(n < 1000000 ? "The sum keeps climbing, but you need ten times the terms for each further 2.3 or so." : "A million terms, and the sum has only reached 14.39.");
    if (window.Track) window.Track.state({ n });
  }

  resetBtn.addEventListener("click", () => { eEl.value = 2; update(); });
  eEl.addEventListener("input", update);
  window.addEventListener("themechange", update);
  update();
})();
