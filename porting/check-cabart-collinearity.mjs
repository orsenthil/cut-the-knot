#!/usr/bin/env node
"use strict";

/*
 * Logic test for cabart-collinearity/cabart-collinearity-core.js.
 *
 *   node porting/check-cabart-collinearity.mjs
 *
 * Checked: the applet's constants (Scrollbar 0..95 starting at 45 and the
 * init triangle), its angle and option handling, and the degenerate angles
 * 0 and 90 where one triple of apexes collapses. For fixed triangles and
 * several hundred random ones at many angles, every claim on the page is
 * tested: the two Kiepert points match BOTH of the page's barycentric forms,
 * the nine-point centre is the circumcenter of the sides' midpoints AND the
 * barycentric point [a cos(B-C)], the sums satisfy s1 + s2 = 2 s3, N is the
 * weighted centre of K(x) and K(y), and K(x), K(y), N lie on one line.
 *
 * The last group is a second, literal transcription of the applet's own
 * bytecode methods GeoSDoub.Rotate, GeoSDoub.Intersect, Apex, Compute and
 * CabartCollinearityCanvas$NinePointCircle, compared with the core on every
 * fixed case and on hundreds of random ones.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cabart-collinearity/cabart-collinearity-core.js", "CabartCollinearityCore");

const P = (x, y) => ({ x: x, y: y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closeP = (p, q, tol) => finite(p) && finite(q) && dist(p, q) <= tol;
const scaleOf = (s) => Math.max(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A));
const tri = (A, B, Cc, angle = 45) => ({
  A: { ...A }, B: { ...B }, C: { ...Cc }, angle: angle,
  showOuter: false, showInner: false, show9PC: false, showNames: false,
});

/* ------------------- the applet's computation, transcribed from the bytecode */

/* GeoSDoub.Rotate(P,Q,theta,s). */
function aRotate(p, q, theta, s) {
  const cs = Math.cos(theta), sn = Math.sin(theta);
  return P(p.x + cs * (q.x - p.x) - s * sn * (q.y - p.y),
    p.y + s * sn * (q.x - p.x) + cs * (q.y - p.y));
}

/* GeoSDoub.Intersect(P1,P2,P3,P4), including its |det| < 1 guard. */
function aIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* CabartCollinearityCanvas.Apex(P,Q,theta,1). */
function aApex(p, q, theta) {
  return aIntersect(p, aRotate(p, q, theta, 1), q, aRotate(q, p, theta, -1));
}

const aAverage = (...ps) => P(
  ps.reduce((s, p) => s + p.x, 0) / ps.length,
  ps.reduce((s, p) => s + p.y, 0) / ps.length,
);
const aMid = (p, q) => aAverage(p, q);

/* GeoSDoub.FindCircumcenter: perpendicular bisectors of two of the inputs. */
function aCircumcenter(p, q, r) {
  const m1 = aMid(p, q), m2 = aMid(q, r);
  const v1 = P(m1.x + q.y - p.y, m1.y - (q.x - p.x));
  const v2 = P(m2.x + r.y - q.y, m2.y - (r.x - q.x));
  return aIntersect(m1, v1, m2, v2);
}

/* Compute() plus the NinePointCircle constructor, from the same bytecode. */
function aCompute(s) {
  const theta = s.angle * Math.PI / 180;
  const inner = theta - Math.PI / 2;
  const Ap = aApex(s.B, s.C, theta), Bp = aApex(s.C, s.A, theta), Cp = aApex(s.A, s.B, theta);
  const Am = aApex(s.B, s.C, inner), Bm = aApex(s.C, s.A, inner), Cm = aApex(s.A, s.B, inner);
  const Kp = aAverage(
    aIntersect(s.A, Ap, s.B, Bp), aIntersect(s.B, Bp, s.C, Cp), aIntersect(s.C, Cp, s.A, Ap),
  );
  const Km = aAverage(
    aIntersect(s.A, Am, s.B, Bm), aIntersect(s.B, Bm, s.C, Cm), aIntersect(s.C, Cm, s.A, Am),
  );
  const N = aCircumcenter(aMid(s.B, s.C), aMid(s.C, s.A), aMid(s.A, s.B));
  return { Ap, Bp, Cp, Am, Bm, Cm, Kp, Km, N };
}

/* --------------------------------------------------------- 1. the constants */

