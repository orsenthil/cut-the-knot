"use strict";

/*
 * Contrast II, from Alexander Bogomolny's applet ContrastII.
 *
 * The applet paints one flat background and then two interleaved square
 * grids, all in the same foreground colour: an N by N grid of small squares
 * and an (N-1) by (N-1) grid of larger squares sitting between them. The page
 * calls this "Simultaneous Contrast Illusion II" and says that the small
 * squares look whiter (or blacker) even though there is no difference in the
 * colours; when the two sizes are nearly equal the edges seem to wave.
 *
 * The one idea the code relies on: the picture's geometry is taken verbatim
 * from ContrastIICanvas.Draw(), including Java's integer division and
 * Math.round, so the test can compare it with a second transcription of the
 * bytecode. Every square has the same colour; only the side lengths differ.
 *
 * This is the logic and nothing else: no document, no window, no storage. It
 * defines one global, ContrastIiCore, so the page loads it with a plain
 * <script> and porting/check-contrast-ii.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const ContrastIiCore = (() => {
  // ContrastIIPanel: Scrollbar(0, 8, 2, 2, 12) and Scrollbar(0, 75, 5, 0, 105).
  // An AWT scrollbar's usable values stop at maximum - visibleAmount.
  const MIN_N = 2, MAX_N = 10, START_N = 8;
  const MIN_PART = 0, MAX_PART = 100, START_PART = 75;
  // ContrastIICanvas.Draw: inset = min(width, height) - 20.
  const INSET = 20;
  // The page embeds the applet at WIDTH=360; the modern board is square and
  // its ruler sits below it, outside the drawn field.
  const WIDTH = 360, HEIGHT = 360;
  // <param name="fcolor" value="000000"> and <param name="bcolor"
  // value="ffffff"> on the cut-the-knot page. The UI maps them to site tokens.
  const INK = "square", PAPER = "background";

  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.trunc(Number(v) || 0)));
  const clampPart = (v) => clampInt(v, MIN_PART, MAX_PART);
  /** Java Math.round(double): floor(x + 0.5), returned here as a number. */
  const jround = (x) => Math.floor(x + 0.5);
  /** Java Math.round(float): the same, on the float-rounded operand. */
  const jroundFloat = (x) => Math.floor(Math.fround(x) + 0.5);

  /** The position a new illustration starts from, matching the applet. */
  function start(options) {
    const o = options || {};
    return {
      n: o.n === undefined ? START_N : clampInt(o.n, MIN_N, MAX_N),
      part: o.part === undefined ? START_PART : clampInt(o.part, MIN_PART, MAX_PART),
      swapped: !!(o.swapped === undefined ? false : o.swapped),
      width: o.width === undefined ? WIDTH : Math.max(30, Math.trunc(Number(o.width) || WIDTH)),
      height: o.height === undefined ? HEIGHT : Math.max(30, Math.trunc(Number(o.height) || HEIGHT)),
    };
  }

  /** A new position with one option changed; scrollbar values clamp as AWT does. */
  function withOption(state, key, value) {
    const next = { ...state };
    if (key === "n") next.n = clampInt(value, MIN_N, MAX_N);
    else if (key === "part") next.part = clampInt(value, MIN_PART, MAX_PART);
    else if (key === "swapped") next.swapped = !!value;
    else if (key === "width" || key === "height") next[key] = Math.max(30, Math.trunc(Number(value) || 30));
    else return { ...state };
    return next;
  }

  /** The checkbox the applet calls "Switch colors": background and ink trade places. */
  function switchColors(state) {
    return { ...state, swapped: !state.swapped };
  }

  /**
   * ContrastIICanvas.Draw, literally. Java's `side`, x0 and y0 are ints, so
   * (width - side) / 2 and gap / 2 truncate toward zero; `step` and the two
   * spans are doubles; Math.round uses floor(x + 0.5) for positive values.
   */
  function layout(state) {
    const width = state.width === undefined ? WIDTH : state.width;
    const height = state.height === undefined ? HEIGHT : state.height;
    const n = state.n === undefined ? START_N : state.n;
    const part = state.part === undefined ? START_PART : state.part;
    const side = Math.min(width, height) - INSET;
    const x0 = Math.trunc((width - side) / 2);
    const y0 = Math.trunc((height - side) / 2);
    const step = (side * part) / 100 / n;
    const small = jround(step);
    const spanX = width - 2 * x0 - step;
    const spanY = height - 2 * y0 - step;
    const gapX = jround(spanX / (n - 1) - small) + 1;
    const gapY = jround(spanY / (n - 1) - small) + 1;
    const big = jroundFloat(gapX / 2); // Math.round(float) of gapX/2
    const bigSide = 2 * big - 1;
    return {
      width: width, height: height, n: n, part: part,
      side: side, x0: x0, y0: y0, step: step,
      small: small, spanX: spanX, spanY: spanY,
      gapX: gapX, gapY: gapY, big: big, bigSide: bigSide,
    };
  }

  /** All foreground squares as plain rectangles, in the applet's two loops. */
  function squares(state) {
    const g = layout(state);
    const smallSquares = [];
    for (let i = 0; i < g.n; i++) {
      for (let j = 0; j < g.n; j++) {
        smallSquares.push({
          x: jround(g.x0 + (g.spanX * i) / (g.n - 1)),
          y: jround(g.y0 + (g.spanY * j) / (g.n - 1)),
          size: g.small,
          colour: INK,
          kind: "small",
        });
      }
    }
    const bigSquares = [];
    for (let i = 0; i < g.n - 1; i++) {
      for (let j = 0; j < g.n - 1; j++) {
        const gx = jround(g.x0 + (g.spanX * i) / (g.n - 1));
        const gy = jround(g.y0 + (g.spanY * j) / (g.n - 1));
        bigSquares.push({
          x: gx + g.small + Math.trunc(g.gapX / 2) - g.big,
          y: gy + g.small + Math.trunc(g.gapY / 2) - g.big,
          size: g.bigSide,
          colour: INK,
          kind: "big",
        });
      }
    }
    return { small: smallSquares, big: bigSquares, layout: g, ink: INK, paper: PAPER };
  }

  /**
   * How much of the drawn square is covered by foreground squares. Neighbours
   * touch or overlap by a pixel after Java's rounding, so this is the summed
   * area, not a pixel count; it is enough to locate the nearly equal case.
   */
  function coverage(state) {
    const g = layout(state);
    const area = g.n * g.n * g.small * g.small + (g.n - 1) * (g.n - 1) * g.bigSide * g.bigSide;
    return area / (g.side * g.side);
  }

  /** The page's two claims, reduced to things the drawing actually determines. */
  function claims(state) {
    const g = layout(state);
    return {
      oneColour: true, // every square in squares() carries the same ink token
      smallBiggerAtStart: g.small > g.bigSide,
      nearlyEqualSize: Math.abs(g.small - g.bigSide) <= 1,
      coverage: coverage(state),
    };
  }

  return {
    MIN_N, MAX_N, START_N, MIN_PART, MAX_PART, START_PART, INSET, WIDTH, HEIGHT, INK, PAPER,
    start, withOption, switchColors, clampPart, layout, squares, coverage, claims,
  };
})();
