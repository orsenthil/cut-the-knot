"use strict";

/*
 * The Subtraction Game, from Bogomolny's applet Subtraction (Moore's Nim).
 *
 * Several heaps of counters (minuends) and a fixed set of allowed subtractions
 * (subtrahends). A move subtracts one allowed number from one heap; only
 * non-negative results are legal, and the player with no move loses. The
 * computer calculates each heap's Grundy number by the mex rule and plays the
 * heap/subtraction that restores a zero Nim-sum — or moves at random when the
 * sum is already zero.
 *
 * The key idea is the Grundy table: for a subtraction set S,
 * g(0) = 0 and g(n) = mex{ g(n - s) : s in S, s <= n }. The position is losing
 * exactly when the XOR of the heap values g(n_i) is zero. The logic test checks
 * this against the classic case S = {1..s}, where g(n) = n mod (s+1), and
 * transcribes the applet's own move chooser over every option range.
 *
 * No document, no window, no storage: one global, SubtractionGameCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const SubtractionGameCore = (() => {
  const MIN_NUMS = 1;
  const MAX_NUMS = 12;
  const MIN_SUBS = 1;
  const MAX_SUBS = 8;
  const MIN_MAX = 10;
  const MAX_MAX = 100;
  const MIN_SUB = 1;
  const MAX_SUB = 9;

  const clamp = (value, low, high, fallback) => {
    const v = Math.trunc(Number(value));
    if (!Number.isFinite(v)) return fallback;
    return Math.max(low, Math.min(high, v));
  };
  const clampNums = (v) => clamp(v, MIN_NUMS, MAX_NUMS, 20);
  const clampSubs = (v) => clamp(v, MIN_SUBS, MAX_SUBS, 3);
  const clampMax = (v) => clamp(v, MIN_MAX, MAX_MAX, 20);

  /** The applet sorts its subtrahends before using them. */
  function sortedSubs(subs) {
    return subs.slice().sort((a, b) => a - b);
  }

  /** Grundy numbers g(0)..g(max) for this subtraction set, by the mex rule. */
  function grundy(subs, max) {
    const small = sortedSubs(subs);
    const table = Array(max + 1).fill(0);
    for (let n = 1; n <= max; n++) {
      const seen = new Set();
      for (const s of small) {
        if (n >= s) seen.add(table[n - s]);
      }
      let g = 0;
      while (seen.has(g)) g++;
      table[n] = g;
    }
    return table;
  }

  function tableFor(state) {
    const limit = Math.max(state.max || 0, ...state.nums, 0);
    return grundy(state.subs, limit);
  }

  function nimSum(state, table) {
    const values = table || tableFor(state);
    return state.nums.reduce((sum, n) => sum ^ values[n], 0);
  }

  /** A fresh board: N random minuends, and subtrahends 1..NSubs. */
  function start(options) {
    const opts = options || {};
    const nnums = clampNums(opts.nnums === undefined ? 20 : opts.nnums);
    const nsubs = clampSubs(opts.nsubs === undefined ? 3 : opts.nsubs);
    const max = clampMax(opts.max === undefined ? 20 : opts.max);
    const random = opts.random || Math.random;
    const subs = opts.subs
      ? sortedSubs(opts.subs.map((s) => clamp(s, MIN_SUB, MAX_SUB, 1)))
      : Array.from({ length: nsubs }, (_, i) => i + 1);
    const nums = Array.from({ length: nnums }, () => Math.floor(random() * max) + 1);
    return {
      nnums, nsubs, max, nums, subs,
      turn: "you", winner: null, moves: 0,
    };
  }

  function legalMoves(state) {
    if (state.winner) return [];
    const out = [];
    for (let heap = 0; heap < state.nums.length; heap++) {
      for (const sub of state.subs) {
        if (state.nums[heap] >= sub) out.push({ heap, sub });
      }
    }
    return out;
  }

  function isFinished(state) {
    return legalMoves(state).length === 0;
  }

  /** Subtract `sub` from `heap`. A move that would go negative is refused. */
  function move(state, m) {
    if (!m || state.winner) return null;
    if (!Number.isInteger(m.heap) || m.heap < 0 || m.heap >= state.nums.length) return null;
    if (!state.subs.includes(m.sub) || state.nums[m.heap] < m.sub) return null;
    const nums = state.nums.slice();
    nums[m.heap] -= m.sub;
    const next = {
      ...state, nums, turn: state.turn === "you" ? "computer" : "you",
      moves: state.moves + 1,
    };
    if (isFinished(next)) next.winner = state.turn; // the player with no reply loses
    return next;
  }

  function result(state) {
    if (!state.winner) return null;
    return state.winner === "you" ? "win" : "lose";
  }

  /** The applet's MakeRandomMove: a random legal heap, then a random sub. */
  function makeRandomMove(state, random) {
    const small = sortedSubs(state.subs)[0];
    const heaps = [];
    for (let i = 0; i < state.nums.length; i++) {
      if (state.nums[i] >= small) heaps.push(i);
    }
    if (!heaps.length) return null;
    const heap = heaps[Math.floor(random() * heaps.length)];
    const usable = state.subs.filter((s) => state.nums[heap] >= s);
    if (!usable.length) return null;
    const sub = usable[Math.floor(random() * usable.length)];
    return { heap, sub };
  }

  /** MakeGoodMove: find a heap and sub that restore a zero Nim-sum. */
  function makeGoodMove(state, xor) {
    const table = tableFor(state);
    for (let heap = 0; heap < state.nums.length; heap++) {
      const size = state.nums[heap];
      if (size === 0) continue;
      const target = table[size] ^ xor;
      for (const sub of sortedSubs(state.subs)) {
        if (size >= sub && table[size - sub] === target) return { heap, sub };
      }
    }
    return null;
  }

  /** Play: use the nim-sum when it is non-zero, otherwise move at random. */
  function computerMove(state, random) {
    const rnd = random || Math.random;
    const xor = nimSum(state);
    const choice = xor !== 0 ? makeGoodMove(state, xor) : null;
    const m = choice || makeRandomMove(state, rnd);
    if (!m) return null;
    const next = move(state, m);
    if (!next) return null;
    return {
      move: m,
      state: next,
      nimSumBefore: xor,
      nimSumAfter: nimSum(next),
      good: Boolean(choice),
      description: `The computer subtracted ${m.sub} from minuend ${m.heap + 1}.`,
    };
  }

  function describe(m) {
    return `Subtract ${m.sub} from minuend ${m.heap + 1}`;
  }

  return {
    MIN_NUMS, MAX_NUMS, MIN_SUBS, MAX_SUBS, MIN_MAX, MAX_MAX, MIN_SUB, MAX_SUB,
    clampNums, clampSubs, clampMax, sortedSubs, grundy, nimSum, start,
    legalMoves, isFinished, move, result, makeRandomMove, makeGoodMove,
    computerMove, describe,
  };
})();
