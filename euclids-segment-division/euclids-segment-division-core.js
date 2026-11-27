"use strict";

/*
 * Euclid's Segment Division, from Alexander Bogomolny's applet
 * EuclidsSegmentDivision (cut-the-knot.org/Curriculum/Geometry/EuclidsSegmentDivision.shtml).
 *
 * A segment BC and a ray from B through A are given. Step off N equal marks on
 * the ray: B_i = B + i(A - B), with B_1 = A. Join B_N to C and draw through each
 * B_i a line parallel to B_N C. Similar triangles make triangle B B_i D_i
 * similar to triangle B B_N C with ratio i/N, so the crossing D_i is exactly
 * B + (i/N)(C - B): the cuts divide BC into N equal parts.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, EuclidsSegmentDivisionCore. The position is plain data
 * and every function returns a new one.
 */
const EuclidsSegmentDivisionCore = (() => {
  const WIDTH = 400;    // the applet tag on the page is 400 by 400
  const HEIGHT = 400;
  const MIN_N = 1;      // PVNumeric.setMinValue(1)
  const MAX_N = 20;     // PVNumeric.setMaxValue(20)
  const DEFAULT_N = 3;  // PVNumeric.setLong(3)
  const SCALE = 100;    // GeoSDoub.GetParallelTo extends a direction 100 times

  // init(), with w = h = 400: B = (w/2 - w/5, h/2), A = (w/2 - w/6, B.y + h/10),
  // C = (w/2 + w/7, h/2), all the divisions being integer divisions.
  const START_B = { x: 120, y: 200 };
  const START_A = { x: 134, y: 240 };
  const START_C = { x: 257, y: 200 };

  const copy = (p) => ({ x: p.x, y: p.y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampPoint = (p) => ({ x: clamp(p.x, 0, WIDTH), y: clamp(p.y, 0, HEIGHT) });

  /** A new picture, as the applet opens it. Options may override the defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      A: copy(START_A), B: copy(START_B), C: copy(START_C),
      n: DEFAULT_N, names: false, hint: false,
      moves: 0, explored: false,
    };
    for (const name of ["A", "B", "C"]) {
      const p = o[name];
      if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) {
        state[name] = clampPoint({ x: Number(p.x), y: Number(p.y) });
      }
    }
    // The mouse handlers keep BC level: moving one end moves the other's y.
    state.C.y = state.B.y = Math.round((state.B.y + state.C.y) / 2);
    if (Number.isFinite(Number(o.n))) {
      state.n = clamp(Math.round(Number(o.n)), MIN_N, MAX_N);
    }
    if (o.names === true) state.names = true;
    if (o.hint === true) state.hint = true;
    return state;
  }

  /** The moves: drag A, B or C, change N, tick a box, reset. */
  function legalMoves() {
    return [
      { type: "point", name: "A", x: START_A.x, y: START_A.y },
      { type: "point", name: "B", x: START_B.x, y: START_B.y },
      { type: "point", name: "C", x: START_C.x, y: START_C.y },
      { type: "n", value: DEFAULT_N },
      { type: "names", value: true }, { type: "hint", value: true },
      { type: "reset" },
    ];
  }

  /** The position after a move, or null when the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (m.name !== "A" && m.name !== "B" && m.name !== "C") return null;
      if (!Number.isFinite(Number(m.x)) || !Number.isFinite(Number(m.y))) return null;
      const q = clampPoint({ x: Number(m.x), y: Number(m.y) });
      next = { ...state, [m.name]: q };
      if (m.name === "B") next.C = { ...next.C, y: q.y }; // applet: C.y = B.y
      if (m.name === "C") next.B = { ...next.B, y: q.y }; // applet: B.y = C.y
    } else if (m.type === "n") {
      if (!Number.isFinite(Number(m.value))) return null;
      next = { ...state, n: clamp(Math.round(Number(m.value)), MIN_N, MAX_N) };
    } else if (m.type === "names" || m.type === "hint") {
      if (typeof m.value !== "boolean") return null;
      next = { ...state, [m.type]: m.value };
    } else if (m.type === "reset") {
      // Reset() only reallocates the arrays; the ticked boxes stay as they were.
      return { ...start(), names: state.names, hint: state.hint };
    } else {
      return null;
    }
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A demonstration: there is nothing to win; "done" once it is explored. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** The k-th cut is the fraction k/n of the way from B to C. */
  function fraction(n, k) {
    return { num: Math.round(k), den: Math.round(n) };
  }

  /** Every fraction along BC, including both ends. */
  function fractions(n) {
    const out = [];
    for (let k = 0; k <= n; k++) out.push(fraction(n, k));
    return out;
  }

  /** A point at the exact rational fraction num/den from p towards q. */
  function pointAtFraction(p, q, num, den) {
    return {
      x: (p.x * (den - num) + q.x * num) / den,
      y: (p.y * (den - num) + q.y * num) / den,
    };
  }

  /**
   * The applet's Compute(), with the intersections written from the similar
   * triangles instead of a line-line determinant. `marks` is PointsB,
   * `parallels` is the end point GeoSDoub.GetParallelTo makes for each line,
   * and `cuts` is PointsD.
   */
  function construct(state) {
    const { A, B, C, n } = state;
    const dx = A.x - B.x, dy = A.y - B.y;
    const marks = [copy(B), copy(A)]; // PointsB[0] = B, PointsB[1] = A
    for (let i = 2; i <= n; i++) {
      marks.push({ x: B.x + i * dx, y: B.y + i * dy });
    }
    // GetParallelTo(B_i, B_N, C) = B_i + 100 * (B_N - C).
    const direction = { x: SCALE * (marks[n].x - C.x), y: SCALE * (marks[n].y - C.y) };
    const parallels = [];
    for (let i = 1; i < n; i++) {
      parallels.push({ x: marks[i].x + direction.x, y: marks[i].y + direction.y });
    }
    const cuts = [copy(B)]; // PointsD[0] = B, PointsD[N] = C
    for (let k = 1; k < n; k++) cuts.push(pointAtFraction(B, C, k, n));
    cuts.push(copy(C));
    return {
      A: copy(A), B: copy(B), C: copy(C), n, dx, dy,
      marks, parallels, cuts, parts: n,
      // True unless A lies on BC, where the applet's determinant vanishes.
      valid: Math.abs(dx * (C.y - B.y) - dy * (C.x - B.x)) > 1e-9,
    };
  }

  /** A picture that divides BC into the requested number of parts. */
  function divideInto(A, B, C, parts) {
    if (!Number.isFinite(Number(parts))) return null;
    const p = Math.round(Number(parts));
    if (p < MIN_N || p > MAX_N) return null;
    return construct({ A, B, C, n: p });
  }

  return {
    WIDTH, HEIGHT, MIN_N, MAX_N, DEFAULT_N, SCALE,
    START_A, START_B, START_C,
    start, legalMoves, move, result, fraction, fractions, pointAtFraction, construct, divideInto,
  };
})();
