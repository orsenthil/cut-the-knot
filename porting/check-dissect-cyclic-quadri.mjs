#!/usr/bin/env node
"use strict";

/*
 * Logic test for dissect-cyclic-quadri/dissect-cyclic-quadri-core.js.
 *
 *   node porting/check-dissect-cyclic-quadri.mjs
 *
 * Checks (1) the applet's starting construction, its reversed DoubLine
 * parameter and its option states; (2) the cut-the-knot article's claims over
 * thousands of random cyclic quadrilaterals and points P: the perpendicular
 * feet from P to the side lines make all four listed quadrilaterals cyclic,
 * the two angle identities hold, and fixing N determines M, R and Q while
 * DNPQ comes out cyclic automatically; and (3) a second, independent
 * transcription of DissectCyclicQuadriCanvas.Compute (Quad.CheckForCyclicity,
 * GeoSDoub.FindCircumcenter/Intersect, the 1px and 3px tolerances and the
 * relaxed 3-of-4 pass) compared with the core over 1,200 random configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("dissect-cyclic-quadri/dissect-cyclic-quadri-core.js", "DissectCyclicQuadriCore");

const p = (x, y) => ({ x, y });
const sub = (a, b) => p(a.x - b.x, a.y - b.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const mix = (a, b, t) => p(a.x * t + b.x * (1 - t), a.y * t + b.y * (1 - t));

/* ---------------------------- 1. the start position and the rules of the UI */

{
  const s = C.start({});
  equal("the guide circle is the applet's min(W,H)/2.7 circle", C.GUIDE,
    { c: p(200, 165), r: 300 / 2.7 });
  equal("A is on the guide circle at pi/8", s.A,
    p(200 + (300 / 2.7) * Math.cos(Math.PI / 8), 165 + (300 / 2.7) * Math.sin(Math.PI / 8)));
  equal("B is at pi/2", s.B, p(200, 165 + 300 / 2.7));
  equal("C is at 0.89*pi", s.C,
    p(200 + (300 / 2.7) * Math.cos(2.792526803190927), 165 + (300 / 2.7) * Math.sin(2.792526803190927)));
  equal("D is at 1.6*pi", s.D,
    p(200 + (300 / 2.7) * Math.cos(5.026548245743669), 165 + (300 / 2.7) * Math.sin(5.026548245743669)));
  equal("P is the centroid of the four corners", s.P,
    p((s.A.x + s.B.x + s.C.x + s.D.x) / 4, (s.A.y + s.B.y + s.C.y + s.D.y) / 4));
  equal("DoubLine's parameter is reversed: R = A*0.45 + B*0.55", s.R, mix(s.A, s.B, 0.45));
  equal("M = B*0.6 + C*0.4", s.M, mix(s.B, s.C, 0.6));
  equal("N = C*0.3 + D*0.7", s.N, mix(s.C, s.D, 0.3));
  equal("Q = A*0.5 + D*0.5", s.Q, mix(s.A, s.D, 0.5));
  check("the three Show boxes start unchecked",
    !s.options.names && !s.options.helper && !s.options.hint);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("the default picture has fewer than four cyclic pieces", C.computeQuads(s).count < 4);
  check("Hint is not enabled at the start", !C.computeQuads(s).hintEnabled);
  check("all nine points can be moved", C.legalMoves(s).length === 9);
}

{
  const s = C.start({ names: true });
  check("unknown and non-finite moves are ignored",
    C.move(s, "Z", p(1, 2)) === s && C.move(s, "A", p(NaN, 4)) === s);
  const moved = C.move(s, "P", p(1000, -1000));
  equal("P is clamped to the visible board", moved.P, p(388, 12));
  check("a move marks the position explored", moved.explored && !s.explored);
  const corner = C.move(s, "B", p(200, 10));
  check("a corner stays on the guide circle",
    close(d(corner.B, C.GUIDE.c), C.GUIDE.r, 1e-9));
  check("moving B rebuilds R and M from the stored parameters",
    d(corner.R, mix(corner.A, corner.B, s.coef.R)) < 1e-9
    && d(corner.M, mix(corner.B, corner.C, s.coef.M)) < 1e-9);
  check("moving B leaves P where it was", d(corner.P, s.P) === 0);
  const cut = C.move(s, "M", p(500, 500));
  check("a cut point is clamped to its side and the parameter is updated",
    cut.coef.M === 1 && d(cut.M, s.B) < 1e-9);
  check("moving a cut point does not disturb its neighbours",
    d(cut.R, s.R) === 0 && d(cut.N, s.N) === 0 && d(cut.Q, s.Q) === 0);
  const plain = C.start();
  check("options change independently",
    C.setOption(C.setOption(plain, "helper", true), "names", true).options.helper
    && !C.setOption(plain, "helper", true).options.names);
  check("an unknown option is ignored", C.setOption(plain, "nope", true) === plain);
  const r = C.reset(s);
  check("Reset restores the picture but keeps the Show boxes",
    d(r.A, s.A) === 0 && d(r.P, s.P) === 0 && r.options.names && !r.explored);
}

