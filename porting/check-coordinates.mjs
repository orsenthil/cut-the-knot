#!/usr/bin/env node
"use strict";

/*
 * Logic test for coordinates/coordinates-core.js.
 *
 *   node porting/check-coordinates.mjs
 *
 * Checks: every lattice point of the opening board and of a changed board
 * reads back as itself and as its own pixel; every pixel of the 360 x 360
 * board reads the nearest lattice point (against a brute-force search); the
 * pair and complex readings for every point from -20 to 20 against a second,
 * literal transcription of the applet's string building; the page's
 * distance formulas (2) and (1') agree for all pairs in a grid, and the
 * complex modulus |z1 - z2| equals the distance; the origin and unit drags,
 * with their limits.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("coordinates/coordinates-core.js", "CoordinatesCore");

// The applet's ShowComplex, a second time, as the bytecode builds the StringBuffer.
function showComplexJ(x, y) {
  const b = [];
  if (x !== 0) b.push(String(x));
  if (y !== 0) {
    if (y > 0) { b.push(" +"); if (y !== 1) b.push(String(y)); }
    else { b.push(" -"); if (y !== -1) b.push(String(-y)); }
    b.push("i");
  } else if (x === 0) b.push("0");
  return b.join("");
}
const javaRound = (v) => Math.floor(v + 0.5);

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  check("a new game is not over", C.result(s) === null);
  equal("opens with the origin at (180,180) and 40 pixels to the unit", [s.ox, s.oy, s.unit], [180, 180, 40]);
  equal("pair reading at the origin", C.reading(s, 180, 180), "(0,0)");
  equal("pair reading nearby", C.reading(s, 230, 100), "(1,2)");
  equal("complex reading nearby", C.reading(C.move(s, { type: "format", value: "complex" }), 230, 100), "1 +2i");
  const d = C.move(s, { type: "origin", x: 100, y: 120 });
  equal("dragging the origin moves it", [d.ox, d.oy], [100, 120]);
  check("a move marks the demo explored", C.result(d) === "done" && d.moves === 1);
  check("the old position is untouched", s.ox === 180 && s.moves === 0);
  equal("the origin stays on the board", [C.move(s, { type: "origin", x: -50, y: 999 }).ox, C.move(s, { type: "origin", x: -50, y: 999 }).oy], [0, 360]);
  const u = C.move(s, { type: "unit", x: 280 });
  equal("dragging the unit handle sets the unit to its distance from the origin", u.unit, 100);
  equal("and works on the left of the origin too", C.move(s, { type: "unit", x: 100 }).unit, 80);
  check("a unit shorter than 10 pixels is refused", C.move(s, { type: "unit", x: 185 }) === null && C.move(s, { type: "unit", x: 189 }) === null);
  equal("exactly 10 pixels is allowed", C.move(s, { type: "unit", x: 190 }).unit, 10);
  check("bad moves are refused", C.move(s, null) === null && C.move(s, { type: "grid", value: 1 }) === null && C.move(s, { type: "format", value: "x" }) === null && C.move(s, { type: "origin", x: NaN, y: 1 }) === null && C.move(s, { type: "nope" }) === null);
  const r = C.move(C.move(s, { type: "origin", x: 10, y: 10 }), { type: "reset" });
  equal("reset restores the opening origin and unit", [r.ox, r.oy, r.unit], [180, 180, 40]);
  check("reset starts a fresh look", C.result(r) === null && r.moves === 0);
  equal("reset keeps the ticked boxes", C.move(C.move(s, { type: "grid", value: true }), { type: "reset" }).grid, true);
  equal("complex form of the corner cases", [[0, 0], [3, 0], [0, 1], [0, -1], [2, 1], [2, -1], [-4, 5], [-4, -5], [0, 7]].map(([x, y]) => C.complexText({ x, y })), ["0", "3", " +i", " -i", "2 +i", "2 -i", "-4 +5i", "-4 -5i", " +7i"]);
}

/* ------------------------------------------------- 2. every case, where small */
{
  // Every lattice point of two boards reads back as itself.
  let bad = 0, n = 0;
  for (const s of [C.start(), C.start({ ox: 77, oy: 301, unit: 23 }), C.start({ ox: 0, oy: 0, unit: 10 })]) {
    for (let x = -40; x <= 40; x++) for (let y = -40; y <= 40; y++) {
      n++;
      const p = C.pixelOf(s, x, y);
      const q = C.modelCoordinates(s, p.x, p.y);
      if (q.x !== x || q.y !== y) bad++;
    }
  }
  equal(`lattice points read back as themselves (${n})`, bad, 0);

  // Every pixel reads the nearest lattice point (brute force, ties rounding half up).
  bad = 0; n = 0;
  const s = C.start({ ox: 123, oy: 211, unit: 37 });
  const r = C.latticeRange(s);
  for (let px = 0; px <= 360; px += 3) for (let py = 0; py <= 360; py += 3) {
    n++;
    const q = C.modelCoordinates(s, px, py);
    // nearest in each axis, by search over a wide range
    let bx = null, by = null;
    for (let x = -30; x <= 30; x++) { const dd = Math.abs(px - (s.ox + x * s.unit)); if (bx === null || dd < bx.d - 1e-12 || (Math.abs(dd - bx.d) < 1e-12 && x > bx.x)) bx = { x, d: dd }; }
    for (let y = -30; y <= 30; y++) { const dd = Math.abs(py - (s.oy - y * s.unit)); if (by === null || dd < by.d - 1e-12 || (Math.abs(dd - by.d) < 1e-12 && y > by.y)) by = { y, d: dd }; }
    if (q.x !== bx.x || q.y !== by.y) bad++;
  }
  equal(`every sampled pixel reads its nearest lattice point (${n})`, bad, 0);
  check("the lattice range covers the board", r.xmin <= -3 && r.xmax >= 6 && r.ymin <= -4 && r.ymax >= 5);

  // The Java Math.round rule on exact halves.
  equal("halves round up as in Java", [C.modelCoordinates(C.start(), 180 + 20, 180).x, C.modelCoordinates(C.start(), 180 - 20, 180).x], [javaRound(0.5), javaRound(-0.5)]);

  // The string forms for every lattice point -20..20.
  bad = 0; n = 0;
  for (let x = -20; x <= 20; x++) for (let y = -20; y <= 20; y++) {
    n++;
    if (C.complexText({ x, y }) !== showComplexJ(x, y)) bad++;
    if (C.pairText({ x, y }) !== "(" + x + "," + y + ")") bad++;
  }
  equal(`complex and pair forms match the applet's string building (${n})`, bad, 0);

  // The page's distance claims: (2) and the complex modulus (1') agree, and the unit scales them.
  bad = 0; n = 0;
  for (let x1 = -6; x1 <= 6; x1++) for (let y1 = -6; y1 <= 6; y1++) for (let x2 = -6; x2 <= 6; x2 += 2) for (let y2 = -6; y2 <= 6; y2 += 2) {
    n++;
    const d2 = C.distance({ x: x1, y: y1 }, { x: x2, y: y2 });
    const dx = x1 - x2, dy = y1 - y2;
    if (Math.abs(d2 - Math.hypot(dx, dy)) > 1e-12) bad++; // (2) = |z1 - z2| with z = x + yi
    if (Math.abs(C.distance({ x: dx, y: dy }, { x: 0, y: 0 }) - Math.sqrt(dx * dx + dy * dy)) > 1e-12) bad++; // (1)
    // pixel distance is unit times the model distance
    const s2 = C.start({ unit: 25 });
    const a = C.pixelOf(s2, x1, y1), b = C.pixelOf(s2, x2, y2);
    if (Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 25 * d2) > 1e-9) bad++;
  }
  equal(`distance formulas (1), (1') and (2) agree on ${n} pairs, and pixels scale by the unit`, bad, 0);

  // Every origin on the board and every unit handle position gives a consistent system.
  bad = 0; n = 0;
  for (let ox = 0; ox <= 360; ox += 12) for (let oy = 0; oy <= 360; oy += 12) {
    const t = C.move(C.start(), { type: "origin", x: ox, y: oy });
    n++;
    const q = C.modelCoordinates(t, ox, oy);
    if (t.ox !== ox || t.oy !== oy || q.x !== 0 || q.y !== 0 || C.reading(t, ox, oy) !== "(0,0)") bad++;
  }
  for (let mx = 0; mx <= 360; mx++) {
    const t = C.move(C.start(), { type: "unit", x: mx });
    n++;
    if (Math.abs(mx - 180) < 10) { if (t !== null) bad++; } else if (t.unit !== Math.abs(mx - 180)) bad++;
  }
  equal(`every origin and unit drag position behaves (${n})`, bad, 0);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // ModelCoordinates and GetRealPoint(int,int), transcribed with Java's int arithmetic.
  const ox = 180, oy = 180, L = 40;
  let bad = 0, n = 0;
  for (let px = 0; px <= 360; px++) for (let py = 0; py <= 360; py += 5) {
    n++;
    const jx = javaRound((px - ox) / L), jy = javaRound((oy - py) / L);
    const q = C.modelCoordinates(C.start(), px, py);
    if (q.x !== jx || q.y !== jy) bad++;
  }
  equal(`the core reads the same pixels as the applet's ModelCoordinates (${n})`, bad, 0);
  check("the board is 360 by 360 and the unit never below 10", C.SIZE === 360 && C.MIN_UNIT === 10 && C.START_UNIT === 40);
}

done("coordinates");
