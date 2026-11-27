#!/usr/bin/env node
"use strict";

/*
 * Logic test for eight-point-circle/eight-point-circle-core.js.
 *
 *   node porting/check-eight-point-circle.mjs
 *
 * Two independent jobs:
 *
 * 1. The page's exact claim — with perpendicular diagonals AC and BD, the
 *    side midpoints P,Q,R,S and the perpendicular feet E,F,G,H all lie on a
 *    circle centred at K = PR ∩ QS — is checked on fixed shapes, on a
 *    5^6 exhaustive grid of axis-aligned shapes and on thousands of rotated
 *    perpendicular shapes. We also confirm the claim fails when the
 *    diagonals are NOT perpendicular, so the test tests the hypothesis.
 *
 * 2. The applet's own drawing is transcribed a second time, literally from
 *    its bytecode (MidPoint, NearestPoint with its 0.1 guard, Intersect with
 *    its |det| >= 1 guard, the ±30 start offsets and the averaged radius),
 *    and compared with the core on every one of those configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("eight-point-circle/eight-point-circle-core.js", "EightPointCircleCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const dot = (p, q) => p.x * q.x + p.y * q.y;
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closePoint = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);
const scaleOf = (a, b, c, d) => Math.max(1,
  dist(a, b), dist(b, c), dist(c, d), dist(d, a), dist(a, c), dist(b, d));

/* --------------------------- the applet's arithmetic, transcribed again ---- */

/* DoubPoint MidPoint(p,q): new DoubPoint((p.x+q.x)/2.0, (p.y+q.y)/2.0). */
function appletMidPoint(p, q) {
  return P((p.x + q.x) / 2.0, (p.y + q.y) / 2.0);
}

/* GeoSDoub.SqDist(p,q) = dx*dx + dy*dy. */
function appletSqDist(p, q) {
  const dx = p.x - q.x, dy = p.y - q.y;
  return dx * dx + dy * dy;
}

/* GeoSDoub.NearestPoint(p, a, b), from its bytecode: if SqDist(a,p) <= 0.1
 * return p; otherwise project p onto the infinite line a-b. */
function appletNearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (appletSqDist(a, p) <= 0.1) return P(p.x, p.y);
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + dx * t, a.y + dy * t);
}

/* GeoSDoub.Intersect(a,b,c,d), line-equation form with the applet's guard. */
function appletIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const xnum = b1 * c2 - b2 * c1;
  const ynum = c1 * a2 - c2 * a1;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return P(NaN, NaN);
  return P(xnum / den, ynum / den);
}

/* EightPointCircleCanvas.init() on W=400,H=250. The radius uses Java integer
 * division: floor(min(W,H)*7/15) = floor(250*7/15) = 116. GetOtherH/V project
 * the circle centre onto a horizontal/vertical line, so B,D share y and
 * A,C share x. Then B.x -= 30 and D.x += 30. */
function appletStart(W = 400, H = 250) {
  const cx = W / 2.0, cy = H / 2.0;
  const r = Math.floor(Math.min(W, H) * 7 / 15);
  const A = P(cx + r * Math.cos(-2.0), cy + r * Math.sin(-2.0));
  const D = P(cx + r * Math.cos(0.2), cy + r * Math.sin(0.2));
  const centre = P(cx, cy);
  const h = appletNearestPoint(centre, D, P(D.x + 200.0, D.y));
  const v = appletNearestPoint(centre, A, P(A.x, A.y + 200.0));
  const B = P(2.0 * h.x - D.x, D.y);
  const Cc = P(A.x, 2.0 * v.y - A.y);
  B.x -= 30.0;
  D.x += 30.0;
  return { A: A, B: B, C: Cc, D: D, r: r, centre: centre };
}

/* EightPointCircleCanvas.DrawQuadri(g), the point arithmetic in the applet's
 * own order and local slots: P..S, E..H, K, then the averaged radius. */
