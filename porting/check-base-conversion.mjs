#!/usr/bin/env node
"use strict";

/*
 * Logic test for base-conversion/base-conversion-core.js.
 *
 *   node porting/check-base-conversion.mjs
 *
 * Checks the whole parameter space where it is small: every base from 2 to
 * 36 as both input and output (all 35 x 35 pairs round-trip), negative and
 * fractional inputs, BAD NUMBER, the 36-digit cap, and the applet's quirks.
 * Section 4 writes BigRational a second time, straight from the bytecode,
 * and compares it with the core over the whole range and a corpus of inputs.
 * The cut-the-knot page's claims (bases 2..36, negatives, fractions, four
 * bases at once) are each checked honestly.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("base-conversion/base-conversion-core.js", "BaseConversionCore");

/* ------------------------------------------------- a second transcription */
/* Literally the applet's BigRational, written again from javap output.      */

const D = "0123456789abcdefghijklmnopqrstuvwxyz";

function dv(ch) {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  if (ch >= "a" && ch <= "z") return ch.charCodeAt(0) - 87;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - 55;
  return -1;
}

function javaBigInteger(s, radix) {
  if (!s || !s.length) throw new Error("NumberFormatException");
  let neg = false;
  if (s[0] === "-" || s[0] === "+") {
    neg = s[0] === "-";
    s = s.slice(1);
  }
  if (!s.length) throw new Error("NumberFormatException");
  let v = 0n;
  for (const ch of s) {
    const d = dv(ch);
    if (d < 0 || d >= radix) throw new Error("NumberFormatException");
    v = v * BigInt(radix) + BigInt(d);
  }
  return neg ? -v : v;
}

function javaToString(v, radix) {
  if (v === 0n) return "0";
  const neg = v < 0n;
  let x = neg ? -v : v;
  let out = "";
  while (x > 0n) {
    out = D[Number(x % BigInt(radix))] + out;
    x /= BigInt(radix);
  }
  return (neg ? "-" : "") + out;
}

function bigRational(str, radix) {
  let s = str;
  const e = s.lastIndexOf("...");
  if (e > -1) s = s.substring(0, e);
  let N, F = null, den = null;
  const k = s.indexOf(".");
  try {
    if (k > -1) {
      N = k > 0 ? javaBigInteger(s.substring(0, k), radix) : 0n;
      const frac = s.substring(k + 1);
      den = BigInt(String(radix)) ** BigInt(frac.length);
      F = javaBigInteger(frac, radix);
    } else {
      N = javaBigInteger(s, radix);
    }
  } catch (err) {
    return { bad: true };
  }
  return { bad: false, N, F, den };
}

function rationalToString(r, radix) {
  let s = javaToString(r.N, radix);
  if (r.F !== null) {
    let d = Number(r.F) / Number(r.den);
    let count = 0;
    s += ".";
    while (d > 0 && count < 36) {
      d *= radix;
      const digit = Math.floor(d);
      s += D[digit];
      d -= digit;
      count++;
    }
    if (count === 36) s += "...";
  }
  return s.toUpperCase();
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("initial bases are 10, 2, 8, 16", s.bases, [10, 2, 8, 16]);
  equal("all four boxes start at 0", s.texts, ["0", "0", "0", "0"]);
  check("a fresh demo is not yet done", C.result(s) === null);
  check("the page's four bases at once: NROWS is 4", C.NROWS === 4);
  check("the page's range starts at 2", C.MIN_BASE === 2);
  check("the page's range ends at 36", C.MAX_BASE === 36);
}

/* ------------------------------- 2. every base, as input and as output */

