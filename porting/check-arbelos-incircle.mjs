#!/usr/bin/env node
"use strict";

/*
 * Logic test for arbelos-incircle/arbelos-incircle-core.js.
 *
 *   node porting/check-arbelos-incircle.mjs
 *
 * Section 1 walks the drawing's one handle and its two display options.
 * Section 2 sweeps C over 240 positions in each of five placements of A and
 * B (1,200 arbeloses), checking every claim on the cut-the-knot page: the
 * incircle radius, its three tangencies, that AN, BM and CD meet at one S,
 * that S is on the incircle, and the remark which constructs D from S.
 * Section 3 is a second, literal transcription of the applet's own method:
 * ApolloniusCircle.SetCircles/Compute with the same static fields and
 * thresholds, ArbelosIncircleCanvas.DrawSmallCircle's one-unit nudge of the
 * big circle, and DefinePoints' GeoSDoub.Intersect calls. It is compared with
 * the core over all 1,200 positions. The applet's first Apollonius root is
 * the circle below the baseline; the page's incircle is the second root, so
 * both are checked and the difference the nudge makes is measured.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("arbelos-incircle/arbelos-incircle-core.js", "ArbelosIncircleCore");
const P = (x, y) => ({ x: x, y: y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const max = (...xs) => Math.max(...xs);

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  equal("the applet's 400x250 canvas and 30-unit margin", [C.VIEW, C.BASE_Y, C.GAP],
    [{ width: 400, height: 250 }, 220, 10]);
  equal("A and B are the ends of the fixed baseline", [C.A, C.B], [P(30, 220), P(370, 220)]);
  equal("C starts at 0.6*A.x + 0.7*B.x", s.C, P(277, 220));
  check("the two display options start as the applet's defaults",
    s.names === true && s.guides === true);
  check("an illustration has no result", C.result(s) === null);
  equal("the only draggable handle is C", C.legalMoves(s), ["C"]);

  const moved = C.move(s, P(100, 90));
  check("dragging C moves it onto the baseline and marks the picture explored",
    moved.C.x === 100 && moved.C.y === C.BASE_Y && !s.explored && moved.explored);
  check("dragging C left of A is stopped by the applet's gap",
    C.move(s, P(-500, 0)).C.x === C.A.x + C.GAP);
  check("dragging C right of B is stopped by the applet's gap",
    C.move(s, P(9999, 0)).C.x === C.B.x - C.GAP);
  check("an unknown handle changes nothing", C.move(s, "Z") === s);
  check("a non-finite drag changes nothing", C.move(s, P(NaN, 1)) === s);
  check("a drag that stays put changes nothing", C.move(s, P(277, 220)) === s);

  const toggled = C.setOption(s, "names", false);
  check("toggling names leaves the old state alone", !toggled.names && s.names);
  check("an unknown option changes nothing", C.setOption(s, "hint", true) === s);
  check("Reset restores C but keeps the options", C.reset(toggled).C.x === 277 && !C.reset(toggled).names);
}

/* ------------------------ the applet's method, transcribed from the bytecode */

/* ApolloniusCircle's static state, exactly as SetCircles fills it. */
const applet = {
  Ci: [], A1: 0, A2: 0, B1: 0, B2: 0, D1: 0, D2: 0, K: 0, G: 0, I: 0, o: 0,
};
const appletInfo = (c) => c.x * c.x + c.y * c.y - c.r * c.r;

function appletSetCircles(c0, c1, c2) {
  applet.Ci[0] = c0; applet.Ci[1] = c1; applet.Ci[2] = c2;
  applet.A1 = 2.0 * (c1.x - c0.x);
  applet.A2 = 2.0 * (c2.x - c0.x);
  applet.B1 = 2.0 * (c1.y - c0.y);
  applet.B2 = 2.0 * (c2.y - c0.y);
  applet.o = appletInfo(c0);
  applet.D1 = applet.o - appletInfo(c1);
  applet.D2 = applet.o - appletInfo(c2);
  applet.K = applet.A1 * applet.B2 - applet.A2 * applet.B1;
  applet.G = (applet.B1 * applet.D2 - applet.B2 * applet.D1) / applet.K;
  applet.I = -(applet.A1 * applet.D2 - applet.A2 * applet.D1) / applet.K;
}

/* TreatZeroDeterminant returns null in both of its branches. */
function appletTreatZeroDeterminant() {
  if (applet.A1 * applet.A1 + applet.B1 * applet.B1 < 0.1) return null;
  return null;
}

