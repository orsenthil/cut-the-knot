#!/usr/bin/env node
"use strict";

/*
 * Logic test for cavalieri/cavalieri-core.js.
 *
 *   1. The start position, the N spinner's 5..100 range, orientation, Show
 *      lines and Reset.
 *   2. The applet's central claim — the two figures always have equal area —
 *      for every N (5..100), both orientations, every level, both bars and a
 *      grid of drag positions (including drags that overshoot the other bar).
 *   3. A second, literal transcription of the applet's UpgradeLeft/Right and
 *      UpgradeLow/Upper methods, compared with the core over random positions.
 *   4. Every formula the page states for the cylinder / cone / sphere
 *      application, plus numerical integration of the slice areas to confirm
 *      the volume ratios 1/3, 2/3 and 4/3 and the final (4/3)pi*r^3.
 *   5. Edge cases: sliding a left rectangle, toggling lines, purity, bad input.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cavalieri/cavalieri-core.js", "CavalieriCore");
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/* ---------------------------------------------------- 1. the rules / options */

{
  const s = C.start({});
  equal("default position", s, {
    n: 20, vertical: false, showLines: false,
    levels: Array.from({ length: 20 }, () => ({ leftPos: 0, leftSpan: 1, barA: 0, barB: 1 })),
  });
  equal("start at N=5", C.start({ n: 5 }).levels.length, 5);
  equal("start at N=100", C.start({ n: 100 }).levels.length, 100);
  equal("N below the range clamps", C.start({ n: 2 }).n, C.MIN_N);
  equal("N above the range clamps", C.start({ n: 999 }).n, C.MAX_N);
  equal("bad N falls back to 20", C.start({ n: "many" }).n, 20);
  equal("orientation and lines are read", [C.start({ n: 8, vertical: true, showLines: true }).vertical,
    C.start({ n: 8, vertical: true, showLines: true }).showLines], [true, true]);
  equal("vertical level starts with the lower bar at 1", C.start({ n: 6, vertical: true }).levels[0],
    { leftPos: 0, leftSpan: 1, barA: 1, barB: 0 });

  const changed = C.dragBar(C.start({ n: 8 }), 3, "b", 0.4);
  const reN = C.setN(changed, 30);
  equal("changing N resets all levels", reN.levels.length, 30);
  check("changing N restores full-width rectangles", reN.levels.every((l) => l.leftSpan === 1 && l.barA === 0 && l.barB === 1));
  const reV = C.setVertical(changed, true);
  check("changing orientation resets the levels", reV.levels.every((l) => l.leftSpan === 1 && l.barA === 1 && l.barB === 0));
  check("changing orientation keeps N", reV.n === 8);
  const reL = C.setShowLines(changed, true);
  equal("Show lines keeps the rectangles", reL.levels, changed.levels);
  check("Show lines toggles the flag", reL.showLines === true);
  const reR = C.reset(changed);
  equal("Reset restores fresh levels", reR.levels, C.start({ n: 8 }).levels);
  check("Reset keeps the options", reR.n === 8 && reR.vertical === false && reR.showLines === false);
  const s100 = C.setN(C.start({}), 1000);
  equal("the spinner's upper clamp", s100.n, 100);
}

/* ------------------------------ 2. the equal-area claim, exhaustively swept */

{
  let cases = 0;
  let figuresEqual = 0;
  let slicesEqual = 0;
  const values = [-0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.25, 1.5];

  for (const vertical of [false, true]) {
    for (let n = C.MIN_N; n <= C.MAX_N; n++) {
      for (let level = 0; level < n; level++) {
        for (const which of ["a", "b"]) {
          for (const v of values) {
            const s = C.dragBar(C.start({ n, vertical }), level, which, v);
            const a = C.areas(s);
            cases++;
            if (near(a.left, a.right)) figuresEqual++;
            const sl = C.sliceLength(s, level);
            if (near(sl.left, sl.right)) slicesEqual++;
          }
        }
      }
    }
  }

  const levelSum = Array.from({ length: C.MAX_N - C.MIN_N + 1 }, (_, k) => C.MIN_N + k)
    .reduce((a, b) => a + b, 0);
  check("the sweep really ran every case", cases === 2 * 9 * 2 * levelSum); // orientation × values × bars × levels
  equal("both figures always have equal area", figuresEqual, cases);
  equal("every level's two slices always agree", slicesEqual, cases);

  // A drag must actually reshape the figures (the claim is not vacuous).
  const one = C.dragBar(C.start({ n: 10 }), 3, "b", 0.5);
  check("dragging bar B halves the shared length", near(C.sliceLength(one, 3).left, 0.5));
  check("the whole figure's area follows", near(C.areas(one).left, 1 - 0.5 / 10));
  const two = C.dragBar(C.start({ n: 10, vertical: true }), 3, "a", 0.4);
  check("dragging bar A vertically reshapes too", near(C.sliceLength(two, 3).right, 0.4));
  check("sliding a left rectangle never changes area", near(C.areas(C.slideLeft(one, 3, 0.2)).left, C.areas(one).left));
  check("sliding changes only the left rectangle's place",
    C.slideLeft(one, 3, 0.2).levels[3].leftPos === 0.2);
}

