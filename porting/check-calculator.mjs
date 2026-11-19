#!/usr/bin/env node
"use strict";

/*
 * Logic test for calculator/calculator-core.js.
 *
 *   node porting/check-calculator.mjs
 *
 * The button-selection machinery is checked over 2000 seeds against a second,
 * literal transcription of SelectTwoOperations / SelectFourDigits / SelectOneNum.
 * Rational arithmetic is compared with a second transcription of the applet's
 * Plus/Minus/Times/Div over every pair of fractions in a small grid, parsing is
 * checked over every decimal with two places and every fraction in the grid,
 * and the achievement is checked over every subset/permutation of 1..6 plus the
 * full 1..15 set. Then the page's claims and a few real button sequences are
 * checked through `press`.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("calculator/calculator-core.js", "CalculatorCore");

/* ------------------------- a second transcription of the applet's methods */

// SelectTwoOperations + SelectFourDigits + SelectOneNum, read off the bytecode.
function appletSelectSetup(random) {
  const i = Math.floor(random() * 2);
  const j = Math.floor(random() * 2);
  const useFloat = i === 0;
  const a = [0, 0, 0, 0];
  if (useFloat) {
    a[0] = 5;
    a[1] = Math.trunc(Math.pow(2, Math.floor(random() * 3) + 1));
  }
  const start = useFloat ? 2 : 0;
  for (let k = start; k < 4; k++) {
    for (;;) {
      const d = Math.floor(random() * 8 + 2);
      let duplicate = false;
      for (let m = 0; m < k; m++) if (a[m] === d) duplicate = true;
      if (!duplicate) {
        a[k] = d;
        break;
      }
    }
  }
  return { mulDiv: i, plusMinus: j, useFloat, digits: a };
}

// CalculatorNumber: gcd, (int,int) constructor and the four operations.
function appletGcd(a, b) {
  return b === 0 ? a : appletGcd(b, a % b);
}
function appletNumber(n, d) {
  const g = appletGcd(n, d);
  if (g !== 1) {
    n = Math.trunc(n / g);
    d = Math.trunc(d / g);
  }
  return { n, d };
}
function appletOp(a, b, op) {
  if (op === 1) return appletNumber(a.n * b.d + b.n * a.d, a.d * b.d);
  if (op === 2) return appletNumber(a.n * b.d - b.n * a.d, a.d * b.d);
  if (op === 3) return appletNumber(a.n * b.n, a.d * b.d);
  if (op === 4) return appletNumber(a.n * b.d, a.d * b.n);
  return { n: a.n, d: a.d };
}

/* ------------------------------------------------------ 1. start position */

{
  const s = C.start({ seed: 1, useMemory: false });
  equal("new game shows an empty display", s.display, "");
  equal("new game has no progress", s.progress, "");
  equal("new game has found nothing", s.found, Array(15).fill(false));
  equal("new game has no pending operation", s.op, 0);
  check("new game is not finished", C.result(s) === null);
  check("count starts at zero", C.countFound(s.found) === 0);
}

/* -------------------- 2. every random setup, against the applet's method */

{
  let bad = 0;
  let claimBad = 0;
  for (let seed = 0; seed < 2000; seed++) {
    const expected = appletSelectSetup(C.rng(seed));
    const actual = C.selectSetup(C.rng(seed));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) bad++;

    // The page: "only a few buttons are functional at any time".
    const state = C.start({ seed, useMemory: seed % 2 === 0 });
    const on = C.enabledButtons(state);
    const digits = on.filter((b) => /^[0-9]$/.test(b));
    const ok =
      on.indexOf("0") >= 0 &&
      digits.length === 5 && // 0 plus the four working digits
      on.indexOf("1") < 0 &&
      digits.every((d) => d !== "1") &&
      C.DEAD_BUTTONS.every((b) => on.indexOf(b) < 0) &&
      (on.indexOf("*") >= 0) !== (on.indexOf("/") >= 0) &&
      (on.indexOf("+") >= 0) !== (on.indexOf("-") >= 0) &&
      (on.indexOf("+/-") >= 0) === (on.indexOf("-") >= 0) &&
      (on.indexOf(".") >= 0) === (on.indexOf("*") >= 0) &&
      on.indexOf("=") >= 0 &&
      on.indexOf("CE") >= 0 && on.indexOf("C") >= 0 &&
      ["MC", "MR", "MS", "M+"].every((b) => (on.indexOf(b) >= 0) === state.useMemory) &&
      on.length <= 16;
    if (!ok) claimBad++;
    if (state.useFloat) {
      if (!(state.digits.indexOf(5) >= 0 && [2, 4, 8].indexOf(state.digits[1]) >= 0)) claimBad++;
    }
  }
  check("selectSetup matches the applet for 2000 seeds", bad === 0, `${bad} different`);
  check("the page's 'only a few buttons work' claim holds for 2000 seeds", claimBad === 0, `${claimBad} bad setups`);
}

/* ------------------------ 3. rational arithmetic, every pair in a grid */

