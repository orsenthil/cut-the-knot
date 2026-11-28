#!/usr/bin/env node
"use strict";

/*
 * Logic test for lahire-on-ellipse/lahire-on-ellipse-core.js.
 *
 *   node porting/check-lahire-on-ellipse.mjs
 *
 * The first half writes the applet's own arithmetic a second time, straight
 * from the bytecode of CTKEllipse (Tangent2From, EllipseUpdated, MaintainRect),
 * GeoSDoub (IntersectCirclesX/Y, Dist(DoubPoint,DoubLine)) and
 * LaHireOnEllipseCanvas (init, Compute, CheckTouch), and compares it with the
 * core over hundreds of ellipses and point pairs, including both branches of
 * the circle-circle intersection and the one-pixel touch threshold.
 *
 * The second half checks the page's two claims: the exact theorem ("if B lies
 * on CD then A lies on EF") for both directions on hundreds of configurations,
 * and the note that it holds for every non-degenerate conic (tested with the
 * symmetric bilinear form of an ellipse, a hyperbola and a parabola). It also
 * checks that the helper button puts B on CD and lights the applet's touch test.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("lahire-on-ellipse/lahire-on-ellipse-core.js", "LahireOnEllipseCore");
const P = (x, y) => ({ x, y });
const rnd = rng(20261127);
const between = (lo, hi) => lo + rnd() * (hi - lo);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) =>
  p && q && Number.isFinite(p.x) && Number.isFinite(q.x) &&
  close(p.x, q.x, tol) && close(p.y, q.y, tol);
const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

/* ------------------------ second transcription, from the applet's bytecode */

function appletEllipse(V) {
  return {
    center: P((V[0].x + V[1].x) / 2, (V[1].y + V[2].y) / 2),
    A: (V[1].x - V[0].x) / 2,
    B: (V[1].y - V[2].y) / 2,
  };
}

/* GeoSDoub.IntersectCirclesX: y = m*x + intercept, then the quadratic in y. */
function appletIntersectCirclesX(a, b) {
  const m = -(a.y - b.y) / (a.x - b.x);
  const intercept = (a.x * a.x - b.x * b.x + a.y * a.y - b.y * b.y -
    a.r * a.r + b.r * b.r) / 2 / (a.x - b.x);
  const h = intercept - a.x;
  const qa = m * m + 1;
  const qb = m * h - a.y;
  const qc = h * h + a.y * a.y - a.r * a.r;
  const disc = qb * qb - qa * qc;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  const t1 = (-qb + root) / qa, t2 = (-qb - root) / qa;
  return [P(m * t1 + intercept, t1), P(m * t2 + intercept, t2)];
}

/* GeoSDoub.IntersectCirclesY: the branch used when the centres share x. */
function appletIntersectCirclesY(a, b) {
  const m = -(a.x - b.x) / (a.y - b.y);
  const intercept = (a.y * a.y - b.y * b.y + a.x * a.x - b.x * b.x -
    a.r * a.r + b.r * b.r) / 2 / (a.y - b.y);
  const h = intercept - a.y;
  const qa = m * m + 1;
  const qb = m * h - a.x;
  const qc = h * h + a.x * a.x - a.r * a.r;
  const disc = qb * qb - qa * qc;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  const t1 = (-qb + root) / qa, t2 = (-qb - root) / qa;
  return [P(t1, m * t1 + intercept), P(t2, m * t2 + intercept)];
}

const branches = { X: 0, Y: 0, degenerate: 0 };
function appletCircleIntersections(a, b) {
  if (Math.abs(a.x - b.x) > 1) { branches.X++; return appletIntersectCirclesX(a, b); }
  if (Math.abs(a.y - b.y) > 1) { branches.Y++; return appletIntersectCirclesY(a, b); }
  branches.degenerate++;
  return [P(a.x, a.y), P(a.x, a.y)];
}

