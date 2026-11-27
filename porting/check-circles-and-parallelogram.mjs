#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-and-parallelogram/circles-and-parallelogram-core.js.
 *
 *   node porting/check-circles-and-parallelogram.mjs
 *
 * The applet is a droodle: ABCD is a parallelogram, M is on AB, N on CD, K
 * slides along MN, and the circumcircles of AMK and CNK meet again at P.
 * First the rules of the picture (the reflected corners, M/N on their sides,
 * K on MN, the three checkboxes and the refusal of broken drags) are checked.
 * Then a second, literal transcription of GeoSDoub.Intersect, NearestPoint,
 * FindCircumcenter, Intersect(circle,circle) and the canvas's GetCircle,
 * PerpBisector and Compute is compared with the core over 2,420 drawings.
 * Finally every claim on the page is tested over all of them: P is on AC and
 * on both circles, the two centres lie on fixed perpendicular bisectors, the
 * angle KP makes with AC is the same for every K, the centre line keeps its
 * direction and length, and the tangent case has P = K with the same angle.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circles-and-parallelogram/circles-and-parallelogram-core.js", "CirclesAndParallelogramCore");
const pt = (x, y) => ({ x, y });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps;
const samePt = (a, b, eps = 1e-7) => near(a.x, b.x, eps) && near(a.y, b.y, eps);
const lerp = (a, b, t) => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const deg = (r) => r * 180 / Math.PI;

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the opening A", s.A, pt(125, 225));
  equal("the opening B", s.B, pt(313, 225));
  equal("the opening C", s.C, pt(275, 75));
  equal("the opening D", s.D, pt(87, 75));
  check("the opening corners form a parallelogram about the centre",
    near(s.A.x + s.C.x, s.B.x + s.D.x) && near(s.A.y + s.C.y, s.B.y + s.D.y));
  check("M is on AB and N is on CD", s.M.y === s.A.y && s.N.y === s.C.y);
  check("K starts on MN", Math.abs(C.cross(s.M, s.N, s.K)) < 1e-9);
  check("the three checkboxes start unticked",
    !s.showNames && !s.showCenterLine && !s.showHint);
  check("an illustration has no result to announce", C.result(s) === null);
  check("all seven points are draggable",
    C.legalMoves().join(",") === "A,B,C,D,M,N,K");

  const g = C.compute(s);
  check("the opening drawing is not degenerate", !g.degenerate && !!g.P);
  check("the opening P is on the diagonal AC", Math.abs(g.acResidual) < 1e-7);
  check("the opening circles are drawn inside the board",
    g.circleAMK.r > 0 && g.circleCNK.r > 0 &&
    g.circleAMK.x - g.circleAMK.r > 0 && g.circleCNK.x + g.circleCNK.r < 400);
  check("the status describes P and the fixed angle",
    /P on the diagonal AC/.test(C.describe(s)) && /KP meets AC at/.test(C.describe(s)));

  check("an unknown point is refused", C.movePoint(s, "Q", pt(1, 1)) === s);
  check("a non-numeric pointer is refused",
    C.movePoint(s, "A", pt(NaN, 1)) === s && C.movePoint(s, "A", null) === s);
  check("dragging A reflects C and keeps AB level", (() => {
    const m = C.movePoint(s, "A", pt(150, 235));
    return m && near(m.A.x, 150) && near(m.A.y, 235) &&
      near(m.C.x, 400 - 150) && near(m.C.y, 300 - 235) &&
      near(m.B.y, m.A.y) && near(m.D.y, m.C.y);
  })());
  check("dragging B reflects D and keeps the sides level", (() => {
    const m = C.movePoint(s, "B", pt(300, 215));
    return m && near(m.B.x, 300) && near(m.B.y, 215) &&
      near(m.D.x, 100) && near(m.D.y, 85) && near(m.A.y, m.B.y);
  })());
  check("dragging C reflects A", (() => {
    const m = C.movePoint(s, "C", pt(290, 90));
    return m && m.A.x === 110 && m.A.y === 210 && m.B.y === m.A.y;
  })());
  check("dragging D reflects B", (() => {
    const m = C.movePoint(s, "D", pt(80, 80));
    return m && m.B.x === 320 && m.B.y === 220 && m.C.y === m.D.y;
  })());
  check("dragging M keeps it on AB", (() => {
    const m = C.movePoint(s, "M", pt(200, 100));
    return m && m.M.x === 200 && m.M.y === s.A.y && m.A.x === s.A.x;
  })());
  check("dragging N keeps it on CD", (() => {
    const m = C.movePoint(s, "N", pt(220, 100));
    return m && m.N.x === 220 && m.N.y === s.C.y && m.C.x === s.C.x;
  })());
  check("dragging K keeps it on MN", (() => {
    const m = C.movePoint(s, "K", pt(270, 190));
    return m && Math.abs(C.cross(m.M, m.N, m.K)) < 1e-7 && m.K.y === 190;
  })());
  check("a drag is remembered as explored",
    C.movePoint(s, "M", pt(240, 225)).explored === true);
  check("a drag that would collapse the parallelogram is refused",
    C.movePoint(s, "A", pt(310, 225)) === s);
  check("a drag off the board is clamped or refused", (() => {
    const m = C.movePoint(s, "K", pt(-99, 999));
    return m === s || (m.K.x >= C.MARGIN && m.K.x <= C.WIDTH - C.MARGIN);
  })());
  check("an unknown option is refused", C.setOption(s, "nonesuch", true) === s);
  check("all three checkboxes can be set and unset", (() => {
    let t = C.setOption(s, "showNames", true);
    t = C.setOption(t, "showCenterLine", true);
    t = C.setOption(t, "showHint", true);
    return t.showNames && t.showCenterLine && t.showHint &&
      !C.setOption(t, "showHint", false).showHint;
  })());
  check("reset restores the drawing but keeps the options", (() => {
    const moved = C.setOption(C.movePoint(s, "C", pt(290, 90)), "showHint", true);
    const r = C.reset(moved);
    return r.A.x === 125 && r.C.x === 275 && r.showHint === true &&
      r.explored === false && r.moves === 0;
  })());
  check("a degenerate drawing is reported, not drawn", (() => {
    const bad = C.start({
      A: pt(100, 200), B: pt(300, 200), C: pt(300, 200), D: pt(100, 200),
      M: pt(200, 200), N: pt(200, 200), K: pt(200, 200),
    });
    return C.compute(bad).degenerate && /Move the points apart/.test(C.describe(bad));
  })());
}

