#!/usr/bin/env node
"use strict";

/*
 * Logic test for Mixed Strategies. It checks the 2 by 2 zero-sum matrix
 * calculations against a separate direct transcription of the applet's
 * formulas, over every matrix whose entries are -2 through 2.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const M = loadCore("mixed-strategies/mixed-strategies-core.js", "MixedStrategiesCore");

function reference(matrix) {
  const [[a, b], [c, d]] = matrix;
  const delta = a - b - c + d;
  const saddles = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const value = matrix[row][col];
      if (value <= matrix[row][1 - col] && value >= matrix[1 - row][col]) saddles.push({ row, col, value });
    }
  }
  const p = delta === 0 ? null : { n: d - c, d: delta };
  const q = delta === 0 ? null : { n: d - b, d: delta };
  const inUnitInterval = (r) => r && r.n / r.d > 0 && r.n / r.d < 1;
  return {
    delta,
    saddles,
    mixed: inUnitInterval(p) && inUnitInterval(q)
      ? { p, q, value: { n: a * d - b * c, d: delta } }
      : null,
  };
}

/* The applet starts all four CTKNumbers at 0 because m_MinValue = m_MaxValue = 0. */
equal("initial matrix is four zeroes", M.create().matrix, [[0, 0], [0, 0]]);

/* CTKNumber clicks change by 1 on either side of its vertical centre; drags change by incr = 1 too. */
const clicked = M.create();
equal("right-side click increases a cell", M.adjust(clicked, 0, 1), 1);
equal("left-side click decreases a cell", M.adjust(clicked, 0, -1), 0);

let matrices = 0;
for (let a = -2; a <= 2; a++) {
  for (let b = -2; b <= 2; b++) {
    for (let c = -2; c <= 2; c++) {
      for (let d = -2; d <= 2; d++) {
        const matrix = [[a, b], [c, d]];
        const got = M.analyse(matrix);
        const want = reference(matrix);
        equal(`matrix ${a},${b},${c},${d}: delta`, got.delta, want.delta);
        equal(`matrix ${a},${b},${c},${d}: saddle cells`, got.saddles, want.saddles);
        equal(`matrix ${a},${b},${c},${d}: mixed result`, got.mixed, want.mixed);
        matrices++;
      }
    }
  }
}
equal("all matrices in -2..2 were checked", matrices, 625);

/* A familiar matching-pennies matrix has the unique half-and-half equilibrium. */
check("negative denominators display with the sign on the numerator", M.fractionText({ n: -2, d: -4 }) === "1/2");

equal("matching pennies probabilities and value", M.analyse([[1, -1], [-1, 1]]).mixed, {
  // CTKRational stores these unreduced; its toString() displays 1/2 and 0.
  p: { n: 2, d: 4 }, q: { n: 2, d: 4 }, value: { n: 0, d: 4 },
});

check("a saddle matrix does not show a stable mixed pair", M.analyse([[3, 1], [4, 2]]).mixed === null);
equal("arrows point from larger to smaller in rows and smaller to larger in columns", M.arrows([[3, 1], [4, 2]]), [
  { from: 0, to: 1 }, { from: 2, to: 3 }, { from: 0, to: 2 }, { from: 1, to: 3 },
]);
done();
