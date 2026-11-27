#!/usr/bin/env node
"use strict";

/*
 * Logic test for equiloc-quad-2-tri/equiloc-quad-2-tri-core.js.
 *
 *   node porting/check-equiloc-quad-2-tri.mjs
 *
 * The page claims that, in a quadrilateral ABCD with AD = BC, the midpoints
 * K, L, M, N give a rhombus KMLN, and that in an equilic quadrilateral it is
 * two equilateral triangles; it also says the 60-degree angle is not needed
 * for the rhombus. This test checks those claims over every dragged position
 * and over arbitrary quadrilaterals with AD = BC. It records three typos on
 * the page (the midpoint list, the triangle KMN, and the midline bases), and
 * compares every drag and every drawing with a second, literal transcription
 * of EquilocQuad2TriCanvas's bytecode (init, FromCircle, LocatePoint,
 * UpgradeDistance, RestrictToCircle/Line, Compute and InsideTest.IsInside).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equiloc-quad-2-tri/equiloc-quad-2-tri-core.js", "EquilocQuad2TriCore");

const P = (x, y) => ({ x, y });
const pi = Math.PI;
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closeP = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tolOf = (p, q) => 1e-8 * Math.max(1, Math.abs(p.x), Math.abs(p.y),
  Math.abs(q.x), Math.abs(q.y));

/* -------------------------- the applet's arithmetic, straight from bytecode */

const APPLET_CIRCLE = {
  c: P(400 / 2, (300 * 11) / 20),
  r: Math.min(400, 300) / 2.7,
};

/* EquilocQuad2TriCanvas.FromCircle: radius * (cos a, sin a) from the centre. */
function appletFromCircle(angle) {
  const r = APPLET_CIRCLE.r;
  return P(APPLET_CIRCLE.c.x + r * Math.cos(angle),
    APPLET_CIRCLE.c.y + r * Math.sin(angle));
}

/* LocatePoint(length, p, q): new DoubPoint(p.x + length*dx/sqrt(dx*dx+dy*dy), ...). */
function appletLocate(length, p, q) {
  const dx = q.x - p.x, dy = q.y - p.y;
  const n = Math.sqrt(dx * dx + dy * dy);
  return P(p.x + (length * dx) / n, p.y + (length * dy) / n);
}

const appletMid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);

/* InsideTest.IsInside(a,b,c): (a-b)·(a-c) dcmpg 0; <= 0 means true. */
function appletInside(a, b, c) {
  return (a.x - b.x) * (a.x - c.x) + (a.y - b.y) * (a.y - c.y) <= 0;
}

/* GeoSDoub.NearestPoint(p,a,b): SqDist(p,a) < 0.1 returns p unchanged. */
function appletNearest(p, a, b) {
  const sq = (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
  if (sq < 0.1) return P(p.x, p.y);
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + t * dx, a.y + t * dy);
}

/* CTKMoveableDoub.UpdateLocation with RestrictToCircle. */
function appletOnCircle(circle, p) {
  const dist = Math.sqrt((p.x - circle.c.x) ** 2 + (p.y - circle.c.y) ** 2);
  return P(circle.c.x + ((p.x - circle.c.x) * circle.r) / dist,
    circle.c.y + ((p.y - circle.c.y) * circle.r) / dist);
}

/* EquilocQuad2TriCanvas.init() on a 400 by 300 canvas. */
function appletInit() {
  const A = appletFromCircle(2.6179938779914944);
  const B = appletFromCircle(0.5235987755982988);
  const S = appletFromCircle(5.711986642890533);
  const length = Math.min(d(A, S), d(B, S)) / 2;
  return { A, B, S, C: appletLocate(length, B, S), D: appletLocate(length, A, S),
    length, circle: APPLET_CIRCLE };
}

/* EquilocQuad2TriCanvas.Compute(): AdjustC/AdjustD and the four midpoints. */
function appletCompute(st) {
  if (d(st.C, st.S) < 1 || d(st.D, st.S) < 1) return null;
  const Cc = appletLocate(st.length, st.B, st.S);
  const Dd = appletLocate(st.length, st.A, st.S);
  return {
    C: Cc, D: Dd,
    K: appletMid(st.A, Cc), L: appletMid(st.B, Dd),
    M: appletMid(st.A, st.B), N: appletMid(Cc, Dd),
  };
}

/* UpgradeDistance() after a C or D drag, with the applet's sign choice. */
const appletLengthForC = (st, Cc) => (appletInside(st.B, Cc, st.S) ? -1 : 1) * d(st.B, Cc);
const appletLengthForD = (st, Dd) => (appletInside(st.A, Dd, st.S) ? -1 : 1) * d(st.A, Dd);

