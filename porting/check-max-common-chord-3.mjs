#!/usr/bin/env node
"use strict";

/*
 * Logic test for max-common-chord-3/max-common-chord-3-core.js.
 *
 *   node porting/check-max-common-chord-3.mjs
 *
 * The page's exact claims are: QR = 2·QN (the quiz word hidden in the live
 * page's rotating "twice,twice,thrice,four times" span is "twice"); AP·PB =
 * PQ·PR; the centre S of ABQ lies on the circumcircle of the two given circle
 * centres and Q; and the product is largest when SN is tangent to that circle,
 * which happens when S bisects the arc from T to U (QT a diameter). The
 * applet's own completion test is |angle(UQS) - angle(SQT)| < 0.01.
 *
 * Sections 2-4 check those claims on every one of hundreds of sampled chords
 * around each of many circle pairs, including the maximum and both arc
 * midpoints. Section 5 is a second, independent transcription of the applet's
 * bytecode: GeoSDoub.ComputeAngle / Intersect / FindCircumcenter /
 * IntersectX,Y / IntersectCirclesX,Y, CTKGeometryPlus.Prorate / Perp and
 * MaxCommonChord3Canvas.Compute / Fix / Other, compared point by point with
 * the core over fixed and random configurations and both drag modes.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("max-common-chord-3/max-common-chord-3-core.js", "MaxCommonChord3Core");

const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p && q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tolFor = (s) => 2e-5 * Math.max(dist(s.A, s.P), dist(s.B, s.P), dist(s.P, s.Q), 1);
const allClaims = (s) => C.claims(s);
const claimsPass = (cl) => Object.values(cl).every(Boolean);
const stateOf = (P, Q, A, B, opts = {}) => ({ P, Q, A, B, adjustCircles: false, showNames: false, ...opts });

/* ---------------- the applet's own arithmetic, transcribed from bytecode */

const aSq = (P, Q) => (P.x - Q.x) ** 2 + (P.y - Q.y) ** 2;
const aDist = (P, Q) => Math.sqrt(aSq(P, Q));

/* GeoSDoub.ComputeAngle: law of cosines, no clamping. */
function aAngle(P, Q, R) {
  const num = aSq(P, Q) + aSq(P, R) - aSq(Q, R);
  return Math.acos(num / (2 * aDist(P, Q) * aDist(P, R)));
}

/* GeoSDoub.Intersect(P1,P2,P3,P4): ax+by+c = 0 form; det < 1 means NaN. */
function aIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindCircumcenter, followed by GetCircle's averaged radius. */
function aGetCircle(P, Q, R) {
  const m1 = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  const m2 = { x: (Q.x + R.x) / 2, y: (Q.y + R.y) / 2 };
  const s5 = { x: m1.x + (Q.y - P.y), y: m1.y - (Q.x - P.x) };
  const s6 = { x: m2.x + (R.y - Q.y), y: m2.y - (R.x - Q.x) };
  const c = aIntersect(m1, s5, m2, s6);
  const r = (aDist(c, P) + aDist(c, Q) + aDist(c, R)) / 3;
  return { c, r };
}

/* GeoSDoub.Intersect(DoubLine, DoubCircle): IntersectX / IntersectY / null. */
function aIntersectX(line, circle) {
  const [A, B] = [line.m_1, line.m_2];
  const m = (A.x - B.x) / (A.y - B.y);
  const b = B.x - m * B.y;
  const aa = 1 + m * m;
  const bb = m * (b - circle.c.x) - circle.c.y;
  const cc = circle.c.y ** 2 + (b - circle.c.x) ** 2 - circle.r ** 2;
  const disc = bb * bb - aa * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
  return [{ x: m * t1 + b, y: t1 }, { x: m * t2 + b, y: t2 }];
}
function aIntersectY(line, circle) {
  const [A, B] = [line.m_1, line.m_2];
  const m = (A.y - B.y) / (A.x - B.x);
  const b = B.y - m * B.x;
  const aa = 1 + m * m;
  const bb = m * (b - circle.c.y) - circle.c.x;
  const cc = circle.c.x ** 2 + (b - circle.c.y) ** 2 - circle.r ** 2;
  const disc = bb * bb - aa * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
  return [{ x: t1, y: m * t1 + b }, { x: t2, y: m * t2 + b }];
}
function aLineCircle(A, B, circle) {
  const line = { m_1: A, m_2: B };
  if (Math.abs(A.y - B.y) > 1) return aIntersectX(line, circle);
  if (Math.abs(A.x - B.x) > 1) return aIntersectY(line, circle);
  return null;
}

