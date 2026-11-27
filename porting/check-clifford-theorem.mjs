#!/usr/bin/env node
"use strict";

/*
 * Logic test for clifford-theorem/clifford-theorem-core.js.
 *
 *   node porting/check-clifford-theorem.mjs
 *
 * There are four parts:
 *  1. the applet's opening picture, ordering, tolerance and the eight tries;
 *  2. a second, independent transcription of CliffordTheoremCanvas and its
 *     GeoSDoub helpers, taken instruction by instruction from the bytecode,
 *     compared with the core on thousands of configurations, including the
 *     touching, concentric and aligned edge cases;
 *  3. the page's claims, on chains built so that the z-points are exactly
 *     concyclic: the w-points always are too, several red/blue pairs can
 *     occur, Gerald Brown's orthogonal circles give a rectangle, and
 *     the page's (5) is not the product of (1)-(4), not even up to a real
 *     factor, but (1)(3) / ((2)(4)) on arbitrary points (checked explicitly);
 *  4. the three pairs of mouseTracker eyes.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("clifford-theorem/clifford-theorem-core.js", "CliffordTheoremCore");
const rand = rng(20261126);

/* --------------------------------------------------- 1. the opening picture */

{
  const s = C.start({});
  check("an illustration is never over", C.result(s) === null);
  equal("init's first centre (600x450)", [s[0].center.x, s[0].center.y].join(","), "245,170");
  equal("init's first rim point", [s[0].rim.x, s[0].rim.y].join(","), "180,105");
  equal("the four centres go round the middle", s.map((c) =>
    `${c.center.x},${c.center.y}`).join(" "), "245,170 355,170 355,280 245,280");
  const a = C.analyse(s);
  check("the opening circles chain in the order 0123", a.order && a.order.join("") === "0123");
  check("the opening picture shows red/blue Clifford circles", a.found.length >= 2,
    `${a.found.length} pairs`);
  check("one pair is the two rings of radius about 91.9",
    a.found.some((f) => Math.abs(f.red.r - 91.924) < 0.01 && Math.abs(f.blue.r - 91.924) < 0.01));
  const moved = C.withPoint(s, 0, "center", { x: 250, y: 171 });
  check("withPoint leaves the old position alone", s[0].center.x === 245 && moved[0].center.x === 250);
  check("a bad point or unknown circle is ignored",
    C.withPoint(s, 9, "rim", { x: 1, y: 2 }) === s &&
    C.withPoint(s, 0, "rim", { x: NaN, y: 2 }) === s);
  const shifted = C.shiftCircle(s, 2, 3, 4);
  check("shiftCircle carries centre and rim together",
    shifted[2].center.x === s[2].center.x + 3 && shifted[2].rim.y === s[2].rim.y + 4);
  const apart = C.shiftCircle(s, 2, 600, 0);
  check("a circle that meets none of its neighbours gives no ordering", C.analyse(apart).order === null);

  // Found by exhaustive sampling of the applet's three orderings.
  const fallback = C.start({ circles: [
    { center: { x: 168.29, y: 212.10 }, rim: { x: 248.69, y: 141.79 } },
    { center: { x: 225.45, y: 339.62 }, rim: { x: 272.92, y: 261.18 } },
    { center: { x: 232.10, y: 101.74 }, rim: { x: 201.28, y: 137.71 } },
    { center: { x: 322.78, y: 200.08 }, rim: { x: 436.06, y: 194.63 } },
  ] });
  check("when 0123 fails, the first suitable ordering 0132 is used",
    C.analyse(fallback).order && C.analyse(fallback).order.join("") === "0132");

  // DoTheyIntersect is strict: touching circles are not a chaining pair.
  const tangent = C.start({ circles: [
    { center: { x: 100, y: 200 }, rim: { x: 150, y: 200 } },
    { center: { x: 200, y: 200 }, rim: { x: 250, y: 200 } },
    { center: { x: 100, y: 320 }, rim: { x: 150, y: 320 } },
    { center: { x: 200, y: 320 }, rim: { x: 250, y: 320 } },
  ] });
  check("externally tangent circles do not satisfy DoTheyIntersect",
    !C.meet(C.circles(tangent)[0], C.circles(tangent)[1]));
  const pair = C.intersectCircles(C.circles(tangent)[0], C.circles(tangent)[1]);
  check("touching circles give one doubled crossing point",
    pair && C.distance(pair[0], pair[1]) < 1e-9, JSON.stringify(pair));
  const concentric = C.intersectCircles({ x: 200, y: 150, r: 50 }, { x: 200, y: 150, r: 80 });
  check("concentric circles fall into the doubled-centre branch",
    concentric[0].x === 200 && concentric[0].y === 150 && C.distance(concentric[0], concentric[1]) === 0);
  check("three collinear crossings give NaN, not a crash",
    !Number.isFinite(C.findCircumcenter({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }).x) &&
    C.analyse(C.start({ circles: [
      { center: { x: 100, y: 100 }, rim: { x: 130, y: 100 } },
      { center: { x: 200, y: 200 }, rim: { x: 230, y: 200 } },
      { center: { x: 300, y: 300 }, rim: { x: 330, y: 300 } },
      { center: { x: 400, y: 400 }, rim: { x: 430, y: 400 } },
    ] })).found.length === 0);
}

