#!/usr/bin/env node
"use strict";

/*
 * Logic test for carpets-in-quadri/carpets-in-quadri-core.js.
 *
 *   node porting/check-carpets-in-quadri.mjs
 *
 * Checks the applet's start quadrilateral and coefP, every kind of drag, the
 * two checkboxes, and then the page's exact claim:
 *
 *   with AP/AB = CQ/CD = r, R = AQ n DP and S = BQ n CP,
 *   area(PSQR) = area(ARD) + area(BSC),
 *   together with the proof's area(AQB) = area(ADP) + area(BCP) and
 *   q = r*d + (1-r)*c for the heights above AB.
 *
 * The claim is checked on a 0.01 grid of r over several fixed convex
 * quadrilaterals and on thousands of random convex ones. The whole drawing is
 * then transcribed a second time from the bytecode (Intersect's |den| < 1
 * cutoff, CreateMidPoint's t, NearestPoint's 0.1 shortcut) and compared with
 * the core over the same cases and more than a thousand random ones.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("carpets-in-quadri/carpets-in-quadri-core.js", "CarpetsInQuadriCore");

const P = (x, y) => ({ x, y });
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const dot = (p, q) => p.x * q.x + p.y * q.y;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closePoint = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);
const scaleOf = (a, b, c, d) => Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a));
const areaOf = (pts) => Math.abs(pts.reduce((s, p, i) => {
  const q = pts[(i + 1) % pts.length];
  return s + p.x * q.y - q.x * p.y;
}, 0) / 2);
function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
function convex(a, b, c, d) {
  const cs = [cross(a, b, c), cross(b, c, d), cross(c, d, a), cross(d, a, b)];
  return cs.every((v) => v > 1e-9) || cs.every((v) => v < -1e-9);
}
function signedHeight(p, a, b) {
  const n = dist(a, b);
  return n ? ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / n : 0;
}

/* --------------------------- the applet's arithmetic, transcribed literally */

/* DoubLine.CreateMidPoint(t): t*m_1 + (1-t)*m_2, where m_1 = Am and m_2 = Bm. */
function appletMidPoint(a, b, t) {
  return P(t * a.x + (1 - t) * b.x, t * a.y + (1 - t) * b.y);
}

/* GeoSDoub.Intersect(a,b,c,d): the four line coefficients l4..l14, then
 * x = (l6*l14 - l12*l8)/den, y = (l8*l10 - l14*l4)/den. NaN (NoDraw) when
 * |den| < 1. */
function appletIntersect(a, b, c, d) {
  const l4 = a.y - b.y, l6 = b.x - a.x, l8 = a.x * b.y - a.y * b.x;
  const l10 = c.y - d.y, l12 = d.x - c.x, l14 = c.x * d.y - c.y * d.x;
  const den = l4 * l12 - l10 * l6;
  if (Math.abs(den) < 1) return P(NaN, NaN);
  return P((l6 * l14 - l12 * l8) / den, (l8 * l10 - l14 * l4) / den);
}

/* GeoSDoub.NearestPoint(p,a,b), including the SqDist(a,p) < 0.1 shortcut. */
function appletNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return P(p.x, p.y);
  const k = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + dx * k, a.y + dy * k);
}

/* CarpetsInQuadriCanvas.Compute() and Draw(), in the bytecode's order. */
function appletCompute(a, b, c, d, t) {
  const Pp = appletMidPoint(a, b, t);
  const Q = appletMidPoint(c, d, t);
  const R = appletIntersect(a, Q, d, Pp);
  const S = appletIntersect(b, Q, c, Pp);
  const noDraw = Number.isNaN(S.x) || Number.isNaN(R.x);
  if (noDraw) return { P: Pp, Q, R, S, noDraw, feet: null, areas: null };
  return {
    P: Pp, Q, R, S, noDraw,
    feet: {
      Ap: appletNearest(a, c, d), Bp: appletNearest(b, c, d),
      Pp: appletNearest(Pp, c, d), Cp: appletNearest(c, a, b),
      Dp: appletNearest(d, a, b), Qp: appletNearest(Q, a, b),
    },
    areas: {
      blue: areaOf([Pp, S, Q, R]),
      red: areaOf([a, R, d]) + areaOf([b, S, c]),
      carpet: areaOf([a, Q, b]),
      halves: areaOf([a, d, Pp]) + areaOf([b, c, Pp]),
    },
  };
}

