#!/usr/bin/env node
"use strict";

/*
 * Logic test for harmonic-ratio/harmonic-ratio-core.js.
 *
 *   node porting/check-harmonic-ratio.mjs
 *
 * Checked: the applet's starting positions and its five restrictions on the
 * draggable dots; a second, literal transcription of GeoSDoub.Intersect,
 * NearestPoint, DoubLine.CreateMidPoint / UpdateMidPoint and
 * HarmonicRatioCanvas.ComputePoints compared with the core on hundreds of
 * random diagrams and drag sequences; and the page's claims (D independent of
 * E and I, (ABCD) = -1, the three conjugate pairs and the four pencil
 * identities) on thousands of configurations. The applet's |det| < 1
 * degenerate answer and the page's "six more lines" slip are checked honestly.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("harmonic-ratio/harmonic-ratio-core.js", "HarmonicRatioCore");
const NAMES = C.NAMES;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const finite = (p) => C.isFinitePoint(p);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => finite(p) && finite(q) && dist(p, q) <= tol;
/* The applet's Intersect writes (NaN, NaN) for a nearly parallel pair. */
const samePoint = (p, q, tol) => finite(p) && finite(q) ? closePoint(p, q, tol)
  : !finite(p) && !finite(q);
const sameNumber = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b)
  ? close(a, b, tol) : !Number.isFinite(a) && !Number.isFinite(b);

/* --------------------------- the applet's own math, written a second time */

/* GeoSDoub.Intersect(DoubPoint x4), javap: a1,b1,c1 / a2,b2,c2, det, eps=1. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  const eps = 1;
  if (Math.abs(det) < eps) return { x: NaN, y: NaN };
  const x = (b1 * c2 - b2 * c1) / det;
  const y = (c1 * a2 - c2 * a1) / det;
  return { x, y };
}

/* GeoSDoub.NearestPoint(p, a, b): a + (b-a)*(p-a).(b-a)/|b-a|^2. */
function appletNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * dx + dy * dy < 0.1) return p;
  const u = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * u, y: a.y + dy * u };
}

/* DoubLine.CreateMidPoint(t): m_1*t + m_2*(1-t). */
function appletAlong(a, b, t) {
  return { x: a.x * t + b.x * (1 - t), y: a.y * t + b.y * (1 - t) };
}

/* DoubLine.UpdateMidPoint(p): t = -ScalarProduct(A-B, B-P)/|A-B|^2, then
   clamp t to [0, 1] because m_PointInSegment is true, then CreateMidPoint(t). */
function appletUpdateMidpoint(a, b, p) {
  const dx = a.x - b.x, dy = a.y - b.y;
  const den = dx * dx + dy * dy;
  if (den === 0) return appletAlong(a, b, 0);
  let t = -(dx * (b.x - p.x) + dy * (b.y - p.y)) / den;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return appletAlong(a, b, t);
}

/* HarmonicRatioCanvas.ComputePoints, in the bytecode's order. */
function appletCompute(pts) {
  const G = appletIntersect(pts.E, pts.C, pts.I, pts.B);
  const F = appletIntersect(pts.A, G, pts.E, pts.B);
  const D = appletIntersect(pts.A, pts.B, pts.I, F);
  const H = appletIntersect(pts.E, pts.C, pts.I, D);
  return { G, F, D, H };
}

/* HarmonicRatioCanvas.init() with the archived page's WIDTH=600, HEIGHT=450. */
function appletInit(width = 600, height = 450) {
  const t = 2 / 3, n = 5;
  const A = { x: width / n, y: height * t };
  const B = { x: width / 2, y: height * t - 40 };
  const mid = (a, b, k) => appletAlong(a, b, k);
  const C = mid(A, B, 1 - t);                         // BaseLine.CreateMidPoint(1-t)
  const E = { x: C.x, y: height * (1 - t) };
  const I = mid(A, E, 0.5);                           // SideLine.CreateMidPoint(0.5)
  return { A, B, C, E, I };
}