/* CTKEllipse.Tangent2From: stretch by 1000, take tangents to the circle. */
function appletTangent2From(e, p) {
  const R = 1000;
  const u = P(((p.x - e.center.x) / e.A) * R, ((p.y - e.center.y) / e.B) * R);
  const big = { x: 0, y: 0, r: R };
  const sq = (u.x - big.x) ** 2 + (u.y - big.y) ** 2;
  const power = sq - big.r * big.r; // bytecode: SqDist − GetRadius²
  if (!(power > 0)) return null;
  const helper = { x: u.x, y: u.y, r: Math.sqrt(power) };
  const hits = appletCircleIntersections(big, helper);
  if (!hits) return null;
  return hits.map((q) => P(q.x * e.A / R + e.center.x, q.y * e.B / R + e.center.y));
}

/* GeoSDoub.Dist(DoubPoint, DoubLine), including its 0.1 endpoint shortcut. */
function appletDistToLine(p, l) {
  if (!l) return Infinity;
  const dx = l.q.x - l.p.x, dy = l.q.y - l.p.y;
  if ((l.p.x - p.x) ** 2 + (l.p.y - p.y) ** 2 < 0.1) return 0;
  const t = (dx * (p.x - l.p.x) + dy * (p.y - l.p.y)) / (dx * dx + dy * dy);
  const ex = l.p.x + t * dx - p.x, ey = l.p.y + t * dy - p.y;
  return Math.sqrt(ex * ex + ey * ey);
}

/* LaHireOnEllipseCanvas.Compute and CheckTouch, literal. */
function appletCompute(state) {
  const e = appletEllipse(state.V);
  const fromA = appletTangent2From(e, state.A);
  const fromB = appletTangent2From(e, state.B);
  const good = (pts) => pts && Number.isFinite(pts[0].x) && Number.isFinite(pts[0].y);
  const C = good(fromA) ? fromA[0] : null;
  const D = good(fromA) ? fromA[1] : null;
  const E = good(fromB) ? fromB[0] : null;
  const F = good(fromB) ? fromB[1] : null;
  const lineA = C && D ? { p: C, q: D } : null;
  const lineB = E && F ? { p: E, q: F } : null;
  const touchDistance = lineB ? appletDistToLine(state.A, lineB) : null;
  /* CheckTouch returns false immediately if LineA is null; the applet would
     throw if LineA existed but LineB did not, which we count as no touch. */
  const touch = Boolean(lineA && lineB && touchDistance < 1);
  return { e, C, D, E, F, lineA, lineB, touchDistance, touch };
}

/* CTKEllipse.MaintainRect, with all four branches written out. */
function appletMaintainRect(V, index, p) {
  const c = appletEllipse(V).center;
  const dx = c.x - p.x, dy = c.y - p.y;
  const v = V.map((q) => P(q.x, q.y));
  v[index] = P(p.x, p.y);
  const set = (i, x, y) => { v[i].x = x; v[i].y = y; };
  if (index === 0) {
    set(1, c.x + dx, c.y - dy); set(2, c.x + dx, c.y + dy); set(3, c.x - dx, c.y + dy);
  } else if (index === 1) {
    set(0, c.x + dx, c.y - dy); set(2, c.x - dx, c.y + dy); set(3, c.x + dx, c.y + dy);
  } else if (index === 2) {
    set(0, c.x + dx, c.y + dy); set(1, c.x - dx, c.y + dy); set(3, c.x + dx, c.y - dy);
  } else {
    set(0, c.x - dx, c.y + dy); set(1, c.x + dx, c.y + dy); set(2, c.x + dx, c.y - dy);
  }
  return v;
}

/* LaHireOnEllipseCanvas.init: applet geometry for a canvas of this size. */
function appletStart(W, H) {
  const sx = W / 2.5, sy = H / 1.5;
  const rx = Math.trunc(W / 8), ry = Math.trunc(H / 8);
  const V = [P(sx - rx, sy + ry), P(sx + rx, sy + ry),
    P(sx + rx, sy - ry), P(sx - rx, sy - ry)];
  const h = Math.sqrt(rx * rx + ry * ry);
  return { V, A: P(sx + 3 * h, sy), B: P(sx, sy - 2 * h) };
}