/* --------------------------- 2. the page's mathematical claims, in bulk */

/* Ordinary circumcircle, independent of the core and of the applet's mean
 * radius shortcut, for measuring the article's statements. */
function mathCircle(a, b, c) {
  const m1 = p((a.x + b.x) / 2, (a.y + b.y) / 2);
  const m2 = p((b.x + c.x) / 2, (b.y + c.y) / 2);
  const r1 = p(b.x - a.x, b.y - a.y), r2 = p(c.x - b.x, c.y - b.y);
  const n1 = p(-r1.y, r1.x), n2 = p(-r2.y, r2.x);
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const den = cross(n1, n2);
  if (!den) return null;
  const t = cross(sub(m2, m1), n2) / den;
  const o = p(m1.x + n1.x * t, m1.y + n1.y * t);
  return { c: o, r: d(o, a) };
}
const onCircle = (q, cc) => (cc ? Math.abs(d(q, cc.c) - cc.r) : Infinity);

function cyclicQuad(center, radius, angles) {
  return angles.map((t) => p(center.x + radius * Math.cos(t), center.y + radius * Math.sin(t)));
}

const rnd = rng(20261127);
let feetCases = 0, feetFail = 0, feetMax = 0;
let angleCases = 0, angleFail = 0;
let solveCases = 0, solveFail = 0, solveMax = 0;
let interiorCases = 0, interiorFail = 0;

for (let n = 0; n < 320; n++) {
  const angles = [0, 1, 2, 3].map(() => rnd() * 2 * Math.PI).sort((a, b) => a - b);
  if (angles.some((t, i) => i && t - angles[i - 1] < 0.12)) continue;
  const radius = 20 + rnd() * 130;
  const center = p(200 + (rnd() * 2 - 1) * 80, 150 + (rnd() * 2 - 1) * 60);
  const [A, B, Cc, D] = cyclicQuad(center, radius, angles);
  for (let k = 0; k < 8; k++) {
    const Ppt = p(center.x + (rnd() * 2 - 1) * 3 * radius,
      center.y + (rnd() * 2 - 1) * 3 * radius);
    const base = Object.assign(C.start(), { A, B, C: Cc, D, P: Ppt });
    const f = C.feet(base);
    const quads = [
      [f.R, B, f.M, Ppt], [f.N, Cc, f.M, Ppt],
      [f.N, D, f.Q, Ppt], [f.Q, A, f.R, Ppt],
    ];
    for (const [u, v, w, x] of quads) {
      const cc = mathCircle(u, x, w);
      const err = onCircle(v, cc) / radius;
      feetCases++;
      feetMax = Math.max(feetMax, err);
      if (err > 1e-7 || !cc) feetFail++;
    }

    // The page's two angle identities for the feet construction.
    const a = C.angle;
    const s1 = a(f.N, Cc, Ppt) + a(f.M, Cc, Ppt);
    const s2 = a(f.M, B, Ppt) + a(f.R, B, Ppt);
    angleCases++;
    if (!close(s1, Math.PI, 1e-7) || !close(s2, Math.PI, 1e-7)) angleFail++;

    // Fix N, then M, R and Q are unique; DNPQ is cyclic automatically.
    const tn = 0.02 + rnd() * 0.96;
    const N = mix(Cc, D, tn);
    const built = C.solveFromN(Object.assign({}, base, { N }));
    const cc2 = mathCircle(D, N, Ppt);
    const err2 = onCircle(built.Q, cc2) / radius;
    solveCases++;
    solveMax = Math.max(solveMax, err2);
    if (err2 > 1e-4 || !cc2) solveFail++;
  }

  // For the applet's own starting P the feet lie inside the four sides.
  const startP = C.start();
  const f0 = C.feet(startP);
  const coefs = [
    C.coefFor(f0.R, startP.A, startP.B, false),
    C.coefFor(f0.M, startP.B, startP.C, false),
    C.coefFor(f0.N, startP.C, startP.D, false),
    C.coefFor(f0.Q, startP.A, startP.D, false),
  ];
  interiorCases++;
  if (!coefs.every((t) => t > 0 && t < 1)) interiorFail++;
}

