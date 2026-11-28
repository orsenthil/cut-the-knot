#!/usr/bin/env node
"use strict";

/*
 * Logic test for hinged-tessellation-2/hinged-tessellation-2-core.js.
 *
 * What is checked:
 *
 *   1. The opening points, the layer spinner (0..15), the colour radios and
 *      the page's embedded parameters (startLayer=4, no Loose) are the
 *      applet's own.
 *   2. Stranger.Draw() is transcribed a second time, straight from javap,
 *      and compared point by point, triangle by triangle, edge by edge and
 *      colour by colour over thousands of hinges and every option.
 *   3. Canvas.Draw()'s two layer loops are transcribed a second time and
 *      compared for every layer count from 0 to 15 and all three colour modes.
 *   4. The page's claims: five polygons at a vertex are 90+60+60+90+60 =
 *      360 degrees (4,3,3,4,3); the squares stay squares while the triangles
 *      stretch; at a 90-degree apex the triangles pair into squares, giving
 *      the (4,4,4,4) derivative. Checked for every apex angle, not samples.
 *   5. The contrast with HingedTessellation1: a literal transcription of its
 *      Stranger shows it keeps equilateral triangles instead; the two applets
 *      really do let different pieces give.
 *   6. Locked hinge constraints, presets, degeneracies.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hinged-tessellation-2/hinged-tessellation-2-core.js", "HingedTessellation2Core");

const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const pointNear = (a, b, eps = 1e-8) => near(a.x, b.x, eps) && near(a.y, b.y, eps);
const random = rng(20261127);
const randomHinge = () => ({
  A: { x: -90 + random() * 180, y: -90 + random() * 180 },
  B: { x: -90 + random() * 180, y: -90 + random() * 180 },
  C: { x: -90 + random() * 180, y: -90 + random() * 180 },
});
const lockedHinge = (degrees) => {
  const a = degrees * Math.PI / 180;
  const r = 40 + 20 * Math.sin(degrees / 7);
  return {
    A: { x: -r * Math.cos(a / 2), y: -r * Math.sin(a / 2) },
    B: { x: 0, y: 0 },
    C: { x: -r * Math.cos(a / 2), y: r * Math.sin(a / 2) },
  };
};

/* ------------------------------------------- 1. the opening and the options */

{
  const s = C.start();
  equal("the page embeds startLayer=4", s.layers, 4);
  equal("the page has no Loose=1 parameter", s.loose, false);
  equal("the colour radios start on One color", s.colorMode, C.MODES.ONE_COLOR);
  equal("the applet's width is 640", s.width, 640);
  equal("the applet's height is 460", s.height, 460);
  const radius = Math.floor(Math.min(s.width / 3, s.height / 3)) - 120;
  equal("init() radius = floor(min(w,h)/3) - 120", radius, 33);
  check("B is at angle 0 on that circle", pointNear(s.B, { x: s.width / 2 + radius, y: s.height / 2 }));
  check("A is at -120 degrees", pointNear(s.A, {
    x: s.width / 2 + radius * Math.cos(-2.0943951023931953),
    y: s.height / 2 + radius * Math.sin(-2.0943951023931953),
  }));
  check("C is at +120 degrees", pointNear(s.C, {
    x: s.width / 2 + radius * Math.cos(2.0943951023931953),
    y: s.height / 2 + radius * Math.sin(2.0943951023931953),
  }));
  check("the opening triangle is equilateral", near(C.dist(s.A, s.B), C.dist(s.B, s.C)) &&
    near(C.dist(s.A, s.B), C.dist(s.A, s.C)));
  check("D completes the parallelogram", pointNear(C.fourth(s.A, s.B, s.C), {
    x: s.A.x + s.C.x - s.B.x, y: s.A.y + s.C.y - s.B.y,
  }));

  equal("the layer spinner stops at 0", C.withOption(s, "layers", -7).layers, 0);
  equal("the layer spinner stops at 15", C.withOption(s, "layers", 99).layers, 15);
  equal("the layer step is one", C.LIMITS.layers.step, 1);
  equal("the spinner model's minimum is zero", C.LIMITS.layers.min, 0);
  equal("the spinner model's maximum is fifteen", C.LIMITS.layers.max, 15);
  equal("the colour mode is clamped to three radios", C.withOption(s, "colorMode", 12).colorMode, 2);
  equal("the second radio is Two colors", C.withOption(s, "colorMode", 1).colorMode, 1);
  equal("the palette has ten colours", C.COLOR_NAMES.length, 10);
}

