#!/usr/bin/env node
"use strict";

/*
 * Logic test for from-grebe/from-grebe-core.js.
 *
 *   node porting/check-from-grebe.mjs
 *
 * The article's claims are checked on the opening triangle, eight hand-picked
 * shapes and 600 random triangles: the three joining lines AA0, BB0, CC0
 * really do meet in one point, that point has barycentric coordinates
 * a^2:b^2:c^2 (the Lemoine point), both the outer triangle A0B0C0 and the
 * reconstructed ABC are homothetic to the dragged one from that point, with
 * factor 2*area/(a^2+b^2+c^2+2*area). Every constructed point is also compared
 * with a second, literal transcription of FromGrebeCanvas.Compute(),
 * GetSquare(), GeoSDoub.Rotate() and GeoSDoub.Intersect() from the bytecode.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("from-grebe/from-grebe-core.js", "FromGrebeCore");

const HALF = Math.PI / 2;
const pt = (a) => ({ x: a[0], y: a[1] });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (v, limit = 1e-6) => Number.isFinite(v) && v < limit;
const worst = (items, fn) => items.reduce((m, x) => Math.max(m, fn(x)), 0);
const cross = (a, b, c, d) => (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
const dot = (a, b, c, d) => (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y);
const onLine = (p, a, b) => Math.abs(cross(a, b, a, p)) < 1e-5 * Math.max(1, dist(a, b));

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  check("a fresh position has three finite corners inside the board",
    [s.A, s.B, s.C].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= 0 && p.x <= C.VIEW.width && p.y >= 0 && p.y <= C.VIEW.height));
  check("the opening triangle has three sides longer than the applet's 2-unit cutoff",
    [C.dist(s.A, s.B), C.dist(s.B, s.C), C.dist(s.C, s.A)].every((d) => d > 2));
  check("an illustration has no win or loss", C.result(s) === null && C.result({}) === null);
  check("the applet's Show names checkbox starts off", s.options.names === false &&
    Object.keys(s.options).length === 1 && s.touches === 0);

  const moved = C.moveVertex(s, "A", { x: 9000, y: -20 });
  check("dragging a corner clamps it to the board",
    moved.A.x === C.VIEW.width - 14 && moved.A.y === 14, JSON.stringify(moved.A));
  check("moving a corner does not change the old position",
    s.A.x === C.START.A.x && s.touches === 0 && moved.touches === 1);
  check("an unknown corner or a non-finite point is ignored",
    C.moveVertex(s, "Z", pt([1, 1])) === s && C.moveVertex(s, "A", pt([NaN, 3])) === s);
  const shifted = C.moveAll(s, 12, -7);
  check("the whole triangle can be dragged, as in the applet",
    dist(shifted.A, pt([s.A.x + 12, s.A.y - 7])) < 1e-12 &&
    dist(shifted.B, pt([s.B.x + 12, s.B.y - 7])) < 1e-12 &&
    dist(shifted.C, pt([s.C.x + 12, s.C.y - 7])) < 1e-12 && shifted.touches === 1);
  check("a whole-triangle drag also clamps to the board",
    C.moveAll(s, 10000, -10000).A.y === 14);
  check("Show names changes only what is drawn",
    C.setOption(s, "names", true).options.names === true &&
    C.setOption(s, "names", true).A === s.A &&
    C.setOption(s, "missing", true) === s);
  check("a side shorter than two board units stops the drawing, as Compute() does",
    C.construct(pt([0, 0]), pt([1, 0]), pt([3, 4])).valid === false &&
    C.construct(pt([0, 0]), pt([10, 0]), pt([10, 1.9])).valid === false);
  check("the status explains the invariant and the degenerate case",
    C.label(C.construct(s.A, s.B, s.C)).includes("Lemoine point") &&
    C.label({ valid: false }).includes("form a triangle"));

  const rand = rng(2718);
  const starts = [];
  for (let i = 0; i < 300; i++) starts.push(C.randomStart(rand));
  check("300 random starts are finite, non-flat triangles",
    starts.every((r) => r.options.names === false && C.construct(r.A, r.B, r.C).valid &&
      Math.abs(C.twiceArea(r.A, r.B, r.C)) > 100));
}

/* --------------------------- 2. the page's claims, over many triangles */

