#!/usr/bin/env node
"use strict";

/*
 * Logic test for bui-quang-tuan/bui-quang-tuan-core.js.
 *
 *   node porting/check-bui-quang-tuan.mjs
 *
 * Checks the page's claims — C7 = C1, the six tangency points concyclic about
 * the incenter, and the parahexagon of circle centres — on the applet's
 * starting diagram and on 300 generated triangles, plus all four handle
 * moves. The second half is an independent, literal transcription of the
 * applet's bytecode (GeoSDoub.FindCircumcenter / FindAngleBisector /
 * NearestPoint / Intersect / Dist, DoubLine.CreateMidPoint / UpdateMidPoint,
 * BuiQuangTuanCanvas.GetFirstCircle / GetNextFirstCircle / ShowCircles) and
 * compares it with the core on every configuration.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bui-quang-tuan/bui-quang-tuan-core.js", "BuiQuangTuanCore");

const plus = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const minus = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const times = (p, k) => ({ x: p.x * k, y: p.y * k });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const sq = (p, q) => dot(minus(p, q), minus(p, q));
const length = (p, q) => Math.sqrt(sq(p, q));
const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q &&
  (Number.isNaN(p.x) ? Number.isNaN(q.x) : close(p.x, q.x, tol)) &&
  (Number.isNaN(p.y) ? Number.isNaN(q.y) : close(p.y, q.y, tol));

/* -------------- the applet's own methods, transcribed straight from bytecode */

/* GeoSDoub.Intersect: |a1*b2 - a2*b1| < 1 gives NaN, as in the applet. */
function jIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.NearestPoint(P,A,B), with its sqDist(P,A) < 0.1 shortcut. */
function jNearest(P, A, B) {
  if (sq(P, A) < 0.1) return { x: P.x, y: P.y };
  const dx = B.x - A.x, dy = B.y - A.y;
  const t = (dx * (P.x - A.x) + dy * (P.y - A.y)) / (dx * dx + dy * dy);
  return { x: A.x + dx * t, y: A.y + dy * t };
}

/* GeoSDoub.Dist(P,line AB): length of P to the perpendicular foot. */
function jDistLine(P, A, B) {
  if (sq(A, P) < 0.1) return 0;
  const dx = B.x - A.x, dy = B.y - A.y;
  const t = (dx * (P.x - A.x) + dy * (P.y - A.y)) / (dx * dx + dy * dy);
  return Math.hypot(A.x - P.x + dx * t, A.y - P.y + dy * t);
}

/* GeoSDoub.ComputeAngle(A,B,C): the angle at A. */
function jAngle(A, B, Cc) {
  const numerator = (sq(A, B) + sq(A, Cc) - sq(B, Cc)) / 2;
  return Math.acos(numerator / (length(A, B) * length(A, Cc)));
}

/* GeoSDoub.FindOrientation: dsub order is A.y-B.y and B.x-A.x. */
function jOrientation(A, B, Cc) {
  const d = Cc.x * (A.y - B.y) + Cc.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return d > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate(A,B,angle,orient). */
function jRotate(A, B, angle, orient) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return {
    x: A.x + co * (B.x - A.x) - orient * si * (B.y - A.y),
    y: A.y + orient * si * (B.x - A.x) + co * (B.y - A.y),
  };
}

/* GeoSDoub.FindAngleBisector(A,B,C). */
function jBisector(A, B, Cc) {
  const half = jAngle(A, B, Cc) / 2;
  const orient = jOrientation(A, B, Cc);
  return jIntersect(A, jRotate(A, B, half, orient), B, Cc);
}

/* GeoSDoub.FindCircumcenter: perpendicular bisectors through two midpoints. */
function jCircumcenter(A, B, Cc) {
  const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const N = { x: (B.x + Cc.x) / 2, y: (B.y + Cc.y) / 2 };
  return jIntersect(M, { x: M.x + (B.y - A.y), y: M.y + (A.x - B.x) },
                    N, { x: N.x + (Cc.y - B.y), y: N.y + (B.x - Cc.x) });
}

/* BuiQuangTuanCanvas.GetFirstCircle: circumcentre plus mean radius. */
function jCircleThrough(A, B, Cc) {
  const centre = jCircumcenter(A, B, Cc);
  return { c: centre, r: (length(centre, A) + length(centre, B) + length(centre, Cc)) / 3 };
}

/* DoubLine.CreateMidPoint(t): A*t + B*(1-t). */
function jPointOnLine(A, B, t) {
  return { x: A.x * t + B.x * (1 - t), y: A.y * t + B.y * (1 - t) };
}

/* DoubLine.UpdateMidPoint(P): the unrestricted projection parameter. */
function jParameter(A, B, P) {
  const d2 = (A.x - B.x) ** 2 + (A.y - B.y) ** 2;
  return -((A.x - B.x) * (B.x - P.x) + (A.y - B.y) * (B.y - P.y)) / d2;
}

