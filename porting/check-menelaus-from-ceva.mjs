#!/usr/bin/env node
"use strict";

/*
 * Logic test for menelaus-from-ceva/menelaus-from-ceva-core.js.
 *
 *   node porting/check-menelaus-from-ceva.mjs
 *
 * Checks the initial picture against the applet's GetPoint/Init bytecode,
 * every one of the six drag paths against a second, independent transcription
 * of DrawMenelausFromCeva, and every claim on the cut-the-knot page: Ceva's
 * product, the six Ceva identities, Menelaus' product, its iff direction and
 * the "one or three points on extensions" sign claim. The parameter grid and
 * the seeded random configurations cover thousands of cases.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("menelaus-from-ceva/menelaus-from-ceva-core.js", "MenelausFromCevaCore");

/* ------------------------------------------------- an independent transcription */

/* Written straight from javap's bytecode of GeoSDoub.Intersect and
 * CTKMoveableDoub.UpdateLocation, with separate local names, to catch any
 * algebra slip in the core's versions. */
const trunc = (v) => (v < 0 ? Math.ceil(v) : Math.floor(v));
const cp = (p) => ({ x: p.x, y: p.y });
const ok = (p, q, tol = 1e-7) => {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return !Number.isFinite(q.x) && !Number.isFinite(q.y);
  return Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
};

function refGetPoint(index, width, height) {
  const radius = trunc(Math.min(width, height) / 5);
  const theta = ((index - 1) * 2 * Math.PI) / 3;
  const rawX = width / 2 + radius * Math.cos(theta);
  const rawY = height / 2 + radius * Math.sin(theta) + 40;
  const x = trunc(rawX), y = trunc(rawY);
  return {
    x: x + (index === 0 ? -70 : index === 1 ? 100 : index === 2 ? -200 : 0),
    y: y + (index === 0 ? 60 : 0),
  };
}

function refIntersect(p, q, r, s) {
  const s4 = p.y - q.y;
  const s6 = q.x - p.x;
  const s8 = p.x * q.y - p.y * q.x;
  const s10 = r.y - s.y;
  const s12 = s.x - r.x;
  const s14 = r.x * s.y - r.y * s.x;
  const det = s4 * s12 - s10 * s6;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (s6 * s14 - s12 * s8) / det, y: (s8 * s10 - s14 * s4) / det };
}

function refProject(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist2 = (a.x - p.x) ** 2 + (a.y - p.y) ** 2;
  if (dist2 < 0.1 || (dx === 0 && dy === 0)) return cp(p);
  const along = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * along, y: a.y + dy * along };
}

function refStart(width, height) {
  const A = refGetPoint(0, width, height);
  const B = refGetPoint(1, width, height);
  const Cc = refGetPoint(2, width, height);
  const E = { x: (2 * A.x + Cc.x) / 3, y: (2 * A.y + Cc.y) / 3 };
  const D = { x: (B.x + 2 * Cc.x) / 3, y: (B.y + 2 * Cc.y) / 3 };
  return { A, B, C: Cc, E, D, F: refIntersect(A, B, D, E), selected: null };
}

/* DrawMenelausFromCeva: the three "refresh" cases and the three "recompute"
 * cases, transcribed as a literal switch on the applet's UPDATE_* flags. */
function refDrag(state, name, delta) {
  const next = { ...state };
  next[name] = { x: state[name].x + delta.x, y: state[name].y + delta.y };
  for (const restricted of ["E", "D", "F"]) {
    if (name === restricted) {
      const [u, v] = { E: ["A", "C"], D: ["B", "C"], F: ["A", "B"] }[restricted];
      next[restricted] = refProject(next[restricted], next[u], next[v]);
    }
  }
  let flag = 0;
  if (name === "A") { next.E = refProject(next.E, next.A, next.C); flag = 3; }
  else if (name === "C") { next.D = refProject(next.D, next.B, next.C); flag = 2; }
  if (name === "B") { next.F = refProject(next.F, next.A, next.B); flag = 1; }
  if (name === "F" || flag === 2) next.E = refIntersect(next.F, next.D, next.A, next.C);
  if (name === "D" || flag === 3) next.F = refIntersect(next.D, next.E, next.B, next.A);
  if (name === "E" || flag === 1) next.D = refIntersect(next.E, next.F, next.C, next.B);
  next.selected = name;
  return next;
}

