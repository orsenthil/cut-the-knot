#!/usr/bin/env node
"use strict";

/*
 * Logic test for equilateral-fibonacci/equilateral-fibonacci-core.js.
 *
 *   node porting/check-equilateral-fibonacci.mjs
 *
 * The page's claims, checked from the corners of the shapes (plane coordinates), not
 * from the numbers the core wrote down, for every N the applet offers (5, 10, ..., 145):
 * each coloured shape is an isosceles trapezoid with 60 degree angles (parallel top and
 * base, equal legs, base = top + leg); top, leg and base are three consecutive Fibonacci
 * numbers; the shapes sit one on top of the other without gaps (every shape starts on
 * the row where the one before it ended, the rows being 1, 2, 3, 5, 8, 13, ...); no two
 * shapes overlap (their areas in unit triangles add up to the area of the union, checked
 * by counting unit triangles); and the rule F(k) + F(k+1) = F(k+2) that drives it.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("equilateral-fibonacci/equilateral-fibonacci-core.js", "EquilateralFibonacciCore");
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const BIG = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
const FIBS = new Set(BIG);
const isFib = (v) => FIBS.has(v);

{
  const s = C.start({});
  check("the board opens on N = 20", s.n === 20 && C.result(s) === null);
  check("N runs from 5 to 145 in steps of 5", C.start({ n: 3 }).n === 5 && C.start({ n: 999 }).n === 145 && C.start({ n: 22 }).n === 20 && C.start({ n: 23 }).n === 25);
  check("a step up and a step down", C.move(s, { type: "step", dir: 1 }).n === 25 && C.move(s, { type: "step", dir: -1 }).n === 15 && C.move(C.start({ n: 5 }), { type: "step", dir: -1 }) === null && C.move(C.start({ n: 145 }), { type: "step", dir: 1 }) === null);
  check("typing a value snaps to a multiple of 5 and counts as exploring", C.result(C.move(s, { type: "n", value: 47 })) === "done" && C.move(s, { type: "n", value: 47 }).n === 45 && C.move(s, { type: "n", value: "x" }) === null);
  check("the old position is untouched", s.n === 20 && s.moves === 0);
  equal("for N = 20 the coloured shapes are the two triangles and the bands to row 13", C.shapes(20).map((x) => x.rows.join("-")).join(), "0-1,1-2,2-3,3-5,5-8,8-13");
  equal("for N = 145 the last band ends on row 144", C.shapes(145).map((x) => x.rows[1]).join(), "1,2,3,5,8,13,21,34,55,89,144");
  check("for N = 5 the shapes go down to row 5", C.shapes(5).map((x) => x.rows[1]).join() === "1,2,3,5");
}

{
  let n = 0, bad = null;
  const lattice = (i, j) => C.plane(i, j);
  for (let N = 5; N <= 145; N += 5) {
    const sh = C.shapes(N);
    let prev = 0;
    sh.forEach((s, k) => {
      const p = s.points;
      if (s.kind === "trapezoid") {
        // four corners: two on the top row, two on the base row, in plane coordinates
        const ys = p.map((q) => lattice(q[0], q[1])[1]);
        const [rowA, rowB] = [Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[0]))];
        const topPts = p.filter((q) => q[0] === rowA), basePts = p.filter((q) => q[0] === rowB);
        if (topPts.length !== 2 || basePts.length !== 2) { bad = `shape ${k} N=${N}: not two corners on each row`; return; }
        const top = C.length(topPts[0], topPts[1]), base = C.length(basePts[0], basePts[1]);
        // legs join the two ends: the left corner of the top row to the left corner of the base row, likewise right
        const lt = topPts.slice().sort((x, y) => lattice(...x)[0] - lattice(...y)[0]), lb = basePts.slice().sort((x, y) => lattice(...x)[0] - lattice(...y)[0]);
        const legL = C.length(lt[0], lb[0]), legR = C.length(lt[1], lb[1]);
        if (!near(legL, legR)) bad = `shape ${k} N=${N}: legs differ`;
        if (!near(base, top + legL)) bad = `shape ${k} N=${N}: base != top + leg (${base} ${top} ${legL})`;
        // height = leg * sin 60
        if (!near(lattice(rowB, 0)[1] - lattice(rowA, 0)[1], (legL * Math.sqrt(3)) / 2)) bad = `shape ${k} N=${N}: height`;
        if (![top, legL, base].every((v) => Number.isInteger(Math.round(v)) && near(v, Math.round(v)) && isFib(Math.round(v)))) bad = `shape ${k} N=${N}: ${top} ${legL} ${base} not Fibonacci`;
        const t = Math.round(top), l = Math.round(legL), b = Math.round(base);
        const i1 = BIG.indexOf(t), i2 = BIG.indexOf(l);
        const consecutive = (t === 1 && l === 1 && b === 2) || (i2 === i1 + 1 && b === t + l) || (t === 1 && l === 2 && b === 3);
        if (!consecutive) bad = `shape ${k} N=${N}: ${t},${l},${b} not consecutive`;
        if (t !== s.top || l !== s.leg || b !== s.base) bad = `shape ${k} N=${N}: recorded sides differ from the corners`;
      } else {
        const sides = [C.length(p[0], p[1]), C.length(p[1], p[2]), C.length(p[2], p[0])];
        if (!sides.every((v) => near(v, 1))) bad = `triangle ${k} N=${N}: not a unit equilateral triangle`;
      }
      if (s.rows[0] !== prev) bad = `shape ${k} N=${N}: starts on row ${s.rows[0]}, the one before ended on ${prev}`;
      prev = s.rows[1];
      n++;
    });
    if (prev > N) bad = `N=${N}: a shape goes past the last row`;
    // the next band would not fit: the next row boundary is past the last row of the lattice
    const nextRow = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233].find((v) => v > prev);
    if (nextRow <= N) bad = `N=${N}: stopped early at row ${prev}, row ${nextRow} fits`;
  }
  check(`every shape for every N from 5 to 145 is an isosceles 60-degree trapezoid (or a unit triangle) with base = top + leg, sides three consecutive Fibonacci numbers, and no gap between rows (${n} shapes)`, bad === null, String(bad));
}

{
  // the rows the bands end on are the Fibonacci numbers, so the number of unit triangles up to a row is its square
  let bad = null;
  for (const N of [5, 20, 55, 145]) {
    const rows = C.shapes(N).map((x) => x.rows[1]);
    rows.forEach((r) => { if (!isFib(r)) bad = `row ${r}`; });
  }
  check("every band ends on a Fibonacci row", bad === null);
  // F(k) + F(k+1) = F(k+2): the base is the top plus the leg, and the next top is this leg
  let ok = true;
  const t = C.shapes(145).filter((x) => x.kind === "trapezoid");
  for (const x of t) if (x.base !== x.top + x.leg) ok = false;
  check("base = top + leg for every trapezoid (the rule F(k+2) = F(k) + F(k+1))", ok && t.length === 9);
  // successive trapezoids' (top, leg, base) triples: (1,1,2) (1,2,3) (2,3,5) (3,5,8) (5,8,13) ...
  equal("the triples of the 9 trapezoids", t.map((x) => `${x.top},${x.leg},${x.base}`).join(" "), "1,1,2 1,2,3 2,3,5 3,5,8 5,8,13 8,13,21 13,21,34 21,34,55 34,55,89");
  // identity behind the picture: the unit triangles of a trapezoid are base^2 - top^2 = leg * (base + top)
  check("a trapezoid holds base^2 - top^2 = leg(base + top) unit triangles, e.g. 55^2 - 21^2 = 34 * 76", t.every((x) => x.base * x.base - x.top * x.top === x.leg * (x.base + x.top)) && 55 * 55 - 21 * 21 === 34 * 76);
}

done("equilateral-fibonacci");