/* ------------------------------- 2. a literal second transcription of Draw */

/*
 * Written again from `javap -c -p` of HingedTessellation2Canvas$Stranger,
 * with the bytecode's own order of rotations and its unused signed angle.
 * No core helper is called here.
 */
const T = {
  pt: (x, y) => ({ x: x, y: y }),
};
function orient2(a, b, c) {
  const value = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return value > 0 ? 1 : -1;
}
function rotate2(centre, point, angle, sign) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return T.pt(centre.x + co * (point.x - centre.x) - sign * si * (point.y - centre.y),
    centre.y + sign * si * (point.x - centre.x) + co * (point.y - centre.y));
}
function stranger2(A0, B0, C0, layer, id, colorMode) {
  const A = T.pt(A0.x, A0.y), B = T.pt(B0.x, B0.y), C = T.pt(C0.x, C0.y);
  const s = orient2(B, A, C);
  const D = T.pt(C.x + A.x - B.x, C.y + A.y - B.y);
  const N = rotate2(B, C, 1.5707963267948966, s);
  const Pp = rotate2(C, B, 1.5707963267948966, -s);
  const E = rotate2(C, D, 1.5707963267948966, s);
  const F = rotate2(D, C, 1.5707963267948966, -s);
  const I = rotate2(D, A, 1.5707963267948966, s);
  const K = rotate2(A, D, 1.5707963267948966, -s);
  const L = rotate2(A, B, 1.5707963267948966, s);
  const M = rotate2(B, A, 1.5707963267948966, -s);
  const H = T.pt(I.x + F.x - D.x, I.y + F.y - D.y);
  const Q = rotate2(L, T.pt(L.x + K.x - A.x, L.y + K.y - A.y), 1.5707963267948966, -s);
  const R = T.pt(E.x + L.x - Q.x, E.y + L.y - Q.y);
  let c6 = 0, c7 = 0;
  if (colorMode === 1) {
    c6 = id % 2 === 0 ? 0 : 1;
    c7 = id % 2 === 0 ? 1 : 0;
  } else if (colorMode === 2) {
    c6 = layer % 10;
    c7 = (layer + 2) % 10;
  }
  const triangles = [
    [[A, B, C], c6], [[C, E, Pp], c6], [[A, K, L], c6], [[D, H, I], c6],
    [[L, M, Q], c6], [[A, C, D], c7], [[F, D, H], c7], [[E, F, R], c7],
  ];
  const edges = [
    [A, B], [B, C], [C, D], [D, A], [B, N], [N, Pp], [Pp, C],
    [C, E], [E, F], [F, D], [K, A], [I, K], [I, D], [A, K],
    [L, M], [M, B], [A, L], [K, L], [A, L], [E, Pp],
    [H, F], [H, D], [H, I], [A, C], [E, R], [M, Q],
  ];
  return {
    points: { A: A, B: B, C: C, D: D, N: N, P: Pp, E: E, F: F, I: I, K: K,
      L: L, M: M, H: H, Q: Q, R: R },
    triangles: triangles, edges: edges,
    V: T.pt(B.x - H.x, B.y - H.y), W: T.pt(L.x - Pp.x, L.y - Pp.y),
  };
}
function draw2(A, B, C, layers, colorMode) {
  const out = [stranger2(A, B, C, 0, 0, colorMode)];
  const W = out[0].W;
  const moved = (base, v) => [T.pt(base[0].x + v.x, base[0].y + v.y),
    T.pt(base[1].x + v.x, base[1].y + v.y), T.pt(base[2].x + v.x, base[2].y + v.y)];
  let corners = [A, B, C];
  for (let i = 0; i < layers; i++) {
    corners = moved(corners, W);
    out.push(stranger2(corners[0], corners[1], corners[2], i + 1, i + 1, colorMode));
  }
  corners = [A, B, C];
  for (let i = 0; i < layers; i++) {
    corners = moved(corners, T.pt(-W.x, -W.y));
    out.push(stranger2(corners[0], corners[1], corners[2], i + 1, i + 1, colorMode));
  }
  return out;
}
function compareMotif(m, ref) {
  let bad = 0;
  for (const name of ["A", "B", "C", "D", "N", "P", "E", "F", "I", "K", "L", "M", "H", "Q", "R"]) {
    if (!pointNear(m[name], ref.points[name], 1e-9)) bad++;
  }
  if (!pointNear(m.V, ref.V, 1e-9) || !pointNear(m.W, ref.W, 1e-9)) bad++;
  if (m.triangles.length !== ref.triangles.length) return bad + 1;
  for (let i = 0; i < m.triangles.length; i++) {
    if (m.triangles[i].color !== ref.triangles[i][1]) bad++;
    for (let k = 0; k < 3; k++) if (!pointNear(m.triangles[i].points[k], ref.triangles[i][0][k], 1e-9)) bad++;
  }
  if (m.edges.length !== ref.edges.length) return bad + 1;
  for (let i = 0; i < m.edges.length; i++) {
    if (!pointNear(m.edges[i][0], ref.edges[i][0], 1e-9) ||
        !pointNear(m.edges[i][1], ref.edges[i][1], 1e-9)) bad++;
  }
  return bad;
}

