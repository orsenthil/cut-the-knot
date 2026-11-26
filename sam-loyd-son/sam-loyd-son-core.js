"use strict";

/*
 * Sam Loyd's Son's Dissection, from Alexander Bogomolny's applet SamLoydSon.
 *
 * The 8 x 8 square of the famous 64 = 65 trick is cut into the same four
 * pieces (two right triangles with legs 8 and 3, two right trapezoids with
 * parallel sides 5 and 3 and height 5), but they are put together into a
 * different figure: a 5 x 5 block, a row of 13 and another 5 x 5 block,
 * which looks like 25 + 13 + 25 = 63 cells. The pieces cannot both cover 64
 * cells and fit 63: the slanted cuts have slopes 3/8 and 2/5, which differ a
 * little, so along the long diagonal the pieces overlap by exactly one cell
 * of area.
 *
 * The idea the code relies on: the sizes are consecutive Fibonacci numbers
 * F(n-2), F(n-1), F(n), F(n+1) (3, 5, 8, 13 for the applet's n = 5), and
 * Cassini's identity makes the figure's area differ from the square's by
 * exactly 1 for every n, an overlap for odd n and a gap for even n.
 *
 * From the bytecode (SamLoydSonCanvas.Reset), with a = F(n-2), b = F(n-1),
 * c = F(n), d = F(n+1), square cells from its top left corner, figure cells
 * from the top left corner of its bounding box (d wide, c + a tall):
 *   triangle 1   (0,0) (c,0) (c,a)          moves to (b+X,b) (d,b) (d,b+a)
 *   triangle 2   (0,0) (0,a) (c,a)          moves to (0,a) (0,2a) (c-X,2a)
 *   trapezoid 3  (0,a) (b,a) (a,c) (0,c)    turns to (d,c+a) (c,c+a) (c,2a+Y) (d,c)
 *   trapezoid 4  (b,a) (c,a) (c,c) (a,c)    turns to (0,a) (0,0) (b,0) (b,b-Y)
 * The trapezoids make a quarter turn. X and Y are 0 unless "Cheat" is on;
 * then X = c - a*d/b and Y = F(n-3) - b*b/d, the applet's nudges of one
 * corner of each piece that hide the overlap. Fibonacci.GetNum counts
 * 1, 1, 2, 3, 5, 8, ... from 0, and n runs from 3 to 10.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SamLoydSonCore. The position is plain data.
 */
