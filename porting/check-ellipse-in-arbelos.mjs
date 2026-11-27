#!/usr/bin/env node
"use strict";

/*
 * Logic test for ellipse-in-arbelos/ellipse-in-arbelos-core.js.
 *
 *   node porting/check-ellipse-in-arbelos.mjs
 *
 * The cut-the-knot page (problem E 762, 1947) claims: (1) the locus of the
 * centre of a circle in the arbelos tangent to both bounding circles is an
 * ellipse with semiaxes (a1+a2)/2 and sqrt(a1*a2); (2) for tau = a1*a2 +
 * s^2*(a2-a1)^2 the circle with radius a1*a2*(a2-a1)/tau and centre
 * (a1*a2*(a1+a2)/tau, 2*s*r) lies in the arbelos and touches both circles
 * and its predecessor for every real s; (3) the contact chord passes through
 * the fixed point 2*a1*a2/(a1+a2); (4) when a1/a2 = 2/3 then r1 is one
 * seventh of A2's diameter; (5) 0, a1, a2 and that point form a harmonic set.
 * All five are checked over dense grids, alongside a second transcription of
 * the applet's own Circle()/Compute()/init() bytecode.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("ellipse-in-arbelos/ellipse-in-arbelos-core.js", "EllipseInArbelosCore");
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* -------- second transcription, straight from EllipseInArbelosCanvas bytecode */

/** init(): margin 30; side = min(w-2m, h-2m); A left-middle, B right-middle. */
function appletLayout(width, height, margin) {
  const side = Math.min(width - 2 * margin, height - 2 * margin);
  const x = (width - side) / 2;
  return {
    side: side,
    A: { x: x, y: (2 * margin + side) / 2 },
    B: { x: x + side, y: (2 * margin + side) / 2 },
  };
}

/** Circle(s): product, difference, sum, half, sqrt; the rounded oval; the circle. */
function appletCircle(R, r, s, A) {
  const product = R * r;
  const diff = R - r;
  const sum = R + r;
  const half = sum / 2;
  const g = Math.sqrt(product);
  const rect = {
    x: Math.round(A.x),
    y: Math.round(A.y - g),
    width: Math.round(2 * half),
    height: Math.round(2 * g),
  };
  const tau = product + s * s * diff * diff;
  const rad = product * diff / tau;
  const center = { x: product * sum / tau + A.x, y: A.y - 2 * s * rad };
  return { center: center, radius: rad, rect: rect, minor: g, half: half };
}

/** Compute(): the i-th chain parameter is T plus 0, 1, -1, 2, -2, ... */
function appletIndex(i) {
  if (i % 2 === 0) return -i / 2; // ineg; iconst_2; idiv
  return (i + 1) / 2;             // iconst_1; iadd; iconst_2; idiv
}

/** Scrollbar.getValue()/20 in adjustmentValueChanged. */
function appletT(scroll) { return scroll / 20; }

/* ------------------------------------------ 1. the applet's numbers and start */

{
  const layout = appletLayout(C.WIDTH, C.HEIGHT, C.MARGIN);
  check("the board is 400 x 250 with a margin of 30",
    C.WIDTH === 400 && C.HEIGHT === 250 && C.MARGIN === 30);
  check("init's square has side min(w-60, h-60) = 190",
    C.SIDE === 190 && C.SIDE === layout.side);
  check("A, B and the big radius follow init and CircleFromDiameter(A,B)",
    JSON.stringify(C.A) === JSON.stringify(layout.A) &&
    JSON.stringify(C.B) === JSON.stringify(layout.B) &&
    C.R === C.SIDE / 2);
  check("the number spinner runs from 1 to 20 and the scrollbar from -300 to 300",
    C.MIN_N === 1 && C.MAX_N === 20 && C.MIN_T === -300 / 20 && C.MAX_T === 300 / 20);
  check("the applet's T=1 corresponds to scrollbar value 20",
    appletT(20) === C.START_T && appletT(-300) === C.MIN_T && appletT(300) === C.MAX_T);
  check("a default start is plain data, the midpoint of the applet's random range",
    JSON.stringify(C.start({})) === JSON.stringify({ f: 0.5, n: 3, t: 1 }));
}

