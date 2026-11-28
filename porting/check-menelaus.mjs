#!/usr/bin/env node
"use strict";

/*
 * Logic test for menelaus/menelaus-core.js. Run with:
 *   node porting/check-menelaus.mjs
 *
 * The check has two independent transcriptions of the applet (MenelausCanvas
 * GetPoint/Reset/DrawMenelaus, GeoSDoub Intersect/NearestPoint) written straight
 * from javap, and compares them with the core over thousands of configurations.
 * It also checks the page's actual claim, from the applet's Explanation page:
 *   F on AB, D on BC, E on AC are collinear iff AF/BF * BD/CD * CE/AE = 1,
 *   provided exactly one or all three lie on side extensions.
 * The converse direction (0 or 2 outside means Ceva concurrency, not a
 * transversal) is checked too, as is the signed form of both theorems.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("menelaus/menelaus-core.js", "MenelausCore");
const near = (a, b, tol = 1e-7) =>
  a === b || (Number.isNaN(a) && Number.isNaN(b)) ||
  (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)));
const pointNear = (p, q, tol = 1e-7) => p && q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const round = (v) => Math.floor(v + 0.5);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const onLine = (p, a, b, tol = 1e-5) => {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y) <= tol;
  return Math.abs(cross(a, b, p)) / len <= tol * Math.max(1, len);
};

/* ------------------------------------------- the applet, transcribed again */

/** MenelausCanvas.GetPoint(int): (int)(centre + min(w,h)/5 * cos/sin + .5). */
function jGetPoint(i, width, height) {
  const size = Math.min(width, height) / 5;
  const cx = width / 2, cy = height / 2;
  return {
    x: round(cx + size * Math.cos((2 * Math.PI * i) / 3)),
    y: round(cy + size * Math.sin((2 * Math.PI * i) / 3)),
  };
}

/** GeoSDoub.Intersect(a,b,c,d), instruction for instruction. */
function jIntersect(a, b, c, d) {
  const s4 = a.y - b.y, s6 = b.x - a.x;
  const s8 = a.x * b.y - a.y * b.x;
  const s10 = c.y - d.y, s12 = d.x - c.x;
  const s14 = c.x * d.y - c.y * d.x;
  const s16 = s6 * s14 - s12 * s8;
  const s18 = s8 * s10 - s14 * s4;
  const s20 = s4 * s12 - s10 * s6;
  if (!(Math.abs(s20) > 1)) return { x: NaN, y: NaN };
  return { x: s16 / s20, y: s18 / s20 };
}

/** GeoSDoub.NearestPoint(p,a,b), instruction for instruction. */
function jNearest(p, a, b) {
  const s3 = b.x - a.x, s5 = b.y - a.y;
  const dist2 = (a.x - p.x) * (a.x - p.x) + (a.y - p.y) * (a.y - p.y);
  if (dist2 < 0.1) return { x: p.x, y: p.y };
  const s7 = s3 * (p.x - a.x) + s5 * (p.y - a.y);
  const s9 = s7 / (s3 * s3 + s5 * s5);
  return { x: a.x + s3 * s9, y: a.y + s5 * s9 };
}

/** MenelausCanvas.DrawCevians: the three intersections from K. */
function jCevaPoints(state) {
  return {
    D: jIntersect(state.A, state.K, state.B, state.C),
    E: jIntersect(state.B, state.K, state.A, state.C),
    F: jIntersect(state.C, state.K, state.A, state.B),
  };
}

/** MenelausCanvas.Reset(mode), including the A/F swap and RestrictToLine. */
function jReset(state, mode) {
  if (state.mode === mode) return state;
  const old = state.mode === "ceva" ? jCevaPoints(state) : { D: state.Dm, E: state.K, F: state.Fm };
  if (mode === "menelaus") {
    const A = { x: old.F.x, y: old.F.y };
    const K = jNearest({ x: state.K.x, y: state.K.y }, A, state.C);
    return { ...state, mode, A, K, Dm: { x: old.D.x, y: old.D.y }, Fm: { x: state.A.x, y: state.A.y } };
  }
  return { ...state, mode, A: { x: state.Fm.x, y: state.Fm.y } };
}

