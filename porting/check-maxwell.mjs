#!/usr/bin/env node
"use strict";

/*
 * Logic test for maxwell/maxwell-core.js.
 *
 *   node porting/check-maxwell.mjs
 *
 * Checks the opening figure against MaxwellCanvas.init(), then writes the
 * applet's own construction a second time straight from the bytecode (the
 * GeoSDoub line helpers, UpdateTriangleParallel/Perpendicular, CheckForUpdate
 * and MaxwellPanel.itemStateChanged) and compares the two over board sizes,
 * both modes and hundreds of random drags of all eight points. The page's
 * claims are checked on a grid and on the random configurations: the sides of
 * A'B'C' follow the cevians of ABC, the matching cevians of A'B'C' concur at
 * P', the two triangles keep the same perimeter, and the parallel and
 * perpendicular versions are the same statement after a quarter turn.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("maxwell/maxwell-core.js", "MaxwellCore");
const TOL = 1e-7;

const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const samePt = (a, b, tol = TOL) => finite(a) && finite(b) &&
  near(a.x, b.x, tol) && near(a.y, b.y, tol);
const maxErr = (xs) => xs.some((x) => !Number.isFinite(x)) ? NaN : Math.max(...xs);

/* ------------------------------------------------- 1. the opening figure */

{
  const s = C.start();
  check("the default board is the applet's 600 by 450", s.width === 600 && s.height === 450);
  check("the open picture is in Parallel mode and will update triangle 1",
    s.parallel === true && s.target === 1);
  check("the opening P is the circumcentre of the three applet points",
    samePt(s.P[0], { x: 200, y: 225 }, 1e-9));
  check("the opening A, B, C use -1.6, -4.0 and -0.2 radians at radius 90",
    samePt(s.A[0], { x: 200 + 90 * Math.cos(-1.6), y: 225 + 90 * Math.sin(-1.6) }, 1e-9) &&
    samePt(s.B[0], { x: 200 + 90 * Math.cos(-4), y: 225 + 90 * Math.sin(-4) }, 1e-9) &&
    samePt(s.C[0], { x: 200 + 90 * Math.cos(-0.2), y: 225 + 90 * Math.sin(-0.2) }, 1e-9));
  check("G1 starts reflected across the board's centre line",
    samePt(s.G[1], { x: 600 - s.G[0].x, y: s.G[0].y }, 1e-9));
  check("all eight opening points are finite", [s.A, s.B, s.C, s.P].every((v) => v.every(finite)));
  check("the two opening triangles have the same perimeter",
    near(C.perimeter(s, 0), C.perimeter(s, 1), 1e-8));
  check("the page's concurrency claim holds in the opening figure", maxErr(C.concurrency(s, 1)) < TOL);
  check("the opening sides follow the cevians through P", maxErr(C.sideErrors(s, 1)) < TOL);
}

/* -------------------------------- 2. an independent transcription of the code */

/*
 * These helpers are written again from javap output, with the applet's own
 * variable names and operation order. Intersect uses line coefficients
 * a = y0-y1, b = x1-x0, c = x0*y1-y0*x1 and declares parallel when
 * |a*b2 - a2*b| < 1. GeoSDoub.FindAltitude adds (dy, -dx) to the point before
 * intersecting with the base line; GetParallelTo adds 100*(B-C).
 */
