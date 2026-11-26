"use strict";

/*
 * Arbelos PWW, from Alexander Bogomolny's applet ArbelosPWW and the article
 * "The Area of Arbelos" (cut-the-knot.org/Curriculum/Geometry/ArbelosPWW.shtml).
 *
 * A big semicircle has diameter AB; the point N on AB splits it into AN = a
 * and NB = b. The two smaller semicircles on AN and NB leave the shoemaker's
 * knife. The perpendicular to AB at N meets the big circle at P above and D
 * below, and both half-chords have length h = sqrt(a*b) (the geometric mean).
 *
 * The page's proof without words (R. Nelsen, after Archimedes' Proposition 4)
 * uses the Pythagorean theorem three times in Euclid's semicircle form: the
 * semicircle on a right triangle's hypotenuse equals the two on its legs.
 *   blue: on triangle AND,  semicircle(AD) = semicircle(AN) + semicircle(ND)
 *   red:  on triangle BND,  semicircle(BD) = semicircle(BN) + semicircle(ND)
 *   big:  on triangle ADB,  semicircle(AB) = semicircle(AD) + semicircle(BD)
 * Combining gives semicircle(AB) - semicircle(AN) - semicircle(NB) =
 * semicircle(ND) + semicircle(ND), a whole circle on the perpendicular. Its
 * area is pi*h*h/4 = pi*a*b/4, exactly the arbelos. That is the claim tested
 * over thousands of positions in porting/check-arbelos-pww.mjs.
 *
 * This file is only the geometry: no document, no window, no storage. It
 * defines one global, ArbelosPwwCore. The position is plain data - just the
 * fraction t of the way from A to B where N sits - so it can be saved and
 * handed to the tutor as it is.
 */

const ArbelosPwwCore = (() => {
  // ArbelosPWWCanvas.init(): margin 80, side = min(w-2m, h-2m).
  // The cut-the-knot page embeds the applet at WIDTH=500, HEIGHT=500.
  const WIDTH = 500;
  const HEIGHT = 500;
  const MARGIN = 80;
  const SIDE = Math.min(WIDTH - 2 * MARGIN, HEIGHT - 2 * MARGIN); // 340
  const RECT = { x: MARGIN, y: MARGIN, width: SIDE, height: SIDE };
  // CreateMidPoint() puts the draggable point on the middle row of the rect.
  const BASE_Y = RECT.y + RECT.height / 2; // 250
  // DoubLine.CreateMidPoint(0.3) starts the point 30% of the way from A to B.
  const START_T = 0.3;
  // PointIsEligible() refuses the first and last two pixels of the segment.
  const MIN_GAP = 2;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  /** GeoSDoub.ComputeAngle(a,b,c): the angle at a, by the law of cosines. */
  function computeAngle(a, b, c) {
    const num = sqDist(a, b) + sqDist(a, c) - sqDist(b, c);
    const den = 2 * dist(a, b) * dist(a, c);
    if (!den) return 0;
    return Math.acos(Math.max(-1, Math.min(1, num / den)));
  }

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

  /** Move N to a new fraction of AB; the input is never changed. */
  function setT(state, t) {
    return { t: clampT(t) };
  }

  /** The fraction belonging to a point in board units (from a drag). */
  function fractionAtX(x) {
    return clampT((x - RECT.x) / SIDE);
  }

  function legalMoves(state) {
    return ["t"];
  }

  function move(state, t) {
    return setT(state, t);
  }

  /** A picture has no win and no loss. */
  function result(state) {
    return null;
  }

  /** The area of a semicircle with the given diameter. */
  const semiArea = (d) => Math.PI * d * d / 8;

  /** Everything the page draws and reports, derived from t alone. */
  function geometry(state) {
    const t = clampT(state && state.t);
    const a = SIDE * t;
    const b = SIDE - a;
    const A = { x: RECT.x, y: BASE_Y };
    const B = { x: RECT.x + SIDE, y: BASE_Y };
    const N = { x: RECT.x + a, y: BASE_Y };
    const R = SIDE / 2;
    const h = Math.sqrt(a * b); // the perpendicular at N; also sqrt(a*b)

    const centre = { x: RECT.x + R, y: BASE_Y };
    const P = { x: N.x, y: BASE_Y - h };
    const D = { x: N.x, y: BASE_Y + h };
    const leftCentre = { x: RECT.x + a / 2, y: BASE_Y };
    const rightCentre = { x: N.x + b / 2, y: BASE_Y };

    // DrawArbelosPWW(): L10 = ComputeAngle(A, D, N), L12 = its supplement in
    // degrees, L19 = 90 - 180 - L12 + 180. They orient the sloping semicircles.
    const AD = dist(A, D);
    const BD = dist(B, D);
    const angleA = computeAngle(A, D, N);
    const blueStartDeg = Math.round((Math.PI - angleA) * 180 / Math.PI);
    const redStartDeg = 90 - (180 - blueStartDeg) + 180; // = blueStartDeg + 90

    const semiBig = semiArea(SIDE);
    const semiAN = semiArea(a);
    const semiBN = semiArea(b);
    const semiND = semiArea(h);
    const semiAD = semiArea(AD);
    const semiBD = semiArea(BD);
    const arbelosArea = semiBig - semiAN - semiBN;
    // The orange circle above N and the blue+red halves below N both have
    // diameter h and so the same area as the arbelos (Proposition 4).
    const circleArea = Math.PI * (h / 2) ** 2;
    const lowerCircleArea = 2 * semiND;

    return {
      t: t,
      A: A, B: B, N: N, P: P, D: D, centre: centre,
      leftCentre: leftCentre, rightCentre: rightCentre,
      a: a, b: b, R: R, h: h,
      AD: AD, BD: BD, ND: h,
      angleA: angleA,
      blueStartDeg: blueStartDeg, redStartDeg: redStartDeg,
      circle: { centre: { x: N.x, y: BASE_Y - h / 2 }, radius: h / 2 },
      semiBig: semiBig, semiAN: semiAN, semiBN: semiBN, semiND: semiND,
      semiAD: semiAD, semiBD: semiBD,
      arbelosArea: arbelosArea, circleArea: circleArea,
      lowerCircleArea: lowerCircleArea,
    };
  }

  /** A compact, JSON-safe summary for Track.state and the tutor. */
  function position(state) {
    const g = geometry(state);
    const round = (v) => Number(v.toFixed(6));
    return {
      t: round(g.t),
      N: { x: round(g.N.x), y: round(g.N.y) },
      P: { x: round(g.P.x), y: round(g.P.y) },
      D: { x: round(g.D.x), y: round(g.D.y) },
      a: round(g.a), b: round(g.b), h: round(g.h),
      AD: round(g.AD), BD: round(g.BD),
      blueStartDeg: g.blueStartDeg, redStartDeg: g.redStartDeg,
      arbelosArea: round(g.arbelosArea), circleArea: round(g.circleArea),
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, MARGIN: MARGIN, SIDE: SIDE,
    RECT: RECT, BASE_Y: BASE_Y, START_T: START_T, MIN_GAP: MIN_GAP,
    clampT: clampT, start: start, setT: setT, fractionAtX: fractionAtX,
    legalMoves: legalMoves, move: move, result: result,
    geometry: geometry, position: position,
    dist: dist, computeAngle: computeAngle, semiArea: semiArea,
  };
})();
