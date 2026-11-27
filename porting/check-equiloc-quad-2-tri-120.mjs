#!/usr/bin/env node
"use strict";

/*
 * Logic test for equiloc-quad-2-tri-120/equiloc-quad-2-tri-120-core.js.
 *
 *   node porting/check-equiloc-quad-2-tri-120.mjs
 *
 * The cut-the-knot page says that equilateral triangles ACP and BDR on the
 * diagonals of an antiequilic quadrilateral ABCD (AD = BC), drawn towards
 * AB, have the same apex when the sides AD and BC meet at 120 degrees, and
 * that this apex lies on the bisector of angle ASB. This test checks those
 * claims on thousands of dragged positions on both arcs of the circle, and
 * compares every state and every drawn point with a second, independent
 * transcription of the applet's bytecode (init, FromCircle, LocatePoint,
 * UpgradeDistance, RestrictToCircle/Line, Compute, GeoSDoub.Rotate,
 * GeoSDoub.Intersect, InsideTest.IsInside). It also records that the page's
 * opening words about "equal opposite diagonals inclined at 120" are loose:
 * AC and DB are neither equal nor 120 degrees apart in general; AD and BC
 * are the equal sides whose extensions meet at S at 120 degrees on the
 * starting arc.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equiloc-quad-2-tri-120/equiloc-quad-2-tri-120-core.js", "EquilocQuad2Tri120Core");

const P = (x, y) => ({ x, y });
const pi = Math.PI;
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
};
const closeP = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tolOf = (...ps) => 1e-7 * Math.max(1, ...ps.map((p) =>
  Math.max(Math.abs(p.x), Math.abs(p.y))));
const interp = (p, q, t) => P(p.x + t * (q.x - p.x), p.y + t * (q.y - p.y));

/* ------------------------------- the applet's own arithmetic, from bytecode */

const APPLET_CIRCLE = { c: P(400 / 2, (300 * 11) / 20), r: Math.min(400, 300) / 2.7 };

function appletFromCircle(angle) {
  const r = APPLET_CIRCLE.r;
  return P(APPLET_CIRCLE.c.x + r * Math.cos(angle),
    APPLET_CIRCLE.c.y + r * Math.sin(angle));
}

function appletLocate(length, p, q) {
  const dx = q.x - p.x, dy = q.y - p.y;
  const n = Math.sqrt(dx * dx + dy * dy);
  return P(p.x + (length * dx) / n, p.y + (length * dy) / n);
}

function appletRotate(P1, P2, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return P(P1.x + cs * (P2.x - P1.x) - orientation * sn * (P2.y - P1.y),
    P1.y + orientation * sn * (P2.x - P1.x) + cs * (P2.y - P1.y));
}

function appletInside(a, b, c) {
  const dot = (a.x - b.x) * (a.x - c.x) + (a.y - b.y) * (a.y - c.y);
  return dot <= 0;
}

function appletNearest(p, a, b) {
  if ((p.x - a.x) ** 2 + (p.y - a.y) ** 2 < 0.1) return P(p.x, p.y);
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + t * dx, a.y + t * dy);
}

function appletOnCircle(circle, p) {
  const dx = p.x - circle.c.x, dy = p.y - circle.c.y;
  const n = Math.sqrt(dx * dx + dy * dy);
  return P(circle.c.x + (dx * circle.r) / n, circle.c.y + (dy * circle.r) / n);
}

/* GeoSDoub.Intersect: det = a1*b2 - a2*b1; |det| < 1 gives NaN,NaN. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det);
}

function appletInit() {
  const A = appletFromCircle(-2.6179938779914944);
  const B = appletFromCircle(-0.5235987755982988);
  const S = appletFromCircle(-1.6455961518803677);
  const length = Math.min(d(A, S), d(B, S)) / 2;
  return {
    A, B, S, C: appletLocate(length, B, S), D: appletLocate(length, A, S),
    T: P(APPLET_CIRCLE.c.x, APPLET_CIRCLE.c.y + APPLET_CIRCLE.r),
    length, circle: APPLET_CIRCLE,
  };
}

/* Compute(): AdjustC/AdjustD, the four rotates and the unused line crossing. */
function appletCompute(st) {
  const Cc = appletLocate(st.length, st.B, st.S);
  const Dd = appletLocate(st.length, st.A, st.S);
  if (d(Cc, st.S) < 1 || d(Dd, st.S) < 1) return null;
  return {
    C: Cc, D: Dd,
    P: appletRotate(st.A, Cc, 1.0471975511965976, 1),
    R: appletRotate(st.B, Dd, 1.0471975511965976, -1),
    M: appletRotate(st.A, Dd, 1.0471975511965976, 1),
    N: appletRotate(st.B, Cc, 1.0471975511965976, -1),
    K: appletIntersect(st.A, appletRotate(st.A, Dd, 1.0471975511965976, 1),
      st.B, appletRotate(st.B, Cc, 1.0471975511965976, -1)),
  };
}

