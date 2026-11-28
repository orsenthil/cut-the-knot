#!/usr/bin/env node
"use strict";

/*
 * Logic test for hermann/hermann-core.js.
 *
 *   node porting/check-hermann.mjs
 *
 * The page's claim is perceptual: "There seemed to be ghostly gray blobs
 * between dark figures arranged in a matrix on a white background. If you
 * look directly at a blob, it will disappear." A test can only check the
 * pixels the applet makes: no blob is ever drawn, the figures form an N-by-N
 * matrix with (N-1)^2 crossings of free background between them, and those
 * crossings close as Part grows. HermannCanvas.Draw is transcribed a second
 * time, straight from the bytecode, and compared with the core over every
 * slider setting and many canvas sizes. The panel's two scrollbars are also
 * transcribed from their constructor arguments.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("hermann/hermann-core.js", "HermannCore");

/* ------------------------------ 1. the applet's own numbers, transcribed twice */

/** HermannPanel's `new Scrollbar(orientation, value, visible, minimum, maximum)`. */
function appletPanel() {
  return {
    n: [0, 4, 2, 2, 12],       // [HORIZONTAL, value, visible, min, max]
    part: [0, 50, 5, 0, 105],
    rectChecked: true,         // new Checkbox("Rectangles", group, true)
    ovalChecked: false,        // new Checkbox("Circles", group, false)
  };
}

