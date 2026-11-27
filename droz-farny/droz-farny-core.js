"use strict";

/*
 * Droz-Farny Line Theorem, from Alexander Bogomolny's applet DrozFarny.
 *
 * Draw two perpendicular lines through the orthocenter H of a triangle. Each
 * line cuts each sideline in a point, so each side carries a pair of points.
 * The midpoints of the three pairs are always collinear; more generally the
 * points tX + (1-t)X' cut on the three sides with the same t are collinear.
 * The applet draws the two lines, their six intersections with the sidelines,
 * the three midpoints, and (on request) the circles through H and each pair,
 * the circumcircle, the altitudes and the reflections used in the proof.
 *
 * The key calculation is analytic: in coordinates with origin H and axes the
 * two given lines, the six cut points are (a,0),(0,b), ... and the collinearity
 * determinant picks up the factor t(1-t) times the determinant at t = 0. This
 * file only computes the picture: no document, no window, no storage. It
 * defines one global, DrozFarnyCore, so the page loads it with a plain <script>
 * and porting/check-droz-farny.mjs loads it in Node.
 *
 * The position is plain data (four points and fourteen checkbox booleans), so it
 * can be saved and handed to the tutor as it is. Every function returns a new
 * position and leaves the one it was given untouched.
 */
const DrozFarnyCore = (() => {
  // The Java canvas was 400 by 300; the SVG board keeps those user units. The
  // applet puts the vertices at centre + (min(w,h)/4) * (cos t, sin t) for
  // t = -1.6, -4.0, -0.2, on a circle about the middle of the canvas.
  const WIDTH = 400;
  const HEIGHT = 300;
  const CENTRE = { x: WIDTH / 2, y: HEIGHT / 2 };
  const SPREAD = Math.min(WIDTH, HEIGHT) / 4;
  const MARGIN = 10;

  // GeoSDoub.Intersect calls a pair of lines parallel when its determinant is
  // below 1 (in the squared pixel units of the old canvas).
  const PARALLEL = 1;
  // The applet's MPoint starts at Math.random() inside the canvas. We use a
  // fixed, reproducible point in that same range so a picture can be shared.
  const DEFAULT_P = { x: 60, y: 140 };

  // The panel's fourteen checkboxes, in the applet's own field names.
  const OPTION_KEYS = [
    "ShowNames", "ShowHint", "ShowAltitudes", "ShowLine",
    "ZZpH", "YYpH", "XXpH", "ABC",
    "AReflP", "BReflP", "CReflP", "AReflL", "BReflL", "CReflL",
  ];

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const lerp = (p, q, t) => ({ x: t * p.x + (1 - t) * q.x, y: t * p.y + (1 - t) * q.y });

  /**
   * GeoSDoub.Intersect(a,b,c,d): write each line as alpha*x + beta*y = gamma.
   * Returns null where the applet would return a point with NaN coordinates.
   */
  function intersect(a, b, c, d) {
    const alpha = a.y - b.y, beta = b.x - a.x, gamma = a.x * b.y - a.y * b.x;
    const alpha2 = c.y - d.y, beta2 = d.x - c.x, gamma2 = c.x * d.y - c.y * d.x;
    const den = alpha * beta2 - alpha2 * beta;
    if (Math.abs(den) < PARALLEL) return null;
    return {
      x: (beta * gamma2 - beta2 * gamma) / den,
      y: (gamma * alpha2 - gamma2 * alpha) / den,
    };
  }

  /** GeoSDoub.FindAltitude(p, through, other): foot of the perpendicular. */
  function altitudeFoot(p, through, other) {
    const far = {
      x: p.x + other.y - through.y,
      y: p.y - (other.x - through.x),
    };
    return intersect(p, far, through, other);
  }

  /** GeoSDoub.FindCircumcenter, built from the two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const mid1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const mid2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const far1 = { x: mid1.x + b.y - a.y, y: mid1.y - (b.x - a.x) };
    const far2 = { x: mid2.x + c.y - b.y, y: mid2.y - (c.x - b.x) };
    return intersect(mid1, far1, mid2, far2);
  }

  /** The applet's GetCircle: centre at the circumcentre, mean distance as radius. */
  function getCircle(a, b, c) {
    const centre = circumcenter(a, b, c);
    if (!finite(centre)) return null;
    const r = (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3;
    return { centre, r };
  }

  /** Two circles, as the standard radical-axis construction. */
  function circleIntersections(c1, c2) {
    if (!c1 || !c2) return [];
    const dx = c2.centre.x - c1.centre.x, dy = c2.centre.y - c1.centre.y;
    const d = Math.hypot(dx, dy);
    if (!d || d > c1.r + c2.r || d < Math.abs(c1.r - c2.r)) return [];
    const along = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
    const height = Math.sqrt(Math.max(0, c1.r * c1.r - along * along));
    const base = {
      x: c1.centre.x + (dx * along) / d,
      y: c1.centre.y + (dy * along) / d,
    };
    if (height < 1e-9) return [base];
    return [
      { x: base.x - (dy * height) / d, y: base.y + (dx * height) / d },
      { x: base.x + (dy * height) / d, y: base.y - (dx * height) / d },
    ];
  }

  /** Extend(p,q) in the applet: reflect p in q. */
  const reflect = (p, q) => ({ x: 2 * q.x - p.x, y: 2 * q.y - p.y });
  /** Perp(p,q) in the applet: q turned a quarter turn about p, 100 units long. */
  function perpendicular(p, q) {
    return { x: p.x + (q.y - p.y) * 100, y: p.y - (q.x - p.x) * 100 };
  }
  /** Other(points, p): the intersection of two circles that is not p. */
  function other(points, p) {
    if (!points || !points.length) return null;
    return finite(points[0]) && dist(points[0], p) < 0.1
      ? (points[1] || null)
      : points[0];
  }

  /** The position a new illustration starts from: all twelve boxes unchecked. */
  function start(options) {
    const opts = options || {};
    const s = {
      A: {
        x: CENTRE.x + SPREAD * Math.cos(-1.6),
        y: CENTRE.y + SPREAD * Math.sin(-1.6),
      },
      B: {
        x: CENTRE.x + SPREAD * Math.cos(-4.0),
        y: CENTRE.y + SPREAD * Math.sin(-4.0),
      },
      C: {
        x: CENTRE.x + SPREAD * Math.cos(-0.2),
        y: CENTRE.y + SPREAD * Math.sin(-0.2),
      },
      P: opts.P ? { x: opts.P.x, y: opts.P.y } : { x: DEFAULT_P.x, y: DEFAULT_P.y },
    };
    for (const key of OPTION_KEYS) s[key] = !!opts[key];
    return s;
  }

  /** Keep a dragged handle on the board, with a little room for its label. */
  function clampPoint(s, name, q) {
    if (!q || !["A", "B", "C", "P"].includes(name)) return s[name];
    return {
      x: Math.max(MARGIN, Math.min(WIDTH - MARGIN, q.x)),
      y: Math.max(MARGIN, Math.min(HEIGHT - MARGIN, q.y)),
    };
  }

  /** Move one named handle. */
  function move(s, name, q) {
    if (!s || !["A", "B", "C", "P"].includes(name) || !q) return s;
    return Object.assign({}, s, { [name]: clampPoint(s, name, q) });
  }

  /** One of the applet's fourteen checkboxes. */
  function option(s, name, value) {
    if (!OPTION_KEYS.includes(name)) return s;
    return Object.assign({}, s, { [name]: !!value });
  }

  /**
   * DrozFarnyCanvas.Compute(), straight through: circumcircle, three altitude
   * feet, the orthocenter and its reflections, the two perpendicular lines,
   * their six cuts with the sidelines, the three midpoint circles and the two
   * auxiliary points M and Q used by the synthetic proof.
   */
  function compute(s) {
    const { A, B, C, P } = s;
    const Circle = getCircle(A, B, C);
    const Ha = altitudeFoot(A, B, C);
    const Hb = altitudeFoot(B, A, C);
    const Hc = altitudeFoot(C, B, A);
    const H = finite(Ha) && finite(Hb) ? intersect(A, Ha, B, Hb) : null;
    const Ka = finite(H) && finite(Ha) ? reflect(H, Ha) : null;
    const Kb = finite(H) && finite(Hb) ? reflect(H, Hb) : null;
    const Kc = finite(H) && finite(Hc) ? reflect(H, Hc) : null;

    // ComputeLines(): line H-P, and the line through H perpendicular to it.
    const line = { p: P, q: H };
    const second = finite(H) ? { p: H, q: perpendicular(H, P) } : { p: null, q: null };
    const cut = (l, u, v) => finite(l.q) ? intersect(l.p, l.q, u, v) : null;
    const X = cut(line, B, C);
    const Xp = cut(second, B, C);
    const Y = cut(line, C, A);
    const Yp = cut(second, C, A);
    const Z = cut(line, A, B);
    const Zp = cut(second, A, B);

    const midpoint = (p, q) => finite(p) && finite(q)
      ? { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
      : null;
    const Ma = midpoint(X, Xp);
    const Mb = midpoint(Y, Yp);
    const Mc = midpoint(Z, Zp);
    const Ca = finite(H) && finite(X) && finite(Xp) ? getCircle(H, X, Xp) : null;
    const Cb = finite(H) && finite(Y) && finite(Yp) ? getCircle(H, Y, Yp) : null;
    const Cc = finite(H) && finite(Z) && finite(Zp) ? getCircle(H, Z, Zp) : null;
    const M = finite(H) ? other(circleIntersections(Ca, Cb), H) : null;
    const Q = finite(X) && finite(Ka) && finite(Y) && finite(Kb)
      ? intersect(X, Ka, Y, Kb)
      : null;

    return {
      A, B, C, P, H, Ha, Hb, Hc, Ka, Kb, Kc,
      line, second, X, Xp, Y, Yp, Z, Zp,
      Ma, Mb, Mc, Circle, Ca, Cb, Cc, M, Q,
    };
  }

  /**
   * The signed area that tests collinearity of the three points cut on the
   * sides with one and the same t. Zero means collinear. Dividing by the
   * triangle's size makes the number comparable across drawings.
   */
  function collinearity(f, t) {
    if (t === undefined) t = 0.5;
    if (!finite(f.X) || !finite(f.Xp) || !finite(f.Y) || !finite(f.Yp) ||
        !finite(f.Z) || !finite(f.Zp)) return NaN;
    const a = lerp(f.X, f.Xp, t), b = lerp(f.Y, f.Yp, t), c = lerp(f.Z, f.Zp, t);
    const scale = Math.max(1, dist(f.A, f.B), dist(f.B, f.C), dist(f.C, f.A));
    return cross(sub(b, a), sub(c, a)) / scale;
  }

  /** The error in each geometric claim the applet's page makes. */
  function errors(f) {
    const onCircle = (p, circle) => circle && finite(p)
      ? Math.abs(dist(p, circle.centre) - circle.r) / Math.max(1, circle.r)
      : NaN;
    const chordCircle = (p, p2, mid) => mid && finite(p) && finite(p2)
      ? Math.abs(dist(mid, p) - dist(mid, p2)) / Math.max(1, dist(mid, p))
      : NaN;
    const rightAngle = (u, v) => {
      if (!finite(u) || !finite(v) || !finite(f.H)) return NaN;
      const a = sub(u, f.H), b = sub(v, f.H);
      return Math.abs(dot(a, b)) / Math.max(1, Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
    };
    return {
      midpoints: collinearity(f, 0.5),
      anyT: Math.max(...[0, 0.1, 0.25, 0.5, 0.75, 1].map((t) => Math.abs(collinearity(f, t)))),
      xDiameter: chordCircle(f.X, f.Xp, f.Ma),
      yDiameter: chordCircle(f.Y, f.Yp, f.Mb),
      zDiameter: chordCircle(f.Z, f.Zp, f.Mc),
      rightX: rightAngle(f.X, f.Xp),
      rightY: rightAngle(f.Y, f.Yp),
      rightZ: rightAngle(f.Z, f.Zp),
      hOnX: onCircle(f.H, f.Ca),
      hOnY: onCircle(f.H, f.Cb),
      hOnZ: onCircle(f.H, f.Cc),
      kaOnX: onCircle(f.Ka, f.Ca),
      kbOnY: onCircle(f.Kb, f.Cb),
      kcOnZ: onCircle(f.Kc, f.Cc),
      kaOnABC: onCircle(f.Ka, f.Circle),
      kbOnABC: onCircle(f.Kb, f.Circle),
      kcOnABC: onCircle(f.Kc, f.Circle),
      qOnABC: onCircle(f.Q, f.Circle),
      mOnX: onCircle(f.M, f.Ca),
      mOnY: onCircle(f.M, f.Cb),
      mOnZ: onCircle(f.M, f.Cc),
    };
  }

  /** A short status line: no win or loss, this is an illustration. */
  function describe(f) {
    if (!finite(f.H) || !finite(f.Ma) || !finite(f.Mb) || !finite(f.Mc)) {
      return "Move the point P away from H and away from a side-parallel line to see the three cuts.";
    }
    const err = Math.abs(collinearity(f, 0.5));
    return err < 1e-7
      ? "The three cross marks line up on one straight line. Drag A, B, C or P and they still do."
      : "Move P away from a line parallel to a side: the three cuts are hard to see here.";
  }

  return {
    WIDTH, HEIGHT, CENTRE, SPREAD, MARGIN, PARALLEL, DEFAULT_P, OPTION_KEYS,
    add, sub, mul, dot, cross, dist, finite, lerp,
    intersect, altitudeFoot, circumcenter, getCircle, circleIntersections,
    reflect, perpendicular, other,
    start, clampPoint, move, option, compute, collinearity, errors, describe,
  };
})();
