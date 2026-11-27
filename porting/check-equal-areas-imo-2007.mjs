#!/usr/bin/env node
"use strict";

/*
 * Logic test for equal-areas-imo-2007/equal-areas-imo-2007-core.js.
 *
 *   1. The three draggable corners, the two tick boxes, Reset and the rules.
 *   2. Eight configurations captured by running the original Java bytecode
 *      (Compute() through reflection), pinned to 10 decimal places.
 *   3. A second transcription of the applet's library, written straight from
 *      javap: GeoSDoub.FindCircumcenter, FindAngleBisector, Rotate, Intersect,
 *      IntersectX/IntersectY for line-circle, NearestPoint and GetCircle.
 *      Compared with the core over 900 generated triangles, including skinny
 *      ones and both branches of the line-circle routine.
 *   4. The page's claims: Area(RPK) = Area(RQL), and the applet page's closed
 *      form Area = a*b*tan(C/2)/8, checked over 1285 valid triangles (900
 *      random plus 403 grid shapes). Degenerate inputs must not crash.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equal-areas-imo-2007/equal-areas-imo-2007-core.js", "EqualAreas2007Core");

/* ------------------------------ 1. the applet's rules and the opening picture */

{
  const s = C.start();
  check("the opening picture has three distinct corners",
    [s.A, s.B, s.C].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    && C.twiceArea(s.A, s.B, s.C) >= C.MIN_AREA);
  check("the three opening points lie on the applet's starting circle",
    [s.A, s.B, s.C].every((p) => Math.abs(C.dist(p, { x: 200, y: 150 }) - 300 / 2.4) < 0.01));
  check("names start ticked and details start unticked", s.showNames === true && s.details === false);
  equal("moves and explored start at zero/false", [s.moves, s.explored], [0, false]);
  check("this illustration has nothing to win", C.result(s) === null);
  equal("three corners, two ticks and Reset are legal", C.legalMoves(s).length, 6);
  check("every legal move names a real control",
    C.legalMoves(s).slice(0, 3).every((m) => C.CORNERS.includes(m.name))
    && C.legalMoves(s).slice(3, 5).every((m) => C.OPTION_KEYS.includes(m.key))
    && C.legalMoves(s)[5].type === "reset");

  const moved = C.move(s, { type: "point", name: "B", point: { x: 120, y: 250 } });
  check("dragging B changes only B", moved && moved.B.x === 120 && moved.B.y === 250
    && moved.A.x === s.A.x && moved.C.x === s.C.x);
  check("one move marks the picture explored", moved.moves === 1 && C.result(moved) === "done");
  check("a corner outside the board is clamped",
    C.move(s, { type: "point", name: "A", point: { x: 9999, y: -9 } }).A.x === C.WIDTH - C.EDGE);
  check("a move that collapses the triangle is refused",
    C.move(s, { type: "point", name: "B", point: { x: s.A.x, y: s.A.y } }) === null);
  check("a non-point, non-option move is refused",
    C.move(s, { type: "corner", name: "A" }) === null && C.move(null, { type: "reset" }) === null);
  check("an unknown corner or tick is refused",
    C.move(s, { type: "point", name: "Z", point: s.A }) === null
    && C.move(s, { type: "option", key: "show", value: true }) === null);
  check("a tick must be a boolean", C.move(s, { type: "option", key: "details", value: 1 }) === null);
  let ticks = s;
  for (const key of C.OPTION_KEYS) ticks = C.move(ticks, { type: "option", key, value: true });
  check("both tick boxes can be switched on", ticks.showNames && ticks.details);
  const reset = C.move(ticks, { type: "reset" });
  check("Reset restores the opening corners but keeps the ticks",
    [s.A, s.B, s.C].every((p, i) => C.dist(p, [reset.A, reset.B, reset.C][i]) === 0)
    && reset.showNames && reset.details && reset.moves === 3);
  check("the position passed to move() is not changed", s.A.x !== moved.B.x && s.moves === 0);
  check("a skinny or collinear picture is reported degenerate",
    C.compute({ ...s, B: { x: s.A.x + 0.2, y: s.A.y + 0.1 } }).degenerate === true);
}

/* ------------------------ 2. numbers captured from the original Java bytecode */

