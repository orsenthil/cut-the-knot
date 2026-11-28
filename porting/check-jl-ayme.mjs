#!/usr/bin/env node
"use strict";

/*
 * Logic test for jl-ayme/jl-ayme-core.js.
 *
 *   node porting/check-jl-ayme.mjs
 *
 * The page claims that the chord EF of the circle tangent to AD, CD and the
 * circumcircle of ABC passes through the incenter I. Its proof adds that
 * MN || EF, that M is the midpoint of the arc BC away from K, that J = AM ∩ EF
 * equals I, that AFJK is cyclic, that circle EJK touches AJ at J, that the
 * circle centred at M through B passes through I and is orthogonal to the
 * tangent circle, that ∠BKE = ∠MAC = ∠MBE, and that circle BKE touches BM at B.
 * Every one of these is tested, not copied, on a few hundred configurations.
 *
 * Section 2 is a second, literal transcription of the applet's bytecode:
 * GeoSDoub.ComputeAngle / FindOrientation / Rotate / Intersect /
 * FindAngleBisector / FindIncenter / FindCircumcenter / NearestPoint /
 * IntersectX / IntersectY / Dist / SqDist, plus JLAymeCanvas.GetTouchyCircle
 * and Compute. It is compared with the core over the whole generated family,
 * including the "Other" and det<1 quirks of the original.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("jl-ayme/jl-ayme-core.js", "JlAymeCore");

const { add, sub, scale, dot, cross, dist, foot, distToLine, intersection } = C;
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePt = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const collinear = (p, q, r, tol) => Math.abs(cross(sub(q, p), sub(r, p))) <= tol;
const parallel = (p, q, r, s, tol) => Math.abs(cross(sub(q, p), sub(s, r))) <= tol;
const onCircle = (p, circ, tol) =>
  !!circ && close(dist(p, circ.center), circ.radius, tol * Math.max(1, circ.radius));
const angle = (p, q, r) => {
  const a = sub(p, q), b = sub(r, q);
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (dist(p, q) * dist(r, q)))));
};

/** One assertion per claim, naming the first configuration that failed. */
function allAt(label, cases, fn, tolNote = "") {
  let bad = null;
  for (const args of cases) if (!fn(args) && !bad) bad = args;
  check(label + (bad ? ` (first failure ${JSON.stringify(bad)})` : ""), !bad, tolNote);
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("start: A is at (W/3, H/2.5)", s.A, { x: 400 / 3, y: 120 });
  equal("start: B is at (W/4, H−min/3)", s.B, { x: 100, y: 200 });
  equal("start: C is at (4W/5, H−min/3)", s.C, { x: 320, y: 200 });
  equal("start: D is at (2W/3, H−min/3)", s.D, { x: 400 * 2 / 3, y: 200 });
  equal("start: names on, statement and steps off",
    [s.showNames, s.showStatement, s.step1, s.step2, s.step3, s.step4],
    [true, false, false, false, false, false]);
  const w = C.start({ width: 600, height: 450 });
  equal("start: a 600×450 board uses the applet's unit", [w.B.y, w.A.y], [300, 180]);
  equal("start: an explicit position is copied, not shared", C.position(w).B, w.B);

  const mMoved = C.move(s, { point: "D", x: 200, y: 175 });
  check("move: B, C and D keep the same y, as the applet does",
    mMoved.B.y === 175 && mMoved.C.y === 175 && mMoved.D.y === 175);
  check("move: dragging D changes only its x and the shared y",
    mMoved.D.x === 200 && mMoved.A.x === s.A.x && mMoved.B.x === s.B.x);
  const aMoved = C.move(s, { point: "A", x: 150, y: 90 });
  check("move: A is free and leaves BC alone",
    aMoved.A.x === 150 && aMoved.A.y === 90 && aMoved.B.y === 200 && aMoved.C.y === 200);
  check("move: an unknown handle is refused", C.move(s, { point: "Z", x: 1, y: 2 }) === null);
  check("move: a non-finite coordinate is refused", C.move(s, { point: "B", x: NaN, y: 2 }) === null);
  const pos = C.position(s);
  pos.A.x = 999;
  check("position: plain data is a copy", s.A.x === 400 / 3);
  equal("result: the start position is a finished illustration, not a game",
    C.result(s), "done");
  check("result: no win or loss exists",
    C.result(s) !== "win" && C.result(s) !== "lose");
}

