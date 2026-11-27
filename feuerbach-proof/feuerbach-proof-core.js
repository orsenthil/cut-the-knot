"use strict";

/*
 * Feuerbach's Theorem: a Proof, from Alexander Bogomolny's applet
 * FeuerbachProof and its cut-the-knot page. Drag A, B and C: the picture keeps
 * the two excircles Cb and Cc opposite B and C, their common centre line, the
 * two external tangents (BC and its reflection in the centre line), the feet
 * B', C', P, the midpoints K, L, M and the nine-point circle through K, L, M.
 *
 * The key idea the page proves by inversion: L is the midpoint of B'C' (also
 * of BC); the circle w with centre L and radius LB' = LC' swaps P and S, is
 * orthogonal to Cb and Cc (so fixes them), and sends the nine-point circle to
 * the second external tangent. Tangency of the image line therefore proves
 * tangency of the original circle. The sibling applets state the theorem, its
 * incidences, or its sixteen circles; this one draws the inversion proof for
 * the pair Cb, Cc only.
 *
 * Every construction follows the applet's bytecode: GeoSDoub.FindExcenter /
 * ComputeAngle / Rotate / FindOrientation / Intersect / NearestPoint /
 * ReflectPointInLine / GetParallelTo, and DoubLine.FindCircumcenter via
 * GetCircle. This file is only the logic: no document, no window, no storage.
 * It defines one global, FeuerbachProofCore; the position is plain data so it
 * can be saved for the player's record and handed to the tutor. There is no
 * win or loss: this is an illustration.
 */
