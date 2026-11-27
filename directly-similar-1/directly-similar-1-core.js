"use strict";

/*
 * Directly Similar 1, from Alexander Bogomolny's applet DirectlySimilar1.
 *
 * The applet shows two squares, each given by two opposite corners, and one
 * extra point P. From them it builds a third square: if the two given squares
 * are written as c + i^k*d and c' + i^k*e (k = 0,1,2,3), then the translated
 * corners are (P + c' - c) + i^k*(e - d), which has the same form. That is the
 * page's claim A1 = P + AA', B1 = P + BB' and so on. This file is only that
 * geometry: no document, no window, no storage. It defines one global,
 * DirectlySimilar1Core, so the page and porting/check-directly-similar-1.mjs
 * can both load the same rules.
 *
 * The position is plain data: five points. Points 0 and 1 are opposite
 * corners of the first (primed) square, points 2 and 3 those of the second,
 * and point 4 is P. The screen y axis points down, so the quarter turn below
 * is the applet's own (dx,dy) -> (dy,-dx).
 */
const DirectlySimilar1Core = (() => {
  /** The old applet was embedded at 500 by 500 pixels on its cut-the-knot page. */
  const WIDTH = 500;
  const HEIGHT = 500;
  const NAMES = ["A'", "C'", "A", "C", "P"];

  /* Java's integer division truncates toward zero; sizes here are positive. */
  const div = (a, b) => Math.trunc(a / b);

  /** GetSquare(DoubPoint,DoubPoint) from DirectlySimilar1Canvas, literally. */
  function square(a, b) {
    const m = { x: (a.x + b.x) / 2.0, y: (a.y + b.y) / 2.0 };
    const out = new Array(4);
    out[0] = { x: a.x, y: a.y };
    out[1] = { x: m.x + (a.y - m.y), y: m.y + (m.x - a.x) };
    out[2] = { x: b.x, y: b.y };
    out[3] = { x: m.x - (a.y - m.y), y: m.y + (a.x - m.x) };
    return out;
  }

  /**
   * init() from the bytecode, with integer arithmetic in the same order.
   * Accepts other canvas sizes so the test can cover the whole layout method.
   */
  function start(options) {
    const w = Math.trunc(options && options.width !== undefined ? options.width : WIDTH);
    const h = Math.trunc(options && options.height !== undefined ? options.height : HEIGHT);
    const w3 = div(w, 3);
    const h2 = div(h, 2);
    let s = div(Math.min(w, h), 4);
    const points = [
      { x: w3 - div(s, 2), y: h2 - div(s, 2) },
      { x: w3 + div(s, 2), y: h2 + div(s, 2) },
    ];
    s = div(s, 2);
    points.push({ x: w3 + div(s, 2), y: h2 - div(s, 2) });
    points.push({ x: w3 - div(s, 2), y: h2 + div(s, 2) });
    points.push({ x: div(3 * w, 4), y: h2 });
    return { width: w, height: h, points };
  }

  /** A copy of the position with point `index` moved; no other point changes. */
  function movePoint(state, index, p) {
    if (!Number.isInteger(index) || index < 0 || index >= state.points.length) return state;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    const points = state.points.map((q) => ({ x: q.x, y: q.y }));
    points[index] = { x: p.x, y: p.y };
    return { width: state.width, height: state.height, points };
  }

  /**
   * The two given squares and the translated square, in the applet's order.
   * `first` is points 0,1 (A'B'C'D'), `second` is points 2,3 (ABCD), and
   * `third` is P + first[k] - second[k], the applet's TranslateLines array.
   */
  function figures(state) {
    const p = state.points;
    const first = square(p[0], p[1]);
    const second = square(p[2], p[3]);
    const third = first.map((q, k) => ({
      x: p[4].x + q.x - second[k].x,
      y: p[4].y + q.y - second[k].y,
    }));
    return { first, second, third };
  }

  /** The four translated corners A1,B1,C1,D1, as on the page. */
  function translated(state) {
    return figures(state).third;
  }

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /** Side lengths and the largest departure of a corner from a right angle. */
  function squareInfo(pts) {
    const lengths = [0, 1, 2, 3].map((k) => distance(pts[k], pts[(k + 1) % 4]));
    const mean = lengths.reduce((a, b) => a + b, 0) / 4;
    const spread = lengths.reduce((a, b) => a + Math.abs(b - mean), 0);
    let angleError = 0;
    for (let k = 0; k < 4; k++) {
      const prev = pts[(k + 3) % 4], here = pts[k], next = pts[(k + 1) % 4];
      const u = { x: prev.x - here.x, y: prev.y - here.y };
      const v = { x: next.x - here.x, y: next.y - here.y };
      const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
      const cos = nu && nv ? Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (nu * nv))) : 1;
      angleError = Math.max(angleError, Math.abs(Math.acos(cos) - Math.PI / 2) * 180 / Math.PI);
    }
    return { side: mean, spread, angleError };
  }

  /** True for a genuine square given in cyclic order, within a small tolerance. */
  function isSquare(pts, eps) {
    if (!pts || pts.length !== 4) return false;
    const tol = eps === undefined ? 1e-7 : eps;
    const info = squareInfo(pts);
    return info.side > tol && info.spread <= tol && info.angleError <= tol * 1000;
  }

  /** The sentence under the board, with the measured side and corner error. */
  function describe(state) {
    const f = figures(state);
    const info = squareInfo(f.third);
    return `A1B1C1D1 is a square: four sides about ${info.side.toFixed(1)} long, with corners off by at most ${info.angleError.toFixed(2)} degrees. Drag a dot to try another pair.`;
  }

  /** An illustration has no win, loss or end: it just has a starting picture. */
  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, NAMES,
    start, movePoint, square, figures, translated,
    squareInfo, isSquare, describe, result,
  };
})();