function appletDrawQuadri(A, B, Cc, D) {
  const Pm = appletMidPoint(A, B);   // P: AB
  const Q = appletMidPoint(B, Cc);   // Q: BC
  const R = appletMidPoint(Cc, D);   // R: CD
  const S = appletMidPoint(D, A);    // S: DA
  const E = appletNearestPoint(Pm, Cc, D);  // P to CD
  const F = appletNearestPoint(Q, D, A);    // Q to DA
  const G = appletNearestPoint(R, A, B);    // R to AB
  const H = appletNearestPoint(S, B, Cc);   // S to BC
  const K = appletIntersect(Pm, R, Q, S);
  const radius = (Math.hypot(K.x - Pm.x, K.y - Pm.y)
    + Math.hypot(K.x - Q.x, K.y - Q.y)
    + Math.hypot(K.x - R.x, K.y - R.y)
    + Math.hypot(K.x - S.x, K.y - S.y)) / 4.0;
  return { P: Pm, Q: Q, R: R, S: S, E: E, F: F, G: G, H: H, K: K, radius: radius };
}

/* The page's claim, checked without using any function of the core. */
function pageClaim(A, B, Cc, D) {
  const g = appletDrawQuadri(A, B, Cc, D);
  const tol = 1e-7 * scaleOf(A, B, Cc, D);
  const same = (p, q) => closePoint(p, q, tol);
  const diag = sub(Cc, A), other = sub(D, B);
  const orth = Math.abs(dot(diag, other)) / (Math.hypot(diag.x, diag.y) * Math.hypot(other.x, other.y));
  const names = ["P", "Q", "R", "S", "E", "F", "G", "H"];
  const onCircle = names.every((n) => close(dist(g[n], g.K), g.radius, tol));
  const centroid = same(g.K, P((A.x + B.x + Cc.x + D.x) / 4, (A.y + B.y + Cc.y + D.y) / 4));
  const diameters = same(g.K, appletMidPoint(g.P, g.R)) && same(g.K, appletMidPoint(g.Q, g.S))
    && close(dist(g.P, g.R), dist(g.Q, g.S), tol);
  const rightAngles = [g.E, g.F, g.G, g.H].every((f) =>
    Math.abs(dot(sub(g.P, f), sub(g.R, f))) <= 1e-8 * scaleOf(A, B, Cc, D) * scaleOf(A, B, Cc, D)
    && Math.abs(dot(sub(g.Q, f), sub(g.S, f))) <= 1e-8 * scaleOf(A, B, Cc, D) * scaleOf(A, B, Cc, D));
  return { orthogonal: orth <= 1e-9, onCircle: onCircle, centroid: centroid,
    diameters: diameters, rightAngles: rightAngles, g: g };
}

/* -------------------------------------------------------- 1. start and rules */

{
  const s = C.start({});
  const a = appletStart();
  check("start A matches the applet's (cx + r cos(-2), cy + r sin(-2))", closePoint(s.A, a.A, 1e-9));
  equal("start B (reflection, then -30)", s.B, a.B);
  equal("start C (reflection in y=cy)", s.C, a.C);
  equal("start D (shift +30)", s.D, a.D);
  check("the start radius is the applet's integer 116", a.r === 116);
  check("Show diagonals starts off", !s.options.diagonals);
  check("Show labels starts off", !s.options.labels);
  check("Show hint starts off", !s.options.hint);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  const g = C.geometry(s);
  check("the start diagram has a construction", !!g);
  check("the start diagonals are perpendicular", g.claims.orthogonal);
  check("the start shape satisfies the page's claim", g.claims.allEight);
}

