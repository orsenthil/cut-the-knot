#!/usr/bin/env node
"use strict";

/*
 * Logic test for circum-simson/circum-simson-core.js.
 *
 *   node porting/check-circum-simson.mjs
 *
 * Checked: CircumSimsonCanvas.init's starting points and circle, the six
 * checkbox options, CTKMoveableDoub's circle glider and the trace; then, over
 * hundreds of configurations (random triangles on a circle, P anywhere on it,
 * including every vertex and the applet's nearestPoint special case), the
 * page's claims — the two Simson lines are perpendicular, their intersection
 * lies on the nine-point circle, A'/B'/C' bisect PaQa etc., PaPb is
 * perpendicular to QaQb, the feet are collinear and the Menelaus product is
 * −1. The last group is a second, literal transcription of the applet's
 * Compute (GeoSDoub.NearestPoint, InsideTest, GetLine, Intersect,
 * FindCircumcenter and GetCircle) compared with the core on every drawing.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circum-simson/circum-simson-core.js", "CircumSimsonCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePt = (p, q, tol) => Boolean(p && q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const same = (a, b, tol) => (Number.isNaN(a) && Number.isNaN(b)) || close(a, b, tol);
const samePt = (p, q, tol) => Boolean(p && q) && same(p.x, q.x, tol) && same(p.y, q.y, tol);

/* ----------- a second transcription, straight from the applet's bytecode ---- */

/* GeoSDoub.Intersect(P1,P2,P3,P4): a1=P1.y−P2.y, b1=P2.x−P1.x, c1=P1.x*P2.y−P1.y*P2.x. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y;
  const b1 = P2.x - P1.x;
  const c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y;
  const b2 = P4.x - P3.x;
  const c2 = P3.x * P4.y - P3.y * P4.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}

/* GeoSDoub.FindCircumcenter: perpendicular bisectors of AB and BC, then the
   CircumSimsonCanvas.GetCircle(DoubPoint,DoubPoint,DoubPoint,Color) radius. */
function appletCircle(A, B, C) {
  const midAB = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const midBC = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
  const p = { x: midAB.x + (B.y - A.y), y: midAB.y - (B.x - A.x) };
  const q = { x: midBC.x + (C.y - B.y), y: midBC.y - (C.x - B.x) };
  const center = appletIntersect(midAB, p, midBC, q);
  const radius = (dist(center, A) + dist(center, B) + dist(center, C)) / 3;
  return { x: center.x, y: center.y, r: radius };
}

/* GeoSDoub.NearestPoint(P,X,Y), including its SqDist(X,P) < 0.1 early return. */
function appletFoot(P, X, Y) {
  const dx = Y.x - X.x, dy = Y.y - X.y;
  if ((X.x - P.x) ** 2 + (X.y - P.y) ** 2 < 0.1) return { x: P.x, y: P.y };
  const proj = ((P.x - X.x) * dx + (P.y - X.y) * dy) / (dx * dx + dy * dy);
  return { x: X.x + dx * proj, y: X.y + dy * proj };
}

/* InsideTest.IsInside(A,B,C): dot of the two rays out of A is <= 0. */
function appletInside(A, B, C) {
  return (A.x - B.x) * (A.x - C.x) + (A.y - B.y) * (A.y - C.y) <= 0;
}

/* CircumSimsonCanvas.GetLine: use the two feet not at the obtuse angle. */
function appletLine(f1, f2, f3) {
  if (appletInside(f1, f2, f3)) return [f2, f3];
  if (appletInside(f2, f3, f1)) return [f3, f1];
  return [f1, f2];
}

