#!/usr/bin/env node
"use strict";

/*
 * Logic test for angle-bisector-in-equilateral-trapezoid-core.js.
 *
 *   node porting/check-angle-bisector-in-equilateral-trapezoid.mjs
 *
 * Checks:
 *   1. the start position against the applet's own init() formulas;
 *   2. the two modes when a vertex is dragged (glide on the circle / adjust
 *      the circle), the mirror partner of a dragged vertex, and G clamped
 *      inside triangle BCD;
 *   3. the page's exact claim — PQRS is cyclic if and only if BG bisects
 *      angle CBD — on fixed and randomly generated isosceles trapezoids,
 *      with G both on and off the bisector;
 *   4. the angle-bisector theorem at the foot F on CD, and the connection
 *      between "BG bisects" and the applet's own hint gate |Q.x - O.x| < 1;
 *   5. a second, literal transcription of the applet's Compute(), GetCircle()
 *      and GeoSDoub.Intersect/IntersectX/FindCircumcenter from the bytecode,
 *      compared with the core on every generated configuration;
 *   6. the guards when two points are closer than 2 px.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "angle-bisector-in-equilateral-trapezoid/angle-bisector-in-equilateral-trapezoid-core.js",
  "AngleBisectorInEquilateralTrapezoidCore",
);

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

/* ------------------------- the applet's geometry, transcribed from bytecode */

/* GeoSDoub.Intersect(P1,P2,P3,P4): ax+by+c=0 form, |det| < 1 gives NaN. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindCircumcenter: two perpendicular bisectors, then Intersect. */
function appletCircumcenter(A, B, Cc) {
  const p3 = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const p4 = { x: (B.x + Cc.x) / 2, y: (B.y + Cc.y) / 2 };
  const p5 = { x: p3.x + (B.y - A.y), y: p3.y - (B.x - A.x) };
  const p6 = { x: p4.x + (Cc.y - B.y), y: p4.y - (Cc.x - B.x) };
  return appletIntersect(p3, p5, p4, p6);
}

/* The applet's GetCircle: mean of the three circumcenter-to-vertex distances. */
function appletGetCircle(A, B, Cc) {
  const c = appletCircumcenter(A, B, Cc);
  return { c, r: (dist(c, A) + dist(c, B) + dist(c, Cc)) / 3 };
}

/* GeoSDoub.IntersectX(IntersectY): solve x = a*y+b (y = a*x+b) on the circle. */
function appletIntersectLineCircle(circle, P1, P2) {
  const dy = Math.abs(P1.y - P2.y), dx = Math.abs(P1.x - P2.x);
  if (dy > 1) {
    const a = (P1.x - P2.x) / (P1.y - P2.y);
    const b = P2.x - a * P2.y;
    const q = a * (b - circle.c.x) - circle.c.y;
    const A2 = 1 + a * a, B2 = 2 * q;
    const C2 = circle.c.y * circle.c.y + (b - circle.c.x) ** 2 - circle.r * circle.r;
    const disc = B2 * B2 - 4 * A2 * C2;
    if (disc < 0) return [];
    const root = Math.sqrt(disc);
    const y1 = (-B2 + root) / (2 * A2), y2 = (-B2 - root) / (2 * A2);
    return [{ x: a * y1 + b, y: y1 }, { x: a * y2 + b, y: y2 }];
  }
  if (dx > 1) {
    const a = (P1.y - P2.y) / (P1.x - P2.x);
    const b = P2.y - a * P2.x;
    const q = a * (circle.c.x) + b - circle.c.y;
    const A2 = 1 + a * a, B2 = 2 * q;
    const C2 = circle.c.x * circle.c.x + (b - circle.c.y) ** 2 - circle.r * circle.r;
    const disc = B2 * B2 - 4 * A2 * C2;
    if (disc < 0) return [];
    const root = Math.sqrt(disc);
    const x1 = (-B2 + root) / (2 * A2), x2 = (-B2 - root) / (2 * A2);
    return [{ x: x1, y: a * x1 + b }, { x: x2, y: a * x2 + b }];
  }
  return [];
}

/* The canvas's Other(): return points[0] unless it is the known point. */
function appletOther(points, known) {
  if (!points || !points.length) return null;
  if (points.length === 1) return points[0];
  return dist(points[0], known) >= 1 ? points[0] : points[1];
}

