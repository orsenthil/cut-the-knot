#!/usr/bin/env node
"use strict";

/*
 * Logic test for integer-sine/integer-sine-core.js.
 *
 *   node porting/check-integer-sine.mjs
 *
 * 1. IntegerSineCanvas.Draw is transcribed a second time, straight from the
 *    bytecode (including its different clipping rules and Java's d2i), and
 *    compared on every scale, function and modulo setting at five canvas
 *    sizes - 220 configurations in all.
 * 2. The page's claims are checked: sin(n mod 2PI) and sin(n) are the same
 *    values in a different order; the residues are distinct and fill the
 *    circle more tightly as N grows; the "periodic" pattern comes from near
 *    periods (44 and 710), not a real period.
 * 3. The option ranges, the inspector cursor and the tan clipping edges.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("integer-sine/integer-sine-core.js", "IntegerSineCore");

/* ------------------------------------------------- 1. applet's own constants */

{
  const s = C.start({});
  equal("defaults", { N: s.N, modular: s.modular, sin: s.sin, width: s.width, height: s.height, sample: s.sample },
    { N: 10, modular: true, sin: true, width: 400, height: 300, sample: 0 });
  equal("the panel's eleven scales", C.SCALES,
    [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240]);
  equal("an unknown scale falls back to the first radio button", C.start({ N: 37 }).N, 10);
  check("setOptions keeps the other options", (() => {
    const t = C.setOptions(C.start({}), { sin: false, modular: false, N: 80 });
    return t.sin === false && t.modular === false && t.N === 80 && t.width === 400;
  })());
  equal("residue of a small integer is itself", C.residue(3), 3);
  check("residue of n differs from n by a multiple of 2PI", [0, 1, 17, 999, 10239].every((n) => {
    const k = Math.round((n - C.residue(n)) / C.TWO_PI);
    return Math.abs(n - C.residue(n) - k * C.TWO_PI) < 1e-9;
  }));
}

/* -------------------------- 2. a second transcription of Canvas.Draw, in full */

/*
 * Written from the bytecode's instructions, not by calling the core. `d2i`
 * is Java's int cast: truncate toward zero. The two branches keep their own
 * clipping tests - that difference is a quirk of the original applet.
 */
function refDraw(s) {
  const d2i = (d) => Math.trunc(d);
  const size = { width: s.width, height: s.height };
  const cx = size.width / 2 | 0;   // Java: (int)(width / 2)
  const cy = size.height / 2 | 0;
  const N = s.N, A = 1, Modular = s.modular, Sin = s.sin;
  const out = [];
  if (Modular) {
    const twoPi = 6.283185307179586;
    let i = 0;
    while (i < N) {
      // 52: i2d, i2d, twoPi, ddiv, d2i, i2d, twoPi, dmul, dsub
      const r = i - d2i((i / twoPi)) * twoPi;
      // 69: r / twoPi * width, d2i
      const x = d2i((r / twoPi) * size.width);
      // 83: Sin ? -sin(r)*cy + cy : -tan(r)*cy + cy, d2i
      const y = d2i((Sin ? -Math.sin(r) : -Math.tan(r)) * cy + cy);
      const shown = y >= 0 && y <= size.height;
      out.push({ i: i, x: x, y: y, shown: shown });
      i += A;
    }
  } else {
    let i = 0;
    while (i < N) {
      // 178: (double)i / N * cx * 2.0, d2i
      const x = d2i((i / N) * cx * 2.0);
      // 197: Sin ? sin(i) : tan(i)/4.0
      const value = Sin ? Math.sin(i) : Math.tan(i) / 4.0;
      // 225: -2.0 < value < 2.0, then -value*cy+cy, d2i
      const y = d2i(-value * cy + cy);
      out.push({ i: i, x: x, y: y, shown: value > -2.0 && value < 2.0 });
      i += A;
    }
  }
  return out;
}

{
  const sizes = [[400, 300], [399, 301], [320, 200], [1024, 768], [201, 101]];
  let configs = 0;
  for (const [width, height] of sizes) {
    for (const N of C.SCALES) {
      for (const modular of [true, false]) {
        for (const sin of [true, false]) {
          const s = C.start({ width, height, N, modular, sin });
          equal(`Draw ${width}x${height} N=${N} mod=${modular} sin=${sin}`, C.draw(s), refDraw(s));
          configs++;
        }
      }
    }
  }
  check("the transcription covered every option and canvas size", configs === 220);
}

/* ------------------------------------------- 3. the page's claims, exhaustively */

