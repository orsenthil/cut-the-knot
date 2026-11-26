"use strict";

/*
 * Permutations as a product of transpositions. N poles stand side by side and
 * "shuttles" join two poles at a height. Heights are numbered from the top; a
 * height holds at most one shuttle (the applet says "This height is
 * occupied!"). To read the permutation, start at the top of a pole and slide
 * down; at every shuttle that touches the pole you are on, cross to its other
 * end and carry on down. The pole where you arrive is where the start pole's
 * number goes. Each shuttle is the transposition (a b), and the permutation
 * is their product in order from the top, so the parity of the number of
 * shuttles is the parity of the permutation.
 *
 * No DOM. The global is PermTransCore.
 */
var PermTransCore = (function () {
  const MIN_N = 2, MAX_N = 20, DEFAULT_N = 5, LEVELS = 12;

  function clampN(n) {
    n = Math.floor(Number(n));
    if (!isFinite(n)) return DEFAULT_N;
    return Math.min(MAX_N, Math.max(MIN_N, n));
  }

  function start(opts) {
    opts = opts || {};
    return { n: clampN(opts.n), bars: [] };
  }

  /** Add a shuttle between poles a and b at height h (1 = top). Returns null and says why when refused. */
  function add(s, h, a, b) {
    if (a === b || a < 1 || b < 1 || a > s.n || b > s.n) return { error: "A shuttle needs two different poles." };
    if (!(h >= 1 && h <= LEVELS)) return { error: "No such height." };
    if (s.bars.some((x) => x.h === h)) return { error: "This height is occupied! Select another." };
    const seq = s.bars.reduce((m, x) => Math.max(m, x.seq), 0) + 1;
    const bar = { h, a: Math.min(a, b), b: Math.max(a, b), seq };
    return { state: { n: s.n, bars: s.bars.concat([bar]).sort((x, y) => x.h - y.h) }, bar };
  }

  /** Take away the shuttle that was added last. */
  function removeLast(s) {
    if (!s.bars.length) return s;
    const last = s.bars.reduce((m, x) => (x.seq > m.seq ? x : m), s.bars[0]);
    return { n: s.n, bars: s.bars.filter((x) => x !== last) };
  }

  /** The slide down from the top of pole p: the poles visited at each shuttle and the pole at the bottom. */
  function itinerary(s, p) {
    const stops = [{ pole: p, h: 0 }];
    let cur = p;
    for (const bar of s.bars) {
      if (bar.a === cur) cur = bar.b; else if (bar.b === cur) cur = bar.a; else continue;
      stops.push({ pole: cur, h: bar.h });
    }
    return { stops, end: cur };
  }

  /** The permutation: f(i) = the pole where the slide from pole i ends. */
  function permutation(s) {
    const f = [];
    for (let i = 1; i <= s.n; i++) f.push(itinerary(s, i).end);
    return f;
  }

  /** The same permutation by carrying the numbers down: swap the entries at the two ends of every shuttle. */
  function permutationBySwaps(s) {
    const at = Array.from({ length: s.n }, (_, i) => i + 1); // at[pole-1] = number standing there
    for (const bar of s.bars) { const t = at[bar.a - 1]; at[bar.a - 1] = at[bar.b - 1]; at[bar.b - 1] = t; }
    const f = new Array(s.n);
    at.forEach((num, pole) => { f[num - 1] = pole + 1; });
    return f;
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

  /** The transpositions from the top, as the applet writes them: (a,b) with a < b. */
  function transpositions(s) { return s.bars.map((x) => `(${x.a},${x.b})`); }

  function isEven(f) { return (f.length - cycles(f).length) % 2 === 0; }

  /** The fewest transpositions that make f: n minus the number of cycles. */
  function fewest(f) { return f.length - cycles(f).length; }

  /** A list of shuttles (one per level from the top) that makes f, built cycle by cycle. */
  function build(f) {
    const n = f.length, bars = [];
    // sort by selection: swap the entries into place, one transposition at a time
    const at = Array.from({ length: n }, (_, i) => i + 1);
    for (let pole = 1; pole <= n; pole++) {
      // the number that must end at `pole` is the one i with f(i) = pole
      const want = f.indexOf(pole) + 1;
      const where = at.indexOf(want) + 1;
      if (where !== pole) {
        bars.push({ a: Math.min(pole, where), b: Math.max(pole, where) });
        const t = at[pole - 1]; at[pole - 1] = at[where - 1]; at[where - 1] = t;
      }
    }
    return bars.map((x, i) => ({ h: i + 1, a: x.a, b: x.b }));
  }

  return { MIN_N, MAX_N, DEFAULT_N, LEVELS, clampN, start, add, removeLast, itinerary, permutation, permutationBySwaps, cycles, cycleText, transpositions, isEven, fewest, build };
})();
