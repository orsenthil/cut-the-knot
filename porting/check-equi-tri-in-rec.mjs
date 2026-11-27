#!/usr/bin/env node
"use strict";

/*
 * Logic test for equi-tri-in-rec/equi-tri-in-rec-core.js.
 *
 *   node porting/check-equi-tri-in-rec.mjs
 *
 * The page claims that erecting equilateral triangles CDX and BCY with the
 * same orientation, then meeting AX with BC at P and AY with CD at Q, gives an
 * equilateral APQ "for any parallelogram"; for a rectangle it adds that X and
 * Y are the midpoints of AP and AQ. This test checks those claims over a grid
 * of rectangles, every reachable drag of the four corners, and seeded random
 * parallelograms, including very flat and very tall ones. It also transcribes
 * Rotate, Intersect, EquilateralT, Compute and UpgradePoints from the Java
 * bytecode a second time and compares every answer with the core.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equi-tri-in-rec/equi-tri-in-rec-core.js", "EquiTriInRecCore");
const TAU = Math.PI / 3;

const close = (a, b, tol = 1e-7) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const same = (p, q, tol = 1e-7) => finite(p) && finite(q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const cross = (p, q) => p.x * q.y - p.y * q.x;
const cross3 = (a, b, c) => cross(sub(b, a), sub(c, a));
const len = (p) => Math.hypot(p.x, p.y);
const dist = (a, b) => len(sub(a, b));

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("the opening A", s.A, { x: 120, y: 114 });
  equal("the opening B", s.B, { x: 120, y: 246 });
  equal("the opening C", s.C, { x: 280, y: 246 });
  equal("the opening D", s.D, { x: 280, y: 114 });
  check("the four checkboxes start clear", !s.names && !s.statement && !s.premise && !s.hint);
  check("an unexplored picture has no result", C.result(s) === null);
  const legal = C.legalMoves(s);
  const types = new Set(legal.map((m) => m.type));
  check("the four corners, four switches and reset are legal",
    ["point", "names", "statement", "premise", "hint", "reset"].every((t) => types.has(t)) &&
    ["A", "B", "C", "D"].every((n) => legal.some((m) => m.type === "point" && m.name === n)));
  check("a bad move is refused",
    C.move(s, { type: "point", name: "X", x: 1, y: 1 }) === null &&
    C.move(s, { type: "point", name: "A", x: NaN, y: 1 }) === null &&
    C.move(s, { type: "names", value: "yes" }) === null &&
    C.move(s, { type: "nonsense" }) === null &&
    C.move(null, { type: "reset" }) === null);
  check("a drag past the edge is clamped to the panel",
    C.limit("A", { x: -50, y: 999 }).x === 3 && C.limit("A", { x: -50, y: 999 }).y === 397 &&
    C.limit("D", { x: 9999, y: -20 }).x === 397 && C.limit("D", { x: 9999, y: -20 }).y === 1 &&
    C.limit("A", { x: NaN, y: 1 }) === null && C.limit("Z", { x: 4, y: 4 }) === null);
  const dragged = C.move(s, { type: "point", name: "A", x: 90, y: 90 });
  check("dragging A moves only A's partners and counts as exploring",
    dragged.A.x === 90 && dragged.A.y === 90 && dragged.B.x === 90 && dragged.D.y === 90 &&
    dragged.C.x === 280 && dragged.C.y === 246 && dragged.moves === 1 && C.result(dragged) === "done");
  check("the parallelogram law survives every drag",
    C.CORNERS.every((name) => {
      const t = C.move(s, { type: "point", name, x: 200, y: 200 });
      return close(t.A.x + t.C.x, t.B.x + t.D.x) && close(t.A.y + t.C.y, t.B.y + t.D.y) &&
        close(t.A.y, t.D.y) && close(t.B.y, t.C.y);
    }));
  const switched = C.move(s, { type: "premise", value: true });
  check("a switch keeps the corners and unlocks the result",
    switched.premise && switched.moves === 1 && C.result(switched) === "done" &&
    JSON.stringify({ A: switched.A, B: switched.B, C: switched.C, D: switched.D }) ===
      JSON.stringify({ A: s.A, B: s.B, C: s.C, D: s.D }));
  check("reset restores the untouched opening",
    JSON.stringify(C.move(dragged, { type: "reset" })) === JSON.stringify(s));
  check("the status line reports three equal sides",
    /AP 160\.5, AQ 160\.5, PQ 160\.5/.test(C.status(s)));
  const flat = { ...s, A: { x: 100, y: 100 }, D: { x: 101, y: 100 } };
  check("the applet's small-side guard is honoured", C.construct(flat) === null &&
    /Move the corners apart/.test(C.status(flat)));
}

/* ------------------------- 2. a second transcription of the applet's code */

