"use strict";

/*
 * Solitaire in Two Colors - the logic, transcribed from the applet
 * TwoColorSolitaire.
 *
 * A deck of N cards is split into two halves: red cards 1..N/2 and blue cards
 * N/2+1..N. The halves are shuffled separately and then dealt alternately
 * round a circle, so red and blue always alternate. A move removes two
 * neighbouring cards of the same parity - both odd or both even - and the
 * circle closes up. Play ends when no such pair is left; the game is won when
 * every card is gone.
 *
 * The applet's rules, from TwoColorSolitaireCanvas.CheckClick:
 *
 *   - the clickable targets sit between consecutive cards on the circle;
 *   - the two cards on either side must have the same parity, otherwise the
 *     move is refused and the applet says which is odd and which is even;
 *   - a legal click removes the pair, and the circle closes.
 *
 * Because every neighbouring pair is one red and one blue card, removing a
 * pair of odds takes one odd red and one odd blue, so the differences
 *
 *   OrOb = (odd red) - (odd blue),  ErEb = (even red) - (even blue)
 *
 * never change. This is the invariant behind the magic trick: when N is a
 * multiple of 4 the two halves hold equally many odd and even cards, both
 * differences start at 0, and a stuck position is impossible. When N is even
 * but not a multiple of 4 the differences start at +2 and -2 (or the reverse)
 * and some sequences do get stuck.
 *
 * The applet has no win or loss test. This core adds both, so the player's
 * record can see the end of a round, and a stuck circle counts as a loss
 * (there is no move left; only a new deal can continue).
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, TwoColorSolitaireCore, so the page loads it
 * with a plain <script> and porting/check-two-color-solitaire.mjs loads it in
 * Node. Positions are plain data and functions never change what they are
 * given.
 */
const TwoColorSolitaireCore = (() => {
  // The panel's spinner: minimum 4, maximum 40, step 2, default 16.
  const MIN_N = 4;
  const MAX_N = 40;
  const DEFAULT_N = 16;

  /** The nearest even side in range, as the spinner would offer. */
  function clampN(n) {
    const v = Math.trunc(Number(n));
    if (!Number.isFinite(v)) return DEFAULT_N;
    const even = 2 * Math.round(v / 2);
    return Math.max(MIN_N, Math.min(MAX_N, even));
  }

  const colorOf = (n, value) => (value <= n / 2 ? "red" : "blue");
  const parityOf = (value) => (value % 2 === 0 ? "even" : "odd");

  /** Is `order` a permutation of 1..n? */
  function isPermutation(order, n) {
    if (!Array.isArray(order) || order.length !== n) return false;
    const seen = new Set();
    for (const v of order) {
      if (!Number.isInteger(v) || v < 1 || v > n || seen.has(v)) return false;
      seen.add(v);
    }
    return true;
  }

  /**
   * The deal the applet's Reset makes: red numbers first, blue second, laid
   * out alternately round the circle.
   */
  function canonicalOrder(n) {
    const order = [];
    for (let k = 0; k < n / 2; k++) order.push(k + 1, n / 2 + k + 1);
    return order;
  }

  /** A new position. `order` may be any permutation of 1..n (a shuffle). */
  function start(options) {
    const o = options || {};
    const n = clampN(o.n == null ? DEFAULT_N : o.n);
    const order = isPermutation(o.order, n) ? o.order.slice() : canonicalOrder(n);
    return { n, order };
  }

  /** The card values on either side of gap i (0-based, wrapping). */
  function pairAt(state, i) {
    const m = state.order.length;
    if (m < 2) return null;
    if (!Number.isInteger(i) || i < 0 || i >= m) return null;
    return { index: i, a: state.order[i], b: state.order[(i + 1) % m] };
  }

  /** The gaps where the two cards share a parity, in circle order. */
  function removable(state) {
    const m = state.order.length;
    if (m < 2) return [];
    const out = [];
    for (let i = 0; i < m; i++) {
      const a = state.order[i], b = state.order[(i + 1) % m];
      if (a % 2 === b % 2) out.push({ index: i, a, b });
    }
    return out;
  }

  /** The position after removing the pair at gap i, or null if not allowed. */
  function removePair(state, i) {
    const m = state.order.length;
    if (m < 2 || !Number.isInteger(i) || i < 0 || i >= m) return null;
    const a = state.order[i], b = state.order[(i + 1) % m];
    if (a % 2 !== b % 2) return null;
    const order = state.order.filter((_, j) => j !== i && j !== (i + 1) % m);
    return { ...state, order };
  }

  /** Does the circle alternate red and blue? True for every deal the applet makes. */
  function alternatesColors(state) {
    const m = state.order.length;
    for (let i = 0; i < m; i++) {
      const a = colorOf(state.n, state.order[i]);
      const b = colorOf(state.n, state.order[(i + 1) % m]);
      if (a === b) return false;
    }
    return true;
  }

  /** The four counts and their two differences: the invariant. */
  function invariant(state) {
    let oddRed = 0, oddBlue = 0, evenRed = 0, evenBlue = 0;
    for (const v of state.order) {
      const red = colorOf(state.n, v) === "red";
      if (v % 2 === 1) { if (red) oddRed++; else oddBlue++; }
      else { if (red) evenRed++; else evenBlue++; }
    }
    return {
      oddRed, oddBlue, evenRed, evenBlue,
      oddDifference: oddRed - oddBlue,
      evenDifference: evenRed - evenBlue,
    };
  }

  /** Is the game stuck: cards remain but no same-parity neighbours? */
  function stuck(state) {
    return state.order.length > 0 && removable(state).length === 0;
  }

  /** "win" when the circle is empty, "lose" when stuck. */
  function result(state) {
    if (state.order.length === 0) return "win";
    return stuck(state) ? "lose" : null;
  }

  function legalMoves(state) {
    if (state.order.length === 0 || stuck(state)) return [];
    return removable(state).map((p) => ({ type: "remove", index: p.index }));
  }

  function move(state, m) {
    if (!state || !m) return null;
    if (m.type === "remove") return removePair(state, m.index);
    return null;
  }

  return {
    MIN_N, MAX_N, DEFAULT_N,
    clampN, colorOf, parityOf, isPermutation, canonicalOrder,
    start, pairAt, removable, removePair, alternatesColors, invariant,
    stuck, result, legalMoves, move,
  };
})();