/* ------------------------------------------------------------- configurations */

function randomEllipse() {
  const cx = between(170, 430), cy = between(120, 330);
  const rx = between(30, 110), ry = between(25, 85);
  return [P(cx - rx, cy + ry), P(cx + rx, cy + ry),
    P(cx + rx, cy - ry), P(cx - rx, cy - ry)];
}

function onEllipse(e, t) {
  return P(e.center.x + e.A * Math.cos(t), e.center.y + e.B * Math.sin(t));
}

function outsidePoint(e) {
  const scale = between(1.3, 4);
  const t = between(-Math.PI, Math.PI);
  return P(e.center.x + scale * e.A * Math.cos(t), e.center.y + scale * e.B * Math.sin(t));
}

function randomState() {
  const V = randomEllipse();
  return {
    view: { width: 600, height: 450 }, V,
    A: outsidePoint(appletEllipse(V)), B: outsidePoint(appletEllipse(V)),
    names: true, explored: false,
  };
}

function ellipseValue(e, p) {
  return ((p.x - e.center.x) / e.A) ** 2 + ((p.y - e.center.y) / e.B) ** 2;
}

function polarResidual(e, p, q) {
  return (p.x - e.center.x) * (q.x - e.center.x) / (e.A * e.A) +
    (p.y - e.center.y) * (q.y - e.center.y) / (e.B * e.B) - 1;
}

/** Put q on the polar of p, at a stretched parameter t along the chord. */
function onPolar(e, p, t) {
  const ua = (p.x - e.center.x) / e.A, va = (p.y - e.center.y) / e.B;
  const len2 = ua * ua + va * va;
  const u = ua / len2 + t * (-va / Math.sqrt(len2));
  const v = va / len2 + t * (ua / Math.sqrt(len2));
  return P(e.center.x + u * e.A, e.center.y + v * e.B);
}

/**
 * On the polar the stretched distance from the centre is sqrt(1/|uP|²+t²),
 * so |t| must exceed sqrt(1−1/|uP|²) for q to be outside the ellipse.
 */
function onPolarOutside(e, p, extra, sign = 1) {
  const ua = (p.x - e.center.x) / e.A, va = (p.y - e.center.y) / e.B;
  const len = Math.hypot(ua, va);
  const threshold = Math.sqrt(1 - 1 / (len * len));
  return onPolar(e, p, sign * (threshold + extra));
}

/* ------------------------------------------------- 1. the applet's start data */

{
  const a = appletStart(600, 450), s = C.start({});
  check("the embedded applet is 600x450", s.view.width === 600 && s.view.height === 450);
  check("start rectangle matches the applet's W/2.5, H/1.5, W/8 and H/8",
    s.V.every((p, i) => closePoint(p, a.V[i], 1e-12)),
    JSON.stringify({ core: s.V, applet: a.V }));
  check("start A and B match the applet's 3h and −2h offsets",
    closePoint(s.A, a.A, 1e-12) && closePoint(s.B, a.B, 1e-12));
  const small = appletStart(400, 300), sSmall = C.start({ width: 400, height: 300 });
  check("the 400x300 size from getParameterInfo also matches",
    sSmall.V.every((p, i) => closePoint(p, small.V[i], 1e-12)) &&
    closePoint(sSmall.A, small.A, 1e-12) && closePoint(sSmall.B, small.B, 1e-12));
  check("ShowNames defaults on, as in the applet's second embedding", s.names === true);
}

/* ------------------------------------- 2. the core against the second transcription */

{
  let ok = true;
  for (let i = 0; i < 250; i++) {
    const V = randomEllipse();
    const e = C.ellipseFrom(V), a = appletEllipse(V);
    ok = ok && closePoint(e.center, a.center, 1e-12) && close(e.A, a.A, 1e-12) &&
      close(e.B, a.B, 1e-12);
  }
  check("ellipseFrom matches CTKEllipse on 250 ellipses", ok);
}

