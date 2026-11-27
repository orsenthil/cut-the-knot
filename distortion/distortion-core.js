"use strict";

/*
 * Distortion — Alexander Bogomolny's "Distorted Lines Illusion" applet.
 *
 * The applet paints one of two pictures and lets a scrollbar set the spacing
 * between the crossing lines.  "Triangle on Circles" draws nested circles,
 * each one `spread` pixels smaller on every side, then one triangle whose
 * three corners lie on the outermost circle.  "Circle on Triangles" draws
 * nested triangles, each one 3·spread pixels smaller in its corner radius,
 * then three concentric circles with integer radii trunc(S/6), trunc(S/3)
 * and trunc(S/2).  Here S is min(width, height) − 15, exactly as in the two
 * Draw methods, which also divide the centre coordinates as integers.
 *
 * The surprise is perceptual: the figures themselves are true circles and
 * straight-sided, equal-sided triangles.  The crossing lines make the eye
 * read them as bent.  This file is only that geometry: no document, no
 * window, no storage.  It defines one global, DistortionCore, so the page
 * loads it with a plain <script> and porting/check-distortion.mjs loads it
 * in Node.  Positions are plain, saveable objects in the SVG's viewBox units.
 */

const DistortionCore = (() => {
  /* The canvas on the cut-the-knot page is 400 wide; the applet lets its
   * canvas take the height the border layout leaves, so the drawing is
   * centred on whichever of the two sides is shorter. */
  const VIEW = Object.freeze({ width: 400, height: 300 });
  const SPREAD_DEFAULT = 10;
  const SPREAD_MIN = 2;
  const SPREAD_MAX = 36;
  const TRACK_MAX = 40;                 // Java Scrollbar(HORIZONTAL, 10, 4, 2, 40)
  const TRACK_VISIBLE = 4;              // ... so the largest reachable value is 36
  const PAGE_STEP = 4;

  const MODE_TRIANGLES_ON_CIRCLES = "triangle-on-circles";   // Which = false
  const MODE_CIRCLES_ON_TRIANGLES = "circle-on-triangles";   // Which = true

  function clampSpread(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return SPREAD_DEFAULT;
    return Math.max(SPREAD_MIN, Math.min(SPREAD_MAX, Math.round(n)));
  }

  /* The applet's CheckboxGroup sets Which from the second checkbox. */
  function normalizeMode(value) {
    if (value === true || value === MODE_CIRCLES_ON_TRIANGLES || value === 1) {
      return MODE_CIRCLES_ON_TRIANGLES;
    }
    return MODE_TRIANGLES_ON_CIRCLES;
  }

  /** The picture a new page opens with: spread 10, triangles over circles. */
  function start(options) {
    const o = options || {};
    return {
      spread: clampSpread(o.spread === undefined ? SPREAD_DEFAULT : o.spread),
      mode: normalizeMode(o.mode === undefined ? MODE_TRIANGLES_ON_CIRCLES : o.mode),
      explored: false,
    };
  }

  function setOption(state, name, value) {
    if (name === "spread") {
      return Object.assign({}, state, { spread: clampSpread(value), explored: true });
    }
    if (name === "mode") {
      return Object.assign({}, state, { mode: normalizeMode(value), explored: true });
    }
    return state;
  }

  /** The Reset button goes back to the applet's own starting picture. */
  function reset(state) {
    return Object.assign(start({}), { explored: !!(state && state.explored) });
  }

  /* A triangle whose corners sit on the circle of radius r about (cx, cy).
   * The three angles are the bytecode's π/2, π/6 and −π/6 from the x axis,
   * with the y axis running down the screen; Math.round mirrors Java's. */
  function triangle(cx, cy, radius) {
    const halfPi = Math.PI / 2;
    const sixthPi = Math.PI / 6;
    return {
      radius: radius,
      vertices: [
        { x: Math.round(cx + radius * Math.cos(halfPi)),
          y: Math.round(cy - radius * Math.sin(halfPi)) },
        { x: Math.round(cx + radius * Math.cos(sixthPi)),
          y: Math.round(cy + radius * Math.sin(sixthPi)) },
        { x: Math.round(cx - radius * Math.cos(sixthPi)),
          y: Math.round(cy + radius * Math.sin(sixthPi)) },
      ],
    };
  }

  /**
   * Every circle and every line the applet would draw, in viewBox units.
   * `size` is optional; the page always passes VIEW, the test passes many
   * canvas sizes so that the bytecode can be checked over its whole range.
   */
  function scene(size, spread, mode) {
    const w = size && size.width !== undefined ? size.width : VIEW.width;
    const h = size && size.height !== undefined ? size.height : VIEW.height;
    const s = clampSpread(spread);
    const m = normalizeMode(mode);
    // The applet divides these with Java's integer `/`: the two origins and
    // the centre are truncated, not half-pixel values, on odd canvas sizes.
    const side = Math.min(w, h) - 15;
    const x0 = Math.trunc((w - side) / 2);
    const y0 = Math.trunc((h - side) / 2);
    const cx = Math.trunc(w / 2);
    const cy = Math.trunc(h / 2);
    const circles = [];
    const triangles = [];

    if (m === MODE_TRIANGLES_ON_CIRCLES) {
      // DrawTriangleOnCircles: drawOval(x0+k·s, y0+k·s, side−2k·s, ...).
      for (let k = 0; k >= 0; k++) {
        const offset = k * s;
        const diameter = side - 2 * offset;
        if (diameter < 0) break;
        circles.push({
          cx: x0 + offset + diameter / 2, cy: y0 + offset + diameter / 2,
          radius: diameter / 2, diameter: diameter,
        });
      }
      triangles.push(triangle(cx, cy, Math.trunc(side / 2)));
    } else {
      // DrawCircleOnTriangles: three triangles with corner radius side−3n·s.
      for (let n = 0; n >= 0; n++) {
        const radius = side - 3 * n * s;
        if (radius < 0) break;
        triangles.push(triangle(cx, cy, radius));
      }
      // ... then three circles.  The bytecode's `side*(j+1)/6` is an int
      // division, so the radii are truncated: 47, 95, 142 when side = 285.
      for (let j = 0; j < 3; j++) {
        const radius = Math.trunc(side * (j + 1) / 6);
        circles.push({ cx: cx, cy: cy, radius: radius, diameter: 2 * radius });
      }
    }

    return {
      width: w, height: h, side: side,
      origin: { x: x0, y: y0 }, centre: { x: cx, y: cy },
      spread: s, mode: m, circles: circles, triangles: triangles,
    };
  }

  function geometry(state, size) {
    return scene(size || VIEW, state.spread, state.mode);
  }

  /* A picture, not a game: there is no win and no loss. */
  function result() {
    return null;
  }

  /** The status line says in words what is on the board. */
  function describe(state, size) {
    const g = geometry(state, size);
    if (g.mode === MODE_CIRCLES_ON_TRIANGLES) {
      return `Circle on triangles: ${g.triangles.length} nested triangles and 3 circles; spacing ${g.spread}. The circles are exact; only your eyes bend them.`;
    }
    return `Triangle on circles: ${g.circles.length} nested circles and 1 triangle; spacing ${g.spread}. The sides are straight; only your eyes bend them.`;
  }

  return {
    VIEW: VIEW,
    SPREAD_DEFAULT: SPREAD_DEFAULT, SPREAD_MIN: SPREAD_MIN, SPREAD_MAX: SPREAD_MAX,
    TRACK_MAX: TRACK_MAX, TRACK_VISIBLE: TRACK_VISIBLE, PAGE_STEP: PAGE_STEP,
    MODE_TRIANGLES_ON_CIRCLES: MODE_TRIANGLES_ON_CIRCLES,
    MODE_CIRCLES_ON_TRIANGLES: MODE_CIRCLES_ON_TRIANGLES,
    clampSpread: clampSpread, normalizeMode: normalizeMode,
    start: start, setOption: setOption, reset: reset,
    triangle: triangle, scene: scene, geometry: geometry,
    result: result, describe: describe,
  };
})();
