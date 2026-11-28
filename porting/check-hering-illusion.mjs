#!/usr/bin/env node
"use strict";

/*
 * Logic test for hering-illusion/hering-illusion-core.js.
 *
 *   node porting/check-hering-illusion.mjs
 *
 * The second half is a literal second transcription of HeringIllusionCanvas's
 * constructor and Draw(g), written from `javap -c -p`: the guarded
 * `i = 0..N` fan loop with 3.0*Width/N and Math.round, then the two
 * `w = -Width..Width` blue-line loops with int division for (Height-Diff)/2.
 * It is compared call for call with the core over the whole set of scrollbar
 * values on the page's canvas (46 x 196 x 29 = 261,496 pictures), plus every
 * fan count on four other canvas sizes.
 *
 * The cut-the-knot page makes no numerical claim. Its statements are that the
 * figure was discovered by Ewald Hering in the 19th century, that Orbison is a
 * variant and Wundt produces an inverted effect, and that the viewer sees the
 * straight lines as bowed. None of those is decidable from bytecode; what is
 * decidable — and checked here for every configuration — is that nothing in
 * the drawing bends: the fan aims at the middle and the blue lines stay
 * horizontal and equally spaced.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("hering-illusion/hering-illusion-core.js", "HeringIllusionCore");

/* --------------------- the applet's own Draw(g), transcribed a second time */

function appletCalls(n, diff, thick, cw, ch) {
  // Constructor: N=25, Diff=80, Width=3. The three scrollbars then set them.
  const out = [];
  if (n !== 0) {
    // double d = 3.0 * Width / N, with Width here the canvas width.
    const d = 3.0 * cw / n;
    for (let i = 0; i <= n; i++) {
      out.push({ kind: "ray", i,
        x1: Math.floor(-cw + d * i + 0.5), y1: 0,
        x2: Math.floor(2 * cw - d * i + 0.5), y2: ch });
    }
  }
  // int y0 = (Height - Diff) / 2  (Java int division truncates towards zero).
  const y0 = Math.trunc((ch - diff) / 2);
  for (let w = -thick; w <= thick; w++) {
    out.push({ kind: "bandTop", j: w,
      x1: 0, y1: y0 + w, x2: cw, y2: y0 + w });
  }
  for (let w = -thick; w <= thick; w++) {
    out.push({ kind: "bandBottom", j: w,
      x1: 0, y1: ch - y0 + w, x2: cw, y2: ch - y0 + w });
  }
  return out;
}

const signature = (calls) => calls.map((c) =>
  `${c.kind}:${c.x1},${c.y1},${c.x2},${c.y2}`).join("|");

/* --------------------------------------------- 1. defaults, ranges, no game */

{
  equal("the constructor's defaults are N=25, Diff=80, Width=3", C.start(), C.DEFAULTS);
  equal("the scrollbar ranges exclude visibleAmount from each maximum", C.RANGES, {
    n: { min: 0, max: 45, visible: 5, scrollMax: 50, start: 25 },
    diff: { min: 0, max: 195, visible: 5, scrollMax: 200, start: 80 },
    width: { min: 1, max: 29, visible: 1, scrollMax: 30, start: 3 },
  });
  equal("out-of-range and fractional scrollbar values are clamped and truncated",
    C.start({ n: 900, diff: -12.9, width: 0 }), { n: 45, diff: 0, width: 1 });
  check("unknown options leave the defaults alone", (() => {
    const s = C.start({ n: undefined, diff: undefined, width: undefined, extra: 4 });
    return s.n === 25 && s.diff === 80 && s.width === 3 && !("extra" in s);
  })());
  check("withSetting changes a copy and never the position it was given", (() => {
    const s = C.start();
    const t = C.withSetting(s, "diff", 195);
    return s.diff === 80 && t.diff === 195 && t.n === s.n && t.width === s.width;
  })());
  check("withSetting clamps past either end, like AWT does", (() => {
    return C.withSetting(C.start(), "n", -4).n === 0 &&
      C.withSetting(C.start(), "n", 999).n === 45 &&
      C.withSetting(C.start(), "width", 0).width === 1 &&
      C.withSetting(C.start(), "width", 30).width === 29;
  })());
  check("the illustration has no win and no loss", C.result(C.start()) === null &&
    C.result(C.start({ n: 0, diff: 0, width: 29 })) === null);
  check("N=0 draws no fan lines at all (and never divides by zero)",
    C.layout(C.start({ n: 0 }), { width: 480, height: 300 }).counts.rays === 0);
  check("N>0 draws N+1 fan lines: the bytecode loop is i <= N",
    C.layout(C.start({ n: 25 }), { width: 480, height: 300 }).counts.rays === 26);
  check("Width=1 still draws three lines in each blue bundle", (() => {
    const L = C.layout(C.start({ width: 1 }), { width: 480, height: 300 });
    return L.counts.top === 3 && L.counts.bottom === 3;
  })());
  check("Diff=0 makes the two blue bundles overlap exactly", (() => {
    const cl = C.claims(C.start({ diff: 0 }), { width: 480, height: 300 });
    return cl.bundlesOverlap && cl.bandGap === 0;
  })());
  check("an odd Diff on a 300-high canvas leaves a one-pixel larger gap", (() => {
    const cl = C.claims(C.start({ diff: 81 }), { width: 480, height: 300 });
    return cl.bandGap === 82 && cl.expectedGap === 82;
  })());
  check("the handle sits on the middle line of the top blue bundle", (() => {
    const canvas = { width: 480, height: 300 };
    const s = C.start({ diff: 28 });
    const p = C.handlePoint(s, canvas);
    const L = C.layout(s, canvas);
    return p.x === 456 && p.y === L.y0 && L.top[L.thickness].y1 === p.y;
  })());
  check("dragging the handle back to a line gives an even Diff, one more for odd", (() => {
    const canvas = { width: 480, height: 300 };
    const even = C.diffFromY(C.handlePoint(C.start({ diff: 80 }), canvas).y, canvas);
    const odd = C.diffFromY(C.handlePoint(C.start({ diff: 81 }), canvas).y, canvas);
    return even === 80 && odd === 82;
  })());
  check("dragging to either extreme reaches the scrollbar ends", (() => {
    const canvas = { width: 480, height: 300 };
    return C.diffFromY(150, canvas) === 0 &&
      C.diffFromY(52, canvas) === 195 &&
      C.diffFromY(-999, canvas) === 195 &&
      C.diffFromY(999, canvas) === 0;
  })());
}

