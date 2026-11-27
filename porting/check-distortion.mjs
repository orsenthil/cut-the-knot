#!/usr/bin/env node
"use strict";

/*
 * Logic test for distortion/distortion-core.js.
 *
 *   node porting/check-distortion.mjs
 *
 * (1) A second, literal transcription of DistortionCanvas.DrawTriangleOnCircles
 *     and DrawCircleOnTriangles from `javap -c -p`, including the applet's
 *     Java integer divisions and Math.round calls, is compared with the core
 *     for every reachable spacing (2..36) on 77 odd and even canvas sizes in
 *     both modes: every oval and every triangle segment must agree exactly.
 * (2) The cut-the-knot page's claims are checked geometrically on the same
 *     whole parameter space: the "circles" have equal width and height, the
 *     "triangles" are straight sided and equal sided, their signed area is
 *     never negative (they are not concave), and the nesting/count formulas
 *     hold.  Any apparent bending is therefore in the eye, not the drawing.
 * (3) The scrollbar range, checkbox mapping, status text and no-win rule.
 */

import { loadCore, check, done } from "./lib/load-core.mjs";

const C = loadCore("distortion/distortion-core.js", "DistortionCore");
const TC = C.MODE_TRIANGLES_ON_CIRCLES;
const CT = C.MODE_CIRCLES_ON_TRIANGLES;

const sizes = [];
for (const w of [40, 63, 100, 157, 201, 285, 300, 400, 401, 444, 517]) {
  for (const h of [40, 77, 150, 299, 300, 301, 511]) sizes.push({ width: w, height: h });
}

/* ------------------------------------------------------------------ 1. state */

{
  const s = C.start({});
  check("the applet starts at spacing 10", s.spread === 10, JSON.stringify(s));
  check("the applet starts with Triangle on Circles selected", s.mode === TC);
  check("the slider covers the Java scrollbar's reachable values",
    C.SPREAD_MIN === 2 && C.SPREAD_MAX === C.TRACK_MAX - C.TRACK_VISIBLE
      && C.TRACK_MAX === 40 && C.TRACK_VISIBLE === 4 && C.PAGE_STEP === 4);
  check("spacing is clamped to 2..36 and rounded like an AWT value",
    C.clampSpread(-9) === 2 && C.clampSpread(99) === 36
      && C.clampSpread(7.6) === 8 && C.clampSpread(NaN) === 10);
  check("Which follows the Circle on Triangles checkbox",
    C.normalizeMode(false) === TC && C.normalizeMode(true) === CT
      && C.normalizeMode("circle-on-triangles") === CT);
  check("a new picture has not yet been explored", s.explored === false);
  const moved = C.setOption(C.setOption(s, "spread", 36), "mode", true);
  check("changing either option keeps the other and marks the picture explored",
    moved.spread === 36 && moved.mode === CT && moved.explored === true
      && s.spread === 10 && s.mode === TC);
  check("an unknown option is ignored", C.setOption(s, "size", 9) === s);
  check("Reset returns the applet's defaults but remembers exploration",
    (() => { const r = C.reset(moved); return r.spread === 10 && r.mode === TC && r.explored; })());
  check("the position is plain data the tutor can save",
    JSON.stringify(moved) === JSON.stringify({ spread: 36, mode: CT, explored: true }));
  check("a picture has no win and no loss", C.result(moved) === null && C.result(s) === null);
}

/* ---------------- 2. the applet's own Draw methods, transcribed a second time
 * Straight from javap -c -p.  `jd` is Java's integer division and `rnd` is
 * Math.round (Java rounds toward positive infinity on a tie, as JS does).
 * No core helper is used below. */

const jd = (a, b) => Math.trunc(a / b);
const rnd = Math.round;

