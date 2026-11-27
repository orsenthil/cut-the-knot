#!/usr/bin/env node
"use strict";

/*
 * Logic test for eppstein/eppstein-core.js.
 *
 *   node porting/check-eppstein.mjs
 *
 * The exact claim on the cut-the-knot page is that the three lines through
 * opposite points of tangency of four mutually tangent circles are concurrent
 * (both for the inner and the outer Soddy circle), with the common point
 * M = sum(k_i O_i) / sum(k_i), signed curvature k_i = 1/R_i. The page also
 * states Descartes' bend formula, R_A = s - a for the vertex circles, the
 * Gergonne point formula, and that the inner Soddy centre, M and Ge are
 * collinear. All are checked over a grid and 2,000 pseudo-random triangles.
 *
 * Section 3 is a second, independent transcription of the applet's own
 * ApolloniusCircle.SetCircles/Compute and EppsteinCanvas.Draw/GetLine/Tangent
 * bytecode. It is compared with the core on every configuration above.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("eppstein/eppstein-core.js", "EppsteinCore");

const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const nearPoint = (p, q, tol = 1e-7) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const hyp = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const distanceToLine = (p, a, b) => {
  const len = hyp(a, b);
  return len < 1e-9 ? Infinity : Math.abs(cross(a, b, p)) / len;
};

/* ------------------------------------------------------------------
 * A second transcription of the applet's bytecode, independent of the core.
 * ------------------------------------------------------------------ */

const Applet = (() => {
  const Ci = new Array(3);
  let A1, A2, B1, B2, D1, D2, K, G, I, o;

  function CInfo(c) {
    return c.x * c.x + c.y * c.y - c.r * c.r;
  }

  // ApolloniusCircle.SetCircles: fields and static scratch values in order.
  function SetCircles(c0, c1, c2) {
    Ci[0] = c0; Ci[1] = c1; Ci[2] = c2;
    A1 = 2 * (c1.x - c0.x);
    A2 = 2 * (c2.x - c0.x);
    B1 = 2 * (c1.y - c0.y);
    B2 = 2 * (c2.y - c0.y);
    o = CInfo(c0);
    D1 = o - CInfo(c1);
    D2 = o - CInfo(c2);
    K = A1 * B2 - A2 * B1;
    G = (B1 * D2 - B2 * D1) / K;
    I = -(A1 * D2 - A2 * D1) / K;
  }

  // ApolloniusCircle.Compute(e0, e1, e2), including its early null guards.
  function Compute(e0, e1, e2) {
    if (Math.abs(K) < 0.01) return null; // TreatZeroDeterminant returns null
    const local3 = 2 * (e0 * Ci[0].r - e1 * Ci[1].r);
    const local5 = 2 * (e0 * Ci[0].r - e2 * Ci[2].r);
    const local7 = (B1 * local5 - B2 * local3) / K;
    const local9 = -(A1 * local5 - A2 * local3) / K;
    const local11 = local7 * local7 + local9 * local9 - 1;
    if (Math.abs(local11) < 0.001) return null;
    const local13 = 2 * (local7 * G + local9 * I
      - local7 * Ci[0].x - local9 * Ci[0].y + e0 * Ci[0].r);
    const local15 = G * G + I * I - 2 * G * Ci[0].x - 2 * I * Ci[0].y + o;
    let local17 = local13 * local13 - 4 * local11 * local15;
    if (local17 < 0) return null;
    local17 = Math.sqrt(local17);
    const answers = [];
    let local19 = (-local13 + local17) / 2 / local11;
    answers.push({
      x: local7 * local19 + G,
      y: local9 * local19 + I,
      r: local19 < 0 ? -local19 : local19,
    });
    local19 = (-local13 - local17) / 2 / local11;
    answers.push({
      x: local7 * local19 + G,
      y: local9 * local19 + I,
      r: local19 < 0 ? -local19 : local19,
    });
    return answers;
  }

  // EppsteinCanvas.Tangent: the boolean selects the minus denominator.
  function Tangent(c1, c2, bool) {
    const r1 = c1.r, r2 = c2.r;
    if (bool) {
      return {
        x: (c1.x * r2 - c2.x * r1) / (r2 - r1),
        y: (c1.y * r2 - c2.y * r1) / (r2 - r1),
      };
    }
    return {
      x: (c1.x * r2 + c2.x * r1) / (r1 + r2),
      y: (c1.y * r2 + c2.y * r1) / (r1 + r2),
    };
  }

  // EppsteinCanvas.GetLine(c1, c2, c3, c4, bool).
  function GetLine(c1, c2, c3, c4, bool) {
    return { a: Tangent(c1, c2, bool), b: Tangent(c3, c4, false) };
  }

  // EppsteinCanvas.Draw: radii, Compute(1,1,1), index and the three lines.
  function Draw(A, Bc, Cc, innerCircle) {
    const a = hyp(Bc, Cc), b = hyp(A, Cc), c = hyp(A, Bc);
    const circles = [
      { x: A.x, y: A.y, r: (-a + b + c) / 2 },
      { x: Bc.x, y: Bc.y, r: (a - b + c) / 2 },
      { x: Cc.x, y: Cc.y, r: (a + b - c) / 2 },
    ];
    SetCircles(circles[0], circles[1], circles[2]);
    const sols = Compute(1, 1, 1);
    const index = innerCircle ? 0 : 1;
    if (!sols || !sols[index]) return null;
    const pick = sols[index];
    const bool = index === 1;
    return {
      circles: circles,
      sols: sols,
      index: index,
      pick: pick,
      lines: [
        GetLine(pick, circles[0], circles[1], circles[2], bool),
        GetLine(pick, circles[1], circles[0], circles[2], bool),
        GetLine(pick, circles[2], circles[1], circles[0], bool),
      ],
    };
  }

  return { SetCircles: SetCircles, Compute: Compute, Tangent: Tangent, GetLine: GetLine, Draw: Draw };
})();

