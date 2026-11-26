#!/usr/bin/env node
"use strict";

/*
 * Logic test for cantor-point/cantor-point-core.js.
 *
 *   node porting/check-cantor-point.mjs
 *
 * Checked: the starting triangle against the applet's init(); the six
 * checkbox constructions of CantorPointCanvas.Draw, transcribed a second time
 * straight from the bytecode (GeoSDoub.FindCircumcenter / Intersect, GetPerp,
 * MidPoint, GetParallelTo and GetCircle) and compared with the core on fixed
 * triangles and 500 random ones; every claim on the applet's page over 700
 * random triangles; the degenerate cases; the page's complex-number formula
 * for N; and the general inscribed n-gon remark for n = 3..7.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cantor-point/cantor-point-core.js", "CantorPointCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) =>
  p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });

/* ---------------------- the applet's own methods, transcribed from bytecode */

/* GeoSDoub.Intersect(P1,P2,P3,P4): lines in ax+by+c=0 form, |det|<1 -> NaN. */
function jIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

const jMid = (P, Q) => ({ x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 });

/* CantorPointCanvas.GetPerp(P,Q): P + a quarter turn of Q-P. */
const jGetPerp = (P, Q) => ({ x: P.x + P.y - Q.y, y: P.y - P.x + Q.x });

/* GeoSDoub.GetParallelTo(P,Q,R): P + 100*(R-Q). */
const jParallel = (P, Q, R) => ({
  x: P.x + 100 * (R.x - Q.x),
  y: P.y + 100 * (R.y - Q.y),
});

/* GeoSDoub.FindCircumcenter: intersection of the bisectors of AB and BC. */
function jCircumcenter(A, B, Cc) {
  const m1 = jMid(A, B), m2 = jMid(B, Cc);
  const p1 = { x: m1.x + (B.y - A.y), y: m1.y - (B.x - A.x) };
  const p2 = { x: m2.x + (Cc.y - B.y), y: m2.y - (Cc.x - B.x) };
  return jIntersect(m1, p1, m2, p2);
}

/* CantorPointCanvas.GetCircle: centre and the mean distance to the vertices. */
function jCircle(A, B, Cc) {
  const O = jCircumcenter(A, B, Cc);
  return { center: O, radius: (dist(O, A) + dist(O, B) + dist(O, Cc)) / 3 };
}

/** The whole CantorPointCanvas.Draw construction, exactly as the bytecode. */
function jDraw(s) {
  const circle = jCircle(s.A, s.B, s.C);
  const O = circle.center;
  const perpA = jGetPerp(s.A, O), perpB = jGetPerp(s.B, O), perpC = jGetPerp(s.C, O);

  // Tangential-triangle vertices: L6 (tangents at A,B), L7 (B,C), L8 (C,A).
  const L6 = jIntersect(s.A, perpA, s.B, perpB);
  const L7 = jIntersect(s.B, perpB, s.C, perpC);
  const L8 = jIntersect(s.C, perpC, s.A, perpA);

  // S9 = midpoint(B,C), S10 = midpoint(C,A), S11 = midpoint(A,B).
  const m9 = jMid(s.B, s.C), m10 = jMid(s.C, s.A), m11 = jMid(s.A, s.B);
  const p9 = jParallel(m9, s.A, O), p10 = jParallel(m10, s.B, O), p11 = jParallel(m11, s.C, O);

  // S15, S16, S17: the feet on the tangents; and the three Cantor lines meet.
  const footA = jIntersect(m9, p9, s.A, L6);
  const footB = jIntersect(m10, p10, s.B, L7);
  const footC = jIntersect(m11, p11, s.C, L8);
  const cantor = jIntersect(m9, p9, m10, p10);

  const nine = jCircle(m9, m10, m11);
  return {
    O, R: circle.radius, L6, L7, L8,
    m9, m10, m11, p9, p10, p11, footA, footB, footC, cantor,
    N: nine.center, r9: nine.radius,
  };
}

/* ------------------------------------------- 1. the start and plain functions */