const SamLoydSonCore = (() => {
  const MIN_N = 3;
  const MAX_N = 10;
  const DEFAULT_N = 5;
  const SNAP = 0.8;      // cells: a dragged piece snaps in this close to its place
  const STEPS = 50;      // NSteps: frames per piece when animating
  const GAP = 1;         // cells between the square and the figure

  /** Fibonacci.GetNum: 1, 1, 2, 3, 5, 8, ... */
  function fib(k) {
    let a = 1, b = 1;
    for (let i = 0; i < k; i++) [a, b] = [b, a + b];
    return a;
  }

  /** The sizes for n, and the layout in cells. */
  function sizes(n) {
    const a = fib(n - 2), b = fib(n - 1), c = fib(n), d = fib(n + 1), e = fib(n - 3);
    const w = c + GAP + d, h = Math.max(c, c + a);
    return {
      n, a, b, c, d, e,
      cheatX: -(a * d / b - c),   // the applet's L13 / A
      cheatY: -(b * b / d - e),   // the applet's L15 / A
      square: { x: 0, y: (h - c) / 2 },
      figure: { x: c + GAP, y: (h - (c + a)) / 2, w: d, h: c + a },
      world: { w, h },
    };
  }

  const shift = (poly, dx, dy) => poly.map(([x, y]) => [x + dx, y + dy]);

  /** The four pieces for n: start in the square, final place in the figure. */
  function pieces(n, cheat) {
    const S = sizes(n);
    const { a, b, c, d } = S;
    const X = cheat ? S.cheatX : 0, Y = cheat ? S.cheatY : 0;
    const defs = [
      { id: 0, name: "top triangle", turns: false,
        start: [[0, 0], [c, 0], [c, a]], fin: [[b + X, b], [d, b], [d, b + a]] },
      { id: 1, name: "second triangle", turns: false,
        start: [[0, 0], [0, a], [c, a]], fin: [[0, a], [0, 2 * a], [c - X, 2 * a]] },
      { id: 2, name: "left trapezoid", turns: true,
        start: [[0, a], [b, a], [a, c], [0, c]], fin: [[d, c + a], [c, c + a], [c, 2 * a + Y], [d, c]] },
      { id: 3, name: "right trapezoid", turns: true,
        start: [[b, a], [c, a], [c, c], [a, c]], fin: [[0, a], [0, 0], [b, 0], [b, b - Y]] },
    ];
    return defs.map((p) => ({
      ...p,
      startW: shift(p.start, S.square.x, S.square.y),
      finW: shift(p.fin, S.figure.x, S.figure.y),
    }));
  }

  /** The figure the pieces seem to make: a b x b block, a band d wide, another block. */
  function figure(n) {
    const { a, b, c, d } = sizes(n);
    return [[0, 0], [b, 0], [b, b], [d, b], [d, c + a], [c, c + a], [c, 2 * a], [0, 2 * a]];
  }

  const area = (p) => Math.abs(p.reduce((s, q, i) => s + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0)) / 2;
  /** GeoSDoub.Barycenter: the average of the corners. */
  const middle = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

  /** Turning by f quarter turns the applet's way, -pi/2: (x, y) -> (y, -x) at f = 1, y pointing down. */
  function turn(poly, centre, f) {
    const t = -Math.PI / 2 * f, cos = Math.cos(t), sin = Math.sin(t);
    return poly.map(([x, y]) => {
      const dx = x - centre[0], dy = y - centre[1];
      return [centre[0] + dx * cos - dy * sin, centre[1] + dx * sin + dy * cos];
    });
  }

  function start(options = {}) {
    const n = Math.max(MIN_N, Math.min(MAX_N, Math.round(Number(options.n) || DEFAULT_N)));
    return { n, cheat: !!options.cheat, pieces: [0, 1, 2, 3].map((id) => ({ id, f: 0, placed: false })), moves: 0, explored: false };
  }

  /** Where piece id is drawn now. */
  function shapeOf(state, id) {
    const def = pieces(state.n, state.cheat)[id];
    const pc = state.pieces[id];
    if (pc.placed) return def.finW;
    const c0 = middle(def.startW), c1 = middle(def.finW);
    const c = pc.at || [c0[0] + (c1[0] - c0[0]) * pc.f, c0[1] + (c1[1] - c0[1]) * pc.f];
    const base = def.turns ? turn(def.startW, c0, pc.f) : def.startW;
    const mid = middle(base);
    return shift(base, c[0] - mid[0], c[1] - mid[1]);
  }

  /** How far (0..1) a point is on the way from the piece's start to its place, for the turning. */
  function progress(state, id, x, y) {
    const def = pieces(state.n, state.cheat)[id];
    const c0 = middle(def.startW), c1 = middle(def.finW);
    const total = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
    return Math.max(0, Math.min(1, 1 - Math.hypot(c1[0] - x, c1[1] - y) / total));
  }

  const setPiece = (s, id, p) => ({ ...s, pieces: s.pieces.map((q) => (q.id === id ? { id, ...p } : q)), moves: s.moves + 1 });
  const full = (s) => (s.pieces.every((p) => p.placed) ? { ...s, explored: true } : s);

  /**
   * Moves: {type:"drag", id, x, y} (middle of a piece to (x, y) in cells; it
   * snaps in near its place), {type:"place", id}, {type:"unplace", id},
   * {type:"toward", id, f} (one piece a fraction f of the way: Animate moves
   * the pieces one after another), {type:"cheat", value}, {type:"n", value}
   * and {type:"reset"}. Cheat and n start again, as in the applet.
   */
  function move(s, m) {
    if (!m) return null;
    const okId = (id) => Number.isInteger(id) && id >= 0 && id < 4;
    if (m.type === "drag") {
      if (!okId(m.id) || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return null;
      const W = sizes(s.n).world;
      const x = Math.max(0, Math.min(W.w, m.x)), y = Math.max(0, Math.min(W.h, m.y));
      const c1 = middle(pieces(s.n, s.cheat)[m.id].finW);
      if (Math.hypot(c1[0] - x, c1[1] - y) <= SNAP) return full(setPiece(s, m.id, { f: 1, placed: true }));
      return setPiece(s, m.id, { f: progress(s, m.id, x, y), placed: false, at: [x, y] });
    }
    if (m.type === "place") return okId(m.id) ? full(setPiece(s, m.id, { f: 1, placed: true })) : null;
    if (m.type === "unplace") return okId(m.id) ? setPiece(s, m.id, { f: 0, placed: false }) : null;
    if (m.type === "toward") {
      const f = Number(m.f);
      if (!okId(m.id) || !Number.isFinite(f)) return null;
      const g = Math.max(0, Math.min(1, f));
      return full(setPiece(s, m.id, { f: g, placed: g >= 1 }));
    }
    if (m.type === "cheat") return start({ n: s.n, cheat: !!m.value });
    if (m.type === "n") {
      const v = Math.round(Number(m.value));
      if (!Number.isFinite(v) || v < MIN_N || v > MAX_N) return null;
      return start({ n: v, cheat: s.cheat });
    }
    if (m.type === "reset") return start({ n: s.n, cheat: s.cheat });
    return null;
  }

  const legalMoves = (s) => s.pieces.map((p) => ({ type: p.placed ? "unplace" : "place", id: p.id }));
  const result = (s) => (s.explored ? "done" : null);

  /** The count the page is about: the square's cells, and the figure's. */
  function counts(n) {
    const { c } = sizes(n);
    return { square: c * c, figure: area(figure(n)) };
  }

  return {
    MIN_N, MAX_N, DEFAULT_N, SNAP, STEPS,
    fib, sizes, pieces, figure, area, middle, turn, start, shapeOf, progress, move, legalMoves, result, counts,
  };
})();
