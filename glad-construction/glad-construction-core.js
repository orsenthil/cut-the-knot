"use strict";

/*
 * GLaD construction, from Alexander Bogomolny's applet GladConstruction
 * (cut-the-knot.org/Curriculum/Geometry/GladConstruction.shtml).
 *
 * The applet draws a parallelogram ABCD (A bottom-left, B bottom-right,
 * C top-right, D top-left), its diagonal AC, and the other diagonal DB.
 * Starting with the midpoint P_0 of AB, it repeatedly crosses the line from
 * the previous point P_{k-1} to D with the diagonal AC, obtaining E_k, then
 * drops a line through E_k parallel to BC back onto AB, obtaining P_k.
 * The cut-the-knot explanation's lemma says that if n*AP = AD then the
 * intersection Q of AC and BP satisfies (n+1)*AQ = AC; its corollary adds
 * the perpendicular foot. Here the same affine argument gives
 * A E_k / A C = A P_k / A B = 1/(k+2), whatever the slant of the parallelogram.
 * So the last point P_{N-2} cuts off exactly 1/N of AB: N equal parts.
 *
 * The live cut-the-knot page no longer embeds the Java applet (it shows the
 * "requires Sun's Java VM" notice); the geometry below is transcribed from
 * GladConstructionCanvas.Draw/DrawConstruction and GeoSDoub in classes.zip,
 * and the claim from the Explanation linked by that page.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, GladConstructionCore. The position is plain data and
 * every function returns a new object; nothing passed in is changed.
 */
