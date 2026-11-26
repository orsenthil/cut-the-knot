#!/usr/bin/env node
"use strict";

/*
 * Logic test for simpson-paradox/simpson-paradox-core.js.
 *
 *   node porting/check-simpson-paradox.mjs
 *
 * 1. The applet's four starting points and their slopes.
 * 2. Over a large seeded set of point positions: each combined slope is a
 *    weighted average of its two slopes, so it lies between them; and when
 *    both B slopes exceed their A slopes, the combined comparison can go
 *    either way (the paradox is possible but not forced).
 * 3. Edge cases, ranges, messages, plain JSON and immutability.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("simpson-paradox/simpson-paradox-core.js", "SimpsonParadoxCore");

const near = (a, b) => Math.abs(a - b) < 1e-12;

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("the applet's A1 is (50,10)", s.points.a1, { x: 50, y: 10 });
  equal("A2 is (60,80)", s.points.a2, { x: 60, y: 80 });
  equal("B1 is (200,70)", s.points.b1, { x: 200, y: 70 });
  equal("B2 is (50,100)", s.points.b2, { x: 50, y: 100 });
  check("names are shown at the start", s.showNames);
  check("a fresh demo is not done", C.result(s) === null);
  const sl = C.slopes(s);
  check("B1 is steeper than A1", sl.b1 > sl.a1);
  check("B2 is steeper than A2", sl.b2 > sl.a2);
  check("but the B total is shallower than the A total", sl.b < sl.a);
  check("so the starting points show the paradox", C.paradox(s));
  check("the combined slope is y-sum over x-sum",
    near(sl.a, (10 + 80) / (50 + 60)) && near(sl.b, (70 + 100) / (200 + 50)));
}

/* --------------- 2. the weighted-average invariant over random positions */

{
  const random = rng(20261126);
  let weighted = true;
  let paradoxes = 0;
  let reversals = 0;
  let bothWays = false;
  let detail = "";
  for (let n = 0; n < 20000; n++) {
    const point = () => ({
      x: 1 + Math.floor(random() * 300),
      y: 1 + Math.floor(random() * 200),
    });
    const s = C.start({ a1: point(), a2: point(), b1: point(), b2: point() });
    const sl = C.slopes(s);
    const p = s.points;
    const wantA = (p.a1.x * sl.a1 + p.a2.x * sl.a2) / (p.a1.x + p.a2.x);
    const wantB = (p.b1.x * sl.b1 + p.b2.x * sl.b2) / (p.b1.x + p.b2.x);
    if (!near(sl.a, wantA) || !near(sl.b, wantB)) {
      weighted = false;
      detail = `a=${sl.a} vs ${wantA}, b=${sl.b} vs ${wantB}`;
      break;
    }
    if (Math.min(sl.a1, sl.a2) - 1e-12 > sl.a || sl.a > Math.max(sl.a1, sl.a2) + 1e-12 ||
        Math.min(sl.b1, sl.b2) - 1e-12 > sl.b || sl.b > Math.max(sl.b1, sl.b2) + 1e-12) {
      weighted = false;
      detail = `combined slope outside its pair: A ${sl.a}, B ${sl.b}`;
      break;
    }
    if (sl.b1 > sl.a1 && sl.b2 > sl.a2) {
      if (C.paradox(s)) paradoxes++;
      if (sl.b > sl.a) reversals++;
    }
  }
  check("each combined slope is the x-weighted average of its pair", weighted, detail);
  check("the paradox occurs in some of those positions", paradoxes > 0, `${paradoxes} examples`);
  check("the combined comparison also goes the other way sometimes", reversals > 0, `${reversals} examples`);
  bothWays = paradoxes > 0 && reversals > 0;
  check("so B steeper twice does not force B steeper overall", bothWays);
}

/* ------------------------------------- 3. options, edges and plain JSON */

{
  const base = C.start();
  const moved = C.setPoint(base, "b1", 20, 150);
  equal("moving a point changes only that point", moved.points.b1, { x: 20, y: 150 });
  equal("the other points stay put", moved.points.a1, base.points.a1);
  check("a move is marked done", C.result(moved) === "done");
  check("the message names the point in words", moved.message.includes("B1 is now (20, 150)"));
  equal("x below 1 is clamped", C.setPoint(base, "a1", -9, 10).points.a1.x, C.MIN_X);
  equal("x above 300 is clamped", C.setPoint(base, "a1", 999, 10).points.a1.x, C.MAX_X);
  equal("y below 1 is clamped", C.setPoint(base, "a1", 10, -9).points.a1.y, C.MIN_Y);
  equal("y above 200 is clamped", C.setPoint(base, "a1", 10, 999).points.a1.y, C.MAX_Y);
  equal("an unknown point is refused", C.setPoint(base, "c1", 1, 1), base);
  equal("Show names toggles", C.toggleNames(base).showNames, false);
  const reset = C.reset(moved);
  equal("Reset restores the four starting points", reset.points, C.start().points);
  check("Reset keeps the name option", reset.showNames === moved.showNames);
  const snapshot = JSON.stringify(base);
  C.setPoint(base, "a1", 12, 34);
  check("core functions never mutate the position", JSON.stringify(base) === snapshot);
  check("a position is plain JSON", typeof JSON.parse(JSON.stringify(moved)).points.a1.x === "number");
  equal("an unknown key does nothing", C.slopes(C.start({ a1: { x: 0, y: 0 } })).a1,
    C.slope({ x: C.MIN_X, y: C.MIN_Y }));
}

done("simpson-paradox");
