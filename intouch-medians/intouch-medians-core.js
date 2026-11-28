"use strict";

/*
 * Concurrency in the intouch triangle, from Alexander Bogomolny's applet
 * IntouchMedians (cut-the-knot.org/Curriculum/Geometry/IntouchMedians.shtml).
 *
 * The incircle of ABC touches BC at A', CA at B' and AB at C'. Those three
 * points form the intouch triangle A'B'C'; Am, Bm, Cm are the midpoints of its
 * sides. From each midpoint we drop a perpendicular to the opposite side of
 * ABC (AmAh to BC, BmBh to CA, CmCh to AB). The page claims the three lines
 * meet at one point S, and that S, G' (the centroid of A'B'C') and I (the
 * incenter of ABC) are collinear with 2*|SG'| = |G'I|.
 *
 * The key idea is the homothety with center G' and ratio -2: it carries Am,
 * Bm, Cm to A', B', C'. It sends each perpendicular through a midpoint to the
 * parallel line through the corresponding touch point, which is the radius
 * to that touch point, so the three image lines meet at I and the originals
 * meet at the inverse image S = (3G' - I)/2.
 *
 * This file is the applet's Compute() and nothing else: no document, no
 * window, no storage. The position is plain data and this file defines one
 * global, IntouchMediansCore.
 */
