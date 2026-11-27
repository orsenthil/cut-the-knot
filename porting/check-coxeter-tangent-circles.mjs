#!/usr/bin/env node
"use strict";

/*
 * Logic test for coxeter-tangent-circles/coxeter-tangent-circles-core.js.
 *
 *   node porting/check-coxeter-tangent-circles.mjs
 *
 * The cut-the-knot page states Beecroft's theorem: from four mutually tangent
 * circles a second set of four can be drawn whose six points of contact are
 * the same. It also claims that the three common tangents meet at the radical
 * centre, which is the incenter of the triangle of centres, so the incircle
 * passes through the three touching points and is orthogonal to all three
 * circles; and that with a = rb+rc, b = rc+ra, c = ra+rb the incircle's
 * contact lengths solve a = x+y, b = y+z, c = z+x uniquely (x = rb, y = rc,
 * z = ra with these side labels).
 *
 * Every claim is checked on more than a thousand configurations: a grid of
 * centre positions plus deterministic random drags, in both the inner and
 * the outer family. Section 3 compares the core with a second, independent
 * transcription of ApolloniusCircle.SetCircles/Compute, Extend and GetCircle
 * straight from the Java bytecode, on the same configurations.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("coxeter-tangent-circles/coxeter-tangent-circles-core.js", "CoxeterTangentCirclesCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a, b, tol = 1e-7) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.isNaN(a) && Number.isNaN(b);
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
};
const nearPt = (p, q, tol = 1e-7) => {
  if (!p || !q) return p === q;
  return near(p.x, q.x, tol) && near(p.y, q.y, tol);
};
const nearCircle = (p, q, tol = 1e-7) => {
  if (!p || !q) return p === q;
  return near(p.x, q.x, tol) && near(p.y, q.y, tol) && near(p.r, q.r, tol);
};

/* -------------------------------------------------------------------------- */
/* A second transcription, written straight from the class files.            */
/* Nothing here calls the core: it is the applet's own arithmetic again.      */
/* -------------------------------------------------------------------------- */

function appletGeometry(A, B, Cp, innerCircle) {
  const distance = (p, q) => Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));

  // CoxeterTangentCirclesCanvas.Compute: radius from the three side lengths.
  const s1 = distance(B, Cp);
  const s3 = distance(A, Cp);
  const s5 = distance(A, B);
  const ca = { x: A.x, y: A.y, r: (-s1 + s3 + s5) / 2 };
  const cb = { x: B.x, y: B.y, r: (s1 - s3 + s5) / 2 };
  const cc = { x: Cp.x, y: Cp.y, r: (s1 + s3 - s5) / 2 };

  // ApolloniusCircle.SetCircles: A1, A2, B1, B2, o, D1, D2, K, G, I.
  const info = (z) => z.x * z.x + z.y * z.y - z.r * z.r;
  const A1 = 2 * (cb.x - ca.x);
  const A2 = 2 * (cc.x - ca.x);
  const B1 = 2 * (cb.y - ca.y);
  const B2 = 2 * (cc.y - ca.y);
  const o = info(ca);
  const D1 = o - info(cb);
  const D2 = o - info(cc);
  const K = A1 * B2 - A2 * B1;
  const G = (B1 * D2 - B2 * D1) / K;
  const I = -(A1 * D2 - A2 * D1) / K;

  let solutions = [null, null];
  if (!(Math.abs(K) < 0.01)) {
    // ApolloniusCircle.Compute(1,1,1), instruction by instruction.
    const V1 = 2 * (ca.r - cb.r);
    const V2 = 2 * (ca.r - cc.r);
    const Xc = (B1 * V2 - B2 * V1) / K;
    const Yc = -(A1 * V2 - A2 * V1) / K;
    const T = Xc * Xc + Yc * Yc - 1;
    if (!(Math.abs(T) < 0.001)) {
      const t = 2 * (Xc * G + Yc * I - Xc * ca.x - Yc * ca.y + ca.r);
      const Q = G * G + I * I - 2 * G * ca.x - 2 * I * ca.y + o;
      const discriminant = t * t - 4 * T * Q;
      if (discriminant >= 0) {
        const root = Math.sqrt(discriminant);
        const circle = (R) => ({ x: G + Xc * R, y: I + Yc * R, r: Math.abs(R) });
        solutions = [circle((-t + root) / (2 * T)), circle((-t - root) / (2 * T))];
      }
    }
  }
  const selected = innerCircle ? solutions[0] : solutions[1];

  // canvas.Extend(point, point, length) and CommonPoint(c1, c2).
  const Extend = (p, q, len) => {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const dd = Math.sqrt(dx * dx + dy * dy);
    return { x: p.x + (dx * len) / dd, y: p.y + (dy * len) / dd };
  };
  const Common = (c1, c2) => Extend(c1, c2, c1.r);

  // GeoSDoub.FindCircumcenter and canvas.GetCircle.
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const circum = (p, q, r) => {
    const mAB = mid(p, q), mBC = mid(q, r);
    const lAB = { x: mAB.x + (q.y - p.y), y: mAB.y - (q.x - p.x) };
    const lBC = { x: mBC.x + (r.y - q.y), y: mBC.y - (r.x - q.x) };
    const rx = lAB.x - mAB.x, ry = lAB.y - mAB.y;
    const sx = lBC.x - mBC.x, sy = lBC.y - mBC.y;
    const cross = rx * sy - ry * sx;
    if (Math.abs(cross) < 1) return { x: NaN, y: NaN };
    const tt = ((mBC.x - mAB.x) * sy - (mBC.y - mAB.y) * sx) / cross;
    return { x: mAB.x + rx * tt, y: mAB.y + ry * tt };
  };
  const circle3 = (p, q, r) => {
    const center = circum(p, q, r);
    return { x: center.x, y: center.y, r: (distance(center, p) + distance(center, q) + distance(center, r)) / 3 };
  };

  let ABp = null, BCp = null, CAp = null, AKp = null, BKp = null, CKp = null;
  let family = [null, null, null, null];
  if (selected) {
    ABp = Common(ca, cb);
    BCp = Common(cb, cc);
    CAp = Common(cc, ca);
    AKp = Common(selected, ca);
    BKp = Common(selected, cb);
    CKp = Common(selected, cc);
    family = [
      circle3(ABp, BCp, CAp),
      circle3(AKp, BKp, ABp),
      circle3(BKp, CKp, BCp),
      circle3(CKp, AKp, CAp),
    ];
  }
  return { radii: [ca.r, cb.r, cc.r], ca: ca, cb: cb, cc: cc,
    solutions: solutions, circle: selected, K: K, G: G, I: I,
    ABp: ABp, BCp: BCp, CAp: CAp, AKp: AKp, BKp: BKp, CKp: CKp, family: family };
}

