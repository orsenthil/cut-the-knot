"use strict";

/*
 * Feuerbach Treasure — the geometry behind Bogomolny's applet of the same name.
 *
 * Move the three corners A, B, C of a triangle. H is its orthocenter, so each
 * of A, B, C is the orthocenter of the triangle formed by the other three
 * points. The four triangles ABC, ABH, BCH and CAH therefore share one
 * nine-point circle. Feuerbach's theorem says that the nine-point circle of a
 * triangle touches its incircle and its three excircles, so in this picture
 * one circle touches sixteen others (in general: a right angle collapses two
 * of the triangles, leaving fewer distinct circles).
 *
 * The one idea the code relies on: put the sides a,b,c opposite A,B,C and use
 * signed side lengths as barycentric weights. The incenter is
 * (aA+bB+cC)/(a+b+c); the excircle opposite A has centre
 * (-aA+bB+cC)/(-a+b+c) and radius area/(s-a). The nine-point circle is the
 * circumcircle of the triangle of side midpoints. A tangency point is the
 * point on the small circle nearest to (or, for the incircle, farthest from)
 * the nine-point centre, scaled by the ratio of the two radii.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, FeuerbachTreasureCore, so the page loads it
 * with a plain <script> and porting/check-feuerbach-treasure.mjs loads it in
 * Node. All functions take plain data and return new objects; nothing passed
 * in is changed.
 */