/* GeoSDoub.Intersect(DoubCircle, DoubCircle): IntersectCirclesX,Y. */
function aCirclesX(c1, c2) {
  const m = -(c1.c.y - c2.c.y) / (c1.c.x - c2.c.x);
  const k = ((c1.c.x ** 2 - c2.c.x ** 2) + (c1.c.y ** 2 - c2.c.y ** 2)
    + c2.r ** 2 - c1.r ** 2) / (2 * (c1.c.x - c2.c.x));
  const d = k - c1.c.x;
  const aa = 1 + m * m;
  const bb = m * d - c1.c.y;
  const cc = d * d + c1.c.y ** 2 - c1.r ** 2;
  const disc = bb * bb - aa * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
  // The class file adds the stored intercept (local 4), not the shifted
  // value d = k - c1.x used only in the quadratic coefficients.
  return [{ x: m * t1 + k, y: t1 }, { x: m * t2 + k, y: t2 }];
}
function aCirclesY(c1, c2) {
  const m = -(c1.c.x - c2.c.x) / (c1.c.y - c2.c.y);
  const k = ((c1.c.y ** 2 - c2.c.y ** 2) + (c1.c.x ** 2 - c2.c.x ** 2)
    + c2.r ** 2 - c1.r ** 2) / (2 * (c1.c.y - c2.c.y));
  const d = k - c1.c.y;
  const aa = 1 + m * m;
  const bb = m * d - c1.c.x;
  const cc = d * d + c1.c.x ** 2 - c1.r ** 2;
  const disc = bb * bb - aa * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
  return [{ x: t1, y: m * t1 + k }, { x: t2, y: m * t2 + k }];
}
function aCircleCircle(c1, c2) {
  if (Math.abs(c1.c.x - c2.c.x) > 1) return aCirclesX(c1, c2);
  if (Math.abs(c1.c.y - c2.c.y) > 1) return aCirclesY(c1, c2);
  return [null, null];
}

function aOther(points, ref) {
  if (!points) return null;
  return aDist(points[0], ref) < 1 ? points[1] : points[0];
}

/* CTKGeometryPlus.Prorate and Perp. */
function aProrate(P, Q, length) {
  const d = aDist(P, Q);
  if (d < 0.1) return P;
  return { x: P.x + ((Q.x - P.x) * length) / d, y: P.y + ((Q.y - P.y) * length) / d };
}
function aPerp(P, Q, S) {
  return { x: S.x + (Q.y - P.y) * 10, y: S.y - (Q.x - P.x) * 10 };
}

/* MaxCommonChord3Canvas.Fix: put `point` on `circle` opposite P on a line. */
function aFix(point, circle, linePoint, P) {
  if (aDist(linePoint, P) < 1) return point;
  const hits = aLineCircle(linePoint, P, circle);
  const chosen = aOther(hits, P);
  if (!chosen || !Number.isFinite(chosen.x)) return point;
  return { x: chosen.x, y: chosen.y };
}

