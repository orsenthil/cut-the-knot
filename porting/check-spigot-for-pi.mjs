#!/usr/bin/env node
"use strict";

/*
 * Logic test for spigot-for-pi/spigot-for-pi-core.js.
 *
 *   node porting/check-spigot-for-pi.mjs
 *
 * 1. The digits against pi computed independently (Machin's formula in
 *    BigInt): for every n from 1 to 400 the first n digits are exactly
 *    right, and for n = 1000 (the applet's default) and 3000.
 * 2. The page's remarks: the held 9s and the digit 10 that carries into
 *    them both happen; with the array of [10n/3] places (no +1) some n give
 *    a wrong digit, which is why Arndt and Haenel's +1 is used.
 * 3. The applet's bookkeeping: exactly n digits come out, the ranges of
 *    digits, chunk and font, and the chunked layout.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("spigot-for-pi/spigot-for-pi-core.js", "SpigotForPiCore");

function machin(n) {
  // pi = 16 arctan(1/5) - 4 arctan(1/239), with 10 guard digits
  const S = 10n ** BigInt(n + 10);
  const atanInv = (x) => {
    const X = BigInt(x), X2 = X * X;
    let term = S / X, sum = term, k = 1n, sign = -1n;
    while (term !== 0n) { term /= X2; sum += sign * (term / (2n * k + 1n)); k++; sign = -sign; }
    return sum;
  };
  return (16n * atanInv(5) - 4n * atanInv(239)).toString().slice(0, n);
}

const PI = machin(3100);
equal("Machin's formula agrees with the familiar start", PI.slice(0, 20), "31415926535897932384");

{
  let ok = true, bad = [];
  for (let n = 1; n <= 400; n++) { const d = C.run(n); if (d !== PI.slice(0, n)) { ok = false; bad.push(n); } }
  check("for every n from 1 to 400 the spigot gives exactly the first n digits of pi", ok, bad.slice(0, 5).join(","));
  check("and for the applet's 1000", C.run(1000) === PI.slice(0, 1000));
  check("and for 3000", C.run(3000) === PI.slice(0, 3000));
}

{
  // count the 9s held back and the 10s
  const s = C.start(800);
  let held = 0;
  while (!s.done) {
    const before = s.nines;
    C.iterate(s);
    if (s.nines > before) held++;
  }
  check("9s are held back while it is unsafe to print them (800 digits)", held > 50, String(held));
  // direct: find an iteration whose quotient was 10
  let ten = false;
  const u = C.start(800);
  while (!u.done && !ten) { const snap = u.digits; const p0 = u.p; C.iterate(u); if (p0 >= 0 && u.p === 0 && u.digits.length > snap.length && u.digits[snap.length] === String(p0 + 1)) ten = true; }
  check("the digit 10 turns up and carries into the held digits", ten);
  let wrong = [];
  for (let n = 1; n <= 400; n++) if (C.run(n, 0) !== PI.slice(0, n)) wrong.push(n);
  check("with only [10n/3] places, some n give a wrong last digit", wrong.length > 0, String(wrong.length));
  equal("up to 400 those n are 1 and 32", wrong.join(","), "1,32");
}

{
  equal("exactly n digits come out", C.run(37).length, 37);
  equal("defaults: 1000 digits, chunks of 5, font 15", `${C.DIGITS.def} ${C.CHUNK.def} ${C.FONT.def}`, "1000 5 15");
  equal("digits are held to 1..50,000", `${C.start(0).n} ${C.start(99999).n}`, "1 50000");
  equal("chunks of 5", C.chunks("31415926535", 5).join(" "), "31415 92653 5");
  equal("chunk size held to 1..20", C.chunks("314159", 50).length, 1);
  equal("[10n/3] + 1 places, each 2", `${C.start(10).len} ${C.start(10).a.join("")}`, "34 2222222222222222222222222222222222");
}

done("spigot-for-pi");
