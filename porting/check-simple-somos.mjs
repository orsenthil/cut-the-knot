#!/usr/bin/env node
"use strict";

/*
 * Logic test for simple-somos/simple-somos-core.js.
 *
 *   node porting/check-simple-somos.mjs
 *
 * 1. The olympiad problem and the page's remark: with a = b = 1, every m in
 *    the applet's range 1..100 gives 30 whole-number terms, positive.
 * 2. Why: k = (x^2 + y^2 + m)/(xy) is the same for every pair of
 *    neighbours, and each term is k times the last minus the one before.
 *    And the exact rule over every start the applet allows (a, b, m up to
 *    100, 1,000,000 starts): the 30 terms are all whole exactly when
 *    a | b^2 + m and k is a whole number; otherwise the alarm comes.
 * 3. The applet's own arithmetic (BigInteger divide, multiply back,
 *    compare), the alarm's numbers, and the ranges.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("simple-somos/simple-somos-core.js", "SimpleSomosCore");

equal("1, 1 and m = 2: the olympiad sequence", C.sequence(C.start()).terms.slice(0, 8).join(","), "1,1,3,11,41,153,571,2131");
{
  let ok = true;
  for (let m = 1; m <= 100; m++) {
    const r = C.sequence({ a: 1, b: 1, m });
    if (r.alarm || r.terms.length !== 30 || r.terms.some((t) => BigInt(t) <= 0n)) ok = false;
  }
  check("with a = b = 1 every m from 1 to 100 gives 30 positive whole terms", ok);
}

{
  let constant = true, linear = true;
  for (const s of [{ a: 1, b: 1, m: 2 }, { a: 1, b: 1, m: 7 }, { a: 2, b: 3, m: 5 }, { a: 1, b: 2, m: 3 }]) {
    const t = C.sequence(s).terms.map(BigInt);
    const [p, q] = C.invariant(s);
    for (let i = 0; i + 1 < t.length; i++) {
      // (t_i^2 + t_{i+1}^2 + m) / (t_i t_{i+1}) == p/q
      if ((t[i] * t[i] + t[i + 1] * t[i + 1] + BigInt(s.m)) * q !== p * t[i] * t[i + 1]) constant = false;
      if (i + 2 < t.length && q === 1n && t[i + 2] !== p * t[i + 1] - t[i]) linear = false;
    }
  }
  check("k = (x^2 + y^2 + m)/(xy) is the same for every pair of neighbours", constant);
  check("and each term is k times the one before minus the one before that", linear);
  equal("for a = b = 1, k = m + 2", C.invariant({ a: 1, b: 1, m: 2 }).join("/"), "4/1");
}

{
  let rule = true, n = 0, whole = 0;
  for (let a = 1; a <= 100; a++) for (let b = 1; b <= 100; b++) for (let m = 1; m <= 100; m++) {
    n++;
    const r = C.sequence({ a, b, m });
    const ok = (b * b + m) % a === 0 && (a * a + b * b + m) % (a * b) === 0;
    if (ok) whole++;
    if ((r.alarm === null) !== ok) rule = false;
  }
  check(`over all ${n} starts: 30 whole terms exactly when a | b^2+m and k is whole (${whole} such starts)`, rule);
}

{
  // Draw, literally: L10 = L8*L8 + L9; L11 = L10 / L7; L12 = L11 * L7; equal strings or Alarm.
  const draw = (A, B, N) => {
    let L7 = BigInt(A), L8 = BigInt(B); const L9 = BigInt(N); const out = [String(L7), String(L8)];
    for (;;) {
      const L10 = L8 * L8 + L9, L11 = L10 / L7, L12 = L11 * L7;
      if (L10.toString(10) !== L12.toString(10)) return { out, alarm: `Alarm:${L10}/${L7}` };
      out.push(String(L11)); L7 = L8; L8 = L11;
      if (out.length >= 30) return { out, alarm: null };
    }
  };
  let same = true;
  for (let a = 1; a <= 40; a++) for (let b = 1; b <= 40; b++) for (const m of [1, 2, 3, 17, 100]) {
    const r = C.sequence({ a, b, m }), d = draw(a, b, m);
    if (r.terms.join() !== d.out.join() || (r.alarm ? `Alarm:${r.alarm.num}/${r.alarm.den}` : null) !== d.alarm) same = false;
  }
  check("the same terms and alarms as a literal transcription of Draw", same);
  const r = C.sequence({ a: 2, b: 1, m: 2 });
  equal("2, 1, m = 2: 1 + 2 = 3 is not divisible by 2", `${r.terms.join(",")} | ${r.alarm.num}/${r.alarm.den}`, "2,1 | 3/2");
  equal("defaults m = 2, a = 1, b = 1", JSON.stringify(C.start()), JSON.stringify({ m: 2, a: 1, b: 1 }));
  equal("ranges 1..100", JSON.stringify(C.start({ m: 0, a: 500, b: -3 })), JSON.stringify({ m: 1, a: 100, b: 1 }));
  check("terms grow without limit in BigInt: the 30th term for m = 100 has many digits", C.sequence({ a: 1, b: 1, m: 100 }).terms[29].length > 40);
}

done("simple-somos");
