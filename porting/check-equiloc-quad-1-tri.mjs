#!/usr/bin/env node
"use strict";

/*
 * Logic test for equiloc-quad-1-tri/equiloc-quad-1-tri-core.js.
 *
 *   node porting/check-equiloc-quad-1-tri.mjs
 *
 * The cut-the-knot page says: "Assume in a quadrilateral ABCD AD = BC, S the
 * intersection of AD and BC. Let Q be the apex of an isosceles triangle CDQ
 * drawn away from AB with angle CQD = angle BSA. Then S is the midpoint of the
 * arc of the circumcircle of ABS containing S." Read literally that asks for
 * AS = BS, which already fails in the applet's starting picture (the two
 * lengths differ by about 106.5 in viewBox units). The theorem the applet and
 * its linked valid proof demonstrate puts Q, not S, at that arc's midpoint.
 *
 * This test checks the literal sentence and the true one over thousands of
 * dragged positions, records that the applet's fixed apex choice only gives
 * the "away from AB" apex on the starting side of AB, and compares every
 * start/drag/repaint with a second transcription of the applet's bytecode
 * (FromCircle, LocatePoint, GetCircle, ComputeAngle, IsoscelesApex,
 * NearestPoint, InsideTest, UpgradeDistance, AdjustC/D and Compute).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equiloc-quad-1-tri/equiloc-quad-1-tri-core.js", "EquilocQuad1TriCore");

const P = (x, y) => ({ x, y });
const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const d = (p, q) => Math.sqrt(sq(p, q));
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closeP = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);
const tolOf = (p) => 1e-7 * Math.max(1, Math.abs(p.x), Math.abs(p.y));
const side = (a, b, p) => cross(sub(b, a), sub(p, a));

/* --------------------------- the applet's arithmetic, straight from bytecode */

const CIRCLE = { c: P(400 / 2, (300 * 11) / 20), r: Math.min(400, 300) / 2.7 };

function appletFromCircle(angle) {
  return P(CIRCLE.c.x + CIRCLE.r * Math.cos(angle),
    CIRCLE.c.y + CIRCLE.r * Math.sin(angle));
}

/* DoubCircle GetCircle(a,b,s): FindCircumcenter then the averaged radius. */
function appletFindCircumcenter(a, b, c) {
  const m1 = P((a.x + b.x) / 2, (a.y + b.y) / 2);
  const m2 = P((b.x + c.x) / 2, (b.y + c.y) / 2);
  const u = P(m1.x + b.y - a.y, m1.y - b.x + a.x);
  const v = P(m2.x + c.y - b.y, m2.y - c.x + b.x);
  const a1 = m1.y - u.y, b1 = u.x - m1.x, c1 = m1.x * u.y - m1.y * u.x;
  const a2 = m2.y - v.y, b2 = v.x - m2.x, c2 = m2.x * v.y - m2.y * v.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}
function appletGetCircle(a, b, s) {
  const c = appletFindCircumcenter(a, b, s);
  return { c, r: (d(c, a) + d(c, b) + d(c, s)) / 3 };
}

/* GeoSDoub.ComputeAngle: acos((SqDist(p,q)+SqDist(p,r)-SqDist(q,r)) / 2r1r2). */
function appletComputeAngle(p, q, r) {
  const v = (sq(p, q) + sq(p, r) - sq(q, r)) / (2 * d(p, q) * d(p, r));
  return Math.acos(v);
}

/* EquilocQuad1TriCanvas.LocatePoint(length,p,q). */
function appletLocate(length, p, q) {
  const n = d(q, p);
  return P(p.x + ((q.x - p.x) * length) / n, p.y + ((q.y - p.y) * length) / n);
}

/* EquilocQuad1TriCanvas.IsoscelesApex(D,C,ang). */
function appletApex(p, q, angle) {
  if (d(p, q) < 1) return null;
  const m = P((p.x + q.x) / 2, (p.y + q.y) / 2);
  const perp = P(p.y - m.y, m.x - p.x);
  const t = Math.tan(angle / 2);
  return P(m.x - perp.x / t, m.y - perp.y / t);
}

