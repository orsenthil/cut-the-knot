#!/usr/bin/env node
"use strict";

/*
 * Logic test for median-triangle/median-triangle-core.js.
 *
 *   node porting/check-median-triangle.mjs
 *
 * The cut-the-knot page claims that the triangle whose sides are the three
 * medians of ABC has 3/4 of ABC's area, and that the triangle BDG in its
 * picture has sides equal to 2/3 of those medians and 1/3 of ABC's area.
 * Both are checked here on eight hand-picked shapes and 600 random triangles,
 * with an independent Heron-formula computation of the median triangle's area.
 * Every constructed point is compared with a second, literal transcription of
 * the applet's Compute() and init() bytecode, over the whole board-size range.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("median-triangle/median-triangle-core.js", "MedianTriangleCore");

const pt = (a) => ({ x: a[0], y: a[1] });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a, b, c, d) => (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
const near = (v, limit = 1e-7) => Number.isFinite(v) && Math.abs(v) < limit;
const worst = (items, fn) => items.reduce((m, x) => Math.max(m, fn(x)), 0);
const tri = ([a, b, c]) => [pt(a), pt(b), pt(c)];

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  check("a new position has three finite corners inside the view",
    [s.A, s.B, s.C].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= 0 && p.x <= C.VIEW.width && p.y >= 0 && p.y <= C.VIEW.height));
  check("the starting triangle has a usable area", Math.abs(C.twiceArea(s.A, s.B, s.C)) > 10000,
    `twice area ${C.twiceArea(s.A, s.B, s.C)}`);
  check("an illustration has no win or loss", C.result(s) === null);
  check("the applet's Show parameter defaults to names on and hint off",
    s.options.names === true && s.options.hint === false && s.touches === 0);

  const moved = C.moveVertex(s, "A", { x: 9000, y: -20 });
  check("dragging a corner clamps it inside the board",
    moved.A.x === C.VIEW.width - C.MARGIN && moved.A.y === C.MARGIN,
    `got ${JSON.stringify(moved.A)}`);
  check("moving a corner does not change the old position",
    s.A.x === C.START.A.x && s.touches === 0 && moved.touches === 1);
  check("an unknown corner or a non-finite point is ignored",
    C.moveVertex(s, "Z", pt([1, 1])) === s &&
    C.moveVertex(s, "A", { x: NaN, y: 3 }) === s && C.moveVertex(s, "A", null) === s);
  check("a checkbox changes only what is shown",
    C.setOption(s, "hint", true).options.hint === true &&
    C.setOption(s, "hint", true).A === s.A && C.setOption(s, "missing", true) === s);
  check("a position with a missing corner cannot be drawn",
    C.geometry({ A: s.A, B: s.B, C: null }).valid === false);

  const rand = rng(27);
  const starts = Array.from({ length: 300 }, () => C.randomStart(rand));
  check("300 new triangles are finite and non-flat",
    starts.every((r) => C.geometry(r).valid && Math.abs(C.twiceArea(r.A, r.B, r.C)) > 100 &&
      [r.A, r.B, r.C].every((p) => p.x >= C.MARGIN && p.x <= C.VIEW.width - C.MARGIN)));
}

/* ------------------------ 2. the page's claims, over many configurations */

const exact = [
  [[60, 230], [300, 230], [220, 50]],    // the applet's starting triangle
  [[240, 50], [80, 300], [400, 300]],    // near equilateral
  [[80, 60], [400, 60], [80, 300]],      // right angle at A
  [[90, 290], [390, 290], [240, 40]],    // isosceles at C
  [[40, 190], [440, 190], [240, 200]],   // very flat
  [[70, 40], [410, 90], [220, 300]],     // scalene, obtuse
  [[240, 30], [200, 310], [450, 150]],   // almost vertical side
  [[30, 30], [450, 300], [30, 300]],     // corners near the edges
];
const rand = rng(20261128);
const triangles = exact.map(tri);
const rpoint = () => [
  12 + rand() * (C.VIEW.width - 24), 12 + rand() * (C.VIEW.height - 24),
];
for (let i = 0; i < 600; i++) triangles.push(tri([rpoint(), rpoint(), rpoint()]));
check("the sample has 608 triangles, including the hand-picked ones", triangles.length === 608);
const gs = triangles.map(([A, B, Cc]) => C.geometry({ A, B, C: Cc }));
check("every sampled triangle has a drawable construction", gs.every((g) => g.valid && g.area > 1e-6),
  `invalid ${gs.filter((g) => !g.valid).length}, tiny ${gs.filter((g) => g.valid && !(g.area > 1e-6)).length}`);

