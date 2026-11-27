#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-crossing-circles/four-crossing-circles-core.js.
 *
 *   node porting/check-four-crossing-circles.mjs
 *
 * The page makes two claims: (Oa) cuts A1B1 and A2B2 in equal chords (and so
 * does (Ob)), and A1A2/B1B2 = Ra/Rb.  This checks both over a dense grid and
 * seeded random positions, and rebuilds the whole construction a second way,
 * from FourCrossingCirclesCanvas.Compute() and GeoSDoub's X/Y branches, to
 * compare every centre, intersection and chord with the core.  It also checks
 * the start position, the five draggable points, the two show options, Reset,
 * the degenerate cases and the fact that the illustration has no outcome.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-crossing-circles/four-crossing-circles-core.js", "FourCrossingCirclesCore");
const P = (x, y) => ({ x: x, y: y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const same = (p, q, tol = 1e-5) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const maxOf = (xs) => xs.reduce((m, x) => Math.max(m, x), 0);

/* --------------------------------- the applet's method, transcribed twice */

/* Second transcription of GeoSDoub.FindCircumcenter: solve the two
 * perpendicular-bisector equations instead of intersecting their offsets. */
function circumcircle2(p, q, r) {
  const a1 = 2 * (q.x - p.x), b1 = 2 * (q.y - p.y), c1 = q.x * q.x + q.y * q.y - p.x * p.x - p.y * p.y;
  const a2 = 2 * (r.x - q.x), b2 = 2 * (r.y - q.y), c2 = r.x * r.x + r.y * r.y - q.x * q.x - q.y * q.y;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return null;
  const c = P((c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det);
  return { c: c, r: (dist(c, p) + dist(c, q) + dist(c, r)) / 3 };
}

/* Second transcription of the circle/circle intersection: project a centre
 * onto the radical axis and step h along it.  The X/Y choice and the order of
 * the two answers follow the bytecode, because Other() uses the first one. */
function circleCircle2(c1, c2) {
  if (Math.abs(c1.c.x - c2.c.x) > 1) {
    const m = (c2.c.y - c1.c.y) / (c1.c.x - c2.c.x);
    const n = (c1.c.x * c1.c.x - c2.c.x * c2.c.x +
               c1.c.y * c1.c.y - c2.c.y * c2.c.y -
               c1.r * c1.r + c2.r * c2.r) / (2 * (c1.c.x - c2.c.x));
    const A = 1 + m * m;
    const footY = (c1.c.y + m * (c1.c.x - n)) / A;
    const foot = P(m * footY + n, footY);
    const h2 = c1.r * c1.r - dist(foot, c1.c) ** 2;
    if (h2 < -1e-6 * c1.r * c1.r) return null;
    const off = Math.sqrt(Math.max(0, h2) / A);
    const one = P(m * (footY + off) + n, footY + off);
    const two = P(m * (footY - off) + n, footY - off);
    return m >= 0 ? [one, two] : [two, one];
  }
  if (Math.abs(c1.c.y - c2.c.y) > 1) {
    const m = (c2.c.x - c1.c.x) / (c1.c.y - c2.c.y);
    const n = (c1.c.y * c1.c.y - c2.c.y * c2.c.y +
               c1.c.x * c1.c.x - c2.c.x * c2.c.x -
               c1.r * c1.r + c2.r * c2.r) / (2 * (c1.c.y - c2.c.y));
    const A = 1 + m * m;
    const footX = (c1.c.x + m * (c1.c.y - n)) / A;
    const foot = P(footX, m * footX + n);
    const h2 = c1.r * c1.r - dist(foot, c1.c) ** 2;
    if (h2 < -1e-6 * c1.r * c1.r) return null;
    const off = Math.sqrt(Math.max(0, h2) / A);
    const one = P(footX + off, m * (footX + off) + n);
    const two = P(footX - off, m * (footX - off) + n);
    return m >= 0 ? [one, two] : [two, one];
  }
  return [P(c1.c.x, c1.c.y), P(c1.c.x, c1.c.y)];
}

/* Second transcription of GeoSDoub.Intersect(DoubLine,DoubCircle). */
function lineCircle2(p, q, circle) {
  if (Math.abs(p.y - q.y) > 1) {
    const m = (p.x - q.x) / (p.y - q.y), n = q.x - m * q.y;
    const A = 1 + m * m;
    const footY = (circle.c.y + m * (circle.c.x - n)) / A;
    const foot = P(m * footY + n, footY);
    const h2 = circle.r * circle.r - dist(foot, circle.c) ** 2;
    if (h2 < -1e-6 * circle.r * circle.r) return null;
    const off = Math.sqrt(Math.max(0, h2) / A);
    return [P(m * (footY + off) + n, footY + off), P(m * (footY - off) + n, footY - off)];
  }
  if (Math.abs(p.x - q.x) > 1) {
    const m = (p.y - q.y) / (p.x - q.x), n = q.y - m * q.x;
    const A = 1 + m * m;
    const footX = (circle.c.x + m * (circle.c.y - n)) / A;
    const foot = P(footX, m * footX + n);
    const h2 = circle.r * circle.r - dist(foot, circle.c) ** 2;
    if (h2 < -1e-6 * circle.r * circle.r) return null;
    const off = Math.sqrt(Math.max(0, h2) / A);
    return [P(footX + off, m * (footX + off) + n), P(footX - off, m * (footX - off) + n)];
  }
  return null;
}

/* The applet's literal Other(): only its first candidate is tested. */
function otherJava(pts, known) {
  if (!pts) return null;
  return dist(pts[0], known) < 3 ? (pts[1] || pts[0]) : pts[0];
}

/* The port's Other(): the farther intersection, which is what the page's
 * theorem needs when the two roots are listed the other way round. */
function other2(pts, known) {
  if (!pts) return null;
  if (pts.length < 2) return pts[0];
  return dist(pts[0], known) >= dist(pts[1], known) ? pts[0] : pts[1];
}

/** FourCrossingCirclesCanvas.Compute(), method for method, independent helpers. */
function appletGeometry(A, B, C, D, O) {
  if (dist(C, A) < 2 || dist(C, B) < 2 || dist(D, A) < 2 || dist(D, B) < 2 ||
      dist(A, B) < 2 || dist(O, A) < 2 || dist(O, B) < 2) return null;
  const circle1 = circumcircle2(C, A, B), circle2 = circumcircle2(D, A, B);
  if (!circle1 || !circle2) return null;
  const Ra = dist(O, A), Rb = dist(O, B);
  const circleA = { c: O, r: Ra }, circleB = { c: O, r: Rb };
  const A1 = other2(circleCircle2(circleA, circle1), A);
  const A2 = other2(circleCircle2(circleA, circle2), A);
  const B1 = other2(circleCircle2(circleB, circle1), B);
  const B2 = other2(circleCircle2(circleB, circle2), B);
  if (![A1, A2, B1, B2].every((p) => p && Number.isFinite(p.x))) return null;
  const Aq1 = lineCircle2(A1, B1, circleA), Aq2 = lineCircle2(A2, B2, circleA);
  const Bq1 = lineCircle2(A1, B1, circleB), Bq2 = lineCircle2(A2, B2, circleB);
  const chord = (pts) => (pts && pts.length === 2 ? dist(pts[0], pts[1]) : null);
  if (![Aq1, Aq2, Bq1, Bq2].every((pts) => pts)) return null;
  return {
    circle1: circle1, circle2: circle2, circleA: circleA, circleB: circleB,
    A1: A1, A2: A2, B1: B1, B2: B2,
    Aq1: Aq1, Aq2: Aq2, Bq1: Bq1, Bq2: Bq2,
    Ra: Ra, Rb: Rb,
    chordA1: chord(Aq1), chordA2: chord(Aq2),
    chordB1: chord(Bq1), chordB2: chord(Bq2),
    sepA: dist(A1, A2), sepB: dist(B1, B2),
  };
}

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  check("the five draggable points are A, B, C, D and O",
    JSON.stringify(C.legalMoves(s)) === JSON.stringify(["A", "B", "C", "D", "O"]));
  check("A starts at the applet's (width/2, 2*height/5)", same(s.A, P(200, 104)));
  check("B starts at (width/2, height/2)", same(s.B, P(200, 130)));
  check("C starts at half of A's x and A's y", same(s.C, P(100, 104)));
  check("D starts two thirds from B to the right edge", same(s.D, P(200 + 200 * 2 / 3, 130)));
  check("O starts halfway between C and D at three quarters height",
    same(s.O, P((100 + 200 + 200 * 2 / 3) / 2, 195)));
  check("both show options start off, as the applet's checkboxes do",
    s.options.names === false && s.options.hint === false);
  check("an illustration has no outcome", C.result(s) === null);
  check("the starting drawing is not empty", !!C.geometry(s));

  const moved = C.move(s, "O", P(250, 210));
  check("dragging O changes O and marks the illustration explored",
    same(moved.O, P(250, 210)) && !s.explored && moved.explored);
  check("dragging a point does not change the other four",
    ["A", "B", "C", "D"].every((k) => same(moved[k], s[k])));
  check("dragging off the canvas is clamped", same(C.move(s, "D", P(9999, -20)).D, P(395, 5)));
  check("an unknown handle is refused", C.move(s, "Z", P(1, 1)) === s);
  check("a non-finite drag is refused", C.move(s, "C", P(NaN, 1)) === s);

  const ticked = C.setOption(s, "hint", true);
  check("toggling an option keeps the old state immutable",
    ticked.options.hint && !s.options.hint && !s.explored && ticked.explored);
  check("an unknown option is refused", C.setOption(s, "other", true) === s);
  check("Reset restores the start and keeps the options",
    same(C.reset(moved).O, s.O) && C.reset(ticked).options.hint === true);
  check("a point too close to another makes the applet stop drawing",
    C.geometry(C.move(s, "O", P(200 + 1, 104))) === null);
  check("the status line reports the radius ratio", C.describe(s).includes("Ra/Rb"));
}

/* ------------------------------- 2. every claim, over hundreds of drawings */

const cases = [];
for (const A of [P(190, 100), P(200, 104), P(205, 110)]) {
  for (const B of [P(200, 130), P(215, 125), P(225, 140)]) {
    for (const Cc of [P(90, 100), P(100, 104), P(120, 90), P(110, 150)]) {
      for (const D of [P(310, 130), P(333, 130), P(300, 160)]) {
        for (const O of [P(200, 190), P(216, 195), P(240, 200)]) {
          cases.push({ A: A, B: B, C: Cc, D: D, O: O });
        }
      }
    }
  }
}
const rnd = rng(4972);
for (let i = 0; i < 500; i++) {
  const r = () => 15 + rnd() * 370;
  cases.push({ A: P(r(), r()), B: P(r(), r()), C: P(r(), r()), D: P(r(), r()), O: P(r(), r()) });
}

let live = 0, comparable = 0, valueAgree = 0, chordA = 0, chordB = 0, ratios = 0;
let onCircles = 0, quirk = 0, maxChordErr = 0, maxRatioErr = 0, maxPointErr = 0;
for (const pos of cases) {
  const g = C.geometry(pos);
  if (!g) continue;
  live++;
  const scale = Math.max(1, g.Ra, g.Rb);
  const tol = scale * 1e-6;

  // Claim 1: the circle centred at O cuts the two lines in equal chords.
  if (near(g.chordA1, g.chordA2, tol)) chordA++;
  if (near(g.chordB1, g.chordB2, tol)) chordB++;
  maxChordErr = maxOf([maxChordErr,
    Math.abs(g.chordA1 - g.chordA2), Math.abs(g.chordB1 - g.chordB2)]);

  // Claim 2: A1A2/B1B2 = Ra/Rb.
  if (near(g.sepA / g.sepB, g.Ra / g.Rb, tol) && g.sepB > 0) ratios++;
  maxRatioErr = Math.max(maxRatioErr, Math.abs(g.sepA / g.sepB - g.Ra / g.Rb));

  // The named points really do lie on the circles the page describes.
  const on = [g.A1, g.A2].every((p) => near(dist(p, g.O), g.Ra, tol)) &&
             [g.B1, g.B2].every((p) => near(dist(p, g.O), g.Rb, tol)) &&
             near(dist(g.A1, g.circle1.c), g.circle1.r, tol) &&
             near(dist(g.B1, g.circle1.c), g.circle1.r, tol) &&
             near(dist(g.A2, g.circle2.c), g.circle2.r, tol) &&
             near(dist(g.B2, g.circle2.c), g.circle2.r, tol);
  if (on) onCircles++;

  // The second transcription of the applet must agree on every drawn point.
  const x = appletGeometry(pos.A, pos.B, pos.C, pos.D, pos.O);
  if (!x) continue;
  const javaPick = [
    otherJava(circleCircle2(x.circleA, x.circle1), pos.A),
    otherJava(circleCircle2(x.circleA, x.circle2), pos.A),
    otherJava(circleCircle2(x.circleB, x.circle1), pos.B),
    otherJava(circleCircle2(x.circleB, x.circle2), pos.B),
  ];
  if (!same(javaPick[0], g.A1, 1e-4) || !same(javaPick[1], g.A2, 1e-4) ||
      !same(javaPick[2], g.B1, 1e-4) || !same(javaPick[3], g.B2, 1e-4)) quirk++;
  comparable++;
  const pairs = [
    [g.circle1.c, x.circle1.c], [g.circle2.c, x.circle2.c],
    [g.A1, x.A1], [g.A2, x.A2], [g.B1, x.B1], [g.B2, x.B2],
    [g.Aq1[0], x.Aq1[0]], [g.Aq1[1], x.Aq1[1]],
    [g.Aq2[0], x.Aq2[0]], [g.Aq2[1], x.Aq2[1]],
    [g.Bq1[0], x.Bq1[0]], [g.Bq1[1], x.Bq1[1]],
    [g.Bq2[0], x.Bq2[0]], [g.Bq2[1], x.Bq2[1]],
  ];
  if (pairs.every(([a, b]) => same(a, b, 1e-4))) {
    const radii = [g.circle1.r, x.circle1.r, g.circle2.r, x.circle2.r, g.Ra, x.Ra, g.Rb, x.Rb];
    const others = [g.chordA1, x.chordA1, g.chordA2, x.chordA2,
                    g.chordB1, x.chordB1, g.chordB2, x.chordB2];
    if (radii.every((v, i) => near(v, radii[i + (i % 2 ? -1 : 1)], 1e-4)) &&
        others.every((v, i) => near(v, others[i + (i % 2 ? -1 : 1)], 1e-4))) valueAgree++;
    maxPointErr = Math.max(maxPointErr, ...pairs.map(([a, b]) => dist(a, b)));
  }
}

check("enough non-degenerate drawings were generated", live > 300, `${live} drawings`);
check("the second applet transcription covered nearly every drawing",
  comparable >= live - 2, `${comparable}/${live}`);
check("the second transcription agrees on every drawn point and radius",
  valueAgree === comparable && maxPointErr < 1e-4,
  `${valueAgree}/${comparable}, worst point error ${maxPointErr.toExponential(2)}`);
check("the applet's first-candidate-only Other() quirk was exercised", quirk > 0,
  `${quirk} drawings where the literal applet would mispick`);
check("claim 1: circle A cuts lines A1B1 and A2B2 in equal chords",
  chordA === live, `${chordA}/${live}`);
check("claim 1: circle B cuts lines B1B1 and B2B2 in equal chords",
  chordB === live, `${chordB}/${live}`);
check("claim 2: A1A2/B1B2 = Ra/Rb in every drawing", ratios === live, `${ratios}/${live}`);
check("the chord errors stay at round-off level", maxChordErr < 1e-4, `${maxChordErr}`);
check("the ratio error stays at round-off level", maxRatioErr < 1e-6, `${maxRatioErr}`);
check("A1, A2, B1 and B2 lie on the circles named in the page", onCircles === live,
  `${onCircles}/${live}`);
check("the status line describes a valid drawing", C.describe(cases[0]).startsWith("Ra "));

/* --------------------------------------------- 3. the applet's own quirk */

{
  // GetAppletInfo() still says "Pythagorean Theorem, Proof #36": a leftover
  // from a sibling applet, contradicted by this page.  Nothing in the drawing
  // uses that name, and the port follows the page's four-crossing-circles text.
  const s = C.start({});
  const g = C.geometry(s);
  check("the title string of the applet is not part of the rules",
    typeof g === "object" && !("pythagorean" in g));
  check("the drawing has exactly four circles",
    [g.circle1, g.circle2, g.circleA, g.circleB].every((c) => c && c.r > 0));
  check("the two circles about O have different radii unless A and B are equidistant",
    g.Ra > 0 && g.Rb > 0 && !near(g.Ra, g.Rb, 1e-9));
  equal("the five handles are all still draggable after a reset", C.legalMoves(C.reset(s)),
    ["A", "B", "C", "D", "O"]);
}

done("four-crossing-circles");
