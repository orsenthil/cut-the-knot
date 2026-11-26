#!/usr/bin/env node
"use strict";

/*
 * Logic test for more-less-equal/more-less-equal-core.js.
 *
 *   node porting/check-more-less-equal.mjs
 *
 * 1. The core's sign against a literal transcription of the applet's
 *    SimpleEquation.Compute, for every a, b, c in -25..25 and all four
 *    operations (530,604 equations).
 * 2. The sign against exact arithmetic: for ÷, the true value of a/b
 *    compared with c, and "no value" exactly when b = 0.
 * 3. The page's claim from 1 + 1 = 2: adding one to a number on the left
 *    keeps the equation true only if one is also added on the right,
 *    checked for every true sum in the range.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("more-less-equal/more-less-equal-core.js", "MoreLessEqualCore");

/** Compute(), straight from the bytecode: op 0 +, 1 ×, 2 −, 3 ÷. */
function compute(op, L2, L3, L4) {
  let L5;
  switch (op) {
    case 0: L5 = L2 + L3; break;
    case 2: L5 = L2 - L3; break;
    case 1: L5 = Math.imul(L2, L3); break;
    case 3:
      if (Math.imul(L3, L4) > L2) return L3 > 0 ? " <" : L3 !== 0 ? " >" : " <>";
      if (Math.imul(L3, L4) < L2) return L3 > 0 ? " >" : L3 !== 0 ? " <" : " <>";
      return L3 !== 0 ? " =" : " <>";
  }
  if (L5 > L4) return " >";
  if (L5 < L4) return " <";
  return " =";
}
const CODE = { "+": 0, "x": 1, "-": 2, "/": 3 };

/* --------------------------------------------- 1. against the applet */
{
  let n = 0, bad = 0, exact = 0, noValue = 0;
  for (const op of C.OPS) {
    for (let a = -25; a <= 25; a++) for (let b = -25; b <= 25; b++) for (let c = -25; c <= 25; c++) {
      const s = { a, b, c, op };
      const r = C.relation(s);
      if (" " + r !== compute(CODE[op], a, b, c)) bad++;
      // 2. exact arithmetic
      let truth;
      if (op === "/") {
        if (b === 0) truth = "<>";
        else { const v = a / b; truth = Math.abs(v - c) < 1e-12 ? "=" : v > c ? ">" : "<"; }
      } else {
        const v = op === "+" ? a + b : op === "-" ? a - b : a * b;
        truth = v > c ? ">" : v < c ? "<" : "=";
      }
      if (truth !== r) exact++;
      if (r === "<>" && b !== 0) noValue++;
      n++;
    }
  }
  equal("equations compared", n, 4 * 51 * 51 * 51);
  equal("the core agrees with the applet's Compute on every one", bad, 0);
  equal("and with exact arithmetic (a/b compared with c as a real number)", exact, 0);
  equal("'no value' appears only when dividing by 0", noValue, 0);
}

/* --------------------------------------------- 3. the page's claims */
{
  const s = C.start();
  equal("it starts at 1 + 1 = 2", C.text(s), "1 + 1 = 2");
  let ok = true;
  for (let a = -20; a <= 20; a++) for (let b = -20; b <= 20; b++) {
    const t = { a, b, c: a + b, op: "+" };
    for (const w of ["a", "b"]) {
      const up = C.nudge(t, w, 1);
      if (C.relation(up) !== ">") ok = false;          // left now more
      if (C.relation(C.nudge(up, "c", 1)) !== "=") ok = false; // balanced again
    }
  }
  check("adding 1 on the left needs 1 added on the right, for every true sum", ok);
  equal("1 + 2 is more than 2", C.relation(C.nudge(s, "b", 1)), ">");
  equal("a negative middle number is bracketed", C.text({ a: 3, b: -2, c: 1, op: "-" }), "3 − (-2) > 1");
  equal("6 ÷ 0 has no value", C.text({ a: 6, b: 0, c: 1, op: "/" }), "6 ÷ 0 ≠ 1");
  equal("0 ÷ 0 has no value either", C.relation({ a: 0, b: 0, c: 5, op: "/" }), "<>");
  equal("7 ÷ (-2) < -3", C.relation({ a: 7, b: -2, c: -3, op: "/" }), "<");
  equal("7 ÷ 2 is 7/2", C.leftValue({ a: 7, b: 2, c: 3, op: "/" }), "7/2");
  equal("switching operation keeps the numbers", JSON.stringify(C.setOp(s, "x")), JSON.stringify({ a: 1, b: 1, c: 2, op: "x" }));
  check("a bad move is refused", C.nudge(s, "d", 1) === null && C.nudge(s, "a", 2) === null && C.setOp(s, "%") === null);
  const before = JSON.stringify(s);
  C.nudge(s, "a", 1);
  equal("nudge leaves the old position alone", JSON.stringify(s), before);
}

done("more-less-equal");
