#!/usr/bin/env node
"use strict";

/*
 * Logic test for cut-cylinder/cut-cylinder-core.js.
 *
 *   node porting/check-cut-cylinder.mjs
 *
 * The applet never classified a section: it drew a Java 3D cylinder (radius 6,
 * height 3 * 6 = 18) and a CTKPlane of side 20, and let the mouse move them.
 * The page claims "circles, ellipses, and parallel lines that may coalesce".
 * This test transcribes the bytecode's sizes and rotations a second time,
 * derives the section independently by projecting the round cylinder onto its
 * yz circle, and compares the core with it over every whole-degree tilt and
 * every whole-unit offset (2,275 configurations), then over 4,000 more random
 * ones. It also checks the page's claim on all of them, the coalescence of the
 * two lines at |d| = R, the fitted half-widths R / cos(beta) and R, the finite
 * cylinder's ends, every drawn point and every status line.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cut-cylinder/cut-cylinder-core.js", "CutCylinderCore");
const rad = (d) => (d * Math.PI) / 180;
const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;
const R = 6;
const H = 18;

/* ------------------------------------------------------ 1. the picture's rules */

{
  const s = C.start({});
  equal("a new picture uses the applet's tilt of pi/6", s.tilt, 30);
  equal("a new picture puts the plane 2 units out", s.offset, 2);
  check("the plane starts transparent, as in the applet", s.transparent === true);
  check("the two objects start separate, as in the applet", s.linked === false);
  check("the default section is an ellipse", C.analyse(s).family === "ellipse");
  check("tilt is clamped to the acute-to-parallel range",
    C.setTilt(s, -5).tilt === 0 && C.setTilt(s, 100).tilt === 90);
  check("offset is clamped to the slider's ends",
    C.setOffset(s, -99).offset === -12 && C.setOffset(s, 99).offset === 12);
  check("a non-number leaves the tilt alone", C.setTilt(s, NaN) === s);
  check("a non-number leaves the offset alone", C.setOffset(s, undefined) === s);
  check("transparency flips both ways", C.toggleTransparent(C.toggleTransparent(s)).transparent === s.transparent);
  check("combined motion flips both ways", C.toggleLinked(C.toggleLinked(s)).linked === s.linked);
  equal("the circle preset", [C.preset(s, "circle").tilt, C.preset(s, "circle").offset], [0, 2]);
  equal("the parallel-lines preset", [C.preset(s, "lines").tilt, C.preset(s, "lines").offset], [90, 2]);
  equal("the tangent preset puts the plane on the side", C.preset(s, "touch").offset, R);
  check("an unknown preset changes nothing", C.preset(s, "nonsense") === s);
  check("an illustration has no win or loss", C.describe(s).title !== "win" && C.describe(s).title !== "lose");
}

/* ------------------------- 2. the applet's own sizes, straight from the code */

function appletGeometry() {
  const stored = 6.0;                       // bytecode: ldc 6.0f; fstore 9
  return {
    radius: stored,                         // new Cylinder(fload 9, ...)
    height: 3.0 * stored,                   // second argument: 3.0f * fload 9
    plane: 20,                              // new CTKPlane(color, 20)
    rotZ: 0.7853981633974483,               // Math.PI / 4
    rotX: 0.5235987755982988,               // Math.PI / 6
    rotY: 0.5235987755982988,               // Math.PI / 6
    cylinderX: 1 * stored,                  // Vector3f(1 * radius, 0, 0)
    defaultTilt: (0.5235987755982988 * 180) / Math.PI,
  };
}

const bytecode = appletGeometry();

{
  check("the bytecode stores a cylinder radius of 6", bytecode.radius === C.RADIUS);
  check("the cylinder height is 3 times the radius", bytecode.height === C.HEIGHT && C.HALF_HEIGHT === 9);
  check("the applet's plane is a square of side 20", bytecode.plane === C.PLANE_SIZE);
  check("the cylinder starts rotated 45 degrees about z", near(bytecode.rotZ, Math.PI / 4, 1e-15));
  check("the cylinder starts rotated 30 degrees about x and y",
    near(bytecode.rotX, Math.PI / 6, 1e-15) && near(bytecode.rotY, Math.PI / 6, 1e-15));
  check("the cylinder is shifted one radius along x", bytecode.cylinderX === C.RADIUS);
  check("the default tilt is the applet's 30 degrees", near(bytecode.defaultTilt, C.DEFAULT_TILT, 1e-12));
}

/* A second, literal derivation. Project onto the plane perpendicular to the
   cylinder axis: the round side is the circle y^2 + z^2 = R^2, and the plane
   equation cos(beta) x + sin(beta) y = d solves x uniquely unless beta = 90.
   At beta = 90 the plane fixes y instead, leaving z = +/-sqrt(R^2-d^2) and a
   freely running x: that is where the two parallel lines come from. */
function appletFamily(tilt, d) {
  const c = Math.cos(rad(tilt)), s = Math.sin(rad(tilt));
  if (Math.abs(c) < 1e-9) {
    const v2 = R * R - d * d;
    return v2 > 1e-7 ? "lines" : v2 >= -1e-7 ? "line" : "none";
  }
  return tilt === 0 ? "circle" : "ellipse";
}

