#!/usr/bin/env node
"use strict";

/*
 * Logic test for cube7-cube8/cube7-cube8-core.js.
 *
 *   node porting/check-cube7-cube8.mjs
 *
 * 1. The applet's three scrollbar ranges and defaults.
 * 2. An independent, literal transcription of Cube7Cube8Canvas.Draw() from the
 *    bytecode, compared with the core over every angle (15..60), every N
 *    (2..10) and every Trans (-127..127), at two canvas sizes. Each rhombus is
 *    compared point by point (rounded the way FillPoly rounds) and colour by
 *    colour.
 * 3. The page's claim. "Depending on a view point one may see either seven or
 *    eight cubes" is a perceptual claim, not a formula: there is no count in
 *    the code. What can be checked is its geometric precondition - the same
 *    drawn rhombus can serve as a face of cubes in two different readings -
 *    and that the sliders never add or remove a face, only fade some of them.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("cube7-cube8/cube7-cube8-core.js", "Cube7Cube8Core");

const allAngles = Array.from({ length: 60 - 15 + 1 }, (_, i) => 15 + i);
const allNs = Array.from({ length: 10 - 2 + 1 }, (_, i) => 2 + i);
const allTrans = Array.from({ length: 255 }, (_, i) => i - 127);
const SIZES = [[400, 300], [375, 280]];

/* --------------------------------------------------- 1. controls and state */

{
  equal("angle scrollbar: initial 45, min 15, max 60", C.RANGES.angle, { min: 15, max: 60, initial: 45 });
  equal("N scrollbar: initial 2, min 2, max 10", C.RANGES.n, { min: 2, max: 10, initial: 2 });
  equal("Trans scrollbar: initial 0, min -127, max 127", C.RANGES.trans, { min: -127, max: 127, initial: 0 });
  equal("the opening view", C.start({}), { angle: 45, n: 2, trans: 0 });
  equal("one slider is independent of the others", C.start({ angle: 30, trans: 12 }),
    { angle: 30, n: 2, trans: 12 });
  check("state is plain data", JSON.stringify(C.position(C.start({}))) === '{"angle":45,"n":2,"trans":0}');

  let clamped = true;
  for (let v = -300; v <= 300; v++) {
    if (C.clamp("angle", v, 45) !== Math.max(15, Math.min(60, v))) clamped = false;
    if (C.clamp("n", v, 2) !== Math.max(2, Math.min(10, v))) clamped = false;
    if (C.clamp("trans", v, 0) !== Math.max(-127, Math.min(127, v))) clamped = false;
  }
  check("all 1803 possible scrollbar values clamp to their AWT ranges", clamped);
  check("start() ignores a non-numeric slider value",
    C.start({ angle: "45", n: null, trans: undefined }).angle === 45 &&
    C.start({ angle: "45" }).n === 2 && C.start({ trans: "0" }).trans === 0);
  check("withOption does not mutate the old state", (() => {
    const s = C.start({});
    const t = C.withOption(s, "angle", 60);
    return s.angle === 45 && t.angle === 60 && t.n === 2 && t.trans === 0;
  })());
}

/* ----------------------------------------------------------- 2. alpha math */

{
  let ok = true;
  for (const t of allTrans) {
    const p = C.palette(t);
    const minus = Math.min(255, 255 - 2 * t);
    const plus = Math.min(255, 255 + 2 * t);
    const alphas = [p.darkMinus.alpha, p.midDarkMinus.alpha, p.midLightMinus.alpha, p.lightMinus.alpha];
    const plusAlphas = [p.darkPlus.alpha, p.midDarkPlus.alpha, p.midLightPlus.alpha, p.lightPlus.alpha];
    if (alphas.some((a) => a !== minus) || plusAlphas.some((a) => a !== plus)) ok = false;
    if ([p.dark, p.midDark, p.midLight, p.light].some((c) => c.alpha !== 255)) ok = false;
    if ([p.dark, p.darkMinus, p.darkPlus].some((c) => c.grey !== 32)) ok = false;
    if ([p.midDark, p.midDarkMinus, p.midDarkPlus].some((c) => c.grey !== 91)) ok = false;
    if ([p.midLight, p.midLightMinus, p.midLightPlus].some((c) => c.grey !== 160)) ok = false;
    if ([p.light, p.lightMinus, p.lightPlus].some((c) => c.grey !== 191)) ok = false;
  }
  check("all 255 Trans values reproduce the applet's four greys and two clamped alphas", ok);
  check("Trans = 0 makes both alpha families fully opaque", C.palette(0).darkMinus.alpha === 255 &&
    C.palette(0).darkPlus.alpha === 255);
  check("a positive Trans only fades the minus family", C.palette(127).darkMinus.alpha === 1 &&
    C.palette(127).darkPlus.alpha === 255);
  check("a negative Trans only fades the plus family", C.palette(-127).darkMinus.alpha === 255 &&
    C.palette(-127).darkPlus.alpha === 1);
}