/* ---------------------------------------------------- 1. the start position */

{
  equal("the applet's board size", [C.WIDTH, C.HEIGHT], [400, 300]);
  const s = C.start({});
  const scale = Math.min(s.width, s.height) / 5;
  for (const [name, angle] of [["A", -1.6], ["B", -4.0], ["C", -0.2]]) {
    check("start angle for " + name,
      near(s[name].x, 200 + scale * Math.cos(angle), 1e-9) &&
      near(s[name].y, 150 + scale * Math.sin(angle), 1e-9));
  }
  check("start uses the inner Soddy circle", s.inner === true);
  const other = C.start({ width: 360, height: 240 });
  check("the board size can be changed",
    other.width === 360 && other.height === 240 &&
    near(other.A.x, 180 + 48 * Math.cos(-1.6), 1e-9));
  const moved = C.setPoint(s, "A", { x: 10, y: 20 });
  check("setPoint is pure and only moves the named point",
    s.A.x !== 10 && moved.A.x === 10 && moved.B.x === s.B.x && moved.C.x === s.C.x);
  check("setPoint refuses an unknown name", C.setPoint(s, "D", { x: 0, y: 0 }) === s);
  check("reset keeps the board size", (() => {
    const r = C.reset(moved);
    return r.width === s.width && r.height === s.height && nearPoint(r.A, s.A);
  })());
  check("position is plain saveable data",
    JSON.stringify(C.position(s)) === JSON.stringify({
      A: s.A, B: s.B, C: s.C, inner: true,
    }));
}

/* --------------------------- 2. triangles, radii and the start geometry */

