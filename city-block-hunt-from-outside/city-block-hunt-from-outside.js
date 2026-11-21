"use strict";

/*
 * Browser UI for City Block Hunt From Outside. All the rules live in
 * city-block-hunt-from-outside-core.js; this file only draws the board and takes input.
 *
 * The play area is an (N+2) by (N+2) grid: the N by N squares of the treasure
 * grid, with the four strips just outside its edges around them. Each cell is
 * a real button, so a mouse, a finger and the keyboard all work. Outside
 * strips show the clue number, just as the applet drew it in the touched
 * square; "Show hint" lights the squares still possible for the treasure.
 * The board scrolls sideways inside the stage when N is large enough that the
 * buttons would otherwise shrink below a fingertip.
 */

(function () {
  const Core = CityBlockHuntFromOutsideCore;
  const el = (id) => document.getElementById(id);
  const board = el("board");
  const boardText = el("boardText");
  const statusEl = el("status");
  const newBtn = el("newBtn");
  const nSpin = el("nSpin");
  const hintChk = el("hintChk");

  let state = null;

  /** Show a line under the game. "done" also tells the record the play ended. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const intro = "Touch a square just outside the grid to get a clue, or touch a square inside to look for the treasure.";
  const key = (col, row) => col + "," + row;

  /** Plain words for the four strips, for the status line and screen readers. */
  function stripName(col, row, n) {
    if (row < 0) return "the strip above column " + (col + 1);
    if (row >= n) return "the strip below column " + (col + 1);
    if (col < 0) return "the strip left of row " + (row + 1);
    return "the strip right of row " + (row + 1);
  }

  function squareName(col, row) {
    return "row " + (row + 1) + ", column " + (col + 1);
  }

  function treasureFound(done) {
    if (!done) return "The treasure is still hidden.";
    return "The treasure was in " + squareName(state.treasure.col, state.treasure.row) + ".";
  }

  /** The same board in words, for screen readers and the play scenario. */
  function boardWords() {
    const clues = state.clues.map((c) => "distance " + c.d + " from " + stripName(c.col, c.row, state.n));
    return "A " + state.n + " by " + state.n + " grid with a strip outside each edge. " +
      treasureFound(state.finished) + " " +
      (clues.length ? "Clues: " + clues.join("; ") + "." : "No clues yet.");
  }

  /** Rebuild the (N+2)^2 buttons from the current position. */
  function buildBoard() {
    board.style.setProperty("--cols", String(state.n + 2));
    board.replaceChildren();

    const possible = new Set();
    if (hintChk.checked) {
      for (const cell of Core.hintCells(state)) possible.add(key(cell.col, cell.row));
    }
    const clueAt = new Map();
    for (const clue of state.clues) clueAt.set(key(clue.col, clue.row), clue.d);

    for (let row = -1; row <= state.n; row++) {
      for (let col = -1; col <= state.n; col++) {
        const insideCol = col >= 0 && col < state.n;
        const insideRow = row >= 0 && row < state.n;
        if (!insideCol && !insideRow) {
          // The applet refuses the diagonal squares outside the corners.
          const corner = document.createElement("div");
          corner.className = "cell corner";
          corner.setAttribute("aria-hidden", "true");
          board.appendChild(corner);
          continue;
        }

        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.col = String(col);
        cell.dataset.row = String(row);

        if (insideCol && insideRow) {
          cell.classList.add("square");
          const found = state.finished && col === state.treasure.col && row === state.treasure.row;
          cell.setAttribute("aria-label", squareName(col, row) + (found ? ", treasure found" : ""));
          if (found) {
            cell.classList.add("treasure");
            cell.textContent = "\u2605";
          } else if (possible.has(key(col, row))) {
            cell.classList.add("hint");
          }
        } else {
          cell.classList.add("strip");
          cell.setAttribute("aria-label", stripName(col, row, state.n));
          const d = clueAt.get(key(col, row));
          if (d !== undefined) {
            cell.classList.add("clued");
            cell.textContent = String(d);
          }
        }
        cell.addEventListener("click", () => touch({ col, row }));
        board.appendChild(cell);
      }
    }
    boardText.textContent = boardWords();
  }

  /** Draw the position and hand it to the player's record and the tutor. */
  function render() {
    // Keep the keyboard's focus on the same square when the board is rebuilt.
    const active = document.activeElement;
    let focusKey = null;
    if (active && active.classList && active.classList.contains("cell") && active.dataset) {
      focusKey = key(active.dataset.col, active.dataset.row);
    }
    buildBoard();
    if (focusKey) {
      const again = board.querySelector('button.cell[data-col="' + focusKey.split(",")[0] +
        '"][data-row="' + focusKey.split(",")[1] + '"]');
      if (again) again.focus();
    }
    if (window.Track) window.Track.state(state);
  }

  function touch(m) {
    const next = Core.move(state, m);
    if (!next) {
      if (state.finished) say(treasureFound(true) + " Start a new game to hunt again.", "done");
      return;
    }
    const d = Core.taxicab(m.col, m.row, state.treasure);
    const won = next.finished;
    const clue = !won && Core.isOutside(state.n, m.col, m.row);
    state = next;
    render();
    if (won) {
      say("Found it! " + treasureFound(true) + " Start a new game to hunt again.", "done");
    } else if (clue) {
      say("Touch " + stripName(m.col, m.row, state.n) + ": the treasure is " + d +
        (d === 1 ? " city block" : " city blocks") + " away. The number is shown in that square." +
        (hintChk.checked ? " The lit squares are the ones that could hide it." : " Turn on Show hint to light them."));
    } else {
      say("That square is empty. Try the squares just outside the grid to get a clue.");
    }
  }

  function newGame() {
    const n = Core.clampN(Number(nSpin.value));
    nSpin.value = String(n);
    state = Core.start({ n });
    render();
    say(intro);
  }

  function changeN() {
    const n = Core.clampN(Number(nSpin.value));
    if (state && n === state.n && nSpin.value === String(n)) return;
    newGame();
  }

  // Arrow keys move a roving focus between touchable squares; Enter and Space
  // activate the focused button through the browser's own button behaviour.
  const ARROWS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  };
  board.addEventListener("keydown", (event) => {
    const cell = event.target.closest ? event.target.closest("button.cell") : null;
    const step = ARROWS[event.key];
    if (!cell || !step) return;
    event.preventDefault();
    const col = Number(cell.dataset.col) + step[0];
    const row = Number(cell.dataset.row) + step[1];
    const next = board.querySelector('button.cell[data-col="' + col + '"][data-row="' + row + '"]');
    if (next) next.focus();
  });

  newBtn.addEventListener("click", newGame);
  nSpin.addEventListener("input", changeN);
  nSpin.addEventListener("change", changeN);
  hintChk.addEventListener("change", render);

  newGame();
})();