// GeoSDoub.Rotate(P, Q, angle, direction): rotate Q about P.
function appletRotate(P, Q, angle, direction) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - direction * sn * (Q.y - P.y),
    y: P.y + direction * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

// GeoSDoub.Intersect(P1,P2,P3,P4), including its |det| < 1 NaN guard.
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
}

// EquiTriInRecCanvas.EquilateralT(p,q): S3 = Rotate(p,q,60,-1),
// S4 = Rotate(q,p,60,+1), apex = Intersect(p,S3,q,S4).
function appletEquilateralT(p, q) {
  const S3 = appletRotate(p, q, 1.0471975511965976, -1);
  const S4 = appletRotate(q, p, 1.0471975511965976, 1);
  return appletIntersect(p, S3, q, S4);
}

// EquiTriInRecCanvas.Compute(), with Dist's sqrt(x*x + y*y) guard.
function appletCompute(st) {
  const apDist = (p, q) => Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
  if (apDist(st.A, st.D) < 2 || apDist(st.A, st.B) < 2) return null;
  const X = appletEquilateralT(st.C, st.D);
  const Y = appletEquilateralT(st.B, st.C);
  const P = appletIntersect(st.A, X, st.B, st.C);
  const Q = appletIntersect(st.A, Y, st.C, st.D);
  return { A: st.A, B: st.B, C: st.C, D: st.D, X, Y, P, Q };
}

// EquiTriInRecCanvas.UpgradePoints(), statement by statement from the bytecode.
function appletUpgrade(s, name) {
  if (name === "A") {
    s.B.x = s.C.x - (s.D.x - s.A.x);
    s.D.y = s.A.y;
  } else if (name === "B") {
    s.A.x = s.D.x - (s.C.x - s.B.x);
    s.C.y = s.B.y;
  } else if (name === "C") {
    s.A.x = s.D.x - (s.C.x - s.B.x);
    s.B.y = s.C.y;
  } else if (name === "D") {
    s.B.x = s.C.x - (s.D.x - s.A.x);
    s.A.y = s.D.y;
  }
}

function appletMove(st, m) {
  if (m.type === "reset") return C.start();
  const next = {
    A: { ...st.A }, B: { ...st.B }, C: { ...st.C }, D: { ...st.D },
    names: st.names, statement: st.statement, premise: st.premise, hint: st.hint,
    moves: st.moves + 1, explored: true,
  };
  if (m.type === "point") {
    next[m.name] = { x: m.x, y: m.y };
    appletUpgrade(next, m.name);
  } else {
    next[m.type] = m.value;
  }
  return next;
}

{
  let n = 0, ok = true;
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const P = { x: -50 + i * 45, y: -40 + j * 44 };
      for (const dir of [-1, 1]) {
        const a = appletRotate(P, { x: 37, y: 291 }, TAU, dir);
        const b = C.rotate(P, { x: 37, y: 291 }, TAU, dir);
        ok = ok && a.x === b.x && a.y === b.y;
        n++;
      }
    }
  }
  check(`Rotate agrees with the bytecode on ${n} rotations`, ok);

  ok = true; n = 0;
  for (let i = 0; i <= 12; i++) {
    for (let j = 0; j <= 12; j++) {
      const p1 = { x: i * 30 - 20, y: j * 27 - 10 };
      const pairs = [
        [p1, { x: p1.x + 70, y: p1.y + 30 }, { x: 10, y: 390 }, { x: 390, y: 10 }],
        [p1, { x: p1.x, y: p1.y + 100 }, { x: 20, y: 10 }, { x: 20, y: 60 }], // parallel
        [p1, { x: p1.x + 100, y: p1.y }, { x: 10, y: 20 }, { x: 60, y: 20 }], // parallel
      ];
      for (const [p2, p3, p4] of pairs) {
        const a = appletIntersect(p1, p2, p3, p4);
        const b = C.intersect(p1, p2, p3, p4);
        ok = ok && (Number.isNaN(a.x) ? Number.isNaN(b.x) && Number.isNaN(b.y) : same(a, b));
        n++;
      }
    }
  }
  check(`Intersect agrees with the bytecode on ${n} pairs, including parallels`, ok);

  ok = true; n = 0;
  for (let i = 0; i <= 14; i++) {
    for (let j = 0; j <= 14; j++) {
      const p = { x: i * 25 - 30, y: j * 25 - 20 };
      const q = { x: p.x + 20 + 7 * j, y: p.y - 35 + 5 * i };
      const a = appletEquilateralT(p, q);
      const b = C.equilateral(p, q);
      ok = ok && same(a, b);
      n++;
    }
  }
  check(`EquilateralT agrees with the bytecode on ${n} sides`, ok);
}

