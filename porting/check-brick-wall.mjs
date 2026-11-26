#!/usr/bin/env node
"use strict";

/*
 * Logic test for brick-wall/brick-wall-core.js.
 *
 *   node porting/check-brick-wall.mjs
 *
 * The second half of the first section is a literal second transcription of
 * BrickWallCanvas.Draw() and Set*, written straight from the bytecode: the
 * same fix-up loop on the first x of a row, the same while (x < width) brick
 * loop, the same colour flip, and the same nested mortar-line loop. It is
 * compared with the core over the five settings' whole ranges (exhaustively
 * for the small derived functions, and over thousands of configurations for
 * the complete picture).
 *
 * The page says: "The parallel lines do not often look parallel"; shifting
 * alternating brick layers so their vertical joints cross the layer
 * boundaries makes the layers look non-parallel, and the effect disappears as
 * the mortar between layers grows. The first part is a perception claim, so
 * only its geometric setup is testable: the mortar lines are horizontal and
 * equally spaced at every setting, the joints cross when the shift is about
 * half a brick, and the mortar band grows by exactly two pixels per step of
 * the Separation slider.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("brick-wall/brick-wall-core.js", "BrickWallCore");
const CANVAS = { width: 400, height: 300 };

/* ------------------------------ the applet's own computation, transcribed */

function applet(opts, size) {
  let Height = 0, Width = 0, Separation = 0, Shift = 0, DarkColor = 0, LightColor = 0;

  // BrickWallCanvas.SetHeight / SetWidth / SetSeparation / SetShift / SetColors.
  function SetHeight(v) { Height = Math.trunc(size.height * v / 100); }
  function SetWidth(v) { Width = Math.trunc(size.width * v / 100); }
  function SetSeparation(v) { Separation = v; }
  function SetShift(v) { Shift = Math.trunc(Width * v / 100); }
  function SetColors(v) {
    DarkColor = Math.trunc((255 - v) / 2);
    if (DarkColor < 0) DarkColor = 0;
    LightColor = DarkColor + v;
    if (LightColor > 255) LightColor = 255;
  }

  SetHeight(opts.heightPct);
  SetWidth(opts.widthPct);
  SetColors(opts.shadeDiff);
  SetSeparation(opts.separation);
  SetShift(opts.shiftPct);

  // BrickWallCanvas.Draw: staggered rows of alternating bricks, then mortar.
  const bricks = [];
  let y = 0;
  let flag = true;
  while (y < size.height) {
    let x = flag ? Shift : 0;
    while (x > 0) x -= Width;
    x = x < 0 ? x - Width : x;
    let dark = flag;
    while (x < size.width) {
      bricks.push({ x, y, w: Width, h: Height, light: dark });
      x += Width;
      dark = !dark;
    }
    y += Height;
    flag = !flag;
  }
  const mortar = [];
  for (y = Height; y < size.height; y += Height) {
    for (let s = -Separation; s <= Separation; s++) mortar.push(y + s);
  }
  return { Width, Height, Shift, Separation, DarkColor, LightColor, bricks, mortar };
}

const sameLayout = (state, size) => {
  const core = C.layout(state, size);
  const old = applet(state, size);
  return core.width === old.Width && core.height === old.Height &&
    core.shift === old.Shift && core.dark === old.DarkColor &&
    core.light === old.LightColor && core.thickness === 2 * old.Separation + 1 &&
    JSON.stringify(core.bricks) === JSON.stringify(old.bricks) &&
    JSON.stringify(core.mortar.flatMap((b) => b.ys)) === JSON.stringify(old.mortar);
};

/* --------------------------------------------- 1. defaults and slider ranges */

{
  equal("init() uses SetHeight(10), SetWidth(10), ShadeDiff 255, no shift or mortar",
    C.start(), C.DEFAULTS);
  check("every slider has the applet's range", JSON.stringify(C.LIMITS) === JSON.stringify({
    widthPct: [5, 100], heightPct: [5, 100], shiftPct: [0, 99],
    shadeDiff: [0, 255], separation: [0, 10],
  }));
  check("out-of-range values are clamped, not accepted", (() => {
    const s = C.start({ widthPct: 500, heightPct: -4, shiftPct: 1000, shadeDiff: -9, separation: 99 });
    return s.widthPct === 100 && s.heightPct === 5 && s.shiftPct === 99 &&
      s.shadeDiff === 0 && s.separation === 10;
  })());
  check("withSetting returns a new position and leaves the old one alone", (() => {
    const s = C.start(), n = C.withSetting(s, "shiftPct", 50);
    return s.shiftPct === 0 && n.shiftPct === 50 && n.widthPct === s.widthPct;
  })());
  check("an unknown setting is ignored", C.withSetting(C.start(), "bogus", 7).bogus === undefined);
  check("an illustration has no win or loss", C.result(C.start()) === null);
}

/* ------------------- 2. derived quantities, over their whole parameter space */

{
  let ok = true;
  for (let width = 1; width <= 300; width++) {
    for (let shift = 0; shift <= 900; shift++) {
      let x = shift;
      while (x > 0) x -= width;
      if (x < 0) x -= width;
      if (C.startX(shift, width) !== x) { ok = false; break; }
    }
    if (!ok) break;
  }
  check("startX matches the applet's two-loop fix-up for all widths 1..300 and shifts 0..900", ok);
}

{
  let ok = true;
  for (let v = 0; v <= 255; v++) {
    const d = C.shades(C.start({ shadeDiff: v }));
    let dark = Math.trunc((255 - v) / 2);
    if (dark < 0) dark = 0;
    let light = dark + v;
    if (light > 255) light = 255;
    if (d.dark !== dark || d.light !== light) { ok = false; break; }
  }
  check("SetColors' grey levels match for all 256 shade differences", ok);
}

