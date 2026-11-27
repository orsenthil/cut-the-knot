#!/usr/bin/env node
"use strict";

/*
 * Logic test for close-to-hilbert/close-to-hilbert-core.js.
 *
 *   node porting/check-close-to-hilbert.mjs
 *
 * The applet's own combine/reverse/complement, init, Reset and turtle drawing
 * are transcribed a second time below, straight from javap -c -p, and compared
 * with the core over levels 1..10, all the canvas sizes that matter and both
 * decorations. The page's claims are checked as well: the four-copy rule, a
 * continuous curve inside a fixed square, and the sense in which the
 * approximations get dense (every lattice point of the rectangle is within one
 * shrinking step of the curve). The finite curves do revisit lattice points,
 * so they are not the simple Hilbert polygon; the test asserts that too.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("close-to-hilbert/close-to-hilbert-core.js", "CloseToHilbertCore");

/* ------------------------------------------- literal bytecode transcription */

const Digit = (d) => "0123"[((d % 4) + 4) % 4] || "0"; // IntToChar, default '0'
const Num = (c) => c.charCodeAt(0) - 48; // CharToInt
const half = (n) => Math.floor(n / 2); // Java integer division, n >= 0

/* reverse(int k, StringBuffer s): s.reverse(), then (digit + k) % 4. */
function AppletReverse(k, s) {
  let r = "";
  for (let i = s.length - 1; i >= 0; i--) r += Digit((Num(s[i]) + k) % 4);
  return r;
}

/* complement(StringBuffer s): digit d -> 3 - d. */
function AppletComplement(s) {
  let r = "";
  for (let i = 0; i < s.length; i++) r += Digit(3 - Num(s[i]));
  return r;
}

/* rotate(int k, StringBuffer s): an unused leftover; digit -> (digit + k) % 4. */
function AppletRotate(k, s) {
  let r = "";
  for (let i = 0; i < s.length; i++) r += Digit((Num(s[i]) + k) % 4);
  return r;
}

/* combine(int k): base "1" at k == maxStep; result = R + prev + prev + C. */
function AppletCombine(k, maxStep) {
  if (k === maxStep) return "1";
  const prev = AppletCombine(k + 1, maxStep);
  const r = AppletReverse(3, prev);
  const c = AppletComplement(prev);
  return r + prev + prev + c;
}

/* init(): the canvas sizing and the initial string, with maxStep reduced to 1. */
function AppletInit(w, h) {
  let step = half(Math.min(w, h));
  let absMax = 1;
  while (half(step) >= 2) { step = half(step); absMax++; }
  let pow = 1;
  for (let i = 0; i < absMax; i++) pow *= 2;
  const x0 = half(w - step * pow), y0 = half(h - step * pow);
  let maxStep = absMax;
  while (maxStep > 1) { maxStep--; step *= 2; }
  step *= 2;
  const startStep = step * 2;
  const initialWord = AppletCombine(1, maxStep);
  return { maxStep: maxStep, absMax: absMax, step: step, startStep: startStep,
    x0: x0, y0: y0, word: initialWord };
}

/* Reset(): called by every mouse click, including the wrap at step == 1. */
function AppletReset(a) {
  a.maxStep++;
  a.step = half(a.step);
  if (a.step === 1) {
    a.step = half(a.startStep);
    a.maxStep = 1;
  }
  a.word = AppletCombine(1, a.maxStep);
  return a;
}

/*
 * drawCloseToHilbert(): the four locals x3,y4 (start), x5,y6 (end) and the
 * switch on each letter. L9/L10 are saved in the bytecode but never read.
 */