{
  const nums = [];
  for (let n = -6; n <= 12; n++) for (let d = 1; d <= 6; d++) nums.push(C.make(n, d));
  let bad = 0;
  for (const a of nums) {
    for (const b of nums) {
      for (let op = 1; op <= 4; op++) {
        // 0 / 0 makes the applet divide by zero in CalculatorNumber(int,int)
        // and throw; the port shows "Bad number" instead (checked below).
        if (op === 4 && a.n === 0 && b.n === 0) continue;
        const actual = C.applyOp(a, b, op);
        const expected = appletOp(a, b, op);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) bad++;
      }
    }
  }
  check(`arithmetic matches the applet for ${nums.length ** 2 * 4} cases`, bad === 0, `${bad} different`);
  // The one case the applet cannot finish: 0/0. The port degrades gracefully.
  equal("0 / 0 is shown as the applet's 'Bad number'", C.formatNumber(C.applyOp(C.make(0, 1), C.make(0, 1), 4)), "Bad number");
}

/* ------------------------------ 4. parsing decimals and fractions */

{
  let bad = 0;
  for (let whole = 0; whole <= 9; whole++) {
    for (let tenths = 0; tenths <= 9; tenths++) {
      for (let hundredths = 0; hundredths <= 9; hundredths++) {
        const text = `${whole}.${tenths}${hundredths}`;
        const n = parseInt(String(whole) + tenths + hundredths, 10);
        const expected = n === 0 ? { n: 0, d: 100 } : C.make(n, 100);
        // The applet's float constructor stores n/10^k unreduced; arithmetic
        // reduces later, so compare the value rather than the representation.
        const actual = C.parseNumber(text, true);
        if (actual.n / actual.d !== expected.n / expected.d) bad++;
      }
    }
  }
  check("float-mode parsing is correct for all 1000 two-place decimals", bad === 0, `${bad} different`);

  bad = 0;
  for (let n = -12; n <= 12; n++) {
    for (let d = 1; d <= 8; d++) {
      const parsed = C.parseNumber(`${n}/${d}`, false);
      const expected = appletNumber(n, d);
      if (JSON.stringify(parsed) !== JSON.stringify(expected)) bad++;
      // Insert(String) parses the fraction first, so "2/2" counts as 1.
      const reduced = appletNumber(n, d);
      const eligible = reduced.d === 1 && reduced.n >= 1 && reduced.n <= 15;
      if (C.insertText([...Array(15).fill(false)], `${n}/${d}`) !== eligible) bad++;
    }
  }
  check("integer-mode parsing and reduction match the applet", bad === 0, `${bad} different`);
  equal("junk parses as zero", C.parseNumber("not-a-number", false), { n: 0, d: 1 });
  equal("an empty display parses as zero", C.parseNumber("", false), { n: 0, d: 1 });
  equal("division by zero is the applet's 'Bad number'", C.formatNumber({ n: 5, d: 0 }), "Bad number");
}

/* ----------------------------------------------------- 5. Crop's rule */

{
  let bad = 0;
  for (let tenths = -150; tenths <= 150; tenths++) {
    const text = String(tenths / 10);
    const integral = tenths % 10 === 0;
    const actual = C.crop(text);
    const expected = integral ? String(Math.trunc(tenths / 10)) : text;
    if (actual !== expected) bad++;
  }
  check("Crop shortens exactly the whole-valued strings", bad === 0, `${bad} different`);
}

/* ---------------- 6. the page's 'any order' claim, exhaustively */

{
  // Every permutation of the numbers 1..6 must produce the same progress line.
  const perms = [];
  const visit = (rest, prefix) => {
    if (!rest.length) return perms.push(prefix);
    rest.forEach((x, i) => visit(rest.filter((_, j) => j !== i), prefix.concat(x)));
  };
  visit([1, 2, 3, 4, 5, 6], []);
  let bad = 0;
  for (const order of perms) {
    const found = Array(15).fill(false);
    order.forEach((n) => C.insert(found, n));
    if (C.achievementString(found) !== "1,2,3,4,5,6") bad++;
    if (C.countFound(found) !== 6) bad++;
  }
  check(`progress is order-independent for all ${perms.length} orders of 1..6`, bad === 0, `${bad} bad`);

  const found = Array(15).fill(false);
  for (let n = 1; n <= 15; n++) check(`the achievement accepts ${n}`, C.insert(found, n) === true);
  equal("all fifteen findings end with '!'", C.achievementString(found), "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15!");
  check("the game is finished at fifteen", C.result({ found }) === "done");
  check("a repeated number is ignored", C.insert(found, 7) === false);
  check("zero is ignored", C.insert(found, 0) === false);
  check("sixteen is ignored", C.insert(found, 16) === false);
  check("a fraction is not recorded", C.insertText(Array(15).fill(false), "3/2") === false);
  check("a whole number written as a fraction is recorded", C.insertText(Array(15).fill(false), "6/2") === true);
}