function samePoints(a, b) {
  return C.HANDLES.every((n) => ok(a[n], b[n]));
}

function signedRatio(P, Q, R) {
  const dx = R.x - P.x, dy = R.y - P.y;
  const den = (R.x - Q.x) * dx + (R.y - Q.y) * dy;
  return den === 0 ? NaN : ((Q.x - P.x) * dx + (Q.y - P.y) * dy) / den;
}

const near = (v, target, tol = 1e-6) => Number.isFinite(v) && Math.abs(v - target) <= tol;
const pointOn = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/* ------------------------------------------------------ 1. the opening picture */

{
  const s = C.start({});
  const ref = refStart(C.WIDTH, C.HEIGHT);
  check("start matches GetPoint(0..2) at 400x300", samePoints(s, ref));
  check("A, B and C are the exact integer offsets",
    ok(s.A, { x: 100, y: 198 }, 0) && ok(s.B, { x: 360, y: 190 }, 0) && ok(s.C, { x: -30, y: 241 }, 0));
  check("E is two thirds from A to C and D one third from B to C",
    ok(s.E, { x: 2 * s.A.x / 3 + s.C.x / 3, y: 2 * s.A.y / 3 + s.C.y / 3 }) &&
    ok(s.D, { x: s.B.x / 3 + 2 * s.C.x / 3, y: s.B.y / 3 + 2 * s.C.y / 3 }));
  check("F is line AB crossed with line DE", ok(s.F, refIntersect(s.A, s.B, s.D, s.E)));
  check("the opening F, D, E are collinear", C.collinear(s));
  check("the opening Menelaus product is 1", near(C.ratios(s).product, 1));
  check("the illustration has no win or loss", C.result(s) === null);
  check("add-ons start switched off", s.showAddOns === false);
}

/* ------------------------------ 2. every drag path against the bytecode twice */

{
  const rand = rng(20261128);
  const sizes = [[300, 220], [400, 300], [520, 360], [640, 300]];
  let matches = 0, collinear = 0, product = 0, total = 0;
  for (let k = 0; k < 240; k++) {
    const [w, h] = sizes[k % sizes.length];
    let s = C.start({ width: w, height: h });
    let r = refStart(w, h);
    for (let step = 0; step < 4; step++) {
      const name = C.HANDLES[Math.floor(rand() * 6)];
      const delta = { x: (rand() - 0.5) * 90, y: (rand() - 0.5) * 70 };
      s = C.drag(s, name, delta);
      r = refDrag(r, name, delta);
      total++;
      if (samePoints(s, r)) matches++;
      if (C.collinear(s)) collinear++;
      if (near(C.ratios(s).product, 1, 1e-5)) product++;
    }
  }
  check("960 drags agree with the bytecode transcription", matches === total, `${matches}/${total}`);
  check("every dragged picture still has F, D, E collinear", collinear === total, `${collinear}/${total}`);
  check("every dragged picture has Menelaus product 1", product === total, `${product}/${total}`);
}

/* ---------------------------------------- 3. each handle's exact update chain */

{
  const s = C.start({});
  const a = C.drag(s, "A", { x: -12, y: 9 });
  check("dragging A refreshes E, leaves D, and rebuilds F",
    !ok(a.E, s.E) && ok(a.D, s.D) && !ok(a.F, s.F) && a.selected === "A");
  const c = C.drag(s, "C", { x: 15, y: -7 });
  check("dragging C refreshes D, rebuilds E, and leaves F",
    !ok(c.D, s.D) && !ok(c.E, s.E) && ok(c.F, s.F) && c.selected === "C");
  const b = C.drag(s, "B", { x: 9, y: 13 });
  check("dragging B refreshes F, leaves E and D, and rebuilds D",
    !ok(b.F, s.F) && ok(b.E, s.E) && !ok(b.D, s.D) && b.selected === "B");
  const e = C.drag(s, "E", { x: 3, y: -6 });
  check("dragging E rebuilds D and keeps F", !ok(e.D, s.D) && ok(e.F, s.F) && e.selected === "E");
  const d = C.drag(s, "D", { x: -5, y: 4 });
  check("dragging D rebuilds F and keeps E", !ok(d.F, s.F) && ok(d.E, s.E) && d.selected === "D");
  const f = C.drag(s, "F", { x: 4, y: 3 });
  check("dragging F rebuilds E and keeps D", !ok(f.E, s.E) && ok(f.D, s.D) && f.selected === "F");
  const onLine = (p, a1, b1) => {
    const cross = (p.x - a1.x) * (b1.y - a1.y) - (p.y - a1.y) * (b1.x - a1.x);
    const len = Math.hypot(b1.x - a1.x, b1.y - a1.y);
    return len > 0 && Math.abs(cross) <= 1e-6 * len;
  };
  check("the three side dots stay on AC, BC and AB after every drag",
    [a, c, b, e, d, f].every((p) =>
      onLine(p.E, p.A, p.C) && onLine(p.D, p.B, p.C) && onLine(p.F, p.A, p.B)));
}