const handPicked = [
  [[170, 220], [250, 220], [195, 160]], // the opening triangle
  [[100, 60], [400, 60], [250, 320]],   // almost equilateral
  [[80, 300], [420, 300], [80, 60]],    // right angle at A'
  [[100, 300], [400, 300], [250, 70]],  // isosceles
  [[40, 190], [460, 190], [250, 198]],  // very flat
  [[70, 50], [430, 110], [190, 330]],   // scalene, obtuse
  [[240, 40], [220, 330], [450, 180]],  // nearly vertical side
  [[20, 20], [480, 340], [20, 340]],    // corners near the edges
];
const rand = rng(19521127);
const triangles = handPicked.map(([a, b, c]) => [pt(a), pt(b), pt(c)]);
for (let i = 0; i < 600; i++) {
  triangles.push([
    pt([20 + rand() * 460, 20 + rand() * 340]),
    pt([20 + rand() * 460, 20 + rand() * 340]),
    pt([20 + rand() * 460, 20 + rand() * 340]),
  ]);
}
check("the sample has 608 triangles, including the hand-picked ones", triangles.length === 608);
const gs = triangles.map(([A, B, Cc]) => C.construct(A, B, Cc));
check("every sampled triangle yields finite constructed points", gs.every((g) => g.valid));