/* ------------------------- 7. button sequences through the real state */

{
  // A seed with simple buttons: no decimals, digits 2 and 4, plus enabled.
  let seed = -1;
  for (let s = 0; s < 5000; s++) {
    const st = C.start({ seed: s });
    if (!st.useFloat && st.plusMinus === 0 && st.digits.indexOf(2) >= 0 && st.digits.indexOf(4) >= 0) {
      seed = s;
      break;
    }
  }
  check("a seed with 2, 4 and + exists", seed >= 0);
  let st = C.start({ seed, useMemory: true });
  const on = C.enabledButtons(st);
  check("a button that is switched off is refused", C.press(st, "1") === st && C.press(st, "sqrt") === st);
  check("the operation pair follows the random setup", on.indexOf("/") >= 0 && on.indexOf("*") < 0 && on.indexOf("+") >= 0 && on.indexOf("-") < 0);
  check("a dead button is refused", C.press(st, "1/x") === st && C.press(st, "%") === st);

  st = C.press(st, "2");
  equal("typing a digit shows it", st.display, "2");
  st = C.press(st, "+");
  check("an operation sets the pending flag", st.op === 1 && st.opPressed);
  st = C.press(st, "4");
  equal("the next digit clears the display first", st.display, "4");
  check("the pending flag is consumed", !st.opPressed);
  st = C.press(st, "=");
  equal("2 + 4 gives 6", st.display, "6");
  equal("the result is recorded", st.progress, "6");
  equal("the status reports which number changed", st.lastFound, 6);
  check("the operation is cleared after =, keeping the result", st.op === 0 && st.temp !== null);

  st = C.press(st, "CE");
  equal("CE clears the entry", st.display, "");

  // C clears the whole play, including memory and the pending operation.
  const digit = on.find((b) => /^[2-9]$/.test(b));
  st = C.press(st, digit);
  st = C.press(st, "MS");
  equal("MS stores the display", st.memory, digit);
  equal("the memory indicator lights", st.memIndicator, "M");
  st = C.press(st, "MR");
  equal("MR recalls the number", st.display, digit);
  st = C.press(st, "M+");
  equal("M+ adds the display to memory", st.memory, String(Number(digit) * 2));
  st = C.press(st, "+");
  st = C.press(st, "C");
  equal("C clears the display", st.display, "");
  equal("C clears memory", st.memory, "");
  equal("C clears the pending operation", st.op, 0);

  // The sign key belongs to the minus half of the random pair.
  let signSeed = -1;
  for (let s = 0; s < 5000; s++) {
    const st2 = C.start({ seed: s });
    if (st2.plusMinus === 1 && st2.digits.indexOf(2) >= 0) { signSeed = s; break; }
  }
  check("a seed with the sign key exists", signSeed >= 0);
  let signed = C.press(C.start({ seed: signSeed }), "2");
  signed = C.press(signed, "+/-");
  equal("the sign key negates", signed.display, "-2");
  signed = C.press(signed, "+/-");
  equal("the sign key flips back", signed.display, "2");

  // Reset and New differ: Reset keeps the broken set, New redraws it.
  st = C.start({ seed });
  st = C.press(st, "2");
  st = C.press(st, "=");
  const kept = C.reset(st);
  equal("Reset keeps the same digits", kept.digits, st.digits);
  equal("Reset clears the achievement", kept.progress, "");
  const fresh = C.start({ seed: seed + 1 });
  check("New can produce a different broken set", JSON.stringify(fresh.digits) !== JSON.stringify(st.digits) || fresh.useFloat !== st.useFloat);
}

/* ------------------------------ 8. memory option and float-mode paths */

{
  let seed = -1;
  for (let s = 0; s < 5000; s++) {
    const st = C.start({ seed: s });
    if (st.useFloat && st.plusMinus === 0 && st.digits.indexOf(2) >= 0) { seed = s; break; }
  }
  check("a float-mode seed with digit 2 exists", seed >= 0);
  let st = C.start({ seed, useMemory: true });
  check("the memory keys work only when the option is on", C.enabledButtons(st).indexOf("M+") >= 0);
  const noMem = C.setUseMemory(st, false);
  check("switching the option off disables memory keys", C.enabledButtons(noMem).indexOf("M+") < 0);
  equal("switching the option off clears the indicator", noMem.memIndicator, "");

  st = C.press(st, ".");
  equal("the decimal point is usable in float mode", st.display, ".");
  st = C.press(st, "5");
  equal("a decimal can be typed", st.display, ".5");
  const moved = C.compute(st, true);
  equal("0.5 is not a target integer", moved.state.progress, "");
  equal("the parsed decimal is five tenths", C.parseNumber("0.5", true).n / C.parseNumber("0.5", true).d, 0.5);
  equal("M+ uses the applet's float path", C.memoryPlus("", "0.5", true), "0.5");
  equal("M+ accumulates in float mode", C.memoryPlus("0.5", "0.25", true), "0.75");
}

done("calculator");
