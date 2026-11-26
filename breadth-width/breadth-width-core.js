"use strict";

/*
 * BreadthWidth — Bogomolny's "Height/Width Interplay Illusion".
 *
 * The applet draws three barrels side by side. The left one is cut by N
 * upright lines, the middle one has a single layer, and the right one is cut
 * by N curved lines. Yet all three are drawn inside the very same square: the
 * page's exact claim is "Both stacks are as tall as they are wide. However
 * our perception is affected by the apparent number of layers in the stack."
 *
 * The one idea the code relies on: the outer square is S by S whatever N is.
 * The layer marks are only decorations inside it. Their positions come from
 * the applet's own arithmetic — an ellipse's half-width at the left-hand
 * stack, and equal vertical steps at the right-hand stack — ported literally
 * (int casts and Math.round included), so the check can compare them with a
 * second transcription of the bytecode.
 *
 * This is the logic and nothing else: no document, no window, no storage. It
 * defines one global, BreadthWidthCore, so the page loads it with a plain
 * <script> and porting/check-breadth-width.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const BreadthWidthCore = (() => {
  const MIN_LAYERS = 1;
  const MAX_LAYERS = 20;
  const START_LAYERS = 5; // the applet's Scrollbar(0, 5, 1, 1, 20)
  const DEFAULT_WIDTH = 400; // the applet's WIDTH parameter "(400 will do)"
  const DEFAULT_HEIGHT = 300; // the applet's HEIGHT parameter "(300 will do)"
  const MARGIN = 40; // BreadthWidthCanvas.init: Margin = 40
  const CAP = 30; // DrawBarrelV/H: the oval caps are 30 high on each side
  const SCALE = 1.2000000476837158; // init: H / 1.2 - 2 * Margin

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampLayers = (n) => clamp(Math.trunc(Number(n) || MIN_LAYERS), MIN_LAYERS, MAX_LAYERS);
  /** Java's Math.round(double): floor(x + 0.5), returned as an int here. */
  const round = (x) => Math.floor(x + 0.5);

  /** BreadthWidthCanvas.init: Margin, S, X0, Y0 and the three barrel x positions. */
  function layout(state) {
    const width = state.width === undefined ? DEFAULT_WIDTH : state.width;
    const height = state.height === undefined ? DEFAULT_HEIGHT : state.height;
    const S = Math.trunc(Math.min((width - 4 * MARGIN) / 3, height / SCALE - 2 * MARGIN));
    const X0 = Math.trunc((width - 3 * S - 2 * MARGIN) / 2);
    const Y0 = Math.trunc((height - S) / 2);
    return {
      margin: MARGIN, cap: CAP,
      S: S, X0: X0, Y0: Y0,
      xs: [X0, X0 + MARGIN + S, X0 + 2 * MARGIN + 2 * S],
    };
  }

  /** The position a new illustration starts from; N = 5 as in the applet. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? DEFAULT_WIDTH : o.width;
    const height = o.height === undefined ? DEFAULT_HEIGHT : o.height;
    const layers = clampLayers(o.layers === undefined ? START_LAYERS : o.layers);
    const geo = layout({ width: width, height: height, layers: layers });
    return {
      layers: layers,
      width: width,
      height: height,
      probe: o.probe
        ? { x: o.probe.x, y: o.probe.y }
        : { x: geo.X0 + geo.S / 2, y: geo.Y0 + geo.S / 2 },
    };
  }

  /** The scrollbar's value, 1 to 20, clamped just as AWT clamps it. */
  function setLayers(state, n) {
    return { ...state, layers: clampLayers(n) };
  }

  /** The dragging point for the layer count: a ruler under the three barrels. */
  function ruler(state) {
    const geo = layout(state);
    const x0 = geo.X0, x1 = state.width - geo.X0;
    return { x0: x0, x1: x1, y: state.height - 42, step: (x1 - x0) / (MAX_LAYERS - 1) };
  }

  function layerPoint(state) {
    const r = ruler(state);
    return { x: r.x0 + (state.layers - MIN_LAYERS) * r.step, y: r.y };
  }

  function layerFromX(state, x) {
    const r = ruler(state);
    return clampLayers(MIN_LAYERS + Math.round((x - r.x0) / r.step));
  }

  /** DrawBarrelV: N + 1 upright lines across the top oval of the left barrel. */
  function verticalLines(state) {
    const geo = layout(state);
    const N = state.layers, S = geo.S, cap = geo.cap, X0 = geo.X0, Y0 = geo.Y0;
    const q = (2 * cap / S) * (2 * cap / S);
    const lines = [];
    for (let i = 0; i <= N; i++) {
      // the applet: -PI + PI / N * i, then S * cos(...) / 2
      const off = (S * Math.cos(-Math.PI + (Math.PI / N) * i)) / 2;
      const under = Math.max(0, cap * cap - off * off * q);
      const y = Y0 + round(Math.sqrt(under));
      const x = round(off) + X0 + Math.trunc(S / 2);
      lines.push({ i: i, x: x, y1: y, y2: y + S - 2 });
    }
    return lines;
  }

  /** DrawBarrelH: N lower-half oval arcs, one per apparent layer. */
  function horizontalArcs(state, barrel) {
    const geo = layout(state);
    const N = barrel === 1 ? 1 : state.layers; // Draw() passes 1 for the middle barrel
    const S = geo.S, cap = geo.cap, Y0 = geo.Y0;
    const x = geo.xs[barrel === 0 ? 0 : barrel === 1 ? 1 : 2];
    const arcs = [];
    for (let i = 1; i <= N; i++) {
      // the applet's integer division: S * i / N, then - cap
      arcs.push({
        i: i, x: x, y: Y0 + Math.trunc((S * i) / N) - cap,
        width: S, height: 2 * cap, start: 180, extent: 175,
      });
    }
    return arcs;
  }

  /** Which barrel is under the probe point, using the full drawn outline. */
  function stackAt(state, p) {
    const geo = layout(state);
    if (!p || geo.S <= 0) return null;
    if (p.x < geo.X0 - geo.margin || p.x > geo.X0 + 2 * geo.margin + 3 * geo.S) return null;
    if (p.y < geo.Y0 - geo.cap || p.y > geo.Y0 + geo.S + geo.cap) return null;
    for (let k = 0; k < 3; k++) {
      if (p.x >= geo.xs[k] && p.x <= geo.xs[k] + geo.S) return ["left", "middle", "right"][k];
    }
    return null; // in the gap between two barrels
  }

  /** The true size of a barrel's square body; the oval caps overhang by CAP. */
  function measure(state, which) {
    const geo = layout(state);
    const k = { left: 0, middle: 1, right: 2 }[which];
    if (k === undefined) return null;
    return {
      which: which, x: geo.xs[k], y: geo.Y0,
      width: geo.S, height: geo.S,
      overhang: geo.cap, layers: k === 1 ? 1 : state.layers,
    };
  }

  /** Every claim the cut-the-knot page makes, at this configuration. */
  function claims(state) {
    const L = measure(state, "left"), M = measure(state, "middle"), R = measure(state, "right");
    const leftLines = verticalLines(state), rightArcs = horizontalArcs(state, 2);
    return {
      // "Both stacks are as tall as they are wide" — the page's exact words.
      leftSquare: L.width === L.height,
      middleSquare: M.width === M.height,
      rightSquare: R.width === R.height,
      sameSize: L.width === M.width && M.width === R.width && L.height === R.height,
      layersInRange: state.layers >= MIN_LAYERS && state.layers <= MAX_LAYERS &&
        Number.isInteger(state.layers),
      layerCounts: leftLines.length === state.layers + 1 && rightArcs.length === state.layers,
    };
  }

  /** Everything the page needs to draw and describe the current picture. */
  function picture(state) {
    return {
      geo: layout(state),
      ruler: ruler(state),
      handle: layerPoint(state),
      leftLines: verticalLines(state),
      middleArcs: horizontalArcs(state, 1),
      rightArcs: horizontalArcs(state, 2),
      stack: stackAt(state, state.probe),
      claims: claims(state),
    };
  }

  function moveProbe(state, p) {
    return {
      ...state,
      probe: {
        x: clamp(p.x, 0, state.width),
        y: clamp(p.y, 0, state.height),
      },
    };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    MIN_LAYERS, MAX_LAYERS, START_LAYERS, DEFAULT_WIDTH, DEFAULT_HEIGHT, MARGIN, CAP,
    clampLayers, layout, start, setLayers, ruler, layerPoint, layerFromX,
    verticalLines, horizontalArcs, stackAt, measure, claims, picture, moveProbe, result,
  };
})();
