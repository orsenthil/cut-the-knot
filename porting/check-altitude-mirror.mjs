#!/usr/bin/env node
"use strict";

/*
 * Logic test for altitude-mirror/altitude-mirror-core.js.
 *
 *   node porting/check-altitude-mirror.mjs
 *
 * Checks the opening figure, exact rational triangles, a grid of 9 x 8 exact
 * triangles, and thousands of random acute and obtuse triangles. For each it
 * tests the page's claims: angle BHE = angle CHD, AH bisects angle DHE, the
 * reflection of the lines through H, AF = AG, Haruki's two length formulas and
 * Ceva's product. It also writes the applet's own Compute() a second time,
 * straight from the bytecode (GetParallelTo, Intersect, NearestPoint), and
 * compares every constructed point with the core.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("altitude-mirror/altitude-mirror-core.js", "AltitudeMirrorCore");
const TOL = 1e-8; // radians / board units
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const closePoint = (a, b, tol = TOL) => !!a && !!b && Number.isFinite(a.x) &&
  Number.isFinite(b.x) && C.dist(a, b) <= tol;

const state = (A, B, Cp, P) => ({ A, B, C: Cp, P, showNames: true, showStatement: false, showHint: false });

/* ------------------------------------------------- 1. the opening figure */

{
  const s = C.start();
  equal("the opening vertices follow the applet's fractions of the canvas",
    [s.A, s.B, s.C, s.P],
    [{ x: 150, y: 80 }, { x: 90, y: 200 }, { x: 270, y: 200 }, { x: 150, y: 160 }]);
  check("the opening boxes match the applet: names on, statement and hint off",
    s.showNames && !s.showStatement && !s.showHint);
  const f = C.compute(s);
  check("the opening foot H is on BC, below A", closePoint(f.H, { x: 150, y: 200 }));
  check("the opening P is on the altitude", near(C.lineAngle(f.A, f.P, f.H), 0));
  check("the opening figure has H between B and C", C.hBetween(f));
  const e = C.errors(f);
  check("the opening figure has angle BHE = angle CHD", e.ray < TOL, `error ${e.ray}`);
  check("the opening figure has AH bisecting DHE", e.bisector < TOL, `error ${e.bisector}`);
  check("the opening figure has AF = AG", e.afag < TOL, `error ${e.afag}`);
}

/* -------------------------------------- 2. exact triangles, by hand */

{
  // B=(0,0), C=(4,0), A=(1,2), P halfway down the altitude AH=(1,0).
  // By hand: E=(4/7,8/7), D=(8/5,8/5), F=(1/4,2), G=(7/4,2).
  const f = C.compute(state({ x: 1, y: 2 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 1 }));
  check("an exact triangle gives E = CP meet AB", closePoint(f.E, { x: 4 / 7, y: 8 / 7 }));
  check("an exact triangle gives D = BP meet AC", closePoint(f.D, { x: 8 / 5, y: 8 / 5 }));
  check("an exact triangle gives F on the parallel through A", closePoint(f.F, { x: 1 / 4, y: 2 }));
  check("an exact triangle gives G on the parallel through A", closePoint(f.G, { x: 7 / 4, y: 2 }));
  check("an exact triangle gives AF = AG", near(C.dist(f.A, f.F), C.dist(f.A, f.G)) &&
    near(C.dist(f.A, f.F), 3 / 4));
  const e = C.errors(f);
  check("an exact triangle has the two equal angles", e.ray < TOL && e.bisector < TOL);
}

/* ------------------------------- 3. a whole grid of exact triangles */

{
  let worstRay = 0, worstBis = 0, worstParallel = 0, worstCeva = 0, cases = 0;
  for (let a = 1; a <= 9; a++) for (let h = 1; h <= 8; h++) {
    const A = { x: a, y: -h }, B = { x: 0, y: 0 }, Cp = { x: 10, y: 0 };
    for (let k = 1; k <= 9; k++) {
      const H = C.foot(A, B, Cp);
      const P = { x: A.x + (H.x - A.x) * k / 10, y: A.y + (H.y - A.y) * k / 10 };
      const f = C.compute(state(A, B, Cp, P));
      const e = C.errors(f);
      if (!e) continue;
      cases++;
      worstRay = Math.max(worstRay, e.ray);
      worstBis = Math.max(worstBis, e.bisector);
      worstParallel = Math.max(worstParallel, e.afag);
      const ceva = (C.dist(f.A, f.E) / C.dist(f.B, f.E)) *
        (C.dist(f.B, f.H) / C.dist(f.C, f.H)) *
        (C.dist(f.C, f.D) / C.dist(f.A, f.D));
      worstCeva = Math.max(worstCeva, Math.abs(ceva - 1));
    }
  }
  check("648 exact triangles: H is between B and C", cases === 648);
  check(`648 exact triangles: angle BHE = angle CHD (max ${worstRay})`, worstRay < TOL);
  check(`648 exact triangles: AH bisects DHE (max ${worstBis})`, worstBis < TOL);
  check(`648 exact triangles: AF = AG (max ${worstParallel})`, worstParallel < TOL);
  check(`648 exact triangles: Ceva's product is 1 (max ${worstCeva})`, worstCeva < TOL);
}

