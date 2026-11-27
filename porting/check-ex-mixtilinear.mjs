#!/usr/bin/env node
"use strict";

/*
 * Logic test for ex-mixtilinear/ex-mixtilinear-core.js.
 *
 *   node porting/check-ex-mixtilinear.mjs
 *
 * Checked: the applet's start position; the rules for moving K; and every
 * claim on the page over 180 generated triangles (acute, right, obtuse and
 * near-flat) at several positions of K each, including K at the incircle's
 * contact point. The page says that the two contact chords meet at the
 * A-excenter, that the two centres and that excenter are collinear, that the
 * constructed segment OL is perpendicular to BC and equal to the exradius,
 * and that at the incircle contact both circles have the exradius. All four
 * are tested, not quoted.
 *
 * Section 3 is a second, literal transcription of the applet's bytecode:
 * GeoSDoub.ComputeAngle / FindOrientation / Rotate / Intersect /
 * FindAngleBisector / Dist, QuadraticEquation.Solve2 and
 * ExMixtilinearCanvas.GetExMilti / Compute. It is compared with the core's
 * closed-form quadratic over all the same configurations, including the
 * |a| < 0.01 case where the applet draws no circle at all.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("ex-mixtilinear/ex-mixtilinear-core.js", "ExMixtilinearCore");

const { add, sub, scale, dot, cross, dist, unit, mid, foot, distToLine } = C;
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePt = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const onLine = (p, a, b, tol) => distToLine(p, a, b) <= tol;
const collinear = (p, q, r, tol) => Math.abs(cross(sub(q, p), sub(r, p))) <= tol;
const parallel = (p, q, r, s, tol) => Math.abs(cross(sub(q, p), sub(s, r))) <= tol;
const perpendicular = (p, q, r, s, tol) => Math.abs(dot(sub(q, p), sub(s, r))) <= tol;

/** One assertion per section, with the first failing configuration reported. */
function allAt(label, cases, fn, tolNote = "") {
  let bad = null;
  for (const args of cases) {
    if (!fn(args) && !bad) bad = args;
  }
  check(label + (bad ? ` (first failure ${JSON.stringify(bad)})` : ""), !bad, tolNote);
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("start: B is one tenth of the height left of centre", s.B, { x: 170, y: 105 });
  equal("start: C is at 1.5 units right and down", s.C, { x: 245, y: 120 });
  equal("start: A is at 0.5 units right and one unit up", s.A, { x: 215, y: 45 });
  equal("start: K is BC.CreateMidPoint(0.3)", s.K, { x: 192.5, y: 109.5 });
  equal("start: names are on, hint off", [s.showNames, s.showHint], [true, false]);

  const w = C.start({ width: 500, height: 400 });
  equal("start: 500x400 uses unit 40", [w.A.x, w.B.x, w.C.x], [270, 210, 310]);
  equal("start: an explicit position is copied, not shared", C.position(w).A, w.A);

  const moved = C.move(s, { point: "K", x: 10, y: 40 });
  check("move: K is projected back onto the line BC", onLine(moved.K, moved.B, moved.C, 1e-9));
  check("move: K stays far along the line when dragged past an endpoint", moved.K.x < moved.B.x);
  check("move: the other points are untouched", closePt(moved.A, s.A, 0) && closePt(moved.B, s.B, 0));
  check("move: an unknown handle is refused", C.move(s, { point: "Z", x: 1, y: 2 }) === null);
  check("move: a non-finite coordinate is refused", C.move(s, { point: "A", x: NaN, y: 2 }) === null);
  check("move: A can be dragged freely", C.move(s, { point: "A", x: 1, y: 2 }).A.x === 1);
  const pos = C.position(s);
  pos.A.x = 999;
  check("position: plain data is a copy", s.A.x === 215);
}

/* ------------------------------------------- 2. the applet's own construction,
 * straight from the bytecode (a second transcription, not a call to the core) */

