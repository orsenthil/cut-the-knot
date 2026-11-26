#!/usr/bin/env node
"use strict";

/*
 * Logic test for pascal-triangle/pascal-triangle-core.js.
 *
 *   node porting/check-pascal-triangle.mjs
 *
 * The recurrence is compared with counting every itinerary (every string of
 * left and right steps) up to row 16, with the product formula for n choose m,
 * and the page's own claims are checked: the ends are 1, a row has n+1 dots,
 * row n sums to 2^n, and the three arrangements place every dot once.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("pascal-triangle/pascal-triangle-core.js", "PascalTriangleCore");

const T = C.build(C.MAX_ROWS);
equal("the page's rows 2, 3 and 4", [T[2], T[3], T[4]], [[1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]]);
for (let n = 0; n < C.MAX_ROWS; n++) {
  check(`row ${n} has ${n + 1} dots`, T[n].length === n + 1);
  check(`row ${n}: both ends are 1`, T[n][0] === 1 && T[n][n] === 1);
  equal(`row ${n}: the recurrence equals counting every itinerary`, T[n], C.itineraries(n));
  let sum = 0;
  for (let m = 0; m <= n; m++) {
    sum += T[n][m];
    check(`C(${n},${m}) is the binomial coefficient`, T[n][m] === C.choose(n, m));
    check(`C(${n},${m}) is the sum of the dots it can be reached from`, n === 0 || T[n][m] === C.parents(n, m).reduce((s, [a, b]) => s + T[a][b], 0));
    check(`C(${n},${m}) = C(${n},${n - m})`, T[n][m] === T[n][n - m]);
  }
  check(`row ${n} sums to 2^${n}`, sum === 2 ** n);
}

for (const form of C.FORMS) {
  const seen = new Set();
  for (let n = 0; n < 12; n++) for (let m = 0; m <= n; m++) seen.add(JSON.stringify(C.place(form, n, m)));
  check(`${form}: every dot has its own place`, seen.size === 78);
}
// Pascal's form: row n is the diagonal x + y = n, and a dot's neighbours are one step apart
for (let n = 1; n < 10; n++) for (let m = 0; m <= n; m++) {
  const p = C.place("pascals", n, m);
  check(`Pascal's form: (${n},${m}) is on the diagonal`, p.x + p.y === n);
}
equal("the default is eleven rows", C.start({}).rows, 11);
equal("rows are kept between 2 and 16", [C.clampRows(NaN), C.clampRows(1), C.clampRows(99), C.clampRows("7")], [11, 2, 16, 7]);

done("pascal-triangle");
