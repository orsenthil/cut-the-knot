#!/usr/bin/env node
"use strict";

/*
 * Logic test for contrast/contrast-core.js.
 *
 *   node porting/check-contrast.mjs
 *
 * Section 1 re-transcribes ContrastCanvas.Draw straight from javap -c,
 * including its truncating int divisions and its Math.round calls, and
 * compares it with the core over the whole scrollbar space: every W, H and
 * Gap (111 * 111 * 81 configurations) and several hundred colour pairs at
 * seven canvas widths, checking every painted column.
 *
 * Section 2 checks the claims on the cut-the-knot page as far as pixels can:
 * the middle shape really has one gray across both bars (all configurations),
 * that gray does not depend on the bar's shape, the gradient keeps even a
 * one-step range, its ends equal the two scrollbar values, and W = H = 110
 * fills the canvas. The "brightness aftereffect" and the eye's impression are
 * perception, not pixel facts, so the test says so rather than pretending to
 * verify them.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("contrast/contrast-core.js", "ContrastCore");

/* ------------------------------------------------ 1. the opening values */

{
  equal("the applet's opening scrollbar values", C.start(),
    { width: 80, height: 20, minColor: 20, maxColor: 235, gap: 0 });
  equal("the five scrollbar ranges from ContrastPanel", C.LIMITS,
    { width: [0, 110], height: [0, 110], minColor: [0, 255], maxColor: [0, 255], gap: [0, 80] });
  check("there are 256 grays, from Color(0/255) to Color(255/255)", C.NGRAYS === 256 &&
    C.gray(0).level === 0 && C.gray(255).level === 1 && C.gray(0).css === "rgb(0, 0, 0)" &&
    C.gray(255).css === "rgb(255, 255, 255)");
  let tableOK = true;
  for (let i = 0; i < 256; i++) {
    const g = C.gray(i);
    if (g.index !== i || Math.abs(g.level - i / 255) > 1e-12) tableOK = false;
  }
  check("every entry of Grays[] has level i/255", tableOK);
  const s = C.start();
  check("changing one option returns a new position", C.option(s, "width", 0) !== s &&
    s.width === 80 && C.option(s, "width", 0).width === 0);
  check("options clamp at both ends of each scrollbar",
    C.option(s, "width", -40).width === 0 && C.option(s, "width", 500).width === 110 &&
    C.option(s, "gap", -9).gap === 0 && C.option(s, "gap", 999).gap === 80 &&
    C.option(s, "minColor", 999).minColor === 255 && C.option(s, "maxColor", -8).maxColor === 0);
}

/* ------------------- 2. Draw() written again from the bytecode -------------- */

/*
 * A direct transcription of the bytecode of ContrastCanvas.Draw(g), with the
 * offscreen image dimensions as arguments. It keeps the applet's order: sort
 * the two colour limits, paint columns 1 .. w-3, then the two fillRects.
 */
function bytecodeDraw(state, w, h) {
  // Fields set by the constructor and copied by adjustmentValueChanged().
  const W = state.width, H = state.height;
  const MinColor = state.minColor, MaxColor = state.maxColor, Gap = state.gap;
  const NGrays = 256;

  // 13-58: if (MinColor < MaxColor) { lo=MinColor, hi=MaxColor }
  //                              else { lo=MaxColor, hi=MinColor }
  const lo = MinColor < MaxColor ? MinColor : MaxColor;
  const hi = MinColor < MaxColor ? MaxColor : MinColor;

  // 60-74: double d = (hi - lo) / (size.width - 4)
  const d = (hi - lo) / (w - 4);

  // 76-136: for (i = 1; i < size.width - 2; i++)
  //   int c = (int) Math.round((i - 1) * d + lo);
  //   g.setColor(Grays[c]); g.drawLine(i, 1, i, size.height - 1);
  const lines = [];
  for (let i = 1; i < w - 2; i++) {
    const c = Math.floor((i - 1) * d + lo + 0.5); // Java Math.round(double)
    lines.push({ x1: i, y1: 1, x2: i, y2: h - 1, index: c });
  }

  // 139-218: int i7..i13, all Java integer (truncating) divisions.
  const i7 = Math.trunc(w * W / 100);
  const i8 = Math.trunc(h * H / 100);
  const i9 = Math.trunc(i7 * Gap / 100);
  const i10 = Math.trunc((w - i7) / 2);
  const i11 = Math.trunc((h - i8) / 2);
  const i12 = Math.trunc((i7 - i9) / 2);
  const i13 = i7 - i9 - i12;

  // 220-235: Grays[Math.round((float)((lo+hi)/2))], where /2 is int division.
  const barIndex = Math.round(Math.trunc((lo + hi) / 2));

  // 239-268: the two fillRects.
  const rects = [
    { x: i10, y: i11, w: i12, h: i8, index: barIndex },
    { x: i10 + i12 + i9, y: i11, w: i13, h: i8, index: barIndex },
  ];
  return { lo, hi, d, lines, rects, i7, i8, i9, i10, i11, i12, i13, barIndex, NGrays };
}

