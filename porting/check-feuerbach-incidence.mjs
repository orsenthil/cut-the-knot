#!/usr/bin/env node
"use strict";

/*
 * Logic test for feuerbach-incidence/feuerbach-incidence-core.js.
 *
 *   node porting/check-feuerbach-incidence.mjs
 *
 * The core follows the applet's bytecode: angle-bisector FindIncenter /
 * FindExcenter, a nine-point circle from the side midpoints, radii as the mean
 * of three distances, and contact points by scaling the line of centres. Here
 * that is compared with a second transcription using textbook barycentrics,
 * area formulas and R/2 +/- r over hundreds of triangles, and then both
 * incidences on the page are checked: A-Pa, B-Pb, C-Pc meet in X(12), and
 * N, F, I, Fi lie on L(1, 5). X(12) is checked against Kimberling's barycentrics
 * (b+c)^2/(b+c-a) and the harmonic-conjugate relation with X(11).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("feuerbach-incidence/feuerbach-incidence-core.js", "FeuerbachIncidenceCore");

const point = (x, y) => ({ x: x, y: y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ------------------------------------------- a second, textbook transcription */
function geometry(A, B, Cc) {
  const a = dist(B, Cc), b = dist(Cc, A), c = dist(A, B);
  const area2 = Math.abs(cross(A, B, Cc)); // twice the area
  const bary = (wa, wb, wc) => {
    const s = wa + wb + wc;
    return point((wa * A.x + wb * B.x + wc * Cc.x) / s,
      (wa * A.y + wb * B.y + wc * Cc.y) / s);
  };
  const I = bary(a, b, c);
  const Ia = bary(-a, b, c), Ib = bary(a, -b, c), Ic = bary(a, b, -c);
  const r = area2 / (a + b + c);
  const ra = area2 / (-a + b + c), rb = area2 / (a - b + c), rc = area2 / (a + b - c);
  // Circumcenter in barycentrics sin(2A):sin(2B):sin(2C).
  const O = bary(a * a * (b * b + c * c - a * a),
    b * b * (c * c + a * a - b * b), c * c * (a * a + b * b - c * c));
  const R = dist(O, A);
  const N = point((A.x + B.x + Cc.x - O.x) / 2, (A.y + B.y + Cc.y - O.y) / 2);
  const nineR = R / 2;
  const contact = (center, radius, outward) => {
    const d = dist(N, center);
    const t = (outward ? -1 : 1) * radius / d;
    return point(center.x + t * (center.x - N.x), center.y + t * (center.y - N.y));
  };
  // Excircles touch externally (from centre towards N); the incircle touches
  // internally, so Fi is on the far side of I from N.
  const Fa = contact(Ia, ra, true), Fb = contact(Ib, rb, true), Fc = contact(Ic, rc, true);
  const Fi = contact(I, r, false);
  const scale = Math.max(a, b, c);
  const ok = Math.min(a, b, c) > 1e-6 && area2 > 1e-6 &&
    Number.isFinite(R) && nineR > r;
  return { a: a, b: b, c: c, I: I, Ia: Ia, Ib: Ib, Ic: Ic, r: r,
    ra: ra, rb: rb, rc: rc, O: O, N: N, R: R, nineR: nineR,
    Fa: Fa, Fb: Fb, Fc: Fc, Fi: Fi, scale: scale, ok: ok };
}

/** Kimberling X(12): barycentrics (b+c)^2/(b+c-a) with cyclic partners. */
function x12(g) {
  const wa = (g.b + g.c) ** 2 / (g.b + g.c - g.a);
  const wb = (g.c + g.a) ** 2 / (g.c + g.a - g.b);
  const wc = (g.a + g.b) ** 2 / (g.a + g.b - g.c);
  const s = wa + wb + wc;
  return point((wa * A0.x + wb * B0.x + wc * C0.x) / s,
    (wa * A0.y + wb * B0.y + wc * C0.y) / s);
}

// x12() needs the triangle; keep it as a closure set by sample().
let A0 = point(0, 0), B0 = point(1, 0), C0 = point(0, 1);
function sample(a, b, c) {
  A0 = a; B0 = b; C0 = c;
  const g = geometry(a, b, c);
  return { g: g, k: C.compute(a, b, c), x12: x12(g) };
}

/** Deterministic triangles inside the applet's 400x250 board. */
function triangles(count, seed) {
  const random = rng(seed);
  const out = [];
  while (out.length < count) {
    const A = point(20 + random() * 360, 20 + random() * 210);
    const B = point(20 + random() * 360, 20 + random() * 210);
    const Cc = point(20 + random() * 360, 20 + random() * 210);
    if (Math.min(dist(A, B), dist(B, Cc), dist(Cc, A)) < 30) continue;
    if (cross(A, B, Cc) < 2000) continue; // orientation matters for the bisectors
    out.push([A, B, Cc]);
  }
  return out;
}

