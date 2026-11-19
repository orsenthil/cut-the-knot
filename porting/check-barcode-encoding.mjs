#!/usr/bin/env node
"use strict";

/*
 * Logic test for barcode-encoding/barcode-encoding-core.js.
 *
 *   node porting/check-barcode-encoding.mjs
 *
 * The applet has four small tables (10x7, 10x7, 10x7, 10x6), so everything is
 * checked exhaustively: the four tables and the three Get* methods against a
 * second, literal transcription of the bytecode; every claim the cut-the-knot
 * page makes about runs, parities and guards; both complete barcodes over all
 * system digits, positions and digit values; the UPC-A-in-EAN-13 claim; the
 * check digits of the example codes; and the state transitions the UI uses.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("barcode-encoding/barcode-encoding-core.js", "BarcodeEncodingCore");

const str = (bits) => bits.join("");
const filled = (d, n) => Array(n).fill(d);

/* ------------------------------------------------- 1. the applet's tables */

{
  check("Odds is 10 rows of 7 bits", C.ODDS.length === 10 && C.ODDS.every((r) => r.length === 7));
  check("Evens is 10 rows of 7 bits", C.EVENS.length === 10 && C.EVENS.every((r) => r.length === 7));
  check("Mirrors is 10 rows of 7 bits", C.MIRRORS.length === 10 && C.MIRRORS.every((r) => r.length === 7));
  check("LeftSideParity is 10 rows of 6 bits",
    C.LEFT_PARITY.length === 10 && C.LEFT_PARITY.every((r) => r.length === 6));

  // Literal transcription of the static initialiser, straight from javap.
  const oddLiteral = [
    "0001101", "0011001", "0010011", "0111101", "0100011",
    "0110001", "0101111", "0111011", "0110111", "0001011",
  ].map((s) => s.split("").map(Number));
  const evenLiteral = oddLiteral.map((r) => r.map((b) => (b === 0 ? 1 : 0)));
  const mirrorLiteral = evenLiteral.map((r) => r.slice().reverse());
  const parityLiteral = [
    "111111", "110100", "110010", "110001", "101100",
    "100110", "100011", "101010", "101001", "100101",
  ].map((s) => s.split("").map(Number));

  for (let d = 0; d < 10; d++) {
    equal(`Odds[${d}] matches the applet`, C.ODDS[d], oddLiteral[d]);
    equal(`Evens[${d}] matches the applet`, C.EVENS[d], evenLiteral[d]);
    equal(`Mirrors[${d}] matches the applet`, C.MIRRORS[d], mirrorLiteral[d]);
    equal(`LeftSideParity[${d}] matches the applet`, C.LEFT_PARITY[d], parityLiteral[d]);
  }
}

/* ------------------------------- 2. the three Get* methods, all 600 cases */

{
  for (let d = 0; d < 10; d++) {
    equal(`GetOdd(${d})`, C.getOdd(d), C.ODDS[d]);
    equal(`GetEven(${d})`, C.getEven(d), C.EVENS[d]);
    equal(`GetMirror(${d})`, C.getMirror(d), C.MIRRORS[d]);
    // The applet hands out the array itself; we hand out a copy, so a caller
    // cannot corrupt the table. Same values, safer behaviour.
    const copy = C.getOdd(d);
    copy[0] = 1 - copy[0];
    equal(`GetOdd(${d}) returns a copy`, C.getOdd(d), C.ODDS[d]);
  }

  // Literal transcription of GetOdd(int,int,int):
  //   LeftSideParity[system][position-1] ? Odds[digit] : Mirrors[digit]
  const odds = [
    "0001101", "0011001", "0010011", "0111101", "0100011",
    "0110001", "0101111", "0111011", "0110111", "0001011",
  ].map((s) => s.split("").map(Number));
  const mirrors = odds.map((r) => r.map((b) => 1 - b).reverse());
  const parity = [
    "111111", "110100", "110010", "110001", "101100",
    "100110", "100011", "101010", "101001", "100101",
  ].map((s) => s.split("").map(Number));
  let n = 0;
  for (let system = 0; system < 10; system++) {
    for (let pos = 1; pos <= 6; pos++) {
      for (let digit = 0; digit < 10; digit++) {
        const expected = parity[system][pos - 1] ? odds[digit] : mirrors[digit];
        equal(`GetOdd(${system},${pos},${digit})`, C.getBar(system, pos, digit), expected);
        equal(`getLeftParity(${system},${pos})`, C.getLeftParity(system, pos), parity[system][pos - 1]);
        n++;
      }
    }
  }
  check("all 600 GetOdd(system,position,digit) cases checked", n === 600);
}

