"use strict";

/*
 * A permutation of 1..n written as the list f = {f(1), ..., f(n)} and shown in
 * several ways: the two-row table, the same with lines (and upside down, which
 * shows the inverse), the product of cycles, and Marshall Hall's list of
 * inversions, where a_i counts the elements bigger than i that stand to the
 * left of i. The list determines the permutation, and Reset deals a new one
 * with the page's backwards shuffle.
 *
 * No DOM. The global is PermCore.
 */
var PermCore = (function () {
  const MIN_N = 2, MAX_N = 20, DEFAULT_N = 9;

  function clampN(n) {
    n = Math.floor(Number(n));
    if (!isFinite(n)) return DEFAULT_N;
    return Math.min(MAX_N, Math.max(MIN_N, n));
  }

  /** The page's shuffle: going backwards, swap each item with a random earlier one (or itself). */
  function shuffle(n, random) {
    const v = [];
    for (let i = 1; i <= n; i++) v.push(i);
    for (let i = n - 1; i > 0; i--) {
      const r = Math.floor(random() * (i + 1));
      const copy = v[i]; v[i] = v[r]; v[r] = copy;
    }
    return v;
  }

  /** The inverse permutation: the upper row of the upside-down presentation. */
  function inverse(f) {
    const g = new Array(f.length);
    f.forEach((v, i) => { g[v - 1] = i + 1; });
    return g;
  }

  /** Marshall Hall's list: a_i = how many elements greater than i stand to the left of i. */
  function inversions(f) {
    const n = f.length, pos = inverse(f), a = [];
    for (let i = 1; i <= n; i++) {
      let c = 0;
      for (let j = 0; j < pos[i - 1] - 1; j++) if (f[j] > i) c++;
      a.push(c);
    }
    return a;
  }

  /** The page's reconstruction: write n, then put n-1, n-2, ... each with a_i larger numbers on its left. */
  function fromInversions(a) {
    const n = a.length, out = [];
    for (let i = n; i >= 1; i--) out.splice(a[i - 1], 0, i);
    return out;
  }

  /** True for a list that is some table of inversions: 0 <= a_i <= n - i. */
  function validInversions(a) {
    return a.every((x, i) => Number.isInteger(x) && x >= 0 && x <= a.length - 1 - i);
  }

  /** The cycles, each starting at its smallest element, by smallest first; fixed points are 1-cycles. */
  function cycles(f) {
    const seen = new Array(f.length).fill(false), out = [];
    for (let i = 1; i <= f.length; i++) {
      if (seen[i - 1]) continue;
      const c = [];
      for (let j = i; !seen[j - 1]; j = f[j - 1]) { seen[j - 1] = true; c.push(j); }
      out.push(c);
    }
    return out;
  }

  /** The cycles as text: (1 5 2 9 3)(4 8 7)(6). */
  function cycleText(f) {
    return cycles(f).map((c) => "(" + c.join(" ") + ")").join("");
  }

  function isPermutation(f) {
    const seen = new Set(f);
    return seen.size === f.length && f.every((v) => Number.isInteger(v) && v >= 1 && v <= f.length);
  }

  function start(opts) {
    opts = opts || {};
    const n = clampN(opts.n);
    const f = Array.isArray(opts.f) && opts.f.length === n && isPermutation(opts.f) ? opts.f.slice() : shuffle(n, opts.random || Math.random);
    return { n, f, view: ["table", "lines", "upside"].indexOf(opts.view) >= 0 ? opts.view : "table" };
  }

  return { MIN_N, MAX_N, DEFAULT_N, clampN, shuffle, inverse, inversions, fromInversions, validInversions, cycles, cycleText, isPermutation, start };
})();
