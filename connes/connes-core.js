"use strict";

/*
 * Connes — the complex-number criterion for an equilateral triangle, taken
 * from Alexander Bogomolny's applet Connes (cut-the-knot.org/Curriculum/
 * Geometry/Connes.shtml; the 2006 Wayback capture embeds the Java applet, the
 * live page now shows a GeoGebra version of the same illustration).
 *
 * The page's exact claim: with the origin O and j = rotation by +120 degrees,
 * a positively oriented triangle ABC is equilateral if and only if
 *
 *     A + jB + j^2 C = 0,
 *
 * equivalently (because 1 + j + j^2 = 0) (A-C) + j(B-C) = 0.  Geometrically:
 * B1 is B turned 120 degrees about O, C1 is C turned 120 degrees the other
 * way, and the parallelogram sum of B1 and C1 must be the point opposite A.
 *
 * The key idea in the code is that the applet multiplies the turn by the
 * triangle's orientation (GeoSDoub.FindOrientation, then Rotate): for a
 * clockwise order it uses -120/+120 instead of +120/-120.  Adding the three
 * vectors then tests the same equality whichever way the corners were
 * labelled.  The sum dot is rounded exactly as ConnesCanvas.DrawConnesSum
 * rounds it, so the drawing agrees with the applet pixel for pixel.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, ConnesCore. Positions are plain data and
 * every function returns a new object; nothing passed in is changed.
 */
