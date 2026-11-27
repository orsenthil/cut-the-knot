#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-of-similitude-1/circle-of-similitude-1-core.js.
 *
 *   node porting/check-circle-of-similitude-1.mjs
 *
 * Checked: the starting dots and the applet's Fix(2) / restricted-T behaviour;
 * the ratio d1/d2 = t1/t2 = r1/r2 on the circle of similitude; and the four
 * statements of the verified page (orthogonality with the circle on O1O2,
 * angle bisection by TP, equal distances from the radical axis, and equal
 * segments L1K1 = L2K2 / tangent lengths t(L1,c2) = t(L2,c1), plus the page's
 * converse) over hundreds of configurations, including tilted centres that
 * the applet's own UI cannot reach.
 *
 * The last group is a second, literal transcription of the applet's Compute():
 * Tangents.GetExternalTangents / GetInternalTangents (auxiliary circle,
 * Inversion.Tangent, rescale the contacts), GeoSDoub.Intersect of the tangent
 * lines for P and Q, the midpoint-and-radius construction of CS, the circle
 * on O1O2 as diameter, its intersections with CS, the vertical radical-axis
 * formula from RadicalAxis(), Order + CheckTwoPoints + Other + Between, and
 * the T tangents from a zero-radius circle. Everything is compared with the
 * core's closed forms. The page says "three" properties but shows four
 * statements; the applet has four checkboxes, and all four are checked here.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circle-of-similitude-1/circle-of-similitude-1-core.js", "CircleOfSimilitude1Core");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p, t) => ({ x: p.x * t, y: p.y * t });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p) && Boolean(q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const setOf = (pts) => pts.map((p) => [Number(p.x.toFixed(5)), Number(p.y.toFixed(5))])
  .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
const sameSet = (a, b, tol) => {
  if (!a || !b || a.length !== b.length) return false;
  const A = setOf(a), B = setOf(b);
  return A.every((p, i) => Math.abs(p[0] - B[i][0]) < tol && Math.abs(p[1] - B[i][1]) < tol);
};
const stateOf = (a, ra, b, rb, T) => ({
  O1: { ...a }, R1: { x: a.x + ra, y: a.y },
  O2: { ...b }, R2: { x: b.x + rb, y: b.y },
  T: { ...T },
  options: { names: true, hint: false, s1: false, s2: false, s3: false, s4: false, one: true },
  explored: false,
});

/* -------------------------------- the applet's own code, transcribed again */

/* GeoSDoub.Intersect(DoubCircle, DoubCircle); the order is y-then-x. */
function appletCirclePoints(A, B) {
  const d = dist(A.center, B.center);
  if (!d || d > A.r + B.r || d < Math.abs(A.r - B.r)) return null;
  const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, A.r * A.r - a * a));
  const u = mul(sub(B.center, A.center), 1 / d);
  const base = add(A.center, mul(u, a));
  const pts = [add(base, { x: -u.y * h, y: u.x * h }), add(base, { x: u.y * h, y: -u.x * h })];
  return pts.sort((p, q) => (q.y - p.y) || (q.x - p.x));
}

/* Inversion.Tangent(circle, point) — DoubLine(point, contact). */
function appletTangentsFrom(A, P) {
  const d2 = dot(sub(P, A.center), sub(P, A.center)) - A.r * A.r;
  if (d2 < 0) return null;
  const pts = appletCirclePoints(A, { center: P, r: Math.sqrt(d2) });
  if (!pts) return null;
  return pts.map((q) => ({ m_1: P, m_2: q }));
}

/* Tangents.GetExternalTangents / GetInternalTangents, step for step. The
 * returned lines carry m_1 on the larger (first, for internal) circle. */
