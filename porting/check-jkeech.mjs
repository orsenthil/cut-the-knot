#!/usr/bin/env node
"use strict";

/*
 * Logic test for jkeech/jkeech-core.js.
 *
 *   node porting/check-jkeech.mjs
 *
 * Section 1 checks the applet's start position and its mouse rules. Section 2
 * is a second, independent transcription of JKeechCanvas.Compute/ComputeC,
 * GeoSDoub.Rotate/Intersect/GetParallelTo/FindCircumcenter and the circle-line
 * intersection, compared with the core over a grid of triangles (including
 * translated and rotated ones). Section 3 checks every claim on the page -
 * CF = CH, the inscribed square, the 45-degree angles and the side formula -
 * on every non-degenerate case in that grid. Section 4 covers the options and
 * the edge cases where the applet's intersection guards return NaN.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const Core = loadCore("jkeech/jkeech-core.js", "JkeechCore");

const Q = Math.PI / 2;
const near = (a, b, eps = 1e-7) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const samePt = (a, b, eps = 1e-7) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const same = (u, v) =>
    (!Number.isFinite(u) && !Number.isFinite(v)) ||
    Math.abs(u - v) <= eps * Math.max(1, Math.abs(u), Math.abs(v));
  return same(a.x, b.x) && same(a.y, b.y);
};
const sq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const d = (a, b) => Math.sqrt(sq(a, b));
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const turn = (p, v) => ({ x: p.x * Math.cos(v) - p.y * Math.sin(v),
                          y: p.x * Math.sin(v) + p.y * Math.cos(v) });
const shift = (p, x, y) => ({ x: p.x + x, y: p.y + y });

/* ------------------- a second transcription, straight from the bytecode ---- */

function jRotate(c, p, angle, dir) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return {
    x: c.x + co * (p.x - c.x) - dir * si * (p.y - c.y),
    y: c.y + dir * si * (p.x - c.x) + co * (p.y - c.y),
  };
}

function jIntersect(a, b, c, e) {
  const t1 = a.y - b.y, u1 = b.x - a.x, v1 = a.x * b.y - a.y * b.x;
  const t2 = c.y - e.y, u2 = e.x - c.x, v2 = c.x * e.y - c.y * e.x;
  const det = t1 * u2 - u1 * t2;
  if (Math.abs(det) <= 1) return { x: NaN, y: NaN };
  return { x: (u1 * v2 - u2 * v1) / det, y: (v1 * t2 - v2 * t1) / det };
}

function jComputeC(A, B, angleA) {
  const p = jRotate(A, B, angleA, -1);
  const q = jRotate(B, A, Q - angleA, 1);
  return jIntersect(A, p, B, q);
}

function jParallel(a, b, c) {
  return { x: a.x + 100 * (b.x - c.x), y: a.y + 100 * (b.y - c.y) };
}

function jCircumcentre(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const p = { x: m1.x + b.y - a.y, y: m1.y - b.x + a.x };
  const q = { x: m2.x + c.y - b.y, y: m2.y - c.x + b.x };
  return jIntersect(m1, p, m2, q);
}

/* GeoSDoub.Intersect(DoubCircle,DoubLine), including the |dy| > 1 fork. */
function jCircleLine(circle, a, b) {
  if (Math.abs(a.y - b.y) > 1) {
    const m = (b.x - a.x) / (b.y - a.y);
    const z = b.x - m * b.y;
    const q = 1 + m * m;
    const p = m * (z - circle.c.x) - circle.c.y;
    const k = circle.c.y ** 2 + (z - circle.c.x) ** 2 - circle.r ** 2;
    const disc = p * p - q * k;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    return [{ x: m * ((-p + s) / q) + z, y: (-p + s) / q },
            { x: m * ((-p - s) / q) + z, y: (-p - s) / q }];
  }
  if (Math.abs(a.x - b.x) > 1) {
    const m = (b.y - a.y) / (b.x - a.x);
    const z = b.y - m * b.x;
    const q = 1 + m * m;
    const p = m * (z - circle.c.y) - circle.c.x;
    const k = circle.c.x ** 2 + (z - circle.c.y) ** 2 - circle.r ** 2;
    const disc = p * p - q * k;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    return [{ x: (-p + s) / q, y: m * ((-p + s) / q) + z },
            { x: (-p - s) / q, y: m * ((-p - s) / q) + z }];
  }
  return null;
}

