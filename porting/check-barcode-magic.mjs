#!/usr/bin/env node
"use strict";

/*
 * Logic test for barcode-magic/barcode-magic-core.js.
 *
 *   node porting/check-barcode-magic.mjs
 *
 * The applet's own methods are transcribed a second time, straight from the
 * bytecode, and compared with the core over the whole parameter space where
 * it is small (one blank, any of the twelve positions, any other digits).
 * The page's claims are checked as claims: twelve starting question marks,
 * every decimal digit reachable by clicking, and a missing digit that is
 * always recovered from the other eleven. The UPC-A barcode modules are
 * checked against BarCodeEncoding's literal tables.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("barcode-magic/barcode-magic-core.js", "BarcodeMagicCore");

/* ------------------------------------------ the applet's methods, verbatim */

// BarCodeMagicCode.IsCorrect(): sum (i even ? 3 : 1)*digit, test mod 10.
function appletIsCorrect(nums) {
  let sum = 0;
  for (let i = 0; i < nums.length; i++) {
    sum += (i % 2 === 0 ? 3 : 1) * nums[i];
  }
  return sum % 10 === 0;
}

// BarCodeMagicCode.NumOfBlanks(): count the ModBlankNum blanks (value 10).
function appletBlanks(nums) {
  let n = 0;
  for (let i = 0; i < nums.length; i++) if (nums[i] === 10) n++;
  return n;
}

// BarCodeMagicCode.GetMissingDigit(), following the bytecode exactly.
function appletMissingDigit(nums) {
  const n = nums.length;
  let p = -1;
  for (let i = 0; i < n; i++) {
    if (nums[i] === 10) {
      p = i;
      break;
    }
  }
  if (p === -1) return -1;
  let sum = 0;
  for (let j = 0; j < n; j++) {
    if (j === p) continue;
    sum += (j % 2 === 0 ? 3 : 1) * nums[j];
  }
  let res = 10 - (sum % 10);
  if (p % 2 === 0) res = res * 7; // 7 is the inverse of 3 modulo 10
  return res % 10;
}

// BarCodeMagicCanvas.Check(): its four announcement strings.
function appletCheck(nums) {
  const blanks = appletBlanks(nums);
  if (blanks === 0) return appletIsCorrect(nums) ? "This is a valid code" : "Invalid code";
  if (blanks <= 1) return "The missing digit is" + appletMissingDigit(nums);
  return "Too many blanks!";
}

// CTKNumberMod.UpdateSlow(): step by one, modulo 11, in the click's direction.
function appletUpdateSlow(value, up) {
  return up ? (value + 1) % 11 : (value + 10) % 11;
}

// BarCodeEncoding's static Odds table, as seven 0/1 modules per digit.
const APPLET_ODD = [
  [0, 0, 0, 1, 1, 0, 1],
  [0, 0, 1, 1, 0, 0, 1],
  [0, 0, 1, 0, 0, 1, 1],
  [0, 1, 1, 1, 1, 0, 1],
  [0, 1, 0, 0, 0, 1, 1],
  [0, 1, 1, 0, 0, 0, 1],
  [0, 1, 0, 1, 1, 1, 1],
  [0, 1, 1, 1, 0, 1, 1],
  [0, 1, 1, 0, 1, 1, 1],
  [0, 0, 0, 1, 0, 1, 1],
];
// The applet fills Evens[d] with the complement of Odds[d].
const APPLET_EVEN = APPLET_ODD.map((bits) => bits.map((b) => (b === 0 ? 1 : 0)));

/** Build a valid UPC-A code from its first eleven digits. */
function withCheckDigit(prefix) {
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += (i % 2 === 0 ? 3 : 1) * prefix[i];
  return prefix.concat((10 - (sum % 10)) % 10);
}

/* ------------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  equal("start is twelve blanks", s.digits, new Array(12).fill(10));
  check("start has no announcement", s.message === "" && s.outcome === null);
  equal("page claim: twelve question marks", s.digits.map(C.digitText), new Array(12).fill("?"));
  check("start has twelve blanks", C.blankCount(s.digits) === 12);
  check("start is not checked", C.check(s.digits).outcome === "too-many");
}

/* -------------------------------- 2. clicking: every digit reachable, mod 11 */

