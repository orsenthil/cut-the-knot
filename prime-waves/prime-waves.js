"use strict";

/*
 * The page for Primes from the Zeros: drawing and input only. The staircase
 * is Chebyshev's psi(x) (it climbs by ln p at each prime power). The smooth
 * line is Riemann's formula with the first k pairs of zeros; "Flatten" plots
 * both minus x so the waves are easier to see. "Add zeros" plays k upwards.
 */

(function () {
  const Core = PrimeWavesCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const kEl = document.getElementById("k");
  const xEl = document.getElementById("xmax");
  const kOut = document.getElementById("kOut");
  const xOut = document.getElementById("xOut");
  const flatEl = document.getElementById("flat");
  const readout = document.getElementById("readout");
  const playBtn = document.getElementById("playBtn");
  const resetBtn = document.getElementById("resetBtn");

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  let timer = 0;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function draw() {
    const X = Core.clampX(xEl.value), K = Core.clampK(kEl.value), flat = flatEl.checked;
    const W = canvas.width, H = canvas.height, L = 76, R = 14, T = 20, B = 44;
    const base = (x) => (flat ? x : 0);
    const steps = Core.steps(X);
    const ser = Core.series(X, K, 900);
    // range of the picture
    let lo = Infinity, hi = -Infinity;
    const look = (v) => { if (v < lo) lo = v; if (v > hi) hi = v; };
    steps.forEach((s) => { look(s.from - base(s.x)); look(s.to - base(s.x)); });
    ser.forEach((p) => look(p.approx - base(p.x)));
    if (flat) { lo = Math.min(lo, -1); hi = Math.max(hi, 1); }
    else lo = 0;
    const pad = (hi - lo) * 0.06; lo -= flat ? pad : 0; hi += pad;
    const fx = (x) => L + ((x - 2) / (X - 2)) * (W - L - R);
    const fy = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    ctx.clearRect(0, 0, W, H);
    ctx.font = "22px system-ui, sans-serif"; ctx.fillStyle = css("--muted"); ctx.strokeStyle = css("--border-strong"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
    ctx.textAlign = "right"; ctx.fillText(hi.toFixed(0), L - 8, T + 14); ctx.fillText(lo.toFixed(0), L - 8, H - B);
    if (flat) { ctx.beginPath(); ctx.moveTo(L, fy(0)); ctx.lineTo(W - R, fy(0)); ctx.stroke(); ctx.fillText("0", L - 8, fy(0) + 7); }
    ctx.fillText("x = " + X, W - R, H - 10);
    // staircase
    ctx.strokeStyle = css("--accent"); ctx.lineWidth = 3.5; ctx.beginPath();
    let level = 0; ctx.moveTo(fx(2), fy(level - base(2)));
    const edges = steps.concat([{ x: X, from: steps.length ? steps[steps.length - 1].to : 0, to: null }]);
    edges.forEach((s) => {
      // run along the flat part up to the jump (for the flattened view this is a slanted line)
      ctx.lineTo(fx(s.x), fy(s.from - base(s.x)));
      if (s.to !== null) ctx.lineTo(fx(s.x), fy(s.to - base(s.x)));
    });
    ctx.stroke();
    // the formula
    ctx.strokeStyle = css("--good"); ctx.lineWidth = 2.5; ctx.beginPath();
    ser.forEach((p, i) => (i ? ctx.lineTo(fx(p.x), fy(p.approx - base(p.x))) : ctx.moveTo(fx(p.x), fy(p.approx - base(p.x)))));
    ctx.stroke();
  }

  function update() {
    const K = Core.clampK(kEl.value), X = Core.clampX(xEl.value);
    kOut.textContent = K;
    xOut.textContent = X;
    draw();
    readout.textContent = K === 0
      ? "No zeros yet: just the smooth curve x − ln 2π."
      : `${K} zero${K > 1 ? "s" : ""} added. The latest one is at t = ${Core.ZEROS[K - 1].toFixed(4)}: a wave with ${(Core.ZEROS[K - 1] / (2 * Math.PI)).toFixed(2)} cycles for each factor of e in x.`;
    say(K === 0 ? "The purple staircase is the true count of primes (weighted). The green line is a smooth guess." :
      K >= 100 ? "100 zeros: the green line now follows the staircase, jumping where the primes are." : "Green: Riemann's formula with these zeros.");
    if (window.Track) window.Track.state({ k: K, x: X, flat: flatEl.checked });
  }

  function stop() { clearInterval(timer); timer = 0; playBtn.textContent = "Add zeros"; }
  function play() {
    if (Number(kEl.value) >= Core.MAX_ZEROS) kEl.value = 0;
    playBtn.textContent = "Stop";
    timer = setInterval(() => {
      const k = Number(kEl.value) + 1;
      kEl.value = k; update();
      if (k >= Core.MAX_ZEROS) stop();
    }, 180);
  }

  playBtn.addEventListener("click", () => (timer ? stop() : play()));
  resetBtn.addEventListener("click", () => { stop(); kEl.value = 0; xEl.value = 50; flatEl.checked = false; update(); });
  kEl.addEventListener("input", () => { stop(); update(); });
  xEl.addEventListener("input", update);
  flatEl.addEventListener("change", update);
  window.addEventListener("themechange", draw);
  update();
})();
