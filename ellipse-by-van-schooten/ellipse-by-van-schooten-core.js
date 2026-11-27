"use strict";

/*
 * Van Schooten's Locus Problem — Alexander Bogomolny's EllipseByVanSchooten.
 *
 * A rigid triangle ABC has A on one arm of an angle at O and B on the other.
 * The applet draws the circle through O, A and B, and keeps the two angles of
 * triangle ABC fixed when A or B is dragged: C is rebuilt as the intersection
 * of two rotated copies of AB (UpgradeAngles / UpgradePFromAngles). When the
 * triangle is *not* being defined freely, AB keeps its length, so the circle's
 * radius stays fixed and P, Q — the ends of the diameter through C — slide on
 * two perpendicular lines through O. That puts C on an ellipse (the trammel of
 * Archimedes). This is an illustration: it has no win and no loss.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, EllipseByVanSchootenCore. Positions are
 * plain data, and every function returns a new position.
 */
const EllipseByVanSchootenCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 250;
  const TRACE_LIMIT = 500; // MyTracePoint.Limit in the applet
  const PI = Math.PI;

  const point = (x, y) => ({ x: x, y: y });
  const copy = (p) => ({ x: p.x, y: p.y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const lerp = (p, q, t) => point(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
  const round = (v) => Math.round(v);

  /** GeoSDoub.FindOrientation: +1 when q is to the left of the ray p -> r. */
  function orientation(p, q, r) {
    const cross = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return cross > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle(p, q, r): the signed angle at q. */
  function signedAngle(p, q, r) {
    const pq = dist(p, q), qr = dist(q, r);
    if (!pq || !qr) return 0;
    const cos = (sqDist(p, q) + sqDist(q, r) - sqDist(p, r)) / (2 * pq * qr);
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    return orientation(p, q, r) === 1 ? angle : -angle;
  }

  /** GeoSDoub.Intersect of two lines: NaN points when |denominator| < 1. */
  function intersectLines(a, b, c, d) {
    const a4 = a.y - b.y, a6 = b.x - a.x, a8 = a.x * b.y - a.y * b.x;
    const a10 = c.y - d.y, a12 = d.x - c.x, a14 = c.x * d.y - c.y * d.x;
    const den = a4 * a12 - a10 * a6;
    if (Math.abs(den) < 1) return point(NaN, NaN);
    return point((a6 * a14 - a12 * a8) / den, (a8 * a10 - a14 * a4) / den);
  }

  /** GeoSDoub.FindCircumcenter: cross the two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const m1 = lerp(a, b, 0.5), m2 = lerp(b, c, 0.5);
    const d1 = point(b.y - a.y, -(b.x - a.x));
    const d2 = point(c.y - b.y, -(c.x - b.x));
    return intersectLines(m1, add(m1, d1), m2, add(m2, d2));
  }

  /** The applet's GetCircle: centre from FindCircumcenter, mean of the radii. */
  function circleThrough(a, b, c) {
    const center = circumcenter(a, b, c);
    const radius = (dist(center, a) + dist(center, b) + dist(center, c)) / 3;
    return { center: center, radius: radius };
  }

  /** GeoSDoub.Intersect(DoubLine, DoubCircle), the applet's IntersectX/Y. */
  function lineCircle(a, b, circle) {
    const hits = [];
    if (Math.abs(a.y - b.y) > 1) {
      const slope = (a.x - b.x) / (a.y - b.y);
      const intercept = b.x - slope * b.y;
      const aa = slope * slope + 1;
      const bb = slope * (intercept - circle.center.x) - circle.center.y;
      const cc = circle.center.y * circle.center.y +
        (intercept - circle.center.x) * (intercept - circle.center.x) - circle.radius * circle.radius;
      const disc = bb * bb - aa * cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
      return [point(slope * t1 + intercept, t1), point(slope * t2 + intercept, t2)];
    }
    if (Math.abs(a.x - b.x) > 1) {
      const slope = (a.y - b.y) / (a.x - b.x);
      const intercept = b.y - slope * b.x;
      const aa = slope * slope + 1;
      const bb = slope * (intercept - circle.center.y) - circle.center.x;
      const cc = circle.center.x * circle.center.x +
        (intercept - circle.center.y) * (intercept - circle.center.y) - circle.radius * circle.radius;
      const disc = bb * bb - aa * cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
      return [point(t1, slope * t1 + intercept), point(t2, slope * t2 + intercept)];
    }
    return hits.length ? hits : null;
  }

  /** GeoSDoub.Rotate(p about o by angle, direction dir). */
  function rotate(o, p, angle, dir) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return point(
      o.x + cs * (p.x - o.x) - dir * sn * (p.y - o.y),
      o.y + dir * sn * (p.x - o.x) + cs * (p.y - o.y)
    );
  }

  /** DoubLine.UpdateMidPoint: the parameter of `mid` on the line p -> q. */
  function lineParameter(p, q, mid) {
    const d = sub(p, q);
    const den = dot(d, d);
    return den === 0 ? 0 : -dot(d, sub(q, mid)) / den;
  }

  /** GeoSDoub.NearestPoint: keeps A and B on their arms while dragging. */
  function nearestPoint(p, a, b) {
    const d = sub(b, a), den = dot(d, d);
    if (den === 0) return copy(a);
    return add(a, mul(d, dot(d, sub(p, a)) / den));
  }

  /** The applet's Compute: circle L, and the diameter through C. */
  function withConstruction(s) {
    const circle = circleThrough(s.O, s.A, s.B);
    let P = null, Q = null;
    if (Math.abs(dist(circle.center, s.C) - circle.radius) > 1) {
      const hits = lineCircle(circle.center, s.C, circle);
      if (hits && hits.length === 2) {
        P = hits[0]; Q = hits[1];
      }
    }
    return Object.assign({}, s, { circle: circle, P: P, Q: Q });
  }

  /** UpgradeAngles: remember the two angles at C and B of triangle ABC. */
  function upgradeAngles(s) {
    return Object.assign({}, s, {
      angles: point(signedAngle(s.B, s.C, s.A), signedAngle(s.A, s.B, s.C)),
    });
  }

  /** UpgradePFromAngles: rebuild C from the remembered angles and A, B. */
  function upgradePFromAngles(s) {
    const upper = rotate(s.A, s.B, s.angles.x, -1); // rotate B about A by -angle C
    const lower = rotate(s.B, s.A, s.angles.y, 1);  // rotate A about B by +angle B
    const C = intersectLines(s.B, upper, s.A, lower);
    return withConstruction(Object.assign({}, s, { C: C }));
  }

  /** The trace keeps only the last 500 points, as MyTracePoint.SetPoint does. */
  function pushTrace(s, p) {
    if (!s.options.trace) return s;
    const trace = s.trace.concat([copy(p)]);
    if (trace.length > TRACE_LIMIT) trace.shift();
    return Object.assign({}, s, { trace: trace });
  }

  function start(options) {
    const o = Object.assign({ names: true, hint: false, trace: false, rigid: true }, options || {});
    const O = point((WIDTH * 3) / 7, (HEIGHT * 4) / 7);
    const X = point((WIDTH * 4) / 5, O.y);
    const Y = point(O.x, HEIGHT / 5);
    const coefA = 0.6, coefB = 0.5;
    const A = lerp(O, X, coefA), B = lerp(O, Y, coefB);
    const first = {
      WIDTH: WIDTH, HEIGHT: HEIGHT,
      O: O, X: X, Y: Y, A: A, B: B, As: copy(A), Bs: copy(B),
      coefA: coefA, coefB: coefB, length: dist(A, B),
      angles: point(PI / 6, PI / 3),
      C: point(0, 0), circle: null, P: null, Q: null,
      options: o, trace: [],
    };
    return upgradePFromAngles(first);
  }

  /* --------------------------------------------------------- the four moves */

  /** Drag A. In rigid mode B follows at the same distance from A. */
  function moveA(s, raw) {
    let A = nearestPoint(raw, s.O, s.X);
    let next = Object.assign({}, s, { A: A });
    if (s.options.rigid) {
      // GeoSDoub.Intersect(DoubCircle(A, Length), LineY), exactly as AMoved.
      const candidates = circleLineY(A, s.length, s.O, s.Y);
      if (candidates) {
        const same = orientation(candidates[0], s.X, s.O) === orientation(s.B, s.X, s.O);
        const B = same ? candidates[0] : candidates[1];
        next.B = B;
        next.As = copy(A);
        next.coefB = lineParameter(s.O, s.Y, B);
        next.coefA = lineParameter(s.O, s.X, A);
        next = upgradePFromAngles(next);
      } else {
        // The circle misses the arm: the applet puts A back where it was.
        next.A = copy(s.As);
        next.coefA = lineParameter(s.O, s.X, next.A);
      }
    } else {
      next.coefA = lineParameter(s.O, s.X, A);
      next = upgradeAngles(next);
    }
    next.length = dist(next.A, next.B);
    next.coefA = lineParameter(s.O, s.X, next.A);
    return pushTrace(withConstruction(next), next.C);
  }

  /** GeoSDoub.Intersect(DoubCircle, DoubLine) for the vertical arm O -> Y. */
  function circleLineY(center, radius, a, b) {
    return lineCircle(a, b, { center: center, radius: radius });
  }

  /** GeoSDoub.Intersect(DoubCircle, DoubLine) for the horizontal arm O -> X. */
  function circleLineX(center, radius, a, b) {
    return lineCircle(a, b, { center: center, radius: radius });
  }

  /** Drag B. In rigid mode A follows at the same distance from B. */
  function moveB(s, raw) {
    let B = nearestPoint(raw, s.O, s.Y);
    let next = Object.assign({}, s, { B: B });
    if (s.options.rigid) {
      const candidates = circleLineX(B, s.length, s.O, s.X);
      if (candidates) {
        const same = orientation(candidates[0], s.O, s.Y) === orientation(s.A, s.O, s.Y);
        const A = same ? candidates[0] : candidates[1];
        next.A = A;
        next.Bs = copy(B);
        next.coefA = lineParameter(s.O, s.X, A);
        next.coefB = lineParameter(s.O, s.Y, B);
        next = upgradePFromAngles(next);
      } else {
        next.B = copy(s.Bs);
        next.coefB = lineParameter(s.O, s.Y, next.B);
      }
    } else {
      next.coefB = lineParameter(s.O, s.Y, B);
      next = upgradeAngles(next);
    }
    next.length = dist(next.A, next.B);
    next.coefB = lineParameter(s.O, s.Y, next.B);
    return pushTrace(withConstruction(next), next.C);
  }

  /** Drag C: only the remembered angles change, the triangle follows. */
  function moveC(s, raw) {
    const next = upgradeAngles(Object.assign({}, s, { C: copy(raw) }));
    return withConstruction(next);
  }

  /** Drag the end X of the horizontal arm: A keeps its parameter on the arm. */
  function moveX(s, raw) {
    const X = copy(raw);
    const A = lerp(s.O, X, s.coefA);
    const next = upgradeAngles(Object.assign({}, s, {
      X: X, A: A, As: copy(A), length: dist(A, s.B),
    }));
    return withConstruction(next);
  }

  /** Drag the end Y of the vertical arm: B keeps its parameter on the arm. */
  function moveY(s, raw) {
    const Y = copy(raw);
    const B = lerp(s.O, Y, s.coefB);
    const next = upgradeAngles(Object.assign({}, s, {
      Y: Y, B: B, Bs: copy(B), length: dist(s.A, B),
    }));
    return withConstruction(next);
  }

  /**
   * The page says O is draggable and the arms still meet there. The Java code
   * instead drops A, B, C, X and Y onto the cursor when O is dragged, which
   * destroys the configuration; this port keeps the whole picture rigid and
   * translates it with O (the maths section says so).
   */
  function moveO(s, raw) {
    const shift = sub(raw, s.O);
    const moved = (p) => add(p, shift);
    return withConstruction(Object.assign({}, s, {
      O: copy(raw), X: moved(s.X), Y: moved(s.Y),
      A: moved(s.A), B: moved(s.B), C: moved(s.C),
      As: moved(s.As), Bs: moved(s.Bs),
    }));
  }

  /** The four checkboxes of EllipseByVanSchootenPanel. */
  function setOption(s, name, value) {
    const options = Object.assign({}, s.options, { [name]: !!value });
    const next = Object.assign({}, s, { options: options });
    // MakeTriangle(false/true) and Trace(false) both throw away the trace.
    return withConstruction(name === "rigid" || name === "trace" ? Object.assign(next, { trace: [] }) : next);
  }

  /** A compact position for Track.state and the tutor. */
  function snapshot(s) {
    return {
      O: copy(s.O), X: copy(s.X), Y: copy(s.Y), A: copy(s.A), B: copy(s.B), C: copy(s.C),
      P: s.P ? copy(s.P) : null, Q: s.Q ? copy(s.Q) : null,
      center: s.circle ? copy(s.circle.center) : null,
      radius: s.circle ? s.circle.radius : null,
      options: Object.assign({}, s.options), traceLength: s.trace.length,
    };
  }

  /** The line under the picture. An illustration has no win or loss. */
  function describe(s) {
    const halfAxes = s.circle && s.P && s.Q
      ? [dist(s.C, s.P), dist(s.C, s.Q)]
      : null;
    const extra = s.options.hint && halfAxes
      ? ` The ellipse has half-axes ${round(halfAxes[0])} and ${round(halfAxes[1])}.`
      : "";
    return `Circle L through O, A and B has radius ${round(s.circle.radius)}. ` +
      `C is at (${round(s.C.x)}, ${round(s.C.y)}).${extra}`;
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, TRACE_LIMIT: TRACE_LIMIT,
    start: start,
    moveA: moveA, moveB: moveB, moveC: moveC,
    moveX: moveX, moveY: moveY, moveO: moveO,
    setOption: setOption, snapshot: snapshot, describe: describe,
    // Geometry, exposed so that the check can test the page's claims.
    dist: dist, dot: dot, sub: sub, add: add, mul: mul, lerp: lerp,
    nearestPoint: nearestPoint, lineParameter: lineParameter,
    orientation: orientation, signedAngle: signedAngle,
    intersectLines: intersectLines, circumcenter: circumcenter,
    circleThrough: circleThrough, lineCircle: lineCircle, rotate: rotate,
    upgradeAngles: upgradeAngles, upgradePFromAngles: upgradePFromAngles,
    withConstruction: withConstruction,
  };
})();
