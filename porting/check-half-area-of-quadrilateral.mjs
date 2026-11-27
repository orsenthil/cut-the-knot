#!/usr/bin/env node
"use strict";

/*
 * Logic test for half-area-of-quadrilateral/half-area-of-quadrilateral-core.js.
 *
 *   node porting/check-half-area-of-quadrilateral.mjs
 *
 * The page's exact claim: in quadrilateral ABCD, through the midpoint K of
 * diagonal BD draw the line parallel to diagonal AC, meeting AB at E; then CE
 * bisects the area of the quadrilateral.  The page adds that the applet allows
 * more general configurations and that the result remains valid for concave
 * quadrilaterals as long as BD lies in their interior.
 *
 * This test checks the claim three ways: (1) with an independent shoelace
 * transcription of the applet's own Compute() on the start position, fixed
 * shapes, a 48x48 grid of A and C positions and thousands of random shapes;
 * (2) the four triangle equalities used in the page's proof; (3) every point
 * and every drawn line of the core against a second, literal transcription of
 * the applet's Compute(), Draw(), ShowPremise() and ShowHint() bytecode.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("half-area-of-quadrilateral/half-area-of-quadrilateral-core.js",
  "HalfAreaOfQuadrilateralCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const cross = (p, q) => p.x * q.y - p.y * q.x;
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closePoint = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);
const scaleOf = (a, b, c, d) => Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a),
  dist(a, c), dist(b, d));
function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    s += p.x * q.y - p.y * q.x;
  }
  return Math.abs(s / 2);
}
function onSegment(e, p, q, tol) {
  if (!Number.isFinite(e.x)) return false;
  return Math.abs(cross(sub(e, p), sub(q, p))) <= tol
    && Math.min(p.x, q.x) - 1e-8 <= e.x && e.x <= Math.max(p.x, q.x) + 1e-8
    && Math.min(p.y, q.y) - 1e-8 <= e.y && e.y <= Math.max(p.y, q.y) + 1e-8;
}

/* ---------------------- second transcription, straight from the bytecode */

/* GeoSDoub.Midpoint / GetParallelTo / Intersect, as used by Compute(). */
const apMid = (p, q) => P((p.x + q.x) / 2.0, (p.y + q.y) / 2.0);
const apParallel = (p, q, r) =>
  P(p.x + 100.0 * (r.x - q.x), p.y + 100.0 * (r.y - q.y));
function apIntersect(p, q, r, s) {
  const l4 = p.y - q.y, l6 = q.x - p.x, l8 = p.x * q.y - p.y * q.x;
  const l10 = r.y - s.y, l12 = s.x - r.x, l14 = r.x * s.y - r.y * s.x;
  const den = l4 * l12 - l10 * l6;
  if (Math.abs(den) < 1) return P(NaN, NaN); // Java's 1px cutoff
  return P((l6 * l14 - l12 * l8) / den, (l8 * l10 - l14 * l4) / den);
}

/** HalfAreaOfQuadrilateralCanvas.Compute(), local slots L1,L2,L3 in order. */
function apCompute(A, B, Cc, D) {
  if (dist(A, B) < 1 || dist(A, Cc) < 1 || dist(A, D) < 1
    || dist(B, Cc) < 1 || dist(B, D) < 1 || dist(Cc, D) < 1) return null;
  const K = apMid(B, D);
  const L1 = apParallel(K, A, Cc);
  const L2 = apIntersect(K, L1, A, B);
  const L3 = apIntersect(K, L1, A, D);
  let E, tri2, quad3;
  if (dist(K, L2) < dist(K, L3)) { // dcmpg then ifge: NaN takes the else branch
    E = L2; tri2 = B; quad3 = D;
  } else {
    E = L3; tri2 = D; quad3 = B;
  }
  const L = apIntersect(A, K, Cc, E);
  return {
    K, E, L, guide: L1, onAB: L2, onAD: L3,
    quad: [Cc, E, A, quad3], tri: [Cc, E, tri2],
    /* Draw(): outline AB, BC, CD, DA, CE, in that order. */
    outline: [[A, B], [B, Cc], [Cc, D], [D, A], [Cc, E]],
    /* ShowPremise() then ShowHint(): BD, AC, KE; CK, AK. */
    premise: [[B, D], [A, Cc], [K, E]],
    hintTriangles: [[A, E, K], [Cc, E, K]],
    hint: [[Cc, K], [A, K]],
  };
}

/** HalfAreaOfQuadrilateralCanvas.init() at the applet's optimal W=400,H=250. */
function apReset(W, H) {
  return [
    P(W / 3, H / 7),
    P(W / 6, H * 5 / 6),
    P(W * 5 / 6, H * 4 / 5),
    P(W * 2 / 3, H / 4),
  ];
}

