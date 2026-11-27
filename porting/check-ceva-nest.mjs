#!/usr/bin/env node
"use strict";

/*
 * Logic test for ceva-nest/ceva-nest-core.js.
 *
 *   node porting/check-ceva-nest.mjs
 *
 * Checked: the starting positions straight from CevaNestCanvas.init, the
 * nested construction against a second literal transcription of the applet's
 * GeoSDoub.Intersect / CTKGeometryPlus.Barycenter and Compute (fixed and 800
 * random configurations), and every claim the article makes: Q is the cevian
 * triangle of P, R is the cevian triangle of Q, P1R1/P2R2/P3R3 concur, the
 * corresponding Ceva products are 1, and the cross-ratio identity used in the
 * proof holds. The random set puts both inner points inside, outside and on
 * the edges of the triangle, and includes obtuse and very flat triangles.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("ceva-nest/ceva-nest-core.js", "CevaNestCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) =>
  Boolean(p) && Boolean(q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const state = (V, P, Q) => ({ V: V.map((p) => ({ ...p })), P: { ...P }, Q: { ...Q } });

/* --------------------------- the applet's own arithmetic, transcribed twice */

/* GeoSDoub.Intersect(P1,P2,P3,P4), with its |det| < 1 cutoff and NaN result. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y;
  const b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y;
  const b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* CTKGeometryPlus.Barycenter(A,B,C): the plain average of three points. */
function appletBarycenter(a, b, c) {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

/* CevaNestCanvas.init with integer canvas arithmetic (as in the bytecode). */
function appletStart(width, height) {
  const cx = (width / 2) | 0, cy = (height / 2) | 0;
  const V = [
    { x: ((cx * 5) / 6) | 0, y: ((cy * 6) / 7) | 0 },
    { x: ((cx * 2) / 5) | 0, y: ((cy / 6) | 0) },
    { x: ((cx / 5) | 0), y: ((cy * 9) / 10) | 0 },
  ];
  const P = appletBarycenter(V[0], V[1], V[2]);
  const Q = { x: P.x + 20, y: P.y - 40 };
  return state(V, P, Q);
}

/* CevaNestCanvas.Compute, statement for statement, before any drawing. */
function appletCompute(s) {
  const V = s.V, P = s.P, Q = s.Q;
  const q = [
    appletIntersect(V[0], P, V[1], V[2]),
    appletIntersect(V[1], P, V[2], V[0]),
    appletIntersect(V[2], P, V[0], V[1]),
  ];
  const r = [
    appletIntersect(q[0], Q, q[1], q[2]),
    appletIntersect(q[1], Q, q[2], q[0]),
    appletIntersect(q[2], Q, q[0], q[1]),
  ];
  const W = appletBarycenter(
    appletIntersect(V[0], r[0], V[1], r[1]),
    appletIntersect(V[1], r[1], V[2], r[2]),
    appletIntersect(V[2], r[2], V[0], r[0]),
  );
  const S = [];
  const T = [];
  for (let k = 0; k < 3; k++) {
    const n = (k + 1) % 3, m = (k + 2) % 3;
    S[k] = appletIntersect(V[k], q[k], q[n], q[m]);
    T[k] = appletIntersect(V[k], r[k], V[n], V[m]);
  }
  return { q, r, W, S, T };
}

const finitePoint = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);

/* ---------------------------------------- 1. the start and the plain API */

{
  const s = C.start();
  equal("start matches CevaNestCanvas.init at 400x250", s, appletStart(400, 250));
  equal("start matches the applet at 320x200", C.start({ width: 320, height: 200 }), appletStart(320, 200));
  equal("start matches the applet at 501x333", C.start({ width: 501, height: 333 }), appletStart(501, 333));
  check("P starts at the centroid of the three vertices", (() => {
    const v = s.V;
    return closePoint(s.P, appletBarycenter(v[0], v[1], v[2]), 1e-12);
  })());
  check("Q starts 20 right and 40 up from P", close(s.Q.x - s.P.x, 20, 0) && close(s.Q.y - s.P.y, -40, 0));
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "V0", { x: 12, y: 34 });
    return s.V[0].x === 166 && next.V[0].x === 12 && next.V[1].x === s.V[1].x && C.withPoint(s, "Q", next.Q).V[0].x === 166;
  })());
  check("an unknown handle leaves the position alone", (() => {
    const next = C.withPoint(s, "Z", { x: 1, y: 2 });
    return JSON.stringify(next) === JSON.stringify(s);
  })());
  check("the illustration has no result to report", C.result(s) === null);
}

/* ------------------------------ 2. fixed diagrams, including awkward ones */

const fixed = [
  ["the applet's own start", C.start()],
  ["P and Q outside the triangle", state(
    [{ x: 170, y: 80 }, { x: 40, y: 200 }, { x: 330, y: 210 }],
    { x: 350, y: 15 }, { x: 20, y: 30 })],
  ["a flat triangle", state(
    [{ x: 30, y: 120 }, { x: 370, y: 126 }, { x: 200, y: 140 }],
    { x: 210, y: 80 }, { x: 150, y: 190 })],
  ["an obtuse triangle", state(
    [{ x: 60, y: 40 }, { x: 370, y: 200 }, { x: 200, y: 220 }],
    { x: 120, y: 180 }, { x: 300, y: 30 })],
  ["P near a side", state(
    [{ x: 90, y: 50 }, { x: 320, y: 60 }, { x: 200, y: 220 }],
    { x: 205, y: 45 }, { x: 200, y: 130 })],
  ["Q far outside", state(
    [{ x: 100, y: 40 }, { x: 60, y: 210 }, { x: 340, y: 150 }],
    { x: 190, y: 120 }, { x: 700, y: -200 })],
  ["a large triangle", state(
    [{ x: -300, y: -100 }, { x: 500, y: -200 }, { x: 100, y: 600 }],
    { x: 20, y: 10 }, { x: 200, y: 300 })],
];

