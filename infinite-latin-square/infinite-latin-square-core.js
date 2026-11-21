"use strict";

/*
 * Infinite Latin Squares, from Bogomolny's applet InfiniteLatin.
 *
 * The entry at row i, column j is i XOR j (bitwise exclusive or). The corner
 * square of side 2^n then contains exactly the numbers 0..2^n-1 once in every
 * row and once in every column. The applet builds it by doubling: copy the
 * 2^n corner into the other three quarters and add 2^n to two of them — which
 * is exactly what XOR with the new high bit does.
 *
 * The key idea is that doubling a finite Latin square this way keeps it Latin,
 * so the whole infinite quadrant is Latin. The logic test checks that property
 * for every power-of-two side and the XOR formula against the doubling rule.
 *
 * No document, no window, no storage: one global, InfiniteLatinSquareCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const InfiniteLatinSquareCore = (() => {
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 6;

  function clamp(value, fallback) {
    const v = Math.trunc(Number(value));
    return Number.isFinite(v) ? Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, v)) : fallback;
  }

  function start() {
    return { level: 3, modulus: 0 }; // modulus 0 means show raw numbers
  }

  function size(level) {
    const n = Math.trunc(Number(level));
    return 2 ** (Number.isFinite(n) ? Math.max(0, Math.min(MAX_LEVEL, n)) : 3);
  }

  function value(i, j) {
    return i ^ j;
  }

  function square(level, modulus) {
    const n = size(level);
    const rows = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) {
        const v = value(i, j);
        row.push(modulus ? v % modulus : v);
      }
      rows.push(row);
    }
    return rows;
  }

  /** Build the 2n square by the applet's doubling rule from an n square. */
  function double(quadrant) {
    const n = quadrant.length;
    const out = Array.from({ length: 2 * n }, () => Array(2 * n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = quadrant[i][j];
        out[i][j] = v;                   // north-west
        out[i][j + n] = v + n;           // north-east
        out[i + n][j] = v + n;           // south-west
        out[i + n][j + n] = v;           // south-east
      }
    }
    return out;
  }

  function isLatin(rows) {
    const n = rows.length;
    for (let i = 0; i < n; i++) {
      if (new Set(rows[i]).size !== n) return false;
      const col = rows.map((row) => row[i]);
      if (new Set(col).size !== n) return false;
    }
    return true;
  }

  function setLevel(state, value) {
    return { ...state, level: clamp(value, state.level) };
  }
  function setModulus(state, value) {
    return { ...state, modulus: Math.max(0, Math.min(20, Math.trunc(Number(value)) || 0)) };
  }

  return { MIN_LEVEL, MAX_LEVEL, clamp, start, size, value, square, double, isLatin, setLevel, setModulus };
})();
