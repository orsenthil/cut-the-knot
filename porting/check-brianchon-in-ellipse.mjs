#!/usr/bin/env node
"use strict";

/*
 * Logic test for brianchon-in-ellipse/brianchon-in-ellipse-core.js.
 *
 *   node porting/check-brianchon-in-ellipse.mjs
 *
 * Checks the applet's starting rectangle and six points, its tangent-at-a-point
 * calculation, its six tangent intersections and three diagonals, and the
 * article's claim that those three diagonals meet at one point (Brianchon's
 * theorem). Every check runs on the start position and on hundreds of random
 * ellipses/hexagons. The second half of the test writes the applet's methods a
 * second time, literally from the bytecode (CTKEllipse.EllipseAt / TangentAt /
 * KeepOnEllipse / MaintainRect, GeoSDoub.ComputeSignedAngle / FindOrientation /
 * Intersect and BrianchonInEllipseCanvas.Compute), and compares the core with
 * it. Finally an affine image of a circle is checked, the numerical form of the
 * article's claim that a proof for a circle covers every proper conic.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("brianchon-in-ellipse/brianchon-in-ellipse-core.js", "BrianchonCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) =>
  p && q && Number.isFinite(p.x) && Number.isFinite(q.x) &&
  close(p.x, q.x, tol) && close(p.y, q.y, tol);
const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Distance from p to the infinite line through a,b. */
function distToLine(p, a, b) {
  const len = dist(a, b);
  if (!len) return Infinity;
  return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
}

/* --------------------------------- the applet's own arithmetic, from bytecode */

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), literal. */
function appletIntersect(a, b, c, d) {
  const s4 = a.y - b.y;
  const s6 = b.x - a.x;
  const s8 = a.x * b.y - a.y * b.x;
  const s10 = c.y - d.y;
  const s12 = d.x - c.x;
  const s14 = c.x * d.y - c.y * d.x;
  /* Posted as: a1*x + b1*y + c1 = 0, det = a1*b2 - a2*b1;
     x = (c2*b1 - c1*b2)/det, y = (c1*a2 - c2*a1)/det. */
  const det = s4 * s12 - s10 * s6;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((s14 * s6 - s8 * s12) / det, (s8 * s10 - s14 * s4) / det);
}

