"use strict";

/*
 * Incenters in a Cyclic Quadrilateral — Alexander Bogomolny's applet
 * CyclicQuadrilateral (the Java page is now a GeoGebra sketch; the archived
 * 2012 page embeds CODE="CyclicQuadrilateral", 560 x 400).
 *
 * Four corners on the same circle make four triangles.  The centre of each
 * of those triangles (its incenter) is computed from the three corners;
 * the old page claims the four incenters form a rectangle, that
 * rABC + rACD = rABD + rBCD, and that the midpoints P,Q,R,S of the arcs AB,
 * CD, BC, AD satisfy PQ perpendicular to RS, parallel to the rectangle's
 * sides and through their midpoints.  The four lines through the incenters
 * parallel to the diagonals form a rhombus.
 *
 * This file is geometry only: no document, no window, no storage.  It defines
 * one global, CyclicQuadrilateralCore, so the page loads it with a plain
 * <script> and porting/check-cyclic-quadrilateral.mjs loads it in Node.
 * Positions are plain numbers in the SVG viewBox units.
 *
 * The incircle construction follows the applet: GeoSDoub.FindIncenter cuts
 * two half-angle rays, the incircle radius is the mean of the three distances
 * from that incenter to the triangle's sides, and HalveArc rotates a corner
 * about the circle's centre by half the angle to the next corner.
 */

