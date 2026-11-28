#!/usr/bin/env node
"use strict";

/*
 * Logic test for harmonic-mean/harmonic-mean-core.js.
 *
 *   node porting/check-harmonic-mean.mjs
 *
 * Checked: the start position and the applet's option ranges (2 to 40 legs,
 * speeds 1 to 10); slider pixel <-> value conversion and the release snap;
 * setSpeed/setCount/setMode including immutability; the race state machine;
 * and the saved position. The last sections are (1) a second, literal
 * transcription of DistanceGraph.Evaluate and VSlider.DoubleValue from the
 * bytecode, compared with the core for every leg count 2..40 on several
 * boundary patterns and on seeded random speeds, and (2) the page's claims:
 * 20 mph and 30 mph over equal halves average 24 mph (not the arithmetic
 * mean 25), the n-leg average is the harmonic mean, the arithmetic mean is
 * never below the harmonic mean with equality only when all speeds are
 * equal, and both teams in the relay finish together. The two-speed and
 * three-speed claims are checked exhaustively over all 100 and 1000 speeds.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("harmonic-mean/harmonic-mean-core.js", "HarmonicMeanCore");
const near = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closeArrays = (a, b, tol = 1e-9) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
  a.every((v, i) => near(v, b[i], tol));

const patterns = (n, random) => [
  Array(n).fill(1),
  Array(n).fill(10),
  Array.from({ length: n }, (_, i) => (i % 2 ? 10 : 1)),
  Array.from({ length: n }, (_, i) => 1 + (i % 10)),
  Array.from({ length: n }, (_, i) => 10 - (i % 10)),
  Array.from({ length: n }, () => random()),
];

/* ------------------------------------------------ the applet's own method #2 */

/*
 * DistanceGraph.Evaluate, transcribed directly from the bytecode with its
 * pixel geometry (originY, boundsY, tickLengthY, originX, tickLengthX). The
 * core uses one unit of distance per leg; the pixel scale factor L3 cancels
 * in the mean and is divided out of the leg times before comparison.
 */
function appletEvaluate(speeds, originX = 60, originY = 200, boundsY = 20,
                       tickX = 30, tickY = 20) {
  const N = speeds.length;
  const L2 = (originY - boundsY) % tickY + boundsY;
  const L3 = (originY - L2) / N;
  let totalTime = 0;
  for (let i = 0; i < N; i++) {
    const v = speeds[i];
    if (v !== 0) totalTime += L3 / v;
  }
  const mean = totalTime === 0 ? 0 : L3 * N / totalTime;
  let cumulative = originX;
  const times = [];
  if (totalTime !== 0) {
    const L9 = originX + tickX * N / totalTime;
    for (let i = 0; i < N; i++) {
      const v = speeds[i];
      if (v === 0) continue;
      cumulative += L3 * L9 / v;
      times.push(cumulative);
    }
  }
  const scale = L3 * (originX + tickX * N / totalTime);
  return {
    totalTime: totalTime,
    legPixels: L3,
    mean: mean,
    times: totalTime === 0 ? [] : times.map((t) => (t - originX) / scale),
  };
}

/* VSlider.DoubleValue in double precision, independent of the core's fround. */
function appletValueAtPixel(L, y, height, min, max) {
  return min + (max - min) * (y + height - L) / height;
}
function appletPixelForValue(value, y, height, min, max) {
  return Math.round(y + height - height * (value - min) / (max - min));
}
function appletSnap(v, min, max) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

/* ------------------------------------------------- 1. start and the options */

{
  for (let k = 0; k < 200; k++) {
    const s = C.start({ random: rng(k + 1) });
    check(`start ${k}: ten legs, default range, time mode`,
      s.n === 10 && s.min === 1 && s.max === 10 && s.mode === "time" &&
      s.speeds.length === 10 && s.selected === 0 &&
      s.speeds.every((v) => Number.isInteger(v) && v >= 1 && v <= 10));
    check(`start ${k}: no result before a race`, C.result(s) === null && !s.race.running && s.race.time === 0);
  }
  const s = C.start({ n: 40, mode: "distance", min: 0, max: 5, selected: 99,
                      speeds: [2, 3.7, -1, 99], random: rng(9) });
  equal("supplied speeds are rounded and clamped", s.speeds.slice(0, 4), [2, 4, 0, 5]);
  check("supplied speeds are padded to the leg count", s.speeds.length === 40);
  check("options are clamped to the applet's ranges", s.selected === 39 && s.min === 0 && s.max === 5);
  check("distance mode is retained", s.mode === "distance");
  check("the applet's constants", C.MIN_N === 2 && C.MAX_N === 40 && C.DEFAULT_N === 10 &&
        C.MIN_SPEED === 1 && C.MAX_SPEED === 10);
}