function appletLengthForC(st, Cc) {
  return (appletInside(st.B, Cc, st.S) ? -1 : 1) * d(st.B, Cc);
}
function appletLengthForD(st, Dd) {
  return (appletInside(st.A, Dd, st.S) ? -1 : 1) * d(st.A, Dd);
}
function appletDragS(st, p) {
  const S = appletOnCircle(st.circle, p);
  if (d(S, st.A) < 1 || d(S, st.B) < 1) return null;
  return Object.assign({}, st, { S,
    C: appletLocate(st.length, st.B, S), D: appletLocate(st.length, st.A, S) });
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

/* ------------------------------------------- 1. the starting configuration */

{
  const s = C.start(), ap = appletInit();
  for (const k of ["A", "B", "S", "C", "D", "T"]) {
    check(`init() puts ${k} where the applet does`, closeP(s[k], ap[k], 1e-9),
      `core ${JSON.stringify(s[k])}, applet ${JSON.stringify(ap[k])}`);
  }
  check("init() uses the applet's circle", closeP(s.circle.c, ap.circle.c, 1e-9)
    && close(s.circle.r, ap.circle.r, 1e-9));
  check("init() uses half the shorter secant as AD = BC",
    close(s.length, ap.length, 1e-9));
  check("A is at -150 degrees and B at -30, unlike the 150/30 of EquilicQuad",
    closeP(s.A, C.fromCircle(-5 * pi / 6), 1e-9)
    && closeP(s.B, C.fromCircle(-pi / 6), 1e-9)
    && d(s.A, C.fromCircle(5 * pi / 6)) > 1);
  check("S starts at -11*pi/21, not the sibling applets' 20*pi/11",
    closeP(s.S, C.fromCircle(-11 * pi / 21), 1e-9)
    && d(s.S, C.fromCircle(20 * pi / 11)) > 1);
  check("T is one radius below the circle centre", closeP(s.T, ap.T, 1e-9));
  check("only the three applet handles can be moved",
    JSON.stringify(C.legalMoves(s)) === JSON.stringify(["S", "C", "D"]));
  check("names start on, construction and hint off",
    s.options.names && !s.options.construction && !s.options.hint);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh picture is not marked explored", !s.explored);
  check("the start drawing exists", !!C.geometry(s));
  const g = C.geometry(s);
  check("the page's claims hold in the starting picture",
    g.claims.apexesCoincide && g.claims.onBisector && g.claims.asbIs120
    && g.claims.towardsAB && g.claims.adEqualsBC);
  check("the starting triangles and ABT are equilateral",
    g.claims.equilateralACP && g.claims.equilateralDBR && g.claims.equilateralABT);
}

/* ---------------------------------------- 2. state changes and edge cases */

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
  check("dragging S onto A or B is refused (the secant collapses)",
    C.move(s, "S", s.A) === s && C.move(s, "S", s.B) === s);
  check("an unknown option is refused", C.setOption(s, "nope", true) === s);
  const withOptions = C.setOption(C.setOption(s, "hint", true), "construction", true);
  check("options change independently",
    withOptions.options.hint && withOptions.options.construction
    && withOptions.options.names);
  const reset = C.reset(withOptions);
  check("Reset restores the drawing but keeps the Show boxes",
    closeP(reset.S, s.S, 1e-9) && reset.options.hint && reset.options.construction);
  check("Reset keeps the explored mark", reset.explored === withOptions.explored);
  check("status describes the meeting point", /P and R meet at one point/.test(C.describe(s)));

  const line = (t) => interp(s.B, s.S, t);
  const before = C.move(s, "C", line(0.8));
  check("dragging C towards S increases AD = BC", before.length > s.length);
  const past = C.move(s, "C", line(-0.5));
  check("dragging C past B makes the common length negative", past.length < 0);
  check("the applet gives the same signed length for that drag",
    close(past.length, appletLengthForC(s, appletNearest(line(-0.5), s.B, s.S)), 1e-9));
  check("with C past B, D is set on the other side of A",
    C.inside(s.A, past.D, s.S) && close(d(s.A, past.D), -past.length, 1e-9));
  check("with a negative common length the tips still meet",
    C.geometry(past).claims.apexesCoincide && C.geometry(past).claims.onBisector);

  const dLine = (t) => interp(s.A, s.S, t);
  const pastD = C.move(s, "D", dLine(-0.7));
  check("dragging D past A also makes the common length negative", pastD.length < 0);
  check("the applet gives the same signed length for the D drag",
    close(pastD.length, appletLengthForD(s, appletNearest(dLine(-0.7), s.A, s.S)), 1e-9));
  check("one unit away from A the construction still exists",
    !!C.geometry(C.move(s, "S", C.fromCircle(-5 * pi / 6 - 0.012))));
  const nearS = C.move(s, "C", P(s.S.x - 0.2, s.S.y));
  check("C within one unit of S makes the drawing unavailable",
    C.geometry(nearS) === null);
  check("a degenerate drawing has a helpful status", /Move S, C or D/.test(C.describe(nearS)));
  check("a degenerate drawing is still not a win or a loss", C.result(nearS) === null);
  check("describe works on an empty state", typeof C.describe({}) === "string");
}

