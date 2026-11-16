"use strict";

/*
 * Plainim, from Alexander Bogomolny's applet Plainim.
 *
 * A checkered board of rows × columns. Each cell holds at most one chip. A
 * move toggles cells in a single row: you must remove the leftmost selected
 * chip, and you may only add chips to its right. The player who takes the
 * last chip wins (or loses, in misère).
 *
 * Each row is a Nim heap written in binary (column = bit, left = high). A
 * legal move always lowers that heap, so the game is ordinary Nim. The
 * computer's MyMove / MakeRightMove / MakeRandomMove are transcribed from the
 * bytecode: XOR the heaps; if the nim-sum is non-zero, XOR that sum onto the
 * heap whose (heap & sum) is largest; otherwise pick a random legal mask on
 * the first non-empty row. Misère adds the applet's endgame when exactly one
 * heap is bigger than 1.
 *
 * Options: Columns 3–12 (default 5), Rows 2–12 (default 5), optional Misère.
 * Score (computer wins : losses) survives Reset, as in the applet.
 */
const PlainimCore = (() => {
  const MIN_COLS = 3;
  const MAX_COLS = 12;
  const DEFAULT_COLS = 5;
  const MIN_ROWS = 2;
  const MAX_ROWS = 12;
  const DEFAULT_ROWS = 5;

  /** Same power table the applet builds in the constructor. */
  const POWERS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];

  function clampCols(n) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = DEFAULT_COLS;
    return Math.max(MIN_COLS, Math.min(MAX_COLS, n));
  }

  function clampRows(n) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = DEFAULT_ROWS;
    return Math.max(MIN_ROWS, Math.min(MAX_ROWS, n));
  }

  /** Bit for board column `col` (0 = leftmost = highest bit). */
  function bitForCol(cols, col) {
    return POWERS[cols - col - 1];
  }

  /** Sum of the powers used for `cols` columns: 2^cols − 1. */
  function maxHeap(cols) {
    let s = 0;
    for (let i = 0; i < cols; i++) s += POWERS[i];
    return s;
  }

  /**
   * Applet Reset: each heap = 1 + (int)(Math.random() * (2^cols − 1)),
   * so every row starts non-empty and fits the board.
   */
  function randomHeaps(rows, cols, rnd) {
    const span = maxHeap(cols);
    const heaps = [];
    for (let r = 0; r < rows; r++) {
      heaps.push(1 + Math.trunc(rnd() * span));
    }
    return heaps;
  }

  function start(options = {}, rnd = Math.random) {
    const cols = clampCols(options.cols ?? DEFAULT_COLS);
    const rows = clampRows(options.rows ?? DEFAULT_ROWS);
    const misere = !!options.misere;
    let heaps;
    if (Array.isArray(options.heaps) && options.heaps.length === rows) {
      heaps = options.heaps.map((h) => Math.trunc(Number(h)) || 0);
    } else {
      heaps = randomHeaps(rows, cols, rnd);
    }
    return {
      cols,
      rows,
      misere,
      heaps,
      selected: 0,
      selectedRow: -1,
      turn: "you",
      over: false,
      winner: null,
      wins: options.wins | 0,
      losses: options.losses | 0,
      announce: null,
      error: null,
    };
  }

  function nimSum(state) {
    return state.heaps.reduce((x, h) => x ^ h, 0);
  }

  function anyChips(state) {
    return state.heaps.some((h) => h !== 0);
  }

  function cellHasChip(state, row, col) {
    return (state.heaps[row] & bitForCol(state.cols, col)) !== 0;
  }

  function cellSelected(state, row, col) {
    return state.selectedRow === row && (state.selected & bitForCol(state.cols, col)) !== 0;
  }

  /**
   * MakeMove's legality test, transcribed:
   *   S1 = power-index of the leftmost selected bit
   *   S2 = power-index of the leftmost chip in that row
   * Legal iff S2 != -1, S2 >= S1, and the row has a chip on bit S1
   * (so the leftmost selection is a removal).
   */
  function isLegalMask(heap, cols, mask) {
    if (!mask) return false;
    let s1 = -1;
    let s2 = -1;
    for (let col = 0; col < cols; col++) {
      const p = cols - col - 1;
      const bit = POWERS[p];
      if (s1 === -1 && (mask & bit) > 0) s1 = p;
      if (s2 === -1 && (heap & bit) > 0) s2 = p;
    }
    if (s2 === -1 || s2 < s1) return false;
    if ((POWERS[s1] & heap) === 0) return false;
    return true;
  }

  function isLegalSelection(state) {
    if (state.selectedRow < 0 || !state.selected) return false;
    return isLegalMask(state.heaps[state.selectedRow], state.cols, state.selected);
  }

  /** Toggle a cell into / out of the pending selection (CheckHit). */
  function toggle(state, row, col) {
    if (state.over || state.turn !== "you") return state;
    if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return state;
    const next = Object.assign({}, state, {
      heaps: state.heaps.slice(),
      error: null,
      announce: null,
    });
    if (next.selectedRow === -1) next.selectedRow = row;
    if (next.selectedRow !== row) {
      next.announce = "Selections must be in a single row!";
      return next;
    }
    const bit = bitForCol(next.cols, col);
    next.selected = next.selected ^ bit;
    if (next.selected === 0) next.selectedRow = -1;
    return next;
  }

  function clearSelection(state) {
    return Object.assign({}, state, { selected: 0, selectedRow: -1 });
  }

  /**
   * Who wins when the board has just become empty, matching CheckFinished:
   * `computerJustMoved` is the applet's m_bMyMove flag at that moment.
   */
  function finish(state, computerJustMoved) {
    const next = Object.assign({}, state, {
      heaps: state.heaps.slice(),
      over: true,
      selected: 0,
      selectedRow: -1,
      error: null,
    });
    let computerWins;
    if (computerJustMoved) {
      computerWins = !state.misere;
    } else {
      computerWins = !!state.misere;
    }
    if (computerWins) {
      next.wins = state.wins + 1;
      next.winner = "computer";
      next.announce = "I won! It's now " + next.wins + ":" + next.losses;
    } else {
      next.losses = state.losses + 1;
      next.winner = "you";
      next.announce = "Congratulations! You won! It's now " + next.wins + ":" + next.losses;
    }
    return next;
  }

  /**
   * Apply a validated mask on a row (human MakeMove, or the computer's reply).
   * Returns { ok:false, state } with the illegal message, or { ok:true, state }.
   */
  function applyMask(state, row, mask, byComputer) {
    if (!isLegalMask(state.heaps[row], state.cols, mask)) {
      return {
        ok: false,
        state: Object.assign({}, state, {
          heaps: state.heaps.slice(),
          selected: 0,
          selectedRow: -1,
          announce: "You can't do that!",
          error: "illegal",
        }),
      };
    }
    const heaps = state.heaps.slice();
    heaps[row] = heaps[row] ^ mask;
    let next = Object.assign({}, state, {
      heaps,
      selected: 0,
      selectedRow: -1,
      announce: null,
      error: null,
      turn: byComputer ? "you" : "computer",
    });
    if (!anyChips(next)) {
      next = finish(next, byComputer);
    }
    return { ok: true, state: next };
  }

  /** Human presses Make Move with the current selection. */
  function makeMove(state) {
    if (state.over || state.turn !== "you") return { ok: false, state };
    if (state.selectedRow < 0 || !state.selected) {
      return {
        ok: false,
        state: Object.assign({}, state, { announce: "You can't do that!", error: "illegal" }),
      };
    }
    return applyMask(state, state.selectedRow, state.selected, false);
  }

  /** MakeRightMove(nimSum): pick the row with the largest (heap & sum). */
  function makeRightMove(state, sum) {
    let best = 0;
    let row = 0;
    for (let r = 0; r < state.rows; r++) {
      const v = state.heaps[r] & sum;
      if (best < v) {
        best = v;
        row = r;
      }
    }
    return { row, mask: sum };
  }

  /**
   * MakeRandomMove: first non-empty row; start from its leftmost chip bit p,
   * then mask = p + (int)(random * p) ∈ [p, 2p).
   */
  function makeRandomMove(state, rnd) {
    let row = -1;
    for (let r = 0; r < state.rows; r++) {
      if (state.heaps[r] !== 0) {
        row = r;
        break;
      }
    }
    if (row < 0) return null;
    let mask = 0;
    for (let col = 0; col < state.cols; col++) {
      const bit = bitForCol(state.cols, col);
      if (state.heaps[row] & bit) {
        mask = bit;
        break;
      }
    }
    mask = mask + Math.trunc(rnd() * mask);
    return { row, mask };
  }

  /**
   * MyMove, including the misère endgame when exactly one heap is > 1:
   * leave that heap as 0 if the number of size-1 heaps is even, else as 1.
   */
  function chooseComputerMove(state, rnd = Math.random) {
    const sum = nimSum(state);
    if (state.misere) {
      let ones = 0;
      let zeros = 0;
      for (let r = 0; r < state.rows; r++) {
        if (state.heaps[r] === 1) ones++;
        else if (state.heaps[r] === 0) zeros++;
      }
      if (ones === state.rows - 1 - zeros) {
        let row = -1;
        let mask = 0;
        for (let r = 0; r < state.rows; r++) {
          if (state.heaps[r] > 1) {
            row = r;
            mask = ones % 2 !== 0 ? state.heaps[r] ^ 1 : state.heaps[r];
          }
        }
        if (row >= 0) return { row, mask };
      }
      if (sum !== 0) return makeRightMove(state, sum);
      return makeRandomMove(state, rnd);
    }
    if (sum !== 0) return makeRightMove(state, sum);
    return makeRandomMove(state, rnd);
  }

  function computerMove(state, rnd = Math.random) {
    if (state.over || state.turn !== "computer") return null;
    const pick = chooseComputerMove(state, rnd);
    if (!pick) return null;
    const applied = applyMask(state, pick.row, pick.mask, true);
    return applied.ok ? applied.state : null;
  }

  /** "win" / "lose" from the human's point of view, or null. */
  function result(state) {
    if (!state.over) return null;
    return state.winner === "you" ? "win" : "lose";
  }

  function snapshot(state) {
    return {
      cols: state.cols,
      rows: state.rows,
      misere: state.misere,
      heaps: state.heaps.slice(),
      turn: state.turn,
      over: state.over,
      winner: state.winner,
      wins: state.wins,
      losses: state.losses,
    };
  }

  function restore(snap) {
    return {
      cols: clampCols(snap.cols),
      rows: clampRows(snap.rows),
      misere: !!snap.misere,
      heaps: (snap.heaps || []).map((h) => Math.trunc(Number(h)) || 0),
      selected: 0,
      selectedRow: -1,
      turn: snap.turn === "computer" ? "computer" : "you",
      over: !!snap.over,
      winner: snap.winner || null,
      wins: snap.wins | 0,
      losses: snap.losses | 0,
      announce: null,
      error: null,
    };
  }

  /** Every legal (row, mask) from this position — for tests and the tutor. */
  function legalMoves(state) {
    if (state.over) return [];
    const out = [];
    const limit = maxHeap(state.cols);
    for (let row = 0; row < state.rows; row++) {
      for (let mask = 1; mask <= limit; mask++) {
        if (isLegalMask(state.heaps[row], state.cols, mask)) {
          out.push({ row, mask });
        }
      }
    }
    return out;
  }

  /** Winning replies: leave nim-sum 0 (normal play only). */
  function winningMoves(state) {
    if (state.misere) return [];
    const sum = nimSum(state);
    if (sum === 0) return [];
    return legalMoves(state).filter((m) => {
      const next = state.heaps[m.row] ^ m.mask;
      let x = 0;
      for (let r = 0; r < state.rows; r++) {
        x ^= r === m.row ? next : state.heaps[r];
      }
      return x === 0;
    });
  }

  return {
    MIN_COLS,
    MAX_COLS,
    DEFAULT_COLS,
    MIN_ROWS,
    MAX_ROWS,
    DEFAULT_ROWS,
    POWERS,
    bitForCol,
    maxHeap,
    start,
    nimSum,
    anyChips,
    cellHasChip,
    cellSelected,
    isLegalMask,
    isLegalSelection,
    toggle,
    clearSelection,
    makeMove,
    chooseComputerMove,
    computerMove,
    result,
    snapshot,
    restore,
    legalMoves,
    winningMoves,
  };
})();
