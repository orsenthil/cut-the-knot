"use strict";

/*
 * UI for Escape of the Clones. The rules and the weight arithmetic live in
 * clones-core.js; this file draws the 10x10 window on the board, fences the
 * prison and handles clicks.
 *
 * The controls are the applet's panel: the M spinner (which prison), the D
 * spinner (how many rows of clones to start with), the Hint checkbox (the
 * 2^-(row+col) labels) and its Reverse move / Reset buttons. The applet gives
 * no written feedback at all -- its only reply to a click that cannot happen
 * is that the clones open their eyes -- so the eyes are kept and a status line
 * says what went wrong as well.
 */
(() => {
  const C = ClonesCore;

  const grid = document.getElementById("grid");
  const statusEl = document.getElementById("status");
  const weightLine = document.getElementById("weightLine");
  const prisonInput = document.getElementById("prisonInput");
  const rowsInput = document.getElementById("rowsInput");
  const weightsInput = document.getElementById("weightsInput");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");

  const MSG = {
    empty: "There is no clone on that square.",
    blocked: "No room: a clone is already below it or to its right.",
    window: "That split would leave this corner. The real board goes on for ever — this is just the part you can see.",
    offboard: "There is no clone on that square.",
    won: "The prison is empty. Every clone got out!",
    stuck: "Nothing can split without leaving this corner. Undo a move and try another order.",
  };

  let m = 1; // which prison
  let d = 1; // rows of clones at the start
  let board = C.startBoard(d);
  let past = []; // the applet's Pairs stack: the square each split happened on
  let message = "";
  let cells = [];
  let stareTimer = 0;

  /* ----------------------------------------------------------------- build */

  /** The fraction written on a square, abbreviated once it gets silly. */
  function weightLabel(r, c) {
    const s = r + c;
    if (s === 0) return "1";
    if (s > 9) return "…";
    return `1/${2 ** s}`;
  }

  function build() {
    grid.textContent = "";
    cells = [];
    const inPrison = new Set(C.prison(m).cells.map(([r, c]) => C.at(r, c)));
    for (let r = 0; r < C.N; r++) {
      for (let c = 0; c < C.N; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        if (inPrison.has(C.at(r, c))) {
          cell.classList.add("prison");
          // Fence only the edges that face out of the prison, so the region
          // gets one outline instead of a box around every square.
          const sides = [];
          if (!inPrison.has(C.at(r - 1, c)) || r === 0) sides.push("inset 0 3px 0 0 var(--fence)");
          if (!inPrison.has(C.at(r + 1, c))) sides.push("inset 0 -3px 0 0 var(--fence)");
          if (!inPrison.has(C.at(r, c - 1)) || c === 0) sides.push("inset 3px 0 0 0 var(--fence)");
          if (!inPrison.has(C.at(r, c + 1))) sides.push("inset -3px 0 0 0 var(--fence)");
          cell.style.boxShadow = sides.join(", ");
        }
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = weightLabel(r, c);
        cell.appendChild(label);
        cell.addEventListener("click", () => play(r, c));
        grid.appendChild(cell);
        cells.push(cell);
      }
    }
  }

  /* ---------------------------------------------------------------- render */

  function render(fresh = []) {
    const freshSet = new Set(fresh.map(([r, c]) => C.at(r, c)));
    for (let r = 0; r < C.N; r++) {
      for (let c = 0; c < C.N; c++) {
        const i = C.at(r, c);
        const cell = cells[i];
        const has = !!board[i];
        const had = !!cell.querySelector(".clone");
        if (has !== had) {
          if (has) {
            const clone = document.createElement("span");
            clone.className = "clone";
            cell.appendChild(clone);
          } else {
            cell.querySelector(".clone").remove();
          }
        }
        cell.classList.toggle("fresh", freshSet.has(i));
        const where = `row ${r + 1}, column ${c + 1}`;
        const prisonBit = C.prison(m).cells.some(([pr, pc]) => pr === r && pc === c) ? ", in the prison" : "";
        cell.setAttribute("aria-label", has ? `Clone at ${where}${prisonBit}: split it` : `Empty, ${where}${prisonBit}`);
      }
    }

    const won = C.prisonEmpty(board, m);
    const stuck = !won && C.legalSplits(board).length === 0;
    if (won) message = MSG.won;
    else if (stuck && !message) message = MSG.stuck;

    const left = C.prison(m).cells.filter(([r, c]) => board[C.at(r, c)]).length;
    statusEl.textContent = message || (left === 1 ? "1 clone still in the prison." : `${left} clones still in the prison.`);
    statusEl.classList.toggle("win", won);
    statusEl.classList.toggle("lose", !won && stuck);

    grid.classList.toggle("weights", weightsInput.checked);
    if (weightsInput.checked) {
      const held = C.occupiedWeight(board);
      const room = C.BOARD_WEIGHT - C.prison(m).weight;
      weightLine.innerHTML =
        `The clones are standing on <code>${fmt(held)}</code> of the board's <code>4</code>. ` +
        `Outside this prison there is room for <code>${fmt(room)}</code>.`;
    } else {
      weightLine.textContent = "";
    }
    undoBtn.disabled = past.length === 0;
  }

  /** A weight as an exact fraction over a power of two. */
  function fmt(x) {
    if (Number.isInteger(x)) return String(x);
    let den = 1;
    while (!Number.isInteger(x * den) && den < 1 << 20) den *= 2;
    return `${x * den}/${den}`;
  }

  /** OpenEyes: the clones look up for a moment when a click does nothing. */
  function stare() {
    clearTimeout(stareTimer);
    grid.classList.add("staring");
    stareTimer = setTimeout(() => grid.classList.remove("staring"), 700);
  }

  /* ------------------------------------------------------------------- play */

  function play(r, c) {
    if (C.prisonEmpty(board, m)) return;
    const problem = C.splitProblem(board, r, c);
    if (problem) {
      message = MSG[problem];
      stare();
      render();
      return;
    }
    past.push([r, c]);
    board = C.split(board, r, c);
    message = "";
    render([[r + 1, c], [r, c + 1]]);
    if (C.prisonEmpty(board, m)) stare();
  }

  /* --------------------------------------------------------------- controls */

  function reset() {
    board = C.startBoard(d);
    past = [];
    message = "";
    grid.classList.remove("staring");
    render();
  }

  resetBtn.addEventListener("click", reset);
  undoBtn.addEventListener("click", () => {
    if (!past.length) return;
    const [r, c] = past.pop();
    board = C.unsplit(board, r, c);
    message = "";
    render();
  });
  prisonInput.addEventListener("change", () => {
    m = Number(prisonInput.value);
    build();
    reset();
  });
  rowsInput.addEventListener("change", () => {
    const v = Math.min(10, Math.max(1, Math.round(Number(rowsInput.value) || 1)));
    rowsInput.value = String(v);
    d = v;
    reset();
  });
  weightsInput.addEventListener("change", () => render());

  build();
  reset();
})();
