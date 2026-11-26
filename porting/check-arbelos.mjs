#!/usr/bin/env node
"use strict";

/*
 * Logic test for arbelos/arbelos-core.js.
 *
 *   node porting/check-arbelos.mjs
 *
 * The cut-the-knot article makes three exact claims: (1) for three tangent
 * circles the gap is pi*t^2/8, where t is the tangent chord at the contact
 * point, independent of r, r1 and r2; (2) Archimedes' Proposition 4 - the
 * arbelos equals the circle on the altitude PN as diameter; (3) the big arc of
 * the arbelos boundary equals the two small arcs together. All three are
 * checked here at a thousand draggable positions plus 2000 random ones, along
 * with a second, literal transcription of the applet's init and DrawArbelos:
 * the rectangle, the 0.3 starting point, the two arc diameters, the eligible
 * drop region and the sqrt((x-A)(B-x)) end of the upright.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("arbelos/arbelos-core.js", "ArbelosCore");
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const PI = Math.PI;

/* ------- a second transcription, straight from ArbelosCanvas's bytecode --- */

/** init(): side = min(width-2*margin, 2*(height-2*margin)); rect(y, size). */
function appletRect(width, height, margin) {
  const side = Math.min(width - 2 * margin, 2 * (height - 2 * margin));
  return { x: margin, y: height - margin - side / 2, width: side, height: side };
}

/** DoubLine.CreateMidPoint(f) between the two ends of the horizontal segment. */
function appletPoint(rect, f) {
  return { x: rect.x + rect.width * f, y: rect.y + rect.height / 2 };
}

/** PointIsEligible(x, y) - the upper half of the rect, 2px inside each end. */
function appletEligible(rect, x, y) {
  return x > rect.x + 2 && y > rect.y &&
    x < rect.x + rect.width && y < rect.y + rect.height / 2 - 2;
}

/** DrawArbelos(): (int)(point.x - rect.x) is the first small arc's diameter. */
function appletDiameters(rect, point) {
  const dx = Math.trunc(point.x - rect.x);
  return [dx, rect.width - dx];
}

/** DrawArbelos(): top of a small arc's bounding box, diameter d. */
function appletArcTop(rect, d) {
  return rect.y + rect.height / 2 - Math.trunc(d) / 2;
}

/** DrawArbelos(): drawLine(..., round(y - sqrt((x-A)*(B-x)))). */
function appletUprightEnd(rect, point) {
  const product = (point.x - rect.x) * (rect.x + rect.width - point.x);
  return Math.round(point.y - Math.sqrt(product));
}

/* ------------------------------------------------- 1. the applet's constants */

{
  const r = appletRect(C.WIDTH, C.HEIGHT, C.MARGIN);
  check("the applet's margin is 20", C.MARGIN === 20);
  check("the board is 360 x 240", C.WIDTH === 360 && C.HEIGHT === 240);
  check("the rectangle follows init() exactly",
    JSON.stringify(C.RECT) === JSON.stringify(r));
  check("the diameter is min(w-2m, 2(h-2m)) = 320",
    C.DIAMETER === 320 && C.DIAMETER === r.width && C.DIAMETER === r.height);
  check("AB lies on the middle of the rectangle", near(C.BASE_Y, r.y + r.height / 2));
  check("the applet starts its point at 0.3 along AB",
    C.START_T === 0.3 && C.start({}).t === 0.3 &&
    near(C.geometry(C.start({})).N.x, appletPoint(r, 0.3).x));
}

/* ------------------------------- 2. start, setT, and the saved position */

{
  const s = C.start({});
  check("start is plain data, nothing more", JSON.stringify(s) === '{"t":0.3}');
  check("start is driven only by its options",
    JSON.stringify(C.start({ t: 0.72 })) === JSON.stringify(C.start({ t: 0.72 })));
  const next = C.setT(s, 0.8);
  check("setT leaves the old state alone and returns a new one",
    s.t === 0.3 && next.t === 0.8 && next !== s);
  check("a missing or bad t falls back to the start",
    C.clampT(undefined) === 0.3 && C.clampT(NaN) === 0.3);
  check("t is clamped just inside A and B, as PointIsEligible does",
    C.clampT(-5) === C.MIN_GAP / C.DIAMETER &&
    C.clampT(9) === 1 - C.MIN_GAP / C.DIAMETER &&
    near(C.geometry(C.setT(s, -5)).a, C.MIN_GAP));
  const p = C.position(s);
  check("the saved position is JSON-safe and has the drawn quantities",
    JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))) &&
    p.t === 0.3 && p.a > 0 && p.b > 0 &&
    near(p.a + p.b, C.DIAMETER) && near(p.chord, 2 * p.altitude) &&
    near(p.arbelosArea, p.circleArea, 1e-5));
}

