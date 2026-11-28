#!/usr/bin/env node
"use strict";

/*
 * Logic test for hyperboloid/hyperboloid-core.js.
 *
 *   node porting/check-hyperboloid.mjs
 *
 * The page at https://www.cut-the-knot.org/Curriculum/Geometry/Hyperboloid.shtml
 * claims: "At the outset, the applet below displays a cylinder, i.e., a prism.
 * The edges joining the points on different bases are called generators. ...
 * The result of the rotations is the 3D figure known as the one sheet
 * hyperboloid. This same figure could be obtained by rotating a hyperbola
 * around one of its axes of symmetry; just choose the one that does not
 * intersect the hyperbola."
 *
 * This test transcribes GetGeoData(int) a second time straight from the
 * bytecode and compares every point and every quad for all 40 allowed N and
 * all 101 allowed M (4,040 configurations). It then checks the page's claims
 * on all of them: the start is a cylinder, every quad joins the two bases,
 * each generator lies on the one-sheet hyperboloid with waist R|cos(phi/2)|,
 * and that surface is a hyperbola revolved about its non-intersecting axis.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("hyperboloid/hyperboloid-core.js", "HyperboloidCore");
const R = Math.fround(0.5);
const L = Math.fround(1.5);
const FLOAT_TWO_PI = Math.fround(6.2831855);
const LINES = [];
for (let n = 5; n <= 200; n += 5) LINES.push(n);
const SHIFTS = [];
for (let m = 0; m <= 100; m++) SHIFTS.push(m);
const same = (a, b) => Object.is(a, b);
const near = (a, b, eps = 1e-6) => a === b || Math.abs(a - b) <= eps;

/* ----------------------------------------------------------- 1. the applet's own numbers */

{
  const s = C.start({});
  equal("the applet starts with 25 generator lines", s.lines, 25);
  equal("the applet starts with no base rotation", s.shift, 0);
  check("the applet's radius is the float 0.5f", same(C.R, Math.fround(0.5)));
  check("the applet's height is the float 1.5f", same(C.L, Math.fround(1.5)));
  check("the applet uses the float literal 6.2831855f", same(C.TWO_PI_F, Math.fround(6.2831855)));
  check("Generators starts ticked and Solid starts unticked", s.frame === true && s.solid === false);
  check("a demo has no win or loss", C.describe(s).title === "Cylinder");
  equal("the spinners' ranges",
    [C.MIN_LINES, C.MAX_LINES, C.LINE_STEP, C.MIN_SHIFT, C.MAX_SHIFT, C.SHIFT_STEP],
    [5, 200, 5, 0, 100, 1]);
  check("N is snapped to the spinner's step of five",
    C.start({ lines: 23 }).lines === 25 && C.start({ lines: 26 }).lines === 25);
  check("N is clamped to 5 and 200",
    C.start({ lines: -7 }).lines === 5 && C.start({ lines: 999 }).lines === 200);
  check("M is clamped to 0 and 100",
    C.start({ shift: -7 }).shift === 0 && C.start({ shift: 999 }).shift === 100);
  check("a bad number keeps the default", C.start({ lines: NaN, shift: undefined }).lines === 25);
  check("changing an option returns a new position", C.withOption(s, "shift", 3) !== s && s.shift === 0);
}

/* ------------------------------- 2. the bytecode's GetGeoData, transcribed again */

/* Written in the order of the bytecode, using float stores at each step:
   step = 6.2831855f / n; theta_i = step * i (float);
   p[i] = (R cos(theta_i), -L/2, R sin(theta_i));
   p[i+n] = (p[i].x, -p[i].y, p[i].z);
   q[i] = (i, (i+1)%n, ((i+1)%n + M)%n + n, (i+M)%n + n). */
