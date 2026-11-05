"use strict";

/*
 * UI for Solitaire on a Circle. All the rules live in solitaire-core.js; this
 * file only arranges the counters around a circle, handles clicks and keys, and
 * reports what happened.
 *
 * The four status messages are the applet's own strings, from the m_Results
 * array in CSolitaireCanvas.class, including the response to clicking a red
 * counter or an empty place. The controls are the applet's panel: Reset (a new
 * random circle), Repeat (the same circle again), Back (one move undone, and
 * disabled when there is nothing to undo) and the < / > pair that sets the
 * number of counters between 3 and 40.
 */
(() => {
  const C = SolitaireCore;

  const MSG = {
    notGreen: "Click on a green counter, please!",
    notThere: "Do you see a counter there?",
    won: "You did it, congratulations.",
    dead: "It's a dead end. Please try again.",
  };

  const ring = document.getElementById("ring");
  const statusEl = document.getElementById("status");
  const countLabel = document.getElementById("countLabel");
  const fewerBtn = document.getElementById("fewerBtn");
  const moreBtn = document.getElementById("moreBtn");
  const undoBtn = document.getElementById("undoBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  const newBtn = document.getElementById("newBtn");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let n = C.N_DEFAULT;
  let board = [];
  let opening = []; // m_Spare: what Repeat goes back to
  let past = []; // m_Stack: the undo history
  let message = "";
  let buttons = [];
  let flashTimer = 0;

  /* ----------------------------------------------------------------- layout */

  /*
   * Counter diameter and ring radius, both as a fraction of the square stage.
   * The two depend on each other -- bigger counters need a bigger ring to keep
   * from overlapping, and a bigger ring leaves less room for the counters -- so
   * this settles them by iterating a few times from a guess. 1.14 is the gap
   * kept between neighbouring counters, and 0.17 caps how fat a counter gets
   * when there are only three of them.
   */
  function geometry(count) {
    let d = 0.17;
    let rho = 0.5 - d / 2 - 0.006;
    for (let k = 0; k < 5; k++) {
      d = Math.min(0.17, (2 * rho * Math.sin(Math.PI / count)) / 1.14);
      rho = 0.5 - d / 2 - 0.006;
    }
    return { d, rho };
  }

  /** Rebuilds the ring of buttons. Only needed when the count changes. */
  function build() {
    const { d, rho } = geometry(n);
    ring.style.setProperty("--d", `${(d * 100).toFixed(3)}%`);
    ring.textContent = "";
    buttons = [];
    for (let i = 0; i < n; i++) {
      // Start at twelve o'clock and go clockwise, so position 0 is at the top.
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "counter";
      b.style.left = `${(50 + 100 * rho * Math.cos(angle)).toFixed(3)}%`;
      b.style.top = `${(50 + 100 * rho * Math.sin(angle)).toFixed(3)}%`;
      b.addEventListener("click", () => play(i));
      ring.appendChild(b);
      buttons.push(b);
    }
  }

  /* ----------------------------------------------------------------- render */

  const FACE = { [C.EMPTY]: "empty", [C.RED]: "red", [C.GREEN]: "green" };
  const SAYS = {
    empty: "empty, nothing to remove",
    red: "red, cannot be clicked",
    green: "green, click to remove it",
  };

  function render() {
    for (let i = 0; i < n; i++) {
      const face = FACE[board[i]];
      const b = buttons[i];
      // Keep the flash classes, which paint() does not own.
      b.classList.remove("empty", "red", "green");
      b.classList.add(face);
      b.setAttribute("aria-label", `Position ${i + 1} of ${n}: ${SAYS[face]}`);
      b.disabled = false;
    }
    const left = C.remaining(board);
    statusEl.textContent = message || (left === 1 ? "1 counter left." : `${left} counters left.`);
    statusEl.classList.toggle("win", message === MSG.won);
    statusEl.classList.toggle("lose", message === MSG.dead);
    countLabel.textContent = String(n);
    undoBtn.disabled = past.length === 0;
    fewerBtn.disabled = n <= C.N_MIN;
    moreBtn.disabled = n >= C.N_MAX;
  }

  /** A short highlight on the counter taken and the two places turned over. */
  function flash(taken) {
    clearTimeout(flashTimer);
    for (const b of buttons) b.classList.remove("flipped", "taken");
    if (reduceMotion.matches) return;
    buttons[taken].classList.add("taken");
    for (const j of [(taken + 1) % n, (taken - 1 + n) % n]) {
      if (board[j] !== C.EMPTY) buttons[j].classList.add("flipped");
    }
    flashTimer = setTimeout(() => {
      for (const b of buttons) b.classList.remove("flipped", "taken");
    }, 420);
  }

  /* ------------------------------------------------------------------- play */

  function play(i) {
    if (C.isCleared(board) || C.isDeadEnd(board)) return; // the game is over
    if (board[i] === C.EMPTY) {
      message = MSG.notThere;
      render();
      return;
    }
    if (board[i] === C.RED) {
      message = MSG.notGreen;
      render();
      return;
    }
    past.push(board.slice()); // Push()
    board = C.move(board, i); // MakeMove(i)
    message = C.isCleared(board) ? MSG.won : C.isDeadEnd(board) ? MSG.dead : "";
    flash(i);
    render();
  }

  /* --------------------------------------------------------------- controls */

  function start(fresh) {
    if (fresh) {
      board = C.randomBoard(n);
      opening = board.slice();
    } else {
      board = opening.slice();
    }
    past = [];
    message = "";
    for (const b of buttons) b.classList.remove("flipped", "taken");
    render();
  }

  function resize(delta) {
    const next = Math.min(C.N_MAX, Math.max(C.N_MIN, n + delta));
    if (next === n) return;
    n = next;
    build();
    start(true);
  }

  newBtn.addEventListener("click", () => start(true));
  repeatBtn.addEventListener("click", () => start(false));
  undoBtn.addEventListener("click", () => {
    if (!past.length) return; // Back()
    board = past.pop();
    message = "";
    for (const b of buttons) b.classList.remove("flipped", "taken");
    render();
  });
  fewerBtn.addEventListener("click", () => resize(-1));
  moreBtn.addEventListener("click", () => resize(+1));

  build();
  start(true);
})();