/* InsideTest.IsInside(a,b,c): (a-b).(a-c) dcmpg 0. */
function appletInside(a, b, c) {
  return dot(sub(a, b), sub(a, c)) <= 0;
}

/* GeoSDoub.NearestPoint(p,a,b), including its 0.1 squared-distance guard. */
function appletNearest(p, a, b) {
  if (sq(p, a) < 0.1) return P(p.x, p.y);
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + t * dx, a.y + t * dy);
}

function appletInit() {
  const A = appletFromCircle(2.6179938779914944);
  const B = appletFromCircle(0.5235987755982988);
  const S = appletFromCircle(5.711986642890533);
  const length = Math.min(d(A, S), d(B, S)) / 2;
  return { A, B, S, length, C: appletLocate(length, B, S), D: appletLocate(length, A, S) };
}

/* Compute(): GetCircle, AdjustC/D, then the guarded isosceles apex. */
function appletCompute(st) {
  const circle = appletGetCircle(st.A, st.B, st.S);
  const Cc = appletLocate(st.length, st.B, st.S);
  const Dd = appletLocate(st.length, st.A, st.S);
  const ang = appletComputeAngle(st.S, st.A, st.B);
  return { circle, C: Cc, D: Dd, angle: ang,
    Q: Math.abs(ang) > 0.1 ? appletApex(Dd, Cc, ang) : null };
}

/* UpgradeDistance() after a C or D drag, with InsideTest's sign. */
function appletDrag(st, name, p) {
  if (name === "S") {
    return Object.assign({}, st, { S: P(p.x, p.y),
      C: appletLocate(st.length, st.B, p), D: appletLocate(st.length, st.A, p) });
  }
  if (name === "C") {
    const Cc = appletNearest(p, st.B, st.S);
    const length = (appletInside(st.B, Cc, st.S) ? -1 : 1) * d(st.B, Cc);
    return Object.assign({}, st, { C: Cc, length, D: appletLocate(length, st.A, st.S) });
  }
  const Dd = appletNearest(p, st.A, st.S);
  const length = (appletInside(st.A, Dd, st.S) ? -1 : 1) * d(st.A, Dd);
  return Object.assign({}, st, { D: Dd, length, C: appletLocate(length, st.B, st.S) });
}

/* An independent arc midpoint: the two intersections of the perpendicular
 * bisector of AB with the circumcircle, taking the one on S's side of AB. */
function arcMid(a, b, s) {
  const o = appletFindCircumcenter(a, b, s), r = d(o, a);
  const v = sub(b, a), len = d(a, b), n = P(-v.y / len, v.x / len);
  const first = P(o.x + n.x * r, o.y + n.y * r);
  const second = P(o.x - n.x * r, o.y - n.y * r);
  return side(a, b, first) * side(a, b, s) >= 0 ? first : second;
}

/* ------------------------------------------------- 1. start and the options */

{
  const s = C.start({}), ap = appletInit(), g = C.compute(s), apG = appletCompute(ap);
  for (const k of ["A", "B", "S", "C", "D"]) {
    check(`init() gives the applet's ${k}`, closeP(s[k], ap[k], 1e-9),
      `core ${JSON.stringify(s[k])}, applet ${JSON.stringify(ap[k])}`);
  }
  check("init() uses half the shorter secant as AD = BC", close(s.length, ap.length, 1e-9));
  check("init() uses the applet's circle for A, B and S",
    closeP(s.A, appletFromCircle(5 * Math.PI / 6), 1e-9)
    && closeP(s.B, appletFromCircle(Math.PI / 6), 1e-9)
    && closeP(s.S, appletFromCircle(20 * Math.PI / 11), 1e-9));
  check("Compute() uses the applet's circumcircle",
    closeP(g.circle.c, apG.circle.c, 1e-7) && close(g.circle.r, apG.circle.r, 1e-7));
  check("Compute() starts with the applet's Q", closeP(g.Q, apG.Q, 1e-7));
  check("the start angle at S is 60 degrees", close(g.angle * 180 / Math.PI, 60, 1e-7));
  check("only the three applet handles can be dragged",
    JSON.stringify(C.legalMoves(s)) === JSON.stringify(["S", "C", "D"]));
  check("Names starts on (the page's Show=1), Construction and Hint off",
    s.options.names && !s.options.construction && !s.options.hint);
  check("a picture has no win, loss or finish", C.result(s) === null);
  check("a fresh picture is not marked explored", !s.explored);
  check("the start picture has a construction", !!g);
  check("the start picture keeps AD = BC", g.claims.adEqualsBC);
  check("the start apex angle equals the angle at S", g.claims.apexAngleMatches);
}

