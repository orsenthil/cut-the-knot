#!/usr/bin/env node
"use strict";

/*
 * Logic test for auxetic-tessellation/auxetic-tessellation-core.js.
 *
 * What is checked:
 *
 *   1. The opening points and every option range are the applet's own: the
 *      page embeds it with startLayer=1 and Loose=1, the panel has two scroll
 *      bars 0..21 (divided by ten) and a spinner 1..25.
 *   2. The four tiles really are rectangles, with side ratios alpha and
 *      gamma, for every one of the 22x22 option pairs and many random hinges.
 *      That is the page's "rigid, rotating subunits" claim.
 *   3. The translation vectors obey v02 = (v01+v03)/2 and
 *      v13 = (v01-v03)/2, so the four-tile ring repeats without gaps; the
 *      lattice cell has the area derived from the construction, and the
 *      covered fraction is below one.
 *   4. The auxetic claim: opening the hinge from a narrow rhombus toward a
 *      square makes the cell grow and the density fall for EVERY option pair
 *      and every angle tested. For alpha = gamma the two lattice spacings
 *      both grow; the test also records where unequal ratios break that
 *      stronger form, so the page's wording can be qualified honestly.
 *   5. A second transcription of Compute()/AddLayer(), written straight from
 *      javap output, agrees with the core over the whole option grid, over
 *      random hinges and over all 25 layers.
 *   6. The fixed-hinge constraints, the stretch control and degenerate inputs.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("auxetic-tessellation/auxetic-tessellation-core.js", "AuxeticTessellationCore");

const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const pointNear = (a, b, eps) => near(a.x, b.x, eps) && near(a.y, b.y, eps);

/* ------------------------------------------- 1. the opening and the options */

{
  const s = C.start();
  equal("the page's startLayer is 1", s.layers, 1);
  equal("the page sets Loose=1", s.loose, true);
  equal("the applet's Alpha slider starts at 5, i.e. 0.5", s.alpha, 0.5);
  equal("the applet's Gamma slider starts at 4, i.e. 0.4", s.gamma, 0.4);
  const radius = Math.min(s.width / 2, s.height / 2) - 15;
  check("B is at angle 0 on the applet's circle", pointNear(s.B, { x: s.width / 2 + radius, y: s.height / 2 }));
  check("A is at 5*pi/4", pointNear(s.A, {
    x: s.width / 2 + radius * Math.cos((5 * Math.PI) / 4),
    y: s.height / 2 + radius * Math.sin((5 * Math.PI) / 4),
  }));
  check("C is at -5*pi/4", pointNear(s.C, {
    x: s.width / 2 + radius * Math.cos((-5 * Math.PI) / 4),
    y: s.height / 2 + radius * Math.sin((-5 * Math.PI) / 4),
  }));
  check("D completes the parallelogram", pointNear(C.fourth(s.A, s.B, s.C), {
    x: s.A.x + s.C.x - s.B.x, y: s.A.y + s.C.y - s.B.y,
  }));

  equal("the alpha slider stops at 0", C.withOption(s, "alpha", -3).alpha, 0);
  equal("the alpha slider stops at 2.1", C.withOption(s, "alpha", 9).alpha, 2.1);
  equal("the gamma slider stops at 0", C.withOption(s, "gamma", -3).gamma, 0);
  equal("the gamma slider stops at 2.1", C.withOption(s, "gamma", 9).gamma, 2.1);
  equal("the layer spinner stops at 25", C.withOption(s, "layers", 99).layers, 25);
  equal("the layer spinner stops at 1", C.withOption(s, "layers", -4).layers, 1);
  equal("slider steps are a tenth", C.LIMITS.alpha.step, 0.1);
  equal("colour radio starts on One color", C.withOption(s, "colorLayers", false).colorLayers, false);
}

/* ------------------------------- 2+3. rectangles, lattice and density, exhaustively */

const ALPHAS = Array.from({ length: 22 }, (_, i) => i / 10);
const GAMMAS = ALPHAS;
const random = rng(20261126);
const randomHinge = () => ({
  A: { x: -80 + random() * 160, y: -80 + random() * 160 },
  B: { x: -80 + random() * 160, y: -80 + random() * 160 },
  C: { x: -80 + random() * 160, y: -80 + random() * 160 },
});
const hingeFromAngle = (theta, s = 2) => ({
  A: { x: 0, y: -s * Math.sin(theta) },
  B: { x: s * Math.cos(theta), y: 0 },
  C: { x: 0, y: s * Math.sin(theta) },
});

