"use strict";

/*
 * Leibniz and Pascal Triangles, from Bogomolny's applet LeibnitzTriangle.
 *
 * Pascal's triangle holds the binomial coefficients C(n,m), built by adding
 * the two entries above. The Leibniz harmonic triangle holds the reciprocals
 * of (n+1)C(n,m), built by adding the two entries below. Both are shown modulo
 * a chosen number; the applet also shows how the Leibniz second diagonal
 * telescopes to 1.
 *
 * The key idea is that the two triangles are reciprocals of each other up to
 * the row index. The logic test checks Pascal's row sums, the Leibniz
 * subtraction rule and the telescoping identities from the page.
 *
 * No document, no window, no storage: one global, LeibnizTriangleCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const LeibnizTriangleCore = (() => {
  const MIN_ROWS = 3;
  const MAX_ROWS = 16;
  const MIN_MOD = 2;
  const MAX_MOD = 12;

  const clamp = (v, lo, hi, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
  };

  function binomial(n, m) {
    if (m < 0 || m > n) return 0;
    let result = 1;
    for (let k = 0; k < m; k++) result = result * (n - k) / (k + 1);
    return Math.round(result);
  }

  function pascal(rows) {
    return Array.from({ length: rows }, (_, n) =>
      Array.from({ length: n + 1 }, (_, m) => binomial(n, m)));
  }

  /** Leibniz entries as denominators: (n+1)C(n,m). */
  function leibnizDenominators(rows) {
    return Array.from({ length: rows }, (_, n) =>
      Array.from({ length: n + 1 }, (_, m) => (n + 1) * binomial(n, m)));
  }

  /** Build the same denominators by subtraction from the two entries below. */
  function leibnizBySubtraction(rows) {
    const den = leibnizDenominators(rows + 1);
    const out = [];
    for (let n = 0; n < rows; n++) {
      const row = [];
      for (let m = 0; m <= n; m++) {
        // 1/den = 1/a + 1/b  =>  den = a*b/(a+b)
        const a = den[n + 1][m];
        const b = den[n + 1][m + 1];
        row.push(a * b / (a + b));
      }
      out.push(row);
    }
    return out;
  }

  function modulo(triangle, mod) {
    return triangle.map((row) => row.map((v) => v % mod));
  }

  function display(rows, mod, kind) {
    const triangle = kind === "leibniz" ? leibnizDenominators(rows) : pascal(rows);
    return {
      values: triangle,
      shown: modulo(triangle, mod),
      kind, rows, mod,
    };
  }

  /** Partial sums of the telescoping second diagonal: 1/(n(n+1)). */
  function telescoping(terms) {
    const partial = [];
    let sum = 0;
    for (let n = 1; n <= terms; n++) {
      sum += 1 / (n * (n + 1));
      partial.push(sum);
    }
    return { partial, limit: 1, last: sum };
  }

  function start() {
    return { rows: 8, mod: 5, kind: "pascal" };
  }

  function setRows(state, value) { return { ...state, rows: clamp(value, MIN_ROWS, MAX_ROWS, state.rows) }; }
  function setMod(state, value) { return { ...state, mod: clamp(value, MIN_MOD, MAX_MOD, state.mod) }; }
  function setKind(state, value) { return { ...state, kind: value === "leibniz" ? "leibniz" : "pascal" }; }

  function analyze(state) {
    const d = display(state.rows, state.mod, state.kind);
    return {
      ...d,
      symmetric: d.values.every((row) => row.every((v, m) => v === row[row.length - 1 - m])),
      rowSums: d.values.map((row) => row.reduce((a, b) => a + b, 0)),
      telescoping: telescoping(state.rows),
    };
  }

  return {
    MIN_ROWS, MAX_ROWS, MIN_MOD, MAX_MOD, clamp, binomial, pascal,
    leibnizDenominators, leibnizBySubtraction, modulo, display, telescoping,
    start, setRows, setMod, setKind, analyze,
  };
})();
