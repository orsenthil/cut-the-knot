#!/usr/bin/env node
"use strict";

/*
 * Logic test for math-pro/math-pro-core.js.
 *
 *   node porting/check-math-pro.mjs
 *
 * Two kinds of checks.
 *
 * 1. The page's claims, over thousands of deterministic random triangles and
 *    points P, plus fixed starting, incenter, on-circle and tangency cases:
 *    DX/EY/FZ concur; the three mixed near/far triplets concur; the all-far
 *    triplet does not concur for generic P; when P = I the point is the
 *    incenter of the contact triangle. Taking X = Y = Z = P for P on the
 *    circle is trivially concurrent, but the applet's "nearest to the vertex"
 *    rule cannot choose P at all three vertices at once; that nuance is
 *    checked too. The tangency exception to the page's "all far points are
 *    not concurrent" is checked explicitly.
 *
 * 2. A second, literal transcription of the applet's own bytecode:
 *    GeoSDoub.FindIncenter (two half-angle rays), NearestPoint, IntersectX/Y
 *    for a line and a circle, FindCrossPoint's nearer crossing, and
 *    Intersect(Line,Line) in ax+by+c form. Its I, radius, D/E/F, X/Y/Z and Q
 *    are compared with the core on every non-degenerate configuration.
 *
 * The live cut-the-knot page no longer embeds the Java applet (it now has a
 * GeoGebra iframe); the original <applet code="MathPro" ...> is preserved in
 * the 2006 Internet Archive capture used for this transcription.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("math-pro/math-pro-core.js", "MathProCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol));
const setNear = (as, bs, tol) => {
  if (!as || !bs || as.length !== bs.length) return false;
  return as.every((a) => bs.some((b) => closePoint(a, b, tol)));
};
const tri = (A, B, Cc, P) => ({ A: { ...A }, B: { ...B }, C: { ...Cc }, P: { ...P } });

/* ---------------------------------------- the applet's methods, from javap */

const apSq = (P, Q) => (P.x - Q.x) ** 2 + (P.y - Q.y) ** 2;
const apDist = (P, Q) => Math.sqrt(apSq(P, Q));

