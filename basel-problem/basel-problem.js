"use strict";

/*
 * The page for the Basel Problem: drawing and input only. The chart has
 * log10(k) along the bottom and the sum up the side, clipped at 2.2: the
 * purple line of squares flattens against pi^2/6, while the grey harmonic
 * line (power 1) shoots off the top of the picture.
 */

(function () {
  const Core = BaselProblemCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const eEl = document.getElementById("e");
  const nOut = document.getElementById("nOut");
  const readout = document.getElementById("readout");
  const resetBtn = document.getElementById("resetBtn");

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const currentN = () => Core.clampN(Math.round(Math.pow(10, Number(eEl.value))));
  const TOP = 2.2;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function draw(n) {
    const pts = Core.series(n, 400);
    const W = canvas.width, H = canvas.height, L = 70, R = 14, T = 20, B = 46;
    const span = Math.max(Math.log10(n), 0.3);
    const fx = (k) => L + (Math.log10(k) / span) * (W - L - R);
    const fy = (v) => T + (1 - Math.min(v, TOP) / TOP) * (H - T - B);
    ctx.clearRect(0, 0, W, H);
    ctx.font = "22px system-ui, sans-serif"; ctx.fillStyle = css("--muted"); ctx.strokeStyle = css("--border-strong"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
    ctx.textAlign = "right"; ctx.fillText("2", L - 8, fy(2) + 7); ctx.fillText("0", L - 8, H - B);
    ctx.textAlign = "center"; ctx.fillText("k = 1", L + 22, H - 12); ctx.textAlign = "right"; ctx.fillText("k = " + n.toLocaleString("en"), W - R, H - 12);
    // harmonic sum (power 1), clipped by the top of the picture
    let h = 0, hk = 1; ctx.strokeStyle = css("--muted"); ctx.lineWidth = 2.5; ctx.beginPath();
    pts.forEach((p, i) => { while (hk <= p.k) { h += 1 / hk; hk++; } i ? ctx.lineTo(fx(p.k), fy(h)) : ctx.moveTo(fx(p.k), fy(h)); });
    ctx.stroke();
    ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = css("--bad"); ctx.beginPath();
    ctx.moveTo(L, fy(2)); ctx.lineTo(W - R, fy(2)); ctx.stroke();
    ctx.strokeStyle = css("--ink"); ctx.beginPath(); ctx.moveTo(L, fy(Core.TARGET)); ctx.lineTo(W - R, fy(Core.TARGET)); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = css("--ink"); ctx.textAlign = "left"; ctx.fillText("π²/6", L + 8, fy(Core.TARGET) + 26);
    ctx.strokeStyle = css("--accent"); ctx.lineWidth = 3.5; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(fx(p.k), fy(p.sum)) : ctx.moveTo(fx(p.k), fy(p.sum))));
    ctx.stroke();
  }

  function update() {
    const n = currentN();
    const a = Core.at(n);
    nOut.textContent = n.toLocaleString("en");
    const f = (v) => v.toFixed(7);
    readout.textContent = [
      `1 + 1/4 + … + 1/${n.toLocaleString("en")}² = ${f(a.sum)}`,
      `π²/6 = ${f(a.target)}   error ${a.error.toExponential(3)}`,
      `n × error = ${a.errorTimesN.toFixed(4)}   (about 1: the tail is about 1/n)`,
      `Plus 1/(n + ½): ${f(a.corrected)}   error ${a.correctedError.toExponential(2)}`,
    ].join("\n");
    draw(n);
    say("The purple sum flattens out at π²/6. The grey line, with power 1 instead of 2, keeps climbing.");
    if (window.Track) window.Track.state({ n });
  }

  resetBtn.addEventListener("click", () => { eEl.value = 1; update(); });
  eEl.addEventListener("input", update);
  window.addEventListener("themechange", update);
  update();
})();
