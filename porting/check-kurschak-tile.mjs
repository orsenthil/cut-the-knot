#!/usr/bin/env node
"use strict";

/*
 * Logic test for kurschak-tile/kurschak-tile-core.js.
 *
 *   node porting/check-kurschak-tile.mjs
 *
 * The first sections are a second, literal transcription of the bytecode of
 * KurschakTileCanvas.init / MoveThem / SetRotatingPoly and compare it with the
 * core over every array index, every animation step and a wide range of
 * canvas sizes. The last sections check the page's claims (the dodecagon's
 * area is 3 in a unit circle, it is 3/4 of the circumscribed square, the two
 * triangle families tile both shapes, and pi > 3) and the demo's edge cases.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("kurschak-tile/kurschak-tile-core.js", "KurschakTileCore");
const EPS = 1e-9;

const near = (label, actual, expected, tol = EPS) =>
  check(label, Math.abs(actual - expected) <= tol, `expected ${expected}, got ${actual}`);
const samePoint = (a, b, tol = EPS) => Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
const sameTriangle = (a, b, tol = EPS) =>
  a.length === b.length && a.every((p, i) => samePoint(p, b[i], tol));
const order = (pts) => [...pts].sort((p, q) => p.x - q.x || p.y - q.y);
const sameTriangleSet = (a, b, tol = EPS) => sameTriangle(order(a), order(b), tol);
const area = (pts) => {
  let twice = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    twice += p.x * q.y - q.x * p.y;
  }
  return Math.abs(twice) / 2;
};
const bary = (p) => ({
  x: (p[0].x + p[1].x + p[2].x) / 3,
  y: (p[0].y + p[1].y + p[2].y) / 3,
});
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* ------------------------------------------- 1. the bytecode, a second time */

/*
 * KurschakTileCanvas.init, transcribed from javap: the constants are kept
 * exactly as they appear in the class file (0x0.8...? no: 0.5235987755982988
 * = 30 degrees, 0.2617993877991494 = 15 degrees).
 */
function appletInit(width, height) {
  const Cpt = { x: width / 2, y: height / 2 };
  const R = Math.min(width, height) / 2.5;
  const d = 0.5235987755982988;
  const h = 0.2617993877991494;
  const k = R / 2 / Math.cos(h);
  const V = [], W = [];
  for (let i = 0; i < 12; i++) {
    V.push({
      x: Cpt.x + R * Math.cos(d * i),
      y: Cpt.y + R * Math.sin(d * i),
    });
    W.push({
      x: Cpt.x + k * Math.cos(h + d * i),
      y: Cpt.y + k * Math.sin(h + d * i),
    });
  }
  const U = [
    { x: Cpt.x + R, y: Cpt.y + R },
    { x: Cpt.x - R, y: Cpt.y + R },
    { x: Cpt.x - R, y: Cpt.y - R },
    { x: Cpt.x + R, y: Cpt.y - R },
  ];
  return { C: Cpt, R, V, W, U };
}

/* The two init loops that fill Pieces[0..35]. */
function appletPieces(g) {
  const pieces = [];
  for (let i = 0; i < 12; i++) {
    const j = (i + 1) % 12;
    pieces.push([g.C, g.V[i], g.W[i]]);
    pieces.push([g.C, g.W[i], g.V[j]]);
  }
  for (let i = 0; i < 12; i++) pieces.push([g.V[i], g.V[(i + 1) % 12], g.W[i]]);
  return pieces;
}

/* MoveThem: piece index and the three points passed to SetRotatingPoly. */
function appletMoves(g) {
  const { U, V } = g;
  return [
    [0, U[3], V[0], V[11]],
    [1, U[3], V[9], V[10]],
    [2, U[2], V[9], V[8]],
    [3, U[2], V[7], V[6]],
    [4, U[1], V[6], V[5]],
    [5, U[1], V[4], V[3]],
    [24, V[11], V[10], U[3]],
    [25, V[8], V[7], U[2]],
    [26, U[1], V[5], V[4]],
  ];
}

