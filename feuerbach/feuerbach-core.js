"use strict";

/*
 * Feuerbach, from Alexander Bogomolny's applet Feurebach
 * (cut-the-knot.org/Curriculum/Geometry/Feuerbach.shtml; the 2006 archive
 * snapshot of that page embeds CODE="Feurebach" twice).
 *
 * The page's claim is that the nine-point circle of a triangle touches its
 * incircle and its three excircles. The applet draws the triangle, and, when
 * "circles" is ticked, the red incircle, three red excircles and the magenta
 * nine-point circle, with a dot at each of the four touches. Its own method
 * is algebraic: FindIncenter/FindExcenter give the four centres, each radius
 * is the mean of the distances from that centre to the three side lines, and
 * DrawNPC takes the circumcircle of the three side midpoints. ShowPoint puts
 * a dot on a circle along the line of centres, using the ratio radius/distance.
 *
 * No DOM, no storage: the position is plain data, so it can be saved for the
 * player's record and handed to the tutor unchanged.
 */
const FeuerbachCore = (() => {
  /** The applet advertises 400 by 250 as its optimal size. */
  const VIEW = { width: 400, height: 250 };
  const MARGIN = 10;

  /** init(): centre + min(W,H)/4 at angles -1.6, -4.0 and -0.2 radians. */
  const START_ANGLES = { A: -1.6, B: -4.0, C: -0.2 };

  const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const sqDist = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  function clampToBoard(p) {
    return {
      x: Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      y: Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
    };
  }

  /* ---------------- the GeoSDoub calls the applet makes, in its order ---- */

  /** GeoSDoub.ComputeAngle(p,q,r): the angle at p, in radians. */
  function computeAngle(p, q, r) {
    const c = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) /
      (2 * dist(p, q) * dist(p, r));
    return Math.acos(c);
  }

  /** GeoSDoub.FindOrientation: +1 for one winding, -1 for the other. */
  function findOrientation(p, q, r) {
    const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return v > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(centre, point, angle, direction). */
  function rotate(centre, point, angle, direction) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return {
      x: centre.x + c * (point.x - centre.x) - direction * s * (point.y - centre.y),
      y: centre.y + direction * s * (point.x - centre.x) + c * (point.y - centre.y),
    };
  }

  /** GeoSDoub.Intersect of two infinite lines; NaN when |denominator| < 1. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
  }

  /** GeoSDoub.FindIncenter: the two internal bisectors at A and B. */
  function findIncenter(A, B, C) {
    const dir = findOrientation(A, B, C);
    const halfA = computeAngle(A, B, C) / 2;
    const halfB = computeAngle(B, C, A) / 2;
    return intersect(rotate(A, B, halfA, dir), A, rotate(B, C, halfB, dir), B);
  }

  /** GeoSDoub.FindExcenter: external bisectors at B and C, opposite A. */
  function findExcenter(A, B, C) {
    const halfB = (Math.PI - computeAngle(B, A, C)) / 2;
    const halfC = (Math.PI - computeAngle(C, A, B)) / 2;
    const dir = findOrientation(B, A, C);
    return intersect(rotate(B, C, halfB, dir), B, rotate(C, B, halfC, -dir), C);
  }

  /** GeoSDoub.NearestPoint(p,a,b): the foot on the infinite line a->b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return p;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.FindCircumcenter, as two perpendicular bisectors. */
  function circumcenter(p, q, r) {
    const m1 = mid(p, q), m2 = mid(q, r);
    return intersect(
      m1, { x: m1.x + q.y - p.y, y: m1.y - (q.x - p.x) },
      m2, { x: m2.x + r.y - q.y, y: m2.y - (r.x - q.x) },
    );
  }

  /** Canvas.GetCircle / DrawNPC / DrawExcircle: centre plus the mean radius. */
  function meanCircle(centre, p, q, r) {
    return { center: centre, radius: (dist(centre, p) + dist(centre, q) + dist(centre, r)) / 3 };
  }

  /** The point ShowPoint(g, circle, other) puts on `other`'s circumference. */
  function showTouch(other, circle, away) {
    const d = dist(circle.center, other.center);
    const scale = other.radius / d;
    const sign = away ? -1 : 1;
    return {
      x: other.center.x + sign * (circle.center.x - other.center.x) * scale,
      y: other.center.y + sign * (circle.center.y - other.center.y) * scale,
    };
  }

  /* ----------------------------------------------------------- the state */

  function defaultOptions() {
    // The applet's constructor has all four off; ShowNames is a page
    // parameter (0 on the archived page), exposed here as a checkbox.
    return { medians: false, altitudes: false, circles: false, names: false };
  }

  function start(options) {
    const opts = defaultOptions();
    if (options) for (const k in opts) if (k in options) opts[k] = Boolean(options[k]);
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const r = Math.min(VIEW.width, VIEW.height) / 4;
    const at = (name) => ({
      x: cx + r * Math.cos(START_ANGLES[name]),
      y: cy + r * Math.sin(START_ANGLES[name]),
    });
    return {
      A: at("A"), B: at("B"), C: at("C"),
      options: opts, touches: 0,
    };
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return { ...state, options: { ...state.options, [name]: Boolean(on) } };
  }

  function moveVertex(state, name, point) {
    if (!["A", "B", "C"].includes(name) || !finitePoint(point)) return state;
    return { ...state, [name]: clampToBoard(point), touches: state.touches + 1 };
  }

  /**
   * Everything the applet draws, from the current triangle. `valid` is
   * false for a flat or tiny triangle, so callers never get NaN points.
   */
  function geometry(state) {
    const invalid = { valid: false };
    const { A, B, C } = state;
    if (!finitePoint(A) || !finitePoint(B) || !finitePoint(C)) return invalid;
    const twiceArea = Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x));
    if (twiceArea < 1e-6) return invalid;

    // Draw(): the incircle is FindIncenter(A,B,C) and the mean of its
    // distances to the feet on AB, BC and CA.
    const I = findIncenter(A, B, C);
    const dAB = foot(I, A, B), dBC = foot(I, B, C), dCA = foot(I, C, A);
    const incircle = meanCircle(I, dAB, dBC, dCA);

    // DrawExcircle() is called three times with cyclic orders of the corners.
    const orders = [[A, B, C], [B, C, A], [C, A, B]];
    const excenters = [], excircles = [], exFeet = [];
    for (const [p, q, r] of orders) {
      const J = findExcenter(p, q, r);
      const f1 = foot(J, p, q), f2 = foot(J, q, r), f3 = foot(J, r, p);
      excenters.push(J);
      excircles.push(meanCircle(J, f1, f2, f3));
      exFeet.push([f1, f2, f3]);
    }

    // DrawNPC(): circumcircle of the three side midpoints, mean radius.
    const midBC = mid(B, C), midCA = mid(C, A), midAB = mid(A, B);
    const N = circumcenter(midBC, midCA, midAB);
    const nine = meanCircle(N, midBC, midCA, midAB);

    // ShowPoint(): external touches for excircles, internal for the incircle.
    const touches = [
      showTouch(excircles[0], nine, false),
      showTouch(excircles[1], nine, false),
      showTouch(excircles[2], nine, false),
      showTouch(incircle, nine, true),
    ];

    const all = [I, N, dAB, dBC, dCA, ...excenters, ...touches, midBC, midCA, midAB];
    if (!all.every(finitePoint)) return invalid;
    if (![incircle, ...excircles, nine].every((c) =>
      Number.isFinite(c.radius) && c.radius > 0)) return invalid;

    const O = circumcenter(A, B, C);
    const H = { x: A.x + B.x + C.x - 2 * O.x, y: A.y + B.y + C.y - 2 * O.y };

    return {
      valid: true, A, B, C,
      I, incircle, inradius: incircle.radius,
      excenters, excircles, exradii: excircles.map((c) => c.radius),
      N, nine, nineRadius: nine.radius,
      midpoints: [midBC, midCA, midAB],
      feet: [dAB, dBC, dCA], exFeet,
      touches,
      O, H, circumradius: dist(O, A),
      // ShowPerp(g,colour,p,q,r) joins the foot to p, q and r.
      altitudes: [
        [foot(A, B, C), B], [foot(A, B, C), C], [foot(A, B, C), A],
        [foot(B, C, A), C], [foot(B, C, A), A], [foot(B, C, A), B],
        [foot(C, A, B), A], [foot(C, A, B), B], [foot(C, A, B), C],
      ],
      // ShowMedian(g,colour,p,q,r) joins p to the midpoint of qr.
      medians: [[A, midBC], [B, midCA], [C, midAB]],
      twiceArea,
    };
  }

  /* --------------------------- the page's claims, as testable numbers --- */

  /** IN = R/2 - r for the incircle, IN_a = R/2 + r_a for each excircle. */
  function centreGapErrors(g) {
    if (!g.valid) return [Infinity, Infinity, Infinity, Infinity];
    return [
      Math.abs(dist(g.N, g.I) - (g.nineRadius - g.inradius)),
      ...g.excenters.map((J, i) =>
        Math.abs(dist(g.N, J) - (g.nineRadius + g.exradii[i]))),
    ];
  }

  /** Each ShowPoint dot must lie on both circles it joins. */
  function touchErrors(g) {
    if (!g.valid) return [Infinity, Infinity, Infinity, Infinity];
    const err = (dot, circle) => Math.abs(dist(dot, circle.center) - circle.radius);
    return [
      ...g.touches.slice(0, 3).map((dot, i) =>
        Math.max(err(dot, g.excircles[i]), err(dot, g.nine))),
      Math.max(err(g.touches[3], g.incircle), err(g.touches[3], g.nine)),
    ];
  }

  /** Collinearity of each pair of centres with its dot (cross product). */
  function touchCollinearity(g) {
    if (!g.valid) return [Infinity, Infinity, Infinity, Infinity];
    const cross = (dot, circle) => {
      const ux = circle.center.x - g.N.x, uy = circle.center.y - g.N.y;
      const vx = dot.x - g.N.x, vy = dot.y - g.N.y;
      return Math.abs(ux * vy - uy * vx) / (dist(circle.center, g.N) * dist(dot, g.N));
    };
    return [
      ...g.touches.slice(0, 3).map((dot, i) => cross(dot, g.excircles[i])),
      cross(g.touches[3], g.incircle),
    ];
  }

  /** The nine-point circle radius is R/2; Euler gives OI^2 = R(R-2r). */
  function nineRadiusError(g) {
    return g.valid ? Math.abs(g.nineRadius - g.circumradius / 2) : Infinity;
  }

  function eulerError(g) {
    if (!g.valid) return Infinity;
    return Math.abs(sqDist(g.O, g.I) -
      g.circumradius * (g.circumradius - 2 * g.inradius));
  }

  /** Equilateral: the circles coincide, so there is no single touch point. */
  function coincidentIncircle(g) {
    if (!g.valid) return false;
    return dist(g.N, g.I) < 1e-6 * g.circumradius &&
      Math.abs(g.nineRadius - g.inradius) < 1e-6 * g.circumradius;
  }

  /** An illustration has nothing to win or lose. */
  function result() {
    return null;
  }

  return {
    VIEW, MARGIN, START_ANGLES, start, defaultOptions, setOption, moveVertex,
    geometry, result, dist, sqDist, mid, clampToBoard, finitePoint,
    computeAngle, findOrientation, rotate, intersect, findIncenter,
    findExcenter, foot, circumcenter, meanCircle, showTouch,
    centreGapErrors, touchErrors, touchCollinearity, nineRadiusError,
    eulerError, coincidentIncircle,
  };
})();