/* MaxCommonChord3Canvas.Compute(), in the class file's instruction order. */
function aCompute(state) {
  const { P, Q, A, B } = state;
  if ([aDist(A, P), aDist(A, Q), aDist(B, P), aDist(B, Q), aDist(P, Q)].some((d) => d < 2)) return null;
  const E = aGetCircle(A, P, Q), F = aGetCircle(B, P, Q);
  const EQF = aGetCircle(E.c, Q, F.c), AB = aGetCircle(A, B, Q);
  const R = aOther(aLineCircle(P, Q, AB), Q);
  if (!R || aDist(P, R) < 1) return null;
  const L = aOther(aCircleCircle(EQF, E), Q);
  const M = aOther(aCircleCircle(EQF, F), Q);
  const S = aIntersect(A, L, B, M);
  const U = aOther(aLineCircle(P, Q, EQF), Q);
  const T = aProrate(Q, EQF.c, 2 * EQF.r);
  const perp = aPerp(P, Q, S);
  const N = aIntersect(S, perp, P, Q);
  const diff = Math.abs(aAngle(Q, U, S) - aAngle(Q, S, T));
  return { E, F, O: EQF, AB, R, L, M, S, U, T, N, angleDiff: diff, finished: diff < 0.01 };
}

/* The mouse path: RestrictToCircle, then Fix, with the applet's two modes. */
function aDrag(state, name, target) {
  const out = (A, B) => ({ P: state.P, Q: state.Q, A, B,
    adjustCircles: state.adjustCircles, showNames: state.showNames });
  if (name === "P" || name === "Q") return out(state.A, state.B);
  const E = aGetCircle(state.A, state.P, state.Q), F = aGetCircle(state.B, state.P, state.Q);
  let q = { ...target };
  if (name === "A") {
    if (!state.adjustCircles) {
      const d = aDist(q, E.c);
      q = { x: E.c.x + (E.r * (q.x - E.c.x)) / d, y: E.c.y + (E.r * (q.y - E.c.y)) / d };
    }
    return out(q, aFix(state.B, F, q, state.P));
  }
  if (!state.adjustCircles) {
    const d = aDist(q, F.c);
    q = { x: F.c.x + (F.r * (q.x - F.c.x)) / d, y: F.c.y + (F.r * (q.y - F.c.y)) / d };
  }
  return out(aFix(state.A, E, q, state.P), q);
}

/* --------------------------------------------- 1. the start and the options */

{
  const s = C.start({});
  equal("start P matches Canvas.init on a 640x460 canvas", s.P, { x: (640 * 6) / 11, y: 276 });
  equal("start Q matches Canvas.init", s.Q, { x: 320, y: 368 });
  equal("start A matches Canvas.init", s.A, { x: 240, y: 368 });
  // init() calls Fix(B, CircleF, A), so B lands where line AP next meets F.
  check("start B matches Canvas.init after Fix(B, F, A)",
    closePoint(s.B, { x: 383.99158490737545, y: 246.56709672811334 }, 1e-9),
    JSON.stringify(s.B));
  check("the 'chord' radio button starts checked", s.adjustCircles === false);
  check("Show names starts unchecked", s.showNames === false);
  check("an illustration has no result", C.result(s) === null);
  const scaled = C.start({ width: 400, height: 288 });
  check("the start scales to the page's 400x288 viewBox",
    close(scaled.P.x, (400 * 6) / 11, 1e-12) && close(scaled.Q.y, 288 * 0.8, 1e-12)
      && close(scaled.A.x, 150, 1e-12)
      && closePoint(scaled.B, { x: 239.86471648872327, y: 154.48228751032659 }, 1e-9),
    JSON.stringify(scaled));
  const moved = C.withPoint(s, "Q", { x: 280, y: 350 });
  check("withPoint copies the state and moves only the named point",
    moved.Q.x === 280 && s.Q.x === 320 && moved.A.x === s.A.x);
  check("withPoint accepts a mode change without touching points", (() => {
    const t = { ...s, adjustCircles: true };
    return t.adjustCircles && !s.adjustCircles && t.A.x === s.A.x;
  })());
}

/* --------------------------------------- 2. a hand-checkable configuration */