/**
 * The page's claim, measured independently of the core from the applet's own
 * E: the pink polygon [C,E,A,far corner] and the grey triangle [C,E,near
 * corner] have equal area.  E on the side segment is checked separately.
 */
function apClaim(A, B, Cc, D, ap) {
  const tol = 1e-8 * scaleOf(A, B, Cc, D) ** 2;
  const half = area(ap.quad), other = area(ap.tri);
  const near = ap.tri[2];
  const onSide = onSegment(ap.E, A, near, 1e-7 * scaleOf(A, B, Cc, D));
  const a2 = (p, q, r) => area([p, q, r]);
  const proof = {
    abkAdk: close(a2(A, B, ap.K), a2(A, D, ap.K), tol),
    cbkCdk: close(a2(Cc, B, ap.K), a2(Cc, D, ap.K), tol),
    aekCek: close(a2(A, ap.E, ap.K), a2(Cc, ap.E, ap.K), tol),
    // When E is A (the parallelogram-like case) the page's last subtraction
    // has a zero triangle on one side; the two halves still have equal area.
    aelCkl: dist(ap.E, A) < 1e-6
      ? true
      : close(a2(A, ap.E, ap.L), a2(Cc, ap.K, ap.L), tol),
  };
  return { half, other, equal: close(half, other, tol), onSide, proof, tol };
}

/* --------------------------------------------------- 1. start and controls */