{
  // The three medians, as vectors, close up: they can form a triangle.
  const medianSum = worst(gs, (g) => dist(
    { x: g.Am.x - g.A.x + g.Bm.x - g.B.x + g.Cm.x - g.C.x,
      y: g.Am.y - g.A.y + g.Bm.y - g.B.y + g.Cm.y - g.C.y },
    pt([0, 0])));
  check("the three median vectors add to zero in every triangle",
    near(medianSum, 1e-8), `largest error ${medianSum}`);

  // The blue triangle B, M_b, E is the median triangle.
  const sides = worst(gs, (g) => {
    const [u, v, w] = g.medianTriangle;
    const { ma, mb, mc } = g.medianLengths;
    return Math.max(Math.abs(dist(u, v) - mb), Math.abs(dist(v, w) - ma), Math.abs(dist(w, u) - mc));
  });
  check("the blue triangle's sides are exactly m_a, m_b and m_c",
    near(sides, 1e-8), `largest error ${sides}`);

  // The headline claim, checked in all 608 shapes.
  const ratios = gs.map((g) => C.area(...g.medianTriangle) / g.area);
  const claim = worst(ratios, (r) => Math.abs(r - 3 / 4));
  check("the median triangle has 3/4 of ABC's area in all 608 triangles",
    near(claim, 1e-8), `largest error ${claim}`);

  // Independent area computation: Heron's formula on the three median lengths.
  const heronErr = gs.map((g) => {
    const { ma, mb, mc } = g.medianLengths;
    const s = (ma + mb + mc) / 2;
    const h = Math.sqrt(Math.max(0, s * (s - ma) * (s - mb) * (s - mc)));
    return Math.abs(h - C.area(...g.medianTriangle));
  });
  check("Heron's formula on the medians gives the same area",
    near(worst(heronErr, (e) => e), 1e-7), `largest error ${Math.max(...heronErr)}`);

  // The four pink triangles of the applet each have a quarter of the area.
  const corners = worst(gs, (g) => Math.max(...g.cornerTriangles.map(
    (t) => Math.abs(C.area(...t) / g.area - 1 / 4))));
  check("the three corner triangles each have 1/4 of ABC's area",
    near(corners, 1e-8), `largest error ${corners}`);
  const center = worst(gs, (g) => Math.abs(C.area(...g.centerTriangle) / g.area - 1 / 4));
  check("the pink middle triangle E, M_a, F also has 1/4 of the area",
    near(center, 1e-8), `largest error ${center}`);
  const total = worst(gs, (g) => Math.abs(g.cornerTriangles.reduce(
    (sum, t) => sum + C.area(...t), C.area(...g.centerTriangle)) - g.area));
  check("the four pink triangles together have exactly ABC's area",
    near(total, 1e-8), `largest error ${total}`);

  // The applet's D is the fourth corner of a parallelogram ABDC.
  const para = worst(gs, (g) => {
    const [u, v, w] = g.parallelogramTriangle;
    return Math.max(Math.abs(C.area(u, v, w) - g.area),
      dist({ x: g.D.x - g.B.x, y: g.D.y - g.B.y }, pt([g.C.x - g.A.x, g.C.y - g.A.y])),
      dist({ x: g.D.x - g.C.x, y: g.D.y - g.C.y }, pt([g.B.x - g.A.x, g.B.y - g.A.y])));
  });
  check("the applet's D makes a parallelogram ABDC and a congruent triangle BCD",
    near(para, 1e-8), `largest error ${para}`);

  // Centroid: on all three medians, twice as near a vertex as a midpoint.
  const concurrence = worst(gs, (g) => Math.max(
    Math.abs(cross(g.A, g.Am, g.A, g.G)) / g.area,
    Math.abs(cross(g.B, g.Bm, g.B, g.G)) / g.area,
    Math.abs(cross(g.C, g.Cm, g.C, g.G)) / g.area,
    Math.abs(dist(g.A, g.G) / dist(g.G, g.Am) - 2),
    Math.abs(dist(g.B, g.G) / dist(g.G, g.Bm) - 2),
    Math.abs(dist(g.C, g.G) / dist(g.G, g.Cm) - 2)));
  check("G lies on every median and cuts it in the ratio 2:1",
    near(concurrence, 1e-8), `largest error ${concurrence}`);

  // The article's BDG: sides 2/3 of the medians, area 1/3 of ABC.
  const bdgsides = worst(gs, (g) => Math.max(
    Math.abs(dist(g.B, g.G) - (2 / 3) * g.medianLengths.mb),
    Math.abs(dist(g.G, g.articleD) - (2 / 3) * g.medianLengths.ma),
    Math.abs(dist(g.B, g.articleD) - (2 / 3) * g.medianLengths.mc)));
  check("triangle BDG has sides equal to 2/3 of the three medians",
    near(bdgsides, 1e-8), `largest error ${bdgsides}`);
  const bdgar = worst(gs, (g) => Math.abs(C.area(g.B, g.G, g.articleD) / g.area - 1 / 3));
  check("triangle BDG has 1/3 of ABC's area in every triangle",
    near(bdgar, 1e-8), `largest error ${bdgar}`);
  const scaled = worst(gs, (g) => Math.abs(C.area(...g.medianTriangle) / C.area(g.B, g.G, g.articleD) - 9 / 4));
  check("the blue triangle is BGD scaled by 3/2, so its area is 9/4 times as big",
    near(scaled, 1e-7), `largest error ${scaled}`);

  // ShowHint() marks the two halves of each side: they must be equal.
  const halves = worst(gs, (g) => Math.max(
    Math.abs(dist(g.A, g.Bm) - dist(g.C, g.Bm)),
    Math.abs(dist(g.C, g.Am) - dist(g.B, g.Am)),
    Math.abs(dist(g.B, g.Cm) - dist(g.A, g.Cm))));
  check("the six segments marked by the hint are pairs of equal half-sides",
    near(halves, 1e-8), `largest error ${halves}`);

  // The invariant is affine, so translations and scalings preserve the ratio.
  const g0 = gs[0];
  const shift = pt([37, -19]);
  const moved = C.construct(pt([g0.A.x + shift.x, g0.A.y + shift.y]),
    pt([g0.B.x + shift.x, g0.B.y + shift.y]), pt([g0.C.x + shift.x, g0.C.y + shift.y]));
  check("translating ABC moves every constructed point by the same amount",
    ["Am", "Bm", "Cm", "D", "E", "F", "G", "articleD"].every((n) =>
      dist(moved[n], pt([g0[n].x + shift.x, g0[n].y + shift.y])) < 1e-8));
  const scaledG = C.construct(pt([g0.A.x * 1.7, g0.A.y * 1.7]),
    pt([g0.B.x * 1.7, g0.B.y * 1.7]), pt([g0.C.x * 1.7, g0.C.y * 1.7]));
  check("scaling ABC scales the ratio but leaves it at 3/4",
    near(C.area(...scaledG.medianTriangle) / scaledG.area - 3 / 4, 1e-8));

  // A flat triangle is algebraically fine: no NaN, and both ratios survive.
  const flat = C.construct(pt([0, 0]), pt([10, 0]), pt([20, 0]));
  check("a flat triangle still gives finite points and no division by zero",
    ["Am", "Bm", "Cm", "D", "E", "F", "G", "articleD"].every((n) =>
      Number.isFinite(flat[n].x) && Number.isFinite(flat[n].y)));
  check("the status line reports the 75% invariant",
    C.label(C.geometry(C.start({}))).includes("75%"));
  check("the checkboxes change no geometry",
    ["Am", "Bm", "Cm", "D", "E", "F"].every((n) =>
      dist(C.geometry(C.setOption(C.setOption(C.start({}), "names", false), "hint", true))[n],
        C.geometry(C.start({}))[n]) === 0));
}

