"use strict";

(function () {
  const Core = RowColumnSwapCore;
  const gridEl = document.getElementById("grid");
  const rowArrows = document.getElementById("rowArrows");
  const colArrows = document.getElementById("colArrows");
  const targetWrap = document.getElementById("targetWrap");
  const targetGrid = document.getElementById("targetGrid");
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const backBtn = document.getElementById("backBtn");
  const newBtn = document.getElementById("newBtn");

  let state = null;

  for (let n = Core.MIN_N; n <= Core.MAX_N; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    nInput.appendChild(o);
  }
  nInput.value = String(Core.DEFAULT_N);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const n = state.n;
    gridEl.style.gridTemplateColumns = "repeat(" + n + ", 2.4rem)";
    gridEl.innerHTML = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.textContent = String(state.grid[r][c] + 1);
        gridEl.appendChild(cell);
      }
    }

    rowArrows.innerHTML = "";
    for (let r = 0; r < n; r++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "arrow";
      btn.textContent = "↔";
      btn.setAttribute("aria-label", "Row " + (r + 1));
      if (state.selected && state.selected.kind === "row" && state.selected.index === r) {
        btn.classList.add("selected");
      }
      btn.addEventListener("click", () => {
        state = Core.select(state, "row", r);
        render();
      });
      rowArrows.appendChild(btn);
    }

    colArrows.innerHTML = "";
    for (let c = 0; c < n; c++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "arrow";
      btn.textContent = "↕";
      btn.setAttribute("aria-label", "Column " + (c + 1));
      if (state.selected && state.selected.kind === "col" && state.selected.index === c) {
        btn.classList.add("selected");
      }
      btn.addEventListener("click", () => {
        state = Core.select(state, "col", c);
        render();
      });
      colArrows.appendChild(btn);
    }

    const target = Core.targetGrid(n);
    if (target) {
      targetWrap.hidden = false;
      targetGrid.style.gridTemplateColumns = "repeat(" + n + ", 2.4rem)";
      targetGrid.style.display = "grid";
      targetGrid.style.gap = "2px";
      targetGrid.style.background = "var(--border)";
      targetGrid.style.padding = "2px";
      targetGrid.style.borderRadius = "8px";
      targetGrid.innerHTML = "";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const cell = document.createElement("div");
          cell.className = "cell";
          cell.textContent = String(target[r][c] + 1);
          if (state.grid[r][c] !== target[r][c]) cell.classList.add("mismatch");
          targetGrid.appendChild(cell);
        }
      }
    } else {
      targetWrap.hidden = true;
    }

    backBtn.disabled = state.history.length === 0;
    if (state.explored) {
      if (n === 3 && Core.matchesTarget(state)) say("You matched the target — that should be impossible!", "done");
      else say("Column bags stay the same. For N=3 the target cannot be reached.", "done");
    } else if (state.selected) {
      say("Press another " + state.selected.kind + " arrow to swap.");
    } else {
      say("Press a row or column arrow, then another of the same kind.");
    }

    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function newGame() {
    state = Core.start({ n: Number(nInput.value) });
    render();
  }

  newBtn.addEventListener("click", newGame);
  nInput.addEventListener("change", newGame);
  backBtn.addEventListener("click", () => {
    state = Core.undo(state);
    render();
  });

  newGame();
})();
