#!/usr/bin/env node
"use strict";

/*
 * Logic test for arbelos-pww/arbelos-pww-core.js.
 *
 *   node porting/check-arbelos-pww.mjs
 *
 * The article states one exact claim, illustrated by a proof without words:
 * the arbelos equals the circle on the perpendicular at the contact point
 * (Archimedes, Book of Lemmas, Proposition 4). The proof uses Euclid's
 * semicircle form of the Pythagorean theorem three times: three blue and
 * three red semicircles, the biggest blue/red pair standing for the two legs
 * of the great right triangle. Every one of those equalities is checked at
 * 2001 draggable positions and at 2000 random ones. A second, literal
 * transcription of ArbelosPWWCanvas.init() and DrawArbelosPWW() from the
 * bytecode is compared with the core at every integer position of N.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("arbelos-pww/arbelos-pww-core.js", "ArbelosPwwCore");
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const PI = Math.PI;

/* ---------------------- a second transcription, straight from the bytecode */

/** init(): margin 80, side = min(width-2m, height-2m), rect(m, m, side, side). */
function appletRect(width, height, margin) {
  const side = Math.min(width - 2 * margin, height - 2 * margin);
  return { x: margin, y: margin, width: side, height: side };
}

/** init(): both ends of the horizontal line are (rect.x + ... , 2*rect.y + height)/2. */
function appletEnds(rect) {
  const row = (2 * rect.y + rect.height) / 2;
  return [
    { x: rect.x, y: row },
    { x: rect.x + rect.width, y: row },
  ];
}

/** DoubLine.CreateMidPoint(0.3) along the segment from A to B. */
function appletStart(rect) {
  const [a, b] = appletEnds(rect);
  return { x: a.x + 0.3 * (b.x - a.x), y: a.y + 0.3 * (b.y - a.y) };
}

/** PointIsEligible(x, y): inside the rect, above its middle row, 2px off the ends. */
function appletEligible(rect, x, y) {
  return x > rect.x + 2 && y > rect.y &&
    x < rect.x + rect.width && y < rect.y + rect.height / 2 - 2;
}

const d2 = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sq2 = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

/** GeoSDoub.ComputeAngle(a,b,c): acos((|ab|^2+|ac|^2-|bc|^2)/(2|ab||ac|)). */
function appletAngle(a, b, c) {
  const num = sq2(a, b) + sq2(a, c) - sq2(b, c);
  const den = 2 * d2(a, b) * d2(a, c);
  return den ? Math.acos(Math.max(-1, Math.min(1, num / den))) : 0;
}

/**
 * DrawArbelosPWW(), transcribed instruction by instruction:
 * L3 = (int)(point.x - rect.x); the left arc has diameter L3 and the right
 * arc rect.width - L3; L7 = round(sqrt(L3*(rect.width-L3))); A=(rect.x,y),
 * D=(point.x, y+L7), B=(rect.x+width, y); L10 = ComputeAngle(A,D,N);
 * L12 = round((pi-L10)*180/pi); L19 = 90-180-L12+180;
 * L13/L20 = Dist(A,D)/Dist(B,D) and their halves are the arc radii.
 */
function appletDraw(rect, point) {
  const L3a = Math.trunc(point.x - rect.x);
  const topLeft = rect.y + rect.height / 2 - Math.trunc(L3a) / 2;
  const L3b = rect.width - L3a;
  const topRight = rect.y + rect.height / 2 - Math.trunc(L3b) / 2;
  const L7 = Math.round(Math.sqrt(L3a * L3b));
  const L8 = { x: rect.x, y: point.y };
  const L9 = { x: point.x, y: point.y + L7 };
  const L18 = { x: rect.x + rect.width, y: point.y };
  const L10 = appletAngle(L8, L9, point);
  const L12 = Math.round((PI - L10) * 180 / PI);
  const L19 = 90 - (180 - L12) + 180; // L12 + 90, as the stack order gives
  return {
    a: L3a, b: L3b, topLeft: topLeft, topRight: topRight, h: L7,
    A: L8, D: L9, B: L18,
    angle: L10, blueStart: L12, redStart: L19,
    AD: d2(L8, L9), ADhalf: d2(L8, L9) / 2,
    BD: d2(L18, L9), BDhalf: d2(L18, L9) / 2,
    blueCentre: { x: (L8.x + L9.x) / 2, y: (L8.y + L9.y) / 2 },
    redCentre: { x: (L18.x + L9.x) / 2, y: (L18.y + L9.y) / 2 },
    circleX: Math.round(point.x - L7 / 2), circleY: Math.round(point.y - L7),
  };
}

/* ------------------------------------------------ 1. the applet's constants */

