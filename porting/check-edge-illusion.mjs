#!/usr/bin/env node
"use strict";

/*
 * Logic test for edge-illusion/edge-illusion-core.js.
 *
 *   node porting/check-edge-illusion.mjs
 *
 * The cut-the-knot page says: "Do you perceive edgeless triangle (square)?
 * Does this shape appear brighter than the surrounding background? (Compare
 * this to the Simultaneous Contrast Illusion.) The effect is known as a
 * subjective (or illusory ) contour. For a recognizable simlpe shape the brain
 * appears to supply edges. Once edges are used elsewhere the shape becomes
 * less prominent." A test can check the drawing, not a viewer's perception, so
 * it checks the code-level part of each claim: the default picture draws no
 * side, fills the middle with the field colour, and "Show edges" lays detached
 * dashes exactly along the sides that are missing.
 *
 * What is checked:
 *   1. The applet's option ranges and opening values, including AWT's
 *      maximum - visibleAmount scrollbar limit.
 *   2. A second, literal transcription of EdgeIllusionCanvas.init(),
 *      DrawShape(), DrawEdges(), FromTo() and DrawExtra() (with the original
 *      bytecode slot names) agrees with the core on every circle, edge stroke,
 *      extra piece and vertex: all 32,320 configurations at the board size,
 *      plus 1,792 more at four other canvas sizes.
 *   3. The page's "edgeless" and "same background colour" claims, and the
 *      fact that the added edges lie on the missing sides.
 *   4. The applet's fixed geometry: min(width,height)/3 radii, the triangle's
 *      cy/12 offset, truncated distances, the paint palette cycle and the
 *      Part = 0 and Part = 100 endpoints of the extra pieces.
 *   5. Plain data, clamping and the Switch colors checkbox.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("edge-illusion/edge-illusion-core.js", "EdgeIllusionCore");
const rnd = (x) => Math.floor(x + 0.5);

/* ------------------------------- 1. the options ---------------------------- */

{
  const s = C.start();
  equal("the opening shape is the triangle", s.which, C.TRIANGLE);
  equal("the N scrollbar starts at 2", s.n, 2);
  equal("the Part scrollbar starts at 50", s.part, 50);
  equal("the opening drawing mode is Draw plain", s.mode, "plain");
  equal("Switch colors starts unchecked", s.swapped, false);
  equal("Extra shapes starts unchecked", s.extra, false);
  equal("the board starts at the applet-sized width", s.width, 360);
  equal("the board starts at the chosen height", s.height, 320);
  equal("N cannot go below the scrollbar minimum 1", C.withOption(s, "n", -5).n, 1);
  equal("N cannot exceed 11 - visible 1 = 10", C.withOption(s, "n", 99).n, 10);
  equal("Part cannot go below 0", C.withOption(s, "part", -3).part, 0);
  equal("Part cannot exceed 105 - visible 5 = 100", C.withOption(s, "part", 400).part, 100);
  equal("unknown mode names select Draw plain", C.withOption(s, "mode", "nonsense").mode, "plain");
  equal("all four AWT drawing checkboxes are represented", C.MODES, ["plain", "edges", "fill", "paint"]);
  equal("an unknown option leaves the position alone", C.withOption(s, "other", 7).n, 2);
  equal("Switch colors flips the roles", C.switchColors(s).swapped, true);
  equal("Switch colors leaves the geometry alone", C.switchColors(s).part, 50);
}

/* ---------------------------------------------------------------------------
 * 2. A second transcription, written out straight from javap's bytecode.
 *    S2 = radius, S3/S4 = centre, S5 = Points, S6 = Dist, S9 = step,
 *    S11 = a corner, S12 = a ring radius, S13/S14 = marker ends,
 *    S17/S18 = extra endpoints, S19 = apex, S7/S21 = FromTo scale.
 * ------------------------------------------------------------------------- */