function appletTangents(c1, c2, internal) {
  if (internal) {
    const lines = appletTangentsFrom({ center: c1.center, r: c1.r + c2.r }, c2.center);
    if (!lines) return null;
    return lines.map((ln) => ({
      m_1: add(c1.center, mul(sub(ln.m_2, c1.center), c1.r / (c1.r + c2.r))),
      m_2: add(c2.center, mul(sub(ln.m_2, c1.center), -c2.r / (c1.r + c2.r))),
    }));
  }
  const big = c1.r >= c2.r ? c1 : c2;
  const small = c1.r >= c2.r ? c2 : c1;
  const diff = big.r - small.r;
  if (Math.abs(diff) < 1e-9) return null;
  const lines = appletTangentsFrom({ center: big.center, r: diff }, small.center);
  if (!lines) return null;
  return lines.map((ln) => ({
    m_1: add(big.center, mul(sub(ln.m_2, big.center), big.r / diff)),
    m_2: add(small.center, mul(sub(ln.m_2, big.center), small.r / diff)),
  }));
}

/* GeoSDoub.Intersect(DoubLine, DoubLine), with the applet's one-pixel cutoff. */
function appletIntersectLines(l1, l2) {
  const s4 = l1.m_1.y - l1.m_2.y;
  const s6 = l1.m_2.x - l1.m_1.x;
  const s8 = l1.m_1.x * l1.m_2.y - l1.m_1.y * l1.m_2.x;
  const s10 = l2.m_1.y - l2.m_2.y;
  const s12 = l2.m_2.x - l2.m_1.x;
  const s14 = l2.m_1.x * l2.m_2.y - l2.m_1.y * l2.m_2.x;
  const s16 = s6 * s14 - s12 * s8;
  const s18 = s8 * s10 - s14 * s4;
  const det = s4 * s12 - s10 * s6;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: s16 / det, y: s18 / det };
}

function appletLineCircle(line, c, r) {
  const d = sub(line.m_2, line.m_1), l2 = dot(d, d);
  if (l2 < 1e-12) return [];
  const t0 = dot(sub(c.center, line.m_1), d) / l2;
  const h = sub(add(line.m_1, mul(d, t0)), c.center);
  if (dot(h, h) - r * r > 1e-9) return [];
  const k = Math.sqrt(Math.max(0, r * r - dot(h, h))) / Math.sqrt(l2);
  return [add(line.m_1, mul(d, t0 - k)), add(line.m_1, mul(d, t0 + k))];
}

/* GeoSDoub.FindOrientation(a,b,c) and Order(T, tangentLines). */
const orientation = (a, b, c) => (cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1);
function appletOrder(T, lines) {
  if (orientation(lines[0].m_1, lines[1].m_1, T) === -1) return [lines[1], lines[0]];
  return lines;
}

/* CheckTwoPoints / Other / Between from the applet. */
function appletCheckTwoPoints(L1, L2, c1, c2) {
  const line = { m_1: L1, m_2: L2 };
  const i1 = appletLineCircle(line, c1, c1.r);
  const i2 = appletLineCircle(line, c2, c2.r);
  if (i1.length < 2 || i2.length < 2) return null;
  const other = (pts, p) => (dist(pts[0], p) < dist(pts[1], p) ? pts[1] : pts[0]);
  const k1 = other(i1, L1), k2 = other(i2, L2);
  const between = (a, b, c) => dot(sub(a, b), sub(a, c)) <= 0;
  if (dist(L1, L2) < 1) return [L1, L2, L1, L2];
  if (between(L1, k1, k2) && between(L2, k1, k2)) return [k1, k2, L1, L2];
  if (between(k1, L1, L2) && between(k2, L1, L2)) return [L1, L2, k1, k2];
  return null;
}

