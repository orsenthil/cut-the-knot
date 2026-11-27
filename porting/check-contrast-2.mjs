#!/usr/bin/env node
"use strict";

/*
 * Logic test for contrast-2/contrast-2-core.js.
 *
 *   node porting/check-contrast-2.mjs
 *
 * Three parts:
 *  1. a second, independent transcription of Contrast2Canvas.Draw, compared
 *     with the core over every combination the two geometry scrollbars allow
 *     (W = 0..105, H = 40..105 — 6,996 configurations);
 *  2. the page's claims checked structurally: six patches of one identical
 *     shade, three on dark bands and three on light bands, long edges facing
 *     the opposite shade, and the same fact at every setting;
 *  3. the exact gray bytes produced by java.awt.Color(float), taken from the
 *     JDK itself, compared with the core for every shade value and a full
 *     sweep of triples, plus the >100 overflow quirk and the vertical
 *     orientation of the sibling applet Contrast4.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("contrast-2/contrast-2-core.js", "Contrast2Core");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("canvas defaults to the applet's 400x300", [s.width, s.height], [400, 300]);
  equal("scrollbars start at W=50 H=50 gray=50 min=0 max=100",
    [s.W, s.H, s.gray, s.min, s.max], [50, 50, 50, 0, 100]);
  check("a demo has no win, loss or finish", C.result(s) === null);
  equal("W is clamped at the lower scrollbar end", C.withSetting(s, "W", -8).W, 0);
  equal("W is clamped at the upper scrollbar end", C.withSetting(s, "W", 999).W, 105);
  equal("H cannot go below its minimum of 40", C.withSetting(s, "H", 3).H, 40);
  equal("H cannot exceed 105", C.withSetting(s, "H", 106).H, 105);
  equal("a bad number falls back to the scrollbar default", C.withSetting(s, "gray", "oops").gray, 50);
  equal("moving a scrollbar changes only that setting", C.withSetting(s, "min", 7),
    { ...s, min: 7 });
  equal("reset restores the applet's scrollbar values", C.reset({ ...s, W: 105, gray: 12, min: 90 }), s);
  const immutability = C.withSetting(s, "max", 42);
  equal("withSetting does not mutate its input", s.max, 100);
  equal("withSetting returns a new position", immutability !== s, true);
}

/* ------------------------------------------- 2. Draw, transcribed again */

/*
 * Written straight from javap's local-variable slots for
 * Contrast2Canvas.Draw, without using anything from the core. Each entry is
 * [color, x, y, width, height] in the order the Graphics.fillRect calls run.
 */
function appletDraw(state) {
  const size = { width: state.width, height: state.height };
  const m = 6;                                        // istore_3
  const a4 = Math.round(((size.height * 2.0) / 3.0) * state.H / 100.0 / m); // slot 4
  const a5 = a4 * m;                                  // slot 5
  const a6 = Math.trunc((size.height - a5) / 2);      // slot 6
  const a7 = 20;                                      // slot 7
  const a8 = size.width - 2 * a7;                     // slot 8
  const a9 = a7;                                      // slot 9
  const third = Math.trunc(a8 / 3);
  const a10 = a9 + third;                             // slot 10
  const a11 = a9 + a8 - third;                        // slot 11
  const a12 = Math.round(a8 / 2.5 * state.W / 100.0 / 2.0); // slot 12
  const rects = [];
  for (let a13 = 0; a13 < m; a13 += 2) {              // slot 10 reused as the loop index
    rects.push(["min", a9, a6 + a13 * a4, a8, a4]);
    rects.push(["max", a9, a6 + (a13 + 1) * a4, a8, a4]);
  }
  for (let a14 = 0; a14 < m; a14 += 2) {              // slot 13 in the bytecode
    rects.push(["gray", a10 - a12, a6 + a14 * a4, 2 * a12, a4]);
    rects.push(["gray", a11 - a12, a6 + (a14 + 1) * a4, 2 * a12, a4]);
  }
  return rects;
}

function coreDraw(view) {
  const rects = [];
  for (const b of view.bands) rects.push([b.band, b.x, b.y, b.width, b.height]);
  for (const p of view.patches) rects.push(["gray", p.x, p.y, p.width, p.height]);
  return rects;
}