/** Sample the section from that projection, with no use of the core's maths. */
function appletPoints(tilt, d, n) {
  const c = Math.cos(rad(tilt)), s = Math.sin(rad(tilt));
  if (Math.abs(c) < 1e-9) {
    const v = Math.sqrt(Math.max(0, R * R - d * d));
    return [[{ x: -H / 2, y: d, z: -v }, { x: H / 2, y: d, z: -v }],
      [{ x: -H / 2, y: d, z: v }, { x: H / 2, y: d, z: v }]];
  }
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n;
    const y = R * Math.cos(t), z = R * Math.sin(t);
    pts.push({ x: (d - s * y) / c, y: y, z: z });
  }
  return [pts];
}

/* -------------------- 3. every configuration against the second transcription */

{
  const rand = rng(20261127);
  const configs = [];
  for (let tilt = 0; tilt <= 90; tilt++) {
    for (let d = -12; d <= 12; d++) configs.push([tilt, d]);
  }
  for (let i = 0; i < 4000; i++) configs.push([rand() * 90, (rand() * 2 - 1) * 12]);
  configs.push([90, R], [90, -R], [90, R - 1e-6], [90, R + 1e-6]);
  let wrongFamily = 0, wrongVisible = 0, wrongHalfWidth = 0;
  for (const [tilt, d] of configs) {
    const state = C.start({ tilt: tilt, offset: d });
    const a = C.analyse(state);
    if (a.family !== appletFamily(tilt, d)) wrongFamily++;
    /* Independent visibility from the projected circle: we need some t with
       |(d - sin(tilt) R cos t) / cos(tilt)| <= H/2. */
    const c = Math.cos(rad(tilt)), s = Math.sin(rad(tilt));
    let hit = false;
    if (Math.abs(c) < 1e-9) hit = Math.abs(d) <= R + 1e-9;
    else if (Math.abs(s) < 1e-9) hit = Math.abs(d) <= H / 2 + 1e-9;
    else {
      const lo = Math.max(-1, (d - (H / 2) * c) / (s * R));
      const hi = Math.min(1, (d + (H / 2) * c) / (s * R));
      hit = lo <= hi + 1e-9;
    }
    if (a.visible !== hit) wrongVisible++;
    if (Math.abs(c) > 1e-6 && tilt !== 0) {
      if (!near(a.semiU, R / c, 1e-8 * Math.max(1, 1 / c)) ||
          !near(a.semiV, R, 1e-10)) wrongHalfWidth++;
    }
  }
  check(`${configs.length} tilts and offsets give the applet's family`, wrongFamily === 0,
    `${wrongFamily} wrong`);
  check(`${configs.length} tilts and offsets agree on whether the cylinder is hit`, wrongVisible === 0,
    `${wrongVisible} wrong`);
  check("every ellipse has half-widths 6/cos(tilt) and 6", wrongHalfWidth === 0,
    `${wrongHalfWidth} wrong`);
}

/* -------------------------------------------------- 4. the page's exact claim */

{
  let circles = 0, ellipses = 0, pairs = 0, singles = 0, misses = 0, wrong = 0;
  for (let tilt = 0; tilt <= 90; tilt++) {
    for (let d = -12; d <= 12; d++) {
      const a = C.analyse(C.start({ tilt: tilt, offset: d }));
      if (a.family === "circle") {
        circles++;
        if (tilt !== 0 || a.visible !== (Math.abs(d) <= H / 2)) wrong++;
      } else if (a.family === "ellipse") {
        ellipses++;
        if (!(tilt > 0 && tilt < 90)) wrong++;
      } else if (a.family === "lines") {
        pairs++;
        if (tilt !== 90 || Math.abs(d) >= R || a.gap <= 0) wrong++;
      } else if (a.family === "line") {
        singles++;
        if (tilt !== 90 || !near(Math.abs(d), R) || a.gap > 1e-8) wrong++;
      } else {
        misses++;
        if (a.visible || (tilt === 90 && Math.abs(d) < R)) wrong++;
      }
    }
  }
  check("a circle occurs only when the plane is square to the axis", circles === 25 && wrong === 0,
    `${circles} circles, ${wrong} wrong`);
  check("every other non-parallel cut is an ellipse", ellipses === 89 * 25,
    `${ellipses} ellipses`);
  check("a plane along the axis cuts two lines when it is inside the side", pairs > 0);
  check("the two lines coalesce exactly when the plane touches the side", singles === 2);
  check("a plane beyond the side or beyond the ends gives no section", misses > 0);
  check("no configuration breaks the page's list of shapes", wrong === 0, `${wrong} wrong`);

  /* The gap shrinks monotonically to zero as the plane slides out. */
  let gapBad = 0;
  let previous = Infinity;
  for (let d = 0; d <= R; d += 0.5) {
    const a = C.analyse(C.start({ tilt: 90, offset: d }));
    if (a.gap > previous + 1e-9) gapBad++;
    previous = a.gap;
  }
  check("the two parallel lines close steadily as the plane slides out", gapBad === 0);
  check("the tangent gap is zero", C.analyse(C.start({ tilt: 90, offset: R })).gap === 0);
}