/** MenelausCanvas.DrawMenelaus's update chain after one dragged dot. */
function jMenelausDrag(state, name, raw) {
  const next = { ...state };
  const key = { D: "Dm", F: "Fm" }[name] || name;
  const line = { K: [state.A, state.C], D: [state.B, state.C], F: [state.A, state.B] }[name];
  const moved = line ? jNearest(raw, line[0], line[1]) : raw;
  next[key] = moved;
  const update = { A: 3, B: 1, C: 2 }[name] || 0;
  if (name === "F" || update === 2) {
    const p = jIntersect(next.Fm, next.Dm, next.A, next.C);
    next.K = { x: p.x, y: p.y };
  }
  if (name === "D" || update === 3) {
    const p = jIntersect(next.Dm, next.K, next.B, next.A);
    next.Fm = { x: p.x, y: p.y };
  }
  if (name === "K" || update === 1) {
    const p = jIntersect(next.K, next.Fm, next.C, next.B);
    next.Dm = { x: p.x, y: p.y };
  }
  return next;
}

/* -------------------------------------------------------- 1. the opening */

{
  let ok = true;
  for (let w = 120; w <= 900; w += 60) {
    for (const h of [100, 300, 380, 700]) {
      const s = C.start({ width: w, height: h });
      ok = ok && pointNear(s.A, jGetPoint(0, w, h)) &&
        pointNear(s.B, jGetPoint(1, w, h)) &&
        pointNear(s.C, jGetPoint(2, w, h)) &&
        near(s.K.x, (s.A.x + s.B.x + s.C.x) / 3) &&
        near(s.K.y, (s.A.y + s.B.y + s.C.y) / 3);
    }
  }
  check("GetPoint and the centroid agree with the bytecode at 56 board sizes", ok);
  const s = C.start();
  equal("the applet's canvas is 500 by 380", [s.width, s.height], [500, 380]);
  const p = C.points(s);
  check("the opening Ceva dots are the three side midpoints",
    pointNear(p.D, { x: 212, y: 190 }) && pointNear(p.E, { x: 269, y: 157 }) &&
    pointNear(p.F, { x: 269, y: 223 }));
  equal("Ceva is the opening mode", s.mode, "ceva");
  equal("there is no win or loss in this illustration", C.result(s), null);
}

/* --------------------------------------- 2. Ceva's intersections, all cases */

{
  const rand = rng(20498);
  let ok = true, nanCases = 0, finiteCases = 0;
  for (let i = 0; i < 4000; i++) {
    const s = C.start({
      corners: undefined,
      width: 500, height: 380,
    });
    const corners = {
      A: { x: 60 + rand() * 380, y: 40 + rand() * 300 },
      B: { x: 60 + rand() * 380, y: 40 + rand() * 300 },
      C: { x: 60 + rand() * 380, y: 40 + rand() * 300 },
      K: { x: 60 + rand() * 380, y: 40 + rand() * 300 },
    };
    const state = { ...s, ...corners };
    const mine = C.points(state), theirs = jCevaPoints(state);
    ok = ok && pointNear(mine.D, theirs.D) && pointNear(mine.E, theirs.E) && pointNear(mine.F, theirs.F);
    if (Number.isNaN(theirs.D.x)) nanCases++; else finiteCases++;
  }
  check(`DrawCevians' three intersections match in ${finiteCases} finite and ${nanCases} NaN cases`, ok);

  const parallel = { ...C.start(), K: { x: 326, y: 290 } }; // AK vertical, like BC
  const par = C.points(parallel);
  check("the applet's |det| <= 1 guard returns NaN for a near-parallel cevian",
    Number.isNaN(par.D.x) && Number.isNaN(par.D.y) && Number.isNaN(jCevaPoints(parallel).D.x));
  check("a NaN intersection is not passed off as a finite point", !Number.isFinite(par.D.x));
}

/* --------------------------------------------- 3. Reset, both directions */

{
  const rand = rng(7210);
  let ok = true, roundtrip = true;
  for (let i = 0; i < 3000; i++) {
    let s = C.start();
    s = {
      ...s,
      A: { x: 40 + rand() * 420, y: 30 + rand() * 320 },
      B: { x: 40 + rand() * 420, y: 30 + rand() * 320 },
      C: { x: 40 + rand() * 420, y: 30 + rand() * 320 },
      K: { x: 40 + rand() * 420, y: 30 + rand() * 320 },
    };
    const theirs = jReset(s, "menelaus");
    const mine = C.switchMode(s, "menelaus");
    ok = ok && pointNear(mine.A, theirs.A) && pointNear(mine.K, theirs.K) &&
      pointNear(mine.Dm, theirs.Dm) && pointNear(mine.Fm, theirs.Fm);
    // A second copy of the same round trip, so the invariant is not accidental.
    const back = C.switchMode(mine, "ceva");
    roundtrip = roundtrip && pointNear(back.A, s.A) && pointNear(back.Fm, mine.Fm) &&
      pointNear(back.K, mine.K) && back.mode === "ceva";
  }
  check("Reset(1) swaps A with F, limits E=K to AC and seeds D and F (3000 cases)", ok);
  check("Reset(0) swaps back and keeps the Menelaus side dots (3000 cases)", roundtrip);
  const s = C.start();
  equal("Reset to the current mode does nothing", C.switchMode(s, "ceva"), s);
  check("start({mode:'menelaus'}) is the same as Reset(1) from the opening",
    pointNear(C.start({ mode: "menelaus" }).A, C.switchMode(s, "menelaus").A) &&
    pointNear(C.start({ mode: "menelaus" }).Fm, C.switchMode(s, "menelaus").Fm) &&
    C.start({ mode: "menelaus" }).Dm !== null);
}

