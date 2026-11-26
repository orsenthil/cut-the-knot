#!/usr/bin/env node
"use strict";

/*
 * Logic test for besteman-2/besteman-2-core.js.
 *
 *   node porting/check-besteman-2.mjs
 *
 * Checked: the starting diagram against Besteman2Canvas.init at the applet's
 * optimal 400x250 size; every N in the applet's 2..20 range; 80 random
 * configurations (both directions along AC, large and tiny segments), plus
 * edge cases. Each configuration is checked against a second, literal
 * transcription of the applet's own bytecode: DrawConstruction's loop for C,
 * GeoSDoub.Intersect(DoubCircle, DoubCircle)[1] for D, and
 * GeoSDoub.FindAngleBisector (law of cosines, orientation, rotate, intersect
 * two lines) for P. The page's claims are checked on every one of those
 * diagrams: AP/PC = AD/CD, the second Besteman theorem AP = AC/(m+1) when
 * CD = m·AD (here m = N-1, so AP = AC/N), the equal division dots and the two
 * equal half-angles at D. The first Besteman construction's different formula
 * AP = AB/N from AC = N·AB/2 is checked separately, to show how it differs.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("besteman-2/besteman-2-core.js", "Besteman2Core");
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol = 1e-7) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);

/* ------------------ the applet's own computation, transcribed from bytecode */

/** GeoSDoub.SqDist / ComputeAngle: law of cosines at the first point. */
function sqDist(p, q) { return (p.x - q.x) ** 2 + (p.y - q.y) ** 2; }
function appletAngle(P, Q, R) {
  const numerator = sqDist(P, Q) + sqDist(P, R) - sqDist(Q, R);
  return Math.acos(numerator / (2 * Math.sqrt(sqDist(P, Q) * sqDist(P, R))));
}

