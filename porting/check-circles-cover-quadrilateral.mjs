#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-cover-quadrilateral/circles-cover-quadrilateral-core.js.
 *
 *   node porting/check-circles-cover-quadrilateral.mjs
 *
 * 1. The applet's own arithmetic (init, InCircle, mouseClicked, UpgradeCenters
 *    and the four scrollbars) is transcribed a second time, literally from
 *    javap output, and compared with the core over the whole option range:
 *    every scrollbar value 0..600, boundary/inside/outside points for every
 *    radius, hundreds of random clicks and every generated quadrilateral.
 * 2. The page's exact claim is tested over hundreds of near-tight covering
 *    configurations: if four circles at A, B, C, D cover the quadrilateral,
 *    then circles A, B, C cover ABC, or B, C, D cover BCD, or C, D, A cover
 *    CDA, or D, A, B cover DAB. Coverage is decided independently by a fine
 *    grid plus the 1-Lipschitz bound, not by the core's helper.
 * 3. State changes, hidden circles, degenerate input and the demo's lack of a
 *    result are checked too.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circles-cover-quadrilateral/circles-cover-quadrilateral-core.js",
  "CirclesCoverQuadrilateralCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, t = 1e-9) => Math.abs(a - b) <= t;
const closeP = (p, q, t = 1e-9) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);

/* ------------------------------------- the applet's arithmetic, from javap */

/* Canvas.init(), offsets 52..234 in CirclesCoverQuadrilateralCanvas.init():
 * every coordinate division is idiv followed by i2d. */
function appletInit(W = 640, H = 400) {
  return [
    P(Math.trunc(W / 4), Math.trunc(H / 4)),
    P(Math.trunc(W / 3), Math.trunc((H * 3) / 4)),
    P(Math.trunc((W * 3) / 4), Math.trunc((H * 4) / 5)),
    P(Math.trunc((W * 4) / 5), Math.trunc(H / 5)),
  ];
}
const APPLET_RADII = [120, 140, 160, 180];

/* InCircle(DoubCircle c, java.awt.Point p): (c.x-p.x)^2+(c.y-p.y)^2 < r*r.
 * dcmpg returns 1 for NaN, so ifge sends a NaN comparison to "false". */
function appletInCircle(c, p) {
  const dx = c.x - p.x, dy = c.y - p.y;
  const d2 = dx * dx + dy * dy;
  if (Number.isNaN(d2)) return false;
  return d2 < c.r * c.r;
}

/* mouseClicked(): for i = 0..3, if InCircle(circle[i], e.getPoint()) then
 * On[i] = !On[i]. Every circle containing the click flips, even hidden ones. */
function appletClick(circles, on, p) {
  const next = on.slice();
  for (let i = 0; i < 4; i++) {
    if (appletInCircle(circles[i], p)) next[i] = !next[i];
  }
  return next;
}

/* UpgradeCenters(): circle[i].x/y = P[i].x/y after every drag. */
function appletUpgradeCenters(corners) {
  return corners.map((p) => P(p.x, p.y));
}

/* Scrollbar(0, value, 5, 0, 600), one per radius; getValue() is a double in R. */
function appletScrollbar(value) {
  return Math.max(0, Math.min(600, Math.round(value / 5) * 5));
}

/* ------------------------------------------- independent covering arithmetic */

/* A separate sampler from C.samplePolygon: barycentric for triangles, ray
 * casting for the quadrilateral, and a different lattice (offset by a third
 * of the mesh). */
function indepSamples(poly, h) {
  const pts = [];
  const tri = poly.length === 3;
  const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const inside = (p) => {
    if (tri) {
      const d1 = cross(poly[0], poly[1], p), d2 = cross(poly[1], poly[2], p);
      const d3 = cross(poly[2], poly[0], p);
      return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
    }
    let odd = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y)
        && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) odd = !odd;
    }
    return odd;
  };
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  for (let x = Math.min(...xs); x <= Math.max(...xs) + h / 3; x += h) {
    for (let y = Math.min(...ys); y <= Math.max(...ys) + h / 3; y += h) {
      const p = P(x + h / 3, y + h / 3);
      if (inside(p)) pts.push(p);
    }
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const n = Math.max(1, Math.ceil(dist(a, b) / (h / 2)));
    for (let k = 0; k <= n; k++) {
      pts.push(P(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n));
    }
  }
  return pts;
}

/* The largest value of min_i(dist(p, centre_i) - r_i) over the samples;
 * a value <= 0 means covered at every sample, <= -h means certainly covered
 * everywhere (the function is 1-Lipschitz). */
