"use strict";

/*
 * The page for Koch's Snowflake: drawing and input only. One SVG with the circle
 * through the triangle's corners and the outline for the chosen N, and a table
 * of the numbers for every N. The geometry and the formulas are in
 * kochs-snowflake-core.js.
 */

(function () {
  const Core = KochCore;
  const svg = document.getElementById("board");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn"), nOut = document.getElementById("nOut");
  const tbody = document.querySelector("#tbl tbody");
  const NS = "http://www.w3.org/2000/svg";

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const frac = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(3));

  function buildTable() {
    tbody.textContent = "";
    for (let n = Core.MIN_N; n <= Core.MAX_N; n++) {
      const tr = document.createElement("tr");
      tr.dataset.n = String(n);
      const cells = [String(n), Core.segments(n).toLocaleString("en-US"), n === 1 ? "1" : `1/${Math.pow(3, n - 1).toLocaleString("en-US")}`, frac(Core.perimeter(n)), Core.areaRatio(n).toFixed(4)];
      cells.forEach((t) => { const td = document.createElement("td"); td.textContent = t; tr.appendChild(td); });
      tbody.appendChild(tr);
    }
  }

  function render() {
    svg.textContent = "";
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", 0); c.setAttribute("cy", 0); c.setAttribute("r", 1); c.setAttribute("class", "circle");
    svg.appendChild(c);
    // y points up in the core and down on the screen
    const pts = Core.points(state.n);
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("points", pts.map((p) => `${p.x.toFixed(5)},${(-p.y).toFixed(5)}`).join(" "));
    poly.setAttribute("class", "flake");
    svg.appendChild(poly);
    const n = state.n;
    nIn.value = String(n);
    nOut.textContent = String(n);
    readout.textContent = `N = ${n}: ${Core.segments(n).toLocaleString("en-US")} segments, each ${n === 1 ? "a whole side" : `1/${Math.pow(3, n - 1).toLocaleString("en-US")} of a side`}. Outline: ${Core.perimeter(n).toFixed(3)} sides long. Area: ${Core.areaRatio(n).toFixed(4)} times the triangle's.`;
    tbody.querySelectorAll("tr").forEach((tr) => tr.classList.toggle("now", Number(tr.dataset.n) === n));
    if (n === Core.MAX_N) say(`The outline is ${Core.perimeter(n).toFixed(2)} sides long and still growing by a third each round, but the area, ${Core.areaRatio(n).toFixed(4)} times the triangle's, is already close to its limit 8/5 = 1.6.`, "done");
    else say("");
    if (window.Track) window.Track.state(state);
  }

  nIn.addEventListener("input", () => { const next = Core.setN(state, nIn.value); if (next) { state = next; render(); } });
  buildTable();
  render();
})();
