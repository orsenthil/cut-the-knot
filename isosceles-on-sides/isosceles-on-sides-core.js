"use strict";

/*
 * Isosceles On Sides — the geometry behind Bogomolny's applet IsoscelesOnSides.
 *
 * On the sides of a triangle ABC stand three isosceles triangles: AFB on AB,
 * BDC on BC and CEA on CA. Their third vertices D, E, F sit on the
 * perpendicular bisectors of the sides, so DB = DC, EC = EA and FA = FB. The
 * page claims that the perpendicular through A to EF, through B to FD and
 * through C to DE all pass through one point.
 *
 * The one idea the code relies on: a point equally far from two vertices lies
 * on their perpendicular bisector. Grow three circles centred at D, E, F
 * through the pairs of vertices they are equidistant from. Each perpendicular
 * is then the common chord (radical axis) of a pair of circles, and the three
 * radical axes meet at their radical centre.
 *
 * Every formula below follows IsoscelesOnSidesCanvas and its AttachedPoint
 * inner class: offsets 50/40/60 from the side midpoints, a sign that flips when
 * the point is dragged across a side, and a 200-unit ray for the perpendiculars.
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, IsoscelesOnSidesCore, so the page loads it with a plain
 * <script> and porting/check-isosceles-on-sides.mjs loads it in Node. All
 * positions are plain data and no function changes the object it is given.
 */