/* ShowCircles / GetNextFirstCircle, with k reduced mod 3 inside the call. */
function jChain(A1, A2, A3, P) {
  const V = [A1, A2, A3];
  const lines = [[V[0], V[1]], [V[1], V[2]], [V[2], V[0]]];
  let previous = { c: P, r: jDistLine(P, V[0], V[1]) };
  const tangency = [], drawn = [];
  let seventh = null;
  for (let k = 0; k < 6; k++) {
    const side = k % 3, n = (side + 1) % 3, m = (side + 2) % 3;
    const t = jNearest(previous.c, lines[side][0], lines[side][1]);
    tangency.push(t);
    const bis = jBisector(V[n], V[side], V[m]);
    const centre = jIntersect(t, previous.c, V[n], bis);
    const next = { c: centre, r: length(centre, t) };
    if (k < 5) { drawn.push(next); previous = next; }
    else seventh = next;
  }
  return {
    first: { c: P, r: jDistLine(P, V[0], V[1]) },
    drawn, seventh, tangency,
    big: jCircleThrough(tangency[0], tangency[2], tangency[3]),
  };
}

/* A second, unrelated way to find the incenter: equal distance to each side. */
function incenterByAngles(A, B, Cc) {
  const f = (X, Y, Z) => {
    const u = minus(Y, X), v = minus(Z, X);
    const t = jParameter(X, Y, Z);
    return jPointOnLine(X, Y, Math.max(0, Math.min(1, t)));
  };
  const foot1 = f(A, B, Cc), foot2 = f(B, Cc, A);
  const bis1 = jBisector(A, Cc, B), bis2 = jBisector(B, A, Cc);
  return jIntersect(A, bis1, B, bis2) ||
    { x: (foot1.x + foot2.x) / 2, y: (foot1.y + foot2.y) / 2 };
}

/* ---------------------------------------------------- 1. the starting diagram */

{
  const s = C.start();
  equal("start A1 matches Reset on Java int division", s.A1, { x: 300, y: 100 });
  equal("start A2 matches Reset on Java int division", s.A2, { x: 200, y: 314 });
  equal("start A3 matches Reset on Java int division", s.A3, { x: 500, y: 251 });
  equal("start m_Ta is the applet's 0.7", s.ta, 0.7);
  check("start P is CreateMidPoint(0.7) on the A1 bisector",
    closePoint(s.P, jPointOnLine(s.A1, jBisector(s.A1, s.A3, s.A2), 0.7), 1e-9),
    JSON.stringify(s.P));
  check("start first circle radius is Dist(P, side A1A2)",
    close(C.circles(s).first.r, jDistLine(s.P, s.A1, s.A2), 1e-9));
  check("an illustration has no result", C.result(s) === null);
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A1", { x: 10, y: 20 });
    return s.A1.x === 300 && next.A1.x === 10 && !closePoint(s.P, next.P, 1e-9);
  })());
  check("an unknown handle leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
  check("withPoint never returns a shared mutable point", (() => {
    const next = C.withPoint(s, "P", { x: 320, y: 160 });
    next.A1.x = 999;
    return s.A1.x === 300;
  })());
}

/* --------------------------------- 2. the page's claims on the starting picture */

{
  const s = C.start();
  const cl = C.claims(s);
  check("start: C7 = C1, centre and radius", cl.closes, JSON.stringify(cl));
  check("start: C7 touches A1A2 at the same T12", cl.tangencyCloses);
  check("start: the six tangency points are concyclic", cl.concyclic);
  check("start: their circle is centred at the incenter", cl.centreIsIncenter);
  check("start: the six circle centres form a parahexagon", cl.parahexagon);
  check("all page claims pass on the starting diagram",
    Object.values(cl).every(Boolean), JSON.stringify(cl));

  const m = C.circles(s);
  const I = C.incenter(s);
  const h = (P, A, B) => jDistLine(P, A, B);
  check("the incenter is equally far from all three sides",
    Math.max(h(I, s.A1, s.A2), h(I, s.A2, s.A3), h(I, s.A3, s.A1)) -
    Math.min(h(I, s.A1, s.A2), h(I, s.A2, s.A3), h(I, s.A3, s.A1)) < 1e-7);
  check("the incenter also comes from two independent bisectors",
    closePoint(I, incenterByAngles(s.A1, s.A2, s.A3), 1e-6), JSON.stringify(incenterByAngles(s.A1, s.A2, s.A3)));
  check("the applet draws five new circles plus the first one", m.drawn.length === 5);
  check("every drawn radius is positive and finite",
    [m.first, ...m.drawn].every((o) => Number.isFinite(o.r) && o.r > 0));
  check("the applet records six tangency points", m.tangency.length === 6);
}

/* ----------------------------------- 3. hundreds of triangles, four handle moves */