/* ------------------------------------------- 3. the page's claims, exhaustively */

const rand = rng(20261127);
const rectangles = [];
for (const w of [40, 60, 80, 100, 120, 160, 200, 240]) {
  for (const h of [40, 60, 90, 132, 180, 220]) {
    rectangles.push({ A: { x: 100, y: 100 }, B: { x: 100, y: 100 + h },
      C: { x: 100 + w, y: 100 + h }, D: { x: 100 + w, y: 100 } });
  }
}

// Every one-corner drag from the opening, on a grid, is reachable in the applet.
const drags = [];
for (const name of C.CORNERS) {
  for (let x = 20; x <= 380; x += 30) {
    for (let y = 20; y <= 380; y += 30) {
      const t = C.move(C.start(), { type: "point", name, x, y });
      drags.push({ A: t.A, B: t.B, C: t.C, D: t.D });
    }
  }
}

// Two-drag sequences and arbitrary parallelograms: the claim is not limited
// to shapes the applet can reach from its opening rectangle.
const randomParallelograms = [];
for (let i = 0; i < 400; i++) {
  const A = { x: 20 + 360 * rand(), y: 20 + 360 * rand() };
  const u = { x: (rand() - 0.5) * 320, y: (rand() - 0.5) * 320 };
  const v = { x: (rand() - 0.5) * 320, y: (rand() - 0.5) * 320 };
  if (len(u) < 10 || len(v) < 10) continue;
  const B = { x: A.x + u.x, y: A.y + u.y };
  const D = { x: A.x + v.x, y: A.y + v.y };
  randomParallelograms.push({ A, B, C: { x: B.x + v.x, y: B.y + v.y }, D });
}
for (let i = 0; i < 200; i++) {
  let s = C.start();
  for (let k = 0; k < 3; k++) {
    const name = C.CORNERS[Math.floor(4 * rand())];
    s = C.move(s, { type: "point", name, x: 20 + 360 * rand(), y: 20 + 360 * rand() });
  }
  randomParallelograms.push({ A: s.A, B: s.B, C: s.C, D: s.D });
}

const families = [rectangles, drags, randomParallelograms];
let configurations = 0, outsideSegments = 0, skipped = 0;
let allApex = true, allSmall = true, allAxy = true, allOnLines = true;
let allSides = true, allRatio = true, allParallel = true, allMatchesApplet = true;
let allMidpoints = true, rectanglesChecked = 0;

for (const [familyIndex, family] of families.entries()) {
  for (const st of family) {
    const g = C.construct(st);
    const ap = appletCompute(st);
    if (!g || !ap) { skipped++; continue; }
    allMatchesApplet = allMatchesApplet &&
      ["A", "B", "C", "D", "X", "Y", "P", "Q"].every((k) =>
        Number.isNaN(ap[k].x) ? Number.isNaN(g[k].x) && Number.isNaN(g[k].y) : same(ap[k], g[k]));
    if (!finite(g.P) || !finite(g.Q)) { skipped++; continue; }
    const apq = [dist(g.A, g.P), dist(g.A, g.Q), dist(g.P, g.Q)];
    if (Math.min(...apq) < 1e-6) { skipped++; continue; }
    configurations++;

    // The two small triangles are equilateral, with the same orientation.
    allApex = allApex && close(dist(g.C, g.X), dist(g.C, g.D)) &&
      close(dist(g.D, g.X), dist(g.C, g.D)) &&
      close(dist(g.B, g.Y), dist(g.B, g.C)) && close(dist(g.C, g.Y), dist(g.B, g.C));
    allSmall = allSmall && Math.sign(cross3(g.B, g.C, g.Y)) === Math.sign(cross3(g.C, g.D, g.X));
    const axy = [dist(g.A, g.X), dist(g.A, g.Y), dist(g.X, g.Y)];
    allAxy = allAxy && close(axy[0], axy[1]) && close(axy[0], axy[2]);

    // P is on the line BC and Q is on the line CD (the sides may be extended).
    allOnLines = allOnLines && Math.abs(cross3(g.B, g.C, g.P)) <= 1e-5 * dist(g.B, g.C) &&
      Math.abs(cross3(g.C, g.D, g.Q)) <= 1e-5 * dist(g.C, g.D);
    const tP = ((g.P.x - g.B.x) * (g.C.x - g.B.x) + (g.P.y - g.B.y) * (g.C.y - g.B.y)) /
      Math.max(1e-12, dist(g.B, g.C) ** 2);
    const tQ = ((g.Q.x - g.C.x) * (g.D.x - g.C.x) + (g.Q.y - g.C.y) * (g.D.y - g.C.y)) /
      Math.max(1e-12, dist(g.C, g.D) ** 2);
    if (familyIndex === 0 && (tP < -1e-9 || tP > 1 + 1e-9 || tQ < -1e-9 || tQ > 1 + 1e-9)) outsideSegments++;

    allSides = allSides && close(apq[0], apq[1]) && close(apq[0], apq[2]) &&
      close(Math.abs(cross3(g.A, g.P, g.Q)) / (apq[0] * apq[1]), Math.sqrt(3) / 2);
    const ax = dist(g.A, g.X), apx = dist(g.A, g.P);
    const ay = dist(g.A, g.Y), aqy = dist(g.A, g.Q);
    allRatio = allRatio && close(ax / apx, ay / aqy) && close(ax / apx, dist(g.X, g.Y) / dist(g.P, g.Q));
    allParallel = allParallel && Math.abs(cross(sub(g.Y, g.X), sub(g.Q, g.P))) <=
      1e-5 * dist(g.X, g.Y) * dist(g.P, g.Q);

    if (familyIndex === 0) {
      rectanglesChecked++;
      const midY = { x: (g.A.x + g.Q.x) / 2, y: (g.A.y + g.Q.y) / 2 };
      allMidpoints = allMidpoints && same(g.X, { x: (g.A.x + g.P.x) / 2, y: (g.A.y + g.P.y) / 2 }) &&
        same(g.Y, midY) && same(g.P, { x: 2 * g.X.x - g.A.x, y: 2 * g.X.y - g.A.y }) &&
        same(g.Q, { x: 2 * g.Y.x - g.A.x, y: 2 * g.Y.y - g.A.y });
    }
  }
}