const ConnesCore = (() => {
  /* The applet's literal constant: 2*pi/3 as stored in the class file. */
  const TURN = 2.0943951023931953;
  const COS = Math.cos(TURN);
  const SIN = Math.sin(TURN);
  const EPS = 1e-9;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const length = (p) => Math.hypot(p.x, p.y);
  const roundPoint = (p) => ({ x: Math.round(p.x), y: Math.round(p.y) });

  /** GeoSDoub.FindOrientation(A,B,C), compiled expression and all. */
  function orientation(s) {
    const { A, B, C } = s;
    const cross = C.x * (A.y - B.y) + C.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
    return cross > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(centre, point, TURN, sign). */
  function rotate(centre, point, sign) {
    return {
      x: centre.x + COS * (point.x - centre.x) - sign * SIN * (point.y - centre.y),
      y: centre.y + sign * SIN * (point.x - centre.x) + COS * (point.y - centre.y),
    };
  }

  /** The same turn applied to a free vector (no centre). */
  function rotateVec(v, sign) {
    return { x: COS * v.x - sign * SIN * v.y, y: sign * SIN * v.x + COS * v.y };
  }

  /** The starting triangle placed exactly as ConnesCanvas.Reset places it. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const O = { x: width / 2, y: height / 2 };
    const step = 40;
    if (o.points) {
      return {
        A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C },
        O: { ...(o.points.O || O) }, showVectors: Boolean(o.showVectors),
      };
    }
    // Reset(): A at width/2 - 4*step, B at width/2 + 2*step and
    // height/2 + 2*step, C at width/2 and height/2 - 2*step.
    return {
      A: { x: width / 2 - 4 * step, y: O.y },
      B: { x: width / 2 + 2 * step, y: O.y + 2 * step },
      C: { x: width / 2, y: O.y - 2 * step },
      O,
      showVectors: Boolean(o.showVectors),
    };
  }

  /** An exact equilateral triangle, counter-clockwise in mathematical axes. */
  function equilateralPreset(s) {
    const O = s.O;
    const r = 140;
    return {
      A: { x: O.x - r, y: O.y },
      B: { x: O.x + r / 2, y: O.y + (r * Math.sqrt(3)) / 2 },
      C: { x: O.x + r / 2, y: O.y - (r * Math.sqrt(3)) / 2 },
      O: { ...O },
      showVectors: Boolean(s.showVectors),
    };
  }

  /** Everything the applet draws in DrawConnesSum, in its own order. */
  function compute(s) {
    const sign = orientation(s);
    const B1 = rotate(s.O, s.B, sign);
    const C1 = rotate(s.O, s.C, -sign);
    // The parallelogram corner and the red sum dot, both rounded to pixels.
    const corner = roundPoint({ x: B1.x + C1.x - s.O.x, y: B1.y + C1.y - s.O.y });
    const sumDot = roundPoint({
      x: B1.x + C1.x + s.A.x - 2 * s.O.x,
      y: B1.y + C1.y + s.A.y - 2 * s.O.y,
    });
    // The vector A + jB + j^2C, written relative to the origin O: if it is
    // zero, the rounded sum dot is exactly O.
    const criterion = {
      x: s.A.x + B1.x + C1.x - 3 * s.O.x,
      y: s.A.y + B1.y + C1.y - 3 * s.O.y,
    };
    return {
      sign, B1, C1, corner, sumDot, criterion,
      criterionLength: length(criterion),
      cornerExact: { x: B1.x + C1.x - s.O.x, y: B1.y + C1.y - s.O.y },
    };
  }

  /** The page's formula with a fixed +120/-120 turn, ignoring orientation. */
  function fixedCriterion(s) {
    const a = sub(s.A, s.O), b = sub(s.B, s.O), c = sub(s.C, s.O);
    const jb = rotateVec(b, 1), j2c = rotateVec(c, -1);
    return add(add(a, jb), j2c);
  }

  function sideLengths(s) {
    return {
      AB: distance(s.A, s.B),
      BC: distance(s.B, s.C),
      CA: distance(s.C, s.A),
    };
  }

  function signedArea2(s) {
    return (s.B.x - s.A.x) * (s.C.y - s.A.y) - (s.B.y - s.A.y) * (s.C.x - s.A.x);
  }

  /** Equal sides and a real area: tolerance scales with the triangle. */
  function isEquilateral(s) {
    const sides = sideLengths(s);
    const scale = Math.max(sides.AB, sides.BC, sides.CA);
    if (scale < EPS) return false;
    const tol = 1e-8 * scale;
    return Math.abs(sides.AB - sides.BC) <= tol &&
      Math.abs(sides.BC - sides.CA) <= tol &&
      Math.abs(signedArea2(s)) > 1e-8 * scale * scale;
  }

  /**
   * The page's claims, tested at this triangle. `criterion` is the
   * orientation-aware identity the applet actually illustrates;
   * `literalPositive` is the page's written formula for its assumption of
   * positive orientation (screen cross negative, since screen y grows down);
   * `equivalent` is the "iff" in both directions.
   */
  function claims(s) {
    const m = compute(s);
    const sides = sideLengths(s);
    const scale = Math.max(sides.AB, sides.BC, sides.CA, 1);
    const tol = 1e-7 * scale;
    const eq = isEquilateral(s);
    const crit = m.criterionLength <= tol;
    // The page assumes a genuine, oriented triangle. A flat one is outside
    // that assumption, so its iff is not asserted at all.
    const genuine = Math.abs(signedArea2(s)) > 1e-12 * scale * scale;
    const positive = orientation(s) === -1;
    const a = sub(s.A, s.O), b = sub(s.B, s.O), c = sub(s.C, s.O);

    // In screen coordinates j is a turn of -120 degrees: y grows downward.
    const jSign = positive ? -1 : 1;
    const literal = length(add(add(a, rotateVec(b, jSign)), rotateVec(c, -jSign))) <= tol;
    const pair = length(add(sub(a, c), rotateVec(sub(b, c), jSign))) <= tol;

    // j^3 = 1 and 1 + j + j^2 = 0, with j as a point on the unit circle.
    const one = { x: 1, y: 0 }, j = rotateVec(one, -1), j2 = rotateVec(j, -1);
    const roots = length(add(add(one, j), j2)) < 1e-12 &&
      length(sub(rotateVec(j2, -1), one)) < 1e-12;

    return {
      rootsOfUnity: roots,
      // The one formula on the page, and its iff.
      criterion: crit,
      equilateral: eq,
      equivalent: !genuine || eq === crit,
      // The page assumes positive orientation; there its literal formula holds
      // exactly. For the other order the conjugate identity does the same job.
      literalPositive: !genuine || !positive || literal === eq,
      // The page says one pair of sides is already enough.
      onePairOfSides: !genuine || pair === eq,
      // Geometric reading: the sum of B1 and C1 is the point opposite A.
      sumIsMinusA: length(add(add(rotateVec(b, m.sign), rotateVec(c, -m.sign)), a)) <= tol,
      // If the criterion holds, the applet's rounded sum dot lands on O.
      sumDotOnO: !crit || distance(m.sumDot, s.O) <= 1.5,
      // Rotation keeps the distance from O and turns through 120 degrees.
      rotationsKeepLength:
        Math.abs(distance(m.B1, s.O) - distance(s.B, s.O)) <= tol &&
        Math.abs(distance(m.C1, s.O) - distance(s.C, s.O)) <= tol,
      // The parallelogram: B1 + C1 reaches the corner, S is one vector A away.
      parallelogram:
        length(sub(m.cornerExact, m.corner)) <= 1 &&
        length(sub({ x: m.sumDot.x - m.corner.x, y: m.sumDot.y - m.corner.y }, a)) <= 2,
    };
  }

  function withPoint(s, name, p) {
    const next = {
      A: { ...s.A }, B: { ...s.B }, C: { ...s.C }, O: { ...s.O },
      showVectors: Boolean(s.showVectors),
    };
    if (next[name]) next[name] = { x: p.x, y: p.y };
    return next;
  }

  function withOption(s, name, value) {
    const next = withPoint(s, "", s.A);
    if (name === "showVectors") next.showVectors = Boolean(value);
    return next;
  }

  /** An illustration has no win, loss or finishing move. */
  function result(/* state */) {
    return null;
  }

  return {
    TURN, COS, SIN, EPS,
    distance, length, add, sub, rotate, rotateVec, orientation,
    start, equilateralPreset, compute, fixedCriterion, sideLengths,
    signedArea2, isEquilateral, claims, withPoint, withOption, result,
  };
})();
