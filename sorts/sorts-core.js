"use strict";

/*
 * Sorting Algorithms, from Alexander Bogomolny's applet Sorts (adapted, as
 * the page says, from Jon Bentley's SortAnim).
 *
 * An array of numbers is drawn as sticks or circles, the index across and
 * the size up. Five algorithms sort it one step at a time, a step being one
 * of the algorithm's comparisons (and the swap it may make):
 *   Insertion sort: walk each new element down past larger ones.
 *   Selection sort: for each place i, compare every later element with the
 *     one at i and swap whenever it is smaller.
 *   Bubblesort: sweep left to right swapping neighbours out of order; each
 *     sweep is one shorter.
 *   Shellsort: insertion sort on elements h apart, for h = ..., 13, 4, 1.
 *   Heapsort: build a max-heap, then swap the top to the end and sift down
 *     (here a step is one whole sift).
 * Like the applet's, the inner loops do not stop early: a pass keeps
 * comparing after its element has found its place.
 *
 * Transcribed from the applet's MakeOneStep / ComputeNext for each class,
 * with two repairs. Its Bubblesort never sets Finished (on the last sweep J
 * runs past the end it is compared with), so here it stops when sorted. Its
 * Heapsort is Bentley's 1-based one on a 0-based array, so element 0 was
 * never sorted; here the heap starts at 0.
 *
 * Arrays (GenerateArray): random in [0, 1), ascending i/n, descending
 * 1 - i/n, concave 1 - 4((n/2 - i)/n)^2, convex 4((n/2 - i)/n)^2; 20
 * elements to start. "Same array" reuses the last starting array.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SortsCore. The position is plain data.
 */
const SortsCore = (() => {
  const METHODS = ["Insertion sort", "Selection sort", "Bubblesort", "Shellsort", "Heapsort"];
  const ORDERS = ["Random order", "Ascending", "Descending", "Concave", "Convex"];
  const SIZE = { min: 2, max: 100, def: 20 };
  const INTERVAL_MS = 20;

  function generate(n, kind, rnd) {
    const a = [], half = n / 2;
    for (let i = 0; i < n; i++) {
      if (kind === 0) a.push(rnd());
      else if (kind === 1) a.push(i / n);
      else if (kind === 2) a.push(1 - i / n);
      else if (kind === 3) a.push(1 - 4 * ((half - i) / n) * ((half - i) / n));
      else a.push(4 * ((half - i) / n) * ((half - i) / n));
    }
    return a;
  }

  function clampN(v) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(SIZE.min, Math.min(SIZE.max, n)) : SIZE.def; }

  function start(options = {}) {
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    const n = clampN(options.n ?? SIZE.def);
    const order = ORDERS[options.order] ? options.order : 0;
    const array = Array.isArray(options.array) ? options.array.slice() : generate(n, order, rnd);
    return { method: METHODS[options.method] ? options.method : 0, order, n: array.length, same: !!options.same, array, backup: array.slice(), alg: null };
  }

  /** InitGlobalVars for the chosen method. */
  function init(method, n) {
    const alg = { I: 0, J: 0, H: 0, firstPass: false, finished: n < 2, steps: 0, swaps: 0 };
    if (method === 0) { alg.I = alg.J = 1; }
    else if (method === 3) { let H = 1; while (H < n) H = 3 * H + 1; alg.H = Math.floor(H / 3); alg.I = alg.J = alg.H; if (alg.H < 1) alg.finished = true; }
    else if (method === 4) { alg.I = Math.floor(n / 2) - 1; alg.firstPass = true; }
    return alg;
  }

  /**
   * A new run (the first Run or One step after a change, or after the last
   * run finished): the same starting array if Same array is ticked, else a
   * new one of the chosen kind.
   */
  function begin(s, rnd = Math.random) {
    const array = s.same && s.backup.length === s.n ? s.backup.slice() : generate(s.n, s.order, rnd);
    return { ...s, array, backup: array.slice(), alg: init(s.method, s.n) };
  }

  function siftdown(a, alg, l, u) {
    // 0-based: the children of i are 2i + 1 and 2i + 2
    let i = l;
    for (;;) {
      let c = 2 * i + 1;
      if (c > u) return;
      if (c + 1 <= u && a[c + 1] > a[c]) c++;
      if (a[i] >= a[c]) return;
      [a[i], a[c]] = [a[c], a[i]]; alg.swaps++;
      i = c;
    }
  }

  /** One MakeOneStep (and its ComputeNext). Starts a run first if there is none. */
  function step(s, rnd = Math.random) {
    let t = s.alg && !s.alg.finished ? { ...s, array: s.array.slice(), alg: { ...s.alg } } : begin(s, rnd);
    const a = t.array, g = t.alg, n = a.length;
    if (g.finished) return t;
    const swap = (i, j) => { const x = a[i]; a[i] = a[j]; a[j] = x; g.swaps++; };
    g.steps++;
    switch (t.method) {
      case 0: // insertion
        if (g.J > 0 && a[g.J - 1] > a[g.J]) swap(g.J - 1, g.J);
        g.J--;
        if (g.J === 0) { g.I++; if (g.I === n) g.finished = true; else g.J = g.I; }
        break;
      case 1: // selection (exchange)
        if (g.J < n && a[g.J] < a[g.I]) swap(g.I, g.J);
        g.J++;
        if (g.J === n) { g.I++; if (g.I === n) g.finished = true; else g.J = g.I; }
        break;
      case 2: // bubble
        if (g.J < n - 1 - g.I && a[g.J + 1] < a[g.J]) swap(g.J, g.J + 1);
        g.J++;
        if (g.J >= n - 1 - g.I) { g.I++; if (g.I >= n - 1) g.finished = true; else g.J = 0; }
        break;
      case 3: // shell
        if (g.J >= g.H && g.H >= 1 && a[g.J - g.H] >= a[g.J]) swap(g.J - g.H, g.J);
        g.J -= g.H;
        if (g.J < g.H) {
          g.I++;
          if (g.I === n) { g.H = Math.floor(g.H / 3); if (g.H < 1) g.finished = true; else g.I = g.J = g.H; }
          else g.J = g.I;
        }
        break;
      case 4: // heap
        if (g.firstPass) {
          if (g.I >= 0) siftdown(a, g, g.I, n - 1);
          g.I--;
          if (g.I < 0) { g.firstPass = false; g.I = n - 1; }
        } else {
          if (g.I >= 1) { swap(0, g.I); siftdown(a, g, 0, g.I - 1); }
          g.I--;
          if (g.I < 1) g.finished = true;
        }
        break;
    }
    return t;
  }

  /** Every step until finished (bounded). */
  function run(s, rnd = Math.random, max = 1e6) {
    let t = step(s, rnd);
    for (let k = 0; k < max && !t.alg.finished; k++) t = step(t, rnd);
    return t;
  }

  const sorted = (a) => a.every((x, i) => i === 0 || a[i - 1] <= x);
  /** Changing the method, order or size starts afresh on the next Run / One step. */
  const set = (s, patch) => {
    const t = { ...s, ...patch, alg: null };
    if (patch.n !== undefined) t.n = clampN(patch.n);
    if ((patch.order !== undefined || patch.n !== undefined) && !t.same) { t.array = generate(t.n, t.order, Math.random); t.backup = t.array.slice(); }
    return t;
  };

  return { METHODS, ORDERS, SIZE, INTERVAL_MS, generate, start, begin, step, run, sorted, set };
})();