/* ------------------------------- 2. start/setters, state safety and position */

{
  const s = C.start({});
  const next = C.setN(C.setT(C.setFraction(s, 0.7), 4.5), 12);
  check("setters return new plain-data states and leave the old one alone",
    next !== s && JSON.stringify(s) === '{"f":0.5,"n":3,"t":1}' &&
    JSON.stringify(next) === JSON.stringify({ f: 0.7, n: 12, t: 4.5 }));
  check("bad or out-of-range options fall back or clamp",
    C.clampFraction(NaN) === C.START_FRACTION &&
    C.clampN(999) === 20 && C.clampN(-2) === 1 && C.clampN(7.4) === 7 &&
    C.clampT(-99) === -15 && C.clampT(99) === 15 && C.clampT(Infinity) === C.START_T);
  check("a drag outside the board stops just short of A and B",
    C.fractionAtX(C.A.x - 50) === C.MIN_GAP / C.SIDE &&
    C.fractionAtX(C.B.x + 50) === 1 - C.MIN_GAP / C.SIDE &&
    near(C.fractionAtX(C.A.x + C.SIDE * 0.25), 0.25));
  const p = C.position(s);
  check("the saved position is JSON-safe and carries all drawn quantities",
    JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))) &&
    p.n === 3 && p.t === 1 && p.circles.length === 3 &&
    near(p.a2, C.R) && near(p.major, (p.a1 + p.a2) / 2) &&
    near(p.minor * p.minor, p.a1 * p.a2, 1e-4) &&
    p.circles.every((c) => c.r > 0 && Number.isFinite(c.x) && Number.isFinite(c.y)));
  check("the applet's starting chain is the k = 0, 1, -1 sequence for T=1",
    JSON.stringify(p.circles.map((c) => c.s)) === JSON.stringify([1, 2, 0]));
  equal("chainIndex matches the bytecode for the first twenty circles",
    Array.from({ length: 20 }, (_, i) => C.chainIndex(i)),
    Array.from({ length: 20 }, (_, i) => appletIndex(i)));
}

/* ------------ 3. the core against Circle() over every option and parameter */

{
  let circles = true, ovals = true, indices = true, order = true;
  const fractions = Array.from({ length: 41 }, (_, i) => C.MIN_GAP / C.SIDE +
    (1 - 2 * C.MIN_GAP / C.SIDE) * i / 40);
  const ts = Array.from({ length: 601 }, (_, i) => -15 + i * 0.05);
  for (const f of fractions) {
    const g = C.geometry(C.start({ f: f }));
    const r = g.r, R = g.R;
    for (const s of [-100, -7.25, -3, -0.5, 0, 0.5, 1, 2, 7, 100, ...ts]) {
      const mine = C.chainCircle(r, R, s);
      const theirs = appletCircle(R, r, s, C.A);
      circles = circles && near(mine.center.x, theirs.center.x, 1e-8) &&
        near(mine.center.y, theirs.center.y, 1e-8) &&
        near(mine.radius, theirs.radius, 1e-12);
      ovals = ovals && near(g.major, theirs.half) && near(g.minor, theirs.minor) &&
        JSON.stringify(g.ellipseRect) === JSON.stringify(theirs.rect);
    }
    for (let n = C.MIN_N; n <= C.MAX_N; n++) {
      const state = C.start({ f: f, n: n });
      for (const T of [-15, -3.25, 0, 1, 6.6, 15, ...ts]) {
        const mine = C.geometry(C.setT(state, T)).circles;
        const theirs = [];
        for (let i = 0; i < n; i++) {
          // T is already a scrollbar value divided by 20, as in the applet.
          const s = T + appletIndex(i);
          theirs.push(appletCircle(R, r, s, C.A));
        }
        indices = indices && Array.from({ length: 100 }, (_, i) => C.chainIndex(i))
          .every((k, i) => k === appletIndex(i));
        order = order && mine.length === theirs.length && mine.every((c, i) =>
          near(c.center.x, theirs[i].center.x, 1e-8) &&
          near(c.center.y, theirs[i].center.y, 1e-8) &&
          near(c.radius, theirs[i].radius, 1e-12));
      }
    }
  }
  check("chainCircle is the applet's Circle() for 41 radii x 612 parameters", circles);
  check("the ellipse's semiaxes and rounded oval are the applet's", ovals);
  check("Compute's k = 0, 1, -1, 2, -2, ... is transcribed correctly", indices);
  check("the whole drawn chain matches Compute for every n (1..20) and T", order);
}

