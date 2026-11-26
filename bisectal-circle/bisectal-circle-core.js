"use strict";

/*
 * Bisectal Circle — the illustration behind Bogomolny's applet BisectalCircle.
 *
 * Drag the centres and radius dots of two circles (O1) and (O2). The circles
 * have an external centre of homothety Q, and the circle (Q) centred there with
 * radius sqrt((dist(Q,O1) - r1)(dist(Q,O2) + r2)) is the "bisectal circle": it
 * is the circle of inversion that swaps the two given circles. A third dot T is
 * the centre of a circle drawn orthogonal to (Q); that circle cuts (O1) and
 * (O2) at equal angles — the two circles are isogonal.
 *
 * The one idea the code relies on is homothety. If Q divides O1 O2 externally
 * in the ratio r1 : r2 then Q = (r2 O1 - r1 O2)/(r2 - r1), and the inversion in
 * the circle centred at Q with radius rho above maps (O1) exactly onto (O2).
 * Equal radii make Q a point at infinity and (Q) a straight line; the applet
 * leaves that case blank, while the page says plainly that Q is infinite there.
 * This port draws the limiting line, the perpendicular bisector of O1 O2.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BisectalCircleCore, so the page loads it with a plain
 * <script> and porting/check-bisectal-circle.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const BisectalCircleCore = (() => {
  const EPS = 1e-9;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const mul = (p, t) => ({ x: p.x * t, y: p.y * t });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
  const closePoint = (p, q, tol) =>
    Boolean(p) && Boolean(q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);

  /** The position a new diagram starts from, laid out as in BisectalCircleCanvas.init. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const cx = width / 2, cy = height / 2, off = width / 5, dr = width / 20;
    return {
      O1: { x: cx - off, y: cy },
      R1: { x: cx - off - dr, y: cy },
      O2: { x: cx + off, y: cy },
      R2: { x: cx + off + dr, y: cy },
      T: { x: cx, y: cy },
    };
  }

  /** A circle is a centre plus a point on it, exactly as the applet stores it. */
  function circles(s) {
    return {
      c1: { center: s.O1, r: dist(s.O1, s.R1) },
      c2: { center: s.O2, r: dist(s.O2, s.R2) },
    };
  }

  /** External tangents exist unless one circle is inside the other. */
  function isPossible(s) {
    const { c1, c2 } = circles(s);
    const d = dist(c1.center, c2.center);
    return c1.r > EPS && c2.r > EPS && d > Math.abs(c1.r - c2.r) + EPS;
  }

  /** Internal tangents exist only for disjoint circles. */
  function hasInternal(s) {
    const { c1, c2 } = circles(s);
    return dist(c1.center, c2.center) > c1.r + c2.r + EPS;
  }

  /** External homothety centre: null when the two radii are equal (at infinity). */
  function externalCenter(s) {
    const { c1, c2 } = circles(s);
    if (Math.abs(c2.r - c1.r) < EPS) return null;
    return mul(add(mul(c1.center, c2.r), mul(c2.center, -c1.r)), 1 / (c2.r - c1.r));
  }

  /** Internal homothety centre; null when the circles overlap. */
  function internalCenter(s) {
    if (!hasInternal(s)) return null;
    const { c1, c2 } = circles(s);
    return mul(add(mul(c1.center, c2.r), mul(c2.center, c1.r)), 1 / (c1.r + c2.r));
  }

  /**
   * The bisectal circle. Its radius is the applet's own Compute() formula,
   * sqrt((dist(Q,C1) - r1)(dist(Q,C2) + r2)) — the power of the inversion that
   * maps (O1) onto (O2). For equal radii Q is infinite: the limiting circle is
   * the perpendicular bisector of O1 O2, returned as a line through two points.
   */
  function bisectal(s, kind) {
    if (!isPossible(s)) return null;
    const { c1, c2 } = circles(s);
    const external = kind !== "internal";
    const center = external ? externalCenter(s) : internalCenter(s);
    if (!center) {
      if (!external) return null;
      const a = c1.center, b = c2.center;
      const m = mul(add(a, b), 0.5);
      const d = dist(a, b);
      const n = { x: -(b.y - a.y) / d, y: (b.x - a.x) / d };
      return {
        kind: "external", center: null, radius: null, infinite: true,
        power: Infinity, line: [add(m, mul(n, 1000)), add(m, mul(n, -1000))],
        midpoint: m,
      };
    }
    const power = (dist(center, c1.center) - c1.r) * (dist(center, c2.center) + c2.r);
    return {
      kind: external ? "external" : "internal",
      center, radius: power >= 0 ? Math.sqrt(power) : null,
      infinite: false, power, line: null,
      midpoint: mul(add(c1.center, c2.center), 0.5),
    };
  }

  /**
   * The two common tangents of the given circles, as two clipped-by-the-page
   * segments each. They pass through the relevant homothety centre; when Q is
   * infinite (equal radii) they are the two parallel lines a radius away from
   * the line of centres. These are the guide lines behind the Hint checkbox.
   */
  function tangentLines(s, kind) {
    if (!isPossible(s)) return [];
    const { c1, c2 } = circles(s);
    const center = kind === "internal" ? internalCenter(s) : externalCenter(s);
    const asSegment = (a, b) => [a, b];
    if (kind === "internal" && !center) return [];
    if (!center) {
      const u = mul(sub(c2.center, c1.center), 1 / dist(c1.center, c2.center));
      const n = { x: -u.y, y: u.x };
      return [1, -1].map((side) => {
        const p = add(c1.center, mul(n, c1.r * side));
        return asSegment(add(p, mul(u, -1000)), add(p, mul(u, 1000)));
      });
    }
    const d1 = dist(center, c1.center);
    if (d1 <= c1.r) return [];
    const alpha = Math.asin(Math.max(-1, Math.min(1, c1.r / d1)));
    const base = Math.atan2(c1.center.y - center.y, c1.center.x - center.x);
    return [base - alpha, base + alpha].map((angle) => {
      const dir = { x: Math.cos(angle), y: Math.sin(angle) };
      return asSegment(add(center, mul(dir, -1000)), add(center, mul(dir, 1000)));
    });
  }

  /** Inversion in a circle: p -> centre + radius^2 (p - centre)/|p - centre|^2. */
  function invert(center, radius, p) {
    const v = sub(p, center), d2 = dot(v, v);
    if (d2 < EPS) return null;
    return add(center, mul(v, (radius * radius) / d2));
  }

  /** Inversion sends a circle not through the centre to another circle. */
  function invertCircle(center, radius, circle) {
    const v = sub(circle.center, center), d2 = dot(v, v) - circle.r * circle.r;
    if (Math.abs(d2) < EPS) return null;
    const k = (radius * radius) / d2;
    return { center: add(center, mul(v, k)), radius: Math.abs(k) * circle.r };
  }

  /** Reflection of p in the infinite line through a and b. */
  function reflect(a, b, p) {
    const v = sub(b, a), t = dot(sub(p, a), v) / dot(v, v);
    return add(add(mul(a, 2), mul(v, 2 * t)), mul(p, -1));
  }

  /** 0, 1 or 2 intersection points of two circles, sorted left to right. */
  function intersections(A, B) {
    const d = dist(A.center, B.center);
    if (d < EPS || d > A.r + B.r || d < Math.abs(A.r - B.r)) return [];
    const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d);
    const h2 = A.r * A.r - a * a;
    if (h2 < -EPS) return [];
    const h = Math.sqrt(Math.max(0, h2));
    const u = mul(sub(B.center, A.center), 1 / d);
    const base = add(A.center, mul(u, a));
    const pts = [
      { x: base.x - u.y * h, y: base.y + u.x * h },
      { x: base.x + u.y * h, y: base.y - u.x * h },
    ];
    return pts.sort((p, q) => p.x - q.x);
  }

  /** The (acute) angle at which two circles cross at p. */
  function crossAngle(p, A, B) {
    const u = sub(p, A.center), v = sub(p, B.center);
    const n = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    if (n < EPS) return NaN;
    const a = Math.acos(Math.max(-1, Math.min(1, dot(u, v) / n)));
    return Math.min(a, Math.PI - a);
  }

  /**
   * The circle centred at T orthogonal to the bisectal circle: its radius is
   * the tangent length sqrt(dist(T, BC)^2 - BC.r^2), which is also how
   * Compute() builds CT (external tangents from the point-circle at T).
   */
  function testCircle(s, kind) {
    const bc = bisectal(s, kind);
    if (!bc || bc.infinite || bc.radius === null) return null;
    const d2 = dist(s.T, bc.center) ** 2;
    if (d2 <= bc.radius * bc.radius + EPS) return null;
    return { center: s.T, r: Math.sqrt(d2 - bc.radius * bc.radius) };
  }

  /** Everything the page needs to draw and describe the current diagram. */
  function measurements(s, kind) {
    const mode = kind === "internal" ? "internal" : "external";
    const { c1, c2 } = circles(s);
    const bc = bisectal(s, mode);
    const test = bc ? testCircle(s, mode) : null;
    const p1 = test ? intersections(c1, test) : [];
    const p2 = test ? intersections(c2, test) : [];
    let pair = null;
    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        const a = crossAngle(p1[i], c1, test), b = crossAngle(p2[j], c2, test);
        const diff = Math.abs(a - b);
        const inv = bc && !bc.infinite && mode === "external"
          ? invert(bc.center, bc.radius, p1[i]) : null;
        const invErr = inv && p2[j] ? dist(inv, p2[j]) : Infinity;
        // For the external circle the antihomologous pair is the one inversion
        // sends from one circle to the other; all four pairs have equal angles.
        const score = mode === "external" ? invErr : diff;
        if (!pair || score < pair.score - 1e-12) {
          pair = { i, j, a, b, diff, invErr, score, p: p1[i], q: p2[j] };
        }
      }
    }
    return {
      mode, c1, c2, bisectal: bc, test, p1, p2, pair,
      possible: isPossible(s),
      angle1: pair ? pair.a : null, angle2: pair ? pair.b : null,
    };
  }

  /** Each claim the article makes, checked numerically at this diagram. */
  function claims(s, kind) {
    const m = measurements(s, kind);
    if (!m.possible) return { possible: false };
    const scale = Math.max(m.c1.r, m.c2.r, dist(m.c1.center, m.c2.center), 1);
    const tol = 1e-7 * scale;
    const bc = m.bisectal;
    if (bc.infinite) {
      const reflected = reflect(bc.line[0], bc.line[1], m.c1.center);
      return {
        possible: true,
        radiiEqual: Math.abs(m.c1.r - m.c2.r) <= tol,
        midpointOnLine: close(
          cross(sub(bc.midpoint, bc.line[0]), sub(bc.line[1], bc.line[0])), 0, tol),
        mirrorSwaps: closePoint(reflected, m.c2.center, tol) && Math.abs(m.c1.r - m.c2.r) <= tol,
      };
    }
    const out = {
      possible: true,
      homothetyCollinear: close(cross(sub(bc.center, m.c1.center), sub(m.c2.center, m.c1.center)), 0, tol),
      homothetyRatio: close(dist(bc.center, m.c1.center) * m.c2.r,
        dist(bc.center, m.c2.center) * m.c1.r, tol * scale),
      powerFormula: close(bc.radius * bc.radius,
        (dist(bc.center, m.c1.center) - m.c1.r) * (dist(bc.center, m.c2.center) + m.c2.r), tol * scale),
    };
    if (m.mode === "external" && bc.center && bc.radius !== null) {
      const swapped = invertCircle(bc.center, bc.radius, m.c1);
      out.inversionSwaps = Boolean(swapped) &&
        closePoint(swapped.center, m.c2.center, tol) && close(swapped.radius, m.c2.r, tol);
    }
    if (m.test) {
      out.orthogonal = close(
        dist(m.test.center, bc.center) ** 2 - m.test.r ** 2, bc.radius ** 2, tol * scale);
    }
    if (m.pair && m.mode === "external") {
      out.equalAngles = m.pair.diff <= 1e-7;
      out.antihomologous = m.pair.invErr <= tol;
    }
    return out;
  }

  /** A new position with one named point moved. */
  function withPoint(s, name, p) {
    const next = {};
    for (const k in s) next[k] = { ...s[k] };
    if (next[name]) next[name] = { x: p.x, y: p.y };
    return next;
  }

  function legalMoves(/* state */) {
    return ["O1", "R1", "O2", "R2", "T"];
  }

  function move(s, name, p) {
    return withPoint(s, name, p);
  }

  /** Nothing can be won or lost in an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, start, circles, isPossible, hasInternal, externalCenter, internalCenter,
    bisectal, tangentLines, invert, invertCircle, reflect, intersections, crossAngle,
    testCircle, measurements, claims, withPoint, legalMoves, move, result,
    dist, sub, add, mul, dot, cross, close, closePoint,
  };
})();
