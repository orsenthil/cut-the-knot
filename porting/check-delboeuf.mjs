#!/usr/bin/env node
"use strict";

/*
 * Logic test for delboeuf/delboeuf-core.js.
 *
 *   node porting/check-delboeuf.mjs
 *
 * Section 2 re-transcribes DelboeufCanvas.Draw / DrawOval / GetColor /
 * ProrateColor straight from `javap -c -p`, including Java's truncating int
 * divisions and Math.round, and compares every fill rectangle, guide line and
 * colour with the core over the whole scrollbar space: all MR x DR x WR at
 * four canvas sizes, all CI, all Ci, and a CI x Ci sweep.
 *
 * Section 3 checks the page's claim: the two coloured circles really are
 * equal in size, one lies inside a bigger ring and the other contains a
 * smaller one. The claim about how they *look* is perception, not pixels, so
 * the test says so rather than pretending to measure an impression.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("delboeuf/delboeuf-core.js", "DelboeufCore");

/* ------------------------------------------- 1. the applet's opening values */

{
  equal("the five opening scrollbar values from DelboeufCanvas.init", C.start(),
    { MR: 50, DR: 10, WR: 10, CI: 255, Ci: 0 });
  equal("the five scrollbar ranges from DelboeufPanel", C.LIMITS, {
    MR: [10, 100], DR: [1, 50], WR: [10, 50], CI: [0, 260], Ci: [-100, 100],
  });
  equal("the live page's fcolor and bcolor parameters", C.PAGE_COLORS,
    { background: "ffffff", foreground: "000000" });
  equal("rgb() reads the applet's hex parameters the same way", C.rgb("c0dcc0"), [192, 220, 192]);
  check("css() writes an rgb colour the SVG can use",
    C.css([12, 34, 56]) === "rgb(12, 34, 56)");

  const s = C.start();
  check("changing one option returns a new position without mutating the old one",
    C.option(s, "MR", 100) !== s && s.MR === 50 && C.option(s, "MR", 100).MR === 100);
  let clamped = true;
  for (const key of C.OPTIONS) {
    const [lo, hi] = C.LIMITS[key];
    if (C.option(s, key, lo - 999)[key] !== lo) clamped = false;
    if (C.option(s, key, hi + 999)[key] !== hi) clamped = false;
  }
  check("every slider clamps at both of the applet's ends", clamped);
  check("an unknown slider is ignored", C.option(s, "nope", 7) === s);
}

/* ------------------- 2. Draw() written again from the bytecode -------------- */

/*
 * A direct transcription of DelboeufCanvas.Draw(g). DrawOval(g, cx, cy, r,
 * thickness, colour) is also copied literally: an outer fillOval of radius
 * r + thickness/2 in `colour`, then an inner fillOval of radius
 * r - thickness/2 in the component's background. Java `/ 2` truncates.
 */
