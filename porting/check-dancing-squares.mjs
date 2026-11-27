#!/usr/bin/env node
"use strict";

/*
 * Logic test for dancing-squares/dancing-squares-core.js.
 *
 * What is checked:
 *
 *   1. The opening points and the panel ranges come from the applet's own
 *      bytecode and the live page's <param> tags (startLayer=4, Loose absent
 *      on the first copy, Loose=1 on the second).
 *   2. A second, literal transcription of FindOrientation, Rotate,
 *      FourthPoint, AddSquare, AddSquare1, AddTwoSquares, AddLayer and
 *      AddLayer7 agrees with the core on every one of the 16 layers, for
 *      scores of random hinges and every hinge angle from 1 to 179 degrees.
 *   3. Every one of the 1024 tiles in a full tessellation is a genuine square
 *      of the hinge's side length, at every angle: the page's claim that the
 *      directly adjacent quadrilaterals stay square.
 *   4. The page's motion claim, over every angle: the repeat's cell area is
 *      exactly 2*s^2*(1+sin(theta)), so it grows from 2*s^2 at 0 degrees to
 *      4*s^2 at 90 degrees and falls back to 2*s^2 at 180 degrees; the covered
 *      fraction is 1/(1+sin(theta)), least at 90 degrees; the squares turn by
 *      theta/2, so the final grid is the original one turned 90 degrees. At
 *      90 degrees the two squares per cell sit at half-lattice offsets: a
 *      checkerboard. A wrong claim would fail here rather than be copied.
 *   5. The fixed-hinge constraints, the open/close control and degenerate
 *      inputs.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("dancing-squares/dancing-squares-core.js", "DancingSquaresCore");

const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const pointNear = (a, b, eps) => near(a.x, b.x, eps) && near(a.y, b.y, eps);
const frac = (x) => {
  let f = x - Math.floor(x + 1e-9);
  if (f > 0.999 || Math.abs(f) < 1e-9) f = 0;
  return f;
};

/* ------------------------------------------------- 1. the opening and options */

{
  const s = C.start();
  equal("the page embeds startLayer=4", s.layers, 4);
  equal("the first applet has no Loose parameter", s.loose, false);
  equal("the spinner stops at 15", C.withOption(s, "layers", 99).layers, 15);
  equal("the spinner stops at 0", C.withOption(s, "layers", -4).layers, 0);
  equal("the spinner step is one", C.LIMITS.layers.step, 1);
  equal("One color is selected to begin with", s.colorLayers, false);
  equal("Show names is off to begin with", s.showNames, false);
  const radius = Math.min(s.width / 3, s.height / 3) - 2 * 60;
  check("B sits at angle 0 on the applet's circle", pointNear(s.B, { x: s.width / 2 + radius, y: s.height / 2 }));
  check("A sits at 5*pi/4", pointNear(s.A, {
    x: s.width / 2 + radius * Math.cos(5 * Math.PI / 4),
    y: s.height / 2 + radius * Math.sin(5 * Math.PI / 4),
  }));
  check("C sits at -5*pi/4", pointNear(s.C, {
    x: s.width / 2 + radius * Math.cos(-5 * Math.PI / 4),
    y: s.height / 2 + radius * Math.sin(-5 * Math.PI / 4),
  }));
  check("D = A + C - B, as FourthPoint says", pointNear(C.fourth(s.A, s.B, s.C), {
    x: s.A.x + s.C.x - s.B.x, y: s.A.y + s.C.y - s.B.y,
  }));
  equal("the opening hinge angle is 45 degrees", Math.round(C.lattice(s).hingeAngle * 180 / Math.PI), 45);
  equal("there are sixteen computed layers", C.tessellate(s).layers.length, 16);
  equal("the first ring has four squares", C.tessellate(s).layers[0].length, 4);
  equal("the last ring has 8*15+4 squares", C.tessellate(s).layers[15].length, 124);
  equal("the second ring has twelve squares", C.tessellate(s).layers[1].length, 12);
  check("every computed layer is full, with no holes", C.tessellate(s).layers.every((l) => l.every(Boolean)));
}

/* --------------------------- 2. literal second transcription of the bytecode */

/*
 * Written a second time from `javap -c -p` of DancingSquaresCanvas,
 * DancingSquaresCanvas$Square and GeoSDoub, without calling a core helper.
 */
