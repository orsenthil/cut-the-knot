#!/usr/bin/env node
"use strict";

/*
 * Logic test for diameters-and-chords/diameters-and-chords-core.js.
 *
 *   node porting/check-diameters-and-chords.mjs
 *
 * The page's one claim is the "if and only if": Ab = Ac exactly when Kb = Kc.
 * We check it in both directions on thousands of generated configurations:
 * set Ac = Ab and compare the K points, and start from a common K, rebuild the
 * two A points and check that they meet.  A second, independent transcription
 * of the applet's Compute(), lineCircle() and Intersect() is compared with the
 * core over a grid and over thousands of random angle sets, including the
 * one-pixel cutoffs and the stale Kb/Kc behaviour of the original bytecode.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("diameters-and-chords/diameters-and-chords-core.js", "DiametersAndChordsCore");

/* ------------------------------------------------------------ 1. the setting */

equal("the SVG board is the 500x450 applet scaled down", C.CIRCLE, { c: { x: 200, y: 216 }, r: 120 });
equal("the six draggable names", C.NAMES, ["Ab", "Ac", "B", "C", "Mt", "Nt"]);
{
  const s = C.START_ANGLES;
  check("Ab starts at the applet's 1.727875959474386 rad", s.Ab === 1.727875959474386);
  check("Ac starts at the applet's pi/2 rad", s.Ac === Math.PI / 2);
  check("B starts at the applet's 3.7699111843077517 rad", s.B === 3.7699111843077517);
  check("C starts at the applet's 5.235987755982989 rad", s.C === 5.235987755982989);
  check("Mt starts at the applet's 3.0925052683774528 rad", s.Mt === 3.0925052683774528);
}

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const samePoint = (p, q, tol = 1e-6) => {
  if (!p || !q) return !p && !q;
  const pn = Number.isFinite(p.x) && Number.isFinite(p.y);
  const qn = Number.isFinite(q.x) && Number.isFinite(q.y);
  if (!pn || !qn) return pn === qn; // both NaN points count as the same result
  return near(p.x, q.x, tol) && near(p.y, q.y, tol);
};

const start = C.start({});
const g0 = C.geometry(start);
{
  check("the start is not marked explored", C.result(start) === null);
  check("the start is a demo, never a win or a loss", C.result(start) !== "win" && C.result(start) !== "lose");
  check("the start has both checkbox options on (Show=1)", start.options.names && start.options.hint);
  check("Nt is antipodal to Mt at the start", near(C.dist(g0.Mt, g0.Nt), 2 * C.CIRCLE.r, 1e-6));
  check("Bt is antipodal to B at the start", near(C.dist(g0.B, g0.Bt), 2 * C.CIRCLE.r, 1e-6));
  check("Ct is antipodal to C at the start", near(C.dist(g0.C, g0.Ct), 2 * C.CIRCLE.r, 1e-6));
  check("the start has all six constructed points",
    [g0.M, g0.N, g0.Kb, g0.Kc, g0.L].every(C.finite));
  check("the start does not show the joined A points", !g0.finished && g0.aDistance > 1);
  check("the start's status reports both distances",
    /A points 18\.8 apart; K points 16\.3 apart/.test(C.describe(start)));
}

/* ------------------------------------------- 2. the applet's own method again */

/*
 * Straight from DiametersAndChordsCanvas.Compute() and CTKGeometry's
 * GeoSDoub.Intersect / IntersectX / IntersectY / Intersect(DoubPoint x4).
 * This deliberately shares no helper with the core above.
 */
