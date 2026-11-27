#!/usr/bin/env node
"use strict";

/*
 * Logic test for equichordal/equichordal-core.js.
 *
 *   node porting/check-equichordal.mjs
 *
 * The applet's three selectors are exhaustive: Power 1,3,...,61, Shift
 * 1.0..11.0 by 0.1, Frequency 1,3,...,81 (128,431 combinations). Every
 * combination is compared with a second, literal transcription of the Java
 * methods NumberSelector.SetValue/InternalValue/DoubleValue,
 * EquichordalCanvas.Reset/UpdateParameters/g/GetX/GetY/GetSecondPoint and
 * DrawStandard, and the page's claims are checked over the same space:
 *   - r(t) + r(t + pi) is constant (so chords through the centre are equal)
 *     exactly when Frequency and Power are odd positive integers;
 *   - the drawn chord has length 2*trunc(min(w,h)/5) for every configuration;
 *   - the standard curve closes after N = 100*Frequency segments;
 *   - r(t) > 0 for the applet's curves, so the region is star-shaped about O.
 *
 * Also checked: the applet's pixel-snapping quirk (a requested Shift of 2.0
 * reads back as 1.99), the d < 0.1 guard in GetSecondPoint, trace growth,
 * immutability and the fact that this is a demo with no result.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("equichordal/equichordal-core.js", "EquichordalCore");

const W = 640, H = 460;
const O = { x: Math.trunc(W / 2), y: Math.trunc((H * 2) / 5) };
const POWERS = Array.from({ length: 31 }, (_, i) => 2 * i + 1);
const SHIFTS = Array.from({ length: 101 }, (_, i) => 1 + i / 10);
const FREQS = Array.from({ length: 41 }, (_, i) => 2 * i + 1);
const ALL = [];
for (const power of POWERS) {
  for (const shift of SHIFTS) {
    for (const freq of FREQS) ALL.push({ power, shift, freq });
  }
}

/* ----------------------------- the bytecode, transcribed a second time ----- */

// NumberSelector: x=10, nameWidth=56, width=w-20; SetValue then InternalValue.
function javaDouble(requested, divisions, scale, offset) {
  const x = 10 + 56;
  const w = W - 20 - 56;
  const mValue = (requested - offset) / scale;
  const mL = Math.round(x + (w * mValue) / divisions); // Math.round in SetValue
  const inside = Math.min(Math.max(mL, x), 10 + (W - 20)); // Inside(double)
  let internal = (divisions * (inside - x)) / w;
  internal = Math.min(Math.max(internal, 0), divisions);
  return internal * scale + offset; // DoubleValue()
}
function javaInt(requested, divisions, scale, offset) {
  return Math.round(javaDouble(requested, divisions, scale, offset)); // IntValue()
}
function javaOptions(o) {
  const p = o || {};
  return {
    power: javaInt(p.power === undefined ? 1 : p.power, 30, 2, 1),
    shift: javaDouble(p.shift === undefined ? 2 : p.shift, 100, 0.1, 1),
    freq: javaInt(p.freq === undefined ? 1 : p.freq, 40, 2, 1),
  };
}
function javaParams(p) {
  const scale = Math.trunc(Math.min(W, H) / 5) / p.shift; // UpdateParameters
  return { scale, segLen: scale * p.shift * 2, n: 100 * p.freq };
}
function javaG(p, t) { // EquichordalCanvas.g
  return javaParams(p).scale * (p.shift + Math.pow(Math.sin(p.freq * t), p.power));
}
function javaPoint(p, t) { // GetX/GetY, Java's d2i
  const g = javaG(p, t);
  return { x: Math.trunc(O.x + g * Math.cos(t)), y: Math.trunc(O.y + g * Math.sin(t)) };
}
function javaReset(o) { // Reset: A at t=0, B at t=pi
  const p = javaOptions(o);
  return { p, A: javaPoint(p, 0), B: javaPoint(p, Math.PI) };
}
function javaSecond(p, moved, other) { // GetSecondPoint, straight from bytecode
  const dx = O.x - moved.x, dy = O.y - moved.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.1) return { x: other.x, y: other.y };
  const len = javaParams(p).segLen;
  return { x: moved.x + (dx * len) / d, y: moved.y + (dy * len) / d };
}
function javaStandard(p) { // DrawStandard: i = 1..N, t = 2*pi*i/N
  const n = javaParams(p).n;
  const pts = [javaPoint(p, 0)];
  for (let i = 1; i <= n; i++) pts.push(javaPoint(p, (2 * Math.PI * i) / n));
  return pts;
}
const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;
const nearPoint = (a, b, eps = 1e-8) => near(a.x, b.x, eps) && near(a.y, b.y, eps);