const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const aDist = (p, q) => Math.sqrt(sq(p, q));

function aAngle(P, Q, R) {
  const num = sq(P, Q) + sq(P, R) - sq(Q, R);
  const cos = num / 2 / (aDist(P, Q) * aDist(P, R));
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}
function aOrientation(P, Q, R) {
  const s = R.x * (P.y - Q.y) + R.y * (Q.x - P.x) + P.x * Q.y - Q.x * P.y;
  return s > 0 ? 1 : -1;
}
function aRotate(P, Q, angle, sign) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - sign * sn * (Q.y - P.y),
    y: P.y + sign * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}
function aIntersect(P, Q, R, S) {
  const a1 = P.y - Q.y, b1 = Q.x - P.x, c1 = P.x * Q.y - P.y * Q.x;
  const a2 = R.y - S.y, b2 = S.x - R.x, c2 = R.x * S.y - R.y * S.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}
function aBisectorFoot(P, Q, R) {
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
function aExcenter(A, B, Cc) {
  const sign = aOrientation(B, A, Cc);
  return aIntersect(
    B, aRotate(B, Cc, (Math.PI - aAngle(B, A, Cc)) / 2, sign),
    Cc, aRotate(Cc, B, (Math.PI - aAngle(Cc, A, B)) / 2, -sign),
  );
}
function aCircumcenter(A, B, Cc) {
  const mAB = mid(A, B), mBC = mid(B, Cc);
  const rotAB = { x: mAB.x + B.y - A.y, y: mAB.y - (B.x - A.x) };
  const rotBC = { x: mBC.x + Cc.y - B.y, y: mBC.y - (Cc.x - B.x) };
  return aIntersect(mAB, rotAB, mBC, rotBC);
}
function aCircleOf(center, A, B, Cc, color) {
  return { x: center.x, y: center.y, r: (aDist(center, A) + aDist(center, B) + aDist(center, Cc)) / 3, color };
}
/* GetIncircle / GetExcircle average the distances to the three SIDES. */
function aCircleOfSides(center, A, B, Cc, color) {
  const r = (aDistToLine(center, A, B) + aDistToLine(center, B, Cc) + aDistToLine(center, Cc, A)) / 3;
  return { x: center.x, y: center.y, r, color };
}
/* GeoSDoub.Dist(DoubPoint, DoubLine): project the point onto the line. */
function aDistToLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (sq(p, a) < 0.1) return 0;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
}
/* QuadraticEquation.Solve2(a,b,c) solves a·t² + 2b·t + c = 0. */
function aSolve2(a, b, c) {
  if (Math.abs(a) < 0.01) return null;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  return [(-b + root) / a, (-b - root) / a];
}
const aExtend = (p, q) => ({ x: 2 * q.x - p.x, y: 2 * q.y - p.y });
/* ExMixtilinearCanvas.GetExMilti(A, Cc, vertex, K, Cc). */
function aGetExMilti(A, Cc, vertex, K) {
  const W = aExtend(A, K);
  const bis = aBisectorFoot(K, vertex, W);
  const v = sub(bis, K);
  const len = Math.hypot(v.x, v.y);
  const u = { x: v.x / len, y: v.y / len };
  const dx = K.x - Cc.x, dy = K.y - Cc.y;
  const R = Cc.r;
  const seed = add(K, u); // K + u: the applet evaluates the distance at t = 1
  const d = aDistToLine(seed, K, W);
  const roots = aSolve2(1 - d * d, u.x * dx + u.y * dy - R * d, dx * dx + dy * dy - R * R);
  if (!roots) return null;
  const t = roots[0] > 0 ? roots[0] : roots[1];
  return { x: K.x + u.x * t, y: K.y + u.y * t, r: d * t };
}
/* ExMixtilinearCanvas.Compute's derived points. */
function aCompute(state) {
  const { A, B, C: Cc, K } = state;
  const Ci = aCircleOfSides(aIncenter(A, B, Cc), A, B, Cc, "gray");
  const circum = aCircleOf(aCircumcenter(A, B, Cc), A, B, Cc, "gray");
  const Ce = aCircleOfSides(aExcenter(A, B, Cc), A, B, Cc, "gray");
  const CB = aGetExMilti(A, circum, B, K);
  const CC = aGetExMilti(A, circum, Cc, K);
  const V = foot(Ce, B, Cc);
  const W = aExtend(V, Ce);
  const bcB = CB ? foot(CB, B, Cc) : null;
  const akB = CB ? foot(CB, A, K) : null;
  const H = CB ? aIntersect(W, add(W, sub(akB, bcB)), B, Cc) : null;
  const O = H ? mid(W, H) : null;
  const finished = !!(CB && CC && Math.abs(CB.r / Ce.r - 1) < 0.01 && Math.abs(CC.r / Ce.r - 1) < 0.01);
  return { Ci, circum, Ce, CB, CC, V, W, H, O, bcB, akB, finished };
}

