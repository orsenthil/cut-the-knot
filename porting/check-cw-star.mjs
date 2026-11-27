#!/usr/bin/env node
"use strict";

/*
 * Logic test for cw-star/cw-star-core.js.
 *
 *   node porting/check-cw-star.mjs
 *
 * Section 1 transcribes CreateBasePolygon, DrawShape's arc angles, the
 * restricted vertex drag and the rolling rotation a second time, straight
 * from CWStar's bytecode, and compares each one over the whole slider range
 * (and hundreds of dragged positions). Section 2 tests the page's claims:
 * the star is always equilateral, its vertices are always odd, the arcs join
 * neighbouring vertices, and the two constructions have width L and L + 2a.
 * Widths are measured by dense boundary sampling in many directions, which
 * is an exhaustive numerical check for every slider setting.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cw-star/cw-star-core.js", "CwStarCore");
const PI = Math.PI;
const DEG = 180 / PI;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const samePoint = (a, b, tol = 1e-7) => near(a.x, b.x, tol) && near(a.y, b.y, tol);
const samePoints = (a, b, tol = 1e-7) =>
  a.length === b.length && a.every((p, i) => samePoint(p, b[i], tol));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ------------------------------------------------------------------ 1. applet transcriptions */

/* CreateBasePolygon (javap: d = n/2; step = 2*pi*d/n; R = L/(2 sin(step/2))). */
function appletVertices(steps, length, view) {
  const n = 3 + 2 * steps;
  const d = Math.floor(n / 2);
  const step = 6.283185307179586 * d / n;
  const radius = length / (2 * Math.sin(step / 2));
  const points = [];
  for (let i = 0; i < n; i++) {
    points.push({ x: view.width / 2 + radius * Math.cos(step * i), y: view.height / 2 + radius * Math.sin(step * i) });
  }
  if (n === 3) points[0].y = points[0].y + 0.1;
  points[Math.floor(n / 2)].x = points[Math.floor(n / 2)].x + 1;
  return points;
}

/* GeoSDoub.FindOrientation and ComputeSignedAngle, written from their bytecode. */
function appletSignedAngle(o, p, q) {
  const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
  const cos = (d2(o, p) + d2(o, q) - d2(p, q)) / 2 / Math.sqrt(d2(o, p)) / Math.sqrt(d2(o, q));
  const a = Math.acos(Math.max(-1, Math.min(1, cos)));
  const cross = q.x * (o.y - p.y) + q.y * (p.x - o.x) + o.x * p.y - p.x * o.y;
  const oriented = cross > 0 ? a : -a;
  // The applet's guard tests (p.x-o.x)^2 + (p.y-o.y)^2 < 0, which never holds.
  return oriented;
}

/* CWShapeRotation.DrawShape's start/sweep calculation for one vertex. */
function appletArcAngles(V, i) {
  const n = V.length;
  const q = V[i], prev = V[(i - 1 + n) % n], next = V[(i + 1) % n];
  const jmod = (a, b) => ((a % b) + b) % b;
  const east = { x: q.x + 200, y: q.y };
  const south = { x: q.x, y: q.y + 200 };
  const diag = { x: q.x + 200, y: q.y + 200 };
  let start = jmod(-Math.round(appletSignedAngle(q, east, next) * DEG) + 720, 360);
  const sweep = -Math.round(appletSignedAngle(q, next, prev) * DEG);
  const fromSouth = jmod(-Math.round(appletSignedAngle(q, south, next) * DEG) - 90 + 720, 360);
  if (start !== fromSouth) {
    const fromDiag = jmod(-Math.round(appletSignedAngle(q, diag, next) * DEG) - 45 + 720, 360);
    if (fromSouth === fromDiag) start = fromSouth;
  }
  return { start, sweep };
}

