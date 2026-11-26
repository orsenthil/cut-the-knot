"use strict";

/*
 * Party Acquaintances, from Alexander Bogomolny's applet ThreeOrThree.
 *
 * At a party of six, either three people all know each other or three are
 * all strangers. Draw the people as N points round a circle and join every
 * two of them by a red line (acquainted) or a blue one (strangers): however
 * the 15 lines of K6 are coloured, a red or a blue triangle appears. The
 * Ramsey number R(m, n) is the smallest N for which every colouring of K_N
 * has a red K_m or a blue K_n; R(3, 3) = 6 because K5 can avoid both
 * (the pentagon red, the pentagram blue).
 *
 * Transcribed from ThreeOrThreeCanvas: N points (3..20, 6 to start); click
 * a point, then another not yet joined to it, to draw a line, red and blue
 * in turn when Autocolor is on (starting with red), otherwise the chosen
 * colour. After every line CheckFinished looks, through all sets of #Red
 * points and all sets of #Blue points (each 2..min(5, N - 1), 3 to start),
 * for a red or blue complete subgraph; the drawing is finished when one is
 * found or every line is drawn. Remove last takes the newest line back.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * PartyAcquaintancesCore. The position is plain data.
 */
const PartyAcquaintancesCore = (() => {
  const N_RANGE = { min: 3, max: 20, def: 6 };
  const K_RANGE = { min: 2, max: 5, def: 3 };

  const clamp = (v, r, hi = r.max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(r.min, Math.min(hi, n)) : r.def; };

  function start(options = {}) {
    const n = clamp(options.n ?? N_RANGE.def, N_RANGE);
    return {
      n, nRed: clamp(options.nRed ?? K_RANGE.def, K_RANGE, Math.min(K_RANGE.max, n - 1)), nBlue: clamp(options.nBlue ?? K_RANGE.def, K_RANGE, Math.min(K_RANGE.max, n - 1)),
      autoColor: options.autoColor !== false, useRed: options.useRed !== false, nextRed: true,
      edges: Array.isArray(options.edges) ? options.edges.map((e) => e.slice()) : [],
    };
  }

  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  function colourOf(s) {
    const m = new Map();
    for (const [a, b, red] of s.edges) m.set(key(a, b), red ? "red" : "blue");
    return m;
  }
  const joined = (s, a, b) => s.edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a));

  /** A line from a to b (mouseClicked on two points). */
  function draw(s, a, b) {
    if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < s.n && b < s.n) || a === b || joined(s, a, b)) return null;
    if (finished(s)) return null;
    const red = s.autoColor ? s.nextRed : s.useRed;
    return { ...s, edges: s.edges.concat([[a, b, red]]), nextRed: !s.nextRed };
  }

  /** Remove last (Pop): the newest line goes, and the alternation steps back. */
  function removeLast(s) {
    if (!s.edges.length) return null;
    return { ...s, edges: s.edges.slice(0, -1), nextRed: !s.nextRed };
  }

  function* combinations(n, k, from = 0, acc = []) {
    if (acc.length === k) { yield acc.slice(); return; }
    for (let i = from; i <= n - (k - acc.length); i++) { acc.push(i); yield* combinations(n, k, i + 1, acc); acc.pop(); }
  }

  /** Every set of k points joined all in one colour (IsThereCompleteGraph). */
  function cliques(s, colour, k) {
    const c = colourOf(s), out = [];
    for (const set of combinations(s.n, k)) {
      let ok = true;
      for (let i = 0; i < set.length && ok; i++) for (let j = i + 1; j < set.length && ok; j++) if (c.get(key(set[i], set[j])) !== colour) ok = false;
      if (ok) out.push(set);
    }
    return out;
  }

  /** CheckFinished: the red and blue complete graphs found, and whether the drawing is over. */
  function check(s) {
    const red = cliques(s, "red", s.nRed), blue = cliques(s, "blue", s.nBlue);
    const all = s.edges.length === (s.n * (s.n - 1)) / 2;
    return { red, blue, finished: red.length > 0 || blue.length > 0 || all, complete: all };
  }
  const finished = (s) => check(s).finished;

  /** "done" once the drawing is finished (a one-colour clique, or every line drawn). */
  const result = (s) => (finished(s) ? "done" : null);

  /** Count one-colour triangles of a complete colouring given as colour(a, b). */
  function monoTriangles(n, colour) {
    let t = 0;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
      const x = colour(a, b);
      if (x === colour(a, c) && x === colour(b, c)) t++;
    }
    return t;
  }

  return { N_RANGE, K_RANGE, start, draw, removeLast, joined, cliques, check, finished, result, combinations, monoTriangles };
})();
