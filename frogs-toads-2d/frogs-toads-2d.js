"use strict";

/*
 * Toads and Frogs in 2D - the page.
 *
 * All the rules live in frogs-core.js. This file draws the grid and turns a
 * click on an animal into a core move, which is how the applet works too:
 * "Click on a piece you wish to move." With a single empty square a piece
 * has at most one legal destination, so one click is a whole move.
 *
 * The frog and toad pictures are the applet's own Images/frog.gif and
 * Images/toad.gif, with their white background made transparent.
 */

(function () {
  const F = FrogsCore;

  const CELL_MAX = 58; // px, so a 3x3 board does not fill the screen
  const SPRITE = { 1: "images/frog.png", 2: "images/toad.png" };
  const NAME = { 0: "empty square", 1: "frog", 2: "toad" };

  const boardEl = document.getElementById("board");
  const colsInput = document.getElementById("colsInput");
  const rowsInput = document.getElementById("rowsInput");
  const backBtn = document.getElementById("backBtn");
  const newBtn = document.getElementById("newBtn");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("scoreLine");

  let state = null;
  let cells = [];
  let lastTo = null;

  function fillPicker(select, value) {
    for (const n of F.SIDES) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (n === value) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function build() {
    boardEl.style.setProperty("--cols", state.cols);
    boardEl.style.maxWidth = state.cols * CELL_MAX + "px";
    boardEl.textContent = "";
    cells = [];
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cell";
        b.dataset.x = String(x);
        b.dataset.y = String(y);
        b.tabIndex = x === 0 && y === 0 ? 0 : -1;
        b.addEventListener("click", () => tap(x, y));
        boardEl.appendChild(b);
        cells.push(b);
      }
    }
  }

  const cellAt = (x, y) => cells[y * state.cols + x];

  function render() {
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const b = cellAt(x, y);
        const v = F.at(state, x, y);
        const can = !!F.target(state, x, y);
        const want = v === F.EMPTY ? "" : '<img src="' + SPRITE[v] + '" alt="">';
        if (b.innerHTML !== want) b.innerHTML = want;
        b.classList.toggle("hole", v === F.EMPTY);
        b.classList.toggle("canMove", can);
        b.classList.toggle("justMoved", !!lastTo && lastTo[0] === x && lastTo[1] === y);
        b.setAttribute(
          "aria-label",
          "row " + (y + 1) + ", column " + (x + 1) + ": " + NAME[v] + (can ? ", can move" : "")
        );
      }
    }
    const target = F.minimum(state.cols, state.rows);
    scoreEl.textContent =
      "Moves: " + state.moves + (target === null ? "" : " · Fewest possible: " + target);
    backBtn.disabled = state.history.length === 0;
  }

  function judge() {
    if (F.won(state)) {
      const target = F.minimum(state.cols, state.rows);
      const extra = target !== null && state.moves > target ? " The fewest possible is " + target + "." : "";
      say("You did it! " + state.moves + (state.moves === 1 ? " move." : " moves.") + extra, "win");
    } else if (F.stuck(state)) {
      say("You are stuck! Take a move back and try another way.", "lose");
    } else {
      say("", "");
    }
  }

  function tap(x, y) {
    if (F.at(state, x, y) === F.EMPTY) {
      say("", "");
      return;
    }
    if (!F.move(state, x, y)) {
      say("Can't move this piece.", "");
      return;
    }
    const last = state.history[state.history.length - 1];
    lastTo = [last[2], last[3]];
    render();
    judge();
  }

  function say(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls;
  }

  function reset(cols, rows) {
    state = F.start(cols, rows);
    lastTo = null;
    build();
    render();
    judge();
  }

  boardEl.addEventListener("keydown", (e) => {
    const step = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (!step || !(e.target instanceof HTMLElement) || e.target.dataset.x === undefined) return;
    const x = Number(e.target.dataset.x) + step[0];
    const y = Number(e.target.dataset.y) + step[1];
    if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return;
    e.preventDefault();
    e.target.tabIndex = -1;
    const next = cellAt(x, y);
    next.tabIndex = 0;
    next.focus();
  });

  fillPicker(colsInput, 3);
  fillPicker(rowsInput, 3);
  colsInput.addEventListener("change", () => reset(Number(colsInput.value), state.rows));
  rowsInput.addEventListener("change", () => reset(state.cols, Number(rowsInput.value)));
  newBtn.addEventListener("click", () => reset(state.cols, state.rows));
  backBtn.addEventListener("click", () => {
    if (F.undo(state)) {
      lastTo = null;
      render();
      judge();
    }
  });

  reset(3, 3);
})();