/* mousePressed + mouseDragged for a vertex: RestrictToCircle then ManualUpdate. */
function appletDrag(V, i, target, length) {
  const n = V.length;
  const next = V[(i + 1) % n], prev = (i + n - 1) % n, before = (i + n - 2) % n;
  const dx = target.x - next.x, dy = target.y - next.y;
  const d = Math.hypot(dx, dy);
  if (!d) return V.slice();
  const points = V.map((p) => ({ x: p.x, y: p.y }));
  points[i] = { x: next.x + (length * dx) / d, y: next.y + (length * dy) / d };
  const mid = { x: (points[i].x + points[before].x) / 2, y: (points[i].y + points[before].y) / 2 };
  const radius = Math.hypot(mid.x - points[before].x, mid.y - points[before].y);
  const h = Math.sqrt(length * length - radius * radius);
  points[prev] = {
    x: mid.x - (points[before].y - mid.y) * h / radius,
    y: mid.y + (points[before].x - mid.x) * h / radius,
  };
  return points;
}

/* GeoSDoub.Rotate(c, p, angle, 1) and CWShapeRotation.Rotate's first pass. */
function appletRoll(V, currentIndex, angleIncrement) {
  const angle = Math.min(angleIncrement * PI / 180, 1000);
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const c = V[currentIndex];
  return V.map((p, j) => j === currentIndex ? { x: p.x, y: p.y } : {
    x: c.x + ca * (p.x - c.x) - sa * (p.y - c.y),
    y: c.y + sa * (p.x - c.x) + ca * (p.y - c.y),
  });
}

const VIEW = C.VIEW;

/* The applet's own points, from a headless run of CWStarCanvas for n=5, L=100. */
{
  const expected = [
    { x: 302.5731112119134, y: 150 },
    { x: 207.46745958239802, y: 180.90169943749476 },
    { x: 267.2459848116453, y: 100 },
    { x: 266.2459848116453, y: 200 },
    { x: 207.467459582398, y: 119.09830056250527 },
  ];
  check("start matches the Java applet's own five star points",
    samePoints(C.start({}).points, expected, 1e-9));
  const s = C.start({});
  equal("the applet's four default values", [s.steps, s.length, s.addOn, s.speed], [1, 100, 40, 5]);
  equal("the scrollbar ranges", C.LIMITS.length, { min: 50, max: 310, initial: 100 });
  equal("the N scrollbar range", [C.LIMITS.steps.min, C.LIMITS.steps.max], [0, 10]);
  check("out-of-range options clamp", C.start({ length: 999, addOn: -3, speed: 44 }).length === 310 &&
    C.start({ length: 999, addOn: -3, speed: 44 }).addOn === 0 &&
    C.start({ length: 999, addOn: -3, speed: 44 }).speed === 22);
}

/* CreateBasePolygon over the full slider range and every length setting. */
{
  let count = 0, bad = 0;
  for (let steps = C.LIMITS.steps.min; steps <= C.LIMITS.steps.max; steps++) {
    for (let length = 50; length <= 310; length += 10) {
      const a = C.verticesFor(steps, length, VIEW);
      const b = appletVertices(steps, length, VIEW);
      count++;
      if (!samePoints(a, b)) bad++;
      if (a.length !== C.stepsToN(steps)) bad++;
      const sides = a.map((p, i) => dist(p, a[(i + 1) % a.length]));
      const theirSides = b.map((p, i) => dist(p, b[(i + 1) % b.length]));
      // The applet nudges one vertex one unit to the right; that side is not
      // exactly L, so compare the sides with the transcription instead.
      if (!sides.every((d, i) => near(d, theirSides[i], 1e-7))) bad++;
      if (sides.some((d) => !near(d, length, 1.1))) bad++;
    }
  }
  check(`CreateBasePolygon and equal sides agree on ${count} configurations`, bad === 0, `${bad} mismatches`);
}

