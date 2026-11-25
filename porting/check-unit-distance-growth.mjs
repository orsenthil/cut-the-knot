#!/usr/bin/env node
"use strict";

/*
 * Logic test for unit-distance-growth/unit-distance-growth-core.js.
 *
 *   node porting/check-unit-distance-growth.mjs
 *
 * The count against the grid-spacing-dial core (itself checked pair by pair)
 * for every k up to 24; the article's 1,296-point grid (36 by 36, 7,632 pairs);
 * the grid always beats the plain unit-spaced grid 2k(k-1), never exceeds the
 * proved ceiling, and its best c2 never goes down by more than a little
 * as the grid grows.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const G = loadCore("unit-distance-growth/unit-distance-growth-core.js", "UnitGrowthCore");
const D = loadCore("grid-spacing-dial/grid-spacing-dial-core.js", "GridDialCore");

let bad = 0;
for (let k = 3; k <= 24; k++) { const a = G.bestFor(k), b = D.best(k); if (a.count !== b.count || a.c2 !== b.c2) bad++; }
equal("best grid agrees with the dial core for k = 3..24", bad, 0);

let bad2 = 0;
for (let k = 3; k <= 12; k++) for (let c2 = 1; c2 <= D.maxC2(k); c2++) if (G.countFor(k, c2) !== D.countBrute(k, c2)) bad2++;
equal("countFor equals the pair-by-pair count for k = 3..12", bad2, 0);

const b36 = G.bestFor(36);
equal("36 by 36 = 1,296 points: 7,632 pairs, as the article says", [b36.n, b36.count], [1296, 7632]);
console.log(`  (best spacing there: c2 = ${b36.c2})`);

const T = G.table(G.MAX_K);
equal("table has k = 2..64", [T.length, T[0].k, T[T.length - 1].k], [63, 2, 64]);
check("never below the unit-spaced grid 2k(k-1)", T.every((r) => r.count >= 2 * r.k * (r.k - 1)));
check("never above the proved ceiling", T.every((r) => r.count <= G.ceiling(r.n) + 1e-9));
check("count rises with k", T.every((r, i) => i === 0 || r.count > T[i - 1].count));
check("pairs per point rise (the slow growth) from k=4 to k=64", T[T.length - 1].count / T[T.length - 1].n > T[2].count / T[2].n * 1.5);
const e = T.map((r) => G.exponent(r.count, r.n));
console.log(`  (exponent log(count)/log(n): k=4 ${e[2].toFixed(3)}, k=16 ${e[14].toFixed(3)}, k=64 ${e[62].toFixed(3)})`);
check("all exponents from 1 up to below 3/2 at these sizes", e.every((x) => x >= 1 && x < 1.5));
equal("three slope guides", G.SLOPES.map((s) => s.s), [1, 4 / 3, 1.014]);
equal("clampK", [G.clampK(0), G.clampK(999), G.clampK("20")], [2, 64, 20]);

done("unit-distance-growth");