function jIntersect(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const denominator = a1 * b2 - a2 * b1;
  if (Math.abs(denominator) < 1) return { x: NaN, y: NaN };
  return {
    x: (b1 * c2 - b2 * c1) / denominator,
    y: (c1 * a2 - c2 * a1) / denominator,
  };
}
function jAltitude(p, a, b) {
  const far = { x: p.x + b.y - a.y, y: p.y + a.x - b.x };
  return jIntersect(p, far, a, b);
}
function jParallel(a, b, c) {
  return { x: a.x + 100 * (b.x - c.x), y: a.y + 100 * (b.y - c.y) };
}
function jDistance(p, q) { return Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2); }
function jCircumcentre(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const n1 = { x: m1.x + b.y - a.y, y: m1.y - (b.x - a.x) };
  const n2 = { x: m2.x + c.y - b.y, y: m2.y - (c.x - b.x) };
  return jIntersect(m1, n1, m2, n2);
}
function jPerimeter(g, i) {
  return jDistance(g.A[i], g.B[i]) + jDistance(g.C[i], g.B[i]) + jDistance(g.A[i], g.C[i]);
}
function jCentroid(g, i) {
  return {
    x: (g.A[i].x + g.B[i].x + g.C[i].x) / 3,
    y: (g.A[i].y + g.B[i].y + g.C[i].y) / 3,
  };
}
function jScale(p, target, centre, ratio) {
  return {
    x: target.x + (p.x - centre.x) * ratio,
    y: target.y + (p.y - centre.y) * ratio,
  };
}
function jUpdate(g, i) {
  const j = 1 - i;
  const Ai = g.A[i], Aj = g.A[j], Bj = g.B[j], Cj = g.C[j], Pj = g.P[j];
  let Ci;
  if (g.parallel === false) {
    Ci = { x: Ai.x + Bj.y - Pj.y, y: Ai.y - (Bj.x - Pj.x) };
    g.C[i] = Ci;
    g.B[i] = jIntersect(Ai, jAltitude(Ai, Cj, Pj), Ci, jAltitude(Ci, Aj, Pj));
  } else {
    const bx = Bj.x - Pj.x, by = Bj.y - Pj.y;
    Ci = j === 0
      ? { x: Ai.x - bx, y: Ai.y - by }
      : { x: Ai.x + bx, y: Ai.y + by };
    g.C[i] = Ci;
    g.B[i] = jIntersect(Ai, jParallel(Ai, Cj, Pj), Ci, jParallel(Ci, Aj, Pj));
  }
  const ratio = g.Pe / jPerimeter(g, i);
  const centre = jCentroid(g, i);
  const old = g.G[i];
  g.A[i] = jScale(g.A[i], old, centre, ratio);
  g.B[i] = jScale(g.B[i], old, centre, ratio);
  g.C[i] = jScale(g.C[i], old, centre, ratio);
  const farA = g.parallel === false
    ? jAltitude(g.A[i], Bj, Cj) : jParallel(g.A[i], Bj, Cj);
  const farB = g.parallel === false
    ? jAltitude(g.B[i], Aj, Cj) : jParallel(g.B[i], Aj, Cj);
  g.P[i] = jIntersect(g.A[i], farA, g.B[i], farB);
}
function jStart(width, height, parallel) {
  const x0 = width / 3, y0 = height / 2, r = Math.min(width, height) / 5;
  const point = (angle) => ({ x: x0 + r * Math.cos(angle), y: y0 + r * Math.sin(angle) });
  const A0 = point(-1.6), B0 = point(-4.0), C0 = point(-0.2);
  const g = {
    width, height, parallel, target: 1, Pe: 0,
    A: [A0, { x: 0, y: 0 }], B: [B0, { x: 0, y: 0 }],
    C: [C0, { x: 0, y: 0 }], P: [jCircumcentre(A0, B0, C0), { x: 0, y: 0 }],
    G: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
  };
  g.Pe = jPerimeter(g, 0);
  g.G[0] = jCentroid(g, 0);
  g.G[1] = { x: width - g.G[0].x, y: g.G[0].y };
  jUpdate(g, 1);
  return g;
}
function jMove(g, name, q) {
  const m = /^([ABCP])([01])$/.exec(name);
  const i = Number(m[2]);
  const key = { A: "A", B: "B", C: "C", P: "P" }[m[1]];
  g[key][i] = { x: q.x, y: q.y };
  if (m[1] !== "P") g.Pe = jPerimeter(g, i);
  g.G[i] = jCentroid(g, i);
  g.target = 1 - i;
  jUpdate(g, g.target);
}
function sameState(label, s, g) {
  let worst = 0;
  let bad = "";
  for (const key of ["A", "B", "C", "P", "G"]) {
    for (let i = 0; i < 2; i++) {
      const a = s[key][i], b = g[key][i];
      if (!finite(a) || !finite(b)) {
        if (finite(a) !== finite(b)) { bad += ` ${key}${i}:finite`; worst = Infinity; }
        continue;
      }
      const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      if (d > worst) { worst = d; bad = ` ${key}${i}`; }
    }
  }
  check(label + " matches the bytecode", s.parallel === g.parallel && s.target === g.target &&
    near(s.Pe, g.Pe, 1e-6) && worst <= 1e-6, `worst${bad}=${worst}`);
}
sameState("the opening figure", C.start(), jStart(600, 450, true));