{
  const s = C.start();
  const a = appletStart();
  const mA = C.move(s, "A", P(60, 200));
  check("dragging A pulls C across in x only", mA.C.x === 60 && mA.C.y === s.C.y);
  check("dragging A leaves B and D alone", mA.B.x === s.B.x && mA.D.x === s.D.x);
  const mC = C.move(s, "C", P(310, 60));
  check("dragging C pulls A across in x only", mC.A.x === 310 && mC.A.y === s.A.y);
  const mB = C.move(s, "B", P(70, 220));
  check("dragging B pulls D across in y only", mB.D.y === 220 && mB.D.x === s.D.x);
  const mD = C.move(s, "D", P(300, 40));
  check("dragging D pulls B across in y only", mD.B.y === 40 && mD.B.x === s.B.x);
  check("dragging marks the diagram explored but does not change the old state",
    mA.explored && !s.explored && s.A.x !== mA.A.x);
  check("an unknown corner is ignored", C.move(s, "Z", P(1, 2)) === s);
  check("a non-finite corner is ignored", C.move(s, "A", P(NaN, 2)) === s);
  const far = C.move(s, "A", P(9999, -9999));
  check("corners stay inside the board", far.A.x === C.VIEW.width - C.PAD && far.A.y === C.PAD);
  check("all four dragged corners keep the diagonals perpendicular",
    [mA, mC, mB, mD].every((st) => C.geometry(st) && C.geometry(st).claims.orthogonal));

  const d = C.setOption(s, "diagonals", true);
  const l = C.setOption(d, "labels", true);
  const h = C.setOption(l, "hint", true);
  check("each checkbox turns on and marks the diagram explored",
    d.options.diagonals && l.options.labels && h.options.hint && h.explored && !s.options.diagonals);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(h);
  check("Reset restores the starting corners and keeps the three checkboxes",
    r.A.x === a.A.x && r.B.x === a.B.x && r.C.x === a.C.x && r.D.x === a.D.x
    && r.options.diagonals && r.options.labels && r.options.hint && r.explored);
  check("the status says all eight points lie on one circle", /All eight marked points sit on one circle/.test(C.describe(s)));
  check("the Hint status names the two diameters", /PR and QS are diameters/.test(C.describe(h)));
}

/* ---------------------------- 2. fixed shapes and the page's claims -------- */

const start = appletStart();
const fixed = [
  ["the applet's start", start.A, start.B, start.C, start.D],
  ["a wide orthogonal kite", P(120, 30), P(40, 150), P(120, 230), P(350, 150)],
  ["a tall orthogonal kite", P(70, 40), P(200, 125), P(70, 220), P(300, 125)],
  ["a crossed orthogonal shape", P(120, 210), P(40, 90), P(120, 40), P(350, 90)],
  ["a small orthogonal shape", P(200, 100), P(195, 125), P(200, 150), P(260, 125)],
];
for (const [name, A, B, Cc, D] of fixed) {
  const g = C.compute(A, B, Cc, D);
  const claim = pageClaim(A, B, Cc, D);
  check(`${name}: the core and the applet's own drawing agree`,
    !!g && ["P", "Q", "R", "S", "E", "F", "G", "H", "K"].every((n) => closePoint(g[n], claim.g[n], 1e-8))
      && close(g.radius, claim.g.radius, 1e-8));
  check(`${name}: K is the centre of mass, PR and QS are diameters`,
    !!g && g.claims.centroid && g.claims.diameters && claim.centroid && claim.diameters);
  check(`${name}: all eight points lie on the circle and see the diameters at right angles`,
    !!g && g.claims.allEight && g.claims.rightAngles && claim.onCircle && claim.rightAngles);
}

// A non-perpendicular quadrilateral must NOT satisfy the page's claim; this
// checks that the hypothesis is really being tested, not an over-broad fact.
{
  const A = P(40, 40), B = P(340, 60), Cc = P(300, 220), D = P(80, 200);
  const g = C.compute(A, B, Cc, D);
  const claim = pageClaim(A, B, Cc, D);
  check("a quadrilateral with skew diagonals is reported as skew", !!g && !g.claims.orthogonal && !claim.orthogonal);
  check("the eight-circle claim fails when the diagonals are skew",
    !!g && !g.claims.allEight && !claim.onCircle);
}

/* --------------- 3. exhaustive axis-aligned grid against the bytecode ------ */

