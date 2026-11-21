#!/usr/bin/env node
"use strict";

/*
 * Logic test for langford-skolem/langford-skolem-core.js.
 *
 *   1. The page's classic strings 41312432 and 42324311 and the hooked
 *      examples 121*2 and 112*2.
 *   2. Existence congruences for n = 1..12 and validity of every solution the
 *      backtracker returns (pairs and triples, several defects and holes).
 *   3. Encoding/decoding and the controls.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("langford-skolem/langford-skolem-core.js", "LangfordSkolemCore");

{
  const langford4 = C.decode("41312432");
  equal("page's Langford length", langford4.length, 8);
  equal("page's Langford is valid", C.validate(langford4, { N: 4, D: 1, M: 2, H: 0, kind: "langford" }).valid, true);
  const skolem4 = C.decode("42324311");
  equal("page's Skolem is valid", C.validate(skolem4, { N: 4, D: 1, M: 2, H: 0, kind: "skolem" }).valid, true);
  equal("encoding round-trips", C.encode(C.decode("41312432")), "41312432");

  const hookedLangford = C.decode("121*2");
  equal("hooked Langford is valid", C.validate(hookedLangford, { N: 2, D: 1, M: 2, H: 1, kind: "langford" }).valid, true);
  const hookedSkolem = C.decode("112*2");
  equal("hooked Skolem is valid", C.validate(hookedSkolem, { N: 2, D: 1, M: 2, H: 1, kind: "skolem" }).valid, true);
  equal("wrong spacing is caught", C.validate([4, 1, 3, 1, 2, 4, 3, 2], { N: 4, D: 1, M: 2, H: 0, kind: "skolem" }).valid, false);
}

{
  for (let n = 1; n <= 12; n++) {
    const l = C.solve({ N: n, D: 1, M: 2, H: 0, kind: "langford" });
    const s = C.solve({ N: n, D: 1, M: 2, H: 0, kind: "skolem" });
    equal(`Langford ${n} existence matches congruence`, l.sequence !== null, C.exists(n, "langford"));
    equal(`Skolem ${n} existence matches congruence`, s.sequence !== null, C.exists(n, "skolem"));
    if (l.sequence) check(`Langford ${n} solution is valid`, C.validate(l.sequence, l.params).valid);
    if (s.sequence) check(`Skolem ${n} solution is valid`, C.validate(s.sequence, s.params).valid);
  }
}

{
  let cases = 0;
  let valid = 0;
  for (const kind of ["langford", "skolem"]) {
    for (const D of [1, 2, 3]) {
      for (const N of [D, D + 1, D + 2, D + 3]) {
        for (const M of [2, 3]) {
          for (const H of [0, 1]) {
            const r = C.solve({ N, D, M, H, kind });
            if (!r.sequence) continue;
            cases++;
            if (C.validate(r.sequence, r.params).valid) valid++;
          }
        }
      }
    }
  }
  check("some generalized cases solve", cases > 10, `${cases}`);
  equal("all generalized solutions are valid", valid, cases);

  const state = C.start();
  equal("default N", state.N, 4);
  equal("N clamped", C.setParam(state, "N", 99).N, 12);
  equal("D clamped to N", C.setParam(state, "D", 99).D, 4);
  equal("M restricted to 2 or 3", C.setParam(state, "M", 7).M, 2);
  equal("H clamped", C.setParam(state, "H", 9).H, 2);
  const defaultResult = C.analyze(state);
  check("the default is solvable and valid", defaultResult.solution !== null && defaultResult.validation.valid);
}

done("langford-skolem");
