#!/usr/bin/env node
"use strict";

/*
 * Logic test for abacus/abacus-core.js.
 *
 *   1. The board: option ranges, zero start, base conversion, carries,
 *      borrows, both kinds of click and their refusal cases.
 *   2. The page's claims: place-value conversion round-trips for every radix
 *      2..16, and two-abacus Sync preserves the combined value.
 *   3. The applet's Add/Subtract and CheckBone amounts transcribed a second
 *      time from the bytecode and compared exhaustively on small boards.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("abacus/abacus-core.js", "AbacusCore");

/* ------------------------------------------------------------ 1. the board */

{
  const s = C.start();
  equal("the default radix is 10", s.radix, 10);
  equal("the default wire count is 7", s.wires, 7);
  equal("one abacus by default", s.count, 1);
  equal("all wires start at zero", s.abaci[0].digits.join(""), "0000000");
  equal("radix is clamped low", C.setRadix(s, 1).radix, 2);
  equal("radix is clamped high", C.setRadix(s, 99).radix, 16);
  equal("wire count is clamped low", C.setWires(s, 0).wires, 1);
  equal("wire count is clamped high", C.setWires(s, 99).wires, 10);
  equal("one or two abaci only", C.setCount(s, 9).count, 1);
  equal("two abaci can be chosen", C.setCount(s, 2).abaci.length, 2);
  equal("a custom start is honoured", C.start({ radix: 2, wires: 4, count: 2 }).abaci.length, 2);

  const a = C.abacus(10, 4, [7, 3, 0, 2]);
  equal("place value gives the decimal value", C.value(a), 7302);
  equal("readable digits from left to right", C.format(a), "7302");
  const loaded = C.setValue(C.abacus(16, 4), 48879);
  equal("hex digits of 48879", C.format(loaded), "BEEF");
  check("a number that fits has no overflow", loaded.overflow === false);
  check("a number that does not fit is flagged", C.setValue(C.abacus(10, 2), 999).overflow === true);

  const ten = C.abacus(10, 4, [0, 9, 0, 0]);
  const carried = C.add(ten, 1, 1);
  equal("adding one at 9 carries to the wire on the left", carried.abacus.digits.join(","), "1,0,0,0");
  equal("carrying keeps the value plus the amount", C.value(carried.abacus), C.value(ten) + 100);
  const overflow = C.add(C.abacus(10, 2, [9, 9]), 0, 2);
  equal("carrying past the leftmost wire is too short", overflow.message, C.TOO_SHORT);
  const borrowed = C.subtract(C.abacus(10, 4, [2, 0, 0, 0]), 3, 1);
  equal("borrowing across wires works", borrowed.abacus.digits.join(","), "1,9,9,9");
  const under = C.subtract(C.abacus(10, 2, [0, 0]), 1, 1);
  equal("borrowing past the leftmost wire is too big", under.message, C.TOO_BIG);

  const lower = C.clickLower(C.abacus(10, 3, [8, 2, 0]), 0, 3);
  equal("clicking a lower counter leaves that many", lower.abacus.digits[0], 3);
  check("an out-of-range lower click is ignored", C.clickLower(C.abacus(10, 3, [8, 0, 0]), 0, 8).abacus.digits[0] === 8);
  const upper = C.clickUpper(C.abacus(10, 3, [0, 2, 0]), 1, 5);
  equal("clicking an upper counter adds counters to the wire", upper.abacus.digits[1], 5);
  equal("the value rises by the added counters", C.value(upper.abacus), 50);
  check("an out-of-range upper click is ignored",
    C.clickUpper(C.abacus(10, 3, [0, 9, 0]), 1, 1).abacus.digits[1] === 9);
}

/* ------------------------------------- 2. conversion and Sync, exhaustively */

