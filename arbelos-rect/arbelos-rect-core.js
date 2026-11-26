"use strict";

/*
 * Rectangle in Arbelos, from Alexander Bogomolny's applet ArbelosRect and its
 * cut-the-knot page. A point C on the diameter AB picks the point D directly
 * above it on the big semicircle. The lines AD and BD meet the two small
 * semicircles again at E and F. The page claims exactly two things: CEDF is a
 * rectangle, and EF is a common tangent to the two small semicircles.
 *
 * The one identity behind all of it is CD^2 = AC * CB: D lies on the big
 * semicircle, so the upright through C is the mean proportional of the two
 * pieces of the diameter. From that, E and F lie at heights proportional to
 * AC and CB, CEDF is a parallelogram with a right angle, and EF = CD. The
 * same identity gives the area equality of the arbelos family: the shoemaker's
 * knife has area pi * CD^2 / 4, the area of the circle on CD as diameter.
 *
 * This file is only the logic: no document, no window, no storage. It defines
 * one global, ArbelosRectCore. The position is plain data (the fraction t of
 * the way from A to B where C sits), so it can be saved and given to a tutor.
 */

const ArbelosRectCore = (() => {
  // ArbelosRectCanvas.init: margin 30; side = min(w - 2m, 2(h - 2m)).
  const WIDTH = 400;
  const HEIGHT = 250;
  const MARGIN = 30;
  const SIDE = Math.min(WIDTH - 2 * MARGIN, 2 * (HEIGHT - 2 * MARGIN)); // 340
  const RECT = {
    x: MARGIN,
    y: HEIGHT - MARGIN - SIDE / 2, // 50, the top of the big semicircle
    width: SIDE,
    height: SIDE,
  };
  const BASE_Y = HEIGHT - MARGIN; // 220, the diameter AB

  // DoubLine.CreateMidPoint(0.3) puts the draggable C 30% along AB.
  const START_T = 0.3;
  // PointIsEligible refuses mouse releases within 5 pixels of A or B.
  const MIN_GAP = 5;

  const clampT = (t) => {
    const lo = MIN_GAP / SIDE;
    const hi = 1 - lo;
    const v = Number.isFinite(t) ? t : START_T;
    return Math.max(lo, Math.min(hi, v));
  };

  /** The position a new diagram starts from. */
  function start(options) {
    const t = options && options.t !== undefined ? options.t : START_T;
    return { t: clampT(t) };
  }

  /** Move C to a new fraction of AB; the input is never changed. */
  function setT(state, t) {
    return { t: clampT(t) };
  }

  /** The fraction belonging to a point in board units (from a drag). */
  function fractionAtX(x) {
    return clampT((x - RECT.x) / SIDE);
  }

  /** The applet's PointIsEligible: an interior point above the diameter. */
  function eligible(x, y) {
    return x > RECT.x + MIN_GAP && y > RECT.y &&
      x < RECT.x + SIDE - MIN_GAP && y < BASE_Y - 2;
  }

  /** Everything the page draws and reports, derived from t alone. */
  function geometry(state) {
    const t = clampT(state.t);
    const A = { x: RECT.x, y: BASE_Y };
    const B = { x: RECT.x + SIDE, y: BASE_Y };
    const C = { x: RECT.x + SIDE * t, y: BASE_Y };
    const a = C.x - A.x; // AC
    const b = B.x - C.x; // CB
    const cd = Math.sqrt(a * b); // Draw(): C.y - sqrt((C.x-A)*(B-C.x))
    const D = { x: C.x, y: BASE_Y - cd };

    // FindCrossPoint(0/1): the second meeting of AD/BD with the full circle
    // on AC/CB. With A at the origin and y upwards these are (a^2/L, a*CD/L)
    // and (L - b^2/L, b*CD/L); the page uses y downwards, hence the minus.
    const L = a + b;
    const E = { x: A.x + (a * a) / L, y: BASE_Y - (a * cd) / L };
    const F = { x: B.x - (b * b) / L, y: BASE_Y - (b * cd) / L };

    const Oa = { x: A.x + a / 2, y: BASE_Y };
    const Ob = { x: C.x + b / 2, y: BASE_Y };
    const O = { x: (C.x + D.x) / 2, y: (C.y + D.y) / 2 }; // centre of CEDF
    const outer = { x: A.x + L / 2, y: BASE_Y };

    const edge = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
    const CE = edge(C, E);
    const ED = edge(E, D);

    return {
      t: t,
      A: A, B: B, C: C, D: D, E: E, F: F,
      O: O, Oa: Oa, Ob: Ob, outer: outer,
      a: a, b: b, L: L,
      r1: a / 2, r2: b / 2, R: L / 2,
      CD: cd,
      EF: edge(E, F),
      CE: CE, ED: ED,
      rectangleArea: CE * ED,
      // Archimedes' area equality for the three-semicircle arbelos.
      arbelosArea: (Math.PI * a * b) / 4,
      circleArea: (Math.PI * cd * cd) / 4,
    };
  }

  /** A compact, JSON-safe summary for Track.state and the tutor. */
  function position(state) {
    const g = geometry(state);
    const round = (v) => Number(v.toFixed(6));
    const pt = (p) => ({ x: round(p.x), y: round(p.y) });
    return {
      t: round(g.t),
      A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D), E: pt(g.E), F: pt(g.F),
      AC: round(g.a), CB: round(g.b), CD: round(g.CD), EF: round(g.EF),
      rectangleArea: round(g.rectangleArea),
      arbelosArea: round(g.arbelosArea),
      circleArea: round(g.circleArea),
    };
  }

  return {
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    MARGIN: MARGIN,
    SIDE: SIDE,
    RECT: RECT,
    BASE_Y: BASE_Y,
    START_T: START_T,
    MIN_GAP: MIN_GAP,
    clampT: clampT,
    start: start,
    setT: setT,
    fractionAtX: fractionAtX,
    eligible: eligible,
    geometry: geometry,
    position: position,
  };
})();