function appletCanvas(N, Part, Which, mode, Extra, swapped, width, height) {
  const PA = [[Math.PI / 2, 2 * Math.PI / 3], [Math.PI / 4, Math.PI / 2]];
  const SA = [[[-60, 300], [60, 300], [-180, 300]],
              [[-90, 270], [0, 270], [90, 270], [-180, 270]]];
  const S2 = Math.trunc(Math.min(width, height) / 3);
  const S3 = Math.trunc(width / 2);
  const S4 = Math.trunc(height / 2);

  // init(): the two Point[] arrays.
  const S5 = [];
  for (let w = 0; w < 2; w++) {
    const S5w = [];
    const count = w === 0 ? 3 : 4;
    for (let i = 0; i < count; i++) {
      const S7 = PA[w][0] + i * PA[w][1];
      const cy = w === 0 ? S4 + Math.trunc(S4 / 12) : S4;
      S5w.push({ x: S3 + rnd(S2 * Math.cos(S7)), y: cy - rnd(S2 * Math.sin(S7)) });
    }
    S5.push(S5w);
  }
  // Distance(): sqrt of the squared difference, truncated to an int.
  const S6 = S5.map((ring) => {
    const dx = ring[1].x - ring[0].x, dy = ring[1].y - ring[0].y;
    return Math.trunc(Math.sqrt(dx * dx + dy * dy));
  });
  const S9 = (S6[Which] * Part) / 100 / (2 * N - 1) / 2;

  // DrawShape(): concentric circles, then the background-coloured mask.
  const circles = [];
  for (const corner of S5[Which]) {
    for (let j = 0; j <= 2 * N - 2; j++) {
      const S12 = rnd((2 * N - j - 1) * S9);
      let colour = "ink";
      if (mode === "paint") colour = j % 2 === 0 ? "c" + (Math.trunc(j / 2) % 7) : "paper";
      else if (mode === "fill") colour = j % 2 === 0 ? "ink" : "paper";
      circles.push({ x: corner.x, y: corner.y, r: S12, colour,
        filled: mode === "fill" || mode === "paint" });
    }
  }

  // DrawEdges(): only even j, two detached strokes per marker, on spread rays.
  const edges = [];
  if (mode === "edges") {
    for (let i = 0; i < S5[Which].length; i++) {
      const corner = S5[Which][i];
      for (let j = 0; j <= 2 * N - 2; j += 2) {
        const S13 = rnd((j + 1) * S9), S14 = rnd(j * S9);
        for (let k = 0; k < 2; k++) {
          const degrees = SA[Which][i][0] + (k === 1 ? SA[Which][i][1] : 0);
          const a = (degrees * Math.PI) / 180;
          edges.push({
            x1: rnd(corner.x + S13 * Math.cos(a)), y1: rnd(corner.y - S13 * Math.sin(a)),
            x2: rnd(corner.x + S14 * Math.cos(a)), y2: rnd(corner.y - S14 * Math.sin(a)),
            vertex: i, degrees: degrees,
          });
        }
      }
    }
  }

  // DrawExtra() and FromTo(): one outward corner piece per side.
  const extras = [];
  if (Extra) {
    const count = S5[Which].length;
    const S11 = (S6[Which] * (100 - Part)) / 100 / 2.8;
    for (let i = 0; i < count; i++) {
      const p = S5[Which][i], q = S5[Which][(i + 1) % count];
      const S15 = Math.trunc((p.x + q.x) / 2), S16 = Math.trunc((p.y + q.y) / 2);
      const S21 = S11 / (S6[Which] / 2);
      const f = (v) => ({ x: rnd(S15 + S21 * (v.x - S15)), y: rnd(S16 + S21 * (v.y - S16)) });
      const S17 = f(p), S18 = f(q);
      const S19factor = Which === 0 ? Math.sqrt(3) / 2 : 0.5;
      const S19 = {
        x: rnd(S15 + S19factor * (S18.y - S17.y)),
        y: rnd(S16 - S19factor * (S18.x - S17.x)),
      };
      extras.push({ a: S17, apex: S19, b: S18, mid: { x: S15, y: S16 },
        factor: S19factor, filled: mode === "fill" || mode === "paint",
        colour: mode === "paint" ? "c0" : "ink", base: mode === "edges" });
    }
  }
  return { radius: S2, cx: S3, cy: S4, points: S5, dist: S6, step: S9,
    mask: S5[Which], circles, edges, extras, swapped };
}