/* ---------------------------------------------------- 2. slider arithmetic */

{
  let pixels = 0, inverse = 0, snaps = 0;
  for (let min = 0; min <= 10; min++) {
    for (let max = min + 1; max <= 11; max++) {
      for (let L = 0; L <= 100; L += 1) {
        const ours = C.valueAtPixel(L, 0, 100, min, max);
        const theirs = appletValueAtPixel(L, 0, 100, min, max);
        if (!near(ours, theirs, 2e-6)) pixels++;
        const back = C.pixelForValue(ours, 0, 100, min, max);
        if (Math.abs(back - appletPixelForValue(ours, 0, 100, min, max)) > 1) inverse++;
      }
      for (let v = -2; v <= max + 2; v += 0.25) {
        if (C.snap(v, min, max) !== appletSnap(v, min, max)) snaps++;
      }
    }
  }
  check("pixel -> speed matches the second transcription everywhere", pixels === 0, `${pixels} mismatches`);
  check("speed -> pixel matches the second transcription everywhere", inverse === 0, `${inverse} mismatches`);
  check("released sliders snap like Java Math.round", snaps === 0, `${snaps} mismatches`);
  for (let min = 1; min <= 10; min++) {
    for (let max = min; max <= 10; max++) {
      const random = rng(100 + min * 17 + max);
      let ok = true;
      for (let k = 0; k < 100; k++) {
        const u = random();
        const ours = C.randomSpeed(min, max, () => u);
        const L = Math.round(u * 100);
        const theirs = appletSnap(appletValueAtPixel(L, 0, 100, min, max), min, max);
        if (!Number.isInteger(ours) || ours < min || ours > max || Math.abs(ours - theirs) > 1) ok = false;
      }
      check(`random slider values stay in [${min}, ${max}]`, ok);
    }
  }
  const s = C.start({ speeds: [4, 5] });
  const snapped = C.setSpeed(s, 0, 6.5, true);
  const dragged = C.setSpeed(s, 0, 6.5, false);
  check("setSpeed snaps by default and keeps fractional values while dragging",
    snapped.speeds[0] === 7 && dragged.speeds[0] === 6.5);
  check("setSpeed clamps and does not mutate the old position",
    C.setSpeed(s, 0, 999, true).speeds[0] === 10 &&
    C.setSpeed(s, 0, -999, true).speeds[0] === 1 && s.speeds[0] === 4);
  check("setSpeed ignores a fractional NaN and an out-of-range index",
    C.setSpeed(s, 0, NaN, true) === s && C.setSpeed(s, 99, 3, true) === s);
}

/* ------------------------------------------- 3. leg count, mode and race */

{
  const s = C.start({ n: 9, random: rng(7) });
  const small = C.setCount(s, -3, rng(1)), big = C.setCount(s, 999, rng(2));
  check("leg count clamps at the applet's 2 and 40", small.n === 2 && big.n === 40 &&
        small.speeds.length === 2 && big.speeds.length === 40);
  check("changing the leg count rebuilds random slider values",
    small.speeds.every((v) => v >= 1 && v <= 10) && big.speeds.every((v) => v >= 1 && v <= 10));
  check("setCount does not change the old position", s.n === 9 && s.speeds.length === 9);
  const d = C.setMode(s, "distance"), t = C.setMode(d, "nonsense");
  check("the mode switch has exactly two states", d.mode === "distance" && t.mode === "time" &&
        C.setMode(s, "time") === s);
  check("the mode switch does not change the average",
    near(C.evaluate(s).mean, C.evaluate(d).mean, 1e-12));
  check("selected leg is clamped and does not mutate", C.select(s, 99).selected === 8 && s.selected === 0);

  const r = C.start({ speeds: [20, 30], min: 1, max: 40 });
  const running = C.startRace(r);
  const e = C.evaluate(r);
  check("a race starts at time zero", running.race.running && running.race.time === 0 && C.result(running) === null);
  const mid = C.advance(running, e.totalTime / 2);
  check("advancing a race moves both teams", mid.race.time > 0 && C.result(mid) === null);
  const stopped = C.stopRace(mid);
  check("stopping a race freezes the clock", !stopped.race.running &&
        C.advance(stopped, 100) === stopped);
  const over = C.advance(running, e.totalTime + 5);
  check("a finished race is done, not won or lost", !over.race.running &&
        C.result(over) === "done" && over.race.time === e.totalTime);
  check("advance does nothing before the race starts", C.advance(r, 5) === r);
}

