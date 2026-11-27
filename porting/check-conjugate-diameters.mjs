#!/usr/bin/env node
"use strict";

/*
 * Logic test for conjugate-diameters/conjugate-diameters-core.js.
 *
 *   node porting/check-conjugate-diameters.mjs
 *
 * The first half writes the applet's own arithmetic out a second time,
 * literally from the bytecode (CTKEllipse.EllipseAt / TangentAt / Intersect /
 * KeepOnEllipse / MaintainRect, CTKGeometryPlus.Prorate, GeoSDoub.Dist /
 * GetParallelTo / Intersect / ComputeSignedAngle, DoubCircle.Tangent,
 * DoubLine.CreateMidPoint / UpdateMidPoint, and
 * ConjugateDiametersCanvas.Compute / GetLineCoefs), then compares the core with
 * it over thousands of ellipses, values of t and chord midpoints.
 *
 * The second half checks every claim on the cut-the-knot page: parallel chords
 * have midpoints on a diameter; the tangents at their ends meet there too; the
 * two slopes are -(b/a)cot(t) and (b/a)tan(t) with product -b²/a² (perpendicular
 * only for a circle); the symmetry when the roles are swapped; and both
 * theorems of Apollonius (OP²+OQ² = a²+b² and tangent-parallelogram area 4ab).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("conjugate-diameters/conjugate-diameters-core.js", "ConjugateDiametersCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) =>
  finite(p) && finite(q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const byX = (a, b) => (a.x - b.x) || (a.y - b.y);

function distToLine(p, a, b) {
  const len = dist(a, b);
  if (!len) return Infinity;
  return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
}

/* --------------------------------- the applet's own arithmetic, from bytecode */

/* GeoSDoub.Dist / SqDist. */
const appletSqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const appletDist = (a, b) => Math.sqrt(appletSqDist(a, b));

/* CTKEllipse(MoveablePoint[]) and EllipseUpdated, literal. */
function appletEllipse(V) {
  const center = P((V[0].x + V[1].x) / 2, (V[1].y + V[2].y) / 2);
  return { center, inf: P(center.x + 200, center.y),
    A: (V[1].x - V[0].x) / 2, B: (V[1].y - V[2].y) / 2 };
}

/* CTKEllipse.EllipseAt(t), literal. */
function appletEllipseAt(e, t) {
  return P(e.center.x + e.A * Math.cos(t), e.center.y + e.B * Math.sin(t));
}

/* GeoSDoub.FindOrientation and ComputeSignedAngle, literal (no cosine clamp). */
function appletOrientation(a, b, c) {
  const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return s > 0 ? 1 : -1;
}
function appletSignedAngle(a, b, c) {
  const v = (appletSqDist(a, b) + appletSqDist(a, c) - appletSqDist(b, c)) /
    (2 * appletDist(a, b) * appletDist(a, c));
  return appletOrientation(a, b, c) === 1 ? Math.acos(v) : -Math.acos(v);
}

/* CTKEllipse.KeepOnEllipse, literal. */
function appletKeepOnEllipse(e, p) {
  const u = P((p.x - e.center.x) / e.A, (p.y - e.center.y) / e.B);
  const onUnitCircle = P(e.center.x + u.x, e.center.y + u.y);
  return appletEllipseAt(e, appletSignedAngle(e.center, e.inf, onUnitCircle));
}

