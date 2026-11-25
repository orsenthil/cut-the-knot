#!/usr/bin/env node
"use strict";

/*
 * Logic test for mandel-cycle/mandel-cycle-core.js.
 *
 *   node porting/check-mandel-cycle.mjs
 *
 * The escape count against a second version written with complex numbers as
 * pairs and a different loop; known points (0, -1, -2 stay; 1, 2i escape in
 * known rounds); the picture is symmetric about the real axis and sized as
 * the applet; the palette has 85 colours with the applet's ends and joins;
 * turning it out and in is an inverse and 85 turns come back; the colours
 * never leave 0..255; and the area of the set, estimated from the picture,
 * is a little over the true 1.5066 (more rounds only trim it).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("mandel-cycle/mandel-cycle-core.js", "MandelCycleCore");

/* --------------------------------------------- 1. the escape count */
{
  equal("0 is in the set", C.iterate(0, 0), 85);
  equal("-1 is in the set (a cycle of two)", C.iterate(-1, 0), 85);
  equal("-2 stays at |z|^2 = 4, never above", C.iterate(-2, 0), 85);
  equal("c = 1 escapes: z = 1, 2, 5 -> counted at the third look", C.iterate(1, 0), 2);
  equal("c = 3: z = 3 already has |z|^2 = 9 > 4", C.iterate(3, 0), 0);
  equal("c = 2i: z = 2i has |z|^2 = 4, then -4 + 2i is out", C.iterate(0, 2), 1);
  equal("c = -0.75 + 0.1i is slow to escape", C.iterate(-0.75, 0.1) > 20, true);
  equal("a point of the main cardioid: 0.25 stays", C.iterate(0.25, 0), 85);
  equal("0.26 (just past the cusp) escapes slowly, after 29 rounds", C.iterate(0.26, 0), 29);
}

/* -- 2. a second transcription: complex numbers as objects, a while loop -- */
{
  const mul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  const add = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
  const second = (re, im) => {
    const c = { re, im };
    let z = { re, im }, n = 0;
    while (n < 85) { if (z.re * z.re + z.im * z.im > 4) return n; z = add(mul(z, z), c); n++; }
    return 85;
  };
  let bad = 0, total = 0;
  for (let i = 0; i < 120; i++) for (let j = 0; j < 120; j++) {
    const re = -2.2 + (3 * i) / 119, im = -1.4 + (2.8 * j) / 119;
    total++; if (C.iterate(re, im) !== second(re, im)) bad++;
  }
  equal(`escape counts agree at ${total} points`, bad, 0);
}

/* --------------------------------------------- 3. the picture */
const img = C.image();
{
  equal("256 x 256 pixels", img.length, 256 * 256);
  let asym = 0;
  for (let r = 0; r < 256; r++) for (let c = 0; c < 256; c++) if (img[r * 256 + c] !== img[(255 - r) * 256 + c]) asym++;
  equal("symmetric about the real axis", asym, 0);
  const small = C.image(32);
  equal("another size works", small.length, 1024);
  const inside = img.filter((v) => v === 85).length;
  check("some pixels are in the set and some out", inside > 5000 && inside < 40000, String(inside));
  // area of the set: inside fraction of the 3.0 x 2.8 window
  const area = (inside / img.length) * 3.0 * 2.8;
  console.log(`  (area estimate ${area.toFixed(4)}; true area 1.5066)`);
  check("the estimate is a little over 1.5066", area > 1.5066 && area < 1.65, String(area));
}

/* --------------------------------------------- 4. the palette and its cycling */
{
  const p = C.palette();
  equal("85 colours", p.length, 85);
  equal("starts at red", p[0], [255, 0, 0]);
  equal("the blue-to-green join at index 10 is pure blue", p[10], [0, 0, 255]);
  equal("index 40 is pure green", p[40], [0, 255, 0]);
  equal("the last colour is nearly black", p[84].every((v) => v < 8), true);
  check("every channel is 0..255", p.every((c) => c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)));
  const out = C.rotate(p, "out"), inn = C.rotate(p, "in");
  equal("out moves each colour one place down and the first to the end", [out[0], out[84]], [p[1], p[0]]);
  equal("in is the opposite", [inn[0], inn[1]], [p[84], p[0]]);
  equal("in undoes out", C.rotate(out, "in"), p);
  let q = p; for (let i = 0; i < 85; i++) q = C.rotate(q, "out");
  equal("85 turns come back to the start", q, p);
  equal("the palette itself is untouched", C.palette(), p);
  const px = C.paint(img, p);
  equal("paint gives 4 bytes per pixel, opaque", [px.length, px[3]], [256 * 256 * 4, 255]);
  const turned = C.paint(img, out);
  let moved = 0; for (let i = 0; i < img.length; i++) if (img[i] < 85 && (turned[4 * i] !== px[4 * i] || turned[4 * i + 1] !== px[4 * i + 1] || turned[4 * i + 2] !== px[4 * i + 2])) moved++;
  check("turning the palette changes outside pixels' colours but not the counts", moved > 1000);
  equal("delay: fast 0, slow 250", [C.delayFor(true), C.delayFor(false)], [0, 250]);
}

done("mandel-cycle");
