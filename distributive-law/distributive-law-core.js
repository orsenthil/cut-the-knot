"use strict";

/*
 * The distributive law, from Alexander Bogomolny's applet DistributiveLaw.
 *
 * A board of NX columns by NY rows of squares stands for the product NY*NX. A
 * cut in a gap between two columns (or two rows) of a rectangle splits it into
 * two rectangles, and the written product becomes a sum: 4*5 becomes 4*2+4*3
 * (or (4*2+4*3) with parentheses). Cutting on until every piece is one square
 * writes the product as a sum of NX*NY ones. The one idea: a*(b+c) = a*b + a*c
 * because b+c objects in each of a groups are b in each plus c in each.
 *
 * The applet's own numbers: the board opens 5 wide and 4 high (reset(5, 4)),
 * and a rectangle prints as "height*width" or "1" for a single square. The
 * position is plain data: the board size, a tree of rectangles (cells, not
 * pixels), the list of expressions written so far and the parentheses switch.
 */
const DistributiveLawCore = (() => {
  const MIN_SIZE = 1;
  const MAX_SIZE = 12;

  const leaf = (x, y, w, h) => ({ x, y, w, h, first: null, second: null });

  /** A new position; `nx` columns by `ny` rows (the applet opens 5 by 4). */
  function start(options) {
    const o = options || {};
    const fit = (v, d) => (Number.isFinite(Number(v)) ? Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.trunc(Number(v)))) : d);
    const nx = fit(o.nx, 5), ny = fit(o.ny, 4);
    const s = { nx, ny, tree: leaf(0, 0, nx, ny), parentheses: !!o.parentheses, history: [], moves: 0, explored: false };
    s.history = [expression(s)];
    return s;
  }

  const clone = (t) => (t ? { x: t.x, y: t.y, w: t.w, h: t.h, first: clone(t.first), second: clone(t.second) } : null);

  /** The rectangles that are not cut any further, in reading order of the cuts. */
  function pieces(s) {
    const out = [];
    (function walk(t) { if (t.first) { walk(t.first); walk(t.second); } else out.push(t); })(s.tree);
    return out;
  }

  function simple(t) {
    return t.w === 1 && t.h === 1 ? "1" : t.h + "*" + t.w;
  }
  function text(t, par) {
    if (!t.first) return simple(t);
    const body = text(t.first, par) + "+" + text(t.second, par);
    return par ? "(" + body + ")" : body;
  }
  /** The whole product as the applet writes it (DistributiveLawElement.toString). */
  function expression(s) { return text(s.tree, s.parentheses); }

  /** The piece that holds cell (c, r), or null. */
  function pieceAt(s, c, r) {
    return pieces(s).find((p) => c >= p.x && c < p.x + p.w && r >= p.y && r < p.y + p.h) || null;
  }

  /** How many cuts are still needed to reach single squares (the applet's m_N). */
  const remaining = (s) => s.nx * s.ny - pieces(s).length;

  function replace(t, target, f) {
    if (t === target) return f(t);
    if (!t.first) return t;
    return { ...t, first: replace(t.first, target, f), second: replace(t.second, target, f) };
  }

  /**
   * Moves: {type:"cut", axis:"col"|"row", c, r}: cut the piece holding cell (c, r)
   * in the gap to the right of that cell (col) or below it (row), which must be
   * inside the piece. {type:"size", nx, ny}, {type:"parentheses", value}, {type:"reset"}.
   */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "cut") {
      const p = pieceAt(s, m.c, m.r);
      if (!p) return null;
      let a, b;
      if (m.axis === "col") {
        const k = m.c - p.x + 1; // columns in the first half
        if (k < 1 || k >= p.w) return null;
        a = leaf(p.x, p.y, k, p.h); b = leaf(p.x + k, p.y, p.w - k, p.h);
      } else if (m.axis === "row") {
        const k = m.r - p.y + 1;
        if (k < 1 || k >= p.h) return null;
        a = leaf(p.x, p.y, p.w, k); b = leaf(p.x, p.y + k, p.w, p.h - k);
      } else return null;
      const next = { ...s, tree: clone(s.tree), moves: s.moves + 1, history: s.history.slice() };
      const target = pieceAt(next, m.c, m.r);
      next.tree = replace(next.tree, target, (t) => ({ ...t, first: a, second: b }));
      next.history.unshift(expression(next));
      next.explored = true;
      return next;
    }
    if (m.type === "size") {
      const nx = Math.trunc(Number(m.nx)), ny = Math.trunc(Number(m.ny));
      if (!(nx >= MIN_SIZE && nx <= MAX_SIZE && ny >= MIN_SIZE && ny <= MAX_SIZE)) return null;
      return start({ nx, ny, parentheses: s.parentheses });
    }
    if (m.type === "parentheses") {
      const next = { ...s, parentheses: !!m.value, history: s.history.slice(), tree: clone(s.tree) };
      next.history[0] = expression(next);
      return next;
    }
    if (m.type === "reset") return start({ nx: s.nx, ny: s.ny, parentheses: s.parentheses });
    return null;
  }

  /** Every cut open in this position, as moves. */
  function legalMoves(s) {
    const out = [];
    for (const p of pieces(s)) {
      for (let c = p.x; c < p.x + p.w - 1; c++) out.push({ type: "cut", axis: "col", c, r: p.y });
      for (let r = p.y; r < p.y + p.h - 1; r++) out.push({ type: "cut", axis: "row", c: p.x, r });
    }
    return out;
  }

  /** "done" once every piece is a single square. */
  const result = (s) => (remaining(s) === 0 ? "done" : null);

  /** Evaluate an expression string (digits, *, +, parentheses) without eval, for the logic test. */
  function evaluate(str) {
    let i = 0;
    const sum = () => { let v = prod(); while (str[i] === "+") { i++; v += prod(); } return v; };
    const prod = () => { let v = atom(); while (str[i] === "*") { i++; v *= atom(); } return v; };
    const atom = () => {
      if (str[i] === "(") { i++; const v = sum(); i++; return v; }
      let j = i; while (/[0-9]/.test(str[i] || "")) i++; return Number(str.slice(j, i));
    };
    return sum();
  }

  return { MIN_SIZE, MAX_SIZE, start, pieces, pieceAt, expression, remaining, move, legalMoves, result, evaluate };
})();
