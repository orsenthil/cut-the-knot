#!/usr/bin/env node
"use strict";

/*
 * Logic test for harmonic-mean-sangaku/harmonic-mean-sangaku-core.js.
 *
 *   node porting/check-harmonic-mean-sangaku.mjs
 *
 * Three things are checked:
 *   1. The start picture and every drag fix-up are compared with a second,
 *      literal transcription of the applet's init, UpgradePoints and
 *      GeoSDoub.Intersect bytecode, over a grid of canvas sizes and thousands
 *      of drag targets (including a long random chain of drags).
 *   2. The live page's claims are checked exhaustively where the sizes allow:
 *      1/CP = 1/AE + 1/BD, CP independent of the wall spacing and
 *      CP = half the harmonic mean, for 6,400 positive configurations, plus
 *      signed lengths and the applet's two degenerate cases.
 *   3. Options, the "explored" result and the immutability of moves.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("harmonic-mean-sangaku/harmonic-mean-sangaku-core.js", "HarmonicMeanSangakuCore");
const same = (a, b) => Object.is(a, b);
const point = (p) => `${p.x},${p.y}`;
const samePoint = (a, b) => Boolean(a && b) && same(a.x, b.x) && same(a.y, b.y);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* ------------------------------------------------------------ second reading */

/* Literal GeoSDoub.Intersect(a,b,c,d), from classes/CTKGeometry.zip. */
function javaIntersect(a, b, c, d) {
  const a1 = a.y - b.y;
  const b1 = b.x - a.x;
  const c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y;
  const b2 = d.x - c.x;
  const c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - b1 * a2;
  const one = 1;
  if (Math.abs(det) < one) return { x: NaN, y: NaN }; // javap: dcmpg/ifge at 135/136
  return {
    x: (b1 * c2 - c1 * b2) / det,
    y: (c1 * a2 - c2 * a1) / det,
  };
}

/* Literal HarmonicMeanSangakuCanvas.init() for a canvas of W by H. */
function javaStart(W, H) {
  const ground = Math.trunc((H * 5) / 6); // 5*H/6 with Java int division
  const inset = Math.trunc(W / 6);
  const size = Math.trunc(Math.min(W, H) / 7);
  const A = { x: inset, y: ground };
  const B = { x: W - inset, y: ground };
  const D = { x: B.x, y: B.y - size };
  const E = { x: A.x, y: A.y - 2 * size };
  const P = javaIntersect(A, D, B, E);
  return { A, B, D, E, P, C: { x: P.x, y: A.y } };
}

/* Literal UpgradePoints + Compute for one drag. */
function javaDrag(s, name, p) {
  const q = { x: p.x, y: p.y };
  let A = { ...s.A }, B = { ...s.B }, D = { ...s.D }, E = { ...s.E };
  if (name === "B") {
    B = q;
    A = { ...A, y: B.y };
    D = { ...D, x: B.x };
  } else if (name === "A") {
    A = q;
    B = { ...B, y: A.y };
    E = { ...E, x: A.x };
  } else if (name === "D") {
    D = q;
    B = { ...B, x: D.x };
  } else if (name === "E") {
    E = q;
    A = { ...A, x: E.x };
  }
  let P = s.P, Cc = s.C;
  if (!(Math.abs(A.x - B.x) < 1)) { // Compute returns early when |A.x-B.x| < 1
    P = javaIntersect(A, D, B, E);
    Cc = { x: P.x, y: A.y };
  }
  return { A, B, D, E, P, C: Cc };
}

function samePicture(a, b) {
  return ["A", "B", "D", "E", "P", "C"].every((n) => samePoint(a[n], b[n]));
}

/* -------------------------------------------------------- 1. the rules/start */

{
  const s = C.start({ width: 500, height: 400 });
  check("start matches the applet at 500x400", samePicture(s, javaStart(500, 400)),
    `${JSON.stringify(s)} vs ${JSON.stringify(javaStart(500, 400))}`);
}

{
  let bad = null;
  let n = 0;
  for (let W = 120; W <= 900; W += 60) {
    for (let H = 100; H <= 600; H += 50) {
      n++;
      const a = C.start({ width: W, height: H });
      const b = javaStart(W, H);
      if (!samePicture(a, b)) { bad = { W, H, a, b }; break; }
    }
  }
  check(`start matches the bytecode on ${n} canvas sizes`, bad === null, bad && JSON.stringify(bad));
}