const GladConstructionCore = (() => {
  const WIDTH = 400;    // the applet's preferred canvas (getParameterInfo)
  const HEIGHT = 250;
  const MIN_PARTS = 2;  // PVNumeric.setMinValue(2.0)
  const MAX_PARTS = 20; // PVNumeric.setMaxValue(20.0)
  const DEFAULT_PARTS = 3; // PVNumeric.setLong(3)

  // init(): x = width/7, y = height/7 (Java integer division), then
  // D = (x,y), A = (x, height-y), B = (width-x, height-y), C = (width-x,y).
  const START_D = { x: 57, y: 35 };
  const START_A = { x: 57, y: 215 };
  const START_B = { x: 343, y: 215 };
  const START_C = { x: 343, y: 35 };

  const copy = (p) => ({ x: p.x, y: p.y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampPoint = (p) => ({ x: clamp(p.x, 0, WIDTH), y: clamp(p.y, 0, HEIGHT) });

  /** A new picture, exactly as the applet opens it. Options may override it. */
  function start(options) {
    const o = options || {};
    const state = {
      A: copy(START_A), B: copy(START_B), C: copy(START_C), D: copy(START_D),
      n: DEFAULT_PARTS, names: false, moves: 0, explored: false,
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
    if (o.D && Number.isFinite(Number(o.D.x)) && Number.isFinite(Number(o.D.y))) {
      state.D = clampPoint({ x: Number(o.D.x), y: Number(o.D.y) });
    }
    // The applet's four corners always make a parallelogram with AB and DC
    // horizontal: A.y = B.y, C.y = D.y and A.x - D.x = B.x - C.x.
    const top = (state.C.y + state.D.y) / 2;
    state.C.y = state.D.y = top;
    const bottom = (state.A.y + state.B.y) / 2;
    state.A.y = state.B.y = bottom;
    state.D.x = state.A.x - (state.B.x - state.C.x);
    if (Number.isFinite(Number(o.n))) {
      state.n = clamp(Math.round(Number(o.n)), MIN_PARTS, MAX_PARTS);
    }
    if (o.names === true) state.names = true;
    return state;
  }

  /** The moves the illustration accepts: drag a corner, change N, tick, reset. */
  function legalMoves() {
    return [
      { type: "point", name: "A", x: START_A.x, y: START_A.y },
      { type: "point", name: "B", x: START_B.x, y: START_B.y },
      { type: "point", name: "C", x: START_C.x, y: START_C.y },
      { type: "point", name: "D", x: START_D.x, y: START_D.y },
      { type: "parts", value: DEFAULT_PARTS },
      { type: "names", value: true },
      { type: "reset" },
    ];
  }

  /**
   * The position after a move, or null when the move is not allowed.
   * The four corner rules are exactly mouseReleased() of the applet: after a
   * drag one neighbouring corner is moved so the parallelogram is preserved.
   */
  function move(state, m) {
    if (!m || !state) return null;
    let next = null;
    if (m.type === "point") {
      if (!["A", "B", "C", "D"].includes(m.name)) return null;
      if (!Number.isFinite(Number(m.x)) || !Number.isFinite(Number(m.y))) return null;
      const q = clampPoint({ x: Number(m.x), y: Number(m.y) });
      next = { ...state, [m.name]: q };
      if (m.name === "A") {
        next.B = { x: state.C.x + (q.x - state.D.x), y: q.y }; // B.x = C.x + (A.x - D.x)
      } else if (m.name === "B") {
        next.A = { x: state.D.x + (q.x - state.C.x), y: q.y }; // A.x = D.x + (B.x - C.x)
      } else if (m.name === "C") {
        next.D = { x: state.A.x - (state.B.x - q.x), y: q.y }; // D.x = A.x - (B.x - C.x)
      } else {
        next.C = { x: state.B.x - (state.A.x - q.x), y: q.y }; // C.x = B.x - (A.x - D.x)
      }
    } else if (m.type === "parts") {
      if (!Number.isFinite(Number(m.value))) return null;
      next = { ...state, n: clamp(Math.round(Number(m.value)), MIN_PARTS, MAX_PARTS) };
    } else if (m.type === "names") {
      if (typeof m.value !== "boolean") return null;
      next = { ...state, names: m.value };
    } else if (m.type === "reset") {
      // The N spin box and "Show names" keep their setting across a Reset().
      return { ...start(), n: state.n, names: state.names };
    } else {
      return null;
    }
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A demo: nothing to win; "done" once the player has changed the picture. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** A point at the exact rational fraction num/den on the way from p to q. */
  function pointAtFraction(p, q, num, den) {
    return {
      x: (p.x * (den - num) + q.x * num) / den,
      y: (p.y * (den - num) + q.y * num) / den,
    };
  }

  /**
   * Everything the applet draws, with the crossings computed as exact
   * fractions instead of floating-point line intersections. E[k] is on the
   * diagonal AC at 1/(k+2); P[k] is its parallel projection onto AB at
   * 1/(k+2), for k = 0..N-2. E[0] = AC ∩ DB and P[0] = midpoint of AB.
   */
  function construct(state) {
    const { A, B, C, D } = state;
    const n = clamp(Math.round(Number(state.n) || DEFAULT_PARTS), MIN_PARTS, MAX_PARTS);
    const Es = [], Ps = [], stepLines = [], rayLines = [];
    for (let k = 0; k <= n - 2; k++) {
      const den = k + 2;
      const E = pointAtFraction(A, C, 1, den);
      const P = pointAtFraction(A, B, 1, den);
      Es.push(E);
      Ps.push(P);
      stepLines.push([E, P]); // the line through E parallel to BC, drawn to AB
      if (k >= 1) rayLines.push([Ps[k - 1], D]); // the line P_(k-1)D that finds E_k
    }
    return {
      A: copy(A), B: copy(B), C: copy(C), D: copy(D), n,
      names: Boolean(state.names), Es, Ps, stepLines, rayLines,
      cuts: [copy(A), ...Ps.map(copy), copy(B)], parts: n,
    };
  }

  /* ----------------------------------------- GeoSDoub, for the claim's proof */

  /** GeoSDoub.Intersect(line(p,q), line(r,s)): ax+by+c = 0 determinants. */
  function lineIntersection(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1) return null; // applet: NaN point
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.GetParallelTo(p, q, r) = p + 100*(q - r). */
  function parallelPoint(p, q, r) {
    return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
  }

  const near = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
  const same = (p, q, tol = 1e-6) => near(p.x, q.x, tol) && near(p.y, q.y, tol);
  const collinear = (p, a, b, tol = 1e-6) => {
    const cross = (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
    return Math.abs(cross) <= tol * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  };

  /**
   * The cut-the-knot lemma and corollary, measured on a configuration:
   * n*AP = AD implies (n+1)*AQ = AC, and the foot gives 1/(n+1) of AB.
   * Here the k-th crossing has n = k+1 and the fraction is 1/(k+2).
   */
  function claims(state) {
    const g = construct(state);
    const out = { lemma: true, projection: true, lastPart: true };
    g.Es.forEach((E, k) => {
      const den = k + 2;
      // (k+1)*AP_(k-1) = AD for k >= 1 (for k = 0 the point P is D itself).
      if (k === 0) {
        if (!same(E, lineIntersection(g.D, g.B, g.A, g.C), 1e-5)) out.lemma = false;
      } else {
        const hit = lineIntersection(g.Ps[k - 1], g.D, g.A, g.C);
        if (!hit || !same(E, hit, 1e-5)) out.lemma = false;
      }
      if (!collinear(E, g.A, g.C) || !near((E.x - g.A.x) * den, g.C.x - g.A.x, 1e-5) ||
          !near((E.y - g.A.y) * den, g.C.y - g.A.y, 1e-5)) out.lemma = false;
      const parallel = parallelPoint(E, g.B, g.C);
      const foot = lineIntersection(g.A, g.B, E, parallel);
      if (!foot || !same(foot, g.Ps[k], 1e-5)) out.projection = false;
    });
    const last = g.Ps[g.Ps.length - 1];
    if (!near(last.x - g.A.x, (g.B.x - g.A.x) / g.n, 1e-5) ||
        !near(last.y - g.A.y, (g.B.y - g.A.y) / g.n, 1e-5)) out.lastPart = false;
    return out;
  }

  return {
    WIDTH, HEIGHT, MIN_PARTS, MAX_PARTS, DEFAULT_PARTS,
    START_A, START_B, START_C, START_D,
    start, legalMoves, move, result, pointAtFraction, construct,
    lineIntersection, parallelPoint, claims,
  };
})();
