#!/usr/bin/env node
"use strict";

/*
 * Logic test for contrast-ii/contrast-ii-core.js.
 *
 * What is checked, over every one of the 9 x 101 option pairs at six canvas
 * sizes (5,454 configurations, about 700,000 rectangles):
 *
 *   1. The option ranges and opening values are the applet's own: the N
 *      scrollbar is Scrollbar(0, 8, 2, 2, 12), so values 2..10 starting at 8;
 *      the Part scrollbar is Scrollbar(0, 75, 5, 0, 105), so 0..100 at 75.
 *   2. A second transcription of ContrastIICanvas.Draw(), written straight
 *      from javap's bytecode with the original slot names, agrees with the
 *      core on every rectangle: position, side and colour.
 *   3. The page's claim "There is of course no difference in the colors":
 *      both grids are painted with one and the same foreground token, on a
 *      flat background, at every setting.
 *   4. At the page's opening Part = 75 the small squares are strictly larger
 *      than the big ones for every N and canvas size, which is the setting
 *      behind "small white squares appear whiter ... small black squares
 *      appear blacker".
 *   5. The Kitaoka claim: for every N and canvas size there is a Part at
 *      which the two side lengths differ by at most one pixel and the
 *      foreground covers roughly half the drawn square.
 *   6. Grid counts, bounds, clamping and the Switch colors checkbox.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("contrast-ii/contrast-ii-core.js", "ContrastIiCore");

const SIZES = [[360, 360], [400, 440], [300, 300], [240, 200], [120, 120], [800, 600]];
const NS = Array.from({ length: C.MAX_N - C.MIN_N + 1 }, (_, i) => C.MIN_N + i);
const PARTS = Array.from({ length: C.MAX_PART + 1 }, (_, i) => i);
const configurations = [];
for (const [width, height] of SIZES) {
  for (const n of NS) {
    for (const part of PARTS) configurations.push(C.start({ n, part, width, height }));
  }
}

/* ----------------------------------------------------------- 1. the options */

{
  const s = C.start();
  equal("the N scrollbar starts at 8", s.n, 8);
  equal("the Part scrollbar starts at 75", s.part, 75);
  equal("the checkbox starts unchecked, so black squares on white", s.swapped, false);
  equal("the board starts at the applet's width 360", s.width, 360);
  equal("the board starts square", s.height, 360);
  equal("N cannot go below the scrollbar minimum 2", C.withOption(s, "n", -4).n, 2);
  equal("N cannot go above 12 - visible 2 = 10", C.withOption(s, "n", 99).n, 10);
  equal("Part cannot go below 0", C.withOption(s, "part", -1).part, 0);
  equal("Part cannot go above 105 - visible 5 = 100", C.withOption(s, "part", 900).part, 100);
  equal("an unknown option leaves the position alone", C.withOption(s, "other", 7).n, 8);
  equal("Switch colors flips only the colour roles", C.switchColors(C.switchColors(s)).swapped, false);
  equal("Switch colors keeps the geometry", C.switchColors(s).part, 75);
  const g = C.layout(s);
  equal("inset is min(width, height) - 20", g.side, 340);
  equal("the drawn square is centred", g.x0, 10);
}

/* -------------- 2. a second transcription of ContrastIICanvas.Draw() ------ */

/** Java Math.round(double) and Math.round(float) for the positive values here. */
const javaRound = (x) => Math.floor(x + 0.5);
const javaRoundFloat = (x) => Math.floor(Math.fround(x) + 0.5);

/**
 * Literal bytecode transcription: S3=min-20, S4/S5=centring, S6=step,
 * S8=small side, S9/S11=spans, S13/S14=gaps, S15=round gapX/2,
 * S18/S19 and S20/S21=grid points, S22/S23=big square centres.
 */
function appletDraw(N, Part, width, height) {
  const S3 = Math.min(width, height) - 20;
  const S4 = Math.trunc((width - S3) / 2);
  const S5 = Math.trunc((height - S3) / 2);
  const S6 = (S3 * Part) / 100 / N;
  const S8 = javaRound(S6);
  const S9 = width - 2 * S4 - S6;
  const S11 = height - 2 * S5 - S6;
  const S13 = javaRound(S9 / (N - 1) - S8) + 1;
  const S14 = javaRound(S11 / (N - 1) - S8) + 1;
  const S15 = javaRoundFloat(S13 / 2);
  const small = [];
  for (let S16 = 0; S16 < N; S16++) {
    for (let S17 = 0; S17 < N; S17++) {
      const S18 = javaRound(S4 + (S9 * S16) / (N - 1));
      const S19 = javaRound(S5 + (S11 * S17) / (N - 1));
      small.push([S18, S19, S8]);
    }
  }
  const big = [];
  for (let S18b = 0; S18b < N - 1; S18b++) {
    for (let S19b = 0; S19b < N - 1; S19b++) {
      const S20 = javaRound(S4 + (S9 * S18b) / (N - 1));
      const S21 = javaRound(S5 + (S11 * S19b) / (N - 1));
      const S22 = S20 + S8 + Math.trunc(S13 / 2);
      const S23 = S21 + S8 + Math.trunc(S14 / 2);
      big.push([S22 - S15, S23 - S15, 2 * S15 - 1]);
    }
  }
  return { small: small, big: big };
}

