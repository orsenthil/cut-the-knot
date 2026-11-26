"use strict";

/*
 * The page for From Payoff to Heat Equation: drawing and input only; the
 * solutions are in payoff-heat-equation-core.js. The top SVG plots the call's
 * value against the stock price with the given time left: the payoff (dashed),
 * the Black-Scholes formula (line), and dots from solving the heat equation
 * by brute force and changing variables back. The lower SVG shows the heat
 * kernel: the bell curve the payoff is spread with, for a stock at 100.
 */

(function () {
  const Core = PayoffHeatEquationCore;
  const top = document.getElementById("value");
  const low = document.getElementById("kernel");
  const statusEl = document.getElementById("status");
  const factsEl = document.getElementById("facts");
  const tauIn = document.getElementById("tauIn"), sigmaIn = document.getElementById("sigmaIn"), rIn = document.getElementById("rIn");
  const tauOut = document.getElementById("tauOut"), sigmaOut = document.getElementById("sigmaOut"), rOut = document.getElementById("rOut");
  const playBtn = document.getElementById("playBtn");
  const NS = "http://www.w3.org/2000/svg";

  let state = Core.start();
  let timer = null;
  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function render() {
    const { K, tau, sigma, r } = state;
    // value against S
    const W = 400, H = 230, L = 40, B = 22, S0 = 50, S1 = 150, VMAX = 60;
    const X = (s) => L + ((s - S0) / (S1 - S0)) * (W - L - 10), Y = (v) => H - B - (Math.min(v, VMAX) / VMAX) * (H - B - 10);
    top.textContent = "";
    for (const v of [0, 20, 40, 60]) { top.appendChild(el("line", { x1: L, y1: Y(v), x2: W - 10, y2: Y(v) }, "grid")); top.appendChild(el("text", { x: L - 4, y: Y(v) + 4 }, "axis", `$${v}`)); }
    for (const s of [50, 100, 150]) top.appendChild(el("text", { x: X(s), y: H - 5 }, "axis mid", `$${s}`));
    top.appendChild(el("polyline", { points: `${X(S0)},${Y(0)} ${X(K)},${Y(0)} ${X(S1)},${Y(S1 - K)}` }, "payoff"));
    const pts = [];
    for (let s = S0; s <= S1; s += 1) pts.push(`${X(s).toFixed(1)},${Y(Core.call(s, K, r, sigma, tau)).toFixed(1)}`);
    top.appendChild(el("polyline", { points: pts.join(" ") }, "formula"));
    if (tau > 0) {
      const sol = Core.heatSolve(K, sigma, tau);
      for (let s = S0 + 5; s <= S1; s += 10) top.appendChild(el("circle", { cx: X(s), cy: Y(Core.valueFromHeat(sol, s, r, sigma, tau)), r: 4 }, "heat"));
    }

    // the heat kernel for a stock at 100: where ln S_T lands, risk-neutrally
    const v = sigma * Math.sqrt(Math.max(tau, 1e-6)), m = Math.log(100) + (r - sigma * sigma / 2) * tau;
    const H2 = 130, lo = Math.log(40), hi = Math.log(250);
    const KX = (x) => L + ((x - lo) / (hi - lo)) * (W - L - 10);
    const pdf = (x) => Math.exp(-((x - m) ** 2) / (2 * v * v)) / (v * Math.sqrt(2 * Math.PI));
    const peak = pdf(m);
    const KY = (d) => H2 - B - (d / peak) * (H2 - B - 12);
    low.textContent = "";
    const xs = Array.from({ length: 241 }, (_, i) => lo + ((hi - lo) * i) / 240);
    const above = xs.filter((x) => x >= Math.log(K));
    if (tau > 0) {
      low.appendChild(el("polygon", { points: [`${KX(Math.log(K))},${KY(0)}`, ...above.map((x) => `${KX(x).toFixed(1)},${KY(pdf(x)).toFixed(1)}`), `${KX(hi)},${KY(0)}`].join(" ") }, "shade"));
      low.appendChild(el("polyline", { points: xs.map((x) => `${KX(x).toFixed(1)},${KY(pdf(x)).toFixed(1)}`).join(" ") }, "bell"));
    }
    low.appendChild(el("line", { x1: L, y1: KY(0), x2: W - 10, y2: KY(0) }, "grid"));
    low.appendChild(el("line", { x1: KX(Math.log(K)), y1: 8, x2: KX(Math.log(K)), y2: KY(0) }, "strike"));
    for (const s of [50, 100, 200]) low.appendChild(el("text", { x: KX(Math.log(s)), y: H2 - 5 }, "axis mid", `$${s}`));

    tauIn.value = String(tau); sigmaIn.value = String(sigma); rIn.value = String(r);
    tauOut.textContent = `${tau.toFixed(2)} yr`; sigmaOut.textContent = `${Math.round(sigma * 100)}%`; rOut.textContent = `${(r * 100).toFixed(1)}%`;
    const d1 = tau > 0 ? (Math.log(100 / K) + (r + sigma * sigma / 2) * tau) / v : Infinity, d2 = d1 - v;
    factsEl.innerHTML = tau > 0
      ? `At $100 with ${tau.toFixed(2)} years left: the call is worth <b>$${Core.call(100, K, r, sigma, tau).toFixed(2)}</b>. The shaded part of the bell curve is the chance it ends above the strike, N(d<sub>2</sub>) = <b>${Core.N(d2).toFixed(3)}</b>.`
      : "No time left: the value is just the payoff, with its sharp corner at the strike.";
    statusEl.textContent = state.seen ? "The longer the time left, the more the corner is smoothed away, like heat spreading from a sharp edge." : "Slide the time left (or press Play) and watch the corner smooth out.";
    statusEl.classList.toggle("done", state.seen);
    if (window.Track) window.Track.state({ tau, sigma, r, seen: state.seen });
  }

  const on = (key, v) => { state = Core.set(state, key, v) || state; render(); };
  tauIn.addEventListener("input", () => on("tau", tauIn.value));
  sigmaIn.addEventListener("input", () => on("sigma", sigmaIn.value));
  rIn.addEventListener("input", () => on("r", rIn.value));
  playBtn.addEventListener("click", () => {
    if (timer) { clearInterval(timer); timer = null; playBtn.textContent = "Play"; return; }
    on("tau", 0);
    playBtn.textContent = "Stop";
    timer = setInterval(() => {
      if (state.tau >= 2) { clearInterval(timer); timer = null; playBtn.textContent = "Play"; return; }
      on("tau", Math.round((state.tau + 0.05) * 100) / 100);
    }, 80);
  });
  window.addEventListener("themechange", render);

  render();
})();
