#!/usr/bin/env node
"use strict";

/*
 * Logic test for angle/angle-core.js.
 *
 *   node porting/check-angle.mjs
 *
 * The applet classifies the *rounded absolute* measure in degrees, so the
 * boundaries are checked on both sides (including fractional values that
 * round onto a boundary). Every whole degree from -1800 to 1800 is compared
 * with a second, literal transcription of SignedAngle.ToString from the
 * bytecode, in both signed and unsigned modes. SignedAngle.Start uses
 * GeoSDoub.ComputeSignedAngle, also transcribed a second way from the bytecode
 * and compared over 1,000 random ray positions.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("angle/angle-core.js", "AngleCore");
const PI = Math.PI;
const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the new picture has A on the positive x ray", s.A, { x: 256, y: 120 });
  check("the new angle is the applet's initial 30 degrees", s.degrees === 30);
  check("the new angle is acute", C.classify(s.degrees) === "acute");
  check("the new picture is unsigned", s.signed === false);
  check("an illustration has no sign to report", C.label(s).suffix === null);
  equal("the default label", C.label(s).text, "30\u00b0 (acute)");
  const signed = C.start({ degrees: -30, signed: true });
  equal("a negative signed label", C.label(signed).text, "-30\u00b0 (acute, negative)");
  equal("unsigned mode drops the sign", C.label(C.toggleSigned(signed)).text, "30\u00b0 (acute)");
  check("the spinner stops at its maximum", C.setDegrees(s, 5000).degrees === 1800);
  check("the spinner stops at its minimum", C.setDegrees(s, -5000).degrees === -1800);
  check("fractions round to whole degrees", C.setDegrees(s, 44.6).degrees === 45);
  check("a point at the vertex leaves A alone", C.moveA(s, s.center).A === s.A);
  check("a point at the vertex leaves the angle alone", C.moveB(s, s.center).degrees === s.degrees);
  equal("toggling signed flips the mode", C.toggleSigned(s).signed, true);
  equal("starting a new picture restores the defaults", C.start({}).degrees, 30);
}

/* -------------------------------------------- 2. every classification edge */

/* Expected words straight from the applet's ToString branch order. */
function expected(deg) {
  const n = Math.abs(Math.round(deg));
  if (n === 0) return "zero";
  if (n === 90 || n === -90) return "right";
  if (n < 90) return "acute";
  if (n < 180) return "obtuse";
  if (n === 180) return "straight";
  if (n < 360) return "reflex";
  if (n === 360) return "full";
  return "big";
}

{
  const edges = [
    -361, -360, -359, -181, -180, -179, -91, -90, -89, -1,
    0, 1, 89, 90, 91, 179, 180, 181, 359, 360, 361,
  ];
  const words = [
    "big", "full", "reflex", "reflex", "straight", "obtuse", "obtuse", "right", "acute", "acute",
    "zero", "acute", "acute", "right", "obtuse", "obtuse", "straight", "reflex", "reflex", "full", "big",
  ];
  edges.forEach((deg, i) => {
    check(`classification at ${deg} degrees`, C.classify(deg) === words[i],
      `expected ${words[i]}, got ${C.classify(deg)}`);
  });

  // Rounding happens before classification: 89.6 rounds onto the right boundary.
  const fractional = [
    [89.4, "acute"], [89.5, "right"], [89.6, "right"],
    [-89.6, "right"], [179.4, "obtuse"], [179.6, "straight"],
    [359.4, "reflex"], [359.6, "full"], [0.4, "zero"], [-0.4, "zero"],
  ];
  fractional.forEach(([deg, word]) => {
    check(`classification of ${deg} (rounding)`, C.classify(deg) === word,
      `expected ${word}, got ${C.classify(deg)}`);
  });
}

/* ------------------------------------------------ 3. the page's claims */

{
  let bad = 0, wrongSign = 0, asymmetric = 0;
  for (let deg = C.MIN_DEGREES; deg <= C.MAX_DEGREES; deg++) {
    if (C.classify(deg) !== expected(deg)) bad++;
    if (C.signSuffix(C.radians(deg), true) !==
        (deg === 0 ? null : deg > 0 ? ", positive" : ", negative")) wrongSign++;
    if (C.classify(deg) !== C.classify(-deg)) asymmetric++;
  }
  check("all 3,601 whole degrees match the applet's branches", bad === 0, `${bad} wrong`);
  check("signed suffix is positive, negative or absent at zero", wrongSign === 0, `${wrongSign} wrong`);
  check("unsigned classification ignores the direction of the turn", asymmetric === 0, `${asymmetric} wrong`);

  let ranges = 0;
  for (let deg = 1; deg <= 1800; deg++) {
    const w = C.classify(deg);
    if (deg < 90 && w !== "acute") ranges++;
    if (deg > 90 && deg < 180 && w !== "obtuse") ranges++;
    if (deg > 180 && deg < 360 && w !== "reflex") ranges++;
    if (deg > 360 && w !== "big") ranges++;
  }
  check("the page's ranges: acute, obtuse, reflex, big", ranges === 0, `${ranges} wrong`);
  check("right is exactly 90 degrees", C.classify(90) === "right" && C.classify(89) !== "right" && C.classify(91) !== "right");
  check("straight is exactly 180 degrees", C.classify(180) === "straight" && C.classify(179) !== "straight" && C.classify(181) !== "straight");
  check("full is exactly 360 degrees", C.classify(360) === "full" && C.classify(359) !== "full" && C.classify(361) !== "full");
  check("zero is exactly no turn", C.classify(0) === "zero" && C.classify(1) !== "zero" && C.classify(-1) !== "zero");
  check("a doubled right angle is straight", C.classify(2 * 90) === "straight");
}

