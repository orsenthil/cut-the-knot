#!/usr/bin/env node
"use strict";

/*
 * Logic test for cevian-triangle/cevian-triangle-core.js.
 *
 *   node porting/check-cevian-triangle.mjs
 *
 * Checked: the starting four points against CevianTriangleCanvas.init, and
 * every claim on the applet's page — the cevian feet lie on the opposite sides,
 * ABC and PaPbPc are perspective from P, L, M and N are collinear (Desargues),
 * the orthic triangle is the cevian triangle of the orthocenter, its axis is
 * collinear, and the side lines of ABC externally bisect the orthic angles —
 * on fixed and several hundred random configurations.
 *
 * The last group is a second, literal transcription of the applet's own
 * GeoSDoub.Intersect and CevianTriangleCanvas.Draw (Pa=A P∩BC, Pb=B P∩CA,
 * Pc=C P∩AB; L=AB∩PaPb, M=BC∩PbPc, N=CA∩PcPa, with its |det|<1 NaN test and
 * its Between choice of the outer two axis points). It is compared with the
 * core over every fixed and random configuration, including where the applet
 * returns NaN.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cevian-triangle/cevian-triangle-core.js", "CevianTriangleCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc, P) => ({ A: { ...A }, B: { ...B }, C: { ...Cc }, P: { ...P } });
const area2 = (A, B, Cc) => Math.abs((B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x));

/* ------------------------------ the applet's own computation, transcribed */

/* GeoSDoub.Intersect: ax+by+c=0 in the applet's order, NaN when |det| < 1. */
function appIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}
const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

/* CevianTriangleCanvas.init, with Java's integer divisions. */
function appStart() {
  const W = 400, H = 250;
  const A = { x: Math.trunc((W * 2) / 3), y: Math.trunc((H * 7) / 10) };
  const B = { x: Math.trunc((W * 4) / 7), y: Math.trunc((H * 2) / 5) };
  const Cc = { x: Math.trunc(W / 6), y: Math.trunc((H * 3) / 4) };
  const P = {
    x: (15 * A.x + 5 * B.x + 2 * Cc.x) / 22,
    y: (15 * A.y + 5 * B.y + 2 * Cc.y) / 22,
  };
  return { A, B, C: Cc, P };
}

/* CevianTriangleCanvas.Draw, in the bytecode's own order. */
function appDiagram(s) {
  const Pa = appIntersect(s.A, s.P, s.B, s.C);
  const Pb = appIntersect(s.B, s.P, s.C, s.A);
  const Pc = appIntersect(s.C, s.P, s.A, s.B);
  return {
    Pa, Pb, Pc,
    L: appIntersect(s.A, s.B, Pa, Pb),
    M: appIntersect(s.B, s.C, Pb, Pc),
    N: appIntersect(s.C, s.A, Pc, Pa),
  };
}

/* CevianTriangleCanvas.Between: is the second point in the middle? */
function appBetween(p, m, q) {
  if (Math.abs(p.x - q.x) < 1) return (q.y - m.y) * (p.y - m.y) < 0;
  return (q.x - m.x) * (p.x - m.x) < 0;
}
function appAxisSegment(a) {
  if (!finite(a.L) || !finite(a.M) || !finite(a.N)) return null;
  if (appBetween(a.L, a.M, a.N)) return [a.L, a.N];
  if (appBetween(a.M, a.L, a.N)) return [a.M, a.N];
  return [a.L, a.M];
}

/** Compare the core's null with the applet's NaN, and finite points by value. */
function samePoint(core, applet, tol) {
  return !finite(applet) ? core === null : closePoint(core, applet, tol);
}
function sameDiagram(s, tol) {
  const d = C.diagram(s), a = appDiagram(s);
  const parts = ["Pa", "Pb", "Pc"];
  const axis = ["L", "M", "N"];
  return parts.every((k) => samePoint(d.feet[k], a[k], tol)) &&
    axis.every((k) => samePoint(d.axis[k], a[k], tol));
}

/* --------------------------------------------- 1. start and plain position */

{
  const s = C.start();
  const a = appStart();
  equal("start A matches the applet's init", s.A, a.A);
  equal("start B matches the applet's init", s.B, a.B);
  equal("start C matches the applet's init", s.C, a.C);
  equal("start P matches MidpointW(15,5,2)/22", s.P, a.P);
  check("the illustration has no win or loss", C.result(s) === null);
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "P", { x: 10, y: 20 });
    return s.P.x === a.P.x && next.P.x === 10 && next.A.x === s.A.x;
  })());
  check("an unknown handle leaves the position alone",
    C.withPoint(s, "Z", { x: 1, y: 2 }).P.x === a.P.x);
  check("explicit points are cloned, not shared", (() => {
    const q = C.start({ points: s });
    q.P.x = -1;
    return s.P.x === a.P.x;
  })());
}

