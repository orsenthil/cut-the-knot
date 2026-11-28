#!/usr/bin/env node
"use strict";

/*
 * Logic test for inscribed-angles/inscribed-angles-core.js.
 *
 *   node porting/check-inscribed-angles.mjs
 *
 * Section 1 checks the opening picture against InscribedAnglesCanvas.init()
 * and the fact that this is a drawing, not a game. Section 2 is a second,
 * independent transcription of the applet's own arithmetic (GeoSDoub's
 * FindCircumcenter, FindOrientation, ComputeSignedAngle, IsOnCircle and
 * CheckFinished) compared with the core on hundreds of board positions,
 * including near-degenerate ones. Section 3 checks the page's claims:
 * angles on the same arc are equal, angles on opposite arcs are
 * supplementary, the converse puts B on the circle, directed angles add up
 * modulo 180°, and the applet's 2-unit / 0.1-radian tolerances behave exactly
 * as the bytecode says. Section 4 checks drag, options, reset and the record.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("inscribed-angles/inscribed-angles-core.js", "InscribedAnglesCore");

/* --------------------------------- the applet's methods, a second transcription */

/* GeoSDoub.Intersect, written from the four line coefficients of the
 * bytecode rather than through the core's Cramer's-rule helper. */
function appletIntersect(p0, p1, p2, p3) {
  const a1 = p0.y - p1.y, b1 = p1.x - p0.x;
  const c1 = p0.x * p1.y - p0.y * p1.x;
  const a2 = p2.y - p3.y, b2 = p3.x - p2.x;
  const c2 = p2.x * p3.y - p2.y * p3.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}

function dist2(p, q) { return (p.x - q.x) ** 2 + (p.y - q.y) ** 2; }
function distance(p, q) { return Math.sqrt(dist2(p, q)); }

function appletCircle(a, b, c) {
  const middle1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const middle2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const dir1 = { x: middle1.x + b.y - a.y, y: middle1.y - b.x + a.x };
  const dir2 = { x: middle2.x + c.y - b.y, y: middle2.y - c.x + b.x };
  const o = appletIntersect(middle1, dir1, middle2, dir2);
  const radius = (distance(o, a) + distance(o, b) + distance(o, c)) / 3;
  return { c: o, r: radius };
}

function appletOrientation(a, b, c) {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return cross > 0 ? 1 : -1;
}

function appletSigned(o, p, q) {
  const cosine = (dist2(o, p) + dist2(o, q) - dist2(p, q)) /
    (2 * distance(o, p) * distance(o, q));
  const magnitude = Math.acos(cosine);
  return appletOrientation(o, p, q) === 1 ? magnitude : -magnitude;
}

function appletOnCircle(p, circle) {
  return Math.abs(distance(p, circle.c) - circle.r) < 2; // IsOnCircle: dcmpg 2
}

function appletFinished(a, b, c, d, previousEqual) {
  const acd = appletCircle(a, c, d); // CheckFinished rebuilds ACD every time
  const onCircle = appletOnCircle(b, acd);
  let equal = previousEqual; // the bytecodes leaves Equal alone when off circle
  if (onCircle) {
    equal = Math.abs(appletSigned(a, c, d) - appletSigned(b, c, d)) < 0.1;
  }
  return { circle: acd, onCircle, equal,
    difference: Math.abs(appletSigned(a, c, d) - appletSigned(b, c, d)) };
}

