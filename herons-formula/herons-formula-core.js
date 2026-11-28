"use strict";

/*
 * Heron's Formula: a Proof — the illustration behind Alexander Bogomolny's
 * applet HeronsFormula (cut-the-knot.org/Curriculum/Geometry/HeronsFormula.shtml).
 *
 * Drag the three corners of a triangle. The applet drops the perpendiculars
 * from the incenter I to the sides; the six small triangles cut out by those
 * touch points are shown again at the bottom as a rectangle of width x+y+z
 * and height r, so its area is both S and r(x+y+z). On the right the products
 * xyz and r^2(x+y+z) are compared in a second rectangle. The page claims
 * S^2 = s(s-a)(s-b)(s-c) = sxyz, xyz = r^2(x+y+z), and hence S = rs.
 *
 * The one idea the code relies on is that the tangent lengths from a vertex
 * are x = s-a, y = s-b, z = s-c, and the incircle radius is r = S/s. The
 * incenter itself is found exactly as the applet finds it: rotate two sides
 * by half their angles and intersect the two rays (GeoSDoub.FindIncenter).
 * The inradius is the applet's average of the three distances from I to the
 * touch points, and x, y, z are averages of the two tangent lengths at each
 * vertex; the logic test compares every one of these numbers with a second,
 * literal transcription of the bytecode.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, HeronsFormulaCore, so the page loads it
 * with a plain <script> and porting/check-herons-formula.mjs loads it in
 * Node. Functions take plain data and return new objects; nothing handed in
 * is changed.
 */