const pt = (p) => [p.x, p.y];
const samePt = (a, b) => a.x === b.x && a.y === b.y;

function disagreements(a, b) {
  const bad = [];
  const push = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(name); };
  push("radius/cx/cy", [a.radius, a.cx, a.cy], [b.radius, b.cx, b.cy]);
  push("points", a.points, b.points);
  push("dist", a.dist, b.dist);
  if (Math.abs(a.step - b.step) > 1e-12) bad.push("step");
  push("mask", a.mask, b.mask);
  for (const key of ["circles", "edges", "extras"]) {
    if (a[key].length !== b[key].length) { bad.push(key + " count"); continue; }
    for (let i = 0; i < a[key].length; i++) {
      if (JSON.stringify(a[key][i]) !== JSON.stringify(b[key][i])) { bad.push(key + "[" + i + "]"); break; }
    }
  }
  return bad;
}

const configurations = [];
for (const which of [0, 1]) {
  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    for (let part = C.MIN_PART; part <= C.MAX_PART; part++) {
      for (const mode of C.MODES) {
        for (const extra of [false, true]) {
          for (const swapped of [false, true]) {
            configurations.push(C.start({ which, n, part, mode, extra, swapped }));
          }
        }
      }
    }
  }
}

{
  let mismatches = 0, first = null;
  for (const state of configurations) {
    const got = C.scene(state);
    const want = appletCanvas(state.n, state.part, state.which, state.mode,
      state.extra, state.swapped, state.width, state.height);
    const gotLayout = { radius: got.layout.radius, cx: got.layout.cx, cy: got.layout.cy,
      points: got.layout.points, dist: got.layout.dist, step: got.layout.step, mask: got.mask,
      circles: got.circles, edges: got.edges, extras: got.extras };
    const bad = disagreements(gotLayout, want);
    if (bad.length) {
      mismatches++;
      if (!first) first = { state: { ...state }, bad: bad.slice(0, 4) };
    }
  }
  check(`${configurations.length} configurations: the second bytecode transcription agrees exactly`,
    mismatches === 0, `${mismatches} mismatches, first ${JSON.stringify(first)}`);
}

/* ---------------------------- 3. other canvas sizes ------------------------- */

{
  let mismatches = 0, first = null, total = 0;
  for (const [width, height] of [[240, 180], [300, 400], [460, 352], [120, 100]]) {
    for (const n of [1, 2, 5, C.MAX_N]) {
      for (const part of [0, 1, 25, 50, 75, 99, 100]) {
        for (const which of [0, 1]) {
          for (const mode of C.MODES) {
            for (const extra of [false, true]) {
              const state = C.start({ which, n, part, mode, extra, width, height });
              const got = C.scene(state);
              const want = appletCanvas(n, part, which, mode, extra, false, width, height);
              total++;
              const bad = disagreements({ radius: got.layout.radius, cx: got.layout.cx,
                cy: got.layout.cy, points: got.layout.points, dist: got.layout.dist,
                step: got.layout.step, mask: got.mask,
                circles: got.circles, edges: got.edges, extras: got.extras }, want);
              if (bad.length) { mismatches++; if (!first) first = { state, bad }; }
            }
          }
        }
      }
    }
  }
  check(`${total} configurations at four other canvas sizes match the bytecode too`,
    mismatches === 0, `${mismatches} mismatches, first ${JSON.stringify(first)}`);
}

/* ------------------------- 4. the page's exact claims ----------------------- */

