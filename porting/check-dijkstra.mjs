#!/usr/bin/env node
"use strict";

/*
 * Logic test for dijkstra/dijkstra-core.js.
 *
 *   node porting/check-dijkstra.mjs
 *
 * The core is checked against a second, literal transcription of
 * DijkstraCanvas.Compute() and its GeoSDoub helpers over a lattice of C
 * positions plus seeded random triangles. The page's claims are then tested
 * on every non-degenerate configuration: sign(alpha+beta-gamma) against
 * sign(a²+b²-c²), against sign(pi/2-gamma), and against the sign of the
 * difference of the three areas. The area ratios are checked too - the page
 * swaps ACL/a² and BCN/b², and the test documents that plainly.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("dijkstra/dijkstra-core.js", "DijkstraCore");
const PI = Math.PI;
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const nearPt = (p, q, tol = 1e-6) =>
  near(p.x, q.x, tol) && near(p.y, q.y, tol);
const P = (x, y) => ({ x, y });

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  check("the applet puts A at (width/2 + width/4 - 5·width/8)", nearPt(s.A, P(62.5, 285)));
  check("the applet puts B one eighth-width right of centre", nearPt(s.B, P(437.5, 285)));
  check("C starts one eighth-width left and a rise higher", near(s.C.x, 281.25) && near(s.C.y, 225 - 62.5 * Math.sin(PI / 3) - 30));
  equal("the four checkboxes start unchecked", s.show, {
    areas: false, color: false, hint: false, names: false,
  });
  const m = C.measure(s);
  check("the starting triangle is the page's alpha+beta-gamma < 0 case", m.signAngles === -1);
  check("the starting pieces leave a gap", m.areaACL + m.areaBCN < m.areaABC && m.signAreas === -1);
  check("the starting position is valid", m.valid === true);
  check("clamping works at both edges of the board",
    C.withPoint(s, "C", P(-50, -50)).C.x === C.BOARD.margin &&
    C.withPoint(s, "C", P(9999, 9999)).C.y === C.BOARD.height - C.BOARD.margin);
  check("moving a vertex never mutates the old position",
    s.C.x === 281.25 && C.withPoint(s, "A", P(10, 10)).B.x === s.B.x);
  check("color cannot be switched on while areas is off", C.toggle(s, "color").show.color === false);
  check("turning areas off switches color off too",
    C.toggle({ ...s, show: { areas: true, color: true, hint: false, names: false } }, "areas").show.color === false);
  const hn = C.toggle(C.toggle(s, "hint"), "names");
  check("hint and names work while areas is off", hn.show.hint && hn.show.names);
}

/* ----------------------------- 2. a second, literal bytecode transcription */

/* GeoSDoub.FindOrientation, term by term from javap. */
function orient2(p0, p1, p2) {
  const d = p2.x * (p0.y - p1.y) + p2.y * (p1.x - p0.x) +
    p0.x * p1.y - p1.x * p0.y;
  return d > 0 ? 1 : -1;
}
/* GeoSDoub.ComputeAngle, via SqDist and Dist exactly as the bytecode does. */
function angle2(p0, p1, p2) {
  const sq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const ds = (a, b) => Math.sqrt(sq(a, b));
  return Math.acos((sq(p0, p1) + sq(p0, p2) - sq(p1, p2)) / 2 / ds(p0, p1) / ds(p0, p2));
}
function rotate2(base, tip, angle, dir) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return P(
    base.x + co * (tip.x - base.x) - dir * si * (tip.y - base.y),
    base.y + dir * si * (tip.x - base.x) + co * (tip.y - base.y),
  );
}
function parallel2(a, b, c) {
  return P(a.x + 100 * (b.x - c.x), a.y + 100 * (b.y - c.y));
}
function nearest2(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + t * dx, a.y + t * dy);
}
function intersect2(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}
/* DijkstraCanvas.Compute(), with the same locals in the same order. */
function compute2(A, B, Cc) {
  const S1 = parallel2(Cc, A, B);
  const H = nearest2(Cc, A, B);
  const S2 = parallel2(B, Cc, H);
  const S3 = parallel2(A, Cc, H);
  const D = intersect2(Cc, S1, B, S2);
  const E = intersect2(Cc, S1, A, S3);
  const ori = orient2(A, B, Cc);
  const beta = angle2(B, Cc, A);
  const S7 = rotate2(Cc, A, beta, ori);
  const L = intersect2(Cc, S7, A, B);
  const alpha = angle2(A, B, Cc);
  const S10 = rotate2(Cc, B, alpha, -ori);
  const N = intersect2(Cc, S10, A, B);
  const S11 = parallel2(L, Cc, H);
  const K = intersect2(E, D, L, S11);
  const S12 = parallel2(N, Cc, H);
  const M = intersect2(E, D, N, S12);
  const gamma = angle2(Cc, A, B);
  return { H, D, E, L, N, K, M, alpha, beta, gamma, ori };
}

