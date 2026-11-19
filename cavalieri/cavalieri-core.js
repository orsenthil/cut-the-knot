"use strict";

/*
 * Cavalieri's Principle, from Alexander Bogomolny's applet Cavalieri.
 *
 * The picture holds two stacks of N thin rectangles standing between the same
 * two parallel lines. In the left stack a rectangle can be dragged as a whole
 * (slid along the stack); in the right stack each rectangle is bounded by two
 * bars, and dragging a bar changes that rectangle's length. After every drag
 * the matching left rectangle is given the very same length, so the two stacks
 * always have the same height, the same lengths at every level, and therefore
 * the same total area. That is Cavalieri's principle in its simplest form.
 *
 * The page also applies the principle to a cylinder, a cone and a hemisphere
 * of radius r and height r: the slice of the cone at height y is pi*y^2, the
 * slice left in the cylinder after removing the cone is pi*(r^2 - y^2), and a
 * hemisphere's slice at height y has radius sqrt(r^2 - y^2), so its area is
 * pi*(r^2 - y^2) too. Equal slices at every height give equal volumes:
 * cylinder - cone = hemisphere, and the familiar 4/3*pi*r^3 follows.
 *
 * The key idea in the code: each level stores the left rectangle's own length
 * (leftSpan) and the right rectangle's two bar positions (barA, barB). In
 * Horizontal mode barA is the left bar and barB the right one; in Vertical mode
 * barA is the lower bar and barB the upper one. The drag rules are transcribed
 * from the applet's UpgradeLeft/Right (horizontal) and UpgradeLow/Upper
 * (vertical) methods; at rest they keep leftSpan equal to the gap between the
 * bars, so the two figures' areas are always equal. No document, no window, no
 * storage: one global, CavalieriCore, and a plain-JSON position.
 */