{
  const values = [40, 90, 200, 310, 360];
  let compared = 0, mismatches = 0, badClaims = 0, firstBad = "";
  for (const xv of values) for (const a of values) for (const c of values) {
    for (const yh of values) for (const b of values) for (const d of values) {
      const A = P(xv, a), B = P(b, yh), Cc = P(xv, c), D = P(d, yh);
      const cs = [A, B, Cc, D];
      if (cs.some((p, i) => cs.some((q, j) => i < j && dist(p, q) < 1e-6))) continue;
      const core = C.compute(A, B, Cc, D);
      const applet = appletDrawQuadri(A, B, Cc, D);
      if (!core || !Number.isFinite(applet.K.x) || !Number.isFinite(applet.radius)) continue;
      compared++;
      for (const n of ["P", "Q", "R", "S", "E", "F", "G", "H", "K"]) {
        if (!closePoint(core[n], applet[n], 1e-8 * scaleOf(A, B, Cc, D))) {
          if (mismatches++ === 0) firstBad = `${n} at ${JSON.stringify([A, B, Cc, D])}`;
        }
      }
      if (!close(core.radius, applet.radius, 1e-8 * scaleOf(A, B, Cc, D))) {
        if (mismatches++ === 0) firstBad = `radius at ${JSON.stringify([A, B, Cc, D])}`;
      }
      // Axis-aligned diagonals are perpendicular; the page's claim must hold.
      if (!core.claims.allEight || !core.claims.rightAngles || !core.claims.centroid
          || !core.claims.rectangle || !core.claims.orthogonal) {
        if (badClaims++ === 0) firstBad = `claims at ${JSON.stringify([A, B, Cc, D])}`;
      }
    }
  }
  check(`the whole 5^6 grid (${compared} legal shapes) matches the applet bytecode`,
    mismatches === 0, `${mismatches} mismatches; first: ${firstBad}`);
  check(`the page's claim holds for all ${compared} grid shapes`, badClaims === 0,
    `${badClaims} failures; first: ${firstBad}`);
  check("the exhaustive grid covers thousands of legal shapes", compared > 8000, `${compared} shapes`);
}

/* ----------------- 4. rotated perpendicular shapes vs the bytecode -------- */

{
  const rand = rng(1944);
  let compared = 0, mismatches = 0, badClaims = 0;
  for (let i = 0; i < 4000; i++) {
    const ox = 30 + rand() * 340, oy = 30 + rand() * 190;
    const th = rand() * Math.PI;
    const nx = Math.cos(th), ny = Math.sin(th);
    const mx = -ny, my = nx;
    const u = 8 + rand() * 105, v = 8 + rand() * 105;
    const A = P(ox + u * nx, oy + u * ny);
    const Cc = P(ox - u * nx, oy - u * ny);
    const B = P(ox + v * mx, oy + v * my);
    const D = P(ox - v * mx, oy - v * my);
    const core = C.compute(A, B, Cc, D);
    const applet = appletDrawQuadri(A, B, Cc, D);
    if (!core || !Number.isFinite(applet.K.x)) continue;
    compared++;
    for (const n of ["P", "Q", "R", "S", "E", "F", "G", "H", "K"]) {
      if (!closePoint(core[n], applet[n], 1e-7)) mismatches++;
    }
    if (!close(core.radius, applet.radius, 1e-7)) mismatches++;
    const claim = pageClaim(A, B, Cc, D);
    if (!core.claims.allEight || !core.claims.rightAngles || !core.claims.diameters
        || !claim.onCircle || !claim.rightAngles || !claim.diameters) badClaims++;
  }
  check(`4000 rotated perpendicular quadrilaterals (${compared} drawn) match the applet`,
    mismatches === 0, `${mismatches} mismatches`);
  check("the page's claim also holds after any rotation", badClaims === 0, `${badClaims} failures`);
  check("rotated cases were really compared", compared > 3900, `${compared} shapes`);
}

/* ------------------------------- 5. degenerate safety --------------------- */

{
  const A = P(100, 100);
  check("coincident corners give no drawable circle", C.compute(A, A, P(200, 200), P(150, 150)) === null);
  check("a missing corner gives no drawable circle", C.compute(A, P(200, 200), null, P(150, 150)) === null);
  check("a collapsed diagonal gives no drawable circle",
    C.compute(A, P(200, 100), A, P(200, 200)) === null);
  check("the status explains a collapsed diagram",
    /Drag the corners apart/.test(C.describe({ A: A, B: A, C: A, D: A, options: {} })));
}

done("eight-point-circle");