/* --------------------------------------------------------- 2. page's claim */

{
  const s = C.start(), g = C.compute(s);
  const asbs = Math.abs(d(s.A, s.S) - d(s.B, s.S));
  check("the page's literal claim is false at the start: S is not the arc midpoint",
    !g.claims.pageClaimLiteral && asbs > 100, `AS-BS = ${asbs}`);
  check("the true claim holds at the start: Q is the arc midpoint",
    g.claims.qIsArcMidpoint && g.measures.arcError < 1e-8,
    `arc error ${g.measures.arcError}`);
  check("Q is on the same side of AB as S at the start", g.claims.qSameSideAsS);
  check("the two proof triangles have QA = QB at the start", g.measures.qaError < 1e-8);
  check("the construction's conditions hold while the page's literal claim fails",
    g.claims.adEqualsBC && g.claims.apexAngleMatches && !g.claims.pageClaimLiteral);
  {
    const bisected = C.move(s, "S", P(200, 60));
    check("the literal claim only holds when S is on AB's perpendicular bisector",
      C.compute(bisected).claims.pageClaimLiteral
      && !C.compute(C.move(s, "S", P(280, 70))).claims.pageClaimLiteral);
  }
  check("the status describes the true arc claim",
    /Q is halfway along the arc/.test(C.describe(s)));
}

/* ----------------------------------------------------- 3. state and moves */

{
  const s = C.start();
  const movedS = C.move(s, "S", P(330, 60));
  check("dragging S leaves the start alone", s.S.x !== movedS.S.x);
  check("dragging S marks the picture explored", movedS.explored && !s.explored);
  check("dragging S keeps AD = BC through AdjustC/AdjustD",
    C.compute(movedS).claims.adEqualsBC);
  check("dragging S does not change the common length", movedS.length === s.length);
  const line = (t, p, q) => P(p.x + t * (q.x - p.x), p.y + t * (q.y - p.y));
  const cTarget = line(0.8, s.B, s.S);
  const toward = C.move(s, "C", cTarget);
  check("dragging C towards S increases AD = BC", toward.length > s.length);
  const past = C.move(s, "C", line(-0.5, s.B, s.S));
  check("dragging C past B makes the common length negative", past.length < 0);
  check("the signed length matches UpgradeDistance's InsideTest sign",
    close(past.length, (appletInside(s.B, appletNearest(line(-0.5, s.B, s.S), s.B, s.S), s.S) ? -1 : 1)
      * d(s.B, appletNearest(line(-0.5, s.B, s.S), s.B, s.S)), 1e-9));
  check("with C past B, D is placed on the far side of A",
    C.inside(s.A, past.D, s.S) && close(d(s.A, past.D), -past.length, 1e-9));
  const offLine = C.move(s, "C", P(360, 35));
  const apC = appletDrag(appletInit(), "C", P(360, 35));
  check("a pointer off the secant snaps to it as the applet does",
    closeP(offLine.C, apC.C, 1e-9) && close(offLine.length, apC.length, 1e-9));
  const dTarget = line(0.6, s.A, s.S);
  const dm = C.move(s, "D", dTarget);
  const apD = appletDrag(appletInit(), "D", dTarget);
  check("dragging D sets the same signed length and C as the applet",
    close(dm.length, apD.length, 1e-9) && closeP(dm.C, apD.C, 1e-9));
  check("an unknown handle is refused", C.move(s, "A", P(1, 2)) === s);
  check("a non-finite pointer is refused", C.move(s, "C", P(NaN, 2)) === s);
  check("S onto A or B is refused (the secant would collapse)",
    C.move(s, "S", s.A) === s && C.move(s, "S", s.B) === s);
  check("an unknown option is refused", C.setOption(s, "nope", true) === s);
  const opts = C.setOption(C.setOption(s, "construction", true), "hint", true);
  check("options change independently and mark the picture explored",
    opts.options.construction && opts.options.hint && opts.options.names
    && opts.explored && !s.options.construction);
  const reset = C.reset(opts);
  check("Reset restores the drawing but keeps the Show boxes",
    closeP(reset.S, s.S, 1e-9) && reset.options.construction && reset.options.hint
    && reset.explored);
  check("Hint changes the status to mention the matching triangles",
    /triangles ADQ and BCQ match/.test(C.describe(opts)));
}

