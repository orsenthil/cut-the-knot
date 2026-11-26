#!/usr/bin/env node
"use strict";

/*
 * Logic test for sine-cosine-derivatives/sine-cosine-derivatives-core.js.
 *
 *   node porting/check-sine-cosine-derivatives.mjs
 *
 * At every whole-degree angle the applet can show (0..359):
 * 1. The velocity arrow is perpendicular to the radius and as long as it
 *    (the page's (3)); cos^2 + sin^2 = 1 (the page's (4)).
 * 2. It is the derivative: (cos, sin) one hundredth of a degree later, minus
 *    now, over the time, matches (-sin t, cos t).
 * 3. The two right triangles are equal: the velocity's vertical arrow is as
 *    long as the cosine arrow and its horizontal arrow as long as the sine
 *    arrow; the order of the two arrows flips four times a revolution.
 * 4. The page's sign claims: sin grows exactly where cos > 0, cos grows
 *    exactly where sin < 0.
 * 5. The applet's frames: Step 2 (Slow) or 5 (Fast), wrapping at 360.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("sine-cosine-derivatives/sine-cosine-derivatives-core.js", "SineCosineDerivativesCore");
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

let perp = true, unit = true, deriv = true, equalTri = true, sinGrow = true, cosGrow = true, flips = 0, prev = null;
for (let a = 0; a < 360; a++) {
  const p = C.picture(C.start({ a }));
  const v = { x: p.T.x - p.P.x, y: p.T.y - p.P.y };
  if (!near(v.x * p.P.x + v.y * p.P.y, 0)) perp = false;
  if (!near(Math.hypot(v.x, v.y), 1) || !near(p.cos ** 2 + p.sin ** 2, 1)) unit = false;
  const h = 1e-6, t = p.t;
  if (!near((Math.cos(t + h) - Math.cos(t)) / h, v.x, 1e-5) || !near((Math.sin(t + h) - Math.sin(t)) / h, v.y, 1e-5)) deriv = false;
  const [cosArrow, sinArrow, v1, v2] = p.arrows;
  const len = (r) => Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y);
  const vert = [v1, v2].find((r) => near(r.from.x, r.to.x)), horiz = [v1, v2].find((r) => near(r.from.y, r.to.y));
  if (!vert || !horiz || !near(len(vert), len(cosArrow)) || !near(len(horiz), len(sinArrow))) equalTri = false;
  if (vert.kind !== "cos" || horiz.kind !== "sin") equalTri = false;
  if (prev !== null && prev !== p.verticalFirst) flips++;
  prev = p.verticalFirst;
  const q = C.picture(C.start({ a: a + 1 }));
  if (Math.abs(p.cos) > 0.02 && (q.sin - p.sin > 0) !== (p.cos > 0)) sinGrow = false;
  if (Math.abs(p.sin) > 0.02 && (q.cos - p.cos > 0) !== (p.sin < 0)) cosGrow = false;
}
if (prev !== C.picture(C.start({ a: 0 })).verticalFirst) flips++;
check("the velocity is perpendicular to the radius at every angle", perp);
check("it is as long as the radius, and cos² + sin² = 1", unit);
check("it is the derivative of (cos t, sin t)", deriv);
check("its vertical arrow matches the cosine arrow and its horizontal arrow the sine arrow", equalTri);
equal("the order of the two arrows flips four times a revolution", flips, 4);
check("sin grows exactly where cos > 0", sinGrow);
check("cos grows exactly where sin < 0", cosGrow);

{
  let s = C.start();
  equal("the applet starts at angle 0, Slow", `${s.a},${s.speed}`, "0,slow");
  s = C.tick(s);
  equal("Slow moves 2 degrees a frame", s.a, 2);
  s = C.tick({ ...s, speed: "fast" });
  equal("Fast moves 5", s.a, 7);
  equal("the angle wraps at 360", C.tick({ a: 358, speed: "fast" }).a, 3);
  equal("a frame every 50 ms", C.FRAME_MS, 50);
  equal("dragging to (0, 1) sets 90 degrees", C.angleOf(0, 1), 90);
  equal("angles are kept in 0..359", C.setAngle(s, -30).a, 330);
  const p = C.picture(C.start({ a: 30 }));
  check("at 30 degrees: vertical first; at 120: horizontal first", p.verticalFirst && !C.picture(C.start({ a: 120 })).verticalFirst);
  const before = JSON.stringify(s);
  C.tick(s);
  equal("a frame leaves the old position alone", JSON.stringify(s), before);
}

done("sine-cosine-derivatives");
