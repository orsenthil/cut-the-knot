#!/usr/bin/env node
"use strict";

/*
 * Logic test for angle-between-tangent-and-chord/angle-between-tangent-and-chord-core.js.
 *
 *   node porting/check-angle-between-tangent-and-chord.mjs
 *
 * Checks the moves and option switches, then the sangaku's claims over the
 * applet's opening picture, six hand-picked circles and 3,000 seeded random
 * ones: the radius is perpendicular to the tangent, I is the incenter and lies
 * on the circle at the midpoint of the small arc AB, the arcs AI' and BI' are
 * equal, and the angle between a tangent and a chord equals the inscribed
 * angle in the alternate segment (all four marked angles are equal to
 * 1/2 arccos(r/d)). Finally the applet's own GetTangents, FindIncenter,
 * GetIncircle and GeoSDoub circle/line routines are transcribed a second time,
 * straight from the bytecode, and compared on every configuration.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "angle-between-tangent-and-chord/angle-between-tangent-and-chord-core.js",
  "AngleBetweenTangentAndChordCore",
);

/* ------------------------------------------- a second transcription of the applet */

const plus = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const minus = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const len = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const clamp01 = (v) => Math.max(-1, Math.min(1, v));

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), literally. */
function appletLineIntersection(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return {
    x: (b1 * c2 - b2 * c1) / det,
    y: (c1 * a2 - c2 * a1) / det,
  };
}

/** GeoSDoub.IntersectCirclesX(DoubCircle,DoubCircle), from javap -c. */
function appletCirclesX(c1, r1, c2, r2) {
  const m = -(c1.y - c2.y) / (c1.x - c2.x);
  const b = (c1.x * c1.x - c2.x * c2.x + c1.y * c1.y - c2.y * c2.y - r1 * r1 + r2 * r2)
    / (2 * (c1.x - c2.x));
  const a = b - c1.x;
  const aa = m * m + 1;
  const bb = 2 * (m * a - c1.y);
  const cc = c1.y * c1.y + a * a - r1 * r1;
  const disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const y1 = (-bb + s) / (2 * aa), y2 = (-bb - s) / (2 * aa);
  return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
}

/** GeoSDoub.IntersectCirclesY(DoubCircle,DoubCircle), from javap -c. */
function appletCirclesY(c1, r1, c2, r2) {
  const m = -(c1.x - c2.x) / (c1.y - c2.y);
  const b = (c1.y * c1.y - c2.y * c2.y + c1.x * c1.x - c2.x * c2.x - r1 * r1 + r2 * r2)
    / (2 * (c1.y - c2.y));
  const a = b - c1.y;
  const aa = m * m + 1;
  const bb = 2 * (m * a - c1.x);
  const cc = c1.x * c1.x + a * a - r1 * r1;
  const disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const x1 = (-bb + s) / (2 * aa), x2 = (-bb - s) / (2 * aa);
  return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
}

/** GeoSDoub.Intersect(DoubCircle,DoubCircle): pick X, Y or the coincident quirk. */
function appletCircleIntersection(c1, r1, c2, r2) {
  if (Math.abs(c1.x - c2.x) > 1) return appletCirclesX(c1, r1, c2, r2);
  if (Math.abs(c1.y - c2.y) > 1) return appletCirclesY(c1, r1, c2, r2);
  return [{ ...c1 }, { ...c1 }];
}

/** AngleBetweenTangentAndChordCanvas.GetTangents(circle, C). */
function appletTangents(O, r, C) {
  const d = len(O, C);
  if (d < r) return null;
  if (d <= r + 0.1) return [{ ...C }, { ...C }];
  const t = Math.sqrt(d * d - r * r);
  return appletCircleIntersection(O, r, C, t);
}

/** GeoSDoub.ComputeAngle(A,B,C): the angle at A. */
function appletAngle(a, b, c) {
  const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const t = (sq(a, b) + sq(a, c) - sq(b, c)) / 2;
  return Math.acos(clamp01(t / (len(a, b) * len(a, c))));
}

/** GeoSDoub.FindOrientation(A,B,C): +1 for a left turn, -1 otherwise. */
function appletOrientation(a, b, c) {
  const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return v > 0 ? 1 : -1;
}