{
  const rect = appletRect(C.WIDTH, C.HEIGHT, C.MARGIN);
  check("the page embeds a 500 by 500 applet", C.WIDTH === 500 && C.HEIGHT === 500);
  check("the applet's margin is 80", C.MARGIN === 80);
  check("init's rectangle matches the core", JSON.stringify(C.RECT) === JSON.stringify(rect));
  check("side = min(w-2m, h-2m) = 340", C.SIDE === 340 && C.SIDE === rect.width &&
    C.SIDE === rect.height);
  const [ea, eb] = appletEnds(rect);
  const g = C.geometry(C.start({}));
  check("A and B lie on the middle row of init's rectangle",
    near(g.A.x, ea.x) && near(g.A.y, ea.y) && near(g.B.x, eb.x) && near(g.B.y, eb.y));
  const p0 = appletStart(rect);
  check("CreateMidPoint(0.3) puts N at 30% of AB",
    C.START_T === 0.3 && near(C.geometry(C.start({})).N.x, p0.x) &&
    near(C.geometry(C.start({})).N.y, p0.y));
}

/* ------------------------------------------- 2. start, moves, saved position */

{
  const s = C.start({});
  equal("start is plain data", s, { t: 0.3 });
  equal("start follows its options", C.start({ t: 0.72 }), { t: 0.72 });
  const next = C.setT(s, 0.8);
  check("setT leaves the old state alone and returns a new one",
    s.t === 0.3 && next.t === 0.8 && next !== s);
  check("a missing or bad t falls back to the start",
    C.clampT(undefined) === 0.3 && C.clampT(NaN) === 0.3);
  check("move is setT and an illustration never ends",
    C.move(s, 0.4).t === 0.4 && C.result(next) === null && C.legalMoves(s).length === 1);
  check("fractionAtX inverts the x of the handle",
    near(C.fractionAtX(C.geometry(C.setT(s, 0.41)).N.x), 0.41, 1e-9));
}

/* ------------------------------------- 3. geometry over 2001 drag positions */

{
  let halves = true, onCircle = true, mean = true, right = true, legs = true;
  const centre = C.geometry(C.start({})).centre;
  for (let i = 0; i <= 2000; i++) {
    const g = C.geometry(C.setT({}, i / 2000));
    const a = g.a, b = g.b;
    halves = halves && near(g.a + g.b, C.SIDE) && near(g.a, C.SIDE * g.t) && near(g.b, C.SIDE - a) &&
      near(g.N.x, C.RECT.x + a) && near(g.N.y, C.BASE_Y);
    // P and D are the two intersections of the perpendicular with the big circle.
    onCircle = onCircle && near(C.dist(g.P, centre), g.R) && near(C.dist(g.D, centre), g.R) &&
      near(g.P.x, g.N.x) && near(g.D.x, g.N.x) &&
      near(g.P.y, C.BASE_Y - g.h) && near(g.D.y, C.BASE_Y + g.h);
    mean = mean && near(g.h * g.h, a * b);
    // D lies on the circle with diameter AB, so ADB is a right angle and N is
    // the foot of the altitude from D onto the hypotenuse AB.
    right = right && near((g.D.x - g.A.x) * (g.D.x - g.B.x) +
      (g.D.y - g.A.y) * (g.D.y - g.B.y), 0, 1e-7);
    legs = legs && near(g.AD * g.AD, a * C.SIDE) && near(g.BD * g.BD, b * C.SIDE) &&
      near(g.AD * g.AD + g.BD * g.BD, C.SIDE * C.SIDE);
  }
  check("AN + NB is always the diameter and N stays on AB", halves);
  check("P and D always lie on the big circle", onCircle);
  check("the perpendicular is the geometric mean, h^2 = AN*NB", mean);
  check("angle ADB is right and DN is perpendicular to AB", right);
  check("AD^2 = AN*AB and BD^2 = NB*AB", legs);
}

/* -------------------------------- 4. the exact claim the proof without words makes */

{
  let euclidBig = true, euclidBlue = true, euclidRed = true;
  let prop4 = true, lower = true, biggest = true;
  const midG = C.geometry(C.setT({}, 0.5));
  let maximum = true, symmetry = true;
  for (let i = 0; i <= 2000; i++) {
    const t = i / 2000;
    const g = C.geometry(C.setT({}, t));
    const mirror = C.geometry(C.setT({}, 1 - t));
    // The semicircle on the hypotenuse equals the two on the legs.
    euclidBig = euclidBig && near(g.semiBig, g.semiAD + g.semiBD);
    euclidBlue = euclidBlue && near(g.semiAD, g.semiAN + g.semiND);
    euclidRed = euclidRed && near(g.semiBD, g.semiBN + g.semiND);
    // Proposition 4: the arbelos equals the circle on the perpendicular.
    prop4 = prop4 && near(g.arbelosArea, g.semiBig - g.semiAN - g.semiBN) &&
      near(g.arbelosArea, PI * g.a * g.b / 4) &&
      near(g.arbelosArea, g.circleArea) &&
      near(g.circleArea, PI * g.h * g.h / 4);
    // The blue half plus the red half below N is a whole circle on DN.
    lower = lower && near(g.lowerCircleArea, 2 * g.semiND) &&
      near(g.lowerCircleArea, g.circleArea);
    // The page calls AD and BD "the biggest of the blue and the biggest of the
    // red": each really is larger than the other two in its colour.
    biggest = biggest && g.AD >= g.a - 1e-9 && g.AD >= g.h - 1e-9 &&
      g.BD >= g.b - 1e-9 && g.BD >= g.h - 1e-9;
    maximum = maximum && g.arbelosArea <= midG.arbelosArea + 1e-9 &&
      g.h <= midG.h + 1e-9;
    symmetry = symmetry && near(g.arbelosArea, mirror.arbelosArea) &&
      near(g.h, mirror.h) && near(g.AD, mirror.BD) && near(g.a, mirror.b);
  }
  check("big semicircle = blue AD + red BD (great right triangle)", euclidBig);
  check("blue AD = blue AN + blue ND", euclidBlue);
  check("red BD = red BN + red ND", euclidRed);
  check("Proposition 4: arbelos = circle on the perpendicular, pi*AN*NB/4", prop4);
  check("the two coloured halves below N make an equal whole circle", lower);
  check("AD and BD really are the biggest blue and red semicircles", biggest);
  check("the gap and the perpendicular are largest with N in the middle", maximum);
  check("moving N the same distance from either end mirrors the figure", symmetry);
  check("at the middle the perpendicular is the radius of the big circle",
    near(midG.h, midG.R) && near(midG.arbelosArea, PI * midG.R * midG.R / 4));
}