/* CTKEllipse.MaintainRect(p), literal, following each of the four branches. */
function appletMaintainRect(V, index, p) {
  const center = appletEllipse(V).center;
  const dx = center.x - p.x, dy = center.y - p.y;
  const v = V.map((q) => P(q.x, q.y));
  v[index] = P(p.x, p.y); // BetterMover.UpdateLocation moved the point first
  const set = (i, x, y) => { v[i].x = x; v[i].y = y; };
  if (index === 0) {
    set(1, center.x + dx, center.y - dy);
    set(2, center.x + dx, center.y + dy);
    set(3, center.x - dx, center.y + dy);
  } else if (index === 1) {
    set(0, center.x + dx, center.y - dy);
    set(2, center.x - dx, center.y + dy);
    set(3, center.x + dx, center.y + dy);
  } else if (index === 2) {
    set(0, center.x + dx, center.y + dy);
    set(1, center.x - dx, center.y + dy);
    set(3, center.x + dx, center.y - dy);
  } else {
    set(0, center.x - dx, center.y + dy);
    set(1, center.x + dx, center.y + dy);
    set(2, center.x + dx, center.y - dy);
  }
  return v;
}

/* CTKGeometryPlus.Prorate(p, anchor, d), literal: p + (d/dist)(anchor-p). */
function appletProrate(p, anchor, d) {
  const len = appletDist(p, anchor);
  if (len < 0.1) return P(p.x, p.y);
  const k = d / len;
  return P(p.x + (anchor.x - p.x) * k, p.y + (anchor.y - p.y) * k);
}

/* GeoSDoub.GetParallelTo(p, a, b), literal: p + 100*(b-a). */
function appletGetParallelTo(p, a, b) {
  return P(p.x + 100 * (b.x - a.x), p.y + 100 * (b.y - a.y));
}

/* DoubCircle(0,0,1000).Tangent(u), literal. */
function appletCircleTangent(u) {
  const len = Math.sqrt((u.x - 0) ** 2 + (u.y - 0) ** 2);
  if (Math.abs(len - 1000) > 1) return null;
  return P(u.x + (0 - u.y), u.y - (0 - u.x));
}

/* CTKEllipse.TangentAt(p), literal: stretch the circle tangent back. */
function appletTangentAt(e, p) {
  const u = P(((p.x - e.center.x) / e.A) * 1000, ((p.y - e.center.y) / e.B) * 1000);
  const t = appletCircleTangent(u);
  if (!t) return null;
  return { p, q: P(e.center.x + (t.x * e.A) / 1000, e.center.y + (t.y * e.B) / 1000) };
}

/* GeoSDoub.Intersect(a,b,c,d), literal: Cramer solve with |det| < 1 => NaN. */
function appletIntersect(a, b, c, d) {
  const s4 = a.y - b.y, s6 = b.x - a.x, s8 = a.x * b.y - a.y * b.x;
  const s10 = c.y - d.y, s12 = d.x - c.x, s14 = c.x * d.y - c.y * d.x;
  const det = s6 * s10 - s12 * s4;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((s8 * s12 - s14 * s6) / det, (s4 * s14 - s10 * s8) / det);
}
const appletIntersectLines = (l, m) => appletIntersect(l.p, l.q, m.p, m.q);

/* ConjugateDiametersCanvas.GetLineCoefs(a,b), literal. */
function appletGetLineCoefs(a, b) {
  const s4 = b.y - a.y, s6 = b.x - a.x;
  return [s4, -s6, -a.x * s4 + a.y * s6];
}

/* GeoSDoub.IntersectX(DoubLine,DoubCircle), literal. */
function appletIntersectX(l, c) {
  const m = (l.p.x - l.q.x) / (l.p.y - l.q.y);
  const s4 = l.q.x - m * l.q.y;
  const s8 = m * (s4 - c.x) - c.y;
  const s10 = c.y * c.y + (s4 - c.x) * (s4 - c.x) - 1000 * 1000;
  const s12 = s8 * s8 - (m * m + 1) * s10;
  if (s12 < 0) return null;
  const root = Math.sqrt(s12);
  const x1 = (-s8 + root) / (m * m + 1), x2 = (-s8 - root) / (m * m + 1);
  return [P(m * x1 + s4, x1), P(m * x2 + s4, x2)];
}

