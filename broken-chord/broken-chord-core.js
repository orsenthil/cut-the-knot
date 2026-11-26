"use strict";

/*
 * The Broken Chord Theorem, from Alexander Bogomolny's Java applet BrokenChord.
 *
 * ABC is a triangle on a circle. P is the midpoint of the arc ACB: the
 * intersection of the perpendicular bisector of AB with the circumcircle on
 * the same side of AB as C. Drop the perpendicular from P to the longer of the
 * sides AC and BC; its foot M cuts the broken line A-C-B in half. When AC is
 * the longer side that says AM = MC + BC, otherwise BM = MC + AC.
 *
 * The one idea the code relies on: extend the long side past C to F with
 * CF equal to the short side. Then P is the circumcentre of triangle ABF,
 * so the perpendicular from P to the chord KF (K is A or B) bisects it, and
 * KM = MF = MC + CF = MC + the short side.
 *
 * Every point is computed the way BrokenChordCanvas.Compute/FindP/FindF and
 * GeoSDoub do it (the circumradius is the mean of the three distances from
 * the circumcentre, as in GetCircle). This file is the logic and nothing
 * else: no document, no window, no storage. It defines one global,
 * BrokenChordCore, so the page loads it with a plain <script> and
 * porting/check-broken-chord.mjs loads it in Node.
 *
 * The position is plain data. Functions take a position and return a new
 * one; they never change what they are given.
 */