/* ------------------------------------------------ 1. the applet's own options */

{
  const s = C.start({});
  equal("the applet's 400x250 canvas", [s.width, s.height], [400, 250]);
  equal("B is 40 pixels in from the left and bottom", s.B, point(40, 210));
  const r = Math.floor(Math.min(s.width, s.height) / 4);
  check("A and C use the applet's fixed angles and integer radius",
    near(s.A.x, s.width / 2 + r * Math.cos(-1.6), 1e-12) &&
    near(s.A.y, s.height / 2 + r * Math.sin(-1.6), 1e-12) &&
    near(s.C.x, s.width / 2 + r * Math.cos(-0.2), 1e-12) &&
    near(s.C.y, s.height / 2 + r * Math.sin(-0.2), 1e-12));
  check("the four checkboxes start as in the panel",
    !s.showNames && !s.showCircles && !s.showLines && !s.showLine);
  check("reset restores the opening triangle", JSON.stringify(C.reset(s)) === JSON.stringify(s));
  check("the position is plain data, ready for the tutor",
    JSON.stringify(C.position(s)).includes('"showCircles":false') &&
    C.position(s).A.x === s.A.x && C.position(s).C.y === s.C.y);
}

/* -------------------------------- 2. circle gating from itemStateChanged */

{
  const on = { ...C.start({}), showCircles: true, showLines: true, showLine: true };
  check("concurrence and collinearity need circles on", C.flags(on).showLines && C.flags(on).showLine);
  check("turning circles off hides both incidences",
    !C.flags({ ...on, showCircles: false }).showLines &&
    !C.flags({ ...on, showCircles: false }).showLine);
  check("names do not depend on circles", C.flags({ ...on, showNames: true }).showNames);
  check("a move outside the board is clamped",
    (() => {
      const m = C.movePoint(C.start({}), "A", point(-100, 999));
      return m.A.x === 12 && m.A.y === 238;
    })());
  check("an unknown handle cannot move",
    JSON.stringify(C.movePoint(C.start({}), "X", point(1, 1))) === JSON.stringify(C.start({})));
}

/* ------------------------- 3. the second transcription over 300 triangles */

{
  const cases = triangles(300, 20261127);
  let centers = true, radii = true, contactPoints = true, nine = true;
  for (const [A, B, Cc] of cases) {
    const { g, k } = sample(A, B, Cc);
    const tol = 1e-7 * g.scale;
    centers = centers && dist(k.I, g.I) < tol &&
      dist(k.ca.center, g.Ia) < tol && dist(k.cb.center, g.Ib) < tol &&
      dist(k.cc.center, g.Ic) < tol &&
      dist(k.N, g.N) < tol;
    radii = radii && near(k.incircle.radius, g.r, tol) &&
      near(k.ca.radius, g.ra, tol) && near(k.cb.radius, g.rb, tol) &&
      near(k.cc.radius, g.rc, tol) && near(k.nine.radius, g.nineR, tol);
    contactPoints = contactPoints && dist(k.Pa, g.Fa) < tol && dist(k.Pb, g.Fb) < tol &&
      dist(k.Pc, g.Fc) < tol && dist(k.Pi, g.Fi) < tol;
    nine = nine && dist(k.nine.center, g.N) < tol;
  }
  check("incenter, three excenters and nine-point centre match barycentrics", centers);
  check("inradius, three exradii and nine-point radius match area formulas", radii);
  check("all four contact points match the R/2 +/- r construction", contactPoints);
  check("the nine-point centre is (A+B+C-O)/2", nine);
}

/* ---------------- 3b. a second, literal transcription of the applet's methods */

/*
 * Transcribed from javap of FeuerbachIncidenceCanvas and GeoSDoub separately
 * from the core above: Compute()/ComputeExcircle() with Rotate, FindOrientation,
 * NearestPoint and Intersect, and the two ComputePoint overloads.
 */
const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const d2 = (p, q) => Math.sqrt(sq(p, q));
const ang = (p, q, r) => Math.acos((sq(p, q) + sq(p, r) - sq(q, r)) / (2 * d2(p, q) * d2(p, r)));
const turn = (p, q, r) => (r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y > 0 ? 1 : -1);
const rot = (p, q, a, s) => point(
  p.x + Math.cos(a) * (q.x - p.x) - s * Math.sin(a) * (q.y - p.y),
  p.y + s * Math.sin(a) * (q.x - p.x) + Math.cos(a) * (q.y - p.y));
