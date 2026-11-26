"use strict";

/*
 * Determinant and Permanent: an original game for the VP vs VNP path.
 *
 * The determinant and the permanent of a square matrix are built from the
 * same n! products: pick one entry in every row, all in different columns
 * (like rooks that cannot take each other), and multiply. The permanent
 * adds all the products. The determinant gives each one a sign, + or -,
 * by the parity of the permutation, and adds those. For the digits 1 to 9
 * in order the determinant is 0 and the permanent is 450.
 *
 * The game: arrange the digits 1 to 9 in a 3 x 3 grid, by swapping two at
 * a time, to make the permanent as large as possible (947) or the
 * determinant as large as possible (412). The logic test finds both
 * maximums by trying all 9! = 362,880 arrangements.
 *
 * The functions for any n (terms, det, perm) are here for the tutor.
 * This file defines one global, DetAndPermCore. The position is plain data.
 */
const DetAndPermCore = (() => {
  const GOALS = { perm: 947, det: 412 };

  /** All permutations of 0..n-1, each with its sign (+1 even, -1 odd). */
  function permutations(n) {
    const out = [];
    const go = (p, used, sign) => {
      if (p.length === n) { out.push({ p: p.slice(), sign }); return; }
      for (let j = 0; j < n; j++) if (!used[j]) {
        // the inversions this choice makes with the columns still free to its left
        let inv = 0;
        for (let k = 0; k < j; k++) if (!used[k]) inv++;
        used[j] = true; p.push(j);
        go(p, used, inv % 2 ? -sign : sign);
        p.pop(); used[j] = false;
      }
    };
    go([], new Array(n).fill(false), 1);
    return out;
  }

  /** The n! products of a matrix (rows of numbers): {cols, sign, product}. */
  function terms(m) {
    const n = m.length;
    return permutations(n).map(({ p, sign }) => ({ cols: p, sign, product: p.reduce((acc, j, i) => acc * m[i][j], 1) }));
  }
  const det = (m) => terms(m).reduce((s, t) => s + t.sign * t.product, 0);
  const perm = (m) => terms(m).reduce((s, t) => s + t.product, 0);

  const grid = (cells) => [cells.slice(0, 3), cells.slice(3, 6), cells.slice(6, 9)];

  function start(options = {}) {
    const ok = Array.isArray(options.cells) && options.cells.length === 9 && [...options.cells].sort((a, b) => a - b).join() === "1,2,3,4,5,6,7,8,9";
    return { cells: ok ? options.cells.slice() : [1, 2, 3, 4, 5, 6, 7, 8, 9], goal: options.goal === "det" ? "det" : "perm", swaps: 0 };
  }

  function swap(s, i, j) {
    if (![i, j].every((k) => Number.isInteger(k) && k >= 0 && k < 9) || i === j) return null;
    const cells = s.cells.slice();
    [cells[i], cells[j]] = [cells[j], cells[i]];
    return { ...s, cells, swaps: s.swaps + 1 };
  }

  const setGoal = (s, goal) => (goal === "det" || goal === "perm" ? { ...s, goal } : null);
  const value = (s) => (s.goal === "det" ? det(grid(s.cells)) : perm(grid(s.cells)));
  const result = (s) => (value(s) === GOALS[s.goal] ? "win" : null);

  return { GOALS, permutations, terms, det, perm, grid, start, swap, setGoal, value, result };
})();
