#!/usr/bin/env node
"use strict";

/*
 * Logic test for diameters-in-concurrent-circles/diameters-in-concurrent-circles-core.js.
 *
 *   node porting/check-diameters-in-concurrent-circles.mjs
 *
 * The page states one theorem: three circles through O meet again in pairs at
 * D, E, F; the lines OD, OE, OF meet the circles again at A, B, C; if OA and
 * OB are diameters then OC is a diameter. The applet's Compute method builds
 * all seven points with GeoSDoub's circle-circle and circle-line intersections.
 *
 * Section 3 is a second, literal transcription of that bytecode (both branch
 * choices, the sqrt sign order, the "Other" rule and the 0.05 tolerance),
 * compared with the core on thousands of random and gridded boards including
 * degenerate ones. Section 4 checks the geometry the intersections are meant
 * to have. Section 5 checks the page's claim on exact configurations, and
 * shows that the applet's own 0.05 tolerance can light a near miss.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "diameters-in-concurrent-circles/diameters-in-concurrent-circles-core.js",
  "DiametersInConcurrentCirclesCore",
);

const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;
const same = (a, b, eps = 1e-8) =>
  a === b || (!!a && !!b && near(a.x, b.x, eps) && near(a.y, b.y, eps));

/* ---------------------------------------------------- 1. the setup in init() */

{
  equal("the applet's suggested board size", [C.DEFAULT_WIDTH, C.DEFAULT_HEIGHT], [400, 300]);
  equal("FromCircle's three angles, as written in the class file", C.ANGLES,
    [-2.5132741228718345, -0.7853981633974483, Math.PI / 2]);
  const s = C.start({});
  equal("O is the centre of the canvas", s.O, { x: 200, y: 150 });
  check("P, Q and R lie on the circle of radius min(w,h)/5 about O",
    [s.P, s.Q, s.R].every((p) => near(C.distance(p, s.O), 60, 1e-12)));
  check("the three centres are distinct",
    C.distance(s.P, s.Q) > 1 && C.distance(s.Q, s.R) > 1 && C.distance(s.R, s.P) > 1);
  check("Reset restores the picture", JSON.stringify(C.reset(s)) === JSON.stringify(s));
  const otherSize = C.start({ width: 360, height: 240 });
  check("a different canvas keeps the same construction rule",
    near(C.distance(otherSize.P, otherSize.O), 48, 1e-12) &&
    near(otherSize.O.x, 180, 1e-12) && near(otherSize.O.y, 120, 1e-12));
  check("start depends only on its options",
    JSON.stringify(C.start({ width: 360, height: 240 })) === JSON.stringify(otherSize));

  const moved = C.movePoint(s, "Q", { x: 90, y: 40 });
  check("a drag moves only the named handle",
    moved.Q.x === 90 && moved.Q.y === 40 &&
    JSON.stringify(moved.P) === JSON.stringify(s.P) &&
    JSON.stringify(moved.O) === JSON.stringify(s.O));
  check("the input position is not mutated", s.Q.x !== 90 && s.Q.y !== 40);
  check("drags stay on the board", (() => {
    const m = C.movePoint(s, "R", { x: -50, y: 9999 });
    return m.R.x === C.EDGE && m.R.y === 300 - C.EDGE;
  })());
  check("unknown or non-finite drags are ignored",
    C.movePoint(s, "Z", { x: 1, y: 2 }) === s &&
    C.movePoint(s, "P", { x: NaN, y: 2 }) === s);
}

/* -------------------------------------- 2. the starting picture, pinned down */

{
  const g = C.compute(C.start({}));
  check("the initial construction is valid", g.valid);
  check("D is the second intersection of (Q) and (R)",
    same(g.D, { x: 242.42640687119356, y: 167.57359312880746 }));
  check("E is the second intersection of (P) and (R)",
    same(g.E, { x: 151.45898033750314, y: 174.7328848624516 }));
  check("F is the second intersection of (P) and (Q)",
    same(g.F, { x: 193.885387208696, y: 72.30647799125879 }));
  check("the starting picture has no diameters yet", !g.pok && !g.qok && !g.rok && !g.all);
  const tiny = C.compute({ ...C.start({}), R: { x: 200, y: 150.4 } });
  check("the applet's early return hides a centre within one unit of O", !tiny.valid);
}