function appletDragS(st, p) {
  const S = appletOnCircle(st.circle, p);
  return Object.assign({}, st, {
    S, C: appletLocate(st.length, st.B, S), D: appletLocate(st.length, st.A, S),
  });
}
function appletDragC(st, p) {
  const Cc = appletNearest(p, st.B, st.S);
  const length = appletLengthForC(st, Cc);
  return Object.assign({}, st, { C: Cc, length, D: appletLocate(length, st.A, st.S) });
}
function appletDragD(st, p) {
  const Dd = appletNearest(p, st.A, st.S);
  const length = appletLengthForD(st, Dd);
  return Object.assign({}, st, { D: Dd, length, C: appletLocate(length, st.B, st.S) });
}

/* The page's literal (mistyped) midpoint list, to show it is not a rhombus. */
function pageMidpoints(A, B, C, D) {
  return { Kp: appletMid(A, C), Lp: appletMid(A, B),
    Mp: appletMid(B, D), Np: appletMid(A, D) };
}

/* ------------------------------------------ 1. the start picture and the rules */

{
  const s = C.start(), ap = appletInit();
  for (const k of ["A", "B", "S", "C", "D"]) {
    check(`init() puts ${k} where the applet does`, closeP(s[k], ap[k], 1e-9),
      `core ${JSON.stringify(s[k])}, applet ${JSON.stringify(ap[k])}`);
  }
  check("init() uses the applet's circle", closeP(s.circle.c, ap.circle.c, 1e-9)
    && close(s.circle.r, ap.circle.r, 1e-9));
  check("init() uses half the shorter secant as AD = BC",
    close(s.length, ap.length, 1e-9));
  check("A and B sit at 150 and 30 degrees",
    closeP(s.A, C.fromCircle(5 * pi / 6), 1e-9)
    && closeP(s.B, C.fromCircle(pi / 6), 1e-9));
  check("S starts at 20*pi/11 on the circle",
    closeP(s.S, C.fromCircle(20 * pi / 11), 1e-9));
  equal("only the three applet handles can be moved", C.legalMoves(s), ["S", "C", "D"]);
  check("names start on, construction and hint off",
    s.options.names && !s.options.construction && !s.options.hint);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh picture is not marked explored", !s.explored);
  const g = C.geometry(s);
  check("the start geometry exists and is a rhombus", !!g && g.claims.rhombus);
  check("the four drawn sides have the applet's midpoints",
    !!g && closeP(g.K, appletMid(s.A, s.C), 1e-9)
    && closeP(g.L, appletMid(s.B, s.D), 1e-9)
    && closeP(g.M, appletMid(s.A, s.B), 1e-9)
    && closeP(g.N, appletMid(s.C, s.D), 1e-9));
  check("Show construction has the applet's ten strokes",
    !!g && g.construction.length === 10);
}

/* -------------------------------------------- 2. drags, options and edge cases */

{
  const s = C.start();
  const moved = C.move(s, "S", P(200, 30));
  check("dragging S leaves the starting state alone", s.S.y !== moved.S.y);
  check("dragging S marks the picture explored", moved.explored && !s.explored);
  check("dragging S keeps it exactly on the applet's circle",
    close(d(moved.S, s.circle.c), s.circle.r, 1e-9));
  check("moving an unknown handle is refused", C.move(s, "A", P(1, 2)) === s);
  check("moving to a non-finite point is refused", C.move(s, "C", P(NaN, 2)) === s);
  check("dragging S to the circle's centre is refused", C.move(s, "S", s.circle.c) === s);
  check("an unknown option is refused", C.setOption(s, "nope", true) === s);
  const withOptions = C.setOption(C.setOption(s, "hint", true), "construction", true);
  check("options change independently",
    withOptions.options.hint && withOptions.options.construction
    && withOptions.options.names);
  const reset = C.reset(withOptions);
  check("Reset restores the drawing but keeps the Show boxes",
    closeP(reset.S, s.S, 1e-9) && reset.options.hint && reset.options.construction);
  check("Reset keeps the explored mark", reset.explored === withOptions.explored);
  check("status describes the rhombus", /KMLN is a rhombus/.test(C.describe(s)));

  const line = (t) => P(s.B.x + t * (s.S.x - s.B.x), s.B.y + t * (s.S.y - s.B.y));
  const before = C.move(s, "C", line(0.8));
  check("dragging C towards S increases AD = BC", before.length > s.length);
  const past = C.move(s, "C", line(-0.5));
  check("dragging C past B makes the common length negative", past.length < 0);
  check("the applet gives the same signed length for that drag",
    close(past.length, appletLengthForC(s, appletNearest(line(-0.5), s.B, s.S)), 1e-9));
  check("with C past B, D is set on the other side of A",
    C.inside(s.A, past.D, s.S) && close(d(s.A, past.D), -past.length, 1e-9));
  check("with C past B, KMLN is still a rhombus", C.geometry(past).claims.rhombus);
}

