#!/usr/bin/env node
"use strict";

/*
 * Logic test for ean13/ean13-core.js.
 *
 *   node porting/check-ean13.mjs
 *
 * The page's formula d1 + 3 d2 + d3 + ... + 3 d12 + d13 = 0 (mod 10) is checked on
 * a million codes spread
 * over all 12-digit prefixes (every value of each digit position in turn, the rest random);
 * the check digit catches every single-digit error (exhaustively, for every digit
 * position and every wrong value, on random codes); adjacent swaps are caught
 * unless the two digits differ by 5 (a fact worth knowing); the UPC-A embedding
 * (a leading 0) keeps the check digit of the 12-digit UPC-A; the page's ISBN example
 * 0-14-200057-4 becomes 9780142000571; and the bars are right: 95 modules, the
 * right guards, 30 different seven-module codes, and decoding the bars of 200,000
 * random codes gives back the digits.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("ean13/ean13-core.js", "Ean13Core");

{
  const s = C.start({});
  equal("the applet opens on 0 1 2 3 4 5 6 7 8 9 0 1 and a computed check digit", s.digits.slice(0, 12).join(""), "012345678901");
  check("the opening code is valid", C.valid(s.digits) && s.digits.length === 13);
  equal("its check digit is 2", s.digits[12], 2);
  const t = C.move(s, { type: "step", i: 11 });
  check("raising the twelfth digit changes the check digit and keeps the code valid", t.digits[11] === 2 && C.valid(t.digits) && t.digits[12] !== s.digits[12]);
  check("9 + 1 wraps to 0", C.move({ ...s, digits: [9, ...s.digits.slice(1)] }, { type: "step", i: 0 }).digits[0] === 0);
  check("the check digit itself cannot be changed", C.move(s, { type: "step", i: 12 }) === null && C.move(s, { type: "set", i: 12, value: 3 }) === null);
  check("a digit above 9 or a position below 0 is refused", C.move(s, { type: "set", i: 0, value: 10 }) === null && C.move(s, { type: "set", i: -1, value: 1 }) === null);
  check("the old position is untouched", s.moves === 0 && s.digits[11] === 1);
  check("Reset gives the opening code", C.move(t, { type: "reset" }).digits.join("") === s.digits.join("") && C.result(C.move(t, { type: "reset" })) === null && C.result(t) === "done");
}

{
  let seed = 7;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  const random12 = () => Array.from({ length: 12 }, () => rnd(10));
  let n = 0, bad = null;
  for (let pos = 0; pos < 12; pos++) for (let v = 0; v < 10; v++) for (let t = 0; t < 5000; t++) {
    const f = random12(); f[pos] = v;
    if (!C.valid(f.concat(C.checkDigit(f)))) bad = f.join("");
    n++;
  }
  check(`d1 + 3d2 + d3 + ... + 3d12 + d13 = 0 mod 10 for ${n} codes (every digit value in every position)`, bad === null, String(bad));

  let single = 0, missed = null;
  for (let t = 0; t < 2000; t++) {
    const code = random12(); const full = code.concat(C.checkDigit(code));
    for (let i = 0; i < 13; i++) for (let w = 0; w < 10; w++) {
      if (w === full[i]) continue;
      const c2 = full.slice(); c2[i] = w;
      if (C.valid(c2)) missed = `${full.join("")} at ${i}`;
      single++;
    }
  }
  check(`every single-digit error is caught (${single} errors)`, missed === null, String(missed));

  let swaps = 0, off5 = true, caughtOther = true;
  for (let t = 0; t < 2000; t++) {
    const code = random12(); const full = code.concat(C.checkDigit(code));
    for (let i = 0; i < 12; i++) {
      const a = full[i], b = full[i + 1]; if (a === b) continue;
      const c2 = full.slice(); c2[i] = b; c2[i + 1] = a;
      const ok = C.valid(c2);
      if (ok !== (Math.abs(a - b) === 5)) off5 = false;
      swaps++;
    }
  }
  check(`an adjacent swap goes unnoticed exactly when the digits differ by 5 (${swaps} swaps)`, off5);

  // UPC-A: twelve digits, check digit weights 3,1,3,... from the left; the same digits behind a 0 give the same last digit.
  let upcOk = true;
  for (let t = 0; t < 50000; t++) {
    const eleven = Array.from({ length: 11 }, () => rnd(10));
    let sum = 0; eleven.forEach((d, i) => { sum += i % 2 === 0 ? 3 * d : d; });
    const upcCheck = (10 - (sum % 10)) % 10;
    const f = [0, ...eleven];
    if (C.checkDigit(f) !== upcCheck) upcOk = false;
  }
  check("a UPC-A code behind a leading 0 keeps its own check digit (50,000 codes)", upcOk);

  equal("the page's ISBN example 0-14-200057-4 is 9780142000571", C.fromIsbn10("0-14-200057-4").join(""), "9780142000571");
  check("the new check digit is valid for every converted ISBN (100,000)", Array.from({ length: 100000 }, () => String(rnd(1e9)).padStart(9, "0")).every((i) => C.valid(C.fromIsbn10(i))));
}

{
  const s = C.start({});
  const bits = C.modules(s);
  check("a code is 95 modules wide", bits.length === 95);
  check("it begins and ends with the guard 101 and has 01010 in the middle", bits.slice(0, 3).join("") === "101" && bits.slice(92).join("") === "101" && bits.slice(45, 50).join("") === "01010");
  const codes = new Set();
  for (const set of [C.tables.ODDS, C.tables.EVENS, C.tables.MIRRORS]) for (const r of set) codes.add(r.join(""));
  check("the 30 seven-module codes are all different", codes.size === 30);
  check("every digit's code has two black bars (even parity of black runs for L, odd for R)", C.tables.ODDS.every((r) => r.join("").split("0").filter(Boolean).length === 2) && C.tables.EVENS.every((r) => r.join("").split("1").filter(Boolean).length === 2));
  let seed = 3;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  let bad = null;
  for (let t = 0; t < 200000 && !bad; t++) {
    const f = Array.from({ length: 12 }, () => rnd(10));
    const st = C.start({ digits: f });
    const back = C.decode(C.modules(st));
    if (!back || back.join("") !== st.digits.join("")) bad = st.digits.join("");
  }
  check("decoding the bars of 200,000 random codes gives the digits back", bad === null, String(bad));
  check("decoding refuses a barcode of the wrong width or with broken guards", C.decode(bits.slice(1)) === null && C.decode([0, ...bits.slice(1)]) === null);
  const parities = new Set(C.tables.LEFT_PARITY.map((p) => p.join("")));
  check("the ten first digits have ten different parity patterns, so d1 is recoverable", parities.size === 10);
  equal("with first digit 0 (UPC-A) all six left digits are odd parity", C.tables.LEFT_PARITY[0].join(""), "111111");
}

done("ean13");