function AppletDraw(letters, step, x0, y0, which) {
  const h = half(step);
  let x3 = x0, y4 = y0, x5 = x0, y6 = y0;
  const out = [];
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i];
    switch (ch) {
      case "0": y6 = y4 + step; break;
      case "1": x5 = x5 + step; break;
      case "2": y6 = y4 - step; break;
      default:  x5 = x3 - step; break;
    }
    let arc = null, apex = null;
    if (which === 0) {
      switch (ch) { // drawArc(x, y, w, h, startAngle, arcAngle)
        case "0": arc = [x3 - h, y4, step, step, -90, 180]; break;
        case "1": arc = [x3, y4 - h, step, step, 180, 180]; break;
        case "2": arc = [x3 - h, y4 - step, step, step, 90, 180]; break;
        default:  arc = [x3 - step, y4 - h, step, step, 0, 180]; break;
      }
    } else {
      switch (ch) { // drawLine(start, apex); drawLine(apex, end)
        case "0": apex = [x3 + h, y4 + h]; break;
        case "1": apex = [x3 + h, y4 - h]; break;
        case "2": apex = [x3 - h, y4 - h]; break;
        default:  apex = [x3 - h, y4 + h]; break;
      }
    }
    out.push({ from: [x3, y4], to: [x5, y6], arc: arc, apex: apex });
    x3 = x5;
    y4 = y6;
  }
  return out;
}

const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps);
const samePoint = (p, q) => near(p.x, q[0]) && near(p.y, q[1]);

/* ------------------------------------------------------------ 1. starting point */

{
  const s = C.start({ width: 320, height: 320, side: 128 });
  equal("initial word is the one letter 1", C.word(s.level), "1");
  equal("initial level", s.level, 1);
  equal("initial step is the whole side", s.step, 128);
  equal("initial origin is centred", s.origin, { x: 96, y: 96 });
  equal("initial decoration", s.variant, "semicircles");
  equal("available decorations", C.VARIANTS, ["semicircles", "tents"]);
}

/* ------------------------------- 2. the four-copy rule against the bytecode */

for (let level = 1; level <= 10; level++) {
  const mine = C.word(level);
  check(`word matches combine(1, ${level})`, mine === AppletCombine(1, level));
  check(`word length at level ${level} is 4^(${level} - 1)`, mine.length === Math.pow(4, level - 1),
    `got ${mine.length}`);
  if (level >= 2) {
    const prev = AppletCombine(1, level - 1);
    check(`level ${level} is four transformed copies of level ${level - 1}`,
      mine === AppletReverse(3, prev) + prev + prev + AppletComplement(prev));
  }
}

/* 3. the drawing itself: arcs, tents and turtle ends, over many configurations */

const sizes = [[320, 128], [256, 64], [384, 192], [512, 256], [420, 384], [500, 384]];
for (const [canvas, side] of sizes) {
  for (let level = 1; level <= 7; level++) {
    for (const which of [0, 1]) {
      const state = C.start({ width: canvas, height: canvas, side: side,
        level: level, variant: which ? "tents" : "semicircles" });
      const step = side / Math.pow(2, level - 1);
      if (!Number.isInteger(step)) continue; // the Java draw uses integer steps
      const drawn = AppletDraw(AppletCombine(1, level), step, state.origin.x, state.origin.y, which);
      const mine = C.pieces(state);
      let agrees = mine.length === drawn.length;
      for (let i = 0; agrees && i < mine.length; i++) {
        const p = mine[i], q = drawn[i];
        agrees = p.ch === AppletCombine(1, level)[i] && samePoint(p.from, q.from) && samePoint(p.to, q.to);
        if (q.arc) {
          agrees = agrees && q.apex === null && p.center &&
            near(p.center.x - p.radius, q.arc[0]) && near(p.center.y - p.radius, q.arc[1]) &&
            near(2 * p.radius, q.arc[2]) && near(2 * p.radius, q.arc[3]) &&
            near(p.a0 * 180 / Math.PI, q.arc[4]) && near((p.a1 - p.a0) * 180 / Math.PI, q.arc[5]);
        } else {
          agrees = agrees && p.apex && samePoint(p.apex, q.apex);
        }
      }
      check(`drawing at ${canvas}/${side} level ${level} ${which ? "tents" : "semicircles"}`, agrees);
    }
  }
}

/* ------------------------------------------- 4. continuity, arcs and tents */

