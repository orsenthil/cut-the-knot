#!/usr/bin/env node
"use strict";

/*
 * Logic test for two-perpendiculars/two-perpendiculars-core.js.
 *
 *   node porting/check-two-perpendiculars.mjs
 *
 * 1. The page's resolution, over thousands of random triangles drawn
 *    honestly: the circles on AB and AC meet again at K on line BC, K is
 *    the foot of the perpendicular from A, and D = E = K.
 * 2. Thales: on the honest circles, angles ADB and AKC are right.
 * 3. The cheat: the centres slide 5 px along the perpendicular bisectors of
 *    AB and AC, so the circles still pass through A, B and C but AB and AC
 *    are no longer diameters; the angles at D and E are not right, and D,
 *    E and K come apart.
 * 4. Moves: points and the whole triangle stay in the picture.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("two-perpendiculars/two-perpendiculars-core.js", "TwoPerpendicularsCore");
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

{
  let onBC = true, isFoot = true, same = true, right = true, tested = 0;
  for (let k = 0; k < 5000; k++) {
    const P = () => [20 + rnd() * 360, 20 + rnd() * 260];
    const s = C.start({ A: P(), B: P(), C: P(), cheat: false });
    const area = Math.abs((s.B[0] - s.A[0]) * (s.C[1] - s.A[1]) - (s.C[0] - s.A[0]) * (s.B[1] - s.A[1])) / 2;
    if (area < 500 || C.dist(s.A, C.foot(s)) < 5) continue;
    tested++;
    const f = C.figure(s), F = C.foot(s);
    if (!f.K) { onBC = false; continue; }
    const cross = (s.C[0] - s.B[0]) * (f.K[1] - s.B[1]) - (s.C[1] - s.B[1]) * (f.K[0] - s.B[0]);
    if (Math.abs(cross) / C.dist(s.B, s.C) > 1e-6) onBC = false;
    if (C.dist(f.K, F) > 1e-6) isFoot = false;
    if (f.D !== f.K || f.E !== f.K) same = false;
    if (C.dist(f.K, s.B) > 1 && !near(C.angle(s.A, f.K, s.B), 90, 1e-6)) right = false;
  }
  check(`honest figure, ${tested} random triangles: the second common point K lies on BC`, onBC);
  check("and K is the foot of the perpendicular from A to BC", isFoot);
  check("so D, E and K are one point: there is only one perpendicular", same);
  check("angle AKB is right (Thales), as the page says", right);
}

{
  const s = C.start(), f = C.figure(s);
  equal("the applet starts in the cheating picture, fallacy 1", `${s.cheat} ${s.fallacy}`, "true 1");
  check("cheating, the circles still pass through A", near(C.dist(s.A, f.cB), f.rB) && near(C.dist(s.A, f.cC), f.rC));
  check("and through B and C: the centres slide along the perpendicular bisectors", near(C.dist(s.B, f.cB), f.rB) && near(C.dist(s.C, f.cC), f.rC));
  const off = C.dist(f.cB, [(s.A[0] + s.B[0]) / 2, (s.A[1] + s.B[1]) / 2]);
  check(`but AB is no longer a diameter: the centre is ${off.toFixed(1)} px off, so angle ADB is ${C.angle(s.A, f.D, s.B).toFixed(1)} degrees, not 90`, near(off, C.SHIFT) && Math.abs(C.angle(s.A, f.D, s.B) - 90) > 1);
  check(`so D and E come apart (${C.dist(f.D, f.E).toFixed(1)} px) and K leaves BC`, C.dist(f.D, f.E) > 3 && C.dist(f.K, C.foot(s)) > 1);
  const h = C.figure(C.set(s, "cheat", false));
  check("switching the cheat off puts D, E, K together at the foot", C.dist(h.K, C.foot(s)) < 1e-6 && h.D === h.K);
}

{
  const s = C.start();
  const t = C.move(s, "all", 1000, -1000);
  check("dragging the triangle keeps it in the picture", [t.A, t.B, t.C].every(([x, y]) => x >= 0 && x <= C.W && y >= 0 && y <= C.H));
  check("a point lands only inside the picture, and never on another", C.move(s, "A", -50, 999).A.join() === `0,${C.H}` && C.move(s, "A", s.B[0], s.B[1]) === null);
  const before = JSON.stringify(s);
  C.move(s, "B", 10, 10);
  equal("a move leaves the old position alone", JSON.stringify(s), before);
}

done("two-perpendiculars");
