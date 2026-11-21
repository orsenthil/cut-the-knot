#!/usr/bin/env node
"use strict";

/*
 * Logic test for fibonacci-cheat/fibonacci-cheat-core.js.
 *
 *   node porting/check-fibonacci-cheat.mjs
 *
 * The paradox, checked by computation rather than taken on trust: the four true pieces have
 * areas 12 + 12 + 20 + 20 = 64 and tile the 8 x 8 square exactly (rasterised); the same pieces
 * in the 5 x 13 rectangle do not overlap and leave a gap of area 65 - 64 = 1 (rasterised to 1/250
 * of a cell; the gap is a thin parallelogram along the diagonal of the rectangle, about
 * 0.07 wide); the adjusted pieces the applet draws fill the rectangle exactly with area 65 and
 * no overlap; every piece is a quarter turn (triangles) or a slide (trapezoids) of its start
 * shape, adjusted by squeezing 3 to 40/13; the numbers 3, 5, 8, 13 are consecutive Fibonacci
 * numbers and 13 x 5 - 8 x 8 = 1 is Cassini's identity, whose sign alternates (checked for
 * k up to 30); and the cut slopes 3/8 and 2/5 differ.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("fibonacci-cheat/fibonacci-cheat-core.js", "FibonacciCheatCore");
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
/** Count raster points of the box inside 0, 1, 2... of the polygons. */
function raster(polys, box, step) {
  const counts = [0, 0, 0, 0, 0];
  for (let x = box[0] + step / 2; x < box[2]; x += step) for (let y = box[1] + step / 2; y < box[3]; y += step) {
    let n = 0; for (const p of polys) if (inside([x, y], p)) n++;
    counts[n]++;
  }
  return counts.map((c) => c * step * step);
}

{
  const s = C.start({});
  check("every piece starts in the square, none placed", s.pieces.every((p) => !p.placed && p.f === 0) && s.honest === false && C.result(s) === null);
  check("the areas of the true pieces: triangles 12, trapezoids 20", C.PIECES.map((p) => C.area(p.start)).join() === "12,12,20,20" && C.PIECES.map((p) => C.area(p.exact)).join() === "12,12,20,20");
  const t = C.move(s, { type: "drag", id: 2, x: 11.5, y: 2.5 });
  check("a piece dropped near its place snaps into it", t.pieces[2].placed === true && t.pieces[2].f === 1);
  const far = C.move(s, { type: "drag", id: 2, x: 5, y: 5 });
  check("a piece dropped far from its place stays loose where it is", far.pieces[2].placed === false && far.pieces[2].at.join() === "5,5");
  check("a placed piece can be sent back, and the old position is untouched", C.move(t, { type: "unplace", id: 2 }).pieces[2].placed === false && s.pieces[2].placed === false && s.moves === 0);
  const all = [0, 1, 2, 3].reduce((st, id) => C.move(st, { type: "place", id }), s);
  check("with all four pieces placed the position is explored", all.pieces.every((p) => p.placed) && C.result(all) === "done" && C.result(t) === null);
  check("Animate's steps: 50 of them, ending with every piece placed", C.STEPS === 50 && C.move(s, { type: "toward", f: 1 }).pieces.every((p) => p.placed) && C.move(s, { type: "toward", f: 0.5 }).pieces.every((p) => !p.placed && p.f === 0.5));
  check("the honest switch changes the shape drawn in place", C.shapeOf(C.move(all, { type: "honest", value: true }), 0).join() !== C.shapeOf(all, 0).join());
  check("Reset puts everything back and keeps the switch", C.move(C.move(all, { type: "honest", value: true }), { type: "reset" }).pieces.every((p) => !p.placed) && C.move(C.move(all, { type: "honest", value: true }), { type: "reset" }).honest === true);
  check("a piece or position that does not exist is refused", C.move(s, { type: "place", id: 4 }) === null && C.move(s, { type: "drag", id: 0, x: NaN, y: 1 }) === null);
}

{
  const box = (x, y, w, h) => [x, y, x + w, y + h];
  // the square: the four start pieces tile 8 x 8
  const sq = raster(C.PIECES.map((p) => p.startW), box(0, 2.5, 8, 8), 1 / 100);
  check(`the true pieces tile the 8 x 8 square: uncovered ${sq[0].toFixed(3)}, overlap ${(sq[2] + sq[3]).toFixed(3)}, covered ${sq[1].toFixed(2)}`, sq[0] < 0.2 && sq[2] + sq[3] < 0.2 && Math.abs(sq[1] - 64) < 0.3);
  const ex = raster(C.PIECES.map((p) => p.exactW), box(9, 0, 5, 13), 1 / 250);
  check(`the true pieces in the 5 x 13 rectangle: covered ${ex[1].toFixed(2)}, gap ${ex[0].toFixed(3)} (exactly 1), overlap ${(ex[2] + ex[3]).toFixed(4)}`, Math.abs(ex[1] - 64) < 0.05 && Math.abs(ex[0] - 1) < 0.05 && ex[2] + ex[3] < 0.02);
  const adj = raster(C.PIECES.map((p) => p.adjustedW), box(9, 0, 5, 13), 1 / 250);
  check(`the adjusted pieces fill the rectangle: gap ${adj[0].toFixed(4)}, overlap ${(adj[2] + adj[3]).toFixed(4)}, area ${C.PIECES.reduce((s, p) => s + C.area(p.adjusted), 0).toFixed(6)}`, adj[0] < 0.02 && adj[2] + adj[3] < 0.02 && near(C.PIECES.reduce((s, p) => s + C.area(p.adjusted), 0), 65, 1e-9));
  const sides = (poly) => poly.map((q, j) => Math.hypot(q[0] - poly[(j + 1) % poly.length][0], q[1] - poly[(j + 1) % poly.length][1]));
  check("the sliver has area 65 - 64 = 1, and in every adjusted piece the side 3 of the true piece has become 40/13 = 3.0769", near(5 * 13 - 8 * 8, 1) && near(C.K, 40 / 13) && C.PIECES.every((p) => sides(p.exact).some((v) => near(v, 3)) && sides(p.adjusted).some((v) => near(v, C.K)) && !sides(p.adjusted).some((v) => near(v, 3))));
}

