#!/usr/bin/env node
"use strict";

/*
 * Logic test for equilic-quad/equilic-quad-core.js.
 *
 *   node porting/check-equilic-quad.mjs
 *
 * The cut-the-knot page claims that when equilateral triangles are drawn on
 * AC, DC and DB (away from AB) of an equilic quadrilateral ABCD, their apexes
 * P, Q, R are collinear; it also says that S (the intersection of AD and BC
 * extended) lies on that line, that AQB is equilateral, and that PQ = BC and
 * QR = AD. This test checks every one of those on hundreds of dragging
 * positions, records the arc on which the proof's AQB step fails while the
 * main claim still holds, and compares the whole construction with a second,
 * independent transcription of EquilicQuadCanvas's bytecode (init, FromCircle,
 * LocatePoint, UpgradeDistance, RestrictToCircle/Line and Compute, plus
 * GeoSDoub.Rotate and InsideTest.IsInside).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equilic-quad/equilic-quad-core.js", "EquilicQuadCore");

const P = (x, y) => ({ x, y });
const pi = Math.PI;
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closeP = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tolOf = (p, q) => 1e-8 * Math.max(1, Math.abs(p.x), Math.abs(p.y), Math.abs(q.x), Math.abs(q.y));

/* --------------------------------- the applet's own arithmetic, from bytecode */

/* DoubCircle in EquilicQuadCanvas.init() on a 400 by 300 canvas. */
const APPLET_CIRCLE = {
  c: P(400 / 2, (300 * 11) / 20),
  r: Math.min(400, 300) / 2.7,
};

/* EquilicQuadCanvas.FromCircle: radius * (cos a, sin a) from the centre. */
function appletFromCircle(angle) {
  const r = APPLET_CIRCLE.r;
  return P(APPLET_CIRCLE.c.x + r * Math.cos(angle),
    APPLET_CIRCLE.c.y + r * Math.sin(angle));
}

/* EquilicQuadCanvas.LocatePoint(length, p, q): dx = q.x - p.x, then
 * new DoubPoint(p.x + length*dx/sqrt(dx*dx+dy*dy), ...). */
function appletLocate(length, p, q) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const n = Math.sqrt(dx * dx + dy * dy);
  return P(p.x + (length * dx) / n, p.y + (length * dy) / n);
}

/* GeoSDoub.Rotate(P1, P2, angle, orientation), bytecode verbatim. */
function appletRotate(P1, P2, angle, orientation) {
  const cs = Math.cos(angle);
  const sn = Math.sin(angle);
  const x = P1.x + cs * (P2.x - P1.x) - orientation * sn * (P2.y - P1.y);
  const y = P1.y + orientation * sn * (P2.x - P1.x) + cs * (P2.y - P1.y);
  return P(x, y);
}

/* InsideTest.IsInside(a,b,c): (a-b)·(a-c) dcmpg 0; <= 0 means true. */
function appletInside(a, b, c) {
  const dot = (a.x - b.x) * (a.x - c.x) + (a.y - b.y) * (a.y - c.y);
  return dot <= 0;
}

/* GeoSDoub.NearestPoint(p,a,b): SqDist(p,a) < 0.1 returns p unchanged. */
function appletNearest(p, a, b) {
  const sq = (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
  if (sq < 0.1) return P(p.x, p.y);
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + t * dx, a.y + t * dy);
}

/* CTKMoveableDoub.UpdateLocation with RestrictToCircle: add the defect,
 * then scale the radius from the circle's centre. */
function appletOnCircle(circle, p) {
  const r = circle.r;
  const dist = Math.sqrt((p.x - circle.c.x) ** 2 + (p.y - circle.c.y) ** 2);
  return P(circle.c.x + ((p.x - circle.c.x) * r) / dist,
    circle.c.y + ((p.y - circle.c.y) * r) / dist);
}