function bytecodeDraw(s, w, h, bgHex = "ffffff", fgHex = "000000") {
  const MR = s.MR, DR = s.DR, WR = s.WR, CI = s.CI, Ci = s.Ci;

  // 5-18: int s3 = Math.round(size.width / 5.0)
  // 19-35: int s4 = Math.round(s3 * MR / 200.0)
  // 36-54: int s5 = Math.round(s4 * WR / 100.0)
  // 55-73: int s6 = Math.round(s4 * DR / 100.0)
  // 75-81: int s7 = size.height / 2
  const s3 = Math.round(w / 5.0);
  const s4 = Math.round(s3 * MR / 200.0);
  const s5 = Math.round(s4 * WR / 100.0);
  const s6 = Math.round(s4 * DR / 100.0);
  const s7 = Math.trunc(h / 2);

  const unpack = (hex) => {
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const foreground = unpack(fgHex);
  const background = unpack(bgHex);

  // GetColor / ProrateColor, copied with the bytecode's Math.round calls.
  const prorate = (c1, amount, c2) => {
    const a = (100 - amount) / 100.0;
    const b = amount / 100.0;
    return [
      Math.round(c1[0] * a + c2[0] * b),
      Math.round(c1[1] * a + c2[1] * b),
      Math.round(c1[2] * a + c2[2] * b),
    ];
  };
  const target = Ci > 0 ? prorate(foreground, Ci, [255, 0, 0])
    : Ci < 0 ? prorate(foreground, -Ci, [0, 0, 255])
      : foreground.slice();

  // DelboeufCanvas.DrawOval(g, x, y, r, thickness, colour).
  const drawOval = (cx, cy, r, thickness, colour) => {
    const half = Math.trunc(thickness / 2);
    return {
      cx, cy, r, thickness,
      outer: {
        x: cx - r - half, y: cy - r - half,
        w: 2 * (r + half), h: 2 * (r + half), colour: colour.slice(),
      },
      inner: {
        x: cx - r + half, y: cy - r + half,
        w: 2 * (r - half), h: 2 * (r - half), colour: background.slice(),
      },
    };
  };

  const leftX = s3 + Math.trunc(s3 / 2);
  const rightX = w - leftX;
  const ovals = [
    drawOval(leftX, s7, s4 + s5 + s6, s5, foreground),   // 89-115
    drawOval(leftX, s7, s4 + s5, s5, target),             // 115-133
    drawOval(rightX, s7, s4 + s5, s5, target),            // 133-156
    drawOval(rightX, s7, s4 - s6 - s5, s5, foreground),   // 156-187
  ];

  // 187-351: if (CI != 255) draw two horizontal lines in a darkened background.
  let band = null;
  if (CI !== 255) {
    const colour = background.map((v) => Math.round(v * CI / 255.0));
    band = {
      x1: 0, y1: s7 - s4 - Math.trunc(s5 / 2) - 1,
      x2: w, y2: s7 + s4 + Math.trunc(s5 / 2),
      colour,
    };
  }
  return { s3, s4, s5, s6, s7, leftX, rightX, ovals, band, foreground, background, target };
}

/** Rebuild the bytecode's fill rectangles from the core's ring description. */
function coreDraw(f) {
  return f.ovals.map((o) => {
    const half = Math.trunc(o.thickness / 2);
    return {
      cx: o.cx, cy: o.cy, r: o.r, thickness: o.thickness,
      outer: {
        x: o.cx - o.r - half, y: o.cy - o.r - half,
        w: 2 * (o.r + half), h: 2 * (o.r + half), colour: f.colors[o.palette],
      },
      inner: {
        x: o.cx - o.r + half, y: o.cy - o.r + half,
        w: 2 * (o.r - half), h: 2 * (o.r - half), colour: f.colors.background,
      },
    };
  });
}

function rectsMatch(coreOvals, byteOvals) {
  if (coreOvals.length !== byteOvals.length) return false;
  for (let i = 0; i < coreOvals.length; i++) {
    const a = coreOvals[i], b = byteOvals[i];
    for (const key of ["cx", "cy", "r", "thickness"]) if (a[key] !== b[key]) return false;
    for (const side of ["outer", "inner"]) {
      const x = a[side], y = b[side];
      for (const field of ["x", "y", "w", "h"]) if (x[field] !== y[field]) return false;
      if (x.colour !== C.css(y.colour)) return false;
    }
  }
  return true;
}

function bandsMatch(coreFrame, byteBand) {
  const band = coreFrame.band;
  if (!byteBand) return band === null;
  return band !== null && band.y1 === byteBand.y1 && band.y2 === byteBand.y2 &&
    C.css(coreFrame.bandRGB) === C.css(byteBand.colour);
}

{
  const s = C.start();
  const j = bytecodeDraw(s, 500, 300);
  const f = C.compute(s);
  equal("the opening s3, s4, s5, s6, mid and two centres match the bytecode",
    [f.unit, f.s4, f.s5, f.s6, f.mid, f.leftX, f.rightX],
    [j.s3, j.s4, j.s5, j.s6, j.s7, j.leftX, j.rightX]);
  check("the opening four rings match every fillOval in the bytecode",
    rectsMatch(coreDraw(f), j.ovals));
  check("the opening picture draws no guide lines (CI = 255)",
    j.band === null && f.band === null && f.colors.band === null);
  check("the two coloured rings are painted with the page's black foreground",
    f.colors.target === "rgb(0, 0, 0)" && C.css(j.target) === f.colors.target);
  check("the opening radii are 31, 28 and 19: equal circles, bigger outside, smaller inside",
    f.ovals[1].r === 28 && f.ovals[2].r === 28 &&
    f.ovals[0].r === 31 && f.ovals[3].r === 19);
  check("every fill rectangle has a non-negative size at the opening values",
    j.ovals.every((o) => o.outer.w >= 0 && o.outer.h >= 0 && o.inner.w >= 0 && o.inner.h >= 0));
}

{
  let cases = 0, badRects = 0, badBand = 0;
  const sizes = [[500, 300], [320, 240], [777, 500], [80, 60]];
  for (const [w, h] of sizes) {
    for (let MR = 10; MR <= 100; MR++) {
      for (let DR = 1; DR <= 50; DR++) {
        for (let WR = 10; WR <= 50; WR++) {
          const s = { MR, DR, WR, CI: 255, Ci: 0 };
          const j = bytecodeDraw(s, w, h);
          const f = C.compute(s, w, h);
          cases++;
          if (!rectsMatch(coreDraw(f), j.ovals)) badRects++;
          if (!bandsMatch(f, j.band)) badBand++;
        }
      }
    }
  }
  check(`${cases} MR x DR x WR x canvas-size configurations: every ring matches the bytecode`,
    badRects === 0, `${badRects} bad`);
  check(`${cases} configurations: the guide lines match too`, badBand === 0, `${badBand} bad`);
  check("the exhaustive grid covers every MR, DR and WR value",
    cases === 91 * 50 * 41 * sizes.length);
}

{
  let bad = 0;
  const bg = [255, 255, 255];
  const fg = [0, 0, 0];
  for (let CI = 0; CI <= 260; CI++) {
    const s = { ...C.start(), CI };
    const j = bytecodeDraw(s, 500, 300);
    const f = C.compute(s, 500, 300, bg, fg);
    if (!bandsMatch(f, j.band)) bad++;
  }
  check("all 261 CI values: guide-line positions and darkened colour match the bytecode", bad === 0, `${bad} bad`);
  const none = C.compute({ ...C.start(), CI: 255 });
  const dark = C.compute({ ...C.start(), CI: 0 });
  check("CI = 255 draws no lines and CI = 0 draws black lines at the circle tangents",
    none.band === null && dark.bandRGB.join(",") === "0,0,0" &&
    dark.band.y1 === 150 - dark.s4 - Math.trunc(dark.s5 / 2) - 1 &&
    dark.band.y2 === 150 + dark.s4 + Math.trunc(dark.s5 / 2) &&
    dark.band.color === "rgb(0, 0, 0)");
}

{
  let bad = 0;
  for (let Ci = -100; Ci <= 100; Ci++) {
    const s = { ...C.start(), Ci };
    const j = bytecodeDraw(s, 500, 300);
    const f = C.compute(s, 500, 300);
    if (C.css(j.target) !== f.colors.target) bad++;
    if (!rectsMatch(coreDraw(f), j.ovals)) bad++;
  }
  check("all 201 Ci values: tint (red for positive, blue for negative) matches the bytecode",
    bad === 0, `${bad} bad`);
  equal("GetColor() reaches pure red at Ci = 100 and pure blue at Ci = -100",
    [C.getColor([0, 0, 0], 100), C.getColor([0, 0, 0], -100), C.getColor([0, 0, 0], 0)],
    [[255, 0, 0], [0, 0, 255], [0, 0, 0]]);
  equal("proration is linear: Ci = 50 gives halfway to red", C.getColor([0, 0, 0], 50), [128, 0, 0]);
}

{
  let bad = 0;
  for (let CI = 0; CI <= 260; CI += 2) {
    for (let Ci = -100; Ci <= 100; Ci += 2) {
      const s = { ...C.start(), CI, Ci };
      const j = bytecodeDraw(s, 500, 300);
      const f = C.compute(s, 500, 300);
      if (!bandsMatch(f, j.band) || C.css(j.target) !== f.colors.target) bad++;
    }
  }
  check("13,251 CI x Ci pairs: tint and guide lines agree with the bytecode", bad === 0, `${bad} bad`);
}

/* ---------------------------- 3. the page's claims -------------------------- */

{
  // "Two equal circles": both coloured rings are painted with the same
  // radius, the same edge width and the same colour, for every option.
  let cases = 0, bad = 0;
  for (let MR = 10; MR <= 100; MR++) {
    for (let DR = 1; DR <= 50; DR++) {
      for (let WR = 10; WR <= 50; WR++) {
        for (const CI of [0, 255, 260]) {
          for (const Ci of [-100, 0, 100]) {
            const f = C.compute({ MR, DR, WR, CI, Ci }, 500, 300);
            const a = f.ovals[1], b = f.ovals[2];
            cases++;
            if (a.r !== b.r || a.thickness !== b.thickness ||
                a.cy !== b.cy || f.colors.target !== f.colors.target ||
                a.palette !== b.palette) bad++;
          }
        }
      }
    }
  }
  check(`${cases} configurations: the two coloured circles are pixel-for-pixel equal`, bad === 0, `${bad} bad`);
  check("the two centres are symmetric about the middle of the board",
    C.geometry(C.start()).leftX === 150 && C.geometry(C.start()).rightX === 350);
}

{
  // The page's exact words: "one inside a bigger circle, the other containing
  // a smaller circle". Check both relations over all size settings. The first
  // relation can fail at tiny DR, where the applet rounds s6 down to zero;
  // the test counts those cases instead of hiding them.
  let bigger = 0, smaller = 0, cases = 0, s6zero = 0, wrongWhenBig = 0;
  for (let MR = 10; MR <= 100; MR++) {
    for (let DR = 1; DR <= 50; DR++) {
      for (let WR = 10; WR <= 50; WR++) {
        const f = C.geometry({ MR, DR, WR, CI: 255, Ci: 0 }, 500, 300);
        cases++;
        if (f.s6 === 0) s6zero++;
        if (f.ovals[0].r > f.ovals[1].r) bigger++;
        else if (f.s6 > 0) wrongWhenBig++;
        if (f.ovals[3].r < f.ovals[2].r) smaller++;
      }
    }
  }
  check(`all ${cases} settings put a smaller circle inside the right one`,
    smaller === cases, `${cases - smaller} failures`);
  check(`the left circle is inside a bigger ring whenever s6 rounds above zero (${cases - s6zero} settings)`,
    bigger === cases - s6zero && wrongWhenBig === 0,
    `${bigger} bigger, ${s6zero} with s6 = 0, ${wrongWhenBig} unexpected`);
  check("the exceptions are exactly the settings where the applet rounds s6 to zero",
    cases - bigger === s6zero && s6zero > 0, `${cases - bigger} vs ${s6zero}`);
  const opening = C.geometry(C.start(), 500, 300);
  check("at the page's opening settings both relations are strict",
    opening.ovals[0].r > opening.ovals[1].r && opening.ovals[3].r < opening.ovals[2].r);
}

{
  // Only MR and WR change the size of the equal circles; DR moves their
  // neighbours, CI their guide lines and Ci their colour.
  let bad = 0;
  for (let DR = 1; DR <= 50; DR++) {
    for (const CI of [0, 130, 255]) {
      for (let Ci = -100; Ci <= 100; Ci += 5) {
        const f = C.geometry({ MR: 50, DR, WR: 10, CI, Ci }, 500, 300);
        if (f.ovals[1].r !== 28 || f.ovals[2].r !== 28) bad++;
      }
    }
  }
  check("DR, CI and Ci never change the equal circles themselves", bad === 0, `${bad} bad`);
  const smallState = { MR: 10, DR: 50, WR: 50, CI: 255, Ci: 0 };
  const small = C.geometry(smallState, 500, 300);
  const large = C.geometry({ MR: 100, DR: 50, WR: 50, CI: 255, Ci: 0 }, 500, 300);
  check("MR and WR do change their common radius", large.ovals[1].r === 75 && small.ovals[1].r === 8);
  // At MR = 10 with DR = WR = 50 the bytecode asks fillOval for a negative
  // width: round(5*50/100) = 3 twice, so 5 - 3 - 3 = -1. Java paints nothing;
  // the SVG page clamps that radius to zero rather than emitting r = -1.
  const negative = bytecodeDraw(smallState, 500, 300).ovals[3];
  check("the bytecode itself requests a negative inner radius at the extreme setting",
    negative.r === -1 && negative.inner.w === -4 && small.ovals[3].r === -1);
  check("the other extreme leaves the inner radius exactly zero",
    large.ovals[3].r === 0 && Number.isFinite(large.ovals[3].r));
}

{
  // The status line reports the measured facts and the probe's nearest ring.
  const f = C.compute(C.start());
  const text = C.describe(C.start(), f, { x: 150, y: 150 });
  check("the status line states the equality and both neighbours in plain numbers",
    /same size: radius 28/.test(text) && /bigger ring of radius 31/.test(text) &&
    /smaller circle of radius 19/.test(text) && /left coloured circle/.test(text));
  check("the probe reads a different ring when moved to the right",
    /right coloured circle/.test(C.describe(C.start(), f, { x: 400, y: 150 })));
  const extremeState = { MR: 10, DR: 50, WR: 50, CI: 255, Ci: 0 };
  const extremeText = C.describe(extremeState, C.compute(extremeState), { x: 150, y: 268 });
  const flatState = { MR: 10, DR: 1, WR: 10, CI: 255, Ci: 0 };
  const flatText = C.describe(flatState, C.compute(flatState), { x: 150, y: 268 });
  check("the status reports a vanished inner circle and a shrunk left ring honestly",
    /bigger ring of radius 11/.test(extremeText) && /has vanished/.test(extremeText) &&
    /shrunk to the same radius 6/.test(flatText));
  // The page's last words are about how the circles *seem*. A pixel test can
  // prove the numbers equal; it cannot measure an impression, and this test
  // does not pretend to.
  check("the page's 'seem to have different sizes' is a claim about seeing, not pixels",
    f.ovals[1].r === f.ovals[2].r && f.ovals[1].palette === f.ovals[2].palette);
}

done("delboeuf");
