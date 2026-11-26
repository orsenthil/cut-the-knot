#!/usr/bin/env node
"use strict";

/*
 * Logic test for arithmetic-circuits/arithmetic-circuits-core.js.
 *
 *   node porting/check-arithmetic-circuits.mjs
 *
 * 1. Polynomial arithmetic: checked against evaluation at random points.
 * 2. Every puzzle's reference circuit computes its target, and the par is
 *    the true minimum: a search of every circuit with one gate fewer
 *    (using +, - and x on the constant 1, the variables and earlier gates)
 *    finds none.
 * 3. The game: gates only on existing wires, a win at par, not above it.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("arithmetic-circuits/arithmetic-circuits-core.js", "ArithmeticCircuitsCore");

const evalAt = (p, pt) => [...p].reduce((s, [k, c]) => s + c * k.split(",").reduce((m, e, i) => m * pt[i] ** Number(e), 1), 0);
{
  let seed = 3, ok = true;
  const r = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 7) - 3;
  for (let k = 0; k < 300; k++) {
    const nv = 3, w = C.inputs(nv);
    for (let g = 0; g < 5; g++) { const op = ["+", "-", "*"][Math.abs(r()) % 3]; w.push(C.apply(op, w[Math.abs(r()) % w.length], w[Math.abs(r()) % w.length])); }
    const pt = [r(), r(), r()];
    const p = w[w.length - 1], q = w[w.length - 2];
    if (evalAt(C.mul(p, q), pt) !== evalAt(p, pt) * evalAt(q, pt) || evalAt(C.add(p, q, -1), pt) !== evalAt(p, pt) - evalAt(q, pt)) ok = false;
  }
  check("polynomial products and differences agree with evaluation at 300 random points", ok);
  equal("formatting: (x + y)²", C.format(C.mul(C.add(C.mono(2, 0), C.mono(2, 1)), C.add(C.mono(2, 0), C.mono(2, 1))), ["x", "y"]), "x² + 2xy + y²");
}

for (const P of C.PUZZLES) {
  const k = C.par(P.id);
  const ok = C.result(C.start({ puzzle: P.id, gates: P.ref })) === "win" && C.solvable(P.id, k) && !C.solvable(P.id, k - 1);
  check(`${P.name}: done in ${k} gates, and no circuit with ${k - 1} does it`, ok);
}

{
  let s = C.start({ puzzle: "x4" });
  check("a gate may only use wires that exist", C.addGate(s, "*", 1, 2) === null && C.addGate(s, "/", 1, 1) === null);
  s = C.addGate(s, "*", 1, 1); s = C.addGate(s, "*", 1, 2); s = C.addGate(s, "*", 1, 3);
  check("x·x, then times x, then times x reaches x⁴ in 3 gates: reached, but over par", C.reached(s) === 2 && C.result(s) === null);
  const before = JSON.stringify(s);
  C.undo(s);
  equal("undo leaves the old position alone", JSON.stringify(s), before);
}
done("arithmetic-circuits");