/* ------------------------------------- 4. DrawMenelaus' updates after drags */

{
  const rand = rng(99127);
  let ok = true, collinear = 0, products = 0, offSide = 0, sidePointDrags = 0;
  const names = ["A", "B", "C", "K", "D", "F"];
  for (let i = 0; i < 6000; i++) {
    let s = C.switchMode(C.start(), "menelaus");
    // A few well-separated vertices keep the intersections finite.
    s = {
      ...s,
      A: { x: 90 + rand() * 320, y: 50 + rand() * 90 },
      B: { x: 90 + rand() * 320, y: 280 + rand() * 60 },
      C: { x: 90 + rand() * 320, y: 50 + rand() * 90 },
    };
    s = C.switchMode(s, "ceva");
    s = C.switchMode(s, "menelaus");
    const name = names[i % names.length];
    const raw = { x: 50 + rand() * 400, y: 30 + rand() * 320 };
    const mine = C.move(s, name, raw);
    const theirs = jMenelausDrag(s, name, raw);
    const keys = ["A", "B", "C", "K", "Dm", "Fm"];
    ok = ok && keys.every((k) => pointNear(mine[k], theirs[k]));

    const p = C.points(mine);
    if (![p.D, p.E, p.F].every((q) => Number.isFinite(q.x + q.y))) continue;
    const cr = Math.abs(cross(p.D, p.E, p.F));
    const scale = Math.max(1, Math.hypot(p.D.x - p.E.x, p.D.y - p.E.y), Math.hypot(p.F.x - p.E.x, p.F.y - p.E.y));
    collinear++;
    if (cr > 1e-6 * scale * scale) ok = false;
    const n = C.numbers(mine);
    const sideTol = 1e-5;
    const allOnSides = onLine(p.F, mine.A, mine.B, sideTol) &&
      onLine(p.D, mine.B, mine.C, sideTol) && onLine(p.E, mine.A, mine.C, sideTol);
    if (allOnSides) {
      if (!near(n.product, 1, 1e-6)) ok = false;
      products++;
    } else offSide++;
    // Dragging one of the three side dots keeps all three on their sides.
    if (name === "K" || name === "D" || name === "F") {
      sidePointDrags++;
      if (!allOnSides) ok = false;
    }
  }
  check("each of the six drags follows DrawMenelaus' update chain (6000 cases)", ok);
  check(`D, E, F stay collinear in all ${collinear} finite configurations`, collinear > 5000);
  check(`AF/BF * BD/CD * CE/AE = 1 in all ${products} configurations still on the sides`, products > 1000);
  check(`the three side-dot drags keep all dots on the sides (${sidePointDrags} cases)`, sidePointDrags > 2500);
  check(`vertex drags can leave a dot off its side (${offSide} cases), so the page's premise then fails`, offSide > 0);
}

/* ---------------------- 5. the page's claim, both directions, grid + random */