/* ------------------------------------- 3. every claim, over many triangles */

const random = rng(20261127);
const configs = [];
for (let i = 0; i < 1400 && configs.length < 180; i++) {
  // A above a slanted base, B and C below: a wide range of shapes and sizes,
  // plus a few mirrored ones. Near-degenerate triangles are skipped: the
  // applet's own quadratic refuses them, and they are covered separately.
  const mirror = random() < 0.25;
  const A = { x: 30 + random() * 340, y: 10 + random() * 120 };
  const B = { x: 10 + random() * 140, y: 110 + random() * 150 };
  const Cc = { x: 250 + random() * 140, y: 110 + random() * 150 };
  if (mirror) { A.x = 360 - A.x; B.x = 360 - B.x; Cc.x = 360 - Cc.x; }
  const t = 0.04 + random() * 0.92;
  const K = add(scale(B, 1 - t), scale(Cc, t));
  const s = { A, B, C: Cc, K, showNames: true, showHint: false };
  const f = C.figure(s);
  const sine = Math.abs(cross(sub(B, A), sub(Cc, A))) / (dist(A, B) * dist(A, Cc));
  if (!f.circumcircle || f.circumcircle.radius > 4000 || sine < 0.25 || f.exradius < 0.5 ||
      !f.circles.every((c) => c && c.radius > 0 && c.radius < 4000)) continue;
  configs.push(s);
}
check("the generator found 180 non-degenerate configurations", configs.length === 180);
// The fixed triangle used below is also one of the applet's own examples.
const special = { A: { x: 100, y: 20 }, B: { x: 20, y: 120 }, C: { x: 180, y: 140 } };
const specialK = { x: 91.9826099465, y: 128.9978262433 };
configs.push({ ...special, K: specialK, showNames: true, showHint: false });
const figures = configs.map((s) => C.figure(s));

allAt("circumcircle is equidistant from A, B, C", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => f.circumcircle && close(dist(f.circumcircle.center, s.A), f.circumcircle.radius, 1e-7 * f.circumcircle.radius));
allAt("incenter is equidistant from all three sides", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => close(distToLine(f.incenter, s.A, s.B), distToLine(f.incenter, s.B, s.C), 1e-7) &&
               close(distToLine(f.incenter, s.B, s.C), distToLine(f.incenter, s.C, s.A), 1e-7));
allAt("excenter is equidistant from all three sides", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => close(distToLine(f.excenter, s.A, s.B), f.exradius, 1e-7) &&
               close(distToLine(f.excenter, s.B, s.C), f.exradius, 1e-7) &&
               close(distToLine(f.excenter, s.C, s.A), f.exradius, 1e-7));
allAt("excenter is on the far side of BC from A", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => cross(sub(s.C, s.B), sub(s.A, s.B)) * cross(sub(s.C, s.B), sub(f.excenter, s.B)) < 0);

