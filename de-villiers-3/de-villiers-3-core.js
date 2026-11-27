"use strict";

/*
 * Perpendicular Bisectors in an Inscriptible Quadrilateral II — the applet
 * deVilliers3 by Alexander Bogomolny, proof by Darij Grinberg from an idea of
 * Marcello Tarquini.
 *
 * Four dots A,B,C,D glide on one circle. The tangents there make a
 * quadrilateral whose incircle is that same circle. From the external angle
 * bisectors of this tangent quadrilateral come X,Y,Z,W; the perpendiculars to
 * its sides through those four points make A'B'C'D'. The perpendicular
 * bisectors of the sides make A1B1C1D1. The applet shows that halving the
 * distance from the incircle's centre to A',B',C',D' lands exactly on
 * A1,B1,C1,D1: that homothety is the proof that an inscriptible quadrilateral
 * stays inscriptible when its sides are replaced by their perpendicular
 * bisectors.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, DeVilliers3Core, so the page loads it with a
 * plain <script> and porting/check-de-villiers-3.mjs loads it in Node. All
 * points are plain {x,y} data in the SVG's viewBox units, and functions return
 * new objects without changing what they were given.
 */
const DeVilliers3Core = (() => {
  /* The applet's getParameterInfo says 400x250 is optimal; init uses
   * radius = min(width,height)/5 and centre = (width/2,height/2). */
  const VIEW = { x: 0, y: 0, width: 400, height: 250 };
  const CIRCLE = { c: { x: 200, y: 125 }, r: 50 };
  /* init places A,B,C at these angles and D at 4.5 + Math.random()*PI. The
   * random offset is replaced by the fixed 4.5 so a drawn position can be
   * saved and replayed; the choice makes no difference to the mathematics. */
  const START_ANGLES = [0, 1.2, 2.9, 4.5];
  const KEYS = ["A", "B", "C", "D"];
  /* The eight Checkboxes of deVilliers3Panel, in the applet's own order. */
  const OPTION_KEYS = [
    "names", "angles", "perps", "bisectors", "centers", "diagonals", "radii", "circles",
  ];

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const mid = (p, q) => mul(add(p, q), 0.5);
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const valid = (points) => points.every(finite);

  const pointOnCircle = (c, r, t) => point(c.x + r * Math.cos(t), c.y + r * Math.sin(t));

  /** GeoSDoub.Intersect: ax+by+c=0 lines; |det| < 1 gives NaN in the applet. */
  function intersect(p, q, r, s) {
    if (!valid([p, q, r, s])) return null;
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return null;
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** GeoSDoub.FindCircumcenter, as used by GetCircle and Compute. */
  function circumcenter(a, b, c) {
    const m1 = mid(a, b), m2 = mid(b, c);
    return intersect(
      m1, point(m1.x + b.y - a.y, m1.y + a.x - b.x),
      m2, point(m2.x + c.y - b.y, m2.y + b.x - c.x),
    );
  }

  /** The canvas's GetCircle: circumcentre and the mean of the three radii. */
  function getCircle(a, b, c) {
    const o = circumcenter(a, b, c);
    if (!o) return null;
    return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
  }

  /* GeoSDoub.ComputeAngle, FindOrientation, Rotate: the angle at p between
   * the rays to q and r, and a point on the ray q rotated by half that angle. */
  function angle(p, q, r) {
    const u = sub(q, p), v = sub(r, p);
    const n = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    if (!n) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / n)));
  }

  function orientation(p, q, r) {
    const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return s > 0 ? 1 : -1;
  }

  function rotate(p, q, a, o) {
    const cs = Math.cos(a), sn = Math.sin(a), dx = q.x - p.x, dy = q.y - p.y;
    return point(p.x + cs * dx - o * sn * dy, p.y + o * sn * dx + cs * dy);
  }

  /** deVilliers3Canvas.FindAngleBisector: the internal bisector at p. */
  function angleBisector(p, q, r) {
    return rotate(p, q, angle(p, q, r) / 2, orientation(p, q, r));
  }

  /** deVilliers3Canvas.Perp: turn a bisector ray a quarter turn. */
  function perp(p, q) {
    return point(p.x + (q.y - p.y), p.y - (q.x - p.x));
  }

  /** GeoSDoub.NearestPoint: foot of the perpendicular from p onto line a-b. */
  function nearestPoint(p, a, b) {
    if (!valid([p, a, b])) return null;
    if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return a;
    const dx = b.x - a.x, dy = b.y - a.y, n = dx * dx + dy * dy;
    if (!n) return a;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / n;
    return point(a.x + dx * t, a.y + dy * t);
  }

  /** GetTangent: the line through p perpendicular to the radius p-O. */
  function tangent(p, o) {
    return { p, q: point(p.x - (p.y - o.y), p.y + (p.x - o.x)) };
  }

  /** Perpendicular bisector of the segment a-b (DoubPoly.FormBisector). */
  function formBisector(a, b) {
    const m = mid(a, b);
    return { p: m, q: point(m.x + a.y - b.y, m.y + b.x - a.x) };
  }

  /**
   * The DoubPoly iteration: four perpendicular bisectors and the four
   * circumcentres of neighbouring triples. The applet rotates its names by
   * one at each iteration, so vertex i here is labelled D,A,B,C.
   */
  function pb(vertices) {
    if (!Array.isArray(vertices) || vertices.length !== 4 || !valid(vertices)) return null;
    const bisectors = [];
    for (let i = 0; i < 4; i++) {
      bisectors.push(formBisector(vertices[(i + 3) % 4], vertices[i]));
    }
    const out = [];
    let prev = bisectors[3];
    for (let i = 0; i < 4; i++) {
      const p = intersect(prev.p, prev.q, bisectors[i].p, bisectors[i].q);
      if (!p || (p.x === 0 && p.y === 0) || !finite(p)) return null;
      out.push(p);
      prev = bisectors[i];
    }
    return { vertices: out, bisectors };
  }

  /** Push a dragged point back onto the applet's fixed circle. */
  function project(p) {
    if (!finite(p)) return pointOnCircle(CIRCLE.c, CIRCLE.r, 0);
    const dx = p.x - CIRCLE.c.x, dy = p.y - CIRCLE.c.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return pointOnCircle(CIRCLE.c, CIRCLE.r, 0);
    return point(CIRCLE.c.x + (dx * CIRCLE.r) / d, CIRCLE.c.y + (dy * CIRCLE.r) / d);
  }

  /** The position a new diagram starts from. */
  function start(options) {
    const o = options || {};
    const points = {};
    for (let i = 0; i < 4; i++) {
      points[KEYS[i]] = o.points && finite(o.points[KEYS[i]])
        ? project(o.points[KEYS[i]])
        : pointOnCircle(CIRCLE.c, CIRCLE.r, START_ANGLES[i]);
    }
    const opts = {};
    for (const k of OPTION_KEYS) opts[k] = o.options && o.options[k] !== undefined ? !!o.options[k] : false;
    return { points, options: opts, explored: false };
  }

  /** A new Reset: the applet keeps its four checkboxes, resets the dots. */
  function reset(state) {
    const s = start({ options: state.options });
    s.explored = !!state.explored;
    return s;
  }

  function move(state, name, p) {
    if (!KEYS.includes(name) || !finite(p)) return state;
    return {
      points: Object.assign({}, state.points, { [name]: project(p) }),
      options: Object.assign({}, state.options),
      explored: true,
    };
  }

  function setOption(state, name, on) {
    if (!OPTION_KEYS.includes(name)) return state;
    return {
      points: Object.assign({}, state.points),
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    };
  }

  /** An illustration has no win and no loss. */
  function result(state) {
    return null;
  }

  /** Perpendicular distance from p to the infinite line through a and b. */
  function distanceToLine(p, a, b) {
    const n = dist(a, b);
    return n > 0 ? Math.abs(cross(sub(p, a), sub(b, a))) / n : dist(p, a);
  }

  /** Does the quadrilateral have an incircle? Pitot's equality for a convex
   * quadrilateral: the two sums of opposite sides agree. */
  function pitot(q) {
    const s = q.map((p, i) => dist(p, q[(i + 1) % 4]));
    return { sum1: s[0] + s[2], sum2: s[1] + s[3], error: Math.abs(s[0] + s[2] - s[1] - s[3]) };
  }

  function convex(q) {
    if (!valid(q)) return false;
    const turns = q.map((p, i) => cross(sub(q[(i + 1) % 4], p), sub(q[(i + 2) % 4], q[(i + 1) % 4])));
    return (turns.every((t) => t > 0) || turns.every((t) => t < 0))
      && Math.min(...turns.map(Math.abs)) > 1e-9;
  }

  /**
   * Every point and every claim of the drawing. Returns null when the applet
   * would find a NaN or infinite intersection and therefore draw nothing.
   */
  function compute(a, b, c, d) {
    if (!valid([a, b, c, d])) return null;
    const circle = getCircle(a, b, c);
    if (!circle || !(circle.r > 1e-9) || dist(a, b) < 1e-9 || dist(b, c) < 1e-9
      || dist(c, d) < 1e-9 || dist(d, a) < 1e-9) return null;
    const o = circle.c;

    // DrawConfiguration: the tangent quadrilateral AB, BC, CD, DA.
    const ta = tangent(a, o), tb = tangent(b, o), tc = tangent(c, o), td = tangent(d, o);
    const verts = [
      intersect(ta.p, ta.q, tb.p, tb.q),
      intersect(tb.p, tb.q, tc.p, tc.q),
      intersect(tc.p, tc.q, td.p, td.q),
      intersect(td.p, td.q, ta.p, ta.q),
    ];
    if (!valid(verts)) return null;

    // Compute: internal bisectors at the four tangent corners, then Perp:
    // the external bisectors. X,Y,Z,W are consecutive intersections.
    const internal = [
      angleBisector(verts[0], verts[3], verts[1]),
      angleBisector(verts[1], verts[0], verts[2]),
      angleBisector(verts[2], verts[1], verts[3]),
      angleBisector(verts[3], verts[2], verts[0]),
    ];
    if (!valid(internal)) return null;
    const external = verts.map((v, i) => perp(v, internal[i]));
    const xyz = [
      intersect(verts[0], external[0], verts[1], external[1]),
      intersect(verts[1], external[1], verts[2], external[2]),
      intersect(verts[2], external[2], verts[3], external[3]),
      intersect(verts[3], external[3], verts[0], external[0]),
    ];
    if (!valid(xyz)) return null;
    const [X, Y, Z, W] = xyz;

    // Compute: M' is the centre of the circle through X,Y,Z (and W).
    const center = circumcenter(X, Y, Z);
    if (!center) return null;
    const radius = (dist(center, X) + dist(center, Y) + dist(center, Z)) / 3;
    const incircle = { c: center, r: radius };

    // ComputePerps: the perpendicular to each side of the tangent
    // quadrilateral through the corresponding point X,Y,Z,W.
    const lines = [
      { p: X, q: nearestPoint(X, verts[0], verts[1]) },
      { p: Y, q: nearestPoint(Y, verts[1], verts[2]) },
      { p: Z, q: nearestPoint(Z, verts[2], verts[3]) },
      { p: W, q: nearestPoint(W, verts[3], verts[0]) },
    ];
    if (lines.some((l) => !finite(l.q))) return null;
    const prime = [
      intersect(lines[3].p, lines[3].q, lines[0].p, lines[0].q),
      intersect(lines[0].p, lines[0].q, lines[1].p, lines[1].q),
      intersect(lines[1].p, lines[1].q, lines[2].p, lines[2].q),
      intersect(lines[2].p, lines[2].q, lines[3].p, lines[3].q),
    ];
    if (!valid(prime)) return null;

    // DrawIterations: one PB step on the tangent quadrilateral.
    const pbTangent = pb(verts);
    const pbCircle = pb([a, b, c, d]);
    if (!pbTangent || !pbCircle) return null;

    const scale = Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a),
      dist(X, Z), dist(Y, W));
    const tol = 1e-6 * scale;

    // The page's proof, measured on the drawing.
    const tangentRadii = verts.map((p, i) => distanceToLine(o, p, verts[(i + 1) % 4]));
    const tangentSpread = Math.max(...tangentRadii.map((r) => Math.abs(r - circle.r)));
    const diagErrors = [
      distanceToLine(o, X, Z),
      distanceToLine(o, Y, W),
    ];
    const xyzRadii = xyz.map((p) => Math.abs(dist(p, center) - radius));
    const primeRadii = prime.map((p, i) => distanceToLine(center, p, prime[(i + 1) % 4]));
    const primeMean = primeRadii.reduce((s, v) => s + v, 0) / 4;
    const primeSpread = Math.max(...primeRadii.map((r) => Math.abs(r - primeMean)));
    // Homothety with centre o and ratio 1/2 takes prime[i] to pbTangent[i+1].
    const homothety = prime.map((p, i) => dist(mid(o, p), pbTangent.vertices[(i + 1) % 4]));
    const quarter = [X, Y, Z, W].map((p, i) =>
      Math.abs(dist(mid(o, p), verts[i]) - dist(mid(o, p), verts[(i + 1) % 4])));
    const pitotT = pitot(pbTangent.vertices);
    const pbCircleErrors = pbCircle.vertices.map((p) => dist(p, o));

    const measures = {
      tangentSpread: tangentSpread,
      diagError: Math.max(...diagErrors),
      xyzSpread: Math.max(...xyzRadii),
      primeSpread: primeSpread,
      primeInradius: primeMean,
      homothetyError: Math.max(...homothety),
      quarterError: Math.max(...quarter),
      pitotError: pitotT.error,
      cyclicPBError: Math.max(...pbCircleErrors),
    };

    const claims = {
      // The tangent quadrilateral has an incircle: the original circle.
      tangentInscriptible: tangentSpread <= tol,
      // The diagonals of XYZW meet at that incircle's centre.
      xyzDiagonalsAtIncenter: measures.diagError <= tol,
      // X,Y,Z,W lie on the circle the applet draws about M'.
      xyzCyclic: measures.xyzSpread <= tol,
      // A'B'C'D' is inscriptible (the older theorem the proof quotes).
      primeInscriptible: primeSpread <= tol && convex(prime),
      // Q = midpoint(M,X) lies on the perpendicular bisector of each side.
      quarterPoints: measures.quarterError <= tol,
      // The homothety of centre M and ratio 1/2 maps A'B'C'D' to A1B1C1D1.
      homothety: measures.homothetyError <= tol,
      // Therefore PB of an inscriptible quadrilateral is inscriptible.
      pbInscriptible: pitotT.error <= tol && convex(pbTangent.vertices),
      // The draggable dots are cyclic, so PB of them collapses to the centre.
      cyclicPBDegenerate: measures.cyclicPBError <= tol,
    };

    return {
      A: a, B: b, C: c, D: d, circle: circle, tangents: [ta, tb, tc, td],
      tangentVertices: verts, internal: internal, external: external,
      X: X, Y: Y, Z: Z, W: W, center: center, radius: radius, incircle: incircle,
      lines: lines, prime: prime, pbTangent: pbTangent, pbCircle: pbCircle,
      measures: measures, claims: claims,
    };
  }

  function geometry(state) {
    if (!state || !state.points) return null;
    const p = state.points;
    return compute(p.A, p.B, p.C, p.D);
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move the dots apart so the tangents and bisectors meet clearly.";
    const m = g.measures;
    const ok = Object.values(g.claims).every(Boolean);
    return ok
      ? "Everything fits: halving from M lands on A1B1C1D1 (off by "
        + m.homothetyError.toExponential(1) + ")."
      : "The drawing is stretched: halving from M is off by "
        + m.homothetyError.toFixed(2) + ". Drag a dot to a calmer spot.";
  }

  return {
    VIEW: VIEW, CIRCLE: CIRCLE, START_ANGLES: START_ANGLES, KEYS: KEYS,
    OPTION_KEYS: OPTION_KEYS,
    point: point, add: add, sub: sub, mul: mul, dist: dist, cross: cross, dot: dot,
    mid: mid, finite: finite, valid: valid, pointOnCircle: pointOnCircle,
    intersect: intersect, circumcenter: circumcenter, getCircle: getCircle,
    angle: angle, orientation: orientation, rotate: rotate,
    angleBisector: angleBisector, perp: perp, nearestPoint: nearestPoint,
    tangent: tangent, formBisector: formBisector, pb: pb, project: project,
    start: start, reset: reset, move: move, setOption: setOption, result: result,
    distanceToLine: distanceToLine, pitot: pitot, convex: convex,
    compute: compute, geometry: geometry, describe: describe,
  };
})();