/* ------------------------------------------------------- 1. constants/rules */

equal("archived canvas is 640x460", [C.WIDTH, C.HEIGHT], [W, H]);
equal("centre is (w/2, 2h/5)", C.CENTER, O);
equal("centre marker radius", C.MARK_RADIUS, 3);
equal("new diagram uses the applet defaults", [C.start({}).power, C.start({}).shift, C.start({}).freq, C.start({}).standard], [1, javaDouble(2, 100, 0.1, 1), 1, false]);
equal("the two draggable ends", C.legalMoves(), ["A", "B"]);
check("a demo has no result in any configuration", ALL.every((o) => C.result(C.start(o)) === null));

/* -------------------------------- 2. the selectors, over every division */

{
  let bad = 0;
  for (const [kind, spec, divisions] of [
    ["power", C.SELECTORS.power, 30],
    ["shift", C.SELECTORS.shift, 100],
    ["freq", C.SELECTORS.freq, 40],
  ]) {
    for (let i = 0; i <= divisions; i++) {
      const requested = spec.offset + spec.scale * i;
      const java = javaDouble(requested, divisions, spec.scale, spec.offset);
      if (!near(C.snapSelector(requested, spec), java)) bad++;
      if (!near(C.snapped(kind, requested), kind === "shift" ? java : Math.round(java))) bad++;
    }
  }
  check("all 3 selectors match NumberSelector at every division", bad === 0, `${bad} mismatches`);

  // Every integer a user can type, including values outside the range.
  let snappedBad = 0;
  for (let v = -5; v <= 90; v += 1) {
    if (!near(C.snapped("freq", v), javaInt(v, 40, 2, 1))) snappedBad++;
    if (!near(C.snapped("power", v), javaInt(v, 30, 2, 1))) snappedBad++;
  }
  for (let v = 0; v <= 12; v += 0.1) {
    if (!near(C.snapped("shift", v), javaDouble(v, 100, 0.1, 1))) snappedBad++;
  }
  check("selector snapping matches for out-of-range and fractional inputs", snappedBad === 0, `${snappedBad} mismatches`);

  // The harmless applet quirk: 2.0 is read back through the pixel grid as 1.99.
  check("requested Shift 2.0 snaps to the applet's 1.99",
    near(C.snapped("shift", 2), 1.99290780141844, 1e-12) &&
    near(javaDouble(2, 100, 0.1, 1), 1.99290780141844, 1e-12),
    `${C.snapped("shift", 2)}`);
}

/* ---------------- 3. Reset/g/GetX/GetY, compared for every configuration */

{
  let resetBad = 0, scaleBad = 0, endpointBad = 0;
  for (const o of ALL) {
    const s = C.start(o);
    const j = javaReset(o);
    if (s.power !== j.p.power || !near(s.shift, j.p.shift) || s.freq !== j.p.freq) resetBad++;
    if (s.power % 2 !== 1 || s.freq % 2 !== 1) resetBad++;
    const par = C.parameters(C.options(s));
    if (!near(par.scale, javaParams(j.p).scale) || !near(par.segLen, javaParams(j.p).segLen)) scaleBad++;
    if (!nearPoint(s.A, j.A) || !nearPoint(s.B, j.B)) endpointBad++;
  }
  check("all 128,431 selector combinations agree with the applet", resetBad === 0, `${resetBad} mismatches`);
  check("Scale, SegLen and N agree with UpdateParameters", scaleBad === 0, `${scaleBad} mismatches`);
  check("Reset puts A and B at the applet's t=0 and t=pi points", endpointBad === 0, `${endpointBad} mismatches`);
  // At Shift=1 the tiny positive Math.sin(freq*pi) can make Java's d2i put B
  // one pixel further left, so the opening chord reads 185 there. The applet
  // does the same; after the first drag the fixed length is always 184.
  let chordBad = 0, endsBad = 0, offByOne = 0;
  for (const o of ALL) {
    const s = C.start(o), j = javaReset(o);
    const chord = Math.hypot(s.B.x - s.A.x, s.B.y - s.A.y);
    if (!near(chord, 184) && !near(chord, 185)) chordBad++;
    if (near(chord, 185)) offByOne++;
    const expectedA = { x: 412, y: 184 };
    if (!nearPoint(s.A, expectedA) || ![227, 228].includes(s.B.x) || s.B.y !== 184 ||
        !nearPoint(s.A, j.A) || !nearPoint(s.B, j.B)) endsBad++;
  }
  check("the opening chord is 184 (or the applet's one-pixel 185)", chordBad === 0, `${chordBad} other lengths`);
  check("the starting ends are centre +/- 92 except at Shift=1 rounding", endsBad === 0, `${endsBad} mismatches`);
  check("every opening one-pixel chord is exactly the applet's own", offByOne > 0);
}