{
  // The three squares really are squares: same side, right angle, outer side
  // parallel to the side of the given triangle.
  const squares = worst(gs, (g) => {
    let e = 0;
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      const T = [g.A, g.B, g.C];
      const u = T[i], v = T[j], x = g.As[i][0], y = g.As[i][1];
      const side = dist(u, v);
      e = Math.max(e,
        Math.abs(dist(u, x) - side), Math.abs(dist(v, y) - side),
        Math.abs(dist(x, y) - side),
        Math.abs(dot(u, x, x, y)) / (side * side),
        Math.abs(Math.abs(cross(u, x, x, y)) / (side * side) - 1));
    }
    return e;
  });
  check("ABDE, BCFG and CAHL are squares with the applet's turn", near(squares, 1e-7),
    `largest error ${squares}`);

  const turn = worst(gs, (g) => {
    const D = C.twiceArea(g.A, g.B, g.C);
    const T = [g.A, g.B, g.C];
    // The square corner is always on the same (left) side of a directed side.
    // It is outside only when the triangle winds the other way (D < 0).
    return [0, 1, 2].reduce((m, i) => {
      const s = Math.sign(C.twiceArea(T[i], T[(i + 1) % 3], g.As[i][0]));
      return Math.max(m, Math.abs(s - 1),
        D < 0 ? Math.abs(s + Math.sign(D)) : Math.abs(s - Math.sign(D)));
    }, 0);
  });
  check("the fixed turn puts squares outside for one winding and inside for the other",
    turn === 0 && gs.some((g) => C.twiceArea(g.A, g.B, g.C) < 0) &&
    gs.some((g) => C.twiceArea(g.A, g.B, g.C) > 0));

  const outer = worst(gs, (g) => {
    let e = 0;
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      const T = [g.A, g.B, g.C];
      e = Math.max(e, Math.abs(cross(T[i], T[j], g.As[i][0], g.As[i][1])));
    }
    return e;
  });
  check("each outer side of a square is parallel to its triangle side", near(outer, 1e-5),
    `largest cross product ${outer}`);

  const meet = worst(gs, (g) => {
    let e = 0;
    for (let i = 0; i < 3; i++) {
      const j = (i + 2) % 3;
      e = Math.max(e, Math.abs(cross(g.As[i][0], g.As[i][1], g.As[i][0], g.P[i])),
        Math.abs(cross(g.As[j][0], g.As[j][1], g.As[j][0], g.P[i])));
    }
    return e;
  });
  check("A0, B0 and C0 lie on the two outer sides that meet there", near(meet, 1e-4),
    `largest cross product ${meet}`);

  // Grebe's theorem: the three joining lines meet, so the applet's barycenter
  // of the pairwise intersections is the same point as each intersection.
  const concurrency = worst(gs, (g) => {
    const [x, y, z] = g.cevian;
    const scale = Math.max(1, dist(g.A, g.B), dist(g.B, g.C), dist(g.C, g.A));
    return Math.max(dist(x, y), dist(y, z), dist(z, x)) / scale;
  });
  check("A'A0, B'B0 and C'C0 concur in every triangle (Grebe's theorem)",
    near(concurrency, 1e-7), `largest relative gap ${concurrency}`);

  const kError = worst(gs, (g) => dist(g.K, g.cevian[0]));
  check("K is the common point, not just the average of three different ones",
    near(kError, 1e-6), `largest error ${kError}`);

  // The page calls K the common Lemoine point. Its barycentric coordinates
  // with respect to A'B'C' must be a^2 : b^2 : c^2.
  const lemoine = worst(gs, (g) => {
    const b = C.barycentric(g.K, g.A, g.B, g.C);
    if (!b) return Infinity;
    const sq = [C.sideSquares(g.B, g.C), C.sideSquares(g.C, g.A), C.sideSquares(g.A, g.B)];
    const sum = sq[0] + sq[1] + sq[2];
    return Math.max(...b.map((v, i) => Math.abs(v - sq[i] / sum)));
  });
  check("K has barycentric coordinates a^2:b^2:c^2, the Lemoine point",
    near(lemoine, 1e-6), `largest error ${lemoine}`);

  // Both outer and reconstructed triangles are homothetic to the dragged one
  // about K, with reciprocal factors. The factor is a shape invariant.
  const homotheties = worst(gs, (g) => {
    const r = C.factor(g.A, g.B, g.C);
    const T = [g.A, g.B, g.C];
    let e = 0;
    for (let i = 0; i < 3; i++) {
      const scale = Math.max(1, dist(g.K, T[i]), dist(g.K, g.P[i]), dist(g.K, g.Ap[i]));
      e = Math.max(e,
        dist(g.P[i], pt([g.K.x + (T[i].x - g.K.x) / r, g.K.y + (T[i].y - g.K.y) / r])) / scale,
        dist(g.Ap[i], pt([g.K.x + r * (T[i].x - g.K.x), g.K.y + r * (T[i].y - g.K.y)])) / scale);
    }
    return e;
  });
  check("A0B0C0 and ABC are homothetic to A'B'C' from K with factors 1/r and r",
    near(homotheties, 1e-6), `largest relative error ${homotheties}`);

  const exteriorFormula = worst(gs.filter((g) => C.twiceArea(g.A, g.B, g.C) < 0), (g) => {
    const S = C.sideSquares(g.B, g.C) + C.sideSquares(g.C, g.A) + C.sideSquares(g.A, g.B);
    const area = Math.abs(C.twiceArea(g.A, g.B, g.C)) / 2;
    return Math.abs(C.factor(g.A, g.B, g.C) - 2 * area / (S + 2 * area));
  });
  check("for exterior squares r = 2*area / (a^2+b^2+c^2+2*area)",
    near(exteriorFormula, 1e-12), `largest error ${exteriorFormula}`);

  // The rays K->far square corner cut the sides at S; rotating such a pair
  // gives a square corner on the sought triangle.
  const cuts = worst(gs, (g) => {
    const T = [g.A, g.B, g.C];
    let e = 0;
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      for (let k = 0; k < 2; k++) {
        const cut = g.S[i][k];
        e = Math.max(e, Math.abs(cross(T[i], T[j], T[i], cut)) / Math.max(1, dist(T[i], T[j])),
          Math.abs(cross(g.K, g.As[i][k], g.K, cut)) / Math.max(1, dist(g.K, g.As[i][k])));
      }
      const s = g.S[i][0], t = g.S[i][1], apex = g.Ap[i];
      e = Math.max(e,
        Math.abs(dist(s, apex) - dist(s, t)),
        Math.abs(dot(s, apex, s, t)) / Math.max(1, dist(s, t) ** 2));
    }
    return e;
  });
  check("S cuts each side on the ray from K, and Ap is a square corner on it",
    near(cuts, 1e-4), `largest error ${cuts}`);

  const parallel = worst(gs, (g) => Math.max(
    Math.abs(cross(g.Ap[0], g.Ap[1], g.A, g.B)),
    Math.abs(cross(g.Ap[1], g.Ap[2], g.B, g.C)),
    Math.abs(cross(g.Ap[2], g.Ap[0], g.C, g.A)),
  ));
  check("ABC and A'B'C' have parallel sides (they are homothetic)", near(parallel, 1e-4),
    `largest cross product ${parallel}`);

  // The construction is geometry, not a drawing trick: rigid moves and scale.
  const e = gs[0];
  const move = pt([37, -19]);
  const moved = C.construct(pt([e.A.x + move.x, e.A.y + move.y]),
    pt([e.B.x + move.x, e.B.y + move.y]), pt([e.C.x + move.x, e.C.y + move.y]));
  check("a translation moves every constructed point by the same amount",
    dist(moved.K, pt([e.K.x + move.x, e.K.y + move.y])) < 1e-8 &&
    moved.Ap.every((p, i) => dist(p, pt([e.Ap[i].x + move.x, e.Ap[i].y + move.y])) < 1e-8));

  const scaled = C.construct(pt([e.A.x * 1.7, e.A.y * 1.7]),
    pt([e.B.x * 1.7, e.B.y * 1.7]), pt([e.C.x * 1.7, e.C.y * 1.7]));
  check("scaling the given triangle scales K, A0B0C0 and ABC too",
    dist(scaled.K, pt([e.K.x * 1.7, e.K.y * 1.7])) < 1e-8 &&
    Math.abs(C.factor(scaled.A, scaled.B, scaled.C) - C.factor(e.A, e.B, e.C)) < 1e-12 &&
    scaled.Ap.every((p, i) => dist(p, pt([e.Ap[i].x * 1.7, e.Ap[i].y * 1.7])) < 1e-8));

  const s = C.start({});
  const withNames = C.construct(C.setOption(s, "names", true).A,
    C.setOption(s, "names", true).B, C.setOption(s, "names", true).C);
  const plain = C.construct(s.A, s.B, s.C);
  check("the Show names checkbox changes no geometry",
    dist(withNames.K, plain.K) === 0 && dist(withNames.Ap[0], plain.Ap[0]) === 0);
}