/* ------------------------ 3. the geometry at a thousand draggable positions */

{
  let halves = true, pythagoras = true, upright = true, circle = true;
  for (let i = 0; i <= 1000; i++) {
    const g = C.geometry(C.setT({}, i / 1000));
    const t = C.clampT(i / 1000);
    const a = C.DIAMETER * t, b = C.DIAMETER - a;
    halves = halves && near(g.a + g.b, C.DIAMETER) && near(g.a, a) && near(g.b, b);
    // P lies on the big circle: its distance from the centre is R.
    const centre = { x: C.RECT.x + C.DIAMETER / 2, y: C.BASE_Y };
    upright = upright && near(Math.hypot(g.P.x - centre.x, g.P.y - centre.y), g.R);
    pythagoras = pythagoras && near(g.altitude * g.altitude, a * b) &&
      near(g.P.y, C.BASE_Y - Math.sqrt(a * b));
    circle = circle && near(g.circle.radius, g.altitude / 2) &&
      near(g.circle.center.y, C.BASE_Y - g.altitude / 2) &&
      near(g.circle.center.x, g.N.x);
  }
  check("AN + NB is always the diameter", halves);
  check("PN^2 = AN*NB at every one of 1001 positions", pythagoras);
  check("P really lies on the big semicircle", upright);
  check("the circle on PN has the right centre and radius", circle);
}

/* ------------------------------------ 4. the three exact claims on the page */

{
  let prop4 = true, closed = true, full = true, chord = true, arcs = true, twice = true;
  for (let i = 0; i <= 1000; i++) {
    const g = C.geometry(C.setT({}, i / 1000));
    const a = g.a, b = g.b;
    // Archimedes, Book of Lemmas, Proposition 4.
    prop4 = prop4 && near(g.arbelosArea, g.circleArea) &&
      near(g.arbelosArea, PI * a * b / 4);
    closed = closed && near(g.arbelosArea, PI * g.altitude * g.altitude / 4);
    // The article's problem: S = pi*t^2/8 with t the whole tangent chord.
    const rr = g.r1 + g.r2;
    full = full && near(g.fullArea, PI * g.chord * g.chord / 8) &&
      near(g.fullArea, PI * a * b / 2) &&
      near(g.fullArea, PI * rr * rr - PI * g.r1 * g.r1 - PI * g.r2 * g.r2);
    twice = twice && near(g.fullArea, 2 * g.arbelosArea);
    // 2*r1 * 2*r2 = (t/2)^2, the article's chord identity.
    chord = chord && near((2 * g.r1) * (2 * g.r2), Math.pow(g.chord / 2, 2)) &&
      near(g.chord, 4 * Math.sqrt(g.r1 * g.r2));
    // The boundary claim: the big arc is the sum of the two small arcs.
    arcs = arcs && near(g.bigArc, g.smallArc) &&
      near(g.bigArc, PI * (a + b) / 2);
  }
  check("Proposition 4: the arbelos equals the circle on PN (1001 positions)", prop4);
  check("the arbelos area is pi*PN^2/4 = pi*AN*NB/4", closed);
  check("the article's S = pi*t^2/8 holds at every position", full);
  check("the full-circle gap is twice the upper-half arbelos", twice);
  check("the article's chord identity 2r1*2r2 = (t/2)^2 holds", chord);
  check("the big arc equals the two small arcs together", arcs);
}

{
  let maximum = true, symmetric = true;
  const mid = C.geometry(C.setT({}, 0.5));
  for (let i = 0; i <= 200; i++) {
    const t = i / 1000;
    const g = C.geometry(C.setT({}, t));
    const mirror = C.geometry(C.setT({}, 1 - t));
    maximum = maximum && g.arbelosArea <= mid.arbelosArea + 1e-9 &&
      g.chord <= mid.chord + 1e-9;
    symmetric = symmetric && near(g.arbelosArea, mirror.arbelosArea) &&
      near(g.chord, mirror.chord) && near(g.P.y, mirror.P.y);
  }
  check("the gap and the tangent are largest when N is in the middle", maximum);
  check("moving N the same distance from either end gives the same picture", symmetric);
  check("at the middle PN is the radius and the tangent is the diameter",
    near(mid.altitude, mid.R) && near(mid.chord, C.DIAMETER) &&
    near(mid.fullArea, PI * C.DIAMETER * C.DIAMETER / 8));
}

