"use strict";

/*
 * The page for Euler's Product: drawing and input only. A canvas plots the
 * running sum (over every whole number) and the running product (over the
 * primes) against n, with the true value of zeta(s) as a dashed line. The
 * numbers under it say the same in digits.
 */

(function () {
  const Core = EulerProductCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const sEl = document.getElementById("s");
  const nEl = document.getElementById("n");
  const sOut = document.getElementById("sOut");
  const nOut = document.getElementById("nOut");
  const readout = document.getElementById("readout");
  const resetBtn = document.getElementById("resetBtn");

  let last = null;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const fmt = (v) => (v >= 1000 ? v.toFixed(1) : v.toFixed(6));

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function draw() {
    const a = last;
    const W = canvas.width, H = canvas.height, L = 70, R = 14, T = 20, B = 40;
    ctx.clearRect(0, 0, W, H);
    ctx.font = "22px system-ui, sans-serif";
    const top = Math.max(a.sums[a.n - 1], a.prods[a.n - 1], a.limit || 0) * 1.05;
    const bottom = 1;
    const X = (k) => L + ((k - 1) / Math.max(1, a.n - 1)) * (W - L - R);
    const Y = (v) => T + (1 - (v - bottom) / (top - bottom)) * (H - T - B);
    ctx.strokeStyle = css("--border-strong"); ctx.fillStyle = css("--muted"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
    ctx.textAlign = "right"; ctx.fillText(top.toFixed(2), L - 6, T + 10); ctx.fillText("1", L - 6, H - B);
    ctx.textAlign = "center"; ctx.fillText("n = " + a.n, W - R - 30, H - 10); ctx.fillText("1", L, H - 10);
    if (a.limit) {
      ctx.setLineDash([6, 5]); ctx.strokeStyle = css("--ink"); ctx.beginPath();
      ctx.moveTo(L, Y(a.limit)); ctx.lineTo(W - R, Y(a.limit)); ctx.stroke(); ctx.setLineDash([]);
      ctx.textAlign = "left"; ctx.fillStyle = css("--ink"); ctx.fillText("ζ(s)", L + 6, Y(a.limit) - 6);
    }
    const line = (arr, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
      arr.forEach((v, i) => (i ? ctx.lineTo(X(i + 1), Y(v)) : ctx.moveTo(X(1), Y(v))));
      ctx.stroke();
    };
    line(a.sums, css("--accent"));
    line(a.prods, css("--good"));
  }

  function update() {
    last = Core.analyze({ s: sEl.value, n: nEl.value });
    sOut.textContent = last.s.toFixed(2);
    nOut.textContent = last.n;
    const lines = [
      `Sum of 1/k^s over k = 1 … ${last.n}: ${fmt(last.sum)}`,
      `Product over the ${last.primeCount} primes up to ${last.n}: ${fmt(last.product)}`,
      last.limit ? `ζ(${last.s.toFixed(2)}) = ${fmt(last.limit)}` : "At s = 1 neither one stops growing.",
    ];
    readout.textContent = lines.join("\n");
    draw();
    if (last.limit) say(`Both are heading for ζ(${last.s.toFixed(2)}) = ${fmt(last.limit)}.`);
    else say("At s = 1 the sum is the harmonic series: it grows forever, and the product over the primes grows with it.", "done");
    if (window.Track) window.Track.state({ s: last.s, n: last.n });
  }

  resetBtn.addEventListener("click", () => { sEl.value = 2; nEl.value = 30; update(); });
  sEl.addEventListener("input", update);
  nEl.addEventListener("input", update);
  window.addEventListener("themechange", draw);
  update();
})();