allAt("each circle touches AK and BC at the reported radius", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => f.circles.every((circle) => circle && close(distToLine(circle.center, s.A, s.K), circle.radius, 1e-6) &&
    close(distToLine(circle.center, s.B, s.C), circle.radius, 1e-6)));
allAt("each circle touches the circumcircle externally", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => f.circles.every((circle) => circle && close(dist(circle.center, f.circumcircle.center),
    f.circumcircle.radius + circle.radius, 1e-6 * Math.max(1, circle.radius))));
allAt("the two contact chords pass through the excenter E (page claim *)", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => f.circles.every((circle) => circle && circle.radius > 0 &&
    distToLine(f.excenter, circle.bc, circle.ak) < 1e-6 * Math.max(1, dist(circle.bc, circle.ak))));
allAt("the two circle centres and E are collinear", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => f.circles.every((c) => c && Number.isFinite(c.radius)) &&
    distToLine(f.excenter, f.circles[0].center, f.circles[1].center) <
      1e-6 * Math.max(1, dist(f.circles[0].center, f.circles[1].center)));
allAt("V is the foot from E and W is one radius beyond E", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => closePt(f.V, foot(f.excenter, s.B, s.C), 1e-7) && closePt(f.W, aExtend(f.V, f.excenter), 1e-7));
allAt("OL is perpendicular to BC and equals the exradius (any K)", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => f.O && f.circles[0] && perpendicular(f.O, f.circles[0].bc, s.B, s.C, 1e-6) &&
    close(dist(f.O, f.circles[0].bc), f.exradius, 1e-5 * f.exradius));
allAt("the L of that construction is the midpoint of VH", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => f.circles[0] && closePt(f.circles[0].bc, mid(f.V, f.H), 1e-6));
allAt("A, the incenter and E are collinear for any triangle", configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => collinear(s.A, f.incenter, f.excenter, 1e-6 * Math.max(1, dist(s.A, f.excenter))));

const snapConfigs = configs.map((s) => ({ ...s, K: C.snapToIncircle(s).K }));
const snapFigures = snapConfigs.map((s) => C.figure(s));
allAt("homothety at A sends the incenter to E and the contact K to W",
  snapConfigs.length ? snapConfigs.map((s, i) => [s, snapFigures[i]]) : [],
  ([s, f]) => collinear(s.A, f.incenter, f.excenter, 1e-6 * Math.max(1, dist(s.A, f.excenter))) &&
    collinear(s.A, s.K, f.W, 1e-6 * Math.max(1, dist(s.A, f.W))) &&
    close(dist(s.A, f.excenter) / dist(s.A, f.incenter), dist(s.A, f.W) / dist(s.A, s.K), 1e-5));
allAt("at the incircle contact both radii equal the exradius", snapConfigs.map((s, i) => [s, snapFigures[i]]),
  ([s, f]) => f.circles.every((c) => c && close(c.radius, f.exradius, 1e-6 * f.exradius)));
allAt("at the contact the constructed O is the centre of the first circle", snapConfigs.map((s, i) => [s, snapFigures[i]]),
  ([s, f]) => closePt(f.circles[0].center, f.O, 1e-5));
allAt("at the contact the second circle has its own matching midpoint construction",
  snapConfigs.map((s, i) => [s, snapFigures[i]]),
  ([s, f]) => {
    const parallel = add(f.W, sub(f.circles[1].ak, f.circles[1].bc));
    const h2 = C.intersection(f.W, parallel, s.B, s.C);
    return h2 && closePt(mid(f.W, h2), f.circles[1].center, 1e-5);
  });
allAt("the equal-radius signal appears at the contact, not elsewhere",
  configs.map((s, i) => [s, figures[i]]),
  ([s, f]) => f.finished === f.circles.every((c) => c && Math.abs(c.radius / f.exradius - 1) < 0.01));
