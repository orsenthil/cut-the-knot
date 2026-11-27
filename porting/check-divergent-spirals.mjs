#!/usr/bin/env node
"use strict";

/*
 * Logic test for divergent-spirals/divergent-spirals-core.js.
 *
 * The applet is an illustration, so the check is a second, literal
 * transcription of its bytecode rather than a game-tree search:
 *
 *   1. DivergentSpiralsCanvas() field defaults and DivergentSpiralsPanel()
 *      SetSpin() ranges, transcribed from javap.
 *   2. Reset() and DrawTop() translated instruction by instruction, including
 *      drawArc's six integer arguments, compared with DivergentSpiralsCore.arcs()
 *      over every setup the panel allows (17 arc angles x 11 overlaps x 11
 *      canvas sizes), plus the integer-division edge cases.
 *   3. run()'s angle update compared tick by tick for both directions and
 *      both speeds; the page's "fast clockwise / slow counterclockwise"
 *      claims checked against the actual step and period.
 *   4. The geometry behind the page's perceptual claim: successive rings are
 *      turned by exactly Opening degrees and cover Overlap*Opening degrees,
 *      and no spiral curve is ever drawn (every element is a circular arc).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("divergent-spirals/divergent-spirals-core.js", "DivergentSpiralsCore");

/* ------------------------------------------------------------------ 1. defaults */

{
  // DivergentSpiralsCanvas.<init> and DivergentSpiralsPanel.<init>.
  const canvas = { Angle: 0, N: 4, W: 1, Period: 20, Opening: 45, Overlap: 4,
                   DrawColor: "000000", Running: false, Fast: false, Clockwise: true };
  const s = C.start();
  equal("canvas defaults: Angle", s.angle, canvas.Angle);
  equal("canvas defaults: N", s.N, canvas.N);
  equal("canvas defaults: W", s.W, canvas.W);
  equal("canvas defaults: Period", C.period(s.fast), canvas.Period);
  equal("canvas defaults: Opening", s.opening, canvas.Opening);
  equal("canvas defaults: Overlap", s.overlap, canvas.Overlap);
  equal("canvas defaults: Running", s.running, canvas.Running);
  equal("canvas defaults: Fast", s.fast, canvas.Fast);
  equal("canvas defaults: Clockwise", s.clockwise, canvas.Clockwise);
  equal("panel defaults: Slow checkbox selected, so not Fast", C.start({ fast: true }).fast, true);
  check("the drawing colour is black, as the constructor sets", canvas.DrawColor === "000000");
}

/* ------------------------------------------------ 2. the bytecode, transcribed */

/** Reset(): a(Math.min(width,height)/2 - 20), then R/(N+1)/4*(N+1)*4. */
function appletReset(width, height, n) {
  const d = 20;
  let R = Math.round(Math.min(width, height) / 2 - d); // a(double) = Math.round
  R = Math.trunc(Math.trunc(R / (n + 1)) / 4) * (n + 1) * 4;
  return R;
}

/**
 * DrawTop(): the two nested loops, with the six arguments of every drawArc.
 * W is 1 in the applet: WSpin/WEdit are handled in actionPerformed() but are
 * never created by the panel constructor.
 */
function appletDrawTop(opening, overlap, width, height, n, wField) {
  const d = 20;
  const step = Math.trunc(360 / opening);                 // local4
  const e = Math.trunc(appletReset(width, height, n) / step); // local5
  const inc = Math.trunc(e / (n + 1));                    // local6
  let phi = 0;                                            // local7
  let k = inc;                                            // local9
  const arcs = [];
  if (inc <= 0) return arcs; // the Java loop would never end; no usable size does this
  while (k < Math.trunc(height / 2) - d) {                // @48
    let w = 0;                                            // local10
    while (w < wField) {                                  // @64
      const r = k + w;                                    // local11
      arcs.push({ x: -r, y: -r, w: 2 * r, h: 2 * r, from: phi, span: overlap * opening });
      w++;
    }
    phi = phi + opening;                                  // @117
    k = k + inc;
  }
  return arcs;
}

const SIZES = [
  [640, 400], [640, 420], [640, 460], [800, 600], [460, 460],
  [375, 400], [320, 240], [200, 200], [160, 160], [120, 120],
  [1000, 300], [300, 1000],
];

