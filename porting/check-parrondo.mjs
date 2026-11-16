#!/usr/bin/env node
"use strict";

/*
 * Logic test for parrondo/parrondo-core.js.
 *
 * Checks the applet's throw rules and code parser against a second literal
 * transcription, then Monte-Carlo checks of the page's claims about which
 * games and mixes gain or lose capital (defaults p=0.495, p1=0.095, p2=0.745).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("parrondo/parrondo-core.js", "ParrondoCore");

/* Second transcription of Simple / Complicated Throw and ParrondoCode.Next. */
function refSimple(capital, p, random) {
  return capital + (random() < p ? 1 : -1);
}
function refComplicated(capital, p1, p2, m, random) {
  return capital % m === 0 ? refSimple(capital, p1, random) : refSimple(capital, p2, random);
}
function refNext(code, random) {
  if (code.random) return random() < code.prob ? "A" : "B";
  if (code.i === code.pattern.length) code.i = 0;
  return code.pattern.charAt(code.i++);
}

{
  const defaults = C.clampOptions({});
  equal("default epsilon", defaults.epsilon, 0.005);
  equal("default PA is 0.5 − epsilon", defaults.pA, 0.495);
  equal("default PB1 is 0.1 − epsilon", defaults.pB1, 0.095);
  equal("default PB2 is 0.75 − epsilon", defaults.pB2, 0.745);
  equal("default modulus", defaults.modulus, 3);
  equal("default games", defaults.games, 100);
  equal("default trials", defaults.trials, 500);
  equal("default codes", defaults.codes, "AB ABBAB");
}

{
  const random = rng(7);
  const r2 = rng(7);
  for (let i = 0; i < 200; i++) {
    const p = (i % 100) / 100;
    const cap = (i % 17) - 8;
    equal(`simpleThrow matches applet #${i}`, C.simpleThrow(cap, p, random), refSimple(cap, p, r2));
  }
}

{
  const random = rng(11);
  const r2 = rng(11);
  for (let m = 2; m <= 9; m++) {
    for (let cap = -20; cap <= 20; cap++) {
      equal(
        `complicatedThrow M=${m} capital=${cap}`,
        C.complicatedThrow(cap, 0.095, 0.745, m, random),
        refComplicated(cap, 0.095, 0.745, m, r2),
      );
    }
  }
}

{
  const pattern = C.makeCode({ kind: "pattern", pattern: "ABBAB" });
  const ref = { pattern: "ABBAB", i: 0, random: false, prob: 0.5 };
  const got = [];
  const want = [];
  for (let i = 0; i < 12; i++) {
    got.push(pattern.next());
    want.push(refNext(ref, Math.random));
  }
  equal("periodic ABBAB cycles", got, want);

  const rnd = C.makeCode({ kind: "random", prob: 0.3 });
  const random = rng(99);
  const r2 = rng(99);
  const refR = { random: true, prob: 0.3, pattern: "", i: 0 };
  for (let i = 0; i < 100; i++) {
    equal(`random code Next #${i}`, rnd.next(random), refNext(refR, r2));
  }
}

{
  const parsed = C.parseCodes("AB ABBAB .4 .5");
  equal("parse four tokens", parsed.map((p) => p.kind), ["pattern", "pattern", "random", "random"]);
  equal("parse AB", parsed[0].pattern, "AB");
  equal("parse ABBAB", parsed[1].pattern, "ABBAB");
  equal("parse .4", parsed[2].prob, 0.4);
  equal("parse .5", parsed[3].prob, 0.5);

  const capped = C.parseCodes("A B AB BA AABB ABAB ABBA EXTRA");
  equal("at most 7 combination codes", capped.length, 7);

  const bad = C.parseCodes("@@@");
  equal("bad token falls back to ABBAABBABB", bad[0].pattern, C.FALLBACK_PATTERN);
}

{
  equal("epsilon scroll 5 → 0.005", C.SCROLL.epsilon.toValue(5), 0.005);
  equal("P scroll 50 → 0.5", C.SCROLL.pA.toValue(50), 0.5);
  equal("games scroll 10 → 100", C.SCROLL.games.toValue(10), 100);
  equal("trials scroll 5 → 500", C.SCROLL.trials.toValue(5), 500);
  equal("modulus scroll passes through", C.SCROLL.modulus.toValue(3), 3);
}

/* Page claims, checked by Monte Carlo with a fixed seed. */
function finalOf(name, result) {
  const row = result.series.find((s) => s.name === name);
  return row ? row.finalAverage : null;
}

{
  // Defaults from the page / constructor: A and B lose for M = 2, 3; B wins for M > 3.
  const base = { pA: 0.495, pB1: 0.095, pB2: 0.745, games: 80, trials: 4000, codes: "AB ABBAB" };
  for (const m of [2, 3]) {
    const r = C.simulate({ ...base, modulus: m }, rng(100 + m));
    check(`A loses for M=${m}`, finalOf("A", r) < 0, `final ${finalOf("A", r)}`);
    check(`B loses for M=${m}`, finalOf("B", r) < 0, `final ${finalOf("B", r)}`);
  }
  for (const m of [4, 5, 6]) {
    const r = C.simulate({ ...base, modulus: m, codes: "AB" }, rng(200 + m));
    check(`B wins for M=${m} (>3)`, finalOf("B", r) > 0, `final ${finalOf("B", r)}`);
  }
}

{
  // "ABBAB is by far the best for M=3; AB is unsurpassed for M=2 and M=4."
  const m3 = C.simulate(
    { pA: 0.495, pB1: 0.095, pB2: 0.745, modulus: 3, games: 100, trials: 5000, codes: "AB ABBAB" },
    rng(303),
  );
  check("for M=3, ABBAB beats AB", finalOf("ABBAB", m3) > finalOf("AB", m3),
    `ABBAB=${finalOf("ABBAB", m3)} AB=${finalOf("AB", m3)}`);
  check("for M=3, ABBAB beats A and B", finalOf("ABBAB", m3) > finalOf("A", m3) && finalOf("ABBAB", m3) > finalOf("B", m3));

  const m2 = C.simulate(
    { pA: 0.495, pB1: 0.095, pB2: 0.745, modulus: 2, games: 100, trials: 5000, codes: "AB ABBAB" },
    rng(202),
  );
  check("for M=2, AB beats ABBAB", finalOf("AB", m2) > finalOf("ABBAB", m2),
    `AB=${finalOf("AB", m2)} ABBAB=${finalOf("ABBAB", m2)}`);

  const m4 = C.simulate(
    { pA: 0.495, pB1: 0.095, pB2: 0.745, modulus: 4, games: 100, trials: 5000, codes: "AB ABBAB" },
    rng(404),
  );
  check("for M=4, AB beats ABBAB", finalOf("AB", m4) > finalOf("ABBAB", m4),
    `AB=${finalOf("AB", m4)} ABBAB=${finalOf("ABBAB", m4)}`);
}

{
  const first = C.simulate(
    { pA: 0.495, pB1: 0.095, pB2: 0.745, modulus: 3, games: 40, trials: 200, codes: "AB" },
    rng(1),
  );
  const more = C.continueSimulate(first, 200, rng(2));
  equal("continueSimulate adds trials", more.trials, 400);
  check("continued series still length games", more.series[0].averages.length === 40);
}

done("parrondo");
