#!/usr/bin/env node
"use strict";

/*
 * Logic test for archimedes-circumference/archimedes-circumference-core.js.
 *
 *   1. Bounds, defaults and the classic n = 6 inscribed perimeter.
 *   2. For all n from 3 to 96: inscribed < circumference < circumscribed,
 *      inscribed increases, circumscribed decreases, the gap shrinks, and both
 *      converge. The page's doubling sequence 3, 6, 12, 24, 48, 96 is checked.
 *   3. An independent chord-length computation of the inscribed perimeter.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("archimedes-circumference/archimedes-circumference-core.js", "ArchimedesCircumferenceCore");

{
  const s = C.start();
  equal("default n", s.n, 6);
  equal("default radius", s.radius, 1);
  equal("n clamped low", C.clamp(0, 6), 3);
  equal("n clamped high", C.clamp(999, 6), 96);
  equal("bad n falls back", C.clamp("x", 6), 6);
  check("hexagon inscribed perimeter is 6 for radius 1", Math.abs(C.inscribed(6, 1) - 6) < 1e-9);
  const pts = C.polygonPoints(4, 1);
  equal("four polygon vertices", pts.length, 4);
  check("the vertices lie on the unit circle", pts.every((p) => Math.abs(Math.hypot(p.x, p.y) - 1) < 1e-9));
}

{
  let squeezed = 0;
  let increasing = 0;
  let decreasing = 0;
  let shrinking = 0;
  let chordAgreement = 0;
  let prevP = -Infinity;
  let prevC = Infinity;
  let prevGap = Infinity;
  for (let n = 3; n <= 96; n++) {
    const r = C.analyze(n, 2);
    if (r.squeeze) squeezed++;
    if (r.inscribed > prevP - 1e-12) increasing++;
    if (r.circumscribed < prevC + 1e-12) decreasing++;
    if (r.gap < prevGap + 1e-12) shrinking++;
    prevP = r.inscribed;
    prevC = r.circumscribed;
    prevGap = r.gap;
    // Independent: sum the chord lengths around the polygon.
    const pts = C.polygonPoints(n, 2);
    let perimeter = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      perimeter += Math.hypot(a.x - b.x, a.y - b.y);
    }
    if (Math.abs(perimeter - r.inscribed) < 1e-8) chordAgreement++;
  }
  equal("all n checked", squeezed, 94);
  equal("all perimeters squeeze the circle", squeezed, 94);
  equal("inscribed perimeters increase", increasing, 94);
  equal("circumscribed perimeters decrease", decreasing, 94);
  equal("the gap shrinks", shrinking, 94);
  equal("the chord sum matches the formula", chordAgreement, 94);

  let archimedes = 0;
  let prev = 0;
  for (const n of [3, 6, 12, 24, 48, 96]) {
    const r = C.analyze(n, 1);
    if (r.inscribed > prev && r.squeeze) archimedes++;
    prev = r.inscribed;
  }
  equal("Archimedes' doubling sequence works", archimedes, 6);
  const last = C.analyze(96, 1);
  check("at 96 sides the estimate is close to 2 pi", Math.abs(last.inscribed - 2 * Math.PI) < 0.01);
}

done("archimedes-circumference");