/* --------------------------------- 4. thousands of random acute triangles */

{
  const rnd = rng(20260226);
  let worstRay = 0, worstBis = 0, worstAf = 0, worstF1 = 0, worstF2 = 0, n = 0;
  for (let i = 0; i < 4000; i++) {
    const A = { x: 60 + rnd() * 240, y: -40 - rnd() * 160 };
    const B = { x: -20 + rnd() * 40, y: 0 }, Cp = { x: 340 + rnd() * 40, y: 0 };
    const H = C.foot(A, B, Cp);
    const t = rnd(); // P anywhere on the segment AH
    const P = { x: A.x + (H.x - A.x) * t, y: A.y + (H.y - A.y) * t };
    const f = C.compute(state(A, B, Cp, P));
    const e = C.errors(f);
    if (!e || !C.hBetween(f)) continue;
    n++;
    worstRay = Math.max(worstRay, e.ray);
    worstBis = Math.max(worstBis, e.bisector);
    worstAf = Math.max(worstAf, e.afag);
    worstF1 = Math.max(worstF1, e.afFormula);
    worstF2 = Math.max(worstF2, e.agFormula);
  }
  check("4000 random acute triangles were used", n === 4000);
  check(`random acute: angle BHE = angle CHD (max ${worstRay})`, worstRay < 1e-7);
  check(`random acute: AH bisects DHE (max ${worstBis})`, worstBis < 1e-7);
  check(`random acute: AF = AG (max ${worstAf})`, worstAf < 1e-7);
  check(`random acute: AF = AE*BH/BE (max ${worstF1})`, worstF1 < 1e-7);
  check(`random acute: AG = AD*CH/CD (max ${worstF2})`, worstF2 < 1e-7);
}

/* ------------------------- 5. obtuse triangles: what does survive */

{
  const rnd = rng(4711);
  let worstLines = 0, worstAf = 0, rayFailures = 0, n = 0;
  for (let i = 0; i < 4000; i++) {
    // Push A outside the vertical strip above BC so B or C is obtuse and H
    // falls outside the segment, which the page's claim excludes.
    const A = { x: rnd() < 0.5 ? -40 + rnd() * 39 : 361 + rnd() * 39, y: -40 - rnd() * 120 };
    const B = { x: 0, y: 0 }, Cp = { x: 360, y: 0 };
    const H = C.foot(A, B, Cp);
    const t = 0.1 + rnd() * 0.8;
    const P = { x: A.x + (H.x - A.x) * t, y: A.y + (H.y - A.y) * t };
    const f = C.compute(state(A, B, Cp, P));
    const e = C.errors(f);
    if (!e || C.hBetween(f)) continue;
    n++;
    worstLines = Math.max(worstLines, e.lines);
    worstAf = Math.max(worstAf, e.afag);
    if (e.ray > 1e-6) rayFailures++;
  }
  check("4000 random obtuse triangles were used", n === 4000);
  check(`obtuse: the reflected lines still match (max ${worstLines})`, worstLines < 1e-7);
  check(`obtuse: AF = AG still holds (max ${worstAf})`, worstAf < 1e-7);
  check(`obtuse: the page's ray equality really can fail (${rayFailures} cases)`, rayFailures > 0);
}

/* -------------------------- 6. the orthic triangle and the altitudes */

{
  const rnd = rng(818);
  let worstD = 0, worstE = 0, worstBis = 0, n = 0;
  for (let i = 0; i < 2000; i++) {
    const s = state({ x: 60 + rnd() * 240, y: -30 - rnd() * 150 },
      { x: 0, y: 0 }, { x: 360, y: 0 }, { x: 180, y: -80 });
    const o = C.orthocenter(s);
    const tri = C.orthic(s);
    const f = C.compute(Object.assign({}, s, { P: o }));
    worstD = Math.max(worstD, C.dist(f.D, tri.D));
    worstE = Math.max(worstE, C.dist(f.E, tri.E));
    const e = C.errors(f);
    if (e && C.hBetween(f)) { worstBis = Math.max(worstBis, e.bisector); n++; }
  }
  check(`P at the orthocenter makes D the foot of the B-altitude (max ${worstD})`, worstD < 1e-6);
  check(`P at the orthocenter makes E the foot of the C-altitude (max ${worstE})`, worstE < 1e-6);
  check(`the orthic triangle keeps AH as a bisector (max ${worstBis})`, n > 100 && worstBis < 1e-7);
  const s = C.start();
  check("the B-altitude is perpendicular to AC", near(C.dot(C.sub(C.altitudeFootFromB(s), s.B), C.sub(s.C, s.A)), 0));
  check("the C-altitude is perpendicular to AB", near(C.dot(C.sub(C.altitudeFootFromC(s), s.C), C.sub(s.B, s.A)), 0));
}

