#!/usr/bin/env node
"use strict";

/*
 * Logic test for hjelmslev-theorem/hjelmslev-theorem-core.js.
 *
 *   node porting/check-hjelmslev-theorem.mjs
 *
 * The applet's own arithmetic is transcribed a second time, straight from
 * HjelmslevTheoremCanvas.init/Draw/UpdatePoint/CheckAndUpdate/FixOnCircle, and
 * compared with the core over the whole slider range and thousands of random
 * four-point configurations. The page's claims are then measured on all of
 * them: the eleven marks are collinear or coincide for every s, not just for
 * the isometric and midpoint cases.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hjelmslev-theorem/hjelmslev-theorem-core.js", "HjelmslevTheoremCore");
const rand = rng(20261127);
const randomPoint = (lo = -400, hi = 900) => ({ x: lo + rand() * (hi - lo), y: lo + rand() * (hi - lo) });
const near = (a, b, tol = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const ptNear = (p, q, tol = 1e-7) => near(p.x, q.x, tol) && near(p.y, q.y, tol);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/* ------------------------------------------- the applet, transcribed again */

// init(): private constants of HjelmslevTheoremCanvas.
const APPLET_PHI = 2.0943951023931953;
const APPLET_TURN = 1.3463968515384828;

function appletStart(width, height) {
  const cx = width / 2, cy = height / 2 - 20;
  const len = Math.min(width, height) / 3;
  const phi = APPLET_PHI;
  const A1 = { x: cx, y: cy };
  const B1 = { x: cx + len * Math.cos(phi), y: cy + len * Math.sin(phi) };
  const phi2 = phi + APPLET_TURN;
  const dx = (len / 2) * Math.cos(phi2), dy = (len / 2) * Math.sin(phi2);
  return { A1, B1, A2: { x: A1.x + dx, y: A1.y + dy }, B2: { x: B1.x + dx, y: B1.y + dy } };
}

// Average(a, b) from the bytecode, with the field S set to s.
const appletAverage = (a, b, s) => s * a + (1 - s) * b;
const appletMidpoint = (p, q, s) => ({
  x: appletAverage(p.x, q.x, s), y: appletAverage(p.y, q.y, s),
});

// InnerPoint(A, B, i, n) from the bytecode.
function appletInnerPoint(a, b, i, n) {
  return {
    x: a.x + (b.x - a.x) * i / n,
    y: a.y + (b.y - a.y) * i / n,
  };
}

// Draw(): array[i] = Midpoint(InnerPoint(A1,B1,i,n), InnerPoint(A2,B2,i,n)).
function appletDraw(st, s, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    out.push(appletMidpoint(
      appletInnerPoint(st.A1, st.B1, i, n),
      appletInnerPoint(st.A2, st.B2, i, n), s));
  }
  return out;
}

// UpdatePoint(p1,p2,p3,p4) mutates p4 in the Java; here it returns a copy.
function appletUpdatePoint(p1, p2, p3, p4) {
  const s1 = dist(p1, p2), s2 = dist(p3, p4);
  if (Math.abs(s2) < 0.1) return { x: p4.x, y: p4.y };
  return {
    x: p3.x + (p4.x - p3.x) * s1 / s2,
    y: p3.y + (p4.y - p3.y) * s1 / s2,
  };
}

// CheckAndUpdate() chooses the four arguments from the selected endpoint.
function appletCheckAndUpdate(st, selected) {
  const out = { A1: { ...st.A1 }, B1: { ...st.B1 }, A2: { ...st.A2 }, B2: { ...st.B2 } };
  if (selected === "A1") out.A2 = appletUpdatePoint(out.B1, out.A1, out.B2, out.A2);
  else if (selected === "B1") out.B2 = appletUpdatePoint(out.A1, out.B1, out.A2, out.B2);
  else if (selected === "A2") out.A1 = appletUpdatePoint(out.B2, out.A2, out.B1, out.A1);
  else if (selected === "B2") out.B1 = appletUpdatePoint(out.A2, out.B2, out.A1, out.B1);
  return out;
}