/* AngleBisectorInEquilateralTrapezoidCanvas.Compute(), statement by statement. */
function appletCompute(state, showHint) {
  const { A, B, C, D, G } = state;
  const mins = [dist(A, B), dist(B, C), dist(C, D),
    dist(G, B), dist(G, A), dist(G, C), dist(G, D)];
  if (mins.some((d) => d < 2)) return { valid: false };

  const circle = appletGetCircle(A, B, C);
  const parallel = { x: G.x + 100 * (A.x - B.x), y: G.y + 100 * (A.y - B.y) };
  const P = appletOther(appletIntersectLineCircle(circle, A, G), A);
  const R = appletIntersect(B, D, G, parallel);
  const S = appletIntersect(B, C, G, parallel);
  const Q = appletOther(appletIntersectLineCircle(circle, B, G), B);
  const circleG = appletGetCircle(Q, P, S);
  const T = appletIntersect(C, D, B, Q);
  const finished = Math.abs(Q.x - circle.c.x) < 1;
  return {
    valid: true, circle, circleG, P, Q, R, S, T, finished,
    // Compute() sets Finished = (|Q.x - O.x| < 1) and calls
    // ShowHint.setEnabled(Finished); the checkbox's own state is separate.
    hintEnabled: Boolean(showHint) && finished,
  };
}

/* ----------------------------------------- test data: many trapezoids */

function trapezoid(cx, cy, r, topY, bottomY) {
  const a = Math.sqrt(Math.max(0, r * r - (topY - cy) ** 2));
  const b = Math.sqrt(Math.max(0, r * r - (bottomY - cy) ** 2));
  return {
    A: { x: cx - a, y: topY },
    B: { x: cx + a, y: topY },
    C: { x: cx + b, y: bottomY },
    D: { x: cx - b, y: bottomY },
    G: { x: cx, y: (topY + bottomY) / 2 },
    options: { names: true, hint: false, mode: "circle" },
    explored: false,
  };
}

const random = rng(2009);
const cases = [];
for (let i = 0; i < 500; i++) {
  const cx = 200 + (random() - 0.5) * 80;
  const cy = 140 + (random() - 0.5) * 60;
  const r = 85 + random() * 45;
  const topY = cy + (random() - 0.5) * r * 1.7;
  let bottomY = cy + (random() - 0.5) * r * 1.7;
  if (Math.abs(topY - bottomY) < 24) bottomY = cy - (topY - cy);
  const s = trapezoid(cx, cy, r, topY, bottomY);
  if (Math.abs(topY - cy) >= r || Math.abs(bottomY - cy) >= r) continue;
  cases.push(s);
}

function pointClose(label, actual, expected, tol) {
  check(label, finite(actual) && finite(expected) &&
    Math.abs(actual.x - expected.x) < tol && Math.abs(actual.y - expected.y) < tol,
  finite(actual) && finite(expected)
    ? `got (${actual.x}, ${actual.y}), expected (${expected.x}, ${expected.y})`
    : "a point is not finite");
}

/* ------------------------------------------------------ 1. the start */

{
  const s = C.start({});
  equal("start A from init() at 400x280", s.A, { x: 120, y: 168 });
  equal("start B from init() at 400x280", s.B, { x: 280, y: 168 });
  equal("start C from init() at 400x280", s.C, { x: 240, y: 280 / 3 });
  equal("start D from init() at 400x280", s.D, { x: 160, y: 280 / 3 });
  equal("start G is the barycentre of B, C, D", s.G, {
    x: (s.B.x + s.C.x + s.D.x) / 3,
    y: (s.B.y + s.C.y + s.D.y) / 3,
  });
  equal("the applet starts in Move points mode", s.options.mode, "circle");
  check("a fresh diagram is not yet explored", C.result(s) === null);
  const g = C.geometry(s);
  check("the starting trapezoid can be drawn", g.valid);
  check("the four start vertices are concyclic", ["A", "B", "C", "D"].every(
    (n) => Math.abs(C.dist(g.circle.c, s[n]) - g.circle.r) < 1e-9));
  check("the start is an isosceles trapezoid", Math.abs(
    C.dist(s.A, s.D) - C.dist(s.B, s.C)) < 1e-9 && s.A.y === s.B.y && s.C.y === s.D.y);
  check("the start is not on the bisector", !C.claims(s).bisects);
}