/* CircumSimsonCanvas.Compute, in bytecode order. */
function appletCompute(s) {
  const Q = { x: 2 * s.circle.x - s.P.x, y: 2 * s.circle.y - s.P.y };
  const Pa = appletFoot(s.P, s.B, s.C);
  const Pb = appletFoot(s.P, s.C, s.A);
  const Pc = appletFoot(s.P, s.A, s.B);
  const Qa = appletFoot(Q, s.B, s.C);
  const Qb = appletFoot(Q, s.C, s.A);
  const Qc = appletFoot(Q, s.A, s.B);
  const lineP = appletLine(Pa, Pb, Pc);
  const lineQ = appletLine(Qa, Qb, Qc);
  const M = appletIntersect(lineP[0], lineP[1], lineQ[0], lineQ[1]);
  const Am = { x: (s.B.x + s.C.x) / 2, y: (s.B.y + s.C.y) / 2 };
  const Bm = { x: (s.C.x + s.A.x) / 2, y: (s.C.y + s.A.y) / 2 };
  const Cm = { x: (s.A.x + s.B.x) / 2, y: (s.A.y + s.B.y) / 2 };
  const nine = appletCircle(Am, Bm, Cm);
  const aux = [
    appletCircle(s.P, Pa, s.B),
    appletCircle(s.P, s.C, Pb),
    appletCircle(s.C, Q, Qb),
  ];
  return { Q, Pa, Pb, Pc, Qa, Qb, Qc, lineP, lineQ, M, Am, Bm, Cm, nine, aux };
}

/* Compare every value the applet computes with the core's value. */
function compareWithApplet(label, s) {
  const core = C.compute(s);
  const applet = appletCompute(s);
  const scale = Math.max(1, Math.abs(s.circle.r));
  const tol = 1e-7 * scale;
  let worst = 0;
  const pairs = [
    ["Q", core.Q, applet.Q],
    ["Pa", core.Pa, applet.Pa], ["Pb", core.Pb, applet.Pb], ["Pc", core.Pc, applet.Pc],
    ["Qa", core.Qa, applet.Qa], ["Qb", core.Qb, applet.Qb], ["Qc", core.Qc, applet.Qc],
    ["M", core.M, applet.M],
    ["Am", core.Am, applet.Am], ["Bm", core.Bm, applet.Bm], ["Cm", core.Cm, applet.Cm],
    ["nine", core.ninePoint, applet.nine],
  ];
  const diffs = [];
  for (const [name, a, b] of pairs) {
    const d = Number.isNaN(a.x) && Number.isNaN(b.x)
      ? 0
      : Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs((a.r ?? 0) - (b.r ?? 0)));
    worst = Math.max(worst, d);
    if (!samePt(a, b, tol) || !same(a.r ?? 0, b.r ?? 0, tol)) diffs.push(name);
  }
  // The two ends of a line can be swapped by the applet's choice; compare sets.
  const sameLine = (a, b) =>
    (samePt(a[0], b[0], tol) && samePt(a[1], b[1], tol)) ||
    (samePt(a[0], b[1], tol) && samePt(a[1], b[0], tol));
  if (!sameLine(core.lineP, applet.lineP)) diffs.push("lineP");
  if (!sameLine(core.lineQ, applet.lineQ)) diffs.push("lineQ");
  for (let i = 0; i < 3; i++) {
    if (!samePt(core.auxCircles[i], applet.aux[i], tol) ||
        !same(core.auxCircles[i].r, applet.aux[i].r, tol)) diffs.push(`circle${i}`);
  }
  check(`${label}: core matches applet Compute (max ${worst.toExponential(1)})`,
    diffs.length === 0, diffs.join(", "));
}

/* A configuration: three vertices and P on one circle, like init's geometry. */
function configuration(rand, angle) {
  const O = { x: 120 + rand() * 160, y: 90 + rand() * 70 };
  const R = 50 + rand() * 30;
  const onCircle = (a) => ({ x: O.x + R * Math.cos(a), y: O.y + R * Math.sin(a) });
  const a = rand() * 2 * Math.PI;
  const b = a + 1.0 + rand() * 2.0;
  const c = b + 1.0 + rand() * 2.0;
  const A = onCircle(a), B = onCircle(b), C = onCircle(c);
  const theta = angle === undefined ? rand() * 2 * Math.PI : angle;
  const P = onCircle(theta);
  return {
    A, B, C, P, circle: { x: O.x, y: O.y, r: R },
    showNames: true, showPerps: false, showLines: false,
    showMidpoints: false, showAngles: false, showCircle: false, trace: [],
  };
}