{
  let bad = 0, cases = 0;
  for (let mode = 0; mode < 3; mode++) {
    for (let i = 0; i < 1000; i++) {
      const h = randomHinge();
      const layer = i % 16, id = (i * 7) % 16;
      const m = C.motif(h.A, h.B, h.C, layer, id, mode);
      bad += compareMotif(m, stranger2(h.A, h.B, h.C, layer, id, mode));
      cases++;
    }
  }
  check(`${cases} hinges x 3 colour modes: Stranger matches javap exactly`, bad === 0, String(bad));

  const start = C.start();
  for (let layer = 0; layer < 16; layer++) {
    for (let id = 0; id < 16; id++) {
      for (let mode = 0; mode < 3; mode++) {
        const m = C.motif(start.A, start.B, start.C, layer, id, mode);
        if (m.colors[0] !== stranger2(start.A, start.B, start.C, layer, id, mode).triangles[0][1] ||
            m.colors[1] !== stranger2(start.A, start.B, start.C, layer, id, mode).triangles[5][1]) bad++;
      }
    }
  }
  check("all 16x16x16 layer/id/mode colour triples match the applet", bad === 0, String(bad));

  let badLayers = 0, layerCases = 0;
  for (let layers = 0; layers <= 15; layers++) {
    for (const mode of [0, 1, 2]) {
      for (let i = 0; i < 6; i++) {
        const h = i === 0 ? C.start() : randomHinge();
        const st = Object.assign({}, h, { layers: layers, colorMode: mode });
        const got = C.tessellate(st).motifs;
        const ref = draw2(st.A, st.B, st.C, layers, mode);
        if (got.length !== ref.length) badLayers++;
        else for (let k = 0; k < got.length; k++) badLayers += compareMotif(got[k], ref[k]);
        layerCases++;
      }
    }
  }
  check(`${layerCases} configurations: every layer count 0..15 matches Canvas.Draw`, badLayers === 0, String(badLayers));
  equal("no layers draws the base motif alone", C.tessellate(C.withOption(C.start(), "layers", 0)).motifs.length, 1);
  equal("15 layers draws 1 + 2*15 motifs", C.tessellate(C.withOption(C.start(), "layers", 15)).motifs.length, 31);
}

