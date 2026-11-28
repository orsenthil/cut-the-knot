#!/usr/bin/env node
"use strict";

/*
 * Logic test for hinged-tessellation-1/hinged-tessellation-1-core.js.
 *
 *   node porting/check-hinged-tessellation-1.mjs
 *
 * 1. The applet's restraints: A and C glide on the circle about B, B on the
 *    perpendicular bisector of AC, so ABCD stays a rhombus.
 * 2. A second, independent transcription of Stranger.Draw, Canvas.Draw and
 *    ShowOneLayer is compared with the core for every colour mode, every
 *    layer count 0..15 and hundreds of positions of the handles.
 * 3. The page's claims: the (4,3,3,4,3) vertex figure at the square, the
 *    equilateral triangles that survive the hinges, and the six equilateral
 *    triangles at a corner when the rhombus angle is 60 degrees.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("hinged-tessellation-1/hinged-tessellation-1-core.js", "HingedTessellation1Core");
const pt = (x, y) => ({ x, y });
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a, b, tol = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const rad = (deg) => deg * Math.PI / 180;
const spread = (xs) => Math.max(...xs) - Math.min(...xs);

/* --------------------------------------------------- the second transcription */

/* GeoSDoub.FindOrientation(A,B,C), javap -c -p. */
function refOrientation(a, b, c) {
  return c.x * (b.y - a.y) + c.y * (a.x - b.x) + a.x * b.y - b.x * a.y > 0 ? 1 : -1;
}
/* GeoSDoub.Rotate(p, centre, angle, orientation). */
function refRotate(p, c, t, ori) {
  const co = Math.cos(t), si = Math.sin(t);
  return pt(p.x + co * (c.x - p.x) - ori * si * (c.y - p.y),
    p.y + ori * si * (c.x - p.x) + co * (c.y - p.y));
}
/* GeoSDoub.ComputeSignedAngle(v, p, q). */
function refSigned(v, p, q) {
  const c = (d(v, p) * d(v, p) + d(v, q) * d(v, q) - d(p, q) * d(p, q)) /
    (2 * d(v, p) * d(v, q));
  return refOrientation(v, p, q) * Math.acos(c);
}
/* HingedTessellation1Canvas.FourthPoint(a,b,c). */
function refFourth(a, b, c) {
  return pt(c.x + a.x - b.x, c.y + a.y - b.y);
}
/* HingedTessellation1Canvas$Stranger.Draw() plus its colour choice. */
function refStranger(a, b, c0, e0, layer, id, how) {
  const so = refOrientation(b, a, c0);
  const ang = refSigned(e0, c0, a);
  const e = refRotate(e0, c0, Math.PI / 3, -so);
  const f = refRotate(e, e0, ang, -so);
  const g = refFourth(e0, e, f);
  const h = refRotate(f, g, Math.PI / 3, so);
  const i = refRotate(h, g, Math.PI / 3, so);
  const j = refRotate(i, g, ang, -so);
  const n = refFourth(g, i, j);
  const l = refRotate(n, j, Math.PI / 3, -so);
  const m = refRotate(l, n, ang, -so);
  /* Colors[0]=TransBlue, [1]=TransGreen, [2]=TransRed ... as in the constructor. */
  let c5 = 0, c6 = 0;
  if (how === 1) { c5 = id % 2 === 0 ? 0 : 1; c6 = id % 2 === 0 ? 1 : 0; }
  if (how === 2) { c5 = layer % 10; c6 = (layer + 2) % 10; }
  const pts = { A: a, B: b, C: c0, D: e0, E: e, F: f, G: g, H: h, I: i, J: j, N: n, L: l, M: m };
  return {
    pts, layer, id,
    triangles: [[c0, e0, e, c5], [j, l, n, c5], [a, e0, n, c5], [g, h, i, c5],
      [e0, g, n, c6], [g, h, f, c6]],
    lines: [[a, b], [b, c0], [c0, e0], [e0, a], [e0, e], [c0, e], [e, f], [e0, g],
      [e0, n], [f, g], [f, h], [g, h], [h, i], [g, i], [g, n], [i, j], [j, n],
      [j, l], [l, m], [l, n], [m, a], [a, n]],
    V: pt(a.x - h.x, a.y - h.y), W: pt(l.x - c0.x, l.y - c0.y),
  };
}
/* Canvas.Draw() and its ShowOneLayer() loops, with the exact layer/id offsets. */
function refLayout(state) {
  const s0 = refStranger(state.A, state.B, state.C, state.D, 0, 0, state.options.mode);
  const v = s0.V, w = s0.W, nv = pt(-v.x, -v.y), nw = pt(-w.x, -w.y);
  const tiles = [s0];
  const plus = (p, q) => pt(p.x + q.x, p.y + q.y);
  function show(a, b, c0, e0, lay, id) {
    let a1 = a, b1 = b, c1 = c0, d1 = e0;
    for (let k = 0; k < state.options.layers; k++) {
      a1 = plus(a1, v); b1 = plus(b1, v); c1 = plus(c1, v); d1 = plus(d1, v);
      tiles.push(refStranger(a1, b1, c1, d1, lay + k, id, state.options.mode));
    }
    a1 = a; b1 = b; c1 = c0; d1 = e0;
    for (let k = 0; k < state.options.layers; k++) {
      a1 = plus(a1, nv); b1 = plus(b1, nv); c1 = plus(c1, nv); d1 = plus(d1, nv);
      tiles.push(refStranger(a1, b1, c1, d1, lay + k, id, state.options.mode));
    }
  }
  show(state.A, state.B, state.C, state.D, 0, 0);
  let a = state.A, b = state.B, c0 = state.C, d0 = state.D;
  for (let k = 0; k < state.options.layers; k++) {
    a = plus(a, w); b = plus(b, w); c0 = plus(c0, w); d0 = plus(d0, w);
    tiles.push(refStranger(a, b, c0, d0, k + 1, k + 1, state.options.mode));
    show(a, b, c0, d0, k + 1, k + 1);
  }
  a = state.A; b = state.B; c0 = state.C; d0 = state.D;
  for (let k = 0; k < state.options.layers; k++) {
    a = plus(a, nw); b = plus(b, nw); c0 = plus(c0, nw); d0 = plus(d0, nw);
    tiles.push(refStranger(a, b, c0, d0, k + 2, k + 1, state.options.mode));
    show(a, b, c0, d0, k + 2, k + 1);
  }
  return { v, w, tiles };
}