/** java.awt.Scrollbar keeps its value an int inside [minimum, maximum]. */
function sliderValue(value, initial, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return initial;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** HermannCanvas.Draw, instruction by instruction, including its fix-ups. */
function appletDraw(width, height, n, part) {
  const extent = Math.min(width, height) - 20;                // slots 2/3: L - 20
  const x0 = (width - extent) / 2;                             // slot 4
  const y0 = (height - extent) / 2;                            // slot 5
  const step = (((extent * part) / 100) / n);                  // slot 6: double
  const side = Math.round(step);                               // slot 8
  const xEnd = width - 2 * x0 - step;                          // slot 9
  const yEnd = height - 2 * y0 - step;                         // slot 11
  const gapX = Math.round(xEnd / (n - 1));                     // slot 13
  const gapY = Math.round(yEnd / (n - 1));                     // slot 14
  const figures = [];
  for (let row = 0; row < n; row++) {                           // outer counter 15
    for (let col = 0; col < n; col++) {                         // inner counter 16
      figures.push({ x: x0 + row * gapX, y: y0 + col * gapY, side });
    }
  }
  return { x0, y0, step, side, gapX, gapY, figures };
}

const panel = appletPanel();
{
  const s = C.start();
  equal("constructor and panel start together", [s.n, s.part, s.shape, s.flipped],
    [panel.n[1], panel.part[1], "rect", false]);
  check("Rectangles is the checked radio and Circles is not", panel.rectChecked && !panel.ovalChecked);
}

/* --------------------------------------------------- 2. option ranges and edits */

{
  const values = [-1000, -1, 0, 1, 1.4, 1.6, 4, 7.5, 12, 13, 105, 106, 1000, NaN, undefined, "7"];
  let nOk = true;
  let partOk = true;
  for (const value of values) {
    if (C.clampInt(value, C.N_RANGE) !== sliderValue(value, 4, 2, 12)) nOk = false;
    if (C.clampInt(value, C.PART_RANGE) !== sliderValue(value, 50, 0, 105)) partOk = false;
  }
  check("N is clamped to the applet's 2..12 scrollbar for every input", nOk);
  check("Part is clamped to the applet's 0..105 scrollbar for every input", partOk);

  const s = C.start();
  const moved = C.setOption(C.setOption(s, "n", 99), "part", -3);
  check("setting options returns a new position and leaves the old one alone",
    moved.n === 12 && moved.part === 0 && s.n === 4 && s.part === 50);
  check("shape switches between the two radio choices only",
    C.setOption(s, "shape", "oval").shape === "oval" &&
    C.setOption(s, "shape", "square").shape === "rect");
  check("Switch colors is a toggle with no other effect",
    C.setOption(s, "flipped", true).flipped === true &&
    C.setOption(C.setOption(s, "flipped", true), "flipped", false).flipped === false &&
    C.setOption(s, "flipped", true).n === s.n && C.setOption(s, "flipped", true).gaze.x === s.gaze.x);
  check("an unknown option is ignored", C.setOption(s, "nonsense", 3) === s);
  check("this illustration has no win, loss or finished state",
    C.result(s) === null && C.result(C.setOption(s, "shape", "oval")) === null);
}

/* ------------------------------------- 3. the known default layout, as drawn */

{
  const g = C.layout(360, 440, C.start());
  equal("default 360x440 geometry matches the applet's arithmetic",
    [g.x0, g.y0, g.step, g.side, g.gapX, g.gapY],
    [10, 50, 42.5, 43, 99, 99]);
  equal("first and last default figures", [g.figures[0], g.figures[15]],
    [{ x: 10, y: 50, side: 43, row: 0, col: 0 },
      { x: 307, y: 347, side: 43, row: 3, col: 3 }]);
}

/* ---------------------------- 4. the core against Draw over every slider pair */

const SIZES = [
  [360, 440], [400, 300], [375, 260], [241, 193], [80, 90], [1000, 700], [21, 21], [63, 47],
];

{
  let bad = 0;
  let first = "";
  let count = 0;
  for (const [w, h] of SIZES) {
    for (let n = 2; n <= 12; n++) {
      for (let part = 0; part <= 105; part++) {
        const state = C.start({ n, part });
        const mine = C.layout(w, h, state);
        const theirs = appletDraw(w, h, n, part);
        count++;
        const drawn = mine.figures.map((f) => ({ x: f.x, y: f.y, side: f.side }));
        const a = JSON.stringify([mine.x0, mine.y0, mine.step, mine.side, mine.gapX, mine.gapY, drawn]);
        const b = JSON.stringify([theirs.x0, theirs.y0, theirs.step, theirs.side, theirs.gapX, theirs.gapY, theirs.figures]);
        if (a !== b) { bad++; if (!first) first = `${w}x${h} n=${n} part=${part}: ${a} vs ${b}`; }
      }
    }
  }
  check(`Draw's geometry matches the core in all ${count} slider/size configurations`, bad === 0, first);
}

/* --------------------------------------- 5. the matrix and its (N-1)^2 gaps */

{
  let countOk = true;
  let symmetric = true;
  let bounded = true;
  let distinctGaps = true;
  for (const [w, h] of [[360, 440], [375, 260], [80, 90], [1000, 700]]) {
    for (let n = 2; n <= 12; n++) {
      for (let part = 0; part <= 105; part++) {
        const g = C.layout(w, h, C.start({ n, part }));
        if (g.figures.length !== n * n) countOk = false;
        for (let i = 0; i < n; i++) {
          // The bytecode's outer loop varies x; the inner loop varies y.
          const acrossX = g.figures[i * n];
          const acrossY = g.figures[(n - 1 - i) * n];
          if (acrossX.x + acrossY.x !== 2 * g.x0 + (n - 1) * g.gapX) symmetric = false;
          const downX = g.figures[i];
          const downY = g.figures[n - 1 - i];
          if (downX.y + downY.y !== 2 * g.y0 + (n - 1) * g.gapY) symmetric = false;
        }
        for (const fig of g.figures) {
          if (fig.x < -1 || fig.y < -1 || fig.x + fig.side > w + 2 || fig.y + fig.side > h + 2) bounded = false;
        }
        const gaps = C.gapCenters(g);
        if (gaps.length !== (n - 1) * (n - 1)) distinctGaps = false;
        const keys = new Set(gaps.map((p) => `${p.x},${p.y}`));
        if (keys.size !== gaps.length) distinctGaps = false;
      }
    }
  }
  check("every setting gives exactly N squared figures", countOk);
  check("the matrix stays symmetric about the canvas centre", symmetric);
  check("figures stay inside the canvas (to the pixel) at every setting", bounded);
  check("there are (N-1) squared distinct gap crossings at every setting", distinctGaps);
}

/* --------------------------------- 6. the page's claim, as far as pixels go */

{
  const g = C.layout(360, 440, C.start());
  const rectGaps = C.openGaps(g, "rect");
  const ovalGaps = C.openGaps(g, "oval");
  equal("the page's default has nine open crossings, not nine painted blobs",
    [rectGaps.length, ovalGaps.length], [9, 9]);
  check("no gap crossing is covered at the default size",
    rectGaps.every((p) => !C.covered(g, "rect", p)) &&
    ovalGaps.every((p) => !C.covered(g, "oval", p)));
  check("the core only ever returns N squared drawn figures, never blob objects",
    g.figures.length === 16 && Object.keys(g.figures[0]).sort().join() === "col,row,side,x,y");
}

{
  let halfOk = true;
  let fullOk = true;
  let zeroOk = true;
  const detail = [];
  for (const [w, h] of SIZES) {
    for (let n = 2; n <= 12; n++) {
      for (let part = 0; part <= 105; part++) {
        const g = C.layout(w, h, C.start({ n, part }));
        const open = Math.min(C.openGaps(g, "rect").length, C.openGaps(g, "oval").length);
        const atDefaultCanvas = (w === 360 && h === 440) || (w === 1000 && h === 700);
        if (part === 50 && atDefaultCanvas && open !== (n - 1) * (n - 1)) {
          halfOk = false;
          if (detail.length < 2) detail.push(`part 50 ${w}x${h} n=${n}: ${open}`);
        }
        if (part === 0 && g.side !== 0) zeroOk = false;
        // A 21x21 canvas rounds every figure down to zero pixels, so only
        // sizes where figures are actually drawn can claim closed corridors.
        if (part >= 70 && Math.min(w, h) >= 47 && open !== 0) fullOk = false;
      }
    }
  }
  check("at Part=50 every crossing stays open on the applet's canvas", halfOk, detail.join("; "));
  check("at Part=0 round(step) gives invisible zero-size figures", zeroOk);
  check("from Part=70 up the crossings close whenever figures are drawn", fullOk);
}

/* ------------------------------------------ 7. the gaze and the spoken status */

{
  const state = C.start();
  const g = C.layout(360, 440, state);
  const gap = C.gapCenters(g)[4];
  check("looking straight at an open crossing finds it", C.lookedAt(g, C.setGaze(state, gap)) === 4);
  check("looking away finds no crossing", C.lookedAt(g, C.setGaze(state, { x: 180, y: 220 })) === -1);
  const peripheral = C.setGaze(state, { x: gap.x + 40, y: gap.y + 40 });
  const seen = C.nearestOpenGap(g, peripheral, 90);
  check("a crossing seen out of the corner of the eye is marked",
    seen !== null && seen.index === 4 && seen.distance > 14 && C.lookedAt(g, peripheral) === -1);
  const closed = C.layout(360, 440, C.setOption(state, "part", 75));
  const invisible = C.layout(360, 440, C.setOption(state, "part", 0));
  check("a covered crossing is not a blob, so the gaze ignores it",
    C.lookedAt(closed, C.setGaze(state, C.gapCenters(closed)[4])) === -1);
  check("zero-size figures make no blobs either",
    C.lookedAt(invisible, C.setGaze(state, C.gapCenters(invisible)[4])) === -1);
  check("gaze movement leaves every option alone", (() => {
    const next = C.setGaze(state, gap);
    return next.n === state.n && next.part === state.part && next.shape === state.shape &&
      next.flipped === state.flipped;
  })());
  check("the status line names the matrix and the open crossings",
    C.describe(g, state) === "4 × 4 rectangles at 50% size; 9 open gaps between them.");
  check("the status line names circles when that radio is chosen",
    C.describe(g, C.setOption(state, "shape", "oval")).includes("4 × 4 circles"));
}

done("hermann");