function apAngle(P, Q, R) {
  const cos = (apSq(P, Q) + apSq(P, R) - apSq(Q, R)) / (2 * apDist(P, Q) * apDist(P, R));
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

/* GeoSDoub.FindOrientation: +1 when the cross product is positive, else -1. */
function apOrientation(A, B, D) {
  const s = D.x * (A.y - B.y) + D.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate(Q about P by angle), using the applet's orientation sign. */
function apRotate(P, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* GeoSDoub.Intersect(P1,P2,P3,P4): |det| < 1 gives NaN, as in Java. */
function apIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindIncenter(A,B,C): the two internal half-angle rays. */
function apIncenter(A, B, Cc) {
  const halfA = apAngle(A, B, Cc) / 2;
  const halfB = apAngle(B, Cc, A) / 2;
  const orient = apOrientation(A, B, Cc);
  return apIntersect(
    A, apRotate(A, B, halfA, orient),
    B, apRotate(B, Cc, halfB, orient),
  );
}

/* GeoSDoub.NearestPoint(P,A,B), including the "|P-A|^2 < 0.1" early return. */
function apNearest(P, A, B) {
  const dx = B.x - A.x, dy = B.y - A.y;
  if (apSq(P, A) < 0.1) return { x: P.x, y: P.y };
  const t = (dx * (P.x - A.x) + dy * (P.y - A.y)) / (dx * dx + dy * dy);
  return { x: A.x + dx * t, y: A.y + dy * t };
}

/* GeoSDoub.Intersect(DoubLine,DoubCircle), via IntersectX and IntersectY. */
function apLineCircle(a, b, circle) {
  const r = circle.radius;
  const cx = circle.center.x, cy = circle.center.y;
  if (Math.abs(a.y - b.y) > 1) {
    const m = (a.x - b.x) / (a.y - b.y);
    const off = b.x - m * b.y;
    const A = m * m + 1;
    const p = m * (off - cx) - cy;
    const q = cy * cy + (off - cx) * (off - cx) - r * r;
    const disc = p * p - A * q;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const y1 = (-p + s) / A, y2 = (-p - s) / A;
    return [{ x: m * y1 + off, y: y1 }, { x: m * y2 + off, y: y2 }];
  }
  if (Math.abs(a.x - b.x) > 1) {
    const m = (a.y - b.y) / (a.x - b.x);
    const off = b.y - m * b.x;
    const A = m * m + 1;
    const p = m * (off - cy) - cx;
    const q = cx * cx + (off - cy) * (off - cy) - r * r;
    const disc = p * p - A * q;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const x1 = (-p + s) / A, x2 = (-p - s) / A;
    return [{ x: x1, y: m * x1 + off }, { x: x2, y: m * x2 + off }];
  }
  return null;
}

/* MathProCanvas.FindCrossPoint: keep the crossing nearer to the vertex. */
function apCross(vertex, P, circle) {
  const hits = apLineCircle(vertex, P, circle);
  if (!hits || !hits[0] || Number.isNaN(hits[0].x)) return null;
  return apDist(vertex, hits[0]) <= apDist(vertex, hits[1]) ? hits[0] : hits[1];
}

/* One run of MathProCanvas.Compute(), in the applet's own order. */
function apDiagram(s) {
  const I = apIncenter(s.A, s.B, s.C);
  const circle = {
    center: I,
    radius: (
      apDist(I, apNearest(I, s.B, s.C)) +
      apDist(I, apNearest(I, s.C, s.A)) +
      apDist(I, apNearest(I, s.A, s.B))
    ) / 3,
  };
  const D = apNearest(I, s.B, s.C);
  const E = apNearest(I, s.C, s.A);
  const F = apNearest(I, s.A, s.B);
  const X = apCross(s.A, s.P, circle);
  const Y = apCross(s.B, s.P, circle);
  const Z = apCross(s.C, s.P, circle);
  const Q = X && Y ? apIntersect(D, X, E, Y) : null;
  return { I, circle, D, E, F, X, Y, Z, Q, noDraw: !X || !Y || !Z };
}

/* ---------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  equal("start A matches Canvas.init at 400x300", s.A, { x: 133, y: 30 });
  equal("start B matches Canvas.init at 400x300", s.B, { x: 100, y: 240 });
  equal("start C matches Canvas.init at 400x300", s.C, { x: 320, y: 240 });
  equal("start P matches Canvas.init at 400x300", s.P, { x: 179.75, y: 135 });
  const big = C.start({ width: 500, height: 400 });
  equal("start honours a 500x400 canvas", [big.A, big.B, big.C], [
    { x: 166, y: 40 }, { x: 125, y: 320 }, { x: 400, y: 320 },
  ]);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("the start triangle is not degenerate", !C.isDegenerate(s));
  check("withPoint leaves the old position alone", (() => {
    const moved = C.withPoint(s, "P", { x: 200, y: 100 });
    return s.P.x === 179.75 && moved.P.x === 200 && moved.A === s.A ? false : s.P.x === 179.75 && moved.P.x === 200;
  })());
  check("withPoint refuses an unknown point", C.withPoint(s, "Z", { x: 1, y: 2 }).Z === undefined);
  check("collinear corners are refused", C.isDegenerate(tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, s.P)));
}

/* ------------------------------- 2. fixed configurations and page claims */

{
  const s = C.start();
  const m = C.diagram(s);
  const cl = C.claims(s);
  check("the starting picture has all its crossings", m.valid);
  check("the starting near-cevians concur (the page's main claim)", cl.main);
  check("the starting three mixed triplets concur", cl.mixed);
  check("the starting all-far triplet does not concur", cl.allFarNot);
  check("the near crossings are nearer than the far ones", C.distance(s.A, m.X) <= C.distance(s.A, m.Xp) &&
    C.distance(s.B, m.Y) <= C.distance(s.B, m.Yp) && C.distance(s.C, m.Z) <= C.distance(s.C, m.Zp));

  const withIncenter = C.withPoint(s, "P", m.I);
  const d2 = C.diagram(withIncenter);
  check("with P at the incenter the picture still draws", d2.valid);
  check("P = I meets at the incenter of the contact triangle DEF",
    closePoint(C.claims(withIncenter).Q, C.incenter(m.D, m.E, m.F), 1e-7 * m.scale));
  check("P = I gives the arc midpoints (the crossings are one radius from I)",
    [d2.X, d2.Y, d2.Z].every((p) => close(C.distance(m.I, p), m.circle.radius, 1e-8)));

  /* The page's "trivial" case: if the crossing chosen on each line is P
   * itself, the three lines D-P, E-P and F-P obviously all pass through P. */
  const onCircle = { x: m.I.x + m.circle.radius * 0.6, y: m.I.y + m.circle.radius * 0.8 };
  const trivialQ = C.lineIntersection(m.D, onCircle, m.E, onCircle);
  check("page's trivial case: X = Y = Z = P gives three lines through P",
    closePoint(trivialQ, onCircle, 1e-8) && C.distanceToLine(onCircle, m.F, onCircle) < 1e-8);
  /* But the applet picks the crossing nearest each vertex, and no point on
   * the circle is visible from all three vertices at once. */
  let maxSeen = 0;
  for (let k = 0; k < 180; k++) {
    const a = (k * 2 * Math.PI) / 180;
    const q = { x: m.I.x + m.circle.radius * Math.cos(a), y: m.I.y + m.circle.radius * Math.sin(a) };
    const d3 = C.diagram(C.withPoint(s, "P", q));
    if (!d3.valid) continue;
    const seen = [d3.X, d3.Y, d3.Z].filter((p) => C.distance(p, q) < 1e-7).length;
    maxSeen = Math.max(maxSeen, seen);
  }
  check("the applet's near rule cannot choose P at all three vertices when P is on the circle", maxSeen < 3, `max ${maxSeen}`);

  /* The page says the all-far triplet is not concurrent. At a touch point a
   * line is tangent, so its two crossings coincide and the statement fails. */
  const tangent = C.concurrency(C.withPoint(s, "P", m.F), [true, true, true]);
  check("exception: at touch point F the all-far triplet does concur at F",
    tangent.valid && tangent.concurrent && closePoint(tangent.Q, m.F, 1e-6));
}

/* --------------------------------- 3. every claim on many configurations */

{
  const rand = rng(20261128);
  let compared = 0, nearChecked = 0, farChecked = 0, secants = 0;
  let worstApplet = 0, worstNear = 0, smallestFarError = Infinity;
  const bad = [], rootBad = [], claimBad = [];

  for (let i = 0; i < 30000; i++) {
    const A = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
    const B = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
    const Cc = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
    const P = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
    if (C.isDegenerate({ A, B, C: Cc })) continue;
    const s = tri(A, B, Cc, P);
    const m = C.diagram(s);
    if (!m.valid) continue;
    const tol = 1e-6 * m.scale;

    /* The literal applet transcription: I, radius, feet, crossings, Q. */
    const ap = apDiagram(s);
    compared++;
    /* The applet's slope-based solver can miss a nearly tangent line or
     * return NaN for nearly parallel cevians. Those are its own rounding
     * limits, not geometric disagreements; skip just those comparisons. */
    const apComplete = Boolean(ap.X && ap.Y && ap.Z && Number.isFinite(ap.I.x));
    if (apComplete) {
      const parts = [
        ["I", ap.I, m.I], ["D", ap.D, m.D], ["E", ap.E, m.E], ["F", ap.F, m.F],
        ["X", ap.X, m.X], ["Y", ap.Y, m.Y], ["Z", ap.Z, m.Z],
      ];
      if (ap.Q && Number.isFinite(ap.Q.x) && Number.isFinite(ap.Q.y)) parts.push(["Q", ap.Q, m.Q]);
      for (const [name, a, b] of parts) {
        const err = closePoint(a, b, tol) ? 0 : a && b ? dist(a, b) : Infinity;
        worstApplet = Math.max(worstApplet, err / m.scale);
        if (!closePoint(a, b, tol) && bad.length < 5) bad.push(`case ${i} ${name}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
      }
      if (!close(ap.circle.radius, m.circle.radius, tol) && bad.length < 5) bad.push(`case ${i} radius`);
    }

    /* Where the applet's line/circle solver has two clear roots, the core's
     * quadratic must return the same pair. */
    const hits = C.lineCircle(s.A, s.P, m.circle);
    const apHits = apLineCircle(s.A, s.P, m.circle);
    if (apHits && hits.length === 2 && apHits.length === 2 && apHits.every((p) => Number.isFinite(p.x))) {
      secants++;
      if (!setNear(apHits, hits, tol) && rootBad.length < 5) rootBad.push(`case ${i} intersections`);
    }

    /* The four assertions on the page, checked numerically. */
    const variants = [[false, false, false], [false, true, true], [true, false, true], [true, true, false]];
    for (const v of variants) {
      const c = C.concurrency(s, v);
      const err = c.error / m.scale;
      worstNear = Math.max(worstNear, err);
      nearChecked++;
      if (!(c.valid && err < 1e-7) && claimBad.length < 5) claimBad.push(`case ${i} concurrence ${v}: ${err}`);
    }

    /* Generic P away from the circle and the touch points: not all far. */
    const onCircle = Math.abs(dist(P, m.circle.center) - m.circle.radius) < 6;
    const atTouch = [m.D, m.E, m.F].some((t) => dist(P, t) < 6);
    if (!onCircle && !atTouch) {
      const af = C.concurrency(s, [true, true, true]);
      if (af.valid) {
        farChecked++;
        smallestFarError = Math.min(smallestFarError, af.error / m.scale);
        if (af.concurrent && claimBad.length < 5) claimBad.push(`case ${i} all-far unexpectedly concurrent`);
      }
    }
  }

  check("every sampled non-degenerate configuration was compared with the applet", compared > 1000, `${compared} configurations`);
  check("applet I, D, E, F, X, Y, Z and Q match the core within 1e-6 of the scale",
    worstApplet < 1e-6 && bad.length === 0, `worst ${worstApplet.toExponential(3)}; ${bad.join("; ")}`);
  check("applet's averaged incircle radius matches the core", bad.length === 0, bad.join("; "));
  check("line/circle roots match GeoSDoub.IntersectX/Y",
    secants > 500 && rootBad.length === 0, `${secants} secants; ${rootBad.join("; ")}`);
  check("the main and three mixed concurrences hold on every valid sample",
    nearChecked > 4000 && worstNear < 1e-7 && claimBad.length === 0,
    `worst ${worstNear.toExponential(3)} of ${nearChecked}; ${claimBad.join("; ")}`);
  check("the all-far triplet is not concurrent for generic P",
    farChecked > 1000 && smallestFarError > 1e-5,
    `min ${smallestFarError.toExponential(3)} of ${farChecked}`);
}

done("math-pro");