function samePoint(p, q, tol = 1e-8) {
  /* At a singular drag both transcriptions get acos() slightly outside
   * [-1,1] and produce NaN; that is the applet's behaviour too. */
  if (Number.isNaN(p.x) && Number.isNaN(q.x) && Number.isNaN(p.y) && Number.isNaN(q.y)) return true;
  return near(p.x, q.x, tol) && near(p.y, q.y, tol);
}
function sameTiles(core, ref, label) {
  if (core.tiles.length !== ref.tiles.length) return `${label}: ${core.tiles.length} vs ${ref.tiles.length} tiles`;
  for (let k = 0; k < core.tiles.length; k++) {
    const t = core.tiles[k], u = ref.tiles[k];
    if (t.layer !== u.layer || t.id !== u.id) return `${label}: tile ${k} layer/id`;
    for (const name of Object.keys(u.pts)) {
      if (!samePoint(t.points[name], u.pts[name])) return `${label}: tile ${k} point ${name}`;
    }
    for (let j = 0; j < 6; j++) {
      if (!samePoint(t.triangles[j].pts[0], u.triangles[j][0]) ||
          !samePoint(t.triangles[j].pts[1], u.triangles[j][1]) ||
          !samePoint(t.triangles[j].pts[2], u.triangles[j][2]) ||
          t.triangles[j].color !== u.triangles[j][3]) return `${label}: tile ${k} triangle ${j}`;
    }
    for (let j = 0; j < u.lines.length; j++) {
      if (!samePoint(t.lines[j][0], u.lines[j][0]) || !samePoint(t.lines[j][1], u.lines[j][1]))
        return `${label}: tile ${k} line ${j}`;
    }
  }
  return null;
}