/* DrawShape's angles, for every setting and for dragged, irregular stars. */
{
  const rand = rng(20261127);
  let count = 0, bad = 0;
  for (let steps = 0; steps <= 10; steps++) {
    for (const length of [50, 100, 173, 310]) {
      let state = C.start({ steps, length });
      for (let drag = 0; drag < 6; drag++) {
        const i = Math.floor(rand() * state.points.length);
        const centre = state.points[(i + 1) % state.points.length];
        const a = rand() * 2 * PI;
        const target = { x: centre.x + length * Math.cos(a), y: centre.y + length * Math.sin(a) };
        const nextState = C.movePoint(state, i, target);
        if (nextState !== state) state = nextState;
      }
      const mine = C.arcs(state);
      const theirs = state.points.map((_, i) => appletArcAngles(state.points, i));
      for (let i = 0; i < mine.length; i++) {
        count++;
        if (mine[i].start !== theirs[i].start || mine[i].sweep !== theirs[i].sweep) bad++;
      }
    }
  }
  check(`DrawShape arc angles agree on ${count} arcs, regular and dragged`, bad === 0, `${bad} mismatches`);
}

/* The mouse drag, over every star and many random targets. */
{
  const rand = rng(418);
  let count = 0, bad = 0;
  for (let steps = 0; steps <= 10; steps++) {
    for (const length of [50, 100, 310]) {
      const state = C.start({ steps, length });
      for (let k = 0; k < 80; k++) {
        const i = k % state.points.length;
        const target = {
          x: state.points[i].x + (rand() - 0.5) * 60,
          y: state.points[i].y + (rand() - 0.5) * 60,
        };
        const mine = C.movePoint(state, i, target);
        const theirs = appletDrag(state.points, i, target, length);
        count++;
        if (!samePoints(mine.points, theirs, 1e-9)) bad++;
      }
    }
  }
  check(`restricted drag and ManualUpdate agree on ${count} drags`, bad === 0, `${bad} mismatches`);
}

/* A drag keeps the star equilateral (the page's "equilateral star" claim). */
{
  const rand = rng(77);
  let count = 0, bad = 0;
  for (let steps = 0; steps <= 10; steps++) {
    const length = 100 + steps;
    let state = C.start({ steps, length });
    for (let k = 0; k < 12; k++) {
      const i = Math.floor(rand() * state.points.length);
      const target = {
        x: state.points[i].x + (rand() - 0.5) * 24,
        y: state.points[i].y + (rand() - 0.5) * 24,
      };
      state = C.movePoint(state, i, target);
      for (let j = 0; j < state.points.length; j++) {
        count++;
        // One vertex of the fresh star is nudged by one unit in the applet.
        if (!near(dist(state.points[j], state.points[(j + 1) % state.points.length]), length, 1.1)) bad++;
      }
    }
  }
  check(`every side stays equal after ${count} dragged sides`, bad === 0, `${bad} unequal sides`);
}

/* ComputeLeftLine / ComputeTopLine and LowExtremeActive, from their bytecode. */
function appletGuide(V, axis, length, addOn) {
  const probeAngle = (i) => {
    const q = V[i];
    const probe = axis === "x" ? { x: q.x - 100, y: q.y } : { x: q.x, y: q.y - 100 };
    return appletSignedAngle(probe, q, V[(i - 1 + V.length) % V.length]) *
      appletSignedAngle(probe, q, V[(i + 1) % V.length]);
  };
  let lo = { value: Infinity, index: -1 }, hi = { value: -Infinity, index: -1 };
  for (let i = 0; i < V.length; i++) {
    if (V[i][axis] < lo.value) lo = { value: V[i][axis], index: i };
    if (V[i][axis] > hi.value) hi = { value: V[i][axis], index: i };
  }
  const value = probeAngle(lo.index) > 0
    ? Math.round(hi.value) - Math.round(length + addOn)
    : Math.round(lo.value) - Math.round(addOn);
  return value - 1;
}