/* GeoSDoub.IntersectY(DoubLine,DoubCircle), literal. */
function appletIntersectY(l, c) {
  const m = (l.p.y - l.q.y) / (l.p.x - l.q.x);
  const s4 = l.q.y - m * l.q.x;
  const s8 = m * (s4 - c.y) - c.x;
  const s10 = c.x * c.x + (s4 - c.y) * (s4 - c.y) - 1000 * 1000;
  const s12 = s8 * s8 - (m * m + 1) * s10;
  if (s12 < 0) return null;
  const root = Math.sqrt(s12);
  const y1 = (-s8 + root) / (m * m + 1), y2 = (-s8 - root) / (m * m + 1);
  return [P(y1, m * y1 + s4), P(y2, m * y2 + s4)];
}

/* GeoSDoub.Intersect(DoubCircle,DoubLine) + CTKEllipse.Intersect, literal. */
function appletEllipseIntersect(e, A, B, C) {
  const s5 = A * e.center.x + B * e.center.y + C;
  const a1 = A * e.A, b1 = B * e.B;
  const p9 = P(0, (-s5 / b1) * 1000);
  const p10 = P((-s5 / a1) * 1000, 0);
  const circle = P(0, 0);
  const hits = Math.abs(p9.y - p10.y) > 1
    ? appletIntersectX({ p: p9, q: p10 }, circle)
    : Math.abs(p9.x - p10.x) > 1
      ? appletIntersectY({ p: p9, q: p10 }, circle)
      : null;
  if (!hits) return null;
  return hits.map((u) => P((u.x * e.A) / 1000 + e.center.x,
    (u.y * e.B) / 1000 + e.center.y));
}

/* DoubLine.CreateMidPoint(t): p*t + q*(1-t). */
function appletMidPoint(p, q, t) {
  return P(p.x * t + q.x * (1 - t), p.y * t + q.y * (1 - t));
}

/* DoubLine.UpdateMidPoint(): the same t parameter, clamped to [0,1]. */
function appletUpdateParam(p, q, r) {
  const dx = p.x - q.x, dy = p.y - q.y;
  const t = -((dx * (q.x - r.x) + dy * (q.y - r.y)) / (dx * dx + dy * dy));
  return Math.max(0, Math.min(1, t));
}

/* ConjugateDiametersCanvas.Compute, literal. */
function appletCompute(state) {
  const e = appletEllipse(state.V);
  const tangentP = appletTangentAt(e, state.P);
  if (!tangentP) return null;
  const Pp = appletProrate(state.P, e.center, 2 * appletDist(state.P, e.center));
  const tangentPp = appletTangentAt(e, Pp);
  const R = appletMidPoint(state.P, Pp, state.t);
  const chordQ = appletGetParallelTo(R, tangentP.p, tangentP.q);
  const coefs = appletGetLineCoefs(R, chordQ);
  const S = appletEllipseIntersect(e, coefs[0], coefs[1], coefs[2]);
  const tangentS = S && finite(S[0])
    ? [appletTangentAt(e, S[0]), appletTangentAt(e, S[1])] : [null, null];
  const U = tangentS[0] && tangentS[1]
    ? appletIntersectLines(tangentS[0], tangentS[1]) : P(NaN, NaN);
  const QQ = { p: e.center, q: appletGetParallelTo(e.center, tangentP.p, tangentP.q) };
  return { e, P: state.P, Pp, R, tangentP, tangentPp,
    PP: { p: state.P, q: Pp }, S, tangentS, U, QQ };
}

/* ------------------------------------------------------------- test helpers */

/** Rectangle V0..V3 with centre (200,150) and half-axes a,b. */
function rect(a, b) {
  return [P(200 - a, 150 + b), P(200 + a, 150 + b),
    P(200 + a, 150 - b), P(200 - a, 150 - b)];
}