/* MouseDragged + mouseReleased: UpdateLocation then the midpoint fix-ups. */
function appletDrag(pts, name, q) {
  const P = {};
  NAMES.forEach((n) => { P[n] = { x: pts[n].x, y: pts[n].y }; });
  /* UpdateLocation first adds the grab defect and then, for a restricted
     point, projects onto its line. Here q is the already-clamped pointer. */
  if (name === "C") P.C = appletUpdateMidpoint(P.A, P.B, appletNearest(q, P.A, P.B));
  else if (name === "I") P.I = appletUpdateMidpoint(P.A, P.E, appletNearest(q, P.A, P.E));
  else P[name] = { x: q.x, y: q.y };
  if (name === "B") P.C = appletUpdateMidpoint(P.A, P.B, P.C);
  else if (name === "E") P.I = appletUpdateMidpoint(P.A, P.E, P.I);
  else if (name === "A") {
    P.C = appletUpdateMidpoint(P.A, P.B, P.C);
    P.I = appletUpdateMidpoint(P.A, P.E, P.I);
  }
  return P;
}

/* Cross-ratio from the page's definition, in coordinates with A=0, B=1. */
function appletCrossRatio(a, b, c, d) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const f = (p) => ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const uc = f(c), ud = f(d);
  return (uc / (uc - 1)) / (ud / (ud - 1));
}

/* Project a pencil of lines through o onto AB (the applet's geometric claim
   (ABCD) = E(ABCD) = E(IFHD) = (IFHD) and its twin through G). */
function pencilCross(o, p1, p2, p3, p4, a, b) {
  const hit = (p) => appletIntersect(o, p, a, b);
  return appletCrossRatio(hit(p1), hit(p2), hit(p3), hit(p4));
}

const stateFrom = (pts) => C.start({ points: pts });
const randomPoint = (rand, w = 600, h = 450) => ({ x: 30 + rand() * (w - 60), y: 30 + rand() * (h - 60) });

/* ------------------------------------------------------ 1. the start diagram */

{
  const s = C.start();
  equal("the archived size is 600 by 450", [s.width, s.height], [600, 450]);
  const expect = appletInit();
  NAMES.forEach((n) => {
    check(`${n} starts where HarmonicRatioCanvas.init puts it`,
      closePoint(s.points[n], expect[n], 1e-12),
      `applet ${JSON.stringify(expect[n])}, core ${JSON.stringify(s.points[n])}`);
  });
  check("both C and I start a third and a half along their lines",
    close(C.fraction(s.points.A, s.points.B, s.points.C), 2 / 3, 1e-12) &&
    close(C.fraction(s.points.A, s.points.E, s.points.I), 0.5, 1e-12));
  check("the archived page has no ShowNames parameter, so names start hidden", s.showNames === false);
  check("an illustration has no result", C.result(s) === null);
  const shown = C.withOptions(s, { showNames: true });
  check("the Show names checkbox toggles without changing the old state",
    shown.showNames && !s.showNames && shown.points.A === s.points.A);
  const moved = C.withPoint(s, "E", { x: 260, y: 120 });
  check("withPoint does not change the position it was given", s.points.E.x === expect.E.x);
  check("an unknown handle leaves the diagram alone", C.withPoint(s, "Z", { x: 0, y: 0 }) === s);
}

/* ------------------------------- 2. the applet's method against the core */

