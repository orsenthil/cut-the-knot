#!/usr/bin/env node
"use strict";

/*
 * Logic test for cleaver/cleaver-core.js.
 *
 *   node porting/check-cleaver.mjs
 *
 * The triangle can be any shape, so the test sweeps: the applet's opening
 * triangle, 5,000 random triangles, and a grid of 2,500 positions for C over
 * a fixed base AB (covering obtuse, right and isosceles cases). At each it
 * checks the page's argument step by step: CL bisects angle C, D lies on the
 * longer side, CF = CT, CL is parallel to TF, D is the midpoint of SF, the
 * perimeter is cut into two equal halves, and the three cleavers meet at the
 * Spieker centre. A second transcription of Compute is compared with the core.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cleaver/cleaver-core.js", "CleaverCore");
const rand = rng(11);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("an illustration is never over", C.result(s) === null);
  equal("A starts at (W/3, H - H/4)", [s.A.x, s.A.y].join(","), "200,338");
  equal("B starts level with A at W - W/3", [s.B.x, s.B.y].join(","), "400,338");
  equal("C starts at (3W/5, 2(H/4))", [s.C.x, s.C.y].join(","), "360,224");
  const m = C.compute(s);
  check("in the opening triangle AC is longer, so D is on AC", m.S === "A" && m.T === "B");
  check("every claim holds on the opening triangle", C.claims(s).all);
  const moved = C.withPoint(s, "C", { x: 220, y: 200 });
  check("withPoint leaves the old position alone", s.C.x === 360);
  check("moving C over A's side puts D on BC", C.compute(moved).S === "B");
  const sh = C.shift(s, 5, -3);
  check("shifting moves all three corners", sh.A.x === 205 && sh.C.y === 221);
  check("a flat triangle is degenerate", C.compute({ A: { x: 0, y: 0 }, B: { x: 100, y: 0 }, C: { x: 50, y: 0 } }).degenerate);
  const off = C.getPerp(s.A, s.B, s.C);
  check("the premise arrows sit 30 pixels below AB, away from C", Math.abs(Math.hypot(off.x, off.y) - 30) < 1e-9 && off.y > 0);
}

/* ------------------------------------------- 2. every case, where it is small */

function tally(label, triangles) {
  const names = ["bisector", "dOnLongerSide", "cfEqualsCT", "clParallelTF", "dMidpointOfSF", "halvesEqual", "cleaversMeetAtSpieker"];
  const bad = Object.fromEntries(names.map((n) => [n, 0]));
  let n = 0;
  for (const s of triangles) {
    if (C.compute(s).degenerate) continue;
    n++;
    const cl = C.claims(s);
    for (const k of names) if (!cl[k]) bad[k]++;
  }
  for (const k of names) check(`${label}: ${k} on all ${n}`, bad[k] === 0, `${bad[k]} fail`);
  return n;
}

{
  const tris = [];
  while (tris.length < 5000) {
    const p = () => ({ x: rand() * 600, y: rand() * 450 });
    const s = { A: p(), B: p(), C: p() };
    const sides = [C.distance(s.A, s.B), C.distance(s.B, s.C), C.distance(s.C, s.A)];
    if (Math.abs(C.cross(s.A, s.B, s.C)) > 2000 && Math.min(...sides) > 20) tris.push(s);
  }
  const n = tally("random", tris);
  check("random sweep is large", n === 5000);
}

{
  const tris = [];
  for (let i = 0; i < 50; i++) for (let j = 0; j < 50; j++) {
    tris.push({ A: { x: 200, y: 338 }, B: { x: 400, y: 338 }, C: { x: 10 + i * 11.6, y: 10 + j * 6.4 } });
  }
  tally("grid of C", tris);
}

{
  // Isosceles: AC = BC, the cleaver runs along CL and D lands on C.
  const s = { A: { x: 200, y: 338 }, B: { x: 400, y: 338 }, C: { x: 300, y: 150 } };
  const m = C.compute(s);
  check("isosceles: D is C itself", C.distance(m.D, s.C) < 1e-9);
}

/* ----------------------------- 3. the same answers as the applet's own method */

{
  // Compute, again: L from the angle bisector via the incentre ratio AL/LB = CA/CB,
  // D as the point of SC at distance |SF|/2 from S, F = S + (SC+CT)/SC (C-S).
  let same = 0, differ = 0;
  for (let t = 0; t < 2000; t++) {
    const p = () => ({ x: rand() * 600, y: rand() * 450 });
    const s = { A: p(), B: p(), C: p() };
    if (Math.abs(C.cross(s.A, s.B, s.C)) < 2000) continue;
    const m = C.compute(s);
    const ca = C.distance(s.C, s.A), cb = C.distance(s.C, s.B);
    const L = { x: (cb * s.A.x + ca * s.B.x) / (ca + cb), y: (cb * s.A.y + ca * s.B.y) / (ca + cb) };
    const [S, T] = ca > cb ? [s.A, s.B] : [s.B, s.A];
    const sc = C.distance(S, s.C), tc = C.distance(T, s.C);
    const F = { x: S.x + (sc + tc) / sc * (s.C.x - S.x), y: S.y + (sc + tc) / sc * (s.C.y - S.y) };
    const D = { x: (S.x + F.x) / 2, y: (S.y + F.y) / 2 };
    const ok = C.distance(L, m.L) < 1e-6 && C.distance(F, m.F) < 1e-9 && C.distance(D, m.D) < 1e-6;
    if (ok) same++; else differ++;
  }
  check(`a second construction agrees on ${same} triangles`, differ === 0, `${differ} differ`);
}

done("cleaver");
