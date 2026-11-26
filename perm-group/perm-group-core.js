"use strict";

/*
 * Group multiplication of permutations. Two random permutations f and g of
 * 1..n are shown with their products fg and gf and their conjugates
 * f^-1 g f and g^-1 f g. In a product the permutations are carried out left
 * to right: (fg)(k) = g(f(k)). A permutation can be written as a list
 * {p(1), ..., p(n)} or as a product of cycles that each start with their
 * smallest element, as the applet does.
 *
 * Lemma 1 of the page: the conjugate f^-1 g f has the cycles of g with every
 * element a replaced by f(a). So conjugation never changes the shape of the
 * cycles.
 *
 * No DOM. The global is PermGroupCore.
 */
var PermGroupCore = (function () {
  const MIN_N = 2, MAX_N = 20, DEFAULT_N = 7;

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

  function product(f, g) { return f.map((v) => g[v - 1]); }

  function inverse(f) {
    const g = new Array(f.length);
    f.forEach((v, i) => { g[v - 1] = i + 1; });
    return g;
  }

  /** The cycles, each starting at its smallest element, as the applet writes them. Fixed points are kept. */
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

  /** Cycle lengths, largest first: the shape of the permutation. */
  function shape(f) { return cycles(f).map((c) => c.length).sort((a, b) => b - a); }

  function cycleText(f) { return cycles(f).map((c) => "(" + c.join(" ") + ")").join(""); }
  function listText(f) { return "{" + f.join(", ") + "}"; }

  /** f^-1 g f: first f^-1, then g, then f. */
  function conjugate(f, g) { return product(product(inverse(f), g), f); }

  /** Lemma 1: the cycles of g, every element a replaced by f(a) (as sets of cyclic words). */
  function relabelled(f, g) { return cycles(g).map((c) => c.map((a) => f[a - 1])); }

  /** Rotate a cycle so that it starts at its smallest element. */
  function normal(c) {
    const i = c.indexOf(Math.min.apply(null, c));
    return c.slice(i).concat(c.slice(0, i));
  }

  function everything(f, g) {
    return {
      f, g,
      fg: product(f, g),
      gf: product(g, f),
      fgf: conjugate(f, g),
      gfg: conjugate(g, f),
    };
  }

  function start(opts) {
    opts = opts || {};
    const n = clampN(opts.n), random = opts.random || Math.random;
    const ok = (p) => Array.isArray(p) && p.length === n && new Set(p).size === n && p.every((v) => v >= 1 && v <= n);
    return { n, f: ok(opts.f) ? opts.f.slice() : shuffle(n, random), g: ok(opts.g) ? opts.g.slice() : shuffle(n, random), cycles: !!opts.cycles };
  }

  return { MIN_N, MAX_N, DEFAULT_N, clampN, shuffle, product, inverse, cycles, shape, cycleText, listText, conjugate, relabelled, normal, everything, start };
})();
