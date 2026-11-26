#!/usr/bin/env node
"use strict";

/*
 * Logic test for pyth-triple-calculator/pyth-triple-calculator-core.js.
 *
 *   node porting/check-pyth-triple-calculator.mjs
 *
 * 1. The options and the applet's N > M fix-ups, for every N, M up to 60 and
 *    every new value of either.
 * 2. The formulas against a transcription of the applet's Reset, for every
 *    N, M <= 100 and k <= 5, and a^2 + b^2 = c^2 for all of them.
 * 3. The claims: primitive exactly when k = 1, gcd(N, M) = 1 and N - M odd;
 *    and every Pythagorean triple with c <= 1000 comes from the formulas.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("pyth-triple-calculator/pyth-triple-calculator-core.js", "PythTripleCalculatorCore");

/* ------------------------------------------------------ 1. options and fix-ups */

{
  const s = C.start({});
  equal("the applet starts at N = 2, M = 1, k = 1, giving 3, 4, 5", [s.n, s.m, s.k, C.triple(s).a, C.triple(s).b, C.triple(s).c], [2, 1, 1, 3, 4, 5]);
  check("values are kept in 1..1000", C.set(s, "k", 0).k === 1 && C.set(s, "k", 5000).k === 1000);
  const applet = (st, which, v) => {
    const o = { ...st };
    if (which === "n") { if (o.m >= v && v > 1) o.m = v - 1; o.n = v; }
    if (which === "m") { if (v >= o.n) o.n = v + 1; o.m = v; }
    return o;
  };
  let edits = 0, same = 0;
  for (let n = 1; n <= 60; n++) for (let m = 1; m <= 60; m++) for (const which of ["n", "m"]) for (let v = 1; v <= 60; v++) {
    edits++;
    const st = { n, m, k: 1, showLengths: true };
    if (JSON.stringify(C.set(st, which, v)) === JSON.stringify(applet(st, which, v))) same++;
  }
  check(`every N and M edit matches the applet (${edits} edits)`, same === edits);
  check("N = M gives no triangle", C.triple({ n: 1, m: 1, k: 1 }) === null);
  equal("N = 1, M = 2: the applet swaps the legs, 4, 3, 5", [C.triple({ n: 1, m: 2, k: 1 }).a, C.triple({ n: 1, m: 2, k: 1 }).b], [4, 3]);
}

/* ----------------------------------------- 2. the formulas against the applet */

{
  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  let cases = 0, same = 0, pyth = 0;
  for (let N = 1; N <= 100; N++) for (let M = 1; M <= 100; M++) for (let K = 1; K <= 5; K++) {
    if (N === M) continue;
    cases++;
    const KH = K * (N > M ? N * N - M * M : 2 * N * M);
    const KV = K * (N > M ? 2 * N * M : M * M - N * N);
    const KZ = K * (N * N + M * M);
    const g = gcd(KH, KV);
    let Primitive = true;
    if (g > 1 && Math.trunc(KZ / g) * g === KZ) Primitive = false;
    const t = C.triple({ n: N, m: M, k: K });
    if (t.a === KH && t.b === KV && t.c === KZ && t.primitive === Primitive) same++;
    if (t.a * t.a + t.b * t.b === t.c * t.c) pyth++;
  }
  check(`the triple and "Primitive" match the applet's Reset in ${cases} cases`, same === cases);
  check("a² + b² = c² every time", pyth === cases);
}

/* ------------------------------------------------------------- 3. the claims */

{
  let rule = true;
  for (let N = 2; N <= 100; N++) for (let M = 1; M < N; M++) for (let K = 1; K <= 3; K++) {
    const want = K === 1 && C.gcd(N, M) === 1 && (N - M) % 2 === 1;
    if (C.triple({ n: N, m: M, k: K }).primitive !== want) rule = false;
  }
  check("primitive exactly when k = 1, gcd(N, M) = 1 and N - M is odd", rule);

  // Every triple a < b < c <= 1000 is made by some N > M >= 1, k >= 1 (legs in either order).
  const made = new Set();
  for (let N = 2; N * N + 1 <= 1000; N++) for (let M = 1; M < N && N * N + M * M <= 1000; M++)
    for (let K = 1; K * (N * N + M * M) <= 1000; K++) {
      const t = C.triple({ n: N, m: M, k: K });
      made.add(`${Math.min(t.a, t.b)},${Math.max(t.a, t.b)},${t.c}`);
    }
  let all = 0, found = 0;
  for (let c = 1; c <= 1000; c++) for (let a = 1; a * a * 2 < c * c; a++) {
    const b = Math.round(Math.sqrt(c * c - a * a));
    if (b * b + a * a === c * c) { all++; if (made.has(`${a},${b},${c}`)) found++; }
  }
  check(`all ${all} Pythagorean triples with c <= 1000 come from the formulas`, found === all && all > 0);
  let primitives = 0;
  for (let c = 1; c <= 100; c++) for (let a = 1; 2 * a * a < c * c; a++) {
    const b = Math.round(Math.sqrt(c * c - a * a));
    if (b * b + a * a === c * c && C.gcd(a, b) === 1) primitives++;
  }
  check("there are 16 primitive triples with c <= 100", primitives === 16);
}

done("pyth-triple-calculator");
