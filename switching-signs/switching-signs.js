"use strict";

/*
 * The page for Signs in a Matrix: drawing and input only; the rules are in
 * switching-signs-core.js. A table shows the numbers, each row's sum at its
 * right and each column's sum below it. The sums are buttons: pressing one
 * reverses the signs in its row or column. Negative sums are marked.
 */

(function () {
  const Core = SwitchingSignsCore;
  const gridEl = document.getElementById("grid");
  const statusEl = document.getElementById("status");
  const rowsIn = document.getElementById("rowsIn");
  const colsIn = document.getElementById("colsIn");

  let state = Core.start();
  let refocus = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function sumButton(v, label, data) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `sum${v < 0 ? " neg" : ""}`;
    b.textContent = String(v);
    b.setAttribute("aria-label", `${label}: sum ${v}. Press to reverse its signs`);
    Object.assign(b.dataset, data);
    return b;
  }

  function render() {
    const rs = Core.rowSums(state), cs = Core.colSums(state);
    const t = document.createElement("table");
    state.nums.forEach((row, i) => {
      const tr = t.insertRow();
      row.forEach((x) => { const td = tr.insertCell(); td.textContent = String(x); td.className = x < 0 ? "num minus" : "num"; });
      const td = tr.insertCell(); td.className = "rsum"; td.appendChild(sumButton(rs[i], `Row ${i + 1}`, { row: i }));
    });
    const tr = t.insertRow();
    cs.forEach((v, j) => { const td = tr.insertCell(); td.className = "csum"; td.appendChild(sumButton(v, `Column ${j + 1}`, { col: j })); });
    const corner = tr.insertCell(); corner.className = "total"; corner.textContent = `Σ ${Core.total(state)}`;
    gridEl.replaceChildren(t);
    if (refocus) { const el = gridEl.querySelector(refocus); if (el) el.focus(); refocus = null; }
    const neg = Core.negativeLines(state).length;
    if (Core.solved(state)) say(`Every row and column sum is at least 0, after ${state.flips} flip${state.flips === 1 ? "" : "s"}.`, "win");
    else say(`${neg} negative sum${neg === 1 ? "" : "s"} left. Total of all the numbers: ${Core.total(state)}.`);
    if (window.Track) window.Track.state({ nums: state.nums, flips: state.flips });
  }

  gridEl.addEventListener("click", (e) => {
    const b = e.target.closest("button.sum");
    if (!b) return;
    const m = b.dataset.row !== undefined ? { row: Number(b.dataset.row) } : { col: Number(b.dataset.col) };
    state = Core.flip(state, m);
    refocus = b.dataset.row !== undefined ? `[data-row="${b.dataset.row}"]` : `[data-col="${b.dataset.col}"]`;
    render();
  });
  function reset() {
    const clamp = (v, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== "" ? Math.max(1, Math.min(15, n)) : d; };
    const r = clamp(rowsIn.value, 4), c = clamp(colsIn.value, 5);
    rowsIn.value = String(r); colsIn.value = String(c);
    state = Core.start({ rows: r, cols: c });
    render();
  }
  document.getElementById("resetBtn").addEventListener("click", reset);
  [rowsIn, colsIn].forEach((el) => el.addEventListener("change", reset));

  render();
})();