/* ---------------------------- 4. the second transcription over many drags */

{
  const rand = rng(6741);
  let comparedStates = 0, comparedGeometry = 0, mismatches = 0;
  const compare = (label, st, ap) => {
    for (const k of ["A", "B", "S", "C", "D"]) {
      if (!closeP(st[k], ap[k], 1e-7)) {
        mismatches++;
        if (mismatches < 4) check(`${label}: ${k} matches the applet`, false,
          `core ${JSON.stringify(st[k])}, applet ${JSON.stringify(ap[k])}`);
      }
    }
    if (!close(st.length, ap.length, 1e-7)) {
      mismatches++;
      if (mismatches < 4) check(`${label}: AD = BC matches UpgradeDistance`, false);
    }
    comparedStates++;
    const g = C.compute(st), a = appletCompute(ap);
    if (!g || !a) {
      if (!!g !== !!a) { mismatches++; check(`${label}: the same degenerate guard`, false); }
      return;
    }
    for (const k of ["C", "D", "angle"]) {
      const got = k === "angle" ? g.angle : g[k];
      const want = k === "angle" ? a.angle : a[k];
      const ok = typeof got === "number" ? close(got, want, 1e-7) : closeP(got, want, 1e-7);
      if (!ok) {
        mismatches++;
        if (mismatches < 4) check(`${label}: ${k} matches the applet's Compute`, false);
      }
    }
    if (!closeP(g.circle.c, a.circle.c, 1e-7) || !close(g.circle.r, a.circle.r, 1e-7)) {
      mismatches++;
      if (mismatches < 4) check(`${label}: GetCircle matches the applet`, false);
    }
    const qOk = (g.Q === null && a.Q === null) || (g.Q && a.Q && closeP(g.Q, a.Q, 1e-7 * 400));
    if (!qOk) {
      mismatches++;
      if (mismatches < 4) check(`${label}: IsoscelesApex Q matches the applet`, false,
        `core ${JSON.stringify(g.Q)}, applet ${JSON.stringify(a.Q)}`);
    }
    comparedGeometry++;
  };

  /* S goes right round the circle, then C and D are pulled along the secants
   * and off them. Half-step angles keep S away from A and B, where the
   * applet's own secants collapse. */
  for (let i = 0; i < 720; i++) {
    const angle = ((i + 0.5) * 2 * Math.PI) / 720;
    const target = P(200 + 111.1111111111111 * Math.cos(angle),
      165 + 111.1111111111111 * Math.sin(angle));
    const ap0 = appletInit();
    if (d(target, ap0.A) < 1.2 || d(target, ap0.B) < 1.2) continue;
    const st = C.move(C.start(), "S", target), ap = appletDrag(ap0, "S", target);
    compare(`S angle ${i}`, st, ap);

    const t = -1.5 + ((i % 11) * 0.4);
    const cTarget = P(ap.B.x + t * (ap.S.x - ap.B.x), ap.B.y + t * (ap.S.y - ap.B.y));
    compare(`C drag ${i}`, C.move(st, "C", cTarget), appletDrag(ap, "C", cTarget));

    const u = -1.2 + ((i % 9) * 0.35);
    const dTarget = P(ap.A.x + u * (ap.S.x - ap.A.x), ap.A.y + u * (ap.S.y - ap.A.y));
    compare(`D drag ${i}`, C.move(st, "D", dTarget), appletDrag(ap, "D", dTarget));
  }
  for (let i = 0; i < 400; i++) {
    const p = P(20 + rand() * 360, 20 + rand() * 260);
    compare(`free C pointer ${i}`, C.move(C.start(), "C", p), appletDrag(appletInit(), "C", p));
    const q = P(20 + rand() * 360, 20 + rand() * 260);
    compare(`free D pointer ${i}`, C.move(C.start(), "D", q), appletDrag(appletInit(), "D", q));
  }
  check(`${comparedStates} drags match the bytecode transcription`,
    comparedStates > 2500 && mismatches === 0, `${mismatches} mismatches`);
  check(`${comparedGeometry} drawings match the applet's Compute`,
    comparedGeometry > 2500 && mismatches === 0);
}

