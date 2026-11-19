"use strict";

/*
 * Area of a Circle, from Alexander Bogomolny's applet AreaOfCircle. The page
 * credits Leonardo da Vinci and Sato Moshun with the idea: cut a disk into N
 * equal sectors, then slide the sectors into a row, alternating which way each
 * one points. The two wavy edges of the row are built from half the sectors
 * each, so together they are exactly one circumference long. As the sectors
 * get thinner the row tends to a rectangle of base pi*r and height r.
 *
 * The relations the code relies on, for a disk of radius r and N sectors:
 *   sector angle          = 2*pi/N
 *   curved edge of a sector = 2*pi*r/N
 *   horizontal step between neighbouring tips = r*sin(pi/N)
 *   vertical gap between the two rows of tips  = r*cos(pi/N)
 *
 * No document, no window, no storage: one global, AreaOfCircleCore. The
 * position is plain data (the number of sectors), so it can be saved and
 * handed to the tutor as it is.
 */
const AreaOfCircleCore = (() => {
  const MIN_SECTORS = 3;
  const MAX_SECTORS = 100;
  const DEFAULT_SECTORS = 6; // the NSectors parameter on the applet's page
  const TAU = 2 * Math.PI;

  /** Applet-style integer parameter: clamp, and fall back for bad input. */
  function clamp(value, low, high, fallback) {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
  }

  /** The position a new page opens with. */
  function start(options) {
    const opts = options || {};
    const sectors = opts.sectors === undefined ? DEFAULT_SECTORS : opts.sectors;
    return { sectors: clamp(sectors, MIN_SECTORS, MAX_SECTORS, DEFAULT_SECTORS) };
  }

  /** The spinner's only move: set the number of sectors, 3 to 100. */
  function setSectors(state, value) {
    return { sectors: clamp(value, MIN_SECTORS, MAX_SECTORS, state.sectors) };
  }

  /**
   * All the lengths behind the picture, for a disk of the given radius.
   * `topBase` and `bottomBase` are the total lengths of the two curved edges.
   * `width` is the horizontal span of the row and `height` its vertical span.
   */
  function geometry(state, radius) {
    const n = state.sectors;
    const r = radius;
    const halfAngle = Math.PI / n;
    const arcLength = TAU * r / n;
    const step = r * Math.sin(halfAngle);
    const rowGap = r * Math.cos(halfAngle);
    const topCount = Math.ceil(n / 2);
    const bottomCount = n - topCount;
    return {
      sectors: n,
      radius: r,
      halfAngle,
      sectorAngle: 2 * halfAngle,
      step,
      rowGap,
      arcLength,
      topCount,
      bottomCount,
      topBase: topCount * arcLength,
      bottomBase: bottomCount * arcLength,
      circumference: TAU * r,
      width: n * step,
      height: r + (r - rowGap),
    };
  }

  /**
   * Where sector i's tip sits in the rearranged row, and which way its curved
   * edge faces. Angles are canvas angles (0 right, -pi/2 up, y grows down):
   * an even sector points up, an odd one points down, so they interlock.
   */
  function tip(i, g) {
    const up = i % 2 === 0;
    return {
      x: i * g.step,
      y: up ? g.radius : g.radius - g.rowGap,
      up,
      arcStart: up ? -Math.PI / 2 - g.halfAngle : Math.PI / 2 - g.halfAngle,
      arcEnd: up ? -Math.PI / 2 + g.halfAngle : Math.PI / 2 + g.halfAngle,
    };
  }

  return {
    MIN_SECTORS, MAX_SECTORS, DEFAULT_SECTORS,
    start, setSectors, geometry, tip,
  };
})();
