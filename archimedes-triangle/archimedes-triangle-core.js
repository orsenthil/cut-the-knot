"use strict";

/*
 * Archimedes Triangle — the geometry behind Alexander Bogomolny's applet
 * ArchimedesTriangle (cut-the-knot.org/Curriculum/Geometry/ArchimedesTriangle.shtml).
 *
 * Pick two points A and B on a parabola. The tangents there meet at S, and the
 * chord AB is the base of "Archimedes' triangle" ABS. The line from S to the
 * midpoint M of the base is parallel to the axis of the parabola; the tangent
 * at the point O where it crosses the parabola cuts the sides at their
 * midpoints A1 and B1, and O is the midpoint of MS. Archimedes used the inner
 * triangle ABO to fill the parabolic segment with triangles, proving that the
 * segment has 2/3 of the area of ABS.
 *
 * The position is plain data (two parabola parameters and four switches), so
 * it can be saved for the tutor. This file touches no DOM, no window and no
 * storage. It defines one global, ArchimedesTriangleCore.
 *
 * Coordinates are the applet's screen coordinates: x to the right, y down.
 * With a = 60 the parabola is y = VY - t*t/(4a), where t = x - CX; its focus
 * is at (CX, VY - a) and its directrix at y = VY + a.
 */
const ArchimedesTriangleCore = (() => {
  // The applet's own numbers: a=60, Dh=100, Tt1=180, Tt2=-130. Its canvas is
  // 400x300; we give it 20 more pixels of height so the top handle stays in view.
  const WIDTH = 400;
  const HEIGHT = 320;
  const A_FOCAL = 60;
  const DH = 100;
  const CX = WIDTH / 2;
  const VY = HEIGHT - A_FOCAL - DH; // vertex: 160
  // The applet's scrollbars run -250..260; past +/-183 its points leave the
  // canvas. Our draggable handles stop where they are still visible.
  const T_MIN = -180;
  const T_MAX = 180;
  const MIN_GAP = 20; // keep the two tangents from coinciding

  const HANDLES = ["A", "B"];
  const OPTION_KEYS = ["showNames", "showLemma", "showTheorem", "showFill"];
  // The applet's Canvas defaults every checkbox to false.
  const START = { t1: 180, t2: -130 };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v) => Math.round(v * 10) / 10;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const tOf = (p) => p.x - CX;

  /** The point of the parabola with parameter t (the applet's Compute). */
  function pointAt(t) {
    return { x: CX + t, y: VY - (t * t) / (4 * A_FOCAL) };
  }

  /** Twice the signed area / 2 of a triangle, always positive here. */
  function triangleArea(p, q, r) {
    return Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)) / 2;
  }

  /** The area between the chord at t1,t2 and the parabola: (t2-t1)^3/(24a). */
  function segmentArea(t1, t2) {
    return Math.abs(t2 - t1) ** 3 / (24 * A_FOCAL);
  }

  /** The tangent to the parabola at t, as a point and a screen-space slope. */
  function tangentAt(t) {
    return { p: pointAt(t), slope: -t / (2 * A_FOCAL) };
  }

  /** Crossing of two lines given as {p, slope}; parallel lines give null. */
  function lineIntersection(l, m) {
    if (Math.abs(l.slope - m.slope) < 1e-12) return null;
    const x = (m.p.y - m.slope * m.p.x - l.p.y + l.slope * l.p.x) / (l.slope - m.slope);
    return { x, y: l.p.y + l.slope * (x - l.p.x) };
  }

  /** The opening picture, with the applet's switch defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      t1: START.t1,
      t2: START.t2,
      showNames: false,
      showLemma: false,
      showTheorem: false,
      showFill: false,
      moves: 0,
      explored: false,
    };
    if (Number.isFinite(o.t1)) state.t1 = clamp(round(o.t1), T_MIN, T_MAX);
    if (Number.isFinite(o.t2)) state.t2 = clamp(round(o.t2), T_MIN, T_MAX);
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    if (Math.abs(state.t2 - state.t1) < MIN_GAP) state.t2 = clamp(state.t1 + MIN_GAP, T_MIN, T_MAX);
    return state;
  }

  /** Drag A or B, tick one of the four applet switches, or reset the points. */
  function legalMoves(state) {
    return [
      ...HANDLES.map((name) => ({ type: "point", name, t: state[name === "A" ? "t1" : "t2"] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** Keep the handles apart so the two tangents always meet. */
  function separate(t, other) {
    if (Math.abs(t - other) >= MIN_GAP) return t;
    const sign = t >= other ? 1 : -1;
    let pushed = clamp(other + sign * MIN_GAP, T_MIN, T_MAX);
    if (Math.abs(pushed - other) < MIN_GAP) pushed = clamp(other - sign * MIN_GAP, T_MIN, T_MAX);
    return pushed;
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!HANDLES.includes(m.name)) return null;
      let t = Number.isFinite(m.t) ? m.t : (m.point && Number.isFinite(m.point.x) ? tOf(m.point) : NaN);
      if (!Number.isFinite(t)) return null;
      const key = m.name === "A" ? "t1" : "t2";
      const other = m.name === "A" ? state.t2 : state.t1;
      t = separate(round(clamp(t, T_MIN, T_MAX)), other);
      next = { ...state, [key]: t };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = { ...state, ...START };
    }
    if (!next) return null;
    return { ...next, moves: state.moves + 1, explored: true };
  }

  /** A picture has no win or loss; it counts as explored after any change. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** All the points and areas the applet draws, in board coordinates. */
  function compute(state) {
    const t1 = state.t1, t2 = state.t2;
    const A = pointAt(t1), B = pointAt(t2);
    const lA = tangentAt(t1), lB = tangentAt(t2);
    const S = lineIntersection(lA, lB);
    const M = midpoint(A, B);
    const tO = (t1 + t2) / 2; // S and M have this x, so SM is the axis-parallel median
    const O = pointAt(tO);
    const lO = tangentAt(tO);
    const A1 = lineIntersection(lO, lA); // tangent at O meets side AS
    const B1 = lineIntersection(lO, lB); // tangent at O meets side BS
    const areaABS = triangleArea(A, B, S);
    const areaABO = triangleArea(A, B, O);
    const areaA1B1S = triangleArea(A1, B1, S);
    const areaAA1O = triangleArea(A, A1, O);
    const areaBB1O = triangleArea(B, B1, O);
    return {
      A, B, S, M, O, A1, B1, tO,
      F: { x: CX, y: VY - A_FOCAL },
      directrixY: VY + A_FOCAL,
      AP: { x: A.x, y: VY + A_FOCAL }, // A' and B': projections on the directrix
      BP: { x: B.x, y: VY + A_FOCAL },
      lA, lB, lO,
      slopeAB: (B.y - A.y) / (B.x - A.x),
      areaABS, areaABO, areaA1B1S, areaAA1O, areaBB1O,
      areaSegment: segmentArea(t1, t2),
      showFill: state.showFill && state.showTheorem, // the applet disables fill unless Theorem is on
    };
  }

  /** Residuals of every claim on the cut-the-knot page, for the logic test. */
  function residuals(g) {
    const focusProperty = [-180, -120, -61, -17, 0, 23, 74, 131, 180].map((t) => {
      const p = pointAt(t);
      return Math.abs(dist(p, g.F) - (g.directrixY - p.y));
    });
    return {
      axisParallel: Math.abs(g.S.x - g.M.x),
      A1Mid: dist(g.A1, midpoint(g.A, g.S)),
      B1Mid: dist(g.B1, midpoint(g.B, g.S)),
      OMid: dist(g.O, midpoint(g.M, g.S)),
      tangentOParallel: Math.abs(g.lO.slope - g.slopeAB),
      SOnTangentA: Math.abs(g.S.y - g.A.y - g.lA.slope * (g.S.x - g.A.x)),
      SOnTangentB: Math.abs(g.S.y - g.B.y - g.lB.slope * (g.S.x - g.B.x)),
      OOnParabola: Math.abs(g.O.y - pointAt(g.tO).y),
      focusProperty: Math.max(...focusProperty),
      innerHalf: Math.abs(g.areaABO / g.areaABS - 1 / 2),
      topQuarter: Math.abs(g.areaA1B1S / g.areaABS - 1 / 4),
      sidesQuarter: Math.abs((g.areaAA1O + g.areaBB1O) / g.areaABS - 1 / 4),
      partition: Math.abs((g.areaABO + g.areaA1B1S + g.areaAA1O + g.areaBB1O) / g.areaABS - 1),
      segmentRatio: Math.abs(g.areaSegment / g.areaABS - 2 / 3),
    };
  }

  return {
    WIDTH, HEIGHT, A_FOCAL, DH, CX, VY, T_MIN, T_MAX, MIN_GAP,
    HANDLES, OPTION_KEYS, START,
    start, legalMoves, move, result, compute, residuals,
    pointAt, tangentAt, lineIntersection, triangleArea, segmentArea,
    midpoint, dist, clamp,
  };
})();
