#!/usr/bin/env node
"use strict";

/*
 * Logic test for upc/upc-core.js.
 *
 *   node porting/check-upc.mjs
 *
 * The applet opens on 0 1 2 3 4 5 6 7 8 9 0 with the last digit filled in by
 * FixCheckDigit. A click on the left half of digits 1..11 raises it by one,
 * the right half lowers it by one, both wrapping mod 10.
 *
 * The page claims 3d1 + d2 + 3d3 + ... + 3d11 + d12 = 0 (mod 10), i.e.
 * 3*S_odd + S_even = 0 (mod 10) with the check digit included. A second,
 * literal transcription of the applet's FixCheckDigit is compared with the
 * core over 330,000 systematic prefixes (every value in every one of the 11
 * positions, 3000 random completions each) and over every single-digit
 * change from 100 further seeds. Each generated full code is checked against
 * the page's formula as well. Single-digit errors are tried exhaustively over
 * 1000 valid codes; adjacent transpositions are checked against the exact
 * condition (invisible only when the digits differ by 5, or are equal). The
 * 95 barcode modules and their round trip through a decoder are checked too.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("upc/upc-core.js", "UpcCore");

/* ------------------------------------------- 1. the opening position and moves */

{
  const s = C.start({});
  equal("the applet opens on 01234567890 plus its check digit", s.digits.join(""), "012345678905");
  check("the opening code satisfies 3*S_odd + S_even = 0 (mod 10)", C.valid(s.digits) && (3 * C.sums(s.digits).odd + C.sums(s.digits).even + s.digits[11]) % 10 === 0);
  equal("S_odd = 20, S_even = 25 before the check digit", [C.sums(s.digits).odd, C.sums(s.digits).even], [20, 25]);
  check("a fresh demonstration has not been explored yet", C.result(s) === null);
  const up = C.move(s, { type: "step", i: 0, delta: 1 });
  equal("a click on the left half raises the first digit by one", up.digits[0], 1);
  check("raising a digit recomputes the check digit and keeps the code valid", up.digits[11] !== s.digits[11] && C.valid(up.digits));
  const down = C.move(s, { type: "step", i: 0, delta: -1 });
  equal("a click on the right half wraps 0 down to 9", down.digits[0], 9);
  check("the lowered digit keeps the code valid", C.valid(down.digits) && down.digits[11] === 8);
  const set = C.move(s, { type: "set", i: 6, value: 7 });
  check("typing a digit sets it and repairs the check digit", set.digits[6] === 7 && C.valid(set.digits) && set.digits.join("") !== s.digits.join(""));
  check("the check digit itself cannot be clicked or set", C.move(s, { type: "step", i: 11 }) === null && C.move(s, { type: "set", i: 11, value: 3 }) === null);
  check("a position outside 0..10 or a bad value is refused", C.move(s, { type: "step", i: -1 }) === null && C.move(s, { type: "step", i: 12 }) === null && C.move(s, { type: "set", i: 0, value: "x" }) === null && C.move(s, { type: "set", i: 0, value: 10 }) === null);
  check("an unknown move is refused", C.move(s, null) === null && C.move(s, { type: "nope", i: 0 }) === null);
  check("the old position is untouched by a move", s.digits.join("") === "012345678905" && s.moves === 0 && s.changed === false);
  check("a changed code counts as explored, with no win or loss", C.result(up) === "done" && C.result(set) === "done");
  const reset = C.move(up, { type: "reset" });
  check("Reset gives the opening code back, unexplored", reset.digits.join("") === s.digits.join("") && C.result(reset) === null);
  check("there are 22 legal moves: raise and lower each of 11 digits", C.legalMoves().length === 22 && C.legalMoves().every((m) => C.move(s, m) !== null));
}

/* ------------------------------- 2. the page's formula against the applet's method */