/* A lattice that keeps A and B at their starting places, plus free triangles. */
const configs = [];
{
  for (let x = 30; x <= 470; x += 20) {
    for (let y = 30; y <= 420; y += 20) configs.push({ A: P(62.5, 285), B: P(437.5, 285), C: P(x, y) });
  }
  const rand = rng(97531);
  for (let i = 0; i < 900; i++) {
    configs.push({
      A: P(30 + rand() * 440, 30 + rand() * 390),
      B: P(30 + rand() * 440, 30 + rand() * 390),
      C: P(30 + rand() * 440, 30 + rand() * 390),
    });
  }
  for (const name of ["obtuse", "right", "acute"]) configs.push(C.preset(name));
}
const usable = configs.filter((s) => {
  const m = C.measure(s);
  return m.valid && Number.isFinite(compute2(s.A, s.B, s.C).L.x);
});
check("the test exercises hundreds of non-degenerate triangles", usable.length > 600, `${usable.length} usable`);
check("the lattice includes all three named shapes", ["obtuse", "right", "acute"].every((n) =>
  usable.some((s) => nearPt(s.A, C.preset(n).A) && nearPt(s.C, C.preset(n).C))));

{
  let badPoint = 0, badAngle = 0, badOrient = 0;
  const names = ["H", "D", "E", "L", "N", "K", "M"];
  for (const s of usable) {
    const q = C.compute(s), r = compute2(s.A, s.B, s.C);
    if (q.orient !== r.ori) badOrient++;
    for (const name of names) {
      const scale = Math.max(1, Math.abs(r[name].x), Math.abs(r[name].y));
      if (!nearPt(q[name], r[name], 2e-7 * scale)) badPoint++;
    }
    for (const name of ["alpha", "beta", "gamma"]) {
      if (!near(q[name], r[name], 1e-9)) badAngle++;
    }
  }
  check(`all seven constructed points match the bytecode over ${usable.length} triangles`,
    badPoint === 0, `${badPoint} point differences`);
  check("alpha, beta and gamma match the bytecode everywhere", badAngle === 0, `${badAngle} angle differences`);
  check("the orientation switch matches the bytecode everywhere", badOrient === 0, `${badOrient} differences`);
}

/* -------------------------------------------------------- 3. the page's claims */

/* An angle measured a different way (atan2 of cross and dot), not acos. */
function angleAt(vertex, p, q) {
  const u = P(p.x - vertex.x, p.y - vertex.y);
  const v = P(q.x - vertex.x, q.y - vertex.y);
  return Math.abs(Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y));
}
const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
const sgnEps = (x, eps) => (x > eps ? 1 : x < -eps ? -1 : 0);
function area2(poly) {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return Math.abs(sum) / 2;
}

{
  let badSq = 0, badHalf = 0, badArea = 0;
  for (const s of usable) {
    const m = C.measure(s), q = m.points;
    if (m.signAngles !== m.signSquares) badSq++;
    if (m.signAngles !== sgnEps(PI / 2 - q.gamma, 1e-12)) badHalf++;
    if (m.signAngles !== m.signAreas) badArea++;
  }
  check("sign(alpha+beta-gamma) = sign(a²+b²-c²) in every triangle", badSq === 0, `${badSq} failures`);
  check("sign(alpha+beta-gamma) = sign(pi/2-gamma) in every triangle", badHalf === 0, `${badHalf} failures`);
  check("sign(alpha+beta-gamma) = sign(area sum - area ABC) in every triangle",
    badArea === 0, `${badArea} failures`);
}

{
  let badRatio = 0, badPageRatio = 0, badAL = 0, badBN = 0, wrongSide = 0;
  for (const s of usable) {
    const m = C.measure(s), q = m.points;
    const tolerance = 1e-6 * Math.max(1, m.areaABC / (m.c * m.c));
    if (!near(m.areaACL / (m.b * m.b), m.areaABC / (m.c * m.c), tolerance)) badRatio++;
    if (!near(m.areaBCN / (m.a * m.a), m.areaABC / (m.c * m.c), tolerance)) badRatio++;
    // The page prints ACL/a² and BCN/b²: those two numerators are swapped.
    // In a triangle with a = b (or a = b = c) the mistake cannot be seen.
    if (!near(m.a, m.b, 1e-6 * Math.max(m.a, m.b)) &&
        near(m.areaACL / (m.a * m.a), m.areaABC / (m.c * m.c), tolerance)) badPageRatio++;
    const al = Math.hypot(q.L.x - q.A.x, q.L.y - q.A.y);
    const bn = Math.hypot(q.N.x - q.B.x, q.N.y - q.B.y);
    if (!near(al, (m.b * m.b) / m.c, 1e-5 * Math.max(1, al))) badAL++;
    if (!near(bn, (m.a * m.a) / m.c, 1e-5 * Math.max(1, bn))) badBN++;
    const ab = P(q.B.x - q.A.x, q.B.y - q.A.y);
    if ((q.L.x - q.A.x) * ab.x + (q.L.y - q.A.y) * ab.y < -1e-6 ||
        (q.N.x - q.B.x) * ab.x + (q.N.y - q.B.y) * ab.y > 1e-6) wrongSide++;
  }
  check("ACL/b² = BCN/a² = ABC/c² in every triangle", badRatio === 0, `${badRatio} failures`);
  check("the page's ACL/a² and BCN/b² pairing is the wrong way round",
    badPageRatio === 0, `${badPageRatio} triangles agree with the swapped labels`);
  check("AL = b²/c and BN = a²/c in every triangle", badAL === 0 && badBN === 0,
    `${badAL} AL, ${badBN} BN failures`);
  check("L and N lie on the rays AB and BA, never on the opposite rays", wrongSide === 0,
    `${wrongSide} failures`);
}