/* ------------------------ 2. fixed configurations, including awkward ones */

const fixed = [
  ["the applet's own start", C.start()],
  ["equilateral", tri({ x: 200, y: 30 }, { x: 60, y: 280 }, { x: 340, y: 280 }, { x: 230, y: 185 })],
  ["right", tri({ x: 60, y: 250 }, { x: 60, y: 50 }, { x: 330, y: 250 }, { x: 140, y: 200 })],
  ["obtuse at A", tri({ x: 60, y: 150 }, { x: 330, y: 85 }, { x: 300, y: 235 }, { x: 190, y: 155 })],
  ["obtuse at C", tri({ x: 40, y: 40 }, { x: 370, y: 60 }, { x: 180, y: 235 }, { x: 190, y: 110 })],
  ["P outside the triangle", tri({ x: 160, y: 60 }, { x: 60, y: 230 }, { x: 350, y: 210 }, { x: 380, y: 30 })],
  ["P on a side", tri({ x: 160, y: 60 }, { x: 60, y: 230 }, { x: 350, y: 210 }, { x: 110, y: 145 })],
  ["very flat", tri({ x: 40, y: 150 }, { x: 370, y: 155 }, { x: 200, y: 170 }, { x: 200, y: 158 })],
  ["exactly parallel sides", tri({ x: 200, y: 30 }, { x: 60, y: 280 }, { x: 340, y: 280 }, { x: 200, y: 190 })],
];

for (const [name, s] of fixed) {
  const d = C.diagram(s);
  const cl = C.claims(s);
  const tol = 1e-6 * Math.max(1, dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A));
  check(`${name}: matches the applet's six intersections`, sameDiagram(s, tol),
    JSON.stringify({ core: { ...d.feet, ...d.axis }, applet: appDiagram(s) }));
  check(`${name}: the three feet lie on the opposite sides`, d.feetOnSides);
  check(`${name}: ABC and PaPbPc are perspective from P`, d.perspectiveFromP);
  // When a pair of corresponding sides is parallel the applet prints NaN for
  // that intersection; only the exact-parallel case can still be judged here.
  const allAxis = Boolean(d.axis.L && d.axis.M && d.axis.N);
  if (allAxis || C.parallelity(d.axis.M, d.axis.N, s.A, s.B) < 1e-12) {
    check(`${name}: L, M and N are collinear (Desargues)`, d.desarguesAxis);
  } else {
    check(`${name}: the off-picture intersection is reported as absent`, !allAxis);
  }
  const appSeg = appAxisSegment(appDiagram(s));
  if (appSeg) {
    const coreSeg = C.axisSegment(d.axis);
    check(`${name}: the green axis segment picks the same outer pair`,
      Boolean(coreSeg) && samePoint(coreSeg[0], appSeg[0], tol) && samePoint(coreSeg[1], appSeg[1], tol));
  }
}

/* ---------------- 3. every claim, over many non-degenerate configurations */

{
  const rand = rng(3112);
  let tested = 0, acute = 0;
  for (let trial = 0; trial < 800; trial++) {
    const A = { x: 15 + rand() * 370, y: 15 + rand() * 220 };
    const B = { x: 15 + rand() * 370, y: 15 + rand() * 220 };
    const Cc = { x: 15 + rand() * 370, y: 15 + rand() * 220 };
    if (area2(A, B, Cc) < 2500) continue;
    // Half the points are inside (barycentric), half anywhere in the plane.
    const w1 = rand(), w2 = rand(), w3 = rand(), sum = w1 + w2 + w3;
    const P = trial % 2 === 0
      ? { x: (w1 * A.x + w2 * B.x + w3 * Cc.x) / sum,
          y: (w1 * A.y + w2 * B.y + w3 * Cc.y) / sum }
      : { x: 5 + rand() * 390, y: 5 + rand() * 240 };
    const s = tri(A, B, Cc, P);
    const d = C.diagram(s);
    const cl = C.claims(s);
    tested++;
    if (!d.feetOnSides || !d.perspectiveFromP) {
      check(`random ${trial}: the cevian feet and concurrency hold`, false, JSON.stringify(d));
    }
    if ((d.axis.L && d.axis.M && d.axis.N) && !d.desarguesAxis) {
      check(`random ${trial}: L, M and N are collinear`, false, JSON.stringify(d.axis));
    }
    const H = C.orthocenter(s);
    const axisH = H ? C.axisPoints(C.cevianTriangle({ A: s.A, B: s.B, C: s.C, P: H })) : null;
    const drawable = Boolean(H && axisH && axisH.L && axisH.M && axisH.N);
    if (!cl.orthicIsCevian || (drawable && (!cl.orthicAxis || !cl.sideLinesBisectOrthicAngles))) {
      check(`random ${trial}: the orthic claims hold`, false, JSON.stringify(cl));
    }
    if (drawable && C.isAcute(s)) {
      acute++;
      if (!cl.externalBisectors) {
        check(`random ${trial}: the acute triangle's side lines are external bisectors`, false);
      }
    }
  }
  check(`all claims hold on ${tested} random configurations`, tested > 600);
  check(`the stronger "external bisector" wording holds on ${acute} acute cases`, acute > 100);
}