/** Compute(i,j,k): two circles. The centre uses the signed root, the radius |root|. */
function appletCompute(s0, s1, s2) {
  if (Math.abs(applet.K) < 0.01) return appletTreatZeroDeterminant(s0, s1, s2);
  const c0 = applet.Ci[0];
  const L3 = 2.0 * (s0 * c0.r - s1 * applet.Ci[1].r);
  const L5 = 2.0 * (s0 * c0.r - s2 * applet.Ci[2].r);
  const v = (applet.B1 * L5 - applet.B2 * L3) / applet.K;
  const w = -(applet.A1 * L5 - applet.A2 * L3) / applet.K;
  const L = v * v + w * w - 1.0;
  if (Math.abs(L) < 0.001) return null;
  const coef = 2.0 * (v * applet.G + w * applet.I - v * c0.x - w * c0.y + s0 * c0.r);
  const q = applet.G * applet.G + applet.I * applet.I -
    2.0 * applet.G * c0.x - 2.0 * applet.I * c0.y + applet.o;
  let disc = coef * coef - 4.0 * L * q;
  if (disc < 0.0) return null;
  disc = Math.sqrt(disc);
  const circle = (t) => ({ c: P(v * t + applet.G, w * t + applet.I), r: Math.abs(t) });
  return [circle((-coef - disc) / 2.0 / L), circle((-coef + disc) / 2.0 / L)];
}

/* GeoSDoub.Intersect(DoubPoint x4): Cramer's rule, NaN if |denominator| < 1. */
function appletIntersect(p0, p1, p2, p3) {
  const a1 = p0.y - p1.y, b1 = p1.x - p0.x, c1 = p0.x * p1.y - p0.y * p1.x;
  const a2 = p2.y - p3.y, b2 = p3.x - p2.x, c2 = p2.x * p3.y - p2.y * p3.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / den, (c1 * a2 - c2 * a1) / den);
}

/** FindTop in the applet: the midpoint of the upper half of a circle. */
const appletFindTop = (circle) => P(circle.c.x, circle.c.y - circle.r);

/*
 * DrawSmallCircle + DefinePoints. The applet nudges the big circle one unit
 * down the screen before asking ApolloniusCircle for a circle tangent to the
 * left circle, the right circle and (internally) that nudged big circle, with
 * the sign triple (1, 1, -1). DrawOneCircle takes the first root; the page's
 * incircle above the baseline is the second root. Both sets of points are
 * built here from the horizontal diameter ends of each candidate circle.
 */
function appletConstruction(a, b, c) {
  const O = mid(a, b), R = dist(O, a);
  const o1 = mid(a, c), r1 = dist(o1, c);
  const o2 = mid(b, c), r2 = dist(o2, c);
  appletSetCircles({ x: o1.x, y: o1.y, r: r1 },
    { x: o2.x, y: o2.y, r: r2 },
    { x: O.x, y: O.y + 1, r: R });
  const roots = appletCompute(1, 1, -1);
  if (!roots || roots.length !== 2) return null;
  const M = appletFindTop({ c: o1, r: r1 });
  const N = appletFindTop({ c: o2, r: r2 });
  const define = (circle) => {
    const right = P(circle.c.x + circle.r, circle.c.y);
    const left = P(circle.c.x - circle.r, circle.c.y);
    return {
      E: appletIntersect(a, right, c, left),
      F: appletIntersect(left, b, c, right),
      D: appletIntersect(a, left, b, right),
      S: appletIntersect(a, N, b, M),
    };
  };
  return { drawn: roots[0], incircle: roots[1],
    drawnPoints: define(roots[0]), incirclePoints: define(roots[1]) };
}

/* --------------------------------- 2. the page's claims, over 1,200 cases */

const cases = [];
for (const [ax, bx] of [[0, 400], [30, 370], [-100, 250], [80, 320], [20, 380]]) {
  for (let i = 0; i < 240; i++) {
    const f = 0.02 + i * 0.96 / 239;
    cases.push({ A: P(ax, 220), B: P(bx, 220), C: P(ax + (bx - ax) * f, 220) });
  }
}

