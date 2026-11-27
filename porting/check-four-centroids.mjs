#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-centroids/four-centroids-core.js.
 *
 *   node porting/check-four-centroids.mjs
 *
 * The page's claims, checked over a grid of configurations and 600 random
 * ones: the three centroid lines are parallel to AP, BP, CP and meet at G;
 * ABC and GaGbGc are homothetic with centre J and coefficient -1/3, so sides
 * are parallel, 1/3 as long, P maps to G and GJ:JP = 1:3; L, M, N are the
 * side midpoints with LG:LA = LGa:LP = 1:3; and GbGc is parallel to BC and
 * 1/3 of it.  The test also shows that the page's "U is the midpoint of AG"
 * gives the 2:1 split only when P happens to be G — the working midpoint is
 * the midpoint of AP, and the conclusion GbGc || BC does not depend on U.
 *
 * The applet's own Compute(), midpoint() and GeoSDoub.GetParallelTo() are
 * transcribed a second time, straight from the bytecode (including its
 * 100-step parallel segment and its three pairwise line intersections), and
 * compared with the core over every configuration used below.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-centroids/four-centroids-core.js", "FourCentroidsCore");

const P = (x, y) => ({ x: x, y: y });
const add = (p, q) => P(p.x + q.x, p.y + q.y);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const mul = (p, k) => P(p.x * k, p.y * k);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (p, q) => p.x * q.y - p.y * q.x;
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closeP = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);

function distToLine(p, a, b) {
  const v = sub(b, a), n = Math.hypot(v.x, v.y);
  return n === 0 ? dist(p, a) : Math.abs(cross(sub(p, a), v)) / n;
}

/* -------------------------------------------------- the applet, transcribed */

/* Midpoint(DoubPoint, DoubPoint) and Midpoint(DoubPoint, DoubPoint, DoubPoint). */
function appletMid(a, b) { return P((a.x + b.x) / 2.0, (a.y + b.y) / 2.0); }
function appletMid3(a, b, c) {
  return P((a.x + b.x + c.x) / 3.0, (a.y + b.y + c.y) / 3.0);
}

/* GeoSDoub.GetParallelTo(p, a, b) = p + 100*(a-b). */
function appletParallel(p, a, b) {
  return P(p.x + 100.0 * (a.x - b.x), p.y + 100.0 * (a.y - b.y));
}

/* GeoSDoub.Intersect(p1,p2,p3,p4): the bytecode uses a fixed cutoff of 1. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1.0) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (a2 * c1 - a1 * c2) / det);
}

/* FourCentroidsCanvas.Compute(), in the bytecode's own order. */
function appletCompute(A, P0) {
  const M = [], N = [], G = [], parallelEnd = [];
  for (let i = 0; i < 3; i++) {
    const k1 = (i + 1) % 3, k2 = (i + 2) % 3;
    M[i] = appletMid(A[k1], A[k2]);
    N[i] = appletMid(P0, A[i]);
    G[i] = appletMid3(P0, A[k1], A[k2]);
  }
  G[3] = appletMid3(A[0], A[1], A[2]);
  for (let i = 0; i < 3; i++) {
    parallelEnd[i] = appletParallel(G[i], P0, A[i]);
    /* DoubLine is built from (parallelEnd[i], G[i]). */
  }
  const J = appletMid3(
    appletIntersect(A[0], G[0], A[1], G[1]),
    appletIntersect(A[1], G[1], A[2], G[2]),
    appletIntersect(A[2], G[2], A[0], G[0]),
  );
  return { M: M, N: N, G: G, parallelEnd: parallelEnd, J: J };
}

