"use strict";

/*
 * The page for the zeta function on the critical line: drawing and input
 * only. The top canvas is the complex plane: the curve t -> zeta(sigma + i t)
 * with the part walked so far in bold and the origin marked. The strip under
 * it plots the size |zeta| against t, so zeros show as dips to the floor.
 * "Next zero" jumps to the next t at which the curve hits the origin.
 */

(function () {
  const Core = ZetaCriticalLineCore;
  const plane = document.getElementById("plane");
  const pctx = plane.getContext("2d");
  const strip = document.getElementById("strip");
  const sctx = strip.getContext("2d");
  const statusEl = document.getElementById("status");
  const tEl = document.getElementById("t");
  const sigEl = document.getElementById("sigma");
  const tOut = document.getElementById("tOut");
  const sigOut = document.getElementById("sigOut");
  const readout = document.getElementById("readout");
  const nextBtn = document.getElementById("nextBtn");
  const walkBtn = document.getElementById("walkBtn");
  const resetBtn = document.getElementById("resetBtn");

  const zeros = Core.zeros(Core.MAX_T);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  let cache = { sigma: null, pts: null };
  let walking = false, raf = 0, lastTime = 0;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function points(sigma) {
    if (cache.sigma !== sigma) cache = { sigma, pts: Core.curve(sigma, Core.MAX_T, 1000) };
    return cache.pts;
  }

  function drawPlane(pts, t) {
    const W = plane.width, H = plane.height;
    const reach = Math.max(2, ...pts.map((p) => Math.max(Math.abs(p.re), Math.abs(p.im)))) * 1.08;
    const fx = (v) => W / 2 + (v / reach) * (W / 2 - 10);
    const fy = (v) => H / 2 - (v / reach) * (H / 2 - 10);
    pctx.clearRect(0, 0, W, H);
    pctx.strokeStyle = css("--border-strong"); pctx.lineWidth = 1;
    pctx.beginPath(); pctx.moveTo(0, H / 2); pctx.lineTo(W, H / 2); pctx.moveTo(W / 2, 0); pctx.lineTo(W / 2, H); pctx.stroke();
    const trace = (list, color, width) => {
      pctx.strokeStyle = color; pctx.lineWidth = width; pctx.beginPath();
      list.forEach((p, i) => (i ? pctx.lineTo(fx(p.re), fy(p.im)) : pctx.moveTo(fx(p.re), fy(p.im))));
      pctx.stroke();
    };
    trace(pts, css("--border-strong"), 2);
    const walked = pts.filter((p) => p.t <= t);
    if (walked.length > 1) trace(walked, css("--accent"), 3.5);
    // zeros on the line show up as the walk passing through the origin
    pctx.fillStyle = css("--ink"); pctx.beginPath(); pctx.arc(W / 2, H / 2, 6, 0, 2 * Math.PI); pctx.fill();
    const now = Core.at(Number(sigEl.value), t);
    pctx.fillStyle = css("--bad"); pctx.beginPath(); pctx.arc(fx(now.re), fy(now.im), 9, 0, 2 * Math.PI); pctx.fill();
  }

  function drawStrip(pts, t) {
    const W = strip.width, H = strip.height, L = 54, B = 34, T = 14, R = 10;
    const top = Math.max(2, ...pts.map((p) => p.abs)) * 1.05;
    const fx = (v) => L + (v / Core.MAX_T) * (W - L - R);
    const fy = (v) => T + (1 - v / top) * (H - T - B);
    sctx.clearRect(0, 0, W, H);
    sctx.font = "20px system-ui, sans-serif"; sctx.fillStyle = css("--muted"); sctx.strokeStyle = css("--border-strong"); sctx.lineWidth = 1;
    sctx.beginPath(); sctx.moveTo(L, T); sctx.lineTo(L, H - B); sctx.lineTo(W - R, H - B); sctx.stroke();
    sctx.textAlign = "right"; sctx.fillText(top.toFixed(1), L - 6, T + 8); sctx.fillText("0", L - 6, H - B);
    sctx.textAlign = "center"; sctx.fillText("t = 0", L + 14, H - 8); sctx.fillText("100", W - R - 14, H - 8);
    sctx.strokeStyle = css("--accent"); sctx.lineWidth = 2.5; sctx.beginPath();
    pts.forEach((p, i) => (i ? sctx.lineTo(fx(p.t), fy(p.abs)) : sctx.moveTo(fx(p.t), fy(p.abs))));
    sctx.stroke();
    if (Number(sigEl.value) === 0.5) {
      sctx.fillStyle = css("--good");
      zeros.forEach((z) => { sctx.beginPath(); sctx.arc(fx(z), fy(0), 5, 0, 2 * Math.PI); sctx.fill(); });
    }
    sctx.strokeStyle = css("--bad"); sctx.lineWidth = 2; sctx.beginPath(); sctx.moveTo(fx(t), T); sctx.lineTo(fx(t), H - B); sctx.stroke();
  }

  function update() {
    const sigma = Core.clampSigma(sigEl.value), t = Core.clampT(tEl.value);
    const pts = points(sigma);
    const a = Core.at(sigma, t);
    tOut.textContent = t.toFixed(2);
    sigOut.textContent = sigma.toFixed(2);
    readout.textContent = `ζ(${sigma.toFixed(2)} + ${t.toFixed(2)}i) = ${a.re.toFixed(4)} ${a.im < 0 ? "−" : "+"} ${Math.abs(a.im).toFixed(4)}i\nDistance from the origin: ${a.abs.toFixed(4)}`;
    drawPlane(pts, t);
    drawStrip(pts, t);
    const near = zeros.find((z) => Math.abs(z - t) < 0.06);
    if (sigma === 0.5 && near !== undefined && a.abs < 0.08) say(`A zero! At t = ${near.toFixed(4)} the curve passes through the origin.`);
    else if (sigma === 0.5) say(`Zeros so far: ${zeros.filter((z) => z <= t).length} of the ${zeros.length} below t = 100. All of them are on this line.`);
    else say(`Off the line (σ = ${sigma.toFixed(2)}): the curve never hits the origin. The closest it gets is ${Math.min(...pts.map((p) => p.abs)).toFixed(3)}.`);
    if (window.Track) window.Track.state({ sigma, t });
  }

  function nextZero() {
    sigEl.value = 0.5;
    const t = Number(tEl.value);
    const z = zeros.find((v) => v > t + 0.01);
    tEl.value = z === undefined ? zeros[0] : z;
    update();
  }

  function tick(now) {
    if (!walking) return;
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    let t = Number(tEl.value) + dt * 6;
    if (t >= Core.MAX_T) { t = Core.MAX_T; stopWalk(); }
    tEl.value = t;
    update();
    if (walking) raf = requestAnimationFrame(tick);
  }
  function startWalk() {
    if (Number(tEl.value) >= Core.MAX_T) tEl.value = 0;
    walking = true; walkBtn.textContent = "Stop"; lastTime = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function stopWalk() {
    walking = false; walkBtn.textContent = "Walk"; cancelAnimationFrame(raf);
  }

  nextBtn.addEventListener("click", () => { stopWalk(); nextZero(); });
  walkBtn.addEventListener("click", () => (walking ? stopWalk() : startWalk()));
  resetBtn.addEventListener("click", () => { stopWalk(); sigEl.value = 0.5; tEl.value = 0; update(); });
  tEl.addEventListener("input", () => { stopWalk(); update(); });
  sigEl.addEventListener("input", update);
  window.addEventListener("themechange", update);
  update();
})();