function jAngle(v, p, q) {
  const a = sq(v, p), b = sq(v, q), c = sq(p, q);
  return Math.acos(((a + b - c) / 2) / (Math.sqrt(a) * Math.sqrt(b)));
}

/* JKeechCanvas.Compute and its two helpers, with no use of the core. */
function jCompute(A, B, C) {
  const L = jRotate(B, C, Q, 1);
  const K = jRotate(C, B, Q, -1);
  const D = jRotate(C, A, Q, 1);
  const E = jRotate(A, C, Q, -1);
  const F = jIntersect(A, L, B, C);
  const H = jIntersect(B, E, A, C);
  const Z = jIntersect(H, jParallel(H, B, C), F, jParallel(F, A, C));
  const M = { x: (F.x + H.x) / 2, y: (F.y + H.y) / 2 };
  const radius = (d(M, C) + d(M, Z)) / 2;
  const circle = { c: M, r: radius };
  const hits = jCircleLine(circle, A, B);
  const G = hits && hits.length > 1 ? (d(hits[0], Z) < 1 ? hits[1] : hits[0]) : null;
  return { L, K, D, E, F, H, Z, M, circle, hits, G };
}

function compare(label, A, B, C) {
  const g = Core.geometry({ A, B, C });
  const j = jCompute(A, B, C);
  for (const name of ["L", "K", "D", "E", "F", "H", "Z", "M", "G"]) {
    check(`${label}: ${name}`, samePt(g[name], j[name]),
      `${JSON.stringify(g[name])} vs ${JSON.stringify(j[name])}`);
  }
  check(`${label}: circle centre`, samePt(g.circle.c, j.circle.c));
  check(`${label}: circle radius`, near(g.circle.r, j.circle.r));
  check(`${label}: hits`, (!g.hits && !j.hits) ||
    (!!g.hits && !!j.hits && g.hits.length === j.hits.length &&
     g.hits.every((p, i) => samePt(p, j.hits[i]))));
  check(`${label}: CF`, near(g.CF, d(C, j.F)));
  check(`${label}: CH`, near(g.CH, d(C, j.H)));
  check(`${label}: FZ`, near(g.FZ, d(j.F, j.Z)));
  check(`${label}: HZ`, near(g.HZ, d(j.H, j.Z)));
  return g;
}

const cases = [];
for (const bx of [200, 250, 300, 350, 400]) {
  for (const by of [200, 275, 330]) {
    for (let deg = 5; deg <= 85; deg += 5) {
      const A = { x: 150, y: 275 }, B = { x: bx, y: by };
      cases.push({ A, B, C: jComputeC(A, B, deg * Math.PI / 180), deg });
    }
  }
}
for (const rotation of [0.31, 1.2, -0.7]) {
  for (const [dx, dy] of [[37, 51], [-90, 120]]) {
    for (const deg of [12, 33, 55, 79]) {
      const A = shift(turn({ x: 150, y: 275 }, rotation), dx, dy);
      const B = shift(turn({ x: 300 - 150, y: 0 }, rotation), A.x, A.y);
      cases.push({ A, B, C: jComputeC(A, B, deg * Math.PI / 180), deg });
    }
  }
}

/* ------------------------------------------------- 1. the start and the mouse */

