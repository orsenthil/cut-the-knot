"use strict";

/*
 * A geometric view of the Sieve of Eratosthenes, from Alexander Bogomolny's
 * applet PrimesFromTriangle (after a video by Javier Torres Suárez).
 *
 * Dots (r, k), 0 <= k <= r, fill a triangle of rows 0..99. The two edges
 * start marked. One step takes the next row r (from 2 on) and copies its
 * marks onto the two legs of an upside-down equilateral triangle hanging from
 * it: a marked dot (r, k), k >= 1, marks (r + k, k) (the row turned about its
 * left end) and its mirror image (r + k, r) (turned about its right end). The
 * applet's OneStep does exactly this, row by row.
 *
 * In the end a dot inside the triangle is marked exactly when gcd(r, k) > 1,
 * so the rows left untouched are the prime rows. The turns L(r, k) = (r + k, k)
 * and R(r, k) = (2r - k, r) keep the gcd; their inverses lead each dot up to
 * its top ancestors (0, g) and (g, g), or (2, 1) when g = 1.
 *
 * The position is plain data: { rows (visible, 10..100), step (the last row
 * processed, 1 = cleared, 99 = done), showPrimes, show: { descendants,
 * ancestors, siblings }, picked: [r, k] or null, frame: a row or null }.
 */
const PrimesFromTriangleCore = (() => {
  const MAX = 100, ROWS_MIN = 10, ROWS_MAX = 100, ROWS_START = 20;

  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };

  function start(options) {
    const o = options || {};
    const rows = Number.isInteger(o.rows) ? Math.max(ROWS_MIN, Math.min(ROWS_MAX, o.rows)) : ROWS_START;
    const step = Number.isInteger(o.step) ? Math.max(1, Math.min(MAX - 1, o.step)) : MAX - 1;
    const show = o.show || {};
    return {
      rows, step, showPrimes: !!o.showPrimes,
      show: { descendants: !!show.descendants, ancestors: !!show.ancestors, siblings: !!show.siblings },
      picked: null, frame: null,
    };
  }

  /** The marks after processing rows 2..step: marks[r][k] true for marked dots (edges included). */
  function marks(step) {
    const m = [];
    for (let r = 0; r < MAX; r++) { m.push(new Array(r + 1).fill(false)); m[r][0] = true; m[r][r] = true; }
    for (let r = 2; r <= step && r < MAX; r++) {
      for (let k = 1; k <= r; k++) {
        if (!m[r][k]) continue;
        const t = r + k;
        if (t < MAX) { m[t][k] = true; m[t][t - k] = true; }
      }
    }
    return m;
  }

  const edge = (r, k) => k === 0 || k === r;

  /** The applet's MarkSiblings: the dots (r, n g) of the row, g = gcd(r, k). (0, 0) has none: g = 0. */
  function siblings(r, k) {
    const g = gcd(r, k), out = [];
    if (g === 0) return out;
    for (let j = 0; j <= r; j += g) out.push([r, j]);
    return out;
  }

  /** The applet's MarkDescendants: the chains L^n(r, k) and R^n(r, k) inside the 100 rows. */
  function descendants(r, k) {
    const out = [];
    if (edge(r, k)) return out;
    for (let i = r + k; i < MAX; i += k) out.push([i, k]);
    const d = r - k;
    for (let i = r + d; i < MAX; i += d) out.push([i, i - d]);
    return out;
  }

  /** The applet's MarkAncestors, recursion and all: dots above reached by L^-1 and R^-1. */
  function ancestors(r, k, out = []) {
    if (edge(r, k)) return out;
    for (let i = r - k; i > 1; i -= k) {
      if (k <= i) {
        out.push([i, k]);
        if (i - k <= k) ancestors(i, k, out);
      }
    }
    const d = r - k;
    for (let i = r - d; i > 1; i -= d) {
      if (i - d >= 0) {
        out.push([i, i - d]);
        if (i - d <= d) ancestors(i, i - d, out);
      }
    }
    return out;
  }

  /** The top progenitors by the page's theorem: {(0, g), (g, g)} for g > 1, {(2, 1)} for g = 1. */
  function progenitors(r, k) {
    const g = gcd(r, k);
    return g > 1 ? [[0, g], [g, g]] : [[2, 1]];
  }

  /** What the picked dot lights up, as a map "r,k" -> "hit" | "sibling" | "descendant" | "ancestor". */
  function highlights(s) {
    const h = new Map();
    if (!s.picked) return h;
    const [r, k] = s.picked;
    if (s.show.siblings) for (const [i, j] of siblings(r, k)) h.set(`${i},${j}`, "sibling");
    if (s.show.descendants) for (const [i, j] of descendants(r, k)) h.set(`${i},${j}`, "descendant");
    if (s.show.ancestors) for (const [i, j] of ancestors(r, k)) h.set(`${i},${j}`, "ancestor");
    h.set(`${r},${k}`, "hit");
    return h;
  }

  /** The applet's One step (no change once row 99 is done). */
  const oneStep = (s) => ({ ...s, step: Math.min(MAX - 1, s.step + 1), frame: null });
  /** The applet's Clear: only the edges marked, ready for One step. */
  const clear = (s) => ({ ...s, step: 1, frame: null, picked: null });

  const isPrime = (n) => n > 1 && [...Array(Math.floor(Math.sqrt(n)) + 1).keys()].slice(2).every((d) => n % d);

  return { MAX, ROWS_MIN, ROWS_MAX, ROWS_START, gcd, start, marks, siblings, descendants, ancestors, progenitors, highlights, oneStep, clear, isPrime };
})();
