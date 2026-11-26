#!/usr/bin/env node
"use strict";

/*
 * Logic test for broken-chord-mr-homm/broken-chord-mr-homm-core.js.
 *
 *   node porting/check-broken-chord-mr-homm.mjs
 *
 * The page's claim is the Broken Chord Theorem: P is the midpoint of arc ACB,
 * PM is perpendicular to the longer of AC and BC, and M cuts the broken line
 * A-C-B in half.  For AC > BC that says AM = MC + BC; for BC > AC it says
 * BM = MC + AC.  We check it on exact triangles and 1,600 generated ones
 * (points on a circle and free points in the board), and also check the
 * equalities in the page's proof where that proof applies (AC > BC).
 *
 * The last part is a second, independent transcription of the applet's own
 * Compute()/FindP()/FindQ()/FindF() bytecode: GeoSDoub.FindCircumcenter,
 * Intersect(line,circle) via IntersectX/IntersectY, FindOrientation,
 * NearestPoint and the four-determinant line intersection.  Both
 * implementations are compared on every case, with no shared geometry code.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("broken-chord-mr-homm/broken-chord-mr-homm-core.js", "BrokenChordMrHommCore");

/* ---------------------------------- the applet's own methods, transcribed */

const P = (x, y) => ({ x, y });
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const add = (a, b) => P(a.x + b.x, a.y + b.y);
const mul = (a, t) => P(a.x * t, a.y * t);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// GeoSDoub.FindOrientation: > 0 gives 1, else -1 (the reverse of cross()).
function orientation(p, q, r) {
  const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return v > 0 ? 1 : -1;
}

// GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), determinant
// by determinant from javap; a NaN point means parallel lines.
function intersectLines(a, b, c, d) {
  const s4 = a.y - b.y;
  const s6 = b.x - a.x;
  const s8 = a.x * b.y - a.y * b.x;
  const s10 = c.y - d.y;
  const s12 = d.x - c.x;
  const s14 = c.x * d.y - c.y * d.x;
  const s16 = s6 * s14 - s12 * s8;
  const s18 = s8 * s10 - s14 * s4;
  const s20 = s4 * s12 - s10 * s6;
  if (Math.abs(s20) < 1) return P(NaN, NaN);
  return P(s16 / s20, s18 / s20);
}

// GeoSDoub.IntersectX(DoubLine,DoubCircle): x = t*y + b.
function intersectX(u, v, circle) {
  const t = (u.x - v.x) / (u.y - v.y);
  const b = v.x - t * v.y;
  const q = 1 + t * t;
  const e = t * (b - circle.c.x) - circle.c.y;
  const c = circle.c.y * circle.c.y + (b - circle.c.x) * (b - circle.c.x) - circle.r * circle.r;
  const disc = e * e - q * c;
  if (!(disc >= 0)) return null;
  const s = Math.sqrt(disc);
  const y1 = (-e + s) / q, y2 = (-e - s) / q;
  return [P(t * y1 + b, y1), P(t * y2 + b, y2)];
}

// GeoSDoub.IntersectY(DoubLine,DoubCircle): y = t*x + b.
function intersectY(u, v, circle) {
  const t = (u.y - v.y) / (u.x - v.x);
  const b = v.y - t * v.x;
  const q = 1 + t * t;
  const e = t * (b - circle.c.y) - circle.c.x;
  const c = circle.c.x * circle.c.x + (b - circle.c.y) * (b - circle.c.y) - circle.r * circle.r;
  const disc = e * e - q * c;
  if (!(disc >= 0)) return null;
  const s = Math.sqrt(disc);
  const x1 = (-e + s) / q, x2 = (-e - s) / q;
  return [P(x1, t * x1 + b), P(x2, t * x2 + b)];
}

// GeoSDoub.Intersect(DoubLine,DoubCircle): X when |dx| > 1, else Y.
function intersectLineCircle(u, v, circle) {
  if (Math.abs(u.x - v.x) > 1) return intersectX(u, v, circle);
  if (Math.abs(u.y - v.y) > 1) return intersectY(u, v, circle);
  return null;
}

// GeoSDoub.FindCircumcenter + GetCircle (the applet averages the radii).
function findCircumcenter(a, b, c) {
  const mid1 = mul(add(a, b), 0.5);
  const mid2 = mul(add(b, c), 0.5);
  const tip1 = P(mid1.x + b.y - a.y, mid1.y - (b.x - a.x));
  const tip2 = P(mid2.x + c.y - b.y, mid2.y - (c.x - b.x));
  return intersectLines(mid1, tip1, mid2, tip2);
}

function getCircle(a, b, c) {
  const o = findCircumcenter(a, b, c);
  return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
}