/** GeoSDoub.FindOrientation: sign of the cross product, +1 when positive. */
function appletOrientation(A, B, D) {
  const s = D.x * (A.y - B.y) + D.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/** GeoSDoub.Rotate: rotate Q about P by angle, mirrored by orientation. */
function appletRotate(P, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/** GeoSDoub.Intersect(P1,P2,P3,P4): line intersection in ax+by+c=0 form. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.FindAngleBisector(P,Q,R), used as FindAngleBisector(D,A,C). */
function appletBisectorFoot(P, Q, R) {
  const half = appletAngle(P, Q, R) / 2;
  const orient = appletOrientation(P, Q, R);
  const ray = appletRotate(P, Q, half, orient);
  return appletIntersect(P, ray, Q, R);
}

/** GeoSDoub.IntersectCirclesX, the branch the applet takes (A.y === C.y). */
function intersectCirclesX(c1, c2) {
  const m = -(c1.center.y - c2.center.y) / (c1.center.x - c2.center.x);
  const b = (c1.center.x ** 2 + c1.center.y ** 2 - c2.center.x ** 2 - c2.center.y ** 2
             - c1.radius ** 2 + c2.radius ** 2) / (2 * (c1.center.x - c2.center.x));
  const dx = b - c1.center.x;
  const a = 1 + m * m;
  const bb = m * dx - c1.center.y;
  const cc = dx * dx + c1.center.y ** 2 - c1.radius ** 2;
  const disc = bb * bb - a * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const s0 = (-bb + root) / a, s1 = (-bb - root) / a;
  return [{ x: m * s0 + b, y: s0 }, { x: m * s1 + b, y: s1 }];
}

/** GeoSDoub.Intersect(DoubCircle,DoubCircle) dispatcher, for completeness. */
function intersectCircles(c1, c2) {
  if (Math.abs(c1.center.x - c2.center.x) > 1) return intersectCirclesX(c1, c2);
  if (Math.abs(c1.center.y - c2.center.y) > 1) {
    // Same bytecode with x and y exchanged: solve for x on the radical line.
    const m = -(c1.center.x - c2.center.x) / (c1.center.y - c2.center.y);
    const b = (c1.center.y ** 2 + c1.center.x ** 2 - c2.center.y ** 2 - c2.center.x ** 2
               - c1.radius ** 2 + c2.radius ** 2) / (2 * (c1.center.y - c2.center.y));
    const dy = b - c1.center.y;
    const a = 1 + m * m;
    const bb = m * dy - c1.center.x;
    const cc = dy * dy + c1.center.x ** 2 - c1.radius ** 2;
    const disc = bb * bb - a * cc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const s0 = (-bb + root) / a, s1 = (-bb - root) / a;
    return [{ x: s0, y: m * s0 + b }, { x: s1, y: m * s1 + b }];
  }
  return [{ ...c1.center }, { ...c1.center }];
}

/** Besteman2Canvas.DrawConstruction, line for line. */
function appletConstruction(s) {
  const A = s.A, B = s.B, N = s.N;
  let Cc = null;
  for (let i = 0; i < N - 1; i++) {
    Cc = { x: A.x + (B.x - A.x) * (i + 1), y: A.y };
  }
  const d = dist(A, B);
  const points = intersectCircles({ center: A, radius: d },
                                  { center: Cc, radius: d * (N - 1) });
  if (!points) return null;
  const D = points[1]; // the applet always picks the second intersection
  const P = appletBisectorFoot(D, A, Cc);
  const marks = [];
  for (let k = 0; k < N; k++) marks.push({ x: A.x + (P.x - A.x) * k, y: A.y });
  return { C: Cc, D, P, marks };
}

/* ---------------------------------------------- 1. the start and the options */

{
  const s = C.start();
  equal("start A matches init on a 400x250 canvas", s.A, { x: 100, y: 115 });
  equal("start B matches init (A.x + step)", s.B, { x: 150, y: 115 });
  check("the applet's default N is 3", s.N === 3);
  check("the applet starts with names shown and no hint", s.showNames && !s.showHint);
  check("a demo never has a result", C.result(s) === null);
  check("N below the slider range clamps to 2", C.setN(s, -4).N === 2);
  check("N above the slider range clamps to 20", C.setN(s, 99).N === 20);
  check("a fractional N is truncated like PVNumeric.getLong", C.setN(s, 7.9).N === 7);
  check("withPoint does not change the old position", (() => {
    const t = C.withPoint(s, "A", { x: 60, y: 90 });
    return s.A.x === 100 && s.B.y === 115 && t.B.y === 90 && t.B.x === 150;
  })());
  check("dragging B vertically lifts A with it, as mouseDragged does", (() => {
    const t = C.withPoint(s, "B", { x: 130, y: 60 });
    return t.A.y === 60 && t.B.y === 60 && t.A.x === 100 && t.B.x === 130;
  })());
}

/* ---------------------------------- 2. every N, many random configurations */

{
  const rand = rng(20261126);
  const configs = [];
  const base = C.start();
  for (let N = C.MIN_N; N <= C.MAX_N; N++) {
    configs.push({ ...base, N });                                     // the default diagram
    configs.push({ ...base, N, B: { x: 60, y: 115 }, A: { x: 150, y: 115 } }); // B left of A
    configs.push({ ...base, N, A: { x: 20, y: 10 }, B: { x: 35, y: 10 } });    // tiny segment
  }
  for (let i = 0; i < 80; i++) {
    const N = 2 + Math.floor(rand() * 19);
    const ax = 20 + rand() * 160, ay = 20 + rand() * 190;
    const len = 1 + rand() * 90;
    const dir = rand() < 0.5 ? -1 : 1;
    configs.push(C.start({ width: 400, height: 250, N,
      A: { x: ax, y: ay }, B: { x: ax + dir * len, y: ay } }));
  }

  let dots = 0, ratios = 0, pageSecond = 0, halfAngles = 0, matches = 0, distinct = 0;
  for (const s of configs) {
    const c = C.construction(s);
    if (!c) throw new Error("a configuration unexpectedly collapsed");
    const a = appletConstruction(s);
    if (!a) throw new Error(`the applet's circles failed to intersect for N=${s.N}`);

    // C from the DrawConstruction loop, D from Intersect(...)[1], P from the
    // rotate-and-intersect bisector, and every division dot — all must agree.
    if (closePoint(c.C, a.C) && closePoint(c.D, a.D) && closePoint(c.P, a.P) &&
        c.marks.every((q, k) => closePoint(q, a.marks[k]))) matches++;

    // k = 0..N-1: the last drawn dot is one step before the endpoint C.
    dots += c.marks.length === s.N && close(dist(c.marks[s.N - 1], c.C), c.step, 1e-9 * Math.max(1, c.AC));
    ratios += close(c.ratioAP_PC, c.ratioAD_CD, 1e-12);
    pageSecond += close(c.AP, C.secondClaim(s.N - 1, c.AC), 1e-9 * Math.max(1, c.AC));
    halfAngles += close(c.halfA, c.halfC, 1e-9);
    distinct += c.marks.slice(1).every((q, i) => close(dist(q, c.marks[i]), c.step, 1e-9));
    const cl = C.claims(s);
    if (!(cl.nonDegenerate && cl.bisectorRatio && cl.pageSecond &&
          cl.equalParts && cl.equalAngles && cl.firstContrast)) {
      throw new Error(`claims failed for N=${s.N}, A=${JSON.stringify(s.A)}, B=${JSON.stringify(s.B)}`);
    }
  }
  check(`all ${configs.length} diagrams match the bytecode transcription`, matches === configs.length);
  check("DrawConstruction's C, D, P and all dots match for every N in 2..20", matches >= 3 * 19);
  check("the last of the N dots always lands on C", dots === configs.length);
  check("AP/PC = AD/CD on every diagram (page claim 1)", ratios === configs.length);
  check("the second theorem AP = AC/(m+1) with m = N-1 holds everywhere", pageSecond === configs.length);
  check("the two angles at D are always equal", halfAngles === configs.length);
  check("the N dots are equally spaced on every diagram", distinct === configs.length);
}

/* ------------------- 3. the theorem itself, beyond the constructed circles */

{
  // The angle-bisector theorem is true for any triangle, not only the one
  // the applet draws. Put D anywhere off the line and let the applet's own
  //-bisector routine find P; compare AP/PC with AD/CD.
  const rand = rng(77);
  let ok = 0, generic = 0;
  for (let i = 0; i < 300; i++) {
    const A = { x: rand() * 300, y: 100 }, Z = { x: A.x + 20 + rand() * 180, y: 100 };
    const D = { x: A.x + rand() * 200 - 50, y: 20 + rand() * 150 };
    if (Math.abs(D.y - 100) < 5) continue;
    const P = appletBisectorFoot(D, A, Z);
    if (close(dist(A, P) / dist(P, Z), dist(D, A) / dist(D, Z), 1e-9)) generic++;

    // Now a genuine triangle ACD with CD = m·AD: AC = m·d, and D is the
    // lower intersection of circles of radii d (at A) and m·d (at C). Rotate
    // the whole picture so the theorem is tested in arbitrary directions.
    const m = 1 + Math.floor(rand() * 20), d = 20 + rand() * 60;
    const angle = rand() * Math.PI * 2;
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const along = d / (2 * m), off = Math.sqrt(d * d - along * along);
    const Cc = { x: A.x + ux * m * d, y: A.y + uy * m * d };
    const Dd = { x: A.x + ux * along + uy * off, y: A.y + uy * along - ux * off };
    const Pp = appletBisectorFoot(Dd, A, Cc);
    if (close(dist(Dd, Cc), m * dist(Dd, A), 1e-8) &&
        close(dist(A, Pp) / dist(Pp, Cc), 1 / m, 1e-8) &&
        close(dist(A, Pp), C.secondClaim(m, dist(A, Cc)), 1e-8 * Math.max(1, d))) ok++;
  }
  check(`AP/PC = AD/CD on ${generic} arbitrary triangles`, generic >= 250);
  check(`the page's m·AD claim tested on ${ok} rotated triangles`, ok >= 250);

  // First Besteman page: AP = AB²/(2AC), then AP = AB/N when AC = N·AB/2.
  let first = 0;
  for (let N = 2; N <= 20; N++) {
    for (let ab = 10; ab <= 90; ab += 10) {
      const ac = N * ab / 2;
      first += close(ab * ab / (2 * ac), C.firstClaim(N, ab), 1e-12);
    }
  }
  check("first construction AP = AB/N from AC = N·AB/2 (19 x 9 cases)", first === 19 * 9);
  let different = 0;
  for (let N = 3; N <= 20; N++) {
    const ac = (N - 1) * 50;
    if (!close(C.secondClaim(N - 1, ac), C.firstClaim(N, 50))) different++;
  }
  check("for N >= 3 the two constructions give different parts", different === 18);
}

/* --------------------------------------- 4. collapses and unchangeable input */

{
  const s = C.start();
  const flat = C.withPoint(s, "B", { x: s.A.x, y: s.A.y });
  check("coincident A and B give no construction", C.construction(flat) === null);
  const cl = C.claims(flat);
  check("a collapsed diagram fails every claim", !cl.nonDegenerate && !cl.pageSecond && !cl.equalParts);
  check("construction does not mutate its state", (() => {
    const t = C.start({ N: 6 });
    const before = JSON.stringify(t);
    C.construction(t); C.claims(t);
    return JSON.stringify(t) === before;
  })());
}

done("besteman-2");