/* The independent statement of the page, not using the core at all. */
function pageClaim(a, b, c, d, r) {
  const Pp = P((1 - r) * a.x + r * b.x, (1 - r) * a.y + r * b.y);
  const Q = P((1 - r) * c.x + r * d.x, (1 - r) * c.y + r * d.y);
  const R = appletIntersect(a, Q, d, Pp);
  const S = appletIntersect(b, Q, c, Pp);
  if (Number.isNaN(R.x) || Number.isNaN(S.x)) return null;
  const scale = scaleOf(a, b, c, d);
  const tol = 1e-8 * scale * scale;
  const blue = areaOf([Pp, S, Q, R]);
  const red = areaOf([a, R, d]) + areaOf([b, S, c]);
  const hC = signedHeight(c, a, b), hD = signedHeight(d, a, b);
  return {
    blueEqualsRed: Math.abs(blue - red) <= tol,
    carpetEqualsHalves: Math.abs(areaOf([a, Q, b]) - areaOf([a, d, Pp]) - areaOf([b, c, Pp])) <= tol,
    heightsMatch: Math.abs(signedHeight(Q, a, b) - (r * hD + (1 - r) * hC)) <= 1e-8 * scale,
  };
}

/* -------------------------------------------------------- 1. start and rules */

{
  const s = C.start({});
  // Init() on a 400x300 canvas: W/5=80, H/5=60.
  equal("Init puts A at (80,180)", s.A, P(80, 180));
  equal("Init puts B at (320,240)", s.B, P(320, 240));
  equal("Init puts C at (320,60)", s.C, P(320, 60));
  equal("Init puts D at (160,60)", s.D, P(160, 60));
  check("coefP starts at 0.7", s.t === 0.7);
  check("names default on (the page passes ShowNames=1), hint off",
    s.options.names && !s.options.hint);
  check("a fresh diagram is not explored", !s.explored);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  const g = C.geometry(s);
  check("the start quadrilateral has a construction", !!g && !g.noDraw);
  check("the start quadrilateral is convex", g.convex);
  check("the start picture satisfies the page's claim", g.claims.blueEqualsRed);
  check("the start picture satisfies the proof's other identity",
    g.claims.carpetEqualsHalves && g.claims.heightsMatch);
  check("P = t*A + (1-t)*B is on AB", closePoint(g.P, P(152, 198), 1e-10));
  check("Q = t*C + (1-t)*D is on CD", closePoint(g.Q, P(272, 60), 1e-10));
}

/* ------------------------------------------- 2. every move and every option */

