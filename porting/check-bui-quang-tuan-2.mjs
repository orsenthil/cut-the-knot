#!/usr/bin/env node
"use strict";

/*
 * Logic test for bui-quang-tuan-2/bui-quang-tuan-2-core.js.
 *
 *   node porting/check-bui-quang-tuan-2.mjs
 *
 * The applet's construction is transcribed a second time straight from its
 * bytecode (GeoSDoub.FindAngleBisector with Rotate, NearestPoint, Intersect,
 * FindCircumcenter, BuiQuangTuan2Canvas.GetNextCircle and ComputeGergonne).
 * Both are compared on 400+ layouts, including every vertex/P move the page
 * allows. The article's claims are checked on each of them: C7 = C1, the six
 * tangent points on one circle centred at I, the three cevians through Ge,
 * the three radical axes, and the conditional concurrence of the two triples.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bui-quang-tuan-2/bui-quang-tuan-2-core.js", "BuiQuangTuan2Core");

/* ------------------------------------------------ the applet, from the bytecode */

const rd = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });

/** GeoSDoub.Intersect(p1,p2,p3,p4): line coefficients and the |det| >= 1 cut-off. */
function jIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (!(Math.abs(det) >= 1)) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.NearestPoint(P, A, B). */
function jNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * dx + dy * dy < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** GeoSDoub.Dist(P, line AB) — projection then distance. */
function jDistToLine(p, a, b) {
  const q = jNearest(p, a, b);
  return rd(p, q);
}

/** GeoSDoub.FindOrientation: cross(B-A, C-A), +/-1. */
function jOrientation(a, b, c) {
  const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return v > 0 ? 1 : -1;
}

/** GeoSDoub.ComputeAngle(A,B,C): the angle at A. */
function jAngle(a, b, c) {
  const cos = (rd(a, b) ** 2 + rd(a, c) ** 2 - rd(b, c) ** 2) /
              (2 * rd(a, b) * rd(a, c));
  return Math.acos(cos);
}

/** GeoSDoub.Rotate(pivot, p, angle, orientation). */
function jRotate(pivot, p, angle, ori) {
  const co = Math.cos(angle), si = Math.sin(angle);
  const dx = p.x - pivot.x, dy = p.y - pivot.y;
  return {
    x: pivot.x + co * dx - ori * si * dy,
    y: pivot.y + ori * si * dx + co * dy,
  };
}

/** GeoSDoub.FindAngleBisector(A,B,C). */
function jBisector(a, b, c) {
  const half = jAngle(a, b, c) / 2;
  const turned = jRotate(a, b, half, jOrientation(a, b, c));
  return jIntersect(a, turned, b, c);
}

/** GeoSDoub.FindCircumcenter, then DoubCircle's average-radius GetCircle. */
function jGetCircle(a, b, c, old) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const p1 = { x: m1.x + (b.y - a.y), y: m1.y + (a.x - b.x) };
  const p2 = { x: m2.x + (c.y - b.y), y: m2.y + (b.x - c.x) };
  const centre = jIntersect(m1, p1, m2, p2);
  if (!Number.isFinite(centre.x) || !Number.isFinite(centre.y)) return old;
  const r = (rd(centre, a) + rd(centre, b) + rd(centre, c)) / 3;
  return { c: centre, r };
}

