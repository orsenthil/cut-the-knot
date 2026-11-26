#!/usr/bin/env node
"use strict";

/*
 * Logic test for bertrand/bertrand-core.js.
 *
 *   node porting/check-bertrand.mjs
 *
 * Checked: the three answers on the applet's page (1/3, 1/4, 1/2) over all
 * four values of its SHOULDFIX option, both by exhaustive scans of the option
 * parameters and by 30,000-trial simulations per option. The chord geometry is
 * checked over every pair of 180 angles round the circle and over random
 * midpoints. The last group is a second, literal transcription of the applet's
 * DropLine and RecordTrial bytecodes; the two implementations are compared
 * trial by trial, including how many random numbers each one consumes.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bertrand/bertrand-core.js", "BertrandCore");
const SIDE = Math.sqrt(3);

const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const samePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const seq = (values) => {
  let i = 0;
  return () => values[i++];
};

/* --------------- the applet's own DropLine, straight from the bytecode ---- */

/*
 * bertrandcanvas.DropLine initialises x1,y1,x2,y2 = 0, switches on m_Which
 * (0..3), then calls RecordTrial(x1,y1,x2,y2). Mode 1 consumes a random angle
 * it does not use. Modes 2 and 3 can return before RecordTrial. This is that
 * method written out again, independently of the core.
 */
function appletDropLine(which, u) {
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  if (which === 0) {
    const a = 2 * Math.PI * u(), b = 2 * Math.PI * u();
    x1 = Math.cos(a); y1 = Math.sin(a);
    x2 = Math.cos(b); y2 = Math.sin(b);
  } else if (which === 1) {
    const a = 2 * Math.PI * u(), b = 2 * Math.PI * u();
    x1 = 1; y1 = 0;
    x2 = Math.cos(b); y2 = Math.sin(b);
    void a;
  } else if (which === 2) {
    const r = u(), b = 2 * Math.PI * u();
    const mx = r * Math.cos(b), my = r * Math.sin(b);
    const d2 = mx * mx + my * my;
    if (d2 < 1e-7) return null;
    const t = Math.sqrt((1 - d2) / d2);
    x1 = mx - t * my; y1 = my + t * mx;
    x2 = mx + t * my; y2 = my - t * mx;
  } else if (which === 3) {
    const mx = 2 * u() - 1, my = 2 * u() - 1;
    const d2 = mx * mx + my * my;
    if (d2 > 1 || d2 < 1e-7) return null;
    const t = Math.sqrt((1 - d2) / d2);
    x1 = mx - t * my; y1 = my + t * mx;
    x2 = mx + t * my; y2 = my - t * mx;
  }
  return { x1, y1, x2, y2 };
}

/* RecordTrial: length, favourable test and the m_N/2 length bin. */
function appletRecordTrial(raw, N) {
  const length = Math.hypot(raw.x1 - raw.x2, raw.y1 - raw.y2);
  return {
    length,
    favorable: length > SIDE,
    bin: Math.min(Math.floor(length * (N / 2)), N - 1),
  };
}

/* ----------------------------------------------------- 1. start and options */

{
  const s = C.start();
  equal("the applet's triangle side is sqrt(3)", C.SIDE, SIDE);
  check("the applet's bin count is 180", C.BINS === 180 && C.PER_UNIT === 90);
  check("the near-centre cutoff is 1e-7", C.CENTER_EPS === 1e-7);
  check("a fresh run has nothing recorded",
    s.total === 0 && s.favorable === 0 && s.rejected === 0 && s.bins.every((n) => n === 0));
  check("a fresh run starts in option 0", s.mode === 0);
  check("the starting chord is a real chord", s.chord.length > 1 && s.chord.length <= 2);
  check("an illustration can be won or lost by nobody", C.result(s) === null);
  check("there is no estimate before the first chord", C.estimate(s) === null);
  check("an option outside 0..3 falls back to 0", C.start({ mode: 99 }).mode === 0);
  const switched = C.withMode(s, 3);
  check("switching option keeps the chord but clears the record",
    switched.mode === 3 && switched.total === 0 && samePoint(switched.chord.p1, s.chord.p1, 0));
  check("switching to the same option changes nothing", C.withMode(switched, 3) === switched);
  check("each option has the page's theoretical answer", (() => {
    return [1 / 3, 1 / 3, 1 / 2, 1 / 4].every((p, i) => C.modeInfo(i).theory === p);
  })());
}

/* -------------------------- 2. chord geometry over the whole circumference */