/* ------------------------- 2. a literal second transcription of the applet */

/* GeoSDoub.Intersect(p1,p2,p3,p4), straight from its bytecode. */
function apIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y;
  const b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y;
  const b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const d = a1 * b2 - a2 * b1;
  if (Math.abs(d) < 1) return pt(NaN, NaN);
  return pt((b1 * c2 - b2 * c1) / d, (c1 * a2 - c2 * a1) / d);
}

/* GeoSDoub.NearestPoint(p, a, b): the bytecode's guard is SqDist(a,p) < 0.1. */
function apNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return pt(p.x, p.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return pt(a.x + dx * t, a.y + dy * t);
}

/* GeoSDoub.FindCircumcenter: two perpendicular bisectors, then Intersect. */
function apCircumcenter(p, q, r) {
  const mAB = pt((p.x + q.x) / 2, (p.y + q.y) / 2);
  const mBC = pt((q.x + r.x) / 2, (q.y + r.y) / 2);
  const nAB = pt(mAB.x + (q.y - p.y), mAB.y - (q.x - p.x));
  const nBC = pt(mBC.x + (r.y - q.y), mBC.y - (r.x - q.x));
  return apIntersect(mAB, nAB, mBC, nBC);
}

/* Canvas.GetCircle: mean of the three distances from the circumcenter. */
function apCircle(p, q, r) {
  const o = apCircumcenter(p, q, r);
  const radius = (dist(o, p) + dist(o, q) + dist(o, r)) / 3;
  return { x: o.x, y: o.y, r: radius };
}