// FixOnCircle(p, q) + CTKMoveableDoub's circle projection.
function appletFixOnCircle(target, p, q) {
  const r = dist(p, q), d = dist(target, p);
  if (!d) return { x: p.x + r, y: p.y };
  return { x: p.x + (target.x - p.x) * r / d, y: p.y + (target.y - p.y) * r / d };
}

const PARTNER = { A1: "B1", B1: "A1", A2: "B2", B2: "A2" };
function randomFour() {
  return { A1: randomPoint(), B1: randomPoint(), A2: randomPoint(), B2: randomPoint() };
}

/* ------------------------------------------------------ 1. the start picture */

{
  const s = C.start({});
  const want = appletStart(C.WIDTH, C.HEIGHT);
  check("start(): A1 matches init()", ptNear(s.A1, want.A1, 1e-12));
  check("start(): B1 matches init()", ptNear(s.B1, want.B1, 1e-12));
  check("start(): A2 matches init()", ptNear(s.A2, want.A2, 1e-12));
  check("start(): B2 matches init()", ptNear(s.B2, want.B2, 1e-12));
  equal("start(): slider starts at the applet's 0.5", s.s, 0.5);
  equal("start(): names shown by default", s.showNames, true);
  equal("start(): no constraints by default", [s.keepEqual, s.fixLength], [false, false]);
  let all = true;
  for (const [w, h] of [[500, 400], [400, 500], [320, 700], [1000, 240], [1, 1], [777, 333]]) {
    const got = C.start({ width: w, height: h });
    const expected = appletStart(w, h);
    all = all && C.NAMES.every((n) => ptNear(got[n], expected[n], 1e-12));
  }
  check("start(): the same construction at six applet sizes", all);
  check("start(): slider clamped to the applet's 0..1.01 range",
    C.start({ s: -3 }).s === 0 && C.start({ s: 9 }).s === 1.01);
}

/* --------------------------------- 2. InnerPoint and Midpoint over every i */

{
  let innerOk = true, drawOk = true, nOk = true;
  for (let trial = 0; trial < 60; trial++) {
    const four = randomFour();
    const s = C.start({ points: four, s: rand() * 1.01 });
    const p = randomPoint(), q = randomPoint();
    for (const n of [7, 10, 13]) {
      for (let i = 0; i <= n; i++) {
        innerOk = innerOk && ptNear(C.innerPoint(p, q, i, n), appletInnerPoint(p, q, i, n), 1e-10);
        const want = appletDraw(four, s.s, n)[i];
        drawOk = drawOk && ptNear(C.combinedPoints(s, n)[i], want, 1e-10);
      }
    }
    nOk = nOk && C.combinedPoints(s).length === C.N + 1;
  }
  check("InnerPoint matches the applet for all i at n = 7, 10, 13", innerOk);
  check("all eleven marks match applet Draw() exactly", drawOk);
  check("Draw(): N + 1 = 11 marks", nOk && C.N === 10);
}

/* -------------------------- 3. the full slider range, many configurations */

{
  let ok = true, endpointOk = true, affineOk = true, dichotomyOk = true;
  let cases = 0;
  for (let trial = 0; trial < 40; trial++) {
    const four = randomFour();
    for (let k = 0; k <= 101; k++) { // 0.00, 0.01, ... 1.01: every slider notch
      const s = C.start({ points: four, s: k / 100 });
      const marks = C.combinedPoints(s);
      const { Ar, Br } = C.endpoints(s);
      const scale = Math.max(dist(s.A1, s.B1), dist(s.A2, s.B2), 1);
      const tol = 1e-8 * scale;
      const cl = C.claims(s);
      cases++;
      ok = ok && marks.every((p) => Math.abs(cross(Ar, Br, p)) <= tol);
      endpointOk = endpointOk && ptNear(marks[0], Ar, tol) && ptNear(marks[C.N], Br, tol);
      affineOk = affineOk && marks.every((p, i) => ptNear(p, C.affineImage(s, i / C.N), tol));
      dichotomyOk = dichotomyOk && cl.collinear && cl.affineFormula && cl.endpoints &&
        cl.sInRange && (cl.coincide || (cl.spread > tol && cl.deviation <= tol));
    }
  }
  check(`the page's collinear claim at all 102 slider notches × 40 shapes (${cases} cases)`, ok);
  check("marks 0 and 10 are exactly A_r and B_r", endpointOk);
  check("M_i = A_r + (B_r - A_r) * i/10 for every i", affineOk);
  check("the dichotomy: collinear unless A_r = B_r, then all coincide", dichotomyOk);
}

