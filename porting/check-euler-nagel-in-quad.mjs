#!/usr/bin/env node
"use strict";

/*
 * Logic test for euler-nagel-in-quad/euler-nagel-in-quad-core.js.
 *
 *   node porting/check-euler-nagel-in-quad.mjs
 *
 * Checks the applet's Reset() quadrilateral and six options, the four
 * draggable corners, and then the page's three claims:
 *   (1)  in a triangle, N is the midpoint of HO and HG:GO = 2:1;
 *   (1') in any quadrilateral, H',N',G',O' are collinear with
 *        H'N':N'O' = 1:1 and H'G':G'O' = 2:1;
 *   (2)  in a cyclic quadrilateral the homothety centres H,N,G,O satisfy
 *        HN:NO = 1:2 and HG:GO = 1:1.
 * Every drawing point is also recomputed by a second, literal transcription
 * of the applet's bytecode and compared over fixed shapes and 1,500 random
 * quadrilaterals.  The claims are checked a third way, with ordinary linear
 * algebra, over 2,000 random shapes and 2,000 random cyclic ones.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("euler-nagel-in-quad/euler-nagel-in-quad-core.js", "EulerNagelInQuadCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const dot = (p, q) => p.x * q.x + p.y * q.y;
const cross = (p, q) => p.x * q.y - p.y * q.x;
const lerp = (p, q, t) => P(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const same = (p, q, tol) => finite(p) && finite(q) && dist(p, q) <= tol;
/* Both transcriptions may return the applet's NaN for the same degenerate
 * construction; that still counts as agreement. */
const sameDrawing = (p, q, tol) =>
  (finite(p) && finite(q) && dist(p, q) <= tol) || (!finite(p) && !finite(q));
const scaleOf = (q) => Math.max(1, ...q.flatMap((p) => q.map((r) => dist(p, r))));
function distToLine(p, a, b) {
  const n = dist(a, b);
  return n > 0 ? Math.abs(cross(sub(p, a), sub(b, a))) / n : dist(p, a);
}

/* ----------------------------------------- the applet's arithmetic, bytecode */

/* GeoSDoub.Intersect(p,q,r,s).  Local slots 4..20 of the javap listing:
 * line coefficients a=p.y-q.y, b=q.x-p.x, c=p.x*q.y-p.y*q.x (and the same
 * for r,s), det = a1*b2-a2*b1, NaN when |det| < 1. */
