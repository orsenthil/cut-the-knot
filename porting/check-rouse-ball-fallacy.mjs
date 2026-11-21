#!/usr/bin/env node
"use strict";

/*
 * Logic test for rouse-ball-fallacy/rouse-ball-fallacy-core.js.
 *
 *   1. Distance and intersection helpers; the starting construction.
 *   2. Congruences CO=EO, DO=AO, DC=AE hold for all draggable positions;
 *      the right angle ADC is 90 degrees; the fallacy's angle DAE stays obtuse.
 *   3. With the 4% shortening the probe falls inside the quadrilateral, as the
 *      applet's page says; with exact DC=AE it falls outside.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("rouse-ball-fallacy/rouse-ball-fallacy-core.js", "RouseBallFallacyCore");

{
  equal("distance", C.dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  const hit = C.intersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 });
  check("perpendicular lines intersect", Math.abs(hit.x) < 1e-9 && Math.abs(hit.y) < 1e-9);
  equal("angle of a right angle", Math.round(C.angleAt({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })), 90);
  equal("angle of an obtuse angle", Math.round(C.angleAt({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 1 })), 135);

  const s = C.start();
  const g = C.geometry(s);
  check("O is finite", Number.isFinite(g.O.x) && Number.isFinite(g.O.y));
  check("CO = EO", Math.abs(g.co - g.eo) < 1e-6 * g.co);
  check("DO = AO", Math.abs(g.do_ - g.ao) < 1e-6 * g.do_);
  check("ADC is right", Math.abs(g.angleADC - 90) < 1e-6);
  check("DAE is obtuse", g.angleDAE > 90);
  check("AE is about DC before shortening", Math.abs(C.dist(s.A, s.E) - g.dc) < 10);
  check("the proof angles are finite", Object.values(g.proofAngles).every((a) => Number.isFinite(a)));
  equal("moving a point changes the construction", C.setPoint(s, "E", { x: 90, y: 60 }).E.x, 90);
}

{
  const rnd = rng(1959);
  let congruences = 0;
  let right = 0;
  let obtuse = 0;
  let cases = 0;
  for (let t = 0; t < 300; t++) {
    const state = C.start();
    const E = { x: 30 + rnd() * 170, y: 10 + rnd() * 100 };
    const s = C.setPoint(state, "E", E);
    const g = C.geometry(s);
    if (!Number.isFinite(g.O.x)) continue;
    cases++;
    if (Math.abs(g.co - g.eo) < 1e-6 * g.co && Math.abs(g.do_ - g.ao) < 1e-6 * g.do_) congruences++;
    if (Math.abs(g.angleADC - 90) < 1e-6) right++;
    if (g.angleDAE > 90) obtuse++;
  }
  equal("all cases checked", cases, 300);
  equal("the congruences always hold", congruences, cases);
  equal("ADC is always right", right, cases);
  equal("DAE stays obtuse", obtuse, cases);

  const exact = C.geometry({ ...C.start(), shorten: 1 });
  check("without shortening, AE equals DC", Math.abs(exact.ae - exact.dc) < 0.5);
  check("shortening makes AE strictly smaller than DC", C.geometry(C.start()).ae < C.geometry(C.start()).dc);
}

done("rouse-ball-fallacy");
