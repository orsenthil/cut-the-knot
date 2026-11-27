#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-on-perp-bisector/circles-on-perp-bisector-core.js.
 *
 *   node porting/check-circles-on-perp-bisector.mjs
 *
 * The first sections check the drags, the display options and the geometry the
 * page describes, on the opening picture and on seeded random ones: O is
 * equidistant from B and C; (I) is tangent to AB, AC and internally to (O);
 * (P) is tangent to AB and AC and externally to (O) when O is on the far side
 * of BC from A; S and T lie on (O) along the two centres' directions; the
 * line ST is not a common internal tangent; and the chord cut off by AB and AC
 * on any circle through B and C is antiparallel to BC.
 *
 * The middle sections transcribe the applet's own OneOnBisector and
 * Tangents.GetInternalTangents (including Inversion.Tangent and
 * GeoSDoub.IntersectCirclesX/Y) a second time, straight from javap -c, and
 * compare them with the core over hundreds of drawable configurations.
 *
 * The last sections check Unger's claim as the page states it. With (I) set
 * to the incircle, a circle (O) through B and C tangent to (I) internally and
 * (P) externally exists if and only if one internal tangent of (I) and (P) is
 * parallel to BC; the other one is then antiparallel to it. Both directions
 * are checked over a fine sweep of (P) around the exactly drawable position.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circles-on-perp-bisector/circles-on-perp-bisector-core.js", "CirclesOnPerpBisectorCore");
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const clamp01 = (v) => Math.max(-1, Math.min(1, v));

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  check("a new picture is not finished", C.result(s) === null);
  check("the four applet points are draggable",
    JSON.stringify(C.legalMoves()) === JSON.stringify(["A", "B", "C", "O"]));
  check("the opening O is on the perpendicular bisector of BC",
    Math.abs(d(s.O, s.B) - d(s.O, s.C)) < 1e-9);
  const moved = C.move(s, { name: "A", x: 50, y: 50 });
  check("dragging A keeps the other points and counts a move",
    moved.A.x === 50 && moved.A.y === 50 && moved.moves === 1
      && moved.B.x === s.B.x && moved.C.y === s.C.y);
  check("a drag outside the board is clamped",
    C.move(s, { name: "B", x: -50, y: 999 }).B.x === 4);
  check("an unknown point or a non-finite coordinate is refused",
    C.move(s, { name: "X", x: 1, y: 1 }) === null
      && C.move(s, { name: "A", x: NaN, y: 1 }) === null);
  const slid = C.slideO(s, 7);
  check("sliding O keeps it on the perpendicular bisector",
    Math.abs(d(slid.O, s.B) - d(slid.O, s.C)) < 1e-9 && slid.moves === 1);
  const shown = C.setOptions(C.setOptions(s, { showNames: false }), { showHint: true });
  check("display options are recorded", !shown.showNames && shown.showHint && shown.toggles === 2);
  check("the demo finishes only after it has been explored",
    C.result(s) === null && C.result(shown) === null
      && C.result(C.setOptions(moved, { showHint: true })) === "done");
  const reset = C.reset(C.setOptions(moved, { showHint: true }));
  check("Reset restores the opening points but keeps the options and the counters",
    d(reset.A, C.DEFAULT.A) < 1e-9 && reset.showHint && reset.moves === 1 && reset.toggles === 1);
  check("nudging A moves it by the arrow-key step",
    d(C.nudge(s, "A", 3, -4).A, { x: s.A.x + 3, y: s.A.y - 4 }) < 1e-9);
}

/* --------------------------- 2. the applet's own method, transcribed twice */