/* ----------------------- 5. every drawn point lies on both surfaces */

{
  const rand = rng(918274);
  let coneBad = 0, planeBad = 0, lengthBad = 0, sampled = 0, branchBad = 0;
  for (let i = 0; i < 320; i++) {
    const tilt = i % 7 === 0 ? 90 : rand() * 90;
    const d = i % 11 === 0 ? 0 : (rand() * 2 - 1) * 12;
    const state = C.start({ tilt: tilt, offset: d });
    const a = C.analyse(state);
    const lines = C.sectionPoints(state, 48);
    if (!a.visible && lines.length) branchBad++;
    if (a.visible && a.family === "lines" && lines.length < 1) branchBad++;
    if (a.visible && (a.family === "circle" || a.family === "ellipse") && lines.length < 1) branchBad++;
    for (const line of lines) {
      for (const uv of line) {
        const p = C.toSpace(state, uv);
        const cone = p.y * p.y + p.z * p.z - R * R;
        const plane = Math.cos(rad(tilt)) * p.x + Math.sin(rad(tilt)) * p.y - d;
        if (Math.abs(cone) > 1e-7) coneBad++;
        if (Math.abs(plane) > 1e-7) planeBad++;
        if (Math.abs(p.x) > H / 2 + 1e-6) lengthBad++;
        sampled++;
      }
    }
  }
  check(`${sampled} drawn points satisfy the cylinder equation`, coneBad === 0, `${coneBad} wrong`);
  check(`${sampled} drawn points satisfy the plane equation`, planeBad === 0, `${planeBad} wrong`);
  check("no drawn point lies beyond the finite cylinder's ends", lengthBad === 0, `${lengthBad} wrong`);
  check("every visible cut produces at least one polyline", branchBad === 0, `${branchBad} wrong`);
}

/* ------------- 6. the applet points, the side view and the status words */

{
  const key = (p) => [p.x, p.y, p.z].map((v) => Math.round(v * 1e4)).join(",");
  const sameSet = (a, b) => a.length === b.length &&
    a.map(key).sort().join("|") === b.map(key).sort().join("|");
  let pointBad = 0, segmentBad = 0, compared = 0;
  for (const tilt of [0, 15, 30, 60, 89, 90]) {
    for (const d of [-9, -6, -2, 0, 2, 6, 9]) {
      const state = C.start({ tilt: tilt, offset: d });
      const a = C.analyse(state);
      if (!a.visible) continue;
      const fromCore = C.sectionPoints(state, 64).map((line) =>
        line.map((uv) => C.toSpace(state, uv)));
      const fromApplet = appletPoints(tilt, d, 64);
      /* A partly trimmed oval has a different sampling density from the
         full projected circle; section 5 already checks each of its points. */
      if (a.alongAxis) {
        const want = fromApplet.filter((line) => line.length > 1);
        if (a.family === "line") want.splice(1); // the two lines have coalesced
        if (!sameSet(fromCore[0] || [], want[0] || [])) pointBad++;
        compared++;
      } else if (fromApplet[0].every((p) => Math.abs(p.x) <= H / 2 + 1e-7)) {
        if (!sameSet(fromCore[0] || [], fromApplet[0])) pointBad++;
        compared++;
      }
      const seg = C.planeSegment(state, { xMin: -12, xMax: 12, yMin: -9, yMax: 9 });
      if (seg) {
        for (const p of seg) {
          if (!near(Math.cos(rad(tilt)) * p.x + Math.sin(rad(tilt)) * p.y, d, 1e-9)) segmentBad++;
        }
      }
    }
  }
  check(`${compared} complete sections match the independent projection point for point`,
    pointBad === 0, `${pointBad} wrong`);
  check("the side-view cutting line always lies on the plane", segmentBad === 0,
    `${segmentBad} wrong`);
}

{
  let bad = 0;
  for (const tilt of [0, 12, 45, 90]) {
    for (const d of [-9, -6, -1, 1, 6, 9]) {
      const label = C.describe(C.start({ tilt: tilt, offset: d }));
      const family = C.analyse(C.start({ tilt: tilt, offset: d })).family;
      const want = { circle: "Circle", ellipse: "Ellipse", lines: "Two parallel lines",
        line: "One line", none: "No section" }[family];
      if (label.title !== want || !label.text.endsWith(".") || label.text.length < 20) bad++;
    }
  }
  check("24 status lines name the right section", bad === 0, `${bad} wrong`);
  check("a missed plane is reported without a win or a loss",
    C.describe(C.start({ tilt: 90, offset: 12 })).title === "No section");
  check("the tangent preset says the lines have joined",
    /joined/.test(C.describe(C.preset(C.start({}), "touch")).text));
  check("the reset preset keeps the player's radio choices", (() => {
    const s = C.toggleLinked(C.toggleTransparent(C.start({})));
    const r = C.preset(s, "reset");
    return r.transparent === s.transparent && r.linked === s.linked && r.tilt === 30;
  })());
}

done("cut-cylinder");