{
  let defects = 0;
  for (const state of configurations) {
    const s = C.scene(state);
    const claims = C.claims(state);
    // "edgeless triangle (square)": the default and all non-edge modes draw no
    // line at all, and the mask is painted in the field colour after the rings.
    if (state.mode !== "edges" && (s.edges.length !== 0 || !claims.noDrawnSides)) defects++;
    if (s.maskColour !== s.fieldColour || !claims.maskIsBackground) defects++;
    if (s.order.indexOf("circles") > s.order.indexOf("mask")) defects++;
    // "Once edges are used elsewhere ... less prominent": in Show edges mode
    // the dashes lie along the two sides meeting at each corner.
    if (state.mode === "edges") {
      let onSides = 0;
      for (const e of s.edges) {
        const p = s.mask[e.vertex];
        const a = (e.degrees * Math.PI) / 180;
        const dx = Math.cos(a), dy = -Math.sin(a);
        const off = (q) => Math.abs((q.x - p.x) * dy - (q.y - p.y) * dx);
        if (off({ x: e.x1, y: e.y1 }) <= 0.75 && off({ x: e.x2, y: e.y2 }) <= 0.75) onSides++;
      }
      if (onSides !== s.edges.length || !claims.allEdgesOnSides) defects++;
    }
  }
  check(`${configurations.length} configurations: the middle is the field colour and no side is drawn unless Show edges is on`,
    defects === 0, `${defects} defects`);
}

{
  let offRay = 0, checked = 0;
  for (const which of [0, 1]) {
    for (const n of [1, 2, 5, 10]) {
      for (const part of [10, 50, 100]) {
        const s = C.scene(C.start({ which, n, part, mode: "edges" }));
        for (const e of s.edges) {
          const v = s.mask[e.vertex];
          const deg = (e.degrees * Math.PI) / 180;
          const dx = Math.cos(deg), dy = -Math.sin(deg);
          for (const p of [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }]) {
            // Each rounded endpoint is at most half a pixel off its ray.
            const cross = Math.abs((p.x - v.x) * dy - (p.y - v.y) * dx);
            if (cross > 0.75) offRay++;
            checked++;
          }
        }
      }
    }
  }
  check(`${checked} edge-stroke endpoints sit on the spread rays from their corner`,
    offRay === 0, `${offRay} off-ray`);
}

{
  // The spread angles are the exact directions of the sides at every corner.
  let wrong = 0;
  for (const which of [0, 1]) {
    const g = C.layout(C.start({ which }));
    const ring = g.points[which];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const r = ring[(i + ring.length - 1) % ring.length];
      const sideAngle = (u, v) => (Math.atan2(-(v.y - u.y), v.x - u.x) * 180) / Math.PI;
      const given = C.SPREAD_ANGLES[which][i];
      const wrap = (d) => ((d % 360) + 360) % 360;
      const expected = [wrap(sideAngle(p, r)), wrap(sideAngle(p, q))].sort((a, b) => a - b);
      const actual = [wrap(given[0]), wrap(given[0] + given[1])].sort((a, b) => a - b);
      for (let k = 0; k < 2; k++) {
        const diff = Math.abs(actual[k] - expected[k]);
        if (Math.min(diff, 360 - diff) > 0.5) wrong++;
      }
    }
  }
  check("the two spread rays at each corner point along the two polygon sides", wrong === 0, `${wrong} wrong`);
}

/* ------------------------------ 5. fixed geometry --------------------------- */

{
  let wrong = 0;
  for (const [width, height] of [[360, 320], [240, 180], [300, 400], [460, 352], [120, 100]]) {
    const g = C.layout(C.start({ width, height }));
    if (g.radius !== Math.trunc(Math.min(width, height) / 3)) wrong++;
    if (g.cx !== Math.trunc(width / 2) || g.cy !== Math.trunc(height / 2)) wrong++;
    for (let i = 0; i < 3; i++) {
      const p = g.points[0][i];
      if (Math.abs(Math.hypot(p.x - g.cx, p.y - (g.cy + Math.trunc(g.cy / 12))) - g.radius) > 0.75) wrong++;
    }
    for (let i = 0; i < 4; i++) {
      const p = g.points[1][i];
      if (Math.abs(Math.hypot(p.x - g.cx, p.y - g.cy) - g.radius) > 0.75) wrong++;
    }
    if (Math.abs(g.dist[0] - Math.sqrt(3) * g.radius) > 1.5) wrong++;
    if (Math.abs(g.dist[1] - Math.SQRT2 * g.radius) > 1.5) wrong++;
  }
  check("corner points use radius min(width,height)/3 and the triangle's cy/12 shift", wrong === 0, `${wrong} wrong`);
}