/* ---------------------------------- 4. the page's ellipse locus and semiaxes */

{
  let sumDistances = true, onEllipse = true, pythagoras = true, topPoint = true;
  for (let i = 0; i <= 200; i++) {
    const f = C.MIN_GAP / C.SIDE + (1 - 2 * C.MIN_GAP / C.SIDE) * i / 200;
    const g = C.geometry(C.start({ f: f }));
    const a1 = g.r, a2 = g.R, e = g.major, h = g.minor;
    const F1 = { x: C.A.x + a1, y: C.A.y }, F2 = { x: C.A.x + a2, y: C.A.y };
    pythagoras = pythagoras && near(e, (a1 + a2) / 2) &&
      near(e * e - ((a2 - a1) / 2) ** 2, a1 * a2, 1e-9) && near(h, Math.sqrt(a1 * a2));
    // The topmost point of the ellipse is equidistant from both foci.
    const top = { x: C.A.x + e, y: C.A.y - h };
    topPoint = topPoint && near(dist(top, F1), e) && near(dist(top, F2), e);
    for (const s of [-20, -1.5, 0, 0.25, 1, 3, 17]) {
      for (const c of [C.chainCircle(a1, a2, s), C.chainCircle(a1, a2, s - 1)]) {
        sumDistances = sumDistances &&
          near(dist(c.center, F1) + dist(c.center, F2), a1 + a2, 1e-8);
        const dx = (c.center.x - g.ellipse.cx) / e;
        const dy = (c.center.y - g.ellipse.cy) / h;
        onEllipse = onEllipse && near(dx * dx + dy * dy, 1, 1e-8);
      }
    }
  }
  check("major semiaxis is (a1+a2)/2 and the foci are (a1,0), (a2,0)", pythagoras);
  check("the ellipse's top point has height sqrt(a1*a2)", topPoint);
  check("a tangent circle's distances to the foci always add to a1+a2", sumDistances);
  check("every chain centre satisfies (x-cx)^2/e^2 + (y-cy)^2/h^2 = 1", onEllipse);
}

/* ------------------------ 5. the page's tau, radius and centre formulas */

{
  let formulas = true, tangent = true, inside = true, neighbours = true;
  const pairs = [[2, 3], [1, 5], [0.4, 7], [7, 7.1], [3.5, 40]];
  const ss = [-50, -17, -3.5, -1, -0.5, 0, 0.5, 1, 1.5, 4, 25, 50];
  for (const [a1, a2] of pairs) {
    for (const s of ss) {
      const c = C.mathCircle(a1, a2, s);
      const tau = a1 * a2 + s * s * (a2 - a1) ** 2;
      formulas = formulas && near(c.r, a1 * a2 * (a2 - a1) / tau, 1e-12) &&
        near(c.x, a1 * a2 * (a1 + a2) / tau, 1e-12) && near(c.y, 2 * s * c.r, 1e-12);
      const P = { x: c.x, y: c.y };
      tangent = tangent &&
        near(Math.hypot(P.x - a1, P.y) - (a1 + c.r), 0, 1e-9) &&
        near(Math.hypot(P.x - a2, P.y) - (a2 - c.r), 0, 1e-9);
      inside = inside && c.r > 0 &&
        Math.hypot(P.x - a2, P.y) + c.r <= a2 + 1e-9 &&
        Math.hypot(P.x - a1, P.y) >= a1 + c.r - 1e-9 &&
        P.x >= 0 && P.x <= 2 * a2;
      const prev = C.mathCircle(a1, a2, s - 1);
      neighbours = neighbours && near(
        Math.hypot(P.x - prev.x, P.y - prev.y), c.r + prev.r, 1e-9);
    }
  }
  check("tau, r_t, x_t and y_t = 2*t*r_t match the printed formulas", formulas);
  check("C_t touches A1 externally and A2 internally", tangent);
  check("C_t lies in the crescent between the two circles", inside);
  check("C_t touches C_(t-1) for negative, fractional and large t", neighbours);
}

