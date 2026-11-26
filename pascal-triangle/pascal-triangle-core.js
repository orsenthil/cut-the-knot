"use strict";

/*
 * Pascal's triangle, built the way the page builds it: C(n, m) is the number
 * of itineraries from the top dot (0, 0) down to dot m of row n, stepping
 * left or right at each dot. Every dot but the ends can be reached only from
 * the two dots above it, so C(n, m) = C(n-1, m-1) + C(n-1, m).
 *
 * No DOM. The global is PascalTriangleCore.
 */
var PascalTriangleCore = (function () {
  const MIN_ROWS = 2, MAX_ROWS = 16, DEFAULT_ROWS = 11;
  const FORMS = ["symmetric", "pascals", "right"];

  /** Rows 0..rows-1 by the applet's FillTriangle recurrence. */
  function build(rows) {
    const t = [];
    for (let n = 0; n < rows; n++) {
      t[n] = [];
      t[n][0] = 1;
      for (let m = 1; m < n; m++) t[n][m] = t[n - 1][m - 1] + t[n - 1][m];
      t[n][n] = 1;
    }
    return t;
  }

  /** Itineraries counted one by one: every string of n steps, each left or right. */
  function itineraries(n) {
    const counts = new Array(n + 1).fill(0);
    for (let mask = 0; mask < 1 << n; mask++) {
      let rights = 0;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) rights++;
      counts[rights]++;
    }
    return counts;
  }

  /** n choose m, by the product formula. */
  function choose(n, m) {
    let c = 1;
    for (let i = 1; i <= m; i++) c = (c * (n - m + i)) / i;
    return Math.round(c);
  }

  function clampRows(r) {
    r = Math.floor(Number(r));
    if (!(r >= 0)) r = DEFAULT_ROWS;
    return Math.min(MAX_ROWS, Math.max(MIN_ROWS, r));
  }

  function start(opts) {
    opts = opts || {};
    return {
      rows: clampRows(opts.rows),
      form: FORMS.indexOf(opts.form) >= 0 ? opts.form : "symmetric",
      arrows: !!opts.arrows,
      pick: null,
    };
  }

  /** The dots (n, m) a dot can be reached from, and the sum that gives its count. */
  function parents(n, m) {
    const p = [];
    if (n > 0 && m > 0) p.push([n - 1, m - 1]);
    if (n > 0 && m < n) p.push([n - 1, m]);
    return p;
  }

  /** Where dot (n, m) sits in a form, in units of one step (x right, y down). */
  function place(form, n, m) {
    if (form === "pascals") return { x: m, y: n - m };
    if (form === "right") return { x: m, y: n };
    return { x: m - n / 2, y: n };
  }

  return { MIN_ROWS, MAX_ROWS, DEFAULT_ROWS, FORMS, build, itineraries, choose, clampRows, start, parents, place };
})();
