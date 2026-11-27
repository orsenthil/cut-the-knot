#!/usr/bin/env node
"use strict";

/*
 * Logic test for gergonne-in-ellipse/gergonne-in-ellipse-core.js.
 *
 *   node porting/check-gergonne-in-ellipse.mjs
 *
 * The page claims that the three lines from a triangle's corners to the
 * opposite points where an inscribed ellipse touches its sides meet in one
 * point (the Gergonne point), and that this survives a projective mapping.
 * This test checks that claim on 4,320 well-separated configurations (all
 * ordered triples of ten angles on six ellipses) and on 300 random diagrams,
 * plus the circle case and an affine image of a circle. The second half of
 * the test writes the applet's methods a second time, literally from the
 * bytecode (CTKEllipse, DoubCircle.Tangent, GeoSDoub.Intersect / ComputeSignedAngle
 * / FindOrientation and GergonneInEllipseCanvas.Compute), and compares the core
 * with it on every one of those configurations and on every kind of drag.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("gergonne-in-ellipse/gergonne-in-ellipse-core.js", "GergonneInEllipseCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) =>
  p && q && Number.isFinite(p.x) && Number.isFinite(q.x) &&
  close(p.x, q.x, tol) && close(p.y, q.y, tol);
const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
/* Both NaN means the applet's |det| < 1 guard fired; that counts as a match. */
const samePoint = (p, q, tol) =>
  (Number.isNaN(p.x) && Number.isNaN(p.y) && Number.isNaN(q.x) && Number.isNaN(q.y)) ||
  closePoint(p, q, tol);

/** Distance from p to the infinite line through a,b. */
function distToLine(p, a, b) {
  const len = dist(a, b);
  if (!len) return Infinity;
  return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
}

/* --------------------------------- the applet's own arithmetic, from bytecode */

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), literal javap. */
function appletIntersect(a, b, c, d) {
  const s4 = a.y - b.y;
  const s6 = b.x - a.x;
  const s8 = a.x * b.y - a.y * b.x;
  const s10 = c.y - d.y;
  const s12 = d.x - c.x;
  const s14 = c.x * d.y - c.y * d.x;
  const s16 = s6 * s14 - s12 * s8;
  const s18 = s8 * s10 - s14 * s4;
  const det = s4 * s12 - s10 * s6;
  if (Math.abs(det) < 1) return P(NaN, NaN); // |det| < 1: NaN, NaN
  return P(s16 / det, s18 / det);
}

