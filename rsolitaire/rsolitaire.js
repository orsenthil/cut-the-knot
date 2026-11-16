"use strict";

/*
 * Reverse Solitaire page: English board. Click a peg, then an empty hole two
 * steps away over another empty hole — the middle fills. Puzzle picker, Undo,
 * Reset match the applet's panel (no Design-your-own).
 */

(function () {
  const Core = RsolitaireCore;
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const puzzleSelect = document.getElementById("puzzleSelect");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const pegLine = document.getElementById("pegLine");

  let state = null;
  let focus = [3, 3];

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function fillSelect() {
    puzzleSelect.replaceChildren();
    Core.NAMES.forEach((name, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = name;
      puzzleSelect.appendChild(opt);
    });
    puzzleSelect.value = "6";
  }

  function render() {
    boardEl.replaceChildren();
    boardEl.style.setProperty("--n", String(Core.N));
    for (let i = 0; i < Core.N; i++) {
      for (let j = 0; j < Core.N; j++) {
        const v = state.board[i][j];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.dataset.i = String(i);
        btn.dataset.j = String(j);
        if (v === Core.OUT) {
          btn.classList.add("out");
          btn.disabled = true;
          btn.tabIndex = -1;
          btn.setAttribute("aria-hidden", "true");
        } else if (v === Core.PEG || v === Core.SELECTED) {
          btn.classList.add("peg");
          if (v === Core.SELECTED) btn.classList.add("selected");
          btn.setAttribute(
            "aria-label",
            "Peg at row " + (i + 1) + ", column " + (j + 1) + (v === Core.SELECTED ? ", selected" : ""),
          );
        } else {
          btn.classList.add("hole");
          btn.setAttribute("aria-label", "Empty hole at row " + (i + 1) + ", column " + (j + 1));
        }
        if (focus[0] === i && focus[1] === j && v !== Core.OUT) btn.classList.add("focus");
        if (!btn.disabled) btn.addEventListener("click", () => onCell(i, j));
        boardEl.appendChild(btn);
      }
    }
    undoBtn.disabled = state.history.length === 0 || state.won;
    pegLine.textContent = state.won
      ? "Solved."
      : Core.pegCount(state) + " peg" + (Core.pegCount(state) === 1 ? "" : "s") +
        " · " + state.history.length + " move" + (state.history.length === 1 ? "" : "s");
    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function onCell(i, j) {
    focus = [i, j];
    state = Core.click(state, i, j);
    if (state.won) say("Congratulations! You did it!", "win");
    else if (state.selected) say("Jump over an empty hole into another empty hole.");
    else say(state.history.length ? "Your move." : "Click a peg, then the hole it jumps to.");
    render();
  }

  function newGame() {
    state = Core.start({ gameNo: Number(puzzleSelect.value) });
    focus = state.gameNo === 7 || state.gameNo === 8 ? [2, 2] : [3, 3];
    say("Rebuild the " + state.name + " pattern by reverse-jumping.");
    render();
  }

  undoBtn.addEventListener("click", () => {
    state = Core.undo(state);
    say(state.history.length ? "Took back a jump." : "Click a peg, then the hole it jumps to.");
    render();
  });
  resetBtn.addEventListener("click", newGame);
  puzzleSelect.addEventListener("change", newGame);

  boardEl.addEventListener("keydown", (event) => {
    const [i, j] = focus;
    let ni = i;
    let nj = j;
    if (event.key === "ArrowUp") ni = i - 1;
    else if (event.key === "ArrowDown") ni = i + 1;
    else if (event.key === "ArrowLeft") nj = j - 1;
    else if (event.key === "ArrowRight") nj = j + 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (state.board[i][j] !== Core.OUT) onCell(i, j);
      return;
    } else return;
    event.preventDefault();
    for (let step = 0; step < Core.N; step++) {
      if (ni < 0) ni = Core.N - 1;
      if (nj < 0) nj = Core.N - 1;
      if (ni >= Core.N) ni = 0;
      if (nj >= Core.N) nj = 0;
      if (state.board[ni][nj] !== Core.OUT) break;
      if (event.key === "ArrowUp") ni--;
      else if (event.key === "ArrowDown") ni++;
      else if (event.key === "ArrowLeft") nj--;
      else if (event.key === "ArrowRight") nj++;
    }
    focus = [ni, nj];
    render();
    const el = boardEl.querySelector('[data-i="' + ni + '"][data-j="' + nj + '"]');
    if (el) el.focus();
  });

  fillSelect();
  newGame();
})();