/* ------------------------------------ 4. every special case the page names */

{
  // r = 1/2: Hjelmslev's theorem, the ordinary midpoints of P1P2.
  let midOk = true;
  for (let t = 0; t < 300; t++) {
    const four = randomFour();
    const s = C.start({ points: four, s: 0.5 });
    const marks = C.combinedPoints(s);
    for (let i = 0; i <= C.N; i++) {
      const p1 = appletInnerPoint(four.A1, four.B1, i, C.N);
      const p2 = appletInnerPoint(four.A2, four.B2, i, C.N);
      midOk = midOk && ptNear(marks[i], { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, 1e-9);
    }
  }
  check("r = 1/2 gives the ordinary midpoints (Hjelmslev's theorem)", midOk);
}

{
  // A_r = B_r: the "all coincide" half of the claim, in exact arithmetic.
  const four = { A1: { x: 0, y: 0 }, B1: { x: 120, y: 0 }, A2: { x: 120, y: 0 }, B2: { x: 0, y: 0 } };
  const s = C.start({ points: four, s: 0.5 });
  const { Ar, Br } = C.endpoints(s);
  const marks = C.combinedPoints(s);
  check("constructed A_r = B_r", ptNear(Ar, Br, 1e-12));
  check("when A_r = B_r all eleven marks coincide", marks.every((p) => ptNear(p, Ar, 1e-10)) && C.claims(s).coincide);
  const far = C.start({ points: { ...four, B2: { x: 10, y: 60 } }, s: 0.5 });
  check("when A_r differs the marks spread out", !C.claims(far).coincide && C.claims(far).spread > 1);
}

{
  // The theorem does not need an isometry: use unequal, unrelated segments.
  let affineOk = true, isoOk = true;
  for (let t = 0; t < 400; t++) {
    const a = randomPoint(), b = randomPoint();
    const c = randomPoint(), d = randomPoint();
    const affine = C.start({ points: { A1: a, B1: b, A2: c, B2: d }, s: rand() * 1.01 });
    affineOk = affineOk && C.claims(affine).collinear;
    // A genuine isometry: rotate segment 1 about the origin, then translate.
    const ang = rand() * 6.283, shift = randomPoint(-50, 50);
    const rot = (p) => ({
      x: shift.x + p.x * Math.cos(ang) - p.y * Math.sin(ang),
      y: shift.y + p.x * Math.sin(ang) + p.y * Math.cos(ang),
    });
    const iso = C.start({ points: { A1: a, B1: b, A2: rot(a), B2: rot(b) }, s: rand() });
    isoOk = isoOk && C.claims(iso).collinear && near(dist(a, b), dist(iso.A2, iso.B2), 1e-8);
  }
  check("an affine (non-isometric) matching still gives collinear marks", affineOk);
  check("rotation plus translation (a true isometry) gives collinear marks", isoOk);
}

{
  // P(t) = tA + (1-t)B is one-to-one unless A = B — another page claim.
  let oneToOne = true;
  for (let t = 0; t < 400; t++) {
    const a = randomPoint(), b = randomPoint();
    const u = rand(), v = rand();
    const p = { x: u * a.x + (1 - u) * b.x, y: u * a.y + (1 - u) * b.y };
    const q = { x: v * a.x + (1 - v) * b.x, y: v * a.y + (1 - v) * b.y };
    if (dist(a, b) > 1e-6 && Math.abs(u - v) > 1e-6) oneToOne = oneToOne && !ptNear(p, q, 1e-8);
  }
  check("P(t) is one-to-one unless the two endpoints match", oneToOne);
}

/* ------------------------- 5. the applet's drag constraints, second reading */

{
  let same = true, lengths = true;
  for (const name of C.NAMES) {
    for (let t = 0; t < 120; t++) {
      const four = randomFour();
      const state = C.start({ points: four, keepEqual: true });
      const target = randomPoint();
      const got = C.withPoint(state, name, target);
      const bare = { ...four, [name]: target };
      const want = appletCheckAndUpdate(bare, name);
      same = same && C.NAMES.every((n) => ptNear(got[n], want[n], 1e-9));
      lengths = lengths && near(dist(got.A1, got.B1), dist(got.A2, got.B2), 1e-8);
    }
  }
  check("Keep segments equal: withPoint matches applet CheckAndUpdate for all four ends", same);
  check("Keep segments equal: both segments end with the same length", lengths);
}

{
  let same = true, fixed = true, otherFree = true;
  for (const name of C.NAMES) {
    for (let t = 0; t < 120; t++) {
      const four = randomFour();
      const state = C.start({ points: four, fixLength: true });
      const target = randomPoint();
      const got = C.withPoint(state, name, target);
      const want = appletFixOnCircle(target, four[PARTNER[name]], four[name]);
      same = same && ptNear(got[name], want, 1e-9);
      fixed = fixed && near(dist(got[name], got[PARTNER[name]]), dist(four[name], four[PARTNER[name]]), 1e-8);
      otherFree = otherFree && ptNear(got[PARTNER[name]], four[PARTNER[name]], 1e-12);
    }
  }
  check("FixLengths: withPoint matches applet FixOnCircle for all four ends", same);
  check("FixLengths: the dragged segment keeps its old length", fixed);
  check("FixLengths: the other endpoint does not move", otherFree);
}

{
  let same = true, shiftOk = true;
  for (let t = 0; t < 200; t++) {
    const four = randomFour();
    const s = C.start({ points: four, s: rand() * 1.01 });
    const delta = randomPoint(-40, 40);
    for (const [name, first, second] of [["A1B1", "A1", "B1"], ["A2B2", "A2", "B2"]]) {
      const got = C.withSegment(s, name, delta);
      same = same && ptNear(got[first], { x: four[first].x + delta.x, y: four[first].y + delta.y }, 1e-10) &&
        ptNear(got[second], { x: four[second].x + delta.x, y: four[second].y + delta.y }, 1e-10);
      const factor = name === "A1B1" ? s.s : 1 - s.s;
      shiftOk = shiftOk && C.combinedPoints(got).every((p, i) =>
        ptNear(p, { x: C.combinedPoints(s)[i].x + delta.x * factor,
                    y: C.combinedPoints(s)[i].y + delta.y * factor }, 1e-9));
    }
  }
  check("dragging a segment translates both its ends, as MOShapes does", same);
  check("the marks shift by r*delta or (1-r)*delta with the dragged segment", shiftOk);
}

/* ----------------------------------- 6. state handling and the applet's UI */

{
  const s = C.start({});
  const moved = C.withPoint(s, "A1", { x: 7, y: 9 });
  check("withPoint does not change the old state", ptNear(s.A1, appletStart(500, 400).A1, 1e-12) && moved.A1.x === 7);
  check("unknown handles leave the state alone", ptNear(C.withPoint(s, "C", { x: 1, y: 1 }).A1, s.A1, 1e-12));
  equal("legal moves: four ends and two segments", C.legalMoves(s), ["A1", "B1", "A2", "B2", "A1B1", "A2B2"]);
  check("move() dispatches point, segment and option moves",
    C.move(s, { type: "point", name: "B2", point: { x: 3, y: 4 } }).B2.x === 3 &&
    C.move(s, { type: "segment", name: "A1B1", delta: { x: 5, y: 0 } }).A1.x === s.A1.x + 5 &&
    C.move(s, { type: "option", name: "s", value: 0.25 }).s === 0.25);
  check("an illustration has no result", C.result(s) === null);
  equal("slider range is the applet's 0 to 1.01", [C.S_MIN, C.S_MAX, C.S_STEP], [0, 1.01, 0.01]);
  // The page says 0 <= r <= 1; the applet's edit box allows 1.01. The algebra
  // still holds there, and the port keeps the applet's larger range.
  check("the extra 1.01 notch still satisfies the claim", C.claims(C.start({ s: 1.01 })).collinear);
}

done("hjelmslev-theorem");
