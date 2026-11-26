#!/usr/bin/env node
"use strict";

/*
 * Logic test for altitude-and-circumcircle/altitude-and-circumcircle-core.js.
 *
 *   node porting/check-altitude-and-circumcircle.mjs
 *
 * Checks the state/move rules, then every claim on the cut-the-knot page over
 * exact triangles (equilateral, right, isosceles, acute, obtuse) and a seeded
 * random sample of several thousand non-degenerate triangles. Finally it
 * transcribes the applet's own GeoSDoub.FindAltitude, FindCircumcenter,
 * GetCircle, Intersect and Extend a second time, straight from the bytecode,
 * and compares them with the core on every triangle in the sample.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("altitude-and-circumcircle/altitude-and-circumcircle-core.js", "AltitudeAndCircumcircleCore");

/* ------------------------------------------- a second transcription of the applet */

const plus = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const minus = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const half = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const length = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), literally. */
function appletIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.FindAltitude(A,B,C) — push A along a perpendicular of BC, intersect. */
function appletAltitude(a, b, c) {
  const q = { x: a.x + (c.y - b.y), y: a.y - (c.x - b.x) };
  return appletIntersect(a, q, b, c);
}

/** GeoSDoub.FindCircumcenter(A,B,C) — intersect two perpendicular bisectors. */
function appletCircumcenter(a, b, c) {
  const m1 = half(a, b), m2 = half(b, c);
  const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  return appletIntersect(m1, p, m2, q);
}

/** AltitudeAndCircumcircleCanvas.GetCircle(A,B,C) — mean of the three radii. */
function appletCircle(a, b, c) {
  const center = appletCircumcenter(a, b, c);
  return { center, radius: (length(center, a) + length(center, b) + length(center, c)) / 3 };
}

/** AltitudeAndCircumcircleCanvas.Extend(p,q): 2q - p. */
function appletExtend(p, q) {
  return { x: 2 * q.x - p.x, y: 2 * q.y - p.y };
}

/* ------------------------------------------------------------- triangle sample */

const tri = (A, B, C) => ({ A, B, C });
const exact = [
  ["equilateral", tri({ x: 180, y: 40 }, { x: 180 - 40 * Math.sqrt(3), y: 160 }, { x: 180 + 40 * Math.sqrt(3), y: 160 })],
  ["right", tri({ x: 60, y: 200 }, { x: 300, y: 200 }, { x: 60, y: 40 })],
  ["obtuse", tri({ x: 40, y: 120 }, { x: 320, y: 120 }, { x: 180, y: 135 })],
  ["isosceles acute", tri({ x: 180, y: 20 }, { x: 70, y: 205 }, { x: 290, y: 205 })],
  ["scalene acute", C.start()],
  ["very thin", tri({ x: 40, y: 40 }, { x: 320, y: 45 }, { x: 190, y: 60 })],
];
const random = [];
const next = rng(20261126);
for (let i = 0; i < 6000 && random.length < 4000; i++) {
  const A = { x: 10 + next() * 340, y: 10 + next() * 220 };
  const B = { x: 10 + next() * 340, y: 10 + next() * 220 };
  const Z = { x: 10 + next() * 340, y: 10 + next() * 220 };
  if (Math.min(length(A, B), length(A, Z), length(B, Z)) < 25) continue;
  if (Math.abs(C.twiceArea(A, B, Z)) < 300) continue;
  random.push(tri(A, B, Z));
}
const sample = [...exact.map(([, s]) => s), ...random];

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  check("the opening picture has three corners", [s.A, s.B, s.C].every(C.finite));
  check("the opening triangle is not degenerate", !C.compute(s).degenerate);
  check("the demo has not been explored yet", C.result(s) === null);
  check("names are on and the other three options are off at the start",
    s.showNames === true && !s.showHint && !s.showAltitudes && !s.showCircle);
  equal("start counters", [s.moves, s.explored], [0, false]);
  check("legal moves cover three corners, four options and reset", C.legalMoves(s).length === 8);
}

/* ------------------------------------------------------ 2. moves and options */

{
  const s = C.start();
  const moved = C.move(s, { type: "point", name: "C", point: { x: 300, y: 60 } });
  check("dragging a corner moves only that corner",
    moved && moved.C.x === 300 && moved.C.y === 60 && moved.A.x === s.A.x && moved.B.y === s.B.y);
  check("a drag is refused when it puts two corners together",
    C.move(s, { type: "point", name: "C", point: s.A }) === null);
  const outside = C.move(s, { type: "point", name: "A", point: { x: 9999, y: -9999 } });
  check("a point dragged off the board is kept inside it",
    outside && outside.A.x <= C.WIDTH - 6 && outside.A.y >= 6);
  check("an unknown option is refused", C.move(s, { type: "option", key: "wrong", value: true }) === null);
  let t = s;
  for (const key of C.OPTION_KEYS) t = C.move(t, { type: "option", key, value: true });
  check("all four applet switches can be ticked",
    C.OPTION_KEYS.every((k) => t[k] === true) && t.moves === 4 && C.result(t) === "done");
  check("the switch does not move the corners", [s.A, s.B, s.C].every((p, i) => length(p, [t.A, t.B, t.C][i]) === 0));
  const reset = C.move(t, { type: "reset" });
  check("reset restores the opening corners but keeps the switches",
    [s.A, s.B, s.C].every((p, i) => length(p, [reset.A, reset.B, reset.C][i]) === 0)
    && C.OPTION_KEYS.every((k) => reset[k] === true));
  check("the source position is never changed by a move", s.moves === 0 && !s.explored && s.showAltitudes === false);
  const degenerate = C.compute(tri({ x: 20, y: 20 }, { x: 100, y: 20 }, { x: 200, y: 20 }));
  check("three corners in a line are reported as degenerate", degenerate.degenerate === true);
}