/** GeoSDoub.ComputeAngle(A,B,C), independently written from the bytecode. */
function appletAngle(A, B, C) {
  const ab = d(A, B), ac = d(A, C), bc = d(B, C);
  return Math.acos(clamp01((ab * ab + ac * ac - bc * bc) / (2 * ab * ac)));
}
function appletOrientation(A, B, C) {
  const v = C.x * (A.y - B.y) + C.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return v > 0 ? 1 : -1;
}
function appletRotate(about, p, a, dir) {
  const co = Math.cos(a), si = Math.sin(a);
  const x = p.x - about.x, y = p.y - about.y;
  return {
    x: about.x + co * x - dir * si * y,
    y: about.y + dir * si * x + co * y,
  };
}
function appletIntersect(a, b, c, e) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - e.y, b2 = e.x - c.x, c2 = c.x * e.y - c.y * e.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}
function appletNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const q = dx * dx + dy * dy;
  if (q < 0.1) return { x: p.x, y: p.y };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / q;
  return { x: a.x + dx * t, y: a.y + dy * t };
}
function appletProrate(A, B, t) {
  const dd = d(A, B);
  if (dd < 0.1) return { x: A.x, y: A.y };
  return { x: A.x + t * (B.x - A.x) / dd, y: A.y + t * (B.y - A.y) / dd };
}
/** QuadraticEquation.Solve2(a,b,c): roots of a*t*t + 2*b*t + c = 0. */
function appletSolve2(a, b, c) {
  if (Math.abs(a) < 0.01) return null;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [(-b + s) / a, (-b - s) / a];
}
/** Canvas.OneOnBisector(sign), line by line from javap -c. */
function appletOne(A, B, C, O, R, W, sign) {
  const ux = A.x - W.x, uy = A.y - W.y;
  const px = A.x - O.x, py = A.y - O.y;
  const half = appletAngle(A, B, C) / 2;
  const u2 = ux * ux + uy * uy;
  const a = u2 * Math.cos(half) * Math.cos(half);
  const b = ux * px + uy * py - sign * R * Math.sqrt(u2) * Math.sin(half);
  const c = px * px + py * py - R * R;
  const roots = appletSolve2(a, b, c);
  if (!roots) return null;
  const t = Math.abs(roots[0]) >= Math.abs(roots[1]) ? roots[1] : roots[0];
  const q = { x: A.x + t * ux, y: A.y + t * uy };
  const r = (d(q, appletNearest(q, A, B)) + d(q, appletNearest(q, A, C))) / 2;
  return { x: q.x, y: q.y, r };
}
/** GeoSDoub.IntersectCirclesX, from javap -c. */
function appletCirclesX(c1, r1, c2, r2) {
  const m = -(c1.y - c2.y) / (c1.x - c2.x);
  const b = (c1.x ** 2 - c2.x ** 2 + c1.y ** 2 - c2.y ** 2 - r1 ** 2 + r2 ** 2)
    / (2 * (c1.x - c2.x));
  const a = b - c1.x;
  const aa = m * m + 1;
  const bb = 2 * (m * a - c1.y);
  const cc = c1.y ** 2 + a * a - r1 * r1;
  const disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const y1 = (-bb + s) / (2 * aa), y2 = (-bb - s) / (2 * aa);
  return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
}
/** GeoSDoub.IntersectCirclesY, from javap -c. */
function appletCirclesY(c1, r1, c2, r2) {
  const m = -(c1.x - c2.x) / (c1.y - c2.y);
  const b = (c1.y ** 2 - c2.y ** 2 + c1.x ** 2 - c2.x ** 2 - r1 ** 2 + r2 ** 2)
    / (2 * (c1.y - c2.y));
  const a = b - c1.y;
  const aa = m * m + 1;
  const bb = 2 * (m * a - c1.x);
  const cc = c1.x ** 2 + a * a - r1 * r1;
  const disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const x1 = (-bb + s) / (2 * aa), x2 = (-bb - s) / (2 * aa);
  return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
}
function appletCircleCircle(c1, r1, c2, r2) {
  if (Math.abs(c1.x - c2.x) > 1) return appletCirclesX(c1, r1, c2, r2);
  if (Math.abs(c1.y - c2.y) > 1) return appletCirclesY(c1, r1, c2, r2);
  return [{ x: c1.x, y: c1.y }, { x: c1.x, y: c1.y }];
}
/** Inversion.Tangent(big circle, outside point), from javap -c. */
function appletTangentFrom(big, p) {
  const sq = d(big, p) ** 2 - big.r ** 2;
  if (sq < 0) return null;
  const reach = Math.sqrt(sq);
  const pts = appletCircleCircle(big, big.r, p, reach);
  if (!pts) return null;
  return pts.map((q) => ({ a: p, b: q }));
}
/** Tangents.GetInternalTangents(c1,c2), from javap -c. */
function appletInternalTangents(c1, c2) {
  const r1 = c1.r, r2 = c2.r;
  const big = { x: c1.x, y: c1.y, r: r1 + r2 };
  const from = appletTangentFrom(big, c2);
  if (!from) return null;
  return from.map((line) => {
    const p = line.b;
    const on1 = {
      x: c1.x + (p.x - c1.x) * r1 / (r1 + r2),
      y: c1.y + (p.y - c1.y) * r1 / (r1 + r2),
    };
    const on2 = {
      x: c2.x - (p.x - c1.x) * r2 / (r1 + r2),
      y: c2.y - (p.y - c1.y) * r2 / (r1 + r2),
    };
    return { a: on1, b: on2 };
  });
}

