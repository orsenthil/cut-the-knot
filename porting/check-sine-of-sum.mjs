#!/usr/bin/env node
"use strict";

/*
 * Logic test for sine-of-sum/sine-of-sum-core.js.
 *
 *   node porting/check-sine-of-sum.mjs
 *
 * For all 89 x 89 = 7,921 pairs of whole-degree angles:
 * 1. The left figure: the rhombus has four sides of length 1, a vertex on
 *    each side of the rectangle, and the angle alpha + beta; the four cut-off
 *    triangles are right triangles with hypotenuse 1 and legs cos/sin of
 *    alpha or beta; rhombus + triangles = rectangle.
 * 2. The right figure: the same four triangles (congruent: same legs) fill
 *    two corners without overlap, leaving the two rectangles
 *    sin a cos b and cos a sin b.
 * 3. Hence the page's formula: the rhombus's area sin(a + b) equals
 *    sin a cos b + cos a sin b, at every angle.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("sine-of-sum/sine-of-sum-core.js", "SineOfSumCore");
const near = (a, b, e = 1e-12) => Math.abs(a - b) < e;
const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const legs = (t) => {
  const s = [d(t[0], t[1]), d(t[1], t[2]), d(t[2], t[0])].sort((x, y) => x - y);
  return s;
};

let sides = true, onRect = true, angle = true, tris = true, fill = true, moved = true, noOverlap = true, rects = true, formula = true, n = 0;
for (let a = 1; a <= 89; a++) for (let b = 1; b <= 89; b++) {
  n++;
  const s = C.start({ alpha: a, beta: b });
  const f = C.figures(s), v = C.values(s);
  const R = f.left.rhombus, W = f.left.W, H = f.left.H;
  for (let i = 0; i < 4; i++) if (!near(d(R[i], R[(i + 1) % 4]), 1)) sides = false;
  const onSide = (p) => near(p[0], 0) || near(p[0], W) || near(p[1], 0) || near(p[1], H);
  if (!R.every(onSide)) onRect = false;
  const u = [R[0][0] - R[1][0], R[0][1] - R[1][1]], w = [R[2][0] - R[1][0], R[2][1] - R[1][1]]; // at the right vertex
  if (!near(Math.acos(u[0] * w[0] + u[1] * w[1]) * 180 / Math.PI, a + b, 1e-9)) angle = false;
  const want = { alpha: [f.sa, f.ca, 1].sort((x, y) => x - y), beta: [f.sb, f.cb, 1].sort((x, y) => x - y) };
  for (const t of f.left.triangles) if (!legs(t.pts).every((x, i) => near(x, want[t.kind][i]))) tris = false;
  if (!near(C.area(R) + f.left.triangles.reduce((t, x) => t + C.area(x.pts), 0), W * H)) fill = false;
  for (const t of f.right.triangles) if (!legs(t.pts).every((x, i) => near(x, want[t.kind][i]))) moved = false;
  const tri = f.right.triangles.reduce((t, x) => t + C.area(x.pts), 0), emp = f.right.empty.reduce((t, x) => t + C.area(x.pts), 0);
  // the four triangles fill exactly the two corner rectangles, which do not overlap the empty ones
  if (!near(tri, f.ca * f.sa + f.cb * f.sb) || !near(tri + emp, W * H)) noOverlap = false;
  if (!near(f.right.empty[0].w * f.right.empty[0].h, v.sinAcosB) || !near(f.right.empty[1].w * f.right.empty[1].h, v.cosAsinB)) rects = false;
  if (!near(v.rhombus, v.sinSum) || !near(v.sinSum, v.sinAcosB + v.cosAsinB)) formula = false;
}
check(`the rhombus has four sides of length 1 (${n} pairs of angles)`, sides);
check("each of its vertices is on a side of the rectangle", onRect);
check("its angle at the left and right vertices is alpha + beta", angle);
check("the cut-off triangles have hypotenuse 1 and legs cos, sin of alpha or beta", tris);
check("rhombus + four triangles = the rectangle", fill);
check("the rearranged triangles are the same triangles", moved);
check("they fill two corners and leave two rectangles, with nothing over", noOverlap);
check("the empty rectangles are sin a x cos b and cos a x sin b", rects);
check("so sin(a + b) = sin a cos b + cos a sin b at every angle", formula);

{
  const s = C.start();
  equal("the applet starts with sides at 72 and 45 degrees", `${s.alpha},${s.beta}`, "72,45");
  equal("angles are held to 1..89", `${C.setAngles(s, 0, 120).alpha},${C.setAngles(s, 0, 120).beta}`, "1,89");
  check("past 90 degrees the rhombus's area still is sin(a + b)", near(C.values(C.start({ alpha: 80, beta: 70 })).rhombus, Math.sin(150 * Math.PI / 180)));
  const before = JSON.stringify(s);
  C.setAngles(s, 10, 10);
  equal("setting angles leaves the old position alone", JSON.stringify(s), before);
}

done("sine-of-sum");
