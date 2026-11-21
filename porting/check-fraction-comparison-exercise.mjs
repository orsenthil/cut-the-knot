#!/usr/bin/env node
"use strict";

/*
 * Logic test for fraction-comparison-exercise/fraction-comparison-exercise-core.js.
 *
 *   node porting/check-fraction-comparison-exercise.mjs
 *
 * The correct relation is compared with exact fraction arithmetic (cross-multiplication and, independently, a
 * common denominator) for every pair of fractions with numerators and denominators 1 to 30 (810,000 pairs);
 * 200,000 generated pairs follow the applet's ranges and always differ as written; scoring and messages follow
 * the applet (one answer per pair; Problems counts each pair; "Correct!" and "Oops... a/b sign c/d!").
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("fraction-comparison-exercise/fraction-comparison-exercise-core.js", "FractionComparisonExerciseCore");

{
  const s = C.start({ n1: 7, d1: 12, n2: 4, d2: 9 });
  check("the exercise starts at problem 1 with nothing answered", s.problems === 1 && s.solved === 0 && s.answered === -1 && C.result(s) === null);
  equal("7/12 against 4/9 is >", C.SIGNS[C.relation(s)], ">");
  const ok = C.move(s, { type: "answer", sign: 2 }), bad = C.move(s, { type: "answer", sign: 0 });
  check("the right sign says Correct! and scores, the wrong one says Oops... with the true relation and does not", C.remark(ok) === "Correct!" && ok.solved === 1 && C.result(ok) === "win" && C.remark(bad) === "Oops... 7/12 > 4/9!" && bad.solved === 0 && C.result(bad) === "lose");
  check("only one answer per pair, and only <, = or >", C.move(ok, { type: "answer", sign: 1 }) === null && C.move(s, { type: "answer", sign: 3 }) === null);
  const n = C.move(ok, { type: "next", seed: 9 });
  check("the next pair counts as a problem and keeps the score; Reset scores starts again", n.problems === 2 && n.solved === 1 && n.answered === -1 && C.move(n, { type: "restart", seed: 3 }).problems === 1 && C.move(n, { type: "restart", seed: 3 }).solved === 0);
  check("the common denominator needs the graphics, and switching the graphics off clears it", C.move(s, { type: "common", value: true }) === null && C.move(C.move(s, { type: "graphics", value: true }), { type: "common", value: true }).common === true && C.move(C.move(C.move(s, { type: "graphics", value: true }), { type: "common", value: true }), { type: "graphics", value: false }).common === false);
  check("the old position is untouched", s.answered === -1 && s.moves === 0);
  equal("equal fractions: 2/4 against 3/6 is =", C.SIGNS[C.relation({ n1: 2, d1: 4, n2: 3, d2: 6 })], "=");
}

{
  let n = 0, bad = null;
  for (let n1 = 1; n1 <= 30; n1++) for (let d1 = 1; d1 <= 30; d1++) for (let n2 = 1; n2 <= 30; n2 += 1) for (let d2 = 1; d2 <= 30; d2 += 1) {
    const l = C.lcm(d1, d2);
    const a = n1 * (l / d1), b = n2 * (l / d2); // over a common denominator
    const rel = a === b ? 1 : a > b ? 2 : 0;
    if (C.relation({ n1, d1, n2, d2 }) !== rel) bad = `${n1}/${d1} ${n2}/${d2}`;
    n++;
  }
  check(`the relation by cross-multiplication equals the one by a common denominator for ${n} pairs of fractions up to 30`, bad === null, String(bad));
  let b2 = null, eq = 0, proper = 0, total = 200000;
  for (let seed = 1; seed <= total && !b2; seed++) {
    const p = C.problem(C.rng(seed));
    if (p.n1 === p.n2 && p.d1 === p.d2) b2 = `same as written seed ${seed}`;
    if (p.d1 < 1 || p.d1 > 27 || p.d2 < 1 || p.d2 > 27 || p.n1 < 1 || p.n2 < 1) b2 = `range ${JSON.stringify(p)}`;
    if (p.n1 * p.d2 === p.n2 * p.d1) eq++;
    if (p.n1 < p.d1 && p.n2 < p.d2) proper++;
  }
  check(`200,000 generated pairs: they always differ as written; equal values in ${(100 * eq / total).toFixed(1)}%; both proper in ${(100 * proper / total).toFixed(0)}%`, b2 === null && eq > 0.05 * total && eq < 0.09 * total && proper > 0.3 * total);
  let sums = 0; for (let seed = 1; seed <= 5000; seed++) { const p = C.problem(C.rng(seed)); if (C.relation(p) === 1) sums++; }
  check("a pair can be equal, less or greater: all three answers occur among the generated pairs", sums > 0 && Array.from({ length: 3000 }, (_, i) => C.relation(C.problem(C.rng(i + 1)))).every((r) => r >= 0 && r <= 2) && new Set(Array.from({ length: 3000 }, (_, i) => C.relation(C.problem(C.rng(i + 1))))).size === 3);
}

done("fraction-comparison-exercise");
