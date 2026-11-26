#!/usr/bin/env node
"use strict";

/*
 * Logic test for broken-chord-paper-folding/broken-chord-paper-folding-core.js.
 *
 *   node porting/check-broken-chord-paper-folding.mjs
 *
 * Three things are checked. (1) The moves and switch rules, including the
 * applet's gating of lines/angles/extra behind "hint" and the distance < 1
 * fallbacks. (2) A second transcription of the applet's Compute(), FindP(),
 * FindF(), GetCircle() and GeoSDoub's NearestPoint/Intersect/FindOrientation,
 * written straight from javap, compared point by point with the core on every
 * configuration of a grid and 2,000 seeded random triangles. (3) The page's
 * claims — M is the foot of the perpendicular, F is the reflected B and lies
 * on the extension of AC with CF = CB, M is the midpoint of AF, the broken
 * chord AM = MC + CB, and the three pairs of inscribed angles with
 * alpha + gamma = beta — over all those configurations, plus an independent
 * construction of P and M by central angles and projection.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "broken-chord-paper-folding/broken-chord-paper-folding-core.js",
  "BrokenChordPaperFoldingCore",
);

/* ------------------------------------------- a second transcription of the applet */

const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/** GeoSDoub.FindOrientation(A,B,C), from javap -c: +1 when the value is > 0. */
function appletOrientation(a, b, c) {
  const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return v > 0 ? 1 : -1;
}

/** GeoSDoub.Intersect(p,q,r,s), from javap -c (NaN point when |det| < 1). */
function appletIntersection(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return {
    x: (b1 * c2 - b2 * c1) / det,
    y: (c1 * a2 - c2 * a1) / det,
  };
}

/** GeoSDoub.NearestPoint(p,a,b), from javap -c: note the SqDist(a,p) < 0.1 guard. */
function appletNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return { ...p };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** GeoSDoub.FindCircumcenter, from javap -c: two perpendicular bisectors. */
function appletCircumcenter(a, b, c) {
  const ab = mid(a, b), bc = mid(b, c);
  return appletIntersection(
    ab, { x: ab.x + b.y - a.y, y: ab.y - (b.x - a.x) },
    bc, { x: bc.x + c.y - b.y, y: bc.y - (c.x - b.x) },
  );
}

/** GetCircle(): average of the three distances from the circumcenter. */
function appletCircle(a, b, c) {
  const O = appletCircumcenter(a, b, c);
  return { O, r: (d(O, a) + d(O, b) + d(O, c)) / 3 };
}

/** GeoSDoub.IntersectX / IntersectY, from javap -c. */
function appletIntersectCircleLine(p, q, O, r) {
  let k, b, a, A, B, C0, roots, build;
  if (Math.abs(q.y - p.y) > 1) {
    k = (p.x - q.x) / (p.y - q.y);
    b = q.x - k * q.y;
    a = b - O.x;
    A = k * k + 1;
    B = k * a - O.y;
    C0 = a * a + O.y * O.y - r * r;
    build = (v) => ({ x: k * v + b, y: v });
  } else if (Math.abs(q.x - p.x) > 1) {
    k = (p.y - q.y) / (p.x - q.x);
    b = q.y - k * q.x;
    a = b - O.y;
    A = k * k + 1;
    B = k * a - O.x;
    C0 = a * a + O.x * O.x - r * r;
    build = (v) => ({ x: v, y: k * v + b });
  } else return null;
  const disc = B * B - A * C0;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [build((-B + s) / A), build((-B - s) / A)];
}

/** FindP(), from javap -c: keep the intersection on the same side of AB as C. */
function appletFindP(a, b, c, circle) {
  const m = mid(a, b);
  const q = { x: m.x + b.y - a.y, y: m.y - (b.x - a.x) };
  const both = appletIntersectCircleLine(m, q, circle.O, circle.r);
  if (!both) return { x: NaN, y: NaN };
  return appletOrientation(both[0], a, b) === appletOrientation(c, a, b) ? both[0] : both[1];
}

