#!/usr/bin/env node
"use strict";

/*
 * Logic test for butterfly-in-ellipse/butterfly-in-ellipse-core.js.
 *
 *   node porting/check-butterfly-in-ellipse.mjs
 *
 * Checks the applet's starting rectangle, line and alternating vertices, its
 * Cramer line intersection, its stretched-circle secant and the backwards
 * chain it uses when a vertex is dragged. Every check also runs against a
 * second transcription of those methods taken literally from the bytecode
 * (CTKEllipse.EllipseAt / KeepOnEllipse / Intersect, GeoSDoub.Intersect and
 * ButterflyInEllipseCanvas.GetLineCoefs / Other / Intersect / AdjustPointOnLine /
 * AdjustPointOnEllipse / AdjustLinks), over hundreds of random configurations.
 *
 * The article's claims are tested too: every side of an even-sided polygon
 * meets the fixed line at its own pinned point after any drag; the same
 * calculation holds for a circle carried to an ellipse by an affine map; and
 * N is 4..20 as the applet's spinner says. The test also records what happens
 * for odd N, which the article does not mention.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("butterfly-in-ellipse/butterfly-in-ellipse-core.js", "ButterflyInEllipseCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) =>
  p && q && Number.isFinite(p.x) && Number.isFinite(q.x) &&
  close(p.x, q.x, tol) && close(p.y, q.y, tol);
const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const distToLine = (p, a, b) => {
  const len = dist(a, b);
  return len ? Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len : Infinity;
};

/* ------------------------- the applet's arithmetic, written from bytecode */

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint). */
function appletIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN); // the applet's own guard
  return P((c2 * b1 - c1 * b2) / det, (a2 * c1 - a1 * c2) / det);
}

/* CTKEllipse(V) and EllipseAt(t). */
function appletEllipse(V) {
  return {
    center: P((V[0].x + V[1].x) / 2, (V[1].y + V[2].y) / 2),
    inf: P((V[0].x + V[1].x) / 2 + 200, (V[1].y + V[2].y) / 2),
    A: (V[1].x - V[0].x) / 2,
    B: (V[1].y - V[2].y) / 2,
  };
}
const appletEllipseAt = (e, t) => P(e.center.x + e.A * Math.cos(t), e.center.y + e.B * Math.sin(t));

/* GeoSDoub.FindOrientation and ComputeSignedAngle. */
function appletOrientation(a, b, c) {
  const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return s > 0 ? 1 : -1;
}
function appletSignedAngle(a, b, c) {
  const sq = (u, v) => (u.x - v.x) ** 2 + (u.y - v.y) ** 2;
  const cosv = (sq(a, b) + sq(a, c) - sq(b, c)) /
    (2 * Math.sqrt(sq(a, b)) * Math.sqrt(sq(a, c)));
  const clamped = Math.min(1, Math.max(-1, cosv));
  return appletOrientation(a, b, c) === 1 ? Math.acos(clamped) : -Math.acos(clamped);
}
function appletKeepOnEllipse(e, p) {
  const u = P((p.x - e.center.x) / e.A, (p.y - e.center.y) / e.B);
  const onUnitCircle = P(e.center.x + u.x, e.center.y + u.y);
  return appletEllipseAt(e, appletSignedAngle(e.center, e.inf, onUnitCircle));
}

/* CTKEllipse.MaintainRect, all four branches of the bytecode. */
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

/* GeoSDoub.Intersect(DoubLine,DoubCircle) — the +sqrt root is hits[0]. */
function appletCircleLine(p, q) {
  if (Math.abs(p.y - q.y) > 1) {
    const m = (p.x - q.x) / (p.y - q.y);
    const b = q.x - m * q.y;
    const A = m * m + 1;
    const B = m * b;
    const Cc = b * b - 1000 * 1000;
    const disc = B * B - A * Cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const y1 = (-B + s) / A, y2 = (-B - s) / A;
    return [P(m * y1 + b, y1), P(m * y2 + b, y2)];
  }
  if (Math.abs(p.x - q.x) > 1) {
    const m = (p.y - q.y) / (p.x - q.x);
    const b = q.y - m * q.x;
    const A = m * m + 1;
    const B = m * b;
    const Cc = b * b - 1000 * 1000;
    const disc = B * B - A * Cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const x1 = (-B + s) / A, x2 = (-B - s) / A;
    return [P(x1, m * x1 + b), P(x2, m * x2 + b)];
  }
  return null;
}

