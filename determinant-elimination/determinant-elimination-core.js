"use strict";

/*
 * Determinant by Elimination: an original demo for the VP vs VNP path.
 *
 * The determinant has n! terms, but Gaussian elimination finds it in about
 * n^3/3 multiplications: subtract a multiple of one row from another to
 * make zeros below the diagonal. That row operation does not change the
 * determinant (and a row swap only flips its sign); once the matrix is
 * triangular, the determinant is the product of the diagonal.
 *
 * The same row operation does change the permanent, and no other trick is
 * known to tame it: that is the gap between the two that VP vs VNP is about.
 *
 * Arithmetic is exact, with fractions of BigInts written as strings "p/q".
 * steps(m) lists every stage: the matrix, the sign so far, what was done
 * and the multiplications and divisions used. This file defines one
 * global, DeterminantEliminationCore. The position is plain data.
 */
const DeterminantEliminationCore = (() => {
  const SIZES = [3, 4, 5, 6];

  /* ----------------------------------------------------- exact fractions */
  const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
  function frac(p, q = 1n) {
    if (q < 0n) { p = -p; q = -q; }
    const g = gcd(p, q) || 1n;
    return [p / g, q / g];
  }
  const fadd = (a, b) => frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
  const fsub = (a, b) => frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
  const fmul = (a, b) => frac(a[0] * b[0], a[1] * b[1]);
  const fdiv = (a, b) => frac(a[0] * b[1], a[1] * b[0]);
  const isZero = (a) => a[0] === 0n;
  const show = (a) => (a[1] === 1n ? String(a[0]) : `${a[0]}/${a[1]}`);
  const parse = (s) => { const [p, q] = String(s).split("/"); return frac(BigInt(p), BigInt(q || "1")); };

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** A matrix of whole numbers -4..9 for (n, seed). */
  function matrix(n, seed) {
    const r = rng(seed * 104729 + n);
    return Array.from({ length: n }, () => Array.from({ length: n }, () => String(Math.floor(r() * 14) - 4)));
  }

  /** Every stage of elimination. */
  function steps(m) {
    const n = m.length;
    let a = m.map((row) => row.map(parse)), sign = 1, ops = 0;
    const out = [{ m: a.map((r) => r.map(show)), sign, ops, what: "start" }];
    for (let c = 0; c < n; c++) {
      let p = c;
      while (p < n && isZero(a[p][c])) p++;
      if (p === n) { out.push({ m: a.map((r) => r.map(show)), sign, ops, what: `column ${c + 1} has no pivot: the determinant is 0`, zero: true }); return out; }
      if (p !== c) {
        a = a.slice(); [a[p], a[c]] = [a[c], a[p]]; sign = -sign;
        out.push({ m: a.map((r) => r.map(show)), sign, ops, what: `swap rows ${c + 1} and ${p + 1}`, rows: [c, p] });
      }
      for (let r = c + 1; r < n; r++) {
        if (isZero(a[r][c])) continue;
        const f = fdiv(a[r][c], a[c][c]);
        ops += 1 + (n - c - 1);
        a = a.slice();
        a[r] = a[r].map((v, k) => (k === c ? frac(0n) : k > c ? fsub(v, fmul(f, a[c][k])) : v));
        out.push({ m: a.map((row) => row.map(show)), sign, ops, what: `row ${r + 1} − (${show(f)}) × row ${c + 1}`, rows: [r, c], pivot: c });
      }
    }
    ops += n - 1;
    const det = a.reduce((acc, row, i) => fmul(acc, row[i]), frac(BigInt(sign)));
    out.push({ m: a.map((r) => r.map(show)), sign, ops, what: `multiply the diagonal: ${n - 1} more multiplications`, det: show(det), done: true });
    return out;
  }

  /** Permanent and determinant by the n! terms (exact). */
  function expand(m) {
    const n = m.length, a = m.map((row) => row.map(parse));
    let det = frac(0n), perm = frac(0n);
    const used = new Array(n).fill(false);
    const go = (i, prod, sign) => {
      if (i === n) { perm = fadd(perm, prod); det = sign > 0 ? fadd(det, prod) : fsub(det, prod); return; }
      let inv = 0;
      for (let j = 0; j < n; j++) {
        if (used[j]) continue;
        used[j] = true;
        go(i + 1, fmul(prod, a[i][j]), inv % 2 ? -sign : sign);
        used[j] = false;
        inv++;
      }
    };
    go(0, frac(1n), 1);
    return { det: show(det), perm: show(perm) };
  }

  /** Multiplications and divisions: elimination (with no swaps or zeros) and term by term. */
  const eliminationOps = (n) => { let t = n - 1; for (let c = 0; c < n; c++) t += (n - 1 - c) * (n - c); return t; };
  const factorial = (n) => { let f = 1n; for (let k = 2n; k <= BigInt(n); k++) f *= k; return f; };
  const expansionOps = (n) => factorial(n) * BigInt(Math.max(0, n - 1));

  function start(options = {}) {
    const n = SIZES.includes(Number(options.n)) ? Number(options.n) : 4;
    const seed = Number.isInteger(options.seed) && options.seed > 0 ? options.seed : 1;
    const total = steps(matrix(n, seed)).length;
    const k = Number.isInteger(options.step) ? Math.max(0, Math.min(total - 1, options.step)) : 0;
    return { n, seed, step: k };
  }
  const stages = (s) => steps(matrix(s.n, s.seed));
  const next = (s) => (s.step + 1 < stages(s).length ? { ...s, step: s.step + 1 } : null);
  const finish = (s) => ({ ...s, step: stages(s).length - 1 });
  const result = (s) => (s.step === stages(s).length - 1 ? "done" : null);

  return { SIZES, frac, parse, show, matrix, steps, expand, eliminationOps, expansionOps, factorial, start, stages, next, finish, result };
})();
