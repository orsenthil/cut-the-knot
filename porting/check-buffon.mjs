#!/usr/bin/env node
"use strict";

/*
 * Logic test for buffon/buffon-core.js (applet "Buffon").
 *
 * There is no opponent and no win condition: the applet is a Monte-Carlo
 * demonstration. So what is tested is the geometry and the claims on the
 * cut-the-knot page:
 *
 *  1. every slider value in the applet's range maps to the same trial/skip
 *     setting and is clamped outside it, and the buttons reset/continue exactly
 *     as the AWT buttons do;
 *  2. the needle's throw and crossing test are compared, on a dense grid over
 *     the full (angle, position) space, with a second literal transcription of
 *     BuffonNeedle.Throw()/HasCrossed() from the bytecode;
 *  3. the page's probability claim p = 2/pi (and the pi estimate 2*I/Count) is
 *     checked by deterministic quadrature over the same space;
 *  4. the page's "a noodle of the same length gives exactly the same result"
 *     claim is checked for several shapes, with expected crossings 2L/D, and
 *     the noodle's chaining is compared to a second transcription of
 *     Noodle.Throw()/BuffonNeedle.Rotate();
 *  5. the applet's messages, CutDigits formatting and degenerate inputs.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("buffon/buffon-core.js", "BuffonCore");

const D = C.LENGTH; // 4: needle length L equals crack spacing D

function twoValues(a, b) {
  let i = 0;
  const values = [a, b];
  return () => values[i++];
}

/* ------------------------------------------------ 1. options and controls */

{
  const s = C.start({});
  equal("the default run is 500 throws, no skipping, pi hidden, straight needle", s, {
    trials: 500, perRun: 500, skip: 0, showPi: false, shape: null,
    throws: 0, crossings: 0, last: null, running: false, completed: false,
  });
  equal("the applet's world is a strip of width D", [C.Y_MIN, C.Y_MAX, C.LENGTH], [0, 4, 4]);

  // The # Trials scrollbar is (0,5,10,0,110): visible 10, so values 0..100.
  for (let slider = 0; slider <= 100; slider++) {
    const t = C.setTrials(s, slider).trials;
    check(`trial slider ${slider} gives ${slider * 100} throws`, t === slider * 100, `got ${t}`);
  }
  check("trial slider clamps below 0", C.setTrials(s, -40).trials === 0);
  check("trial slider clamps above 100", C.setTrials(s, 140).trials === 10000);
  check("changing trials clears the counters", C.setTrials(C.throwOnce(s, rng(1)), 5).throws === 0);
  check("changing trials sets NExtra to the new N", C.setTrials(s, 7).perRun === 700);

  // Skip scrollbar is (0,0,100,0,1100): values 0..1000.
  for (let slider = 0; slider <= 1000; slider++) {
    check(`skip slider ${slider}`, C.setSkip(s, slider).skip === slider);
  }
  check("skip clamps below 0", C.setSkip(s, -5).skip === 0);
  check("skip clamps above 1000", C.setSkip(s, 9999).skip === 1000);
  check("show-pi is a boolean option", C.setShowPi(s, 1).showPi === true && C.setShowPi(s, 0).showPi === false);

  const running = C.startRun(s);
  check("Start clears the counters and sets Run", running.running && running.throws === 0 && running.crossings === 0);
  check("Stop leaves the counters alone", C.stopRun(C.throwOnce(running, rng(3))).crossings >= 0);
  const stopped = C.stopRun(running);
  check("a stopped applet ignores ticks", C.tick(stopped, rng(5)) === stopped);
  const zero = C.start({ trials: 0 });
  check("N = 0 stops without throwing", C.tick(C.startRun(zero), rng(3)).throws === 0);
  check("N = 0 leaves Run false", C.tick(C.startRun(zero), rng(3)).running === false);
}

/* ---------------------- 2. the crossing test and the needle's throw, exhaustively */