check(`the feet make all four pieces cyclic (${feetCases} configurations)`,
  feetCases >= 5000 && feetFail === 0, `${feetFail} failures, worst ${feetMax.toExponential(2)}`);
check("the applet's strict 1px test also accepts the feet on a 400x300 board",
  (() => {
    const s = C.useFeet(C.start());
    return C.computeQuads(s).strictCount === 4 && C.computeQuads(s).count === 4;
  })());
check(`the page's two angle sums are 180 degrees (${angleCases} configurations)`,
  angleCases >= 2000 && angleFail === 0, `${angleFail} failures`);
check(`fixing N determines M,R,Q and DNPQ is cyclic (${solveCases} configurations)`,
  solveCases >= 2000 && solveFail === 0, `${solveFail} failures, worst ${solveMax.toExponential(2)}`);
check("the three angle identities ARP = BMP = CNP hold", (() => {
  const s = C.useFeet(C.start()), a = C.angle;
  return close(a(s.R, s.A, s.P), a(s.M, s.B, s.P), 1e-9)
    && close(a(s.M, s.B, s.P), a(s.N, s.C, s.P), 1e-9);
})());
check("the start picture's perpendicular feet lie inside all four sides",
  interiorCases > 200 && interiorFail === 0);
check("Hint becomes available exactly when all four pieces are cyclic", (() => {
  const s = C.useFeet(C.start());
  const g = C.computeQuads(s);
  return g.hintEnabled && !!C.setOption(s, "hint", true).options.hint
    && !C.setOption(C.start(), "hint", true).options.hint;
})());
check("the strict and relaxed applet tolerances differ as the bytecode says", (() => {
  const s = C.start();
  return C.quadCircle(s.R, s.B, s.M, s.P, C.STRICT) === null
    && C.quadCircle(s.R, s.B, s.M, s.P, C.RELAXED) !== null;
})());
check("the status says what the four pieces are doing",
  /All four/.test(C.describe(C.useFeet(C.start())))
  && /0 of the four/.test(C.describe(C.start())));

/* ------------------ 3. the applet's method, transcribed a second time */

/* DissectCyclicQuadriCanvas.init and DoubLine.CreateMidPoint. */
function appletStart() {
  const W = 400, H = 300;
  const c = p(W / 2, (H * 11) / 20);
  const r = Math.min(W, H) / 2.7;
  const fromCircle = (t) => p(c.x + r * Math.cos(t), c.y + r * Math.sin(t));
  const A = fromCircle(0.39269908169872414), B = fromCircle(1.5707963267948966);
  const Cc = fromCircle(2.792526803190927), D = fromCircle(5.026548245743669);
  const Ppt = p((A.x + B.x + Cc.x + D.x) / 4, (A.y + B.y + Cc.y + D.y) / 4);
  const CreateMidPoint = (u, v, t) => p(u.x * t + v.x * (1 - t), u.y * t + v.y * (1 - t));
  return {
    A: A, B: B, C: Cc, D: D, P: Ppt,
    R: CreateMidPoint(A, B, 0.45), M: CreateMidPoint(B, Cc, 0.6),
    N: CreateMidPoint(Cc, D, 0.3), Q: CreateMidPoint(A, D, 0.5),
  };
}

/* GeoSDoub.Intersect: ax+by+c=0 lines, |det| < 1 gives NaN coordinates. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return p(NaN, NaN);
  return p((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* GeoSDoub.FindCircumcenter and Quad.GetCircle's mean radius. */
function appletCircle(a, b, c) {
  const m1 = p((a.x + b.x) / 2, (a.y + b.y) / 2);
  const m2 = p((b.x + c.x) / 2, (b.y + c.y) / 2);
  const o = appletIntersect(
    m1, p(m1.x + (b.y - a.y), m1.y - (b.x - a.x)),
    m2, p(m2.x + (c.y - b.y), m2.y - (c.x - b.x)),
  );
  return { c: o, r: (d(o, a) + d(o, b) + d(o, c)) / 3 };
}

