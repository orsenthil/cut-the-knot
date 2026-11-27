#!/usr/bin/env node
"use strict";

/*
 * Logic test for conjugality/conjugality-core.js.
 *
 *   node porting/check-conjugality.mjs
 *
 * 1. The core's reflection is compared with a second, literal transcription of
 *    ConjugalityCanvas.DrawReflection and GeoSDoub's helper methods, over
 *    thousands of triangles and point placements in BOTH modes.
 * 2. The page's exact claim is checked exhaustively where the placement space
 *    is small: every collinear triple built from a grid of line parameters,
 *    with both the isotomic and the isogonal partners, plus the matching
 *    concurrent-cevian claim.
 * 3. The applet's IsInteresting classification (area < 300, meeting < 2),
 *    the involutions, the side-parameter moves and the edge cases are checked.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("conjugality/conjugality-core.js", "ConjugalityCore");

const P = (x, y) => ({ x, y });
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const nearPoint = (a, b, tol) => Boolean(a && b) && near(a.x, b.x, tol) && near(a.y, b.y, tol);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/* ------------------------------------------------- a second transcription */

// These five functions are written straight from javap of GeoSDoub and
// DoubLine, independently of the core's own helpers.
function apSq(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}
function apDist(a, b) { return Math.sqrt(apSq(a, b)); }
function apOrient(a, b, c) {
  const d = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return d > 0 ? 1 : -1;
}
function apAngle(a, b, c) {
  const v = (apSq(a, b) + apSq(a, c) - apSq(b, c)) /
    (2 * apDist(a, b) * apDist(a, c));
  const raw = Math.acos(Math.max(-1, Math.min(1, v)));
  // The 0.99 branch in ComputeSignedAngle can only fire for a negative sum
  // of squares, which never happens; orientation supplies the sign.
  return apOrient(a, b, c) * raw;
}
function apRotate(pivot, point, theta, sign) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return P(
    pivot.x + c * (point.x - pivot.x) - sign * s * (point.y - pivot.y),
    pivot.y + sign * s * (point.x - pivot.x) + c * (point.y - pivot.y),
  );
}
function apIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1 || !Number.isFinite(det)) return null; // Java: NaN point
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}
function apBisector(a, b, c) {
  const v = (apSq(a, b) + apSq(a, c) - apSq(b, c)) /
    (2 * apDist(a, b) * apDist(a, c));
  const half = Math.acos(Math.max(-1, Math.min(1, v))) / 2;
  return apIntersect(a, apRotate(a, b, half, apOrient(a, b, c)), b, c);
}
function apMid(a, b) { return P((a.x + b.x) / 2, (a.y + b.y) / 2); }

/* DrawReflection(g, Ai, Aj, Ak, Pk, Rf) in the applet's argument order. */
function appletDrawReflection(Ai, Aj, Ak, Pk, isotomic) {
  if (isotomic) {
    const m = apMid(Ai, Aj);
    return { point: P(2 * m.x - Pk.x, 2 * m.y - Pk.y), mark: m };
  }
  const theta = apAngle(Ak, Ai, Pk);
  const turned = apRotate(Ak, Aj, theta, -1);
  const point = apIntersect(Ak, turned, Ai, Aj);
  const mark = apBisector(Ak, Ai, Aj);
  return { point, mark };
}
function appletIsInteresting(A, Pts) {
  let s = 0;
  for (let i = 0; i < 3; i++) {
    const p = Pts[i], q = Pts[(i + 1) % 3];
    if (!Number.isFinite(p.x) || !Number.isFinite(q.x)) return 0;
    s += p.x * q.y - p.y * q.x;
  }
  if (Math.abs(s) < 300) return 1;
  const x = apIntersect(A[0], Pts[0], A[1], Pts[1]);
  const y = apIntersect(A[0], Pts[0], A[2], Pts[2]);
  if (!x || !y) return 0;
  return Math.abs(apDist(x, y)) < 2 ? 2 : 0;
}

/* -------------------------------------------------------- random diagrams */