/* ------------------------------------------------------- 1. the rules and ranges */

{
  const s = C.start();
  equal("init(): A at -90 degrees on the circle", s.A, pt(320, 197));
  equal("init(): B at 0 degrees on the circle", s.B, pt(353, 230));
  equal("init(): C at +90 degrees on the circle", s.C, pt(320, 263));
  equal("init(): FourthPoint(A,B,C)", s.D, pt(287, 230));
  equal("page's startLayer=4 and One color defaults", s.options, { layers: 4, mode: 0 });
  check("an illustration has no win or loss", C.result(s) === null);
  equal("the spinner clamps low and high", [C.normalize("layers", -9), C.normalize("layers", 99)], [0, 15]);
  equal("spinner rounds fractions", C.normalize("layers", 3.6), 4);
  equal("the colour radios clamp low and high", [C.normalize("mode", -2), C.normalize("mode", 17)], [0, 2]);
  check("an unknown option is left alone", C.setOption(s, "nope", 5) === s);
  const changed = C.setOption(s, "mode", 2);
  check("changing an option does not mutate the position", s.options.mode === 0 && changed.options.mode === 2);
}

/* ------------------------------------------- 2. the drags and the rhombus invariant */

{
  const s = C.start();
  let circleOk = true, cCircleOk = true, bisectorOk = true, rhombusOk = true;
  let minAngle = 180, maxAngle = 0;
  const radius = d(s.B, s.C);
  for (let deg = 0; deg < 360; deg += 3) {
    const t = rad(deg);
    const a = pt(s.B.x + radius * Math.cos(t), s.B.y + radius * Math.sin(t));
    const moved = C.move(s, "A", a);
    circleOk = circleOk && near(d(moved.A, moved.B), radius, 1e-9);
    const c = pt(s.B.x + radius * Math.cos(t), s.B.y + radius * Math.sin(t));
    const movedC = C.move(s, "C", c);
    cCircleOk = cCircleOk && near(d(movedC.C, movedC.B), radius, 1e-9);
    const sides = [d(moved.A, moved.B), d(moved.B, moved.C), d(moved.C, moved.D), d(moved.D, moved.A)];
    rhombusOk = rhombusOk && spread(sides) < 1e-9 &&
      near(moved.D.x, moved.A.x + moved.C.x - moved.B.x, 1e-9);
    const ba = C.angle(moved.B, moved.A, moved.C);
    if (Number.isFinite(ba)) { minAngle = Math.min(minAngle, ba); maxAngle = Math.max(maxAngle, ba); }
    const st = C.move(s, "B", pt(200 + deg, 100 + deg / 2));
    const mid = pt((st.A.x + st.C.x) / 2, (st.A.y + st.C.y) / 2);
    bisectorOk = bisectorOk && near(d(st.B, st.A), d(st.B, st.C), 1e-8) &&
      near((st.B.x - mid.x) * (st.C.x - st.A.x) + (st.B.y - mid.y) * (st.C.y - st.A.y), 0, 1e-7);
  }
  check("A is projected onto the circle about B", circleOk);
  check("C is projected onto the circle about B", cCircleOk);
  check("B is projected onto the perpendicular bisector of AC", bisectorOk);
  check("every drag keeps ABCD a rhombus", rhombusOk);
  check("the hinges flex the square through a wide angle range", minAngle < 1 && maxAngle > 179,
    `${minAngle.toFixed(2)}..${maxAngle.toFixed(2)} degrees`);
  check("a move is marked explored but does not finish a demo", C.move(s, "A", pt(400, 200)).explored &&
    C.result(C.move(s, "A", pt(400, 200))) === null);
  check("invalid moves are refused", C.move(s, "B", null) === s && C.move(s, "Z", pt(1, 2)) === s);
}

/* ----------------------------- 3. the same drawing as the applet's own methods */

