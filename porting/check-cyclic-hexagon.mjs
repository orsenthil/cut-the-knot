#!/usr/bin/env node
"use strict";

/*
 * Logic test for cyclic-hexagon/cyclic-hexagon-core.js.
 *
 *   node porting/check-cyclic-hexagon.mjs
 *
 * The page claims (1) k0*k1*k2 = l0*l1*l2, (3) that product =
 * 8*prod R(P_i)*prod R(Q_i)/R^3, (4) that it is the product of the six
 * hexagon sides divided by D^3, (5) the two-circle chord lemma, and that the
 * statement extends to two n-gons with n >= 3. All are checked over thousands
 * of random configurations, including points in any order on the circle.
 * The page's intermediate formula (2), printed with Q_{i+1}/P_{i+1}, is
 * checked honestly: with the applet's indexing it needs Q_{i-1}/P_{i-1}.
 * A second, literal transcription of the applet's Compute() (including
 * GeoSDoub.NearestPoint with its 0.1 early return, FindCircumcenter via two
 * perpendicular bisectors and GetCircumcircle's averaged radius) is compared
 * with the core over the whole space of six angles.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cyclic-hexagon/cyclic-hexagon-core.js", "CyclicHexagonCore");
const rand = rng(20261127);
const TAU = C.TAU;
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(a), Math.abs(b));
const onCircle = (a, R, o) => ({ x: o.x + R * Math.cos(a), y: o.y + R * Math.sin(a) });
const mod = (i, n) => (i % n + n) % n;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
function foot(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return { x: p.x, y: p.y };
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const prod = (xs) => xs.reduce((a, b) => a * b, 1);

/* ------------------- a second transcription of the applet's own methods --- */

/* GeoSDoub.Intersect(a,b,c,d), straight from javap. */
function javaIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return {
    x: (b1 * c2 - b2 * c1) / den,
    y: (c1 * a2 - c2 * a1) / den,
  };
}

/* GeoSDoub.FindCircumcenter(a,b,c). */
function javaCircumcenter(a, b, c) {
  const mAB = mid(a, b), mBC = mid(b, c);
  const p = { x: mAB.x + (b.y - a.y), y: mAB.y - (b.x - a.x) };
  const q = { x: mBC.x + (c.y - b.y), y: mBC.y - (c.x - b.x) };
  return javaIntersect(mAB, p, mBC, q);
}

/* CyclicHexagonCanvas.GetCircumcircle(): centre from FindCircumcenter, radius
   the mean of the three distances to it (not simply half the side). */
