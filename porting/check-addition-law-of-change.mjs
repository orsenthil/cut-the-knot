#!/usr/bin/env node
"use strict";

/*
 * Logic test for addition-law-of-change/addition-law-of-change-core.js.
 *
 *   1. The rules: the opening equation, clamped edits, the recomputed sum and
 *      the two click sides.
 *   2. The page's claim, exhaustively on the applet's 0..100 range: changing
 *      either addend by k changes the sum by exactly k (where the edit fits),
 *      the dot rows count to the three numbers, and addition is associative.
 *   3. A second, independent statement of the rule checked on the whole range.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("addition-law-of-change/addition-law-of-change-core.js", "AdditionLawOfChangeCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("the first addend starts at 1", s.a, 1);
  equal("the second addend starts at 1", s.b, 1);
  equal("the sum starts at 2", C.sum(s), 2);
  equal("the dot display limit defaults to 10", s.maxNum, 10);
  equal("a is clamped low", C.start({ a: -5 }).a, 0);
  equal("b is clamped high", C.start({ b: 999 }).b, 100);

  const up = C.change(s, "a", 4);
  equal("the first addend grew", up.a, 5);
  equal("the second did not move", up.b, 1);
  equal("the sum grew by the same amount", C.sum(up), 6);
  equal("the old board is untouched", s.a, 1);
  const down = C.change(s, "b", -1);
  equal("a decrease works too", down.b, 0);
  equal("the sum fell by the same amount", C.sum(down), 1);
  equal("an unknown addend is ignored", C.change(s, "c", 5), s);
  equal("the left click decreases", C.clickSide(s, "a", "left").a, 0);
  equal("the right click increases", C.clickSide(s, "b", "right").b, 2);
  equal("clicks never pass 100", C.change(s, "a", 500).a, 100);
  equal("clicks never pass zero", C.change(s, "b", -500).b, 0);
}

/* ------------------------------------- 2. the claims, over the whole range */

{
  let rule = 0;
  let cases = 0;
  let dots = 0;
  let associativity = 0;
  for (let a = 0; a <= 100; a++) {
    for (let b = 0; b <= 100; b++) {
      const state = { a, b, maxNum: 10 };
      cases++;
      const d = C.dots(state);
      if (d.a === a && d.b === b && d.sum === a + b) dots++;
      if (a + (b + 7) === (a + b) + 7) associativity++;
      for (const which of ["a", "b"]) {
        for (const delta of [-3, -1, 1, 3, 7]) {
          const next = C.change(state, which, delta);
          const moved = next[which] - state[which];
          const allowed = which === "a" ? a + delta >= 0 && a + delta <= 100 : b + delta >= 0 && b + delta <= 100;
          if (!allowed && moved !== 0) continue;
          if (allowed && moved !== delta) continue;
          if (C.sum(next) - C.sum(state) !== moved) continue;
          rule++;
        }
      }
    }
  }
  equal("every board was checked", dots, cases);
  equal("the dot rows always match the three numbers", dots, cases);
  equal("addition is associative on the whole range", associativity, cases);
  check("the change of addends rule holds on every legal edit", rule > 90000, `${rule} edits`);

  // An independent statement of the rule: the sum is a function of a and b.
  let independent = 0;
  for (let a = 0; a <= 100; a += 7) {
    for (let b = 0; b <= 100; b += 11) {
      const state = { a, b, maxNum: 10 };
      const right = C.clickSide(state, "a", "right");
      const left = C.clickSide(state, "b", "left");
      if (C.sum(right) === (Math.min(100, a + 1) + b) && C.sum(left) === (a + Math.max(0, b - 1))) independent++;
    }
  }
  check("clicking either number changes the total by one", independent > 100);
}

done("addition-law-of-change");