for (const [label, s] of fixed) {
  const m = C.construct(s);
  const a = appletCompute(s);
  const tol = 1e-6 * Math.max(1, m.scale);
  check(`${label}: the whole construction matches the applet`,
    m.ok &&
    ["q", "r", "S", "T"].every((key) =>
      a[key].every((p, k) => closePoint(p, m[key][k], tol) || (!finitePoint(p) && m[key][k] === null))) &&
    closePoint(a.W, m.W, tol),
    `core ${JSON.stringify(m.q)} / ${JSON.stringify(m.r)} / ${JSON.stringify(m.W)}`);
  check(`${label}: page claim holds (P-R lines concur)`,
    m.ok && m.concurrent && close(m.cevaOuter, 1, 1e-6) && close(m.cevaInner, 1, 1e-6),
    `spread ${m.spread}, ceva ${m.cevaOuter}, ${m.cevaInner}`);
}

/* ---------------------------- 3. random diagrams, against the applet twice */

{
  const rand = rng(1581);
  let compared = 0, skipped = 0, badConstruction = 0, badClaim = 0, badCrossRatio = 0;
  let worstPoint = 0, worstSpread = 0;
  for (let trial = 0; trial < 800; trial++) {
    const inside = (lo, hi) => lo + rand() * (hi - lo);
    // Sometimes put P or Q outside the triangle, sometimes on a side.
    const s = state(
      [0, 1, 2].map(() => ({ x: inside(20, 380), y: inside(20, 230) })),
      { x: inside(-80, 480), y: inside(-80, 330) },
      { x: inside(-80, 480), y: inside(-80, 330) },
    );
    const m = C.construct(s);
    const a = appletCompute(s);
    if (!m.ok) {
      skipped++;
      check(`random ${trial}: the applet also fails when the core does`,
        !finitePoint(a.W) || !a.q.every(finitePoint) || !a.r.every(finitePoint));
      continue;
    }
    compared++;
    const tol = 1e-6 * m.scale;
    for (const key of ["q", "r", "S", "T"]) {
      a[key].forEach((p, k) => {
        const q = m[key][k];
        if (finitePoint(p) && q) worstPoint = Math.max(worstPoint, dist(p, q) / m.scale);
        else if (finitePoint(p) !== Boolean(q)) badConstruction++;
      });
    }
    if (!closePoint(a.W, m.W, tol)) badConstruction++;
    if (!m.concurrent || !close(m.cevaOuter, 1, 1e-6) || !close(m.cevaInner, 1, 1e-6)) badClaim++;
    worstSpread = Math.max(worstSpread, m.spread / m.scale);
    // The article's cross-ratio identity for the proof points S and T.
    for (let k = 0; k < 3; k++) {
      if (!m.S[k] || !m.T[k]) continue;
      const n = (k + 1) % 3, h = (k + 2) % 3;
      const left = C.ratio(s.V[h], s.V[n], m.q[k]) / C.ratio(s.V[h], s.V[n], m.T[k]);
      const right = C.ratio(m.q[n], m.q[h], m.S[k]) / C.ratio(m.q[n], m.q[h], m.r[k]);
      if (!close(left, right, 1e-5)) badCrossRatio++;
    }
  }
  check(`the core matches the applet's construction on ${compared} random diagrams`,
    compared > 700 && badConstruction === 0, `worst point error ${worstPoint}`);
  check(`the applet's parallel cut-off agrees on ${skipped} diagrams`, skipped > 0);
  check("the page's concurrency claim holds on every random diagram",
    badClaim === 0 && worstSpread < 2e-6, `worst spread ${worstSpread}`);
  check("the article's cross-ratio identity holds for S and T", badCrossRatio === 0);
  check("both nested cevian triangles satisfy Ceva's theorem",
    fixed.every(([, s]) => {
      const m = C.construct(s);
      return !m.ok || (close(m.cevaInner, 1, 1e-6) && close(m.cevaOuter, 1, 1e-6));
    }));
}

/* ------------------------------------------- 4. the degenerate configurations */

{
  const flat = state(
    [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }],
    { x: 100, y: 40 }, { x: 100, y: 80 });
  check("a flat triangle has no construction", !C.construct(flat).ok);
  const same = state(
    [{ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 300, y: 100 }],
    { x: 100, y: 100 }, { x: 200, y: 200 });
  check("coincident vertices have no construction", !C.construct(same).ok);
  check("P exactly on a side collapses the inner triangle", !C.construct(state(
    [{ x: 90, y: 50 }, { x: 320, y: 60 }, { x: 200, y: 220 }],
    { x: 205, y: 55 }, { x: 200, y: 130 })).ok);
  check("a nearly parallel construction is reported, not drawn", (() => {
    const s = state(
      [{ x: 0, y: 0 }, { x: 100, y: 0.2 }, { x: 50, y: 100 }],
      { x: 1000000, y: 1 }, { x: -1000000, y: 2 });
    return !C.construct(s).ok;
  })());
  check("intersect detects the applet's parallel cutoff", (() => {
    const p = C.intersect({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 5 }, { x: 100, y: 5 });
    return p === null;
  })());
  check("a plain crossing is found where the applet finds it", closePoint(
    C.intersect({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: -50 }, { x: 50, y: 50 }),
    appletIntersect({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: -50 }, { x: 50, y: 50 }),
    1e-12));
}

done("ceva-nest");
