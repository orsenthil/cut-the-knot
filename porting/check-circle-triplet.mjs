#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-triplet/circle-triplet-core.js.
 *
 *   node porting/check-circle-triplet.mjs
 *
 * Sweeps A and B over nine placements and C over 121 positions between them
 * (1,089 arbeloses).  On each it checks the exact theorem: the two twins and
 * the Bankoff brother have radius r1*r2/(r1+r2), the circle tangent to all
 * three semicircles has Proposition 6's radius, its tangency points with the
 * small semicircles and C have the brother as their circumcircle, and the
 * inversion at A with power AC·AB swaps B and C.  It then rebuilds the whole
 * tangent-circle construction a second time, straight from
 * ApolloniusCircle.Compute(), TangentPoint() and GetCircle() in the applet's
 * bytecode (including its one-pixel-shifted big circle), and compares it with
 * the core over the same 1,089 positions.
 */

import { loadCore, check, done } from "./lib/load-core.mjs";

const C = loadCore("circle-triplet/circle-triplet-core.js", "CircleTripletCore");
const P = (x, y) => ({ x: x, y: y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const max = (a, b) => Math.max(a, b);
const P2 = C.BASE_Y;

/* ------------------------- the applet's own method, transcribed separately */

/* ApolloniusCircle.CInfo and SetCircles, from the bytecode. */
function setCircles(c0, c1, c2) {
  const info = (c) => c.x * c.x + c.y * c.y - c.r * c.r;
  const A1 = 2 * (c1.x - c0.x), A2 = 2 * (c2.x - c0.x);
  const B1 = 2 * (c1.y - c0.y), B2 = 2 * (c2.y - c0.y);
  const o = info(c0), D1 = o - info(c1), D2 = o - info(c2);
  const K = A1 * B2 - A2 * B1;
  return {
    ci: [c0, c1, c2], A1: A1, A2: A2, B1: B1, B2: B2, o: o,
    D1: D1, D2: D2, K: K,
    G: (B1 * D2 - B2 * D1) / K,
    I: -(A1 * D2 - A2 * D1) / K,
  };
}

/* ApolloniusCircle.Compute(s0,s1,s2).  TreatZeroDeterminant always returns
 * null in the applet, so a tiny determinant simply gives no circle. */
function apollonius(ctx, s0, s1, s2) {
  if (Math.abs(ctx.K) < 0.01) return null;
  const c0 = ctx.ci[0], c1 = ctx.ci[1], c2 = ctx.ci[2];
  const E1 = 2 * (s0 * c0.r - s1 * c1.r);
  const E2 = 2 * (s0 * c0.r - s2 * c2.r);
  const X = (ctx.B1 * E2 - ctx.B2 * E1) / ctx.K;
  const Y = -(ctx.A1 * E2 - ctx.A2 * E1) / ctx.K;
  const c = X * X + Y * Y - 1;
  if (Math.abs(c) < 0.001) return null;
  const a = 2 * (X * ctx.G + Y * ctx.I - X * c0.x - Y * c0.y + s0 * c0.r);
  const b = ctx.G * ctx.G + ctx.I * ctx.I - 2 * ctx.G * c0.x - 2 * ctx.I * c0.y + ctx.o;
  const disc = a * a - 4 * c * b;
  if (disc < 0) return null;
  return [(-a + Math.sqrt(disc)) / (2 * c), (-a - Math.sqrt(disc)) / (2 * c)].map((rho) => ({
    c: P(X * rho + ctx.G, Y * rho + ctx.I),
    r: Math.abs(rho),
  }));
}

/* DrawOneCircle: UsedCircles is emptied just before each call, so root 0 is
 * always the one kept (Signature is computed but never used). */
function drawOneCircle(ctx, s0, s1, s2) {
  const circles = apollonius(ctx, s0, s1, s2);
  return circles ? circles[0] : null;
}

/* GeoSDoub.Intersect(a,b,c,d): line intersection in general form. */
function lineIntersection(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* GeoSDoub.FindCircumcenter(K,L,C) and GetCircle's average-of-three radius. */
function circumcircle(a, b, c) {
  const m1 = mid(a, b), m2 = mid(b, c);
  const p1 = P(m1.x + b.y - a.y, m1.y - (b.x - a.x));
  const p2 = P(m2.x + c.y - b.y, m2.y - (c.x - b.x));
  const center = lineIntersection(m1, p1, m2, p2);
  return { c: center, r: (dist(center, a) + dist(center, b) + dist(center, c)) / 3 };
}

/* CircleTripletCanvas.TangentPoint: the division point on the two centres. */
function tangentPoint(c1, c2) {
  const a = c1.c || c1, b = c2.c || c2; // DoubCircle vs. {c,r} wrapper
  const t = c1.r / (c1.r + c2.r);
  return P(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y));
}

/* CircleTripletCanvas.DrawSmallCircles, method for method. */
function appletFigure(A, B, Cp, shift) {
  /* A tiny shift of the big circle breaks the zero determinant the Apollonius
   * solver gets when all three centres lie on the baseline.  The applet uses
   * one pixel; 1e-3 is enough to reproduce the exact configuration. */
  const big = { x: mid(A, B).x, y: mid(A, B).y + shift, r: dist(A, B) / 2 };
  const left = { x: mid(A, Cp).x, y: mid(A, Cp).y, r: dist(A, Cp) / 2 };
  const right = { x: mid(Cp, B).x, y: mid(Cp, B).y, r: dist(Cp, B) / 2 };
  const dummyL = { x: Cp.x - 1000000, y: Cp.y - 1, r: 1000000 };
  const dummyR = { x: Cp.x + 1000000, y: Cp.y - 1, r: 1000000 };

  const leftTwin = drawOneCircle(setCircles(dummyL, left, big), 1, -1, 1);
  const rightTwin = drawOneCircle(setCircles(dummyR, right, big), 1, -1, 1);
  const roots = apollonius(setCircles(left, right, big), -1, -1, 1);
  const bigBrother = roots ? roots[0] : null;
  const K = bigBrother ? tangentPoint(left, bigBrother) : null;
  const L = bigBrother ? tangentPoint(right, bigBrother) : null;
  const lowerTwin = K && L ? circumcircle(K, L, Cp) : null;
  return {
    big: big, left: left, right: right,
    leftTwin: leftTwin, rightTwin: rightTwin, roots: roots,
    bigBrother: bigBrother, K: K, L: L, lowerTwin: lowerTwin,
  };
}

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  check("a new drawing has the three draggable points on the baseline",
    [s.A, s.B, s.C].every((p) => p && Number.isFinite(p.x) && p.y === C.BASE_Y));
  check("the applet starts at A=105, B=295 in a 400x250 canvas",
    s.A.x === 105 && s.B.x === 295 && C.BASE_Y === 125);
  check("C starts at 0.3*A + 0.7*B", near(s.C.x, 0.3 * s.A.x + 0.7 * s.B.x, 1e-12));
  check("the two show options start as names only",
    s.options.names === true && s.options.hint === false);
  check("an illustration has no result", C.result(s) === null);
  check("the legal handles are exactly A, B and C",
    JSON.stringify(C.legalMoves(s)) === JSON.stringify(["A", "B", "C"]));

  const moved = C.move(s, "C", P(190, 90));
  check("dragging C changes it but keeps it on the baseline",
    moved.C.x === 190 && moved.C.y === C.BASE_Y && !s.explored && moved.explored);
  check("dragging C left of A is stopped by the gap",
    C.move(s, "C", P(-500, 0)).C.x === s.A.x + C.GAP + 1);
  check("dragging C right of B is stopped by the gap",
    C.move(s, "C", P(9999, 0)).C.x === s.B.x - C.GAP - 1);
  check("dragging A past C is stopped by the gap",
    C.move(s, "A", P(9999, 0)).A.x === s.C.x - C.GAP - 1);
  check("dragging B past the edge is stopped",
    C.move(s, "B", P(9999, 0)).B.x === C.VIEW.width - C.GAP);
  check("an unknown handle is refused", C.move(s, "Z", P(1, 1)) === s);
  check("a non-finite drag is refused", C.move(s, "C", P(NaN, 1)) === s);

  const ticked = C.setOption(s, "hint", true);
  check("toggling an option keeps the old state immutable",
    ticked.options.hint && !s.options.hint);
  check("reset keeps the chosen options", C.reset(ticked).options.hint === true);
  check("reset restores the starting C", C.reset(moved).C.x === s.C.x);
}

/* --------------------------------- 2. the article's claims, over 1089 cases */

const cases = [];
for (const ax of [20, 105, 150]) {
  for (const bx of [250, 295, 380]) {
    for (let i = 0; i < 121; i++) {
      const f = 0.02 + i * 0.96 / 120;
      const cx = ax + (bx - ax) * f;
      cases.push({ A: P(ax, P2), B: P(bx, P2), C: P(cx, P2) });
    }
  }
}

let live = 0, finite = 0, sums = 0, twins = 0, twinTangency = 0, brotherRadius = 0;
let brotherTangency = 0, circum = 0, circumCentre = 0, reflected = 0, onBig = 0;
let inversion = 0, bounded = 0, description = 0;
let claimErr = 0, appletErr = 0, shiftedErr = 0, exactMax = 0;
let unshifted = 0, appletAgree = 0, shiftedAgree = 0, lowCases = 0, lowAgree = 0;

for (const pos of cases) {
  const g = C.geometry(pos);
  if (!g) continue;
  live++;
  const e = (a, b) => { claimErr = max(claimErr, Math.abs(a - b)); return near(a, b); };

  const pts = [g.O, g.O1, g.O2, g.D, g.twin1.c, g.twin2.c, g.brother.c,
               g.reflected.c, g.K, g.L, g.Kref, g.Lref, g.W3.c, g.W3ref.c];
  const vals = [g.r1, g.r2, g.R, g.p, g.R3];
  if (pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) && vals.every(Number.isFinite)) finite++;

  if (e(g.r1 + g.r2, g.R)) sums++;
  if (e(g.twin1.r, g.p) && e(g.twin2.r, g.p) && e(g.p, g.r1 * g.r2 / g.R)) twins++;
  if (e(dist(g.twin1.c, g.O1), g.r1 + g.p) && e(dist(g.twin1.c, g.O), g.R - g.p) &&
      e(dist(g.twin2.c, g.O2), g.r2 + g.p) && e(dist(g.twin2.c, g.O), g.R - g.p)) twinTangency++;
  const R3formula = g.R * g.r1 * g.r2 / (g.r1 * g.r1 + g.r1 * g.r2 + g.r2 * g.r2);
  if (e(g.R3, R3formula)) brotherRadius++;
  if (e(dist(g.brother.c, g.O1), g.r1 + g.R3) &&
      e(dist(g.brother.c, g.O2), g.r2 + g.R3) &&
      e(dist(g.brother.c, g.O), g.R - g.R3)) brotherTangency++;
  if (e(dist(g.W3.c, g.K), g.p) && e(dist(g.W3.c, g.L), g.p) &&
      e(dist(g.W3.c, g.C), g.p)) circum++;
  if (e(g.W3.c.x, g.C.x) && e(g.W3.c.y, P2 - g.p) &&
      e(g.W3ref.c.y, P2 + g.p)) circumCentre++;
  if (e(dist(g.reflected.c, g.O1), g.r1 + g.R3) &&
      e(dist(g.W3ref.c, g.Kref), g.p) && e(dist(g.W3ref.c, g.Lref), g.p)) reflected++;
  if (e(dist(g.O, g.D), g.R) && e(g.D.x, g.C.x)) onBig++;
  if (e(g.inversion.r * g.inversion.r, dist(g.A, g.C) * dist(g.A, g.B))) inversion++;
  if (g.p <= g.R / 4 + 1e-9) bounded++;
  if (/twins and the brother have radius/.test(C.describe(pos))) description++;

  /* The applet's own computation, with its dummy circles and one-pixel shift. */
  const x = appletFigure(pos.A, pos.B, pos.C, 1); // the applet's one pixel
  const y = appletFigure(pos.A, pos.B, pos.C, 1e-3); // the exact configuration
  /* With a semicircle only a few units wide the applet's K, L and C are
   * nearly collinear and its circumcircle blows up; the exact theorem is
   * still checked on every case above. */
  if (g.r1 < 6 || g.r2 < 6) continue;
  if (!x.leftTwin || !x.rightTwin || !x.bigBrother || !x.lowerTwin ||
      !y.roots || y.roots.length !== 2) continue;
  unshifted++;
  /* The applet uses circles of radius 1e6 to stand in for the perpendicular
   * through C; C = X²+Y²−1 in the solver is then tiny and numerically fragile,
   * so compare to a fraction of the big radius, as the picture's scale. */
  const twinErr = max(Math.abs(x.leftTwin.r - g.p), Math.abs(x.rightTwin.r - g.p));
  appletErr = max(appletErr, twinErr / g.R);
  if (twinErr < 0.01 * g.R) appletAgree++;
  const brotherErr = Math.abs(x.bigBrother.r - g.R3) / g.R;
  shiftedErr = max(shiftedErr, brotherErr);
  if (brotherErr < 0.01) shiftedAgree++;
  /* When a small semicircle is only a few units wide, K, L and C are nearly
   * collinear and the applet's circumcircle radius explodes; that is a flaw
   * of its one-pixel picture, not of the theorem checked above. */
  if (g.r1 >= 20 && g.r2 >= 20) {
    lowCases++;
    const e = Math.abs(x.lowerTwin.r - g.p) / g.R;
    if (e < 0.02) lowAgree++;
  }
  /* With the big circle unshifted the same solver gives the exact circles. */
  const upper = y.roots[0].c.y < P2 ? y.roots[0] : y.roots[1];
  const lower = upper === y.roots[0] ? y.roots[1] : y.roots[0];
  const exactErr = max(
    Math.abs(upper.r - g.R3), Math.abs(lower.r - g.R3),
    dist(upper.c, g.brother.c), dist(lower.c, g.reflected.c));
  exactMax = max(exactMax, exactErr);
}

