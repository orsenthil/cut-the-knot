#!/usr/bin/env node
"use strict";

/*
 * Logic test for hilbert-curve/hilbert-curve-core.js.
 *
 *   1. The d-to-xy mapping for order 1 and 2 against the known staple shapes.
 *   2. For every order 1..6: 4^n points, every grid cell visited exactly once,
 *      all coordinates within the square, and consecutive points are adjacent
 *      (Hilbert step of one cell). The Moore variant closes the loop.
 *   3. The order-1 staple shape and the Moore closing point.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("hilbert-curve/hilbert-curve-core.js", "HilbertCurveCore");

{
  equal("order clamped low", C.clamp(0, 3), 1);
  equal("order clamped high", C.clamp(99, 3), 7);
  const s = C.start();
  equal("default order", s.order, 3);
  equal("default kind", s.kind, "hilbert");
  equal("order changed", C.setOrder(s, 5).order, 5);
  equal("kind changed", C.setKind(s, "moore").kind, "moore");

  equal("first point", JSON.stringify(C.d2xy(2, 0)), JSON.stringify({ x: 0, y: 0 }));
  equal("order-2 curve has 16 points", C.points(2, "hilbert").length, 16);
}

{
  let counts = 0;
  let unique = 0;
  let inSquare = 0;
  let adjacent = 0;
  for (let order = 1; order <= 6; order++) {
    const pts = C.points(order, "hilbert");
    const size = 2 ** order;
    if (pts.length === 4 ** order) counts++;
    if (new Set(pts.map((p) => `${p.x},${p.y}`)).size === pts.length) unique++;
    if (pts.every((p) => p.x >= 0 && p.x < size && p.y >= 0 && p.y < size)) inSquare++;
    let ok = true;
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y) !== 1) ok = false;
    }
    if (ok) adjacent++;
  }
  equal("all orders checked", counts, 6);
  equal("every cell visited once", unique, 6);
  equal("the curve stays in the square", inSquare, 6);
  equal("consecutive points are neighbours", adjacent, 6);
  equal("order-1 staple shape", JSON.stringify(C.points(1, "hilbert")), JSON.stringify([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }]));

  const moore = C.points(3, "moore");
  equal("Moore curve has one closing point", moore.length, C.points(3, "hilbert").length + 1);
  equal("Moore curve closes its loop", JSON.stringify(moore[0]) === JSON.stringify({ x: moore[moore.length - 1].x, y: moore[moore.length - 1].y }), true);
}

done("hilbert-curve");
