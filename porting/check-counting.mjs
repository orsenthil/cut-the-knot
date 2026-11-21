#!/usr/bin/env node
"use strict";

/*
 * Logic test for counting/counting-core.js.
 *
 *   node porting/check-counting.mjs
 *
 * Exhaustive over every dot count 1..200 and every group size 1..220: the
 * layout always holds exactly N dots in the applet's rows and columns, the
 * tally has floor(N/g) full groups and a remainder group of N mod g, and the
 * equation text, parsed back, sums to N in both forms (division with
 * remainder). Against a second transcription of the applet's DrawEquation
 * and Reset arithmetic for every pair; counting every dot in every order of a
 * small board ends with the right numbering; the max and group-size controls.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("counting/counting-core.js", "CountingCore");

// A fixed random source so positions are reproducible.
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// DrawEquation transcribed a second time, as the bytecode builds it (pieces in order).
function equationJ(N, g) {
  const q = Math.trunc(N / g), r = N % g;
  const parts = [];
  if (q > 1) {
    if (!(N >= 20 && g === 1)) {
      for (let k = 0; k < q; k++) { parts.push(String(g)); if (k !== q - 1) parts.push("+"); }
      if (r > 0) { parts.push("+"); parts.push(String(r)); }
      parts.push("="); parts.push(String(N)); parts.push("or");
    }
    parts.push(String(q)); parts.push("×");
  }
  if (q > 0) parts.push(String(g));
  if (r > 0) { if (q > 0) parts.push("+"); parts.push(String(r)); }
  parts.push("="); parts.push(String(N));
  return parts.join(" ");
}
const squash = (s) => s.replace(/\s+/g, " ").trim();

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start({ rand: lcg(1) });
  check("a new game is not over", C.result(s) === null);
  check("the opening count is between max/2 and max", s.count >= 5 && s.count <= 10 && s.dots.length === s.count);
  equal("opening options", [s.max, s.group, s.numbers], [10, 5, false]);
  const m = C.move(s, { type: "count", index: 0 });
  check("counting a dot numbers it 1", m.dots[0].num === 1 && m.counted === 1 && m.moves === 1);
  check("the old position is untouched", s.counted === 0 && s.dots[0].num === 0);
  check("pressing a numbered dot does nothing (refused)", C.move(m, { type: "count", index: 0 }) === null);
  check("an out-of-range dot is refused", C.move(s, { type: "count", index: 99 }) === null && C.move(s, { type: "count", index: -1 }) === null);
  const again = C.move(m, { type: "again" });
  check("New Count starts over with the same dots", again.counted === 0 && again.dots.every((d, i) => d.num === 0 && d.jx === s.dots[i].jx));
  const fresh = C.move(m, { type: "new" }, lcg(9));
  check("New Group lays out a fresh scatter", fresh.counted === 0 && fresh.count >= 5 && fresh.count <= 10);
  const to = C.move(s, { type: "count-to", value: 37 }, lcg(2));
  check("the Count box makes exactly that many dots", to.dots.length === 37 && to.count === 37);
  check("a bad count is refused", C.move(s, { type: "count-to", value: 0 }) === null && C.move(s, { type: "count-to", value: 1.5 }) === null);
  check("bad moves are refused", C.move(s, null) === null && C.move(s, { type: "nope" }) === null && C.move(s, { type: "numbers", value: 1 }) === null && C.move(s, { type: "group", value: 0 }) === null && C.move(s, { type: "max", value: 4 }) === null && C.move(s, { type: "max", value: 101 }) === null);
  equal("group by 1 is allowed below 20", C.move(s, { type: "group", value: 1 }).group, 1);
  // The max steps: 5..10, then 20, 50, 100, and back.
  equal("max steps up", [5, 6, 9, 10, 20, 50, 100, 100].map((x) => C.nextMax(x, 1)), [6, 7, 10, 20, 50, 100, 100, 100]);
  equal("max steps down", [100, 50, 20, 10, 9, 6, 5].map((x) => C.nextMax(x, -1)), [50, 20, 10, 9, 8, 5, 5]);
  const big = C.move(C.move(s, { type: "group", value: 1 }), { type: "max", dir: 1 });
  equal("max 20 raises the smallest group to 2", [big.max, big.group], [20, 2]);
  check("below the minimum group size is refused at max 20", C.move(big, { type: "group", value: 1 }) === null);
  equal("typing a max 5..100 works", C.move(s, { type: "max", value: 37 }).max, 37);
}

/* -------------------------------------------------- 2. every case, where small */
{
  let bad = 0, n = 0;
  for (let N = 1; N <= 200; N++) {
    const dots = C.makeDots(N, lcg(N));
    const { rows, cols } = C.layout(N);
    if (dots.length !== N) bad++;
    if (rows !== Math.floor(Math.sqrt(N)) || cols !== Math.floor(N / rows + 1) || rows * cols < N) bad++;
    // every dot in its own cell, in reading order
    dots.forEach((d, i) => { if (d.row * cols + d.col !== i || d.jx < 0 || d.jx >= 1 || d.jy < 0 || d.jy >= 1) bad++; });
    n++;
  }
  equal(`the layout holds exactly N dots in distinct cells for N = 1..200 (${n})`, bad, 0);

  bad = 0; n = 0;
  for (let N = 1; N <= 200; N++) for (let g = 1; g <= 220; g++) {
    n++;
    const t = C.tally(N, g), q = Math.floor(N / g), r = N % g;
    if (t.reduce((a, b) => a + b, 0) !== N) bad++;
    if (t.length !== q + (r ? 1 : 0)) bad++;
    if (t.slice(0, q).some((x) => x !== g) || (r && t[t.length - 1] !== r)) bad++;
    const e = C.equation(N, g);
    if (squash(e) !== squash(equationJ(N, g))) bad++;
    // parse both forms back: they must each equal N (division with remainder)
    for (const side of e.split(/ or /)) {
      const [lhs, rhs] = side.split("=").map((x) => x.trim());
      if (Number(rhs) !== N) bad++;
      let total = 0;
      for (const term of lhs.split(" + ")) total += term.includes("×") ? term.split("×").map(Number).reduce((a, b) => a * b, 1) : Number(term);
      if (total !== N) bad++;
    }
    if (q * g + r !== N || r >= g) bad++;
  }
  equal(`tally and both equation forms are right for every N 1..200 and g 1..220 (${n})`, bad, 0);

  // The additive form is left out for at most one group, and for 1s once N >= 20.
  check("one full group shows only the short form", C.equation(7, 5) === "5 + 2 = 7" && C.equation(5, 5) === "5 = 5" && C.equation(3, 5) === "3 = 3");
  check("g = 1 below 20 shows both forms", C.equation(4, 1) === "1 + 1 + 1 + 1 = 4  or  4 × 1 = 4");
  check("g = 1 from 20 up shows the short form only", C.equation(20, 1) === "20 × 1 = 20");

  // Count every dot in every order on a small board: the numbering is the order of presses.
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  let ok = true, count = 0;
  for (const N of [1, 2, 3, 4, 5, 6]) {
    for (const order of perms([...Array(N).keys()])) {
      let s = C.start({ count: N, rand: lcg(N) });
      for (const i of order) s = C.move(s, { type: "count", index: i });
      count++;
      if (!s || !s.finished || C.result(s) !== "done" || order.some((i, k) => s.dots[i].num !== k + 1)) ok = false;
      if (C.legalMoves(s).some((m) => m.type === "count")) ok = false;
    }
  }
  check(`every order of counting N = 1..6 numbers the dots in press order (${count} orders)`, ok);

  // Counting is only "done" when everything is counted.
  let s2 = C.start({ count: 3, rand: lcg(5) });
  s2 = C.move(C.move(s2, { type: "count", index: 2 }), { type: "count", index: 0 });
  check("two of three counted is not done", C.result(s2) === null);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // Reset(): count = max/2 + max*random/2 as ints, for every max and many random values.
  let bad = 0, n = 0;
  for (const max of C.MAX_STEPS) for (let k = 0; k < 1000; k++) {
    const x = k / 1000;
    const j = Math.trunc(max / 2 + (max * x) / 2); // the bytecode: d2i((double)max/2 + max*random/2)
    n++;
    if (C.randomCount(max, () => x) !== j || j < Math.floor(max / 2) || j > max) bad++;
  }
  equal(`the random count is the applet's max/2 + max*random/2 (${n})`, bad, 0);
  // The opening choice of the applet's text boxes.
  equal("max steps are the applet's", C.MAX_STEPS, [5, 6, 7, 8, 9, 10, 20, 50, 100]);
}

done("counting");