{
  const s = C.start({ width: 500, height: 400 });
  const m = C.measure(s);
  check("the starting left wall is twice the right wall", near(m.ae, 2 * m.bd));
  check("the starting crossing is 2/3 of the short wall", near(m.cp, (2 * m.bd) / 3));
  check("the starting crossing equals half the harmonic mean", near(m.cp, m.harmonic / 2));
  check("C lies between the two walls", m.ac > 0 && m.bc > 0 && near(m.ac + m.bc, m.wall));
}

{
  const off = C.start({ show: false });
  const on = C.start({ show: true });
  const mixed = C.start({ show: true, showNames: false });
  check("Show=0 leaves both labels and guides off", !off.showNames && !off.showHint);
  check("Show=1 turns both on", on.showNames && on.showHint);
  check("the two checkboxes are independent", !mixed.showNames && mixed.showHint);
  check("a new picture has not been explored", C.result(on) === null);
}

/* --------------------------------- 2. every drag against the second reading */

{
  const sizes = [200, 500, 800].flatMap((W) => [240, 400, 560].map((H) => [W, H]));
  const targets = (s) => [
    { x: s.A.x + 37, y: s.A.y - 23 },
    { x: s.B.x - 51, y: s.B.y + 19 },
    { x: s.D.x + 29, y: s.D.y - 61 },
    { x: s.E.x - 33, y: s.E.y + 47 },
    { x: 0, y: 0 },
    { x: s.width, y: s.height },
    { x: s.A.x + 0.5, y: s.A.y },
  ];
  for (const name of ["A", "B", "D", "E"]) {
    let bad = null;
    let n = 0;
    for (const [W, H] of sizes) {
      const s = C.start({ width: W, height: H });
      const j = javaStart(W, H);
      for (const p of targets(s)) {
        n++;
        const a = C.withPoint(s, name, p);
        const b = javaDrag(j, name, p);
        if (!samePicture(a, b)) { bad = { name, W, H, p, a, b }; break; }
      }
      if (bad) break;
    }
    check(`dragging ${name} matches UpgradePoints and Compute (${n} drags)`, bad === null,
      bad && JSON.stringify(bad));
  }
}

{
  const random = rng(20261127);
  let s = C.start({ width: 640, height: 420 });
  let j = javaStart(640, 420);
  const names = ["A", "B", "D", "E"];
  let bad = null;
  for (let i = 0; i < 1200; i++) {
    const name = names[Math.floor(random() * 4)];
    const p = { x: Math.round(random() * 700 - 50), y: Math.round(random() * 500 - 60) };
    s = C.withPoint(s, name, p);
    j = javaDrag(j, name, p);
    if (!samePicture(s, j)) { bad = { i, name, p, s, j }; break; }
  }
  check("a 1200-move random drag chain matches the applet", bad === null, bad && JSON.stringify(bad));
}

{
  const s = C.start({});
  const a = C.withPoint(s, "B", { x: 123.5, y: 210.25 });
  check("dragging B levels the ground and moves wall D sideways",
    a.A.y === 210.25 && a.D.x === 123.5);
  const b = C.withPoint(s, "A", { x: 101.25, y: 190.5 });
  check("dragging A levels the ground and moves wall E sideways",
    b.B.y === 190.5 && b.E.x === 101.25);
  const d = C.withPoint(s, "D", { x: 99.75, y: 80 });
  check("dragging D moves B but leaves A alone", d.B.x === 99.75 && d.A.x === s.A.x);
  const e = C.withPoint(s, "E", { x: 77.5, y: 100 });
  check("dragging E moves A but leaves B alone", e.A.x === 77.5 && e.B.x === s.B.x);
  check("drags do not change the position they were given",
    s.A.x === 83 && s.B.x === 417 && s.D.y === 276 && s.E.y === 219);
}

/* -------------------------------------------- 3. the page's claims, exhaustively */

{
  let bad = null;
  let n = 0;
  for (let ae = 1; ae <= 40; ae++) {
    for (let bd = 1; bd <= 40; bd++) {
      for (const wall of [2, 5, 80, 500]) {
        n++;
        const s = C.recompute({
          A: { x: 0, y: 0 }, B: { x: wall, y: 0 },
          D: { x: wall, y: -bd }, E: { x: 0, y: -ae },
        });
        const m = C.measure(s);
        const expected = (ae * bd) / (ae + bd);
        if (!m.holds || !near(m.residual, 0) || !near(m.cp, expected) ||
            !near(m.harmonic / 2, expected)) {
          bad = { ae, bd, wall, m };
          break;
        }
      }
      if (bad) break;
    }
    if (bad) break;
  }
  check(`1/CP = 1/AE + 1/BD and CP = half the harmonic mean (${n} cases)`,
    bad === null, bad && JSON.stringify(bad));
}