{
  let mismatches = 0, first = null;
  for (const state of configurations) {
    const drawn = C.squares(state);
    const expected = appletDraw(state.n, state.part, state.width, state.height);
    for (const [kind, a, b] of [["small", drawn.small, expected.small], ["big", drawn.big, expected.big]]) {
      if (a.length !== b.length) { mismatches++; continue; }
      for (let k = 0; k < a.length; k++) {
        const got = [a[k].x, a[k].y, a[k].size];
        if (got.some((v, i) => v !== b[k][i])) {
          mismatches++;
          if (!first) first = { kind, k, state, got, expected: b[k] };
        }
      }
    }
  }
  check(`${configurations.length} configurations: Draw's second transcription matches exactly`,
    mismatches === 0, `${mismatches} mismatches, first ${JSON.stringify(first)}`);
}

/* --------------------------------------- 3. counts, bounds and one colour */

{
  let badCount = 0, badBound = 0, badColour = 0;
  for (const state of configurations) {
    const p = C.squares(state);
    if (p.small.length !== state.n * state.n) badCount++;
    if (p.big.length !== (state.n - 1) * (state.n - 1)) badCount++;
    const colours = new Set([...p.small, ...p.big].map((r) => r.colour));
    if (colours.size !== 1 || !colours.has(C.INK)) badColour++;
    for (const r of [...p.small, ...p.big]) {
      if (r.x < 0 || r.y < 0 || r.x + r.size > state.width || r.y + r.size > state.height) badBound++;
    }
  }
  check(`${configurations.length} configurations: an N x N grid and an (N-1) x (N-1) grid`, badCount === 0, String(badCount));
  check(`${configurations.length} configurations: no difference in the colours`, badColour === 0, String(badColour));
  check(`${configurations.length} configurations: every square lies on the board`, badBound === 0, String(badBound));
}

/* ------------------------- 4. the opening Part = 75 claim ----------------- */

{
  let notBigger = 0, smallestGap = Infinity;
  for (const [width, height] of SIZES) {
    for (const n of NS) {
      const g = C.layout(C.start({ n, part: 75, width, height }));
      smallestGap = Math.min(smallestGap, g.small - g.bigSide);
      if (!(g.small > g.bigSide)) notBigger++;
    }
  }
  check("at Part 75 the small squares are bigger at every N and canvas size",
    notBigger === 0, `${notBigger} failures, smallest gap ${smallestGap}`);
}

/* --------------------- 5. nearly equal squares / Kitaoka ------------------ */

{
  let noNearPair = 0, poorCoverage = 0, total = 0;
  const examples = [];
  for (const [width, height] of SIZES) {
    for (const n of NS) {
      total++;
      let best = null;
      for (const part of PARTS) {
        const state = C.start({ n, part, width, height });
        const g = C.layout(state);
        const diff = Math.abs(g.small - g.bigSide);
        if (diff > 1) continue;
        const cover = C.coverage(state);
        if (!best || Math.abs(cover - 0.5) < Math.abs(best.cover - 0.5)) best = { part, diff, cover };
      }
      if (!best) { noNearPair++; continue; }
      if (!(best.cover >= 0.45 && best.cover <= 0.65)) poorCoverage++;
      if (examples.length < 3 && width === 360) examples.push(`N=${n}: Part ${best.part}, cover ${best.cover.toFixed(3)}`);
    }
  }
  check(`${total} N/size pairs: a Part makes the two side lengths equal or one pixel apart`,
    noNearPair === 0, String(noNearPair));
  check(`${total} N/size pairs: at that Part the ink covers about half the field`,
    poorCoverage === 0, String(poorCoverage));
  check("the small and big grids can be exactly the same size",
    C.layout(C.start({ n: 8, part: 53 })).small === C.layout(C.start({ n: 8, part: 53 })).bigSide);
  check("the page's start is well away from that equal case",
    Math.abs(C.layout(C.start()).small - C.layout(C.start()).bigSide) >= 15);
  console.log(`     examples of nearly equal squares: ${examples.join("; ")}`);
}

/* ---------------------------------- 6. states are plain data -------------- */

{
  const a = C.start({ n: 5, part: 40, swapped: true });
  const b = C.withOption(a, "n", 6);
  equal("withOption does not mutate its argument", a.n, 5);
  equal("the changed copy carries the other options", [b.n, b.part, b.swapped], [6, 40, true]);
  const swapped = C.switchColors(a);
  equal("Switch colors does not mutate its argument", a.swapped, true);
  equal("Switch colors toggles back", C.switchColors(swapped).swapped, true);
  check("the whole position is JSON-safe plain data", JSON.stringify(a).length > 0);
  check("claims() reports one colour and the enlarged small squares",
    C.claims(C.start()).oneColour === true && C.claims(C.start()).smallBiggerAtStart === true);
}

done("contrast-ii");
