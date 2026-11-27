"use strict";

/*
 * Circle of Similitude 1 — the second, richer construction on Bogomolny's
 * CircleOfSimilitude1 applet (the "Properties of the Circle of Similitude" page).
 *
 * Two circles (O1,r1) and (O2,r2) have an internal centre of similarity P and
 * an external one Q, where the common internal and external tangents meet.
 * The circle (CS) on PQ as diameter is the Apollonian circle for O1,O2 with
 * ratio r1/r2. The page proves four statements about it: (CS) is orthogonal to
 * the circle on O1O2 as diameter; TP bisects the angle between paired tangent
 * points from any point T on (CS); those paired points are equally far from the
 * radical axis; and the two chord segments L1K1, L2K2 are equal (equivalently
 * the tangential lengths t(L1,c2), t(L2,c1) are equal).
 *
 * This is the geometry and nothing else: no document, no window, no storage.
 * It defines one global, CircleOfSimilitude1Core, so the page loads it with a
 * plain <script> and porting/check-circle-of-similitude-1.mjs loads it in Node.
 * Positions are plain objects in the SVG's viewBox units; every function
 * returns a new value and leaves the one it was given alone.
 */
const CircleOfSimilitude1Core = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 10;
  const EPS = 1e-9;

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
  const closePoint = (p, q, tol) =>
    Boolean(p) && Boolean(q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);

  function clampPoint(p) {
    return point(
      clamp(p.x, VIEW.x + PAD, VIEW.x + VIEW.width - PAD),
      clamp(p.y, VIEW.y + PAD, VIEW.y + VIEW.height - PAD),
    );
  }

  /** Angle at v between the rays v->p and v->q, in [0, PI]. */
  function angle(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (!(n > EPS)) return NaN;
    return Math.acos(clamp(dot(a, b) / n, -1, 1));
  }

  /** Foot of the perpendicular from p to the line through a and b. */
  function foot(p, a, b) {
    const d = sub(b, a), l2 = dot(d, d);
    if (l2 < EPS) return point(a.x, a.y);
    return add(a, mul(d, dot(sub(p, a), d) / l2));
  }

  /** Sign used by GeoSDoub.FindOrientation(a,b,c): +1 for a left turn. */
  function orientation(a, b, c) {
    return cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1;
  }

  /** Intersection(s) of the infinite line a->b with the circle (c,r). */
  function lineCircle(a, b, c, r) {
    const d = sub(b, a), l2 = dot(d, d);
    if (l2 < EPS) return [];
    const t0 = dot(sub(c, a), d) / l2;
    const h = sub(add(a, mul(d, t0)), c);
    const h2 = dot(h, h);
    if (h2 - r * r > EPS) return [];
    const k = Math.sqrt(Math.max(0, r * r - h2)) / Math.sqrt(l2);
    return [add(a, mul(d, t0 - k)), add(a, mul(d, t0 + k))];
  }

  /** 0, 1 or 2 points where two circles meet. */
  function circleIntersection(c1, r1, c2, r2) {
    const dvec = sub(c2, c1), d = Math.hypot(dvec.x, dvec.y);
    if (!(d > EPS) || d > r1 + r2 + EPS || d < Math.abs(r1 - r2) - EPS) return [];
    const u = mul(dvec, 1 / d);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const base = add(c1, mul(u, a));
    const n = point(-u.y * h, u.x * h);
    return h < EPS ? [base] : [sub(base, n), add(base, n)];
  }

  /**
   * The two contacts of the tangents from T to the circle (c,r), in the order
   * GeoSDoub.Intersect gives them: first the point with the larger y (or, for
   * a vertical secant, the larger x).
   */
  function tangentContacts(c, r, T) {
    const v = sub(T, c), d = Math.hypot(v.x, v.y);
    if (!(d > r + EPS)) return null;
    const u = mul(v, 1 / d);
    const base = add(c, mul(u, (r * r) / d));
    const h = (r * Math.sqrt(d * d - r * r)) / d;
    const n = point(-u.y * h, u.x * h);
    const p = sub(base, n), q = add(base, n);
    if (Math.abs(c.x - T.x) > 1e-7) return p.y >= q.y ? [p, q] : [q, p];
    if (Math.abs(c.y - T.y) > 1e-7) return p.x >= q.x ? [p, q] : [q, p];
    return [p, q];
  }

  /** The applet's Order(): make FindOrientation(L[0], L[1], T) positive. */
  function orderedContacts(T, c, r) {
    const p = tangentContacts(c, r, T);
    if (!p) return null;
    return orientation(p[0], p[1], T) < 0 ? [p[1], p[0]] : p;
  }

  /** The position CircleOfSimilitude1Canvas.init starts from, at 400x300.
   *  The applet gives both circles the same radius (width/20), which puts the
   *  external centre at infinity. The page describes circles of *different*
   *  radii, so this port starts with the second radius = width/8: the whole
   *  four-statement construction is then visible from the first frame. */
  function start(options) {
    const o = options || {};
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const off = VIEW.width / 5;
    const O1 = point(cx - off, cy);
    const R1 = point(O1.x - VIEW.width / 20, O1.y);
    const O2 = point(cx + off, cy);
    const R2 = point(O2.x + (o.appletRadii ? VIEW.width / 20 : VIEW.width / 8), O2.y);
    const options0 = {
      names: o.names === undefined ? true : !!o.names,
      hint: !!o.hint,
      s1: !!o.s1, s2: !!o.s2, s3: !!o.s3, s4: !!o.s4,
      one: o.one === undefined ? true : !!o.one,
    };
    let s = {
      O1: O1, R1: R1, O2: O2, R2: R2, T: point(cx, cy),
      options: options0, explored: false,
    };
    const g = geometry(s);
    if (g && g.cs && !g.cs.infinite) {
      const c = g.cs.center, r = g.cs.radius;
      s.T = point(c.x - r * Math.cos(Math.PI / 3), c.y - r * Math.sin(Math.PI / 3));
    }
    return s;
  }

  function reset(state) {
    const s = start(Object.assign({}, state.options, { appletRadii: false }));
    s.explored = state.explored;
    return s;
  }

  function circles(s) {
    return {
      c1: { center: s.O1, r: dist(s.O1, s.R1) },
      c2: { center: s.O2, r: dist(s.O2, s.R2) },
    };
  }

  const legalMoves = () => ["O1", "R1", "O2", "R2", "T"];
  const result = () => null; // an illustration: it is never won or lost

  /** External homothety centre Q; null when the radii are equal. */
  function externalCenter(s) {
    const { c1, c2 } = circles(s);
    if (Math.abs(c2.r - c1.r) < EPS) return null;
    return mul(add(mul(c1.center, c2.r), mul(c2.center, -c1.r)), 1 / (c2.r - c1.r));
  }

  /** Internal homothety centre P; null when the circles overlap. */
  function internalCenter(s) {
    const { c1, c2 } = circles(s);
    if (dist(c1.center, c2.center) <= c1.r + c2.r + EPS) return null;
    return mul(add(mul(c1.center, c2.r), mul(c2.center, c1.r)), 1 / (c1.r + c2.r));
  }

  /** The true radical axis, perpendicular to O1O2. The old applet drew a
   *  vertical line at the horizontal-centre formula even when the circles
   *  were tilted; the page defines the radical axis, so this port draws it
   *  perpendicular to the line of centres. */
  function radicalAxis(s) {
    const { c1, c2 } = circles(s);
    const v = sub(c2.center, c1.center), d = Math.hypot(v.x, v.y);
    if (!(d > EPS)) return null;
    const u = mul(v, 1 / d);
    const x = (d * d + c1.r * c1.r - c2.r * c2.r) / (2 * d);
    const base = add(c1.center, mul(u, x));
    const n = point(-u.y, u.x);
    return { point: base, n: n, a: sub(base, mul(n, 1000)), b: add(base, mul(n, 1000)) };
  }

  /** Common tangents of the two given circles, as contact-point pairs. */
  function commonTangents(s, internal) {
    const { c1, c2 } = circles(s);
    const d = dist(c1.center, c2.center);
    if (!(d > EPS)) return [];
    if (internal) {
      const pts = tangentContacts(c1.center, c1.r + c2.r, c2.center);
      if (!pts) return [];
      return pts.map((q) => {
        const v = sub(q, c1.center);
        return [add(c1.center, mul(v, c1.r / (c1.r + c2.r))),
                add(c2.center, mul(v, -c2.r / (c1.r + c2.r)))];
      });
    }
    if (Math.abs(c1.r - c2.r) < EPS) {
      const u = mul(sub(c2.center, c1.center), 1 / d), n = point(-u.y, u.x);
      return [1, -1].map((k) => {
        const off = mul(n, c1.r * k);
        return [add(c1.center, off), add(c2.center, off)];
      });
    }
    const big = c1.r >= c2.r ? c1 : c2;
    const small = c1.r >= c2.r ? c2 : c1;
    const diff = big.r - small.r;
    const pts = tangentContacts(big.center, diff, small.center);
    if (!pts) return [];
    return pts.map((q) => {
      const v = sub(q, big.center);
      return [add(big.center, mul(v, big.r / diff)),
              add(small.center, mul(v, small.r / diff))];
    });
  }

  /** GeoSDoub.CheckTwoPoints, transcribed from the applet's Compute(). */
  function checkTwoPoints(L1, L2, c1, c2) {
    const i1 = lineCircle(L1, L2, c1.center, c1.r);
    const i2 = lineCircle(L1, L2, c2.center, c2.r);
    if (i1.length < 2 || i2.length < 2) return null;
    const other = (pts, p) => (dist(pts[0], p) < dist(pts[1], p) ? pts[1] : pts[0]);
    const k1 = other(i1, L1), k2 = other(i2, L2);
    const between = (a, b, c) => dot(sub(a, b), sub(a, c)) <= 0;
    if (dist(L1, L2) < 1) return [L1, L2, L1, L2];
    if (between(L1, k1, k2) && between(L2, k1, k2)) return [k1, k2, L1, L2];
    if (between(k1, L1, L2) && between(k2, L1, L2)) return [L1, L2, k1, k2];
    return null;
  }

  function pairFor(g, one) {
    if (!g || !g.t1 || !g.t2) return null;
    const L1 = one ? g.t1[0] : g.t1[1];
    const L2 = one ? g.t2[1] : g.t2[0];
    const ss = checkTwoPoints(L1, L2, g.c1, g.c2);
    if (!ss) return null;
    // The old page's names follow the tangent contacts, which may be ss[2],ss[3].
    const firstIsL = dist(ss[0], L1) <= dist(ss[2], L1);
    const P1 = firstIsL ? ss[0] : ss[2], P2 = firstIsL ? ss[1] : ss[3];
    const K1 = firstIsL ? ss[2] : ss[0], K2 = firstIsL ? ss[3] : ss[1];
    return {
      ss: ss, P1: P1, P2: P2, K1: K1, K2: K2,
      L1: one ? P1 : P2, L2: one ? P2 : P1, // the contact on c1 then on c2
      B1: foot(g.c1.center, P1, K1), B2: foot(g.c2.center, P2, K2),
      B: foot(g.T, P1, P2),
    };
  }

  /** Everything the picture needs, recomputed from the five draggable dots. */
  function geometry(s) {
    const { c1, c2 } = circles(s);
    const d = dist(c1.center, c2.center);
    if (!(c1.r > EPS) || !(c2.r > EPS) || !(d > EPS)) {
      return { possible: false, c1: c1, c2: c2, cs: null, pairL: null, pairM: null };
    }
    const Q = externalCenter(s), P = internalCenter(s);
    const infinite = Q === null;
    let cs;
    if (infinite) {
      const m = midpoint(c1.center, c2.center);
      const n = point(-(c2.center.y - c1.center.y) / d, (c2.center.x - c1.center.x) / d);
      cs = { infinite: true, center: null, radius: null,
             line: [sub(m, mul(n, 1000)), add(m, mul(n, 1000))], midpoint: m };
    } else {
      const c = midpoint(P, Q), r = dist(P, Q) / 2;
      cs = { infinite: false, center: c, radius: r, line: null, midpoint: c };
    }
    const cm = { center: midpoint(c1.center, c2.center), radius: d / 2 };
    const rad = radicalAxis(s);
    const crossPoints = cs.infinite ? [] : circleIntersection(cs.center, cs.radius, cm.center, cm.radius);
    const E = crossPoints[0] || null, F = crossPoints[1] || null;
    const g = {
      possible: true, c1: c1, c2: c2, d: d, P: P, Q: Q, cs: cs, cm: cm,
      radical: rad, E: E, F: F, T: s.T,
      extTangents: commonTangents(s, false), intTangents: commonTangents(s, true),
      t1: null, t2: null, pairL: null, pairM: null,
    };
    if (!cs.infinite) {
      const a = tangentContacts(c1.center, c1.r, s.T);
      const b = tangentContacts(c2.center, c2.r, s.T);
      if (a && b && orientation(a[0], a[1], s.T) < 0) a.reverse();
      if (b && orientation(b[0], b[1], s.T) < 0) b.reverse();
      g.t1 = a; g.t2 = b;
      g.pairL = pairFor(g, true);
      g.pairM = pairFor(g, false);
    }
    return g;
  }

  /** Keep T on the circle of similitude (or on its limiting line). */
  function restrict(s, p) {
    const q = clampPoint(p);
    const g = geometry(s);
    if (!g.possible) return q;
    if (g.cs.infinite) return foot(q, g.cs.line[0], g.cs.line[1]);
    const c = g.cs.center, v = sub(q, c), r = Math.hypot(v.x, v.y);
    if (!(r > EPS)) return point(c.x + g.cs.radius, c.y);
    return add(c, mul(v, g.cs.radius / r));
  }

  /**
   * The old applet's four centre/radius dots are Fix(2): their y never
   * changes, so the circles stay on one horizontal line. T glides on (CS).
   */
  function withPoint(s, name, p) {
    if (legalMoves().indexOf(name) < 0) return s;
    let q;
    if (name === "T") {
      q = restrict(s, p);
    } else {
      q = clampPoint(point(p.x, s[name].y));
      const r = dist(q, s.O1);
      if (name === "R1" && (r < 8 || r > 130)) return s;
      const r2 = dist(q, s.O2);
      if (name === "R2" && (r2 < 8 || r2 > 130)) return s;
    }
    const next = Object.assign({}, s, { [name]: q, explored: true });
    if (name !== "T") next.T = restrict(next, s.T);
    return next;
  }

  function setOption(s, name, value) {
    if (!(name in s.options)) return s;
    return Object.assign({}, s, {
      options: Object.assign({}, s.options, { [name]: !!value }), explored: true,
    });
  }

  const tangentLength = (p, c, r) => Math.sqrt(Math.max(0, dist(p, c.center) ** 2 - r * r));

  /** The page's claims at the current position, with the measured numbers. */
  function claims(s) {
    const g = geometry(s);
    if (!g.possible || g.cs.infinite || !g.P || !g.Q) return null;
    const { c1, c2, cs, cm, T, P } = g;
    const ratio = c1.r / c2.r;
    const out = {
      ratio: ratio,
      distanceRatio: dist(T, c1.center) / dist(T, c2.center),
      tangentRatio: tangentLength(T, c1, c1.r) / tangentLength(T, c2, c2.r),
      orthogonalGap: dist(cs.center, cm.center) ** 2 - (cs.radius ** 2 + cm.radius ** 2),
      diameter: closePoint(cs.center, midpoint(P, g.Q), 1e-7) &&
        close(cs.radius, dist(P, g.Q) / 2, 1e-7),
      collinear: Math.abs(cross(sub(P, c1.center), sub(c2.center, c1.center))) < 1e-6 &&
        Math.abs(cross(sub(g.Q, c1.center), sub(c2.center, c1.center))) < 1e-6,
      radicalPerpendicular: g.radical
        ? Math.abs(dot(sub(g.radical.b, g.radical.a), sub(c2.center, c1.center))) < 1e-6 : false,
      Eright: g.E ? Math.abs(angle(g.E, cs.center, cm.center) - Math.PI / 2) < 1e-6 : false,
      Fright: g.F ? Math.abs(angle(g.F, cs.center, cm.center) - Math.PI / 2) < 1e-6 : false,
    };
    out.ratioOK = close(out.distanceRatio, ratio, 1e-7);
    out.tangentRatioOK = close(out.tangentRatio, ratio, 1e-7);
    out.orthogonal = close(out.orthogonalGap, 0, 1e-6);
    for (const key of ["L", "M"]) {
      const pair = key === "L" ? g.pairL : g.pairM;
      if (!pair) { out[key] = null; continue; }
      const { P1, P2, K1, K2 } = pair;
      const h1 = g.radical ? foot(P1, g.radical.a, g.radical.b) : null;
      const h2 = g.radical ? foot(P2, g.radical.a, g.radical.b) : null;
      const midFoot = h1 && h2 ? foot(midpoint(P1, P2), g.radical.a, g.radical.b) : null;
      const other = key === "L" ? g.pairM : g.pairL;
      const t21 = Math.sqrt(Math.max(0, dist(P1, c2.center) ** 2 - c2.r * c2.r));
      const t12 = Math.sqrt(Math.max(0, dist(P2, c1.center) ** 2 - c1.r * c1.r));
      // Tangents at P1 and P2, to see where they meet (the page's converse).
      const n1 = point(-(P1.y - c1.center.y), P1.x - c1.center.x);
      const n2 = point(-(P2.y - c2.center.y), P2.x - c2.center.x);
      const den = cross(n1, n2);
      // Solve P1 + a*n1 = P2 + b*n2 directly (no clever determinant helpers).
      let meetPoint = null;
      if (Math.abs(den) > EPS) {
        const q = sub(P2, P1);
        const a = (q.x * n2.y - q.y * n2.x) / den;
        meetPoint = add(P1, mul(n1, a));
      }
      out[key] = {
        bisects: close(angle(T, P1, P), angle(T, P, P2), 1e-6),
        otherBisects: other
          ? close(angle(T, other.P1, P), angle(T, P, other.P2), 1e-6) : false,
        equallyFar: h1 && h2 && close(dist(P1, h1), dist(P2, h2), 1e-6) &&
          close(dist(midpoint(P1, P2), midFoot), 0, 1e-6),
        segments: close(dist(P1, K1), dist(P2, K2), 1e-6),
        tangentLengths: close(t21, t12, 1e-6),
        converse: meetPoint ? close(dist(meetPoint, cs.center), cs.radius, 1e-6) : false,
        bisectAngleDeg: angle(T, P1, P) * 180 / Math.PI,
        otherAngleDeg: angle(T, P, P2) * 180 / Math.PI,
        distanceToAxis: h1 ? dist(P1, h1) : NaN,
        chord: dist(P1, K1),
        tangent: t21,
        B1: pair.B1, B2: pair.B2, B: pair.B,
      };
    }
    return out;
  }

  function describe(s) {
    const g = geometry(s);
    if (!g.possible) return "Move the circle centres apart to see the construction.";
    if (g.cs.infinite) return "Equal radii put P at the midpoint and Q at infinity: the circle of similitude has become the perpendicular bisector of the centres.";
    const m = claims(s);
    if (!m) return `P = (${g.P.x.toFixed(0)}, ${g.P.y.toFixed(0)}), Q = (${g.Q.x.toFixed(0)}, ${g.Q.y.toFixed(0)}). Drag T or a circle until the tangent pairs appear.`;
    return `TO1/TO2 = ${m.distanceRatio.toFixed(3)}, r1/r2 = ${m.ratio.toFixed(3)}; tangent lengths from T are in the same ratio.`;
  }

  return {
    VIEW: VIEW, PAD: PAD, EPS: EPS,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, clamp: clamp, close: close,
    angle: angle, foot: foot, orientation: orientation,
    clampPoint: clampPoint, circleIntersection: circleIntersection,
    tangentContacts: tangentContacts, orderedContacts: orderedContacts,
    lineCircle: lineCircle, checkTwoPoints: checkTwoPoints,
    start: start, reset: reset, circles: circles, legalMoves: legalMoves,
    externalCenter: externalCenter, internalCenter: internalCenter,
    radicalAxis: radicalAxis, commonTangents: commonTangents,
    geometry: geometry, restrict: restrict, pairFor: pairFor,
    withPoint: withPoint, setOption: setOption, claims: claims,
    tangentLength: tangentLength, describe: describe, result: result,
  };
})();