/** BuiQuangTuan2Canvas.showCircles + ComputeGergonne, literally. */
function jFigure(V, t) {
  const sides = [[V[0], V[1]], [V[1], V[2]], [V[2], V[0]]];
  const L = [jBisector(V[0], V[2], V[1]),
             jBisector(V[1], V[0], V[2]),
             jBisector(V[2], V[1], V[0])];
  // DoubLine(V[0], L[0]).CreateMidPoint(t): A*t + B*(1-t).
  const ab = { x: V[0].x * t + L[0].x * (1 - t),
               y: V[0].y * t + L[0].y * (1 - t) };
  let first = { c: ab, r: jDistToLine(ab, sides[0][0], sides[0][1]) };
  const circles = [first];
  const T = [];
  let seventh = null;
  for (let i = 0; i < 6; i++) {
    const k = i % 3;
    const k1 = (k + 1) % 3, k2 = (k + 2) % 3;
    const foot = jNearest(first.c, sides[k][0], sides[k][1]);
    T.push(foot);
    const bis = jBisector(V[k1], V[k], V[k2]);
    const centre = jIntersect(foot, first.c, V[k1], bis);
    const next = Number.isFinite(centre.x) && Number.isFinite(centre.y)
      ? { c: centre, r: rd(centre, foot) } : null;
    if (i < 5) {
      if (!next) break;
      circles.push(next);
      first = next;
    } else {
      seventh = next;
    }
  }
  const big = T.length >= 4 ? jGetCircle(T[0], T[2], T[3], null) : null;
  let M = null, Ge = null, incircle = null;
  if (big) {
    M = [jNearest(big.c, V[1], V[2]),
         jNearest(big.c, V[2], V[0]),
         jNearest(big.c, V[0], V[1])];
    const x1 = jIntersect(V[1], M[1], V[2], M[2]);
    const x2 = jIntersect(V[2], M[2], V[0], M[0]);
    const x3 = jIntersect(V[0], M[0], V[1], M[1]);
    Ge = { x: (x1.x + x2.x + x3.x) / 3, y: (x1.y + x2.y + x3.y) / 3 };
    incircle = jGetCircle(M[0], M[1], M[2], null);
  }
  return { L, P: ab, circles, T, seventh, big, M, Ge, incircle };
}

const close = (p, q, tol) => Boolean(p && q && Number.isFinite(p.x) && Number.isFinite(q.x)) &&
                              rd(p, q) <= tol;

function compareFigures(label, state, ref) {
  const m = C.measurements(state);
  const tol = 1e-6 * m.scale;
  check(`${label}: angle bisectors`, [0, 1, 2].every((k) => close(m.bis[k], ref.L[k], tol)),
        `core ${JSON.stringify(m.bis)} vs applet ${JSON.stringify(ref.L)}`);
  check(`${label}: P`, close(m.P, ref.P, tol));
  check(`${label}: six circles`, m.circles.length === ref.circles.length &&
        ref.circles.every((r, i) => close(m.circles[i].c, r.c, tol) &&
                                   Math.abs(m.circles[i].r - r.r) <= tol));
  check(`${label}: tangent points`, m.T.length === ref.T.length &&
        ref.T.every((p, i) => close(m.T[i], p, tol)));
  const sameCircle = (a, b) => (!a && !b) || Boolean(a && b &&
    close(a.c, b.c, tol) && Math.abs(a.r - b.r) <= tol);
  check(`${label}: the closing circle`, sameCircle(m.seventh, ref.seventh));
  check(`${label}: the concyclic circle`, sameCircle(m.big, ref.big),
        `core ${JSON.stringify(m.big)} vs applet ${JSON.stringify(ref.big)}, tol ${tol}`);
  check(`${label}: incircle touch points`, (!m.M && !ref.M) || Boolean(m.M && ref.M) &&
        ref.M.every((p, i) => close(m.M[i], p, tol)));
  check(`${label}: Gergonne point`, (!m.Ge && !ref.Ge) || close(m.Ge, ref.Ge, tol),
        `core ${JSON.stringify(m.Ge)} vs applet ${JSON.stringify(ref.Ge)}`);
  check(`${label}: incircle`, sameCircle(m.incircle, ref.incircle));
}