function appletGeoData(n, m) {
  const float = Math.fround;
  const points = [];
  for (let i = 0; i < 2 * n; i++) points.push([0, 0, 0]);
  const step = float(FLOAT_TWO_PI / n);
  for (let i = 0; i < n; i++) {
    const theta = float(step * i);
    points[i][0] = float(R * Math.cos(theta));
    points[i][2] = float(R * Math.sin(theta));
    points[i][1] = float(-L / 2);
  }
  for (let i = 0; i < n; i++) {
    points[i + n][0] = points[i][0];
    points[i + n][2] = points[i][2];
    points[i + n][1] = -points[i][1];
  }
  const quads = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    quads.push([i, j, (j + m) % n + n, (i + m) % n + n]);
  }
  return { points: points, quads: quads, step: step };
}

{
  let badPoints = 0, badQuads = 0, badStep = 0, compared = 0;
  for (const n of LINES) {
    for (const m of SHIFTS) {
      const want = appletGeoData(n, m);
      const got = C.getGeoData(n, m);
      if (!same(want.step, got.step)) badStep++;
      if (want.points.length !== got.points.length || want.quads.length !== got.quads.length) {
        badQuads++;
        continue;
      }
      for (let i = 0; i < want.points.length; i++) {
        for (let k = 0; k < 3; k++) if (!same(want.points[i][k], got.points[i][k])) badPoints++;
      }
      for (let i = 0; i < want.quads.length; i++) {
        for (let k = 0; k < 4; k++) if (want.quads[i][k] !== got.quads[i][k]) badQuads++;
      }
      compared++;
    }
  }
  check(`${compared} GetGeoData results match the bytecode point for point`, badPoints === 0,
    `${badPoints} wrong floats`);
  check("every one of those configurations has the bytecode's quad indices", badQuads === 0,
    `${badQuads} wrong indices`);
  check("every one has the bytecode's float angle step", badStep === 0, `${badStep} wrong steps`);

  const g = C.getGeoData(25, 0);
  equal("the first quad of the starting cylinder", g.quads[0], [0, 1, 26, 25]);
  equal("the last quad of the starting cylinder", g.quads[24], [24, 0, 25, 49]);
  equal("the bottom base lies at y = -L/2", [g.points[0][1], g.points[24][1]], [-0.75, -0.75]);
  equal("the top base lies at y = +L/2", [g.points[25][1], g.points[49][1]], [0.75, 0.75]);
  check("every base point is at radius R from the axis",
    g.points.every((p) => near(Math.hypot(p[0], p[2]), R, 2e-8)));
  /* The bytecode stores (0,0,0) in points[0] first, then the first loop
     overwrites it with the point at angle zero. The harmless store stays. */
  check("point zero is overwritten by the first point at angle zero",
    same(g.points[0][0], R) && same(g.points[0][2], 0));
}

/* -------------------------------------------------------- 3. the page's claims, all N and M */

{
  let notCylinder = 0, notJoined = 0, notOnRings = 0, shiftedBottom = 0;
  let hyperboloids = 0, cones = 0, cylinders = 0;
  for (const n of LINES) {
    for (const m of SHIFTS) {
      const s = C.start({ lines: n, shift: m });
      const g = C.geometry(s);
      const surface = C.surface(s);
      const isCylinder = m % n === 0;
      if ((surface.kind === "cylinder") !== isCylinder) notCylinder++;
      if (isCylinder) cylinders++;
      else if (m % n * 2 === n) cones++;
      else hyperboloids++;

      for (const q of g.quads) {
        if (!(q[0] < n && q[1] < n && q[2] >= n && q[3] >= n)) notJoined++;
        /* All four corners sit on one of the two bases. */
        const corners = q.map((k) => g.points[k]);
        if (corners.some((p) => !near(Math.abs(p[1]), L / 2, 1e-7))) notOnRings++;
        if (!same(corners[0][1], corners[1][1]) || !same(corners[2][1], corners[3][1])) notOnRings++;
      }
      /* M only changes which two points a generator joins; the two rings of
         points themselves are always the same. */
      const plain = C.getGeoData(n, 0);
      for (let i = 0; i < 2 * n; i++) {
        for (let k = 0; k < 3; k++) if (!same(g.points[i][k], plain.points[i][k])) shiftedBottom++;
      }
    }
  }
  check("the outset is a cylinder exactly when M is a whole number of turns",
    notCylinder === 0 && cylinders > 0, `${notCylinder} wrong, ${cylinders} cylinders`);
  check("every generator quad joins two points on different bases", notJoined === 0,
    `${notJoined} wrong`);
  check("every quad corner lies on a base ring", notOnRings === 0, `${notOnRings} wrong`);
  check("turning the base never moves the points of either base", shiftedBottom === 0,
    `${shiftedBottom} moved`);
  check("the 4,040 settings include cylinders, cones and hyperboloids",
    cylinders > 0 && cones > 0 && hyperboloids > 0,
    `${cylinders} cylinders, ${cones} cones, ${hyperboloids} hyperboloids`);
  check("M beyond N wraps round: M = 100 on 5 lines is again a cylinder",
    C.surface(C.start({ lines: 5, shift: 100 })).kind === "cylinder");
  check("M and M + N give the same picture (when both are allowed)",
    C.surface(C.start({ lines: 5, shift: 2 })).waist ===
    C.surface(C.start({ lines: 5, shift: 7 })).waist);
}

