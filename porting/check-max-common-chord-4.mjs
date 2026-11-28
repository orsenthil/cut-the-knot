#!/usr/bin/env node
"use strict";

/*
 * Logic test for max-common-chord-4/max-common-chord-4-core.js.
 *
 *   node porting/check-max-common-chord-4.mjs
 *
 * The second half of this file is a second, literal transcription of the
 * applet's own Compute() and its helpers (GeoSDoub.FindCircumcenter,
 * Intersect(Circle,Circle), Intersect(Line,Circle), Intersect(Point x 4),
 * CTKGeometryPlus.Prorate, Other). It is deliberately written in the order
 * and with the branch conditions of the bytecode, not in the cleaner form the
 * port uses. Both are run over thousands of configurations of the four
 * draggable points. The page's angle claims are checked on the same sweep:
 * its concyclicity and isosceles-triangle claims hold throughout, while its
 * unqualified half-angle and equal-angle statements only hold on the arc the
 * page draws — the test records both cases explicitly.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("max-common-chord-4/max-common-chord-4-core.js", "MaxCommonChord4Core");
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const nearPt = (a, b, eps = 1e-5) => !!a && !!b && near(a.x, b.x, eps) && near(a.y, b.y, eps);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the applet's starting P", s.P, { x: 200, y: 180 });
  equal("the applet's starting Q", s.Q, { x: 200, y: 240 });
  equal("the applet's starting A", s.A, { x: 120, y: 210 });
  equal("the applet's starting B", s.B, { x: 340, y: 180 });
  check("all four show-options start off", C.OPTIONS.every((k) => !s.show[k]));
  check("the default picture can be drawn", C.ready(s) && C.compute(s).valid);
  check("an illustration has no win or loss", C.result(s) === null);
  equal("the four draggable points", C.legalMoves(s), ["P", "Q", "A", "B"]);

  const small = C.start({ width: 200, height: 100 });
  equal("init's P for another canvas", small.P, { x: 100, y: 60 });
  equal("init's Q for another canvas", small.Q, { x: 100, y: 80 });
  equal("init's A for another canvas", small.A, { x: 60, y: 70 });
  equal("init's B for another canvas", small.B, { x: 170, y: 60 });

  const moved = C.movePoint(s, "P", { x: 90, y: 100 });
  check("movePoint keeps the old position untouched", s.P.x === 200 && moved.P.x === 90);
  check("movePoint clamps to the board", C.movePoint(s, "Q", { x: 900, y: -5 }).Q.x === 400 &&
    C.movePoint(s, "Q", { x: 900, y: -5 }).Q.y === 0);
  equal("an unknown point cannot be moved", C.movePoint(s, "Z", { x: 1, y: 2 }), s);
  check("an option toggles on", C.setOption(s, "hint", true).show.hint === true);
  check("setting an option leaves the other options alone",
    C.setOption(s, "hint", true).show.names === false);
  check("settings are saved with the position", C.position(C.setOption(s, "names", true)).show.names === true);

  /* Compute()'s guard: every centre/P/Q gap and PQ must be at least two. */
  const edge = C.movePoint(s, "Q", { x: 200, y: 178 }); // PQ = 2 exactly
  check("PQ = 2 is allowed", C.ready(edge));
  const tooClose = C.movePoint(s, "Q", { x: 200, y: 178.5 }); // PQ < 2
  check("PQ < 2 stops the redraw", !C.ready(tooClose) && !C.compute(tooClose).valid);
  const closeA = C.movePoint(s, "A", { x: 200, y: 180 }); // A = P
  check("A on P stops the redraw", !C.ready(closeA));
  const closeB = C.movePoint(s, "B", { x: 200, y: 240 }); // B = Q
  check("B on Q stops the redraw", !C.ready(closeB));
  check("the status explains a refused picture", /at least 2 units/.test(C.describe(C.compute(closeA))));
}

/* ------------------------------------------------- 2. the default picture */

const DEFAULT = C.compute(C.start({}));
{
  const f = DEFAULT;
  check("the default figure is complete", f.valid && f.complete);
  check("E is the circumcentre of A, P, Q", nearPt(f.E, { x: 165.625, y: 210 }));
  check("F is the circumcentre of B, P, Q", nearPt(f.F, { x: 270, y: 210 }));
  check("G is the antipode of P in C(E)", nearPt(f.G, { x: 131.25, y: 240 }));
  check("H is the antipode of P in C(F)", nearPt(f.H, { x: 340, y: 240 }));
  check("the apex angles are equal", near(C.claims(f).apexE, C.claims(f).apexF));
  check("the page's equal angles at Q hold in the drawn arrangement",
    near(C.claims(f).lqp, C.claims(f).mqp) && C.claims(f).qMajorLP);
  check("the default status names both statements",
    /lie on one circle/.test(C.describe(f)) && /½∠LEP/.test(C.describe(f)));
}