/* ------------------- 3. a second transcription of GeoSDoub and Compute() */

/*
 * Written straight from javap, independently of the core: IntersectCirclesX
 * solves x = m*y + b in y; IntersectCirclesY solves y = m*x + b in x;
 * IntersectX writes x = m*y + b; IntersectY writes y = m*x + b. The order of
 * operands matters because the +/- roots end up in particular array slots.
 */
function apCCircleX(a, b) {
  const d = a.x - b.x;
  const m = -(a.y - b.y) / d;
  const k = (a.x * a.x - b.x * b.x + a.y * a.y - b.y * b.y -
    a.r * a.r + b.r * b.r) / 2 / d;
  const h = k - a.x;
  const A = m * m + 1;
  const B = m * h - a.y;
  const Cc = a.y * a.y + h * h - a.r * a.r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const t = Math.sqrt(disc);
  const y1 = (-B + t) / A, y2 = (-B - t) / A;
  return [{ x: m * y1 + k, y: y1 }, { x: m * y2 + k, y: y2 }];
}
function apCCircleY(a, b) {
  const d = a.y - b.y;
  const m = -(a.x - b.x) / d;
  const k = (a.y * a.y - b.y * b.y + a.x * a.x - b.x * b.x -
    a.r * a.r + b.r * b.r) / 2 / d;
  const h = k - a.y;
  const A = m * m + 1;
  const B = m * h - a.x;
  const Cc = a.x * a.x + h * h - a.r * a.r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const t = Math.sqrt(disc);
  const x1 = (-B + t) / A, x2 = (-B - t) / A;
  return [{ x: x1, y: m * x1 + k }, { x: x2, y: m * x2 + k }];
}
function apCCircles(a, b) {
  if (Math.abs(a.x - b.x) > 1) return apCCircleX(a, b);
  if (Math.abs(a.y - b.y) > 1) return apCCircleY(a, b);
  return [{ x: a.x, y: a.y }, { x: a.x, y: a.y }]; // DoubPoint(DoubPoint)
}
function apCLineX(circle, u, v) {
  const m = (u.x - v.x) / (u.y - v.y);
  const k = v.x - m * v.y;
  const h = k - circle.x;
  const A = m * m + 1;
  const B = m * h - circle.y;
  const Cc = circle.y * circle.y + h * h - circle.r * circle.r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const t = Math.sqrt(disc);
  const y1 = (-B + t) / A, y2 = (-B - t) / A;
  return [{ x: m * y1 + k, y: y1 }, { x: m * y2 + k, y: y2 }];
}
function apCLineY(circle, u, v) {
  const m = (u.y - v.y) / (u.x - v.x);
  const k = v.y - m * v.x;
  const h = k - circle.y;
  const A = m * m + 1;
  const B = m * h - circle.x;
  const Cc = circle.x * circle.x + h * h - circle.r * circle.r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const t = Math.sqrt(disc);
  const x1 = (-B + t) / A, x2 = (-B - t) / A;
  return [{ x: x1, y: m * x1 + k }, { x: x2, y: m * x2 + k }];
}
function apCLine(circle, u, v) {
  if (Math.abs(u.y - v.y) > 1) return apCLineX(circle, u, v);
  if (Math.abs(u.x - v.x) > 1) return apCLineY(circle, u, v);
  return null;
}
function apDist(u, v) { return Math.sqrt((u.x - v.x) * (u.x - v.x) + (u.y - v.y) * (u.y - v.y)); }
function apOther(points, O) {
  if (!points) return null;
  return apDist(points[0], O) < 1 ? points[1] : points[0];
}
function apInside(x, O, end) {
  if (!end) return false;
  return Math.abs(apDist(x, O) + apDist(x, end) - apDist(O, end)) < 0.05;
}
function apCompute(s) {
  const P = s.P, Q = s.Q, R = s.R, O = s.O;
  if (apDist(O, P) < 1 || apDist(O, Q) < 1 || apDist(O, R) < 1) {
    return { valid: false, pok: false, qok: false, rok: false, all: false };
  }
  const ODE = { x: R.x, y: R.y, r: apDist(R, O) };
  const OEF = { x: P.x, y: P.y, r: apDist(P, O) };
  const OFD = { x: Q.x, y: Q.y, r: apDist(Q, O) };
  const D = apOther(apCCircles(ODE, OFD), O);
  const E = apOther(apCCircles(OEF, ODE), O);
  const F = apOther(apCCircles(OFD, OEF), O);
  const A = apOther(apCLine(OEF, D, O), O);
  const B = apOther(apCLine(OFD, E, O), O);
  const Cc = apOther(apCLine(ODE, F, O), O);
  const pok = apInside(P, O, A), qok = apInside(Q, O, B), rok = apInside(R, O, Cc);
  return {
    valid: !!(D && E && F && A && B && Cc),
    pok: pok, qok: qok, rok: rok, all: pok && qok && rok,
    D: D, E: E, F: F, A: A, B: B, C: Cc,
  };
}