{
  const s = C.start();
  const j = bytecodeDraw(s, 500, 300);
  const c = C.compute(s, 500, 300);
  check("the opening gradient has 497 painted columns at 500px", j.lines.length === 497 &&
    c.columns.length === j.lines.length);
  check("the opening bar is 400 by 60, centred, with a 200/200 split",
    j.i7 === 400 && j.i8 === 60 && j.i9 === 0 && j.i10 === 50 && j.i11 === 120 &&
    j.i12 === 200 && j.i13 === 200);
  equal("the core's opening rectangles match the bytecode", c.pieces, j.rects);
  check("the opening bar gray is Grays[127] on both pieces",
    j.barIndex === 127 && c.barIndex === 127 &&
    c.pieces[0].index === 127 && c.pieces[1].index === 127);

  let same = j.lines.length === c.columns.length;
  let worst = 0;
  for (let i = 0; i < j.lines.length && same; i++) {
    if (j.lines[i].x1 !== c.columns[i].x || j.lines[i].index !== c.columns[i].index) same = false;
    worst = Math.max(worst, Math.abs(j.lines[i].index - c.columns[i].index));
  }
  check("the opening gradient columns match the bytecode exactly", same, `worst index gap ${worst}`);
}

/* ---------------- 3. all W, H and Gap, against the bytecode ---------------- */

{
  let cases = 0, bad = 0;
  for (let W = 0; W <= 110; W++) {
    for (let H = 0; H <= 110; H++) {
      for (let gap = 0; gap <= 80; gap++) {
        const s = { width: W, height: H, minColor: 20, maxColor: 235, gap };
        const j = bytecodeDraw(s, 500, 300);
        const c = C.geometry(s, 500, 300);
        cases++;
        if (c.barW !== j.i7 || c.barH !== j.i8 || c.gap !== j.i9 ||
            c.x !== j.i10 || c.y !== j.i11 || c.barIndex !== j.barIndex ||
            JSON.stringify(c.pieces) !== JSON.stringify(j.rects)) bad++;
      }
    }
  }
  check(`${cases} W/H/Gap configurations: geometry identical to the bytecode`, bad === 0, `${bad} bad`);
  check("the exhaustive grid really covers every scrollbar value",
    cases === 111 * 111 * 81);
}

/* ------------- 4. colour pairs and canvas widths, column by column ---------- */

{
  const widths = [5, 6, 20, 101, 302, 500, 777];
  const pairs = [
    [20, 235], [235, 20], [120, 121], [0, 255], [255, 0], [8, 8],
    [0, 1], [254, 255], [3, 252], [77, 200],
  ];
  for (let k = 0; k < 120; k++) {
    const a = (k * 73 + 17) % 256;
    const b = (k * 131 + 5) % 256;
    pairs.push([a, b]);
  }
  let columns = 0, bad = 0, badGeo = 0;
  for (const w of widths) {
    for (const [a, b] of pairs) {
      const s = { width: 63, height: 47, minColor: a, maxColor: b, gap: 31 };
      const j = bytecodeDraw(s, w, 300);
      const c = C.compute(s, w, 300);
      if (c.lo !== j.lo || c.hi !== j.hi || c.barIndex !== j.barIndex ||
          JSON.stringify(c.pieces) !== JSON.stringify(j.rects)) badGeo++;
      for (let i = 0; i < j.lines.length; i++) {
        columns++;
        if (c.columns[i].x !== j.lines[i].x1 || c.columns[i].index !== j.lines[i].index ||
            c.columns[i].index < 0 || c.columns[i].index > 255) bad++;
      }
    }
  }
  check("910 colour/width configurations: sorted limits and bars match bytecode", badGeo === 0, `${badGeo} bad`);
  check(`${columns} painted columns: every index matches the bytecode and stays in Grays[]`,
    bad === 0, `${bad} bad`);
}

/* --------------------------- 5. the page's claims --------------------------- */

{
  // "the middle shape is painted uniformly throughout": both fillRects, for
  // every option combination, carry exactly the one bar gray.
  let cases = 0, bad = 0;
  for (let a = 0; a <= 255; a += 3) {
    for (let b = 0; b <= 255; b += 9) {
      for (let W = 0; W <= 110; W += 5) {
        for (let H = 0; H <= 110; H += 10) {
          for (const gap of [0, 17, 40, 80]) {
            const s = { width: W, height: H, minColor: a, maxColor: b, gap };
            const f = C.geometry(s, 500, 300);
            cases++;
            const expected = C.gray(Math.trunc((Math.min(a, b) + Math.max(a, b)) / 2));
            const p = f.pieces;
            if (p.length !== 2) bad++;
            if (p[0].index !== expected.index || p[1].index !== expected.index) bad++;
            if (f.barIndex !== expected.index) bad++;
            // Check the split against the bytecode once more in a cheap form.
            if (p[0].w + f.gap + p[1].w !== f.barW) bad++;
            if (p[1].x !== p[0].x + p[0].w + f.gap) bad++;
            if (p[0].y !== p[1].y || p[0].h !== p[1].h) bad++;
          }
        }
      }
    }
  }
  check(`${cases} configurations: both bars share one gray and the gap splits them exactly`,
    bad === 0, `${bad} bad`);
}