/* ------------------------- 4. the applet's Evaluate, all leg counts 2..40 */

{
  const random = rng(2026);
  let cases = 0;
  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    for (const speeds of patterns(n, () => 1 + Math.floor(random() * 10))) {
      const s = C.start({ n: n, speeds: speeds });
      const ours = C.evaluate(s);
      const theirs = appletEvaluate(speeds);
      const ok = near(ours.mean, theirs.mean, 1e-9) &&
                 near(ours.totalTime * theirs.legPixels, theirs.totalTime, 1e-9) &&
                 closeArrays(ours.legTimes, theirs.times, 1e-9);
      check(`Evaluate matches the bytecode, ${n} legs [${speeds.slice(0, 4).join(",")}${n > 4 ? ",..." : ""}]`, ok);
      cases++;
    }
  }
  check("all 39 leg counts were compared", cases === 39 * patterns(2, random).length);
}

/* --------------------------- 5. the widths of the speed bars (Versus T/D) */

{
  const random = rng(11);
  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    const speeds = patterns(n, () => 1 + Math.floor(random() * 10))[5];
    const time = C.start({ n: n, speeds: speeds, mode: "time" });
    const dist = C.setMode(time, "distance");
    const e = C.evaluate(time);
    const widths = C.barWidths(time), equalWidths = C.barWidths(dist);
    let ok = widths.length === n && equalWidths.length === n &&
             near(widths.reduce((a, b) => a + b, 0), 1, 1e-9) &&
             near(equalWidths.reduce((a, b) => a + b, 0), 1, 1e-9);
    for (let i = 0; i < n; i++) {
      ok = ok && near(widths[i], (1 / speeds[i]) / e.totalTime, 1e-12) &&
           near(equalWidths[i], 1 / n, 1e-12);
    }
    check(`bar widths ${n} legs: proportional to times or to distance`, ok);
  }
}

/* -------------------------------------- 6. the page's arithmetic claims */

{
  const two = C.start({ n: 2, speeds: [20, 30], min: 1, max: 50 });
  const e2 = C.evaluate(two);
  check("the page's 20/30 example averages 24 mph, not 25 mph",
    near(e2.mean, 24, 1e-12) && near(e2.arithmetic, 25, 1e-12));
  check("the page's time calculation: half at 20 then half at 30",
    near(e2.legTimes[0], 1 / 20, 1e-12) && near(e2.legTimes[1], 1 / 20 + 1 / 30, 1e-12) &&
    near(2 / e2.legTimes[1], 24, 1e-12));

  const five = C.start({ n: 5, speeds: [20, 30, 40, 50, 60], max: 60 });
  const e5 = C.evaluate(five);
  check("the page's five-number harmonic mean formula",
    near(e5.harmonic, 5 / (1 / 20 + 1 / 30 + 1 / 40 + 1 / 50 + 1 / 60), 1e-12));
  check("the five-number mean matches the harmonic mean", near(e5.mean, e5.harmonic, 1e-12));

  let pairs = 0, triples = 0, pairFail = 0, tripleFail = 0;
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      const s = C.start({ n: 2, speeds: [a, b] });
      const e = C.evaluate(s);
      const hm = 2 * a * b / (a + b);
      const amge = e.arithmetic >= e.harmonic - 1e-12;
      if (!(near(e.mean, hm, 1e-12) && amge &&
            ((a === b) === near(e.arithmetic, e.harmonic, 1e-12)))) pairFail++;
      pairs++;
      for (let c = 1; c <= 10; c++) {
        const s3 = C.start({ n: 3, speeds: [a, b, c] });
        const e3 = C.evaluate(s3);
        const h = 3 / (1 / a + 1 / b + 1 / c);
        const allEqual = a === b && b === c;
        if (!(near(e3.mean, h, 1e-12) && e3.arithmetic >= e3.harmonic - 1e-12 &&
              (allEqual === near(e3.arithmetic, e3.harmonic, 1e-12)) &&
              near(C.evaluate(C.setMode(s3, "distance")).mean, h, 1e-12))) tripleFail++;
        triples++;
      }
    }
  }
  check(`all 100 two-speed cases: mean = 2ab/(a+b), AM >= HM, equality iff a = b`,
    pairs === 100 && pairFail === 0, `${pairFail} failed`);
  check(`all 1000 three-speed cases: mean = harmonic mean, AM >= HM, equality iff all equal`,
    triples === 1000 && tripleFail === 0, `${tripleFail} failed`);

  const random = rng(77);
  let larger = 0, bad = 0;
  for (let n = 4; n <= 40; n++) {
    for (const speeds of patterns(n, () => 1 + Math.floor(random() * 10))) {
      const e = C.evaluate(C.start({ n: n, speeds: speeds }));
      const harmonic = n / speeds.reduce((sum, v) => sum + 1 / v, 0);
      const allEqual = speeds.every((v) => v === speeds[0]);
      if (!(near(e.mean, harmonic, 1e-9) && e.arithmetic >= harmonic - 1e-9 &&
            (allEqual === near(e.arithmetic, e.harmonic, 1e-9)))) bad++;
      larger++;
    }
  }
  check(`all ${larger} larger configurations obey AM >= HM with equality iff all equal`, bad === 0, `${bad} failed`);
}