{
  const rnd = rng(20261127);
  const boards = [];
  for (let i = 0; i < 4000; i++) {
    boards.push({
      width: 400, height: 300,
      O: { x: 200, y: 150 },
      P: { x: 4 + rnd() * 392, y: 4 + rnd() * 292 },
      Q: { x: 4 + rnd() * 392, y: 4 + rnd() * 292 },
      R: { x: 4 + rnd() * 392, y: 4 + rnd() * 292 },
    });
  }
  // A grid of all P,Q pairs at five scales, plus the applet's initial board.
  for (let step of [16, 40, 80]) {
    for (let px = 8; px <= 392; px += step * 4) {
      for (let py = 8; py <= 292; py += step * 3) {
        for (let qx = 8; qx <= 392; qx += step * 4) {
          for (let qy = 8; qy <= 292; qy += step * 3) {
            boards.push({
              width: 400, height: 300, O: { x: 200, y: 150 },
              P: { x: px, y: py }, Q: { x: qx, y: qy }, R: { x: 200, y: 40 },
            });
          }
        }
      }
    }
  }
  boards.push(C.start({}));
  // Degenerate shapes the applet really meets while dragging.
  for (const d of [0, 0.4, 0.999, 1, 1.001, 2, 20]) {
    boards.push({ ...C.start({}), R: { x: 200 + d, y: 150 } });
    boards.push({ ...C.start({}), P: { x: 200, y: 150 + d } });
    boards.push({ ...C.start({}), Q: { x: 200 + d, y: 150 + d } });
  }
  let mismatches = 0, first = "";
  for (const s of boards) {
    const a = C.compute(s), b = apCompute(s);
    const keys = ["D", "E", "F", "A", "B", "C"];
    let ok = a.valid === b.valid && a.pok === b.pok && a.qok === b.qok &&
      a.rok === b.rok && a.all === b.all;
    if (ok) {
      for (const k of keys) if (!same(a[k] ?? null, b[k] ?? null)) ok = false;
    }
    if (!ok && mismatches++ === 0) first = JSON.stringify({ board: s, core: a, applet: b });
  }
  check(`the core matches the bytecode on all ${boards.length} boards`,
    mismatches === 0, `${mismatches} mismatches; first: ${first}`);
  check("the comparison included degenerate and early-return boards",
    boards.some((s) => C.compute(s).valid === false));
  check("the comparison included valid boards", boards.some((s) => C.compute(s).valid === true));
}

/* --------------------------------- 4. the points really are the intersections */