{
  let badRect = 0, badRatio = 0, badVector = 0, badArea = 0, badDensity = 0, cases = 0;
  for (const alpha of ALPHAS) {
    for (const gamma of GAMMAS) {
      for (let i = 0; i < 12; i++) {
        const h = randomHinge();
        const st = Object.assign(h, { alpha, gamma, layers: 1 });
        const m = C.lattice(st);
        cases++;
        for (let k = 0; k < 4; k++) {
          const r = m.base[k];
          const e0 = C.sub(r.V[1], r.V[0]);
          const e3 = C.sub(r.V[3], r.V[0]);
          const e1 = C.sub(r.V[2], r.V[1]);
          const e2 = C.sub(r.V[3], r.V[2]);
          if (!near(C.dot(e0, e3), 0, 1e-7)) badRect++;                    // right angle
          if (!near(C.dist(r.V[0], r.V[1]), C.dist(r.V[2], r.V[3]))) badRect++;
          if (!near(C.dist(r.V[0], r.V[3]), C.dist(r.V[1], r.V[2]))) badRect++;
          if (!near(C.cross(e0, e1), C.cross(e3, e2))) badRect++;            // opposite sides parallel
          const ratio = k % 2 === 0 ? alpha : gamma;
          const side = C.dist(r.V[0], r.V[1]);
          if (side > 1 && !near(C.dist(r.V[0], r.V[3]) / side, ratio, 1e-7)) badRatio++;
        }
        if (!pointNear(C.mul(C.add(m.v01, m.v03), 0.5), m.v02)) badVector++;
        if (!pointNear(C.mul(C.sub(m.v01, m.v03), 0.5), m.v13)) badVector++;
        const formula = 2 * Math.abs(m.cross) * (1 + alpha * gamma) + m.covered;
        if (!near(m.cellArea, formula, 1e-7)) badArea++;
        if (!(m.density >= 0 && m.density < 1)) badDensity++;
      }
    }
  }
  check(`${cases} option pairs x random hinges: every tile is a rectangle`, badRect === 0, String(badRect));
  check(`${cases} cases: short sides have ratio alpha / gamma exactly`, badRatio === 0, String(badRatio));
  check(`${cases} cases: the four-tile ring repeats on a lattice`, badVector === 0, String(badVector));
  check(`${cases} cases: cell area = covered + 2|cross|(1+alpha*gamma)`, badArea === 0, String(badArea));
  check(`${cases} cases: the tiles cover less than the whole plane`, badDensity === 0, String(badDensity));

  // The unequal ratios are not just a drawing trick: alpha=gamma is a square
  // pair, alpha!=gamma gives two genuinely different rectangle shapes.
  const uneven = C.lattice({ ...C.start(), alpha: 2.1, gamma: 0.5 });
  const aRatio = C.dist(uneven.base[0].V[0], uneven.base[0].V[3]) /
    C.dist(uneven.base[0].V[0], uneven.base[0].V[1]);
  const gRatio = C.dist(uneven.base[1].V[0], uneven.base[1].V[3]) /
    C.dist(uneven.base[1].V[0], uneven.base[1].V[1]);
  check("alpha != gamma really gives differently shaped rectangles", near(aRatio, 2.1) && near(gRatio, 0.5));

  // Zero slider values collapse a pair of rectangles but never produce NaN.
  const flat = C.lattice({ ...C.start(), alpha: 0, gamma: 0 });
  check("zero ratios give finite vertices", flat.base.every((r) => r.V.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))));
  equal("a collapsed pair covers no area", flat.covered, 0);
}

/* -------------------------------------- 4. the auxetic claim, over every option */