{
  let ok = true, insideNull = true, yBranchSeen = false, xBranchSeen = false;
  for (let i = 0; i < 120; i++) {
    const e = appletEllipse(randomEllipse());
    for (let j = 0; j < 5; j++) {
      const p = outsidePoint(e);
      const mine = C.tangentPoints(C.ellipseFrom(
        [P(e.center.x - e.A, e.center.y + e.B), P(e.center.x + e.A, e.center.y + e.B),
         P(e.center.x + e.A, e.center.y - e.B), P(e.center.x - e.A, e.center.y - e.B)]), p);
      const theirs = appletTangent2From(e, p);
      if (!mine || !theirs || mine.length !== 2 || theirs.length !== 2 ||
          !closePoint(mine[0], theirs[0], 1e-6) || !closePoint(mine[1], theirs[1], 1e-6)) ok = false;
    }
    /* A point whose stretched x is within 1 unit of the circle centre forces
       GeoSDoub.IntersectCirclesY; a point to the side takes the X branch. */
    const above = P(e.center.x, e.center.y - between(1.4, 4) * e.B);
    const aside = P(e.center.x + between(1.4, 4) * e.A, e.center.y);
    if (C.tangentPoints(C.ellipseFrom(
      [P(e.center.x - e.A, e.center.y + e.B), P(e.center.x + e.A, e.center.y + e.B),
       P(e.center.x + e.A, e.center.y - e.B), P(e.center.x - e.A, e.center.y - e.B)]), above) &&
        appletTangent2From(e, above)) yBranchSeen = true;
    if (C.tangentPoints(C.ellipseFrom(
      [P(e.center.x - e.A, e.center.y + e.B), P(e.center.x + e.A, e.center.y + e.B),
       P(e.center.x + e.A, e.center.y - e.B), P(e.center.x - e.A, e.center.y - e.B)]), aside)) xBranchSeen = true;
    const inside = P(e.center.x + between(-0.6, 0.6) * e.A, e.center.y + between(-0.6, 0.6) * e.B);
    if (ellipseValue(e, inside) < 1 && (C.tangentPoints(C.ellipseFrom(
      [P(e.center.x - e.A, e.center.y + e.B), P(e.center.x + e.A, e.center.y + e.B),
       P(e.center.x + e.A, e.center.y - e.B), P(e.center.x - e.A, e.center.y - e.B)]), inside) ||
      appletTangent2From(e, inside))) insideNull = false;
  }
  check("Tangent2From matches the bytecode on 600 outside points", ok);
  check("points inside the ellipse give no tangents, in both versions", insideNull);
  check("both circle-intersection branches of GeoSDoub are exercised",
    xBranchSeen && yBranchSeen && branches.X > 0 && branches.Y > 0);
}

{
  let ok = true;
  for (let i = 0; i < 200; i++) {
    const s = randomState();
    const mine = C.compute(s), theirs = appletCompute(s);
    ok = ok && ["C", "D", "E", "F"].every((k) => closePoint(mine[k], theirs[k], 1e-5)) &&
      mine.touch === theirs.touch &&
      close(mine.touchDistance === null ? Infinity : mine.touchDistance,
        theirs.touchDistance === null ? Infinity : theirs.touchDistance, 1e-5);
  }
  check("Compute and CheckTouch agree with the applet on 200 configurations", ok);
}

{
  let ok = true;
  for (let i = 0; i < 300; i++) {
    const s = randomState();
    const g = appletCompute(s);
    if (!g.lineB) continue;
    const p = P(between(0, 600), between(0, 450));
    const target = onPolar(appletEllipse(s.V), s.A, between(-1.5, 1.5));
    const l = { p: target, q: P(target.x + between(-90, 90), target.y + between(-90, 90)) };
    ok = ok && close(C.distToLine(p, l), appletDistToLine(p, l), 1e-8);
  }
  check("GeoSDoub.Dist matches on 300 random points and lines", ok);
}