{
  const rnd = rng(777);
  let tested = 0, wrong = 0;
  for (let i = 0; i < 1500; i++) {
    const s = {
      width: 400, height: 300, O: { x: 200, y: 150 },
      P: { x: 8 + rnd() * 384, y: 8 + rnd() * 284 },
      Q: { x: 8 + rnd() * 384, y: 8 + rnd() * 284 },
      R: { x: 8 + rnd() * 384, y: 8 + rnd() * 284 },
    };
    const g = C.compute(s);
    if (!g.valid) continue;
    tested++;
    const onCircle = (p, c) => near(C.distance(p, c.center), c.radius, 1e-7);
    const onLine = (p, u, v) => near(
      (u.x - v.x) * (p.y - v.y) - (u.y - v.y) * (p.x - v.x), 0, 1e-7);
    // The radical axis OD is perpendicular to the line of centres QR.
    const onRadical = (p, u, v) => near(
      (p.x - g.O.x) * (u.x - v.x) + (p.y - g.O.y) * (u.y - v.y), 0, 1e-7);
    if (!onCircle(g.D, g.cQ) || !onCircle(g.D, g.cR) || !onRadical(g.D, g.Q, g.R)) wrong++;
    if (!onCircle(g.E, g.cP) || !onCircle(g.E, g.cR) || !onRadical(g.E, g.P, g.R)) wrong++;
    if (!onCircle(g.F, g.cP) || !onCircle(g.F, g.cQ) || !onRadical(g.F, g.P, g.Q)) wrong++;
    if (!onCircle(g.A, g.cP) || !onLine(g.A, g.D, g.O)) wrong++;
    if (!onCircle(g.B, g.cQ) || !onLine(g.B, g.E, g.O)) wrong++;
    if (!onCircle(g.C, g.cR) || !onLine(g.C, g.F, g.O)) wrong++;
    // On a well separated board the chosen point is the far one. At a
    // tangency both roots can sit within a unit of O; the applet's < 1 rule
    // still chooses the second slot, which is checked directly just below.
    if ([g.Q, g.R, g.P].some((centre) => C.distance(centre, g.O) > 40) &&
        [g.D, g.E, g.F].some((p) => C.distance(p, g.O) < 1)) wrong++;
  }
  check(`all six derived points satisfy their circle and line equations in ${tested} boards`,
    tested > 1000 && wrong === 0, `${wrong} failures`);
  const g = C.compute(C.start({}));
  check("A, B and C are the far intersections, not O",
    [g.A, g.B, g.C].every((p) => C.distance(p, g.O) > 1));
  check("IsInside accepts a centre on a diameter and rejects one off it",
    C.isInside({ x: 2, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }) &&
    !C.isInside({ x: 2, y: 0.5 }, { x: 0, y: 0 }, { x: 4, y: 0 }));
  check("Other returns the second slot exactly when the first is near O",
    C.other([{ x: 0.2, y: 0 }, { x: 9, y: 0 }], { x: 0, y: 0 }).x === 9 &&
    C.other([{ x: 2, y: 0 }, { x: 9, y: 0 }], { x: 0, y: 0 }).x === 2 &&
    C.other(null, { x: 0, y: 0 }) === null);
}

/* --------------------------------------- 5. the claim on the original page */