check(`Compute agrees with the bytecode on all ${configurations} configurations`, allMatchesApplet);
check("CDX and BCY are equilateral on their sides", allApex);
check("the two small triangles share an orientation", allSmall);
check("AXY is equilateral for every parallelogram, not just rectangles", allAxy);
check("P lies on line BC and Q lies on line CD", allOnLines);
check("APQ is equilateral on every configuration", allSides);
check("AX:AP = AY:AQ and matches XY:PQ", allRatio);
check("XY is parallel to PQ", allParallel);
check(`X and Y are the midpoints of AP and AQ in all ${rectanglesChecked} rectangles`, allMidpoints);
check(`a meaningful configuration was reached ${configurations} times`, configurations > 1000 && skipped < 200);
check("some rectangles put P or Q beyond the side, as the applet draws", outsideSegments > 0);

// The page's proviso: the two small triangles must have the same orientation.
// Build Y on the other side of BC and the equilateral conclusion breaks.
{
  let tried = 0, broken = 0, sameOrientationWorked = 0;
  const flipped = (p, q) => appletIntersect(p, appletRotate(p, q, TAU, 1), q, appletRotate(q, p, TAU, -1));
  for (const st of rectangles.slice(0, 20).concat(randomParallelograms.slice(0, 180))) {
    const g = C.construct(st);
    if (!g || !finite(g.P) || !finite(g.Q)) continue;
    const Y2 = flipped(st.B, st.C);
    const Q2 = appletIntersect(st.A, Y2, st.C, st.D);
    if (!finite(Q2)) continue;
    tried++;
    const sides = [dist(st.A, g.P), dist(st.A, Q2), dist(g.P, Q2)];
    if (Math.max(...sides) - Math.min(...sides) > 1e-4) broken++;
    if (close(dist(g.A, g.P), dist(g.A, g.Q)) && close(dist(g.A, g.P), dist(g.P, g.Q))) sameOrientationWorked++;
  }
  check("flipping BCY's orientation really does break the claim", tried > 100 && broken === tried);
  check("the original orientation keeps the claim on the same shapes", sameOrientationWorked === tried);
}

// iPad-level sweep of direct drags: the core and the bytecode stay identical.
{
  let ok = true, n = 0;
  const rand2 = rng(70707);
  for (let i = 0; i < 300; i++) {
    let cs = C.start(), as = C.start();
    for (let k = 0; k < 5; k++) {
      const name = C.CORNERS[Math.floor(4 * rand2())];
      const x = 10 + 380 * rand2(), y = 10 + 380 * rand2();
      const m = { type: "point", name, x, y };
      cs = C.move(cs, m);
      as = appletMove(as, m);
      ok = ok && JSON.stringify(cs) === JSON.stringify(as);
      n++;
    }
  }
  check(`UpgradePoints matches the bytecode on ${n} chained drags`, ok);
}

done("equi-tri-in-rec");
