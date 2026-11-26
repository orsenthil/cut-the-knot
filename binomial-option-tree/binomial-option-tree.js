"use strict";

/*
 * The page for Binomial Option Tree: drawing and input only; the pricing is
 * in binomial-option-tree-core.js. The top SVG is the tree: each node shows
 * the stock price and, below it, the option's value there, worked back from
 * the payoffs on the right. The lower SVG plots the tree's price for 1 to
 * 100 steps against the Black-Scholes price.
 */

(function () {
  const Core = BinomialOptionTreeCore;
  const treeSvg = document.getElementById("tree");
  const convSvg = document.getElementById("conv");
  const factsEl = document.getElementById("facts");
  const statusEl = document.getElementById("status");
  const ins = { n: document.getElementById("nIn"), K: document.getElementById("kIn"), sigma: document.getElementById("sigmaIn"), r: document.getElementById("rIn") };
  const outs = { K: document.getElementById("kOut"), sigma: document.getElementById("sigmaOut"), r: document.getElementById("rOut") };
  const typeIn = document.getElementById("typeIn"), amIn = document.getElementById("amIn");
  const NS = "http://www.w3.org/2000/svg";

  let state = Core.start();
  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function drawTree() {
    const n = state.n, t = Core.tree(state, n), W = 420, H = 300;
    treeSvg.textContent = "";
    const X = (i) => 40 + (i * (W - 80)) / n, Y = (i, j) => H / 2 - (j - i / 2) * Math.min(56, (H - 40) / n);
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) for (const k of [j, j + 1]) treeSvg.appendChild(el("line", { x1: X(i), y1: Y(i, j), x2: X(i + 1), y2: Y(i + 1, k) }, "edge"));
    const small = n > 4;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= i; j++) {
      const x = X(i), y = Y(i, j), v = t.value[i][j];
      treeSvg.appendChild(el("circle", { cx: x, cy: y, r: small ? 5 : 8 }, `node${i === n ? (v > 0 ? " pays" : " zero") : ""}`));
      if (!small || i === 0 || i === n) {
        treeSvg.appendChild(el("text", { x, y: y - (small ? 8 : 12) }, "stock", t.stock[i][j].toFixed(0)));
        treeSvg.appendChild(el("text", { x, y: y + (small ? 15 : 22) }, "value", v.toFixed(2)));
      }
    }
    return t;
  }

  function drawConvergence(bs) {
    const W = 420, H = 150, L = 46, B = 20, M = 100;
    const ps = Array.from({ length: M }, (_, k) => Core.price(state, k + 1));
    const lo = Math.min(bs, ...ps.slice(2)), hi = Math.max(bs, ...ps.slice(2)), pad = (hi - lo) * 0.15 + 0.01;
    const X = (k) => L + (k / (M - 1)) * (W - L - 10), Y = (v) => H - B - ((Math.max(lo - pad, Math.min(hi + pad, v)) - (lo - pad)) / (hi - lo + 2 * pad)) * (H - B - 10);
    convSvg.textContent = "";
    convSvg.appendChild(el("line", { x1: L, y1: Y(bs), x2: W - 10, y2: Y(bs) }, "bs"));
    convSvg.appendChild(el("polyline", { points: ps.map((p, k) => `${X(k).toFixed(1)},${Y(p).toFixed(1)}`).join(" ") }, "trace"));
    convSvg.appendChild(el("circle", { cx: X(state.n - 1), cy: Y(ps[state.n - 1]), r: 5 }, "here"));
    convSvg.appendChild(el("text", { x: L - 4, y: Y(bs) + 4 }, "axis", bs.toFixed(2)));
    convSvg.appendChild(el("text", { x: L, y: H - 4 }, "axis start", "1 step"));
    convSvg.appendChild(el("text", { x: W - 10, y: H - 4 }, "axis", "100 steps"));
  }

  function render() {
    const t = drawTree();
    const euro = { ...state, american: false }, bs = Core.blackScholes(euro);
    drawConvergence(bs);
    ins.n.value = String(state.n); ins.K.value = String(state.K); ins.sigma.value = String(state.sigma); ins.r.value = String(state.r);
    outs.K.textContent = `$${state.K}`; outs.sigma.textContent = `${Math.round(state.sigma * 100)}%`; outs.r.textContent = `${(state.r * 100).toFixed(1)}%`;
    typeIn.value = state.type; amIn.checked = state.american; amIn.disabled = state.type !== "put";
    const name = `${state.american ? "American" : "European"} ${state.type}`;
    factsEl.innerHTML = `${state.n}-step tree: up ×${t.u.toFixed(4)}, down ×${t.d.toFixed(4)}, risk-neutral chance of up ${t.q.toFixed(4)}.<br>` +
      `Tree price of the ${name}: <b>$${t.value[0][0].toFixed(4)}</b>. Black&ndash;Scholes (European): <b>$${bs.toFixed(4)}</b>. Shares to hedge one option today: <b>${t.delta[0][0].toFixed(3)}</b>.`;
    const p100 = Core.price(state, 100).toFixed(4);
    statusEl.textContent = !state.explored ? "Add steps and watch the tree's price close in on the formula."
      : state.american ? `With 100 steps the tree gives $${p100}. An American put has no closed formula: trees like this are how it is priced.`
      : `With 100 steps the tree gives $${p100}; the formula is the limit of infinitely many tiny steps.`;
    statusEl.classList.toggle("done", state.explored);
    if (window.Track) window.Track.state({ n: state.n, K: state.K, sigma: state.sigma, r: state.r, type: state.type, american: state.american, explored: state.explored });
  }

  const on = (key, v) => { state = Core.set(state, key, v) || state; render(); };
  ins.n.addEventListener("change", () => on("n", ins.n.value));
  ins.K.addEventListener("input", () => on("K", ins.K.value));
  ins.sigma.addEventListener("input", () => on("sigma", ins.sigma.value));
  ins.r.addEventListener("input", () => on("r", ins.r.value));
  typeIn.addEventListener("change", () => on("type", typeIn.value));
  amIn.addEventListener("change", () => on("american", amIn.checked));

  render();
})();