function indepMaxGap(pts, disks, indices) {
  let max = -Infinity;
  for (const p of pts) {
    let gap = Infinity;
    for (const i of indices) gap = Math.min(gap, dist(p, disks[i].center) - disks[i].r);
    if (gap > max) max = gap;
  }
  return max;
}

function indepCovered(poly, disks, indices, h = 4) {
  return indepMaxGap(indepSamples(poly, h), disks, indices) <= 0;
}

/* Covering is only decisive when the sampled gap is <= -h (certainly covered
 * everywhere by the Lipschitz bound) or > 0 (a proved hole). Near zero, use a
 * finer mesh instead of trusting one lattice of samples. */
function certifiedCover(poly, disks, indices, h = 3, depth = 0) {
  const gap = indepMaxGap(indepSamples(poly, h), disks, indices);
  if (gap <= -h) return { covered: true, certain: true, gap: gap };
  if (gap > 0) return { covered: false, certain: true, gap: gap };
  if (depth >= 2) return { covered: gap <= 0, certain: false, gap: gap };
  return certifiedCover(poly, disks, indices, h / 4, depth + 1);
}

/* The same refinement on the core's side, so a comparison is only made when
 * both answers have a certified margin. */
function coreCertified(state, h = 3, depth = 0) {
  const g = C.geometry(state, h);
  if (!g) return null;
  const decisive = [g.quad].concat(g.triangles.map((t) => t.own))
    .every((c) => c.certainCovered || c.certainUncovered);
  if (decisive || depth >= 2) return g;
  return coreCertified(state, h / 4, depth + 1);
}

function isConvex(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(z) < 1e-7) continue;
    if (!sign) sign = Math.sign(z);
    else if (Math.sign(z) !== sign) return false;
  }
  return sign !== 0;
}

/* Find the least common scale of a radius direction that covers the quad,
 * using only the independent sampler, then round up to the scrollbar grid. */
function tightRadii(q, w, rand) {
  const pts = indepSamples(q, 12);
  const base = pts.map((p) => q.map((c) => dist(p, c)));
  const gapAt = (scale) => {
    let m = -Infinity;
    for (const row of base) {
      let g = Infinity;
      for (let i = 0; i < 4; i++) g = Math.min(g, row[i] - w[i] * scale);
      if (g > m) m = g;
    }
    return m;
  };
  let lo = 0, hi = 3000;
  for (let k = 0; k < 19; k++) {
    const mid = (lo + hi) / 2;
    if (gapAt(mid) <= 0) hi = mid; else lo = mid;
  }
  return w.map((x) => appletScrollbar(Math.ceil((hi * x * 1.18) / 5) * 5 + (rand() < 0.1 ? 5 : 0)));
}

/* ------------------------------------------------------------ 1. start/rules */

{
  const s = C.start({});
  const reset = appletInit();
  for (let i = 0; i < 4; i++) {
    equal(`init puts corner ${C.NAMES[i]} at the applet's point`, s[C.NAMES[i]], reset[i]);
  }
  equal("init sets the applet's four radii", s.radii, APPLET_RADII);
  check("init turns every circle on", s.on.every((v) => v === true));
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
  const g = C.geometry(s, 4);
  check("the start position has a geometry", !!g);
  check("the start position does not satisfy the covering hypothesis", !g.hypothesis);
  check("the status explains that the circles do not cover yet", /do not cover/.test(C.describe(s, g)));
}

/* --------------------------- 2. the applet's methods over their whole range */

