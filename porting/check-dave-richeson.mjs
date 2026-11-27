#!/usr/bin/env node
"use strict";

/*
 * Logic test for dave-richeson/dave-richeson-core.js.
 *
 *   node porting/check-dave-richeson.mjs
 *
 * Covers the whole spinner range 3..30 against a second transcription of the
 * applet's Diagonals/Diagonal/Reorder methods, its GetIncircle bisector
 * construction against the textbook incenter formula, and both of the page's
 * claims: the signed sum is the same for every triangulation (enumerated
 * exhaustively for 4..9 vertices) and the old convex fan sum is independent
 * of the vertex chosen (5..12 vertices).  Random configurations on up to 30
 * vertices, including non-convex orders, check the extension too.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("dave-richeson/dave-richeson-core.js", "DaveRichesonCore");
const TAU = 2 * Math.PI;
const R = C.RADIUS;
const wrap = (a) => ((a % TAU) + TAU) % TAU;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("the default polygon has the applet's six vertices", s.n === 6 && s.points.length === 6);
  check("a three-vertex polygon is allowed", C.start({ n: 3 }).n === 3);
  check("the spinner clamps at 3 and 30", C.start({ n: 2 }).n === 3 && C.start({ n: 31 }).n === 30);
  check("the spinner takes whole numbers", C.start({ n: 6.7 }).n === 7);
  check("an illustration has no win or loss",
    C.result(s) === null && C.result(C.moveVertex(s, 0, { x: 300, y: 100 })) === null);

  let counts = true, onCircle = true;
  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    const t = C.start({ n, seed: n });
    if (t.triangles.length !== n - 2 || t.diagonals.length !== n - 3) counts = false;
    for (const p of t.points) if (!near(dist(p, C.CENTER), R, 1e-8)) onCircle = false;
  }
  check("every N from 3 to 30 has N-2 triangles and N-3 diagonals", counts);
  check("every starting vertex lies on the circumcircle", onCircle);
  check("all vertices can be dragged", C.start({ n: 12 }).points.length === C.legalMoves(C.start({ n: 12 })).length);
  check("an illegal move is refused", C.move(s, { type: "point", index: 9, point: { x: 1, y: 1 } }) === null);
  check("moving a vertex keeps it on the circle",
    near(dist(C.moveVertex(s, 2, { x: 400, y: 90 }).points[2], C.CENTER), R, 1e-8));
}

/* ----------------------------- 2. the same triangulation as the applet code */

/* A literally separate transcription of Diagonals/Diagonal/Reorder from
 * DaveRichesonCanvas. `draws` stands in for the applet's Math.random() calls. */
function appletTriangulate(n, draws) {
  const D = [], T = [];
  let v = Array.from({ length: n }, (_, i) => i);
  let at = 0;
  function diagonal() {
    if (v.length < 4) { T.push(v.slice()); return null; }
    const k = Math.floor(draws[at++] * v.length);
    const prev = (k - 1 + v.length) % v.length;
    const next = (k + 1) % v.length;
    T.push([v[prev], v[k], v[next]]);
    return { indices: [prev, next], endpoints: [v[prev], v[next]] };
  }
  function diagonals() {
    const d = diagonal();
    if (!d) return;
    D.push(d.endpoints);
    const old = v;
    v = new Array(old.length - 1);
    for (let i = 0; i < v.length; i++) v[i] = old[(d.indices[1] + i) % old.length];
    diagonals();
  }
  diagonals();
  return { triangles: T, diagonals: D, draws: at };
}