/* ------------------- 3. a second transcription of the applet's bytecode */

// javap -c -p on FromGrebeCanvas.class, GeoSDoub.class, CTKGeometryPlus.class:
//   GetSquare(p, q, out0, out1):
//     out0 = Rotate(p, q, PI/2, +1); out1 = Rotate(q, p, PI/2, -1)
//   Compute(): for i = 0..2, j = (i+1)%3, make As[i] and Line[i];
//     P[i] = Intersect(Line[i], Line[(i+2)%3]);
//     K = Barycenter(Intersect(A[i],P[i],A[j],P[j]) for i = 0..2);
//     S[i][k] = Intersect(K, As[i][k], A[i], A[j]);
//     Ap[i] = Rotate(S[i][0], S[i][1], PI/2, -1).
function javapRotate(p, q, angle, dir) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const x = p.x + cos * (q.x - p.x) - dir * sin * (q.y - p.y);
  const y = p.y + dir * sin * (q.x - p.x) + cos * (q.y - p.y);
  return { x, y };
}

// GeoSDoub.Intersect(p1,p2,p3,p4) written with the same line coefficients as
// the class file (this is a different algebraic route from the core's t-ratio).
function javapIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = b1 * a2 - b2 * a1;
  return Math.abs(det) < 1
    ? { x: NaN, y: NaN }
    : { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
}