const IsoscelesOnSidesCore = (() => {
  const EPS = 1e-9;
  const SIDES = { D: ["B", "C"], E: ["C", "A"], F: ["A", "B"] };
  const DEFAULT_OFFSETS = { D: 50, E: 40, F: 60 };

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  /* IsoscelesOnSidesCanvas.Perp: the unit left-hand normal of p -> q in
     screen coordinates (y grows downwards), with a guard for zero length. */
  function unitPerp(p, q) {
    const dy = q.y - p.y;
    const dx = q.x - p.x;
    const len = Math.sqrt(dy * dy + dx * dx);
    if (len < EPS) return { x: 0, y: 0 };
    return { x: -dy / len, y: dx / len };
  }

  /* IsoscelesOnSidesCanvas.PerpP(base, from, to, d): a point d units along the
     normal of from -> to starting at base. */
  function perpPoint(base, from, to, d) {
    const v = unitPerp(from, to);
    return { x: base.x + d * v.x, y: base.y + d * v.y };
  }

  /* The cross product used by GeoSDoub.FindOrientation. */
  function orientation(x, p, q) {
    const cross = (x.x * (p.y - q.y) + x.y * (q.x - p.x) +
      p.x * q.y - q.x * p.y);
    return cross > 0 ? 1 : -1;
  }

  /* IsoscelesOnSidesCanvas$AttachedPoint.Maintain: the midpoint plus the
     offset along the perpendicular, on the side recorded by the sign. */
  function attached(p, q, offset, sign) {
    const m = midpoint(p, q);
    const v = unitPerp(p, q);
    return { x: m.x + sign * offset * v.x, y: m.y + sign * offset * v.y };
  }

  /* GeoSDoub.NearestPoint: project a dragged point onto the line a -> b. */
  function projectOnLine(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  /* GeoSDoub.Intersect(DoubPoint x4): ax+by+c form, NaN if nearly parallel
     (the applet uses a threshold of one user unit on the determinant). */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
  }

  /** Refresh the derived D, E, F from the stored offsets and signs. */
  function refresh(s) {
    return {
      ...s,
      D: attached(s.B, s.C, s.offset.D, s.sign.D),
      E: attached(s.C, s.A, s.offset.E, s.sign.E),
      F: attached(s.A, s.B, s.offset.F, s.sign.F),
    };
  }

  /** The starting picture, placed as IsoscelesOnSidesCanvas.init places it. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const radius = Math.round(Math.min(width, height) / 2.5);
    const A = o.A || {
      x: width / 2 + radius * Math.cos(2.0943951023931953),
      y: height / 2 + radius * Math.sin(2.0943951023931953),
    };
    const B = o.B || {
      x: width / 2 + radius * Math.cos(0.5235987755982988),
      y: height / 2 + radius * Math.sin(0.5235987755982988),
    };
    const C = o.C || {
      x: width / 2 + radius * Math.cos(Math.PI / 2),
      y: height / 2 - radius * Math.sin(Math.PI / 2),
    };
    const s = {
      A: { ...A }, B: { ...B }, C: { ...C },
      offset: { ...DEFAULT_OFFSETS, ...(o.offset || {}) },
      sign: { D: 1, E: 1, F: 1, ...(o.sign || {}) },
    };
    return refresh(s);
  }

  /** Move a named point. Moving A/B/C keeps D,E,F at their stored distances;
      moving D/E/F changes its distance and its side of the line, as the
      applet's AttachedPoint.UpdateLocation does. */
  function withPoint(s, name, p) {
    const next = {
      A: { ...s.A }, B: { ...s.B }, C: { ...s.C },
      offset: { ...s.offset }, sign: { ...s.sign },
    };
    const q = { x: p.x, y: p.y };
    if (name === "A" || name === "B" || name === "C") {
      next[name] = q;
    } else if (SIDES[name]) {
      const [u, v] = SIDES[name].map((k) => next[k]);
      const m = midpoint(u, v);
      const onLine = projectOnLine(q,
        { x: m.x - unitPerp(u, v).x, y: m.y - unitPerp(u, v).y },
        { x: m.x + unitPerp(u, v).x, y: m.y + unitPerp(u, v).y });
      next.offset[name] = distance(m, onLine);
      next.sign[name] = orientation(onLine, u, v);
    } else {
      return s;
    }
    return refresh(next);
  }

  /** The position after a move given as {name, point}. */
  function move(s, m) {
    return m && m.name ? withPoint(s, m.name, m.point || m) : null;
  }

  /* The three circles used in the hint and the proof. */
  function circles(s) {
    return {
      D: { c: s.D, r: distance(s.D, s.B), name: "D" },
      E: { c: s.E, r: distance(s.E, s.C), name: "E" },
      F: { c: s.F, r: distance(s.F, s.A), name: "F" },
    };
  }

  /** Intersections of two circles, in the same order GeoSDoub uses: point
      with the smaller x first. Returns [] when they do not meet. */
  function circleIntersections(c1, r1, c2, r2) {
    const dist = distance(c1, c2);
    if (dist < EPS || dist > r1 + r2 || dist < Math.abs(r1 - r2)) return [];
    const a = (r1 * r1 - r2 * r2 + dist * dist) / (2 * dist);
    const h2 = r1 * r1 - a * a;
    if (h2 < 0) return [];
    const ux = (c2.x - c1.x) / dist, uy = (c2.y - c1.y) / dist;
    const base = { x: c1.x + a * ux, y: c1.y + a * uy };
    const h = Math.sqrt(h2);
    const one = { x: base.x - h * uy, y: base.y + h * ux };
    const two = { x: base.x + h * uy, y: base.y - h * ux };
    return h < EPS ? [one] : one.x <= two.x ? [one, two] : [two, one];
  }

  /** IsoscelesOnSidesCanvas.Other: pick the intersection that is not `known`.
      The applet decides by a one-unit distance from its first intersection. */
  function other(points, known) {
    if (points.length < 2) return points[0] || null;
    return distance(points[0], known) > 1 ? points[0] : points[1];
  }

  /** The genuinely other intersection, for drawing the hint. */
  function secondPoint(points, known) {
    if (!points || !points.length) return null;
    if (points.length === 1) return points[0];
    return distance(points[0], known) >= distance(points[1], known) ? points[0] : points[1];
  }

  /** Every line and point the picture needs, using the applet's constructions. */
  function measure(s) {
    const A = s.A, B = s.B, C = s.C, D = s.D, E = s.E, F = s.F;
    const rayA = perpPoint(A, E, F, 200);
    const rayB = perpPoint(B, D, F, 200);
    const rayC = perpPoint(C, D, E, 200);
    const P = intersect(A, rayA, B, rayB);
    const cs = circles(s);
    const second = {
      A: secondPoint(circleIntersections(cs.E.c, cs.E.r, cs.F.c, cs.F.r), A),
      B: secondPoint(circleIntersections(cs.F.c, cs.F.r, cs.D.c, cs.D.r), B),
      C: secondPoint(circleIntersections(cs.D.c, cs.D.r, cs.E.c, cs.E.r), C),
    };
    return {
      A, B, C, D, E, F,
      rays: { A: rayA, B: rayB, C: rayC },
      P,
      sides: { AB: distance(A, B), BC: distance(B, C), CA: distance(C, A) },
      radii: { D: cs.D.r, E: cs.E.r, F: cs.F.r },
      circles: cs,
      second,
      feet: {
        A: intersect(A, rayA, E, F),
        B: intersect(B, rayB, F, D),
        C: intersect(C, rayC, D, E),
      },
      powers: {
        D: distance(P, D) ** 2 - cs.D.r ** 2,
        E: distance(P, E) ** 2 - cs.E.r ** 2,
        F: distance(P, F) ** 2 - cs.F.r ** 2,
      },
    };
  }

  /** The page's statement, checked numerically at this configuration. */
  function claims(s) {
    const m = measure(s);
    const scale = Math.max(m.sides.AB, m.sides.BC, m.sides.CA, 1);
    const tol = 1e-7 * scale;
    const onLine = (p, a, b) => {
      const len = distance(a, b);
      return Number.isFinite(p.x) && len > EPS &&
        Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len <= tol;
    };
    const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
    const legs = {
      D: Math.abs(distance(m.D, m.B) - distance(m.D, m.C)),
      E: Math.abs(distance(m.E, m.C) - distance(m.E, m.A)),
      F: Math.abs(distance(m.F, m.A) - distance(m.F, m.B)),
    };
    const isosc = Object.values(legs).every((d) => d <= tol);
    const atRightAngle = (vertex, ray, p, q) => {
      const u = { x: ray.x - vertex.x, y: ray.y - vertex.y };
      const v = { x: q.x - p.x, y: q.y - p.y };
      const norm = distance(vertex, ray) * distance(p, q);
      return norm <= EPS || Math.abs(u.x * v.x + u.y * v.y) <= tol * norm;
    };
    const rightAngles =
      atRightAngle(m.A, m.rays.A, m.E, m.F) &&
      atRightAngle(m.B, m.rays.B, m.F, m.D) &&
      atRightAngle(m.C, m.rays.C, m.D, m.E);
    const perpendicular = rightAngles && onLine(m.feet.A, m.A, m.rays.A) &&
      onLine(m.feet.B, m.B, m.rays.B) && onLine(m.feet.C, m.C, m.rays.C) &&
      onLine(m.feet.A, m.E, m.F) && onLine(m.feet.B, m.F, m.D) &&
      onLine(m.feet.C, m.D, m.E);
    const concurrent = finite(m.P) && onLine(m.P, m.A, m.rays.A) &&
      onLine(m.P, m.B, m.rays.B) && onLine(m.P, m.C, m.rays.C);
    const powers = Object.values(m.powers);
    const radical = finite(m.P) && Math.max(...powers) - Math.min(...powers) <= tol * scale;
    const secondOnLines =
      (!finite(secondOf(m.second.A)) || onLine(m.second.A, m.A, m.rays.A)) &&
      (!finite(secondOf(m.second.B)) || onLine(m.second.B, m.B, m.rays.B)) &&
      (!finite(secondOf(m.second.C)) || onLine(m.second.C, m.C, m.rays.C));
    return {
      isosceles: isosc, perpendicular, concurrent, radicalCenter: radical,
      secondIntersections: secondOnLines,
      all: isosc && perpendicular && concurrent && radical && secondOnLines,
    };
  }

  function secondOf(p) {
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    start, refresh, withPoint, move, attached, unitPerp, perpPoint, projectOnLine,
    orientation, intersect, distance, midpoint, circles, circleIntersections,
    other, secondPoint, measure, claims, result, SIDES, DEFAULT_OFFSETS,
  };
})();
