"use strict";

/*
 * de Villiers 2 — Alexander Bogomolny's applet deVilliers2, "Perpendicular
 * Bisectors in an Inscriptible Quadrilateral".
 *
 * Four corners A,B,C,D are kept on one circle (deVilliers2Canvas.init calls
 * RestrictToCircle on all four; D's angle of 4.5 radians is fixed and the
 * random multiple of pi the bytecode computes is never used — a harmless
 * quirk we keep). The applet draws the tangents at those four corners. Their
 * intersections AB,BC,CD,DA make a quadrilateral whose sides all touch the
 * circle. It then forms the perpendicular bisectors of those four sides and
 * meets them to make a second quadrilateral — the picture of the page's
 * claim that the perpendicular-bisector quadrilateral of an inscriptible
 * quadrilateral is inscriptible too. Its "joints" are an incircle found from
 * two angle bisectors, not a copy of the first circle.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, DeVilliers2Core, so the page loads it with
 * a plain <script> and porting/check-de-villiers-2.mjs loads it in Node.
 * Positions and results are plain data in the SVG's viewBox units.
 */

const DeVilliers2Core = (() => {
  // The applet's canvas is 550x450 (it suggests 400x250 in getParameterInfo).
  // We keep its ratios: centre at half the width/height and radius min/4.
  const VIEW = { x: 0, y: 0, width: 360, height: 300 };
  const CENTRE = point(VIEW.width / 2, VIEW.height / 2);
  const RADIUS = Math.min(VIEW.width, VIEW.height) / 4;

  function point(x, y) { return { x: x, y: y }; }
  function add(p, q) { return point(p.x + q.x, p.y + q.y); }
  function sub(p, q) { return point(p.x - q.x, p.y - q.y); }
  function mul(p, k) { return point(p.x * k, p.y * k); }
  function dot(p, q) { return p.x * q.x + p.y * q.y; }
  function cross(p, q) { return p.x * q.y - p.y * q.x; }
  function dist(p, q) { return Math.hypot(p.x - q.x, p.y - q.y); }
  function midpoint(p, q) { return point((p.x + q.x) / 2, (p.y + q.y) / 2); }
  function perp(v) { return point(-v.y, v.x); }

  function unit(v) {
    const n = Math.hypot(v.x, v.y);
    return n > 0 ? point(v.x / n, v.y / n) : point(0, 0);
  }

  function valid(p) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  }

  /** GeoSDoub.Intersect: lines a-b and c-d, with |det| < 1 giving NaN. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;
    const p = point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
    return valid(p) ? p : null;
  }

  /** GeoSDoub.FindCircumcenter, then the canvas's mean-radius DoubCircle. */
  function circumcircle(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const o = intersect(
      m1, point(m1.x + (b.y - a.y), m1.y - (b.x - a.x)),
      m2, point(m2.x + (c.y - b.y), m2.y - (c.x - b.x)),
    );
    if (!o) return null;
    return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
  }

  /** CTKMoveableDoub.RestrictToCircle: a dragged corner snaps to the circle. */
  function onCircle(p, circle) {
    if (!valid(p) || !circle || !(circle.r > 0)) return null;
    const v = sub(p, circle.c);
    const n = Math.hypot(v.x, v.y);
    if (n < 1e-9) return point(circle.c.x + circle.r, circle.c.y);
    return point(circle.c.x + circle.r * v.x / n, circle.c.y + circle.r * v.y / n);
  }

  function pointOnCircle(circle, angle) {
    return point(circle.c.x + circle.r * Math.cos(angle), circle.c.y + circle.r * Math.sin(angle));
  }

  /** deVilliers2Canvas.GetTangent: through P in direction rotate90(P - O). */
  function tangent(p, circle) {
    const d = sub(p, circle.c);
    return { p1: p, p2: point(p.x - d.y, p.y + d.x) };
  }

  /** DoubPoly.FormBisector: perpendicular bisector of the segment a-b. */
  function perpBisector(a, b) {
    const m = midpoint(a, b);
    return { p1: m, p2: add(m, point(a.y - b.y, b.x - a.x)) };
  }

  function intersectLines(l, m) {
    return intersect(l.p1, l.p2, m.p1, m.p2);
  }

  /** GeoSDoub.NearestPoint: the foot of the perpendicular from p onto a-b. */
  function nearestPoint(p, a, b) {
    const v = sub(b, a);
    const n = dot(v, v);
    if (n < 1e-18) return a;
    return add(a, mul(v, dot(sub(p, a), v) / n));
  }

  /** Where the internal bisector at v meets the line p-q. */
  function bisectorFoot(v, p, q) {
    const dir = add(unit(sub(p, v)), unit(sub(q, v)));
    if (dot(dir, dir) < 1e-18) return null;
    return intersect(v, add(v, dir), p, q);
  }

  /**
   * The applet's DrawJoints incircle: centre from two angle bisectors, radius
   * the mean of its distances to the four sides, plus the four touch points.
   */
  function incircle(quad) {
    if (!quad || quad.length !== 4 || !quad.every(valid)) return null;
    const f1 = bisectorFoot(quad[1], quad[0], quad[2]);
    const f2 = bisectorFoot(quad[2], quad[1], quad[3]);
    if (!f1 || !f2) return null;
    const centre = intersect(quad[1], f1, quad[2], f2);
    if (!centre) return null;
    const feet = [0, 1, 2, 3].map((i) => nearestPoint(centre, quad[i], quad[(i + 1) % 4]));
    if (!feet.every(valid)) return null;
    const radii = feet.map((f) => dist(centre, f));
    return { c: centre, r: radii.reduce((s, r) => s + r, 0) / 4, feet: feet, radii: radii };
  }

  /** A quadrilateral as intersections of the four tangents at circle points. */
  function tangentQuad(points, circle) {
    const lines = points.map((p) => tangent(p, circle));
    const out = [];
    for (let i = 0; i < 4; i++) out.push(intersectLines(lines[i], lines[(i + 1) % 4]));
    return out.every(valid) ? out : null;
  }

  /** DoubPoly.GetIterate: meet perpendicular bisectors of consecutive sides. */
  function perpendicularQuad(quad) {
    if (!quad || quad.length !== 4 || !quad.every(valid)) return null;
    const bis = [];
    let prev = quad[3];
    for (const p of quad) {
      bis.push(perpBisector(prev, p));
      prev = p;
    }
    const out = [];
    prev = bis[3];
    for (let i = 0; i < 4; i++) {
      const p = intersectLines(prev, bis[i]);
      if (!p) return null;
      out.push(p);
      prev = bis[i];
    }
    return { points: out, bisectors: bis };
  }

  /** Pitot's test: opposite side sums of a quadrilateral, signed. */
  function pitot(q) {
    if (!q || !q.every(valid)) return NaN;
    return dist(q[0], q[1]) + dist(q[2], q[3]) - dist(q[1], q[2]) - dist(q[3], q[0]);
  }

  function tangencyError(q, circle) {
    if (!q || !q.every(valid) || !circle) return Infinity;
    let worst = 0;
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4];
      const v = sub(b, a), n = Math.hypot(v.x, v.y);
      if (n < 1e-9) return Infinity;
      const d = Math.abs(cross(sub(circle.c, a), v)) / n;
      worst = Math.max(worst, Math.abs(d - circle.r));
    }
    return worst;
  }

  function spread(values) {
    if (!values || !values.length) return Infinity;
    const lo = Math.min(...values), hi = Math.max(...values);
    return Math.abs(hi - lo) / Math.max(1e-12, Math.abs(hi + lo) / 2);
  }

  /** Tangent length from a vertex of a quadrilateral with an incircle. */
  function tangentLength(p, circle) {
    const d2 = dist(p, circle.c) ** 2 - circle.r ** 2;
    return d2 > 0 ? Math.sqrt(d2) : NaN;
  }

  /**
   * The article's equation (3) in signed form: 2(FW - FX) = (c-d) t_D / r.
   * X and W are the midpoints of AD and CD, F their perpendicular-bisector
   * meeting point; the signs are taken along the outward side normals.
   */
  function formula3(q, circle, index) {
    if (!q || !q.every(valid) || !circle || !(circle.r > 0)) return null;
    const i = ((index % 4) + 4) % 4;
    const D = q[i], A = q[(i + 3) % 4], Cc = q[(i + 1) % 4];
    const F = intersectLines(perpBisector(A, D), perpBisector(Cc, D));
    if (!F) return null;
    const normal = (p, r) => {
      const n = unit(perp(sub(r, p)));
      const toCentre = sub(midpoint(p, r), circle.c);
      return dot(n, toCentre) < 0 ? mul(n, -1) : n;
    };
    const nA = normal(A, D), nC = normal(Cc, D);
    const sA = dot(sub(F, midpoint(A, D)), nA);
    const sC = dot(sub(F, midpoint(Cc, D)), nC);
    const c = dist(Cc, D), d = dist(D, A), tD = tangentLength(D, circle);
    if (!Number.isFinite(tD)) return null;
    return { left: 2 * (sC - sA), right: (c - d) * tD / circle.r, c: c, d: d, t: tD };
  }

  /** Everything the drawing needs, recomputed from the four corners. */
  function compute(a, b, c, d) {
    if (![a, b, c, d].every(valid)) return null;
    const circle = circumcircle(a, b, c);
    if (!circle || !(circle.r > 1e-9)) return null;
    const corners = [a, b, c, d];
    const main = tangentQuad(corners, circle);
    if (!main) return null;
    const step = perpendicularQuad(main);
    if (!step) return null;
    const mainIncircle = incircle(main);
    const stepIncircle = incircle(step.points);
    if (!mainIncircle || !stepIncircle) return null;

    const scale = Math.max(1, circle.r, dist(main[0], main[2]), dist(main[1], main[3]),
      ...main.map((p) => dist(p, circle.c)));
    const tol = 1e-6 * scale;
    const mainErr = Math.abs(pitot(main));
    const stepErr = Math.abs(pitot(step.points));
    const circleErr = Math.abs(mainIncircle.r - circle.r) + dist(mainIncircle.c, circle.c);
    const incircleSpread = spread(stepIncircle.radii);
    const f3 = formula3(main, circle, 3);
    const claims = {
      cornersOnCircle: corners.every((p) => Math.abs(dist(p, circle.c) - circle.r) <= tol),
      tangentsTouchCircle: tangencyError(main, circle) <= tol,
      mainIsInscriptible: mainErr <= tol && circleErr <= tol,
      bisectorsPerpendicular: step.bisectors.every((l, i) => {
        const side = sub(main[i], main[(i + 3) % 4]);
        const dir = sub(l.p2, l.p1);
        return Math.abs(dot(side, dir)) <= tol * Math.hypot(dir.x, dir.y);
      }),
      bisectorsThroughMidpoints: step.bisectors.every((l, i) =>
        dist(l.p1, midpoint(main[(i + 3) % 4], main[i])) < 1e-9),
      // The page's claim: the perpendicular-bisector quadrilateral is
      // inscriptible. Pitot's equality and four equal inradii test it twice.
      iterateIsInscriptible: stepErr <= tol && incircleSpread <= tol,
      formula3: !!f3 && Math.abs(f3.left - f3.right) <= tol * Math.max(1, Math.abs(f3.right)),
    };
    return {
      corners: corners, circle: circle, main: main, step: step.points,
      bisectors: step.bisectors, mainIncircle: mainIncircle, stepIncircle: stepIncircle,
      measures: {
        mainPitot: mainErr, stepPitot: stepErr, circleErr: circleErr,
        incircleSpread: incircleSpread, tangencyError: tangencyError(main, circle),
        formula3Error: f3 ? Math.abs(f3.left - f3.right) : Infinity,
        tol: tol,
      },
      claims: claims,
    };
  }

  /* The applet's init(): centre, radius min(w,h)/4, angles 0, 1.2, 2.9, 4.5. */
  function start(options) {
    const o = options || {};
    const circle = { c: CENTRE, r: RADIUS };
    return {
      A: pointOnCircle(circle, 0), B: pointOnCircle(circle, 1.2),
      C: pointOnCircle(circle, 2.9), D: pointOnCircle(circle, 4.5),
      circle: circle,
      options: {
        names: o.names === undefined ? false : !!o.names,
        angles: o.angles === undefined ? false : !!o.angles,
        diagonals: o.diagonals === undefined ? false : !!o.diagonals,
        joints: o.joints === undefined ? true : !!o.joints,
        primary: o.primary === undefined ? false : !!o.primary,
        secondary: o.secondary === undefined ? false : !!o.secondary,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  /** Drag a corner: RestrictToCircle snaps it back onto the fixed circle. */
  function move(state, name, p) {
    if (!Object.prototype.hasOwnProperty.call(state, name) || !valid(p)) return state;
    const q = onCircle(p, state.circle);
    if (!q) return state;
    return Object.assign({}, state, { [name]: q, explored: true });
  }

  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** The applet disables the four Show boxes until Primary or Secondary is on. */
  function showEnabled(state) {
    return !!(state && state.options && (state.options.primary || state.options.secondary));
  }

  /* An illustration, not a game: no win and no loss. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner so the four tangents meet in a quadrilateral.";
    const m = g.measures;
    const main = g.claims.mainIsInscriptible
      ? "The tangent quadrilateral touches the circle"
      : `The tangent quadrilateral is off by ${m.circleErr.toFixed(2)}`;
    const step = g.claims.iterateIsInscriptible
      ? "the bisector quadrilateral has an incircle too"
      : `the bisector quadrilateral is off by ${stepErrText(m)}`;
    const mode = showEnabled(state)
      ? (state.options.secondary ? " (secondary picture)" : " (primary picture)")
      : "";
    return `${main}; ${step}${mode}.`;
  }

  function stepErrText(m) {
    return `${Math.max(m.stepPitot, m.incircleSpread * m.tol).toFixed(2)}`;
  }

  function geometry(state) {
    if (!state) return null;
    return compute(state.A, state.B, state.C, state.D);
  }

  return {
    VIEW: VIEW, CENTRE: CENTRE, RADIUS: RADIUS,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, perp: perp, unit: unit, valid: valid,
    intersect: intersect, circumcircle: circumcircle, onCircle: onCircle,
    pointOnCircle: pointOnCircle, tangent: tangent, perpBisector: perpBisector,
    intersectLines: intersectLines, nearestPoint: nearestPoint,
    bisectorFoot: bisectorFoot, incircle: incircle, tangentQuad: tangentQuad,
    perpendicularQuad: perpendicularQuad, pitot: pitot, tangencyError: tangencyError,
    spread: spread, tangentLength: tangentLength, formula3: formula3,
    compute: compute, geometry: geometry, start: start, reset: reset,
    move: move, setOption: setOption, showEnabled: showEnabled,
    result: result, describe: describe,
  };
})();