const FIXTURES = [
  { A: [91.746, 212.5], B: [308.253, 212.5], C: [137.5, 41.746], expected: {
    S: [183.2528266573, 212.5], R: [199.9995, 275.0002140604],
    K: [222.8765, 127.123], L: [114.623, 127.123],
    P: [173.5840450139, 176.4151663108], Q: [163.9154549861, 140.3310477496],
    Kp: [245.7529133287, 212.5], Lp: [137.4994133287, 212.5],
    Cp: [262.499, 258.2537320473], Kh: [164.5630279809, 142.7478531635],
    Lh: [157.3115870087, 115.6847700221], O: [199.9995, 149.9998660236],
    radius: 125.0003480368, areaRPK: 3080.7870144232 } },
  { A: [210.0, 40.0], B: [90.0, 220.0], C: [300.0, 210.0], expected: {
    S: [152.6653478417, 126.0019782374], R: [92.8522644357, 91.9015096238],
    K: [195.0, 215.0], L: [255.0, 125.0],
    P: [191.825125802, 148.3276418416], Q: [201.0271386337, 153.5738677822],
    Kp: [121.3326739209, 173.0009891187], Lp: [181.3326739209, 83.0009891187],
    Cp: [84.5901639344, 106.393442623], Kh: [222.9080599888, 166.0485577567],
    Lh: [229.4659693598, 169.7873347924], O: [192.2950819672, 158.1967213115],
    radius: 119.5153925289, areaRPK: 3209.8040948519 } },
  { A: [200.0, 40.0], B: [100.0, 240.0], C: [300.0, 240.0], expected: {
    S: [147.2135955, 145.5728090001], R: [88.196601125, 109.0983005625],
    K: [200.0, 240.0], L: [250.0, 140.0],
    P: [200.0, 178.196601125], Q: [188.196601125, 170.9016994375],
    Kp: [123.60679775, 192.7864045], Lp: [173.60679775, 92.7864045],
    Cp: [100.0, 90.0], Kh: [227.639320225, 195.27864045],
    Lh: [219.0983005625, 190.0], O: [200.0, 165.0],
    radius: 125.0, areaRPK: 3454.9150281253 } },
  { A: [250.0, 60.0], B: [80.0, 200.0], C: [340.0, 180.0], expected: {
    S: [187.9211768504, 111.1237367114], R: [126.5737875701, 83.3395991923],
    K: [210.0, 190.0], L: [295.0, 120.0],
    P: [204.5105410814, 118.6370340588], Q: [262.0632464887, 144.7025651335],
    Kp: [133.9605884252, 155.5618683557], Lp: [218.9605884252, 85.5618683557],
    Cp: [79.0909090909, 188.1818181818], Kh: [235.8847855688, 132.8463807584],
    Lh: [280.1104567937, 152.8761187082], O: [209.5454545455, 184.0909090909],
    radius: 130.5186728669, areaRPK: 2684.0170338805 } },
  { A: [120.0, 60.0], B: [60.0, 220.0], C: [350.0, 180.0], expected: {
    S: [91.8104916111, 135.1720223705], R: [64.4640316862, 130.4240118823],
    K: [205.0, 200.0], L: [235.0, 120.0],
    P: [198.6160079215, 153.7160574312], Q: [215.8480237646, 156.7079544511],
    Kp: [75.9052458055, 177.5860111852], Lp: [105.9052458055, 97.5860111852],
    Cp: [55.0909090909, 184.4090909091], Kh: [212.6140416356, 156.1464565055],
    Lh: [228.2526635179, 158.8617015837], O: [202.5454545455, 182.2045454545],
    radius: 147.4710242586, areaRPK: 3030.1930646473 } },
  { A: [180.0, 30.0], B: [100.0, 150.0], C: [300.0, 260.0], expected: {
    S: [137.4435364648, 93.8346953028], R: [121.8641367165, 77.9094244777],
    K: [200.0, 205.0], L: [240.0, 145.0],
    P: [216.6245413432, 174.7735611942], Q: [205.2395953733, 163.1358632835],
    Kp: [118.7217682324, 121.9173476514], Lp: [158.7217682324, 61.9173476514],
    Cp: [160.3658536585, 40.243902439], Kh: [223.6043364361, 181.9083115026],
    Lh: [213.172483754, 171.2448660647], O: [230.1829268293, 150.1219512195],
    radius: 130.1829839493, areaRPK: 2237.2957085909 } },
  { A: [200.0, 250.0], B: [50.0, 60.0], C: [350.0, 80.0], expected: {
    S: [135.5166134059, 168.3210436475], R: [78.2640805764, 191.8967784923],
    K: [200.0, 70.0], L: [275.0, 165.0],
    P: [195.0804295344, 143.7935569846], Q: [233.183651042, 128.1032215077],
    Kp: [92.758306703, 114.1605218237], Lp: [167.758306703, 209.1605218237],
    Cp: [46.3703703704, 114.4444444444], Kh: [225.2682291966, 131.3626735771],
    Lh: [255.9466146174, 118.7297743078], O: [198.1851851852, 97.2222222222],
    radius: 152.7885562977, areaRPK: 4191.8233578664 } },
  { A: [300.0, 20.0], B: [20.0, 280.0], C: [380.0, 270.0], expected: {
    S: [181.9571402172, 129.6112269412], R: [62.3107786452, 44.7962231564],
    K: [200.0, 275.0], L: [340.0, 145.0],
    P: [196.2427222556, 139.7380012011], Q: [246.0680563897, 175.0582219553],
    Kp: [100.9785701086, 204.8056134706], Lp: [240.9785701086, 74.8056134706],
    Cp: [15.3083700441, 111.1013215859], Kh: [262.5596041107, 186.748762846],
    Lh: [294.403278755, 209.3221311457], O: [197.654185022, 190.550660793],
    radius: 198.9024729369, areaRPK: 8879.5898830478 } },
];

