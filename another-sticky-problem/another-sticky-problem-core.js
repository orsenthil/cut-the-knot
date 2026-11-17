"use strict";

/*
 * Another Sticky Problem - the logic, transcribed from the applet TwoStickStart.
 *
 * The game starts with two sticks, of lengths N and N+1. A move is either
 *
 *   - break one stick into two sticks of positive integer lengths, or
 *   - remove k sticks of length k, for some positive integer k.
 *
 * The player who makes the last move wins. The cut-the-knot page gives the
 * strategy: let A be the positions with an even number of sticks and at most
 * one stick of even length, and B the positions with an odd number of sticks
 * and at most two sticks of even length. The start and the empty position are
 * both in A, every move from A lands in B, and from every B there is a move
 * back to A. So the second player wins by always returning to A.
 *
 * The applet's rules, from TwoStickStartCanvas:
 *
 *   - a break clicks a square to the right of the break line (the first square
 *     of a longer stick is refused), and keeps both pieces;
 *   - a removal clicks a stick of length k and removes k sticks of that
 *     length, which needs at least k of them (TwoStickStartCanvas.FindAndRemove);
 *   - the computer's move is TwoStickStartCanvas.Play, a transcription of the
 *     A/B plan with random tie-breaks: SplitEvenOddly, SplitOneEven,
 *     SplitRandom, CanRemoveSize, FindAndRemoveSize and MakeRandomMove.
 *
 * The applet presents the two kinds of move as a radio choice ("from one
 * heap" / "n n-heaps") because a click has to mean one of them. This page
 * shows both at once instead: a click breaks, and a button removes.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, AnotherStickyProblemCore, so the page loads it
 * with a plain <script> and porting/check-another-sticky-problem.mjs loads it
 * in Node. Positions are plain data and functions never change what they are
 * given.
 */