/* --------------------------- 2. a second transcription of the applet's code */

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint): locals d4..d20. */
function bytecodeLine(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const d20 = a1 * b2 - a2 * b1;
  if (Math.abs(d20) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / d20, y: (c1 * a2 - c2 * a1) / d20 };
}

/* GeoSDoub.FindCircumcenter: the two perpendicular bisectors, then Intersect. */
function bytecodeCentre(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  return bytecodeLine(m1,
    { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) }, m2,
    { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) });
}

/* GeoSDoub.IntersectCirclesX: locals d2, d4, d6, d8, d10, d12, d14, d18, d20. */
function bytecodeCircleX(A, B) {
  const d2 = -(A.y - B.y) / (A.x - B.x);
  const d4 = (A.x * A.x - B.x * B.x + A.y * A.y - B.y * B.y
    - A.r * A.r + B.r * B.r) / (2 * (A.x - B.x));
  const d6 = d4 - A.x;
  const d8 = d2 * d2 + 1;
  const d10 = d2 * d6 - A.y;
  const d12 = d6 * d6 + A.y * A.y - A.r * A.r;
  const d14 = d10 * d10 - d8 * d12;
  if (d14 < 0) return null;
  const root = Math.sqrt(d14);
  const d18 = (-d10 + root) / d8, d20 = (-d10 - root) / d8;
  return [{ x: d2 * d18 + d4, y: d18 }, { x: d2 * d20 + d4, y: d20 }];
}

/* GeoSDoub.IntersectCirclesY: the same computation with x and y exchanged. */
function bytecodeCircleY(A, B) {
  const d2 = -(A.x - B.x) / (A.y - B.y);
  const d4 = (A.x * A.x - B.x * B.x + A.y * A.y - B.y * B.y
    - A.r * A.r + B.r * B.r) / (2 * (A.y - B.y));
  const d6 = d4 - A.y;
  const d8 = d2 * d2 + 1;
  const d10 = d2 * d6 - A.x;
  const d12 = d6 * d6 + A.x * A.x - A.r * A.r;
  const d14 = d10 * d10 - d8 * d12;
  if (d14 < 0) return null;
  const root = Math.sqrt(d14);
  const d18 = (-d10 + root) / d8, d20 = (-d10 - root) / d8;
  return [{ x: d18, y: d2 * d18 + d4 }, { x: d20, y: d2 * d20 + d4 }];
}

function bytecodeCirclePair(A, B) {
  if (Math.abs(A.x - B.x) > 1) return bytecodeCircleX(A, B);
  if (Math.abs(A.y - B.y) > 1) return bytecodeCircleY(A, B);
  return [{ x: A.x, y: A.y }, { x: A.x, y: A.y }];
}

/* Canvas.GetCircle(P, i, j, k): FindCircumcenter and the mean of 3 distances. */
function bytecodeCircle(P, i, j, k) {
  const o = bytecodeCentre(P[0][i], P[1][j], P[2][k]);
  const dist = (p, q) => Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
  return { x: o.x, y: o.y, r: (dist(o, P[0][i]) + dist(o, P[1][j]) + dist(o, P[2][k])) / 3 };
}

const bytecodeContains = (c, p) =>
  Math.abs(Math.sqrt((p.x - c.x) ** 2 + (p.y - c.y) ** 2) - c.r) < 0.1;
const bytecodeMeets = (A, B) => {
  const d = Math.sqrt((A.x - B.x) ** 2 + (A.y - B.y) ** 2);
  return d < A.r + B.r && A.r < d + B.r && B.r < d + A.r;
};