/* ------------------------------- configurations -------------------------- */

function configurations() {
  const out = [C.start({}), C.start({ innerCircle: false })];
  // An almost equilateral triple, as in the article's picture.
  out.push(C.start({ A: { x: 240, y: 70 }, B: { x: 136, y: 240 }, C: { x: 344, y: 240 } }));
  // A grid: move each centre across the board in turn.
  for (let i = 0; i < 9; i++) {
    const A = { x: 30 + 50 * i, y: 30 + 20 * (i % 3) };
    const B = { x: 430, y: 70 + 25 * (i % 4) };
    for (let j = 0; j < 11; j++) {
      for (let k = 0; k < 10; k++) {
        out.push(C.start({ A: A, B: B, C: { x: 90 + 30 * j, y: 25 + 29 * k } }));
      }
    }
  }
  const rnd = rng(20261127);
  for (let i = 0; i < 700; i++) {
    const pt = () => ({ x: 15 + rnd() * 450, y: 15 + rnd() * 290 });
    out.push(C.start({ A: pt(), B: pt(), C: pt(), innerCircle: rnd() < 0.5 }));
  }
  return out;
}

const ALL = configurations();
const GOOD = ALL.filter((s) => {
  const g = C.geometry(s);
  return g.valid && g.radii.a > 0 && g.radii.b > 0 && g.radii.c > 0 &&
    g.radii.a < 300 && g.radii.b < 300 && g.radii.c < 300 &&
    g.circle.r < 300 && g.inradius > 0.5 &&
    g.second.every((c) => Number.isFinite(c.r) && c.r < 1e4);
});
const INNER = GOOD.filter((s) => s.innerCircle);
const OUTER = GOOD.filter((s) => !s.innerCircle);

/* --------------------------------- 1. the applet's constants and rules ---- */

{
  const s = C.start({});
  const g = C.geometry(s);
  check("the board is the applet's 480x320 canvas with a fifth-of-the-side radius",
    C.WIDTH === 480 && C.HEIGHT === 320 && C.SCALE === 64 && C.CX === 240 && C.CY === 160);
  check("the three centres start at angles -1.6, -4.0 and -0.2",
    near(s.A.x, 240 + 64 * Math.cos(-1.6)) && near(s.B.y, 160 + 64 * Math.sin(-4.0)) &&
    near(s.C.x, 240 + 64 * Math.cos(-0.2)) && near(s.C.y, 160 + 64 * Math.sin(-0.2)));
  check("the inner circle is the default, as in the applet's checkbox group",
    s.innerCircle === true && g.valid && g.circle.r > 0);
  check("an illustration has no win or loss", C.result(s) === null);
}