{
  const s = C.start();
  equal("start A matches init for a 400x300 canvas", s.A, P(80, 220));
  equal("start B matches init for a 400x300 canvas", s.B, P(220, 160));
  equal("start C matches init for a 400x300 canvas", s.C, P(200, 94));
  check("the slider starts at 45 degrees", s.angle === 45);
  check("the slider's range is 0 to 95",
    C.ANGLE.min === 0 && C.ANGLE.max === 95 && C.ANGLE.pageStep === 5);
  check("angles outside the slider's range are clamped",
    C.clampAngle(-20) === 0 && C.clampAngle(500) === 95);
  check("all four show boxes are off initially",
    !s.showOuter && !s.showInner && !s.show9PC && !s.showNames);
  check("an illustration has no result", C.result(s) === null);
  check("withPoint keeps the options and does not change the old position", (() => {
    const next = C.withPoint(s, "A", P(11, 22));
    return next.A.x === 11 && s.A.x === 80 && next.angle === 45 && next.showOuter === false;
  })());
  check("withOptions clamps the angle and toggles one option", (() => {
    const next = C.withOptions(s, { angle: 500, show9PC: true });
    return next.angle === 95 && next.show9PC && !next.showOuter && next.A.x === 80;
  })());
  check("a different canvas size changes the starting triangle", (() => {
    const t = C.start({ width: 800, height: 600 });
    return t.A.x === 160 && t.B.x === 440 && t.C.x === 400 && t.A.y === 400;
  })());
  check("rotate moves a point around its centre", (() => {
    const q = C.rotate(P(0, 0), P(10, 0), Math.PI / 2, 1);
    return close(q.x, 0, 1e-12) && close(q.y, 10, 1e-12);
  })());
  check("an apex of a horizontal side at 45 degrees sits above its midpoint", (() => {
    const ap = C.apex(P(0, 0), P(100, 0), Math.PI / 4);
    return close(ap.x, 50, 1e-9) && close(ap.y, 50, 1e-9);
  })());
  check("parallel lines have no intersection", !finite(C.intersect(P(0, 0), P(10, 0), P(0, 5), P(10, 5))));
  check("extremePair picks the two points that enclose the third", (() => {
    const pair = C.extremePair(P(0, 0), P(5, 0), P(10, 0));
    return pair[0].x === 0 && pair[1].x === 10 && C.isInside(P(5, 0), pair[0], pair[1]);
  })());
}

/* ----------------------------------------- 2. fixed configurations and claims */

const fixed = [
  ["the applet's start", tri(P(80, 220), P(220, 160), P(200, 94), 45)],
  ["equilateral", tri(P(200, 40), P(60, 280), P(340, 280), 45)],
  ["equilateral at 30 degrees", tri(P(200, 40), P(60, 280), P(340, 280), 30)],
  ["right angled", tri(P(60, 250), P(60, 40), P(320, 250), 45)],
  ["obtuse at A", tri(P(60, 150), P(320, 90), P(300, 240), 60)],
  ["obtuse at B", tri(P(180, 40), P(50, 260), P(360, 250), 75)],
  ["thin, nearly flat", tri(P(40, 150), P(360, 160), P(200, 175), 20)],
  ["the highest angle", tri(P(80, 220), P(220, 160), P(200, 94), 95)],
  ["the lowest angle", tri(P(80, 220), P(220, 160), P(200, 94), 1)],
];

for (const [name, s] of fixed) {
  const cl = C.claims(s);
  if (cl.usable) {
    check(`${name}: the outer Kiepert point matches the cos barycentrics`, cl.outerKiepert);
    check(`${name}: it also matches a/sin(A+x)`, cl.sinForm);
    check(`${name}: the inner point is K(x-90 degrees)`, cl.innerKiepert);
    check(`${name}: N is the barycentric point [a cos(B-C)]`, cl.ninePointCenter);
    check(`${name}: s1 + s2 = 2 s3`, cl.sumsIdentity);
    check(`${name}: N is the weighted centre of the two Kiepert points`, cl.weightedCenter);
    check(`${name}: Kp, Km and N are collinear`, cl.collinear);
    check(`${name}: the drawn line contains all three points`, (() => {
      const [u, v] = cl.m.line;
      return C.isInside(cl.m.Kp, u, v) && C.isInside(cl.m.Km, u, v) &&
        C.isInside(cl.m.N, u, v) && Math.abs((v.x - u.x) * (cl.m.N.y - u.y) -
          (v.y - u.y) * (cl.m.N.x - u.x)) <= 1e-6 * scaleOf(s);
    })());
  } else {
    check(`${name}: a singular configuration is reported as unusable`, !cl.usable);
  }
}

/* ------------------------------------- 3. the exact applet computation vs core */

