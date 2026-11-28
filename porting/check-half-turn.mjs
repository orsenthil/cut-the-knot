#!/usr/bin/env node
"use strict";

/*
 * Logic test for half-turn/half-turn-core.js.
 *
 *   node porting/check-half-turn.mjs
 *
 * 1. Start, dragging, options, refusal and the demo's lack of a result.
 * 2. A second, literal transcription of the applet's DefinePoints(), Compute()
 *    and ReflectInPoint(), compared with the core for every seed 1..20 and
 *    every spinner value 1..10, including dragged arrows and centers.
 * 3. Every claim on the cut-the-knot page, checked over those configurations:
 *    S_O^2 = I, the only fixed point, isometry, orientation, lines through the
 *    center, even = translation, odd = half turn with AA_n and BB_n meeting at
 *    its center, and non-commutation. The page's "for any n, AA_n = BB_n and
 *    AA_n || BB_n" is tested honestly: it holds only for even n, and the test
 *    pins an odd-n counterexample.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("half-turn/half-turn-core.js", "HalfTurnCore");

const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;
const same = (p, q, eps = 1e-8) => near(p.x, q.x, eps) && near(p.y, q.y, eps);
const vec = (p, q) => ({ x: q.x - p.x, y: q.y - p.y });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const len = (a) => Math.hypot(a.x, a.y);
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/** line(a,b) with line(c,d); null when parallel. */
function intersect(a, b, c, d) {
  const r = vec(a, b), s = vec(c, d);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(vec(a, c), s) / den;
  return { x: a.x + r.x * t, y: a.y + r.y * t };
}

/* ---- a second transcription, straight from the bytecode of HalfTurnCanvas ---- */

/** Math.random() replaced by the same seeded generator used by the core. */
function appletNext(s) {
  let x = (s >>> 0) || 1;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >> 17;
  x ^= x << 5;
  x >>>= 0;
  return { value: x / 4294967296, state: x >>> 0 };
}

/** DefinePoints(int): x = W/2 + (2*random-1)*W/6, y = H/2 + ... */
function appletDefinePoints(n, seed) {
  const w = C.WIDTH, h = C.HEIGHT, spread = 6;
  let s = seed;
  const centers = [];
  for (let i = 0; i < n; i++) {
    const rx = appletNext(s);
    s = rx.state;
    const ry = appletNext(s);
    s = ry.state;
    centers.push({ x: w / 2 + (2 * rx.value - 1) * w / spread,
                   y: h / 2 + (2 * ry.value - 1) * h / spread });
  }
  return centers;
}

/** ReflectInPoint(MoveablePoint, DoubPoint): new MoveablePoint(2*o.x - p.x, ...). */
function appletReflect(p, o) {
  return { x: 2.0 * o.x - p.x, y: 2.0 * o.y - p.y };
}

/** Compute(): End reflected first, Start second, then (Start, End) of the copy. */
function appletCompute(a, b, centers, n) {
  const segments = [{ start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y } }];
  let previous = segments[0];
  for (let i = 0; i < n; i++) {
    const o = centers[i];
    const end = appletReflect(previous.end, o);
    const start = appletReflect(previous.start, o);
    previous = { start, end };
    segments.push(previous);
  }
  return segments;
}

/** init(): A = (W/2, H/3) with integer division, B = A + (30, 40). */
function appletStart(n, seed) {
  const a = { x: C.WIDTH / 2, y: Math.floor(C.HEIGHT / 3) };
  const b = { x: a.x + 30, y: a.y + 40 };
  const centers = appletDefinePoints(n, seed);
  return { a, b, centers, segments: appletCompute(a, b, centers, n) };
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the opening spinner value is 3", s.n, 3);
  equal("the opening centers are those of DefinePoints(3)", s.centers.length, 3);
  same("the opening arrow starts at (W/2, H/3)", s.a, { x: 230, y: 120 });
  same("the opening arrow is 30 by 40 from A", s.b, { x: 260, y: 160 });
  check("both presentation boxes start unchecked", !s.showNames && !s.showStatement);
  check("a demonstration has no result", C.result(s) === null);
  check("the applet's spinner range is 1..10", C.N_MIN === 1 && C.N_MAX === 10);
}