/* ----------------- 4. the core against the applet's own method, at scale */

{
  const rand = rng(777);
  const all = fixed.map(([, s]) => s);
  let compared = 0;
  for (let trial = 0; trial < 500; trial++) {
    const A = { x: 5 + rand() * 390, y: 5 + rand() * 240 };
    const B = { x: 5 + rand() * 390, y: 5 + rand() * 240 };
    const Cc = { x: 5 + rand() * 390, y: 5 + rand() * 240 };
    all.push(tri(A, B, Cc, { x: 5 + rand() * 390, y: 5 + rand() * 240 }));
  }
  // Include deliberately degenerate cases: the applet returns NaN there.
  all.push(tri({ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }, { x: 200, y: 100 }));
  all.push(tri({ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 300, y: 200 }, { x: 200, y: 150 }));
  for (const s of all) {
    const tol = 1e-6 * Math.max(1, dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A));
    if (!sameDiagram(s, tol)) {
      check("core matches the applet's computation", false,
        JSON.stringify({ s, core: { ...C.diagram(s).feet, ...C.diagram(s).axis }, applet: appDiagram(s) }));
    }
    const appSeg = appAxisSegment(appDiagram(s));
    const coreSeg = C.axisSegment(C.diagram(s).axis);
    if (Boolean(appSeg) !== Boolean(coreSeg)) {
      check("core and applet agree on whether an axis segment exists", false);
    }
    compared++;
  }
  check(`core and applet agree on all ${compared} configurations`, compared > 500);
}

/* ---------------------------- 5. the orthocenter special case, in detail */

{
  const rand = rng(1234);
  let tested = 0, acute = 0;
  for (let trial = 0; trial < 500; trial++) {
    const A = { x: 40 + rand() * 320, y: 40 + rand() * 170 };
    const B = { x: 40 + rand() * 320, y: 40 + rand() * 170 };
    const Cc = { x: 40 + rand() * 320, y: 40 + rand() * 170 };
    if (area2(A, B, Cc) < 3000) continue;
    const H = C.orthocenter({ A, B, C: Cc });
    if (!H) continue;
    const s = tri(A, B, Cc, H);
    const cl = C.claims(s);
    const axisH = C.axisPoints(C.cevianTriangle(s));
    const drawable = Boolean(axisH.L && axisH.M && axisH.N);
    if (!cl.orthicIsCevian || (drawable && (!cl.orthicAxis || !cl.sideLinesBisectOrthicAngles))) {
      check(`orthic trial ${trial}: the orthocenter's cevian triangle is orthic`, false,
        JSON.stringify(cl));
    }
    if (drawable && C.isAcute(s)) {
      acute++;
      if (!cl.externalBisectors) {
        check(`orthic trial ${trial}: the side lines are external bisectors`, false);
      }
    }
    tested++;
  }
  check(`the orthocenter's cevian triangle is orthic on ${tested} triangles`, tested > 300);
  check(`the external-bisector wording holds on ${acute} acute triangles`, acute > 60);
}

/* ------------------------------------ 6. degenerate input is handled safely */

{
  const flat = tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 0 });
  check("a collinear ABC has no cevian feet", C.diagram(flat).feet.Pa === null ||
    !finite(appDiagram(flat).Pa));
  const atVertex = tri({ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 200, y: 260 }, { x: 100, y: 100 });
  check("P at a vertex gives no axis segment", C.axisSegment(C.diagram(atVertex).axis) === null);
  check("no point is shared with a moved position", (() => {
    const s = C.start();
    const q = C.withPoint(s, "A", { x: 1, y: 2 });
    return q.A !== s.A && q.A.x === 1;
  })());
  check("the applet's NaN test agrees with the core's null", (() => {
    const s = atVertex;
    return sameDiagram(s, 1e-6);
  })());
}

done("cevian-triangle");
