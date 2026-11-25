"use strict";

/*
 * The page for Counting Triangles: drawing and input only. One SVG: the grid of
 * the square, the green triangles (the solid ones, the ones that fade as the
 * slider moves to "Square" and the ones that come in), and the bold lines of
 * the triangle. The rules and the counts are in counting-triangles-core.js.
 */

(function () {
  const Core = TrianglesCore;
  const svg = document.getElementById("board");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn"), aIn = document.getElementById("aIn");
  const NS = "http://www.w3.org/2000/svg";
  const SIZE = 400, PAD = 20;

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    svg.appendChild(e);
    return e;
  }

  function render() {
    svg.textContent = "";
    const n = state.n, side = (SIZE - 2 * PAD) / n;
    const X = (v) => (PAD + v * side).toFixed(2), Y = (v) => (PAD + v * side).toFixed(2);
    const g = Core.triangles(n), s = Core.strengths(state);
    const poly = (t, opacity) => el("polygon", { points: t.map(([x, y]) => `${X(x)},${Y(y)}`).join(" "), class: "tri", "fill-opacity": opacity });
    g.high.forEach((t) => poly(t, s.high));
    g.low.forEach((t) => poly(t, s.low));
    g.full.forEach((t) => poly(t, 1));
    // the weak grid over the whole square, with the diagonals of every small square above the main diagonal
    for (let i = 0; i <= n; i++) {
      el("line", { x1: X(i), y1: Y(0), x2: X(i), y2: Y(n), class: "grid" });
      el("line", { x1: X(0), y1: Y(i), x2: X(n), y2: Y(i), class: "grid" });
    }
    for (let i = 1; i < n; i++) el("line", { x1: X(i), y1: Y(0), x2: X(n), y2: Y(n - i), class: "grid" });
    // the bold lines of the triangle under the diagonal, and the diagonal itself
    for (let i = 0; i < n; i++) {
      el("line", { x1: X(i), y1: Y(i), x2: X(i), y2: Y(n), class: "main" });
      el("line", { x1: X(0), y1: Y(i + 1), x2: X(i + 1), y2: Y(i + 1), class: "main" });
      el("line", { x1: X(0), y1: Y(i), x2: X(n - i), y2: Y(n), class: "main" });
    }
    nIn.value = String(n);
    aIn.value = String(state.alpha);
    const t = Core.totals(n), c = Core.counts(n);
    const solid = c.full, fading = c.low, coming = c.high;
    readout.textContent = `N = ${n}: ${solid} triangles always stay, ${fading} fade out toward "Square" and ${coming} come in. At either end: ${t.squares} = ${n}² green triangles.`;
    if (state.alpha === Core.ALPHA_MAX) say(`The triangle: ${n * (n + 1) / 2} + ${n * (n - 1) / 2} = ${n * n} small triangles.`, "done");
    else if (state.alpha === 0) say(`The square: one green triangle in each of the ${n * n} small squares.`, "done");
    else say("");
    if (window.Track) window.Track.state(state);
  }

  function set(next) { if (next) { state = next; render(); } }
  nIn.addEventListener("input", () => set(Core.setN(state, nIn.value)));
  aIn.addEventListener("input", () => set(Core.setAlpha(state, aIn.value)));
  render();
})();
