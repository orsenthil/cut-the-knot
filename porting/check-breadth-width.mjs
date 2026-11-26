#!/usr/bin/env node
"use strict";

/*
 * Logic test for breadth-width/breadth-width-core.js.
 *
 *   node porting/check-breadth-width.mjs
 *
 * Checked: the page's exact claim — "Both stacks are as tall as they are wide.
 * However our perception is affected by the apparent number of layers in the
 * stack." — for every layer count 1..20 at the applet's default canvas and at
 * thousands of other canvas sizes. The layer marks are compared, point by
 * point, with a second literal transcription of BreadthWidthCanvas.init,
 * DrawBarrelV and DrawBarrelH from the bytecode (including its int casts and
 * Math.round calls); the scrollbar's range and the probe's hit test are checked
 * as well.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("breadth-width/breadth-width-core.js", "BreadthWidthCore");

/* --------------------------------- a second transcription from the bytecode */

/* BreadthWidthCanvas.init, offsets 86-174. */
function appletInit(W, H) {
  const S1 = Math.min((W - 4 * 40) / 3, H / 1.2000000476837158 - 2 * 40);
  const S = S1 | 0; // Java's (int) cast truncates toward zero
  const X0 = ((W - 3 * S - 2 * 40) / 2) | 0;
  const Y0 = ((H - S) / 2) | 0;
  return { margin: 40, cap: 30, S: S, X0: X0, Y0: Y0, xs: [X0, X0 + 40 + S, X0 + 2 * 40 + 2 * S] };
}

/* Java's Math.round(Double.NaN) is 0; JavaScript's is NaN. */
function javaRound(x) {
  return Number.isNaN(x) ? 0 : Math.floor(x + 0.5);
}

/* DrawBarrelV, offsets 136-287: the N+1 upright lines. */
function appletLines(N, g) {
  const out = [];
  const cap = 30; // istore 4
  const d5 = ((2.0 * cap) / g.S) * ((2.0 * cap) / g.S); // dstore 5, then dmul
  const d7 = cap * cap; // dstore 7
  for (let i = 0; i <= N; i++) {
    const d10 = (g.S * Math.cos(-3.141592653589793 + (3.141592653589793 / N) * i)) / 2.0;
    const d12 = g.Y0 + javaRound(Math.sqrt(d7 - d10 * d10 * d5));
    const i14 = javaRound(d10);
    const i15 = Math.round(d12);
    // drawLine(i14 + x + S/2, i15, i14 + x + S/2, i15 + S - 2) with x = X0
    out.push({
      i: i,
      x: i14 + g.X0 + ((g.S / 2) | 0),
      y1: i15,
      y2: i15 + g.S - 2,
    });
  }
  return out;
}

