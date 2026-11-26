"use strict";

/*
 * A permutation on a circle: the numbers 1..n stand round a circle and an
 * arrow joins each i to f(i) when they differ. Pressing two numbers a and b
 * multiplies f by the transposition (a b), exactly as the applet's MakeItWork
 * does: f'(k) = f(t(k)) where t swaps a and b, so the entries f(a) and f(b)
 * trade places. Such a swap changes the number of disjoint cycles by one: it
 * splits the cycle when a and b lie in the same cycle and joins two cycles
 * into one when they do not.
 *
 * No DOM. The global is PermCircleCore.
 */
var PermCircleCore = (function () {
  const MIN_N = 2, MAX_N = 20, DEFAULT_N = 8;

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

  /** The cycles (each starting at its smallest element), fixed points included. */
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

  /** Index (0-based) of the cycle that holds element x. */
  function cycleOf(f, x) {
    const cs = cycles(f);
    return cs.findIndex((c) => c.indexOf(x) >= 0);
  }

  /** f multiplied by the transposition (a b): the entries at a and b trade places. */
  function swap(f, a, b) {
    const g = f.slice();
    g[a - 1] = f[b - 1];
    g[b - 1] = f[a - 1];
    return g;
  }

  /** The arrows: i -> f(i) wherever the two differ. */
  function arrows(f) {
    const out = [];
    f.forEach((v, i) => { if (v !== i + 1) out.push([i + 1, v]); });
    return out;
  }

  /** What a swap of a and b does to the cycles: "split" or "join". */
  function effect(f, a, b) {
    return cycleOf(f, a) === cycleOf(f, b) ? "split" : "join";
  }

  /** The permutation is even when n minus the number of cycles is even. */
  function isEven(f) { return (f.length - cycles(f).length) % 2 === 0; }

  function cycleText(f) { return cycles(f).map((c) => "(" + c.join(" ") + ")").join(""); }

  function start(opts) {
    opts = opts || {};
    const n = clampN(opts.n);
    const ok = Array.isArray(opts.f) && opts.f.length === n && new Set(opts.f).size === n && opts.f.every((v) => v >= 1 && v <= n);
    return { n, f: ok ? opts.f.slice() : shuffle(n, opts.random || Math.random), first: null, moves: 0 };
  }

  /** Press element x: the first press selects, the second swaps (the same one again deselects). */
  function press(s, x) {
    if (s.first === null) return Object.assign({}, s, { first: x });
    if (s.first === x) return Object.assign({}, s, { first: null });
    return { n: s.n, f: swap(s.f, s.first, x), first: null, moves: s.moves + 1, last: { a: s.first, b: x, effect: effect(s.f, s.first, x) } };
  }

  return { MIN_N, MAX_N, DEFAULT_N, clampN, shuffle, cycles, cycleOf, swap, arrows, effect, isEven, cycleText, start, press };
})();