function reference(ang, previous) {
  const c = { x: 200, y: 216 }, r = 120;
  const pt = (t) => ({ x: c.x + r * Math.cos(t), y: c.y - r * Math.sin(t) });
  const length = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  const ok = (p) => p && !Number.isNaN(p.x) && !Number.isNaN(p.y);

  function circleLine(p, q) {
    const dy = Math.abs(p.y - q.y), dx = Math.abs(p.x - q.x);
    if (dy > 1) {
      const m = (p.x - q.x) / (p.y - q.y), b = q.x - m * q.y;
      const A = 1 + m * m;
      const B = m * (b - c.x) - c.y;
      const Cc = c.y * c.y + (b - c.x) * (b - c.x) - r * r;
      const disc = B * B - A * Cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const y1 = (-B + root) / A, y2 = (-B - root) / A;
      return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
    }
    if (dx > 1) {
      const m = (p.y - q.y) / (p.x - q.x), b = q.y - m * q.x;
      const A = 1 + m * m;
      const B = m * (b - c.y) - c.x;
      const Cc = c.x * c.x + (b - c.y) * (b - c.y) - r * r;
      const disc = B * B - A * Cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const x1 = (-B + root) / A, x2 = (-B - root) / A;
      return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
    }
    return null;
  }
  function farther(hits, p) {
    if (!hits || !hits[0] || !hits[1]) return null;
    return length(hits[0], p) < length(hits[1], p) ? hits[1] : hits[0];
  }
  function meet(p, q, s, t) {
    const a = p.y - q.y, b = q.x - p.x, cc = p.x * q.y - p.y * q.x;
    const d = s.y - t.y, e = t.x - s.x, f = s.x * t.y - s.y * t.x;
    const det = a * e - d * b;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b * f - e * cc) / det, y: (cc * d - f * a) / det };
  }

  const Ab = pt(ang.Ab), Ac = pt(ang.Ac), B = pt(ang.B), Cc = pt(ang.C), Mt = pt(ang.Mt);
  const Bt = farther(circleLine(B, c), B);
  const Ct = farther(circleLine(Cc, c), Cc);
  const Nt = farther(circleLine(Mt, c), Mt);
  const M = meet(Ab, B, Mt, Nt);
  const N = meet(Ac, Cc, Mt, Nt);
  let Kb = previous ? previous.Kb : null;
  let Kc = previous ? previous.Kc : null;
  const kbHits = Bt ? circleLine(Bt, N) : null;
  if (kbHits && ok(kbHits[0])) Kb = farther(kbHits, Bt);
  const kcHits = Ct ? circleLine(Ct, M) : null;
  if (kcHits && ok(kcHits[0])) Kc = farther(kcHits, Ct);
  const L = meet(Ab, B, Ac, Cc);
  return { Ab, Ac, B, C: Cc, Mt, Nt, Bt, Ct, M, N, Kb, Kc, L };
}

{
  let compared = 0, bad = 0;
  const names = ["Bt", "Ct", "Nt", "M", "N", "Kb", "Kc", "L"];
  const compare = (ang) => {
    const core = C.geometryFromAngles(ang, null);
    const ref = reference(ang, null);
    compared++;
    for (const key of names) {
      if (!samePoint(core[key], ref[key])) {
        if (bad++ < 3) console.error(`   ${key} differs for ${JSON.stringify(ang)}:`, core[key], ref[key]);
      }
    }
  };
  const grid = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI,
    5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4, 2 * Math.PI];
  for (const ab of grid) for (const ac of grid) for (const b of grid) for (const cc of grid) {
    compare({ Ab: ab, Ac: ac, B: b, C: cc, Mt: (ab + ac + b + cc) / 4 });
  }
  const rnd = rng(4162);
  for (let i = 0; i < 4000; i++) {
    compare({ Ab: rnd() * 2 * Math.PI, Ac: rnd() * 2 * Math.PI,
      B: rnd() * 2 * Math.PI, C: rnd() * 2 * Math.PI, Mt: rnd() * 2 * Math.PI });
  }
  check(`core matches a second transcription of Compute() in ${compared} configurations`, bad === 0,
    `${bad} point mismatches`);
  check("the comparison covered every grid cell and 4000 random sets", compared === 6561 + 4000);
}

/* ------------------------------------- 3. drags, restrictions and stale hits */

