"use strict";

/*
 * City Block Hunt — the logic behind Alexander Bogomolny's applet CityBlockHunt.
 *
 * A treasure hides under one cell of an n by n grid (the applet's spinner runs
 * from 2 to 8 and opens at 4). Touch a cell and you learn the taxicab distance
 * from that cell to the treasure, |dc| + |dr|; touch the treasure itself and
 * the hunt ends. The page poses two questions: how many cells can you touch
 * and still be unsure (10 on a 4 by 4 board), and how few touches always
 * suffice (two, using two adjacent corners). This file holds the rules and the
 * deduction the clues allow; the page in city-block-hunt.js only draws them.
 *
 * The one idea the code relies on: a clue at cell A with value d rules out
 * every cell B whose distance from A is not d. The treasure must lie in the
 * intersection of those sets. Two cells that give the same distance to every
 * touched cell can never be told apart.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, CityBlockHuntCore, so the page loads it
 * with a plain <script> and porting/check-city-block-hunt.mjs loads it in Node.
 * The position is plain data (numbers, booleans, arrays, plain objects), so it
 * can be saved and handed to the tutor as it is. Functions take a position
 * and return a new one; they do not change what they are given.
 */
const CityBlockHuntCore = (() => {
  const N_MIN = 2; // the applet's SpinnerNumberModel(4, 2, 8, 1)
  const N_MAX = 8;
  const N_DEFAULT = 4;

  /** The spinner's integer, rounded and clamped to the applet's range. */
  function clampN(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return N_DEFAULT;
    return Math.max(N_MIN, Math.min(N_MAX, Math.round(n)));
  }

  /** Taxicab (city-block) distance between two grid cells. */
  function distance(a, b) {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }

  function inside(state, col, row) {
    return Number.isInteger(col) && Number.isInteger(row) &&
      col >= 0 && col < state.n && row >= 0 && row < state.n;
  }

  /**
   * The position a new game starts from. `options.n` is the board size.
   * `options.treasure` overrides the hidden cell and `options.random` the
   * source of chance, so a test can reproduce any layout exactly. The applet
   * picks each coordinate with (int)(Math.random()*N).
   */
  function start(options) {
    const opt = options || {};
    const n = clampN(opt.n === undefined ? N_DEFAULT : opt.n);
    const rand = typeof opt.random === "function" ? opt.random : Math.random;
    let treasure;
    if (opt.treasure && inside({ n }, opt.treasure.col, opt.treasure.row)) {
      treasure = { col: opt.treasure.col, row: opt.treasure.row };
    } else {
      treasure = { col: Math.floor(rand() * n), row: Math.floor(rand() * n) };
    }
    const grid = [];
    for (let col = 0; col < n; col++) grid.push(new Array(n).fill(0));
    return { n, treasure, grid, touches: 0, won: false, hint: !!opt.hint, last: null };
  }

  /** A new board of a different size, as the applet's spinner does. */
  function setN(state, n) {
    return start({ n, hint: state.hint });
  }

  /** Switch "Show hint" without disturbing the hunt. */
  function setHint(state, on) {
    return Object.assign({}, state, { hint: !!on });
  }

  /** The cells a player may still touch, in row-major order. */
  function legalMoves(state) {
    if (state.won) return [];
    const out = [];
    for (let row = 0; row < state.n; row++) {
      for (let col = 0; col < state.n; col++) {
        if (state.grid[col][row] === 0) out.push({ col, row });
      }
    }
    return out;
  }

  /**
   * Touch cell (col, row). Mirrors mouseClicked: out of the board is ignored,
   * a distance of 0 finds the treasure (stored as -1, the applet's chest),
   * any other distance is written into the cell as a clue. An already-touched
   * cell is left alone; the applet overwrites it with the same value.
   */
  function move(state, m) {
    if (!m || state.won || !inside(state, m.col, m.row)) return null;
    if (state.grid[m.col][m.row] !== 0) return state;
    const d = distance(m, state.treasure);
    const grid = state.grid.map((column) => column.slice());
    grid[m.col][m.row] = d === 0 ? -1 : d;
    return Object.assign({}, state, {
      grid,
      touches: state.touches + 1,
      won: d === 0,
      last: { col: m.col, row: m.row, d: d === 0 ? 0 : d },
    });
  }

  /** "win" once the treasure is found, otherwise null. There is no loss. */
  function result(state) {
    return state.won ? "win" : null;
  }

  /** The touched clue cells, in the applet's column-major drawing order. */
  function clues(state) {
    const out = [];
    for (let col = 0; col < state.n; col++) {
      for (let row = 0; row < state.n; row++) {
        const d = state.grid[col][row];
        if (d > 0) out.push({ col, row, d });
      }
    }
    return out;
  }

  /** Every cell still consistent with all the clues (the possible treasures). */
  function candidates(state) {
    if (state.won) return [{ col: state.treasure.col, row: state.treasure.row }];
    const cs = clues(state);
    const out = [];
    for (let col = 0; col < state.n; col++) {
      for (let row = 0; row < state.n; row++) {
        const cell = { col, row };
        if (cs.every((c) => distance(c, cell) === c.d)) out.push(cell);
      }
    }
    return out;
  }

  /**
   * One clue's candidates: untouched cells at the clue's distance from it.
   * Show hint in the applet draws a box round exactly these cells for each
   * clue, nesting the boxes as more clues arrive.
   */
  function clueCandidates(state, index) {
    const cs = clues(state);
    const clue = cs[index];
    if (!clue) return [];
    const out = [];
    for (let col = 0; col < state.n; col++) {
      for (let row = 0; row < state.n; row++) {
        if (state.grid[col][row] <= 0 && distance(clue, { col, row }) === clue.d) {
          out.push({ col, row });
        }
      }
    }
    return out;
  }

  /** The two adjacent corners the page recommends; the second at top-right. */
  const FIRST_CORNER = { col: 0, row: 0 };

  function adjacentCorner(n) {
    return { col: clampN(n) - 1, row: 0 };
  }

  /** The two corner touches the page recommends, with their distances. */
  function twoCornerPlan(n, treasure) {
    const first = FIRST_CORNER;
    const second = adjacentCorner(n);
    return {
      first: { col: first.col, row: first.row },
      second: { col: second.col, row: second.row },
      d1: distance(first, treasure),
      d2: distance(second, treasure),
    };
  }

  /** A sentence for #status; words, never just a tint or a number. */
  function describe(action, state) {
    const n = state.n;
    switch (action) {
      case "start":
        return "A treasure is hidden on the " + n + " by " + n +
          " grid. Touch a square to find out how far away it is.";
      case "touch": {
        if (state.won) {
          return "Found it! The treasure was in row " + (state.treasure.row + 1) +
            ", column " + (state.treasure.col + 1) + ", after " + state.touches +
            (state.touches === 1 ? " touch." : " touches.");
        }
        const last = state.last;
        const left = candidates(state).length;
        return last && last.d > 0
          ? "That square is " + last.d + " blocks from the treasure. " + left +
            (left === 1 ? " square could" : " squares could") + " still hide it."
          : describe("start", state);
      }
      case "determined":
        return "Only one square can hide the treasure now — touch it to finish the hunt.";
      case "hint":
        return state.hint
          ? "Hint on: the outlined squares are still possible hiding places."
          : "Hint off: the clues are on their own again.";
      case "n":
        return "A fresh " + n + " by " + n + " board. A treasure is hidden somewhere on it.";
      case "new":
        return "New game on the " + n + " by " + n +
          " grid. Touch any square to begin.";
      default:
        return "";
    }
  }

  return {
    N_MIN, N_MAX, N_DEFAULT, FIRST_CORNER,
    clampN, distance, start, setN, setHint, legalMoves, move, result,
    clues, candidates, clueCandidates, adjacentCorner, twoCornerPlan, describe,
  };
})();
