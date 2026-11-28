"use strict";

/*
 * Medial Nagel, from Alexander Bogomolny's applet MedialNagel (page:
 * cut-the-knot.org/Curriculum/Geometry/MedialNagel.shtml). This is an
 * illustration, not a game: drag A, B or C and the drawing updates.
 *
 * D, E, F are the midpoints of BC, CA, AB. The incircles of AEF, BDF and CDE
 * touch EF, DF, DE at P, Q, R. The applet draws DP, EQ, FR and their crossing
 * M with the same GeoSDoub routines GergonneMedial uses: incenter from two
 * rotated angle bisectors, foot of a perpendicular on a whole line (NearestPoint),
 * and Cramer line intersection (Intersect, with Java's |det| < 1 guard). It
 * also draws the medial triangle's incircle, its Gergonne cevians, and, on
 * request, its three excircles. Every claim on the page is checked in
 * porting/check-medial-nagel.mjs against an independent side-length
 * transcription over thousands of triangles.
 *
 * This file is the logic only: no document, no window, no storage. It defines
 * one global, MedialNagelCore, and keeps the position as plain data.
 */
const MedialNagelCore = (() => {
  /** The original applet is 500 x 450; Reset uses these four constants. */
  const WIDTH = 500;
  const HEIGHT = 450;
  const GAP = 70;
  const ANGLE = Math.PI / 3;

  /** The three copies on the page have no options, ShowNames, or ShowIncircle. */
  const DEFAULT_SHOW_NAMES = true;
  const DEFAULT_SHOW_INCIRCLE = true;
  const DEFAULT_SHOW_HINT = false;
  const DEFAULT_SHOW_EXTRA = false;

  const EPS = 1e-9;
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, t) => ({ x: p.x * t, y: p.y * t });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const normal = (p) => ({ x: -p.y, y: p.x });

  /* ---- GeoSDoub methods, transcribed from the applet's bytecode ---- */

  /** GeoSDoub.ComputeAngle(p,q,r): the angle at p; clamp only guards rounding. */
  function angleAt(p, q, r) {
    const pq = dist(p, q), pr = dist(p, r);
    if (pq * pr < EPS) return NaN;
    const co = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) / (2 * pq * pr);
    return Math.acos(Math.max(-1, Math.min(1, co)));
  }

  /** GeoSDoub.FindOrientation: +1 when (q-p) x (r-p) is positive. */
  function orientation(p, q, r) {
    const c = cross(sub(q, p), sub(r, p));
    return c > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate: turn q about center by theta, in the triangle's sense. */
  function rotate(center, q, theta, sense) {
    const co = Math.cos(theta), si = Math.sin(theta);
    const dx = q.x - center.x, dy = q.y - center.y;
    return {
      x: center.x + co * dx - sense * si * dy,
      y: center.y + sense * si * dx + co * dy,
    };
  }

  /** GeoSDoub.Intersect: Java returns NaN when |determinant| < 1. */
  function intersect(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x;
    const c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x;
    const c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindIncenter: intersect the two internal angle bisectors. */
  function findIncenter(p, q, r) {
    const atP = angleAt(p, q, r) / 2;
    const atQ = angleAt(q, r, p) / 2;
    const sense = orientation(p, q, r);
    return intersect(p, rotate(p, q, atP, sense), q, rotate(q, r, atQ, sense));
  }

  /**
   * GeoSDoub.FindExcenter(p,q,r): the excenter opposite p. It bisects the
   * outside angle at q and the outside angle at r, with opposite senses.
   */
  function findExcenter(p, q, r) {
    const atQ = (Math.PI - angleAt(q, p, r)) / 2;
    const atR = (Math.PI - angleAt(r, p, q)) / 2;
    const sense = orientation(q, p, r);
    return intersect(q, rotate(q, r, atQ, sense), r, rotate(r, q, atR, -sense));
  }

  /**
   * GeoSDoub.NearestPoint(p,a,b): projection on the whole line ab. Java's
   * guard returns p itself when SqDist(a,p) < 0.1.
   */
  function nearestPoint(p, a, b) {
    if (sqDist(a, p) < 0.1) return { x: p.x, y: p.y };
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** MedialNagelCanvas.GetIncircle: center plus the average of three radii. */
  function incircle(p, q, r) {
    const center = findIncenter(p, q, r);
    const f1 = nearestPoint(center, q, r);
    const f2 = nearestPoint(center, r, p);
    const f3 = nearestPoint(center, p, q);
    const radius = (dist(center, f1) + dist(center, f2) + dist(center, f3)) / 3;
    return { center, radius, feet: [f1, f2, f3] };
  }

  /** MedialNagelCanvas.Midpoint. */
  function mid(p, q) {
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  }

  /* ------------------------------------ position ---------------------------------- */

  /**
   * MedialNagelCanvas.init(), with the applet's 500x450 canvas:
   *   cx = w/2, cy = 3h/5, u = w/5
   *   A = (cx-u, cy+70), B = (cx+2u, A.y)
   *   C = (cx+u cos60-u/2, cy-u sin60-140)
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const cx = width / 2, cy = (3 * height) / 5, u = width / 5;
    return {
      width, height,
      A: { x: cx - u, y: cy + GAP },
      B: { x: cx + 2 * u, y: cy + GAP },
      C: { x: cx + u * Math.cos(ANGLE) - u / 2, y: cy - u * Math.sin(ANGLE) - 2 * GAP },
      showNames: o.showNames === undefined ? DEFAULT_SHOW_NAMES : !!o.showNames,
      showIncircle: o.showIncircle === undefined ? DEFAULT_SHOW_INCIRCLE : !!o.showIncircle,
      showHint: o.showHint === undefined ? DEFAULT_SHOW_HINT : !!o.showHint,
      showExtra: o.showExtra === undefined ? DEFAULT_SHOW_EXTRA : !!o.showExtra,
    };
  }

  /** Reset keeps the view and the four applet switches, and rebuilds ABC. */
  function reset(state, options) {
    const o = options || {};
    return start({
      width: state.width, height: state.height,
      showNames: o.showNames === undefined ? state.showNames : o.showNames,
      showIncircle: o.showIncircle === undefined ? state.showIncircle : o.showIncircle,
      showHint: o.showHint === undefined ? state.showHint : o.showHint,
      showExtra: o.showExtra === undefined ? state.showExtra : o.showExtra,
    });
  }

  /** Move one draggable corner; the other corners and switches stay put. */
  function withPoint(state, name, point) {
    if (name !== "A" && name !== "B" && name !== "C") return state;
    return { ...state, [name]: { x: point.x, y: point.y } };
  }

  /** Toggle one of the applet's four checkboxes. */
  function withOption(state, name, value) {
    const key = {
      names: "showNames", incircle: "showIncircle", hint: "showHint", extra: "showExtra",
    }[name];
    return key ? { ...state, [key]: !!value } : state;
  }

  /* ------------------------------------ geometry ---------------------------------- */

  /**
   * MedialNagelCanvas.ComputePoints() and the extra construction in Draw().
   * All points are in board units so they can be saved for the tutor.
   */
  function compute(state) {
    const { A, B, C } = state;
    const D = mid(B, C), E = mid(C, A), F = mid(A, B);
    const circleA = incircle(A, E, F);
    const circleB = incircle(B, D, F);
    const circleC = incircle(C, D, E);
    const circleI = incircle(D, E, F);

    const P = nearestPoint(circleA.center, E, F);
    const Q = nearestPoint(circleB.center, D, F);
    const R = nearestPoint(circleC.center, D, E);
    const Pp = nearestPoint(circleI.center, E, F);
    const Qp = nearestPoint(circleI.center, D, F);
    const Rp = nearestPoint(circleI.center, D, E);

    // The applet intersects DP with EQ; FR should pass through the same point.
    const M = intersect(D, P, E, Q);
    // The Gergonne point: D-Pp, E-Qp, F-Rp.
    const G = intersect(D, Pp, E, Qp);

    // Draw()'s "Extra construction": the three excircles of DEF.
    const exD = findExcenter(D, F, E);
    const exE = findExcenter(E, F, D);
    const exF = findExcenter(F, D, E);
    const excircles = [
      { center: exD, foot: nearestPoint(exD, E, F), radius: dist(exD, nearestPoint(exD, E, F)) },
      { center: exE, foot: nearestPoint(exE, F, D), radius: dist(exE, nearestPoint(exE, F, D)) },
      { center: exF, foot: nearestPoint(exF, D, E), radius: dist(exF, nearestPoint(exF, D, E)) },
    ];

    const Iabc = findIncenter(A, B, C);
    const d = dist(E, F), e = dist(D, F), f = dist(D, E);
    const s = (d + e + f) / 2;
    const area = Math.abs(cross(sub(B, A), sub(C, A))) / 2;
    const points = [A, B, C, D, E, F, P, Q, R, M, Pp, Qp, Rp, G, Iabc,
      circleA.center, circleB.center, circleC.center, circleI.center, ...excircles.map((x) => x.center)];
    // Java's NearestPoint returns p instead of a projection below SqDist 0.1.
    const guards = [
      [E, circleA.center], [F, circleA.center], [A, circleA.center],
      [D, circleB.center], [F, circleB.center], [B, circleB.center],
      [D, circleC.center], [E, circleC.center], [C, circleC.center],
      [E, circleI.center], [F, circleI.center], [D, circleI.center],
    ];
    const valid = area > 1e-6 && points.every(finite)
      && [circleA, circleB, circleC, circleI, ...excircles].every((c) => Number.isFinite(c.radius) && c.radius > 1e-6)
      && guards.every(([p, q]) => sqDist(p, q) >= 0.1)
      && d > 1e-3 && e > 1e-3 && f > 1e-3;

    return {
      A, B, C, D, E, F, P, Q, R, M, G, Pp, Qp, Rp, Iabc,
      circleA, circleB, circleC, circleI, excircles,
      sides: { d, e, f, s }, area, valid,
    };
  }

  /* ------------------------------------ claims ------------------------------------ */

  /** Barycentric combination of D,E,F with weights u,v,w. */
  function bary(D, E, F, u, v, w) {
    const t = u + v + w;
    return {
      x: (u * D.x + v * E.x + w * F.x) / t,
      y: (u * D.y + v * E.y + w * F.y) / t,
    };
  }

  /** Barycentric coordinates of p in DEF, normalised to sum 1. */
  function baryCoords(p, D, E, F) {
    const ax = D.x - F.x, ay = D.y - F.y;
    const bx = E.x - F.x, by = E.y - F.y;
    const det = ax * by - bx * ay;
    if (Math.abs(det) < EPS) return null;
    const px = p.x - F.x, py = p.y - F.y;
    const u = (px * by - bx * py) / det;
    const v = (ax * py - px * ay) / det;
    return { u, v, w: 1 - u - v };
  }

  /** True when p lies on the infinite line qr (relative to the diagram's size). */
  function onLine(p, q, r, tol, size) {
    const len = dist(q, r);
    if (len < EPS) return false;
    return Math.abs(cross(sub(p, q), sub(r, q))) / len <= tol * size;
  }

  /**
   * Check every statement on the page, plus the proof's intermediate steps.
   * Returns null for a flat triangle where the applet's own guards fail.
   */
  function claims(state, tolerance) {
    const m = compute(state);
    if (!m.valid) return null;
    const tol = tolerance === undefined ? 1e-6 : tolerance;
    const { D, E, F, P, Q, R, M, G, Pp, Qp, Rp, Iabc } = m;
    const { d, e, f, s } = m.sides;
    const size = Math.max(d, e, f);
    const close = (a, b) => Math.abs(a - b) <= tol * size;
    const near = (p, q) => dist(p, q) <= tol * size;

    // The page's three equal-tangent identities.
    const ERFQ = close(dist(E, R), dist(F, Q));
    const DRFP = close(dist(D, R), dist(F, P));
    const DQEP = close(dist(D, Q), dist(E, P));

    // The perimeter-splitter statement EF + ER = DF + DR, and its two siblings.
    const splitP = close(d + dist(E, R), e + dist(D, R));
    const splitQ = close(e + dist(F, P), f + dist(E, P));
    const splitR = close(f + dist(D, Q), d + dist(F, Q));

    // Ceva: M = DP n EQ, with FR passing through the same point. The applet's
    // Intersect returns NaN when two of those lines are nearly parallel, so a
    // guarded cross-check only counts when Java would have returned a point.
    const crossEQFR = intersect(E, Q, F, R);
    const crossFRDP = intersect(F, R, D, P);
    const concurrence = onLine(M, D, P, tol, size) && onLine(M, E, Q, tol, size)
      && onLine(M, F, R, tol, size)
      && (!finite(crossEQFR) || near(M, crossEQFR))
      && (!finite(crossFRDP) || near(M, crossFRDP));

    // M is the Nagel point of DEF: barycentrics (s-d : s-e : s-f).
    const nagel = near(M, bary(D, E, F, s - d, s - e, s - f));
    // The Nagel point of DEF is the incenter of the anticomplementary ABC.
    const anticomplementary = near(M, Iabc);

    // P, Q, R are the excircle touch points on EF, DF, DE.
    const exTouch =
      near(P, m.excircles[0].foot) && near(Q, m.excircles[1].foot) && near(R, m.excircles[2].foot);
    const touchLengths = close(dist(E, P), s - f) && close(dist(F, P), s - e)
      && close(dist(D, Q), s - f) && close(dist(F, Q), s - d)
      && close(dist(D, R), s - e) && close(dist(E, R), s - d);

    // The incircle contacts P', Q', R' are the isotomic reflections of P,Q,R.
    const isotomic = near(add(P, Pp), add(E, F)) && near(add(Q, Qp), add(D, F))
      && near(add(R, Rp), add(D, E));
    // G = D-Pp n E-Qp is the Gergonne point (1/(s-d) : 1/(s-e) : 1/(s-f)).
    const gergonne = near(G, bary(D, E, F, 1 / (s - d), 1 / (s - e), 1 / (s - f)))
      && onLine(G, F, Rp, tol, size);
    // Nagel and Gergonne are isotomic conjugates: take M's own barycentric
    // coordinates, invert them, and compare with the drawn G.
    const coords = baryCoords(M, D, E, F);
    const conjugates = Boolean(coords)
      && near(bary(D, E, F, 1 / coords.u, 1 / coords.v, 1 / coords.w), G);

    // The three little incircles really touch EF, DF, DE at P, Q, R.
    const tangency = onLine(P, E, F, tol, size) && onLine(Q, D, F, tol, size)
      && onLine(R, D, E, tol, size)
      && Math.abs(dot(sub(P, m.circleA.center), sub(F, E))) <= tol * size * size
      && Math.abs(dot(sub(Q, m.circleB.center), sub(F, D))) <= tol * size * size
      && Math.abs(dot(sub(R, m.circleC.center), sub(E, D))) <= tol * size * size;

    const all = ERFQ && DRFP && DQEP && splitP && splitQ && splitR && concurrence
      && nagel && anticomplementary && exTouch && touchLengths && isotomic
      && gergonne && conjugates && tangency;

    return {
      valid: true, ERFQ, DRFP, DQEP, splitP, splitQ, splitR, concurrence,
      nagel, anticomplementary, exTouch, touchLengths, isotomic, gergonne,
      conjugates, tangency, all,
    };
  }

  return {
    WIDTH, HEIGHT, GAP, ANGLE,
    DEFAULT_SHOW_NAMES, DEFAULT_SHOW_INCIRCLE, DEFAULT_SHOW_HINT, DEFAULT_SHOW_EXTRA,
    start, reset, withPoint, withOption, compute, claims,
    // Geometry helpers are exported so the logic test can compare them.
    add, sub, scale, dot, cross, dist, sqDist, finite, midpoint, normal,
    angleAt, orientation, rotate, intersect, findIncenter, findExcenter,
    nearestPoint, incircle, bary, baryCoords, onLine,
  };
})();
