#!/usr/bin/env node
"use strict";

/*
 * Logic test for funny-square/funny-square-core.js.
 *
 *   node porting/check-funny-square.mjs
 *
 * The exact claim on the cut-the-knot page: P and Q lie on AR with AP = QR;
 * perpendiculars PD = PR, QB = QR and RC = PQ make ABCD a square. The page
 * adds that the proof assumes P and Q lie between A and R, but they need not.
 * Both are tested over thousands of configurations, including swapped A/R,
 * P or Q outside AR, and degenerate-looking placements.
 *
 * There is also a second, literal transcription of the applet's own Compute()
 * and init() straight from FunnySquareCanvas.class. It agrees with the core
 * when A.x = 0, but the bytecode uses Q.x = R.x - P.x - A.x instead of the
 * page's AP = QR, so at other x offsets it does not draw a square. That
 * deviation is reported in the maths section and checked here explicitly.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("funny-square/funny-square-core.js", "FunnySquareCore");

const near = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol;
const len = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
const dot = (v, p, q) =>
  (p.x - v.x) * (q.x - v.x) + (p.y - v.y) * (q.y - v.y);

/* ------ a second transcription of init(), using the bytecode's integer maths */
function appletInit(width, height) {
  const x4 = Math.floor(width / 4);
  const y10 = Math.floor(height / 10);
  const Rp = { x: width - x4, y: Math.floor(height / 2) + y10 };
  const Ap = { x: x4, y: Rp.y };
  const P = { x: Ap.x + (Rp.x - Ap.x) / 3, y: Ap.y };
  return { Ap: Ap, P: P, Rp: Rp };
}

/* ---- a second transcription of Compute(), straight from the bytecode:
 * A = Ap, R = Rp if Ap.x < Rp.x, else swapped;
 * Q = (R.x - P.x - A.x, P.y);
 * D = (P.x, P.y - (Q.x - A.x));
 * B = (Q.x, Q.y + (R.x - Q.x));
 * C = (R.x, R.y - (Q.x - P.x));
 * T = (R.x, B.y).
 */
function appletCompute(Ap, P, Rp) {
  const A = Ap.x < Rp.x ? Ap : Rp;
  const R = Ap.x < Rp.x ? Rp : Ap;
  const Q = { x: R.x - P.x - A.x, y: P.y };
  const D = { x: P.x, y: P.y - (Q.x - A.x) };
  const B = { x: Q.x, y: Q.y + (R.x - Q.x) };
  const Cc = { x: R.x, y: R.y - (Q.x - P.x) };
  const T = { x: R.x, y: B.y };
  return { A: A, R: R, P: P, Q: Q, D: D, B: B, C: Cc, T: T };
}

function figureFrom(a, p, r) {
  return C.compute({ width: 480, height: 440, a: a, p: p, r: r,
    showNames: true, hint: false, construction: false });
}

function isSquare(f, tol = 1e-7) {
  const sides = [len(f.A, f.B), len(f.B, f.C), len(f.C, f.D), len(f.D, f.A)];
  const corners = [dot(f.A, f.B, f.D), dot(f.B, f.A, f.C),
    dot(f.C, f.B, f.D), dot(f.D, f.C, f.A)];
  const parallel = near(f.B.x - f.A.x, f.C.x - f.D.x, tol) &&
    near(f.B.y - f.A.y, f.C.y - f.D.y, tol) &&
    near(f.D.x - f.A.x, f.C.x - f.B.x, tol) &&
    near(f.D.y - f.A.y, f.C.y - f.B.y, tol);
  return parallel && corners.every((v) => near(v, 0, tol)) &&
    sides.every((s) => near(s, sides[0], tol) && s > 0);
}

/* A grid that includes A and R in either order, P and Q on the segment and
 * outside it, and several base-line heights. */
const configs = [];
for (const ax of [0, 30, 120, 200]) {
  for (const gap of [-240, -80, -10, 10, 40, 80, 160, 240]) {
    for (const u of [-60, -20, 10, 40, 80, 130, 300]) {
      for (const y of [20, 264, 420]) {
        configs.push({ ax: ax, gap: gap, u: u, px: ax + u, rx: ax + gap, y: y });
      }
    }
  }
}