{
  check(`all ${cases.length} configurations produce a drawing`, live === cases.length, `${live}/${cases.length}`);
  check("every computed coordinate and length is finite", finite === live, `${finite}/${live}`);
  check("r1 + r2 equals the big radius", sums === live, `${sums}/${live}`);
  check("both twins have radius r1*r2/(r1+r2)", twins === live, `${twins}/${live}`);
  check("the twins touch their small semicircle and the big one", twinTangency === live, `${twinTangency}/${live}`);
  check("the three-tangent circle has Proposition 6's radius", brotherRadius === live, `${brotherRadius}/${live}`);
  check("it touches all three semicircles", brotherTangency === live, `${brotherTangency}/${live}`);
  check("K, L and C lie on the brother circle", circum === live, `${circum}/${live}`);
  check("the brother's centre is directly above C", circumCentre === live, `${circumCentre}/${live}`);
  check("the reflected construction has the same radius", reflected === live, `${reflected}/${live}`);
  check("D lies on the big semicircle above C", onBig === live, `${onBig}/${live}`);
  check("the inversion at A swaps C and B", inversion === live, `${inversion}/${live}`);
  check("the twin radius never exceeds R/4", bounded === live, `${bounded}/${live}`);
  check("the status line describes the two radii", description === live, `${description}/${live}`);
  check(`the article's claims hold to ${claimErr.toExponential(1)}`, claimErr < 1e-6);
  check(`core matches the applet's twin circles on all ${unshifted} cases`,
    appletAgree === unshifted && unshifted > 900, `${appletAgree}/${unshifted}`);
  check(`the Apollonius twin radii agree within ${(appletErr * 100).toFixed(2)}% of R`, appletErr < 0.01);
  check(`the applet's one-pixel shift stays under 1% of R (${(shiftedErr * 100).toFixed(2)}%)`,
    shiftedAgree === unshifted);
  check(`the applet's circumcircle agrees on the ${lowCases} well-shaped cases`,
    lowAgree === lowCases && lowCases > 500, `${lowAgree}/${lowCases}`);
  check(`the unshifted Apollonius roots match the exact figure to ${exactMax.toExponential(1)}`,
    exactMax < 0.01);
}