/* ------------------------- 3. the second transcription over many drags */

{
  const rand = rng(12021);
  let comparedStates = 0, comparedGeometry = 0, mismatches = 0;
  const compareState = (label, cs, as) => {
    const tol = 1e-7;
    for (const k of ["A", "B", "S", "C", "D", "T"]) {
      if (!closeP(cs[k], as[k], tol)) {
        mismatches++;
        check(`${label}: ${k} matches the applet`, false,
          `core ${JSON.stringify(cs[k])}, applet ${JSON.stringify(as[k])}`);
      }
    }
    if (!close(cs.length, as.length, tol)) {
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
    for (const k of ["C", "D", "P", "R", "M", "N", "K"]) {
      const tol = tolOf(g[k], ap[k]);
      if (!closeP(g[k], ap[k], tol)) {
        mismatches++;
        check(`${label}: ${k} matches the applet's Compute`, false,
          `core ${JSON.stringify(g[k])}, applet ${JSON.stringify(ap[k])}`);
      }
    }
    comparedGeometry++;
  };

  /* S goes all the way round the circle; C and D are then dragged both
   * towards S and past their vertices. The half-angle offset avoids A and B,
   * where the applet's own secant collapses. */
  for (let i = 0; i < 720; i++) {
    const angle = ((i + 0.5) * 2 * pi) / 720;
    const target = P(200 + 111.1111111111111 * Math.cos(angle),
      165 + 111.1111111111111 * Math.sin(angle));
    const as0 = appletInit();
    if (d(target, as0.A) < 1.2 || d(target, as0.B) < 1.2) continue;
    const cs = C.move(C.start(), "S", target), as = appletDragS(as0, target);
    compareState(`S angle ${i}`, cs, as);
    compareGeometry(`S angle ${i}`, cs, as);

    for (const t of [-1.4, 0.35, 0.9]) {
      const cTarget = interp(as.B, as.S, t);
      const cc = C.move(cs, "C", cTarget), ac = appletDragC(as, cTarget);
      compareState(`C drag ${i}/${t}`, cc, ac);
      compareGeometry(`C drag ${i}/${t}`, cc, ac);

      const dTarget = interp(as.A, as.S, -t);
      const dd = C.move(cs, "D", dTarget), ad = appletDragD(as, dTarget);
      compareState(`D drag ${i}/${t}`, dd, ad);
      compareGeometry(`D drag ${i}/${t}`, dd, ad);
    }
  }
  check(`${comparedStates} drags match the bytecode transcription`, comparedStates > 4000
    && mismatches === 0, `${mismatches} mismatches`);
  check(`${comparedGeometry} drawings match the applet's Compute`, comparedGeometry > 4000
    && mismatches === 0, `${mismatches} mismatches`);

  /* Off-line pointer positions must snap to the secant exactly as the applet
   * does, including its 0.1 squared-distance guard. */
  for (let i = 0; i < 400; i++) {
    const p = P(20 + rand() * 360, 20 + rand() * 260);
    const cs = C.move(C.start(), "C", p), ac = appletDragC(appletInit(), p);
    compareState(`free C pointer ${i}`, cs, ac);
    const ds = C.move(C.start(), "D", p), ads = appletDragD(appletInit(), p);
    compareState(`free D pointer ${i}`, ds, ads);
  }
  check("off-line pointers snap to the two secants as the applet does", mismatches === 0);
}

/* ----------------------------------------- 4. every claim in the article */

{
  const radius = APPLET_CIRCLE.r;
  let arc120 = 0, arc60 = 0, failures = 0, coincident60 = 0, diagNot120 = 0;
  let towardsCount = 0, notTowards = 0;

  const verify = (label, g, want120) => {
    if (!g) return;
    const m = g.measures, cl = g.claims;
    const scale = Math.max(1, d(g.A, g.B), d(g.P, g.R), d(g.S, g.T));
    const tol = 1e-6 * scale;
    /* These four triangles stay equilateral and AD = BC on both arcs: the
     * rotations and the equal signed length do not depend on the arc. */
    if (!(m.acpError <= tol && m.dbrError <= tol && m.admError <= tol
      && m.bcnError <= tol && m.abtError <= tol && m.adbcError <= tol)) {
      failures++;
      check(`${label}: triangles stay equilateral and AD = BC`, false,
        JSON.stringify(m));
    }
    if (cl.asbIs120 !== want120) {
      failures++;
      check(`${label}: the angle at S is ${want120 ? 120 : 60}`, false,
        JSON.stringify(cl));
    }
    if (want120 && !(m.prError <= tol && m.bisError <= tol
      && cl.apexesCoincide && cl.onBisector)) {
      failures++;
      check(`${label}: the two tips meet on the bisector`, false, JSON.stringify(m));
    }
    if (!want120 && !(m.prError > 1e-3 && !cl.apexesCoincide)) {
      failures++;
      check(`${label}: the two tips come apart`, false, JSON.stringify(m));
    }
  };

  for (let deg = 0; deg < 360; deg++) {
    if (Math.abs(deg - 210) < 2 || Math.abs(deg - 330) < 2) continue;
    const onStartingArc = deg > 210 && deg < 330;
    const rad = (deg * pi) / 180;
    for (let j = 1; j <= 9; j++) {
      const target = P(APPLET_CIRCLE.c.x + radius * Math.cos(rad),
        APPLET_CIRCLE.c.y + radius * Math.sin(rad));
      const s0 = C.move(C.start(), "S", target);
      const frac = j / 10;
      const length = frac * d(s0.B, s0.S);
      const cTarget = interp(s0.B, s0.S, frac);
      const st = C.move(s0, "C", cTarget);
      if (Math.abs(st.length - length) > 1e-6) {
        failures++;
        check(`${deg} deg ${frac}: the requested length was set`, false);
      }
      const g = C.geometry(st);
      if (!g) continue;
      if (onStartingArc) arc120++; else arc60++;
      if (Math.abs(g.measures.diagAngle - 120) > 1) diagNot120++;
      if (g.claims.towardsAB) towardsCount++; else notTowards++;
      verify(`${deg} deg, ${frac} of BC`, g, onStartingArc);
      if (!onStartingArc && g.claims.apexesCoincide) coincident60++;
    }
  }
  check(`${arc120} positions on the 120-degree arc satisfy every page claim`,
    arc120 > 1000 && failures === 0, `${failures} failures`);
  check(`${arc60} positions on the other arc have a 60-degree angle and separate tips`,
    arc60 > 2000 && coincident60 === 0 && failures === 0,
    `${coincident60} accidental coincidences, ${failures} failures`);
  check(`the two drawn diagonals are not 120 degrees apart in ${diagNot120} cases`,
    diagNot120 > (arc120 + arc60) * 0.9);
  check("the triangles face AB on the starting arc and not on the other one",
    towardsCount >= arc120 && notTowards > 0);

  /* When C = B and D = A (t = 0) both tips equal T, even on the other arc. */
  const zero = C.move(C.start(), "C", C.start().B);
  const zeroG = C.geometry(zero);
  check("with equal length zero the two tips meet at T",
    !!zeroG && zeroG.claims.apexesCoincide
    && d(zeroG.P, zeroG.T) < 1e-6);
  const otherArc = C.move(C.start(), "S", P(200 + radius * Math.cos(pi / 2),
    165 + radius * Math.sin(pi / 2)));
  const otherZero = C.move(otherArc, "C", otherArc.B);
  const otherZeroG = C.geometry(otherZero);
  check("the same is true on the other arc",
    !!otherZeroG && otherZeroG.claims.apexesCoincide
    && d(otherZeroG.P, otherZeroG.T) < 1e-6);
  check("the applet hides R's name when the tips drift apart",
    (() => {
      const g = C.geometry(otherArc);
      return !!g && g.showR === (d(g.P, g.R) <= 10);
    })());
  check("the status reports the separate tips on the other arc",
    /units apart/.test(C.describe(otherArc)));
  check("the start status reports the common tip and the 120-degree angle",
    /meet at one point.*120/.test(C.describe(C.start())));
  check("the core has no DOM", typeof globalThis.document === "undefined");
}

done("equiloc-quad-2-tri-120");
