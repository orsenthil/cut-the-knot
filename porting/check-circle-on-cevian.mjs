#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-on-cevian/circle-on-cevian-core.js.
 *
 *   node porting/check-circle-on-cevian.mjs
 *
 * Checked: the starting points against the applet's init(); the moves of the
 * corners and the cevian feet; the applet's two switches; and every claim on
 * its page over fixed and random triangles - the altitude foot on its circle,
 * the three altitudes meeting at H, the radical axis of two cevian circles
 * passing through H, the two circle intersections lying on that axis, and the
 * radical center of three circles being H. The last group is a second, literal
 * transcription of GeoSDoub.NearestPoint, GeoSDoub.Intersect (both lines and
 * circles, with its IntersectCirclesX/Y split) and the canvas's GetCircle,
 * compared with the core over hundreds of configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circle-on-cevian/circle-on-cevian-core.js", "CircleOnCevianCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, P) => C.start({ points: { A, P }, N: 3 });
/** A triangle with each cevian foot at the given fraction along its side. */
const mk = (A, ts) => tri(A, A.map((_, i) => {
  const [j, k] = C.other(i);
  return C.lerp(A[j], A[k], ts[i]);
}));

/* ------------------------------ the applet's own computation, transcribed */

/* GeoSDoub.SqDist / Dist. */
function appletSqDist(p, q) {
  const dx = p.x - q.x, dy = p.y - q.y;
  return dx * dx + dy * dy;
}

/* GeoSDoub.NearestPoint(P, A, B): the 0.1 guard and the projection. */
function appletNearestPoint(P, A, B) {
  if (appletSqDist(A, P) < 0.1) return { x: P.x, y: P.y };
  const dx = B.x - A.x, dy = B.y - A.y;
  const dot = dx * (P.x - A.x) + dy * (P.y - A.y);
  const t = dot / (dx * dx + dy * dy);
  return { x: A.x + dx * t, y: A.y + dy * t };
}

