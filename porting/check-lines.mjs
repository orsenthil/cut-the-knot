#!/usr/bin/env node
"use strict";

/*
 * Logic test for lines/lines-core.js — Bogomolny's "Disappearing lines" applet.
 *
 *   1. A second, literal transcription of straighter.reset, DrawUpperPart,
 *      DrawLowerPart, UpdatePos and mouseTracker.drawEye from the bytecode in
 *      classes/lines.zip, compared with the core over every n (5..25) and
 *      thousands of snap positions.
 *   2. The page's claims, over the same whole range: the original diagram shows
 *      N lines, the shifted one shows N-1, and the total length of the strokes
 *      is n(n-1)s — in fact at *every* position of the upper half, not just the
 *      two shown on the page.
 *   3. The applet's option limits, snapping and "eyes open" position.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("lines/lines-core.js", "LinesCore");

/* ------------------------------------------------------------------------- *
 * A second transcription, written straight from the bytecode (javap -c -p).
 * It shares nothing with the core: its own int helpers, its own loops.
 * ------------------------------------------------------------------------- */

const asJavaInt = (d) => (Number.isNaN(d) || !Number.isFinite(d) ? 0 : Math.trunc(d));

function appletReset(n, canvasW, canvasH) {
  const mouseStep = 2;
  let s = Math.ceil(canvasW / (2 * n + 1) + 0.5);
  s = asJavaInt(s / mouseStep) * mouseStep;
  const yMargin = s;
  const side = s * (n + 1);
  const r = {
    x: asJavaInt((canvasW - side) / 2),
    y: asJavaInt((canvasH - side) / 2) + 40,
    w: side,
    h: side,
  };
  return { s, yMargin, side, rect: r, ratio: side / side, ul: { x: r.x, y: r.y } };
}

function appletDrawUpper(g, n, dx, dy) {
  const u = { x: g.rect.x + dx, y: g.rect.y + dy };
  const poly = [[u.x, u.y], [u.x + g.side, u.y], [u.x, u.y + g.side], [u.x, u.y]];
  const strokes = [];
  for (let i = 0; i < n; i++) {
    const x = u.x + (i + 1) * g.s;
    const y = u.y + asJavaInt(g.ratio * (u.x + g.side - x));
    strokes.push([x, u.y + g.yMargin, x, y]);
  }
  return { poly, strokes };
}

function appletDrawLower(g, n) {
  const r = g.rect;
  const poly = [[r.x, r.y + g.side], [r.x + g.side, r.y], [r.x + g.side, r.y + g.side], [r.x, r.y + g.side]];
  const strokes = [];
  for (let i = 0; i < n; i++) {
    const x = r.x + (i + 1) * g.s;
    const y = r.y + asJavaInt(g.ratio * (r.x + g.side - x));
    strokes.push([x, r.y + r.h - g.yMargin, x, y]);
  }
  return { poly, strokes };
}

function appletFinished(g, dx, dy) {
  return g.rect.x + dx === g.rect.x + g.s && g.rect.y + dy === g.rect.y - g.s;
}

function appletEyes(g, dx, dy) {
  const mouse = { x: g.rect.x + Math.round(g.side / 4) + dx, y: g.rect.y + Math.round(g.side / 4) + dy };
  return [[30, 20, 40, 20], [350, 40, 40, 20], [200, 10, 60, 30]].map(([x, y, w, h]) => {
    const er = Math.floor(Math.min(w, h) / 2);
    const ir = Math.floor(er / 2);
    const full = appletFinished(g, dx, dy);
    const iris = (cx, cy) => {
      const vx = mouse.x - cx;
      const vy = mouse.y - cy;
      const d = Math.sqrt(vx * vx + vy * vy);
      if (full || d === 0) return [cx, cy];
      return [cx + asJavaInt(asJavaInt(vx / d) * (er - ir)), cy + asJavaInt(asJavaInt(vy / d) * (er - ir))];
    };
    return {
      left: [x + er, y + er],
      right: [x + w - er, y + er],
      irisLeft: iris(x + er, y + er),
      irisRight: iris(x + w - er, y + er),
      full,
    };
  });
}

/* ------------------------------------------------------------ 1. the rules */

{
  equal("applet defaults: 10 notches at the starting position", C.start({}), { n: 10, dx: 0, dy: 0 });
  equal("the spinner's lower limit", C.start({ n: 1 }), { n: 5, dx: 0, dy: 0 });
  equal("the spinner's upper limit", C.start({ n: 500 }), { n: 25, dx: 0, dy: 0 });
  equal("a negative value also stops at 5", C.start({ n: -7 }), { n: 5, dx: 0, dy: 0 });
  equal("the < button stops at 5", C.stepN(C.start({ n: 5 }), -1).n, 5);
  equal("the > button stops at 25", C.stepN(C.start({ n: 25 }), 1).n, 25);
  equal("changing n snaps the piece back to the start", C.setN(C.slide(C.start({ n: 8 })), 9), { n: 9, dx: 0, dy: 0 });
  equal("mouse coordinates are snapped to steps of 2", C.nudge(C.start({}), 7, -3), { n: 10, dx: 6, dy: -2 });
  equal("negative integer division truncates toward zero", C.nudge(C.start({}), -3, -3), { n: 10, dx: -2, dy: -2 });
  const rest = C.handleRest(C.start({}));
  equal("dragging to a point converts to the snapped offset", C.dragTo(C.start({}), { x: rest.x + 21, y: rest.y - 19 }), { n: 10, dx: 20, dy: -18 });
  equal("the handle follows its saved offset", C.handlePoint({ n: 10, dx: 20, dy: -18 }), { x: rest.x + 20, y: rest.y - 18 });
}

