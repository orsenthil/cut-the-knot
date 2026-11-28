#!/usr/bin/env node
"use strict";

/*
 * Logic test for malfatti-zoom/malfatti-zoom-core.js.
 *
 *   node porting/check-malfatti-zoom.mjs
 *
 * The exact claim of the cut-the-knot page is that Steiner's construction
 * gives the three Malfatti circles for *any* triangle: the second internal
 * tangents of the incircles of I Ai Aj concur in L, the quadrilaterals
 * Ai Dj L Dk have incircles, and those three circles touch each other and two
 * sides each. Hart's proof needs this to hold in every configuration, including
 * those where E_k lands outside the side; that is why the applet has a zoom.
 *
 * This test (1) transcribes the applet's own GeoSDoub / Tangents / Canvas
 * methods a second time, literally enough to keep their odd 1-pixel guards,
 * and compares them with the core on every generated triangle; (2) checks the
 * page's claims independently, with the mathematically chosen tangent, on
 * thousands of triangles; (3) checks the applet's quirk: its 1-pixel test can
 * pick the bisector instead of the second tangent and then the circles are
 * *not* tangent, which the port reproduces rather than hides.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("malfatti-zoom/malfatti-zoom-core.js", "MalfattiZoomCore");
const near = (a, b, tol = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
const along = (p, a, b) => ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / d(a, b);

function triangles(count, seed, lo = -60, hi = 420) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count * 3; i++) {
    const A = [0, 1, 2].map(() => ({ x: lo + r() * (hi - lo), y: lo + r() * (hi - lo) }));
    const area = Math.abs(cross(A[0], A[1], A[2]));
    if (area < 3000) continue; // a degenerate triangle has no incircle
    out.push(A);
    if (out.length === count) break;
  }
  return out;
}

/* -------------------------------------------------------------------------
 * A second, literal transcription of the applet's geometry helpers. Different
 * formulas from the core on purpose: angles and rotations rather than
 * side-length weights, and tangents from an angle rather than from similar
 * triangles, so an error in either transcription shows up as a mismatch.
 * ---------------------------------------------------------------------- */

const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

/** GeoSDoub.ComputeAngle: cosine rule, the angle at the first point. */
function computeAngle(p, q, r) {
  const num = (sq(p, q) + sq(p, r) - sq(q, r)) / 2;
  return Math.acos(Math.max(-1, Math.min(1, num / (Math.hypot(p.x - q.x, p.y - q.y) * Math.hypot(p.x - r.x, p.y - r.y)))));
}

/** GeoSDoub.FindOrientation: +1 when p,q,r turn anticlockwise. */
const orientation = (p, q, r) => (cross(p, q, r) > 0 ? 1 : -1);

/** GeoSDoub.Rotate: the sense parameter flips the rotation for CW triangles. */
function rotate(p, q, angle, sense) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return {
    x: p.x + cos * (q.x - p.x) - sense * sin * (q.y - p.y),
    y: p.y + sense * sin * (q.x - p.x) + cos * (q.y - p.y),
  };
}

/** GeoSDoub.Intersect, including its |det| < 1 guard. */
function appletIntersect(a, b, c, e) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - e.y, b2 = e.x - c.x, c2 = c.x * e.y - c.y * e.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return null;
  return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
}

/** GeoSDoub.FindIncenter by two half-angle bisectors, as the applet does. */
function appletIncenter(a, b, c) {
  const sense = orientation(a, b, c);
  const p = rotate(a, b, computeAngle(a, b, c) / 2, sense);
  const q = rotate(b, c, computeAngle(b, c, a) / 2, sense);
  return appletIntersect(a, p, b, q);
}

/** GeoSDoub.FindAngleBisector: rotate one side by half the angle. */
function appletBisector(v, p, q) {
  const r = rotate(v, p, computeAngle(v, p, q) / 2, orientation(v, p, q));
  return appletIntersect(v, r, p, q);
}

