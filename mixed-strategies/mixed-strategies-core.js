"use strict";

/*
 * The 2 by 2 zero-sum game in Bogomolny's MixedStrategies applet.
 *
 * The four cells are the payoff to the row player. A click to the right of a
 * number's centre increases it and one to the left decreases it, matching
 * CTKNumber.UpdateSlow(); dragging makes the same one-step change because
 * CTKNumber's increment is 1. The applet then computes the two mixing
 * probabilities directly from the four payoffs. It only labels the mixture
 * when both probabilities lie strictly between 0 and 1.
 */

var MixedStrategiesCore = (function () {
  function create() {
    // MixedStrategiesCanvas.Reset() uses Math.random() * (0 - 0) + 0.
    return { matrix: [[0, 0], [0, 0]] };
  }

  /** Change flat cell 0..3 by direction -1 or 1, as CTKNumber does. */
  function adjust(state, cell, direction) {
    if (!Number.isInteger(cell) || cell < 0 || cell > 3 || (direction !== -1 && direction !== 1)) return null;
    const row = Math.floor(cell / 2);
    const col = cell % 2;
    state.matrix[row][col] += direction;
    return state.matrix[row][col];
  }

  /**
   * Row minima meet column maxima at saddle cells. Equal entries may make
   * more than one saddle, just as the applet draws arrows both ways for ties.
   */
  function saddles(matrix) {
    const result = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const value = matrix[row][col];
        if (value <= matrix[row][1 - col] && value >= matrix[1 - row][col]) result.push({ row, col, value });
      }
    }
    return result;
  }

  /** The applet's P, Q and value fractions, without reducing their fields. */
  function analyse(matrix) {
    const [[a, b], [c, d]] = matrix;
    const delta = a - b - c + d;
    const saddleCells = saddles(matrix);
    if (delta === 0) return { delta, saddles: saddleCells, mixed: null };

    const p = { n: d - c, d: delta };
    const q = { n: d - b, d: delta };
    if (!(p.n / p.d > 0 && p.n / p.d < 1 && q.n / q.d > 0 && q.n / q.d < 1)) {
      return { delta, saddles: saddleCells, mixed: null };
    }
    return {
      delta,
      saddles: saddleCells,
      mixed: { p, q, value: { n: a * d - b * c, d: delta } },
    };
  }

  /** The applet's arrows: row maxima point to minima; column minima point to maxima. */
  function arrows(matrix) {
    const result = [];
    for (let row = 0; row < 2; row++) {
      const left = matrix[row][0];
      const right = matrix[row][1];
      const a = row * 2;
      const b = a + 1;
      if (left >= right) result.push({ from: a, to: b });
      if (right >= left) result.push({ from: b, to: a });
    }
    for (let col = 0; col < 2; col++) {
      const top = matrix[0][col];
      const bottom = matrix[1][col];
      if (top <= bottom) result.push({ from: col, to: col + 2 });
      if (bottom <= top) result.push({ from: col + 2, to: col });
    }
    return result;
  }

  function fractionText(fraction) {
    let numerator = fraction.n;
    let denominator = fraction.d;
    // CTKRational(int, int) flips both signs when the denominator is negative.
    if (denominator < 0) { numerator = -numerator; denominator = -denominator; }
    if (numerator === 0) return "0";
    const gcd = (a, b) => b === 0 ? Math.abs(a) : gcd(b, a % b);
    const factor = gcd(numerator, denominator) || 1;
    const n = numerator / factor;
    const d = denominator / factor;
    return d === 1 ? String(n) : `${n}/${d}`;
  }

  return { create, adjust, saddles, analyse, arrows, fractionText };
})();
