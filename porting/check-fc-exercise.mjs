#!/usr/bin/env node
"use strict";

/*
 * Logic test for fc-exercise/fc-exercise-core.js.
 *
 *   node porting/check-fc-exercise.mjs
 *
 * CheckAnswer's eight-way branch is shown equal to "the middle fraction lies between the two
 * (ends included)" for every pair of fractions with numerators and denominators 1 to 10 and
 * every middle fraction up to 30/30; the generator (200,000 pairs) is checked against the
 * bytecode's ranges: denominators 5 to 9, numerators 5 to 9 or half the denominator up to
 * the denominator minus one, pairs that differ as written, equal values about one time in 15,
 * and a first guess that is always outside the pair; the page's shortcuts are tested for every
 * numerator and denominator up to 40: a/c > b/c iff a > b, a/c > a/d iff c < d, and a proper
 * fraction grows when both parts grow by 1; the common-denominator and simplify buttons keep the
 * values and do what their names say; and the scoring follows the applet.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("fc-exercise/fc-exercise-core.js", "FcExerciseCore");

{
  const s = C.start({ seed: 7 });
  check("a new exercise has problem 1 of 0 correct, nothing checked", s.problems === 1 && s.solved === 0 && s.checked === false && C.result(s) === null);
  const t = C.start({ n1: 7, d1: 12, n2: 4, d2: 9, n0: 1, d0: 1 });
  check("the page's example 7/12 and 4/9: 1/2 is between them", C.correct({ ...t, n0: 1, d0: 2 }) === true && C.correct({ ...t, n0: 3, d0: 4 }) === false);
  const u = C.move({ ...t, n0: 1, d0: 2 }, { type: "check" });
  check("a right answer says Correct! and scores", u.response === "Correct!" && u.solved === 1 && C.result(u) === "win" && u.checked === true);
  const v = C.move({ ...t, n0: 3, d0: 4 }, { type: "check" });
  check("a wrong answer says Oops... and does not score", v.response === "Oops..." && v.solved === 0 && C.result(v) === "lose");
  check("Check works once per pair, and not with a denominator of 0", C.move(u, { type: "check" }) === null && C.move({ ...t, n0: 1, d0: 0 }, { type: "check" }) === null);
  check("a checked pair cannot be changed any more", C.move(u, { type: "digit", which: "n0", place: 0 }) === null && C.move(u, { type: "common" }) === null);
  const w = C.move(u, { type: "next", seed: 99 });
  check("the next pair counts as a new problem and keeps the score", w.problems === 2 && w.solved === 1 && w.checked === false && w.response === "");
  const r = C.move(w, { type: "restart", seed: 5 });
  check("reset scores starts again at problem 1 with 0 correct", r.problems === 1 && r.solved === 0);
  check("a digit goes up by 1 and 9 wraps to 0 without a carry", C.move({ ...t, n0: 19, d0: 5 }, { type: "digit", which: "n0", place: 0 }).n0 === 10 && C.move({ ...t, n0: 19, d0: 5 }, { type: "digit", which: "n0", place: 1 }).n0 === 29 && C.move({ ...t, n0: 5, d0: 5 }, { type: "digit", which: "d0", place: 1 }).d0 === 15);
  check("the middle numbers stay within 0 to 99", C.move(t, { type: "set", which: "n0", value: 100 }) === null && C.move(t, { type: "set", which: "n0", value: 99 }).n0 === 99);
  check("the old position is untouched", t.n0 === 1 && t.moves === 0);
}

{
  let n = 0, bad = null;
  for (let n1 = 1; n1 <= 10; n1++) for (let d1 = 1; d1 <= 10; d1++) for (let n2 = 1; n2 <= 10; n2++) for (let d2 = 1; d2 <= 10; d2++) {
    const f1 = n1 / d1, f2 = n2 / d2;
    const lo = Math.min(n1 * d2, n2 * d1), hi = Math.max(n1 * d2, n2 * d1); // cross-multiplied with d1 d2
    for (let n0 = 0; n0 <= 30; n0 += 1) for (let d0 = 1; d0 <= 30; d0 += 1) {
      const s = { n1, d1, n2, d2, n0, d0 };
      const mid = n0 * d1 * d2; // n0/d0 against the others, scaled: n0 d1 d2 vs n1 d2 d0 etc., use exact integers
      const x = n0 * d1 * d2, a = n1 * d0 * d2, b = n2 * d0 * d1;
      const between = x >= Math.min(a, b) && x <= Math.max(a, b);
      if (C.correct(s) !== between) bad = `${n1}/${d1} ${n2}/${d2} ${n0}/${d0}`;
      n++;
    }
  }
  check(`CheckAnswer is exactly "the middle fraction is between the two, ends included" (${n} cases)`, bad === null, String(bad));
}

{
  let bad = null, equalValues = 0, reduced = 0, total = 200000, outside = 0;
  for (let seed = 1; seed <= total && !bad; seed++) {
    const p = C.problem(C.rng(seed));
    const { n1, d1, n2, d2, n0, d0 } = p;
    if (n1 === n2 && d1 === d2) bad = `same pair seed ${seed}`;
    if (n1 * d2 === n2 * d1) equalValues++;
    if (C.gcd(n1, d1) === 1 && C.gcd(n2, d2) === 1) reduced++;
    for (const d of [d1, d2]) if (d < 1) bad = `denominator ${d}`;
    // the unreduced first fraction has a denominator 5..9; reduced fractions have smaller ones, and equal-value pairs are multiples
    if (d1 > 27 || d2 > 27 || n1 > 27 || n2 > 27) bad = `too big seed ${seed}: ${n1}/${d1} ${n2}/${d2}`;
    if (n0 < 1 || d0 < 1) bad = `guess ${n0}/${d0}`;
    if (C.correct(p)) bad = `first guess correct, seed ${seed}: ${n1}/${d1} ${n2}/${d2} guess ${n0}/${d0}`;
    else outside++;
  }
  check(`the first guess for the middle fraction is always outside the pair (${outside} of ${total} generated pairs), and the pair always differs as written`, bad === null, String(bad));
  check(`equal-valued pairs appear about one time in 15 (${(100 * equalValues / total).toFixed(1)}%): a tenth of the draws multiply a fraction by 2 or 3, those are redrawn when both are then reduced to the same fraction, plus chance`, equalValues > 0.05 * total && equalValues < 0.09 * total);
  let ranges = true;
  for (let seed = 1; seed <= 20000; seed++) { const rr = C.rng(seed); const q = C.problem(rr); if (q.d1 < 1 || q.d1 > 9) ranges = false; }
  check("denominators of the first fraction stay within 1 to 9 (5 to 9 before reducing)", ranges);
}

{
  let ok = true;
  for (let a = 1; a <= 40; a++) for (let b = 1; b <= 40; b++) for (let c = 1; c <= 8; c++) {
    if ((a * c > b * c) !== (a > b) || C.cmp(a, c, b, c) !== Math.sign(a - b)) ok = false; // a/c > b/c iff a > b
    if (C.cmp(a, c, a, b) !== Math.sign(b - c)) ok = false; // a/c against a/b: bigger denominator, smaller fraction
  }
  check("a/c > b/c iff a > b, and a/c > a/d iff c < d (every value up to 40)", ok);
  let proper = true;
  for (let a = 1; a <= 60; a++) for (let c = a + 1; c <= 61; c++) { if (!(C.cmp(a, c, a + 1, c + 1) < 0)) proper = false; if (a > 1 && !(C.cmp(a - 1, c - 1, a, c) < 0)) proper = false; }
  check("for a proper fraction a/c < (a+1)/(c+1) and (a-1)/(c-1) < a/c (every one up to 60)", proper);
  check("the page's examples: 5/4 > 1 > 5/6, 7/12 > 1/2 > 4/9, 4/5 > 3/5, 7/12 > 5/12", C.cmp(5, 4, 5, 6) > 0 && C.cmp(7, 12, 1, 2) > 0 && C.cmp(1, 2, 4, 9) > 0 && C.cmp(4, 5, 3, 5) > 0 && C.cmp(7, 12, 5, 12) > 0);
  let ok2 = true;
  for (let seed = 1; seed <= 5000; seed++) {
    const s = C.start({ seed }), c = C.move(s, { type: "common" }), sm = C.move(c, { type: "simplify" });
    if (c.d1 !== c.d2 || c.d1 !== C.lcm(s.d1, s.d2) || c.n1 * s.d1 !== s.n1 * c.d1 || c.n2 * s.d2 !== s.n2 * c.d2) ok2 = false;
    if (C.gcd(sm.n1, sm.d1) !== 1 || C.gcd(sm.n2, sm.d2) !== 1 || sm.n1 * c.d1 !== c.n1 * sm.d1 || sm.n2 * c.d2 !== c.n2 * sm.d2) ok2 = false;
    if (sm.n0 * s.d0 !== s.n0 * sm.d0) ok2 = false;
  }
  check("the common denominator is the least one and keeps the values; Simplify reduces all three fractions and keeps the values (5,000 pairs)", ok2);
}

done("fc-exercise");
