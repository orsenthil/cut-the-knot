#!/usr/bin/env node
"use strict";

/*
 * Logic test for compare-fractions/compare-fractions-core.js.
 *
 *   node porting/check-compare-fractions.mjs
 *
 * Exhaustive over all 1..99 for each number where that is cheap: the
 * common-denominator and simplify buttons are compared with a second,
 * literal transcription of the applet's int arithmetic; the cross-
 * multiplication rule (the page's claim) is checked against exact rational
 * comparison for every pair of fractions with parts 1..30; rows and digit
 * nudging are checked on every value.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("compare-fractions/compare-fractions-core.js", "CompareFractionsCore");

// The applet's own Java arithmetic, written a second time.
function gcdJ(a, b) { while (b !== 0) { const t = a % b; a = b; b = t; } return a; }
function commonJ(n1, d1, n2, d2) {
  const g = gcdJ(d1, d2);
  const l = Math.trunc((d1 * d2) / g);
  const a = Math.trunc(l / d1), b = Math.trunc(l / d2);
  return [n1 * a, d1 * a, n2 * b, d2 * b];
}
function simplifyJ(n1, d1, n2, d2) {
  const g1 = gcdJ(n1, d1), g2 = gcdJ(n2, d2);
  if (g1 > 1) { n1 = Math.trunc(n1 / g1); d1 = Math.trunc(d1 / g1); }
  if (g2 > 1) { n2 = Math.trunc(n2 / g2); d2 = Math.trunc(d2 / g2); }
  return [n1, d1, n2, d2];
}

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start({ n1: 3, d1: 4, n2: 2, d2: 3 });
  check("a new game is not over", C.result(s) === null);
  equal("start values", [s.n1, s.d1, s.n2, s.d2], [3, 4, 2, 3]);
  equal("start clamps 0 up to 1", C.start({ n1: 0 }).n1, 1);
  equal("start clamps 500 down to 99", C.start({ d1: 500 }).d1, 99);
  const m = C.move(s, { type: "digit", field: "n1", k: 0, dir: 1 });
  equal("a digit up moves the value by one", m.n1, 4);
  check("a move marks the demo explored", C.result(m) === "done" && m.moves === 1);
  check("the old position is untouched", s.n1 === 3 && s.moves === 0);
  equal("tens digit up adds ten", C.move(C.start({ n1: 25 }), { type: "digit", field: "n1", k: 1, dir: 1 }).n1, 35);
  equal("units digit up carries", C.move(C.start({ n1: 29 }), { type: "digit", field: "n1", k: 0, dir: 1 }).n1, 30);
  equal("down below 1 stays at 1", C.move(C.start({ n1: 1 }), { type: "digit", field: "n1", k: 0, dir: -1 }).n1, 1);
  equal("up above 99 stays at 99", C.move(C.start({ n1: 95 }), { type: "digit", field: "n1", k: 1, dir: 1 }).n1, 99);
  check("a digit that is not written is refused", C.move(s, { type: "digit", field: "n1", k: 1, dir: 1 }) === null);
  check("an unknown move is refused", C.move(s, { type: "nope" }) === null && C.move(s, null) === null);
  equal("setValue clamps", C.setValue(s, "d2", 1000).d2, 99);
  check("setValue refuses a bad field", C.setValue(s, "x", 3) === null);
}

/* -------------------------------------------------- 2. every case, where small */
{
  // Every value 1..99: digit moves stay in range, and the move list is complete.
  let ok = true, count = 0;
  for (let v = 1; v <= 99; v++) {
    const s = C.start({ n1: v });
    for (const m of C.legalMoves(s).filter((x) => x.field === "n1")) {
      const t = C.move(s, m);
      count++;
      if (!t || t.n1 < 1 || t.n1 > 99 || Math.abs(t.n1 - v) > Math.pow(10, m.k)) ok = false;
    }
    if (C.legalMoves(s).filter((x) => x.field === "n1").length !== 2 * String(v).length) ok = false;
  }
  check(`every digit move from every value stays in 1..99 (${count})`, ok && count > 200);

  // The page's claim: N1/D1 > N2/D2 iff N1*D2 > N2*D1, checked against exact comparison.
  let bad = 0, total = 0;
  for (let n1 = 1; n1 <= 30; n1++) for (let d1 = 1; d1 <= 30; d1++) for (let n2 = 1; n2 <= 30; n2++) for (let d2 = 1; d2 <= 30; d2++) {
    total++;
    const g1 = gcdJ(n1, d1), g2 = gcdJ(n2, d2);
    // exact: compare reduced fractions by cross products of the reduced forms
    const a = (n1 / g1) * (d2 / g2), b = (n2 / g2) * (d1 / g1);
    const exact = a > b ? 1 : a < b ? -1 : 0;
    if (C.compare({ n1, d1, n2, d2 }) !== exact) bad++;
    // and the common-denominator route gives the same answer
    const c = C.commonDenominator({ n1, d1, n2, d2 });
    if (c.d1 !== c.d2) bad++;
    if (Math.sign(c.n1 - c.n2) !== exact) bad++;
  }
  equal(`cross multiplication agrees everywhere (${total} pairs)`, bad, 0);

  // Common denominator is the least common multiple, and keeps each value.
  let lcmOk = true;
  for (let d1 = 1; d1 <= 99; d1++) for (let d2 = 1; d2 <= 99; d2++) {
    const c = C.commonDenominator({ n1: 1, d1, n2: 1, d2 });
    let least = 0;
    for (let k = Math.max(d1, d2); ; k++) if (k % d1 === 0 && k % d2 === 0) { least = k; break; }
    if (c.d1 !== least || c.d2 !== least) lcmOk = false;
  }
  check("the common denominator is the least common multiple (9801 pairs)", lcmOk);

  // Simplify gives lowest terms and keeps the value.
  let simpOk = true;
  for (let n = 1; n <= 99; n++) for (let d = 1; d <= 99; d++) {
    const t = C.simplify({ n1: n, d1: d, n2: 1, d2: 1 });
    if (gcdJ(t.n1, t.d1) !== 1 || t.n1 * d !== n * t.d1) simpOk = false;
  }
  check("simplify reaches lowest terms and keeps the value (9801 fractions)", simpOk);

  // Rows: ceil(n/d) rows, n boxes filled in all.
  let rowsOk = true;
  for (let n = 1; n <= 99; n++) for (let d = 1; d <= 99; d++) {
    const r = C.rows(n, d);
    if (r.length !== Math.ceil(n / d) || r.reduce((s, x) => s + x.filled, 0) !== n || r.some((x) => x.width !== d || x.filled < 1 || x.filled > d)) rowsOk = false;
  }
  check("rows hold exactly n filled boxes in ceil(n/d) rows of d", rowsOk);

  // The "too big" rule and the buttons.
  check("99 is not big, 100 is", !C.areBig({ n1: 99, d1: 99, n2: 1, d2: 1 }) && C.areBig({ n1: 100, d1: 1, n2: 1, d2: 1 }));
  const big = C.move(C.start({ d1: 97, d2: 89 }), { type: "common" });
  check("common denominator of 97 and 89 makes numbers too big to draw", big && C.areBig(big) && big.d1 === 8633);
  check("while big, the common-denominator move is refused", C.move(big, { type: "common" }) === null);
  const back = C.move(big, { type: "simplify" });
  check("simplify brings big numbers back", !C.areBig(back) && back.d1 === 97 && back.d2 === 89);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  let diff = 0, total = 0;
  for (let n1 = 1; n1 <= 12; n1++) for (let d1 = 1; d1 <= 99; d1 += 2) for (let n2 = 1; n2 <= 12; n2++) for (let d2 = 1; d2 <= 99; d2 += 3) {
    total++;
    const s = { n1, d1, n2, d2 };
    const c = C.commonDenominator(s);
    if (JSON.stringify([c.n1, c.d1, c.n2, c.d2]) !== JSON.stringify(commonJ(n1, d1, n2, d2))) diff++;
    const t = C.simplify(s);
    if (JSON.stringify([t.n1, t.d1, t.n2, t.d2]) !== JSON.stringify(simplifyJ(n1, d1, n2, d2))) diff++;
  }
  equal(`the core matches the literal applet transcription (${total} positions)`, diff, 0);
}

done("compare-fractions");