function javaCircumcircle(a, b, c) {
  const centre = javaCircumcenter(a, b, c);
  const radius = (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3;
  return { center: centre, radius: radius };
}

/* CyclicHexagonCanvas.Compute(), with the same two loops and index modulo. */
function javaCompute(state) {
  const n = 3, A = state.A, B = state.B;
  const K = [], L = [], P = [], Q = [];
  const circleA = [], circleB = [], circleOA = [], circleOB = [];
  for (let i = 0; i < n; i++) {
    K[i] = foot(A[i], B[(i + 1) % n], B[(i + n - 1) % n]);
    L[i] = foot(B[i], A[(i + 1) % n], A[(i + n - 1) % n]);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    circleA[i] = javaCircumcircle(A[i], B[j], K[i]);
    circleB[i] = javaCircumcircle(B[i], A[j], L[i]);
    circleOA[i] = { center: mid(A[i], state.center), radius: state.radius / 2 };
    circleOB[i] = { center: mid(B[i], state.center), radius: state.radius / 2 };
    P[i] = mid(A[i], B[j]);
    Q[i] = mid(B[i], A[j]);
  }
  return { K: K, L: L, P: P, Q: Q, circleA: circleA, circleB: circleB,
           circleOA: circleOA, circleOB: circleOB };
}

function stateFromAngles(aa, bb) {
  let s = C.start({});
  for (let i = 0; i < 3; i++) {
    s = C.movePoint(s, "A" + i, onCircle(aa[i], C.RADIUS, C.CENTER));
    s = C.movePoint(s, "B" + i, onCircle(bb[i], C.RADIUS, C.CENTER));
  }
  return s;
}

/* ------------------------------------------------- 1. the applet's start up */

{
  const s = C.start({});
  equal("the board is the applet's 480 by 420 canvas", { WIDTH: C.WIDTH, HEIGHT: C.HEIGHT }, { WIDTH: 480, HEIGHT: 420 });
  equal("the circle is at the canvas centre", s.center, { x: 240, y: 210 });
  check("the radius is min(width/3, height/3)", s.radius === 140 && C.RADIUS === 140);
  check("all six points lie on that circle", s.A.concat(s.B).every((p) => Math.abs(dist(p, s.center) - 140) < 1e-9));
  check("A0 starts at angle 0", Math.abs(s.A[0].x - 380) < 1e-9 && Math.abs(s.A[0].y - 210) < 1e-9);
  check("A vertices start spaced by 120 degrees", [0, 1, 2].every((i) =>
    Math.abs((Math.atan2(s.A[i].y - s.center.y, s.A[i].x - s.center.x) + TAU) % TAU - i * TAU / 3) < 1e-9));
  check("each B vertex starts opposite its A vertex", [0, 1, 2].every((i) => dist(s.A[i], s.B[i]) > 279.9));
  check("the three panel checkboxes start off, as in the first applet on the page",
    !s.showNames && !s.showCircles1 && !s.showCircles2);
  check("an illustration never ends", C.result(s) === null && C.result(s) === null);
  check("the status reports both products and the side formula",
    /k0·k1·k2 =/.test(C.describe(s)) && /l0·l1·l2 =/.test(C.describe(s)) && /D³/.test(C.describe(s)));
  const g = C.compute(s);
  check("the starting products agree", rel(g.kProduct, g.lProduct) < 1e-10);
}

/* ------------------------------------------------- 2. dragging and options */

{
  const s = C.start({});
  const moved = C.movePoint(s, "A1", { x: 300, y: 400 });
  check("a dragged point is projected back onto the circle", Math.abs(dist(moved.A[1], moved.center) - 140) < 1e-9);
  check("dragging does not move the other five points",
    moved.A[0] === s.A[0] && moved.A[2] === s.A[2] && moved.B.every((p, i) => p === s.B[i]));
  check("the starting position is not changed", s.A[1].x !== moved.A[1].x);
  check("an unknown handle, a non-finite point and the circle centre are ignored",
    C.movePoint(s, "C0", { x: 1, y: 1 }) === s &&
    C.movePoint(s, "A0", { x: NaN, y: 2 }) === s &&
    C.movePoint(s, "B0", s.center) === s);
  const toggled = C.toggle(C.toggle(s, "showNames"), "showCircles1");
  check("the two circle/names checkboxes are independent",
    toggled.showNames && toggled.showCircles1 && !toggled.showCircles2);
  check("an unknown option is ignored", C.toggle(s, "nope") === s);
  const reset = C.reset(toggled);
  check("Reset rebuilds the six points but keeps the checkboxes",
    reset.showNames && reset.showCircles1 && reset.A[0].x === s.A[0].x && reset.B[2].y === s.B[2].y);
}

/* ------------------------------------------- 3. the applet's own Compute() */

{
  let compared = 0, worstPoint = 0, worstRadius = 0, worstKL = 0, skipped = 0;
  const configs = [C.start({})];
  for (let t = 0; t < 420; t++) {
    const aa = [rand() * TAU, rand() * TAU, rand() * TAU];
    const bb = [rand() * TAU, rand() * TAU, rand() * TAU];
    configs.push(stateFromAngles(aa, bb));
  }
  // Positions reached by many small arrow-key-like drags, too.
  let s = C.start({});
  for (let t = 0; t < 120; t++) {
    const name = (rand() < 0.5 ? "A" : "B") + Math.floor(rand() * 3);
    const p = s[name[0] === "A" ? "A" : "B"][Number(name[1])];
    s = C.movePoint(s, name, { x: p.x + (rand() - 0.5) * 24, y: p.y + (rand() - 0.5) * 24 });
    configs.push(s);
  }
  for (const st of configs) {
    const mine = C.compute(st), theirs = javaCompute(st);
    // A coincident pair makes the applet's circumcenter NaN; those are the
    // degenerate positions handled separately below.
    const circles = [theirs.circleA, theirs.circleB, theirs.circleOA, theirs.circleOB];
    if (!circles.every((cs) => cs.every((c) => Number.isFinite(c.radius) && Number.isFinite(c.center.x)))) {
      skipped++; continue; // coincident points: the applet's FindCircumcenter returns NaN
    }
    compared++;
    for (const key of ["K", "L", "P", "Q"]) {
      for (let i = 0; i < 3; i++) {
        worstPoint = Math.max(worstPoint, dist(mine[key][i], theirs[key][i]));
      }
    }
    for (const key of ["circleA", "circleB", "circleOA", "circleOB"]) {
      for (let i = 0; i < 3; i++) {
        worstRadius = Math.max(worstRadius,
          rel(mine[key][i].radius, theirs[key][i].radius),
          dist(mine[key][i].center, theirs[key][i].center) / C.RADIUS);
      }
    }
    for (let i = 0; i < 3; i++) {
      worstKL = Math.max(worstKL,
        rel(mine.k[i], dist(st.A[i], theirs.K[i])),
        rel(mine.l[i], dist(st.B[i], theirs.L[i])));
    }
  }
  check("the applet's method was compared on hundreds of configurations", compared > 400, `${compared}; skipped ${skipped}`);
  check("the core's distances agree with the applet's feet", worstKL < 1e-8, `${worstKL}`);
  check("foot and midpoint coordinates match the applet's Compute()", worstPoint < 1e-8, `${worstPoint}`);
  check("all twelve circle radii and centres match the applet's Compute()", worstRadius < 1e-8, `${worstRadius}`);
}

/* -------------------------------------------- 4. the page's claims, (1)-(4) */

{
  let n = 0, degenerate = 0, worstProduct = 0, worstSides = 0, worstChord = 0, worstLemma2 = 0;
  let printedFails = 0, printedCases = 0, allFinite = true;
  for (let t = 0; t < 3000; t++) {
    const st = stateFromAngles([rand() * TAU, rand() * TAU, rand() * TAU],
                               [rand() * TAU, rand() * TAU, rand() * TAU]);
    const g = C.compute(st);
    if (![g.kProduct, g.lProduct, g.sideOverDiameter].every(Number.isFinite)) { allFinite = false; continue; }
    // GeoSDoub.NearestPoint returns P itself when the two vertices are within
    // 0.1 units; that is a drawing guard, not the theorem. Leave those
    // coincidences to the degenerate section below.
    if (g.sides.some((side) => side < 1)) { degenerate++; continue; }
    n++;
    worstProduct = Math.max(worstProduct, rel(g.kProduct, g.lProduct));                 // (1)
    worstSides = Math.max(worstSides, rel(g.kProduct, g.sideOverDiameter));             // (4)
    // The theorem behind the proof: k_i = |A_i B_i-1| |A_i B_i+1| / D.
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3, h = (i + 2) % 3;
      worstChord = Math.max(worstChord,
        rel(g.k[i], dist(st.A[i], st.B[h]) * dist(st.A[i], st.B[j]) / g.D),
        rel(g.l[i], dist(st.B[i], st.A[h]) * dist(st.B[i], st.A[j]) / g.D));
      // The page's (2) with Q_{i+1}, P_{i+1} versus the index that actually
      // belongs to K_i and L_i: Q_{i-1} and P_{i-1}.
      worstLemma2 = Math.max(worstLemma2,
        rel(g.k[i], 2 * g.rP[i] * g.rQ[h] / g.R),
        rel(g.l[i], 2 * g.rQ[i] * g.rP[h] / g.R));
      if (Math.min(g.k[i], g.l[i]) > 1e-2) {
        printedCases++;
        if (rel(g.k[i], 2 * g.rP[i] * g.rQ[j] / g.R) > 1e-3 ||
            rel(g.l[i], 2 * g.rQ[i] * g.rP[j] / g.R) > 1e-3) printedFails++;
      }
    }
  }
  check("thousands of non-degenerate configurations were exercised",
    n + degenerate === 3000 && n > 2900 && allFinite, `${n}, ${degenerate} coincidences`);
  check("claim (1): k0*k1*k2 = l0*l1*l2 always", worstProduct < 1e-8, `worst ${worstProduct}`);
  check("claim (4): the product is the six sides divided by D^3", worstSides < 1e-8, `worst ${worstSides}`);
  check("the chord formula behind the proof holds for every k_i and l_i", worstChord < 1e-8, `worst ${worstChord}`);
  check("formula (2) is true once the midpoint index is shifted back by one", worstLemma2 < 1e-8, `worst ${worstLemma2}`);
  check("formula (2) as printed with i+1 is not an identity", printedFails > printedCases * 0.9,
    `${printedFails} of ${printedCases} configurations contradict it`);
}

