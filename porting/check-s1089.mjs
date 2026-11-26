#!/usr/bin/env node
"use strict";

/*
 * Logic test for s1089/s1089-core.js.
 *
 *   node porting/check-s1089.mjs
 *
 * 1. The applet's Compute, SmartReverse, PadWithZeros and BaseSys are written
 *    a second time straight from javap, and compared with the core for every
 *    digit string of length 1 to 3 in every base from 2 to 36 (about 460,000
 *    positions), plus patterns at lengths 4 and 15.
 * 2. IntegerString.Update / CTKNumberMod.UpdateSlow are transcribed again and
 *    compared over every digit, both directions, both linked/autonomous, in
 *    every base from 2 to 12 for lengths 1 to 3.
 * 3. The page's claims are checked exhaustively: 1 digit gives 0, two digits
 *    in base ten give 99, three digits in base ten give 1089, and in every
 *    base three non-palindromic digits give 10uv (u and v the penultimate and
 *    largest digits). Palindromes give 0.
 * 4. Option ranges, the silent long-overflow quirk, messages and plain JSON.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("s1089/s1089-core.js", "S1089Core");

/* ------------------------ a second transcription of the applet's methods */

const G = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** BaseSys.Check on one character (ConvertTo10 passes substrings of length 1). */
function jCheck(ch, radix) {
  const u = ch.toUpperCase();
  const low = Math.min(10, radix);
  for (let i = 0; i < low; i++) if (u === G[i]) return i;
  for (let i = 0; i < radix - 10; i++) if (u === G[i + 10]) return i + 10;
  return -1;
}

/** BaseSys.ConvertTo10(s, radix, true) — the boolean is unused in the applet. */
function jConvertTo10(s, radix) {
  if (s.length === 0) return -1n; // the applet's Check substring would throw
  let v = BigInt(jCheck(s[0], radix));
  if (v === -1n) return -1n;
  for (let i = 1; i < s.length; i++) {
    const d = jCheck(s[i], radix);
    if (d === -1) return -1n;
    v = v * BigInt(radix) + BigInt(d);
  }
  return v;
}

/** BaseSys.ConvertNum(value, radix), for the applet's nonnegative values. */
function jConvertNum(value, radix) {
  let v = BigInt(value);
  if (v === 0n) return "0";
  const stack = [];
  while (v >= BigInt(radix)) {
    stack.push(G[Number(v % BigInt(radix))]);
    v /= BigInt(radix);
  }
  stack.push(G[Number(v)]);
  return stack.reverse().join("");
}

/** StringBuffer.reverse(), then delete leading zeroes until the first other. */
function jSmartReverse(s) {
  const buf = s.split("").reverse();
  while (buf.length && buf[0] === "0") buf.shift();
  return buf.length ? buf.join("") : "0"; // the applet deletes past the end here
}

function jPad(s, count) {
  let out = s;
  while (out.length < count) out = "0" + out;
  return out;
}

/** The five strings from S1089Canvas.Compute, digits in writing order. */
function jCompute(digits, base, count) {
  const a = digits.map((d) => G[d]).join("");
  const ap = jSmartReverse(a);
  const va = jConvertTo10(a, base);
  const vp = jConvertTo10(ap, base);
  const b = va >= vp ? va - vp : vp - va;
  const bs = jConvertNum(b, base);
  const bp = jSmartReverse(jPad(bs, count));
  const c = b + jConvertTo10(bp, base);
  return [a, ap, bs, bp, jConvertNum(c, base)];
}

/** IntegerString.Update with CTKNumberMod.UpdateSlow, from javap.
 * The applet holds digits least-significant first; this helper converts. */
function jUpdate(digits, index, up, base, connected) {
  const nums = digits.slice().reverse();
  const k = nums.length - 1 - index;
  const old = nums[k];
  nums[k] = up ? (old + 1) % base : (old + base - 1) % base;
  const now = nums[k];
  if ((now === 0 || now === base - 1) && connected) {
    if (old === base - 1) {
      for (let i = k + 1; i < nums.length; i++) {
        const next = nums[i] + 1;
        nums[i] = next === base ? 0 : next;
        if (nums[i] !== 0) break;
      }
    } else if (old === 0) {
      for (let i = k + 1; i < nums.length; i++) {
        const next = nums[i] - 1;
        nums[i] = next === -1 ? base - 1 : next;
        if (nums[i] !== base - 1) break;
      }
    }
  }
  return nums.reverse();
}

