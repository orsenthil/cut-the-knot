"use strict";

/*
 * Hubert Shutrick's dissection of a triangle into a rhombus, from the applet
 * HubertsDissection on cut-the-knot.org.
 *
 * M is the midpoint of BC and Bm the midpoint of AC. When the circle centred
 * at M with radius AB meets the segment AB at N, the two small pieces can be
 * swivelled: the piece A-Bm-M-N about Bm and the piece M-N-B about M. At a
 * half-turn the outline N' N'' M M' is a rhombus of side AB, because N''M and
 * M'N' inherit MN = AB and BmM is the midline of the triangle, so MM' and
 * N'N'' are twice BmM = AB. If no such N exists the applet draws a dashed AM
 * and no pieces. The angle slider just animates the two rotations.
 *
 * This file is the geometry and nothing else: no document, no window. It
 * defines one global, HubertsDissectionCore, so the page loads it with a
 * plain <script> and porting/check-huberts-dissection.mjs loads it in Node.
 * Positions and results are plain data in the SVG's viewBox units.
 */
const HubertsDissectionCore = (() => {
  const WIDTH = 480;
  const HEIGHT = 320;
  const EDGE = 10;                 // room for a handle and its label
  const ANGLE_MIN = 0;             // the applet's Scrollbar(0, 0, 5, 0, 185)
  const ANGLE_MAX = 185;
  const ANGLE_START = 60;          // the canvas constructor's Angle = 60
  const OPTION_KEYS = ["showNames", "showHint"];

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const close = (a, b, tol = 1e-7) =>
    Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

  /** GeoSDoub.FindOrientation: sign of cross(B-A, C-A), never zero. */
  function orientation(a, b, c) {
    const turn = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return turn > 0 ? 1 : -1;
  }

  /** CTKGeometryPlus.Barycenter: the three points' arithmetic mean. */
  function barycenter(a, b, c) {
    return point((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
  }

  /** InsideTest.IsInside(p, a, b): (p-a).(p-b) <= 0. */
  function inside(p, a, b) {
    return dot(sub(p, a), sub(p, b)) <= 0;
  }

  /** GeoSDoub.Rotate(o, p, angle, sense): the sign multiplies the sine term. */
  function rotate(o, p, angle, sense) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const dx = p.x - o.x, dy = p.y - o.y;
    return point(o.x + cos * dx - sense * sin * dy,
      o.y + sense * sin * dx + cos * dy);
  }

  /* GeoSDoub.Intersect(DoubLine, DoubCircle) is not a general line-circle
   * solver: IntersectX solves for y when |dy| > 1, IntersectY for x when
   * |dx| > 1, and a flat line has no intersection at all. Keep that choice. */
  function lineCircle(a, b, center, radius) {
    if (Math.abs(a.y - b.y) > 1) {
      const m = (a.x - b.x) / (a.y - b.y);
      const intercept = b.x - m * b.y;
      const qa = m * m + 1;
      const qb = m * (intercept - center.x) - center.y;
      const qc = center.y * center.y
        + (intercept - center.x) * (intercept - center.x) - radius * radius;
      const disc = qb * qb - qa * qc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const y1 = (-qb + root) / qa, y2 = (-qb - root) / qa;
      return [point(m * y1 + intercept, y1), point(m * y2 + intercept, y2)];
    }
    if (Math.abs(a.x - b.x) > 1) {
      const m = (a.y - b.y) / (a.x - b.x);
      const intercept = b.y - m * b.x;
      const qa = m * m + 1;
      const qb = m * (intercept - center.y) - center.x;
      const qc = center.x * center.x
        + (intercept - center.y) * (intercept - center.y) - radius * radius;
      const disc = qb * qb - qa * qc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const x1 = (-qb + root) / qa, x2 = (-qb - root) / qa;
      return [point(x1, m * x1 + intercept), point(x2, m * x2 + intercept)];
    }
    return null;
  }

  /** The opening triangle, at the applet's own canvas proportions. */
  function start(options) {
    const o = options || {};
    const w = Number.isFinite(o.width) ? o.width : WIDTH;
    const h = Number.isFinite(o.height) ? o.height : HEIGHT;
    const s = {
      A: point(w * 5 / 12, h * 7 / 8),
      B: point(w * 3 / 5, h * 2 / 3),
      C: point(w / 2, h / 5),
      angle: ANGLE_START,
      showNames: false,
      showHint: false,
      moves: 0,
      explored: false,
    };
    for (const name of ["A", "B", "C"]) {
      if (finite(o[name])) s[name] = point(o[name].x, o[name].y);
    }
    if (Number.isFinite(o.angle)) s.angle = clamp(Math.round(o.angle), ANGLE_MIN, ANGLE_MAX);
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") s[key] = o[key];
    }
    return s;
  }

  /** Keeps a corner on the board; the angle keeps the scrollbar's range. */
  function clampPoint(p) {
    return point(clamp(p.x, EDGE, WIDTH - EDGE), clamp(p.y, EDGE, HEIGHT - EDGE));
  }

  /** A drag, an angle change, a checkbox, or Reset. Bad moves change nothing. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!["A", "B", "C"].includes(m.name) || !finite(m.point)) return null;
      next = Object.assign({}, state, { [m.name]: clampPoint(m.point) });
    } else if (m.type === "angle") {
      if (!Number.isFinite(m.value)) return null;
      next = Object.assign({}, state, {
        angle: clamp(Math.round(m.value), ANGLE_MIN, ANGLE_MAX),
      });
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = Object.assign({}, state, { [m.key]: m.value });
    } else if (m.type === "reset") {
      next = start({ angle: state.angle, showNames: state.showNames, showHint: state.showHint });
    }
    if (!next || ![next.A, next.B, next.C].every(finite)) return null;
    if (dist(next.A, next.B) < 1 || dist(next.A, next.C) < 1 || dist(next.B, next.C) < 1) return null;
    return Object.assign({}, next, { moves: state.moves + 1, explored: true });
  }

  /** The applet's legal moves, for the logic test and for keyboard play. */
  function legalMoves(state) {
    return ["A", "B", "C"].map((name) => ({ type: "point", name, point: state[name] }))
      .concat([{ type: "angle", value: state.angle + 1 },
        { type: "angle", value: state.angle - 1 }])
      .concat(OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })))
      .concat([{ type: "reset" }]);
  }

  /** HubertsDissectionCanvas.Compute(), with the applet's own N choice. */
  function compute(state) {
    const A = state.A, B = state.B, C = state.C;
    if (![A, B, C].every(finite)) return { good: false, degenerate: true };
    const seed = barycenter(A, B, C);
    const M = midpoint(B, C);          // midpoint of BC
    const Bm = midpoint(A, C);         // the applet's Bp ("B sub m")
    const sense = orientation(A, B, C);
    const ab = dist(A, B);
    const hits = lineCircle(A, B, M, ab);
    let N = null;
    if (hits && Number.isFinite(hits[0].x)) {
      if (inside(hits[0], A, B)) N = hits[0];
      else if (inside(hits[1], A, B)) N = hits[1];
    }
    if (!N) {
      return { good: false, degenerate: false, A, B, C, M, Bm, sense, hits,
        center: seed, angle: state.angle, ab };
    }

    const theta = state.angle * Math.PI / 180;
    const Mm = rotate(Bm, M, theta, -sense);
    const Np = rotate(Bm, N, theta, -sense);
    const Ap = rotate(Bm, A, theta, -sense);
    const Bp = rotate(M, B, theta, sense);
    const Npp = rotate(M, N, theta, sense);
    const center = state.angle === 180 ? barycenter(A, B, C)
      : barycenter(Npp, Bm, C);
    return {
      good: true, degenerate: false, A, B, C, M, Bm, N, sense, hits,
      angle: state.angle, theta, ab, center,
      Mm, Np, Ap, Bp, Npp,
      movingA: [Ap, Bm, Mm, Np],
      movingB: [M, Npp, Bp],
      fixed: [C, Bm, M],
      rhombus: [Np, Npp, M, Mm],
    };
  }

  /** Signed area of a polygon, used for the piece/rhombus area check. */
  function signedArea(poly) {
    if (!poly || poly.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      sum += cross(p, q);
    }
    return sum / 2;
  }

  /** Turn the construction into a half-turn rhombus, whatever the slider is. */
  function halfTurn(g) {
    if (!g || !g.good) return null;
    const turn = (o, p) => point(2 * o.x - p.x, 2 * o.y - p.y);
    const Np = turn(g.Bm, g.N);      // N', image of N about Bm
    const Npp = turn(g.M, g.N);      // N'', image of N about M
    const Mm = turn(g.Bm, g.M);      // M', image of M about Bm
    const sides = [dist(Np, Npp), dist(Npp, g.M), dist(g.M, Mm), dist(Mm, Np)];
    return { Np, Npp, Mm, sides, ab: g.ab,
      polygon: [Np, Npp, g.M, Mm], area: Math.abs(signedArea([Np, Npp, g.M, Mm])) };
  }

  /** The page's claims, tested on the half-turn picture. */
  function claims(g) {
    if (!g || !g.good) return null;
    const h = halfTurn(g);
    const parallel = (p, q) => Math.abs(cross(p, q)) <= 1e-6 * Math.max(1, dist(point(0, 0), p), dist(point(0, 0), q));
    return {
      nOnSegment: inside(g.N, g.A, g.B) && close(dist(g.M, g.N), g.ab),
      midline: close(2 * dist(g.Bm, g.M), g.ab),
      fourEqualSides: h.sides.every((s) => close(s, g.ab)),
      oppositeSidesParallel: parallel(sub(h.Npp, h.Np), sub(h.Mm, g.M))
        && parallel(sub(g.M, h.Npp), sub(h.Np, h.Mm)),
      areaPreserved: close(h.area, Math.abs(signedArea([g.A, g.B, g.C]))),
      piecesFillRhombus: close(Math.abs(signedArea(g.movingA))
        + Math.abs(signedArea(g.movingB)) + Math.abs(signedArea(g.fixed)), h.area),
    };
  }

  /** Named facts about the triangle, used to check the page's hypotheses. */
  function hypotheses(state) {
    const A = state.A, B = state.B, C = state.C;
    if (![A, B, C].every(finite)) return null;
    const M = midpoint(B, C);
    const sides = [dist(B, C), dist(C, A), dist(A, B)];
    const angles = [0, 1, 2].map((i) => {
      const o = [A, B, C][i], p = [B, C, A][i], q = [C, A, B][i];
      const c = dot(sub(p, o), sub(q, o)) / (dist(o, p) * dist(o, q) || 1);
      return Math.acos(clamp(c, -1, 1));
    });
    return {
      ab: dist(A, B),
      bm: dist(B, M),
      am: dist(A, M),
      medianLonger: dist(A, M) > dist(A, B),
      halfSideShorter: dist(B, M) < dist(A, B),
      acute: angles.every((t) => t < Math.PI / 2),
      angles,
      sides,
      area: Math.abs(signedArea([A, B, C])),
    };
  }

  /** The illustration has no winner; it counts as played once explored. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** Words for the status line; also spoken when a control is changed. */
  function describe(state, g) {
    if (!g || g.degenerate) return "Move the corners apart to make a triangle.";
    const angle = g.angle;
    if (!g.good) {
      return `At ${angle}°: no point N on AB has MN = AB here, so the cut cannot be made. The dashed line is the median AM.`;
    }
    const h = halfTurn(g);
    if (angle === 180) {
      return `At 180°: the four sides of N'N''MM' are ${h.sides.map((s) => s.toFixed(1)).join(", ")}; AB is ${g.ab.toFixed(1)}. The rhombus is complete.`;
    }
    return `At ${angle}°: the two pieces have turned part way. Move the angle to 180° and the four sides will each equal AB (${g.ab.toFixed(1)}).`;
  }

  return {
    WIDTH, HEIGHT, EDGE, ANGLE_MIN, ANGLE_MAX, ANGLE_START, OPTION_KEYS,
    point, add, sub, dot, cross, dist, midpoint, finite, clamp, close,
    orientation, barycenter, inside, rotate, lineCircle,
    start, clampPoint, move, legalMoves, compute, signedArea, halfTurn, claims,
    hypotheses, result, describe,
  };
})();
