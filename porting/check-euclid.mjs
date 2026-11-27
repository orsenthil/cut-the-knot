#!/usr/bin/env node
"use strict";

/*
 * Logic test for euclid/euclid-core.js.
 *
 *   node porting/check-euclid.mjs
 *
 * The applet's own numbers come from pyTriangle.draw(): two vertices are
 * derived from the moving point by a reflection scaled by cos(theta) and a
 * rotation scaled by sin(theta), theta = pi/6 - 0.06. Each vertex is cast to
 * Java int, the areas are Heron's formula, the displayed values are
 * (int)(area + 0.5), and when the second value ends in 5 it is bumped by 45.
 * Section 4 below transcribes those methods a second time, straight from the
 * bytecode, and compares them with the core over every whole-pixel point of
 * the 400x400 canvas (160,801 positions) plus points outside it.
 *
 * The page's claims are tested in sections 3 and 5: the similar-shape area
 * law l*a^2 + l*b^2 = l*c^2 for the untruncated triangles; the exact
 * displayed sums at the two configurations the page highlights; and the
 * limits of those claims once the applet's pixels and quirk are included.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("euclid/euclid-core.js", "EuclidCore");
const tr = [{ x: 120, y: 270 }, { x: 120, y: 180 }, { x: 300, y: 270 }];
const nearNum = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const near = (p, q, tol = 1e-7) =>
  p && q && nearNum(p.x, q.x, tol) && nearNum(p.y, q.y, tol);

/* ------------------------------------------------ 1. the applet's constants */

{
  equal("the right-angle corner is (120, 270)", C.CORNER, { x: 120, y: 270 });
  equal("the three fixed vertices are the applet's m_tr", C.TRIANGLE, tr);
  check("the two legs are 90 and 180",
    nearNum(C.distance(tr[1], tr[0]), 90) && nearNum(C.distance(tr[0], tr[2]), 180));
  check("the vertex order gives a right angle at tr0",
    nearNum((tr[1].x - tr[0].x) * (tr[2].x - tr[0].x) +
            (tr[1].y - tr[0].y) * (tr[2].y - tr[0].y), 0));
  check("mouseStep is 2, as in the applet constructor", C.APPLET.mouseStep === 2);
  equal("the three eye boxes are the applet's Rectangles", C.EYES, [
    { x: 30, y: 20, w: 40, h: 20 },
    { x: 350, y: 80, w: 40, h: 20 },
    { x: 200, y: 10, w: 60, h: 30 },
  ]);
  check("theta is pi/6 - 0.06, not atan(1/2)",
    nearNum(C.THETA, Math.PI / 6 - 0.06) &&
    !nearNum(C.THETA, Math.atan(0.5), 1e-6));
  nearNum(C.S * C.S + C.C * C.C, 1, 1e-12);
  check("sin^2 + cos^2 = 1 for the applet's two scales",
    nearNum(C.S * C.S + C.C * C.C, 1, 1e-12));

  const s = C.start();
  equal("the moving point starts at tr1, as pyTriangle does", s, { mouse: { x: 120, y: 180 } });
  check("start gives plain data", JSON.stringify(s) === '{"mouse":{"x":120,"y":180}}');
}

/* ---------------------------------------- 2. dragging, presets and eyes */

{
  check("a drag snaps to multiples of 2 like mouseDragged",
    near(C.withMouse(C.start(), 141, 93).mouse, { x: 140, y: 92 }));
  check("negative pixel coordinates truncate toward zero like Java's /",
    near(C.withMouse(C.start(), -3, -5).mouse, { x: -2, y: -4 }));
  check("dragging leaves no trace on the old position", C.start().mouse.x === 120);
  check("the fold preset is (140, 92)", near(C.preset("fold").mouse, { x: 140, y: 92 }));
  check("the corner preset is the right-angle vertex", near(C.preset("corner").mouse, C.CORNER));
  equal("an unknown preset falls back to the start", C.preset("nope"), C.start());

  check("eyes are full only at the exact corner",
    C.fullEyes(C.preset("corner")) &&
    !C.fullEyes(C.preset("fold")) &&
    !C.fullEyes(C.withMouse(C.start(), 120, 268)));

  const f = C.figure(C.preset("corner"));
  check("at the corner every iris is centred in its eye",
    f.full && f.eyes.every((e) => e.irises.every((iris, i) => near(iris, e.centers[i]))));
  const g = C.figure(C.preset("fold"));
  check("away from the corner the irises look toward the point",
    !g.full && g.eyes.every((e) => e.irises.every((iris, i) =>
      !near(iris, e.centers[i]) || near(e.centers[i], g.mouse))));
  check("eye radii come from min(width, height)/2 and iris = r/2",
    f.eyes[0].r === 10 && f.eyes[0].iris === 5 && f.eyes[2].r === 15 && f.eyes[2].iris === 7);
}