/* ------------------------------------------- 2. the applet's own construction,
 * transcribed a second time straight from the bytecode (no core calls here) */

const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const aDist = (p, q) => Math.sqrt(sq(p, q));
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

function aAngle(P, Q, R) { // GeoSDoub.ComputeAngle: angle at P
  const num = sq(P, Q) + sq(P, R) - sq(Q, R);
  const cos = num / 2 / (aDist(P, Q) * aDist(P, R));
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}
function aOrientation(P, Q, R) { // GeoSDoub.FindOrientation
  const s = R.x * (P.y - Q.y) + R.y * (Q.x - P.x) + P.x * Q.y - Q.x * P.y;
  return s > 0 ? 1 : -1;
}
function aRotate(P, Q, angle, sign) { // rotate Q around P
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - sign * sn * (Q.y - P.y),
    y: P.y + sign * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}
function aIntersect(P, Q, R, S) { // GeoSDoub.Intersect(P,Q,R,S), det cutoff 1
  const a1 = P.y - Q.y, b1 = Q.x - P.x, c1 = P.x * Q.y - P.y * Q.x;
  const a2 = R.y - S.y, b2 = S.x - R.x, c2 = R.x * S.y - R.y * S.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}
function aBisector(P, Q, R) { // GeoSDoub.FindAngleBisector: bisector at P
  const half = aAngle(P, Q, R) / 2;
  const sign = aOrientation(P, Q, R);
  return aIntersect(P, aRotate(P, Q, half, sign), Q, R);
}
function aIncenter(A, B, Cc) {
  const sign = aOrientation(A, B, Cc);
  return aIntersect(
    A, aRotate(A, B, aAngle(A, B, Cc) / 2, sign),
    B, aRotate(B, Cc, aAngle(B, Cc, A) / 2, sign),
  );
}
function aCircumcenter(A, B, Cc) {
  const mAB = mid(A, B), mBC = mid(B, Cc);
  const p = { x: mAB.x + B.y - A.y, y: mAB.y - (B.x - A.x) };
  const q = { x: mBC.x + Cc.y - B.y, y: mBC.y - (Cc.x - B.x) };
  return aIntersect(mAB, p, mBC, q);
}
function aNearestPoint(p, a, b) { // GeoSDoub.NearestPoint, incl. the 0.1 cutoff
  const dx = b.x - a.x, dy = b.y - a.y;
  if (sq(a, p) < 0.1) return { x: p.x, y: p.y };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
function aCircleLine(circ, a, b) { // GeoSDoub.Intersect(DoubCircle, DoubLine)
  const O = circ.center, R = circ.radius;
  const dy = a.y - b.y, dx = a.x - b.x;
  if (Math.abs(dy) > 1) {
    const m = dx / dy, q = b.x - m * b.y;
    const A = m * m + 1;
    const B = m * (q - O.x) - O.y;
    const Cc = O.y * O.y + (q - O.x) ** 2 - R * R;
    const disc = B * B - A * Cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const y1 = (-B + s) / A, y2 = (-B - s) / A;
    return [{ x: m * y1 + q, y: y1 }, { x: m * y2 + q, y: y2 }];
  }
  if (Math.abs(dx) > 1) {
    const m = dy / dx, q = b.y - m * b.x;
    const A = m * m + 1;
    const B = m * (q - O.y) - O.x;
    const Cc = O.x * O.x + (q - O.y) ** 2 - R * R;
    const disc = B * B - A * Cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const x1 = (-B + s) / A, x2 = (-B - s) / A;
    return [{ x: x1, y: m * x1 + q }, { x: x2, y: m * x2 + q }];
  }
  return null;
}
function aOther(points, K) {
  if (!points) return null;
  return aDist(points[0], K) < 1 ? points[1] : points[0];
}
function aCircleOf(center, P, Q, R) {
  return { center, radius: (aDist(center, P) + aDist(center, Q) + aDist(center, R)) / 3 };
}
/** JLAymeCanvas.GetTouchyCircle(D, A, C, circumcircle), instruction by instruction. */
function aTouchy(D, A, Cc, circ) {
  const Q = aBisector(D, A, Cc);
  const len = aDist(Q, D);
  const u = { x: (Q.x - D.x) / len, y: (Q.y - D.y) / len };
  const half = aAngle(D, A, Cc) / 2;
  const cos = Math.cos(half);
  const cos2 = cos * cos;                 // slot 13 is overwritten
  void aDist(D, circ.center);             // slot 11 is computed and never used
  const b = (D.x - circ.center.x) * u.x + (D.y - circ.center.y) * u.y +
    circ.radius * Math.sin(half);
  const c = sq(D, circ.center) - circ.radius * circ.radius;
  const disc = b * b - cos2 * c;
  if (disc < 0) return null;
  const t = (-b + Math.sqrt(disc)) / cos2;
  const center = { x: D.x + t * u.x, y: D.y + t * u.y };
  const radius = aDist(center, aNearestPoint(center, D, A));
  return { center, radius };
}
/** JLAymeCanvas.Compute, followed by J = AM ∩ EF from the page's proof. */
function aCompute(state) {
  const { A, B, C: Cc, D } = state;
  const circum = aCircleOf(aCircumcenter(A, B, Cc), A, B, Cc);
  const circleP = aTouchy(D, A, Cc, circum);
  if (!circleP) return null;
  const I = aIncenter(A, B, Cc);
  const E = aNearestPoint(circleP.center, B, Cc);
  const F = aNearestPoint(circleP.center, A, D);
  const t = circleP.radius / (circleP.radius - circum.radius);
  const K = { // ExtendLine(t, circum.center, P) = P + t·(O − P)
    x: circleP.center.x + t * (circum.center.x - circleP.center.x),
    y: circleP.center.y + t * (circum.center.y - circleP.center.y),
  };
  const M = aOther(aCircleLine(circum, K, E), K);
  const N = aOther(aCircleLine(circum, K, F), K);
  return {
    circum, circleP, I, E, F, K, M, N,
    J: M ? aIntersect(A, M, E, F) : null,
    AKF: aCircleOf(aCircumcenter(A, K, F), A, K, F),
    EIK: aCircleOf(aCircumcenter(E, K, I), E, K, I),
    BKE: aCircleOf(aCircumcenter(B, K, E), B, K, E),
    circleM: M ? { center: M, radius: aDist(M, B) } : null,
  };
}

/* ------------------------------------- 3. every page claim, over many triangles */

const random = rng(20261127);
const configs = [];
for (let i = 0; i < 20000 && configs.length < 260; i++) {
  const mirror = random() < 0.3;
  const y = 120 + random() * 180;
  const B = { x: 30 + random() * 110, y };
  const Cc = { x: 270 + random() * 120, y };
  const A = { x: 30 + random() * 340, y: random() * 105 };
  const fD = 0.05 + random() * 0.9;
  const D = { x: B.x + fD * (Cc.x - B.x), y };
  if (mirror) for (const p of [A, B, Cc, D]) p.x = 400 - p.x;
  const state = { A, B, C: Cc, D };
  const fig = C.figure(state);
  const sine = Math.abs(cross(sub(B, A), sub(Cc, A))) / (dist(A, B) * dist(A, Cc));
  const sineD = Math.abs(cross(sub(A, D), sub(Cc, D))) / (dist(A, D) * dist(Cc, D));
  if (!fig.valid || sine < 0.15 || sineD < 0.1 || fig.circumcircle.radius > 5000 ||
      fig.circleP.radius < 0.5 || fig.circleP.radius > 5000) continue;
  if (!aCompute(state)) continue;
  configs.push(state);
}
check("the generator found 260 non-degenerate configurations", configs.length === 260);
configs.push(C.start({})); // the applet's own opening picture
const figures = configs.map((s) => C.figure(s));
const refs = configs.map((s) => aCompute(s));

allAt("transcription: tangency circle centre and radius match the bytecode",
  configs.map((s, i) => [s, figures[i], refs[i]]),
  ([s, f, a]) => closePt(f.circleP.center, a.circleP.center, 1e-6 * Math.max(1, a.circleP.radius)) &&
    close(f.circleP.radius, a.circleP.radius, 1e-6 * Math.max(1, a.circleP.radius)));
allAt("transcription: circumcircle, incenter, E and F match",
  configs.map((s, i) => [s, figures[i], refs[i]]),
  ([s, f, a]) => closePt(f.circumcircle.center, a.circum.center, 1e-6 * Math.max(1, a.circum.radius)) &&
    close(f.circumcircle.radius, a.circum.radius, 1e-6 * a.circum.radius) &&
    closePt(f.I, a.I, 1e-6) && closePt(f.E, a.E, 1e-6) && closePt(f.F, a.F, 1e-6));
allAt("transcription: K, the two arc points and J match",
  configs.map((s, i) => [s, figures[i], refs[i]]),
  ([s, f, a]) => closePt(f.K, a.K, 1e-6) && closePt(f.M, a.M, 1e-6) &&
    closePt(f.N, a.N, 1e-6) && closePt(f.J, a.J, 1e-6));
allAt("transcription: the four auxiliary circles match",
  figures.map((f, i) => [f, refs[i]]),
  ([f, a]) => [["AKF", "AKF"], ["EIK", "EIK"], ["BKE", "BKE"], ["circleM", "circleM"]]
    .every(([x, y]) => closePt(f[x].center, a[y].center, 1e-5 * Math.max(1, a[y].radius)) &&
      close(f[x].radius, a[y].radius, 1e-5 * Math.max(1, a[y].radius))));

allAt("C1 touches AD at F and CD at E (page definition)",
  configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => closePt(f.F, foot(f.circleP.center, s.A, s.D), 1e-7) &&
    closePt(f.E, foot(f.circleP.center, s.B, s.C), 1e-7) &&
    close(distToLine(f.circleP.center, s.A, s.D), f.circleP.radius, 1e-7) &&
    close(distToLine(f.circleP.center, s.B, s.C), f.circleP.radius, 1e-7));
allAt("C1 touches the circumcircle internally at K (page definition)",
  figures.map((f) => f),
  (f) => onCircle(f.K, f.circumcircle, 1e-9) &&
    close(dist(f.circleP.center, f.circumcircle.center) + f.circleP.radius,
      f.circumcircle.radius, 1e-7 * f.circumcircle.radius) &&
    collinear(f.K, f.circleP.center, f.circumcircle.center, 1e-7 *
      Math.max(1, dist(f.K, f.circumcircle.center))));
allAt("the main claim: the chord EF passes through the incenter I",
  configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => distToLine(f.I, f.E, f.F) < 1e-6 * Math.max(1, dist(f.E, f.F)));
allAt("MN is parallel to EF (proof step 1)",
  figures.map((f) => f),
  (f) => parallel(f.M, f.N, f.E, f.F, 1e-6 * Math.max(1, dist(f.M, f.N))));
allAt("M and N lie on the circumcircle on the lines KE and KF",
  configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => onCircle(f.M, f.circumcircle, 1e-9) && onCircle(f.N, f.circumcircle, 1e-9) &&
    collinear(f.K, f.E, f.M, 1e-6 * Math.max(1, dist(f.K, f.M))) &&
    collinear(f.K, f.F, f.N, 1e-6 * Math.max(1, dist(f.K, f.N))));
allAt("M is the midpoint of arc BC and is away from K (proof step 1)",
  configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => close(dist(f.M, s.B), dist(f.M, s.C), 1e-6 * Math.max(1, dist(f.M, s.B))) &&
    cross(sub(s.C, s.B), sub(f.M, s.B)) * cross(sub(s.C, s.B), sub(f.K, s.B)) < 0);
allAt("AM is the bisector at A and contains I (proof step 1)",
  configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => collinear(s.A, f.M, f.I, 1e-6 * Math.max(1, dist(s.A, f.M))) &&
    close(angle(s.B, s.A, f.M), angle(f.M, s.A, s.C), 1e-6));
allAt("J = AM ∩ EF equals I (proof conclusion)",
  figures.map((f) => f),
  (f) => dist(f.J, f.I) < 1e-6 * Math.max(1, dist(f.I, f.E)));
allAt("A, F, J, K are concyclic (proof step 2)",
  figures.map((f) => f),
  (f) => onCircle(f.J, f.AKF, 1e-6));
allAt("circle EJK is tangent to AJ at J (proof step 3)",
  configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => close(dot(sub(f.EIK.center, f.J), sub(s.A, f.J)), 0,
    1e-5 * Math.max(1, dist(f.EIK.center, f.J) * dist(s.A, f.J))) &&
    dist(f.J, f.EIK.center) > 0);
allAt("circle centred at M through B passes through I (proof step 4)",
  figures.map((f) => f),
  (f) => onCircle(f.I, f.circleM, 1e-6));
allAt("that circle is orthogonal to C1 (proof step 4)",
  figures.map((f) => f),
  (f) => close(dist(f.M, f.circleP.center) ** 2,
    f.circleM.radius ** 2 + f.circleP.radius ** 2,
    1e-4 * Math.max(1, dist(f.M, f.circleP.center) ** 2)));
allAt("the three angles ∠BKE, ∠MAC and ∠MBE are equal (proof step 4)",
  configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => close(angle(s.B, f.K, f.E), angle(f.M, s.A, s.C), 1e-5) &&
    close(angle(s.B, f.K, f.E), angle(f.M, s.B, f.E), 1e-5));
allAt("circle BKE is tangent to BM at B (proof step 4)",
  configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => close(dot(sub(f.BKE.center, s.B), sub(f.M, s.B)), 0,
    1e-5 * Math.max(1, dist(f.BKE.center, s.B) * dist(f.M, s.B))));
allAt("the demo reports done throughout and never wins or loses",
  configs.map((s) => s),
  (s) => C.result(s) === "done" && C.result(s) !== "win" && C.result(s) !== "lose");

/* ------------------------- 4. the applet's awkward cases and the page's edits */

{
  // The live page today embeds a GeoGebra model, not the Java applet. The
  // lemma's wording is unchanged; the Java source is the authority for the
  // construction. These are the two numeric quirks kept from that source.
  check("quirk: Intersect refuses a determinant below 1",
    Number.isNaN(aIntersect({ x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: 0.5 }, { x: 1, y: 0.5 }).x));
  check("quirk: Other keeps the second circle hit when the first is within 1 of K",
    aOther([{ x: 0.5, y: 0 }, { x: 80, y: 0 }], { x: 0, y: 0 }).x === 80 &&
    aOther([{ x: 5, y: 0 }, { x: 80, y: 0 }], { x: 0, y: 0 }).x === 5);
  check("quirk: NearestPoint returns p itself within 0.1 of the line's start",
    aNearestPoint({ x: 1, y: 2 }, { x: 1, y: 2 }, { x: 8, y: 2 }).x === 1);
  // With a genuine circumcircle the quadratic always has a root; the guard
  // can only be reached with an impossible circle, which is why it stays dead.
  check("quirk: the quadratic returns no circle for a negative discriminant",
    aTouchy({ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 0 },
      { center: { x: 10 * Math.SQRT2, y: 0 }, radius: 10 }) === null);
  const flat = { A: { x: 5, y: 0 }, B: { x: 0, y: 0 }, C: { x: 100, y: 0 }, D: { x: 50, y: 0 } };
  check("a nearly collinear triangle is reported as not drawable",
    C.result(flat) === null && C.figure(flat).valid === false);
  const off = C.move(C.start({}), { point: "D", x: -30, y: 200 });
  check("D may be dragged off the segment BC, as in the applet", off.D.x === -30 && C.result(off) === "done");
  check("position keeps the checkbox state", C.position({ ...C.start({}), step4: true }).step4 === true);
}

done("jl-ayme");