const HeronsFormulaCore = (() => {
  // The applet is 600x450; H is its fixed top margin for the right drawing.
  const APPLET = { width: 600, height: 450, margin: 30, header: 20, degenerate: 1 };
  const EPS = 1e-12;

  const pt = (x, y) => ({ x, y });
  const sqDist = (p, q) => {
    const dx = p.x - q.x, dy = p.y - q.y;
    return dx * dx + dy * dy;
  };
  const distance = (p, q) => Math.sqrt(sqDist(p, q));
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /* GeoSDoub.FindOrientation: 1 for one winding, -1 for the other (0 -> -1). */
  function orientation(p, q, r) {
    const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return s > 0 ? 1 : -1;
  }

  /* GeoSDoub.ComputeAngle: the law of cosines, with no clamping of acos. */
  function computeAngle(p, q, r) {
    const value = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) /
      (2 * distance(p, q) * distance(p, r));
    return Math.acos(value);
  }

  /* GeoSDoub.Rotate: turn q about p by orientation * angle. */
  function rotate(p, q, angle, orient) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return pt(
      p.x + cs * (q.x - p.x) - orient * sn * (q.y - p.y),
      p.y + orient * sn * (q.x - p.x) + cs * (q.y - p.y),
    );
  }

  /* GeoSDoub.Intersect: line coefficients; |det| < 1 gives NaN, as in Java. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < APPLET.degenerate) return pt(NaN, NaN);
    return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /* GeoSDoub.FindIncenter(A,B,C): intersect two rotated side rays. */
  function findIncenter(A, B, C) {
    const halfA = computeAngle(A, B, C) / 2;
    const halfB = computeAngle(B, C, A) / 2;
    const orient = orientation(A, B, C);
    const rayA = rotate(A, B, halfA, orient);
    const rayB = rotate(B, C, halfB, orient);
    return intersect(A, rayA, B, rayB);
  }

  /* GeoSDoub.NearestPoint: the foot of the perpendicular from p to line a-b. */
  function nearestPoint(p, a, b) {
    if (sqDist(a, p) < 0.1) return { ...p };
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return { ...p };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return pt(a.x + dx * t, a.y + dy * t);
  }

  /* CTKGeometryPlus.Barycenter: where the applet puts the floating names. */
  function barycenter(A, B, C) {
    return pt((A.x + B.x + C.x) / 3, (A.y + B.y + C.y) / 3);
  }

  /** The starting triangle, placed exactly as HeronsFormulaCanvas.init does. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C },
        showNames: o.showNames === true,
        width: o.width === undefined ? APPLET.width : o.width,
        height: o.height === undefined ? APPLET.height : o.height,
      };
    }
    const width = o.width === undefined ? APPLET.width : o.width;
    const height = o.height === undefined ? APPLET.height : o.height;
    // init(): step = min(w,h)/4 as an int; the circle has radius 1.6*step about
    // (w/2 - 3*step/2, h/2); the three corners sit at angles -1.6, -4, -0.2.
    const step = Math.trunc(Math.min(width, height) / 4);
    const ex = width / 2 - (3 * step) / 2;
    const ey = height / 2;
    return {
      A: pt(ex + step * Math.cos(-1.6), ey + step * Math.sin(-1.6)),
      B: pt(ex + step * Math.cos(-4.0), ey + step * Math.sin(-4.0)),
      C: pt(ex + step * Math.cos(-0.2), ey + step * Math.sin(-0.2)),
      showNames: o.showNames === true, // the applet's "ShowNames" parameter defaults to off
      width, height,
    };
  }

  /** a = |BC|, b = |CA|, c = |AB|: the page's side lengths. */
  function sides(s) {
    return {
      a: distance(s.B, s.C),
      b: distance(s.C, s.A),
      c: distance(s.A, s.B),
    };
  }

  /** Unsigned area straight from the coordinates, independent of Heron. */
  function area(s) {
    return Math.abs(cross(s.A, s.B, s.C)) / 2;
  }

  /**
   * HeronsFormulaCanvas.Compute(), transcribed in the bytecode's order.
   * Every returned point is in the applet's canvas coordinates. `ok` is false
   * when a drag made the triangle flat or the construction non-finite; the
   * page then asks the player to spread the corners apart.
   */
  function configuration(s) {
    const w = s.width === undefined ? APPLET.width : s.width;
    const h = s.height === undefined ? APPLET.height : s.height;
    const A = s.A, B = s.B, C = s.C;

    const I = findIncenter(A, B, C);
    const Ia = nearestPoint(I, B, C); // touch point on BC
    const Ib = nearestPoint(I, A, C); // touch point on CA
    const Ic = nearestPoint(I, B, A); // touch point on AB

    // The applet averages three distances for the radius (they are equal for
    // a true triangle) and two tangent lengths at each vertex.
    const r = (distance(I, Ia) + distance(I, Ib) + distance(I, Ic)) / 3;
    const x = (distance(A, Ib) + distance(A, Ic)) / 2;
    const y = (distance(B, Ic) + distance(B, Ia)) / 2;
    const z = (distance(C, Ia) + distance(C, Ib)) / 2;
    const semi = x + y + z;
    const xyz = x * y * z;
    const rightWidth = r * z * (x + y);

    const margin = APPLET.margin;
    const scale = Math.min(
      (h / 2 - 2 * margin - APPLET.header - r) / xyz,
      (w / 2 - 2 * margin) / rightWidth,
    );
    const LU = pt(w / 2 + margin, margin);
    const LD = pt(LU.x, LU.y + xyz * scale);
    const RD = pt(LD.x + rightWidth * scale, LD.y);
    const RU = pt(RD.x, LU.y);
    const UM = pt(LU.x + r * y * z * scale, LU.y);
    const RM = pt(RU.x, RU.y + r * r * z * scale);

    // DrawRect's long thin rectangle: width x+y+z, height r.
    const baseY = h / 2 - APPLET.header;
    const topY = baseY - r;
    const left = (w - semi) / 2;
    const top = [pt(left, topY), pt(left + x, topY), pt(left + x + y, topY),
                 pt(left + x + y + z, topY)];
    const bottom = top.map((p) => pt(p.x, baseY));

    const len = sides(s);
    const measured = area(s);
    const maxSide = Math.max(len.a, len.b, len.c);
    // A flat or nearly flat triangle makes the applet's acos/scale undefined;
    // treat it as unusable well before the floating point collapses.
    const ok = finite(I) && finite(Ia) && finite(Ib) && finite(Ic) &&
      Number.isFinite(r) && Number.isFinite(scale) && r > 1e-6 * maxSide &&
      semi > 0 && xyz > 0 && scale > 0 && measured > 1e-6 * maxSide * maxSide;

    return {
      A, B, C, I, Ia, Ib, Ic,
      r, x, y, z, s: semi, xyz, rightWidth, scale,
      center: barycenter(A, B, C),
      right: { LU, LD, RD, RU, UM, RM },
      strip: { top, bottom },
      sides: len, area: measured,
      ok,
    };
  }

  /** The page's statements, evaluated numerically for this one triangle. */
  function claims(s) {
    const g = configuration(s);
    const off = {
      heron: false, semiperimeter: false, tangentLengths: false,
      areaFromInradius: false, identity: false, cotangent: false,
      halfAngles: false, cotangentAngles: false,
      feetOnSides: false, dissectionArea: false, rightDivision: false,
    };
    if (!g.ok) return off;

    const { a, b, c } = g.sides;
    const size = Math.max(a, b, c, g.s);
    const close = (u, v) => Number.isFinite(u) && Number.isFinite(v) &&
      Math.abs(u - v) <= 1e-7 * Math.max(size, Math.abs(u), Math.abs(v), 1e-6);
    const onSegment = (p, u, v) =>
      Math.abs(distance(u, p) + distance(p, v) - distance(u, v)) <= 1e-7 * size;
    const perpendicular = (p, foot, u, v) =>
      Math.abs(dot({ x: p.x - foot.x, y: p.y - foot.y },
                   { x: v.x - u.x, y: v.y - u.y })) <= 1e-7 * size * size;

    // S^2 = s(s-a)(s-b)(s-c) = sxyz and S = rs, so xyz = r^2 s.
    const heron = close(g.area * g.area, g.s * (g.s - a) * (g.s - b) * (g.s - c));
    const cotA = g.x / g.r, cotB = g.y / g.r, cotC = g.z / g.r;
    // The page writes the angles at the corners as 2α, 2β, 2γ.
    const alpha = computeAngle(g.A, g.B, g.C) / 2;
    const beta = computeAngle(g.B, g.C, g.A) / 2;
    const gamma = computeAngle(g.C, g.A, g.B) / 2;
    const cot = [alpha, beta, gamma].map((t) => 1 / Math.tan(t));
    const wide = g.strip.bottom[3].x - g.strip.top[0].x;
    const high = g.strip.bottom[0].y - g.strip.top[0].y;

    return {
      heron,
      semiperimeter: close(g.s, (a + b + c) / 2),
      tangentLengths: close(g.x, g.s - a) && close(g.y, g.s - b) && close(g.z, g.s - c),
      areaFromInradius: close(g.area, g.r * g.s),
      identity: close(g.xyz, g.r * g.r * g.s),
      cotangent: close(cotA + cotB + cotC, cotA * cotB * cotC),
      halfAngles: close(alpha + beta + gamma, Math.PI / 2),
      cotangentAngles: close(cot[0] + cot[1] + cot[2], cot[0] * cot[1] * cot[2]) &&
        close(cot[0], cotA) && close(cot[1], cotB) && close(cot[2], cotC),
      feetOnSides:
        onSegment(g.Ia, g.B, g.C) && perpendicular(g.I, g.Ia, g.B, g.C) &&
        onSegment(g.Ib, g.A, g.C) && perpendicular(g.I, g.Ib, g.A, g.C) &&
        onSegment(g.Ic, g.B, g.A) && perpendicular(g.I, g.Ic, g.B, g.A),
      dissectionArea: close(wide * high, g.area),
      rightDivision:
        close(g.right.UM.x - g.right.LU.x, g.r * g.y * g.z * g.scale) &&
        close(g.right.RM.y - g.right.LU.y, g.r * g.r * g.z * g.scale),
    };
  }

  /** A new position with one corner moved; the old one is left untouched. */
  function withPoint(s, name, p) {
    const next = {
      ...s,
      A: { ...s.A }, B: { ...s.B }, C: { ...s.C },
    };
    if (next[name]) next[name] = { x: p.x, y: p.y };
    return next;
  }

  function withOption(s, name, value) {
    return { ...s, [name]: Boolean(value) };
  }

  /** An illustration has no win or loss. */
  function result(/* state */) {
    return null;
  }

  return {
    APPLET, EPS, pt, sqDist, distance, cross, dot, finite,
    orientation, computeAngle, rotate, intersect, findIncenter, nearestPoint,
    barycenter, start, sides, area, configuration, claims,
    withPoint, withOption, result,
  };
})();