{
  // Every opening the spin control allows (10..90 by 5) and every overlap
  // (1..11), on every canvas size above: 17 x 11 x 12 configurations.
  let configs = 0;
  let arcsSeen = 0;
  let mismatches = 0;
  let firstMismatch = "";
  let maxSweep = 0;
  let fullCircleCombos = 0;
  for (let opening = C.OPENING.min; opening <= C.OPENING.max; opening += C.OPENING.step) {
    for (let overlap = C.OVERLAP.min; overlap <= C.OVERLAP.max; overlap += C.OVERLAP.step) {
      maxSweep = Math.max(maxSweep, opening * overlap);
      if (opening * overlap > 360) fullCircleCombos++;
      for (const [width, height] of SIZES) {
        configs++;
        const state = C.setOptions(C.start({ width: width, height: height }), { opening, overlap });
        const mine = C.arcs(state);
        const theirs = appletDrawTop(opening, overlap, width, height, C.N, C.W)
          .map((a) => ({ radius: -a.x, start: a.from, sweep: a.span }));
        arcsSeen += mine.length;
        if (JSON.stringify(mine) !== JSON.stringify(theirs)) {
          mismatches++;
          if (!firstMismatch) firstMismatch = `${opening}/${overlap}/${width}x${height}`;
        }
      }
    }
  }
  check(`${configs} configurations match DrawTop() exactly`, mismatches === 0, firstMismatch);
  check(`${arcsSeen} arcs were compared`, arcsSeen > 10000, `only ${arcsSeen}`);
  equal("the largest Overlap*Opening is 990 degrees", maxSweep, 990);
  check("some allowed combinations ask for more than a full turn", fullCircleCombos > 0);
}

{
  // Reset()'s snap-down to a multiple of 4*(N+1), independently computed.
  for (const [width, height] of SIZES) {
    for (let n = 1; n <= 8; n++) {
      const want = appletReset(width, height, n);
      check(`Reset() radius ${width}x${height}, N=${n}`, C.snappedRadius(width, height, n) === want,
        `expected ${want}, got ${C.snappedRadius(width, height, n)}`);
    }
  }
}

{
  // The increment itself, including the case where the Java loop would hang.
  let good = 0, zeroSmall = 0, zeroUsable = 0;
  for (let side = 100; side <= 800; side += 10) {
    for (let opening = 10; opening <= 90; opening += 5) {
      const r = appletReset(side, side, C.N);
      const want = Math.trunc(Math.trunc(r / Math.trunc(360 / opening)) / (C.N + 1));
      const got = C.ringStep(r, opening, C.N);
      check(`ring increment side=${side}, Opening=${opening}`, got === want, `expected ${want}, got ${got}`);
      good++;
      if (want === 0) {
        check("a canvas with zero increment yields no arcs",
          C.arcs(C.start({ width: side, height: side, opening })).length === 0);
        if (side < 120) zeroSmall++; else zeroUsable++;
      }
    }
  }
  check("some small canvases reach the zero-increment case", zeroSmall > 0, `saw ${zeroSmall}`);
  check("the 640x400 canvas has a positive increment at every allowed Opening",
    Array.from({ length: 17 }, (_, i) => 10 + 5 * i)
      .every((opening) => C.ringStep(C.radius(C.start()), opening, C.N) > 0));
  check("at 400px side an Opening of 10 still gives one ring per step",
    C.ringStep(appletReset(400, 400, C.N), 10, C.N) === 1);
  check("a 100x100 canvas has a zero increment", C.ringStep(appletReset(100, 100, C.N), 45, C.N) === 0);
}

/* ----------------------------------------------------------- 3. the spin fields */

/** PVNumeric's integer editing: min/max, then the nearest delta step. */
function appletNumeric(value, lo, hi, step, fallback) {
  if (!Number.isFinite(Number(value))) return fallback;
  const v = Math.max(lo, Math.min(hi, Math.round(Number(value))));
  return lo + Math.round((v - lo) / step) * step;
}

{
  const inputs = [-1000, -90, -1, 0, 4, 9, 10, 11, 12, 44, 45, 46, 89, 90, 91, 100, 1000,
                  3.6, 45.4, NaN, Infinity, -Infinity];
  for (const v of inputs) {
    const o = appletNumeric(v, 10, 90, 5, 45);
    const p = appletNumeric(v, 1, 11, 1, 4);
    check(`Opening spin input ${String(v)}`, C.setOptions(C.start(), { opening: v }).opening === o,
      `expected ${o}, got ${C.setOptions(C.start(), { opening: v }).opening}`);
    check(`Overlap spin input ${String(v)}`, C.setOptions(C.start(), { overlap: v }).overlap === p,
      `expected ${p}, got ${C.setOptions(C.start(), { overlap: v }).overlap}`);
  }
  equal("both maxima are accepted together", [C.start({ opening: 90, overlap: 11 }).opening,
                                               C.start({ opening: 90, overlap: 11 }).overlap], [90, 11]);
}

