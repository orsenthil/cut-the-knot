"use strict";

/*
 * Areas In Square, from Alexander Bogomolny's applet AreasInSquare.
 *
 * The page puts E on the side AD of a square ABCD (DE = AD/N, N >= 2), draws
 * the two lines DB and CE, and claims that the four pieces have areas in the
 * ratio I : II : III : IV = 1 : N : N² : N² + N - 1. The applet draws the same
 * figure with its letters turned a quarter turn: its A is the page's D, its B
 * the page's C, its C the page's B and its D the page's A. Its line AC is the
 * page's DB and its line BE is the page's CE, so the four coloured pieces are
 * the page's I, II, III, IV in that order (cyan, blue, red, orange).
 *
 * Reset() in AreasInSquareCanvas lays out a square of side min(w,h)-40,
 * rounded down to a whole multiple of N, centred on the canvas, with E one
 * N-th of the way up from A. M is GeoSDoub.Intersect(A,C,B,E). The check
 * script transcribes that bytecode a second time and compares every point.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines the global AreasInSquareCore; every function takes a
 * plain position and returns a new one.
 */
const AreasInSquareCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 400;
  const MARGIN = 20;
  const N_MIN = 2;
  const N_MAX = 20;
  const EPS = 1e-9;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const close = (a, b, tol = 1e-7) =>
    Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

  /** GeoSDoub.Intersect(p1,p2,p3,p4), from its bytecode: NaN if |d| < 1. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
  }

  const maxSide = (width, height) =>
    Math.max(0, Math.min(width - 2 * MARGIN, height - 2 * MARGIN));

  /** Reset()'s integer truncation: side = (side / N) * N. */
  const snapSide = (width, height, n) => Math.floor(maxSide(width, height) / n) * n;

  /** Signed shoelace area; abs() turns it into an ordinary area. */
  function area(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum / 2;
  }

  /**
   * The whole drawing for a given N and square side, in canvas coordinates.
   * AD, BC, BE, DF, AB and CD are the point arrays Reset() builds; the
   * dissection segments are exactly the four loops of ShowDissection().
   */
  function layout(n, side, width, height) {
    const x0 = (width - side) / 2, y0 = (height - side) / 2;
    const A = { x: x0, y: y0 + side };
    const B = { x: x0 + side, y: y0 + side };
    const C = { x: x0 + side, y: y0 };
    const D = { x: x0, y: y0 };
    const E = { x: x0, y: A.y - side / n };
    const M = intersect(A, C, B, E);

    const AD = [], BC = [], BE = [], DF = [], AB = [], CD = [];
    for (let k = 0; k < n; k++) {
      AD.push({ x: A.x, y: A.y - (k + 1) * side / n });
      BC.push({ x: B.x, y: B.y - k * side / n });
    }
    // Reset()'s direction vector: (side/(N+1), side/(N*(N+1))) = (B-E)/(N+1).
    const vx = side / (n + 1), vy = side / (n * (n + 1));
    const steps = Math.ceil(n);
    for (let k = 0; k <= steps; k++) {
      BE.push({ x: E.x + k * vx, y: E.y + k * vy });
      DF.push({ x: D.x + (k + 1) * vx, y: D.y + (k + 1) * vy });
    }
    for (let k = 0; k < n - 1; k++) {
      AB.push({ x: A.x + (k + 1) * side / n, y: A.y });
      CD.push({ x: C.x - (k + 1) * side / n, y: C.y });
    }
    const P = intersect(A, C, D, BC[BC.length - 1]);

    const dissection = [];
    for (let k = 0; k < n; k++) dissection.push([DF[k], BE[k + 1]]);
    for (let k = 1; k < n; k++) dissection.push([AD[k], BC[k]]);
    for (let k = 0; k < n - 1; k++) {
      dissection.push([DF[k], AD[AD.length - k - 2]]);
      dissection.push([BC[k + 1], BE[BE.length - k - 1]]);
    }
    for (let k = 0; k < n - 1; k++) {
      dissection.push([M, AB[k]]);
      dissection.push([P, CD[k]]);
    }
    return { side, x0, y0, A, B, C, D, E, M, P, AD, BC, BE, DF, AB, CD, dissection };
  }

  /** The opening picture: the applet's N = 2, both switches off. */
  function start(options) {
    const o = options || {};
    const width = o.width || WIDTH;
    const height = o.height || HEIGHT;
    const n = clamp(Math.round(o.n == null ? 2 : o.n), N_MIN, N_MAX);
    return {
      width, height, n,
      span: snapSide(width, height, n),
      showColors: !!o.showColors,
      showDissection: !!o.showDissection,
      explored: false,
    };
  }

  /**
   * One move. `n` is the applet's spinner (whole numbers, 2..20, and it calls
   * Reset). `point E` slides E along AD, so it only changes N and leaves the
   * square where it is. `point C` resizes the centred square. `option` sets a
   * checkbox, and `reset` restores the opening picture at this board size.
   */
  function move(state, m) {
    if (!state || !m) return null;
    if (m.type === "reset") return start({ width: state.width, height: state.height });
    if (m.type === "option") {
      const keys = ["showColors", "showDissection"];
      if (!keys.includes(m.key) || typeof m.value !== "boolean") return null;
      return Object.assign({}, state, { [m.key]: m.value, explored: true });
    }
    if (m.type === "n") {
      if (!Number.isInteger(m.value) || m.value < N_MIN || m.value > N_MAX) return null;
      const n = m.value;
      return Object.assign({}, state, {
        n, span: snapSide(state.width, state.height, n), explored: true,
      });
    }
    if (m.type === "point") {
      if (!m.point || !Number.isFinite(m.point.x) || !Number.isFinite(m.point.y)) return null;
      const q = m.point;
      if (q.x < 0 || q.x > state.width || q.y < 0 || q.y > state.height) return null;
      const g = compute(state);
      if (m.name === "E") {
        const d = g.A.y - q.y;
        if (d <= 0) return null;
        const n = clamp(g.side / d, N_MIN, N_MAX);
        return Object.assign({}, state, { n, explored: true });
      }
      if (m.name === "C") {
        const cx = state.width / 2, cy = state.height / 2;
        const reach = 2 * Math.max(Math.abs(q.x - cx), Math.abs(q.y - cy));
        const span = clamp(reach, 60, maxSide(state.width, state.height));
        return Object.assign({}, state, { span, explored: true });
      }
    }
    return null;
  }

  /** Areas of the four coloured pieces, with the page's ratio and checks. */
  function compute(state) {
    const n = state.n, side = state.span;
    const g = layout(n, side, state.width, state.height);
    const regions = [
      [g.A, g.M, g.E],
      [g.A, g.M, g.B],
      [g.B, g.M, g.C],
      [g.C, g.D, g.E, g.M],
    ];
    const areas = regions.map((r) => Math.abs(area(r)));
    const ratios = [1, n, n * n, n * n + n - 1];
    const unit = side * side / (2 * n * (n + 1));
    const total = areas.reduce((a, b) => a + b, 0);
    const onAC = Math.abs((g.C.x - g.A.x) * (g.M.y - g.A.y) -
      (g.C.y - g.A.y) * (g.M.x - g.A.x)) < 1e-6;
    const onBE = Math.abs((g.E.x - g.B.x) * (g.M.y - g.B.y) -
      (g.E.y - g.B.y) * (g.M.x - g.B.x)) < 1e-6;
    return Object.assign({}, g, {
      n, side, regions, areas, ratios, unit, total,
      squareArea: side * side, onAC, onBE,
      fraction: close(g.A.y - g.E.y, side / n),
    });
  }

  /** The page's claim and the identities the drawing relies on. */
  function claims(g) {
    return {
      ratio: g.ratios.every((r, i) => close(g.areas[i], g.unit * r)),
      areasAddUp: close(g.total, g.squareArea),
      EAtFraction: g.fraction,
      MOnBothLines: g.onAC && g.onBE,
      positive: g.areas.every((v) => v > EPS),
      ratioAddsUp: close(g.ratios.reduce((a, b) => a + b, 0), 2 * g.n * (g.n + 1)),
    };
  }

  /** A sentence for #status: plain words plus the actual numbers. */
  function describe(state) {
    const g = compute(state);
    const nText = g.n.toFixed(2).replace(/\.?0+$/, "");
    const areas = g.areas.map((v) => Math.round(v)).join(", ");
    return `N ${nText}. Areas I : II : III : IV = ${areas}, in the ratio ` +
      `1 : ${nText} : ${(g.n * g.n).toFixed(2).replace(/\.?0+$/, "")} : ` +
      `${(g.n * g.n + g.n - 1).toFixed(2).replace(/\.?0+$/, "")}.`;
  }

  return {
    WIDTH, HEIGHT, MARGIN, N_MIN, N_MAX, EPS,
    clamp, close, intersect, maxSide, snapSide, area,
    layout, start, move, compute, claims, describe,
  };
})();