{
  const s = C.start();
  const radius = d(s.B, s.C);
  let bad = null;
  let compared = 0;
  /* Every colour mode, every layer count 0..4, 36 positions of A: whole pictures. */
  for (let deg = 0; deg < 360 && !bad; deg += 10) {
    if (deg === 180) continue; // A coincides with B; the applet's signed angle is NaN
    const a = pt(s.B.x + radius * Math.cos(rad(deg)), s.B.y + radius * Math.sin(rad(deg)));
    let state = C.move(s, "A", a);
    for (let mode = 0; mode < 3 && !bad; mode++) {
      state = C.setOption(state, "mode", mode);
      for (let layers = 0; layers <= 4 && !bad; layers++) {
        const st = C.setOption(state, "layers", layers);
        const core = C.layout(st), ref = refLayout(st);
        compared++;
        bad = sameTiles(core, ref, `A at ${deg}, mode ${mode}, layers ${layers}`);
      }
    }
  }
  check(`core matches Stranger.Draw/Draw/ShowOneLayer over ${compared} full configurations`, !bad, bad || "");

  /* The rest of the spinner's range, including its maximum, on smaller samples. */
  bad = null;
  for (let deg = 5; deg < 360 && !bad; deg += 30) {
    const a = pt(s.B.x + radius * Math.cos(rad(deg)), s.B.y + radius * Math.sin(rad(deg)));
    for (let mode = 0; mode < 3 && !bad; mode++) {
      for (const layers of [5, 9, 12, 15]) {
        const st = C.setOption(C.setOption(C.move(s, "A", a), "mode", mode), "layers", layers);
        const core = C.layout(st), ref = refLayout(st);
        bad = sameTiles(core, ref, `layers ${layers}, A at ${deg}, mode ${mode}`) ||
          (core.total === (2 * layers + 1) ** 2 ? null : `wrong tile count at ${layers}`);
        if (bad) break;
      }
    }
  }
  check("core matches the applet for layers 5..15, including all 31x31 tiles at 15", !bad, bad || "");

  /* B glides along the perpendicular bisector; the same comparison applies. */
  bad = null;
  let bConfigs = 0;
  for (let k = 0; k < 24 && !bad; k++) {
    const raw = pt(200 + k * 12, 110 + k * 6);
    let st = C.move(s, "B", raw);
    for (const layers of [0, 4, 15]) {
      st = C.setOption(st, "layers", layers);
      const core = C.layout(st), ref = refLayout(st);
      bad = sameTiles(core, ref, `B step ${k}, layers ${layers}`);
      bConfigs++;
      if (bad) break;
    }
  }
  check(`core matches the applet for ${bConfigs} positions of B`, !bad, bad || "");

  const full = C.layout(C.setOption(s, "layers", 15));
  check("the two translation steps are A-H and L-C", samePoint(full.v, C.stranger(s.A, s.B, s.C, s.D, 0, 0, 0).V) &&
    samePoint(full.w, C.stranger(s.A, s.B, s.C, s.D, 0, 0, 0).W));
  check("drawing clips to the 640x460 canvas", C.geometry(s).drawn.length < full.tiles.length &&
    C.geometry(s).drawn.every((t) => C.visible(t, 40)));
}

/* -------------------------------------------------------- 4. the page's claims */

