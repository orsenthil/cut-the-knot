"use strict";

/*
 * In And Circumcenter B — the geometry behind Alexander Bogomolny's applet
 * InAndCircumcenterB (cut-the-knot.org/Curriculum/Geometry/InAndCircumcenterB.shtml).
 *
 * Three corners of a triangle can be dragged. D lies on ray B->C with BD = AB,
 * E lies on ray A->C with AE = AB. I and O are the incenter and circumcenter.
 * The page asks for two things: DE is perpendicular to IO for every triangle,
 * and when angle C is 30 degrees DE is also exactly as long as IO. The applet's
 * "hint" switch draws the proof's auxiliary points F (the second intersection
 * of AI with the circumcircle) and M (where AI meets BE).
 *
 * This is the logic only: no document, no window, no storage. It defines one
 * global, InAndCircumcenterBCore. Positions are plain data, so the page and the
 * tutor can share them. The geometric primitives below follow the applet's own
 * GeoSDoub and canvas methods, including the branch choices in line/circle
 * intersection and the averaged radii of DoubCircle.
 */

const InAndCircumcenterBCore = (() => {
  const WIDTH = 360;
  const HEIGHT = 360;
  const NAMES = ["A", "B", "C"];
  const OPTION_KEYS = ["showNames", "showStatement", "showPremise", "showHint"];
  // InAndCircumcenterBCanvas.init, scaled from the page's 450x450 applet to a
  // 360x360 viewBox: A = (w/3, 4h/5), B = (11w/15, 2h/3), C = (w/4, h/4).
  const START_POINTS = {
    A: { x: 120, y: 288 },
    B: { x: 264, y: 240 },
    C: { x: 90, y: 90 },
  };
  const MIN_SEPARATION = 12;
  const EDGE = 6;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampPoint = (p) => ({
    x: clamp(p.x, EDGE, WIDTH - EDGE),
    y: clamp(p.y, EDGE, HEIGHT - EDGE),
  });
  const twiceArea = (a, b, c) => cross(sub(b, a), sub(c, a));

  /* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint): three line
     coefficients, a determinant guard of 1 (not an epsilon), NaN on failure. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
  }

  /** GeoSDoub.FindOrientation: 1 for a left turn, -1 otherwise (zero is -1). */
  function orientation(a, b, c) {
    const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - a.y * b.x;
    return v > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeAngle: law of cosines at the first argument. */
  function angle(a, b, c) {
    const cosine = ((sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) / 2) / (dist(a, b) * dist(a, c));
    return Math.acos(clamp(cosine, -1, 1));
  }

  /** GeoSDoub.Rotate: rotate q about p by t, with the applet's orientation sign. */
  function rotate(p, q, t, sign) {
    const co = Math.cos(t), si = Math.sin(t);
    const dx = q.x - p.x, dy = q.y - p.y;
    return {
      x: p.x + co * dx - sign * si * dy,
      y: p.y + sign * si * dx + co * dy,
    };
  }

  /** GeoSDoub.FindIncenter: rotate two sides by half their angles and meet. */
  function findIncenter(a, b, c) {
    const halfA = angle(a, b, c) / 2;
    const halfB = angle(b, c, a) / 2;
    const sign = orientation(a, b, c);
    return intersect(a, rotate(a, b, halfA, sign), b, rotate(b, c, halfB, sign));
  }

  /** GeoSDoub.FindCircumcenter: meet two rotated perpendicular bisectors. */
  function findCircumcenter(a, b, c) {
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return intersect(m1, p, m2, q);
  }

  /** GeoSDoub.NearestPoint: foot on the whole line ab, with its short guard. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, b) < 0.1) return p;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** InAndCircumcenterBCanvas.GetIncircle: FindIncenter and the mean radius. */
  function incircle(a, b, c) {
    const center = findIncenter(a, b, c);
    const radius = (dist(center, nearestPoint(center, a, b))
      + dist(center, nearestPoint(center, b, c))
      + dist(center, nearestPoint(center, c, a))) / 3;
    return { center, radius };
  }

  /** InAndCircumcenterBCanvas.GetCircumcircle: same mean of three radii. */
  function circumcircle(a, b, c) {
    const center = findCircumcenter(a, b, c);
    const radius = (dist(center, a) + dist(center, b) + dist(center, c)) / 3;
    return { center, radius };
  }

  /** GeoSDoub.Intersect(DoubLine,DoubCircle), including its x/y branch. */
  function lineCircle(p, q, circle) {
    let slope, intercept, axis;
    if (Math.abs(p.y - q.y) > 1) {
      slope = (p.x - q.x) / (p.y - q.y);
      intercept = q.x - slope * q.y;
      axis = "y";
    } else if (Math.abs(p.x - q.x) > 1) {
      slope = (p.y - q.y) / (p.x - q.x);
      intercept = q.y - slope * q.x;
      axis = "x";
    } else return null;
    const center = circle.center;
    const offset = axis === "y" ? intercept - center.x : intercept - center.y;
    const along = axis === "y" ? center.y : center.x;
    const aa = slope * slope + 1;
    const bb = slope * offset - along;
    const cc = along * along + offset * offset - circle.radius * circle.radius;
    const disc = bb * bb - aa * cc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
    return axis === "y"
      ? [{ x: slope * t1 + intercept, y: t1 }, { x: slope * t2 + intercept, y: t2 }]
      : [{ x: t1, y: slope * t1 + intercept }, { x: t2, y: slope * t2 + intercept }];
  }

  /** InAndCircumcenterBCanvas.Other: the intersection farther from p. */
  function other(points, p) {
    if (!points || points.length < 2) return null;
    const first = points[0], second = points[1];
    return dist(first, p) >= dist(second, p) ? first : second;
  }

  /** InAndCircumcenterBCanvas.PlacePoint(p,q,r): p + (r-p)*|pq|/|pr|. */
  function placePoint(p, q, r) {
    const length = dist(p, q) / dist(p, r);
    return { x: p.x + (r.x - p.x) * length, y: p.y + (r.y - p.y) * length };
  }

  /* ------------------------------------------------------------- positions */

  /** The opening picture, with the applet's option defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      A: { ...START_POINTS.A }, B: { ...START_POINTS.B }, C: { ...START_POINTS.C },
      showNames: true,       // the applet's ShowNames parameter defaults to 1
      showStatement: false,  // the other three checkboxes start unticked
      showPremise: false,
      showHint: false,
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

  /** The whole construction at a position, or { degenerate: true }. */
  function compute(state) {
    const A = state.A, B = state.B, C = state.C;
    if (![A, B, C].every(finite) || Math.abs(twiceArea(A, B, C)) < 1e-6) {
      return { degenerate: true };
    }
    const inCircle = incircle(A, B, C);
    const outCircle = circumcircle(A, B, C);
    const D = placePoint(B, A, C);
    const E = placePoint(A, B, C);
    const hits = lineCircle(A, inCircle.center, outCircle);
    const F = other(hits, A);
    const M = F ? intersect(B, E, A, F) : { x: NaN, y: NaN };
    const O = outCircle.center, I = inCircle.center;
    // GeoSDoub.Intersect(DoubLine,DoubLine): IO and DE, extended if needed.
    const S = intersect(I, O, D, E);
    const ok = [I, O, D, E, F, M, S].every(finite) && outCircle.radius > 0;
    return {
      degenerate: !ok,
      A, B, C, I, O, D, E, F, M, S,
      inRadius: inCircle.radius, outRadius: outCircle.radius,
      angleC: angle(C, A, B),
      IO: dist(I, O), DE: dist(D, E),
    };
  }

  /** Signed residuals of the page's claims, for the status line and the test. */
  function claims(g) {
    if (g.degenerate) return null;
    const u = sub(g.E, g.D), v = sub(g.O, g.I);
    const cosine = dot(u, v) / ((dist(g.E, g.D) * dist(g.O, g.I)) || 1);
    const expected = 2 * Math.sin(g.angleC);
    return {
      // zero means DE perpendicular to IO
      orthogonality: Math.abs(cosine),
      // DE / IO is expected to be 2 sin(C), so 1 exactly when C = 30 degrees
      ratioError: Math.abs(g.DE / (g.IO || 1) - expected),
      // the proof's helper facts
      bfEqualsEf: Math.abs(dist(g.B, g.F) - dist(g.E, g.F)),
      bfEqualsIf: Math.abs(dist(g.B, g.F) - dist(g.I, g.F)),
      beEqualsIf: Math.abs(dist(g.B, g.E) - dist(g.I, g.F)),
      mIsMidpoint: dist(g.M, { x: (g.B.x + g.E.x) / 2, y: (g.B.y + g.E.y) / 2 }),
      sOnBothLines: Math.max(Math.abs(cross(sub(g.S, g.I), sub(g.O, g.I))),
        Math.abs(cross(sub(g.S, g.D), sub(g.E, g.D)))) / 100,
    };
  }

  /** The moves a player can make: drag a corner, tick a box, or reset. */
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
      if (NAMES.some((n) => n !== m.name && dist(p, state[n]) < MIN_SEPARATION)) return null;
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

  /** A picture has nothing to win: it counts as played once it has been changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  return {
    WIDTH, HEIGHT, NAMES, OPTION_KEYS, START_POINTS, MIN_SEPARATION, EDGE,
    add, sub, mul, dot, cross, sqDist, dist, finite, clamp, clampPoint, twiceArea,
    intersect, orientation, angle, rotate, findIncenter, findCircumcenter,
    nearestPoint, incircle, circumcircle, lineCircle, other, placePoint,
    start, compute, claims, legalMoves, move, result,
  };
})();
