"use strict";

/*
 * In And Circumcenter D, from Alexander Bogomolny's applet InAndCircumcenterD.
 *
 * Lay the side AB off along BC and AC to get D and E (BD = AE = AB). Let I
 * and O be the incenter and circumcenter of ABC, and draw the circle centred
 * at I through O. The chords through O parallel to CA and CB end at N and M.
 * The page claims that triangle ONM is congruent to triangle CDE: the chord
 * ON has length |BC - AB| = CD, and OM has length |AC - AB| = CE, while the
 * angle between the chords equals the angle at C because their sides are
 * parallel. The key calculation is that a chord through a point of a circle
 * has length twice the projection of the radius on the chord's direction, and
 * the feet of I and O on AC are (a + b - c)/2 and b/2 from C. The chords use
 * the applet's own line-circle intersection, including its one-pixel choice
 * of the far end.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, InAndCircumcenterDCore, so the page loads
 * it with a plain <script> and porting/check-in-and-circumcenter-d.mjs loads
 * it in Node. The position is plain data (three points and four checkbox
 * booleans); every function returns a new position and leaves its input alone.
 */
const InAndCircumcenterDCore = (() => {
  // The archived applet page embedded the Java canvas at 450 by 450; its
  // getParameterInfo called that "(400 seems optimal)". The SVG board uses the
  // embedded size, and the opening points are the applet's own init() fractions
  // (integer division): W/3, 4H/5; 11W/15, 2H/3; W/4, H/4.
  const WIDTH = 450;
  const HEIGHT = 450;
  const MARGIN = 12;
  const MIN_SIDE = 2; // Compute() returns early if any side is shorter than 2
  const OTHER_TOL = 1; // GeoSDoub's Other() cannot distinguish points < 1 px apart
  const EPS = 1e-10;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const len = (p) => Math.hypot(p.x, p.y);
  const dist = (p, q) => len(sub(p, q));
  const unit = (p) => {
    const n = len(p);
    return n < EPS ? null : mul(p, 1 / n);
  };
  const finitePoint = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Foot of the perpendicular from p onto line ab (GeoSDoub.NearestPoint). */
  function foot(p, a, b) {
    const d = sub(b, a);
    const n = dot(d, d);
    if (n < EPS) return { x: a.x, y: a.y };
    const t = dot(sub(p, a), d) / n;
    return add(a, mul(d, t));
  }

  /** Intersection of the two infinite lines, or null when nearly parallel. */
  function intersect(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const det = cross(r, s);
    if (Math.abs(det) < EPS) return null;
    const t = cross(sub(c, a), s) / det;
    if (!Number.isFinite(t)) return null;
    return add(a, mul(r, t));
  }

  /** Circumcenter from two perpendicular bisectors (GeoSDoub.FindCircumcenter). */
  function circumcenter(A, B, C) {
    const m1 = mul(add(A, B), 0.5);
    const m2 = mul(add(B, C), 0.5);
    const p1 = add(m1, { x: B.y - A.y, y: -(B.x - A.x) });
    const p2 = add(m2, { x: C.y - B.y, y: -(C.x - B.x) });
    return intersect(m1, p1, m2, p2);
  }

  /**
   * Applet PlacePoint(P1,P2,P3): walk from P1 towards P3 by |P1P2|.
   * The walk length and its direction are taken from different points.
   */
  function place(base, lengthRef, towards) {
    const full = dist(base, towards);
    if (full < EPS) return { x: base.x, y: base.y };
    return add(base, mul(sub(towards, base), dist(base, lengthRef) / full));
  }

  /** GeoSDoub.GetParallelTo(a,b,c): 100 lengths from a in the b->c direction. */
  function parallelPoint(a, b, c) {
    return add(a, mul(sub(b, c), 100));
  }

  /**
   * GeoSDoub.Intersect(circle, line) followed by the canvas's Other().
   * The quadratic is solved in x = a*y+b form (IntersectX) when the line is
   * steep, otherwise in y = a*x+b form (IntersectY); the '+' root comes
   * first. Other() takes the first root unless it is within one pixel of O,
   * so a very short chord is reported at O in some orientations and at its
   * far end in others. That quirk is kept here, because it is what the
   * original draws; the one-pixel tolerance is OTHER_TOL.
   */
  function chordEnd(onCircle, centre, p1, p2) {
    const cc = centre.c || centre;
    let roots = null;
    if (Math.abs(p1.y - p2.y) > 1) {
      const a = (p1.x - p2.x) / (p1.y - p2.y);
      const b = p2.x - a * p2.y;
      const q = a * (b - cc.x) - cc.y;
      const A2 = 1 + a * a, B2 = 2 * q;
      const C2 = cc.y ** 2 + (b - cc.x) ** 2 - centre.r ** 2;
      const disc = B2 * B2 - 4 * A2 * C2;
      if (disc >= 0) {
        const root = Math.sqrt(disc);
        const y1 = (-B2 + root) / (2 * A2), y2 = (-B2 - root) / (2 * A2);
        roots = [{ x: a * y1 + b, y: y1 }, { x: a * y2 + b, y: y2 }];
      }
    } else if (Math.abs(p1.x - p2.x) > 1) {
      const a = (p1.y - p2.y) / (p1.x - p2.x);
      const b = p2.y - a * p2.x;
      const q = a * cc.x + b - cc.y;
      const A2 = 1 + a * a, B2 = 2 * q;
      const C2 = cc.x ** 2 + (b - cc.y) ** 2 - centre.r ** 2;
      const disc = B2 * B2 - 4 * A2 * C2;
      if (disc >= 0) {
        const root = Math.sqrt(disc);
        const x1 = (-B2 + root) / (2 * A2), x2 = (-B2 - root) / (2 * A2);
        roots = [{ x: x1, y: a * x1 + b }, { x: x2, y: a * x2 + b }];
      }
    }
    if (!roots || !roots.length) return null;
    return dist(roots[0], onCircle) >= OTHER_TOL ? roots[0] : roots[1];
  }

  /** The opening diagram, with the applet's four checkboxes all off. */
  function start() {
    return {
      A: { x: Math.floor(WIDTH / 3), y: Math.floor(4 * HEIGHT / 5) },
      B: { x: Math.floor(11 * WIDTH / 15), y: Math.floor(2 * HEIGHT / 3) },
      C: { x: Math.floor(WIDTH / 4), y: Math.floor(HEIGHT / 4) },
      showNames: false,
      showStatement: false,
      showPremise: false,
      showHint: false,
    };
  }

  /** Keep a dragged corner inside the board. */
  function clampPoint(s, name, q) {
    if (!["A", "B", "C"].includes(name) || !q) return q;
    return {
      x: clamp(q.x, MARGIN, WIDTH - MARGIN),
      y: clamp(q.y, MARGIN, HEIGHT - MARGIN),
    };
  }

  /** Move one named corner; the other two and the options are untouched. */
  function withPoint(s, name, q) {
    if (!["A", "B", "C"].includes(name) || !q) return s;
    return Object.assign({}, s, { [name]: clampPoint(s, name, q) });
  }

  /** One of the applet's four checkboxes. */
  function setOption(s, name, value) {
    if (!["showNames", "showStatement", "showPremise", "showHint"].includes(name)) return s;
    return Object.assign({}, s, { [name]: !!value });
  }

  /** Reset restores the opening points but keeps the option choices. */
  function reset(s) {
    const fresh = start();
    for (const key of ["showNames", "showStatement", "showPremise", "showHint"]) {
      fresh[key] = s[key];
    }
    return fresh;
  }

  /** Every point of the construction. `valid` is Compute()'s side guard. */
  function geometry(s) {
    const { A, B, C } = s;
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const invalid = { valid: false, a, b, c, A, B, C };
    if (!finitePoint(A) || !finitePoint(B) || !finitePoint(C)) return invalid;
    if (a < MIN_SIDE || b < MIN_SIDE || c < MIN_SIDE) return invalid;

    // The incenter is the weighted average of the vertices; the circumcenter
    // is the crossing of two perpendicular bisectors.
    const sum = a + b + c;
    const I = {
      x: (a * A.x + b * B.x + c * C.x) / sum,
      y: (a * A.y + b * B.y + c * C.y) / sum,
    };
    const O = circumcenter(A, B, C);
    if (!finitePoint(O) || dist(O, A) > 1e5) return invalid;

    const incircle = { c: I, r: dist(I, foot(I, A, B)) };
    const circumcircle = { c: O, r: dist(O, A) };
    const circle = { c: I, r: dist(I, O) }; // the applet's I(O)

    const D = place(B, A, C); // BD = AB
    const E = place(A, B, C); // AE = AB
    const Op = foot(O, A, C);
    const Ip = foot(I, A, C);
    const N = chordEnd(O, circle, O, parallelPoint(O, A, C)); // ON parallel to CA
    const M = chordEnd(O, circle, O, parallelPoint(O, B, C)); // OM parallel to CB
    const L = N && finitePoint(Ip) ? intersect(O, N, I, Ip) : null;

    return {
      valid: Boolean(finitePoint(I) && finitePoint(N) && finitePoint(M)),
      A, B, C, a, b, c, I, O, D, E, Op, Ip, N, M, L,
      incircle, circumcircle, circle,
      rIn: incircle.r, rCirc: circumcircle.r, io: circle.r,
    };
  }

  /** Angle at a vertex between two rays, in radians. */
  function angle(v, p, q) {
    if (!finitePoint(v) || !finitePoint(p) || !finitePoint(q)) return NaN;
    const u = sub(p, v), w = sub(q, v);
    const un = len(u), wn = len(w);
    if (un < EPS || wn < EPS) return NaN;
    return Math.acos(clamp(dot(u, w) / (un * wn), -1, 1));
  }

  /** The page's lengths, angle and the errors in its claims. */
  function claims(f) {
    if (!f || !f.valid) return { valid: false };
    const { A, B, C, D, E, I, O, N, M, Op, Ip, L, a, b, c } = f;
    const cd = dist(C, D), ce = dist(C, E);
    const on = dist(O, N), om = dist(O, M);
    const angleC = angle(C, D, E), angleO = angle(O, N, M);
    const scale = Math.max(1, a, b, c);
    const ol = L ? dist(O, L) : NaN;
    const oip = dist(Op, Ip);
    return {
      valid: true,
      a, b, c, cd, ce, on, om, angleC, angleO, ol, oip,
      angleDiff: Math.abs(angleC - angleO),
      onError: Math.abs(on - Math.abs(a - c)),
      omError: Math.abs(om - Math.abs(b - c)),
      olError: Math.abs(ol - Math.abs(a - c) / 2),
      ipError: Math.abs(oip - Math.abs(a - c) / 2),
      congruent: Math.abs(on - cd) < 1e-3 * scale &&
        Math.abs(om - ce) < 1e-3 * scale && Math.abs(angleC - angleO) < 1e-6,
      onSides: c <= a && c <= b, // the page's signed a - c, b - c
      chordShort: on < OTHER_TOL || om < OTHER_TOL,
    };
  }

  /** The status line: measured lengths in board units, in plain words. */
  function describe(f) {
    const cl = claims(f);
    if (!cl.valid) return "Move the corners apart to make a triangle: the construction needs sides longer than 2.";
    const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "?");
    const deg = (v) => (Number.isFinite(v) ? (v * 180 / Math.PI).toFixed(1) + "°" : "?");
    const where = cl.onSides
      ? "D and E lie on the sides."
      : "AB is longer than another side, so D or E lies beyond C.";
    const short = cl.chordShort ? " A chord is under 1 unit, where the applet cannot pick its far end." : "";
    return `CD ${fmt(cl.cd)} and ON ${fmt(cl.on)}; CE ${fmt(cl.ce)} and OM ${fmt(cl.om)}. ` +
      `Angles at C and O: ${deg(cl.angleC)} and ${deg(cl.angleO)}. ${where}${short}`;
  }

  /** Plain data for the player's record and the tutor. */
  function position(s) {
    return JSON.parse(JSON.stringify(s));
  }

  return {
    WIDTH, HEIGHT, MARGIN, MIN_SIDE, OTHER_TOL,
    add, sub, mul, dot, cross, len, dist, unit, foot, intersect, place, parallelPoint, chordEnd,
    start, clampPoint, withPoint, setOption, reset,
    geometry, angle, claims, describe, position,
  };
})();