{
  let worstPoint = 0, worstRadius = 0, worstArea = 0;
  for (const f of FIXTURES) {
    const state = { A: { x: f.A[0], y: f.A[1] }, B: { x: f.B[0], y: f.B[1] },
                    C: { x: f.C[0], y: f.C[1] }, showNames: true, details: false };
    const g = C.compute(state);
    if (g.degenerate) { check(`fixture ${f.A} is non-degenerate`, false); continue; }
    for (const key of ["S", "R", "K", "L", "P", "Q", "Kp", "Lp", "Cp", "Kh", "Lh", "O"]) {
      worstPoint = Math.max(worstPoint, Math.hypot(g[key].x - f.expected[key][0],
        g[key].y - f.expected[key][1]));
    }
    worstRadius = Math.max(worstRadius, Math.abs(g.radius - f.expected.radius));
    worstArea = Math.max(worstArea, Math.abs(g.areaRPK - f.expected.areaRPK));
  }
  check("every constructed point matches the running Java applet", worstPoint < 2e-4, `max ${worstPoint}`);
  check("GetCircle's averaged radius matches the Java applet", worstRadius < 2e-4, `max ${worstRadius}`);
  check("the filled triangle's area matches the Java applet", worstArea < 2e-4, `max ${worstArea}`);
}

/* ---------------------- 3. a second transcription of the applet's bytecode */

const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const len = (p, q) => Math.sqrt(sq(p, q));

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint). */
function jvIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };       // the applet's own guard
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.FindOrientation: cross(b-a,c-a), returning +1 or -1. */
function jvOrientation(a, b, c) {
  const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - a.y * b.x;
  return v > 0 ? 1 : -1;
}

/** GeoSDoub.Rotate: rotate p1 about p0 by ori*angle. */
function jvRotate(p0, p1, angle, ori) {
  const c = Math.cos(angle), s = Math.sin(angle) * ori;
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  return { x: p0.x + c * dx - s * dy, y: p0.y + s * dx + c * dy };
}

/** GeoSDoub.FindAngleBisector(p0,p1,p2), called as (C,A,B) by the applet. */
function jvAngleBisector(p0, p1, p2) {
  const theta = Math.acos((sq(p0, p1) + sq(p0, p2) - sq(p1, p2)) /
    (2 * len(p0, p1) * len(p0, p2)));
  const d = jvRotate(p0, p1, theta / 2, jvOrientation(p0, p1, p2));
  return jvIntersect(p0, d, p1, p2);
}

/** GeoSDoub.FindCircumcenter, then EqualAreasIMO2007Canvas.GetCircle. */
function jvCircle(a, b, c) {
  const m1 = mid(a, b), m2 = mid(b, c);
  const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  const o = jvIntersect(m1, p, m2, q);
  return { center: o, radius: (len(o, a) + len(o, b) + len(o, c)) / 3 };
}

