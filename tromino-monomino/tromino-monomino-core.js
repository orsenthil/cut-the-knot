"use strict";

/*
 * Straight Tromino on a Chessboard, from Alexander Bogomolny's applet
 * TroMonomino (a problem of Solomon Golomb).
 *
 * Cover an 8 x 8 board with 21 straight trominoes (three squares in a row)
 * and one single square, the monomino. Where can the monomino go? Only on
 * c3, c6, f3 or f6.
 *
 * The idea: number the rows i and columns j from 0. A straight tromino
 * covers one square of each value of (i + j) mod 3, and one of each value
 * of (i - j) mod 3. The squares left uncovered must make up whatever the
 * board has too many of in both colourings. On 8 x 8 that pins the
 * monomino to rows and columns 2 and 5. (Roberts gets the same answer from
 * the generating function f(x, y) at cube roots of unity.)
 *
 * The applet's board is N rows by M columns (3..20, 8 x 8 to start; NxN
 * keeps it square). Click a free square, then a free square two away in
 * the same row or column, to place a tromino over them and the square in
 * between; Remove last takes the newest one back. The play is finished
 * when floor(NM/3) trominoes are down. The applet only kept a tromino's
 * end squares, so a new one could start on the middle of an old one; the
 * page says pieces may not overlap, so here no square is used twice.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * TrominoMonominoCore. The position is plain data.
 */
const TrominoMonominoCore = (() => {
  const SIZE = { min: 3, max: 20, def: 8 };
  const clamp = (v) => { const k = Math.round(Number(v)); return Number.isFinite(k) ? Math.max(SIZE.min, Math.min(SIZE.max, k)) : SIZE.def; };

  function start(options = {}) {
    const n = clamp(options.n ?? SIZE.def);
    const m = options.m === undefined ? n : clamp(options.m);
    return { n, m, pieces: [] }; // a piece is [i1, j1, i2, j2]: its two end squares
  }

  /** The three squares of a piece. */
  function cells(p) {
    const [i1, j1, i2, j2] = p;
    return [[i1, j1], [(i1 + i2) / 2, (j1 + j2) / 2], [i2, j2]];
  }

  function occupied(s) {
    const o = new Set();
    for (const p of s.pieces) for (const [i, j] of cells(p)) o.add(i * s.m + j);
    return o;
  }

  const inside = (s, i, j) => Number.isInteger(i) && Number.isInteger(j) && i >= 0 && j >= 0 && i < s.n && j < s.m;
  const target = (s) => Math.floor((s.n * s.m) / 3);
  const finished = (s) => s.pieces.length === target(s);

  /** Can a tromino go from (i1, j1) to (i2, j2)? (IsConsistent, with no overlap at all.) */
  function canPlace(s, i1, j1, i2, j2) {
    if (!inside(s, i1, j1) || !inside(s, i2, j2) || finished(s)) return false;
    if (!((i1 === i2 && Math.abs(j1 - j2) === 2) || (j1 === j2 && Math.abs(i1 - i2) === 2))) return false;
    const o = occupied(s);
    return cells([i1, j1, i2, j2]).every(([i, j]) => !o.has(i * s.m + j));
  }

  function place(s, i1, j1, i2, j2) {
    if (!canPlace(s, i1, j1, i2, j2)) return null;
    return { ...s, pieces: s.pieces.concat([[i1, j1, i2, j2]]) };
  }

  function removeLast(s) {
    return s.pieces.length ? { ...s, pieces: s.pieces.slice(0, -1) } : null;
  }

  /** The squares not covered. */
  function free(s) {
    const o = occupied(s), out = [];
    for (let i = 0; i < s.n; i++) for (let j = 0; j < s.m; j++) if (!o.has(i * s.m + j)) out.push([i, j]);
    return out;
  }

  const result = (s) => (finished(s) ? "win" : null);

  /** Golomb's colourings: a tromino covers one square of each value of both. */
  const colourA = (i, j) => (i + j) % 3;
  const colourB = (i, j) => ((i - j) % 3 + 3) % 3;

  /** Do the given uncovered squares leave both colourings balanced? (necessary for a covering) */
  function balanced(n, m, holes) {
    const a = [0, 0, 0], b = [0, 0, 0];
    const h = new Set(holes.map(([i, j]) => i * m + j));
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if (!h.has(i * m + j)) { a[colourA(i, j)]++; b[colourB(i, j)]++; }
    return a[0] === a[1] && a[1] === a[2] && b[0] === b[1] && b[1] === b[2];
  }

  /** A covering of the n x m board, minus the holes, by straight trominoes, or null. */
  function cover(n, m, holes) {
    const used = new Uint8Array(n * m);
    for (const [i, j] of holes) used[i * m + j] = 1;
    const out = [];
    const go = (k) => {
      while (k < n * m && used[k]) k++;
      if (k === n * m) return true;
      const i = Math.floor(k / m), j = k % m;
      if (j + 2 < m && !used[k + 1] && !used[k + 2]) {
        used[k] = used[k + 1] = used[k + 2] = 1; out.push([i, j, i, j + 2]);
        if (go(k + 3)) return true;
        used[k] = used[k + 1] = used[k + 2] = 0; out.pop();
      }
      if (i + 2 < n && !used[k + m] && !used[k + 2 * m]) {
        used[k] = used[k + m] = used[k + 2 * m] = 1; out.push([i, j, i + 2, j]);
        if (go(k + 1)) return true;
        used[k] = used[k + m] = used[k + 2 * m] = 0; out.pop();
      }
      return false;
    };
    return go(0) ? out : null;
  }

  /** Chess name of square (i, j): columns a, b, ... from the left, rows 1, 2, ... from the bottom. */
  const name = (s, i, j) => `${j < 26 ? String.fromCharCode(97 + j) : `col${j + 1}`}${s.n - i}`;

  return { SIZE, start, cells, occupied, canPlace, place, removeLast, free, target, finished, result, colourA, colourB, balanced, cover, name };
})();
