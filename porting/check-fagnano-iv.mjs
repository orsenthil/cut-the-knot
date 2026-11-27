#!/usr/bin/env node
"use strict";

/*
 * Logic test for fagnano-iv/fagnano-iv-core.js.
 *
 *   node porting/check-fagnano-iv.mjs
 *
 * The page's claim is perimeter(PQR) >= 2*area(ABC)/r, with equality for the
 * orthic triangle. This test checks it on a grid of triangles and side
 * fractions, checks that the orthic triangle attains it and that moving any
 * one of its vertices away increases it, and writes the applet's own
 * geometry a second time straight from the bytecode (FindCircumcenter,
 * FindAltitude, NearestPoint, DoubLine.UpdateMidPoint, GetCircumcircle) and
 * compares the two implementations over the whole grid.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("fagnano-iv/fagnano-iv-core.js", "FagnanoIvCore");
const TOL = 1e-8;
const near = (a, b, tol = TOL) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (a, b, tol = TOL) => C.finite(a) && C.finite(b) && C.dist(a, b) <= tol;

const withT = (A, B, Cc, tP, tQ, tR) => ({
  A, B, C: Cc, tP, tQ, tR, showNames: true, showHint: false,
});

/* ------------------------------------------------- 1. the opening figure */

{
  const s = C.start();
  equal("the opening corners are the applet's k = min(W/8,H/8) positions",
    [s.A, s.B, s.C],
    [{ x: 93.75, y: 31.25 }, { x: 31.25, y: 218.75 }, { x: 337.5, y: 187.5 }]);
  equal("the opening side points use the applet's t values 0.4, 0.2, 0.3",
    [s.tP, s.tQ, s.tR], [0.4, 0.2, 0.3]);
  check("the applet starts with names on and the hint off", s.showNames && !s.showHint);
  const f = C.compute(s);
  check("the opening P lies 0.4 of the way from C to B",
    closePoint(f.P, C.along(0.4, s.B, s.C)));
  check("the opening Q lies 0.2 of the way from A to C",
    closePoint(f.Q, C.along(0.2, s.C, s.A)));
  check("the opening R lies 0.3 of the way from B to A",
    closePoint(f.R, C.along(0.3, s.A, s.B)));
  check("the opening circumcircle is finite", C.finite(f.O) && near(f.r, C.dist(f.O, s.A)));
  check("the opening figure has a positive area and a positive bound", f.area > 0 && f.bound > 0);
  check("the opening PQR is longer than the bound", f.ratio > 1.1, `ratio ${f.ratio}`);
  check("the opening eyes are winking", !f.eyesOpen);
}

/* -------------------------------------- 2. an exact triangle, by hand */

{
  // A=(80,40), B=(80,200), C=(320,200) is right-angled at B. Its
  // circumcenter is the midpoint of the hypotenuse (200,120), r=200, area
  // 19200, so 2*area/r = 192. The altitude feet are B, (135.4147,85.7875)
  // and B again: the orthic triangle degenerates to the segment B-Hb.
  const s = withT({ x: 80, y: 40 }, { x: 80, y: 200 }, { x: 320, y: 200 }, 0.4, 0.2, 0.3);
  const f = C.compute(s);
  check("an exact right triangle has its circumcenter at the hypotenuse midpoint",
    closePoint(f.O, { x: 200, y: 120 }));
  check("an exact right triangle has r = half its hypotenuse", near(f.r, Math.hypot(240, 160) / 2));
  check("an exact right triangle has 2*area/r = 76800/hypotenuse",
    near(f.bound, 76800 / Math.hypot(240, 160)));
  check("the right-angle altitude foot from A is B", closePoint(f.Ha, s.B));
  const orthic = C.compute(C.orthicState(s));
  check("the orthic perimeter equals the bound even in the right case",
    near(orthic.perimeter, orthic.bound, 1e-7));
  check("the right-case orthic parameters put P and R at B",
    near(orthic.orthicParams.tP, 1, 1e-7) && near(orthic.orthicParams.tR, 0, 1e-7));
}

/* ------------- 3. a second, literal transcription of the applet's maths */