const meet = (a, b, c, d) => {
  const a1 = b.y - a.y, b1 = a.x - b.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = d.y - c.y, b2 = c.x - d.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  return point((b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det);
};
const nearPt = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (sq(a, b) < 0.1) return point(p.x, p.y);
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return point(a.x + dx * t, a.y + dy * t);
};
const mid = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
const avgCircle = (center, pts) => ({
  center: center,
  radius: (d2(center, pts[0]) + d2(center, pts[1]) + d2(center, pts[2])) / 3,
});
function bytecodeExcircle(a, b, c) {
  const o = turn(b, a, c);
  const center = meet(b,
    rot(b, c, (Math.PI - ang(b, a, c)) / 2, o),
    c, rot(c, b, (Math.PI - ang(c, a, b)) / 2, -o));
  return avgCircle(center, [nearPt(center, a, b), nearPt(center, b, c), nearPt(center, c, a)]);
}
function bytecodeCompute(A, B, Cc) {
  const o = turn(A, B, Cc);
  const I = meet(A, rot(A, B, ang(A, B, Cc) / 2, o), B, rot(B, Cc, ang(B, Cc, A) / 2, o));
  const inc = avgCircle(I, [nearPt(I, A, B), nearPt(I, B, Cc), nearPt(I, Cc, A)]);
  const m1 = mid(B, Cc), m2 = mid(Cc, A), m3 = mid(A, B);
  // FindCircumcenter is called with the three MIDPOINTS: it first averages two
  // of them and then uses their difference for the perpendicular direction.
  const q1 = mid(m1, m2), q2 = mid(m2, m3);
  const m4 = point(q1.x + (m2.y - m1.y), q1.y - (m2.x - m1.x));
  const m5 = point(q2.x + (m3.y - m2.y), q2.y - (m3.x - m2.x));
  const nine = avgCircle(meet(q1, m4, q2, m5), [m1, m2, m3]);
  const ca = bytecodeExcircle(A, B, Cc);
  const cb = bytecodeExcircle(B, Cc, A);
  const cc = bytecodeExcircle(Cc, A, B);
  const touch = (second, away) => {
    const t = (away ? -1 : 1) * second.radius / d2(nine.center, second.center);
    return point(second.center.x + t * (nine.center.x - second.center.x),
      second.center.y + t * (nine.center.y - second.center.y));
  };
  return {
    I: I, N: nine.center, inc: inc, nine: nine, ca: ca, cb: cb, cc: cc,
    Pa: touch(ca, false), Pb: touch(cb, false), Pc: touch(cc, false), Pi: touch(inc, true),
    F: meet(A, touch(ca, false), B, touch(cb, false)),
  };
}

{
  const cases = triangles(250, 112358);
  let centres = true, contacts = true;
  for (const [A, B, Cc] of cases) {
    const k = C.compute(A, B, Cc), j = bytecodeCompute(A, B, Cc);
    const tol = 1e-8 * Math.max(dist(A, B), dist(B, Cc), dist(Cc, A));
    centres = centres && dist(k.I, j.I) < tol && dist(k.N, j.N) < tol &&
      [["ca", j.ca], ["cb", j.cb], ["cc", j.cc]].every(([key, circle]) =>
        dist(k[key].center, circle.center) < tol && near(k[key].radius, circle.radius, tol));
    contacts = contacts && dist(k.Pa, j.Pa) < tol && dist(k.Pb, j.Pb) < tol &&
      dist(k.Pc, j.Pc) < tol && dist(k.Pi, j.Pi) < tol && dist(k.F, j.F) < tol;
  }
  check("the core matches a literal javap transcription: centres and radii", centres);
  check("the core matches a literal javap transcription: all touch points and F", contacts);
}

/* ------------------------------------ 4. Feuerbach tangency, the page's basis */

{
  const cases = triangles(300, 90210);
  let incircleTouch = true, excircleTouch = true, pointsOnCircles = true;
  for (const [A, B, Cc] of cases) {
    const { g, k } = sample(A, B, Cc);
    const tol = 1e-7 * g.scale;
    incircleTouch = incircleTouch && near(dist(k.N, k.I), g.nineR - g.r, tol);
    excircleTouch = excircleTouch &&
      near(dist(k.N, k.ca.center), g.nineR + g.ra, tol) &&
      near(dist(k.N, k.cb.center), g.nineR + g.rb, tol) &&
      near(dist(k.N, k.cc.center), g.nineR + g.rc, tol);
    pointsOnCircles = pointsOnCircles &&
      near(dist(k.Pi, k.I), k.incircle.radius, tol) &&
      near(dist(k.Pi, k.N), k.nine.radius, tol) &&
      near(dist(k.Pa, k.ca.center), k.ca.radius, tol) &&
      near(dist(k.Pa, k.N), k.nine.radius, tol) &&
      near(dist(k.Pb, k.cb.center), k.cb.radius, tol) &&
      near(dist(k.Pc, k.cc.center), k.cc.radius, tol);
  }
  check("the nine-point circle touches the incircle internally, 300 triangles", incircleTouch);
  check("the nine-point circle touches all three excircles externally", excircleTouch);
  check("each contact point lies on both circles it touches", pointsOnCircles);
}