/* --------------------------------- 3. literal transcription of the bytecode */

/* GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint). */
function jLineCrossing(p1, p2, p3, p4) {
  const a = p1.y - p2.y, b = p2.x - p1.x, c = p1.x * p2.y - p1.y * p2.x;
  const d = p3.y - p4.y, e = p4.x - p3.x, f = p3.x * p4.y - p3.y * p4.x;
  const det = a * e - d * b;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN }; // applet: |det| < 1 -> NaN
  return { x: (b * f - e * c) / det, y: (c * d - f * a) / det };
}

/* GeoSDoub.FindCircumcenter: two midpoints and their perpendiculars. */
function jCircumcenter(a, b, c) {
  const o1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const o2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const v1 = { x: o1.x + (b.y - a.y), y: o1.y - (b.x - a.x) };
  const v2 = { x: o2.x + (c.y - b.y), y: o2.y - (c.x - b.x) };
  return jLineCrossing(o1, v1, o2, v2);
}

/* MaxCommonChord4Canvas.GetCircle: centre plus mean of the three distances. */
function jCircle(a, b, c) {
  const o = jCircumcenter(a, b, c);
  o.r = (dist(o, a) + dist(o, b) + dist(o, c)) / 3;
  return o;
}

/* GeoSDoub.IntersectCirclesX / Y, transcribed in bytecode order. */
function jCircleCrossingsX(c0, c1) {
  const k = -(c0.y - c1.y) / (c0.x - c1.x);
  const b = (c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y -
    c0.r * c0.r + c1.r * c1.r) / (2 * (c0.x - c1.x));
  const q = b - c0.x, A = k * k + 1;
  const B = k * q - c0.y;
  const D = B * B - A * (q * q + c0.y * c0.y - c0.r * c0.r);
  if (D < 0) return null;
  const s = Math.sqrt(D), t0 = (-B + s) / A, t1 = (-B - s) / A;
  return [{ x: k * t0 + b, y: t0 }, { x: k * t1 + b, y: t1 }];
}
function jCircleCrossingsY(c0, c1) {
  const k = -(c0.x - c1.x) / (c0.y - c1.y);
  const b = (c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x -
    c0.r * c0.r + c1.r * c1.r) / (2 * (c0.y - c1.y));
  const q = b - c0.y, A = k * k + 1;
  const B = k * q - c0.x;
  const D = B * B - A * (q * q + c0.x * c0.x - c0.r * c0.r);
  if (D < 0) return null;
  const s = Math.sqrt(D), t0 = (-B + s) / A, t1 = (-B - s) / A;
  return [{ x: t0, y: k * t0 + b }, { x: t1, y: k * t1 + b }];
}
function jCircleCrossings(c0, c1) {
  if (Math.abs(c0.x - c1.x) > 1) return jCircleCrossingsX(c0, c1);
  if (Math.abs(c0.y - c1.y) > 1) return jCircleCrossingsY(c0, c1);
  const p = { x: c0.x, y: c0.y };
  return [p, p]; // the applet's own fallback for (nearly) equal centres
}

/* GeoSDoub.IntersectX/Y(DoubLine, DoubCircle). */
function jLineCrossingsX(line, c) {
  const k = (line.p.x - line.q.x) / (line.p.y - line.q.y);
  const b = line.q.x - k * line.q.y, A = k * k + 1;
  const B = k * (b - c.x) - c.y;
  const D = B * B - A * (c.y * c.y + (b - c.x) * (b - c.x) - c.r * c.r);
  if (D < 0) return null;
  const s = Math.sqrt(D), t0 = (-B + s) / A, t1 = (-B - s) / A;
  return [{ x: k * t0 + b, y: t0 }, { x: k * t1 + b, y: t1 }];
}
function jLineCrossingsY(line, c) {
  const k = (line.p.y - line.q.y) / (line.p.x - line.q.x);
  const b = line.q.y - k * line.q.x, A = k * k + 1;
  const B = k * (b - c.y) - c.x;
  const D = B * B - A * (c.x * c.x + (b - c.y) * (b - c.y) - c.r * c.r);
  if (D < 0) return null;
  const s = Math.sqrt(D), t0 = (-B + s) / A, t1 = (-B - s) / A;
  return [{ x: t0, y: k * t0 + b }, { x: t1, y: k * t1 + b }];
}
function jLineCircleCrossings(line, c) {
  if (Math.abs(line.p.y - line.q.y) > 1) return jLineCrossingsX(line, c);
  if (Math.abs(line.p.x - line.q.x) > 1) return jLineCrossingsY(line, c);
  return null;
}