function randomTriangle(next) {
  const a = [0, 1, 2].map((i) => 0.4 + i * 2.05 + (next() - 0.5) * 0.4);
  const r = 70 + next() * 90;
  return a.map((th) => P(200 + r * Math.cos(th), 200 + r * Math.sin(th)));
}
function ends(A, p) { return [A[(p + 1) % 3], A[(p + 2) % 3]]; }
function at(A, p, t) {
  const [a, b] = ends(A, p);
  return P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}
function stateOf(A, t, mode) {
  const s = C.start({ width: 400, height: 400, mode });
  return C.withSides({ ...s, A: A.map((p) => ({ ...p })), t: t.slice() });
}
function ratio(t0, t1) { return (t0 / (1 - t0)) * (t1 / (1 - t1)); }
function thirdFor(target, t0, t1) {
  const r = target / ratio(t0, t1);
  return r / (1 + r);
}
function area(p) {
  if (p.some((q) => !q)) return NaN;
  return p[0].x * (p[1].y - p[2].y) +
    p[1].x * (p[2].y - p[0].y) +
    p[2].x * (p[0].y - p[1].y);
}
function ceviansMeet(A, pts) {
  const x = apIntersect(A[0], pts[0], A[1], pts[1]);
  const y = apIntersect(A[0], pts[0], A[2], pts[2]);
  return Boolean(x && y && apDist(x, y) < 1e-6);
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the start has three corners, three side points and three parameters",
    [s.A.length, s.P.length, s.t.length], [3, 3, 3]);
  check("the default mode is the applet's isotomic", s.mode === "isotomic");
  check("the applet's start parameters lie in [0.1, 0.4]",
    s.t.every((t) => t >= 0.1 && t <= 0.4), JSON.stringify(s.t));
  check("side points lie on their side lines",
    s.P.every((p, i) => Math.abs(cross(...ends(s.A, i), p)) < 1e-9));
  equal("the legal moves are the six draggable points", C.legalMoves(),
    ["A0", "A1", "A2", "P0", "P1", "P2"]);
  check("an unknown move is refused", C.move(s, { name: "A9", point: P(0, 0) }) === null);
  check("a move without a point is refused", C.move(s, { name: "A0" }) === null);
  const moved = C.move(s, { name: "P0", point: P(123, 45) });
  check("a legal move returns a new position, leaving the old one alone",
    moved !== s && s.P[0].x !== moved.P[0].x &&
    Math.abs(cross(...ends(moved.A, 0), moved.P[0])) < 1e-9);
  equal("an unchanged mode option survives a move", moved.mode, s.mode);
  check("a non-interesting start has no result", C.result(s) === null);
}

/* --------------------------------- 2. the applet's own reflection, twice */

{
  const next = rng(70707);
  let sameIso = 0, sameIsoG = 0, involution = 0, markOk = 0, cases = 0;
  for (let k = 0; k < 2400; k++) {
    const A = randomTriangle(next);
    const p = k % 3;
    // Side-line placements beyond the segment are included on purpose: the
    // applet calls RestrictToSegment(false) for its three lines.
    const t = -0.6 + 2.2 * next();
    const Pk = at(A, p, t);
    for (const mode of ["isotomic", "isogonal"]) {
      const parr = [null, null, null]; parr[p] = Pk;
      const core = C.reflect(p, A, parr, mode);
      const ap = appletDrawReflection(...ends(A, p), A[p], Pk, mode === "isotomic");
      if (nearPoint(core.point, ap.point, 1e-7 * Math.max(1, apDist(Pk, A[p])))) sameIso++;
      if (nearPoint(core.mark, ap.mark, 1e-7 * Math.max(1, apDist(Pk, A[p])))) sameIsoG++;
      // Both maps are involutions on their side line.
      const back = [null, null, null]; back[p] = core.point;
      const again = C.reflect(p, A, back, mode).point;
      if (nearPoint(again, Pk, 1e-6 * Math.max(1, apDist(Pk, A[p])))) involution++;
      // The mark is the midpoint/bisector foot: it is fixed by the reflection.
      const fixed = [null, null, null]; fixed[p] = core.mark;
      if (core.mark && nearPoint(C.reflect(p, A, fixed, mode).point,
        core.mark, 1e-6 * Math.max(1, apDist(Pk, A[p])))) markOk++;
      cases++;
    }
  }
  check(`core = bytecode transcription for all ${cases} reflections`,
    sameIso === cases);
  check(`the applet's midpoint / bisector mark matches in all ${cases} cases`,
    sameIsoG === cases);
  check(`both conjugations are involutions in all ${cases} cases`,
    involution === cases);
  check(`the midpoint / bisector foot is fixed in all ${cases} cases`,
    markOk === cases);
}

