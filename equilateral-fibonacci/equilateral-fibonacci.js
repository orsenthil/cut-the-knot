"use strict";

/*
 * The page for Fibonacci Numbers in an Equilateral Triangle: drawing and input only;
 * the construction is in equilateral-fibonacci-core.js. An SVG of the triangle of side N
 * with its lattice lines and the coloured shapes, and a list of what each shape is.
 */

(function () {
  const Core = EquilateralFibonacciCore;
  const svg = document.getElementById("tri");
  const listEl = document.getElementById("list");
  const nIn = document.getElementById("nIn");
  const statusEl = document.getElementById("status");
  const SVGNS = "http://www.w3.org/2000/svg";
  const W = 420, H = 380, PAD = 14;

  let state = Core.start({});

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }
  const el = (name, attrs) => { const e = document.createElementNS(SVGNS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  function render() {
    svg.textContent = "";
    const n = state.n;
    const unit = (W - 2 * PAD) / n;
    const hh = (unit * n * Math.sqrt(3)) / 2;
    const ox = W / 2, oy = (H - hh) / 2;
    const P = (i, j) => { const [x, y] = Core.plane(i, j); return [ox + x * unit, oy + y * unit * 1]; };
    // lattice lines
    const lat = el("g", { class: "lattice" });
    for (let k = 0; k <= n; k++) {
      let [x1, y1] = P(k, 0), [x2, y2] = P(k, k); lat.appendChild(el("line", { x1, y1, x2, y2 }));
      [x1, y1] = P(k, 0); [x2, y2] = P(n, n - k); lat.appendChild(el("line", { x1, y1, x2, y2 })); // lines of constant "place - row"
      [x1, y1] = P(k, k); [x2, y2] = P(n, k); lat.appendChild(el("line", { x1, y1, x2, y2 }));
    }
    svg.appendChild(lat);
    const shapes = Core.shapes(n);
    shapes.forEach((sh, k) => {
      const pts = sh.points.map(([i, j]) => P(i, j).map((v) => v.toFixed(2)).join(",")).join(" ");
      svg.appendChild(el("polygon", { points: pts, class: "shape s" + (k % 2) }));
    });
    const [ax, ay] = P(0, 0), [bx, by] = P(n, 0), [cx, cy] = P(n, n);
    svg.appendChild(el("polygon", { points: `${ax},${ay} ${bx},${by} ${cx},${cy}`, class: "outline" }));
    listEl.textContent = "";
    for (const sh of shapes) {
      const li = document.createElement("li");
      li.textContent = sh.kind === "triangle" ? `Triangle of side 1 (rows ${sh.rows[0]} to ${sh.rows[1]})` : `${sh.side === "left" ? "Left" : "Right"} trapezoid: top ${sh.top}, sides ${sh.leg}, base ${sh.base} (rows ${sh.rows[0]} to ${sh.rows[1]})`;
      listEl.appendChild(li);
    }
    nIn.value = String(n);
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next; render(); say(note); return true;
  }

  nIn.addEventListener("change", () => { if (!apply({ type: "n", value: nIn.value }, `Lattice of side ${Core.move(state, { type: "n", value: nIn.value }).n}.`)) { say("N is a whole number from 5 to 145."); nIn.value = String(state.n); } else say(`Lattice of side ${state.n}: ${Core.shapes(state.n).length} shapes coloured.`); });
  nIn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); if (!apply({ type: "step", dir: e.key === "ArrowUp" ? 1 : -1 }, "")) say("N runs from 5 to 145."); else say(`Lattice of side ${state.n}: ${Core.shapes(state.n).length} shapes coloured.`); }
  });
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.move(state, { type: "reset" }); render(); say("Back to N = 20."); });
  window.addEventListener("themechange", render);

  render();
})();
