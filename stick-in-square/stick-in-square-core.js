"use strict";

/*
 * Stick Broken Into Three Pieces (Cartesian), from Alexander Bogomolny's
 * applet TriProbCartesian.
 *
 * Break a stick of length 1 at two points x and y, measured from its lower
 * end. Every experiment is a point P = (x, y) of the unit square. The three
 * pieces min(x, y), |x - y| and 1 - max(x, y) make a triangle when each is
 * shorter than 1/2: P must lie in one of two pink triangles, each joining
 * the centre of the square to the midpoints of two neighbouring sides.
 * Together they cover 1/4 of the square.
 *
 * "One step experiment": both points uniform, P uniform in the square, the
 * chance is 1/4. "Two steps experiment": break once at x, then break the
 * longer piece. Points where the shorter piece was broken (the two green
 * triangles along the diagonal) cannot happen, so 1/3 of what is left is
 * pink, but P is no longer uniform: the chance is 2 ln 2 - 1, not 1/3.
 *
 * From TriProbCartesianCanvas: the square's corners V0 (top left), V1, V2,
 * V3 counterclockwise, P starting at the weights (2, 4, 3)/9 of V0, V1, V2,
 * x its distance from the left side and y from the bottom; MidTriangle1/2
 * the pink triangles and MidTriangle3/4 the green ones, shown in the
 * two-step mode. This port adds random experiments in either mode, drawn
 * as dots, with a running count.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * StickInSquareCore. The position is plain data.
 */
const StickInSquareCore = (() => {
  const MODES = ["one", "two"];
  const EXACT = { one: 1 / 4, two: 2 * Math.log(2) - 1 };

  const clamp01 = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : 0.5);

  function start(options = {}) {
    return {
      x: options.x === undefined ? 3 / 9 : clamp01(options.x),
      y: options.y === undefined ? 2 / 9 : clamp01(options.y),
      mode: MODES.includes(options.mode) ? options.mode : "one",
      tries: 0, hits: 0,
      seed: Number.isInteger(options.seed) ? options.seed >>> 0 : 20240607,
    };
  }

  /** The pieces, from the lower end: below the lower break, between, above. */
  const pieces = (x, y) => [Math.min(x, y), Math.abs(x - y), 1 - Math.max(x, y)];
  const forms = (p) => p.every((v) => v < 0.5);

  /** Which region P is in: "pink" (a triangle), "green" (the shorter piece broken second), or "white". */
  function region(x, y) {
    if (forms(pieces(x, y))) return "pink";
    if ((y < x && x < 0.5) || (y > x && x > 0.5)) return "green";
    return "white";
  }

  function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return { next, seed: () => a };
  }

  /** One experiment from two random numbers: P = (first break, second break). */
  function experiment(mode, u, v) {
    if (mode === "one") return { x: u, y: v };
    return { x: u, y: u < 0.5 ? u + (1 - u) * v : u * v }; // the second break falls in the longer piece
  }

  /** n experiments; the dots are returned for drawing, the position keeps the last one and the count. */
  function run(s, n) {
    const k = Math.max(1, Math.min(100000, Math.round(Number(n)) || 1));
    const r = rng(s.seed), dots = [];
    let hits = 0, last = s;
    for (let i = 0; i < k; i++) {
      const p = experiment(s.mode, r.next(), r.next());
      const ok = forms(pieces(p.x, p.y));
      if (ok) hits++;
      dots.push([p.x, p.y, ok]);
      last = p;
    }
    return { state: { ...s, x: last.x, y: last.y, tries: s.tries + k, hits: s.hits + hits, seed: r.seed() }, dots };
  }

  const moveTo = (s, x, y) => ({ ...s, x: clamp01(x), y: clamp01(y) });
  const setMode = (s, mode) => (MODES.includes(mode) ? { ...s, mode, tries: 0, hits: 0 } : null);

  /** The triangle with sides p: corners, base p[2] along the x axis; null if they cannot close. */
  function triangle(p) {
    if (!forms(p)) return null;
    const [a, b, c] = p;
    const x = (b * b + c * c - a * a) / (2 * c);
    return [[0, 0], [c, 0], [x, Math.sqrt(Math.max(0, b * b - x * x))]];
  }

  return { MODES, EXACT, start, pieces, forms, region, rng, experiment, run, moveTo, setMode, triangle };
})();