{
  // "Independent of r, r1, r2": equal products AN*NB give equal t and equal
  // area, even when the big circle itself is a different size.
  const pairs = [[96, 224], [84, 256], [128, 168], [112, 192], [64, 336]];
  let independent = true;
  const first = pairs[0];
  for (const [a, b] of pairs) {
    const altitude = Math.sqrt(a * b);
    const area = PI * altitude * altitude / 2;
    independent = independent && near(a * b, first[0] * first[1]) &&
      near(area, PI * first[0] * first[1] / 2);
  }
  check("the same AN*NB gives the same S and t for different radii", independent);
  check("the article's algebra pi*r^2 - pi*r1^2 - pi*r2^2 = 2*pi*r1*r2",
    (() => {
      let ok = true;
      for (const [a, b] of pairs) {
        const r1 = a / 2, r2 = b / 2, r = r1 + r2;
        ok = ok && near(PI * r * r - PI * r1 * r1 - PI * r2 * r2, 2 * PI * r1 * r2);
      }
      return ok;
    })());
}

/* -------------------------------- 5. the applet's own arithmetic, again */

{
  const rect = appletRect(C.WIDTH, C.HEIGHT, C.MARGIN);
  let diameters = true, tops = true, uprights = true, eligible = true;
  for (let i = 0; i <= 500; i++) {
    const t = (i + 5) / 510; // inside the applet's 2px eligibility margin
    const p = appletPoint(rect, t);
    const g = C.geometry(C.setT({}, t));
    const [d1, d2] = appletDiameters(rect, p);
    diameters = diameters && near(d1, g.a, 1) && near(d2, g.b, 1);
    tops = tops && near(appletArcTop(rect, d1), C.BASE_Y - g.a / 2, 1) &&
      near(appletArcTop(rect, d2), C.BASE_Y - g.b / 2, 1);
    uprights = uprights &&
      near(p.y - appletUprightEnd(rect, p), g.altitude, 1);
    // The applet's release test wants a y strictly above the diameter, even
    // though its point is snapped onto that diameter: a harmless quirk.
    eligible = eligible && appletEligible(rect, p.x, p.y - 5);
  }
  check("the two small arc diameters match DrawArbelos", diameters);
  check("the small arcs sit at the heights DrawArbelos gives", tops);
  check("the upright matches the applet's sqrt((x-A)*(B-x)) line", uprights);
  check("every interior drop just above the diameter is eligible", eligible);
  check("the applet's own eligible region excludes A and B",
    !appletEligible(rect, rect.x + 1, rect.y + rect.height / 2) &&
    !appletEligible(rect, rect.x + rect.width, rect.y + rect.height / 2));
}

/* -------------------------------------- 6. random positions, all identities */

{
  const random = rng(2312);
  let ok = true;
  for (let i = 0; i < 2000; i++) {
    const t = random();
    const g = C.geometry(C.setT({}, t));
    const a = g.a, b = g.b;
    ok = ok &&
      near(a + b, C.DIAMETER) &&
      near(g.altitude * g.altitude, a * b) &&
      near(g.arbelosArea, g.circleArea) &&
      near(g.arbelosArea, g.fullArea / 2) &&
      near(g.fullArea, PI * g.chord * g.chord / 8) &&
      near(g.bigArc, g.smallArc) &&
      near(g.chord, 2 * Math.sqrt(a * b)) &&
      near(C.fractionAtX(g.N.x), g.t, 1e-9);
  }
  check("2000 random drags keep every identity true", ok);
  const edges = [C.geometry(C.setT({}, 0)), C.geometry(C.setT({}, 1))];
  check("the ends clamp just inside A and B, never onto them",
    edges.every((g) => g.altitude > 0 && g.a >= C.MIN_GAP - 1e-9 &&
      g.b >= C.MIN_GAP - 1e-9 && g.a < C.DIAMETER - 1e-9) &&
    near(edges[0].altitude, edges[1].altitude));
}

done("arbelos");