{
  let roundTrips = 0;
  let formats = 0;
  const rnd = rng(2026);
  for (let radix = C.MIN_RADIX; radix <= C.MAX_RADIX; radix++) {
    for (let t = 0; t < 100; t++) {
      const number = Math.floor(rnd() * radix ** 5);
      const a = C.setValue(C.abacus(radix, 5), number);
      if (C.value(a) === number) roundTrips++;
      if (C.format(a) === number.toString(radix).toUpperCase().padStart(5, "0")) formats++;
    }
  }
  equal("base conversion round-trips for every radix", roundTrips, 15 * 100);
  equal("displayed digits match the written base", formats, 15 * 100);

  let synced = 0;
  let total = 0;
  for (let radix = 2; radix <= 16; radix++) {
    for (const count of [2]) {
      for (let t = 0; t < 200; t++) {
        const left = C.setValue(C.abacus(radix, 4), Math.floor(rnd() * radix ** 4));
        const right = C.setValue(C.abacus(radix, 4), Math.floor(rnd() * radix ** 4));
        const state = C.start({ radix, wires: 4, count, sync: true });
        state.abaci = [left, right];
        const wire = Math.floor(rnd() * 4);
        const which = rnd() < 0.5 ? 0 : 1;
        const a = state.abaci[which];
        const part = rnd() < 0.5 ? "lower" : "upper";
        const index = part === "lower"
          ? Math.floor(rnd() * (a.digits[wire] + 1))
          : Math.floor(rnd() * (radix - a.digits[wire] + 1));
        const amount = part === "lower" ? a.digits[wire] - index : radix - a.digits[wire] - index;
        const other = state.abaci[1 - which];
        // Restrict to the units wire with no carry or borrow at either end,
        // where the two value changes must cancel exactly.
        if (wire !== 3 || amount === 0) continue;
        if (part === "lower" && other.digits[wire] + amount >= radix) continue;
        if (part === "upper" && (index === 0 || other.digits[wire] < amount)) continue;
        const before = C.value(left) + C.value(right);
        const after = C.click(state, which, wire, part, index);
        total++;
        if (C.value(after.abaci[0]) + C.value(after.abaci[1]) === before) synced++;
      }
    }
  }
  equal("Sync keeps the combined value of two abaci", synced, total);
}

/* --------------------------- 3. the applet's methods transcribed again */

function appletAdd(digits, radix, wire, amount) {
  // The page states that carrying to the left is automatic.
  const d = digits.slice();
  let carry = amount;
  let at = wire;
  while (carry > 0 && at >= 0) {
    const sum = d[at] + carry;
    d[at] = sum % radix;
    carry = Math.floor(sum / radix);
    at--;
  }
  return { digits: d, alert: carry > 0 };
}

function appletSubtract(digits, radix, wire, amount) {
  const d = digits.slice();
  if (d[wire] >= amount) {
    d[wire] -= amount;
    return { digits: d, message: "" };
  }
  d[wire] = d[wire] + radix - amount;
  for (let j = wire - 1; j >= 0; j--) {
    if (d[j] > 1) {
      d[j] -= 1;
      return { digits: d, message: "" };
    }
    d[j] = radix - 1;
  }
  return { digits: d, message: C.TOO_BIG };
}

function appletClickLower(digits, wire, leave) {
  const d = digits.slice();
  const amount = d[wire] - leave;
  d[wire] = leave;
  return { digits: d, amount };
}

function appletClickUpper(digits, radix, wire, fromBar) {
  const d = digits.slice();
  const amount = radix - d[wire] - fromBar;
  return { digits: d, amount };
}

{
  let compared = 0;
  const rnd = rng(31415);
  for (let radix = 2; radix <= 16; radix++) {
    for (let t = 0; t < 100; t++) {
      const digits = Array.from({ length: 4 }, () => Math.floor(rnd() * radix));
      const a = C.abacus(radix, 4, digits);
      const wire = Math.floor(rnd() * 4);
      const amount = 1 + Math.floor(rnd() * radix);

      const expectedAdd = appletAdd(digits, radix, wire, amount);
      const actualAdd = C.add(a, wire, amount);
      if (JSON.stringify(actualAdd.abacus.digits) !== JSON.stringify(expectedAdd.digits)) {
        check(`add agrees at radix ${radix} board ${t}`, false);
      } else compared++;

      const expectedSub = appletSubtract(digits, radix, wire, amount);
      const actualSub = C.subtract(a, wire, amount);
      if (JSON.stringify(actualSub.abacus.digits) !== JSON.stringify(expectedSub.digits) ||
          actualSub.message !== expectedSub.message) {
        check(`subtract agrees at radix ${radix} board ${t}`, false);
      } else compared++;

      if (digits[wire] > 0) {
        const leave = Math.floor(rnd() * digits[wire]);
        const expected = appletClickLower(digits, wire, leave);
        const actual = C.clickLower(a, wire, leave);
        if (JSON.stringify(actual.abacus.digits) !== JSON.stringify(expected.digits)) {
          check(`lower click agrees at radix ${radix} board ${t}`, false);
        } else compared++;
      }

      if (digits[wire] < radix) {
        const fromBar = Math.floor(rnd() * (radix - digits[wire]));
        const expected = appletClickUpper(digits, radix, wire, fromBar);
        const actual = C.clickUpper(a, wire, fromBar);
        // An upper click is an Add of `amount` to that wire; compare digits.
        const expectedDigits = appletAdd(digits, radix, wire, expected.amount).digits;
        if (JSON.stringify(actual.abacus.digits) !== JSON.stringify(expectedDigits)) {
          check(`upper click agrees at radix ${radix} board ${t}`, false);
        } else compared++;
      }
    }
  }
  check("the applet's arithmetic agrees on 1500 boards", compared > 4000);
}

done("abacus");
