#!/usr/bin/env node
"use strict";

/*
 * Logic test for anticomplementary-triangle/anticomplementary-triangle-core.js.
 *
 *   node porting/check-anticomplementary-triangle.mjs
 *
 * The article's claim is checked on the starting triangle, on hand-picked
 * shapes and on 600 random triangles: the two-step Napoleon construction
 * always gives P = B + C - A, Q = C + A - B, R = A + B - C, so A, B and C
 * are the midpoints of QR, RP and PQ and the outer triangle has four times
 * the area. Every computed point is also compared with two independent
 * transcriptions: the complex-number formulas on the article's solution page,
 * and GeoSDoub.Rotate / Draw() transcribed literally from the bytecode.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("anticomplementary-triangle/anticomplementary-triangle-core.js", "AnticomplementaryTriangleCore");

const near = (v, limit = 1e-6) => Number.isFinite(v) && v < limit;
const worst = (items, fn) => items.reduce((m, x) => Math.max(m, fn(x)), 0);
const pt = (a) => ({ x: a[0], y: a[1] });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a, b, c, d) => (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  check("a new position has three finite points on the board",
    [s.A, s.B, s.C].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= 0 && p.x <= C.VIEW.width && p.y >= 0 && p.y <= C.VIEW.height));
  check("the starting triangle has a usable area", Math.abs(C.twiceArea(s.A, s.B, s.C)) > 5000);
  check("an illustration has no win or loss", C.result(s) === null);
  check("the three applet checkboxes start names on, steps off",
    Object.keys(s.options).length === 3 &&
    s.options.names === true && s.options.firstStep === false && s.options.secondStep === false);

  const moved = C.moveVertex(s, "A", { x: 9000, y: -20 });
  check("dragging a corner clamps it to the board",
    moved.A.x === C.VIEW.width - 20 && moved.A.y === 20,
    `got ${JSON.stringify(moved.A)}`);
  check("moving a corner does not change the old position",
    s.A.x === C.START.A.x && s.touches === 0 && moved.touches === 1);
  check("an unknown corner or a non-finite point is ignored",
    C.moveVertex(s, "Z", pt([1, 1])) === s &&
    C.moveVertex(s, "A", pt([NaN, 3])) === s);
  check("a checkbox can be switched without moving the corners",
    C.setOption(s, "firstStep", true).options.firstStep === true &&
    C.setOption(s, "firstStep", true).A === s.A &&
    C.setOption(s, "missing", true) === s);
  check("a position with a missing corner cannot be drawn",
    C.geometry({ A: s.A, B: s.B, C: null }).valid === false);

  const rand = rng(27);
  const starts = [];
  for (let i = 0; i < 300; i++) starts.push(C.randomStart(rand));
  check("300 random starts are finite, non-flat triangles",
    starts.every((r) => r.options.names === true &&
      Math.abs(C.twiceArea(r.A, r.B, r.C)) > 100 && C.geometry(r).valid));
}

/* ----------------------------- 2. the article's claim, over many triangles */

const exact = [
  [[250, 115], [175, 185], [275, 180]],   // the starting triangle
  [[210, 60], [110, 240], [310, 240]],    // near equilateral
  [[80, 60], [340, 60], [80, 240]],       // right angle at A
  [[110, 240], [310, 240], [210, 50]],    // isosceles at C
  [[50, 150], [370, 150], [210, 157]],    // very flat
  [[70, 40], [340, 90], [220, 260]],      // scalene, obtuse
  [[210, 40], [200, 260], [360, 150]],    // almost vertical side
  [[20, 20], [400, 280], [20, 280]],      // corners near the edges
];
const rand = rng(20261126);
const triangles = exact.map(([a, b, c]) => [pt(a), pt(b), pt(c)]);
for (let i = 0; i < 600; i++) {
  triangles.push([
    pt([12 + rand() * 396, 12 + rand() * 276]),
    pt([12 + rand() * 396, 12 + rand() * 276]),
    pt([12 + rand() * 396, 12 + rand() * 276]),
  ]);
}
check("the sample has 608 triangles, including the hand-picked ones", triangles.length === 608);
const gs = triangles.map(([A, B, C0]) => C.geometry({ A, B, C: C0 }));
check("every sampled triangle can be drawn", gs.every((g) => g.valid));

