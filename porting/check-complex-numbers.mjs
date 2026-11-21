#!/usr/bin/env node
"use strict";

/*
 * Logic test for complex-numbers/complex-numbers-core.js.
 *
 *   node porting/check-complex-numbers.mjs
 *
 * Checks the applet's formulas on 10,416 pairs of numbers (all 336 whole-unit
 * points of the board for A against every eleventh of them for B): the products
 * against a second transcription of the applet's screen-pixel code, and every "worthy
 * observation" on the page: conj(conj z) = z; the sum is the parallelogram
 * vertex; the common product multiplies moduli and adds arguments; real
 * numbers keep the argument; i rotates 90 degrees; -1 reflects in the origin;
 * the real product is always real and is zero iff the vectors are
 * perpendicular; the complex product is always imaginary and is zero iff the
 * numbers are collinear with the origin. The constraints are checked on every
 * grid drag.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("complex-numbers/complex-numbers-core.js", "ComplexNumbersCore");
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));
const nearZ = (p, q) => near(p.x, q.x) && near(p.y, q.y);

// The applet's own formulas, written a second time in its screen coordinates.
const O = { x: 200, y: 150 }, S = 20;
const toScreen = (z) => ({ x: O.x + S * z.x, y: O.y - S * z.y });
const toUnits = (p) => ({ x: (p.x - O.x) / S, y: -(p.y - O.y) / S });
function commonJ(A, B) {
  const a = (A.x - O.x) / S, b = -(A.y - O.y) / S, c = (B.x - O.x) / S, d = -(B.y - O.y) / S;
  return { x: O.x + (a * c - b * d) * S, y: O.y - (a * d + c * b) * S };
}
function realJ(A, B) {
  const a = (A.x - O.x) / S, b = -(A.y - O.y) / S, c = (B.x - O.x) / S, d = -(B.y - O.y) / S;
  return { x: O.x + (a * c + b * d) * S, y: O.y };
}
function complexJ(A, B) {
  const a = (A.x - O.x) / S, b = -(A.y - O.y) / S, c = (B.x - O.x) / S, d = -(B.y - O.y) / S;
  return { x: O.x, y: O.y - (a * d - c * b) * S };
}

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  check("a new game is not over", C.result(s) === null);
  check("A opens at modulus 2, argument 60 degrees", near(C.modulus(s.a), 2) && near(C.argument(s.a), Math.PI / 3));
  check("B opens at modulus 3, argument 112.5 degrees", near(C.modulus(s.b), 3) && near(C.argument(s.b), (Math.PI * 5) / 8));
  equal("free hand, nothing shown at the start", [s.mode, s.constraint], ["none", "free"]);
  const m = C.move(s, { type: "move", which: "a", x: 4, y: -2 });
  check("a free drag puts the number under the mouse", m && m.a.x === 4 && m.a.y === -2 && C.result(m) === "done" && m.moves === 1);
  check("the old position is untouched", s.a.x !== 4 && s.moves === 0);
  const edge = C.move(s, { type: "move", which: "b", x: 99, y: -99 });
  check("a drag past the edge stops at the edge", edge.b.x === 10 && edge.b.y === -7.5);
  check("bad moves are refused", C.move(s, { type: "move", which: "c", x: 0, y: 0 }) === null && C.move(s, { type: "mode", mode: "x" }) === null && C.move(s, { type: "constraint", constraint: "x" }) === null && C.move(s, null) === null && C.move(s, { type: "move", which: "a", x: NaN, y: 0 }) === null);
  for (const mode of C.MODES) check("mode " + mode, C.move(s, { type: "mode", mode }).mode === mode);
  equal("each mode has a name and the right number of points", C.MODES.map((mode) => C.shown(C.move(s, { type: "mode", mode })).points.length), [0, 2, 1, 1, 1, 1]);
}

/* ------------------------------------- 2. every case, on a grid of positions */
{
  const pts = [];
  for (let x = -10; x <= 10; x++) for (let y = -7; y <= 8; y++) pts.push({ x: x / 1, y: y / 1 });
  let pairs = 0, bad = 0;
  // Half-unit steps keep the grid exact in binary floating point.
  const grid = [];
  for (let x = -10; x <= 10; x += 2) for (let y = -7; y <= 7; y += 2) grid.push({ x: x + 0.5, y: y - 0.5 }); // 11 x 8
  for (const z of [...grid, ...pts.filter((_, i) => i % 7 === 0)]) {
    if (!nearZ(C.conjugate(C.conjugate(z)), z)) bad++;
  }
  equal("Conj(Conj(z)) = z everywhere", bad, 0);

  bad = 0;
  for (const a of pts) for (const b of pts.filter((_, i) => i % 11 === 3)) {
    pairs++;
    const A = toScreen(a), B = toScreen(b);
    if (!nearZ(toUnits(commonJ(A, B)), C.commonProduct(a, b))) bad++;
    if (!nearZ(toUnits(realJ(A, B)), C.realProduct(a, b))) bad++;
    if (!nearZ(toUnits(complexJ(A, B)), C.complexProduct(a, b))) bad++;
    // the sum is the parallelogram vertex: A + B - O in the applet's terms
    const sum = C.add(a, b);
    if (!near(sum.x - a.x, b.x) || !near(sum.y - a.y, b.y)) bad++;
    // |zw| = |z||w|; arguments add (mod 2 pi) unless a factor is 0
    const p = C.commonProduct(a, b);
    if (!near(C.modulus(p), C.modulus(a) * C.modulus(b), 1e-9)) bad++;
    if (C.modulus(a) > 0 && C.modulus(b) > 0) {
      const d = C.argument(p) - C.argument(a) - C.argument(b);
      const k = Math.round(d / (2 * Math.PI));
      if (!near(d - 2 * Math.PI * k, 0, 1e-9)) bad++;
    }
    // the real product is always real, zero exactly when perpendicular
    const r = C.realProduct(a, b);
    if (r.y !== 0) bad++;
    if ((r.x === 0) !== (a.x * b.x + a.y * b.y === 0)) bad++;
    // the complex product is always imaginary, zero exactly when collinear with O
    const q = C.complexProduct(a, b);
    if (q.x !== 0) bad++;
    if ((q.y === 0) !== (a.x * b.y === a.y * b.x)) bad++;
    // the page's formula (z conj w - conj z w)/2 is the same up to sign
    const pg = { x: 0, y: a.y * b.x - a.x * b.y };
    if (!nearZ(pg, { x: 0, y: -q.y })) bad++;
    // the real product is the page's (z conj w + conj z w)/2
    const w = C.add(C.commonProduct(a, C.conjugate(b)), C.commonProduct(C.conjugate(a), b));
    if (!near(w.x / 2, r.x) || !near(w.y / 2, 0)) bad++;
    // the common product is commutative
    if (!nearZ(p, C.commonProduct(b, a))) bad++;
  }
  equal(`the page's observations hold on ${pairs} pairs of numbers`, bad, 0);

  // Real numbers keep the argument; i turns by 90 degrees; -1 reflects in the origin.
  bad = 0;
  for (const z of pts) {
    for (const t of [0.5, 1, 2.5, 7]) {
      const p = C.commonProduct(z, { x: t, y: 0 });
      if (!nearZ(p, { x: z.x * t, y: z.y * t })) bad++;
    }
    if (!nearZ(C.commonProduct(z, { x: 0, y: 1 }), { x: -z.y, y: z.x })) bad++; // counter-clockwise quarter turn
    if (!nearZ(C.commonProduct(z, { x: -1, y: 0 }), { x: -z.x, y: -z.y })) bad++;
  }
  equal("real factors scale, i turns 90 degrees, -1 reflects", bad, 0);

  // Fixed moduli: the product keeps one modulus, for every drag of both numbers.
  bad = 0;
  let drags = 0;
  const fixed = C.move(C.start(), { type: "constraint", constraint: "radius" });
  for (let x = -9; x <= 9; x += 2) for (let y = -6; y <= 6; y += 2) for (let u = -9; u <= 9; u += 4) for (let v = -6; v <= 6; v += 4) {
    const t = C.move(C.move(fixed, { type: "move", which: "a", x, y }), { type: "move", which: "b", x: u, y: v });
    drags++;
    if (!t) { bad++; continue; }
    if (t === null || !near(C.modulus(t.a), 2) || !near(C.modulus(t.b), 3)) {
      // the circle may be refused when the point would leave the board: then the number must not have moved
      if (!(near(C.modulus(t.a), 2) && near(C.modulus(t.b), 3))) bad++;
    }
    if (!near(C.modulus(C.commonProduct(t.a, t.b)), 6, 1e-9)) bad++;
  }
  equal(`with both moduli fixed the product stays at modulus 6 (${drags} drags)`, bad, 0);

  // Fixed angles: each number stays on its line through the origin.
  bad = 0; drags = 0;
  const ang = C.move(C.start(), { type: "constraint", constraint: "angle" });
  for (let x = -12; x <= 12; x += 3) for (let y = -9; y <= 9; y += 3) {
    for (const w of ["a", "b"]) {
      const t = C.move(ang, { type: "move", which: w, x, y });
      drags++;
      const z = t[w], base = ang[w];
      if (!near(z.x * base.y - z.y * base.x, 0, 1e-9)) bad++; // on the line
      if (Math.abs(z.x) > 10 + 1e-9 || Math.abs(z.y) > 7.5 + 1e-9) bad++; // inside the board
    }
  }
  equal(`fixed angle keeps each number on its line (${drags} drags)`, bad, 0);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // The initial points, rebuilt exactly as the applet's constructor does it (screen pixels).
  const A = { x: O.x + S * 2 * Math.cos(1.0471975511965976), y: O.y - S * 2 * Math.sin(1.0471975511965976) };
  const B = { x: O.x + S * 3 * Math.cos(1.9634954084936207), y: O.y - S * 3 * Math.sin(1.9634954084936207) };
  const s = C.start();
  check("the opening numbers match the applet's pixels", nearZ(toScreen(s.a), A) && nearZ(toScreen(s.b), B));
  check("the opening products match too", nearZ(toUnits(commonJ(A, B)), C.commonProduct(s.a, s.b)) && nearZ(toUnits(realJ(A, B)), C.realProduct(s.a, s.b)) && nearZ(toUnits(complexJ(A, B)), C.complexProduct(s.a, s.b)));
  check("the board is 20 pixels to the unit, 400 by 300", C.SCALE === 20 && C.WIDTH === 400 && C.HEIGHT === 300 && C.HALF_W === 10 && C.HALF_H === 7.5);
}

done("complex-numbers");