/* CircleOfSimilitude1Canvas.Compute, as literally as javap allows. */
function appletCompute(s, one) {
  const { c1, c2 } = C.circles(s);
  const ELine = appletTangents(c1, c2, false);
  const ILine = appletTangents(c1, c2, true);
  const Q = ELine ? appletIntersectLines(ELine[0], ELine[1]) : null;
  const P = ILine ? appletIntersectLines(ILine[0], ILine[1]) : null;
  if (!P || !Q || !Number.isFinite(P.x) || !Number.isFinite(Q.x)) {
    return { P, Q, possible: false };
  }
  // The bytecode stores CS.C.x = (P.x+Q.x)/2 and the B point at
  // CS.C.x + |P.x-Q.x|/2 (with the original y values).
  const cs = {
    c: { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 },
    r: Math.abs(P.x - Q.x) / 2,
  };
  const T1 = appletTangents({ center: s.T, r: 0 }, c1, false);
  const T2 = appletTangents({ center: s.T, r: 0 }, c2, false);
  let ss = null;
  if (T1 && T2) {
    const o1 = appletOrder(s.T, T1), o2 = appletOrder(s.T, T2);
    ss = appletCheckTwoPoints(o1[one ? 0 : 1].m_1, o2[one ? 1 : 0].m_1, c1, c2);
  }
  const cm = { center: { x: (c1.center.x + c2.center.x) / 2, y: c1.center.y },
               r: Math.abs(c1.center.x - c2.center.x) / 2 };
  const crossPoints = appletCirclePoints({ center: cs.c, r: cs.r }, cm) || [];
  const d = dist(c1.center, c2.center);
  const radicalX = c1.center.x + (d * d + c1.r ** 2 - c2.r ** 2) / (2 * d);
  return { P, Q, cs, cm, E: crossPoints[0] || null, F: crossPoints[1] || null,
           radicalX, ss, possible: true };
}

/* ---------------------------------------------------- 1. start and the API */

{
  const s = C.start();
  equal("start O1 matches CircleOfSimilitude1Canvas.init at 400x300", s.O1, { x: 120, y: 150 });
  equal("start R1 matches init (width/20 to the left)", s.R1, { x: 100, y: 150 });
  equal("start O2 matches init (width/2 + width/5)", s.O2, { x: 280, y: 150 });
  equal("start T begins on the circle of similitude", C.close(
    C.dist(s.T, C.geometry(s).cs.center), C.geometry(s).cs.radius, 1e-9), true);
  check("the second radius differs, as the page requires (applet starts equal)",
    C.dist(s.O2, s.R2) === 50 && C.dist(s.O1, s.R1) === 20);
  check("an illustration is never won or lost", C.result(s) === null);
  equal("the five draggable points are the applet's five movables", C.legalMoves(s),
    ["O1", "R1", "O2", "R2", "T"]);
  const equalRadii = C.start({ appletRadii: true });
  check("the applet's equal-radii start puts Q at infinity", C.geometry(equalRadii).cs.infinite === true);
  check("core defaults match the applet's checkboxes (names on, rest off, L chosen)",
    s.options.names && !s.options.hint && !s.options.s1 && !s.options.s2 &&
    !s.options.s3 && !s.options.s4 && s.options.one);
  check("setOption keeps the other options", (() => {
    const t = C.setOption(C.setOption(s, "s2", true), "one", false);
    return t.options.s2 && !t.options.one && t.options.names && !s.options.s2;
  })());
  check("an unknown point name changes nothing", C.withPoint(s, "Z", { x: 0, y: 0 }) === s);
}

/* -------------------------------- 2. the applet's Fix(2) and restricted T */

{
  const s = C.start();
  const moved = C.withPoint(s, "O1", { x: 140, y: 30 });
  check("O1 keeps its y, like the applet's Fix(2)", moved.O1.x === 140 && moved.O1.y === 150);
  check("moving O1 repositions T on the new circle of similitude", C.close(
    C.dist(moved.T, C.geometry(moved).cs.center), C.geometry(moved).cs.radius, 1e-9));
  check("withPoint leaves the old state untouched", s.O1.x === 120 && s.T.x !== moved.T.x);
  const dragged = C.withPoint(s, "T", { x: 250, y: 40 });
  check("T is projected back onto the circle of similitude", C.close(
    C.dist(dragged.T, C.geometry(dragged).cs.center), C.geometry(dragged).cs.radius, 1e-9));
  const kept = C.withPoint(s, "R1", { x: s.O1.x - 5, y: s.O1.y });
  check("a radius smaller than 8 is refused", kept === s);
  const far = C.withPoint(s, "R2", { x: 10, y: s.O2.y });
  check("a radius larger than 130 is refused", far === s);
  check("reset restores the starting dots but keeps 'explored'",
    C.reset(C.withPoint(s, "O1", { x: 130, y: 150 })).O1.x === 120 &&
    C.reset(C.withPoint(s, "O1", { x: 130, y: 150 })).explored === true);
}