{
  const s = C.start();
  for (let i = 0; i < 12; i++) {
    for (const dir of [1, -1]) {
      let p = s;
      const seen = [];
      for (let step = 0; step < C.MOD; step++) {
        p = C.cycle(p, i, dir);
        seen.push(p.digits[i]);
      }
      check(`cell ${i}, direction ${dir}: steps through all eleven values`,
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((v) => seen.includes(v)),
        `saw ${seen}`);
      check(`cell ${i}, direction ${dir}: wraps back to "?" after 11 clicks`,
        p.digits[i] === 10);
      const first = C.cycle(s, i, dir).digits[i];
      check(`cell ${i}, direction ${dir}: first click is ${dir === 1 ? 0 : 9}`,
        first === (dir === 1 ? 0 : 9));
      check(`cell ${i}: only that cell changes`,
        C.cycle(s, i, dir).digits.every((v, j) => j === i || v === 10));
    }
  }
  check("clicking clears the old announcement", C.cycle(
    { digits: s.digits, message: "The missing digit is7", outcome: "missing" }, 0, 1
  ).message === "");
  check("a click outside the board is refused", C.cycle(s, 12, 1) === s);
  check("a click with no direction is refused", C.cycle(s, 0, 0) === s);
  check("cycle does not mutate its position", s.digits.every((v) => v === 10));
}

/* --------------------------------- 3. UpdateSlow: core against the bytecode */

{
  const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  for (const v of values) {
    for (const up of [true, false]) {
      const state = { digits: new Array(12).fill(0), message: "", outcome: null };
      state.digits[3] = v;
      check(`UpdateSlow(${v}, ${up})`, C.cycle(state, 3, up ? 1 : -1).digits[3] === appletUpdateSlow(v, up));
    }
  }
}

/* --------------------------------------- 4. the check digit and the messages */

{
  const good = [0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2]; // a real UPC-A code
  check("036000291452 is a valid UPC-A code", C.checksum(good) === 0 && C.isValid(good));
  equal("valid code message", C.check(good).message, "This is a valid code");
  check("applet agrees the code is valid", appletIsCorrect(good));
  const bad = good.slice();
  bad[11] = 3;
  check("changing the check digit breaks the code", !C.isValid(bad) && C.checksum(bad) !== 0);
  equal("invalid code message", C.check(bad).message, "Invalid code");
  check("applet agrees the code is invalid", !appletIsCorrect(bad));
}

/* ----------------------- 5. exhaustive: exactly one check digit makes it valid */

{
  const base = [0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5];
  for (let pos = 0; pos < 11; pos++) {
    for (let v = 0; v < 10; v++) {
      const prefix = base.slice();
      prefix[pos] = v;
      let sum = 0;
      for (let i = 0; i < 11; i++) sum += (i % 2 === 0 ? 3 : 1) * prefix[i];
      const d = (10 - (sum % 10)) % 10;
      const code = prefix.concat(d);
      check(`prefix with digit ${v} at ${pos}: check digit makes it valid`, C.isValid(code));
      check(`prefix with digit ${v} at ${pos}: applet agrees`, appletIsCorrect(code));
      let found = 0;
      for (let alt = 0; alt < 10; alt++) {
        const trial = prefix.concat(alt);
        if (C.isValid(trial)) found++;
        check(`prefix ${pos}=${v}: ${alt} valid iff it is the check digit`, C.isValid(trial) === (alt === d));
      }
      check(`prefix ${pos}=${v}: exactly one check digit`, found === 1);
    }
  }
}

/* ------------------ 6. the page's claim: the missing digit is always recovered */