const CyclicQuadrilateralCore = (() => {
  const VIEW = { x: 0, y: 0, width: 560, height: 400 };
  const CENTER = { x: 280, y: 200 };
  const RADIUS = 400 / 3; // the applet: min(width,height) / 3
  const START_ANGLES = [Math.PI / 6, 5 * Math.PI / 6, 6 * Math.PI / 5, 5 * Math.PI / 3];
  const CORNERS = ["A", "B", "C", "D"];
  const OPTION_KEYS = [
    "incenters", "incircles", "rectangle", "diagonals",
    "arcBisectors", "angleBisectors", "rhombus", "names",
  ];

  const TAU = 2 * Math.PI;
  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const norm = (p) => Math.hypot(p.x, p.y);

  /** A point of the applet's fixed circle at an angle in radians. */
  function circlePoint(t, c, r) {
    const o = c || CENTER, radius = r === undefined ? RADIUS : r;
    return point(o.x + radius * Math.cos(t), o.y + radius * Math.sin(t));
  }

  /** The applet restricts every corner to its circle (CTKMoveableDoub). */
  function clampToCircle(p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return circlePoint(0);
    const t = Math.atan2(p.y - CENTER.y, p.x - CENTER.x);
    return circlePoint(t);
  }

  /** GeoSDoub.ComputeAngle: the angle at O, in [0, PI]. */
  function angle(o, p, q) {
    const a = sub(p, o), b = sub(q, o);
    const n = norm(a) * norm(b);
    if (!n) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / n)));
  }

  /** GeoSDoub.FindOrientation: +1 when the cross product is positive. */
  function orientation(p1, p2, p3) {
    const s = p3.x * (p1.y - p2.y) + p3.y * (p2.x - p1.x)
      + p1.x * p2.y - p2.x * p1.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate about p1, clockwise on the screen when sign is +1. */
  function rotate(p1, p2, t, sign) {
    const cs = Math.cos(t), sn = Math.sin(t);
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    return point(p1.x + cs * dx - sign * sn * dy,
      p1.y + sign * sn * dx + cs * dy);
  }

  /** GeoSDoub.Intersect of the lines through a,b and c,d; null if parallel. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;
    const q = point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
    return Number.isFinite(q.x) && Number.isFinite(q.y) ? q : null;
  }

  /** GeoSDoub.NearestPoint: the foot of the perpendicular onto a-b. */
  function foot(p, a, b) {
    const d = sub(b, a), len2 = dot(d, d);
    if (len2 < 0.1) return p; // the applet's own small-length guard
    return add(a, mul(d, dot(sub(p, a), d) / len2));
  }

  /** GeoSDoub.FindIncenter, done with side-length weights (same point). */
  function incenter(a, b, c) {
    const x = dist(b, c), y = dist(a, c), z = dist(a, b);
    const s = x + y + z;
    if (!s) return null;
    return point((x * a.x + y * b.x + z * c.x) / s,
      (x * a.y + y * b.y + z * c.y) / s);
  }

  /** The applet's DrawIncenter: mean of the three incenter-to-side distances. */
  function inradius(a, b, c, i) {
    if (!i) return NaN;
    return (dist(i, foot(i, b, c)) + dist(i, foot(i, a, c))
      + dist(i, foot(i, b, a))) / 3;
  }

  /** The applet's HalveArc: rotate a by half the angle a-O-b. */
  function halveArc(a, b, o, r) {
    return rotate(o || CENTER, a, angle(o || CENTER, a, b) / 2, 1);
  }

  /** The midpoint of the arc a->b that runs along the quadrilateral's side. */
  function sideArc(a, b, o) {
    const center = o || CENTER;
    const ta = Math.atan2(a.y - center.y, a.x - center.x);
    const tb = Math.atan2(b.y - center.y, b.x - center.x);
    const gap = (tb - ta + TAU) % TAU;
    return circlePoint(ta + gap / 2, center, dist(a, center));
  }

  /** GeoSDoub.GetParallelTo(p, q1, q2): p + 100 * (q1 - q2). */
  function getParallelTo(p, q1, q2) {
    return point(p.x + 100 * (q1.x - q2.x), p.y + 100 * (q1.y - q2.y));
  }

  /** True when p is inside the triangle a,b,c (all three cross signs agree). */
  function insideTriangle(p, a, b, c) {
    const s1 = cross(sub(b, a), sub(p, a));
    const s2 = cross(sub(c, b), sub(p, b));
    const s3 = cross(sub(a, c), sub(p, c));
    return (s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0);
  }

  /**
   * The whole construction from four corners, in the applet's order.
   * The circle defaults to the applet's fixed circle; `compute` also accepts
   * any centre so the logic test can try quadrilaterals elsewhere.
   */
  function compute(a, b, c, d, circle) {
    if (![a, b, c, d].every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    if (dist(a, b) < 1e-7 || dist(b, c) < 1e-7 || dist(c, d) < 1e-7 || dist(a, d) < 1e-7) return null;
    const o = (circle && circle.c) || CENTER;
    const r = (circle && circle.r) || RADIUS;

    const IABC = incenter(a, b, c);
    const IACD = incenter(a, c, d);
    const IABD = incenter(a, b, d);
    const IBCD = incenter(b, c, d);
    if (!IABC || !IACD || !IABD || !IBCD) return null;

    // DrawBisector(A,B,C,D) -> P on arc AB, Q on arc CD;
    // DrawBisector(B,C,D,A) -> R on arc BC, S on arc DA.
    const P = halveArc(a, b, o), Q = halveArc(c, d, o);
    const R = halveArc(b, c, o), S = halveArc(d, a, o);
    const sideP = sideArc(a, b, o), sideQ = sideArc(c, d, o);
    const sideR = sideArc(b, c, o), sideS = sideArc(d, a, o);

    const radii = {
      ABC: inradius(a, b, c, IABC), ACD: inradius(a, c, d, IACD),
      ABD: inradius(a, b, d, IABD), BCD: inradius(b, c, d, IBCD),
    };
    const radiusSumError = Math.abs((radii.ABC + radii.ACD) - (radii.ABD + radii.BCD));

    // DrawIncenters draws the rectangle in the order IBCD-IACD-IABD-IABC.
    const sides = [[IBCD, IACD], [IACD, IABD], [IABD, IABC], [IABC, IBCD]];
    const sv = sides.map(([p, q]) => sub(q, p));
    const sl = sv.map(norm);
    if (sl.some((v) => v < 1e-7)) return null;
    const rightError = Math.max(...sv.map((v, i) => Math.abs(dot(v, sv[(i + 1) % 4]) / (sl[i] * sl[(i + 1) % 4]))));
    const parallelError = Math.max(
      Math.abs(cross(sv[0], sv[2]) / (sl[0] * sl[2])),
      Math.abs(cross(sv[1], sv[3]) / (sl[1] * sl[3])),
    );
    const oppositeLengthError = Math.max(Math.abs(sl[0] - sl[2]), Math.abs(sl[1] - sl[3]));

    // L[0..3] through the incenters, parallel to BD, AC, BD, AC.
    const lines = [
      { p: IBCD, q: getParallelTo(IBCD, b, d) },
      { p: IACD, q: getParallelTo(IACD, a, c) },
      { p: IABD, q: getParallelTo(IABD, b, d) },
      { p: IABC, q: getParallelTo(IABC, a, c) },
    ];
    const verts = [
      intersect(lines[0].p, lines[0].q, lines[1].p, lines[1].q),
      intersect(lines[1].p, lines[1].q, lines[2].p, lines[2].q),
      intersect(lines[2].p, lines[2].q, lines[3].p, lines[3].q),
      intersect(lines[3].p, lines[3].q, lines[0].p, lines[0].q),
    ];
    if (verts.some((v) => !v)) return null;
    const rl = verts.map((v, i) => dist(v, verts[(i + 1) % 4]));
    const rhombusSpread = Math.max(...rl) - Math.min(...rl);

    const crossOf = (p, q, s, t) => {
      const u = sub(q, p), v = sub(t, s);
      return Math.abs(cross(u, v) / (norm(u) * norm(v)));
    };
    const distanceToLine = (p, s, t) => {
      const v = sub(t, s);
      return Math.abs(cross(sub(p, s), v)) / norm(v);
    };
    const rectMids = sides.map(([p, q]) => mul(add(p, q), 0.5));
    // The page's claim uses the arc along each side.  The applet's HalveArc
    // picks the minor arc, which is the same unless a side spans > 180°.
    const midError = (u, v, s, t) => Math.max(...rectMids.map((m) => Math.min(
      distanceToLine(m, u, v), distanceToLine(m, s, t),
    )));
    const pqMidError = midError(sideP, sideQ, sideR, sideS);
    const rsMidError = pqMidError;
    const drawnPqMidError = midError(P, Q, R, S);
    const drawnRsMidError = drawnPqMidError;
    const scale = Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a), r);
    const tol = 1e-6 * scale;

    return {
      A: a, B: b, C: c, D: d, circle: { c: o, r: r },
      IABC: IABC, IACD: IACD, IABD: IABD, IBCD: IBCD,
      rectangle: sides, P: P, Q: Q, R: R, S: S,
      sideP: sideP, sideQ: sideQ, sideR: sideR, sideS: sideS,
      rhombus: { lines: lines, vertices: verts },
      angleBisectors: [
        [a, R], [a, Q], [b, S], [b, Q],
        [c, S], [c, P], [d, R], [d, P],
      ],
      radii: radii,
      measures: {
        rightError: rightError, parallelError: parallelError,
        oppositeLengthError: oppositeLengthError, radiusSumError: radiusSumError,
        rhombusSpread: rhombusSpread,
        sideArcCross: crossOf(sideP, sideQ, sideR, sideS),
        drawnArcCross: crossOf(P, Q, R, S),
        pqMidError: pqMidError, rsMidError: rsMidError,
        drawnPqMidError: drawnPqMidError, drawnRsMidError: drawnRsMidError,
      },
      claims: {
        rectangle: rightError < tol && parallelError < tol && oppositeLengthError < tol,
        radiusSum: radiusSumError < tol,
        rhombus: rhombusSpread < tol,
        arcsPerpendicular: crossOf(sideP, sideQ, sideR, sideS) > 1 - 1e-7,
        drawnArcsPerpendicular: crossOf(P, Q, R, S) > 1 - 1e-7,
        rectangleMidpoints: pqMidError < tol && rsMidError < tol,
        incentersInside: insideTriangle(IABC, a, b, c) && insideTriangle(IACD, a, c, d)
          && insideTriangle(IABD, a, b, d) && insideTriangle(IBCD, b, c, d),
        onCircle: [a, b, c, d].every((p) => Math.abs(dist(p, o) - r) < tol),
      },
    };
  }

  /** The position a new diagram starts from, from Reset() on a 560x400 canvas. */
  function start(options) {
    const o = options || {};
    const opts = {};
    for (const key of OPTION_KEYS) opts[key] = o[key] === undefined ? false : !!o[key];
    const pts = {};
    for (let i = 0; i < CORNERS.length; i++) pts[CORNERS[i]] = circlePoint(START_ANGLES[i]);
    return Object.assign(pts, { options: opts, explored: false });
  }

  /** Reset(): the four corners go back; the tick boxes and progress stay. */
  function reset(state) {
    const s = start(state.options);
    s.explored = !!state.explored;
    return s;
  }

  /** A corner dragged or nudged: the applet restricts it to its circle. */
  function move(state, name, p) {
    if (CORNERS.indexOf(name) < 0 || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    return Object.assign({}, state, { [name]: clampToCircle(p), explored: true });
  }

  function setOption(state, name, on) {
    if (OPTION_KEYS.indexOf(name) < 0) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** An illustration can be explored, never won or lost. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D, { c: CENTER, r: RADIUS });
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner away from its neighbours to see the construction.";
    const m = g.measures;
    return "The four triangle centres make a rectangle (corner error " + m.rightError.toFixed(5)
      + "), and rABC + rACD agrees with rABD + rBCD to " + m.radiusSumError.toFixed(5) + ".";
  }

  return {
    VIEW: VIEW, CENTER: CENTER, RADIUS: RADIUS, START_ANGLES: START_ANGLES,
    CORNERS: CORNERS, OPTION_KEYS: OPTION_KEYS,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, norm: norm, circlePoint: circlePoint, clampToCircle: clampToCircle,
    angle: angle, orientation: orientation, rotate: rotate, intersect: intersect,
    foot: foot, incenter: incenter, inradius: inradius, halveArc: halveArc,
    sideArc: sideArc, getParallelTo: getParallelTo, insideTriangle: insideTriangle,
    compute: compute, geometry: geometry, start: start, reset: reset, move: move,
    setOption: setOption, result: result, describe: describe,
  };
})();
