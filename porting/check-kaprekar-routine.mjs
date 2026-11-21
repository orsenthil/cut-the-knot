#!/usr/bin/env node
"use strict";

/*
 * Logic test for kaprekar-routine/kaprekar-routine-core.js.
 *
 *   1. Digits, sorting and the step on the page's 6174 and 999 examples.
 *   2. Exhaustive convergence: every non-repdigit 3- and 4-digit decimal start
 *      reaches 495 or 6174 in at most seven steps when padded; without padding
 *      1121 falls to zero; repdigits give zero.
 *   3. Other bases/widths with a unique constant, and the controls.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("kaprekar-routine/kaprekar-routine-core.js", "KaprekarRoutineCore");

{
  equal("digits of 3524", C.digits(3524, 10, 4).join(","), "3,5,2,4");
  equal("padded digits of 7", C.digits(7, 10, 4).join(","), "0,0,0,7");
  equal("value of digits", C.value([6, 1, 7, 4], 10), 6174);
  equal("descending sort", C.sorted(3524, 10, 4, true, false), 5432);
  equal("ascending sort", C.sorted(3524, 10, 4, true, true), 2345);
  const s = C.step(6174, 10, 4, true);
  equal("6174 descending", s.desc, 7641);
  equal("6174 ascending", s.asc, 1467);
  equal("difference", s.diff, 6174);
  check("6174 is a fixed point", s.fixed);
  const p = C.step(999, 10, 4, true);
  equal("999 padded descending", p.desc, 9990);
  equal("999 padded ascending", p.asc, 999);
  equal("999 padded difference", p.diff, 8991);
  equal("repdigit detected", C.isRepdigit(1111, 10, 4, true), true);
}

{
  let converged = 0;
  let cases = 0;
  let withinSeven = 0;
  for (let n = 0; n < 10000; n++) {
    if (C.isRepdigit(n, 10, 4, true)) continue;
    const r = C.iterate(n, 10, 4, true);
    cases++;
    if (r.fixed && r.result === 6174) converged++;
    if (r.count <= 8) withinSeven++;
  }
  equal("all non-repdigit four-digit starts checked", cases, 9999 - 9);
  equal("all reach 6174", converged, cases);
  equal("all finish within seven transitions (eight rows)", withinSeven, cases);

  let three = 0;
  let threeOk = 0;
  for (let n = 0; n < 1000; n++) {
    if (C.isRepdigit(n, 10, 3, true)) continue;
    three++;
    if (C.iterate(n, 10, 3, true).result === 495) threeOk++;
  }
  equal("all three-digit starts checked", three, 990);
  equal("all reach 495", threeOk, three);
}

{
  const natural = C.iterate(1121, 10, 4, false);
  check("1121 falls to zero without padding", natural.zero && natural.result === 0);
  check("the page's first subtraction is 2111 - 1112 = 999", natural.steps[0].diff === 999);
  check("a repdigit gives zero", C.iterate(2222, 10, 4, true).zero);
  equal("constant in base 10, four digits", C.constant(10, 4), 6174);
  equal("constant in base 10, three digits", C.constant(10, 3), 495);
  equal("constant in base 8, three digits", C.constant(8, 3), 252);
  check("no unique constant in base 5, three digits", C.constant(5, 3) === null);

  const s = C.start();
  equal("default start", s.start, 3524);
  equal("base clamped", C.setBase(s, 99).base, 16);
  equal("width clamped", C.setWidth(s, 99).width, 6);
  equal("start clamped", C.setStart(s, 99999).start, 9999);
}

done("kaprekar-routine");