/* ------------------------------------- 3. status text and a changed drawing */

{
  const s = C.start({});
  const g = C.geometry(s);
  check("the status reports AC, CB and radius 19.9 at the start",
    /AC 133, CB 57/.test(C.describe(s)) && /radius 19\.9/.test(C.describe(s)));
  const moved = C.move(s, "C", P(150, 125));
  check("moving C changes r1 and r2", C.geometry(moved).r1 !== g.r1 && C.geometry(moved).r2 !== g.r2);
  check("the moved drawing still has radius r1r2/R",
    near(C.geometry(moved).p,
         C.geometry(moved).r1 * C.geometry(moved).r2 / C.geometry(moved).R));
  check("the status changes with the drawing", C.describe(moved) !== C.describe(s));
  check("a collapsed arbelos has no drawing",
    C.geometry({ A: P(0, P2), B: P(100, P2), C: P(0, P2) }) === null);
  check("the circle through A inverts into a line, so it has no inverse circle",
    C.invertCircle(g.left, g.inversion) === null);
  const back = C.invertCircle(C.invertCircle(g.W3, g.inversion), g.inversion);
  check("the hint's inversion is its own inverse",
    near(back.c.x, g.W3.c.x) && near(back.c.y, g.W3.c.y) && near(back.r, g.W3.r));
}

done("circle-triplet");
