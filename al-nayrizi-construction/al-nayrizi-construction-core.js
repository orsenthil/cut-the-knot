"use strict";

/*
 * Al-Nayrizi's construction, from Alexander Bogomolny's applet
 * AlNayriziConstruction (cut-the-knot.org/Curriculum/Geometry/AlNayriziConstruction.shtml).
 *
 * Given a segment BC, draw the ray BA and the line through C parallel to BA.
 * Step off N equal marks along each: B_i = B + i(A - B) and C_i = C - i(A - B).
 * Join B_i to C_(N+1-i) for i = 1..N. Every one of those lines has the same
 * direction, (C - B) - (N + 1)(A - B), so they cross BC at exactly the
 * fractions i/(N + 1). The applet therefore makes N + 1 equal parts from N
 * marks, although the article's prose says N parts (its own picture shows
 * N + 1); the logic test checks both statements.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, AlNayriziConstructionCore. The position is plain data
 * and every function returns a new one.
 */
const AlNayriziConstructionCore = (() => {
  const WIDTH = 400;   // the applet's preferred canvas, from getParameterInfo
  const HEIGHT = 250;
  const MIN_MARKS = 1; // PVNumeric.setMinValue(1)
  const MAX_MARKS = 20; // PVNumeric.setMaxValue(20)
  const DEFAULT_MARKS = 3; // PVNumeric.setLong(3)

  // init(): B = (w/2 - w/5, 2h/3 - h/3), A = (w/2 - w/6, B.y + h/10),
  // C = (w/2 + w/7, B.y), with the applet's integer divisions.
  const START_B = { x: 120, y: 83 };
  const START_A = { x: 134, y: 108 };
  const START_C = { x: 257, y: 83 };

  const copy = (p) => ({ x: p.x, y: p.y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampPoint = (p) => ({ x: clamp(p.x, 0, WIDTH), y: clamp(p.y, 0, HEIGHT) });

  /** A new picture, as the applet opens it. Options may override the defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      A: copy(START_A), B: copy(START_B), C: copy(START_C),
      n: DEFAULT_MARKS, names: false, hint: false,
      moves: 0, explored: false,
    };
    if (o.A && Number.isFinite(Number(o.A.x)) && Number.isFinite(Number(o.A.y))) {
      state.A = clampPoint({ x: Number(o.A.x), y: Number(o.A.y) });
    }
    if (o.B && Number.isFinite(Number(o.B.x)) && Number.isFinite(Number(o.B.y))) {
      state.B = clampPoint({ x: Number(o.B.x), y: Number(o.B.y) });
    }
    if (o.C && Number.isFinite(Number(o.C.x)) && Number.isFinite(Number(o.C.y))) {
      state.C = clampPoint({ x: Number(o.C.x), y: Number(o.C.y) });
    }
    // mouseDragged keeps BC level, exactly as the applet does.
    state.C.y = state.B.y = Math.round((state.B.y + state.C.y) / 2);
    if (Number.isFinite(Number(o.n))) {
      state.n = clamp(Math.round(Number(o.n)), MIN_MARKS, MAX_MARKS);
    }
    if (o.names === true) state.names = true;
    if (o.hint === true) state.hint = true;
    return state;
  }

  /** The moves: drag A, B or C; change the number of marks; tick a box; reset. */
  function legalMoves() {
    return [
      { type: "point", name: "A", x: START_A.x, y: START_A.y },
      { type: "point", name: "B", x: START_B.x, y: START_B.y },
      { type: "point", name: "C", x: START_C.x, y: START_C.y },
      { type: "marks", value: DEFAULT_MARKS },
      { type: "names", value: true }, { type: "hint", value: true },
      { type: "reset" },
    ];
  }

  /** The position after a move, or null when the move is not allowed. */
  function move(state, m) {
    if (!m || !state) return null;
    let next = null;
    if (m.type === "point") {
      if (m.name !== "A" && m.name !== "B" && m.name !== "C") return null;
      if (!Number.isFinite(Number(m.x)) || !Number.isFinite(Number(m.y))) return null;
      const q = clampPoint({ x: Number(m.x), y: Number(m.y) });
      next = { ...state, [m.name]: q };
      if (m.name === "B") next.C = { ...next.C, y: q.y }; // applet: C.y = B.y
      if (m.name === "C") next.B = { ...next.B, y: q.y }; // applet: B.y = C.y
    } else if (m.type === "marks") {
      if (!Number.isFinite(Number(m.value))) return null;
      next = { ...state, n: clamp(Math.round(Number(m.value)), MIN_MARKS, MAX_MARKS) };
    } else if (m.type === "names" || m.type === "hint") {
      if (typeof m.value !== "boolean") return null;
      next = { ...state, [m.type]: m.value };
    } else if (m.type === "reset") {
      // Back to the opening picture; the ticked boxes stay as they were.
      return { ...start(), names: state.names, hint: state.hint };
    } else {
      return null;
    }
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A demo: nothing to win; "done" once the player has changed the picture. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** The exact fraction of BC at crossing k, written with numerator and denominator. */
  function fraction(n, k) {
    const den = Math.round(n) + 1; // N marks give N + 1 equal parts
    const num = Math.round(k);
    return { num, den };
  }

  /** All the fractions along BC, including the two ends. */
  function fractions(n) {
    const out = [];
    for (let k = 0; k <= n + 1; k++) out.push(fraction(n, k));
    return out;
  }

  /** A point at an exact rational fraction num/den from p towards q. */
  function pointAtFraction(p, q, num, den) {
    return {
      x: (p.x * (den - num) + q.x * num) / den,
      y: (p.y * (den - num) + q.y * num) / den,
    };
  }

  /**
   * The whole construction (Compute() in the applet), computed with exact
   * rational weights for the crossings instead of line intersections.
   */
  function construct(state) {
    const { A, B, C, n } = state;
    const dx = A.x - B.x, dy = A.y - B.y;
    const marksB = [copy(B), copy(A)]; // PointsB[0] = B, PointsB[1] = A
    const marksC = [copy(C)];           // PointsC[0] = C
    for (let i = 2; i <= n; i++) {
      marksB.push({ x: B.x + i * dx, y: B.y + i * dy });
    }
    for (let i = 1; i <= n; i++) {
      marksC.push({ x: C.x - i * dx, y: C.y - i * dy });
    }
    // DrawParallels(): B_i joined to C_(N-i+1), all in the same direction.
    const crossLines = [];
    for (let i = 1; i <= n; i++) crossLines.push([marksB[i], marksC[n - i + 1]]);
    // PointsD[k] = B + k/(N+1) * (C - B), with k = 0..N+1.
    const cuts = [copy(B)];
    for (let k = 1; k <= n; k++) cuts.push(pointAtFraction(B, C, k, n + 1));
    cuts.push(copy(C));
    return { A: copy(A), B: copy(B), C: copy(C), n, dx, dy, marksB, marksC, crossLines, cuts, parts: n + 1 };
  }

  /** A picture for a wanted number of parts: the applet needs parts - 1 marks. */
  function divideInto(A, B, C, parts) {
    if (!Number.isFinite(Number(parts))) return null;
    const p = Math.round(Number(parts));
    if (p < MIN_MARKS + 1 || p > MAX_MARKS + 1) return null;
    return construct({ A, B, C, n: p - 1 });
  }

  return {
    WIDTH, HEIGHT, MIN_MARKS, MAX_MARKS, DEFAULT_MARKS,
    START_A, START_B, START_C,
    start, legalMoves, move, result, fraction, fractions, pointAtFraction, construct, divideInto,
  };
})();