/* -------------------------------------------- 3. the page's claims on runs */

{
  for (const [name, table] of [["odd", C.ODDS], ["even", C.EVENS], ["mirror", C.MIRRORS]]) {
    for (let d = 0; d < 10; d++) {
      const pattern = table[d];
      equal(`${name}[${d}] is 7 bars`, pattern.length, 7);
      equal(`${name}[${d}] has four generalized bars`, C.runs(pattern).length, 4);
      check(`${name}[${d}] uses only 0 and 1`, pattern.every((b) => b === 0 || b === 1));
      check(`${name}[${d}] has no run wider than four`, C.runs(pattern).every((r) => r.length <= 4));
    }
  }
  // Interlacing: the page says left codes are white-black-white-black and
  // right codes black-white-black-white. Colour 0 is white, 1 is black.
  for (let d = 0; d < 10; d++) {
    equal(`odd[${d}] interlaces white-black-white-black`,
      C.runs(C.ODDS[d]).map((r) => r.color).join(""), "0101");
    equal(`mirror[${d}] interlaces white-black-white-black`,
      C.runs(C.MIRRORS[d]).map((r) => r.color).join(""), "0101");
    equal(`even[${d}] interlaces black-white-black-white`,
      C.runs(C.EVENS[d]).map((r) => r.color).join(""), "1010");
    // "left side barcodes ... end in a black bar. The right side ... end in a space."
    equal(`odd[${d}] ends black`, C.ODDS[d][6], 1);
    equal(`mirror[${d}] ends black`, C.MIRRORS[d][6], 1);
    equal(`even[${d}] ends white`, C.EVENS[d][6], 0);
  }
}

/* ------------------------- 4. colour exchange and mirror image (all cases) */

{
  for (let d = 0; d < 10; d++) {
    equal(`right code is the colour exchange of odd[${d}]`,
      C.EVENS[d], C.ODDS[d].map((b) => 1 - b));
    equal(`left even code is the mirror of right code for ${d}`,
      C.MIRRORS[d], C.EVENS[d].slice().reverse());
  }
  // The table printed on the cut-the-knot page, odd=1 / even=0.
  const pageTable = [
    "odd odd odd odd odd odd", "odd odd even odd even even",
    "odd odd even even odd even", "odd odd even even even odd",
    "odd even odd odd even even", "odd even even odd odd even",
    "odd even even even odd odd", "odd even odd even odd even",
    "odd even odd even even odd", "odd even even odd even odd",
  ].map((s) => s.split(" ").map((w) => (w === "odd" ? 1 : 0)));
  for (let system = 0; system < 10; system++) {
    equal(`page parity table, system digit ${system}`, C.LEFT_PARITY[system], pageTable[system]);
  }
}

/* -------------------------------------------- 5. the complete barcodes */