/** FindF(), from javap -c: reflect in line PC, or in the point P when PC < 1. */
function appletFindF(p, P, c) {
  const foot = d(P, c) < 1 ? P : appletNearest(p, P, c);
  return { x: 2 * foot.x - p.x, y: 2 * foot.y - p.y };
}

/** Canvas.Compute(), from javap -c. */
function appletCompute(A, B, Cc) {
  if (d(A, B) < 1) return { noDraw: true };
  const circle = appletCircle(A, B, Cc);
  const P = appletFindP(A, B, Cc, circle);
  const longAC = d(A, Cc) > d(B, Cc);
  const K = longAC ? A : B, L = longAC ? B : A;
  const M = longAC ? appletNearest(P, A, Cc) : appletNearest(P, B, Cc);
  return { noDraw: false, circle, P, K, L, M, F: appletFindF(L, P, Cc), G: appletFindF(K, P, Cc) };
}

/* ------------------------------------- an independent construction from angles */

/** Circumcenter from the explicit determinant formula (no perpendicular bisectors). */
function referenceCenter(a, b, c) {
  const aa = a.x * a.x + a.y * a.y;
  const bb = b.x * b.x + b.y * b.y;
  const cc = c.x * c.x + c.y * c.y;
  const den = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (!den) return null;
  return {
    x: (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / den,
    y: (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / den,
  };
}

/** The arc midpoint on C's side is O plus the radius along the bisected radii. */
function referenceP(a, b, c) {
  const O = referenceCenter(a, b, c);
  if (!O) return null;
  const r = d(O, a);
  const ua = sub(a, O), ub = sub(b, O);
  const la = Math.hypot(ua.x, ua.y), lb = Math.hypot(ub.x, ub.y);
  const v = add({ x: ua.x / la, y: ua.y / la }, { x: ub.x / lb, y: ub.y / lb });
  const vLen = Math.hypot(v.x, v.y);
  if (!vLen) return null;
  let P = add(O, mul(v, r / vLen));
  const other = add(O, mul(v, -r / vLen));
  const unit = { x: (b.x - a.x) / d(a, b), y: (b.y - a.y) / d(a, b) };
  const side = (p) => (p.x - a.x) * unit.y - (p.y - a.y) * unit.x;
  if (side(P) * side(c) < 0) P = other;
  return P;
}

/** Perpendicular foot by direct projection (no applet's 0.1 guard). */
function referenceFoot(p, a, b) {
  const v = sub(b, a);
  const t = ((p.x - a.x) * v.x + (p.y - a.y) * v.y) / (v.x * v.x + v.y * v.y);
  return add(a, mul(v, t));
}

/* ------------------------------------------------------------- configurations */

const configs = [];
const opening = C.start();
configs.push(["opening", opening.A, opening.B, opening.C]);
// A small grid of right-ish and scalene triangles, plus the swapped-side case.
const grid = [
  ["left-right", { x: 150, y: 150 }, { x: 420, y: 190 }, { x: 300, y: 360 }],
  ["up-down", { x: 180, y: 350 }, { x: 180, y: 80 }, { x: 430, y: 220 }],
  ["short AC", { x: 120, y: 120 }, { x: 500, y: 200 }, { x: 160, y: 160 }],
  ["short BC", { x: 120, y: 120 }, { x: 500, y: 200 }, { x: 470, y: 190 }],
  ["near diameter", { x: 100, y: 220 }, { x: 460, y: 220 }, { x: 300, y: 70 }],
  ["C below", { x: 240, y: 100 }, { x: 420, y: 140 }, { x: 250, y: 360 }],
];
for (const [name, A, B, Cc] of grid) configs.push([name, A, B, Cc]);
const random = rng(20261126);
for (let i = 0; i < 2000; i++) {
  configs.push([`random-${i}`,
    { x: 20 + random() * 560, y: 20 + random() * 410 },
    { x: 20 + random() * 560, y: 20 + random() * 410 },
    { x: 20 + random() * 560, y: 20 + random() * 410 }]);
}

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  for (const name of C.HANDLES) check(`start point ${name} is finite`, C.finite(s[name]));
  equal("start is exactly the applet's A", s.A, { x: 192, y: 270 });
  equal("start's default switches", [s.showNames, s.showHint, s.showLines, s.showAngles, s.showExtra],
    [true, false, false, false, false]);
  equal("start has not been explored", C.result(s), null);
  equal("a move list covers three points, five switches and reset", C.legalMoves(s).length, 9);
  check("a point move refuses a missing name", C.move(s, { type: "point", name: "Q", point: { x: 1, y: 1 } }) === null);
  check("a switch move refuses a non-boolean", C.move(s, { type: "option", key: "showHint", value: 1 }) === null);
  check("an unknown move is refused", C.move(s, { type: "shuffle" }) === null);
  check("points are clamped to the board", C.move(s, { type: "point", name: "A", point: { x: -50, y: 999 } }).A.x === 8);

  let t = C.move(s, { type: "option", key: "showHint", value: true });
  t = C.move(t, { type: "option", key: "showLines", value: true });
  t = C.move(t, { type: "option", key: "showAngles", value: true });
  t = C.move(t, { type: "option", key: "showExtra", value: true });
  equal("hint enables the three other overlays",
    [C.canvasFlags(t).showLines, C.canvasFlags(t).showAngles, C.canvasFlags(t).showExtra], [true, true, true]);
  const hidden = C.move(t, { type: "option", key: "showHint", value: false });
  equal("hint off hides the three overlays but keeps their ticks",
    [C.canvasFlags(hidden).showLines, C.canvasFlags(hidden).showAngles, C.canvasFlags(hidden).showExtra,
      hidden.showLines, hidden.showAngles, hidden.showExtra], [false, false, false, true, true, true]);
  const u = C.move(hidden, { type: "option", key: "showHint", value: true });
  equal("hint on restores previously ticked boxes",
    [C.canvasFlags(u).showLines, C.canvasFlags(u).showAngles, C.canvasFlags(u).showExtra], [true, true, true]);
  const r = C.move(u, { type: "reset" });
  equal("reset restores the three points", [r.A, r.B, r.C], [s.A, s.B, s.C]);
  equal("reset keeps the overlay choices", [r.showNames, r.showHint, r.showLines], [true, true, true]);
  check("exploring ends the picture once", C.result(r) === "done");
  check("two points closer than one unit stop the drawing",
    C.compute({ ...s, A: { x: 100, y: 100 }, B: { x: 100.5, y: 100 } }).valid === false);
}

/* -------------------------------- 2. the applet's computation, case by case */

let agreeMax = 0;
let usable = 0;
for (const [name, A, B, Cc] of configs) {
  const got = C.compute({ ...opening, A, B, C: Cc });
  const want = appletCompute(A, B, Cc);
  if (want.noDraw) {
    check(`${name}: applet draws nothing`, !got.valid && got.reason === "close");
    continue;
  }
  if (!Number.isFinite(want.P.x)) continue; // collinear: the applet itself has no drawing
  usable++;
  const pairs = [
    ["O", got.circle.O, want.circle.O], ["P", got.P, want.P],
    ["M", got.M, want.M], ["F", got.F, want.F], ["G", got.G, want.G],
  ];
  let worst = 0;
  for (const [label, a, b] of pairs) {
    if (!C.finite(a) || !Number.isFinite(b.x)) { worst = Infinity; break; }
    worst = Math.max(worst, d(a, b));
  }
  worst = Math.max(worst, Math.abs(got.circle.r - want.circle.r));
  agreeMax = Math.max(agreeMax, worst);
  check(`${name}: core matches the applet's Compute`, worst < 1e-7, `error ${worst}`);
  check(`${name}: K and L pick the longer side`, got.K === (got.longAC ? A : B) && got.L === (got.longAC ? B : A));
  check(`${name}: the crease is drawn only when PC > 1`,
    Boolean(got.linePC) === (d(got.P, Cc) > 1));
}
check("there are enough configurations to compare", usable > 1900, `${usable} usable`);
check("the numerical agreement is tight", agreeMax < 1e-7, `${agreeMax}`);

/* ------------------------------------------- 3. the page's claims, exhaustively */

let worstClaim = 0;
let claimed = 0;
const keys = ["POnCircle", "arcMidpoint", "rightAngle", "MonSegment", "CF", "CG",
  "FMidpoint", "brokenChord", "FOnExtension", "foldDirection",
  "alpha", "beta", "gamma", "alphaPlusGamma"];
const maxima = Object.fromEntries(keys.map((k) => [k, 0]));
for (const [name, A, B, Cc] of configs) {
  const g = C.compute({ ...opening, A, B, C: Cc });
  if (!g.valid || d(g.P, Cc) <= 1) continue;
  const r = C.residuals(g);
  if (!r) continue;
  // A triangle that is nearly a line makes angle comparisons meaningless.
  const area = Math.abs(C.cross(C.sub(B, A), C.sub(Cc, A)));
  if (area < 200 || d(A, Cc) < 20 || d(B, Cc) < 20) continue;
  claimed++;
  for (const k of keys) {
    maxima[k] = Math.max(maxima[k], r[k]);
    worstClaim = Math.max(worstClaim, r[k]);
  }
  for (const k of keys) check(`${name}: ${k}`, r[k] < 1e-6, `${r[k]}`);
}
check("the claims were tested on many triangles", claimed > 1400, `${claimed}`);
check("the largest claim residual is small", worstClaim < 1e-6, `${worstClaim}`);

/* ------------------------------- 4. independent angle-bisector construction */

let refMax = 0;
let refs = 0;
for (const [name, A, B, Cc] of configs) {
  const P0 = referenceP(A, B, Cc);
  if (!P0 || !C.finite(P0)) continue;
  const g = C.compute({ ...opening, A, B, C: Cc });
  if (!g.valid || d(g.P, Cc) <= 1) continue;
  const M0 = referenceFoot(P0, g.K, Cc);
  const err = Math.max(d(P0, g.P), d(M0, g.M));
  refMax = Math.max(refMax, err);
  refs++;
  check(`${name}: arc midpoint and foot match a separate construction`, err < 1e-6, `${err}`);
}
check("the independent construction covered many triangles", refs > 1500, `${refs}`);
check("independent P and M agree with the core", refMax < 1e-6, `${refMax}`);

/* ------------------------------------------- 5. the applet's tiny-PC quirk */

{
  // A and B symmetric about the vertical, C just beside the arc midpoint P:
  // the applet reflects in the point P instead of the line PC.
  const O = { x: 300, y: 270 }, r = 108;
  const at = (ang) => ({ x: O.x + r * Math.cos(ang), y: O.y + r * Math.sin(ang) });
  const A = at(Math.PI * 1.25), B = at(Math.PI * 1.75);
  const P0 = referenceP(A, B, at(Math.PI * 1.5));
  const Cc = at(Math.PI * 1.5 + 0.008);
  const got = C.compute({ ...opening, A, B, C: Cc });
  check("a near-coincident P and C was constructed", d(got.P, Cc) < 1, `${d(got.P, Cc)}`);
  check("the crease is suppressed when PC is under one unit", got.linePC === null);
  const want = appletCompute(A, B, Cc);
  check("the point-reflection quirk matches the applet", d(got.F, want.F) < 1e-7 && d(got.G, want.G) < 1e-7);
  check("arc midpoint is well defined for this case", C.finite(P0));
}

console.log(`  configurations: ${usable} with the applet's construction, ${claimed} with all claims checked, ${refs} with an independent construction`);
console.log("  maxima:", Object.entries(maxima).map(([k, v]) => `${k}=${v.toExponential(1)}`).join(" "));
done("broken-chord-paper-folding");
