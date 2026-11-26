"use strict";

/*
 * Besteman — Nathan Besteman's straightedge-and-compass division of a segment.
 *
 * The applet (class Bestman, in classes/Besteman.zip) draws a segment AB, finds
 * M its midpoint and puts C on the ray AB with AC = N·AM = N·AB/2. The two
 * circles centred at A and C, of radii AB and AC, meet at D and E. Their common
 * chord DE crosses AB at P, and Q is the midpoint of AD. The cut-the-knot page
 * proves AP/AQ = AD/AC, hence AP = AB²/(2AC), hence AP = AB/N.
 *
 * The one idea the code relies on: the common chord of two circles is their
 * radical axis, so in coordinates with AC level the chord is the vertical line
 * x = (AB² - AC² + d²)/(2d) measured from A (d = AC). That gives AP = AB²/(2AC)
 * directly. The core below transcribes the applet's own radical-axis method,
 * including its choice between solving for x or y, so D and E come out in the
 * same order as in the Java applet.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BestemanCore, so the page loads it with a plain
 * <script> and porting/check-besteman.mjs loads it in Node. All functions take
 * plain data and return new objects; nothing passed in is changed.
 */
const BestemanCore = (() => {
  const WIDTH = 400;   // the applet's preferred canvas (getParameterInfo)
  const HEIGHT = 250;
  const MIN_N = 2;     // PVNumeric.setMinValue(2.0)
  const MAX_N = 20;    // PVNumeric.setMaxValue(20.0)
  const DEFAULT_N = 3; // PVNumeric.setLong(3)

  // init(): r = min(height,width)/5 = 50; A = ((width - 4r)/2, height/2 - 10);
  // B = (A.x + r, A.y). With the preferred 400x250 canvas that is:
  const START_A = { x: 100, y: 115 };
  const START_B = { x: 150, y: 115 };

  const copy = (p) => ({ x: p.x, y: p.y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampPoint = (p) => ({ x: clamp(p.x, 0, WIDTH), y: clamp(p.y, 0, HEIGHT) });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const dot = (a, b) => a.x * b.x + a.y * b.y;

  /** A new picture, as the applet opens it. Options may override the defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      A: copy(START_A), B: copy(START_B),
      n: DEFAULT_N, names: false, hint: false,
      moves: 0, explored: false,
    };
    if (o.A && Number.isFinite(Number(o.A.x)) && Number.isFinite(Number(o.A.y))) {
      state.A = clampPoint({ x: Number(o.A.x), y: Number(o.A.y) });
    }
    if (o.B && Number.isFinite(Number(o.B.x)) && Number.isFinite(Number(o.B.y))) {
      state.B = clampPoint({ x: Number(o.B.x), y: Number(o.B.y) });
    }
    // mouseDragged/mouseReleased keep AB level, exactly as the applet does.
    const level = (state.A.y + state.B.y) / 2;
    state.A.y = state.B.y = level;
    if (Number.isFinite(Number(o.n))) {
      state.n = clamp(Math.round(Number(o.n)), MIN_N, MAX_N);
    }
    if (o.names === true) state.names = true;
    if (o.hint === true) state.hint = true;
    return state;
  }

  /** The moves the illustration accepts. */
  function legalMoves() {
    return [
      { type: "point", name: "A", x: START_A.x, y: START_A.y },
      { type: "point", name: "B", x: START_B.x, y: START_B.y },
      { type: "n", value: DEFAULT_N },
      { type: "names", value: true }, { type: "hint", value: true },
      { type: "reset" },
    ];
  }

  /** The position after a move, or null when the move is not allowed. */
  function move(state, m) {
    if (!m || !state) return null;
    let next = null;
    if (m.type === "point") {
      if (m.name !== "A" && m.name !== "B") return null;
      if (!Number.isFinite(Number(m.x)) || !Number.isFinite(Number(m.y))) return null;
      const q = clampPoint({ x: Number(m.x), y: Number(m.y) });
      next = { ...state, [m.name]: q };
      if (m.name === "A") next.B = { ...next.B, y: q.y }; // applet: B.y = A.y
      if (m.name === "B") next.A = { ...next.A, y: q.y }; // applet: A.y = B.y
    } else if (m.type === "n") {
      if (!Number.isFinite(Number(m.value))) return null;
      next = { ...state, n: clamp(Math.round(Number(m.value)), MIN_N, MAX_N) };
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

  /* ------------------------------------------------ GeoSDoub's own geometry */

  /**
   * Line(a,b) with Line(c,d), from GeoSDoub.Intersect: the ax+by+c=0 determinant
   * form. The applet returns NaN coordinates when |det| < 1; a null means the
   * same thing to this core (the drawing cannot be trusted there).
   */
  function lineIntersection(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /* The radical axis: x = m*y + b (X form) or y = m*x + b (Y form). */
  function circlePairX(c0, c1) {
    const m = -(c0.y - c1.y) / (c0.x - c1.x);
    const b = (c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y
      - c0.r * c0.r + c1.r * c1.r) / (2 * (c0.x - c1.x));
    const k = b - c0.x;
    const a = m * m + 1;
    const p = m * k - c0.y;
    const q = k * k + c0.y * c0.y - c0.r * c0.r;
    const disc = p * p - a * q;
    if (disc < 0 || !Number.isFinite(disc)) return null;
    const s = Math.sqrt(disc);
    const y0 = (-p + s) / a, y1 = (-p - s) / a;
    return [{ x: m * y0 + b, y: y0 }, { x: m * y1 + b, y: y1 }];
  }

  function circlePairY(c0, c1) {
    const m = -(c0.x - c1.x) / (c0.y - c1.y);
    const b = (c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x
      - c0.r * c0.r + c1.r * c1.r) / (2 * (c0.y - c1.y));
    const k = b - c0.y;
    const a = m * m + 1;
    const p = m * k - c0.x;
    const q = k * k + c0.x * c0.x - c0.r * c0.r;
    const disc = p * p - a * q;
    if (disc < 0 || !Number.isFinite(disc)) return null;
    const s = Math.sqrt(disc);
    const x0 = (-p + s) / a, x1 = (-p - s) / a;
    return [{ x: x0, y: m * x0 + b }, { x: x1, y: m * x1 + b }];
  }

  /** GeoSDoub.Intersect(DoubCircle, DoubCircle), in the applet's branch order. */
  function circleIntersections(c0, c1) {
    if (Math.abs(c0.x - c1.x) > 1) return circlePairX(c0, c1);
    if (Math.abs(c0.y - c1.y) > 1) return circlePairY(c0, c1);
    // Identical (or almost identical) centres: the applet returns two copies
    // of the first centre.
    return [{ x: c0.x, y: c0.y }, { x: c0.x, y: c0.y }];
  }

  /* ------------------------------------------------ the construction itself */

  /**
   * Everything the page draws, from the applet's DrawConstruction(). D and E
   * are ordered as in the applet (the +sqrt intersection first), Q is the
   * midpoint of AD, and divisions[k] is (k+1)·AP along AB.
   */
  function construct(state) {
    const A = copy(state.A), B = copy(state.B);
    const n = clamp(Math.round(Number(state.n) || DEFAULT_N), MIN_N, MAX_N);
    const AB = dist(A, B);
    const M = midpoint(A, B);
    const AC = (n * AB) / 2;
    const C = { x: A.x + AC, y: A.y };
    const circleA = { x: A.x, y: A.y, r: AB };
    const circleC = { x: C.x, y: C.y, r: AC };

    const halfMarks = [];
    for (let i = 0; i < n; i++) halfMarks.push({ x: A.x + ((i + 1) * AB) / 2, y: A.y });

    const base = {
      A, B, M, C, n, AB, AC, circleA, circleC, halfMarks,
      names: Boolean(state.names), hint: Boolean(state.hint),
    };
    if (!(AB > 1e-9) || !Number.isFinite(AC)) {
      return { ...base, degenerate: true, D: null, E: null, P: null, Q: null, divisions: [] };
    }

    const hits = circleIntersections(circleA, circleC);
    if (!hits) {
      return { ...base, degenerate: true, D: null, E: null, P: null, Q: null, divisions: [] };
    }
    const D = hits[0], E = hits[1];
    const P = lineIntersection(D, E, A, C);
    const Q = midpoint(A, D);
    const divisions = [];
    if (P) {
      for (let i = 0; i < n; i++) {
        divisions.push({ x: A.x + (P.x - A.x) * (i + 1), y: A.y });
      }
    }
    const AP = P ? dist(A, P) : null;
    const AD = dist(A, D);
    const AQ = dist(A, Q);
    return {
      ...base, degenerate: false, D, E, P, Q, divisions, AP, AD, AQ,
      hintSegments: [[Q, C], [A, D], [C, D]],
    };
  }

  /** Each claim of the cut-the-knot article, measured on one configuration. */
  function claims(state) {
    const g = construct(state);
    const off = {
      acIsNM: false, chordPerpendicular: false, pointsOnCircles: false,
      pOnChordAndAxis: false, qIsMidpoint: false, similarTriangles: false,
      apFormula: false, apEqualsABOverN: false, divisionsEvenlySpaced: false,
    };
    if (g.degenerate || !g.P) return off;
    const scale = Math.max(g.AB, g.AC, g.AD);
    const tol = 1e-8 * scale;
    const near = (u, v) => Number.isFinite(u) && Number.isFinite(v) && Math.abs(u - v) <= tol;
    const onCircle = (p, c) => near(dist(p, c), c.r);
    const collinear = (p, u, v) => {
      const cross = (p.x - u.x) * (v.y - u.y) - (p.y - u.y) * (v.x - u.x);
      return Math.abs(cross) <= tol * Math.max(1, dist(u, v));
    };
    const chord = { x: g.E.x - g.D.x, y: g.E.y - g.D.y };
    const axis = { x: g.C.x - g.A.x, y: g.C.y - g.A.y };
    return {
      acIsNM: near(g.AC, g.n * dist(g.A, g.M)),
      chordPerpendicular: Math.abs(dot(chord, axis)) <= tol,
      pointsOnCircles:
        onCircle(g.D, g.circleA) && onCircle(g.D, g.circleC) &&
        onCircle(g.E, g.circleA) && onCircle(g.E, g.circleC),
      pOnChordAndAxis: collinear(g.P, g.D, g.E) && collinear(g.P, g.A, g.C),
      qIsMidpoint: near(g.Q.x, (g.A.x + g.D.x) / 2) && near(g.Q.y, (g.A.y + g.D.y) / 2),
      similarTriangles: near(g.AP / g.AQ, g.AD / g.AC),
      apFormula: near(g.AP * g.AC, (g.AB * g.AB) / 2),
      apEqualsABOverN: near(g.AP, g.AB / g.n),
      divisionsEvenlySpaced: g.divisions.every((p, i) =>
        near(dist(g.A, p), (i + 1) * g.AP)),
    };
  }

  return {
    WIDTH, HEIGHT, MIN_N, MAX_N, DEFAULT_N, START_A, START_B,
    start, legalMoves, move, result, dist, midpoint, dot,
    lineIntersection, circleIntersections, construct, claims,
  };
})();
