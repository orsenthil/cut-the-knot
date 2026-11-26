#!/usr/bin/env node
"use strict";

/*
 * Logic test for bqt-lemma/bqt-lemma-core.js.
 *
 *   node porting/check-bqt-lemma.mjs
 *
 * Checked on the applet's default 400x300 diagram and on 500 generated
 * configurations: the exact claim [DEM] = ([ABD]+[BCE])/2, the page's note
 * [ABD]*[BCE] = [BDE]^2 with Heron's area as the applet computes it, the two
 * trapezoid identities, h_F = (h_A+h_C)/2, and the special case B = midpoint
 * of AC. The second half is a literal, independent transcription of the
 * applet's own bytecode (GeoSDoub.GetParallelTo / GeoSDoub.Intersect /
 * DoubLine.CreateMidPoint / UpdateMidPoint and UpgradeD / UpgradeE) and checks
 * that the core's rebuilds and every handle move agree with it.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bqt-lemma/bqt-lemma-core.js", "BqtLemmaCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q &&
  (Number.isNaN(p.x) ? Number.isNaN(q.x) : close(p.x, q.x, tol)) &&
  (Number.isNaN(p.y) ? Number.isNaN(q.y) : close(p.y, q.y, tol));

/* ------------------- the applet's own methods, transcribed from the bytecode */

/* GeoSDoub.GetParallelTo(P,Q,R): return P + 100*(Q-R), i.e. through P || QR. */
function appletParallel(P, Q, R) {
  return { x: P.x + 100 * (Q.x - R.x), y: P.y + 100 * (Q.y - R.y) };
}

/* GeoSDoub.Intersect(P1,P2,P3,P4), with its 1-unit determinant cutoff. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* BQTLemmaCanvas.UpgradeD, straight from the four calls in the bytecode. */
function appletUpgradeD(A, B, Cc, E) {
  const throughEparallelCE = appletParallel(B, Cc, E);
  const throughEparallelBE = appletParallel(A, B, E);
  return appletIntersect(A, throughEparallelBE, B, throughEparallelCE);
}

/* BQTLemmaCanvas.UpgradeE, straight from its four calls. */
function appletUpgradeE(A, B, Cc, D) {
  const throughDparallelAD = appletParallel(B, A, D);
  const throughDparallelBD = appletParallel(Cc, B, D);
  return appletIntersect(B, throughDparallelAD, Cc, throughDparallelBD);
}

/* DoubLine.CreateMidPoint(t): the point at weight t of A. */
function appletCreateMidPoint(A, Cc, t) {
  return { x: A.x * t + Cc.x * (1 - t), y: A.y * t + Cc.y * (1 - t) };
}

/* DoubLine.UpdateMidPoint(B), restricted to the segment: returns t and coef. */
function appletUpdateMidPoint(A, Cc, B) {
  const d2 = (A.x - Cc.x) * (A.x - Cc.x) + (A.y - Cc.y) * (A.y - Cc.y);
  const d4 = (A.x - Cc.x) * (Cc.x - B.x) + (A.y - Cc.y) * (Cc.y - B.y);
  let t = -d4 / d2;
  t = Math.max(0, Math.min(1, t));
  return { t, coef: 1 - t, point: appletCreateMidPoint(A, Cc, t) };
}

/* BQTLemmaCanvas.Area: Heron's formula from the three side lengths. */
function appletArea(P, Q, R) {
  const a = dist(P, Q), b = dist(Q, R), c = dist(R, P);
  const s = (a + b + c) / 2;
  return Math.sqrt(s * (s - a) * (s - b) * (s - c));
}

/* --------------------------------------------------- 1. the starting diagram */

{
  const s = C.start();
  equal("start A matches init on a 400x300 canvas", s.A, { x: 80, y: 240 });
  equal("start C matches init on a 400x300 canvas", s.C, { x: 320, y: 240 });
  equal("start B is CreateMidPoint(1-0.6)", s.B, { x: 224, y: 240 });
  equal("start D matches init", s.D, { x: 400 / 3, y: 60 });
  equal("start F is the midpoint of AC", C.midPoint(s.A, s.C), { x: 200, y: 240 });
  check("start E matches the applet's UpgradeE", closePoint(s.E, appletUpgradeE(s.A, s.B, s.C, s.D), 1e-9),
    `core ${JSON.stringify(s.E)}, applet ${JSON.stringify(appletUpgradeE(s.A, s.B, s.C, s.D))}`);
  check("the illustration has no result", C.result(s) === null);
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "D", { x: 100, y: 100 });
    return s.D.x === 400 / 3 && next.D.x === 100 && next.E.x !== s.E.x;
  })());
  check("an unknown handle leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
}

