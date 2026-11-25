#!/usr/bin/env node
"use strict";

/*
 * Logic test for min-max/min-max-core.js.
 *
 *   node porting/check-min-max.mjs
 *
 * The page's statement: MaxMin <= MinMax, with equality exactly when some entry
 * is both largest in its column and smallest in its row. Exhaustively for every
 * 2 by 2, 2 by 3, 3 by 2 and 3 by 3 table with entries 0..3 (4^9 = 262,144
 * tables for 3 by 3), and on 300,000 random tables of up to 12 by 12. The
 * applet's own loops (with its sentinels) are written again and compared. The
 * saddle points found are exactly the entries that are both. Also how often tables
 * have a saddle point at the default size.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("min-max/min-max-core.js", "MinMaxCore");

/* ------------------------------------------------------------ 1. the rules */
{
  equal("sizes 2..12, Max 2..20, defaults 3 by 5 and 10", [C.MIN_SIZE, C.MAX_SIZE, C.MIN_MAX, C.MAX_MAX, C.DEFAULT_ROWS, C.DEFAULT_COLS, C.DEFAULT_MAX], [2, 12, 2, 20, 3, 5, 10]);
  const s = C.start({ random: rng(4) });
  equal("a new table is 3 by 5 with entries 0..9", [s.rows, s.cols, s.values.length, s.values.every((r) => r.length === 5 && r.every((v) => v >= 0 && v < 10))], [3, 5, 3, true]);
  const t = C.start({ rows: 99, cols: 1, max: 99, random: rng(1) });
  equal("sizes and Max are clamped", [t.rows, t.cols, t.max], [12, 2, 20]);
  const u = C.change(s, 1, 2, 1), w = C.change(s, 1, 2, -1);
  equal("an entry goes up or down by one, with no limit", [u.values[1][2] - s.values[1][2], w.values[1][2] - s.values[1][2], C.change({ ...s, values: s.values.map((r) => r.map(() => 0)) }, 0, 0, -1).values[0][0]], [1, -1, -1]);
  equal("a bad entry", [C.change(s, 3, 0, 1), C.change(s, 0, 5, 1), C.change(s, -1, 0, 1)], [null, null, null]);
  equal("the old table is not changed", s.values[1][2] === C.start({ random: rng(4) }).values[1][2], true);
  const a = C.analyse({ rows: 2, cols: 2, max: 10, values: [[1, 2], [3, 4]] });
  equal("1 2 / 3 4: row minima 1 and 3, column maxima 3 and 4, MaxMin 3 = MinMax 3", [a.rowMins, a.colMaxes, a.maxMin, a.minMax, a.equal, a.saddles], [[1, 3], [3, 4], 3, 3, true, [[1, 0]]]);
  const b = C.analyse({ rows: 2, cols: 2, max: 10, values: [[1, 4], [3, 2]] });
  equal("1 4 / 3 2: MaxMin 2 < MinMax 3, no saddle point", [b.maxMin, b.minMax, b.equal, b.saddles], [2, 3, false, []]);
  equal("refresh and resize keep or change the size", [C.refresh(s).rows, C.resize(s, { rows: 7 }).rows, C.resize(s, { rows: 7 }).cols, C.resize(s, { max: 4 }).max], [3, 7, 5, 4]);
}