/** GeoSDoub.Rotate(p, about, angle, direction). */
function appletRotate(p, about, angle, direction) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return {
    x: about.x + co * (p.x - about.x) - direction * si * (p.y - about.y),
    y: about.y + direction * si * (p.x - about.x) + co * (p.y - about.y),
  };
}

/** GeoSDoub.FindIncenter(A,B,C), using the two rotated half-angle rays. */
function appletIncenter(A, B, C) {
  const angA = appletAngle(A, B, C), angB = appletAngle(B, C, A);
  const dir = appletOrientation(A, B, C);
  const rayA = appletRotate(B, A, angA / 2, dir);
  const rayB = appletRotate(C, B, angB / 2, dir);
  return appletLineIntersection(A, rayA, B, rayB);
}

/** GeoSDoub.NearestPoint(p, a, b): the perpendicular foot on side ab. */
function appletNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const sq = dx * dx + dy * dy;
  if (sq < 0.1) return { ...p };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / sq;
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** AngleBetweenTangentAndChordCanvas.GetIncircle(A,B,C,color): centre and radius. */
function appletIncircle(A, B, C) {
  const I = appletIncenter(A, B, C);
  const radius = (
    len(I, appletNearest(I, I, A)) +
    len(I, appletNearest(I, B, C)) +
    len(I, appletNearest(I, C, A))
  ) / 3;
  return { I, radius };
}

/* ------------------------------------------------------------- configurations */

const tri = (O, R, C) => ({ O, R, C });
const exact = [
  ["opening", C.start()],
  ["C above O (circle-intersection Y branch)", tri({ x: 180, y: 120 }, { x: 120, y: 120 }, { x: 180, y: 20 })],
  ["C to the left", tri({ x: 240, y: 130 }, { x: 180, y: 130 }, { x: 20, y: 60 })],
  ["small circle", tri({ x: 180, y: 120 }, { x: 166, y: 120 }, { x: 340, y: 30 })],
  ["large circle", tri({ x: 160, y: 130 }, { x: 40, y: 130 }, { x: 340, y: 20 })],
  ["C just outside", tri({ x: 180, y: 120 }, { x: 140, y: 120 }, { x: 225, y: 120 })],
  ["C far away", tri({ x: 100, y: 150 }, { x: 60, y: 150 }, { x: 350, y: 30 })],
];
// Circles with C exactly above O exercise GeoSDoub.Intersect's Y branch,
// chosen when the two circle centres have nearly equal x coordinates.
for (let i = 0; i < 12; i++) {
  const O = { x: 60 + i * 20, y: 60 + (i % 3) * 30 };
  const r = 18 + (i % 4) * 10;
  const R = { x: O.x - r, y: O.y };
  const C = { x: O.x, y: Math.min(232, O.y + r + 30 + i * 3) };
  exact.push([`C directly above O ${i}`, tri(O, R, C)]);
}
const random = [];
const next = rng(20261126);
for (let i = 0; i < 12000 && random.length < 3000; i++) {
  const O = { x: 30 + next() * 300, y: 30 + next() * 180 };
  const R = { x: 10 + next() * 340, y: 10 + next() * 220 };
  const P = { x: 10 + next() * 340, y: 10 + next() * 220 };
  const r = len(O, R);
  if (r < 18 || r > 110 || len(O, P) < r + 2) continue;
  random.push(tri(O, R, P));
}
const sample = [
  ...exact.map(([, state]) => state),
  ...random.map((state) => C.start(state)),
];
const yBranch = sample.filter((s) => Math.abs(s.O.x - s.C.x) <= 1).length;

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  const g = C.compute(s);
  check("the opening picture is the applet's starting arrangement",
    len(s.O, { x: 120, y: 160 }) < 1e-9 && len(s.R, { x: 60, y: 160 }) < 1e-9
      && len(s.C, { x: 300, y: 80 }) < 1e-9);
  check("the opening circle has radius 60 and C is outside it", g.valid && Math.abs(g.r - 60) < 1e-9 && g.d > g.r);
  check("a demo has no result until it has been explored", C.result(s) === null);
  check("names start on and the other two applet switches off",
    s.showNames === true && s.showStatement === false && s.showHint === false);
  equal("start counters", [s.moves, s.explored], [0, false]);
  check("legal moves cover three points, three switches and reset", C.legalMoves(s).length === 7);
}