{
  // The page embeds two copies of the applet that differ only in ShowNames
  // (0 and 1); this port starts with the names shown, as the second copy does.
  const s = C.start({});
  const reset = apReset(400, 250);
  equal("start A is the applet's (W/3,H/7)", s.A, reset[0]);
  equal("start B is the applet's (W/6,5H/6)", s.B, reset[1]);
  equal("start C is the applet's (5W/6,4H/5)", s.C, reset[2]);
  equal("start D is the applet's (2W/3,H/4)", s.D, reset[3]);
  check("Show names starts ticked, premise and hint do not",
    s.options.names && !s.options.premise && !s.options.hint);
  check("a demonstration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  const g = C.geometry(s);
  check("the start diagram has a construction", !!g && g.valid);
  check("E is on AB at the start", g && g.side === "AB");
  check("the start diagram satisfies the page's claim", g && g.claims.equalHalves && g.claims.bisects);
  check("the four steps of the page's proof hold at the start",
    g && g.claims.abkAdk && g.claims.cbkCdk && g.claims.aekCek && g.claims.aelCkl);
}

{
  const s = C.start();
  const moved = C.move(s, "C", P(-50, 900));
  check("moving a corner leaves the old position alone", s.C.x > 300 && moved.C.x === C.PAD);
  check("corners are clamped inside the board", moved.C.y === C.VIEW.height - C.PAD);
  check("moving a corner marks the diagram explored", moved.explored && !s.explored);
  check("moving an unknown corner is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("moving to a non-finite point is ignored", C.move(s, "A", P(NaN, 5)) === s);
  const premise = C.setOption(s, "premise", true);
  const hint = C.setOption(premise, "hint", true);
  check("premise enables the hint checkbox", !s.options.hint && premise.options.hint === false
    && hint.options.hint === true);
  check("unticking premise switches the hint off (as the panel does)",
    !C.setOption(hint, "premise", false).options.hint);
  check("ticking hint alone cannot enable it", !C.setOption(s, "hint", true).options.hint);
  const names = C.setOption(s, "names", false);
  check("names can be switched off", !names.options.names && s.options.names);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(hint);
  check("Reset restores the four corners", r.A.x === s.A.x && r.D.y === s.D.y);
  check("Reset keeps the checkboxes", r.options.premise && r.options.hint && r.explored);
  check("status explains the claim in words", /same area/.test(C.describe(s)));
  check("status mentions the hint when it is shown", /faint triangles/.test(C.describe(hint)));
  check("an illustration stays unfinished after moves and options", C.result(hint) === null);
}

/* ------------------------------------- 2. fixed shapes and the page's claim */

const square = [P(50, 40), P(350, 40), P(350, 210), P(50, 210)];
const rectangle = [P(70, 60), P(330, 60), P(330, 200), P(70, 200)];
const tilted = [P(60, 190), P(240, 225), P(350, 80), P(140, 35)];
const dart = [P(90, 60), P(340, 120), P(200, 135), P(90, 225)];
const bowtie = [P(60, 50), P(340, 210), P(60, 210), P(340, 50)];
const outsideBD = [P(200, 50), P(80, 190), P(320, 20), P(320, 60)];
const startQ = apReset(400, 250);
const fixed = [
  ["the applet's start", startQ], ["a square", square], ["a rectangle", rectangle],
  ["a tilted quadrilateral", tilted], ["a dart", dart], ["a crossed shape", bowtie],
  ["BD outside the shape", outsideBD],
];

for (const [name, q] of fixed) {
  const [a, b, c, d] = q;
  const ap = apCompute(a, b, c, d);
  const g = C.compute(a, b, c, d);
  const claim = apClaim(a, b, c, d, ap);
  check(`${name}: the applet and the core both build a construction`, !!ap && !!g);
  check(`${name}: the page's two pieces have equal area`, claim.equal,
    `${claim.half} vs ${claim.other}`);
  check(`${name}: the core agrees with the equal-area claim`, g.claims.equalHalves);
  check(`${name}: E is on the side AB or AD`, claim.onSide && g.claims.eOnSide);
  const eIsA = dist(g.E, g.A) < 1e-6; // a parallelogram: L is undefined
  check(`${name}: all applicable steps of the proof hold`,
    Object.values(claim.proof).every(Boolean)
      && g.claims.abkAdk && g.claims.cbkCdk && g.claims.aekCek
      && (eIsA || g.claims.aelCkl));
  check(`${name}: the core's branch matches the applet's nearer crossing`,
    g.useAB === (dist(ap.K, ap.onAB) < dist(ap.K, ap.onAD)));
}
check("the square's guide line lands on A, so the diagonal CE bisects it",
  closePoint(apCompute(...square).E, square[0], 1e-8));
check("a shape with BD outside is flagged as outside", !C.compute(...outsideBD).claims.bdInterior);
check("the start and the tilted shape have BD inside",
  C.compute(...startQ).claims.bdInterior && C.compute(...tilted).claims.bdInterior);

/* ----------------- 3. exhaustive grid, plus a comparison with the bytecode */

function audit(label, a, b, c, d, stats) {
  stats.seen++;
  const ap = apCompute(a, b, c, d);
  const g = C.compute(a, b, c, d);
  if (!ap || !g) {
    stats.rejected++;
    return false;
  }
  const tol = 1e-8 * scaleOf(a, b, c, d);
  if (![ap.K, ap.E, ap.L, ap.guide, ap.onAB, ap.onAD].every((p) => Number.isFinite(p.x))) {
    stats.invalid++;
    return true;
  }
  stats.valid++;
  const claim = apClaim(a, b, c, d, ap);
  if (!claim.equal) {
    stats.claimFailures++;
    check(`${label}: page claim failed`, false, `${claim.half} vs ${claim.other}`);
  }
  if (!claim.onSide || !g.claims.eOnSide) {
    stats.sideFailures++;
    check(`${label}: E is not on a side`, false);
  }
  if (!Object.values(claim.proof).every(Boolean)) {
    stats.proofFailures++;
    check(`${label}: one step of the proof failed`, false, JSON.stringify(claim.proof));
  }
  const pts = [
    ["K", g.K, ap.K], ["E", g.E, ap.E], ["L", g.L, ap.L], ["guide", g.guide, ap.guide],
    ["AB crossing", g.onAB, ap.onAB], ["AD crossing", g.onAD, ap.onAD],
  ];
  for (const [what, got, want] of pts) {
    if (!closePoint(got, want, tol)) {
      stats.appletFailures++;
      check(`${label}: core ${what} differs from the applet`, false,
        `${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
    }
  }
  if (!closePoint(g.quad[3], ap.quad[3], tol) || !closePoint(g.tri[2], ap.tri[2], tol)) {
    stats.appletFailures++;
    check(`${label}: core shading differs from Draw()`, false);
  }
  const cores = [g.premiseLines, g.hintTriangles, g.hintLines];
  const applets = [ap.premise, ap.hintTriangles, ap.hint];
  for (let i = 0; i < cores.length; i++) {
    for (let j = 0; j < cores[i].length; j++) {
      for (let k = 0; k < cores[i][j].length; k++) {
        if (!closePoint(cores[i][j][k], applets[i][j][k], tol)) {
          stats.appletFailures++;
          check(`${label}: core overlay ${i}/${j}/${k} differs from the applet`, false);
        }
      }
    }
  }
  if (!g.claims.equalHalves) stats.coreFailures++;
  if (g.claims.bdInterior) stats.interior++;
  if (g.claims.convex) stats.convex++;
  if (!g.claims.bdInterior) stats.outside++;
  return true;
}

{
  const stats = {
    seen: 0, rejected: 0, valid: 0, invalid: 0, interior: 0, outside: 0, convex: 0,
    claimFailures: 0, sideFailures: 0, proofFailures: 0,
    appletFailures: 0, coreFailures: 0,
  };
  const B = P(80, 190), D = P(320, 60);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 6; j++) {
      for (let k = 0; k < 8; k++) {
        for (let l = 0; l < 6; l++) {
          audit(`grid ${i},${j},${k},${l}`, P(40 + 40 * i, 20 + 30 * j), B,
            P(40 + 40 * k, 20 + 30 * l), D, stats);
        }
      }
    }
  }
  check("the 48x48 grid of A and C positions was covered", stats.seen === 48 * 48,
    `${stats.seen} configurations`);
  check("the grid's only rejections are coincident corners (the applet's 1px rule)",
    stats.rejected === 48 && stats.valid + stats.invalid + stats.rejected === stats.seen,
    JSON.stringify(stats));
  check("the page's equal-area claim holds on every grid configuration",
    stats.claimFailures === 0, `${stats.claimFailures} failures`);
  check("the nearer crossing is always on AB or AD on the grid",
    stats.sideFailures === 0, `${stats.sideFailures} failures`);
  check("all four proof steps hold on the grid", stats.proofFailures === 0);
  check("the core's points and lines match the applet's bytecode on the grid",
    stats.appletFailures === 0, `${stats.appletFailures} differences`);
  check("the core's equal-area flag agrees everywhere", stats.coreFailures === 0);
  check("the grid includes convex, BD-inside and BD-outside shapes",
    stats.convex > 100 && stats.interior > 100 && stats.outside > 100, JSON.stringify(stats));
}

/* --------------------------------------------- 4. thousands of random shapes */

{
  const rand = rng(5217);
  const stats = {
    seen: 0, rejected: 0, valid: 0, invalid: 0, interior: 0, outside: 0, convex: 0,
    claimFailures: 0, sideFailures: 0, proofFailures: 0,
    appletFailures: 0, coreFailures: 0,
  };
  for (let trial = 0; trial < 4000; trial++) {
    const q = [0, 1, 2, 3].map(() => P(12 + rand() * 376, 12 + rand() * 226));
    audit(`random ${trial}`, q[0], q[1], q[2], q[3], stats);
  }
  check("all four thousand random configurations were exercised", stats.seen === 4000);
  check("random shapes give drawings except the deliberately degenerate ones",
    stats.valid > 3900 && stats.valid + stats.invalid + stats.rejected === stats.seen,
    JSON.stringify(stats));
  check("the page's equal-area claim holds on all random shapes", stats.claimFailures === 0);
  check("E lands on AB or AD on all random shapes", stats.sideFailures === 0);
  check("the proof's triangle areas match on all random shapes", stats.proofFailures === 0);
  check("the core matches a second bytecode transcription on all random shapes",
    stats.appletFailures === 0 && stats.coreFailures === 0);
  check("random shapes include both BD-inside and BD-outside cases",
    stats.interior > 500 && stats.outside > 500, JSON.stringify(stats));
}

/* -------------------------------------------------- 5. degenerate behaviour */

{
  const a = P(20, 20);
  check("two coincident corners make Compute() return without drawing",
    C.compute(a, P(20, 20), P(100, 90), P(40, 150)) === null
      && apCompute(a, P(20, 20), P(100, 90), P(40, 150)) === null);
  check("a corner closer than one unit is refused just as in the applet",
    C.compute(a, P(20.5, 20), P(100, 90), P(40, 150)) === null);
  check("a non-finite corner is refused",
    C.compute(P(NaN, 20), P(80, 20), P(100, 90), P(40, 150)) === null);
  const degenerateState = C.move(C.start(), "B", P(133.33333333333334, 35.714285714285715));
  check("a degenerate position has a helpful status", /Move two corners apart/.test(C.describe(degenerateState)));
  check("a degenerate position still has no result", C.result(degenerateState) === null);
  // Four corners on one line make the guide parallel to both sides at A, so
  // GeoSDoub.Intersect() returns (NaN,NaN) exactly as in the applet.
  const line = [P(20, 20), P(100, 20), P(200, 20), P(300, 20)];
  const flat = C.compute(...line);
  const flatApplet = apCompute(...line);
  check("the applet's Intersect() returns NaN for the collinear case",
    !Number.isFinite(flatApplet.E.x) && !Number.isFinite(flatApplet.L.x));
  check("a NaN construction is reported as not drawable",
    !!flat && !flat.valid && /guide line misses/.test(C.describe({
      A: line[0], B: line[1], C: line[2], D: line[3], options: { hint: false },
    })));
  check("describe works on an empty position", typeof C.describe({}) === "string");
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("half-area-of-quadrilateral");
