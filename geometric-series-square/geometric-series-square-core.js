"use strict";

/*
 * Geometric Series in a Square, from Alexander Bogomolny's applet
 * SequencesSquare: three proofs without words.
 *
 * A unit square is cut again and again, and at every step one kind of piece
 * is shaded:
 *   2: halve the square and shade one half, halve the other half and shade
 *      one of those, ...: 1/2 + 1/4 + 1/8 + ... = 1 (Warren Page);
 *   3: cut a square into 3 x 3, shade the three cells below the diagonal's
 *      cells, and repeat in each of the three diagonal cells:
 *      1/3 + 1/9 + 1/27 + ... = 1/2;
 *   4: cut into quarters, shade the bottom-left one and repeat in the
 *      top-right one: 1/4 + 1/16 + ... = 1/3 (Sunday A. Ajose).
 *
 * The idea: each step shades the same fraction r of what was left unshaded
 * before (1/2 of the rest, or a third), so after k steps the shaded area is
 * r + r^2 + ... + r^k = r(1 - r^k)/(1 - r), and the shaded part can be seen
 * to approach the whole (2), a half (3: the diagonal's two sides match) or a
 * third (4: the three quarter-copies match).
 *
 * The pieces are produced in the applet's order (SequencesSquareCanvas's
 * Reset, OneStep and the Split of DRect, TriSquare and FourSquare), with the
 * square from (0, 0) to (1, 1), y pointing down. N runs from 1 to 20; N = 1
 * is the bare square, and each further N is one more step. The 3 x 3 picture
 * triples its pieces every step, so past MAX_DRAWN_DEPTH it is only computed,
 * not cut (its pieces would be far below a pixel).
 *
 * This file is the game's logic and nothing else. It defines one global,
 * GeometricSeriesSquareCore. The position is plain data.
 */
const GeometricSeriesSquareCore = (() => {
  const KINDS = [2, 3, 4];
  const MIN_N = 1, MAX_N = 20;
  const MAX_DRAWN_DEPTH = { 2: 20, 3: 6, 4: 20 };

  const sq = (x, y, w, h, painted = false) => ({ x, y, w, h, painted });

  /** DRect.Split: a square splits into a shaded left half and its right half; a tall rectangle into a shaded bottom half and its top. */
  function splitRect(r) {
    if (r.w === r.h) return [sq(r.x, r.y, r.w / 2, r.h, true), sq(r.x + r.w / 2, r.y, r.w / 2, r.h)];
    return [sq(r.x, r.y + r.h / 2, r.w, r.h / 2, true), sq(r.x, r.y, r.w, r.h / 2)];
  }

  /** TriSquare.Split: [0] the three shaded cells (left-middle, left-bottom, bottom-middle), [1] the diagonal cells. */
  function splitTri(r) {
    const a = r.w / 3, b = r.h / 3;
    return [
      [sq(r.x, r.y + b, a, b, true), sq(r.x, r.y + 2 * b, a, b, true), sq(r.x + a, r.y + 2 * b, a, b, true)],
      [sq(r.x, r.y, a, b), sq(r.x + a, r.y + b, a, b), sq(r.x + 2 * a, r.y + 2 * b, a, b)],
    ];
  }

  /** FourSquare.Split: pushed bottom-left (shaded), bottom-right, top-left, top-right (split next). */
  function splitFour(r) {
    const a = r.w / 2, b = r.h / 2;
    return [sq(r.x, r.y + b, a, b, true), sq(r.x + a, r.y + b, a, b), sq(r.x, r.y, a, b), sq(r.x + a, r.y, a, b)];
  }

  /** OneStep on the stack V (an array, top at the end). */
  function oneStep(kind, V) {
    if (kind === 2) {
      const [a, b] = splitRect(V.pop());
      V.push(a, b);
    } else if (kind === 4) {
      V.push(...splitFour(V.pop()));
    } else {
      const L1 = [], L2 = [], L3 = [];
      while (V.length && !V[V.length - 1].painted) {
        const s = V.pop();
        L1.push(s);
        const parts = splitTri(s);
        for (let i = 0; i < 3; i++) { L2.push(parts[0][i]); L3.push(parts[1][i]); }
      }
      while (L1.length) V.push(L1.pop());
      while (L2.length) V.push(L2.pop());
      while (L3.length) V.push(L3.pop());
    }
  }

  function clampN(n) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.max(MIN_N, Math.min(MAX_N, v)) : MIN_N;
  }

  /** Upgrade: Reset, then N - 1 steps. */
  function start(options = {}) {
    const kind = KINDS.includes(Number(options.kind)) ? Number(options.kind) : 2;
    return { kind, n: clampN(options.n ?? 1) };
  }

  /** The pieces to draw, in the applet's order (drawn first to last). */
  function pieces(state) {
    const V = [sq(0, 0, 1, 1)];
    const steps = Math.min(state.n - 1, MAX_DRAWN_DEPTH[state.kind]);
    for (let i = 0; i < steps; i++) oneStep(state.kind, V);
    return V;
  }

  /** Steps taken: N - 1. */
  const steps = (state) => state.n - 1;

  /** The shaded area after k steps, exactly, as a fraction [num, den]: r + ... + r^k with r = 1/kind. */
  function shaded(kind, k) {
    // sum_{i=1..k} 1/q^i = (q^k - 1) / ((q - 1) q^k)
    const q = BigInt(kind);
    const qk = q ** BigInt(k);
    let num = qk - 1n, den = (q - 1n) * qk;
    const g = gcd(num, den);
    return [num / g, den / g];
  }
  function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a || 1n; }

  /** The limit of the series, as text. */
  const LIMIT = { 2: "1", 3: "1/2", 4: "1/3" };

  /** The partial sum written out, for the page: "1/2 + 1/4 + 1/8 = 7/8". */
  function sumText(state) {
    const k = steps(state);
    if (k === 0) return "Nothing shaded yet: press + to cut.";
    const q = state.kind;
    const terms = [];
    for (let i = 1; i <= Math.min(k, 4); i++) terms.push(`1/${q ** i}`);
    const shown = k <= 4 ? terms.join(" + ") : `${terms.slice(0, 3).join(" + ")} + … + 1/${q}^${k}`;
    const [a, b] = shaded(q, k);
    const value = k <= 12 ? `${a}/${b}` : `${LIMIT[q]} − a tiny bit`;
    return `${shown} = ${value}`;
  }

  return { KINDS, MIN_N, MAX_N, MAX_DRAWN_DEPTH, LIMIT, start, pieces, steps, shaded, sumText, oneStep, splitRect, splitTri, splitFour };
})();