/* GeoSDoub.FindOrientation, literal. */
function appletOrientation(a, b, c) {
  const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.ComputeSignedAngle, literal (with a clamp for round-off at ±1). */
function appletSignedAngle(a, b, c) {
  const sq = (u, v) => (u.x - v.x) ** 2 + (u.y - v.y) ** 2;
  const v = (sq(a, b) + sq(a, c) - sq(b, c)) /
    (2 * Math.sqrt(sq(a, b)) * Math.sqrt(sq(a, c)));
  const angle = Math.acos(Math.max(-1, Math.min(1, v)));
  return appletOrientation(a, b, c) === 1 ? angle : -angle;
}

/* CTKEllipse(MoveablePoint[]) and EllipseUpdated, literal. */
function appletEllipse(V) {
  const center = P((V[0].x + V[1].x) / 2, (V[1].y + V[2].y) / 2);
  return {
    center,
    inf: P(center.x + 200, center.y),
    A: (V[1].x - V[0].x) / 2,
    B: (V[1].y - V[2].y) / 2,
  };
}

/* CTKEllipse.EllipseAt(t), literal. */
function appletEllipseAt(e, t) {
  return P(e.center.x + e.A * Math.cos(t), e.center.y + e.B * Math.sin(t));
}

/* DoubCircle(0,0,1000).Tangent(u), literal. */
function appletCircleTangent(u) {
  const len = Math.sqrt(u.x * u.x + u.y * u.y);
  if (Math.abs(len - 1000) > 1) return null;
  return P(u.x + u.y, u.y - u.x);
}

/* CTKEllipse.TangentAt(p), literal. */
function appletTangentAt(e, p) {
  const u = P(((p.x - e.center.x) / e.A) * 1000, ((p.y - e.center.y) / e.B) * 1000);
  const t = appletCircleTangent(u);
  if (!t) return null;
  return {
    p,
    q: P(e.center.x + (t.x * e.A) / 1000, e.center.y + (t.y * e.B) / 1000),
  };
}

/* CTKEllipse.KeepOnEllipse(p), literal. */
function appletKeepOnEllipse(e, p) {
  const u = P((p.x - e.center.x) / e.A, (p.y - e.center.y) / e.B);
  const onUnitCircle = P(e.center.x + u.x, e.center.y + u.y);
  return appletEllipseAt(e, appletSignedAngle(e.center, e.inf, onUnitCircle));
}

/* CTKEllipse.MaintainRect(p), literal, all four branches. */
function appletMaintainRect(V, index, p) {
  const center = appletEllipse(V).center;
  const dx = center.x - p.x, dy = center.y - p.y;
  const v = V.map((q) => P(q.x, q.y));
  v[index] = P(p.x, p.y); // Mover.UpdateLocation moved the selected point first
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

/* GergonneInEllipseCanvas.Compute, literal: three tangents, A2/A0/A1 in the
   bytecode's order, three cevians, three pairwise meetings, barycentre G. */
function appletCompute(state) {
  const e = appletEllipse(state.V);
  const tangents = state.P.map((p) => appletTangentAt(e, p));
  if (!tangents.every(Boolean)) return { e, tangents, vertices: [], cevians: [], meetings: [], G: null };
  const ix = (l, m) => appletIntersect(l.p, l.q, m.p, m.q);
  const vertices = [
    ix(tangents[1], tangents[2]),
    ix(tangents[2], tangents[0]),
    ix(tangents[0], tangents[1]),
  ];
  const cevians = vertices.map((p, i) => ({ p, q: state.P[i] }));
  const meetings = [
    ix(cevians[0], cevians[1]),
    ix(cevians[1], cevians[2]),
    ix(cevians[2], cevians[0]),
  ];
  const G = meetings.every(finite)
    ? P((meetings[0].x + meetings[1].x + meetings[2].x) / 3,
      (meetings[0].y + meetings[1].y + meetings[2].y) / 3)
    : null;
  return { e, tangents, vertices, cevians, meetings, G };
}

/* ------------------------------------------------------------- test helpers */

function randomState(rnd) {
  const cx = 150 + rnd() * 100, cy = 110 + rnd() * 80;
  const rx = 45 + rnd() * 85, ry = 35 + rnd() * 60;
  const V = [P(cx - rx, cy + ry), P(cx + rx, cy + ry),
    P(cx + rx, cy - ry), P(cx - rx, cy - ry)];
  const e = appletEllipse(V);
  /* Keep the touches separated by at least 0.35 radians. */
  const start = -Math.PI + rnd() * 0.5;
  const angles = [start, start + 1.2 + rnd() * 0.6, start + 2.6 + rnd() * 0.8];
  return {
    view: { width: 400, height: 300 }, V, P: angles.map((t) => appletEllipseAt(e, t)),
    explored: false, names: false,
  };
}

const ANGLES = [-2.8, -2.2, -1.6, -1.0, -0.4, 0.2, 0.8, 1.4, 2.0, 2.6];
const SHAPES = [
  [200, 150, 100, 37.5], [200, 150, 80, 80], [200, 150, 140, 25],
  [200, 150, 30, 120], [200, 150, 60, 60], [200, 150, 110, 70],
];

function gridStates() {
  const out = [];
  for (const [cx, cy, rx, ry] of SHAPES) {
    const V = [P(cx - rx, cy + ry), P(cx + rx, cy + ry),
      P(cx + rx, cy - ry), P(cx - rx, cy - ry)];
    const e = appletEllipse(V);
    for (const t0 of ANGLES) for (const t1 of ANGLES) for (const t2 of ANGLES) {
      if (t0 === t1 || t1 === t2 || t2 === t0) continue;
      out.push({
        view: { width: 400, height: 300 }, V,
        P: [t0, t1, t2].map((t) => appletEllipseAt(e, t)),
        explored: false, names: false,
      });
    }
  }
  return out;
}

/** The tangent equation of the ellipse at p, tested at q. */
function onTangent(e, p, q) {
  return Math.abs(
    ((p.x - e.center.x) * (q.x - e.center.x)) / (e.A * e.A) +
    ((p.y - e.center.y) * (q.y - e.center.y)) / (e.B * e.B) - 1,
  );
}

const scaleOf = (s) => {
  const g = appletCompute(s);
  return Math.max(1, Math.abs(g.e.center.x), Math.abs(g.e.center.y),
    Math.abs(g.e.A), Math.abs(g.e.B),
    ...g.vertices.filter(finite).flatMap((v) => [Math.abs(v.x), Math.abs(v.y)]));
};

/* ------------------------------------------------ 1. the starting position */

{
  const s = C.start({});
  const e = appletEllipse(s.V);
  check("start uses the applet's 400x300 canvas", s.view.width === 400 && s.view.height === 300);
  check("start frame is the applet's Rectangle(0,0,w,h) frame",
    s.V.length === 4 && closePoint(s.V[0], P(100, 187.5), 1e-9) &&
    closePoint(s.V[1], P(300, 187.5), 1e-9) &&
    closePoint(s.V[2], P(300, 112.5), 1e-9) && closePoint(s.V[3], P(100, 112.5), 1e-9));
  check("start ellipse has the applet's centre and radii",
    closePoint(C.ellipseFrom(s.V).center, e.center, 1e-9) &&
    close(C.ellipseFrom(s.V).A, e.A, 1e-9) && close(C.ellipseFrom(s.V).B, e.B, 1e-9));
  equal("the three starting angles are EllipseAt's in the applet",
    C.START_ANGLES, [0.15707963267948966, -2.356194490192345, 2.0943951023931953]);
  check("the three start points are EllipseAt(t) for those angles",
    s.P.every((p, i) => closePoint(p, appletEllipseAt(e, C.START_ANGLES[i]), 1e-9)));
  check("an illustration cannot be won or lost", C.result(s) === null);
  check("names are off until the player asks for them", s.names === false && s.explored === false);
}

/* ------------------- 2. the core against a second, literal transcription */

{
  const rnd = rng(4101);
  const cases = [C.start({}), ...gridStates(), ...Array.from({ length: 300 }, () => randomState(rnd))];
  let tangentsOK = true, verticesOK = true, ceviansOK = true, meetingsOK = true, gOK = true;
  let touchOK = true, cornerOK = true;
  for (const s of cases) {
    const a = C.compute(s), b = appletCompute(s);
    const tol = 1e-7 * scaleOf(s);
    for (let i = 0; i < 3; i++) {
      if (!a.tangents[i] || !b.tangents[i] ||
          !closePoint(a.tangents[i].p, b.tangents[i].p, 1e-9) ||
          !closePoint(a.tangents[i].q, b.tangents[i].q, 1e-7)) tangentsOK = false;
      if (!samePoint(a.vertices[i], b.vertices[i], tol)) verticesOK = false;
      if (!samePoint(a.cevians[i].p, b.cevians[i].p, tol) ||
          !closePoint(a.cevians[i].q, b.cevians[i].q, 1e-9)) ceviansOK = false;
      if (!samePoint(a.meetings[i], b.meetings[i], tol)) meetingsOK = false;
      const tangent = b.tangents[i];
      if (onTangent(b.e, s.P[i], tangent.p) > 1e-5 ||
          onTangent(b.e, s.P[i], tangent.q) > 1e-5) touchOK = false;
      const j = (i + 1) % 3;
      if (distToLine(b.vertices[i], b.tangents[j].p, b.tangents[j].q) > tol ||
          distToLine(b.vertices[i], b.tangents[(j + 1) % 3].p, b.tangents[(j + 1) % 3].q) > tol)
        cornerOK = false;
    }
    if (!((a.G === null && b.G === null) ||
          (finite(a.G) && finite(b.G) && closePoint(a.G, b.G, tol)))) gOK = false;
  }
  check(`tangentAt equals CTKEllipse.TangentAt on all ${cases.length} diagrams`, tangentsOK);
  check("the three A vertices equal the applet's tangent intersections", verticesOK);
  check("the three cevians A[i]—T[i] equal the applet's", ceviansOK);
  check("the three pairwise cevian meetings equal the applet's", meetingsOK);
  check("the barycentre G equals the applet's on every diagram", gOK);
  check("each tangent touches the ellipse at its point", touchOK);
  check("each triangle corner lies on both tangents that make it", cornerOK);
}

/* ---------------------- 3. the page's claim, over all well-separated cases */

{
  const cases = [C.start({}), ...gridStates()];
  const rnd = rng(7182);
  for (let i = 0; i < 300; i++) cases.push(randomState(rnd));
  let concurrent = 0, matches = 0, coreClaims = 0;
  let worst = 0;
  for (const s of cases) {
    const g = C.compute(s);
    const scale = scaleOf(s);
    if (!g.G || !g.meetings.every(finite)) continue;
    if (g.cevians.every((l) => distToLine(g.G, l.p, l.q) / scale < 1e-9)) concurrent++;
    /* The applet's G is an average; if the lines concur it is the common point. */
    if (g.meetings.every((q) => dist(q, g.G) / scale < 1e-9)) matches++;
    const c = C.claims(s);
    if (c.concurrent && c.tangentsTouch && c.verticesOnTangents &&
        c.meetingsFinite && finite(c.G)) coreClaims++;
    for (const l of g.cevians) worst = Math.max(worst, distToLine(g.G, l.p, l.q) / scale);
  }
  check(`all ${cases.length} well-separated diagrams have one Gergonne point`,
    concurrent === cases.length, `only ${concurrent}/${cases.length}`);
  check("the applet's averaged G is the common meeting point in every case",
    matches === cases.length, `only ${matches}/${cases.length}`);
  check("the core's own claims agree with the measured geometry in every case",
    coreClaims === cases.length, `only ${coreClaims}/${cases.length}`);
  check("the worst relative distance from G to a cevian is below 1e-9",
    worst < 1e-9, `worst ${worst}`);
}

/* -------------------------- 4. circle and affine-square projective claim */

{
  /* A circle is an ellipse with equal radii. The page's incircle claim should
     hold there before any projective map is applied. */
  const V = [P(100, 210), P(300, 210), P(300, 10), P(100, 10)];
  const e = appletEllipse(V);
  const angles = [-2.5, -0.7, 1.3];
  const circle = {
    view: { width: 400, height: 300 },
    V, P: angles.map((t) => appletEllipseAt(e, t)), explored: false, names: false,
  };
  const g = C.compute(circle);
  check("the circle (incircle) case has a finite G", finite(g.G));
  check("the three cevians concur in the circle case",
    C.claims(circle).concurrent &&
    g.cevians.every((l) => distToLine(g.G, l.p, l.q) < 1e-6));

  /* An affine map sends a circle to a tilted ellipse and preserves lines,
     tangency and concurrency: the page's projective claim in numbers. */
  const map = (p) => P(200 + 1.5 * p.x + 0.35 * p.y, 150 + 0.2 * p.x + 0.75 * p.y);
  const circleAt = (t) => P(60 * Math.cos(t), 60 * Math.sin(t));
  const q = angles.map(circleAt);
  const tangents = q.map((p) => {
    const u = P((p.x * 1000) / 60, (p.y * 1000) / 60);
    const t = appletCircleTangent(u);
    return { p: map(p), q: map(P((t.x * 60) / 1000, (t.y * 60) / 1000)) };
  });
  /* Corners opposite each touching point, mapped from the circle. */
  const vertex = (i, j) => {
    const l = tangents[i], m = tangents[j];
    return appletIntersect(l.p, l.q, m.p, m.q);
  };
  const A = [vertex(1, 2), vertex(2, 0), vertex(0, 1)];
  const cev = [0, 1, 2].map((i) => ({ p: A[i], q: map(q[i]) }));
  const m01 = appletIntersect(cev[0].p, cev[0].q, cev[1].p, cev[1].q);
  const m12 = appletIntersect(cev[1].p, cev[1].q, cev[2].p, cev[2].q);
  const m20 = appletIntersect(cev[2].p, cev[2].q, cev[0].p, cev[0].q);
  const tol = 1e-5 * Math.max(1, ...A.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]));
  check("the affine image of the circle keeps the three cevians concurrent",
    finite(m01) && finite(m12) &&
    distToLine(m01, cev[2].p, cev[2].q) < tol &&
    distToLine(m01, cev[1].p, cev[1].q) < tol &&
    dist(m12, m01) / tol < 1e-3 && dist(m20, m01) / tol < 1e-3);
}