allAt("the demo has no win or loss; only the discovered signal is done",
  configs.map((s, i) => [s, snapConfigs[i], figures[i], snapFigures[i]]),
  ([s, snapped, f, sf]) => C.result(s) !== "win" && C.result(s) !== "lose" &&
    (f.finished ? C.result(s) === "done" : C.result(s) === null) && C.result(snapped) === "done");
allAt("K stays on BC after snapping", snapConfigs.map((s) => s),
  (s) => onLine(s.K, s.B, s.C, 1e-8));

/* Pinned against the running Java applet's Compute() for this exact triangle. */
{
  const f = snapFigures[snapFigures.length - 1];
  const ref = { ra: 158.5023247878, rb: 158.5023247876, rc: 158.5023247880 };
  check("pinned: exradius for the fixed triangle", close(f.exradius, ref.ra, 1e-6), `${f.exradius}`);
  check("pinned: first circle radius", close(f.circles[0].radius, ref.rb, 1e-6), `${f.circles[0].radius}`);
  check("pinned: second circle radius", close(f.circles[1].radius, ref.rc, 1e-6), `${f.circles[1].radius}`);
}

/* ------------------------------------------- 4. against the bytecode again */

const literal = configs.map((s) => aCompute(s));
allAt("transcription: incenter, circumcenter and excenter agree with the core",
  configs.map((s, i) => [s, figures[i], literal[i]]),
  ([s, f, a]) => closePt(f.incenter, a.Ci, 1e-6) && closePt(f.circumcircle.center, a.circum, 1e-6) &&
    closePt(f.excenter, a.Ce, 1e-6) && close(f.exradius, a.Ce.r, 1e-6));
allAt("transcription: both circle centres and radii agree with the core",
  figures.map((f, i) => [f, literal[i]]),
  ([f, a]) => [0, 1].every((k) => (f.circles[k] === null) === (a[k === 0 ? "CB" : "CC"] === null) &&
    (!f.circles[k] || (closePt(f.circles[k].center, a[k === 0 ? "CB" : "CC"], 1e-5) &&
      close(f.circles[k].radius, a[k === 0 ? "CB" : "CC"].r, 1e-5 * Math.max(1, a[k === 0 ? "CB" : "CC"].r))))));
allAt("transcription: both contact points agree with the core",
  configs.map((s, i) => [s, figures[i], literal[i]]),
  ([s, f, a]) => (!f.circles[0] || (closePt(f.circles[0].bc, a.bcB, 1e-5) && closePt(f.circles[0].ak, a.akB, 1e-5))) &&
    (!f.circles[1] || (!a.CC ||
      (closePt(f.circles[1].bc, foot(a.CC, s.B, s.C), 1e-5) && closePt(f.circles[1].ak, foot(a.CC, s.A, s.K), 1e-5)))));
allAt("transcription: V, W, H, O and the finished flag agree with the core",
  figures.map((f, i) => [f, literal[i]]),
  ([f, a]) => closePt(f.V, a.V, 1e-6) && closePt(f.W, a.W, 1e-6) && closePt(f.H, a.H, 1e-5) &&
    closePt(f.O, a.O, 1e-5) && f.finished === a.finished);
{
  // The applet's Solve2 rejects a coefficient below 0.01; check the core keeps
  // that quirk instead of inventing an enormous circle.
  const flat = {
    A: { x: 68.4061563015, y: 105.2685946738 }, B: { x: 51.1562620569, y: 120.9898870392 },
    C: { x: 326.2667160667, y: 160.8349211747 }, K: { x: 206.7823636745, y: 143.5296605772 },
  };
  const f = C.figure(flat), a = aCompute(flat);
  check("transcription: near-parallel AK and BC draws no first circle", f.circles[0] === null && a.CB === null);
  check("transcription: the second circle still exists", !!f.circles[1] && !!a.CC &&
    closePt(f.circles[1].center, a.CC, 1e-5));
  check("Solve2's 0.01 cutoff is present in the transcription", aSolve2(0.005, 1, 1) === null);
}

done("ex-mixtilinear");
