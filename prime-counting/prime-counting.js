"use strict";

/*
 * The page for Counting Primes: drawing and input only. One canvas, two
 * views: the counts themselves (pi(x), Gauss's x / ln x and Li(x)), and the
 * errors, with the square-root-sized band the Riemann Hypothesis allows.
 * The slider sets how far x goes, on a log scale from 10 to 1,000,000.
 */

(function () {
  const Core = PrimeCountingCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const eEl = document.getElementById("e");
  const xOut = document.getElementById("xOut");
  const viewCount = document.getElementById("viewCount");
  const viewError = document.getElementById("viewError");
  const gaussCheck = document.getElementById("gaussCheck");
  const readout = document.getElementById("readout");
  const resetBtn = document.getElementById("resetBtn");

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const maxX = () => Math.round(Math.pow(10, Number(eEl.value)));
  const nice = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en") : v.toFixed(1));

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function frame(lo, hi, X) {
    const W = canvas.width, H = canvas.height, L = 84, R = 14, T = 20, B = 42;
    const fx = (x) => L + ((x - 2) / Math.max(1, X - 2)) * (W - L - R);
    const fy = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    ctx.clearRect(0, 0, W, H);
    ctx.font = "22px system-ui, sans-serif";
    ctx.strokeStyle = css("--border-strong"); ctx.fillStyle = css("--muted"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
    ctx.textAlign = "right"; ctx.fillText(nice(hi), L - 8, T + 14); ctx.fillText(nice(lo), L - 8, H - B);
    if (lo < 0 && hi > 0) { ctx.beginPath(); ctx.moveTo(L, fy(0)); ctx.lineTo(W - R, fy(0)); ctx.stroke(); ctx.fillText("0", L - 8, fy(0) + 7); }
    ctx.textAlign = "right"; ctx.fillText("x = " + X.toLocaleString("en"), W - R, H - 10);
    return { fx, fy, W, H, L, R, T, B };
  }

  function path(points, fx, fy, key, color, width, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(fx(p.x), fy(p[key])) : ctx.moveTo(fx(p.x), fy(p[key]))));
    ctx.stroke(); ctx.setLineDash([]);
  }

  function draw() {
    const X = maxX();
    const pts = Core.series(X, 500);
    if (viewCount.checked) {
      const hi = Math.max(...pts.map((p) => Math.max(p.pi, p.li))) * 1.05;
      const f = frame(0, hi, X);
      // the true count is a staircase: draw it from the exact jumps when short, else the sampled line
      path(pts, f.fx, f.fy, "xOverLn", css("--bad"), 2.5);
      path(pts, f.fx, f.fy, "Li", css("--ink"), 2.5, [8, 6]);
      if (X <= 400) {
        ctx.strokeStyle = css("--accent"); ctx.lineWidth = 3; ctx.beginPath();
        let prev = Core.pi(2);
        ctx.moveTo(f.fx(2), f.fy(prev));
        for (let x = 3; x <= X; x++) { const c = Core.pi(x); ctx.lineTo(f.fx(x), f.fy(prev)); ctx.lineTo(f.fx(x), f.fy(c)); prev = c; }
        ctx.stroke();
      } else path(pts, f.fx, f.fy, "pi", css("--accent"), 3);
    } else {
      const withGauss = gaussCheck.checked;
      const big = Math.max(...pts.map((p) => Math.max(Math.abs(p.errorLi), p.x >= 2657 ? p.allowance : 0, withGauss ? Math.abs(p.errorGauss) : 0)), 1) * 1.1;
      const f = frame(-big, big, X);
      if (X >= 2657) {
        ctx.fillStyle = css("--highlight");
        ctx.beginPath();
        const band = pts.filter((p) => p.x >= 2657);
        band.forEach((p, i) => (i ? ctx.lineTo(f.fx(p.x), f.fy(p.allowance)) : ctx.moveTo(f.fx(p.x), f.fy(p.allowance))));
        [...band].reverse().forEach((p) => ctx.lineTo(f.fx(p.x), f.fy(-p.allowance)));
        ctx.closePath(); ctx.fill();
      }
      if (withGauss) path(pts, f.fx, f.fy, "errorGauss", css("--bad"), 2.5);
      path(pts, f.fx, f.fy, "errorLi", css("--accent"), 3);
    }
  }

  function update() {
    const X = maxX();
    xOut.textContent = X.toLocaleString("en");
    gaussCheck.disabled = viewCount.checked;
    const a = Core.at(X);
    readout.textContent = [
      `Primes up to ${X.toLocaleString("en")}: ${a.pi.toLocaleString("en")}`,
      `Gauss's x / ln x: ${nice(a.xOverLn)}  (off by ${nice(a.errorGauss)})`,
      `Li(x): ${nice(a.Li)}  (off by ${nice(a.pi - a.Li)})`,
      `Allowed error under the hypothesis: ${a.guaranteed ? "±" + nice(a.allowance) : "(a statement for x from 2657)"}`,
    ].join("\n");
    draw();
    say(viewCount.checked
      ? "Purple: the true count. Red: x / ln x. Dashed: Li(x)."
      : "Purple: how far the true count is from Li(x). The yellow band is the size the Riemann Hypothesis allows.");
    if (window.Track) window.Track.state({ x: X, view: viewCount.checked ? "count" : "error" });
  }

  resetBtn.addEventListener("click", () => { eEl.value = 3; viewCount.checked = true; gaussCheck.checked = false; update(); });
  [eEl, viewCount, viewError, gaussCheck].forEach((el) => el.addEventListener("input", update));
  viewCount.addEventListener("change", update);
  viewError.addEventListener("change", update);
  window.addEventListener("themechange", draw);
  update();
})();