{
  let badArea = 0, badDensity = 0, badSquare = 0, cases = 0;
  let strongerHolds = 0, strongerFails = 0;
  for (const alpha of ALPHAS) {
    for (const gamma of GAMMAS) {
      let prevArea = -1, prevDensity = 2;
      let prevS01 = -1, prevS03 = -1;
      for (let deg = 5; deg <= 45; deg++) {
        const st = Object.assign(hingeFromAngle((deg * Math.PI) / 180), { alpha, gamma });
        const m = C.lattice(st);
        cases++;
        if (m.cellArea <= prevArea + 1e-9) badArea++;
        if (m.covered > 0 ? m.density >= prevDensity - 1e-11 : m.density !== 0) badDensity++;
        if (alpha === 1 && gamma === 1) {
          if (m.spacing01 < prevS01 - 1e-9 || m.spacing03 < prevS03 - 1e-9) badSquare++;
          if (m.spacing01 > prevS01 && m.spacing03 > prevS03) strongerHolds++;
          else strongerFails++;
        }
        prevArea = m.cellArea;
        prevDensity = m.density;
        prevS01 = m.spacing01;
        prevS03 = m.spacing03;
      }
    }
  }
  check(`${cases} option/angle cases: opening the hinge always grows the cell`, badArea === 0, String(badArea));
  check(`${cases} cases: opening the hinge always lowers the density`, badDensity === 0, String(badDensity));
  check("dancing squares (alpha = gamma = 1): both lattice spacings grow over 5..45 degrees", badSquare === 0, String(badSquare));
  check("dancing-squares cases counted", strongerHolds === 41 && strongerFails === 0,
    `${strongerHolds} growing, ${strongerFails} not`);

  // The page's own starting sliders (0.5, 0.4) do show a growing transverse
  // spacing, although the spacing along the other lattice vector turns back.
  let badDefault = 0, turnedBack = 0, prevDefault = -1, prevOther = -1;
  for (let deg = 5; deg <= 45; deg++) {
    const m = C.lattice(Object.assign(hingeFromAngle((deg * Math.PI) / 180), { alpha: 0.5, gamma: 0.4 }));
    if (m.spacing03 <= prevDefault) badDefault++;
    if (prevOther >= 0 && m.spacing01 < prevOther - 1e-6) turnedBack++;
    prevDefault = m.spacing03;
    prevOther = m.spacing01;
  }
  check("the default sliders grow the transverse spacing at every angle", badDefault === 0, String(badDefault));
  check("but the other direction does turn back even at the defaults", turnedBack > 0, String(turnedBack));

  // An unequal ratio can make one spacing turn around near 45 degrees. This
  // is why the page's "grows thicker" is stated with care on the port page.
  let foundCounterexample = false;
  for (const alpha of ALPHAS) {
    for (const gamma of GAMMAS) {
      if (alpha === gamma) continue;
      let prev = -1;
      for (let deg = 5; deg <= 45; deg++) {
        const m = C.lattice(Object.assign(hingeFromAngle((deg * Math.PI) / 180), { alpha, gamma }));
        if (prev >= 0 && m.spacing03 < prev - 1e-6) foundCounterexample = true;
        prev = m.spacing03;
      }
      if (foundCounterexample) break;
    }
    if (foundCounterexample) break;
  }
  check("the page's blanket 'thicker in every direction' has a real counterexample", foundCounterexample);

  // The starting page is in the expanding regime.
  const s = C.start();
  const open = C.openHinge(s, 5);
  const before = C.lattice(s), after = C.lattice(open);
  check("the Stretch control opens the cell", after.cellArea > before.cellArea);
  check("and lowers the density", after.density < before.density);
  check("the Stretch control keeps the hinge side length",
    near(C.dist(open.A, open.B), C.dist(s.A, s.B)) && near(C.dist(open.B, open.C), C.dist(s.B, s.C)));
}

/* -------------------------------------------- 5. a literal second transcription */

/*
 * Written again from `javap -c -p` of AuxeticTessellationCanvas and its
 * Rectangle inner class, without calling any core helper.
 */