const T = {
  P: (x, y) => ({ x, y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  dist: (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)),
};
function orientation2(a, b, c) {
  // GeoSDoub.FindOrientation: C.x*(A.y-B.y) + C.y*(B.x-A.x) + A.x*B.y - B.x*A.y
  const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return v > 0 ? 1 : -1;
}
function rotate2(p, q, angle, sign) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return T.P(p.x + co * (q.x - p.x) - sign * si * (q.y - p.y),
    p.y + sign * si * (q.x - p.x) + co * (q.y - p.y));
}
function fourth2(a, b, c) {
  return T.P(c.x + a.x - b.x, c.y + a.y - b.y);
}
function square2(a, b, c, layer) {
  const o = orientation2(a, b, c);
  return { V: [T.P(a.x, a.y), T.P(b.x, b.y), rotate2(b, a, Math.PI / 2, o), rotate2(a, b, Math.PI / 2, -o)], layer };
}
function square12(a, b, c, layer) {
  const o = orientation2(b, a, c);
  return { V: [T.P(b.x, b.y), T.P(a.x, a.y), rotate2(a, b, Math.PI / 2, o), rotate2(b, a, Math.PI / 2, -o)], layer };
}
function addTwo2(a, b, c, layer) {
  const d = fourth2(a, b, c);
  return [square12(d, a, b, layer), square12(c, d, a, layer)];
}
function getLayer2(i, layers) {
  const k = 2 * layers - 1;
  return k * Math.floor(i / layers) + 2 * (i % layers);
}
function addLayer2(prev, layers, A) {
  const out = new Array(layers === 2 ? 6 : prev.length * 3);
  let pair = addTwo2(prev[0].V[2], prev[0].V[1], prev[1].V[3], layers);
  out[0] = pair[0];
  out[1] = pair[1];
  const limit = layers === 2 ? 2 : prev.length;
  for (let i = 1; i < limit; i++) {
    const next = addTwo2(prev[i].V[2], prev[i].V[1], prev[(i + 1) % prev.length].V[3], layers);
    const bridge = square2(next[0].V[3], pair[1].V[2], A, layers);
    if (layers !== 2) out[3 * (i - 1) + 2] = bridge;
    out[3 * i] = next[0];
    out[3 * i + 1] = next[1];
    pair = next;
  }
  if (layers !== 2) out[out.length - 1] = square12(out[10].V[2], out[0].V[3], A, 1);
  return out;
}
function addLayer72(prev, layers, A) {
  const out = new Array(8 * layers + 4);
  let count = 0;
  for (let i = 0; i < 4 * layers; i++) {
    const j = (getLayer2(i, layers) - 1 + prev.length) % prev.length;
    const k = (j + 1) % prev.length;
    const mirror = i % layers === 0 ? 0 : 2;
    const pair = addTwo2(prev[j].V[3], prev[j].V[mirror], prev[k].V[2], layers);
    out[2 * i + Math.floor(count / layers)] = pair[0];
    out[2 * i + 1 + Math.floor(count / layers)] = pair[1];
    count++;
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    const before = (i - 1 + out.length) % out.length;
    const after = (i + 1) % out.length;
    out[i] = square2(out[after].V[3], out[before].V[2], A, layers);
  }
  return out;
}
function compute2(A, B, C) {
  const D = fourth2(A, B, C);
  const base = [square2(A, B, C, 0), square2(B, C, D, 0), square2(C, D, A, 0), square2(D, A, B, 0)];
  const layers = [base];
  let cur = addLayer2(base, 1, A);
  layers.push(cur);
  for (let i = 2; i < 16; i++) {
    cur = addLayer72(cur, i, A);
    layers.push(cur);
  }
  return { D, layers };
}
function layerDifference(core, ref) {
  if (core.layers.length !== ref.layers.length) return 1;
  let bad = 0;
  for (let l = 0; l < core.layers.length; l++) {
    const a = core.layers[l], b = ref.layers[l];
    if (a.length !== b.length) { bad++; continue; }
    for (let k = 0; k < a.length; k++) {
      if (a[k].layer !== b[k].layer) bad++;
      for (let v = 0; v < 4; v++) if (!pointNear(a[k].V[v], b[k].V[v], 1e-9)) bad++;
    }
  }
  return bad;
}

const random = rng(20261127);
const randomHinge = () => ({
  A: { x: -120 + random() * 240, y: -120 + random() * 240 },
  B: { x: -120 + random() * 240, y: -120 + random() * 240 },
  C: { x: -120 + random() * 240, y: -120 + random() * 240 },
});

{
  let bad = 0, cases = 0;
  const samples = [C.start()];
  for (const deg of [1, 12, 45, 78, 90, 121, 179]) samples.push(C.hinge(deg * Math.PI / 360, 137));
  for (let i = 0; i < 40; i++) samples.push(randomHinge());
  for (const h of samples) {
    cases++;
    const ref = compute2(h.A, h.B, h.C);
    const core = C.tessellate(h);
    bad += layerDifference(core, ref);
    if (!pointNear(core.D, ref.D, 1e-9)) bad++;
  }
  check(`${cases} hinges: all 16 layers agree with a literal bytecode transcription`, bad === 0, `${bad} differences`);

  const degenerate = [
    { A: { x: 0, y: 0 }, B: { x: 0, y: 0 }, C: { x: 0, y: 0 } },
    { A: { x: 0, y: 0 }, B: { x: 5, y: 0 }, C: { x: 10, y: 0 } },
  ];
  let degenBad = 0;
  for (const h of degenerate) {
    degenBad += layerDifference(C.tessellate(h), compute2(h.A, h.B, h.C));
    if (!C.tessellate(h).layers.every((l) => l.every((q) => q.V.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))))) degenBad++;
  }
  check("collapsed hinges still match the bytecode and stay finite", degenBad === 0, String(degenBad));
}