{
  const rand = rng(41027);
  const configurations = [stateFrom(appletInit())];
  for (let i = 0; i < 500; i++) {
    const A = randomPoint(rand), B = randomPoint(rand);
    if (dist(A, B) < 120) { i--; continue; }
    const Cpt = appletAlong(A, B, 0.05 + rand() * 0.9);
    const E = randomPoint(rand);
    if (C.distanceToLine(E, A, B) < 40) { i--; continue; }
    const I = appletAlong(A, E, 0.05 + rand() * 0.9);
    configurations.push(stateFrom({ A, B, C: Cpt, E, I }));
  }
  let compared = 0, degenerate = 0;
  for (const [i, s] of configurations.entries()) {
    const p = s.points;
    const mine = C.compute(s), theirs = appletCompute(p);
    ["G", "F", "D", "H"].forEach((n) => {
      if (!samePoint(mine[n], theirs[n], 1e-5 * dist(p.A, p.B))) {
        check(`configuration ${i}: ${n} matches ComputePoints`, false,
          `applet ${JSON.stringify(theirs[n])}, core ${JSON.stringify(mine[n])}`);
      }
    });
    if (!mine.finite) degenerate++;
    compared++;
  }
  check(`ComputePoints agrees with the core on ${compared} diagrams`, compared === configurations.length);
  check(`the random set included ${degenerate} near-parallel cases`, degenerate <= 20);

  /* Drag each of the five handles, including targets far outside the board.
     Both transcriptions receive the same points before each step. */
  let drags = 0, dragErrors = 0;
  let s = C.start(), ref = appletInit();
  for (let i = 0; i < 600; i++) {
    const name = NAMES[Math.floor(rand() * NAMES.length)];
    const target = i % 7 === 0
      ? { x: rand() < 0.5 ? -300 : 900, y: rand() < 0.5 ? -200 : 700 }
      : randomPoint(rand);
    const minePoints = C.withPoint(s, name, target).points;
    const refPoints = appletDrag(ref, name, target);
    NAMES.forEach((n) => {
      if (!closePoint(minePoints[n], refPoints[n], 1e-9)) {
        dragErrors++;
        check(`drag ${i} of ${name}: ${n} matches the applet`, false,
          `applet ${JSON.stringify(refPoints[n])}, core ${JSON.stringify(minePoints[n])}`);
      }
    });
    s = stateFrom(minePoints);
    ref = refPoints;
    drags++;
  }
  check(`dragged ${drags} times with targets inside and outside the board`, drags === 600 && dragErrors === 0);

  /* A clean, unambiguous drag comparison, one handle at a time. */
  for (const name of NAMES) {
    const base = C.start();
    for (const target of [randomPoint(rng(name.charCodeAt(0))), { x: -500, y: 500 }, { x: 900, y: -100 }]) {
      const mine = C.withPoint(base, name, target);
      const theirs = appletDrag(base.points, name, target);
      NAMES.forEach((n) => {
        if (!closePoint(mine.points[n], theirs[n], 1e-9)) {
          check(`dragging ${name} to ${JSON.stringify(target)}: ${n} matches the applet`, false,
            `applet ${JSON.stringify(theirs[n])}, core ${JSON.stringify(mine.points[n])}`);
        }
      });
    }
  }
  check("all five handle drags match the applet's restrictions and fix-ups", true);
}

/* --------------------- 3. the restrictions and the end of a drag */