{
  let allMatch = true, drawCount = true;
  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    for (let trial = 0; trial < 12; trial++) {
      const random = rng(n * 100 + trial);
      const draws = Array.from({ length: n }, () => random());
      const mine = C.triangulate(C.start({ n }), draws);
      const applet = appletTriangulate(n, draws);
      if (JSON.stringify(mine.triangles) !== JSON.stringify(applet.triangles) ||
          JSON.stringify(mine.diagonals) !== JSON.stringify(applet.diagonals)) allMatch = false;
      if (applet.draws !== Math.max(0, n - 3)) drawCount = false;
    }
  }
  check("the transcribed ear clipping matches the core for all N 3..30 and 12 draw sequences each", allMatch);
  check("ear clipping uses exactly N-3 random draws, as the applet does", drawCount);

  const exact = C.start({ n: 6 });
  check("the exact number of draws succeeds", C.triangulate(exact, [0.1, 0.5, 0.9]).triangles.length === 4);
  let refused = false;
  try { C.triangulate(exact, [0.1, 0.5]); } catch (_) { refused = true; }
  check("too few draws are refused rather than silently reused", refused);

  const changed = C.start({ n: 8 });
  const re = C.triangulate(changed, [0.1, 0.2, 0.3, 0.4, 0.5]);
  check("retiangulating changes the cuts but not the polygon",
    JSON.stringify(changed.points) === JSON.stringify(re.points) && re.explored === true);
}

/* ------------------------------------------ 3. the incircles, two ways */

/* GeoSDoub.FindIncenter + GetIncircle, written again straight from javap. */
function appletIncircle(a, b, c) {
  function sq(p, q) { return (p.x - q.x) ** 2 + (p.y - q.y) ** 2; }
  function angle(v, p, q) {
    const cos = (sq(v, p) + sq(v, q) - sq(p, q)) / (2 * Math.sqrt(sq(v, p) * sq(v, q)));
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  }
  function cross(p, q, s) {
    return s.x * (p.y - q.y) + s.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  }
  const sign = cross(a, b, c) > 0 ? 1 : -1;
  function turn(pivot, point, t) {
    const co = Math.cos(t), si = Math.sin(t);
    const dx = point.x - pivot.x, dy = point.y - pivot.y;
    return { x: pivot.x + co * dx - sign * si * dy, y: pivot.y + sign * si * dx + co * dy };
  }
  const rayA = turn(a, b, angle(a, b, c) / 2);
  const rayB = turn(b, c, angle(b, c, a) / 2);
  const A = a.y - rayA.y, B = rayA.x - a.x, Cc = a.x * rayA.y - a.y * rayA.x;
  const D = b.y - rayB.y, E = rayB.x - b.x, F = b.x * rayB.y - b.y * rayB.x;
  const den = A * E - D * B;
  const I = { x: (B * F - E * Cc) / den, y: (Cc * D - F * A) / den };
  function foot(p, q, s) {
    const dx = s.x - q.x, dy = s.y - q.y;
    const t = (dx * (p.x - q.x) + dy * (p.y - q.y)) / (dx * dx + dy * dy);
    return { x: q.x + dx * t, y: q.y + dy * t };
  }
  return {
    x: I.x, y: I.y,
    r: (dist(I, foot(I, a, b)) + dist(I, foot(I, b, c)) + dist(I, foot(I, c, a))) / 3,
    sign,
  };
}

/* The textbook incircle: side-length-weighted incenter and area / semiperimeter. */
function textbookIncircle(a, b, c) {
  const la = dist(b, c), lb = dist(a, c), lc = dist(a, b);
  const per = la + lb + lc;
  const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
  return {
    x: (la * a.x + lb * b.x + lc * c.x) / per,
    y: (la * a.y + lb * b.y + lc * c.y) / per,
    r: area / (per / 2),
  };
}

function sumWith(points, triangles, incircle) {
  return triangles.reduce((acc, t) => {
    const a = points[t[0]], b = points[t[1]], c = points[t[2]];
    return acc + C.orientation(a, b, c) * incircle(a, b, c).r;
  }, 0);
}