/** GeoSDoub.NearestPoint, with the applet's 0.1 early return. */
function appletNearest(p, a, b) {
  if (sq(a, p) < 0.1) return { x: p.x, y: p.y };
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + t * dx, y: a.y + t * dy };
}
const appletDistLine = (p, a, b) => d(p, appletNearest(p, a, b));

/** Canvas.GetIncircle(p,q,r): incenter, then the mean of three distances. */
function appletIncircle(p, q, r) {
  const I = appletIncenter(p, q, r);
  const radius = (appletDistLine(I, q, r) + appletDistLine(I, r, p) + appletDistLine(I, p, q)) / 3;
  return { center: I, radius };
}

/** Tangents.GetInternalTangents via tan(theta) from the internal centre. */
function appletInternalTangents(c1, c2) {
  const R = c1.radius + c2.radius;
  const v = { x: c2.center.x - c1.center.x, y: c2.center.y - c1.center.y };
  const L = Math.hypot(v.x, v.y);
  if (!(L > R)) return null;
  const ux = v.x / L, uy = v.y / L;
  const ct = R / L, st = Math.sqrt(1 - ct * ct);
  return [1, -1].map((sign) => {
    const tx = c1.center.x + R * (ux * ct - sign * uy * st);
    const ty = c1.center.y + R * (uy * ct + sign * ux * st);
    return {
      a: {
        x: c1.center.x + (tx - c1.center.x) * c1.radius / R,
        y: c1.center.y + (ty - c1.center.y) * c1.radius / R,
      },
      b: {
        x: c2.center.x - (tx - c1.center.x) * c2.radius / R,
        y: c2.center.y - (ty - c1.center.y) * c2.radius / R,
      },
    };
  });
}

/** Canvas.CommonPoint / CommonTangent, transcribed in the same order. */
function appletCommonPoint(c1, c2) {
  const R = c1.radius + c2.radius;
  return {
    x: (c2.radius * c1.center.x + c1.radius * c2.center.x) / R,
    y: (c2.radius * c1.center.y + c1.radius * c2.center.y) / R,
  };
}
function appletCommonTangent(c1, c2) {
  const P = appletCommonPoint(c1, c2);
  return { a: P, b: { x: P.x + c1.center.y - c2.center.y, y: P.y - c1.center.x + c2.center.x } };
}

/** Canvas.GetSecondTangents with its two 1-pixel guards and exception path. */
function appletSecondTangent(main, c1, c2) {
  try {
    const lines = appletInternalTangents(c1, c2);
    if (!lines) return appletCommonTangent(c1, c2);
    if (d(lines[0].a, lines[0].b) < 2) return appletCommonTangent(c1, c2);
    for (let i = 0; i < 2; i++) {
      if (appletDistLine(main.center, lines[i].a, lines[i].b) > 1) return lines[i];
    }
    return appletCommonTangent(c1, c2);
  } catch (e) {
    return Math.abs(d(c1.center, c2.center) - c1.radius - c2.radius) < 1
      ? appletCommonTangent(c1, c2) : null;
  }
}

/** Canvas.ComputeIntersection: mean of the three pairwise intersections. */
function appletConcurrency(lines) {
  if (lines.length < 3) return null;
  let sx = 0, sy = 0, n = 0;
  for (let k = 0; k < 3; k++) {
    const p = appletIntersect(lines[k].a, lines[k].b, lines[(k + 1) % 3].a, lines[(k + 1) % 3].b);
    if (p) { sx += p.x; sy += p.y; n++; }
  }
  return n ? { x: sx / n, y: sy / n } : null;
}