{
  const startGuard = "101", middleGuard = "01010", endGuard = "101";
  const code = [0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2];
  const upc = C.encodeUPC(code);
  const ean = C.encodeEAN13([0].concat(code));

  equal("UPC-A has 95 modules", upc.bits.length, 95);
  equal("EAN-13 has 95 modules", ean.bits.length, 95);
  equal("UPC-A starts with 101", str(upc.bits.slice(0, 3)), startGuard);
  equal("UPC-A middle guard is 01010", str(upc.bits.slice(45, 50)), middleGuard);
  equal("UPC-A ends with 101", str(upc.bits.slice(92, 95)), endGuard);
  equal("EAN-13 starts with 101", str(ean.bits.slice(0, 3)), startGuard);
  equal("EAN-13 middle guard is 01010", str(ean.bits.slice(45, 50)), middleGuard);
  equal("EAN-13 ends with 101", str(ean.bits.slice(92, 95)), endGuard);
  check("every module is black or white",
    upc.bits.concat(ean.bits).every((b) => b === 0 || b === 1));

  // Each of the twelve digits contributes exactly seven bars, six per side.
  const upcDigits = upc.segments.filter((s) => s.kind === "digit");
  equal("UPC-A has twelve digit segments", upcDigits.length, 12);
  check("each UPC-A digit is seven bars", upcDigits.every((s) => s.bits.length === 7));
  equal("UPC-A's first six digits are odd parity",
    upcDigits.slice(0, 6).map((s) => s.parity).join(","), "odd,odd,odd,odd,odd,odd");
  equal("UPC-A's last six digits are right-side codes",
    upcDigits.slice(6).map((s) => s.parity).join(","), "right,right,right,right,right,right");

  // Every digit value in every position, not just the example.
  for (let d = 0; d < 10; d++) {
    const rows = C.encodeUPC(filled(d, 12)).segments.filter((s) => s.kind === "digit");
    for (let i = 0; i < 6; i++) {
      equal(`UPC-A left position ${i + 1} of digit ${d}`, rows[i].bits, C.ODDS[d]);
      equal(`UPC-A right position ${i + 7} of digit ${d}`, rows[i + 6].bits, C.EVENS[d]);
    }
  }

  // EAN-13: the first digit has no segment; each left parity comes from the table.
  for (let system = 0; system < 10; system++) {
    for (let d = 0; d < 10; d++) {
      const code13 = [system].concat(filled(d, 12));
      const rows = C.encodeEAN13(code13).segments.filter((s) => s.kind === "digit");
      equal("EAN-13 encodes twelve digits, not thirteen", rows.length, 12);
      for (let pos = 1; pos <= 6; pos++) {
        equal(`EAN-13 system ${system} position ${pos} digit ${d}`,
          rows[pos - 1].bits, C.getBar(system, pos, d));
        equal(`EAN-13 parity flag, system ${system} position ${pos}`,
          rows[pos - 1].parity, C.getLeftParity(system, pos) ? "odd" : "even");
      }
      for (let i = 6; i < 12; i++) {
        equal(`EAN-13 right position ${i + 1} of digit ${d}`, rows[i].bits, C.EVENS[d]);
      }
    }
  }
}

/* ------------------------------ 6. UPC-A embedded in EAN-13 by prepending 0 */

{
  const rand = rng(20261118);
  for (let n = 0; n < 200; n++) {
    const code = Array.from({ length: 12 }, () => Math.floor(rand() * 10));
    equal(`UPC-A ${str(code)} equals EAN-13 with a leading 0`,
      C.encodeUPC(code).bits, C.encodeEAN13([0].concat(code)).bits);
  }
  // A non-zero system digit *does* change the left half: it is not a UPC-A.
  const code = [4, 0, 0, 6, 3, 8, 1, 3, 3, 3, 9, 3];
  check("a non-zero system digit changes the bars",
    str(C.encodeUPC(code).bits) !== str(C.encodeEAN13([4].concat(code)).bits));
  check("but the right half is unchanged",
    str(C.encodeUPC(code).bits.slice(50)) === str(C.encodeEAN13([4].concat(code)).bits.slice(50)));
}

/* ------------------------------------------- 7. check digits of the examples */