/* ------------------------ 3. the page's claims in the starting picture */

{
  const m = C.claims(C.start());
  check("TO1/TO2 equals r1/r2", m.ratioOK, `${m.distanceRatio} vs ${m.ratio}`);
  check("the tangential lengths from T are in the ratio r1/r2", m.tangentRatioOK);
  check("statement 1: the two circles meet at right angles", m.orthogonal && m.Eright && m.Fright);
  check("CS has PQ as a diameter, as the page says", m.diameter);
  check("P and Q lie on the line of centres", m.collinear);
  check("the radical axis is perpendicular to the line of centres", m.radicalPerpendicular);
  check("statement 2: TP bisects both pairs", m.L.bisects && m.M.bisects &&
    m.L.otherBisects && m.M.otherBisects);
  check("statement 3: both pairs are equally far from the radical axis",
    m.L.equallyFar && m.M.equallyFar);
  check("statement 4: L1K1 = L2K2 for both pairs", m.L.segments && m.M.segments);
  check("statement 4': t(L1,c2) = t(L2,c1) for both pairs",
    m.L.tangentLengths && m.M.tangentLengths);
  check("the page's converse: tangents at L1,L2 meet on the circle of similitude",
    m.L.converse && m.M.converse);
}

/* ------------------- 4. the claims over hundreds of configurations */

{
  const random = rng(20261126);
  let n = 0, bad = { ratio: 0, tangentRatio: 0, orthogonal: 0, right: 0,
    diameter: 0, bisects: 0, equallyFar: 0, segments: 0, tangentLengths: 0, converse: 0 };
  let firstBad = "";
  for (let i = 0; i < 600 && n < 300; i++) {
    const a = { x: 40 + random() * 110, y: 40 + random() * 220 };
    const b = { x: 250 + random() * 110, y: 40 + random() * 220 };
    const ra = 14 + random() * 46, rb = 14 + random() * 46;
    const d0 = dist(a, b);
    if (d0 <= ra + rb + 8 || Math.abs(ra - rb) < 6) continue;
    const state = stateOf(a, ra, b, rb, { x: 200, y: 150 });
    const g = C.geometry(state);
    if (!g.possible || g.cs.infinite || !g.pairL || !g.pairM) continue;
    const T = C.restrict(state, { x: 20 + random() * 360, y: 20 + random() * 260 });
    const m = C.claims(Object.assign({}, state, { T }));
    if (!m) continue;
    n++;
    const fail = (key, ok) => {
      if (!ok) { bad[key]++; if (!firstBad) firstBad = `case ${n}: ${key}`; }
    };
    fail("ratio", m.ratioOK);
    fail("tangentRatio", m.tangentRatioOK);
    fail("orthogonal", m.orthogonal);
    fail("right", m.Eright && m.Fright);
    fail("diameter", m.diameter && m.collinear);
    for (const key of ["L", "M"]) {
      fail("bisects", m[key].bisects && m[key].otherBisects);
      fail("equallyFar", m[key].equallyFar);
      fail("segments", m[key].segments);
      fail("tangentLengths", m[key].tangentLengths);
      fail("converse", m[key].converse);
    }
  }
  check(`${n} varied configurations were tested`, n >= 250, `only ${n}`);
  for (const key of Object.keys(bad)) {
    check(`every configuration passes ${key}`, bad[key] === 0, `${bad[key]} failed; ${firstBad}`);
  }
}