/* ------ 2. the statement, on every small table and 300,000 random ones */
const hasSaddle = (v) => {
  const rmin = v.map((r) => Math.min(...r)), cmax = v[0].map((_, k) => Math.max(...v.map((r) => r[k])));
  for (let i = 0; i < v.length; i++) for (let k = 0; k < v[0].length; k++) if (v[i][k] === cmax[k] && v[i][k] === rmin[i]) return true;
  return false;
};
// The applet's ComputeArrays with its sentinels 10000 and -10000.
const appletAnalyse = (v) => {
  const NY = v.length, NX = v[0].length, minInRows = [], maxInCols = [];
  for (let i = 0; i < NY; i++) { let m = 10000; for (let k = 0; k < NX; k++) m = Math.min(m, v[i][k]); minInRows[i] = m; }
  for (let k = 0; k < NX; k++) { let m = -10000; for (let i = 0; i < NY; i++) m = Math.max(m, v[i][k]); maxInCols[k] = m; }
  let maxMin = -10000; for (let i = 0; i < NY; i++) maxMin = Math.max(maxMin, minInRows[i]);
  let minMax = 10000; for (let k = 0; k < NX; k++) minMax = Math.min(minMax, maxInCols[k]);
  return { maxMin, minMax };
};
for (const [R, K, top] of [[2, 2, 5], [2, 3, 4], [3, 2, 4], [3, 3, 4]]) {
  const cells = R * K, total = Math.pow(top, cells);
  let bad = 0, ineq = 0, eq = 0, badApplet = 0, badSaddle = 0;
  for (let m = 0; m < total; m++) {
    const v = []; let x = m;
    for (let i = 0; i < R; i++) { v.push([]); for (let k = 0; k < K; k++) { v[i].push(x % top); x = Math.floor(x / top); } }
    const s = { rows: R, cols: K, max: top, values: v }, a = C.analyse(s);
    if (a.maxMin > a.minMax) ineq++;
    if ((a.maxMin === a.minMax) !== hasSaddle(v)) bad++;
    if (a.equal) { eq++; if (a.saddles.length === 0 || a.saddles.some(([i, k]) => !(v[i][k] === a.minMax))) badSaddle++; } else if (a.saddles.length) badSaddle++;
    const ap = appletAnalyse(v); if (ap.maxMin !== a.maxMin || ap.minMax !== a.minMax) badApplet++;
  }
  equal(`${R} by ${K}, entries 0..${top - 1}: all ${total.toLocaleString()} tables have MaxMin <= MinMax`, ineq, 0);
  equal(`${R} by ${K}: equality exactly when a saddle point exists (${eq.toLocaleString()} equal cases)`, bad, 0);
  equal(`${R} by ${K}: the saddle points listed are exactly the entries that are both`, badSaddle, 0);
  equal(`${R} by ${K}: the applet's loops agree`, badApplet, 0);
}
{
  const r = rng(9);
  let ineq = 0, bad = 0, eq = 0, badApplet = 0;
  for (let t = 0; t < 300000; t++) {
    const s = C.start({ rows: 2 + Math.floor(r() * 11), cols: 2 + Math.floor(r() * 11), max: 2 + Math.floor(r() * 19), random: r });
    // sometimes disturb an entry far outside 0..max (the player can drag entries anywhere)
    const s2 = r() < 0.3 ? C.change(C.change(s, 0, 0, -1), 1, 1, 1) : s;
    const a = C.analyse(s2);
    if (a.maxMin > a.minMax) ineq++;
    if (a.equal) eq++;
    if (a.equal !== hasSaddle(s2.values)) bad++;
    const ap = appletAnalyse(s2.values); if (ap.maxMin !== a.maxMin || ap.minMax !== a.minMax) badApplet++;
  }
  console.log(`  (random tables with a saddle point: ${eq.toLocaleString()} of 300,000)`);
  equal("300,000 random tables of 2..12 by 2..12: MaxMin <= MinMax always", ineq, 0);
  equal("equality exactly when a saddle point exists", bad, 0);
  equal("the applet's loops agree", badApplet, 0);
}
{
  // how common a saddle point is, at the default size
  const r = rng(21);
  let eq = 0; const n = 100000;
  for (let t = 0; t < n; t++) if (C.analyse(C.start({ random: r })).equal) eq++;
  console.log(`  (default 3 by 5, 0..9: ${(100 * eq / n).toFixed(1)}% have a saddle point)`);
  check("saddle points are rare enough to need many Resets, yet occur", eq / n > 0.01 && eq / n < 0.4);
}

done("min-max");
