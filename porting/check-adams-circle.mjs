#!/usr/bin/env node
"use strict";

/*
 * Logic test for adams-circle/adams-circle-core.js.
 *
 *   node porting/check-adams-circle.mjs
 *
 * Checks the page's claim over many triangles: the six points P, Q, R, S,
 * T, U are concyclic, their circle is centred at the incenter I, and the six
 * tangent lengths DP, DQ, ER, ES, FT, FU are equal. It also checks the hint
 * construction (X, Y, M, N, the midpoints) and compares every point with a
 * second transcription of the applet's own ComputePoints() method, taken
 * literally from the bytecode of AdamsCircleCanvas and GeoSDoub.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("adams-circle/adams-circle-core.js", "AdamsCircleCore");

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  check("a new position has three points on the board",
    [s.A, s.B, s.C].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= 0 && p.x <= C.VIEW.width && p.y >= 0 && p.y <= C.VIEW.height));
  const area = Math.abs((s.B.x - s.A.x) * (s.C.y - s.A.y) - (s.B.y - s.A.y) * (s.C.x - s.A.x));
  check("the starting triangle is not flat", area > 5000, `twice the area is ${area}`);
  check("an illustration has no win or loss", C.result(s) === null);
  check("all six applet display options are present",
    Object.keys(s.options).length === 6 &&
    Object.values(s.options).every((v) => typeof v === "boolean"));

  const moved = C.moveVertex(s, "A", { x: 9000, y: -20 });
  check("dragging a vertex clamps to the board",
    moved.A.x === C.VIEW.width - 18 && moved.A.y === 18);
  check("moving a vertex does not change the old position",
    s.A.x === C.START.A.x && s.touches === 0 && moved.touches === 1);
  check("an unknown vertex or a bad point is ignored",
    C.moveVertex(s, "Z", { x: 1, y: 1 }) === s &&
    C.moveVertex(s, "A", { x: NaN, y: 3 }) === s);
  check("an option can be switched without touching the points",
    C.setOption(s, "hint", true).options.hint === true &&
    C.setOption(s, "hint", true).A === s.A &&
    C.setOption(s, "missing", true) === s);

  // The applet's init() spread its vertices around a circle with random angles.
  let spreadMin = Infinity;
  for (let i = 0; i < 300; i++) {
    const r = C.randomStart(rng(i + 1));
    const g = C.geometry(r);
    if (g.valid) {
      const rs = C.radii(g);
      spreadMin = Math.min(spreadMin, Math.max(...rs) - Math.min(...rs));
    }
  }
  check("every random start is a usable, non-flat triangle", Number.isFinite(spreadMin));
}

/* ------------------------------------------- 2. the page's claims, in bulk */

const exact = [
  [[280, 95], [90, 200], [100, 60]],                 // the starting triangle
  [[180, 40], [60, 220], [300, 220]],                // near equilateral
  [[40, 40], [320, 40], [40, 220]],                  // right angle at A
  [[60, 220], [300, 220], [180, 50]],                // isosceles at C
  [[30, 130], [330, 130], [165, 137]],               // very flat
  [[40, 30], [320, 70], [200, 230]],                 // scalene, obtuse
  [[180, 30], [175, 230], [330, 120]],               // one almost vertical side
];
const rand = rng(20261126);
const triangles = [];
for (const [a, b, c] of exact) {
  triangles.push([{ x: a[0], y: a[1] }, { x: b[0], y: b[1] }, { x: c[0], y: c[1] }]);
}
for (let i = 0; i < 600; i++) {
  triangles.push([
    { x: 12 + rand() * 336, y: 12 + rand() * 236 },
    { x: 12 + rand() * 336, y: 12 + rand() * 236 },
    { x: 12 + rand() * 336, y: 12 + rand() * 236 },
  ]);
}
const geometries = [];
let skipped = 0;
for (const [A, B, C0] of triangles) {
  const twiceArea = Math.abs((B.x - A.x) * (C0.y - A.y) - (B.y - A.y) * (C0.x - A.x));
  if (twiceArea < 2000) { skipped++; continue; }
  const g = C.geometry({ A, B, C: C0 });
  if (g.valid) geometries.push(g);
}
check("the sample covers many non-degenerate triangles", geometries.length >= 500,
  `${geometries.length} used, ${skipped} flat ones skipped`);

const worst = (fn) => geometries.reduce((m, g) => Math.max(m, fn(g)), 0);
const near = (v, limit = 1e-6) => Number.isFinite(v) && v < limit;

