"use strict";

/*
 * Stick Broken Into Three Pieces, from Alexander Bogomolny's applet
 * TriProbability.
 *
 * Break a stick into three pieces at random. Can the pieces make a
 * triangle? Only when every piece is shorter than half the stick (the
 * triangle inequality). How likely that is depends on how the stick is
 * broken.
 *
 * The picture behind it: take an equilateral triangle whose height is the
 * stick. From any point P inside, the three perpendiculars to the sides add
 * up to the height (Viviani's theorem), so P cuts the stick into three
 * pieces, and every way of cutting it is one point P. The pieces make a
 * triangle exactly when P lies in the middle triangle joining the midpoints
 * of the sides: a quarter of the area.
 *
 * The applet (TriProbabilityCanvas) lets you drag P, starts it at the
 * weights (2, 4, 3)/9 of the corners, draws the perpendiculars, the stick
 * cut into those three lengths, and the triangle they make when they can.
 * This port adds breaking a stick at random in the page's four ways and
 * counting how often a triangle comes out:
 *   uniform       two break points, both uniform on the stick: 1/4
 *   longer        break once, then break the longer piece: 2 ln 2 - 1
 *   coin          break once, then either piece with chance 1/2: ln 2 - 1/2
 *   proportional  break once, then a piece with chance its length: 1/4
 *
 * A position is the three pieces as fractions of the stick (P's trilinear
 * coordinates, here also its barycentric ones). This file is the game's
 * logic and nothing else. It defines one global, StickInThreeCore.
 */
const StickInThreeCore = (() => {
  const METHODS = ["uniform", "longer", "coin", "proportional"];
  const EXACT = { uniform: 1 / 4, longer: 2 * Math.log(2) - 1, coin: Math.log(2) - 1 / 2, proportional: 1 / 4 };
  const START = [2 / 9, 4 / 9, 3 / 9];

  /** Pieces held to the triangle: no negatives, adding up to 1. */
  function normal(p) {
    const q = (Array.isArray(p) && p.length === 3 ? p : START).map((x) => (Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : 0));
    const s = q[0] + q[1] + q[2];
    return s > 0 ? q.map((x) => x / s) : START.slice();
  }

  function start(options = {}) {
    return {
      pieces: normal(options.pieces),
      method: METHODS.includes(options.method) ? options.method : "uniform",
      tries: 0, hits: 0,
      seed: Number.isInteger(options.seed) ? options.seed >>> 0 : 20240607,
    };
  }

  /** The pieces make a triangle when each is less than half the stick. */
  const forms = (p) => p.every((x) => x < 0.5);

  /** Mulberry32: a small seeded generator, so a run can be repeated. */
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

  /** One stick broken in the given way, from two random numbers u, v and a third w. */
  function breakWith(method, u, v, w) {
    if (method === "uniform") { const x = Math.min(u, v), y = Math.max(u, v); return [x, y - x, 1 - y]; }
    let pick; // which piece is broken again: 0 the left (length u), 1 the right
    if (method === "longer") pick = u < 0.5 ? 1 : 0;
    else if (method === "coin") pick = w < 0.5 ? 0 : 1;
    else pick = w < u ? 0 : 1;
    return pick === 0 ? [u * v, u * (1 - v), 1 - u] : [u, (1 - u) * v, (1 - u) * (1 - v)];
  }

  /** Break n sticks: the last pieces, and the tally. */
  function breakSticks(s, n) {
    const k = Math.max(1, Math.min(100000, Math.round(Number(n)) || 1));
    const r = rng(s.seed);
    let hits = 0, pieces = s.pieces;
    for (let i = 0; i < k; i++) {
      pieces = breakWith(s.method, r.next(), r.next(), r.next());
      if (forms(pieces)) hits++;
    }
    return { ...s, pieces, tries: s.tries + k, hits: s.hits + hits, seed: r.seed() };
  }

  const moveTo = (s, pieces) => ({ ...s, pieces: normal(pieces) });
  const setMethod = (s, method) => (METHODS.includes(method) ? { ...s, method, tries: 0, hits: 0 } : null);

  /** The triangle with sides a, b, c: corners, base c along the x axis. Null if it does not close. */
  function triangle(p) {
    const [a, b, c] = p;
    if (!forms(p)) return null;
    const x = (b * b + c * c - a * a) / (2 * c);
    return [[0, 0], [c, 0], [x, Math.sqrt(Math.max(0, b * b - x * x))]];
  }

  /** The longest piece, and by how much it beats the other two together (>= 0: no triangle). */
  function excess(p) {
    const i = p.indexOf(Math.max(...p));
    return { longest: i, by: p[i] - (1 - p[i]) };
  }

  return { METHODS, EXACT, START, normal, start, forms, rng, breakWith, breakSticks, moveTo, setMethod, triangle, excess };
})();
