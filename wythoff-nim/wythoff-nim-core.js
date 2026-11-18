"use strict";

/*
 * Wythoff's Nim, from Alexander Bogomolny's applet WythoffNim (Nim II).
 *
 * Two heaps of counters. A player removes any positive number from one heap,
 * or, with "two heaps" selected, the same number from both. The player who
 * takes the last counter wins. The applet fixes the first heap at the chosen
 * "Max heap size" (1..40) and gives the second a random size from 3 up to that
 * maximum, then lets the computer answer every human move.
 *
 * The key idea is the computer's table of cold positions (a_k, b_k), which it
 * uses to move to a pair whenever it can. The table below is the applet's own
 * array, copied from the bytecode: its last four entries are not the true
 * Wythoff pairs, and the computer's choices reproduce that. The page has no
 * formula to check, so the logic test checks the table against the golden-ratio
 * formula and says plainly which entries are wrong.
 *
 * No document, no window, no storage: one global, WythoffNimCore. The position
 * is plain data, so it can be saved and handed to the tutor as it is.
 */
const WythoffNimCore = (() => {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const MIN_MAX = 1;
  const MAX_MAX = 40;

  /** The applet's int[][] WythoffPairs, in bytecode order. */
  const PAIRS = [
    [0, 0], [1, 2], [3, 5], [4, 7], [6, 10], [8, 13], [9, 15], [11, 18],
    [12, 20], [14, 23], [16, 26], [17, 28], [19, 31], [21, 34], [22, 36],
    [24, 39], [25, 41], [27, 44], [29, 47], [30, 49], [32, 53], [33, 56],
    [35, 60], [37, 63],
  ];

  /** Java's (int) cast of a double: truncate toward zero. */
  const jint = (x) => Math.trunc(x);

  function clampMax(value) {
    const n = jint(Number(value));
    if (!Number.isFinite(n)) return 15;
    return Math.max(MIN_MAX, Math.min(MAX_MAX, n));
  }

  /** Applet's SetSquares: heap 0 is max; heap 1 is 3 + (int)(random*(max-2)). */
  function randomSecond(max, random) {
    return 3 + jint((random || Math.random)() * (max - 2));
  }

  /** The position a new game starts from. Pass `second` to fix the random heap. */
  function start(options) {
    const opts = options || {};
    const max = clampMax(opts.max === undefined ? 15 : opts.max);
    const second = Number.isInteger(opts.second)
      ? opts.second
      : randomSecond(max, opts.random || Math.random);
    return {
      max,
      heaps: [max, second],
      mode: opts.mode === "two" ? "two" : "one",
      turn: "you",
      moves: 0,
    };
  }

  /** Moves the player may make: leave `remaining` counters in a heap. */
  function legalMoves(state, mode) {
    const chosen = mode || state.mode;
    const out = [];
    for (let heap = 0; heap < 2; heap++) {
      for (let remaining = 0; remaining < state.heaps[heap]; remaining++) {
        out.push({ type: "one", heap, remaining });
      }
    }
    if (chosen === "two") {
      // Clicking a heap leaves `remaining` in it and removes that many from
      // both; the other heap must have enough, or the applet says "not allowed".
      for (let heap = 0; heap < 2; heap++) {
        for (let remaining = 0; remaining < state.heaps[heap]; remaining++) {
          if (state.heaps[1 - heap] >= state.heaps[heap] - remaining) {
            out.push({ type: "two", heap, remaining });
          }
        }
      }
    }
    return out;
  }

  /** The position after a move, with the turn passed on; null if not allowed. */
  function move(state, m) {
    if (!m) return null;
    const heaps = state.heaps.slice();
    if (m.type === "one") {
      if (!Number.isInteger(m.heap) || m.heap < 0 || m.heap > 1) return null;
      if (!Number.isInteger(m.remaining) || m.remaining < 0 || m.remaining >= heaps[m.heap]) return null;
      heaps[m.heap] = m.remaining;
    } else if (m.type === "two") {
      if (!Number.isInteger(m.heap) || m.heap < 0 || m.heap > 1) return null;
      if (!Number.isInteger(m.remaining) || m.remaining < 0 || m.remaining >= heaps[m.heap]) return null;
      const removed = heaps[m.heap] - m.remaining;
      if (heaps[1 - m.heap] < removed) return null; // "This move is not allowed!"
      heaps[0] -= removed;
      heaps[1] -= removed;
    } else if (m.type === "both") {
      const small = Math.min(heaps[0], heaps[1]);
      if (small <= 0 || !Number.isInteger(m.remaining) || m.remaining < 0 || m.remaining >= small) return null;
      const removed = small - m.remaining;
      heaps[0] -= removed;
      heaps[1] -= removed;
    } else {
      return null;
    }
    return {
      max: state.max,
      heaps,
      mode: state.mode,
      turn: state.turn === "you" ? "computer" : "you",
      moves: state.moves + 1,
    };
  }

  function isOver(state) {
    return state.heaps.every((n) => n === 0);
  }

  /** "win"/"lose" for the player who just moved, or null while play goes on. */
  function result(state) {
    if (!isOver(state)) return null;
    return state.turn === "computer" ? "win" : "lose";
  }

  /** The true Wythoff pair with difference k, from the golden ratio. */
  function truePair(k) {
    const a = Math.floor(k * PHI);
    return [a, a + k];
  }

  /** True when (a,b) is a cold position of the full game. */
  function cold(heaps) {
    const small = Math.min(heaps[0], heaps[1]);
    const diff = Math.max(heaps[0], heaps[1]) - small;
    return truePair(diff)[0] === small;
  }

  /** The applet's MakeMove: [big, small] after the move, or null for a random one. */
  function makeMove(big, small) {
    let idx = PAIRS.findIndex((p) => p[0] === small);
    if (idx !== -1) {
      if (big === PAIRS[idx][1]) return null; // a cold pair: no move to a pair
      if (big > PAIRS[idx][1]) return [PAIRS[idx][1], small];
    }
    idx = PAIRS.findIndex((p) => p[1] === small);
    if (idx !== -1) return [PAIRS[idx][0], PAIRS[idx][1]];
    const diff = big - small;
    // The applet indexes its 24-entry table with the difference. For diff >= 24
    // it would throw; here we fall back to a random move instead of crashing.
    if (diff >= PAIRS.length) return null;
    if (small > PAIRS[diff][0]) return [PAIRS[diff][1], PAIRS[diff][0]];
    return null;
  }

  /**
   * The applet's Play and MakeRandomMove, transcribed: when the heaps are
   * equal it removes both, when one is left it empties it, otherwise it uses
   * the pair table and only moves at random from a cold position.
   */
  function computerMove(state, random) {
    const rnd = random || Math.random;
    const a = state.heaps[0];
    const b = state.heaps[1];
    if (a === 0 && b === 0) return null;
    if (a === 0) return { type: "one", heap: 1, remaining: 0 };
    if (b === 0) return { type: "one", heap: 0, remaining: 0 };
    if (a === b) return { type: "both", remaining: 0 };

    const bigIdx = a >= b ? 0 : 1;
    const smallIdx = 1 - bigIdx;
    const plan = makeMove(a >= b ? a : b, a >= b ? b : a);
    if (plan) {
      return plan[1] === Math.min(a, b)
        ? { type: "one", heap: bigIdx, remaining: plan[0] }
        : { type: "both", remaining: plan[1] };
    }
    if (rnd() < 0.5) {
      const heap = rnd() < 0.5 ? bigIdx : smallIdx;
      return { type: "one", heap, remaining: jint(rnd() * state.heaps[heap]) };
    }
    return { type: "both", remaining: jint(rnd() * Math.min(a, b)) };
  }

  /** How the computer's move is described on the page (the applet's captions). */
  function describe(move) {
    if (!move) return "Nothing left to take.";
    if (move.type === "both") {
      return move.remaining === 0
        ? "The computer took the same number from both heaps."
        : `The computer left ${move.remaining} in each heap.`;
    }
    return move.remaining === 0
      ? `The computer emptied heap ${move.heap + 1}.`
      : `The computer left ${move.remaining} in heap ${move.heap + 1}.`;
  }

  return {
    PHI, PAIRS, MIN_MAX, MAX_MAX, clampMax, randomSecond, start, legalMoves, move,
    isOver, result, truePair, cold, makeMove, computerMove, describe,
  };
})();
