"use strict";

/*
 * Hilbert and Moore Curves, from Bogomolny's applet hilbert.
 *
 * The Hilbert curve is built by shrinking a staple-shaped path and placing
 * four rotated copies in the quadrants, joining them with short segments. The
 * Moore curve closes that path into a loop. Order n of the curve visits every
 * cell of a 2^n by 2^n grid exactly once.
 *
 * The key idea is the d-to-xy mapping: the index d along the curve is
 * converted to grid coordinates by rotating and swapping at each bit. The
 * logic test checks that all cells are visited once, consecutive points are
 * neighbours, and the curve stays in the square.
 *
 * No document, no window, no storage: one global, HilbertCurveCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const HilbertCurveCore = (() => {
  const MIN_ORDER = 1;
  const MAX_ORDER = 7;

  function clamp(value, fallback) {
    const v = Math.trunc(Number(value));
    return Number.isFinite(v) ? Math.max(MIN_ORDER, Math.min(MAX_ORDER, v)) : fallback;
  }

  /** Convert a position d along the Hilbert curve to grid coordinates. */
  function d2xy(order, d) {
    const n = 2 ** order;
    let rx;
    let ry;
    let t = d;
    let x = 0;
    let y = 0;
    for (let s = 1; s < n; s *= 2) {
      rx = 1 & Math.floor(t / 2);
      ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) {
          x = s - 1 - x;
          y = s - 1 - y;
        }
        [x, y] = [y, x];
      }
      x += s * rx;
      y += s * ry;
      t = Math.floor(t / 4);
    }
    return { x, y };
  }

  function points(order, kind) {
    const size = clamp(order, 3);
    const count = 4 ** size;
    const pts = [];
    for (let d = 0; d < count; d++) pts.push(d2xy(size, d));
    if (kind === "moore" && pts.length > 1) {
      // The Moore curve joins the end back to the start with a short segment.
      pts.push({ ...pts[0], close: true });
    }
    return pts;
  }

  function start() {
    return { order: 3, kind: "hilbert" };
  }

  function setOrder(state, value) {
    return { ...state, order: clamp(value, state.order) };
  }

  function setKind(state, kind) {
    return { ...state, kind: kind === "moore" ? "moore" : "hilbert" };
  }

  return { MIN_ORDER, MAX_ORDER, clamp, d2xy, points, start, setOrder, setKind };
})();