{
  equal("UPC-A example check digit", C.checkDigit([0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5], "UPC-A"), 2);
  equal("EAN-13 example check digit", C.checkDigit([4, 0, 0, 6, 3, 8, 1, 3, 3, 3, 9, 3], "EAN-13"), 1);
  equal("second EAN-13 example check digit", C.checkDigit([5, 9, 0, 1, 2, 3, 4, 1, 2, 3, 4, 5], "EAN-13"), 7);
  check("036000291452 is a valid UPC-A", C.validCode([0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2], "UPC-A"));
  check("4006381333931 is a valid EAN-13", C.validCode([4, 0, 0, 6, 3, 8, 1, 3, 3, 3, 9, 3, 1], "EAN-13"));
  check("a wrong check digit is rejected", !C.validCode([4, 0, 0, 6, 3, 8, 1, 3, 3, 3, 9, 3, 2], "EAN-13"));
  check("a code of the wrong length is rejected", !C.validCode([0, 3, 6], "UPC-A"));

  const rand = rng(7);
  for (let n = 0; n < 100; n++) {
    const upc = Array.from({ length: 11 }, () => Math.floor(rand() * 10));
    const ean = Array.from({ length: 12 }, () => Math.floor(rand() * 10));
    const u = upc.concat(C.checkDigit(upc, "UPC-A"));
    const e = ean.concat(C.checkDigit(ean, "EAN-13"));
    check(`generated UPC-A ${str(u)} is valid`, C.validCode(u, "UPC-A"));
    check(`generated EAN-13 ${str(e)} is valid`, C.validCode(e, "EAN-13"));
  }
}

/* ---------------------------------------- 8. positions the page's UI makes */

{
  const s = C.start({});
  equal("new game is UPC-A", s.mode, "UPC-A");
  equal("new game has twelve digits", s.digits.length, 12);
  equal("new game selects the first digit", s.cursor, 0);
  equal("a demo's result is done", C.result(s), "done");

  equal("stepping up changes the digit", C.stepDigit(s, 1).digits[0], 1);
  equal("stepping below 0 stops at 0", C.stepDigit(s, -1).digits[0], 0);
  const nine = C.setDigit(s, 0, 9);
  equal("stepping above 9 stops at 9", C.stepDigit(nine, 1).digits[0], 9);
  equal("setDigit clamps high", C.setDigit(s, 0, 42).digits[0], 9);
  equal("setDigit clamps low", C.setDigit(s, 0, -3).digits[0], 0);
  equal("cursor stops at the left end", C.moveCursor(s, -1).cursor, 0);
  equal("cursor stops at the right end", C.moveCursor(s, 100).cursor, 11);
  equal("cursor moves one at a time", C.moveCursor(s, 2).cursor, 2);
  equal("setDigit keeps the cursor", C.setDigit(C.moveCursor(s, 3), 1, 7).cursor, 3);

  const ean = C.setMode(s, "EAN-13");
  equal("switching to EAN-13 prepends a zero", ean.digits[0], 0);
  equal("switching to EAN-13 keeps the twelve encoded digits",
    ean.digits.slice(1), s.digits);
  equal("switching back recovers UPC-A", C.setMode(ean, "UPC-A").digits, s.digits);
  equal("switching to the same mode is a no-op", C.setMode(ean, "EAN-13").digits, ean.digits);

  const changed = C.withDigits(ean, [9, 8, 7]);
  equal("withDigits pads to thirteen", changed.digits.length, 13);
  equal("withDigits clamps out-of-range input", changed.digits[0], 9);
  equal("withDigits zeroes missing digits", changed.digits[12], 0);
  equal("encode dispatches on mode", C.encode(ean).bits, C.encodeEAN13(ean.digits).bits);
  equal("encode dispatches on UPC-A too", C.encode(s).bits, C.encodeUPC(s.digits).bits);

  // The saved position must be plain JSON, exactly as handed to Track.state.
  equal("position survives JSON round-trip", JSON.parse(JSON.stringify(changed)), changed);
}

done("barcode-encoding");