/* -------------------------------------- 5. the two-circle lemma on the page */

{
  let n = 0, worst = 0;
  for (let t = 0; t < 600; t++) {
    const r1 = 4 + rand() * 40, r2 = 4 + rand() * 40;
    const m = Math.abs(r1 - r2) + 0.2 + rand() * (r1 + r2 - Math.abs(r1 - r2) - 0.4);
    const o1 = { x: 0, y: 0 }, o2 = { x: m, y: 0 };
    const a = (r1 * r1 - r2 * r2 + m * m) / (2 * m);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    if (!(h > 1e-6)) continue;
    const A = { x: a, y: h }, B = { x: a, y: -h };
    // Circumradius of triangle O1 A O2 from its three side lengths.
    const sides = [dist(o1, A), dist(A, o2), dist(o2, o1)];
    const s = (sides[0] + sides[1] + sides[2]) / 2;
    const area = Math.sqrt(Math.max(0, s * (s - sides[0]) * (s - sides[1]) * (s - sides[2])));
    const R = prod(sides) / (4 * area);
    worst = Math.max(worst, rel(dist(A, B), r1 * r2 / R));
    n++;
  }
  check("the circle lemma was exercised on intersecting circles", n === 600, `${n}`);
  check("claim (5): the common chord is R1*R2/R", worst < 1e-9, `worst ${worst}`);
}