{
  // "almost independently of the relative shape of the bar(s)": the bar's
  // gray depends only on the two colour scrollbars, never on W, H or Gap.
  let bad = 0;
  for (let W = 0; W <= 110; W++) {
    for (let H = 0; H <= 110; H++) {
      for (let gap = 0; gap <= 80; gap += 4) {
        const s = { width: W, height: H, minColor: 20, maxColor: 235, gap };
        if (C.geometry(s).barIndex !== 127) bad++;
      }
    }
  }
  check("bar gray stays 127 for all 111 x 111 x 21 shapes", bad === 0, `${bad} bad`);
}

{
  // The gradient's ends: the first and last painted columns are exactly the
  // lower and upper colour scrollbar values, reversed limits included.
  let bad = 0, cases = 0;
  for (let a = 0; a <= 255; a += 5) {
    for (let b = 0; b <= 255; b += 17) {
      for (const w of [5, 17, 500, 777]) {
        const s = { width: 80, height: 20, minColor: a, maxColor: b, gap: 0 };
        const cols = C.columns(s, w);
        const lo = Math.min(a, b), hi = Math.max(a, b);
        cases++;
        if (cols[0].index !== lo || cols[cols.length - 1].index !== hi ||
            cols[0].x !== 1 || cols[cols.length - 1].x !== w - 3) bad++;
        for (let i = 1; i < cols.length; i++) {
          if (cols[i].index < cols[i - 1].index) bad++; // monotone grays
        }
      }
    }
  }
  check(`${cases} gradients: endpoints are the two colour values and grays never dip`,
    bad === 0, `${bad} bad`);
}

{
  // "noticeable even for small ranges of the background gray": a one-step
  // range still paints two distinct grays and ends on the exact values.
  let bad = 0;
  for (let a = 0; a < 255; a++) {
    const cols = C.columns({ width: 80, height: 20, minColor: a, maxColor: a + 1 }, 500);
    const seen = new Set(cols.map((c) => c.index));
    if (cols[0].index !== a || cols[cols.length - 1].index !== a + 1 || seen.size !== 2) bad++;
  }
  check("all 255 one-step ranges still give a two-valued gradient", bad === 0, `${bad} bad`);
  const normal = C.start(), reversed = { ...normal, minColor: 235, maxColor: 20 };
  check("swapping MinColor and MaxColor reverses the gradient, not the bar gray",
    C.columns(reversed)[0].index === 20 &&
    C.columns(reversed)[496].index === 235 &&
    C.geometry(reversed).barIndex === C.geometry(normal).barIndex);
}

{
  // "The bar could be made to fill the entire drawing area." The scrollbars
  // reach W = H = 110, which overflows the 500 x 300 board; clipped to the
  // board the bar covers every pixel, gap 0.
  const full = { width: 110, height: 110, minColor: 20, maxColor: 235, gap: 0 };
  const f = C.geometry(full);
  check("W = H = 110 makes a 550 x 330 bar centred over the whole board",
    f.x === -25 && f.y === -15 && f.x + f.barW >= 500 && f.y + f.barH >= 300);
  check("the full-board bar clips to one continuous area when Gap = 0",
    f.pieces[0].x <= 0 && f.pieces[1].x + f.pieces[1].w >= 500 &&
    f.pieces[0].y <= 0 && f.pieces[0].y + f.pieces[0].h >= 300 && f.gap === 0);
  const empty = { ...full, width: 0, height: 0 };
  const e = C.geometry(empty);
  check("W = H = 0 gives a zero-size bar with no NaN",
    e.barW === 0 && e.barH === 0 && e.pieces.every((p) => p.w === 0 && p.h === 0) &&
    Number.isFinite(e.x) && Number.isFinite(e.y));
}

{
  // The probe is an addition to the applet's five scrollbars, but it reads
  // only the painted columns: dragging it never changes the picture.
  const s = C.start();
  const f = C.compute(s);
  let bad = 0;
  for (let x = 1; x <= 499; x++) {
    const g = C.grayAt(s, x);
    if (g.index < f.lo || g.index > f.hi) bad++;
  }
  check("probe readings stay inside the painted gray range at every x", bad === 0, `${bad} bad`);
  check("probe at the left edge reads Grays[20], at the right edge Grays[235]",
    C.grayAt(s, 1).index === 20 && C.grayAt(s, 499).index === 235);
  let nonMono = 0;
  let previous = -1;
  for (let x = 1; x <= 499; x++) {
    const g = C.grayAt(s, x).index;
    if (g < previous) nonMono++;
    previous = g;
  }
  check("probe readings never go backwards across the gradient", nonMono === 0);
  check("the status line names the single bar gray and the probe gray",
    /Both bars are gray 127 all over/.test(C.describe(s, f, { x: 250 })) &&
    /background gray 12\d/.test(C.describe(s, f, { x: 250 })));
}

done("contrast");
