"use strict";

/*
 * Sierpinski Gasket via Chaos Game, from Alexander Bogomolny's applet
 * SierpinskiChaosGame.
 *
 * Three maps pull a point halfway towards a corner of triangle ABC:
 * F_A(x) = (x + A)/2, F_B(x) = (x + B)/2, F_C(x) = (x + C)/2. Start at a
 * corner and, again and again, pick a corner at random and move halfway to
 * it. The dots never fall in the holes of the Sierpinski gasket, and in the
 * long run they come near every point of it.
 *
 * The idea: the gasket is the one set that the three maps together carry
 * onto itself. A corner is in it, so every dot is; and a run of k random
 * choices lands in a sub-triangle of size 1/2^k chosen by those very
 * choices, so every small sub-triangle is visited sooner or later.
 *
 * From SierpinskiChaosGameCanvas: run() takes V = RandomVertex() (A when
 * 3r < 1, B when 3r < 2, else C); the first point P is V itself, after that
 * Q = P and P = (Q + V)/2. Dragging a corner or the triangle stops the run
 * and wipes the dots. Delay 0..5000 ms (200), pixel size 1..11 (2).
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SierpinskiChaosGameCore. The position is plain data.
 */
const SierpinskiChaosGameCore = (() => {
  const DELAY = { min: 0, max: 5000, def: 200 };
  const PIXEL = { min: 1, max: 11, def: 2 };

  /** The applet's starting triangle in a w x h canvas (init). */
  function defaultTriangle(w, h) {
    const cx = w / 2, cy = h / 2, r = w / 4, d = Math.trunc(h / 4);
    return {
      A: { x: cx - r, y: cy + d },
      B: { x: cx + r, y: cy + d },
      C: { x: cx + r * Math.cos(Math.PI / 3), y: cy - r * Math.sin(Math.PI / 3) - d / 2 },
    };
  }

  function start(options = {}) {
    const w = options.width || 600, h = options.height || 450;
    const t = options.triangle || defaultTriangle(w, h);
    return { A: { ...t.A }, B: { ...t.B }, C: { ...t.C }, P: null, Q: null, V: null, count: 0 };
  }

  /** RandomVertex: r in [0, 1). */
  function vertexFor(s, r) {
    const u = r * 3;
    return u < 1 ? "A" : u < 2 ? "B" : "C";
  }

  /** One pass of run(): the new position after the choice r. */
  function step(s, r) {
    const which = vertexFor(s, r);
    const V = s[which];
    if (!s.P) return { ...s, V: { ...V }, P: { ...V }, Q: null, last: which, count: s.count + 1 };
    const Q = { ...s.P };
    return { ...s, V: { ...V }, Q, P: { x: (Q.x + V.x) / 2, y: (Q.y + V.y) / 2 }, last: which, count: s.count + 1 };
  }

  /** Moving a corner (or the whole triangle) wipes the dots, as mousePressed sets P = null. */
  function moveCorner(s, which, x, y) {
    if (!["A", "B", "C"].includes(which) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { ...s, [which]: { x, y }, P: null, Q: null, V: null, count: 0 };
  }
  function moveTriangle(s, dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
    const m = (p) => ({ x: p.x + dx, y: p.y + dy });
    return { ...s, A: m(s.A), B: m(s.B), C: m(s.C), P: null, Q: null, V: null, count: 0 };
  }

  /** The barycentric coordinates of a point with respect to ABC. */
  function barycentric(s, p) {
    const { A, B, C } = s;
    const det = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    const a = ((B.y - C.y) * (p.x - C.x) + (C.x - B.x) * (p.y - C.y)) / det;
    const b = ((C.y - A.y) * (p.x - C.x) + (A.x - C.x) * (p.y - C.y)) / det;
    return [a, b, 1 - a - b];
  }

  /**
   * Is the point in the gasket to depth `levels`? At each level it must lie
   * in one of the three corner triangles (some coordinate at least 1/2), which
   * is then blown up to the whole triangle.
   */
  function inGasket(s, p, levels = 12, eps = 1e-9) {
    let [a, b, c] = barycentric(s, p);
    for (let k = 0; k < levels; k++) {
      if (a < -eps || b < -eps || c < -eps) return false;
      if (a >= 0.5 - eps) { a = 2 * a - 1; b *= 2; c *= 2; }
      else if (b >= 0.5 - eps) { b = 2 * b - 1; a *= 2; c *= 2; }
      else if (c >= 0.5 - eps) { c = 2 * c - 1; a *= 2; b *= 2; }
      else return false;
    }
    return true;
  }

  return { DELAY, PIXEL, defaultTriangle, start, vertexFor, step, moveCorner, moveTriangle, barycentric, inGasket };
})();
