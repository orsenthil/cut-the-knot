"use strict";

/*
 * A Faulty Dissection: Alexander Bogomolny's applet FibonacciCheat.
 *
 * An 8 x 8 square (64 cells) is cut into four pieces: two right triangles with legs 8 and 3,
 * and two right trapezoids of height 5 with parallel sides 5 and 3. Put together as a
 * rectangle 5 wide and 13 tall they seem to make 65 cells. The numbers 3, 5, 8, 13 are
 * Fibonacci numbers, and 13 x 5 - 8 x 8 = 1 is Cassini's identity; the slopes of the cuts
 * (3/8 and 2/5) are not quite equal, so the pieces do not fit: a sliver of area exactly 1 is
 * left along the diagonal. The applet blurs it by squeezing the pieces slightly when they
 * snap into place (the leg 3 of the triangles and the side 3 of the trapezoids become
 * 40/13 = 3.077). Here, as in the applet, the pieces start as they are cut and are stored
 * with an adjusted final shape; a "honest" switch shows the true pieces in the rectangle.
 *
 * From the bytecode (FibonacciCheatCanvas.Reset, FN = 5, so 8, 5, 3 and 13):
 *   triangle 1  (0,0) (8,0) (8,3)            turns a quarter turn to (5,0) (5,8) (5-k,8)
 *   triangle 2  (0,0) (0,3) (8,3)            turns a quarter turn to (0,13) (0,5) (k,5)
 *   trapezoid 3 (0,3) (0,8) (3,8) (5,3)      moves to (0,0) (0,5) (k,5) (5,0)
 *   trapezoid 4 (5,3) (3,8) (8,8) (8,3)      moves to (5-k,8) (5,8) (5,13) (0,13)
 * with k = 40/13. A piece counts as in place when its middle is within 20 pixels of where it
 * belongs (the applet's snap), here 0.8 cell. "Animate" moves all four in 50 steps.
 * Cells: the square is at (0, 2.5) to (8, 10.5), the rectangle at (9, 0) to (14, 13).
 */