/* EquilicQuadCanvas.init(), then its first Compute(). */
function appletInit() {
  const A = appletFromCircle(2.6179938779914944);
  const B = appletFromCircle(0.5235987755982988);
  const S = appletFromCircle(5.711986642890533);
  const length = Math.min(d(A, S), d(B, S)) / 2;
  const C = appletLocate(length, B, S);
  const D = appletLocate(length, A, S);
  return { A, B, S, C, D, length, circle: APPLET_CIRCLE };
}

/* EquilicQuadCanvas.Compute(): the guard, AdjustC/AdjustD and three rotates. */
function appletCompute(st) {
  if (d(st.C, st.S) < 1 || d(st.D, st.S) < 1) return null;
  const Cc = appletLocate(st.length, st.B, st.S);
  const Dd = appletLocate(st.length, st.A, st.S);
  return {
    C: Cc, D: Dd,
    P: appletRotate(st.A, Cc, 1.0471975511965976, -1),
    Q: appletRotate(Dd, Cc, 1.0471975511965976, -1),
    R: appletRotate(Dd, st.B, 1.0471975511965976, -1),
  };
}

/* UpgradeDistance() after a C or D drag, with the applet's sign choice. */
function appletLengthForC(st, Cc) {
  return (appletInside(st.B, Cc, st.S) ? -1 : 1) * d(st.B, Cc);
}
function appletLengthForD(st, Dd) {
  return (appletInside(st.A, Dd, st.S) ? -1 : 1) * d(st.A, Dd);
}

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

/* ------------------------------------------------ 1. start position and rules */

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
  check("A and B sit at 150 and 30 degrees on the circle",
    close(C.fromCircle(5 * pi / 6).x, s.A.x, 1e-9)
    && close(C.fromCircle(pi / 6).y, s.B.y, 1e-9));
  check("S starts at 20*pi/11 on the circle", closeP(s.S, C.fromCircle(20 * pi / 11), 1e-9));
  check("only the three applet handles can be moved",
    JSON.stringify(C.legalMoves(s)) === JSON.stringify(["S", "C", "D"]));
  check("names start on, construction and hint off",
    s.options.names && !s.options.construction && !s.options.hint);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh picture is not marked explored", !s.explored);
  check("the start geometry exists", !!C.geometry(s));
  check("the start picture has the page's collinear points",
    C.geometry(s).claims.collinearPQR && C.geometry(s).claims.collinearS);
}

/* ------------------------------------------ 2. state changes and edge cases */

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
  check("status describes the straight line",
    /P, Q, R and S lie on one straight line/.test(C.describe(s)));

  /* A C drag sets the signed common length, including past B (negative). */
  const line = (t) => P(s.B.x + t * (s.S.x - s.B.x), s.B.y + t * (s.S.y - s.B.y));
  const before = C.move(s, "C", line(0.8));
  check("dragging C towards S increases AD = BC", before.length > s.length);
  const past = C.move(s, "C", line(-0.5));
  check("dragging C past B makes the common length negative", past.length < 0);
  check("the applet gives the same signed length for that drag",
    close(past.length, appletLengthForC(s, appletNearest(line(-0.5), s.B, s.S)), 1e-9));
  check("with C past B, D is set on the other side of A",
    C.inside(s.A, past.D, s.S) && close(d(s.A, past.D), -past.length, 1e-9));
  check("with C past B, P Q R S are still in a line",
    C.geometry(past).claims.collinearPQR && C.geometry(past).claims.collinearS);
}

/* ------------------------------ 3. the second transcription over many drags */