{
  const s = Core.start({});
  equal("applet starting A (W/3, 11H/16)", s.A, { x: 150, y: 275 });
  equal("applet starting B (2W/3, 11H/16)", s.B, { x: 300, y: 275 });
  check("applet starting angle is 30 degrees", near(s.angleA, Math.PI / 6));
  check("start C is computed, not (0,0)", samePt(s.C, jComputeC(s.A, s.B, Math.PI / 6)) &&
    d(s.C, { x: 0, y: 0 }) > 10);
  check("start has every option off", !s.showNames && !s.showStatement && !s.showExtra);
  check("a fresh demonstration has not ended", Core.result(s) === null);
  const snapshot = Core.snapshot(s);
  check("snapshot is plain data with a copy of C", snapshot.C !== s.C && samePt(snapshot.C, s.C));

  // ComputeC keeps angle A and the right angle at C.
  check("start triangle has a right angle at C",
    near(jAngle(s.C, s.A, s.B), Q, 1e-6));
  const movedA = Core.move(s, { type: "vertex", name: "A", x: 140, y: 250 });
  check("dragging A rebuilds C with the same angle at A",
    near(jAngle(movedA.A, movedA.B, movedA.C), s.angleA, 1e-6) &&
    near(jAngle(movedA.C, movedA.A, movedA.B), Q, 1e-6));
  const movedB = Core.move(s, { type: "vertex", name: "B", x: 330, y: 260 });
  check("dragging B rebuilds C with the same angle at A",
    near(jAngle(movedB.A, movedB.B, movedB.C), s.angleA, 1e-6) &&
    near(jAngle(movedB.C, movedB.A, movedB.B), Q, 1e-6));
  check("dragging changes the position", !samePt(movedB.B, s.B));

  // C is a circle glider: grabbing it makes a circle through A, B, C.
  const grabbed = Core.grab(s, "C");
  check("grabbing C makes the applet's circumcircle", !!grabbed.glideCircle &&
    near(d(grabbed.glideCircle.c, s.A), d(grabbed.glideCircle.c, s.C), 1e-6) &&
    near(jCircumcentre(s.A, s.B, s.C).x, grabbed.glideCircle.c.x, 1e-6));
  const swept = Core.move(grabbed, { type: "vertex", name: "C", x: 220, y: 180 });
  check("C stays on its circle while being dragged",
    near(d(swept.C, grabbed.glideCircle.c), grabbed.glideCircle.r, 1e-6));
  check("the angle at C survives the sweep",
    near(jAngle(swept.C, swept.A, swept.B), Q, 1e-5));
  check("sweeping C updates the angle at A",
    !near(swept.angleA, s.angleA) &&
    near(swept.angleA, jAngle(swept.A, swept.B, swept.C), 1e-6));
  check("the release clears the glider", Core.release(swept).glideCircle === null);
  check("grabbing A clears the glider", Core.grab(grabbed, "A").glideCircle === null);
  const freeC = Core.move(s, { type: "vertex", name: "C", x: 200, y: 170 });
  check("a keyboard move of C is not constrained without a grab",
    samePt(freeC.C, { x: 200, y: 170 }) && near(freeC.angleA, jAngle(s.A, s.B, freeC.C), 1e-6));
  const outside = Core.move(s, { type: "vertex", name: "C", x: 900, y: -40 });
  check("dragging outside the canvas is clamped", outside.C.x === Core.WIDTH && outside.C.y === 0);
  check("unknown actions are refused", Core.move(s, { type: "vertex", name: "Q", x: 1, y: 2 }) === s &&
    Core.move(s, { type: "option", key: "nonesuch", value: true }) === s &&
    Core.move(s, null) === s);
  check("a demonstration never wins or loses", Core.result(Core.move(s, { type: "option",
    key: "showExtra", value: true })) === "done");
}

/* --------------------- 2. the whole computation, twice, for every triangle */