{
  let ok = true;
  for (let i = 0; i < 80; i++) {
    const s = randomState();
    const g = C.compute(s);
    if (!g.lineB || !g.lineA) continue;
    /* Walk A across EF: the one-pixel threshold must flip in both versions. */
    const l = g.lineB;
    const dx = l.q.x - l.p.x, dy = l.q.y - l.p.y;
    const n = Math.hypot(dx, dy);
    for (const delta of [-2, -1.01, -0.99, 0, 0.99, 1.01, 2]) {
      const A2 = P(s.A.x - dy / n * delta, s.A.y + dx / n * delta);
      if (ellipseValue(g.ellipse, A2) < 1.01) continue;
      const s2 = { ...s, A: A2 };
      const mine = C.compute(s2), theirs = appletCompute(s2);
      if (!mine.lineB || !theirs.lineB || mine.touch !== theirs.touch) ok = false;
    }
  }
  check("the one-pixel touch threshold agrees on both sides of EF", ok);
}

{
  let ok = true;
  for (let i = 0; i < 100; i++) {
    const V = randomEllipse();
    for (let k = 0; k < 4; k++) {
      const q = P(between(30, 570), between(20, 430));
      const mine = C.maintainRect(V, k, q), theirs = appletMaintainRect(V, k, q);
      ok = ok && mine.every((p, j) => closePoint(p, theirs[j], 1e-12));
    }
  }
  check("MaintainRect matches on all four corners of 100 rectangles", ok);
}

/* ---------------------------------------------- 3. the page's claims, exhaustively */

{
  let touches = true, onPolar = true;
  for (let i = 0; i < 400; i++) {
    const e = appletEllipse(randomEllipse());
    const V = [P(e.center.x - e.A, e.center.y + e.B), P(e.center.x + e.A, e.center.y + e.B),
      P(e.center.x + e.A, e.center.y - e.B), P(e.center.x - e.A, e.center.y - e.B)];
    const A = outsidePoint(e), B = outsidePoint(e);
    const g = C.compute({ view: C.VIEW, V, A, B, names: true, explored: false });
    if (!g.lineA || !g.lineB) { touches = false; continue; }
    for (const p of [g.C, g.D]) {
      if (Math.abs(ellipseValue(e, p) - 1) > 1e-6) touches = false;
      if (Math.abs(polarResidual(e, A, p)) > 1e-6) onPolar = false;
    }
    for (const p of [g.E, g.F]) {
      if (Math.abs(ellipseValue(e, p) - 1) > 1e-6) touches = false;
      if (Math.abs(polarResidual(e, B, p)) > 1e-6) onPolar = false;
    }
  }
  check("all four contact points lie on the ellipse (400 cases)", touches);
  check("CD and EF are the polars of A and B (400 cases)", onPolar);
}

{
  let symmetric = true, implied = true, converse = true, pixel = true, finiteAll = true;
  for (let i = 0; i < 400; i++) {
    const e = appletEllipse(randomEllipse());
    const V = [P(e.center.x - e.A, e.center.y + e.B), P(e.center.x + e.A, e.center.y + e.B),
      P(e.center.x + e.A, e.center.y - e.B), P(e.center.x - e.A, e.center.y - e.B)];
    const A = outsidePoint(e);
    const B = onPolarOutside(e, A, between(0.1, 1.2), rnd() < 0.5 ? 1 : -1); // B on CD, outside
    const state = { view: C.VIEW, V, A, B, names: true, explored: false };
    const c = C.claims(state);
    const r1 = polarResidual(e, A, B), r2 = polarResidual(e, B, A);
    if (!close(r1, r2, 1e-9)) symmetric = false;
    if (!c.bOnCD || !c.aOnEF || !c.implication) implied = false;
    if (!c.lineB || c.touchDistance === null || !(c.touchDistance < 1)) pixel = false;
    if (!c.contactPoints || !c.onPolars || !c.lineAgreement) finiteAll = false;

    /* The converse: start from B and put A on EF. */
    const A2 = onPolarOutside(e, B, between(0.1, 1.2), rnd() < 0.5 ? 1 : -1);
    const c2 = C.claims({ view: C.VIEW, V, A: A2, B, names: true, explored: false });
    if (!c2.aOnEF || !c2.bOnCD || !c2.implication) converse = false;
  }
  check("the polar residual is symmetric in A and B (400 cases)", symmetric);
  check("the page's claim holds: B on CD implies A on EF (400 cases)", implied);
  check("the converse holds as well (400 cases)", converse);
  check("an exact B on CD lights the applet's one-pixel touch test (400 cases)", pixel);
  check("contact points, polars and drawn chords agree (400 cases)", finiteAll);
}