{
  // Literal transcription of BuffonNeedle.HasCrossed and Throw(double,double).
  function appletNeedle(u, v) {
    const angle = u * 2 * Math.PI;
    const centerY = 0 + (4 - 0) * v;
    const dx = Math.sin(angle) * 4;
    const dy = Math.cos(angle) * 4;
    const sx = (0 + 4) / 2 - dx / 2;
    const sy = centerY - dy / 2;
    const ex = sx + dx;
    const ey = sy + dy;
    let y1 = sy;
    let y2 = ey;
    if (y1 > y2) { const t = y1; y1 = y2; y2 = t; }
    const hasCrossed = (y) => y1 <= y && y <= y2;
    return { angle, centerY, sx, sy, ex, ey, hit: hasCrossed(0) || hasCrossed(4) ? 1 : 0 };
  }

  for (let y1 = 0; y1 <= 4; y1++) {
    for (let y2 = 0; y2 <= 4; y2++) {
      const lo = Math.min(y1, y2);
      const hi = Math.max(y1, y2);
      for (const b of [0, 4]) {
        const expected = lo <= b && b <= hi;
        check(`crossing of ${b} between ${y1} and ${y2}`, C.crosses(b, y1, y2) === expected);
      }
      check(`segment ${y1}..${y2} reaches a crack`, C.segmentHits(y1, y2) === (lo === 0 || hi === 4));
    }
  }

  // Full grid of the applet's two random draws (angle, strip position).
  let mismatch = 0;
  let firstBad = "";
  for (let ai = 0; ai < 360; ai++) {
    for (let ti = 0; ti < 200; ti++) {
      const u = ai / 360;
      const v = ti / 200;
      const a = appletNeedle(u, v);
      const b = C.throwNeedle(twoValues(u, v));
      if (Math.abs(a.angle - b.angle) > 1e-12 || Math.abs(a.centerY - b.centerY) > 1e-12 ||
          Math.abs(a.sx - b.x1) > 1e-12 || Math.abs(a.sy - b.y1) > 1e-12 ||
          Math.abs(a.ex - b.x2) > 1e-12 || Math.abs(a.ey - b.y2) > 1e-12 ||
          a.hit !== (b.hit ? 1 : 0)) {
        mismatch++;
        if (!firstBad) firstBad = `angle ${u}, t ${v}`;
      }
    }
  }
  check("the needle matches the applet at all 72,000 grid points", mismatch === 0, firstBad);
  // Angle 0 points along (sin 0, cos 0) = straight down; angle pi/2 is horizontal.
  check("a horizontal needle in the middle misses", C.throwNeedle(twoValues(0.25, 0.5)).hit === false);
  check("a vertical needle in the middle hits", C.throwNeedle(twoValues(0, 0.5)).hit === true);
  check("a needle ending exactly on a crack hits", C.throwNeedle(twoValues(0, 0.5)).y2 === 4);
}

/* ----------------------------- 3. the page's probability and pi claims */

/** Mean number of crossings per throw over a uniform grid of (angle, position). */
function meanCrossings(needle, angles = 720, positions = 240) {
  let hits = 0;
  for (let ai = 0; ai < angles; ai++) {
    const u = (ai + 0.5) / angles;
    for (let ti = 0; ti < positions; ti++) {
      const v = (ti + 0.5) / positions;
      hits += needle(twoValues(u, v)).hits;
    }
  }
  return hits / (angles * positions);
}

{
  const p = meanCrossings((r) => C.throwNeedle(r));
  check("the page's question: P(crossing) is 2/pi when L = D", Math.abs(p - 2 / Math.PI) < 0.003, `p = ${p}`);

  // The applet's estimate: 2 * throws / crossings, truncated by CutDigits.
  // The scrollbar caps N at 10000, so a longer run sets it directly.
  const r = rng(2026);
  let pos = { ...C.start({}), trials: 200000, perRun: 200000, showPi: true };
  pos = C.run(C.startRun(pos), r, 200000);
  equal("the batch ends exactly at N", pos.throws, 200000);
  check("the batch has stopped", pos.running === false && pos.completed === true);
  const piHat = Number(C.estimatePi(pos));
  check("2 * throws / crossings estimates pi", Math.abs(piHat - Math.PI) < 0.02, `pi estimate = ${piHat}`);
  check("the crossing rate is near 2/pi", Math.abs(pos.crossings / pos.throws - 2 / Math.PI) < 0.006);
  check("the pi reading is six characters", C.estimatePi(pos).length === 6);
}

/* ------------------- 4. the noodle: chaining and the shape-independent claim */

const SHAPES = {
  straight: [[0, 0], [4, 0]],
  rightAngle: [[0, 0], [3, 0], [3, 4]],
  zigzag: [[0, 0], [2, 1], [1, 3], [3, 1], [1, 2]],
  arc: Array.from({ length: 7 }, (_, i) => {
    const a = (Math.PI * i) / 6;
    return [Math.cos(a), Math.sin(a)];
  }),
};