/* GeoSDoub.IntersectCirclesX, with the bytecode's local names m, b, h, a, k, c. */
function apCirclesX(c0, c1) {
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
function apCirclesY(c0, c1) {
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

function apCircleCross(c0, c1) {
  if (Math.abs(c0.x - c1.x) > 1) return apCirclesX(c0, c1);
  if (Math.abs(c0.y - c1.y) > 1) return apCirclesY(c0, c1);
  return [pt(c0.x, c0.y), pt(c0.x, c0.y)];
}

/* Canvas.PerpBisector(p,q): second point of the line. */
function apBis(p, q) {
  const m = pt((p.x + q.x) / 2, (p.y + q.y) / 2);
  return pt(m.x + (p.y - q.y), m.y - (p.x - q.x));
}

/* Canvas.Compute, including its four guards and its choice of P. */
function apCompute(s) {
  const { A, B, C, D, M, N, K } = s;
  const foot = apNearest(A, C, D);
  if (dist(A, B) < 1 || dist(A, C) < 1 || dist(A, D) < 1 || dist(A, foot) < 1) {
    return null;
  }
  const c1 = apCircle(A, M, K);
  const c2 = apCircle(C, N, K);
  const hits = apCircleCross(c1, c2);
  if (!hits) return null;
  const P = dist(K, hits[0]) >= 1 ? hits[0] : hits[1];
  return { c1, c2, P, pa: apBis(A, M), pc: apBis(C, N) };
}

/* Every reachable kind of drawing: half-base, slant, half-height and the
   three positions of M, N and K along their segments. */
function drawing(w, s, h, tM, tN, tK) {
  const A = pt(200 - w, 150 + h), B = pt(200 + w + s, 150 + h);
  const Cc = pt(200 + w, 150 - h), D = pt(200 - w - s, 150 - h);
  const M = lerp(A, B, tM), N = lerp(Cc, D, tN);
  return C.start({ A, B, C: Cc, D, M, N, K: lerp(M, N, tK) });
}

const drawings = [];
for (const w of [60, 90, 110]) {
  for (const s of [-60, -30, 0, 30, 60]) {
    for (const h of [50, 80, 110]) {
      for (const tM of [0.25, 0.5, 0.75]) {
        for (const tN of [0.25, 0.5, 0.75]) {
          for (const tK of [0.15, 0.4, 0.65, 0.9]) {
            drawings.push(drawing(w, s, h, tM, tN, tK));
          }
        }
      }
    }
  }
}
const rand = rng(20261126);
for (let i = 0; i < 800; i++) {
  const u = () => 0.15 + rand() * 0.7;
  drawings.push(drawing(60 + rand() * 50, -60 + rand() * 120,
    50 + rand() * 60, u(), u(), u()));
}
check("the grid and random sample cover both circle-intersection branches",
  drawings.some((s) => Math.abs(C.compute(s).circleAMK?.x - C.compute(s).circleCNK?.x) > 1) &&
  drawings.some((s) => Math.abs(C.compute(s).circleAMK?.x - C.compute(s).circleCNK?.x) <= 1));

{
  let badP = 0, badC1 = 0, badC2 = 0, badPa = 0, badPc = 0, badGuard = 0, usable = 0;
  let nearTangent = 0;
  for (const s of drawings) {
    const core = C.compute(s), app = apCompute(s);
    const appP = app && Number.isFinite(app.P.x) ? app.P : null;
    /* When the circles are nearly tangent the two crossings are a fraction
       of a pixel apart: both transcriptions return a different approximation
       to K and the chord direction is undefined. That is the applet's own
       numerical limit, checked separately below, so it is skipped here. */
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
    if (!samePt(core.perpA.q, app.pa, 1e-6)) badPa++;
    if (!samePt(core.perpC.q, app.pc, 1e-6)) badPc++;
  }
  check(`${nearTangent} near-tangent drawings skipped (undefined chord)`,
    nearTangent > 0 && nearTangent < drawings.length / 10);
  check(`${drawings.length} drawings: guards agree with the bytecode`, badGuard === 0, `${badGuard} wrong`);
  check(`${usable} drawable drawings: P matches the bytecode Compute`, badP === 0, `${badP} wrong`);
  check(`${usable} drawable drawings: circle AMK matches GetCircle`, badC1 === 0, `${badC1} wrong`);
  check(`${usable} drawable drawings: circle CNK matches GetCircle`, badC2 === 0, `${badC2} wrong`);
  check(`${usable} drawable drawings: perpendicular bisector of AM matches`, badPa === 0, `${badPa} wrong`);
  check(`${usable} drawable drawings: perpendicular bisector of CN matches`, badPc === 0, `${badPc} wrong`);

  /* The small helpers themselves, tested at the applet's own guard edges. */
  check("Intersect returns NaN below the determinant guard",
    Number.isNaN(C.intersect(pt(0, 0), pt(0, 1), pt(5, 0), pt(5, 1)).x) &&
    Number.isNaN(apIntersect(pt(0, 0), pt(0, 1), pt(5, 0), pt(5, 1)).x));
  check("NearestPoint returns p itself inside the 0.1 guard",
    samePt(C.nearestPoint(pt(1, 1), pt(1.05, 1.05), pt(90, 4)), pt(1, 1)) &&
    samePt(apNearest(pt(1, 1), pt(1.05, 1.05), pt(90, 4)), pt(1, 1)));
  check("Circumcenter matches the bytecode on a scalene triangle", (() => {
    const p = pt(20, 180), q = pt(260, 210), r = pt(190, 40);
    return samePt(C.circumcenter(p, q, r), apCircumcenter(p, q, r), 1e-8);
  })());
  check("Intersect(circle,circle) uses the Y branch when centres share x",
    C.intersectCircles({ x: 200, y: 100, r: 90 }, { x: 200, y: 200, r: 90 }).length === 2 &&
    apCirclesY({ x: 200, y: 100, r: 90 }, { x: 200, y: 200, r: 90 }).length === 2);
}

/* ----------------------------------- 3. every claim the page makes */

{
  let badOnAC = 0, badOnCircle = 0, badPerp = 0, badAngle = 0, badParallel = 0;
  let badLength = 0, badTangent = 0;
  let angleCases = 0, tangentCases = 0, tangentSkipped = 0;
  for (const s of drawings) {
    const g = C.compute(s);
    /* A nearly tangent pair has no chord to speak of; its limit is checked
       explicitly in the last part of this test. */
    if (g.degenerate || !g.P || g.tangent) { if (g.tangent) tangentSkipped++; continue; }
    const scale = Math.max(1, dist(s.A, s.C));
    const eps = 1e-7 * scale;
    /* P is on diagonal AC: the signed triangle area must vanish. */
    if (Math.abs(g.acResidual) > eps) badOnAC++;
    /* K and P are on both circumcircles. */
    if (!(near(dist(g.circleAMK, g.P), g.circleAMK.r, eps) &&
          near(dist(g.circleCNK, g.P), g.circleCNK.r, eps) &&
          near(dist(g.circleAMK, s.K), g.circleAMK.r, eps) &&
          near(dist(g.circleCNK, s.K), g.circleCNK.r, eps))) badOnCircle++;
    /* Each centre lies on the perpendicular bisector of its fixed chord. */
    for (const [line, o] of [[g.perpA, g.circleAMK], [g.perpC, g.circleCNK]]) {
      const v = C.sub(line.q, line.p);
      const d = Math.abs(C.cross(line.p, line.q, o)) / Math.hypot(v.x, v.y);
      if (d > eps) badPerp++;
    }
  }
  check(`${tangentSkipped} near-tangent drawings skipped for the chord claims`,
    tangentSkipped > 0 && tangentSkipped < drawings.length / 10);
  check(`${drawings.length} drawings: P is on the diagonal AC`, badOnAC === 0, `${badOnAC} wrong`);
  check(`${drawings.length} drawings: K and P lie on both circles`, badOnCircle === 0, `${badOnCircle} wrong`);
  check(`${drawings.length} drawings: centres lie on the fixed perpendicular bisectors`, badPerp === 0, `${badPerp} wrong`);

  /* With ABCD, M and N fixed, slide K along MN and compare what stays put. */
  for (const w of [60, 90, 110]) {
    for (const s of [-60, -30, 0, 30, 60]) {
      for (const h of [50, 80, 110]) {
        for (const tM of [0.25, 0.5, 0.75]) {
          for (const tN of [0.25, 0.5, 0.75]) {
            const angles = [], dirs = [], lengths = [];
            for (const tK of [0.1, 0.25, 0.4, 0.6, 0.75, 0.9]) {
              const g = C.compute(drawing(w, s, h, tM, tN, tK));
              if (g.degenerate || g.tangent) continue;
              angles.push(g.kpAngle);
              dirs.push(g.centerAngle);
              lengths.push(g.centerLength);
            }
            if (angles.length < 2) continue;
            angleCases++;
            const spread = (a) => Math.max(...a) - Math.min(...a);
            if (spread(angles) > 1e-11) badAngle++;       // < 6e-10 degrees
            if (spread(dirs) > 1e-11) badParallel++;
            if (spread(lengths) / Math.max(...lengths) > 1e-10) badLength++;
          }
        }
      }
    }
  }
  check(`${angleCases} slides: KP makes the same angle with AC for every K`, badAngle === 0, `${badAngle} wrong`);
  check(`${angleCases} slides: the line of centres stays parallel`, badParallel === 0, `${badParallel} wrong`);
  check(`${angleCases} slides: the line of centres keeps its length`, badLength === 0, `${badLength} wrong`);

  /* In the tangent limit K = P is where MN crosses AC; the tangent there
     makes the same (fixed) angle with AC as the chord did before the limit. */
  for (const w of [60, 90, 110]) {
    for (const s of [-60, -30, 0, 30, 60]) {
      for (const tM of [0.25, 0.5, 0.75]) {
        for (const tN of [0.25, 0.5, 0.75]) {
          const base = drawing(w, s, 80, tM, tN, 0.5);
          const hit = C.intersect(base.M, base.N, base.A, base.C);
          if (!C.finite(hit)) continue;
          const state = C.start({
            A: base.A, B: base.B, C: base.C, D: base.D,
            M: base.M, N: base.N, K: hit,
          });
          const g = C.compute(state);
          if (g.degenerate || !g.P) continue;
          tangentCases++;
          if (!g.tangent || dist(g.P, state.K) > 0.5) badTangent++;
          const nearbyState = C.start({
            A: base.A, B: base.B, C: base.C, D: base.D,
            M: base.M, N: base.N, K: lerp(hit, base.N, 0.1),
          });
          const nearby = C.compute(nearbyState);
          if (!nearby.degenerate && Math.abs(deg(g.tangentAngle) - deg(nearby.kpAngle)) > 0.01) {
            badTangent++;
          }
        }
      }
    }
  }
  check(`${tangentCases} tangent limits: P = K and the tangent keeps the angle`,
    badTangent === 0, `${badTangent} wrong`);
}

done("circles-and-parallelogram");
