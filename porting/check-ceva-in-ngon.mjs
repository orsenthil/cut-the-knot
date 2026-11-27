#!/usr/bin/env node
"use strict";

/*
 * Logic test for ceva-in-ngon/ceva-in-ngon-core.js.
 *
 *   node porting/check-ceva-in-ngon.mjs
 *
 * Transcribed first from CevaInNgonCanvas.Reset / Compute, GeoSDoub.Intersect
 * and InsideTest.IsInside (the compact bytecode in `node porting/disasm.mjs
 * CevaInNgon --all`), this check compares the core with a second, literal
 * implementation of those methods on every odd n from 3 to 21 and thousands
 * of random configurations. It then checks both claims of the article: the
 * number of inside cross points is odd, and the product of the signed ratios
 * is 1. It also tests the reciprocity of the "opposite side" relation and the
 * article's weaker statement about P outside the polygon: for a convex
 * polygon it is one, but for a concave one an outside P can have 3, 5, ...
 * cross points (still an odd number). The maths section says so.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("ceva-in-ngon/ceva-in-ngon-core.js", "CevaInNgonCore");

const close = (a, b, tol = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol = 1e-6) =>
  Boolean(p && q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);

/* --------------------------- second transcription, straight from bytecode */

/* CevaInNgonCanvas.Reset: width/2, width*10/19, radius width/4, jitter π/n. */
function appletStart(n, random) {
  const size = 360;
  const cx = size / 2, cy = (size * 10) / 19, r = size / 4;
  const vertices = [];
  for (let i = 0; i < n; i++) {
    const theta = ((2 * Math.PI) / n) * i + (random() * Math.PI) / n;
    vertices.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
  }
  return { n, vertices, p: { x: cx, y: cy } };
}

/* GeoSDoub.Intersect(p1,p2,p3,p4), ax+by+c=0 form, NaN when |det| < 1. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y;
  const b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y;
  const b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  return Math.abs(det) < 1
    ? { x: NaN, y: NaN }
    : { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* InsideTest.IsInside(s,a,b): (s-a)·(s-b) <= 0. */
function appletInside(s, a, b) {
  return (s.x - a.x) * (s.x - b.x) + (s.y - a.y) * (s.y - b.y) <= 0;
}

/* CevaInNgonCanvas.Compute: half = N/2; k = (m+half)%N, k1 = (m+half+1)%N. */
function appletCompute(state) {
  const half = Math.floor(state.n / 2);
  const cross = [], inside = [];
  for (let m = 0; m < state.n; m++) {
    const k = (m + half) % state.n;
    const k1 = (m + half + 1) % state.n;
    const s = appletIntersect(state.p, state.vertices[m], state.vertices[k], state.vertices[k1]);
    cross.push(s);
    inside.push(appletInside(s, state.vertices[k], state.vertices[k1]));
  }
  return { cross, inside, count: inside.filter(Boolean).length };
}

/* Oriented area ratio [P A B] / [P B C], the article's A_k B / B A_k+1. */
function appletRatio(state, m) {
  const half = Math.floor(state.n / 2);
  const k = (m + half) % state.n;
  const k1 = (m + half + 1) % state.n;
  const A = state.vertices[k], B = state.vertices[k1];
  const X = appletIntersect(state.p, state.vertices[m], A, B);
  const signedArea = (U, V, W) =>
    (V.x - U.x) * (W.y - U.y) - (V.y - U.y) * (W.x - U.x);
  return signedArea(state.p, A, X) / signedArea(state.p, X, B);
}

/* ------------------------------------------ 1. the applet's own constants */

{
  check("the spinner's lower bound is 3", C.MIN_N === 3);
  check("the spinner's upper bound is 21", C.MAX_N === 21);
  check("the spinner steps by 2, so n stays odd", C.STEP_N === 2);
  check("the spinner starts at 5", C.DEFAULT_N === 5);
  check("3 is accepted unchanged", C.normalizeN(3) === 3);
  check("21 is accepted unchanged", C.normalizeN(21) === 21);
  check("an even value is rejected", C.normalizeN(8) === 7);
  check("a value above the range is capped at 21", C.normalizeN(99) === 21);
  check("a value below the range is raised to 3", C.normalizeN(1) === 3);
}