{
  let active = 0;
  for (const { A, B, C, deg } of cases) {
    const g = compare(`A=${A.x},${A.y} B=${B.x},${B.y} angle=${deg}`, A, B, C);
    if (g.active) active++;
    check(`angleA=${deg}: foot matches the second transcription`,
      samePt(g.foot, (() => {
        const u = { x: B.x - A.x, y: B.y - A.y };
        const t = ((C.x - A.x) * u.x + (C.y - A.y) * u.y) / (u.x * u.x + u.y * u.y);
        return { x: A.x + u.x * t, y: A.y + u.y * t };
      })()));
    if (g.active && g.G) {
      check(`angleA=${deg}: angles match the transcription`,
        Object.keys(g.angles).every((k) => near(g.angles[k],
          jAngle(g.G, k.indexOf("F") === 0 ? g.F : g.H,
            k.indexOf("B") >= 0 ? B : k.indexOf("A") >= 0 ? A : C), 1e-6)));
    }
  }
  check("the grid contains 279 triangles", cases.length === 279);
  check("the grid has non-degenerate drawings", active > 250);
}

/* ----------------------- 3. every claim on the original page, exhaustively */

{
  let tested = 0, square = 0, onAB = 0, circles = 0, formula = 0, fortyFive = 0;
  for (const { A, B, C } of cases) {
    const g = Core.geometry({ A, B, C });
    if (!g.active || !g.G || !Number.isFinite(g.angles.FGB)) continue;
    tested++;
    const s = g.CF;
    const sides = [d(C, g.F), d(C, g.H), d(g.F, g.Z), d(g.H, g.Z)];
    if (sides.every((v) => near(v, s, 1e-7))) square++;
    const corners = [[C, g.F, g.Z], [g.F, g.Z, g.H], [g.Z, g.H, C], [g.H, C, g.F]];
    if (corners.every(([p, q, r]) => near(dot({ x: q.x - p.x, y: q.y - p.y },
      { x: r.x - q.x, y: r.y - q.y }), 0, 1e-6 * s * s))) square++;
    if (Math.abs(cross({ x: B.x - A.x, y: B.y - A.y },
      { x: g.Z.x - A.x, y: g.Z.y - A.y })) < 1e-6 * d(A, B)) onAB++;
    if (Math.abs(cross({ x: B.x - A.x, y: B.y - A.y },
      { x: g.G.x - A.x, y: g.G.y - A.y })) < 1e-6 * d(A, B) &&
      near(d(g.circle.c, g.Z), g.circle.r, 1e-7) &&
      near(d(g.circle.c, g.C), g.circle.r, 1e-7) &&
      near(d(g.circle.c, g.F), g.circle.r, 1e-7) &&
      near(d(g.circle.c, g.H), g.circle.r, 1e-7)) circles++;
    const legs = [d(A, C), d(B, C)];
    if (near(s, (legs[0] * legs[1]) / (legs[0] + legs[1]), 1e-7)) formula++;
    if (Object.values(g.angles).every((v) => near(v, Math.PI / 4, 1e-6))) fortyFive++;
    check(`square side = ac*bc/(ac+bc) at angle=${Math.round((Math.atan2(
      C.y - A.y, C.x - A.x)) * 180 / Math.PI)}`,
    near(s, (d(A, C) * d(B, C)) / (d(A, C) + d(B, C)), 1e-7));
  }
  check("every case in the grid was usable", tested > 250);
  check("CF = CH = FZ = HZ in every case", square === 2 * tested);
  check("Z always lies on AB", onAB === tested);
  check("G lies on AB and H,C,F,Z lie on the same circle", circles === tested);
  check("four angles at G are each half a right angle", fortyFive === tested);
  check("inscribed square side formula holds in every case", formula === tested);

  const s = Core.start({});
  const g = Core.geometry(s);
  check("the applet's opening figure gives CF = CH = 47.548...",
    near(g.CF, 47.5480947161671) && near(g.CH, g.CF));
  check("its G is the foot of the altitude from C",
    near(g.G.x, s.C.x, 1e-6) && near(g.G.y, s.B.y, 1e-6) && samePt(g.G, g.foot));
  check("the page's four angles are 45 degrees in the opening figure",
    Object.values(g.angles).every((v) => near(v, Math.PI / 4, 1e-6)));
  check("the angle claim is independent of triangle size", (() => {
    const small = Core.start({ width: 120, height: 110 });
    const sg = Core.geometry(small);
    return sg.active && sg.G &&
      Object.values(sg.angles).every((v) => near(v, Math.PI / 4, 1e-6)) &&
      near(sg.CF, d(small.A, small.C) * d(small.B, small.C) /
        (d(small.A, small.C) + d(small.B, small.C)), 1e-6);
  })());
}

