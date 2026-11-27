"use strict";

/*
 * Contrast, from Alexander Bogomolny's applet Contrast (page: Simultaneous
 * Contrast Illusion). The applet paints a background of 256 grays as one
 * vertical line per canvas column, then lays one or two bars of a *single*
 * gray on top. The trick is that the eye reads the bars differently according
 * to the gray surrounding them.
 *
 * The numbers here follow ContrastCanvas.Draw in the bytecode: W = 80,
 * H = 20, MinColor = 20, MaxColor = 235, Gap = 0; the five scrollbars run
 * 0..110 (W, H), 0..255 (the two grays) and 0..80 (Gap). Grays[i] is the
 * colour (i/255, i/255, i/255). The background column x has index
 * round(low + (x-1) * (high-low) / (width-4)), for x = 1 .. width-3, where
 * low and high are the two colour limits in increasing order. Both bars use
 * round((low+high)/2). Integer sizes use Java's truncating division.
 *
 * This file is the applet's logic and nothing else: no document, no window,
 * no storage. It defines one global, ContrastCore, so the page loads it with
 * a plain <script> and porting/check-contrast.mjs loads it in Node. The
 * position is plain data (five integers and a probe point), so it can be
 * saved and handed to the tutor as it is; no function changes its argument.
 */
const ContrastCore = (() => {
  // The cut-the-knot page embeds the applet at 500 x 300. The SVG board uses
  // the same user units, so every drawing number from the applet carries over.
  const BOARD = Object.freeze({ width: 500, height: 300 });
  const NGRAYS = 256;

  const DEFAULTS = Object.freeze({
    width: 80,
    height: 20,
    minColor: 20,
    maxColor: 235,
    gap: 0,
  });

  // ContrastPanel's five java.awt.Scrollbars, in the order they are added.
  const LIMITS = Object.freeze({
    width: [0, 110],
    height: [0, 110],
    minColor: [0, 255],
    maxColor: [0, 255],
    gap: [0, 80],
  });
  const OPTIONS = Object.freeze(["width", "height", "minColor", "maxColor", "gap"]);

  /** A scrollbar value: an integer inside that scrollbar's own range. */
  function clampOption(key, value) {
    const range = LIMITS[key];
    if (!range) return value;
    const n = Number(value);
    const v = Number.isFinite(n) ? Math.round(n) : DEFAULTS[key];
    return Math.min(range[1], Math.max(range[0], v));
  }

  /** The five scrollbar values the applet starts with. */
  function start() {
    return { ...DEFAULTS };
  }

  /** A new position with one scrollbar changed, as the listener copies them. */
  function option(state, key, value) {
    if (!(key in LIMITS)) return state;
    return { ...state, [key]: clampOption(key, value) };
  }

  /** Grays[i] = new Color(i/255, i/255, i/255) in the applet. */
  function gray(index) {
    const i = Math.max(0, Math.min(NGRAYS - 1, index));
    return { index: i, level: i / (NGRAYS - 1), css: `rgb(${i}, ${i}, ${i})` };
  }

  /** Draw() picks the smaller gray first, whichever scrollbar it came from. */
  function sorted(state) {
    return {
      lo: Math.min(state.minColor, state.maxColor),
      hi: Math.max(state.minColor, state.maxColor),
    };
  }

  /** The two bar rectangles, in board units, with their common gray index. */
  function geometry(state, canvasW = BOARD.width, canvasH = BOARD.height) {
    const { lo, hi } = sorted(state);
    const barW = Math.trunc(canvasW * state.width / 100);
    const barH = Math.trunc(canvasH * state.height / 100);
    const gap = Math.trunc(barW * state.gap / 100);
    const x = Math.trunc((canvasW - barW) / 2);
    const y = Math.trunc((canvasH - barH) / 2);
    const leftW = Math.trunc((barW - gap) / 2);
    const rightW = barW - gap - leftW;
    // Java: Grays[Math.round((float)((lo+hi)/2))]. The /2 is an int division
    // first, so for these non-negative values the extra round changes nothing.
    const barIndex = Math.trunc((lo + hi) / 2);
    return {
      lo, hi, barW, barH, gap, x, y, barIndex,
      pieces: [
        { x, y, w: leftW, h: barH, index: barIndex },
        { x: x + leftW + gap, y, w: rightW, h: barH, index: barIndex },
      ],
    };
  }

  /** One painted background column per Java drawLine(x, 1, x, height-1). */
  function columns(state, canvasW = BOARD.width) {
    const { lo, hi } = sorted(state);
    if (canvasW < 5) return []; // width-4 would be zero or negative
    const step = (hi - lo) / (canvasW - 4);
    const out = [];
    for (let x = 1; x < canvasW - 2; x++) {
      // Java Math.round(double) is floor(v + 0.5) for these non-negative v.
      const index = Math.round((x - 1) * step + lo);
      out.push({ x, index: Math.max(0, Math.min(NGRAYS - 1, index)) });
    }
    return out;
  }

  /** Everything needed to draw one frame, from a position. */
  function compute(state, canvasW = BOARD.width, canvasH = BOARD.height) {
    const f = geometry(state, canvasW, canvasH);
    const { lo, hi } = f;
    const step = canvasW >= 5 ? (hi - lo) / (canvasW - 4) : 0;
    return { ...f, step, columns: columns(state, canvasW) };
  }

  /** The gray of the nearest painted column under a probe at board x. */
  function grayAt(state, x, canvasW = BOARD.width) {
    const painted = columns(state, canvasW);
    if (!painted.length) return gray(0);
    const target = Math.max(1, Math.min(canvasW - 3, Math.round(x)));
    let best = painted[0];
    for (const c of painted) {
      if (Math.abs(c.x - target) < Math.abs(best.x - target)) best = c;
    }
    return gray(best.index);
  }

  /** The status line: the bar's one gray, the range and the probe reading. */
  function describe(state, frame, probe) {
    const bar = gray(frame.barIndex);
    const under = grayAt(state, probe.x);
    return `Both bars are gray ${bar.index} all over. Background gray runs ${frame.lo} to ${frame.hi}. ` +
      `Probe at ${Math.round(probe.x)}: background gray ${under.index}.`;
  }

  return {
    BOARD, NGRAYS, DEFAULTS, LIMITS, OPTIONS,
    start, option, clampOption, gray, sorted,
    geometry, columns, compute, grayAt, describe,
  };
})();
