#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-on-a-chord/circles-on-a-chord-core.js.
 *
 *   node porting/check-circles-on-a-chord.mjs
 *
 * The first section checks the page's claims over every configuration the
 * applet's spinner and drag allow (N = 3..7, 101 positions of O each): the
 * tablet's PQ = R + 3r at N = 3, the general PQ = 2(R + N(N-2)r)/(N-1),
 * the equivalent PQ = 2 sqrt(R^2 - (d cos(phi))^2) with sin(phi)=1/(N-1),
 * the tangency and row conditions, and Unger's dotted-circle observation.
 *
 * The second section compares the core with a second, independent
 * transcription of CirclesOnAChordCanvas.Compute()/ComputeTangent() from the
 * bytecode: QuadraticEquation.Solve2, the two auxiliary circles, the choice
 * of the lower intersection, Prorate for T/S/W and the chord endpoints.  That
 * transcription uses a law-of-cosines circle intersection and a parameter
 * quadratic for the line, so it shares no geometry code with the core.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("circles-on-a-chord/circles-on-a-chord-core.js", "CirclesOnAChordCore");
const near = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol;
const P = (x, y) => ({ x, y });

/* ----------------------------------- the applet's computation, written again */

const distance = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);

// QuadraticEquation.Solve2(a,b,c) from the CTKAlgebra archive:
// solves a x^2 + 2b x + c = 0, returns null for |a|<0.01 or a negative discriminant.
function solve2(a, b, c) {
  if (Math.abs(a) < 0.01) return null;
  const D = b * b - a * c;
  if (D < 0) return null;
  return [(-b + Math.sqrt(D)) / a, (-b - Math.sqrt(D)) / a];
}

