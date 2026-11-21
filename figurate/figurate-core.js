"use strict";

/*
 * Identities in the multiplication table, from Alexander Bogomolny's applet Figurate.
 *
 * The applet draws the multiplication table 1..14 by 1..14 and, as the mouse moves over a cell,
 * lights up the cells of one of four identities:
 *   Triangular squares  the n by n corner, whose sum is (1 + 2 + ... + n)^2 = [n(n+1)/2]^2
 *   Cubes               the nth row and nth column together (a gnomon): 2n(1 + ... + n) - n^2 = n^3
 *   Squares             the diagonal up to n, entries 1^2, 2^2, ..., n^2: n(n+1)(2n+1)/6
 *   Tetrahedral numbers the anti-diagonal i + j = n + 1: n*1 + (n-1)*2 + ... + 1*n = n(n+1)(n+2)/6
 * (the page's identities (1) to (4)). Read off the bytecode: m_Max = 15, so the cells run from 1
 * to 14; GetHoverIndex gives n = max(column, row) for Triangular squares, Cubes and Squares, and
 * n = column + row - 1 for Tetrahedral numbers (a cell with n above 14 is not shown); the applet
 * opens on Triangular squares with nothing under the mouse. The position is plain data.
 */
const FigurateCore = (() => {
  const SIZE = 14;
  const MODES = ["triangular-squares", "cubes", "squares", "tetrahedral"];

  /** A new position: no cell under the pointer (n = 0). */
  function start(options) {
    const o = options || {};
    return { mode: MODES.includes(o.mode) ? o.mode : "triangular-squares", n: 0, moves: 0, explored: false };
  }

  /** The cells (column, row), both from 1, that mode lights up for n. */
  function cells(mode, n) {
    const out = [];
    if (!(n >= 1)) return out;
    if (mode === "triangular-squares") { for (let r = 1; r <= n; r++) for (let c = 1; c <= n; c++) out.push([c, r]); }
    else if (mode === "cubes") { for (let c = 1; c <= n; c++) out.push([c, n]); for (let r = 1; r < n; r++) out.push([n, r]); }
    else if (mode === "squares") { for (let k = 1; k <= n; k++) out.push([k, k]); }
    else if (mode === "tetrahedral") { for (let c = 1; c <= n; c++) out.push([c, n + 1 - c]); }
    return out;
  }

  const total = (list) => list.reduce((s, [c, r]) => s + c * r, 0);

  /** The identity for n: the sum of the lit cells and the formula the page gives. */
  function identity(mode, n) {
    const list = cells(mode, n);
    const sum = total(list);
    const formula = { "triangular-squares": (n * (n + 1)) / 2 * ((n * (n + 1)) / 2), cubes: n * n * n, squares: (n * (n + 1) * (2 * n + 1)) / 6, tetrahedral: (n * (n + 1) * (n + 2)) / 6 }[mode];
    const text = {
      "triangular-squares": `(1 + 2 + ... + ${n})² = [${n}·${n + 1}/2]² = ${(n * (n + 1)) / 2}² = ${formula}`,
      cubes: `2·${n}·(1 + ... + ${n}) − ${n}² = ${n}³ = ${formula}`,
      squares: `1² + 2² + ... + ${n}² = ${n}·${n + 1}·${2 * n + 1}/6 = ${formula}`,
      tetrahedral: `${n}·1 + ${n - 1}·2 + ... + 1·${n} = ${n}·(${n} + 1)·(${n} + 2)/6 = ${formula}`,
    }[mode];
    return { n, cells: list, sum, formula, text, holds: sum === formula };
  }

  /** The n the applet picks for a cell under the pointer (GetHoverIndex): 0 if there is none. */
  function hoverIndex(mode, col, row) {
    if (col < 1 || row < 1 || col > SIZE || row > SIZE) return 0;
    if (mode === "tetrahedral") { const n = col + row - 1; return n <= SIZE ? n : 0; }
    return Math.max(col, row);
  }

  /** Moves: {type:"hover", col, row}, {type:"n", value}, {type:"mode", value}, {type:"reset"}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "hover") return { ...s, n: hoverIndex(s.mode, m.col, m.row), moves: s.moves + 1, explored: s.explored || hoverIndex(s.mode, m.col, m.row) > 0 };
    if (m.type === "n") { const v = Math.trunc(Number(m.value)); if (!(v >= 0 && v <= SIZE)) return null; return { ...s, n: v, moves: s.moves + 1, explored: s.explored || v > 0 }; }
    if (m.type === "mode") { if (!MODES.includes(m.value)) return null; return { ...s, mode: m.value, moves: s.moves + 1 }; }
    if (m.type === "reset") return start({});
    return null;
  }

  const legalMoves = () => MODES.map((value) => ({ type: "mode", value }));
  const result = (s) => (s.explored ? "done" : null);

  return { SIZE, MODES, start, cells, total, identity, hoverIndex, move, legalMoves, result };
})();