/* ------------------------------ 5. claim 1: the three cevians meet in X(12) */

{
  const cases = triangles(500, 1357911);
  let concurrent = true, isX12 = true, harmonic = true;
  for (const [A, B, Cc] of cases) {
    const { g, k, x12 } = sample(A, B, Cc);
    const tol = 1e-7 * g.scale;
    concurrent = concurrent &&
      C.lineError(k.F, A, k.Pa) < tol &&
      C.lineError(k.F, B, k.Pb) < tol &&
      C.lineError(k.F, Cc, k.Pc) < tol;
    isX12 = isX12 && dist(k.F, x12) < 1e-8 * g.scale;
    // X(11) is the {X(1),X(5)}-harmonic conjugate of X(12): use a coordinate
    // along the line with I at 0 and N at 1.
    const d = point(k.N.x - k.I.x, k.N.y - k.I.y);
    const dd = d.x * d.x + d.y * d.y;
    if (dd > 1e-6) {
      const t = (p) => ((p.x - k.I.x) * d.x + (p.y - k.I.y) * d.y) / dd;
      const ti = t(k.Pi), tf = t(k.F);
      const cr = (ti / (ti - 1)) / (tf / (tf - 1));
      harmonic = harmonic && near(cr, -1, 1e-7);
    }
  }
  check("AFa, BFb and CFc meet at one point in 500 triangles", concurrent);
  check("that point is Kimberling X(12), not just any concurrence", isX12);
  check("Fi (X11) and F (X12) are harmonic conjugates in I and N", harmonic);
}

/* ------------------------- 6. claim 2: N, F, I, Fi lie on one line L(1, 5) */

{
  const cases = triangles(500, 2468024);
  let collinear = true, x11OnLine = true, distinct = true;
  for (const [A, B, Cc] of cases) {
    const { g, k } = sample(A, B, Cc);
    collinear = collinear && C.collinearError(k.N, k.I, k.F) < 1e-7;
    x11OnLine = x11OnLine && C.collinearError(k.N, k.I, k.Pi) < 1e-7;
    distinct = distinct && dist(k.N, k.I) > 1e-3;
  }
  check("N, I and F are collinear in 500 triangles", collinear);
  check("the Feuerbach point Fi is on that same line", x11OnLine);
  check("the sampled triangles keep N and I apart, so the line is defined", distinct);

  // The page's words "concurrent" for the four points mean collinear here.
  // The point it calls N is the nine-point centre X(5), while Fi is X(11).
  const { g, k } = sample(...triangles(1, 77)[0]);
  check("the page's N is the nine-point centre, not the contact point",
    dist(k.N, g.N) < 1e-8 * g.scale && dist(k.Pi, g.N) > g.r);
}

/* --------------------------------------- 7. degenerate and near-flat inputs */

{
  const flat = C.start({});
  flat.B = point(flat.A.x + 40, flat.A.y + 40 * (flat.C.y - flat.A.y) / (flat.C.x - flat.A.x));
  const flatGeom = C.compute(flat.A, flat.B, flat.C);
  check("a collinear triangle is reported invalid, not drawn as NaN", !flatGeom.valid);
  const equilateral = { A: point(100, 100), B: point(200, 100), C: point(150, 100 + 50 * Math.sqrt(3)) };
  check("an equilateral triangle has no unique Fi (the circles coincide)",
    !C.compute(equilateral.A, equilateral.B, equilateral.C).valid);
  const usual = C.compute(C.start({}).A, C.start({}).B, C.start({}).C);
  check("the opening triangle is valid and fully finite",
    usual.valid && Number.isFinite(usual.F.x) && Number.isFinite(usual.F.y));
  check("lineError is zero on the line and grows off it",
    C.lineError(point(5, 5), point(0, 0), point(10, 0)) === 5 &&
    C.lineError(point(5, 0), point(0, 0), point(10, 0)) === 0);
  check("collinearError measures the sine of the angle",
    near(C.collinearError(point(0, 0), point(1, 0), point(0, 1)), 1, 1e-12) &&
    C.collinearError(point(0, 0), point(1, 0), point(2, 0)) === 0);
}

done("feuerbach-incidence");
