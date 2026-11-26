"use strict";

/*
 * The product of two permutations f and g of 1..n, shown on circles. The page
 * writes (fg)(k) = g(f(k)): the left one is carried out first. Pressing two
 * numbers in f (or in g) multiplies that permutation by their transposition,
 * as the applet's MakeItWork does through Times(), and the product is
 * recomputed. The reading of the order follows the page.
 *
 * No DOM. The global is PermProductCore.
 */
var PermProductCore = (function () {
  const MIN_N = 2, MAX_N = 20, DEFAULT_N = 6;

  function clampN(n) {
    n = Math.floor(Number(n));
    if (!isFinite(n)) return DEFAULT_N;
    return Math.min(MAX_N, Math.max(MIN_N, n));
  }

  function shuffle(n, random) {
    const v = [];
    for (let i = 1; i <= n; i++) v.push(i);
    for (let i = n - 1; i > 0; i--) {
      const r = Math.floor(random() * (i + 1));
      const c = v[i]; v[i] = v[r]; v[r] = c;
    }
    return v;
  }

  /** fg: first f, then g. (fg)(k) = g(f(k)). */
  function product(f, g) { return f.map((v) => g[v - 1]); }

  function inverse(f) {
    const g = new Array(f.length);
    f.forEach((v, i) => { g[v - 1] = i + 1; });
    return g;
  }

  /** f multiplied by the transposition (a b), f first: the values a and b trade places. */
  function times(f, a, b) {
    return f.map((v) => (v === a ? b : v === b ? a : v));
  }

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
  function cycleText(f) { return cycles(f).map((c) => "(" + c.join(" ") + ")").join(""); }
  function isEven(f) { return (f.length - cycles(f).length) % 2 === 0; }

  function arrows(f) {
    const out = [];
    f.forEach((v, i) => { if (v !== i + 1) out.push([i + 1, v]); });
    return out;
  }

  function start(opts) {
    opts = opts || {};
    const n = clampN(opts.n), random = opts.random || Math.random;
    const ok = (p) => Array.isArray(p) && p.length === n && new Set(p).size === n && p.every((v) => v >= 1 && v <= n);
    return { n, f: ok(opts.f) ? opts.f.slice() : shuffle(n, random), g: ok(opts.g) ? opts.g.slice() : shuffle(n, random), pick: null };
  }

  /** Press number x in permutation `which` ("f" or "g"): select, then swap. A press in the other one starts over. */
  function press(s, which, x) {
    if (s.pick === null || s.pick.which !== which) return Object.assign({}, s, { pick: { which, x } });
    if (s.pick.x === x) return Object.assign({}, s, { pick: null });
    const next = Object.assign({}, s, { pick: null });
    next[which] = times(s[which], s.pick.x, x);
    return next;
  }

  return { MIN_N, MAX_N, DEFAULT_N, clampN, shuffle, product, inverse, times, cycles, cycleText, isEven, arrows, start, press };
})();
