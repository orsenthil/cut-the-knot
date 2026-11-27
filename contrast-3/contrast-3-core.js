"use strict";

/*
 * Contrast 3, from Alexander Bogomolny's applet Contrast3.
 *
 * A single gray ring straddles two different shades. The right square (and
 * the right half of the ring) is copied vertically by
 * dy = round(side * H / 100) pixels, leaving the left half in place, so the
 * same gray sits against two different surroundings. There is no move and no
 * win: every number in this file is geometry or a shade of gray.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, Contrast3Core, so the page loads it with
 * a plain <script> and porting/check-contrast-3.mjs loads it in Node. The
 * position is plain data and can be handed to the tutor as it is.
 */
const Contrast3Core = (() => {
  // Contrast3Canvas.Draw(): a margin of 20 and a 7/8, 9/10 pair of radii.
  const PAD = 20;
  const OUTER = 7 / 8;
  const INNER = 9 / 10;

  // The page embeds the applet at 500x300; getParameterInfo suggests 400x300.
  const WIDTH = 500;
  const HEIGHT = 300;

  /*
   * Contrast3Panel.init() creates six java.awt.Scrollbars:
   *   new Scrollbar(0, value, visibleAmount, minimum, maximum)
   * A visibleAmount of 5 means the largest reachable value is maximum - 5,
   * which is why the effective ranges below end at 100 and the H range ends
   * at 50. The constructor values are the applet's defaults: MaxColor starts
   * at 100 (white) and everything else at 50 or 0.
   */
  const RANGES = {
    max: { args: [0, 50, 5, 40, 105], min: 40, max: 100, initial: 50 },
    min: { args: [0, 50, 5, 0, 105], min: 0, max: 100, initial: 50 },
    h: { args: [0, 0, 5, -50, 55], min: -50, max: 50, initial: 0 },
    gray: { args: [0, 50, 5, 0, 105], min: 0, max: 100, initial: 50 },
    minColor: { args: [0, 50, 5, 0, 105], min: 0, max: 100, initial: 50 },
    maxColor: { args: [0, 100, 5, 0, 105], min: 0, max: 100, initial: 100 },
  };
  const KEYS = Object.keys(RANGES);

  const DEFAULTS = Object.freeze(Object.fromEntries(KEYS.map((k) => [k, RANGES[k].initial])));

  // Java Math.round(double) and the two integer divisions in Draw().
  const round = (v) => Math.round(v);
  const idiv = (a, b) => Math.trunc(a / b);

  /** A scrollbar cannot leave its range. */
  function clampOption(key, value) {
    const r = RANGES[key];
    if (!r) return 0;
    const n = Number(value);
    if (!Number.isFinite(n)) return r.initial;
    return Math.min(r.max, Math.max(r.min, Math.round(n)));
  }

  /** The position a new illustration starts from. */
  function start(options) {
    const s = Object.assign({}, DEFAULTS);
    if (options) for (const k of KEYS) if (k in options) s[k] = clampOption(k, options[k]);
    return s;
  }

  /** The position after moving one scrollbar. Does not change `state`. */
  function withOption(state, key, value) {
    const s = Object.assign({}, state);
    s[key] = clampOption(key, value);
    return s;
  }

  /*
   * java.awt.Color(float, float, float) converts each component with
   * (int)(component * 255f + 0.5f), where component = scrollbarValue / 100f.
   * Math.fround keeps the Java float rounding at each step.
   */
  function tone(value) {
    const f = Math.fround(Number(value) / 100);
    const scaled = Math.fround(Math.fround(f * 255) + 0.5);
    return Math.min(255, Math.max(0, Math.floor(scaled)));
  }

  /*
   * The geometry of Contrast3Canvas.Draw() in canvas pixels. The two squares
   * are `side` across; the ring is one circle centred on their common edge.
   * Only the right square (with its half of the ring) is copied by dy.
   */
  function geometry(state, width = WIDTH, height = HEIGHT) {
    const side = round(Math.min(width / 2, height)) - 2 * PAD;
    const x = idiv(width - 2 * side, 2);
    const y = idiv(height - side, 2);
    const cx = x + side;
    const cy = y + idiv(side, 2);
    // Keep Java's order of the double operations: rounding at 31.5 must go up.
    const rOuter = round((side / 2) * state.max / 100 * 7 / 8);
    const rInner = round(rOuter * 9 / 10 * state.min / 100);
    const dy = round(side * (state.h / 100));

    // The strips that copyArea() leaves behind, repainted by Draw().
    let patches = [];
    if (dy > 0) {
      patches = [
        { color: "background", x: cx, y: y + side, w: side, h: dy },
        { color: "max", x: cx, y, w: side, h: idiv(side, 2) - rOuter + dy },
      ];
    } else if (dy < 0) {
      patches = [
        { color: "background", x: cx, y: 0, w: side, h: idiv(height - side, 2) },
        { color: "max", x: cx, y: cy + rOuter + dy, w: side, h: -dy },
      ];
    }
    return { width, height, side, x, y, cx, cy, rOuter, rInner, dy, patches };
  }

  /** Geometry plus the three shades the applet builds in SetGrayColor(). */
  function analyse(state, width = WIDTH, height = HEIGHT) {
    const g = geometry(state, width, height);
    return Object.assign({}, g, {
      tones: {
        left: tone(state.minColor),
        right: tone(state.maxColor),
        ring: tone(state.gray),
      },
      // Where the visible slide marker sits: inside the right square.
      handle: { x: g.cx + Math.trunc(g.side * 0.82), y: g.cy + g.dy },
    });
  }

  /** Convert a marker's board y back into the applet's H scrollbar value. */
  function slideFromPoint(state, point, width = WIDTH, height = HEIGHT) {
    const g = geometry(state, width, height);
    return clampOption("h", Math.round(((point.y - g.cy) * 100) / g.side));
  }

  return {
    PAD, OUTER, INNER, WIDTH, HEIGHT, RANGES, DEFAULTS, KEYS,
    start, withOption, clampOption, tone, geometry, analyse, slideFromPoint,
  };
})();
