"use strict";

/*
 * EuricaCyclic — Alexander Bogomolny's applet EuricaCyclic.
 *
 * The archived cut-the-knot page asks two questions about four corners A,B,C,D
 * of a circle: the circumcircles C(ABQ), C(BCP), C(ADP), C(CDQ), where
 * P = AB ∩ CD and Q = BC ∩ AD, all pass through one point K, and (when the
 * four corners lie on a circle) P, K and Q are collinear.  Miquel's theorem
 * gives the first claim for any four points; the second uses the circle.
 *
 * The construction follows the applet's bytecode exactly: its fixed circle is
 * centred at (width/3, 11*height/20) with radius min(width,height)/5; P and Q
 * are the intersection of the extended sides, each circle is the circumcircle
 * whose centre is the intersection of two perpendicular bisectors and whose
 * radius is the mean of the three distances to it; K is the intersection of
 * C(ABQ) and C(BCP) that GeoSDoub.Intersect lists first unless that point is
 * within one unit of P.  The applet lets the corners move freely: dragging
 * just a corner leaves the grey circle where it is, while dragging the whole
 * quadrilateral replaces the circle by the one through A, B and C.
 *
 * This file is geometry only: no document, no window, no storage.  It defines
 * one global, EuricaCyclicCore, so the page loads it with a plain <script> and
 * porting/check-eurica-cyclic.mjs loads it in Node.  All positions are plain
 * numbers in the SVG viewBox units (the applet's 600 x 550 canvas).
 */

