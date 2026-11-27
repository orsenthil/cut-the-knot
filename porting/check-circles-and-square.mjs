#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-and-square/circles-and-square-core.js.
 *
 *   node porting/check-circles-and-square.mjs
 *
 * The applet is a droodle: ABCD is a square, M is on AD, N on BC, K slides
 * along MN, and the circumcircles of AMK and CNK meet again at P. First the
 * rules of the picture (the reflected corners, M/N on their sides, K on MN,
 * the checkbox, the refusal of broken drags) are checked. Then a second,
 * literal transcription of GeoSDoub.Intersect, NearestPoint,
 * FindCircumcenter, Intersect(circle,circle) and the canvas's GetCircle and
 * Draw is compared with the core over several hundred drawings, squares,
 * rectangles and parallelograms. Finally every claim on the page is tested:
 * P is on the diagonal AC, K and P lie on both circles, the angles at M and
 * N are equal, the two angles at P make a straight angle, and the tangent
 * limit puts P at K on AC.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circles-and-square/circles-and-square-core.js", "CirclesAndSquareCore");
const pt = (x, y) => ({ x, y });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps;
const samePt = (a, b, eps = 1e-7) => near(a.x, b.x, eps) && near(a.y, b.y, eps);
const lerp = (a, b, t) => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
/* The page's proof assumes AMKP is convex; outside that case the same cyclic
   quadrilateral gives equal angles instead of supplementary ones. */