const AnotherStickyProblemCore = (() => {
  // The panel's spinner: model 10, minimum 1, maximum 30.
  const MIN_N = 1;
  const MAX_N = 30;
  const DEFAULT_N = 10;

  function clampN(n) {
    const v = Math.trunc(Number(n));
    if (!Number.isFinite(v)) return DEFAULT_N;
    return Math.max(MIN_N, Math.min(MAX_N, v));
  }

  /** Is this a legal multiset of sticks for a game of this side? */
  function validSticks(sticks, n) {
    if (!Array.isArray(sticks)) return false;
    let total = 0;
    for (const v of sticks) {
      if (!Number.isInteger(v) || v < 1 || v > n + 1) return false;
      total += v;
    }
    return total <= 2 * n + 1;
  }

  /** A new game with sticks N and N+1, or a given position for tests. */
  function start(options) {
    const o = options || {};
    const n = clampN(o.n == null ? DEFAULT_N : o.n);
    const sticks = validSticks(o.sticks, n) ? o.sticks.slice() : [n, n + 1];
    return { n, sticks };
  }

  const totalSticks = (state) => state.sticks.length;
  const totalLength = (state) => state.sticks.reduce((a, b) => a + b, 0);
  const evenSticks = (state) => state.sticks.reduce((a, v) => a + (v % 2 === 0 ? 1 : 0), 0);

  /** Counts indexed by length, for the applet's N+1 slots. */
  function countsArray(state) {
    const counts = new Array(state.n + 1).fill(0);
    for (const v of state.sticks) counts[v - 1]++;
    return counts;
  }

  /** The same counts as { length: count }, for people and for the tutor. */
  function counts(state) {
    const out = {};
    for (const v of state.sticks) out[v] = (out[v] || 0) + 1;
    return out;
  }

  /**
   * A when the number of sticks is even and at most one is even length, B
   * when it is odd and at most two are even, null otherwise.
   */
  function classOf(state) {
    const total = state.sticks.length;
    const even = evenSticks(state);
    if (total % 2 === 0 && even <= 1) return "A";
    if (total % 2 === 1 && even <= 2) return "B";
    return null;
  }

  const isOver = (state) => state.sticks.length === 0;

  /** Every length k with at least k sticks of that length. */
  function removableLengths(state) {
    const c = countsArray(state);
    const out = [];
    for (let i = 0; i < c.length; i++) if (c[i] >= i + 1) out.push(i + 1);
    return out;
  }

  function canRemove(state, length) {
    if (!Number.isInteger(length) || length < 1) return false;
    return state.sticks.filter((v) => v === length).length >= length;
  }

  /** Break stick `index` into `at` and length - at. */
  function split(state, index, at) {
    if (!Number.isInteger(index) || index < 0 || index >= state.sticks.length) return null;
    const length = state.sticks[index];
    if (!Number.isInteger(at) || at < 1 || at >= length) return null;
    const sticks = state.sticks.slice();
    sticks.splice(index, 1, at, length - at);
    return { ...state, sticks };
  }

  /**
   * Remove `length` sticks of that length. When an index is given it must be
   * one of them; the clicked stick goes first, as the applet's does.
   */
  function remove(state, length, index) {
    if (!canRemove(state, length)) return null;
    const all = [];
    for (let i = 0; i < state.sticks.length; i++) if (state.sticks[i] === length) all.push(i);
    let chosen = all.slice(0, length);
    if (Number.isInteger(index) && state.sticks[index] === length) {
      chosen = [index].concat(all.filter((i) => i !== index).slice(0, length - 1));
    }
    return { ...state, sticks: state.sticks.filter((_, i) => !chosen.includes(i)) };
  }

  /** Every break, as { stick, length, at }. */
  function breakMoves(state) {
    const moves = [];
    for (let i = 0; i < state.sticks.length; i++) {
      const length = state.sticks[i];
      for (let at = 1; at < length; at++) moves.push({ type: "break", stick: i, length, at });
    }
    return moves;
  }

  /** Every legal removal, as { length, count }. */
  function removeMoves(state) {
    return removableLengths(state).map((length) => ({ type: "remove", length, count: length }));
  }

  function legalMoves(state) {
    return breakMoves(state).concat(removeMoves(state));
  }

  function move(state, m) {
    if (!state || !m) return null;
    if (m.type === "break") return split(state, m.stick, m.at);
    if (m.type === "remove") return remove(state, m.length, m.stick);
    return null;
  }

  /* ------------------------- the applet's computer, transcription by method */

  const firstIndex = (state, length) => state.sticks.indexOf(length);

  /** Pick a stick of length `length` (the applet's Split calls the first). */
  function splitAtFirst(state, length, a, random) {
    const index = firstIndex(state, length);
    if (index < 0) return null;
    const b = length - a;
    const at = random() < 0.5 ? a : b;
    const next = split(state, index, at);
    return next && { state: next, move: { type: "break", stick: index, length, at } };
  }

  /** TwoStickStartCanvas.SplitRandom: any stick of length > 1, at random. */
  function splitRandom(state, random) {
    const candidates = [];
    for (let i = 0; i < state.sticks.length; i++) if (state.sticks[i] > 1) candidates.push(i);
    if (!candidates.length) return null;
    const index = candidates[Math.floor(random() * candidates.length)];
    const length = state.sticks[index];
    const at = Math.floor(random() * (length - 2)) + 1;
    const next = split(state, index, at);
    return next && { state: next, move: { type: "break", stick: index, length, at } };
  }

  /**
   * TwoStickStartCanvas.SplitEvenOddly: pick an even stick (the first with
   * probability 1/2, otherwise the next one), and cut it into two odd pieces.
   */
  function splitEvenOddly(state, random) {
    const evens = [];
    for (let i = 0; i < state.sticks.length; i++) if (state.sticks[i] % 2 === 0) evens.push(i);
    if (!evens.length) return null;
    let index = null;
    for (const i of evens) {
      if (index === null) {
        index = i;
        if (random() < 0.5) break;
      } else {
        index = i;
        break;
      }
    }
    const length = state.sticks[index];
    const at = 2 * Math.floor(random() * (length / 2)) + 1;
    const next = split(state, index, at);
    return next && { state: next, move: { type: "break", stick: index, length, at } };
  }

  /**
   * TwoStickStartCanvas.SplitOneEven: cut one even stick into two odd pieces.
   * The applet loops over the even sticks, but it is called only when there is
   * exactly one, so this is the same move.
   */
  function splitOneEven(state, random) {
    const index = state.sticks.findIndex((v) => v % 2 === 0);
    if (index < 0) return null;
    const length = state.sticks[index];
    const at = 2 * Math.floor(random() * (length / 2)) + 1;
    const next = split(state, index, at);
    return next && { state: next, move: { type: "break", stick: index, length, at } };
  }

  /**
   * TwoStickStartCanvas.CanRemoveSize: a random length k with at least k
   * sticks of that length, or -1. Only calls the random source when there is
   * a choice, as the applet does.
   */
  function canRemoveSize(state, random) {
    const lengths = removableLengths(state);
    if (!lengths.length) return -1;
    return lengths[Math.floor(random() * lengths.length)];
  }

  /** TwoStickStartCanvas.FindAndRemoveSize: take k of length k, or split. */
  function findAndRemoveSize(state, length, random) {
    const indices = [];
    for (let i = 0; i < state.sticks.length && indices.length < length; i++) {
      if (state.sticks[i] === length) indices.push(i);
    }
    if (indices.length < length) return splitRandom(state, random);
    const sticks = state.sticks.filter((_, i) => !indices.includes(i));
    return {
      state: { ...state, sticks },
      move: { type: "remove", length, count: length },
    };
  }

  /** TwoStickStartCanvas.ThereIsSizeToSplit. */
  const thereIsSizeToSplit = (state) => state.sticks.some((v) => v > 1);

  /**
   * TwoStickStartCanvas.MakeRandomMove: try an exact k-of-length-k removal,
   * then an exact split, then remove the first available length (which itself
   * falls back to a random split when there are too few of that length).
   */
  function makeRandomMove(state, random) {
    const c = countsArray(state);
    for (let i = 1; i < c.length; i++) {
      if (c[i] === i + 1 && random() < 0.25) return findAndRemoveSize(state, i + 1, random);
    }
    for (let i = 1; i < c.length; i++) {
      if (c[i] === i + 1 && random() < 0.25) {
        const a = Math.floor(1 + random() * Math.abs(i - 1));
        return splitAtFirst(state, i + 1, a, random);
      }
    }
    for (let i = 0; i < c.length; i++) {
      if (c[i] > 0) return findAndRemoveSize(state, i + 1, random);
    }
    return null;
  }

  /**
   * TwoStickStartCanvas.Play, the computer's move. It follows the page's A/B
   * plan with random tie-breaks; `random` defaults to Math.random, and tests
   * pass a seeded source so a position can be replayed.
   */
  function computerMove(state, random) {
    const rnd = random || Math.random;
    if (isOver(state)) return null;
    // The helpers return { state, move }; the caller only wants the move.
    const asMove = (result) => (result ? result.move : null);
    const total = state.sticks.length;
    const even = evenSticks(state);
    if (total % 2 === 0) {
      if (even >= 2) return asMove(makeRandomMove(state, rnd));
      if (even === 1) return asMove(splitRandom(state, rnd));
      return asMove(makeRandomMove(state, rnd));
    }
    if (even > 2) return asMove(makeRandomMove(state, rnd));
    if (even === 2) return asMove(splitEvenOddly(state, rnd));
    if (even === 1) {
      const length = canRemoveSize(state, rnd);
      if (length === -1 || rnd() < 0.5) return asMove(splitOneEven(state, rnd));
      return asMove(findAndRemoveSize(state, length, rnd));
    }
    const length = canRemoveSize(state, rnd);
    const splittable = thereIsSizeToSplit(state);
    if (length === -1) {
      if (splittable) return asMove(splitRandom(state, rnd));
      return null;
    }
    if (!splittable) return asMove(findAndRemoveSize(state, length, rnd));
    return rnd() < 0.5 ? asMove(splitRandom(state, rnd)) : asMove(findAndRemoveSize(state, length, rnd));
  }

  /** The four fields the page and the tutor save, in one place. */
  function position(state) {
    return {
      n: state.n,
      sticks: state.sticks.slice(),
      totalSticks: state.sticks.length,
      totalLength: totalLength(state),
      evenSticks: evenSticks(state),
      counts: counts(state),
      class: classOf(state),
      removable: removableLengths(state),
      over: isOver(state),
    };
  }

  return {
    MIN_N, MAX_N, DEFAULT_N,
    clampN, validSticks, start,
    totalSticks, totalLength, evenSticks, countsArray, counts,
    classOf, isOver, removableLengths, canRemove,
    split, remove, breakMoves, removeMoves, legalMoves, move,
    computerMove,
    splitRandom, splitEvenOddly, splitOneEven, canRemoveSize,
    findAndRemoveSize, thereIsSizeToSplit, makeRandomMove,
    position,
  };
})();
