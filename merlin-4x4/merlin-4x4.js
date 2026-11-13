"use strict";

/*
 * Mini Lights Out — the page.
 *
 * Merlin4x4Core owns the torus plus-move and the A v hint. This file draws the
 * 4×4 board, handles Hint / Undo / Reset, and announces a win when all lights
 * are off.
 */

(function () {
  const H = Merlin4x4Core;

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const hintInput = document.getElementById("hintInput");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");

  let board = null;
  let history = []; // {r,c} presses for undo
  let hintOn = false;

  function setStatus(msg, cls) {
    statusEl.textContent = msg || "";
    statusEl.className = cls || "";
  }

  function updateUndo() {
    undoBtn.disabled = history.length === 0 || hintOn;
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
        btn.addEventListener("click", () => pressAt(r, c));
        boardEl.appendChild(btn);
      }
    }
    updateUndo();
  }

  function pressAt(r, c) {
    if (hintOn) return;
    H.press(board, r, c);
    history.push({ r, c });
    if (H.isSolved(board)) {
      setStatus("All lights out — well done!", "win");
    } else {
      setStatus("");
    }
    render();
  }

  function undo() {
    if (!history.length || hintOn) return;
    const last = history.pop();
    H.undoPress(board, last.r, last.c);
    setStatus("");
    render();
  }

  function reset() {
    board = H.randomBoard();
    history = [];
    hintOn = false;
    hintInput.checked = false;
    setStatus("");
    render();
  }

  hintInput.addEventListener("change", () => {
    hintOn = hintInput.checked;
    if (hintOn) {
      const n = H.hint(board).flat().reduce((a, b) => a + b, 0);
      setStatus(
        n === 0
          ? "Already solved — nothing to press."
          : "Press the ringed cells (" + n + "). Turn Hint off to play.",
      );
    } else {
      setStatus(H.isSolved(board) ? "All lights out — well done!" : "");
      if (H.isSolved(board)) statusEl.className = "win";
    }
    render();
  });

  undoBtn.addEventListener("click", undo);
  resetBtn.addEventListener("click", reset);

  document.addEventListener("keydown", (e) => {
    if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      undo();
    }
  });

  reset();
})();