function appletScene(width, height, spacing, which) {
  const local2 = { width: width, height: height };
  const local3 = Math.min(local2.width, local2.height) - 15;   // side
  const local4 = jd(local2.width - local3, 2);                 // x of square
  const local5 = jd(local2.height - local3, 2);                // y of square
  const local8 = jd(local2.width, 2);                          // centre x
  const local9 = jd(local2.height, 2);                         // centre y
  const ovals = [];   // [x, y, width, height], as in Graphics.drawOval
  const segments = []; // ordered pairs of [x, y], as in Graphics.drawLine

  if (!which) {
    // DrawTriangleOnCircles, bytecode offsets 0..282.
    for (let i = 0; i >= 0; i++) {
      const offset = i * spacing;                 // local9
      const diameter = local3 - 2 * offset;       // local10
      if (diameter < 0) break;
      ovals.push([local4 + offset, local5 + offset, diameter, diameter]);
    }
    // 113: side/2 is an int division, then i2d; 119..133: centre is int too.
    const r = jd(local3, 2);
    const p0 = [rnd(local8 + r * Math.cos(1.5707963267948966)),
                rnd(local9 - r * Math.sin(1.5707963267948966))];
    const p1 = [rnd(local8 + r * Math.cos(0.5235987755982988)),
                rnd(local9 + r * Math.sin(0.5235987755982988))];
    const p2 = [rnd(local8 - r * Math.cos(0.5235987755982988)),
                rnd(local9 + r * Math.sin(0.5235987755982988))];
    segments.push([p0, p1], [p1, p2], [p2, p0]);
  } else {
    // DrawCircleOnTriangles, bytecode offsets 0..314.
    for (let i = 0; i >= 0; i++) {
      const r = local3 - 3 * (i * spacing);        // local12, i2d of an int
      if (r < 0) break;
      const p0 = [rnd(local8 + r * Math.cos(1.5707963267948966)),
                  rnd(local9 - r * Math.sin(1.5707963267948966))];
      const p1 = [rnd(local8 + r * Math.cos(0.5235987755982988)),
                  rnd(local9 + r * Math.sin(0.5235987755982988))];
      const p2 = [rnd(local8 - r * Math.cos(0.5235987755982988)),
                  rnd(local9 + r * Math.sin(0.5235987755982988))];
      segments.push([p0, p1], [p1, p2], [p2, p0]);
    }
    // 273..305: side*(j+1)/6 is an int division, then doubled.
    for (let j = 0; j < 3; j++) {
      const radius = jd(local3 * (j + 1), 6);
      ovals.push([local8 - radius, local9 - radius, 2 * radius, 2 * radius]);
    }
  }
  return { ovals: ovals, segments: segments, side: local3,
           origin: { x: local4, y: local5 }, centre: { x: local8, y: local9 } };
}

function samePoint(p, pair) {
  return p.x === pair[0] && p.y === pair[1];
}

{
  let cases = 0, ovalCountBad = 0, ovalGeomBad = 0, triCountBad = 0, triGeomBad = 0;
  let worstRadius = 0;
  for (const size of sizes) {
    for (let spread = C.SPREAD_MIN; spread <= C.SPREAD_MAX; spread++) {
      for (const which of [false, true]) {
        const mode = which ? CT : TC;
        const g = C.scene(size, spread, mode);
        const ref = appletScene(size.width, size.height, spread, which);
        cases++;
        if (g.circles.length !== ref.ovals.length) ovalCountBad++;
        if (g.triangles.length * 3 !== ref.segments.length) triCountBad++;
        for (let i = 0; i < Math.min(g.circles.length, ref.ovals.length); i++) {
          const c = g.circles[i], o = ref.ovals[i];
          if (c.cx !== o[0] + o[2] / 2 || c.cy !== o[1] + o[3] / 2
              || c.diameter !== o[2] || c.radius !== o[2] / 2) ovalGeomBad++;
          worstRadius = Math.max(worstRadius, Math.abs(c.radius - o[2] / 2));
        }
        for (let t = 0; t < Math.min(g.triangles.length, ref.segments.length / 3); t++) {
          const v = g.triangles[t].vertices;
          const seg = ref.segments.slice(t * 3, t * 3 + 3);
          if (!samePoint(v[0], seg[0][0]) || !samePoint(v[1], seg[0][1])
              || !samePoint(v[1], seg[1][0]) || !samePoint(v[2], seg[1][1])
              || !samePoint(v[2], seg[2][0]) || !samePoint(v[0], seg[2][1])) triGeomBad++;
        }
      }
    }
  }
  check("every spacing on every canvas size in both modes was covered",
    cases === sizes.length * 35 * 2, `${cases} configurations`);
  check("circle counts match the applet's drawOval loops", ovalCountBad === 0, `${ovalCountBad} bad`);
  check("triangle counts match the applet's drawLine loops", triCountBad === 0, `${triCountBad} bad`);
  check("every circle position and size matches the bytecode exactly",
    ovalGeomBad === 0 && worstRadius === 0, `${ovalGeomBad} bad`);
  check("every triangle corner matches the bytecode's Math.round exactly",
    triGeomBad === 0, `${triGeomBad} bad`);
}

/* ------------------------------- 3. the page's claims, over the same space */