/* ---------------- 3. a second transcription of the applet's own bytecode */

// MedianTriangleCanvas.init(), javap -c -p: halfW=w/2, halfH=h/2, q=w/4,
// A=(halfW-3*q/2, halfH+60); B=(A.x+2*q, A.y); C=((A.x+2*B.x)/3, halfH-120).
function appletInit(width, height) {
  const halfW = width / 2.0;
  const halfH = height / 2.0;
  const quarter = width / 4.0;
  const A = { x: halfW - 3.0 * quarter / 2.0, y: halfH + 60.0 };
  const B = { x: A.x + 2.0 * quarter, y: A.y };
  const Cc = { x: (A.x + 2.0 * B.x) / 3.0, y: halfH - 2.0 * 60.0 };
  return { A, B, C: Cc };
}

// MedianTriangleCanvas.Compute(): Am=Midpoint(C,B), Bm=Midpoint(A,C),
// Cm=Midpoint(B,A), D=C+B-A, E=Bm+Am-A, F=Cm+Am-A.
function appletMidpoint(p, q) {
  return { x: (p.x + q.x) / 2.0, y: (p.y + q.y) / 2.0 };
}
function appletCompute(A, B, Cc) {
  const Am = appletMidpoint(Cc, B);
  const Bm = appletMidpoint(A, Cc);
  const Cm = appletMidpoint(B, A);
  return {
    Am, Bm, Cm,
    D: { x: Cc.x + B.x - A.x, y: Cc.y + B.y - A.y },
    E: { x: Bm.x + Am.x - A.x, y: Bm.y + Am.y - A.y },
    F: { x: Cm.x + Am.x - A.x, y: Cm.y + Am.y - A.y },
  };
}

