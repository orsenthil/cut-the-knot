"use strict";

/*
 * Curry's Paradox — the logic behind Alexander Bogomolny's applet "CurryParadox"
 * (cut-the-knot.org/Curriculum/Fallacies/CurryParadox.shtml).
 *
 * A right triangle with legs F(n+1) and F(n-1) (Fibonacci numbers) seems to hold
 * two smaller right triangles and a rectangle F(n-1) x F(n-2). Swap the two small
 * triangles and the leftover rectangle becomes F(n) x F(n-3), whose area is one
 * square different: for n = 6, a 5 x 3 = 15 rectangle becomes 8 x 2 = 16. The
 * trick: the three "hypotenuses" have slightly different slopes, so the figure is
 * not a triangle and the slivers between the pieces add or remove half a square.
 *
 * The applet's own indexing: Fibonacci.GetNum(k) is 1, 1, 2, 3, 5, 8, 13, 21, ...
 * from k = 0 (so GetNum(k) is the standard F(k+1)); its control FN (3 to 10,
 * opening 5) gives the lengths
 *     S3 = GetNum(FN)   (8)   S4 = GetNum(FN-1) (5)   S5 = GetNum(FN-2) (3)
 *     S6 = GetNum(FN-3) (2)   S7 = GetNum(FN+1) (13)
 * so the big triangle has legs S7 and S4 (13 and 5) and FN is the page's n minus 1.
 * In the first box the two triangles sit at the top right (S4 x S6) and the bottom
 * left (S3 x S5), with the rectangle S4 x S5 between them; in the second box they
 * are swapped and the leftover rectangle is S3 x S6. A piece counts as in place
 * when it is within 20 pixels of its final position (the applet's BetterMoveablePoly
 * minDist, with the board scaled to A = floor(390 / S7) pixels a cell), and it is
 * then drawn there. With FN = 5 the rectangle can also be cut into two shapes
 * (four pieces), leaving a one-square hole either inside or on the perimeter.
 *
 * Positions are in cells. The first box has its top left corner at (0, 0), the
 * second directly below it (this port's layout). No document, no window, no
 * storage; the position is plain data.
 */
