#!/usr/bin/env node
"use strict";

/*
 * Logic test for five-circles-in-square/five-circles-in-square-core.js.
 *
 *   node porting/check-five-circles-in-square.mjs
 *
 * The page states four exact claims: the triangle inradius is (a+b-c)/2, the
 * inner-square circle has radius (a-b)/2, the five circles are equal only
 * when c = 2b (so the acute angles are 30 and 60 degrees), and the common
 * radius is c(sqrt(3)-1)/4. All four are tested over many canvas sizes and
 * thousands of positions of E, not just at the answer. A second transcription
 * of the applet's own Compute/Swivel/GetIncircle/GetCircle bytecode is compared
 * with the core over the same range, including the applet's 0.5-pixel
 * Finished test and its three option checkboxes.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("five-circles-in-square/five-circles-in-square-core.js", "FiveCirclesInSquareCore");

const near = (a, b, tol = 1e-8) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const point = (x, y) => ({ x: x, y: y });

/* -------------------------------------------------------------------------- */
/* A second, literal transcription of the applet's bytecode. It deliberately  */
/* uses the applet's own angle-bisector construction, line intersection and   */
/* dragged-point projection instead of the core's side-length formulas.       */
/* -------------------------------------------------------------------------- */

const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const dist = (p, q) => Math.sqrt(sqDist(p, q));

/** GeoSDoub.ComputeAngle: the law of cosines at p. */
function computeAngle(p, q, r) {
  const top = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) / 2;
  return Math.acos(top / (dist(p, q) * dist(p, r)));
}

/** GeoSDoub.FindOrientation: the signed area of p, q, r. */
function orientation(p, q, r) {
  const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return v > 0 ? 1 : -1;
}

/** GeoSDoub.Rotate(p, about, angle, sign). */
function rotate(p, about, angle, sign) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = p.x - about.x, dy = p.y - about.y;
  return point(about.x + cos * dx - sign * sin * dy,
    about.y + sign * sin * dx + cos * dy);
}

/** GeoSDoub.Intersect(a,b,c,d), with the applet's parallel guard. */
function intersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return point(NaN, NaN); // the applet uses |det| >= 1
  return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/** GeoSDoub.NearestPoint: the foot of the perpendicular to line a-b. */
function nearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (sqDist(a, b) < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return point(a.x + dx * t, a.y + dy * t);
}

/** The applet's GetIncircle: bisector intersection, then mean of 3 distances. */
function appletIncircle(a, b, c) {
  const half = orientation(a, b, c);
  const alpha = computeAngle(a, b, c) / 2 * half;
  const beta = computeAngle(b, c, a) / 2 * half;
  const center = intersect(a, rotate(b, a, alpha, 1), b, rotate(c, b, beta, 1));
  const radius = (dist(center, nearest(center, a, b)) +
    dist(center, nearest(center, b, c)) +
    dist(center, nearest(center, c, a))) / 3;
  return { center: center, radius: radius };
}

/** FiveCirclesInSquareCanvas.Swivel(P, theta, sign). */
function swivel(E, A, p, theta, sign) {
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const dx = sign * (E.x - A.x), dy = sign * (E.y - A.y);
  return point(p.x + cos * dx - sin * dy, p.y + sin * dx + cos * dy);
}

/** Compute(), GetCircle() and CheckFinished() in one place. */
function appletGeometry(width, height, angle) {
  const R = Math.min(width, height) / 3.5;
  const cx = width / 2, cy = height / 2;
  const A = point(cx - R, cy + R), B = point(cx + R, cy + R);
  const Cc = point(cx + R, cy - R), D = point(cx - R, cy - R);
  const guide = point(A.x, (A.y + D.y) / 2);
  const E = point(guide.x + R * Math.cos(angle), guide.y + R * Math.sin(angle));
  const F = swivel(E, A, B, Math.PI / 2, -1);
  const G = swivel(E, A, Cc, Math.PI, 1);
  const H = swivel(E, A, D, 3 * Math.PI / 2, -1);
  const triangles = [[A, B, F], [B, Cc, G], [Cc, D, H], [D, A, E]];
  const incircles = triangles.map((t) => appletIncircle(t[0], t[1], t[2]));
  const centralCenter = intersect(E, G, F, H);
  const central = { center: centralCenter, radius: dist(E, F) / 2 };
  const diff = Math.abs(central.radius - incircles[0].radius);
  const finished = Number.isFinite(diff) && diff < C.MATCH; // dcmpg: NaN is false
  return { A: A, B: B, Cc: Cc, D: D, E: E, F: F, G: G, H: H,
    incircles: incircles, central: central, finished: finished };
}