/* Other(pair, q) and CTKGeometryPlus.Prorate. */
function jOther(pair, q) { return dist(pair[0], q) >= 1 ? pair[0] : pair[1]; }
function jProrate(p, c, length) {
  const d = dist(p, c);
  if (d < 0.1) return { x: p.x, y: p.y };
  return { x: p.x + (length / d) * (c.x - p.x), y: p.y + (length / d) * (c.y - p.y) };
}

/* Compute(), with its guard and assignment order. */
function jCompute(A, P, Q, B) {
  if (dist(A, P) < 2 || dist(A, Q) < 2 || dist(B, P) < 2 ||
      dist(B, Q) < 2 || dist(P, Q) < 2) return { valid: false };
  const E = jCircle(A, P, Q), F = jCircle(B, P, Q);
  const O = jCircle(E, Q, F), ABQ = jCircle(A, B, Q);
  const rp = jLineCircleCrossings({ p: P, q: Q }, ABQ);
  const lp = jCircleCrossings(O, E), mp = jCircleCrossings(O, F);
  /* The applet would throw on a null pair; these are the configurations the
     sweep skips, because there is no picture there to compare. */
  if (!rp || !lp || !mp) return { valid: false };
  const R = jOther(rp, Q);
  if (dist(P, R) < 1) return { valid: false };
  const L = jOther(lp, Q), M = jOther(mp, Q);
  const S = jLineCrossing(A, L, B, M);
  return { valid: true, E: E, F: F, O: O, ABQ: ABQ, L: L, M: M, R: R, S: S,
    G: jProrate(P, E, 2 * E.r), H: jProrate(P, F, 2 * F.r) };
}

/* ------------------------------------ 4. the two transcriptions, side by side */

const R = rng(20260728);
const configs = [C.start({})];
for (let i = 0; i < 400; i++) {
  const pt = () => ({ x: 8 + R() * 384, y: 8 + R() * 284 });
  configs.push({ P: pt(), Q: pt(), A: pt(), B: pt() });
}
/* A regular grid as well, so the sweep is not only random. */
for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
  configs.push({
    P: { x: 150 + a * 30, y: 150 + b * 20 },
    Q: { x: 210 + a * 15, y: 220 + b * 15 },
    A: { x: 80 + a * 40, y: 130 + b * 30 },
    B: { x: 320 - a * 20, y: 190 + b * 25 },
  });
}

{
  let compared = 0, skipped = 0;
  const wrong = { E: 0, F: 0, O: 0, ABQ: 0, L: 0, M: 0, R: 0, S: 0, G: 0, H: 0 };
  const stateOf = (cfg) => ({
    width: 400, height: 300, P: cfg.P, Q: cfg.Q, A: cfg.A, B: cfg.B,
    show: { statement1: false, statement2: false, hint: false, names: false },
  });
  configs.forEach((cfg) => {
    const mine = C.compute(stateOf(cfg));
    const java = jCompute(cfg.A, cfg.P, cfg.Q, cfg.B);
    if (!mine.valid || !java.valid || !Number.isFinite(java.L.x) || !Number.isFinite(java.M.x) ||
        !java.S || !Number.isFinite(java.S.x) || !java.R || !Number.isFinite(java.R.x)) {
      skipped++;
      return;
    }
    compared++;
    Object.keys(wrong).forEach((key) => {
      if (!nearPt(mine[key], java[key], 1e-4)) wrong[key]++;
    });
  });
  check("both transcriptions were compared on hundreds of pictures", compared > 300, `${compared} compared, ${skipped} skipped`);
  Object.keys(wrong).forEach((key) => {
    check(`the port's ${key} matches the bytecode's ${key}`, wrong[key] === 0, `${wrong[key]} mismatches`);
  });
}

/* ----------------------------------------------- 5. the page's claims, swept */