function config(a, b, t, param) {
  const V = rect(a, b);
  const e = appletEllipse(V);
  const Ppt = appletEllipseAt(e, t);
  const Pp = appletProrate(Ppt, e.center, 2 * appletDist(Ppt, e.center));
  const R = appletMidPoint(Ppt, Pp, param);
  return { view: { width: 400, height: 300 }, V, P: Ppt, R, t: param,
    explored: false, names: false };
}

function configurations() {
  const out = [];
  for (const a of [30, 50, 80, 110]) {
    for (const b of [20, 30, 60]) {
      for (let i = 0; i < 24; i++) {
        const t = -Math.PI + ((i + 0.5) * Math.PI * 2) / 24;
        for (const param of [0.05, 0.25, 0.4, 0.75, 0.95]) out.push(config(a, b, t, param));
      }
    }
  }
  return out;
}

const ALL = configurations();

/* ----------------------------------------------------- 1. the starting state */

{
  const s = C.start({});
  const e = C.ellipseFrom(s.V);
  check("start builds the applet's 400x300 bounding rectangle",
    s.V.length === 4 && e.center.x === 200 && e.center.y === 150 &&
    e.A === 50 && e.B === 30, JSON.stringify(s.V));
  const wantP = appletEllipseAt(appletEllipse(s.V), C.START_ANGLE);
  check("start puts P at EllipseAt(-3π/4)", closePoint(s.P, wantP, 1e-12));
  const wantR = appletMidPoint(s.P, appletProrate(s.P, e.center, 2 * appletDist(s.P, e.center)), 0.4);
  check("start puts R at PP.CreateMidPoint(0.4)", closePoint(s.R, wantR, 1e-12));
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("the saved position is plain board-unit data",
    Array.isArray(C.position(s).V) && finite(C.position(s).R) &&
    C.position(s).explored === false && Number.isFinite(C.position(s).t));
}

/* --------------- 2. second transcription of the applet, over every setting */

{
  let pOk = 0, ppOk = 0, rOk = 0, sOk = 0, uOk = 0, tOk = 0, n = 0;
  for (const state of ALL) {
    const g = C.compute(state), a = appletCompute(state);
    const tol = 1e-5;
    n++;
    if (closePoint(g.P, a.P, tol)) pOk++;
    if (closePoint(g.Pp, a.Pp, tol)) ppOk++;
    if (closePoint(g.R, a.R, tol)) rOk++;
    if (g.S && a.S && g.S.length === 2 && a.S.length === 2 &&
        g.S.slice().sort(byX).every((p, i) => closePoint(p, a.S.slice().sort(byX)[i], tol))) sOk++;
    if (closePoint(g.U, a.U, tol)) uOk++;
    if (g.tangentP && a.tangentP && closePoint(g.tangentP.p, a.tangentP.p, tol) &&
        closePoint(g.tangentP.q, a.tangentP.q, tol) &&
        g.tangentPp && a.tangentPp && closePoint(g.tangentPp.q, a.tangentPp.q, tol)) tOk++;
  }
  check(`core P equals EllipseAt in all ${n} configurations`, pOk === n, `${pOk}/${n}`);
  check(`core P' equals SetPp's Prorate in all ${n} configurations`, ppOk === n, `${ppOk}/${n}`);
  check(`core R equals CreateMidPoint in all ${n} configurations`, rOk === n, `${rOk}/${n}`);
  check(`core chord ends equal CTKEllipse.Intersect in all ${n} configurations`,
    sOk === n, `${sOk}/${n}`);
  check(`core U equals GeoSDoub.Intersect of the tangents in all ${n} configurations`,
    uOk === n, `${uOk}/${n}`);
  check(`core tangents equal TangentAt in all ${n} configurations`, tOk === n, `${tOk}/${n}`);
}

/* -------------------------------------------- 3. the page's claims, exhaustively */