{
  let badAngle = 0, badSimilar = 0;
  for (const s of usable) {
    const m = C.measure(s), q = m.points;
    if (!near(angleAt(q.C, q.A, q.L), q.beta, 1e-7) ||
        !near(angleAt(q.C, q.B, q.N), q.alpha, 1e-7) ||
        !near(angleAt(q.A, q.C, q.L), q.alpha, 1e-7) ||
        !near(angleAt(q.B, q.C, q.N), q.beta, 1e-7)) badAngle++;
    const acl = [Math.hypot(q.A.x - q.C.x, q.A.y - q.C.y),
      Math.hypot(q.A.x - q.L.x, q.A.y - q.L.y),
      Math.hypot(q.C.x - q.L.x, q.C.y - q.L.y)];
    const bcn = [Math.hypot(q.B.x - q.C.x, q.B.y - q.C.y),
      Math.hypot(q.B.x - q.N.x, q.B.y - q.N.y),
      Math.hypot(q.C.x - q.N.x, q.C.y - q.N.y)];
    // ACL corresponds to ABC with A->A, C->B, L->C (AC↔AB=b/c, AL↔AC=b/c);
    // BCN with B->B, C->A, N->C (BC↔AB=a/c, BN↔BC=a/c).
    if (!near(acl[0] / m.c, acl[1] / m.b, 1e-6) ||
        !near(bcn[0] / m.c, bcn[1] / m.a, 1e-6)) badSimilar++;
  }
  check("the highlighted angles at C are beta and alpha, as the page says", badAngle === 0,
    `${badAngle} failures`);
  check("ACL and BCN are similar to ABC", badSimilar === 0, `${badSimilar} failures`);
}

/* --------------------------------------- 4. named configurations and edges */

{
  const start = C.start();
  const right = C.preset("right");
  const rm = C.measure(right), rq = rm.points;
  check("the right-angle preset really has gamma = 90 degrees", near(rq.gamma, PI / 2, 1e-12));
  check("when gamma is right, CL and CN coincide at the foot H",
    nearPt(rq.L, rq.H, 1e-6) && nearPt(rq.N, rq.H, 1e-6) && nearPt(rq.L, rq.N, 1e-6));
  check("when gamma is right, the two pieces fill ABC exactly",
    rm.signAngles === 0 && near(rm.areaACL + rm.areaBCN, rm.areaABC, 1e-5));
  check("the right preset keeps the applet's other corners and checkboxes",
    nearPt(right.A, start.A) && nearPt(right.B, start.B) &&
    JSON.stringify(right.show) === JSON.stringify(start.show));

  const acute = C.preset("acute");
  const am = C.measure(acute), aq = am.points;
  check("the acute preset is equilateral", near(aq.alpha, PI / 3, 1e-9) &&
    near(aq.beta, PI / 3, 1e-9) && near(aq.gamma, PI / 3, 1e-9));
  check("equilateral L and N land at B and A", nearPt(aq.L, aq.B, 1e-5) && nearPt(aq.N, aq.A, 1e-5));
  check("for an acute triangle the pieces overlap", am.signAngles === 1 &&
    am.areaACL + am.areaBCN > am.areaABC);
  check("the status line names the three cases",
    /gap/.test(C.status(start)) && /fill the big rectangle/.test(C.status(right)) &&
    /overlap/.test(C.status(acute)));

  const flat = { ...start, C: P(200, 285) };
  check("a flat triangle is reported instead of crashing",
    /off the line AB/.test(C.status(flat)) && C.measure(flat).valid === false);
  const coincident = { ...start, A: P(200, 285), B: P(200, 285) };
  check("coincident corners are reported instead of crashing",
    /off the line AB/.test(C.status(coincident)));
  check("an invalid triangle has no sign to report", C.measure(flat).signAreas === 0);
}

done("dijkstra");
