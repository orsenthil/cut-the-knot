"use strict";

/*
 * The page for Arith Magic: drawing and input only; the arithmetic is in
 * arith-magic-core.js. The play area is an (n+1) by (n+1) grid: a blank
 * corner, row numbers down the left and column numbers across the top (only
 * when "Show hint" is on), and the table of sums or products inside. Clicking
 * a square crosses it; clicking a hint number to the right of its middle
 * raises it, to the left lowers it, and dragging changes it faster.
 */

(function () {
  const Core = ArithMagicCore;
  const stageEl = document.getElementById("stage");
  const boardEl = document.getElementById("board");
  const resultEl = document.getElementById("result");
  const predictionEl = document.getElementById("prediction");
  const statusEl = document.getElementById("status");
  const clearBtn = document.getElementById("clearBtn");
  const newBtn = document.getElementById("newBtn");
  const hintIn = document.getElementById("hintIn");
  const sizeIn = document.getElementById("sizeIn");
  const sizeOut = document.getElementById("sizeOut");
  const sumIn = document.getElementById("sumOp");
  const prodIn = document.getElementById("prodOp");

  let state = null;
  let builtSize = 0;
  let cells = [];
  let rowControls = [];
  let colControls = [];

  /**
   * Shows a line under the game. `kind` is "done" here (a demo has no win or
   * loss); the shared progress tracker reads that class to see the play ended.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function buildBoard() {
    boardEl.textContent = "";
    boardEl.style.setProperty("--n", String(state.size + 1));
    cells = [];
    rowControls = [];
    colControls = [];

    const corner = document.createElement("span");
    corner.className = "corner";
    corner.setAttribute("aria-hidden", "true");
    boardEl.appendChild(corner);

    for (let c = 0; c < state.size; c++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num control-num col-control";
      btn.dataset.index = String(c);
      btn.addEventListener("click", (evt) => controlClick("col", c, evt));
      btn.addEventListener("keydown", (evt) => controlKey("col", c, evt));
      boardEl.appendChild(btn);
      colControls.push(btn);
    }

    for (let r = 0; r < state.size; r++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num control-num row-control";
      btn.dataset.index = String(r);
      btn.addEventListener("click", (evt) => controlClick("row", r, evt));
      btn.addEventListener("keydown", (evt) => controlKey("row", r, evt));
      boardEl.appendChild(btn);
      rowControls.push(btn);

      for (let c = 0; c < state.size; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.addEventListener("click", () => pick(r, c));
        cell.addEventListener("keydown", (evt) => cellKey(r, c, evt));
        boardEl.appendChild(cell);
        cells.push(cell);
      }
    }
    builtSize = state.size;
  }

  function render() {
    if (builtSize !== state.size) buildBoard();

    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const btn = cells[r * state.size + c];
        const value = Core.cellValue(state, r, c);
        const picked = Core.isSelected(state, r, c);
        btn.textContent = String(value);
        btn.classList.toggle("picked", picked);
        btn.setAttribute("aria-pressed", picked ? "true" : "false");
        btn.setAttribute(
          "aria-label",
          `Row ${r + 1}, column ${c + 1}: ${value}. ${picked ? "Picked." : "Not picked."}`
        );
      }
    }
    for (const [which, buttons] of [["row", rowControls], ["col", colControls]]) {
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const value = which === "row" ? state.v[i] : state.h[i];
        btn.textContent = hintIn.checked ? String(value) : "";
        btn.disabled = !hintIn.checked;
        btn.setAttribute("aria-hidden", hintIn.checked ? "false" : "true");
        btn.setAttribute(
          "aria-label",
          `${which === "row" ? "Row" : "Column"} ${i + 1} number: ${value}. ` +
            "Press the right half to raise it, the left half to lower it; arrow keys also work."
        );
      }
    }

    const total = Core.runningTotal(state);
    resultEl.textContent = total === null
      ? "Pick some squares to see the running total."
      : Core.resultMessage(state);
    predictionEl.textContent = hintIn.checked
      ? `The row and column numbers give ${Core.predictedTotal(state)}.`
      : "";
    clearBtn.disabled = state.selected.length === 0;
    sizeIn.value = String(state.size);
    sizeOut.textContent = `${state.size}×${state.size}`;
    sumIn.checked = state.operation === "sum";
    prodIn.checked = state.operation === "product";
    hintIn.checked = showHint;

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        size: state.size,
        operation: state.operation,
        v: state.v.slice(),
        h: state.h.slice(),
        selected: state.selected.map((p) => p.slice()),
        hint: showHint,
      });
    }
  }

  let showHint = false;

  function play(m) {
    const next = Core.move(state, m);
    if (!next || next === state) return;
    state = next;
    if (Core.result(state) === "done") {
      say(`The total is ${Core.runningTotal(state)} — the same as the row and column numbers!`, "done");
    } else if (Core.isFull(state)) {
      say(`That is ${state.size} squares, but two share a row or column. Try one in each.`, null);
    } else {
      say("", null);
    }
    render();
  }

  function pick(r, c) {
    play({ type: "toggle", r, c });
  }

  /** Applet controls: right half up, left half down; keyboard arrows work. */
  function step(which, i, dir, fast) {
    const next = Core.stepControl(state, which, i, dir, fast);
    if (next === state) return;
    state = next;
    say("");
    render();
  }

  function controlClick(which, i, evt) {
    if (suppressClick) { suppressClick = false; return; }
    const rect = evt.currentTarget.getBoundingClientRect();
    const right = evt.detail === 0 || evt.clientX - rect.left > rect.width / 2;
    step(which, i, right ? 1 : -1, false);
  }

  function controlKey(which, i, evt) {
    if (evt.key === "ArrowRight" || evt.key === "ArrowUp") {
      evt.preventDefault();
      step(which, i, 1, false);
    } else if (evt.key === "ArrowLeft" || evt.key === "ArrowDown") {
      evt.preventDefault();
      step(which, i, -1, false);
    }
  }

  function cellKey(r, c, evt) {
    const moves = {
      ArrowRight: [r, c + 1], ArrowLeft: [r, c - 1],
      ArrowDown: [r + 1, c], ArrowUp: [r - 1, c],
    };
    const to = moves[evt.key];
    if (!to) return; // Enter and Space are handled by the button itself
    evt.preventDefault();
    const nr = Math.min(state.size - 1, Math.max(0, to[0]));
    const nc = Math.min(state.size - 1, Math.max(0, to[1]));
    cells[nr * state.size + nc].focus();
  }

  // A drag over a hint number changes it by the applet's larger increment.
  let drag = null;
  let suppressClick = false;
  boardEl.addEventListener("pointerdown", (evt) => {
    const btn = evt.target.closest(".control-num");
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    drag = {
      which: btn.classList.contains("row-control") ? "row" : "col",
      index: Number(btn.dataset.index),
      dir: evt.clientX - rect.left > rect.width / 2 ? 1 : -1,
      lastX: evt.clientX,
    };
    suppressClick = false;
  });
  window.addEventListener("pointermove", (evt) => {
    if (!drag) return;
    if (Math.abs(evt.clientX - drag.lastX) < 14) return;
    drag.lastX = evt.clientX;
    step(drag.which, drag.index, drag.dir, true);
    suppressClick = true; // the drag already moved the number
  });
  window.addEventListener("pointerup", () => { drag = null; });
  window.addEventListener("pointercancel", () => { drag = null; });

  function newGame() {
    const operation = prodIn.checked ? "product" : "sum";
    state = Core.start({ size: Number(sizeIn.value), operation });
    say("");
    render();
  }

  function resetTo(operation) {
    prodIn.checked = operation === "product";
    sumIn.checked = operation !== "product";
    newGame();
  }

  newBtn.addEventListener("click", newGame);
  clearBtn.addEventListener("click", () => { state = Core.clear(state); say(""); render(); });
  sumIn.addEventListener("change", () => resetTo("sum"));
  prodIn.addEventListener("change", () => resetTo("product"));
  sizeIn.addEventListener("change", newGame);
  hintIn.addEventListener("change", () => {
    showHint = hintIn.checked;
    say("");
    render();
  });

  newGame();
})();