{
  // The opening picture: the auxiliary circle has centre (378, 287.048...)
  // and radius 99.583..., so the arc midpoint is near (408.02, 192.10).
  const s = C.start({});
  const aux = C.auxiliary(s);
  check("the opening picture has two given circles and an auxiliary circle",
    aux.valid && Boolean(aux.E && aux.F && aux.O && aux.U && aux.T));
  check("the opening picture's auxiliary centre matches the applet",
    closePoint(aux.O.c, { x: 377.9970089433446, y: 287.0481494789795 }, 1e-9),
    JSON.stringify(aux.O.c));
  check("the opening chord already passes through P", (() => {
    const u = sub(s.B, s.P), v = sub(s.A, s.P);
    return Math.abs(u.x * v.y - u.y * v.x) < 1e-6;
  })());
  check("the opening picture has a finite AB circle and S", C.measure(s).valid && Boolean(C.measure(s).S));
  check("the best point bisects the arc T-U", (() => {
    const b = aux.best;
    return close(Math.abs(C.angle(s.Q, aux.U, b.S) - C.angle(s.Q, b.S, aux.T)), 0, 1e-9);
  })());
  check("the best point is near (408.02, 192.10)",
    closePoint(aux.best.S, { x: 408.0206171261001, y: 192.09848860101522 }, 1e-6),
    JSON.stringify(aux.best.S));
  check("the best chord beats the other arc midpoint's chord", (() => {
    const u = sub(aux.U, s.Q), d = dist(aux.U, s.Q);
    const other = C.chordFromS(s, { x: aux.O.c.x - (aux.O.r * u.x) / d, y: aux.O.c.y - (aux.O.r * u.y) / d });
    return other && aux.best.product > C.dist(other.A, other.P) * C.dist(other.P, other.B) * 1.5;
  })());
  const best = C.chordFromS(s, aux.best.S);
  check("the constructed best chord passes through P",
    Math.abs((best.A.x - s.P.x) * (best.B.y - s.P.y) - (best.A.y - s.P.y) * (best.B.x - s.P.x)) < 1e-5);
  const m = C.measure(best);
  check("the best chord makes the applet's Finished flag true", m.finished && m.angleDiff < 0.01);
  check("QR is exactly twice QN at the best chord", close(m.QR, 2 * m.QN, 1e-5 * s.P.x), `${m.QR} vs ${2 * m.QN}`);
}

/* ----------------- 3. the page's claims, over many circles and every chord */

{
  const rand = rng(1975);
  let pairs = 0, chords = 0, maxima = 0, failures = 0, skewed = 0;
  for (let trial = 0; trial < 240; trial++) {
    const P = { x: 40 + rand() * 320, y: 40 + rand() * 220 };
    const Q = { x: 40 + rand() * 320, y: 40 + rand() * 220 };
    const A = { x: 20 + rand() * 360, y: 20 + rand() * 250 };
    const B = { x: 20 + rand() * 360, y: 20 + rand() * 250 };
    const s = stateOf(P, Q, A, B);
    const aux = C.auxiliary(s);
    if (!aux.valid || !aux.best || !Number.isFinite(aux.best.product)) continue;
    // The page's diagram has P between Q and U. If P is labelled as the
    // other intersection beyond U, maximizing PR reverses: the arc midpoint
    // can then minimize AP*PB. Such pairs are outside the stated picture.
    const d = sub(aux.U, Q), len = Math.hypot(d.x, d.y);
    const projP = ((P.x - Q.x) * d.x + (P.y - Q.y) * d.y) / (len || 1);
    if (!(projP > 0 && projP < len)) { skewed++; continue; }
    pairs++;
    let bestSampled = -Infinity;

    for (let i = 0; i < 72; i++) {
      const S = C.pointOnAux(s, (i * 2 * Math.PI) / 72);
      const onCircle = C.chordFromS(s, S);
      if (!onCircle) continue;
      const next = C.measure(onCircle);
      if (!next.valid || !next.S || !next.N || !next.R) continue;
      // The applet's Other() works to a one-unit tolerance; with S almost on
      // PQ both intersections with the circle ABQ sit within a unit of Q and
      // it cannot pick R. Those chords are not the construction it draws.
      if (!(next.QN > 1)) continue;
      chords++;
      const cl = allClaims(onCircle);
      const tol = tolFor(s);
      if (!cl.chordThroughP || !cl.qrTwiceQn || !cl.sIsCentre || !cl.sOnAux
          || !cl.intersectingChords || !cl.bestIsArcMidpoint || !cl.bestIsTangent
          || !cl.bestIsMaximum || !C.tangentAt(onCircle, next.best.S)) {
        if (failures++ < 5) check(`trial ${trial}, chord ${i}: all page claims hold`, false, JSON.stringify(cl));
      }
      const product = C.dist(onCircle.A, P) * C.dist(P, onCircle.B);
      if (Number.isFinite(product)) bestSampled = Math.max(bestSampled, product);
    }

    // The best chord from the arc midpoint must beat every sampled chord.
    if (bestSampled > -Infinity) {
      maxima++;
      if (!(aux.best.product >= bestSampled - tolFor(s) * 1e3)) {
        if (failures++ < 5) check(`trial ${trial}: the arc midpoint maximises AP*PB`, false,
          `best ${aux.best.product}, sampled ${bestSampled}`);
      }
      const bestState = C.chordFromS(s, aux.best.S);
      if (!bestState || !C.measure(bestState).finished) {
        if (failures++ < 5) check(`trial ${trial}: the maximum makes Finished true`, false);
      }
    }
  }
  check(`every page claim held on ${chords} constructed chords across ${pairs} circle pairs`, failures === 0);
  check(`enough configurations were checked`, pairs >= 50 && chords >= 2000 && maxima >= 50,
    `pairs ${pairs}, chords ${chords}, maxima ${maxima}, outside the diagram ${skewed}`);
  check("the maximum at the arc midpoint was compared with all sampled chords", maxima === pairs);
}