{
  const rand = rng(4411);
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
    for (const k of ["C", "D", "P", "Q", "R"]) {
      const tol = tolOf(g[k], ap[k]);
      if (!closeP(g[k], ap[k], tol)) {
        mismatches++;
        check(`${label}: ${k} matches the applet's Compute`, false,
          `core ${JSON.stringify(g[k])}, applet ${JSON.stringify(ap[k])}`);
      }
    }
    comparedGeometry++;
  };

  /* S goes all the way round the circle, then C and D are dragged past or
   * towards S. Every position is checked against the bytecode transcription. */
  for (let i = 0; i < 720; i++) {
    /* Half-step offset keeps S away from A and B, where the applet's own
     * secant becomes zero length and its arithmetic overflows. */
    const angle = ((i + 0.5) * 2 * pi) / 720;
    const target = P(200 + 111.111 * Math.cos(angle), 165 + 111.111 * Math.sin(angle));
    /* The port deliberately refuses S within one unit of A or B: the
     * applet's secant collapses there. Do not compare that refused drag. */
    const ap0 = appletInit();
    if (d(target, ap0.A) < 1.2 || d(target, ap0.B) < 1.2) continue;
    const cs = C.move(C.start(), "S", target);
    const as = appletDragS(appletInit(), target);
    compareState(`S angle ${i}`, cs, as);
    compareGeometry(`S angle ${i}`, cs, as);

    const t = -1.5 + ((i % 9) * 0.4);
    const cTarget = P(as.B.x + t * (as.S.x - as.B.x), as.B.y + t * (as.S.y - as.B.y));
    const cc = C.move(cs, "C", cTarget), ac = appletDragC(as, cTarget);
    compareState(`C drag ${i}`, cc, ac);
    compareGeometry(`C drag ${i}`, cc, ac);

    const u = -1.2 + ((i % 7) * 0.35);
    const dTarget = P(as.A.x + u * (as.S.x - as.A.x), as.A.y + u * (as.S.y - as.A.y));
    const dd = C.move(cs, "D", dTarget), ad = appletDragD(as, dTarget);
    compareState(`D drag ${i}`, dd, ad);
    compareGeometry(`D drag ${i}`, dd, ad);
  }
  check(`${comparedStates} drags match the bytecode transcription`, comparedStates > 2000
    && mismatches === 0, `${mismatches} mismatches`);
  check(`${comparedGeometry} drawings match the applet's Compute`, comparedGeometry > 1500
    && mismatches === 0);

  /* A few off-line pointer positions must use the applet's projection. */
  for (let i = 0; i < 300; i++) {
    const p = P(20 + rand() * 360, 20 + rand() * 260);
    const cs = C.move(C.start(), "C", p), ac = appletDragC(appletInit(), p);
    compareState(`free C pointer ${i}`, cs, ac);
  }
  check("a pointer off the secant snaps to it as the applet does", mismatches === 0);
}

/* -------------------------------------------- 4. every claim in the article */