/* -------------------------- 3. the page's collinearity claim, exhaustively */

{
  const next = rng(12345);
  // An 11 x 11 grid of pairs (t0,t1), each on a fresh random triangle. The
  // third parameter is forced by Menelaus' product -1. Both partners must be
  // collinear; the applet's own area classifier must report COLLINEAR.
  let tried = 0, isoOk = 0, isoGOk = 0, menelaus = 0, kindOk = 0, exact = 0;
  for (let i = 0; i < 121; i++) {
    const A = randomTriangle(next);
    const t0 = 0.16 + 0.07 * (i % 11);
    const t1 = 0.12 + 0.07 * Math.floor(i / 11);
    const t2 = thirdFor(-1, t0, t1);
    const t = [t0, t1, t2];
    for (const mode of ["isotomic", "isogonal"]) {
      const s = stateOf(A, t, mode);
      const d = C.compute(s);
      const scale = Math.max(1, ...d.P.map((p) => apDist(p, A[0])));
      if (Math.abs(d.areaP) < 1e-7 * scale * scale) exact++;
      if (near(d.ratio, -1, 1e-9)) menelaus++;
      if (d.reflectedCollinear && Math.abs(d.areaRf) < 1e-6 * scale * scale) {
        if (mode === "isotomic") isoOk++; else isoGOk++;
      }
      if (d.kind === 1) kindOk++;
      tried++;
    }
  }
  check(`all ${tried}: the constructed triple is exactly collinear`, exact === tried);
  check(`all ${tried}: its Menelaus product is -1`, menelaus === tried);
  check(`all ${tried}: isotomic partners are collinear`, isoOk === tried / 2);
  check(`all ${tried}: isogonal partners are collinear`, isoGOk === tried / 2);
  check(`all ${tried}: the applet classifies the triple as collinear`, kindOk === tried);
}

/* --------------------------- 4. the concurrent-cevian companion claim */

{
  const next = rng(98765);
  let cases = 0, ceva = 0, isoOk = 0, isoGOk = 0, kindOk = 0;
  for (let k = 0; k < 600; k++) {
    const A = randomTriangle(next);
    const t0 = 0.1 + 0.8 * next();
    const t1 = 0.1 + 0.8 * next();
    const t = [t0, t1, thirdFor(1, t0, t1)];
    for (const mode of ["isotomic", "isogonal"]) {
      const s = stateOf(A, t, mode);
      const d = C.compute(s);
      if (near(d.ratio, 1, 1e-9)) ceva++;
      // The reflected cevians must meet at one point as well.
      const q = d.Rf.map((pt, p) => pt);
      if (ceviansMeet(A, q)) {
        if (mode === "isotomic") isoOk++; else isoGOk++;
      }
      if (d.kind === 2) kindOk++;
      cases++;
    }
  }
  check(`all ${cases}: the chosen cevians have Ceva product 1`, ceva === cases);
  check(`all ${cases}: isotomic partners' cevians concur`, isoOk === cases / 2);
  check(`all ${cases}: isogonal partners' cevians concur`, isoGOk === cases / 2);
  check(`all ${cases}: the applet classifies the cevians as concurrent`, kindOk === cases);
}

/* ------------------------------ 5. classification and rules' edge cases */