{
  // Page: "Six points P, Q, R, S, T, U are always concyclic. Moreover, the
  // circle they lie on is centred at the incenter."
  const spread = worst(C.circleError);
  check("all six points are the same distance from I in every triangle",
    near(spread), `largest spread ${spread}`);

  const centre = worst(C.centerError);
  check("the circle through S,U,Q is centred at the incenter",
    near(centre), `largest centre error ${centre}`);

  const radiusError = worst((g) => {
    const rs = C.radii(g);
    return Math.abs(g.circle.radius - rs.reduce((a, b) => a + b, 0) / rs.length);
  });
  check("the applet's circle radius is the common six-point radius",
    near(radiusError), `largest radius error ${radiusError}`);

  // The page's proof: the six tangent segments are all equal.
  const lengths = worst((g) => {
    const l = C.tangentLengths(g);
    return Math.max(...l) - Math.min(...l);
  });
  check("DP, DQ, ER, ES, FT and FU are equal in every triangle",
    near(lengths), `largest spread ${lengths}`);

  const dpq = worst((g) => Math.abs(C.dist(g.D, g.P) - C.dist(g.D, g.Q)));
  const ers = worst((g) => Math.abs(C.dist(g.E, g.R) - C.dist(g.E, g.S)));
  const ftu = worst((g) => Math.abs(C.dist(g.F, g.T) - C.dist(g.F, g.U)));
  check("page (3): DP = DQ", near(dpq), `largest error ${dpq}`);
  check("ER = ES", near(ers), `largest error ${ers}`);
  check("FT = FU", near(ftu), `largest error ${ftu}`);

  const erfu = worst((g) => Math.abs(C.dist(g.E, g.R) - C.dist(g.F, g.U)));
  const dqft = worst((g) => Math.abs(C.dist(g.D, g.Q) - C.dist(g.F, g.T)));
  const dpes = worst((g) => Math.abs(C.dist(g.D, g.P) - C.dist(g.E, g.S)));
  check("page (1): ER = FU", near(erfu), `largest error ${erfu}`);
  check("DQ = FT", near(dqft), `largest error ${dqft}`);
  check("DP = ES", near(dpes), `largest error ${dpes}`);

  // The hint in Draw(): X,A,Y and M,A,N are midpoints; MX = DP, NY = DQ.
  const midXY = worst((g) => C.dist({ x: (g.X.x + g.Y.x) / 2, y: (g.X.y + g.Y.y) / 2 }, g.A));
  const midMN = worst((g) => C.dist({ x: (g.M.x + g.N.x) / 2, y: (g.M.y + g.N.y) / 2 }, g.A));
  check("page: A is the midpoint of XY", near(midXY), `largest error ${midXY}`);
  check("page: A is the midpoint of MN", near(midMN), `largest error ${midMN}`);

  const mx = worst((g) => Math.abs(C.dist(g.X, g.M) - C.dist(g.D, g.P)));
  const ny = worst((g) => Math.abs(C.dist(g.Y, g.N) - C.dist(g.D, g.Q)));
  check("page (2): MX = DP", near(mx), `largest error ${mx}`);
  check("NY = DQ", near(ny), `largest error ${ny}`);

  const axay = worst((g) => Math.abs(C.dist(g.A, g.X) - C.dist(g.A, g.Y)));
  const aetang = worst((g) => Math.abs(C.dist(g.A, g.E) - C.dist(g.A, g.F)));
  check("AX = AY, the two halves of XY", near(axay), `largest error ${axay}`);
  check("AE = AF, the tangents from A", near(aetang), `largest error ${aetang}`);

  // The touch points are the pedal points of I, and G lies on all three
  // cevians (the page calls it the Gergonne point).
  const feet = worst((g) => Math.max(
    Math.abs((g.D.x - g.I.x) * (g.B.x - g.C.x) + (g.D.y - g.I.y) * (g.B.y - g.C.y)),
    Math.abs((g.E.x - g.I.x) * (g.C.x - g.A.x) + (g.E.y - g.I.y) * (g.C.y - g.A.y)),
    Math.abs((g.F.x - g.I.x) * (g.A.x - g.B.x) + (g.F.y - g.I.y) * (g.A.y - g.B.y)),
  ));
  check("D, E, F are the feet of the perpendiculars from I", near(feet, 1e-7), `largest dot product ${feet}`);

  const collinear = worst((g) => Math.abs(
    (g.G.x - g.C.x) * (g.F.y - g.C.y) - (g.G.y - g.C.y) * (g.F.x - g.C.x)));
  check("G also lies on CF (Gergonne point)", near(collinear, 1e-6), `largest cross product ${collinear}`);

  const parallel = worst((g) => {
    const cross = (a, b, c, d) =>
      Math.abs((b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x));
    return Math.max(
      cross(g.U, g.R, g.E, g.F), cross(g.T, g.Q, g.F, g.D), cross(g.S, g.P, g.D, g.E));
  });
  check("UR, TQ and SP are parallel to EF, FD and DE", near(parallel, 1e-6));
}

/* ----------------------------- 3. the applet's own construction, again */