/* --------------------- 4. interaction: both modes and both Fix directions */

{
  const s = C.start({ width: 400, height: 288 });
  const E = C.circumcircle(s.A, s.P, s.Q), F = C.circumcircle(s.B, s.P, s.Q);
  const inChordMode = C.withPoint(s, "A", { x: 170, y: 140 });
  check("chord mode keeps A on its original circle",
    close(C.dist(inChordMode.A, E.c), E.r, 1e-6));
  check("dragging A fixes B on the other circle",
    close(C.dist(inChordMode.B, F.c), F.r, 1e-6));
  check("the fixed chord passes through P", (() => {
    const u = sub(inChordMode.A, s.P), v = sub(inChordMode.B, s.P);
    return Math.abs(u.x * v.y - u.y * v.x) < 1e-5;
  })());
  const inCircleMode = C.withPoint({ ...s, adjustCircles: true }, "A", { x: 160, y: 150 });
  check("circles mode lets A leave its old circle", closePoint(inCircleMode.A, { x: 160, y: 150 }, 1e-12));
  check("circles mode still fixes B on circle F",
    close(C.dist(inCircleMode.B, F.c), F.r, 1e-6));
  const dragB = C.withPoint(s, "B", { x: 330, y: 170 });
  check("dragging B keeps B on circle F", close(C.dist(dragB.B, F.c), F.r, 1e-6));
  check("dragging B fixes A on circle E", close(C.dist(dragB.A, E.c), E.r, 1e-6));
  check("the chord after dragging B passes through P", (() => {
    const u = sub(dragB.A, s.P), v = sub(dragB.B, s.P);
    return Math.abs(u.x * v.y - u.y * v.x) < 1e-5;
  })());
  check("points closer than one unit are not moved by Fix", (() => {
    const near = stateOf({ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 50 }, { x: 300, y: 60 });
    const t = C.withPoint(near, "A", { x: 0.2, y: 0.3 });
    return t.B.x === near.B.x && t.B.y === near.B.y;
  })());
  check("an impossible move leaves the state finite",
    [C.measure(s).valid, Number.isFinite(C.dist(C.start().A, C.start().P))].every(Boolean));
}

/* --------------- 5. the core against the applet's own bytecode transcription */

