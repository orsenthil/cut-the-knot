#!/usr/bin/env node
"use strict";

/*
 * Logic test for contrast-4/contrast-4-core.js.
 *
 *   node porting/check-contrast-4.mjs
 *
 * Section 1 pins the applet's five scrollbar ranges and its opening picture.
 * Section 2 is a second, literal transcription of Contrast4Canvas.Draw (both
 * fillRect loops and the float->grey conversion of SetGrayColor) and compares
 * every rectangle in drawing order over all 66 x 106 width/height settings,
 * plus every value of each of the three colour scrollbars.
 * Section 3 tests the page's claims exhaustively: all six patches are one
 * shade, the upper three and lower three make a six-piece bar, the patches
 * are taller than wide in the opening picture, and the dark/light average is
 * the opening grey. Section 4 checks the edge values and the board handle.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("contrast-4/contrast-4-core.js", "Contrast4Core");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the applet's opening scrollbar values", [s.w, s.h, s.gray, s.min, s.max], [50, 50, 50, 0, 100]);
  equal("the applet is 400 by 400", [s.width, s.height], [400, 400]);
  check("an illustration has nothing to win", !("result" in s));
  equal("the opening greys", C.colors(s), { dark: "#000000", light: "#ffffff", patch: "#808080" });
  equal("the opening bands are 22 units wide", C.geometry(s).bandWidth, 22);
  equal("the opening patches are 72 units tall", C.geometry(s).patchHeight, 72);
  equal("the six bands start at x = 134", C.geometry(s).left, 134);
  check("the status speaks only of what is drawn", /all the same grey/.test(C.describe(s)));
}

/* ------------------------------------------- 2. a second bytecode reading */

/* SetGrayColor: new Color(v / 100.0f, v / 100.0f, v / 100.0f). */
function paint(v) {
  const part = Math.fround(v / 100);
  const byteFloat = Math.fround(Math.fround(part * 255) + 0.5);
  const byte = Math.min(255, Math.max(0, Math.trunc(byteFloat)));
  return "#" + byte.toString(16).padStart(2, "0").repeat(3);
}

/*
 * Draw's local slots, re-entered from the javap listing without using the
 * core. S10 in the first loop is the band index; S10b/S11 are the two patch
 * rows; S12 is the patch half-height. Rectangles are listed in paint order.
 */
function bytecodeDraw(s) {
  const S3 = 6;
  const S4 = Math.round(((s.height * 2) / 3) * (s.w / 100) / S3);
  const S5 = S4 * S3;
  const S6 = (s.width - S5) / 2;
  const S7 = 20;
  const S8 = s.height - 2 * S7;
  const S9 = S7;
  const dark = paint(s.min), light = paint(s.max), patch = paint(s.gray);
  const out = [];
  for (let S10 = 0; S10 < S3; S10 += 2) {
    out.push({ x: S6 + S10 * S4, y: S9, w: S4, h: S8, fill: dark });
    out.push({ x: S6 + (S10 + 1) * S4, y: S9, w: S4, h: S8, fill: light });
  }
  const S10b = S9 + S8 / 3;
  const S11 = S9 + S8 - S8 / 3;
  const S12 = Math.round((S8 / 2.5) * (s.h / 100) / 2);
  for (let S13 = 0; S13 < S3; S13 += 2) {
    out.push({ x: S6 + S13 * S4, y: S10b - S12, w: S4, h: 2 * S12, fill: patch });
    out.push({ x: S6 + (S13 + 1) * S4, y: S11 - S12, w: S4, h: 2 * S12, fill: patch });
  }
  return out;
}

/** The core's rectangles in exactly the same order, for a direct comparison. */
function coreDraw(s) {
  const g = C.geometry(s);
  const col = C.colors(s);
  return [
    ...g.bands.map((b) => ({
      x: b.x, y: b.y, w: b.w, h: b.h, fill: b.dark ? col.dark : col.light,
    })),
    ...g.patches.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h, fill: col.patch })),
  ];
}

{
  let cases = 0, mismatches = 0, first = null;
  for (let w = 40; w <= 105; w++) {
    for (let h = 0; h <= 105; h++) {
      const s = C.start({ w, h });
      const a = coreDraw(s), b = bytecodeDraw(s);
      cases++;
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        mismatches++;
        if (!first) first = { w, h, core: a, bytecode: b };
      }
    }
  }
  check(`all ${cases} width/height settings match the bytecode`, mismatches === 0,
    first ? JSON.stringify(first) : "");

  mismatches = 0;
  cases = 0;
  for (const key of ["gray", "min", "max"]) {
    for (let v = 0; v <= 105; v++) {
      const s = C.start({ [key]: v });
      cases++;
      if (JSON.stringify(coreDraw(s)) !== JSON.stringify(bytecodeDraw(s))) mismatches++;
    }
  }
  check(`all ${cases} colour-scrollbar values match the bytecode`, mismatches === 0);

  let colourMismatch = 0;
  for (let v = 0; v <= 105; v++) {
    if (C.channel(v) !== parseInt(paint(v).slice(1, 3), 16)) colourMismatch++;
  }
  check("all 106 grey channel conversions match", colourMismatch === 0);

  // Mixed colours too: the same arithmetic in different scrollbar positions.
  let mixed = 0;
  for (let min = 0; min <= 100; min += 5) {
    for (let max = min; max <= 100; max += 5) {
      for (const gray of [0, 25, 50, 75, 100]) {
        const s = C.start({ min, max, gray });
        if (JSON.stringify(coreDraw(s)) !== JSON.stringify(bytecodeDraw(s))) mixed++;
      }
    }
  }
  check("mixed dark/light/patch settings match the bytecode", mixed === 0, `${mixed} mismatches`);
}

