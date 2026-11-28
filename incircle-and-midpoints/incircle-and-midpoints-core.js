"use strict";

/*
 * Midpoints from the Gergonne triangle, from Alexander Bogomolny's applet
 * IncircleAndMidpoints (cut-the-knot.org/Curriculum/Geometry/IncircleAndMidpoints.shtml).
 *
 * The incircle of ABC touches AB at M, BC at N and AC at K. D is where MN
 * meets the line through A parallel to KN; E is where KN meets the line
 * through A parallel to MN. The claim on the page is that DE cuts AB and AC
 * at their midpoints F and G. The page's proof uses the line through A
 * parallel to BC, meeting MN at U and KN at V: because AM = AK, also AU = AV,
 * so A is the midpoint of UV and D, E become midpoints of NU, NV. Three
 * parallels then bisect every transversal, including AB and AC.
 *
 * This file is the applet's Compute(), in its order: FindIncenter, three
 * NearestPoint feet, the KN and MN lines, D and E via GetParallelTo and
 * Intersect, the DE line, U and V on the parallel to BC, then F and G where
 * DE meets AB and AC. The incircle radius is the applet's average of the
 * three distances from the incenter to the side lines. No DOM, no storage:
 * the position is plain data and this module defines one global.
 */
const IncircleAndMidpointsCore = (() => {
  /** The SVG's user-unit rectangle; the page's viewBox must match. */
  const VIEW = { width: 360, height: 260 };
  const MARGIN = 18;

  /** The applet's init(): A = (2W/3, 2H/3), B = (W/2, H/6), C = (W/4, 2H/5). */
  const START = {
    A: { x: (2 * VIEW.width) / 3, y: (2 * VIEW.height) / 3 },
    B: { x: VIEW.width / 2, y: VIEW.height / 6 },
    C: { x: VIEW.width / 4, y: (2 * VIEW.height) / 5 },
  };

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  function clampToBoard(p) {
    return {
      x: Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      y: Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
    };
  }

  /** Foot of the perpendicular from p to the infinite line through a, b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return null;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Intersection of line(a,b) with line(c,d); null for parallel lines. */
  function intersect(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const cross = rx * sy - ry * sx;
    if (Math.abs(cross) < 1e-9) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
    return { x: a.x + rx * t, y: a.y + ry * t };
  }

  /** A second point on the line through p parallel to q->r (100 units out). */
  function parallelTo(p, q, r) {
    return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
  }

  /** Incenter by side-length weights: I = (aA + bB + cC) / (a+b+c). */
  function incenter(A, B, C) {
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const sum = a + b + c;
    return {
      x: (a * A.x + b * B.x + c * C.x) / sum,
      y: (a * A.y + b * B.y + c * C.y) / sum,
    };
  }

  /* InsideTest.IsInside(r,q,p): r lies between p and q (or at an end). */
  const inside = (r, q, p) =>
    (r.x - q.x) * (r.x - p.x) + (r.y - q.y) * (r.y - p.y) <= 0;

  /** The applet's private DrawLine(g,p,q,r): the visible part of p--q--r. */
  function drawSpan(p, q, r) {
    if (inside(r, q, p)) return [p, r];
    if (inside(q, r, p)) return [p, q];
    return [q, r];
  }

  /** Every point of the drawing, computed from a position. */
  function geometry(state) {
    const invalid = { valid: false };
    const A = state && state.A, B = state && state.B, C = state && state.C;
    if (!finitePoint(A) || !finitePoint(B) || !finitePoint(C)) return invalid;
    const area = Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x));
    if (area < 1e-9) return invalid;

    const I = incenter(A, B, C);
    const K = foot(I, A, C);       // touch point on AC
    const M = foot(I, B, A);       // touch point on AB
    const N = foot(I, C, B);       // touch point on BC
    if (!K || !M || !N) return invalid;

    // DoubLine MN and KN, each stored as its first point and a point 100
    // units along the side direction, as GeoSDoub.GetParallelTo does.
    const mnEnd = parallelTo(M, M, N);
    const knEnd = parallelTo(K, K, N);
    const mn = [M, mnEnd], kn = [K, knEnd];

    const dEnd = parallelTo(A, K, N);          // through A, parallel to KN
    const eEnd = parallelTo(A, M, N);          // through A, parallel to MN
    const D = intersect(dEnd, A, M, mnEnd);
    const E = intersect(eEnd, A, K, knEnd);
    if (!finitePoint(D) || !finitePoint(E)) return invalid;

    const bcEnd = parallelTo(A, B, C);         // through A, parallel to BC
    const U = intersect(bcEnd, A, M, mnEnd);   // on MN
    const V = intersect(bcEnd, A, K, knEnd);   // on KN
    const F = intersect(A, B, D, E);           // DE meets AB
    const G = intersect(A, C, D, E);           // DE meets AC
    if (![U, V, F, G].every(finitePoint)) return invalid;

    // The applet's GetIncircle(): the average of the three perpendicular
    // distances (mathematically all equal for a true incircle).
    const radius = (dist(I, foot(I, A, B)) + dist(I, foot(I, B, C)) +
      dist(I, foot(I, C, A))) / 3;

    // UpdateCenter(): the centroid is the anchor for point labels.
    const center = {
      x: (A.x + B.x + C.x) / 3,
      y: (A.y + B.y + C.y) / 3,
    };

    return {
      valid: true, A, B, C, I, radius, K, M, N, D, E, F, G, U, V, center,
      lines: {
        MN: mn, KN: kn,
        AKN: [A, D], AMN: [A, E],
        DE: [D, E], UV: [U, V],
        throughA: [A, bcEnd],
      },
      spans: {
        MDN: drawSpan(M, N, D),
        KEN: drawSpan(K, N, E),
      },
      labels: { A, B, C, D, E, F, G, K, M, N, U, V },
    };
  }

  /** Distance from p to the midpoint of a--b; zero when p bisects a--b. */
  const midpointError = (p, a, b) => dist(p, mid(a, b));

  /** Sine of the angle between two lines; zero when they are parallel. */
  function parallelError(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const den = Math.hypot(rx, ry) * Math.hypot(sx, sy);
    return den < 1e-12 ? Infinity : Math.abs(rx * sy - ry * sx) / den;
  }

  /** Every numeric claim made by the page, as errors in drawing units. */
  function claimErrors(g) {
    if (!g.valid) return null;
    return {
      FmidAB: midpointError(g.F, g.A, g.B),
      GmidAC: midpointError(g.G, g.A, g.C),
      AmidUV: midpointError(g.A, g.U, g.V),
      DmidNU: midpointError(g.D, g.N, g.U),
      EmidNV: midpointError(g.E, g.N, g.V),
      AUeqAV: Math.abs(dist(g.A, g.U) - dist(g.A, g.V)),
      AMeqAU: Math.abs(dist(g.A, g.M) - dist(g.A, g.U)),
      AKeqAV: Math.abs(dist(g.A, g.K) - dist(g.A, g.V)),
      AMeqAK: Math.abs(dist(g.A, g.M) - dist(g.A, g.K)),
      BNeqBM: Math.abs(dist(g.B, g.N) - dist(g.B, g.M)),
      CNeqCK: Math.abs(dist(g.C, g.N) - dist(g.C, g.K)),
      DEparBC: parallelError(g.D, g.E, g.B, g.C),
      UVparBC: parallelError(g.U, g.V, g.B, g.C),
      radii: Math.max(dist(g.I, g.K), dist(g.I, g.M), dist(g.I, g.N)) -
        Math.min(dist(g.I, g.K), dist(g.I, g.M), dist(g.I, g.N)),
      radius: Math.abs(dist(g.I, g.M) - g.radius),
    };
  }

  function defaultOptions() {
    // The applet's canvas sets ShowNames and ShowHint2 from its "Show"
    // parameter (parsed as an integer); ShowHint1 always starts off.
    return { names: false, hint1: false, hint2: false };
  }

  /** A fresh position. With no "Show" parameter the applet shows no guides. */
  function start(options) {
    const opts = defaultOptions();
    if (options) {
      if (options.show === 1 || options.show === "1") {
        opts.names = true;
        opts.hint2 = true;
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
    VIEW, START, start, moveVertex, setOption, geometry, claimErrors,
    result, dist, mid, foot, intersect, parallelTo, incenter, clampToBoard,
    inside, drawSpan, midpointError, parallelError,
  };
})();