/* GeoSDoub.Intersect(line, line): ax+by+c=0, det < 1 gives NaN. */
function appletLineIntersection(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* CircleOnCevianCanvas.GetCircle / Midpoint: diameter AP. */
function appletCircle(P, A) {
  return {
    c: { x: (P.x + A.x) / 2, y: (P.y + A.y) / 2 },
    r: Math.sqrt(appletSqDist(P, A)) / 2,
  };
}

/* GeoSDoub.IntersectCirclesX, straight from the bytecode (solve x = m*y + b). */
function appletIntersectCirclesX(c1, r1, c2, r2) {
  const m = -(c1.y - c2.y) / (c1.x - c2.x);
  const b = (c1.x ** 2 - c2.x ** 2 + c1.y ** 2 - c2.y ** 2 - r1 ** 2 + r2 ** 2) / 2 / (c1.x - c2.x);
  const u = b - c1.x;
  const a = m * m + 1;
  const q = m * u - c1.y;
  const c = u * u + c1.y ** 2 - r1 ** 2;
  const disc = q * q - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y1 = (-q + root) / a, y2 = (-q - root) / a;
  return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
}

/* GeoSDoub.IntersectCirclesY: the swapped form (solve y = m*x + b). */
function appletIntersectCirclesY(c1, r1, c2, r2) {
  const m = -(c1.x - c2.x) / (c1.y - c2.y);
  const b = (c1.y ** 2 - c2.y ** 2 + c1.x ** 2 - c2.x ** 2 - r1 ** 2 + r2 ** 2) / 2 / (c1.y - c2.y);
  const u = b - c1.y;
  const a = m * m + 1;
  const q = m * u - c1.x;
  const c = u * u + c1.x ** 2 - r1 ** 2;
  const disc = q * q - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x1 = (-q + root) / a, x2 = (-q - root) / a;
  return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
}

/* GeoSDoub.Intersect(circle, circle): its X/Y dispatch. */
function appletCircleIntersections(c1, r1, c2, r2) {
  if (Math.abs(c1.x - c2.x) > 1) return appletIntersectCirclesX(c1, r1, c2, r2);
  if (Math.abs(c1.y - c2.y) > 1) return appletIntersectCirclesY(c1, r1, c2, r2);
  return [{ ...c1 }, { ...c1 }]; // concentric: the applet returns the centre twice
}

/* --------------------------------------------- 1. the start and the moves */

{
  const s = C.start({});
  const W = 400, H = 250;
  equal("start A0 is init's (W/6, 6H/7)", s.A[0], { x: W / 6, y: (H * 6) / 7 });
  equal("start A1 is init's (4W/5, 7H/10)", s.A[1], { x: (W * 4) / 5, y: (H * 7) / 10 });
  equal("start A2 is init's (W/2-10, H/10)", s.A[2], { x: W / 2 - 10, y: H / 10 });
  check("each starting P is on the side opposite its vertex", [0, 1, 2].every((i) => {
    const [j, k] = C.other(i);
    return C.distToLine(s.P[i], s.A[j], s.A[k]) < 1e-12;
  }));
  check("each starting P is the midpoint of the applet's t range", [0, 1, 2].every((i) => {
    const [j, k] = C.other(i);
    return closePoint(s.P[i], C.lerp(s.A[j], s.A[k], 0.5), 1e-12);
  }));
  check("the start uses one cevian with names and hint on",
    s.N === 1 && s.showNames && s.showHint);
  check("an illustration has no result", C.result(s) === null);
  check("a fresh start is not degenerate", !C.isDegenerate(s));
  check("withVertex does not change the given position", (() => {
    const t = C.withVertex(s, 0, { x: 120, y: 180 });
    return s.A[0].x === W / 6 && t.A[0].x === 120 && t.A[1].x === s.A[1].x;
  })());
  check("dragging a corner keeps each foot's fraction of its side", (() => {
    const before = [0, 1, 2].map((i) => C.footParam(s, i));
    const t = C.withVertex(s, 0, { x: 100, y: 200 });
    return [0, 1, 2].every((i) => close(C.footParam(t, i), before[i], 1e-12));
  })());
  check("dragging a foot keeps it on its side", (() => {
    const t = C.withFoot(s, 2, { x: 1000, y: -1000 });
    return C.distToLine(t.P[2], s.A[0], s.A[1]) < 1e-9;
  })());
  check("a foot is clamped to the side segment", (() => {
    const t = C.withFoot(s, 2, { x: 1000, y: -1000 });
    const [j, k] = C.other(2);
    const d1 = dist(t.P[2], s.A[j]) + dist(t.P[2], s.A[k]);
    return close(d1, dist(s.A[j], s.A[k]), 1e-9);
  })());
  check("unknown handles leave the position alone",
    C.withVertex(s, 7, { x: 1, y: 2 }) === s && C.withFoot(s, -1, { x: 1, y: 2 }) === s);
  check("N is clamped to the applet's 1..3 range",
    C.withOption(s, "N", 99).N === 3 && C.withOption(s, "N", -2).N === 1);
  equal("the applet draws no axis with one cevian", C.shownPairs(s), []);
  equal("the applet draws (2,0) with two cevians", C.shownPairs(C.withOption(s, "N", 2)), [[2, 0]]);
  equal("the applet draws three axes with three cevians",
    C.shownPairs(C.withOption(s, "N", 3)), [[2, 0], [0, 1], [1, 2]]);
}

/* ------------------------- 2. the page's claims on fixed configurations */

const fixed = [
  ["the start", C.start({ N: 3 })],
  ["equilateral", mk(
    [{ x: 200, y: 40 }, { x: 60, y: 280 }, { x: 340, y: 280 }], [0.5, 0.5, 0.5])],
  ["right", mk(
    [{ x: 60, y: 250 }, { x: 60, y: 40 }, { x: 320, y: 250 }], [0.5, 0.5, 0.5])],
  ["obtuse at A", mk(
    [{ x: 60, y: 150 }, { x: 320, y: 90 }, { x: 300, y: 240 }], [0.4, 0.6, 0.25])],
  ["obtuse at B", mk(
    [{ x: 180, y: 40 }, { x: 50, y: 260 }, { x: 360, y: 250 }], [0.35, 0.7, 0.55])],
  ["thin", mk(
    [{ x: 40, y: 150 }, { x: 360, y: 160 }, { x: 200, y: 175 }], [0.45, 0.6, 0.3])],
];

for (const [name, s] of fixed) {
  const cl = C.claims(s);
  check(`${name}: the altitude foot lies on its circle and the opposite side`, cl.feetOnCircles);
  check(`${name}: the three altitudes meet at one point`, cl.altitudesConcurrent);
  check(`${name}: the radical axis of two cevian circles passes through H`, cl.radicalThroughOrthocenter);
  check(`${name}: the circle intersections lie on that axis`, cl.intersectionsOnAxis);
  check(`${name}: the radical center of three circles is H`, cl.radicalCenter);
  check(`${name}: every claim holds together`, Object.values(cl).every(Boolean), JSON.stringify(cl));
}

/* ----------------- 3. the same claims over many random configurations */

{
  const rand = rng(3212);
  let tested = 0, axes = 0, meet = 0;
  for (let trial = 0; trial < 800; trial++) {
    const A = [0, 1, 2].map(() => ({ x: 20 + rand() * 360, y: 20 + rand() * 210 }));
    const P = A.map((_, i) => {
      const [j, k] = C.other(i);
      return C.lerp(A[j], A[k], 0.15 + rand() * 0.7);
    });
    const s = tri(A, P);
    // A near-degenerate triangle makes the applet's line intersection refuse
    // to draw H; there is no theorem to test in that case.
    if (C.isDegenerate(s) || C.doubleArea(s) < 1000 || !C.orthocenter(s)) continue;
    tested++;
    const cl = C.claims(s);
    if (!Object.values(cl).every(Boolean)) {
      check(`random ${trial}: all claims hold`, false, JSON.stringify(cl));
    }
    for (const { axis, hits, i, j } of C.measurements(s).pairs) {
      axes++;
      if (hits.length === 2) meet++;
      // The exact claim from the page, checked independently of the claims():
      // equal powers in circle i and circle j at the orthocenter.
      const H = C.orthocenter(s);
      if (!close(C.power(s, i, H), C.power(s, j, H), 1e-7 * 160 ** 2)) {
        check(`random ${trial}: powers of H in circles ${i},${j} agree`, false);
      }
    }
  }
  check(`all claims hold on ${tested} random triangles`, tested > 700);
  check(`${axes} radical axes were checked, ${meet} with two real intersections`, axes > 2000 && meet > 500);
}

/* -------------------- 4. the core against the applet's own computation */

{
  const rand = rng(777);
  let feet = 0, centers = 0, orthos = 0, pairs = 0;
  for (const [, s] of fixed) {
    const m = C.measurements(s);
    const tol = 2e-6 * Math.max(dist(s.A[0], s.A[1]), dist(s.A[1], s.A[2]), dist(s.A[2], s.A[0]));
    for (let i = 0; i < 3; i++) {
      const [j, k] = C.other(i);
      const a = appletNearestPoint(s.A[i], s.A[j], s.A[k]);
      check(`fixed ${i}: altitude foot matches GeoSDoub.NearestPoint`,
        closePoint(a, m.feet[i], tol), `applet ${JSON.stringify(a)}, core ${JSON.stringify(m.feet[i])}`);
      const z = appletCircle(s.P[i], s.A[i]);
      check(`fixed ${i}: circle matches GetCircle`,
        closePoint(z.c, m.circles[i].c, tol) && close(z.r, m.circles[i].r, tol));
      centers++;
    }
    const H = appletLineIntersection(m.feet[0], s.A[0], m.feet[2], s.A[2]);
    check("fixed: orthocenter matches GeoSDoub.Intersect",
      closePoint(H, m.orthocenter, tol), `applet ${JSON.stringify(H)}, core ${JSON.stringify(m.orthocenter)}`);
  }
  for (let trial = 0; trial < 600; trial++) {
    const A = [0, 1, 2].map(() => ({ x: 20 + rand() * 360, y: 20 + rand() * 210 }));
    const P = A.map((_, i) => {
      const [j, k] = C.other(i);
      return C.lerp(A[j], A[k], 0.15 + rand() * 0.7);
    });
    const s = tri(A, P);
    if (C.isDegenerate(s) || C.doubleArea(s) < 1000 || !C.orthocenter(s)) continue;
    const m = C.measurements(s);
    const tol = 2e-6 * Math.max(dist(A[0], A[1]), dist(A[1], A[2]), dist(A[2], A[0]));
    for (let i = 0; i < 3; i++) {
      const [j, k] = C.other(i);
      const a = appletNearestPoint(A[i], A[j], A[k]);
      if (!closePoint(a, m.feet[i], tol)) check(`random ${trial}: foot ${i} matches the applet`, false);
      const z = appletCircle(P[i], A[i]);
      if (!closePoint(z.c, m.circles[i].c, tol) || !close(z.r, m.circles[i].r, tol)) {
        check(`random ${trial}: circle ${i} matches GetCircle`, false);
      }
      feet++;
    }
    const H = appletLineIntersection(m.feet[0], A[0], m.feet[2], A[2]);
    if (!closePoint(H, m.orthocenter, tol)) check(`random ${trial}: orthocenter matches the applet`, false);
    orthos++;

    for (const [i, j] of [[2, 0], [0, 1], [1, 2]]) {
      const a = m.circles[i], b = m.circles[j];
      const applet = appletCircleIntersections(a.c, a.r, b.c, b.r);
      const core = C.circleIntersections(s, i, j);
      if (applet && applet.length === 2 && core.length === 2) {
        // IntersectCirclesX/Y and the standard formula find the same two points.
        if (!(closePoint(applet[0], core[0], tol) && closePoint(applet[1], core[1], tol)) &&
            !(closePoint(applet[0], core[1], tol) && closePoint(applet[1], core[0], tol))) {
          check(`random ${trial}: circle intersections ${i},${j} match the applet`, false,
            `applet ${JSON.stringify(applet)}, core ${JSON.stringify(core)}`);
        }
        // ShowLine joins those two points: that line is our radical axis.
        const axis = C.radicalAxis(s, i, j);
        const onAxis = applet.every((p) => close(C.axisDistance(p, axis), 0, tol));
        if (!onAxis || !close(C.axisDistance(m.orthocenter, axis), 0, tol)) {
          check(`random ${trial}: the applet's radical axis passes through H`, false);
        }
        pairs++;
      } else if (applet === null && core.length !== 0) {
        check(`random ${trial}: no intersections means no intersections`, false);
      }
    }
  }
  check(`altitude feet, circles and orthocenter match the applet on ${feet} configurations`,
    feet > 500 && centers === 18 && orthos > 300);
  check(`${pairs} circle pairs: the applet's intersections lie on the core's axis`, pairs > 500);
}

/* ------------------------------------- 5. degenerate input is handled safely */

{
  const flat = tri(
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
    [{ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 15, y: 0 }]);
  check("collinear corners are degenerate", C.isDegenerate(flat));
  check("no orthocenter for a degenerate triangle", C.orthocenter(flat) === null);
  check("no claim passes for a degenerate triangle",
    !Object.values(C.claims(flat)).some(Boolean));
  check("a repeated corner is degenerate", C.isDegenerate(tri(
    [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 100, y: 100 }],
    [{ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 50 }])));
  check("a cevian of zero length is degenerate", C.isDegenerate(tri(
    [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }],
    [{ x: 0, y: 0 }, { x: 25, y: 40 }, { x: 50, y: 40 }])));
  check("nearestPoint keeps the applet's 0.1 guard", (() => {
    const p = { x: 5, y: 5 };
    return closePoint(C.nearestPoint(p, { x: 5.05, y: 5 }, { x: 100, y: 100 }), p, 1e-12);
  })());
}

done("circle-on-cevian");