/* ------------------- 3. board sizes and modes, from the applet parameters */

{
  let n = 0;
  for (const width of [320, 400, 600, 800]) {
    for (const height of [240, 300, 450, 600]) {
      for (const parallel of [true, false]) {
        sameState(`start ${width}x${height} ${parallel ? "parallel" : "perpendicular"}`,
          C.start({ width, height, parallel }), jStart(width, height, parallel));
        n++;
      }
    }
  }
  check("32 board/mode combinations were compared", n === 32);
}

/* ---------------------- 4. every draggable point, mode and update direction */

{
  const rnd = rng(6262);
  const names = ["A0", "B0", "C0", "P0", "A1", "B1", "C1", "P1"];
  const sizes = [[400, 300], [600, 450], [800, 600]];
  let n = 0, worstConc = 0, worstSide = 0, worstPer = 0;
  for (let k = 0; k < 240; k++) {
    const [width, height] = sizes[k % sizes.length];
    const parallel = k % 2 === 0;
    let s = C.start({ width, height, parallel });
    let g = jStart(width, height, parallel);
    for (let step = 0; step < 3; step++) {
      const name = names[Math.floor(rnd() * names.length)];
      const q = { x: 20 + rnd() * (width - 40), y: 20 + rnd() * (height - 40) };
      s = C.movePoint(s, name, q);
      jMove(g, name, q);
      sameState(`drag ${k}.${step} ${name}`, s, g);
      if (![s.A, s.B, s.C, s.P].every((v) => v.every(finite))) continue;
      n++;
      worstConc = Math.max(worstConc, maxErr(C.concurrency(s, s.target)));
      worstSide = Math.max(worstSide, maxErr(C.sideErrors(s, s.target)));
      worstPer = Math.max(worstPer, Math.abs(C.perimeter(s, 0) - C.perimeter(s, 1)) / Math.max(1, C.perimeter(s, 0)));
    }
  }
  check("720 random drags of all eight points were compared", n >= 700);
  check(`the matching cevians always concur (max gap ${worstConc})`, worstConc < 1e-7);
  check(`the sides always follow the cevians (max error ${worstSide})`, worstSide < 1e-7);
  check(`the two triangles keep the same perimeter (max error ${worstPer})`, worstPer < 1e-9);
}

/* ------------------------------------ 5. a grid: the page's claims, checked */

{
  let cases = 0, worstC = 0, worstS = 0, failures = 0;
  for (let ax = 1; ax <= 7; ax++) {
    for (let ay = 1; ay <= 5; ay++) {
      for (let px = 2; px <= 6; px++) {
        for (let py = 1; py <= 5; py++) {
          for (const parallel of [true, false]) {
            let s = C.start({ width: 600, height: 450, parallel });
            s = C.movePoint(s, "A0", { x: ax * 75, y: ay * 65 });
            s = C.movePoint(s, "B0", { x: 60, y: 330 });
            s = C.movePoint(s, "C0", { x: 520, y: 300 });
            s = C.movePoint(s, "P0", { x: px * 80, y: py * 60 });
            if (![s.A, s.B, s.C, s.P].every((v) => v.every(finite))) continue;
            const c = maxErr(C.concurrency(s, 1));
            const e = maxErr(C.sideErrors(s, 1));
            if (!Number.isFinite(c) || !Number.isFinite(e)) continue; // a collapsed side
            cases++;
            if (!(c < 1e-7 && e < 1e-7)) failures++;
            worstC = Math.max(worstC, c);
            worstS = Math.max(worstS, e);
          }
        }
      }
    }
  }
  check("the grid supplied at least 1000 finite configurations", cases >= 1000);
  check(`every grid case has concurrent matching cevians (max ${worstC})`, failures === 0 && worstC < 1e-7);
  check(`every grid case has sides following the cevians (max ${worstS})`, worstS < 1e-7);
  check("the page's claim has no counterexample on the grid", failures === 0);
}