/* An independent proof of the page's claims, not using the core. */
function pageClaims(A, P0) {
  const G = [appletMid3(P0, A[1], A[2]), appletMid3(P0, A[2], A[0]),
    appletMid3(P0, A[0], A[1]), appletMid3(A[0], A[1], A[2])];
  const Gabc = G[3];
  const J = mul(add(add(add(A[0], A[1]), A[2]), P0), 1 / 4);
  const scale = Math.max(1, ...A.concat([P0]).map((q) => dist(q, Gabc)));
  const tol = 1e-9 * scale;
  let parallel = true, sides = true, midpoint = true, center = true, uTrue = true;
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    /* G[i] + P - A[i] lies on the line through G[i] in direction P-A[i]. */
    const q = add(G[i], sub(P0, A[i]));
    parallel = parallel && distToLine(Gabc, G[i], q) <= tol;
    /* GaGbGc is the image of ABC under homothety at J, factor -1/3. */
    sides = sides && distToLine(sub(G[j], G[i]), P(0, 0), sub(A[j], A[i])) <= tol
      && Math.abs(dist(G[j], G[i]) * 3 - dist(A[i], A[j])) <= 1e-7 * scale
      && dist(G[i], add(J, mul(sub(A[i], J), -1 / 3))) <= tol;
    /* L is the midpoint of the side opposite A[i]. */
    const k1 = (i + 1) % 3, k2 = (i + 2) % 3;
    const Lp = appletMid(A[k1], A[k2]);
    midpoint = midpoint
      && Math.abs(dist(Lp, Gabc) * 3 - dist(Lp, A[i])) <= 1e-7 * scale
      && Math.abs(dist(Lp, G[i]) * 3 - dist(Lp, P0)) <= 1e-7 * scale
      && distToLine(sub(G[i], Gabc), P(0, 0), sub(A[i], P0)) <= tol;
  }
  center = close(dist(Gabc, J) / dist(J, P0), 1 / 3, 1e-9)
    && dist(add(J, mul(sub(P0, J), -1 / 3)), Gabc) <= tol;

  /* The page names U = midpoint(A,G); the claim needs midpoint(A,P). */
  const Gac = appletMid(A[0], Gabc);
  const Gap = appletMid(A[0], P0);
  const Gb = G[1], Gc = G[2];
  const split = (u) => {
    const cu = dist(u, A[2]), bu = dist(u, A[1]);
    if (cu <= tol || bu <= tol) return null;
    return close(dist(Gb, A[2]) / dist(Gb, u), 2, 1e-7)
      && close(dist(Gc, A[1]) / dist(Gc, u), 2, 1e-7);
  };
  const pageU = split(Gac), trueU = split(Gap);
  uTrue = trueU !== false
    && distToLine(sub(Gb, Gc), P(0, 0), sub(A[2], A[1])) <= tol
    && Math.abs(dist(Gb, Gc) * 3 - dist(A[1], A[2])) <= 1e-7 * scale;
  return {
    G: G, J: J, parallel: parallel, sides: sides, midpoint: midpoint,
    center: center, pageU: pageU, workingU: uTrue,
    /* GbGc || BC and GbGc:BC = 1:3, independent of U. */
    smallSide: distToLine(sub(Gb, Gc), P(0, 0), sub(A[2], A[1])) <= tol
      && Math.abs(dist(Gb, Gc) * 3 - dist(A[1], A[2])) <= 1e-7 * scale,
  };
}

/* A configuration is usable when ABC is not collapsed and A, B, C and P are
 * spread far enough for the applet's fixed intersection cutoff of 1. */
function usable(A, P0) {
  const area = Math.abs(cross(sub(A[1], A[0]), sub(A[2], A[0])));
  if (area < 200) return false;
  return appletCompute(A, P0).G.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))
    && Number.isFinite(appletCompute(A, P0).J.x);
}

const configurations = [];
{
  /* A grid: three corners and P on a 4 by 4 lattice, excluding collapsed ones. */
  const grid = [P(40, 40), P(110, 55), P(200, 95), P(300, 70), P(75, 160),
    P(180, 150), P(330, 140), P(50, 250), P(160, 240), P(290, 250)];
  for (const a of grid) for (const b of grid) for (const c of grid) for (const p of grid) {
    const A = [a, b, c];
    if (usable(A, p)) configurations.push({ A: A, P: p });
  }
}
{
  const rnd = rng(20261127);
  let made = 0;
  while (made < 600) {
    const A = [0, 1, 2].map(() => P(20 + 360 * rnd(), 20 + 260 * rnd()));
    const p = P(20 + 360 * rnd(), 20 + 260 * rnd());
    if (!usable(A, p)) continue;
    configurations.push({ A: A, P: p });
    made++;
  }
}

/* ----------------------------------------------------------- 1. the start */