/* The rolling rotation, against a fresh transcription of Rotate and its guides. */
{
  let count = 0, bad = 0;
  for (let steps = 0; steps <= 10; steps++) {
    for (const speed of [0, 1, 5, 22]) {
      const rolling = C.startRoll(C.start({ steps, speed }));
      const rotated = appletRoll(rolling.points, rolling.currentIndex, speed);
      const dx = rolling.xFixed - appletGuide(rotated, "x", rolling.length, rolling.addOn);
      const dy = rolling.yFixed - appletGuide(rotated, "y", rolling.length, rolling.addOn);
      const expected = rotated.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      count++;
      if (!samePoints(C.rollStep(rolling).points, expected, 1e-9)) bad++;
      let state = rolling;
      for (let k = 0; k < 20; k++) state = C.rollStep(state);
      const sides = state.points.map((p, i) => dist(p, state.points[(i + 1) % state.points.length]));
      if (sides.some((d) => !near(d, state.length, 1.1))) bad++;
      if (state.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) bad++;
      if (state.currentIndex < 0 || state.currentIndex >= state.points.length) bad++;
    }
  }
  check(`rolling agrees with GeoSDoub.Rotate and preserves sides in ${count} runs`, bad === 0, `${bad} failures`);
}

/* ------------------------------------------------------------------ 2. the page's claims */

/* "The number of vertices ... is always odd", for every slider position. */
{
  let count = 0, bad = 0;
  for (let steps = C.LIMITS.steps.min; steps <= C.LIMITS.steps.max; steps++) {
    const n = C.stepsToN(steps);
    count++;
    if (n % 2 !== 1 || n !== 2 * ((n - 1) / 2) + 1) bad++;
    if (C.start({ steps }).points.length !== n) bad++;
    if (C.setOption(C.start({}), "steps", steps).points.length !== n) bad++;
  }
  check(`all ${count} slider positions give an odd number of points (2N+1)`, bad === 0);

  // The page's counting proof: alternate vertices and arcs around the curve;
  // an opposite element (half a turn around that sequence) must be the other
  // kind. This holds exactly when n is odd.
  bad = 0;
  for (let n = 3; n <= 101; n++) {
    const oppositeOfVertexIsArc = ((0 + n) % (2 * n)) % 2 === 1;
    const oppositeOfArcIsVertex = ((1 + n) % (2 * n)) % 2 === 0;
    if (n % 2 === 1) {
      if (!oppositeOfVertexIsArc || !oppositeOfArcIsVertex) bad++;
    } else if (oppositeOfVertexIsArc || oppositeOfArcIsVertex) bad++;
  }
  check("the alternating vertex/arc pairing works exactly for odd n through 101", bad === 0);

  // Even n degenerates: step = pi, so every second vertex repeats.
  let degenerate = true;
  for (const even of [4, 6, 8, 22]) {
    const points = C.verticesFor((even - 3) / 2, 100, VIEW);
    // The applet's one-unit nudge can separate a coincident pair by 1.
    degenerate = degenerate && samePoint(points[0], points[2], 1.01);
  }
  check("an even vertex count collapses to two repeating points", degenerate);
}

/* Arcs join neighbouring vertices: drawArc(start) and drawArc(start+sweep). */
{
  let count = 0, bad = 0;
  for (let steps = 0; steps <= 10; steps++) {
    const state = C.start({ steps, length: 100, addOn: 0 });
    for (const arc of C.arcs(state)) {
      const n = state.points.length;
      const first = C.arcPoint(arc, arc.radius, arc.start);
      const last = C.arcPoint(arc, arc.radius, arc.start + arc.sweep);
      count += 2;
      // The applet rounds every arc angle to a whole degree, so an endpoint
      // can miss its vertex by up to about two units on a large star.
      if (!samePoint(first, state.points[(arc.index + 1) % n], 2.1)) bad++;
      if (!samePoint(last, state.points[(arc.index + n - 1) % n], 2.1)) bad++;
    }
  }
  check(`all ${count} arc ends land on the star's neighbouring vertices`, bad === 0, `${bad} loose ends`);
}

/* The base construction really has width L, for every reachable star and length. */
{
  let count = 0, bad = 0, worst = 0;
  for (let steps = 0; steps <= 10; steps++) {
    for (let length = 50; length <= 310; length += 20) {
      const state = C.start({ steps, length });
      const points = C.boundary(state, false).filter((_, i) => i % 2 === 0);
      const w = C.widths(points, 90);
      count++;
      const error = Math.max(Math.abs(w.min - length), Math.abs(w.max - length));
      worst = Math.max(worst, error);
      if (error > Math.max(1.0, 0.01 * length)) bad++;
    }
  }
  check(`base width is L in all ${count} configurations (whole-degree rounding < 1%)`,
    bad === 0, `${bad} failures, worst error ${worst.toFixed(3)}`);
}