/* ------------------------------- 3. rigid squares, over every angle and hinge */

{
  let bad = 0, tiles = 0, looseBad = 0, looseCases = 0;
  const symmetric = [];
  for (let deg = 1; deg <= 179; deg++) symmetric.push(C.hinge(deg * Math.PI / 360, 137));
  const loose = [];
  for (let i = 0; i < 12; i++) loose.push(randomHinge());
  for (const [label, samples] of [["locked", symmetric], ["loose", loose]]) {
    for (const h of samples) {
      const sideAB = C.dist(h.B, h.A);
      const sideBC = C.dist(h.C, h.B);
      const sizes = new Set();
      const t = C.tessellate(h);
      for (const layer of t.layers) {
        for (const sq of layer) {
          const e0 = C.sub(sq.V[1], sq.V[0]);
          const e3 = C.sub(sq.V[3], sq.V[0]);
          const e1 = C.sub(sq.V[2], sq.V[1]);
          const e2 = C.sub(sq.V[3], sq.V[2]);
          const len = C.dist(e0, C.P(0, 0));
          tiles++;
          sizes.add(len.toFixed(6));
          if (!near(C.dot(e0, e3), 0, 1e-7)) bad++;                   // right angle
          if (!near(len, C.dist(e3, C.P(0, 0)), 1e-7)) bad++;
          if (!near(len, C.dist(e1, C.P(0, 0)), 1e-7)) bad++;
          if (!near(C.dist(e1, C.P(0, 0)), C.dist(e2, C.P(0, 0)), 1e-7)) bad++;
          if (label === "locked" && !near(len, sideAB, 1e-7)) bad++;   // one hinge length
          if (label === "loose" && !near(len, sideAB, 1e-7) && !near(len, sideBC, 1e-7)) looseBad++;
        }
      }
      if (label === "loose") {
        looseCases++;
        // With Loose=1 the two hinge sides differ, so two square sizes appear.
        if (sizes.size !== 2 || !near(Number([...sizes][0]), sideAB, 1e-7) &&
          !near(Number([...sizes][0]), sideBC, 1e-7)) looseBad++;
      }
    }
  }
  check(`${tiles} tiles at 179 angles and 12 random hinges: every one is a rigid square`, bad === 0, `${bad} failures`);
  check(`${looseCases} loose hinges: tiles use exactly the two hinge side lengths`, looseBad === 0, `${looseBad} failures`);
}

/* ------------------------------------------------ 4. the page's motion claim */