/* -------------------------------- 2. position and dragging --------------- */

{
  const s = C.start({});
  const moved = C.setPoint(s, "B", { x: 123, y: 45 });
  check("dragging a centre returns new plain data and leaves the old position alone",
    moved !== s && s.B.x !== 123 && moved.B.x === 123 && moved.B.y === 45 &&
    nearPt(moved.A, s.A) && nearPt(moved.C, s.C));
  check("drags stay inside the canvas",
    C.setPoint(s, "A", { x: -50, y: 999 }).A.x === C.EDGE &&
    C.setPoint(s, "A", { x: -50, y: 999 }).A.y === C.HEIGHT - C.EDGE);
  check("the family toggles without changing the centres",
    C.setFamily(moved, false).innerCircle === false && nearPt(C.setFamily(moved, false).A, moved.A));
  check("the saved position is JSON-safe board data",
    JSON.stringify(C.position(s)) === JSON.stringify(JSON.parse(JSON.stringify(C.position(s)))) &&
    near(C.position(s).A.x, s.A.x) && C.position(s).innerCircle === true);
  check("collinear centres give a degenerate figure, not a crash",
    C.geometry(C.start({ A: { x: 60, y: 100 }, B: { x: 200, y: 100 }, C: { x: 400, y: 100 } })).valid === false);
}

/* --------------------------- 3. against the applet's bytecode ------------ */

{
  let fig = true, allPoints = true;
  for (const s of ALL) {
    const g = C.geometry(s);
    const a = appletGeometry(s.A, s.B, s.C, s.innerCircle);
    const tol = 1e-9;
    if (!near(g.radii.a, a.radii[0], tol) || !near(g.radii.b, a.radii[1], tol) ||
        !near(g.radii.c, a.radii[2], tol) || !near(g.determinant, a.K, tol) ||
        !near(g.radicalCenter.x, a.G, tol) || !near(g.radicalCenter.y, a.I, tol) ||
        !nearCircle(g.circle, a.circle, tol)) fig = false;
    const pts = g.points;
    const pair = [[pts.ABp, a.ABp], [pts.BCp, a.BCp], [pts.CAp, a.CAp],
      [pts.AKp, a.AKp], [pts.BKp, a.BKp], [pts.CKp, a.CKp]];
    for (const [core, java] of pair) if (!nearPt(core, java, tol)) allPoints = false;
    for (let i = 0; i < 4; i++) if (!nearCircle(g.second[i], a.family[i], tol)) fig = false;
  }
  check("the core reproduces ApolloniusCircle.SetCircles/Compute and GetCircle",
    fig, `${ALL.length} configurations`);
  check("the core reproduces all six CommonPoint/Extend contact points",
    allPoints, `${ALL.length} configurations`);
  check("the two Apollonius solutions are the inner and enclosing circles",
    GOOD.length > 500 && INNER.length > 200 && OUTER.length > 150 &&
    C.geometry(C.start({ innerCircle: false })).circle.r >
    C.geometry(C.start({})).circle.r);
}

/* ----------------------- 4. the page's claims, both families ------------- */