const IntouchMediansCore = (() => {
  /** The SVG's user units; the page's viewBox must match. */
  const VIEW = { width: 360, height: 260 };
  const MARGIN = 18;

  /* IntouchMediansCanvas.init(): A = (W/8, 5H/6), B = (W - A.x, A.y),
     C = (4W/5, H/5). The bytecode does the divisions in Java integer
     arithmetic before the i2d conversions, so 5H/6 truncates to 216. */
  const START = {
    A: { x: Math.floor(VIEW.width / 8), y: Math.floor((5 * VIEW.height) / 6) },
    B: { x: VIEW.width - Math.floor(VIEW.width / 8), y: Math.floor((5 * VIEW.height) / 6) },
    C: { x: Math.floor((4 * VIEW.width) / 5), y: Math.floor(VIEW.height / 5) },
  };

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const mid3 = (p, q, r) => ({
    x: (p.x + q.x + r.x) / 3,
    y: (p.y + q.y + r.y) / 3,
  });

  function clampToBoard(p) {
    return {
      x: Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      y: Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
    };
  }

  /** GeoSDoub.NearestPoint: the perpendicular foot, or p for a degenerate side. */
  function foot(p, a, b) {
    if (sqDist(a, b) < 0.1) return { x: p.x, y: p.y };
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.Intersect: NaN coordinates for parallel lines (|den| < 1). */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return {
      x: (b1 * c2 - b2 * c1) / den,
      y: (c1 * a2 - c2 * a1) / den,
    };
  }

  /** The incenter by side-length weights (the applet bisects two angles). */
  function incenter(A, B, C) {
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const sum = a + b + c;
    if (!Number.isFinite(sum) || sum < 1e-12) return { x: NaN, y: NaN };
    return {
      x: (a * A.x + b * B.x + c * C.x) / sum,
      y: (a * A.y + b * B.y + c * C.y) / sum,
    };
  }

  /** Every point of the drawing, in the applet's Compute() order. */
  function geometry(state) {
    const invalid = { valid: false };
    const A = state && state.A, B = state && state.B, C = state && state.C;
    if (!finitePoint(A) || !finitePoint(B) || !finitePoint(C)) return invalid;
    const area = Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x));
    if (area < 1e-9) return invalid;

    const I = incenter(A, B, C);
    const Ap = foot(I, B, C);       // touch point on BC
    const Bp = foot(I, C, A);       // touch point on CA
    const Cp = foot(I, A, B);       // touch point on AB
    const Am = mid(Bp, Cp);         // midpoint of B'C'
    const Bm = mid(Cp, Ap);         // midpoint of C'A'
    const Cm = mid(Ap, Bp);         // midpoint of A'B'
    const Ah = foot(Am, B, C);      // perpendicular feet on the opposite sides
    const Bh = foot(Bm, C, A);
    const Ch = foot(Cm, A, B);
    const S = intersect(Ah, Am, Bh, Bm);
    const S2 = intersect(Bh, Bm, Ch, Cm); // the other two lines, for the claim
    const S3 = intersect(Ch, Cm, Ah, Am);
    const G = mid3(Ap, Bp, Cp);
    if (![I, Ap, Bp, Cp, Am, Bm, Cm, Ah, Bh, Ch, S, S2, S3, G].every(finitePoint)) return invalid;

    // DoubCircle(I, (|IAp| + |IBp| + |ICp|)/3) -- the applet's inradius.
    const radius = (dist(I, Ap) + dist(I, Bp) + dist(I, Cp)) / 3;

    // UpgradeCenter(): the centroid of ABC anchors the point labels.
    const center = mid3(A, B, C);

    return {
      valid: true, A, B, C, I, Ap, Bp, Cp, Am, Bm, Cm, Ah, Bh, Ch,
      S, S2, S3, G, radius, center,
      lines: {
        ABC: [[A, B], [B, C], [C, A]],
        touch: [[Ap, Bp], [Bp, Cp], [Cp, Ap]],
        perp: [[Ah, Am], [Bh, Bm], [Ch, Cm]],
        medians: [[Ap, Am], [Bp, Bm], [Cp, Cm]],
        radii: [[Ap, I], [Bp, I], [Cp, I]],
        SI: [S, I],
        // The six pieces marked alike by the applet's LineID (1, 2, 3).
        marks: [
          [Ap, Bm, 1], [Bm, Cp, 1],
          [Bp, Cm, 2], [Cm, Ap, 2],
          [Cp, Am, 3], [Am, Bp, 3],
        ],
      },
      labels: {
        A, B, C, S, I, G,
        "A'": Ap, "B'": Bp, "C'": Cp,
        Am, Bm, Cm, Ah, Bh, Ch,
      },
    };
  }

  /** Sine of the angle between two lines; zero when they are parallel. */
  function parallelError(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const den = Math.hypot(rx, ry) * Math.hypot(sx, sy);
    return den < 1e-12 ? Infinity : Math.abs(rx * sy - ry * sx) / den;
  }

  /** Cosine of the angle between two lines; zero when they are perpendicular. */
  function perpError(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const den = Math.hypot(rx, ry) * Math.hypot(sx, sy);
    return den < 1e-12 ? Infinity : Math.abs(rx * sx + ry * sy) / den;
  }

  /** Distance of p from the line through a and b. */
  function lineError(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    return len < 1e-12 ? Infinity :
      Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
  }

  /** Every claim on the page, as errors in drawing units. */
  function claimErrors(g) {
    if (!g.valid) return null;
    const predicted = { x: (3 * g.G.x - g.I.x) / 2, y: (3 * g.G.y - g.I.y) / 2 };
    const sg = dist(g.S, g.G), gi = dist(g.G, g.I);
    return {
      // The three perpendiculars are concurrent: all pairwise intersections agree.
      concurrency: Math.max(dist(g.S, g.S2), dist(g.S, g.S3)),
      // S, G' and I are collinear and 2*|SG'| = |G'I|.
      predicted: dist(g.S, predicted),
      collinear: lineError(g.G, g.S, g.I),
      ratio: Math.abs(2 * sg - gi),
      // The homothety of ratio -2 about G' takes each midpoint to a touch point.
      homothety: Math.max(
        dist(g.Ap, { x: 3 * g.G.x - 2 * g.Am.x, y: 3 * g.G.y - 2 * g.Am.y }),
        dist(g.Bp, { x: 3 * g.G.x - 2 * g.Bm.x, y: 3 * g.G.y - 2 * g.Bm.y }),
        dist(g.Cp, { x: 3 * g.G.x - 2 * g.Cm.x, y: 3 * g.G.y - 2 * g.Cm.y })),
      // The touch points are the perpendicular feet of the incenter.
      // I->Ap is perpendicular to BC (and likewise for the other two sides).
      touchBC: perpError(g.I, g.Ap, g.B, g.C),
      touchCA: perpError(g.I, g.Bp, g.C, g.A),
      touchAB: perpError(g.I, g.Cp, g.A, g.B),
      // AmAh, BmBh, CmCh are perpendicular to BC, CA, AB respectively.
      perpBC: perpError(g.Ah, g.Am, g.B, g.C),
      perpCA: perpError(g.Bh, g.Bm, g.C, g.A),
      perpAB: perpError(g.Ch, g.Cm, g.A, g.B),
      // Equal tangents from each corner (why the touch triangle sits where it does).
      tangentsA: Math.abs(dist(g.A, g.Bp) - dist(g.A, g.Cp)),
      tangentsB: Math.abs(dist(g.B, g.Cp) - dist(g.B, g.Ap)),
      tangentsC: Math.abs(dist(g.C, g.Ap) - dist(g.C, g.Bp)),
      // The line through S and I also passes through G' (the whole collinearity).
      SIthroughG: lineError(g.G, g.S, g.I),
      radii: Math.max(dist(g.I, g.Ap), dist(g.I, g.Bp), dist(g.I, g.Cp)) -
        Math.min(dist(g.I, g.Ap), dist(g.I, g.Bp), dist(g.I, g.Cp)),
      radius: Math.abs(dist(g.I, g.Ap) - g.radius),
    };
  }

  function defaultOptions() {
    /* The applet's canvas takes ShowNames and ShowHint from the one
       "ShowNames" parameter, which equals "1". With no parameter both are off. */
    return { names: false, hint: false };
  }

  /** A fresh position; options come from the applet's ShowNames parameter. */
  function start(options) {
    const opts = defaultOptions();
    if (options) {
      if (options.show === 1 || options.show === "1") {
        opts.names = true;
        opts.hint = true;
      }
      for (const k in opts) if (k in options) opts[k] = Boolean(options[k]);
    }
    return {
      A: { ...START.A }, B: { ...START.B }, C: { ...START.C },
      options: opts, touches: 0,
    };
  }

  /** Move one vertex; the old position is not changed. */
  function moveVertex(state, name, point) {
    if (!["A", "B", "C"].includes(name) || !finitePoint(point)) return state;
    return { ...state, [name]: clampToBoard(point), touches: state.touches + 1 };
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return { ...state, options: { ...state.options, [name]: Boolean(on) } };
  }

  /** An illustration has no win or loss: it is explored, which Track handles. */
  function result() {
    return null;
  }

  return {
    VIEW, START, start, moveVertex, setOption, geometry, claimErrors, result,
    dist, sqDist, mid, mid3, foot, intersect, incenter, clampToBoard,
    parallelError, perpError, lineError,
  };
})();
