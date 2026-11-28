#!/usr/bin/env node
"use strict";

/*
 * Logic test for judd-illusion/judd-illusion-core.js.
 *
 *   node porting/check-judd-illusion.mjs
 *
 * Section 2 re-transcribes JuddIllusionCanvas.Draw / Arrow / Bob straight from
 * `javap -c -p`, including Java's truncating int divisions and Math.round, and
 * compares the bar, both end arrows and the middle mark with the core over the
 * whole slider space: all L x W, all H x A, all B x marker, plus a seeded
 * random sweep of the joint space at six canvas sizes.
 *
 * Section 3 checks the page's claim as far as pixels can: the mark really is
 * midway along the bar and the two halves are equal (for an even-width canvas;
 * Java's truncating division puts it one pixel left on an odd width), and
 * swapping the rectangle for an arrow head leaves the bar completely alone.
 * How long the halves *look* is perception, not geometry: no pixel test can
 * measure that, so the test says so instead of pretending to.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("judd-illusion/judd-illusion-core.js", "JuddIllusionCore");

/* ------------------------------------------- 1. the applet's opening values */

{
  equal("the canvas's opening fields (A is the canvas field, not the scrollbar)", C.start(), {
    L: 20, W: 5, H: 50, A: 10, B: 10, bob: true, probe: { x: 250, y: 290 },
  });
  equal("the A scrollbar starts at 30 while the drawing code starts at 10",
    [C.SCROLLBAR_START.A, C.DEFAULTS.A], [30, 10]);
  equal("the five scrollbar ranges from JuddIllusionPanel", C.LIMITS, {
    L: [10, 45], W: [0, 20], H: [10, 110], A: [-90, 90], B: [1, 40],
  });
  equal("the live page's fcolor and bcolor parameters", C.PAGE_COLORS,
    { background: "ffffff", foreground: "000000" });

  const s = C.start();
  check("changing one control returns a new position without mutating the old one",
    C.option(s, "L", 45) !== s && s.L === 20 && C.option(s, "L", 45).L === 45);
  check("an unknown control is ignored", C.option(s, "nope", 7) === s);
  check("the marker checkbox toggles to an arrow head and back",
    C.option(s, "bob", false).bob === false && C.option(C.option(s, "bob", 0), "bob", 1).bob === true);
  let clamped = true;
  for (const key of C.OPTIONS) {
    const [lo, hi] = C.LIMITS[key];
    if (C.option(s, key, lo - 999)[key] !== lo) clamped = false;
    if (C.option(s, key, hi + 999)[key] !== hi) clamped = false;
  }
  check("every slider clamps at both of the applet's ends", clamped);
  check("a fractional slider value is rounded as a Java scrollbar would be",
    C.option(s, "L", 12.7).L === 13 && C.option(s, "A", -30.4).A === -30);
  check("javaRound agrees with Math.round on positive canvas arithmetic",
    [10, 45, 50, 100].every((L) => C.javaRound(500 * (100 - 2 * L) / 100.0 / 2.0)
      === Math.round(500 * (100 - 2 * L) / 100.0 / 2.0)));
}

/* ------------------- 2. Draw/Arrow/Bob written again from the bytecode ---- */

/*
 * A direct transcription of the three private methods. Names s3..s9 follow
 * the local-variable slots in javap; each loop is the applet's own loop.
 */