/* --------------------------------- 2. dragging: modes, mirror and G clamp */

{
  const s = C.start({});
  const g = C.geometry(s);
  const moved = C.withPoint(s, "A", { x: 90, y: 150 });
  check("withPoint leaves the old position alone", s.A.x === 120 && s.A.y === 168);
  check("withPoint returns a fresh object", moved !== s && moved.B !== s.B);
  check("dragging A mirrors B", Math.abs(moved.B.x + moved.A.x - moved.C.x - moved.D.x) < 1e-9 &&
    moved.B.y === moved.A.y);
  const gm = C.geometry(moved);
  check("Move points keeps the dragged vertex on the circle",
    gm.valid && Math.abs(C.dist(gm.circle.c, moved.A) - gm.circle.r) < 1e-8);
  check("Move points keeps the mirror vertex on the circle",
    gm.valid && Math.abs(C.dist(gm.circle.c, moved.B) - gm.circle.r) < 1e-8);
  check("the two bases stay parallel after a drag", moved.A.y === moved.B.y && moved.C.y === moved.D.y);

  const free = C.withPoint(C.setOption(s, "mode", "free"), "C", { x: 265, y: 60 });
  const gf = C.geometry(free);
  check("Adjust circle lets a vertex leave the old circle",
    gf.valid && Math.abs(C.dist(g.circle.c, free.C) - g.circle.r) > 1);
  check("Adjust circle still gives a cyclic isosceles trapezoid",
    gf.valid && ["A", "B", "C", "D"].every(
      (n) => Math.abs(C.dist(gf.circle.c, free[n]) - gf.circle.r) < 1e-8));
  check("dragging C mirrors D", Math.abs(free.D.x + free.C.x - free.A.x - free.B.x) < 1e-9 &&
    free.D.y === free.C.y);

  const outside = C.withPoint(s, "G", { x: 1000, y: -1000 });
  check("G is clamped inside triangle BCD", (() => {
    const { B, C: Cc, D } = outside;
    const sign = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const a = sign(B, Cc, outside.G), b = sign(Cc, D, outside.G), c = sign(D, B, outside.G);
    return (a > 0 && b > 0 && c > 0) || (a < 0 && b < 0 && c < 0);
  })());
  check("an unknown handle leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
  check("setOption does not mutate the old options",
    C.setOption(s, "hint", true).options.hint === true && s.options.hint === false);
  check("reset restores the start but keeps the options", (() => {
    const r = C.reset(C.setOption(moved, "mode", "free"));
    return r.A.x === 120 && r.G.x === s.G.x && r.options.mode === "free";
  })());
}

/* ------------------------------- 3. the theorem on fixed configurations */

{
  const fixed = [
    ["start", C.start({})],
    ...cases.slice(0, 8).map((s, i) => [`trapezoid ${i}`, s]),
  ];
  for (const [name, base] of fixed) {
    for (const t of [0.25, 0.55, 0.8]) {
      const s = C.placeOnBisector(base, t);
      const cl = C.claims(s);
      check(`${name} t=${t}: BG bisects CBD`, cl.valid && cl.bisects);
      check(`${name} t=${t}: PQRS is cyclic`, cl.valid && cl.cyclic &&
        Math.abs(cl.cyclicResidual) < C.CYCLE_TOL);
      check(`${name} t=${t}: Q is over the circle centre`, cl.qOffset < 1);
    }
    const off = C.placeOffBisector(base);
    const cl = C.claims(off);
    check(`${name}: centroid of BCD is off the bisector`, cl.valid && !cl.bisects && !cl.cyclic);
    check(`${name}: the iff holds off the bisector`, cl.valid && cl.iff);
  }
}

/* ------------------------------- 4. angle-bisector theorem and the gate */

{
  const s = C.placeOnBisector(C.start({}), 0.5);
  const F = C.bisectorFoot(s);
  const ratio1 = C.dist(s.C, F) / C.dist(F, s.D);
  const ratio2 = C.dist(s.C, s.B) / C.dist(s.D, s.B);
  check("F splits CD as CB:BD", Math.abs(ratio1 - ratio2) < 1e-9);
  check("F lies on CD", Math.abs(F.y - s.C.y) < 1e-9 &&
    F.x >= Math.min(s.C.x, s.D.x) - 1e-9 && F.x <= Math.max(s.C.x, s.D.x) + 1e-9);
  const cl = C.claims(s);
  check("the two halves of angle CBD agree", Math.abs(cl.angleCBG - cl.angleGBD) < C.ANGLE_TOL);
  check("the applet's hint gate opens on the bisector", cl.finished && cl.qOffset < 1);
  const off = C.claims(C.placeOffBisector(C.start({})));
  check("the applet's hint gate stays shut off the bisector", !off.finished && off.qOffset >= 1);
}

/* ---------------------------- 5. the core against the applet's Compute() */

let compared = 0;
let skipped = 0;
let leastOffCyclicResidual = Infinity;
for (let i = 0; i < cases.length; i++) {
  const base = cases[i];
  const variants = [
    ["bisector 0.3", C.placeOnBisector(base, 0.3)],
    ["bisector 0.7", C.placeOnBisector(base, 0.7)],
    ["centroid", C.placeOffBisector(base)],
  ];
  for (const [which, s] of variants) {
    const core = C.geometry(s);
    const applet = appletCompute(s, s.options.hint);
    if (!core.valid || !applet.valid || !finite(applet.P) || !finite(applet.Q) ||
        !finite(applet.R) || !finite(applet.S) || !finite(applet.T) ||
        !finite(applet.circle.c)) {
      skipped++;
      continue;
    }
    compared++;
    const tag = `${which} #${i}`;
    pointClose(`${tag}: circumcentre`, core.circle.c, applet.circle.c, 1e-5);
    check(`${tag}: radius`, Math.abs(core.circle.r - applet.circle.r) < 1e-5);
    pointClose(`${tag}: P`, core.P, applet.P, 1e-4);
    pointClose(`${tag}: Q`, core.Q, applet.Q, 1e-4);
    pointClose(`${tag}: R`, core.R, applet.R, 1e-4);
    pointClose(`${tag}: S`, core.S, applet.S, 1e-4);
    pointClose(`${tag}: T`, core.T, applet.T, 1e-4);
    check(`${tag}: the hint gate matches`, core.finished === applet.finished);

    const cl = C.claims(s);
    check(`${tag}: the iff holds`, cl.valid && cl.iff,
      `bisects=${cl.bisects}, cyclic=${cl.cyclic}, residual=${cl.cyclicResidual}`);
    if (cl.bisects && cl.diff > 1e-8) {
      check(`${tag}: true bisectors stay within tolerance`, cl.diff < C.ANGLE_TOL);
    }
    if (!cl.bisects && cl.diff > 1e-3) {
      leastOffCyclicResidual = Math.min(leastOffCyclicResidual, Math.abs(cl.cyclicResidual));
      check(`${tag}: off the bisector the residual is clear`, Math.abs(cl.cyclicResidual) > C.CYCLE_TOL);
    }
  }
}
check("enough configurations were compared", compared > 400, `compared ${compared}`);
check("a few degenerate configurations were skipped, not silently accepted", skipped < compared / 4);
check("the cyclic test has a clear margin away from the bisector",
  leastOffCyclicResidual > C.CYCLE_TOL * 10, `least residual ${leastOffCyclicResidual}`);

/* ------------------------------------------------- 6. the applet's guards */

{
  const s = C.start({});
  const tooClose = Object.assign({}, s, { B: { x: s.A.x + 1, y: s.A.y } });
  check("a pair closer than 2 px is not drawn", !C.geometry(tooClose).valid);
  check("claims on an unpaintable diagram are false", !C.claims(tooClose).valid);
  check("the guard checks G against B", !C.geometry(Object.assign({}, s, {
    G: { x: s.B.x + 1, y: s.B.y },
  })).valid);
  check("the guards leave the description useful",
    typeof C.describe(tooClose) === "string" && C.describe(tooClose).length > 10);
}

done("angle-bisector-in-equilateral-trapezoid");