{
  const angles = Array.from({ length: 180 }, (_, i) => (2 * Math.PI * i) / 180);
  let pairs = 0, wrong = 0;
  for (const a of angles) {
    for (const b of angles) {
      const chord = C.makeChord(
        { x: Math.cos(a), y: Math.sin(a) },
        { x: Math.cos(b), y: Math.sin(b) },
      );
      const d = Math.hypot(chord.midpoint.x, chord.midpoint.y);
      const fromAngle = 2 * Math.abs(Math.sin((a - b) / 2));
      const fromMidpoint = 2 * Math.sqrt(Math.max(0, 1 - d * d));
      // d is within 1 of a short chord's end, so use a relative tolerance.
      if (!close(chord.length, fromAngle, 1e-9) ||
          !close(chord.length, fromMidpoint, 1e-7 + 1e-6 * fromMidpoint)) wrong++;
      if (Math.abs(d - 0.5) > 1e-9 && C.isLong(chord) !== (d < 0.5)) wrong++;
      pairs++;
    }
  }
  check(`chord length and the long test agree on all ${pairs} pairs of ends`, wrong === 0);

  const rand = rng(31);
  let midpointWrong = 0;
  for (let i = 0; i < 600; i++) {
    const angle = rand() * 2 * Math.PI, radius = Math.sqrt(rand()) * 0.999;
    const m = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    const chord = C.chordFromMidpoint(m);
    const want = 2 * Math.sqrt(1 - radius * radius);
    if (!samePoint(chord.midpoint, m, 1e-9) || !close(chord.length, want, 1e-9) ||
        !close(Math.hypot(chord.p1.x, chord.p1.y), 1, 1e-9) ||
        !close(Math.hypot(chord.p2.x, chord.p2.y), 1, 1e-9) ||
        C.isLong(chord) !== (radius < 0.5)) midpointWrong++;
  }
  check("600 random midpoints give the right chord, ends on the circle", midpointWrong === 0);
  check("no chord is determined by the exact centre", C.chordFromMidpoint({ x: 0, y: 0 }) === null);
}

/* ----------------- 3. the page's three answers, exhaustively over the option */

{
  // First solution, fixed end: scan one full turn of the free end.
  let longFixed = 0, testedFixed = 0;
  for (let k = 0; k < 720; k++) {
    const chord = C.sample(1, seq([0.5, k / 720]));
    if (C.isLong(chord)) longFixed++;
    testedFixed++;
  }
  check(`first solution: ${longFixed}/${testedFixed} of a full turn is long, near 1/3`,
    close(longFixed / testedFixed, 1 / 3, 0.005));

  // Third solution: the radius itself is the random variable.
  let longRadius = 0, testedRadius = 0;
  for (let k = 1; k <= 1000; k++) {
    const chord = C.sample(2, seq([k / 1000, 1 / 8]));
    if (C.isLong(chord)) longRadius++;
    testedRadius++;
  }
  check(`third solution: ${longRadius}/${testedRadius} of the radii is long, near 1/2`,
    close(longRadius / testedRadius, 1 / 2, 0.005));

  // Second solution: a grid over the circumscribed square, as the applet does.
  let longSquare = 0, insideSquare = 0;
  for (let ix = 0; ix <= 100; ix++) {
    for (let iy = 0; iy <= 100; iy++) {
      const x = ix / 50 - 1, y = iy / 50 - 1;
      const chord = C.sample(3, seq([(x + 1) / 2, (y + 1) / 2]));
      if (!chord) continue;
      insideSquare++;
      if (C.isLong(chord)) longSquare++;
    }
  }
  check(`second solution: ${longSquare}/${insideSquare} of points in the disc is long, near 1/4`,
    close(longSquare / insideSquare, 1 / 4, 0.01));
}

/* ------------------------- 4. long simulations for every option, with the CDF */

for (let mode = 0; mode < 4; mode++) {
  const rand = rng(20261126 + mode);
  let s = C.start({ mode });
  const N = 30000;
  for (let i = 0; i < N; i++) s = C.draw(s, rand);
  const theory = C.modeInfo(mode).theory;
  const p = C.estimate(s);
  check(`option ${mode}: ${s.total} trials estimate ${p.toFixed(4)} near ${theory}`,
    close(p, theory, 0.012), `rejected ${s.rejected}`);
  check(`option ${mode}: the histogram bins sum to the number of trials`,
    s.bins.reduce((a, b) => a + b, 0) === s.total);
  check(`option ${mode}: favourable count matches the estimate`,
    close(s.favorable / s.total, p, 0));
  const graph = C.cdf(s);
  const monotonic = graph.values.every((v, i) => v >= 0 && v <= 1 &&
    (i === 0 || v >= graph.values[i - 1]));
  check(`option ${mode}: the cumulative graph rises from 0 to 1`, monotonic &&
    close(graph.values[graph.values.length - 1], 1, 0));
  check(`option ${mode}: at the sqrt(3) line the graph reads ${graph.values[graph.cutoff].toFixed(4)}, near ${(1 - theory).toFixed(2)}`,
    close(graph.values[graph.cutoff], 1 - theory, 0.015));
  check(`option ${mode}: the trail keeps only the last 36 chords`, s.trail.length === 36);
}

/* ------- 4b. the page's two simulations, and where the midpoints gather --- */