/* ------------------------------------- 4. the page's Ceva and Menelaus claims */

{
  const rand = rng(76543);
  let cevaOK = 0, none = 0;
  for (let k = 0; k < 400; k++) {
    const T = { A: { x: 40 + rand() * 300, y: 20 + rand() * 200 },
                B: { x: 40 + rand() * 300, y: 20 + rand() * 200 },
                C: { x: 40 + rand() * 300, y: 20 + rand() * 200 } };
    const P = { x: 40 + rand() * 300, y: 20 + rand() * 200 };
    const D = refIntersect(T.A, P, T.B, T.C);
    const E = refIntersect(T.B, P, T.C, T.A);
    const F = refIntersect(T.C, P, T.A, T.B);
    const product = signedRatio(T.A, F, T.B) * signedRatio(T.B, D, T.C) * signedRatio(T.C, E, T.A);
    if (!Number.isFinite(product)) continue;
    none++;
    if (near(product, 1, 1e-6)) cevaOK++;
  }
  check("Ceva's concurrent cevians give product 1 in 400 random triangles",
    none > 390 && cevaOK === none, `${cevaOK}/${none}`);
}

{
  const rand = rng(919191);
  let ids = [0, 0, 0, 0, 0, 0], squared = 0, count = 0;
  for (let k = 0; k < 500; k++) {
    let s = C.start({ width: 300 + rand() * 400, height: 200 + rand() * 200 });
    for (let j = 0; j < 3; j++) {
      s = C.drag(s, C.HANDLES[Math.floor(rand() * 6)],
        { x: (rand() - 0.5) * 60, y: (rand() - 0.5) * 50 });
    }
    const pts = C.points(s);
    const names = C.HANDLES;
    let tooClose = false;
    for (let i = 0; i < names.length && !tooClose; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (Math.hypot(pts[names[i]].x - pts[names[j]].x,
          pts[names[i]].y - pts[names[j]].y) < 2) { tooClose = true; break; }
      }
    }
    if (tooClose) continue; // coincident cevian feet make the ratios ill-conditioned
    const ev = C.evaluate(s);
    if (![ev.ratios.product, ...Object.values(ev.identities)].every(Number.isFinite)) continue;
    /* A nearly parallel extra cevian puts X, Y or Z far off the board; the
     * applet has the same floating-point limit, so leave those to the
     * degenerate-case checks below. */
    const crossings = Object.values(ev.crossings);
    if (crossings.some((p) => !Number.isFinite(p.x + p.y) ||
      Math.max(Math.abs(p.x), Math.abs(p.y)) > 1e4)) continue;
    count++;
    Object.values(ev.identities).forEach((v, i) => { if (near(v, 1, 1e-3)) ids[i]++; });
    const prod = Object.values(ev.identities).reduce((x, y) => x * y, 1);
    if (near(prod, ev.ratios.product ** 2, 1e-4)) squared++;
  }
  check("all six Ceva identities in the page's table equal 1",
    count > 450 && ids.every((n) => n === count), `${ids.join(",")} of ${count}`);
  check("the six identities multiply to Menelaus product squared", squared === count, `${squared}/${count}`);
}