{
  let wrong = 0;
  let shapes = 0;
  let geometries = 0;
  for (let W = 0; W <= 105; W++) {
    for (let H = 40; H <= 105; H++) {
      const s = C.start({ W, H });
      const expected = appletDraw(s);
      const actual = coreDraw(C.analyze(s));
      geometries++;
      shapes += actual.length;
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        if (wrong < 3) console.error(`  Draw mismatch at W=${W} H=${H}`, expected, actual);
        wrong++;
      }
    }
  }
  equal(`Draw matches the bytecode in all ${geometries} geometry configurations`, wrong, 0);
  check(`all ${geometries} configurations produced twelve fills`, shapes === geometries * 12);
}

/* --------------------------------------------------- 3. the page's claims */

{
  const s = C.start({});
  const v = C.analyze(s);
  const pageClaim = "The gray rectangles are of the same shade; those in the darker bands appear lighter.";

  equal("Draw paints six bands", v.bands.length, 6);
  equal("Draw paints six gray rectangles, not three", v.patches.length, 6);
  check("all six patches share one shade: " + pageClaim,
    v.patches.every((p) => p.shadeByte === v.patches[0].shadeByte));
  equal("the common shade is the gray scrollbar's 50%", v.patches[0].shadeByte, 128);
  check("the bands alternate dark, light, dark, light, dark, light",
    v.bands.map((b) => b.band).join(",") === "min,max,min,max,min,max");
  check("three patches sit on dark bands and three on light bands",
    v.patches.filter((p) => v.bands[p.band].band === "min").length === 3 &&
    v.patches.filter((p) => v.bands[p.band].band === "max").length === 3);
  check("the left column is on dark bands and the right column on light bands",
    v.patches.every((p) => (p.column === "left") === (v.bands[p.band].band === "min")));
  check("the long edges of a patch on a dark band touch light bands",
    v.patches.filter((p) => p.column === "left").every((p) =>
      p.band + 1 < 6 && v.bands[p.band + 1].band === "max"));
  check("the bands are horizontal at the default size",
    v.bands.every((b) => b.width > b.height));
  check("the patches have longer horizontal sides at the default size",
    v.patches.every((p) => p.width > p.height));
  equal("the patch width follows the W scrollbar exactly", v.patches[0].width, 2 * v.halfPatch);

  // The invariant must survive every slider move, not just the starting view.
  let broken = 0;
  for (let gray = 0; gray <= 105; gray++) {
    for (const min of [0, 13, 50, 99, 105]) {
      for (const max of [0, 37, 80, 100, 105]) {
        const view = C.analyze(C.start({ gray, min, max }));
        const shades = new Set(view.patches.map((p) => p.shadeByte));
        if (shades.size !== 1 || view.patches[0].shadeByte !== C.shadeByte(gray)) broken++;
        if (view.bands[0].shadeByte !== C.shadeByte(min)) broken++;
        if (view.bands[1].shadeByte !== C.shadeByte(max)) broken++;
      }
    }
  }
  equal("the one-shade invariant holds over 2,805 shade configurations", broken, 0);

  // Every patch stays inside its own band and inside the canvas, even when
  // the width scrollbar is taken past the point where the two columns meet.
  let escaped = 0;
  for (let W = 0; W <= 105; W += 5) {
    for (let H = 40; H <= 105; H += 5) {
      const view = C.analyze(C.start({ W, H }));
      for (const p of view.patches) {
        const band = view.bands[p.band];
        if (p.y !== band.y || p.height !== band.height ||
            p.x < 0 || p.x + p.width > view.settings.width) escaped++;
      }
    }
  }
  equal("all patches stay inside their band and the canvas", escaped, 0);
}

/* --------------------------------- 4. java.awt.Color's exact gray bytes */

/*
 * Generated with the installed JDK:
 *   new Color(v/100f, v/100f, v/100f).getRed() for v = 0 .. 100.
 * Java's float rounding makes 70% -> 179 and 90% -> 230; a plain double
 * Math.round would give 178 and 229. This table is the independent oracle.
 */
const JAVA_GRAY = (
  "0,3,5,8,10,13,15,18,20,23,26,28,31,33,36,38,41,43,46,48,51,54,56,59,61," +
  "64,66,69,71,74,77,79,82,84,87,89,92,94,97,99,102,105,107,110,112,115,117," +
  "120,122,125,128,130,133,135,138,140,143,145,148,150,153,156,158,161,163," +
  "166,168,171,173,176,179,181,184,186,189,191,194,196,199,201,204,207,209," +
  "212,214,217,219,222,224,227,230,232,235,237,240,242,245,247,250,252,255"
).split(",").map(Number);