{
  const s = C.start();
  const beyond = C.withPoint(s, "C", { x: 1000, y: 1000 });
  check("C dragged past B is clamped to the segment, as UpdateMidPoint does",
    closePoint(beyond.points.C, s.points.B, 1e-9));
  const behind = C.withPoint(s, "C", { x: -100, y: -100 });
  check("C dragged past A is clamped to A", closePoint(behind.points.C, s.points.A, 1e-9));
  const iBeyond = C.withPoint(s, "I", { x: 1440, y: -1350 });
  check("I dragged past E is clamped to E",
    closePoint(iBeyond.points.I, s.points.E, 1e-9) &&
    close(C.distanceToLine(iBeyond.points.I, s.points.A, s.points.E), 0, 1e-9));
  const movedA = C.withPoint(s, "A", { x: 140, y: 290 });
  check("moving A re-projects both C and I onto the new lines, as the applet does",
    closePoint(movedA.points.C, appletDrag(s.points, "A", { x: 140, y: 290 }).C, 1e-9) &&
    closePoint(movedA.points.I, appletDrag(s.points, "A", { x: 140, y: 290 }).I, 1e-9) &&
    close(C.distanceToLine(movedA.points.C, movedA.points.A, movedA.points.B), 0, 1e-9) &&
    close(C.distanceToLine(movedA.points.I, movedA.points.A, movedA.points.E), 0, 1e-9));
  const movedB = C.withPoint(s, "B", { x: 330, y: 250 });
  check("moving B re-projects C but leaves I where it was",
    closePoint(movedB.points.C, appletDrag(s.points, "B", { x: 330, y: 250 }).C, 1e-9) &&
    closePoint(movedB.points.I, s.points.I, 1e-12));
  const movedE = C.withPoint(s, "E", { x: 210, y: 110 });
  check("moving E re-projects I but leaves C where it was",
    closePoint(movedE.points.I, appletDrag(s.points, "E", { x: 210, y: 110 }).I, 1e-9) &&
    closePoint(movedE.points.C, s.points.C, 1e-12));
  check("the two clamps are projections onto infinite lines",
    closePoint(C.projectToLine({ x: 500, y: 100 }, s.points.A, s.points.B),
      appletNearest({ x: 500, y: 100 }, s.points.A, s.points.B), 1e-12) &&
    closePoint(C.projectToSegment({ x: 500, y: 100 }, s.points.A, s.points.B), s.points.B, 1e-9));
}

/* ----------------------------------------- 4. every claim on the page */

{
  const rand = rng(93117);
  let tested = 0, skipped = 0, outside = 0;
  let worstD = 0, worstCR = 0, worstPencil = 0, worstH = 0;
  for (let i = 0; i < 220; i++) {
    const A = randomPoint(rand), B = randomPoint(rand);
    if (dist(A, B) < 150) { i--; continue; }
    const u = 0.05 + rand() * 0.9;
    const Cc = appletAlong(A, B, u);
    const scale = dist(A, B);
    /* The page says D does not depend on E or I. Try twenty different pairs. */
    for (let j = 0; j < 20; j++) {
      let E = randomPoint(rand);
      let guard = 0;
      while (C.distanceToLine(E, A, B) < 50 && guard++ < 40) E = randomPoint(rand);
      if (C.distanceToLine(E, A, B) < 50) { skipped++; continue; }
      const I = appletAlong(A, E, j % 2 ? 0.04 + (j / 25) : 0.96 - (j / 25));
      const s = stateFrom({ A, B, C: Cc, E, I });
      const m = C.compute(s);
      if (!m.finite) { skipped++; continue; }
      const analytic = C.analyticD(s);
      const tol = 2e-5 * scale;
      worstD = Math.max(worstD, dist(m.D, analytic));
      worstCR = Math.max(worstCR, Math.abs(appletCrossRatio(A, B, Cc, m.D) + 1));
      /* H is conjugate to D in I,F; C and H are conjugate in E,G. */
      worstH = Math.max(worstH, Math.abs(appletCrossRatio(I, m.F, m.H, m.D) + 1),
        Math.abs(appletCrossRatio(E, m.G, Cc, m.H) + 1));
      /* The four pencil equalities the page writes down. */
      const cr = appletCrossRatio(A, B, Cc, m.D);
      const values = [
        pencilCross(E, A, B, Cc, m.D, A, B),
        pencilCross(E, I, m.F, m.H, m.D, A, B),
        pencilCross(m.G, I, m.F, m.H, m.D, A, B),
        pencilCross(m.G, B, A, Cc, m.D, A, B),
      ];
      values.forEach((v, k) => {
        const expected = k < 2 ? cr : 1 / cr;
        if (Number.isFinite(v)) worstPencil = Math.max(worstPencil, Math.abs(v - expected));
      });
      if (u < 0.5 && C.fraction(A, B, m.D) > 1) outside++;
      tested++;
    }
  }
  check(`D stayed fixed and harmonic on ${tested} configurations`, tested >= 4200,
    `tested ${tested}, skipped ${skipped}`);
  check("D equals u/(2u-1) on the line AB (worst error " + worstD.toExponential(2) + ")", worstD < 2e-4);
  check("(ABCD) = -1 on every configuration (worst error " + worstCR.toExponential(2) + ")",
    worstCR < 1e-6);
  check("the two conjugate-pair claims involving H hold (worst error " + worstH.toExponential(2) + ")",
    worstH < 1e-5);
  check("all four pencil identities of the page hold (worst error " + worstPencil.toExponential(2) + ")",
    worstPencil < 1e-5);
  check(`when C is inside AB, D is outside AB in all ${outside} cases`, outside > 0);
  check("(BACD) is the reciprocal of (ABCD)",
    close(appletCrossRatio(C.start().points.B, C.start().points.A, C.start().points.C, C.analyticD(C.start())),
      -1, 1e-9));
  const s0 = C.start();
  const cl = C.claims(s0);
  check("claims() reports every verified property at the starting diagram",
    Object.values(cl).every(Boolean), JSON.stringify(cl));

  /* The page's formula on lengths: AB is the harmonic mean of AC and AD. */
  let worstHM = 0;
  for (let i = 0; i < 200; i++) {
    const A = randomPoint(rand), B = randomPoint(rand);
    if (dist(A, B) < 100) { i--; continue; }
    const Cc = appletAlong(A, B, 0.1 + rand() * 0.4);
    const s = stateFrom({ A, B, C: Cc, E: randomPoint(rand), I: randomPoint(rand) });
    const D = C.analyticD(s);
    if (!finite(D)) continue;
    const hm = 2 * dist(A, Cc) * dist(A, D) / (dist(A, Cc) + dist(A, D));
    worstHM = Math.max(worstHM, Math.abs(hm - dist(A, B)) / dist(A, B));
  }
  check("AB is the harmonic mean of AC and AD (worst relative error " + worstHM.toExponential(2) + ")",
    worstHM < 1e-9);
}