const FeuerbachTreasureCore = (() => {
  const EPS = 1e-9;
  const TRIANGLES = ["ABC", "ABH", "BCH", "CAH"];

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const doubleArea = (p, q, r) => Math.abs(cross(p, q, r));

  /** The foot of the perpendicular from p to the infinite line through a,b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Intersection of the infinite lines ab and cd, or null if parallel. */
  function lineIntersection(a, b, c, d) {
    const r = { x: b.x - a.x, y: b.y - a.y };
    const s = { x: d.x - c.x, y: d.y - c.y };
    const det = r.x * s.y - r.y * s.x;
    if (Math.abs(det) < EPS) return null;
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / det;
    return { x: a.x + r.x * t, y: a.y + r.y * t };
  }

  /** Circumcentre from the two perpendicular bisectors of pq and qr. */
  function circumcenter(p, q, r) {
    const m1 = midpoint(p, q), m2 = midpoint(q, r);
    const u = { x: m1.x + q.y - p.y, y: m1.y - (q.x - p.x) };
    const v = { x: m2.x + r.y - q.y, y: m2.y - (r.x - q.x) };
    return lineIntersection(m1, u, m2, v);
  }

  /** The orthocentre: two altitudes are enough. */
  function orthocenter(p, q, r) {
    return lineIntersection(p, foot(p, q, r), q, foot(q, r, p));
  }

  /** The nine-point circle: circumcircle of the three side midpoints. */
  function ninePointCircle(p, q, r) {
    const m = [midpoint(q, r), midpoint(r, p), midpoint(p, q)];
    const c = circumcenter(m[0], m[1], m[2]);
    if (!c) return null;
    return { c, r: (distance(c, m[0]) + distance(c, m[1]) + distance(c, m[2])) / 3 };
  }

  /** Everything the applet draws for one of its four triangles. */
  function triangleData(p, q, r) {
    const a = distance(q, r), b = distance(r, p), c = distance(p, q);
    const area2 = doubleArea(p, q, r);
    if (area2 < 1e-7 || Math.min(a, b, c) < EPS) return null;
    const s = (a + b + c) / 2, area = area2 / 2;
    const I = {
      x: (a * p.x + b * q.x + c * r.x) / (a + b + c),
      y: (a * p.y + b * q.y + c * r.y) / (a + b + c),
    };
    const incircle = { c: I, r: area / s };
    const excenters = [
      { x: (-a * p.x + b * q.x + c * r.x) / (-a + b + c), y: (-a * p.y + b * q.y + c * r.y) / (-a + b + c) },
      { x: (a * p.x - b * q.x + c * r.x) / (a - b + c), y: (a * p.y - b * q.y + c * r.y) / (a - b + c) },
      { x: (a * p.x + b * q.x - c * r.x) / (a + b - c), y: (a * p.y + b * q.y - c * r.y) / (a + b - c) },
    ];
    const exradii = [area / (s - a), area / (s - b), area / (s - c)];
    const excircles = excenters.map((cen, i) => ({ c: cen, r: exradii[i] }));
    return {
      vertices: [p, q, r],
      sides: { a, b, c },
      area,
      incircle,
      excircles,
      ninePoint: ninePointCircle(p, q, r),
      feet: [foot(p, q, r), foot(q, r, p), foot(r, p, q)],
    };
  }

  /**
   * Where the two circles touch. The applet extrapolates from the small
   * circle's centre towards the nine-point centre by radius/distance: plus for
   * the externally tangent excircles, minus for the internally tangent
   * incircle (that is the point diametrically opposite on the small circle).
   */
  function tangency(npc, circle, internal) {
    const d = distance(npc.c, circle.c);
    if (!Number.isFinite(d) || d < EPS) return null;
    const t = circle.r / d;
    return internal
      ? { x: circle.c.x - t * (npc.c.x - circle.c.x), y: circle.c.y - t * (npc.c.y - circle.c.y) }
      : { x: circle.c.x + t * (npc.c.x - circle.c.x), y: circle.c.y + t * (npc.c.y - circle.c.y) };
  }

  /** The position a new drawing starts from, using the applet's angle seeds. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C },
        show: { ...(o.show || { ABC: false, ABH: false, BCH: false, CAH: false }) },
        names: Boolean(o.names),
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 280 : o.height;
    const radius = Math.min(width, height) / 4;
    const center = { x: width / 2, y: height / 2 };
    const at = (angle) => ({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
    return {
      A: at(-1.6), B: at(-4.0), C: at(-0.2),
      show: { ABC: false, ABH: false, BCH: false, CAH: false },
      names: false,
    };
  }

  /** A new position with one named corner moved. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C }, show: { ...s.show }, names: s.names };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** The applet's checkboxes: four triangles and the name labels. */
  function toggle(s, key) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C }, show: { ...s.show }, names: s.names };
    if (key === "names") next.names = !s.names;
    else if (Object.prototype.hasOwnProperty.call(next.show, key)) next.show[key] = !s.show[key];
    return next;
  }

  /** Turn all four triangle checkboxes on or off at once. */
  function setAll(s, on) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C }, show: { ...s.show }, names: s.names };
    for (const key of TRIANGLES) next.show[key] = Boolean(on);
    return next;
  }

  /** All geometry the page needs: the shared circle, four triangles, 16 circles. */
  function measurements(s) {
    const H = orthocenter(s.A, s.B, s.C);
    const npc = ninePointCircle(s.A, s.B, s.C);
    const byKey = H ? {
      ABC: triangleData(s.A, s.B, s.C),
      ABH: triangleData(s.A, s.B, H),
      BCH: triangleData(s.B, s.C, H),
      CAH: triangleData(s.C, s.A, H),
    } : { ABC: triangleData(s.A, s.B, s.C), ABH: null, BCH: null, CAH: null };
    const triangles = [];
    for (const key of TRIANGLES) {
      const data = byKey[key];
      if (!data || !npc) continue;
      const circles = [
        { kind: "incircle", circle: data.incircle, internal: true,
          point: tangency(npc, data.incircle, true) },
      ];
      data.excircles.forEach((circle, i) => {
        circles.push({ kind: `excircle${i + 1}`, circle, internal: false,
          point: tangency(npc, circle, false) });
      });
      triangles.push({ key, data, circles });
    }
    return {
      A: s.A, B: s.B, C: s.C, H,
      npc,
      triangles,
      degenerate: !npc || triangles.length !== TRIANGLES.length,
      visible: TRIANGLES.filter((key) => s.show[key]),
      totalCircles: triangles.reduce((n, t) => n + t.circles.length, 0),
    };
  }

  /** The circles as a flat list, with the triangle that owns each one. */
  function allCircles(m) {
    return m.triangles.flatMap((t) => t.circles.map((entry) => ({
      owner: t.key, kind: entry.kind, internal: entry.internal,
      circle: entry.circle, point: entry.point,
    })));
  }

  /** Distinct circles within `tol`, as the page's "sixteen" claim requires. */
  function distinctCircles(m, tol) {
    const limit = tol === undefined ? 1e-5 : tol;
    const unique = [];
    for (const entry of allCircles(m)) {
      if (!unique.some((u) => distance(u.circle.c, entry.circle.c) < limit &&
          Math.abs(u.circle.r - entry.circle.r) < limit)) unique.push(entry);
    }
    return unique;
  }

  /** Every claim on the applet's page, checked numerically at this position. */
  function claims(s) {
    const m = measurements(s);
    const bad = {
      orthocentric: false, ninePoints: false, sharedNinePointCircle: false,
      feuerbachTangency: false, tangencyPoints: false, sixteenCircles: false,
    };
    if (!m.npc || !m.H) return bad;
    const scale = Math.max(1, m.npc.r);
    const tol = 1e-6 * scale;
    const closeP = (p, q) => Boolean(p && q && distance(p, q) <= tol);
    const onCircle = (p, circle) => p && Math.abs(distance(circle.c, p) - circle.r) <= tol;

    // Each point of the orthocentric quadruple is the orthocentre of the other
    // three; this is what makes all four nine-point circles the same circle.
    const orthocentric =
      closeP(orthocenter(s.B, s.C, m.H), s.A) &&
      closeP(orthocenter(s.C, s.A, m.H), s.B) &&
      closeP(orthocenter(s.A, s.B, m.H), s.C);

    // Midpoints, altitude feet and Euler points all lie on the one circle.
    const mid = [midpoint(s.B, s.C), midpoint(s.C, s.A), midpoint(s.A, s.B)];
    const feet = [foot(s.A, s.B, s.C), foot(s.B, s.C, s.A), foot(s.C, s.A, s.B)];
    const euler = [s.A, s.B, s.C].map((p) => midpoint(p, m.H));
    const ninePoints = [...mid, ...feet, ...euler].every((p) => onCircle(p, m.npc));

    const shared = m.triangles.every((t) => t.data.ninePoint &&
      closeP(t.data.ninePoint.c, m.npc.c) && Math.abs(t.data.ninePoint.r - m.npc.r) <= tol);

    const circles = allCircles(m);
    const tangent = circles.every((entry) => {
      const d = distance(m.npc.c, entry.circle.c);
      const expected = entry.internal ? m.npc.r - entry.circle.r : m.npc.r + entry.circle.r;
      return Number.isFinite(d) && Math.abs(d - expected) <= tol;
    });
    const pointsOk = circles.every((entry) =>
      onCircle(entry.point, entry.circle) && onCircle(entry.point, m.npc));

    return {
      orthocentric,
      ninePoints,
      sharedNinePointCircle: shared,
      feuerbachTangency: tangent && circles.length === 16,
      tangencyPoints: pointsOk && circles.length === 16,
      sixteenCircles: distinctCircles(m, tol).length === 16,
    };
  }

  /** An illustration: there is nothing to win or lose. */
  function result(/* state */) {
    return null;
  }

  return {
    TRIANGLES, EPS, distance, midpoint, cross, doubleArea, foot, lineIntersection,
    circumcenter, orthocenter, ninePointCircle, triangleData, tangency,
    start, withPoint, toggle, setAll, measurements, allCircles, distinctCircles,
    claims, result,
  };
})();
