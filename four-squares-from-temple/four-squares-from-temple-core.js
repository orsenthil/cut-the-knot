"use strict";

/*
 * Four Squares From Temple, from Alexander Bogomolny's applet
 * FourSquaresFromTemple (Bottema Shatters Japan's Seclusion).
 *
 * Four squares share corners: AESX on AE, CHIY on CH, BEKH on the diagonal
 * BK, and KINS on the segment KI. Drag A, B or C; when A, B and C lie on one
 * line the big square's side is twice the small square's side. The port
 * follows the applet's Compute() method step for step: UpperCenter builds
 * the two Bottema points U and V, K is their midpoint, FormSquareOnDiagonal
 * builds BEKH from the diagonal BK, FormSquare builds the two outer squares,
 * and N is I + (S - K). The "on a line" test is the applet's own one-pixel
 * test, |A.y - B.y| < 1, after A and C have been tied together in y just as
 * UpgradePoints does while dragging.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global so the page and
 * porting/check-four-squares-from-temple.mjs can both use it. Positions are
 * plain objects and every function returns a new position.
 */
const FourSquaresFromTempleCore = (() => {
  // The page embeds both copies of the applet at 500 x 500 pixels.
  const VIEW = { width: 500, height: 500 };
  const HALF_PI = Math.PI / 2;
  const NAMES = ["A", "B", "C"];
  const OPTION_NAMES = ["names", "hint"];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  /** GeoSDoub.Rotate(p, q, a, dir): q turned about p, sign as in the bytecode. */
  function rotate(p, q, angle, dir) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return {
      x: p.x + c * (q.x - p.x) - dir * s * (q.y - p.y),
      y: p.y + dir * s * (q.x - p.x) + c * (q.y - p.y),
    };
  }

  /** Canvas.UpperCenter: centre of the square on pq that lies above pq. */
  function upperCenter(p, q) {
    const m = midpoint(p, q);
    const dy = q.y - m.y;
    const dx = m.x - q.x; // bytecode: -q.x + m.x, never -m.x + q.x
    return dx < 0 ? { x: m.x + dy, y: m.y + dx } : { x: m.x - dy, y: m.y - dx };
  }

  /** Canvas.FormSquare(p, q, r, s): r and s complete the square on side pq. */
  function formSquare(p, q) {
    return { r: rotate(p, q, HALF_PI, -1), s: rotate(q, p, HALF_PI, 1) };
  }

  /** Canvas.FormSquareOnDiagonal(p, q, r, s): q and p are opposite corners. */
  function formSquareOnDiagonal(p, q) {
    const m = midpoint(p, q);
    const dy = q.y - m.y;
    const dx = m.x - q.x;
    if (dy < 0) {
      return { r: { x: m.x + dy, y: m.y + dx }, s: { x: m.x - dy, y: m.y - dx } };
    }
    return { r: { x: m.x - dy, y: m.y - dx }, s: { x: m.x + dy, y: m.y + dx } };
  }

  /** Canvas.AssignABC: the left outer handle is A, the right one is C. */
  function assignABC(ap, cp) {
    if (ap.x < cp.x) return { A: ap, C: cp };
    if (cp.x < ap.x) return { A: cp, C: ap };
    return { A: ap, C: cp }; // equal x: the bytecode keeps Ap as A
  }

  function clampPoint(p) {
    return {
      x: clamp(Number(p && p.x) || 0, 0, VIEW.width),
      y: clamp(Number(p && p.y) || 0, 0, VIEW.height),
    };
  }

  /** Canvas.init(): 2.5 and 3 board-widths/tenths, and a raised B. */
  function start(options) {
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const wx = VIEW.width / 10, hy = VIEW.height / 6;
    const ap = { x: cx - 2.5 * wx, y: VIEW.height - hy };
    const b = { x: cx, y: ap.y - hy / 2 };
    const cp = { x: cx + 3 * wx, y: ap.y };
    return {
      A: ap, B: b, C: cp,
      options: Object.assign({ names: false, hint: false }, options || {}),
      explored: false,
    };
  }

  function legalMoves() {
    return NAMES.slice();
  }

  /**
   * Drag one outer handle or B. Canvas.UpgradePoints ties the other outer
   * handle's y to the one being dragged, so A and C always share a height.
   */
  function move(state, name, point) {
    if (!NAMES.includes(name)) return state;
    const p = clampPoint(point);
    const next = { A: state.A, B: state.B, C: state.C,
      options: state.options, explored: true };
    if (name === "A") {
      next.A = p;
      next.C = { x: state.C.x, y: p.y };
    } else if (name === "C") {
      next.C = p;
      next.A = { x: state.A.x, y: p.y };
    } else {
      next.B = p;
    }
    return next;
  }

  function setOption(state, name, value) {
    if (!OPTION_NAMES.includes(name)) return state;
    return {
      A: state.A, B: state.B, C: state.C,
      options: Object.assign({}, state.options, { [name]: Boolean(value) }),
      explored: true,
    };
  }

  /** Reset keeps the player's chosen Show options, like the applet's panel. */
  function reset(state) {
    return start(state.options);
  }

  /* There is no win and no loss: a demo counts as played once explored. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  /** Canvas.Compute(), in the bytecode's own order. */
  function geometry(state) {
    const pair = assignABC(state.A, state.C);
    const A = pair.A, B = state.B, C = pair.C;
    const U = upperCenter(A, B);
    const V = upperCenter(B, C);
    const K = midpoint(U, V);
    const bekh = formSquareOnDiagonal(B, K);
    const E = bekh.r, H = bekh.s;
    const aesx = formSquare(A, E);
    const X = aesx.r, S = aesx.s;
    const chiy = formSquare(H, C);
    const I = chiy.r, Y = chiy.s;
    const N = { x: I.x + S.x - K.x, y: I.y + S.y - K.y };
    const onLine = Math.abs(A.y - B.y) < 1; // the applet's one-pixel test
    return {
      A, B, C, U, V, K, E, H, X, S, I, Y, N,
      circle: { c: K, r: distance(K, U) },
      onLine,
    };
  }

  function describe(state) {
    const g = geometry(state);
    const small = distance(g.B, g.E), big = distance(g.K, g.I);
    if (g.onLine) {
      return "A, B and C are in a line. The blue square's side is " +
        (big / small).toFixed(2) + " times the gold square's side.";
    }
    return "A, B and C are not in a line yet. Move B, or move A or C, " +
      "until B sits on the pink line.";
  }

  return {
    VIEW, NAMES, OPTION_NAMES, start, legalMoves, move, setOption, reset,
    result, geometry, describe, clampPoint, distance, midpoint, rotate,
    upperCenter, formSquare, formSquareOnDiagonal, assignABC,
  };
})();
