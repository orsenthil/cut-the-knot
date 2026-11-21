"use strict";

/*
 * Schuh's divisibility problem, from Alexander Bogomolny's applet Divisibility.
 *
 * Digits a(i,j) fill a rectangle of NV rows by NH columns. Read left to right,
 * each row is a decimal integer; read downwards, so is each column: NV + NH
 * numbers. If p is prime to 10 and all of those numbers but one are divisible by
 * p, then so is the last one. The proof: weight row i by 10^(NV-i) and add, or
 * weight column j by 10^(NH-j) and add. Both sums are the same number, because a
 * digit a(i,j) carries 10^(NH-j) * 10^(NV-i) in either. So one of the numbers is
 * a combination of the others, and since p is prime to every power of 10 it can
 * be divided out.
 *
 * The applet draws the random digits (0..9, a click raises one by 1 mod 10) and
 * lets the two sizes run from 2 to 8, opening on 3 columns by 2 rows (NH = 3,
 * NV = 2). The position is plain data; functions return new objects.
 */
const DivisibilityCore = (() => {
  const MIN_SIZE = 2;
  const MAX_SIZE = 8;
  const MIN_P = 2;
  const MAX_P = 99;

  const fit = (v, d) => (Number.isFinite(Number(v)) ? Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.trunc(Number(v)))) : d);

  /** A small seeded generator, so that a position can be remade from a seed. */
  function rng(seed) {
    let s = (Math.trunc(Number(seed)) || 1) >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  /** A new position with random digits (the applet's Reset). Options: cols, rows, p, seed, digits. */
  function start(options) {
    const o = options || {};
    const cols = fit(o.cols, 3), rows = fit(o.rows, 2);
    const next = rng(o.seed === undefined ? 12345 : o.seed);
    const digits = [];
    for (let i = 0; i < rows; i++) {
      digits.push([]);
      for (let j = 0; j < cols; j++) digits[i].push(Array.isArray(o.digits) && o.digits[i] && Number.isInteger(o.digits[i][j]) ? ((o.digits[i][j] % 10) + 10) % 10 : Math.floor(next() * 10));
    }
    const p = Number.isFinite(Number(o.p)) ? Math.max(MIN_P, Math.min(MAX_P, Math.trunc(Number(o.p)))) : 7;
    return { rows, cols, p, digits, moves: 0, explored: false };
  }

  /** The integers read along the rows, then down the columns, as BigInt-safe numbers (at most 8 digits). */
  const rowNumber = (s, i) => Number(s.digits[i].join(""));
  const colNumber = (s, j) => Number(s.digits.map((r) => r[j]).join(""));
  const rowNumbers = (s) => s.digits.map((_, i) => rowNumber(s, i));
  const colNumbers = (s) => s.digits[0].map((_, j) => colNumber(s, j));

  /** C = sum of 10^(rows-1-i) * (row i), D = sum of 10^(cols-1-j) * (column j): equal. */
  function combos(s) {
    let C = 0n, D = 0n;
    s.digits.forEach((_, i) => { C += 10n ** BigInt(s.rows - 1 - i) * BigInt(rowNumber(s, i)); });
    s.digits[0].forEach((_, j) => { D += 10n ** BigInt(s.cols - 1 - j) * BigInt(colNumber(s, j)); });
    return { C, D };
  }

  /** Which of the rows and columns are divisible by p: { rows:[bool], cols:[bool], count, total, notDivisible }. */
  function divisibility(s, p) {
    const q = p === undefined ? s.p : p;
    const r = rowNumbers(s).map((v) => v % q === 0), c = colNumbers(s).map((v) => v % q === 0);
    const all = r.concat(c);
    return { rows: r, cols: c, count: all.filter(Boolean).length, total: all.length, notDivisible: all.length - all.filter(Boolean).length };
  }

  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  /** True when p is prime to 10 (odd and not a multiple of 5), the condition the theorem needs. */
  const primeTo10 = (p) => gcd(p, 10) === 1;

  /** Moves: {type:"digit", i, j, value?} (no value: +1 mod 10), {type:"size", rows, cols}, {type:"p", value}, {type:"reset", seed}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "digit") {
      if (!(m.i >= 0 && m.i < s.rows && m.j >= 0 && m.j < s.cols)) return null;
      const v = m.value === undefined ? (s.digits[m.i][m.j] + 1) % 10 : Math.trunc(Number(m.value));
      if (!(v >= 0 && v <= 9)) return null;
      const digits = s.digits.map((r) => r.slice());
      digits[m.i][m.j] = v;
      return { ...s, digits, moves: s.moves + 1, explored: true };
    }
    if (m.type === "size") {
      const rows = Math.trunc(Number(m.rows)), cols = Math.trunc(Number(m.cols));
      if (!(rows >= MIN_SIZE && rows <= MAX_SIZE && cols >= MIN_SIZE && cols <= MAX_SIZE)) return null;
      return { ...start({ rows, cols, p: s.p, seed: m.seed }), moves: s.moves + 1, explored: s.explored };
    }
    if (m.type === "p") {
      const p = Math.trunc(Number(m.value));
      if (!(p >= MIN_P && p <= MAX_P)) return null;
      return { ...s, p, moves: s.moves + 1, explored: true };
    }
    if (m.type === "reset") return start({ rows: s.rows, cols: s.cols, p: s.p, seed: m.seed });
    return null;
  }

  const legalMoves = (s) => s.digits.flatMap((r, i) => r.map((_, j) => ({ type: "digit", i, j })));
  const result = (s) => (s.explored ? "done" : null);

  return { MIN_SIZE, MAX_SIZE, MIN_P, MAX_P, start, rowNumbers, colNumbers, combos, divisibility, primeTo10, move, legalMoves, result, gcd };
})();