{
  const r0 = rng(333), r1 = rng(444);
  let s0 = C.start({ mode: 0 }), s1 = C.start({ mode: 1 });
  for (let i = 0; i < 20000; i++) {
    s0 = C.draw(s0, r0);
    s1 = C.draw(s1, r1);
  }
  const g0 = C.cdf(s0).values, g1 = C.cdf(s1).values;
  let gap = 0;
  for (let i = 0; i < g0.length; i++) gap = Math.max(gap, Math.abs(g0[i] - g1[i]));
  check(`the page's two first-solution graphs agree (largest gap ${gap.toFixed(4)})`, gap < 0.02);

  const r2 = rng(555);
  let inside = 0;
  for (let i = 0; i < 20000; i++) {
    const chord = C.sample(0, r2);
    if (Math.hypot(chord.midpoint.x, chord.midpoint.y) < 0.5) inside++;
  }
  const fraction = inside / 20000;
  check(`endpoint-random midpoints gather near the centre: ${fraction.toFixed(4)} in 1/4 of the area, above 1/4`,
    close(fraction, 1 / 3, 0.012) && fraction / 0.25 > 1.2);
}

/* -------------- 5. the applet's bytecode transcription, trial by trial ----- */

for (let mode = 0; mode < 4; mode++) {
  const rand = rng(9001 + mode);
  let badPoint = 0, badBin = 0, badDraws = 0, compared = 0;
  for (let i = 0; i < 300; i++) {
    const values = [rand(), rand(), rand()];
    let used = 0;
    const coreChord = C.sample(mode, () => values[used++]);
    const coreDraws = used;
    used = 0;
    const raw = appletDropLine(mode, () => values[used++]);
    const appletDraws = used;
    if (coreDraws !== appletDraws) badDraws++;
    if (!raw) {
      if (coreChord !== null) badBin++;
      compared++;
      continue;
    }
    const trial = appletRecordTrial(raw, C.BINS);
    if (!coreChord || !samePoint(coreChord.p1, { x: raw.x1, y: raw.y1 }, 1e-12) ||
        !samePoint(coreChord.p2, { x: raw.x2, y: raw.y2 }, 1e-12) ||
        !close(coreChord.length, trial.length, 1e-12)) badPoint++;
    const recorded = C.record(C.start({ mode }), coreChord);
    if (recorded.total !== 1 || recorded.favorable !== (trial.favorable ? 1 : 0) ||
        recorded.bins.findIndex((n) => n === 1) !== trial.bin) badBin++;
    compared++;
  }
  check(`option ${mode}: ${compared} chords match DropLine's endpoints and length`, badPoint === 0);
  check(`option ${mode}: RecordTrial's bin and favourable match the core`, badBin === 0);
  check(`option ${mode}: both consume the same random numbers`, badDraws === 0);
}

/* --------------------- 6. rejections, dragging and unchanged inputs -------- */

{
  check("polar mode rejects a centre point", C.sample(2, seq([0, 0])) === null);
  check("Cartesian mode rejects a centre point", C.sample(3, seq([0.5, 0.5])) === null);
  check("Cartesian mode rejects a point outside the circle", C.sample(3, seq([0.9, 0.9])) === null);
  const s = C.start({ mode: 3 });
  const rejected = C.draw(s, seq([0.5, 0.5]));
  check("a rejected chord adds no trial", rejected.total === 0 && rejected.rejected === 1);
  check("drag A snaps to the circle and leaves the old state alone", (() => {
    const moved = C.withPoint(s, "A", { x: 100, y: 0 });
    return samePoint(moved.chord.p1, { x: 1, y: 0 }, 1e-12) &&
      !samePoint(moved.chord.p1, s.chord.p1, 1e-12) && s.chord.p1.x !== 1;
  })());
  check("drag M keeps the hand-picked midpoint and both ends on the circle", (() => {
    const m = { x: 0.3, y: 0.4 };
    const moved = C.withPoint(s, "M", m);
    return samePoint(moved.chord.midpoint, m, 1e-12) &&
      close(Math.hypot(moved.chord.p1.x, moved.chord.p1.y), 1, 1e-12) &&
      close(Math.hypot(moved.chord.p2.x, moved.chord.p2.y), 1, 1e-12);
  })());
  check("drag M clamps a far-away point back into the circle", (() => {
    const moved = C.withPoint(s, "M", { x: 30, y: 40 });
    return close(Math.hypot(moved.chord.midpoint.x, moved.chord.midpoint.y), 1, 1e-12);
  })());
  check("an unknown handle leaves the position alone", C.withPoint(s, "Z", { x: 0, y: 0 }) === s);
  check("dragging never counts as a trial", C.withPoint(s, "B", { x: 0, y: 1 }).total === 0);
  const batch = C.runBatch(C.start({ mode: 2 }), 100, rng(5));
  check("Draw 100 attempts 100 chords (a rare centre hit is rejected)",
    batch.total + batch.rejected === 100 && batch.bins.reduce((a, b) => a + b, 0) === batch.total,
    `total ${batch.total}, rejected ${batch.rejected}`);
  check("record and draw do not change the state they are given", s.total === 0 && s.trail.length === 0);
}

done("bertrand");