{
  const rand = rng(62419587);
  let valid = 0, compared = 0, moves = 0, degenerate = 0;
  for (let trial = 0; trial < 300; trial++) {
    const A1 = { x: 40 + rand() * 520, y: 40 + rand() * 360 };
    const ang = rand() * Math.PI * 2;
    const len = 160 + rand() * 240;
    const A2 = { x: A1.x + len * Math.cos(ang), y: A1.y + len * Math.sin(ang) };
    const ang2 = ang + 0.35 + rand() * (Math.PI - 0.7);
    const A3 = { x: A1.x + len * (0.5 + rand() * 0.6) * Math.cos(ang2),
                 y: A1.y + len * (0.5 + rand() * 0.6) * Math.sin(ang2) };
    const ta = -0.2 + rand() * 1.4; // m_Ta is unrestricted (RestrictToSegment(false))
    const s = C.start({ A1, A2, A3, ta });
    const cl = C.claims(s);
    if (!cl) { degenerate++; continue; }
    valid++;
    const scale = Math.max(1, length(A1, A2), length(A1, A3), length(A2, A3));
    const tol = 1e-6 * scale;

    check(`trial ${trial}: all four page claims hold`, Object.values(cl).every(Boolean),
      JSON.stringify(cl));

    const want = jChain(A1, A2, A3, jPointOnLine(A1, jBisector(A1, A3, A2), ta));
    const got = C.circles(s);
    let agrees = closePoint(got.first.c, want.first.c, tol) &&
                 close(got.first.r, want.first.r, tol) &&
                 closePoint(got.big.c, want.big.c, tol) &&
                 close(got.big.r, want.big.r, tol) &&
                 closePoint(got.seventh.c, want.seventh.c, tol) &&
                 close(got.seventh.r, want.seventh.r, tol);
    for (let i = 0; i < 5; i++) {
      agrees = agrees && closePoint(got.drawn[i].c, want.drawn[i].c, tol) &&
                         close(got.drawn[i].r, want.drawn[i].r, tol);
    }
    for (let i = 0; i < 6; i++) agrees = agrees && closePoint(got.tangency[i], want.tangency[i], tol);
    check(`trial ${trial}: circle chain matches the applet's own computation`, agrees,
      JSON.stringify({ got, want }));
    compared++;

    /* Each handle move: rebuild P with CreateMidPoint, or recover m_Ta with
       UpdateMidPoint, exactly as the applet's mouseDragged does. */
    const P = { x: s.P.x + 17 - rand() * 34, y: s.P.y + 19 - rand() * 38 };
    const cases = [
      ["A1", P, () => jPointOnLine(P, jBisector(P, s.A3, s.A2), ta)],
      ["A2", P, () => jPointOnLine(s.A1, jBisector(s.A1, s.A3, P), ta)],
      ["A3", P, () => jPointOnLine(s.A1, jBisector(s.A1, P, s.A2), ta)],
      ["P", P, () => jPointOnLine(s.A1, jBisector(s.A1, s.A3, s.A2),
                                  jParameter(s.A1, jBisector(s.A1, s.A3, s.A2), P))],
    ];
    for (const [name, p, expected] of cases) {
      const next = C.withPoint(s, name, p);
      const ok = closePoint(next.P, expected(), 1e-5 * scale) &&
                 (name === "P" ? close(next.ta, jParameter(s.A1, jBisector(s.A1, s.A3, s.A2), P), 1e-9)
                               : close(next.ta, ta, 1e-12));
      if (!ok) {
        check(`trial ${trial}: ${name} drag matches CreateBisector/UpdateMidPoint`, false,
          JSON.stringify({ next, want: expected() }));
      }
      moves++;
    }
  }
  check(`all page claims pass on ${valid} generated triangles`, valid >= 250,
    `${valid} valid, ${degenerate} degenerate`);
  check(`the core agrees with the applet on ${compared} full circle chains`, compared >= 250);
  check(`${moves} handle moves match the applet's rebuilds`, moves >= 1000);
}

/* ------------------------------- 4. extremes, and unsafe input stays honest */

{
  const s = C.start();
  const far = C.withPoint(s, "P", { x: 100, y: 100 });
  check("dragging P outside the bisector segment keeps m_Ta outside [0,1]",
    far.ta < 0 || far.ta > 1, `ta ${far.ta}`);
  const cl = C.claims(far);
  check("the theorem still holds with P outside the triangle",
    cl && Object.values(cl).every(Boolean), JSON.stringify(cl));

  const flat = C.start({ A1: { x: 0, y: 0 }, A2: { x: 200, y: 0 }, A3: { x: 400, y: 0 } });
  check("a collinear triangle is reported invalid", C.claims(flat) === null);

  const par = { x: 0, y: 0 }, q = { x: 100, y: 0 };
  const r = { x: 0, y: 10 }, t = { x: 100, y: 10 };
  check("parallel lines give NaN from the core's Intersect", Number.isNaN(C.intersect(par, q, r, t).x));
  check("the applet's Intersect agrees on those parallel lines", Number.isNaN(jIntersect(par, q, r, t).x));
  check("a first circle at a vertex has radius 0, as in GeoSDoub.Dist",
    C.distToLine(par, par, q) === 0 && jDistLine(par, par, q) === 0);
  check("pointOnLine puts t=1 at A and t=0 at B", (() => {
    const A = { x: 3, y: 7 }, B = { x: 40, y: -2 };
    return closePoint(C.pointOnLine(A, B, 1), A, 1e-12) &&
           closePoint(C.pointOnLine(A, B, 0), B, 1e-12);
  })());
}

done("bui-quang-tuan");