{
  const rnd = rng(91662);
  let onCircle = 0, movedRight = 0, diameterMoves = 0, keptPair = 0;
  for (let i = 0; i < 400; i++) {
    const p = { x: 200 + (rnd() - 0.5) * 800, y: 216 + (rnd() - 0.5) * 800 };
    const q = C.clamp(p);
    if (near(C.dist(q, C.CIRCLE.c), C.CIRCLE.r, 1e-9)) onCircle++;
    const name = C.NAMES[i % 6];
    const s = C.movePoint(start, name, p);
    const g = C.geometry(s);
    if (samePoint(g[name], C.pointOnCircle(s.angles[name], C.CIRCLE))) movedRight++;
    if (name === "Mt" || name === "Nt") {
      diameterMoves++;
      if (near(C.dist(g.Mt, g.Nt), 240, 1e-6)) keptPair++;
    }
  }
  check("every dragged point is restricted to the circle", onCircle === 400, `${onCircle}/400`);
  check("each drag puts the named point at its new angle", movedRight === 400, `${movedRight}/400`);
  check("Mt and Nt remain antipodal after either is dragged", keptPair === diameterMoves && diameterMoves === 132,
    `${keptPair}/${diameterMoves}`);
}
{
  const moved = C.movePoint(start, "Ab", { x: 20, y: 30 });
  const g = C.geometry(moved);
  check("dragging Ab leaves Ac, B, C and Mt where they were",
    ["Ac", "B", "C", "Mt"].every((n) => samePoint(g[n], g0[n])));
  check("exploring sets the demo's done result", C.result(moved) === "done");
  check("exploring never produces a win or a loss",
    C.result(moved) !== "win" && C.result(moved) !== "lose");
}
{
  const s = C.start({ names: false, hint: false });
  check("Show=0 switches both checkboxes off", !s.options.names && !s.options.hint);
  const t = C.setOption(s, "names", true);
  check("the names checkbox toggles on its own", t.options.names && !t.options.hint);
  const r = C.reset(t);
  check("Reset keeps the chosen options", r.options.names && !r.options.hint);
  check("Reset returns the points to the applet's start angles",
    ["Ab", "Ac", "B", "C", "Mt"].every((n) => near(r.angles[n], C.START_ANGLES[n])));
  check("Reset restores the start's antipodal diameter",
    near(C.dist(C.geometry(r).Mt, C.geometry(r).Nt), 240, 1e-6));
}
{
  const parallel = C.lineIntersection({ x: 0, y: 0 }, { x: 100, y: 100 },
    { x: 0, y: 5 }, { x: 100, y: 105 });
  check("parallel lines give the applet's NaN point", Number.isNaN(parallel.x) && Number.isNaN(parallel.y));
  const tiny = C.lineCircle({ x: 200, y: 216 }, { x: 200.2, y: 216.1 }, C.CIRCLE);
  check("a line shorter than a pixel has no circle intersection", tiny === null);
  const antipodes = C.other([{ x: 0, y: 0 }, { x: 240, y: 0 }], { x: 0, y: 0 });
  check("Other() returns the farther intersection", antipodes.x === 240);
}
{
  // B is put on the diameter, so Bt = Nt.  Choose Ac so that CAc passes
  // through Bt; then N = Bt and Compute()'s Kb line has zero length.
  const ang = { Ab: 1.1, Ac: 0, B: 3.0925052683774528, C: 5.235987755982989,
    Mt: 3.0925052683774528 };
  const B = C.pointOnCircle(ang.B, C.CIRCLE);
  const Bt = C.antipode(B, C.CIRCLE);
  const Cc = C.pointOnCircle(ang.C, C.CIRCLE);
  const second = C.other(C.lineCircle(Cc, Bt, C.CIRCLE), Cc);
  ang.Ac = C.angleOf(second, C.CIRCLE);
  const valid = C.start({});
  const prev = C.geometry(valid);
  const stale = C.geometryFromAngles(ang, prev);
  const refStale = reference(ang, { Kb: prev.Kb, Kc: prev.Kc });
  check("the core keeps the old Kb when the secant collapses", samePoint(stale.Kb, prev.Kb));
  check("the second transcription keeps the same old Kb", samePoint(refStale.Kb, prev.Kb));
  check("the collapsed configuration still matches the reference",
    ["Bt", "Ct", "Nt", "M", "N", "Kc", "L"].every((n) => samePoint(stale[n], refStale[n])));
}

/* -------------------------------------- 4. the page's claim, both directions */

