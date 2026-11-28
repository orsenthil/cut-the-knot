"use strict";

/*
 * JLAyme — Alexander Bogomolny's illustration of Y. Sawayama's Lemma.
 *
 * Drag A, B, C and D. B, C and D stay on one line (the applet keeps their
 * y coordinates equal), and AD is the line through A and D. For each position
 * there is one circle C1 tangent to AD at F, to CD at E and internally tangent
 * to the circumcircle C2 of ABC at K, centred at P. The page claims that the
 * chord EF passes through the incenter I of ABC.
 *
 * The one idea the code relies on: the centre of C1 is on the internal angle
 * bisector at D of angle ADC, so P = D + t·u for a known unit vector u. Its
 * radius is t·sin(halfAngle), and tangency to the circumcircle turns into one
 * quadratic in t:
 *
 *   cos²(half)·t² + 2·((D−O)·u + R·sin(half))·t + (|D−O|² − R²) = 0.
 *
 * The larger root is the applet's GetTouchyCircle. Everything else (the two
 * intersections M, N of KE, KF with the circumcircle, J = AM ∩ EF, the four
 * auxiliary circles) follows Compute() in JLAymeCanvas.
 *
 * No document, no window, no storage: one global, plain-data positions, and
 * functions that never change the object they are given.
 */