function* vectors(base, count) {
  const total = base ** count;
  for (let n = 0; n < total; n++) {
    let x = n;
    const d = new Array(count);
    for (let i = count - 1; i >= 0; i--) {
      d[i] = x % base;
      x = Math.floor(x / base);
    }
    yield d;
  }
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ digits: "732" });
  equal("the default base is ten", s.base, 10);
  equal("the default length is three digits", s.digitCount, 3);
  equal("the page's worked example starts at 732", s.digits, [7, 3, 2]);
  check("Autonomous digits starts off, as in the applet", s.autonomous === false);
  check("a fresh demo is not done", C.result(s) === null);
  equal("applet ranges: base 2 to 36", [C.MIN_BASE, C.MAX_BASE], [2, 36]);
  equal("applet ranges: 1 to 15 digits (MaxLength)", [C.MIN_DIGITS, C.MAX_DIGITS], [1, 15]);
  const computed = C.compute(s);
  equal("732 reverses to 237", computed.aPrime, "237");
  equal("732 - 237 is 495", computed.b, "495");
  equal("495 reverses to 594", computed.bPrime, "594");
  equal("495 + 594 is 1089", computed.c, "1089");
  check("changing a digit ends the demo", C.result(C.changeDigit(s, 2, false)) === "done");
  const snapshot = JSON.stringify(s);
  C.changeDigit(s, 0, true);
  C.compute(s);
  check("core functions never mutate the position", JSON.stringify(s) === snapshot);
  check("the position is plain JSON", typeof JSON.parse(JSON.stringify(s)).base === "number");
  const seeded = C.start({ base: 16, digitCount: 4, random: rng(7) });
  equal("a seeded start keeps the leading digit nonzero", seeded.digits.length, 4);
  check("a seeded leading digit is at least one", seeded.digits[0] >= 1);
}

/* ---------------- 2. every number of 1 to 3 digits, against the applet code */

{
  let same = true;
  let detail = "";
  let positions = 0;
  for (let base = C.MIN_BASE; base <= C.MAX_BASE; base++) {
    for (let count = 1; count <= 3; count++) {
      for (const digits of vectors(base, count)) {
        const want = jCompute(digits, base, count);
        const got = C.compute(C.start({ base, digitCount: count, digits }));
        const mine = [got.a, got.aPrime, got.b, got.bPrime, got.c];
        positions++;
        if (JSON.stringify(mine) !== JSON.stringify(want)) {
          same = false;
          detail = `base ${base}, ${JSON.stringify(digits)}: ${JSON.stringify(mine)} vs ${JSON.stringify(want)}`;
          break;
        }
      }
      if (!same) break;
    }
    if (!same) break;
  }
  check(`Compute matches a second transcription in all ${positions} positions`, same, detail);

  // Longer numbers: padding and reversal at the maximum option value.
  let longer = true;
  const patterns = [
    [0, 0, 0, 0], [0, 0, 0, 1], [1, 0, 0, 0], [9, 9, 9, 9],
    [1, 2, 3, 4], [1, 0, 0, 1], [0, 0, 1, 0],
  ];
  for (let base = 2; base <= 36; base++) {
    for (const pattern of patterns) {
      const digits = pattern.map((d) => d % base); // only digits legal in this base
      const want = jCompute(digits, base, 4);
      const got = C.compute(C.start({ base, digitCount: 4, digits }));
      if (JSON.stringify([got.a, got.aPrime, got.b, got.bPrime, got.c]) !== JSON.stringify(want)) longer = false;
    }
  }
  check("Compute matches at four digits in every base, including zeroes and palindromes", longer);

  const fifteen = new Array(15).fill(0);
  fifteen[0] = 1;
  fifteen[14] = 1;
  equal("the longest setting pads the difference before reversing it",
    C.compute(C.start({ base: 10, digitCount: 15, digits: fifteen })).bPrime,
    jCompute(fifteen, 10, 15)[3]);
}

/* ----------------- 3. connected digits, against IntegerString.Update again */

{
  let same = true;
  let detail = "";
  let cases = 0;
  for (let base = 2; base <= 12; base++) {
    for (let count = 1; count <= 3; count++) {
      for (const digits of vectors(base, count)) {
        for (const autonomous of [false, true]) {
          for (const up of [false, true]) {
            for (let index = 0; index < count; index++) {
              const state = C.start({ base, digitCount: count, digits, autonomous });
              const got = C.changeDigit(state, index, up).digits;
              const want = jUpdate(digits, index, up, base, !autonomous);
              cases++;
              if (JSON.stringify(got) !== JSON.stringify(want)) {
                same = false;
                detail = `base ${base} ${JSON.stringify(digits)} index ${index} up ${up} auto ${autonomous}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`;
                break;
              }
            }
            if (!same) break;
          }
          if (!same) break;
        }
        if (!same) break;
      }
      if (!same) break;
    }
    if (!same) break;
  }
  check(`digit changes match the applet in all ${cases} cases`, same, detail);

  // Carries and borrows are visible as words, not just a tint.
  const carry = C.changeDigit(C.start({ digits: [1, 2, 9] }), 2, true);
  equal("a wrapped digit carries into the digit on its left", carry.digits, [1, 3, 0]);
  check("the message says the digit changed", carry.message.includes("2 to 3") === false &&
    carry.message.includes("9 to 0") && carry.message.includes("answer"));
  const borrow = C.changeDigit(C.start({ digits: [4, 0, 0] }), 2, false);
  equal("a borrowed digit takes one from the digit on its left", borrow.digits, [3, 9, 9]);
  const lone = C.changeDigit(C.start({ digitCount: 1, digits: [9] }), 0, true);
  equal("the leftmost digit has nowhere to carry", lone.digits, [0]);
}