/* GeoSDoub.ComputeSignedAngle: acos of the cosine law, signed by orientation. */
function appletAngle(a, b, c) {
  const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const cos = (sq(a, b) + sq(a, c) - sq(b, c)) / (2 * Math.sqrt(sq(a, b) * sq(a, c)));
  let angle = Math.acos(Math.max(-1, Math.min(1, cos)));
  const orientation = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (orientation < 0) angle = -angle;
  if (angle < 0) angle += 2 * Math.PI;
  return angle;
}

/* RotatingPoly at step t: rotate about the start barycentre, move its centre. */
function appletFrame(startPts, finalPts, step) {
  if (step >= 30) return finalPts;
  const from = bary(startPts);
  const edge = { x: finalPts[1].x - finalPts[0].x, y: finalPts[1].y - finalPts[0].y };
  const shifted = { x: startPts[0].x + edge.x, y: startPts[0].y + edge.y };
  const angle = appletAngle(startPts[0], startPts[1], shifted);
  const fraction = step / 30;
  const to = bary(finalPts);
  const centre = {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  };
  return startPts.map((p) => {
    const x = p.x - from.x, y = p.y - from.y;
    return {
      x: centre.x + x * Math.cos(angle * fraction) - y * Math.sin(angle * fraction),
      y: centre.y + x * Math.sin(angle * fraction) + y * Math.cos(angle * fraction),
    };
  });
}

{
  const sizes = [
    [500, 450], [400, 250], [320, 200], [375, 900], [900, 375],
    [137, 137], [401, 399], [1000, 999], [257, 653], [640, 480],
  ];
  let pointsChecked = 0;
  for (const [width, height] of sizes) {
    const java = appletInit(width, height);
    const core = C.geometry(C.start({ width, height }));
    check(`init centre ${width}x${height}`, samePoint(core.C, java.C) && core.r === java.R);
    for (let i = 0; i < 12; i++) {
      check(`init V[${i}] ${width}x${height}`, samePoint(core.V[i], java.V[i], 1e-8));
      check(`init W[${i}] ${width}x${height}`, samePoint(core.W[i], java.W[i], 1e-8));
      pointsChecked += 2;
    }
    for (let j = 0; j < 4; j++) check(`init U[${j}] ${width}x${height}`, samePoint(core.U[j], java.U[j]));
    const javaPieces = appletPieces(java);
    const all = [...core.iso, ...core.equi];
    check(`piece count ${width}x${height}`, all.length === 36 && javaPieces.length === 36);
    for (let i = 0; i < 36; i++) {
      check(`piece ${i} ${width}x${height}`, sameTriangle(all[i], javaPieces[i], 1e-8));
    }
    const coreMoves = C.movingSpecs(core);
    const javaMoves = appletMoves(java);
    for (let i = 0; i < 9; i++) {
      check(`MoveThem ${i} index ${width}x${height}`, coreMoves[i].piece === javaMoves[i][0]);
      check(`MoveThem ${i} target ${width}x${height}`,
        sameTriangle(coreMoves[i].final, javaMoves[i].slice(1), 1e-8));
    }
  }
  check("geometry compared over all sizes and indices", pointsChecked === sizes.length * 24);
}

/* -------------------------------------------- 2. the 30 frames, every piece */

