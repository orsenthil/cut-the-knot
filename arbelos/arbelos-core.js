"use strict";

/*
 * Arbelos, from Alexander Bogomolny's applet Arbelos and the article
 * "Arbelos - the Shoemaker's Knife" (cut-the-knot.org/proofs/arbelos.shtml).
 *
 * A big semicircle has diameter AB; a point N on AB splits it into AN = a and
 * NB = b. The two smaller semicircles on AN and NB leave the shoemaker's knife
 * between them. The upright at N reaches the big arc at P; its length is
 * PN = sqrt(a*b), because a point on a circle is the mean proportional of the
 * two parts of a diameter through it. That one identity gives every claim on
 * the page: the knife's area is the area of the circle on PN, the three arcs
 * satisfy big = left + right, and in the full three-circle version the gap is
 * pi*t^2/8 with t the tangent chord at the contact point.
 *
 * This file is only the logic: no document, no window, no storage. It defines
 * one global, ArbelosCore. The position is plain data - just the fraction t of
 * the way from A to B where N sits - so it can be saved and given to the tutor.
 */

const ArbelosCore = (() => {
  // ArbelosCanvas.init: margin 20, side = min(w-2m, 2*(h-2m)).
  const MARGIN = 20;
  const WIDTH = 360;
  const HEIGHT = 240;
  const DIAMETER = Math.min(WIDTH - 2 * MARGIN, 2 * (HEIGHT - 2 * MARGIN)); // 320
  const RECT = {
    x: MARGIN,
    y: HEIGHT - MARGIN - DIAMETER / 2,
    width: DIAMETER,
    height: DIAMETER,
  };
  const BASE_Y = RECT.y + RECT.height / 2; // the diameter AB, y = 220

  // DoubLine.CreateMidPoint(0.3) puts the draggable point 30% along AB.
  const START_T = 0.3;
  // PointIsEligible refuses the first and last 2 pixels of the segment.
  const MIN_GAP = 2;

  const clampT = (t) => {
    const lo = MIN_GAP / DIAMETER;
    const hi = 1 - lo;
    const v = Number.isFinite(t) ? t : START_T;
    return Math.max(lo, Math.min(hi, v));
  };

  /** The position a new diagram starts from. */
  function start(options) {
    const t = options && options.t !== undefined ? options.t : START_T;
    return { t: clampT(t) };
  }

  /** Move N to a new fraction of AB; the input is never changed. */
  function setT(state, t) {
    return { t: clampT(t) };
  }

  /** The fraction belonging to a point in board units (from a drag). */
  function fractionAtX(x) {
    return clampT((x - RECT.x) / DIAMETER);
  }

  /** Everything the page draws and reports, derived from t alone. */
  function geometry(state) {
    const t = clampT(state.t);
    const a = DIAMETER * t;
    const b = DIAMETER - a;
    const r1 = a / 2;
    const r2 = b / 2;
    const R = DIAMETER / 2;
    const A = { x: RECT.x, y: BASE_Y };
    const B = { x: RECT.x + DIAMETER, y: BASE_Y };
    const N = { x: RECT.x + a, y: BASE_Y };
    const altitude = Math.sqrt(a * b); // PN
    const chord = 2 * altitude; // t in the article: the whole tangent chord
    const P = { x: N.x, y: BASE_Y - altitude };

    return {
      t: t,
      A: A,
      B: B,
      N: N,
      P: P,
      a: a,
      b: b,
      r1: r1,
      r2: r2,
      R: R,
      leftCenter: { x: RECT.x + r1, y: BASE_Y },
      rightCenter: { x: RECT.x + a + r2, y: BASE_Y },
      altitude: altitude,
      chord: chord,
      circle: { center: { x: N.x, y: BASE_Y - altitude / 2 }, radius: altitude / 2 },
      // Proposition 4 (the upper-half arbelos).
      arbelosArea: Math.PI * a * b / 4,
      circleArea: Math.PI * (altitude / 2) * (altitude / 2),
      // The article's problem: the whole gap between three tangent circles.
      fullArea: Math.PI * chord * chord / 8,
      // The boundary claim: the big arc equals the two small arcs together.
      bigArc: Math.PI * R,
      smallArc: Math.PI * r1 + Math.PI * r2,
    };
  }

  /** A compact, JSON-safe summary for Track.state and the tutor. */
  function position(state) {
    const g = geometry(state);
    const round = (v) => Number(v.toFixed(6));
    return {
      t: round(g.t),
      N: { x: round(g.N.x), y: round(g.N.y) },
      a: round(g.a),
      b: round(g.b),
      altitude: round(g.altitude),
      chord: round(g.chord),
      arbelosArea: round(g.arbelosArea),
      circleArea: round(g.circleArea),
    };
  }

  return {
    MARGIN: MARGIN,
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    DIAMETER: DIAMETER,
    RECT: RECT,
    BASE_Y: BASE_Y,
    START_T: START_T,
    MIN_GAP: MIN_GAP,
    clampT: clampT,
    start: start,
    setT: setT,
    fractionAtX: fractionAtX,
    geometry: geometry,
    position: position,
  };
})();