{
  /* InCircle at the exact boundary, one unit inside/outside, the centre, and
   * random points, for every circle and every scrollbar value. */
  const radii = [0, 5, 120, 140, 160, 180, 555, 600];
  let compared = 0, mismatches = 0;
  for (let i = 0; i < 4; i++) {
    for (const r of radii) {
      const centre = appletInit()[i];
      const disk = { x: centre.x, y: centre.y, r: r };
      const offsets = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const s of [-1, 0, 1]) {
        offsets.push([r + s, 0], [-r - s, 0], [0, r + s], [0, -r - s]);
      }
      const probe = (dx, dy) => {
        const p = P(centre.x + dx, centre.y + dy);
        if (appletInCircle(disk, p) !== C.inCircle({ center: centre, r: r }, p)) mismatches++;
        compared++;
      };
      for (const [dx, dy] of offsets) probe(dx, dy);
    }
  }
  const rand = rng(17);
  for (let k = 0; k < 4000; k++) {
    const i = k % 4;
    const centre = appletInit()[i];
    const r = [0, 5, 120, 140, 160, 180, 600][k % 7];
    const p = P(centre.x + (rand() - 0.5) * 2 * (r + 2),
      centre.y + (rand() - 0.5) * 2 * (r + 2));
    if (appletInCircle({ x: centre.x, y: centre.y, r: r }, p)
      !== C.inCircle({ center: centre, r: r }, p)) mismatches++;
    compared++;
  }
  check(`InCircle matches the applet on ${compared} probes`, compared > 4000 && mismatches === 0,
    `${mismatches} mismatches`);

  /* The strict boundary is ported: the circle itself is not "inside". */
  const boundary = C.inCircle({ center: P(100, 100), r: 50 }, P(150, 100));
  check("a point on the circle is not inside it", boundary === false);
  check("a point one unit inside is inside", C.inCircle({ center: P(100, 100), r: 50 }, P(149, 100)));
  check("NaN is not inside a circle", C.inCircle({ center: P(100, 100), r: 50 }, P(NaN, 100)) === false);
}

{
  /* Every possible scrollbar value, for all four control bars. */
  let mismatches = 0;
  for (let i = 0; i < 4; i++) {
    for (let v = 0; v <= 600; v++) {
      if (C.snapRadius(v) !== appletScrollbar(v)) mismatches++;
      const s = C.setRadius(C.start(), i, v);
      if (s.radii[i] !== appletScrollbar(v)) mismatches++;
    }
  }
  check("all 2404 scrollbar values agree with the applet", mismatches === 0);
  check("a value below the minimum is clamped to 0", C.setRadius(C.start(), 0, -50).radii[0] === 0);
  check("a value above the maximum is clamped to 600", C.setRadius(C.start(), 3, 5000).radii[3] === 600);
  const before = C.start();
  check("an unknown scrollbar is ignored", C.setRadius(before, 4, 200) === before);
  check("setRadius keeps the other three radii",
    JSON.stringify(C.setRadius(C.start(), 1, 275).radii) === JSON.stringify([120, 275, 160, 180]));
}

{
  /* mouseClicked over random positions, radii and On states. Some clicks sit
   * in two or three overlapping circles at once. */
  const rand = rng(991);
  let cases = 0, mismatches = 0, multiple = 0;
  for (let trial = 0; trial < 800; trial++) {
    const q = appletInit();
    const radii = q.map(() => 40 + Math.floor(rand() * 400));
    const on = q.map(() => rand() < 0.5);
    const p = P(rand() * 640, rand() * 400);
    const circles = q.map((c, i) => ({ x: c.x, y: c.y, r: radii[i] }));
    const expected = appletClick(circles, on, p);
    const state = Object.assign(C.start(), { radii: radii, on: on });
    const actual = C.toggleAt(state, p);
    if (JSON.stringify(expected) !== JSON.stringify(actual.on)) mismatches++;
    const hits = C.circlesAt(state, p);
    if (hits.length > 1) multiple++;
    cases++;
  }
  check(`mouseClicked matches the applet on ${cases} clicks (${multiple} in overlapping circles)`,
    mismatches === 0 && multiple > 10, `${mismatches} mismatches`);

  /* UpgradeCenters: after a drag, every disk centre is the matching corner. */
  let s = C.start();
  for (const name of C.NAMES) {
    s = C.moveVertex(s, name, P(100 + rand() * 400, 50 + rand() * 300));
  }
  const ds = C.disks(s);
  const centres = appletUpgradeCenters(C.NAMES.map((n) => s[n]));
  check("UpgradeCenters: every disk centre follows its corner",
    ds.every((d, i) => closeP(d.center, centres[i])));
  check("a click outside every circle changes nothing",
    C.toggleAt(s, P(0, 0)) === s);
}

{
  /* init()'s integer divisions at other canvas sizes, including odd ones. */
  let mismatches = 0;
  for (const [w, h] of [[640, 400], [641, 401], [100, 100], [999, 777], [7, 9], [1200, 700]]) {
    const s = C.start({ width: w, height: h });
    const q = appletInit(w, h);
    if (!C.NAMES.every((n, i) => closeP(s[n], q[i]))) mismatches++;
  }
  check("init's integer divisions match at six canvas sizes", mismatches === 0);
}

/* ------------------------------------------- 3. state changes and the demo */

