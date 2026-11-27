#!/usr/bin/env node
"use strict";

/*
 * Logic test for contrast-3/contrast-3-core.js.
 *
 *   node porting/check-contrast-3.mjs
 *
 * The second transcription below follows Contrast3Canvas.Draw(),
 * SetGrayColor(), Contrast3Panel.init() and java.awt.Color(float) straight
 * from javap's bytecode, including its integer divisions and rounding. It is
 * compared with the core across every reachable scrollbar setting (all
 * 101x61x101 geometry triples at three canvas sizes, all 101^3 tone triples),
 * and a pixel sampler built from the same draw operations checks the page's
 * claims: the annulus is one uniform gray and only the right half slides.
 * The live page no longer embeds the applet; its 2008 Wayback capture does
 * (https://web.archive.org/web/20080509103522/http://www.cut-the-knot.org/Curriculum/Geometry/Contrast3.shtml).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("contrast-3/contrast-3-core.js", "Contrast3Core");

/* ------------------------------------------------- a second transcription */

/** java.awt.Scrollbar(orientation, value, visible, min, max): max usable value. */
function bytecodeScrollbar(args) {
  const [orientation, value, visible, minimum, maximum] = args;
  return {
    orientation,
    min: minimum,
    max: maximum - visible, // setValues() constrains value + visible <= maximum
    initial: Math.min(maximum - visible, Math.max(minimum, value)),
  };
}

/** A separate float32 quantiser for java.awt.Color(float, float, float). */
function bytecodeTone(v) {
  const buf = new ArrayBuffer(4);
  const f32 = new Float32Array(buf);
  f32[0] = v / 100;
  const component = f32[0];
  f32[0] = component * 255;
  const scaled = f32[0] + 0.5;
  return Math.max(0, Math.min(255, Math.trunc(scaled)));
}

/** Contrast3Canvas.Draw(), instruction for instruction, in canvas pixels. */
function bytecodeGeometry(W, H, min, max, h) {
  const a = (d) => Math.round(d);
  const side = a(Math.min(W / 2.0, H)) - 2 * 20;
  const x = Math.trunc((W - 2 * side) / 2);
  const y = Math.trunc((H - side) / 2);
  const cx = x + side;
  const cy = y + Math.trunc(side / 2);
  const rOuter = a(((side / 2.0) * max) / 100.0 * (7.0 / 8.0));
  const rInner = a(rOuter * (9.0 / 10.0) * min / 100.0);
  const dy = a(side * h / 100.0);
  const patches = [];
  if (dy > 0) {
    patches.push({ color: "background", x: x + side, y: y + side, w: side, h: dy });
    patches.push({ color: "max", x: x + side, y, w: side, h: Math.trunc(side / 2) - rOuter + dy });
  } else if (dy < 0) {
    patches.push({ color: "background", x: x + side, y: 0, w: side, h: Math.trunc((H - side) / 2) });
    patches.push({ color: "max", x: x + side, y: cy + rOuter + dy, w: side, h: -dy });
  }
  return { side, x, y, cx, cy, rOuter, rInner, dy, patches };
}

/** The actual fill calls, then copyArea(dx=0, dy), then the two patch fills. */
function bytecodeOps(W, H, min, max, h) {
  const g = bytecodeGeometry(W, H, min, max, h);
  const ops = [
    { kind: "rect", x: g.x, y: g.y, w: g.side, h: g.side, color: "min" },
    { kind: "rect", x: g.x + g.side, y: g.y, w: g.side, h: g.side, color: "max" },
    { kind: "oval", x: g.cx - g.rOuter, y: g.cy - g.rOuter, w: 2 * g.rOuter, h: 2 * g.rOuter, color: "ring" },
    { kind: "arc", x: g.cx - g.rInner, y: g.cy - g.rInner, w: 2 * g.rInner, h: 2 * g.rInner, start: -90, color: "max" },
    { kind: "arc", x: g.cx - g.rInner, y: g.cy - g.rInner, w: 2 * g.rInner, h: 2 * g.rInner, start: 90, color: "min" },
    { kind: "copy", x: g.x + g.side, y: g.y, w: g.side, h: g.side, dx: 0, dy: g.dy },
    ...g.patches,
  ];
  return { g, ops };
}