const EuricaCyclicCore = (() => {
  const VIEW = { x: 0, y: 0, width: 600, height: 550 };
  const CENTER = { x: 200, y: 302 };   // width/3, height*11/20
  const RADIUS = 110;                  // min(600,550)/5
  const START_ANGLES = [Math.PI / 2, Math.PI / 4, -Math.PI / 9, -3 * Math.PI / 4];
  const CORNERS = ["A", "B", "C", "D"];
  const OPTION_KEYS = ["names", "hint"];
  const NAN_POINT = { x: NaN, y: NaN };

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  function circlePoint(t, c, r) {
    const o = c || CENTER, radius = r === undefined ? RADIUS : r;
    return point(o.x + radius * Math.cos(t), o.y + radius * Math.sin(t));
  }

  /* GeoSDoub.Intersect of two lines. |det| < 1 gives NaN, as in the applet. */
  function lineIntersect(a, b, c, d) {
    if (![a, b, c, d].every(finite)) return NAN_POINT;
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return NAN_POINT;
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /* EuricaCyclicCanvas.Intersect: keep the old point when the new one is NaN. */
  function keptIntersect(a, b, c, d, old) {
    const q = lineIntersect(a, b, c, d);
    return finite(q) ? q : (old === undefined ? NAN_POINT : old);
  }

  /* GeoSDoub.FindCircumcenter: intersect the two rotated midpoints. */
  function findCircumcenter(a, b, c) {
    if (![a, b, c].every(finite)) return NAN_POINT;
    const m1 = point((a.x + b.x) / 2, (a.y + b.y) / 2);
    const m2 = point((b.x + c.x) / 2, (b.y + c.y) / 2);
    const n1 = point(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
    const n2 = point(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
    return lineIntersect(m1, n1, m2, n2);
  }

  /* EuricaCyclicCanvas.GetCircle: centre plus the mean of the three radii. */
  function getCircle(a, b, c) {
    const o = findCircumcenter(a, b, c);
    if (!finite(o)) return { x: NaN, y: NaN, r: NaN };
    return { x: o.x, y: o.y, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
  }

  const finiteCircle = (c) => !!c && Number.isFinite(c.x) && Number.isFinite(c.y)
    && Number.isFinite(c.r);

  /*
   * GeoSDoub.IntersectCirclesX / IntersectCirclesY.  The X form solves
   * x = m*y + b; the Y form solves y = m*x + b.  Both use the halved quadratic
   * A*t*t + 2*B*t + C = 0 and the roots (-B ± sqrt(B*B - A*C)) / A.
   */
  function circleIntersections(c0, c1) {
    if (!finiteCircle(c0) || !finiteCircle(c1)) return null;
    if (Math.abs(c0.x - c1.x) > 1) {
      const m = (c1.y - c0.y) / (c0.x - c1.x);
      const b = (c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y
        - c0.r * c0.r + c1.r * c1.r) / (2 * (c0.x - c1.x));
      const d = b - c0.x, A = m * m + 1, B = m * d - c0.y;
      const C = d * d + c0.y * c0.y - c0.r * c0.r;
      const D = B * B - A * C;
      if (D < 0) return null;
      const s = Math.sqrt(D);
      const t1 = (-B + s) / A, t2 = (-B - s) / A;
      return [point(m * t1 + b, t1), point(m * t2 + b, t2)];
    }
    if (Math.abs(c0.y - c1.y) > 1) {
      const m = (c1.x - c0.x) / (c0.y - c1.y);
      const b = (c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x
        - c0.r * c0.r + c1.r * c1.r) / (2 * (c0.y - c1.y));
      const d = b - c0.y, A = m * m + 1, B = m * d - c0.x;
      const C = d * d + c0.x * c0.x - c0.r * c0.r;
      const D = B * B - A * C;
      if (D < 0) return null;
      const s = Math.sqrt(D);
      const t1 = (-B + s) / A, t2 = (-B - s) / A;
      return [point(t1, m * t1 + b), point(t2, m * t2 + b)];
    }
    return [point(c0.x, c0.y), point(c0.x, c0.y)];
  }

  /* EuricaCyclicCanvas.Other: reject the listed point when it is near P. */
  function other(pair, p) {
    if (!pair || pair.length < 2) return null;
    return sqDist(pair[0], p) < 1 ? pair[1] : pair[0];
  }

  /* The other intersection of the same two circles: the Miquel point itself. */
  function miquel(pair, b, c3, c4) {
    if (!pair || pair.length < 2) return null;
    const error = (q) => Math.abs(dist(q, point(c3.x, c3.y)) - c3.r)
      + Math.abs(dist(q, point(c4.x, c4.y)) - c4.r);
    return error(pair[0]) <= error(pair[1]) ? pair[0] : pair[1];
  }

  /* CheckFinished: all four corners within one unit of the drawn circle. */
  function onCircle(p, c) {
    return Math.abs(dist(p, point(c.x, c.y)) - c.r) < 1;
  }
  function checkFinished(a, b, c, d, circle) {
    return [a, b, c, d].every((p) => finite(p) && finiteCircle(circle) && onCircle(p, circle));
  }

  /* The whole Compute() of the applet, from four corners and its circle. */
  function construct(a, b, c, d, circle, previous) {
    const prev = previous || {};
    if (![a, b, c, d].every(finite) || !finiteCircle(circle)) {
      return { ok: false, A: a, B: b, C: c, D: d, circle: circle };
    }
    const P = keptIntersect(a, b, c, d, prev.P);
    const Q = keptIntersect(b, c, d, a, prev.Q);
    const QKBA = getCircle(Q, b, a);
    const BKPC = getCircle(b, P, c);
    const KCDQ = getCircle(c, d, Q);
    const AKPD = getCircle(a, P, d);
    const pair = circleIntersections(QKBA, BKPC);
    const K = other(pair, P);
    const Ktrue = miquel(pair, b, KCDQ, AKPD);

    const ok = finite(P) && finite(Q) && [QKBA, BKPC, KCDQ, AKPD].every(finiteCircle)
      && !!pair && finite(K) && finite(Ktrue);
    const scale = Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a), circle.r);
    const tol = 1e-7 * scale;
    const circleErrors = [QKBA, BKPC, KCDQ, AKPD].map((cc) =>
      finiteCircle(cc) && finite(Ktrue) ? Math.abs(dist(Ktrue, cc) - cc.r) : Infinity);
    const pq = dist(P, Q);
    const collinearError = ok && pq > 0
      ? Math.abs(cross(sub(Q, P), sub(Ktrue, P))) / pq : Infinity;
    const appletCollinearError = ok && pq > 0
      ? Math.abs(cross(sub(Q, P), sub(K, P))) / pq : Infinity;

    return {
      ok: ok, A: a, B: b, C: c, D: d, circle: circle,
      P: P, Q: Q, K: K, Ktrue: Ktrue, pair: pair,
      circles: { QKBA: QKBA, BKPC: BKPC, KCDQ: KCDQ, AKPD: AKPD },
      sides: [[a, P], [b, Q], [c, P], [d, Q]],
      lines: [[b, K], [P, K], [Q, K]],
      angles: [[c, b, d, 2], [K, b, P, 2], [a, d, b, 1], [K, Q, b, 1]],
      cyclic: checkFinished(a, b, c, d, circle),
      measures: {
        scale: scale,
        concurrencyError: Math.max.apply(null, circleErrors),
        collinearError: collinearError,
        appletCollinearError: appletCollinearError,
        circleSpread: Math.max.apply(null, [QKBA, BKPC, KCDQ, AKPD]
          .map((cc) => (finiteCircle(cc) ? cc.r : Infinity)))
          - Math.min.apply(null, [QKBA, BKPC, KCDQ, AKPD]
            .map((cc) => (finiteCircle(cc) ? cc.r : Infinity))),
      },
      claims: {
        concurrent: ok && Math.max.apply(null, circleErrors) < tol,
        collinear: ok && collinearError < tol,
        appletKIsMiquel: ok && dist(K, Ktrue) < tol,
        cyclic: checkFinished(a, b, c, d, circle),
      },
    };
  }

  /** The applet's Reset() on its 600x550 canvas. */
  function start(options) {
    const o = options || {};
    const opts = {};
    for (const key of OPTION_KEYS) {
      opts[key] = o[key] === undefined ? (key === "names") : !!o[key];
    }
    const s = {};
    for (let i = 0; i < CORNERS.length; i++) s[CORNERS[i]] = circlePoint(START_ANGLES[i]);
    return Object.assign(s, {
      options: opts,
      circle: { x: CENTER.x, y: CENTER.y, r: RADIUS },
      explored: false,
    });
  }

  /** Reset restores the corners and the original circle, but keeps the ticks. */
  function reset(state) {
    const s = start(state.options);
    s.explored = !!state.explored;
    return s;
  }

  /** A single corner is a free MoveablePoint: it does not stay on the circle. */
  function move(state, name, p) {
    if (CORNERS.indexOf(name) < 0 || !finite(p)) return state;
    return Object.assign({}, state, { [name]: point(p.x, p.y), explored: true });
  }

  /** Dragging the whole quadrilateral, as the applet's MoveablePoly does. */
  function dragShape(state, delta) {
    if (!finite(delta)) return state;
    const s = {};
    for (const key of CORNERS) s[key] = add(state[key], delta);
    // mouseDragged sets Circle = GetCircle(A,B,C) on every move.
    return Object.assign({}, state, s, {
      circle: getCircle(s.A, s.B, s.C), explored: true,
    });
  }

  function setOption(state, name, on) {
    if (OPTION_KEYS.indexOf(name) < 0) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** An illustration: exploring it finishes it, but nobody wins or loses. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  function geometry(state) {
    return construct(state.A, state.B, state.C, state.D, state.circle);
  }

  function describe(state) {
    const g = geometry(state);
    if (!g || !g.ok) return "Move a corner away from its neighbours to see the circles.";
    if (g.claims.concurrent && g.claims.collinear) {
      return "K lies on all four circles, and P, K and Q line up"
        + (g.cyclic ? " while ABCD is on the circle." : " even after ABCD has left the circle.");
    }
    if (g.claims.concurrent) {
      return "K still lies on all four circles, but P, K and Q no longer line up.";
    }
    return "Move the corners apart: the circles need three different points each.";
  }

  return {
    VIEW: VIEW, CENTER: CENTER, RADIUS: RADIUS, START_ANGLES: START_ANGLES,
    CORNERS: CORNERS, OPTION_KEYS: OPTION_KEYS, NAN_POINT: NAN_POINT,
    point: point, add: add, sub: sub, mul: mul, cross: cross, dist: dist,
    sqDist: sqDist, finite: finite, circlePoint: circlePoint,
    lineIntersect: lineIntersect, keptIntersect: keptIntersect,
    findCircumcenter: findCircumcenter, getCircle: getCircle,
    circleIntersections: circleIntersections, other: other, miquel: miquel,
    onCircle: onCircle, checkFinished: checkFinished, construct: construct,
    start: start, reset: reset, move: move, dragShape: dragShape,
    setOption: setOption, result: result, geometry: geometry, describe: describe,
  };
})();