{
  const s = C.start();
  const width = 400, height = 300;
  const cx = width / 2, cy = height / 2, r = Math.min(width, height) / 4;
  const at = (a) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  check("start A is the applet's point at -1.6", closePoint(s.A, at(-1.6), 1e-12));
  check("start B is the applet's point at -4", closePoint(s.B, at(-4), 1e-12));
  check("start C is the applet's point at -0.2", closePoint(s.C, at(-0.2), 1e-12));
  check("the starting triangle is not degenerate", !C.isDegenerate(s));
  check("an illustration has no result", C.result(s) === null);
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === at(-1.6).x && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown handle name changes nothing", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === s.A.x);
}

/* -------------------------------------------- 2. fixed triangles and claims */

const fixed = [
  ["equilateral", tri({ x: 200, y: 40 }, { x: 60, y: 280 }, { x: 340, y: 280 })],
  ["right", tri({ x: 60, y: 250 }, { x: 60, y: 40 }, { x: 320, y: 250 })],
  ["obtuse at A", tri({ x: 60, y: 150 }, { x: 320, y: 90 }, { x: 300, y: 240 })],
  ["obtuse at B", tri({ x: 180, y: 40 }, { x: 50, y: 260 }, { x: 360, y: 250 })],
  ["very flat", tri({ x: 40, y: 150 }, { x: 360, y: 160 }, { x: 200, y: 175 })],
  ["applet start", C.start()],
];

for (const [name, s] of fixed) {
  const cl = C.claims(s);
  check(`${name}: all eight claims hold`, cl.all, JSON.stringify(cl));
  const c = C.construct(s);
  check(`${name}: the page's formula gives the nine-point centre`,
    closePoint(c.P, c.N, 1e-7 * Math.max(1, c.R)));
}

/* -------------------- 3. the applet's construction vs the core, point by point */

{
  const rand = rng(2942);
  let compared = 0;
  const samples = fixed.slice();
  for (let i = 0; i < 500; i++) {
    samples.push([`random ${i}`, tri(
      { x: 15 + rand() * 370, y: 15 + rand() * 270 },
      { x: 15 + rand() * 370, y: 15 + rand() * 270 },
      { x: 15 + rand() * 370, y: 15 + rand() * 270 },
    )]);
  }
  let bad = 0;
  const maxTol = (s) => 1e-6 * Math.max(1, dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A));
  const compare = (label, p, q, tol) => {
    // Parallel tangents put a tangential-triangle vertex at infinity in both
    // transcriptions; there is no finite point to compare there.
    if (!C.finite(p) && !C.finite(q)) return;
    if (!closePoint(p, q, tol)) {
      bad++;
      if (bad <= 4) console.error(`   ${label}: applet ${JSON.stringify(p)}, core ${JSON.stringify(q)}`);
    }
  };
  for (const [name, s] of samples) {
    if (C.isDegenerate(s) || Math.abs(C.cross(s.A, s.B, s.C)) < 500) continue;
    const tol = maxTol(s);
    const j = jDraw(s);
    const core = C.construct(s);
    compare(`${name}: circumcenter`, j.O, core.O, tol);
    compare(`${name}: circumradius`, { x: j.R, y: j.R }, { x: core.R, y: core.R }, tol);
    compare(`${name}: tangent vertex tAB / L6`, j.L6, core.tAB, tol);
    compare(`${name}: tangent vertex tBC / L7`, j.L7, core.tBC, tol);
    compare(`${name}: tangent vertex tCA / L8`, j.L8, core.tCA, tol);
    compare(`${name}: midpoint of BC / S9`, j.m9, core.mA, tol);
    compare(`${name}: midpoint of CA / S10`, j.m10, core.mB, tol);
    compare(`${name}: midpoint of AB / S11`, j.m11, core.mC, tol);
    // The applet obtains a foot by intersecting with the tangential vertex;
    // when that vertex is at infinity it has no finite foot to compare.
    if (C.finite(j.L6)) compare(`${name}: Cantor foot A / S15`, j.footA, core.footA, tol);
    if (C.finite(j.L7)) compare(`${name}: Cantor foot B / S16`, j.footB, core.footB, tol);
    if (C.finite(j.L8)) compare(`${name}: Cantor foot C / S17`, j.footC, core.footC, tol);
    compare(`${name}: Cantor point`, j.cantor, core.P, tol);
    compare(`${name}: nine-point centre`, j.N, core.N, tol);
    compare(`${name}: nine-point radius`, { x: j.r9, y: j.r9 }, { x: core.r9, y: core.r9 }, tol);
    compared++;
  }
  check(`applet and core agree on all ${compared} configurations`, compared > 480 && bad === 0,
    `${bad} mismatches`);
  check("the circumcenter is transcribed correctly (start)", closePoint(jCircumcenter(C.start().A, C.start().B, C.start().C), C.construct(C.start()).O, 1e-6));
}