{
  const s = C.start({});
  const bad = [null, undefined, 0, "n", {}, { type: "point" },
    { type: "point", which: "a", point: { x: NaN, y: 1 } },
    { type: "point", which: "center", index: 99, point: { x: 1, y: 2 } },
    { type: "option", key: "n", value: "abc" },
    { type: "option", key: "size", value: 5 },
    { type: "frobnicate" }];
  check("bad moves are refused", bad.every((m) => C.move(s, m) === null));
  const dragged = C.move(s, { type: "point", which: "a", point: { x: 90, y: 70 } });
  same("dragging A moves A", dragged.a, { x: 90, y: 70 });
  check("dragging A leaves B and the centers alone", same(dragged.b, s.b) &&
    everySame(dragged.centers, s.centers));
  check("moves do not change the old position", same(s.a, { x: 230, y: 120 }) && s.moves === 0);
  const center = C.move(s, { type: "point", which: "center", index: 1, point: { x: 310, y: 55 } });
  same("dragging center 2 moves center 2", center.centers[1], { x: 310, y: 55 });
  const legal = C.legalMoves(s);
  check("the legal-move list offers all ten spinner values",
    legal.filter((m) => m.type === "option" && m.key === "n").length === 10);
  check("the legal-move list has a reset and new centers",
    legal.some((m) => m.type === "reset") && legal.some((m) => m.type === "newCenters"));
}

function everySame(a, b) {
  return a.length === b.length && a.every((p, i) => same(p, b[i]));
}

{
  const s = C.start({});
  const low = C.move(s, { type: "option", key: "n", value: 0 });
  const high = C.move(s, { type: "option", key: "n", value: 99 });
  equal("the spinner clamps at 1", low.n, 1);
  equal("the spinner clamps at 10", high.n, 10);
  const grown = C.move(s, { type: "option", key: "n", value: 10 });
  equal("raising N gives ten centers", grown.centers.length, 10);
  const lowered = C.move(grown, { type: "option", key: "n", value: 2 });
  equal("lowering N keeps the old center vector, as SetN does", lowered.centers.length, 10);
  equal("but only the first two are used", C.compute(lowered).segments.length, 3);
  const flags = C.move(C.move(s, { type: "option", key: "showNames", value: true }),
    { type: "option", key: "showStatement", value: true });
  check("both checkboxes can be ticked together", flags.showNames && flags.showStatement);
  check("ticking boxes never invents a win", C.result(flags) === null);
}

/* ----------------------------- 2. against the applet's own methods, in full */

