#!/usr/bin/env node
"use strict";

/*
 * Logic test for self-descriptive/self-descriptive-core.js.
 *
 *   node porting/check-self-descriptive.mjs
 *
 * 1. The written counts and the digit counting are checked against a second
 *    transcription of BaseSys.ConvertNum and SelfDescriptiveSentence.Count.
 * 2. Every count tuple up to 15 is tested for bases 2..5: a tuple is a fixed
 *    point exactly when the sentence is true. The page's claims are checked:
 *    base 3 has three solutions, the (1, 11, 2, 1...) pattern solves every
 *    base 3..10, and the (1, b-3, 3, 2, 1..., 2, 1, 1) pattern solves bases
 *    7..10.
 * 3. Iterations reach a true sentence from the usual start, but some other
 *    starts cycle; both are checked.
 * 4. Options, ranges, messages and plain JSON.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("self-descriptive/self-descriptive-core.js", "SelfDescriptiveCore");

/** BaseSys.ConvertNum for bases up to ten, written again. */
function jWrite(value, base) {
  if (value === 0) return "0";
  const stack = [];
  let v = value;
  while (v >= base) {
    stack.push("0123456789"[v % base]);
    v = Math.floor(v / base);
  }
  stack.push("0123456789"[v]);
  return stack.reverse().join("");
}

/** SelfDescriptiveSentence.Count: labels contribute one occurrence each. */
function jCount(counts, base) {
  const out = new Array(base).fill(1);
  for (const value of counts) {
    for (const ch of jWrite(value, base)) {
      const d = "0123456789".indexOf(ch);
      if (d >= 0 && d < base) out[d]++;
    }
  }
  return out;
}

function* tuples(base, max) {
  const total = (max + 1) ** base;
  for (let n = 0; n < total; n++) {
    let x = n;
    const row = new Array(base);
    for (let i = base - 1; i >= 0; i--) {
      row[i] = x % (max + 1);
      x = Math.floor(x / (max + 1));
    }
    yield row;
  }
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("the applet starts in base ten", s.base, 10);
  equal("ten digits to count", s.counts.length, 10);
  check("the counts start at one each", s.counts.every((v) => v === 1));
  equal("the base slider runs from 2 to 10", [C.MIN_BASE, C.MAX_BASE], [2, 10]);
  equal("a count is capped at 99", C.MAX_COUNT, 99);
  check("no history at the start", s.history.length === 0 && C.result(s) === null);
  equal("base ten writes eleven as B? no: as 11 in base ten", C.write(11, 10), "11");
  equal("eleven in base seven is 14", C.write(11, 7), "14");
  equal("zero writes as 0", C.write(0, 3), "0");
  equal("the labels contribute one each in base three", C.countDigits([1, 1, 1], 3), [1, 4, 1]);
  equal("the page's base-three example is true", C.start({ base: 3, counts: [1, 4, 2] }).counts, [1, 4, 2]);
  check("the base-three example is recognised", C.trueCounts([1, 4, 2], 3));
  check("a false sentence is recognised", !C.trueCounts([1, 1, 1], 3));
  check("the message explains Iterate", s.message.includes("Iterate"));
}

/* ----------------- 2. counting, against a second transcription and brute force */

{
  let same = true;
  let detail = "";
  let cases = 0;
  for (let base = 2; base <= 10; base++) {
    for (const counts of [[1, 1, 1, 1], [0, 2, 11, 3], [99, 7, 5, 12], [9, 8, 7, 6]]) {
      const reduced = counts.slice(0, base).map((v) => v % 100);
      while (reduced.length < base) reduced.push(0);
      cases++;
      if (JSON.stringify(C.countDigits(reduced, base)) !== JSON.stringify(jCount(reduced, base)) ||
          C.write(reduced[0], base) !== jWrite(reduced[0], base)) {
        same = false;
        detail = `base ${base} ${JSON.stringify(reduced)}`;
        break;
      }
    }
    if (!same) break;
  }
  check(`counting matches a second transcription in ${cases} cases`, same, detail);

  const expected = { 2: 1, 3: 3, 4: 3, 5: 2 };
  for (const [text, base] of Object.keys(expected).map((k) => [k, Number(k)])) {
    const found = [];
    for (const row of tuples(base, 15)) if (C.trueCounts(row, base)) found.push(row.join(","));
    equal(`base ${text} has ${expected[base]} true sentences up to 15`, found.length, expected[base]);
  }
  equal("the three base-three solutions are the page's",
    [...new Set([...tuples(3, 15)].filter((r) => C.trueCounts(r, 3)).map((r) => r.join(",")))].sort(),
    ["1,4,2", "2,2,3", "3,3,2"]);
}