/* ------------------------------------- 2. the claim, on the starting diagram */

{
  const s = C.start();
  const m = C.measurements(s);
  const cl = C.claims(s);
  const tol = 1e-6 * Math.max(1, m.areas.ABD + m.areas.BCE);
  check("start: DEM is half the sum of ABD and BCE", close(m.areas.DEM, m.halfSum, tol),
    `DEM ${m.areas.DEM}, half sum ${m.halfSum}`);
  check("start: the claim also holds with Heron areas",
    close(appletArea(s.D, s.E, m.F),
          (appletArea(s.A, s.B, s.D) + appletArea(s.B, s.C, s.E)) / 2, tol));
  check("start: ABD times BCE equals BDE squared", close(m.product, m.square, 1e-6 * Math.max(1, m.square)));
  check("start: the two trapezoid areas match", cl.trapezoidABD && cl.trapezoidBCE);
  check("start: the midpoint is equally far from D,E as A and C average", cl.halfAltitude);
  check("start: all of the page's claims pass", Object.values(cl).every(Boolean), JSON.stringify(cl));
}

/* ----------------------------------------- 3. B at the midpoint of AC (page) */

{
  const s = C.start();
  const F = C.midPoint(s.A, s.C);
  const mid = C.withPoint(s, "B", F);
  const m = C.measurements(mid);
  check("dragging B to F makes B the midpoint", C.measurements(mid).atMidpoint);
  check("B=F: the three triangles are equal (page's easy case)",
    Math.max(m.areas.DEM, m.areas.ABD, m.areas.BCE) -
    Math.min(m.areas.DEM, m.areas.ABD, m.areas.BCE) < 1e-6 * Math.max(1, m.areas.DEM),
    JSON.stringify(m.areas));
  check("B=F: coef is 0.5 as in UpdateMidPoint", Math.abs(mid.coef - 0.5) < 1e-12);
}

/* --------------- 4. hundreds of configurations, including E-driven ones */

{
  const rand = rng(20150417);
  let tested = 0;
  for (let trial = 0; trial < 500; trial++) {
    const A = { x: 30 + rand() * 300, y: 30 + rand() * 220 };
    const ang = rand() * Math.PI * 2;
    const len = 100 + rand() * 260;
    const Cc = { x: A.x + len * Math.cos(ang), y: A.y + len * Math.sin(ang) };
    const t = 0.05 + rand() * 0.9;
    const D0 = {
      x: (A.x + Cc.x) / 2 - Math.sin(ang) * (50 + rand() * 180),
      y: (A.y + Cc.y) / 2 + Math.cos(ang) * (50 + rand() * 180),
    };
    const s = C.start({ A, C: Cc, coef: 1 - t, D: D0 });
    const m = C.measurements(s);
    if (!m.valid) continue;
    const scale = Math.max(1, m.areas.ABD + m.areas.BCE);
    const okMain = close(m.areas.DEM, m.halfSum, 1e-6 * scale);
    const okHeron = close(appletArea(s.D, s.E, m.F),
                          (appletArea(s.A, s.B, s.D) + appletArea(s.B, s.C, s.E)) / 2,
                          1e-5 * scale);
    const okProduct = close(appletArea(s.A, s.B, s.D) * appletArea(s.B, s.C, s.E),
                            appletArea(s.B, s.D, s.E) ** 2,
                            1e-5 * Math.max(1, appletArea(s.B, s.D, s.E) ** 2));
    const cl = C.claims(s);
    if (!okMain || !okHeron || !okProduct || !cl || !Object.values(cl).every(Boolean)) {
      check(`trial ${trial}: every claim holds`, false,
        JSON.stringify({ okMain, okHeron, okProduct, cl, s }));
    }
    tested++;
  }
  check(`all claims hold on ${tested} generated configurations`, tested === 500);
}

/* --------------------- 5. the core's geometry vs the applet's own bytecode */

