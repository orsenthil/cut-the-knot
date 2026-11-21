"use strict";

/* Browser UI: a Latin square you can disturb and repair. */
(() => {
  const C = LatinSquaresCore;
  const gridEl = document.getElementById("grid");
  const status = document.getElementById("status");
  const sizeInput = document.getElementById("sizeInput");
  const symCheck = document.getElementById("symCheck");
  const restoreBtn = document.getElementById("restoreBtn");
  let state = null;
  let selected = null;

  function render() {
    gridEl.replaceChildren();
    const r = C.analyze(state);
    gridEl.style.setProperty("--n", String(state.size));

    state.grid.forEach((row, i) => {
      const line = document.createElement("div");
      line.className = "grid-row";
      const controls = document.createElement("span");
      controls.className = "row-controls";
      const left = document.createElement("button");
      left.type = "button";
      left.textContent = "◀";
      left.setAttribute("aria-label", `Cycle row ${i + 1} left`);
      left.addEventListener("click", () => { state = C.cycleRow(state, i, -1); selected = null; render(); });
      const right = document.createElement("button");
      right.type = "button";
      right.textContent = "▶";
      right.setAttribute("aria-label", `Cycle row ${i + 1} right`);
      right.addEventListener("click", () => { state = C.cycleRow(state, i, 1); selected = null; render(); });
      controls.append(left, right);
      line.appendChild(controls);

      row.forEach((value, j) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell" + (selected === `${i},${j}` ? " selected" : "") + (!r.latin ? " bad" : "");
        cell.textContent = String(value);
        cell.setAttribute("aria-label", `Row ${i + 1}, column ${j + 1}: ${value}. Click two cells in a row to swap them.`);
        cell.addEventListener("click", () => {
          if (selected === null) selected = `${i},${j}`;
          else if (selected === `${i},${j}`) selected = null;
          else {
            const [sr, sc] = selected.split(",").map(Number);
            if (sr === i) state = C.swapCells(state, i, sc, j);
            selected = null;
          }
          render();
        });
        line.appendChild(cell);
      });
      gridEl.appendChild(line);
    });

    sizeInput.value = String(state.size);
    symCheck.checked = state.symmetric;
    status.textContent = !r.latin
      ? "Not a Latin square: some row or column repeats a number."
      : state.symmetric && !r.symmetric
        ? "Latin, but not symmetric about the main diagonal."
        : r.solved
          ? state.symmetric ? "Solved: every row and column has each number once, and the grid is symmetric." : "Solved: every row and column has each number once."
          : "Latin square found.";
    status.className = r.solved ? "win" : "done";
    if (window.Track) window.Track.state({
      size: state.size, symmetric: state.symmetric, grid: state.grid.map((row) => row.slice()),
      latin: r.latin, symmetricGrid: r.symmetric, solved: r.solved, moves: state.moves,
    });
  }

  sizeInput.addEventListener("input", () => { state = C.setSize(state, Number(sizeInput.value)); selected = null; render(); });
  symCheck.addEventListener("change", () => { state = C.setSymmetric(state, symCheck.checked); render(); });
  restoreBtn.addEventListener("click", () => { state = C.restore(state); selected = null; render(); });

  state = C.start();
  render();
})();