{
  let bad = null;
  let n = 0;
  for (let ae = 1; ae <= 40; ae++) {
    for (let bd = 1; bd <= 40; bd++) {
      n++;
      const cp = (w) => C.measure(C.recompute({
        A: { x: 0, y: 0 }, B: { x: w, y: 0 },
        D: { x: w, y: -bd }, E: { x: 0, y: -ae },
      })).cp;
      if (!near(cp(5), cp(500), 1e-7)) { bad = { ae, bd, a: cp(5), b: cp(500) }; break; }
    }
    if (bad) break;
  }
  check(`CP does not depend on the distance between the walls (${n} pairs)`,
    bad === null, bad && JSON.stringify(bad));
}

{
  let bad = null;
  let n = 0;
  for (let ae = 2; ae <= 30; ae += 2) {
    for (let bd = 2; bd <= 30; bd += 2) {
      n++;
      const m = C.measure(C.recompute({
        A: { x: 0, y: 0 }, B: { x: 300, y: 0 },
        D: { x: 300, y: -bd }, E: { x: 0, y: -ae },
      }));
      if (!near(m.bc / m.ac, m.bd / m.cp - 1, 1e-8) ||
          !near(m.ac / m.bc, m.ae / m.cp - 1, 1e-8) ||
          !near((m.ae - m.cp) * (m.bd - m.cp), m.cp * m.cp, 1e-6)) {
        bad = { ae, bd, m };
        break;
      }
    }
    if (bad) break;
  }
  check(`the page's similar-triangle proportions hold (${n} cases)`, bad === null,
    bad && JSON.stringify(bad));
}

{
  let bad = null;
  let n = 0;
  const hs = [-30, -7, -1, 1, 7, 30];
  for (const ae of hs) {
    for (const bd of hs) {
      if (ae + bd === 0) continue;
      n++;
      const s = C.recompute({
        A: { x: 0, y: 0 }, B: { x: 100, y: 0 },
        D: { x: 100, y: -bd }, E: { x: 0, y: -ae },
      });
      const m = C.measure(s);
      if (!m.holds || !near(m.cp, (ae * bd) / (ae + bd))) { bad = { ae, bd, m }; break; }
    }
    if (bad) break;
  }
  check(`directed lengths obey the same identity (${n} signed cases)`, bad === null,
    bad && JSON.stringify(bad));
}

{
  const s = C.start({ width: 500, height: 400 });
  const moved = C.withPoint(s, "B", { x: s.A.x + 0.4, y: s.A.y });
  const j = javaDrag(javaStart(500, 400), "B", { x: s.A.x + 0.4, y: s.A.y });
  check("walls less than a pixel apart leave P and C where they were",
    C.measure(moved).tooClose && samePoint(moved.P, s.P) && samePoint(moved.C, s.C) &&
    samePicture(moved, j));
}

{
  const parallel = {
    A: { x: 0, y: 0 }, B: { x: 1, y: 0 },
    D: { x: 1, y: -0.2 }, E: { x: 0, y: -0.2 },
  };
  const core = C.recompute(parallel);
  const literal = javaIntersect(parallel.A, parallel.D, parallel.B, parallel.E);
  check("a determinant below one gives NaN in both readings",
    samePoint(core.P, literal) && C.measure(core).parallel);
  check("an unmeasurable picture is not marked explored", C.result(C.checkClaim(core)) === null);
}

{
  const s = C.start({});
  const checked = C.checkClaim(s);
  check("a measurable picture can be marked explored", checked.checked && C.result(checked) === "done");
  check("the four applet handles are the legal moves",
    JSON.stringify(C.legalMoves(s)) === JSON.stringify(["A", "B", "D", "E"]));
  check("an unknown move changes nothing", C.move(s, { name: "P", point: { x: 1, y: 2 } }) === s);
  const dragged = C.move(s, { name: "E", point: { x: 70, y: 120 } });
  check("the page's move form applies the E fix-up", dragged.E.x === 70 && dragged.A.x === 70);
}

done("harmonic-mean-sangaku");