/*
 * The bytecode's Intersect uses line coefficients a = y_p-y_q,
 * b = x_q-x_p, c = x_p*y_q-y_p*x_q, and returns NaN when |det| < 1.
 * FindCircumcenter intersects the perpendicular bisectors of AB and BC;
 * GetCircumcircle sets r to the mean of the three centre-to-vertex distances.
 * FindAltitude(p,a,b) intersects the line from p to p+(b.y-a.y, a.x-b.x)
 * with ab. NearestPoint(p,a,b) projects p onto a->b, with an early return
 * when SqDist(p,a) < 0.1. DoubLine.UpdateMidPoint finds t on m1--m2.
 */
function jIntersect(p, q, r, s) {
  const a1 = q.y - p.y, b1 = p.x - q.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = s.y - r.y, b2 = r.x - s.x, c2 = r.x * s.y - r.y * s.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
}

function jAltitudeFoot(p, a, b) {
  const q = { x: p.x + b.y - a.y, y: p.y - (b.x - a.x) };
  return jIntersect(p, q, a, b);
}

function jCircumcircle(A, B, Cc) {
  const midAB = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const midBC = { x: (B.x + Cc.x) / 2, y: (B.y + Cc.y) / 2 };
  const perpAB = { x: midAB.x + B.y - A.y, y: midAB.y - (B.x - A.x) };
  const perpBC = { x: midBC.x + Cc.y - B.y, y: midBC.y - (Cc.x - B.x) };
  const O = jIntersect(midAB, perpAB, midBC, perpBC);
  const r = (C.dist(O, A) + C.dist(O, B) + C.dist(O, Cc)) / 3;
  return { O, r };
}