/* ------------------------------------------ 7. the race and the two teams */

{
  const random = rng(313);
  let bad = 0, samples = 0;
  for (let n = C.MIN_N; n <= 12; n++) {
    for (const speeds of patterns(n, () => 1 + Math.floor(random() * 10))) {
      const s = C.start({ n: n, speeds: speeds });
      const e = C.evaluate(s);
      const checkpoints = [0, e.totalTime / 3, e.totalTime / 2, e.totalTime * 0.9, e.totalTime];
      let lastBug = -1, lastTwin = -1;
      for (const t of checkpoints) {
        const p = C.teamsAt(s, t);
        samples++;
        const finish = near(t, e.totalTime, 1e-9);
        if (!(near(p.twin, t * e.mean, 1e-9) && p.bug >= 0 && p.bug <= n &&
              p.bug >= lastBug - 1e-9 && p.twin >= lastTwin - 1e-9 &&
              p.finished === finish)) bad++;
        lastBug = p.bug; lastTwin = p.twin;
        if (finish && !(near(p.bug, n, 1e-9) && near(p.twin, n, 1e-9))) bad++;
      }
      for (let i = 0; i < e.legTimes.length; i++) {
        const p = C.teamsAt(s, e.legTimes[i]);
        samples++;
        if (!near(p.bug, i + 1, 1e-9) || !near(p.twin, e.legTimes[i] * e.mean, 1e-9)) bad++;
      }
    }
  }
  check(`both teams meet at every leg boundary: ${samples} race samples`, bad === 0, `${bad} failed`);
  const s = C.start({ speeds: [20, 30], min: 1, max: 50 });
  const p = C.teamsAt(s, 1 / 20 + 1 / 30);
  check("the 20/30 twins tie the relay at 24 mph",
    near(p.bug, 2, 1e-12) && near(p.twin, 2, 1e-12) && near(C.evaluate(s).mean, 24, 1e-12));
  check("clamping time keeps a team inside the race",
    C.teamsAt(s, -10).bug === 0 && C.teamsAt(s, 1e6).finished);
}

/* -------------------------------------------------- 8. the saved position */

{
  const s = C.start({ n: 12, speeds: [2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3] });
  const p = C.position(s);
  equal("the saved position is plain data for the tutor", p, {
    n: 12, speeds: [2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3],
    mode: "time", selected: 0, raceTime: 0, mean: C.evaluate(s).mean,
  });
  check("the saved position is small enough for Track", JSON.stringify(p).length < 400);
  p.speeds[0] = 99;
  check("saving a position does not change the game", s.speeds[0] === 2);
}

done("harmonic-mean");