/* ------------------ 5. the applet's own arithmetic at every integer position */

{
  const rect = appletRect(C.WIDTH, C.HEIGHT, C.MARGIN);
  let arcs = true, chord = true, angles = true, sloping = true, eligible = true;
  for (let k = 3; k <= C.SIDE - 3; k++) {
    const point = { x: rect.x + k, y: C.BASE_Y };
    const d = appletDraw(rect, point);
    const g = C.geometry(C.setT({}, C.fractionAtX(point.x)));
    const top = C.BASE_Y - k / 2;
    arcs = arcs && d.a === k && d.b === C.SIDE - k &&
      near(d.topLeft, top, 1e-9) &&
      near(d.topRight, C.BASE_Y - (C.SIDE - k) / 2, 1e-9);
    chord = chord && near(d.h, g.h, 0.6) &&
      near(d.A.y - d.h, g.P.y, 0.6) && near(d.D.y, g.D.y, 0.6);
    angles = angles && near(d.angle, g.angleA, 0.02) &&
      near(d.blueStart, g.blueStartDeg, 2) && near(d.redStart, g.redStartDeg, 2) &&
      d.redStart === d.blueStart + 90;
    sloping = sloping && near(d.AD, g.AD, 0.6) && near(d.BD, g.BD, 0.6) &&
      near(d.ADhalf, g.AD / 2, 0.6) && near(d.BDhalf, g.BD / 2, 0.6) &&
      near(d.blueCentre.x, (g.A.x + g.D.x) / 2, 1e-9) &&
      near(d.redCentre.x, (g.B.x + g.D.x) / 2, 1e-9);
    eligible = eligible && appletEligible(rect, point.x, point.y - 5);
  }
  check("the two small arc diameters and bounding boxes match DrawArbelosPWW", arcs);
  check("the applet's round(sqrt(a*b)) matches the perpendicular within a pixel", chord);
  check("ComputeAngle and both start angles match the bytecode", angles);
  check("the sloping semicircles' centres and radii match the bytecode", sloping);
  check("every interior drop just above AB is eligible", eligible);
  check("PointIsEligible excludes both ends of AB",
    !appletEligible(rect, rect.x + 1, C.BASE_Y - 5) &&
    !appletEligible(rect, rect.x + rect.width, C.BASE_Y - 5));
}

/* ------------------------------- 6. random positions and the saved position */

{
  const random = rng(2352);
  let ok = true;
  for (let i = 0; i < 2000; i++) {
    const g = C.geometry(C.setT({}, random()));
    ok = ok && near(g.h * g.h, g.a * g.b) &&
      near(g.semiBig, g.semiAD + g.semiBD) &&
      near(g.semiAD, g.semiAN + g.semiND) &&
      near(g.semiBD, g.semiBN + g.semiND) &&
      near(g.arbelosArea, g.circleArea) &&
      near(g.arbelosArea, PI * g.a * g.b / 4) &&
      near(g.lowerCircleArea, g.circleArea) &&
      near(C.fractionAtX(g.N.x), g.t, 1e-9);
  }
  check("2000 random drags keep every identity true", ok);

  const p = C.position(C.setT({}, 0.41));
  check("the saved position is JSON-safe and reports what is drawn",
    JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))) &&
    near(p.t, 0.41) && near(p.a + p.b, C.SIDE) && near(p.h * p.h, p.a * p.b, 1e-4) &&
    near(p.arbelosArea, p.circleArea, 1e-4) && p.blueStartDeg + 90 === p.redStartDeg);

  const ends = [C.geometry(C.setT({}, 0)), C.geometry(C.setT({}, 1))];
  check("the ends clamp just inside A and B, never onto them",
    ends.every((g) => g.h > 0 && g.a >= C.MIN_GAP - 1e-9 &&
      g.b >= C.MIN_GAP - 1e-9 && g.a < C.SIDE - 1e-9) &&
    near(ends[0].arbelosArea, ends[1].arbelosArea));
}

done("arbelos-pww");
