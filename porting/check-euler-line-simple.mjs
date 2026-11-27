#!/usr/bin/env node
"use strict";

/*
 * Logic test for euler-line-simple/euler-line-simple-core.js.
 *
 *   node porting/check-euler-line-simple.mjs
 *
 * Checks the demo's state/move rules, then every claim on the cut-the-knot
 * page (H, G and O collinear, GH = 2 GO) and the parallelogram/median facts
 * behind Nikolin's proof over exact triangles and 5,000 seeded random ones.
 * Finally it transcribes the applet's own CTKGeometryPlus.Midpoint,
 * Barycenter, Prorate and GeoSDoub.FindAltitude, FindCircumcenter, Intersect,
 * Dist and Extend a second time, straight from the bytecode, and compares
 * them with the core on every triangle in the sample.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("euler-line-simple/euler-line-simple-core.js", "EulerLineSimpleCore");

/* ------------------------------------------- a second transcription of the applet */

const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const len = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const half = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/** GeoSDoub.Intersect(P,Q,R,S): line coefficients, |det| < 1 -> NaN. */
function jIntersect(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const det = a1 * b2 - a2 * b1;
  const guard = 1;
  if (Math.abs(det) < guard) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.FindAltitude(A,B,C) = Intersect(A, A+perp(BC), B, C). */
function jAltitude(a, b, c) {
  const q = { x: a.x + (c.y - b.y), y: a.y - (c.x - b.x) };
  return jIntersect(a, q, b, c);
}

/** CTKGeometryPlus.Midpoint(P,Q), literally. */
function jMidpoint(p, q) {
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

/** CTKGeometryPlus.Barycenter(P,Q,R), literally. */
function jBarycenter(p, q, r) {
  return { x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3 };
}

/** GeoSDoub.FindCircumcenter(A,B,C): two perpendicular bisectors. */
function jCircumcenter(a, b, c) {
  const m1 = jMidpoint(a, b), m2 = jMidpoint(b, c);
  const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  return jIntersect(m1, p, m2, q);
}

/** EulerLineSimpleCanvas.GetCircle(A,B,C): mean of the three radii. */
function jGetCircle(a, b, c) {
  const o = jCircumcenter(a, b, c);
  return { center: o, radius: (len(o, a) + len(o, b) + len(o, c)) / 3 };
}

/** CTKGeometryPlus.Prorate(P,C,scale), with its 0.1 guard. */
function jProrate(p, c, scale) {
  const d = len(p, c);
  if (d < 0.1) return { x: p.x, y: p.y };
  const f = scale / d;
  return { x: p.x + f * (c.x - p.x), y: p.y + f * (c.y - p.y) };
}

/** EulerLineSimpleCanvas.Extend(P,Q) = 2Q - P. */
function jExtend(p, q) { return { x: 2 * q.x - p.x, y: 2 * q.y - p.y }; }

/** EulerLineSimpleCanvas.GetPerp(P,Q), kept for completeness. */
function jGetPerp(p, q) { return { x: p.x + (p.y - q.y), y: p.y - (p.x - q.x) }; }

const same = (p, q, tol = 1e-7) =>
  (!Number.isFinite(p.x) && !Number.isFinite(q.x) && !Number.isFinite(p.y) && !Number.isFinite(q.y))
  || (C.finite(p) && C.finite(q) && len(p, q) < tol);

/* ------------------------------------------------------------- triangle sample */

const tri = (A, B, Cc) => ({ A, B, C: Cc });
const exact = [
  ["opening triangle", C.start()],
  ["equilateral", tri({ x: 180, y: 40 }, { x: 110, y: 40 + 70 * Math.sqrt(3) }, { x: 250, y: 40 + 70 * Math.sqrt(3) })],
  ["right angle at A", tri({ x: 60, y: 190 }, { x: 300, y: 190 }, { x: 60, y: 50 })],
  ["right angle at B", tri({ x: 40, y: 60 }, { x: 40, y: 200 }, { x: 300, y: 200 })],
  ["obtuse at C", tri({ x: 40, y: 120 }, { x: 320, y: 120 }, { x: 180, y: 135 })],
  ["isosceles acute", tri({ x: 180, y: 20 }, { x: 70, y: 205 }, { x: 290, y: 205 })],
  ["thin", tri({ x: 30, y: 40 }, { x: 320, y: 45 }, { x: 190, y: 65 })],
  ["small", tri({ x: 180, y: 120 }, { x: 183, y: 120 }, { x: 180, y: 123 })],
];
const random = [];
const next = rng(20261127);
for (let i = 0; i < 30000 && random.length < 5000; i++) {
  const A = { x: 12 + next() * 336, y: 12 + next() * 216 };
  const B = { x: 12 + next() * 336, y: 12 + next() * 216 };
  const Z = { x: 12 + next() * 336, y: 12 + next() * 216 };
  if (Math.min(len(A, B), len(A, Z), len(B, Z)) < 25) continue;
  const candidate = tri(A, B, Z);
  if (Math.abs(C.cross(sub(B, A), sub(Z, A))) < 800) continue;
  // The applet's Intersect gives NaN when |det| < 1; a nearly collinear
  // triangle has no drawn Euler line, so it belongs in the edge-case checks.
  if (C.compute(candidate).degenerate) continue;
  random.push(candidate);
}
const sample = [...exact.map(([, s]) => s), ...random];

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  check("the opening corners are three distinct, finite points",
    [s.A, s.B, s.C].every(C.finite)
    && Math.min(len(s.A, s.B), len(s.A, s.C), len(s.B, s.C)) > 12);
  check("the opening triangle is not degenerate", !C.compute(s).degenerate);
  check("a fresh picture is not counted as explored", C.result(s) === null);
  check("the applet's option defaults: names on, four switches off",
    s.showNames === true && !s.showAltitudes && !s.showMedians && !s.showBisectors && !s.showHint);
  equal("a fresh picture has no selected corner and no moves", [s.selected, s.moves, s.explored], [null, 0, false]);
  equal("legal moves: three corners, five switches, three selections, reset", C.legalMoves(s).length, 12);
}

/* ------------------------------------------------------ 2. moves and options */

{
  const s = C.start();
  const moved = C.move(s, { type: "point", name: "C", point: { x: 300, y: 60 } });
  check("dragging a corner moves only that corner and selects it",
    moved && moved.C.x === 300 && moved.C.y === 60 && moved.A.x === s.A.x && moved.B.y === s.B.y
    && moved.selected === "C");
  check("a drag that puts two corners together is refused",
    C.move(s, { type: "point", name: "C", point: s.A }) === null);
  const outside = C.move(s, { type: "point", name: "A", point: { x: 9999, y: -9999 } });
  check("a corner dragged off the board is kept inside it",
    outside && outside.A.x <= C.WIDTH - 6 && outside.A.y >= 6);
  check("an unknown option is refused", C.move(s, { type: "option", key: "wrong", value: true }) === null);
  check("an unknown corner is refused", C.move(s, { type: "select", name: "Z" }) === null);
  check("a non-finite corner is refused", C.move(s, { type: "point", name: "B", point: { x: NaN, y: 3 } }) === null);
  let t = s;
  for (const key of C.OPTION_KEYS) t = C.move(t, { type: "option", key, value: true });
  check("all five applet switches can be ticked",
    C.OPTION_KEYS.every((k) => t[k] === true) && t.moves === 5 && C.result(t) === "done");
  check("ticking the switches leaves the triangle alone",
    [s.A, s.B, s.C].every((p, i) => len(p, [t.A, t.B, t.C][i]) === 0));
  const reset = C.move(t, { type: "reset" });
  check("reset restores the opening corners but keeps the switches",
    [s.A, s.B, s.C].every((p, i) => len(p, [reset.A, reset.B, reset.C][i]) === 0)
    && C.OPTION_KEYS.every((k) => reset[k] === true));
  check("the source position is never changed by a move",
    s.moves === 0 && !s.explored && s.showAltitudes === false && s.selected === null);
  check("an option can be unticked again", C.move(t, { type: "option", key: "hint", value: false }) === null
    && C.move(t, { type: "option", key: "showHint", value: false }).showHint === false);
  const line = tri({ x: 20, y: 20 }, { x: 100, y: 20 }, { x: 200, y: 20 });
  check("three corners in a line are reported as degenerate", C.compute(line).degenerate === true);
  check("an illegal move leaves the picture unexplored", C.result(C.move(s, { type: "point", name: "A", point: s.B })) === null);
}

/* --------------------------------------- 3. the page's claims, over every sample */

{
  let collinear = 0, ratio = 0, perp = 0, Halt = 0, antipode = 0;
  let onCircle = 0, parallelogram = 0, diagonal = 0, centroid = 0, median = 0;
  let mean = 0, Hformula = 0, Gformula = 0, acute = 0, obtuse = 0, rightish = 0;
  for (const s of sample) {
    const g = C.compute(s);
    if (g.degenerate) throw new Error("a sample triangle came out degenerate: " + JSON.stringify(s));
    const r = C.residuals(s, g);
    collinear = Math.max(collinear, r.collinear);
    ratio = Math.max(ratio, r.ratioGH2GO);
    perp = Math.max(perp, r.altitudePerp);
    Halt = Math.max(Halt, r.HOnAltitudes);
    antipode = Math.max(antipode, r.antipodeError);
    onCircle = Math.max(onCircle, r.antipodeOnCircle);
    parallelogram = Math.max(parallelogram, r.parallelogram);
    diagonal = Math.max(diagonal, r.diagonalOnMedian);
    centroid = Math.max(centroid, r.centroidTwice);
    median = Math.max(median, r.medianRatio);
    mean = Math.max(mean, r.circleMean);
    // Independent coordinate identities: H = A+B+C-2O and G = O+(H-O)/3.
    const H2 = { x: s.A.x + s.B.x + s.C.x - 2 * g.O.x, y: s.A.y + s.B.y + s.C.y - 2 * g.O.y };
    const G2 = C.add(g.O, C.mul(C.sub(g.H, g.O), 1 / 3));
    Hformula = Math.max(Hformula, len(H2, g.H));
    Gformula = Math.max(Gformula, len(G2, g.G));
    const angles = [C.dist(s.A, s.B), C.dist(s.B, s.C), C.dist(s.C, s.A)].sort((a, b) => a - b);
    if (angles[0] * angles[0] + angles[1] * angles[1] < angles[2] * angles[2] - 1e-6) obtuse++;
    else if (Math.abs(angles[0] * angles[0] + angles[1] * angles[1] - angles[2] * angles[2]) < 1e-6) rightish++;
    else acute++;
  }
  check("H, G and O are collinear on every triangle (5,008 cases, acute, right and obtuse)",
    collinear < 1e-6, `max ${collinear}`);
  check("GH = 2 GO on every triangle, the page's exact claim", ratio < 1e-6, `max ${ratio}`);
  check("G = O + (H-O)/3, an independent form of the same claim", Gformula < 1e-6, `max ${Gformula}`);
  check("the altitudes are perpendicular to the opposite sides", perp < 1e-6, `max ${perp}`);
  check("H lies on all three altitude lines", Halt < 1e-6, `max ${Halt}`);
  check("D, E and F are the antipodes 2O-A, 2O-B, 2O-C", antipode < 1e-6, `max ${antipode}`);
  check("the three antipodes lie on the circumcircle", onCircle < 1e-7, `max ${onCircle}`);
  check("H = A+B+C-2O on every triangle", Hformula < 1e-6, `max ${Hformula}`);
  check("the applet's averaged radius equals each distance from O", mean < 1e-9, `max ${mean}`);
  check("each parallelogram has equal diagonal midpoints (BHC D, CHE A, AHF B)",
    parallelogram < 1e-6, `max ${parallelogram}`);
  check("each antipode-H diagonal passes through the midpoint of the opposite side",
    diagonal < 1e-6, `max ${diagonal}`);
  check("G is the centroid of triangle H-antipode-vertex for all three vertices",
    centroid < 1e-6, `max ${centroid}`);
  check("G divides every median in the ratio 2:1 from the vertex", median < 1e-6, `max ${median}`);
  check("the sample really contains acute, right and obtuse triangles",
    acute > 1000 && obtuse > 1000 && rightish >= 1, `${acute}/${rightish}/${obtuse}`);
  const eq = C.compute(exact[1][1]);
  check("an equilateral triangle puts H, G and O together", len(eq.H, eq.O) < 1e-6 && len(eq.G, eq.O) < 1e-6);
  const rt = C.compute(exact[2][1]);
  check("in a right triangle H is the right-angle corner", len(rt.H, exact[2][1].A) < 1e-6);
  const small = C.compute(exact[7][1]);
  check("a small triangle keeps enough precision to make a circle", !small.degenerate && Number.isFinite(small.r));
}

/* --------------------------- 4. the applet's own bytecode, transcribed twice */

{
  let feet = 0, mids = 0, bary = 0, centers = 0, circles = 0;
  let orthos = 0, antipodes = 0, perps = 0, prorateGuard = 0;
  for (const s of sample) {
    const g = C.compute(s);
    const Ha = jAltitude(s.A, s.B, s.C);
    const Hb = jAltitude(s.B, s.A, s.C);
    const Hc = jAltitude(s.C, s.B, s.A);
    feet = Math.max(feet, len(Ha, g.Ha), len(Hb, g.Hb), len(Hc, g.Hc));
    mids = Math.max(mids, len(jMidpoint(s.A, s.B), g.Mc), len(jMidpoint(s.B, s.C), g.Ma),
      len(jMidpoint(s.C, s.A), g.Mb));
    bary = Math.max(bary, len(jBarycenter(s.A, s.B, s.C), g.G));
    centers = Math.max(centers, len(jCircumcenter(s.A, s.B, s.C), g.O));
    const circle = jGetCircle(s.A, s.B, s.C);
    circles = Math.max(circles, Math.abs(circle.radius - g.r));
    const H = jIntersect(s.A, Ha, s.B, Hb);
    orthos = Math.max(orthos, len(H, g.H));
    antipodes = Math.max(antipodes,
      len(jProrate(s.A, circle.center, 2 * len(s.A, circle.center)), g.D),
      len(jProrate(s.B, circle.center, 2 * len(s.B, circle.center)), g.E),
      len(jProrate(s.C, circle.center, 2 * len(s.C, circle.center)), g.F));
    perps = Math.max(perps, len(jExtend(H, Ha), C.extend(H, Ha)),
      len(jGetPerp(s.A, s.B), { x: s.A.x + (s.A.y - s.B.y), y: s.A.y - (s.A.x - s.B.x) }));
  }
  check("GeoSDoub.FindAltitude matches the core's feet on every triangle", feet < 1e-6, `max ${feet}`);
  check("CTKGeometryPlus.Midpoint matches Ma, Mb and Mc on every triangle", mids === 0, `max ${mids}`);
  check("CTKGeometryPlus.Barycenter matches G on every triangle", bary < 1e-9, `max ${bary}`);
  check("GeoSDoub.FindCircumcenter matches O on every triangle", centers < 1e-6, `max ${centers}`);
  check("EulerLineSimpleCanvas.GetCircle matches the core's radius", circles < 1e-9, `max ${circles}`);
  check("GeoSDoub.Intersect gives the same H as the core", orthos < 1e-6, `max ${orthos}`);
  check("CTKGeometryPlus.Prorate gives the same D, E, F as the core", antipodes < 1e-6, `max ${antipodes}`);
  check("the transcribed Extend and GetPerp agree with the bytecode", perps === 0, `max ${perps}`);
  // The 0.1 guard in Prorate: a very short radius returns the point itself.
  const close = jProrate({ x: 10, y: 10 }, { x: 10.01, y: 10 }, 2 * 0.01);
  check("Prorate's 0.1 guard returns the original point when the circle is tiny",
    close.x === 10 && close.y === 10);
  prorateGuard = C.dist(C.prorate({ x: 10, y: 10 }, { x: 10.01, y: 10 }, 0.02), { x: 10, y: 10 });
  check("the core keeps the same 0.1 guard", prorateGuard === 0, `${prorateGuard}`);
  // NaN propagation: the applet's Intersect returns NaN when |det| < 1.
  const parallel = jIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 });
  const coreParallel = C.intersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 });
  check("parallel lines give NaN in both transcriptions", same(parallel, coreParallel));
}

done("euler-line-simple");
