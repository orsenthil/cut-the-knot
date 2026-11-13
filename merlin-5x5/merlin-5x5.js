"use strict";

/*
 * Lights Out — the page.
 *
 * Merlin5x5Core owns the classic plus-move, chase-lights solve and Setup
 * toggle. This file draws the 5×5 board and wires Hint / Setup / Undo / Reset.
 */

(function () {
  const H = Merlin5x5Core;

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const hintInput = document.getElementById("hintInput");
  const setupInput = document.getElementById("setupInput");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");

  let board = null;
  let history = []; // {r,c,setup} for undo
  let hintOn = false;
  let setupOn = false;

  function setStatus(msg, cls) {
    statusEl.textContent = msg || "";
    statusEl.className = cls || "";
  }

  function updateChrome() {
    undoBtn.disabled = history.length === 0 || hintOn || setupOn;
    resetBtn.disabled = setupOn;
    hintInput.disabled = setupOn;
  }

  function render() {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--n", String(H.N));
    const marks = hintOn ? H.hint(board) : null;

    for (let r = 0; r < H.N; r++) {
      for (let c = 0; c < H.N; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        const on = board[r][c] === 1;
        btn.className = "cell" + (on ? " on" : " off");
        if (marks && marks[r][c]) btn.classList.add("press");
        btn.disabled = hintOn;
        btn.setAttribute(
          "aria-label",
          "Row " + (r + 1) + ", column " + (c + 1) +
            (on ? ", lit" : ", off") +
            (marks && marks[r][c] ? ", press this" : ""),
        );
        btn.addEventListener("click", () => clickAt(r, c));
        boardEl.appendChild(btn);
      }
    }
    updateChrome();
  }

  function clickAt(r, c) {
    if (hintOn) return;
    if (setupOn) {
      H.toggleOne(board, r, c);
      history = [];
      setStatus("Setup: click lights to toggle them alone.");
      render();
      return;
    }
    H.press(board, r, c);
    history.push({ r, c });
    if (H.isSolved(board)) setStatus("All lights out — well done!", "win");
    else setStatus("");
    render();
  }

  function undo() {
    if (!history.length || hintOn || setupOn) return;
    const last = history.pop();
    H.press(board, last.r, last.c); // toggles are their own inverse
    setStatus("");
    render();
  }

  function reset() {
    board = H.randomBoard();
    history = [];
    hintOn = false;
    setupOn = false;
    hintInput.checked = false;
    setupInput.checked = false;
    setStatus("");
    render();
  }

  hintInput.addEventListener("change", () => {
    hintOn = hintInput.checked;
    if (hintOn) {
      const marks = H.hint(board);
      if (!marks) {
        setStatus("No solution — this board cannot be cleared.", "lose");
      } else {
        const n = marks.flat().reduce((a, b) => a + b, 0);
        setStatus(
          n === 0
            ? "Already solved — nothing to press."
            : "Press the ringed cells (" + n + "). Turn Hint off to play.",
        );
      }
    } else if (H.isSolved(board)) {
      setStatus("All lights out — well done!", "win");
    } else {
      setStatus("");
    }
    render();
  });

  setupInput.addEventListener("change", () => {
    setupOn = setupInput.checked;
    if (setupOn) {
      hintOn = false;
      hintInput.checked = false;
      history = [];
      setStatus("Setup: click a cell to flip only that light.");
    } else {
      setStatus("");
    }
    render();
  });

  undoBtn.addEventListener("click", undo);
  resetBtn.addEventListener("click", reset);

  reset();
})();