/* ------------------------------------------------------------ 1. the applet */

{
  const s = C.start({});
  equal("the applet's embedded canvas is 400 by 400", [s.width, s.height], [400, 400]);
  check("R is min(width,height)/3.5", near(s.R, 400 / 3.5));
  equal("the square's corners are A bottom-left, B bottom-right, C top-right, D top-left",
    [s.corners.A.x < s.corners.B.x, s.corners.B.y === s.corners.D.y + 2 * s.R,
      s.corners.C.x === s.corners.B.x, s.corners.D.y < s.corners.A.y],
    [true, true, true, true]);
  check("E starts at 36 degrees on the circle with diameter AD",
    near(s.angle, 0.6283185307179586, 1e-12) &&
    near(C.distance(C.pointE(s), point(s.cx - s.R, s.cy)), s.R));
  equal("the three option checkboxes start unchecked",
    [s.showNames, s.showStatement, s.showHint], [false, false, false]);
  check("start is pure data and deterministic", JSON.stringify(s) === JSON.stringify(C.start({})));
}

/* ----------------------------- 2. core against the applet's own construction */

{
  const sizes = [[400, 400], [250, 250], [400, 250], [777, 400], [120, 90]];
  const random = rng(20120117);
  let radiiMatch = true, centersMatch = true, pointsMatch = true, flagsMatch = true;
  let cases = 0;
  for (const [w, h] of sizes) {
    for (let k = 0; k <= 720; k++) {
      const angle = -Math.PI + (2 * Math.PI * k) / 720;
      // The applet's angle-bisector construction becomes numerically unstable
      // as E approaches a corner (the triangle flattens there); those angles
      // are covered by the separate degenerate-case checks below.
      if (Math.abs(Math.abs(angle) - Math.PI / 2) < 0.02 || Math.abs(angle) < 1e-6) continue;
      const s = C.setAngle(C.start({ width: w, height: h }), angle);
      const core = C.geometry(s);
      const applet = appletGeometry(w, h, angle);
      cases++;
      radiiMatch = radiiMatch && core.incircles.every((c, i) =>
        near(c.radius, applet.incircles[i].radius, 1e-7)) &&
        near(core.central.radius, applet.central.radius, 1e-7);
      // On the smallest canvas, near the centre, the applet's Intersect(EG,FH)
      // hits its |det| < 1 guard and returns a NaN centre. The core uses the
      // exact centre there instead; compare centres wherever Java has one.
      const javaCentreIsFinite = Number.isFinite(applet.central.center.x);
      centersMatch = centersMatch && core.incircles.every((c, i) =>
        near(c.center.x, applet.incircles[i].center.x, 1e-6) &&
        near(c.center.y, applet.incircles[i].center.y, 1e-6)) &&
        (!javaCentreIsFinite ||
          (near(core.central.center.x, applet.central.center.x, 1e-4) &&
            near(core.central.center.y, applet.central.center.y, 1e-4)));
      pointsMatch = pointsMatch &&
        near(core.points.E.x, applet.E.x, 1e-9) && near(core.points.E.y, applet.E.y, 1e-9) &&
        near(core.points.F.x, applet.F.x, 1e-9) && near(core.points.F.y, applet.F.y, 1e-9) &&
        near(core.points.G.x, applet.G.x, 1e-9) && near(core.points.G.y, applet.G.y, 1e-9) &&
        near(core.points.H.x, applet.H.x, 1e-9) && near(core.points.H.y, applet.H.y, 1e-9);
      flagsMatch = flagsMatch && C.finished(s) === applet.finished;
    }
    for (let k = 0; k < 300; k++) {
      const angle = C.wrap((random() - 0.5) * 2 * Math.PI);
      if (Math.abs(Math.abs(angle) - Math.PI / 2) < 0.02 || Math.abs(angle) < 1e-3) continue;
      const s = C.setAngle(C.start({ width: w, height: h }), angle);
      const applet = appletGeometry(w, h, angle);
      cases++;
      radiiMatch = radiiMatch && C.geometry(s).incircles.every((c, i) =>
        near(c.radius, applet.incircles[i].radius, 1e-7));
      flagsMatch = flagsMatch && C.finished(s) === applet.finished;
    }
  }
  check(`all five radii match the applet in ${cases} configurations`, radiiMatch);
  check("all five circle centres match the applet", centersMatch);
  check("E, F, G and H match the applet's Swivel calls", pointsMatch);
  check("Finished agrees with CheckFinished everywhere", flagsMatch);
}

