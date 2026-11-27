#!/usr/bin/env node
"use strict";

/*
 * Logic test for feuerbach-treasure/feuerbach-treasure-core.js.
 *
 *   node porting/check-feuerbach-treasure.mjs
 *
 * Checked: the applet's starting positions and its four checkboxes; the page's
 * whole claim on many fixed and random configurations (one nine-point circle
 * shared by ABC, ABH, BCH, CAH; nine points on it; Feuerbach tangency to all
 * sixteen incircles/excircles; the dots on both circles; sixteen distinct
 * circles only "in general"); the right-angle exception; and a second, literal
 * transcription of the applet's GeoSDoub / DoubCircle bytecode (rotate a ray
 * by half an angle, intersect two lines, average three distances) compared
 * with the core's barycentric formulas over every configuration tested.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("feuerbach-treasure/feuerbach-treasure-core.js", "FeuerbachTreasureCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });
const doubleArea = (A, B, Cc) =>
  Math.abs((B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x));

/* ---------------------------------- the applet's methods, transcribed again */

/* GeoSDoub.SqDist, Dist, ComputeAngle. */
function sq(P, Q) {
  const dx = P.x - Q.x, dy = P.y - Q.y;
  return dx * dx + dy * dy;
}
function appletAngle(P, Q, R) {
  const num = sq(P, Q) + sq(P, R) - sq(Q, R);
  const c = num / (2 * Math.sqrt(sq(P, Q)) * Math.sqrt(sq(P, R)));
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

/* GeoSDoub.FindOrientation: +1 when the signed area is positive. */
function appletOrientation(P, Q, R) {
  const s = R.x * (P.y - Q.y) + R.y * (Q.x - P.x) + P.x * Q.y - Q.x * P.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate: rotate Q about P by angle, multiplied by the orientation. */
function appletRotate(P, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* GeoSDoub.Intersect: the ax+by+c=0 form, with its 1.0 parallel threshold. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.NearestPoint: the foot on the infinite line, with its 0.1 guard. */
function appletNearest(P, A, B) {
  const dx = B.x - A.x, dy = B.y - A.y;
  if (sq(A, P) < 0.1) return P;
  const t = (dx * (P.x - A.x) + dy * (P.y - A.y)) / (dx * dx + dy * dy);
  return { x: A.x + dx * t, y: A.y + dy * t };
}

/* GeoSDoub.FindIncenter(P,Q,R): intersect the two internal bisectors. */
function appletIncenter(P, Q, R) {
  const halfP = appletAngle(P, Q, R) / 2;
  const halfQ = appletAngle(Q, R, P) / 2;
  const o = appletOrientation(P, Q, R);
  return appletIntersect(P, appletRotate(P, Q, halfP, o), Q, appletRotate(Q, R, halfQ, o));
}

/* GeoSDoub.FindExcenter(P,Q,R): the excenter opposite P. */
function appletExcenter(P, Q, R) {
  const extQ = (Math.PI - appletAngle(Q, P, R)) / 2;
  const extR = (Math.PI - appletAngle(R, P, Q)) / 2;
  const o = appletOrientation(Q, P, R);
  return appletIntersect(
    Q, appletRotate(Q, R, extQ, o),
    R, appletRotate(R, Q, extR, -o),
  );
}

/* GeoSDoub.FindCircumcenter(P,Q,R) and DoubCircle(P,Q,R).GetRadius. */
function appletCircumcenter(P, Q, R) {
  const m1 = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  const m2 = { x: (Q.x + R.x) / 2, y: (Q.y + R.y) / 2 };
  const u = { x: m1.x + Q.y - P.y, y: m1.y - (Q.x - P.x) };
  const v = { x: m2.x + R.y - Q.y, y: m2.y - (R.x - Q.x) };
  return appletIntersect(m1, u, m2, v);
}
function appletCircle(center, P, Q, R) {
  return { c: center, r: (dist(center, P) + dist(center, Q) + dist(center, R)) / 3 };
}
function appletIncircle(P, Q, R) {
  const I = appletIncenter(P, Q, R);
  return appletCircle(I, appletNearest(I, Q, R), appletNearest(I, R, P), appletNearest(I, P, Q));
}
function appletExcircle(P, Q, R) {
  const E = appletExcenter(P, Q, R);
  return appletCircle(E, appletNearest(E, Q, R), appletNearest(E, R, P), appletNearest(E, P, Q));
}
function appletNinePoint(P, Q, R) {
  const mid = (U, V) => ({ x: (U.x + V.x) / 2, y: (U.y + V.y) / 2 });
  const m = [mid(Q, R), mid(R, P), mid(P, Q)];
  return appletCircle(appletCircumcenter(m[0], m[1], m[2]), m[0], m[1], m[2]);
}

/* FeuerbachTreasureCanvas.Compute: two altitudes, then intersect them. */
function appletOrthocenter(A, B, Cc) {
  return appletIntersect(A, appletNearest(A, B, Cc), B, appletNearest(B, Cc, A));
}

/* FeuerbachTreasureCanvas.ShowPoint: +t for excircles, -t for the incircle. */
function appletTangency(npc, circle, internal) {
  const d = dist(npc.c, circle.c);
  const t = circle.r / d;
  return internal
    ? { x: circle.c.x - t * (npc.c.x - circle.c.x), y: circle.c.y - t * (npc.c.y - circle.c.y) }
    : { x: circle.c.x + t * (npc.c.x - circle.c.x), y: circle.c.y + t * (npc.c.y - circle.c.y) };
}

/* ------------------------------------------------- 1. start, options, moves */

{
  const s = C.start();
  const radius = Math.min(400, 280) / 4;
  const at = (a) => ({ x: 200 + radius * Math.cos(a), y: 140 + radius * Math.sin(a) });
  check("start A matches the applet's -1.6 seed", closePoint(s.A, at(-1.6), 1e-12));
  check("start B matches the applet's -4.0 seed", closePoint(s.B, at(-4.0), 1e-12));
  check("start C matches the applet's -0.2 seed", closePoint(s.C, at(-0.2), 1e-12));
  check("all four checkbox fields start unchecked, as in the applet",
    C.TRIANGLES.every((k) => s.show[k] === false) && s.names === false);
  check("an illustration has no win or loss", C.result(s) === null);
  check("the starting triangle is not flat", !C.measurements(s).degenerate);
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A", { x: 12, y: 34 });
    return s.A.x !== 12 && next.A.x === 12 && next.B.x === s.B.x && next.show.ABC === false;
  })());
  check("withPoint ignores an unknown corner", C.withPoint(s, "Z", { x: 1, y: 2 }).C.x === s.C.x);
  check("toggle flips one checkbox and keeps the others", (() => {
    const next = C.toggle(s, "ABH");
    return next.show.ABH && !next.show.ABC && !s.show.ABH && next.A.x === s.A.x;
  })());
  check("toggle flips the names checkbox", C.toggle(s, "names").names === true && !s.names);
  check("setAll turns every triangle on and off", (() => {
    const on = C.setAll(s, true), off = C.setAll(on, false);
    return C.TRIANGLES.every((k) => on.show[k] && !off.show[k]) && !s.show.ABC;
  })());
  check("custom points are accepted for tests", (() => {
    const t = C.start({ points: { A: { x: 1, y: 2 }, B: { x: 3, y: 4 }, C: { x: 5, y: 6 } } });
    return t.A.x === 1 && t.B.y === 4 && t.C.x === 5;
  })());
}

