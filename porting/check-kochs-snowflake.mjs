#!/usr/bin/env node
"use strict";

/*
 * Logic test for kochs-snowflake/kochs-snowflake-core.js.
 *
 *   node porting/check-kochs-snowflake.mjs
 *
 * The rules (N from 1 to 8, the start is the triangle), the points compared with a
 * second transcription of the applet's CollectPoints, then the page's claims,
 * measured on the actual points for N = 1..8: 3 * 4^(N-1) segments, each 1/3^(N-1)
 * of a side, so 4/3 times longer each step (the page's 3, 4, 16/3, ...); the total
 * length 3 (4/3)^(N-1) grows without bound (beyond what the screen can show it is
 * exact arithmetic: it passes any bound); the curve stays in a bounded region (all
 * points inside the circle of radius 1.0 around the centre, which holds the corners
 * of the first hexagram); the tents point outward, so each curve has more area than the
 * last, and the area is 8/5 - (3/5)(4/9)^(N-1) times the triangle's, tending to 8/5.
 * It also checks that the curve never crosses itself (no two segments meet except
 * at neighbouring corners) for N <= 5.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("kochs-snowflake/kochs-snowflake-core.js", "KochCore");
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

/* ------------------------------------------------------------ 1. the rules */
{
  equal("starts at N = 1, the triangle", C.start(), { n: 1 });
  equal("N is kept in 1..8", [C.setN(C.start(), 0).n, C.setN(C.start(), 5).n, C.setN(C.start(), 99).n, C.setN(C.start(), 3.4).n, C.setN(C.start(), "x")], [1, 5, 8, 3, null]);
  const t = C.triangle();
  check("the triangle has its apex at the top and corners at 120 degrees, radius 1", near(t[0].x, 0, 1e-12) && near(t[0].y, 1) && near(t[1].x, -Math.sqrt(3) / 2) && near(t[1].y, -0.5) && near(t[2].x, Math.sqrt(3) / 2) && near(t[2].y, -0.5));
  equal("N = 1 is the three corners", C.points(1).length, 3);
  check("its side is sqrt 3 (radius 1)", near(Math.hypot(t[1].x - t[0].x, t[1].y - t[0].y), C.SIDE));
  equal("N = 2 has 12 points, N = 3 has 48", [C.points(2).length, C.points(3).length], [12, 48]);
  const p2 = C.points(2);
  check("the first tent is outward: the tip on the right edge is 1 away from the centre (a corner of the hexagram)", Math.max(...p2.map((p) => Math.hypot(p.x, p.y))) > 0.999);
}

/* ------------------------ 2. against a second transcription of CollectPoints */
{
  // straight from the bytecode: the five points (A, P1, P2, P3, B) with P2 = Rotate(P1, P3, 60 deg)
  function applet(out, p1, p2, n) {
    n -= 1;
    if (n === 0) { out.push(p1); return; }
    const A = p1, B = p2;
    const P = [A, { x: A.x + (B.x - A.x) / 3, y: A.y + (B.y - A.y) / 3 }, null, { x: A.x + (2 * (B.x - A.x)) / 3, y: A.y + (2 * (B.y - A.y)) / 3 }, B];
    const th = Math.PI / 3, c = Math.cos(th), s = Math.sin(th);
    const dx = P[1].x - P[3].x, dy = P[1].y - P[3].y;
    P[2] = { x: P[3].x + dx * c - dy * s, y: P[3].y + dx * s + dy * c };
    for (let i = 0; i < 4; i++) applet(out, P[i], P[i + 1], n);
  }
  let ok = true;
  for (let n = 1; n <= 8; n++) {
    const T = C.triangle(), ref = [];
    for (let i = 0; i < 3; i++) applet(ref, T[i], T[(i + 1) % 3], n);
    const mine = C.points(n);
    if (mine.length !== ref.length || mine.some((p, i) => !near(p.x, ref[i].x, 1e-12) || !near(p.y, ref[i].y, 1e-12))) ok = false;
  }
  check("the points agree with the applet's CollectPoints for N = 1..8", ok);
}

/* ------------------------------------------------ 3. the page's claims, measured */
{
  let cnt = true, len = true, perim = true, inside = true, area = true, grow = true, areaMono = true;
  let prevPerim = 0, prevArea = 0;
  for (let n = 1; n <= 8; n++) {
    const pts = C.points(n), k = n - 1;
    if (pts.length !== 3 * Math.pow(4, k) || C.segments(n) !== pts.length) cnt = false;
    // every segment is 1/3^k of the triangle's side
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; if (!near(Math.hypot(q.x - p.x, q.y - p.y), C.SIDE / Math.pow(3, k), 1e-9)) len = false; }
    const measured = C.polygonLength(pts);
    if (!near(measured, C.SIDE * C.perimeter(n), 1e-9)) perim = false;
    if (!pts.every((p) => Math.hypot(p.x, p.y) <= 1 + 1e-9)) inside = false;
    const tri = C.polygonArea(C.triangle());
    const a = C.polygonArea(pts);
    if (!near(a / tri, C.areaRatio(n), 1e-9)) area = false;
    if (n > 1 && !(measured > prevPerim && a > prevArea)) { grow = false; areaMono = false; }
    prevPerim = measured; prevArea = a;
  }
  check("3 * 4^(N-1) segments for N = 1..8", cnt);
  check("every segment is 1/3^(N-1) of the triangle's side, so each step multiplies the length of a segment by 1/3", len);
  check("the measured length of the broken line is 3 (4/3)^(N-1) sides: 3, 4, 16/3, 64/9, ...", perim);
  equal("the page's first values: 3 sides, then 12 segments of 1/3 (total 4), then 48 of 1/9 (total 16/3)", [C.perimeter(1), C.perimeter(2), C.perimeter(3), C.segments(2), C.segments(3)], [3, 4, 16 / 3, 12, 48]);
  check("every point lies inside the circle of radius 1 through the triangle's corners (bounded)", inside);
  check("the measured area is (8/5 - (3/5)(4/9)^(N-1)) times the triangle's", area);
  check("each curve is longer and encloses more than the one before", grow && areaMono);
  // the limit: the length passes every bound, the area tends to 8/5
  let n = 1;
  while (C.perimeter(n) < 1e6) n++;
  check(`the length 3 (4/3)^(N-1) passes a million sides at N = ${n}, and the area ratio is within 1e-12 of 8/5 well before that`, n < 60 && Math.abs(C.areaRatio(n) - 8 / 5) < 1e-12);
  check("the area ratio increases toward 8/5 and never reaches it", [1, 2, 3, 4, 5, 6, 7].every((k) => C.areaRatio(k + 1) > C.areaRatio(k) && C.areaRatio(k + 1) < 8 / 5));
}

/* ------------------------------------------- 4. the curve never crosses itself */
{
  function segs(pts) { return pts.map((p, i) => [p, pts[(i + 1) % pts.length]]); }
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  function properCross(s, t) {
    const [a, b] = s, [c, d] = t;
    const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
    return ((d1 > 1e-12 && d2 < -1e-12) || (d1 < -1e-12 && d2 > 1e-12)) && ((d3 > 1e-12 && d4 < -1e-12) || (d3 < -1e-12 && d4 > 1e-12));
  }
  let ok = true;
  for (let n = 1; n <= 4; n++) {
    const S = segs(C.points(n));
    for (let i = 0; i < S.length && ok; i++) for (let j = i + 1; j < S.length; j++) if (properCross(S[i], S[j])) { ok = false; break; }
  }
  check("no two segments cross, for N = 1..4 (every pair tried)", ok);
}

done("kochs-snowflake");
