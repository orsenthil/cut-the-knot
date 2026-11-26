"use strict";

/*
 * BulgingLines — the geometry behind Bogomolny's Bulging Lines illusion applet.
 *
 * The applet paints a 9x9 checkerboard of grey and light-grey squares, puts a
 * circle of one of two other colours at 64 of the grid intersections, and
 * draws eight vertical and eight horizontal grey lines across them. It then
 * paints the same picture a second time with half-transparent colours, at an
 * integer offset that the visitor drags with the mouse. The lines in both
 * layers are ordinary straight segments: the bulging is a trick of the eye,
 * not a curve in the picture.
 *
 * Every opinion here is a plain number: no DOM, no storage, no colours beyond
 * the applet's four grayscale values. The file defines one global,
 * BulgingLinesCore, so a page loads it with a plain <script> and
 * porting/check-bulging-lines.mjs evaluates it in Node. The drawing code in
 * BulgingLinesCanvas and the settings in BulgingLinesPanel/VPanel are
 * transcribed literally below and checked against a second reading of the
 * bytecode in porting/check-bulging-lines.mjs.
 */
const BulgingLinesCore = (() => {
  /* The applet's 24 colour orders, in the exact order of its 24 checkboxes. */
  const ORDERS = Object.freeze([
    "GLWB", "GLBW", "GWLB", "GWBL", "GBWL", "GBLW",
    "BLWG", "BLGW", "BWLG", "BWGL", "BGWL", "BGLW",
    "LBWG", "LBGW", "LGBW", "LGWB", "LWBG", "LWGB",
    "WBGL", "WBLG", "WLGB", "WLBG", "WGBL", "WGLB",
  ]);

  /* Colors[] in the constructor: Gray, LightGray, White, Black, each with
     a half-transparent twin (new Color(r, g, b, 128)) for the top layer. */
  const COLOR_NAMES = Object.freeze(["G", "L", "W", "B"]);
  const RGB = Object.freeze([[128, 128, 128], [192, 192, 192], [255, 255, 255], [0, 0, 0]]);
  const COLORS = Object.freeze(RGB.map((rgb) => ({
    rgb, alpha: 255, topAlpha: 128,
  })));

  /* Scrollbar(0, 10, 1, 2, 20): value 10, visible amount 1, range 2..20-1. */
  const RADIUS_MIN = 2;
  const RADIUS_MAX = 19;

  const N = 9;                 // BulgingLinesCanvas.N
  const CLIP_N = 9;            // the "(9 - N) / 2" corner in Draw()

  /* BW[][], copied cell for cell out of the constructor's 8x8 table.
     The two 4x4 quadrants on the diagonal have opposite checkerboard phases. */
  const BW = Object.freeze([
    [0, 1, 0, 1, 1, 0, 1, 0],
    [1, 0, 1, 0, 0, 1, 0, 1],
    [0, 1, 0, 1, 1, 0, 1, 0],
    [1, 0, 1, 0, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 1, 0, 1],
    [0, 1, 0, 1, 1, 0, 1, 0],
    [1, 0, 1, 0, 0, 1, 0, 1],
    [0, 1, 0, 1, 1, 0, 1, 0],
  ]);

  /* init(): SetR(10), SetColors(0, 1, 2, 3) — the GLWB checkbox. Reset()
     puts the dragged top layer back at (0, 0). */
  const DEFAULTS = Object.freeze({ order: "GLWB", radius: 10, offset: { x: 0, y: 0 } });

  const idiv = (a, b) => Math.trunc(a / b); // Java's int division
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.trunc(Number(v) || 0)));

  /** The position a new picture starts from. */
  function start(options) {
    const s = {
      order: DEFAULTS.order,
      radius: DEFAULTS.radius,
      offset: { ...DEFAULTS.offset },
    };
    if (options) {
      if (typeof options.order === "string" && ORDERS.includes(options.order)) s.order = options.order;
      if (options.radius !== undefined) s.radius = clampInt(options.radius, RADIUS_MIN, RADIUS_MAX);
      if (options.offset) {
        s.offset = {
          x: clampInt(options.offset.x, -10000, 10000),
          y: clampInt(options.offset.y, -10000, 10000),
        };
      }
    }
    return s;
  }

  /** A copy with one setting changed; the input position is not modified. */
  function withSetting(state, name, value) {
    const next = { ...state, offset: { ...state.offset } };
    if (name === "order" && ORDERS.includes(value)) next.order = value;
    if (name === "radius") next.radius = clampInt(value, RADIUS_MIN, RADIUS_MAX);
    if (name === "offset" && value) {
      next.offset = { x: clampInt(value.x, -10000, 10000), y: clampInt(value.y, -10000, 10000) };
    }
    return next;
  }

  /** SetColors: map the four letters of an order to indices into COLORS. */
  function palette(state) {
    const s = start(state).order;
    return [...s].map((letter) => COLOR_NAMES.indexOf(letter));
  }

  /** init(): Side, X0, Y0, Radius and TwoR for a canvas of this size. */
  function metrics(state, canvas) {
    const width = Math.max(1, Math.trunc(canvas.width));
    const height = Math.max(1, Math.trunc(canvas.height));
    const side = idiv(Math.min(width, height), N + 1);
    return {
      width, height, n: N, side,
      x0: idiv(width - N * side, 2),
      y0: idiv(height - N * side, 2),
      radius: start(state).radius,
      twoR: 2 * start(state).radius,
      k: idiv(CLIP_N - N, 2),
    };
  }

  /**
   * One call of Draw(g, dx, dy): the checkerboard, the circles and the fine
   * grid lines for a single layer. Colours are indices into COLORS, so the
   * page is free to paint them with its own styles.
   */
  function drawLayer(state, canvas, dx, dy) {
    const m = metrics(state, canvas);
    const p = palette(state);
    const squares = [];
    const dots = [];
    const lines = [];

    /* for i=0..N-1, j=0..N-1: fillRect(X0+dx+i*Side, Y0+dy+j*Side, Side, Side) */
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        squares.push({
          i, j, x: m.x0 + dx + i * m.side, y: m.y0 + dy + j * m.side,
          size: m.side, color: (i + j) % 2 === 0 ? p[0] : p[1],
        });
      }
    }

    /* for i,j=0..N-2: fillOval at the grid intersection, diameter TwoR. */
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const bit = BW[m.k + i][m.k + j];
        dots.push({
          i, j, x: m.x0 + dx + (i + 1) * m.side, y: m.y0 + dy + (j + 1) * m.side,
          r: m.radius, color: bit === 0 ? p[3] : p[2], bit,
        });
      }
    }

    /* Eight vertical and eight horizontal drawLine calls, in Color1. */
    for (let i = 0; i < N - 1; i++) {
      const at = m.x0 + dx + (i + 1) * m.side;
      lines.push({
        i, dir: "v", x1: at, y1: m.y0 + dy + m.side,
        x2: at, y2: m.y0 + dy + (N - 1) * m.side, color: p[1],
      });
    }
    for (let i = 0; i < N - 1; i++) {
      const at = m.y0 + dy + (i + 1) * m.side;
      lines.push({
        i, dir: "h", x1: m.x0 + dx + m.side, y1: at,
        x2: m.x0 + dx + (N - 1) * m.side, y2: at, color: p[1],
      });
    }
    return { dx, dy, squares, dots, lines };
  }

  /**
   * Everything the applet paints: update() draws the base layer at (0,0),
   * then the half-transparent layer at (int Circle.C.x, int Circle.C.y).
   */
  function layout(state, canvas) {
    const s = start(state);
    return {
      ...metrics(s, canvas),
      palette: palette(s),
      colors: COLORS,
      bw: BW,
      layers: [drawLayer(s, canvas, 0, 0), drawLayer(s, canvas, s.offset.x, s.offset.y)],
    };
  }

  /**
   * The page's claim, reduced to facts that can be measured: the lines are
   * straight and equally spaced, and the top layer is the same picture
   * translated by whole canvas units. What people *see* is perception and no
   * program can check that — only the geometry behind it is checked here.
   */
  function claims(state, canvas) {
    const L = layout(state, canvas);
    const [base, top] = L.layers;
    const straight = L.layers.every((layer) => layer.lines.every((ln) =>
      ln.dir === "v"
        ? ln.x1 === ln.x2 && ln.y2 - ln.y1 === (N - 2) * L.side
        : ln.y1 === ln.y2 && ln.x2 - ln.x1 === (N - 2) * L.side));
    const perpendicular = base.lines.filter((ln) => ln.dir === "v").length === N - 1 &&
      base.lines.filter((ln) => ln.dir === "h").length === N - 1;
    const equalSpacing = base.lines.slice(0, N - 1).every((ln, i, all) =>
      i === 0 || ln.x1 - all[i - 1].x1 === L.side) &&
      base.lines.slice(N - 1).every((ln, i, all) =>
        i === 0 || ln.y1 - all[i - 1].y1 === L.side);
    const translation = base.squares.every((sq, i) =>
      top.squares[i].x - sq.x === top.dx && top.squares[i].y - sq.y === top.dy &&
      top.squares[i].color === sq.color) &&
      base.dots.every((dot, i) =>
        top.dots[i].x - dot.x === top.dx && top.dots[i].y - dot.y === top.dy &&
        top.dots[i].color === dot.color) &&
      base.lines.every((ln, i) =>
        top.lines[i].x1 - ln.x1 === top.dx && top.lines[i].y1 - ln.y1 === top.dy &&
        top.lines[i].x2 - ln.x2 === top.dx && top.lines[i].y2 - ln.y2 === top.dy &&
        top.lines[i].color === ln.color);
    const checkerboard = base.squares.every((sq) =>
      sq.color === L.palette[(sq.i + sq.j) % 2]);
    const dotsOnIntersections = base.dots.every((dot) =>
      dot.x === L.x0 + (dot.i + 1) * L.side &&
      dot.y === L.y0 + (dot.j + 1) * L.side &&
      dot.color === L.palette[BW[dot.i][dot.j] === 0 ? 3 : 2]);
    const halfTransparent = COLORS.every((c) => c.alpha === 255 && c.topAlpha === 128);
    return {
      straight, perpendicular, equalSpacing, translation, checkerboard,
      dotsOnIntersections, halfTransparent,
      baseAtOrigin: base.dx === 0 && base.dy === 0,
      topAtOffset: top.dx === start(state).offset.x && top.dy === start(state).offset.y,
      counts: {
        squares: base.squares.length, dots: base.dots.length, lines: base.lines.length,
      },
    };
  }

  /** An illustration has no win and no loss. */
  function result(/* state */) {
    return null;
  }

  return {
    ORDERS, COLOR_NAMES, COLORS, BW, DEFAULTS, N, RADIUS_MIN, RADIUS_MAX,
    start, withSetting, palette, metrics, drawLayer, layout, claims, result,
  };
})();