/* GeoSDoub.FindOrientation, literal: c.x*(a.y-b.y)+c.y*(b.x-a.x)+a.x*b.y-b.x*a.y > 0. */
function appletOrientation(a, b, c) {
  const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.ComputeSignedAngle, literal (no clamping of the cosine). */
function appletSignedAngle(a, b, c) {
  const sq = (u, v) => (u.x - v.x) ** 2 + (u.y - v.y) ** 2;
  const v = (sq(a, b) + sq(a, c) - sq(b, c)) /
    (2 * Math.sqrt(sq(a, b)) * Math.sqrt(sq(a, c)));
  return appletOrientation(a, b, c) === 1 ? Math.acos(v) : -Math.acos(v);
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
  const len = Math.sqrt((u.x - 0) ** 2 + (u.y - 0) ** 2);
  if (Math.abs(len - 1000) > 1) return null;
  return P(u.x + (u.y - 0), u.y - (u.x - 0));
}

/* CTKEllipse.TangentAt(p), literal: stretch the circle tangent back. */
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

/* CTKEllipse.MaintainRect(p), literal, following each of the four branches. */
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

/* BrianchonInEllipseCanvas.Compute, literal. */
function appletCompute(state) {
  const e = appletEllipse(state.V);
  const tangents = state.P.map((p) => appletTangentAt(e, p));
  const ix = (l, m) => appletIntersect(l.p, l.q, m.p, m.q);
  const vertices = [];
  for (let i = 0; i < 6; i++) vertices.push(ix(tangents[i], tangents[(i + 1) % 6]));
  const diagonals = [
    { p: vertices[0], q: vertices[3] },
    { p: vertices[1], q: vertices[4] },
    { p: vertices[2], q: vertices[5] },
  ];
  const raw = ix(diagonals[0], diagonals[1]);
  const S = Number.isFinite(raw.x) && Number.isFinite(raw.y) ? raw : null;
  return { e, tangents, vertices, diagonals, S };
}

/* ------------------------------------------------------------- test helpers */

function randomState(rnd) {
  const cx = 150 + rnd() * 100, cy = 110 + rnd() * 80;
  const rx = 45 + rnd() * 85, ry = 35 + rnd() * 60;
  const V = [P(cx - rx, cy + ry), P(cx + rx, cy + ry),
    P(cx + rx, cy - ry), P(cx - rx, cy - ry)];
  const e = appletEllipse(V);
  const gaps = Array.from({ length: 6 }, () => 0.3 + rnd() * 1.1);
  let t = -Math.PI + rnd() * 0.5;
  const Pts = gaps.map((g) => { t += g; return appletEllipseAt(e, t); });
  return { view: { width: 400, height: 300 }, V, P: Pts, explored: false, names: false };
}

function scaleOf(state) {
  const e = appletEllipse(state.V);
  return 4 * Math.max(1, e.center.x, e.center.y, Math.abs(e.A), Math.abs(e.B));
}

/** The tangent equation of the ellipse at p, tested at q. */
function onTangent(e, p, q) {
  return Math.abs(
    ((p.x - e.center.x) * (q.x - e.center.x)) / (e.A * e.A) +
    ((p.y - e.center.y) * (q.y - e.center.y)) / (e.B * e.B) - 1,
  );
}

/* ------------------------------------------------ 1. the starting position */

{
  const s = C.start({});
  const e = appletEllipse(s.V);
  check("start uses the applet's 400x300 canvas", s.view.width === 400 && s.view.height === 300);
  check("start rectangle has the applet's four V points",
    s.V.length === 4 && closePoint(s.V[0], P(120, 210), 1e-9) &&
    closePoint(s.V[1], P(280, 210), 1e-9) &&
    closePoint(s.V[2], P(280, 90), 1e-9) && closePoint(s.V[3], P(120, 90), 1e-9));
  check("start ellipse matches the applet's centre and radii",
    closePoint(C.ellipseFrom(s.V).center, e.center, 1e-9) &&
    close(C.ellipseFrom(s.V).A, e.A, 1e-9) && close(C.ellipseFrom(s.V).B, e.B, 1e-9));
  equal("the six starting angles are the applet's", C.START_ANGLES, [
    -2.356194490192345, -1.4279966607226333, -0.5235987755982988,
    1.0471975511965976, 1.7135959928671598, 2.356194490192345,
  ]);
  check("the six start points are EllipseAt(t) for those angles",
    s.P.every((p, i) => closePoint(p, appletEllipseAt(e, C.START_ANGLES[i]), 1e-9)));
  check("an illustration cannot be won or lost", C.result(s) === null);
}

/* -------------------------- 2. tangents and vertices against the applet */

{
  const rnd = rng(713);
  let tangentOK = true, vertexOK = true, intersectOK = true;
  for (let n = 0; n < 240; n++) {
    const s = n === 0 ? C.start({}) : randomState(rnd);
    const a = C.compute(s), b = appletCompute(s);
    const tol = 1e-6 * scaleOf(s);
    for (let i = 0; i < 6; i++) {
      if (!a.tangents[i] || !b.tangents[i] ||
          !closePoint(a.tangents[i].p, b.tangents[i].p, 1e-9) ||
          !closePoint(a.tangents[i].q, b.tangents[i].q, 1e-6)) tangentOK = false;
      if (!closePoint(a.vertices[i], b.vertices[i], 1e-6)) vertexOK = false;
      const l = b.tangents[i], m = b.tangents[(i + 1) % 6];
      if (distToLine(b.vertices[i], l.p, l.q) > tol ||
          distToLine(b.vertices[i], m.p, m.q) > tol) intersectOK = false;
    }
    for (const l of a.diagonals) {
      const x = C.intersect(l.p, l.q, l.p, l.q);
      if (!Number.isNaN(x.x)) intersectOK = false; // parallel with itself
    }
  }
  check("tangentAt equals CTKEllipse.TangentAt on 240 ellipses", tangentOK);
  check("all six tangent intersections equal the applet's", vertexOK);
  check("each vertex lies on both of its tangent lines", intersectOK);
}

/* -------------------- 3. the article's claim: the three diagonals concur */

{
  const rnd = rng(2029);
  let concurrent = 0, sFinite = 0, coreMatches = 0, tangentsTouch = 0, verticesOn = 0;
  const N = 400;
  for (let n = 0; n < N; n++) {
    const s = n === 0 ? C.start({}) : randomState(rnd);
    const g = C.compute(s), a = appletCompute(s);
    const tol = 1e-5 * scaleOf(s);
    const c = C.claims(s);
    if (g.S && distToLine(g.S, g.diagonals[2].p, g.diagonals[2].q) < tol) concurrent++;
    if (finite(g.S)) sFinite++;
    if (g.S && a.S && closePoint(g.S, a.S, 1e-5)) coreMatches++;
    if (c.tangentsTouch && s.P.every((p, i) =>
      onTangent(a.e, p, a.tangents[i].p) < 1e-5 &&
      onTangent(a.e, p, a.tangents[i].q) < 1e-5)) tangentsTouch++;
    if (c.verticesOnTangents && a.vertices.every((v, i) =>
      distToLine(v, a.tangents[i].p, a.tangents[i].q) < tol &&
      distToLine(v, a.tangents[(i + 1) % 6].p, a.tangents[(i + 1) % 6].q) < tol)) verticesOn++;
  }
  check(`Brianchon holds in all ${N} configurations (the three diagonals meet)`, concurrent === N,
    `only ${concurrent}/${N}`);
  check("S is finite in every well-separated configuration", sFinite === N, `only ${sFinite}/${N}`);
  check("core S equals the applet's S in all configurations", coreMatches === N, `only ${coreMatches}/${N}`);
  check("every tangent touches the ellipse at its point", tangentsTouch === N, `only ${tangentsTouch}/${N}`);
  check("the core's own claims agree with the measured geometry", verticesOn === N, `only ${verticesOn}/${N}`);
}

/* --------------------- 4. dragging: KeepOnEllipse and MaintainRect */

{
  const rnd = rng(97);
  let snapped = true, mirrored = true, movedPoints = true;
  for (let n = 0; n < 150; n++) {
    const s = n === 0 ? C.start({}) : randomState(rnd);
    const p = P(180 + rnd() * 60, 90 + rnd() * 100);
    const i = n % 6;
    const got = C.keepOnEllipse(C.ellipseFrom(s.V), p);
    const want = appletKeepOnEllipse(appletEllipse(s.V), p);
    if (!closePoint(got, want, 1e-6)) snapped = false;
    if (!close(Math.abs(got.x - want.x) + Math.abs(got.y - want.y), 0, 1e-6)) snapped = false;

    const corner = n % 4;
    const q = P(s.V[corner].x + (rnd() - 0.5) * 30, s.V[corner].y + (rnd() - 0.5) * 30);
    const Vgot = C.maintainRect(s.V, corner, q);
    const Vwant = appletMaintainRect(s.V, corner, q);
    if (!Vgot.every((v, k) => closePoint(v, Vwant[k], 1e-9))) mirrored = false;

    const after = C.move(s, "V" + corner, q);
    const e2 = appletEllipse(Vwant);
    if (!after.V.every((v, k) => closePoint(v, Vwant[k], 1e-9)) ||
        !after.P.every((v, k) => closePoint(v, appletKeepOnEllipse(e2, s.P[k]), 1e-6)))
      movedPoints = false;
  }
  check("KeepOnEllipse matches the applet's signed-angle snap", snapped);
  check("MaintainRect mirrors corners exactly like CTKEllipse", mirrored);
  check("moving a corner keeps all six points on the new ellipse", movedPoints);

  const s = C.start({});
  const idx = 2;
  const p = P(s.P[idx].x + 5, s.P[idx].y - 9);
  const after = C.move(s, "A", p);
  check("moving a named ellipse point uses KeepOnEllipse",
    closePoint(after.P[0], appletKeepOnEllipse(appletEllipse(after.V), p), 1e-6));
  check("a move never changes the input position",
    closePoint(s.P[0], appletEllipseAt(appletEllipse(s.V), C.START_ANGLES[0]), 1e-9));
}

/* ------------------------------- 5. edge cases and applet guards */

{
  const s = C.start({});
  /* Coincident neighbours give identical tangents: the applet's |det| < 1
     guard returns NaN, and the illustration simply has no S to draw. */
  const coincident = { ...s, P: s.P.map((p) => P(p.x, p.y)) };
  coincident.P[1] = { ...coincident.P[0] };
  const g = C.compute(coincident);
  check("coincident touching points give a NaN intersection, as in the applet",
    Number.isNaN(g.vertices[0].x) && Number.isNaN(g.vertices[0].y));
  check("a degenerate hexagon has no Brianchon point", C.claims(coincident).S === null);

  /* A corner dragged onto a centre line is refused by PointIsGood; the core's
     clamp keeps it at least 11 units away on both axes. */
  const near = C.clampCorner(P(200, 150), s);
  check("clampCorner refuses a collapse onto the centre",
    Math.abs(near.x - 200) >= 11 && Math.abs(near.y - 150) >= 11);
  const out = C.clamp(P(-100, 999), s);
  check("clamp keeps handles on the board", out.x >= 6 && out.x <= 394 && out.y >= 6 && out.y <= 294);

  const pos = C.position(s);
  check("the saved position is plain board-unit data",
    Array.isArray(pos.V) && Array.isArray(pos.P) && finite(pos.P[0]) && pos.explored === false);
}

/* ----------------- 6. the page's "a circle proof covers every conic" claim */

{
  /* Apply an affine map to a circle. Brianchon's theorem is projective, so
     concurrency must survive; this is the numerical form of the article's
     claim that proving it in a circle proves it for every proper conic. */
  const map = (p) => P(200 + 1.6 * p.x + 0.35 * p.y, 150 + 0.2 * p.x + 0.75 * p.y);
  const circleAt = (t) => P(60 * Math.cos(t), 60 * Math.sin(t));
  const angles = [-2.5, -1.45, -0.5, 0.6, 1.6, 2.5];
  const q = angles.map(circleAt);
  const tangents = q.map((p) => {
    const u = { x: p.x * 1000 / 60, y: p.y * 1000 / 60 };
    const t = appletCircleTangent(u);
    return { p: map(p), q: map(P((t.x * 60) / 1000, (t.y * 60) / 1000)) };
  });
  const v = tangents.map((l, i) => appletIntersect(l.p, l.q,
    tangents[(i + 1) % 6].p, tangents[(i + 1) % 6].q));
  const diag = [{ p: v[0], q: v[3] }, { p: v[1], q: v[4] }, { p: v[2], q: v[5] }];
  const sA = appletIntersect(diag[0].p, diag[0].q, diag[1].p, diag[1].q);
  const sB = appletIntersect(diag[1].p, diag[1].q, diag[2].p, diag[2].q);
  const tol = 1e-4 * Math.max(1, dist(diag[0].p, diag[0].q), dist(diag[1].p, diag[1].q));
  check("the circle proof survives an affine stretch (a tilted ellipse)",
    finite(sA) && finite(sB) &&
    distToLine(sB, diag[0].p, diag[0].q) < tol && distToLine(sB, diag[1].p, diag[1].q) < tol,
    `third-diagonal distance ${finite(sB) ? distToLine(sB, diag[0].p, diag[0].q) : "NaN"}`);
}

done("brianchon-in-ellipse");