{
  const s = C.start();
  const m = C.measures(s);
  check("the starting cell is a square: all four angles are 90 degrees", near(m.squareError, 0, 1e-9));
  check("the vertex figure is 4,3,3,4,3: 90+60+60+90+60=360",
    m.claims.squareAtStart && m.claims.vertexFigure && near(2 * 90 + 3 * 60, 360, 0));
  check("the five triangles the hinges preserve are equilateral at the start",
    m.claims.trianglesEquilateral, `side spread ${m.triangleSpread}`);

  /* Every one-degree position of A: triangles stay equilateral, squares do not. */
  const radius = d(s.B, s.C);
  let trianglesOk = true, squareChanged = 0, finiteCount = 0;
  for (let deg = 0; deg < 360; deg++) {
    const a = pt(s.B.x + radius * Math.cos(rad(deg)), s.B.y + radius * Math.sin(rad(deg)));
    const st = C.move(s, "A", a);
    const mm = C.measures(st);
    if (!Number.isFinite(mm.atB)) continue;
    finiteCount++;
    trianglesOk = trianglesOk && mm.claims.trianglesEquilateral;
    if (!mm.claims.squareAtStart) squareChanged++;
  }
  check(`the triangles remain equilateral in all ${finiteCount} drags of A`, trianglesOk);
  check("the square is not preserved while the triangles are", squareChanged > 300,
    `${squareChanged} non-square positions`);

  /* The page's triangular tessellation: a 60-degree rhombus is two equilateral
   * triangles and six of them fill the corner. Check both directions of A. */
  let sixOk = true, both = 0;
  for (const deg of [75, 195]) {
    const a = pt(s.B.x + radius * Math.cos(rad(deg)), s.B.y + radius * Math.sin(rad(deg)));
    const st = C.move(s, "A", a);
    const mm = C.measures(st);
    const halfLens = mm.halves.map((t) => [d(t[0], t[1]), d(t[1], t[2]), d(t[2], t[0])]);
    both += mm.claims.triangularAt60 && halfLens.length === 2 &&
      halfLens.every((h) => spread(h) < 1e-7) &&
      spread(halfLens[0].concat(halfLens[1])) < 1e-7 ? 1 : 0;
    sixOk = sixOk && mm.claims.sixTriangles;

    /* Six real sectors at A from the flower's triangles and the two halves. */
    const tiles = C.layout(C.setOption(st, "layers", 4)).tiles;
    const tris = [];
    for (const tile of tiles) {
      for (const t of tile.triangles) tris.push(t.pts);
      tris.push([tile.A, tile.B, tile.C], [tile.A, tile.C, tile.D]);
    }
    const key = (p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
    const seen = new Set();
    const unique = tris.filter((t) => {
      const k = t.map(key).sort().join("|");
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    const byPoint = new Map();
    for (const t of unique) for (const p of t) {
      const k = key(p);
      if (!byPoint.has(k)) byPoint.set(k, []);
      byPoint.get(k).push(t);
    }
    let found = false;
    for (const [k, incident] of byPoint) {
      const at = incident[0].find((p) => key(p) === k);
      const dirs = [];
      for (const t of incident) {
        const i = t.findIndex((p) => key(p) === k);
        for (const j of [1, 2]) {
          const q = t[(i + j) % 3];
          dirs.push(Math.atan2(q.y - at.y, q.x - at.x));
        }
      }
      dirs.sort((a, b) => a - b);
      const uniqueDirs = [];
      for (const v of dirs) if (!uniqueDirs.length || Math.abs(v - uniqueDirs[uniqueDirs.length - 1]) > 1e-6) uniqueDirs.push(v);
      if (uniqueDirs.length > 1 && near(uniqueDirs[0] + 2 * Math.PI, uniqueDirs[uniqueDirs.length - 1], 1e-6)) uniqueDirs.pop();
      const gaps = uniqueDirs.map((v, i) => {
        const w = uniqueDirs[(i + 1) % uniqueDirs.length];
        return (w - v + (i === uniqueDirs.length - 1 ? 2 * Math.PI : 0)) * 180 / Math.PI;
      });
      if (gaps.length === 6 && gaps.every((g) => near(g, 60, 1e-5)) &&
          near(gaps.reduce((a, b) => a + b, 0), 360, 1e-5)) { found = true; break; }
    }
    sixOk = sixOk && found;
  }
  check("a 60-degree rhombus splits into two equilateral triangles in both directions", both === 2);
  check("six equilateral triangles, 60 degrees each, meet at the corner", sixOk);
  const triangularState = C.move(s, "A", pt(
    s.B.x + radius * Math.cos(rad(75)), s.B.y + radius * Math.sin(rad(75))));
  check("the status says which arrangement is shown", /4, 3, 3, 4, 3/.test(C.describe(s)) &&
    /six triangles/i.test(C.describe(triangularState)));
}

done("hinged-tessellation-1");