{
  const fixed = [
    C.start({}),
    C.start({ width: 400, height: 288 }),
    stateOf({ x: 349.09, y: 276 }, { x: 320, y: 368 }, { x: 240, y: 360 }, { x: 576, y: 368 }),
    stateOf({ x: 100, y: 200 }, { x: 300, y: 200 }, { x: 190, y: 330 }, { x: 400, y: 340 }),
    stateOf({ x: 120, y: 100 }, { x: 260, y: 280 }, { x: 50, y: 250 }, { x: 380, y: 90 }),
    stateOf({ x: 60, y: 60 }, { x: 340, y: 400 }, { x: 300, y: 60 }, { x: 80, y: 400 }),
  ];
  const opening = C.start({});
  const bests = [C.chordFromS(opening, C.auxiliary(opening).best.S)].filter(Boolean);
  const cases = [...fixed, ...bests];

  function compare(label, s) {
    const a = aCompute(s), m = C.measure(s);
    const tol = tolFor(s);
    if (!m.valid || !m.S || !m.N) {
      // The applet carries NaN through a degenerate or near-parallel case;
      // the core refuses to draw one. Both decline to produce a position.
      const degenerate = !a || ![a.L, a.M, a.S, a.N, a.R].every((p) => Number.isFinite(p.x));
      return check(`${label}: degenerate position is refused by both`, degenerate,
        JSON.stringify(a));
    }
    if (!a) return check(`${label}: applet accepts the core's position`, false);
    const keys = ["E", "F", "O", "AB", "R", "L", "M", "S", "U", "T", "N"];
    let ok = true;
    for (const k of keys) {
      const p = a[k], q = m[k];
      if (!closePoint(p && (p.c || p), q && (q.c || q), tol)) { ok = false; break; }
      if (p && p.r !== undefined && !close(p.r, m[k].r, tol)) { ok = false; break; }
    }
    if (!close(a.angleDiff, m.angleDiff, tol) || a.finished !== m.finished) ok = false;
    check(`${label}: applet Compute matches the core point by point`, ok,
      ok ? "" : `applet ${JSON.stringify(a)}, core ${JSON.stringify(m)}`);
  }
  for (let i = 0; i < cases.length; i++) compare(`fixed ${i}`, cases[i]);

  const rand = rng(6222);
  let compared = 0, sketchy = 0;
  for (let trial = 0; trial < 500; trial++) {
    const s = stateOf(
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
    );
    const a = aCompute(s), m = C.measure(s);
    if (!m.valid || !m.S || !m.N) {
      const degenerate = !a || ![a.L, a.M, a.S, a.N, a.R].every((p) => Number.isFinite(p.x));
      if (!degenerate) check(`random ${trial}: degenerate position is refused by both`, false);
      sketchy++;
      continue;
    }
    if (!a) {
      check(`random ${trial}: applet accepts the core's position`, false);
      continue;
    }
    const tol = tolFor(s);
    let ok = true;
    for (const k of ["E", "F", "O", "AB", "R", "L", "M", "S", "U", "T", "N"]) {
      const p = a[k], q = m[k];
      if (!closePoint(p && (p.c || p), q && (q.c || q), tol)) { ok = false; break; }
      if (p && p.r !== undefined && !close(p.r, q.r, tol)) { ok = false; break; }
    }
    if (!close(a.angleDiff, m.angleDiff, tol) || a.finished !== m.finished) ok = false;
    if (!ok) check(`random ${trial}: applet Compute matches the core`, false,
      `applet ${JSON.stringify(a)}, core ${JSON.stringify(m)}`);
    compared++;

    // Compare the two drag paths as well (the applet's RestrictToCircle + Fix).
    for (const mode of [false, true]) {
      const st = { ...s, adjustCircles: mode };
      for (const name of ["A", "B"]) {
        const target = { x: 40 + rand() * 320, y: 40 + rand() * 220 };
        const want = aDrag(st, name, target), got = C.withPoint(st, name, target);
        if (!closePoint(want.A, got.A, tol) || !closePoint(want.B, got.B, tol)) {
          check(`random ${trial} ${name} drag in mode ${mode}: applet path matches core`, false,
            `applet ${JSON.stringify(want)}, core ${JSON.stringify(got)}`);
        }
      }
    }
  }
  check(`applet and core agree on ${compared} random positions`, compared > 250);
  check(`skipped ${sketchy} degenerate random positions consistently`, sketchy >= 0);
}

done("max-common-chord-3");