/* ---------------------------------- 3. the page's two radius formulas, checked */

{
  const random = rng(4242);
  let triangleFormula = true, squareFormula = true, pythagoras = true;
  let ordered = true, thales = true, cases = 0;
  for (let k = 0; k < 4000; k++) {
    // E on the upper semicircle inside the square: the page assumes a > b.
    const angle = random() * Math.PI / 2;
    const s = C.setAngle(C.start({ width: 100 + 700 * random() }), angle);
    const g = C.geometry(s);
    const a = g.sides.a, b = g.sides.b, c = g.sides.c;
    cases++;
    triangleFormula = triangleFormula && near(g.incircles[0].radius, (a + b - c) / 2);
    squareFormula = squareFormula && near(g.central.radius, (a - b) / 2);
    pythagoras = pythagoras && near(a * a + b * b, c * c, 1e-7);
    ordered = ordered && a >= b;
    // E sees the diameter AD at a right angle.
    const EA = C.distance(g.points.E, g.corners.A);
    const ED = C.distance(g.points.E, g.corners.D);
    thales = thales && near(EA * EA + ED * ED, (2 * s.R) ** 2, 1e-6);
  }
  check(`the triangle inradius (a+b-c)/2 holds in all ${cases} positions`, triangleFormula);
  check("the inner circle radius (a-b)/2 holds on the page's semicircle", squareFormula);
  check("the four corners make right triangles (a^2+b^2=c^2)", pythagoras);
  check("a >= b on the upper semicircle where the page takes a > b", ordered);
  check("E sees the side AD at a right angle (Thales)", thales);
}

/* ------------------------------------- 4. the page's equal-circles conclusion */

{
  let equalFive = true, cEquals2b = true, anglesRight = true, radiusRight = true;
  let mirrored = true, finishedAtAnswer = true, noOthers = true;
  for (const size of [100, 250, 400, 640, 1000]) {
    const s = C.makeEqual(C.start({ width: size, height: size }));
    const g = C.geometry(s);
    const a = g.sides.a, b = g.sides.b, c = g.sides.c;
    const rs = C.radii(s);
    equalFive = equalFive && rs.every((r) => near(r, rs[0]));
    cEquals2b = cEquals2b && near(c, 2 * b);
    anglesRight = anglesRight && near(Math.asin(b / c) * 180 / Math.PI, 30, 1e-9) &&
      near(Math.acos(b / c) * 180 / Math.PI, 60, 1e-9);
    radiusRight = radiusRight && near(rs[0], c * (Math.sqrt(3) - 1) / 4);
    finishedAtAnswer = finishedAtAnswer && C.finished(s);

    const below = C.setAngle(C.start({ width: size }), -C.EQUAL_ANGLE);
    mirrored = mirrored && C.finished(below) && C.radii(below).every((r) => near(r, C.radii(below)[0]));

    // An exact equality of radii can only happen at +/- 30 degrees. Sample
    // finely enough that any other zero would be many pixels wide.
    for (let k = -18000; k <= 18000; k++) {
      const angle = C.wrap((k / 18000) * Math.PI);
      if (Math.abs(Math.abs(angle) - C.EQUAL_ANGLE) < 1e-4) continue;
      const diff = Math.abs(C.geometry(C.setAngle(C.start({ width: size }), angle)).central.radius -
        C.geometry(C.setAngle(C.start({ width: size }), angle)).incircles[0].radius);
      if (diff < 1e-9) noOthers = false;
    }
  }
  check("all five radii are equal at the page's answer, for every size", equalFive);
  check("the answer obeys c = 2b", cEquals2b);
  check("the angles opposite b and a are 30 and 60 degrees", anglesRight);
  check("the common radius is c(sqrt(3)-1)/4", radiusRight);
  check("the mirrored answer below the centre also matches", mirrored);
  check("the applet's Finished flag lights up at the answer", finishedAtAnswer);
  check("no other angle gives exact equality in 36,001 samples per size", noOthers);
}

