#!/usr/bin/env node
"use strict";

/*
 * Logic test for egyptian-multiplication/egyptian-multiplication-core.js.
 *
 *   node porting/check-egyptian-multiplication.mjs
 *
 * The algorithm is tried on EVERY a from 1 to 9999 (the applet's range) against
 * several b, and on every pair up to 400 by 400: the entries beside the chosen
 * powers add up to a*b, the chosen powers are exactly the 1-bits of a in binary
 * (so they sum to a and each is used once), the left column stops at the largest
 * power not above a (floor(log2 a) + 1 rows) and the right column is b doubled
 * each time. The page's example 85 x 18 = 1530 (64 + 16 + 4 + 1) is checked too,
 * and a second method (the Russian peasant's halving and doubling) is compared
 * over the whole range.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("egyptian-multiplication/egyptian-multiplication-core.js", "EgyptianMultiplicationCore");

{
  const t = C.table(85, 18);
  equal("the page's example: 85 x 18 = 1530", t.product, 1530);
  equal("its powers of two are 1, 4, 16 and 64", t.chosen.join(), "1,4,16,64");
  equal("the left column has 7 rows, 1 to 64", t.rows.map((r) => r.power).join(), "1,2,4,8,16,32,64");
  equal("the right column is 18 doubled each time", t.rows.map((r) => r.double).join(), "18,36,72,144,288,576,1152");
  check("a new game has two numbers of two digits, the first at least 1", (() => { const s = C.start({}); return s.digits === 2 && s.a >= 10 && s.a <= 99 && s.b >= 10 && s.b <= 99; })());
  check("the number of digits runs from 1 to 4", C.start({ digits: 0 }).digits === 1 && C.start({ digits: 9 }).digits === 4 && C.move(C.start({}), { type: "digits", value: 5 }) === null && C.move(C.start({}), { type: "digits", value: 4 }).a >= 1000);
  const s = C.start({ a: 85, b: 18 });
  check("autonomous: a digit goes up by 1 and 9 wraps to 0 without carrying", C.move(s, { type: "digit", which: "a", place: 0 }).a === 86 && C.move({ ...s, a: 89 }, { type: "digit", which: "a", place: 0 }).a === 80);
  check("not autonomous: the number goes up by the place value, round the top", C.move({ ...s, autonomous: false, a: 99 }, { type: "digit", which: "b", place: 0 }).b === 19 && C.move({ ...s, autonomous: false, b: 99 }, { type: "digit", which: "b", place: 0 }).b === 0 && C.move({ ...s, autonomous: false }, { type: "digit", which: "b", place: 1 }).b === 28);
  check("the first multiplicand can never become 0", C.move({ ...s, digits: 1, a: 9 }, { type: "digit", which: "a", place: 0 }) === null || C.move({ ...s, digits: 1, a: 9 }, { type: "digit", which: "a", place: 0 }).a >= 1);
  check("a number cannot have more digits than the board", C.move(s, { type: "digit", which: "a", place: 2 }) === null && C.move(s, { type: "set", which: "a", value: 100 }) === null);
  check("the old position is untouched", s.a === 85 && s.moves === 0);
  check("any move marks the position done", C.result(s) === null && C.result(C.move(s, { type: "digit", which: "b", place: 0 })) === "done");
}

{
  let n = 0, bad = null;
  const peasant = (a, b) => { let r = 0; while (a > 0) { if (a & 1) r += b; a >>= 1; b *= 2; } return r; };
  for (let a = 1; a <= 9999; a++) {
    for (const b of [0, 1, 7, 18, 9999]) {
      const t = C.table(a, b);
      if (t.product !== a * b) bad = `product ${a}x${b}`;
      if (t.sumOfPowers !== a) bad = `powers ${a}`;
      if (t.leftOver !== 0) bad = `left ${a}`;
      if (t.rows.length !== Math.floor(Math.log2(a)) + 1) bad = `rows ${a}`;
      if (t.rows[t.rows.length - 1].power > a || t.rows[t.rows.length - 1].power * 2 <= a) bad = `last power ${a}`;
      if (t.chosen.map((p) => Math.log2(p)).join() !== [...a.toString(2)].reverse().map((c, i) => (c === "1" ? i : -1)).filter((i) => i >= 0).join()) bad = `bits ${a}`;
      if (peasant(a, b) !== t.product) bad = `peasant ${a}x${b}`;
      n++;
    }
  }
  check(`every a from 1 to 9999 (with five b each, ${n} products): product, powers, rows and binary digits`, bad === null, String(bad));
  let m = 0, bad2 = null;
  for (let a = 1; a <= 400; a++) for (let b = 0; b <= 400; b++) { if (C.table(a, b).product !== a * b) bad2 = `${a}x${b}`; m++; }
  check(`every pair up to 400 by 400 (${m} products)`, bad2 === null, String(bad2));
  let mono = true;
  for (let a = 1; a < 5000; a++) { const t = C.table(a, 3), r = C.table(a + 1, 3); if (r.rows.length < t.rows.length) mono = false; }
  check("a power of two has exactly one chosen row; the left column grows by one row at each power of two", C.table(64, 5).chosen.join() === "64" && C.table(63, 5).chosen.length === 6 && C.table(64, 5).rows.length === 7 && C.table(63, 5).rows.length === 6 && mono);
}

done("egyptian-multiplication");