{
  const s = C.start();
  const moved = C.moveVertex(s, "C", P(10, 10));
  check("a drag leaves the old position alone", s.C.x === 480 && moved.C.x === C.PAD);
  check("a drag marks the diagram explored", moved.explored && !s.explored);
  check("an unknown corner is ignored", C.moveVertex(s, "Z", P(5, 5)) === s);
  check("a non-finite corner is ignored", C.moveVertex(s, "A", P(NaN, 5)) === s);
  const far = C.moveVertex(s, "B", P(9999, -9999));
  check("corners are clamped inside the board",
    far.B.x === C.VIEW.width - C.PAD && far.B.y === C.PAD);
  const hidden = C.toggleCircle(s, 2);
  check("the toggle button flips one circle", !hidden.on[2] && s.on[2]);
  check("an unknown circle button is ignored", C.toggleCircle(s, 9) === s);
  const r = C.reset(hidden);
  check("Reset restores the four corners and radii",
    closeP(r.A, P(160, 100)) && JSON.stringify(r.radii) === JSON.stringify(APPLET_RADII));
  check("Reset switches every circle back on", r.on.every(Boolean) && !hidden.on[2]);
  check("Reset keeps the explored flag", r.explored);
  check("a demo has no result even after exploring", C.result(moved) === null);
  check("the status mentions hidden circles",
    /hidden/.test(C.describe(hidden, C.geometry(hidden, 4))));
  check("a hidden circle is not part of the hypothesis",
    !C.geometry(Object.assign(C.start(), { on: [true, true, false, true] }), 4).hypothesis);
  check("geometry rejects a non-finite corner",
    C.geometry(Object.assign(C.start(), { A: P(NaN, 5) }), 4) === null);
  check("geometry rejects a non-finite radius",
    C.geometry(Object.assign(C.start(), { radii: [NaN, 1, 2, 3] }), 4) === null);
  check("describe works with no geometry", typeof C.describe({ on: [true, true, true, true] }) === "string");
}

/* ------------------ 4. the page's exact claim over many covering configurations */

const TRIS = [[0, 1, 2], [1, 2, 3], [2, 3, 0], [3, 0, 1]];
const QUADS = [
  ["a square", [P(180, 110), P(460, 110), P(460, 290), P(180, 290)]],
  ["a rectangle", [P(120, 80), P(520, 80), P(520, 320), P(120, 320)]],
  ["a tilted quadrilateral", [P(150, 230), P(310, 330), P(520, 130), P(250, 70)]],
  ["a dart (non-convex)", [P(120, 90), P(520, 170), P(300, 190), P(120, 320)]],
  ["the applet's start", appletInit()],
];

{
  const rand = rng(20260726);
  for (const [name, q] of QUADS) {
    const w = [0.4 + rand() * 0.6, 0.4 + rand() * 0.6, 0.4 + rand() * 0.6, 0.4 + rand() * 0.6];
    const radii = tightRadii(q, w, rand);
    if (radii.some((r) => r > 600)) continue;
    const ds = q.map((c, i) => ({ center: c, r: radii[i] }));
    const quadCover = certifiedCover(q.slice(), ds, [0, 1, 2, 3]);
    check(`${name}: four circles cover the quadrilateral`, quadCover.covered && quadCover.certain,
      `maxGap ${quadCover.gap}`);
    const triangleClaims = TRIS.map((t) => certifiedCover(t.map((i) => q[i]), ds, t));
    check(`${name}: some three circles cover one of the four triangles`,
      triangleClaims.some((c) => c.covered && c.certain),
      JSON.stringify(triangleClaims.map((c) => +c.gap.toFixed(2))));
    const state = Object.assign(C.start(), {
      A: q[0], B: q[1], C: q[2], D: q[3], radii: radii,
    });
    const g = coreCertified(state);
    check(`${name}: the core sees the covering hypothesis`, !!g && g.hypothesis);
    check(`${name}: the core finds a covered triangle`, !!g && g.conclusion);
    check(`${name}: the core agrees with the independent theorem check`,
      !!g && g.triangles.every((t, i) => t.own.covered === triangleClaims[i].covered));
  }
}