/* ------------- 5. a second transcription of the applet's own computation */

{
  const random = rng(77123);
  let compared = 0, worst = 0, firstBad = "";
  for (let i = 0; i < 900 && compared < 250; i++) {
    // Horizontal centres, as the applet's Fix(2) enforces, so its vertical
    // radical-axis formula is the true one here.
    const y = 130 + Math.floor(random() * 41);
    const a = { x: 45 + random() * 90, y };
    const b = { x: 260 + random() * 90, y };
    const ra = 16 + random() * 38, rb = 16 + random() * 38;
    if (dist(a, b) <= ra + rb + 8 || Math.abs(ra - rb) < 6) continue;
    const state = stateOf(a, ra, b, rb, { x: 200, y });
    const g = C.geometry(state);
    if (!g.possible || g.cs.infinite || !g.pairL || !g.pairM) continue;
    const T = C.restrict(state, { x: randX(random), y: randY(random) });
    const withT = Object.assign({}, state, { T });
    const a2 = appletCompute(withT, true);
    if (!a2.possible || !a2.ss) continue;
    const g2 = C.geometry(withT);
    const tol = 2e-4;
    const okP = closePoint(a2.P, g2.P, tol) && closePoint(a2.Q, g2.Q, tol);
    const okCS = closePoint(a2.cs.c, g2.cs.center, tol) && close(a2.cs.r, g2.cs.radius, tol);
    const okCM = closePoint(a2.cm.center, g2.cm.center, tol) && close(a2.cm.r, g2.cm.radius, tol);
    const okEF = sameSet([a2.E, a2.F], [g2.E, g2.F], tol);
    const okRad = close(a2.radicalX, g2.radical.point.x, tol);
    const okSS = sameSet(a2.ss, g2.pairL.ss, tol);
    const okAngle = close(C.angle(T, g2.pairL.P1, g2.P), C.angle(T, g2.P, g2.pairL.P2), 1e-6);
    if (!(okP && okCS && okCM && okEF && okRad && okSS && okAngle)) {
      if (!firstBad) firstBad = JSON.stringify({ i, okP, okCS, okCM, okEF, okRad, okSS, okAngle,
        rad: [a2.radicalX, g2.radical.point.x], centers: [withT.O1, withT.O2, withT.R1, withT.R2],
        a2: { P: a2.P, Q: a2.Q, cs: a2.cs, ss: a2.ss }, core: { P: g2.P, Q: g2.Q, cs: g2.cs.center, ss: g2.pairL.ss } });
      break;
    }
    worst = Math.max(worst, Math.abs(a2.cs.r - g2.cs.radius), Math.abs(a2.P.x - g2.P.x));
    compared++;
  }
  check(`${compared} positions match the applet's Compute() exactly`, compared >= 200,
    `only ${compared}; ${firstBad}`);

  // Both radio choices, at a few fixed configurations, with the applet's own
  // tangent order and CheckTwoPoints.
  for (const one of [true, false]) {
    let hits = 0;
    for (const s of [
      C.start(),
      stateOf({ x: 100, y: 160 }, 22, { x: 300, y: 160 }, 48, { x: 70, y: 80 }),
      stateOf({ x: 130, y: 140 }, 30, { x: 290, y: 190 }, 55, { x: 200, y: 40 }),
    ]) {
      const g = C.geometry(s);
      if (!g.possible || g.cs.infinite || !g.pairL) continue;
      const a2 = appletCompute(s, one);
      if (!a2.possible || !a2.ss) continue;
      hits++;
      check(`applet and core choose the same ${one ? "L" : "M"} four points`,
        sameSet(a2.ss, C.pairFor(g, one).ss, 2e-4));
    }
    check(`the ${one ? "L" : "M"} pair exists in the fixed configurations`, hits >= 2);
  }
}

function randX(random) { return 20 + random() * 360; }
function randY(random) { return 20 + random() * 260; }

done("circle-of-similitude-1");