{
  const flags = {
    chordMidpoint: 0, chordEnds: 0, rOnPP: 0, onEllipse: 0, parallel: 0,
    uOnTangents: 0, uOnPP: 0, slopes: 0, perpendicular: 0,
    apollonius1: 0, apollonius2: 0,
  };
  for (const state of ALL) {
    const c = C.claims(state);
    const g = c.geometry;
    const tol = 1e-5 * 4 * Math.max(1, g.ellipse.A, g.ellipse.B, 200, 150);
    if (c.chordMidpoint) flags.chordMidpoint++;
    if (c.chordEndsOnEllipse) flags.chordEnds++;
    if (c.rOnPP) flags.rOnPP++;
    if (c.pOnEllipse) flags.onEllipse++;
    if (c.tangentsParallel) flags.parallel++;
    if (c.uOnTangents) flags.uOnTangents++;
    if (c.uOnPP) flags.uOnPP++;
    if (c.slopeProduct) flags.slopes++;
    if (c.perpendicularOnlyForCircle) flags.perpendicular++;
    if (c.apollonius1) flags.apollonius1++;
    if (c.apollonius2) flags.apollonius2++;
    /* Independent measurement of the page's claim that the tangents at the
       chord's endpoints meet on its midpoint diameter. */
    if (finite(g.U) && distToLine(g.U, g.PP.p, g.PP.q) > tol) flags.uOnPP--;
    if (g.S && g.S.length === 2 && g.S.every(finite) &&
        dist(C.midpoint(g.S[0], g.S[1]), g.R) > tol) flags.chordMidpoint--;
  }
  const n = ALL.length;
  check(`midpoints of chords parallel to QQ lie on PP (${n} cases)`,
    flags.chordMidpoint === n, `${flags.chordMidpoint}/${n}`);
  check(`both chord ends are on the ellipse (${n} cases)`, flags.chordEnds === n, `${flags.chordEnds}/${n}`);
  check(`R stays on the diameter PP (${n} cases)`, flags.rOnPP === n, `${flags.rOnPP}/${n}`);
  check(`P and P' stay on the ellipse (${n} cases)`, flags.onEllipse === n, `${flags.onEllipse}/${n}`);
  check(`the tangents at P and P' are parallel (${n} cases)`, flags.parallel === n, `${flags.parallel}/${n}`);
  check(`the tangents at T and T' meet at U (${n} cases)`, flags.uOnTangents === n, `${flags.uOnTangents}/${n}`);
  check(`U lies on PP, the midpoint diameter (${n} cases)`, flags.uOnPP === n, `${flags.uOnPP}/${n}`);
  check(`the two slopes multiply to -b²/a² (${n} cases)`, flags.slopes === n, `${flags.slopes}/${n}`);
  check(`conjugate diameters are perpendicular only when a=b (${n} cases)`,
    flags.perpendicular === n, `${flags.perpendicular}/${n}`);
  check(`first theorem of Apollonius, OP²+OQ²=a²+b² (${n} cases)`,
    flags.apollonius1 === n, `${flags.apollonius1}/${n}`);
  check(`second theorem of Apollonius, tangent parallelogram area=4ab (${n} cases)`,
    flags.apollonius2 === n, `${flags.apollonius2}/${n}`);
}

/* ------------------------- 4. the page's parameter formulas, checked directly */