/* ----------------------------------- 3. many configurations, checked twice */

const rand = rng(8317);
const sample = [];
for (let i = 0; i < 500; i++) {
  const A = { x: 30 + rand() * 300, y: 20 + rand() * 200 };
  const B = { x: 30 + rand() * 300, y: 20 + rand() * 200 };
  const Cpt = { x: 30 + rand() * 300, y: 20 + rand() * 200 };
  const area = Math.abs((B.x - A.x) * (Cpt.y - A.y) - (Cpt.x - A.x) * (B.y - A.y));
  if (area < 2500 || d(A, B) < 50 || d(B, Cpt) < 50) continue; // degenerate/skinny
  const M = mid(B, Cpt);
  const perp = { x: M.x + (B.y - Cpt.y) * 10, y: M.y - (B.x - Cpt.x) * 10 };
  const len = d(M, perp);
  const t = (rand() - 0.5) * 260;
  const O = { x: M.x + (perp.x - M.x) / len * t, y: M.y + (perp.y - M.y) / len * t };
  sample.push(C.start({ A, B, C: Cpt, O }));
}
sample.unshift(C.start({}));

{
  let maxDist = 0, maxRadius = 0, maxTangency = 0, maxBisector = 0;
  let maxSides = 0, maxRadial = 0, maxChord = 0, maxST = 0, maxTangent = 0;
  let compared = 0, tangentsCompared = 0, external = 0, internal = 0;
  const cross = (a, b) => Math.abs(a.x * b.y - a.y * b.x);
  for (const state of sample) {
    const g = C.geometry(state);
    if (!g.valid) continue;
    compared++;
    const { A, B, C: Cpt, O, I, P, S, T, circle } = g;
    const R = circle.r;
    const W = g.footOnBC;

    // The applet's own construction, transcribed independently above.
    const aI = appletOne(A, B, Cpt, O, R, W, 1);
    const aP = appletOne(A, B, Cpt, O, R, W, -1);
    if (!aI || !aP) continue;
    maxDist = Math.max(maxDist, d(aI, I), d(aP, P));
    maxRadius = Math.max(maxRadius, Math.abs(aI.r - I.r), Math.abs(aP.r - P.r));
    maxRadial = Math.max(maxRadial,
      Math.abs(d(O, S) - R), Math.abs(d(O, T) - R),
      Math.abs(cross(C.sub(S, O), C.sub(I, O))), Math.abs(cross(C.sub(T, O), C.sub(P, O))));

    // Both circles touch AB and AC; their centres lie on the angle bisector.
    maxSides = Math.max(maxSides,
      Math.abs(d(I, C.foot(I, A, B)) - I.r), Math.abs(d(I, C.foot(I, A, Cpt)) - I.r),
      Math.abs(d(P, C.foot(P, A, B)) - P.r), Math.abs(d(P, C.foot(P, A, Cpt)) - P.r),
      Math.abs(cross(C.sub(I, A), C.sub(W, A))), Math.abs(cross(C.sub(P, A), C.sub(W, A))));
    // O is equidistant from B and C. The applet's chosen quadratic root can
    // put either auxiliary circle inside (O) or outside it; in each case the
    // tangency equation for that mode must close exactly.
    maxBisector = Math.max(maxBisector, Math.abs(d(O, B) - R), Math.abs(d(O, Cpt) - R));
    const mode = (circle) => Math.min(
      Math.abs(d(O, circle) + circle.r - R),
      Math.abs(d(O, circle) - circle.r - R),
      Math.abs(R - d(O, circle) - circle.r));
    maxTangency = Math.max(maxTangency, mode(I), mode(P));
    if (Math.abs(d(O, P) - P.r - R) < 1e-6) external++; else internal++;

    // The line of tangencies is not either common internal tangent.
    if (g.tangents.length === 2 && g.stLine) {
      maxST = Math.max(maxST, Math.min(
        cross(g.stLine.dir, g.tangents[0].dir), cross(g.stLine.dir, g.tangents[1].dir)));
    }
    // Every chord cut off on a coaxal circle is antiparallel to BC.
    if (g.chord) maxChord = Math.max(maxChord, cross(g.chord.dir, g.antiparallel));

    // Tangents.GetInternalTangents via inversion, compared with the core.
    const aTang = appletInternalTangents(aI, aP);
    // GeoSDoub.Intersect(circle,circle) returns both points at c1 when two
    // centres are under a pixel apart in both coordinates; skip that quirk.
    const nearCoincident = Math.abs(aI.x - aP.x) <= 1 && Math.abs(aI.y - aP.y) <= 1;
    if (aTang && g.tangents.length === 2 && !nearCoincident) {
      tangentsCompared++;
      const err = Math.min(
        Math.max(d(aTang[0].a, g.tangents[0].a), d(aTang[0].b, g.tangents[0].b),
          d(aTang[1].a, g.tangents[1].a), d(aTang[1].b, g.tangents[1].b)),
        Math.max(d(aTang[1].a, g.tangents[0].a), d(aTang[1].b, g.tangents[0].b),
          d(aTang[0].a, g.tangents[1].a), d(aTang[0].b, g.tangents[1].b)));
      maxTangent = Math.max(maxTangent, err);
    }
  }
  check("every sampled configuration produced both auxiliary circles", compared > 300, `${compared}`);
  check("OneOnBisector's centres match the bytecode transcription", maxDist < 1e-6, `max ${maxDist}`);
  check("OneOnBisector's radii match the bytecode transcription", maxRadius < 1e-6, `max ${maxRadius}`);
  check("S and T are on (O) on the two lines of centres", maxRadial < 1e-6, `max ${maxRadial}`);
  check("both auxiliary circles touch AB and AC and sit on the angle bisector", maxSides < 1e-6, `max ${maxSides}`);
  check("O is the centre of a circle through B and C", maxBisector < 1e-6, `max ${maxBisector}`);
  check("I and P are tangent to (O) in the modes the applet's root selection gives", maxTangency < 1e-5, `max ${maxTangency}`);
  check("both tangency modes occur in the sample", external > 20 && internal > 20, `${external} external, ${internal} other`);
  check("the line ST differs from both common internal tangents", maxST > 1e-3, `min ${maxST}`);
  check("chords cut by AB and AC are antiparallel to BC for every sampled circle", maxChord < 1e-6, `max ${maxChord}`);
  check("GetInternalTangents by inversion matches the core's homothety construction",
    tangentsCompared > 100 && maxTangent < 1e-5, `${tangentsCompared} pairs, max ${maxTangent}`);
}