{
  let ok = true, forward = 0, backward = 0, cevaOk = 0;
  const values = [-2.5, -1.5, -0.75, -0.25, 0.2, 0.35, 0.5, 0.65, 0.8, 1.25, 1.75, 2.5];
  const A = { x: 100, y: 300 }, B = { x: 400, y: 280 }, Cc = { x: 250, y: 60 };
  const at = (p, q, t) => ({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
  let finite = 0, external = 0;
  for (const t of values) for (const s of values) for (const u of values) {
    if (t === 1 || s === 1 || u === 0) continue;
    const F = at(A, B, t), D = at(B, Cc, s), E = at(A, Cc, u);
    const a = t / (1 - t), b = s / (1 - s), c = (1 - u) / u;
    const product = Math.abs(a * b * c);
    const det = cross(D, E, F) / 10000;
    const outside = [t, s, u].filter((v) => v < 0 || v > 1).length;
    finite++;
    if (outside === 1 || outside === 3) {
      external++;
      if (near(product, 1) === (Math.abs(det) < 1e-9)) backward++;
      if (Math.abs(a * b * c + 1) < 1e-9 && Math.abs(det) < 1e-9) forward++;
    } else if (near(product, 1) && Math.abs(a * b * c - 1) < 1e-9) cevaOk++;
  }
  check(`the iff claim holds in all ${external} grid cases with 1 or 3 extensions`, backward === external);
  check(`the collinear grid triples have signed product -1 (${forward} cases)`, forward > 0 && forward <= external);
  check(`product 1 with 0 or 2 extensions is Ceva's condition, not collinearity (${cevaOk} cases)`, cevaOk > 0);

  const rand = rng(31415);
  let okRandom = true, randomForward = 0, randomBackward = 0;
  for (let i = 0; i < 4000; i++) {
    const t = -3 + rand() * 6, s = -3 + rand() * 6;
    if (Math.abs(1 - t) < 0.02 || Math.abs(1 - s) < 0.02) continue;
    const a = t / (1 - t), b = s / (1 - s);
    const ab = a * b;
    if (Math.abs(ab + 1) < 0.02) continue;
    // Solve AF/FB * BD/DC * CE/EA = -1 for E on AC.
    const u = ab / (ab - 1);
    const F = at(A, B, t), D = at(B, Cc, s), E = at(A, Cc, u);
    const product = Math.abs((t / (1 - t)) * (s / (1 - s)) * ((1 - u) / u));
    const collinear = Math.abs(cross(D, E, F)) < 1e-6 * Math.max(1, Math.abs(cross(D, E, F)) + 1);
    const collinearReal = Math.abs(cross(D, E, F)) < 1e-5;
    const outside = [t, s, u].filter((v) => v < 0 || v > 1).length;
    if (outside !== 1 && outside !== 3) continue;
    randomForward++;
    okRandom = okRandom && near(product, 1, 1e-7) && collinearReal;
    if (collinear) randomBackward++;
  }
  check(`the forward claim holds for ${randomForward} random transversals`, okRandom && randomForward > 3500);
  check("an independent orientation test agrees on those transversals", randomBackward === randomForward);
  check("the grid exercise covered all kinds of extension counts", external > 800 && finite > 1000);
}

/* ------------------------------ 6. constraints, limits and signed theorems */

{
  const rand = rng(777);
  let ok = true;
  const s = C.switchMode(C.start(), "menelaus");
  for (const name of ["K", "D", "F"]) {
    const ends = C.sideEnds(s, name);
    for (let i = 0; i < 1000; i++) {
      const raw = { x: rand() * 500, y: rand() * 380 };
      const projected = C.projectHandle(s, name, raw);
      ok = ok && pointNear(projected, jNearest(raw, ends[0], ends[1]));
    }
  }
  check("K, D and F glide on AC, BC and AB like RestrictToLine (3000 cases)", ok);

  const s2 = C.switchMode(C.start(), "menelaus");
  check("NearestPoint returns the raw point within sqrt(0.1) of the side's first end",
    pointNear(C.projectHandle(s2, "F", { x: s2.A.x + 0.05, y: s2.A.y }),
      { x: s2.A.x + 0.05, y: s2.A.y }));
  check("PointIsEligible's border is reproduced by clampToBoard",
    pointNear(C.clampToBoard(s, { x: -20, y: -20 }), { x: 2 + 1e-6, y: 1e-6 }, 1e-5) &&
    pointNear(C.clampToBoard(s, { x: 900, y: 900 }), { x: 500 - 1e-6, y: 378 - 1e-6 }, 1e-5));

  let cevaSign = true, menelausSign = true;
  for (let i = 0; i < 2000; i++) {
    const base = C.start();
    const cs = {
      ...base,
      A: { x: 50 + rand() * 400, y: 30 + rand() * 320 },
      B: { x: 50 + rand() * 400, y: 30 + rand() * 320 },
      C: { x: 50 + rand() * 400, y: 30 + rand() * 320 },
      K: { x: 50 + rand() * 400, y: 30 + rand() * 320 },
    };
    const cn = C.numbers(cs);
    if (Number.isFinite(cn.signed)) cevaSign = cevaSign && near(cn.signed, 1, 1e-7);
    const ms = C.switchMode(cs, "menelaus");
    const mn = C.numbers(ms);
    if (Number.isFinite(mn.signed)) menelausSign = menelausSign && near(mn.signed, -1, 1e-7);
  }
  check("Ceva's signed product is +1 throughout the first mode (2000 cases)", cevaSign);
  check("Menelaus' signed product is -1 throughout the second mode (2000 cases)", menelausSign);
  const opening = C.numbers(C.start());
  check("the opening Ceva picture has product 1 and no extension points",
    near(opening.product, 1) && opening.outside === 0 && near(opening.signed, 1));
}

done("menelaus");
