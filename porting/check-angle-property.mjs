#!/usr/bin/env node
"use strict";

/*
 * Logic test for angle-property/angle-property-core.js.
 *
 *   node porting/check-angle-property.mjs
 *
 * Two kinds of checks. First, the claims on the cut-the-knot page, over
 * hundreds of random circles and points: a circle away from O inverts to a
 * circle, a circle through O inverts to a line, any two circles can be
 * inverted into one another from a homothety centre, inversion and a negative
 * inversion obey P'Q' = |k| PQ/(OP OQ), triangles OPQ and OQ'P' are similar,
 * angles keep their measure, and the applet's two tangents meet the line OT
 * at the same angle. Second, the core is compared with a second transcription
 * of the applet's own bytecode: InvLine.InvertCinC, Inversion.Invert,
 * InvLine.TangentAt, GeoSDoub.IntersectX/Y and AnglePropertyCanvas.Tangent.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("angle-property/angle-property-core.js", "AnglePropertyCore");
const TOL = 1e-7;
const near = (a, b, tol = TOL) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const pointNear = (a, b, tol = TOL) => !!a && !!b && near(a.x, b.x, tol) && near(a.y, b.y, tol);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const len = (v) => Math.hypot(v.x, v.y);
const angleAt = (p, q, r) => {
  const v = sub(q, p);
  const w = sub(r, p);
  const c = (v.x * w.x + v.y * w.y) / (len(v) * len(w));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};
const setNear = (as, bs, tol = TOL) => {
  if (!as || !bs || as.length !== bs.length) return false;
  return as.every((a) => bs.some((b) => pointNear(a, b, tol)));
};

/* -------------------------------------------------- the applet, from javap */

/* Inversion.Invert(DoubCircle, DoubPoint): r^2 / |p-O|^2 along O->p. */
function appletInvert(inv, p) {
  const d = C.dist(inv.center, p);
  const k = (inv.radius * inv.radius) / d / d;
  return { x: inv.center.x + k * (p.x - inv.center.x), y: inv.center.y + k * (p.y - inv.center.y) };
}

/* InvLine.TangentAt(DoubPoint): 100 units along the tangent at q. */
function appletTangentAt(inv, q) {
  return {
    a: q,
    b: { x: q.x + 100 * (q.y - inv.center.y), y: q.y - 100 * (q.x - inv.center.x) },
  };
}

/* InvLine.InvertCinC(DoubCircle, boolean invertSign = false). */
function appletInvertCinC(inv, target) {
  const r = target.radius;                                    // GetRadius()
  const d = C.sqDist(inv.center, target.center) - r * r;
  if (Math.abs(d) > 100) {
    const k = (inv.radius * inv.radius) / d;                   // sign = +1
    return {
      kind: "circle",
      center: { x: inv.center.x + (target.center.x - inv.center.x) * k,
                y: inv.center.y + (target.center.y - inv.center.y) * k },
      radius: r * Math.abs(k),
    };
  }
  const antipode = { x: 2 * target.center.x - inv.center.x, y: 2 * target.center.y - inv.center.y };
  const q = appletInvert(inv, antipode);
  const tangent = appletTangentAt(inv, q);
  return { kind: "line", point: q, direction: sub(tangent.b, tangent.a) };
}

/* GeoSDoub.Intersect(DoubLine, DoubCircle), via IntersectX / IntersectY. */
function appletIntersect(a, b, circle) {
  const r = circle.radius;
  const cx = circle.center.x;
  const cy = circle.center.y;
  if (Math.abs(a.y - b.y) > 1) {
    const m = (a.x - b.x) / (a.y - b.y);
    const off = b.x - m * b.y;
    const A = m * m + 1;
    const p = m * (off - cx) - cy;
    const q = cy * cy + (off - cx) * (off - cx) - r * r;
    const disc = p * p - A * q;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const y1 = (-p + s) / A;
    const y2 = (-p - s) / A;
    return [{ x: m * y1 + off, y: y1 }, { x: m * y2 + off, y: y2 }];
  }
  if (Math.abs(a.x - b.x) > 1) {
    const m = (a.y - b.y) / (a.x - b.x);
    const off = b.y - m * b.x;
    const A = m * m + 1;
    const p = m * (off - cy) - cx;
    const q = cx * cx + (off - cy) * (off - cy) - r * r;
    const disc = p * p - A * q;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const x1 = (-p + s) / A;
    const x2 = (-p - s) / A;
    return [{ x: x1, y: m * x1 + off }, { x: x2, y: m * x2 + off }];
  }
  return null;
}