/* ---------------------------------- 6. degenerate and non-convex positions */

{
  const s = C.start({});
  // B1 almost at A0: NearestPoint(A0, B1, B2) returns A0 itself, so k0 = 0.
  const nearA0 = { x: s.A[0].x + 0.01, y: s.A[0].y + 0.01 };
  const st = C.movePoint(s, "B1", nearA0);
  const g = C.compute(st);
  check("a near-coincident chord foot is the vertex itself, as in the applet", g.K[0].x === st.A[0].x && g.K[0].y === st.A[0].y);
  check("a zero distance makes the product zero and stays finite",
    g.k[0] === 0 && g.kProduct === 0 && Number.isFinite(g.lProduct) && Number.isFinite(g.sideOverDiameter));
  // Put the six vertices in a completely different order around the circle.
  const angles = [0, 0.15, 0.3, 3.2, 3.4, 3.6].map((x) => x * TAU / 6);
  const shuffled = stateFromAngles([angles[0], angles[2], angles[4]], [angles[1], angles[3], angles[5]]);
  const h = C.compute(shuffled);
  check("a non-convex hexagon obeys the equality too", rel(h.kProduct, h.lProduct) < 1e-8 && rel(h.kProduct, h.sideOverDiameter) < 1e-8);
}

/* ------------------------------- 7. the page's n-gon generalization, n=4,5 */

{
  for (const n of [4, 5]) {
    let worstGeneral = 0, worstSide = 0, cases = 0;
    for (let t = 0; t < 500; t++) {
      const aa = [], bb = [], A = [], B = [];
      for (let i = 0; i < n; i++) {
        aa.push(rand() * TAU); bb.push(rand() * TAU);
        A.push(onCircle(aa[i], 140, C.CENTER)); B.push(onCircle(bb[i], 140, C.CENTER));
      }
      const k = [], l = [], sides = [];
      for (let i = 0; i < n; i++) {
        const j = mod(i + 1, n), h = mod(i - 1, n);
        k[i] = dist(A[i], foot(A[i], B[j], B[h]));
        l[i] = dist(B[i], foot(B[i], A[j], A[h]));
        sides.push(dist(A[i], B[j]), dist(B[i], A[j]));
      }
      const kp = prod(k), lp = prod(l), sp = prod(sides) / Math.pow(280, n);
      if (!(kp > 1e-6) || sides.some((side) => side < 1)) continue;
      cases++;
      worstGeneral = Math.max(worstGeneral, rel(kp, lp));
      worstSide = Math.max(worstSide, rel(kp, sp));
    }
    check(`${n}-gon cases were exercised`, cases > 450, `${cases}`);
    check(`${n}-gon generalization: the two distance products match`, worstGeneral < 1e-8, `worst ${worstGeneral}`);
    check(`${n}-gon generalization: product = adjacent sides / D^n`, worstSide < 1e-8, `worst ${worstSide}`);
  }
}

done("cyclic-hexagon");