const FibonacciCheatCore = (() => {
  const K = 40 / 13;
  const SQUARE = { x: 0, y: 2.5 };
  const RECT = { x: 9, y: 0, w: 5, h: 13 };
  const WORLD = { w: 14, h: 13 };
  const SNAP = 0.8;
  const STEPS = 50;

  const shift = (poly, dx, dy) => poly.map(([x, y]) => [x + dx, y + dy]);
  const PIECES = [
    { id: 0, name: "triangle 1", turns: true, start: [[0, 0], [8, 0], [8, 3]], exact: [[5, 0], [5, 8], [2, 8]], adjusted: [[5, 0], [5, 8], [5 - K, 8]] },
    { id: 1, name: "triangle 2", turns: true, start: [[0, 0], [0, 3], [8, 3]], exact: [[0, 13], [0, 5], [3, 5]], adjusted: [[0, 13], [0, 5], [K, 5]] },
    { id: 2, name: "trapezoid 3", turns: false, start: [[0, 3], [0, 8], [3, 8], [5, 3]], exact: [[0, 0], [0, 5], [3, 5], [5, 0]], adjusted: [[0, 0], [0, 5], [K, 5], [5, 0]] },
    { id: 3, name: "trapezoid 4", turns: false, start: [[5, 3], [3, 8], [8, 8], [8, 3]], exact: [[2, 8], [5, 8], [5, 13], [0, 13]], adjusted: [[5 - K, 8], [5, 8], [5, 13], [0, 13]] },
  ].map((p) => ({ ...p, startW: shift(p.start, SQUARE.x, SQUARE.y), exactW: shift(p.exact, RECT.x, RECT.y), adjustedW: shift(p.adjusted, RECT.x, RECT.y) }));

  const area = (p) => Math.abs(p.reduce((s, q, i) => s + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0)) / 2;
  /** The middle (average of the corners) of a polygon, the point the applet's pieces turn about. */
  const middle = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

  /** The rotation of the start shape that gives the final orientation: a quarter turn (x, y) -> (-y, x) for the triangles. */
  const turn = (poly, c, t) => {
    const a = (Math.PI / 2) * t, cos = Math.cos(a), sin = Math.sin(a);
    return poly.map(([x, y]) => [c[0] + (x - c[0]) * cos - (y - c[1]) * sin, c[1] + (x - c[0]) * sin + (y - c[1]) * cos]);
  };

  /** A new position: every piece in the square. Option honest shows the true pieces in the rectangle. */
  function start(options) {
    const o = options || {};
    return { honest: !!o.honest, pieces: PIECES.map((p) => ({ id: p.id, f: 0, placed: false })), moves: 0, explored: false };
  }

  /**
   * Where piece `piece` is drawn: placed pieces in their final shape (adjusted, or true when honest);
   * others by their progress f from the start (0) towards the goal (1), the triangles turning a quarter turn
   * as they go, the middle moving in a straight line from its start to its goal. `at` overrides the middle.
   */
  function shapeOf(state, id) {
    const def = PIECES[id], pc = state.pieces[id];
    const fin = state.honest ? def.exactW : def.adjustedW;
    if (pc.placed) return fin;
    const c0 = middle(def.startW), c1 = middle(def.adjustedW);
    const c = pc.at || [c0[0] + (c1[0] - c0[0]) * pc.f, c0[1] + (c1[1] - c0[1]) * pc.f];
    const base = def.turns ? turn(def.startW, c0, pc.f) : def.startW;
    const mid = middle(base);
    return shift(base, c[0] - mid[0], c[1] - mid[1]);
  }

  /** How far (0..1) a point is along the way from the piece's start to its goal, for the turning of the triangles. */
  function progress(id, x, y) {
    const def = PIECES[id], c0 = middle(def.startW), c1 = middle(def.adjustedW);
    const total = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
    return Math.max(0, Math.min(1, 1 - Math.hypot(c1[0] - x, c1[1] - y) / total));
  }

  const place = (s, id) => ({ ...s, pieces: s.pieces.map((p) => (p.id === id ? { id, f: 1, placed: true } : p)) });

  /**
   * Moves: {type:"drag", id, x, y}: put the middle of piece `id` at (x, y) in cells (it snaps into the rectangle within 0.8
   * cell of its place, and a placed piece that is dragged away comes loose); {type:"place", id}; {type:"unplace", id};
   * {type:"toward", f}: every piece at fraction f of the way (the page's Animate); {type:"honest", value}; {type:"reset"}.
   */
  function move(s, m) {
    if (!m) return null;
    const full = (t) => (t.pieces.every((p) => p.placed) ? { ...t, explored: true } : t);
    if (m.type === "drag") {
      if (!(m.id >= 0 && m.id < 4) || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return null;
      const x = Math.max(0, Math.min(WORLD.w, m.x)), y = Math.max(0, Math.min(WORLD.h, m.y));
      const c1 = middle(PIECES[m.id].adjustedW);
      if (Math.hypot(c1[0] - x, c1[1] - y) <= SNAP) return full({ ...place(s, m.id), moves: s.moves + 1 });
      return { ...s, pieces: s.pieces.map((p) => (p.id === m.id ? { id: m.id, f: progress(m.id, x, y), placed: false, at: [x, y] } : p)), moves: s.moves + 1 };
    }
    if (m.type === "place") { if (!(m.id >= 0 && m.id < 4)) return null; return full({ ...place(s, m.id), moves: s.moves + 1 }); }
    if (m.type === "unplace") { if (!(m.id >= 0 && m.id < 4)) return null; return { ...s, pieces: s.pieces.map((p) => (p.id === m.id ? { id: m.id, f: 0, placed: false } : p)), moves: s.moves + 1 }; }
    if (m.type === "toward") {
      const f = Math.max(0, Math.min(1, Number(m.f)));
      if (!Number.isFinite(f)) return null;
      return full({ ...s, pieces: PIECES.map((p) => ({ id: p.id, f, placed: f >= 1 })), moves: s.moves + 1 });
    }
    if (m.type === "honest") return { ...s, honest: !!m.value };
    if (m.type === "reset") return start({ honest: s.honest });
    return null;
  }

  const legalMoves = (s) => s.pieces.map((p) => ({ type: p.placed ? "unplace" : "place", id: p.id }));
  const result = (s) => (s.explored ? "done" : null);

  return { K, SQUARE, RECT, WORLD, SNAP, STEPS, PIECES, area, middle, turn, start, shapeOf, progress, move, legalMoves, result };
})();
