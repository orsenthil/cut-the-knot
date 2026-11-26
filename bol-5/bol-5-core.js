"use strict";

/*
 * BOL5 — Archimedes' Book of Lemmas, Proposition 5, from Bogomolny's applet.
 *
 * AB is the diameter of a big semicircle, C is a point on AB, and CD is the
 * perpendicular up to that semicircle. The semicircles on AC and CB sit inside
 * the big one. One circle is drawn on each side of CD, touching CD and two of
 * the semicircles. The claim is that the two circles are always equal: if
 * AC = 2r1, CB = 2r2 and a twin circle has radius r, then 1/r = 1/r1 + 1/r2.
 *
 * The one idea the code relies on: AB = AC + CB, so with R = AB/2, r1 = AC/2
 * and r2 = CB/2 we have R = r1 + r2. A circle of radius r = r1*r2/(r1+r2)
 * whose centre is r from CD and sqrt(4*r1*r) above AB touches the line CD,
 * the small semicircle externally and the big semicircle internally; the same
 * radius works on the other side with r2 in place of r1.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, Bol5Core, so the page loads it with a plain <script>
 * and porting/check-bol-5.mjs loads it in Node. The position is plain data and
 * no function changes the position it is given.
 */
const Bol5Core = (() => {
  const EPS = 1e-9;
  /* The Java applet refused to drag C nearer than 10px to A or B. */
  const MIN_GAP = 10;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const scale = (p, t) => ({ x: p.x * t, y: p.y * t });

  /** The applet's own layout: margin 30, side min(400-60, 250-60) = 190. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: { x: o.points.A.x, y: o.points.A.y },
        B: { x: o.points.B.x, y: o.points.B.y },
        C: { x: o.points.C.x, y: o.points.C.y },
        showNames: o.showNames !== false,
        showHint: Boolean(o.showHint),
      };
    }
    const A = { x: 30, y: 185 };
    const B = { x: 220, y: 185 };
    /* CTKMoveableDoub.Fix(Y_FIXED): C slides horizontally, starting at
       0.3*A.x + 0.7*B.x, exactly as BOL5Canvas.init places it. */
    const C = { x: 0.3 * A.x + 0.7 * B.x, y: A.y };
    return { A, B, C, showNames: o.showNames !== false, showHint: Boolean(o.showHint) };
  }

  /** C stays on AB and at least MIN_GAP board units from either end. */
  function clampC(p, s) {
    const A = s.A, B = s.B;
    const dx = B.x - A.x, dy = B.y - A.y;
    const len2 = dx * dx + dy * dy;
    if (len2 <= EPS) return { x: A.x, y: A.y };
    const t = clamp(((p.x - A.x) * dx + (p.y - A.y) * dy) / len2,
      MIN_GAP / Math.sqrt(len2), 1 - MIN_GAP / Math.sqrt(len2));
    return { x: A.x + dx * t, y: A.y + dy * t };
  }

  /** Only C can be dragged; the returned state is new. */
  function withPoint(s, name, p) {
    const next = start({ points: s, showNames: s.showNames, showHint: s.showHint });
    if (name === "C") next.C = clampC(p, next);
    return next;
  }

  function withOption(s, name, value) {
    const next = start({ points: s, showNames: s.showNames, showHint: s.showHint });
    if (name === "showNames") next.showNames = Boolean(value);
    if (name === "showHint") next.showHint = Boolean(value);
    return next;
  }

  /** The second intersection of line P->Q with the circle at c, away from P. */
  function otherOnCircle(c, radius, P, Q, from) {
    const dx = Q.x - P.x, dy = Q.y - P.y;
    const a = dx * dx + dy * dy;
    if (a <= EPS) return null;
    const fx = P.x - c.x, fy = P.y - c.y;
    const b = 2 * (fx * dx + fy * dy);
    const cc = fx * fx + fy * fy - radius * radius;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const pts = [
      { x: P.x + ((-b + root) / (2 * a)) * dx, y: P.y + ((-b + root) / (2 * a)) * dy },
      { x: P.x + ((-b - root) / (2 * a)) * dx, y: P.y + ((-b - root) / (2 * a)) * dy },
    ];
    return dist(pts[0], from) >= dist(pts[1], from) ? pts[0] : pts[1];
  }

  function lineIntersection(P, Q, R, S) {
    const rx = Q.x - P.x, ry = Q.y - P.y;
    const sx = S.x - R.x, sy = S.y - R.y;
    const det = rx * sy - ry * sx;
    if (Math.abs(det) < EPS) return null;
    const t = ((R.x - P.x) * sy - (R.y - P.y) * sx) / det;
    return { x: P.x + rx * t, y: P.y + ry * t };
  }

  /** Everything the page needs to draw and describe the current picture. */
  function measurements(s) {
    const A = s.A, B = s.B, C = s.C;
    const ux = (B.x - A.x), uy = (B.y - A.y);
    const AB = Math.hypot(ux, uy);
    if (AB <= EPS) return null;
    const u = { x: ux / AB, y: uy / AB };
    const n = { x: u.y, y: -u.x }; /* perpendicular, pointing up in SVG */
    const AC = dist(A, C), CB = dist(C, B);
    const r1 = AC / 2, r2 = CB / 2, R = AB / 2;
    const denom = r1 + r2;
    if (denom <= EPS) return null;
    const r = (r1 * r2) / denom; /* = AC*CB/(2*AB) = 1/(1/r1 + 1/r2) */
    const M = mid(A, B), O1 = mid(A, C), O2 = mid(C, B);

    /* D is where the perpendicular at C meets the big semicircle. */
    const along = dot({ x: C.x - M.x, y: C.y - M.y }, u);
    const height = Math.sqrt(Math.max(0, R * R - along * along));
    const D = add(C, scale(n, height));

    /* The twin circles: r away from CD along AB, up by sqrt(4*r_i*r). */
    const hL = 2 * Math.sqrt(Math.max(0, r1 * r));
    const hR = 2 * Math.sqrt(Math.max(0, r2 * r));
    const left = { c: add(add(C, scale(u, -r)), scale(n, hL)), r: r };
    const right = { c: add(add(C, scale(u, r)), scale(n, hR)), r: r };

    /* E touches CD, H is the far end of the diameter EH. */
    const E = add(C, scale(n, hL));
    const H = add(left.c, scale(u, -r));
    const HE = 2 * r;

    /* The proof points, as the applet's FindF/FindI/Intersect compute them.
       Dp is the proof's D (AF meets CD); D above is the top of the drawn
       perpendicular — the applet keeps both and labels Dp in its hint. */
    const F = otherOnCircle(M, R, A, H, A);
    const I = otherOnCircle(M, R, A, E, A);
    const G = lineIntersection(A, E, C, H);
    const Dp = lineIntersection(A, H, C, E);

    return {
      A, B, C, AB, AC, CB, r1, r2, R, r, M, O1, O2, u, n,
      D, Dp, left, right, E, H, HE, F, I, G,
    };
  }

  /** Each claim on the page, checked numerically at this position. */
  function claims(s) {
    const m = measurements(s);
    const off = {
      twinsEqual: false, productFormula: false, reciprocal: false,
      leftTangent: false, rightTangent: false, perpendicular: false, proofPoints: false,
    };
    if (!m) return off;
    const tol = 1e-7 * Math.max(1, m.AB);
    const near = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= (t || tol);
    const onCircle = (p, c, radius) => Math.abs(dist(p, c) - radius) <= tol;
    const straight = (P, Q, R) => Math.abs(cross(P, Q, R)) <= tol;
    const { A, B, C, M, O1, O2, D, Dp, E, F, G, H, I, left, right, r, r1, r2, R, HE } = m;

    /* Distance from a centre to the line CD is |(centre-C).u|. */
    const dLeftLine = Math.abs(dot({ x: left.c.x - C.x, y: left.c.y - C.y }, m.u));
    const dRightLine = Math.abs(dot({ x: right.c.x - C.x, y: right.c.y - C.y }, m.u));
    return {
      twinsEqual: near(left.r, right.r, 1e-9),
      productFormula: near(m.AC * m.CB, m.AB * HE, tol * Math.max(1, m.AB)),
      reciprocal: near(1 / r, 1 / r1 + 1 / r2, 1e-9),
      leftTangent:
        near(dLeftLine, r) && near(dist(left.c, O1), r + r1) && near(dist(left.c, M), R - r),
      rightTangent:
        near(dRightLine, r) && near(dist(right.c, O2), r + r2) && near(dist(right.c, M), R - r),
      perpendicular:
        Math.abs(dot({ x: D.x - C.x, y: D.y - C.y }, m.u)) <= tol && onCircle(D, M, R),
      proofPoints:
        Boolean(F && I && G && Dp) && onCircle(F, M, R) && onCircle(I, M, R) &&
        straight(A, F, H) && straight(A, F, Dp) && straight(A, E, I) &&
        straight(A, G, E) && straight(C, G, H) &&
        Math.abs(dot({ x: E.x - C.x, y: E.y - C.y }, m.u)) <= tol &&
        Math.abs(dot({ x: Dp.x - C.x, y: Dp.y - C.y }, m.u)) <= tol,
    };
  }

  /** Nothing can be won or lost: this is an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    start, clampC, withPoint, withOption, measurements, claims, result,
    otherOnCircle, lineIntersection, dist, mid, cross,
  };
})();