function javapCompute(A0, A1, A2) {
  const A = [A0, A1, A2];
  if (Math.hypot(A[0].x - A[1].x, A[0].y - A[1].y) < 2 ||
      Math.hypot(A[1].x - A[2].x, A[1].y - A[2].y) < 2 ||
      Math.hypot(A[2].x - A[0].x, A[2].y - A[0].y) < 2) return null;
  const As = [[0, 0], [0, 0], [0, 0]];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    As[i][0] = javapRotate(A[i], A[j], HALF, 1);
    As[i][1] = javapRotate(A[j], A[i], HALF, -1);
  }
  const P = [0, 1, 2].map((i) => javapIntersect(As[i][0], As[i][1],
    As[(i + 2) % 3][0], As[(i + 2) % 3][1]));
  const cevian = [0, 1, 2].map((i) =>
    javapIntersect(A[i], P[i], A[(i + 1) % 3], P[(i + 1) % 3]));
  const K = {
    x: (cevian[0].x + cevian[1].x + cevian[2].x) / 3,
    y: (cevian[0].y + cevian[1].y + cevian[2].y) / 3,
  };
  const S = [[0, 0], [0, 0], [0, 0]];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    for (let k = 0; k < 2; k++) {
      S[i][k] = javapIntersect(K, As[i][k], A[i], A[j]);
    }
  }
  const Ap = [0, 1, 2].map((i) => javapRotate(S[i][0], S[i][1], HALF, -1));
  return { As, P, cevian, K, S, Ap };
}

{
  const errs = gs.map((g) => {
    const a = javapCompute(g.A, g.B, g.C);
    const mine = [g.As.flat(), g.P, g.cevian, [g.K], g.S.flat(), g.Ap].flat();
    const theirs = [a.As.flat(), a.P, a.cevian, [a.K], a.S.flat(), a.Ap].flat();
    return mine.reduce((m, p, i) => Math.max(m, dist(p, theirs[i])), 0);
  });
  check("the core matches the bytecode transcription on all 608 triangles, point for point",
    near(worst(errs, (v) => v), 1e-7), `largest error ${Math.max(...errs)}`);

  // The transcription must be genuinely different from a closed form: check
  // its K against squared-side barycentrics, and its Ap against the explicit
  // homothety formula independent of Compute().
  const independent = worst(gs, (g) => {
    const a = javapCompute(g.A, g.B, g.C);
    const sq = [C.sideSquares(g.B, g.C), C.sideSquares(g.C, g.A), C.sideSquares(g.A, g.B)];
    const sum = sq.reduce((x, y) => x + y, 0);
    const T = [g.A, g.B, g.C];
    const K = pt([
      [0, 1, 2].reduce((s, i) => s + (sq[i] / sum) * T[i].x, 0),
      [0, 1, 2].reduce((s, i) => s + (sq[i] / sum) * T[i].y, 0),
    ]);
    const D = C.twiceArea(g.A, g.B, g.C);
    const r = D / (D - sum);
    // Compare relatively: on a nearly flat triangle the homothety factor is
    // enormous and its absolute coordinates are correspondingly large.
    const scale = Math.max(1, ...T.map((p) => dist(K, p)), ...a.Ap.map((p) => dist(K, p)));
    return Math.max(dist(a.K, K) / scale, ...a.Ap.map((p, i) => dist(p,
      pt([K.x + r * (T[i].x - K.x), K.y + r * (T[i].y - K.y)])) / scale));
  });
  check("the transcription agrees with the closed form for K and ABC", near(independent, 1e-6),
    `largest error ${independent}`);

  const example = javapCompute(pt([240, 400]), pt([360, 400]), pt([280, 280]));
  check("the transcription reproduces the applet's hand-computed corners",
    near(dist(example.Ap[0], pt([278.0487804878, 373.6585365854])), 1e-8) &&
    near(dist(example.K, pt([288.75, 366.25])), 1e-8),
    `Ap[0] = ${JSON.stringify(example.Ap[0])}, K = ${JSON.stringify(example.K)}`);

  check("both intersections return NaN on parallel lines, as the applet does",
    Number.isNaN(C.intersect(pt([0, 0]), pt([10, 0]), pt([0, 3]), pt([10, 3])).x) &&
    Number.isNaN(javapIntersect(pt([0, 0]), pt([10, 0]), pt([0, 3]), pt([10, 3])).y) &&
    Number.isNaN(javapCompute(pt([0, 0]), pt([10, 0]), pt([20, 0])).K.x));
}

done("from-grebe");