/** Canvas.BisectorCandidate and MulfattiCircle, keeping their rotations. */
function appletCandidate(p1, p2, p3, p4) {
  const s5 = appletBisector(p2, p1, p3), s6 = appletBisector(p1, p2, p4);
  return appletIntersect(p2, s5, p1, s6);
}
function appletMalfatti(p1, p2, p3, p4) {
  const c = [
    appletCandidate(p1, p2, p3, p4), appletCandidate(p2, p3, p4, p1),
    appletCandidate(p3, p4, p1, p2), appletCandidate(p4, p1, p2, p3),
  ].filter(Boolean);
  const center = {
    x: c.reduce((s, p) => s + p.x, 0) / c.length,
    y: c.reduce((s, p) => s + p.y, 0) / c.length,
  };
  const radius = (
    appletDistLine(center, p2, p3) + appletDistLine(center, p3, p4) +
    appletDistLine(center, p4, p1) + appletDistLine(center, p1, p2)
  ) / 4;
  return { center, radius };
}

/** The whole Canvas.Compute, in the transcription's own index order. */
function appletGeometry(A) {
  const main = appletIncircle(A[0], A[1], A[2]);
  const I = main.center;
  const inc = [
    appletIncircle(I, A[1], A[2]), appletIncircle(I, A[2], A[0]), appletIncircle(I, A[0], A[1]),
  ];
  const raw = [
    appletSecondTangent(main, inc[1], inc[2]),
    appletSecondTangent(main, inc[2], inc[0]),
    appletSecondTangent(main, inc[0], inc[1]),
  ];
  const D = [0, 1, 2].map((k) => appletNearest(inc[k].center, A[(k + 1) % 3], A[(k + 2) % 3]));
  const L = appletConcurrency(raw.filter(Boolean));
  if (!L) return null;
  const circles = [0, 1, 2].map((k) => appletMalfatti(L, D[(k + 1) % 3], A[k], D[(k + 2) % 3]));
  const P = [0, 1, 2].map((k) => appletCommonPoint(circles[(k + 1) % 3], circles[(k + 2) % 3]));
  return { I, main, inc, raw, D, L, circles, P };
}

function sameCircle(a, b, tol = 1e-6) {
  return a && b && near(a.center.x, b.center.x, tol) && near(a.center.y, b.center.y, tol) &&
    near(a.radius, b.radius, tol);
}
const samePoint = (a, b, tol = 1e-6) => a && b && near(a.x, b.x, tol) && near(a.y, b.y, tol);

/* --------------------------------------------------------------- 1. rules */

{
  equal("the applet's zoom radio group", C.ZOOMS.map((z) => z.label),
    ["No zoom", "2X", "4X", "6X", "8X"]);
  equal("the zoom scales", C.ZOOMS.map((z) => z.a), [1, 2, 4, 6, 8]);
  const s = C.start({});
  check("the default board is 360 by 360", s.width === 360 && s.height === 360);
  check("the applet's first two vertices", near(s.A[0].x, 60) && near(s.A[0].y, 300) &&
    near(s.A[1].x, 300) && near(s.A[1].y, 300));
  check("the applet's third vertex", near(s.A[2].x, 240) && near(s.A[2].y, 16.0769515459));
  check("names are on by default, the other layers off", s.showNames && !s.showBisectors &&
    !s.showIncircles && !s.showSecondTangents && s.zoom === "1");
  const again = C.start({});
  check("a new position depends only on its options", JSON.stringify(s) === JSON.stringify(again));
  const reset = C.reset({ ...s, showIncircles: true, zoom: "4" });
  check("Reset keeps options and restores the triangle",
    reset.showIncircles && reset.zoom === "4" && d(reset.A[0], s.A[0]) === 0);
  check("this is a picture: no win, no loss", C.result(s) === null && C.result({ ...s, A: [] }) === null);
  for (const z of C.ZOOMS) {
    const t = C.zoom({ ...s, zoom: z.key });
    check("zoom " + z.label + " fixes the board centre",
      near(C.transformPoint({ x: 180, y: 180 }, t).x, 180) &&
      near(C.transformPoint({ x: 180, y: 180 }, t).y, 180));
    check("zoom " + z.label + " scales a point and a circle",
      near(C.transformPoint({ x: 10, y: 20 }, t).x, 180 + z.a * (10 - 180)) &&
      near(C.transformCircle({ center: { x: 10, y: 20 }, radius: 7 }, t).radius, 7 * z.a));
    check("zoom " + z.label + " inverts back",
      near(C.untransformPoint(C.transformPoint({ x: 33, y: 77 }, t), t).x, 33));
  }
}