/* ---------------- 3. a second transcription of the applet's own drag code */

{
  // Literal transcription of UpgradeLeft / UpgradeRight (Horizontal) and
  // UpgradeLow / UpgradeUpper (Vertical). Mouse coordinates have already been
  // applied to the selected bar, exactly as mouseDragged/mouseReleased do.
  function appletDrag(level, vertical, which, x) {
    const l = Object.assign({}, level);
    if (!vertical) {
      if (which === "a") {
        const newWidth = l.barB - x; // UpgradeLeft
        l.leftPos = l.leftPos + l.leftSpan - newWidth;
        l.leftSpan = newWidth;
        l.barA = x;
      } else {
        l.leftSpan = x - l.barA; // UpgradeRight (at release)
        l.barB = x;
      }
    } else {
      if (which === "a") {
        l.leftSpan = x - l.barB; // UpgradeLow
        l.barA = x;
      } else {
        const newHeight = l.barA - x; // UpgradeUpper
        l.leftPos = l.leftPos + l.leftSpan - newHeight;
        l.leftSpan = newHeight;
        l.barB = x;
      }
    }
    return l;
  }

  const rand = rng(20261118);
  let matches = 0;
  let trials = 0;
  for (let t = 0; t < 4000; t++) {
    const vertical = rand() < 0.5;
    const n = C.MIN_N + Math.floor(rand() * (C.MAX_N - C.MIN_N + 1));
    const level = Math.floor(rand() * n);
    const which = rand() < 0.5 ? "a" : "b";
    // Start from a reshaped position, not just the initial one.
    let s = C.start({ n, vertical });
    s = C.dragBar(s, level, rand() < 0.5 ? "a" : "b", -0.3 + rand() * 1.6);
    s = C.slideLeft(s, level, -0.5 + rand() * 2);
    const x = -0.5 + rand() * 2;
    const expected = appletDrag(s.levels[level], vertical, which, x);
    const actual = C.dragBar(s, level, which, x).levels[level];
    trials++;
    if (JSON.stringify(actual) === JSON.stringify(expected)) matches++;
  }
  equal("the core matches the applet's own drag arithmetic on every random case", matches, trials);

  // Every case the transcription produces also keeps the areas equal.
  let invariant = 0;
  for (let t = 0; t < 1000; t++) {
    const vertical = rand() < 0.5;
    const n = 5 + Math.floor(rand() * 96);
    const level = Math.floor(rand() * n);
    const which = rand() < 0.5 ? "a" : "b";
    let s = C.start({ n, vertical });
    s = C.dragBar(s, level, which, -0.5 + rand() * 2);
    const a = C.areas(s);
    if (near(a.left, a.right)) invariant++;
  }
  equal("the transcribed rules keep the areas equal", invariant, 1000);
}

/* ------------------------ 4. the cylinder / cone / sphere application */

