"use strict";

/*
 * Pigeon Checkers page: N×(N+1) board. Click a counter, then an empty cell
 * two steps away (orthogonal or diagonal). Hint shades the (even,even) cells.
 */

(function () {
  const Core = PigeonCheckersCore;
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const pegLine = document.getElementById("pegLine");
  const nInput = document.getElementById("nInput");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const hintChk = document.getElementById("hintChk");

  let state = null;
  let focus = [0, 0];

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function fillN() {
    nInput.replaceChildren();
    for (let n = Core.MIN_N; n <= Core.MAX_N; n++) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (n === Core.DEFAULT_N) opt.selected = true;
      nInput.appendChild(opt);
    }
  }

  function render() {
    boardEl.replaceChildren();
    boardEl.style.setProperty("--cols", String(state.cols));
    boardEl.style.setProperty("--rows", String(state.rows));
    const mid = Core.rightHalfStartCol(state);
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const v = state.board[x][y];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.dataset.x = String(x);
        btn.dataset.y = String(y);
        if (x === mid) btn.classList.add("seam");
        if (state.showHint && x % 2 === 0 && y % 2 === 0) btn.classList.add("hint");
        if (v === Core.PEG || v === Core.SELECTED) {
          btn.classList.add("peg");
          if (v === Core.SELECTED) btn.classList.add("selected");
          btn.setAttribute("aria-label", `Counter at column ${x + 1}, row ${y + 1}`);
        } else {
          btn.classList.add("hole");
          btn.setAttribute("aria-label", `Empty at column ${x + 1}, row ${y + 1}`);
        }
        if (focus[0] === x && focus[1] === y) btn.classList.add("focus");
        btn.addEventListener("click", () => onCell(x, y));
        boardEl.appendChild(btn);
      }
    }
    undoBtn.disabled = state.history.length === 0;
    pegLine.textContent = `${Core.pegCount(state)} counters · ${state.history.length} jump${state.history.length === 1 ? "" : "s"}`;
    if (Core.allOnRight(state)) {
      say("Every counter is on the right — but the colouring says this cannot happen!", "win");
    }
    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function onCell(x, y) {
    focus = [x, y];
    const prev = state.history.length;
    state = Core.click(state, x, y);
    if (Core.allOnRight(state)) {
      /* status set in render */
    } else if (state.history.length > prev) {
      say("Jumped. The jumped-over counter stays.");
    } else if (state.selected) {
      say("Now click an empty cell two steps away (including diagonally).");
    } else {
      say("Click a counter, then the empty cell it jumps to.");
    }
    render();
  }

  function newGame() {
    state = Core.start({ n: Number(nInput.value) });
    state.showHint = hintChk.checked;
    focus = [0, 0];
    say("Move every counter to the right half of the board. Is it possible?");
    render();
  }

  undoBtn.addEventListener("click", () => {
    state = Core.undo(state);
    say(state.history.length ? "Took back a jump." : "Click a counter, then the empty cell it jumps to.");
    render();
  });
  resetBtn.addEventListener("click", newGame);
  nInput.addEventListener("change", newGame);
  hintChk.addEventListener("change", () => {
    state = { ...state, showHint: hintChk.checked };
    render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.target && (event.target.tagName === "SELECT" || event.target.tagName === "INPUT")) return;
    let [x, y] = focus;
    if (event.key === "ArrowLeft") x--;
    else if (event.key === "ArrowRight") x++;
    else if (event.key === "ArrowUp") y--;
    else if (event.key === "ArrowDown") y++;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCell(x, y);
      return;
    } else return;
    event.preventDefault();
    if (x < 0) x = state.cols - 1;
    if (y < 0) y = state.rows - 1;
    if (x >= state.cols) x = 0;
    if (y >= state.rows) y = 0;
    focus = [x, y];
    render();
    const el = boardEl.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (el) el.focus();
  });

  fillN();
  newGame();
})();