{
  let centerMismatch = 0;
  let segmentMismatch = 0;
  let compositionMismatch = 0;
  let chainMismatch = 0;
  let cases = 0;
  for (let seed = 1; seed <= 20; seed++) {
    for (let n = C.N_MIN; n <= C.N_MAX; n++) {
      const ours = C.start({ n, seed });
      const theirs = appletStart(n, seed);
      if (!everySame(ours.centers, theirs.centers)) centerMismatch++;

      // Drag both arrow ends and one center, then compare Compute() again.
      let dragged = C.move(ours, { type: "point", which: "a", point: { x: 100 + seed, y: 60 + n } });
      dragged = C.move(dragged, { type: "point", which: "b", point: { x: 330 - seed, y: 290 - n } });
      const ci = (seed + n) % n;
      dragged = C.move(dragged, { type: "point", which: "center", index: ci,
        point: { x: 170 + n * 3, y: 90 + seed * 2 } });
      const got = C.compute(dragged).segments;
      const want = appletCompute(dragged.a, dragged.b, dragged.centers, n);
      if (got.length !== want.length || !got.every((s, i) =>
          same(s.start, want[i].start) && same(s.end, want[i].end))) segmentMismatch++;

      // The chain really applies the next reflection to the previous copy.
      for (let i = 1; i < got.length; i++) {
        const o = dragged.centers[i - 1];
        if (!same(got[i].start, C.reflect(got[i - 1].start, o)) ||
            !same(got[i].end, C.reflect(got[i - 1].end, o))) chainMismatch++;
      }

      // The closed form of the composition against n literal reflections.
      const p = { x: 37 + seed, y: 111 + n };
      let hand = { x: p.x, y: p.y };
      for (let i = 0; i < n; i++) hand = appletReflect(hand, dragged.centers[i]);
      const comp = C.composition(dragged);
      const fast = { x: comp.sign * p.x + comp.t.x, y: comp.sign * p.y + comp.t.y };
      if (!same(hand, fast, 1e-7) || !same(fast, C.image(dragged, p), 1e-7)) compositionMismatch++;
      cases++;
    }
  }
  equal(`DefinePoints() matched the core in ${cases} configurations (seed 1..20, n 1..10)`, centerMismatch, 0);
  equal(`Compute() matched the core in ${cases} configurations, including dragged points`, segmentMismatch, 0);
  equal(`each copy is the reflection of the one before it in ${cases} configurations`, chainMismatch, 0);
  equal(`the closed form matched n literal reflections in ${cases} configurations`, compositionMismatch, 0);
}

/* ------------------------------------------- 3. the page's claims, exhaustively */

{
  let notInvolution = 0;
  let wrongFixedPoint = 0;
  let lineNotFixed = 0;
  let distanceMismatch = 0;
  let angleMismatch = 0;
  let orientationFlipped = 0;
  let parallelMismatch = 0;
  const p = { x: 57, y: 83 }, q = { x: 177, y: 41 }, r = { x: 123, y: 209 };
  for (let seed = 1; seed <= 20; seed++) {
    const s = C.start({ n: 1, seed });
    const o = s.centers[0];
    const p1 = C.reflect(p, o);
    if (!same(C.reflect(p1, o), p)) notInvolution++;
    if (same(p1, p, 1e-12) && !same(p, o, 1e-12)) wrongFixedPoint++;
    if (!same(C.reflect(o, o), o)) wrongFixedPoint++;
    // Every line through O is fixed as a set: O + t*(p-O) must land back on it.
    const dir = vec(o, p);
    for (let k = -3; k <= 3; k++) {
      const onLine = { x: o.x + k * dir.x, y: o.y + k * dir.y };
      const image = C.reflect(onLine, o);
      if (Math.abs(cross(dir, vec(onLine, image))) > 1e-7) lineNotFixed++;
    }

    for (let n = 1; n <= 10; n++) {
      const state = C.start({ n, seed });
      const a = C.image(state, p), b = C.image(state, q), c = C.image(state, r);
      if (!near(len(vec(a, b)), len(vec(p, q))) ||
          !near(len(vec(b, c)), len(vec(q, r))) ||
          !near(len(vec(a, c)), len(vec(p, r)))) distanceMismatch++;
      const cosBefore = cross(vec(p, q), vec(p, r)) === 0 ? null :
        (vec(p, q).x * vec(p, r).x + vec(p, q).y * vec(p, r).y) /
        (len(vec(p, q)) * len(vec(p, r)));
      const cosAfter = (vec(a, b).x * vec(a, c).x + vec(a, b).y * vec(a, c).y) /
        (len(vec(a, b)) * len(vec(a, c)));
      if (cosBefore !== null && !near(cosBefore, cosAfter)) angleMismatch++;
      if (Math.sign(cross(vec(p, q), vec(p, r))) !== Math.sign(cross(vec(a, b), vec(a, c)))) orientationFlipped++;
      const parallelVec = vec(q, r);
      if (Math.abs(cross(vec(C.image(state, { x: 10, y: 20 }),
        C.image(state, { x: 10 + parallelVec.x, y: 20 + parallelVec.y })), parallelVec)) > 1e-7) parallelMismatch++;
    }
  }
  equal("S_O(S_O(P)) = P in 20 centers", notInvolution, 0);
  equal("O is the only fixed point of S_O", wrongFixedPoint, 0);
  equal("each line through O is fixed as a set", lineNotFixed, 0);
  equal("half turns preserve all three distances in 200 configurations", distanceMismatch, 0);
  equal("half turns preserve angles in 200 configurations", angleMismatch, 0);
  equal("half turns preserve orientation in 200 configurations", orientationFlipped, 0);
  equal("parallel segments stay parallel in 200 configurations", parallelMismatch, 0);
}