const project = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return pt(a.x + dx * t, a.y + dy * t);
};
function convexAMKP(s, P) {
  const q = [s.A, s.M, s.K, P];
  const turns = [];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    turns.push((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x));
  }
  return turns.every((t) => t > 1e-9) || turns.every((t) => t < -1e-9);
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the opening A", s.A, pt(125, 75));
  equal("the opening B", s.B, pt(125, 225));
  equal("the opening C", s.C, pt(275, 225));
  equal("the opening D", s.D, pt(275, 75));
  check("M starts on AD and N starts on BC", s.M.y === s.A.y && s.N.y === s.B.y);
  check("K starts on MN", Math.abs(C.cross(s.M, s.N, s.K)) < 1e-9);
  check("the names checkbox starts unticked", !s.showNames);
  check("an illustration has no result to announce", C.result(s) === null);
  check("all seven points are draggable", C.legalMoves().join(",") === "A,B,C,D,M,N,K");

  const g = C.compute(s);
  check("the opening drawing is not degenerate", !g.degenerate && !!g.P);
  check("the opening P is on the diagonal AC", Math.abs(g.acResidual) < 1e-7);
  check("the opening circles have positive radii", g.circleAMK.r > 0 && g.circleCNK.r > 0);
  check("the status describes P and the equal angles",
    /P on the diagonal AC/.test(C.describe(s)) && /angles at M and N are equal/.test(C.describe(s)));

  check("an unknown point is refused", C.movePoint(s, "Q", pt(1, 1)) === s);
  check("a non-numeric pointer is refused",
    C.movePoint(s, "A", pt(NaN, 1)) === s && C.movePoint(s, "A", null) === s);
  check("dragging A stays on AC, reflects C and keeps the sides level", (() => {
    const q = project(pt(150, 90), s.A, s.C);
    const m = C.movePoint(s, "A", pt(150, 90));
    return m && samePt(m.A, q) &&
      near(m.C.x, 400 - q.x) && near(m.C.y, 300 - q.y) &&
      near(m.B.x, q.x) && near(m.D.x, m.C.x) &&
      m.B.y === m.C.y && m.D.y === m.A.y &&
      m.M.y === m.A.y && m.N.y === m.B.y;
  })());
  check("dragging B stays on BD and reflects D", (() => {
    const q = project(pt(140, 210), s.B, s.D);
    const m = C.movePoint(s, "B", pt(140, 210));
    return m && samePt(m.B, q) &&
      near(m.D.x, 400 - q.x) && near(m.D.y, 300 - q.y) &&
      near(m.A.x, q.x) && near(m.C.x, m.D.x) &&
      m.A.y === m.D.y && m.B.y === m.C.y && m.N.y === m.B.y;
  })());
  check("dragging C stays on AC and reflects A", (() => {
    const q = project(pt(290, 200), s.A, s.C);
    const m = C.movePoint(s, "C", pt(290, 200));
    return m && samePt(m.C, q) &&
      near(m.A.x, 400 - q.x) && near(m.A.y, 300 - q.y) &&
      m.B.y === m.C.y && m.D.y === m.A.y && m.M.y === m.A.y;
  })());
  check("dragging D stays on BD and reflects B", (() => {
    const q = project(pt(290, 80), s.B, s.D);
    const m = C.movePoint(s, "D", pt(290, 80));
    return m && samePt(m.D, q) &&
      near(m.B.x, 400 - q.x) && near(m.B.y, 300 - q.y) &&
      m.A.y === m.D.y && m.B.y === m.C.y && m.N.y === m.B.y;
  })());
  check("dragging M keeps it on AD", (() => {
    const m = C.movePoint(s, "M", pt(200, 100));
    return m && m.M.x === 200 && m.M.y === s.A.y && m.A.x === s.A.x;
  })());
  check("dragging N keeps it on BC", (() => {
    const m = C.movePoint(s, "N", pt(220, 100));
    return m && m.N.x === 220 && m.N.y === s.B.y && m.B.x === s.B.x;
  })());
  check("dragging K keeps it on MN", (() => {
    const m = C.movePoint(s, "K", pt(240, 160));
    return m && Math.abs(C.cross(m.M, m.N, m.K)) < 1e-7 && m.K.y === 160;
  })());
  check("a drag is remembered as explored",
    C.movePoint(s, "M", pt(240, 75)).explored === true);
  check("a drag that would collapse the square is refused",
    C.movePoint(s, "A", pt(200, 150)) === s);
  check("a drag off the board is clamped or refused", (() => {
    const m = C.movePoint(s, "K", pt(-99, 999));
    return m === s || (m.K.x >= C.MARGIN && m.K.x <= C.WIDTH - C.MARGIN);
  })());
  check("an unknown option is refused", C.setOption(s, "nonesuch", true) === s);
  check("the names checkbox can be set and unset", (() => {
    const on = C.setOption(s, "showNames", true);
    return on.showNames && !C.setOption(on, "showNames", false).showNames;
  })());
  check("reset restores the drawing but keeps the option", (() => {
    const moved = C.setOption(C.movePoint(s, "M", pt(240, 75)), "showNames", true);
    const r = C.reset(moved);
    return r.A.x === 125 && r.C.x === 275 && r.showNames === true &&
      r.explored === false && r.moves === 0;
  })());
  check("a degenerate drawing is reported, not drawn", (() => {
    const bad = C.start({
      A: pt(100, 200), B: pt(100, 200), C: pt(300, 200), D: pt(300, 200),
      M: pt(200, 200), N: pt(200, 200), K: pt(200, 200),
    });
    return C.compute(bad).degenerate && /Move the points apart/.test(C.describe(bad));
  })());
}

/* ------------------------- 2. a literal second transcription of the applet */

/* GeoSDoub.Intersect(p1,p2,p3,p4), straight from its bytecode. */
function appIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y;
  const b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y;
  const b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return pt(NaN, NaN);
  return pt((b1 * c2 - b2 * c1) / den, (c1 * a2 - c2 * a1) / den);
}

/* GeoSDoub.NearestPoint: the bytecode's guard is SqDist(a,p) < 0.1. */
function appNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return pt(p.x, p.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return pt(a.x + dx * t, a.y + dy * t);
}

/* GeoSDoub.FindCircumcenter: two perpendicular bisectors, then Intersect. */
function appCircumcenter(p, q, r) {
  const ab = pt((p.x + q.x) / 2, (p.y + q.y) / 2);
  const bc = pt((q.x + r.x) / 2, (q.y + r.y) / 2);
  const ab2 = pt(ab.x + (q.y - p.y), ab.y - (q.x - p.x));
  const bc2 = pt(bc.x + (r.y - q.y), bc.y - (r.x - q.x));
  return appIntersect(ab, ab2, bc, bc2);
}

/* Canvas.GetCircle: mean of the three distances from the circumcenter. */
function appCircle(p, q, r) {
  const o = appCircumcenter(p, q, r);
  return { x: o.x, y: o.y, r: (dist(o, p) + dist(o, q) + dist(o, r)) / 3 };
}