for (let level = 1; level <= 7; level++) { // side 128: step 2 at 7, 1 would wrap
  for (const variant of C.VARIANTS) {
    const s = C.start({ width: 320, height: 320, side: 128, level: level, variant: variant });
    const p = C.pieces(s);
    let continuous = p.length === Math.pow(4, level - 1);
    for (let i = 0; i < p.length; i++) {
      if (i && !samePoint(p[i].from, [p[i - 1].to.x, p[i - 1].to.y])) continuous = false;
      const dx = p[i].to.x - p[i].from.x, dy = p[i].to.y - p[i].from.y;
      const step = s.step, ch = p[i].ch;
      if (!((ch === "0" && near(dx, 0) && near(dy, step)) ||
            (ch === "1" && near(dx, step) && near(dy, 0)) ||
            (ch === "2" && near(dx, 0) && near(dy, -step)) ||
            (ch === "3" && near(dx, -step) && near(dy, 0)))) continuous = false;
      if (variant === "semicircles") {
        const start = { x: p[i].center.x + p[i].radius * Math.cos(p[i].a0),
          y: p[i].center.y + p[i].radius * Math.sin(p[i].a0) };
        const end = { x: p[i].center.x + p[i].radius * Math.cos(p[i].a1),
          y: p[i].center.y + p[i].radius * Math.sin(p[i].a1) };
        if (!samePoint(start, [p[i].from.x, p[i].from.y]) ||
            !samePoint(end, [p[i].to.x, p[i].to.y])) continuous = false;
        if (!near((p[i].a1 - p[i].a0) * 180 / Math.PI, 180)) continuous = false;
      } else {
        // The tent apex sits half a step to the left of the direction of travel.
        const mx = (p[i].from.x + p[i].to.x) / 2, my = (p[i].from.y + p[i].to.y) / 2;
        const cross = dx * (p[i].apex.y - my) - dy * (p[i].apex.x - mx);
        if (!near(cross, -(s.step * s.step) / 2)) continuous = false;
      }
    }
    check(`${variant} curve is continuous at level ${level}`, continuous);
  }
}

/* --------------------------------- 5. init sizing and the click cycle */

const canvases = [[40, 40], [64, 90], [80, 120], [120, 200], [200, 200], [240, 320],
  [320, 240], [320, 320], [400, 300], [512, 512], [700, 500], [1000, 800]];
for (const [w, h] of canvases) {
  const a = AppletInit(w, h), mine = C.configure({ width: w, height: h });
  check(`init sizing for ${w}x${h}`,
    mine.origin.x === a.x0 && mine.origin.y === a.y0 && mine.side === a.step && mine.absMax === a.absMax,
    `core ${JSON.stringify(mine)} vs applet ${JSON.stringify(a)}`);
  check(`init word is one letter for ${w}x${h}`, a.word === "1" && C.word(1) === "1");
  check(`the initial square fits ${w}x${h}`,
    mine.origin.x >= 0 && mine.origin.y >= 0 &&
    mine.origin.x + mine.side <= w && mine.origin.y + mine.side <= h);

  // Every state the applet can show after 0, 1, 2, ... clicks.
  let applet = Object.assign({}, a);
  let core = C.start({ width: w, height: h });
  let cycle = true;
  for (let clicks = 1; clicks <= 14; clicks++) {
    AppletReset(applet);
    core = C.advance(core);
    if (core.level !== applet.maxStep || core.step !== applet.step ||
        C.word(core.level) !== applet.word || core.step < C.MIN_STEP) cycle = false;
    if (applet.maxStep === 1 && applet.step === a.step) break; // back to the start
  }
  check(`click cycle follows Reset for ${w}x${h}`, cycle);
}

/* ------------------------ 6. the page's claim: a square filled in the limit */