function inside(op, x, y) {
  if (op.w <= 0 || op.h <= 0) return false;
  if (x < op.x || x >= op.x + op.w || y < op.y || y >= op.y + op.h) return false;
  if (op.kind === "oval") {
    const rx = op.w / 2, ry = op.h / 2;
    const u = (x - op.x - rx) / Math.max(1, rx), v = (y - op.y - ry) / Math.max(1, ry);
    return u * u + v * v <= 1;
  }
  if (op.kind === "arc") {
    const rx = op.w / 2, ry = op.h / 2;
    const u = (x - op.x - rx) / Math.max(1, rx), v = (y - op.y - ry) / Math.max(1, ry);
    if (u * u + v * v > 1) return false;
    // Java angles are clockwise from 3 o'clock: -90..+90 is the right half.
    return op.start === -90 ? u >= 0 : u <= 0;
  }
  return true;
}

/** The colour *name* at a pixel after the transcribed draw calls. */
function bytecodeColorAt(ops, x, y, upto = ops.length) {
  let color = "stage";
  for (let i = 0; i < upto; i++) {
    const op = ops[i];
    if (op.kind === "copy") {
      const sx = x - op.dx, sy = y - op.dy;
      if (sx >= op.x && sx < op.x + op.w && sy >= op.y && sy < op.y + op.h) {
        color = bytecodeColorAt(ops, sx, sy, i); // the pixels before the copy
      }
    } else if (inside(op, x, y)) {
      color = op.color;
    }
  }
  return color;
}

/** Sample a pixel from the transcribed draw calls, including copyArea(). */
function bytecodePixel(ops, tones, x, y) {
  const color = bytecodeColorAt(ops, x, y);
  return color === "stage" ? null : tones[color] ?? color;
}

/* ------------------------------------------- 1. defaults and scrollbar ranges */

{
  const s = C.start();
  equal("the applet's six starting scrollbar values", s,
    { max: 50, min: 50, h: 0, gray: 50, minColor: 50, maxColor: 100 });
  for (const key of C.KEYS) {
    const r = bytecodeScrollbar(C.RANGES[key].args);
    check(`${key} uses the AWT-reachable range ${r.min}..${r.max}`,
      C.RANGES[key].min === r.min && C.RANGES[key].max === r.max);
    check(`${key} starts at the scrollbar's initial value`,
      C.RANGES[key].initial === r.initial && s[key] === r.initial);
  }
  check("the declared upper bounds are 105, 105 and 55 before the 5-unit thumb",
    C.RANGES.max.args[4] === 105 && C.RANGES.min.args[4] === 105 && C.RANGES.h.args[4] === 55);
}

/* ------------------------------------- 2. clamping and immutability of options */

{
  const s = C.start();
  for (const key of C.KEYS) {
    const r = C.RANGES[key];
    check(`${key} clamps below its minimum`, C.withOption(s, key, r.min - 40)[key] === r.min);
    check(`${key} clamps above its maximum`, C.withOption(s, key, r.max + 40)[key] === r.max);
  }
  const next = C.withOption(s, "h", 25);
  check("moving one scrollbar does not change the given position", s.h === 0 && next.h === 25);
  check("unknown options are refused", C.start({ nope: 7 }).nope === undefined);
}

/* -------------------------------------- 3. geometry against the applet's Draw */

{
  const s = C.start();
  equal("the 500x300 opening picture", C.geometry(s),
    { width: 500, height: 300, side: 210, x: 40, y: 45, cx: 250, cy: 150,
      rOuter: 46, rInner: 21, dy: 0, patches: [] });
  equal("the suggested 400x300 picture", C.geometry(s, 400, 300),
    { width: 400, height: 300, side: 160, x: 40, y: 70, cx: 200, cy: 150,
      rOuter: 35, rInner: 16, dy: 0, patches: [] });

  let mismatches = 0, compared = 0;
  for (const [W, H] of [[500, 300], [400, 300], [375, 225]]) {
    for (let min = 0; min <= 100; min++) {
      for (let max = 40; max <= 100; max++) {
        for (let h = -50; h <= 50; h++) {
          const state = { max, min, h, gray: 50, minColor: 50, maxColor: 100 };
          const core = C.geometry(state, W, H);
          const byte = bytecodeGeometry(W, H, min, max, h);
          compared++;
          for (const k of Object.keys(byte)) {
            if (JSON.stringify(core[k]) !== JSON.stringify(byte[k])) mismatches++;
          }
          if (core.width !== W || core.height !== H) mismatches++;
        }
      }
    }
  }
  check(`all ${compared} reachable geometry triples match Draw() at three canvas sizes`, mismatches === 0,
    `${mismatches} field mismatches`);
}

/* --------------------------------- 4. gray tones against java.awt.Color(float) */