const JlAymeCore = (() => {
  const EPS = 1e-10;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const unit = (p) => {
    const n = Math.hypot(p.x, p.y);
    return n < EPS ? null : { x: p.x / n, y: p.y / n };
  };
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const circle = (center, radius) =>
    finite(center) && Number.isFinite(radius) && radius >= 0 ? { center, radius } : null;

  /** Perpendicular foot of p on the infinite line through a and b. */
  function foot(p, a, b) {
    if (sqDist(a, p) < 0.1) return { ...p }; // GeoSDoub.NearestPoint's quirk
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 < EPS) return { ...a };
    return add(a, scale(d, dot(sub(p, a), d) / len2));
  }

  /** Perpendicular distance from p to the infinite line through a and b. */
  function distToLine(p, a, b) {
    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    return len < EPS ? Infinity : Math.abs(cross(d, sub(p, a))) / len;
  }

  /** GeoSDoub.Intersect of two infinite lines; null when nearly parallel. */
  function intersection(a, b, c, d) {
    const x1 = a.y - b.y, y1 = b.x - a.x;
    const x2 = c.y - d.y, y2 = d.x - c.x;
    const c1 = a.x * b.y - a.y * b.x;
    const c2 = c.x * d.y - c.y * d.x;
    const det = x1 * y2 - x2 * y1;
    if (Math.abs(det) < 1) return null;
    return { x: (y1 * c2 - y2 * c1) / det, y: (c1 * x2 - c2 * x1) / det };
  }

  /** GeoSDoub.Intersect(circle, line), in the applet's own point order. */
  function circleLine(circ, a, b) {
    if (!circ) return null;
    const O = circ.center, R = circ.radius;
    const dy = a.y - b.y, dx = a.x - b.x;
    if (Math.abs(dy) > 1) {
      // y is the independent variable: x = m·y + q.
      const m = dx / dy, q = b.x - m * b.y;
      const A = m * m + 1;
      const B = m * (q - O.x) - O.y;
      const C = O.y * O.y + (q - O.x) ** 2 - R * R;
      const disc = B * B - A * C;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const y1 = (-B + s) / A, y2 = (-B - s) / A;
      return [{ x: m * y1 + q, y: y1 }, { x: m * y2 + q, y: y2 }];
    }
    if (Math.abs(dx) > 1) {
      // x is the independent variable: y = m·x + q.
      const m = dy / dx, q = b.y - m * b.x;
      const A = m * m + 1;
      const B = m * (q - O.y) - O.x;
      const C = O.x * O.x + (q - O.y) ** 2 - R * R;
      const disc = B * B - A * C;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const x1 = (-B + s) / A, x2 = (-B - s) / A;
      return [{ x: x1, y: m * x1 + q }, { x: x2, y: m * x2 + q }];
    }
    return null;
  }

  /** JLAymeCanvas.Other: keep the second hit unless the first is at K. */
  function other(points, K) {
    if (!points || !points.length) return null;
    return dist(points[0], K) < 1 ? points[1] : points[0];
  }

  function circumcircle(A, B, C) {
    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    if (Math.abs(d) < EPS) return null;
    const aa = A.x * A.x + A.y * A.y;
    const bb = B.x * B.x + B.y * B.y;
    const cc = C.x * C.x + C.y * C.y;
    const O = {
      x: (aa * (B.y - C.y) + bb * (C.y - A.y) + cc * (A.y - B.y)) / d,
      y: (aa * (C.x - B.x) + bb * (A.x - C.x) + cc * (B.x - A.x)) / d,
    };
    if (!finite(O)) return null;
    // GetCircumcircle averages the three distances; they agree when exact.
    return circle(O, (dist(O, A) + dist(O, B) + dist(O, C)) / 3);
  }

  function incenter(A, B, C) {
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const sum = a + b + c;
    if (sum < EPS) return null;
    return {
      x: (a * A.x + b * B.x + c * C.x) / sum,
      y: (a * A.y + b * B.y + c * C.y) / sum,
    };
  }

  function incircle(A, B, C) {
    const I = incenter(A, B, C);
    if (!finite(I)) return null;
    return circle(I, (distToLine(I, A, B) + distToLine(I, B, C) + distToLine(I, C, A)) / 3);
  }

  /**
   * The circle tangent to AD and CD and internally tangent to the
   * circumcircle — JLAymeCanvas.GetTouchyCircle(D, A, C, Circumcircle).
   */
  function touchCircle(D, A, C, circ) {
    if (!circ || !finite(D) || !finite(A) || !finite(C)) return null;
    const v1 = unit(sub(A, D)), v2 = unit(sub(C, D));
    if (!v1 || !v2) return null;
    const u = unit(add(v1, v2)); // the internal bisector of angle ADC
    if (!u) return null;
    const half = Math.acos(Math.max(-1, Math.min(1,
      dot(sub(A, D), sub(C, D)) / (dist(A, D) * dist(C, D))))) / 2;
    const cos = Math.cos(half), sin = Math.sin(half);
    const W = sub(D, circ.center);
    const b = dot(W, u) + circ.radius * sin;
    const c = dot(W, W) - circ.radius * circ.radius;
    const a = cos * cos;
    const disc = b * b - a * c;
    if (disc < 0 || Math.abs(a) < EPS) return null;
    const t = (-b + Math.sqrt(disc)) / a;
    if (!Number.isFinite(t) || t <= 0) return null;
    const P = add(D, scale(u, t));
    return circle(P, distToLine(P, D, A));
  }

  /** ExtendLine(t, p, q) = q + t·(p − q), as in the applet. */
  function extendLine(t, p, q) {
    return add(q, scale(sub(p, q), t));
  }

  /** Everything the drawing needs, as plain data. */
  function figure(state) {
    const { A, B, C, D } = state;
    if (![A, B, C, D].every(finite)) {
      return { valid: false, reason: "Move the points onto the board." };
    }
    const circum = circumcircle(A, B, C);
    const circleP = touchCircle(D, A, C, circum);
    const ci = incircle(A, B, C);
    if (!circum || !circleP || !ci) {
      return { valid: false, reason: "Move the points apart: the tangent circle needs room." };
    }
    const P = circleP.center, I = ci.center;
    const E = foot(P, B, C);      // contact with CD
    const F = foot(P, A, D);      // contact with AD
    const t = circleP.radius / (circleP.radius - circum.radius);
    const K = extendLine(t, circum.center, P); // homothety centre of C1 and C2
    const M = other(circleLine(circum, K, E), K);
    const N = other(circleLine(circum, K, F), K);
    const J = intersection(A, M, E, F);
    const valid = [E, F, K, M, N, J].every(finite);
    return {
      valid,
      circumcircle: circum,
      circleP,
      incircle: ci,
      I, E, F, K, M, N, J,
      AKF: circumcircle(A, K, F),
      EIK: circumcircle(E, K, I),
      BKE: circumcircle(B, K, E),
      circleM: M ? circle(M, dist(M, B)) : null,
      reason: valid ? "" : "Move the points apart: the tangent circle needs room.",
    };
  }

  /** The position a new illustration starts from (400×300 in the applet). */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: { ...o.points.A }, B: { ...o.points.B },
        C: { ...o.points.C }, D: { ...o.points.D },
        showNames: o.showNames !== false,
        showStatement: !!o.showStatement,
        step1: !!o.step1, step2: !!o.step2,
        step3: !!o.step3, step4: !!o.step4,
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const u = Math.min(width, height) / 3;
    return {
      A: { x: width / 3, y: height / 2.5 },
      B: { x: width / 4, y: height - u },
      C: { x: (4 * width) / 5, y: height - u },
      D: { x: (2 * width) / 3, y: height - u },
      showNames: o.showNames !== false,
      showStatement: !!o.showStatement,
      step1: !!o.step1, step2: !!o.step2,
      step3: !!o.step3, step4: !!o.step4,
    };
  }

  /** Drag a handle; the applet keeps B, C and D on one horizontal line. */
  function move(state, m) {
    if (!m || !["A", "B", "C", "D"].includes(m.point)) return null;
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return null;
    const next = { ...state, [m.point]: { x: m.x, y: m.y } };
    if (m.point !== "A") {
      next.B = { ...next.B, y: m.y };
      next.C = { ...next.C, y: m.y };
      next.D = { ...next.D, y: m.y };
    }
    return next;
  }

  /** A demo: the construction is "done" once every point exists. */
  function result(state) {
    return figure(state).valid ? "done" : null;
  }

  /** Plain-data position for the player's record and the tutor. */
  function position(state) {
    return {
      A: { ...state.A }, B: { ...state.B }, C: { ...state.C }, D: { ...state.D },
      showNames: !!state.showNames, showStatement: !!state.showStatement,
      step1: !!state.step1, step2: !!state.step2,
      step3: !!state.step3, step4: !!state.step4,
    };
  }

  return {
    start, move, figure, result, position,
    add, sub, scale, dot, cross, dist, sqDist, unit, finite,
    foot, distToLine, intersection, circleLine, other,
    circumcircle, incenter, incircle, touchCircle, extendLine,
  };
})();