{
  const ap = appletInit();
  let major = 0, minor = 0, away = 0, aqbMajor = 0, aqbMinor = 0;
  let signed = 0, failures = 0;
  const verify = (label, g, wantAway, wantAQB) => {
    if (!g) return;
    const m = g.measures, cl = g.claims;
    const scale = Math.max(1, d(g.A, g.B), d(g.P, g.Q), d(g.Q, g.R), d(g.P, g.S));
    const tol = 1e-7 * scale;
    if (!(m.pqrError <= tol && m.sError <= tol
      && m.acpError <= tol && m.dcqError <= tol && m.dbrError <= tol
      && m.pqError <= tol && m.qrError <= tol && m.adbcError <= tol)) {
      failures++;
      check(`${label}: PQR and S collinear, three triangles and lengths`, false,
        JSON.stringify(m));
    }
    if (cl.awayFromAB !== wantAway || cl.equilateralAQB !== wantAQB) {
      failures++;
      check(`${label}: away=${wantAway}, AQB=${wantAQB}`, false, JSON.stringify(cl));
    }
    /* The drawn P-R line, extended towards S exactly as DrawLine does. */
    if (g.extended && Math.abs(C.cross(C.sub(g.extended[1], g.extended[0]),
      C.sub(g.S, g.extended[0]))) > 1e-6 * scale) {
      failures++;
      check(`${label}: the extended red line passes through S`, false);
    }
  };

  for (let deg = 0; deg < 360; deg++) {
    if (Math.abs(deg - 30) < 2 || Math.abs(deg - 150) < 2) continue;
    const region = deg > 30 && deg < 150 ? "minor" : "major";
    for (let j = 1; j <= 10; j++) {
      const frac = j / 11;
      const target = P(200 + 111.1111111111111 * Math.cos((deg * pi) / 180),
        165 + 111.1111111111111 * Math.sin((deg * pi) / 180));
      const s0 = C.move(C.start(), "S", target);
      const length = frac * Math.min(d(s0.A, s0.S), d(s0.B, s0.S));
      const cTarget = P(s0.B.x + (length / d(s0.B, s0.S)) * (s0.S.x - s0.B.x),
        s0.B.y + (length / d(s0.B, s0.S)) * (s0.S.y - s0.B.y));
      const st = C.move(s0, "C", cTarget);
      const g = C.geometry(st);
      if (!g) continue;
      if (region === "major") major++; else minor++;
      if (g.claims.awayFromAB) away++;
      if (g.claims.equilateralAQB) {
        if (region === "major") aqbMajor++; else aqbMinor++;
      }
      verify(`${region} ${deg} deg, ${frac} of BC`, g, region === "major", region === "major");
    }
  }
  check(`${major} positions with S on the arc opposite AB satisfy every claim`,
    major > 2000 && failures === 0, `${failures} failures`);
  check("away from AB holds exactly on that arc (and not on the other)",
    away === major && aqbMinor === 0 && aqbMajor === major);
  check(`${minor} positions on the other arc still keep P Q R S collinear`,
    minor > 1000 && failures === 0);
  check("AQB is not equilateral when S is on the arc between A and B", aqbMinor === 0);

  const startG = C.geometry(C.start());
  check("PQ = BC and QR = AD to drawing accuracy",
    startG.measures.pqError < 1e-9 && startG.measures.qrError < 1e-9);
  check("AD = BC at the start", startG.measures.adbcError < 1e-9);
  check("the applet's own Compute puts AQB equilateral at the start",
    (() => { const apG = appletCompute(ap); return !!apG && Math.abs(d(ap.A, apG.Q) - d(ap.A, ap.B)) < 1e-9; })());

  /* Signed lengths: the main claim survives dragging C or D past the vertex. */
  for (let i = 0; i < 100; i++) {
    const angle = (20 * pi) / 11 + ((i - 50) * 0.01);
    const target = P(200 + 111.1111111111111 * Math.cos(angle),
      165 + 111.1111111111111 * Math.sin(angle));
    const s0 = C.move(C.start(), "S", target);
    const t = -1.4 + i * 0.014;
    const p = P(s0.B.x + t * (s0.S.x - s0.B.x), s0.B.y + t * (s0.S.y - s0.B.y));
    const st = C.move(s0, "C", p), g = C.geometry(st);
    if (!g) continue;
    signed++;
    if (st.length < 0 && (!g.claims.collinearPQR || !g.claims.collinearS)) {
      failures++;
      check(`signed length ${i}: still collinear`, false);
    }
  }
  check(`${signed} signed-length drags keep the main collinearity claim`,
    signed > 80 && failures === 0);
}

/* ------------------------------------------- 5. degenerate positions are safe */

{
  const s = C.start();
  check("dragging S onto B is refused (the secant would collapse)", C.move(s, "S", s.B) === s);
  check("dragging S onto A is refused (the secant would collapse)", C.move(s, "S", s.A) === s);
  check("one unit away from B the construction still exists",
    !!C.geometry(C.move(s, "S", C.fromCircle(pi / 6 - 0.012))));
  const nearS = C.move(s, "C", P(s.S.x - 0.2, s.S.y));
  check("C within one unit of S makes the applet's Compute return early",
    C.geometry(nearS) === null && appletCompute(appletDragC(appletInit(), P(s.S.x - 0.2, s.S.y))) === null);
  check("a degenerate picture has a helpful status",
    /Move S, C or D/.test(C.describe(nearS)));
  check("a degenerate picture is still not a win or a loss", C.result(nearS) === null);
  check("describe works on an empty state", typeof C.describe({}) === "string");
  check("the core has no DOM", typeof globalThis.document === "undefined");
}

done("equilic-quad");