/* ------------------------- 6. the parallel and perpendicular versions agree */

{
  const rnd = rng(1147);
  let worstP = 0, worstQ = 0, n = 0;
  for (let k = 0; k < 300; k++) {
    const base = { A: { x: 80 + rnd() * 440, y: 50 + rnd() * 340 },
      B: { x: 20 + rnd() * 140, y: 260 + rnd() * 130 },
      C: { x: 400 + rnd() * 170, y: 250 + rnd() * 140 },
      P: { x: 80 + rnd() * 440, y: 80 + rnd() * 280 } };
    let sp = C.start({ parallel: true }), sq = C.start({ parallel: false });
    sp = C.movePoint(sp, "A0", base.A); sp = C.movePoint(sp, "B0", base.B);
    sp = C.movePoint(sp, "C0", base.C); sp = C.movePoint(sp, "P0", base.P);
    sq = C.movePoint(sq, "A0", base.A); sq = C.movePoint(sq, "B0", base.B);
    sq = C.movePoint(sq, "C0", base.C); sq = C.movePoint(sq, "P0", base.P);
    if (![sp.P[1], sq.P[1]].every(finite)) continue;
    n++;
    // Rotating the parallel triangle a quarter turn turns its sides from
    // parallel-to-cevians into perpendicular-to-cevians, so equation (3)
    // becomes the perpendicular case's equation.
    worstP = Math.max(worstP, Math.abs(C.orthologicSum(sp, true)) / Math.max(1, C.perimeter(sp, 0) ** 2));
    worstQ = Math.max(worstQ, Math.abs(C.orthologicSum(sq, false)) / Math.max(1, C.perimeter(sq, 0) ** 2));
  }
  check(`paired configurations were used (${n} finite of 300)`, n >= 250);
  check(`parallel cevians satisfy the rotated equation (3) (max ${worstP})`, worstP < 1e-8);
  check(`perpendicular cevians satisfy equation (3) (max ${worstQ})`, worstQ < 1e-8);
}

/* ---------------------- 7. equation (3') is the same equation, swapped */

{
  const rnd = rng(331);
  let worst = 0;
  for (let k = 0; k < 200; k++) {
    const s = C.start({ parallel: false });
    let t = C.movePoint(s, "A0", { x: 60 + rnd() * 460, y: 40 + rnd() * 300 });
    t = C.movePoint(t, "B0", { x: 30 + rnd() * 130, y: 250 + rnd() * 150 });
    t = C.movePoint(t, "C0", { x: 420 + rnd() * 150, y: 240 + rnd() * 150 });
    t = C.movePoint(t, "P0", { x: 100 + rnd() * 400, y: 80 + rnd() * 280 });
    if (![t.P[1], t.P[0]].every(finite)) continue;
    const dot = (p, q) => p.x * q.x + p.y * q.y;
    const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
    const a = t.A[0], b = t.B[0], c = t.C[0];
    const ap = t.A[1], bp = t.B[1], cp = t.C[1];
    const eq3 = dot(a, sub(cp, bp)) + dot(b, sub(ap, cp)) + dot(c, sub(bp, ap));
    const eq3prime = dot(ap, sub(c, b)) + dot(bp, sub(a, c)) + dot(cp, sub(b, a));
    worst = Math.max(worst, Math.abs(eq3 - eq3prime) / Math.max(1, C.perimeter(t, 0) ** 2));
  }
  check("equation (3) regroups to (3') exactly, triangle roles swapped", worst < 1e-12);
}