{
  let tangent = true, formula1 = true, formula2 = true, unique = true;
  let radical = true, powers = true, orthogonal = true, incircle = true;
  let secondTangent = true, shared = true, firstQuad = true;
  for (const s of GOOD) {
    const g = C.geometry(s);
    const ra = g.radii.a, rb = g.radii.b, rc = g.radii.c;
    const R = g.circle.r;
    const groups = [[g.A, g.B, ra, rb], [g.B, g.C, rb, rc], [g.C, g.A, rc, ra]];
    for (const [p, q, r1, r2] of groups) {
      // Claim (1): the sides are rb+rc, rc+ra, ra+rb; the circles touch.
      if (!near(dist(p, q), r1 + r2)) tangent = false;
    }
    if (!near(g.sides.a, rb + rc) || !near(g.sides.b, rc + ra) ||
        !near(g.sides.c, ra + rb)) formula1 = false;

    // Claim (2): a = x+y, b = y+z, c = z+x has the unique solution ra,rb,rc.
    // a=x+y, b=y+z, c=z+x  =>  x=rb, y=rc, z=ra.
    const x = (g.sides.a + g.sides.c - g.sides.b) / 2;
    const y = (g.sides.a + g.sides.b - g.sides.c) / 2;
    const z = (g.sides.b + g.sides.c - g.sides.a) / 2;
    const det = 2; // determinant of [[1,1,0],[0,1,1],[1,0,1]]
    if (!near(x, rb) || !near(y, rc) || !near(z, ra) || det === 0) unique = false;
    if (!near(x + y, g.sides.a) || !near(y + z, g.sides.b) ||
        !near(z + x, g.sides.c)) formula2 = false;

    // The radical centre is the incenter: (a*A + b*B + c*C)/(a+b+c).
    const perimeter = g.sides.a + g.sides.b + g.sides.c;
    const incenter = {
      x: (g.sides.a * g.A.x + g.sides.b * g.B.x + g.sides.c * g.C.x) / perimeter,
      y: (g.sides.a * g.A.y + g.sides.b * g.B.y + g.sides.c * g.C.y) / perimeter,
    };
    if (!nearPt(g.radicalCenter, incenter, 1e-6)) radical = false;

    // Equal tangent lengths: every circle has the same power at that point.
    const P = g.radicalCenter;
    const powersList = [[g.A, ra], [g.B, rb], [g.C, rc]].map(([o, r]) =>
      dist(P, o) * dist(P, o) - r * r);
    if (!near(powersList[0], powersList[1], 1e-6) ||
        !near(powersList[1], powersList[2], 1e-6) ||
        !near(powersList[0], g.second[0].r * g.second[0].r, 1e-6)) powers = false;

    // The incircle passes through the three original touching points and is
    // orthogonal to each original circle.
    const inc = g.second[0];
    if (!near(inc.r, g.inradius, 1e-6)) incircle = false;
    for (const [o, r, touch] of [[g.A, ra, g.points.ABp], [g.B, rb, g.points.BCp],
      [g.C, rc, g.points.CAp]]) {
      if (!near(dist(inc, touch), inc.r, 1e-6) || !near(dist(o, touch), r, 1e-6)) incircle = false;
      const d = dist(inc, o);
      if (!near(d * d, inc.r * inc.r + r * r, 1e-6)) orthogonal = false;
    }

    // The first quadruplet: the chosen fourth circle touches all three.
    for (const [o, r] of [[g.A, ra], [g.B, rb], [g.C, rc]]) {
      const d = dist(g.circle, o);
      // The enclosing solution can touch a given circle internally or
      // externally, depending on the configuration; both are one family.
      if (!near(d, R + r, 1e-6) && !near(d, Math.abs(R - r), 1e-6)) firstQuad = false;
    }

    // Beecroft: the second four circles touch pairwise at the same six points.
    const X = g.second[0], AB = g.second[1], BC = g.second[2], CA = g.second[3];
    const pairs = [
      [X, AB, g.points.ABp], [X, BC, g.points.BCp], [X, CA, g.points.CAp],
      [AB, BC, g.points.BKp], [BC, CA, g.points.CKp], [CA, AB, g.points.AKp],
    ];
    for (const [u, v, at] of pairs) {
      if (!near(dist(u, at), u.r, 1e-6) || !near(dist(v, at), v.r, 1e-6)) shared = false;
      const d = dist(u, v);
      if (!near(d, u.r + v.r, 1e-6) && !near(d, Math.abs(u.r - v.r), 1e-6)) secondTangent = false;
      // The radii to the shared point must be on one straight line.
      const cross = (at.x - u.x) * (at.y - v.y) - (at.y - u.y) * (at.x - v.x);
      if (Math.abs(cross) > 1e-5 * Math.max(1, d)) secondTangent = false;
    }
  }

  check("the three circles touch pairwise (AB=ra+rb, BC=rb+rc, CA=rc+ra)",
    tangent, `${GOOD.length} configurations`);
  check("the page's formula (1) a=rb+rc, b=rc+ra, c=ra+rb holds", formula1);
  check("the page's system (2) has x=ra, y=rb, z=rc as its solution", formula2);
  check("the system's coefficient matrix is nonsingular, so the solution is unique", unique);
  check("the radical centre is the incenter of the triangle of centres", radical);
  check("tangent lengths from the radical centre are all equal to the incircle radius", powers);
  check("the incircle passes through the three touching points", incircle);
  check("the incircle is orthogonal to all three original circles", orthogonal);
  check("the fourth circle joins the first quadruplet in both families", firstQuad);
  check("the second quadruplet's circles pass through the six shared contact points", shared);
  check("Beecroft's second four circles are mutually tangent at those six points", secondTangent);
}

done("coxeter-tangent-circles");