/* ------------------------------------------------ 2. fixed configurations */

const START = C.start();
const fixed = [
  ["applet start", START],
  ["acute", tri({ x: 190, y: 40 }, { x: 60, y: 230 }, { x: 330, y: 200 })],
  ["obtuse at A", tri({ x: 40, y: 180 }, { x: 300, y: 80 }, { x: 330, y: 240 })],
  ["obtuse at B", tri({ x: 190, y: 40 }, { x: 50, y: 250 }, { x: 360, y: 240 })],
  ["obtuse at C", tri({ x: 30, y: 30 }, { x: 360, y: 70 }, { x: 180, y: 240 })],
  ["scalene", tri({ x: 90, y: 210 }, { x: 40, y: 60 }, { x: 330, y: 150 })],
  ["isosceles", tri({ x: 200, y: 40 }, { x: 60, y: 240 }, { x: 340, y: 240 })],
];
const stateOf = (t) => ({ ...t, show: { ABC: true, ABH: true, BCH: true, CAH: true }, names: true });

for (const [name, t] of fixed) {
  const s = stateOf(t), m = C.measurements(s), cl = C.claims(s);
  check(`${name}: four triangles, four circles each`, m.triangles.length === 4 && m.totalCircles === 16);
  check(`${name}: orthocentric quadruple`, cl.orthocentric);
  check(`${name}: the nine points lie on the shared circle`, cl.ninePoints);
  check(`${name}: all four nine-point circles coincide`, cl.sharedNinePointCircle);
  check(`${name}: Feuerbach tangency for all sixteen circles`, cl.feuerbachTangency);
  check(`${name}: tangency dots lie on both circles`, cl.tangencyPoints);
  check(`${name}: sixteen distinct circles`, cl.sixteenCircles);
}