/* --------------------------------- 3. the two configurations on the page */

{
  const corner = C.figure(C.preset("corner"));
  equal("corner derived vertices are (155, 198) and (84, 197)",
    [corner.long, corner.short], [{ x: 155, y: 198 }, { x: 84, y: 197 }]);
  equal("corner displayed areas are 6480, 1620 and 8100",
    [corner.shown.long, corner.shown.short, corner.shown.hyp], [6480, 1620, 8100]);
  check("at the corner the two displayed small areas add to the big one",
    corner.shown.long + corner.shown.short === corner.shown.hyp);
  check("at the corner the triangle on the sloping side is the original triangle",
    near(corner.mouse, tr[0]) && nearNum(corner.areas.hyp, 8100, 1e-6));

  const fold = C.figure(C.preset("fold"));
  equal("fold derived vertices are (100, 348) and (159, 170)",
    [fold.long, fold.short], [{ x: 100, y: 348 }, { x: 159, y: 170 }]);
  equal("fold displayed areas are 7020, 1800 and 8820 (the fallback picture)",
    [fold.shown.long, fold.shown.short, fold.shown.hyp], [7020, 1800, 8820]);
  check("at the fold configuration the displayed numbers add up",
    fold.shown.long + fold.shown.short === fold.shown.hyp);
  check("the fold's second display was 1755 before the applet's +45 quirk",
    nearNum(fold.areas.short, 1755, 1e-6));

  const before = JSON.stringify(C.preset("fold"));
  C.figure(C.preset("fold"));
  check("figure does not mutate the position it is given", JSON.stringify(C.preset("fold")) === before);
}

/* ------------------- 4. a second, literal transcription of the bytecode */

const ji = (v) => (Number.isNaN(v) ? 0 : Math.trunc(v));
const len = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

/** pyTriangle.Area(), written again from the bytecode. */
function areaFromBytecode(a, b, c) {
  const ab = len(a, b), ac = len(a, c), cb = len(c, b);
  const p = (ab + ac + cb) / 2.0;
  return Math.sqrt(p * (p - ab) * (p - ac) * (p - cb));
}

/** pyTriangle.draw() and mouseTracker.drawEye(), written again from javap. */
function drawFromBytecode(mx, my) {
  const m = { x: mx, y: my };
  const theta = 0.5235987755982988 - 0.06;
  const s = Math.sin(theta), c = Math.cos(theta);

  // First vertex: S13 = tr2.x + c*(c*dx + s*dy); S15 = 2*tr2.y - ...
  const dx2 = mx - tr[2].x, dy2 = my - tr[2].y;
  const pLong = {
    x: ji(tr[2].x + c * (c * dx2 + s * dy2)),
    y: ji(2.0 * tr[2].y - (tr[2].y + c * (-s * dx2 + c * dy2))),
  };
  // Second vertex: S13 = 2*tr1.x - (tr1.x + s*(-s*dx + c*dy)).
  const dx1 = mx - tr[1].x, dy1 = my - tr[1].y;
  const pShort = {
    x: ji(2 * tr[1].x - (tr[1].x + s * (-s * dx1 + c * dy1))),
    y: ji(tr[1].y + s * (c * dx1 + s * dy1)),
  };
  const raw = [
    areaFromBytecode(pLong, tr[0], tr[2]),
    areaFromBytecode(pShort, tr[1], tr[0]),
    areaFromBytecode(m, tr[1], tr[2]),
  ];
  const shown = raw.map((v) => ji(v + 0.5));
  if (shown[1] % 10 === 5) shown[1] += 45;

  const full = mx === tr[0].x && my === tr[0].y;
  const eyeBoxes = [[30, 20, 40, 20], [350, 80, 40, 20], [200, 10, 60, 30]];
  const eyeData = eyeBoxes.map(([x, y, w, h]) => {
    const r = Math.trunc(Math.min(w, h) / 2), ir = Math.trunc(r / 2);
    const centers = [{ x: x + r, y: y + r }, { x: x + w - r, y: y + r }];
    const irises = centers.map((center) => {
      if (full) return { x: center.x, y: center.y };
      const vx = mx - center.x, vy = my - center.y;
      const d = Math.sqrt(vx * vx + vy * vy);
      return { x: center.x + ji((vx / d) * (r - ir)), y: center.y + ji((vy / d) * (r - ir)) };
    });
    return { r, iris: ir, centers, irises };
  });
  return { pLong, pShort, shown, full, eyeData };
}