{
  const rand = rng(77004);
  let compared = 0;
  for (let trial = 0; trial < 500; trial++) {
    const A = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
    const Cc = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
    if (dist(A, Cc) < 40) continue;
    const t = rand();
    const B = appletCreateMidPoint(A, Cc, t);
    const D = { x: 10 + rand() * 380, y: 10 + rand() * 280 };
    const E = { x: 10 + rand() * 380, y: 10 + rand() * 280 };
    const upd = appletUpdateMidPoint(A, Cc, B);
    const cases = [
      ["start with D", C.start({ A, C: Cc, coef: 1 - t, D }),
       { B, D, E: appletUpgradeE(A, B, Cc, D) }],
      ["start with E", C.start({ A, C: Cc, coef: 1 - t, E }),
       { B, D: appletUpgradeD(A, B, Cc, E), E }],
    ];
    for (const [name, core, expected] of cases) {
      const tol = 1e-6 * Math.max(1, dist(A, Cc), dist(core.D, core.E));
      for (const key of ["B", "D", "E"]) {
        if (!closePoint(core[key], expected[key], tol)) {
          check(`${name}: ${key} matches the applet`, false,
            `core ${JSON.stringify(core[key])}, applet ${JSON.stringify(expected[key])}`);
        }
      }
    }
    const s = cases[0][1];
    const moves = [
      ["A", { x: A.x + 17, y: A.y - 23 }],
      ["B", { x: B.x - 31, y: B.y + 19 }],
      ["C", { x: Cc.x + 12, y: Cc.y + 29 }],
      ["D", { x: D.x + 9, y: D.y - 14 }],
      ["E", { x: E.x - 21, y: E.y + 11 }],
    ];
    for (const [name, p] of moves) {
      const got = C.withPoint(s, name, p);
      let want;
      if (name === "A" || name === "C") {
        const AA = name === "A" ? p : A;
        const CC = name === "C" ? p : Cc;
        const BB = appletCreateMidPoint(AA, CC, 1 - (1 - t));
        want = name === "A"
          ? { B: BB, D: s.D, E: appletUpgradeE(AA, BB, CC, s.D) }
          : { B: BB, D: appletUpgradeD(AA, BB, CC, s.E), E: s.E };
      } else if (name === "B") {
        const u = appletUpdateMidPoint(A, Cc, p);
        want = { B: u.point, D: s.D, E: appletUpgradeE(A, u.point, Cc, s.D) };
      } else if (name === "D") {
        want = { B, D: p, E: appletUpgradeE(A, B, Cc, p) };
      } else {
        want = { B, D: appletUpgradeD(A, B, Cc, p), E: p };
      }
      const de = dist(got.D, got.E);
      const tol = 1e-5 * Math.max(1, dist(A, Cc), Number.isFinite(de) ? de : 1);
      for (const key of ["B", "D", "E"]) {
        if (!closePoint(got[key], want[key], tol)) {
          check(`${name} drag ${key} matches the applet's UpgradePoints`, false,
            `core ${JSON.stringify(got[key])}, applet ${JSON.stringify(want[key])}, tol ${tol}`);
        }
      }
    }
    check("UpdateMidPoint recovers t and coef", Math.abs(upd.t - t) < 1e-9 && Math.abs(upd.coef - (1 - t)) < 1e-9);
    compared++;
  }
  check(`core and applet agree on ${compared} configurations and all five handle moves`, compared > 400);
}

/* -------------------------- 6. unsafe input stays finite or is flagged NaN */

{
  const flat = C.start({ A: { x: 0, y: 0 }, C: { x: 200, y: 0 }, D: { x: 100, y: 0 } });
  check("a degenerate diagram is reported invalid", !C.measurements(flat).valid);
  check("parallel lines give NaN from Intersect, as in the applet",
    Number.isNaN(C.intersect({ x: 0, y: 0 }, { x: 100, y: 0 },
                             { x: 0, y: 10 }, { x: 100, y: 10 }).x));
  check("the applet's Intersect agrees on the same parallel lines",
    Number.isNaN(appletIntersect({ x: 0, y: 0 }, { x: 100, y: 0 },
                                 { x: 0, y: 10 }, { x: 100, y: 10 }).x));
  check("pointOnAC puts t=1 at A and t=0 at C", (() => {
    const A = { x: 3, y: 7 }, Cc = { x: 40, y: -2 };
    return closePoint(C.pointOnAC(A, Cc, 1), A, 1e-12) && closePoint(C.pointOnAC(A, Cc, 0), Cc, 1e-12);
  })());
}

done("bqt-lemma");