{
  let tested = 0, majorE = 0, minorE = 0, majorM = 0, minorM = 0;
  let badApex = 0, badBase = 0, badLineM = 0, badLineL = 0, badCyclic = 0;
  let badHalfF = 0, badHalfE = 0, badEqualQ = 0, badLQM = 0, badG = 0, badH = 0;
  configs.forEach((cfg) => {
    const state = { width: 400, height: 300, P: cfg.P, Q: cfg.Q, A: cfg.A, B: cfg.B,
      show: { statement1: false, statement2: false, hint: false, names: false } };
    const f = C.compute(state), c = C.claims(f);
    if (!c || !f.complete) return;
    tested++;
    if (!near(c.apexE, c.apexF, 1e-5)) badApex++;
    if (!near(c.baseE, c.baseF, 1e-5)) badBase++;
    if (c.offEM > 1e-5) badLineM++;                    // E, P, M collinear
    if (c.offFL > 1e-5) badLineL++;                    // F, P, L collinear
    if (Math.max(c.offLM_E, c.offM, c.offQ) > 1e-5) badCyclic++;
    if (!near(dist(f.P, f.G), 2 * f.E.r, 1e-5) || !near(dist(f.E, f.G), f.E.r, 1e-5)) badG++;
    if (!near(dist(f.P, f.H), 2 * f.F.r, 1e-5) || !near(dist(f.F, f.H), f.F.r, 1e-5)) badH++;
    if (!near(c.mqp, c.halfF, 1e-5)) badHalfF++;
    if (!near(c.lqp, c.halfE, 1e-5)) badHalfE++;
    if (!near(c.lqp, c.mqp, 1e-5) && !near(c.lqp + c.mqp, 180, 1e-5)) badEqualQ++;
    const wantLQM = c.qWithEonLM ? c.lem : 180 - c.lem;
    if (!near(c.lqm, wantLQM, 1e-5)) badLQM++;
    if (c.qMajorLP) majorE++; else minorE++;
    if (c.qMajorMP) majorM++; else minorM++;
  });
  check("the sweep tested hundreds of non-degenerate pictures", tested > 300, `${tested} tested`);
  check("∠LEP = ∠MFP in every picture", badApex === 0, `${badApex} failures`);
  check("the isosceles base angles EPL and FPM agree", badBase === 0, `${badBase} failures`);
  check("M always lies on line EP", badLineM === 0, `${badLineM} failures`);
  check("L always lies on line FP", badLineL === 0, `${badLineL} failures`);
  check("E, F, L, M, Q are concyclic in every picture", badCyclic === 0, `${badCyclic} failures`);
  check("G is always the antipode of P in C(E)", badG === 0, `${badG} failures`);
  check("H is always the antipode of P in C(F)", badH === 0, `${badH} failures`);
  check("∠MQP = ½∠MFP in every picture", badHalfF === 0, `${badHalfF} failures`);
  check("the page's ∠LQP = ½∠LEP holds when Q is on the large arc LP", badHalfE === 0,
    `${badHalfE} failures outside the arc cases`);
  check("∠LQP and ∠MQP are equal or supplementary", badEqualQ === 0, `${badEqualQ} failures`);
  check("∠LQM = ∠LEM when Q and E share the arc LM, otherwise supplementary", badLQM === 0,
    `${badLQM} failures`);
  check("the sweep contains pictures on both arcs LP", majorE > 0 && minorE > 0,
    `${majorE} large-arc, ${minorE} small-arc`);
  check("the sweep contains pictures on both arcs MP", majorM > 0 && minorM > 0,
    `${majorM} large-arc, ${minorM} small-arc`);
}

/* --------------------------- 6. one counterexample to the unqualified claim */

{
  /* P ≈ (11,195), Q ≈ (363,266), A ≈ (381,256), B ≈ (130,14) puts Q on the
     small arc LP: the page's ½∠LEP must be read as its supplement here. */
  const cfg = {
    P: { x: 11.005, y: 194.868 }, Q: { x: 362.674, y: 266.012 },
    A: { x: 381.391, y: 255.615 }, B: { x: 130.089, y: 13.565 },
  };
  const f = C.compute({ width: 400, height: 300, P: cfg.P, Q: cfg.Q, A: cfg.A, B: cfg.B,
    show: { statement1: false, statement2: false, hint: false, names: false } });
  const c = C.claims(f);
  check("the counterexample is drawn", !!c && !c.qMajorLP);
  check("in it ∠LQP is 180° minus half the apex angle", near(c.lqp, 180 - c.apexE / 2, 1e-5));
  check("in it the isosceles apex angles still agree", near(c.apexE, c.apexF, 1e-5));
  check("in it E, F, L, M, Q are still concyclic", Math.max(c.offLM_E, c.offM, c.offQ) < 1e-5);
  check("the status tells the player which arc case this is",
    /small arc LP/.test(C.describe(f)));
}

done("max-common-chord-4");