/* -------------------------------------- 3. second transcription of Draw() */

/*
 * Written straight from javap -c -p of Cube7Cube8Canvas.Draw(), using the
 * bytecode's own local variables (25/27 for the temporary point, 29 for a
 * loop counter) and its order of calls. It shares no code with the core.
 */
function appletDraw(angle, n, trans, width, height) {
  const round = Math.round;
  const min = Math.min;
  const aMinus = min(255, 255 - 2 * trans);
  const aPlus = min(255, 255 + 2 * trans);
  const col = (grey, alpha) => ({ grey, alpha });
  const c4 = col(32, 255), c5 = col(32, aMinus), c6 = col(32, aPlus);
  const c7 = col(91, 255), c8 = col(91, aMinus), c9 = col(91, aPlus);
  const c10 = col(160, 255), c11 = col(160, aMinus), c12 = col(160, aPlus);
  const c13 = col(191, 255), c14 = col(191, aMinus), c15 = col(191, aPlus);

  const dim = { width, height };
  const s17 = Math.trunc(dim.width / 10); // width / 10 as Java integer division
  const s19 = (angle * Math.PI) / 180;
  const x21 = Math.trunc(dim.width / 2), y21 = s17;
  const S22 = round(dim.height / 1.4 / (n + 5));
  const sw = S22 * 1.6 * Math.cos(s19);
  const sh = S22 * Math.sin(s19);
  const out = [];
  // DrawRombus(g, p1, p2, p3, fill, far, near) fills [p1, p2, p4, p3],
  // where p4 = p3 + p2 - p1, then strokes p1's two edges with near and p4's
  // two edges with far. FillPoly rounds every corner with Math.round.
  function R(p1, p2, p3, fill, far, near) {
    const p4 = [p3[0] + p2[0] - p1[0], p3[1] + p2[1] - p1[1]];
    const pts = [p1, p2, p4, p3].map((p) => [round(p[0]), round(p[1])]);
    const c = (v) => v && [v.grey, v.alpha];
    out.push(JSON.stringify([pts, c(fill), c(far), c(near)]));
  }
  const P = (x, y) => [x, y];

  // offsets 349..477: the two top faces nearest the viewer
  R(P(x21 - sw, y21 - sh), P(x21, y21), P(x21 - 2 * sw, y21), c5, c4, c4);
  R(P(x21 + sw, y21 - sh), P(x21, y21), P(x21 + 2 * sw, y21), c5, c4, c4);
  // offsets 477..659
  let x25 = x21 - 3 * sw, y27 = y21 + sh;
  R(P(x25, y27), P(x25 + sw, y27 - sh), P(x25, y27 + 2 * sh), c9, c4, c6);
  x25 = x21 + 3 * sw;
  R(P(x25, y27), P(x25 - sw, y27 - sh), P(x25, y27 + 2 * sh), c12, c4, c6);
  // offsets 659..855: i = 0, 2, then 1, 3
  for (let i29 = 0; i29 < 4; i29 += 2) {
    x25 = x21 + (i29 - 2) * sw;
    R(P(x25, y21), P(x25 + sw, y21 + sh), P(x25, y21 + 2 * sh), c10, c4, c4);
  }
  for (let i29 = 1; i29 < 4; i29 += 2) {
    x25 = x21 - (i29 - 1) * sw;
    y27 = y21 + sh;
    R(P(x25, y27), P(x25 + sw, y27 - sh), P(x25, y27 + 2 * sh), c7, c4, c4);
  }
  // offsets 855..975: x += 2w happens before the first rhombus
  x25 = x21 - 5 * sw;
  y27 = y21 + 3 * sh;
  for (let i29 = 0; i29 < 3; i29++) {
    x25 += 2 * sw;
    R(P(x25, y27), P(x25 + sw, y27 - sh), P(x25 + sw, y27 + sh), c15);
  }
  // offsets 975..1209
  for (let i29 = 0; i29 < 2; i29++) {
    x25 = x21 - 2 * i29 * sw;
    y27 = y21 + 4 * sh;
    R(P(x25, y27), P(x25 + sw, y27 - sh), P(x25 + sw, y27 + sh), c5, c4, c4);
  }
  for (let i29 = 0; i29 < 2; i29++) {
    x25 = x21 + (6 * i29 - 4) * sw;
    y27 = y21 + 4 * sh;
    const fill = i29 === 0 ? c4 : c5;
    const edge = i29 === 0 ? c5 : c4;
    R(P(x25, y27), P(x25 + sw, y27 - sh), P(x25 + sw, y27 + sh), fill, edge, edge);
  }
  // offsets 1209..1395
  x25 = x21 - 4 * sw;
  y27 = y21 + 6 * sh;
  R(P(x25, y27), P(x25, y27 - 2 * sh), P(x25 + sw, y27 + sh), c11, c5, c5);
  for (let i29 = 0; i29 < 3; i29++) {
    x25 += 2 * sw;
    R(P(x25, y27), P(x25, y27 - 2 * sh), P(x25 + sw, y27 + sh), c10, c4, c4);
  }
  // offsets 1395..1518, then 1518..1594
  x25 = x21 - 5 * sw;
  y27 = y21 + 5 * sh;
  for (let i29 = 0; i29 < 3; i29++) {
    x25 += 2 * sw;
    R(P(x25, y27), P(x25, y27 + 2 * sh), P(x25 + sw, y27 - sh), c8, c4, c4);
  }
  x25 += 2 * sw;
  R(P(x25, y27), P(x25, y27 + 2 * sh), P(x25 + sw, y27 - sh), c8, c4, c4);
  // offsets 1594..1718
  x25 = x21 - 5 * sw;
  y27 = y21 + 7 * sh;
  for (let i29 = 0; i29 < 3; i29++) {
    x25 += 2 * sw;
    R(P(x25, y27), P(x25 + sw, y27 - sh), P(x25 + sw, y27 + sh), c15, c4, c4);
  }
  // offsets 1718..1842
  x25 = x21 - 4 * sw;
  y27 = y21 + 8 * sh;
  for (let i29 = 0; i29 < 2; i29++) {
    x25 += 2 * sw;
    R(P(x25, y27), P(x25 + sw, y27 - sh), P(x25 + sw, y27 + sh), c5, c4, c4);
  }
  // offsets 1842..2323
  x25 = x21 - 2 * sw;
  x25 = x21; // the original overwrites its own assignment
  y27 = y21 + 10 * sh;
  R(P(x25, y27), P(x25, y27 - 2 * sh), P(x25 + sw, y27 + sh), c10, c4, c4);
  x25 = x21 - 2 * sw;
  R(P(x25, y27), P(x25, y27 - 2 * sh), P(x25 + sw, y27 + sh), c11, c4, c5);
  x25 = x21;
  R(P(x25, y27), P(x25, y27 - 2 * sh), P(x25 - sw, y27 + sh), c7, c4, c5);
  x25 = x21 + 2 * sw;
  R(P(x25, y27), P(x25, y27 - 2 * sh), P(x25 - sw, y27 + sh), c8, c4, c5);
  x25 = x21;
  y27 = y21 + 12 * sh;
  R(P(x25, y27), P(x25 + sw, y27 - sh), P(x25 - sw, y27 - sh), c15, c4, c6);
  return out;
}