/* --------------------------------------------- 4. options and edge cases */

{
  const s = Core.start({});
  for (const key of Core.OPTION_KEYS) {
    const on = Core.move(s, { type: "option", key, value: true });
    check(`${key} can be switched on and off`,
      on[key] === true && Core.move(on, { type: "option", key, value: false })[key] === false);
  }
  const all = Core.move(Core.move(Core.move(s,
    { type: "option", key: "showNames", value: true }),
    { type: "option", key: "showStatement", value: true }),
    { type: "option", key: "showExtra", value: true });
  check("all three checkboxes may be on together",
    all.showNames && all.showStatement && all.showExtra);
  check("reset restores the opening figure and clears options", (() => {
    const r = Core.move(all, { type: "reset" });
    return samePt(r.A, s.A) && samePt(r.B, s.B) && samePt(r.C, s.C) &&
      !r.showNames && !r.showStatement && !r.showExtra && Core.result(r) === null;
  })());
  const custom = Core.start({ showNames: true, showExtra: true, angleA: Math.PI / 4 });
  check("start honours the applet's option and angle values",
    custom.showNames && custom.showExtra && near(custom.angleA, Math.PI / 4));
  check("the circle-line intersection has a horizontal and a vertical branch", (() => {
    const circle = { c: { x: 100, y: 100 }, r: 20 };
    const h = Core.circleLine(circle, { x: 70, y: 100 }, { x: 130, y: 100 });
    const v = Core.circleLine(circle, { x: 100, y: 70 }, { x: 100, y: 130 });
    const hx = h && h.map((p) => p.x).sort((a, b) => a - b);
    const vy = v && v.map((p) => p.y).sort((a, b) => a - b);
    return hx && vy && hx.length === 2 && vy.length === 2 &&
      near(hx[0], 80) && near(hx[1], 120) && near(vy[0], 80) && near(vy[1], 120);
  })());
  check("a line that misses the circle gives no hits",
    Core.circleLine({ c: { x: 0, y: 0 }, r: 2 },
      { x: 10, y: 0 }, { x: 10, y: 30 }) === null);
  check("the Other helper picks the point away from Z", (() => {
    const hits = [{ x: 5, y: 0 }, { x: 90, y: 0 }];
    return Core.other(hits, { x: 5.1, y: 0 }) === hits[1] &&
      Core.other(hits, { x: 50, y: 0 }) === hits[0];
  })());
  check("a zero angle makes C land on B, where the drawing stops being useful",
    Core.geometry(Core.start({ angleA: 0 })).active === false);
  check("a right-angle A gives a parallel intersection and no drawing",
    Core.geometry(Core.start({ angleA: Math.PI / 2 })).active === false);
  const degenerate = Core.start({ A: { x: 150, y: 275 }, B: { x: 150, y: 275 },
    C: { x: 200, y: 100 } });
  check("a degenerate base yields NaN guards, not a crash",
    !Number.isFinite(Core.intersect({ x: 0, y: 0 }, { x: 0, y: 10 },
      { x: 0, y: 0 }, { x: 0, y: 10 }).x) && degenerate.A.x === 150);
  check("a non-finite drag is refused",
    Core.move(s, { type: "vertex", name: "A", x: NaN, y: 2 }) === s);
  check("a glide to the circle centre still returns a point",
    Core.finite(Core.glide({ x: 100, y: 100 }, { c: { x: 100, y: 100 }, r: 5 })));
}

done("jkeech");
