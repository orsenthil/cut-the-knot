"use strict";

/*
 * Angle: An Illustrated Classification — Alexander Bogomolny's Angle applet.
 *
 * Two rays leave the vertex O. Ray OA can be dragged around a circle; the
 * angle's measure, a whole number of degrees entered with the spinner, places
 * the terminal ray OB. SignedAngle.ToString in the applet rounds that measure
 * to an integer and classifies its absolute value with the exact thresholds
 * 0, 90, 180 and 360. Signed mode also appends ", positive" or ", negative".
 * The picture is only an illustration: there is no win and no loss.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, AngleCore, so the page loads it with a
 * plain <script> and porting/check-angle.mjs loads it in Node. Positions are
 * plain data (numbers, strings, arrays, plain objects).
 */
const AngleCore = (() => {
  const PI = Math.PI;
  const MIN_DEGREES = -1800;
  const MAX_DEGREES = 1800;
  const INITIAL_DEGREES = 30;
  const CENTER = { x: 180, y: 120 };
  const RADIUS = 76;
  const EAST_OFFSET = 200;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const radians = (deg) => (deg * PI) / 180;
  const degrees = (rad) => (rad * 180) / PI;
  const normalize = (rad) => Math.atan2(Math.sin(rad), Math.cos(rad));

  /** GeoSDoub.FindOrientation: +1 when q is clockwise from p on the screen. */
  function orientation(o, p, q) {
    const cross = (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
    return cross > 0 ? 1 : -1;
  }

  /* GeoSDoub.ComputeSignedAngle(o, p, q), transcribed from its bytecode:
     orientation * acos((|op|^2 + |oq|^2 - |pq|^2) / (2 |op| |oq|)). */
  function signedAngle(o, p, q) {
    const op = dist(o, p), oq = dist(o, q);
    if (!op || !oq) return 0;
    const cos = clamp((sqDist(o, p) + sqDist(o, q) - sqDist(p, q)) / (2 * op * oq), -1, 1);
    const angle = Math.acos(cos);
    return orientation(o, p, q) === 1 ? angle : -angle;
  }

  /** The applet's Start: signed angle from ray OA to the positive x direction. */
  function startRadians(center, p) {
    return signedAngle(center, p, { x: center.x + EAST_OFFSET, y: center.y });
  }

  /* Math convention (y up), used for the rays the applet draws with -sin:
     a counterclockwise turn is positive. The screen cross product negates it. */
  function mathSignedDegrees(center, p, q) {
    return -Math.round(degrees(signedAngle(center, p, q)));
  }

  /** A point at a math-convention angle from the vertex, in screen units. */
  function pointOnRay(center, radius, angle) {
    return { x: center.x + radius * Math.cos(angle), y: center.y - radius * Math.sin(angle) };
  }

  function terminalPoint(center, radius, start, valueRadians) {
    return pointOnRay(center, radius, start + valueRadians);
  }

  /* SignedAngle.ToString's classification, on the *rounded absolute* degrees.
     The order matters: 90 and 180 and 360 are checked before the ranges. */
  function classify(valueDegrees) {
    const n = Math.abs(Math.round(valueDegrees));
    if (n === 0) return "zero";
    if (n === 90) return "right"; // the applet also tests -90, a harmless leftover
    if (n < 90) return "acute";
    if (n < 180) return "obtuse";
    if (n === 180) return "straight";
    if (n < 360) return "reflex";
    if (n === 360) return "full";
    return "big";
  }

  /** Exactly the third slot of the applet's ToString array. */
  function signSuffix(valueRadians, signed) {
    if (!signed || valueRadians === 0) return null;
    return valueRadians > 0 ? ", positive" : ", negative";
  }

  /** The three strings the applet prints on the picture. */
  function describe(valueRadians, signed) {
    const rounded = Math.round(degrees(valueRadians));
    const number = signed ? rounded : Math.abs(rounded);
    const word = classify(degrees(valueRadians));
    const suffix = signSuffix(valueRadians, signed);
    return {
      number: number,
      word: word,
      suffix: suffix,
      text: `${number}\u00b0 (${word}${suffix || ""})`,
    };
  }

  /* The draggable points are restricted to the circle by the applet. */
  function onCircle(center, radius, p) {
    const dx = p.x - center.x, dy = p.y - center.y;
    if (!dx && !dy) return null;
    const d = Math.hypot(dx, dy);
    return { x: center.x + (radius * dx) / d, y: center.y + (radius * dy) / d };
  }

  /** The starting picture: A on the positive x ray, OB 30 degrees above it. */
  function start(options) {
    const o = options || {};
    const center = { x: CENTER.x, y: CENTER.y };
    const radius = RADIUS;
    const requested = o.degrees === undefined ? INITIAL_DEGREES : o.degrees;
    const deg = Math.round(clamp(requested, MIN_DEGREES, MAX_DEGREES));
    const A = { x: center.x + radius, y: center.y };
    const signed = !!o.signed;
    return {
      center: center,
      radius: radius,
      A: A,
      B: terminalPoint(center, radius, startRadians(center, A), radians(deg)),
      degrees: deg,
      signed: signed,
    };
  }

  function setDegrees(state, value) {
    if (!Number.isFinite(value)) return state;
    const deg = Math.round(clamp(value, MIN_DEGREES, MAX_DEGREES));
    return Object.assign({}, state, {
      degrees: deg,
      B: terminalPoint(state.center, state.radius, startRadians(state.center, state.A), radians(deg)),
    });
  }

  function moveA(state, p) {
    const next = onCircle(state.center, state.radius, p);
    if (!next) return state;
    return Object.assign({}, state, {
      A: next,
      B: terminalPoint(state.center, state.radius, startRadians(state.center, next), radians(state.degrees)),
    });
  }

  /* A convenience not in the Java applet: dragging OB measures the turn from
     OA to the pointer and rounds it to whole degrees, just like the spinner. */
  function moveB(state, p) {
    const next = onCircle(state.center, state.radius, p);
    if (!next) return state;
    return setDegrees(state, mathSignedDegrees(state.center, state.A, next));
  }

  function toggleSigned(state) {
    return Object.assign({}, state, { signed: !state.signed });
  }

  function label(state) {
    return describe(radians(state.degrees), state.signed);
  }

  return {
    PI: PI, MIN_DEGREES: MIN_DEGREES, MAX_DEGREES: MAX_DEGREES,
    INITIAL_DEGREES: INITIAL_DEGREES, CENTER: CENTER, RADIUS: RADIUS,
    clamp: clamp, radians: radians, degrees: degrees, normalize: normalize,
    sqDist: sqDist, dist: dist, orientation: orientation,
    signedAngle: signedAngle, startRadians: startRadians,
    mathSignedDegrees: mathSignedDegrees, pointOnRay: pointOnRay,
    terminalPoint: terminalPoint, onCircle: onCircle,
    classify: classify, signSuffix: signSuffix, describe: describe,
    start: start, setDegrees: setDegrees, moveA: moveA, moveB: moveB,
    toggleSigned: toggleSigned, label: label,
  };
})();