/* ------------------------------- 5. dragging, guards and edge cases */

{
  const rnd = rng(97);
  let snapped = true, mirrored = true, movedTouches = true;
  for (let n = 0; n < 180; n++) {
    const s = n === 0 ? C.start({}) : randomState(rnd);
    const p = P(180 + rnd() * 60, 90 + rnd() * 100);
    const i = n % 3;
    const got = C.keepOnEllipse(C.ellipseFrom(s.V), p);
    const want = appletKeepOnEllipse(appletEllipse(s.V), p);
    if (!closePoint(got, want, 1e-6)) snapped = false;

    const corner = n % 4;
    const q = P(s.V[corner].x + (rnd() - 0.5) * 30, s.V[corner].y + (rnd() - 0.5) * 30);
    const Vgot = C.maintainRect(s.V, corner, q);
    const Vwant = appletMaintainRect(s.V, corner, q);
    if (!Vgot.every((v, k) => closePoint(v, Vwant[k], 1e-9))) mirrored = false;

    const after = C.move(s, "V" + corner, q);
    const e2 = appletEllipse(Vwant);
    if (!after.V.every((v, k) => closePoint(v, Vwant[k], 1e-9)) ||
        !after.P.every((v, k) => closePoint(v, appletKeepOnEllipse(e2, s.P[k]), 1e-6)))
      movedTouches = false;
  }
  check("KeepOnEllipse matches the applet's signed-angle snap", snapped);
  check("MaintainRect mirrors frame corners exactly like CTKEllipse", mirrored);
  check("moving a frame corner keeps all three touches on the new ellipse", movedTouches);

  const s = C.start({});
  const idx = 2;
  const p = P(s.P[idx].x + 5, s.P[idx].y - 9);
  const after = C.move(s, "C", p);
  check("moving a named touch point uses KeepOnEllipse",
    closePoint(after.P[2], appletKeepOnEllipse(appletEllipse(after.V), p), 1e-6));
  check("a move never changes the input position",
    closePoint(s.P[0], appletEllipseAt(appletEllipse(s.V), C.START_ANGLES[0]), 1e-9));
  equal("the seven draggable handles are the applet's four corners and three touches",
    C.legalMoves(), ["V0", "V1", "V2", "V3", "A", "B", "C"]);

  /* Coincident touches give identical tangents: the applet's |det| < 1 guard
     returns NaN, and the illustration has no G to draw. */
  const coincident = { ...s, P: s.P.map((q) => P(q.x, q.y)) };
  coincident.P[1] = { ...coincident.P[0] };
  const degenerate = C.compute(coincident), wantDegenerate = appletCompute(coincident);
  check("coincident touches give NaN intersections, as in the applet",
    Number.isNaN(degenerate.vertices[2].x) && Number.isNaN(wantDegenerate.vertices[2].x));
  check("a degenerate triangle has no Gergonne point to draw",
    degenerate.G === null && C.claims(coincident).concurrent === false);

  const near = C.clampCorner(P(200, 150), s);
  check("clampCorner refuses a collapse onto the centre lines",
    Math.abs(near.x - 200) >= 11 && Math.abs(near.y - 150) >= 11);
  const out = C.clamp(P(-100, 999), s);
  check("clamp keeps handles on the board", out.x >= 6 && out.x <= 394 && out.y >= 6 && out.y <= 294);
  check("the status describes an unexplored diagram without claiming a win",
    /Check the theorem/.test(C.describe(s)) && C.result(s) === null);
  check("the status changes once the theorem has been checked",
    /meet at G/.test(C.describe({ ...s, explored: true })));
  const pos = C.position(s);
  check("the saved position is plain board-unit data",
    Array.isArray(pos.V) && Array.isArray(pos.P) && finite(pos.G) &&
    pos.explored === false && pos.names === false);
}

done("gergonne-in-ellipse");
