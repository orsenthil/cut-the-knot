#!/usr/bin/env node
"use strict";

/*
 * Logic test for whats-next/whats-next-core.js.
 *
 * The applet shows six terms of a sequence made by one of nine rules with
 * random small parameters, and asks for the seventh. What is checked:
 *
 *   1. Each rule against the applet itself, for EVERY parameter value the
 *      applet can draw: guesscanvas's nine methods are written out again
 *      here as the bytecode's own loops (string building and all), and
 *      compared with the core's build() term by term.
 *   2. params() draws exactly the applet's ranges and fix-ups, and every
 *      value in them is reachable.
 *   3. The cut-the-knot page's examples: 21, 1211, 111221, 312211 for the
 *      self-descriptive rule; 0, 1 starting the Fibonacci numbers; and the
 *      second differences of a second-degree polynomial being 2a.
 *   4. How often the answer is not unique: every sequence the applet can
 *      show is generated, and the ones where another of the nine rules fits
 *      the same six terms but continues differently are counted. The page
 *      warns that "sometimes a pattern may not be unique"; the counts here
 *      are quoted in its "Look for the math".
 *   5. generate() picks each rule about equally often, and checking a guess
 *      ignores surrounding spaces.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const Q = loadCore("whats-next/whats-next-core.js", "GuessCore");
const byName = Object.fromEntries(Q.RULES.map((r) => [r.name, r]));
const N = 6; // m_nTerms
// The census quoted on the page (section 4).
const QUOTED = { distinct: 2673, ambiguous: 0 };

/* ------------------------------------- the applet's methods, from bytecode */

// Each returns { seq: "t0,t1,...,t5", ans: "t6" } exactly as m_Sequence and sAnswer.
const applet = {
  "Arithmetic progression"({ a, d }) {
    let seq = String(a);
    for (let i = 1; i < N; i++) seq += "," + String(a + i * d);
    return { seq, ans: String(a + N * d) };
  },
  "Geometric progression"({ a, q }) {
    let seq = String(a);
    for (let i = 1; i < N; i++) { a = a * q; seq += "," + String(a); }
    return { seq, ans: String(a * q) };
  },
  "Sum of preceding two"({ a, b }) {
    let seq = String(a) + "," + String(b);
    for (let i = 1; i < N - 1; i++) { const c = a + b; seq += "," + String(c); a = b; b = c; }
    return { seq, ans: String(a + b) };
  },
  "Three terms sum sequence"({ a, b, c }) {
    let seq = String(a) + "," + String(b) + "," + String(c);
    for (let i = 1; i < N - 2; i++) { const d = a + b + c; seq += "," + String(d); a = b; b = c; c = d; }
    return { seq, ans: String(a + b + c) };
  },
  "Self-descriptive sequence"({ seed }) {
    let s = seed;
    let seq = s;
    let ans = null;
    let count = 1;
    let cur = s.charCodeAt(0) - 48;
    let nxt = cur;
    let out = "";
    for (let k = 1; k <= N; k++) {
      const len = s.length;
      for (let j = 1; j <= len; j++) {
        if (j < len) {
          nxt = s.charCodeAt(j) - 48;
          if (cur === nxt) { count++; continue; }
        }
        out += String(count);
        out += String(cur);
        cur = nxt;
        count = 1;
      }
      if (k === N) ans = out; else seq += "," + out;
      s = out;
      out = "";
      count = 1;
      cur = s.charCodeAt(0) - 48;
      nxt = cur;
    }
    return { seq, ans };
  },
  "Shifted powers"({ b, q }) {
    const c = 0;
    let seq = String(c + b);
    for (let i = 1; i < N; i++) { b = b * q; seq += "," + String(c + b); }
    return { seq, ans: String(b * q) };
  },
  "Alternate addition and multiplication"({ a, d, q }) {
    let seq = String(a);
    let i;
    for (i = 1; i < N; i++) { if (i % 2 === 1) a = a + d; else a = a * q; seq += "," + String(a); }
    return { seq, ans: String(i % 2 === 1 ? a + d : a * q) };
  },
  "Alternate addition of two different quantities"({ a, da, db }) {
    let seq = String(a);
    let i;
    for (i = 1; i < N; i++) { a = a + (i % 2 === 1 ? da : db); seq += "," + String(a); }
    return { seq, ans: String(a + (i % 2 === 1 ? da : db)) };
  },
  "Second degree polynomial"({ a, b, c }) {
    let seq = String(c);
    for (let n = 1; n < N; n++) seq += "," + String(c + (b + a * n) * n);
    return { seq, ans: String(c + (b + a * N) * N) };
  },
};

// The parameter ranges, written out from the bytecode independently of the core.
const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const fix = (v, from, to) => (v === from ? to : v);
const uniq = (list) => [...new Map(list.map((p) => [JSON.stringify(p), p])).values()];
const SPACE = {
  "Arithmetic progression": range(-11, 0).flatMap((a) => range(-11, 0).map((d) => ({ a, d }))),
  "Geometric progression": uniq(range(-3, 4).flatMap((a) => range(-3, 3).map((q) => ({ a: fix(a, 0, -1), q: fix(fix(q, 0, -2), 1, -1) })))),
  "Sum of preceding two": range(-3, 3).flatMap((a) => range(1, 7).map((b) => ({ a, b }))),
  "Three terms sum sequence": range(-3, 3).flatMap((a) => range(1, 7).flatMap((b) => range(1, 7).map((c) => ({ a, b, c })))),
  "Self-descriptive sequence": ["1", "2", "3"].flatMap((x) => [{ seed: x }, ...["1", "2", "3"].map((y) => ({ seed: x + y }))]),
  "Shifted powers": uniq(range(-5, 3).flatMap((q) => range(-5, 5).map((b) => ({ b: fix(b, 0, -1), q: fix(fix(q, 0, -2), 1, 2) })))),
  "Alternate addition and multiplication": range(-5, 3).flatMap((d) => range(-3, 2).flatMap((q) => range(-6, 4).map((a) => ({ a, d: fix(d, 0, -1), q })))),
  "Alternate addition of two different quantities": range(-5, 3).flatMap((da) => range(-7, 5).flatMap((db) => range(-6, 4).map((a) => ({ a, da: fix(da, 0, -1), db })))),
  "Second degree polynomial": range(-5, 3).flatMap((a) => range(-3, 2).flatMap((b) => range(-6, 4).map((c) => ({ a: fix(a, 0, -1), b, c })))),
};