{
  let allRoundTrip = true;
  let allUppercase = true;
  for (let from = C.MIN_BASE; from <= C.MAX_BASE; from++) {
    for (let to = C.MIN_BASE; to <= C.MAX_BASE; to++) {
      const s = C.start({ bases: [from, to, 8, 16] });
      const out = C.convert(s, 0, "10"); // "10" in base `from` is the value `from`
      const shown = out.texts[1]; // row 2 is the output in base `to`
      if (shown !== javaToString(BigInt(from), to).toUpperCase()) allRoundTrip = false;
      if (!/^[0-9A-Z]+$/.test(shown)) allUppercase = false;
      const back = C.parseRational(shown, to);
      if (back.bad || back.n !== BigInt(from)) allRoundTrip = false;
      // The other boxes must show the same value in their own bases.
      for (let row = 0; row < 4; row++) {
        const want = javaToString(BigInt(from), out.bases[row]).toUpperCase();
        if (out.texts[row] !== want) allRoundTrip = false;
      }
    }
  }
  check("all 35 x 35 input/output base pairs round-trip and fill every box", allRoundTrip);
  check("digits above nine are printed A..Z (uppercase) in every base", allUppercase);
  equal("base 36 writes thirty-five as Z", C.convert(C.start({ bases: [10, 36, 8, 16] }), 0, "35").texts[1], "Z");
}

/* --------------------------------------- 3. the page's claims about input */

{
  const neg = C.convert(C.start(), 0, "-10");
  equal("a negative integer is accepted: -10 in base 10 is -A in base 16", neg.texts[3], "-A");
  equal("the same negative in binary", neg.texts[1], "-1010");

  const half = C.convert(C.start(), 0, "0.5");
  equal("a fraction is accepted: half in binary", half.texts[1], "0.1");
  equal("half in octal", half.texts[2], "0.4");
  equal("half in hexadecimal", half.texts[3], "0.8");
  equal("a fraction with an integer part: 3.5 in binary", C.convert(C.start(), 0, "3.5").texts[1], "11.1");

  // Quirk of the applet: N is read from "-0", which BigInteger reads as 0.
  equal("applet quirk: -0.5 loses the minus sign", C.convert(C.start(), 0, "-0.5").texts[1], "0.1");

  // RemoveEllipses(): a pasted "0.555..." is read as "0.555".
  equal("ellipses are stripped before parsing", C.convert(C.start(), 0, "0.555...").texts, C.convert(C.start(), 0, "0.555").texts);

  const terminating = C.convert(C.start(), 0, "0.5");
  check("a terminating fraction has no ellipses", terminating.texts.every((t) => !t.includes("...")));
  // 0.1 in base 3 is one third; in base 10 it repeats and hits the 36-digit cap.
  const third = C.convert(C.start({ bases: [3, 2, 8, 10] }), 0, "0.1").texts[3];
  check("a repeating fraction stops after 36 digits and gains ...",
    third.startsWith("0.") && third.endsWith("...") &&
    third.slice(2, -3).length === 36 && /^[0-9A-Z]+$/.test(third.slice(2, -3)));

  const bad = C.convert(C.start(), 0, "G");
  equal("a digit too big for the base is BAD NUMBER", bad.texts, [C.BAD, C.BAD, C.BAD, C.BAD]);
  equal("a digit outside base 2 is BAD NUMBER", C.convert(C.start({ bases: [2, 10, 8, 16] }), 0, "2").texts[0], C.BAD);
  equal("an empty box is BAD NUMBER", C.convert(C.start(), 0, "").texts[0], C.BAD);
  equal("two decimal points are BAD NUMBER", C.convert(C.start(), 0, "1.2.3").texts[0], C.BAD);
  check("BAD NUMBER says so in words", bad.message.includes("BAD NUMBER"));
}

/* ------------------------------------------ 4. the applet's own answers */