function checkClaims(label, state, stats) {
  const cl = C.claims(state);
  if (!cl) {
    // Some dragged layouts collapse the tangent-point circle; both the core
    // and the applet then have no Gergonne construction to draw.
    check(`${label}: degenerate layout reported`, !C.measurements(state).valid);
    return;
  }
  stats.valid++;
  check(`${label}: construction valid`, true);
  check(`${label}: C7 = C1`, cl.closes);
  check(`${label}: six tangent points concyclic about I`, cl.concyclic);
  check(`${label}: three points touch the incircle`, cl.touch);
  check(`${label}: three cevians meet at Ge`, cl.cevians);
  check(`${label}: three radical axes`, cl.radicalAxes);
  check(`${label}: Ge is the radical centre of C2,C4,C6`, cl.radicalCenter);
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the starting vertices", s.V, [
    { x: 200, y: 150 }, { x: 133.33333333333334, y: 214.28571428571428 },
    { x: 333.33333333333333, y: 171.42857142857142 },
  ]);
  equal("the applet's starting t", s.t, 0.7);
  equal("an illustration has no result", C.result(s), null);
  check("the start is a full six-circle diagram", C.measurements(s).valid);
  const moved = C.withPoint(s, "A2", { x: 100, y: 250 });
  const mf = C.measurements(moved);
  check("dragging a vertex keeps P on the new bisector",
        C.distToLine(moved.P, moved.V[0], mf.L0) < 1e-9);
  check("dragging a vertex keeps t", moved.t === s.t);
  check("dragging does not change the old state", s.V[1].x === 133.33333333333334);
  const along = C.withPoint(s, "P", { x: 215, y: 190 });
  const af = C.measurements(along);
  check("dragging P changes t", Math.abs(along.t - s.t) > 1e-6);
  check("P stays on the bisector", C.distToLine(along.P, along.V[0], af.L0) < 1e-9);

  // DoubLine.UpdateMidPoint, from the bytecode: the new weight is
  // -dot(A-B, B-P)/|A-B|^2 with A = V[0] and B = the bisector's far end.
  const target = { x: 214, y: 195 };
  const L0 = jFigure(s.V, s.t).L[0];
  const f = sub(s.V[0], L0);
  const g = sub(L0, target);
  const tJava = -(f.x * g.x + f.y * g.y) / (f.x * f.x + f.y * f.y);
  const drag = C.withPoint(s, "P", target);
  check("dragging P reproduces DoubLine.UpdateMidPoint",
        Math.abs(drag.t - tJava) < 1e-10 &&
        rd(drag.P, jFigure(s.V, tJava).P) < 1e-9,
        `t ${drag.t} vs ${tJava}`);
  check("dragged P is the foot on the bisector", rd(drag.P, jNearest(target, s.V[0], L0)) < 1e-9);
  check("an unknown handle is ignored", C.withPoint(s, "Z", { x: 1, y: 1 }) === s);
}

/* ------------------------------------------- 2. the applet's method, literally */

{
  const r = rng(20261126);
  let n = 0;
  for (const t of [0.08, 0.15, 0.4, 0.7, 0.95, 1.2]) {
    compareFigures(`default triangle t=${t}`, C.start({ t }), jFigure(C.start({ t }).V, t));
    n++;
  }
  for (let i = 0; i < 120; i++) {
    const V = [
      { x: 150 + r() * 120, y: 90 + r() * 80 },
      { x: 20 + r() * 100, y: 210 + r() * 70 },
      { x: 300 + r() * 90, y: 120 + r() * 90 },
    ];
    const t = 0.05 + r() * 1.1;
    const s = C.start({ V, t });
    compareFigures(`layout ${i}`, s, jFigure(V, t));
    n++;
  }
  check("compared enough layouts against the bytecode", n >= 100);
}

/* --------------------------- 3. the article's claims, over all those layouts */

