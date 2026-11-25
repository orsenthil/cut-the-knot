"use strict";

/*
 * Colour the Moser Spindle: the graph and the colouring rules, with no DOM.
 *
 * The Moser spindle has 7 points of the plane and 11 pairs at distance 1: two
 * rhombi (each two equilateral triangles) that share the point A, turned
 * about A until their far tips D and D' are exactly 1 apart. Three colours
 * cannot paint it so that unit-apart points differ, which shows the plane
 * needs at least 4 colours. The vertices are
 * 0 = A; 1, 2, 3 = B, C, D (D the tip of the first rhombus); 4, 5, 6 = B', C', D'.
 */

const MoserCore = (function () {
  const N = 7;
  const EDGES = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [0, 4], [0, 5], [4, 5], [4, 6], [5, 6], [3, 6]];

  /** Coordinates of the seven points, A at the origin, first rhombus along the x axis. */
  function points() {
    const s = Math.sqrt(3);
    const phi = 2 * Math.asin(1 / (2 * s)); // the turn that makes |D D'| = 1
    const a = { x: 0, y: 0 };
    const b = { x: Math.cos(-Math.PI / 6), y: Math.sin(-Math.PI / 6) };
    const c = { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) };
    const d = { x: b.x + c.x, y: b.y + c.y };
    const rot = (p) => ({ x: p.x * Math.cos(phi) - p.y * Math.sin(phi), y: p.x * Math.sin(phi) + p.y * Math.cos(phi) });
    return [a, b, c, d, rot(b), rot(c), rot(d)];
  }

  const neighbours = (v) => EDGES.filter((e) => e.includes(v)).map((e) => (e[0] === v ? e[1] : e[0]));

  /** Colours 0..k-1, or -1 for unpainted. The pairs with the same colour (both painted). */
  function conflicts(colours) {
    return EDGES.filter(([i, j]) => colours[i] >= 0 && colours[i] === colours[j]);
  }

  /** Every point painted and no conflict. */
  const isProper = (colours, k) => colours.length === N && colours.every((c) => c >= 0 && c < k) && conflicts(colours).length === 0;

  /** How many proper colourings with k colours (exhaustive, k^7 at most 16384). */
  function countColourings(k) {
    let total = 0;
    const colours = Array(N).fill(-1);
    (function go(v) {
      if (v === N) { total++; return; }
      for (let c = 0; c < k; c++) {
        if (neighbours(v).some((u) => u < v && colours[u] === c)) continue;
        colours[v] = c; go(v + 1); colours[v] = -1;
      }
    })(0);
    return total;
  }

  /** One proper colouring with k colours, or null. */
  function solve(k) {
    const colours = Array(N).fill(-1);
    const go = (v) => {
      if (v === N) return true;
      for (let c = 0; c < k; c++) {
        if (neighbours(v).some((u) => u < v && colours[u] === c)) continue;
        colours[v] = c;
        if (go(v + 1)) return true;
      }
      colours[v] = -1;
      return false;
    };
    return go(0) ? colours : null;
  }

  const chromaticNumber = () => { for (let k = 1; k <= N; k++) if (solve(k)) return k; return N; };

  const clampK = (k) => Math.min(4, Math.max(2, Math.round(Number(k)) || 4));

  return { N, EDGES, points, neighbours, conflicts, isProper, countColourings, solve, chromaticNumber, clampK };
})();