{
  let wrong = 0;
  for (const state of configurations) {
    const s = C.scene(state);
    const last = 2 * state.n - 2;
    if (state.mode === "paint") {
      for (let j = 0; j <= last; j++) {
        const colour = s.circles[j].colour;
        if (j % 2 === 0 ? colour !== "c" + (Math.trunc(j / 2) % 7) : colour !== "paper") wrong++;
      }
    }
    if (state.mode === "fill") {
      for (let j = 0; j <= last; j++) {
        const colour = s.circles[j].colour;
        if (j % 2 === 0 ? colour !== "ink" : colour !== "paper") wrong++;
      }
    }
    for (const circle of s.circles) if (!(circle.r >= 0) || !Number.isFinite(circle.r)) wrong++;
  }
  check("the paint palette cycles through seven colours; ring radii are finite and nonnegative",
    wrong === 0, `${wrong} wrong`);
}

{
  let wrong = 0, count = 0;
  for (const [width, height] of [[360, 320], [240, 180], [460, 352]]) {
    for (const n of [1, 2, 10]) {
      for (const which of [0, 1]) {
        for (const part of [0, 100]) {
          const state = C.start({ width, height, n, which, part, extra: true });
          const s = C.scene(state);
          count += s.extras.length;
          for (const x of s.extras) {
            if (x.factor !== (which === 0 ? Math.sqrt(3) / 2 : 0.5)) wrong++;
            if (part === 0) {
              // FromTo with gap = dist/2.8 puts both endpoints one 2.8th along the side.
              const d = s.layout.dist[which];
              const want = (v) => ({ x: rnd(x.mid.x + (d / 2.8 / (d / 2)) * (v.x - x.mid.x)),
                y: rnd(x.mid.y + (d / 2.8 / (d / 2)) * (v.y - x.mid.y)) });
              const ring = s.mask;
              const idx = s.extras.indexOf(x);
              const a = want(ring[idx]), b = want(ring[(idx + 1) % ring.length]);
              if (!samePt(x.a, a) || !samePt(x.b, b)) wrong++;
            } else {
              if (!samePt(x.a, x.mid) || !samePt(x.b, x.mid)) wrong++;
            }
          }
        }
      }
    }
  }
  check(`${count} extra pieces: triangle uses sqrt(3)/2, square 1/2, Part 0 and 100 endpoints agree`,
    wrong === 0, `${wrong} wrong`);
}

{
  let wrong = 0;
  for (const part of [0, 1, 50, 99, 100]) {
    const s = C.scene(C.start({ part, n: 10, mode: "edges" }));
    // Each corner gets one stroke pair for each even j: n pairs, two strokes.
    if (s.edges.length !== 2 * s.mask.length * 10) wrong++;
    const small = C.scene(C.start({ part, n: 1 }));
    if (small.circles.length !== small.mask.length) wrong++;
  }
  check("Show edges adds one detached stroke pair per ring interval at each corner", wrong === 0, `${wrong} wrong`);
}

/* ------------------------------- 6. plain data ------------------------------ */

{
  const a = C.start({ n: 5, part: 40, mode: "fill", extra: true, swapped: true });
  const b = C.withOption(a, "n", 6);
  equal("withOption does not mutate its argument", a.n, 5);
  equal("the changed copy carries the other options", [b.n, b.part, b.mode, b.extra, b.swapped],
    [6, 40, "fill", true, true]);
  const toggled = C.switchColors(a);
  equal("Switch colors flips only the roles", [toggled.swapped, toggled.n, toggled.mode], [false, 5, "fill"]);
  const s1 = C.scene(a), s2 = C.scene(toggled);
  equal("switching colours leaves every circle, stroke and piece untouched",
    [s1.circles, s1.edges, s1.extras], [s2.circles, s2.edges, s2.extras]);
  check("the whole position survives JSON round-tripping", JSON.stringify(JSON.parse(JSON.stringify(a))) === JSON.stringify(a));
  check("a scene has the applet's paint order", C.scene(a).order.join(" ") === "field frame circles mask edges extras");
}

done("edge-illusion");