{
  /* F, D and E through side fractions: collinear exactly when the product is
   * 1. A grid covers every sign pattern, including points on extensions. */
  const T = { A: { x: 190, y: 160 }, B: { x: 340, y: 230 }, C: { x: 20, y: 70 } };
  let iff = 0, total = 0, signs = 0, signTotal = 0;
  for (let u = -3; u <= 3.001; u += 0.5) {
    for (let v = -3; v <= 3.001; v += 0.5) {
      if (near(u, 0, 1e-9) || near(u, 1, 1e-9) || near(v, 0, 1e-9) || near(v, 1, 1e-9)) continue;
      /* Solve (u/(u-1))(v/(v-1))(w/(w-1)) = 1 for w. */
      const target = (1 - u) * (1 - v) / (u * v);
      const w = target / (target - 1);
      if (!Number.isFinite(w) || near(w, 0, 1e-9) || near(w, 1, 1e-9)) continue;
      const s = { A: T.A, B: T.B, C: T.C, F: pointOn(T.A, T.B, u),
                  D: pointOn(T.B, T.C, v), E: pointOn(T.C, T.A, w) };
      const ev = C.evaluate(s);
      total++;
      if (ev.collinear === near(ev.ratios.product, 1, 1e-7)) iff++;
      const outside = [u, v, w].filter((t) => t < 0 || t > 1).length;
      const unsigned = Math.abs(ev.ratios.AF_BF * ev.ratios.BD_CD * ev.ratios.CE_AE);
      signTotal++;
      if (near(unsigned, 1, 1e-7) === (outside === 1 || outside === 3)) signs++;
      /* A small nudge off the transversal breaks the equivalence. */
      const nudged = { ...s, E: pointOn(T.C, T.A, w + 0.07) };
      const ne = C.evaluate(nudged);
      total++;
      if (ne.collinear === near(ne.ratios.product, 1, 1e-7)) iff++;
    }
  }
  check("Menelaus' iff holds across a 13x13 grid and its nudges",
    total > 200 && iff === total, `${iff}/${total}`);
  check("unsigned product is 1 for one or three side extensions, as the page says",
    signTotal > 100 && signs === signTotal, `${signs}/${signTotal}`);
}

{
  const s = C.start({});
  const r = C.ratios(s);
  const ev = C.evaluate(s);
  check("directed Menelaus product is the negative of three Ceva-style ratios",
    near(r.product, -signedRatio(s.A, s.F, s.B) * signedRatio(s.B, s.D, s.C) *
      signedRatio(s.C, s.E, s.A), 1e-6));
  const x = refIntersect(s.B, s.E, s.A, s.D);
  const y = refIntersect(s.A, s.D, s.C, s.F);
  const z = refIntersect(s.B, s.E, s.C, s.F);
  check("X, Y and Z are BE∩AD, AD∩CF and BE∩CF",
    ok(ev.crossings.X, x) && ok(ev.crossings.Y, y) && ok(ev.crossings.Z, z));
  check("evaluate returns plain data for the picture", ev.points.F !== s.F && ev.points.F.x === s.F.x);
  check("format trims trailing zeroes", C.format(1.5, 3) === "1.5" && C.format(NaN) === "NaN");
}

/* --------------------------------------------- 5. the applet's degenerate edges */

{
  const p = { x: 0, y: 0 }, q = { x: 100, y: 0 };
  const r = { x: 0, y: 10 }, s = { x: 100, y: 10 };
  const n = C.intersect(p, q, r, s);
  check("parallel lines give NaN coordinates, as GeoSDoub.Intersect does",
    !Number.isFinite(n.x) && !Number.isFinite(n.y));
  const close = { x: 0.1, y: 0.2 };
  check("a point within sqrt(0.1) of the line's first end is left alone",
    ok(C.nearestPoint(close, p, q), close));
  const far = { x: 50, y: 30 };
  check("a point further away is projected onto the side line",
    ok(C.nearestPoint(far, p, q), { x: 50, y: 0 }));
  const s0 = C.start({ corners: { A: p, B: q, C: r } });
  check("start honours caller-supplied corners", ok(s0.A, p) && ok(s0.B, q) && ok(s0.C, r));
  check("the applet constants are exposed for the tutor",
    C.WIDTH === 400 && C.HEIGHT === 300 && C.HANDLES.length === 6);
}

done("menelaus-from-ceva");