/* ------------------------------------- 3. the page's (4,3,3,4,3) claim */

{
  const s = C.start();
  const v = C.vertexAngles(s.A, s.B, s.C);
  check("at the start the five angles are square, triangle, triangle, square, triangle",
    v.parts.map((x) => Math.round(x)).join(",") === "90,60,60,90,60", v.parts.map((x) => x.toFixed(3)).join(","));
  check("those five angles fill 360 degrees", near(v.sum, 360, 1e-9), String(v.sum));
  check("the page's vertex type really is (4,3,3,4,3)",
    near(v.parts[0], 90) && near(v.parts[3], 90) &&
    [1, 2, 4].every((k) => near(v.parts[k], 60)));

  let badSquare = 0, badSum = 0, badIsosceles = 0, cases = 0;
  for (let deg = 3; deg <= 177; deg++) {
    const h = lockedHinge(deg);
    const m = C.motif(h.A, h.B, h.C, 0, 0, 0);
    const va = C.vertexAngles(h.A, h.B, h.C);
    cases++;
    // All four squares are rigid: equal sides and a right corner.
    for (const q of va.squares) {
      const sides = [0, 1, 2, 3].map((k) => C.dist(q[k], q[(k + 1) % 4]));
      if (!sides.every((x) => near(x, sides[0], 1e-8))) badSquare++;
      if (!near(C.angle(q[0], q[1], q[3]), Math.PI / 2, 1e-8)) badSquare++;
    }
    if (!near(va.sum, 360, 1e-7)) badSum++;
    // With locked hinges BA = BC and DA = DC: both big triangles are isosceles.
    if (!near(C.dist(h.A, h.B), C.dist(h.B, h.C), 1e-7) ||
        !near(C.dist(m.D, h.A), C.dist(m.D, h.C), 1e-7)) badIsosceles++;
  }
  check(`${cases} apex angles: every square stays a square`, badSquare === 0, String(badSquare));
  check(`${cases} apex angles: the five polygons still fill 360 degrees`, badSum === 0, String(badSum));
  check(`${cases} apex angles: the two big triangles stay isosceles`, badIsosceles === 0, String(badIsosceles));

  // "Something has to give": the triangles are equilateral only at 60 degrees.
  let equilateral = 0;
  for (let deg = 3; deg <= 177; deg++) {
    const h = lockedHinge(deg);
    const va = C.vertexAngles(h.A, h.B, h.C);
    if (near(va.parts[1], 60, 1e-7) && near(va.parts[2], 60, 1e-7) && near(va.parts[4], 60, 1e-7)) equilateral++;
  }
  equal("only the 60-degree hinge is regular", equilateral, 1);

  // Even with the hinges fully loose the five angles at A still add to 360:
  // the triangles can change shape, but the construction keeps them fitting.
  let looseSumDiffers = 0, looseSquaresBad = 0, unequalHinges = 0;
  for (let i = 0; i < 200; i++) {
    const h = randomHinge();
    const va = C.vertexAngles(h.A, h.B, h.C);
    if (!near(va.sum, 360, 1e-6)) looseSumDiffers++;
    if (!near(C.dist(h.A, h.B), C.dist(h.B, h.C), 1e-6)) unequalHinges++;
    for (const q of va.squares) {
      const sides = [0, 1, 2, 3].map((k) => C.dist(q[k], q[(k + 1) % 4]));
      if (!sides.every((x) => near(x, sides[0], 1e-8))) looseSquaresBad++;
    }
  }
  equal("200 loose hinges: the five angles still add to 360", looseSumDiffers, 0);
  equal("even loose, all four derived squares are rigid", looseSquaresBad, 0);
  check("loose hinges really do let BA differ from BC (rhombi become parallelograms)",
    unequalHinges > 190, String(unequalHinges));
}