/* -------------------------------------- 4. Unger's claim, when I=incircle */

/** O(k): the perpendicular bisector of BC, k units from its midpoint. */
function bisectorAt(B, C, k) {
  const M = mid(B, C);
  const vx = M.x + (B.y - C.y) * 10, vy = M.y - (B.x - C.x) * 10;
  const len = Math.hypot(vx - M.x, vy - M.y);
  return { x: M.x + (vx - M.x) / len * k, y: M.y + (vy - M.y) / len * k };
}
/** Incenter and inradius of ABC. */
function incircle(A, B, C) {
  const a = d(B, C), b = d(A, C), c = d(A, B);
  const per = a + b + c;
  const centre = {
    x: (a * A.x + b * B.x + c * C.x) / per,
    y: (a * A.y + b * B.y + c * C.y) / per,
  };
  const area = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2;
  return { ...centre, r: 2 * area / per };
}
/** Roots of |O-I| + rI = |O-B| along the perpendicular bisector. */
function coaxalRoots(A, B, C, inc) {
  const f = (k) => {
    const O = bisectorAt(B, C, k);
    return d(O, inc) + inc.r - d(O, B);
  };
  const roots = [];
  let prev = f(-300);
  for (let k = -299; k <= 300; k++) {
    const cur = f(k);
    if (prev * cur < 0) {
      let lo = k - 1, hi = k;
      for (let it = 0; it < 70; it++) {
        const m = (lo + hi) / 2;
        if (f(lo) * f(m) <= 0) hi = m; else lo = m;
      }
      roots.push((lo + hi) / 2);
    }
    prev = cur;
  }
  return roots;
}