/* ------------------------------------------------------ 2. moves and options */

{
  const s = C.start();
  const moved = C.move(s, { type: "point", name: "C", point: { x: 340, y: 40 } });
  check("dragging C moves only C and marks the picture explored",
    moved && moved.C.x === 340 && moved.C.y === 40 && moved.O.x === s.O.x && moved.R.x === s.R.x
      && C.result(moved) === "done");
  const off = C.move(s, { type: "point", name: "C", point: { x: 9999, y: -9999 } });
  check("a point dragged off the board is kept inside it",
    off && off.C.x <= C.WIDTH - 8 && off.C.y >= 8);
  const tiny = C.move(s, { type: "point", name: "R", point: { x: 119, y: 160 } });
  check("the radius point cannot collapse the circle", len(tiny.O, tiny.R) >= C.MIN_RADIUS - 1e-9);
  check("an unknown point or switch is refused",
    C.move(s, { type: "point", name: "X", point: s.O }) === null
      && C.move(s, { type: "option", key: "wrong", value: true }) === null);
  let t = s;
  for (const key of C.OPTION_KEYS) t = C.move(t, { type: "option", key, value: true });
  check("all three applet switches can be ticked",
    C.OPTION_KEYS.every((k) => t[k] === true) && t.moves === 3);
  check("switching does not move any of the three points",
    C.HANDLES.every((n) => len(s[n], t[n]) === 0));
  const reset = C.move(t, { type: "reset" });
  check("reset restores the opening points but keeps the switches",
    C.HANDLES.every((n) => len(s[n], reset[n]) === 0) && C.OPTION_KEYS.every((k) => reset[k] === true));
  check("moves do not change the position they were made from", s.moves === 0 && !s.explored && !s.showHint);
  const inside = C.compute(tri({ x: 180, y: 120 }, { x: 140, y: 120 }, { x: 190, y: 120 }));
  const near = C.compute(tri({ x: 180, y: 120 }, { x: 140, y: 120 }, { x: 220.03, y: 120 }));
  check("a point inside the circle, or within 0.1 of it, gives no drawing (applet NoDraw)",
    !inside.valid && inside.reason === "outside" && !near.valid && near.reason === "outside");
}

/* --------------------------------------- 3. the page's claims over every sample */

{
  let tangency = 0, onCircle = 0, IOnCircle = 0, arcMid = 0, arcsEqual = 0;
  let fourAngles = 0, bisectors = 0, alternate = 0, halfArc = 0, inradius = 0;
  let tangentLengths = 0, chordMidpoint = 0;
  let smallest = Infinity, largest = 0, minAngle = Infinity, maxAngle = 0;
  for (const state of sample) {
    const g = C.compute(state);
    if (!g.valid) throw new Error("a sample configuration has no tangents");
    const r = C.residuals(g);
    tangency = Math.max(tangency, r.tangent);
    onCircle = Math.max(onCircle, r.onCircle);
    IOnCircle = Math.max(IOnCircle, r.IOnCircle);
    arcMid = Math.max(arcMid, r.IAtArcMid);
    arcsEqual = Math.max(arcsEqual, r.arcsEqual);
    fourAngles = Math.max(fourAngles, r.fourAngles);
    bisectors = Math.max(bisectors, r.bisectors);
    alternate = Math.max(alternate, r.alternate);
    halfArc = Math.max(halfArc, r.halfArc);
    inradius = Math.max(inradius, r.inradius);
    tangentLengths = Math.max(tangentLengths, r.tangentLengths);
    chordMidpoint = Math.max(chordMidpoint, r.chordMidpoint);
    const ratio = g.d / g.r;
    smallest = Math.min(smallest, ratio);
    largest = Math.max(largest, ratio);
    for (const a of Object.values(g.angles)) {
      minAngle = Math.min(minAngle, a);
      maxAngle = Math.max(maxAngle, a);
    }
  }
  check("each tangent is perpendicular to the radius at A and B", tangency < 1e-7, `max ${tangency}`);
  check("A and B lie on the given circle", onCircle < 1e-7, `max ${onCircle}`);
  check("the two tangents from C have equal length", tangentLengths < 1e-7, `max ${tangentLengths}`);
  check("M is the midpoint of the chord AB", chordMidpoint < 1e-7, `max ${chordMidpoint}`);
  check("I is the incenter: equally far from AB, BC and CA", inradius < 1e-7, `max ${inradius}`);
  check(`the incenter lies on the given circle - all ${sample.length} configurations`,
    IOnCircle < 1e-7, `max ${IOnCircle}`);
  check("the incenter is the midpoint I' of the small arc AB", arcMid < 1e-7, `max ${arcMid}`);
  check("the arcs AI' and BI' are equal", arcsEqual < 1e-7, `max ${arcsEqual}`);
  check("the tangent-chord angle CAI' equals the inscribed angle ABI' (alternate segment)",
    alternate < 1e-7, `max ${alternate}`);
  check("all four angles CAI', I'AB, ABI' and I'BC are equal", fourAngles < 1e-7, `max ${fourAngles}`);
  check("AI' and BI' bisect the angles at A and B", bisectors < 1e-7, `max ${bisectors}`);
  check("each of the four angles is 1/2 arccos(r/d), i.e. half the arc AI'",
    halfArc < 1e-7, `max ${halfArc}`);
  check("the sample covers C near and far from the circle", smallest < 1.05 && largest > 4,
    `d/r from ${smallest.toFixed(3)} to ${largest.toFixed(1)}`);
  check("every marked angle is a real acute angle", minAngle > 0 && maxAngle < Math.PI / 2,
    `${minAngle.toFixed(4)}..${maxAngle.toFixed(4)} rad`);
  check("the sample exercises GeoSDoub's circle-intersection Y branch", yBranch > 10, `${yBranch} cases`);
}