/* CheckCliffordCondition + CheckForCircles, with the JVM's own loops. */
function bytecodeAnalyse(state) {
  const circles = state.map((c) => ({
    x: c.center.x, y: c.center.y,
    r: Math.sqrt((c.center.x - c.rim.x) ** 2 + (c.center.y - c.rim.y) ** 2),
  }));
  const orders = [[0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3]];
  let order = null;
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    if (bytecodeMeets(circles[o[0]], circles[o[1]]) &&
        bytecodeMeets(circles[o[1]], circles[o[2]]) &&
        bytecodeMeets(circles[o[2]], circles[o[3]]) &&
        bytecodeMeets(circles[o[3]], circles[o[0]])) { order = o; break; }
  }
  if (!order) return { circles, order: null, pairs: [], found: [] };
  const P = [[], [], [], []];
  for (let k = 0; k < 4; k++) {
    const q = (k + 1) % 4;
    const xs = bytecodeCirclePair(circles[order[k]], circles[order[q]]);
    if (!xs) return { circles, order, pairs: [], found: [] };
    P[k] = [xs[0], xs[1]];
  }
  const tries = [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1],
    [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]];
  const found = [];
  for (let t = 0; t < 8; t++) {
    const [i, j, k] = tries[t];
    const red = bytecodeCircle(P, 0, i, j);
    if (!Number.isFinite(red.x) || !bytecodeContains(red, P[3][k])) continue;
    const blue = bytecodeCircle(P, 1, 1 - i, 1 - j);
    found.push({ tries: [i, j, k], red, blue });
  }
  return { circles, order, pairs: P, found };
}

const samePoint = (p, q) => Number.isFinite(p.x) && Number.isFinite(q.x) &&
  Math.hypot(p.x - q.x, p.y - q.y) < 1e-6;
const sameCircle = (a, b) => samePoint(a, b) && Math.abs(a.r - b.r) < 1e-6;

function compare(label, state) {
  const mine = C.analyse(state), theirs = bytecodeAnalyse(state);
  const orderOk = String(mine.order) === String(theirs.order);
  const pairsOk = mine.pairs.length === theirs.pairs.length && mine.pairs.every((pair, k) =>
    pair.every((p, i) => samePoint(p, theirs.pairs[k][i])));
  const foundOk = mine.found.length === theirs.found.length && mine.found.every((f, i) =>
    f.tries.join("") === theirs.found[i].tries.join("") &&
    sameCircle(f.red, theirs.found[i].red) && sameCircle(f.blue, theirs.found[i].blue));
  check(label, orderOk && pairsOk && foundOk,
    `order ${mine.order} / ${theirs.order}, pairs ${pairsOk}, found ${mine.found.length}/${theirs.found.length}`);
}

compare("the opening picture matches the bytecode", C.start({}));
compare("the 0132 fallback matches the bytecode", C.start({ circles: [
  { center: { x: 168.29, y: 212.10 }, rim: { x: 248.69, y: 141.79 } },
  { center: { x: 225.45, y: 339.62 }, rim: { x: 272.92, y: 261.18 } },
  { center: { x: 232.10, y: 101.74 }, rim: { x: 201.28, y: 137.71 } },
  { center: { x: 322.78, y: 200.08 }, rim: { x: 436.06, y: 194.63 } },
] }));
compare("aligned centres take the doubled-centre branch", C.start({ circles: [
  { center: { x: 200.0, y: 100 }, rim: { x: 260, y: 100 } },
  { center: { x: 200.0, y: 220 }, rim: { x: 250, y: 220 } },
  { center: { x: 200.4, y: 340 }, rim: { x: 240, y: 340 } },
  { center: { x: 200.0, y: 60 }, rim: { x: 230, y: 60 } },
] }));

{
  let agree = 0, mismatch = 0, chained = 0, hits = 0;
  for (let t = 0; t < 1500; t++) {
    const s = [0, 1, 2, 3].map(() => {
      const c = { x: 120 + rand() * 360, y: 70 + rand() * 310 };
      const r = 30 + rand() * 90, a = rand() * Math.PI * 2;
      return { center: c, rim: { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) } };
    });
    const mine = C.analyse(s), theirs = bytecodeAnalyse(s);
    if (String(mine.order) === String(theirs.order) &&
        mine.pairs.length === theirs.pairs.length &&
        mine.pairs.every((p, k) => p.every((q, i) => samePoint(q, theirs.pairs[k][i]))) &&
        mine.found.length === theirs.found.length &&
        mine.found.every((f, i) => f.tries.join("") === theirs.found[i].tries.join("") &&
          sameCircle(f.red, theirs.found[i].red) && sameCircle(f.blue, theirs.found[i].blue))) agree++;
    else mismatch++;
    if (theirs.order) { chained++; if (theirs.found.length) hits++; }
  }
  check(`the two transcriptions agree on 1500 random circles (${agree})`, mismatch === 0,
    `${mismatch} differ`);
  check(`random circles rarely satisfy the condition (${hits} of ${chained} chains)`,
    chained > 50 && hits < chained * 0.08, `${hits}/${chained}`);
}

