"use strict";

/*
 * Play Hex Design, from Alexander Bogomolny's applet PlayHexDesign.
 *
 * The board is an N x N patch of the triangular grid whose edges wrap round
 * (a torus): node (i, j) sits at i*e1 + j*e2, with e2 the unit vector at 60
 * degrees to e1, and coordinates are taken mod N. The first node you click is
 * selected. After that, a click on node P turns the last selected node L
 * clockwise through 60 degrees around P (the applet's Multiply(P, L)):
 *
 *     P * L = ( L.i + L.j - P.j ,  P.i + P.j - L.i )   (mod N)
 *
 * If that node is new it is selected and becomes the last one; if it was
 * selected before, the click is a misstep, the node flashes and nothing else
 * changes. The goal is to fill all N*N nodes. For a fixed L the map P -> P*L is
 * one-to-one, so every empty node can always be reached by one click: the
 * board can always be filled with no missteps at all.
 *
 * The position is plain data: { n, moves: [[i, j], ...], missed, alert }
 * where moves are the selected nodes in order and alert is the node that
 * caused the last misstep (or null).
 */
const PlayHexDesignCore = (() => {
  const N_MIN = 3, N_MAX = 40, N_START = 3;

  const mod = (a, n) => ((a % n) + n) % n;

  /** The applet's Multiply(P, L): L turned 60 degrees clockwise about P, on the torus. */
  function product(n, p, l) {
    return [mod(l[0] + l[1] - p[1], n), mod(p[0] + p[1] - l[0], n)];
  }

  /** The node P to click so that P * L = target (the inverse of the map P -> P * L). */
  function solveFor(n, l, target) {
    const pj = mod(l[0] + l[1] - target[0], n);
    const pi = mod(target[1] - pj + l[0], n);
    return [pi, pj];
  }

  function start(options) {
    const raw = options && Number(options.n);
    const n = Number.isInteger(raw) ? Math.min(N_MAX, Math.max(N_MIN, raw)) : N_START;
    return { n, moves: [], missed: 0, alert: null };
  }

  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const isSelected = (s, node) => s.moves.some((m) => same(m, node));
  const last = (s) => (s.moves.length ? s.moves[s.moves.length - 1] : null);
  const filled = (s) => s.moves.length === s.n * s.n;

  /** Click node [i, j]. Returns the new position, or null for no such node or a full board. */
  function click(s, node) {
    const [i, j] = node || [];
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= s.n || j >= s.n) return null;
    if (filled(s)) return null;
    if (s.moves.length === 0) return { ...s, moves: [[i, j]], alert: null };
    const r = product(s.n, [i, j], last(s));
    if (isSelected(s, r)) return { ...s, missed: s.missed + 1, alert: r };
    return { ...s, moves: [...s.moves, r], alert: null };
  }

  /** The applet's Back: forget the last selected node (missteps stay counted). */
  function back(s) {
    if (s.moves.length === 0) return s;
    return { ...s, moves: s.moves.slice(0, -1), alert: null };
  }

  /** "win" once every node is selected, otherwise null. */
  const result = (s) => (filled(s) ? "win" : null);

  return { N_MIN, N_MAX, N_START, product, solveFor, start, click, back, isSelected, last, filled, result };
})();