/* --------------------------- 4. the applet's own bytecode, transcribed twice */

{
  let tangents = 0, centers = 0, incircles = 0, angles = 0, pairs = 0;
  for (const state of sample) {
    const g = C.compute(state);
    const pts = appletTangents(g.O, g.r, g.C);
    if (!pts || pts.length !== 2) throw new Error("the applet's GetTangents found no pair");
    const d1 = Math.max(len(pts[0], g.A), len(pts[1], g.B));
    const d2 = Math.max(len(pts[0], g.B), len(pts[1], g.A));
    tangents = Math.max(tangents, Math.min(d1, d2)); // A and B may be swapped
    pairs++;
    const I = appletIncenter(g.A, g.B, g.C);
    centers = Math.max(centers, len(I, g.I));
    const inc = appletIncircle(g.A, g.B, g.C);
    incircles = Math.max(incircles, Math.abs(inc.radius - g.shownInradius));
    angles = Math.max(
      angles,
      Math.abs(appletAngle(g.A, g.C, g.I) - g.angles.CAI),
      Math.abs(appletAngle(g.B, g.A, g.I) - g.angles.ABI),
      Math.abs(appletAngle(g.A, g.B, g.C) - C.angleAt(g.A, g.B, g.C)),
    );
  }
  check(`GetTangents' circle-circle construction matches the core on all ${sample.length} circles`,
    tangents < 1e-6, `max ${tangents}`);
  check("both tangent points were compared on every configuration", pairs === sample.length);
  check("GeoSDoub.FindIncenter matches the core's weighted incenter", centers < 1e-6, `max ${centers}`);
  check("GetIncircle's averaged radius matches the circle the applet draws", incircles < 1e-6, `max ${incircles}`);
  const opening = C.compute(C.start());
  check("the applet's NearestPoint(I,I,A) slip makes the drawn circle 2/3 of the true inradius",
    Math.abs(opening.shownInradius / opening.inradius - 2 / 3) < 1e-9,
    `${opening.shownInradius} vs ${opening.inradius}`);
  check("GeoSDoub.ComputeAngle matches the core's angleAt", angles < 1e-7, `max ${angles}`);
  const sampleState = C.start();
  const sg = C.compute(sampleState);
  const direct = appletCircleIntersection(sg.O, sg.r, sg.C, Math.sqrt(sg.d * sg.d - sg.r * sg.r));
  check("the transcribed circle intersection uses the X branch for the opening picture",
    Math.abs(sg.O.x - sg.C.x) > 1 && direct.length === 2
      && Math.min(Math.max(len(direct[0], sg.A), len(direct[1], sg.B)),
        Math.max(len(direct[0], sg.B), len(direct[1], sg.A))) < 1e-6);
}

done("angle-between-tangent-and-chord");
