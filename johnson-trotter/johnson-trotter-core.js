"use strict";

/*
 * Johnson–Trotter Algorithm, from Bogomolny's applet JohnsonTrotter.
 *
 * Each number carries a direction, left or right. A number is mobile when it
 * is greater than its neighbour in the direction it looks. Repeatedly swap
 * the largest mobile number with that neighbour and reverse the directions of
 * all larger numbers. The result lists all n! permutations, with successive
 * ones differing by a single adjacent swap (a minimal-change order).
 *
 * The key idea is that only the largest mobile number can move, so the
 * algorithm never repeats a permutation and stops at <2 <1 3> ... n>. The
 * logic test checks the count, uniqueness, adjacent transpositions and the
 * final state exhaustively for small n.
 *
 * No document, no window, no storage: one global, JohnsonTrotterCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const JohnsonTrotterCore = (() => {
  const MIN_N = 1;
  const MAX_N = 7;

  const clamp = (v, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(MIN_N, Math.min(MAX_N, n)) : fb;
  };

  function start(n) {
    const size = clamp(n, 4);
    return {
      n: size,
      items: Array.from({ length: size }, (_, i) => ({ value: i + 1, dir: -1 })),
      steps: 0,
    };
  }

  function mobile(state, index) {
    const items = state.items;
    if (index < 0 || index >= items.length) return false;
    const item = items[index];
    const other = items[index + item.dir];
    if (!other) return false;
    return item.value > other.value;
  }

  function largestMobile(state) {
    let best = -1;
    state.items.forEach((item, i) => {
      if (mobile(state, i) && (best < 0 || item.value > state.items[best].value)) best = i;
    });
    return best;
  }

  function permutation(state) {
    return state.items.map((i) => i.value);
  }

  function step(state) {
    const index = largestMobile(state);
    if (index < 0) return state;
    const k = state.items[index].value;
    const items = state.items.map((item) => ({ ...item }));
    const other = index + items[index].dir;
    [items[index], items[other]] = [items[other], items[index]];
    for (const item of items) if (item.value > k) item.dir = -item.dir;
    return { ...state, items, steps: state.steps + 1 };
  }

  /** Generate all n! permutations together with the adjacent swap made. */
  function generate(n, limit = 100000) {
    let state = start(n);
    const out = [{ permutation: permutation(state), swapped: null }];
    while (out.length < limit) {
      const previous = permutation(state);
      const next = step(state);
      if (next === state) break;
      state = next;
      const now = permutation(state);
      const at = now.findIndex((v, i) => v !== previous[i]);
      out.push({ permutation: now, swapped: [at, at + 1] });
    }
    return out;
  }

  function isAdjacentTransposition(a, b) {
    const at = a.findIndex((v, i) => v !== b[i]);
    if (at < 0) return false;
    const other = a.findIndex((v, i) => i !== at && v !== b[i]);
    return other === at + 1 &&
      a[at] === b[at + 1] && a[at + 1] === b[at] &&
      a.every((v, i) => i === at || i === at + 1 || v === b[i]);
  }

  function setN(state, value) {
    return start(clamp(value, state.n));
  }

  function analyze(state) {
    return {
      n: state.n,
      permutation: permutation(state),
      directions: state.items.map((i) => i.dir),
      largestMobile: largestMobile(state),
      finished: largestMobile(state) < 0,
      steps: state.steps,
    };
  }

  return { MIN_N, MAX_N, clamp, start, mobile, largestMobile, permutation, step, generate, isAdjacentTransposition, setN, analyze };
})();
