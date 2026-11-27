#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-incircles-in-triangle/four-incircles-in-triangle-core.js.
 *
 *   node porting/check-four-incircles-in-triangle.mjs
 *
 * The page with the proof (cut-the-knot.org/triangle/FourIncirclesInTriangle.shtml)
 * answers the sangaku with l = x*(sqrt(21)-3)/4. The applet's own page
 * (cut-the-knot.org/Curriculum/Geometry/FourIncirclesInTriangle.shtml, which
 * does embed the Java applet) prints l = x*sqrt(3)/(3+sqrt(21)); that printed
 * formula is wrong by a factor of sqrt(3), while Zettler's proof further down
 * the same page gives the right (sqrt(21)-3)/4. Both are tested here against
 * the construction, at every board size and hundreds of positions, together
 * with a second, independent transcription of the applet's own Compute(),
 * Swivel(), Stretch(), GetParaLine() and GetIncircle().
 *
 * The live proof page no longer embeds the applet (an archived 2012 copy on
 * Wayback does not either), so the applet was read from the live Curriculum
 * page and verified there: <APPLET CODE="FourIncirclesInTriangle" ...>.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("four-incircles-in-triangle/four-incircles-in-triangle-core.js", "FourIncirclesInTriangleCore");
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const EPS = 1e-7;
const SIZES = [[400, 250], [500, 500], [300, 200], [640, 400], [250, 250]];
const ANGLES = [];
// The two ends of the arc are the degenerate cases where the applet divides
// by zero; every other position on it is included.
for (let i = 1; i < 480; i++) ANGLES.push(Math.PI / 6 + (i * Math.PI * 2 / 3) / 480);

/* ---------------------------------------------------------------------------
 * A second transcription, following the bytecode's own order of operations.
 * Vectors are written as [x, y] here; the rotate and intersect routines use a
 * different algebraic form from the core's, so a shared typo cannot hide.
 */