/* --------------------------------------------- 4. every generator lies on the surface */

{
  let offSurface = 0, wrongWaist = 0, wrongEnds = 0, sampled = 0;
  for (const n of LINES) {
    for (const m of SHIFTS) {
      const s = C.start({ lines: n, shift: m });
      const g = C.geometry(s);
      const surf = C.surface(s);
      const phi = (2 * Math.PI * (m % n)) / n;
      const a = R * Math.abs(Math.cos(phi / 2));
      const c = Math.abs(Math.sin(phi / 2)) < 1e-12 ? Infinity
        : (L / 2) * Math.abs(Math.cos(phi / 2)) / Math.abs(Math.sin(phi / 2));
      if (!near(surf.waist, a, 1e-12) || !near(surf.throat, c, 1e-9)) wrongWaist++;
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        for (const i of [0, 1, Math.floor(n / 2), n - 1]) {
          const p = C.generatorPoint(g, i, t);
          const r2 = p[0] * p[0] + p[2] * p[2];
          /* r^2 = a^2 + (a^2 / c^2) y^2 for the spun hyperbola. */
          const expected = a * a * (1 + (p[1] * p[1]) / (c * c));
          if (Number.isFinite(expected) && !near(r2, expected, 2e-6)) offSurface++;
          if (Number.isFinite(c) && !near(C.radiusAt(s, p[1]) * C.radiusAt(s, p[1]), r2, 2e-6)) offSurface++;
          if (t === 0 && !near(p[1], -L / 2, 1e-7)) wrongEnds++;
          if (t === 1 && !near(p[1], L / 2, 1e-7)) wrongEnds++;
          sampled++;
        }
      }
    }
  }
  check(`${sampled} generator points lie on the spun hyperbola r^2 = a^2(1 + y^2/c^2)`,
    offSurface === 0, `${offSurface} off the surface`);
  check("waist and throat match the rotation angle for all 4,040 settings", wrongWaist === 0,
    `${wrongWaist} wrong`);
  check("each generator starts on the lower base and ends on the upper base", wrongEnds === 0,
    `${wrongEnds} wrong`);

  /* The narrowest circle is at the middle, and its radius is R|cos(phi/2)|. */
  let narrowest = 0;
  for (const n of LINES) {
    for (const m of SHIFTS) {
      const s = C.start({ lines: n, shift: m });
      const mid = C.radiusAt(s, 0);
      const top = C.radiusAt(s, L / 2);
      const a = R * Math.abs(Math.cos(((2 * Math.PI * (m % n)) / n) / 2));
      if (!near(mid, a, 1e-12) || !near(top, R, 1e-12) || mid > top + 1e-12) narrowest++;
    }
  }
  check("all 4,040 surfaces have their waist at the middle and radius R at the bases",
    narrowest === 0, `${narrowest} wrong`);
}

/* ------------------------------------------ 5. the axis that misses the hyperbola */

