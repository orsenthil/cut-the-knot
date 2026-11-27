#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-through-incenter-2/circle-through-incenter-2-core.js.
 *
 *   node porting/check-circle-through-incenter-2.mjs
 *
 * 1. The port against the applet, method for method: FindIncenter's two
 *    half-angle rotations, FindCircumcenter's two perpendicular bisectors,
 *    GetCircle's mean radius, GeoSDoub.IntersectX/IntersectY, Other's 1px
 *    test and Compute. Compared on named triangles and hundreds of generated
 *    ones, not just a few samples.
 * 2. The page's claims, over the same cases: X on AC, Y on BC, J on CI, all
 *    on the circle; AX = BY; XY antiparallel to AB; angle BAX = angle BYX;
 *    the centre on the bisector CI (the sibling applet's theorem); and the
 *    "red herring" case AC = BC, where X = A and Y = B.
 * 3. The applet's own quirk: Other() calls a hit "the second point" as soon
 *    as it is at least 1px from the vertex. When a cut is almost tangent the
 *    true second point is nearer than 1px, and the applet keeps the vertex
 *    instead. The core reproduces that choice; the mathematical claims are
 *    checked against the true (farthest) intersection, and the report says
 *    how often the two differ.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circle-through-incenter-2/circle-through-incenter-2-core.js", "CircleThroughIncenter2Core");

const P = (x, y) => ({ x, y });
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const add = (a, b) => P(a.x + b.x, a.y + b.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const same = (a, b, tol = 1e-6) => !!a && !!b && near(a.x, b.x, tol) && near(a.y, b.y, tol);
const onLine = (p, a, b, tol = 1e-6) => Math.abs(cross(sub(p, a), sub(b, a))) / Math.max(1, dist(a, b)) < tol;
const onCircle = (p, circle, tol = 1e-6) => near(dist(p, circle.c), circle.r, tol);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ------------------------ the applet's construction, straight from bytecode */

// GeoSDoub.FindOrientation.
function orientation(a, b, c) {
  return cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1;
}

// GeoSDoub.ComputeAngle(p, q, r): the angle at p, by the cosine rule.
function computeAngle(p, q, r) {
  const v = (dist(p, q) ** 2 + dist(p, r) ** 2 - dist(q, r) ** 2) /
    (2 * dist(p, q) * dist(p, r));
  return Math.acos(clamp(v, -1, 1));
}

// GeoSDoub.Rotate(p, q, angle, sign): rotate q around p.
function rotate(p, q, t, sign) {
  const ct = Math.cos(t), st = Math.sin(t);
  return P(p.x + ct * (q.x - p.x) - sign * st * (q.y - p.y),
           p.y + sign * st * (q.x - p.x) + ct * (q.y - p.y));
}

// GeoSDoub.Intersect(p1, p2, p3, p4), determinant form from javap.
function lineIntersection(p1, p2, p3, p4) {
  const y21 = p1.y - p2.y, x12 = p2.x - p1.x;
  const c12 = p1.x * p2.y - p1.y * p2.x;
  const y43 = p3.y - p4.y, x34 = p4.x - p3.x;
  const c34 = p3.x * p4.y - p3.y * p4.x;
  const d = y21 * x34 - y43 * x12;
  if (Math.abs(d) < 1e-12) return null; // the applet returns NaN points here
  const x = (x12 * c34 - x34 * c12) / d;
  const y = (c12 * y43 - c34 * y21) / d;
  return P(x, y);
}

// GeoSDoub.FindIncenter: intersect the bisectors at A and B.
function appletIncenter(a, b, c) {
  const sign = orientation(a, b, c);
  const bisA = rotate(a, b, computeAngle(a, b, c) / 2, sign);
  const bisB = rotate(b, c, computeAngle(b, c, a) / 2, sign);
  return lineIntersection(a, bisA, b, bisB);
}

// GeoSDoub.FindCircumcenter: intersect two perpendicular bisectors.
function appletCircumcenter(a, b, c) {
  const ab = P((a.x + b.x) / 2, (a.y + b.y) / 2);
  const bc = P((b.x + c.x) / 2, (b.y + c.y) / 2);
  const perpAB = P(ab.x + (b.y - a.y), ab.y - (b.x - a.x));
  const perpBC = P(bc.x + (c.y - b.y), bc.y - (c.x - b.x));
  return lineIntersection(ab, perpAB, bc, perpBC);
}

// CircleThroughIncenter2Canvas.GetCircle: centre plus mean of the radii.
function appletCircle(a, b, c) {
  const centre = appletCircumcenter(a, b, c);
  return { c: centre, r: (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3 };
}

// GeoSDoub.IntersectX(DoubLine, DoubCircle), formula for formula.
function intersectX(l, circle) {
  const k = (l.a.x - l.b.x) / (l.a.y - l.b.y);
  const b = l.b.x - k * l.b.y;
  const A = k * k + 1;
  const c = k * (b - circle.c.x) - circle.c.y;
  const q = circle.c.y ** 2 + (b - circle.c.x) ** 2 - circle.r ** 2;
  const disc = c * c - A * q;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [P(k * ((-c + s) / A) + b, (-c + s) / A),
          P(k * ((-c - s) / A) + b, (-c - s) / A)];
}

// GeoSDoub.IntersectY(DoubLine, DoubCircle), formula for formula.
function intersectY(l, circle) {
  const k = (l.a.y - l.b.y) / (l.a.x - l.b.x);
  const b = l.b.y - k * l.b.x;
  const A = k * k + 1;
  const c = k * (b - circle.c.y) - circle.c.x;
  const q = circle.c.x ** 2 + (b - circle.c.y) ** 2 - circle.r ** 2;
  const disc = c * c - A * q;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [P((-c + s) / A, k * ((-c + s) / A) + b),
          P((-c - s) / A, k * ((-c - s) / A) + b)];
}

// GeoSDoub.Intersect(DoubCircle, DoubLine): X if |dy| > 1, else Y if |dx| > 1.
function geoIntersect(l, circle) {
  if (Math.abs(l.a.y - l.b.y) > 1) return intersectX(l, circle);
  if (Math.abs(l.a.x - l.b.x) > 1) return intersectY(l, circle);
  return null;
}

// CircleThroughIncenter2Canvas.Other: the first hit at least 1px away.
function other(points, vertex) {
  return dist(points[0], vertex) >= 1 ? points[0] : (points[1] || points[0]);
}

// The mathematically intended second crossing: simply the farther hit.
function idealOther(points, vertex) {
  return dist(points[0], vertex) >= dist(points[1], vertex) ? points[0] : points[1];
}

// CircleThroughIncenter2Canvas.Compute(), in the applet's own order.
function appletCompute(a, b, c) {
  const i = appletIncenter(a, b, c);
  const circle = appletCircle(a, b, i);
  const xh = geoIntersect({ a: a, b: c }, circle);
  const yh = geoIntersect({ a: b, b: c }, circle);
  const jh = geoIntersect({ a: c, b: i }, circle);
  if (!xh || !yh || !jh) return null;
  return {
    I: i, circle: circle, xh: xh, yh: yh, jh: jh,
    X: other(xh, a), Y: other(yh, b), J: other(jh, i),
  };
}

/* ------------------------------------------------------------- test cases */

const named = [
  ["applet start", C.start({}).A, C.start({}).B, C.start({}).C],
  ["tall", P(120, 40), P(110, 265), P(320, 170)],
  ["flat", P(60, 90), P(350, 240), P(200, 70)],
  ["obtuse", P(70, 250), P(360, 250), P(95, 60)],
  ["scalene", P(48, 205), P(350, 268), P(180, 30)],
  ["upside down", P(210, 260), P(80, 45), P(330, 70)],
  ["left leaning", P(45, 120), P(300, 260), P(360, 55)],
  ["small", P(120, 120), P(180, 200), P(235, 110)],
  ["equilateral (red herring)", P(200, 220 - Math.sqrt(3) / 2 * 200), P(100, 220), P(300, 220)],
  ["almost equal sides", P(200, 47.1), P(100, 220), P(300, 220)],
];

const rand = rng(20261126);
const cases = named.map(([name, a, b, c]) => ({ name, a, b, c }));
for (let i = 0; i < 260; i++) {
  let a, b, c;
  do {
    a = P(20 + rand() * 360, 20 + rand() * 260);
    b = P(20 + rand() * 360, 20 + rand() * 260);
    c = P(20 + rand() * 360, 20 + rand() * 260);
  } while (dist(a, b) < 60 || dist(a, c) < 60 || dist(b, c) < 60 ||
           Math.abs(cross(sub(b, a), sub(c, a))) < 3000);
  cases.push({ name: `random-${i}`, a, b, c });
}

/* --------------------------------------------------------- 1. state & moves */

{
  const s = C.start({});
  check("start uses the applet's -1.6, -4.0, -0.2 angles at radius 75",
    same(s.A, P(200 + 75 * Math.cos(-1.6), 150 + 75 * Math.sin(-1.6))) &&
    same(s.B, P(200 + 75 * Math.cos(-4), 150 + 75 * Math.sin(-4))) &&
    same(s.C, P(200 + 75 * Math.cos(-0.2), 150 + 75 * Math.sin(-0.2))));
  check("start has the applet's four show options, names on",
    s.options.names && !s.options.statement && !s.options.premises && !s.options.hint);
  check("the starting triangle has a construction", !!C.geometry(s));
  check("a picture has no win, loss or end", C.result(s) === null);
  check("an unknown handle is refused", C.move(s, "Z", P(1, 1)) === s);
  check("a non-finite drag is refused", C.move(s, "A", P(NaN, 1)) === s);
  const moved = C.move(s, "C", P(500, -20));
  check("a drag is clamped inside the board",
    moved.C.x === 400 - C.PAD && moved.C.y === C.PAD && moved.explored);
  check("other points survive a drag unchanged", same(moved.A, s.A) && same(moved.B, s.B));
  check("an option toggle sets explored and keeps its value",
    C.setOption(s, "hint", true).options.hint === true &&
    C.setOption(s, "hint", true).explored === true);
  check("an unknown option is refused", C.setOption(s, "score", true) === s);
  check("reset restores the start but keeps explored",
    same(C.reset(moved).C, s.C) && C.reset(moved).explored === true);
  check("status speaks about the cut lengths", /AX and BY/.test(C.describe(s)));
  check("status reports equality when 'statement' is on",
    /AX = BY/.test(C.describe(C.setOption(s, "statement", true))));
  check("status mentions the arcs when 'hint' is on",
    /arcs XA and YB/.test(C.describe(C.setOption(s, "hint", true))));
}

/* --------------------------------- 2. the core against bytecode, and claims */

let nearTangent = 0;
let outsideX = 0;
let insideX = 0;
let compared = 0;

for (const { name, a, b, c } of cases) {
  const g = C.compute(a, b, c);
  const ref = appletCompute(a, b, c);
  if (!g || !ref) {
    if (name === "equilateral (red herring)") {
      // Its cut is exactly tangent: rounding in the applet's quadratic makes
      // its discriminant slightly negative, so Java draws no X and Y there.
      check("equilateral: applet's quadratic declines the tangent, the core keeps it", !!g && !ref);
    } else {
      check(`${name}: both implementations decline the same degenerate triangle`, !g && !ref);
    }
    continue;
  }
  compared++;
  const tag = name;

  check(`${tag}: incenter matches FindIncenter`, same(g.I, ref.I, 1e-5));
  check(`${tag}: circle centre matches FindCircumcenter`, same(g.circle.c, ref.circle.c, 1e-5));
  check(`${tag}: circle radius is the mean of the three radii`,
    near(g.circle.r, ref.circle.r, 1e-5));
  check(`${tag}: X matches Intersect + Other`, same(g.X, ref.X, 1e-5));
  check(`${tag}: Y matches Intersect + Other`, same(g.Y, ref.Y, 1e-5));
  check(`${tag}: J matches Intersect + Other`, same(g.J, ref.J, 1e-5));

  const ix = idealOther(ref.xh, a);
  const iy = idealOther(ref.yh, b);
  const ij = idealOther(ref.jh, ref.I);
  check(`${tag}: true second crossing AX = BY`,
    near(dist(a, ix), dist(b, iy), 1e-6 * Math.max(1, dist(a, ix))),
    `${dist(a, ix)} vs ${dist(b, iy)}`);
  check(`${tag}: X lies on AC`, onLine(ix, a, c));
  check(`${tag}: Y lies on BC`, onLine(iy, b, c));
  check(`${tag}: J lies on CI`, onLine(ij, c, ref.I));
  check(`${tag}: X, Y and J lie on the circle`,
    onCircle(ix, ref.circle) && onCircle(iy, ref.circle) && onCircle(ij, ref.circle));

  // The chord XY is antiparallel to AB: the side angles are matched in reverse.
  const lineAngle = (u, v) => Math.acos(clamp(Math.abs(dot(u, v)) /
    (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)), -1, 1));
  check(`${tag}: XY is antiparallel to AB`,
    near(lineAngle(sub(iy, ix), sub(a, c)), lineAngle(sub(b, a), sub(b, c)), 1e-6));

  // The page's angle claim: angle BAX = angle BYX (up to the degenerate cut).
  const at = (v, p, q) => {
    const u = sub(p, v), w = sub(q, v);
    return Math.acos(clamp(dot(u, w) / (dist(v, p) * dist(v, q)), -1, 1));
  };
  const ang1 = at(a, b, ix), ang2 = at(iy, b, ix);
  check(`${tag}: angle BAX = angle BYX`,
    near(ang1, ang2, 1e-6) || near(ang1 + ang2, Math.PI, 1e-6),
    `${ang1} vs ${ang2}`);

  // The sibling applet's theorem, kept here to say how this one differs.
  check(`${tag}: circle centre lies on bisector CI`,
    Math.abs(cross(sub(ref.circle.c, c), sub(ref.I, c))) < 1e-5 * Math.max(1, dist(c, ref.I)));

  if (g.tX > 0 && g.tX < 1) insideX++; else outsideX++;

  // Faithfulness to the applet's 1px Other(), including where it is wrong.
  const shortestHit = Math.min(dist(ref.xh[0], a), dist(ref.xh[1], a),
                               dist(ref.yh[0], b), dist(ref.yh[1], b));
  const deviates = !same(g.X, ix, 1e-6) || !same(g.Y, iy, 1e-6);
  if (deviates) {
    nearTangent++;
    check(`${tag}: applet's 1px Other() keeps a near-tangent vertex`,
      shortestHit < 1 && same(g.X, ref.X, 1e-5) && same(g.Y, ref.Y, 1e-5));
  }
}

check("every generated triangle was compared", compared >= 260, `compared ${compared}`);
check("both configurations of X occur (inside and beyond AC)", insideX > 20 && outsideX > 20,
  `inside ${insideX}, outside ${outsideX}`);
check("near-tangent cases are rare and reported", nearTangent < compared / 10,
  `${nearTangent} of ${compared}`);

/* -------------------------------------------- 3. the page's red-herring case */

{
  const h = Math.sqrt(3) / 2 * 200;
  const g = C.compute(P(200, 220 - h), P(100, 220), P(300, 220));
  check("AC = BC gives X = A and Y = B, so AX = BY = 0",
    !!g && dist(g.X, P(200, 220 - h)) < 1e-4 &&
    dist(g.Y, P(100, 220)) < 1e-4 && g.ax < 1e-4 && g.by < 1e-4);
}

done("circle-through-incenter-2");
console.log(`     ${compared} triangles; ${insideX} with X on the side, ${outsideX} beyond it; ` +
            `${nearTangent} where the applet's 1px rule picks the vertex instead of the second cut`);