/* GeoSDoub.IntersectCirclesX, with the bytecode's local names m,b,h,a,k,c. */
function appCirclesX(c0, c1) {
  const m = -(c0.y - c1.y) / (c0.x - c1.x);
  const b = (
    c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y -
    c0.r * c0.r + c1.r * c1.r
  ) / 2 / (c0.x - c1.x);
  const h = b - c0.x;
  const a = m * m + 1;
  const k = m * h - c0.y;
  const c = h * h + c0.y * c0.y - c0.r * c0.r;
  const disc = k * k - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y1 = (-k + root) / a, y2 = (-k - root) / a;
  return [pt(m * y1 + b, y1), pt(m * y2 + b, y2)];
}

/* GeoSDoub.IntersectCirclesY, the branch for centres sharing an x. */
function appCirclesY(c0, c1) {
  const m = -(c0.x - c1.x) / (c0.y - c1.y);
  const b = (
    c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x -
    c0.r * c0.r + c1.r * c1.r
  ) / 2 / (c0.y - c1.y);
  const h = b - c0.y;
  const a = m * m + 1;
  const k = m * h - c0.x;
  const c = h * h + c0.x * c0.x - c0.r * c0.r;
  const disc = k * k - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x1 = (-k + root) / a, x2 = (-k - root) / a;
  return [pt(x1, m * x1 + b), pt(x2, m * x2 + b)];
}

function appCircleCross(c0, c1) {
  if (Math.abs(c0.x - c1.x) > 1) return appCirclesX(c0, c1);
  if (Math.abs(c0.y - c1.y) > 1) return appCirclesY(c0, c1);
  return [pt(c0.x, c0.y), pt(c0.x, c0.y)];
}

/* Canvas.Draw, including its guard and its choice of the point beside K. */
function appDraw(s) {
  const { A, B, C, M, N, K } = s;
  if (dist(A, B) <= 1) return null;
  const c1 = appCircle(A, M, K);
  const c2 = appCircle(C, N, K);
  const hits = appCircleCross(c1, c2);
  if (!hits) return null;
  const P = dist(K, hits[0]) >= 1 ? hits[0] : hits[1];
  return { c1, c2, P };
}

/* Square, rectangle and parallelogram configurations. In each one M lies on
   AD, N lies on BC, and K slides on MN. */
function square(w, tM, tN, tK) {
  const A = pt(200 - w, 150 - w), D = pt(200 + w, 150 - w);
  const B = pt(200 - w, 150 + w), Cc = pt(200 + w, 150 + w);
  const M = lerp(A, D, tM), N = lerp(B, Cc, tN);
  return C.start({ A, B, C: Cc, D, M, N, K: lerp(M, N, tK) });
}
function rectangle(w, h, tM, tN, tK) {
  const A = pt(200 - w, 150 - h), D = pt(200 + w, 150 - h);
  const B = pt(200 - w, 150 + h), Cc = pt(200 + w, 150 + h);
  const M = lerp(A, D, tM), N = lerp(B, Cc, tN);
  return C.start({ A, B, C: Cc, D, M, N, K: lerp(M, N, tK) });
}
function parallelogram(w, slant, h, tM, tN, tK) {
  const A = pt(200 - w, 150 + h), D = pt(200 + w, 150 + h);
  const B = pt(200 - w + slant, 150 - h), Cc = pt(200 + w + slant, 150 - h);
  const M = lerp(A, D, tM), N = lerp(B, Cc, tN);
  return C.start({ A, B, C: Cc, D, M, N, K: lerp(M, N, tK) });
}