// Literal transcription of AdamsCircleCanvas.ComputePoints() with the helper
// methods of GeoSDoub (javap -c -p on classes/AdamsCircle.zip,
// classes/CTKGeometry.zip and classes/GeoSDoub.class in classes.zip).
function sqDist(p, q) {
  return (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
}
function appletDist(p, q) {
  return Math.sqrt(sqDist(p, q));
}
function computeAngle(p, q, r) {
  const c = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) /
    (2 * appletDist(p, q) * appletDist(p, r));
  return Math.acos(c);
}
function findOrientation(p, q, r) {
  const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return v > 0 ? 1 : -1;
}
function rotate(p, q, angle, dir) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    x: p.x + c * (q.x - p.x) - dir * s * (q.y - p.y),
    y: p.y + dir * s * (q.x - p.x) + c * (q.y - p.y),
  };
}
function findIncenter(A, B, C) {
  const halfA = computeAngle(A, B, C) / 2;
  const halfB = computeAngle(B, C, A) / 2;
  const dir = findOrientation(A, B, C);
  return intersect(rotate(A, B, halfA, dir), A, rotate(B, C, halfB, dir), B);
}
function nearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (sqDist(a, p) < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
function intersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN }; // GeoSDoub returns NaN
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}
function getParallelTo(p, q, r) {
  // GeoSDoub.GetParallelTo uses a 100-unit step along q->r.
  return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
}
function findCircumcenter(p, q, r) {
  const m1 = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const m2 = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
  return intersect(m1, { x: m1.x + q.y - p.y, y: m1.y - (q.x - p.x) },
    m2, { x: m2.x + r.y - q.y, y: m2.y - (r.x - q.x) });
}
function getCircle(p, q, r) {
  const centre = findCircumcenter(p, q, r);
  return {
    center: centre,
    radius: (appletDist(centre, p) + appletDist(centre, q) + appletDist(centre, r)) / 3,
  };
}
function appletPoints(A, B, Cc) {
  const I = findIncenter(A, B, Cc);
  const D = nearestPoint(I, B, Cc);
  const E = nearestPoint(I, Cc, A);
  const F = nearestPoint(I, A, B);
  const G = intersect(A, D, B, E);
  const lEF = getParallelTo(G, E, F);
  const lFD = getParallelTo(G, F, D);
  const lDE = getParallelTo(G, D, E);
  const U = intersect(lEF, G, A, B);
  const R = intersect(lEF, G, A, Cc);
  const T = intersect(lFD, G, A, B);
  const Q = intersect(lFD, G, B, Cc);
  const S = intersect(lDE, G, A, Cc);
  const P = intersect(lDE, G, B, Cc);
  const circle = getCircle(S, U, Q);
  const lBC = getParallelTo(A, B, Cc);
  const X = intersect(lBC, A, D, E);
  const Y = intersect(lBC, A, D, F);
  const M = intersect(X, Y, P, S);
  const N = intersect(X, Y, Q, T);
  return { I, D, E, F, G, P, Q, R, S, T, U, circle, X, Y, M, N };
}

function maxPointError(a, b) {
  return Number.isFinite(a.x) && Number.isFinite(b.x)
    ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : Infinity;
}

{
  const names = ["I", "D", "E", "F", "G", "P", "Q", "R", "S", "T", "U", "X", "Y", "M", "N"];
  const errors = Object.fromEntries(names.concat(["circleCenter", "circleRadius", "inradius"]).map((k) => [k, 0]));
  let compared = 0;
  for (const g of geometries) {
    const a = appletPoints(g.A, g.B, g.C);
    for (const name of names) errors[name] = Math.max(errors[name], maxPointError(g[name], a[name]));
    errors.circleCenter = Math.max(errors.circleCenter, maxPointError(g.circle.center, a.circle.center));
    errors.circleRadius = Math.max(errors.circleRadius, Math.abs(g.circle.radius - a.circle.radius));
    const r = (appletDist(a.I, nearestPoint(a.I, g.A, g.B)) +
      appletDist(a.I, nearestPoint(a.I, g.B, g.C)) +
      appletDist(a.I, nearestPoint(a.I, g.C, g.A))) / 3;
    errors.inradius = Math.max(errors.inradius, Math.abs(g.radius - r));
    compared++;
  }
  check("every sample was compared with the applet's method", compared === geometries.length);
  for (const name of names) {
    check(`applet's ${name} matches the core in all ${compared} triangles`,
      near(errors[name], 1e-6), `largest error ${errors[name]}`);
  }
  check("applet's circumcenter of S,U,Q matches the core", near(errors.circleCenter, 1e-6),
    `largest error ${errors.circleCenter}`);
  check("applet's Adams-circle radius matches the core", near(errors.circleRadius, 1e-6),
    `largest error ${errors.circleRadius}`);
  check("applet's GetInCircle radius matches the core", near(errors.inradius, 1e-6),
    `largest error ${errors.inradius}`);
}

done("adams-circle");