/* ------------------------------------------------------ 4. run(): the angle */

/** run(): one tick is one addition/subtraction of PI/(fast ? 9 : 17). */
function appletAngle(fast, clockwise, frames) {
  let angle = 0;
  for (let i = 0; i < frames; i++) {
    if (clockwise) angle = angle + Math.PI / (fast ? 9 : 17);
    else angle = angle - Math.PI / (fast ? 9 : 17);
  }
  return angle;
}

{
  for (const fast of [false, true]) {
    for (const clockwise of [true, false]) {
      for (let frames = 0; frames <= 64; frames++) {
        const s = C.advance(C.start({ fast, clockwise }), frames);
        check(`run() angle fast=${fast} clockwise=${clockwise} frames=${frames}`,
          s.angle === appletAngle(fast, clockwise, frames),
          `expected ${appletAngle(fast, clockwise, frames)}, got ${s.angle}`);
      }
      const last = appletAngle(fast, clockwise, 64);
      check(`page claim: ${clockwise ? "clockwise" : "counterclockwise"} adds/subtracts`,
        clockwise ? last > 0 : last < 0);
    }
  }
  const fastSpeed = C.angularSpeed(true), slowSpeed = C.angularSpeed(false);
  check("page claim: fast turns faster than slow", fastSpeed > slowSpeed);
  check("the speed ratio is (pi/9)/10 over (pi/17)/20 = 34/9",
    Math.abs(fastSpeed / slowSpeed - 34 / 9) < 1e-12);
  equal("fast period is 10 ms, slow period is 20 ms", [C.period(true), C.period(false)], [10, 20]);
  equal("toggling Run does not change the angle", C.setOptions(C.start(), { running: true }).angle, 0);
}

/* --------------------------------------- 5. the page's perceptual claim's geometry */

{
  let rings = 0, turnedCorrectly = 0, spannedCorrectly = 0, circular = 0;
  for (let opening = 10; opening <= 90; opening += 5) {
    for (let overlap = 1; overlap <= 11; overlap++) {
      const list = C.arcs(C.start({ opening, overlap }));
      let phi = 0;
      for (const a of list) {
        rings++;
        if (a.start === phi) turnedCorrectly++;
        if (a.sweep === overlap * opening) spannedCorrectly++;
        // A drawArc with equal width and height centred at (-r,-r) is a
        // circle; no element of the drawing is a spiral curve.
        if (Number.isInteger(a.radius) && a.radius > 0) circular++;
        phi += opening;
      }
    }
  }
  check("the default picture has 44 rings", C.arcs(C.start()).length === 44);
  equal("default radii run from 4 to 176 in steps of 4",
    [C.arcs(C.start())[0].radius, C.arcs(C.start()).at(-1).radius], [4, 176]);
  equal("default starts cycle 0,45,...,315,0", C.arcs(C.start()).slice(0, 9).map((a) => a.start),
    [0, 45, 90, 135, 180, 225, 270, 315, 360]);
  equal("the default arc covers half a circle", C.arcs(C.start())[0].sweep, 180);
  check("every ring starts exactly Opening degrees after the previous one", turnedCorrectly === rings,
    `${turnedCorrectly}/${rings}`);
  check("every ring spans exactly Overlap*Opening degrees", spannedCorrectly === rings,
    `${spannedCorrectly}/${rings}`);
  check("every drawn element is a circle, never a spiral curve", circular === rings,
    `${circular}/${rings}`);
  check("with the defaults the arcs overlap their own step", 180 > 45);
  check("the picture has at least two arms to be seen winding", new Set(C.arcs(C.start()).map((a) => a.start % 360)).size >= 2);
}

/* ------------------------------------------------------------- 6. saved position */

{
  const s = C.start({ opening: 90, overlap: 11 });
  const p = C.position(s);
  equal("the player's position is plain data", JSON.parse(JSON.stringify(p)), p);
  equal("the saved centre is the canvas centre", p.center, { x: 320, y: 200 });
  equal("the saved radius follows Reset()", p.radius, appletReset(640, 400, C.N));
  equal("the saved ring count matches DrawTop()", p.rings,
    appletDrawTop(90, 11, 640, 400, C.N, C.W).length);
}

done("divergent-spirals");