{
  const right = C.triplets({ A: { x: 0, y: 0 }, B: { x: 4, y: 0 }, C: { x: 0, y: 3 } });
  equal("sides of a 3-4-5 triangle", [right.a, right.b, right.c], [5, 3, 4]);
  equal("radii are s - a, s - b, s - c",
    [right.radii.A, right.radii.B, right.radii.C], [1, 3, 2]);
  const equilateral = C.triplets({
    A: { x: 0, y: 0 }, B: { x: 2, y: 0 }, C: { x: 1, y: Math.sqrt(3) },
  });
  check("an equilateral triangle gives three equal radii",
    near(equilateral.radii.A, equilateral.radii.B, 1e-9) &&
    near(equilateral.radii.B, equilateral.radii.C, 1e-9));
  const g = C.geometry(C.start({}));
  check("the start has a finite inner and outer Soddy circle",
    !!g && g.soddy.length === 2 && g.soddy.every((c) => c.r > 0 && Number.isFinite(c.x)));
  check("inner is solution 0, outer solution 1",
    g.soddy[0].r < g.soddy[1].r && g.index === 0);
  const outer = C.geometry(C.setInner(C.start({}), false));
  check("the toggle picks solution 1 and negates its curvature",
    outer.index === 1 && nearPoint(outer.S, g.soddy[1]) &&
    outer.curvatures[3] < 0 && g.curvatures[3] > 0);
  check("apollonius refuses a collinear triplet",
    C.apollonius([
      { x: 0, y: 0, r: 1 }, { x: 4, y: 0, r: 1 }, { x: 8, y: 0, r: 1 },
    ], 1, 1, 1) === null);
  check("tangent with flag 0 is the external contact point",
    nearPoint(C.tangent({ x: 0, y: 0, r: 2 }, { x: 6, y: 0, r: 4 }, false), { x: 2, y: 0 }));
  check("tangent with flag 1 is the internal weighted point",
    nearPoint(C.tangent({ x: 0, y: 0, r: 10 }, { x: 6, y: 0, r: 2 }, true), { x: 7.5, y: 0 }));
}

/* ------------------------- 3. every configuration against the applet  */

function* configurations() {
  for (const bx of [30, 90, 170, 250, 350]) {
    for (const by of [0, 70, 150, 250]) {
      for (const cx of [10, 110, 230, 330]) {
        for (const cy of [60, 170, 290]) {
          yield { A: { x: 200, y: 120 }, B: { x: bx, y: by }, C: { x: cx, y: cy } };
        }
      }
    }
  }
  const random = rng(20261127);
  for (let i = 0; i < 2000; i++) {
    yield {
      A: { x: random() * 400, y: random() * 300 },
      B: { x: random() * 400, y: random() * 300 },
      C: { x: random() * 400, y: random() * 300 },
    };
  }
}

const tally = {
  cases: 0, solved: 0, radii: 0, solutions: 0, lines: 0,
  descartes: 0, contact: 0, concurrent: 0, eppstein: 0, soddyGe: 0,
  gergonne: 0, touch: 0, degenerate: 0, externalOuter: 0,
};
let worst = { radii: 0, solutions: 0, lines: 0, concurrent: 0, collinear: 0, gergonne: 0 };