/* --------------------------------------------------- 3. the page's claims */

const csub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const cdiv = (a, b) => {
  const d = b.x * b.x + b.y * b.y;
  return { x: (a.x * b.x + a.y * b.y) / d, y: (a.y * b.x - a.x * b.y) / d };
};
const cmul = (a, b) => ({ x: a.x * b.x - a.y * b.y, y: a.x * b.y + a.y * b.x });
const cross4 = (a, b, c, d) =>
  cdiv(cdiv(csub(a, c), csub(b, c)), cdiv(csub(a, d), csub(b, d)));
const concyclic = (a, b, c, d, tol = 1e-7) => {
  const q = cross4(a, b, c, d);
  return Math.abs(q.y) <= tol * Math.hypot(q.x, q.y);
};
const ratio2 = (a, b, c, d) =>
  cdiv(cdiv(csub(a, b), csub(c, b)), cdiv(csub(a, d), csub(c, d)));
const area2 = (a, b, c) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));

/* Four circles o[k] through z[k-1] and z[k]; the z's lie on one circle K,
   so the page's hypothesis holds by construction and the w's are determined. */
function builtChain() {
  for (;;) {
    const K = { x: 250 + rand() * 100, y: 180 + rand() * 90, r: 70 + rand() * 50 };
    const z = [0, 1, 2, 3].map((k) => {
      const a = (k + 0.2 + rand() * 0.4) * Math.PI / 2;
      return { x: K.x + K.r * Math.cos(a), y: K.y + K.r * Math.sin(a) };
    });
    const centres = [0, 1, 2, 3].map((k) => {
      const p = z[(k + 3) % 4], q = z[k];
      const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      const nx = -(q.y - p.y), ny = q.x - p.x, len = Math.hypot(nx, ny);
      const t = (0.7 + rand() * 0.8) * (rand() < 0.5 ? -1 : 1) * (80 + rand() * 80);
      return C.findCircumcenter(p, q, { x: mid.x + nx / len * t, y: mid.y + ny / len * t });
    });
    if (centres.some((c) => !Number.isFinite(c.x))) continue;
    const s = centres.map((c, k) => ({ center: c, rim: z[k] }));
    const cs = C.circles(s);
    if (cs.some((c) => c.r < 40 || c.r > 500)) continue;
    if (![0, 1, 2, 3].every((k) => C.meet(cs[k], cs[(k + 1) % 4]))) continue;
    const P = [0, 1, 2, 3].map((k) => C.intersectCircles(cs[k], cs[(k + 1) % 4]));
    if (P.some((p) => !p || !p.every((q) => Number.isFinite(q.x) && Math.abs(q.x) < 1e5))) continue;
    const w = P.map((p, k) => C.distance(p[0], z[k]) < C.distance(p[1], z[k]) ? p[1] : p[0]);
    if (w.some((p, k) => C.distance(p, z[k]) < 20)) continue;
    if ([0, 1, 2, 3].some((k) => area2(z[(k + 1) % 4], z[(k + 2) % 4], z[(k + 3) % 4]) < 3000)) continue;
    if ([0, 1, 2, 3].some((k) => area2(w[(k + 1) % 4], w[(k + 2) % 4], w[(k + 3) % 4]) < 1000)) continue;
    return { s, z, w };
  }
}

{
  const chains = [];
  for (let t = 0; t < 1200; t++) chains.push(builtChain());
  check("1200 well-conditioned chains built with concyclic z-points",
    chains.every(({ z }) => concyclic(...z)));

  let wp = 0, wf = 0, fp = 0, ff = 0, exact = 0;
  for (const { s, z, w } of chains) {
    if (concyclic(...w)) wp++; else wf++;
    const a = C.analyse(s);
    if (a.order && a.order.join("") === "0123" && a.found.length) fp++; else ff++;
    if (a.found.some((f) => concyclic(...f.z) && concyclic(...f.w))) exact++;
  }
  check(`Clifford's lemma: concyclic z forces concyclic w (${wp} chains)`, wf === 0, `${wf} fail`);
  check(`the applet finds a red/blue pair in every chain (${fp})`, ff === 0, `${ff} miss`);
  check(`a found pair has both quartets concyclic (${exact})`, exact === chains.length);
}