/* ------------------ 7. a second, literal transcription of the applet */

/*
 * GeoSDoub.Intersect(p,q,r,s) from classes.zip: line coefficients
 * a = y_p-y_q, b = x_q-x_p, c = x_p*y_p-y_p*x_q, and likewise for r,s;
 * the answer is ((b*c')-(b'*c))/((a*b')-(a'*b)), or NaN if parallel.
 * GeoSDoub.GetParallelTo adds 100*(B-C) to A; NearestPoint projects onto BC.
 */
function appletIntersect(p, q, r, s) {
  const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const den = a * b2 - a2 * b;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b * c2 - b2 * c) / den, y: (c * a2 - c2 * a) / den };
}
function appletNearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * dx + dy * dy < 0.1) return { x: p.x, y: p.y };
  const t = ((b.x - a.x) * (p.x - a.x) + (b.y - a.y) * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
function appletCompute(s) {
  const H = appletNearestPoint(s.A, s.B, s.C);
  const Q = { x: s.A.x + 100 * (s.B.x - s.C.x), y: s.A.y + 100 * (s.B.y - s.C.y) };
  const E = appletIntersect(s.A, s.B, s.C, s.P);
  const D = appletIntersect(s.A, s.C, s.B, s.P);
  const F = appletIntersect(s.A, Q, H, E);
  const G = appletIntersect(s.A, Q, H, D);
  return { H, Q, E, D, F, G };
}

{
  const rnd = rng(123456);
  let worst = 0, n = 0, parallel = 0;
  for (let i = 0; i < 3000; i++) {
    const A = { x: rnd() * 360, y: rnd() * 150 };
    const B = { x: rnd() * 360, y: 150 + rnd() * 90 };
    const Cp = { x: rnd() * 360, y: 150 + rnd() * 90 };
    const H = C.foot(A, B, Cp);
    const t = -0.4 + rnd() * 1.8;
    const P = { x: A.x + (H.x - A.x) * t, y: A.y + (H.y - A.y) * t };
    const f = C.compute(state(A, B, Cp, P));
    const a = appletCompute(state(A, B, Cp, P));
    for (const name of ["H", "Q", "E", "D", "F", "G"]) {
      if (!Number.isFinite(a[name].x)) { parallel++; continue; }
      worst = Math.max(worst, C.dist(f[name], a[name]));
      n++;
    }
  }
  check("the applet's construction produced 18000 comparable points", n === 18000);
  // The applet's determinant form of Intersect cancels badly on almost
  // parallel lines; a few of the 3000 random drawings lose a decimal place.
  check(`the core matches the applet's GetParallelTo, Intersect and Compute (max ${worst})`, worst < 1e-4);
  check(`only degenerate lines were skipped (${parallel})`, parallel < 50);
}

/* -------------------------------- 8. dragging and the three checkboxes */

{
  const s = C.start();
  const moved = C.move(s, "B", { x: 40, y: 220 });
  check("dragging B leaves A and C alone", C.dist(moved.A, s.A) === 0 && C.dist(moved.C, s.C) === 0);
  check("dragging B moves B", closePoint(moved.B, { x: 40, y: 220 }));
  const movedP = C.move(s, "P", { x: 200, y: 60 });
  check("dragging P glides it onto AH", near(C.lineAngle(movedP.A, movedP.P, C.foot(movedP.A, movedP.B, movedP.C)), 0));
  const movedA = C.move(s, "A", { x: 210, y: 60 });
  check("dragging A keeps P on the new altitude", near(C.lineAngle(movedA.A, movedA.P, C.foot(movedA.A, movedA.B, movedA.C)), 0));
  const out = C.move(s, "A", { x: 1000, y: -1000 });
  check("vertices are clamped inside the board", out.A.x <= C.WIDTH - 14 && out.A.y >= 14);
  check("move returns the same position for an unknown point", C.move(s, "Z", { x: 1, y: 1 }) === s);
  const o = C.option(C.option(s, "showNames", false), "showHint", true);
  check("the three checkboxes are independent", !o.showNames && o.showHint && !o.showStatement);
  check("the status line reports the two angles", /Angle BHE = .*angle CHD = /.test(C.describe(C.compute(s))));
}

done("altitude-mirror");