{
  const A = [P(80, 300), P(320, 300), P(200, 60)];
  const generic = stateOf(A, [0.3, 0.25, 0.2], "isotomic");
  const next = rng(4242);
  let classAgree = 0, genericZero = 0, trials = 0;
  for (let k = 0; k < 800; k++) {
    const tri = randomTriangle(next);
    const ts = [0.1 + 0.8 * next(), 0.1 + 0.8 * next(), 0.1 + 0.8 * next()];
    const s = stateOf(tri, ts, "isotomic");
    const apKind = appletIsInteresting(s.A, s.P);
    const coreKind = C.isInteresting(s);
    if (apKind === coreKind) classAgree++;
    if (coreKind === 0) genericZero++;
    trials++;
  }
  check(`random placements: applet and core agree on the kind (${trials} cases)`,
    classAgree === trials);
  check("most random placements are neither collinear nor concurrent",
    genericZero > trials * 0.9);

  // Move a point just inside and just outside the applet's 300-unit area test.
  const midState = stateOf(A, [0.5, 0.5, 0.5], "isotomic");
  check("a point at a side midpoint is fixed by the isotomic reflection",
    midState.P.every((p, i) =>
      nearPoint(C.reflect(i, midState.A, midState.P, "isotomic").point, p, 1e-12)));
  const optState = C.start({ mode: "isogonal", showNames: true, showHint: true, rng: () => 0.3 });
  check("options are carried into a new position",
    optState.mode === "isogonal" && optState.showNames && optState.showHint);

  // Between and lineSegment follow the applet's 2-unit tolerance.
  const p = P(50, 50), q = P(0, 50), r = P(100, 50);
  check("Between accepts an interior point", C.between(p, q, r));
  check("Between rejects a point outside the segment", !C.between(P(-10, 50), q, r));
  equal("ShowLine draws the other two when p is between", C.lineSegment(p, q, r), [q, r]);

  // A move of a vertex carries its two side points with it.
  const before = C.start({});
  const after = C.movePoint(before, "A0", P(10, 10));
  check("dragging A0 moves A0 and rebuilds P1 and P2",
    after.A[0].x === 10 && (after.P[1].x !== before.P[1].x || after.P[1].y !== before.P[1].y) &&
    (after.P[2].x !== before.P[2].x || after.P[2].y !== before.P[2].y));
  check("dragging A0 leaves P0's parameter alone", after.t[0] === before.t[0]);

  const collinearState = stateOf(A, [0.3, 0.4, thirdFor(-1, 0.3, 0.4)], "isotomic");
  equal("result is done for a line", C.result(collinearState), "done");
  equal("result is done for concurrent cevians",
    C.result(stateOf(A, [0.4, 0.6, thirdFor(1, 0.4, 0.6)], "isotomic")), "done");
  equal("result is null for a generic diagram", C.result(generic), null);
  const cl = C.claims(collinearState);
  check("claims reports the page's theorem as verified here",
    cl.collinear && cl.verified && near(cl.ratio, -1, 1e-9));
}

/* ----------------------------- 6. degenerate and parallel configurations */

{
  const next = rng(31337);
  let agree = 0, cases = 0;
  const special = [0, 0.5, 1, -0.5, 1.5];
  for (let k = 0; k < 300; k++) {
    const A = randomTriangle(next);
    const p = k % 3;
    const t = special[k % special.length];
    const Pk = at(A, p, t);
    const parr = [null, null, null]; parr[p] = Pk;
    const core = C.reflect(p, A, parr, k % 2 ? "isogonal" : "isotomic");
    const ap = appletDrawReflection(...ends(A, p), A[p], Pk, k % 2 === 0);
    if (nearPoint(core.point, ap.point, 1e-6 * Math.max(1, apDist(Pk, A[p])))) agree++;
    cases++;
  }
  check(`endpoints and overhangs: core matches bytecode in all ${cases} cases`,
    agree === cases);

  // A point on the far side line can be reflected outside the drawn board;
  // the algebra still has to work for the tutor.
  const A = [P(0, 0), P(100, 0), P(30, 120)];
  const far = stateOf(A, [0.2, 0.3, thirdFor(-1, 0.2, 0.3)], "isogonal");
  const d = C.compute(far);
  check("a collinear triple with a far third point still verifies the claim",
    d.collinear && d.reflectedCollinear);
}

done("conjugality");