{
  const random = rng(9001);
  let bytecodeMax = 0, bookMax = 0, formulaMax = 0, signOk = true;
  let cases = 0;
  for (let n = 3; n <= 30; n++) {
    for (let trial = 0; trial < 8; trial++) {
      const angles = Array.from({ length: n }, () => random() * TAU);
      const state = { n, points: angles.map((a) => C.pointAt(a)), seed: 1, triangles: [], diagonals: [] };
      const s = C.triangulate(state, Array.from({ length: n }, () => random()));
      const g = C.geometry(s);
      for (let i = 0; i < s.triangles.length; i++) {
        const t = s.triangles[i];
        const p = s.points[t[0]], q = s.points[t[1]], r = s.points[t[2]];
        const circle = g.circles[i];
        const byBytecode = appletIncircle(p, q, r);
        const byBook = textbookIncircle(p, q, r);
        bytecodeMax = Math.max(bytecodeMax, Math.abs(circle.x - byBytecode.x),
          Math.abs(circle.y - byBytecode.y), Math.abs(circle.r - byBytecode.r));
        bookMax = Math.max(bookMax, Math.abs(circle.x - byBook.x),
          Math.abs(circle.y - byBook.y), Math.abs(circle.r - byBook.r));
        signOk = signOk && circle.sign === byBytecode.sign;
        const A = Math.acos(Math.max(-1, Math.min(1,
          (dist(p, q) ** 2 + dist(p, r) ** 2 - dist(q, r) ** 2) / (2 * dist(p, q) * dist(p, r)))));
        const B = Math.acos(Math.max(-1, Math.min(1,
          (dist(q, r) ** 2 + dist(q, p) ** 2 - dist(r, p) ** 2) / (2 * dist(q, r) * dist(q, p)))));
        const Cc = Math.PI - A - B;
        formulaMax = Math.max(formulaMax,
          Math.abs(circle.r - R * (Math.cos(A) + Math.cos(B) + Math.cos(Cc) - 1)));
        cases++;
      }
    }
  }
  check(`the applet's bisector incircles match the core (${cases} triangles)`, bytecodeMax < 1e-6,
    `max error ${bytecodeMax}`);
  check(`the textbook incenter and area formula agree (${cases} triangles)`, bookMax < 1e-7,
    `max error ${bookMax}`);
  check("triangle orientation matches the applet's Java cross-product sign", signOk);
  check("each incircle radius equals R(cos A + cos B + cos C - 1)", formulaMax < 1e-7,
    `max error ${formulaMax}`);
  check("coincident corners give a finite zero-radius circle, not NaN",
    Number.isFinite(C.incircle({ x: 1, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }).r));
}

/* -------------------------------------------------- 4. the page's claims */

/* Every possible sequence of the applet's random ear choices, not just a
 * sample of triangulations.  k is fed as (k + 0.5)/length so floor(r*n)=k. */
function allChoiceSequences(n) {
  const out = [];
  function go(len, acc) {
    if (len < 4) { out.push(acc.slice()); return; }
    for (let k = 0; k < len; k++) { acc.push((k + 0.5) / len); go(len - 1, acc); acc.pop(); }
  }
  go(n, []);
  return out;
}

function convexInvariant(angles) {
  const n = angles.length;
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.cos(wrap(angles[(i + 1) % n] - angles[i]) / 2);
  return R * (total - (n - 2));
}

{
  const random = rng(4242);
  for (let n = 4; n <= 9; n++) {
    const sequences = allChoiceSequences(n);
    check(`there are n!/6 = ${sequences.length} choice sequences at n=${n}`,
      sequences.length === Math.floor((function fact(k) { return k <= 1 ? 1 : k * fact(k - 1); })(n) / 6));
    let worstSpread = 0, worstFormula = 0;
    for (let config = 0; config < 4; config++) {
      // positive gaps, so the polygon is convex and the angles increase
      const gaps = Array.from({ length: n }, () => 0.2 + random() * 2);
      const total = gaps.reduce((a, b) => a + b, 0);
      const angles = [random() * 0.01];
      for (let i = 0; i < n - 1; i++) angles.push(angles[i] + (TAU * gaps[i]) / total);
      const points = angles.map((a) => C.pointAt(a));
      const state = { n, points, seed: 1, triangles: [], diagonals: [] };
      const sums = sequences.map((draws) => sumWith(points, C.triangulate(state, draws).triangles, textbookIncircle));
      worstSpread = Math.max(worstSpread, Math.max(...sums) - Math.min(...sums));
      worstFormula = Math.max(worstFormula, Math.max(...sums.map((s) => Math.abs(s - convexInvariant(angles)))));
    }
    check(`convex n=${n}: every triangulation has the same signed sum over 4 shapes`,
      worstSpread < 1e-6, `spread ${worstSpread}`);
    check(`convex n=${n}: the sum is R(sum of cos(gap/2) - (n-2))`,
      worstFormula < 1e-6, `error ${worstFormula}`);
  }
}

