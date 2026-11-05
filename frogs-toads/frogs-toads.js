"use strict";

/*
 * Toads and Frogs - the page.
 *
 * All the rules live in frogs-toads-core.js. This file draws the row and
 * turns a click on an animal into a core move, as the applet does: "Click on
 * a piece you wish to move." With one empty square a piece has at most one
 * legal destination, so one click is a whole move.
 *
 * Under the board is the applet's move string: S and J for slides and jumps,
 * or, with "Hole moves" ticked, the empty square's own moves (r, R, l, L).
 *
 * The frog and toad pictures are the applet's own Images/frog.gif and
 * Images/toad.gif, with their white background made transparent. The applet
 * drew toad.gif on the left; the port follows the cut-the-knot page, with
 * frogs on the left, so each animal faces the way it moves.
 */

(function () {
  const F = FrogsToadsCore;

  const CELL_MAX = 58; // px, so a short row does not fill the screen
  const SPRITE = { 1: "images/frog.png", 2: "images/toad.png" };
  const NAME = { 0: "empty square", 1: "frog", 2: "toad" };

  const boardEl = document.getElementById("board");
  const frogsInput = document.getElementById("frogsInput");
  const toadsInput = document.getElementById("toadsInput");
  const holeInput = document.getElementById("holeInput");
  const backBtn = document.getElementById("backBtn");
  const newBtn = document.getElementById("newBtn");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("scoreLine");
  const movesEl = document.getElementById("moveString");

  let state = null;
  let cells = [];
  let lastTo = null;

  function fillPicker(select, value) {
    for (const n of F.COUNTS) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (n === value) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function build() {
    const n = state.cells.length;
    boardEl.style.setProperty("--cells", n);
    boardEl.style.maxWidth = n * CELL_MAX + "px";
    boardEl.textContent = "";
    cells = [];
    for (let i = 0; i < n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cell";
      b.dataset.i = String(i);
      b.tabIndex = i === 0 ? 0 : -1;
      b.addEventListener("click", () => tap(i));
      boardEl.appendChild(b);
      cells.push(b);
    }
  }

  function render() {
    state.cells.forEach((v, i) => {
      const b = cells[i];
      const can = !!F.target(state, i);
      const want = v === F.EMPTY ? "" : '<img src="' + SPRITE[v] + '" alt="">';
      if (b.innerHTML !== want) b.innerHTML = want;
      b.classList.toggle("hole", v === F.EMPTY);
      b.classList.toggle("canMove", can);
      b.classList.toggle("justMoved", lastTo === i);
      b.setAttribute("aria-label", "square " + (i + 1) + ": " + NAME[v] + (can ? ", can move" : ""));
    });
    const used = state.history.length;
    scoreEl.textContent =
      "Moves: " + used + " · Every solution takes " + F.minimum(state.frogs, state.toads);
    movesEl.textContent = holeInput.checked ? state.holeMoves : state.moves;
    backBtn.disabled = used === 0;
  }

  function judge() {
    if (F.won(state)) {
      say("You did it! " + state.history.length + " moves.", "win");
    } else if (F.stuck(state)) {
      say("You are stuck! Take a move back and try another way.", "lose");
    } else {
      say("", "");
    }
  }

  function tap(i) {
    if (state.cells[i] === F.EMPTY) {
      say("", "");
      return;
    }
    if (!F.move(state, i)) {
      say("Can't move this piece.", "");
      return;
    }
    lastTo = state.history[state.history.length - 1][1];
    render();
    judge();
  }

  function say(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls;
  }

  function reset(frogs, toads) {
    state = F.start(frogs, toads);
    lastTo = null;
    build();
    render();
    judge();
  }

  boardEl.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step || !(e.target instanceof HTMLElement) || e.target.dataset.i === undefined) return;
    const i = Number(e.target.dataset.i) + step;
    if (i < 0 || i >= cells.length) return;
    e.preventDefault();
    e.target.tabIndex = -1;
    cells[i].tabIndex = 0;
    cells[i].focus();
  });

  fillPicker(frogsInput, 3);
  fillPicker(toadsInput, 3);
  frogsInput.addEventListener("change", () => reset(Number(frogsInput.value), state.toads));
  toadsInput.addEventListener("change", () => reset(state.frogs, Number(toadsInput.value)));
  holeInput.addEventListener("change", render);
  newBtn.addEventListener("click", () => reset(state.frogs, state.toads));
  backBtn.addEventListener("click", () => {
    if (F.undo(state)) {
      lastTo = null;
      render();
      judge();
    }
  });

  reset(3, 3);
})();