{
  let mismatches = 0;
  for (let gray = 0; gray <= 100; gray++) {
    for (let minColor = 0; minColor <= 100; minColor++) {
      for (let maxColor = 0; maxColor <= 100; maxColor++) {
        const a = C.analyse({ min: 50, max: 50, h: 0, gray, minColor, maxColor });
        if (a.tones.ring !== bytecodeTone(gray) ||
            a.tones.left !== bytecodeTone(minColor) ||
            a.tones.right !== bytecodeTone(maxColor)) mismatches++;
      }
    }
  }
  check("all 1,030,301 tone triples match java.awt.Color(float,float,float)", mismatches === 0,
    `${mismatches} tone mismatches`);
  check("the applet's defaults are 128, 128 and 255",
    C.tone(50) === 128 && C.tone(50) === 128 && C.tone(100) === 255);
  check("Color's float conversion is not always round(value*255)",
    C.tone(33) === 84 && C.tone(99) === 252 && C.tone(1) === 3);
}

/* ------------------------------------- 5. the page's claims, pixel by pixel */

{
  const bad = { ring: 0, slide: 0, contrast: 0, bounds: 0 };
  const hValues = [-50, -37, -9, -1, 0, 1, 9, 37, 50];
  for (let min = 0; min <= 100; min++) {
    for (let max = 40; max <= 100; max++) {
      for (const h of hValues) {
        const state = { max, min, h, gray: 73, minColor: 23, maxColor: 96 };
        const { g, ops } = bytecodeOps(500, 300, min, max, h);
        const tones = { ring: C.tone(73), min: C.tone(23), max: C.tone(96), background: null };
        const mid = Math.floor((g.rInner + g.rOuter) / 2);
        if (g.rInner > g.rOuter || g.rOuter * 2 > g.side) bad.bounds++;
        // A point in the left annulus; the matching point in the right ring
        // is taken from the side not covered by the applet's patch fills.
        if (mid > 0) {
          const left = bytecodePixel(ops, tones, g.cx - mid, g.cy);
          const rightY = g.cy + (g.dy < 0 ? mid : -mid) + g.dy;
          const right = bytecodePixel(ops, tones, g.cx, rightY);
          if (left !== tones.ring) bad.ring++;
          if (right !== tones.ring) bad.slide++;
        }
        // Away from the ring the two squares keep their declared shades.
        const far = Math.trunc(g.side * 0.4);
        const leftSquare = bytecodePixel(ops, tones, g.cx - far, g.y + g.side - 2);
        const rightSquareY = g.y + (g.dy < 0 ? g.side + g.dy - 2 : g.dy + 2);
        const rightSquare = bytecodePixel(ops, tones, g.cx + far, rightSquareY);
        if (leftSquare !== tones.min || rightSquare !== tones.max) bad.contrast++;
      }
    }
  }
  check("the ring is one uniform gray on both sides, at every setting sampled", bad.ring === 0,
    `${bad.ring} failures`);
  check("the right half of the ring slides by dy while the left half stays", bad.slide === 0,
    `${bad.slide} failures`);
  check("the two contrasting squares keep their own shades", bad.contrast === 0,
    `${bad.contrast} failures`);
  check("the inner disk never reaches beyond the gray ring or either square", bad.bounds === 0,
    `${bad.bounds} failures`);
}

/* ------------------------------------------ 6. the applet's rounding quirk */

{
  check("dy rounds to the nearest pixel and follows the sign of H",
    C.geometry({ h: 3 }, 500, 300).dy === 6 &&
    C.geometry({ h: -3 }, 500, 300).dy === -6 &&
    C.geometry({ h: 0 }, 500, 300).dy === 0);
  check("the two radii are rounded independently, like a(double)",
    C.geometry({ min: 50, max: 50 }, 400, 300).rOuter === 35 &&
    C.geometry({ min: 50, max: 50 }, 400, 300).rInner === 16);
  check("H = 50 slides the right square down by exactly half its side",
    C.geometry({ h: 50 }, 500, 300).dy === 105 &&
    C.geometry({ h: -50 }, 500, 300).dy === -105);
  check("a downward slide repaints two exposed strips", C.geometry({ h: 50 }).patches.length === 2);
  check("an upward slide repaints two exposed strips", C.geometry({ h: -50 }).patches.length === 2);
  check("no slide leaves no strips", C.geometry({ h: 0 }).patches.length === 0);
  check("dragging the marker back gives the same H value",
    C.slideFromPoint(C.start(), { x: 0, y: 150 + 21 }) === 10 &&
    C.slideFromPoint(C.start(), { x: 0, y: 150 - 21 }) === -10 &&
    C.slideFromPoint(C.start(), { x: 0, y: 150 }) === 0);
  check("a fresh picture never mutates the stored position",
    (() => { const s = C.start(); C.geometry(s, 400, 300); return JSON.stringify(s) === JSON.stringify(C.DEFAULTS); })());
}

done("contrast-3");
