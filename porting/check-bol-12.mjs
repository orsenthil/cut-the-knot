#!/usr/bin/env node
"use strict";

/*
 * Logic test for bol-12/bol-12-core.js.
 *
 *   node porting/check-bol-12.mjs
 *
 * Checks the starting arrangement and all the moves and switches, then
 * Proposition 12 and the equal-length claims from its proof on the opening
 * picture, nine hand-picked configurations and about 2,500 seeded random ones.
 * Finally it writes the applet's own computation a second time, straight from
 * the bytecode: Tangents (circle-circle intersection, both the X and Y
 * branches), DefinePQ, Intersect(A,Q,B,P), Intersect(A,B,T,R), Extend and
 * GetCircle(O,Q,P), and compares every point with the core over the whole
 * sample. The claim is confirmed: R.x = T.x, so TR is perpendicular to AB.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bol-12/bol-12-core.js", "Bol12Core");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/** Smallest way of pairing two pairs of points, to allow swapped tangents. */
const paired = (a, b, c, d) => Math.min(Math.max(dist(a, c), dist(b, d)), Math.max(dist(a, d), dist(b, c)));

const state = (Cc, Bo, T) => C.start({ C: Cc, Bo, T });

/* --------------------------- a second transcription of the applet's methods */

/** GeoSDoub.Intersect(P1,P2,P3,P4), ax+by+c form, |det| < 1 gives NaN. */
function appletIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.IntersectCirclesX, from the bytecode: solve x = m*y + b. */
function appletCirclesX(c1, r1, c2, r2) {
  const m = -(c1.y - c2.y) / (c1.x - c2.x);
  const b = (c1.x ** 2 - c2.x ** 2 + c1.y ** 2 - c2.y ** 2 - r1 ** 2 + r2 ** 2)
    / (2 * (c1.x - c2.x));
  const a = b - c1.x;
  const aa = m * m + 1;
  const bb = 2 * (m * a - c1.y);
  const cc = c1.y ** 2 + a * a - r1 ** 2;
  const disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const y1 = (-bb + s) / (2 * aa), y2 = (-bb - s) / (2 * aa);
  return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
}

/** GeoSDoub.IntersectCirclesY, from the bytecode: solve y = m*x + b. */
function appletCirclesY(c1, r1, c2, r2) {
  const m = -(c1.x - c2.x) / (c1.y - c2.y);
  const b = (c1.y ** 2 - c2.y ** 2 + c1.x ** 2 - c2.x ** 2 - r1 ** 2 + r2 ** 2)
    / (2 * (c1.y - c2.y));
  const a = b - c1.y;
  const aa = m * m + 1;
  const bb = 2 * (m * a - c1.x);
  const cc = c1.x ** 2 + a * a - r1 ** 2;
  const disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const x1 = (-bb + s) / (2 * aa), x2 = (-bb - s) / (2 * aa);
  return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
}

/** GeoSDoub.Intersect(circle, circle): X when |dx| > 1, else Y. */
function appletCircleIntersection(c1, r1, c2, r2) {
  if (Math.abs(c1.x - c2.x) > 1) return appletCirclesX(c1, r1, c2, r2);
  if (Math.abs(c1.y - c2.y) > 1) return appletCirclesY(c1, r1, c2, r2);
  return [{ ...c1 }, { ...c1 }];
}

/** BOL12Canvas.Tangents(circle, T): circles (C,r) and (T,sqrt(d²-r²)). */
function appletTangents(c1, r, T) {
  const d = dist(c1, T);
  if (d <= r) return null;
  const t = Math.sqrt(d * d - r * r);
  return appletCircleIntersection(c1, r, T, t);
}

/** BOL12Canvas.DefinePQ(): P is farther from B. */
function appletDefinePQ(pts, B) {
  if (dist(pts[0], B) < dist(pts[1], B)) return { P: pts[1], Q: pts[0] };
  return { P: pts[0], Q: pts[1] };
}

/** BOL12Canvas.Extend(P,T) = 2T - P. */
function appletExtend(p, q) {
  return { x: 2 * q.x - p.x, y: 2 * q.y - p.y };
}