{
  let slopeOk = 0, midpointOk = 0, swappedMid = 0, swappedTang = 0, n = 0;
  for (const a of [25, 50, 90]) {
    for (const b of [18, 35, 60]) {
      const V = rect(a, b), e = appletEllipse(V);
      for (let i = 0; i < 36; i++) {
        const t = -Math.PI + ((i + 0.5) * Math.PI * 2) / 36;
        const rp = appletEllipseAt(e, t), rm = appletEllipseAt(e, t + Math.PI / 2);
        const rOpposite = appletEllipseAt(e, t - Math.PI / 2);
        for (const v of [0.15, 0.4, 0.8, 1.15]) {
          const plus = appletEllipseAt(e, t + v), minus = appletEllipseAt(e, t - v);
          const slope = (plus.y - minus.y) / (plus.x - minus.x);
          const wantSlope = -(b / a) * Math.cos(t) / Math.sin(t);
          if (close(slope, wantSlope, 1e-6)) slopeOk++;
          const mid = P((plus.x + minus.x) / 2, (plus.y + minus.y) / 2);
          const wantMid = P(e.center.x + Math.cos(v) * a * Math.cos(t),
            e.center.y + Math.cos(v) * b * Math.sin(t));
          if (closePoint(mid, wantMid, 1e-6)) midpointOk++;
          n++;
        }
        /* Swap the roles: chords parallel to PP have midpoints on QQ, and
           their tangents meet on QQ. This is the page's "vice versa" claim. */
        const centre = e.center;
        const R2 = appletMidPoint(rm, rOpposite, 0.3);
        /* The tangent at Q has the direction of PP: these are the swapped
           chords, parallel to the first diameter instead of the second. */
        const lQ = C.tangentAt(e, rm);
        const dir = appletGetParallelTo(R2, lQ.p, lQ.q);
        const [A, B, Cc] = C.lineCoefs(R2, dir);
        const S2 = C.ellipseIntersect(e, A, B, Cc);
        const l0 = C.tangentAt(e, S2[0]), l1 = C.tangentAt(e, S2[1]);
        const U2 = C.intersectLines(l0, l1);
        if (distToLine(C.midpoint(S2[0], S2[1]), centre,
          appletGetParallelTo(centre, rOpposite, rm)) < 1e-5) swappedMid++;
        if (distToLine(U2, centre, appletGetParallelTo(centre, rOpposite, rm)) < 1e-5) swappedTang++;
      }
    }
  }
  check(`chord slope -(b/a)cot(t) is independent of v (${n} chords)`, slopeOk === n, `${slopeOk}/${n}`);
  check(`midpoint of r(t+v),r(t-v) equals cos(v)r(t) (${n} chords)`,
    midpointOk === n, `${midpointOk}/${n}`);
  check("swapping the roles puts swapped chord midpoints on QQ", swappedMid === 324, `${swappedMid}/324`);
  check("swapping the roles puts swapped tangent meetings on QQ", swappedTang === 324, `${swappedTang}/324`);
}

/* --------------------------------- 5. dragging, snapping and the applet guards */