const drawings = [];
for (const w of [50, 75, 100]) {
  for (const tM of [0.25, 0.5, 0.75]) {
    for (const tN of [0.25, 0.5, 0.75]) {
      for (const tK of [0.15, 0.4, 0.65, 0.9]) drawings.push(square(w, tM, tN, tK));
    }
  }
}
for (const w of [55, 85, 115]) {
  for (const h of [45, 70, 95]) {
    for (const tM of [0.3, 0.7]) {
      for (const tN of [0.3, 0.7]) {
        for (const tK of [0.2, 0.8]) drawings.push(rectangle(w, h, tM, tN, tK));
      }
    }
  }
}
for (const w of [60, 90, 110]) {
  for (const slant of [-60, -30, 30, 60]) {
    for (const h of [50, 80]) {
      for (const tM of [0.3, 0.7]) {
        for (const tN of [0.3, 0.7]) {
          for (const tK of [0.2, 0.8]) drawings.push(parallelogram(w, slant, h, tM, tN, tK));
        }
      }
    }
  }
}
const rand = rng(20261126);
for (let i = 0; i < 300; i++) {
  const u = () => 0.2 + rand() * 0.6;
  drawings.push(rectangle(50 + rand() * 70, 40 + rand() * 60, u(), u(), u()));
}
check("the sample covers both circle-intersection branches",
  drawings.some((s) => Math.abs(C.compute(s).circleAMK?.x - C.compute(s).circleCNK?.x) > 1) &&
  drawings.some((s) => Math.abs(C.compute(s).circleAMK?.x - C.compute(s).circleCNK?.x) <= 1));

{
  let badP = 0, badC1 = 0, badC2 = 0, badGuard = 0, usable = 0, nearTangent = 0;
  for (const s of drawings) {
    const core = C.compute(s), app = appDraw(s);
    const appP = app && Number.isFinite(app.P.x) ? app.P : null;
    /* Near tangency the two crossings are fractions of a pixel apart, so the
       two transcriptions pick different approximations to K. That numerical
       limit is checked separately below. */
    if ((core.P && dist(core.P, s.K) < 1e-3) ||
        (appP && dist(appP, s.K) < 1e-3)) { nearTangent++; continue; }
    if (core.degenerate || !app || !appP) {
      if (!core.degenerate && app === null) badGuard++;
      continue;
    }
    usable++;
    if (!samePt(core.P, app.P, 1e-6)) badP++;
    if (!(near(core.circleAMK.x, app.c1.x, 1e-6) &&
          near(core.circleAMK.y, app.c1.y, 1e-6) &&
          near(core.circleAMK.r, app.c1.r, 1e-6))) badC1++;
    if (!(near(core.circleCNK.x, app.c2.x, 1e-6) &&
          near(core.circleCNK.y, app.c2.y, 1e-6) &&
          near(core.circleCNK.r, app.c2.r, 1e-6))) badC2++;
  }
  check(`${nearTangent} near-tangent drawings skipped (P is K)`,
    nearTangent < drawings.length / 10);
  check(`${drawings.length} drawings: the guard agrees with Draw`, badGuard === 0, `${badGuard} wrong`);
  check(`${usable} drawable drawings: P matches Draw's second intersection`, badP === 0, `${badP} wrong`);
  check(`${usable} drawable drawings: circle AMK matches GetCircle`, badC1 === 0, `${badC1} wrong`);
  check(`${usable} drawable drawings: circle CNK matches GetCircle`, badC2 === 0, `${badC2} wrong`);

  check("Intersect returns NaN below the determinant guard",
    Number.isNaN(C.intersect(pt(0, 0), pt(0, 1), pt(5, 0), pt(5, 1)).x) &&
    Number.isNaN(appIntersect(pt(0, 0), pt(0, 1), pt(5, 0), pt(5, 1)).x));
  check("NearestPoint returns p itself inside the 0.1 guard",
    samePt(C.nearestPoint(pt(1, 1), pt(1.05, 1.05), pt(90, 4)), pt(1, 1)) &&
    samePt(appNearest(pt(1, 1), pt(1.05, 1.05), pt(90, 4)), pt(1, 1)));
  check("Circumcenter matches the bytecode on a scalene triangle", (() => {
    const p = pt(20, 180), q = pt(260, 210), r = pt(190, 40);
    return samePt(C.circumcenter(p, q, r), appCircumcenter(p, q, r), 1e-8);
  })());
  check("Intersect(circle,circle) uses the Y branch when centres share x",
    C.intersectCircles({ x: 200, y: 100, r: 90 }, { x: 200, y: 200, r: 90 }).length === 2 &&
    appCirclesY({ x: 200, y: 100, r: 90 }, { x: 200, y: 200, r: 90 }).length === 2);
}

/* ----------------------------------- 3. every claim the page makes */

