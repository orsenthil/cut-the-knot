"use strict";

/*
 * Signs in a Matrix, from Alexander Bogomolny's applet SwitchingSigns
 * (a problem from Peter Winkler's Mathematical Puzzles).
 *
 * A grid of whole numbers, with the sum of each row written at its right and
 * of each column below it. Clicking a sum reverses the sign of every number
 * in that row or column. The goal: make every row sum and every column sum
 * at least 0. It can always be done, and simply: keep flipping any line
 * whose sum is negative.
 *
 * The idea (a monovariant): flipping a line whose sum is -s (s > 0) changes
 * the total of all the numbers by +2s, so the total only grows. The grid can
 * only ever show the original numbers with some signs changed, and there
 * are finitely many such grids (at most 2^(m+n) sign choices), so the total
 * cannot grow for ever: the flipping must stop, and when it stops no sum is
 * negative.
 *
 * Transcribed from SwitchingSignsCanvas: Reset fills an M x N grid (4 x 5 to
 * start, 1..15 each way) with, for each cell, a coin toss between -10 + a
 * random 0..14 and -10 + a random 0..20; ProcessClick on a column sum or
 * a row sum flips that line (any line, negative or not).
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SwitchingSignsCore. The position is plain data.
 */
const SwitchingSignsCore = (() => {
  const SIZE = { min: 1, max: 15 };
  const DEFAULT = { rows: 4, cols: 5 };

  const clamp = (v, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(SIZE.min, Math.min(SIZE.max, n)) : d; };

  function start(options = {}) {
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    let nums;
    if (Array.isArray(options.nums)) nums = options.nums.map((r) => r.slice());
    else {
      const rows = clamp(options.rows ?? DEFAULT.rows, DEFAULT.rows), cols = clamp(options.cols ?? DEFAULT.cols, DEFAULT.cols);
      nums = Array.from({ length: rows }, () => Array.from({ length: cols }, () => (rnd() < 0.5 ? -10 + Math.trunc(rnd() * 15) : -10 + Math.trunc(rnd() * 21))));
    }
    return { nums, flips: 0 };
  }

  const rowSums = (s) => s.nums.map((r) => r.reduce((a, b) => a + b, 0));
  const colSums = (s) => s.nums[0].map((_, j) => s.nums.reduce((a, r) => a + r[j], 0));
  const total = (s) => rowSums(s).reduce((a, b) => a + b, 0);

  /** ProcessClick: flip row i ({row: i}) or column j ({col: j}). */
  function flip(s, m) {
    if (!m) return null;
    const nums = s.nums.map((r) => r.slice());
    if (Number.isInteger(m.row) && m.row >= 0 && m.row < nums.length) nums[m.row] = nums[m.row].map((x) => -x);
    else if (Number.isInteger(m.col) && m.col >= 0 && m.col < nums[0].length) nums.forEach((r) => { r[m.col] = -r[m.col]; });
    else return null;
    return { nums, flips: s.flips + 1 };
  }

  const solved = (s) => rowSums(s).every((x) => x >= 0) && colSums(s).every((x) => x >= 0);
  const result = (s) => (solved(s) ? "win" : null);

  /** The lines with a negative sum: the safe moves. */
  function negativeLines(s) {
    const out = [];
    rowSums(s).forEach((x, i) => { if (x < 0) out.push({ row: i, sum: x }); });
    colSums(s).forEach((x, j) => { if (x < 0) out.push({ col: j, sum: x }); });
    return out;
  }

  /** Keep flipping the first negative line until none is left; returns the moves. */
  function solve(s, max = 1e6) {
    let t = s; const moves = [];
    for (let k = 0; k < max; k++) {
      const neg = negativeLines(t);
      if (!neg.length) break;
      const m = neg[0].row !== undefined ? { row: neg[0].row } : { col: neg[0].col };
      moves.push(m);
      t = flip(t, m);
    }
    return { moves, end: t };
  }

  return { SIZE, DEFAULT, start, rowSums, colSums, total, flip, solved, result, negativeLines, solve };
})();