// GeoSDoub.NearestPoint(p,a,b): the foot on the infinite line a->b.
function nearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * dx + dy * dy < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + dx * t, a.y + dy * t);
}

/* BrokenChordMrHommCanvas.Compute(), FindP(), FindQ(), FindF(), line for line. */
function appletCompute(a, b, c) {
  if (dist(a, b) < 1) return null; // NoDraw
  const circle = getCircle(a, b, c);
  const mid = mul(add(a, b), 0.5);
  const tip = P(mid.x + b.y - a.y, mid.y - (b.x - a.x));
  const arcPoints = intersectLineCircle(mid, tip, circle);
  if (!arcPoints) return null;
  const p = orientation(arcPoints[0], a, b) === orientation(c, a, b)
    ? arcPoints[0] : arcPoints[1];

  let m, k, l;
  if (dist(a, c) > dist(b, c)) {
    m = nearestPoint(p, a, c); k = a; l = b;
  } else {
    m = nearestPoint(p, b, c); k = b; l = a;
  }

  const qPoints = intersectLineCircle(p, m, circle);
  if (!qPoints) return null;
  const q = dist(qPoints[0], p) >= 1 ? qPoints[0] : qPoints[1];
  const f = intersectLines(a, c, b, q);
  return { circle, p, m, k, l, q, f };
}

/* ------------------------------------------------------------- test cases */

const exact = [
  ["start", C.start({}).A, C.start({}).B, C.start({}).C],
  ["equilateral", P(200, 60), P(122.06, 225), P(277.94, 225)],
  ["long AC", P(100, 100), P(300, 120), P(220, 45)],
  ["long BC", P(140, 90), P(330, 200), P(220, 45)],
  ["right angle", P(80, 220), P(320, 220), P(80, 60)],
  ["flat", P(40, 150), P(360, 150), P(200, 138)],
];

const rand = rng(2842);
const cases = exact.map(([name, a, b, c]) => ({ name, a, b, c }));
for (let i = 0; i < 800; i++) {
  const t = [rand() * 2 * Math.PI, rand() * 2 * Math.PI, rand() * 2 * Math.PI];
  const on = (v) => P(200 + 90 * Math.cos(v), 150 + 90 * Math.sin(v));
  const a = on(t[0]), b = on(t[1]), c = on(t[2]);
  if (dist(a, b) < 20 || Math.abs(Math.sin(t[1] - t[0])) < 0.02) continue;
  cases.push({ name: `on-circle-${i}`, a, b, c });
}
for (let i = 0; i < 800; i++) {
  const a = P(22 + rand() * 356, 22 + rand() * 256);
  const b = P(22 + rand() * 356, 22 + rand() * 256);
  const c = P(22 + rand() * 356, 22 + rand() * 256);
  const area = Math.abs(sub(b, a).x * sub(c, a).y - sub(b, a).y * sub(c, a).x) / 2;
  if (area < 900 || dist(a, b) < 30 || dist(a, c) < 15 || dist(b, c) < 15) continue;
  cases.push({ name: `free-${i}`, a, b, c });
}

/* ------------------------------------- 1. the state and its two options */