{
  // each piece: a quarter turn (triangles) or a slide (trapezoids) of its start shape, then squeezed
  const sq = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const t1 = C.PIECES[0], t2 = C.PIECES[1];
  check("triangle 1 turns a quarter turn about its middle: the turned start shape has the true final shape's sides 3, 8", near(sq(t1.exact[0], t1.exact[1]), 8) && near(sq(t1.exact[1], t1.exact[2]), 3) && near(sq(t1.start[0], t1.start[1]), 8) && near(sq(t1.start[1], t1.start[2]), 3));
  const turned = C.turn(t1.startW, C.middle(t1.startW), 1);
  const side = (p) => p.map((q, i) => sq(q, p[(i + 1) % p.length])).sort((a, b) => a - b).map((v) => +v.toFixed(6)).join();
  check("a quarter turn keeps the side lengths", side(turned) === side(t1.startW) && side(C.turn(t2.startW, C.middle(t2.startW), 1)) === side(t2.startW));
  // the final orientation of the right angle: the true final triangle is the turned start triangle (x, y) -> (-y, x), moved
  const relTurn = (id) => { const d = C.PIECES[id]; const c0 = C.middle(d.start), tt = C.turn(d.start, c0, 1); const cf = C.middle(d.exact); const mv = [cf[0] - C.middle(tt)[0], cf[1] - C.middle(tt)[1]]; return tt.map(([x, y]) => [x + mv[0], y + mv[1]]); };
  const eq = (a, b) => a.every((q, i) => near(q[0], b[i][0], 1e-9) && near(q[1], b[i][1], 1e-9));
  const sameSet = (a, b) => a.every((q) => b.some((r) => near(q[0], r[0], 1e-9) && near(q[1], r[1], 1e-9)));
  check("each true triangle is exactly its start triangle turned a quarter turn and moved", sameSet(relTurn(0), C.PIECES[0].exact) && sameSet(relTurn(1), C.PIECES[1].exact));
  const slide = (id) => { const d = C.PIECES[id]; const c0 = C.middle(d.start), cf = C.middle(d.exact); return d.start.map(([x, y]) => [x + cf[0] - c0[0], y + cf[1] - c0[1]]); };
  check("each true trapezoid is exactly its start shape slid", sameSet(slide(2), C.PIECES[2].exact) && sameSet(slide(3), C.PIECES[3].exact));
  // the middle moves in a straight line while f goes from 0 to 1
  const s = C.start({});
  const mid = (f) => C.middle(C.shapeOf(C.move(s, { type: "toward", f }), 2));
  check("while moving, a piece's middle goes in a straight line from its start to its place", near(mid(0.5)[0], (mid(0)[0] + mid(1)[0]) / 2, 1e-6) && near(mid(0.5)[1], (mid(0)[1] + mid(1)[1]) / 2, 1e-6));
}

{
  const F = [0, 1]; for (let i = 2; i <= 40; i++) F.push(F[i - 1] + F[i - 2]);
  let ok = true;
  for (let k = 2; k <= 30; k++) if (F[k + 1] * F[k - 1] - F[k] * F[k] !== (k % 2 === 0 ? 1 : -1)) ok = false;
  check("Cassini's identity F(k+1)F(k-1) - F(k)^2 = (-1)^k for k up to 30", ok);
  check("8 x 8 -> 5 x 13: the numbers 3, 5, 8, 13 are consecutive Fibonacci numbers and 13 x 5 - 8^2 = 1", [3, 5, 8, 13].every((v) => F.includes(v)) && F.indexOf(8) === F.indexOf(5) + 1 && F.indexOf(13) === F.indexOf(8) + 1 && 13 * 5 - 64 === 1);
  check("the cuts' slopes 3/8 and 2/5 differ, which is why the pieces do not fit (3/8 = 0.375, 2/5 = 0.4)", 3 / 8 !== 2 / 5 && near(Math.atan(0.4) - Math.atan(0.375), 0.021735, 1e-4));
  check("the gap's long side is the rectangle's diagonal sqrt(5^2 + 13^2) = 13.93 so its width is about 1/13.93 = 0.072", near(Math.hypot(5, 13), 13.9283882, 1e-6) && near(1 / Math.hypot(5, 13), 0.07179, 1e-4));
}

done("fibonacci-cheat");
