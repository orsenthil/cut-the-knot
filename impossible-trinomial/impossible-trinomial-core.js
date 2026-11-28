"use strict";

/*
 * ImpossibleTrinomial: Bogomolny's "An Impossible Fork" (the blivet).
 *
 * The Java applet does one thing: it draws a single flat line drawing with
 * six parallel rails and three oval ends. Read from the left the rails close
 * into two rectangular prongs; read from the right they end in three round
 * cylinders. Two scrollbars slide a background-coloured band over the drawing
 * so that you can hide parts of it and watch the reading flip. There is no
 * move, opponent, win or loss.
 *
 * This file keeps all of that as plain data: no document, no window, no
 * storage. It defines one global, ImpossibleTrinomialCore. Geometry is taken
 * straight from ImpossibleTrinomialCanvas.init/Draw/ExtendFrom/DrawCover in
 * the original bytecode: t = height / 7 (integer division), X0 = X = t / 2,
 * Y0 = height - 2t, Y = t / sqrt(3), Z = width * 7 / 15 (integer division).
 * The local names p2..p8 below are the applet's own local variables in Draw.
 */
const ImpossibleTrinomialCore = (() => {
  // Scrollbar(0, 0, 5, 1, 60) and Scrollbar(0, 0, 10, 1, 110) in the panel.
  const W_MIN = 1;
  const W_MAX = 60;
  const D_MIN = 1;
  const D_MAX = 110;
  const DEFAULT_WIDTH = 600; // the page embeds the applet at 600 x 300
  const DEFAULT_HEIGHT = 300;
  const DEFAULT_W = 1; // the canvas fields W and D both start at 1
  const DEFAULT_D = 1;

  /** Java's integer division truncates toward zero; these values are positive. */
  function javaDiv(a, b) {
    return Math.trunc(a / b);
  }

  function clamp(value, lo, hi, fallback) {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return n < lo ? lo : n > hi ? hi : n;
  }

  const clampW = (v) => clamp(v, W_MIN, W_MAX, DEFAULT_W);
  const clampD = (v) => clamp(v, D_MIN, D_MAX, DEFAULT_D);

  /**
   * A position for the tutor and the player's record: just the canvas size
   * and the two scrollbar values. Everything drawn is derived from it.
   */
  function start(options = {}) {
    return {
      width: clamp(options.width, 1, 10000, DEFAULT_WIDTH),
      height: clamp(options.height, 1, 10000, DEFAULT_HEIGHT),
      W: clampW(options.W === undefined ? DEFAULT_W : options.W),
      D: clampD(options.D === undefined ? DEFAULT_D : options.D),
    };
  }

  function withW(state, value) {
    return Object.assign({}, state, { W: clampW(value) });
  }

  function withD(state, value) {
    return Object.assign({}, state, { D: clampD(value) });
  }

  function reset(state) {
    return Object.assign({}, state, { W: DEFAULT_W, D: DEFAULT_D });
  }

  /**
   * ImpossibleTrinomialCanvas.init and Draw: the eight corner points, the
   * five oblique strokes, the six horizontal rails made by ExtendFrom, and
   * the three drawOval calls. Values are in applet (canvas) units.
   */
  function geometry(state) {
    const width = clamp(state.width, 1, 10000, DEFAULT_WIDTH);
    const height = clamp(state.height, 1, 10000, DEFAULT_HEIGHT);
    const t = javaDiv(height, 7);
    const X0 = javaDiv(t, 2);
    const Y0 = height - 2 * t;
    const X = javaDiv(t, 2);
    const Y = t / Math.sqrt(3);
    const Z = javaDiv(width * 7, 15);

    const p2 = { x: X0 + 2 * X, y: Y0 };
    const p3 = { x: X0 + X, y: Y0 - Y };
    const p4 = { x: X0 + 4 * X, y: Y0 - 2 * Y };
    const p5 = { x: p4.x + 2 * X, y: p4.y };
    const p6 = { x: p5.x + X, y: p5.y - Y };
    const p7 = { x: p6.x - X, y: p6.y - Y };
    const p8 = { x: X0 + 5 * X, y: Y0 - 5 * Y };
    const points = { p2, p3, p4, p5, p6, p7, p8 };

    // The five GeoSDoub.DrawLine calls, in the applet's own order.
    const strokes = [
      { name: "lower-end", a: p2, b: p3 },
      { name: "long-edge", a: p3, b: p8 },
      { name: "upper-left", a: p4, b: p7 },
      { name: "notch-lower", a: p5, b: p6 },
      { name: "notch-upper", a: p6, b: p7 },
    ];

    // Each ExtendFrom rounds both ends of a horizontal line separately.
    const railData = [
      { name: "p2", from: p2, dx: Z + 7 * X },
      { name: "p3", from: p3, dx: Z + 8 * X },
      { name: "p4", from: p4, dx: Z + 6 * X },
      { name: "p6", from: p6, dx: Z + 3 * X },
      { name: "p7", from: p7, dx: Z + 5 * X },
      { name: "p8", from: p8, dx: Z + 6 * X },
    ];
    const rails = railData.map((r) => ({
      name: r.name,
      dx: r.dx,
      from: { x: Math.round(r.from.x), y: Math.round(r.from.y) },
      to: { x: Math.round(r.from.x + r.dx), y: Math.round(r.from.y) },
    }));

    // drawOval(x, y, width, height): three ellipses, one per cylinder end.
    const ovalData = [
      { name: "lower", p: p3, shift: 7 },
      { name: "middle", p: p6, shift: 2 },
      { name: "upper", p: p8, shift: 5 },
    ];
    const ovals = ovalData.map((o) => ({
      name: o.name,
      x: Math.round(o.p.x + Z + o.shift * X + X / 2),
      y: Math.round(o.p.y),
      w: Math.round(X),
      h: Math.round(Y),
    }));

    return { width, height, t, X0, Y0, X, Y, Z, points, strokes, rails, ovals };
  }

  /**
   * ImpossibleTrinomialCanvas.DrawCover: a background-coloured band of width
   * W percent, slid by D percent of the *remaining* width. D above 100 pushes
   * the band past the right edge, leaving the whole fork visible.
   */
  function cover(state) {
    const geom = geometry(state);
    const w = clampW(state.W === undefined ? DEFAULT_W : state.W);
    const d = clampD(state.D === undefined ? DEFAULT_D : state.D);
    const width = javaDiv(geom.width * w, 100);
    const x = javaDiv((geom.width - width) * d, 100);
    return { x, y: 0, width, height: geom.height - 1 };
  }

  /** Words for the status line; a demo has nothing to win or lose. */
  function describe(state) {
    const band = cover(state);
    if (band.x >= state.width) {
      return "The cover has slid off the right: two flat prongs on the left become three round tubes on the right.";
    }
    if (state.D >= 100) {
      return "The cover sits at the right edge, so the left prongs stay in view and the round ends are hidden.";
    }
    if (state.D <= 1) {
      return `The cover sits at the left edge and hides ${band.width} of ${state.width} columns. The fork is still one drawing.`;
    }
    return `The cover hides columns ${band.x} to ${band.x + band.width}, so only parts of the same six lines are left to read.`;
  }

  return {
    W_MIN, W_MAX, D_MIN, D_MAX, DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_W, DEFAULT_D,
    javaDiv, clampW, clampD, start, withW, withD, reset, geometry, cover, describe,
  };
})();
