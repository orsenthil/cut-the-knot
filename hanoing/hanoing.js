"use strict";

/*
 * Hanoing - the UI.
 *
 * Port of Bogomolny's Hanoing applet. The rules, the suggestion algorithm and
 * the move counting all live in hanoing-core.js; this file draws the row of
 * squares, the optional tower view, and runs the animated solve.
 *
 * The applet's controls are kept: the N spinner (3 to 20, starting at 4),
 * Suggest move (HanoingCanvas.Help), Slow and Fast (HanoingCanvas.Solve at two
 * speeds, falling back to repeated suggestions after a randomize, exactly as
 * Solve() does), Randomize and Reset. The one addition is the tower view, which
 * is the point the original page makes in prose.
 */

(function () {
  const H = HanoingCore;

  const rowEl = document.getElementById("row");
  const towersEl = document.getElementById("towers");
  const towersChk = document.getElementById("towersChk");
  const nLabel = document.getElementById("nLabel");
  const fewerBtn = document.getElementById("fewerBtn");
  const moreBtn = document.getElementById("moreBtn");
  const hintBtn = document.getElementById("hintBtn");
  const slowBtn = document.getElementById("slowBtn");
  const fastBtn = document.getElementById("fastBtn");
  const randomBtn = document.getElementById("randomBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");
  const movesEl = document.getElementById("moves");
  const bestEl = document.getElementById("best");

  const COLOUR_NAMES = ["red", "blue", "white"];
  const SLOW_MS = 400;
  const FAST_MS = 50;

  let n = H.DEFAULT_N;
  let state = H.newGame(n);
  let justMoved = -1;   // the square to flash
  let timer = null;     // the auto-solve interval
  let solveDelay = 0;   // which speed it is running at
  let startBest = 0;    // the best possible for the position we started from

  /* ------------------------------------------------------------ rendering */

  function build() {
    rowEl.textContent = "";
    for (let i = 0; i < state.n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sq";
      b.dataset.i = String(i);
      rowEl.appendChild(b);
    }
    towersEl.textContent = "";
    for (let p = 0; p < 3; p++) {
      const col = document.createElement("div");
      col.className = "peg";
      const cap = document.createElement("div");
      cap.className = "cap";
      cap.textContent = COLOUR_NAMES[p];
      col.appendChild(cap);
      const stack = document.createElement("div");
      stack.className = "stack";
      col.appendChild(stack);
      towersEl.appendChild(col);
    }
    paint();
  }

  function paint() {
    // begin() stops any solve before it rebuilds, so a paint can arrive while
    // the DOM still belongs to the previous position. build() paints again.
    if (rowEl.children.length !== state.n || towersEl.children.length !== 3) return;
    const solving = timer !== null;
    for (const b of rowEl.children) {
      const i = Number(b.dataset.i);
      const c = state.peg[i];
      b.className = `sq c${c}`;
      if (justMoved === i) b.classList.add("justMoved");
      // Deliberately no mark for a square that cannot move: working out which
      // ones are stuck is half the puzzle, and the applet gave nothing away
      // either. The refusal message is the only feedback.
      b.disabled = solving;
      b.setAttribute("aria-label", `Square ${i + 1}, ${COLOUR_NAMES[c]}`);
    }

    // The same position as three pegs, biggest disc at the bottom.
    for (let p = 0; p < 3; p++) {
      const col = towersEl.children[p].querySelector(".stack");
      col.textContent = "";
      // Smallest first: the column is flex-direction: column, so the first
      // disc appended sits at the top of the peg and the largest at the base.
      for (let i = 0; i < state.n; i++) {
        if (state.peg[i] !== p) continue;
        const d = document.createElement("div");
        d.className = `disk c${p}`;
        d.style.width = `${Math.round((100 * (i + 1)) / state.n)}%`;
        col.appendChild(d);
      }
    }

    movesEl.textContent = String(state.moves);
    bestEl.textContent = H.isWon(state) ? "done" : String(H.minMoves(state));
    nLabel.textContent = String(state.n);
    fewerBtn.disabled = solving || state.n <= H.MIN_N;
    moreBtn.disabled = solving || state.n >= H.MAX_N;
    hintBtn.disabled = solving || H.isWon(state);
    slowBtn.disabled = H.isWon(state);
    fastBtn.disabled = H.isWon(state);
    slowBtn.textContent = solving && solveDelay === SLOW_MS ? "Stop" : "Slow";
    fastBtn.textContent = solving && solveDelay === FAST_MS ? "Stop" : "Fast";
  }

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.toggle("win", kind === "win");
    statusEl.classList.toggle("lose", kind === "lose");
  }

  /* -------------------------------------------------------------- playing */

  /** HanoingCanvas.Approve: the verdict once the row is one colour. */
  function announce() {
    // The applet compares the move count with 2^N, which is right from its own
    // all-red start. The true optimum is used here instead, so a randomized
    // game is judged by what it was actually worth.
    const par = startBest;
    if (state.moves <= par) {
      say(`${H.MESSAGES.won} ${H.MESSAGES.optimal} ${state.moves} moves is the best there is.`, "win");
    } else {
      say(`${H.MESSAGES.won} ${H.MESSAGES.long} You took ${state.moves}; ${par} was possible.`, "win");
    }
  }

  function doMove(i, to) {
    H.apply(state, i, to);
    justMoved = i;
    paint();
    if (H.isWon(state)) {
      stopSolving();
      announce();
    }
  }

  rowEl.addEventListener("click", (ev) => {
    const b = ev.target.closest(".sq");
    if (!b || b.disabled) return;
    const i = Number(b.dataset.i);
    const to = H.destination(state, i);
    if (to < 0) {
      justMoved = -1;
      paint();
      say(H.MESSAGES.illegal, "lose");
      return;
    }
    say("");
    doMove(i, to);
  });

  /*
   * HanoingCanvas.Help pushes its move and calls MakeMove(), so the applet's
   * "Suggest move" button plays the move rather than pointing at it. It is
   * kept that way, and it also sidesteps a trap: Help can name the colour two
   * steps round the cycle, which a single click would not reach.
   */
  hintBtn.addEventListener("click", () => {
    const s = H.suggest(state);
    if (!s) return;
    doMove(s.disk, s.to);
    if (!H.isWon(state)) say(`Square ${s.disk + 1} goes ${COLOUR_NAMES[s.to]}.`);
  });

  /* ----------------------------------------------------- the auto-solve */

  function stopSolving() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    solveDelay = 0;
    paint();
  }

  /*
   * HanoingCanvas.Solve pre-computes the whole recursion into a stack when the
   * position is the standard start and otherwise replays Help(). Both are the
   * same sequence - porting/check-hanoing.mjs checks that following Help from
   * the all-red start takes exactly the recursion's 2^n - 1 moves - so this
   * just plays Help each tick. That also keeps 20 squares, which is over a
   * million moves, from being built as an array up front.
   */
  function startSolving(delay) {
    const wasRunning = timer !== null && solveDelay === delay;
    stopSolving();
    if (wasRunning) { say("Stopped."); return; }   // the button is Stop while that speed runs
    solveDelay = delay;
    timer = setInterval(() => {
      const m = H.suggest(state);
      if (!m) { stopSolving(); return; }
      doMove(m.disk, m.to);
    }, delay);
    say("Solving, one best move at a time. Press Stop to take over.");
    paint();
  }

  slowBtn.addEventListener("click", () => startSolving(SLOW_MS));
  fastBtn.addEventListener("click", () => startSolving(FAST_MS));

  /* ------------------------------------------------------ new positions */

  function begin(next) {
    stopSolving();
    state = next;
    n = state.n;
    justMoved = -1;
    startBest = H.minMoves(state);
    build();
    say(state.randomized
      ? `A random start. Make them all white in ${startBest} moves.`
      : `All red. Make them all blue or all white in ${startBest} moves.`);
  }

  resetBtn.addEventListener("click", () => begin(H.newGame(n)));
  randomBtn.addEventListener("click", () => begin(H.randomize(n)));
  fewerBtn.addEventListener("click", () => { n = Math.max(H.MIN_N, n - 1); begin(H.newGame(n)); });
  moreBtn.addEventListener("click", () => { n = Math.min(H.MAX_N, n + 1); begin(H.newGame(n)); });
  towersChk.addEventListener("change", () => {
    towersEl.classList.toggle("on", towersChk.checked);
    towersEl.setAttribute("aria-hidden", towersChk.checked ? "false" : "true");
  });

  begin(H.newGame(n));
})();