{
  let allSame = true;
  let detail = "";
  const corpus = ["0", "1", "10", "255", "35", "-10", "+12", "0.5", "-3.5", "-0.5",
    "0.1", "0.555...", "11.1", "ff", "z", "G", "", ".5", "1.2.3"];
  for (let base = 2; base <= 36; base++) {
    for (const text of corpus) {
      const mine = C.parseRational(text, base);
      const theirs = bigRational(text, base);
      if (mine.bad !== theirs.bad) {
        allSame = false;
        detail = `${text} base ${base}: bad ${mine.bad} vs ${theirs.bad}`;
      } else if (!mine.bad) {
        if (mine.n !== theirs.N || mine.f !== theirs.F ||
            String(mine.denominator) !== String(theirs.den)) {
          allSame = false;
          detail = `${text} base ${base}: parts differ`;
        } else {
          for (let out = 2; out <= 36; out++) {
            if (C.formatRational(mine, out) !== rationalToString(theirs, out)) {
              allSame = false;
              detail = `${text} base ${base} -> ${out}: ${C.formatRational(mine, out)} vs ${rationalToString(theirs, out)}`;
              break;
            }
          }
        }
      }
      // Full state transition, compared with a direct transcription of
      // actionPerformed and ChangeBase.
      const s = C.start({ bases: [base, 2, 8, 16] });
      const r0 = bigRational(text, base);
      const javaTexts = r0.bad
        ? new Array(4).fill(C.BAD)
        : s.bases.map((b) => rationalToString(r0, b));
      const mineTexts = C.convert(s, 0, text).texts;
      if (JSON.stringify(mineTexts) !== JSON.stringify(javaTexts)) {
        allSame = false;
        detail = `${text} base ${base}: texts ${JSON.stringify(mineTexts)} vs ${JSON.stringify(javaTexts)}`;
      }
      const changed = C.changeBase(s, 0, base === 36 ? 2 : base + 1);
      const javaChanged = rationalToString(bigRational("0", base), base === 36 ? 2 : base + 1);
      if (changed.texts[0] !== javaChanged || changed.bases[0] !== (base === 36 ? 2 : base + 1)) {
        allSame = false;
        detail = `ChangeBase base ${base}: ${changed.texts[0]} vs ${javaChanged}`;
      }
    }
  }
  check("core matches a second transcription of BigRational over all bases 2..36 and 19 inputs", allSame, detail);
}

/* ------------------------------------- 5. base changes and the record */

{
  let s = C.convert(C.start(), 0, "255"); // 255 in base 10 = FF / 11111111 / 377
  const before = s.texts.slice();
  s = C.changeBase(s, 2, 16); // only row 3 (base 8 -> 16) is re-rendered
  equal("changing one base rewrites only that box", [s.texts[0], s.texts[1], s.texts[3]], [before[0], before[1], before[3]]);
  equal("the changed box now says FF", s.texts[2], "FF");
  equal("the base label changes with it", s.bases[2], 16);

  const low = C.changeBase(C.start(), 0, 1);
  const high = C.changeBase(C.start(), 0, 100);
  equal("a base below 2 is clamped to 2", low.bases[0], 2);
  equal("a base above 36 is clamped to 36", high.bases[0], 36);
  equal("a fractional base is rounded", C.changeBase(C.start(), 0, 2.5).bases[0], 3);
  check("changing a base keeps bases inside 2..36", s.bases.every((b) => b >= 2 && b <= 36));
  check("a demo is done once explored", C.result(s) === "done");
  check("a bad conversion still counts as explored", C.result(C.convert(C.start(), 0, "G")) === "done");

  const original = C.start({});
  const snapshot = JSON.stringify(original);
  C.convert(original, 0, "10");
  C.changeBase(original, 1, 36);
  check("core functions never mutate the position they are given", JSON.stringify(original) === snapshot);
  const json = JSON.parse(JSON.stringify(C.convert(C.start(), 0, "3.5")));
  check("the position is plain JSON", json.bases.length === 4 && json.texts.length === 4 && json.explored === true);
  check("a base change says what changed in words", s.message.includes("base 8") && s.message.includes("base 16") && s.message.includes("FF"));
}

done("base-conversion");