{
  let badCell = 0, badDensity = 0, badAngle = 0, badResidue = 0, cases = 0;
  for (let deg = 1; deg <= 179; deg++) {
    const theta = deg * Math.PI / 180;
    const st = C.hinge(theta / 2, 137);
    const m = C.lattice(st);
    cases++;
    const cell = 2 * m.area * (1 + Math.sin(theta));
    if (!near(m.cell, cell, 1e-9)) badCell++;
    if (!near(m.density, 1 / (1 + Math.sin(theta)), 1e-9)) badDensity++;
    if (!near(m.hingeAngle, theta, 1e-9)) badAngle++;
    if (!near(m.squareAngle, theta / 2, 1e-9)) badAngle++;
    if (!near(C.dot(m.v1, m.v2), 0, 1e-7) || !near(m.spacing1, m.spacing2, 1e-7)) badResidue++;

    // Two squares in each repeat, at fixed half-cell offsets, for every angle.
    const t = C.tessellate(st);
    const det = C.cross(m.v1, m.v2);
    const seen = new Set();
    for (const layer of t.layers) {
      for (const sq of layer) {
        const c = C.mul(sq.V.reduce((a, p) => C.add(a, p), C.P(0, 0)), 0.25);
        const a = C.cross(c, m.v2) / det;
        const b = C.cross(m.v1, c) / det;
        seen.add(frac(a).toFixed(3) + ":" + frac(b).toFixed(3));
      }
    }
    if (seen.size !== 2) badResidue++;
  }
  check(`${cases} angles: cell = 2*s^2*(1+sin(theta)) exactly`, badCell === 0, String(badCell));
  check(`${cases} angles: covered fraction = 1/(1+sin(theta))`, badDensity === 0, String(badDensity));
  check(`${cases} angles: hinge opens by theta and each square turns theta/2`, badAngle === 0, String(badAngle));
  check(`${cases} angles: two squares per square lattice cell`, badResidue === 0, String(badResidue));

  // Expand, checkerboard, reform. The numbers at the three named stages are
  // what the page describes; the logic test pins them rather than assuming.
  const closed = C.lattice(C.hinge(0.0001 / 2, 137));
  const chess = C.lattice(C.hinge(Math.PI / 4, 137));
  const turned = C.lattice(C.hinge((Math.PI - 0.0001) / 2, 137));
  check("the starting grid has cell 2*s^2 (density 1)", near(closed.cell / closed.area, 2, 1e-4) && near(closed.density, 1, 1e-4));
  check("the checkerboard has cell 4*s^2 (density 1/2)", near(chess.cell / chess.area, 4, 1e-9) && near(chess.density, 0.5, 1e-9));
  check("the final grid also has cell 2*s^2 (density 1)", near(turned.cell / turned.area, 2, 1e-4) && near(turned.density, 1, 1e-4));
  check("the final grid's squares have turned 90 degrees", near(turned.squareAngle, Math.PI / 2, 1e-4));
  check("at the checkerboard the lattice step is exactly two square sides",
    near(chess.spacing1 / chess.side, 2, 1e-9) && near(chess.spacing2 / chess.side, 2, 1e-9));
  {
    const det = C.cross(chess.v1, chess.v2);
    const residue = (sq) => {
      const c = C.mul(sq.V.reduce((a, p) => C.add(a, p), C.P(0, 0)), 0.25);
      return [frac(C.cross(c, chess.v2) / det), frac(C.cross(chess.v1, c) / det)];
    };
    const r0 = residue(chess.base[0]);
    const r1 = residue(chess.base[1]);
    check("the two squares per cell sit at opposite half-lattice offsets",
      (near(r0[0], 0) && near(r0[1], 0.5) && near(r1[0], 0.5) && near(r1[1], 0)) ||
      (near(r1[0], 0) && near(r1[1], 0.5) && near(r0[0], 0.5) && near(r0[1], 0)),
      `${JSON.stringify(r0)} ${JSON.stringify(r1)}`);
  }

  let badGrowth = 0;
  let prevArea = -1, prevDensity = 2;
  for (let deg = 1; deg <= 90; deg++) {
    const m = C.lattice(C.hinge(deg * Math.PI / 360, 137));
    if (m.cell <= prevArea || m.density >= prevDensity) badGrowth++;
    prevArea = m.cell;
    prevDensity = m.density;
  }
  check("opening from a grid to a checkerboard always expands and lowers the density", badGrowth === 0, String(badGrowth));
  prevArea = Infinity;
  for (let deg = 90; deg <= 179; deg++) {
    const m = C.lattice(C.hinge(deg * Math.PI / 360, 137));
    if (m.cell >= prevArea) badGrowth++;
    prevArea = m.cell;
  }
  check("opening on past the checkerboard always contracts again", badGrowth === 0, String(badGrowth));
}

/* ------------------------------- 5. constraints, control and degeneracies */

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
    near(C.dot(C.sub(movedB.B, mid), C.sub(locked.C, locked.A)), 0, 1e-6));
  check("Loose=1 leaves the drag point alone", pointNear(C.constrainPoint(Object.assign({}, s, { loose: true }), "A", p), p));

  let badSide = 0, badCentre = 0, badAngle = 0;
  let st = C.start();
  const centre0 = C.mul(C.add(st.A, st.C), 0.5);
  let angle = C.lattice(st).hingeAngle;
  for (let i = 0; i < 8; i++) {
    st = C.openHinge(st, 5);
    const m = C.lattice(st);
    if (!near(C.dist(st.A, st.B), C.dist(s.A, s.B)) || !near(C.dist(st.B, st.C), C.dist(s.B, s.C))) badSide++;
    if (!pointNear(C.mul(C.add(st.A, st.C), 0.5), centre0)) badCentre++;
    if (!(m.hingeAngle > angle)) badAngle++;
    angle = m.hingeAngle;
  }
  check("eight Opens keep all hinge sides the same length", badSide === 0, String(badSide));
  check("eight Opens keep the pattern centred", badCentre === 0, String(badCentre));
  check("eight Opens strictly enlarge the hinge angle", badAngle === 0, String(badAngle));
  const far = C.lattice(C.openHinge(s, 1000));
  check("over-opening stops short of a collapsed hinge", far.hingeAngle < Math.PI);
  check("a close control reduces the angle again",
    C.lattice(C.openHinge(s, -5)).hingeAngle < C.lattice(s).hingeAngle);
}

done("dancing-squares");