/* ---------------------- 4. the page's claims, over all configurations ---- */

{
  // r(t) + r(t+pi) = const for odd frequency and power; this is why every
  // chord through the centre is the same length. 12 sample angles per case.
  let sumBad = 0;
  const angles = Array.from({ length: 12 }, (_, i) => (Math.PI * i) / 12 + 0.013);
  for (const o of ALL) {
    const p = C.options(o);
    const par = C.parameters(p);
    for (const t of angles) {
      const a = C.radiusAt(p, t) + C.radiusAt(p, t + Math.PI);
      if (!near(a, par.segLen, 1e-7)) sumBad++;
    }
  }
  check("r(t)+r(t+pi) = SegLen for odd Frequency and Power (1.5M samples)", sumBad === 0, `${sumBad} failures`);

  // The page's own example r(t) = 2 + sin(t), and the general odd case.
  let polarBad = 0;
  for (const power of POWERS) {
    for (const freq of FREQS) {
      for (let i = 0; i <= 200; i++) {
        const t = (Math.PI * i) / 200;
        const s = C.polarRadius(2, 1, freq, power, t) + C.polarRadius(2, 1, freq, power, t + Math.PI);
        if (!near(s, 4, 1e-9)) polarBad++;
      }
    }
  }
  check("r(t)=2+sin(t) and every odd pair obey f(t)+f(t+pi)=const", polarBad === 0, `${polarBad} failures`);
  check("the page's r(t)=2+sin(t) gives chord length 4 at t=0 and t=pi",
    near(C.polarRadius(2, 1, 1, 1, 0) + C.polarRadius(2, 1, 1, 1, Math.PI), 4));
  check("even Frequency breaks the constant sum",
    !near(C.polarRadius(2, 1, 2, 1, Math.PI / 4) + C.polarRadius(2, 1, 2, 1, 5 * Math.PI / 4), 4));
  check("even Power breaks the constant sum",
    !near(C.polarRadius(2, 1, 1, 2, Math.PI / 4) + C.polarRadius(2, 1, 1, 2, 5 * Math.PI / 4), 4));

  // Positive radii mean the radial region is star-shaped about its centre.
  let negative = 0, zero = 0;
  for (const o of ALL.filter((_, i) => i % 97 === 0)) {
    const p = C.options(o);
    for (let i = 0; i <= 240; i++) {
      const r = C.radiusAt(p, (2 * Math.PI * i) / 240);
      if (r < -1e-9) negative++;
      if (near(r, 0, 1e-9)) zero++;
    }
  }
  check("applet curves have r(t)>=0, so they are star-shaped about O", negative === 0, `${negative} negative radii`);
  check("Shift=1 can put the curve through O at isolated angles", zero > 0, `${zero} zero radii`);

  // DrawStandard closes after N=100*Frequency segments.
  let polygonBad = 0;
  for (const freq of FREQS) {
    for (const power of [1, 31, 61]) {
      for (const shift of [1, 2, 7.3, 11]) {
        const p = C.options({ power, shift, freq });
        const pts = C.standardPoints(p);
        const java = javaStandard(javaOptions(p));
        if (pts.length !== 100 * freq + 1 || java.length !== pts.length) polygonBad++;
        // Java's d2i at t=2*pi can land one pixel above/below its t=0 start;
        // the applet's own DrawStandard has the same one-pixel seam.
        const seamX = Math.abs(pts[0].x - pts[pts.length - 1].x);
        const seamY = Math.abs(pts[0].y - pts[pts.length - 1].y);
        if (seamX > 1 || seamY > 1 || !nearPoint(pts[0], java[0]) ||
            !nearPoint(pts[pts.length - 1], java[java.length - 1])) polygonBad++;
        for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 24))) {
          if (!nearPoint(pts[i], java[i])) polygonBad++;
        }
      }
    }
  }
  check("standard curve matches DrawStandard and closes at N=100*Frequency", polygonBad === 0, `${polygonBad} failures`);
}