/* -------------------------------- 2. the starting picture and its options */

{
  const random = rng(1234);
  const expected = appletStart(5, random);
  const actual = C.start({ n: 5, random: rng(1234) });
  equal("start has the applet's n", actual.n, 5);
  equal("start has the applet's centre P", actual.p, expected.p);
  check("start has one vertex per n", actual.vertices.length === 5);
  for (let i = 0; i < 5; i++) {
    check(`start vertex ${i} matches Reset()`, closePoint(actual.vertices[i], expected.vertices[i]));
  }
  const next = C.withN(actual, 9);
  check("changing n resets the number of vertices", next.n === 9 && next.vertices.length === 9);
  const before = { ...next.vertices[3] };
  const moved = C.withPoint(next, "V3", { x: 12, y: 34 });
  check("withPoint moves one vertex", closePoint(moved.vertices[3], { x: 12, y: 34 }, 0));
  check("withPoint leaves the old position alone", closePoint(next.vertices[3], before, 0));
  const movedP = C.withPoint(next, "P", { x: 7, y: 9 });
  check("withPoint can move P", closePoint(movedP.p, { x: 7, y: 9 }, 0));
  check("an unknown handle is ignored", C.withPoint(next, "X", { x: 1, y: 2 }) === next);
}

/* ----------------------- 3. the opposite-side relation and its reciprocity */

{
  let pairs = 0, reciprocal = 0;
  for (let n = 3; n <= 21; n += 2) {
    const s = C.start({ n, random: () => 0 });
    const seen = new Set();
    for (let m = 0; m < n; m++) {
      const [k, k1] = C.oppositeSide(s, m);
      equal(`n=${n}, vertex ${m} uses integer n/2`, k, (m + Math.floor(n / 2)) % n);
      equal(`n=${n}, the side ends at k+1`, k1, (k + 1) % n);
      seen.add(k);
      const [mk, mk1] = C.oppositeSide(s, k1);
      if (mk === m && mk1 === (m + 1) % n) reciprocal++;
      pairs++;
    }
    check(`n=${n}: every side is opposite exactly one vertex`, seen.size === n);
  }
  check(`reciprocity holds for all ${pairs} vertex/side pairs`, reciprocal === pairs);
}

/* --------------- 4. Compute() against the second transcription, all n, many P */

{
  const rand = rng(20261126);
  let compared = 0, generic = 0, odd = 0, productOk = 0;
  for (let n = 3; n <= 21; n += 2) {
    for (let trial = 0; trial < 250; trial++) {
      const state = appletStart(n, rand);
      /* The applet allows P anywhere on the canvas, including outside. */
      state.p = { x: rand() * 360, y: rand() * 360 };
      const mine = C.compute(state);
      const theirs = appletCompute(state);
      if (mine.cross.length !== n || mine.count !== theirs.count) {
        check(`n=${n}, trial ${trial}: cross-point count matches Compute()`, false);
        continue;
      }
      for (let m = 0; m < n; m++) {
        /* Both return NaN when the two lines are parallel: JSON shows those
         * as null, and neither implementation has a cross point to compare. */
        const bothMissing = !mine.cross[m] && !Number.isFinite(theirs.cross[m].x);
        if (!bothMissing && (!closePoint(mine.cross[m], theirs.cross[m], 1e-6) ||
            mine.isInside[m] !== theirs.inside[m])) {
          check(`n=${n}, trial ${trial}, m=${m}: cross point and inside flag match Compute()`, false,
            `core ${JSON.stringify(mine.cross[m])}/${mine.isInside[m]}, ` +
            `bytecode ${JSON.stringify(theirs.cross[m])}/${theirs.inside[m]}`);
        }
      }
      compared++;
      if (!C.isGeneric(state)) continue;
      generic++;
      const cl = C.claims(state);
      if (cl.oddCrossings) odd++;
      if (cl.productIsOne) productOk++;
      /* The article's ratio, computed from signed areas, must agree too. */
      let product = 1;
      for (let m = 0; m < n; m++) {
        const r = C.ratio(state, m);
        const r2 = appletRatio(state, m);
        product *= r;
        if (!close(r, r2, 1e-6)) {
          check(`n=${n}, trial ${trial}, m=${m}: signed ratio matches the area formula`, false,
            `core ${r}, areas ${r2}`);
        }
      }
      if (!close(product, 1, 1e-6)) {
        check(`n=${n}, trial ${trial}: the product of signed ratios is 1`, false, `${product}`);
      }
      /* A negative ratio means the cross point is outside its side. */
      let negatives = 0;
      for (let m = 0; m < n; m++) if (C.ratio(state, m) < 0) negatives++;
      if (negatives % 2 !== 0) check(`n=${n}, trial ${trial}: an even number of outside cross points`, false);
    }
  }
  check(`Compute() agrees on all ${compared} configurations`, compared === 10 * 250);
  check(`at least 2000 of those configurations are generic`, generic > 2000);
  check(`the inside-cross-point count is odd in all ${generic} generic cases`, odd === generic);
  check(`the signed-ratio product is 1 in all ${generic} generic cases`, productOk === generic);
}