function jNearest(p, a, b) {
  if (C.sqDist(a, p) < 0.1) return { ...p };
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function jMidpoint(t, m1, m2) {
  return { x: t * m1.x + (1 - t) * m2.x, y: t * m1.y + (1 - t) * m2.y };
}

function jParameter(m1, m2, p) {
  const dx = m1.x - m2.x, dy = m1.y - m2.y;
  const num = dx * (m2.x - p.x) + dy * (m2.y - p.y);
  let t = -num / (dx * dx + dy * dy);
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return t;
}

{
  const rnd = rng(97);
  let n = 0, worstO = 0, worstR = 0, worstH = 0, worstN = 0, worstMid = 0, worstT = 0;
  for (let i = 0; i < 1200; i++) {
    const A = { x: 40 + rnd() * 320, y: 20 + rnd() * 180 };
    const B = { x: 30 + rnd() * 80, y: 170 + rnd() * 60 };
    const Cc = { x: 280 + rnd() * 90, y: 160 + rnd() * 70 };
    const tP = rnd(), tQ = rnd(), tR = rnd();
    const s = withT(A, B, Cc, tP, tQ, tR);
    const f = C.compute(s);
    if (!C.finite(f.O)) continue;
    const j = jCircumcircle(A, B, Cc);
    if (!C.finite(j.O) || !Number.isFinite(j.r)) continue;
    n++;
    worstO = Math.max(worstO, C.dist(f.O, j.O));
    worstR = Math.max(worstR, Math.abs(f.r - j.r));
    worstH = Math.max(worstH, C.dist(f.Ha, jAltitudeFoot(A, B, Cc)),
      C.dist(f.Hb, jAltitudeFoot(B, Cc, A)), C.dist(f.Hc, jAltitudeFoot(Cc, A, B)));
    const jNormals = [
      [jNearest(f.P, j.O, B), jNearest(f.P, j.O, Cc)],
      [jNearest(f.Q, j.O, Cc), jNearest(f.Q, j.O, A)],
      [jNearest(f.R, j.O, A), jNearest(f.R, j.O, B)],
    ];
    for (let k = 0; k < 3; k++) for (let m = 0; m < 2; m++) {
      worstN = Math.max(worstN, C.dist(f.normals[k][m], jNormals[k][m]));
    }
    const jP = jMidpoint(tP, B, Cc), jQ = jMidpoint(tQ, Cc, A), jR = jMidpoint(tR, A, B);
    worstMid = Math.max(worstMid, C.dist(f.P, jP), C.dist(f.Q, jQ), C.dist(f.R, jR));
    worstT = Math.max(worstT,
      Math.abs(jParameter(B, Cc, jP) - tP),
      Math.abs(jParameter(Cc, A, jQ) - tQ),
      Math.abs(jParameter(A, B, jR) - tR));
  }
  check("the comparison used at least 1000 non-degenerate configurations", n >= 1000, `used ${n}`);
  check(`circumcenter matches the bytecode transcription (max ${worstO})`, worstO < TOL);
  check(`circumradius matches GetCircumcircle (max ${worstR})`, worstR < TOL);
  check(`the three altitude feet match FindAltitude (max ${worstH})`, worstH < TOL);
  check(`the six right-angle points match NearestPoint (max ${worstN})`, worstN < TOL);
  check(`P, Q, R match CreateMidPoint (max ${worstMid})`, worstMid < TOL);
  check(`UpdateMidPoint recovers every t (max ${worstT})`, worstT < TOL);
}

/* ------------------------------------- 4. moving the six draggable dots */

{
  const s = C.start();
  const moved = C.move(s, "A", { x: 150, y: 60 });
  check("moving A changes A but not the stored t values",
    closePoint(moved.A, { x: 150, y: 60 }) && moved.tP === s.tP && moved.tQ === s.tQ && moved.tR === s.tR);
  const before = C.compute(s), after = C.compute(moved);
  check("moving A re-creates Q and R on their new sides",
    closePoint(after.Q, C.along(s.tQ, moved.C, moved.A)) &&
    closePoint(after.R, C.along(s.tR, moved.A, moved.B)));
  check("moving A leaves P where it was (its side did not move)", closePoint(after.P, before.P));
  const dragged = C.move(s, "P", { x: 200, y: 205 });
  const f = C.compute(dragged);
  check("dragging P keeps it exactly on BC", near(C.cross(C.sub(f.P, s.B), C.sub(s.C, s.B)), 0, 1e-6));
  check("dragging P changes only tP", dragged.tQ === s.tQ && dragged.tR === s.tR && dragged.tP !== s.tP);
  const beyond = C.move(s, "Q", { x: -500, y: -500 });
  const bf = C.compute(beyond);
  check("dragging past the end of CA clamps Q to A", closePoint(bf.Q, s.A, 1e-6));
  const outside = C.move(s, "B", { x: -40, y: 400 });
  check("PointIsEligible keeps a corner two pixels inside the canvas",
    outside.B.x >= 2 && outside.B.y <= 248 && outside.B.x < 400 && outside.B.y > 0);
  check("a drag of an unknown point is ignored", C.move(s, "Z", { x: 1, y: 2 }) === s);
  check("the two checkboxes are independent",
    C.option(C.option(s, "showNames", false), "showHint", true).showHint &&
    !C.option(C.option(s, "showNames", false), "showHint", true).showNames);
}

/* -------------------------------------- 5. the page's perimeter bound */

{
  const rnd = rng(20261127);
  let tested = 0, worst = Infinity, worstCase = null;
  for (let i = 0; i < 9000; i++) {
    const A = { x: 30 + rnd() * 340, y: 15 + rnd() * 195 };
    const B = { x: 20 + rnd() * 130, y: 150 + rnd() * 80 };
    const Cc = { x: 250 + rnd() * 130, y: 145 + rnd() * 85 };
    const s = withT(A, B, Cc, rnd(), rnd(), rnd());
    const f = C.compute(s);
    if (!C.finite(f.O) || !Number.isFinite(f.ratio) || f.r < 10) continue;
    tested++;
    if (f.ratio < worst) { worst = f.ratio; worstCase = { A, B, Cc, tP: s.tP, tQ: s.tQ, tR: s.tR }; }
  }
  check("9000 random configurations were used", tested > 8000, `used ${tested}`);
  check(`perimeter >= 2*area/r on every random configuration (min ratio ${worst})`, worst >= 1 - 1e-9,
    `worst at ${JSON.stringify(worstCase)}`);

  let gridCases = 0, gridWorst = Infinity;
  for (let ax = 0; ax < 7; ax++) for (let ay = 0; ay < 6; ay++) {
    const A = { x: 90 + ax * 40, y: 25 + ay * 30 };
    const B = { x: 35, y: 215 }, Cc = { x: 365, y: 205 };
    for (let p = 0; p <= 4; p++) for (let q = 0; q <= 4; q++) for (let r = 0; r <= 4; r++) {
      const f = C.compute(withT(A, B, Cc, p / 4, q / 4, r / 4));
      if (!Number.isFinite(f.ratio) || f.r < 10) continue;
      gridCases++;
      gridWorst = Math.min(gridWorst, f.ratio);
    }
  }
  check("the grid covered 7 x 6 triangles x 125 side configurations", gridCases === 42 * 125,
    `used ${gridCases}`);
  check(`perimeter >= 2*area/r on the whole grid (min ratio ${gridWorst})`, gridWorst >= 1 - 1e-9);
}

/* --------------------- 6. equality is the orthic triangle, and unique */

{
  const rnd = rng(1357);
  let acuteCases = 0, worstEquality = 0, openEyes = 0;
  for (let i = 0; i < 1500; i++) {
    const A = { x: 90 + rnd() * 220, y: 20 + rnd() * 120 };
    const B = { x: 30 + rnd() * 70, y: 160 + rnd() * 70 };
    const Cc = { x: 300 + rnd() * 70, y: 160 + rnd() * 70 };
    const s = withT(A, B, Cc, rnd(), rnd(), rnd());
    if (!C.acute(s)) continue;
    const f = C.compute(C.orthicState(s));
    acuteCases++;
    worstEquality = Math.max(worstEquality, Math.abs(f.ratio - 1));
    if (f.eyesOpen) openEyes++;
  }
  check("1500 random uses produced acute triangles", acuteCases > 500, `used ${acuteCases}`);
  check(`the orthic triangle attains the bound (max error ${worstEquality})`, worstEquality < 1e-8);
  check(`the three eyes open at the orthic triangle (${openEyes}/${acuteCases})`, openEyes === acuteCases);

  // Nagel's theorem as the page states it: the orthic sides are perpendicular
  // to the radius vectors from O to C, A and B respectively.
  let worstPerp = 0, perpCases = 0;
  for (let i = 0; i < 800; i++) {
    const A = { x: 100 + rnd() * 200, y: 30 + rnd() * 110 };
    const B = { x: 35 + rnd() * 60, y: 170 + rnd() * 60 };
    const Cc = { x: 305 + rnd() * 60, y: 170 + rnd() * 60 };
    const s = withT(A, B, Cc, 0.4, 0.2, 0.3);
    if (!C.acute(s)) continue;
    const f = C.compute(C.orthicState(s));
    worstPerp = Math.max(worstPerp,
      Math.abs(C.dot(C.sub(f.Hb, f.Ha), C.sub(Cc, f.O))),
      Math.abs(C.dot(C.sub(f.Hc, f.Hb), C.sub(A, f.O))),
      Math.abs(C.dot(C.sub(f.Ha, f.Hc), C.sub(B, f.O))));
    perpCases++;
  }
  check("perpendicularity had enough acute triangles", perpCases > 300, `used ${perpCases}`);
  check(`orthic sides are perpendicular to OA, OB, OC (max dot ${worstPerp})`, worstPerp < 1e-6);

  // Sweep each side fraction through 101 values with the other two fixed at
  // their orthic values: the bound is tight at exactly one value in each run.
  const base = C.start();
  const o = C.compute(base).orthicParams;
  let minima = 0, unique = true;
  for (const key of ["tP", "tQ", "tR"]) {
    let best = Infinity, bestT = 0, ties = 0;
    for (let k = 0; k <= 100; k++) {
      const t = k / 100;
      const s = Object.assign({}, C.orthicState(base), { [key]: t });
      const ratio = C.compute(s).ratio;
      if (ratio < best - 1e-9) { best = ratio; bestT = t; ties = 1; }
      else if (near(ratio, best, 1e-9)) ties++;
    }
    // The grid steps by 0.01, so a tight grid point can sit just above 1.
    if (Math.abs(bestT - o[key]) < 0.01 && ties === 1 && best < 1 + 1e-3) minima++;
    else unique = false;
  }
  check(`each of the three side fractions has its unique tight spot at the orthic value (${minima}/3)`,
    minima === 3 && unique, `orthic t = ${JSON.stringify(o)}`);
}

/* ------------------------------------- 7. the obtuse caveat, honestly */

{
  const obtuse = withT({ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 200, y: 115 }, 0.4, 0.2, 0.3);
  const g = C.compute(obtuse);
  // The projection of an altitude foot onto its side, before the applet's
  // RestrictToSegment clamps it to the segment.
  const raw = (foot, m2, m1) => {
    const d = C.sub(m1, m2);
    return C.dot(C.sub(foot, m2), d) / C.dot(d, d);
  };
  const tP = raw(g.Ha, obtuse.B, obtuse.C);
  const tQ = raw(g.Hb, obtuse.C, obtuse.A);
  check("in an obtuse triangle at least one altitude foot is outside its side",
    tP < 0 || tP > 1 || tQ < 0 || tQ > 1, `raw t = ${tP}, ${tQ}`);
  const clamped = C.compute(C.orthicState(obtuse));
  check("the bound is strict there, so no inscribed triangle attains equality",
    clamped.ratio > 1.1, `ratio ${clamped.ratio}`);
  const s = C.start();
  check("this illustration never has a win, loss or done state",
    C.result(s) === null && C.result(C.orthicState(s)) === null && C.result(obtuse) === null);
  const restored = JSON.parse(JSON.stringify(C.orthicState(s)));
  check("the position is plain data and survives a JSON round trip",
    near(C.compute(restored).ratio, C.compute(C.orthicState(s)).ratio));
}

/* ---------------------- 8. the area step the page's proof really needs */

{
  // Area(OPCQ) = (h+g)*OC/2 <= PQ*OC/2 needs P and Q on opposite sides of
  // the radius OC. That is true when O is inside an acute ABC, and false in
  // many obtuse configurations, where the page's written proof breaks down
  // even though the final perimeter bound survived every sampled case.
  const rnd = rng(31415);
  let acuteCases = 0, acuteFailures = 0, obtuseCases = 0, obtuseFailures = 0;
  const perQuadError = (f) => {
    const quads = [
      [f.O, f.P, f.C, f.Q, f.P, f.Q],
      [f.O, f.Q, f.A, f.R, f.Q, f.R],
      [f.O, f.R, f.B, f.P, f.R, f.P],
    ];
    let worst = 0;
    for (const [O, p, v, q, P, Q] of quads) {
      const d = C.sub(v, O), length = C.len(d);
      const h = Math.abs(C.cross(C.sub(p, O), d)) / length;
      const g = Math.abs(C.cross(C.sub(q, O), d)) / length;
      worst = Math.max(worst, h + g - C.dist(P, Q));
    }
    return worst;
  };
  for (let i = 0; i < 6000; i++) {
    const A = { x: 30 + rnd() * 340, y: 15 + rnd() * 195 };
    const B = { x: 20 + rnd() * 130, y: 150 + rnd() * 80 };
    const Cc = { x: 250 + rnd() * 130, y: 145 + rnd() * 85 };
    const s = withT(A, B, Cc, rnd(), rnd(), rnd());
    const f = C.compute(s);
    if (!C.finite(f.O) || !Number.isFinite(f.ratio) || f.r < 10) continue;
    if (C.acute(s)) { acuteCases++; if (perQuadError(f) > 1e-7) acuteFailures++; }
    else { obtuseCases++; if (perQuadError(f) > 1e-7) obtuseFailures++; }
  }
  check("the area-step comparison had enough acute and obtuse cases",
    acuteCases > 500 && obtuseCases > 2000, `${acuteCases}, ${obtuseCases}`);
  check(`acute: each quadrilateral area is at most side x OC/2 (${acuteFailures} failures)`, acuteFailures === 0);
  check(`obtuse: that intermediate area step really can fail (${obtuseFailures} cases)`, obtuseFailures > 0);
}

done("fagnano-iv");