{
  let badRound = 0, badFinite = 0, badEqualSide = 0, badConvex = 0;
  let badCircleFormula = 0, badTriangleFormula = 0, badOuterCircle = 0;
  let worstEqualSide = 0, worstOuter = 0, triangles = 0, circles = 0;
  for (const size of sizes) {
    const side = Math.min(size.width, size.height) - 15;
    for (let spread = C.SPREAD_MIN; spread <= C.SPREAD_MAX; spread++) {
      for (const mode of [TC, CT]) {
        const g = C.scene(size, spread, mode);
        const expectedCircles = mode === TC ? Math.floor(side / (2 * spread)) + 1 : 3;
        const expectedTriangles = mode === TC ? 1 : Math.floor(side / (3 * spread)) + 1;
        if (g.circles.length !== expectedCircles) badCircleFormula++;
        if (g.triangles.length !== expectedTriangles) badTriangleFormula++;
        for (const c of g.circles) {
          circles++;
          // A circle's bounding box really is square: the illusion is not a
          // squashed ellipse smuggled into the drawing.
          if (!(c.diameter >= 0)) badRound++;
          if (!Number.isFinite(c.cx + c.cy + c.radius + c.diameter)) badFinite++;
        }
        for (const t of g.triangles) {
          triangles++;
          const [a, b, c] = t.vertices;
          if (![a.x, a.y, b.x, b.y, c.x, c.y].every(Number.isFinite)) badFinite++;
          const lens = [Math.hypot(a.x - b.x, a.y - b.y),
                        Math.hypot(b.x - c.x, b.y - c.y),
                        Math.hypot(c.x - a.x, c.y - a.y)];
          const diff = Math.max(...lens) - Math.min(...lens);
          worstEqualSide = Math.max(worstEqualSide, diff);
          // Integer rounding of the corners can change a side by under 1.2px.
          if (diff > 1.25) badEqualSide++;
          // Positive signed area: straight-sided and convex, never concave.
          const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
          if (cross < 0) badConvex++;
          if (mode === TC && g.circles.length) {
            const c0 = g.circles[0];
            const off = Math.abs(Math.hypot(a.x - c0.cx, a.y - c0.cy) - c0.radius);
            worstOuter = Math.max(worstOuter, off);
            if (off > 1.5) badOuterCircle++;
          }
        }
      }
    }
  }
  check("the parameter space was sampled densely", circles > 25000 && triangles > 15000,
    `${circles} circles, ${triangles} triangles`);
  check("every drawn circle has matching width and height", badRound === 0, `${badRound} bad`);
  check("no generated coordinate is NaN or infinite", badFinite === 0, `${badFinite} bad`);
  check("the nested-circle count is floor(S/2s)+1", badCircleFormula === 0, `${badCircleFormula} bad`);
  check("the nested-triangle count is floor(S/3s)+1", badTriangleFormula === 0, `${badTriangleFormula} bad`);
  check("the page's 'circles' are mathematically equilateral within pixel rounding",
    badEqualSide === 0, `worst side difference ${worstEqualSide.toFixed(4)}px`);
  check("the page's 'triangles' are convex, never concave, in every configuration",
    badConvex === 0, `${badConvex} bad`);
  check("in Triangle on Circles the corners lie on the outermost circle",
    badOuterCircle === 0, `worst offset ${worstOuter.toFixed(4)}px`);
}

/* ------------------------------ 4. messages, defaults and perceptual claims */

{
  const s = C.start({});
  const g = C.geometry(s);
  check("the page's 400x300 picture has side 285 and centre (200, 150)",
    g.side === 285 && g.centre.x === 200 && g.centre.y === 150);
  check("the first picture has 15 circles at the applet's spacing 10",
    g.circles.length === 15 && g.triangles.length === 1,
    `${g.circles.length} circles`);
  check("the largest circle is 285px across and is centred on the square",
    g.circles[0].diameter === 285 && g.circles[0].cx === 199.5 && g.circles[0].cy === 149.5);
  const ct = C.setOption(s, "mode", true);
  const g2 = C.geometry(ct);
  check("the second picture has 10 nested triangles and 3 circles",
    g2.triangles.length === 10 && g2.circles.length === 3,
    `${g2.triangles.length} triangles, ${g2.circles.length} circles`);
  check("its three circle radii are the truncated values 47, 95 and 142",
    g2.circles.map((c) => c.radius).join(",") === "47,95,142");
  check("the status names the picture and counts what is drawn",
    C.describe(s).startsWith("Triangle on circles: 15 nested circles")
      && C.describe(ct).startsWith("Circle on triangles: 10 nested triangles"));
  check("the status says the bending is in the eye, not in the coordinates",
    C.describe(s).includes("only your eyes bend them")
      && C.describe(ct).includes("only your eyes bend them"));
  check("the widest and tightest spacings both draw something",
    C.geometry(C.setOption(s, "spread", 2)).circles.length === 72
      && C.geometry(C.setOption(s, "spread", 36)).circles.length === 4);
  check("the standard small picture finishes at spacing 2 as the bytecode does",
    C.scene({ width: 100, height: 100 }, 2, CT).triangles.length === 15
      && C.scene({ width: 100, height: 100 }, 2, CT).circles.length === 3);
}

done("distortion");