/* -------------------------- 8. all A'B'C' with these side directions agree */

{
  // Lines have no direction of their own, so compare the smaller angle
  // between them: atan2(|cross|, |dot|), in [0, PI/2].
  const angle = (u, v) => Math.atan2(Math.abs(C.cross(u, v)), Math.abs(C.dot(u, v)));
  for (const parallel of [true, false]) {
    let s = C.start({ parallel });
    s = C.movePoint(s, "P0", { x: 250, y: 130 });
    const others = [];
    for (let k = 0; k < 6; k++) {
      let t = C.place(s, "A1", { x: 40 + k * 20, y: 30 + k * 15 });
      t = C.place(t, "B1", { x: 520 - k * 10, y: 410 - k * 12 });
      others.push(C.rebuild(t, 1)); // same cevians, same Pe/G, new seed triangle
    }
    let worst = 0;
    for (const t of others) {
      const d1 = { x: t.B[1].x - t.A[1].x, y: t.B[1].y - t.A[1].y };
      const d2 = { x: s.B[1].x - s.A[1].x, y: s.B[1].y - s.A[1].y };
      worst = Math.max(worst, Math.abs(angle(d1, d2)));
    }
    check(`${parallel ? "parallel" : "perpendicular"}: triangles with the same cevians are similar (max ${worst})`,
      others.length === 6 && worst < 1e-8);
  }
}

/* -------------------- 9. mode switch, whole-triangle drag, immutability */

{
  const s = C.start();
  const g = jStart(600, 450, true);
  const flipped = C.setParallel(s, false);
  g.parallel = false;
  jUpdate(g, g.target);
  sameState("checkbox switch from Parallel to Perpendicular", flipped, g);
  const back = C.setParallel(flipped, true);
  g.parallel = true;
  jUpdate(g, g.target);
  sameState("checkbox switch back to Parallel", back, g);
  check("switching the mode does not change the base triangle",
    samePt(back.A[0], s.A[0]) && samePt(back.B[0], s.B[0]));

  const delta = { x: 15, y: -20 };
  const original = C.start();
  const translated = C.moveTriangle(original, 1, delta);
  check("a whole-triangle drag translates all three prime vertices",
    ["A", "B", "C"].every((key) => samePt(translated[key][1],
      { x: original[key][1].x + delta.x, y: original[key][1].y + delta.y })));
  // jMove would run CheckForUpdate three times; do the literal update once.
  const g2 = jStart(600, 450, true);
  for (const key of ["A", "B", "C"]) {
    g2[key][1] = { x: g2[key][1].x + delta.x, y: g2[key][1].y + delta.y };
  }
  g2.Pe = jPerimeter(g2, 1); g2.G[1] = jCentroid(g2, 1); g2.target = 0; jUpdate(g2, 0);
  sameState("dragging the whole prime triangle", translated, g2);
}

/* ---------------------------- 10. degenerate and immutable edge cases */

{
  const s = C.start();
  const collapsed = C.movePoint(s, "P0", { x: s.A[0].x, y: s.A[0].y });
  check("a cevian collapsed to a point gives the applet's non-finite answer",
    !finite(collapsed.P[1]) && !finite(jMoveReturn(collapsed)));
  check("the collapsed drag does not throw and keeps the base triangle", samePt(collapsed.A[0], s.A[0]));
  const again = C.start();
  const moved = C.movePoint(again, "C0", { x: 350, y: 60 });
  check("movePoint leaves the position it was given untouched",
    samePt(again.C[0], s.C[0]) && !samePt(moved.C[0], again.C[0]));
  const reset = C.start();
  check("start is reproducible",
    ["A", "B", "C", "P", "G"].every((key) => [0, 1].every((i) => samePt(reset[key][i], s[key][i]))));
  check("the status line describes the live theorem", /meet at P'/.test(C.describe(s)));
}

function jMoveReturn(s) {
  const g = jStart(s.width, s.height, s.parallel);
  jMove(g, "P0", { x: s.A[0].x, y: s.A[0].y });
  return g.P[1];
}

done("maxwell");