const A2 = {
  P: (x, y) => ({ x, y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  mul: (a, k) => ({ x: a.x * k, y: a.y * k }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  dist: (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)),
};
function orientation2(a, b, c) {
  // GeoSDoub.FindOrientation: C.x*(A.y-B.y) + C.y*(B.x-A.x) + A.x*B.y - B.x*A.y
  const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return v > 0 ? 1 : -1;
}
function rotate2(p, q, angle, sign) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return A2.P(p.x + co * (q.x - p.x) - sign * si * (q.y - p.y),
    p.y + sign * si * (q.x - p.x) + co * (q.y - p.y));
}
function prorate2(p, q, t) {
  const d = A2.dist(p, q);
  if (d < 0.1) return A2.P(p.x, p.y);
  const k = t / d;
  return A2.P(p.x + k * (q.x - p.x), p.y + k * (q.y - p.y));
}
function addRectangle2(a, b, c, factor, layer) {
  const o = orientation2(a, b, c);
  const p = rotate2(a, b, 1.5707963267948966, -o);
  const q = rotate2(b, a, 1.5707963267948966, o);
  const u = prorate2(a, p, A2.dist(a, p) * factor);
  const v = prorate2(b, q, A2.dist(b, q) * factor);
  return { V: [A2.P(a.x, a.y), A2.P(b.x, b.y), v, u], layer };
}
function translate2(r, v, k) {
  return { V: r.V.map((p) => A2.add(p, A2.mul(v, k))), layer: r.layer };
}
function compute2(A0, B0, C0, alpha, gamma) {
  const D = A2.P(C0.x + A0.x - B0.x, C0.y + A0.y - B0.y);
  const R = [
    addRectangle2(A0, B0, C0, alpha, 0),
    addRectangle2(B0, C0, D, gamma, 0),
    addRectangle2(C0, D, A0, alpha, 0),
    addRectangle2(D, A0, B0, gamma, 0),
  ];
  // The four `new DoubPoint(...)` instructions in Compute().
  const v01 = A2.sub(R[0].V[3], R[1].V[2]);
  const v02 = A2.sub(R[0].V[0], R[2].V[2]);
  const v03 = A2.sub(R[0].V[2], R[3].V[3]);
  const v13 = A2.sub(R[3].V[0], R[1].V[2]);
  const L = [R];
  const L2 = [
    translate2(R[3], v03, 1), translate2(R[2], v03, 1),
    translate2(R[0], v01, -1), translate2(R[1], v02, -1),
    translate2(R[2], v03, -1), translate2(R[3], v03, -1),
    translate2(R[1], v03, -1),
  ];
  L2.push(translate2(L2[5], v01, 1));
  L2.push(translate2(L2[6], v01, 1));
  L2.push(translate2(R[2], v01, 1));
  L2.push(translate2(L2[8], v03, 1));
  L2.push(translate2(L2[9], v03, 1));
  for (const r of L2) r.layer = 2;
  L.push(L2);
  let cur = L2, prev = R;
  for (let i = 0; i < 23; i++) {
    const out = new Array(cur.length + 8);
    const m = Math.floor(cur.length / 4) + 1;
    let k = 0;
    out[k++] = translate2(cur[cur.length - 2], v03, 1);
    out[k++] = translate2(i === 0 ? prev[0] : prev[prev.length - 1], v03, 1);
    for (let t = 0; t < m - 1; t++) out[k++] = translate2(out[t], v01, -1);
    let j = k;
    out[k++] = translate2(out[j - 2], v02, -1);
    for (let t = 0; t < m; t++) out[k++] = translate2(out[j - 2], v03, -1);
    j = k;
    out[k++] = translate2(out[j - 2], v13, 1);
    for (let t = 0; t < m; t++) out[k++] = translate2(out[j - 2], v01, 1);
    j = k;
    out[k++] = translate2(out[j - 2], v02, 1);
    for (let t = 0; t < m; t++) out[k++] = translate2(out[j - 2], v03, 1);
    for (const r of out) if (r) r.layer = 3 + i;
    L.push(out);
    prev = cur;
    cur = out;
  }
  return { D, R, v01, v02, v03, v13, layers: L };
}
function compareLayers(label, core, transcribed, eps = 1e-9) {
  let bad = 0;
  if (core.layers.length !== transcribed.layers.length) return 1;
  for (let i = 0; i < core.layers.length; i++) {
    const a = core.layers[i], b = transcribed.layers[i];
    if (a.length !== b.length) { bad++; continue; }
    for (let k = 0; k < a.length; k++) {
      if (a[k].layer !== b[k].layer) bad++;
      for (let v = 0; v < 4; v++) if (!pointNear(a[k].V[v], b[k].V[v], eps)) bad++;
    }
  }
  return bad;
}

{
  // Complete option grid, random hinges: the four-tile ring and its vectors.
  let bad = 0, cases = 0;
  for (const alpha of ALPHAS) {
    for (const gamma of GAMMAS) {
      for (let i = 0; i < 4; i++) {
        const h = randomHinge();
        const st = Object.assign(h, { alpha, gamma });
        const m = C.lattice(st);
        const ref = compute2(h.A, h.B, h.C, alpha, gamma);
        cases++;
        if (!pointNear(m.D, ref.D)) bad++;
        if (!pointNear(m.v01, ref.v01) || !pointNear(m.v02, ref.v02) ||
            !pointNear(m.v03, ref.v03) || !pointNear(m.v13, ref.v13)) bad++;
        for (let k = 0; k < 4; k++) {
          for (let v = 0; v < 4; v++) if (!pointNear(m.base[k].V[v], ref.R[k].V[v])) bad++;
        }
      }
    }
  }
  check(`${cases} option pairs x hinges: lattice matches a literal recomputation`, bad === 0, String(bad));

  // Every layer, including all 23 AddLayer calls, on a spread of options.
  let badLayers = 0, layerCases = 0;
  const samples = [
    [0.5, 0.4], [0, 0], [2.1, 2.1], [2.1, 0], [0, 2.1], [1, 1], [1.3, 0.7], [0.9, 2.0],
  ];
  for (const [alpha, gamma] of samples) {
    for (let i = 0; i < 4; i++) {
      const h = randomHinge();
      const ref = compute2(h.A, h.B, h.C, alpha, gamma);
      const core = C.tessellate(Object.assign(h, { alpha, gamma }));
      layerCases++;
      badLayers += compareLayers(`alpha=${alpha} gamma=${gamma}`, core, ref);
    }
  }
  check(`${layerCases} configurations: all 25 layers match the bytecode`, badLayers === 0, String(badLayers));

  const t = C.tessellate(C.start());
  equal("there are 25 layers, as the spinner's range says", t.layers.length, 25);
  equal("the first layer is the four-tile ring", t.layers[0].length, 4);
  equal("the second layer has twelve tiles", t.layers[1].length, 12);
  equal("the last layer has 196 tiles", t.layers[24].length, 196);
  check("one tile of every layer is a translate of a base rectangle", t.layers.slice(1).every((layer) =>
    layer.every((r) => t.base.some((b) => near(C.dist(r.V[0], r.V[1]), C.dist(b.V[0], b.V[1])) &&
      near(C.dist(r.V[0], r.V[3]), C.dist(b.V[0], b.V[3]))))));
}

/* ------------------------------------- 6. constraints, stretch, degeneracies */

{
  const s = C.start();
  const locked = Object.assign({}, s, { loose: false });
  const p = { x: s.A.x + 37, y: s.A.y - 21 };
  const movedA = C.withPoint(locked, "A", C.constrainPoint(locked, "A", p));
  check("locked A stays on the circle about B of radius BC",
    near(C.dist(movedA.A, locked.B), C.dist(locked.B, locked.C)));
  const movedC = C.withPoint(locked, "C", C.constrainPoint(locked, "C", p));
  check("locked C stays on the circle about B of radius BA",
    near(C.dist(movedC.C, locked.B), C.dist(locked.B, locked.A)));
  const movedB = C.withPoint(locked, "B", C.constrainPoint(locked, "B", p));
  const mid = C.mul(C.add(locked.A, locked.C), 0.5);
  check("locked B stays on the perpendicular bisector of AC",
    near(C.dot(C.sub(movedB.B, mid), C.sub(locked.C, locked.A)), 0));
  check("Loose=1 leaves the points alone", pointNear(C.constrainPoint(s, "A", p), p));

  const st = { ...s, loose: false };
  let badLength = 0;
  for (let d = 1; d <= 12; d++) {
    const o = C.openHinge(st, d);
    if (!near(C.dist(o.A, o.B), C.dist(st.A, st.B)) || !near(C.dist(o.B, o.C), C.dist(st.B, st.C))) badLength++;
  }
  equal("stretching never changes a locked hinge side", badLength, 0);
  equal("over-stretching stays inside the rhombus", C.openHinge(st, 1000).A.y < C.openHinge(st, 1000).C.y, true);

  const degenerate = [
    { A: { x: 0, y: 0 }, B: { x: 0, y: 0 }, C: { x: 0, y: 0 } },
    { A: { x: 0, y: 0 }, B: { x: 5, y: 0 }, C: { x: 10, y: 0 } },
  ];
  for (const h of degenerate) {
    const m = C.lattice(Object.assign(h, { alpha: 1, gamma: 1 }));
    check("a collapsed hinge still gives finite numbers",
      m.base.every((r) => r.V.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) &&
      Number.isFinite(m.cellArea));
  }
}

done("auxetic-tessellation");
