"use strict";

/*
 * One Sheet Hyperboloid — Alexander Bogomolny's Hyperboloid applet, as data.
 *
 * The Java applet put N points round each of two circular bases (radius R =
 * 0.5f, at heights -L/2 and +L/2 with L = 1.5f) and joined bottom point i to
 * top point i + M with a straight generator. M = 0 starts as a cylinder;
 * turning the top base by M steps of 2*pi/N bends the family of generators
 * into a one-sheet hyperboloid. The page also says that the same surface is a
 * hyperbola spun about the axis that misses it. This file keeps those two
 * facts as plain data so they can be checked in Node.
 *
 * No document, no window, no storage: one global, HyperboloidCore. Positions
 * are plain objects and arrays; each function returns a new position.
 */
const HyperboloidCore = (() => {
  /* Fields in the applet's constructor: R = 0.5f, L = 1.5f, N = 25, M = 0. */
  const R = Math.fround(0.5);
  const L = Math.fround(1.5);
  const DEFAULT_LINES = 25;
  const DEFAULT_SHIFT = 0;
  /* SpinnerNumberModel(0, 0, 100, 1) and (25, 5, 200, 5). */
  const MIN_SHIFT = 0;
  const MAX_SHIFT = 100;
  const SHIFT_STEP = 1;
  const MIN_LINES = 5;
  const MAX_LINES = 200;
  const LINE_STEP = 5;
  /* The bytecode uses the float literal 6.2831855f, not Math.PI. */
  const TWO_PI_F = Math.fround(6.2831855);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const snap = (v, lo, hi, step) =>
    lo + Math.round((clamp(v, lo, hi) - lo) / step) * step;
  const whole = (v, fallback) => (Number.isFinite(v) ? Math.round(v) : fallback);

  /** The position the applet starts in: 25 generators, no base rotation. */
  function start(options) {
    const o = options || {};
    const lines = snap(whole(o.lines, DEFAULT_LINES), MIN_LINES, MAX_LINES, LINE_STEP);
    const shift = clamp(whole(o.shift, DEFAULT_SHIFT), MIN_SHIFT, MAX_SHIFT);
    const solid = !!o.solid;
    /* itemStateChanged(): unticking Solid always ticks Generators again. */
    const frame = solid ? o.frame !== false : true;
    return { lines: lines, shift: shift, frame: frame, solid: solid };
  }

  /** A changed spinner or checkbox, with the same ranges and the frame quirk. */
  function withOption(state, key, value) {
    let s = Object.assign({}, state);
    if (key === "lines") s.lines = snap(whole(value, state.lines), MIN_LINES, MAX_LINES, LINE_STEP);
    else if (key === "shift") s.shift = clamp(whole(value, state.shift), MIN_SHIFT, MAX_SHIFT);
    else if (key === "solid") {
      s.solid = !!value;
      if (!s.solid) s.frame = true;
    } else if (key === "frame") {
      s.frame = state.solid ? !!value : true;
    }
    return s;
  }

  /**
   * A literal transcription of GetGeoData(int n) from the bytecode. Points are
   * [x, y, z]; the first n are the bottom base, the next n the top base.
   * Quad i lists bottom i, bottom i+1, top i+1+M and top i+M in that order.
   * The float roundings mirror the Java fstore/fastore operations.
   */
  function getGeoData(n, shift) {
    const count = Math.max(1, Math.round(n));
    const m = whole(shift, 0);
    const points = [];
    for (let i = 0; i < 2 * count; i++) points.push([0, 0, 0]);
    const step = Math.fround(TWO_PI_F / count);
    const bottomY = Math.fround(-L / 2);

    for (let i = 0; i < count; i++) {
      const theta = Math.fround(step * i);
      points[i][0] = Math.fround(R * Math.cos(theta));
      points[i][2] = Math.fround(R * Math.sin(theta));
      points[i][1] = bottomY;
    }
    for (let i = 0; i < count; i++) {
      points[i + count][0] = points[i][0];
      points[i + count][2] = points[i][2];
      points[i + count][1] = -points[i][1];
    }

    const quads = [];
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      quads.push([
        i,
        next,
        (next + m) % count + count,
        (i + m) % count + count,
      ]);
    }
    return { points: points, quads: quads, step: step };
  }

  function geometry(state) {
    return getGeoData(state.lines, state.shift);
  }

  /** The angle the applet's Base Shift actually turns the top base through. */
  function turnAngle(state) {
    return (2 * Math.PI * (state.shift % state.lines)) / state.lines;
  }

  /**
   * The surface carrying the generators. Put t = (y + L/2) / L along a
   * generator: x^2 + z^2 = R^2 (cos^2(phi/2) + (2y/L)^2 sin^2(phi/2)).
   * That is r^2 / a^2 - y^2 / c^2 = 1, with a = R |cos(phi/2)| and
   * c = (L/2) |cot(phi/2)|: a hyperbola spun about the y axis it misses.
   * m = 0 is the cylinder (c = Infinity); m = N/2 is the cone (a = c = 0).
   */
  function surface(state) {
    const n = state.lines;
    const m = ((state.shift % n) + n) % n;
    const phi = (2 * Math.PI * m) / n;
    const half = phi / 2;
    const a = R * Math.abs(Math.cos(half));
    const c = Math.abs(Math.sin(half)) < 1e-12 ? Infinity
      : ((L / 2) * Math.abs(Math.cos(half))) / Math.abs(Math.sin(half));
    return {
      steps: m, phi: phi, waist: a, throat: c,
      kind: m === 0 ? "cylinder" : m * 2 === n ? "cone" : "hyperboloid",
    };
  }

  /** Radius of that surface at height y (Infinity is not involved). */
  function radiusAt(state, y) {
    const phi = turnAngle(state);
    const t = (2 * y) / L;
    return R * Math.sqrt(Math.max(0,
      Math.cos(phi / 2) * Math.cos(phi / 2) + t * t * Math.sin(phi / 2) * Math.sin(phi / 2)));
  }

  /** The point t of the way along generator i, straight from the two bases. */
  function generatorPoint(geo, i, t) {
    const quad = geo.quads[i];
    const a = geo.points[quad[0]], b = geo.points[quad[3]];
    return [
      (1 - t) * a[0] + t * b[0],
      (1 - t) * a[1] + t * b[1],
      (1 - t) * a[2] + t * b[2],
    ];
  }

  /**
   * SetRendering(Solid.isSelected(), Frame.isSelected(), 1) from the applet:
   * no solid means FRAMEONLY whatever the Frame checkbox says; a solid is
   * always TRANSPARENT (the third argument is the constant 1).
   */
  function rendering(state) {
    return {
      frame: state.solid ? state.frame : true,
      solid: !!state.solid,
      transparent: !!state.solid,
    };
  }

  /** A short status line; the algebra is left for the page's maths section. */
  function describe(state) {
    const s = surface(state);
    const degrees = (s.phi * 180) / Math.PI;
    if (s.kind === "cylinder") {
      return {
        title: "Cylinder",
        text: `At the outset the ${state.lines} generators stand straight: the two bases are not turned.`,
      };
    }
    if (s.kind === "cone") {
      return {
        title: "Cone",
        text: `The top base has turned ${degrees.toFixed(0)}\u00b0, half way round, so the generators meet on the axis.`,
      };
    }
    return {
      title: "One sheet hyperboloid",
      text: `The top base has turned ${s.steps} of ${state.lines} steps (${degrees.toFixed(0)}\u00b0). ` +
        `The generators come within ${s.waist.toFixed(3)} of the axis at the middle.`,
    };
  }

  return {
    R: R, L: L, TWO_PI_F: TWO_PI_F,
    DEFAULT_LINES: DEFAULT_LINES, DEFAULT_SHIFT: DEFAULT_SHIFT,
    MIN_LINES: MIN_LINES, MAX_LINES: MAX_LINES, LINE_STEP: LINE_STEP,
    MIN_SHIFT: MIN_SHIFT, MAX_SHIFT: MAX_SHIFT, SHIFT_STEP: SHIFT_STEP,
    clamp: clamp, snap: snap,
    start: start, withOption: withOption, getGeoData: getGeoData,
    geometry: geometry, turnAngle: turnAngle, surface: surface,
    radiusAt: radiusAt, generatorPoint: generatorPoint,
    rendering: rendering, describe: describe,
  };
})();
