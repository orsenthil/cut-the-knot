"use strict";

/*
 * Circle Inscribed in a Circular Segment, from Alexander Bogomolny's applet
 * IncircleInSegment.
 *
 * A chord ST is drawn across a big circle. A small circle sits in one of the
 * two circular segments: it touches the chord at A and the big circle at B.
 * The page claims that A, B and M are collinear, where M is the midpoint of
 * the arc cut off by ST on the side away from B.
 *
 * The one idea behind this file is that, with M fixed at the bottom of the
 * circle, the chord is horizontal. Inverting the big circle in the circle
 * centred at M through A and B turns it into that horizontal chord; the small
 * circle is then the circle above the chord with centre on the radius OB.
 * Writing h = M.y - A.y and q = |MA|^2, the second meeting T of line MA with
 * the big circle satisfies MT/MA = 2R*h/q, so the small radius is
 *
 *     rho = R * (1 - q/(2R*h)),
 *
 * its centre is rho above A, and B = M + (2R*h/q)(A - M). All the page's
 * claims (collinearity, arc midpoint, tangency, the homothety A -> M) are
 * then simple facts about that one number.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, IncircleInSegmentCore, so the page loads it
 * with a plain <script> and porting/check-incircle-in-segment.mjs loads it in
 * Node. The position is plain data and every function returns a new position.
 */
const IncircleInSegmentCore = (() => {
  /** The board, in the same screen coordinates the SVG uses. */
  const VIEW = { width: 420, height: 300 };
  const O = { x: 210, y: 145 };
  const R = 100;
  /** The applet puts M at the bottom of its circle and leaves it there. */
  const M = { x: O.x, y: O.y + R };

  /** The applet picks A at random on a circle of radius R/2; use a fixed one. */
  const START_ANGLE = (3 * Math.PI) / 4;
  const START = {
    x: O.x + (R / 2) * Math.cos(START_ANGLE),
    y: O.y - (R / 2) * Math.sin(START_ANGLE),
  };

  /** Keep A inside the big circle and far enough from M for a real circle. */
  const MAX_D = R * 0.92;
  const MIN_H = 12;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** The only point the player drags. A stays in the valid part of the disc. */
  function project(p) {
    if (!finite(p)) return null;
    let dx = p.x - O.x, dy = Math.min(p.y, M.y - MIN_H) - O.y;
    const d = Math.hypot(dx, dy);
    if (d > MAX_D) {
      dx *= MAX_D / d;
      dy *= MAX_D / d;
    }
    return { x: O.x + dx, y: O.y + dy };
  }

  /** A new drawing starts with A at the applet's sort of position. */
  function start() {
    return { A: project(START), hint: false, explored: false };
  }

  /** Drag A. A drag that changes nothing leaves the position alone. */
  function move(state, p) {
    const A = project(p);
    if (!A) return state;
    if (A.x === state.A.x && A.y === state.A.y) return state;
    return { ...state, A, explored: true };
  }

  /** The applet's one checkbox: show the proof lines. */
  function setOption(state, name, value) {
    if (name !== "hint") return state;
    if (state.hint === !!value) return state;
    return { ...state, hint: !!value, explored: state.explored || !!value };
  }

  /** Reset restores A but keeps the player's display choice. */
  function reset(state) {
    return { ...start(), hint: state.hint };
  }

  /** An illustration has no win, loss or finish. */
  function result() {
    return null;
  }

  function legalMoves() {
    return ["A"];
  }

  /**
   * The whole construction, in board units. A is the tangency on the chord,
   * B the tangency on the big circle, M the midpoint of the arc away from B.
   * Returns null only for positions that cannot give a small circle.
   */
  function construct(a) {
    if (!finite(a)) return null;
    const dx = a.x - M.x, dy = a.y - M.y;
    const q = dx * dx + dy * dy;
    const h = M.y - a.y;
    if (!(h > 1e-6) || !(q > 1e-9)) return null;

    // T is where the ray M->A leaves the big circle. A lies inside it, so
    // the scale is greater than one and the small radius is positive.
    const t = (2 * R * h) / q;
    if (!(t > 1)) return null;
    const B = { x: M.x + t * dx, y: M.y + t * dy };
    const rho = R * (1 - 1 / t);

    // The centre lies rho above A (the chord is horizontal through A).
    const Op = { x: a.x, y: a.y - rho };

    // The chord ST is the horizontal line through A.
    const v = a.y - O.y;
    const half = Math.sqrt(Math.max(0, R * R - v * v));
    const S = { x: O.x - half, y: a.y };
    const T = { x: O.x + half, y: a.y };

    // Extending AB beyond A meets the perpendicular OM at M itself.
    const N = Math.abs(dx) < 1e-9 ? { ...M } : {
      x: M.x + ((O.x - M.x) / dx) * dx,
      y: M.y + ((O.x - M.x) / dx) * dy,
    };

    // Of the two arc midpoints of the horizontal chord, take the one on the
    // other side of the chord from B: that is the arc B does not lie on.
    const top = { x: O.x, y: O.y - R };
    const bottom = { x: O.x, y: O.y + R };
    const arcMid = (top.y - a.y) * (B.y - a.y) < 0 ? top : bottom;

    // Homothety with centre B and factor R/rho maps the small circle to the
    // big one, so it must carry A (the bottom of the small circle) to M.
    const k = R / rho;
    const mappedA = { x: B.x + k * (a.x - B.x), y: B.y + k * (a.y - B.y) };

    return {
      A: a, B: B, M: M, O: O, Op: Op, N: N, S: S, T: T,
      R: R, rho: rho, scale: t, arcMid: arcMid, mappedA: mappedA,
      circles: {
        big: { c: O, r: R },
        incircle: { c: Op, r: rho },
      },
    };
  }

  /** The construction for the current position. */
  function geometry(state) {
    return construct(state.A);
  }

  /** What the status line says under the picture. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move A inside the big circle, away from M.";
    return "The circle touches the chord at A and the big circle at B. " +
      "A, B and M lie on one line (radius " + g.rho.toFixed(1) + ")." +
      (state.hint ? " Dashed lines show the proof." : "");
  }

  return {
    VIEW, O, R, M, START, START_ANGLE, MAX_D, MIN_H,
    start, move, setOption, reset, result, legalMoves,
    project, construct, geometry, describe, distance,
  };
})();
