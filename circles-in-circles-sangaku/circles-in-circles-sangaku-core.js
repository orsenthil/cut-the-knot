"use strict";

/*
 * Circles In Circles Sangaku — the 1837 Aichi temple puzzle from
 * Alexander Bogomolny's applet CirclesInCirclesSangaku.  AB is a diameter of
 * a circle of radius r; X is the point where one of the four small circles
 * touches AB, at distance x from the centre O.  Those four circles have
 * radius r1 = (r² − x²)/(2r).  The circle touching all four has radius
 * r3 = x²/r, the circle above the upper pair has the very same radius
 * (r4 = r3), and the circle tucked inside the lens between that pair has
 * radius r5 = r1 − x.  At x = r/3 all three are r/9.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, CirclesInCirclesSangakuCore, so the page
 * loads it with a plain <script> and porting/check-circles-in-circles-sangaku.mjs
 * can load it in Node.  Positions are plain objects in the SVG's viewBox units.
 * Every circle is transcribed from CirclesInCirclesSangakuCanvas.Compute();
 * the arrays keep the applet's order and use null for a circle it leaves out.
 */

const CirclesInCirclesSangakuCore = (() => {
  const VIEW = { width: 400, height: 300 };
  const O = { x: 200, y: 150 }; // the applet's centre for a 400 × 300 board
  const R = 130; // the applet's radius: min(400, 300) − 20 − 10

  const P = (x, y) => ({ x: x, y: y });
  const circ = (x, y, r) => ({ x: x, y: y, r: r });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const gap = (a, b) => Math.abs(a - b);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** The ends of the diameter AB, reconstructed from the board radius. */
  function ends(state) {
    const r = state && Number.isFinite(state.r) && state.r > 0 ? state.r : R;
    return { A: P(O.x - r, O.y), B: P(O.x + r, O.y) };
  }

  /** The drawing the applet opens with: X at 0.4 r from O, names not shown. */
  function start(options) {
    const o = options || {};
    const r = Number.isFinite(o.r) && o.r > 0 ? o.r : R;
    const ratio = Number.isFinite(o.xRatio) ? clamp(o.xRatio, -1, 1) : 0.4;
    return {
      r: r,
      x: O.x + ratio * r,
      options: {
        names: o.names === undefined ? false : !!o.names,
        secondary: !!o.secondary,
        fill: !!o.fill,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start({ r: state.r, names: state.options.names,
      secondary: state.options.secondary, fill: state.options.fill });
    s.explored = state.explored;
    return s;
  }

  /** X is the only thing a player can drag; it stays on the diameter AB. */
  function legalMoves(state) {
    return ["X"];
  }

  /** Where a dragged X may sit: on AB, between A and B (the applet's guard). */
  function project(state, p) {
    if (!p || !Number.isFinite(p.x)) return state.x;
    return clamp(p.x, O.x - state.r, O.x + state.r);
  }

  function move(state, name, p) {
    if (name !== "X" || !p || !Number.isFinite(p.x)) return state;
    const x = project(state, p);
    if (x === state.x) return state;
    return Object.assign({}, state, { x: x, explored: true });
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** The applet's two marked points X3 at x = ±r/3 (r3 = r4 = r5 = r/9). */
  function setSpecial(state, side) {
    return Object.assign({}, state, {
      x: O.x + (side < 0 ? -1 : 1) * state.r / 3,
      explored: true,
    });
  }

  /** An illustration has no win and no loss. */
  function result(state) {
    return null;
  }

  /*
   * CirclesInCirclesSangakuCanvas.Compute(), line for line.  Bytecode locals:
   * slot 1 = r, 3 = x = |X.x − O.x|, 5 = r1, 7 = r3, 9 = r5, 11 = (r−r3)/2.
   * Note that the applet feeds |x| (not the signed offset) to every centre.
   */
  function geometry(state) {
    const r = state.r;
    const X = state.x;
    const endsAB = ends(state);
    if (!(X >= endsAB.A.x && X <= endsAB.B.x)) return null;

    const r0 = r;                       // dstore_1
    const x = Math.abs(X - O.x);        // dstore_3
    const r1 = (r0 * r0 - x * x) / 2 / r0; // dstore_5: (r²−x²)/2/r
    const r3 = x * x / r0;              // dstore_7
    const r5 = r1 - x;                  // dstore_9
    const half = (r0 - r3) / 2;         // dstore_11

    const circles4 = [
      circ(O.x + x, O.y - r1, r1),
      circ(O.x - x, O.y - r1, r1),
      circ(O.x - x, O.y + r1, r1),
      circ(O.x + x, O.y + r1, r1),
    ];
    const circles3 = [
      circ(O.x, O.y, r3),
      circ(O.x, O.y - r0 + r3, r3),
      circ(O.x, O.y + r0 - r3, r3),
    ];
    const circles2 = r5 > 0
      ? [circ(O.x, O.y - r1, r5), circ(O.x, O.y + r1, r5)]
      : [null, null];
    const circles5 = [
      circ(O.x, O.y - r0 + half, half),
      circ(O.x, O.y - r0 + 2 * half + r1, r1),
      null,
      circ(O.x, O.y + r0 - 2 * half - r1, r1),
      circ(O.x, O.y + r0 - half, half),
    ];
    if (2 * r3 - r0 > 0) circles5[2] = circ(O.x, O.y + 2 * r3 - r0, 2 * r3 - r0);

    return {
      A: endsAB.A, B: endsAB.B, O: circ(O.x, O.y, r0), X: P(X, O.y),
      r: r0, x: x, signedX: X - O.x,
      r1: r1, r3: r3, r4: r3, r5: r5, half: half,
      circles4: circles4, circles3: circles3,
      circles2: circles2, circles5: circles5,
      special: Math.abs(x - r0 / 3) < 1e-9,
    };
  }

  /*
   * Tangencies of the construction, as errors in units of board length.
   * The four r1 circles sit inside the big circle and touch AB; the r3
   * circle at O touches all four externally, and the other two r3 circles
   * touch the pair above/below them and the big circle inside; an r5 circle
   * sits inside each overlapping r1 pair.
   */
  function tangency(g) {
    if (!g) return null;
    const O0 = P(g.O.x, g.O.y);
    let r1Inside = 0, r1OnAB = 0, r3ToFour = 0, r3ToPair = 0, r3Inside = 0, r5Inside = 0;
    for (const c of g.circles4) {
      r1Inside = Math.max(r1Inside, gap(dist(c, O0) + c.r, g.r));
      r1OnAB = Math.max(r1OnAB, gap(Math.abs(c.y - O0.y), g.r1));
      r3ToFour = Math.max(r3ToFour, gap(dist(c, O0), g.r1 + g.r3));
    }
    for (const i of [1, 2]) {
      const c = g.circles3[i];
      r3Inside = Math.max(r3Inside, gap(dist(c, O0) + c.r, g.r));
      const side = i === 1 ? g.circles4.slice(0, 2) : g.circles4.slice(2, 4);
      for (const s of side) r3ToPair = Math.max(r3ToPair, gap(dist(c, s), g.r1 + g.r3));
    }
    for (const i of [0, 1]) {
      if (!g.circles2[i]) continue;
      const c = g.circles2[i];
      const side = i === 0 ? g.circles4.slice(0, 2) : g.circles4.slice(2, 4);
      for (const s of side) r5Inside = Math.max(r5Inside, gap(dist(c, s) + c.r, g.r1));
    }
    return {
      r1InsideBig: r1Inside, r1TouchesAB: r1OnAB,
      centralR3ToFour: r3ToFour, outerR3ToPair: r3ToPair,
      outerR3InsideBig: r3Inside, r5InsidePair: r5Inside,
    };
  }

  /** The line under the board; the same numbers the logic test checks. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move X onto the line AB between A and B.";
    return "OX = " + g.x.toFixed(1) + ". Four circles of radius " + g.r1.toFixed(1) +
      ", three of radius " + g.r3.toFixed(1) + " — r3 and r4 are equal" +
      (g.r5 > 0 ? ", and the lens circle has radius " + g.r5.toFixed(1) : ", and no lens circle fits") + ".";
  }

  return {
    VIEW: VIEW, O: O, R: R,
    start: start, reset: reset, ends: ends, legalMoves: legalMoves,
    project: project, move: move, setOption: setOption, setSpecial: setSpecial,
    result: result, geometry: geometry, tangency: tangency, describe: describe,
    dist: dist,
  };
})();