{
  let cases = 0;
  for (let a = 0; a < 10; a++) {
    for (let b = 0; b < 10; b++) {
      for (let c = 0; c < 10; c++) {
        const code = withCheckDigit([a, b, c, 0, 0, 0, 2, 9, 1, 4, 5]);
        for (let p = 0; p < 12; p++) {
          const hidden = code[p];
          const shown = code.slice();
          shown[p] = 10;
          cases++;
          if (cases <= 4000) { // keep the printed detail small if one fails
            check(`missing digit at ${p} in ${code.join("")}`, C.missingDigit(shown) === hidden,
              `wanted ${hidden}, got ${C.missingDigit(shown)}`);
            check(`applet agrees at ${p} in ${code.join("")}`, appletMissingDigit(shown) === hidden);
            const r = C.check(shown);
            check(`Check announces the digit at ${p} in ${code.join("")}`, r.digit === hidden);
            equal(`exact announcement at ${p} in ${code.join("")}`,
              r.message, "The missing digit is" + hidden);
            equal(`applet's announcement at ${p} in ${code.join("")}`,
              r.message, appletCheck(shown));
          }
        }
      }
    }
  }
  check("exhaustive missing-digit cases were actually walked", cases === 12000);
}

/* ---------------------- 7. core vs applet on arbitrary one-blank positions */

{
  const next = rng(20261118);
  for (let n = 0; n < 200; n++) {
    const nums = [];
    for (let i = 0; i < 12; i++) nums.push(Math.floor(next() * 10));
    const p = Math.floor(next() * 12);
    nums[p] = 10;
    check(`arbitrary one-blank case ${n}: core matches applet`,
      C.missingDigit(nums) === appletMissingDigit(nums), `at ${p}: ${nums}`);
  }
}

/* ------------------------------------- 8. too many blanks, no blanks, messages */

{
  for (let k = 2; k <= 12; k++) {
    const nums = new Array(12).fill(0);
    for (let i = 0; i < k; i++) nums[i] = 10;
    check(`${k} blanks: applet says too many`, appletCheck(nums) === "Too many blanks!");
    equal(`${k} blanks: core says too many`, C.check(nums).message, "Too many blanks!");
    check(`${k} blanks: outcome is too-many`, C.check(nums).outcome === "too-many");
  }
  check("no blank: GetMissingDigit returns -1",
    C.missingDigit([0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2]) === -1);
  check("no blank: applet returns -1 too",
    appletMissingDigit([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]) === -1);
  const noBlank = C.pressCheck({ digits: [0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2], message: "", outcome: null });
  check("pressCheck records the outcome and keeps the digits",
    noBlank.outcome === "valid" && noBlank.digits.length === 12);
}

/* ----------------------------- 9. the barcode against BarCodeEncoding's tables */

{
  for (let d = 0; d < 10; d++) {
    check(`odd parity ${d} matches BarCodeEncoding.Odds`, C.ODD[d] === APPLET_ODD[d].join(""));
    check(`even parity ${d} is the complement`, C.EVEN[d] === APPLET_EVEN[d].join(""));
  }
  const s = C.start();
  const mods = C.moduleString(s.digits);
  check("barcode has 95 modules (11 guards + 12*7 digits)", mods.length === 95);
  check("start guard is 101", mods.slice(0, 3) === "101");
  check("centre guard is 01010", mods.slice(45, 50) === "01010");
  check("end guard is 101", mods.slice(92, 95) === "101");
  check("twelve blank cells are seven '?' modules each",
    mods.slice(3, 45) === "?".repeat(42) && mods.slice(50, 92) === "?".repeat(42));
  const code = [0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2];
  const bars = C.moduleString(code);
  check("length is right for a filled code too", bars.length === 95);
  let ok = true;
  for (let i = 0; i < 12; i++) {
    const at = i < 6 ? 3 + i * 7 : 50 + (i - 6) * 7;
    const pattern = i < 6 ? C.ODD[code[i]] : C.EVEN[code[i]];
    if (bars.slice(at, at + 7) !== pattern) ok = false;
  }
  check("digit bars use odd parity left, even parity right", ok);
  check("no '?' remains once all twelve digits are filled", !bars.includes("?"));
}

/* ------------------------------------------- 10. the position is plain JSON */

{
  const s = C.start();
  equal("position survives a JSON round trip", JSON.parse(JSON.stringify(s)), s);
  const moved = C.cycle(s, 0, 1);
  check("the old position is untouched by a click", s.digits[0] === 10 && moved.digits[0] === 0);
  check("all values stay in the applet's 0..10 range",
    moved.digits.every((v) => Number.isInteger(v) && v >= 0 && v <= 10));
}

done("barcode-magic");