/* AnglePropertyCanvas.Tangent(DoubPoint, DoubCircle): the `int 2` divisor. */
function appletTangentEnds(p, circle) {
  const dy = circle.center.y - p.y;
  const dx = circle.center.x - p.x;
  return [
    { x: p.x + dy / 2, y: p.y - dx / 2 },
    { x: p.x - dy / 2, y: p.y + dx / 2 },
  ];
}

/* ------------------------------------------------------ 1. the applet's state */

{
  const s = C.start({});
  check("start puts O, S, P, R and T where AnglePropertyCanvas.init() does",
    pointNear(s.O, { x: 50, y: 150 }, 0) && pointNear(s.S, { x: 160, y: 150 }, 0) &&
    pointNear(s.P, { x: 120, y: 150 }, 0) && pointNear(s.R, { x: 140, y: 150 }, 0) &&
    pointNear(s.T, { x: 380, y: 90 }, 0));
  check("both applet checkboxes start off", !s.options.names && !s.options.hint);
  check("the inversion circle has radius OS and the second circle radius PR",
    near(C.inversionCircle(s).radius, 110) && near(C.targetCircle(s).radius, 20));
  check("an illustration has no win, loss or end", C.result(s) === null);

  const moved = C.moveVertex(s, "T", { x: 9000, y: -20 });
  check("dragging a point clamps it to the 400x300 drawing",
    moved.T.x === 394 && moved.T.y === 6);
  check("moving a point leaves the old position alone",
    s.T.x === 380 && s.touches === 0 && moved.touches === 1 &&
    Object.keys(moved).every((k) => k !== "T" || moved.T !== s.T));
  check("a bad point or an unknown handle is ignored",
    C.moveVertex(s, "Z", { x: 1, y: 1 }) === s &&
    C.moveVertex(s, "O", { x: NaN, y: 3 }) === s);
  check("the two checkboxes switch without moving the points",
    C.setOption(s, "hint", true).options.hint === true &&
    C.setOption(s, "names", true).options.names === true &&
    pointNear(C.setOption(s, "hint", true).P, s.P, 0) &&
    C.setOption(s, "missing", true) === s);
}

/* -------------------------------------- 2. second transcription of the code */

