"use strict";

/*
 * The Minimax Principle, from Alexander Bogomolny's applet MinMax.
 *
 * A table of whole numbers A[i][k] (rows i, columns k). B[i] is the smallest
 * number in row i, C[k] the largest in column k. MaxMin = max of the B[i] and
 * MinMax = min of the C[k]. The statement: MaxMin <= MinMax, with equality
 * exactly when some entry is at once the largest in its column and the
 * smallest in its row (a saddle point).
 *
 * The applet's table has 2..12 rows (3 to begin with) and 2..12 columns (5),
 * each entry a random whole number from 0 up to a "Max" (2..20, 10 to begin with,
 * exclusive); an entry can be raised or lowered by one at a time without limit.
 * The position is plain data: { rows, cols, max, values }.
 */
const MinMaxCore = (() => {
  const MIN_SIZE = 2, MAX_SIZE = 12, MIN_MAX = 2, MAX_MAX = 20;
  const DEFAULT_ROWS = 3, DEFAULT_COLS = 5, DEFAULT_MAX = 10;

  const clamp = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || d));

  /** A table of random whole numbers 0 .. max-1. */
  function start(options) {
    const o = options || {}, random = o.random || Math.random;
    const rows = clamp(o.rows, MIN_SIZE, MAX_SIZE, DEFAULT_ROWS), cols = clamp(o.cols, MIN_SIZE, MAX_SIZE, DEFAULT_COLS), max = clamp(o.max, MIN_MAX, MAX_MAX, DEFAULT_MAX);
    return { rows, cols, max, values: Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.floor(random() * max))) };
  }

  /** The smallest number in each row (the blue column). */
  const rowMins = (s) => s.values.map((r) => Math.min(...r));
  /** The largest number in each column (the blue row). */
  const colMaxes = (s) => Array.from({ length: s.cols }, (_, k) => Math.max(...s.values.map((r) => r[k])));

  /** Everything the page shows: the blue row and column, MaxMin, MinMax and the saddle points. */
  function analyse(s) {
    const B = rowMins(s), C = colMaxes(s), maxMin = Math.max(...B), minMax = Math.min(...C);
    const saddles = [];
    if (maxMin === minMax) for (let i = 0; i < s.rows; i++) for (let k = 0; k < s.cols; k++) if (C[k] === minMax && B[i] === maxMin) saddles.push([i, k]);
    return { rowMins: B, colMaxes: C, maxMin, minMax, saddles, equal: maxMin === minMax };
  }

  /** Add delta (+1 or -1) to one entry. null for no such entry. */
  function change(s, i, k, delta) {
    if (!Number.isInteger(i) || !Number.isInteger(k) || i < 0 || k < 0 || i >= s.rows || k >= s.cols || !Number.isFinite(delta)) return null;
    return { ...s, values: s.values.map((r, ii) => (ii === i ? r.map((v, kk) => (kk === k ? v + Math.sign(delta) : v)) : r)) };
  }

  /** The Reset button: new random numbers, same size and Max. */
  const refresh = (s, random) => start({ rows: s.rows, cols: s.cols, max: s.max, random });

  /** A change of size or Max rebuilds the table. */
  const resize = (s, o, random) => start({ rows: o.rows === undefined ? s.rows : o.rows, cols: o.cols === undefined ? s.cols : o.cols, max: o.max === undefined ? s.max : o.max, random });

  return { MIN_SIZE, MAX_SIZE, MIN_MAX, MAX_MAX, DEFAULT_ROWS, DEFAULT_COLS, DEFAULT_MAX, start, rowMins, colMaxes, analyse, change, refresh, resize };
})();