{
  for (const [name, points] of Object.entries(SHAPES)) {
    const shape = C.scaleShape(points);
    check(`${name}: the shape is rescaled to the needle's length`, Math.abs(C.shapeLength(shape) - D) < 1e-12,
      `got ${C.shapeLength(shape)}`);
    const p = meanCrossings((r) => C.throwNoodle(r, shape), 360, 160);
    check(`${name}: expected crossings per throw is still 2/pi`, Math.abs(p - 2 / Math.PI) < 0.012, `p = ${p}`);
  }
  check("a degenerate shape is refused", C.scaleShape([[1, 1], [1, 1]]) === null);
  check("a single point is not a noodle", C.scaleShape([[0, 0]]) === null);
  check("an empty shape is refused", C.scaleShape([]) === null);
  check("a straight noodle can only cross once", C.throwNoodle(twoValues(0, 0.5), C.scaleShape(SHAPES.straight)).hits === 1);
  check("a long noodle can cross more than once", (() => {
    const many = C.scaleShape(Array.from({ length: 12 }, (_, i) => [0, i % 2 ? -1 : 1]));
    for (let i = 0; i < 500; i++) {
      if (C.throwNoodle(twoValues((i * 0.013) % 1, (i * 0.037) % 1), many).hits > 1) return true;
    }
    return false;
  })());

  // Literal transcription of Noodle.Throw + BuffonNeedle.Rotate from the bytecode:
  // first piece thrown freely, next pieces chained at angle = randomAngle + turn.
  function appletNoodle(u, v, shape) {
    const angle = u * 2 * Math.PI;
    const centerY = 4 * v;
    const dir = shape.map((s) => Math.atan2(s[0], s[1])); // (sin a, cos a) convention
    const turns = [0];
    for (let i = 1; i < dir.length; i++) turns[i] = turns[i - 1] + (dir[i] - dir[i - 1]);
    let x1 = 2, y1 = centerY, hits = 0;
    const segs = [];
    for (let i = 0; i < shape.length; i++) {
      const len = Math.hypot(shape[i][0], shape[i][1]);
      const a = angle + turns[i];
      const dx = Math.sin(a) * len;
      const dy = Math.cos(a) * len;
      if (i === 0) { x1 = 2 - dx / 2; y1 = centerY - dy / 2; }
      const x2 = x1 + dx, y2 = y1 + dy;
      const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
      const hit = (lo <= 0 && 0 <= hi) || (lo <= 4 && 4 <= hi);
      if (hit) hits++;
      segs.push([x1, y1, x2, y2, hit ? 1 : 0]);
      x1 = x2; y1 = y2;
    }
    return { angle, centerY, segs, hits };
  }

  let bad = 0;
  let where = "";
  for (const [name, points] of Object.entries(SHAPES)) {
    const shape = C.scaleShape(points);
    for (let ai = 0; ai < 40; ai++) {
      for (let ti = 0; ti < 20; ti++) {
        const u = ai / 40, v = ti / 20;
        const a = appletNoodle(u, v, shape);
        const b = C.throwNoodle(twoValues(u, v), shape);
        if (Math.abs(a.angle - b.angle) > 1e-12 || Math.abs(a.centerY - b.centerY) > 1e-12 ||
            a.hits !== b.hits || a.segs.length !== b.segments.length ||
            a.segs.some((s, i) => s.some((x, j) => Math.abs(x - [b.segments[i].x1, b.segments[i].y1,
              b.segments[i].x2, b.segments[i].y2, b.segments[i].hit ? 1 : 0][j]) > 1e-10))) {
          bad++;
          if (!where) where = `${name} at ${u}, ${v}`;
        }
      }
    }
  }
  check("the noodle matches the applet at all 3,200 grid points", bad === 0, where);
}

/* ------------------------- 5. counters, buttons and the applet's messages */

{
  let pos = C.start({ trials: 100 });
  pos = C.run(C.startRun(pos), rng(11), 100);
  const atEnd = { throws: pos.throws, crossings: pos.crossings };
  equal("a finished batch has exactly N throws", atEnd.throws, 100);
  const again = C.run(C.repeat(pos), rng(11), 200);
  equal("Repeat adds another batch", again.throws, 200);
  check("Repeat resumes rather than clearing", again.crossings >= pos.crossings);
  equal("Start resets the counters", C.startRun(again).crossings, 0);
  equal("Save-shape resets the counters", C.setShape(again, SHAPES.rightAngle).throws, 0);
  check("Save-shape installed a noodle", Array.isArray(C.setShape(again, SHAPES.rightAngle).shape));

  const p1 = C.run(C.startRun(C.start({ trials: 50 })), rng(99));
  const p2 = C.run(C.startRun(C.start({ trials: 50 })), rng(99));
  equal("the same random source gives the same run", [p1.throws, p1.crossings, p1.last], [p2.throws, p2.crossings, p2.last]);
  check("the saved last throw is plain JSON", JSON.parse(JSON.stringify(p1.last)).hits === p1.last.hits);

  check("CutDigits truncates pi to six characters", C.cutDigits(3.141592653589793) === "3.1415");
  check("CutDigits keeps Java's decimal point", C.cutDigits(2) === "2.0000");
  check("CutDigits pads a short decimal", C.cutDigits(0.5) === "0.5000");
  check("no crossings shows 0", C.estimatePi(C.start({})) === "0");
  equal("the reading is crossings / throws", C.countText({ crossings: 2, throws: 3, showPi: false }), "2 / 3");
  equal("ShowPi appends the estimate", C.countText({ crossings: 2, throws: 3, showPi: true }), "2 / 3 / 3.0000");
  check("all positions are plain JSON", JSON.stringify(C.start({})).indexOf("undefined") < 0);
}

done("buffon");