{
  // Applet's FixCheckDigit, transcribed again from the bytecode, independently.
  function appletFixCheckDigit(first11) {
    let sum = 0;
    // Nums.size() is 12 in the applet, so the loop covers indices 0..10.
    for (let i = 0; i < 11; i++) {
      if (i % 2 === 0) sum += 3 * first11[i];
      else sum += first11[i];
    }
    return (10 - (sum % 10)) % 10;
  }

  let seed = 2026;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  const randomPrefix = () => Array.from({ length: 11 }, () => rnd(10));

  let n = 0, mismatch = null, badFormula = null;
  for (let pos = 0; pos < 11; pos++) for (let v = 0; v < 10; v++) for (let t = 0; t < 3000; t++) {
    const prefix = randomPrefix();
    prefix[pos] = v;
    const check = C.checkDigit(prefix);
    if (check !== appletFixCheckDigit(prefix)) mismatch = prefix.join("");
    const code = prefix.concat(check);
    const s = C.sums(code);
    if (!C.valid(code) || (3 * s.odd + s.even + code[11]) % 10 !== 0) badFormula = code.join("");
    n++;
  }
  check(`the core matches the applet's FixCheckDigit on ${n} prefixes (every value in every position)`, mismatch === null, String(mismatch));
  check(`3*S_odd + S_even + d12 = 0 (mod 10) on all ${n} generated codes`, badFormula === null, String(badFormula));

  let changed = 0, changedMismatch = null;
  for (let t = 0; t < 100; t++) {
    const seedPrefix = randomPrefix();
    for (let i = 0; i < 11; i++) for (let v = 0; v < 10; v++) {
      const prefix = seedPrefix.slice();
      prefix[i] = v;
      if (C.checkDigit(prefix) !== appletFixCheckDigit(prefix)) changedMismatch = prefix.join("");
      changed++;
    }
  }
  check(`every single-digit change from 100 seed prefixes agrees with the applet (${changed} changes)`, changedMismatch === null, String(changedMismatch));

  let unique = true;
  for (let t = 0; t < 1000; t++) {
    const prefix = randomPrefix();
    const good = C.checkDigit(prefix);
    let count = 0;
    for (let d = 0; d < 10; d++) {
      const total = 3 * C.sums(prefix).odd + C.sums(prefix).even + d;
      if (total % 10 === 0) count++;
    }
    if (count !== 1 || C.valid(prefix.concat(good)) === false) unique = false;
  }
  check("the check digit is the unique digit 0..9 that makes the identity true (1000 prefixes)", unique);

  let errors = 0, missed = null;
  for (let t = 0; t < 1000; t++) {
    const code = C.complete(randomPrefix());
    for (let i = 0; i < 12; i++) for (let w = 0; w < 10; w++) {
      if (w === code[i]) continue;
      const wrong = code.slice();
      wrong[i] = w;
      if (C.valid(wrong)) missed = `${code.join("")} at ${i} -> ${w}`;
      errors++;
    }
  }
  check(`every single wrong digit is caught (${errors} errors over 1000 codes)`, missed === null, String(missed));

  let swaps = 0, swapRule = true;
  for (let t = 0; t < 1000; t++) {
    const code = C.complete(randomPrefix());
    for (let i = 0; i < 10; i++) {
      const a = code[i], b = code[i + 1];
      const swapped = code.slice();
      swapped[i] = b; swapped[i + 1] = a;
      const ok = C.valid(swapped);
      if (ok !== (a === b || Math.abs(a - b) === 5)) swapRule = false;
      swaps++;
    }
  }
  check(`adjacent swaps are caught except equal digits or digits differing by 5 (${swaps} swaps)`, swapRule);
}

/* ------------------------------------------------------------ 3. the barcode */

{
  const bits = C.modules(C.start({}));
  check("a UPC-A code is 95 modules wide", bits.length === 95);
  check("it has the 101 start guard, 01010 middle guard and 101 end guard", bits.slice(0, 3).join("") === "101" && bits.slice(45, 50).join("") === "01010" && bits.slice(92).join("") === "101");
  const patterns = new Set(C.ODDS.concat(C.EVENS).map((r) => r.join("")));
  check("the 20 left and right seven-module patterns are all different", patterns.size === 20);
  check("right-side patterns are the colour inverses of left-side ones", C.EVENS.every((r, d) => r.every((b, j) => b === 1 - C.ODDS[d][j])));
  check("left digits have two black runs and right digits two white runs", C.ODDS.every((r) => r.join("").split("0").filter(Boolean).length === 2) && C.EVENS.every((r) => r.join("").split("1").filter(Boolean).length === 2));
  check("the decoded opening barcode gives back 012345678905", C.decode(bits).join("") === "012345678905");
  let seed = 99;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  let bad = null;
  for (let t = 0; t < 100000 && !bad; t++) {
    const prefix = Array.from({ length: 11 }, () => rnd(10));
    const state = C.start({ digits: prefix });
    const back = C.decode(C.modules(state));
    if (!back || back.join("") !== state.digits.join("")) bad = state.digits.join("");
  }
  check("decoding the bars of 100,000 random codes gives the digits back", bad === null, String(bad));
  check("decoding refuses a wrong width or broken guards", C.decode(bits.slice(1)) === null && C.decode([0].concat(bits.slice(1))) === null);
}

done("upc");