/* ----------------------------- 2. core against the second transcription */

{
  const cases = triangles(400, 0x4d41);
  check("generated a full parameter spread", cases.length === 400);
  let worstCenter = 0, worstRadius = 0, mismatches = 0, skipped = 0;
  for (const A of cases) {
    const a = C.geometry({ ...C.start({}), A });
    const b = appletGeometry(A);
    if (!a || !b) { if (a !== b) mismatches++; else skipped++; continue; }
    if (!sameCircle(a.main, b.main, 1e-6) || !samePoint(a.I, b.I, 1e-6) ||
        !samePoint(a.L, b.L, 1e-6)) { mismatches++; continue; }
    for (let k = 0; k < 3; k++) {
      if (!sameCircle(a.incircles[k], b.inc[k], 1e-6) ||
          !sameCircle(a.circles[k], b.circles[k], 1e-6) ||
          !samePoint(a.D[k], b.D[k], 1e-6) || !samePoint(a.P[k], b.P[k], 1e-6)) {
        mismatches++;
      }
      worstCenter = Math.max(worstCenter, d(a.circles[k].center, b.circles[k].center));
      worstRadius = Math.max(worstRadius, Math.abs(a.circles[k].radius - b.circles[k].radius));
    }
  }
  check("both transcriptions agree on all 400 triangles", mismatches === 0 && skipped < 10,
    "mismatches " + mismatches + ", degenerate " + skipped);
  check("the transcribed centers stay within 1e-6", worstCenter < 1e-6, "worst " + worstCenter);
  check("the transcribed radii stay within 1e-6", worstRadius < 1e-6, "worst " + worstRadius);

  // The individual applet helpers, not just the assembled picture.
  const A = C.start({}).A;
  check("FindIncenter by rotation matches the core's incenter",
    samePoint(appletIncenter(A[0], A[1], A[2]), C.incenter(A[0], A[1], A[2])));
  check("FindAngleBisector by rotation matches the core's bisector foot",
    samePoint(appletBisector(A[0], A[1], A[2]), C.angleBisector(A[0], A[1], A[2])));
  check("GetIncircle matches the core's incircle",
    sameCircle(appletIncircle(A[0], A[1], A[2]), C.incircle(A[0], A[1], A[2])));
  check("CommonTangent matches the core's common tangent",
    samePoint(appletCommonTangent(C.geometry({ ...C.start({}), A }).circles[0],
      C.geometry({ ...C.start({}), A }).circles[1]).a,
    C.commonTangent(C.geometry({ ...C.start({}), A }).circles[0],
      C.geometry({ ...C.start({}), A }).circles[1]).a));
  const at = appletInternalTangents(C.geometry({ ...C.start({}), A }).incircles[1],
    C.geometry({ ...C.start({}), A }).incircles[2]);
  const ct = C.internalTangents(C.geometry({ ...C.start({}), A }).incircles[1],
    C.geometry({ ...C.start({}), A }).incircles[2]);
  check("both internal-tangent constructions give the same two lines",
    samePoint(at[0].a, ct[0].a, 1e-7) && samePoint(at[1].a, ct[1].a, 1e-7));
}

/* ----------------------------- 3. the page's claims, over every shape */

/**
 * The mathematical construction: among the two internal tangents pick the
 * one through D[k] (the applet normally picks it by distance from I instead).
 * This is the construction Hart's proof describes, independent of the
 * applet's one-pixel guard.
 */
