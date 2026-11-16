"use strict";

/*
 * Proizvolov's Identity, from Alexander Bogomolny's applet ProizvolovGame.
 *
 * From {1, 2, …, 2N} pick any N numbers. Sort the pick decreasing as
 * a1 > a2 > … > aN and the rest increasing as b1 < b2 < … < bN. Then
 *   |a1−b1| + |a2−b2| + … + |aN−bN| = N².
 *
 * The proof idea the page gives: in each pair {ai, bi} one value is ≤ N and
 * the other is > N, so the sum of absolute differences equals
 * (sum of {N+1..2N}) − (sum of {1..N}) = N².
 *
 * Options: N from 2 to 15 (default 5). Take back undoes the last pick.
 * This is a demo: finishing a selection shows the identity (outcome "done").
 */
const ProizvolovGameCore = (() => {
  const MIN_N = 2;
  const MAX_N = 15;
  const DEFAULT_N = 5;

  function clampN(n) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = DEFAULT_N;
    return Math.max(MIN_N, Math.min(MAX_N, n));
  }

  function start(options = {}) {
    const n = clampN(options.n ?? DEFAULT_N);
    const pool = [];
    for (let i = 1; i <= 2 * n; i++) pool.push(i);
    return {
      n,
      pool,
      picked: [], // selection order (for Take back)
      clue: !!options.clue,
      showAll: false,
    };
  }

  /** Selected numbers sorted decreasing (left column). */
  function left(state) {
    return state.picked.slice().sort((a, b) => b - a);
  }

  /** Remaining numbers sorted increasing (right column). Empty until N are picked. */
  function right(state) {
    if (state.picked.length < state.n) return [];
    const set = new Set(state.picked);
    const rest = [];
    for (let i = 1; i <= 2 * state.n; i++) if (!set.has(i)) rest.push(i);
    return rest.sort((a, b) => a - b);
  }

  function pairSum(state) {
    const a = left(state);
    const b = right(state);
    if (a.length !== state.n || b.length !== state.n) return null;
    let s = 0;
    for (let i = 0; i < state.n; i++) s += Math.abs(a[i] - b[i]);
    return s;
  }

  function expected(n) {
    return n * n;
  }

  function available(state) {
    const set = new Set(state.picked);
    return state.pool.filter((x) => !set.has(x));
  }

  function complete(state) {
    return state.picked.length === state.n;
  }

  function pick(state, value) {
    if (complete(state)) return state;
    value = Math.trunc(Number(value));
    if (!state.pool.includes(value) || state.picked.includes(value)) return state;
    const picked = state.picked.concat([value]);
    const next = Object.assign({}, state, { picked });
    if (picked.length === state.n) next.showAll = true;
    return next;
  }

  /** Take back last (Pop). Clears the finished display if it was showing. */
  function undo(state) {
    if (!state.picked.length) return state;
    const picked = state.picked.slice(0, -1);
    return Object.assign({}, state, {
      picked,
      showAll: false,
    });
  }

  function setClue(state, on) {
    return Object.assign({}, state, { clue: !!on });
  }

  /** "done" once N numbers are chosen; otherwise null. */
  function result(state) {
    return complete(state) ? "done" : null;
  }

  /**
   * For each pair, whether one side is in 1..N and the other in N+1..2N
   * (the page's key observation).
   */
  function pairsSplitLowHigh(state) {
    if (!complete(state)) return null;
    const a = left(state);
    const b = right(state);
    const out = [];
    for (let i = 0; i < state.n; i++) {
      const lo = Math.min(a[i], b[i]);
      const hi = Math.max(a[i], b[i]);
      out.push({ a: a[i], b: b[i], abs: hi - lo, split: lo <= state.n && hi > state.n });
    }
    return out;
  }

  function snapshot(state) {
    return {
      n: state.n,
      picked: state.picked.slice(),
      clue: state.clue,
      showAll: state.showAll,
    };
  }

  function restore(snap) {
    const n = clampN(snap.n);
    const pool = [];
    for (let i = 1; i <= 2 * n; i++) pool.push(i);
    const picked = (snap.picked || []).filter((v) => pool.includes(v)).slice(0, n);
    return {
      n,
      pool,
      picked,
      clue: !!snap.clue,
      showAll: picked.length === n || !!snap.showAll,
    };
  }

  return {
    MIN_N,
    MAX_N,
    DEFAULT_N,
    clampN,
    start,
    left,
    right,
    pairSum,
    expected,
    available,
    complete,
    pick,
    undo,
    setClue,
    result,
    pairsSplitLowHigh,
    snapshot,
    restore,
  };
})();