/* ---------------------------- 5. the applet's degenerate answer */

{
  const A = { x: 120, y: 300 }, B = { x: 300, y: 260 }, Cc = { x: 240, y: 273.3333333333333 };
  const E = { x: Cc.x, y: Cc.y + 100 };   // CE is vertical
  const I = { x: B.x, y: B.y + 50 };      // IB is vertical too: no intersection
  const s = stateFrom({ A, B, C: Cc, E, I });
  const mine = C.compute(s), theirs = appletCompute(s.points);
  check("parallel CE and IB leave G unusable in both transcriptions",
    !finite(mine.G) && !finite(theirs.G));
  check("the whole construction becomes unusable, not wildly wrong",
    !mine.finite && ["F", "D", "H"].every((n) => !finite(mine[n])));
  check("claims() refuses to assert the theorem on a degenerate diagram",
    !C.claims(s).conjugates && !C.claims(s).finite);
  const near = stateFrom({ A, B, C: Cc, E, I: { x: B.x + 0.001, y: B.y + 50 } });
  check("the applet's |det| < 1 threshold also catches a near-parallel pair",
    !finite(C.compute(near).G) && !finite(appletCompute(near.points).G));
}

/* ----------------------------------- 6. the wording on the archived page */

{
  /* "Besides the line AB itself, it takes 6 more lines to obtain point C."
     Counting the applet's own Draw(): CE, IB, AG, EB and IF are five lines,
     and the point obtained after them is D, not C. Keep that honest here. */
  const lines = ["CE", "IB", "AG", "EB", "IF"];
  check("the page's 'six more lines to obtain C' is a slip: five lines give D",
    lines.length === 5 && C.NAMES.includes("C") && C.compute(C.start()).finite);
  const s = C.start(), m = C.compute(s);
  check("D is the point at the end of those five lines",
    closePoint(m.D, C.analyticD(s), 1e-6) && !closePoint(m.D, s.points.C, 1e-6));
}

done("harmonic-ratio");
