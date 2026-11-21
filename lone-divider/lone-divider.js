"use strict";

/* Browser UI: mark acceptable pieces and let the matching assign them. */
(() => {
  const C = LoneDividerCore;
  const gridEl = document.getElementById("grid");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const nInput = document.getElementById("nInput");
  const solveBtn = document.getElementById("solveBtn");
  const randomBtn = document.getElementById("randomBtn");
  const resetBtn = document.getElementById("resetBtn");
  const solveCheck = document.getElementById("solveCheck");
  let state = null;
  let assignments = null;
  let solving = false;

  function render() {
    gridEl.replaceChildren();
    const r = C.analyze(state);
    const shown = solving && assignments ? assignments.assignments : {};

    const head = document.createElement("div");
    head.className = "grid-row header";
    const blank = document.createElement("span");
    blank.textContent = "Chooser / Piece";
    head.appendChild(blank);
    for (let p = 0; p < state.n; p++) {
      const h = document.createElement("span");
      h.textContent = `P${p + 1}`;
      head.appendChild(h);
    }
    gridEl.appendChild(head);

    state.table.forEach((row, c) => {
      const line = document.createElement("div");
      line.className = "grid-row";
      const label = document.createElement("span");
      label.className = "row-label";
      label.textContent = `Chooser ${c + 1}`;
      line.appendChild(label);
      row.forEach((accepted, p) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "pref-cell " + (accepted ? "yes" : "no");
        if (shown[c] === p) cell.classList.add("assigned");
        cell.textContent = shown[c] === p ? "✓" : accepted ? "✓" : "×";
        cell.setAttribute("aria-label", `Chooser ${c + 1}, piece ${p + 1}: ${accepted ? "acceptable" : "not acceptable"}. Click to toggle.`);
        cell.addEventListener("click", () => {
          state = C.toggle(state, c, p);
          assignments = solving ? C.solve(state) : null;
          render();
          const again = gridEl.querySelectorAll(".grid-row")[c + 1]?.querySelectorAll("button")[p];
          if (again) again.focus();
        });
        line.appendChild(cell);
      });
      gridEl.appendChild(line);
    });

    const dividerRow = document.createElement("div");
    dividerRow.className = "grid-row divider-row";
    const label = document.createElement("span");
    label.className = "row-label";
    label.textContent = "Divider gets";
    dividerRow.appendChild(label);
    const got = solving && assignments ? assignments.dividerPieces : [];
    for (let p = 0; p < state.n; p++) {
      const cell = document.createElement("span");
      cell.className = "pref-cell divider" + (got.includes(p) ? " assigned" : "");
      cell.textContent = got.includes(p) ? `P${p + 1}` : "·";
      dividerRow.appendChild(cell);
    }
    gridEl.appendChild(dividerRow);

    nInput.value = String(state.n);
    readout.textContent = `${state.n} players · ${state.n - 1} choosers · ${state.n} pieces`;
    if (solving && assignments) {
      status.textContent = assignments.solved
        ? `Solved: ${Object.keys(assignments.assignments).length} choosers got acceptable pieces, the divider keeps ${assignments.dividerPieces.length}.`
        : assignments.note;
      status.className = assignments.solved ? "win" : "done";
    } else {
      status.textContent = "Mark pieces each chooser would accept, then press Solve.";
      status.className = "done";
    }
    if (window.Track) window.Track.state({
      n: state.n, table: state.table.map((row) => row.slice()),
      solving, solved: assignments ? assignments.solved : false,
      assignments: assignments ? { ...assignments.assignments } : {},
    });
  }

  nInput.addEventListener("input", () => {
    state = C.setN(state, Number(nInput.value));
    assignments = null;
    render();
  });
  solveCheck.addEventListener("change", () => {
    solving = solveCheck.checked;
    if (solving) assignments = C.solve(state);
    render();
  });
  solveBtn.addEventListener("click", () => {
    solving = true;
    solveCheck.checked = true;
    assignments = C.solve(state);
    render();
  });
  randomBtn.addEventListener("click", () => { state = C.randomize(state); assignments = null; render(); });
  resetBtn.addEventListener("click", () => { state = C.start({ n: state.n }); assignments = null; render(); });

  state = C.start();
  render();
})();
