"use strict";

/*
 * Rectangle on a Chessboard, from Bogomolny's applet IntegerRectangle.
 *
 * A rectangle with sides parallel to a unit chessboard covers equal areas of
 * the two colours if and only if either one of its sides is an even whole
 * number of square sides, or its centre lies on a grid line. The applet shows
 * that any rectangle splits into at most three pieces: one with even width,
 * one with even height, and one with both sides less than two.
 *
 * The key idea is that the colour alternates from square to square, so a strip
 * of even integer width always pairs one light square with one dark square,
 * and a centre on a grid line gives a symmetry. The logic test checks the "if
 * and only if" on a fine grid of positions and sizes, the decomposition, and
 * the tiling theorem's easy direction.
 *
 * No document, no window, no storage: one global, IntegerRectangleCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const IntegerRectangleCore = (() => {
  const BOARD = 8;
  const EPS = 1e-9;

  const nearInt = (v) => Math.abs(v - Math.round(v)) < EPS;

  function clamp(value, lo, hi, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
  }

  function start() {
    return { x: 0.5, y: 0.5, w: 2.5, h: 1.5 };
  }

  /** Exact areas, summed over each unit square the rectangle overlaps. */
  function areas(rect) {
    const { x, y, w, h } = rect;
    let light = 0;
    let dark = 0;
    const i0 = Math.floor(x);
    const i1 = Math.ceil(x + w);
    const j0 = Math.floor(y);
    const j1 = Math.ceil(y + h);
    for (let i = i0; i < i1; i++) {
      for (let j = j0; j < j1; j++) {
        const ox = Math.min(x + w, i + 1) - Math.max(x, i);
        const oy = Math.min(y + h, j + 1) - Math.max(y, j);
        if (ox <= EPS || oy <= EPS) continue;
        const area = ox * oy;
        if (((i + j) % 2 + 2) % 2 === 0) light += area;
        else dark += area;
      }
    }
    return {
      light, dark,
      total: light + dark,
      difference: light - dark,
      balanced: Math.abs(light - dark) < 1e-7,
    };
  }

  function evenSide(length) {
    return nearInt(length) && Math.round(length) % 2 === 0;
  }

  function centerOnGridLine(rect) {
    return nearInt(rect.x + rect.w / 2) || nearInt(rect.y + rect.h / 2);
  }

  function balancedByRule(rect) {
    return evenSide(rect.w) || evenSide(rect.h) || centerOnGridLine(rect);
  }

  /** Split into at most three pieces: even width, even height, both < 2. */
  function decompose(rect) {
    const pieces = [];
    const { x, y, w, h } = rect;
    const evenW = 2 * Math.floor(w / 2 + EPS);
    let left = x;
    let width = w;
    if (evenW >= 2 - EPS) {
      pieces.push({ x: left, y, w: evenW, h, kind: "even width" });
      left += evenW;
      width = w - evenW;
    }
    const evenH = 2 * Math.floor(h / 2 + EPS);
    if (evenH >= 2 - EPS) {
      pieces.push({ x: left, y, w: width, h: evenH, kind: "even height" });
    }
    const restH = h - evenH;
    if (width > EPS && restH > EPS) {
      pieces.push({ x: left, y: y + evenH, w: width, h: restH, kind: "both sides < 2" });
    }
    return pieces;
  }

  /** Keep a rectangle inside the board. */
  function set(state, key, value) {
    const next = { ...state };
    if (key === "x") next.x = clamp(value, 0, BOARD - state.w, state.x);
    else if (key === "y") next.y = clamp(value, 0, BOARD - state.h, state.y);
    else if (key === "w") next.w = clamp(value, 0.25, BOARD - state.x, state.w);
    else if (key === "h") next.h = clamp(value, 0.25, BOARD - state.y, state.h);
    // Snap to a quarter of a square to keep the displayed numbers tidy.
    for (const k of ["x", "y", "w", "h"]) next[k] = Math.round(next[k] * 4) / 4;
    return next;
  }

  function move(state, dx, dy) {
    return set(set(state, "x", state.x + dx), "y", state.y + dy);
  }

  /** Put the centre exactly on a vertical grid line (no quarter snapping). */
  function centerX(state) {
    const x = Math.round(state.x + state.w / 2) - state.w / 2;
    return { ...state, x: Math.max(0, Math.min(BOARD - state.w, x)) };
  }

  function analyze(rect) {
    const a = areas(rect);
    return {
      ...rect,
      ...a,
      evenWidth: evenSide(rect.w),
      evenHeight: evenSide(rect.h),
      centered: centerOnGridLine(rect),
      ruleBalanced: balancedByRule(rect),
      pieces: decompose(rect),
    };
  }

  return { BOARD, EPS, start, areas, evenSide, centerOnGridLine, balancedByRule, decompose, set, move, centerX, analyze };
})();