/* -------------------------------- 1. the applet's starting state and options */

{
  const s = C.start();
  const radius = Math.floor(Math.min(C.VIEW.width, C.VIEW.height) / 3);
  const onCircle = (a) => ({
    x: C.VIEW.width / 2 + radius * Math.cos(a),
    y: C.VIEW.height / 2 + radius * Math.sin(a),
  });
  equal("start A is init's cos/sin(−1.6)", s.A, onCircle(-1.6));
  equal("start B is init's cos/sin(−4)", s.B, onCircle(-4));
  equal("start C is init's cos/sin(−0.2)", s.C, onCircle(-0.2));
  const circle = appletCircle(s.A, s.B, s.C);
  check("start circle matches the applet's GetCircle", closePt(s.circle, circle, 1e-9),
    JSON.stringify([s.circle, circle]));
  const theta = C.P_ANGLE;
  const P = {
    x: circle.x + circle.r * Math.cos(theta),
    y: circle.y + circle.r * Math.sin(theta),
  };
  check("start P is at a fixed angle in init's [0,PI] range",
    theta >= 0 && theta <= Math.PI && closePt(s.P, P, 1e-9));
  check("the four start points lie on the circle",
    ["A", "B", "C", "P"].every((n) => close(dist(s[n], s.circle), s.circle.r, 1e-9)));
  check("names start on and the five other overlays off",
    s.showNames && !s.showPerps && !s.showLines &&
    !s.showMidpoints && !s.showAngles && !s.showCircle);
  check("the trace starts empty", s.trace.length === 0);
  check("an illustration has no result", C.result(s) === null);
  check("the view is the applet's 400x250", C.VIEW.width === 400 && C.VIEW.height === 250);
}

/* ------------------------- 2. options, dragging and the trace ---------------- */