/* CTKEllipse.Intersect(a,b,c), straight from the circle transform. */
function appletEllipseIntersect(e, a, b, c) {
  const d = a * e.center.x + b * e.center.y + c;
  const hits = appletCircleLine(P(0, (-1000 * d) / (b * e.B)), P((-1000 * d) / (a * e.A), 0));
  if (!hits) return null;
  return hits.map((h) => P((h.x * e.A) / 1000 + e.center.x, (h.y * e.B) / 1000 + e.center.y));
}

/* GetLineCoefs, Other, ReflectPointInPoint and Intersect of the canvas. */
function appletLineCoefs(a, b) {
  const s4 = b.y - a.y, s6 = b.x - a.x;
  return [s4, -s6, -a.x * s4 + a.y * s6];
}
function appletOther(hits, b) {
  if (!hits) return b;
  try {
    return dist(hits[0], b) < 1 ? hits[1] : hits[0];
  } catch (_) {
    return b;
  }
}
function appletSecant(e, a, b, fallback) {
  const reflect = (u, v) => P(2 * u.x - v.x, 2 * u.y - v.y);
  const far = reflect(b, reflect(a, b)); // 2b - (2a - b)
  const cf = appletLineCoefs(far, b);
  return appletOther(appletEllipseIntersect(e, cf[0], cf[1], cf[2]), b) || fallback;
}
function appletAdjustPointOnLine(s, i) {
  const j = (i + s.n - 1) % s.n;
  return appletIntersect(s.P[i], s.P[j], s.line.p, s.line.q);
}
function appletAdjustPointOnEllipse(s, k) {
  const e = appletEllipse(s.V);
  const Pts = s.P.map((p) => P(p.x, p.y));
  let slot = k;
  for (let t = s.n - 1; t > 0; t--) {
    const j = (k + t) % s.n;
    const q = appletSecant(e, s.L[slot], Pts[slot], Pts[j]);
    slot = j;
    Pts[j] = P(q.x, q.y);
  }
  return Pts;
}
function appletAdjustLinks(s, k, target) {
  const e = appletEllipse(s.V);
  const Pts = s.P.map((p) => P(p.x, p.y));
  const L = s.L.map((p) => P(p.x, p.y));
  const j = (k + s.n - 1) % s.n;
  L[k] = P(target.x, target.y);
  const q = appletSecant(e, L[k], Pts[j], Pts[k]);
  Pts[k] = P(q.x, q.y);
  L[(k + 1) % s.n] = appletAdjustPointOnLine({ P: Pts, L, n: s.n, line: s.line }, (k + 1) % s.n);
  return { P: Pts, L };
}

/* ------------------------------------------------------------- test setup */

function randomState(rnd, n, tiltedLine) {
  const cx = 160 + rnd() * 80, cy = 110 + rnd() * 70;
  const rx = 70 + rnd() * 70, ry = 50 + rnd() * 55;
  const V = [P(cx - rx, cy + ry), P(cx + rx, cy + ry),
    P(cx + rx, cy - ry), P(cx - rx, cy - ry)];
  const e = appletEllipse(V);
  const line = tiltedLine
    ? { p: P(20 + rnd() * 40, 40 + rnd() * 60), q: P(330 + rnd() * 50, 210 + rnd() * 60) }
    : C.defaultLine({ width: 400, height: 300 });
  const Pts = [];
  let t = rnd() * 0.3;
  for (let i = 0; i < n; i++) {
    t += Math.PI / n + (rnd() - 0.5) * 0.06;
    Pts.push(appletEllipseAt(e, t + (i % 2 === 0 ? Math.PI : 0)));
  }
  const base = { view: { width: 400, height: 300 }, n, seed: 1, V, P: Pts, line,
    L: [], names: false, explored: false };
  base.L = Pts.map((_, i) => appletAdjustPointOnLine(base, i));
  return base;
}

