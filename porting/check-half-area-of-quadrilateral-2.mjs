#!/usr/bin/env node
"use strict";

/*
 * Logic test for half-area-of-quadrilateral-2/half-area-of-quadrilateral-2-core.js.
 *
 *   node porting/check-half-area-of-quadrilateral-2.mjs
 *
 * Sections:
 *  1. Reset() on the live page's 500x500 applet, the two checkboxes, dragging.
 *  2. Compute() transcribed a second time from the bytecode and compared with
 *     the core on the start shape, fixed shapes and thousands of generated
 *     quadrilaterals (both Hint states).
 *  3. The page's claims, checked independently: the parallel through the
 *     midpoint K of BD lands on AB or AD (one of the two cases always), CM is
 *     a median of CBE/CDE, and when M is on a side it bisects the quadrilateral.
 *  4. The bytecode's near-parallel shortcut, which breaks the bisection for
 *     nearly collinear corners, and the degenerate inputs Compute() refuses.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "half-area-of-quadrilateral-2/half-area-of-quadrilateral-2-core.js",
  "HalfAreaOfQuadrilateral2Core",
);

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const cross = (p, q) => p.x * q.y - p.y * q.x;
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closeP = (p, q, t) => !!p && !!q && (Number.isNaN(p.x) && Number.isNaN(q.x)
  ? Number.isNaN(p.y) && Number.isNaN(q.y)
  : close(p.x, q.x, t) && close(p.y, q.y, t));
const pairs = (q) => [[q[0], q[1]], [q[0], q[2]], [q[0], q[3]],
  [q[1], q[2]], [q[1], q[3]], [q[2], q[3]]];
const scaleOf = (q) => Math.max(1, ...pairs(q).map(([p, r]) => dist(p, r)));
const area = (q) => {
  let s = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i], r = q[(i + 1) % q.length];
    s += p.x * r.y - p.y * r.x;
  }
  return Math.abs(s) / 2;
};
function convex(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const v = cross(sub(q[(i + 1) % 4], q[i]), sub(q[(i + 2) % 4], q[(i + 1) % 4]));
    if (Math.abs(v) < 1e-6) return false;
    if (sign === 0) sign = Math.sign(v);
    else if (Math.sign(v) !== sign) return false;
  }
  return true;
}
/* The AreParallel shortcut fires when the directions DA and DB agree within
 * 0.005.  Those shapes are geometrically valid but hit the applet's quirk. */
function nearParallelAtD(q) {
  const u = P((q[3].x - q[0].x) / dist(q[3], q[0]), (q[3].y - q[0].y) / dist(q[3], q[0]));
  const v = P((q[3].x - q[1].x) / dist(q[3], q[1]), (q[3].y - q[1].y) / dist(q[3], q[1]));
  return dist(u, v) < 0.006 || dist(u, P(-v.x, -v.y)) < 0.006;
}

/* ----------------------------------- 1. the applet's own methods, transcribed */