/* --------------------------------- 2. reset / drawing against the bytecode */

let badReset = 0;
let resets = 0;
for (let n = C.MIN_N; n <= C.MAX_N; n++) {
  for (const w of [320, 360, 400, 440, 480]) {
    for (const h of [300, 350, 400, 450]) {
      resets++;
      const mine = C.geometry({ n, dx: 0, dy: 0 }, w, h);
      const theirs = appletReset(n, w, h);
      if (mine.s !== theirs.s || mine.margin !== theirs.yMargin || mine.side !== theirs.side ||
          JSON.stringify(mine.rect) !== JSON.stringify(theirs.rect) ||
          mine.ratio !== theirs.ratio || JSON.stringify(mine.ul) !== JSON.stringify(theirs.ul)) badReset++;
    }
  }
}
equal(`straighter.reset matches the bytecode in ${resets} sizes`, badReset, 0);

let badPoly = 0;
let badStrokes = 0;
let positions = 0;
for (let n = C.MIN_N; n <= C.MAX_N; n++) {
  const g = C.geometry({ n, dx: 0, dy: 0 });
  const a = appletReset(n, C.WIDTH, C.HEIGHT);
  for (let dx = -40; dx <= 40; dx += 4) {
    for (let dy = -40; dy <= 40; dy += 4) {
      positions++;
      const mine = C.geometry({ n, dx, dy });
      const poly = C.polygons(mine);
      const draw = appletDrawUpper(a, n, dx, dy);
      const low = appletDrawLower(a, n);
      const asPairs = (pts) => pts.map((p) => [p.x, p.y]);
      if (JSON.stringify(asPairs(poly.upper)) !== JSON.stringify(draw.poly) ||
          JSON.stringify(asPairs(poly.lower)) !== JSON.stringify(low.poly)) badPoly++;
      const segs = C.segments(mine);
      const got = segs.map((s) => [s.x, s.y0, s.y1]);
      const want = low.strokes.concat(draw.strokes).map((s) => [s[0], s[1], s[3]]);
      // The lower strokes are drawn first in the applet, the core lists them first too.
      if (JSON.stringify(got) !== JSON.stringify(want)) badStrokes++;
      const gotParts = segs.map((s) => s.part);
      const wantParts = low.strokes.map(() => "lower").concat(draw.strokes.map(() => "upper"));
      if (JSON.stringify(gotParts) !== JSON.stringify(wantParts)) badStrokes++;
    }
  }
}
equal(`both triangles' outlines match the bytecode in ${positions} positions`, badPoly, 0);
equal(`all 2N drawn strokes match the bytecode in ${positions} positions`, badStrokes, 0);

/* ------------------------------------- 3. the page's two claims, exhaustively */

let badStartCount = 0;
let badFinishCount = 0;
let badStartSpan = 0;
let badFinishSpan = 0;
let badLength = 0;
let badStartFinished = 0;
let badFinishFinished = 0;
for (let n = C.MIN_N; n <= C.MAX_N; n++) {
  const s0 = C.start({ n });
  const g0 = C.geometry(s0);
  const f = C.slide(s0);
  const gf = C.geometry(f);

  if (C.countLines(g0) !== n) badStartCount++;
  if (C.countLines(gf) !== n - 1) badFinishCount++;
  if (C.visibleLines(g0).some((l) => l.y0 !== g0.rect.y + g0.s || l.y1 !== g0.rect.y + n * g0.s)) badStartSpan++;
  const nonEmpty = C.visibleLines(gf).filter((l) => l.y1 > l.y0);
  if (nonEmpty.length !== n - 1 ||
      nonEmpty.some((l, i) => l.x !== gf.rect.x + (i + 2) * gf.s || l.y0 !== gf.rect.y || l.y1 !== gf.rect.y + n * gf.s)) badFinishSpan++;
  if (C.totalLength(g0) !== n * (n - 1) * g0.s || C.totalLength(gf) !== n * (n - 1) * gf.s) badLength++;
  if (C.finished(s0) || appletFinished(g0, 0, 0)) badStartFinished++;
  if (!C.finished(f) || !appletFinished(gf, gf.s, -gf.s)) badFinishFinished++;
}
equal("original diagram shows exactly N lines, for N = 5..25", badStartCount, 0);
equal("shifted diagram shows exactly N-1 lines, for N = 5..25", badFinishCount, 0);
equal("original N lines each run from y+ s to y+Ns", badStartSpan, 0);
equal("shifted N-1 lines each run from y to y+Ns", badFinishSpan, 0);
equal("total stroke length is N(N-1)s at both positions", badLength, 0);
equal("the start never has open eyes", badStartFinished, 0);
equal("the one-notch slide opens the eyes, for every N", badFinishFinished, 0);