/* DrawBarrelH, offsets 136-184: the N lower-half oval arcs. */
function appletArcs(N, g, x) {
  const out = [];
  const cap = 30;
  for (let i = 1; i <= N; i++) {
    // drawArc(x, Y0 + S*i/N - cap, S, 2*cap, 180, 175)
    out.push({ i: i, x: x, y: g.Y0 + ((g.S * i / N) | 0) - cap, width: g.S, height: 2 * cap, start: 180, extent: 175 });
  }
  return out;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------------------------- 1. the range and the start */

{
  const s = C.start();
  equal("the scrollbar starts at 5 layers", s.layers, 5);
  equal("the default canvas is 400 by 300", [s.width, s.height], [400, 300]);
  equal("the default layout matches init(400,300)", C.layout(s), appletInit(400, 300));
  equal("the default layout gives S = 80, X0 = 40, Y0 = 110",
    [C.layout(s).S, C.layout(s).X0, C.layout(s).Y0], [80, 40, 110]);
  check("an illustration has no win or loss", C.result(s) === null);
  check("the probe starts in the left barrel", C.stackAt(s, s.probe) === "left");
  check("setLayers returns a new position", (() => {
    const t = C.setLayers(s, 9);
    return t !== s && s.layers === 5 && t.layers === 9;
  })());
  equal("a scrollbar value below the minimum clamps to 1", C.setLayers(s, 0).layers, 1);
  equal("a scrollbar value above the maximum clamps to 20", C.setLayers(s, 99).layers, 20);
  equal("a fractional scrollbar value truncates", C.setLayers(s, 7.8).layers, 7);
  equal("a missing scrollbar value falls back to the minimum", C.setLayers(s, NaN).layers, 1);
}

/* ------------------- 2. the drawing, versus the applet's own arithmetic */

{
  let mismatches = 0;
  let compared = 0;
  const W = [240, 300, 400, 520, 800];
  const H = [180, 220, 300, 420, 600];
  for (const w of W) {
    for (const h of H) {
      const base = C.start({ width: w, height: h });
      const g = appletInit(w, h);
      if (!same(C.layout(base), g)) mismatches++;
      for (let N = 1; N <= 20; N++) {
        const s = C.setLayers(base, N);
        const coreLines = C.verticalLines(s);
        const appletLinesN = appletLines(N, g);
        const coreRight = C.horizontalArcs(s, 2);
        const appletRight = appletArcs(N, g, g.xs[2]);
        const coreMiddle = C.horizontalArcs(s, 1);
        const appletMiddle = appletArcs(1, g, g.xs[1]);
        if (!same(coreLines, appletLinesN)) mismatches++;
        if (!same(coreRight, appletRight)) mismatches++;
        if (!same(coreMiddle, appletMiddle)) mismatches++;
        compared += 3;
      }
    }
  }
  check(`every line and arc matches the bytecode (${compared} comparisons)`, mismatches === 0,
    `${mismatches} mismatches`);
  check("every comparison ran", compared === 25 * 20 * 3);

  const s = C.start();
  const g = appletInit(400, 300);
  equal("at N = 5 the applet draws 6 upright lines", C.verticalLines(s).length, 6);
  equal("at N = 5 the right barrel has 5 arcs", C.horizontalArcs(s, 2).length, 5);
  equal("the middle barrel always has one arc", C.horizontalArcs(C.setLayers(s, 20), 1).length, 1);
  check("the first upright line is on the left rim", C.verticalLines(s)[0].x === g.X0);
  check("the last upright line is on the right rim",
    C.verticalLines(s)[5].x === g.X0 + g.S);
  check("the five right-hand arcs step evenly down the barrel", (() => {
    const a = C.horizontalArcs(s, 2);
    return a.every((arc, k) => arc.y === g.Y0 + Math.trunc((g.S * (k + 1)) / 5) - g.cap);
  })());
}

/* -------------------- 3. the page's claim, over many configurations */

{
  let failures = 0;
  let configs = 0;
  for (let w = 100; w <= 820; w += 9) {
    for (let h = 90; h <= 610; h += 13) {
      for (let N = 1; N <= 20; N++) {
        const s = C.setLayers(C.start({ width: w, height: h }), N);
        const cl = C.claims(s);
        configs++;
        if (!Object.values(cl).every(Boolean)) failures++;
      }
    }
  }
  check(`"both stacks are as tall as they are wide" at all ${configs} configurations`,
    failures === 0, `${failures} failures`);

  const s = C.start();
  for (let N = 1; N <= 20; N++) {
    const t = C.setLayers(s, N);
    const L = C.measure(t, "left"), R = C.measure(t, "right"), M = C.measure(t, "middle");
    check(`N = ${N}: the two stacks and the single barrel share one S by S square`,
      L.width === L.height && L.width === R.width && R.width === R.height &&
      L.width === M.width && M.height === M.width,
      `${JSON.stringify(L)} ${JSON.stringify(R)}`);
  }
  check("the claim holds at the largest scrollbar value", Object.values(C.claims(C.setLayers(s, 20))).every(Boolean));
  check("the claim holds at the smallest scrollbar value", Object.values(C.claims(C.setLayers(s, 1))).every(Boolean));
  check("the oval caps overhang equally at the top and bottom", (() => {
    const g = C.layout(s);
    return g.cap === 30 && g.S + 2 * g.cap > g.S;
  })());
}

/* ---------------------------- 4. the draggable points and the hit test */

{
  const s = C.start();
  let bad = 0;
  for (const [w, h] of [[400, 300], [320, 240], [700, 500]]) {
    for (let N = 1; N <= 20; N++) {
      const t = C.setLayers(C.start({ width: w, height: h }), N);
      if (C.layerFromX(t, C.layerPoint(t).x) !== N) bad++;
    }
  }
  check("the layer handle round-trips all 20 values at three canvas sizes", bad === 0,
    `${bad} failures`);
  equal("the handle starts at the fifth tick", C.layerPoint(s), { x: 40 + 4 * (320 / 19), y: 258 });
  check("dragging the handle past the right end stops at 20", C.layerFromX(s, 9999) === 20);
  check("dragging the handle past the left end stops at 1", C.layerFromX(s, -9999) === 1);
  check("the probe finds the middle barrel", C.stackAt(s, { x: 160 + 40, y: 110 + 40 }) === "middle");
  check("the probe finds the right barrel", C.stackAt(s, { x: 280 + 40, y: 110 + 40 }) === "right");
  check("the probe finds nothing in a gap", C.stackAt(s, { x: 140, y: 150 }) === null);
  check("the probe finds nothing above the barrels", C.stackAt(s, { x: 80, y: 40 }) === null);
  const moved = C.moveProbe(s, { x: -50, y: 5000 });
  check("the probe stays inside the picture", moved.probe.x === 0 && moved.probe.y === 300 && s.probe.x === 80);
  check("moving the probe leaves the layers alone", C.moveProbe(s, C.layerPoint(s)).layers === 5);
  check("a probe on the ruler measures no barrel", C.stackAt(s, C.layerPoint(s)) === null);
  check("the picture keeps the claim and the probe together", (() => {
    const p = C.picture(s);
    return p.stack === "left" && p.claims.leftSquare && p.leftLines.length === 6 &&
      p.rightArcs.length === 5 && p.middleArcs.length === 1 && p.handle.y === 258;
  })());
}

done("breadth-width");