{
  const s = C.start({});
  check("the start has the applet's three draggable corners",
    [s.A, s.B, s.C].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  check("the start sits on the applet's circle",
    [s.A, s.B, s.C].every((p) => Math.abs(dist(C.HOME, p) - C.HOME.r) < 1e-9));
  check("names are on and the hint is off by default", s.options.names === true && s.options.hint === false);
  check("an illustration has no win, loss or result", C.result(s) === null);
  check("the start has a drawing", !!C.geometry(s));
  const moved = C.move(s, "A", P(9999, -9999));
  check("dragging clamps a corner to the board",
    moved.A.x <= C.VIEW.width - C.PAD && moved.A.y >= C.PAD);
  check("dragging marks the picture explored", moved.explored === true && !s.explored);
  check("an unknown handle is refused", C.move(s, "Z", P(1, 1)) === s);
  const optioned = C.setOption(s, "hint", true);
  check("toggling the hint keeps the old state", optioned.options.hint && !s.options.hint);
  check("an unknown option is refused", C.setOption(s, "nope", true) === s);
  check("reset keeps the options but restores the corners",
    C.reset(optioned).options.hint === true && C.reset(optioned).A.x === s.A.x);
  check("two corners on top of each other have no drawing",
    C.compute(P(100, 100), P(100, 100), P(200, 200)) === null);
  check("the status states the theorem", /MC \+ B|C/.test(C.describe(s)) && /long side/.test(C.describe(s)));
  check("the hint status names Q and F", /Q and F/.test(C.describe(optioned)));
  check("a moved corner changes the drawing",
    dist(C.geometry(moved).P, C.geometry(s).P) > 1e-6);
}

/* ------------------------------ 2. the theorem and the page's other claims */

let n = 0, degenerate = 0, mismatch = 0, theorem = 0, arcMid = 0, perp = 0, qOn = 0, qLine = 0, fOn = 0;
let proof = 0, angleQ = 0, proofCases = 0, angleCases = 0;
let claimErr = 0, appletErr = 0;

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const onLine = (p, a, b) => {
  const v = sub(b, a), w = sub(p, a);
  return Math.abs(v.x * w.y - v.y * w.x) / Math.max(1, dist(a, b)) < 1e-6;
};

for (const { a, b, c } of cases) {
  const g = C.compute(a, b, c);
  const x = appletCompute(a, b, c);
  // The applet also refuses to draw when P and C almost coincide: the line
  // PM is then too short for GeoSDoub.Intersect(line,circle).
  if (!g || !x) {
    if (!!g !== !!x) mismatch++;
    degenerate++;
    continue;
  }
  n++;
  const L = g.lengths;

  // The exact claim on the page, with the long side chosen as in the applet.
  const claim = g.longSide === "AC" ? L.AM - (L.MC + L.BC) : L.BM - (L.MC + L.AC);
  claimErr = Math.max(claimErr, Math.abs(claim));
  if (Math.abs(claim) < 1e-6) theorem++;

  // P is the midpoint of the arc ACB: on the circle, on C's side of AB.
  if (near(dist(g.circle.c, g.P), g.circle.r) &&
      C.orientation(g.P, a, b) === C.orientation(c, a, b)) arcMid++;
  // PM is perpendicular to the long chord, and M is its foot on that chord.
  if (Math.abs(dot(sub(g.P, g.M), sub(g.C, g.K))) < 1e-6 && onLine(g.M, g.K, g.C)) perp++;
  // Q is the far meeting of PM with the circle; F = AC ∩ BQ.
  if (near(dist(g.circle.c, g.Q), g.circle.r)) qOn++;
  if (onLine(g.Q, g.P, g.M)) qLine++;
  if (g.F && onLine(g.F, a, c) && onLine(g.F, b, g.Q)) fOn++;

  // The page's proof: for AC > BC it builds AQF and claims AM = MF and
  // BC = CF.  QP bisects ∠AQB only when Q lies on the other arc AB.
  if (g.longSide === "AC") {
    proofCases++;
    const e1 = Math.abs(dist(g.K, g.M) - dist(g.M, g.F));
    const e2 = Math.abs(L.BC - dist(g.C, g.F));
    claimErr = Math.max(claimErr, e1, e2);
    if (e1 < 1e-6 && e2 < 1e-6) proof++;
    if (C.orientation(g.Q, a, b) !== C.orientation(g.P, a, b)) {
      angleCases++;
      const e3 = Math.abs(C.angle(g.Q, a, g.P) - C.angle(g.Q, b, g.P));
      claimErr = Math.max(claimErr, e3);
      if (e3 < 1e-6) angleQ++;
    }
  }
  // The second transcription: same circle, P, M, Q, F, K, L.
  const errs = [
    dist(g.circle.c, x.circle.c), Math.abs(g.circle.r - x.circle.r),
    dist(g.P, x.p), dist(g.M, x.m), dist(g.Q, x.q),
    g.K === a ? dist(g.K, x.k) : 0,
  ];
  if (Number.isFinite(x.f.x)) errs.push(dist(g.F, x.f));
  const worst = Math.max(...errs);
  appletErr = Math.max(appletErr, worst);
}

{
  check(`both implementations refuse the same ${degenerate} near-degenerate cases`,
    mismatch === 0 && n + degenerate === cases.length, `${mismatch} disagreements`);
  check(`every other exact/generated triangle (${n}) draws`, n > 1300, `${n}/${cases.length}`);
  check(`AM = MC + BC or BM = MC + AC on every case (${theorem}/${n})`, theorem === n);
  check(`P is on the circle and on C's side of AB (${arcMid}/${n})`, arcMid === n);
  check(`PM is perpendicular to the long chord at its foot (${perp}/${n})`, perp === n);
  check(`Q is the far intersection of PM with the circle (${qOn}/${n})`, qOn === n);
  check(`Q lies on line PM (${qLine}/${n})`, qLine === n);
  check(`F lies on AC and BQ (${fOn}/${n})`, fOn === n);
  check(`the page's proof equalities hold when AC > BC (${proof}/${proofCases})`, proof === proofCases);
  check(`QP bisects angle AQB on the other arc (${angleQ}/${angleCases})`, angleQ === angleCases);
  check(`the geometric claims hold to ${claimErr.toExponential(1)}`, claimErr < 1e-6);
  check(`the core matches the applet's bytecode to ${appletErr.toExponential(1)}`, appletErr < 1e-5);
}

done("broken-chord-mr-homm");