/* ----------------------------------------- 4. the page's claims, exhaustively */

{
  let baseTen2 = true;
  let baseTen3 = true;
  let palindromes = true;
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      const two = C.compute(C.start({ digitCount: 2, digits: [a, b] })).value;
      if ((a === b ? two !== 0n : two !== 99n)) baseTen2 = false;
      for (let c = 0; c <= 9; c++) {
        const three = C.compute(C.start({ digits: [a, b, c] })).value;
        if (a === c ? three !== 0n : three !== 1089n) {
          if (a === c) palindromes = false;
          else baseTen3 = false;
        }
      }
    }
  }
  check("the page's two-digit claim: every non-palindrome gives 99", baseTen2);
  check("the page's headline claim: every non-palindrome gives 1089", baseTen3);
  check("the page's palindrome claim: the sum is 0", palindromes);

  let everyBase = true;
  let detail = "";
  let checked = 0;
  for (let base = 2; base <= 36; base++) {
    const u = G[base - 2];
    const v = G[base - 1];
    const expectedText = `10${u}${v}`;
    const expectedValue = BigInt(base) ** 3n + BigInt(base) ** 2n - BigInt(base) - 1n;
    for (const digits of vectors(base, 3)) {
      if (digits[0] === digits[2]) continue;
      const out = C.compute(C.start({ base, digits }));
      checked++;
      if (out.c !== expectedText || out.value !== expectedValue) {
        everyBase = false;
        detail = `base ${base} ${JSON.stringify(digits)}: ${out.c} vs ${expectedText}`;
        break;
      }
    }
    if (!everyBase) break;
  }
  check(`every non-palindromic 3-digit number in bases 2..36 gives 10uv (${checked} cases)`, everyBase, detail);
  equal("the page's base-36 example is 10YZ",
    C.compute(C.start({ base: 36, digits: [1, 2, 3] })).c, "10YZ");
  check("1 digit always gives 0", [2, 10, 36].every((base) =>
    Array.from({ length: base }, (_, d) => C.compute(C.start({ base, digitCount: 1, digits: [d] })).value === 0n).every(Boolean)));

  // A trailing zero makes A' shorter; the applet's SmartReverse drops it.
  equal("a trailing zero vanishes from the reversed number",
    C.compute(C.start({ digits: [7, 3, 0] })).aPrime, "37");
  equal("the answer still comes out at 1089",
    C.compute(C.start({ digits: [7, 3, 0] })).c, "1089");
  equal("a leading zero is kept in the number written at the top",
    C.compute(C.start({ digits: [0, 1, 2] })).a, "012");
  equal("but leading zeroes vanish from the reversed number",
    C.compute(C.start({ digits: [0, 1, 2] })).aPrime, "210");
}

/* ------------------------------------- 5. options, quirk, messages and JSON */

{
  const low = C.setBase(C.start({}), 1, () => 0);
  const high = C.setBase(C.start({}), 100, () => 0);
  equal("a base below 2 is clamped", low.base, 2);
  equal("a base above 36 is clamped", high.base, 36);
  equal("a fractional base is rounded", C.setBase(C.start({}), 2.6, () => 0).base, 3);
  const few = C.setDigitCount(C.start({}), 0, () => 0);
  const many = C.setDigitCount(C.start({}), 99, () => 0);
  equal("a digit count below 1 is clamped", few.digitCount, 1);
  equal("a digit count above 15 is clamped", many.digitCount, 15);

  // SetNumOfDigits catches Long.parseLong's overflow and keeps the old IS.
  const before = C.start({ base: 36, digitCount: 15, digits: new Array(15).fill(1) });
  const overflowed = C.randomize(before, () => 0.999999);
  equal("the silent long-overflow quirk keeps the old number", overflowed.digits, before.digits);
  const fresh = C.start({ base: 16, digitCount: 3, random: rng(3) });
  equal("changing the base generates in the new base",
    C.setBase(fresh, 8, rng(4)).base, 8);
  check("generated digits stay inside the new base",
    C.setBase(fresh, 8, rng(4)).digits.every((d) => d >= 0 && d < 8));
  equal("changing the digit count keeps its range",
    C.setDigitCount(fresh, 4, rng(5)).digits.length, 4);

  const autonomous = C.setAutonomous(C.start({ digits: [1, 2, 9] }), true);
  equal("an autonomous digit does not carry", C.changeDigit(autonomous, 2, true).digits, [1, 2, 0]);
  check("the checkbox is reported in words", autonomous.message.includes("no carry"));
  const linked = C.setAutonomous(autonomous, false);
  check("turning linking back on is reported too", linked.message.includes("carry"));
  check("a demo is done once explored", C.result(linked) === "done");
  check("a random new number is done too", C.result(C.randomize(C.start({}), rng(8))) === "done");
  const state = JSON.parse(JSON.stringify(C.changeDigit(C.start({ digits: "732" }), 2, false)));
  equal("saved positions carry the digit string and the answer",
    [state.digits.join(""), state.base, state.digitCount, state.autonomous, state.explored],
    ["731", 10, 3, false, true]);
}

done("s1089");