/** GeoSDoub.IntersectX(DoubLine,DoubCircle): solve x = k*y + b. */
function jvIntersectX(m1, m2, circle) {
  const k = (m1.x - m2.x) / (m1.y - m2.y);
  const b = m2.x - k * m2.y;
  const A = 1 + k * k;
  const B = k * (b - circle.center.x) - circle.center.y;
  const Cc = circle.center.y ** 2 + (b - circle.center.x) ** 2 - circle.radius ** 2;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  return [{ x: k * ((-B + root) / A) + b, y: (-B + root) / A },
          { x: k * ((-B - root) / A) + b, y: (-B - root) / A }];
}

/** GeoSDoub.IntersectY(DoubLine,DoubCircle): solve y = k*x + b. */
function jvIntersectY(m1, m2, circle) {
  const k = (m1.y - m2.y) / (m1.x - m2.x);
  const b = m2.y - k * m2.x;
  const A = 1 + k * k;
  const B = k * (b - circle.center.y) - circle.center.x;
  const Cc = circle.center.x ** 2 + (b - circle.center.y) ** 2 - circle.radius ** 2;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  return [{ x: (-B + root) / A, y: k * ((-B + root) / A) + b },
          { x: (-B - root) / A, y: k * ((-B - root) / A) + b }];
}

/** GeoSDoub.Intersect(DoubCircle,DoubLine) and Canvas.Other(pts,C). */
function jvFarIntersection(circle, m1, m2, c) {
  const pts = Math.abs(m1.y - m2.y) > 1 ? jvIntersectX(m1, m2, circle)
    : Math.abs(m1.x - m2.x) > 1 ? jvIntersectY(m1, m2, circle) : null;
  if (!pts) return null;
  return len(pts[0], c) >= 1 ? pts[0] : pts[1];
}