// The stronger invariant: the sum of the strokes does not depend on where the
// upper piece is. Checked over every snapped offset in a generous window.
let badInvariant = 0;
let badFinishedFlag = 0;
let checkedPositions = 0;
for (let n = C.MIN_N; n <= C.MAX_N; n++) {
  const g = C.geometry({ n, dx: 0, dy: 0 });
  const target = n * (n - 1) * g.s;
  const limit = g.s + 8;
  for (let dx = -limit; dx <= limit; dx += C.MOUSE_STEP) {
    for (let dy = -limit; dy <= limit; dy += C.MOUSE_STEP) {
      checkedPositions++;
      const state = { n, dx, dy };
      if (C.totalLength(C.geometry(state)) !== target) badInvariant++;
      if (C.finished(state) !== appletFinished(g, dx, dy)) badFinishedFlag++;
    }
  }
}
equal(`total length is N(N-1)s at all ${checkedPositions} positions`, badInvariant, 0);
equal("the eyes-open test matches UpdatePos at every position", badFinishedFlag, 0);

// The count drops as soon as the upper strokes are one notch to the right,
// but the applet only opens the eyes at the exact up-and-right corner.
{
  const n = 10;
  const g = C.geometry(C.start({ n }));
  equal("lined up and one notch up: still 18 separate strokes", C.countLines(C.geometry({ n, dx: 0, dy: -g.s })), 2 * n - 2);
  equal("one notch right and up: 9 visible lines", C.countLines(C.geometry(C.slide(C.start({ n })))), n - 1);
  check("the eyes reward only the exact corner", !C.finished({ n, dx: g.s, dy: 0 }) && C.finished({ n, dx: g.s, dy: -g.s }));
}

/* ----------------------------------- 4. the eyes (mouseTracker.drawEye) */

let badEyes = 0;
let eyesCompared = 0;
for (const n of [C.MIN_N, C.DEFAULT_N, C.MAX_N]) {
  const g = C.geometry({ n, dx: 0, dy: 0 });
  const theirs = appletReset(n, C.WIDTH, C.HEIGHT);
  for (let dx = -24; dx <= 24; dx += 8) {
    for (let dy = -24; dy <= 24; dy += 8) {
      for (const state of [{ n, dx, dy }, C.slide({ n, dx, dy })]) {
        eyesCompared++;
        const mine = C.eyes(state);
        const want = appletEyes(theirs, state.dx, state.dy);
        const flat = (e) => [e.left.x, e.left.y, e.irisLeft.x, e.irisLeft.y,
                             e.right.x, e.right.y, e.irisRight.x, e.irisRight.y, e.full ? 1 : 0];
        const flatWant = (e) => [...e.left, ...e.irisLeft, ...e.right, ...e.irisRight, e.full ? 1 : 0];
        if (JSON.stringify(mine.map(flat)) !== JSON.stringify(want.map(flatWant))) badEyes++;
      }
    }
  }
}
equal(`the three eyes match mouseTracker in ${eyesCompared} positions`, badEyes, 0);
{
  const eyes = C.eyes(C.slide(C.start({})));
  check("all three eyes are open at the finish", eyes.every((e) => e.full));
  check("open eyes look straight ahead", eyes.every((e) => e.irisLeft.x === e.left.x && e.irisRight.y === e.right.y));
  check("closed eyes have half-closed lids (their radius is half the eye)", eyes.every((e) => e.irisR === Math.floor(e.eyeR / 2)));
}

/* ----------------------------------- 5. a few worked values, pinned by hand */

{
  const g5 = C.geometry(C.start({ n: 5 }));
  equal("n=5: s=36, a 216 square at (92,107)", [g5.s, g5.side, g5.rect.x, g5.rect.y], [36, 216, 92, 107]);
  const g10 = C.geometry(C.start({}));
  equal("n=10: s=20, a 220 square at (90,105)", [g10.s, g10.side, g10.rect.x, g10.rect.y], [20, 220, 90, 105]);
  const g25 = C.geometry(C.start({ n: 25 }));
  equal("n=25: s=8, a 208 square at (96,111)", [g25.s, g25.side, g25.rect.x, g25.rect.y], [8, 208, 96, 111]);
  equal("n=10 at the finish: offset (20,-20)", C.slide(C.start({})).dx, 20);
  equal("status reports the page's numbers", { count: C.status(C.start({})).count, finished: C.status(C.start({})).finished }, { count: 10, finished: false });
}

done("lines");