// Circle intersections by the cosine rule (not the core's radical-line formula).
function circleHits(c1, r1, c2, r2) {
  const d = distance(c1, c2);
  if (!d || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
  const alpha = Math.acos(Math.max(-1, Math.min(1, (r1 * r1 + d * d - r2 * r2) / (2 * r1 * d))));
  const theta = Math.atan2(c2.y - c1.y, c2.x - c1.x);
  return [
    P(c1.x + r1 * Math.cos(theta + alpha), c1.y + r1 * Math.sin(theta + alpha)),
    P(c1.x + r1 * Math.cos(theta - alpha), c1.y + r1 * Math.sin(theta - alpha)),
  ];
}

// Line-circle intersections from the parameter quadratic |p + t(q-p) - c|^2 = r^2.
function lineHits(p, q, c) {
  const dx = q.x - p.x, dy = q.y - p.y;
  const A = dx * dx + dy * dy;
  const B = 2 * ((p.x - c.x) * dx + (p.y - c.y) * dy);
  const Cc = (p.x - c.x) ** 2 + (p.y - c.y) ** 2 - c.r * c.r;
  const D = B * B - 4 * A * Cc;
  if (D < 0) return [];
  const s = Math.sqrt(D);
  return [
    P(p.x + dx * (-B - s) / (2 * A), p.y + dy * (-B - s) / (2 * A)),
    P(p.x + dx * (-B + s) / (2 * A), p.y + dy * (-B + s) / (2 * A)),
  ];
}

// CTKGeometryPlus.Prorate(p,q,r).
function prorate(p, q, r) {
  const d = distance(p, q);
  if (d < 0.1) return P(p.x, p.y);
  return P(p.x + (q.x - p.x) * r / d, p.y + (q.y - p.y) * r / d);
}

// The applet's Compute() with W,H as the canvas and O the dragged point.
function appletCompute(N, O, W, H) {
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 3;
  const d = distance(O, P(cx, cy));
  if (!(d < R)) return { draw: false };
  const big = { x: cx, y: cy, r: R };

  const lineHitsAB = lineHits(P(O.x - 1, O.y), P(O.x + 1, O.y), big).sort((a, b) => a.x - b.x);
  const A = lineHitsAB[0], B = lineHitsAB[1];

  const roots = solve2((N - 1) * (N - 1) - 1, R, d * d - R * R);
  if (!roots) return { draw: false };
  const r = roots[0] >= 0 ? roots[0] : roots[1];
  const rho = N * r;

  const circles = [];
  for (let i = 0; i < N; i++) circles.push({ x: O.x - (N - 1 - 2 * i) * r, y: O.y, r: r });

  const C1 = circles[0], C2 = circles[N - 1];
  const helper = { x: C1.x, y: C1.y, r: C1.r + C2.r };
  const mid = P((C1.x + C2.x) / 2, (C1.y + C2.y) / 2);
  const midCircle = { x: mid.x, y: mid.y, r: distance(C1, C2) / 2 };
  const hits = circleHits(helper, helper.r, midCircle, midCircle.r);
  const X = hits[0].y < hits[1].y ? hits[1] : hits[0];
  const V = P(C2.x - X.x + C1.x, C2.y - X.y + C1.y);
  const T = prorate(C1, X, C1.r);
  const S = prorate(C2, V, C2.r);
  const Wpt = prorate(big, C2, big.r);

  const ends = lineHits(T, S, big).sort((a, b) => a.x - b.x);
  const Pt = ends[0], Qt = ends[1];

  const k = 1 / (N - 1);
  const gapLow = Math.abs((cy - R) - (O.y - rho)) * k;
  const gapHigh = Math.abs((cy + R) - (O.y + rho)) * k;
  const above = O.y < cy;
  const dots = above
    ? [Math.abs(rho - gapLow), Math.abs(rho + gapHigh)]
    : [Math.abs(rho - gapHigh), Math.abs(rho + gapLow)];
  const row = [];
  for (let i = 0; i < N; i++) {
    if (above) {
      row.push(P(O.x, O.y - rho + i * gapLow));
      row.push(P(O.x, O.y + rho + i * gapHigh));
    } else {
      row.push(P(O.x, O.y + rho + i * gapHigh));
      row.push(P(O.x, O.y - rho - i * gapLow));
    }
  }

  return {
    draw: true, A, B, r, rho, circles, T, S, W: Wpt, P: Pt, Q: Qt,
    chord: distance(Pt, Qt), dots, row,
  };
}

/* ------------------------------- 1. the start picture and the illustration */

{
  const s = C.start({});
  equal("the spinner starts at N=3", s.N, 3);
  check("O starts half a radius above the centre, as the applet does",
    near(s.O.x, C.CENTER.x) && near(s.O.y, C.CENTER.y - C.RADIUS / 2));
  check("an illustration has no win or loss", C.result(s) === null);
  check("a fresh picture is not explored yet", s.explored === false);
  check("the applet's Show parameter leaves names off and the other boxes at their defaults",
    s.options.names === false && s.options.circles === true &&
    s.options.hint === false && s.options.extra === false);
  check("the board matches the applet's min(W,H)/3 radius", near(C.RADIUS, 280 / 3));
}

/* -------------------------- 2. every geometry claim, for every configuration */

{
  let cases = 0;
  let worstClaim = 0, worstApplet = 0, worstTangency = 0, worstUnger = 0;
  for (let N = C.N_MIN; N <= C.N_MAX; N++) {
    for (let j = 0; j <= 100; j++) {
      // O on the perpendicular through the centre, from just inside the top
      // of the big circle to just inside the bottom (the applet's only drag).
      const frac = -0.98 + 1.96 * j / 100;
      const O = P(C.CENTER.x, C.CENTER.y + frac * (C.RADIUS - 2));
      const state = C.start({ N, O });
      const g = C.geometry(state);
      const applet = appletCompute(N, O, C.VIEW.width, C.VIEW.height);
      cases++;
      check(`N=${N}, j=${j}: the core draws`, g.doDraw === true);
      check(`N=${N}, j=${j}: the applet draws`, applet.draw === true);
      if (!g.doDraw || !applet.draw) continue;

      // The page's equations, measured on the chord the applet actually draws.
      const general = 2 * (C.RADIUS + N * (N - 2) * g.r) / (N - 1);
      const rhoForm = 2 * (C.RADIUS + (N - 2) * g.rho) / (N - 1);
      const cosPhi = Math.sqrt(((N - 1) * (N - 1) - 1)) / (N - 1);
      const trigonometric = 2 * Math.sqrt(Math.max(0, C.RADIUS ** 2 - (g.d * cosPhi) ** 2));
      worstClaim = Math.max(worstClaim,
        Math.abs(g.chord - general), Math.abs(g.chord - rhoForm),
        Math.abs(g.chord - trigonometric));
      check(`N=${N}, j=${j}: PQ = 2(R + N(N-2)r)/(N-1)`,
        near(g.chord, general));
      check(`N=${N}, j=${j}: PQ = 2(R + (N-2)rho)/(N-1)`,
        near(g.chord, rhoForm));
      check(`N=${N}, j=${j}: PQ = 2 sqrt(R^2 - (d cos phi)^2)`,
        near(g.chord, trigonometric));

      // The construction the page derives those formulas from.
      check(`N=${N}, j=${j}: the chain radius solves the Pythagorean equation`,
        near(g.d * g.d + ((N - 1) * g.r) ** 2, (C.RADIUS - g.r) ** 2));
      check(`N=${N}, j=${j}: the dashed circle has radius Nr`, near(g.rho, N * g.r));
      worstTangency = Math.max(worstTangency,
        Math.abs(distance(C.CENTER, g.circles[N - 1].c) - (C.RADIUS - g.r)));
      check(`N=${N}, j=${j}: the big circle touches the end circle internally`,
        near(distance(C.CENTER, g.circles[N - 1].c), C.RADIUS - g.r));
      let touch = true;
      for (let i = 1; i < N; i++) {
        touch = touch && near(distance(g.circles[i - 1].c, g.circles[i].c), 2 * g.r);
      }
      check(`N=${N}, j=${j}: neighbouring small circles touch`, touch);

      // Unger's dotted circles meet the big circle exactly at Q and P.
      const dotErr = Math.min(
        Math.max(Math.abs(distance(g.O, g.P) - g.dots[0].r), Math.abs(distance(g.O, g.Q) - g.dots[1].r)),
        Math.max(Math.abs(distance(g.O, g.P) - g.dots[1].r), Math.abs(distance(g.O, g.Q) - g.dots[0].r)));
      worstUnger = Math.max(worstUnger, dotErr);
      check(`N=${N}, j=${j}: the dotted circles pass through P and Q`, near(dotErr, 0));

      // The independent transcription: the same picture, to 1e-8.
      worstApplet = Math.max(worstApplet,
        Math.abs(g.r - applet.r), Math.abs(g.rho - applet.rho),
        Math.abs(g.chord - applet.chord),
        distance(g.A, applet.A), distance(g.B, applet.B),
        distance(g.P, applet.P), distance(g.Q, applet.Q),
        distance(g.tangent.T, applet.T), distance(g.tangent.S, applet.S),
        distance(g.tangent.W, applet.W),
        Math.abs(g.dots[0].r - applet.dots[0]), Math.abs(g.dots[1].r - applet.dots[1]));
      check(`N=${N}, j=${j}: the core agrees with the applet's Compute()`,
        near(g.r, applet.r) && near(g.chord, applet.chord) &&
        near(distance(g.P, applet.P), 0) && near(distance(g.Q, applet.Q), 0));
      check(`N=${N}, j=${j}: the core agrees with the applet's tangent and dotted circles`,
        near(distance(g.tangent.T, applet.T), 0) && near(distance(g.tangent.S, applet.S), 0) &&
        near(g.dots[0].r, applet.dots[0]) && near(g.dots[1].r, applet.dots[1]));
    }
  }
  check(`all ${cases} configurations were checked`, cases === 5 * 101);
  check(`the page's three chord formulas agree to ${worstClaim.toExponential(2)}`, worstClaim < 1e-7);
  check(`the applet's own construction agrees to ${worstApplet.toExponential(2)}`, worstApplet < 1e-7);
  check(`internal tangency holds to ${worstTangency.toExponential(2)}`, worstTangency < 1e-8);
  check(`Unger's dotted circles meet P and Q to ${worstUnger.toExponential(2)}`, worstUnger < 1e-7);
}

/* ------------------------------------- 3. the N=3 tablet, at many heights */

{
  let worst = 0;
  for (let j = 0; j <= 200; j++) {
    const O = P(C.CENTER.x, C.CENTER.y + (-0.97 + 1.94 * j / 200) * (C.RADIUS - 2));
    const s = C.start({ N: 3, O });
    const g = C.geometry(s);
    worst = Math.max(worst, Math.abs(g.chord - (C.RADIUS + 3 * g.r)),
      Math.abs(g.chord - (C.RADIUS + g.rho)));
  }
  check(`Problem 1.3.3: PQ = R + 3r = R + rho at all 201 heights (worst ${worst.toExponential(2)})`,
    worst < 1e-7);
  const middle = C.geometry(C.start({ N: 3, O: P(C.CENTER.x, C.CENTER.y) }));
  check("at the centre the chord is the diameter 2R", near(middle.chord, 2 * C.RADIUS));
  check("at the centre the three small circles have radius R/3", near(middle.r, C.RADIUS / 3));
}

/* --------------------------------------------- 4. edge cases and controls */

{
  // The applet's DoDraw guard fires before the row is built; the page's
  // clamp keeps O inside, so set the point directly to exercise the guard.
  const outside = Object.assign(C.start({ N: 3 }),
    { O: P(C.CENTER.x, C.CENTER.y + C.RADIUS + 1) });
  check("outside the big circle the applet draws nothing", C.geometry(outside).doDraw === false);
  check("the drag is clamped to two units inside the rim",
    near(C.geometry(C.start({ N: 3, O: P(1, 10000) })).O.y, C.CENTER.y + C.RADIUS - 2));
  check("the drag stays on the vertical line through the centre",
    C.withO(C.start({}), P(5, 120)).O.x === C.CENTER.x);

  const low = C.setN(C.start({}), 1);
  const high = C.setN(C.start({}), 99);
  equal("the spinner's minimum is 3", low.N, 3);
  equal("the spinner's maximum is 7", high.N, 7);
  equal("a non-numeric spinner value is refused", C.setN(C.start({}), NaN).N, 3);

  const opts = C.setOption(C.setOption(C.start({}), "extra", true), "names", true);
  check("the checkboxes set their own flags", opts.options.extra && opts.options.names);
  check("changing an option marks the picture explored", opts.explored === true);
  check("a moved picture is explored", C.withO(C.start({}), P(C.CENTER.x, 100)).explored === true);
  check("an illustration never has a result", C.result(opts) === null);
  check("the status text reports the measured chord", /chord PQ is/.test(C.describe(opts)));
  check("the status text says r and the dashed radius", /r =/.test(C.describe(opts)) &&
    /dashed radius is/.test(C.describe(opts)));
}

done("circles-on-a-chord");