/* -------------------------- 5. the applet's half-pixel tolerance and dragging */

{
  let windowOk = true, outsideOk = true;
  for (const size of [250, 400, 1000]) {
    let inside = 0, nearAnswer = true;
    for (let k = -1800; k <= 1800; k++) {
      const angle = C.wrap(k / 1800);
      if (C.finished(C.setAngle(C.start({ width: size }), angle))) {
        inside++;
        nearAnswer = nearAnswer && Math.abs(Math.abs(angle) - C.EQUAL_ANGLE) < 0.05;
      }
    }
    // At 400px the applet's 0.5px window is under a degree wide on each side.
    windowOk = windowOk && inside > 0 && inside < 100 && nearAnswer;
    const far = C.setAngle(C.start({ width: size }), 2.4);
    outsideOk = outsideOk && !C.finished(far) &&
      C.geometry(far).central.radius > C.geometry(far).incircles[0].radius;
  }
  check("Finished holds only in a narrow window around the answer", windowOk);
  check("dragging E far around the circle never fakes equality", outsideOk);

  const s = C.start({});
  const clamped = C.clampAngle(s, Math.PI * 0.9);
  const p = C.pointE(C.setAngle(s, clamped));
  check("the drag clamp keeps E on the visible part of the circle",
    p.x > 2 && p.x < s.width && p.y > 0 && p.y < s.height);
  check("the clamp keeps E on its circle",
    near(C.distance(p, point(s.cx - s.R, s.cy)), s.R));
  check("the clamp is symmetric about the horizontal centre line",
    near(C.clampAngle(s, 1.9), -C.clampAngle(s, -1.9)));
  check("the starting angle is inside the visible arc",
    near(C.clampAngle(s, C.INITIAL_ANGLE), C.INITIAL_ANGLE));
}

/* ------------------------------- 6. options, saved position and edge cases */

{
  const s = C.start({});
  const named = C.option(s, "showNames", true);
  const hinted = C.option(named, "showHint", true);
  const stated = C.option(hinted, "showStatement", true);
  equal("the three checkboxes are independent options",
    [s.showNames, named.showNames, hinted.showHint, stated.showStatement],
    [false, true, true, true]);
  check("options leave the geometry alone", JSON.stringify(C.geometry(s)) === JSON.stringify(C.geometry(stated)));
  check("an unknown option is ignored", C.option(s, "nonsense", true) === s);

  const position = C.position(C.makeEqual(s));
  check("the saved position is plain board-unit data for the tutor",
    position.width === 400 && near(position.angle, C.EQUAL_ANGLE) &&
    Object.keys(position.points).join(",") === "E,F,G,H" &&
    position.radii.length === 4 && near(position.innerRadius, position.radii[0]) &&
    position.finished === true);

  const centre = C.setAngle(s, 0);
  check("E at the square's centre collapses the inner square, not the outer one",
    near(C.geometry(centre).central.radius, 0) && near(C.geometry(centre).sides.c, 2 * s.R));
  const top = C.setAngle(s, Math.PI / 2);
  check("E at a corner is a degenerate triangle and is not 'finished'",
    !C.finished(top) && C.radii(top).length === 5);
  check("setAngle never mutates its input", s.angle === C.INITIAL_ANGLE);
  const wrapped = C.setAngle(s, 2 * Math.PI + C.EQUAL_ANGLE);
  check("angles are wrapped to a single turn", near(wrapped.angle, C.EQUAL_ANGLE));
}

done("five-circles-in-square");