/* ------------------- 5. the article's "outside P gives one" claim, qualified */

/* Ray casting: is P inside the (possibly concave) polygon? */
function insidePolygon(p, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

{
  const rand = rng(31415);
  let convexOutside = 0, convexOne = 0, concaveOutside = 0, concaveMore = 0;
  for (const concave of [false, true]) {
    for (let n = 3; n <= 21; n += 2) {
      for (let trial = 0; trial < 250; trial++) {
        const s = appletStart(n, rand);
        /* Pull one vertex into the middle to make a concave polygon. */
        if (concave && n >= 5) s.vertices[Math.floor(n / 2)] = { x: 180, y: 180 };
        s.p = { x: -60 + rand() * 480, y: -60 + rand() * 480 };
        if (!C.isGeneric(s) || insidePolygon(s.p, s.vertices)) continue;
        const cl = C.claims(s);
        check(`outside P always gives an odd number of cross points`, cl.oddCrossings);
        if (!concave) {
          convexOutside++;
          if (cl.count === 1) convexOne++;
        } else {
          concaveOutside++;
          if (cl.count > 1) concaveMore++;
        }
      }
    }
  }
  check(`there are many convex configurations with P outside`, convexOutside > 1000);
  /* The article says "with P outside the polygon, the number is 1". That is
   * true for the convex polygons the applet starts with ... */
  check(`outside a convex polygon, the count is always 1`, convexOne === convexOutside);
  /* ... but not for the concave polygons the article also allows: there the
   * count can be 3, 5, ... while staying odd. */
  check(`there are many concave configurations with P outside`, concaveOutside > 1000);
  check(`outside a concave polygon, the count can exceed 1`, concaveMore > 0);
}

/* --------------------------- 6. an inside P and the exceptional positions */

{
  const rand = rng(777);
  let inside = 0, all = 0;
  for (let n = 3; n <= 21; n += 2) {
    for (let trial = 0; trial < 80; trial++) {
      const s = appletStart(n, rand);
      if (!C.isGeneric(s)) continue;
      inside++;
      if (C.claims(s).count === n) all++;
    }
  }
  check(`P at the centre gives one cross point per side (n of them)`, inside > 700 && all === inside);

  /* Collinear vertex and P: the applet's |det| < 1 test yields NaN. */
  const flat = { n: 3, vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }], p: { x: 0, y: 0 } };
  check(`a coincident P and vertex is degenerate`, C.claims(flat) === null);
  /* The opposite side of V0 is V1V2, direction (-50,80); put P on the line
   * through V0 with that direction, so the two lines never meet. */
  const parallel = { n: 3, vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }], p: { x: -50, y: 80 } };
  check(`a parallel cevian and opposite side are degenerate`, C.claims(parallel) === null);
  check("the inside test counts the ends of a side as inside",
    C.inside({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }));
  check("the inside test rejects a point beyond the end of a side",
    !C.inside({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }));
}

done("ceva-in-ngon");