/* ------------------------------------------------------- 1. the starting board */
{
  equal("board constants", [C.WIDTH, C.HEIGHT, C.PAD], [480, 440, 16]);
  for (const [w, h] of [[480, 440], [600, 550], [400, 300], [801, 601]]) {
    const s = C.start({ width: w, height: h });
    const a = appletInit(w, h);
    check(`init matches the bytecode at ${w}x${h}`,
      near(s.a.x, a.Ap.x) && near(s.a.y, a.Ap.y) &&
      near(s.p.x, a.P.x) && near(s.p.y, a.P.y) &&
      near(s.r.x, a.Rp.x) && near(s.r.y, a.Rp.y));
  }
  const s = C.start({});
  check("the default diagram has the applet's name setting", s.showNames === true);
  check("the other two checkboxes start off", s.hint === false && s.construction === false);
  const again = C.start({});
  check("start depends only on its options", JSON.stringify(s) === JSON.stringify(again));
  check("start has AP = AR/3", near(s.p.x - s.a.x, (s.r.x - s.a.x) / 3));
}

/* --------------------------------------------------- 2. the exact page claim */
{
  let apQR = 0, pdPR = 0, qbQR = 0, rcPQ = 0, squares = 0, corners = 0;
  let outside = 0, outsideSquares = 0, swapped = 0, swappedSquares = 0;
  let triangles = 0, between = 0, hintLine = 0, alwaysHint = 0;
  for (const cfg of configs) {
    const a = { x: cfg.ax, y: cfg.y };
    const p = { x: cfg.px, y: cfg.y };
    const r = { x: cfg.rx, y: cfg.y };
    const f = figureFrom(a, p, r);
    const m = C.metrics(f);
    if (near(m.AP, m.QR)) apQR++;
    if (near(m.PD, m.PR)) pdPR++;
    if (near(m.QB, m.QR)) qbQR++;
    if (near(m.RC, m.PQ)) rcPQ++;
    if (isSquare(f)) squares++;
    if (m.corners.every((v) => near(v, 0))) corners++;
    if (near(len(f.A, f.B), len(f.A, f.D)) &&
        near(len(f.C, f.B), len(f.C, f.D))) triangles++;
    // T is on the extension of RC with BT parallel to AR. The page's sum
    // CT = RC + RT assumes P and Q lie between A and R.
    if (near(f.T.x, f.R.x) && near(f.T.y, f.B.y) &&
        near(m.CT, m.PD) && near(m.BT, m.AP)) alwaysHint++;
    const left = Math.min(cfg.ax, cfg.rx), right = Math.max(cfg.ax, cfg.rx);
    if (cfg.px > left && cfg.px < right && m.AP <= m.PR) {
      between++;
      if (near(m.CT, m.RC + m.RT)) hintLine++;
    }
    // The page says the proof needs adjusting when P or Q fall outside AR;
    // the construction is still required to give a square there.
    if (cfg.px <= left || cfg.px >= right) {
      outside++;
      if (isSquare(f)) outsideSquares++;
    }
    if (cfg.gap < 0) {
      swapped++;
      if (isSquare(f)) swappedSquares++;
    }
  }
  const total = configs.length;
  check(`AP = QR in all ${total} configurations`, apQR === total);
  check(`PD = PR in all ${total} configurations`, pdPR === total);
  check(`QB = QR in all ${total} configurations`, qbQR === total);
  check(`RC = PQ in all ${total} configurations`, rcPQ === total);
  check(`ABCD is a square in all ${total} configurations`, squares === total);
  check(`all four corners are right angles in all ${total} configurations`, corners === total);
  check("triangles APD and AQB give AD = AB and CD = CB", triangles === total);
  check("T completes the hint triangle BTC in all configurations", alwaysHint === total);
  check(`CT = RC + RT when P and Q lie between A and R (${between} cases)`,
    between > 0 && hintLine === between);
  check(`the square survives P and Q outside AR (${outside} cases)`,
    outside > 0 && outsideSquares === outside);
  check("the square survives A and R in the opposite order",
    swapped > 0 && swappedSquares === swapped);
}

