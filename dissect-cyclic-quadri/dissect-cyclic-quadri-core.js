"use strict";

/*
 * Dissection of a Cyclic Quadrilateral — Alexander Bogomolny's applet
 * DissectCyclicQuadri (cut-the-knot.org/Curriculum/Geometry/DissectCyclicQuadri.shtml).
 *
 * A, B, C, D are constrained to a circle; P is a free point.  R, M, N, Q sit
 * on the side lines AB, BC, CD, DA and the four small quadrilaterals BRPM,
 * CMPN, DNPQ and AQPR are tested for cyclicity.  The article's claim is that
 * for *any* P the perpendicular feet of P on the four side lines make all
 * four small quadrilaterals cyclic.  This core includes that construction
 * and the article's alternate construction from a chosen N.
 *
 * The geometry follows the original bytecode exactly: DoubLine's midpoint
 * parameter is t*m1 + (1-t)*m2 (the reverse of the usual convention), the
 * circumcircle uses GeoSDoub.FindCircumcenter and a mean radius, and the
 * applet's cyclicity tolerances are 1 and, as a fallback from 3-of-4, 3.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, DissectCyclicQuadriCore, so the page can
 * load it with a plain <script> and the logic test can load it in Node.
 * Positions are plain data in the SVG's 400x300 viewBox units.
 */
const DissectCyclicQuadriCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const GUIDE = {
    c: { x: VIEW.width / 2, y: (VIEW.height * 11) / 20 },
    r: Math.min(VIEW.width, VIEW.height) / 2.7,
  };
  /* FromCircle in the applet's init(), in radians, with y pointing down. */
  const ANGLES = {
    A: 0.39269908169872414,
    B: 1.5707963267948966,
    C: 2.792526803190927,
    D: 5.026548245743669,
  };
  /* DoubLine.CreateMidPoint(line, t): t*m1 + (1-t)*m2. */
  const COEF = { R: 0.45, M: 0.6, N: 0.3, Q: 0.5 };
  const PAD = 12;
  const STRICT = 1;
  const RELAXED = 3;
  const HANDLES = ["A", "B", "C", "D", "P", "R", "M", "N", "Q"];

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const mix = (a, b, t) => point(a.x * t + b.x * (1 - t), a.y * t + b.y * (1 - t));
  const clamp01 = (t) => Math.max(0, Math.min(1, t));

  /** GeoSDoub.Intersect: line coefficients ax+by+c=0; |det| < tiny fails. */
  function intersect(a, b, c, d, tiny) {
    const eps = tiny === undefined ? 1 : tiny;
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < eps) return null;
    const p = point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
    return finite(p) ? p : null;
  }

  /**
   * The applet's GetCircle / GeoSDoub.FindCircumcenter.  Its radius is the
   * *mean* of the three centre-to-vertex distances, not the true radius.
   * With tiny=1e-12 and the true radius this is ordinary geometry.
   */
  function circumcircle(a, b, c, tiny) {
    if (!finite(a) || !finite(b) || !finite(c)) return null;
    const eps = tiny === undefined ? 1 : tiny;
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const o = intersect(
      m1, point(m1.x + (b.y - a.y), m1.y - (b.x - a.x)),
      m2, point(m2.x + (c.y - b.y), m2.y - (c.x - b.x)), eps,
    );
    if (!o) return null;
    const mean = (dist(o, a) + dist(o, b) + dist(o, c)) / 3;
    return { c: o, r: eps === 1 ? mean : dist(o, a) };
  }

  /** The ordinary circumcircle, for the mathematical claims on the page. */
  function exactCircle(a, b, c) {
    return circumcircle(a, b, c, 1e-12);
  }

  /** Quad.CheckForCyclicity(tol) from the bytecode. */
  function quadCircle(u, v, w, x, tol) {
    if (![u, v, w, x].every(finite)) return null;
    if (dist(u, v) < 1 || dist(v, w) < 1) return null;
    const cc = circumcircle(u, x, w); // U, X, W in that order
    if (!cc) return null;
    const gap = Math.abs(dist(v, cc.c) - cc.r);
    return gap < tol ? cc : null;
  }

  /** Foot of the perpendicular from p to the line through a and b. */
  function foot(p, a, b) {
    const d = sub(b, a), len2 = dot(d, d);
    if (!len2) return point(a.x, a.y);
    return add(a, mul(d, dot(sub(p, a), d) / len2));
  }

  /** DoubLine.UpdateMidPoint's reversed parameter, optionally clamped. */
  function coefFor(p, a, b, clamp) {
    const d = sub(b, a), len2 = dot(d, d);
    if (!len2) return 0;
    const t = 1 - dot(sub(p, a), d) / len2;
    return clamp === false ? t : clamp01(t);
  }

  /** The four cut points from the line endpoints and the stored parameters. */
  function sidePoints(v, coef) {
    return {
      R: mix(v.A, v.B, coef.R),
      M: mix(v.B, v.C, coef.M),
      N: mix(v.C, v.D, coef.N),
      Q: mix(v.A, v.D, coef.Q), // the applet's "DA" line is built from A,D
    };
  }

  /** CTKMoveableDoub's circle glider: scale the radius vector. */
  function clampToCircle(p) {
    if (!finite(p)) return point(GUIDE.c.x + GUIDE.r, GUIDE.c.y);
    const dx = p.x - GUIDE.c.x, dy = p.y - GUIDE.c.y;
    const d = Math.hypot(dx, dy);
    if (!d) return point(GUIDE.c.x + GUIDE.r, GUIDE.c.y);
    return point(GUIDE.c.x + (dx * GUIDE.r) / d, GUIDE.c.y + (dy * GUIDE.r) / d);
  }

  function clampToView(p) {
    if (!finite(p)) return point(VIEW.width / 2, VIEW.height / 2);
    return point(
      Math.max(PAD, Math.min(VIEW.width - PAD, p.x)),
      Math.max(PAD, Math.min(VIEW.height - PAD, p.y)),
    );
  }

  /** The four corners and the centroid the applet starts from. */
  function start(options) {
    const o = options || {};
    const v = {};
    for (const name of ["A", "B", "C", "D"]) {
      v[name] = point(
        GUIDE.c.x + GUIDE.r * Math.cos(ANGLES[name]),
        GUIDE.c.y + GUIDE.r * Math.sin(ANGLES[name]),
      );
    }
    const p = point(
      (v.A.x + v.B.x + v.C.x + v.D.x) / 4,
      (v.A.y + v.B.y + v.C.y + v.D.y) / 4,
    );
    const coef = { R: COEF.R, M: COEF.M, N: COEF.N, Q: COEF.Q };
    return Object.assign({}, v, sidePoints(v, coef), {
      P: p,
      coef: coef,
      options: {
        names: o.names === undefined ? false : !!o.names,
        helper: o.helper === undefined ? false : !!o.helper,
        hint: o.hint === undefined ? false : !!o.hint,
      },
      fromFeet: false,
      explored: false,
    });
  }

  function reset(state) {
    const s = start(state.options);
    s.options.hint = false; // the applet disables Hint whenever it is not 4-of-4
    s.explored = !!state.explored;
    return s;
  }

  /** A handle moved to q; an unknown or broken move leaves the state alone. */
  function move(state, name, q) {
    if (HANDLES.indexOf(name) < 0 || !finite(q)) return state;
    if (name === "P") {
      return Object.assign({}, state, { P: clampToView(q), explored: true });
    }
    if (["A", "B", "C", "D"].indexOf(name) >= 0) {
      const v = Object.assign({}, state, { [name]: clampToCircle(q) });
      // UpgradePoints: moving a corner rebuilds every side point from its
      // stored parameter, not just the two sides meeting at that corner.
      return Object.assign({}, v, sidePoints(v, state.coef), { explored: true });
    }
    const ends = {
      R: [state.A, state.B], M: [state.B, state.C],
      N: [state.C, state.D], Q: [state.A, state.D],
    }[name];
    const t = coefFor(q, ends[0], ends[1], true);
    return Object.assign({}, state, {
      coef: Object.assign({}, state.coef, { [name]: t }),
      [name]: mix(ends[0], ends[1], t),
      explored: true,
    });
  }

  /** The article's perpendicular-foot construction (on the side *lines*). */
  function feet(state) {
    return {
      R: foot(state.P, state.A, state.B),
      M: foot(state.P, state.B, state.C),
      N: foot(state.P, state.C, state.D),
      Q: foot(state.P, state.A, state.D),
    };
  }

  /** Put the four cut points on those feet, keeping the exact parameters. */
  function useFeet(state) {
    const f = feet(state);
    const coef = {
      R: coefFor(f.R, state.A, state.B, false),
      M: coefFor(f.M, state.B, state.C, false),
      N: coefFor(f.N, state.C, state.D, false),
      Q: coefFor(f.Q, state.A, state.D, false),
    };
    return Object.assign({}, state, sidePoints(state, coef), {
      coef: coef, fromFeet: true, explored: true,
    });
  }

  /** The second intersection of the circle through a,u,v with line a->b. */
  function secondOnCircle(a, u, v, b) {
    const cc = exactCircle(a, u, v);
    if (!cc) return null;
    const d = sub(b, a), len2 = dot(d, d);
    if (!len2) return null;
    const p = add(a, mul(d, (2 * dot(sub(cc.c, a), d)) / len2));
    return finite(p) ? p : null;
  }

  /**
   * The article's other construction: fix N on CD, then M, R and Q are
   * unique.  DNPQ turns out cyclic automatically.
   */
  function solveFromN(state) {
    const M = secondOnCircle(state.C, state.N, state.P, state.B);
    if (!M) return state;
    const R = secondOnCircle(state.B, M, state.P, state.A);
    if (!R) return state;
    const Q = secondOnCircle(state.A, R, state.P, state.D);
    if (!Q) return state;
    const coef = {
      R: coefFor(R, state.A, state.B, false),
      M: coefFor(M, state.B, state.C, false),
      N: coefFor(state.N, state.C, state.D, false),
      Q: coefFor(Q, state.A, state.D, false),
    };
    return Object.assign({}, state, {
      R: R, M: M, Q: Q, coef: coef, fromFeet: false, explored: true,
    });
  }

  /** Angle at v between v->p and v->q, in radians. */
  function angle(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (!n) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / n)));
  }

  const QUADS = [
    { name: "BRPM", u: "R", v: "B", w: "M" },
    { name: "CMPN", u: "N", v: "C", w: "M" },
    { name: "DNPQ", u: "N", v: "D", w: "Q" },
    { name: "AQPR", u: "Q", v: "A", w: "R" },
  ];

  /**
   * Canvas.Compute(): four strict tests; if exactly three pass, try all four
   * again with the relaxed tolerance.  Hint is enabled only at four of four.
   */
  function computeQuads(state) {
    const evaluate = (tol) => QUADS.map((q) => {
      const u = state[q.u], v = state[q.v], w = state[q.w], x = state.P;
      const cc = quadCircle(u, v, w, x, tol);
      return {
        name: q.name,
        circle: cc,
        gap: cc ? Math.abs(dist(v, cc.c) - cc.r) : Infinity,
        cyclic: !!cc,
      };
    });
    const strict = evaluate(STRICT);
    const strictCount = strict.filter((q) => q.cyclic).length;
    const relaxedUsed = strictCount === 3;
    const quads = relaxedUsed ? evaluate(RELAXED) : strict;
    const count = quads.filter((q) => q.cyclic).length;
    return {
      strictCount: strictCount,
      count: count,
      quads: quads,
      relaxedUsed: relaxedUsed,
      hintEnabled: count === 4,
      showHint: count === 4 && !!state.options.hint,
    };
  }

  function geometry(state) {
    return computeQuads(state);
  }

  /** An illustration: there is no win, loss, or end of a play. */
  function result(state) {
    return null;
  }

  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    // The applet's Hint checkbox is disabled until all four pieces are cyclic.
    if (name === "hint" && on && !computeQuads(state).hintEnabled) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  function describe(state) {
    const g = computeQuads(state);
    let text;
    if (g.count === 4) {
      text = "All four small quadrilaterals are cyclic; the Hint circles are available.";
    } else if (g.count === 3) {
      text = "Three of the four are cyclic; the applet also allows a 3-pixel margin.";
    } else {
      text = `${g.count} of the four small quadrilaterals are cyclic.`;
    }
    if (state.fromFeet) text += " The cut points are perpendicular feet from P, the article's construction.";
    return text;
  }

  return {
    VIEW: VIEW, GUIDE: GUIDE, ANGLES: ANGLES, COEF: COEF, PAD: PAD,
    STRICT: STRICT, RELAXED: RELAXED, QUADS: QUADS, HANDLES: HANDLES,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, mix: mix, finite: finite, clamp01: clamp01,
    intersect: intersect, circumcircle: circumcircle, exactCircle: exactCircle,
    quadCircle: quadCircle, foot: foot, coefFor: coefFor, sidePoints: sidePoints,
    clampToCircle: clampToCircle, clampToView: clampToView,
    start: start, reset: reset, move: move, feet: feet, useFeet: useFeet,
    secondOnCircle: secondOnCircle, solveFromN: solveFromN, angle: angle,
    computeQuads: computeQuads, geometry: geometry, result: result,
    setOption: setOption, describe: describe,
    legalMoves: () => HANDLES.slice(),
  };
})();