/* ---------------- 5. dragging: the other end, the guard, the trace -------- */

{
  let secondBad = 0, chordBad = 0, guardBad = 0;
  for (const o of ALL) {
    const s = C.start(o);
    const p = javaOptions(o);
    const par = C.parameters(C.options(s));
    for (const r of [20, 92, 170]) {
      for (let i = 0; i < 4; i++) {
        const t = (Math.PI * i) / 4 + 0.2;
        const moved = { x: O.x + r * Math.cos(t), y: O.y + r * Math.sin(t) };
        const expected = javaSecond(p, moved, s.B);
        const got = C.secondPoint(s, moved, s.B);
        if (!nearPoint(got, expected)) secondBad++;
        if (!near(Math.hypot(expected.x - moved.x, expected.y - moved.y), par.segLen)) chordBad++;
      }
    }
    // Inside the 0.1 pixel guard the applet returns the old other end.
    const atCentre = { x: O.x + 0.03, y: O.y + 0.04 };
    if (!nearPoint(C.secondPoint(s, atCentre, s.B), s.B)) guardBad++;
  }
  check("GetSecondPoint matches the bytecode over 1.5M drags", secondBad === 0, `${secondBad} mismatches`);
  check("every accepted chord has the fixed length SegLen", chordBad === 0, `${chordBad} failures`);
  check("the d<0.1 guard leaves the other end where it was", guardBad === 0, `${guardBad} failures`);

  // Dragging either end updates the other and records a trace; inputs do not mutate.
  let dragBad = 0, mutable = 0;
  const samples = ALL.filter((_, i) => i % 311 === 0);
  for (const o of samples) {
    const s = C.start(o);
    const frozen = JSON.stringify(s);
    const d = C.drag(s, "A", { x: 400, y: 220 });
    const jp = javaOptions(o);
    if (!nearPoint(d.B, javaSecond(jp, d.A, s.B))) dragBad++;
    if (JSON.stringify(s) !== frozen) mutable++;
    const d2 = C.drag(d, "B", { x: 250, y: 100 });
    if (!nearPoint(d2.A, javaSecond(jp, d2.B, d.B))) dragBad++;
    if (d.traceA.length !== s.traceA.length + 1 || d2.traceB.length !== s.traceB.length + 1) dragBad++;
    if (C.drag(s, "C", { x: 1, y: 1 }) !== s) dragBad++;
  }
  check("dragging A or B moves the opposite end exactly as the applet does", dragBad === 0, `${dragBad} failures`);
  check("positions are immutable and unknown handles are refused", mutable === 0, `${mutable} mutations`);

  // Selector changes keep the dragged chord, just as the applet's paint does.
  const s0 = C.start({});
  const moved = C.drag(s0, "A", { x: 430, y: 130 });
  const tuned = C.withOptions(moved, { power: 61, shift: 9, freq: 81, standard: true });
  check("changing a selector keeps A and B (no hidden Reset)",
    nearPoint(tuned.A, moved.A) && nearPoint(tuned.B, moved.B) &&
    tuned.power === 61 && tuned.freq === 81 && near(tuned.shift, C.snapped("shift", 9)) && tuned.standard);
  check("A fresh start after tuning returns to the curve's chord",
    nearPoint(C.start({ power: 61, shift: 9, freq: 81 }).A, { x: 412, y: 184 }));
}

/* ----------------------------- 6. saved position for the tutor ------------ */

{
  let posBad = 0;
  for (const o of ALL.filter((_, i) => i % 1009 === 0)) {
    const s = C.drag(C.start(o), "B", { x: 240, y: 150 });
    const pos = C.position(s);
    const copy = JSON.parse(JSON.stringify(pos));
    if (JSON.stringify(pos) !== JSON.stringify(copy)) posBad++;
    if (!near(copy.chord, Math.hypot(copy.B.x - copy.A.x, copy.B.y - copy.A.y), 1e-5)) posBad++;
    if (!near(copy.segLen, 184)) posBad++;
    if (!nearPoint(copy.center, O)) posBad++;
  }
  check("Track.state position is JSON-safe and keeps the chord measurement", posBad === 0, `${posBad} failures`);
}

done("equichordal");
