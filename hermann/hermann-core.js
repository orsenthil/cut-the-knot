"use strict";

/*
 * Hermann's grid illusion, from Alexander Bogomolny's applet Hermann.
 *
 * The applet draws an N-by-N matrix of equally spaced dark squares or circles.
 * No grey blob is painted anywhere: the blobs people see between the figures
 * are made by the eye, and looking straight at one makes it vanish. The core
 * reproduces HermannCanvas.Draw's arithmetic exactly: the cell step is
 * (min(width, height) - 20) * Part / 100 / N, the figure side is round(step),
 * and the centre spacing is round((extent - step) / (N - 1)).
 *
 * This file is the illustration's logic and nothing else: no document, no
 * window, no storage. It defines one global, HermannCore, so the page loads it
 * with a plain <script> and porting/check-hermann.mjs loads it in Node. The
 * position is plain data, so it can be handed to the player's record and the
 * tutor as it is.
 */
const HermannCore = (() => {
  /* HermannPanel's two scrollbars: Scrollbar(HORIZONTAL, value, visible, min, max). */
  const N_RANGE = Object.freeze({ initial: 4, visible: 2, min: 2, max: 12 });
  const PART_RANGE = Object.freeze({ initial: 50, visible: 5, min: 0, max: 105 });
  const SHAPES = Object.freeze(["rect", "oval"]);

  /** Slider values are integers; a value outside a slider's range is clamped. */
  function clampInt(value, range) {
    const number = Number(value);
    if (!Number.isFinite(number)) return range.initial;
    return Math.min(range.max, Math.max(range.min, Math.round(number)));
  }

  /** The position a new illustration starts from. */
  function start(options = {}) {
    return {
      n: clampInt(options.n === undefined ? N_RANGE.initial : options.n, N_RANGE),
      part: clampInt(options.part === undefined ? PART_RANGE.initial : options.part, PART_RANGE),
      shape: SHAPES.indexOf(options.shape) >= 0 ? options.shape : "rect",
      flipped: Boolean(options.flipped),
      gaze: { x: 180, y: 220 },
    };
  }

  /** A new position with one option changed; the input is never modified. */
  function setOption(state, key, value) {
    const next = Object.assign({}, state);
    if (key === "n") next.n = clampInt(value, N_RANGE);
    else if (key === "part") next.part = clampInt(value, PART_RANGE);
    else if (key === "shape" && SHAPES.indexOf(value) >= 0) next.shape = value;
    else if (key === "flipped") next.flipped = Boolean(value);
    else return state;
    return next;
  }

  /** Move the gaze point in board units; it is used to inspect a gap. */
  function setGaze(state, point) {
    return Object.assign({}, state, {
      gaze: { x: Number(point.x) || 0, y: Number(point.y) || 0 },
    });
  }

  /**
   * A literal transcription of HermannCanvas.Draw's geometry. `width` and
   * `height` are the canvas size in pixels; all other inputs come from state.
   */
  function layout(width, height, state) {
    const canvas = Math.min(width, height) - 20;
    const x0 = (width - canvas) / 2;
    const y0 = (height - canvas) / 2;
    const step = ((canvas * state.part) / 100) / state.n;
    const side = Math.round(step);
    const xEnd = width - 2 * x0 - step;
    const yEnd = height - 2 * y0 - step;
    const gapX = Math.round(xEnd / (state.n - 1));
    const gapY = Math.round(yEnd / (state.n - 1));
    const figures = [];
    for (let row = 0; row < state.n; row++) {
      for (let col = 0; col < state.n; col++) {
        figures.push({ x: x0 + row * gapX, y: y0 + col * gapY, side, row, col });
      }
    }
    return {
      width, height, canvas, x0, y0, step, side, gapX, gapY,
      n: state.n, part: state.part, shape: state.shape, figures,
    };
  }

  /** The (N-1)^2 crossings of the white corridors, where blobs seem to appear. */
  function gapCenters(geometry) {
    const out = [];
    for (let row = 0; row < geometry.n - 1; row++) {
      for (let col = 0; col < geometry.n - 1; col++) {
        out.push({
          x: geometry.x0 + (row + 0.5) * geometry.gapX,
          y: geometry.y0 + (col + 0.5) * geometry.gapY,
          row, col,
        });
      }
    }
    return out;
  }

  /** Is this point covered by one of the drawn figures? */
  function covered(geometry, shape, point) {
    for (const fig of geometry.figures) {
      if (shape === "oval") {
        const cx = fig.x + fig.side / 2;
        const cy = fig.y + fig.side / 2;
        if (Math.hypot(point.x - cx, point.y - cy) <= fig.side / 2) return true;
      } else if (point.x >= fig.x && point.x <= fig.x + fig.side &&
                 point.y >= fig.y && point.y <= fig.y + fig.side) {
        return true;
      }
    }
    return false;
  }

  /** Gap crossings not covered by a figure; these are the possible blobs. */
  function openGaps(geometry, shape) {
    return gapCenters(geometry).filter((p) => !covered(geometry, shape, p));
  }

  /** The open crossing nearest the gaze, if one is within `radius` units. */
  function nearestOpenGap(geometry, state, radius) {
    if (geometry.side <= 0) return null;
    let best = -1;
    let bestDistance = radius;
    const gaps = gapCenters(geometry);
    const open = new Set(openGaps(geometry, state.shape).map((p) => `${p.row},${p.col}`));
    for (let i = 0; i < gaps.length; i++) {
      if (!open.has(`${gaps[i].row},${gaps[i].col}`)) continue;
      const d = Math.hypot(gaps[i].x - state.gaze.x, gaps[i].y - state.gaze.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    return best < 0 ? null : { index: best, distance: bestDistance, point: gaps[best] };
  }

  /** Looking directly at a crossing: close enough that the blob vanishes. */
  function lookedAt(geometry, state) {
    const near = nearestOpenGap(geometry, state, 14);
    return near ? near.index : -1;
  }

  /** Illustration, not a game: there is no win, loss or finished position. */
  function result() {
    return null;
  }

  /** The status line, in plain words. */
  function describe(geometry, state) {
    const word = state.shape === "oval" ? "circles" : "rectangles";
    const open = openGaps(geometry, state.shape).length;
    return `${state.n} × ${state.n} ${word} at ${state.part}% size; ${open} open gaps between them.`;
  }

  return {
    N_RANGE, PART_RANGE, SHAPES, clampInt, start, setOption, setGaze,
    layout, gapCenters, covered, openGaps, nearestOpenGap, lookedAt, result, describe,
  };
})();