function exactConstruction(A) {
  const I = C.incenter(A[0], A[1], A[2]);
  const inc = [0, 1, 2].map((k) => C.incircle(I, A[(k + 1) % 3], A[(k + 2) % 3]));
  const D = [0, 1, 2].map((k) => C.nearest(inc[k].center, A[(k + 1) % 3], A[(k + 2) % 3]));
  const tangents = [0, 1, 2].map((k) => {
    const ts = C.internalTangents(inc[(k + 1) % 3], inc[(k + 2) % 3]);
    return ts && ts.reduce((best, t) =>
      C.distToLine(D[k], t.a, t.b) < C.distToLine(D[k], best.a, best.b) ? t : best);
  });
  if (tangents.some((t) => !t)) return null;
  const L = C.concurrency(tangents);
  if (!L) return null;
  const circles = [0, 1, 2].map((k) =>
    C.malfattiCircle(L, D[(k + 1) % 3], A[k], D[(k + 2) % 3]));
  if (circles.some((c) => !c)) return null;
  return { I, inc, D, tangents, L, circles };
}

{
  const cases = triangles(1500, 0x9e37);
  check("generated a full claim-check spread", cases.length === 1500);
  let n = 0, gap = 0, side = 0, quad = 0, concur = 0, iPair = 0, homothety = 0;
  let configs = { both: 0, split: 0 };
  for (const A of cases) {
    const g = exactConstruction(A);
    if (!g) continue;
    n++;
    for (let k = 0; k < 3; k++) {
      const c = g.circles[k];
      // The Malfatti circle at vertex k touches the two sides through A_k.
      side = Math.max(side,
        Math.abs(C.distToLine(c.center, A[k], A[(k + 1) % 3]) - c.radius),
        Math.abs(C.distToLine(c.center, A[(k + 2) % 3], A[k]) - c.radius));
      // It also touches both lines L D[k+1] and L D[k+2]: the quadrilateral
      // A_k D[k+1] L D[k+2] has this circle as its incircle.
      quad = Math.max(quad,
        Math.abs(C.distToLine(c.center, g.L, g.D[(k + 1) % 3]) - c.radius),
        Math.abs(C.distToLine(c.center, g.L, g.D[(k + 2) % 3]) - c.radius));
      concur = Math.max(concur, C.distToLine(g.L, g.tangents[k].a, g.tangents[k].b));
      // Each small incircle c_k is inscribed in I A[k+1] A[k+2], so it touches
      // the two bisectors I A[k+1] and I A[k+2].
      iPair = Math.max(iPair,
        Math.abs(C.distToLine(g.inc[k].center, g.I, A[(k + 1) % 3]) - g.inc[k].radius),
        Math.abs(C.distToLine(g.inc[k].center, g.I, A[(k + 2) % 3]) - g.inc[k].radius));
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      gap = Math.max(gap, Math.abs(d(g.circles[i].center, g.circles[j].center) -
        g.circles[i].radius - g.circles[j].radius));
    }
    // P[k] is where the two circles at A[k+1] and A[k+2] touch, and the
    // tangent there meets the side at D[k].
    for (let k = 0; k < 3; k++) {
      const a = g.circles[(k + 1) % 3], b = g.circles[(k + 2) % 3];
      const P = C.commonPoint(a, b);
      homothety = Math.max(homothety,
        Math.abs(d(P, a.center) - a.radius), Math.abs(d(P, b.center) - b.radius));
    }
    // Configuration check: E_k lands on one of the two sides through A_k.
    const E = C.geometry({ ...C.start({}), A }).E;
    if (E.every((p) => p && Number.isFinite(p.x))) {
      const onSide = (p, a, b) => Math.abs(cross(a, b, p)) < 1e-4;
      const pair = onSide(E[0], A[0], A[2]) && onSide(E[2], A[0], A[2]);
      if (pair) configs.both++; else configs.split++;
    }
  }
  check("nearly every generated triangle has a construction", n > 1400, "n " + n);
  check("the three circles touch in every shape", gap < 1e-6, "worst gap " + gap);
  check("each circle touches its two sides in every shape", side < 1e-6, "worst " + side);
  check("each quadrilateral is tangential (incircle)", quad < 1e-6, "worst " + quad);
  check("the second tangents concur at L in every shape", concur < 1e-6, "worst " + concur);
  check("each c_k touches its angle bisector", iPair < 1e-6, "worst " + iPair);
  check("P_k is the contact point of the two circles", homothety < 1e-6, "worst " + homothety);
  check("both E_k-on-the-same-side configurations occur", configs.both > 20 && configs.split > 20,
    JSON.stringify(configs));

  // The stricter lemma of Hart's proof, in the configuration the page assumes:
  // the incircle of the triangle bounded by L Ei, L Ej and the side touches
  // that side at Dk. The page says "it therefore appears" rather than proving
  // this step, and in practice the touch points agree to within a pixel.
  let lemmaN = 0, lemmaMax = 0;
  for (const A of cases) {
    const g = C.geometry({ ...C.start({}), A });
    if (!g || g.E.some((p) => !p || !Number.isFinite(p.x))) continue;
    for (let k = 0; k < 3; k++) {
      const e1 = g.E[(k + 1) % 3], e2 = g.E[(k + 2) % 3];
      // The lemma is for the configuration where both E_k lie on the side
      // opposite A_k, so the three lines L E_i, L E_j, E_i E_j bound a triangle.
      const a = A[(k + 1) % 3], b = A[(k + 2) % 3], len = d(a, b);
      if (Math.abs(cross(a, b, e1)) > 1e-4 || Math.abs(cross(a, b, e2)) > 1e-4 ||
          along(e1, a, b) < 0 || along(e2, a, b) < 0 ||
          along(e1, a, b) > len || along(e2, a, b) > len) continue;
      const inc = C.incircle(g.L, e1, e2);
      const foot = C.nearest(inc.center, e1, e2);
      lemmaMax = Math.max(lemmaMax, d(foot, g.D[k]));
      lemmaN++;
    }
  }
  check("the Hart contact lemma was tested on many configurations", lemmaN > 100, "n " + lemmaN);
  check("the incircle of L Ei Ej touches the side at Dk to a pixel",
    lemmaMax < 1, "worst " + lemmaMax);
}