{
  const sizes = [{ width: 400, height: 300 }, { width: 375, height: 280 },
    { width: 120, height: 80 }, { width: 900, height: 600 }, { width: 101, height: 73 }];
  let ok = true, cases = 0;
  for (const size of sizes) {
    for (let w = 5; w <= 100; w++) {
      for (let h = 5; h <= 100; h++) {
        const s = C.start({ widthPct: w, heightPct: h, shiftPct: 47 });
        const m = C.metrics(s, size);
        const oldWidth = Math.trunc(size.width * w / 100);
        const oldHeight = Math.trunc(size.height * h / 100);
        const oldShift = Math.trunc(oldWidth * 47 / 100);
        if (m.width !== oldWidth || m.height !== oldHeight || m.shift !== oldShift) { ok = false; break; }
        cases++;
      }
    }
  }
  check(`metrics matches SetWidth/SetHeight/SetShift on ${cases} size x percentage cases`, ok);
}

/* ------------------------ 3. the whole drawing, against the bytecode second */

{
  const base = C.start();
  const named = [
    {}, { shiftPct: 50 }, { shiftPct: 99 }, { separation: 10 },
    { widthPct: 5 }, { widthPct: 100 }, { heightPct: 5 }, { heightPct: 100 },
    { shadeDiff: 0 }, { shadeDiff: 128 }, { widthPct: 5, heightPct: 5, separation: 10, shiftPct: 50 },
    { widthPct: 100, heightPct: 100, separation: 10, shiftPct: 99, shadeDiff: 0 },
  ];
  for (const opts of named) {
    const state = C.start(opts);
    check(`named layout ${JSON.stringify(opts)} matches the applet`, sameLayout(state, CANVAS));
  }
  const rand = rng(2822);
  const sizes = [CANVAS, { width: 375, height: 280 }, { width: 640, height: 211 }, { width: 121, height: 97 }];
  let compared = 0;
  for (let trial = 0; trial < 2400; trial++) {
    const state = C.start({
      widthPct: 5 + Math.floor(rand() * 96),
      heightPct: 5 + Math.floor(rand() * 96),
      shiftPct: Math.floor(rand() * 100),
      shadeDiff: Math.floor(rand() * 256),
      separation: Math.floor(rand() * 11),
    });
    if (!sameLayout(state, sizes[trial % sizes.length])) {
      check(`random configuration ${trial} matches the applet`, false, JSON.stringify(state));
    }
    compared++;
  }
  check(`core and bytecode agree on ${compared} random configurations`, compared === 2400);
  check("the default configuration draws the applet's first picture", sameLayout(base, CANVAS));
}

/* ------------------------------------------- 4. the page's claims, many cases */

{
  const rand = rng(777);
  let tested = 0, crossing = 0;
  for (let trial = 0; trial < 400; trial++) {
    const state = C.start({
      widthPct: 5 + Math.floor(rand() * 96),
      heightPct: 5 + Math.floor(rand() * 96),
      shiftPct: Math.floor(rand() * 100),
      shadeDiff: Math.floor(rand() * 256),
      separation: Math.floor(rand() * 11),
    });
    const size = { width: 120, height: 108 };
    const cl = C.claims(state, size);
    const geometric = ["linesParallel", "alternating", "staggered", "covered",
      "mortarOnBoundaries", "monotonicMortar", "shadesOrdered"];
    if (!geometric.every((k) => cl[k])) {
      check(`trial ${trial}: the geometry is right`, false, `${JSON.stringify(state)} ${JSON.stringify(cl)}`);
    }
    if (cl.joinsCrossRows) crossing++;
    tested++;
  }
  check(`all geometric claims hold on ${tested} configurations`, tested === 400);
  check("the joints cross the row boundaries in many shifted configurations", crossing > 300);
}

{
  const cl = C.claims(C.start({ shiftPct: 0 }), { width: 120, height: 108 });
  check("with no shift the vertical joints line up from row to row", !cl.joinsCrossRows);
  const half = C.claims(C.start({ shiftPct: 50 }), { width: 120, height: 108 });
  check("with a half-brick shift the joints cross the layer boundaries", half.joinsCrossRows);
  check("every mortar line is horizontal, at one fixed y across the wall", half.linesParallel);
  for (let s = 0; s <= 10; s++) {
    const L = C.layout(C.start({ separation: s }), CANVAS);
    check(`Separation ${s} paints ${2 * s + 1} grey lines at each boundary`,
      L.thickness === 2 * s + 1 && L.mortar.every((b) => b.ys.length === 2 * s + 1));
  }
  check("the mortar band grows with every step of the Separation slider",
    C.claims(C.start(), CANVAS).monotonicMortar);
  check("the default greys are the applet's black and white", (() => {
    const L = C.layout(C.start(), CANVAS);
    return L.dark === 0 && L.light === 255;
  })());
  check("equal greys at ShadeDiff 0 leave one flat colour", (() => {
    const L = C.layout(C.start({ shadeDiff: 0 }), CANVAS);
    return L.dark === 127 && L.light === 127;
  })());
  check("shade and mortar change the paint, never the brick positions", (() => {
    const a = C.layout(C.start(), CANVAS);
    const b = C.layout(C.start({ shadeDiff: 0, separation: 10 }), CANVAS);
    return JSON.stringify(a.bricks) === JSON.stringify(b.bricks);
  })());
  check("bricks tile every row and column, with no holes", C.claims(C.start(), CANVAS).covered);
}

done("brick-wall");
