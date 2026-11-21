#!/usr/bin/env node
"use strict";

/*
 * Logic test for isbn-encoding/isbn-encoding-core.js.
 *
 *   1. Cycling, the mod-11 check digit (including the X case) and the
 *      page's three hyphen rules.
 *   2. Known ISBN-10s validate; a single changed digit invalidates one.
 *   3. EAN-13 embedding: a fresh check digit, a 95-module bar pattern and
 *      agreement with the independent ean13 port's check digit and decoder.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("isbn-encoding/isbn-encoding-core.js", "IsbnEncodingCore");
const Ean = loadCore("ean13/ean13-core.js", "Ean13Core");

{
  equal("cycle wraps to dash", C.cycle("9"), "-");
  equal("cycle wraps to zero", C.cycle("-"), "0");
  equal("check digit for 0..8", C.checkDigit([0, 1, 2, 3, 4, 5, 6, 7, 8]), "9");
  equal("the X case", C.checkDigit([0, 8, 0, 4, 4, 2, 9, 5, 7]), "X");
  const s = C.start();
  equal("thirteen display cells", s.symbols.length, 13);
  equal("nine digits before the check digit", C.digitsOf(s.symbols).length, 9);
  equal("three hyphens", s.symbols.filter((x) => x === "-").length, 3);
  check("the default format is valid", C.hyphensValid(s.symbols));
  equal("one advance counts a move", C.advance(s, 0).moves, 1);
  equal("the check cell cannot be advanced", C.advance(s, 12), s);
}

{
  const known = [
    { isbn: "0-306-40615-2", symbols: ["0", "-", "3", "0", "6", "-", "4", "0", "6", "1", "5", "-", "2"] },
    { isbn: "0-8044-2957-X", symbols: ["0", "-", "8", "0", "4", "4", "-", "2", "9", "5", "7", "-", "X"] },
    { isbn: "0-19-852663-6", symbols: ["0", "-", "1", "9", "-", "8", "5", "2", "6", "6", "3", "-", "6"] },
  ];
  for (const { isbn, symbols } of known) {
    const r = C.analyze(C.start(symbols));
    check(`${isbn} has a valid format`, r.formatValid);
    check(`${isbn} validates`, r.valid);
    check(`${isbn} has the right check digit`, r.checkDigit === symbols[12]);
    const changed = symbols.slice();
    changed[0] = String((Number(changed[0]) + 1) % 10);
    check("changing a digit breaks the check", !C.analyze(C.start(changed)).sumValid);
  }
  const consecutive = C.start(["0", "-", "-", "1", "2", "3", "4", "5", "6", "7", "8", "-", "?"]);
  check("consecutive hyphens are rejected", !C.hyphensValid(consecutive.symbols));
  const wrongPlace = C.start(["0", "-", "1", "2", "3", "-", "4", "5", "6", "7", "8", "9", "?"]);
  check("a hyphen before the check digit is required", !C.hyphensValid(wrongPlace.symbols));
}

{
  const digits = [0, 3, 0, 6, 4, 0, 6, 1, 5];
  const r = C.analyze(C.fromDigits(digits));
  equal("the EAN-13 starts with 978", r.ean.slice(0, 3).join(""), "978");
  equal("the EAN-13 has 13 digits", r.ean.length, 13);
  check("the EAN-13 check digit is valid", Ean.valid(r.ean));
  equal("the check digits agree", r.ean[12], Ean.checkDigit(r.ean.slice(0, 12)));
  equal("a book barcode has 95 modules", r.modules.length, 95);
  check("the modules are bits", r.modules.every((b) => b === 0 || b === 1));
  check("the bars start and end with a guard", r.modules[0] === 1 && r.modules[2] === 1 && r.modules[92] === 1);
  const decoded = Ean.decode(r.modules);
  equal("the bars decode to the EAN-13", decoded ? decoded.join("") : "", r.ean.join(""));
}

done("isbn-encoding");