function bytecodeDraw(s, w, h) {
  // Draw(), offsets 5-48: int s4 = round((double)w * (100 - 2*L) / 100 / 2)
  const s4 = Math.round(w * (100 - 2 * s.L) / 100.0 / 2.0);
  // Draw(), offsets 0-10: int s3 = size.height / 2 (Java int division)
  const s3 = Math.trunc(h / 2);

  // Draw(), offsets 50-85: fillRect(s4-20, s3-W, w-2*s4, 2*W+1)
  const rect = { x: s4 - 20, y: s3 - s.W, width: w - 2 * s4, height: 2 * s.W + 1 };

  // Arrow(g, x, y, h), offsets 0-76.
  function Arrow(x, y, hh) {
    const s5 = Math.trunc(hh / Math.abs(hh));       // hh/|hh| in Java ints
    const s6 = x;
    const s7 = y - s.W * s5;
    const s8 = s6 + s.A;
    const s9 = s7 - hh;
    const lines = [];
    for (let s10 = 0; s10 < s.B; s10++) {
      lines.push({ x1: s6 + s10, y1: s7, x2: s8 + s10, y2: s9 });
    }
    return { base: { x: s6, y: s7 }, tip: { x: s8, y: s9 }, lines };
  }

  // Bob(g, x, y), offsets 0-64.
  function Bob(x, y) {
    const s6 = y - s.W - 3;
    const s7 = y + s.W + 3;
    const lines = [];
    for (let s8 = 0; s8 < s.B; s8++) {
      lines.push({ x1: x + s8, y1: s6, x2: x + s8, y2: s7 });
    }
    return { kind: "rectangle", x, top: s6, bottom: s7, lines };
  }

  const left = s4 - 20;
  const right = w - s4 - 20;
  const center = Math.trunc(w / 2) - 20;
  // Draw(), offsets 86-116 and 202-252: the four end arrow heads.
  const groups = [
    Arrow(left, s3, s.H), Arrow(left, s3, -s.H),
    Arrow(right, s3, s.H), Arrow(right, s3, -s.H),
  ];
  // Draw(), offsets 117-202: rectangle when Bob, otherwise two arrow heads.
  const central = s.bob
    ? Bob(center, s3)
    : {
        kind: "arrowhead", x: center,
        up: Arrow(center, s3, s.H), down: Arrow(center, s3, -s.H),
      };
  return { c: s4, mid: s3, rect, left, right, center, groups, central };
}

const sameLine = (a, b) => a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;
const sameLines = (a, b) => a.length === b.length && a.every((line, i) => sameLine(line, b[i]));

function frameMatches(f, j) {
  if (f.c !== j.c || f.mid !== j.mid || f.leftX !== j.left ||
      f.rightX !== j.right || f.centerX !== j.center) return false;
  const rect = f.bar;
  if (rect.x !== j.rect.x || rect.y !== j.rect.y ||
      rect.width !== j.rect.width || rect.height !== j.rect.height) return false;
  const coreGroups = [f.arrows.leftUp, f.arrows.leftDown, f.arrows.rightUp, f.arrows.rightDown];
  for (let i = 0; i < 4; i++) {
    if (!coreGroups[i] || !sameLines(coreGroups[i].lines, j.groups[i].lines)) return false;
  }
  if (f.marker.kind !== j.central.kind || f.marker.x !== j.central.x) return false;
  if (j.central.kind === "rectangle") {
    return f.marker.top === j.central.top && f.marker.bottom === j.central.bottom &&
      sameLines(f.marker.lines, j.central.lines);
  }
  return sameLines(f.marker.up.lines, j.central.up.lines) &&
    sameLines(f.marker.down.lines, j.central.down.lines) &&
    sameLines(f.marker.lines, [...j.central.up.lines, ...j.central.down.lines]);
}

{
  const s = C.start();
  const f = C.geometry(s);
  equal("the opening bar, centre and two halves",
    [f.c, f.bar, f.centerX, f.halves],
    [150, { x: 130, y: 145, width: 200, height: 11 }, 230, { left: 100, right: 100 }]);
  check("the opening frame agrees with the bytecode at 500 x 300",
    frameMatches(f, bytecodeDraw(s, 500, 300)));
}

{
  let ok = true, n = 0;
  for (let L = 10; L <= 45; L++) {
    for (let W = 0; W <= 20; W++) {
      const s = { ...C.start(), L, W };
      if (!frameMatches(C.geometry(s), bytecodeDraw(s, 500, 300))) ok = false;
      n++;
    }
  }
  check(`all ${n} L x W settings match the bytecode bar and marker geometry`, ok);
}

{
  let ok = true, n = 0;
  for (let H = 10; H <= 110; H++) {
    for (let A = -90; A <= 90; A++) {
      const s = { ...C.start(), H, A, bob: (H + A) % 2 === 0 };
      if (!frameMatches(C.geometry(s), bytecodeDraw(s, 500, 300))) ok = false;
      n++;
    }
  }
  check(`all ${n} H x A settings match the bytecode's arrow strokes`, ok);
}

{
  let ok = true, n = 0;
  for (let B = 1; B <= 40; B++) {
    for (const bob of [true, false]) {
      const s = { ...C.start(), B, bob, L: 45, W: 20, H: 110, A: -90 };
      if (!frameMatches(C.geometry(s, 501, 301), bytecodeDraw(s, 501, 301))) ok = false;
      if (C.geometry(s).lines.length !== 4 * B + (bob ? B : 2 * B)) ok = false;
      n++;
    }
  }
  check(`all ${n} stroke-count x marker settings match, on an odd canvas too`, ok);
}