/* ---------------------------- 5. the true claim, exhaustively over the arc */

{
  let valid = 0, failures = 0, maxArcError = 0, maxLengthError = 0;
  const verify = (label, st) => {
    const g = C.compute(st);
    if (!g || !g.Q) return false;
    const tol = 1e-7 * Math.max(1, d(g.A, g.B), d(g.A, g.S), d(g.B, g.S), g.circle.r);
    if (!(g.claims.adEqualsBC && g.claims.apexAngleMatches
      && g.measures.arcError <= tol && g.measures.qaError <= tol
      && g.claims.qSameSideAsS)) {
      failures++;
      if (failures < 4) check(`${label}: Q is the arc midpoint`, false, JSON.stringify(g.measures));
      return false;
    }
    maxArcError = Math.max(maxArcError, g.measures.arcError);
    maxLengthError = Math.max(maxLengthError, g.measures.adbcError);
    valid++;
    return true;
  };

  /* Every degree of the circle on the starting side of AB (the arc through
   * the start angle 327 degrees), twelve common lengths each, including
   * negative ones (C and D beyond A and B). */
  for (let deg = 151; deg <= 359; deg++) {
    for (let j = 1; j <= 12; j++) {
      const angle = deg * Math.PI / 180;
      const s0 = C.move(C.start(), "S",
        P(200 + 111.1111111111111 * Math.cos(angle),
          165 + 111.1111111111111 * Math.sin(angle)));
      const frac = j / 4 - 1.25;
      const base = Math.min(d(s0.A, s0.S), d(s0.B, s0.S));
      const p = P(s0.B.x + (frac * base / d(s0.B, s0.S)) * (s0.S.x - s0.B.x),
        s0.B.y + (frac * base / d(s0.B, s0.S)) * (s0.S.y - s0.B.y));
      verify(`degree ${deg}, length ${frac}`, C.move(s0, "C", p));
    }
  }
  check(`${valid} configurations on the starting side have Q at the arc midpoint`,
    valid > 1200 && failures === 0, `${failures} failures`);
  check("AD = BC and angle CQD = angle BSA throughout", maxLengthError < 1e-8 && failures === 0);
  check("the arc error stays at drawing precision", maxArcError < 1e-8);

  /* On the other side of AB the applet's fixed handedness picks the wrong
   * apex: Q is not the arc midpoint, while -angle would give the right one. */
  let wrongSide = 0, wrongFailures = 0;
  for (let deg = 31; deg < 150; deg++) {
    for (const frac of [-1, 0.25, 0.75, 1.5]) {
      const angle = deg * Math.PI / 180;
      const s0 = C.move(C.start(), "S",
        P(200 + 111.1111111111111 * Math.cos(angle),
          165 + 111.1111111111111 * Math.sin(angle)));
      const base = Math.min(d(s0.A, s0.S), d(s0.B, s0.S));
      const p = P(s0.B.x + (frac * base / d(s0.B, s0.S)) * (s0.S.x - s0.B.x),
        s0.B.y + (frac * base / d(s0.B, s0.S)) * (s0.S.y - s0.B.y));
      const g = C.compute(C.move(s0, "C", p));
      if (!g || !g.Q || !g.otherQ) continue;
      wrongSide++;
      if (g.claims.qIsArcMidpoint || !g.claims.otherIsArcMidpoint) {
        wrongFailures++;
        if (wrongFailures < 4) check(`degree ${deg}: wrong apex recorded`, false);
      }
    }
  }
  check(`${wrongSide} configurations on the far side use the wrong apex`,
    wrongSide > 400 && wrongFailures === 0, `${wrongFailures} failures`);
  check("the other isosceles apex would be the arc midpoint there", wrongFailures === 0);

  /* Random S anywhere in the canvas with signed lengths: the page's literal
   * claim fails often, the corrected claim holds exactly on the good side. */
  const rand = rng(9081);
  let rndValid = 0, literalFailures = 0, claimFailures = 0;
  for (let i = 0; i < 2500; i++) {
    const target = P(15 + rand() * 370, 15 + rand() * 270);
    const fresh = C.start();
    if (d(target, fresh.A) < 3 || d(target, fresh.B) < 3) continue;
    const moved = C.move(fresh, "S", target);
    if (moved.S === fresh.S) continue;
    const frac = (rand() - 0.3) * 3;
    const base = Math.min(d(moved.A, moved.S), d(moved.B, moved.S));
    const p = P(moved.B.x + (frac * base / d(moved.B, moved.S)) * (moved.S.x - moved.B.x),
      moved.B.y + (frac * base / d(moved.B, moved.S)) * (moved.S.y - moved.B.y));
    const st = C.move(moved, "C", p), g = C.compute(st);
    if (!g) continue;
    if (!g.claims.pageClaimLiteral) literalFailures++;
    if (!g.Q) continue; // CD < 1: the applet's IsoscelesApex returns null
    if (side(g.A, g.B, g.S) < 0) {
      rndValid++;
      if (!(g.claims.qIsArcMidpoint && g.claims.qSameSideAsS
        && g.measures.arcError <= g.tol && g.measures.qaError <= g.tol)) {
        claimFailures++;
        if (claimFailures < 4) check(`random ${i}: corrected claim`, false);
      }
    }
  }
  check(`${literalFailures} random positions disprove the page's literal claim`,
    literalFailures > 1500 && claimFailures === 0);
  check(`${rndValid} random positions on the good side confirm the corrected claim`,
    rndValid > 400 && claimFailures === 0);

  /* A scale and translation of the whole diagram must preserve the claim. */
  const s0 = C.start(), startG = C.compute(s0);
  const t = (p) => P(2 * p.x + 13, 2 * p.y - 7);
  const scaledState = {
    A: t(s0.A), B: t(s0.B), S: t(s0.S), C: t(s0.C), D: t(s0.D),
    length: 2 * s0.length, options: s0.options, explored: true,
  };
  const scaledG = C.compute(scaledState);
  check("the construction survives scaling and translation",
    !!scaledG && closeP(scaledG.arc, t(startG.arc), 1e-6)
    && closeP(scaledG.Q, t(startG.Q), 1e-6)
    && scaledG.claims.qIsArcMidpoint && scaledG.claims.adEqualsBC);
}

/* --------------------------------------------- 6. degenerate positions */

{
  const s = C.start();
  const bad = C.move(s, "S", P(330, 60));
  check("a constructed picture still exists for a fresh S drag", !!C.compute(bad));
  const zero = C.setOption(s, "hint", false);
  check("turning an option off works", !zero.options.hint);
  check("non-finite C is refused", C.move(s, "C", P(Infinity, 3)) === s);
  check("a non-finite state has no geometry", C.compute({ A: s.A, B: s.B, S: P(NaN, 1), length: 1 }) === null);
  check("a degenerate picture has a helpful status",
    typeof C.describe({}) === "string" && /Move S/.test(C.describe({})));
  check("a degenerate picture still has no result", C.result(zero) === null);
  check("the core has no DOM", typeof globalThis.document === "undefined");
}

done("equiloc-quad-1-tri");
