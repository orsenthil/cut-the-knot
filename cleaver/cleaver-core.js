"use strict";

/*
 * CleaverCore — Bogomolny's "The Cleaver".
 *
 * In triangle ABC, CL is the bisector of angle C, M the midpoint of AB, and
 * the line through M parallel to CL meets the longer of AC and BC at D. Then
 * M and D split the perimeter into two equal halves. MD is a cleaver.
 *
 * The code follows CleaverCanvas.Compute from the bytecode. With S the end of
 * AB on the longer side (A when AC > BC, else B) and T the other end, D is
 * Intersect(M, M + (C - L), S, C), and F = Extend(S, C, T) lies on SC past C
 * with CF = CT. GetPerp offsets the "premise" and "statement" measuring
 * arrows 30 pixels away from the triangle. FindAngleBisector, Intersect and
 * the orientation test are the applet's GeoSDoub routines.
 *
 * No document, no window, no storage: one global, plain data in and out.
 */
const CleaverCore = (() => {
  const WIDTH = 600, HEIGHT = 450;  // the size on the applet's page

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  /** GeoSDoub.FindOrientation: +1 for a positive signed area, else -1. */
  function orientation(p, q, r) {
    const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate: rotate q about p by angle * handedness. */
  function rotate(p, q, angle, handedness) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return {
      x: p.x + cs * (q.x - p.x) - handedness * sn * (q.y - p.y),
      y: p.y + handedness * sn * (q.x - p.x) + cs * (q.y - p.y),
    };
  }

  /** GeoSDoub.Intersect: two infinite lines; NaN when the determinant is < 1. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.ComputeAngle: law of cosines at p. */
  function angleAt(p, q, r) {
    const cos = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) / (2 * distance(p, q) * distance(p, r));
    if (!Number.isFinite(cos)) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  /** GeoSDoub.FindAngleBisector(p, q, r): where the bisector at p meets qr. */
  function findAngleBisector(p, q, r) {
    const ray = rotate(p, q, angleAt(p, q, r) / 2, orientation(p, q, r));
    return intersect(p, ray, q, r);
  }

  /** GeoSDoub.GetParallelTo(p, q, r): a far point on the line through p parallel to qr. */
  function parallelPoint(p, q, r) {
    return { x: p.x + 100 * (r.x - q.x), y: p.y + 100 * (r.y - q.y) };
  }

  /** Canvas.Extend(S, C, T): on ray SC, at distance SC + CT from S. */
  function extend(S, C, T) {
    const sc = distance(S, C), tc = distance(T, C);
    const k = (sc + tc) / sc;
    return { x: S.x + k * (C.x - S.x), y: S.y + k * (C.y - S.y) };
  }

  /** Canvas.GetPerp(p, q, away): a 30-pixel normal to pq, on the side away from `away`. */
  function getPerp(p, q, away) {
    const d = distance(p, q);
    if (d < 1) return { x: 0, y: 0 };
    const k = 30 / d;
    const mid = midpoint(p, q);
    const n = { x: k * (q.y - p.y), y: -k * (q.x - p.x) };
    const probe = { x: mid.x + n.x, y: mid.y + n.y };
    return orientation(p, q, probe) === orientation(p, q, away) ? { x: -n.x, y: -n.y } : n;
  }

  /** Canvas.GetVector(p, q, off): the segment pq shifted by off. */
  function getVector(p, q, off) {
    return [{ x: p.x + off.x, y: p.y + off.y }, { x: q.x + off.x, y: q.y + off.y }];
  }

  /** The canvas's init() on the page's 600 x 450 applet. */
  function start(options) {
    const o = options || {};
    if (o.points) return { A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C } };
    const w = o.width === undefined ? WIDTH : o.width;
    const h = o.height === undefined ? HEIGHT : o.height;
    const w3 = Math.floor(w / 3), h4 = Math.floor(h / 4);
    const A = { x: w3, y: h - h4 };
    return { A, B: { x: w - w3, y: A.y }, C: { x: (w * 3) / 5, y: 2 * h4 } };
  }

  /** A new position with one corner moved; the old one is untouched. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    if (next[name]) next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** The whole triangle moved by (dx, dy): the applet's MoveablePoly. */
  function shift(s, dx, dy) {
    const mv = (p) => ({ x: p.x + dx, y: p.y + dy });
    return { A: mv(s.A), B: mv(s.B), C: mv(s.C) };
  }

  function isDegenerate(s) {
    return Math.abs(cross(s.A, s.B, s.C)) < 1e-7 ||
      Math.min(distance(s.A, s.B), distance(s.B, s.C), distance(s.C, s.A)) < 1;
  }

  /** Canvas.Compute: every point the applet draws. */
  function compute(s) {
    const { A, B, C } = s;
    const L = findAngleBisector(C, A, B);
    const M = midpoint(A, B);
    const par = parallelPoint(M, L, C);
    const acLonger = distance(A, C) > distance(B, C);
    const S = acLonger ? A : B, T = acLonger ? B : A;
    const D = intersect(M, par, S, C);
    const F = extend(S, C, T);
    const off1 = getPerp(A, B, C);
    const off2 = getPerp(S, F, T);
    return {
      A, B, C, L, M, D, F,
      S: acLonger ? "A" : "B", T: acLonger ? "B" : "A",
      premise: { VA: getVector(M, A, off1), VB: getVector(M, B, off1) },
      statement: { VS: getVector(D, S, off2), VF: getVector(D, F, off2) },
      degenerate: isDegenerate(s) || ![L, D, F].every(finite),
    };
  }

  /** The two halves of the perimeter, as the cleaver cuts it. */
  function halves(s) {
    const m = compute(s);
    const S = s[m.S], T = s[m.T];
    const one = distance(S, m.M) + distance(S, m.D);
    const two = distance(T, m.M) + distance(T, s.C) + distance(s.C, m.D);
    return { one, two, perimeter: distance(s.A, s.B) + distance(s.B, s.C) + distance(s.C, s.A) };
  }

  /** Spieker centre: the incentre of the medial triangle. */
  function spieker(s) {
    const a = distance(s.B, s.C), b = distance(s.C, s.A), c = distance(s.A, s.B);
    const Ma = midpoint(s.B, s.C), Mb = midpoint(s.C, s.A), Mc = midpoint(s.A, s.B);
    // The medial triangle's side opposite Ma is a/2, and so on.
    const sum = a + b + c;
    return { x: (a * Ma.x + b * Mb.x + c * Mc.x) / sum, y: (a * Ma.y + b * Mb.y + c * Mc.y) / sum };
  }

  /** The cleaver from the midpoint of the side opposite `v` (v = "A", "B" or "C"). */
  function cleaverFrom(s, v) {
    const order = { A: ["B", "C", "A"], B: ["C", "A", "B"], C: ["A", "B", "C"] }[v];
    const t = { A: s[order[0]], B: s[order[1]], C: s[order[2]] };
    const m = compute(t);
    return [m.M, m.D];
  }

  function distToLine(p, x, y) {
    const len = distance(x, y);
    return len ? Math.abs(cross(x, y, p)) / len : Infinity;
  }

  /** |sin| of the angle between line pq and line uv. */
  function sinBetween(p, q, u, v) {
    const ax = q.x - p.x, ay = q.y - p.y, bx = v.x - u.x, by = v.y - u.y;
    return Math.abs(ax * by - ay * bx) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
  }

  /** The page's claims, measured at this triangle. */
  function claims(s) {
    const m = compute(s);
    if (m.degenerate) return { all: false, degenerate: true };
    const S = s[m.S], T = s[m.T];
    const scale = Math.max(distance(s.A, s.B), distance(s.B, s.C), distance(s.C, s.A));
    const tol = 1e-6 * scale;
    const h = halves(s);
    const sp = spieker(s);
    const lines = ["A", "B", "C"].map((v) => cleaverFrom(s, v));
    const out = {
      bisector: Math.abs(angleAt(s.C, s.A, m.L) - angleAt(s.C, m.L, s.B)) < 1e-7,
      dOnLongerSide: distToLine(m.D, S, s.C) <= tol &&
        distance(S, m.D) + distance(m.D, s.C) <= distance(S, s.C) + tol,
      cfEqualsCT: Math.abs(distance(s.C, m.F) - distance(s.C, T)) <= tol,
      clParallelTF: sinBetween(s.C, m.L, T, m.F) < 1e-7,
      dMidpointOfSF: distance(m.D, midpoint(S, m.F)) <= tol,
      halvesEqual: Math.abs(h.one - h.two) <= tol && Math.abs(h.one - h.perimeter / 2) <= tol,
      cleaversMeetAtSpieker: lines.every(([p, q]) => distToLine(sp, p, q) <= tol),
    };
    out.all = Object.values(out).every(Boolean);
    return out;
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    WIDTH, HEIGHT,
    start, withPoint, shift, isDegenerate, distance, cross, midpoint,
    orientation, rotate, intersect, angleAt, findAngleBisector, parallelPoint,
    extend, getPerp, sinBetween, getVector, compute, halves, spieker, cleaverFrom, distToLine,
    claims, result,
  };
})();
