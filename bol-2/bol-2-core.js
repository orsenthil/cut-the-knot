"use strict";

/*
 * BOL2 — Proposition 2 of Archimedes' Book of Lemmas, from Bogomolny's BOL2
 * applet (as embedded on the cut-the-knot BOL2 page until it was replaced by a
 * GeoGebra figure).
 *
 * AB is a diameter of a semicircle, D is a point on the arc, the tangents at B
 * and D meet at T, DE is perpendicular to AB, and AT meets DE at F. The claim
 * to suggest is DF = FE: F is the midpoint of the perpendicular from D. The
 * proof on the page also uses H = AD ∩ (tangent at B), TB = TD and TH = TB.
 *
 * The one idea the code relies on is the line construction in the applet:
 * every point is an intersection of two lines (NearestPoint and Intersect),
 * and the tangent at D is the line through D perpendicular to the radius OD
 * (the applet's GetPerp). From these, F always lands halfway between D and E.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, Bol2Core, so the page loads it with a plain
 * <script> and porting/check-bol-2.mjs loads it in Node. All positions are
 * plain data and are never changed by the functions here.
 */
const Bol2Core = (() => {
  const EPS = 1e-9;

  /* The original lets D run over the whole upper semicircle. Near A the two
   * tangents meet arbitrarily far away, so the kept arc stops a little short
   * of both ends to keep T and the hint circle inside the picture. */
  const MIN_THETA = 0.25;
  const MAX_THETA = 2.4;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  /** GeoSDoub.NearestPoint: foot of the perpendicular from p onto line ab. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.Intersect: where line ab meets line cd (null if parallel). */
  function intersect(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const det = rx * sy - ry * sx;
    if (Math.abs(det) < EPS) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / det;
    return { x: a.x + rx * t, y: a.y + ry * t };
  }

  /** A point at angle theta on the upper arc: theta = 0 at B, PI at A. */
  function arcPoint(center, radius, theta) {
    return {
      x: center.x + radius * Math.cos(theta),
      y: center.y - radius * Math.sin(theta),
    };
  }

  /** The angle of a point measured from B along the upper arc. */
  function arcAngle(p, center) {
    let theta = -Math.atan2(p.y - center.y, p.x - center.x);
    if (theta < 0) theta = p.x < center.x ? Math.PI : 0; // below AB
    return Math.max(0, Math.min(Math.PI, theta));
  }

  /** Where a dragged point lands on the arc the page shows. */
  function clampToArc(p, center, radius) {
    const theta = Math.max(MIN_THETA, Math.min(MAX_THETA, arcAngle(p, center)));
    return arcPoint(center, radius, theta);
  }

  /**
   * The starting diagram, laid out in viewBox units (not screen pixels).
   * A and B may be supplied explicitly; D may be supplied as a point or as an
   * angle. The three "Show" switches match the applet's checkboxes, with
   * names on (the archived page passes ShowNames=1) and hint/statement off.
   */
  function start(options) {
    const o = options || {};
    const A = o.A ? { x: o.A.x, y: o.A.y } : { x: 60, y: 270 };
    const B = o.B ? { x: o.B.x, y: o.B.y } : { x: 360, y: 270 };
    const center = midpoint(A, B);
    const radius = distance(A, B) / 2;
    let theta = o.theta === undefined ? 1.05 : o.theta;
    if (o.D) theta = arcAngle(o.D, center);
    theta = Math.max(MIN_THETA, Math.min(MAX_THETA, theta));
    return {
      A, B,
      D: arcPoint(center, radius, theta),
      theta,
      showNames: o.showNames === undefined ? true : Boolean(o.showNames),
      showHint: Boolean(o.showHint),
      showStatement: Boolean(o.showStatement),
    };
  }

  /** All the points and lengths of the current diagram. */
  function measurements(state) {
    const A = state.A, B = state.B, D = state.D;
    const O = midpoint(A, B);
    const radius = distance(A, B) / 2;
    const theta = arcAngle(D, O);

    // E is the nearest point of AB to D, i.e. the foot of DE.
    const E = foot(D, A, B);

    // The tangent at B is perpendicular to AB; the tangent at D is
    // perpendicular to OD (BOL2Canvas.GetPerp of the centre and D).
    const perpB = { x: -(B.y - A.y), y: B.x - A.x };
    const perpD = { x: -(D.y - O.y), y: D.x - O.x };
    const tangentBEnd = { x: B.x + perpB.x, y: B.y + perpB.y };
    const tangentDEnd = { x: D.x + perpD.x, y: D.y + perpD.y };

    const T = intersect(B, tangentBEnd, D, tangentDEnd);
    const F = T ? intersect(A, T, D, E) : null;
    const H = intersect(A, D, B, tangentBEnd);

    const DF = F ? distance(D, F) : null;
    const FE = F ? distance(F, E) : null;
    return {
      A, B, O, radius, theta, D, E, T, F, H,
      TB: T ? distance(T, B) : null,
      TD: T ? distance(T, D) : null,
      TH: T && H ? distance(T, H) : null,
      DF, FE, DE: distance(D, E),
      ratio: DF && FE ? DF / FE : null,
      onArc: Math.abs(distance(O, D) - radius) < 1e-7,
    };
  }

  /** Every claim made on the applet's page, checked at this configuration. */
  function claims(state) {
    const m = measurements(state);
    const tol = 1e-7 * Math.max(1, m.radius);
    const { A, B, D, E, F, T, H } = m;
    if (!F || !T || !H) return null;
    const crossVec = (u, v) => u.x * v.y - u.y * v.x;
    const parallel = (p, q, r, s) =>
      Math.abs(crossVec(
        { x: q.x - p.x, y: q.y - p.y },
        { x: s.x - r.x, y: s.y - r.y },
      )) < tol * m.radius;
    const onLine = (p, a, b) => Math.abs(cross(a, b, p)) < tol;
    const between = (p, a, b) =>
      Math.abs(distance(a, p) + distance(p, b) - distance(a, b)) < tol;
    const rightAtD = Math.abs(
      (A.x - D.x) * (B.x - D.x) + (A.y - D.y) * (B.y - D.y),
    ) < tol * tol;
    return {
      onArc: m.onArc,
      DEperpendicular: onLine(E, A, B) &&
        Math.abs((D.x - E.x) * (B.x - A.x) + (D.y - E.y) * (B.y - A.y)) < tol * m.radius,
      tangentsMeet: onLine(T, B, { x: B.x - (B.y - A.y), y: B.y + (B.x - A.x) }) &&
        Math.abs(dotRadius(m, T)) < tol * m.radius,
      tangentLengths: Math.abs(m.TB - m.TD) < tol,
      FOnLines: onLine(F, D, E) && between(F, D, E) && onLine(F, A, T),
      bisected: Math.abs(m.DF - m.FE) < tol && Math.abs(m.DF - m.DE / 2) < tol,
      rightAngleADB: rightAtD,
      hintSemicircle: Math.abs(m.TH - m.TB) < tol && Math.abs(m.TD - m.TB) < tol,
      parallelDE_BH: parallel(D, E, B, H),
    };
  }

  /** The radius DT dotted with DT-T: zero exactly when T lies on the tangent at D. */
  function dotRadius(m, T) {
    const u = { x: m.D.x - m.O.x, y: m.D.y - m.O.y };
    const v = { x: T.x - m.D.x, y: T.y - m.D.y };
    return u.x * v.x + u.y * v.y;
  }

  /** A new position with one of the three visible points moved. */
  function withPoint(state, name, p) {
    const A = { x: state.A.x, y: state.A.y };
    const B = { x: state.B.x, y: state.B.y };
    if (name === "A") A.x = Math.min(p.x, B.x - 60);
    if (name === "B") B.x = Math.max(p.x, A.x + 60);
    const O = midpoint(A, B);
    const radius = distance(A, B) / 2;
    const raw = name === "D" ? arcAngle(p, O) : state.theta;
    const theta = Math.max(MIN_THETA, Math.min(MAX_THETA, raw));
    return {
      ...state, A, B,
      D: arcPoint(O, radius, theta),
      theta,
    };
  }

  /** Nothing can be won or lost in an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    MIN_THETA, MAX_THETA,
    distance, midpoint, foot, intersect, arcPoint, arcAngle, clampToArc,
    start, measurements, claims, withPoint, result,
  };
})();