/* ----------------------------------- 3. the page's claims, exhaustively enough */

{
  const rand = rng(4852);
  let tested = 0, allPass = 0;
  for (let i = 0; i < 600; i++) {
    const t = tri(
      { x: 10 + rand() * 380, y: 10 + rand() * 260 },
      { x: 10 + rand() * 380, y: 10 + rand() * 260 },
      { x: 10 + rand() * 380, y: 10 + rand() * 260 },
    );
    if (doubleArea(t.A, t.B, t.C) < 3000) continue;
    const s = stateOf(t), cl = C.claims(s), m = C.measurements(s);
    tested++;
    const ok = Object.values(cl).every(Boolean) && m.triangles.length === 4 && m.totalCircles === 16;
    if (ok) allPass++;
    else {
      check(`random triangle ${i}: every claim holds`, false, JSON.stringify(cl));
      break;
    }
  }
  check(`the sixteen-circle claim holds on ${tested} random triangles`, tested > 450);
  check(`every claim holds on all ${allPass} of them`, allPass === tested);
}

/* -------------------------- 4. "in general": the right-angle exception */

{
  const right = stateOf(tri({ x: 40, y: 240 }, { x: 40, y: 40 }, { x: 300, y: 240 }));
  const m = C.measurements(right), cl = C.claims(right);
  check("a right triangle sends H to the right-angle corner", closePoint(m.H, right.A, 1e-6));
  check("two of the four triangles collapse when H equals A", m.triangles.length === 2);
  check("only the two surviving triangles contribute circles", m.totalCircles === 8);
  check("the sixteen-distinct-circles claim is not made for a right triangle", !cl.sixteenCircles);
  check("Feuerbach tangency still holds for the circles that remain",
    C.allCircles(m).every((entry) => {
      const d = C.distance(m.npc.c, entry.circle.c);
      const expected = entry.internal ? m.npc.r - entry.circle.r : m.npc.r + entry.circle.r;
      return Math.abs(d - expected) < 1e-6 * Math.max(1, m.npc.r);
    }));
  check("a flat triangle has no nine-point circle", (() => {
    const flat = stateOf(tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }));
    return C.measurements(flat).npc === null && !Object.values(C.claims(flat)).some(Boolean);
  })());
}

/* ----------------------------- 5. the applet's own method vs the core */

