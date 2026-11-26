"use strict";

/*
 * The page for The Black-Scholes Formula: drawing and input only; the
 * formula is in black-scholes-formula-core.js. Sliders set the stock,
 * strike, interest, volatility and time. The page shows the call and put,
 * the formula's two pieces, the Greeks, a graph of the call against the
 * stock price with its tangent (the delta), and a Monte Carlo check.
 */

(function () {
  const Core = BlackScholesFormulaCore;
  const statusEl = document.getElementById("status");
  const graph = document.getElementById("graph");
  const pricesEl = document.getElementById("prices");
  const piecesEl = document.getElementById("pieces");
  const greeksEl = document.getElementById("greeks");
  const mcEl = document.getElementById("mc");
  const NS = "http://www.w3.org/2000/svg";
  const KEYS = ["S", "K", "r", "sigma", "T", "mu"];
  const ins = Object.fromEntries(KEYS.map((k) => [k, document.getElementById(`${k}In`)]));
  const outs = Object.fromEntries(KEYS.map((k) => [k, document.getElementById(`${k}Out`)]));
  const show = { S: (v) => `$${v}`, K: (v) => `$${v}`, r: (v) => `${(v * 100).toFixed(1)}%`, sigma: (v) => `${Math.round(v * 100)}%`, T: (v) => `${v} yr`, mu: (v) => `${Math.round(v * 100)}%` };

  let state = Core.start();
  let mc = null;
  const money = (v) => `$${v.toFixed(2)}`;
  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function drawGraph(p) {
    const W = 400, H = 200, L = 40, B = 22, S0 = 40, S1 = 160, VMAX = 70;
    const X = (s) => L + ((s - S0) / (S1 - S0)) * (W - L - 10), Y = (v) => H - B - (Math.max(0, Math.min(v, VMAX)) / VMAX) * (H - B - 10);
    graph.textContent = "";
    for (const v of [0, 35, 70]) { graph.appendChild(el("line", { x1: L, y1: Y(v), x2: W - 10, y2: Y(v) }, "grid")); graph.appendChild(el("text", { x: L - 4, y: Y(v) + 4 }, "axis", `$${v}`)); }
    for (const s of [40, 100, 160]) graph.appendChild(el("text", { x: X(s), y: H - 5 }, "axis mid", `$${s}`));
    graph.appendChild(el("polyline", { points: `${X(S0)},${Y(0)} ${X(state.K)},${Y(0)} ${X(S1)},${Y(S1 - state.K)}` }, "payoff"));
    const pts = [];
    for (let s = S0; s <= S1; s++) pts.push(`${X(s).toFixed(1)},${Y(Core.price({ ...state, S: s }).call).toFixed(1)}`);
    graph.appendChild(el("polyline", { points: pts.join(" ") }, "curve"));
    const d = p.greeks.callDelta, s0 = state.S, c0 = p.call;
    graph.appendChild(el("line", { x1: X(s0 - 25), y1: Y(c0 - 25 * d), x2: X(s0 + 25), y2: Y(c0 + 25 * d) }, "tangent"));
    graph.appendChild(el("circle", { cx: X(s0), cy: Y(c0), r: 5 }, "here"));
  }

  function render() {
    const p = Core.price(state), g = p.greeks, disc = Math.exp(-state.r * state.T);
    KEYS.forEach((k) => { ins[k].value = String(state[k]); outs[k].textContent = show[k](state[k]); });
    pricesEl.innerHTML = `Call <b>${money(p.call)}</b> &nbsp;&nbsp; Put <b>${money(p.put)}</b>`;
    piecesEl.innerHTML = `d<sub>1</sub> = ${p.d1.toFixed(3)}, d<sub>2</sub> = ${p.d2.toFixed(3)}<br>` +
      `S&middot;N(d<sub>1</sub>) = ${state.S} &times; ${p.Nd1.toFixed(3)} = ${money(state.S * p.Nd1)} (the shares in the hedge)<br>` +
      `K e<sup>&minus;rT</sup>&middot;N(d<sub>2</sub>) = ${money(state.K * disc)} &times; ${p.Nd2.toFixed(3)} = ${money(state.K * disc * p.Nd2)} (the strike, times the chance it is paid)<br>` +
      `Parity: C &minus; P = ${money(p.call - p.put)} = S &minus; K e<sup>&minus;rT</sup> = ${money(state.S - state.K * disc)}`;
    greeksEl.innerHTML = `<tr><th></th><th>call</th><th>put</th></tr>` +
      [["Delta (per $1 of stock)", g.callDelta, g.putDelta, 3], ["Gamma (change of delta)", g.gamma, g.gamma, 4], ["Vega (per 1% volatility)", g.vega / 100, g.vega / 100, 3], ["Theta (per day)", g.callTheta / 365, g.putTheta / 365, 3], ["Rho (per 1% interest)", g.callRho / 100, g.putRho / 100, 3]]
        .map(([n, a, b, k]) => `<tr><th>${n}</th><td>${a.toFixed(k)}</td><td>${b.toFixed(k)}</td></tr>`).join("");
    drawGraph(p);
    if (mc) {
      mcEl.innerHTML = `${mc.rn.n.toLocaleString("en")} simulated end prices, payoffs averaged and discounted:<br>` +
        `grown at the bank's rate ${show.r(state.r)}: <b>${money(mc.rn.mean)}</b> &plusmn; ${mc.rn.band.toFixed(2)} &nbsp;(formula ${money(p.call)})<br>` +
        `grown at the stock's own rate ${show.mu(state.mu)}: <b>${money(mc.real.mean)}</b> &plusmn; ${mc.real.band.toFixed(2)}`;
    } else mcEl.textContent = "Press Simulate to price the call by brute force.";
    statusEl.textContent = state.runs ? "The risk-neutral simulation lands on the formula; the stock's own growth rate gives the wrong price." : "Move the sliders and watch the price, the hedge and the chance of exercise.";
    statusEl.classList.toggle("done", state.runs > 0);
    if (window.Track) window.Track.state({ S: state.S, K: state.K, r: state.r, sigma: state.sigma, T: state.T, mu: state.mu, runs: state.runs });
  }

  KEYS.forEach((k) => ins[k].addEventListener("input", () => { state = Core.set(state, k, ins[k].value) || state; mc = null; render(); }));
  document.getElementById("simBtn").addEventListener("click", () => {
    state = Core.simulate(state);
    mc = { rn: Core.monteCarlo(state, state.r, 20000, state.seed), real: Core.monteCarlo(state, state.mu, 20000, state.seed) };
    render();
  });
  window.addEventListener("themechange", render);

  render();
})();
