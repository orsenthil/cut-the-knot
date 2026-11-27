"use strict";

/*
 * CircleInIsoscelesTriangle — the illustration behind Bogomolny's applet.
 *
 * ABC is isosceles with AB = AC. P lies on AB and Q lies on CA, and they are
 * placed so that AP = CQ. The surprising fact is that A, P, Q and O, the
 * circumcenter of ABC, always lie on one circle.
 *
 * The one idea the code relies on: the applet keeps a single number t, the
 * parameter of P on the directed side A->B and of Q on the directed side
 * C->A. Then P = t·A + (1−t)·B and Q = t·C + (1−t)·A, so AP = (1−t)·AB and
 * CQ = (1−t)·CA are equal exactly when AB = CA. Dragging either point solves
 * for t as DoubLine.UpdateMidPoint does; dragging a base corner mirrors the
 * other one about the axis through A, as the applet's UpgradePoints does.
 *
 * No document, no window, no storage. One global, CircleInIsoscelesTriangleCore,
 * loaded with a plain <script> in the page and with loadCore in the Node test.
 * All functions take plain data and return new data; inputs are never changed.
 */
const CircleInIsoscelesTriangleCore = (() => {
  const EPS = 1e-9;

  const copy = (p) => ({ x: p.x, y: p.y });
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const clamp01 = (t) => Math.max(0, Math.min(1, t));

  /** The start of CircleInIsoscelesTriangleCanvas.init at 400x300. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const t = o.t === undefined ? 0.3 : clamp01(o.t);
    const axis = width / 2;
    if (o.points) {
      return {
        A: copy(o.points.A), B: copy(o.points.B), C: copy(o.points.C),
        t, axis: o.axis === undefined ? o.points.A.x : o.axis, width, height,
      };
    }
    // init(): apex at (W/2, 2·H/8); base at (W/2 ± W/4, H − H/8).
    return {
      A: { x: axis, y: height / 4 },
      B: { x: axis - width / 4, y: height - height / 8 },
      C: { x: axis + width / 4, y: height - height / 8 },
      t, axis, width, height,
    };
  }

  /** The five labelled points, with P and Q on the two equal sides. */
  function points(s) {
    // DoubLine(A,B) gives A*t + B*(1−t); DoubLine(C,A) gives C*t + A*(1−t).
    return {
      A: copy(s.A), B: copy(s.B), C: copy(s.C),
      P: lerp(s.B, s.A, s.t), Q: lerp(s.A, s.C, s.t),
    };
  }

  function sideLengths(s) {
    return {
      AB: distance(s.A, s.B),
      AC: distance(s.A, s.C),
      BC: distance(s.B, s.C),
    };
  }

  /** DoubLine.UpdateMidPoint(m): solve for the parameter of m on m1->m2. */
  function tFromPoint(p, m1, m2) {
    const u = { x: m1.x - m2.x, y: m1.y - m2.y };
    const denom = dot(u, u);
    if (denom <= EPS * EPS) return null;
    return clamp01(-dot(u, { x: m2.x - p.x, y: m2.y - p.y }) / denom);
  }

  /**
   * A new position after one handle is dragged. A stays on the symmetry axis;
   * dragging a base corner mirrors the other one; dragging P or Q changes the
   * one shared parameter, so both points move and AP = CQ is kept.
   */
  function withPoint(s, name, p) {
    if (!p || ["A", "B", "C", "P", "Q"].indexOf(name) < 0) return s;
    const q = { x: Number(p.x), y: Number(p.y) };
    if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) return s;
    const next = { ...s, A: copy(s.A), B: copy(s.B), C: copy(s.C) };
    if (name === "A") {
      next.A = { x: s.axis, y: q.y };
    } else if (name === "B") {
      next.B = q;
      next.C = { x: 2 * s.axis - q.x, y: q.y };
    } else if (name === "C") {
      next.C = q;
      next.B = { x: 2 * s.axis - q.x, y: q.y };
    } else {
      const t = name === "P" ? tFromPoint(q, next.A, next.B) : tFromPoint(q, next.C, next.A);
      if (t === null) return s;
      next.t = t;
    }
    return next;
  }

  /** Shortest distance from p to the infinite line through a and b. */
  function distToLine(p, a, b) {
    const len = distance(a, b);
    if (len < EPS) return Infinity;
    return Math.abs(cross(a, b, p)) / len;
  }

  /** GeoSDoub.NearestPoint(p, a, b): the foot of the perpendicular onto ab. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 <= EPS * EPS) return copy(a);
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Circumcenter from the three vertex coordinates (not the applet's way). */
  function circumcenter(p, q, r) {
    const d = 2 * (p.x * (q.y - r.y) + q.x * (r.y - p.y) + r.x * (p.y - q.y));
    const scale = Math.max(1, distance(p, q), distance(q, r), distance(r, p));
    if (!Number.isFinite(d) || Math.abs(d) <= EPS * scale * scale) return null;
    const p2 = p.x * p.x + p.y * p.y;
    const q2 = q.x * q.x + q.y * q.y;
    const r2 = r.x * r.x + r.y * r.y;
    return {
      x: (p2 * (q.y - r.y) + q2 * (r.y - p.y) + r2 * (p.y - q.y)) / d,
      y: (p2 * (r.x - q.x) + q2 * (p.x - r.x) + r2 * (q.x - p.x)) / d,
    };
  }

  /** The applet's GetCircle: circumcenter of A,P,Q and the mean of the three radii. */
  function circle(s) {
    const p = points(s);
    const center = circumcenter(p.A, p.P, p.Q);
    if (!center) return null;
    const radius = (distance(center, p.A) + distance(center, p.P) + distance(center, p.Q)) / 3;
    return { center, radius };
  }

  function isDegenerate(s) {
    const lens = sideLengths(s);
    return Math.abs(cross(s.A, s.B, s.C)) <= EPS || Math.min(lens.AB, lens.AC, lens.BC) <= EPS;
  }

  /** Everything the page needs to draw and describe one configuration. */
  function measurements(s) {
    const p = points(s);
    const lens = sideLengths(s);
    return {
      ...p,
      t: s.t,
      O: circumcenter(p.A, p.B, p.C),
      circle: circle(s),
      foot: foot(p.A, p.B, p.C),
      lengths: { ...lens, AP: distance(p.A, p.P), CQ: distance(p.C, p.Q) },
      degenerate: isDegenerate(s),
    };
  }

  /* Four points are concyclic iff det[x, y, x²+y², 1] = 0. */
  function cyclicDeterminant(a, b, c, d) {
    const rows = [a, b, c, d].map((p) => [p.x, p.y, p.x * p.x + p.y * p.y, 1]);
    const minor3 = (u, v, w) =>
      u[0] * (v[1] * w[2] - v[2] * w[1])
      - u[1] * (v[0] * w[2] - v[2] * w[0])
      + u[2] * (v[0] * w[1] - v[1] * w[0]);
    let det = 0;
    for (let i = 0; i < 4; i++) {
      const minor = [];
      for (let j = 0; j < 4; j++) if (j !== i) minor.push(rows[j].slice(0, 3));
      det += (i % 2 ? -1 : 1) * rows[i][3] * minor3(minor[0], minor[1], minor[2]);
    }
    return det;
  }

  /** Each part of the puzzle statement, checked numerically at this position. */
  function claims(s) {
    const m = measurements(s);
    const bad = {
      valid: false, isosceles: false, equalLengths: false, pointsOnSides: false,
      circumcenter: false, OOnCircle: false, concyclic: false,
    };
    if (m.degenerate || !m.O || !m.circle) return bad;
    const { A, B, C, P, Q, O, lengths, circle: circ } = m;
    const scale = Math.max(lengths.AB, lengths.AC, lengths.BC);
    const tol = 1e-6 * scale;
    const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
    const onSide = (p, x, y) =>
      distToLine(p, x, y) <= tol &&
      Math.abs(distance(x, p) + distance(p, y) - distance(x, y)) <= tol;
    const OA = distance(O, A), OB = distance(O, B), OC = distance(O, C);
    const valid = s.t > 1e-6 && s.t < 1 - 1e-6 &&
      Math.abs(cross(A, P, Q)) > tol * tol &&
      Math.abs(cross(A, B, C)) > tol * tol;
    return {
      valid,
      isosceles: close(lengths.AB, lengths.AC, tol),
      equalLengths: close(lengths.AP, lengths.CQ, tol),
      pointsOnSides: onSide(P, A, B) && onSide(Q, C, A),
      circumcenter: close(OA, OB, tol) && close(OA, OC, tol),
      OOnCircle: close(distance(O, circ.center), circ.radius, 2e-6 * scale),
      concyclic: Math.abs(cyclicDeterminant(A, P, Q, O)) <= 1e-6 * Math.pow(scale, 4),
    };
  }

  /** This is an illustration: there is no win, loss or end. */
  function result(/* state */) {
    return null;
  }

  return {
    start, points, sideLengths, tFromPoint, withPoint, distToLine, foot,
    circumcenter, circle, isDegenerate, measurements, cyclicDeterminant,
    claims, result,
  };
})();