{
  /* The page says (5) is the product of (1)-(4). It is not, and not even up
     to a real factor: on arbitrary points (nothing concyclic assumed) the
     product divided by (5) is the square of a complex number, which is not
     real in general. What holds identically is (5) = (1)(3) / ((2)(4)). The
     proof needs an identity that does not assume its own conclusion: with
     (1)-(4) real (each quartet lies on one green circle), (5) is real, so
     the z cross ratio is real exactly when the w cross ratio is. */
  let identity = 0, productIs5 = 0, productOver5Real = 0;
  const N = 600;
  for (let t = 0; t < N; t++) {
    const p = () => ({ x: rand() * 10 - 5, y: rand() * 10 - 5 });
    const z = [p(), p(), p(), p()], w = [p(), p(), p(), p()];
    const one = ratio2(z[0], z[1], w[1], w[0]);
    const two = ratio2(z[1], z[2], w[2], w[1]);
    const three = ratio2(z[2], z[3], w[3], w[2]);
    const four = ratio2(z[3], z[0], w[0], w[3]);
    const five = cmul(ratio2(z[0], z[1], z[2], z[3]), ratio2(w[0], w[1], w[2], w[3]));
    const close = (u, v) => Math.hypot(u.x - v.x, u.y - v.y) <= 1e-8 * Math.max(1, Math.hypot(v.x, v.y));
    const real = (v) => Math.abs(v.y) <= 1e-6 * Math.max(1, Math.hypot(v.x, v.y));
    if (close(cdiv(cmul(one, three), cmul(two, four)), five)) identity++;
    const product = cmul(cmul(one, two), cmul(three, four));
    if (close(product, five)) productIs5++;
    if (real(cdiv(product, five))) productOver5Real++;
  }
  check(`(5) = (1)(3) / ((2)(4)) on ${N} arbitrary point sets`, identity === N, `${identity}`);
  check(`(5) is not the product (1)(2)(3)(4), as the page prints (${productIs5} of ${N} equal)`, productIs5 === 0);
  check(`nor the product up to a real factor (${productOver5Real} of ${N} real quotients)`, productOver5Real < N * 0.01);
}

{
  /* Gerald Brown's four pairwise orthogonal circles all pass through O.
     The four other crossings form a rectangle, hence lie on one circle. */
  let rectangle = 0, concyclicCount = 0;
  for (let t = 0; t < 300; t++) {
    const a = 20 + rand() * 80, b = -(20 + rand() * 80);
    const c = 20 + rand() * 80, d = -(20 + rand() * 80);
    const X = [{ x: a, y: 0, r: Math.abs(a) }, { x: 0, y: c, r: Math.abs(c) },
      { x: b, y: 0, r: Math.abs(b) }, { x: 0, y: d, r: Math.abs(d) }];
    const pts = [0, 1, 2, 3].map((k) => {
      const [p, q] = C.intersectCircles(X[k], X[(k + 1) % 4]);
      return Math.hypot(p.x, p.y) > Math.hypot(q.x, q.y) ? p : q;
    });
    /* The page's rectangle is the image under inversion in the origin, not
       the original quadruple: each circle through O becomes a straight line. */
    const inv = pts.map((p) => {
      const k = 1 / (p.x * p.x + p.y * p.y);
      return { x: p.x * k, y: p.y * k };
    });
    const mid1 = { x: (inv[0].x + inv[2].x) / 2, y: (inv[0].y + inv[2].y) / 2 };
    const mid2 = { x: (inv[1].x + inv[3].x) / 2, y: (inv[1].y + inv[3].y) / 2 };
    const diag1 = C.distance(inv[0], inv[2]), diag2 = C.distance(inv[1], inv[3]);
    const edge1 = csub(inv[1], inv[0]), edge2 = csub(inv[2], inv[1]);
    if (C.distance(mid1, mid2) < 1e-9 && Math.abs(diag1 - diag2) < 1e-9 &&
        Math.abs(edge1.x * edge2.x + edge1.y * edge2.y) < 1e-9) rectangle++;
    if (concyclic(...pts, 1e-8)) concyclicCount++;
  }
  check("Brown's inverted crossings form a rectangle (300 cases)", rectangle === 300);
  check("Brown's original crossings are concyclic (300 cases)", concyclicCount === 300);
}

/* ------------------------------------------------------- 4. the eyes */

{
  const closed = C.eyes(600, { x: 0, y: 0 }, false);
  const open = C.eyes(600, { x: 300, y: 200 }, true);
  check("three pairs of mouseTracker eyes", closed.length === 6 && open.length === 6);
  check("irises stay inside their eyes", closed.every((e) =>
    C.distance(e.iris, e.center) <= e.R - e.r + 1e-9));
  check("the eyes open when a Clifford pair is found", open.every((e) => e.open) &&
    closed.every((e) => !e.open));
}

done("clifford-theorem");