const FeuerbachProofCore = (() => {
  // FeuerbachProof.getParameterInfo calls 400 by 250 "optimal". The canvas
  // init puts A at (w/2, 2h/3) with radius min(w,h)/4 at angle -1.6, C at
  // (w/2 + 20, 2h/3) offset by sin(-0.2), and B at (w/5, C.y). The page's
  // embeds are 550 by 450; the same fractions give the same figure here.
  const WIDTH = 400;
  const HEIGHT = 250;
  const CX = WIDTH / 2;
  const CY = (HEIGHT * 2) / 3;
  const SCALE = Math.min(WIDTH, HEIGHT) / 4;
  const EDGE = 6;
  const RAY = 100; // GeoSDoub.GetParallelTo extends a direction this far
  const TANGENT_CUT = WIDTH / 6; // FeuerbachProofCanvas.Compute's CutTo length

  const number = (v, fallback) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pointOf = (v, fallback) => ({
    x: clamp(number(v && v.x, fallback.x), EDGE, WIDTH - EDGE),
    y: clamp(number(v && v.y, fallback.y), EDGE, HEIGHT - EDGE),
  });

  const START = {
    A: { x: CX + SCALE * Math.cos(-1.6), y: CY + SCALE * Math.sin(-1.6) },
    C: { x: CX + 20 + SCALE * Math.sin(-0.2), y: CY + SCALE * Math.sin(-0.2) },
  };
  START.B = { x: WIDTH / 5, y: START.C.y };

  /** The opening figure, or a caller's three corners. The page's second
   *  applet (ShowNames=1) is the proof one: names and angles start shown. */
  function start(options) {
    const o = options || {};
    return {
      A: pointOf(o.A, START.A),
      B: pointOf(o.B, START.B),
      C: pointOf(o.C, START.C),
      showNames: o.showNames !== false,
      showAngles: o.showAngles !== false,
      showCircle: o.showCircle === true,
      showNPCircle: o.showNPCircle === true,
    };
  }

  /** Drag one corner; the other two corners and all four options are kept. */
  function setPoint(state, name, q) {
    const s = start(state);
    if (!q || (name !== "A" && name !== "B" && name !== "C")) return s;
    return Object.assign({}, s, { [name]: pointOf(q, s[name]) });
  }

  /** FeuerbachProofPanel.itemStateChanged: the four checkboxes. */
  function setFlag(state, name, on) {
    const s = start(state);
    if (name !== "showNames" && name !== "showAngles" &&
        name !== "showCircle" && name !== "showNPCircle") return s;
    return Object.assign({}, s, { [name]: !!on });
  }

  /** A compact, JSON-safe position for Track.state and the tutor. */
  function position(state) {
    const s = start(state);
    const round = (p) => ({ x: Number(p.x.toFixed(6)), y: Number(p.y.toFixed(6)) });
    return {
      A: round(s.A), B: round(s.B), C: round(s.C),
      showNames: s.showNames, showAngles: s.showAngles,
      showCircle: s.showCircle, showNPCircle: s.showNPCircle,
    };
  }

  /* ------------------------------------------------------------------ *
   * The applet's own primitives, in the bytecode's operation order.     *
   * ------------------------------------------------------------------ */

  const sqDist = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finitePoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const finiteCircle = (c) => !!c && finitePoint(c) && Number.isFinite(c.r) && c.r > 0;

  /** GeoSDoub.Intersect: line coefficients; |denominator| < 1 gives NaN. */
  function intersect(p, q, r, s) {
    const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const den = a * b2 - a2 * b;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (b * c2 - b2 * c) / den, y: (c * a2 - c2 * a) / den };
  }

  /** GeoSDoub.NearestPoint: foot on the infinite line, or p if close to a. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return p;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.ComputeAngle: the angle at a, before acos. */
  function computeAngle(a, b, c) {
    const t = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) /
      (2 * dist(a, b) * dist(a, c));
    return Math.acos(t);
  }

  /** GeoSDoub.FindOrientation: +1 for a left turn, -1 otherwise. */
  function orientation(a, b, c) {
    const turn = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return turn > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate: rotate the centre c around p by a (sign flips the turn). */
  function rotate(p, c, a, sign) {
    const co = Math.cos(a), si = Math.sin(a);
    return {
      x: p.x + co * (c.x - p.x) - sign * si * (c.y - p.y),
      y: p.y + sign * si * (c.x - p.x) + co * (c.y - p.y),
    };
  }

  /** GeoSDoub.ReflectPointInLine(p,a,b): mirror p in the line through a,b. */
  function reflectPointInLine(p, a, b) {
    const turn = 2 * computeAngle(b, p, a);
    return rotate(b, p, turn, orientation(b, p, a));
  }

  /** GeoSDoub.FindExcenter(p,a,b): intersection of the external bisectors
   *  at a and b, i.e. the excenter opposite p. */
  function findExcenter(p, a, b) {
    const angleA = computeAngle(a, p, b);
    const angleB = computeAngle(b, p, a);
    const sign = orientation(a, p, b);
    const rayA = rotate(a, b, (Math.PI - angleA) / 2, sign);
    const rayB = rotate(b, a, (Math.PI - angleB) / 2, -sign);
    return intersect(a, rayA, b, rayB);
  }

  /** FeuerbachProofCanvas.ComputeExcircle: the excenter and the mean of its
   *  three distances to the side lines (equal for an exact excenter). */
  function excircle(p, q, r) {
    const c = findExcenter(p, q, r);
    const radius = (dist(c, nearestPoint(c, p, q)) +
      dist(c, nearestPoint(c, q, r)) +
      dist(c, nearestPoint(c, r, p))) / 3;
    return { x: c.x, y: c.y, r: radius };
  }

  /** GeoSDoub.FindCircumcenter, then GetCircle's mean of the three radii. */
  function circumcenter(p, q, r) {
    const m1 = midpoint(p, q), m2 = midpoint(q, r);
    const v1 = { x: m1.x + q.y - p.y, y: m1.y - (q.x - p.x) };
    const v2 = { x: m2.x + r.y - q.y, y: m2.y - (r.x - q.x) };
    return intersect(m1, v1, m2, v2);
  }

  function getCircle(p, q, r) {
    const c = circumcenter(p, q, r);
    return {
      x: c.x, y: c.y,
      r: (dist(c, p) + dist(c, q) + dist(c, r)) / 3,
    };
  }

  /** FeuerbachProofCanvas.CutTo(p,q,len): q + len/dist(p,q) * (p-q). */
  function cutTo(p, q, len) {
    const t = len / dist(p, q);
    return { x: q.x + t * (p.x - q.x), y: q.y + t * (p.y - q.y) };
  }

  /** GeoSDoub.GetParallelTo(p,a,b): a point RAY units from p along a-b. */
  function parallelPoint(p, a, b) {
    return { x: p.x + RAY * (a.x - b.x), y: p.y + RAY * (a.y - b.y) };
  }

  /* ------------------------------------------------------------------ *
   * FeuerbachProofCanvas.Compute: everything the page draws.             *
   * ------------------------------------------------------------------ */

  function geometry(state) {
    const s = start(state);
    const A = s.A, B = s.B, C = s.C;

    // ComputeNPC: K, L, M and the circle through them.
    const K = midpoint(A, B), L = midpoint(B, C), M = midpoint(C, A);
    const CN = getCircle(L, M, K);
    // The two excircles opposite B and C.
    const Cb = excircle(B, C, A);
    const Cc = excircle(C, A, B);
    const S = intersect(B, C, Cb, Cc);
    const centerLine = { p: Cb, q: Cc };

    // B', C' are the projections on BC; reflecting them in the centre line
    // gives the contact points on the second external tangent.
    const Bp = nearestPoint(Cb, B, C);
    const Cp = nearestPoint(Cc, B, C);
    const Bd = reflectPointInLine(Bp, Cb, Cc);
    const Cd = reflectPointInLine(Cp, Cb, Cc);
    const secondTangent = { p: Bd, q: Cd };

    // w has centre L and radius LC' (which equals LB').
    const Invert = { x: L.x, y: L.y, r: dist(L, Cp) };
    const X = cutTo(parallelPoint(L, Cd, Bd), L, TANGENT_CUT);
    const Y = { x: 2 * L.x - X.x, y: 2 * L.y - X.y };

    // P is the foot of the altitude from A; Z is where CA meets the second
    // external tangent, used for the angle marks in the applet.
    const P = nearestPoint(A, B, C);
    const Z = intersect(C, A, Bd, Cd);

    const area2 = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    const points = [S, Bp, Cp, Bd, Cd, K, L, M, P, X, Y, Z];
    const valid = Math.abs(area2) > 1 && finiteCircle(CN) &&
      finiteCircle(Cb) && finiteCircle(Cc) && finiteCircle(Invert) &&
      points.every(finitePoint);

    return {
      A, B, C, K, L, M, P, S, Bp, Cp, Bd, Cd, X, Y, Z,
      CN, Cb, Cc, Invert, centerLine, secondTangent,
      sides: { a: dist(B, C), b: dist(C, A), c: dist(A, B) },
      valid,
    };
  }

  /** The status line for a configuration. No result class is ever passed:
   *  the illustration has no win or loss. */
  function describe(state) {
    const g = geometry(state);
    if (!g.valid) return "Move the dots so A, B and C make a triangle.";
    const fmt = (v) => v.toFixed(1);
    return "Nine-point circle radius " + fmt(g.CN.r) +
      "; excircles b " + fmt(g.Cb.r) + " and c " + fmt(g.Cc.r) +
      ". In the orange circle, P and S are a pair of inverse points, " +
      "and the nine-point circle touches both excircles once.";
  }

  /** An illustration cannot end in a win or a loss. */
  function result(state) {
    return null;
  }

  return {
    WIDTH, HEIGHT, CX, CY, SCALE, EDGE, RAY, TANGENT_CUT, START,
    start, setPoint, setFlag, position, geometry, describe, result,
    dist, sqDist, midpoint, nearestPoint, intersect, computeAngle,
    orientation, rotate, reflectPointInLine, findExcenter, excircle,
    circumcenter, getCircle, cutTo, parallelPoint,
    finitePoint, finiteCircle,
  };
})();