/* ------------------ 6. the contact chord, 2/3 diameter and harmonic set */

{
  let fixed = true, seventh = true, harmonic = true;
  for (const [a1, a2] of [[2, 3], [1, 5], [0.4, 7], [7, 7.1], [3.5, 40]]) {
    for (const s of [-17, -3.5, -1, 0.5, 1, 4, 25]) {
      const c = C.mathCircle(a1, a2, s);
      const P = { x: c.x, y: c.y };
      const d1 = Math.hypot(P.x - a1, P.y), d2 = Math.hypot(P.x - a2, P.y);
      // Contact points on the inner and outer circle, along the centre lines.
      const Q1 = { x: a1 + a1 * (P.x - a1) / d1, y: a1 * P.y / d1 };
      const Q2 = { x: a2 + a2 * (P.x - a2) / d2, y: a2 * P.y / d2 };
      if (Math.abs(Q2.y - Q1.y) > 1e-9) {
        const x0 = (Q1.x * Q2.y - Q2.x * Q1.y) / (Q2.y - Q1.y);
        fixed = fixed && near(x0, 2 * a1 * a2 / (a1 + a2), 1e-8);
      }
    }
    const F = 2 * a1 * a2 / (a1 + a2);
    // Cross ratio of 0, F, a1, a2 is -1: a harmonic set.
    harmonic = harmonic && near(
      ((a1 - 0) / (a1 - F)) / ((a2 - 0) / (a2 - F)), -1, 1e-9);
  }
  for (let a2 = 0.5; a2 <= 8; a2 += 0.25) {
    const a1 = 2 * a2 / 3;
    const r1 = C.mathCircle(a1, a2, 1).r;
    seventh = seventh && near(r1, 2 * a2 / 7, 1e-12);
  }
  check("the chord through the two contact points passes through 2*a1*a2/(a1+a2)", fixed);
  check("diameter(A1) = 2/3 diameter(A2) gives r1 = diameter(A2)/7", seventh);
  check("0, a1, a2 and the fixed point form a harmonic set", harmonic);
}

/* ------------------------------- 7. edges, determinism and the demo ending */

{
  const low = C.geometry(C.start({ f: -10, n: 0, t: -20 }));
  const high = C.geometry(C.start({ f: 10, n: 999, t: 20 }));
  check("a circle never degenerates at the drag limits",
    low.r > 0 && high.r > 0 && low.diff > 0 && high.diff > 0 &&
    low.circles.every((c) => c.radius > 0) && high.circles.every((c) => c.radius > 0));
  check("clamping the chain's parameter keeps it on the scrollbar's range",
    C.start({ t: 20 }).t === 15 && C.start({ t: -20 }).t === -15);
  check("the same position always produces the same picture and record",
    JSON.stringify(C.geometry(C.start({ f: 0.31, n: 9, t: 2.15 }))) ===
    JSON.stringify(C.geometry(C.start({ f: 0.31, n: 9, t: 2.15 }))) &&
    JSON.stringify(C.position(C.start({ f: 0.31, n: 9, t: 2.15 }))) ===
    JSON.stringify(C.position(C.start({ f: 0.31, n: 9, t: 2.15 }))));
  check("this is an illustration, with no win and no loss to report",
    C.position(C.start({})) !== null && C.position(C.start({})).n === C.START_N);
}

done("ellipse-in-arbelos");
