"use strict";

/*
 * Cube7Cube8, from Alexander Bogomolny's applet Cube7Cube8.
 *
 * A fixed pile of little cubes is drawn in an oblique (isometric-style)
 * projection. Three sliders change only the view: the slant angle, how many
 * cube widths fit across the picture, and how much of one family of faces is
 * transparent. No face is added or removed by a slider, so the same line
 * drawing can be read as seven cubes or as eight: the transparent faces let
 * you see the corner that the solid view hides.
 *
 * This is the game's logic and nothing else: no document, no window and no
 * storage. It defines one global, Cube7Cube8Core. The position is plain data,
 * which the page hands to Track.state() for the tutor.
 */

const Cube7Cube8Core = (() => {
  // Cube7Cube8Panel's three AWT scrollbars: (orientation, initial, page, min, max).
  const RANGES = Object.freeze({
    angle: Object.freeze({ min: 15, max: 60, initial: 45 }), // Scrollbar(0, 45, 5, 15, 60)
    n: Object.freeze({ min: 2, max: 10, initial: 2 }),       // Scrollbar(0, 2, 1, 2, 10)
    trans: Object.freeze({ min: -127, max: 127, initial: 0 }), // Scrollbar(0, 0, 1, -127, 127)
  });

  /** The view the applet opens with. An optional object overrides one or more sliders. */
  function start(options) {
    const o = options || {};
    return {
      angle: clamp("angle", o.angle, RANGES.angle.initial),
      n: clamp("n", o.n, RANGES.n.initial),
      trans: clamp("trans", o.trans, RANGES.trans.initial),
    };
  }

  /** The applet's scrollbars only deliver values inside their range. */
  function clamp(key, value, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    const r = RANGES[key];
    return Math.max(r.min, Math.min(r.max, Math.round(value)));
  }

  function withOption(state, key, value) {
    const next = Object.assign({}, state);
    next[key] = clamp(key, value, state[key]);
    return next;
  }

  /*
   * The four greys of Draw(), each in three versions: solid, faded by a
   * negative Trans (alphaMinus) and faded by a positive Trans (alphaPlus).
   * The AWT Color constructor keeps only the low 8 bits of alpha, but both
   * expressions stay between 1 and 255 for Trans in [-127, 127].
   */
  function palette(trans) {
    const minus = Math.min(255, 255 - 2 * trans);
    const plus = Math.min(255, 255 + 2 * trans);
    const grey = (v, a) => ({ grey: v, alpha: a });
    return {
      dark: grey(32, 255),
      darkMinus: grey(32, minus),
      darkPlus: grey(32, plus),
      midDark: grey(91, 255),
      midDarkMinus: grey(91, minus),
      midDarkPlus: grey(91, plus),
      midLight: grey(160, 255),
      midLightMinus: grey(160, minus),
      midLightPlus: grey(160, plus),
      light: grey(191, 255),
      lightMinus: grey(191, minus),
      lightPlus: grey(191, plus),
    };
  }

  /** The two distances SlantedW and SlantedH, and the drawing's anchor point. */
  function metrics(state, width, height) {
    const w0 = Math.trunc(width / 10); // Java's integer division, then i2d
    const theta = (state.angle * Math.PI) / 180;
    const pixel = Math.round(height / 1.4 / (state.n + 5));
    return {
      cx: Math.trunc(width / 2), // width / 2 as Java integer division
      cy: w0,
      w: pixel * 1.6 * Math.cos(theta),
      h: pixel * Math.sin(theta),
      pixel,
      theta,
    };
  }

  /*
   * One rhombus is described by three corners a, b, c. DrawRombus fills
   * [a, b, c + b - a, c]; the two edges out of a take the third colour and
   * the two out of c + b - a take the second. Every call below is in the
   * applet's own order, which is the order faces are painted in.
   */
  function faces(state, width, height) {
    const m = metrics(state, width, height);
    const { cx, cy, w, h } = m;
    const C = palette(state.trans);
    const out = [];
    const rhombus = (a, b, c, fill, far, near) => {
      out.push({
        pts: [a, b, [c[0] + b[0] - a[0], c[1] + b[1] - a[1]], c],
        fill: fill,
        nearEdge: near || null,
        farEdge: far || null,
      });
    };
    const top = (x, y, dx, fill, far, near) =>
      rhombus([x, y], [x + dx * w, y - h], [x + dx * w, y + h], fill, far, near);
    const sideR = (x, y, fill, far, near) =>
      rhombus([x, y], [x + w, y - h], [x, y + 2 * h], fill, far, near);
    const sideL = (x, y, fill, far, near) =>
      rhombus([x, y], [x - w, y - h], [x, y + 2 * h], fill, far, near);
    const sideDownR = (x, y, fill, far, near) =>
      rhombus([x, y], [x + w, y + h], [x, y + 2 * h], fill, far, near);
    const verticalR = (x, y, fill, far, near) =>
      rhombus([x, y], [x, y - 2 * h], [x + w, y + h], fill, far, near);
    const verticalL = (x, y, fill, far, near) =>
      rhombus([x, y], [x, y + 2 * h], [x + w, y - h], fill, far, near);
    const verticalDownL = (x, y, fill, far, near) =>
      rhombus([x, y], [x, y - 2 * h], [x - w, y + h], fill, far, near);

    // The two top faces nearest the viewer.
    rhombus([cx - w, cy - h], [cx, cy], [cx - 2 * w, cy], C.darkMinus, C.dark, C.dark);
    rhombus([cx + w, cy - h], [cx, cy], [cx + 2 * w, cy], C.darkMinus, C.dark, C.dark);

    // Their two side faces.
    sideR(cx - 3 * w, cy + h, C.midDarkPlus, C.dark, C.darkPlus);
    sideL(cx + 3 * w, cy + h, C.midLightPlus, C.dark, C.darkPlus);

    // A diagonal band of four side faces just below the top faces.
    for (let i = 0; i < 4; i += 2) sideDownR(cx + (i - 2) * w, cy, C.midLight, C.dark, C.dark);
    for (let i = 1; i < 4; i += 2) sideR(cx - (i - 1) * w, cy + h, C.midDark, C.dark, C.dark);

    // The upper row of three top faces, then two more below it.
    let x = cx - 5 * w;
    for (let i = 0; i < 3; i++) {
      x += 2 * w;
      top(x, cy + 3 * h, 1, C.lightPlus);
    }
    for (let i = 0; i < 2; i++) top(cx - 2 * i * w, cy + 4 * h, 1, C.darkMinus, C.dark, C.dark);
    for (let i = 0; i < 2; i++) {
      const cxI = cx + (6 * i - 4) * w;
      const cyI = cy + 4 * h;
      if (i === 0) top(cxI, cyI, 1, C.dark, C.darkMinus, C.darkMinus);
      else top(cxI, cyI, 1, C.darkMinus, C.dark, C.dark);
    }

    // The middle band: one faded side face and three solid ones.
    verticalR(cx - 4 * w, cy + 6 * h, C.midLightMinus, C.darkMinus, C.darkMinus);
    x = cx - 4 * w;
    for (let i = 0; i < 3; i++) {
      x += 2 * w;
      verticalR(x, cy + 6 * h, C.midLight, C.dark, C.dark);
    }

    // Two lower rows of top faces, and a left-slanting side face at their end.
    x = cx - 5 * w;
    for (let i = 0; i < 3; i++) {
      x += 2 * w;
      verticalL(x, cy + 5 * h, C.midDarkMinus, C.dark, C.dark);
    }
    verticalL(cx + 3 * w, cy + 5 * h, C.midDarkMinus, C.dark, C.dark);
    x = cx - 5 * w;
    for (let i = 0; i < 3; i++) {
      x += 2 * w;
      top(x, cy + 7 * h, 1, C.lightPlus, C.dark, C.dark);
    }
    x = cx - 4 * w;
    for (let i = 0; i < 2; i++) {
      x += 2 * w;
      top(x, cy + 8 * h, 1, C.darkMinus, C.dark, C.dark);
    }

    // The bottom row: a top face flanked by three side faces, then the apex.
    rhombus([cx, cy + 10 * h], [cx, cy + 10 * h - 2 * h], [cx + w, cy + 10 * h + h], C.midLight, C.dark, C.dark);
    verticalR(cx - 2 * w, cy + 10 * h, C.midLightMinus, C.dark, C.darkMinus);
    verticalDownL(cx, cy + 10 * h, C.midDark, C.dark, C.darkMinus);
    verticalDownL(cx + 2 * w, cy + 10 * h, C.midDarkMinus, C.dark, C.darkMinus);
    rhombus([cx, cy + 12 * h], [cx + w, cy + 12 * h - h], [cx - w, cy + 12 * h - h], C.lightPlus, C.dark, C.darkPlus);

    return out;
  }

  /** A short, printable summary handed to the player's record and the tutor. */
  function position(state) {
    return { angle: state.angle, n: state.n, trans: state.trans };
  }

  return { RANGES, start, clamp, withOption, palette, metrics, faces, position };
})();
