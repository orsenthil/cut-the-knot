"use strict";

(() => {
  const S = TableToZeroGameCore;
  const gridEl = document.getElementById("grid");
  const status = document.getElementById("status");
  const nxInput = document.getElementById("nxInput");
  const nyInput = document.getElementById("nyInput");
  const speedUp = document.getElementById("speedUp");
  const resetBtn = document.getElementById("resetBtn");
  const undoBtn = document.getElementById("undoBtn");

  let state = S.start({
    nx: Number(nxInput.value),
    ny: Number(nyInput.value),
    speedUp: speedUp.checked,
  });

  function setStatus(text, cls) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (cls) status.classList.add(cls);
  }

  function render() {
    if (window.Track) {
      window.Track.state({
        nx: state.nx,
        ny: state.ny,
        grid: S.copyGrid(state.grid),
        speedUp: state.speedUp,
        over: state.over,
        historyLength: state.history.length,
      });
    }

    gridEl.style.setProperty("--nx", String(state.nx));
    gridEl.style.setProperty("--ny", String(state.ny));
    gridEl.replaceChildren();

    // Column subtract buttons (top)
    const top = document.createElement("div");
    top.className = "col-actions";
    top.style.gridColumn = `2 / span ${state.nx}`;
    for (let c = 0; c < state.nx; c++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "axis";
      b.textContent = "−1";
      b.setAttribute("aria-label", `Subtract from column ${c + 1}`);
      b.disabled = state.over;
      b.addEventListener("click", () => apply(S.subtractColumn(state, c)));
      top.appendChild(b);
    }
    gridEl.appendChild(top);

    for (let r = 0; r < state.ny; r++) {
      const rowBtn = document.createElement("button");
      rowBtn.type = "button";
      rowBtn.className = "axis";
      rowBtn.textContent = "×2";
      rowBtn.setAttribute("aria-label", `Double row ${r + 1}`);
      rowBtn.disabled = state.over;
      rowBtn.addEventListener("click", () => apply(S.doubleRow(state, r)));
      gridEl.appendChild(rowBtn);

      for (let c = 0; c < state.nx; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.textContent = String(state.grid[r][c]);
        cell.setAttribute("aria-label", `Row ${r + 1} column ${c + 1}: ${state.grid[r][c]}`);
        gridEl.appendChild(cell);
      }
    }

    // Bottom column labels (same actions)
    const bot = document.createElement("div");
    bot.className = "col-actions";
    bot.style.gridColumn = `2 / span ${state.nx}`;
    for (let c = 0; c < state.nx; c++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "axis";
      b.textContent = "−1";
      b.setAttribute("aria-label", `Subtract from column ${c + 1}`);
      b.disabled = state.over;
      b.addEventListener("click", () => apply(S.subtractColumn(state, c)));
      bot.appendChild(b);
    }
    gridEl.appendChild(bot);

    undoBtn.disabled = state.history.length === 0;
    speedUp.checked = state.speedUp;

    if (state.over) setStatus("All zeros — done!", "win");
    else setStatus("Double a row (×2) or subtract from a column (−1).");
  }

  function apply(next) {
    if (!next) return;
    state = next;
    render();
  }

  function fresh() {
    state = S.start({
      nx: Number(nxInput.value),
      ny: Number(nyInput.value),
      speedUp: speedUp.checked,
    });
    render();
  }

  nxInput.addEventListener("change", fresh);
  nyInput.addEventListener("change", fresh);
  speedUp.addEventListener("change", () => {
    state = { ...state, speedUp: speedUp.checked };
    render();
  });
  resetBtn.addEventListener("click", fresh);
  undoBtn.addEventListener("click", () => {
    state = S.undo(state);
    render();
  });

  window.addEventListener("themechange", render);
  render();
})();