/* ------------------------- 4. a second transcription of SignedAngle.ToString */

function appletToString(value, signed) {
  const rounded = Math.round((value * 180) / PI);
  const out = new Array(3);
  out[0] = String(signed ? rounded : Math.abs(rounded));
  out[2] = signed ? (value === 0 ? null : value > 0 ? ", positive" : ", negative") : null;
  const n = Math.abs(rounded);
  if (n === 0) out[1] = "zero";
  else if (n === 90 || n === -90) out[1] = "right";
  else if (n < 90) out[1] = "acute";
  else if (n < 180) out[1] = "obtuse";
  else if (n === 180) out[1] = "straight";
  else if (n < 360) out[1] = "reflex";
  else if (n === 360) out[1] = "full";
  else out[1] = "big";
  return out;
}

{
  let badUnsigned = 0, badSigned = 0, badText = 0;
  for (let deg = C.MIN_DEGREES; deg <= C.MAX_DEGREES; deg++) {
    const value = C.radians(deg);
    for (const signed of [false, true]) {
      const [num, word, suffix] = appletToString(value, signed);
      const got = C.describe(value, signed);
      if (got.number !== Number(num) || got.word !== word || got.suffix !== suffix) {
        if (signed) badSigned++; else badUnsigned++;
      }
      if (got.text !== `${num}\u00b0 (${word}${suffix || ""})`) badText++;
    }
  }
  check("7,202 unsigned/signed descriptions match the bytecode", badUnsigned + badSigned === 0,
    `${badUnsigned} unsigned, ${badSigned} signed`);
  check("every printed line has the applet's exact shape", badText === 0, `${badText} wrong`);
}

/* ------------- 5. a second transcription of GeoSDoub.ComputeSignedAngle */

function appletSignedAngle(o, p, q) {
  const sq = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
  const d = (a, b) => Math.sqrt(sq(a, b));
  const cross = q.x * (o.y - p.y) + q.y * (p.x - o.x) + o.x * p.y - p.x * o.y;
  const orient = cross > 0 ? 1 : -1;
  const cos = (sq(o, p) + sq(o, q) - sq(p, q)) / (2 * d(o, p) * d(o, q));
  const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
  return orient === 1 ? angle : -angle;
}

{
  const rand = rng(20261126);
  const center = C.CENTER;
  let badStart = 0, badTerminal = 0, badMeasure = 0, badDraw = 0, badLabel = 0;
  for (let i = 0; i < 1000; i++) {
    const theta = (rand() * 2 - 1) * PI;
    const A = C.pointOnRay(center, C.RADIUS, theta);
    const deg = Math.round(C.MIN_DEGREES + rand() * (C.MAX_DEGREES - C.MIN_DEGREES));
    const value = C.radians(deg);
    const s = C.start({ degrees: deg });
    const moved = C.moveA(s, A);
    const B = C.terminalPoint(center, C.RADIUS, C.startRadians(center, A), value);

    if (!near(C.startRadians(center, A), wrap(theta), 1e-9) &&
        !near(Math.abs(C.startRadians(center, A)), PI, 1e-9)) badStart++;
    if (!near(C.dist(center, B), C.RADIUS, 1e-9) ||
        !near(wrap(Math.atan2(center.y - B.y, B.x - center.x) - (theta + deg * PI / 180)), 0, 1e-8)) {
      if (!near(Math.abs(wrap(theta + value)), PI, 1e-9)) badTerminal++;
    }
    const measured = C.mathSignedDegrees(center, A, B);
    // At exactly 180 degrees the cross product is zero, so either sign is the
    // same ray; allow the 360-degree wrap as well as the near miss.
    const delta = Math.abs(measured - Math.round(wrap(value) * 180 / PI));
    if (Math.min(delta, Math.abs(delta - 360)) > 1) badMeasure++;
    if (near(C.signedAngle(center, A, B), appletSignedAngle(center, A, B), 1e-12) === false) badDraw++;
    if (C.label(moved).word !== expected(deg)) badLabel++;
  }
  check("1,000 random Start angles agree with the position of A", badStart === 0, `${badStart} wrong`);
  check("1,000 terminal rays land at start + value on the circle", badTerminal === 0, `${badTerminal} wrong`);
  check("the drawn rays measure back to the entered turn", badMeasure === 0, `${badMeasure} wrong`);
  check("ComputeSignedAngle matches the bytecode transcription", badDraw === 0, `${badDraw} wrong`);
  check("classification follows the entered turn after dragging A", badLabel === 0, `${badLabel} wrong`);
}

/* Dragging OB rounds its measured turn to a whole degree. */
{
  const s = C.start({});
  const rand = rng(7);
  let bad = 0;
  for (let i = 0; i < 200; i++) {
    const theta = (rand() * 2 - 1) * PI;
    const target = C.pointOnRay(s.center, s.radius, theta);
    const next = C.moveB(s, target);
    const want = C.clamp(Math.round((wrap(theta) * 180) / PI), C.MIN_DEGREES, C.MAX_DEGREES);
    if (next.degrees !== want) bad++;
  }
  check("200 drags of OB set the spinner to the measured whole degrees", bad === 0, `${bad} wrong`);
  check("OB stays on the circle after a drag", near(C.dist(s.center, C.moveB(s, { x: 300, y: 300 }).B), C.RADIUS, 1e-9));
}

done("angle");