/* --------------------------------------- 3. the page's claims, over every sample */

{
  let alt = 0, collinear = 0, bisected = 0, concyclic = 0, second = 0;
  let equalCircles = 0, sCircle = 0, arcs = 0, radiusMean = 0;
  let obtuse = 0, acute = 0, right = 0;
  for (const s of sample) {
    const g = C.compute(s);
    const r = C.residuals(s, g);
    alt = Math.max(alt, r.altitude);
    collinear = Math.max(collinear, r.collinearH);
    bisected = Math.max(bisected, r.bisected);
    concyclic = Math.max(concyclic, r.concyclic);
    second = Math.max(second, r.secondPoint);
    equalCircles = Math.max(equalCircles, r.equalCircles);
    sCircle = Math.max(sCircle, r.SOnCircleHBC);
    radiusMean = Math.max(radiusMean,
      Math.abs(length(g.O, s.A) - g.r), Math.abs(length(g.O, s.B) - g.r));
    const ang = [C.angleAt(s.A, s.B, s.C), C.angleAt(s.B, s.A, s.C), C.angleAt(s.C, s.A, s.B)];
    if (ang.some((a) => a > Math.PI / 2 + 1e-9)) obtuse++;
    else if (ang.some((a) => Math.abs(a - Math.PI / 2) < 1e-3)) right++;
    else { acute++; arcs = Math.max(arcs,
      Math.abs(C.angleAt(g.O, s.A, g.refs.b) - (Math.PI - 2 * ang[0])),
      Math.abs(C.angleAt(g.O, s.A, g.refs.c) - (Math.PI - 2 * ang[0]))); }
  }
  check("each foot lies on its side and the altitude is perpendicular", alt < 1e-5, `max ${alt}`);
  check("H lies on all three altitude lines", collinear < 1e-5, `max ${collinear}`);
  check("Ha, Hb, Hc bisect H Ka, H Kb, H Kc (HHa = HaKa)", bisected < 1e-5, `max ${bisected}`);
  check("Ka, Kb, Kc lie on the circumcircle of ABC - all 4006 triangles, obtuse included",
    concyclic < 1e-5, `max ${concyclic}`);
  check("each K is the second intersection of its altitude with the circumcircle",
    second < 1e-5, `max ${second}`);
  check("the sample really contains obtuse triangles", obtuse > 1000, `${obtuse} obtuse`);
  check("the sample really contains acute and right triangles", acute > 100 && right > 0,
    `${acute} acute, ${right} right`);
  const cc = C.compute(C.start());
  check("the applet's averaged radius equals the distance to each corner", radiusMean < 1e-5, `max ${radiusMean}`);
  check("circles ABH, BCH, CAH and the reflected circle HBC have the circumradius",
    equalCircles < 1e-5, `max ${equalCircles}`);
  check("S, the reflection of A in Ha, lies on the circle through H, B, C", sCircle < 1e-5, `max ${sCircle}`);
  check("for acute triangles each arc next to A measures 2(90 degrees - angle A)",
    arcs < 1e-5, `max ${arcs}`);
  check("an equilateral triangle sends H to the circumcenter",
    length(C.compute(exact[0][1]).H, C.compute(exact[0][1]).O) < 1e-5);
  const rt = C.compute(exact[1][1]);
  check("in a right triangle H is the right-angle corner",
    length(rt.H, exact[1][1].A) < 1e-5);
}

/* --------------------------- 4. the applet's own bytecode, transcribed twice */

{
  let feet = 0, centers = 0, circles = 0, orthos = 0, reflected = 0;
  for (const s of sample) {
    const g = C.compute(s);
    const Ha = appletAltitude(s.A, s.B, s.C);
    const Hb = appletAltitude(s.B, s.A, s.C);
    const Hc = appletAltitude(s.C, s.B, s.A);
    feet = Math.max(feet, length(Ha, g.feet.a), length(Hb, g.feet.b), length(Hc, g.feet.c));
    centers = Math.max(centers, length(appletCircumcenter(s.A, s.B, s.C), g.O));
    const ac = appletCircle(s.A, s.B, s.C);
    circles = Math.max(circles, Math.abs(ac.radius - g.r));
    const H = appletIntersect(s.A, Ha, s.B, Hb);
    orthos = Math.max(orthos, length(H, g.H));
    reflected = Math.max(reflected,
      length(appletExtend(H, Ha), g.refs.a),
      length(appletExtend(H, Hb), g.refs.b),
      length(appletExtend(H, Hc), g.refs.c));
  }
  check("GeoSDoub.FindAltitude matches the core's feet on every triangle", feet < 1e-5, `max ${feet}`);
  check("GeoSDoub.FindCircumcenter matches the core's center on every triangle", centers < 1e-5, `max ${centers}`);
  check("the applet's GetCircle radius matches the core's radius on every triangle", circles < 1e-5, `max ${circles}`);
  check("GeoSDoub.Intersect gives the same orthocenter as the core", orthos < 1e-5, `max ${orthos}`);
  check("the applet's Extend gives the same Ka, Kb, Kc as the core", reflected < 1e-5, `max ${reflected}`);
}

done("altitude-and-circumcircle");
