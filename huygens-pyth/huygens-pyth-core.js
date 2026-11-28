"use strict";

/*
 * Huygens' proof of the Pythagorean theorem, from Alexander Bogomolny's
 * HuygensPyth applet.
 *
 * The figure starts with a right triangle ABC (right angle at C) and the three
 * squares on its sides. The applet extends GA to P so that AP = AG and BD to N
 * so that BN = BD, where G and D are the far corners of the squares on AC and
 * BC. Joining A to N and B to P cuts the square on AB into two parallelograms;
 * Euclid I.41 turns the two pairs of equal-area triangles into
 * AB² = AC² + BC².
 *
 * The code follows the applet's own arithmetic: GeoSDoub.Rotate turns a point
 * about a centre in screen coordinates (y grows downwards), GeoSDoub.Intersect
 * solves two lines in ax+by+c=0 form with a determinant cutoff of 1, and
 * GetParallelTo steps 100 units along a side. Dragging C keeps it on the
 * circumcircle of ABC and records the new angle at A; dragging A or B rebuilds
 * C from that angle and swaps A and B if the orientation has turned over.
 *
 * This file is only the geometry. No document, no window, no storage. It
 * defines one global, HuygensPythCore, and every position is plain JSON.
 */
const HuygensPythCore = (() => {
  const WIDTH = 500; // the applet's second, explanation-time APPLET tag
  const HEIGHT = 450;
  const ANGLE_START = 0.5235987755982988; // pi/6, the canvas's AngleA
  const QUARTER = Math.PI / 2;
  const OPTION_KEYS = ["showNames", "showHint"];

  const pt = (x, y) => ({ x, y });
  const add = (a, b) => pt(a.x + b.x, a.y + b.y);
  const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
  const scale = (a, k) => pt(a.x * k, a.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const dist2 = (a, b) => {
    const d = sub(a, b);
    return dot(d, d);
  };
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const midpoint = (a, b) => pt((a.x + b.x) / 2, (a.y + b.y) / 2);

  /** Literal GeoSDoub.Rotate(P, Q, angle, dir). */
  function rotate(centre, q, angle, dir) {
    const cs = Math.cos(angle);
    const sn = Math.sin(angle);
    const dx = q.x - centre.x;
    const dy = q.y - centre.y;
    return pt(
      centre.x + cs * dx - dir * sn * dy,
      centre.y + dir * sn * dx + cs * dy,
    );
  }

  /** Literal GeoSDoub.Intersect(p1,p2,p3,p4): NaN when |det| < 1. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y;
    const b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y;
    const b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return pt(NaN, NaN);
    return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** The canvas's Extend(from, through, length). */
  function extend(from, through, length) {
    const factor = length / dist(from, through);
    return pt(
      from.x + (through.x - from.x) * factor,
      from.y + (through.y - from.y) * factor,
    );
  }

  /** Literal GeoSDoub.GetParallelTo: p + 100*(q-r). */
  function getParallelTo(p, q, r) {
    return pt(p.x + 100 * (q.x - r.x), p.y + 100 * (q.y - r.y));
  }

  /** GeoSDoub.ComputeAngle(P,Q,R): the angle at P by the cosine rule. */
  function angle(P, Q, R) {
    const a = dist(P, Q), b = dist(P, R), c = dist(Q, R);
    return Math.acos((a * a + b * b - c * c) / (2 * a * b));
  }

  /** GeoSDoub.FindOrientation: +1 for a left turn, -1 otherwise. */
  function orientation(A, B, C) {
    const s = C.x * (A.y - B.y) + C.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.FindCircumcenter: the two perpendicular bisectors intersect. */
  function circumcenter(A, B, C) {
    const mAB = midpoint(A, B);
    const mBC = midpoint(B, C);
    const p = pt(mAB.x + B.y - A.y, mAB.y - B.x + A.x);
    const q = pt(mBC.x + C.y - B.y, mBC.y - C.x + B.x);
    return intersect(mAB, p, mBC, q);
  }

  /** GetCircle(A,B,C) from the canvas: mean distance to the circumcentre. */
  function circle(A, B, C) {
    const centre = circumcenter(A, B, C);
    const r = (dist(centre, A) + dist(centre, B) + dist(centre, C)) / 3;
    return { centre, r };
  }

  /** CTKMoveableDoub.SetLocation when restricted to that circle. */
  function projectToCircle(p, circle) {
    const d = dist(p, circle.centre);
    if (!Number.isFinite(d) || d < 1e-12) return pt(NaN, NaN);
    return pt(
      circle.centre.x + ((p.x - circle.centre.x) * circle.r) / d,
      circle.centre.y + ((p.y - circle.centre.y) * circle.r) / d,
    );
  }

  /** Canvas ComputeC(): the ray at AngleA from A meets the ray at 90-AngleA from B. */
  function computeC(A, B, angleA) {
    const rayA = rotate(A, B, angleA, -1);
    const rayB = rotate(B, A, QUARTER - angleA, 1);
    return intersect(A, rayA, B, rayB);
  }

  /** Canvas Compute(): every constructed point, named as in ShowNames(). */
  function derive(state) {
    const A = state.A, B = state.B, C = state.C;
    const Cq = rotate(B, C, QUARTER, 1);   // D: square on BC
    const Aq = rotate(C, B, QUARTER, -1);  // E: square on BC
    const Bq = rotate(C, A, QUARTER, 1);   // F: square on AC
    const Cp = rotate(A, C, QUARTER, -1);  // G: square on AC
    const Ap = rotate(B, A, QUARTER, -1);  // K: square on AB
    const Bp = rotate(A, B, QUARTER, 1);   // S: square on AB
    const P = extend(Cp, A, 2 * dist(Cp, A));  // AP = AG
    const N = extend(Cq, B, 2 * dist(Cq, B));  // BN = BD
    const throughP = getParallelTo(P, A, B);   // LM parallel to AB
    const L = intersect(throughP, P, A, Bp);
    const M = intersect(throughP, P, B, Ap);
    return { A, B, C, Ap, Aq, Bp, Bq, Cp, Cq, P, N, L, M };
  }

  function polygonArea(points) {
    let twice = 0;
    for (let i = 0; i < points.length; i++) {
      const q = points[(i + 1) % points.length];
      twice += points[i].x * q.y - q.x * points[i].y;
    }
    return Math.abs(twice) / 2;
  }

  function triangleArea(A, B, C) {
    return Math.abs(cross(sub(B, A), sub(C, A))) / 2;
  }

  function copyPoint(p) { return pt(p.x, p.y); }
  function copyState(s) {
    return {
      A: copyPoint(s.A), B: copyPoint(s.B), C: copyPoint(s.C),
      angleA: s.angleA,
      showNames: Boolean(s.showNames), showHint: Boolean(s.showHint),
    };
  }

  /** The figure the applet builds in init() at 500 x 450. */
  function start(options) {
    const opts = options || {};
    const width = opts.width || WIDTH;
    const height = opts.height || HEIGHT;
    const angleA = opts.angleA === undefined ? ANGLE_START : opts.angleA;
    const A = pt(width / 3, height / 1.9);
    const B = pt(width - width / 3, height / 1.9);
    const C = computeC(A, B, angleA);
    return { A, B, C, angleA, showNames: false, showHint: false };
  }

  /** Canvas UpgradePoints(): the orientation check swaps A and B. */
  function swapped(state) {
    return { ...state, A: state.B, B: state.A };
  }

  /**
   * Move a named handle, or return null for a position the applet could not
   * draw. C slides on the circumcircle and sets AngleA; A and B rebuild C
   * from the stored AngleA. `swapped` says whether UpgradePoints exchanged
   * the A and B references: the dragged dot keeps its identity, so a view
   * with fixed dot elements must swap which name each element stands for.
   */
  function withPointDetailed(state, name, target) {
    if (!finite(target) || (name !== "A" && name !== "B" && name !== "C")) return null;
    if (name === "C") {
      const c = circle(state.A, state.B, state.C);
      const C = projectToCircle(target, c);
      if (!finite(C)) return null;
      const nextAngle = angle(state.A, state.B, C);
      if (!Number.isFinite(nextAngle)) return null;
      const next = { ...copyState(state), C, angleA: nextAngle };
      if (orientation(next.A, next.B, next.C) === 1) return { state: next, swapped: false };
      return { state: swapped(next), swapped: true };
    }
    const A = name === "A" ? copyPoint(target) : state.A;
    const B = name === "B" ? copyPoint(target) : state.B;
    const C = computeC(A, B, state.angleA);
    if (!finite(C)) return null;
    const next = { ...copyState(state), A, B, C };
    if (orientation(A, B, C) === 1) return { state: next, swapped: false };
    return { state: swapped(next), swapped: true };
  }

  function withPoint(state, name, target) {
    const result = withPointDetailed(state, name, target);
    return result ? result.state : null;
  }

  function withOption(state, key, value) {
    if (!OPTION_KEYS.includes(key)) return state;
    return { ...state, [key]: Boolean(value) };
  }

  /** Numbers the page's proof talks about, for the readout and the logic test. */
  function stats(state) {
    const g = derive(state);
    const d = (p, q) => dist(p, q);
    const AC2 = dist2(g.A, g.C);
    const BC2 = dist2(g.B, g.C);
    const AB2 = dist2(g.A, g.B);
    return {
      ...g,
      lengths: {
        AC: d(g.A, g.C), BC: d(g.B, g.C), AB: d(g.A, g.B),
        AP: d(g.A, g.P), AG: d(g.A, g.Cp), AD: d(g.A, g.Cq),
        BN: d(g.B, g.N), BD: d(g.B, g.Cq),
        AS: d(g.A, g.Bp), PS: d(g.P, g.Bp), KS: d(g.Ap, g.Bp),
      },
      angles: {
        BAC: angle(g.A, g.B, g.C), ABC: angle(g.B, g.A, g.C),
        ASP: angle(g.Bp, g.A, g.P),
        KSP: angle(g.Bp, g.Ap, g.P),
        ABN: angle(g.B, g.A, g.N),
        KPS: angle(g.P, g.Ap, g.Bp),
      },
      areas: {
        ABP: triangleArea(g.A, g.B, g.P),
        ANB: triangleArea(g.A, g.B, g.N),
        KPS: triangleArea(g.Ap, g.P, g.Bp),
        ABC: triangleArea(g.A, g.B, g.C),
        ABML: polygonArea([g.A, g.B, g.M, g.L]),
        KMLS: polygonArea([g.Ap, g.M, g.L, g.Bp]),
        squareAC: AC2, squareBC: BC2, squareAB: AB2,
      },
      rightAngleDot: dot(sub(g.A, g.C), sub(g.B, g.C)),
    };
  }

  return {
    WIDTH, HEIGHT, ANGLE_START, OPTION_KEYS,
    pt, add, sub, scale, dot, cross, dist, dist2, finite,
    rotate, intersect, extend, getParallelTo, angle, orientation,
    circumcenter, circle, projectToCircle, computeC, derive,
    polygonArea, triangleArea, start, withPoint, withPointDetailed,
    withOption, stats, snapshot: copyState,
  };
})();