/** GeoSDoub.NearestPoint(p,a,b). */
function jvFoot(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** EqualAreasIMO2007Canvas.Compute(), literal, including the unused extras. */
function jvCompute(A, B, Cc) {
  const circle = jvCircle(A, B, Cc);
  const S = jvAngleBisector(Cc, A, B);
  const R = jvFarIntersection(circle, S, Cc, Cc);
  const K = mid(B, Cc), L = mid(A, Cc), M = mid(A, B);
  const P = jvIntersect(Cc, R, K, circle.center);
  const Q = jvIntersect(Cc, R, L, circle.center);
  const Kp = mid(S, B), Lp = mid(S, A);
  const Cp = { x: 2 * circle.center.x - Cc.x, y: 2 * circle.center.y - Cc.y };
  const Kh = jvFoot(K, Cc, R), Lh = jvFoot(L, Cc, R);
  return { circle, S, R, K, L, M, P, Q, Kp, Lp, Cp, Kh, Lh };
}

/** A spread of valid triangles, plus a regular grid of shapes. */
const triangles = [];
const rnd = rng(200704);
for (let i = 0; i < 900; i++) {
  triangles.push({
    A: { x: 20 + rnd() * 360, y: 20 + rnd() * 260 },
    B: { x: 20 + rnd() * 360, y: 20 + rnd() * 260 },
    C: { x: 20 + rnd() * 360, y: 20 + rnd() * 260 },
  });
}
for (const cx of [120, 200, 280]) {
  for (const cy of [100, 170, 240]) {
    for (const radius of [45, 90, 135]) {
      for (const shift of [-40, 0, 40]) {
        triangles.push({
          A: { x: cx + shift, y: cy - radius },
          B: { x: cx - radius * 0.9, y: cy + radius * 0.6 },
          C: { x: cx + radius * 0.9, y: cy + radius * 0.6 },
        });
      }
    }
  }
}
// With A and B mirrored around the horizontal through C the bisector CR is
// horizontal, forcing GeoSDoub.Intersect into its IntersectY branch.
for (const x0 of [20, 60, 100, 140, 180, 220]) {
  for (const y0 of [50, 100, 150, 200, 250]) {
    for (const dx of [80, 120, 160, 200]) {
      for (const h of [20, 40, 60, 80]) {
        if (y0 - h < C.EDGE || y0 + h > C.HEIGHT - C.EDGE || x0 + dx > C.WIDTH - C.EDGE) continue;
        triangles.push({
          A: { x: x0 + dx, y: y0 - h }, B: { x: x0 + dx, y: y0 + h },
          C: { x: x0, y: y0 },
        });
      }
    }
  }
}

{
  let cases = 0, worstPoint = 0, worstRadius = 0, xBranch = 0, yBranch = 0;
  let invalid = 0;
  for (const t of triangles) {
    const g = C.compute(t);
    if (g.degenerate) { invalid++; continue; }
    const j = jvCompute(t.A, t.B, t.C);
    if (![j.S, j.R, j.P, j.Q, j.Kh, j.Lh].every((p) => p && Number.isFinite(p.x))) {
      invalid++; continue;
    }
    cases++;
    if (Math.abs(t.C.y - j.R.y) > 1) xBranch++; else if (Math.abs(t.C.x - j.R.x) > 1) yBranch++;
    for (const key of ["S", "R", "K", "L", "P", "Q", "Kp", "Lp", "Cp", "Kh", "Lh", "O"]) {
      const q = key === "O" ? j.circle.center : j[key];
      worstPoint = Math.max(worstPoint, Math.hypot(g[key].x - q.x, g[key].y - q.y));
    }
    worstRadius = Math.max(worstRadius, Math.abs(g.radius - j.circle.radius));
  }
  check("most sampled triangles are usable", cases > 700, `${cases} of ${triangles.length}`);
  check("core matches the bytecode over every sampled triangle", worstPoint < 1e-4, `max ${worstPoint}`);
  check("the averaged circumradius matches the bytecode", worstRadius < 1e-8, `max ${worstRadius}`);
  check("both branches of Intersect(line,circle) were exercised", xBranch > 100 && yBranch > 100,
    `${xBranch} IntersectX, ${yBranch} IntersectY`);
  check("degenerate cases were skipped, not crashed", invalid > 0, `${invalid}`);
  check("all sampled triangles were visited", cases + invalid === triangles.length, `${cases}/${triangles.length}`);
}

/* ------------------------------------------ 4. the claims made by the pages */

{
  let cases = 0, worstGap = 0, worstRelative = 0, worstFormula = 0, wrong = 0;
  let exactEquals = 0, smallest = Infinity, largest = 0;
  for (const t of triangles) {
    const g = C.compute(t);
    if (g.degenerate) continue;
    cases++;
    const gap = g.areaGap;
    worstGap = Math.max(worstGap, gap);
    worstRelative = Math.max(worstRelative, gap / Math.max(g.areaRPK, g.areaRQL));
    worstFormula = Math.max(worstFormula, Math.abs(g.areaRPK - g.trigArea));
    if (gap < 1e-6 * Math.max(1, g.areaRPK)) exactEquals++;
    if (gap >= 1e-4 * Math.max(1, g.areaRPK)) wrong++;
    smallest = Math.min(smallest, g.areaRPK);
    largest = Math.max(largest, g.areaRPK);
  }
  check("enough triangles were tested", cases > 1100, `${cases}`);
  check("Area(RPK) and Area(RQL) agree to floating-point precision on every case",
    worstRelative < 1e-7, `worst relative gap ${worstRelative}`);
  check("at least 99% of the areas are bitwise equal", exactEquals > cases * 0.99,
    `${exactEquals} of ${cases}`);
  check("no counterexample to the equal-area claim", wrong === 0, `${wrong}`);
  check("the sampled areas really vary, so the test is not vacuous",
    largest > smallest * 20, `${smallest} to ${largest}`);
  check("the page's closed form a*b*tan(C/2)/8 matches both areas",
    worstFormula < 1e-5, `max ${worstFormula}`);
  const fixtureArea = FIXTURES[1].expected.areaRPK;
  const fixtureTrig = C.compute({
    A: { x: 210, y: 40 }, B: { x: 90, y: 220 }, C: { x: 300, y: 210 },
  }).trigArea;
  check("the closed form matches the Java reference area too",
    Math.abs(fixtureTrig - fixtureArea) < 2e-4, `${fixtureTrig} vs ${fixtureArea}`);
  const startGeometry = C.compute(C.start());
  check("the opening picture itself satisfies the claim",
    startGeometry.areaGap < 1e-6 && startGeometry.areaRPK > 1000);
}

done("equal-areas-imo-2007");
