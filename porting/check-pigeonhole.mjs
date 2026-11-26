#!/usr/bin/env node
"use strict";

/*
 * Logic test for pigeonhole/pigeonhole-core.js.
 *
 *   node porting/check-pigeonhole.mjs
 *
 * The page's claims on the applet's 12 x 9 board: some two of any five
 * distinct nodes have a lattice midpoint (checked by rule over every parity
 * assignment, and on 200,000 random sets of 5 dots), four dots can avoid it
 * (and exactly those with one dot in each parity class do, over every set of 4
 * nodes on a 6 x 6 patch), the midpoint is a lattice point iff the parities
 * agree, and the segment holds other lattice points whenever it has a lattice
 * midpoint.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const P = loadCore("pigeonhole/pigeonhole-core.js", "PigeonholeCore");

// the four classes
equal("four parity classes", new Set([[0, 0], [0, 1], [1, 0], [1, 1]].map(([x, y]) => P.parityClass({ x, y }))).size, 4);
equal("the safe four have no pair", P.findPair(P.safeFour()), null);
equal("the four have four different classes", new Set(P.safeFour().map(P.parityClass)).size, 4);

// midpoints and the points between
equal("midpoint of (0,0) and (2,4)", P.midpoint({ x: 0, y: 0 }, { x: 2, y: 4 }), { x: 1, y: 2 });
equal("no lattice midpoint for (0,0) and (1,2)", P.midpoint({ x: 0, y: 0 }, { x: 1, y: 2 }), null);
equal("the points between (0,0) and (6,3): gcd 3, two of them", P.between({ x: 0, y: 0 }, { x: 6, y: 3 }), [{ x: 2, y: 1 }, { x: 4, y: 2 }]);

// four dots on a 6 x 6 patch: no pair exactly when the four classes are different
const nodes = [];
for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) nodes.push({ x, y });
let sets4 = 0, safe = 0, mismatch = 0;
for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) for (let c = b + 1; c < nodes.length; c++) for (let d = c + 1; d < nodes.length; d++) {
  const pts = [nodes[a], nodes[b], nodes[c], nodes[d]];
  sets4++;
  const noPair = P.findPair(pts) === null;
  if (noPair) safe++;
  if (noPair !== (new Set(pts.map(P.parityClass)).size === 4)) mismatch++;
}
equal(`${sets4} sets of four: pair-free exactly when all four classes differ`, mismatch, 0);
equal("... and there are 9^4 = 6561 of those", safe, 6561);

// five dots: always a pair, on all sets of 5 distinct nodes of a 4 x 4 patch, and 200,000 random on the board
const small = [];
for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) small.push({ x, y });
let sets5 = 0, miss = 0;
for (let a = 0; a < 16; a++) for (let b = a + 1; b < 16; b++) for (let c = b + 1; c < 16; c++) for (let d = c + 1; d < 16; d++) for (let e = d + 1; e < 16; e++) {
  sets5++;
  const pts = [small[a], small[b], small[c], small[d], small[e]];
  const pr = P.findPair(pts);
  if (!pr) miss++;
  else {
    const m = P.midpoint(pts[pr[0]], pts[pr[1]]);
    if (!m || P.between(pts[pr[0]], pts[pr[1]]).length < 1) miss++;
  }
}
equal(`${sets5} sets of five on a 4 x 4 patch: always a pair with a lattice midpoint`, miss, 0);
const rand = rng(5);
let bad = 0;
for (let i = 0; i < 200000; i++) {
  const s = P.start({ n: 5, random: rand });
  if (s.points.length !== 5 || new Set(s.points.map((p) => p.x + "," + p.y)).size !== 5) bad++;
  else if (P.findPair(s.points) === null) bad++;
}
equal("200,000 random five-dot positions on the board", bad, 0);

// moving and switching
let s = { n: 4, points: P.safeFour() };
equal("a move onto a free node", P.move(s, 0, 3, 3).points[0], { x: 3, y: 3 });
equal("a move onto a taken node is refused", P.move(s, 0, 5, 2), null);
equal("a move off the board is refused", P.move(s, 0, -1, 2), null);
const five = P.setN(s, 5, rng(2));
equal("five dots after switching up", five.points.length, 5);
check("... and the five always have a pair", P.findPair(five.points) !== null);
equal("four dots after switching down", P.setN(five, 4).points.length, 4);
done("pigeonhole");