{
  const state = C.start({});
  const g = C.geometry(state);
  const javaPieces = appletPieces(appletInit(state.width, state.height));
  const javaMoves = appletMoves(appletInit(state.width, state.height));
  check("a fresh move is not over", C.result(state) === null);
  check("the applet's animation lasts 30 steps", C.STEPS === 30);
  let framesChecked = 0;
  for (let step = 0; step <= 30; step++) {
    const at = { ...state, step, moving: step < 30 };
    const pieces = C.positions(at);
    check(`45 pieces at step ${step}`, pieces.length === (step === 0 ? 36 : 45));
    check(`nine hidden originals at step ${step}`,
      pieces.filter((p) => p.hidden).length === (step === 0 ? 0 : 9));
    if (step === 0) {
      check("step 0 shows the untouched star", pieces.every((p, i) =>
        sameTriangle(p.points, javaPieces[i], 1e-8)));
      continue;
    }
    for (let m = 0; m < 9; m++) {
      const [index, ...final] = javaMoves[m];
      const expected = appletFrame(javaPieces[index], final, step);
      const actual = pieces.find((p) => p.moving && p.id === index);
      check(`moving piece ${m} at step ${step}`,
        !!actual && sameTriangle(actual.points, expected, 1e-7));
      framesChecked++;
      if (step > 0 && step < 30) {
        // Every intermediate frame is a rigid copy of the original triangle.
        const original = javaPieces[index];
        const lengths = (pts) => [dist(pts[0], pts[1]), dist(pts[1], pts[2]), dist(pts[0], pts[2])]
          .sort((a, b) => a - b);
        const a = lengths(original), b = lengths(actual.points);
        check(`rigid piece ${m} at step ${step}`,
          a.every((len, i) => Math.abs(len - b[i]) < 1e-7));
      }
    }
  }
  check("all frames of all nine pieces compared", framesChecked === 9 * 30);
}

/* --------------------------------------------- 3. the page's exact claims */

{
  const claim = C.claim(1);
  near("unit-circle dodecagon area is 3", claim.dodecagon, 3);
  near("shoelace area of the dodecagon is 3", claim.polygon, 3);
  near("circumscribed square has area 4", claim.square, 4);
  near("dodecagon occupies 3/4 of the square", claim.ratio, 0.75);
  near("outside pieces add to 1", claim.outside, 1);
  near("24 small triangles + 12 regular cover the dodecagon",
    claim.dodecagon, 24 * claim.thin + 12 * claim.regular);
  near("8 small triangles + 4 regular cover the rest of the square",
    claim.square - claim.dodecagon, 8 * claim.thin + 4 * claim.regular);
  near("thin and regular pieces share a side", claim.side, claim.equalSide);
  near("thin triangle area equals tan(15)/4",
    claim.thin, Math.tan(Math.PI / 12) / 4, 1e-12);
  near("regular triangle area equals sqrt(3)/4 times side squared",
    claim.regular, Math.sqrt(3) / 4 * claim.side ** 2, 1e-12);
  check("pi exceeds the claimed area 3", Math.PI > 3);
  check("pi exceeds the dodecagon's area", Math.PI > claim.polygon);
  near("the general formula is (n/2)sin(2pi/n) with n=12",
    6 * Math.sin(2 * Math.PI / 12), 3);

  // Every radius obeys the same scaling law; sizes come from the applet's
  // preferred canvas and from very small and very large canvases.
  for (const r of [0.01, 0.5, 1, 1.6, 4, 18, 100, 250]) {
    const c = C.claim(r);
    near(`scaled dodecagon area at r=${r}`, c.dodecagon, 3 * r * r, 1e-8);
    near(`scaled square area at r=${r}`, c.square, 4 * r * r, 1e-8);
    near(`scaled ratio at r=${r}`, c.ratio, 0.75);
  }
}

/* ------------------------------------------ 4. the triangles really tile it */