let live = 0, finite = 0, sums = 0, radius = 0, height = 0, bounded = 0;
let tangencies = 0, onArcs = 0, radial = 0, concurrency = 0, SOnCircle = 0;
let construction = 0, mirrored = 0, comparison = 0, agree = 0;
let claimErr = 0, appletErr = 0, mirrorErr = 0;
for (const pos of cases) {
  const g = C.construct(pos.A, pos.B, pos.C);
  if (!g) continue;
  live++;
  const e = (a, b) => { claimErr = max(claimErr, Math.abs(a - b)); return near(a, b); };

  const nums = [g.r1, g.r2, g.R, g.rho, g.P.x, g.P.y, g.S.x, g.S.y];
  const pts = [g.O, g.O1, g.O2, g.P, g.M, g.N, g.D, g.E, g.F, g.S];
  if (nums.every(Number.isFinite) && pts.every((p) => finitePoint(p))) finite++;

  if (e(g.r1 + g.r2, g.R)) sums++;
  const formula = g.r1 * g.r2 * (g.r1 + g.r2) /
    (g.r1 * g.r1 + g.r1 * g.r2 + g.r2 * g.r2);
  if (e(g.rho, formula)) radius++;
  if (e(g.P.y, pos.A.y - 2 * g.rho)) height++;
  if (g.rho <= g.R / 3 + 1e-9) bounded++;

  if (e(dist(g.P, g.O), g.R - g.rho) &&
      e(dist(g.P, g.O1), g.r1 + g.rho) &&
      e(dist(g.P, g.O2), g.r2 + g.rho)) tangencies++;
  if (e(dist(g.D, g.O), g.R) && e(dist(g.E, g.O1), g.r1) &&
      e(dist(g.F, g.O2), g.r2)) onArcs++;

  // Each tangency lies on the ray from its arc's centre through P.
  const aligned = (centre, point, radius) =>
    e(dist(centre, point), radius) &&
    Math.abs(cross(centre, point, g.P)) < 1e-7 * Math.max(1, radius);
  if (aligned(g.O, g.D, g.R) && aligned(g.O1, g.E, g.r1) &&
      aligned(g.O2, g.F, g.r2)) radial++;

  const SfromBM = C.intersect(pos.B, g.M, pos.A, g.N);
  const SfromCD = C.intersect(pos.C, g.D, pos.A, g.N);
  if (SfromBM && SfromCD &&
      dist(g.S, SfromBM) < 1e-7 && dist(g.S, SfromCD) < 1e-7) concurrency++;
  if (e(dist(g.P, g.S), g.rho)) SOnCircle++;

  // The page's construction: S from AN and BM first, then D from CS.
  const DfromCS = rayToCircle(pos.C, g.S, g.O, g.R);
  if (DfromCS && dist(DfromCS, g.D) < 1e-6) construction++;

  /* The applet's own circles. Its first root is the mirror of the incircle
   * below the baseline; the second is the page's incircle, displaced by the
   * one-unit nudge. Its DefinePoints gives the same D, E, F and S. */
  const x = appletConstruction(pos.A, pos.B, pos.C);
  if (x) {
    const err = max(
      dist(x.incircle.c, g.P), Math.abs(x.incircle.r - g.rho),
      dist(x.incirclePoints.D, g.D), dist(x.incirclePoints.E, g.E),
      dist(x.incirclePoints.F, g.F), dist(x.incirclePoints.S, g.S),
    );
    appletErr = max(appletErr, err);
    const mirror = P(x.drawn.c.x, 2 * pos.A.y - x.drawn.c.y);
    mirrorErr = max(mirrorErr, dist(mirror, g.P), Math.abs(x.drawn.r - g.rho));
    if (err < 2.5) agree++;
    if (mirrorErr < 1.2) mirrored++;
    comparison++;
  }
}

function finitePoint(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

/** The far intersection of ray start->through with the circle centre/r. */
function rayToCircle(start, through, centre, r) {
  const dx = through.x - start.x, dy = through.y - start.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  const ux = dx / len, uy = dy / len;
  const t = (centre.x - start.x) * ux + (centre.y - start.y) * uy;
  const h2 = r * r - ((centre.x - start.x) ** 2 + (centre.y - start.y) ** 2 - t * t);
  if (h2 < 0) return null;
  return P(start.x + (t + Math.sqrt(h2)) * ux, start.y + (t + Math.sqrt(h2)) * uy);
}

{
  check(`all ${cases.length} arbeloses have a construction`, live === cases.length, `${live}/${cases.length}`);
  check("every point and length is finite", finite === live, `${finite}/${live}`);
  check("r1 + r2 is the big radius", sums === live, `${sums}/${live}`);
  check("the incircle radius is r1*r2*(r1+r2)/(r1^2+r1*r2+r2^2)", radius === live, `${radius}/${live}`);
  check("the incircle centre is 2*rho above the baseline", height === live, `${height}/${live}`);
  check("the radius never exceeds R/3", bounded === live, `${bounded}/${live}`);
  check("the incircle is tangent to all three arcs", tangencies === live, `${tangencies}/${live}`);
  check("D, E and F lie on their arcs", onArcs === live, `${onArcs}/${live}`);
  check("each tangency lies on the ray from its arc's centre", radial === live, `${radial}/${live}`);
  check("AN, BM and CD are concurrent at S", concurrency === live, `${concurrency}/${live}`);
  check("S lies on the incircle", SOnCircle === live, `${SOnCircle}/${live}`);
  check("D = CS ∩ big arc, as the page's remark says", construction === live, `${construction}/${live}`);
  check(`all page claims hold to ${claimErr.toExponential(1)}`, claimErr < 1e-6);
  check(`the applet's second root and points agree with the core on all ${comparison} cases`,
    agree === comparison && comparison === live, `${agree}/${comparison}`);
  check(`the applet's one-unit nudge changes points by at most ${appletErr.toFixed(3)}`, appletErr < 2.5);
  check(`the applet's first root is the mirror circle below the baseline (${mirrorErr.toFixed(3)})`,
    mirrored === comparison && mirrorErr < 2.5, `${mirrored}/${comparison}`);
}

/* ------------------------------------- 3. status text and a changed drawing */

{
  const s = C.start({});
  check("the status reports S and the radius",
    /meet at S/.test(C.describe(s)) && /radius 42\.2/.test(C.describe(s)));
  const moved = C.move(s, P(200, 220));
  check("moving C changes the radius", C.geometry(moved).rho !== C.geometry(s).rho);
  check("the moved drawing still satisfies the page's claim",
    near(dist(C.geometry(moved).P, C.geometry(moved).S), C.geometry(moved).rho));
  check("the status changes with the drawing", C.describe(moved) !== C.describe(s));
}

done("arbelos-incircle");