{
  let evenTranslationFailures = 0;
  let evenSegmentFailures = 0;
  let oddMeetFailures = 0;
  let oddMidpointFailures = 0;
  let testedOddLines = 0;
  for (let seed = 1; seed <= 20; seed++) {
    for (let n = 1; n <= 10; n++) {
      const s = C.start({ n, seed });
      const chain = C.compute(s);
      const A0 = s.a, B0 = s.b, An = chain.aPoints[n], Bn = chain.bPoints[n];
      const comp = C.composition(s);
      if (n % 2 === 0) {
        // Even: the whole arrow is translated by t, so AA_n = BB_n = t.
        if (!same(vec(A0, An), comp.t) || !same(vec(B0, Bn), comp.t)) evenTranslationFailures++;
        if (!same(vec(A0, B0), vec(An, Bn))) evenSegmentFailures++;
      } else {
        // Odd: both AA_n and BB_n are chords through the half-turn center.
        if (!same(mid(A0, An), comp.center) || !same(mid(B0, Bn), comp.center)) oddMidpointFailures++;
        const meet = intersect(A0, An, B0, Bn);
        const degenerate = same(A0, comp.center) || same(B0, comp.center);
        if (!degenerate) {
          testedOddLines++;
          if (!meet || !same(meet, comp.center, 1e-6)) oddMeetFailures++;
        }
      }
    }
  }
  equal(`even n: AA_n = BB_n = t in all 100 even configurations`, evenTranslationFailures, 0);
  equal("even n: the arrow itself is unchanged in all 100 even configurations", evenSegmentFailures, 0);
  equal("odd n: AA_n and BB_n share their midpoint, the half-turn center", oddMidpointFailures, 0);
  equal(`odd n: AA_n and BB_n meet at the fixed center in ${testedOddLines} non-degenerate cases`, oddMeetFailures, 0);
  check("some odd configurations really have two non-degenerate chords", testedOddLines >= 90);
}

{
  // The page says "For any n, AA_n = BB_n, AA_n || BB_n". Check that honestly.
  let evenParallelFailures = 0;
  let oddCounterexamples = 0;
  for (let seed = 1; seed <= 20; seed++) {
    for (let n = 2; n <= 10; n += 2) {
      const s = C.start({ n, seed });
      const chain = C.compute(s);
      const aa = vec(s.a, chain.aPoints[n]);
      const bb = vec(s.b, chain.bPoints[n]);
      if (!same(aa, bb) || Math.abs(cross(aa, bb)) > 1e-7) evenParallelFailures++;
    }
    const odd = C.start({ n: 3, seed });
    const chain = C.compute(odd);
    const aa = vec(odd.a, chain.aPoints[3]);
    const bb = vec(odd.b, chain.bPoints[3]);
    if (!same(aa, bb) || Math.abs(cross(aa, bb)) > 1e-7) oddCounterexamples++;
  }
  equal("the page's AA_n = BB_n and AA_n || BB_n holds for every even n", evenParallelFailures, 0);
  check(`the page's "for any n" is false: ${oddCounterexamples}/20 odd cases contradict it`,
    oddCounterexamples === 20);

  // A concrete counterexample, used word for word in the maths section.
  const a = { x: 230, y: 120 }, b = { x: 260, y: 160 };
  const centers = [{ x: 200, y: 150 }, { x: 280, y: 200 }, { x: 240, y: 140 }];
  const segs = appletCompute(a, b, centers, 3);
  const aa = vec(a, segs[3].start), bb = vec(b, segs[3].end);
  same("the worked A_3 really is (90, 60)", segs[3].start, { x: 90, y: 60 });
  same("the worked B_3 really is (60, 20)", segs[3].end, { x: 60, y: 20 });
  check("the worked odd case has AA_3 != BB_3 and AA_3 not parallel to BB_3",
    !near(len(aa), len(bb)) && Math.abs(cross(aa, bb)) > 1);
  const meet = intersect(a, segs[3].start, b, segs[3].end);
  same("both chords of the worked case meet at O_3 - O_2 + O_1 = (160, 90)", meet, { x: 160, y: 90 });
}