function appletLines(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* EulerNagelInQuadCanvas.Intersect: four near-coincidence tests with eps=1
 * before the GeoSDoub call. */
function appletIntersect(p, q, r, s) {
  if (dist(p, r) <= 1) return mid(p, r);
  if (dist(q, s) <= 1) return mid(q, s);
  if (dist(p, s) <= 1) return mid(p, s);
  if (dist(q, r) <= 1) return mid(q, r);
  return appletLines(p, q, r, s);
}

/* GeoSDoub.FindAltitude(p,q,r) = the foot of the perpendicular from p on qr. */
function appletFoot(p, q, r) {
  const l = P(p.x + r.y - q.y, p.y - (r.x - q.x));
  return appletLines(p, l, q, r);
}
function appletOrthocenter(p, q, r) {
  const fp = appletFoot(p, q, r);
  const fq = appletFoot(q, p, r);
  return appletLines(p, fp, q, fq);
}
function appletCircumcenter(p, q, r) {
  const m1 = mid(p, q), m2 = mid(q, r);
  const l1 = P(m1.x + q.y - p.y, m1.y - (q.x - p.x));
  const l2 = P(m2.x + r.y - q.y, m2.y - (r.x - q.x));
  return appletLines(m1, l1, m2, l2);
}
function appletNinepoint(p, q, r) {
  return mid(appletOrthocenter(p, q, r), appletCircumcenter(p, q, r));
}
function appletCentroid(p, q, r) {
  return P((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);
}

/* Canvas.Reset() on a WxH canvas: r = min(W,H)/3, centre (W/2,H/2), and the
 * four literal angle constants; only A[0] gets the extra +40 in x. */
function appletReset(W = 560, H = 400) {
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 3;
  return [0.5235987755982988, 2.6179938779914944,
    3.765191430678208, 5.235987755982989].map((a, i) => P(
    cx + r * Math.cos(a) + (i === 0 ? 40 : 0),
    cy + r * Math.sin(a),
  ));
}

function appletCompute(q) {
  const [a, b, c, d] = q;
  const tris = [[b, c, d], [a, c, d], [a, b, d], [a, b, c]];
  const H = tris.map((t) => appletOrthocenter(...t));
  const N = tris.map((t) => appletNinepoint(...t));
  const G = tris.map((t) => appletCentroid(...t));
  const O = tris.map((t) => appletCircumcenter(...t));
  return {
    HH: H, NN: N, GG: G, OO: O,
    H: appletIntersect(H[0], H[2], H[1], H[3]),
    N: appletIntersect(N[0], N[2], N[1], N[3]),
    G: appletIntersect(G[0], G[2], G[1], G[3]),
    O: appletIntersect(O[0], O[2], O[1], O[3]),
  };
}

/* ---------------------------- the page's claims, with ordinary linear algebra */

function cleanLines(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) return null;
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}
function cleanCircumcenter(p, q, r) {
  const m1 = mid(p, q), m2 = mid(q, r);
  return cleanLines(m1, P(m1.x + q.y - p.y, m1.y - (q.x - p.x)),
    m2, P(m2.x + r.y - q.y, m2.y - (r.x - q.x)));
}
function cleanOrthocenter(p, q, r) {
  const o = cleanCircumcenter(p, q, r);
  return o && P(p.x + q.x + r.x - 2 * o.x, p.y + q.y + r.y - 2 * o.y);
}
function cleanNinepoint(p, q, r) {
  const h = cleanOrthocenter(p, q, r), o = cleanCircumcenter(p, q, r);
  return h && o && mid(h, o);
}
function cleanCentroid(p, q, r) {
  return P((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);
}

/* Ratios along HO: the page's (1) and (1'). */
function lineRatios(h, n, g, o) {
  const size = dist(h, o);
  if (!(size > 5) || ![n, g].every(finite)) return null;
  const tol = 1e-7 * size;
  const tOf = (p) => dot(sub(p, h), sub(o, h)) / (size * size);
  const tN = tOf(n), tG = tOf(g);
  return {
    collinear: Math.max(distToLine(n, h, o), distToLine(g, h, o)) <= tol,
    order: 0 < tN && tN < tG && tG < 1,
    nRatio: dist(n, lerp(h, o, 1 / 2)) <= tol,
    gRatio: dist(g, lerp(h, o, 2 / 3)) <= tol,
    tN: tN, tG: tG, tol: tol, size: size,
  };
}

function cleanQuad(q) {
  const [a, b, c, d] = q;
  const tris = [[b, c, d], [a, c, d], [a, b, d], [a, b, c]];
  const HH = tris.map((t) => cleanOrthocenter(...t));
  const NN = tris.map((t) => cleanNinepoint(...t));
  const GG = tris.map((t) => cleanCentroid(...t));
  const OO = tris.map((t) => cleanCircumcenter(...t));
  if (![...HH, ...NN, ...GG, ...OO].every(finite)) return null;
  const H = cleanLines(HH[0], HH[2], HH[1], HH[3]);
  const N = cleanLines(NN[0], NN[2], NN[1], NN[3]);
  const G = cleanLines(GG[0], GG[2], GG[1], GG[3]);
  const O = cleanLines(OO[0], OO[2], OO[1], OO[3]);
  if (![H, N, G, O].every(finite)) return null;
  return { HH: HH, NN: NN, GG: GG, OO: OO, H: H, N: N, G: G, O: O };
}

/* For a cyclic quadrilateral the four circumcentres coincide, so the
 * combined O must be read from OO[0] rather than from intersecting the
 * (degenerate) lines OO[0]OO[2] and OO[1]OO[3]. */
function cleanCyclicArrays(q) {
  const [a, b, c, d] = q;
  const tris = [[b, c, d], [a, c, d], [a, b, d], [a, b, c]];
  const HH = tris.map((t) => cleanOrthocenter(...t));
  const NN = tris.map((t) => cleanNinepoint(...t));
  const GG = tris.map((t) => cleanCentroid(...t));
  const OO = tris.map((t) => cleanCircumcenter(...t));
  if (![...HH, ...NN, ...GG, ...OO].every(finite)) return null;
  return { HH: HH, NN: NN, GG: GG, OO: OO, O: OO[0] };
}

/* Cyclic quadrilaterals: the page's homothety centres H,N,G of
 * HA..HD, NA..ND, GA..GD with ABCD.  Claim (2) uses 1:2 and 1:1. */
function cyclicRatios(q, clean) {
  const [a, b] = q;
  const h = cleanLines(a, clean.HH[0], b, clean.HH[1]);
  const n = cleanLines(a, clean.NN[0], b, clean.NN[1]);
  const g = cleanLines(a, clean.GG[0], b, clean.GG[1]);
  const o = clean.OO[0];
  if (![h, n, g].every(finite)) return null;
  const size = dist(h, o);
  if (!(size > 5)) return null;
  const tol = 1e-7 * size;
  const tOf = (p) => dot(sub(p, h), sub(o, h)) / (size * size);
  const tN = tOf(n), tG = tOf(g);
  return {
    collinear: Math.max(distToLine(n, h, o), distToLine(g, h, o)) <= tol,
    order: 0 < tN && tN < tG && tG < 1,
    nRatio: dist(n, lerp(h, o, 1 / 3)) <= tol,
    gRatio: dist(g, mid(h, o)) <= tol,
    tN: tN, tG: tG,
    centers: { H: h, N: n, G: g, O: o },
  };
}

/* ----------------------------------------------- 1. start, options and moves */

const startQuad = appletReset();
{
  const s = C.start({});
  equal("Reset corner A is the applet's first point", s.A, startQuad[0]);
  equal("Reset corner B is the applet's second point", s.B, startQuad[1]);
  equal("Reset corner C is the applet's third point", s.C, startQuad[2]);
  equal("Reset corner D is the applet's fourth point", s.D, startQuad[3]);
  check("the old applet's +40 x offset on A is kept", s.A.x === 40 + 280 + (400 / 3) * Math.cos(0.5235987755982988));
  check("all six checkboxes start unchecked", Object.values(s.options).every((v) => v === false));
  check("an illustration has no win, loss or result", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  check("the start quadrilateral has a valid construction", C.geometry(s).valid);
}

{
  const s = C.start();
  const p = P(90, 310);
  const moved = C.move(s, "A", p);
  equal("moving A takes the corner to the pointer", moved.A, p);
  check("moving a corner does not change the old state", s.A.x === startQuad[0].x && !s.explored);
  check("moving a corner marks it explored", moved.explored);
  check("an unknown corner is ignored", C.move(s, "Z", p) === s);
  check("a non-finite corner is ignored", C.move(s, "B", P(NaN, 4)) === s);
  const far = C.move(s, "C", P(9999, -9999));
  equal("a dragged corner is clamped inside the board",
    far.C, P(C.VIEW.width - C.PAD, C.PAD));
  const on = C.setOption(s, "eulerLines", true);
  check("an option toggles on and marks the picture explored", on.options.eulerLines && on.explored && !s.explored);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const off = C.setOption(on, "eulerLines", false);
  check("an option toggles back off", !off.options.eulerLines && off.explored);
  const reset = C.reset(on);
  equal("Reset restores the four applet corners", [reset.A, reset.B, reset.C, reset.D], startQuad);
  check("Reset keeps the checkboxes and the explored flag",
    reset.options.eulerLines && reset.explored);
  check("the status describes the main line", /halfway.*two thirds/.test(C.describe(s)));
  check("with diagonals on, the status names the diagonals",
    /diagonals AC and BD/.test(C.describe(C.setOption(s, "diagonals", true))));
  check("with Euler lines on, the status names them",
    /Euler lines/.test(C.describe(C.setOption(s, "eulerLines", true))));
  check("the core has no DOM", typeof globalThis.document === "undefined");
}

/* ----------------------------------- 2. second transcription of the bytecode */

const square = [P(80, 80), P(320, 80), P(320, 320), P(80, 320)];
const rectangle = [P(60, 110), P(340, 110), P(340, 250), P(60, 250)];
const tilted = [P(70, 180), P(250, 250), P(340, 110), P(140, 60)];
const bowtie = [P(80, 80), P(320, 240), P(80, 240), P(320, 80)];
const dart = [P(90, 90), P(320, 150), P(200, 160), P(90, 260)];
const fixed = [
  ["the applet's start", startQuad],
  ["a square", square],
  ["a rectangle", rectangle],
  ["a tilted quadrilateral", tilted],
  ["a bow-tie quadrilateral", bowtie],
  ["a dart", dart],
];

{
  let compared = 0, mismatches = 0;
  const compare = (label, q) => {
    const g = C.compute(...q);
    const ap = appletCompute(q);
    if (!g || !g.valid || !finite(ap.H) || !finite(ap.N) || !finite(ap.G) || !finite(ap.O)) return;
    const tol = 1e-9 * scaleOf(q);
    for (const key of ["H", "N", "G", "O"]) {
      if (!sameDrawing(g[key], ap[key], tol)) {
        mismatches++;
        check(`${label}: core ${key} is the applet's centre`, false,
          `applet ${JSON.stringify(ap[key])}, core ${JSON.stringify(g[key])}`);
      }
    }
    for (const key of ["HH", "NN", "GG", "OO"]) {
      for (let i = 0; i < 4; i++) {
        if (!sameDrawing(g[key][i], ap[key][i], tol)) {
          mismatches++;
          check(`${label}: core ${key}[${i}] is the applet's triangle centre`, false,
            `applet ${JSON.stringify(ap[key][i])}, core ${JSON.stringify(g[key][i])}`);
        }
      }
    }
    compared++;
  };
  for (const [name, q] of fixed) compare(name, q);
  const rand = rng(1994);
  for (let trial = 0; trial < 1500; trial++) {
    const q = [0, 1, 2, 3].map(() => P(20 + rand() * 360, 20 + rand() * 260));
    compare(`random ${trial}`, q);
  }
  check(`core matches the applet's own method on ${compared} quadrilaterals`,
    compared > 1200 && mismatches === 0, `${mismatches} mismatches`);

  const g = C.compute(...startQuad);
  const ap = appletCompute(startQuad);
  for (const key of ["H", "N", "G", "O"]) {
    check(`the start's ${key} equals the applet's second transcription`,
      same(g[key], ap[key], 1e-9 * scaleOf(startQuad)));
  }
  check("the applet's HH[0] is the orthocentre of BCD",
    same(ap.HH[0], appletOrthocenter(startQuad[1], startQuad[2], startQuad[3]), 1e-9));
  check("the applet's GG[3] is the mean of ABC",
    same(ap.GG[3], P((startQuad[0].x + startQuad[1].x + startQuad[2].x) / 3,
      (startQuad[0].y + startQuad[1].y + startQuad[2].y) / 3), 1e-9));
  check("an applet intersection within one unit snaps to the midpoint",
    same(C.intersect(P(10, 10), P(100, 50), P(10.25, 10), P(30, 90)),
      P(10.125, 10), 1e-12)
    && same(appletIntersect(P(10, 10), P(100, 50), P(10.25, 10), P(30, 90)),
      P(10.125, 10), 1e-12));
  check("a near-parallel intersection gives NaN in both transcriptions",
    !finite(C.lineIntersection(P(0, 0), P(100, 0), P(0, 0.01), P(100, 0.01)))
    && !finite(appletLines(P(0, 0), P(100, 0), P(0, 0.01), P(100, 0.01))));
  check("Reset on the applet's own 400x300 canvas keeps the +40 offset",
    appletReset(400, 300)[0].x === 40 + 200 + (300 / 3) * Math.cos(0.5235987755982988));
}

/* ---------------------------------------- 3. the page's claims, independently */

{
  let tested = 0, failures = 0, coreFailures = 0, skipped = 0;
  const test = (label, q) => {
    const clean = cleanQuad(q);
    if (!clean) return;
    const ratios = lineRatios(clean.H, clean.N, clean.G, clean.O);
    if (!ratios) return;
    tested++;
    if (!ratios.collinear || !ratios.order || !ratios.nRatio || !ratios.gRatio) {
      failures++;
      check(`${label}: page claim (1') holds`, false, JSON.stringify(ratios));
    }
    const g = C.compute(...q);
    /* The applet's one-unit cut-off can leave a near-parallel centre pair
     * undrawn even though the theorem is true; those shapes are skipped for
     * the drawing comparison, but still tested by the algebra above. */
    const drawable = g && g.valid && [g.exact.H, g.exact.N, g.exact.G, g.exact.O].every(finite)
      && dist(g.exact.H, g.exact.O) > 1;
    if (!drawable) {
      skipped++;
    } else if (!g.claims.collinear || !g.claims.nMidpoint
      || !g.claims.gRatio || !g.claims.order) {
      coreFailures++;
      check(`${label}: the core reports the claim`, false, JSON.stringify(g.claims));
    }
    /* Claim (1) must hold inside each of the four triangles, too. */
    const tris = [q.slice(1), [q[0], q[2], q[3]], [q[0], q[1], q[3]], q.slice(0, 3)];
    for (let i = 0; i < 4; i++) {
      const t = tris[i];
      const h = cleanOrthocenter(...t), o = cleanCircumcenter(...t);
      const n = cleanNinepoint(...t), gg = cleanCentroid(...t);
      if (![h, o, n, gg].every(finite) || dist(h, o) < 5) continue;
      const tri = lineRatios(h, n, gg, o);
      if (!tri || !tri.collinear || !tri.nRatio || !tri.gRatio) {
        failures++;
        check(`${label}: page claim (1) in triangle ${i}`, false);
      }
    }
  };
  for (const [name, q] of fixed) test(name, q);
  const rand = rng(4821);
  for (let trial = 0; trial < 2000; trial++) {
    const q = [0, 1, 2, 3].map(() => P(20 + rand() * 360, 20 + rand() * 260));
    test(`random ${trial}`, q);
  }
  check(`page claims (1) and (1') hold on ${tested} quadrilaterals`,
    tested > 1500 && failures === 0, `${failures} failures`);
  check(`the core agrees with the independent algebra on ${tested - skipped} drawn quadrilaterals`,
    coreFailures === 0 && tested - skipped > 1200,
    `${coreFailures} failures, ${skipped} applet-degenerate shapes skipped`);

  /* The statement is affine: translation and scaling must preserve it. */
  const affine = (p) => P(2 * p.x + 17, 2 * p.y - 9);
  const scaled = tilted.map(affine);
  const cleanA = cleanQuad(tilted), cleanB = cleanQuad(scaled);
  check("the claim survives a translation and a scale",
    same(cleanB.H, affine(cleanA.H), 1e-7)
    && lineRatios(cleanB.H, cleanB.N, cleanB.G, cleanB.O).nRatio);
}

/* ----------------------------------------- 4. the cyclic quadrilateral claim */

{
  const rand = rng(91);
  let tested = 0, failures = 0, coreFailures = 0, skipped = 0, maxN = 0, maxG = 0;
  for (let trial = 0; trial < 2000; trial++) {
    const angles = [0, 1, 2, 3].map(() => rand() * 2 * Math.PI).sort((a, b) => a - b);
    const radius = 120 + rand() * 60;
    const q = angles.map((t) => P(280 + radius * Math.cos(t), 200 + radius * Math.sin(t)));
    const clean = cleanCyclicArrays(q);
    if (!clean) continue;
    const ratios = cyclicRatios(q, clean);
    if (!ratios) continue;
    tested++;
    maxN = Math.max(maxN, Math.abs(ratios.tN - 1 / 3));
    maxG = Math.max(maxG, Math.abs(ratios.tG - 1 / 2));
    if (!ratios.collinear || !ratios.order || !ratios.nRatio || !ratios.gRatio) {
      failures++;
      check(`cyclic ${trial}: page claim (2) holds`, false, JSON.stringify(ratios));
      continue;
    }
    const g = C.compute(...q);
    const cc = g && g.cyclicCenters;
    /* A triangle of three almost-collinear corners gives the applet a NaN
     * centre (its determinant threshold is one unit); the theorem is still
     * checked above, but that picture cannot be drawn, so skip it here. */
    const drawable = g && [].concat(g.HH, g.NN, g.GG, g.OO).every(finite);
    if (!drawable) {
      skipped++;
    } else if (!g.claims.cyclic || !g.claims.cyclicClaim || !cc
      || !same(cc.N, ratios.centers.N, 1e-6 * scaleOf(q))
      || !same(cc.G, ratios.centers.G, 1e-6 * scaleOf(q))) {
      coreFailures++;
      check(`cyclic ${trial}: the core finds the homothety centres`, false);
    }
  }
  check(`page claim (2) holds on ${tested} cyclic quadrilaterals`,
    tested > 1500 && failures === 0, `${failures} failures`);
  check(`the core finds the same homothety centres on ${tested - skipped} drawn cyclic quadrilaterals`,
    coreFailures === 0 && tested - skipped > 1500,
    `${coreFailures} failures, ${skipped} applet-degenerate shapes skipped`);
  check("the exact ratios are 1/3 and 1/2 along HO",
    maxN < 1e-6 && maxG < 1e-6, `max errors ${maxN}, ${maxG}`);
  check("a square's homothety centres are degenerate at the common centre",
    C.compute(...square).claims.cyclic && !C.compute(...square).claims.cyclicClaim);
}

/* ------------------------------------------------- 5. degenerate input is safe */

{
  const repeated = C.compute(P(10, 10), P(10, 10), P(90, 20), P(40, 80));
  check("a repeated corner leaves a triangle centre undefined",
    !repeated || repeated.HH.some((p) => !C.finite(p)));
  const flat = C.compute(P(10, 10), P(50, 10), P(90, 10), P(130, 10));
  check("four collinear corners are handled without throwing", !!flat);
  check("a non-finite corner gives no construction",
    C.compute(P(NaN, 10), P(50, 10), P(90, 20), P(40, 80)) === null);
  const degenerate = C.move(C.start(), "A", C.start().B);
  check("a degenerate status is still helpful",
    /four centre points/.test(C.describe(degenerate)));
  check("a degenerate picture has no result", C.result(degenerate) === null);
  check("describe works without a state", typeof C.describe({}) === "string");
}

done("euler-nagel-in-quad");
