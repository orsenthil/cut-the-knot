"use strict";

/*
 * Anonymous Visitor, from Alexander Bogomolny's applet AnonymousVisitor.
 *
 * The puzzle: ABD is an isosceles triangle on the fixed base AB, with D moving
 * on the perpendicular bisector of AB. Equilateral triangles ADF and BDE are
 * built on its two equal sides (outside ABD while D is above the base, inside
 * once D crosses it), and C is the fourth corner of the rhombus DFCE. The claim
 * on the page is that C never moves: ABC is always equilateral.
 *
 * The one idea the code relies on: C is the reflection of D in the line FE.
 * Because F and E come from ±60° turns about A and B, they are mirror images
 * in the perpendicular bisector of AB and lie at signed height h/2 − √3|AB|/2
 * along its normal n (h is D's own signed height). FE is therefore parallel
 * to AB, and reflecting D in FE cancels h and leaves M − (√3/2)|AB| · n,
 * where M is the midpoint of AB. That point does not depend on D.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, AnonymousVisitorCore, so the page loads it with a
 * plain <script> and porting/check-anonymous-visitor.mjs loads it in Node.
 * Positions are plain data; functions never change the object they are given.
 */
const AnonymousVisitorCore = (() => {
  const WIDTH = 400;         // the applet's suggested 400 × 250 canvas, made 260
  const HEIGHT = 260;
  const MARGIN = 12;         // keep handles away from the edge of the board
  const MIN_BASE = 30;       // a base shorter than this makes the construction useless
  const SQRT3 = Math.sqrt(3);
  const PI3 = Math.PI / 3;

  const START = Object.freeze({
    A: Object.freeze({ x: 124, y: 176 }),
    B: Object.freeze({ x: 276, y: 176 }),
    D: Object.freeze({ x: 200, y: 76 }),
  });

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  const isPoint = (p) => p && finite(p.x) && finite(p.y);

  /* Rotate the vector v through t radians in SVG coordinates (y grows down). */
  function rotate(v, t) {
    const c = Math.cos(t), s = Math.sin(t);
    return { x: c * v.x - s * v.y, y: s * v.x + c * v.y };
  }

  /** The direction and normal of AB, its length and its midpoint. */
  function frame(A, B) {
    const dx = B.x - A.x, dy = B.y - A.y;
    const s = Math.hypot(dx, dy);
    if (!s) return null;
    return {
      s,
      u: { x: dx / s, y: dy / s },
      n: { x: -dy / s, y: dx / s },
      M: { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 },
    };
  }

  /** Reflect p in the line through a and b (the diagonals of a rhombus do this). */
  function reflect(p, a, b) {
    const v = sub(b, a);
    const len2 = dot(v, v);
    if (!len2) return { x: p.x, y: p.y };
    const f = add(a, { x: (dot(sub(p, a), v) / len2) * v.x, y: (dot(sub(p, a), v) / len2) * v.y });
    return { x: 2 * f.x - p.x, y: 2 * f.y - p.y };
  }

  /** Keep a point inside the board. */
  function inside(p) {
    return {
      x: clamp(p.x, MARGIN, WIDTH - MARGIN),
      y: clamp(p.y, MARGIN, HEIGHT - MARGIN),
    };
  }

  /**
   * Put q on the perpendicular bisector of AB, staying on the board.
   * The Java applet only did this while D was being dragged (RestrictToLine);
   * here D is kept on the line at all times, as the page's puzzle asks.
   */
  function onBisector(q, f) {
    let t = dot(sub(q, f.M), f.n);
    let lo = -Infinity, hi = Infinity;
    for (const [axis, min, max] of [["x", MARGIN, WIDTH - MARGIN], ["y", MARGIN, HEIGHT - MARGIN]]) {
      const comp = f.n[axis], start = f.M[axis];
      if (Math.abs(comp) < 1e-12) {
        if (start < min || start > max) return { x: f.M.x, y: f.M.y };
        continue;
      }
      let a = (min - start) / comp, b = (max - start) / comp;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      lo = Math.max(lo, a);
      hi = Math.min(hi, b);
    }
    t = clamp(t, lo === Infinity ? 0 : lo, hi === -Infinity ? 0 : hi);
    return { x: f.M.x + t * f.n.x, y: f.M.y + t * f.n.y };
  }

  /** Where a dragged handle of this name is allowed to sit. */
  function limit(state, name, q) {
    if (!isPoint(q)) return null;
    const p = inside(q);
    const f = frame(state.A, state.B);
    if (!f) return p;
    return name === "D" ? onBisector(p, f) : p;
  }

  /** A new picture, with D on the bisector and the proof overlays still locked. */
  function start() {
    return {
      A: { ...START.A }, B: { ...START.B }, D: { ...START.D },
      names: false, premise: false, proof: false,
      unlocked: false, moves: 0, explored: false,
    };
  }

  /**
   * The construction at a position: the two equilateral triangles, the
   * rhombus's fourth corner C, and the numbers the status line needs.
   */
  function construct(state) {
    const f = frame(state.A, state.B);
    if (!f) return null;
    const D = onBisector(state.D, f);

    // ADF and BDE: ±60° turns about A and B. These are the applet's
    // FormTriangle(D,A,F) and FormTriangle(B,D,E), in closed form.
    const F = add(state.A, rotate(sub(D, state.A), -PI3));
    const E = add(state.B, rotate(sub(D, state.B), PI3));
    const C = reflect(D, F, E);

    // Are the small triangles outside ABD (the page's picture) or inside it?
    const sideB = cross(sub(D, state.A), sub(state.B, state.A));
    const sideF = cross(sub(D, state.A), sub(F, state.A));
    return {
      A: state.A, B: state.B, D,
      M: f.M, u: f.u, n: f.n, s: f.s,
      F, E, C,
      h: dot(sub(D, f.M), f.n),
      external: sideB * sideF < 0,
      radius: dist(state.A, D),
    };
  }

  /** The moves the illustration accepts. */
  function legalMoves() {
    return [
      { type: "point", name: "A" }, { type: "point", name: "B" }, { type: "point", name: "D" },
      { type: "names" }, { type: "premise" }, { type: "proof" }, { type: "reset" },
    ];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m || !isPoint(state.A) || !isPoint(state.B) || !isPoint(state.D)) return null;
    const next = { ...state, A: { ...state.A }, B: { ...state.B }, D: { ...state.D } };

    if (m.type === "reset") return start();

    if (m.type === "point") {
      if (!["A", "B", "D"].includes(m.name) || !finite(m.x) || !finite(m.y)) return null;
      const p = limit(state, m.name, { x: m.x, y: m.y });
      if (!p) return null;
      if (m.name !== "D") {
        const other = m.name === "A" ? state.B : state.A;
        if (dist(p, other) < MIN_BASE) return null;
        next[m.name] = p;
        // The Java applet locks the premise and proof overlays again as soon
        // as A or B is picked, and puts D back on the new bisector.
        next.premise = false;
        next.proof = false;
        next.unlocked = false;
        const f = frame(next.A, next.B);
        if (f) next.D = onBisector(state.D, f);
      } else {
        next.D = p;
        next.unlocked = true;
      }
      next.moves = state.moves + 1;
      next.explored = true;
      return next;
    }

    if (["names", "premise", "proof"].includes(m.type)) {
      if (typeof m.value !== "boolean") return null;
      if (m.type !== "names" && !state.unlocked) return null;
      next[m.type] = m.value;
      next.moves = state.moves + 1;
      return next;
    }
    return null;
  }

  /** A demo has nothing to win: it is finished once the picture has been moved. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** The line under the board: the claim on the page, spoken in plain words. */
  function status(state) {
    const g = construct(state);
    if (!g) return "A and B need a little space between them.";
    const where = g.external ? "outside" : "inside";
    return `C stays at (${Math.round(g.C.x)}, ${Math.round(g.C.y)}) while D moves: ABC is equilateral, side ${Math.round(g.s)}. The two small triangles are ${where} ABD.`;
  }

  return {
    WIDTH, HEIGHT, MARGIN, MIN_BASE, START,
    start, construct, limit, legalMoves, move, result, status,
    frame, inside, onBisector, reflect, rotate,
  };
})();