/* ----------------- 2. every drawing call, against the bytecode transcription */

{
  const sizes = [
    { width: 480, height: 300 }, // the port's board
    { width: 320, height: 240 },
    { width: 375, height: 281 },
    { width: 500, height: 300 }, // the original page's applet box
    { width: 900, height: 900 },
  ];
  const ui = sizes[0];
  let cases = 0, same = true, countsOK = true, straight = true,
    spacing = true, ordered = true, gapOK = true, center480 = true,
    centerOther = true;

  for (const size of sizes) {
    const full = size === ui;
    const diffs = full ? Array.from({ length: 196 }, (_, i) => i) : [0, 1, 79, 80, 81, 195];
    const widths = full ? Array.from({ length: 29 }, (_, i) => i + 1) : [1, 3, 29];
    for (let n = 0; n <= 45; n++) {
      for (const diff of diffs) {
        for (const thick of widths) {
          const state = { n, diff, width: thick };
          const L = C.layout(state, size);
          const cl = C.claims(state, size);
          const old = appletCalls(n, diff, thick, size.width, size.height);
          if (signature(L.calls) !== signature(old)) {
            if (same) console.error(`  first drawing mismatch at ${JSON.stringify({ state, size })}`);
            same = false;
          }
          if (L.calls.length !== old.length) countsOK = false;
          if (!cl.straightRays || !cl.straightBands || !cl.noCurves) straight = false;
          if (!cl.equalSpacing) spacing = false;
          if (!cl.fanEndsOrdered) ordered = false;
          if (cl.bandGap !== cl.expectedGap || cl.bandGap < 0) gapOK = false;
          if (size === ui ? cl.maxCenterError !== 0 : cl.maxCenterError > 1) {
            if (size === ui) center480 = false; else centerOther = false;
          }
          if (cl.rayCount !== (n === 0 ? 0 : n + 1) || cl.bandLines !== 2 * thick + 1) countsOK = false;
          cases++;
        }
      }
    }
  }

  check(`core and bytecode make the same ${cases} pictures, drawLine by drawLine`, same);
  check(`fan and bundle counts match the loops in all ${cases} pictures`, countsOK);
  check("every drawn line is straight, horizontal or upright, in every picture", straight);
  check("the blue lines stay exactly one unit apart in every picture", spacing);
  check("fan ends fan outwards in increasing i in every picture", ordered);
  check("the two blue bundles are Diff apart (rounded by Java int division)", gapOK);
  check("on the 480-wide board every fan line hits the exact middle", center480);
  check("on other board widths rounding moves the crossing by at most one pixel", centerOther);
}

/* -------------------------- 3. the page's claims, as far as code can check */

{
  const canvas = { width: 480, height: 300 };
  check("changing the number of fan lines never bends a blue line", (() => {
    const a = C.layout(C.start({ n: 1 }), canvas).top;
    const b = C.layout(C.start({ n: 45 }), canvas).top;
    return JSON.stringify(a) === JSON.stringify(b);
  })());
  check("changing the blue bundles never moves a fan line", (() => {
    const a = C.layout(C.start({ diff: 0, width: 1 }), canvas).rays;
    const b = C.layout(C.start({ diff: 195, width: 29 }), canvas).rays;
    return JSON.stringify(a) === JSON.stringify(b);
  })());
  check("the first and last fan lines join opposite top and bottom corners", (() => {
    const L = C.layout(C.start({ n: 25 }), canvas);
    const first = L.rays[0], last = L.rays[L.rays.length - 1];
    return first.x1 === -480 && first.x2 === 960 &&
      last.x1 === 960 && last.x2 === -480;
  })());
  check("fan lines cross the middle even with the smallest non-zero N", (() => {
    const cl = C.claims(C.start({ n: 1 }), canvas);
    return cl.maxCenterError === 0 && cl.rayCount === 2;
  })());
  check("the picture is the same at the two ends of the width scrollbar", (() => {
    const a = C.layout(C.start({ width: 1 }), canvas).rays;
    const b = C.layout(C.start({ width: 29 }), canvas).rays;
    return JSON.stringify(a) === JSON.stringify(b);
  })());
  check("the page's visible picture fits the original 500x300 aspect closely", (() => {
    const L = C.layout(C.start(), canvas);
    return L.canvas.width / L.canvas.height === 1.6 &&
      L.center.x === 240 && L.center.y === 150;
  })());
  check("no state can produce a win, a loss or a finished play", (() => {
    for (const n of [0, 25, 45]) {
      for (const diff of [0, 80, 195]) {
        for (const width of [1, 3, 29]) {
          if (C.result({ n, diff, width }) !== null) return false;
        }
      }
    }
    return true;
  })());
}

done("hering-illusion");