/** Near-parallel sides put F far off the board; skip those ill-conditioned pictures. */
function wellConditioned(s) {
  if (!s.L.every((p) => finite(p) && p.x > -250 && p.x < 650 && p.y > -250 && p.y < 550)) return false;
  for (let i = 0; i < s.n; i++) {
    const p = s.P[i], q = s.P[(i + s.n - 1) % s.n];
    const det = (p.y - q.y) * (s.line.q.x - s.line.p.x) -
      (s.line.q.y - s.line.p.y) * (p.x - q.x);
    if (Math.abs(det) < 25) return false;
  }
  return true;
}

/** A near-tangent secant loses digits in the circle transform; skip those. */
function stableChain(s, k) {
  const e = appletEllipse(s.V);
  const Pts = s.P.map((p) => P(p.x, p.y));
  let prev = k;
  for (let t = s.n - 1; t > 0; t--) {
    const j = (k + t) % s.n;
    const inner = P(2 * s.L[prev].x - Pts[prev].x, 2 * s.L[prev].y - Pts[prev].y);
    const far = P(2 * Pts[prev].x - inner.x, 2 * Pts[prev].y - inner.y);
    const cf = appletLineCoefs(far, Pts[prev]);
    const hits = appletEllipseIntersect(e, cf[0], cf[1], cf[2]);
    if (!hits || dist(hits[0], hits[1]) < 0.05) return false;
    const q = appletSecant(e, s.L[prev], Pts[prev], Pts[j]);
    if (dist(q, Pts[j]) < 1e-6) return false; // the applet fell back instead of crossing
    Pts[j] = q;
    prev = j;
  }
  return true;
}

function sidesHold(s, tol) {
  if (!s.L.every((p) => finite(p) && distToLine(p, s.line.p, s.line.q) < tol)) return false;
  for (let i = 0; i < s.n; i++) {
    const hit = appletIntersect(s.P[i], s.P[(i + s.n - 1) % s.n], s.line.p, s.line.q);
    const room = Math.max(tol, Math.hypot(hit.x, hit.y), Math.hypot(s.L[i].x, s.L[i].y)) * 1e-4;
    if (!closePoint(hit, s.L[i], room)) return false;
  }
  return true;
}

/* ------------------------------------------------ 1. the starting picture */

{
  const s = C.start({});
  const e = appletEllipse(s.V);
  check("the start uses the applet's 400x300 board", s.view.width === 400 && s.view.height === 300);
  equal("the start rectangle is width/3 by height/3", s.V, [
    P(200 - 400 / 3, 150 + 100), P(200 + 400 / 3, 150 + 100),
    P(200 + 400 / 3, 150 - 100), P(200 - 400 / 3, 150 - 100),
  ]);
  check("the centre and radii match CTKEllipse(V)",
    closePoint(C.ellipseFrom(s.V).center, e.center, 1e-9) &&
    close(C.ellipseFrom(s.V).A, e.A, 1e-9) && close(C.ellipseFrom(s.V).B, e.B, 1e-9));
  equal("the fixed line is (0, floor(2h/7)) to (w, floor(7h/8))", s.line,
    { p: P(0, 85), q: P(400, 262) });
  check("the default polygon has the applet's four vertices",
    s.n === 4 && s.P.length === 4 && s.L.length === 4);
  check("the start vertices lie on the ellipse at alternating angles",
    s.P.every((p, k) => {
      const onEllipse = Math.abs(((p.x - e.center.x) ** 2) / (e.A * e.A) +
        ((p.y - e.center.y) ** 2) / (e.B * e.B) - 1) < 1e-9;
      const want = (Math.PI / 4) * k + (k % 2 === 0 ? Math.PI : 0);
      const got = Math.atan2((p.y - e.center.y) / e.B, (p.x - e.center.x) / e.A);
      /* Reset adds (random - 1/2)*pi/8, so the angle is within pi/16. */
      return onEllipse && Math.abs(Math.atan2(Math.sin(got - want), Math.cos(got - want))) <= Math.PI / 16 + 1e-9;
    }));
  check("the four F points are where the sides cross the line",
    closePoint(C.adjustPointOnLine(s, 0), s.L[0], 1e-6) &&
    [1, 2, 3].every((i) => closePoint(s.L[i], appletIntersect(s.P[i], s.P[i - 1], s.line.p, s.line.q), 1e-6)));
  check("the start picture satisfies the butterfly incidence", sidesHold(s, 0.08));
  check("an illustration cannot be won or lost", C.result(s) === null);
}

