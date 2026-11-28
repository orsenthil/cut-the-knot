#!/usr/bin/env node
"use strict";

/*
 * Logic test for herons-formula/herons-formula-core.js.
 *
 *   node porting/check-herons-formula.mjs
 *
 * The page claims that for a triangle with sides a,b,c and semiperimeter
 * s=(a+b+c)/2, S^2 = s(s-a)(s-b)(s-c) = sxyz, where x=s-a, y=s-b, z=s-c;
 * that the six triangles around the incircle rearrange to S = rs; and that
 * xyz = r^2(x+y+z) = r^2s, giving the cotangent identity. All of them are
 * checked at fixed triangles and at hundreds of random ones in both winding
 * orders. The last section is a second, literal transcription of the applet's
 * own arithmetic — GeoSDoub.FindIncenter/NearestPoint/Dist and
 * HeronsFormulaCanvas.Compute — compared with the core field by field.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("herons-formula/herons-formula-core.js", "HeronsFormulaCore");

const dist = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
const close = (a, b, tol = 1e-7) => Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc, width = 600, height = 450) =>
  ({ A: { ...A }, B: { ...B }, C: { ...Cc }, width, height, showNames: false });
const allClaims = (s) => C.claims(s);
const claimsPass = (cl) => Object.values(cl).every(Boolean);

/* ---------------- the applet's own computation, transcribed from bytecode */

/* GeoSDoub.SqDist and Dist (sqrt of the sum of squares, not Math.hypot). */
function sq(P, Q) {
  const dx = P.x - Q.x, dy = P.y - Q.y;
  return dx * dx + dy * dy;
}
function appletDist(P, Q) {
  return Math.sqrt(sq(P, Q));
}

/* GeoSDoub.ComputeAngle: law of cosines; acos is not clamped in the class. */
function appletAngle(P, Q, R) {
  return Math.acos((sq(P, Q) + sq(P, R) - sq(Q, R)) /
    (2 * appletDist(P, Q) * appletDist(P, R)));
}