{
  const rnd = rng(2029);
  let snapOk = 0, rectOk = 0, movedPOk = 0, movedROk = 0, movedVOk = 0, n = 0;
  for (let k = 0; k < 120; k++) {
    const a = 35 + rnd() * 70, b = 20 + rnd() * 45;
    const state = C.start({ V: rect(a, b),
      P: appletEllipseAt(appletEllipse(rect(a, b)), rnd() * 6.28) });
    /* R of this ad-hoc start is not necessarily from CreateMidPoint; give it
       the applet's own starting position before testing moves. */
    const e = appletEllipse(state.V);
    const Pp = appletProrate(state.P, e.center, 2 * appletDist(state.P, e.center));
    const R = appletMidPoint(state.P, Pp, 0.15 + rnd() * 0.7);
    const s = { ...state, R, t: appletUpdateParam(state.P, Pp, R) };
    n++;
    const p = P(180 + rnd() * 50, 115 + rnd() * 70);
    if (closePoint(C.keepOnEllipse(e, p), appletKeepOnEllipse(e, p), 1e-6)) snapOk++;
    const corner = k % 4;
    const q = P(s.V[corner].x + (rnd() - 0.5) * 24, s.V[corner].y + (rnd() - 0.5) * 24);
    if (C.maintainRect(s.V, corner, q).every((v, i) =>
      closePoint(v, appletMaintainRect(s.V, corner, q)[i], 1e-9))) rectOk++;

    /* Dragging P: P is snapped, then PP.UpdateMidPoint recomputes R. */
    const afterP = C.move(s, "P", p);
    const e2 = appletEllipse(afterP.V);
    const p2 = appletKeepOnEllipse(e, p);
    const pp2 = appletProrate(p2, e2.center, 2 * appletDist(p2, e2.center));
    const t2 = appletUpdateParam(p2, pp2, s.R);
    if (closePoint(afterP.P, p2, 1e-6) &&
        closePoint(afterP.R, appletMidPoint(p2, pp2, t2), 1e-6) &&
        Math.abs(afterP.t - t2) < 1e-9) movedPOk++;

    /* Dragging R: project onto PP, clamped to the segment P--P'. */
    const rTarget = P(160 + rnd() * 90, 110 + rnd() * 80);
    const afterR = C.move(s, "R", rTarget);
    const tR = appletUpdateParam(s.P, Pp, rTarget);
    if (closePoint(afterR.R, appletMidPoint(s.P, Pp, tR), 1e-6) &&
        afterR.t >= 0 && afterR.t <= 1) movedROk++;

    /* Reshaping: KeepAllOnEllipse then UpdateMidPoint, in the applet's order. */
    const afterV = C.move(s, "V" + corner, q);
    const Vwant = appletMaintainRect(s.V, corner, q);
    const eWant = appletEllipse(Vwant);
    const keptP = appletKeepOnEllipse(eWant, s.P);
    const keptR = appletKeepOnEllipse(eWant, s.R);
    const ppWant = appletProrate(keptP, eWant.center, 2 * appletDist(keptP, eWant.center));
    const tWant = appletUpdateParam(keptP, ppWant, keptR);
    if (afterV.V.every((v, i) => closePoint(v, Vwant[i], 1e-9)) &&
        closePoint(afterV.P, keptP, 1e-6) &&
        closePoint(afterV.R, appletMidPoint(keptP, ppWant, tWant), 1e-6)) movedVOk++;
  }
  check(`KeepOnEllipse matches the signed-angle snap (${n} points)`, snapOk === n, `${snapOk}/${n}`);
  check(`MaintainRect mirrors corners exactly (${n} drags)`, rectOk === n, `${rectOk}/${n}`);
  check(`moving P reprojects R with UpdateMidPoint (${n} drags)`, movedPOk === n, `${movedPOk}/${n}`);
  check(`moving R clamps the parameter to [0,1] (${n} drags)`, movedROk === n, `${movedROk}/${n}`);
  check(`moving a corner keeps P and R as the applet does (${n} drags)`, movedVOk === n, `${movedVOk}/${n}`);
  const s = C.start({});
  const out = C.clamp(P(-100, 999), s);
  check("clamp keeps handles on the board", out.x >= 6 && out.x <= 394 && out.y >= 6 && out.y <= 294);
  const near = C.clampCorner(P(200, 150), s);
  check("clampCorner refuses a collapse onto the centre line",
    Math.abs(near.x - 200) >= 11 && Math.abs(near.y - 150) >= 11);
  check("an unknown handle name changes nothing",
    JSON.stringify(C.move(s, "Q", P(1, 2))) === JSON.stringify(s));
}

/* --------------------------------------------------- 6. degenerate configurations */

{
  const flat = C.start({ V: [P(150, 150), P(250, 150), P(250, 150), P(150, 150)],
    P: P(200, 150) });
  check("a flat ellipse has no tangent", C.compute(flat).tangentP === null);
  check("claims stay finite-valued on a flat ellipse",
    typeof C.claims(flat).chordMidpoint === "boolean");
  const start = C.start({});
  const moved = C.move(start, "R", P(0, 0));
  check("dragging R beyond P clamps to P",
    moved.t === 1 && closePoint(moved.R, moved.P, 1e-9), JSON.stringify(moved.R));
  const moved2 = C.move(start, "R", P(400, 300));
  check("dragging R beyond P' clamps to P'",
    moved2.t === 0 && closePoint(moved2.R, C.compute(start).Pp, 1e-9));
}

done("conjugate-diameters");
