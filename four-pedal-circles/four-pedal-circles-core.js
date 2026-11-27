"use strict";

/*
 * Four Pedal Circles — the geometry behind Alexander Bogomolny's applet
 * FourPedalCircles (cut-the-knot.org/Curriculum/Geometry/FourPedalCircles.shtml).
 *
 * A complete quadrangle is four points A, B, C, D and the six lines joining
 * them. Taken three at a time they make four triangles. For a fifth point P we
 * drop perpendiculars from P to a triangle's three sides; the three feet lie
 * on that triangle's pedal circle. The page's claim is that the four pedal
 * circles all pass through one point Q. The applet finds Q by intersecting
 * the circles ABC and ABD at their second common point (the first is the foot
 * on AB), doing the same for ACD and BCD (common foot CD), and averaging the
 * two answers. That is exactly what Compute() below does.
 *
 * This file is the logic only: no document, no window, no storage. It defines
 * one global, FourPedalCirclesCore. Positions are plain data so the page and
 * the tutor can share them. Functions do not mutate what they are given.
 */
const FourPedalCirclesCore = (() => {
  // The applet's canvas is 400 by 300 (its getParameterInfo says "400 will do",
  // "300 will do"). Canvas.init places the five draggable points like this.
  const WIDTH = 400;
  const HEIGHT = 300;
  const NAMES = ["A", "B", "C", "D", "P"];
  const OPTION_KEYS = ["showNames", "showTriangles", "showLines"];
  const CIRCLE_NAMES = ["ABC", "ACD", "ABD", "BCD"];

  /* ---------------------------------------------------- small vector helpers */

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => dot(sub(p, q), sub(p, q));
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const round = (v) => Math.round(v * 1000) / 1000;
  const clampPoint = (p) => ({
    x: Math.max(6, Math.min(WIDTH - 6, round(p.x))),
    y: Math.max(6, Math.min(HEIGHT - 6, round(p.y))),
  });

  /** GeoSDoub.Intersect(p1,p2,p3,p4): the line-line intersection. */
  function lineIntersection(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    // GeoSDoub.Intersect returns NaN when |det| < 1: near-parallel lines count
    // as no intersection, which is what makes a pedal circle fall back to a line.
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /**
   * GeoSDoub.NearestPoint(P,A,B): the foot of the perpendicular from P to the
   * line AB (not just the segment). The applet returns P itself when P is
   * within sqrt(0.1) of A, to avoid a degenerate foot.
   */
  function nearestPoint(p, a, b) {
    if (sqDist(a, p) < 0.1) return p;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return a;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.FindCircumcenter: intersect two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return lineIntersection(m1, p, m2, q);
  }

  /**
   * LineCircle.GetCircle: a circle through three points whose centre is the
   * circumcenter and whose radius is the mean of the three distances. If that
   * radius is at least 50000 the applet keeps a line through the two points
   * farthest apart instead (the collinear, Simson-line case).
   */
  function pedalCircle(p1, p2, p3) {
    const center = circumcenter(p1, p2, p3);
    if (finite(center)) {
      const radius = (dist(center, p1) + dist(center, p2) + dist(center, p3)) / 3;
      if (radius < 50000) return { kind: "circle", center, radius };
    }
    let line;
    if (dist(p1, p2) > dist(p1, p3)) {
      line = dist(p2, p3) > dist(p1, p2) ? [p2, p3] : [p1, p2];
    } else {
      line = dist(p2, p3) > dist(p1, p3) ? [p2, p3] : [p1, p3];
    }
    return { kind: "line", a: line[0], b: line[1] };
  }

  /** GeoSDoub.IntersectCirclesX, written out from the bytecode. */
  function intersectCirclesX(c1, c2) {
    const k = -(c1.center.y - c2.center.y) / (c1.center.x - c2.center.x);
    const b = (c1.center.x * c1.center.x - c2.center.x * c2.center.x
      + c1.center.y * c1.center.y - c2.center.y * c2.center.y
      - c1.radius * c1.radius + c2.radius * c2.radius)
      / (2 * (c1.center.x - c2.center.x));
    const dx = b - c1.center.x;
    const x = k * dx - c1.center.y;
    const y = dx * dx + c1.center.y * c1.center.y - c1.radius * c1.radius;
    const disc = x * x - (k * k + 1) * y;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-x + root) / (k * k + 1), t2 = (-x - root) / (k * k + 1);
    return [{ x: k * t1 + b, y: t1 }, { x: k * t2 + b, y: t2 }];
  }

  /** GeoSDoub.IntersectCirclesY, the vertical-radical-axis branch. */
  function intersectCirclesY(c1, c2) {
    const k = -(c1.center.x - c2.center.x) / (c1.center.y - c2.center.y);
    const b = (c1.center.y * c1.center.y - c2.center.y * c2.center.y
      + c1.center.x * c1.center.x - c2.center.x * c2.center.x
      - c1.radius * c1.radius + c2.radius * c2.radius)
      / (2 * (c1.center.y - c2.center.y));
    const dy = b - c1.center.y;
    const x = k * dy - c1.center.x;
    const y = dy * dy + c1.center.x * c1.center.x - c1.radius * c1.radius;
    const disc = x * x - (k * k + 1) * y;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-x + root) / (k * k + 1), t2 = (-x - root) / (k * k + 1);
    return [{ x: t1, y: k * t1 + b }, { x: t2, y: k * t2 + b }];
  }

  /** GeoSDoub.Intersect(DoubCircle,DoubCircle). */
  function intersectCircles(c1, c2) {
    if (Math.abs(c1.center.x - c2.center.x) > 1) return intersectCirclesX(c1, c2);
    if (Math.abs(c1.center.y - c2.center.y) > 1) return intersectCirclesY(c1, c2);
    return [{ x: c1.center.x, y: c1.center.y }, { x: c1.center.x, y: c1.center.y }];
  }

  /** GeoSDoub.Intersect(DoubLine,DoubCircle), via projection onto the line. */
  function intersectLineCircle(line, circle) {
    const d = sub(line.b, line.a), len2 = dot(d, d);
    if (!len2) return null;
    const t = dot(sub(circle.center, line.a), d) / len2;
    const foot = add(line.a, mul(d, t));
    const h2 = circle.radius * circle.radius - sqDist(circle.center, foot);
    if (h2 < 0) return null;
    const unit = { x: d.x / Math.sqrt(len2), y: d.y / Math.sqrt(len2) };
    const h = Math.sqrt(h2);
    return [add(foot, mul(unit, h)), add(foot, mul(unit, -h))];
  }

  /** LineCircle.Intersect: circle/circle, circle/line, line/line. */
  function intersect(lc1, lc2) {
    if (lc1.kind === "circle" && lc2.kind === "circle") return intersectCircles(lc1, lc2);
    if (lc1.kind === "circle" && lc2.kind === "line") return intersectLineCircle(lc2, lc1);
    if (lc1.kind === "line" && lc2.kind === "circle") return intersectLineCircle(lc1, lc2);
    const p = lineIntersection(lc1.a, lc1.b, lc2.a, lc2.b);
    return [p, p];
  }

  /** FourPedalCirclesCanvas.Other: the intersection at least 1 unit from `p`. */
  function other(points, p) {
    if (!points || !points.length) return null;
    if (dist(points[0], p) < 1) return points[1] || points[0];
    return points[0];
  }

  /** The nine-point circle of a triangle (used by the page's related facts). */
  function ninePointCircle(a, b, c) {
    const O = circumcenter(a, b, c);
    const H = lineIntersection(a, nearestPoint(a, b, c), b, nearestPoint(b, a, c));
    if (!finite(O) || !finite(H)) return null;
    return { center: midpoint(O, H), radius: dist(O, a) / 2 };
  }

  /** Simson line of P with respect to ABC: the line through two pedal feet. */
  function simsonLine(p, a, b, c) {
    return { a: nearestPoint(p, a, b), b: nearestPoint(p, a, c) };
  }

  /** Signed distance from a point to a LineCircle (circle or line). */
  function circleDistance(p, lc) {
    if (lc.kind !== "line") return dist(p, lc.center) - lc.radius;
    const d = sub(lc.b, lc.a), len = Math.hypot(d.x, d.y);
    return len ? Math.abs(cross(sub(p, lc.a), d)) / len : dist(p, lc.a);
  }

  /* ------------------------------------------------------------- positions */

  /** The opening picture, with the applet's three checkbox defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      A: { x: WIDTH / 5, y: (HEIGHT * 2) / 3 },
      B: { x: WIDTH / 2, y: (HEIGHT * 3) / 5 },
      C: { x: WIDTH / 2 + WIDTH / 5, y: HEIGHT / 2 - HEIGHT / 5 },
      D: { x: WIDTH / 4, y: HEIGHT / 3 },
      P: { x: (WIDTH * 6) / 11, y: (HEIGHT * 3) / 4 },
      showNames: true,       // the applet's ShowNames parameter defaults to "1"
      showTriangles: false,  // the other two checkboxes start unticked
      showLines: false,
      moves: 0,
      explored: false,
    };
    for (const name of NAMES) {
      if (o[name] && finite(o[name])) state[name] = clampPoint(o[name]);
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    return state;
  }

  /**
   * The whole construction at a position. `circles` is in the applet's order:
   * ABC, ACD, ABD, BCD; `Q` is the midpoint of the two "other" intersections.
   */
  function compute(state) {
    const { A, B, C, D, P } = state;
    if (![A, B, C, D, P].every(finite)) return { degenerate: true };
    const quad = [A, B, C, D]; // P may sit on a vertex: that is the Simson case
    for (let i = 0; i < quad.length; i++) {
      for (let j = i + 1; j < quad.length; j++) {
        if (dist(quad[i], quad[j]) < 0.5) return { degenerate: true };
        for (let k = j + 1; k < quad.length; k++) {
          if (Math.abs(cross(sub(quad[j], quad[i]), sub(quad[k], quad[i]))) < 1e-6) {
            return { degenerate: true };
          }
        }
      }
    }
    const feet = {
      ab: nearestPoint(P, A, B), ac: nearestPoint(P, A, C), ad: nearestPoint(P, A, D),
      bc: nearestPoint(P, B, C), bd: nearestPoint(P, B, D), cd: nearestPoint(P, C, D),
    };
    const circles = {
      ABC: pedalCircle(feet.ab, feet.bc, feet.ac),
      ACD: pedalCircle(feet.ac, feet.cd, feet.ad),
      ABD: pedalCircle(feet.ab, feet.bd, feet.ad),
      BCD: pedalCircle(feet.bc, feet.cd, feet.bd),
    };
    const pair1 = other(intersect(circles.ABC, circles.ABD), feet.ab);
    const pair2 = other(intersect(circles.ACD, circles.BCD), feet.cd);
    if (!finite(pair1) || !finite(pair2)) return { degenerate: true, feet, circles };
    const Q = midpoint(pair1, pair2);
    if (!finite(Q)) return { degenerate: true, feet, circles };
    return {
      degenerate: false,
      feet, circles, Q,
      x13: pair1, x24: pair2,
      gap: dist(pair1, pair2),
      nineCircles: {
        BCD: ninePointCircle(B, C, D), ACD: ninePointCircle(A, C, D),
        ABD: ninePointCircle(A, B, D), ABC: ninePointCircle(A, B, C),
      },
      simson: {
        A: simsonLine(A, B, C, D), B: simsonLine(B, A, C, D),
        C: simsonLine(C, A, B, D), D: simsonLine(D, A, B, C),
      },
    };
  }

  /**
   * Residuals behind the claims on the page, for the logic test and the
   * status line. `onCircles` is the largest distance from Q to a pedal circle.
   */
  function residuals(state, g) {
    if (g.degenerate) return null;
    const perpendicular = (p, f, x, y) => Math.abs(dot(sub(p, f), sub(y, x))) / (dist(x, y) || 1);
    const sides = {
      ab: [state.A, state.B], ac: [state.A, state.C], ad: [state.A, state.D],
      bc: [state.B, state.C], bd: [state.B, state.D], cd: [state.C, state.D],
    };
    let feetError = 0;
    for (const key of Object.keys(sides)) {
      feetError = Math.max(feetError, perpendicular(state.P, g.feet[key], sides[key][0], sides[key][1]));
    }
    let onCircles = 0;
    for (const key of CIRCLE_NAMES) onCircles = Math.max(onCircles, Math.abs(circleDistance(g.Q, g.circles[key])));
    return { feetError, onCircles, gap: g.gap };
  }

  /* ----------------------------------------------------------- moves / demo */

  /** The moves a player can make: drag one of five points, tick a box, reset. */
  function legalMoves(state) {
    return [
      ...NAMES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!NAMES.includes(m.name) || !finite(m.point)) return null;
      const p = clampPoint(m.point);
      if (NAMES.some((n) => n !== m.name && dist(p, state[n]) < 12)) return null;
      next = { ...state, [m.name]: p };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = { ...start(), ...Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])) };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A picture has nothing to win: it counts as played once it has changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  return {
    WIDTH, HEIGHT, NAMES, OPTION_KEYS, CIRCLE_NAMES,
    add, sub, mul, dot, cross, dist, sqDist, midpoint, finite, clampPoint,
    lineIntersection, nearestPoint, circumcenter, pedalCircle, circleDistance,
    intersectCircles, intersectCirclesX, intersectCirclesY, intersectLineCircle,
    intersect, other, ninePointCircle, simsonLine,
    start, compute, residuals, legalMoves, move, result,
  };
})();
