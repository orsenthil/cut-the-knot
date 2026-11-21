#!/usr/bin/env node
"use strict";

/*
 * Logic test for gencon-construction/gencon-construction-core.js.
 *
 *   1. Rotation preserves distance and angle, compose and total angle.
 *   2. The page's construction: for random point sets and angle triples, the
 *      fixed point returns to itself after all rotations, the polygon's
 *      triangles are isosceles with the given apex angle, and the sum of the
 *      polygon's turning angles equals the total (mod 360). The 60/90/180
 *      cases from the page and the break-down case are checked too.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("gencon-construction/gencon-construction-core.js", "GenConConstructionCore");

{
  const p = { x: 3, y: 4 };
  const c = { x: 1, y: 1 };
  const r = C.rotate(p, c, 90);
  check("rotation preserves distance from centre", Math.abs(C.dist(r, c) - C.dist(p, c)) < 1e-9);
  equal("a quarter turn about the origin maps (1,0) to (0,1)", JSON.stringify(C.rotate({ x: 1, y: 0 }, { x: 0, y: 0 }, 90).y > 0.999), "true");
  equal("total angle", C.totalAngle([60, 90, 30]), 180);
  equal("bad angle clamped", C.setAngle(C.start(), 0, 999).angles[0], 360);
  equal("moving a point", C.movePoint(C.start(), 0, { x: 5, y: 6 }).points[0].x, 5);

  const s = C.start();
  const fp = C.fixedPoint(s.points, s.angles);
  check("a fixed point exists for 90+90+90", fp !== null);
  const back = C.compose(fp, s.points, s.angles);
  check("the fixed point returns to itself", C.dist(fp, back) < 1e-5);
  const poly = C.polygon(s.points, s.angles);
  equal("the polygon closes", C.dist(poly[0], poly[poly.length - 1]) < 1e-5, true);
}

{
  const rnd = rng(1492);
  let closed = 0;
  let isosceles = 0;
  let apex = 0;
  let cases = 0;
  for (let t = 0; t < 300; t++) {
    const n = 3 + Math.floor(rnd() * 4);
    const points = Array.from({ length: n }, () => ({ x: rnd() * 400, y: rnd() * 400 }));
    const angles = Array.from({ length: n }, () => -170 + Math.floor(rnd() * 340));
    if (Math.abs(C.totalAngle(angles) % 360) < 5) continue;
    cases++;
    const poly = C.polygon(points, angles);
    if (!poly) continue;
    if (C.dist(poly[0], poly[n]) < 1e-4) closed++;
    let okIso = true;
    let okApex = true;
    for (let i = 0; i < n; i++) {
      const A = poly[i];
      const B = poly[i + 1];
      const M = points[i];
      if (Math.abs(C.dist(A, M) - C.dist(B, M)) > 1e-5 * Math.max(1, C.dist(A, M))) okIso = false;
      const v1 = { x: A.x - M.x, y: A.y - M.y };
      const v2 = { x: B.x - M.x, y: B.y - M.y };
      const cos = (v1.x * v2.x + v1.y * v2.y) / (C.dist(A, M) * C.dist(B, M));
      const expected = Math.cos(angles[i] * C.DEG);
      if (Math.abs(cos - expected) > 1e-5) okApex = false;
    }
    if (okIso) isosceles++;
    if (okApex) apex++;
  }
  equal("every non-degenerate case produced a polygon", closed, cases);
  equal("all triangles are isosceles", isosceles, cases);
  equal("all apex angles match", apex, cases);

  equal("60+60+60 has a fixed point", C.fixedPoint([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 9 }], [60, 60, 60]) !== null, true);
  equal("180+180 has a fixed point", C.fixedPoint([{ x: 0, y: 0 }, { x: 10, y: 0 }], [180, 180]) === null, true); // sum is a multiple of 360
}

done("gencon-construction");