{
  // The original theorem: a fan from any vertex of a convex polygon.
  const random = rng(777);
  let worst = 0;
  for (let n = 5; n <= 12; n++) {
    const gaps = Array.from({ length: n }, () => 0.5 + random() * 2);
    const total = gaps.reduce((a, b) => a + b, 0);
    const angles = [0.3];
    for (let i = 0; i < n - 1; i++) angles.push(angles[i] + (TAU * gaps[i]) / total);
    const points = angles.map((a) => C.pointAt(a));
    const sums = [];
    for (let start = 0; start < n; start++) {
      const fan = [];
      for (let i = 1; i <= n - 2; i++) fan.push([
        start, (start + i) % n, (start + i + 1) % n,
      ]);
      sums.push(sumWith(points, fan, textbookIncircle));
    }
    worst = Math.max(worst, Math.max(...sums) - Math.min(...sums),
      Math.abs(sums[0] - convexInvariant(angles)));
  }
  check("the old fan theorem holds from every vertex, n=5..12", worst < 1e-7, `spread ${worst}`);
}

{
  const random = rng(13579);
  for (let n = 4; n <= 8; n++) {
    const sequences = allChoiceSequences(n);
    const base = Array.from({ length: n }, (_, i) => (TAU * i) / n + 0.07);
    let worst = 0, mixed = false;
    for (let trial = 0; trial < 12; trial++) {
      const angles = base.slice().sort(() => random() - 0.5); // non-convex order
      const points = angles.map((a) => C.pointAt(a));
      const state = { n, points, seed: 1, triangles: [], diagonals: [] };
      const sums = sequences.map((draws) => sumWith(points, C.triangulate(state, draws).triangles, textbookIncircle));
      worst = Math.max(worst, Math.max(...sums) - Math.min(...sums));
      const g = C.geometry(C.triangulate(state, sequences[0]));
      if (g.red > 0) mixed = true;
    }
    check(`non-convex cyclic n=${n}: all ${sequences.length} triangulations agree`,
      worst < 1e-6, `spread ${worst}`);
    if (n >= 5) check(`non-convex n=${n} really produces negative (red) triangles`, mixed);
  }
}

{
  const random = rng(2024);
  let worst = 0, tested = 0;
  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    for (let trial = 0; trial < 10; trial++) {
      const angles = Array.from({ length: n }, () => random() * TAU);
      const state = { n, points: angles.map((a) => C.pointAt(a)), seed: 1, triangles: [], diagonals: [] };
      const d1 = Array.from({ length: n }, () => random());
      const d2 = Array.from({ length: n }, () => random());
      const a = C.geometry(C.triangulate(state, d1)).sum;
      const b = C.geometry(C.triangulate(state, d2)).sum;
      worst = Math.max(worst, Math.abs(a - b));
      tested++;
    }
  }
  check(`the sum survives retiangulation in ${tested} random configurations up to N=30`,
    worst < 1e-6, `spread ${worst}`);
}

{
  const s = C.start({ n: 9, seed: 123 });
  const copy = C.triangulate(JSON.parse(JSON.stringify(s)), [0.2, 0.4, 0.6, 0.8, 0.1, 0.3]);
  check("a saved position is plain data and reopens unchanged",
    JSON.stringify(copy.points) === JSON.stringify(s.points) && copy.n === 9);
  check("the status line quotes the signed sum and both circle counts",
    C.describe(s).includes(C.geometry(s).sum.toFixed(2)) &&
    C.describe(s).includes(`${C.geometry(s).blue} blue`));
  check("the triangulation button follows the applet's own move dispatch",
    C.move(s, { type: "triangulate" }) !== null && C.move(s, { type: "n", value: 11 }).n === 11);
  check("an N change regenerates a regular polygon",
    C.geometry(C.setN(s, 10)).circles.length === 8);
}

done("dave-richeson");