const CavalieriCore = (() => {
  const MIN_N = 5;
  const MAX_N = 100;
  const DEFAULT_N = 20;

  /** Applet-style integer parameter: clamp to [low, high], fall back on bad input. */
  function clampInt(value, low, high, fallback) {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
  }

  /** One level's fresh rectangles: both fill the width/height of their figure. */
  function freshLevel(vertical) {
    return vertical
      ? { leftPos: 0, leftSpan: 1, barA: 1, barB: 0 }
      : { leftPos: 0, leftSpan: 1, barA: 0, barB: 1 };
  }

  /** Rebuild all N levels, as the applet's Reset (ResetH / ResetV) does. */
  function freshLevels(n, vertical) {
    const levels = [];
    for (let i = 0; i < n; i++) levels.push(freshLevel(vertical));
    return levels;
  }

  /** The position a new page opens with: N=20, Horizontal, lines off. */
  function start(options) {
    const opts = options || {};
    const n = clampInt(opts.n === undefined ? DEFAULT_N : opts.n, MIN_N, MAX_N, DEFAULT_N);
    const vertical = opts.vertical === true;
    return {
      n,
      vertical,
      showLines: opts.showLines === true,
      levels: freshLevels(n, vertical),
    };
  }

  /** The spinner's only move: set N (5..100) and, like the applet, reset. */
  function setN(state, value) {
    const n = clampInt(value, MIN_N, MAX_N, state.n);
    return { n, vertical: state.vertical, showLines: state.showLines, levels: freshLevels(n, state.vertical) };
  }

  /** The radio group: Horizontal=false, Vertical=true; the applet resets. */
  function setVertical(state, value) {
    const vertical = value === true;
    return { n: state.n, vertical, showLines: state.showLines, levels: freshLevels(state.n, vertical) };
  }

  /** The "Show lines" checkbox does not reset the rectangles. */
  function setShowLines(state, value) {
    return { n: state.n, vertical: state.vertical, showLines: value === true, levels: state.levels.slice() };
  }

  /** The Reset button: fresh rectangles, keeping the current options. */
  function reset(state) {
    return { n: state.n, vertical: state.vertical, showLines: state.showLines, levels: freshLevels(state.n, state.vertical) };
  }

  /** Copy a position, replacing one level. Pure: the input is never changed. */
  function withLevel(state, index, changes) {
    const levels = state.levels.slice();
    levels[index] = Object.assign({}, levels[index], changes);
    return { n: state.n, vertical: state.vertical, showLines: state.showLines, levels };
  }

  /** The right rectangle's length: right-minus-left, or bottom-minus-top. */
  function rightSpan(level, vertical) {
    return vertical ? level.barA - level.barB : level.barB - level.barA;
  }

  /**
   * Drag one of the right figure's two bars for a level. `which` is "a" (the
   * first bar: left in Horizontal, lower in Vertical) or "b" (the second bar:
   * right in Horizontal, upper in Vertical). `value` is the bar's new position
   * along the stack axis. Plain arithmetic, like the applet's Upgrade methods.
   *
   * Horizontal: bar A is the left end, bar B the right end. Dragging A keeps
   * the right edge of the left rectangle fixed (UpgradeLeft); dragging B keeps
   * its left edge fixed (UpgradeRight).
   * Vertical: bar A is the lower end, bar B the upper end. Dragging A keeps
   * the top edge of the left rectangle fixed (UpgradeLow); dragging B keeps
   * its bottom edge fixed (UpgradeUpper).
   */
  function dragBar(state, index, which, value) {
    const level = state.levels[index];
    const x = Number(value);
    if (!level || !Number.isFinite(x) || (which !== "a" && which !== "b")) return state;

    const oldSpan = rightSpan(level, state.vertical);
    let barA = level.barA;
    let barB = level.barB;
    if (which === "a") barA = x;
    else barB = x;

    const newSpan = rightSpan({ barA, barB }, state.vertical);
    const slide = state.vertical ? which === "b" : which === "a";
    const leftPos = slide ? level.leftPos + oldSpan - newSpan : level.leftPos;
    return withLevel(state, index, { barA, barB, leftSpan: newSpan, leftPos });
  }

  /** Drag the left stack's rectangle as a whole: only its position changes. */
  function slideLeft(state, index, value) {
    const x = Number(value);
    if (!state.levels[index] || !Number.isFinite(x)) return state;
    return withLevel(state, index, { leftPos: x });
  }

  /** Both figures have height 1 split into N equal strips, one per level. */
  function areas(state) {
    let left = 0;
    let right = 0;
    for (let i = 0; i < state.n; i++) {
      left += state.levels[i].leftSpan;
      right += rightSpan(state.levels[i], state.vertical);
    }
    return { left: left / state.n, right: right / state.n };
  }

  /** The two slice lengths at one level (equal at rest, by the drag rules). */
  function sliceLength(state, index) {
    return { left: state.levels[index].leftSpan, right: rightSpan(state.levels[index], state.vertical) };
  }

  /* ------------------------- the cylinder / cone / hemisphere application */

  const coneSlice = (y, r) => Math.PI * y * y;
  const cylinderSlice = (y, r) => Math.PI * r * r;
  const ringSlice = (y, r) => Math.PI * (r * r - y * y);
  /** A hemisphere's slice at height y: radius sqrt(r^2 - y^2), area pi*(r^2-y^2). */
  const hemisphereSlice = (y, r) => Math.PI * (r * r - y * y);

  const cylinderVolume = (r) => Math.PI * r * r * r;
  const coneVolume = (r) => (Math.PI * r * r * r) / 3;
  const hemisphereVolume = (r) => (2 * Math.PI * r * r * r) / 3;
  const sphereVolume = (r) => (4 * Math.PI * r * r * r) / 3;

  return {
    MIN_N, MAX_N, DEFAULT_N,
    start, setN, setVertical, setShowLines, reset,
    dragBar, slideLeft, rightSpan, areas, sliceLength,
    coneSlice, cylinderSlice, ringSlice, hemisphereSlice,
    cylinderVolume, coneVolume, hemisphereVolume, sphereVolume,
  };
})();
