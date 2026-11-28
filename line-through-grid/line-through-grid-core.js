"use strict";

/*
 * Line Through Grid, from Alexander Bogomolny's applet LineThroughGrid.
 *
 * Draw an M-by-N rectangle on squared paper and its diagonal. The question on
 * the page is how many little squares the diagonal crosses; the answer is
 * S = M + N - gcd(M, N). Each interior grid line met adds one square, and a
 * diagonal that goes through a lattice point meets two lines at once, losing
 * one count for each such point (there are gcd(M, N) - 1 of them). This file
 * also holds a transcription of the applet's own Draw method, which paints a
 * cell when a small test segment lies inside the cell and away from both ends
 * of the diagonal: with the cell step larger than twice the applet's 0.1px
 * guard, that painting agrees with the formula, including the degenerate
 * one-row and one-column rectangles. Nothing here touches the page: no
 * document, no window, no storage. It defines one global, LineThroughGridCore.
 */
const LineThroughGridCore = (() => {
  /** The four spinners start at M = 6 and N = 11 (javap: M=6, N=11). */
  const M_DEFAULT = 6;
  const N_DEFAULT = 11;
  const MIN = 1;
  const MAX = 50;
  /** LineThroughGridPanel.AddSpin: setMinValue(1), setMaxValue(50), delta 1. */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dimension = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? clamp(Math.round(n), MIN, MAX) : fallback;
  };
  /** Java's integer division truncates towards zero. */
  const jdiv = (a, b) => Math.trunc(a / b);
  /** Java's Math.round(double), for the corners of the painted rectangles. */
  const jround = (x) => Math.floor(x + 0.5);

  function gcd(a, b) {
    let x = Math.abs(Math.trunc(a)), y = Math.abs(Math.trunc(b));
    while (y) { const t = x % y; x = y; y = t; }
    return x;
  }

  /** The position: just the two spinner values. Plain data for the tutor. */
  function start(options) {
    const o = options || {};
    return {
      M: dimension(o.M === undefined ? o.m : o.M, M_DEFAULT),
      N: dimension(o.N === undefined ? o.n : o.N, N_DEFAULT),
    };
  }

  /** A move sets one spinner; the applet clamps to 1..50 and rounds to an int. */
  function move(state, m) {
    if (!m || !m.type) return null;
    if (m.type !== "M" && m.type !== "N" && m.type !== "reset") return null;
    if (m.type === "reset") return start(m.options || {});
    return Object.assign({}, state, { [m.type]: dimension(m.value, state[m.type]) });
  }

  /** An illustration: there is no win, loss or finished state. */
  function result(state) {
    return null;
  }

  /** The page's general formula, with the coprime special case as a check. */
  function crossed(state) {
    const s = start(state);
    return s.M + s.N - gcd(s.M, s.N);
  }

  function coprimeFormula(state) {
    const s = start(state);
    return gcd(s.M, s.N) === 1 ? s.M + s.N - 1 : null;
  }

  function interiorNodes(state) {
    const s = start(state);
    return gcd(s.M, s.N) - 1;
  }

  /*
   * A direct count: a cell (column i, row j) is crossed when the open segment
   * of the diagonal inside it is non-empty, i.e. the two rectangles
   * [i*M,(i+1)*M] x [j*N,(j+1)*N] and [0,M] x [0,N] overlap in an interval of
   * positive length. This is independent of the page's formula and is the
   * brute-force oracle for it.
   */
  function crossedCells(state) {
    const s = start(state);
    const cells = [];
    for (let i = 0; i < s.N; i++) {
      for (let j = 0; j < s.M; j++) {
        const lo = Math.max(i * s.M, j * s.N);
        const hi = Math.min((i + 1) * s.M, (j + 1) * s.N);
        if (lo < hi) cells.push({ column: i, row: j });
      }
    }
    return cells;
  }

  /* ------------------------------------------------- the applet's own Draw */

  /* GeoSDoub.Dist(point, line) from a to b: the distance to the *infinite*
     line, with the applet's SqDist < 0.1 short circuit. */
  function distToLine(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy < 0.1) return 0;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    return Math.hypot(a.x - p.x + dx * t, a.y - p.y + dy * t);
  }

  function cross(a, b, p) {
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  }
  const EPS = 1e-9;
  function onSegment(a, b, p) {
    return Math.min(a.x, b.x) - EPS <= p.x && p.x <= Math.max(a.x, b.x) + EPS &&
      Math.min(a.y, b.y) - EPS <= p.y && p.y <= Math.max(a.y, b.y) + EPS;
  }
  /** Line2D.intersectsLine: strict straddling, plus collinear endpoint cases. */
  function segmentsIntersect(a, b, c, d) {
    const c1 = cross(a, b, c), c2 = cross(a, b, d);
    const c3 = cross(c, d, a), c4 = cross(c, d, b);
    const s = (v) => (Math.abs(v) <= EPS ? 0 : v < 0 ? 1 : 2);
    const o1 = s(c1), o2 = s(c2), o3 = s(c3), o4 = s(c4);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(a, b, c)) return true;
    if (o2 === 0 && onSegment(a, b, d)) return true;
    if (o3 === 0 && onSegment(c, d, a)) return true;
    if (o4 === 0 && onSegment(c, d, b)) return true;
    return false;
  }

  /*
   * LineThroughGridCanvas.Reset and Draw, transcribed literally:
   *   A = min((height-20)/M, (width-20)/N), integer division;
   *   Rect = [(width-A*N)/2, (height-A*M)/2, A*N, A*M];
   *   for each column i and row j, a cell is painted if the inner test segment
   *   meets the diagonal and both its ends are more than 0.1px from it; the
   *   painted rectangle starts at Math.round(Rect.x+A*i, Rect.y+A*j) and has
   *   sides A. Cell units are used here, so A is the guard-free board step.
   */
  function paintedCells(state, options) {
    const s = start(state);
    const o = options || {};
    const width = o.width === undefined ? 1000 : o.width;
    const height = o.height === undefined ? 900 : o.height;
    const A = Math.min(jdiv(height - 20, s.M), jdiv(width - 20, s.N));
    if (!(A > 0)) return null;
    const rw = A * s.N, rh = A * s.M;
    const rx = jdiv(width - rw, 2), ry = jdiv(height - rh, 2);
    const p0 = { x: rx, y: ry }, p1 = { x: rx + rw, y: ry + rh };
    const guard = 0.1;
    const cells = [];
    for (let i = 0; i < s.N; i++) {
      for (let j = 0; j < s.M; j++) {
        const t1 = { x: rx + A * (i + 1) + guard, y: ry + A * j - guard };
        const t2 = { x: rx + A * i - guard, y: ry + A * (j + 1) + guard };
        if (!segmentsIntersect(t1, t2, p0, p1)) continue;
        const corner1 = { x: rx + A * (i + 1), y: ry + A * j };
        const corner2 = { x: rx + A * i, y: ry + A * (j + 1) };
        if (distToLine(corner1, p0, p1) <= guard) continue;
        if (distToLine(corner2, p0, p1) <= guard) continue;
        cells.push({ column: i, row: j });
      }
    }
    return cells;
  }

  /** The saved position for the player's record and the tutor. */
  function position(state) {
    const s = start(state);
    return { M: s.M, N: s.N, crossed: crossed(s), gcd: gcd(s.M, s.N) };
  }

  return {
    MIN: MIN, MAX: MAX, M_DEFAULT: M_DEFAULT, N_DEFAULT: N_DEFAULT,
    start: start, move: move, result: result,
    crossed: crossed, coprimeFormula: coprimeFormula, interiorNodes: interiorNodes,
    crossedCells: crossedCells, gcd: gcd,
    paintedCells: paintedCells, distToLine: distToLine,
    segmentsIntersect: segmentsIntersect, position: position,
  };
})();
