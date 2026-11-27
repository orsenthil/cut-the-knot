"use strict";

/*
 * Fagnano IV, from Alexander Bogomolny's applet FagnanoIV (Izvolsky's
 * solution of Fagnano's problem).
 *
 * A, B and C are the corners of a triangle. O is its circumcenter and r its
 * circumradius. P, Q and R slide along BC, CA and AB. Joining O to P, Q, R
 * cuts ABC into three quadrilaterals; each has area at most the matching side
 * of PQR times r/2. Adding them gives the page's claim
 *
 *     perimeter(PQR) >= 2 * area(ABC) / r,
 *
 * with equality for the orthic triangle of an acute ABC (Nagel's theorem:
 * its sides are perpendicular to OA, OB, OC). The checkerboard eyes in the
 * applet open exactly when P, Q, R are within one pixel of the three altitude
 * feet. The key calculation here is analytic: line intersections give the
 * circumcenter and the altitude feet, and perpendicular projection gives the
 * little right-angle marks the applet draws from P, Q, R towards the radii.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, FagnanoIvCore, so the page loads it with
 * a plain <script> and porting/check-fagnano-iv.mjs loads it in Node. Every
 * function takes a position and returns a new one; the input is untouched.
 */
const FagnanoIvCore = (() => {
  // The applet's parameter info says 400 by 250 is optimal; the canvas used
  // those dimensions, and its opening points were k = min(W/8, H/8) with
  // A = (3k, k), B = (k, H-k), C = (W-2k, H-2k), and P, Q, R at the fractions
  // 0.3 of AB, 0.2 of CA, 0.4 of BC (DoubLine.CreateMidPoint(t)).
  const WIDTH = 400;
  const HEIGHT = 250;
  const K = Math.min(WIDTH / 8, HEIGHT / 8);
  const EPS = 1e-12;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const len = (p) => Math.hypot(p.x, p.y);
  const dist = (p, q) => len(sub(p, q));
  const sqDist = (p, q) => {
    const d = sub(p, q);
    return dot(d, d);
  };
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** GeoSDoub.Intersect: line(a,b) with line(c,d); NaN for near-parallel. */
  function intersect(a, b, c, d) {
    const a1 = b.y - a.y, b1 = a.x - b.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = d.y - c.y, b2 = c.x - d.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
  }

  /** GeoSDoub.FindAltitude(p,a,b): the foot of the perpendicular to line ab. */
  function altitudeFoot(p, a, b) {
    const q = { x: p.x + (b.y - a.y), y: p.y - (b.x - a.x) };
    return intersect(p, q, a, b);
  }

  /** GeoSDoub.FindCircumcenter, as the intersection of two perpendicular bisectors. */
  function circumcenter(A, B, C) {
    const m1 = mul(add(A, B), 0.5);
    const m2 = mul(add(B, C), 0.5);
    const p1 = { x: m1.x + (B.y - A.y), y: m1.y - (B.x - A.x) };
    const p2 = { x: m2.x + (C.y - B.y), y: m2.y - (C.x - B.x) };
    return intersect(m1, p1, m2, p2);
  }

  /**
   * GeoSDoub.NearestPoint(p, a, b): perpendicular projection of p onto the
   * line a->b, with the applet's 0.1 early exit when p is already at a.
   */
  function nearestPoint(p, a, b) {
    if (sqDist(a, p) < 0.1) return p;
    const d = sub(b, a);
    const n = dot(d, d);
    if (n < EPS) return a;
    return add(a, mul(d, dot(sub(p, a), d) / n));
  }

  /** DoubLine.CreateMidPoint(t): t*m1 + (1-t)*m2. */
  const along = (t, m1, m2) => add(mul(m1, t), mul(m2, 1 - t));

  /** DoubLine.UpdateMidPoint: the parameter of q on the segment m1--m2. */
  function parameter(m1, m2, q) {
    const d = sub(m1, m2);
    const n = dot(d, d);
    if (n < EPS) return 0;
    return clamp(dot(d, sub(q, m2)) / n, 0, 1);
  }

  /** The position a new illustration starts from. */
  function start(options) {
    const s = {
      A: { x: 3 * K, y: K },
      B: { x: K, y: HEIGHT - K },
      C: { x: WIDTH - 2 * K, y: HEIGHT - 2 * K },
      tP: 0.4, // P on BC: line m_1=B, m_2=C
      tQ: 0.2, // Q on CA: line m_1=C, m_2=A
      tR: 0.3, // R on AB: line m_1=A, m_2=B
      showNames: true, // the applet's ShowNames parameter is "1"
      showHint: false, // the hint checkbox starts unchecked
    };
    return options ? Object.assign(s, sanitise(s, options)) : s;
  }

  function sanitise(s, options) {
    const out = {};
    for (const name of ["A", "B", "C"]) {
      if (options[name] && finite(options[name])) out[name] = { ...options[name] };
    }
    for (const name of ["tP", "tQ", "tR"]) {
      if (typeof options[name] === "number" && Number.isFinite(options[name])) {
        out[name] = clamp(options[name], 0, 1);
      }
    }
    if (typeof options.showNames === "boolean") out.showNames = options.showNames;
    if (typeof options.showHint === "boolean") out.showHint = options.showHint;
    return out;
  }

  /**
   * Every point and number the applet's Compute() and Draw() use, derived
   * from a position. P, Q and R are kept on their sides exactly as the
   * applet's DoubLine checkpoints do, so only the three t values are stored.
   */
  function compute(s) {
    const A = s.A, B = s.B, C = s.C;
    const P = along(s.tP, B, C);
    const Q = along(s.tQ, C, A);
    const R = along(s.tR, A, B);
    const O = circumcenter(A, B, C);
    // GetCircumcircle uses the average of the three centre-to-vertex
    // distances, not just one of them.
    const r = finite(O) ? (dist(O, A) + dist(O, B) + dist(O, C)) / 3 : NaN;
    const Ha = altitudeFoot(A, B, C);
    const Hb = altitudeFoot(B, C, A);
    const Hc = altitudeFoot(C, A, B);

    // The six little perpendiculars to the radii drawn from P, Q, R.
    const normals = [
      [nearestPoint(P, O, B), nearestPoint(P, O, C)],
      [nearestPoint(Q, O, C), nearestPoint(Q, O, A)],
      [nearestPoint(R, O, A), nearestPoint(R, O, B)],
    ];

    const area = Math.abs(cross(sub(B, A), sub(C, A))) / 2;
    const perimeter = dist(P, Q) + dist(Q, R) + dist(R, P);
    const bound = Number.isFinite(r) && r > 0 ? 2 * area / r : NaN;
    const ratio = Number.isFinite(bound) && bound > 0 ? perimeter / bound : NaN;
    const eyesOpen = finite(Ha) && finite(Hb) && finite(Hc) &&
      dist(Ha, P) < 1 && dist(Hb, Q) < 1 && dist(Hc, R) < 1;
    return {
      A, B, C, P, Q, R, O, r, Ha, Hb, Hc, normals,
      area, perimeter, bound, ratio, eyesOpen,
      orthicParams: {
        tP: finite(Ha) ? parameter(B, C, Ha) : NaN,
        tQ: finite(Hb) ? parameter(C, A, Hb) : NaN,
        tR: finite(Hc) ? parameter(A, B, Hc) : NaN,
      },
    };
  }

  /** True when all three altitude feet lie on the sides of ABC. */
  function acute(s) {
    const f = compute(s);
    const p = f.orthicParams;
    return Number.isFinite(p.tP) && Number.isFinite(p.tQ) && Number.isFinite(p.tR) &&
      p.tP > 0 && p.tP < 1 && p.tQ > 0 && p.tQ < 1 && p.tR > 0 && p.tR < 1;
  }

  /** The state with P, Q, R on the three altitude feet (clamped to the sides). */
  function orthicState(s) {
    const p = compute(s).orthicParams;
    return Object.assign({}, s, {
      tP: Number.isFinite(p.tP) ? p.tP : s.tP,
      tQ: Number.isFinite(p.tQ) ? p.tQ : s.tQ,
      tR: Number.isFinite(p.tR) ? p.tR : s.tR,
    });
  }

  /**
   * PointIsEligible(x,y) from the applet's mouseDrag: strictly inside the
   * 400x250 canvas, two pixels in from the left and top, two up from the
   * bottom. Handles are kept there so the keyboard and the pointer agree.
   */
  function clampPoint(s, name, q) {
    if (!finite(q)) return s[name];
    if (name === "A" || name === "B" || name === "C") {
      return {
        x: clamp(q.x, 2 + 1e-9, WIDTH - 1e-9),
        y: clamp(q.y, 1e-9, HEIGHT - 2 - 1e-9),
      };
    }
    if (name === "P") return along(parameter(s.B, s.C, q), s.B, s.C);
    if (name === "Q") return along(parameter(s.C, s.A, q), s.C, s.A);
    if (name === "R") return along(parameter(s.A, s.B, q), s.A, s.B);
    return s[name];
  }

  /**
   * Move one named point. The three outer points move freely; each point on
   * a side keeps its parameter when a vertex moves (CheckMidPoint), and is
   * projected back onto that side when dragged (UpdateMidPoint).
   */
  function move(s, name, q) {
    if (!["A", "B", "C", "P", "Q", "R"].includes(name)) return s;
    if (["A", "B", "C"].includes(name)) {
      const next = Object.assign({}, s, { [name]: clampPoint(s, name, q) });
      // The applet's CheckMidPoint updates the two lines through a moved
      // vertex. Here the side points are parameters, so they follow for free.
      return next;
    }
    const p = clampPoint(s, name, q);
    const key = { P: "tP", Q: "tQ", R: "tR" }[name];
    const end = { P: [s.B, s.C], Q: [s.C, s.A], R: [s.A, s.B] }[name];
    return Object.assign({}, s, { [key]: parameter(end[0], end[1], p) });
  }

  /** One of the applet's two checkboxes. */
  function option(s, name, value) {
    if (name !== "showNames" && name !== "showHint") return s;
    return Object.assign({}, s, { [name]: !!value });
  }

  /** The status line: what the eyes and the perimeter bound are saying. */
  function describe(s, f) {
    const n = (v) => Number.isFinite(v) ? v.toFixed(1) : "?";
    if (!Number.isFinite(f.ratio)) {
      return "Move the corners apart to make a triangle: the circle and the bound are not defined yet.";
    }
    if (f.eyesOpen) {
      return `All three eyes are open: PQR is the orthic triangle. Perimeter ${n(f.perimeter)}, bound 2 x area / r = ${n(f.bound)}.`;
    }
    return `The eyes are winking: PQR is not the orthic triangle. Perimeter ${n(f.perimeter)}, bound 2 x area / r = ${n(f.bound)}.`;
  }

  /** An illustration has no ending, so there is no win, loss or done state. */
  function result(s) {
    return null;
  }

  return {
    WIDTH, HEIGHT, K, EPS,
    add, sub, mul, dot, cross, len, dist, sqDist, finite, clamp,
    intersect, altitudeFoot, circumcenter, nearestPoint, along, parameter,
    start, compute, acute, orthicState, clampPoint, move, option, describe, result,
  };
})();
