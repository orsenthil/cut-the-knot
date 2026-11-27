#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-pedal-circles/four-pedal-circles-core.js.
 *
 *   node porting/check-four-pedal-circles.mjs
 *
 * Checks the five draggable points, the three checkboxes and the reset, then
 * every claim on the cut-the-knot page:
 *   1. the four pedal circles of a point P and a complete quadrangle concur;
 *   2. for a cyclic quadrangle the four Simson lines and the four nine-point
 *      circles all meet in one point;
 *   3. for any quadrangle the nine-point circles of the four triangles and
 *      the pedal circles of the opposite points all meet in one point.
 * The last part transcribes the applet's own Compute(), GeoSDoub.NearestPoint,
 * FindCircumcenter, LineCircle.GetCircle and Intersect a second time, straight
 * from the bytecode, and compares it with the core on every configuration in
 * the sample (including the Simson-line / collinear-feet case).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-pedal-circles/four-pedal-circles-core.js", "FourPedalCirclesCore");

/* ------------------------------------------- a second transcription of the applet */

const P = (x, y) => ({ x, y });
const minus = (u, v) => P(u.x - v.x, u.y - v.y);
const plus = (u, v) => P(u.x + v.x, u.y + v.y);
const scale = (u, k) => P(u.x * k, u.y * k);
const dot2 = (u, v) => u.x * v.x + u.y * v.y;
const det2 = (u, v) => u.x * v.y - u.y * v.x;
const length = (u, v) => Math.hypot(u.x - v.x, u.y - v.y);
const mid = (u, v) => P((u.x + v.x) / 2, (u.y + v.y) / 2);

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint). */
function linesMeet(a, b, c, d) {
  const A1 = a.y - b.y, B1 = b.x - a.x, C1 = a.x * b.y - a.y * b.x;
  const A2 = c.y - d.y, B2 = d.x - c.x, C2 = c.x * d.y - c.y * d.x;
  const det = A1 * B2 - A2 * B1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((B1 * C2 - B2 * C1) / det, (C1 * A2 - C2 * A1) / det);
}

/** GeoSDoub.NearestPoint(P,A,B) verbatim, including the sqrt(0.1) guard. */
function footByApplet(p, a, b) {
  if (dot2(minus(a, p), minus(a, p)) < 0.1) return p;
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return P(a.x + dx * t, a.y + dy * t);
}

/** GeoSDoub.FindCircumcenter: two offset perpendicular bisectors, then intersect. */
function centerByApplet(a, b, c) {
  const m1 = mid(a, b), m2 = mid(b, c);
  const u = P(m1.x + b.y - a.y, m1.y - b.x + a.x);
  const v = P(m2.x + c.y - b.y, m2.y - c.x + b.x);
  return linesMeet(m1, u, m2, v);
}

/** LineCircle.GetCircle, with its 50000 radius cut-off and farthest-pair line. */
function pedalByApplet(p, q, r) {
  const o = centerByApplet(p, q, r);
  if (Number.isFinite(o.x) && Number.isFinite(o.y)) {
    const radius = (length(o, p) + length(o, q) + length(o, r)) / 3;
    if (radius < 50000) return { kind: "circle", center: o, radius };
  }
  const pq = length(p, q), pr = length(p, r), qr = length(q, r);
  if (pq > pr) return qr > pq ? { kind: "line", a: q, b: r } : { kind: "line", a: p, b: q };
  return qr > pr ? { kind: "line", a: q, b: r } : { kind: "line", a: p, b: r };
}

/** GeoSDoub.IntersectCirclesX / Y, transcribed independently from the bytecode. */
function circlesMeet(c, d) {
  if (Math.abs(c.center.x - d.center.x) > 1) {
    const k = -(c.center.y - d.center.y) / (c.center.x - d.center.x);
    const m = (c.center.x ** 2 - d.center.x ** 2 + c.center.y ** 2 - d.center.y ** 2
      - c.radius ** 2 + d.radius ** 2) / (2 * (c.center.x - d.center.x));
    const t = m - c.center.x;
    const B = k * t - c.center.y;
    const A = k * k + 1;
    const D = t * t + c.center.y ** 2 - c.radius ** 2;
    if (B * B - A * D < 0) return null;
    const s = Math.sqrt(B * B - A * D);
    return [P(k * ((-B + s) / A) + m, (-B + s) / A),
      P(k * ((-B - s) / A) + m, (-B - s) / A)];
  }
  if (Math.abs(c.center.y - d.center.y) > 1) {
    const k = -(c.center.x - d.center.x) / (c.center.y - d.center.y);
    const m = (c.center.y ** 2 - d.center.y ** 2 + c.center.x ** 2 - d.center.x ** 2
      - c.radius ** 2 + d.radius ** 2) / (2 * (c.center.y - d.center.y));
    const t = m - c.center.y;
    const B = k * t - c.center.x;
    const A = k * k + 1;
    const D = t * t + c.center.x ** 2 - c.radius ** 2;
    if (B * B - A * D < 0) return null;
    const s = Math.sqrt(B * B - A * D);
    return [P((-B + s) / A, k * ((-B + s) / A) + m),
      P((-B - s) / A, k * ((-B - s) / A) + m)];
  }
  return [P(c.center.x, c.center.y), P(c.center.x, c.center.y)];
}