/* ---------------------------- 4. the page's (4,4,4,4) derivative claim */

{
  const s = C.start();
  const square = C.withApex(s, 90);
  const va = C.vertexAngles(square.A, square.B, square.C);
  check("the 90-degree preset keeps the locked hinge", near(C.dist(square.A, square.B), C.dist(square.B, square.C)));
  check("the preset really opens the apex to 90 degrees", near(va.apex, 90, 1e-9), String(va.apex));
  check("at a right apex the five angles are 90,45,45,90,90",
    va.parts.map((x) => Math.round(x)).join(",") === "90,45,45,90,90", va.parts.map((x) => x.toFixed(3)).join(","));
  check("and still add to 360 degrees", near(va.sum, 360, 1e-9), String(va.sum));
  check("triangle ABC paired with ACD makes a square ABCD", (() => {
    const q = [square.A, square.B, square.C, C.fourth(square.A, square.B, square.C)];
    const sides = [0, 1, 2, 3].map((k) => C.dist(q[k], q[(k + 1) % 4]));
    return sides.every((x) => near(x, sides[0], 1e-8)) && near(C.angle(q[1], q[0], q[2]), Math.PI / 2, 1e-8);
  })());
  check("the remaining triangles are right isosceles, so pairs make squares", (() => {
    const m = C.motif(square.A, square.B, square.C, 0, 0, 0);
    return [m.triangles[2], m.triangles[3], m.triangles[4]].every((t) => {
      const [p, q, r] = t.points;
      const sides = [C.dist(p, q), C.dist(q, r), C.dist(r, p)].sort((a, b) => a - b);
      return near(sides[0], sides[1], 1e-8) && near(sides[2] * sides[2], 2 * sides[0] * sides[0], 1e-7);
    });
  })());
  check("the 60-degree preset restores the semi-regular start",
    near(C.vertexAngles(C.withApex(s, 60).A, C.withApex(s, 60).B, C.withApex(s, 60).C).parts[1], 60, 1e-9));
}

/* --------------------------- 5. contrast with HingedTessellation1 */

/*
 * HingedTessellation1Canvas$Stranger.Draw(), also transcribed from javap.
 * It rotates by 60 degrees and uses the signed angle, so the triangles are
 * rigid and the squares become rhombi - the opposite choice to this applet.
 */
function signedAngle2(p, q, r) {
  const pq = Math.hypot(p.x - q.x, p.y - q.y), pr = Math.hypot(p.x - r.x, p.y - r.y);
  if (!pq || !pr) return 0;
  const cosValue = (pq * pq + pr * pr - (q.x - r.x) ** 2 - (q.y - r.y) ** 2) / (2 * pq * pr);
  const value = Math.acos(Math.max(-1, Math.min(1, cosValue)));
  return orient2(p, q, r) === 1 ? value : -value;
}
function stranger1(A, B, C) {
  const s = orient2(B, A, C);
  const D = T.pt(C.x + A.x - B.x, C.y + A.y - B.y);
  const a = signedAngle2(D, C, A);
  const E = rotate2(D, C, 1.0471975511965976, -s);
  const F = rotate2(E, D, a, -s);
  const G = T.pt(F.x + D.x - E.x, F.y + D.y - E.y);
  const H = rotate2(F, G, 1.0471975511965976, s);
  const I = rotate2(H, G, 1.0471975511965976, s);
  const J = rotate2(I, G, a, -s);
  const N = T.pt(J.x + G.x - I.x, J.y + G.y - I.y);
  const L = rotate2(N, J, 1.0471975511965976, -s);
  const M = rotate2(L, N, a, -s);
  return { E: E, C: C, D: D, H: H, G: G, I: I, L: L, N: N, M: M };
}
{
  let ht1Bad = 0, ht2Bad = 0, cases = 0;
  for (let i = 0; i < 400; i++) {
    const h = lockedHinge(5 + i * 0.42);
    const one = stranger1(h.A, h.B, h.C);
    const d1 = [Math.hypot(one.C.x - one.D.x, one.C.y - one.D.y),
      Math.hypot(one.D.x - one.E.x, one.D.y - one.E.y),
      Math.hypot(one.C.x - one.E.x, one.C.y - one.E.y)];
    if (!d1.every((x) => near(x, d1[0], 1e-8))) ht1Bad++;
    const va = C.vertexAngles(h.A, h.B, h.C);
    for (const q of va.squares.slice(0, 2)) {
      const sides = [0, 1, 2, 3].map((k) => C.dist(q[k], q[(k + 1) % 4]));
      if (!sides.every((x) => near(x, sides[0], 1e-8))) ht2Bad++;
    }
    cases++;
  }
  check(`${cases} hinges: HingedTessellation1 keeps CDE equilateral`, ht1Bad === 0, String(ht1Bad));
  check(`${cases} hinges: HingedTessellation2 keeps the squares rigid`, ht2Bad === 0, String(ht2Bad));
}