/* ----------------------------- 4. every claim on many random triangles */

{
  const rand = rng(2029);
  let tested = 0, bad = 0;
  for (let trial = 0; trial < 700; trial++) {
    const s = tri(
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
    );
    if (C.isDegenerate(s) || Math.abs(C.cross(s.A, s.B, s.C)) < 300) continue;
    tested++;
    if (!C.claims(s).all) {
      bad++;
      if (bad <= 3) console.error(`   triangle ${trial}: ${JSON.stringify(C.claims(s))}`);
    }
  }
  check(`all eight claims hold on ${tested} random triangles`, tested > 650 && bad === 0,
    `${bad} failures`);
}

/* ------------------------- 5. the general n-gon remark on the page */

{
  const rand = rng(777);
  for (let n = 3; n <= 7; n++) {
    let tested = 0, bad = 0;
    for (let trial = 0; trial < 60; trial++) {
      const cx = 100 + rand() * 200, cy = 100 + rand() * 100, radius = 40 + rand() * 60;
      const base = rand() * Math.PI * 2;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = base + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.2;
        pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
      }
      const g = C.polygonCantor(pts);
      if (g.degenerate) continue;
      tested++;
      for (const line of g.lines) {
        // The line through the centroid parallel to the radius passes through
        // the Cantor point, and is perpendicular to the tangent there.
        const cross = (g.P.x - line.g.x) * line.dir.y - (g.P.y - line.g.y) * line.dir.x;
        if (Math.abs(cross) > 1e-6 * radius) bad++;
        const tangent = { x: -line.dir.y, y: line.dir.x };
        if (Math.abs(line.dir.x * tangent.x + line.dir.y * tangent.y) > 1e-9) bad++;
      }
    }
    check(`inscribed ${n}-gon: all lines pass through the Cantor point`, tested === 60 && bad === 0,
      `${tested} polygons, ${bad} bad lines`);
  }
  // For a triangle the general point is exactly the nine-point centre.
  const s = C.start();
  check("the n=3 Cantor point is the nine-point centre",
    closePoint(C.polygonCantor([s.A, s.B, s.C]).P, C.construct(s).N, 1e-9));
}

/* ---------------------------- 6. degenerate input is safe */

{
  const flat = tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 });
  check("collinear points are degenerate", C.isDegenerate(flat));
  check("no construction for a degenerate triangle", C.construct(flat).degenerate);
  check("no claim passes for a degenerate triangle", !C.claims(flat).all);
  check("duplicate points are degenerate too",
    C.isDegenerate(tri({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 100, y: 100 })));
  check("three coincident points are degenerate",
    C.isDegenerate(tri({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 })));
}

/* ------------------------ 7. translation, rotation and scaling */

{
  const s = C.start();
  const c = C.construct(s);
  const k = 2.5, ang = 0.7, dx = -30, dy = 45;
  const tx = (p) => ({
    x: dx + k * (Math.cos(ang) * p.x - Math.sin(ang) * p.y),
    y: dy + k * (Math.sin(ang) * p.x + Math.cos(ang) * p.y),
  });
  const moved = tri(tx(s.A), tx(s.B), tx(s.C));
  const cm = C.construct(moved);
  const expected = tx(c.P);
  check("Cantor's point follows a translation, rotation and scaling",
    closePoint(cm.P, expected, 1e-7 * k));
  check("the nine-point radius scales with the triangle", close(cm.r9, k * c.r9, 1e-7 * k));
  check("the transformed triangle still satisfies every claim", C.claims(moved).all);
}

done("cantor-point");