{
  const s = C.start();
  const layout = C.appletLayout();
  equal("A, B and C start at the applet's integer-division positions", s.A, layout.A);
  equal("P starts at DoubCircle's centre", s.P, layout.P);
  check("the page's second applet checks names (show=1)", C.start({ show: "1" }).show.names);
  check("the other three checkboxes start unchecked", ["statement1", "statement2", "premises"]
    .every((k) => !C.start({ show: "1" }).show[k]));
  check("without show=1 names are unchecked", !C.start().show.names);
  check("the diagram has no win, loss or finish", C.result(s) === null
    && C.result(C.setShow(s, "names", true)) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  check("the core exposes no DOM", typeof globalThis.document === "undefined"
    && typeof globalThis.window === "undefined");
  const g = C.geometry(s);
  check("the start configuration is not degenerate", !!g && !g.degenerate);
  check("every page claim holds at the start", g.claims.parallels && g.claims.homothetic
    && g.claims.midpointRatios && g.claims.centerRatio && g.claims.intersectionsAgree);
  check("the page's U claim is already false at the start", !g.claims.pageU && g.claims.workingU);
}

/* --------------------------------------------- 2. options and dragging */

{
  const s = C.start({ show: "1" });
  const on = C.setShow(s, "statement2", true);
  check("a checkbox changes only itself", on.show.names && on.show.statement2
    && !on.show.statement1 && !on.show.premises);
  check("a checkbox marks the diagram explored", on.explored && !s.explored);
  check("unchecking restores the state", !C.setShow(on, "statement2", false).show.statement2);
  check("an unknown option is ignored", C.setShow(s, "bogus", true) === s);
  const r = C.reset(on);
  check("Reset keeps all four checkbox states", ["names", "statement1", "statement2", "premises"]
    .every((k) => r.show[k] === on.show[k]));
  equal("Reset restores the applet's starting points", r.A, s.A);
  equal("Reset restores P", r.P, s.P);
  const moved = C.movePoint(s, "P", P(9999, -9999));
  equal("P is clamped to the board", moved.P, P(388, 12));
  equal("A is clamped to the board", C.movePoint(s, "A", P(-5, 9999)).A[0], P(12, 288));
  check("an unknown handle is ignored", C.movePoint(s, "Z", P(1, 2)) === s);
  check("a bad point is ignored", C.movePoint(s, "A", { x: NaN, y: 0 }) === s);
  check("a drag marks the diagram explored", moved.explored);
}

/* ---------------------- 3. the applet's Compute against the core, exactly */

{
  let tested = 0, bad = 0, worst = 0;
  for (const cfg of configurations) {
    const s = { A: cfg.A, P: cfg.P, show: C.start().show, explored: false };
    const g = C.geometry(s);
    const a = appletCompute(cfg.A, cfg.P);
    if (!g) { bad++; continue; }
    for (let i = 0; i < 3; i++) {
      for (const [name, x, y] of [["M", g.M[i], a.M[i]], ["N", g.N[i], a.N[i]],
        ["G", g.G[i], a.G[i]], ["parallel end", add(g.G[i], mul(sub(cfg.P, cfg.A[i]), 100)), a.parallelEnd[i]]]) {
        const e = dist(x, y);
        worst = Math.max(worst, e);
        if (e > 1e-9 * Math.max(1, dist(cfg.A[0], cfg.P))) { bad++; if (bad < 4) console.error(name, x, y); }
      }
    }
    if (!closeP(g.Gabc, a.G[3], 1e-9)) bad++;
    if (!closeP(g.J, a.J, 1e-8)) bad++;
    if (!closeP(g.J, g.Jformula, 1e-8)) bad++;
    tested++;
  }
  check(`the core matches a literal Compute() on all ${tested} configurations`, bad === 0,
    `worst error ${worst}`);
  equal("all configurations were usable", tested, configurations.length);
}

/* --------------------------------- 4. the page's claims, all configurations */

{
  let parallelBad = 0, sideBad = 0, midBad = 0, centerBad = 0, coreBad = 0;
  let uPageFalse = 0, uTrueOK = 0, smallSideOK = 0;
  for (const cfg of configurations) {
    const g = C.geometry({ A: cfg.A, P: cfg.P, show: C.start().show, explored: false });
    const cl = pageClaims(cfg.A, cfg.P);
    if (!g || !g.claims.parallels || !cl.parallel) parallelBad++;
    if (!g || !g.claims.homothetic || !cl.sides) sideBad++;
    if (!g || !g.claims.midpointRatios || !cl.midpoint) midBad++;
    if (!g || !g.claims.centerRatio || !cl.center) centerBad++;
    if (!g || !g.claims.intersectionsAgree) coreBad++;
    if (g && !g.claims.pageU && cl.pageU === false) uPageFalse++;
    if (g && g.claims.workingU && cl.workingU) uTrueOK++;
    if (g && cl.smallSide) smallSideOK++;
  }
  const n = configurations.length;
  check(`the three centroid lines meet at G in all ${n} cases`, parallelBad === 0);
  check(`ABC and GaGbGc are homothetic in all ${n} cases`, sideBad === 0);
  check(`LG:LA = LGa:LP = 1:3 in all ${n} cases`, midBad === 0);
  check(`GJ:JP = 1:3 and P maps to G in all ${n} cases`, centerBad === 0);
  check(`the applet's three intersections agree in all ${n} cases`, coreBad === 0);
  check(`the page's U = midpoint(AG) claim fails in all ${n} cases`, uPageFalse === n);
  check(`the midpoint of AP gives the 2:1 split in all ${n} cases`, uTrueOK === n);
  check(`GbGc || BC and GbGc:BC = 1:3 in all ${n} cases`, smallSideOK === n);
}

/* ------------------------------------ 5. the page's ratios, computed again */

{
  const A = [P(320, 240), P(133, 50), P(80, 240)], Q = P(200, 195);
  const g = C.geometry({ A: A, P: Q, show: C.start().show, explored: false });
  /* The exact starting numbers from the bytecode. */
  check("Ga is the centroid of BCP", closeP(g.G[0], P(413 / 3, 485 / 3), 1e-12));
  check("Gb is the centroid of CAP", closeP(g.G[1], P(200, 225), 1e-12));
  check("Gc is the centroid of ABP", closeP(g.G[2], P(653 / 3, 485 / 3), 1e-12));
  check("G is the centroid of ABC", closeP(g.Gabc, P(533 / 3, 530 / 3), 1e-12));
  check("J is (A+B+C+P)/4", closeP(g.J, P(733 / 4, 725 / 4), 1e-12));
  check("G-Ga = (A-P)/3", closeP(sub(g.Gabc, g.G[0]), mul(sub(A[0], Q), 1 / 3), 1e-12));
  check("G-Gb = (B-P)/3", closeP(sub(g.Gabc, g.G[1]), mul(sub(A[1], Q), 1 / 3), 1e-12));
  check("G-Gc = (C-P)/3", closeP(sub(g.Gabc, g.G[2]), mul(sub(A[2], Q), 1 / 3), 1e-12));
  check("G = J - (P-J)/3", closeP(g.Gabc, add(g.J, mul(sub(Q, g.J), -1 / 3)), 1e-12));
  check("L is the midpoint of BC", closeP(g.M[0], P(106.5, 145), 1e-12));
  check("U, V, W are the midpoints of AP, BP, CP", closeP(g.N[0], P(260, 217.5), 1e-12)
    && closeP(g.N[1], P(166.5, 122.5), 1e-12) && closeP(g.N[2], P(140, 217.5), 1e-12));
  const s2 = C.start({ show: "1" });
  const storable = C.snapshot(s2);
  check("snapshot is plain data and keeps the four points", storable.A.length === 3
    && closeP(storable.P, s2.P, 0) && storable.show.names && storable.G.length === 4
    && !!storable.J && !!storable.claims);
}

/* -------------------------------------------------- 6. degenerate states */

{
  const same = { A: [P(100, 100), P(100, 100), P(100, 100)], P: P(100, 100),
    show: C.start().show, explored: false };
  const g = C.geometry(same);
  check("a collapsed diagram is reported, not crashed", !!g && g.degenerate);
  check("the description asks the player to pull the points apart",
    /Pull the points apart/.test(C.describe(same)));
  check("bad state data returns no geometry without throwing", C.geometry(null) === null
    && C.geometry({ A: [P(0, 0)], P: P(1, 1) }) === null);
  check("the illustration still has no ending after a drag",
    C.result(C.movePoint(same, "A", P(250, 50))) === null);
}

done("four-centroids");