/* ------------------------ 3. against the applet's own method, over its origin */
{
  let same = 0, origin = 0;
  for (const cfg of configs) {
    const a = { x: cfg.ax, y: cfg.y };
    const p = { x: cfg.px, y: cfg.y };
    const r = { x: cfg.rx, y: cfg.y };
    const bytecode = appletCompute(a, p, r);
    const ported = figureFrom(a, p, r);
    for (const key of ["A", "R", "P", "Q", "D", "B", "C", "T"]) {
      if (near(bytecode[key].x, ported[key].x) && near(bytecode[key].y, ported[key].y)) same++;
    }
    if (Math.min(cfg.ax, cfg.rx) === 0) {
      origin++;
      check(`bytecode and port agree at A.x = 0 (gap ${cfg.gap}, u ${cfg.u}, y ${cfg.y})`,
        ["A", "R", "P", "Q", "D", "B", "C", "T"].every((key) =>
          near(bytecode[key].x, ported[key].x) && near(bytecode[key].y, ported[key].y)));
    }
  }
  check("every other point also agrees wherever the applet's A is not at 0 only in Q's x",
    configs.every((cfg) => {
      const a = { x: cfg.ax, y: cfg.y };
      const p = { x: cfg.px, y: cfg.y };
      const r = { x: cfg.rx, y: cfg.y };
      const b = appletCompute(a, p, r).Q.x;
      const c = figureFrom(a, p, r).Q.x;
      return near(c - b, 2 * Math.min(cfg.ax, cfg.rx));
    }));
  check("the old bytecode is reproduced exactly, not silently 'fixed'", same > 0);
  check("the origin cases were actually exercised", origin > 0);

  const s = C.start({});
  const oldFigure = appletCompute(s.a, s.p, s.r);
  check("the bytecode fails its own page's claim on the default diagram",
    !isSquare(oldFigure) && isSquare(C.compute(s)));
}

/* --------------------------------------------------- 4. moving the three dots */
{
  const s = C.start({});
  check("all three handles are offered", JSON.stringify(C.legalMoves()) ===
    JSON.stringify(["a", "p", "r"]));
  check("an unknown handle is refused", C.move(s, { handle: "Q", x: 1, y: 1 }) === null);
  check("a non-numeric position is refused", C.move(s, { handle: "p", x: NaN, y: 1 }) === null);
  let synced = 0, pure = 0, clamped = 0, keptOtherX = 0;
  for (const handle of C.legalMoves()) {
    for (const [x, y] of [[100, 300], [0, -5], [9999, 9999], [s.r.x, 100]]) {
      const before = JSON.stringify(s);
      const next = C.move(s, { handle: handle, x: x, y: y });
      const yy = next[handle].y;
      if (next.a.y === yy && next.p.y === yy && next.r.y === yy) synced++;
      if (JSON.stringify(s) === before) pure++;
      if ([next.a, next.p, next.r].every((p) =>
        p.x >= C.PAD && p.x <= C.WIDTH - C.PAD &&
        p.y >= C.PAD && p.y <= C.HEIGHT - C.PAD)) clamped++;
      const others = C.legalMoves().filter((h) => h !== handle);
      if (others.every((h) => near(next[h].x, s[h].x))) keptOtherX++;
    }
  }
  check("every drag moves the whole base line to the new height", synced === 12);
  check("move never changes the position it was given", pure === 12);
  check("every drag stays on the board", clamped === 12);
  check("a drag never changes the other dots' x values", keptOtherX === 12);
}

/* ------------------------------------------- 5. the checkboxes and the record */
{
  const s = C.start({});
  let toggles = 0, geometry = 0, roundTrip = 0;
  for (const key of ["showNames", "hint", "construction"]) {
    const t = C.toggle(s, key);
    const back = C.toggle(t, key);
    if (t[key] === !s[key] && back[key] === s[key]) toggles++;
    if (JSON.stringify(C.compute(t)) === JSON.stringify(C.compute(s))) geometry++;
    if (JSON.stringify(C.toggle(s, "unknown")) === "null") roundTrip++;
  }
  check("each checkbox flips and flips back", toggles === 3);
  check("checkboxes never change the geometry", geometry === 3);
  check("an unknown option is refused", roundTrip === 3);
  const fresh = C.reset(C.toggle(C.move(s, { handle: "p", x: 0, y: 0 }), "hint"));
  check("New diagram restores the board but keeps the checkboxes",
    near(fresh.a.x, s.a.x) && near(fresh.p.x, s.p.x) && near(fresh.r.x, s.r.x) &&
    fresh.hint === true && fresh.showNames === s.showNames);
  check("the illustration has no win or loss", C.result(s) === null &&
    C.result(C.move(s, { handle: "p", x: 1, y: 1 })) === null);
  const pos = C.position(s);
  check("the saved position is plain board-unit data",
    JSON.stringify(pos).indexOf("function") < 0 &&
    near(pos.a.x, s.a.x) && near(pos.p.x, s.p.x) && near(pos.r.x, s.r.x) &&
    pos.hint === false && pos.showNames === true);
}

done("funny-square");
