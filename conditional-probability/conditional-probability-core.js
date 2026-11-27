"use strict";

/*
 * Conditional Probability: the DOM-free logic of Alexander Bogomolny's
 * ConditionalProbability applet. The sample space is a grid of Nx by Ny
 * equally likely dots (the applet's default is 25 by 20, both spinners run
 * from 10 to 30). Two axis-aligned rectangles, A and B, stand for events;
 * their corners snap to grid lines. The five displayed numbers are
 *
 *   P(A), P(B), P(A^B), P(A|B) = P(A^B)/P(B), P(B|A) = P(A^B)/P(A).
 *
 * A rectangle's probability is its number of grid cells divided by Nx*Ny,
 * which is ConditionalProbabilityCanvas.Prob() in the applet's bytecode
 * (integer cell counts from ComputePoly, then width*height/(Nx*Ny)). All
 * positions here are integer grid coordinates, so nothing depends on the
 * canvas's pixel size. This file defines one global and touches no DOM.
 */
const ConditionalProbabilityCore = (() => {
  const LIMITS = { min: 10, max: 30, defaultNx: 25, defaultNy: 20 };

  // ConditionalProbabilityCanvas.Reset(): CreateRect(0,2,3,4,6) and
  // CreateRect(1,5,8,6,5). The four arguments after the index are x, y,
  // width and height in grid cells.
  const START_R = { a: { x: 2, y: 3, w: 4, h: 6 }, b: { x: 5, y: 8, w: 6, h: 5 } };

  const round = (v) => Math.round(v); // the applet's a(double) = Math.round
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const copy = (r) => ({ x: r.x, y: r.y, w: r.w, h: r.h });

  function size(v, fallback) {
    const n = round(Number(v));
    return Number.isFinite(n) ? clamp(n, LIMITS.min, LIMITS.max) : fallback;
  }

  /** A fresh illustration at the applet's start position. */
  function start() {
    return {
      nx: LIMITS.defaultNx,
      ny: LIMITS.defaultNy,
      a: copy(START_R.a),
      b: copy(START_R.b),
    };
  }

  /**
   * ConditionalProbabilityCanvas.FixPointsRelative(): dragging one corner
   * keeps the opposite corner fixed; crossing it mirrors the rectangle.
   * Corners 0,1,2,3 are top-left, bottom-left, bottom-right, top-right.
   */
  const OPPOSITE = [
    (r) => ({ x: r.x + r.w, y: r.y + r.h }),
    (r) => ({ x: r.x + r.w, y: r.y }),
    (r) => ({ x: r.x, y: r.y }),
    (r) => ({ x: r.x, y: r.y + r.h }),
  ];

  /** Move one corner of A or B; the point is in grid coordinates. */
  function withCorner(state, which, corner, point) {
    if (which !== "a" && which !== "b") return state;
    const k = clamp(Math.round(corner), 0, 3);
    const r = state[which];
    const fixed = OPPOSITE[k](r);
    const x = clamp(round(point.x), 0, state.nx);
    const y = clamp(round(point.y), 0, state.ny);
    const next = {
      x: Math.min(fixed.x, x),
      y: Math.min(fixed.y, y),
      w: Math.abs(fixed.x - x),
      h: Math.abs(fixed.y - y),
    };
    return { nx: state.nx, ny: state.ny, a: which === "a" ? next : copy(state.a),
      b: which === "b" ? next : copy(state.b) };
  }

  /** Replace a rectangle wholesale (used by Reset and the play scenario). */
  function withRect(state, which, rect) {
    const r = copy(rect);
    r.x = clamp(round(r.x), 0, state.nx);
    r.y = clamp(round(r.y), 0, state.ny);
    r.w = clamp(round(r.w), 0, state.nx - r.x);
    r.h = clamp(round(r.h), 0, state.ny - r.y);
    return { nx: state.nx, ny: state.ny, a: which === "a" ? r : copy(state.a),
      b: which === "b" ? r : copy(state.b) };
  }

  /**
   * ConditionalProbabilityPanelS.actionPerformed + Canvas.Upgrade(): the
   * spinners set Nx/Ny and the grid points keep their integer coordinates.
   * CheckAllPoints then clips any point outside the shrunken space.
   */
  function withGrid(state, nx, ny) {
    const n = size(nx, state.nx), m = size(ny, state.ny);
    const clip = (r) => {
      const x = clamp(r.x, 0, n), y = clamp(r.y, 0, m);
      return { x, y, w: clamp(r.w, 0, n - x), h: clamp(r.h, 0, m - y) };
    };
    return { nx: n, ny: m, a: clip(state.a), b: clip(state.b) };
  }

  /** java.awt.Rectangle.intersection, for integer rectangles. */
  function intersection(p, q) {
    const x1 = Math.max(p.x, q.x), y1 = Math.max(p.y, q.y);
    const x2 = Math.min(p.x + p.w, q.x + q.w);
    const y2 = Math.min(p.y + p.h, q.y + q.h);
    const w = Math.max(0, x2 - x1), h = Math.max(0, y2 - y1);
    return { x: x1, y: y1, w, h };
  }

  /**
   * ConditionalProbabilityCanvas.Compute(). The labels are set from five
   * doubles; we keep both the doubles and the exact integer cell counts so
   * the equality P(A^B) = P(A)P(B) can be checked without rounding error.
   */
  function compute(state) {
    const ra = copy(state.a), rb = copy(state.b);
    const ri = intersection(ra, rb);
    const total = state.nx * state.ny;
    const ca = ra.w * ra.h, cb = rb.w * rb.h, ci = ri.w * ri.h;
    const pa = ca / total, pb = cb / total, pi = ci / total;
    return {
      nx: state.nx, ny: state.ny, total,
      a: ra, b: rb, i: ri,
      cells: { a: ca, b: cb, i: ci },
      pa, pb, pi,
      pab: pi / pb,  // label P(A|B)
      pba: pi / pa,  // label P(B|A)
    };
  }

  /** DecimalFormat("  #.#####") in the applet, including HALF_EVEN ties. */
  function format(v) {
    if (Number.isNaN(v)) return "NaN";
    if (!Number.isFinite(v)) return v > 0 ? "\u221e" : "-\u221e";
    const neg = v < 0;
    const scaled = Math.abs(v) * 1e5;
    const frac = scaled - Math.floor(scaled);
    let n;
    if (Math.abs(frac - 0.5) < 1e-9) n = Math.floor(scaled) % 2 === 0 ? Math.floor(scaled) : Math.floor(scaled) + 1;
    else n = Math.round(scaled);
    if (n === 0) return "  0";
    const whole = Math.floor(n / 1e5);
    const decimals = String(n % 1e5).padStart(5, "0").replace(/0+$/, "");
    return "  " + (neg ? "-" : "") + whole + (decimals ? "." + decimals : "");
  }

  /** Independence on positive-probability events, as on the applet's page. */
  function independent(p) {
    if (!(p.cells.a > 0 && p.cells.b > 0)) return null; // undefined conditionals
    return p.cells.i * p.total === p.cells.a * p.cells.b;
  }

  return { LIMITS, START_R, start, withCorner, withRect, withGrid, intersection,
    compute, format, independent, round, clamp };
})();
