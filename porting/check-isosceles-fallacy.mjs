#!/usr/bin/env node
"use strict";

/*
 * Logic test for isosceles-fallacy/isosceles-fallacy-core.js.
 *
 *   1. The construction on the starting triangle: bisector, perpendicular
 *      bisector, circumcircle, feet of perpendiculars and the two modes.
 *   2. The page's claim on hundreds of random acute triangles: with the honest
 *      drawing P lies on the circumcircle and exactly one foot falls outside
 *      its side; with the misleading drawing both feet fall inside. The
 *      congruent pairs AP=BP, CU=CV, PU=PV and the unequal AC!=BC are checked.
 *   3. Independent coordinate checks of the intersection and foot formulas.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("isosceles-fallacy/isosceles-fallacy-core.js", "IsoscelesFallacyCore");

/* ------------------------------------------------------------ 1. the setup */

{
  const s = C.start();
  equal("the triangle has three vertices", [s.A, s.B, s.C].length, 3);
  equal("the default mode is the misleading drawing", s.mode, "faulty");
  const g = C.geometry(s);
  check("the construction is drawable", g.drawable);
  check("P lies inside in the fake drawing", g.P.y > s.C.y && g.P.y < s.A.y);
  check("the fake drawing puts both feet on the sides", g.uOnSide && g.vOnSide);
  check("the sides really are unequal", Math.abs(g.ac - g.bc) > 1);
  const right = C.geometry(C.setMode(s, "right"));
  check("the honest drawing puts P on the circumcircle", right.pOnCircle);
  check("exactly one foot leaves its side", right.uOnSide !== right.vOnSide);
  equal("bad modes fall back to faulty", C.setMode(s, "odd").mode, "faulty");
  check("moving a vertex changes the geometry", C.moveVertex(s, "C", { x: 100, y: 50 }).C.x === 100);
}

/* ------------------------------------- 2. the claims, on many triangles */

{
  const rnd = rng(1492);
  let acute = 0;
  let circle = 0;
  let oneOutside = 0;
  let fakeInside = 0;
  let congruent = 0;
  let unequal = 0;
  for (let t = 0; t < 500; t++) {
    const A = { x: 60 + rnd() * 80, y: 230 + rnd() * 40 };
    const B = { x: 280 + rnd() * 80, y: 230 + rnd() * 40 };
    const Cc = { x: 140 + rnd() * 140, y: 40 + rnd() * 80 };
    const base = { ...C.start(), A, B, C: Cc };
    const a = C.dist(B, Cc);
    const b = C.dist(A, Cc);
    const c = C.dist(A, B);
    if (a * a + b * b <= c * c || a * a + c * c <= b * b || b * b + c * c <= a * a) continue;
    if (Math.abs(a - b) < 8) continue; // skip nearly isosceles drawings
    acute++;

    const right = C.geometry(C.setMode(base, "right"));
    if (right.pOnCircle) circle++;
    if (right.uOnSide !== right.vOnSide) oneOutside++;
    const fake = C.geometry(base);
    if (fake.uOnSide && fake.vOnSide) fakeInside++;
    const near = (x, y) => Math.abs(x - y) < 1e-6 * Math.max(1, x, y);
    if (near(right.ap, right.bp) && near(right.cu, right.cv) && near(right.pu, right.pv)) congruent++;
    if (right.ac - right.bc > 8 || right.bc - right.ac > 8) unequal++;
  }
  check("enough acute scalene triangles were found", acute > 300, `${acute}`);
  equal("P is always on the circumcircle in the honest drawing", circle, acute);
  equal("exactly one perpendicular foot leaves its side", oneOutside, acute);
  equal("the fake drawing keeps both feet on the sides", fakeInside, acute);
  equal("the congruent pairs really are congruent", congruent, acute);
  equal("the two sides really are unequal", unequal, acute);
}

/* --------------------------- 3. independent coordinate formulas */

{
  const p = { x: 3, y: 4 };
  const d = { x: 1, y: 2 };
  const q = { x: 0, y: 1 };
  const e = { x: 2, y: -1 };
  const hit = C.intersect(p, d, q, e);
  check("lines intersect where solving by hand says", Math.abs(hit.x - 1.2) < 1e-9 && Math.abs(hit.y - 0.4) < 1e-9);

  const A = { x: 0, y: 0 };
  const B = { x: 10, y: 0 };
  const point = { x: 4, y: 7 };
  const f = C.foot(point, A, B);
  check("a perpendicular foot lands directly below the point", f.x === 4 && f.y === 0);
  check("that foot is on the segment", C.onSegment(f, A, B));
  const outside = C.foot({ x: 14, y: 5 }, A, B);
  check("a foot beyond the end is not on the segment", !C.onSegment(outside, A, B));

  const O = C.circumcenter({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 });
  check("circumcenter of a right triangle is the midpoint of its hypotenuse",
    Math.abs(O.x - 2) < 1e-9 && Math.abs(O.y - 1.5) < 1e-9);
}

done("isosceles-fallacy");
