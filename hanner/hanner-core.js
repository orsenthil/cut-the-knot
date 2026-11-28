"use strict";

/*
 * Hanner, from Alexander Bogomolny's applet Hanner (Olof Hanner's Jigsaw
 * Puzzle). The page calls it "an uncentered Perigal's dissection": a right
 * triangle ABC has squares on all three sides, and five pieces cut from the
 * square on the hypotenuse slide, without turning, into the two squares on
 * the legs. That is the Pythagorean theorem as a sliding jigsaw.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, HannerCore, so the page and
 * porting/check-hanner.mjs can use the same code. Positions are plain objects
 * and every function returns a new position. The point and polygon routines
 * follow GeoSDoub's bytecode exactly (including the sign of Rotate, the
 * < 1 near-parallel test in Intersect, and the choice between the two
 * collectors); the one collector the old applet left empty is left empty.
 */
const HannerCore = (() => {
  const VIEW = { width: 520, height: 460 };
  const NAMES = ["A", "B", "C"];
  const OPTION_NAMES = ["hint"];
  const HALF_PI = Math.PI / 2;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dist = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

  /** GeoSDoub.Rotate(p, q, a, dir): q turned about p by dir*a. */
  function rotate(p, q, a, dir) {
    const co = Math.cos(a), si = Math.sin(a);
    return {
      x: p.x + co * (q.x - p.x) - dir * si * (q.y - p.y),
      y: p.y + dir * si * (q.x - p.x) + co * (q.y - p.y),
    };
  }

  /** GeoSDoub.Intersect(p1, p2, p3, p4): NaN point if |denominator| < 1. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const den = a1 * b2 - a2 * b1;
    if (!(Math.abs(den) >= 1)) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
  }

  /** GeoSDoub.NearestPoint(p, a, b): foot of the perpendicular to line ab. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = sqDist(a, b);
    if (!(len2 >= 0.1)) return a;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  /** GeoSDoub.GetParallelTo(p, q, r) = p + 100*(r-q). */
  function parallelPoint(p, q, r) {
    return { x: p.x + 100 * (r.x - q.x), y: p.y + 100 * (r.y - q.y) };
  }

  function computeAngle(v, p, q) {
    const num = sqDist(v, p) + sqDist(v, q) - sqDist(p, q);
    const d = num / 2 / dist(v, p) / dist(v, q);
    return Math.acos(clamp(d, -1, 1));
  }

  /** GeoSDoub.FindOrientation: 1 for clockwise in screen coordinates. */
  function orientation(p, q, r) {
    const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + (p.x * q.y - q.x * p.y);
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.FindCircumcenter plus GetCircle's averaged radius. */
  function circumcircle(a, b, c) {
    const mab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const mbc = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const u = {
      x: mab.x + a.y - b.y,
      y: mab.y - a.x + b.x,
    };
    const v = {
      x: mbc.x + b.y - c.y,
      y: mbc.y - b.x + c.x,
    };
    const center = intersect(mab, u, mbc, v);
    const radius = (dist(center, a) + dist(center, b) + dist(center, c)) / 3;
    return { c: center, r: radius };
  }

  /** The old canvas's ComputeC(): C is the raised apex of a right triangle. */
  function computeC(a, b, angle) {
    const rayA = rotate(a, b, angle, -1);
    const rayB = rotate(b, a, HALF_PI - angle, 1);
    return intersect(a, rayA, b, rayB);
  }

  function clampPoint(p) {
    return {
      x: clamp(Number(p && p.x) || 0, 0, VIEW.width),
      y: clamp(Number(p && p.y) || 0, 0, VIEW.height),
    };
  }

  function projectOnCircle(p, circle) {
    const d = dist(p, circle.c);
    if (!(d > 1e-12)) return { x: circle.c.x + circle.r, y: circle.c.y };
    const f = circle.r / d;
    return {
      x: circle.c.x + (p.x - circle.c.x) * f,
      y: circle.c.y + (p.y - circle.c.y) * f,
    };
  }

  /** The applet starts at width/3, 2*width/3 and 9/16 of its height. */
  function start(options) {
    const A = { x: VIEW.width / 3, y: VIEW.height * 9 / 16 };
    const B = { x: VIEW.width - A.x, y: A.y };
    const angle = Math.PI / 6;
    return {
      A, B, C: computeC(A, B, angle), angleA: angle,
      circle: null,
      options: Object.assign({ hint: false }, options || {}),
      explored: false,
    };
  }

  function legalMoves() {
    return NAMES.slice();
  }

  function setOption(state, name, value) {
    if (!OPTION_NAMES.includes(name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: Boolean(value) }),
      explored: true,
    });
  }

  /** mousePressed on C makes it glide on the triangle's circumcircle. */
  function beginDrag(state, name) {
    if (name !== "C") return state;
    return Object.assign({}, state, { circle: circumcircle(state.A, state.B, state.C) });
  }

  /** Clicking the triangle (Fix(0)) releases C from that circle. */
  function freeC(state) {
    if (!state.circle) return state;
    return Object.assign({}, state, { circle: null, explored: true });
  }

  /**
   * One drag. UpgradePoints runs on mouseDragged and again on mouseReleased,
   * so the released position is the result of two upgrades: gliding C onto
   * the circle (when held), recomputing C from angleA when A or B moves,
   * updating angleA for C, then swapping A and B exactly when the old
   * FindOrientation test returns 1.
   */
  function upgrade(next, name) {
    if (name === "C") next.angleA = computeAngle(next.A, next.B, next.C);
    else if (name === "A" || name === "B") next.C = computeC(next.A, next.B, next.angleA);
    if (orientation(next.A, next.B, next.C) === 1) {
      const swap = next.A;
      next.A = next.B;
      next.B = swap;
    }
  }

  function move(state, name, point) {
    if (!NAMES.includes(name)) return state;
    const p = clampPoint(point);
    const next = Object.assign({}, state, { explored: true });
    if (name === "C") {
      next.C = state.circle ? projectOnCircle(p, state.circle) : p;
    } else {
      next[name] = p;
    }
    upgrade(next, name);
    upgrade(next, name);
    return next;
  }

  function reset(state) {
    return start(state.options);
  }

  /* Nothing can be won or lost; exploring the drawing finishes a play. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  const copy = (poly) => poly.map((p) => ({ x: p.x, y: p.y }));
  const gather = (...points) => points.map((p) => ({ x: p.x, y: p.y }));
  const translate = (poly, dx, dy) => poly.map((p) => ({ x: p.x + dx, y: p.y + dy }));

  /**
   * Canvas.Compute(): the three squares, the two sets of five pieces and
   * the hint points. The bytecode's CollectEqual is an empty method, so an
   * almost isosceles right triangle has no freshly drawn pieces here.
   */
  function geometry(state) {
    const { A, B, C } = state;
    if (Number.isNaN(C.x) || Number.isNaN(C.y)) {
      return { A, B, C, branch: "none", poly: [], trans: [] };
    }
    const a = dist(B, C), b = dist(A, C);
    const aIsGreater = a > b;
    const equal = Math.abs(a - b) < 0.5;

    const Cq = rotate(B, C, HALF_PI, 1);
    const Aq = rotate(C, B, HALF_PI, -1);
    const Bq = rotate(C, A, HALF_PI, 1);
    const Cp = rotate(A, C, HALF_PI, -1);
    const Ap = rotate(B, A, HALF_PI, -1);
    const Bp = rotate(A, B, HALF_PI, 1);
    const M = nearestPoint(C, A, B);
    const Mp = nearestPoint(C, Ap, Bp);
    const throughC = parallelPoint(C, A, B);

    let branch = "equal", Ma = null, Mb = null, K = null, poly = [], trans = [];
    if (aIsGreater) {
      branch = "a";
      Ma = intersect(B, Cq, C, throughC);
      Mb = intersect(B, Ap, Aq, Cq);
      K = intersect(B, Mb, C, throughC);
      poly = [
        gather(B, K, Ma),
        gather(B, K, C),
        gather(K, Ma, Cq, Mb),
        gather(K, Mb, Aq, C),
        gather(A, C, Bq, Cp),
      ];
      trans = [
        translate(poly[0], A.x - K.x, A.y - K.y),
        translate(poly[1], B.x - K.x, B.y - K.y),
        translate(poly[2], Bp.x - K.x, Bp.y - K.y),
        translate(poly[3], Ap.x - K.x, Ap.y - K.y),
        translate(poly[4], M.x - Bq.x, M.y - Bq.y),
      ];
    } else if (!equal) {
      branch = "b";
      Ma = intersect(A, Cp, C, throughC);
      Mb = intersect(A, Bp, Cp, Bq);
      K = intersect(A, Mb, C, throughC);
      poly = [
        gather(A, K, C),
        gather(A, K, Ma),
        gather(K, C, Bq, Mb),
        gather(K, Mb, Cp, Ma),
        gather(Aq, C, B, Cq),
      ];
      trans = [
        translate(poly[0], A.x - K.x, A.y - K.y),
        translate(poly[1], M.x - Ma.x, M.y - Ma.y),
        translate(poly[2], 2 * A.x - Mb.x - K.x, 2 * A.y - Mb.y - K.y),
        translate(poly[3], Ap.x - K.x, Ap.y - K.y),
        translate(poly[4], M.x - Aq.x, M.y - Aq.y),
      ];
    }

    return {
      A, B, C, Ap, Aq, Bp, Bq, Cp, Cq, M, Mp, Ma, Mb, K,
      a, b, branch, poly, trans,
      squares: {
        hypotenuse: [A, B, Ap, Bp],
        onAC: [A, Cp, Bq, C],
        onBC: [C, Aq, Cq, B],
      },
    };
  }

  function polyArea(poly) {
    let twice = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      twice += p.x * q.y - q.x * p.y;
    }
    return Math.abs(twice / 2);
  }

  function describe(state) {
    const g = geometry(state);
    const legSum = g.a * g.a + g.b * g.b;
    const hyp = sqDist(g.A, g.B);
    if (g.poly.length !== 5) {
      return "The two legs are the same length here. The old applet's equal-leg case draws no fresh pieces.";
    }
    const right = Math.abs((g.A.x - g.C.x) * (g.B.x - g.C.x) +
      (g.A.y - g.C.y) * (g.B.y - g.C.y)) < 1e-6 * Math.max(1, legSum);
    const rounded = (v) => Math.round(v / 100) * 100;
    if (!right) {
      return "The five pieces no longer fill both squares: the triangle is not right. Drag A or B to put C back on the circle.";
    }
    return "Five pieces slide into the two leg squares. Square on the hypotenuse " +
      rounded(hyp) + ", two leg squares together " + rounded(legSum) +
      (state.options.hint ? ". The hint shows the slide line from C." : ".");
  }

  return {
    VIEW, NAMES, OPTION_NAMES, HALF_PI,
    start, legalMoves, move, beginDrag, freeC, setOption, reset, result,
    geometry, describe, clampPoint, computeC, computeAngle, orientation,
    circumcircle, projectOnCircle, polyArea,
    rotate, intersect, nearestPoint, parallelPoint, dist, sqDist, copy,
  };
})();