for (const p of configurations()) {
  const tri = C.triplets(p);
  if (!Number.isFinite(tri.radii.A) || Math.min(tri.radii.A, tri.radii.B, tri.radii.C) < 0.5) {
    tally.degenerate++;
    continue;
  }
  tally.cases++;
  const coreSols = C.apollonius(tri.circles, 1, 1, 1);
  Applet.SetCircles(tri.circles[0], tri.circles[1], tri.circles[2]);
  const refSols = Applet.Compute(1, 1, 1);
  if (!coreSols || !refSols) {
    // Both transcriptions must refuse the same configuration.
    if (!!coreSols !== !!refSols) throw new Error("apollonius guard mismatch");
    continue;
  }
  tally.solved++;

  for (let i = 0; i < 3; i++) {
    const err = Math.abs(tri.circles[i].r - tri.radii[["A", "B", "C"][i]]);
    worst.radii = Math.max(worst.radii, err);
    if (err < 1e-9) tally.radii++;
  }

  for (let i = 0; i < 2; i++) {
    const a = coreSols[i], b = refSols[i];
    const err = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.r - b.r), Math.abs(a.t * (a.t < 0 ? -1 : 1) - b.r));
    worst.solutions = Math.max(worst.solutions, err);
    if (err < 1e-6 * Math.max(1, Math.abs(b.x), Math.abs(b.y), b.r)) tally.solutions++;
  }

  // Descartes' bend formula: k4 = k1+k2+k3 +/- 2 sqrt(k1k2+k2k3+k3k1).
  const k = tri.circles.map((c) => 1 / c.r);
  const root = Math.sqrt(k[0] * k[1] + k[1] * k[2] + k[2] * k[0]);
  const bendMinus = k[0] + k[1] + k[2] - 2 * root;
  if (bendMinus > 0) tally.externalOuter++;
  for (let i = 0; i < 2; i++) {
    // Descartes' two bends are k1+k2+k3 +/- 2*sqrt(...); a negative bend
    // means an enclosing circle, and the radius is the reciprocal of |bend|.
    const predicted = Math.abs(k[0] + k[1] + k[2] + (i === 0 ? 2 : -2) * root);
    if (near(1 / coreSols[i].r, predicted, 1e-8 * Math.max(1, predicted))) tally.descartes++;
  }

  // Both circles really touch all three. When Descartes' smaller bend is
  // positive (an obtuse triangle) the second solution touches the three
  // circles externally, not internally as the page's sentence says.
  for (let i = 0; i < 2; i++) {
    let ok = true;
    for (let j = 0; j < 3; j++) {
      const d = hyp(coreSols[i], tri.circles[j]);
      const want = coreSols[i].t < 0
        ? coreSols[i].r + tri.circles[j].r
        : Math.abs(coreSols[i].r - tri.circles[j].r);
      ok = ok && near(d, want, 1e-7 * Math.max(1, want));
    }
    if (ok) tally.contact += 3;
  }

  // Tangent, GetLine and the weighted centre, for both mode settings.
  for (const inner of [true, false]) {
    const state = { ...p, inner: inner };
    const geom = C.geometry(state);
    const ref = Applet.Draw(p.A, p.B, p.C, inner);
    if (!geom || !ref) continue;
    if (geom.index !== ref.index) continue;
    for (let i = 0; i < 3; i++) {
      const want = ref.lines[i];
      const err = Math.max(
        hyp(geom.lines[i].a, want.a), hyp(geom.lines[i].b, want.b),
      );
      worst.lines = Math.max(worst.lines, err);
      if (err < 1e-6 * Math.max(1, Math.abs(want.a.x), Math.abs(want.b.y))) tally.lines++;
    }

    // Every line passes through M, and the lines meet at M (Eppstein point).
    let conc = 0;
    for (const line of geom.lines) conc = Math.max(conc, distanceToLine(geom.M, line.a, line.b));
    worst.concurrent = Math.max(worst.concurrent, conc);
    if (conc < 1e-6 * Math.max(1, Math.abs(geom.M.x), Math.abs(geom.M.y))) tally.concurrent++;
    if (nearPoint(geom.eppstein, geom.M, 1e-6 * Math.max(1, Math.abs(geom.M.x)))) tally.eppstein++;

    // S, M and Ge are collinear -- the page's Eppstein/Gergonne theorem.
    const col = distanceToLine(geom.S, geom.Ge, geom.M);
    worst.collinear = Math.max(worst.collinear, col);
    if (col < 1e-6 * Math.max(1, Math.abs(geom.M.x), Math.abs(geom.S.x))) tally.soddyGe++;

    // Gergonne: A-t_BC, B-t_CA, C-t_AB concur at Ge.
    const cevians = [
      [p.A, geom.tangencies.BC], [p.B, geom.tangencies.CA], [p.C, geom.tangencies.AB],
    ];
    const gerr = Math.max(...cevians.map((l) => distanceToLine(geom.Ge, l[0], l[1])));
    worst.gergonne = Math.max(worst.gergonne, gerr);
    if (gerr < 1e-6 * Math.max(1, Math.abs(geom.Ge.x), Math.abs(geom.Ge.y))) tally.gergonne++;

    // A vertex circle touches its two neighbours where their incircle does.
    const t = geom.tangencies;
    if (near(hyp(p.A, t.AB), tri.radii.A, 1e-7) &&
        near(hyp(p.A, t.CA), tri.radii.A, 1e-7) &&
        near(hyp(p.B, t.AB), tri.radii.B, 1e-7) &&
        near(hyp(p.B, t.BC), tri.radii.B, 1e-7) &&
        near(hyp(p.C, t.BC), tri.radii.C, 1e-7) &&
        near(hyp(p.C, t.CA), tri.radii.C, 1e-7)) tally.touch += 6;
  }
}