/** GeoSDoub.FindCircumcenter and BOL12Canvas.GetCircle(O,Q,P). */
function appletCircumcenter(a, b, c) {
  const m1 = C.midpoint(a, b), m2 = C.midpoint(b, c);
  const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  return appletIntersect(m1, p, m2, q);
}
function appletGetCircle(a, b, c) {
  const o = appletCircumcenter(a, b, c);
  return { center: o, radius: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
}

/* ------------------------------------------------------------- configurations */

const fixed = [
  ["opening", C.start()],
  ["T directly above the centre (Y branch)", state({ x: 180, y: 180 }, { x: 120, y: 180 }, { x: 180, y: 90 })],
  ["T directly right, on the diameter (X branch)", state({ x: 180, y: 180 }, { x: 120, y: 180 }, { x: 280, y: 180 })],
  ["T below the diameter", state({ x: 180, y: 150 }, { x: 120, y: 150 }, { x: 200, y: 240 })],
  ["T far up and right", state({ x: 100, y: 200 }, { x: 60, y: 200 }, { x: 360, y: 40 })],
  ["small circle", state({ x: 200, y: 150 }, { x: 180, y: 150 }, { x: 240, y: 100 })],
  ["large circle", state({ x: 200, y: 160 }, { x: 110, y: 160 }, { x: 330, y: 60 })],
  ["T almost directly above (Y branch)", state({ x: 200, y: 150 }, { x: 140, y: 150 }, { x: 200.5, y: 60 })],
  ["T just outside the circle", state({ x: 160, y: 160 }, { x: 100, y: 160 }, { x: 222, y: 160 })],
];

const random = [];
const next = rng(2612);
for (let i = 0; i < 20000 && random.length < 2400; i++) {
  const Cc = { x: 110 + next() * 220, y: 70 + next() * 160 };
  const r = 20 + next() * 70;
  const Bo = { x: Cc.x - r, y: Cc.y };
  const T = { x: 12 + next() * 376, y: 12 + next() * 276 };
  if (dist(Cc, T) <= r + 2) continue;
  random.push(["random " + i, state(Cc, Bo, T)]);
}
// Force the applet's Y branch (|C.x - T.x| <= 1) on many more configurations.
for (let i = 0; i < 160; i++) {
  const Cc = { x: 120 + next() * 160, y: 80 + next() * 140 };
  const r = 18 + next() * 60;
  const Bo = { x: Cc.x - r, y: Cc.y };
  const T = { x: Cc.x + (next() - 0.5), y: Cc.y - (r + 3 + next() * 60) };
  if (dist(Cc, T) <= r + 2 || T.y < 8) continue;
  random.push(["aligned " + i, state(Cc, Bo, T)]);
}
const sample = [...fixed, ...random];
const yBranch = sample.filter(([name, s]) => Math.abs(s.C.x - s.T.x) <= 1).length;

/* --------------------------------------------- 1. the start and the rules */

{
  const w = C.WIDTH, h = C.HEIGHT, r = w / 6;
  const s = C.start();
  check("init places C at (WIDTH/2 - r, HEIGHT/2 + r/2)",
    dist(s.C, { x: w / 2 - r, y: h / 2 + r / 2 }) < 1e-9);
  check("init places the radius point one radius left of C",
    dist(s.Bo, { x: s.C.x - r, y: s.C.y }) < 1e-9);
  check("init places T at (C.x + r/2, C.y - 1.2r)",
    dist(s.T, { x: s.C.x + r / 2, y: s.C.y - 1.2 * r }) < 1e-9);
  check("the opening radius is WIDTH/6 and T is outside it",
    Math.abs(dist(s.C, s.Bo) - r) < 1e-9 && dist(s.C, s.T) > r);
  check("names start on, statement and hint off",
    s.showNames === true && s.showStatement === false && s.showHint === false);
  check("a fresh picture has no result", C.result(s) === null);
  equal("start counters", [s.moves, s.explored], [0, false]);
  check("legal moves cover three points, three switches and reset",
    C.legalMoves(s).length === 7);
  const moved = C.move(s, { type: "point", name: "T", point: { x: 340, y: 60 } });
  check("dragging T moves only T and marks the picture explored",
    moved && moved.T.x === 340 && moved.T.y === 60 && dist(moved.C, s.C) === 0
      && dist(moved.Bo, s.Bo) === 0 && C.result(moved) === "done");
  const off = C.move(s, { type: "point", name: "T", point: { x: 9999, y: -9999 } });
  check("a point dragged off the board is kept inside it",
    off && off.T.x <= C.WIDTH - C.MARGIN && off.T.y >= C.MARGIN);
  const tiny = C.move(s, { type: "point", name: "Bo", point: { x: s.C.x - 1, y: s.C.y } });
  check("the radius point cannot collapse the circle",
    dist(tiny.C, tiny.Bo) >= C.MIN_RADIUS - 1e-9);
  check("an unknown point or switch is refused",
    C.move(s, { type: "point", name: "X", point: s.C }) === null
      && C.move(s, { type: "option", key: "wrong", value: true }) === null);
  let t = s;
  for (const key of C.OPTION_KEYS) t = C.move(t, { type: "option", key, value: true });
  check("all three applet checkboxes can be ticked",
    C.OPTION_KEYS.every((k) => t[k] === true) && t.moves === 3);
  check("ticking a switch does not move any point",
    C.HANDLES.every((n) => dist(s[n], t[n]) === 0));
  const reset = C.move(t, { type: "reset" });
  check("reset restores the opening points but keeps the switches",
    C.HANDLES.every((n) => dist(s[n], reset[n]) === 0)
      && C.OPTION_KEYS.every((k) => reset[k] === true));
  check("moves do not change the position they were made from",
    s.moves === 0 && !s.explored && !s.showHint);
  check("invalid option coordinates are ignored at start",
    C.start({ C: { x: NaN, y: 0 }, T: { x: 1 / 0, y: 0 }, showHint: "yes" }).C.x === s.C.x
      && C.start({ showHint: "yes" }).showHint === false);
}

/* ------------------------------------------------- 2. states with no drawing */

{
  const inside = C.compute(state({ x: 180, y: 150 }, { x: 120, y: 150 }, { x: 190, y: 150 }));
  const onCircle = C.compute(state({ x: 180, y: 150 }, { x: 120, y: 150 }, { x: 240, y: 150 }));
  check("T inside the circle gives no drawing (applet Tangents returns null)",
    !inside.valid && inside.reason === "outside");
  check("T exactly on the circle gives no drawing either",
    !onCircle.valid && onCircle.reason === "outside");
  check("an invalid position has no residuals or claims",
    C.residuals(inside) === null && C.claims(inside) === null);
}

/* ------------------------------------- 3. every claim over the whole sample */

{
  const keys = ["onCircle", "tangency", "equalTangents", "perpendicular", "foot",
    "footOnLine", "equalRadii", "concurrence", "hintCenter", "hintRadius"];
  const max = Object.fromEntries(keys.map((k) => [k, 0]));
  let bad = 0, smallest = Infinity, largest = 0;
  for (const [name, s] of sample) {
    const g = C.compute(s);
    if (!g.valid) { bad++; console.error(`  ${name}: no drawing`); continue; }
    const res = C.residuals(g);
    for (const k of keys) max[k] = Math.max(max[k], res[k]);
    const ratio = g.d / g.r;
    smallest = Math.min(smallest, ratio);
    largest = Math.max(largest, ratio);
  }
  check(`every configuration produces a drawing (${sample.length} cases)`, bad === 0);
  for (const k of keys) {
    check(`claim ${k} holds on all ${sample.length} configurations`,
      max[k] < 1e-7, `max ${max[k].toExponential(2)}`);
  }
  check("the sample spans T just outside to far outside the circle",
    smallest < 1.1 && largest > 3, `d/r from ${smallest.toFixed(2)} to ${largest.toFixed(1)}`);
  check(`the sample exercises the applet's Y branch ${yBranch} times`, yBranch > 50);
}

/* ---------------------------- 4. the applet's bytecode, transcribed twice */

{
  let pairErr = 0, orderErr = 0, Rerr = 0, Merr = 0, Oerr = 0;
  let centerErr = 0, radiusErr = 0, xBranch = 0, compared = 0;
  for (const [name, s] of sample) {
    const g = C.compute(s);
    const pts = appletTangents(g.C0, g.r, g.T);
    if (!pts || pts.length !== 2) { check(`${name}: applet found tangents`, false); continue; }
    const { A, B } = C.diameter(g.C0, g.r);
    const ap = appletDefinePQ(pts, B);
    pairErr = Math.max(pairErr, paired(ap.P, ap.Q, g.P, g.Q));
    orderErr = Math.max(orderErr, dist(ap.P, g.P), dist(ap.Q, g.Q));
    const R = appletIntersect(A, ap.Q, B, ap.P);
    const M = appletIntersect(A, B, g.T, R);
    Rerr = Math.max(Rerr, dist(R, g.R));
    Merr = Math.max(Merr, dist(M, g.M));
    Oerr = Math.max(Oerr, dist(appletExtend(ap.P, g.T), g.O));
    const circ = appletGetCircle(appletExtend(ap.P, g.T), ap.Q, ap.P);
    centerErr = Math.max(centerErr, dist(circ.center, g.T));
    radiusErr = Math.max(radiusErr, Math.abs(circ.radius - g.hintRadius));
    if (Math.abs(g.C0.x - g.T.x) > 1) xBranch++;
    compared++;
  }
  const tol = 2e-5 * C.WIDTH;
  check(`Draw's DefinePQ picks the same P and Q on all ${compared} pictures`,
    pairErr < tol && orderErr < tol, `max ${pairErr.toExponential(2)}/${orderErr.toExponential(2)}`);
  check("applet Intersect(A,Q,B,P) gives the same R as the core",
    Rerr < tol, `max ${Rerr.toExponential(2)}`);
  check("applet Intersect(A,B,T,R) gives the same M as the core",
    Merr < tol, `max ${Merr.toExponential(2)}`);
  check("applet Extend(P,T) gives the same O as the core",
    Oerr < tol, `max ${Oerr.toExponential(2)}`);
  check("applet GetCircle(O,Q,P) is centred at T, as the core says",
    centerErr < tol, `max ${centerErr.toExponential(2)}`);
  check("applet GetCircle's mean radius equals the core's hint circle",
    radiusErr < tol, `max ${radiusErr.toExponential(2)}`);
  check(`both circle-intersection branches were used (${xBranch} X, ${yBranch} Y)`,
    xBranch > 100 && yBranch > 50);
  check(`all ${compared} positions were compared with the applet`, compared === sample.length);
  const opening = C.compute(C.start());
  check("the opening picture obeys R.x = T.x exactly to double precision",
    Math.abs(opening.R.x - opening.T.x) < 1e-9,
    `R.x ${opening.R.x}, T.x ${opening.T.x}`);
}

done("bol-12");
