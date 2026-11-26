"use strict";

/*
 * The page for Stock Price Paths: drawing and input only; the model is in
 * stock-price-paths-core.js. The top SVG draws up to 100 simulated price
 * paths over one year with two curves: the average, growing like e^(mu t),
 * and the typical (median) path, growing like e^((mu - sigma^2/2) t). The
 * lower SVG is a histogram of where the paths end, with the lognormal curve.
 */

(function () {
  const Core = StockPricePathsCore;
  const pathsSvg = document.getElementById("paths");
  const histSvg = document.getElementById("hist");
  const statsEl = document.getElementById("stats");
  const statusEl = document.getElementById("status");
  const muIn = document.getElementById("muIn"), sigmaIn = document.getElementById("sigmaIn"), countIn = document.getElementById("countIn");
  const muOut = document.getElementById("muOut"), sigmaOut = document.getElementById("sigmaOut");
  const NS = "http://www.w3.org/2000/svg";
  const W = 400, H = 220, L = 40, B = 20;

  let state = Core.start();
  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const pct = (v) => `${(Math.round(v * 1000) / 10).toString()}%`;

  function render() {
    const { mu, sigma, count, seed } = state;
    const ps = Core.paths(mu, sigma, count, seed);
    const st = Core.sampleStats(ps);
    const top = Math.max(Core.S0 * 1.5, st.ends[Math.floor(st.ends.length * 0.97)] || Core.S0 * 1.5, Core.mean(mu) * 1.2);
    const X = (i) => L + (i / Core.STEPS) * (W - L - 10), Y = (v) => H - B - (Math.min(v, top) / top) * (H - B - 10);

    pathsSvg.textContent = "";
    for (const v of [0, Core.S0, Math.round(top / 2 / 10) * 10 * (top > 220 ? 1 : 0)].filter((v, i) => i < 2 || v > 0)) {
      pathsSvg.appendChild(el("line", { x1: L, y1: Y(v), x2: W - 10, y2: Y(v) }, "grid"));
      pathsSvg.appendChild(el("text", { x: L - 4, y: Y(v) + 4 }, "axis", String(v)));
    }
    pathsSvg.appendChild(el("text", { x: W - 10, y: H - 4 }, "axis end", "1 year"));
    ps.slice(0, 100).forEach((p) => {
      pathsSvg.appendChild(el("polyline", { points: p.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ") }, "path"));
    });
    const curve = (f) => Array.from({ length: Core.STEPS + 1 }, (_, i) => `${X(i).toFixed(1)},${Y(f(i / Core.STEPS)).toFixed(1)}`).join(" ");
    pathsSvg.appendChild(el("polyline", { points: curve((t) => Core.S0 * Math.exp(mu * t)) }, "mean"));
    pathsSvg.appendChild(el("polyline", { points: curve((t) => Core.S0 * Math.exp((mu - sigma * sigma / 2) * t)) }, "median"));

    // histogram of end prices
    histSvg.textContent = "";
    const bins = 30, bw = top / bins, counts = new Array(bins).fill(0);
    for (const v of st.ends) if (v < top) counts[Math.floor(v / bw)]++; // prices off the chart are left out
    const dens = Array.from({ length: 200 }, (_, i) => { const x = ((i + 0.5) / 200) * top; return [x, Core.density(x, mu, sigma)]; });
    const peak = Math.max(...counts.map((c) => c / (st.ends.length * bw)), ...dens.map((d) => d[1]));
    const HX = (v) => L + (v / top) * (W - L - 10), HY = (d) => 150 - B - (d / peak) * 115;
    counts.forEach((c, i) => {
      const d = c / (st.ends.length * bw);
      if (c) histSvg.appendChild(el("rect", { x: HX(i * bw) + 0.5, y: HY(d), width: Math.max(0, HX(bw) - L - 1), height: 150 - B - HY(d) }, "bar"));
    });
    histSvg.appendChild(el("polyline", { points: dens.map(([x, d]) => `${HX(x).toFixed(1)},${HY(d).toFixed(1)}`).join(" ") }, "curve"));
    for (const [v, cls, name] of [[Core.mean(mu), "mean", "average"], [Core.median(mu, sigma), "median", "median"]]) {
      histSvg.appendChild(el("line", { x1: HX(v), y1: 10, x2: HX(v), y2: 150 - B }, cls));
      histSvg.appendChild(el("text", { x: HX(v) + (cls === "mean" ? 4 : -4), y: 20 }, `axis ${cls === "mean" ? "start" : "end"}`, name));
    }
    histSvg.appendChild(el("line", { x1: L, y1: 150 - B, x2: W - 10, y2: 150 - B }, "grid"));
    histSvg.appendChild(el("text", { x: HX(Core.S0), y: 146 }, "axis mid", String(Core.S0)));

    muIn.value = String(mu); sigmaIn.value = String(sigma); countIn.value = String(count);
    muOut.textContent = pct(mu); sigmaOut.textContent = pct(sigma);
    statsEl.innerHTML = `Theory: average <b>${Core.mean(mu).toFixed(2)}</b>, median <b>${Core.median(mu, sigma).toFixed(2)}</b>. ` +
      `These ${count} path${count === 1 ? "" : "s"}: average ${st.mean.toFixed(2)}, median ${st.median.toFixed(2)}.`;
    statusEl.textContent = state.runs
      ? `The median path grows at ${pct(mu - sigma * sigma / 2)} a year, not ${pct(mu)}: the volatility costs σ²/2 = ${pct(sigma * sigma / 2)}.`
      : "Press New paths to send more prices on their way.";
    if (state.runs) statusEl.classList.add("done"); else statusEl.classList.remove("done");
    if (window.Track) window.Track.state({ mu, sigma, count, seed, runs: state.runs });
  }

  muIn.addEventListener("input", () => { state = Core.set(state, "mu", muIn.value) || state; render(); });
  sigmaIn.addEventListener("input", () => { state = Core.set(state, "sigma", sigmaIn.value) || state; render(); });
  countIn.addEventListener("change", () => { state = Core.set(state, "count", countIn.value) || state; render(); });
  document.getElementById("newBtn").addEventListener("click", () => { state = Core.again(state); render(); });

  render();
})();