{
  const s = C.start();
  const moved = C.move(s, "C", P(10, 10));
  check("moving a corner leaves the old position alone", s.C.x === 320 && moved.C.x === C.PAD);
  check("moving a corner marks the diagram explored", moved.explored && !s.explored);
  check("an unknown handle is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("a non-finite point is ignored", C.move(s, "A", P(NaN, 4)) === s);
  const far = C.move(s, "B", P(9999, -9999));
  check("a corner is clamped inside the board",
    far.B.x === C.VIEW.width - C.PAD && far.B.y === C.PAD);
  const tMoved = C.move(s, "P", P(280, 240)); // near B
  // (280,240) is off AB; the drag is projected first, at
  // k = ((200*240)+(60*60))/(240^2+60^2), so t = 1-k.
  check("dragging P changes t to dist(B, projected P)/dist(A,B)",
    close(tMoved.t, 1 - 51600 / 61200, 1e-12));
  const tNearA = C.move(s, "P", P(80, 180));
  check("dragging P to A gives t = 1", Math.abs(tNearA.t - 1) < 1e-12);
  const carried = C.move(s, "A", P(60, 160));
  const c1 = C.geometry(s), c2 = C.geometry(carried);
  check("dragging A carries P along at constant t",
    closePoint(c2.P, P(0.7 * 60 + 0.3 * 320, 0.7 * 160 + 0.3 * 240), 1e-9));
  check("the old P and the carried P differ", dist(c1.P, c2.P) > 1);
  const off = C.move(s, "P", P(999, 999));
  check("a P drag past B is restricted to the segment", off.t === 0 && C.geometry(off).P.x === 320);
  const h = C.setOption(s, "hint", true);
  check("Hint toggles on and marks explored", h.options.hint && h.explored && !s.options.hint);
  check("names can be toggled off", !C.setOption(s, "names", false).options.names);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(h);
  check("Reset restores the quadrilateral and coefP", r.t === 0.7 && r.A.x === 80 && r.D.y === 60);
  check("Reset keeps the checkboxes and explored flag", r.options.hint && r.explored);
  check("status reports the equal areas", /Blue carpet/.test(C.describe(s)) && /equal/i.test(C.describe(s)));
  check("with Hint on the status mentions the heights",
    /heights/.test(C.describe(C.setOption(s, "hint", true))));
}

/* ------------------------------- 3. the page's claim on a grid and at random */

const square = [P(70, 60), P(330, 60), P(330, 260), P(70, 260)];
const rectangle = [P(100, 90), P(340, 110), P(340, 250), P(100, 250)];
const tilted = [P(60, 210), P(260, 270), P(360, 80), P(150, 40)];
const trapezoid = [P(60, 250), P(350, 250), P(300, 70), P(140, 70)];
const narrow = [P(120, 40), P(280, 55), P(250, 260), P(150, 260)];
const fixed = [
  ["the applet's start", [P(80, 180), P(320, 240), P(320, 60), P(160, 60)]],
  ["a square", square], ["a rectangle", rectangle], ["a tilted quadrilateral", tilted],
  ["a trapezoid", trapezoid], ["a narrow quadrilateral", narrow],
];

{
  let n = 0, bad = 0, beyond = 0;
  for (const [name, q] of fixed) {
    for (let k = 0; k <= 100; k++) {
      const r = k / 100;
      const claim = pageClaim(...q, r);
      if (!claim) { bad++; continue; }
      const g = C.compute(Object.assign(C.start(), {
        A: q[0], B: q[1], C: q[2], D: q[3], t: 1 - r,
      }));
      n++;
      if (!(claim.blueEqualsRed && claim.carpetEqualsHalves && claim.heightsMatch)) {
        bad++;
        check(`${name} at r=${r.toFixed(2)}: the page's claim holds`, false, JSON.stringify(claim));
      }
      if (!(g.claims.blueEqualsRed && g.claims.carpetEqualsHalves && g.claims.heightsMatch)) {
        bad++;
        check(`${name} at r=${r.toFixed(2)}: the core agrees`, false, JSON.stringify(g.claims));
      }
      if (g.measures.difference > g.tol) beyond++;
    }
  }
  check(`the page's claim holds on ${n} convex configurations (r = 0..1 by 0.01)`,
    n === 606 && bad === 0);
  check("the core's area difference stays inside its tolerance", beyond === 0);
}

{
  const rand = rng(1361);
  let tested = 0, failures = 0, mismatches = 0;
  for (let trial = 0; trial < 4000; trial++) {
    // Four angles in cyclic order on an ellipse give a convex quadrilateral
    // every time; the page's claim is only for convex quadrilaterals.
    const angles = [0, 1, 2, 3].map(() => rand() * Math.PI * 2).sort((x, y) => x - y);
    const q = angles.map((a) => P(200 + 180 * Math.cos(a), 150 + 130 * Math.sin(a)));
    if (!convex(...q)) continue;
    const r = rand();
    const claim = pageClaim(...q, r);
    if (!claim) { failures++; continue; }
    const g = C.compute(Object.assign(C.start(), {
      A: q[0], B: q[1], C: q[2], D: q[3], t: 1 - r,
    }));
    if (!g || g.noDraw) { failures++; continue; }
    tested++;
    if (!(claim.blueEqualsRed && claim.carpetEqualsHalves && claim.heightsMatch)) failures++;
    if (!(g.claims.blueEqualsRed && g.claims.carpetEqualsHalves && g.claims.heightsMatch)) mismatches++;
  }
  check(`the page's claim holds on ${tested} random convex quadrilaterals`,
    tested > 3000 && failures === 0, `tested ${tested}, failures ${failures}`);
  check(`the core agrees with the claim on all ${tested} random cases`, mismatches === 0);

  // The formulas are affine, so rescaling and translating must preserve them.
  const a = [tilted[0], tilted[1], tilted[2], tilted[3]].map((p) => P(2 * p.x + 17, 2 * p.y - 9));
  const claim = pageClaim(...a, 0.3);
  check("the claim survives a scale and a translation",
    !!claim && claim.blueEqualsRed && claim.carpetEqualsHalves && claim.heightsMatch);
}

/* ------------------ 4. the same points from the applet's own (bytecode) math */

{
  const rand = rng(7001);
  let compared = 0, mismatches = 0;
  const compare = (label, q, t) => {
    const [a, b, c, d] = q;
    const core = C.compute(Object.assign(C.start(), { A: a, B: b, C: c, D: d, t }));
    const ap = appletCompute(a, b, c, d, t);
    if (!core || core.noDraw !== ap.noDraw) {
      mismatches++;
      check(`${label}: core and applet agree on NoDraw`, false);
      return;
    }
    const tol = 1e-9 * scaleOf(a, b, c, d);
    if (!closePoint(core.P, ap.P, tol) || !closePoint(core.Q, ap.Q, tol)) {
      mismatches++;
      check(`${label}: core P and Q are the applet's CreateMidPoint`, false);
    }
    if (!ap.noDraw) {
      if (!closePoint(core.R, ap.R, tol) || !closePoint(core.S, ap.S, tol)) {
        mismatches++;
        check(`${label}: core R and S are the applet's Intersect`, false,
          `core R ${JSON.stringify(core.R)}, applet R ${JSON.stringify(ap.R)}`);
      }
      for (const key of ["Ap", "Bp", "Pp", "Cp", "Dp", "Qp"]) {
        if (!closePoint(core[key], ap.feet[key], tol)) {
          mismatches++;
          check(`${label}: core ${key} is the applet's NearestPoint`, false);
        }
      }
      for (const key of ["blue", "red", "carpet", "halves"]) {
        if (!close(core.measures[key], ap.areas[key], 1e-8 * scaleOf(a, b, c, d) ** 2)) {
          mismatches++;
          check(`${label}: core ${key} area is the applet's Fill area`, false);
        }
      }
    }
    compared++;
  };

  for (const [name, q] of fixed) for (const t of [0, 0.17, 0.7, 1]) compare(name, q, t);
  for (let trial = 0; trial < 1500; trial++) {
    const q = [0, 1, 2, 3].map(() => P(10 + rand() * 380, 10 + rand() * 280));
    compare(`random ${trial}`, q, rand());
  }
  check(`core and applet agree on ${compared} configurations`, compared > 1200 && mismatches === 0,
    `compared ${compared}, mismatches ${mismatches}`);
}

/* ------------------------------- 5. degenerate input is safe and honest */

{
  // With AB || CD and CD longer than AB by t = 1/2, AQ and DP come out
  // parallel, which trips the applet's |den| < 1 cutoff: NoDraw.
  const a = P(20, 220), b = P(140, 220), c = P(260, 60), d = P(380, 60);
  const ap = appletCompute(a, b, c, d, 0.5);
  const parallelState = Object.assign(C.start(), { A: a, B: b, C: c, D: d, t: 0.5 });
  const core = C.compute(parallelState);
  check("the applet's near-parallel cutoff is reproduced", ap.noDraw && core.noDraw);
  check("a NoDraw position has no carpet claim", !core.claims.blueEqualsRed);
  check("a NoDraw position has a helpful status", /do not meet clearly/.test(C.describe(parallelState)));

  const repeated = Object.assign(C.start(), { B: P(80, 180) });
  check("repeated corners do not throw", typeof C.describe(repeated) === "string");
  const nan = Object.assign(C.start(), { C: P(NaN, 60) });
  check("a non-finite corner gives no construction", C.compute(nan) === null);
  check("a non-finite corner still has a status", typeof C.describe(nan) === "string");
  check("an illustration still has no result when degenerate", C.result(nan) === null);

  // Outside the page's convex hypothesis the equality can fail. The core
  // reports that honestly instead of claiming the theorem for crossed shapes.
  const bowtie = [P(60, 60), P(340, 260), P(60, 260), P(340, 60)];
  const bow = C.compute(Object.assign(C.start(), {
    A: bowtie[0], B: bowtie[1], C: bowtie[2], D: bowtie[3], t: 0.7,
  }));
  check("a crossed quadrilateral is reported as not convex", !!bow && !bow.convex);
  check("status warns about a non-convex quadrilateral", /convex/.test(C.describe(bow)));
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("carpets-in-quadri");
