#!/usr/bin/env node
"use strict";

/*
 * Logic test for area-of-circle/area-of-circle-core.js.
 *
 *   1. The one option and its range: 3 to 100 sectors, 6 on the page.
 *   2. Every claim the applet's page makes, for every sector count from 3 to
 *      100 and for several radii: the two curved bases add to one circumference,
 *      odd counts give a trapezoid, the height tends to r, the width tends to
 *      pi*r, and the row tends to a rectangle of area pi*r^2.
 *   3. A second transcription of the applet's own arithmetic (its alpha, side,
 *      k and halfWidth from DrawSectors), compared across the whole range.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("area-of-circle/area-of-circle-core.js", "AreaOfCircleCore");
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/* ------------------------------------------------------------ 1. the rules */

{
  equal("default is the page's six sectors", C.start({}), { sectors: 6 });
  equal("an explicit sector count is kept", C.start({ sectors: 17 }), { sectors: 17 });
  equal("the spinner's low end", C.setSectors(C.start(), 0), { sectors: 3 });
  equal("the spinner's high end", C.setSectors(C.start(), 1000), { sectors: 100 });
  equal("bad input falls back", C.setSectors(C.start(), "many"), { sectors: 6 });
  equal("outside values clamp on start", C.start({ sectors: -4 }), { sectors: 3 });
  const s = C.setSectors(C.start(), 25);
  equal("setting sectors returns a fresh position", s, { sectors: 25 });
  equal("the old position is untouched", C.start({}), { sectors: 6 });
}

/* --------------------------------- 2. the page's claims, for every N and r */

{
  let basesTotal = 0;
  let evenParallelograms = 0;
  let oddTrapezoids = 0;
  let tipCounts = 0;
  let arcLengths = 0;
  let angles = 0;
  let heightTends = 0;
  let widthTends = 0;
  let areaTends = 0;
  let cases = 0;

  for (const r of [1, 2.5, 40, 137.6]) {
    for (let n = C.MIN_SECTORS; n <= C.MAX_SECTORS; n++) {
      const g = C.geometry(C.start({ sectors: n }), r);
      cases++;

      if (near(g.topBase + g.bottomBase, g.circumference)) basesTotal++;
      if (g.topCount + g.bottomCount === n) tipCounts++;
      if (near(g.arcLength * n, g.circumference)) arcLengths++;
      if (near(g.sectorAngle * n, 2 * Math.PI)) angles++;

      if (n % 2 === 0) {
        if (near(g.topBase, Math.PI * r) && near(g.bottomBase, Math.PI * r)) evenParallelograms++;
      } else {
        // One more sector on top: the two bases differ by exactly one arc.
        if (g.topCount === g.bottomCount + 1 && near(g.topBase - g.bottomBase, g.arcLength)) oddTrapezoids++;
      }

      // The row's height and width close in on r and pi*r as slices get thin.
      if (g.height - r < 0.05 * r && n >= 20) heightTends++;
      if (near(g.width, Math.PI * r, 0.002) && n >= 30) widthTends++;
      if (near(g.width * g.height, Math.PI * r * r, 0.005) && n >= 30) areaTends++;
    }
  }

  equal("every sector count and radius was checked", cases, 4 * 98);
  equal("the two curved bases always add to one circumference", basesTotal, cases);
  equal("the two bases share all the sectors", tipCounts, cases);
  equal("N arcs make one full circumference", arcLengths, cases);
  equal("N sector angles make a full turn", angles, cases);
  equal("even counts give a parallelogram with two pi*r bases", evenParallelograms, 4 * 49);
  equal("odd counts give a trapezoid one arc out of true", oddTrapezoids, 4 * 49);

  const thin = C.geometry(C.start({ sectors: C.MAX_SECTORS }), 100);
  check("at 100 sectors the height is within one percent of r", thin.height / 100 < 1.01);
  check("at 100 sectors the width is within one percent of pi*r", near(thin.width, Math.PI * 100, 0.01));
  check("at 100 sectors the row is within one percent of pi*r^2", near(thin.width * thin.height, Math.PI * 100 * 100, 0.01));
  equal("thinner slices always lower the height",
    C.geometry(C.start({ sectors: 3 }), 1).height > C.geometry(C.start({ sectors: 100 }), 1).height, true);
  equal("height tends to r", heightTends, 4 * 81);
  equal("width tends to pi*r", widthTends, 4 * 71);
  equal("area tends to pi*r^2", areaTends, 4 * 71);
}

/* ------------------- 3. a second transcription of the applet's arithmetic */

{
  // AreaOfCircleCanvas.DrawSectors: alpha = pi/N, side = R*sin(alpha),
  // k = N even ? N/2 : (N+1)/2, halfWidth = side*k. The applet centres the
  // row on halfWidth; the core's topCount*step must be that same distance.
  // AreaOfCircleCanvas.init: t = (W-60)/(1+pi/2), Margin = 20, R = t/2.2.
  let halfWidths = 0;
  let radii = 0;
  let arcAngles = 0;
  for (let w = 320; w <= 1024; w += 8) {
    const t = (w - 60) / (1 + Math.PI / 2);
    const appletRadius = t / 2.2;
    const g = C.geometry(C.start({}), appletRadius);
    if (near(g.radius, appletRadius)) radii++;
  }
  for (let n = C.MIN_SECTORS; n <= C.MAX_SECTORS; n++) {
    const g = C.geometry(C.start({ sectors: n }), 83);
    const alpha = Math.PI / n;
    const appletSide = 83 * Math.sin(alpha);
    const k = n % 2 === 0 ? n / 2 : (n + 1) / 2;
    if (near(appletSide, g.step) && near(k * appletSide, g.topCount * g.step)) halfWidths++;
    // DrawOneSector draws each arc over 2*round(alpha*180/pi) degrees.
    const appletArcDegrees = 2 * Math.round(alpha * 180 / Math.PI);
    if (Math.abs(appletArcDegrees - g.sectorAngle * 180 / Math.PI) <= 1) arcAngles++;
  }
  equal("the applet's radius formula is reproduced", radii, 89);
  equal("the applet's step and half-width are reproduced", halfWidths, 98);
  equal("the applet's arc angle is the sector angle to a degree", arcAngles, 98);

  // The tips alternate rows and are one step apart, as the applet's loop lays
  // them out: DrawOneSector translates by i*side and rotates odd sectors by pi.
  const g = C.geometry(C.start({ sectors: 6 }), 90);
  for (let i = 0; i < 6; i++) {
    const t = C.tip(i, g);
    check(`tip ${i} is one step along`, near(t.x, i * g.step));
    check(`tip ${i} faces ${i % 2 === 0 ? "up" : "down"}`, t.up === (i % 2 === 0));
  }
}

done("area-of-circle");