/* -------------------------------- 3. the second transcription over many drags */

{
  const rand = rng(4512);
  let comparedStates = 0, comparedGeometry = 0, mismatches = 0;
  const compareState = (label, coreState, appletState) => {
    const tol = 1e-7;
    for (const k of ["A", "B", "S", "C", "D"]) {
      if (!closeP(coreState[k], appletState[k], tol)) {
        mismatches++;
        check(`${label}: ${k} matches the applet`, false,
          `core ${JSON.stringify(coreState[k])}, applet ${JSON.stringify(appletState[k])}`);
      }
    }
    if (!close(coreState.length, appletState.length, tol)) {
      mismatches++;
      check(`${label}: signed AD=BC matches UpgradeDistance`, false);
    }
    comparedStates++;
  };
  const compareGeometry = (label, coreState, appletState) => {
    const g = C.geometry(coreState), ap = appletCompute(appletState);
    if (!g || !ap) {
      if (!!g !== !!ap) {
        mismatches++;
        check(`${label}: the same degenerate guard`, false);
      }
      return;
    }
    for (const k of ["C", "D", "K", "L", "M", "N"]) {
      const tol = tolOf(g[k], ap[k]);
      if (!closeP(g[k], ap[k], tol)) {
        mismatches++;
        check(`${label}: ${k} matches the applet's Compute`, false,
          `core ${JSON.stringify(g[k])}, applet ${JSON.stringify(ap[k])}`);
      }
    }
    comparedGeometry++;
  };

  for (let i = 0; i < 720; i++) {
    /* Half-step offset keeps S away from A and B, where the applet's own
     * secant collapses and its LocatePoint divides by (almost) zero. */
    const angle = ((i + 0.5) * 2 * pi) / 720;
    const target = P(200 + 111.111 * Math.cos(angle), 165 + 111.111 * Math.sin(angle));
    const ap0 = appletInit();
    if (d(target, ap0.A) < 1.2 || d(target, ap0.B) < 1.2) continue;
    const cs = C.move(C.start(), "S", target), as = appletDragS(ap0, target);
    compareState(`S angle ${i}`, cs, as);
    compareGeometry(`S angle ${i}`, cs, as);

    const t = -1.5 + (i % 9) * 0.4;
    const cTarget = P(as.B.x + t * (as.S.x - as.B.x), as.B.y + t * (as.S.y - as.B.y));
    const cc = C.move(cs, "C", cTarget), ac = appletDragC(as, cTarget);
    compareState(`C drag ${i}`, cc, ac);
    compareGeometry(`C drag ${i}`, cc, ac);

    const u = -1.2 + (i % 7) * 0.35;
    const dTarget = P(as.A.x + u * (as.S.x - as.A.x), as.A.y + u * (as.S.y - as.A.y));
    const dd = C.move(cs, "D", dTarget), ad = appletDragD(as, dTarget);
    compareState(`D drag ${i}`, dd, ad);
    compareGeometry(`D drag ${i}`, dd, ad);
  }
  check(`${comparedStates} drags match the bytecode transcription`, comparedStates > 2000
    && mismatches === 0, `${mismatches} mismatches`);
  check(`${comparedGeometry} drawings match the applet's Compute`, comparedGeometry > 1500
    && mismatches === 0);

  for (let i = 0; i < 300; i++) {
    const p = P(20 + rand() * 360, 20 + rand() * 260);
    compareState(`free C pointer ${i}`, C.move(C.start(), "C", p),
      appletDragC(appletInit(), p));
  }
  check("a pointer off the secant snaps to it as the applet does", mismatches === 0);
}

/* ------------------------------------------------ 4. the page's claims, checked */

