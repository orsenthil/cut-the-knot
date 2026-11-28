"use strict";

/*
 * Ian McGee's observation, from Alexander Bogomolny's applet McGee
 * (cut-the-knot.org/Curriculum/Geometry/McGee.shtml).
 *
 * The live page says: at points A and B on a circle, equal tangents AP and BQ
 * are drawn; then AB bisects PQ. The applet picks one tangent direction at
 * each point (DoubCircle.Tangent rotates the radius a quarter turn), walks
 * the same signed distance along both, and finds T = BQ ∩ AP and S = PQ ∩ AB.
 * The key identity is that the sum of the two tangent directions is parallel
 * to the chord AB, so the midpoint of PQ always lies on AB.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, McgeeCore. The position is plain data, so
 * it can be saved for the player's record and handed to the tutor.
 */

const McgeeCore = (() => {
  // The live page embeds <APPLET CODE="McGee" WIDTH=400 HEIGHT=400>. The
  // applet's init() puts the centre at (width/2, height/2) and sets the radius
  // to min(width, height)/4.5; A starts at 108 degrees, B at -30 degrees.
  const WIDTH = 400;
  const HEIGHT = 400;
  const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
  const RADIUS = Math.min(WIDTH, HEIGHT) / 4.5;
  const ANGLE_A = 1.8849555921538759;
  const ANGLE_B = -0.5235987755982988;
  // McGeeScroll builds Scrollbar(HORIZONTAL, -100, 10, -200, 200).
  const LENGTH_MIN = -200;
  const LENGTH_MAX = 200;
  const LENGTH_DEFAULT = -100;
  const OPTION_KEYS = ["showNames", "showStatement", "showPremise", "showHint"];
  const HANDLES = ["A", "B"];

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lengthValue = (v) => Math.round(clamp(Number(v), LENGTH_MIN, LENGTH_MAX));

  /** CTKMoveableDoub.SetLocation for STAY_ON_CIRCLE: push q out to the circle. */
  function projectToCircle(q) {
    if (!finite(q)) return null;
    const d = dist(CENTER, q);
    if (d < 1e-12) return null; // Java would divide by zero; keep the old spot.
    return add(CENTER, mul(sub(q, CENTER), RADIUS / d));
  }

  /** A point at a given angle on the circle, as in McGeeCanvas.init(). */
  function pointOnCircle(angle) {
    return {
      x: CENTER.x + RADIUS * Math.cos(angle),
      y: CENTER.y + RADIUS * Math.sin(angle),
    };
  }

  /** DoubCircle.Tangent(point): a quarter turn of the radius at the point. */
  function tangent(point) {
    if (!finite(point)) return null;
    const dx = CENTER.x - point.x;
    const dy = CENTER.y - point.y;
    if (Math.abs(Math.hypot(dx, dy) - RADIUS) > 1) return null;
    return { x: point.x + dy, y: point.y - dx };
  }

  /** McGeeCanvas.Extend(base, directionPoint, length): unit direction × length. */
  function extend(base, directionPoint, length) {
    const dx = directionPoint.x - base.x;
    const dy = directionPoint.y - base.y;
    const n = Math.sqrt(dx * dx + dy * dy);
    return { x: base.x + (dx * length) / n, y: base.y + (dy * length) / n };
  }

  /** GeoSDoub.Intersect(line a-b, line c-d), including its |det| < 1 NaN guard. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /* ------------------------------------------------------------- positions */

  /** The opening picture, with the applet's switch and slider defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      A: pointOnCircle(ANGLE_A),
      B: pointOnCircle(ANGLE_B),
      length: LENGTH_DEFAULT,
      showNames: true,       // the applet's ShowNames parameter is normally 1
      showStatement: false,  // the other three checkboxes start unticked
      showPremise: false,
      showHint: false,
      moves: 0,
      explored: false,
    };
    if (finite(o.A)) state.A = projectToCircle(o.A) || state.A;
    if (finite(o.B)) state.B = projectToCircle(o.B) || state.B;
    if (o.length !== undefined && Number.isFinite(Number(o.length))) {
      state.length = lengthValue(o.length);
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    return state;
  }

  /** The moves a player can make: drag A or B, slide the length, tick a switch, reset. */
  function legalMoves(state) {
    if (!state) return [];
    return [
      ...HANDLES.map((name) => ({ type: "point", name, point: state[name] })),
      { type: "length", value: clamp(state.length + 10, LENGTH_MIN, LENGTH_MAX) },
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!HANDLES.includes(m.name)) return null;
      const p = projectToCircle(m.point);
      if (!p) return null;
      next = { ...state, [m.name]: p };
    } else if (m.type === "length") {
      if (!Number.isFinite(Number(m.value))) return null;
      next = { ...state, length: lengthValue(m.value) };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      // Keep the player's switches, as the other illustrated ports do.
      next = { ...start(), ...Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])) };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A picture has no win or loss: it counts as explored once it has been changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /* ---------------------------------------------------------- the geometry */

  /**
   * McGeeCanvas.Compute(), transcribed from the bytecode. It stops early when
   * A and B are less than two pixels apart, or when the slider reads strictly
   * between -2 and 2; in those cases the old drawing stays on screen.
   */
  function compute(state) {
    if (!state || !finite(state.A) || !finite(state.B) || !Number.isFinite(state.length)) {
      return { valid: false, reason: "invalid" };
    }
    const { A, B, length: L } = state;
    const dAB = dist(A, B);
    if (dAB < 2 || (L > -2 && L < 2)) {
      return { valid: false, reason: dAB < 2 ? "close" : "short", A, B, O: CENTER, r: RADIUS, dAB, length: L };
    }
    const chordDirectionA = tangent(A);
    const chordDirectionB = tangent(B);
    if (!chordDirectionA || !chordDirectionB) {
      return { valid: false, reason: "offcircle", A, B, O: CENTER, r: RADIUS, dAB, length: L };
    }
    const P = extend(A, chordDirectionA, L);
    const Q = extend(B, chordDirectionB, L);
    const R = extend(A, chordDirectionA, -L);
    const T = intersect(B, Q, A, P);
    const S = intersect(P, Q, A, B);
    return {
      valid: true,
      reason: null,
      drawable: [P, Q, R, S, T].every(finite),
      O: CENTER, r: RADIUS, A, B, L, P, Q, R, S, T,
      dirA: sub(chordDirectionA, A), dirB: sub(chordDirectionB, B),
      tangentA: chordDirectionA, tangentB: chordDirectionB, dAB,
    };
  }

  /**
   * Residuals of the page's claims, scaled into board units. The logic test
   * checks all of them are zero over the whole slider and circle range.
   */
  function residuals(g) {
    if (!g || !g.valid || !g.drawable) return null;
    const { O, r, A, B, L, P, Q, R, S, T, dirA, dirB } = g;
    const lineDist = (p, a, b) => Math.abs(cross(sub(b, a), sub(p, a))) / dist(a, b);
    const abLen = dist(A, B);
    const dirSum = add(dirA, dirB);
    return {
      // The page's exact claim: S is the midpoint of PQ.
      bisect: dist(S, midpoint(P, Q)),
      equalHalves: Math.abs(dist(S, P) - dist(S, Q)),
      onChord: lineDist(S, A, B),
      // The hypothesis and the hint's steps.
      equalTangents: Math.abs(dist(A, P) - dist(B, Q)),
      radiusPerp: Math.max(
        Math.abs(dot(sub(A, O), dirA)) / (r * Math.abs(L)),
        Math.abs(dot(sub(B, O), dirB)) / (r * Math.abs(L)),
      ),
      ARequalsAP: Math.abs(dist(A, R) - dist(A, P)),
      equalTA_TB: Math.abs(dist(T, A) - dist(T, B)),
      equalTR_TQ: Math.abs(dist(T, R) - dist(T, Q)),
      AIsMidOfPR: dist(A, midpoint(P, R)),
      QRparallelAB: Math.abs(cross(sub(Q, R), sub(B, A))) / abLen,
      // The invariant behind the proof: dirA + dirB is along the chord.
      dirSumParallel: Math.hypot(dirSum.x, dirSum.y) > 1e-12
        ? Math.abs(cross(dirSum, sub(B, A))) / (Math.hypot(dirSum.x, dirSum.y) * abLen)
        : 0,
    };
  }

  return {
    WIDTH, HEIGHT, CENTER, RADIUS, ANGLE_A, ANGLE_B,
    LENGTH_MIN, LENGTH_MAX, LENGTH_DEFAULT, OPTION_KEYS, HANDLES,
    add, sub, mul, dot, cross, dist, midpoint, finite, clamp,
    projectToCircle, pointOnCircle, tangent, extend, intersect,
    start, legalMoves, move, result, compute, residuals,
  };
})();
