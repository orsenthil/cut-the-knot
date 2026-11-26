"use strict";

/*
 * Arbelos Incircle, from Alexander Bogomolny's applet ArbelosIncircle.
 *
 * An arbelos is the shape left when the two half-circles on AC and CB are cut
 * out of the half-circle on AB. M and N are the highest points of the two
 * small half-circles. The circle tucked into the arbelos touches all three
 * arcs; the page claims that AN, BM and CD meet at one point S and that S is
 * on that circle. Its remark gives a construction: S = AN ∩ BM, then D is
 * where CS meets the big arc.
 *
 * The one idea here is the radius of that circle. With r1 = AC/2 and
 * r2 = CB/2 the big radius is R = r1 + r2 and the inscribed circle has
 *
 *     rho = r1*r2*(r1+r2)/(r1*r1 + r1*r2 + r2*r2),
 *
 * its centre is 2*rho above the baseline, and D, E, F are the points where
 * the line from each arc's centre to that centre meets its arc. Everything
 * else in the page's claim follows by intersecting two lines.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, ArbelosIncircleCore, so the page loads it
 * with a plain <script> and porting/check-arbelos-incircle.mjs loads it in
 * Node. The position is plain data and every function returns a new position.
 */
const ArbelosIncircleCore = (() => {
  /** The applet's 400x250 canvas: margin 30, size 340, baseline y = 220. */
  const VIEW = { width: 400, height: 250 };
  const BASE_Y = 220;
  const A = { x: 30, y: BASE_Y };
  const B = { x: 370, y: BASE_Y };
  /** PointIsEligible in the applet keeps C this far from A and B. */
  const GAP = 10;
  /** The applet starts C at 0.6*A.x + 0.7*B.x (277 here). */
  const START_X = 0.6 * A.x + 0.7 * B.x;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** The point of a circle nearest to p, along the ray from its centre. */
  function touchPoint(centre, radius, p) {
    const d = distance(centre, p);
    if (!(radius > 0) || !(d > 0)) return null;
    const t = radius / d;
    return { x: centre.x + (p.x - centre.x) * t, y: centre.y + (p.y - centre.y) * t };
  }

  /** Intersection of the infinite lines a--b and c--d; null if parallel. */
  function intersect(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const cross = rx * sy - ry * sx;
    if (Math.abs(cross) < 1e-12) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
    return { x: a.x + rx * t, y: a.y + ry * t };
  }

  /** C is the only point the applet lets the player drag. */
  function project(p) {
    if (!finite(p)) return null;
    return {
      x: Math.max(A.x + GAP, Math.min(B.x - GAP, p.x)),
      y: BASE_Y,
    };
  }

  /** The position a new drawing starts from. */
  function start() {
    return {
      C: project({ x: START_X, y: BASE_Y }),
      names: true,
      guides: true,
      explored: false,
    };
  }

  /** Drag C. A drag that changes nothing leaves the position alone. */
  function move(state, p) {
    const C = project(p);
    if (!C) return state;
    if (C.x === state.C.x && C.y === state.C.y) return state;
    return { ...state, C, explored: true };
  }

  /** The two display options of the illustration. */
  function setOption(state, name, value) {
    if (name !== "names" && name !== "guides") return state;
    if (state[name] === !!value) return state;
    return { ...state, [name]: !!value };
  }

  /** Reset restores C but keeps the player's display choices. */
  function reset(state) {
    return { ...start(), names: state.names, guides: state.guides };
  }

  /** An illustration has no win, loss or finish. */
  function result() {
    return null;
  }

  function legalMoves() {
    return ["C"];
  }

  /**
   * The whole construction from three collinear points, in board units.
   * All the page's claims can be read off the returned points.
   */
  function construct(a, b, c) {
    if (!finite(a) || !finite(b) || !finite(c)) return null;
    const r1 = distance(midpoint(a, c), c);
    const r2 = distance(midpoint(b, c), c);
    if (!(r1 > 0) || !(r2 > 0)) return null;

    const O = midpoint(a, b);
    const R = distance(O, a);
    const o1 = midpoint(a, c);
    const o2 = midpoint(b, c);
    const den = r1 * r1 + r1 * r2 + r2 * r2;
    const rho = r1 * r2 * (r1 + r2) / den;
    const P = {
      x: a.x + rho * (2 * r1 + r2) / r2,
      y: a.y - 2 * rho,
    };
    const M = { x: o1.x, y: a.y - r1 };
    const N = { x: o2.x, y: a.y - r2 };

    // D, E and F are the tangencies with the big, left and right arcs.
    const D = touchPoint(O, R, P);
    const E = touchPoint(o1, r1, P);
    const F = touchPoint(o2, r2, P);
    if (!D || !E || !F) return null;

    // S is where AN and BM meet; the page says CD goes through it too.
    const S = intersect(a, N, b, M);
    const onCD = S && intersect(c, D, a, N);
    if (!S || !onCD) return null;

    return {
      A: a, B: b, C: c, O: O, O1: o1, O2: o2,
      r1: r1, r2: r2, R: R, rho: rho,
      M: M, N: N, P: P, D: D, E: E, F: F, S: S,
      circles: {
        big: { c: O, r: R },
        left: { c: o1, r: r1 },
        right: { c: o2, r: r2 },
        incircle: { c: P, r: rho },
      },
    };
  }

  /** The construction for the current position. */
  function geometry(state) {
    return construct(A, B, state.C);
  }

  /** What the status line says under the picture. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Drag C between A and B.";
    return "C at " + Math.round(g.C.x) + ": AN, BM and CD meet at S, on the circle (radius " +
      g.rho.toFixed(1) + ").";
  }

  return {
    VIEW, BASE_Y, A, B, GAP, START_X,
    start, move, setOption, reset, result, legalMoves,
    project, construct, geometry, describe,
    distance, midpoint, intersect, touchPoint,
  };
})();