/* GeoSDoub.FindOrientation: the class returns -1 when the cross is <= 0. */
function appletOrientation(A, B, D) {
  const s = D.x * (A.y - B.y) + D.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate by orientation * angle about the first point. */
function appletRotate(P, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* GeoSDoub.Intersect in ax+by+c = 0 form, with the applet's |det| < 1 guard. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindIncenter(A,B,C): rotate AB and BC by half-angles, intersect. */
function appletIncenter(A, B, Cc) {
  const a = appletAngle(A, B, Cc) / 2;
  const b = appletAngle(B, Cc, A) / 2;
  const orient = appletOrientation(A, B, Cc);
  const rayA = appletRotate(A, B, a, orient);
  const rayB = appletRotate(B, Cc, b, orient);
  return appletIntersect(A, rayA, B, rayB);
}

/* GeoSDoub.NearestPoint(P,A,B): project onto the infinite line A->B. */
function appletNearest(P, A, B) {
  if (sq(A, P) < 0.1) return { ...P };
  const dx = B.x - A.x, dy = B.y - A.y;
  const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / (dx * dx + dy * dy);
  return { x: A.x + dx * t, y: A.y + dy * t };
}

/* HeronsFormulaCanvas.Compute(), in the exact order of the bytecode. */
function appletCompute(s) {
  const A = s.A, B = s.B, Cc = s.C;
  const w = s.width, h = s.height;
  const I = appletIncenter(A, B, Cc);
  const Ia = appletNearest(I, B, Cc);
  const Ib = appletNearest(I, A, Cc);
  const Ic = appletNearest(I, B, A);
  const r = (appletDist(I, Ia) + appletDist(I, Ib) + appletDist(I, Ic)) / 3;
  const X = (appletDist(A, Ib) + appletDist(A, Ic)) / 2;
  const Y = (appletDist(B, Ic) + appletDist(B, Ia)) / 2;
  const Z = (appletDist(Cc, Ia) + appletDist(Cc, Ib)) / 2;
  const S = X + Y + Z;
  const XYZ = X * Y * Z;
  const W = r * Z * (X + Y);
  const k = Math.min((h / 2 - 60 - 20 - r) / XYZ, (w / 2 - 60) / W);
  const LU = { x: w / 2 + 30, y: 30 };
  const LD = { x: LU.x, y: LU.y + XYZ * k };
  const RD = { x: LD.x + W * k, y: LD.y };
  const RU = { x: RD.x, y: LU.y };
  const UM = { x: LU.x + r * Y * Z * k, y: LU.y };
  const RM = { x: RU.x, y: RU.y + r * r * Z * k };
  const center = {
    x: (A.x + B.x + Cc.x) / 3,
    y: (A.y + B.y + Cc.y) / 3,
  };
  const baseY = h / 2 - 20;
  const topY = baseY - r;
  const left = (w - S) / 2;
  const top = [
    { x: left, y: topY }, { x: left + X, y: topY },
    { x: left + X + Y, y: topY }, { x: left + X + Y + Z, y: topY },
  ];
  const bottom = top.map((p) => ({ x: p.x, y: baseY }));
  return { I, Ia, Ib, Ic, r, x: X, y: Y, z: Z, s: S, xyz: XYZ,
    rightWidth: W, scale: k, LU, LD, RD, RU, UM, RM, center, top, bottom };
}

/* --------------------------------------------- 1. the start and the options */

{
  const s = C.start({});
  const step = 112; // Math.trunc(Math.min(600,450)/4), as in Canvas.init
  const ex = 300 - (3 * step) / 2;
  equal("start A matches Canvas.init", s.A,
    { x: ex + step * Math.cos(-1.6), y: 225 + step * Math.sin(-1.6) });
  equal("start B matches Canvas.init", s.B,
    { x: ex + step * Math.cos(-4), y: 225 + step * Math.sin(-4) });
  equal("start C matches Canvas.init", s.C,
    { x: ex + step * Math.cos(-0.2), y: 225 + step * Math.sin(-0.2) });
  check("Show names starts unchecked, as the applet's parameter default does", s.showNames === false);
  check("an illustration has no result", C.result(s) === null);
  check("the starting triangle is not degenerate", C.configuration(s).ok);
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === ex + step * Math.cos(-1.6) && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("withOption changes only the named option", (() => {
    const next = C.withOption(s, "showNames", true);
    return next.showNames === true && s.showNames === false && next.A.x === s.A.x;
  })());
}

/* --------------------------------------- 2. a hand-checkable 3-4-5 triangle */

{
  // A=(0,0), B=(4,0), C=(0,3): a=5, b=3, c=4, s=6, x=1, y=3, z=2, r=1.
  const s = tri({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 });
  const g = C.configuration(s);
  check("3-4-5: the sides are 5, 3, 4", close(g.sides.a, 5, 1e-12) &&
    close(g.sides.b, 3, 1e-12) && close(g.sides.c, 4, 1e-12));
  check("3-4-5: the semiperimeter is 6", close(g.s, 6, 1e-12));
  check("3-4-5: x = s-a = 1", close(g.x, 1, 1e-9), `got ${g.x}`);
  check("3-4-5: y = s-b = 3 and z = s-c = 2", close(g.y, 3, 1e-9) && close(g.z, 2, 1e-9));
  check("3-4-5: xyz = 6 = r^2 s", close(g.xyz, 6, 1e-9) && close(g.r * g.r * g.s, 6, 1e-9));
  check("3-4-5: the measured area is 6 = rs", close(g.area, 6, 1e-12) && close(g.r * g.s, 6, 1e-9));
  check("3-4-5: the bottom rectangle is x+y+z by r", close(
    (g.strip.bottom[3].x - g.strip.top[0].x) * (g.strip.bottom[0].y - g.strip.top[0].y), 6, 1e-9));
  check("3-4-5: every page claim holds", claimsPass(allClaims(s)), JSON.stringify(allClaims(s)));
}

/* ----------------------------------------- 3. fixed triangles, either winding */

const fixed = [
  ["applet start", C.start()],
  ["equilateral", tri({ x: 300, y: 40 }, { x: 90, y: 350 }, { x: 510, y: 350 })],
  ["isosceles", tri({ x: 300, y: 40 }, { x: 110, y: 260 }, { x: 490, y: 260 })],
  ["right at A", tri({ x: 100, y: 300 }, { x: 500, y: 300 }, { x: 100, y: 60 })],
  ["right at B", tri({ x: 250, y: 100 }, { x: 250, y: 380 }, { x: 540, y: 380 })],
  ["obtuse at A", tri({ x: 60, y: 170 }, { x: 560, y: 90 }, { x: 500, y: 340 })],
  ["obtuse at B", tri({ x: 200, y: 40 }, { x: 45, y: 380 }, { x: 560, y: 300 })],
  ["obtuse at C", tri({ x: 40, y: 40 }, { x: 560, y: 80 }, { x: 300, y: 160 })],
  ["clockwise", tri({ x: 200, y: 250 }, { x: 60, y: 60 }, { x: 500, y: 90 })],
  ["long thin", tri({ x: 30, y: 150 }, { x: 570, y: 158 }, { x: 300, y: 172 })],
  ["tiny", tri({ x: 30, y: 30 }, { x: 45, y: 32 }, { x: 36, y: 48 })],
  ["translated", tri({ x: 260, y: 170 }, { x: 220, y: 367 }, { x: 402, y: 260 })],
];

for (const [name, s] of fixed) {
  const cl = allClaims(s);
  check(`${name}: Heron's formula and sxyz agree with the measured area`, cl.heron);
  check(`${name}: x,y,z are s-a,s-b,s-c`, cl.tangentLengths && cl.semiperimeter);
  check(`${name}: the six-triangle strip has area rs`, cl.areaFromInradius && cl.dissectionArea);
  check(`${name}: xyz = r^2 s and both cotangent identities hold`,
    cl.identity && cl.cotangent && cl.cotangentAngles);
  check(`${name}: the half angles add to 90 degrees`, cl.halfAngles);
  check(`${name}: the three feet really touch the sides`, cl.feetOnSides);
  check(`${name}: the right-hand rectangles follow the applet's scale`, cl.rightDivision);
  check(`${name}: every claim holds together`, claimsPass(cl), JSON.stringify(cl));
}

/* ------------------------- 4. the page's claims over hundreds of random cases */

{
  const rand = rng(4127);
  let tested = 0;
  for (let trial = 0; trial < 1200; trial++) {
    const s = tri(
      { x: 20 + rand() * 560, y: 20 + rand() * 410 },
      { x: 20 + rand() * 560, y: 20 + rand() * 410 },
      { x: 20 + rand() * 560, y: 20 + rand() * 410 },
    );
    if (Math.abs(C.cross(s.A, s.B, s.C)) < 500) continue;
    tested++;
    const cl = allClaims(s);
    if (!claimsPass(cl)) check(`random ${trial}: every claim holds`, false, JSON.stringify(cl));
  }
  check(`all claims hold on ${tested} random triangles`, tested > 1000);
}

/* ------------- 5. the core against the applet's own bytecode arithmetic */

function compareFields(s, label, tol) {
  const a = appletCompute(s);
  const g = C.configuration(s);
  const points = ["I", "Ia", "Ib", "Ic", "LU", "LD", "RD", "RU", "UM", "RM", "center"];
  for (const key of points) {
    const corePoint = ["LU", "LD", "RD", "RU", "UM", "RM"].includes(key) ? g.right[key] : g[key];
    if (!closePoint(a[key], corePoint, tol)) {
      check(`${label}: applet ${key} matches core ${key}`, false,
        `applet ${JSON.stringify(a[key])}, core ${JSON.stringify(corePoint)}`);
    }
  }
  for (const key of ["r", "x", "y", "z", "s", "xyz", "rightWidth", "scale"]) {
    if (!close(a[key], g[key], tol)) {
      check(`${label}: applet ${key} matches core ${key}`, false,
        `applet ${a[key]}, core ${g[key]}`);
    }
  }
  for (let i = 0; i < 4; i++) {
    if (!closePoint(a.top[i], g.strip.top[i], tol) ||
        !closePoint(a.bottom[i], g.strip.bottom[i], tol)) {
      check(`${label}: applet dissection strip ${i} matches core`, false);
    }
  }
}

{
  for (const [name, s] of fixed) compareFields(s, name, 1e-10);
  check(`applet and core agree field by field on ${fixed.length} fixed triangles`, true);

  const rand = rng(9901);
  let compared = 0;
  for (let trial = 0; trial < 600; trial++) {
    const s = tri(
      { x: 20 + rand() * 560, y: 20 + rand() * 410 },
      { x: 20 + rand() * 560, y: 20 + rand() * 410 },
      { x: 20 + rand() * 560, y: 20 + rand() * 410 },
    );
    if (Math.abs(C.cross(s.A, s.B, s.C)) < 500) continue;
    compareFields(s, `random ${trial}`, 1e-10);
    compared++;
  }
  check(`applet and core agree field by field on ${compared} random triangles`, compared > 500);
}

/* --------------------------------- 6. invariants, limits and degenerate input */

{
  const base = tri({ x: 100, y: 300 }, { x: 400, y: 300 }, { x: 170, y: 90 });
  const g = C.configuration(base);
  const shift = tri({ x: 200, y: 120 }, { x: 500, y: 120 }, { x: 270, y: -90 });
  const h = C.configuration(shift);
  check("translation leaves x,y,z,s and r alone", close(g.x, h.x) && close(g.y, h.y) &&
    close(g.z, h.z) && close(g.s, h.s) && close(g.r, h.r));
  check("translation leaves the measured area alone", close(g.area, h.area));

  const angle = 0.7, cs = Math.cos(angle), sn = Math.sin(angle);
  const turn = (p) => ({ x: 300 + cs * (p.x - 300) - sn * (p.y - 225),
                        y: 225 + sn * (p.x - 300) + cs * (p.y - 225) });
  const rotated = tri(turn(base.A), turn(base.B), turn(base.C));
  const k = C.configuration(rotated);
  check("rotation leaves the Heron data alone", close(g.x, k.x) && close(g.y, k.y) &&
    close(g.z, k.z) && close(g.s, k.s) && close(g.r, k.r) && close(g.area, k.area));

  const swapped = tri(base.B, base.A, base.C);
  const q = C.configuration(swapped);
  check("relabelling A and B only swaps x and y", close(q.x, g.y) && close(q.y, g.x) &&
    close(q.z, g.z) && close(q.s, g.s) && close(q.area, g.area));

  // Brahmagupta's formula for a cyclic quadrilateral with the fourth side
  // shrinking to zero must approach Heron's formula (the page's note).
  const sides = [130, 110, 90];
  const small = 0.001;
  const semis = (sides[0] + sides[1] + sides[2] + small) / 2;
  const brah = Math.sqrt((semis - sides[0]) * (semis - sides[1]) *
    (semis - sides[2]) * (semis - small));
  const triangleS = (sides[0] + sides[1] + sides[2]) / 2;
  const heron = Math.sqrt(triangleS * (triangleS - sides[0]) *
    (triangleS - sides[1]) * (triangleS - sides[2]));
  check("Brahmagupta with a vanishing side approaches Heron", close(brah, heron, 1e-4),
    `got ${brah} versus ${heron}`);
}

{
  const flat = tri({ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 210, y: 20 });
  const same = tri({ x: 30, y: 30 }, { x: 30, y: 30 }, { x: 300, y: 300 });
  for (const [name, s] of [["collinear", flat], ["duplicate corners", same]]) {
    const g = C.configuration(s);
    check(`${name}: the core reports an unusable triangle`, !g.ok);
    check(`${name}: no claim is asserted`, !claimsPass(allClaims(s)));
    check(`${name}: the core returns all the drawing fields without throwing`,
      Boolean(g.Ia && g.Ib && g.Ic && g.right && g.strip && g.strip.top.length === 4));
  }
  check("the applet's Intersect returns NaN for parallel lines", (() => {
    const p = appletIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 });
    return Number.isNaN(p.x) && Number.isNaN(p.y);
  })());
}

done("herons-formula");