{
  // "sin(N mod 2pi) ... or plain sin(N) with the horizontal scale chosen
  // accordingly": the same rounded heights, merely in a different order.
  for (const N of C.SCALES) {
    const mod = C.draw(C.start({ N, modular: true, sin: true })).map((p) => p.y).sort((a, b) => a - b);
    const plain = C.draw(C.start({ N, modular: false, sin: true })).map((p) => p.y).sort((a, b) => a - b);
    equal(`sin heights agree at N=${N}`, mod, plain);
  }
  const residues = Array.from({ length: 10240 }, (_, n) => C.residue(n));
  check("sin(n mod 2pi) equals sin(n) to floating precision",
    residues.every((r, n) => Math.abs(Math.sin(r) - Math.sin(n)) < 1e-9));
  check("no two integers below 10240 share a residue",
    new Set(residues.map((r) => r.toFixed(9))).size === residues.length);

  // "dense on the unit circle": the largest empty arc shrinks as the scale
  // grows. This is a theorem (Weyl equidistribution, since 1/(2pi) is
  // irrational); here it is checked over every scale the applet offers.
  const gaps = C.SCALES.map((N) => {
    const rs = residues.slice(0, N).slice().sort((a, b) => a - b);
    let g = rs[0] + (C.TWO_PI - rs[rs.length - 1]);
    for (let i = 1; i < rs.length; i++) g = Math.max(g, rs[i] - rs[i - 1]);
    return g;
  });
  check("every larger scale leaves a no larger gap", gaps.every((g, i) => i === 0 || g <= gaps[i - 1]));
  check("at the largest scales no gap exceeds 0.01 radians",
    gaps.slice(7).every((g) => g < 0.01), `gaps: ${gaps.map((g) => g.toFixed(4)).join(" ")}`);

  // The "periodic pattern" the page asks about is not a period: 2pi being
  // irrational rules one out. It is the near periods from continued fractions.
  const err = (p) => Math.abs(p - Math.round(p / C.TWO_PI) * C.TWO_PI);
  let best = 1, bestP = 0;
  for (let p = 1; p <= 710; p++) if (err(p) < best) { best = err(p); bestP = p; }
  equal("the best near period up to 710 is 710 (113 turns)", bestP, 710);
  check("710 steps miss a whole number of turns by only 6e-5 radians", Math.abs(best - 0.0000602887) < 1e-9);
  check("44 steps miss seven whole turns by about 0.018 radians",
    Math.abs(err(44) - 0.0177028497) < 1e-9);
  check("no integer step up to 710 is an exact period",
    Array.from({ length: 710 }, (_, j) => j + 1).every((p) => err(p) > 5e-5));
}

/* ----------------------------------------- 4. edge cases of the two branches */

{
  const s = C.start({ N: 10240, sin: false });
  const mod = C.shownPoints(C.setOptions(s, { modular: true }));
  const plain = C.shownPoints(C.setOptions(s, { modular: false }));
  // Modulo tan is drawn only when -cy <= -tan*r*cy+cy <= height, i.e.
  // |tan(r)| <= 1; plain tan is drawn when |tan(n)/4| < 2, i.e. |tan(n)| < 8.
  check("modulo tan draws about half the dots", Math.abs(mod.length / 10240 - 0.5) < 0.01,
    `got ${mod.length}`);
  check("plain tan draws about 92 percent of the dots", Math.abs(plain.length / 10240 - 0.919) < 0.01,
    `got ${plain.length}`);
  check("every drawn dot lies on the canvas horizontally",
    [true, false].every((modular) => [true, false].every((sin) =>
      C.shownPoints(C.start({ N: 640, modular, sin })).every((p) => p.x >= 0 && p.x < 400))));
  check("the raw clipping flags follow the bytecode", (() => {
    const all = C.draw(C.start({ N: 80, modular: true, sin: false }));
    return all.every((p) => p.shown === (p.y >= 0 && p.y <= 300));
  })());
}

/* --------------------------------------------------- 5. the inspector cursor */

{
  const s = C.start({ N: 10, sin: true });
  const pts = C.shownPoints(s);
  equal("the cursor starts on the first dot", pts[0].i, 0);
  equal("nearest dot to x=190 is integer 3", C.nearestSample(s, 190), 3);
  equal("step one integer", C.stepSample(s, 1).sample, 1);
  equal("step back", C.stepSample(C.stepSample(s, 1), -1).sample, 0);
  equal("steps stop at the last dot", C.stepSample(s, 100).sample, pts[pts.length - 1].i);
  const t = C.setOptions(s, { N: 10240 });
  check("the chosen integer survives a scale change", t.sample === 0 && t.N === 10240);
  const tan = C.start({ N: 10, sin: false, modular: true });
  check("tan mode never puts the cursor on a clipped dot",
    C.shownPoints(tan).some((p) => p.i === C.stepSample(tan, 5).sample));
  check("the status describes the inspected dot",
    /sin\(0\.000\) = 0\.000; dot 0 of 9, 10 dots on screen, modulo 2π/.test(C.describe(s)),
    C.describe(s));
}

done("integer-sine");