const rand = rng(20261126);
const polar = (c, r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
const states = [];
for (let i = 0; i < 700; i++) {
  const O = { x: 30 + rand() * 190, y: 40 + rand() * 220 };
  const S = polar(O, 20 + rand() * 95, rand() * Math.PI * 2);
  const P = { x: 150 + rand() * 200, y: 30 + rand() * 240 };
  const R = polar(P, 8 + rand() * 55, rand() * Math.PI * 2);
  const T = { x: 250 + rand() * 140, y: rand() * 300 };
  states.push({ O, S, P, R, T, options: { names: false, hint: false }, touches: 0 });
}
// Circles that really pass through O exercise the line branch of InvertCinC.
for (let i = 0; i < 80; i++) {
  const O = { x: 60 + rand() * 130, y: 60 + rand() * 180 };
  const angle = rand() * Math.PI * 2;
  const r = 15 + rand() * 50;
  const P = polar(O, r, angle);
  const R = polar(P, r, angle + Math.PI / 2);
  states.push({ O, S: polar(O, 60 + rand() * 60, angle + 1),
    P, R, T: { x: 300 + rand() * 90, y: rand() * 300 },
    options: { names: false, hint: false }, touches: 0 });
}

{
  let circles = 0;
  let lines = 0;
  let worstCentre = 0;
  let worstRadius = 0;
  let worstPoint = 0;
  let worstDirection = 0;
  for (const s of states) {
    const inv = C.inversionCircle(s);
    const target = C.targetCircle(s);
    if (Math.abs(C.sqDist(inv.center, target.center) - target.radius ** 2) <= 100.5) continue;
    const core = C.invertCircle(inv.center, inv.radius ** 2, target);
    const applet = appletInvertCinC(inv, target);
    if (core.kind !== "circle" || applet.kind !== "circle") continue;
    circles++;
    worstCentre = Math.max(worstCentre, C.dist(core.center, applet.center));
    worstRadius = Math.max(worstRadius, Math.abs(core.radius - applet.radius));
  }
  for (const s of states) {
    const inv = C.inversionCircle(s);
    const target = C.targetCircle(s);
    if (Math.abs(C.sqDist(inv.center, target.center) - target.radius ** 2) > 100) continue;
    const core = C.invertCircle(inv.center, inv.radius ** 2, target);
    const applet = appletInvertCinC(inv, target);
    if (core.kind !== "line" || applet.kind !== "line" || !core.point) continue;
    lines++;
    worstPoint = Math.max(worstPoint, C.dist(core.point, applet.point));
    // Compare directions as unit vectors so the Java 100 factor does not matter.
    const a = { x: core.direction.x / len(core.direction), y: core.direction.y / len(core.direction) };
    const b = { x: applet.direction.x / len(applet.direction), y: applet.direction.y / len(applet.direction) };
    worstDirection = Math.max(worstDirection, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }
  check("circle-branch image matches InvLine.InvertCinC over hundreds of circles",
    circles >= 300 && worstCentre < 1e-8 && worstRadius < 1e-8,
    `${circles} cases, centre ${worstCentre}, radius ${worstRadius}`);
  check("line-branch image matches the applet's antipode/tangent construction",
    lines >= 40 && worstPoint < 1e-6 && worstDirection < 1e-9,
    `${lines} cases, point ${worstPoint}, direction ${worstDirection}`);
}

{
  let compared = 0;
  let skipped = 0;
  for (const s of states) {
    const circle = C.targetCircle(s);
    const lineA = s.O;
    const lineB = s.T;
    if (Math.abs(lineA.y - lineB.y) <= 1 && Math.abs(lineA.x - lineB.x) <= 1) { skipped++; continue; }
    const core = C.lineCircleIntersections(lineA, lineB, circle);
    const applet = appletIntersect(lineA, lineB, circle);
    if (!applet) { if (core.length) { skipped++; continue; } continue; }
    compared++;
    if (!setNear(core, applet, 1e-6)) { skipped++; break; }
  }
  check("line/circle crossings match GeoSDoub.IntersectX and IntersectY",
    compared >= 300 && skipped === 0, `${compared} compared, ${skipped} bad`);

  let tangentChecks = 0;
  for (const s of states) {
    const circle = C.targetCircle(s);
    const hits = C.lineCircleIntersections(s.O, s.T, circle);
    for (const p of hits) {
      if (!setNear(C.tangentEnds(p, circle), appletTangentEnds(p, circle), 0)) { tangentChecks = -1; break; }
      tangentChecks++;
    }
  }
  check("tangent segments match AnglePropertyCanvas.Tangent",
    tangentChecks >= 300, `${tangentChecks} points`);
}

/* --------------------------------------------------- 3. the page's claims */

{
  let worst = 0;
  let used = 0;
  for (const s of states.slice(0, 400)) {
    const inv = C.inversionCircle(s);
    const target = C.targetCircle(s);
    const d = C.sqDist(inv.center, target.center) - target.radius ** 2;
    if (Math.abs(d) <= 100.5) continue;
    const image = C.invertCircle(inv.center, inv.radius ** 2, target);
    if (image.kind !== "circle") continue;
    used++;
    for (let i = 0; i < 16; i++) {
      const p = polar(target.center, target.radius, (i * Math.PI) / 8);
      const q = C.invertPoint(inv.center, inv.radius ** 2, p);
      if (!q) continue;
      const scale = Math.max(1, image.radius);
      worst = Math.max(worst, Math.abs(C.dist(q, image.center) - image.radius) / scale);
    }
  }
  check("page: a circle not through O inverts to a circle (all sampled points lie on it)",
    used >= 300 && worst < 1e-9, `${used} circles, worst relative error ${worst}`);
}

{
  let worst = 0;
  let used = 0;
  for (const s of states.slice(-80)) {
    const inv = C.inversionCircle(s);
    const target = C.targetCircle(s);
    const image = C.invertCircle(inv.center, inv.radius ** 2, target);
    if (image.kind !== "line" || !image.point) continue;
    used++;
    const scale = len(image.direction);
    for (let i = 0; i < 12; i++) {
      const p = polar(target.center, target.radius, (i * Math.PI) / 6);
      if (C.dist(p, inv.center) < 1e-4) continue;
      const q = C.invertPoint(inv.center, inv.radius ** 2, p);
      worst = Math.max(worst, Math.abs(cross(sub(q, image.point), image.direction)) / scale);
    }
  }
  check("page: a circle through O inverts to a straight line",
    used >= 60 && worst < 1e-6, `${used} circles, worst distance ${worst}`);
}

{
  let worstAngle = 0;
  let worstFormula = 0;
  let worstNegative = 0;
  let worstSimilar = 0;
  for (let i = 0; i < 600; i++) {
    const O = { x: rand() * 400, y: rand() * 300 };
    const P = polar(O, 10 + rand() * 150, rand() * Math.PI * 2);
    const a = rand() * Math.PI * 2;
    const b = a + rand() * Math.PI;
    // A tiny step from P gives the tangent directions of the two curves that
    // inversion sends through P'. Those directions are what "preserves an
    // angle" means; finite chords of the image circles are not tangents.
    const h = C.dist(O, P) * 1e-5;
    const Q = { x: P.x + h * Math.cos(a), y: P.y + h * Math.sin(a) };
    const R = { x: P.x + h * Math.cos(b), y: P.y + h * Math.sin(b) };
    const r2 = (30 + rand() * 90) ** 2;
    const Pp = C.invertPoint(O, r2, P);
    const Qq = C.invertPoint(O, r2, Q);
    const Rr = C.invertPoint(O, r2, R);
    worstAngle = Math.max(worstAngle, Math.abs(angleAt(P, Q, R) - angleAt(Pp, Qq, Rr)));
    // Formula (1): P'Q' = R^2 * PQ / (OP * OQ).
    const expected = (r2 * C.dist(P, Q)) / (C.dist(O, P) * C.dist(O, Q));
    worstFormula = Math.max(worstFormula,
      Math.abs(C.dist(Pp, Qq) - expected) / Math.max(1, expected));
    // Formula (2), with a negative power: |k| instead of R^2.
    const k = -r2;
    const Pn = C.invertPoint(O, k, P);
    const Qn = C.invertPoint(O, k, Q);
    const expectedNeg = (Math.abs(k) * C.dist(P, Q)) / (C.dist(O, P) * C.dist(O, Q));
    worstNegative = Math.max(worstNegative,
      Math.abs(C.dist(Pn, Qn) - expectedNeg) / Math.max(1, expectedNeg));
    // Triangles OPQ and OQ'P' are similar: OP/OQ' = OQ/OP' = PQ/P'Q'.
    const s1 = C.dist(O, P) / C.dist(O, Qq);
    const s2 = C.dist(O, Q) / C.dist(O, Pp);
    const s3 = C.dist(P, Q) / C.dist(Pp, Qq);
    worstSimilar = Math.max(worstSimilar, Math.abs(s1 - s2), Math.abs(s2 - s3));
  }
  check("page: inversion preserves the measure of an angle", worstAngle < 0.01,
    `worst change ${worstAngle} degrees`);
  check("page formula (1): P'Q' = R^2 PQ / (OP OQ)", worstFormula < 1e-10,
    `worst relative error ${worstFormula}`);
  check("page formula (2): P'Q' = |k| PQ / (OP OQ) for negative power", worstNegative < 1e-10,
    `worst relative error ${worstNegative}`);
  check("page: triangles OPQ and OQ'P' are similar", worstSimilar < 1e-8,
    `worst ratio spread ${worstSimilar}`);
}

{
  // The page: any two circles can be inverted into one another from a centre
  // of homothety. Here c2 is c1 scaled by lambda about H, and the inversion
  // power is lambda times the power of H with respect to c1 (lambda may be
  // negative for the internal centre of homothety).
  let used = 0;
  let worst = 0;
  for (let i = 0; i < 300; i++) {
    const H = { x: rand() * 400, y: rand() * 300 };
    const c1 = { center: polar(H, 20 + rand() * 100, rand() * Math.PI * 2),
                 radius: 5 + rand() * 40 };
    const d = C.sqDist(H, c1.center) - c1.radius ** 2;
    if (Math.abs(d) <= 100.5) continue;
    const lambda = (rand() < 0.5 ? 1 : -1) * (0.4 + rand() * 1.8);
    const c2 = { center: { x: H.x + lambda * (c1.center.x - H.x),
                           y: H.y + lambda * (c1.center.y - H.y) },
                 radius: Math.abs(lambda) * c1.radius };
    const image = C.invertCircle(H, lambda * d, c1);
    if (image.kind !== "circle") continue;
    used++;
    worst = Math.max(worst, C.dist(image.center, c2.center), Math.abs(image.radius - c2.radius));
  }
  check("page: two circles invert into one another from either homothety centre",
    used >= 150 && worst < 1e-7, `${used} pairs, worst error ${worst}`);
}

{
  let used = 0;
  let worstInverse = 0;
  let worstAngle = 0;
  let worstPower = 0;
  let worstHomothety = 0;
  for (const s of states.slice(0, 700)) {
    const g = C.geometry(s);
    if (!g.valid) continue;
    used++;
    const k = g.power / g.d;
    for (const pair of g.pairs) {
      const q = C.invertPoint(g.inversion.center, g.power, pair.point);
      worstInverse = Math.max(worstInverse, C.dist(q, pair.image));
      // Homothety about O by k sends A to B' (the antihomologous pairing).
      const homothety = {
        x: g.inversion.center.x + k * (pair.point.x - g.inversion.center.x),
        y: g.inversion.center.y + k * (pair.point.y - g.inversion.center.y),
      };
      const other = g.pairs.find((p) => p.point !== pair.point);
      worstHomothety = Math.max(worstHomothety, C.dist(homothety, other.image));
    }
    for (const a of g.angles) worstAngle = Math.max(worstAngle, Math.abs(a.original - a.inverted));
    // On any line through O, OA * OB (signed along the line) is OP^2 - r^2.
    const u = sub(g.line.b, g.line.a);
    const u2 = C.sqDist(g.line.a, g.line.b);
    const t = g.originalHits.map((p) => ((p.x - g.line.a.x) * u.x + (p.y - g.line.a.y) * u.y) / u2);
    worstPower = Math.max(worstPower, Math.abs(t[0] * t[1] * u2 - g.d));
  }
  check("applet picture: line OT meets the circle and its image in inverse pairs",
    used >= 60 && worstInverse < 1e-6, `${used} positions, worst ${worstInverse}`);
  check("applet picture: the two tangents make equal angles with OT in every position",
    used >= 60 && worstAngle < 1e-6, `${used} positions, worst ${worstAngle} degrees`);
  check("applet picture: A and B' are homologous, A and A' antihomologous",
    worstHomothety < 1e-6, `worst ${worstHomothety}`);
  check("applet picture: OA times OB equals the power of O in the second circle",
    worstPower < 1e-6, `worst ${worstPower}`);
}

{
  // Tangent circles at O become parallel lines; crossing circles become
  // crossing lines, with the same angle as the circles had at O.
  let worstParallel = 0;
  let worstCross = 0;
  for (let i = 0; i < 120; i++) {
    const O = { x: rand() * 400, y: rand() * 300 };
    const a1 = rand() * Math.PI * 2;
    const r1 = 20 + rand() * 40;
    const c1 = { center: polar(O, r1, a1), radius: r1 };
    const a2 = a1 + (i % 2 ? 0 : 0.3 + rand() * 2.2);
    const r2 = 20 + rand() * 40;
    const c2 = { center: polar(O, r2, a2), radius: r2 };
    const i1 = C.invertCircle(O, 5000, c1);
    const i2 = C.invertCircle(O, 5000, c2);
    const angle = C.angleBetween(i1.direction, i2.direction);
    if (i % 2) worstParallel = Math.max(worstParallel, Math.min(angle, 180 - angle));
    else {
      const crossAngle = C.angleBetween(sub(c1.center, O), sub(c2.center, O));
      worstCross = Math.max(worstCross, Math.min(Math.abs(angle - crossAngle),
        Math.abs(angle + crossAngle - 180)));
    }
  }
  check("page: circles tangent at O invert to parallel lines", worstParallel < 1e-4,
    `worst ${worstParallel} degrees`);
  check("page: circles crossing at O invert to crossing lines at the same angle", worstCross < 1e-6,
    `worst ${worstCross} degrees`);
}

{
  const s = C.start({});
  const text = C.status(s, C.geometry(s));
  check("the status reads the two equal tangent angles", /\d/.test(text) && /°/.test(text) &&
    !/NaN|undefined/.test(text), text);
}

done("angle-property");