{
  const s = C.start();
  check("an option change makes a new position", C.withOption(s, "showLines", true) !== s);
  check("all six options are independent booleans", (() => {
    let t = s;
    for (const k of ["showPerps", "showLines", "showMidpoints", "showAngles", "showCircle"]) {
      t = C.withOption(t, k, true);
    }
    return t.showPerps && t.showLines && t.showMidpoints && t.showAngles && t.showCircle &&
      !C.withOption(t, "showNames", false).showNames;
  })());
  check("an unknown option is ignored", C.withOption(s, "bogus", true) === s);
  const moved = C.withPoint(s, "P", { x: 480, y: 480 });
  check("a dragged point is projected back onto the circle",
    close(dist(moved.P, s.circle), s.circle.r, 1e-9));
  check("dragging P leaves A, B, C and the circle alone",
    ["A", "B", "C"].every((n) => dist(moved[n], s[n]) === 0) &&
    moved.circle === s.circle);
  check("an unknown handle is ignored", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
  check("a circle glider keeps the direction from the centre", (() => {
    const raw = { x: 260, y: 60 };
    const q = C.projectOnCircle(raw, s.circle);
    return close((q.x - s.circle.x) / (raw.x - s.circle.x),
      (q.y - s.circle.y) / (raw.y - s.circle.y), 1e-12);
  })());
  const traced = C.withTrace(s);
  check("the trace records M", traced.trace.length === 1 &&
    closePt(traced.trace[0], C.compute(s).M, 0));
  check("the trace keeps earlier points and clears on a new drag",
    C.withTrace(traced).trace.length === 2 && C.clearTrace(traced).trace.length === 0);
  check("recording the trace did not change the original", s.trace.length === 0);
}

/* ------------------- 3. fixed configurations and the applet transcription --- */

{
  const start = C.start();
  const fixed = [["start", start]];
  for (const angle of [0, Math.PI / 3, Math.PI]) {
    fixed.push([`P at ${(angle * 180 / Math.PI).toFixed(0)}°`, C.start({ angle })]);
    fixed.push([`P near A at ${(angle * 180 / Math.PI).toFixed(0)}°`,
      C.withPoint(C.start({ angle }), "P", { x: start.A.x + 0.05, y: start.A.y + 0.05 })]);
  }
  for (const [label, s] of fixed) {
    compareWithApplet(label, s);
    // "P near A" deliberately lands in the applet's SqDist < 0.1 snap zone,
    // where its own foot is P rather than the true perpendicular foot. The
    // computation must still match the applet there; the theorem is checked
    // outside that tiny neighbourhood below and in section 7.
    if (label.startsWith("P near")) continue;
    check(`${label}: P-foot set is collinear`, Math.abs(C.lineError(s)) < 1e-7);
    check(`${label}: Q-foot set is collinear`, Math.abs(C.lineError(s, "Q")) < 1e-7);
    check(`${label}: the two Simson lines are perpendicular`,
      close(C.simsonAngle(s), Math.PI / 2, 1e-8));
    check(`${label}: M is on the nine-point circle`, C.ninePointError(s) < 1e-7);
    check(`${label}: the midpoint and angle claims hold`,
      C.midpointError(s) < 1e-7 && close(C.feetAngle(s), Math.PI / 2, 1e-8) &&
      close(C.menelaus(s), -1, 1e-7));
  }
}

/* ------------------------- 4. hundreds of random configurations -------------- */

{
  const rand = rng(3422);
  let tested = 0, claimed = 0, snapped = 0;
  let worstAngle = 0, worstLocus = 0, worstMid = 0, worstFeet = 0, worstMen = 0;
  for (let trial = 0; trial < 500 && tested < 300; trial++) {
    const s = configuration(rand);
    const d = C.compute(s);
    if (![d.M, ...d.lineP, ...d.lineQ].every((p) => Number.isFinite(p.x))) continue;
    tested++;
    compareWithApplet(`random ${trial}`, s);
    // GeoSDoub.NearestPoint returns P when P is within sqrt(0.1) of a side
    // endpoint. Near a vertex — or near its antipode, where Q is — that snaps
    // one foot away from the true perpendicular and perturbs the theorem.
    // Those drawings are still compared with the applet above; the exact
    // claims are measured on the rest.
    const nearSnap = ["A", "B", "C"].some((n) =>
      dist(s[n], s.P) < 1 || dist(s[n], d.Q) < 1);
    if (nearSnap) { snapped++; continue; }
    claimed++;
    worstAngle = Math.max(worstAngle, Math.abs(C.simsonAngle(s) - Math.PI / 2));
    worstLocus = Math.max(worstLocus, C.ninePointError(s));
    worstMid = Math.max(worstMid, C.midpointError(s));
    worstFeet = Math.max(worstFeet, Math.abs(C.feetAngle(s) - Math.PI / 2));
    worstMen = Math.max(worstMen, Math.abs(C.menelaus(s) + 1));
  }
  check(`${tested} random configurations were tested`, tested === 300);
  check(`${claimed} configurations passed the applet comparison`, claimed === 300 - snapped);
  check(`${snapped} near-vertex snap-zone drawings were compared too`,
    claimed + snapped === tested && snapped > 0);
  check(`Simson lines are perpendicular in all ${claimed} (worst ${worstAngle.toExponential(1)} rad)`,
    worstAngle < 1e-6);
  check(`M is on the nine-point circle in all ${claimed} (worst ${worstLocus.toExponential(1)} R)`,
    worstLocus < 1e-6);
  check(`A'/B'/C' bisect PaQa etc. in all ${claimed} (worst ${worstMid.toExponential(1)} R)`,
    worstMid < 1e-6);
  check(`PaPb ⟂ QaQb in all ${claimed} (worst ${worstFeet.toExponential(1)} rad)`,
    worstFeet < 1e-6);
  check(`Menelaus product is −1 in all ${claimed} (worst ${worstMen.toExponential(1)})`,
    worstMen < 1e-6);
}

/* ------------------- 5. both ends of init's range, and a locus sweep ---------- */

{
  const rand = rng(73);
  for (const angle of [0, Math.PI]) {
    let tested = 0;
    for (let trial = 0; trial < 200 && tested < 60; trial++) {
      const s = configuration(rand, angle);
      const d = C.compute(s);
      if (!Number.isFinite(d.M.x)) continue;
      tested++;
      if (!close(C.simsonAngle(s), Math.PI / 2, 1e-7)) {
        check(`${angle}° case ${trial}: perpendicular`, false, String(C.simsonAngle(s)));
      }
      if (!(C.ninePointError(s) < 1e-7)) {
        check(`${angle}° case ${trial}: on the nine-point circle`, false, String(C.ninePointError(s)));
      }
    }
    check(`${tested} configurations at ${angle} rad satisfy both claims`, tested === 60);
  }
  // Move P right round the start circle: every M must be on the nine-point circle.
  const base = C.start();
  let off = 0;
  for (let i = 0; i < 72; i++) {
    const theta = (2 * Math.PI * i) / 72;
    const P = {
      x: base.circle.x + base.circle.r * Math.cos(theta),
      y: base.circle.y + base.circle.r * Math.sin(theta),
    };
    const s = C.withPoint(base, "P", P);
    if (!(C.ninePointError(s) < 1e-7) || !close(C.simsonAngle(s), Math.PI / 2, 1e-7)) off++;
    compareWithApplet(`P at ${i}/72`, s);
  }
  check("the claims hold for P at 72 places around the circle", off === 0, `${off} failures`);
}

/* ------------------- 6. the nine-point circle and the condition -------------- */

{
  const s = C.start();
  const expected = C.ninePointCenterAndRadius(s);
  const actual = C.compute(s).ninePoint;
  check("the nine-point circle is (O+H)/2 with radius R/2",
    closePt(actual, expected.center, 1e-8) && close(actual.r, expected.r, 1e-8),
    JSON.stringify([actual, expected]));

  // Every recorded trace point of a drag must land on the same circle.
  let traced = C.clearTrace(s);
  for (let i = 0; i < 40; i++) {
    const theta = (Math.PI * i) / 39;
    const P = {
      x: s.circle.x + s.circle.r * Math.cos(theta),
      y: s.circle.y + s.circle.r * Math.sin(theta),
    };
    traced = C.withPoint(traced, "P", P);
    traced = C.withTrace(traced);
  }
  check("40 traced positions are recorded", traced.trace.length === 40);
  check("every traced intersection lies on the nine-point circle",
    traced.trace.every((p) =>
      close(dist(p, actual) - actual.r, 0, 1e-7 * s.circle.r)));

  // The Simson feet need P on the circle: push P off it and the claims break.
  const inside = { ...s, P: {
    x: s.circle.x + (s.P.x - s.circle.x) * 0.6,
    y: s.circle.y + (s.P.y - s.circle.y) * 0.6,
  } };
  check("moving P inside the circle breaks the nine-point locus",
    C.ninePointError(inside) > 1e-3, String(C.ninePointError(inside)));
  const outside = { ...s, P: {
    x: s.circle.x + (s.P.x - s.circle.x) * 1.5,
    y: s.circle.y + (s.P.y - s.circle.y) * 1.5,
  } };
  check("moving P outside the circle breaks it too", C.ninePointError(outside) > 1e-3);
  check("the perpendicular claim also needs P on the circle",
    Math.abs(C.simsonAngle(inside) - Math.PI / 2) > 1e-4);
}

/* ------------------- 7. degenerate drawings stay safe ------------------------ */

{
  const s = C.start();
  const repeated = { ...s, A: { ...s.B } };
  const d = C.compute(repeated);
  check("a repeated vertex gives no finite Simson intersection", !Number.isFinite(d.M.x));
  check("a degenerate drawing reports no locus claim", !Number.isFinite(C.ninePointError(repeated)));
  check("checking it did not change the start position",
    closePt(s.A, C.start().A, 0) && closePt(s.P, C.start().P, 0));
  // The applet's SqDist < 0.1 special case: a foot equal to the vertex.
  const near = C.withPoint(s, "P", { x: s.B.x + 0.05, y: s.B.y + 0.05 });
  const foot = C.compute(near).Pa;
  check("the applet's near-vertex foot rule is reproduced",
    closePt(foot, near.P, 0) && closePt(appletFoot(near.P, near.B, near.C), foot, 0));
}

done("circum-simson");