{
  let ok = true;
  for (let i = 0; i < 100; i++) {
    const e = appletEllipse(randomEllipse());
    const V = [P(e.center.x - e.A, e.center.y + e.B), P(e.center.x + e.A, e.center.y + e.B),
      P(e.center.x + e.A, e.center.y - e.B), P(e.center.x - e.A, e.center.y - e.B)];
    const A = outsidePoint(e), B = onPolarOutside(e, A, between(0.1, 1.2));
    /* Perpendicular to CD in stretched coordinates, 8 px away in board units. */
    const n = P((A.x - e.center.x) / (e.A * e.A), (A.y - e.center.y) / (e.B * e.B));
    const len = Math.hypot(n.x, n.y);
    const off = P(B.x + 8 * n.x / len, B.y + 8 * n.y / len);
    const c = C.claims({ view: C.VIEW, V, A, B: off, names: true, explored: false });
    if (!c.lineB || c.bOnCD || c.touch) ok = false;
  }
  check("B 8 px off CD does not trigger the claim or the touch test", ok);
}

{
  /* The page adds: valid for all non-degenerate conics. A conic is a symmetric
     quadratic form Q; its polar relation R·Q·P = 0 is symmetric by construction.
     Test that with an ellipse, a hyperbola and a parabola. */
  const quadrics = [
    { name: "ellipse", Q: [[1 / 3600, 0, 0], [0, 1 / 2500, 0], [0, 0, -1]], p: P(200, 100) },
    { name: "hyperbola", Q: [[1 / 3600, 0, 0], [0, -1 / 2500, 0], [0, 0, -1]], p: P(250, 140) },
    { name: "parabola", Q: [[1, 0, 0], [0, 0, -100], [0, -100, 0]], p: P(120, 80) },
  ];
  const form = (Q, u, v) => {
    let s = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += u[i] * Q[i][j] * v[j];
    return s;
  };
  let ok = true;
  for (const { Q, p } of quadrics) {
    const u = [p.x, p.y, 1];
    for (let k = 0; k < 60; k++) {
      const q = [between(-400, 400), between(-400, 400), 1];
      const pq = form(Q, u, q), qp = form(Q, q, u);
      if (!close(pq, qp, 1e-9)) ok = false;
      /* A point on the polar has both bilinear forms zero. */
      if (Math.abs(pq) < 1e-9 && Math.abs(qp) > 1e-9) ok = false;
    }
  }
  check("non-degenerate conics keep the symmetric polar relation", ok);
}

{
  let ok = true;
  for (let i = 0; i < 150; i++) {
    const s = randomState();
    const next = C.placeB(s);
    const e = C.ellipseFrom(next.V);
    const c = C.claims(next);
    if (next.B.x < 10 || next.B.x > 590 || next.B.y < 10 || next.B.y > 440 ||
        !(ellipseValue(e, next.B) > 1) || !c.bOnCD || !c.touch) ok = false;
    if (!next.A.x || !next.B.x) ok = false;
  }
  check("Put B on CD puts B outside the oval, on CD, and lights the touch test", ok);

  const s0 = C.start({});
  const before = JSON.stringify(s0);
  const s1 = C.move(s0, "A", P(400, 200));
  check("moving does not mutate the position it was given", JSON.stringify(s0) === before);
  check("moves keep names and explored, and the demo has no result",
    s1.names === s0.names && s1.explored === s0.explored && C.result(s1) === null);
  const pos = C.position(C.placeB(s0));
  check("the saved position is plain finite data",
    Number.isFinite(pos.C.x) && Number.isFinite(pos.F.y) &&
    pos.V.length === 4 && typeof pos.touch === "boolean");
}

done("lahire-on-ellipse");