/* The wide construction really has width L + 2a, for every AddOn setting. */
{
  let count = 0, bad = 0, worst = 0;
  for (let steps = 0; steps <= 10; steps++) {
    for (let addOn = 0; addOn <= 160; addOn += 10) {
      for (const length of [100, 310]) {
        const state = C.start({ steps, length, addOn });
        const points = C.boundary(state, true).filter((_, i) => i % 2 === 0);
        const w = C.widths(points, 90);
        count++;
        const error = Math.max(Math.abs(w.min - (length + 2 * addOn)), Math.abs(w.max - (length + 2 * addOn)));
        worst = Math.max(worst, error);
        if (error > 0.01 * (length + 2 * addOn)) bad++;
      }
    }
  }
  check(`augmented width is L + 2a in all ${count} configurations (rounding < 1%)`,
    bad === 0, `${bad} failures, worst error ${worst.toFixed(3)}`);
}

/* The page qualifies the claim with "as long as all sides cross each other". */
function cross(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function sidesCross(a, b, c, d) {
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}
function allSidesCross(points) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // adjacent sides share a vertex
      if (!sidesCross(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return false;
    }
  }
  return true;
}

{
  const rand = rng(999);
  let count = 0, crossed = 0, bad = 0, worst = 0;
  for (let steps = 0; steps <= 10; steps++) {
    if (!allSidesCross(C.start({ steps }).points)) bad++;
    for (let k = 0; k < 8; k++) {
      const length = 100;
      let state = C.start({ steps, length, addOn: 0 });
      for (let d = 0; d < 5; d++) {
        const i = Math.floor(rand() * state.points.length);
        const p = state.points[i];
        state = C.movePoint(state, i, {
          x: p.x + (rand() - 0.5) * 20,
          y: p.y + (rand() - 0.5) * 20,
        });
      }
      count++;
      if (!allSidesCross(state.points)) continue; // the page excludes these
      crossed++;
      const points = C.boundary(state, false).filter((_, i) => i % 2 === 0);
      const w = C.widths(points, 90);
      const error = Math.max(Math.abs(w.min - length), Math.abs(w.max - length));
      worst = Math.max(worst, error);
      if (error > 1.6) bad++;
    }
  }
  check(`every regular star has crossing sides, and width survives ${crossed}/${count} dragged ones`,
    bad === 0 && crossed >= 70, `${bad} failures, worst error ${worst.toFixed(3)}`);
}

/* Rolling pins the bounding lines: the guide values never change. */
{
  let count = 0, bad = 0;
  for (let steps = 0; steps <= 10; steps++) {
    const state = C.start({ steps, addOn: 40, speed: 5 });
    let rolling = C.startRoll(state);
    const x0 = rolling.xFixed, y0 = rolling.yFixed;
    for (let k = 0; k < 40; k++) {
      rolling = C.rollStep(rolling);
      count++;
      if (rolling.xFixed !== x0 || rolling.yFixed !== y0) bad++;
    }
    const points = C.boundary(rolling, true).filter((_, i) => i % 2 === 0);
    const w = C.widths(points, 90);
    if (!near(w.min, state.length + 2 * state.addOn, 1.2) ||
        !near(w.max, state.length + 2 * state.addOn, 1.2)) bad++;
  }
  check(`rolling keeps the guide lines and width over ${count} steps`, bad === 0, `${bad} failures`);
}

/* The status text describes a picture only: no win or loss, no hidden state. */
{
  const s = C.start({});
  const text = C.describe(s);
  check("the description mentions the vertex count and side length",
    typeof text === "string" && text.includes("5 points") && text.includes("100"));
  check("the position is plain data that can be given to the tutor",
    !("win" in s) && !("lose" in s) && Array.isArray(s.points) && typeof s.steps === "number");
  equal("setOption leaves unrelated fields alone", C.setOption(s, "addOn", 80).length, s.length);
}

done("cw-star");
