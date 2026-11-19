"use strict";

/*
 * Bad Limit, from Alexander Bogomolny's applet BadLimit (cut-the-knot.org).
 *
 * The picture: a big square; the midpoints of its sides form a smaller square
 * (a diamond); on each side of the diamond a "staircase" is drawn, with n
 * equal steps that first go across and then down (or first down, then across).
 * As n grows the staircase lies closer and closer to the diamond, yet its
 * length never changes.
 *
 * Key idea (the invariant the whole port rests on): one side of the diamond is
 * the diagonal of an r-by-r square, where r is half the big square's side.
 * The staircase across that side is made of horizontal pieces totalling r and
 * vertical pieces totalling r, so it always measures r + r = 2r, whatever n
 * is. Four sides give 8r, exactly the big square's perimeter S. The diamond's
 * own perimeter is 4*r*sqrt(2) = S/sqrt(2), so the staircases converge to a
 * curve shorter than themselves: convergence of curves is not convergence of
 * their lengths.
 *
 * This file is the game's logic and nothing else: no document, no window, no
 * storage. It defines one global, BadLimitCore. All data is plain JSON
 * (numbers, arrays of {x, y} points), so the page can hand it to the record
 * and the tutor unchanged. Functions never mutate what they are given.
 */
const BadLimitCore = (() => {
  // From BadLimitPanel: new Scrollbar(VERTICAL, 5, 5, 1, 105), and from the
  // canvas constructor N = 5. The applet's parameter info suggests 400x300.
  const MIN_N = 1;
  const MAX_N = 105;
  const DEFAULT_N = 5;
  const DEFAULT_WIDTH = 400;
  const DEFAULT_HEIGHT = 300;
  const MARGIN = 20; // the applet insets the geometry 20 px from each edge

  function clampN(n) {
    const value = Number(n);
    if (!Number.isFinite(value)) return DEFAULT_N;
    return Math.max(MIN_N, Math.min(MAX_N, Math.round(value)));
  }

  /** The position a new picture starts from. */
  function start(options = {}) {
    const width = Number(options.width) > 0 ? Number(options.width) : DEFAULT_WIDTH;
    const height = Number(options.height) > 0 ? Number(options.height) : DEFAULT_HEIGHT;
    return { n: clampN(options.n === undefined ? DEFAULT_N : options.n), width, height };
  }

  /** The same picture with a different number of break points. */
  function withN(state, n) {
    return { n: clampN(n), width: state.width, height: state.height };
  }

  /** The centre and half-side the applet derives from the canvas size. */
  function geometry(state) {
    const r = Math.min(state.width - 2 * MARGIN, state.height - 2 * MARGIN) / 2;
    return { cx: state.width / 2, cy: state.height / 2, r };
  }

  /** The four corners of the big square, in the applet's order. */
  function bigSquare(state) {
    const { cx, cy, r } = geometry(state);
    return [
      { x: cx - r, y: cy - r },
      { x: cx - r, y: cy + r },
      { x: cx + r, y: cy + r },
      { x: cx + r, y: cy - r },
    ];
  }

  /** The small square (applet's "Rhomb"): the midpoints of the big sides. */
  function smallSquare(state) {
    const { cx, cy, r } = geometry(state);
    return [
      { x: cx, y: cy - r },
      { x: cx - r, y: cy },
      { x: cx, y: cy + r },
      { x: cx + r, y: cy },
    ];
  }

  /*
   * The staircase points, transcribed from BadLimitCanvas.CollectPoints and
   * Reset. For each diamond side A -> B, k = 0 .. n-1 adds (x_k, y_k) and then
   * either (x_k, y_{k+1}) [flag] or (x_{k+1}, y_k) [!flag]. The flag alternates
   * with the side index (i % 2 == 1), exactly as in Reset().
   */
  function brokenLine(state) {
    const rhomb = smallSquare(state);
    const n = state.n;
    const points = [];

    function collect(a, b, flag) {
      for (let k = 0; k < n; k++) {
        points.push({ x: a.x + (k * (b.x - a.x)) / n, y: a.y + (k * (b.y - a.y)) / n });
        if (flag) {
          points.push({ x: a.x + (k * (b.x - a.x)) / n, y: a.y + ((k + 1) * (b.y - a.y)) / n });
        } else {
          points.push({ x: a.x + ((k + 1) * (b.x - a.x)) / n, y: a.y + (k * (b.y - a.y)) / n });
        }
      }
    }

    for (let i = 0; i < 4; i++) {
      collect(rhomb[i], rhomb[(i + 1) % 4], i % 2 === 1);
    }
    return points;
  }

  /** Length of a polyline; closed includes the last-to-first segment. */
  function perimeter(points, closed = true) {
    let total = 0;
    const last = closed ? points.length : points.length - 1;
    for (let i = 0; i < last; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return total;
  }

  const bigPerimeter = (state) => perimeter(bigSquare(state), true);
  const smallPerimeter = (state) => perimeter(smallSquare(state), true);
  const brokenPerimeter = (state) => perimeter(brokenLine(state), true);

  /** Distance from p to segment ab, for the convergence-of-curves check. */
  function pointSegmentDistance(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  /** How far the staircase wanders from the small square; tends to 0 as n grows. */
  function deviation(state) {
    const rhomb = smallSquare(state);
    let worst = 0;
    for (const p of brokenLine(state)) {
      let nearest = Infinity;
      for (let i = 0; i < 4; i++) {
        nearest = Math.min(nearest, pointSegmentDistance(p, rhomb[i], rhomb[(i + 1) % 4]));
      }
      worst = Math.max(worst, nearest);
    }
    return worst;
  }

  /** The numbers the page talks about, in one plain object. */
  function summary(state) {
    const S = bigPerimeter(state);
    const s = smallPerimeter(state);
    const sn = brokenPerimeter(state);
    return { n: state.n, S, s, sn, ratio: s / S };
  }

  /* A demo: there is no winner, and it is finished as soon as it is explored. */
  function result(state) {
    return state ? "done" : null;
  }

  return {
    MIN_N, MAX_N, DEFAULT_N, MARGIN,
    clampN, start, withN, geometry, bigSquare, smallSquare, brokenLine,
    perimeter, bigPerimeter, smallPerimeter, brokenPerimeter, deviation,
    summary, result,
  };
})();