function coreDraw(angle, n, trans, width, height) {
  return C.faces(C.start({ angle, n, trans }), width, height).map((f) => {
    const c = (v) => v && [v.grey, v.alpha];
    return JSON.stringify([
      f.pts.map((p) => [Math.round(p[0]), Math.round(p[1])]),
      c(f.fill), c(f.farEdge), c(f.nearEdge),
    ]);
  });
}

{
  let configs = 0, mismatches = 0, first = null;
  for (const [width, height] of SIZES) {
    for (const angle of allAngles) {
      for (const n of allNs) {
        for (const trans of allTrans) {
          const a = coreDraw(angle, n, trans, width, height);
          const b = appletDraw(angle, n, trans, width, height);
          configs++;
          if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
            mismatches++;
            if (!first) first = { angle, n, trans, width, height, a, b };
          }
        }
      }
    }
  }
  check(`${configs} configurations: the core matches the bytecode transcription face by face`,
    mismatches === 0);
  if (first) console.error("first mismatch", first);
}

/* ------------------------------------- 4. the invariant behind the illusion */

{
  const s = C.start({});
  const fs2 = C.faces(s, 400, 300);
  equal("Draw() always paints 33 rhombi", fs2.length, 33);
  let allParallelograms = true;
  for (const f of fs2) {
    const [a, b, d, c] = f.pts;
    if (Math.abs(d[0] - (c[0] + b[0] - a[0])) > 1e-9 ||
        Math.abs(d[1] - (c[1] + b[1] - a[1])) > 1e-9) allParallelograms = false;
  }
  check("every painted face is the rhombus DrawRombus constructs", allParallelograms);

  // The sliders change size and transparency, never the face list or order.
  let topology = true;
  for (const angle of allAngles) {
    for (const n of allNs) {
      for (const trans of allTrans) {
        const list = C.faces(C.start({ angle, n, trans }), 400, 300);
        if (list.length !== 33) topology = false;
        if (list.some((f, i) => f.fill.grey !== fs2[i].fill.grey)) topology = false;
      }
    }
  }
  check("no slider ever adds, removes or recolours (in grey) a face", topology);

  // Count the diamond faces. In an oblique cube drawing a rhombus can be the
  // top of one cube and a side of another: this is what lets a viewer count
  // the same drawing as seven cubes or as eight.
  const m = C.metrics(s, 400, 300);
  const unit = (p) => [Math.round(((p[0] - m.cx) / m.w) * 2), Math.round(((p[1] - m.cy) / m.h) * 2)];
  const setKey = (pts) => pts.map(unit).sort((p, q) => p[0] - q[0] || p[1] - q[1])
    .map((p) => p.join(",")).join("|");
  const diamonds = [], sides = [];
  fs2.forEach((f, i) => {
    const [a, b, d, c] = f.pts;
    const ab = [(b[0] - a[0]) / m.w, (b[1] - a[1]) / m.h];
    const ac = [(c[0] - a[0]) / m.w, (c[1] - a[1]) / m.h];
    const near = (v) => Math.abs(Math.abs(v) - 1) < 0.01;
    const diag = near(ab[0]) && near(ab[1]) && near(ac[0]) && near(ac[1]);
    (diag ? diamonds : sides).push({ i, key: setKey(f.pts) });
  });
  equal("15 diamond faces (tops or bottoms) and 18 side faces", [diamonds.length, sides.length], [15, 18]);

  // A side face shared by two cubes in different readings: rhombus 16 is the
  // left face hanging below the diamond at (-1, 4) and the right face rising
  // above the diamond at (-2, 7). Either reading of the same ink is possible.
  const sidesByKey = new Map(sides.map((s) => [s.key, s.i]));
  const diamondAt = fs2.map((f) => {
    const [a, b, d] = f.pts;
    return [Math.round(((a[0] + d[0]) / 2 - m.cx) / m.w), Math.round(((a[1] + d[1]) / 2 - m.cy) / m.h)];
  });
  const pt = (x, y) => [m.cx + x * m.w, m.cy + y * m.h];
  const leftBelow = (u, v) => setKey([pt(u - 1, v), pt(u, v + 1), pt(u, v + 3), pt(u - 1, v + 2)]);
  const rightAbove = (u, v) => setKey([pt(u + 1, v), pt(u, v - 1), pt(u, v - 3), pt(u + 1, v - 2)]);
  const i16 = sidesByKey.get(leftBelow(-1, 4));
  const i16Again = sidesByKey.get(rightAbove(-2, 7));
  check("the page's ambiguity is real: one rhombus is a face in two different cube readings",
    i16 === 16 && i16Again === 16);
  check("the two readings name two different diamonds, so the count can change by one",
    diamondAt[12].join() === "-1,4" && diamondAt[23].join() === "-2,7");

  // The angle really does turn the projection, and N really is a scale.
  const a15 = C.metrics(C.start({ angle: 15 }), 400, 300);
  const a60 = C.metrics(C.start({ angle: 60 }), 400, 300);
  check("a larger Angle makes the picture narrower and steeper",
    Math.abs(a60.w) < Math.abs(a15.w) && a60.h > a15.h);
  check("N changes the scale but not the number of faces",
    C.faces(C.start({ n: 10 }), 400, 300).length === 33 &&
    C.metrics(C.start({ n: 10 }), 400, 300).pixel < C.metrics(C.start({ n: 2 }), 400, 300).pixel);
  check("Trans changes alphas but never a coordinate", (() => {
    const a = C.faces(C.start({ trans: -127 }), 400, 300);
    const b = C.faces(C.start({ trans: 127 }), 400, 300);
    return a.every((f, i) => f.pts.every((p, j) => p[0] === b[i].pts[j][0] && p[1] === b[i].pts[j][1]));
  })());
}

done("cube7-cube8");