{
  const sizes = [];
  for (let w = 240; w <= 1200; w += 37) {
    for (let h = 180; h <= 900; h += 29) sizes.push([w, h]);
  }
  const initErr = worst(sizes, ([w, h]) => {
    const a = appletInit(w, h), b = C.initialTriangle(w, h);
    return Math.max(dist(a.A, b.A), dist(a.B, b.B), dist(a.C, b.C));
  });
  check(`init() agrees with the bytecode on all ${sizes.length} canvas sizes`,
    near(initErr, 1e-12), `largest error ${initErr}`);

  const computeErr = worst(gs, (g) => {
    const a = appletCompute(g.A, g.B, g.C);
    return ["Am", "Bm", "Cm", "D", "E", "F"].reduce((m, n) => Math.max(m, dist(a[n], g[n])), 0);
  });
  check("Compute() agrees with the bytecode point for point on all 608 triangles",
    near(computeErr, 1e-12), `largest error ${computeErr}`);

  const a = appletCompute(pt([0, 0]), pt([10, 0]), pt([0, 10]));
  check("the bytecode transcription itself gives the expected sample points",
    dist(a.Am, pt([5, 5])) === 0 && dist(a.Bm, pt([0, 5])) === 0 &&
    dist(a.Cm, pt([5, 0])) === 0 && dist(a.D, pt([10, 10])) === 0 &&
    dist(a.E, pt([5, 10])) === 0 && dist(a.F, pt([10, 5])) === 0,
    JSON.stringify(a));

  // Sanity-check the claim's arithmetic, independently of the core.
  const sample = appletInit(C.VIEW.width, C.VIEW.height);
  const sc = appletCompute(sample.A, sample.B, sample.C);
  check("on the applet's own start, E, M_a and F form a half-size copy of C, A, B",
    near(dist(sc.E, pt([340, 50])), 1e-9) && near(dist(sc.Am, pt([260, 140])), 1e-9) &&
    near(dist(sc.F, pt([380, 140])), 1e-9), JSON.stringify(sc));
}

done("median-triangle");