{
  const rand = rng(19201);
  const cases = fixed.map(([, t]) => t);
  for (let i = 0; i < 300; i++) {
    const t = tri(
      { x: 10 + rand() * 380, y: 10 + rand() * 260 },
      { x: 10 + rand() * 380, y: 10 + rand() * 260 },
      { x: 10 + rand() * 380, y: 10 + rand() * 260 },
    );
    if (doubleArea(t.A, t.B, t.C) < 3000) continue;
    cases.push(t);
  }
  let compared = 0;
  const tolFor = (t) => 2e-5 * Math.max(dist(t.A, t.B), dist(t.B, t.C), dist(t.C, t.A));
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  for (const t of cases) {
    const m = C.measurements(stateOf(t));
    const tol = tolFor(t);
    const ah = appletOrthocenter(t.A, t.B, t.C);
    const anpc = appletNinePoint(t.A, t.B, t.C);
    // The applet's Intersect returns NaN below a determinant of 1, and its
    // NearestPoint has a 0.1 cut-off, so a nearly right triangle with a very
    // thin subtriangle cannot be compared numerically. Those are covered by
    // the core's own claim tests above, not by this transcription.
    if (m.triangles.some((entry) => entry.data.area < 50)) continue;
    const probe = [[t.A, t.B, t.C], [t.A, t.B, m.H], [t.B, t.C, m.H], [t.C, t.A, m.H]];
    const probesFinite = probe.every((verts) =>
      finite(appletIncenter(...verts)) &&
      finite(appletExcenter(...verts)) &&
      finite(appletExcenter(verts[1], verts[2], verts[0])) &&
      finite(appletExcenter(verts[2], verts[0], verts[1])) &&
      finite(appletNinePoint(...verts).c));
    if (!finite(ah) || !finite(anpc.c) || !probesFinite) continue;
    const ok =
      closePoint(ah, m.H, tol) &&
      closePoint(anpc.c, m.npc.c, tol) &&
      close(anpc.r, m.npc.r, tol);
    if (!ok) check("orthocentre and nine-point circle match the applet", false, JSON.stringify(t));
    const coreTriangles = m.triangles.map((x) => x.data);
    const appletTriangles = [
      [t.A, t.B, t.C], [t.A, t.B, m.H], [t.B, t.C, m.H], [t.C, t.A, m.H],
    ].map(([P, Q, R]) => ({
      incircle: appletIncircle(P, Q, R),
      excircles: [appletExcircle(P, Q, R), appletExcircle(Q, R, P), appletExcircle(R, P, Q)],
      ninePoint: appletNinePoint(P, Q, R),
    }));
    let circlesOk = coreTriangles.length === 4;
    for (let i = 0; i < coreTriangles.length && circlesOk; i++) {
      const core = coreTriangles[i], applet = appletTriangles[i];
      circlesOk =
        closePoint(applet.incircle.c, core.incircle.c, tol) &&
        close(applet.incircle.r, core.incircle.r, tol) &&
        closePoint(applet.ninePoint.c, core.ninePoint.c, tol) &&
        close(applet.ninePoint.r, core.ninePoint.r, tol) &&
        applet.excircles.every((circle, k) =>
          closePoint(circle.c, core.excircles[k].c, tol) &&
          close(circle.r, core.excircles[k].r, tol));
    }
    if (!circlesOk) check("all incircles, excircles and radii match the applet", false, JSON.stringify(t));
    let dotsOk = true;
    for (const entry of C.allCircles(m)) {
      const dot = appletTangency(m.npc, entry.circle, entry.internal);
      dotsOk = dotsOk && closePoint(dot, entry.point, tol);
    }
    if (!dotsOk) check("all sixteen tangency dots match ShowPoint", false, JSON.stringify(t));
    compared++;
  }
  check(`core matches the applet on ${compared} configurations`, compared > 240);
  check("the second transcription finds the same start incircle as the core", (() => {
    const m = C.measurements(stateOf(START));
    const a = appletIncircle(START.A, START.B, START.C);
    return closePoint(a.c, m.triangles[0].data.incircle.c, 1e-8) &&
      close(a.r, m.triangles[0].data.incircle.r, 1e-8);
  })());
}

done("feuerbach-treasure");