{
  const rand = rng(90817);
  const points = [];
  for (let x = 0; x <= 400; x++) for (let y = 0; y <= 400; y++) points.push([x, y]);
  for (let i = 0; i < 2000; i++) {
    points.push([Math.floor(rand() * 1400) - 500, Math.floor(rand() * 1400) - 500]);
  }
  let badVertices = 0, badNumbers = 0, badEyes = 0;
  for (const [x, y] of points) {
    const got = C.figure({ mouse: { x, y } });
    const want = drawFromBytecode(x, y);
    if (!near(got.long, want.pLong) || !near(got.short, want.pShort)) badVertices++;
    if (got.shown.long !== want.shown[0] || got.shown.short !== want.shown[1] ||
        got.shown.hyp !== want.shown[2]) badNumbers++;
    const eyeMatch = want.eyeData.every((e, k) =>
      e.centers.every((p, j) => near(p, got.eyes[k].centers[j])) &&
      e.irises.every((p, j) => near(p, got.eyes[k].irises[j])));
    if (!eyeMatch || got.full !== want.full) badEyes++;
  }
  check(`constructed vertices match the bytecode at all ${points.length} points`,
    badVertices === 0, `${badVertices} mismatches`);
  check(`all three displayed areas match the bytecode at all ${points.length} points`,
    badNumbers === 0, `${badNumbers} mismatches`);
  check(`all six eye irises match the bytecode at all ${points.length} points`,
    badEyes === 0, `${badEyes} mismatches`);
}

/* ------------------------- 5. what the page's area claim really says */

{
  // The uncut triangles are similar copies with scales c and s, so the
  // exact identity holds to floating-point precision away from degenerate
  // positions. The applet's angle is a little off atan(1/2), hence the
  // generous but still small tolerance.
  const rand = rng(2718);
  let worst = 0, checked = 0;
  for (let i = 0; i < 4000; i++) {
    const x = Math.floor(rand() * 801) - 200;
    const y = Math.floor(rand() * 801) - 200;
    const ideal = C.ideal({ mouse: { x, y } });
    if (ideal.areas.hyp < 1000) continue; // very thin triangles lose precision
    const ratio = Math.abs(ideal.areas.long + ideal.areas.short - ideal.areas.hyp) / ideal.areas.hyp;
    worst = Math.max(worst, ratio);
    checked++;
  }
  check(`the similar-shape law holds to ${worst.toExponential(2)} on ${checked} non-thin triangles`,
    worst < 5e-3, `worst relative error ${worst}`);

  // Heron's formula in the core agrees with the area of a cross product.
  let heronBad = 0;
  const crossArea = (a, b, c) =>
    Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
  for (let i = 0; i < 500; i++) {
    const a = { x: 0, y: 0 }, b = { x: 60 + i, y: 0 }, c = { x: 30, y: 90 + i };
    if (!nearNum(C.heron(a, b, c), crossArea(a, b, c), 1e-8)) heronBad++;
  }
  check("Heron's formula agrees with the cross-product area on 500 triangles", heronBad === 0);

  // The page says the two small areas add to the big one in two particular
  // configurations. Count where the applet's *displayed* numbers do so.
  let matches = 0, quirks = 0, rawOnly = 0, positions = 0;
  for (let x = 0; x <= 400; x++) for (let y = 0; y <= 400; y++) {
    const f = C.figure({ mouse: { x, y } });
    positions++;
    if (f.shown.long + f.shown.short === f.shown.hyp) matches++;
    if (f.areas.short + 0.5 >= 0 && Math.trunc(f.areas.short + 0.5) % 10 === 5) quirks++;
    if (Math.trunc(f.areas.long + 0.5) + Math.trunc(f.areas.short + 0.5) === f.shown.hyp) rawOnly++;
  }
  check(`displayed areas add up at ${matches} of ${positions} whole-pixel points`,
    matches > 10000 && matches < positions / 2, `${matches} matches`);
  let reachable = 0, reachableMatches = 0;
  for (let x = 0; x <= 400; x += 2) for (let y = 0; y <= 400; y += 2) {
    const f = C.figure({ mouse: { x, y } });
    reachable++;
    if (f.shown.long + f.shown.short === f.shown.hyp) reachableMatches++;
  }
  check("15,082 of the 40,401 positions the mouse can snap to show an exact sum",
    reachable === 40401 && reachableMatches === 15082,
    `${reachableMatches} of ${reachable}`);
  check(`the +45 quirk fires at ${quirks} points, including the fold configuration`,
    quirks > 0 &&
    Math.trunc(C.figure(C.preset("fold")).areas.short + 0.5) % 10 === 5);
  check(`without the quirk only ${rawOnly} points would display an exact sum`,
    rawOnly < matches, `${rawOnly} vs ${matches}`);
  check("the corner and fold configurations both display exact sums",
    C.figure(C.preset("corner")).shown.long + C.figure(C.preset("corner")).shown.short ===
      C.figure(C.preset("corner")).shown.hyp &&
    C.figure(C.preset("fold")).shown.long + C.figure(C.preset("fold")).shown.short ===
      C.figure(C.preset("fold")).shown.hyp);
}

done("euclid");