const BrokenChordCore = (() => {
  const EPS = 1e-9;

  /* The applet's canvas centre and its radius min(w/2, h/2) * 3/5, in board
     units. A sits at angle PI, B at -0.2 and C at -PI/3.5 radians, exactly as
     BrokenChordCanvas.init creates them. */
  const CENTRE = { x: 180, y: 125 };
  const RADIUS = 82;
  const BOARD = { x0: 12, y0: 12, x1: 348, y1: 238 };

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const scale = (p, t) => ({ x: p.x * t, y: p.y * t });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const onCircle = (p, c, r) => Math.abs(dist(p, c) - r);
  const orientation = (a, b, c) => (cross(a, b, c) > 0 ? 1 : -1);

  /** Keep a handle on the board; the picture still works if it is dragged far. */
  function clampPoint(p) {
    return {
      x: clamp(p.x, BOARD.x0, BOARD.x1),
      y: clamp(p.y, BOARD.y0, BOARD.y1),
    };
  }

  function copyPoint(p) {
    return { x: p.x, y: p.y };
  }

  /** The position a new picture starts from. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: copyPoint(o.points.A), B: copyPoint(o.points.B), C: copyPoint(o.points.C),
        showNames: o.showNames !== false,
        showHint: Boolean(o.showHint),
      };
    }
    const at = (angle) => ({
      x: CENTRE.x + RADIUS * Math.cos(angle),
      y: CENTRE.y + RADIUS * Math.sin(angle),
    });
    return {
      A: at(Math.PI), B: at(-0.2), C: at(-Math.PI / 3.5),
      showNames: o.showNames !== false,
      showHint: Boolean(o.showHint),
    };
  }

  /** Only A, B and C can be dragged: every other point is computed from them. */
  function withPoint(s, name, p) {
    const next = start({ points: s, showNames: s.showNames, showHint: s.showHint });
    if (name === "A" || name === "B" || name === "C") next[name] = clampPoint(p);
    return next;
  }

  function withOption(s, name, value) {
    const next = start({ points: s, showNames: s.showNames, showHint: s.showHint });
    if (name === "showNames") next.showNames = Boolean(value);
    if (name === "showHint") next.showHint = Boolean(value);
    return next;
  }

  /** Circumcentre of three points, solved from the two bisector equations.
      Null when the three points are collinear (GeoSDoub.Intersect would give
      NaN there and the applet draws nothing). */
  function circumcentre(A, B, C) {
    const d = 2 * cross(A, B, C);
    if (!Number.isFinite(d) || Math.abs(d) < EPS) return null;
    const a2 = B.x * B.x + B.y * B.y - (A.x * A.x + A.y * A.y);
    const b2 = C.x * C.x + C.y * C.y - (A.x * A.x + A.y * A.y);
    return {
      x: (a2 * (C.y - A.y) - b2 * (B.y - A.y)) / d,
      y: ((B.x - A.x) * b2 - (C.x - A.x) * a2) / d,
    };
  }

  /** GetCircle: the centre is the circumcentre, the radius their mean distance. */
  function circle(A, B, C) {
    const c = circumcentre(A, B, C);
    if (!c) return null;
    return { c, r: (dist(c, A) + dist(c, B) + dist(c, C)) / 3 };
  }

  /** GeoSDoub.NearestPoint(P, U, V): the foot of the perpendicular to UV. */
  function project(P, U, V) {
    if (dist(U, P) * dist(U, P) < 0.1) return copyPoint(P);
    const d = sub(V, U);
    const len2 = dot(d, d);
    if (len2 <= EPS) return copyPoint(P);
    return add(U, scale(d, dot(sub(P, U), d) / len2));
  }

  /** The two points where the line through U and V meets the circle. */
  function lineCircle(U, V, cc) {
    const d = sub(V, U);
    const len = Math.hypot(d.x, d.y);
    if (len <= EPS || !cc) return null;
    const n = { x: d.x / len, y: d.y / len };
    const t0 = dot(sub(cc.c, U), n);
    const h2 = cc.r * cc.r - (dist(U, cc.c) ** 2 - t0 * t0);
    if (!(h2 >= 0)) return null;
    const h = Math.sqrt(h2);
    return [add(U, scale(n, t0 + h)), add(U, scale(n, t0 - h))];
  }

  /** FindP: the perpendicular bisector of AB meets the circumcircle twice;
      take the point on the same side of AB as C (the midpoint of arc ACB). */
  function findP(A, B, C, cc) {
    const u = mid(A, B);
    const v = { x: u.x + (B.y - A.y), y: u.y - (B.x - A.x) };
    const pts = lineCircle(u, v, cc);
    if (!pts) return null;
    const side = orientation(A, B, C);
    return orientation(A, B, pts[0]) === side ? pts[0] : pts[1];
  }

  /** FindF: extend the long side past C by the length of the short side. */
  function findF(K, L, C) {
    const kc = dist(C, K);
    if (kc <= EPS) return null;
    const t = (dist(C, L) + kc) / kc;
    return add(copyPoint(K), scale(sub(C, K), t));
  }

  /** Everything the page draws and describes for a position, or null when
      the three points are too close to collinear to define the circle. */
  function measurements(s) {
    const A = s.A, B = s.B, C = s.C;
    if (dist(A, B) < 1 || dist(A, C) < 1 || dist(B, C) < 1) return null;
    const cc = circle(A, B, C);
    if (!cc) return null;
    const P = findP(A, B, C, cc);
    if (!P) return null;

    const AC = dist(A, C), BC = dist(B, C);
    let M, K, L;
    if (AC > BC) {
      M = project(P, A, C); K = copyPoint(A); L = copyPoint(B);
    } else {
      M = project(P, B, C); K = copyPoint(B); L = copyPoint(A);
    }
    const F = findF(K, L, C);
    if (!F) return null;
    const cf = circle(A, B, F);
    if (!cf) return null;

    return {
      A, B, C, P, M, K, L, F, circle: cc, circleF: cf,
      AC, BC, AB: dist(A, B), longSide: Math.max(AC, BC), shortSide: Math.min(AC, BC),
      AM: dist(K, M), MC: dist(M, C), CF: dist(C, F), MF: dist(M, F),
    };
  }

  /** Each claim the page makes, checked at this position. */
  function claims(s) {
    const off = {
      arcMidpoint: false, mOnSegment: false, perpendicular: false,
      extension: false, pCentre: false, mBisects: false, brokenChord: false,
      angleDouble: false,
    };
    const m = measurements(s);
    if (!m) return off;
    const scale0 = Math.max(1, m.AB);
    const tol = 1e-7 * scale0;
    const near = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= (t || tol);
    const { A, B, C, P, M, K, L, F, circle: cc } = m;
    const angle = (U, V, W) => {
      const a = sub(U, V), b = sub(W, V);
      return Math.acos(clamp(dot(a, b) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)), -1, 1));
    };
    const t = dot(sub(M, K), sub(C, K)) / (dist(C, K) ** 2);

    return {
      /* P is on the perpendicular bisector of AB and on the circumcircle. */
      arcMidpoint: near(dist(P, A), dist(P, B)) && near(onCircle(P, cc.c, cc.r), 0),
      /* The foot M lies between K and C on the long side. */
      mOnSegment: t >= -tol && t <= 1 + tol &&
        Math.abs(cross(K, M, C)) <= tol && near(m.longSide, dist(K, M) + dist(M, C)),
      /* PM is perpendicular to the long side (KC, which is also KF). */
      perpendicular: near(dot(sub(P, M), sub(C, K)), 0, tol * scale0),
      /* F lies past C on ray KC, with CF equal to the short side CL. */
      extension: near(dist(C, F), dist(C, L)) && near(dist(K, F), m.longSide + m.shortSide) &&
        Math.abs(cross(K, C, F)) <= tol,
      /* P is the centre of the circle through A, B and F. */
      pCentre: near(dist(P, A), dist(P, B)) && near(dist(P, A), dist(P, F)),
      /* M is the midpoint of the chord KF of that circle. */
      mBisects: near(m.AM, m.MF) && Math.abs(cross(K, M, F)) <= tol,
      /* The theorem: the long part equals the broken remainder. */
      brokenChord: near(m.AM, m.MC + m.shortSide),
      /* The page's angle step: angle APB is twice angle AFB. */
      angleDouble: near(angle(A, P, B), 2 * angle(A, F, B), 1e-8),
    };
  }

  /** Nothing can be won or lost: this is an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    start, withPoint, withOption, measurements, claims, result,
    dist, mid, dot, cross, orient: orientation, circumcentre, circle,
    project, lineCircle, findP, findF,
  };
})();