check("the grid and random triangles were exercised", tally.cases > 1500, `${tally.cases} cases`);
check("skinny/collinear cases skipped", tally.degenerate > 0);
check("radii equal s - a, s - b, s - c everywhere", tally.radii === 3 * tally.solved);
check("core matches the Apollonius bytecode on both circles", tally.solutions === 2 * tally.solved);
check("Descartes' formula gives both bends", tally.descartes === 2 * tally.solved);
check("both circles touch all three triplet circles", tally.contact === 6 * tally.solved);
check("Tangent/GetLine match the applet in both modes", tally.lines === 6 * tally.solved);
check("the three lines concur in both modes", tally.concurrent === 2 * tally.solved);
check("the Eppstein point is M in both modes", tally.eppstein === 2 * tally.solved);
check("S, M and Ge are collinear in both modes", tally.soddyGe === 2 * tally.solved);
check("the vertex tangencies are the incircle touch points", tally.touch === 12 * tally.solved);
check("the Gergonne cevians concur", tally.gergonne === 2 * tally.solved);
check("the page's 'one circle touches internally' is not universal",
  tally.externalOuter > 0 && tally.externalOuter < tally.solved,
  `${tally.externalOuter} of ${tally.solved} triangles have two external Soddy circles`);
check("errors stayed at floating-point scale",
  worst.radii < 1e-8 && worst.solutions < 1e-6 && worst.lines < 1e-6 &&
  worst.concurrent < 1e-6 && worst.collinear < 1e-6 && worst.gergonne < 1e-6,
  JSON.stringify(worst));

/* ------------------------------------------- 4. degenerate and edge cases */

{
  const flat = C.geometry({
    A: { x: 0, y: 0 }, B: { x: 5, y: 0 }, C: { x: 10, y: 0 }, inner: true,
  });
  check("a flat triangle has no picture", flat === null);
  const tiny = C.apollonius([
    { x: 0, y: 0, r: 1 }, { x: 1e-8, y: 0, r: 1 }, { x: 2e-8, y: 0, r: 1 },
  ], 1, 1, 1);
  check("the applet's near-zero determinant guard is kept", tiny === null);
  const g = C.geometry(C.start({}));
  check("the inner circle is the small one in the gap", g.S.r < 20 && g.curvatures[3] > 0);
  const outer = C.geometry(C.setInner(C.start({}), false));
  check("the outer circle encloses the three vertex circles",
    outer.S.r > 100 && outer.curvatures[3] < 0 &&
    [0, 1, 2].every((i) => near(hyp(outer.S, outer.circles[i]),
      outer.S.r - outer.circles[i].r, 1e-6)));
  check("swapping mode changes only the chosen circle",
    g.circles.length === outer.circles.length && g.index !== outer.index &&
    !nearPoint(g.S, outer.S));
}

done("eppstein");