/* ----------------------------------------- 3. the page's two solution families */

{
  let prop1 = true;
  for (let base = 3; base <= 10; base++) {
    const row = new Array(base).fill(1);
    row[1] = base + 1; // "11" in base b
    row[2] = 2;
    if (!C.trueCounts(row, base)) prop1 = false;
  }
  check("Proposition 1 holds in bases 3..10: 1, 11, 2, 1, ...", prop1);
  equal("that pattern in base three is written 1, 11, 2", C.start({ base: 3, counts: [1, 4, 2] }).counts.map((v) => C.write(v, 3)), ["1", "11", "2"]);

  let prop2 = true;
  for (let base = 7; base <= 10; base++) {
    const row = [1, base - 3, 3, 2];
    for (let i = 0; i < base - 7; i++) row.push(1);
    row.push(2, 1, 1);
    if (row.length !== base || !C.trueCounts(row, base)) prop2 = false;
  }
  check("Proposition 2 holds in bases 7..10: 1, b-3, 3, 2, 1..., 2, 1, 1", prop2);

  // Iteration usually finds the first family, but not every start converges.
  let s = C.start({ base: 3 });
  for (let i = 0; i < 3; i++) s = C.iterate(s);
  equal("iterating in base three reaches the first solution in three steps", s.counts, [1, 4, 2]);
  check("and is recognised as true", C.result(s) === "done");
  check("the message says so in words", s.message.includes("True after 3 steps"));

  s = C.start({ base: 3, counts: [0, 0, 4] });
  const seen = new Set();
  let cycle = 0;
  for (let i = 0; i < 12; i++) {
    const key = s.counts.join(",");
    if (seen.has(key)) { cycle++; break; }
    seen.add(key);
    s = C.iterate(s);
  }
  check("some starts settle into a cycle instead of a solution", cycle === 1 && C.result(s) === null);
}

/* ------------------------------------- 4. options, messages and plain JSON */

{
  const base = C.start({ base: 4, counts: [1, 1, 1, 1] });
  const bumped = C.setCount(base, 1, 2);
  equal("clicking a count changes just that entry", bumped.counts, [1, 3, 1, 1]);
  check("the click is reported in words", bumped.message.includes("Digit 1 now appears 3 times"));
  equal("a count cannot go below zero", C.setCount(base, 0, -1).counts[0], 0);
  equal("a count stops at 99", C.setCount(base, 0, 999).counts[0], 99);
  equal("an edit outside the sentence does nothing", C.setCount(base, 9, 1), base);
  const newBase = C.setBase(base, 8);
  equal("changing the base resets to that many ones", newBase.counts, [1, 1, 1, 1, 1, 1, 1, 1]);
  check("the base change is reported", newBase.message.includes("Base 8"));
  equal("base below two is clamped", C.setBase(base, 1).base, 2);
  equal("base above ten is clamped", C.setBase(base, 99).base, 10);
  const iterated = C.iterate(base);
  equal("each iteration records one line", iterated.history.length, 1);
  equal("and counts one step", iterated.iterations, 1);
  const cleared = C.clearHistory(iterated);
  equal("Clear empties the list", cleared.history.length, 0);
  check("Clear is reported", cleared.message.includes("cleared"));
  const snapshot = JSON.stringify(base);
  C.iterate(base);
  check("core functions never mutate the position", JSON.stringify(base) === snapshot);
  check("a position is plain JSON", typeof JSON.parse(JSON.stringify(iterated)).counts[0] === "number");
  check("history lines are strings", iterated.history.every((line) => typeof line === "string"));
}

done("self-descriptive");