{
  let counted = 0, failures = 0, equilateral = 0;
  const verify = (label, g) => {
    if (!g) return;
    const m = g.measures, cl = g.claims;
    const tol = 1e-7 * Math.max(1, m.ad, m.bc, m.side);
    if (!(cl.rhombus && cl.adEqualsBC && cl.midlinesEqual && cl.oppositeParallel
      && close(m.kmVsBC, 0, tol) && close(m.lnVsBC, 0, tol)
      && close(m.mlVsAD, 0, tol) && close(m.nkVsAD, 0, tol)
      && close(m.sideSpread, 0, tol))) {
      failures++;
      check(`${label}: the rhombus claim holds`, false, JSON.stringify(m));
    }
    if (cl.equilic && !(cl.equilateralKML || cl.equilateralKMN)) {
      failures++;
      check(`${label}: an equilic rhombus splits into two equilateral triangles`, false);
    }
    if (cl.equilic) equilateral++;
  };

  for (let deg = 0; deg < 360; deg++) {
    for (let j = 1; j <= 10; j++) {
      const angle = ((deg + (j % 3) / 3) * pi) / 180;
      const target = P(200 + (300 / 2.7) * Math.cos(angle), 165 + (300 / 2.7) * Math.sin(angle));
      const s0 = C.move(C.start(), "S", target);
      const frac = j / 11;
      const length = frac * Math.min(d(s0.A, s0.S), d(s0.B, s0.S));
      const cTarget = P(s0.B.x + (length / d(s0.B, s0.S)) * (s0.S.x - s0.B.x),
        s0.B.y + (length / d(s0.B, s0.S)) * (s0.S.y - s0.B.y));
      const st = C.move(s0, "C", cTarget);
      const g = C.geometry(st);
      if (!g) continue;
      counted++;
      verify(`${deg} deg, ${frac} of BC`, g);
    }
  }
  check(`${counted} dragged pictures keep AD = BC and KMLN a rhombus`,
    counted > 3000 && failures === 0, `${failures} failures`);
  check(`${equilateral} pictures have a 60-degree line angle and two equilateral halves`,
    equilateral === counted && failures === 0);

  /* The rhombus needs only AD = BC, not the circle or the 60-degree angle.
   * Build arbitrary quadrilaterals with those two sides equal. */
  const rand = rng(91125);
  let general = 0;
  for (let i = 0; i < 2000; i++) {
    const A = P(10 + rand() * 380, 10 + rand() * 280);
    const B = P(10 + rand() * 380, 10 + rand() * 280);
    const length = 10 + rand() * 120;
    const dirC = rand() * 2 * pi, dirD = rand() * 2 * pi;
    const Cc = P(B.x + length * Math.cos(dirC), B.y + length * Math.sin(dirC));
    const Dd = P(A.x + length * Math.cos(dirD), A.y + length * Math.sin(dirD));
    const K = appletMid(A, Cc), L = appletMid(B, Dd);
    const M = appletMid(A, B), N = appletMid(Cc, Dd);
    const sides = [d(K, M), d(M, L), d(L, N), d(N, K)];
    const spread = Math.max(...sides) - Math.min(...sides);
    const par = Math.abs(((M.x - K.x) * (Cc.y - B.y) - (M.y - K.y) * (Cc.x - B.x)))
      / Math.max(1, d(B, Cc));
    if (spread > 1e-8 || par > 1e-8) {
      failures++;
      check(`general quadrilateral ${i}: KMLN is a rhombus`, false,
        `spread ${spread}, parallel error ${par}`);
    }
    general++;
  }
  check(`${general} arbitrary quadrilaterals with AD = BC give a rhombus`,
    general === 2000 && failures === 0);

  /* Three places where the printed page disagrees with the applet's code. */
  const g0 = C.geometry(C.start()), ap0 = appletInit();
  const page = pageMidpoints(ap0.A, ap0.B, ap0.C, ap0.D);
  const pageSides = [d(page.Kp, page.Mp), d(page.Mp, page.Lp),
    d(page.Lp, page.Np), d(page.Np, page.Kp)];
  check("the page's listed midpoints do NOT give a rhombus (typo in the list)",
    Math.max(...pageSides) - Math.min(...pageSides) > 1);
  check("the applet's midpoint list does give a rhombus",
    g0.claims.rhombus && g0.measures.sideSpread < 1e-9);
  check("the page's ΔKMN is not equilateral at the start (it should say ΔKLM)",
    !!g0 && !g0.claims.equilateralKMN && g0.claims.equilateralKML);
  check("the rhombus sides have bases BC and AD, not CD and BC",
    close(g0.measures.kmVsBC, 0, 1e-9) && close(g0.measures.lnVsBC, 0, 1e-9)
    && close(g0.measures.mlVsAD, 0, 1e-9) && close(g0.measures.nkVsAD, 0, 1e-9));
}

/* --------------------------------------------------- 5. degenerate positions */

{
  const s = C.start();
  check("dragging S onto B is refused (the secant would collapse)",
    C.move(s, "S", s.B) === s);
  check("dragging S onto A is refused (the secant would collapse)",
    C.move(s, "S", s.A) === s);
  const nearS = C.move(s, "C", P(s.S.x - 0.2, s.S.y));
  check("C within one unit of S makes the applet's Compute return early",
    C.geometry(nearS) === null
    && appletCompute(appletDragC(appletInit(), P(s.S.x - 0.2, s.S.y))) === null);
  check("a degenerate picture has a helpful status", /Move S, C or D/.test(C.describe(nearS)));
  check("a degenerate picture is still not a win or a loss", C.result(nearS) === null);
  check("describe works on an empty state", typeof C.describe({}) === "string");
  check("the core has no DOM", typeof globalThis.document === "undefined");
}

done("equiloc-quad-2-tri");