function appletInit(width, height, randomValue) {
  const cx = width / 2, cy = height / 2;
  const radius = Math.min(width / 2, height / 2) * 2 / 3;
  const at = (angle) => ({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  const jitter = (Math.PI / 4) * randomValue - Math.PI / 8; // pi/4*rnd - pi/8
  return {
    A: at(Math.PI / 4 + jitter),
    B: at(Math.PI / 2 + Math.PI / 4 + jitter),
    C: at(Math.PI + Math.PI / 4 + jitter),
    D: at(4.71238898038469 + 40 + Math.PI / 4 + jitter),
  };
}

const same = (a, b, tol = 1e-9) => Number.isNaN(a) && Number.isNaN(b) ||
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const samePoint = (p, q, tol = 1e-9) => same(p.x, q.x, tol) && same(p.y, q.y, tol);
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

/* ------------------------------------------------------- 1. the opening picture */

{
  const s = C.start({});
  const j = appletInit(C.VIEW.width, C.VIEW.height, C.START_RANDOM);
  check("the centre is the middle of the 400x300 canvas", C.CENTER.x === 200 && C.CENTER.y === 150);
  check("the radius is min(W/2,H/2)*2/3", C.RADIUS === 100);
  for (const name of C.NAMES) {
    check(`the opening ${name} is the applet's CreatePoint position`,
      samePoint(s[name], j[name]), `${JSON.stringify(s[name])} vs ${JSON.stringify(j[name])}`);
  }
  check("all four points start on one circle", C.NAMES.every(
    (n) => near(C.dist(s[n], s.measured.circle.c), 100, 1e-8)));
  check("B starts on the circle through A, C and D", s.onCircle === true && appletOnCircle(s.B, appletCircle(s.A, s.C, s.D)));
  check("the start angles are on opposite arcs, so the directed angles differ",
    !s.equal && Math.abs(s.measured.signedCAD - s.measured.signedCBD) > 3);
  check("names and Hint start unchecked", s.showNames === false && s.hint === false);
  check("a drawing is not a game", C.result(s) === null);
  check("a fresh drawing is not yet explored", s.explored === false);
  check("the status says B is on the circle but on the other arc",
    /on the circle, but on the other arc/.test(C.describe(s)));
}

/* --------------------------- 2. the core against the applet's arithmetic, widely */

{
  const rand = rng(20261127);
  let compared = 0, finite = 0, degenerate = 0, staleKept = 0;
  let worstPoint = 0, worstRadius = 0, worstSigned = 0, worstDecision = 0;
  for (let i = 0; i < 600; i++) {
    // Board positions, plus positions right on the applet's circle and right
    // at its two tolerance boundaries.
    const points = {};
    for (const name of C.NAMES) {
      points[name] = i % 3 === 0
        ? { x: 20 + rand() * 360, y: 20 + rand() * 260 }
        : C.pointOnCircle(C.CENTER, C.RADIUS, rand() * 2 * Math.PI);
    }
    if (i % 5 === 0) {
      const circle = appletCircle(points.A, points.C, points.D);
      if (Number.isFinite(circle.r)) {
        const a = rand() * 2 * Math.PI;
        points.B = C.pointOnCircle(circle.c, circle.r, a);
      }
    }
    const core = C.measure(points);
    const acd = appletCircle(points.A, points.C, points.D);
    const aCAD = appletSigned(points.A, points.C, points.D);
    const aCBD = appletSigned(points.B, points.C, points.D);
    const on = appletOnCircle(points.B, acd);
    const diff = Math.abs(aCAD - aCBD);
    const equal = on && diff < 0.1;
    if (!Number.isFinite(acd.r) || !Number.isFinite(diff)) {
      degenerate++;
      check(`degenerate case ${i} has no usable circle in either implementation`,
        !Number.isFinite(core.circle.r) && !Number.isFinite(core.difference));
      continue;
    }
    finite++;
    worstPoint = Math.max(worstPoint, C.dist(core.circle.c, acd.c));
    worstRadius = Math.max(worstRadius, Math.abs(core.circle.r - acd.r));
    worstSigned = Math.max(worstSigned,
      Math.abs(core.signedCAD - aCAD), Math.abs(core.signedCBD - aCBD));
    if (core.onCircle !== on || core.equal !== equal || !same(core.difference, diff, 1e-9)) {
      worstDecision = Math.max(worstDecision, 1);
    }
    // CheckFinished keeps Equal when B is off the circle; refresh must do so.
    const before = C.refresh(Object.assign({}, points, { equal: true, onCircle: false }));
    const jFinished = appletFinished(points.A, points.B, points.C, points.D, true);
    if (before.equal === jFinished.equal) staleKept++;
    compared++;
  }
  check(`compared ${compared} non-degenerate configurations, ${degenerate} degenerate`, compared > 400);
  check(`circumcentres agree to ${worstPoint.toExponential(1)}`, worstPoint < 1e-7, `${worstPoint}`);
  check(`radii agree to ${worstRadius.toExponential(1)}`, worstRadius < 1e-7, `${worstRadius}`);
  check(`directed angles agree to ${worstSigned.toExponential(1)}`, worstSigned < 1e-7, `${worstSigned}`);
  check("onCircle and Equal agree at every configuration", worstDecision === 0);
  check("the stale Equal quirk matches the applet at every configuration", staleKept === compared,
    `${staleKept}/${compared}`);
}

/* ------------------------------------------------- 3. the page's claims, widely */

{
  const rand = rng(1735);
  let sameArc = 0, oppositeArc = 0, onCircle = 0, offCircle = 0;
  let worstSame = 0, worstOpposite = 0, worstOff = Infinity;
  for (let i = 0; i < 300; i++) {
    const a = { x: 40 + rand() * 320, y: 40 + rand() * 220 };
    const c = { x: 40 + rand() * 320, y: 40 + rand() * 220 };
    const d = { x: 40 + rand() * 320, y: 40 + rand() * 220 };
    const chord = appletCircle(a, c, d);
    if (!Number.isFinite(chord.r) || chord.r < 20 || chord.r > 500) continue;
    const side = appletOrientation(c, d, a);
    // Points on the same side of chord CD as A, and on the other side.
    let placedSame = 0, placedOpposite = 0;
    for (let k = 0; k < 24 && (!placedSame || !placedOpposite); k++) {
      const b = C.pointOnCircle(chord.c, chord.r, rand() * 2 * Math.PI);
      const bSide = appletOrientation(c, d, b);
      if (bSide === side && !placedSame) {
        const e = Math.abs(appletSigned(a, c, d) - appletSigned(b, c, d));
        worstSame = Math.max(worstSame, e);
        sameArc++; placedSame = 1;
      } else if (bSide !== side && !placedOpposite) {
        // The unsigned angles are supplementary; the signed representatives
        // differ by exactly pi, which is the same statement modulo 180°.
        const e = Math.abs(Math.abs(appletSigned(a, c, d)) + Math.abs(appletSigned(b, c, d)) - Math.PI);
        const mod = Math.abs(Math.abs(appletSigned(a, c, d) - appletSigned(b, c, d)) - Math.PI);
        worstOpposite = Math.max(worstOpposite, e, mod);
        oppositeArc++; placedOpposite = 1;
      }
    }
    // The converse, sampled on and off the circle: equality of the directed
    // angles happens for the points on it and not for the points away from it.
    for (let k = 0; k < 8; k++) {
      const angle = rand() * 2 * Math.PI;
      const on = C.pointOnCircle(chord.c, chord.r, angle);
      const off = C.pointOnCircle(chord.c, chord.r * (0.4 + 0.3 * rand()), angle);
      if (appletOrientation(c, d, on) !== side) continue; // orientation matters
      onCircle++;
      const diffOn = Math.abs(appletSigned(a, c, d) - appletSigned(on, c, d));
      const diffOff = Math.abs(appletSigned(a, c, d) - appletSigned(off, c, d));
      worstSame = Math.max(worstSame, diffOn);
      worstOff = Math.min(worstOff, diffOff);
      offCircle++;
    }
  }
  check(`same-arc equality held at ${sameArc} circles`, sameArc > 200 && worstSame < 1e-7,
    `${sameArc}, worst ${worstSame.toExponential(1)}`);
  check(`opposite-arc angles were supplementary at ${oppositeArc} circles`,
    oppositeArc > 200 && worstOpposite < 1e-7,
    `${oppositeArc}, worst ${worstOpposite.toExponential(1)}`);
  check(`the converse: ${onCircle} points on the circle match and ${offCircle} off it do not`,
    onCircle > 200 && offCircle > 200 && worstOff > 1e-3, `worst off-circle difference ${worstOff.toExponential(1)}`);
}

{
  // The page's directed-angle addition law, modulo 180°, with straight lines.
  const rand = rng(99);
  const modPi = (x) => ((x % Math.PI) + Math.PI) % Math.PI;
  let worst = 0;
  for (let i = 0; i < 500; i++) {
    const a = rand() * Math.PI, b = rand() * Math.PI, c = rand() * Math.PI;
    const difference = modPi(modPi(c - a) - modPi(b - a) - modPi(c - b));
    worst = Math.max(worst, Math.min(difference, Math.PI - difference));
  }
  check(`(l,l'') = (l,l') + (l',l'') modulo 180° at 500 triples (worst ${worst.toExponential(1)})`,
    worst < 1e-9);
}

{
  // The two tolerances are literal: IsOnCircle is strict < 2 and CheckFinished
  // is strict < 0.1, so points 1.9 / 2.1 units away must land on opposite
  // sides of the decision.
  const start = C.start({});
  const circle = start.measured.circle;
  const atB = Math.atan2(start.B.y - circle.c.y, start.B.x - circle.c.x);
  const shifted = (amount) => C.pointOnCircle(circle.c, circle.r + amount, atB);
  const inside = C.move(start, "B", shifted(1.9));
  const outside = C.move(start, "B", shifted(2.1));
  check("1.9 units off is still on the circle for the applet's test", inside.onCircle === true);
  check("2.1 units off is off the circle for the applet's test", outside.onCircle === false);
  check("the status names the distance when B is off the circle", /2\.1 units/.test(C.describe(outside)));

  // Put B near A on the same arc: the directed angles agree within 0.1 radian.
  const good = C.move(start, "B", C.pointOnCircle(C.CENTER, C.RADIUS, Math.PI / 3));
  check("B on A's arc gives Equal", good.onCircle && good.equal && good.measured.difference < 0.1);
  check("the status reports the matching angles", /∠CAD = ∠CBD = 69\.1°/.test(C.describe(good)));
  const other = C.move(start, "B", C.pointOnCircle(C.CENTER, C.RADIUS, 2.35));
  check("B on the opposite arc is on the circle but not Equal",
    other.onCircle && !other.equal && other.measured.difference > 3);
  const stale = C.move(good, "B", shifted(2.1));
  check("Equal keeps its old value when B leaves the circle, as in the applet", stale.equal === true);
}

/* ---------------------------------- 4. options, dragging, reset, record */

{
  const s = C.start({});
  const q = C.pt(17, 283);
  const moved = C.move(s, "B", q);
  check("dragging B changes B", !samePoint(s.B, moved.B));
  check("dragging B leaves A, C and D where they were",
    samePoint(moved.A, s.A) && samePoint(moved.C, s.C) && samePoint(moved.D, s.D));
  check("a drag stays on the board", moved.B.x >= 12 && moved.B.x <= 388 && moved.B.y >= 12 && moved.B.y <= 288);
  check("dragging marks the drawing explored", moved.explored === true && s.explored === false);
  check("the old state is not mutated", samePoint(s.B, appletInit(400, 300, C.START_RANDOM).B));
  check("an unknown handle is refused", C.move(s, "E", q) === s);
  check("a non-finite point is refused", C.move(s, "B", { x: NaN, y: 3 }) === s);

  const named = C.setOption(s, "showNames", true);
  check("Show names toggles without disturbing the points", named.showNames === true && samePoint(named.A, s.A));
  check("Hint cannot be ticked while B is off the circle",
    C.setOption(moved, "hint", true).hint === false);
  const good = C.move(s, "B", C.pointOnCircle(C.CENTER, C.RADIUS, Math.PI / 3));
  check("Hint can be ticked when B is on the circle", C.setOption(good, "hint", true).hint === true);
  check("Hint can be unticked", C.setOption(C.setOption(good, "hint", true), "hint", false).hint === false);
  check("an unknown option is refused", C.setOption(s, "mode", "hint") === s);

  const reset = C.reset(C.setOption(moved, "showNames", true));
  check("reset returns to the starting points", C.NAMES.every((n) => samePoint(reset[n], s[n])));
  check("reset keeps the boxes and the explored flag",
    reset.showNames === true && reset.explored === true);
  check("a drawing never wins or loses", C.result(moved) === null && C.result(good) === null);
  check("the status never claims a win", !/win|lose/i.test(C.describe(good)));
}

done("inscribed-angles");