/** GeoSDoub.Intersect(DoubLine,DoubCircle) — foot plus/minus the chord half. */
function lineCircleMeet(line, circle) {
  const d = minus(line.b, line.a), len2 = dot2(d, d);
  if (!len2) return null;
  const t = dot2(minus(circle.center, line.a), d) / len2;
  const f = plus(line.a, scale(d, t));
  const h2 = circle.radius ** 2 - dot2(minus(circle.center, f), minus(circle.center, f));
  if (h2 < 0) return null;
  const u = scale(d, 1 / Math.sqrt(len2)), h = Math.sqrt(h2);
  return [plus(f, scale(u, h)), plus(f, scale(u, -h))];
}

function lcMeet(u, v) {
  if (u.kind === "circle" && v.kind === "circle") return circlesMeet(u, v);
  if (u.kind === "circle" && v.kind === "line") return lineCircleMeet(v, u);
  if (u.kind === "line" && v.kind === "circle") return lineCircleMeet(u, v);
  const p = linesMeet(u.a, u.b, v.a, v.b);
  return [p, p];
}

/** FourPedalCirclesCanvas.Other and Midpoint. */
function other(points, p) {
  if (!points) return null;
  return length(points[0], p) < 1 ? points[1] : points[0];
}

/** The applet's Compute(), in full. */
function computeByApplet(s) {
  const { A, B, C: Z, D, P: M } = s;
  const f = {
    ab: footByApplet(M, A, B), ac: footByApplet(M, A, Z), ad: footByApplet(M, A, D),
    bc: footByApplet(M, B, Z), bd: footByApplet(M, B, D), cd: footByApplet(M, Z, D),
  };
  const cs = {
    ABC: pedalByApplet(f.ab, f.bc, f.ac),
    ACD: pedalByApplet(f.ac, f.cd, f.ad),
    ABD: pedalByApplet(f.ab, f.bd, f.ad),
    BCD: pedalByApplet(f.bc, f.cd, f.bd),
  };
  const u = other(lcMeet(cs.ABC, cs.ABD), f.ab);
  const v = other(lcMeet(cs.ACD, cs.BCD), f.cd);
  if (!u || !v) return { degenerate: true, feet: f, circles: cs };
  return { degenerate: false, feet: f, circles: cs, Q: mid(u, v), gap: length(u, v) };
}

/* ------------------------------------------------ an independent check of the claim */

