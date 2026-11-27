"use strict";

/*
 * Crowded Chair — Alexander Bogomolny's applet CrowdedChair (cut-the-knot.org
 * /Curriculum/Geometry/CrowdedChair.shtml).
 *
 * A triangle ABC carries two squares: ABDE on AB, AFGC on AC and BHKC on BC.
 * AK meets CD at V, CE meets BF at U; the page says that AK ⟂ CD, CE ⟂ BF,
 * and that U and V lie on the circle through the square ABDE. The proof uses
 * the right angles subtended by the diameters AD and BE, and gives the
 * secant product CE·CU = CD·CV.
 *
 * This is the logic only: no document, no window, no storage. It defines one
 * global, CrowdedChairCore. Positions are plain board units. The construction
 * is a literal transcription of CrowdedChairCanvas.Compute/ComputeC/GetCircle
 * and of the GeoSDoub helpers they call (Rotate, Intersect, NearestPoint,
 * FindCircumcenter, ComputeAngle, FindOrientation).
 */

const CrowdedChairCore = (() => {
  const WIDTH = 440;
  const HEIGHT = 360;
  const SIDE = 110;                 // AB in the opening picture
  const START_ANGLE = Math.PI / 6;  // CrowdedChairCanvas.AngleA = 30 degrees
  const HALF_PI = Math.PI / 2;
  const NAMES = ["A", "B", "C"];
  const OPTION_KEYS = ["showNames", "showStatement", "showHint"];
  const MIN_SEP = 12;
  const MARGIN = 8;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const nan = () => ({ x: NaN, y: NaN });
  const clampPoint = (p) => ({
    x: Math.max(MARGIN, Math.min(WIDTH - MARGIN, p.x)),
    y: Math.max(MARGIN, Math.min(HEIGHT - MARGIN, p.y)),
  });

  /** GeoSDoub.Rotate(center, point, angle, dir): dir = +1 turns by +angle. */
  function rotate(center, point, angle, dir) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = point.x - center.x, dy = point.y - center.y;
    return {
      x: center.x + c * dx - dir * s * dy,
      y: center.y + dir * s * dx + c * dy,
    };
  }

  /** GeoSDoub.Intersect of the two infinite lines a-b and c-d; NaN if parallel. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return nan(); // the applet's own tolerance
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.NearestPoint(p, a, b): the foot of the perpendicular to line a-b. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy < 0.1) return p;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.FindCircumcenter, built from the two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const m1 = mid(a, b), m2 = mid(b, c);
    const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return intersect(m1, p, m2, q);
  }

  /** CrowdedChairCanvas.GetCircle: centre from three points, mean of the radii. */
  function circleThrough(a, b, c) {
    const center = circumcenter(a, b, c);
    if (!finite(center)) return null;
    const radius = (dist(center, a) + dist(center, b) + dist(center, c)) / 3;
    return Number.isFinite(radius) && radius > 0 ? { center, radius } : null;
  }

  /** GeoSDoub.ComputeAngle: the (unsigned) angle at a, by the cosine law. */
  function computeAngle(a, b, c) {
    const ab = dist(a, b), ac = dist(a, c);
    if (!ab || !ac) return NaN;
    const numerator = ab * ab + ac * ac - dist(b, c) * dist(b, c);
    return Math.acos(Math.max(-1, Math.min(1, numerator / (2 * ab * ac))));
  }

  /** GeoSDoub.FindOrientation: 1 when A, B, C turn left, else -1. */
  function findOrientation(a, b, c) {
    return cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1;
  }

  /** CrowdedChairCanvas.ComputeC: keep AngleA and rebuild C after moving A or B. */
  function computeC(A, B, angleA) {
    const S1 = rotate(A, B, -angleA, -1);
    const S2 = rotate(B, A, HALF_PI - angleA, 1);
    return intersect(A, S1, B, S2);
  }

  /** The whole "Bride's Chair" construction at a position. */
  function compute(state) {
    if (!state || !finite(state.A) || !finite(state.B) || !finite(state.C)) {
      return { degenerate: true };
    }
    const { A, B, C } = state;
    const K = rotate(B, C, HALF_PI, 1);
    const H = rotate(C, B, HALF_PI, -1);
    const G = rotate(C, A, HALF_PI, 1);
    const F = rotate(A, C, HALF_PI, -1);
    const E = rotate(A, B, HALF_PI, 1);
    const D = rotate(B, A, HALF_PI, -1);
    const L = nearestPoint(C, D, E);
    const M = nearestPoint(C, A, B);
    const U = intersect(E, C, F, B);   // CE ∩ BF
    const V = intersect(C, D, A, K);   // CD ∩ AK
    if (![K, H, G, F, E, D, L, M, U, V].every(finite)) return { degenerate: true };
    const circle = circleThrough(E, D, U);
    if (!circle) return { degenerate: true };
    return { degenerate: false, A, B, C, K, H, G, F, E, D, L, M, U, V, circle };
  }

  /**
   * Dimensionless residuals for every claim on the page. Zero means the claim
   * holds; they are relative, so they work at any board scale.
   */
  function residuals(state, g) {
    if (!g || g.degenerate) return null;
    const { A, B, C, D, E, F, K, U, V, circle } = g;
    const { center, radius } = circle;
    const perpendicular = (p, q, r, s) =>
      Math.abs(dot(sub(q, p), sub(s, r))) / (dist(p, q) * dist(r, s) || 1);
    const product = (p, q) => dist(C, p) * dist(C, q);
    const ceCu = product(E, U), cdCv = product(D, V);
    return {
      perpAKCD: perpendicular(A, K, C, D),
      perpCEBF: perpendicular(B, F, C, E),
      rightAtU: Math.abs(dot(sub(E, U), sub(B, U))) / (dist(U, E) * dist(U, B) || 1),
      rightAtV: Math.abs(dot(sub(A, V), sub(D, V))) / (dist(V, A) * dist(V, D) || 1),
      onCircle: Math.max(...[A, B, D, E, U, V].map((p) => Math.abs(dist(center, p) - radius))) / radius,
      squareCentre: Math.max(dist(center, mid(A, D)), dist(center, mid(B, E)),
        Math.abs(radius - dist(A, D) / 2)) / radius,
      // Applet labels: U on CE, V on CD. The page's sentence swaps them.
      secants: Math.abs(ceCu - cdCv) / (ceCu || 1),
      secantsPageLabels: Math.abs(product(E, V) - product(D, U)) / (product(E, V) || 1),
    };
  }

  /** The opening picture. A and B sit on a horizontal line; C comes from ComputeC. */
  function start(options) {
    const o = options || {};
    const A = { x: 0.2 * WIDTH, y: 1.5 * SIDE + 22 };
    const B = { x: A.x + SIDE, y: A.y };
    const C = computeC(A, B, START_ANGLE);
    const state = {
      A, B, C: finite(C) ? C : nan(),
      angleA: START_ANGLE,
      showNames: false,
      showStatement: false,
      showHint: false,
      moves: 0,
      explored: false,
    };
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    return state;
  }

  /** Drag a corner, tick one of the three applet checkboxes, or reset. */
  function legalMoves(state) {
    return [
      ...NAMES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /**
   * Move one corner. A and B are clamped to the board and C is recomputed from
   * AngleA, exactly as ComputeC does in the applet; C itself is restricted to
   * the circle through A, B and C (mousePressed/RestrictToCircle) and AngleA is
   * then read off with ComputeAngle. Finally, UpgradePoints swaps A and B when
   * FindOrientation(A, B, C) is 1.
   */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!NAMES.includes(m.name) || !finite(m.point)) return null;
      if (m.name === "C") {
        const circle = circleThrough(state.A, state.B, state.C);
        if (!circle) return null;
        const v = sub(m.point, circle.center);
        const d = Math.hypot(v.x, v.y);
        if (d < 1e-9) return null;
        const C = add(circle.center, mul(v, circle.radius / d));
        const angleA = computeAngle(state.A, state.B, C);
        if (!finite(C) || !Number.isFinite(angleA)) return null;
        next = { ...state, C, angleA };
      } else {
        const p = clampPoint(m.point);
        if (NAMES.some((n) => n !== m.name && dist(p, state[n]) < MIN_SEP)) return null;
        const A = m.name === "A" ? p : state.A;
        const B = m.name === "B" ? p : state.B;
        const C = computeC(A, B, state.angleA);
        if (!finite(C)) return null;
        next = { ...state, [m.name]: p, C };
      }
      if (findOrientation(next.A, next.B, next.C) === 1) {
        next = { ...next, A: next.B, B: next.A };
      }
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
    WIDTH, HEIGHT, SIDE, START_ANGLE, NAMES, OPTION_KEYS, MIN_SEP, MARGIN,
    add, sub, mul, dot, cross, dist, mid, finite, clampPoint,
    rotate, intersect, nearestPoint, circumcenter, circleThrough,
    computeAngle, findOrientation, computeC, compute, residuals,
    start, legalMoves, move, result,
  };
})();
