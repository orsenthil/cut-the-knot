#!/usr/bin/env node
"use strict";

/*
 * Logic test for roots-of-unity-lattice/roots-of-unity-lattice-core.js.
 *
 *   node porting/check-roots-of-unity-lattice.mjs
 *
 * The cyclotomic polynomials (Phi_5, Phi_12) and the reduction of z^j; that the
 * lift loses nothing (all (r+1)^phi(m) points are different in the plane); and,
 * for every shape the page offers, that the fast count (pairs differing by a
 * unit root) equals the count over every pair of points, so no other unit
 * differences exist. Also each point's neighbours are at distance 1, and
 * the comparison grid is the one the grid core finds.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("roots-of-unity-lattice/roots-of-unity-lattice-core.js", "RootsCore");
const D = loadCore("grid-spacing-dial/grid-spacing-dial-core.js", "GridDialCore");

equal("phi(5), phi(7), phi(8), phi(9), phi(12)", [5, 7, 8, 9, 12].map(C.phi), [4, 6, 4, 6, 4]);
equal("Phi_5 = 1 + x + x^2 + x^3 + x^4", C.cyclotomic(5), [1, 1, 1, 1, 1]);
equal("Phi_12 = x^4 - x^2 + 1", C.cyclotomic(12), [1, 0, -1, 0, 1]);
equal("z^4 = -1 - z - z^2 - z^3 when m = 5", C.rootVector(5, 4), [-1, -1, -1, -1]);
equal("z^6 = -1 when m = 12", C.rootVector(12, 6), [-1, 0, 0, 0]);
equal("z^m = 1", C.rootVector(7, 7), [1, 0, 0, 0, 0, 0]);
{
  // The integer form of each root really is that root.
  let worst = 0;
  for (const m of C.MS) for (let j = 0; j < m; j++) {
    const v = C.rootVector(m, j), p = C.toPlane(m, v);
    worst = Math.max(worst, Math.hypot(p.x - Math.cos((2 * Math.PI * j) / m), p.y - Math.sin((2 * Math.PI * j) / m)));
  }
  check("every z^j in the basis lands at e^(2 pi i j / m)", worst < 1e-9, String(worst));
}
equal("unit vectors: 5 -> 10, 12 -> 12", [C.unitVectors(5).length, C.unitVectors(12).length], [10, 12]);

const rows = [];
for (const m of C.MS) for (let r = 1; r <= C.maxR(m); r++) {
  const pts = C.build(m, r);
  equal(`m=${m} r=${r}: ${C.sizeOf(m, r)} points, all different in the plane`, [pts.length, C.distinctInPlane(pts)], [C.sizeOf(m, r), C.sizeOf(m, r)]);
  const fast = C.countByRoots(m, pts), brute = C.countByDistance(pts);
  equal(`m=${m} r=${r}: pairs by roots = pairs by distance`, fast, brute);
  rows.push([m, r, pts.length, fast, C.bestSquareGrid(pts.length)]);
}
check("maxR keeps within the cap", C.MS.every((m) => C.sizeOf(m, C.maxR(m)) <= C.MAX_POINTS && C.sizeOf(m, C.maxR(m) + 1) > C.MAX_POINTS));
{
  const pts = C.build(12, 2), nb = C.neighbours(pts, 40);
  check("each neighbour is at distance 1", nb.every((j) => Math.abs(Math.hypot(pts[40].x - pts[j].x, pts[40].y - pts[j].y) - 1) < 1e-9));
  check("the middle point has all 12 neighbours", nb.length === 12, String(nb.length));
}
{
  const g = C.bestSquareGrid(256), b = D.best(16);
  equal("comparison grid for 256 points is the dial core's best 16 x 16", [g.k, g.c2, g.count], [16, b.c2, b.count]);
}
console.log("  m  r      n   lattice   square grid (best spacing)");
for (const [m, r, n, c, g] of rows.filter((x) => x[2] >= 80)) console.log(`  ${String(m).padStart(2)} ${r} ${String(n).padStart(6)} ${String(c).padStart(9)}   ${g.count} (${g.n} points)`);
equal("clampM", [C.clampM(5), C.clampM(6), C.clampM("12")], [5, 12, 12]);

done("roots-of-unity-lattice");