{
  const rnd = rng(31415926);
  let exact = 0, failed = 0, allLit = 0;
  for (let i = 0; i < 26000 && exact < 3000; i++) {
    const p = { x: (rnd() * 2 - 1) * 150, y: (rnd() * 2 - 1) * 140 };
    const q = { x: (rnd() * 2 - 1) * 150, y: (rnd() * 2 - 1) * 140 };
    const det = p.x * q.y - p.y * q.x;
    if (Math.abs(det) < 1000) continue;
    const dot = p.x * q.x + p.y * q.y;
    // Solve [p q] r = (p.q, p.q). The three pairwise dot products then agree,
    // which is exactly the condition for all three chords to be diameters.
    const r = { x: (dot * q.y - p.y * dot) / det, y: (p.x * dot - q.x * dot) / det };
    if (!Number.isFinite(r.x) || Math.hypot(r.x, r.y) < 15 ||
      Math.hypot(r.x - p.x, r.y - p.y) < 15 ||
      Math.hypot(r.x - q.x, r.y - q.y) < 15) continue;
    const s = {
      width: 400, height: 300, O: { x: 200, y: 150 },
      P: { x: 200 + p.x, y: 150 + p.y },
      Q: { x: 200 + q.x, y: 150 + q.y },
      R: { x: 200 + r.x, y: 150 + r.y },
    };
    if ([s.P, s.Q, s.R].some((v) => v.x < 4 || v.x > 396 || v.y < 4 || v.y > 296)) continue;
    const g = C.compute(s);
    if (!g.valid) continue;
    exact++;
    // The exact two-diameter hypothesis: centre halfway along its diameter.
    const pq = p.x * q.x + p.y * q.y, pr = p.x * r.x + p.y * r.y, qr = q.x * r.x + q.y * r.y;
    if (Math.abs(pq - pr) > 1e-7 || Math.abs(pq - qr) > 1e-7) failed++;
    if (!g.pok || !g.qok || !g.rok || !g.all) failed++;
    if (g.all) allLit++;
    for (const [end, centre] of [[g.A, g.P], [g.B, g.Q], [g.C, g.R]]) {
      if (C.distance(end, { x: 2 * centre.x - s.O.x, y: 2 * centre.y - s.O.y }) > 1e-6) failed++;
    }
  }
  check(`the page's claim holds in ${exact} exact two-diameter configurations`,
    exact >= 2000 && failed === 0 && allLit === exact,
    `${failed} failures, ${allLit}/${exact} lit`);

  // A near miss can still light up: the applet uses a 0.05 tolerance, not an
  // exact collinearity test. Pin such a board so the test stays honest.
  const loose = {
    width: 400, height: 300, O: { x: 200, y: 150 },
    P: { x: 165.72526017948985, y: 21.310617153532803 },
    Q: { x: 68.37033645808697, y: 283.211251094006 },
    R: { x: 353.92591293528676, y: 202.7143827462569 },
  };
  const lg = C.compute(loose);
  const p = { x: loose.P.x - 200, y: loose.P.y - 150 };
  const q = { x: loose.Q.x - 200, y: loose.Q.y - 150 };
  const r = { x: loose.R.x - 200, y: loose.R.y - 150 };
  check("a near miss can light two dots although the dot products differ",
    lg.valid && lg.pok && lg.qok && !lg.rok &&
    Math.abs((p.x * q.x + p.y * q.y) - (p.x * r.x + p.y * r.y)) > 100);

  // The applet does allow a single diameter: this is why "Show" is a hint,
  // not a win condition, and why this port has no win or loss.
  const rnd2 = rng(11);
  let singles = 0;
  for (let i = 0; i < 20000 && singles < 1; i++) {
    const s = {
      width: 400, height: 300, O: { x: 200, y: 150 },
      P: { x: 4 + rnd2() * 392, y: 4 + rnd2() * 292 },
      Q: { x: 4 + rnd2() * 392, y: 4 + rnd2() * 292 },
      R: { x: 4 + rnd2() * 392, y: 4 + rnd2() * 292 },
    };
    const g = C.compute(s);
    if (g.valid && (g.pok ? 1 : 0) + (g.qok ? 1 : 0) + (g.rok ? 1 : 0) === 1) singles++;
  }
  check("other placements really can light only one centre", singles > 0);
}

/* ------------------------------------------- 6. the position handed to Track */

{
  const s = C.start({});
  const pos = C.position(s);
  check("the saved position is plain data, safe for Track.state",
    JSON.stringify(pos) === JSON.stringify(C.position(s)) &&
    !/function|undefined|NaN/.test(JSON.stringify(pos)));
  check("the saved position contains O, P, Q, R, all six derived points and the flags",
    ["O", "P", "Q", "R", "A", "B", "C", "D", "E", "F"].every((k) => k in pos) &&
    ["pok", "qok", "rok", "all"].every((k) => typeof pos[k] === "boolean"));
  const moved = C.movePoint(s, "P", { x: 300, y: 240 });
  check("a moved position changes with the board",
    C.position(moved).P.x === 300 && C.position(moved).A.x !== pos.A.x);
}

done("diameters-in-concurrent-circles");