{
  let badAxis = 0, checked = 0;
  for (const n of LINES) {
    for (let m = 1; m < n && m <= C.MAX_SHIFT; m++) {
      if (m * 2 === n) continue; // the cone is the degenerate case
      const s = C.start({ lines: n, shift: m });
      const surf = C.surface(s);
      const phi = (2 * Math.PI * m) / n;
      const a = R * Math.abs(Math.cos(phi / 2));
      const c = (L / 2) * Math.abs(Math.cos(phi / 2)) / Math.abs(Math.sin(phi / 2));
      /* The transverse axis cuts the hyperbola at r = +/-a; the conjugate
         (vertical) axis has r = 0, where -y^2/c^2 = 1 has no real solution. */
      if (!near(surf.waist, a, 1e-12) || !(a > 0 && c > 0)) badAxis++;
      if (C.radiusAt(s, 0) !== a) badAxis++;
      /* At r = a, y = 0 the hyperbola is satisfied; at r = 0 the left side
         -y^2/c^2 is negative for every y, so the vertical axis misses it. */
      for (const y of [-L / 2, -0.3, 0, 0.3, L / 2]) {
        const onTransverse = (a * a) / (a * a) - 0;
        const onVertical = 0 / (a * a) - (y * y) / (c * c);
        if (!near(onTransverse, 1, 1e-12) || near(onVertical, 1, 1e-12)) badAxis++;
        const r = C.radiusAt(s, y);
        if (!near((r * r) / (a * a) - (y * y) / (c * c), 1, 2e-6)) badAxis++;
      }
      if (near(Math.cos(phi / 2), 0, 1e-12)) badAxis++;
      checked++;
    }
  }
  check(`${checked} rotations give a hyperbola with a real transverse axis`, badAxis === 0,
    `${badAxis} wrong`);
  check("the vertical axis never meets the spun hyperbola (r = 0 gives no y)",
    checked > 1000 && C.radiusAt(C.start({ shift: 6 }), 0) > 0);
}

/* ------------------------------------------ 6. the applet's two rendering modes */

{
  const cases = [[false, false], [false, true], [true, false], [true, true]];
  const got = cases.map(([solid, frame]) => C.rendering(C.start({ solid: solid, frame: frame })));
  check("Solid off always keeps the frame, even if unticked",
    got[0].frame === true && got[1].frame === true && got[0].solid === false);
  check("Solid on is transparent, with the frame only if ticked",
    got[2].solid === true && got[2].transparent === true && got[2].frame === false &&
    got[3].frame === true);
  check("unticking Solid re-ticks Generators, as itemStateChanged does",
    C.withOption(C.start({ solid: true, frame: false }), "solid", false).frame === true);
  check("unticking Generators while Solid is off has no effect",
    C.withOption(C.start({}), "frame", false).frame === true);
  check("unticking Generators works when Solid is on",
    C.withOption(C.start({ solid: true, frame: true }), "frame", false).frame === false);
  check("a reset keeps the checkboxes but returns to 25 lines and no turn", (() => {
    const s = C.start({ lines: 100, shift: 37, solid: true, frame: false });
    const r = C.start({ solid: s.solid, frame: s.frame });
    return r.lines === 25 && r.shift === 0 && r.solid && !r.frame;
  })());
}

/* ------------------------------------------------------- 7. the status words */

{
  let bad = 0;
  for (const n of [5, 25, 50, 200]) {
    for (const m of [0, 1, 5, 25, Math.floor(n / 2), 100]) {
      const s = C.start({ lines: n, shift: m });
      const label = C.describe(s);
      const kind = C.surface(s).kind;
      const want = { cylinder: "Cylinder", cone: "Cone", hyperboloid: "One sheet hyperboloid" }[kind];
      if (label.title !== want || !label.text.endsWith(".") || label.text.length < 25) bad++;
    }
  }
  check("every status line names the right kind of surface", bad === 0, `${bad} wrong`);
  check("the page's own words appear in the description",
    /One sheet hyperboloid/.test(C.describe(C.start({ shift: 6 })).title));
  check("a cone says the generators meet on the axis",
    /meet on the axis/.test(C.describe(C.start({ lines: 50, shift: 25 })).text));
  check("no status line claims a win or a loss",
    !/win|lose|lost/i.test([0, 6, 25, 100].map((m) => C.describe(C.start({ shift: m })).text).join(" ")));
}

done("hyperboloid");