/* ---------------- 2. secants against a literal second transcription */

{
  const rnd = rng(31);
  let secants = true, hits = true, guarded = true;
  for (let i = 0; i < 300; i++) {
    const V = [P(100 + rnd() * 30, 200 + rnd() * 20), P(270 + rnd() * 40, 200 + rnd() * 20),
      P(270 + rnd() * 40, 90 + rnd() * 20), P(100 + rnd() * 30, 90 + rnd() * 20)];
    const e = appletEllipse(V);
    const angle = rnd() * 2 * Math.PI;
    const b = appletEllipseAt(e, angle);
    const a = P(b.x + (rnd() - 0.5) * 180, b.y + (rnd() - 0.5) * 140);
    const fallback = appletEllipseAt(e, angle + 1.1);
    const mine = C.secant(e, a, b, fallback);
    const want = appletSecant(appletEllipse(V), a, b, fallback);
    if (!closePoint(mine, want, 1e-5)) secants = false;
    /* The returned point is really the second crossing, not the input. */
    const cf = C.lineCoefs(a, b);
    const both = C.ellipseIntersect(e, cf[0], cf[1], cf[2]);
    if (!both || !both.some((q) => closePoint(q, mine, 1e-5)) ||
        !both.every((q) => Math.abs(cf[0] * q.x + cf[1] * q.y + cf[2]) < 1e-4)) hits = false;
    if (Number.isNaN(C.intersect(b, b, a, a).x) !==
        Number.isNaN(appletIntersect(b, b, a, a).x)) guarded = false;
  }
  check("secant equals the applet's Intersect on 300 secants", secants);
  check("each result is the ellipse's second crossing on the same line", hits);
  check("the |det| < 1 guard returns NaN just as GeoSDoub does", guarded);
}

/* --------------------- 3. dragging a vertex along the ellipse */

{
  const rnd = rng(907);
  for (const n of [4, 6, 8, 10, 20]) {
    let matches = true, preserved = true, pinned = true, tried = 0;
    for (let trial = 0; trial < 400 && tried < 80; trial++) {
      const s = trial === 0 ? C.start({ n }) : randomState(rnd, n, trial % 2 === 0);
      if (!wellConditioned(s)) continue;
      const k = trial % n;
      const target = s.P[k];
      const moved = C.move(s, "P" + k, { x: target.x + (rnd() - 0.5) * 70,
        y: target.y + (rnd() - 0.5) * 60 });
      if (!wellConditioned(moved)) continue; // the applet's NaN guard applies here too
      const chainFrom = { ...s, P: s.P.map((p) => P(p.x, p.y)) };
      chainFrom.P[k] = P(moved.P[k].x, moved.P[k].y);
      if (!stableChain(chainFrom, k)) continue; // no reliable second crossing
      tried++;
      const want = appletAdjustPointOnEllipse(s, k);
      want[k] = appletKeepOnEllipse(appletEllipse(s.V), moved.P[k]);
      /* The applet re-runs the chain from the dragged point; compare that. */
      const second = appletAdjustPointOnEllipse({ ...s, P: want }, k);
      if (!moved.P.every((p, i) => closePoint(p, second[i], 1e-3))) matches = false;
      if (moved.L.some((p, i) => !closePoint(p, s.L[i], 1e-9))) pinned = false;
      if (!sidesHold(moved, 0.06)) preserved = false;
    }
    check(`dragging a vertex matches the applet and keeps all ${n} sides pinned (${tried} cases)`,
      tried >= 40 && matches && pinned && preserved,
      `match=${matches} pinned=${pinned} sides=${preserved} tried=${tried}`);
  }
}