const minus = (a, b) => [a[0] - b[0], a[1] - b[1]];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, k) => [a[0] * k, a[1] * k];
const pt = (a) => ({ x: a[0], y: a[1] });
const norm = (a) => Math.hypot(a[0], a[1]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

/** GeoSDoub.ComputeAngle(a,b,c) in the bytecode: angle at the first point. */
function cornerAngle(a, b, c) {
  const ab = minus(b, a), ac = minus(c, a), bc = minus(c, b);
  const cos = (dot(ab, ab) + dot(ac, ac) - dot(bc, bc)) / (2 * norm(ab) * norm(ac));
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

/** GeoSDoub.FindOrientation, straight from its cross-expression. */
function winding(a, b, c) {
  const value = a[0] * b[1] - b[0] * a[1] + b[0] * c[1] - c[0] * b[1] +
    c[0] * a[1] - a[0] * c[1];
  return value > 0 ? 1 : -1;
}

/** GeoSDoub.Rotate: matrix form, with orientation multiplying the sine. */
function turned(origin, target, theta, sign) {
  const d = minus(target, origin);
  const co = Math.cos(theta), si = Math.sin(theta) * sign;
  return plus(origin, [co * d[0] - si * d[1], si * d[0] + co * d[1]]);
}

/** GeoSDoub.Intersect, written with 2-D cross products. */
function meet(a, b, c, d) {
  const u = minus(b, a), v = minus(d, c);
  const det = cross(u, v);
  if (Math.abs(det) < 1e-12) return [NaN, NaN];
  const t = cross(minus(c, a), v) / det;
  return plus(a, scale(u, t));
}

/** GeoSDoub.NearestPoint: project p onto the infinite line through a and b. */
function foot(p, a, b) {
  const d = minus(b, a);
  return plus(a, scale(d, dot(minus(p, a), d) / dot(d, d)));
}

/** GeoSDoub.FindIncenter then GetIncircle's averaged distance. */
function inCircle(a, b, c) {
  const s = winding(a, b, c);
  const u = meet(a, turned(a, b, cornerAngle(a, b, c) / 2, s),
    b, turned(b, c, cornerAngle(b, c, a) / 2, s));
  const rr = (
    norm(minus(u, foot(u, a, b))) +
    norm(minus(u, foot(u, b, c))) +
    norm(minus(u, foot(u, c, a)))
  ) / 3;
  return { center: pt(u), radius: rr };
}

/** Swivel in the bytecode: Rotate(p,q,theta,-1) scaled by d / |p-q|. */
function pivot(p, q, theta, d) {
  const r = turned(p, q, theta, -1);
  return plus(p, scale(minus(r, p), d / norm(minus(q, p))));
}

/** Stretch in the bytecode: q moved to distance d from p. */
function lengthen(p, q, d) {
  return plus(p, scale(minus(q, p), d / norm(minus(q, p))));
}

/** The applet's GetParaLine, as a pair of board points. */
function parallelThrough(m, p, q) {
  const k = foot([m.center.x, m.center.y], p, q);
  const s = [2 * m.center.x - k[0], 2 * m.center.y - k[1]];
  return { p: pt(s), q: pt([s[0] + q[0] - p[0], s[1] + q[1] - p[1]]) };
}

/** One full Compute() of the applet, from its fields and bytecode. */
function appletCompute(width, height, phi) {
  const cx = width / 2, cy = (height * 2) / 3;
  const R = Math.min(width, height) / 2.5;
  const AA = [cx + R * Math.cos(5 * Math.PI / 6), cy + R - R * Math.sin(5 * Math.PI / 6)];
  const BB = [cx + R * Math.cos(Math.PI / 6), cy + R - R * Math.sin(Math.PI / 6)];
  const CC = [cx, AA[1] - (BB[0] - AA[0]) * Math.sqrt(3) / 2];
  const TT = [cx + R * Math.cos(phi), cy + R - R * Math.sin(phi)];
  if (AA[1] < TT[1]) return null; // dcmpg / ifge -> fall through to return false

  const theta = cornerAngle(AA, TT, BB);
  let d = norm(minus(AA, TT));
  let av, bv, cv;
  if (d < norm(minus(TT, BB))) {
    av = pivot(BB, CC, theta, d);
    bv = pivot(CC, AA, theta, d);
    cv = TT;
    const K = meet(AA, av, BB, bv);
    d = norm(minus(AA, K));
    av = lengthen(AA, av, d);
    bv = lengthen(BB, bv, d);
    cv = lengthen(CC, cv, d);
  } else {
    av = TT;
    bv = pivot(BB, CC, theta, d);
    cv = pivot(CC, AA, theta, d);
  }
  const ca = inCircle(AA, av, BB);
  const cb = inCircle(BB, bv, CC);
  const cc = inCircle(CC, cv, AA);
  const cm = inCircle(av, bv, cv);
  return {
    Ap: pt(av), Bp: pt(bv), Cp: pt(cv), ca, cb, cc, cm,
    finished: Math.abs(cm.radius - ca.radius) < 0.5,
    pB: parallelThrough(cm, BB, bv),
    pC: parallelThrough(cm, CC, cv),
    pA: parallelThrough(cm, AA, cv),
  };
}

/* ------------------------------------------- 1. the opening state and input */

{
  const s = C.start({});
  equal("the applet's default canvas and glider", [
    [s.width, s.height], s.center, s.glider.center, s.radius,
  ], [[400, 250], { x: 200, y: 500 / 3 }, { x: 200, y: 500 / 3 + 100 }, 100]);
  check("ABC is equilateral with the applet's orientation",
    near(C.distance(s.A, s.B), 100 * Math.sqrt(3), EPS) &&
    near(C.distance(s.B, s.C), 100 * Math.sqrt(3), EPS) &&
    near(C.distance(s.C, s.A), 100 * Math.sqrt(3), EPS) &&
    near(s.C.x, s.center.x, EPS) && s.C.y < s.A.y);
  check("the middle of ABC is the centre of its circumcircle",
    near((s.A.x + s.B.x + s.C.x) / 3, s.center.x, EPS) &&
    near((s.A.y + s.B.y + s.C.y) / 3, s.center.y, EPS));
  check("T starts inside the valid arc", near(s.angle, C.START_ANGLE, EPS) &&
    near(C.distance(s.T, s.glider.center), s.radius, EPS) &&
    s.angle > C.ARC_START && s.angle < C.ARC_END);
  const g = C.compute(s);
  check("the opening diagram has four circles", !!g && g.rA > 0 && g.rB > 0 && g.rC > 0 && g.rM > 0);
  check("the opening diagram is not the match", !!g && !g.finished);
  check("Show names starts off", !s.showNames);

  const dragged = C.moveT(s, { x: 10000, y: 10000 });
  check("a far pointer is projected onto the sliding circle",
    near(C.distance(dragged.T, s.glider.center), s.radius, EPS) &&
    dragged.T.x > s.glider.center.x);
  const zero = C.moveT(s, s.glider.center);
  check("the circle centre is handled without dividing by zero",
    near(C.distance(zero.T, s.glider.center), s.radius, EPS));
  const turned = C.turn(s, -Math.PI / 72);
  check("turn keeps T on the circle and records its angle",
    near(turned.angle, s.angle - Math.PI / 72, EPS) &&
    near(C.distance(turned.T, s.glider.center), s.radius, EPS));
  const again = C.reset(C.turn(s, 0.7));
  check("reset restores the opening angle but keeps Show names",
    near(again.angle, C.START_ANGLE, EPS) && !again.showNames &&
    again.width === s.width && again.height === s.height);
  check("T below A leaves the old picture alone", C.compute(C.start({ angle: Math.PI * 0.9 })) === null);
  check("the saved position is plain board data", JSON.stringify(C.position(s)) ===
    JSON.stringify({ T: s.T, angle: s.angle, radius: s.radius, showNames: false }));
}

/* ------------------------------- 2. every claim, over the whole parameter space */

{
  let count = 0, equilateral = true, innerFormula = true, threeEqual = true;
  let tangent = true, finishedRule = true, sideFourR = true, cornerArea = true;
  let parallelTangent = true, nonMatching = 0;
  for (const [width, height] of SIZES) {
    for (const phi of ANGLES) {
      const s = C.start({ width, height, angle: phi });
      const g = C.compute(s);
      if (!g || !isFinite(g.rM) || !isFinite(g.rA)) continue;
      count++;
      const tol = 2e-7 * s.radius;
      equilateral = equilateral &&
        near(C.distance(g.Ap, g.Bp), C.distance(g.Bp, g.Cp), tol) &&
        near(C.distance(g.Bp, g.Cp), C.distance(g.Cp, g.Ap), tol);
      innerFormula = innerFormula &&
        near(g.side, 2 * Math.sqrt(3) * g.rM, tol) &&
        near(g.rM, g.side * Math.sqrt(3) / 6, tol);
      threeEqual = threeEqual && near(g.rA, g.rB, tol) && near(g.rB, g.rC, tol);
      tangent = tangent &&
        near(C.distance(g.circleA.center, C.nearestPoint(g.circleA.center, g.A, g.Ap)), g.rA, tol) &&
        near(C.distance(g.circleB.center, C.nearestPoint(g.circleB.center, g.B, g.Bp)), g.rB, tol) &&
        near(C.distance(g.circleC.center, C.nearestPoint(g.circleC.center, g.C, g.Cp)), g.rC, tol);
      finishedRule = finishedRule &&
        g.finished === (Math.abs(g.rM - g.rA) < C.FINISH_TOLERANCE);
      if (g.finished) {
        nonMatching++;
        const d01 = C.distance(g.circleA.center, g.circleB.center);
        const d12 = C.distance(g.circleB.center, g.circleC.center);
        const d20 = C.distance(g.circleC.center, g.circleA.center);
        // The applet calls it a match when the radii differ by less than half
        // a pixel, so its 4r claim holds to about two pixels across that window.
        sideFourR = sideFourR && near(d01, 4 * g.rM, 1) &&
          near(d12, 4 * g.rM, 1) && near(d20, 4 * g.rM, 1);
        for (const line of [g.parallels[0], g.parallels[1], g.parallels[2]]) {
          parallelTangent = parallelTangent && near(
            C.distance(g.circleM.center, C.nearestPoint(g.circleM.center, line.p, line.q)),
            g.rM, tol * 5,
          );
        }
        // The area claimed on the proof page for a corner triangle.
        const cornerAreaValue = Math.abs(
          (g.Ap.x - g.A.x) * (g.B.y - g.A.y) - (g.Ap.y - g.A.y) * (g.B.x - g.A.x),
        ) / 2;
        cornerArea = cornerArea && near(
          cornerAreaValue, g.outerSide * g.rA + Math.sqrt(3) / 3 * g.rA * g.rA, tol * 30,
        );
      }
    }
  }
  check(`checked the claims at ${count} positions`, count > 2000, `${count}`);
  check(`the finished window is not a single point (${nonMatching} positions)`, nonMatching > 20);
  check("A'B'C' is always equilateral", equilateral);
  check("the inradius of A'B'C' is always l*sqrt(3)/6", innerFormula);
  check("the three corner incircles always have the same radius", threeEqual);
  check("the three cevians touch the three corner incircles", tangent);
  check("Finished is exactly the applet's 0.5-pixel test", finishedRule);
  check("the incenter triangle is equilateral of side 4r when finished", sideFourR);
  check("the reflected parallel lines touch the other three circles", parallelTangent);
  check("the corner triangle's area is xr + sqrt(3)/3 r^2", cornerArea);
}

/* ------------------------------------ 3. the page's answer, and the false one */

{
  const angle = C.solve();
  const s = C.start({ angle });
  const g = C.compute(s);
  const x = g.outerSide, l = g.side, r = g.rM;
  const ratio = l / x;
  const claimed = (Math.sqrt(21) - 3) / 4;
  const printed = Math.sqrt(3) / (3 + Math.sqrt(21));
  check("the matching configuration is marked finished", g.finished && s.angle > C.ARC_START && s.angle < Math.PI / 2);
  check("the four radii agree at the match", near(g.rM, g.rA, 1e-9) && near(g.rM, g.rB, 1e-9) && near(g.rM, g.rC, 1e-9));
  check("l/x equals the proof page's (sqrt(21)-3)/4", near(ratio, claimed, 1e-12), `${ratio} vs ${claimed}`);
  check("the applet page's printed sqrt(3)/(3+sqrt(21)) is false",
    !near(ratio, printed, 1e-3) && near(printed * Math.sqrt(3), claimed, 1e-12));
  check("6xl + 4l^2 - 3x^2 = 0 at the match", near(6 * x * l + 4 * l * l - 3 * x * x, 0, 1e-8 * x * x));
  check("the positive root of that quadratic is the measured ratio",
    near((-6 + Math.sqrt(36 + 48)) / 8, ratio, 1e-12));
  check("the areas of the four triangles add up to the big triangle",
    near(3 * x * r + Math.sqrt(3) * r * r + 1.5 * l * r, x * x * Math.sqrt(3) / 4, 1e-8 * x * x));
  check("l = 2*sqrt(3)*r at the match", near(l, 2 * Math.sqrt(3) * r, 1e-9));
  check("the reflected parallel line lies 2r beyond the cevian",
    near(C.distance(g.parallels[0].p, C.nearestPoint(g.parallels[0].p, g.B, g.Bp)), 2 * r, 1e-7 * x));
}

/* ----------------------------- 4. the same numbers as the applet's bytecode */

{
  let allOk = true, cases = 0, worstPoint = 0, worstRadius = 0, worstLine = 0;
  for (const [width, height] of SIZES) {
    for (const phi of ANGLES) {
      const ours = C.compute(C.start({ width, height, angle: phi }));
      const theirs = appletCompute(width, height, phi);
      cases++;
      if (!ours || !theirs) {
        if (!!ours !== !!theirs) allOk = false;
        continue;
      }
      // Both transcriptions fail in the same way at the degenerate ends;
      // there is nothing finite to compare there.
      if (![ours.rA, ours.rM, theirs.ca.radius, theirs.cm.radius].every(Number.isFinite)) continue;
      for (const key of ["Ap", "Bp", "Cp"]) {
        const a = ours[key], b = b2(theirs, key);
        const err = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        worstPoint = Math.max(worstPoint, err);
        if (err > 1e-6) allOk = false;
      }
      for (const [ourKey, theirKey] of [
        ["rA", "ca"], ["rB", "cb"], ["rC", "cc"], ["rM", "cm"],
      ]) {
        const err = Math.abs(ours[ourKey] - theirs[theirKey].radius);
        worstRadius = Math.max(worstRadius, err);
        if (err > 1e-7) allOk = false;
        const c = theirs[theirKey].center;
        const oc = ours[{ ca: "circleA", cb: "circleB", cc: "circleC", cm: "circleM" }[theirKey]].center;
        worstPoint = Math.max(worstPoint, Math.abs(c.x - oc.x), Math.abs(c.y - oc.y));
      }
      for (const [ourLine, theirLine] of [
        [ours.parallels[0], theirs.pB], [ours.parallels[1], theirs.pC], [ours.parallels[2], theirs.pA],
      ]) {
        const err = Math.max(
          Math.abs(ourLine.p.x - theirLine.p.x), Math.abs(ourLine.p.y - theirLine.p.y),
          Math.abs(ourLine.q.x - theirLine.q.x), Math.abs(ourLine.q.y - theirLine.q.y),
        );
        worstLine = Math.max(worstLine, err);
        if (err > 1e-5) allOk = false;
      }
      if (ours.finished !== theirs.finished) allOk = false;
    }
  }
  function b2(obj, key) { return obj[key]; }
  check(`core matches the applet's bytecode at ${cases} configurations`, allOk);
  check("the second transcription agrees on every point", worstPoint < 1e-6, `${worstPoint}`);
  check("the second transcription agrees on every radius", worstRadius < 1e-7, `${worstRadius}`);
  check("the second transcription agrees on every parallel line", worstLine < 1e-5, `${worstLine}`);
}

done("four-incircles-in-triangle");