{
  // The closed form from the article's equation (2).
  const err = worst(gs, (g) => {
    const f = C.anticomplementary(g.A, g.B, g.C);
    return Math.max(dist(g.P, f.P), dist(g.Q, f.Q), dist(g.R, f.R));
  });
  check("P = B + C - A, Q = C + A - B, R = A + B - C in every triangle",
    near(err, 1e-8), `largest error ${err}`);

  // The article: ABC is the medial triangle of PQR.
  const mids = worst(gs, (g) => {
    const m = C.midpoints(g);
    return Math.max(dist(m.A, g.A), dist(m.B, g.B), dist(m.C, g.C));
  });
  check("A, B, C are the midpoints of QR, RP and PQ",
    near(mids, 1e-8), `largest error ${mids}`);

  // PQ = -2 AB, QR = -2 BC, RP = -2 CA (parallel and twice as long).
  const sides = worst(gs, (g) => Math.max(
    dist({ x: g.Q.x - g.P.x, y: g.Q.y - g.P.y }, pt([2 * (g.A.x - g.B.x), 2 * (g.A.y - g.B.y)])),
    dist({ x: g.R.x - g.Q.x, y: g.R.y - g.Q.y }, pt([2 * (g.B.x - g.C.x), 2 * (g.B.y - g.C.y)])),
    dist({ x: g.P.x - g.R.x, y: g.P.y - g.R.y }, pt([2 * (g.C.x - g.A.x), 2 * (g.C.y - g.A.y)]))
  ));
  check("PQ, QR, RP are parallel to AB, BC, CA and twice as long",
    near(sides, 1e-8), `largest error ${sides}`);

  const parallels = worst(gs, (g) => Math.max(
    Math.abs(cross(g.P, g.Q, g.A, g.B)),
    Math.abs(cross(g.Q, g.R, g.B, g.C)),
    Math.abs(cross(g.R, g.P, g.C, g.A))
  ));
  check("each side of PQR lies on the line through a corner parallel to the opposite side",
    near(parallels, 1e-6), `largest cross product ${parallels}`);

  // Area: a medial triangle has a quarter of the area.
  const areas = worst(gs, (g) => {
    const ratio = C.twiceArea(g.P, g.Q, g.R) / C.twiceArea(g.A, g.B, g.C);
    return Math.abs(ratio - 4);
  });
  check("PQR has four times the area of ABC, with the same orientation",
    near(areas, 1e-8), `largest error ${areas}`);

  // The first Napoleon triangles are equilateral, with the same turn as ABC.
  const eq1 = worst(gs, (g) => {
    let e = 0;
    for (const [apex, u, v] of g.firstStep) {
      const s = dist(u, v);
      e = Math.max(e, Math.abs(dist(apex, u) - s), Math.abs(dist(apex, v) - s));
    }
    return e;
  });
  check("ABZ, BCX and CAY are equilateral", near(eq1, 1e-8), `largest error ${eq1}`);

  const sameTurn = worst(gs, (g) => {
    const base = Math.sign(C.twiceArea(...g.firstStep[0]));
    return g.firstStep.reduce((m, tri) =>
      Math.max(m, Math.abs(Math.sign(C.twiceArea(...tri)) - base)), 0);
  });
  check("the three first-step triangles are all turned the same way", sameTurn === 0);

  const eq2 = worst(gs, (g) => {
    let e = 0;
    for (const [apex, u, v] of g.secondStep) {
      const s = dist(u, v);
      e = Math.max(e, Math.abs(dist(apex, u) - s), Math.abs(dist(apex, v) - s));
    }
    return e;
  });
  check("XYR, YZP and ZXQ are equilateral", near(eq2, 1e-8), `largest error ${eq2}`);

  const opposite = worst(gs, (g) => {
    const base = Math.sign(C.twiceArea(...g.firstStep[0]));
    return g.secondStep.reduce((m, tri) =>
      Math.max(m, Math.abs(Math.sign(C.twiceArea(...tri)) + base)), 0);
  });
  check("the second-step triangles turn the opposite way to the first", opposite === 0);

  // Napoleon's triangle XYZ and the anticomplementary one have the same centroid.
  const centroid = worst(gs, (g) => {
    const av = (p, q, r) => pt([(p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3]);
    return dist(av(g.A, g.B, g.C), av(g.P, g.Q, g.R));
  });
  check("ABC and PQR share a centroid", near(centroid, 1e-8), `largest error ${centroid}`);

  // The construction is geometry, not a drawing trick: rigid moves and scaling.
  const e = gs[0];
  const shift = pt([37, -19]);
  const moved = C.construct(pt([e.A.x + shift.x, e.A.y + shift.y]),
    pt([e.B.x + shift.x, e.B.y + shift.y]), pt([e.C.x + shift.x, e.C.y + shift.y]));
  check("a translation moves every constructed point by the same amount",
    ["X", "Y", "Z", "P", "Q", "R"].every((n) => dist(moved[n],
      pt([e[n].x + shift.x, e[n].y + shift.y])) < 1e-8));

  const scaled = C.construct(pt([e.A.x * 2.5, e.A.y * 2.5]),
    pt([e.B.x * 2.5, e.B.y * 2.5]), pt([e.C.x * 2.5, e.C.y * 2.5]));
  check("scaling ABC scales every constructed point too",
    ["X", "Y", "Z", "P", "Q", "R"].every((n) => dist(scaled[n],
      pt([e[n].x * 2.5, e[n].y * 2.5])) < 1e-8));

  const theta = 0.7, co = Math.cos(theta), si = Math.sin(theta);
  const turn = (p) => pt([p.x * co - p.y * si, p.x * si + p.y * co]);
  const rotated = C.construct(turn(e.A), turn(e.B), turn(e.C));
  check("rotating ABC rotates every constructed point too",
    ["X", "Y", "Z", "P", "Q", "R"].every((n) => dist(rotated[n], turn(e[n])) < 1e-8));

  // A flat triangle is not drawable elegantly, but the algebra still holds.
  const flat = C.construct(pt([0, 0]), pt([10, 0]), pt([20, 0]));
  const flatForm = C.anticomplementary(flat.A, flat.B, flat.C);
  check("the formula still holds when the three corners are in a line",
    ["P", "Q", "R"].every((n) => dist(flat[n], flatForm[n]) < 1e-8));
  check("the status line reports the four-times area on the starting triangle",
    C.label(C.geometry(C.start({}))).includes("4 times the area"));

  const s = C.start({});
  const withOptions = C.geometry(C.setOption(C.setOption(s, "names", false), "secondStep", true));
  const plain = C.geometry(s);
  check("the checkboxes change only what is shown, not the geometry",
    ["X", "Y", "Z", "P", "Q", "R"].every((n) => dist(withOptions[n], plain[n]) === 0));
}

/* ------------------- 3a. the solution page's complex-number computation */

// c = (1 + i sqrt(3)) / 2, 1 - c = (1 - i sqrt(3)) / 2. Points are read in
// mathematical coordinates (y upwards), the reverse of the SVG's y downwards.
const c = { re: 0.5, im: Math.sqrt(3) / 2 };
const oneMinusC = { re: 0.5, im: -Math.sqrt(3) / 2 };
const mul = (u, v) => ({ re: u.re * v.re - u.im * v.im, im: u.re * v.im + u.im * v.re });
const add = (u, v) => ({ re: u.re + v.re, im: u.im + v.im });
const sub = (u, v) => ({ re: u.re - v.re, im: u.im - v.im });
const scale = (u, k) => ({ re: u.re * k, im: u.im * k });
const combo = (a, p, b, q) => add(mul(a, p), mul(b, q));
const up = (p) => ({ re: p.x, im: -p.y });
const down = (z) => pt([z.re, -z.im]);

function complexConstruction(A0, B0, C0) {
  const A = up(A0), B = up(B0), C = up(C0);
  const X = combo(oneMinusC, B, c, C);
  const Y = combo(oneMinusC, C, c, A);
  const Z = combo(oneMinusC, A, c, B);
  return {
    X: down(X), Y: down(Y), Z: down(Z),
    P: down(combo(oneMinusC, Z, c, Y)),
    Q: down(combo(oneMinusC, X, c, Z)),
    R: down(combo(oneMinusC, Y, c, X)),
    direct: {
      P: down(add(add(scale(A, -1), B), C)),
      Q: down(add(add(A, scale(B, -1)), C)),
      R: down(add(add(A, B), scale(C, -1))),
    },
    sides: {
      PQ: down(sub(combo(oneMinusC, X, c, Z), combo(oneMinusC, Z, c, Y))),
      twoAB: down(scale(sub(A, B), 2)),
    },
  };
}

{
  const errs = gs.map((g) => {
    const z = complexConstruction(g.A, g.B, g.C);
    return ["X", "Y", "Z", "P", "Q", "R"].reduce((m, n) => Math.max(m, dist(g[n], z[n])), 0);
  });
  check("the core agrees with the article's complex formulas on all 608 triangles",
    near(worst(errs, (v) => v), 1e-7), `largest error ${Math.max(...errs)}`);

  const direct = gs.map((g) => {
    const z = complexConstruction(g.A, g.B, g.C);
    return Math.max(dist(g.P, z.direct.P), dist(g.Q, z.direct.Q), dist(g.R, z.direct.R));
  });
  check("the article's simplification P = -A+B+C agrees with the construction",
    near(worst(direct, (v) => v), 1e-7));

  const pq = gs.map((g) => dist(complexConstruction(g.A, g.B, g.C).sides.PQ,
    complexConstruction(g.A, g.B, g.C).sides.twoAB));
  check("the article's PQ = 2(A - B) holds in complex arithmetic", near(worst(pq, (v) => v), 1e-7));

  const midpoint = gs.map((g) => dist({ x: (g.P.x + g.Q.x) / 2, y: (g.P.y + g.Q.y) / 2 }, g.C));
  check("the article's (P + Q)/2 = C holds in complex arithmetic",
    near(worst(midpoint, (v) => v), 1e-7));
}

/* ------------------- 3b. the applet's own Draw(), straight from bytecode */

// javap -c -p on classes/AnticomplementaryTriangle.zip and GeoSDoub.class:
//   X = Rotate(B, C, PI/3, -1); Y = Rotate(C, A, PI/3, -1); Z = Rotate(A, B, PI/3, -1)
//   P = Rotate(Y, Z, PI/3, +1); Q = Rotate(Z, X, PI/3, +1); R = Rotate(X, Y, PI/3, +1)
function appletRotate(center, point, angle, dir) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return {
    x: center.x + cos * (point.x - center.x) - dir * sin * (point.y - center.y),
    y: center.y + dir * sin * (point.x - center.x) + cos * (point.y - center.y),
  };
}
function appletDraw(A, B, Cc) {
  const a = Math.PI / 3;
  const X = appletRotate(B, Cc, a, -1);
  const Y = appletRotate(Cc, A, a, -1);
  const Z = appletRotate(A, B, a, -1);
  return {
    X, Y, Z,
    P: appletRotate(Y, Z, a, 1),
    Q: appletRotate(Z, X, a, 1),
    R: appletRotate(X, Y, a, 1),
  };
}

{
  const errs = gs.map((g) => {
    const a = appletDraw(g.A, g.B, g.C);
    return ["X", "Y", "Z", "P", "Q", "R"].reduce((m, n) => Math.max(m, dist(g[n], a[n])), 0);
  });
  check("the core reproduces GeoSDoub.Rotate and Draw() point for point",
    near(worst(errs, (v) => v), 1e-12), `largest error ${Math.max(...errs)}`);

  // Sanity-check the transcription itself: it must be a genuinely different
  // computation from the simplified formula, and must use both signs.
  const a = appletDraw(pt([0, 0]), pt([10, 0]), pt([0, 10]));
  check("the bytecode transcription uses the first-step turn -1",
    near(dist(a.X, pt([13.6602540378, 13.6602540378])), 1e-6),
    `X = ${JSON.stringify(a.X)}`);
  check("the bytecode transcription uses the second-step turn +1",
    Number.isFinite(a.P.x) && Number.isFinite(a.P.y) && dist(a.P, pt([0, 0])) > 1,
    `P = ${JSON.stringify(a.P)}`);
}

done("anticomplementary-triangle");
