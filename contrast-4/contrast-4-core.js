"use strict";

/*
 * Contrast 4: the V variant of White's simultaneous-contrast illusion.
 *
 * The Java applet (Contrast4Canvas.Draw) paints six full-height vertical
 * bands, alternating the two band shades, then paints six patches of ONE
 * shade: three high on the dark bands and three low on the light bands.
 * Every patch gets the very same GrayColor, so the apparent lightness
 * difference is made by the eye, not by the pixels. This file holds only
 * that geometry and the applet's five scrollbar ranges; the page draws it.
 *
 * DOM-free: one global, Contrast4Core. Positions are plain data, so they can
 * be saved for the player's record and handed to the tutor.
 */
const Contrast4Core = (() => {
  const BANDS = 6;
  const CANVAS = { width: 400, height: 400 }; // the applet's <APPLET WIDTH=400 HEIGHT=400>
  const MARGIN = 20;                          // Contrast4Canvas.Draw: S7, S8
  const LIMITS = {
    w: [40, 105],       // Java Scrollbar(0, 50, 5, 40, 105)
    h: [0, 105],        // Java Scrollbar(0, 50, 5, 0, 105)
    gray: [0, 105],
    min: [0, 105],
    max: [0, 105],
  };
  const DEFAULTS = { w: 50, h: 50, gray: 50, min: 0, max: 100 };

  /** Math.round, as used by the applet's private a(double) method. */
  const round = Math.round;

  function clampInt(value, lo, hi) {
    const n = Number(value);
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, Math.round(n)));
  }

  /** The applet's opening picture. Options are the five scrollbar values. */
  function start(options) {
    const s = { ...DEFAULTS, width: CANVAS.width, height: CANVAS.height, selected: 0 };
    for (const key of Object.keys(DEFAULTS)) {
      if (options && options[key] !== undefined) {
        s[key] = clampInt(options[key], LIMITS[key][0], LIMITS[key][1]);
      }
    }
    return s;
  }

  /** A scrollbar moved to a new whole-number value. */
  function setOption(state, key, value) {
    if (!Object.prototype.hasOwnProperty.call(LIMITS, key)) return state;
    const v = clampInt(value, LIMITS[key][0], LIMITS[key][1]);
    return v === state[key] ? state : { ...state, [key]: v };
  }

  /*
   * new Color(v / 100.0f, ...) takes (int)(component * 255f + 0.5f).
   * Math.fround keeps Java's single-precision steps. The old applet throws
   * above 100; here the channel saturates at 255 so the 0-105 slider still
   * paints something (noted on the page).
   */
  function channel(value) {
    const part = Math.fround(value / 100);
    const scaled = Math.fround(Math.fround(part * Math.fround(255)) + Math.fround(0.5));
    return Math.max(0, Math.min(255, Math.trunc(scaled)));
  }

  function grey(value) {
    const byte = channel(value).toString(16).padStart(2, "0");
    return `#${byte}${byte}${byte}`;
  }

  /** The three greys Contrast4Canvas.SetGrayColor builds. */
  function colors(state) {
    return { dark: grey(state.min), light: grey(state.max), patch: grey(state.gray) };
  }

  /*
   * A literal transcription of Draw's two fillRect loops. The names S4, S5,
   * ... follow the local slots of the bytecode so the arithmetic order is
   * the same, including rounding only the two sizes and not the offsets.
   */
  function geometry(state) {
    const S3 = BANDS;
    const height = state.height;
    const width = state.width;
    const S4 = round(((height * 2) / 3) * (state.w / 100) / S3);
    const S5 = S4 * S3;
    const S6 = (width - S5) / 2;
    const S7 = MARGIN;
    const S8 = height - 2 * S7;
    const S9 = S7;
    const S10 = S9 + S8 / 3;
    const S11 = S9 + S8 - S8 / 3;
    const S12 = round((S8 / 2.5) * (state.h / 100) / 2);

    const bands = [];
    for (let j = 0; j < S3; j++) {
      bands.push({ x: S6 + j * S4, y: S9, w: S4, h: S8, dark: j % 2 === 0 });
    }

    const patches = [];
    for (let j = 0; j < S3; j += 2) {
      patches.push({ band: j, x: S6 + j * S4, y: S10 - S12, w: S4, h: 2 * S12, row: "upper" });
      patches.push({ band: j + 1, x: S6 + (j + 1) * S4, y: S11 - S12, w: S4, h: 2 * S12, row: "lower" });
    }
    return {
      bands, patches, bandWidth: S4, left: S6, top: S9, bandHeight: S8,
      upperY: S10, lowerY: S11, patchHeight: 2 * S12, count: S3,
    };
  }

  /** The centre of a patch, used by the board's keyboard handle. */
  function patchCenter(state, index) {
    const patches = geometry(state).patches;
    const p = patches[Math.max(0, Math.min(patches.length - 1, Math.round(index)))];
    return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  }

  /** Which patch a dragged point is nearest; the handle snaps to its centre. */
  function select(state, point) {
    let best = 0;
    let bestDist = Infinity;
    geometry(state).patches.forEach((p, i) => {
      const c = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
      const d = (point.x - c.x) ** 2 + (point.y - c.y) ** 2;
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return { ...state, selected: best };
  }

  /*
   * The page's perceptual explanation: the eye joins the six visible pieces
   * into one bar and reads its lightness as an average of dark and light
   * surroundings. This is the arithmetic behind that claim, not a step in
   * drawing the picture - the six patches are always painted one shade.
   */
  function averageShade(state) {
    return (state.min + state.max) / 2;
  }

  /** The status line: the visible facts, never a win or a loss. */
  function describe(state) {
    const g = geometry(state);
    const shade = colors(state).patch;
    return `${g.count} bands, ${g.patches.length} patches, all the same grey ${shade}: ` +
      `3 high on the dark bands and 3 low on the light bands.`;
  }

  return {
    BANDS, CANVAS, MARGIN, LIMITS, DEFAULTS,
    start, setOption, channel, colors, geometry, patchCenter, select,
    averageShade, describe,
  };
})();
