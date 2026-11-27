"use strict";

/*
 * Circles Lined On Tri Sides — the geometry behind Bogomolny's applet
 * CirclesLinedOnTriSides.
 *
 * Choose two different whole numbers N and M (1..8). They make the right
 * triangle with legs N²−M² and 2NM and hypotenuse N²+M². If R is its inradius,
 * equal circles of radius r = R / (2R + 1) can be lined along both legs:
 * (leg + 1) circles on each leg, sharing the one at the right-angle corner,
 * so leg1 + leg2 + 1 circles in all. In the 3-4-5 case R = 1, r = 1/3 and the
 * big incircle is exactly three times a small one.
 *
 * `compute` is a second, literal transcription of the applet's private
 * Compute() bytecode (its local slots L1, L2, L3, L8, KV, KH, the integer
 * division, and the duplicate row its Draw() paints twice). `arrangement`
 * places the circles as the article describes them, on both legs.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CirclesLinedOnTriSidesCore, so the page loads it with
 * a plain <script> and porting/check-circles-lined-on-tri-sides.mjs loads it in
 * Node. Functions take plain data and return new objects; inputs are unchanged.
 */
const CirclesLinedOnTriSidesCore = (() => {
  const MIN = 1;
  const MAX = 8;
  const WIDTH = 400;
  const HEIGHT = 300;
  const MARGIN = 20;
  const EPS = 1e-9;

  const near = (a, b, eps = EPS) => Math.abs(a - b) <= eps;
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));

  /** The applet's starting values: N = 1, M = 2, statement hidden. */
  function start(options) {
    const o = options || {};
    return {
      N: clampInt(o.N === undefined ? 1 : o.N, MIN, MAX),
      M: clampInt(o.M === undefined ? 2 : o.M, MIN, MAX),
      showStatement: Boolean(o.showStatement),
    };
  }

  /** A new state with changed options, clamped to the applet's 1..8 range. */
  function withOptions(state, changes) {
    const o = changes || {};
    return {
      N: clampInt(o.N === undefined ? state.N : o.N, MIN, MAX),
      M: clampInt(o.M === undefined ? state.M : o.M, MIN, MAX),
      showStatement: o.showStatement === undefined ? state.showStatement : Boolean(o.showStatement),
    };
  }

  /** legs L1, L2 and hypotenuse L3, exactly as Compute() builds them. */
  function legs(N, M) {
    const L1 = N > M ? N * N - M * M : 2 * N * M;
    const L2 = N > M ? 2 * N * M : M * M - N * N;
    return { L1, L2, L3: N * N + M * M };
  }

  /**
   * CirclesLinedOnTriSidesCanvas.Compute(), transcribed from the bytecode.
   * Width/height default to the applet's 400x300 recommendation; the 20-pixel
   * margin and the Java integer divisions are kept as they are.
   */
  function compute(state, size) {
    const N = state.N;
    const M = state.M;
    const width = size && size.width !== undefined ? size.width : WIDTH;
    const height = size && size.height !== undefined ? size.height : HEIGHT;
    const doNotDraw = N === M;
    if (doNotDraw) return { doNotDraw: true, N, M, width, height };

    const { L1, L2, L3 } = legs(N, M);
    const KV = L2 + 1;
    const KH = L1 + 1;
    const margin = MARGIN;
    /* Java: Math.min((width - 2*margin)/L1, (height - 2*margin)/L2) as ints. */
    const scale = Math.min(
      Math.trunc((width - 2 * margin) / L1),
      Math.trunc((height - 2 * margin) / L2),
    );
    const A = scale * L2;
    const B = scale * L1;
    const C = Math.sqrt(A * A + B * B);
    const x0 = (width - B) / 2;
    const y0 = (height + A) / 2;
    const L8 = L1 + L2 - L3; /* twice the inradius, in grid units */
    const coef = L8 + 1;
    const r = ((scale * L8) / 2) / coef;
    const R = (scale * L8) / 2;

    const incircle = { x: x0 + B - R, y: y0 - R, r: R };
    const auxCircle = { x: margin + R, y: margin + R, r: R };
    const statementCircles = [];
    for (let i = 0; i < coef; i++) {
      statementCircles.push({
        x: auxCircle.x - auxCircle.r + r * (2 * i + 1),
        y: auxCircle.y,
        r: r,
      });
    }
    /* Draw(): the first row starts at index 0, the second at index 1. They
       share the same y, so the second row repaints and extends the first. */
    const paintedOnBase = [];
    for (let i = 0; i < KV; i++) {
      paintedOnBase.push({ x: x0 + B - r - 2 * i * r, y: y0 - r, r: r });
    }
    const paintedAgain = [];
    for (let i = 1; i < KH; i++) {
      paintedAgain.push({ x: x0 + B - r - 2 * i * r, y: y0 - r, r: r });
    }

    return {
      doNotDraw: false, N, M, width, height,
      L1, L2, L3, KV, KH, scale, A, B, C, x0, y0, L8, coef, R, r,
      incircle, auxCircle, statementCircles, paintedOnBase, paintedAgain,
    };
  }

  /**
   * The article's arrangement: r = R/(2R+1), with L1+1 circles along the
   * horizontal leg and L2+1 along the vertical one, sharing the corner
   * circle. The end offsets r·(h+leg)/otherLeg make both rows fit exactly.
   */
  function arrangement(state, size) {
    const g = compute(state, size);
    if (g.doNotDraw) return { doNotDraw: true, circles: [], base: [], side: [] };

    const vertex = { x: g.x0 + g.B, y: g.y0 };
    const left = { x: g.x0, y: g.y0 };
    const top = { x: vertex.x, y: g.y0 - g.A };
    const baseOffset = g.r * (g.L3 + g.L1) / g.L2;
    const sideOffset = g.r * (g.L3 + g.L2) / g.L1;

    const base = [];
    for (let i = 0; i < g.L1 + 1; i++) {
      base.push({ x: left.x + baseOffset + 2 * i * g.r, y: vertex.y - g.r, r: g.r });
    }
    const side = [];
    for (let i = 0; i < g.L2 + 1; i++) {
      side.push({ x: vertex.x - g.r, y: vertex.y - g.r - 2 * i * g.r, r: g.r });
    }
    return {
      doNotDraw: false, geometry: g, vertex, left, top,
      baseOffset, sideOffset, base, side,
      circles: base.concat(side.slice(1)),
    };
  }

  /** The page's claims, checked for this pair of numbers. */
  function claims(state, size) {
    const a = arrangement(state, size);
    if (a.doNotDraw) return { doNotDraw: true };
    const g = a.geometry;
    const spacing = (row) => row.slice(1).every((c, i) =>
      near(Math.hypot(c.x - row[i].x, c.y - row[i].y), 2 * g.r, 1e-7));
    return {
      doNotDraw: false,
      triple: g.L1 * g.L1 + g.L2 * g.L2 === g.L3 * g.L3,
      inradiusTwice: g.L8 === 2 * g.R / g.scale,
      integerCoefficient: Number.isInteger(g.coef) && g.coef === 2 * g.R / g.scale + 1,
      smallRadius: near(g.r, g.R / g.coef, 1e-9),
      ratioIsInteger: near(g.R / g.r, g.coef, 1e-7),
      baseCount: a.base.length === g.L1 + 1,
      sideCount: a.side.length === g.L2 + 1,
      totalCount: a.circles.length === g.L1 + g.L2 + 1,
      baseFits: near(a.baseOffset + 2 * g.L1 * g.r + g.r, g.B, 1e-7),
      sideFits: near(a.sideOffset + 2 * g.L2 * g.r + g.r, g.A, 1e-7),
      baseTangent: a.base.every((c) => near(c.y, g.y0 - g.r, 1e-7)),
      sideTangent: a.side.every((c) => near(c.x, g.x0 + g.B - g.r, 1e-7)),
      cornerShared: near(a.base[a.base.length - 1].x, a.side[0].x, 1e-7)
        && near(a.base[a.base.length - 1].y, a.side[0].y, 1e-7),
      neighboursTouch: spacing(a.base) && spacing(a.side),
      endsTouchHypotenuse: [a.base[0], a.side[a.side.length - 1]].every((c) =>
        near((g.A * g.B - g.A * (g.x0 + g.B - c.x) - g.B * (g.y0 - c.y)) / g.C, g.r, 1e-7)),
      insideIncircle: g.incircle.r > g.r && near(g.incircle.x, g.x0 + g.B - g.R, 1e-7),
    };
  }

  return {
    MIN, MAX, WIDTH, HEIGHT, MARGIN,
    start, withOptions, legs, compute, arrangement, claims,
  };
})();