{
  const rand = rng(4261);
  let generated = 0, covering = 0, hypothesisFailures = 0, conclusionFailures = 0;
  let coreFailures = 0, literalFailures = 0, tightest = Infinity, undecided = 0;
  for (let trial = 0; trial < 420 && covering < 180; trial++) {
    /* Convex quadrilaterals: four directions around a centre, with a random
     * radius in each direction, then sorted by angle. */
    const cx = 320, cy = 200;
    const q = [0, 1, 2, 3].map(() => {
      const a = rand() * 2 * Math.PI, r = 55 + rand() * 205;
      return P(cx + r * Math.cos(a) * 1.3, cy + r * Math.sin(a));
    });
    q.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    if (!isConvex(q)) continue;
    generated++;
    const w = [0.08 + rand() * 0.92, 0.08 + rand() * 0.92,
      0.08 + rand() * 0.92, 0.08 + rand() * 0.92];
    const radii = tightRadii(q, w, rand);
    if (radii.some((r) => r > 600)) continue;
    const ds = q.map((c, i) => ({ center: c, r: radii[i] }));
    const quadCover = certifiedCover(q.slice(), ds, [0, 1, 2, 3]);
    if (!quadCover.covered || !quadCover.certain) continue;
    const claims = TRIS.map((t) => certifiedCover(t.map((i) => q[i]), ds, t));
    if (claims.some((c) => !c.certain)) { undecided++; continue; }
    covering++;
    tightest = Math.min(tightest, -quadCover.gap);
    if (!claims.some((c) => c.covered)) conclusionFailures++;
    const anyTriple = TRIS.map((t) => {
      const poly = t.map((i) => q[i]);
      const rows = indepSamples(poly, 3);
      const triples = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
      return triples.some((tr) => indepMaxGap(rows, ds, tr) <= 0);
    });
    if (!anyTriple.some(Boolean)) literalFailures++;
    const state = Object.assign(C.start(), { radii: radii, A: q[0], B: q[1], C: q[2], D: q[3] });
    const g = coreCertified(state);
    if (!g || !g.hypothesis) hypothesisFailures++;
    if (!g || !g.conclusion || !g.theorem) coreFailures++;
    else if (g.triangles.some((t, i) => t.own.covered !== claims[i].covered)) coreFailures++;
    else if (!g.conclusionLiteral) coreFailures++;
  }
  check(`found ${covering} certified covering configurations from ${generated} convex quadrilaterals`,
    covering >= 160 && generated >= covering, `covering=${covering}, generated=${generated}`);
  check("borderline configurations were refined rather than guessed", undecided < covering / 4,
    `undecided ${undecided}`);
  check("the covering hypothesis holds in every generated configuration", hypothesisFailures === 0);
  check("the page's claim holds in every generated configuration", conclusionFailures === 0);
  check("the weaker 'any three circles' reading also holds", literalFailures === 0);
  check("the core agrees with the independent coverage test", coreFailures === 0);
  check("the tested configurations are near-tight (smallest certified margin > 0)",
    tightest > 0 && tightest < 200, `smallest margin ${tightest}`);
}

/* --------------------------- 5. the convenience button and boundary inputs */

{
  const s = C.start();
  const fitted = C.fitRadii(s);
  check("Make them cover keeps every radius on the scrollbar grid",
    fitted.every((r) => r === appletScrollbar(r) && r >= 0 && r <= 600));
  const g = C.geometry(Object.assign({}, s, { radii: fitted }), 3);
  check("Make them cover reaches the covering hypothesis", g.hypothesis);
  check("Make them cover also shows a covered triangle", g.conclusion);
  const zero = Object.assign(C.start(), { radii: [0, 0, 0, 0] });
  check("four zero radii cover nothing", !C.geometry(zero, 6).hypothesis);
  check("fitRadii recovers from four zero radii", C.geometry(
    Object.assign(zero, { radii: C.fitRadii(zero) }), 3).hypothesis);
  const repeated = Object.assign(C.start(), { B: P(160, 100) });
  check("a repeated corner is still handled without NaN", !!C.geometry(repeated, 6));
  check("sampling a degenerate polygon gives finite samples",
    C.samplePolygon([P(0, 0), P(0, 0), P(0, 0)], 5).every((p) => Number.isFinite(p.x)));
  check("a point outside a polygon is rejected",
    !C.pointInPolygon(P(999, 999), [P(0, 0), P(10, 0), P(10, 10), P(0, 10)]));
  check("a point inside a polygon is accepted",
    C.pointInPolygon(P(5, 5), [P(0, 0), P(10, 0), P(10, 10), P(0, 10)]));
  /* The Lipschitz certification: certainly covered implies covered. */
  const rows = [[-8, -8, -8, -8], [-6, -6, -6, -6]];
  check("a gap below -h certifies covering at this mesh",
    C.classify(C.maxGap(rows, [0, 1, 2, 3]), 5).certainCovered);
  check("a positive gap certifies a hole",
    C.classify(C.maxGap([[3, 3, 3, 3]], [0, 1, 2, 3]), 5).certainUncovered);
}

done("circles-cover-quadrilateral");