/** Circumcenter and radius from the determinant formula, not the core's method. */
function circleOf(a, b, c) {
  const d = 2 * det2(minus(b, a), minus(c, a));
  if (!d) return null;
  const aa = a.x * a.x + a.y * a.y, bb = b.x * b.x + b.y * b.y, cc = c.x * c.x + c.y * c.y;
  const o = P((aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d,
    (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d);
  return { center: o, radius: length(o, a) };
}

function onCircle(q, c) {
  return c ? Math.abs(length(q, c.center) - c.radius) : Infinity;
}

/**
 * A third, textbook circle intersection, used to test the page's statement
 * rather than the applet's arithmetic. The two intersections are separated by
 * `sep`; when they are close together the "other than the foot" choice is not
 * meaningful and the configuration is skipped by the claim test.
 */
function standardIntersections(c, d, anchor) {
  const delta = minus(d.center, c.center);
  const dd = length(c.center, d.center);
  const t = (c.radius ** 2 - d.radius ** 2 + dd * dd) / (2 * dd);
  const h2 = c.radius ** 2 - t * t;
  if (h2 < 0) return null;
  const base = plus(c.center, scale(delta, t / dd));
  const perp = scale(delta, 1 / dd);
  const h = Math.sqrt(h2);
  const a = plus(base, P(-perp.y * h, perp.x * h));
  const b = plus(base, P(perp.y * h, -perp.x * h));
  return {
    sep: length(a, b),
    q: length(a, anchor) >= length(b, anchor) ? a : b,
  };
}

/* ------------------------------------------------------------- configuration sample */

const cyclicSquare = {
  A: P(200, 50), B: P(300, 150), C: P(200, 250), D: P(100, 150), P: P(235, 205),
};
const cyclicWide = {
  A: P(200 + 100 * Math.cos(0.2), 150 + 100 * Math.sin(0.2)),
  B: P(200 + 100 * Math.cos(1.4), 150 + 100 * Math.sin(1.4)),
  C: P(200 + 100 * Math.cos(2.9), 150 + 100 * Math.sin(2.9)),
  D: P(200 + 100 * Math.cos(4.7), 150 + 100 * Math.sin(4.7)),
  P: P(245, 155),
};
const exact = [C.start(), cyclicSquare, cyclicWide];
const sample = [...exact];
const next = rng(5042);
for (let i = 0; i < 8000 && sample.length < 1503; i++) {
  const s = {
    A: P(15 + next() * 370, 15 + next() * 270),
    B: P(15 + next() * 370, 15 + next() * 270),
    C: P(15 + next() * 370, 15 + next() * 270),
    D: P(15 + next() * 370, 15 + next() * 270),
    P: P(15 + next() * 370, 15 + next() * 270),
  };
  const pts = [s.A, s.B, s.C, s.D];
  let close = false;
  for (let a = 0; a < 4 && !close; a++) {
    for (let b = a + 1; b < 4; b++) if (length(pts[a], pts[b]) < 40) close = true;
  }
  if (close) continue;
  const g = C.compute(s);
  // Keep the sample conditioned: with a pedal triangle almost in a line the
  // applet replaces its circle by a straight line (its 50000 radius cut-off),
  // and the four-line concurrence is only approximate. Those cases are tested
  // separately below by comparing with the applet's own transcription.
  if (g.degenerate || C.CIRCLE_NAMES.some((k) => g.circles[k].kind !== "circle" || g.circles[k].radius > 5000)) continue;
  sample.push(s);
}

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  check("the opening picture uses the applet's five starting points",
    s.A.x === 80 && s.A.y === 200 && s.B.x === 200 && s.B.y === 180
    && s.C.x === 280 && s.C.y === 90 && s.D.x === 100 && s.D.y === 100
    && Math.abs(s.P.x - 400 * 6 / 11) < 1e-9 && s.P.y === 225);
  check("the demo starts unexplored and names are on, triangles and perpendiculars off",
    C.result(s) === null && s.showNames && !s.showTriangles && !s.showLines);
  equal("the opening counters", [s.moves, s.explored], [0, false]);
  check("legal moves cover five points, three switches and reset", C.legalMoves(s).length === 9);
  const moved = C.move(s, { type: "point", name: "P", point: P(300, 40) });
  check("dragging P moves only P", moved && moved.P.x === 300 && moved.P.y === 40
    && moved.A.x === s.A.x && moved.C.y === s.C.y);
  check("a drag that puts two points together is refused",
    C.move(s, { type: "point", name: "P", point: s.C }) === null);
  check("an unknown point is refused", C.move(s, { type: "point", name: "Z", point: P(1, 1) }) === null);
  const outside = C.move(s, { type: "point", name: "D", point: P(9999, -9999) });
  check("a point dragged off the board is kept inside it",
    outside && outside.D.x <= C.WIDTH - 6 && outside.D.y >= 6);
  check("an unknown option is refused", C.move(s, { type: "option", key: "wrong", value: true }) === null);
  let t = s;
  for (const key of C.OPTION_KEYS) t = C.move(t, { type: "option", key, value: true });
  check("all three applet switches can be ticked",
    C.OPTION_KEYS.every((k) => t[k] === true) && t.moves === 3 && C.result(t) === "done");
  check("ticking a switch does not move any point",
    C.NAMES.every((n) => length(s[n], t[n]) === 0));
  const reset = C.move(t, { type: "reset" });
  check("reset restores the opening points but keeps the switches",
    C.NAMES.every((n) => length(s[n], reset[n]) === 0)
    && C.OPTION_KEYS.every((k) => reset[k] === true));
  check("the source position is never changed by a move",
    s.moves === 0 && !s.explored && s.showTriangles === false);
  check("four points in a line are reported as degenerate",
    C.compute({ ...s, A: P(40, 40), B: P(120, 40), C: P(220, 40), D: P(300, 40) }).degenerate === true);
}

/* -------------------------------------- 2. the page's claims, over the whole sample */

{
  let worstFeet = 0, worstClaim = 0, worstAppletQ = 0, worstGap = 0;
  let separated = 0, quirks = 0;
  for (const s of sample) {
    const g = C.compute(s);
    if (g.degenerate) continue;
    const r = C.residuals(s, g);
    worstFeet = Math.max(worstFeet, r.feetError);
    const indep = [
      circleOf(g.feet.ab, g.feet.bc, g.feet.ac),
      circleOf(g.feet.ac, g.feet.cd, g.feet.ad),
      circleOf(g.feet.ab, g.feet.bd, g.feet.ad),
      circleOf(g.feet.bc, g.feet.cd, g.feet.bd),
    ];
    if (indep.some((c) => !c)) continue;
    // The page's claim is about the circles, so use the textbook intersection
    // and keep the intersection that is not the common pedal foot.
    const found = standardIntersections(indep[0], indep[2], g.feet.ab);
    if (!found || found.sep < 5) continue; // nearly tangent: "the other point" is ambiguous
    separated++;
    let err = 0;
    for (const c of indep) err = Math.max(err, onCircle(found.q, c));
    worstClaim = Math.max(worstClaim, err);
    if (length(g.Q, found.q) > 1e-3) quirks++; // see below: the applet's 1-unit tie-break
    else {
      worstAppletQ = Math.max(worstAppletQ, r.onCircles);
      worstGap = Math.max(worstGap, r.gap);
    }
  }
  check("the sample has over 1500 non-degenerate configurations", sample.length >= 1500,
    `${sample.length} configurations`);
  check("most configurations have well separated intersections", separated > 1400, `${separated}`);
  check("each pedal foot is the perpendicular projection onto its side", worstFeet < 1e-4, `max ${worstFeet}`);
  check("one point lies on all four pedal circles (the page's main claim)", worstClaim < 1e-4, `max ${worstClaim}`);
  check("the applet's chosen Q is that point whenever its 1-unit tie-break works",
    worstAppletQ < 1e-4, `max ${worstAppletQ}`);
  check("then the applet's two 'other' intersections agree", worstGap < 1e-4, `max ${worstGap}`);
  check("the tie-break really does misfire when the common point is within a unit of a foot",
    quirks > 0 && quirks < separated / 10, `${quirks} of ${separated}`);
  check("the opening picture obeys the claim", (() => {
    const s = C.start(), g = C.compute(s);
    if (g.degenerate) return false;
    const cs = C.CIRCLE_NAMES.map((k) => ({
      center: g.circles[k].center, radius: g.circles[k].radius,
    }));
    const found = standardIntersections(cs[0], cs[2], g.feet.ab);
    return found && cs.every((c) => onCircle(found.q, c) < 1e-8);
  })());
}

/* --------------------------- 3. the cyclic case: Simson lines and nine-point circles */

{
  let worstCollinear = 0, worstConcurrent = 0, worstNine = 0, cases = 0;
  for (let i = 0; i < 700; i++) {
    const a = 0.05 + i * 0.0011;
    const ring = [a, a + 1.1, a + 2.7, a + 4.4].map((u) => ({
      x: 200 + 100 * Math.cos(u), y: 150 + 100 * Math.sin(u),
    }));
    const [A, B, Z, D] = ring;
    const others = [[B, Z, D], [A, Z, D], [A, B, D], [A, B, Z]];
    const lines = [];
    for (let k = 0; k < 4; k++) {
      const p = ring[k], [u, v, w] = others[k];
      const f1 = C.nearestPoint(p, u, v), f2 = C.nearestPoint(p, u, w), f3 = C.nearestPoint(p, v, w);
      worstCollinear = Math.max(worstCollinear, Math.abs(C.cross(C.sub(f2, f1), C.sub(f3, f1))));
      lines.push({ a: f1, b: f2 });
      const n = C.ninePointCircle(u, v, w);
      if (!n) { worstNine = Infinity; }
    }
    const q = C.lineIntersection(lines[0].a, lines[0].b, lines[1].a, lines[1].b);
    if (!C.finite(q)) continue;
    cases++;
    for (const line of lines) {
      const d = C.sub(line.b, line.a);
      worstConcurrent = Math.max(worstConcurrent, Math.abs(C.cross(C.sub(q, line.a), d)) / C.dist(line.a, line.b));
    }
    for (let k = 0; k < 4; k++) {
      const [u, v, w] = others[k];
      const n = C.ninePointCircle(u, v, w);
      if (n) worstNine = Math.max(worstNine, Math.abs(C.circleDistance(q, n)));
    }
  }
  check("700 cyclic quadrangles were tested", cases > 650, `${cases} cases`);
  check("each Simson line's three feet are collinear for a cyclic quadrangle",
    worstCollinear < 1e-4, `max ${worstCollinear}`);
  check("the four Simson lines of a cyclic quadrangle meet in one point",
    worstConcurrent < 1e-4, `max ${worstConcurrent}`);
  check("that point also lies on all four nine-point circles",
    worstNine < 1e-4, `max ${worstNine}`);
}

/* ------------------------- 4. the generalisation: nine-point and pedal circles */

{
  let worst = 0, cases = 0;
  for (let i = 0; i < Math.min(400, sample.length); i++) {
    const s = sample[i];
    const verts = [s.A, s.B, s.C, s.D];
    const keys = ["BCD", "ACD", "ABD", "ABC"];
    const gs = verts.map((p) => C.compute({ ...s, P: p }));
    if (gs.some((g) => g.degenerate)) continue;
    const eight = [];
    for (let k = 0; k < 4; k++) {
      eight.push(gs[k].circles[keys[k]], gs[k].nineCircles[keys[k]]);
    }
    if (eight.some((c) => !c || c.kind === "line" || !Number.isFinite(c.radius) || c.radius > 50000)) continue;
    const points = C.intersectCircles(eight[0], eight[6]) || [];
    if (!points.length) continue;
    let best = Infinity;
    for (const q of points) {
      let err = 0;
      for (const c of eight) err = Math.max(err, Math.abs(C.circleDistance(q, c)));
      best = Math.min(best, err);
    }
    if (!Number.isFinite(best)) continue;
    worst = Math.max(worst, best);
    cases++;
  }
  check("the generalisation was tested on many quadrangles", cases > 200, `${cases} cases`);
  check("the four nine-point circles and four opposite pedal circles share a point",
    worst < 1e-4, `max ${worst}`);
}

/* --------------------------- 5. the applet's own bytecode, transcribed twice */

{
  let feet = 0, centers = 0, radii = 0, kinds = 0, qs = 0, gaps = 0;
  for (const s of sample) {
    const core = C.compute(s);
    const applet = computeByApplet(s);
    if (core.degenerate || applet.degenerate) continue;
    for (const key of Object.keys(applet.feet)) {
      feet = Math.max(feet, length(applet.feet[key], core.feet[key]));
    }
    for (const key of Object.keys(applet.circles)) {
      const a = applet.circles[key], b = core.circles[key];
      if (a.kind !== b.kind) kinds++;
      if (a.kind === "circle" && b.kind === "circle") {
        centers = Math.max(centers, length(a.center, b.center));
        radii = Math.max(radii, Math.abs(a.radius - b.radius));
      }
    }
    qs = Math.max(qs, length(applet.Q, core.Q));
    gaps = Math.max(gaps, Math.abs(applet.gap - core.gap));
  }
  check("every LineCircle has the same kind in both transcriptions", kinds === 0, `${kinds} differences`);
  check("GeoSDoub.NearestPoint gives the same six feet on every configuration", feet < 1e-6, `max ${feet}`);
  check("GeoSDoub.FindCircumcenter gives the same circle centers", centers < 1e-6, `max ${centers}`);
  check("LineCircle.GetCircle gives the same mean radii", radii < 1e-6, `max ${radii}`);
  check("the applet's Midpoint of the two 'other' points matches the core's Q", qs < 1e-6, `max ${qs}`);
  check("the two 'other' intersections are the same distance apart", gaps < 1e-6, `max ${gaps}`);
  // A point P on a vertex of a cyclic quadrangle makes three pedal triangles
  // collapse onto Simson lines; LineCircle falls back to a line there too.
  const ring = [0.2, 1.4, 2.9, 4.7].map((u) => P(200 + 100 * Math.cos(u), 150 + 100 * Math.sin(u)));
  const edge = { A: ring[0], B: ring[1], C: ring[2], D: ring[3], P: ring[0] };
  const a = computeByApplet(edge), b = C.compute(edge);
  check("the Simson-line fallback agrees with the applet", !a.degenerate && !b.degenerate
    && ["ABC", "ACD", "ABD", "BCD"].every((k) => a.circles[k].kind === b.circles[k].kind)
    && length(a.Q, b.Q) < 1e-8);
  check("the applet's own Q is on the core's four pedal circles", (() => {
    const s = C.start(), g = C.compute(s), q = computeByApplet(s).Q;
    return C.CIRCLE_NAMES.every((key) => Math.abs(C.circleDistance(q, g.circles[key])) < 1e-8);
  })());
}

done("four-pedal-circles");