{
  const rand = rng(20261127);
  const pick = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const widths = [500, 501, 400, 320, 200, 137];
  const heights = [300, 301, 260, 180];
  let ok = true;
  for (let i = 0; i < 4000; i++) {
    const s = {
      ...C.start(),
      L: pick(10, 45), W: pick(0, 20), H: pick(10, 110),
      A: pick(-90, 90), B: pick(1, 40), bob: rand() < 0.5,
    };
    const w = widths[pick(0, widths.length - 1)];
    const h = heights[pick(0, heights.length - 1)];
    if (!frameMatches(C.geometry(s, w, h), bytecodeDraw(s, w, h))) ok = false;
  }
  check("4000 seeded joint configurations match at six canvas widths and four heights", ok);
}

/* ------------------------------------- 3. the page's claims, actually checked */

{
  let ok = true, n = 0;
  for (let w = 200; w <= 600; w += 2) {
    for (let L = 10; L <= 45; L++) {
      const f = C.geometry({ ...C.start(), L }, w, 300);
      if (f.halves.left !== f.halves.right) ok = false;
      n++;
    }
  }
  check(`the middle mark is exactly halfway on every one of ${n} even-width canvases x L settings`, ok);
}

{
  let ok = true;
  for (let L = 10; L <= 45; L++) {
    const f = C.geometry({ ...C.start(), L }, 501, 300);
    if (f.halves.right - f.halves.left !== 1) ok = false;
  }
  check("on an odd-width canvas Java's truncating division puts the mark one unit left of centre", ok);
}

{
  let ok = true, n = 0;
  for (let L = 10; L <= 45; L++) {
    for (let W = 0; W <= 20; W++) {
      for (const H of [10, 50, 110]) {
        const common = { ...C.start(), L, W, H, A: -37, B: 7 };
        const a = C.geometry({ ...common, bob: true });
        const b = C.geometry({ ...common, bob: false });
        if (JSON.stringify(a.bar) !== JSON.stringify(b.bar) ||
            a.leftX !== b.leftX || a.rightX !== b.rightX || a.centerX !== b.centerX ||
            JSON.stringify(a.halves) !== JSON.stringify(b.halves)) ok = false;
        n++;
      }
    }
  }
  check(`swapping the middle mark leaves the bar untouched in all ${n} size settings`, ok);
}

{
  let ok = true;
  for (let A = -90; A <= 90; A++) {
    for (let H = 10; H <= 110; H++) {
      const f = C.geometry({ ...C.start(), A, H });
      for (const g of [f.arrows.leftUp, f.arrows.rightUp]) {
        if (g.tip.x - g.base.x !== A || g.base.y - g.tip.y !== H ||
            g.base.y !== C.geometry({ ...C.start(), A, H }, 500, 300).mid - 5) ok = false;
      }
      for (const g of [f.arrows.leftDown, f.arrows.rightDown]) {
        if (g.tip.x - g.base.x !== A || g.tip.y - g.base.y !== H) ok = false;
      }
    }
  }
  check("the arrow tips run A units sideways and H units up or down, for every A and H", ok);
}

{
  let ok = true;
  for (let A = -90; A <= 90; A += 10) {
    const f = C.geometry({ ...C.start(), A });
    const sign = Math.sign(f.arrows.leftUp.tip.x - f.arrows.leftUp.base.x);
    if (sign !== Math.sign(A)) ok = false;
    if (A === 0 && f.arrows.leftUp.tip.x !== f.arrows.leftUp.base.x) ok = false;
  }
  check("the arrow heads point right for A > 0, left for A < 0, and straight up/down at A = 0", ok);
}

{
  const s = C.start();
  const f = C.geometry(s);
  const text = C.describe(s, f, s.probe);
  check("the status reads the equal halves to a player", text.includes("100 units from each end") && text.includes("right"));
  check("the status never announces a win or loss in this illustration",
    !/\b(win|won|lose|lost)\b/.test(text));
  check("the probe reports which half of the bar it sits over",
    C.describe(s, f, { x: 150, y: 290 }).includes("over the left half") &&
      C.describe(s, f, { x: 300, y: 290 }).includes("over the right half"));
  check("the arrow-head marker is described as such",
    C.describe({ ...s, bob: false }, C.geometry({ ...s, bob: false }), null).includes("an arrow head"));
}

done("judd-illusion");