/* ----------------------------------------- 1. every parameter, every rule */

equal("nine rules", Q.RULES.length, 9);
equal("six terms", Q.TERMS, 6);
for (const rule of Q.RULES) {
  let bad = 0;
  for (const p of SPACE[rule.name]) {
    const mine = rule.build(p);
    const theirs = applet[rule.name](p);
    if (mine.terms.length !== N || mine.terms.join(",") !== theirs.seq || mine.answer !== theirs.ans) bad++;
  }
  check(`${rule.name}: matches the applet for all ${SPACE[rule.name].length} parameter sets`, bad === 0, `${bad} differ`);
}

/* ------------------------------------------------------ 2. params() ranges */

{
  const random = rng(4242);
  for (const rule of Q.RULES) {
    const allowed = new Set(SPACE[rule.name].map((p) => JSON.stringify(p)));
    const seen = new Set();
    let outside = 0;
    for (let t = 0; t < 20000; t++) {
      const k = JSON.stringify(rule.params(random));
      if (!allowed.has(k)) outside++;
      seen.add(k);
    }
    check(`${rule.name}: params() stays in the applet's ranges`, outside === 0, `${outside} outside`);
    equal(`${rule.name}: params() reaches every parameter set`, seen.size, allowed.size);
  }
}

/* ------------------------------------------------- 3. the page's examples */

{
  const ls = byName["Self-descriptive sequence"].build({ seed: "21" });
  equal("look-and-say from 21", ls.terms.slice(0, 4), ["21", "1211", "111221", "312211"]);
  equal("lookAndSay(1211)", Q.lookAndSay("1211"), "111221");
  equal("Fibonacci from 0, 1", byName["Sum of preceding two"].build({ a: 0, b: 1 }), { terms: ["0", "1", "1", "2", "3", "5"], answer: "8" });

  let notConst = 0;
  for (const p of SPACE["Second degree polynomial"]) {
    const t = byName["Second degree polynomial"].build(p).terms.map(Number);
    const d1 = t.slice(1).map((x, i) => x - t[i]);
    const d2 = d1.slice(1).map((x, i) => x - d1[i]);
    if (!d2.every((x) => x === 2 * p.a)) notConst++;
  }
  check("second differences of an^2+bn+c are all 2a", notConst === 0);

  check("the applet's arithmetic progressions never go up", SPACE["Arithmetic progression"].every(({ d }) => d <= 0));
  const pw = byName["Shifted powers"].build({ b: 3, q: 2 });
  equal("'Shifted powers' has no shift: 3, 6, 12, ...", pw.terms.slice(0, 3), ["3", "6", "12"]);
}

/* ------------------------------------- 4. how often is the answer unique? */

{
  const answers = new Map(); // six terms -> Map(answer -> Set(rule))
  let shown = 0;
  for (const rule of Q.RULES) {
    for (const p of SPACE[rule.name]) {
      const { terms, answer } = rule.build(p);
      const k = terms.join(",");
      if (!answers.has(k)) answers.set(k, new Map());
      const m = answers.get(k);
      if (!m.has(answer)) m.set(answer, new Set());
      m.get(answer).add(rule.name);
      shown++;
    }
  }
  const ambiguous = [...answers].filter(([, m]) => m.size > 1);
  const examples = ambiguous
    .filter(([k]) => !/^(-?\d+)(,\1)*$/.test(k)) // skip constant rows for the example
    .slice(0, 3)
    .map(([k, m]) => `${k} -> ${[...m.keys()].join(" or ")}`);
  console.log(`  ${shown} parameter sets, ${answers.size} distinct sequences, ${ambiguous.length} with two or more answers`);
  for (const e of examples) console.log(`    e.g. ${e}`);
  // The numbers quoted on the page; if a rule changes, update the page too.
  equal("distinct sequences the applet can show", answers.size, QUOTED.distinct);
  equal("sequences with more than one right answer", ambiguous.length, QUOTED.ambiguous);
}

/* ------------------------------------------------- 5. generate and check */

{
  const random = rng(7);
  const counts = new Map();
  for (let t = 0; t < 90000; t++) {
    const r = Q.generate(random);
    counts.set(r.rule, (counts.get(r.rule) || 0) + 1);
    if (r.terms.length !== 6) { check("six terms shown", false); break; }
  }
  check("each rule is picked about 1/9 of the time", [...counts.values()].every((c) => Math.abs(c - 10000) < 600) && counts.size === 9);
  const round = byName["Arithmetic progression"].build({ a: -1, d: -2 });
  check("a right guess, with spaces around it", Q.isRight(round, "  -13 "));
  check("a wrong guess", !Q.isRight(round, "-12"));
}

done("whats-next");
