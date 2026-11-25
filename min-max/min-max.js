"use strict";

/*
 * The page for The Minimax Principle: drawing and input only. A grid of buttons
 * (the numbers), a blue column and row (row minimums, column maximums) and the
 * two red numbers. The left half of a number lowers it, the right half raises
 * it; the arrow keys do the same. The rules are in min-max-core.js.
 */

(function () {
  const Core = MinMaxCore;
  const grid = document.getElementById("grid");
  const statusEl = document.getElementById("status");
  const el = (id) => document.getElementById(id);
  const rowsEl = el("rows"), colsEl = el("cols"), maxEl = el("max");

  let state = Core.start();
  let focus = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function cell(cls, text, row, col) {
    const d = document.createElement("div");
    d.className = "c " + cls; d.textContent = text;
    d.style.gridRow = row + 1; d.style.gridColumn = col + 1;
    grid.appendChild(d);
    return d;
  }

  function render() {
    const { rows, cols } = state, a = Core.analyse(state);
    rowsEl.value = rows; colsEl.value = cols; maxEl.value = state.max;
    el("rowsOut").textContent = rows; el("colsOut").textContent = cols; el("maxOut").textContent = state.max;
    grid.textContent = "";
    grid.style.gridTemplateColumns = `repeat(${cols + 2}, auto)`;
    for (let i = 0; i < rows; i++) for (let k = 0; k < cols; k++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "c" + (a.saddles.some(([si, sk]) => si === i && sk === k) ? " saddle" : "");
      b.textContent = state.values[i][k];
      b.style.gridRow = i + 1; b.style.gridColumn = k + 1;
      b.setAttribute("aria-label", `Row ${i + 1}, column ${k + 1}: ${state.values[i][k]}${a.saddles.some(([si, sk]) => si === i && sk === k) ? ", a saddle point" : ""}. Left half lowers, right half raises.`);
      b.dataset.i = i; b.dataset.k = k;
      grid.appendChild(b);
      if (focus && focus[0] === i && focus[1] === k) b.dataset.refocus = "1";
    }
    a.rowMins.forEach((v, i) => cell("blue", v, i, cols));
    a.colMaxes.forEach((v, k) => cell("blue", v, rows, k));
    cell("red", a.minMax, rows, cols + 1).setAttribute("title", "MinMax: the smallest of the column maximums");
    cell("red", a.maxMin, rows + 1, cols).setAttribute("title", "MaxMin: the largest of the row minimums");
    const f = grid.querySelector('[data-refocus="1"]'); if (f) f.focus();
    if (a.equal) say(`MaxMin = MinMax = ${a.minMax}. The framed entr${a.saddles.length === 1 ? "y is" : "ies are"} the largest in its column and the smallest in its row.`, "done");
    else say(`The red numbers differ: MaxMin = ${a.maxMin} is less than MinMax = ${a.minMax}. They never go the other way.`, "done");
    if (window.Track) window.Track.state({ rows, cols, max: state.max, values: state.values, maxMin: a.maxMin, minMax: a.minMax });
  }

  grid.addEventListener("click", (e) => {
    const b = e.target.closest("button.c"); if (!b) return;
    const r = b.getBoundingClientRect(), delta = e.clientX - r.left < r.width / 2 ? -1 : 1;
    const i = Number(b.dataset.i), k = Number(b.dataset.k);
    // a keyboard "click" (no pointer) lands in the middle: treat as raise
    const s = Core.change(state, i, k, e.detail === 0 ? 1 : delta);
    if (s) { state = s; focus = [i, k]; render(); }
  });
  grid.addEventListener("keydown", (e) => {
    const b = e.target.closest("button.c"); if (!b) return;
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = Number(b.dataset.i), k = Number(b.dataset.k), s = Core.change(state, i, k, d);
    if (s) { state = s; focus = [i, k]; render(); }
  });

  const rebuild = () => { state = Core.resize(state, { rows: rowsEl.value, cols: colsEl.value, max: maxEl.value }); focus = null; render(); };
  [rowsEl, colsEl, maxEl].forEach((x) => x.addEventListener("input", rebuild));
  el("resetBtn").addEventListener("click", () => { state = Core.refresh(state); focus = null; render(); });
  render();
})();
