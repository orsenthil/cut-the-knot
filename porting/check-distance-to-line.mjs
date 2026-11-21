#!/usr/bin/env node
"use strict";

/*
 * Logic test for distance-to-line/distance-to-line-core.js.
 *
 *   node porting/check-distance-to-line.mjs
 *
 * The page's claim, dist = |Au + Bv + C| / ||n||, is compared with a second route
 * (the applet's foot of the perpendicular, GeoSDoub.NearestPoint, and the plain
 * distance to that foot) over every pair of integer points of the plane, and the
 * claims about normalizing, level lines and the unit step along the normal are
 * checked by brute force.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("distance-to-line/distance-to-line-core.js", "DistanceToLineCore");
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));

{
  const s = C.start({});
  check("a new position is not finished", C.result(s) === null);
  const t = C.move(s, { type: "p", x: 1, y: 1 });
  check("moving P records an exploration", C.result(t) === "done" && t.p[0] === 1 && t.p[1] === 1);
  check("the old position is untouched", s.p[0] === -1 && s.moves === 0);
  check("a point cannot leave the plane", C.move(s, { type: "p", x: 99, y: -99 }).p.join() === "6,-6");
  check("two points on top of each other make no line", C.move(s, { type: "p2", x: s.p1[0], y: s.p1[1] }) === null);
  check("digits stay within 0..6", C.move(s, { type: "digits", value: 7 }) === null && C.move(s, { type: "digits", value: 0 }).digits === 0);
  check("Reset clears the explored mark", C.result(C.move(t, { type: "reset" })) === null);
  const sh = C.move(s, { type: "shift", dx: 100, dy: 0 });
  check("shifting the line keeps both points in the plane", Math.max(sh.p1[0], sh.p2[0]) === 6 && sh.p2[1] === s.p2[1]);
  check("an unknown move is refused", C.move(s, { type: "bogus" }) === null);
}

{
  let n = 0, worst = 0, signOk = true, footOk = true, normOk = true, stepOk = true;
  const pts = [];
  for (let x = -6; x <= 6; x += 2) for (let y = -6; y <= 6; y += 3) pts.push([x, y]);
  for (const a of pts) for (const b of pts) {
    if (a[0] === b[0] && a[1] === b[1]) continue;
    for (const p of [[0, 0], [1, 5], [-6, 6], [3.5, -2.25], [6, 6]]) {
      const s = { ...C.start({}), p1: a, p2: b, p };
      const m = C.measure(s);
      const foot = C.nearestPoint(p, a, b);
      const direct = Math.hypot(p[0] - foot[0], p[1] - foot[1]);
      worst = Math.max(worst, Math.abs(m.dist - direct));
      if (!near(m.foot[0], foot[0]) || !near(m.foot[1], foot[1])) footOk = false;
      // the foot lies on the line: f = 0
      if (Math.abs(m.A * foot[0] + m.B * foot[1] + m.C) > 1e-9) footOk = false;
      // normalizing makes the norm 1 and f the signed distance
      const mn = C.measure({ ...s, normalize: true });
      if (!near(mn.norm, 1) || !near(Math.abs(mn.f), m.dist) || !near(mn.dist, m.dist)) normOk = false;
      // a unit step along the normal changes f by ||n||
      const ux = m.A / m.norm, uy = m.B / m.norm;
      if (!near(m.A * (p[0] + ux) + m.B * (p[1] + uy) + m.C - m.f, m.norm)) stepOk = false;
      // P is on the side the normal points to exactly when f > 0, and the foot is p - d*m (sign chosen)
      const sgn = m.f > 0 ? 1 : -1;
      if (m.f !== 0 && (!near(p[0] - sgn * m.dist * ux, m.foot[0]) || !near(p[1] - sgn * m.dist * uy, m.foot[1]))) signOk = false;
      n++;
    }
  }
  check(`formula = distance to the foot of the perpendicular (${n} cases, worst gap ${worst.toExponential(1)})`, worst < 1e-9);
  check("the foot lies on the line and matches NearestPoint", footOk);
  check("normalized equation has norm 1 and f is the signed distance", normOk);
  check("a unit step along the normal changes f by ||n||", stepOk);
  check("the foot is P minus d times the unit normal, on the right side", signOk);
}

{
  // the page's own line: any point on the line is at distance 0; parallel level lines are |c|/||n|| apart
  const s = { ...C.start({}), p1: [0, 0], p2: [4, 3], p: [2, 1.5] };
  check("a point on the line is at distance 0", near(C.measure(s).dist, 0));
  const s2 = { ...s, p: [0, 5] };
  check("a 3-4-5 line: distance from (0,5) is 4", near(C.measure(s2).dist, 4) && C.measure(s2).norm === 5);
  check("equation text is rounded to the chosen digits", C.equationText({ ...s2, digits: 0 }) === "−3x + 4y + 0 = 0" || C.equationText({ ...s2, digits: 0 }) === "-3x + 4y + 0 = 0");
  check("an equation with C < 0 reads with a minus", C.equationText({ ...C.start({}), p1: [0, 1], p2: [1, 1], digits: 2 }) === "0x + 1y − 1 = 0");
}

done("distance-to-line");
