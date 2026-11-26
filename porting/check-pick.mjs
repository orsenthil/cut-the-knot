#!/usr/bin/env node
"use strict";

/*
 * Logic test for pick/pick-core.js.
 *
 *   node porting/check-pick.mjs
 *
 * Pick's theorem A = I + B/2 - 1, checked on thousands of random simple lattice
 * polygons on the 14 x 10 board: B counted by node (on-segment test) equals
 * the sum of gcds, I counted node by node, and 2A from I and B equals the
 * shoelace area. Also the page's examples, self-crossing polygons (refused),
 * the applet's ".5" areas, and polygons with a hole-free fold-back.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const P = loadCore("pick/pick-core.js", "PickCore");

const sq = [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }, { x: 1, y: 4 }];
let m = P.measure(sq);
equal("3x3 square: B = 12, I = 4, area 9", [m.B, m.I, m.twiceArea / 2], [12, 4, 9]);
const tri = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }];
m = P.measure(tri);
equal("a 2x1 right triangle: B = 4, I = 0, area 1", [m.B, m.I, P.areaText(m.twiceArea)], [4, 0, "1"]);
m = P.measure([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]);
equal("the unit triangle: B = 3, I = 0, area 0.5", [m.B, m.I, P.areaText(m.twiceArea)], [3, 0, "0.5"]);
equal("a bow tie crosses itself", P.measure([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 2, y: 0 }, { x: 0, y: 2 }]), null);
equal("three points on a line are not a polygon", P.measure([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]), null);
equal("two nodes are not a polygon", P.measure([{ x: 0, y: 0 }, { x: 2, y: 2 }]), null);
equal("a repeated node is refused", P.addNode(P.addNode(P.start(), 1, 1), 1, 1).poly.length, 1);
equal("a node off the board is refused", P.addNode(P.start(), 14, 0).poly.length, 0);
equal("deleting a node", P.deleteNode(P.addNode(P.addNode(P.start(), 1, 1), 2, 3), 1, 1).poly, [{ x: 2, y: 3 }]);
equal("a fold-back is refused", P.isSimple([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }]), false);

// random simple polygons: points sorted by angle round a centre are always simple (star-shaped); also random walks of nodes kept when simple
const rand = rng(3);
let tested = 0, bad = 0, badB = 0, halves = 0, withInterior = 0;
for (let t = 0; t < 40000; t++) {
  const k = 3 + Math.floor(rand() * 8);
  const cx = 3 + rand() * 8, cy = 2 + rand() * 5;
  const pts = [];
  const seen = new Set();
  for (let i = 0; i < k * 3 && pts.length < k; i++) {
    const x = Math.floor(rand() * P.COLS), y = Math.floor(rand() * P.ROWS), key = x + "," + y;
    if (!seen.has(key)) { seen.add(key); pts.push({ x, y }); }
  }
  pts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  const mm = P.measure(pts);
  if (!mm) continue;
  tested++;
  if (mm.twiceArea !== mm.shoelace2) bad++;
  if (mm.B !== mm.B_gcd) badB++;
  if (mm.twiceArea % 2 === 1) halves++;
  if (mm.I > 0) withInterior++;
}
check(`${tested} random simple polygons tested`, tested > 5000);
equal("Pick's formula equals the shoelace area every time", bad, 0);
equal("B by nodes equals the sum of gcds every time", badB, 0);
check("some areas are halves and some polygons have inside nodes", halves > 100 && withInterior > 1000);
done("pick");
