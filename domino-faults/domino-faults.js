"use strict";

/*
 * Dominoes on a Chessboard - the page.
 *
 * The rules live in domino-core.js. This file draws the board and turns
 * clicks, taps and arrow keys into core calls.
 *
 * Layout: the squares are real <button>s in a CSS grid, and the dominoes and
 * the fault lines are percentage-positioned over them in an overlay that
 * ignores pointer events, so the board scales to any width and every square
 * stays clickable and reachable from the keyboard.
 */

(function () {
  const D = DominoCore;

  const MIN_SIDE = 3;
  const MAX_SIDE = 10; // the applet allows up to 20, which no phone can tap
  const CELL_MAX = 46; // px, so a small board does not become enormous

  const boardEl = document.getElementById("board");
  const rowsInput = document.getElementById("rowsInput");
  const colsInput = document.getElementById("colsInput");
  const removeBtn = document.getElementById("removeBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("scoreLine");

  let state = null;
  let picked = null; // [row, col] of the square waiting for a partner
  let cells = [];
  let overlay = null;

  function fillPicker(select, value) {
    for (let n = MIN_SIDE; n <= MAX_SIDE; n++) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (n === value) opt.selected = true;
      select.appendChild(opt);
    }
  }

  /** Rebuilds the grid of squares. Only a size change needs this. */
  function build() {
    boardEl.style.setProperty("--rows", state.rows);
    boardEl.style.setProperty("--cols", state.cols);
    boardEl.style.maxWidth = state.cols * CELL_MAX + "px";
    boardEl.textContent = "";
    cells = [];
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cell" + ((r + c) % 2 ? " dark" : "");
        b.dataset.r = String(r);
        b.dataset.c = String(c);
        b.tabIndex = r === 0 && c === 0 ? 0 : -1;
        b.addEventListener("click", () => tap(r, c));
        boardEl.appendChild(b);
        cells.push(b);
      }
    }
    overlay = document.createElement("div");
    overlay.className = "overlay";
    boardEl.appendChild(overlay);
  }

  const cellAt = (r, c) => cells[r * state.cols + c];

  function render() {
    const pct = (part, whole) => (100 * part) / whole;
    let art = "";
    for (const d of state.dominoes) {
      const w = d.vertical ? 1 : 2;
      const h = d.vertical ? 2 : 1;
      art +=
        '<div class="piece" style="left:calc(' + pct(d.c, state.cols) + "% + 3px);top:calc(" +
        pct(d.r, state.rows) + "% + 3px);width:calc(" + pct(w, state.cols) +
        "% - 6px);height:calc(" + pct(h, state.rows) + '% - 6px)"></div>';
    }
    const f = D.faults(state);
    for (const h of f.horizontal) {
      art += '<div class="fault" style="left:0;width:100%;height:4px;top:calc(' +
        pct(h, state.rows) + '% - 2px)"></div>';
    }
    for (const v of f.vertical) {
      art += '<div class="fault" style="top:0;height:100%;width:4px;left:calc(' +
        pct(v, state.cols) + '% - 2px)"></div>';
    }
    overlay.innerHTML = art;

    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const b = cellAt(r, c);
        const taken = D.dominoAt(state, r, c) >= 0;
        const isPicked = picked && picked[0] === r && picked[1] === c;
        b.classList.toggle("picked", !!isPicked);
        b.setAttribute(
          "aria-label",
          "row " + (r + 1) + ", column " + (c + 1) + ": " +
            (taken ? "covered. Click to take the domino away." :
             isPicked ? "chosen. Click a square beside it." : "empty")
        );
      }
    }

    const total = (state.rows * state.cols) >> 1;
    const faultCount = f.horizontal.length + f.vertical.length;
    scoreEl.textContent =
      "Dominoes: " + state.dominoes.length + " of " + total +
      " · Fault lines: " + faultCount;
    removeBtn.disabled = state.dominoes.length === 0;
  }

  /** Is there anywhere left to put a domino? */
  function stuck() {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (!D.free(state, r, c)) continue;
        if (D.free(state, r, c + 1) || D.free(state, r + 1, c)) return false;
      }
    }
    return true;
  }

  function judge() {
    if (D.won(state)) {
      say("Fault-free! Every line on the board is crossed.", "win");
      return;
    }
    const faults = D.faultCount(state);
    if (D.isFull(state)) {
      const why = D.faultFree(state.rows, state.cols)
        ? ""
        : " No " + state.rows + " by " + state.cols + " covering can avoid them.";
      say("Board full, but " + faults + (faults === 1 ? " fault line" : " fault lines") + " left." + why, "lose");
      return;
    }
    if (stuck()) {
      const left = state.rows * state.cols - 2 * state.dominoes.length;
      say(
        "Stuck: " + left + (left === 1 ? " square has" : " squares have") + " no room for a domino.",
        "lose"
      );
      return;
    }
    say("", "");
  }

  function tap(r, c) {
    if (D.dominoAt(state, r, c) >= 0) {
      D.removeAt(state, r, c);
      picked = null;
    } else if (!picked) {
      picked = [r, c];
    } else if (picked[0] === r && picked[1] === c) {
      picked = null;
    } else if (D.place(state, picked[0], picked[1], r, c)) {
      picked = null;
    } else {
      picked = [r, c]; // not a neighbour: start again from here
    }
    render();
    judge();
  }

  function say(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls;
  }

  function reset(rows, cols) {
    state = D.create(rows, cols);
    picked = null;
    build();
    render();
    judge();
  }

  boardEl.addEventListener("keydown", (e) => {
    const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (!step || !(e.target instanceof HTMLElement) || !e.target.dataset.r) return;
    const r = Number(e.target.dataset.r) + step[0];
    const c = Number(e.target.dataset.c) + step[1];
    if (!D.inside(state, r, c)) return;
    e.preventDefault();
    e.target.tabIndex = -1;
    const next = cellAt(r, c);
    next.tabIndex = 0;
    next.focus();
  });

  fillPicker(rowsInput, 6);
  fillPicker(colsInput, 6);
  rowsInput.addEventListener("change", () => reset(Number(rowsInput.value), state.cols));
  colsInput.addEventListener("change", () => reset(state.rows, Number(colsInput.value)));
  resetBtn.addEventListener("click", () => reset(state.rows, state.cols));
  removeBtn.addEventListener("click", () => {
    if (D.removeLast(state)) {
      picked = null;
      render();
      judge();
    }
  });

  reset(6, 6);
})();
