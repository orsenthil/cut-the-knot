"use strict";

/*
 * Browser page for the City Block Hunt treasure puzzle. All of the rules and
 * deductions live in city-block-hunt-core.js; this file only draws and listens.
 *
 * The play area is a grid of real buttons: a touch shows the distance clue in
 * that square, or a treasure mark when the hidden cell is found. "Show hint"
 * outlines the squares still consistent with each clue. Arrow keys move a
 * focus ring round the grid and Enter/Space touch a square, so the whole game
 * works without a mouse. Every change is reported in words in #status.
 */

(function () {
  const Core = CityBlockHuntCore;
  const el = (id) => document.getElementById(id);
  const stageEl = el("stage");
  const board = el("board");
  const statusEl = el("status");
  const nInput = el("nInput");
  const hintCheck = el("hintCheck");
  const newBtn = el("newBtn");

  let state = null;
  let shownN = -1;

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const cellId = (col, row) => "cell-" + col + "-" + row;
  const key = (c) => c.col + "," + c.row;

  /** Create the n by n buttons once per board size; render() updates them. */
  function buildBoard(n) {
    shownN = n;
    board.style.setProperty("--n", String(n));
    board.textContent = "";
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell " + ((col + row) % 2 ? "dark" : "light");
        btn.id = cellId(col, row);
        btn.dataset.col = String(col);
        btn.dataset.row = String(row);
        btn.addEventListener("click", () => touch({ col, row }));
        board.appendChild(btn);
      }
    }
    board.setAttribute("aria-label", n + " by " + n + " grid of squares to touch");
  }

  /** Update the squares and the hint marks without rebuilding the buttons. */
  function render() {
    if (shownN !== state.n) buildBoard(state.n);
    const candidates = new Set(Core.candidates(state).map(key));
    const marked = new Set();
    if (state.hint) {
      Core.clues(state).forEach((_, i) => {
        Core.clueCandidates(state, i).forEach((c) => marked.add(key(c)));
      });
    }
    for (let row = 0; row < state.n; row++) {
      for (let col = 0; col < state.n; col++) {
        const btn = el(cellId(col, row));
        const value = state.grid[col][row];
        const k = col + "," + row;
        btn.textContent = value < 0 ? "★" : value > 0 ? String(value) : "";
        btn.classList.toggle("clue", value > 0);
        btn.classList.toggle("found", value < 0);
        btn.classList.toggle("candidate", candidates.has(k));
        btn.classList.toggle("marked", marked.has(k));
        btn.setAttribute("aria-label",
          "Row " + (row + 1) + ", column " + (col + 1) + ", " +
          (value < 0 ? "treasure found" : value > 0
            ? value + (value === 1 ? " block" : " blocks") + " from the treasure"
            : "not touched"));
      }
    }
    nInput.value = String(state.n);
    hintCheck.checked = state.hint;

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function touch(m) {
    const next = Core.move(state, m);
    if (!next) return; // off the board, already touched, or the hunt is over
    state = next;
    render();
    if (Core.result(state) === "win") {
      say(Core.describe("touch", state), "win");
    } else if (Core.candidates(state).length === 1) {
      say(Core.describe("determined", state));
    } else {
      say(Core.describe("touch", state));
    }
  }

  function newGame(n, message) {
    state = Core.start({ n, hint: hintCheck.checked });
    buildBoard(state.n);
    render();
    say(message);
  }

  function requestedN() {
    return Core.clampN(nInput.value === "" ? Core.N_DEFAULT : Number(nInput.value));
  }

  nInput.addEventListener("input", () => {
    const n = requestedN();
    if (n === state.n) return;
    newGame(n, Core.describe("n", Core.start({ n })));
    nInput.value = String(n);
  });

  hintCheck.addEventListener("change", () => {
    state = Core.setHint(state, hintCheck.checked);
    render();
    say(Core.describe("hint", state));
  });

  newBtn.addEventListener("click", () => {
    newGame(requestedN(), Core.describe("new", state));
  });

  // Arrow keys move the focus ring around the grid; Enter/Space are the
  // button's own click. Focus always stays on a square of the board.
  board.addEventListener("keydown", (e) => {
    const btn = e.target.closest(".cell");
    if (!btn) return;
    let col = Number(btn.dataset.col);
    let row = Number(btn.dataset.row);
    switch (e.key) {
      case "ArrowLeft": col = Math.max(0, col - 1); break;
      case "ArrowRight": col = Math.min(state.n - 1, col + 1); break;
      case "ArrowUp": row = Math.max(0, row - 1); break;
      case "ArrowDown": row = Math.min(state.n - 1, row + 1); break;
      case "Home": col = 0; row = 0; break;
      case "End": col = state.n - 1; row = state.n - 1; break;
      default: return;
    }
    e.preventDefault();
    const next = el(cellId(col, row));
    if (next) next.focus();
  });

  // CSS reads the theme tokens itself; a redraw keeps the picture in step
  // when the site's theme toggle fires.
  window.addEventListener("themechange", render);

  stageEl.setAttribute("aria-label", "Treasure hunt grid");
  newGame(Core.N_DEFAULT, Core.describe("start", Core.start({})));
})();