const CurryParadoxCore = (() => {
  const MIN_FN = 3; // the applet's spinner range
  const MAX_FN = 10;
  const START_FN = 5;
  const PIXELS = 390; // min(W - 40, H - 70) for the page's 640 x 460 applet
  const SNAP_PIXELS = 20; // minDist per vertex

  const GET = [1, 1];
  /** Fibonacci.GetNum: 1, 1, 2, 3, 5, 8, 13, ... */
  function getNum(k) {
    while (GET.length <= k) GET.push(GET[GET.length - 1] + GET[GET.length - 2]);
    return GET[k];
  }
  /** The standard Fibonacci number F(k), F(1) = F(2) = 1, for any integer k (also negative). */
  function fib(k) {
    if (k >= 0) return k === 0 ? 0 : getNum(k - 1);
    return (k % 2 === 0 ? -1 : 1) * fib(-k);
  }

  const clampFn = (v) => Math.max(MIN_FN, Math.min(MAX_FN, Math.trunc(v)));

  /** The lengths for FN. */
  function lengths(fn) {
    const S3 = getNum(fn), S4 = getNum(fn - 1), S5 = getNum(fn - 2), S6 = getNum(fn - 3), S7 = getNum(fn + 1);
    return { S3, S4, S5, S6, S7, A: Math.floor(PIXELS / S7) };
  }

  /**
   * The pieces for FN, in cells. Each piece has its start vertices (in the first box) and the
   * vertices it should reach in the second box; the second box is `gap` cells below the first.
   */
  function geometry(fn, four, inner) {
    const { S3, S4, S5, S6, S7, A } = lengths(fn);
    const gap = S4 + 2; // this port's layout: the second box below the first
    const off = { x: 0, y: gap };
    const shift = (verts, dx, dy) => verts.map(([x, y]) => [x + off.x + dx, y + off.y + dy]);
    const p1 = [[S3 + S4, 0], [S3 + S4, S6], [S3, S6]]; // the small triangle at the top right
    const p2 = [[S3, S4 - S5], [S3, S4], [0, S4]]; // the larger one at the bottom left
    const pieces = [
      { name: "small triangle", verts: p1, final: shift(p1, -S3, S5), colour: "orange" },
      { name: "large triangle", verts: p2, final: shift(p2, S4, -S6), colour: "green" },
    ];
    if (four) {
      // FN = 5: GetNum(1) = GetNum(0) = 1; the 5 x 3 rectangle cut into two shapes.
      const a = inner ? S5 : S6;
      const p3 = [[S3, S6], [S3 + S4, S6], [S3 + S4, S6 + 1], [S3 + a, S6 + 1], [S3 + a, S6 + S6], [S3, S6 + S6]];
      const y4 = S4 - 1;
      const p4 = [[S3, y4], [S3 + a, y4], [S3 + a, y4 - 1], [S3 + S4, y4 - 1], [S3 + S4, y4 + 1], [S3, y4 + 1]];
      pieces.push({ name: "upper shape", verts: p3, final: shift(p3, S4 - S3, 1), colour: "pink" });
      pieces.push({ name: "lower shape", verts: p4, final: shift(p4, 0, 0), colour: "blue" });
    }
    return {
      fn, A, lengths: { S3, S4, S5, S6, S7 },
      width: S7, height: S4, gap, off,
      pieces,
      leftRect: { x: S3, y: S6, w: S4, h: S5 }, // the leftover rectangle in the first box
      rightRect: { x: off.x + S4, y: off.y + S5, w: S3, h: S6 }, // and in the second
      snap: SNAP_PIXELS / A, // how close, in cells, a piece must be to snap
    };
  }

  /** A new position: the pieces in the first box. */
  function start(options) {
    const o = options || {};
    const fn = Number.isFinite(Number(o.fn)) ? clampFn(Number(o.fn)) : START_FN;
    const four = o.four === true && fn === START_FN;
    const inner = o.inner !== false;
    const g = geometry(fn, four, inner);
    return { fn, four, inner, offsets: g.pieces.map(() => ({ dx: 0, dy: 0 })), moves: 0, explored: false };
  }

  /** The offset that puts piece i in its final place. */
  function finalOffset(state, i) {
    const p = geometry(state.fn, state.four, state.inner).pieces[i];
    return { dx: p.final[0][0] - p.verts[0][0], dy: p.final[0][1] - p.verts[0][1] };
  }

  /** Is piece i in place (within 20 pixels of its final position)? */
  function inPlace(state, i) {
    const f = finalOffset(state, i);
    const o = state.offsets[i];
    const g = geometry(state.fn, state.four, state.inner);
    return Math.hypot(o.dx - f.dx, o.dy - f.dy) < g.snap;
  }

  /** The vertices of piece i where it is now (drawn at its final place once it is in). */
  function vertices(state, i) {
    const g = geometry(state.fn, state.four, state.inner);
    const p = g.pieces[i];
    if (inPlace(state, i)) return p.final.map((v) => v.slice());
    const o = state.offsets[i];
    return p.verts.map(([x, y]) => [x + o.dx, y + o.dy]);
  }

  const allIn = (state) => state.offsets.every((_, i) => inPlace(state, i));

  /** The moves: drag a piece to an offset, send it home, change a setting, start over. */
  function legalMoves(state) {
    const moves = state.offsets.map((_, i) => ({ type: "drag", piece: i, dx: 0, dy: 0 }));
    moves.push({ type: "place", piece: 0 }, { type: "fn", value: START_FN }, { type: "pieces", value: 2 }, { type: "hole", value: "inside" }, { type: "reset" });
    return moves;
  }

  /** The position after a move, or null if it is not allowed. */
  function move(state, m) {
    if (!m) return null;
    const g = geometry(state.fn, state.four, state.inner);
    const bounds = (i) => {
      // keep every piece wholly inside the picture: the two boxes plus a margin of two cells
      const xs = g.pieces[i].verts.map((v) => v[0]), ys = g.pieces[i].verts.map((v) => v[1]);
      const lo = { x: -2 - Math.min(...xs), y: -2 - Math.min(...ys) };
      const hi = { x: g.width + 2 - Math.max(...xs), y: 2 * g.height + 2 + 2 - Math.max(...ys) };
      return { lo, hi };
    };
    if (m.type === "drag") {
      if (!Number.isInteger(m.piece) || m.piece < 0 || m.piece >= state.offsets.length) return null;
      if (!Number.isFinite(Number(m.dx)) || !Number.isFinite(Number(m.dy))) return null;
      const b = bounds(m.piece);
      const offsets = state.offsets.map((o, i) => (i === m.piece ? { dx: Math.max(b.lo.x, Math.min(b.hi.x, Number(m.dx))), dy: Math.max(b.lo.y, Math.min(b.hi.y, Number(m.dy))) } : o));
      return { ...state, offsets, moves: state.moves + 1, explored: true };
    }
    if (m.type === "place") {
      if (!Number.isInteger(m.piece) || m.piece < 0 || m.piece >= state.offsets.length) return null;
      const f = finalOffset(state, m.piece);
      const offsets = state.offsets.map((o, i) => (i === m.piece ? f : o));
      return { ...state, offsets, moves: state.moves + 1, explored: true };
    }
    let next = null;
    if (m.type === "fn") {
      if (!Number.isFinite(Number(m.value))) return null;
      next = start({ fn: Number(m.value), four: state.four, inner: state.inner });
    } else if (m.type === "pieces") {
      if (m.value !== 2 && m.value !== 4) return null;
      if (m.value === 4 && state.fn !== START_FN) return null; // four pieces only for FN = 5, as in the applet
      next = start({ fn: state.fn, four: m.value === 4, inner: state.inner });
    } else if (m.type === "hole") {
      if (m.value !== "inside" && m.value !== "perimeter") return null;
      next = start({ fn: state.fn, four: state.four, inner: m.value === "inside" });
    } else if (m.type === "reset") {
      return start({ fn: state.fn, four: state.four, inner: state.inner });
    }
    if (!next) return null;
    return { ...next, moves: state.moves + 1, explored: true };
  }

  /** A demo: nothing to win; "done" when every piece is in place in the second box. */
  function result(state) {
    return state.explored && allIn(state) ? "done" : null;
  }

  /** Twice a polygon's area (shoelace, absolute): an integer for integer vertices. */
  function twiceArea(verts) {
    let s = 0;
    for (let i = 0; i < verts.length; i++) {
      const [x1, y1] = verts[i], [x2, y2] = verts[(i + 1) % verts.length];
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s);
  }

  /** The numbers behind the paradox for FN. */
  function facts(fn) {
    const { S3, S4, S5, S6, S7 } = lengths(fn);
    const n = fn + 1; // the page's n
    const bigTwice = S7 * S4; // twice the area of the legs S7 x S4 triangle
    const parts = (extra) => S3 * S5 + S4 * S6 + 2 * extra; // twice the two triangles plus twice the rectangle
    return {
      n, fn,
      legs: [S7, S4],
      rectangles: [{ w: S4, h: S5, area: S4 * S5 }, { w: S3, h: S6, area: S3 * S6 }],
      areaDifference: S3 * S6 - S4 * S5,
      bigTriangleTwiceArea: bigTwice,
      firstArrangementTwiceArea: parts(S4 * S5),
      secondArrangementTwiceArea: parts(S3 * S6),
      slopes: { big: S4 / S7, small: S6 / S4, large: S5 / S3 },
    };
  }

  return {
    MIN_FN, MAX_FN, START_FN, SNAP_PIXELS, PIXELS,
    getNum, fib, lengths, geometry, start, legalMoves, move, result, finalOffset, inPlace, vertices, allIn, twiceArea, facts,
  };
})();