{
  let compared = 0;
  let worst = 0;
  for (const [, s] of fixed) {
    const a = aCompute(s), m = C.measure(s);
    for (const key of ["Ap", "Bp", "Cp", "Am", "Bm", "Cm", "Kp", "Km", "N"]) {
      const tol = 1e-6 * Math.max(1, scaleOf(s));
      if (!closeP(a[key], m[key], tol) && !(finite(a[key]) === false && finite(m[key]) === false)) {
        check(`fixed ${key} matches the applet's ${key}`, false,
          `applet ${JSON.stringify(a[key])}, core ${JSON.stringify(m[key])}`);
      } else {
        compared++;
        if (finite(a[key])) worst = Math.max(worst, dist(a[key], m[key]));
      }
    }
  }
  const rand = rng(2932);
  for (let trial = 0; trial < 500; trial++) {
    const s = tri(
      P(10 + rand() * 380, 10 + rand() * 280),
      P(10 + rand() * 380, 10 + rand() * 280),
      P(10 + rand() * 380, 10 + rand() * 280),
      1 + Math.floor(rand() * 94),
    );
    if (Math.abs((s.B.x - s.A.x) * (s.C.y - s.A.y) - (s.B.y - s.A.y) * (s.C.x - s.A.x)) < 4000) continue;
    const a = aCompute(s), m = C.measure(s);
    const tol = 1e-6 * scaleOf(s);
    for (const key of ["Ap", "Bp", "Cp", "Am", "Bm", "Cm", "Kp", "Km", "N"]) {
      if (!closeP(a[key], m[key], tol) && !(finite(a[key]) === false && finite(m[key]) === false)) {
        check(`random ${trial}: ${key} matches the applet's ${key}`, false,
          `applet ${JSON.stringify(a[key])}, core ${JSON.stringify(m[key])}`);
      } else {
        compared++;
        if (finite(a[key])) worst = Math.max(worst, dist(a[key], m[key]));
      }
    }
  }
  check(`core and applet agree on ${compared} computed points`, compared > 3000);
  check(`the largest disagreement is tiny (${worst.toExponential(2)} px)`, worst < 1e-6);
}

/* ------------------------------------ 4. the page's claims across configurations */

{
  const rand = rng(9141);
  let tested = 0;
  let maxCollinear = 0;
  for (let trial = 0; trial < 700; trial++) {
    const s = tri(
      P(10 + rand() * 380, 10 + rand() * 280),
      P(10 + rand() * 380, 10 + rand() * 280),
      P(10 + rand() * 380, 10 + rand() * 280),
      5 + Math.floor(rand() * 86),
    );
    const cl = C.claims(s);
    if (!cl.usable) continue;
    tested++;
    maxCollinear = Math.max(maxCollinear, Math.abs(cl.m.collinearError));
    if (!(cl.outerKiepert && cl.sinForm && cl.innerKiepert && cl.ninePointCenter &&
      cl.sumsIdentity && cl.weightedCenter && cl.collinear)) {
      check(`random ${trial}: every claim holds`, false, JSON.stringify({
        outer: cl.outerKiepert, sin: cl.sinForm, inner: cl.innerKiepert,
        N: cl.ninePointCenter, sums: cl.sumsIdentity, weighted: cl.weightedCenter,
        collinear: cl.collinear, angle: s.angle,
      }));
    }
  }
  check(`all claims hold on ${tested} random configurations`, tested > 600);
  check(`the worst collinearity error is ${maxCollinear.toExponential(2)}`, maxCollinear < 1e-9);
}

/* ------------------------------------------- 5. what the special angles mean */

{
  const m45 = C.measure(fixed[0][1]);
  check("at 45 degrees the erected triangles are isosceles right",
    close(Math.PI - 2 * m45.theta, Math.PI / 2, 1e-12));
  const m30 = C.measure(fixed[2][1]);
  check("at 30 degrees the apex angle is 120 degrees, as the page says",
    close(Math.PI - 2 * m30.theta, (2 * Math.PI) / 3, 1e-12));
  const zero = C.measure(tri(P(80, 220), P(220, 160), P(200, 94), 0));
  check("at 0 degrees both triples collapse, as in the applet",
    !zero.outerUsable && !zero.innerUsable && !zero.usable);
  const right = C.measure(tri(P(80, 220), P(220, 160), P(200, 94), 90));
  check("at 90 degrees both triples collapse too",
    !right.outerUsable && !right.innerUsable && !right.usable);
  check("nine-point radius is the mean distance to the side midpoints", (() => {
    const m = C.measure(fixed[0][1]);
    const mean = (dist(m.N, m.midpoints.AB) + dist(m.N, m.midpoints.BC) +
      dist(m.N, m.midpoints.CA)) / 3;
    return close(m.radius, mean, 1e-12);
  })());
  check("a very small angle still gives a collinear triple when it is defined", (() => {
    const cl = C.claims(tri(P(80, 220), P(220, 160), P(200, 94), 1));
    return cl.usable && cl.collinear;
  })());
}

done("cabart-collinearity");