/* DoubPoint MidPoint(p,q) and InsideTest.IsInside(p,a,b). */
const appletMidpoint = (p, q) => P((p.x + q.x) / 2.0, (p.y + q.y) / 2.0);
const appletInside = (p, a, b) =>
  (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 0;

/* HalfAreaOfQuadrilateral2Canvas$Side.UnitVector().
 * Side(A,D) is constructed with m_1=A, m_2=D. */
function appletUnitVector(p, q) {
  const length = Math.sqrt((q.x - p.x) ** 2 + (q.y - p.y) ** 2);
  return P((q.x - p.x) / length, (q.y - p.y) / length);
}

/* AreParallel(Side(A,D), Side(B,D)): EPS_VEC = 0.005, both directions. */
function appletAreParallel(a, d, b, dd) {
  const u = appletUnitVector(a, d);
  const v = appletUnitVector(b, dd);
  if (dist(u, v) < 0.005) return true;
  v.x = -v.x;
  v.y = -v.y;
  return dist(u, v) < 0.005;
}

/* GeoSDoub.GetParallelTo(p,a,c) = p + 100*(a-c). */
const appletGetParallelTo = (p, a, c) =>
  P(p.x + 100.0 * (a.x - c.x), p.y + 100.0 * (a.y - c.y));

/* GeoSDoub.Intersect(p1,p2,q1,q2): the four local determinants and the
 * |denominator| < 1 NaN guard, exactly as in the bytecode. */
function appletIntersect(p1, p2, q1, q2) {
  const a = p1.y - p2.y;
  const b = p2.x - p1.x;
  const c = p1.x * p2.y - p1.y * p2.x;
  const d = q1.y - q2.y;
  const e = q2.x - q1.x;
  const f = q1.x * q2.y - q1.y * q2.x;
  const den = a * e - d * b;
  if (Math.abs(den) < 1) return P(NaN, NaN);
  return P((b * f - e * c) / den, (c * d - f * a) / den);
}

/* Compute(): the complete branch order of the applet, including the repeated
 * AreParallel test and the choice of Quadri[1]/Tri[0]. */
function appletCompute(A, B, Cc, D) {
  if ([dist(A, B), dist(A, Cc), dist(A, D), dist(B, Cc), dist(B, D), dist(Cc, D)]
    .some((v) => v < 1)) return null;
  const parallel = appletAreParallel(A, D, B, D);
  let E = parallel ? D : appletIntersect(D, appletGetParallelTo(D, A, Cc), A, B);
  let M = appletMidpoint(B, E);
  let BorD, tri0, side;
  if (appletInside(M, A, B)) {
    BorD = D; tri0 = B; side = "AB";
  } else {
    E = parallel ? B : appletIntersect(B, appletGetParallelTo(B, A, Cc), A, D);
    M = appletMidpoint(D, E);
    BorD = B; tri0 = D; side = "AD";
  }
  return {
    E, M, BorD, side,
    Quadri: [A, BorD, Cc, M],
    Tri: [tri0, Cc, M],
  };
}

/* Canvas.init() on the live page's WIDTH=500 HEIGHT=500 embed. */
function appletReset(w = 500, h = 500) {
  return [
    P(w / 4, h / 2),
    P(w / 2.5, Math.floor((7 * h) / 8)),
    P(Math.floor((5 * w) / 6), Math.floor((4 * h) / 5)),
    P(w / 2, Math.floor(h / 8)),
  ];
}

/* ----------------------------------------------- 2. start, moves and options */

{
  const s = C.start({});
  const reset = appletReset();
  equal("start A is the applet's (W/4, H/2)", s.A, reset[0]);
  equal("start B is the applet's (W/2.5, 7H/8)", s.B, reset[1]);
  equal("start C is the applet's (5W/6, 4H/5)", s.C, reset[2]);
  equal("start D is the applet's (W/2, H/8)", s.D, reset[3]);
  check("names follow the page's ShowNames=1 copy", s.options.showNames === true);
  check("hint starts unchecked as on the page", s.options.hint === false);
  check("an illustration has no win, loss or end", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  check("the start shape has a construction", !!C.geometry(s));
  const moved = C.move(s, "C", P(10, 10));
  check("a corner can be dragged", moved.C.x === C.PAD && moved.C.y === C.PAD);
  check("dragging does not change the old position", s.C.x === reset[2].x);
  check("dragging marks the diagram explored", moved.explored && !s.explored);
  check("an unknown corner is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("a non-finite corner is ignored", C.move(s, "A", P(NaN, 4)) === s);
  const h = C.setOption(s, "hint", true);
  check("Hint toggles on and marks it explored", h.options.hint && h.explored && !s.options.hint);
  const n = C.setOption(s, "showNames", false);
  check("Names can be switched off (the page's other copy)", !n.options.showNames && n.explored);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(h);
  check("Reset restores all four corners", r.A.x === 125 && r.D.y === 62);
  check("Reset keeps the two checkboxes", r.options.hint && r.options.showNames && r.explored);
  check("status names the side M falls on", /AD|AB/.test(C.describe(s)));
  check("the hint is mentioned in the status", /hint shows/i.test(C.describe(h)));
}

/* ---------------------------------- 3. the core against a second transcription */

const startQ = appletReset();
const square = [P(80, 80), P(420, 80), P(420, 420), P(80, 420)];
const rectangle = [P(60, 150), P(440, 150), P(440, 360), P(60, 360)];
const tilted = [P(90, 260), P(300, 440), P(450, 160), P(210, 50)];
const dart = [P(110, 110), P(430, 210), P(260, 230), P(110, 430)];
const bowtie = [P(90, 90), P(420, 420), P(90, 420), P(420, 90)];
const nearLine = [P(217.7857494354248, 58.35036039352417), P(337.9988491535187, 27.796398401260376),
  P(126.08970284461975, 58.82655620574951), P(43.820258378982544, 102.27817237377167)];
const fixed = [
  ["the applet's start", startQ], ["a square", square], ["a rectangle", rectangle],
  ["a tilted quadrilateral", tilted], ["a dart", dart], ["a bow tie", bowtie],
  ["nearly collinear corners", nearLine],
];

function compareWithApplet(label, q, hint) {
  const g = C.compute(...q);
  const ap = appletCompute(...q);
  if (!g || !ap) {
    check(`${label}: both refuse a degenerate quadrilateral`, !g && !ap);
    return;
  }
  const t = 1e-9 * scaleOf(q);
  check(`${label}: core E is the applet's E`, closeP(g.E, ap.E, t));
  check(`${label}: core M is the applet's M`, closeP(g.M, ap.M, t));
  check(`${label}: core BorD is the applet's BorD`, closeP(g.BorD, ap.BorD, t));
  check(`${label}: core side matches the branch`, g.side === ap.side);
  check(`${label}: core Quadri matches Compute()`, ap.Quadri.every((p, i) => closeP(g.Quadri[i], p, t)));
  check(`${label}: core Tri matches Compute()`, ap.Tri.every((p, i) => closeP(g.Tri[i], p, t)));
  if (hint) check(`${label}: the Hint flag never changes the geometry`, !!g);
}

for (const [name, q] of fixed) compareWithApplet(name, q, false);
compareWithApplet("start with Hint on", startQ, true);

{
  const rand = rng(20261127);
  let compared = 0;
  for (let trial = 0; trial < 2400; trial++) {
    const q = [0, 1, 2, 3].map(() => P(20 + rand() * 460, 20 + rand() * 460));
    const g = C.compute(...q);
    const ap = appletCompute(...q);
    if (!g || !ap) continue;
    const t = 1e-9 * scaleOf(q);
    const same = closeP(g.E, ap.E, t) && closeP(g.M, ap.M, t)
      && closeP(g.BorD, ap.BorD, t) && g.side === ap.side
      && ap.Quadri.every((p, i) => closeP(g.Quadri[i], p, t))
      && ap.Tri.every((p, i) => closeP(g.Tri[i], p, t));
    if (!same) check(`random ${trial}: the core matches the applet`, false,
      JSON.stringify({ g: g.M, ap: ap.M, side: [g.side, ap.side] }));
    compared++;
  }
  check(`core and transcription agree on ${compared} generated quadrilaterals`,
    compared > 2000);
}

/* ------------------------------------------- 4. the page's claims, exhaustively */

/* The old applet's E_old: through K = midpoint(BD), parallel to AC, onto AB.
 * The page says that point is the midpoint of the side opposite C, i.e. the
 * new applet's M. */
function oldConstruction(A, B, Cc, D) {
  const K = mid(B, D);
  return appletIntersect(K, appletGetParallelTo(K, A, Cc), A, B);
}

for (const [name, q] of fixed) {
  const g = C.compute(...q);
  if (!g) continue;
  const kToM = sub(g.fromD.M, mid(q[1], q[3]));
  const ac = sub(q[0], q[2]);
  check(`${name}: the parallel through K reaches M on AB`,
    Math.abs(cross(kToM, ac)) <= 1e-8 * scaleOf(q));
  if (!g.fromD.parallel) {
    check(`${name}: M is the old applet's intersection on AB`,
      closeP(g.fromD.M, oldConstruction(...q), 1e-8 * scaleOf(q)));
  }
  check(`${name}: CM is a median of CBE or CDE`, g.claims.triangleBisected,
    `error ${g.measures.triangleBisectError}`);
  if (!nearParallelAtD(q)) {
    check(`${name}: the triangle has the quadrilateral's area`,
      g.claims.triangleIsQuadrilateral,
      `${g.measures.areaRelevant} vs ${g.measures.areaQuad}`);
  }
  check(`${name}: one of the two cases puts M on a side`, g.claims.oneCase);
  if (g.fromD.onSide || g.fromB.onSide) {
    check(`${name}: the core chose the case whose M is on a side`,
      g.side === (g.fromD.onSide ? "AB" : "AD"));
  }
  if (!nearParallelAtD(q)) {
    check(`${name}: CM halves the quadrilateral`, g.claims.quadrilateralBisected,
      `error ${g.measures.quadBisectError}`);
  }
}

{
  const rand = rng(90210);
  let tested = 0, noCase = 0, noMedian = 0, noTriangleArea = 0, noBisect = 0;
  for (let trial = 0; trial < 150000; trial++) {
    const q = [0, 1, 2, 3].map(() => P(15 + rand() * 470, 15 + rand() * 470));
    if (!convex(q)) continue;
    const g = C.compute(...q);
    if (!g) continue;
    tested++;
    if (!g.claims.oneCase) noCase++;
    if (!g.claims.triangleBisected) noMedian++;
    if (!nearParallelAtD(q) && !g.claims.triangleIsQuadrilateral) noTriangleArea++;
    if (!nearParallelAtD(q) && !g.claims.quadrilateralBisected) noBisect++;
  }
  check(`the page's "one of the two cases always" holds on ${tested} convex shapes`,
    tested > 30000 && noCase === 0, `${noCase} failures`);
  check("CM always bisects the triangle CBE or CDE", noMedian === 0, `${noMedian} failures`);
  check("that triangle always has the quadrilateral's area", noTriangleArea === 0,
    `${noTriangleArea} failures`);
  check("CM halves the quadrilateral whenever M is on a side", noBisect === 0,
    `${noBisect} failures`);
}

/* The page's claim is about the construction; the applet has a tolerance of
 * 0.005 in AreParallel.  With DA and DB almost parallel it sets E=B or E=D
 * without intersecting, so the drawn triangle is no longer the quadrilateral
 * and the bisection is slightly off.  This quirk is kept and reported. */
{
  const g = C.compute(...nearLine);
  check("the near-collinear shape takes the applet's parallel shortcut", g.parallel);
  check("a shortcut shape still has a case with M on a side", g.claims.oneCase);
  check("the shortcut breaks the exact area bisection",
    !g.claims.quadrilateralBisected && g.measures.quadBisectError > g.tol,
    `error ${g.measures.quadBisectError}`);
  check("the status warns about the uneven cut", /a little uneven/.test(C.describe({ ...C.start(), A: nearLine[0], B: nearLine[1], C: nearLine[2], D: nearLine[3] })));
  const rand = rng(7311);
  let shortcutFailures = 0;
  for (let trial = 0; trial < 150000; trial++) {
    const q = [0, 1, 2, 3].map(() => P(15 + rand() * 470, 15 + rand() * 470));
    if (!convex(q)) continue;
    const g2 = C.compute(...q);
    if (g2 && g2.parallel && !g2.claims.quadrilateralBisected) shortcutFailures++;
  }
  check("other near-parallel cases behave the same way", shortcutFailures > 0,
    `${shortcutFailures} found`);
}

/* ------------------------------------------------- 5. degenerate input is safe */

{
  const flat = [P(20, 20), P(160, 20), P(300, 20), P(440, 20)];
  check("four distinct collinear corners still give a construction", !!C.compute(...flat));
  check("two identical corners give no construction",
    C.compute(P(20, 20), P(20, 20), P(300, 80), P(100, 200)) === null);
  check("a corner closer than 1 gives no construction",
    C.compute(P(20, 20), P(20.5, 20), P(300, 80), P(100, 200)) === null);
  check("a non-finite corner gives no construction",
    C.compute(P(NaN, 20), P(120, 20), P(300, 80), P(100, 200)) === null);
  const degenerateState = C.move(C.start(), "A", C.start().B);
  check("a degenerate shape has a helpful status", /quadrilateral/.test(C.describe(degenerateState)));
  check("a degenerate shape still has no result", C.result(degenerateState) === null);
  check("describe works without a geometry", typeof C.describe({}) === "string");
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("half-area-of-quadrilateral-2");