/* ------------------------------------------------------- 3. the page's claims */

{
  const s = C.start({});
  const g = C.geometry(s);
  check("the page says six rectangles, and there are six patches", g.patches.length === 6);
  check("three patches sit high and three sit low",
    g.patches.filter((p) => p.row === "upper").length === 3 &&
    g.patches.filter((p) => p.row === "lower").length === 3);
  equal("the patch rows are at y = 104 and y = 224",
    [g.patches[0].y, g.patches[1].y], [104, 224]);
  check("the six patches form one unbroken bar across the bands",
    g.patches.every((p, i) => i === 0 || p.x === g.patches[i - 1].x + g.patches[i - 1].w));
  check("each patch is taller than it is wide in the opening picture",
    g.patches.every((p) => p.h > p.w));
  check("patches on dark bands touch light neighbours and vice versa",
    g.patches.every((p) => {
      const neighbours = [g.bands[p.band - 1], g.bands[p.band + 1]].filter(Boolean);
      return neighbours.some((b) => b.dark !== g.bands[p.band].dark);
    }));
  check("the opening grey lies between the dark and the light grey",
    C.colors(s).dark < C.colors(s).patch && C.colors(s).patch < C.colors(s).light);
}

{
  let different = 0, badRows = 0, badStack = 0, outside = 0, cases = 0;
  for (let w = 40; w <= 105; w++) {
    for (let h = 0; h <= 105; h++) {
      for (const [gray, min, max] of [[50, 0, 100], [17, 5, 95], [105, 0, 100]]) {
        const s = C.start({ w, h, gray, min, max });
        const g = C.geometry(s);
        const col = C.colors(s);
        cases++;
        if (g.patches.some((p) => col.patch !== col.patch)) different++;
        if (g.patches.filter((p) => p.row === "upper").length !== 3 ||
            g.patches.filter((p) => p.row === "lower").length !== 3) badRows++;
        if (g.left < 0 || g.left + g.bandWidth * 6 > s.width) badStack++;
        if (g.patches.some((p) => p.y < 0 || p.y + p.h > s.height)) outside++;
      }
    }
  }
  check(`all ${cases} configurations keep one shade on all six patches`, different === 0);
  check("the three high and three low patches survive every setting", badRows === 0);
  check("the six-band stack always fits inside the picture", badStack === 0);
  check("patches never spill outside the picture", outside === 0);
}

{
  // The page's averaging remark: with the default 0 and 100, the perceived
  // bar's shade is 50, which is exactly the patch grey the applet paints.
  check("the default dark/light average is the patch scrollbar value",
    C.averageShade(C.start({})) === C.start({}).gray);
  let wrong = 0, cases = 0;
  for (let min = 0; min <= 100; min++) {
    for (let max = min; max <= 100; max++) {
      if ((min + max) % 2 !== 0) continue;
      const avg = (min + max) / 2;
      const s = C.start({ min, max, gray: avg });
      cases++;
      const col = C.colors(s);
      const darkByte = parseInt(col.dark.slice(1, 3), 16);
      const lightByte = parseInt(col.light.slice(1, 3), 16);
      const patchByte = parseInt(col.patch.slice(1, 3), 16);
      if (Math.abs(patchByte - (darkByte + lightByte) / 2) > 0.5) wrong++;
    }
  }
  check(`the averaging claim holds for all ${cases} equal-step dark/light pairs`, wrong === 0);
  check("the six pieces are counted lengthwise, not as three",
    C.geometry(C.start({ h: 105 })).patches.length === 6);
}

/* ------------------------------------------- 4. ranges, edges and the handle */

{
  for (const [key, lo, hi] of [
    ["w", 40, 105], ["h", 0, 105], ["gray", 0, 105], ["min", 0, 105], ["max", 0, 105],
  ]) {
    const low = C.setOption(C.start({}), key, lo - 100);
    const high = C.setOption(C.start({}), key, hi + 100);
    check(`${key} stops at its lower scrollbar bound`, low[key] === lo);
    check(`${key} stops at its upper scrollbar bound`, high[key] === hi);
  }
  const s = C.start({});
  check("scrollbars take whole numbers only", C.setOption(s, "w", 52.6).w === 53);
  check("an unknown option is ignored", C.setOption(s, "nonsense", 9) === s);
  check("an unchanged option keeps the same position", C.setOption(s, "h", 50) === s);
  check("H = 0 draws patches of zero height", C.geometry(C.start({ h: 0 })).patchHeight === 0);
  check("W = 40 keeps the narrowest six-band stack", C.geometry(C.start({ w: 40 })).left === (400 - 6 * 18) / 2);
  check("W = 105 keeps the widest six-band stack", C.geometry(C.start({ w: 105 })).bandWidth === 47);
  check("values above 100 saturate instead of throwing", C.colors(C.start({ min: 105 })).dark === "#ffffff");
}

{
  const s = C.start({});
  let wrong = 0;
  for (let i = 0; i < 6; i++) {
    if (C.select(s, C.patchCenter(s, i)).selected !== i) wrong++;
  }
  check("the handle snaps to the centre of each of the six patches", wrong === 0);
  const centers = C.geometry(s).patches.map((p) => p.x + p.w / 2);
  check("a point between patches chooses the nearer one",
    C.select(s, { x: (centers[0] + centers[1]) / 2, y: 104 }).selected === 0);
  check("a dragged point far right chooses the last patch",
    C.select(s, { x: 400, y: 224 }).selected === 5);
  check("selection changes no colour or geometry",
    JSON.stringify(C.colors(C.select(s, { x: 400, y: 224 }))) === JSON.stringify(C.colors(s)));
}

done("contrast-4");
