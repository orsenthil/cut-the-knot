#!/usr/bin/env node
"use strict";

/*
 * Logic test for leibniz-triangle/leibniz-triangle-core.js.
 *
 *   1. Binomial coefficients, Pascal row sums and the modulus operation.
 *   2. Leibniz denominators match the page's examples and the subtraction
 *      construction; both triangles are symmetric.
 *   3. The telescoping identities 1/2 = 1/3 + 1/12 + ... and the controls.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("leibniz-triangle/leibniz-triangle-core.js", "LeibnizTriangleCore");

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

{
  equal("C(5,2)", C.binomial(5, 2), 10);
  const p = C.pascal(6);
  equal("six rows", p.length, 6);
  equal("row five", p[5].join(","), "1,5,10,10,5,1");
  check("row sums are powers of two", p.every((row, n) => row.reduce((a, b) => a + b, 0) === 2 ** n));
  equal("Pascal modulo 2", C.modulo(p, 2)[3].join(","), "1,1,1,1");
  const d = C.display(5, 3, "pascal");
  check("every shown entry is in range", d.shown.every((row) => row.every((v) => v >= 0 && v < 3)));
}

{
  const l = C.leibnizDenominators(6);
  equal("first row is 1", l[0].join(","), "1");
  equal("second row", l[1].join(","), "2,2");
  equal("fifth row", l[4].join(","), "5,20,30,20,5");
  equal("the page's 1/20 example", l[4][1], 20);
  const sub = C.leibnizBySubtraction(6);
  check("subtraction rebuilds every denominator", sub.every((row, n) => row.every((v, m) => v === l[n][m])));
  check("Leibniz triangle is symmetric", l.every((row) => row.every((v, m) => v === row[row.length - 1 - m])));
  const d = C.display(6, 7, "leibniz");
  equal("mod-7 entry", d.shown[4][1], 20 % 7);
  const thirdDiagonal = C.leibnizDenominators(150).slice(2).map((row) => 1 / row[2]);
  check("the page's identity 1/2 = 1/3 + 1/12 + 1/30 + ...", close(thirdDiagonal.reduce((a, b) => a + b, 0), 0.5, 1e-3));
}

{
  const t = C.telescoping(200);
  check("the second diagonal telescopes to 1", close(t.last, 1, 0.01));
  check("partial sums increase", t.partial.every((v, i) => i === 0 || v > t.partial[i - 1]));
  const s = C.start();
  equal("default rows", s.rows, 8);
  equal("rows clamped", C.setRows(s, 99).rows, 16);
  equal("mod clamped", C.setMod(s, 99).mod, 12);
  equal("kind set", C.setKind(s, "leibniz").kind, "leibniz");
  const r = C.analyze(C.setKind(s, "leibniz"));
  check("analysis reports symmetry", r.symmetric);
}

done("leibniz-triangle");