/* ------------------------ 4. the applet's own exception, honestly checked */

{
  const cases = triangles(600, 0x1234);
  let guarded = 0, faithful = 0, solvable = 0, mismatches = 0;
  let exactWhenUnguarded = 0, errorWhenGuarded = 0, worstUnguardedGap = 0;
  for (const A of cases) {
    const s = { ...C.start({}), A };
    const core = C.geometry(s);
    const app = appletGeometry(A);
    if (!core || !app) { if (core !== app) mismatches++; continue; }
    solvable++;
    if (sameCircle(core.circles[0], app.circles[0], 1e-6)) faithful++;
    // A picked tangent farther than 1 pixel from I means no fallback was used.
    const fallback = core.firstTangents.some((t) => !t ||
      C.distToLine(core.I, t.a, t.b) <= 1);
    let gap = 0;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      gap = Math.max(gap, Math.abs(d(core.circles[i].center, core.circles[j].center) -
        core.circles[i].radius - core.circles[j].radius));
    }
    if (fallback) {
      guarded++;
      errorWhenGuarded = Math.max(errorWhenGuarded, gap);
    } else {
      exactWhenUnguarded++;
      worstUnguardedGap = Math.max(worstUnguardedGap, gap);
    }
  }
  check("the second transcription matches the core on every case",
    mismatches === 0 && faithful === solvable, "faithful " + faithful + "/" + solvable);
  check("the one-pixel guard really does fire on some triangles", guarded > 0,
    "guarded " + guarded);
  check("the port keeps the fallback deviation", errorWhenGuarded > 0.01,
    "worst gap " + errorWhenGuarded);
  check("unguarded applet circles still touch exactly", worstUnguardedGap < 1e-6,
    "worst gap " + worstUnguardedGap);
  check("there are unguarded cases checked exactly", exactWhenUnguarded > 100,
    "n " + exactWhenUnguarded);
}

done("malfatti-zoom");