{
  const g = C.geometry(C.start({}));
  const angles = (pts) => {
    const sides = [dist(pts[1], pts[2]), dist(pts[0], pts[2]), dist(pts[0], pts[1])];
    return sides.map((s, i) => {
      const a = sides[(i + 1) % 3], b = sides[(i + 2) % 3];
      return Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - s * s) / (2 * a * b)))) * 180 / Math.PI;
    }).sort((x, y) => x - y);
  };
  for (let i = 0; i < 24; i++) {
    const a = angles(g.iso[i]);
    check(`thin piece ${i} is 15-15-150`,
      Math.abs(a[0] - 15) < 1e-7 && Math.abs(a[1] - 15) < 1e-7 && Math.abs(a[2] - 150) < 1e-7);
  }
  for (let i = 0; i < 12; i++) {
    const a = angles(g.equi[i]);
    check(`blue piece ${i} is equilateral`, a.every((v) => Math.abs(v - 60) < 1e-7));
  }
  const corners = C.outer(g);
  check("four outer corners have twelve triangles", corners.length === 4 &&
    corners.every((c) => c.length === 3));
  let thin = 0, equi = 0, outerArea = 0;
  for (const group of corners) {
    thin += group.filter((x) => x.kind === "iso").length;
    equi += group.filter((x) => x.kind === "equi").length;
    for (const tri of group) outerArea += area(tri.points);
  }
  equal("outer tiling has 8 thin and 4 regular triangles", [thin, equi], [8, 4]);
  near("outer triangles cover exactly one square unit", outerArea, g.r * g.r, 1e-7);

  // The nine final targets are precisely three of those four corners.
  const targets = C.movingSpecs(g).map((s) => s.final);
  const cornerTargets = corners.slice(1); // U[1], U[2], U[3]
  for (let j = 0; j < 3; j++) {
    for (const tri of cornerTargets[j]) {
      check(`corner U[${j + 1}] triangle is a final target`,
        targets.some((t) => sameTriangleSet(t, tri.points, 1e-7)));
    }
  }
  check("the fourth corner U[0] gets no piece",
    !targets.some((t) => t.some((p) => samePoint(p, g.U[0], 1e-7))));
  const movedArea = targets.reduce((s, t) => s + area(t), 0);
  near("moved pieces cover three quarter-corners", movedArea,
    6 * C.claim(g.r).thin + 3 * C.claim(g.r).regular, 1e-7);
}

/* -------------------------------------------- 5. options, names and state */

{
  const s = C.start({});
  equal("initial options", [s.showHint, s.showNames, s.step, s.moving], [false, false, 0, false]);
  const named = C.start({ width: 400, height: 250, showHint: true, showNames: true });
  check("start reads its options", named.width === 400 && named.height === 250 &&
    named.showHint && named.showNames);
  const labels = C.labels(C.geometry(s));
  equal("the applet's thirteen names", labels.map((x) => x.name),
    ["A", "B", "C", "D", "E", "F", "G", "H", "M", "N", "K", "L", "O"]);
  check("hint has the bytecode's 76 segments", C.hints(C.geometry(s)).length === 48 + 8 + 12 + 8);

  const shown = C.move(s, { type: "option", key: "showHint", value: true });
  check("ticking hint keeps the position", shown.showHint && shown.step === 0 && s.showHint === false);
  check("unknown options are refused", C.move(s, { type: "option", key: "nope", value: true }) === null);
  check("advance needs a running move", C.move(s, { type: "advance" }) === null);
  let t = C.move(shown, { type: "move" });
  check("Move them starts at step 0", t.step === 0 && t.moving);
  for (let i = 0; i < 29; i++) t = C.move(t, { type: "advance" });
  check("step 29 is still moving", t.step === 29 && t.moving && C.result(t) === null);
  t = C.move(t, { type: "advance" });
  check("step 30 ends the demo", t.step === 30 && !t.moving && C.result(t) === "done");
  check("there is no win or loss in a demo",
    C.result(t) !== "win" && C.result(t) !== "lose");
  check("no more advances after the last step", C.move(t, { type: "advance" }) === null);
  const reset = C.move(t, { type: "reset" });
  check("Reset hides no pieces", reset.step === 0 && !reset.moving &&
    C.positions(reset).every((p) => !p.hidden));
  check("the scrubber clamps below zero", C.move(s, { type: "step", value: -20 }).step === 0);
  check("the scrubber clamps above thirty", C.move(s, { type: "step", value: 99 }).step === 30);
  check("the scrubber stops the animation", C.move(t, { type: "step", value: 15 }).step === 15 &&
    C.move(t, { type: "step", value: 15 }).moving === false);
  check("unknown actions are refused", C.move(s, { type: "fly" }) === null);
}

done("kurschak-tile");