{
  const rnd = rng(20261127);
  let forward = 0, skipped = 0, broken = 0;
  for (let i = 0; i < 3000; i++) {
    const ab = rnd() * 2 * Math.PI;
    const ang = { Ab: ab, Ac: ab, B: rnd() * 2 * Math.PI,
      C: rnd() * 2 * Math.PI, Mt: rnd() * 2 * Math.PI };
    const g = C.geometryFromAngles(ang, null);
    if (![g.B, g.C, g.Mt].every(C.finite) || !samePoint(g.Mt, C.pointOnCircle(ang.Mt, C.CIRCLE))) {
      skipped++; continue;
    }
    const bc = C.dist(g.B, g.C), bm = C.dist(g.B, g.Mt), cm = C.dist(g.C, g.Mt);
    if (bc < 2 || bm < 2 || cm < 2) { skipped++; continue; } // degenerate clusters
    if (g.kExact) forward++; else if (broken++ < 3) console.error("   forward failure", ang, g.kDistance);
  }
  check(`Ac = Ab forces Kc = Kb in ${forward} separate configurations`, broken === 0 && forward > 2000,
    `${broken} failures, ${skipped} degenerate skips`);
}
{
  // Converse: begin with a single point K on the circle, read off N = BtK on
  // the diameter and M = CtK on it, then build Ac = C N and Ab = B M.
  const rnd = rng(770077);
  let converse = 0, skipped = 0, broken = 0;
  for (let i = 0; i < 3000; i++) {
    const ang = { B: rnd() * 2 * Math.PI, C: rnd() * 2 * Math.PI, Mt: rnd() * 2 * Math.PI };
    const kAngle = rnd() * 2 * Math.PI;
    const base = C.geometryFromAngles(Object.assign({ Ab: 0, Ac: 1 }, ang), null);
    if (!base.Bt || !base.Ct || !base.Nt) { skipped++; continue; }
    const K = C.pointOnCircle(kAngle, C.CIRCLE);
    const N = C.lineIntersection(base.Bt, K, base.Mt, base.Nt);
    const M = C.lineIntersection(base.Ct, K, base.Mt, base.Nt);
    const ac = C.other(C.lineCircle(base.C, N, C.CIRCLE), base.C);
    const ab = C.other(C.lineCircle(base.B, M, C.CIRCLE), base.B);
    if (!ac || !ab || !C.finite(N) || !C.finite(M)) { skipped++; continue; }
    const g = C.geometryFromAngles(Object.assign(ang, {
      Ab: C.angleOf(ab, C.CIRCLE), Ac: C.angleOf(ac, C.CIRCLE),
    }), null);
    if (!g.Kb || !g.Kc) { skipped++; continue; }
    if (g.aExact && g.kExact) converse++; else if (broken++ < 3) {
      console.error("   converse failure", ang, kAngle, g.aDistance, g.kDistance);
    }
  }
  check(`Kb = Kc forces Ab = Ac in ${converse} configurations`, broken === 0 && converse > 2000,
    `${broken} failures, ${skipped} degenerate skips`);
}
{
  // The applet's Finished test is one pixel, not exact equality.  With B and
  // C almost on top of each other, the two K points can be under a pixel
  // apart for a trivial reason while the A points are far apart.  The exact
  // theorem above is unaffected; this is a display-tolerance caveat.
  const rnd = rng(31337);
  let found = 0, forwardTol = 0, tolBroken = 0;
  for (let i = 0; i < 12000; i++) {
    const shared = rnd() * 2 * Math.PI;
    const ang = { Ab: rnd() * 2 * Math.PI, Ac: rnd() * 2 * Math.PI,
      B: shared, C: shared + (rnd() - 0.5) * 0.02, Mt: rnd() * 2 * Math.PI };
    const g = C.geometryFromAngles(ang, null);
    if (!g.Kb || !g.Kc || !Number.isFinite(g.kDistance)) continue;
    if (!g.aCoincide && g.kCoincide && C.dist(g.B, g.C) < 2) found++;
  }
  for (let i = 0; i < 5000; i++) {
    const ab = rnd() * 2 * Math.PI;
    const sameA = { Ab: ab, Ac: ab, B: rnd() * 2 * Math.PI,
      C: rnd() * 2 * Math.PI, Mt: rnd() * 2 * Math.PI };
    const h = C.geometryFromAngles(sameA, null);
    if (!h.Kb || !h.Kc || C.dist(h.B, h.C) < 2 || C.dist(h.B, h.Mt) < 2 ||
        C.dist(h.C, h.Mt) < 2) continue; // the degenerate clusters above
    if (h.aCoincide && h.kCoincide) forwardTol++;
    else if (tolBroken++ < 3) console.error("   one-pixel forward failure", sameA, h.kDistance);
  }
  check("the forward implication also holds with the applet's one-pixel test", tolBroken === 0);
  check("one-pixel K coincidence can be degenerate (B and C nearly equal)", found > 0, `${found} cases`);
  check("the one-pixel forward test still succeeded when A points met", forwardTol > 3000,
    `${forwardTol} successes, ${tolBroken} failures`);
}

done("diameters-and-chords");