/* --------------------- 4. dragging an F point along the fixed line */

{
  const rnd = rng(1777);
  let matches = true, sideOK = true, nextOK = true;
  for (let trial = 0; trial < 240; trial++) {
    const s = trial === 0 ? C.start({}) : randomState(rnd, 4, trial % 3 === 0);
    const k = trial % 4;
    const t = 0.15 + rnd() * 0.7;
    const target = P(s.line.p.x + (s.line.q.x - s.line.p.x) * t,
      s.line.p.y + (s.line.q.y - s.line.p.y) * t);
    const got = C.move(s, "F" + k, target);
    const want = appletAdjustLinks(s, k, target);
    if (!got.P.every((p, i) => closePoint(p, want.P[i], 2e-4)) ||
        !got.L.every((p, i) => closePoint(p, want.L[i], 1e-6))) matches = false;
    const hit = appletIntersect(got.P[k], got.P[(k + 3) % 4], s.line.p, s.line.q);
    if (!closePoint(hit, target, 0.06)) sideOK = false;
    const next = (k + 1) % 4;
    const hit2 = appletIntersect(got.P[next], got.P[k], s.line.p, s.line.q);
    if (!closePoint(hit2, got.L[next], 0.06)) nextOK = false;
  }
  check("sliding an F point matches AdjustLinks in 240 configurations", matches);
  check("the dragged side passes through the F point that was moved", sideOK);
  check("the next F point is recomputed from the new side", nextOK);
}

/* ------------------ 5. reshaping the ellipse and moving the line */

{
  const rnd = rng(2027);
  let rectOK = true, snapped = true, lineOK = true;
  for (let trial = 0; trial < 200; trial++) {
    const s = trial === 0 ? C.start({}) : randomState(rnd, 4, false);
    const corner = trial % 4;
    const q = P(s.V[corner].x + (rnd() - 0.5) * 40, s.V[corner].y + (rnd() - 0.5) * 40);
    const Vwant = appletMaintainRect(s.V, corner, q);
    if (!C.maintainRect(s.V, corner, q).every((v, i) => closePoint(v, Vwant[i], 1e-9))) rectOK = false;
    const after = C.move(s, "V" + corner, q);
    const e2 = appletEllipse(Vwant);
    if (!after.P.every((p, i) => closePoint(p, appletKeepOnEllipse(e2, s.P[i]), 2e-4))) snapped = false;
    if (!sidesHold(after, 0.06)) lineOK = false;
  }
  check("MaintainRect mirrors the dragged corner exactly", rectOK);
  check("all vertices snap back onto the reshaped ellipse", snapped);
  check("the butterfly incidences survive reshaping the ellipse", lineOK);

  const s = C.start({});
  const movedLine = C.move(s, "m1", P(10, 40));
  check("moving an end of the line recomputes every crossing",
    movedLine.L.every((p, i) => closePoint(p,
      appletIntersect(movedLine.P[i], movedLine.P[(i + 3) % 4],
        movedLine.line.p, movedLine.line.q), 0.06)));
}

/* -------------------------- 6. the article's claims */