/* ------------------------ 6. constraints, presets and degenerate inputs */

{
  const s = C.start();
  const locked = Object.assign({}, s, { loose: false });
  const p = { x: s.A.x + 37, y: s.A.y - 21 };
  const a = C.withPoint(locked, "A", C.constrainPoint(locked, "A", p));
  check("locked A stays on the circle about B of radius BC",
    near(C.dist(a.A, locked.B), C.dist(locked.B, locked.C), 1e-7));
  const c = C.withPoint(locked, "C", C.constrainPoint(locked, "C", p));
  check("locked C stays on the circle about B of radius BA",
    near(C.dist(c.C, locked.B), C.dist(locked.B, locked.A), 1e-7));
  const b = C.withPoint(locked, "B", C.constrainPoint(locked, "B", p));
  const mid = C.mul(C.add(locked.A, locked.C), 0.5);
  check("locked B stays on the perpendicular bisector of AC",
    near(C.dot(C.sub(b.B, mid), C.sub(locked.C, locked.A)), 0, 1e-7));
  check("loose hinges leave a dragged point where it was",
    pointNear(C.constrainPoint(Object.assign({}, s, { loose: true }), "A", p), p));

  for (let deg = 1; deg <= 179; deg++) {
    const q = C.withApex(locked, deg);
    if (!near(C.dist(q.A, q.B), C.dist(q.B, q.C), 1e-7)) {
      check(`the ${deg}-degree preset obeys the hinge`, false);
      break;
    }
    if (deg === 179) check("every preset from 1 to 179 degrees obeys the hinge", true);
  }

  // The applet's unused signed angle is still computed identically.
  const m = C.motif(s.A, s.B, s.C, 0, 0, 0);
  check("the unused signed angle at D matches javap's formula",
    near(m.unusedAngle, signedAngle2(m.D, m.C, m.A), 1e-9));

  const degenerate = [
    { A: { x: 0, y: 0 }, B: { x: 0, y: 0 }, C: { x: 0, y: 0 } },
    { A: { x: 0, y: 0 }, B: { x: 5, y: 0 }, C: { x: 10, y: 0 } },
    { A: { x: 0, y: 0 }, B: { x: 0, y: 0 }, C: { x: 10, y: 4 } },
  ];
  for (const h of degenerate) {
    const t = C.tessellate(Object.assign({}, h, { layers: 15 }));
    check("a degenerate hinge still gives finite vertices and vectors",
      t.motifs.every((x) => x.triangles.every((tri) =>
        tri.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))) &&
      Number.isFinite(t.W.x) && Number.isFinite(t.W.y));
  }
}

done("hinged-tessellation-2");
