"use strict";

/*
 * The page for Product of Simple Fractions: drawing and input only; the rules
 * are in product-of-fractions-core.js. Three squares, as in the applet: p/q on
 * the left as rows, r/s on the right as columns, and in the middle the two laid
 * over each other with the product pr/qs, the cells coloured both ways
 * outlined. Under each outer square, two number boxes set the fraction.
 */

(function () {
  const Core = ProductOfFractionsCore;
  const NS = "http://www.w3.org/2000/svg";
  const left = document.getElementById("left"), mid = document.getElementById("mid"), right = document.getElementById("right");
  const prodEl = document.getElementById("prod"), reducedEl = document.getElementById("reduced"), infoEl = document.getElementById("info");
  const inputs = { p: document.getElementById("pIn"), q: document.getElementById("qIn"), r: document.getElementById("rIn"), s: document.getElementById("sIn") };
  let state = Core.start({});

  const el = (name, attrs) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  /** Rows (q of them, p coloured) and/or columns (s, r coloured) in a 100 x 100 square. */
  function square(svg, rows, cols, outline) {
    svg.replaceChildren();
    svg.append(el("rect", { x: 0, y: 0, width: 100, height: 100, class: "paper" }));
    if (rows) svg.append(el("rect", { x: 0, y: 0, width: 100, height: (100 * state.p) / state.q, class: "rows" }));
    if (cols) svg.append(el("rect", { x: 0, y: 0, width: (100 * state.r) / state.s, height: 100, class: "cols" }));
    const lines = el("g", { class: "lines" });
    // Like the applet with big numbers, leave out the lines when they would merge.
    if (rows && state.q <= 40) for (let i = 1; i < state.q; i++) lines.append(el("line", { x1: 0, y1: (100 * i) / state.q, x2: 100, y2: (100 * i) / state.q }));
    if (cols && state.s <= 40) for (let j = 1; j < state.s; j++) lines.append(el("line", { x1: (100 * j) / state.s, y1: 0, x2: (100 * j) / state.s, y2: 100 }));
    svg.append(lines);
    if (outline) svg.append(el("rect", { x: 0, y: 0, width: (100 * state.r) / state.s, height: (100 * state.p) / state.q, class: "both" }));
    svg.append(el("rect", { x: 0, y: 0, width: 100, height: 100, class: "frame" }));
  }

  function render() {
    for (const k in inputs) if (Number(inputs[k].value) !== state[k]) inputs[k].value = String(state[k]);
    square(left, true, false, false);
    square(right, false, true, false);
    square(mid, true, true, true);
    const pr = Core.product(state), red = Core.reducedProduct(state);
    prodEl.querySelector(".num").textContent = pr.n;
    prodEl.querySelector(".den").textContent = pr.d;
    reducedEl.textContent = red.d !== pr.d ? `= ${red.n}/${red.d} in lowest terms` : "already in lowest terms";
    const { p, q, r, s } = state;
    infoEl.textContent = `${p}/${q} of ${r}/${s}: the rows cut each of the ${s} columns into ${q} cells, so the square has ${q} × ${s} = ${pr.d} cells, and ${p} × ${r} = ${pr.n} of them are coloured both ways.`;
    left.setAttribute("aria-label", `${q} rows, ${p} coloured: ${p}/${q}`);
    right.setAttribute("aria-label", `${s} columns, ${r} coloured: ${r}/${s}`);
    mid.setAttribute("aria-label", `Both together: ${pr.n} of ${pr.d} cells coloured both ways`);
    if (window.Track) window.Track.state(state);
  }

  for (const k in inputs) inputs[k].addEventListener("change", () => {
    const next = Core.set(state, k, Number(inputs[k].value));
    if (next) state = next;
    render();
  });
  document.getElementById("simplifyBtn").addEventListener("click", () => { state = Core.simplify(state); render(); });
  document.getElementById("newBtn").addEventListener("click", () => { state = Core.start({}); render(); });
  render();
})();