{
  const radii = [0.5, 1, 2, 7.3];
  let sliceClaims = 0;
  let pythagoras = 0;

  for (const r of radii) {
    const yGrid = Array.from({ length: 41 }, (_, i) => (r * i) / 40);
    for (const y of yGrid) {
      const cone = C.coneSlice(y, r);
      const cyl = C.cylinderSlice(y, r);
      const ring = C.ringSlice(y, r);
      const hemi = C.hemisphereSlice(y, r);
      if (near(cone, Math.PI * y * y) && near(cyl, Math.PI * r * r) &&
          near(ring, cyl - cone) && near(hemi, ring)) sliceClaims++;
      // The hemisphere's slice radius sqrt(r^2 - y^2) satisfies Pythagoras.
      const radius = Math.sqrt(r * r - y * y);
      if (near(radius * radius + y * y, r * r)) pythagoras++;
    }
  }
  equal("the page's four slice formulas hold at every level", sliceClaims, 4 * 41);
  equal("the hemisphere slice obeys Pythagoras at every level", pythagoras, 4 * 41);

  check("cone slice at the apex is 0", C.coneSlice(0, 3) === 0);
  check("cone slice at the top is its whole base", near(C.coneSlice(3, 3), Math.PI * 9));
  check("ring at the top vanishes", near(C.ringSlice(3, 3), 0));
  check("hemisphere's widest slice is at its equator", near(C.hemisphereSlice(0, 3), Math.PI * 9));

  for (const r of radii) {
    const cyl = C.cylinderVolume(r);
    const cone = C.coneVolume(r);
    const hemi = C.hemisphereVolume(r);
    const sphere = C.sphereVolume(r);
    check(`cone is 1/3 of the cylinder (r=${r})`, near(cone, cyl / 3));
    check(`hemisphere is 2/3 of the cylinder (r=${r})`, near(hemi, (2 * cyl) / 3));
    check(`cylinder minus cone is the hemisphere (r=${r})`, near(cyl - cone, hemi));
    check(`sphere is 4/3 of the cylinder (r=${r})`, near(sphere, (4 * cyl) / 3));
    check(`sphere is 4/3*pi*r^3 (r=${r})`, near(sphere, (4 * Math.PI * r * r * r) / 3));
  }

  // Integrate the slice areas (Simpson's rule) to check the volume ratios
  // without using the closed-form volume functions.
  function integrate(fn, r, steps = 2000) {
    const h = r / steps;
    let sum = fn(0, r) + fn(r, r);
    for (let i = 1; i < steps; i++) sum += (i % 2 ? 4 : 2) * fn(i * h, r);
    return (sum * h) / 3;
  }
  for (const r of radii) {
    const cylV = C.cylinderVolume(r);
    check(`integrated cone volume matches 1/3 cylinder (r=${r})`,
      near(integrate(C.coneSlice, r), cylV / 3, 1e-7));
    check(`integrated ring volume matches the hemisphere (r=${r})`,
      near(integrate(C.ringSlice, r), C.hemisphereVolume(r), 1e-7));
    check(`integrated hemisphere slices match the ring (r=${r})`,
      near(integrate(C.hemisphereSlice, r), integrate(C.ringSlice, r), 1e-7));
  }
  check("two hemispheres make the whole sphere", near(2 * C.hemisphereVolume(5), C.sphereVolume(5)));
}

/* ----------------------------- 5. edge cases and purity */

{
  const before = C.start({ n: 12 });
  const snapshot = JSON.stringify(before);
  C.dragBar(before, 2, "b", 0.3);
  C.slideLeft(before, 2, 0.9);
  C.setN(before, 30);
  C.reset(before);
  check("the core never mutates its input", JSON.stringify(before) === snapshot);

  const s = C.start({ n: 12 });
  equal("an unknown bar leaves the position alone", C.dragBar(s, 2, "z", 0.3), s);
  equal("a non-numeric drag leaves the position alone", C.dragBar(s, 2, "a", NaN), s);
  equal("an unknown level leaves the position alone", C.dragBar(s, 99, "a", 0.3), s);
  equal("a bad slide leaves the position alone", C.slideLeft(s, 2, null), s);
  equal("over-range N clamps on the spinner", C.setN(s, -20).n, C.MIN_N);
  equal("a bad N on the spinner keeps the old N", C.setN(s, "oops").n, 12);

  const flipped = C.setVertical(C.setShowLines(s, true), false);
  check("round-tripping the options restores the start",
    JSON.stringify(flipped) === JSON.stringify(C.start({ n: 12, showLines: true })));
  check("a fresh figure's area is 1", C.areas(C.start({ n: 12 })).left === 1);
  check("equal areas hold after every option change", (() => {
    let x = C.start({ n: 7 });
    x = C.dragBar(x, 1, "a", 0.3);
    x = C.setShowLines(x, true);
    x = C.slideLeft(x, 1, 0.6);
    x = C.setN(x, 40);
    const a = C.areas(x);
    return near(a.left, a.right);
  })());
}

done("cavalieri");