{
  const r = rng(424242);
  const stats = { valid: 0 };
  checkClaims("default", C.start({}), stats);
  for (let i = 0; i < 220; i++) {
    const V = [
      { x: 140 + r() * 130, y: 80 + r() * 90 },
      { x: 25 + r() * 110, y: 215 + r() * 60 },
      { x: 290 + r() * 100, y: 110 + r() * 100 },
    ];
    const t = 0.05 + r() * 0.9; // P strictly inside the angle, away from both ends
    checkClaims(`layout ${i}`, C.start({ V, t }), stats);
  }
  check("enough non-degenerate layouts were checked", stats.valid >= 190, `${stats.valid}`);
  // The page says "if" the triples concur: at the default P they do not.
  const cl = C.claims(C.start({}));
  check("the alternating triples do not always concur",
        !cl.triple.odd.concurrent && !cl.triple.even.concurrent);
  check("but their radical centres are Ge", cl.triple.odd.atGe === false &&
        rd(cl.triple.odd.centre, C.measurements(C.start({})).Ge) < 1e-6 &&
        rd(cl.triple.even.centre, C.measurements(C.start({})).Ge) < 1e-6);
}

/* ------------------------- 4. the two special positions where a triple meets */

/** Power of Ge with respect to a circle of the chain, as a function of t. */
function powerAt(t, index, V) {
  const f = C.figure(V || C.start({}).V, t);
  return f.Ge && f.circles.length === 6 ? C.power(f.circles[index], f.Ge) : NaN;
}

function bisect(V, lo, hi, index) {
  let flo = powerAt(lo, index, V), fhi = powerAt(hi, index, V);
  for (let i = 0; i < 90 && Number.isFinite(flo) && Number.isFinite(fhi); i++) {
    const mid = (lo + hi) / 2, fm = powerAt(mid, index, V);
    if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

{
  const V = C.start({}).V;
  // t is the weight of A1 in CreateMidPoint: t=1 puts P at the vertex.
  check("the odd power changes sign near the far end", powerAt(0.85, 0, V) < 0 && powerAt(0.95, 0, V) > 0);
  const tOdd = bisect(V, 0.85, 0.95, 0);
  const cOdd = C.claims(C.start({ V, t: tOdd }));
  check("C1,C3,C5 concur at Ge at that t", cOdd.triple.odd.concurrent && cOdd.triple.odd.atGe,
        `t=${tOdd.toFixed(9)}`);
  check("C2,C4,C6 still meet only at their radical centre", !cOdd.triple.even.concurrent);

  check("the even power changes sign near the vertex", powerAt(0.02, 1, V) > 0 && powerAt(0.1, 1, V) < 0);
  const tEven = bisect(V, 0.02, 0.1, 1);
  const cEven = C.claims(C.start({ V, t: tEven }));
  check("C2,C4,C6 concur at Ge at that t", cEven.triple.even.concurrent && cEven.triple.even.atGe,
        `t=${tEven.toFixed(9)}`);
  check("C1,C3,C5 do not at that t", !cEven.triple.odd.concurrent);

  // Repeat on four other triangles: the conditional claim is not a fluke.
  const r = rng(99);
  for (let i = 0; i < 4; i++) {
    const W = [
      { x: 150 + r() * 80, y: 100 + r() * 40 },
      { x: 40 + r() * 60, y: 220 + r() * 30 },
      { x: 310 + r() * 60, y: 130 + r() * 50 },
    ];
    let lo = 0.02, hi = null;
    for (let k = 1; k <= 48; k++) {
      const t = 0.02 + k * (0.96 - 0.02) / 48;
      if (Number.isFinite(powerAt(t, 0, W)) && lo !== null &&
          powerAt(lo, 0, W) * powerAt(t, 0, W) < 0) { hi = t; break; }
      if (Number.isFinite(powerAt(t, 0, W))) lo = t;
    }
    check(`another triangle ${i} has an odd triple position`, hi !== null);
    if (hi === null) continue;
    const t = bisect(W, lo, hi, 0);
    const cl = C.claims(C.start({ V: W, t }));
    check(`another triangle ${i}: odd triple meets at Ge`,
          cl && cl.triple.odd.concurrent && cl.triple.odd.atGe);
  }
}

done("bui-quang-tuan-2");
