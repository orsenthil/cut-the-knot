"use strict";

/*
 * Diagonal Count - the rules, with no DOM.
 *
 * A convex polygon has n vertices, numbered 0..n-1 the way they sit round the
 * boundary. A diagonal joins two of them that are not neighbours, and two
 * diagonals may not cross.
 *
 * Because the vertices are in cyclic order, crossing is a question about
 * numbers rather than geometry: chords {a,b} and {c,d} of a circle cross
 * exactly when one of c, d lies strictly between a and b in that order and
 * the other does not - they interleave. DiagonalsCanvas.Crosses() in the
 * applet tests precisely that, and so does crosses() here.
 *
 * The fact the puzzle is about: however many diagonals you draw and in
 * whatever order, once no more will fit you always have exactly n-3 of them.
 * So you can never paint yourself into a corner, and `legalMoves` is empty
 * exactly when `isComplete` is true - which the Node test checks rather than
 * assumes.
 */

var DiagonalsCore = (function () {
  const MIN_N = 4;
  const MAX_N = 40; // the applet's N spinner ran 4..40

  const maxDiagonals = (n) => n - 3;
  const triangleCount = (n) => n - 2;
  /** Every diagonal a polygon has, crossings allowed. */
  const allDiagonals = (n) => (n * (n - 3)) / 2;

  function create(n) {
    const size = Math.min(MAX_N, Math.max(MIN_N, Math.floor(n)));
    return { n: size, diagonals: [] };
  }

  const ordered = (a, b) => (a < b ? [a, b] : [b, a]);

  /** Neighbours round the boundary: the segment is a side, not a diagonal. */
  function isSide(n, a, b) {
    const gap = Math.abs(a - b);
    return gap === 1 || gap === n - 1;
  }

  const strictlyInside = (d, v) => v > d[0] && v < d[1];

  function has(state, a, b) {
    const e = ordered(a, b);
    return state.diagonals.some((d) => d[0] === e[0] && d[1] === e[1]);
  }

  /**
   * Does the segment a-b cross a diagonal already drawn? Diagonals meeting at
   * a shared vertex do not count as crossing, which is why they are skipped
   * first - the applet skips them the same way.
   */
  function crosses(state, a, b) {
    for (const d of state.diagonals) {
      if (d[0] === a || d[0] === b || d[1] === a || d[1] === b) continue;
      // Interleaved: exactly one end of a-b sits inside the arc d spans.
      if (strictlyInside(d, a) !== strictlyInside(d, b)) return true;
    }
    return false;
  }

  function isComplete(state) {
    return state.diagonals.length >= maxDiagonals(state.n);
  }

  /**
   * Why a segment may or may not be drawn. The applet tested in the order
   * finished, same vertex, crossing, side; "duplicate" is added here because
   * it did not test for one at all and would happily draw a diagonal twice.
   */
  function classify(state, a, b) {
    if (isComplete(state)) return "finished";
    if (a === b) return "same";
    if (has(state, a, b)) return "duplicate";
    if (crosses(state, a, b)) return "crosses";
    if (isSide(state.n, a, b)) return "side";
    return "ok";
  }

  /** Draw it if the rules allow. Returns the same verdict as classify(). */
  function add(state, a, b) {
    const verdict = classify(state, a, b);
    if (verdict === "ok") state.diagonals.push(ordered(a, b));
    return verdict;
  }

  /** Every diagonal that could still be drawn, as [a, b] pairs with a < b. */
  function legalMoves(state) {
    const moves = [];
    if (isComplete(state)) return moves;
    for (let a = 0; a < state.n; a++) {
      for (let b = a + 1; b < state.n; b++) {
        if (classify(state, a, b) === "ok") moves.push([a, b]);
      }
    }
    return moves;
  }

  return {
    MIN_N: MIN_N,
    MAX_N: MAX_N,
    create: create,
    maxDiagonals: maxDiagonals,
    triangleCount: triangleCount,
    allDiagonals: allDiagonals,
    isSide: isSide,
    crosses: crosses,
    has: has,
    classify: classify,
    add: add,
    legalMoves: legalMoves,
    isComplete: isComplete,
  };
})();