{
  let commutationFailures = 0;
  let equalOnlyForSameCenter = 0;
  let twiceFailures = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const s = C.start({ n: 2, seed });
    const O = s.centers[0], Q = s.centers[1];
    const p = { x: 61 + seed, y: 17 };
    const oq = appletReflect(p, Q);
    const oqThenO = appletReflect(oq, O);      // S_O S_Q
    const op = appletReflect(p, O);
    const opThenQ = appletReflect(op, Q);      // S_Q S_O
    if (!same(oqThenO, { x: p.x + 2 * (O.x - Q.x), y: p.y + 2 * (O.y - Q.y) })) commutationFailures++;
    if (!same(opThenQ, { x: p.x + 2 * (Q.x - O.x), y: p.y + 2 * (Q.y - O.y) })) commutationFailures++;
    if (!same(oqThenO, opThenQ) && !near(len(vec(oqThenO, opThenQ)), 4 * len(vec(O, Q)))) commutationFailures++;
    if (same(oqThenO, opThenQ)) equalOnlyForSameCenter++;
    if (!same(appletReflect(appletReflect(p, O), O), p)) twiceFailures++;
  }
  equal("S_O S_Q and S_Q S_O are opposite translations 2(O-Q) and 2(Q-O)", commutationFailures, 0);
  equal("distinct centers never commute in the 20 sampled pairs", equalOnlyForSameCenter, 0);
  equal("two reflections in the same center are the identity", twiceFailures, 0);
  const origin = { x: 100, y: 100 };
  same("the two opposite translations agree when O = Q",
    appletReflect(appletReflect(origin, origin), origin),
    appletReflect(appletReflect(origin, origin), origin));
}

{
  let badNewCenters = 0;
  let badReset = 0;
  let nonzeroResults = 0;
  const s = C.start({ n: 4, seed: 7 });
  for (const m of C.legalMoves(s)) {
    const next = C.move(s, m);
    if (!next || next.n < C.N_MIN || next.n > C.N_MAX || C.result(next) !== null) nonzeroResults++;
  }
  const fresh = C.move(s, { type: "newCenters" });
  if (!fresh || fresh.centers.length !== 4 || everySame(fresh.centers, s.centers)) badNewCenters++;
  const again = C.move(fresh, { type: "newCenters" });
  if (!again || everySame(again.centers, fresh.centers)) badNewCenters++;
  const reset = C.move(C.move(s, { type: "point", which: "b", point: { x: 5, y: 5 } }), { type: "reset" });
  if (!reset || !same(reset.b, s.b) || !everySame(reset.centers, s.centers)) badReset++;
  equal("no legal move ever creates a win or loss", nonzeroResults, 0);
  equal("New centers gives a new, full set of centers", badNewCenters, 0);
  equal("Reset restores the opening arrow and centers", badReset, 0);

  const zero = C.move(s, { type: "point", which: "b", point: { x: s.a.x, y: s.a.y } });
  const zeroChain = C.compute(zero);
  check("a collapsed arrow still computes every copy (drawn as a dot)",
    zeroChain.segments.every((seg) => same(seg.start, seg.end)));
}

done("half-turn");