for (let level = 1; level <= 7; level++) {
  const s = C.start({ width: 320, height: 320, side: 128, level: level });
  const p = C.pieces(s);
  const xs = p.map((q) => q.from.x).concat([p[p.length - 1].to.x]);
  const ys = p.map((q) => q.from.y).concat([p[p.length - 1].to.y]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  check(`turtle spans side by side-minus-step at level ${level}`,
    near(width, s.side) && near(height, Math.max(0, s.side - s.step)));

  // Ink (arc boxes and tent apexes) stays inside one fixed square; the step
  // of that grid shrinks by two every level, so the drawing gets arbitrarily
  // fine while the region it occupies stays put.
  let outer = true;
  for (const q of p) {
    const points = s.variant === "semicircles"
      ? [{ x: q.center.x - q.radius, y: q.center.y - q.radius },
         { x: q.center.x + q.radius, y: q.center.y + q.radius }]
      : [q.from, q.apex, q.to];
    for (const v of points) {
      if (v.x < s.origin.x - s.step || v.x > s.origin.x + s.side + s.step ||
          v.y < s.origin.y - s.step || v.y > s.origin.y + s.side) outer = false;
    }
  }
  check(`level ${level} stays in a fixed square`, outer);
  check(`the grid step halves at level ${level}`, near(s.step, s.side / Math.pow(2, level - 1)));

  if (level <= 7) {
    // Every lattice point of the covered rectangle has a visited neighbour:
    // no hole bigger than one shrinking cell, so the limit is dense there.
    const visited = new Set(p.map((q) => `${q.from.x},${q.from.y}`));
    visited.add(`${p[p.length - 1].to.x},${p[p.length - 1].to.y}`);
    const dx = Math.round(s.step), n = Math.pow(2, level - 1);
    let gap = 0;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j < n; j++) {
        const x = s.origin.x + i * dx, y = s.origin.y + j * dx;
        if (visited.has(`${x},${y}`)) continue;
        let d = 1;
        for (const k of [-1, 0, 1]) for (const l of [-1, 0, 1]) {
          if ((k || l) && visited.has(`${x + k * dx},${y + l * dx}`)) d = 0;
        }
        gap = Math.max(gap, d);
      }
    }
    check(`no lattice hole at level ${level}`, gap === 0);
    const xs = p.map((q) => Math.round((q.from.x - s.origin.x) / dx))
      .concat([Math.round((p[p.length - 1].to.x - s.origin.x) / dx)]);
    const ys = p.map((q) => Math.round((q.from.y - s.origin.y) / dx));
    check(`the curve visits each row and column at level ${level}`,
      new Set(xs).size === n + 1 && new Set(ys).size === n);
    const repeats = p.length + 1 - visited.size;
    check(`finite curve ${level >= 3 ? "revisits" : "does not revisit"} lattice points`,
      level >= 3 ? repeats > 0 : repeats === 0, `repeats ${repeats}`);
  }
}

/* ------------------------------------ 7. both decorations share one route */

for (let level = 1; level <= 7; level++) {
  const a = C.pieces(C.start({ side: 128, level: level, variant: "semicircles" }));
  const b = C.pieces(C.start({ side: 128, level: level, variant: "tents" }));
  let same = a.length === b.length;
  for (let i = 0; same && i < a.length; i++) same = samePoint(a[i].to, [b[i].to.x, b[i].to.y]);
  check(`semicircles and tents take the same route at level ${level}`, same);
}

/* --------------------------------------------------- 8. unused applet leftovers */

{
  // rotate() and CombineTwo() are never called by the applet; keep them as
  // harmless quirks rather than importing their behaviour into the port.
  // CombineTwo(a,b): odd first digit of b wins, else odd last digit of a wins,
  // else the odd number '1'. (Both methods are dead code in the applet.)
  function AppletCombineTwo(a, b) {
    const c = a.charCodeAt(a.length - 1), d = b.charCodeAt(0);
    if (d % 2 === 1) return String.fromCharCode(c);
    if (c % 2 === 1) return String.fromCharCode(d);
    return "1";
  }
  equal("rotate(1, '0123') is a leftover", AppletRotate(1, "0123"), "1230");
  equal("CombineTwo: odd first digit returns the last digit", AppletCombineTwo("00", "32"), "0");
  equal("CombineTwo: odd last digit returns the first digit", AppletCombineTwo("01", "20"), "2");
  equal("CombineTwo's fallback is the odd digit 1", AppletCombineTwo("02", "20"), "1");
  // An odd step leaves arc ends half a unit off the turtle's lattice: the
  // applet's int division truncates its arc box, and so does the core.
  const odd = C.start({ width: 256, height: 256, side: 192, level: 7 });
  const oddPiece = C.pieces(odd).find((p) => p.ch === "0");
  check("odd-step arcs keep the applet's truncated box", odd.step === 3 && !!oddPiece &&
    near(oddPiece.center.x - oddPiece.radius, oddPiece.from.x - 1));
  const s = C.start({ side: 128, variant: "tents" });
  check("the status sentence reports the level and decoration",
    /Step 1: 1 tent/.test(C.describe(s)));
}

done("close-to-hilbert");