{
  /* The article says a proof for a circle works for every conic because the
     statement only uses incidences. Carry a circle by an affine map to an
     ellipse and repeat the very same construction on both pictures. */
  const map = (p) => P(200 + 1.4 * p.x, 150 + 0.8 * p.y);
  const circle = (t) => P(70 * Math.cos(t), 70 * Math.sin(t));
  const angles = [-2.4, -0.9, 0.5, 2.0];
  const q = angles.map(circle);
  const line = { p: P(-90, -45), q: P(90, 40) };
  const F = [];
  for (let i = 0; i < 4; i++) {
    const hit = appletIntersect(q[i], q[(i + 3) % 4], line.p, line.q);
    F.push(hit);
  }
  /* Move A, then rebuild D, C, B backwards from the three pinned crossings. */
  function copyP(p) { return P(p.x, p.y); }
  const unitCircle = { center: P(0, 0), A: 70, B: 70, inf: P(200, 0) };
  const q2 = q.map(copyP);
  q2[0] = circle(1.15);
  let prev = 0;
  for (let j = 3; j >= 1; j--) {
    const hit = appletSecant(unitCircle, F[prev], q2[prev], q2[j]);
    q2[j] = copyP(hit);
    prev = j;
  }
  const lastHit = appletIntersect(q2[0], q2[1], line.p, line.q);
  check("the fourth side of the circle quadrilateral meets its pinned point",
    closePoint(lastHit, F[1], 1e-4));

  const mappedF = F.map(map);
  const mappedLine = { p: map(line.p), q: map(line.q) };
  const mappedQ = q2.map(map);
  const mappedHit = appletIntersect(mappedQ[0], mappedQ[1], mappedLine.p, mappedLine.q);
  check("the same incidences survive an affine map to an ellipse",
    closePoint(mappedHit, mappedF[1], 1e-3));

  /* Do the same inside the port: an ellipse whose points come from the map.
     The applet picks a secant's second crossing by comparing distances, which
     an affine map does not preserve, so compare the incidences (the actual
     projective claim) rather than which of the two roots it happens to name. */
  const Vm = [map(P(-70, 70)), map(P(70, 70)), map(P(70, -70)), map(P(-70, -70))];
  const ring = angles.map((t) => map(circle(t)));
  const fRing = ring.map((p, i) => appletIntersect(p, ring[(i + 3) % 4], mappedLine.p, mappedLine.q));
  const sMapped = { ...C.start({}), V: Vm, P: ring, L: fRing, line: mappedLine };
  const dragged = C.move(sMapped, "P0", map(circle(1.15)));
  check("the port's chain keeps every mapped crossing pinned",
    dragged.L.every((p, i) => closePoint(p,
      appletIntersect(dragged.P[i], dragged.P[(i + 3) % 4], mappedLine.p, mappedLine.q), 1e-3)));
  check("the port reports the affine butterfly picture as holding",
    C.claims(dragged).holds);
}

{
  /* N is set by the applet's spinner: PVNumeric min 4, max 20, integer. */
  check("N follows the applet's 4..20 spinner",
    C.start({ n: -3 }).n === 4 && C.start({ n: 2 }).n === 4 &&
    C.start({ n: 4 }).n === 4 && C.start({ n: 11 }).n === 11 &&
    C.start({ n: 99 }).n === 20);
  const odd = C.start({ n: 5 });
  const moved = C.move(odd, "P0", { x: odd.P[0].x + 12, y: odd.P[0].y - 9 });
  /* The article expressly says the porism is for an even number of sides.
     Check that this is not decorative: the same chain fails at N = 5. */
  check("the even-number qualification matters: N = 5 gives a counterexample",
    !C.claims(moved).holds, `odd N = 5, holds = ${C.claims(moved).holds}`);
}

/* ------------------------------------------------ 7. guards and saved data */

{
  const s = C.start({});
  const same = { ...s, P: s.P.map((p) => P(p.x, p.y)) };
  same.P[1] = P(same.P[0].x, same.P[0].y);
  const degenerate = C.intersect(same.P[0], same.P[1], s.line.p, s.line.q);
  check("coincident vertices give the applet's NaN intersection", Number.isNaN(degenerate.x));
  const near = C.clampCorner(P(200, 150), s);
  check("clampCorner refuses a collapse onto a centre line",
    Math.abs(near.x - 200) >= 11 && Math.abs(near.y - 150) >= 11);
  const out = C.clamp(P(-50, 999), s);
  check("clamp keeps handles on the board", out.x >= 6 && out.x <= 394 && out.y >= 6 && out.y <= 294);
  const pos = C.position(C.move(s, "F2", P(300, 210)));
  check("the saved position is plain board-unit data",
    Array.isArray(pos.P) && Array.isArray(pos.L) && finite(pos.P[0]) && finite(pos.line.p) &&
    pos.n === 4 && pos.explored === false);
  check("showing names is only offered for the four-point picture",
    C.start({}).names === false && C.start({ names: true }).names === true &&
    C.start({ n: 6, names: true }).names === false);
}

done("butterfly-in-ellipse");
