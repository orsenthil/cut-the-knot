"use strict";

/*
 * Broken Chord Paper Folding — the geometry behind Alexander Bogomolny's
 * applet BrokenChordPaperFolding
 * (cut-the-knot.org/Curriculum/Geometry/BrokenChordPaperFolding.shtml).
 *
 * The broken chord theorem says that when P is the midpoint of arc ACB on the
 * circumcircle of triangle ABC and PM is perpendicular to the longer of AC and
 * BC, the foot M splits the broken line A-C-B in half: AM = MC + CB (when AC
 * is the longer side). The paper-folding proof reflects the far end B in the
 * crease PC; its image F falls on the extension of AC with CF = CB, and M is
 * the midpoint of AF.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, BrokenChordPaperFoldingCore. The position is
 * plain data and functions take a position and return a new one. The
 * construction below follows the applet's Compute(), FindP() and FindF()
 * method by method, including its "distance < 1" fallbacks and the sign test
 * that picks the arc midpoint on C's side of AB.
 */

const BrokenChordPaperFoldingCore = (() => {
  const WIDTH = 600;
  const HEIGHT = 450;
  const HANDLES = ["A", "B", "C"];
  const OPTION_KEYS = ["showNames", "showHint", "showLines", "showAngles", "showExtra"];
  // init(): centre (width/2, 3*height/5), radius 2/5 of min(width/2, 3*height/5),
  // then A at angle PI, B at -0.2 and C at -0.8975979010256552 on that circle.
  const CX = WIDTH / 2;
  const CY = (HEIGHT * 3) / 5;
  const R = (Math.min(CX, CY) * 2) / 5;
  const onCircle = (angle) => ({ x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) });
  const START = {
    A: onCircle(Math.PI),
    B: onCircle(-0.2),
    C: onCircle(-0.8975979010256552),
  };

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v) => Math.round(v * 1000) / 1000;
  const clampPoint = (p) => ({
    x: round(clamp(p.x, 8, WIDTH - 8)),
    y: round(clamp(p.y, 8, HEIGHT - 8)),
  });

  /** GeoSDoub.FindOrientation: +1 for a left turn, -1 otherwise (0 counts as -1). */
  function orientation(a, b, c) {
    const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return v > 0 ? 1 : -1;
  }

  /** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint). */
  function lineIntersection(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
  }

  /** GeoSDoub.NearestPoint(p,a,b): the foot on line ab, with the applet's 0.1 guard. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return { ...p };
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.FindCircumcenter(A,B,C), from the two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const ab = midpoint(a, b), bc = midpoint(b, c);
    const q1 = { x: ab.x + (b.y - a.y), y: ab.y - (b.x - a.x) };
    const q2 = { x: bc.x + (c.y - b.y), y: bc.y - (c.x - b.x) };
    return lineIntersection(ab, q1, bc, q2);
  }

  /** GetCircle(): centre is the circumcenter, radius the mean of its three distances. */
  function getCircle(a, b, c) {
    const O = circumcenter(a, b, c);
    return { O, r: (dist(O, a) + dist(O, b) + dist(O, c)) / 3 };
  }

  /** GeoSDoub.Intersect(DoubLine,DoubCircle): the X branch of IntersectX. */
  function intersectX(p, q, O, r) {
    const k = (p.x - q.x) / (p.y - q.y);
    const b = q.x - k * q.y;
    const a = b - O.x;
    const A = k * k + 1;
    const B = k * a - O.y;
    const C = a * a + O.y * O.y - r * r;
    const disc = B * B - A * C;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const y1 = (-B + s) / A, y2 = (-B - s) / A;
    return [{ x: k * y1 + b, y: y1 }, { x: k * y2 + b, y: y2 }];
  }

  /** GeoSDoub.Intersect(DoubLine,DoubCircle): the Y branch of IntersectY. */
  function intersectY(p, q, O, r) {
    const k = (p.y - q.y) / (p.x - q.x);
    const b = q.y - k * q.x;
    const a = b - O.y;
    const A = k * k + 1;
    const B = k * a - O.x;
    const C = a * a + O.x * O.x - r * r;
    const disc = B * B - A * C;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const x1 = (-B + s) / A, x2 = (-B - s) / A;
    return [{ x: x1, y: k * x1 + b }, { x: x2, y: k * x2 + b }];
  }

  /** The circle-line intersection GeoSDoub.Intersect chooses from the line's slope. */
  function circleLine(p, q, O, r) {
    if (Math.abs(q.y - p.y) > 1) return intersectX(p, q, O, r);
    if (Math.abs(q.x - p.x) > 1) return intersectY(p, q, O, r);
    return null;
  }

  /** FindP(): the perpendicular bisector of AB meets the circle; keep C's arc. */
  function findP(a, b, c, circle) {
    const mid = midpoint(a, b);
    const q = { x: mid.x + (b.y - a.y), y: mid.y - (b.x - a.x) };
    const both = circleLine(mid, q, circle.O, circle.r);
    if (!both) return { x: NaN, y: NaN };
    return orientation(both[0], a, b) === orientation(c, a, b) ? both[0] : both[1];
  }

  /** FindF(): reflect a point in the crease PC, or in P itself when PC is tiny. */
  function findF(p, P, C) {
    const foot = dist(P, C) < 1 ? P : nearestPoint(p, P, C);
    return { x: 2 * foot.x - p.x, y: 2 * foot.y - p.y };
  }

  /* ------------------------------------------------------------- positions */

  /** The opening picture, with the applet's switch defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      A: { ...START.A }, B: { ...START.B }, C: { ...START.C },
      showNames: true,       // the applet's Show parameter is "1" on the page
      showHint: false,       // the other four checkboxes start unticked
      showLines: false,
      showAngles: false,
      showExtra: false,
      moves: 0,
      explored: false,
    };
    for (const name of HANDLES) if (finite(o[name])) state[name] = clampPoint(o[name]);
    for (const key of OPTION_KEYS) if (typeof o[key] === "boolean") state[key] = o[key];
    return state;
  }

  /** A player can move A, B or C, flip a switch, or reset the picture. */
  function legalMoves(state) {
    return [
      ...HANDLES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /**
   * The applet's itemStateChanged(): hint off disables lines, angles and extra,
   * so their canvas flags are false; the checkboxes themselves keep their
   * ticks and are drawn again as soon as hint is switched back on.
   */
  function canvasFlags(state) {
    return {
      showNames: !!state.showNames,
      showHint: !!state.showHint,
      showLines: !!(state.showHint && state.showLines),
      showAngles: !!(state.showHint && state.showAngles),
      showExtra: !!(state.showHint && state.showExtra),
    };
  }

  /** Move a point, tick a switch, or reset the picture. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!HANDLES.includes(m.name) || !finite(m.point)) return null;
      next = { ...state, [m.name]: clampPoint(m.point) };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      // The page's Reset keeps the player's choice of overlays.
      next = { ...start(), ...Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])) };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A picture has no win or loss; it counts as done once it has been changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /* ---------------------------------------------------------- the picture */

  /** Compute() transcribed: circle, P, M, K, L, F, G and the crease. */
  function compute(state) {
    const A = state && state.A, B = state && state.B, C = state && state.C;
    if (!finite(A) || !finite(B) || !finite(C)) return { valid: false, reason: "invalid", noDraw: true };
    if (dist(A, B) < 1) return { valid: false, reason: "close", noDraw: true, A, B, C };

    const circle = getCircle(A, B, C);
    const P = findP(A, B, C, circle);
    if (!finite(circle.O) || !finite(P)) {
      return { valid: false, reason: "collinear", noDraw: false, A, B, C, circle, P };
    }

    const longAC = dist(A, C) > dist(B, C);
    const K = longAC ? A : B;
    const L = longAC ? B : A;
    const M = longAC ? nearestPoint(P, A, C) : nearestPoint(P, B, C);
    if (!finite(M)) return { valid: false, reason: "invalid", noDraw: false, A, B, C, circle, P };
    const F = findF(L, P, C);
    const G = findF(K, P, C);
    const linePC = dist(P, C) > 1 ? { p: P, q: C } : null;
    return {
      valid: true, reason: null, noDraw: false,
      A, B, C, circle, P, K, L, M, F, G, linePC, longAC,
    };
  }

  /** Angle at v between vp and vq, in radians in [0, PI]. */
  function angleAt(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    if (!dist(a, { x: 0, y: 0 }) || !dist(b, { x: 0, y: 0 })) return 0;
    return Math.acos(clamp(dot(a, b) / (dist(a, { x: 0, y: 0 }) * dist(b, { x: 0, y: 0 })), -1, 1));
  }

  /** Residuals of the page's claims, used by the logic test and the status line. */
  function residuals(g) {
    if (!g || !g.valid) return null;
    const { A, B, C, K, L, M, P, F, G, circle } = g;
    const onSegment = (p, a, b) => {
      const t = dot(sub(p, a), sub(b, a)) / sqDist(a, b);
      return t >= -1e-6 && t <= 1 + 1e-6;
    };
    return {
      POnCircle: Math.abs(dist(circle.O, P) - circle.r),
      arcMidpoint: Math.abs(dist(P, A) - dist(P, B)),
      rightAngle: Math.abs(dot(sub(M, P), sub(C, K))) / (dist(M, P) * dist(C, K)),
      MonSegment: onSegment(M, K, C) ? 0 : 1,
      CF: Math.abs(dist(C, F) - dist(C, L)),
      CG: Math.abs(dist(C, G) - dist(C, K)),
      FMidpoint: Math.abs(dist(K, M) - dist(M, F)),
      brokenChord: Math.abs(dist(K, M) - (dist(M, C) + dist(C, L))),
      FOnExtension: Math.abs(cross(sub(F, C), sub(K, C))) / dist(K, C),
      foldDirection: dot(sub(F, C), sub(K, C)) < 0 ? 0 : 1,
      alpha: Math.abs(angleAt(K, P, C) - angleAt(L, P, C)),
      beta: Math.abs(angleAt(L, P, K) - angleAt(C, P, K)),
      gamma: Math.abs(angleAt(K, L, C) - angleAt(P, L, C)),
      alphaPlusGamma: Math.abs(angleAt(K, P, C) + angleAt(K, L, C) - angleAt(C, P, K)),
    };
  }

  return {
    WIDTH, HEIGHT, HANDLES, OPTION_KEYS, START,
    add, sub, mul, dot, cross, dist, sqDist, midpoint, finite, clamp, clampPoint,
    orientation, lineIntersection, nearestPoint, circumcenter, getCircle,
    intersectX, intersectY, circleLine, findP, findF,
    start, legalMoves, move, result, canvasFlags, compute, angleAt, residuals,
  };
})();