{
  const base = C.start({});
  const { A, B, C: Cpt } = base;
  const inc = incircle(A, B, Cpt);
  const roots = coaxalRoots(A, B, Cpt, inc);
  check("there is a circle through B and C tangent internally to the incircle", roots.length >= 1, `${roots.length}`);
  const O = bisectorAt(B, Cpt, roots[0]);
  const g = C.geometry(C.start({ O }));
  check("the found O makes the constructed I the incircle",
    d(g.I, inc) < 1e-6 && Math.abs(g.I.r - inc.r) < 1e-6,
    `${d(g.I, inc)}, ${Math.abs(g.I.r - inc.r)}`);
  check("with I the incircle one internal tangent is parallel to BC",
    g.tangents.length === 2 && g.tangentParallel);
  check("the other internal tangent is antiparallel to BC", g.tangentAntiparallel);
  check("the incircle configuration has P tangent externally to (O)",
    Math.abs(d(O, g.P) - g.P.r - g.circle.r) < 1e-6,
    `gap ${Math.abs(d(O, g.P) - g.P.r - g.circle.r)}`);

  // Unger's iff: keep I fixed at the incircle and slide P along the bisector.
  const W = g.footOnBC;
  const u = C.unit(C.sub(W, A)); // from A towards BC
  const exact = d(g.P, A);       // the unique P for which the circle exists
  let agree = 0, total = 0, parallelCases = 0, existsCases = 0;
  let worst = 0;
  for (let i = -28; i <= 28; i++) {
    const s = exact + i * 0.04;
    const P = {
      x: A.x + u.x * s,
      y: A.y + u.y * s,
      r: s * Math.sin(g.half),
    };
    if (!(P.r > 0)) continue;
    const tang = C.internalTangents(inc, P);
    if (tang.length !== 2) continue;
    const parallel = Math.min(...tang.map((line) => C.parallelCross(line, C.sub(Cpt, B)))) < 1e-6;
    const solutions = coaxalRoots(A, B, Cpt, inc).map((k) => {
      const Op = bisectorAt(B, Cpt, k);
      return Math.abs(d(Op, P) - P.r - d(Op, B));
    });
    const exists = solutions.some((err) => err < 1e-5);
    worst = Math.max(worst, Math.min(...solutions));
    total++;
    if (parallel) parallelCases++;
    if (exists) existsCases++;
    if (parallel === exists) agree++;
  }
  check("the iff was checked over a fine sweep of P", total >= 50, `${total}`);
  check("the parallel case and the existing-circle case occur in the sweep",
    parallelCases >= 1 && existsCases >= 1, `${parallelCases} parallel, ${existsCases} circles`);
  check("Unger's iff holds on every sampled P", agree === total, `${agree}/${total}`);

  // The I used in the sweep was the incircle: a second, independent root check.
  const exactP = g.P;
  const exactSolutions = coaxalRoots(A, B, Cpt, inc).map((k) => {
    const Op = bisectorAt(B, Cpt, k);
    return Math.abs(d(Op, exactP) - exactP.r - d(Op, B));
  });
  check("the exactly parallel P has a coaxal circle tangent externally to it",
    Math.min(...exactSolutions) < 1e-6, `min ${Math.min(...exactSolutions)}`);
  check("the page's other observation holds: the chord DE is antiparallel to BC",
    C.parallelCross(g.chord, g.antiparallel) < 1e-9);
}

/* --------------------------------------------------------- 5. degeneracies */

{
  const s = C.start({});
  let flat = C.move(s, { name: "A", x: 200, y: 100 });
  flat = C.move(flat, { name: "B", x: 40, y: 100 });
  flat = C.move(flat, { name: "C", x: 300, y: 100 });
  const g = C.geometry(flat);
  check("a straight angle leaves no direction for the auxiliary circles",
    C.oneOnBisector(flat.A, flat.B, flat.C, flat.O, 50,
      C.angleBisectorFoot(flat.A, flat.B, flat.C), Math.PI / 2, 1) === null);
  check("the page still returns a well-formed, invalid picture", g && g.valid === false);
  const fallback = C.start({ A: { x: NaN, y: 0 } });
  check("non-finite point inputs fall back to the opening position",
    d(fallback.A, C.DEFAULT.A) < 1e-9);
}

done("circles-on-perp-bisector");