{
  let badOnAC = 0, badOnCircle = 0, badAngles = 0, badStraight = 0;
  let usable = 0, skipped = 0, convex = 0;
  for (const s of drawings) {
    const g = C.compute(s);
    if (g.degenerate || !g.P) continue;
    /* When the two crossings are less than a pixel apart the applet's own
       "at least one unit from K" rule can pick K instead of the far point;
       that numerical limit is checked in the tangent section below. */
    if (dist(g.P, s.K) < 1.1) { skipped++; continue; }
    const scale = Math.max(1, dist(s.A, s.C));
    const eps = 1e-7 * scale;
    /* The theorem: P is on AC, so the signed area of ACP is zero. */
    if (Math.abs(g.acResidual) > eps) badOnAC++;
    /* K and P are on both circumcircles. */
    if (!(near(dist(g.circleAMK, g.P), g.circleAMK.r, eps) &&
          near(dist(g.circleCNK, g.P), g.circleCNK.r, eps) &&
          near(dist(g.circleAMK, s.K), g.circleAMK.r, eps) &&
          near(dist(g.circleCNK, s.K), g.circleCNK.r, eps))) badOnCircle++;
    /* The proof's step 2: AMK = KNC because AD is parallel to BC. */
    if (!near(g.angleAMK, g.angleKNC, 1e-9)) badAngles++;
    /* The proof's step 1: with AMKP convex, APK + AMK is a straight angle,
       and since AMK = KNC the angle APK + KPC is straight too. */
    if (convexAMKP(s, g.P)) {
      convex++;
      if (!near(g.angleAPK + g.angleAMK, Math.PI, 1e-9)) badStraight++;
    }
    usable++;
  }
  check(`${usable} drawings (squares, rectangles, parallelograms): P is on the diagonal AC`,
    badOnAC === 0, `${badOnAC} wrong`);
  check(`${usable} drawings: K and P lie on both circles`, badOnCircle === 0, `${badOnCircle} wrong`);
  check(`${usable} drawings: angle AMK equals angle KNC`, badAngles === 0, `${badAngles} wrong`);
  check(`${convex} convex drawings: angle APK + angle AMK is a straight angle`,
    convex > 50 && badStraight === 0, `${badStraight} wrong`);
  check(`${skipped} near-coincident crossings are counted separately`, skipped > 0 && skipped < drawings.length / 10);

  /* When MN crosses AC the two circles touch at K, the "second" point. */
  let tangentCases = 0, badTangent = 0;
  for (const w of [60, 80, 100]) {
    for (const tM of [0.25, 0.5, 0.75]) {
      for (const tN of [0.25, 0.5, 0.75]) {
        const base = square(w, tM, tN, 0.5);
        const hit = C.intersect(base.M, base.N, base.A, base.C);
        if (!C.finite(hit)) continue;
        const g = C.compute(C.start({
          A: base.A, B: base.B, C: base.C, D: base.D,
          M: base.M, N: base.N, K: hit,
        }));
        if (g.degenerate || !g.P) continue;
        tangentCases++;
        if (!g.tangent || dist(g.P, hit) > 0.5 || Math.abs(g.acResidual) > 0.01) badTangent++;
      }
    }
  }
  check(`${tangentCases} tangent limits: P = K on AC`, badTangent === 0, `${badTangent} wrong`);

  /* Sliding K changes P, but the fixed angles at M and N do not. */
  let slides = 0, badSlide = 0;
  for (const w of [60, 90, 110]) {
    for (const slant of [-40, 0, 40]) {
      for (const tM of [0.3, 0.7]) {
        for (const tN of [0.3, 0.7]) {
          const angles = [];
          for (const tK of [0.2, 0.4, 0.6, 0.8]) {
            const g = C.compute(parallelogram(w, slant, 70, tM, tN, tK));
            if (!g.degenerate && g.P && dist(g.P, g.K) > 1e-3) angles.push(g.angleAMK);
          }
          if (angles.length < 2) continue;
          slides++;
          if (Math.max(...angles) - Math.min(...angles) > 1e-12) badSlide++;
        }
      }
    }
  }
  check(`${slides} slides of K: the angle at M does not change`, badSlide === 0, `${badSlide} wrong`);
}

done("circles-and-square");