/* DissectCyclicQuadriCanvas$Quad.CheckForCyclicity(tol). */
function appletCheck(u, v, w, x, tol) {
  if (d(u, v) < 1) return null;
  if (d(v, w) < 1) return null;
  const cc = appletCircle(u, x, w);
  if (!Number.isFinite(cc.c.x) || !Number.isFinite(cc.c.y)) return null;
  const gap = Math.abs(d(v, cc.c) - cc.r);
  return gap < tol ? cc : null;
}

/* DissectCyclicQuadriCanvas.Compute(). */
function appletCompute(s) {
  const quads = [
    [s.R, s.B, s.M], [s.N, s.C, s.M], [s.N, s.D, s.Q], [s.Q, s.A, s.R],
  ];
  const first = quads.map(([u, v, w]) => appletCheck(u, v, w, s.P, 1));
  const strictCount = first.filter((q) => q).length;
  const circles = strictCount === 3
    ? quads.map(([u, v, w]) => appletCheck(u, v, w, s.P, 3)) : first;
  return { strictCount: strictCount, count: circles.filter((q) => q).length, circles: circles };
}

{
  const a = appletStart(), s = C.start();
  check("the second transcription gives the same start as the core",
    ["A", "B", "C", "D", "P", "R", "M", "N", "Q"].every((k) => d(a[k], s[k]) < 1e-12));
  const ac = appletCompute(a), sc = C.computeQuads(s);
  check("the second transcription agrees on the start's cyclic count",
    ac.strictCount === sc.strictCount && ac.count === sc.count);

  const r2 = rng(77123);
  let compared = 0, pointFail = 0, countFail = 0, circleFail = 0;
  for (let k = 0; k < 1200; k++) {
    const angles = [0, 1, 2, 3].map(() => r2() * 2 * Math.PI).sort((x, y) => x - y);
    const ctr = p(200, 165), rr = 111.11111111111111;
    const A = p(ctr.x + rr * Math.cos(angles[0]), ctr.y + rr * Math.sin(angles[0]));
    const B = p(ctr.x + rr * Math.cos(angles[1]), ctr.y + rr * Math.sin(angles[1]));
    const Cc = p(ctr.x + rr * Math.cos(angles[2]), ctr.y + rr * Math.sin(angles[2]));
    const D = p(ctr.x + rr * Math.cos(angles[3]), ctr.y + rr * Math.sin(angles[3]));
    const Ppt = p(10 + r2() * 380, 10 + r2() * 280);
    const coef = { R: r2(), M: r2(), N: r2(), Q: r2() };
    const aState = Object.assign(appletStart(), {
      A: A, B: B, C: Cc, D: D, P: Ppt,
      R: mix(A, B, coef.R), M: mix(B, Cc, coef.M),
      N: mix(Cc, D, coef.N), Q: mix(A, D, coef.Q),
    });
    const cState = Object.assign(C.start(), aState, { coef: coef });
    const ap = appletCompute(aState), cp = C.computeQuads(cState);
    compared++;
    if (ap.strictCount !== cp.strictCount || ap.count !== cp.count) countFail++;
    for (let i = 0; i < 4; i++) {
      const aci = ap.circles[i], cci = cp.quads[i].circle;
      if (!!aci !== !!cci) { circleFail++; continue; }
      if (aci && (Math.abs(aci.c.x - cci.c.x) > 1e-7
        || Math.abs(aci.c.y - cci.c.y) > 1e-7 || Math.abs(aci.r - cci.r) > 1e-7)) circleFail++;
    }
    // Every reachable cut point must be the DoubLine.CreateMidPoint value.
    for (const [k, u, v, t] of [["R", A, B, coef.R], ["M", B, Cc, coef.M],
      ["N", Cc, D, coef.N], ["Q", A, D, coef.Q]]) {
      if (d(cState[k], mix(u, v, t)) > 1e-12) pointFail++;
    }
  }
  check(`${compared} random configurations: the two transcriptions agree on every point`,
    pointFail === 0, `${pointFail} mismatches`);
  check(`${compared} random configurations: strict and relaxed counts agree`,
    countFail === 0, `${countFail} mismatches`);
  check(`${compared} random configurations: the four circle results agree`,
    circleFail === 0, `${circleFail} mismatches`);
}

done("dissect-cyclic-quadri");