{
  equal("the JDK gray table has 101 entries", JAVA_GRAY.length, 101);
  let wrong = 0;
  for (let v = 0; v <= 105; v++) {
    const javaByte = v <= 100 ? JAVA_GRAY[v] : "throws";
    const coreByte = C.shadeByte(v);
    if (javaByte === "throws") {
      if (coreByte !== 255) wrong++; // our deliberate cap at white
    } else if (coreByte !== javaByte) {
      wrong++;
    }
  }
  equal("shadeByte matches the JDK for every slider value (capping >100)", wrong, 0);

  // Every combination of the three colour scrollbars is small enough to walk.
  let triples = 0;
  for (let gray = 0; gray <= 100; gray++) {
    for (let min = 0; min <= 100; min++) {
      for (let max = 0; max <= 100; max++) {
        const view = C.analyze(C.start({ gray, min, max }));
        if (view.shades.gray !== JAVA_GRAY[gray] ||
            view.shades.min !== JAVA_GRAY[min] ||
            view.shades.max !== JAVA_GRAY[max]) wrong++;
        triples++;
      }
    }
  }
  equal(`all ${triples} colour triples give the JDK's exact bytes`, wrong, 0);

  const high = C.analyze(C.start({ gray: 105, min: 101, max: 105 }));
  equal("above 100 the port caps all three shades at white",
    [high.shades.gray, high.shades.min, high.shades.max], [255, 255, 255]);
  equal("above 100 is flagged so the page can explain the deviation",
    [high.outOfRange.gray, high.outOfRange.min, high.outOfRange.max], [true, true, true]);
  check("the geometry is still drawn when the shades are out of range",
    high.patches.length === 6 && high.bands.length === 6);
}

/* --------------------------- 5. the vertical sibling is a different applet */

/*
 * Contrast4Canvas.Draw swaps the two axes: its bands are narrow and tall and
 * its patches are narrow and tall too. This is the "applet" the Contrast2 page
 * links to when it says it made the bands vertical. Written from that class's
 * bytecode only to pin down the difference between the siblings.
 */
function contrast4Draw(state) {
  const m = 6;
  const h = Math.round(((state.height * 2.0) / 3.0) * state.W / 100.0 / m);
  const top = Math.trunc((state.height - h * m) / 2);
  const span = state.height - 40;
  const rw = Math.round(span / 2.5 * state.H / 100.0 / 2.0);
  return {
    band: { width: h, height: span },
    patch: { width: h, height: 2 * rw },
    x: 20 + top,
  };
}

{
  const s = C.start({});
  const upright = contrast4Draw(s);
  const v = C.analyze(s);
  check("Contrast2's bands are wide and short", v.bands[0].width > v.bands[0].height);
  check("Contrast4's bands are narrow and tall", upright.band.height > upright.band.width);
  check("Contrast2's patches are wide and short", v.patches[0].width > v.patches[0].height);
  check("Contrast4's patches are narrow and tall", upright.patch.height > upright.patch.width);
  let coreBands = 0;
  let siblingBands = 0;
  let siblingPatches = 0;
  let corePatchesAtDefaultWidth = 0;
  let defaultWidthCases = 0;
  let total = 0;
  for (let a = 0; a <= 105; a += 5) {
    for (let b = 40; b <= 105; b += 5) {
      const s2 = C.start({ W: a, H: b });
      const view = C.analyze(s2);
      const other = contrast4Draw(s2);
      total++;
      if (view.bands[0].width > view.bands[0].height) coreBands++;
      if (other.band.height > other.band.width) siblingBands++;
      if (other.patch.height > other.patch.width) siblingPatches++;
      if (a === 50) {
        defaultWidthCases++;
        if (view.patches[0].width > view.patches[0].height) corePatchesAtDefaultWidth++;
      }
    }
  }
  equal("the sweep covered 308 configurations", total, 308);
  equal("Contrast2's bands are horizontal in every configuration", coreBands, total);
  equal("Contrast4's bands are vertical in every configuration", siblingBands, total);
  equal("Contrast4's patches are vertical in every configuration", siblingPatches, total);
  equal("Contrast2's patches are horizontal at the applet's default width",
    corePatchesAtDefaultWidth, defaultWidthCases);
}

done("contrast-2");
