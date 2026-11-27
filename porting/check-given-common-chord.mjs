#!/usr/bin/env node
"use strict";

/*
 * Logic test for given-common-chord/given-common-chord-core.js.
 *
 *   node porting/check-given-common-chord.mjs
 *
 * The page sets two fill-in-the-blank spans. Its own script
 * cut-the-knot.org/js/OutlineMenu.js treats the first comma-separated entry as
 * the correct one, so the exact claims are: the tangent case has "one
 * solution", and the line through P is "parallel" to O1T. It also says that
 * crossing auxiliary circles give two solutions and that no intersection
 * means no solution, and that the chord cut has the given length a.
 *
 * This test first checks the drawing rules (the opening handles, the horizontal
 * length segment, circle drags, the panel options and the guards). It then
 * transcribes the applet's Compute, GeoSDoub and Other a second time, straight
 * from the bytecode, and compares the two over a grid plus 2,000 seeded random
 * layouts. Finally it checks every page claim with independent vector geometry:
 * the number of solutions, the parallel direction, the midpoints under the two
 * centres, and the chord length. The applet uses floor(L/2), so an odd L cuts
 * L-1 rather than L; that quirk is asserted, not hidden.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("given-common-chord/given-common-chord-core.js", "GivenCommonChordCore");
const pt = (x, y) => ({ x, y });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const same = (a, b, eps = 1e-6) => !!a && !!b && near(a.x, b.x, eps) && near(a.y, b.y, eps);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const vecCross = (a, b, c, d) =>
  (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the opening A", s.A, pt(320, 57.5));
  equal("the opening B", s.B, pt(580, 57.5));
  equal("the opening length is 260", s.L, 260);
  equal("the opening centre of circle 1", s.C1, pt(228, 322));
  equal("the opening rim of circle 1", s.R1, pt(78, 322));
  equal("the opening centre of circle 2", s.C3, pt(384, 322));
  equal("the opening rim of circle 2", s.R3, pt(504, 322));
  check("line 1, no hint and no names are selected at first",
    s.whichLine === 0 && !s.showHint && !s.showNames);
  check("this is an illustration with no result to announce", C.result(s) === null);
  equal("all six handles are draggable", C.legalMoves(),
    ["A", "B", "C1", "R1", "C3", "R3"]);

  const g = C.compute(s);
  check("the opening drawing has two solutions", g.solutionCount === 2 && !g.noSolution);
  check("the opening chord is the given length", near(g.chord1, 260) && near(g.chord2, 260));
  check("the status describes the two lines",
    /Two lines through P work/.test(C.describe(s)) && /line 1/.test(C.describe(s)));

  check("an unknown handle is refused", C.movePoint(s, "P", pt(1, 1)) === s);
  check("a non-numeric pointer is refused",
    C.movePoint(s, "A", pt(NaN, 1)) === s && C.movePoint(s, "C1", null) === s);
  check("A slides only along its row and truncates L", (() => {
    const m = C.movePoint(s, "A", pt(200.9, 300));
    return same(m.A, pt(200.9, 57.5)) && m.L === 379 && m.B.y === 57.5 && m.explored;
  })());
  check("B slides only along its row and can cross A", (() => {
    const m = C.movePoint(s, "B", pt(100, 10));
    return same(m.B, pt(100, 57.5)) && m.L === 220 &&
      C.movePoint(m, "B", pt(-9, 0)).B.x === C.MARGIN;
  })());
  check("a point off the board is clamped", (() => {
    const m = C.movePoint(s, "C1", pt(-99, 999));
    return m.C1.x === C.MARGIN && m.C1.y === C.HEIGHT - C.MARGIN;
  })());
  check("dragging a centre or a rim changes the radius", (() => {
    const m = C.movePoint(s, "C3", pt(300, 200));
    return dist(m.C3, m.R3) > 100 && m.moves === 1;
  })());
  check("dragging a whole circle keeps its radius", (() => {
    const r = dist(s.C1, s.R1);
    const m = C.translateCircle(s, 1, 30, -20);
    return near(dist(m.C1, m.R1), r) && same(m.C1, pt(258, 302)) && same(m.R1, pt(108, 302));
  })());
  check("a whole-circle drag is clamped by both of its handles", (() => {
    const m = C.translateCircle(s, 2, 900, 900);
    return m.C3.x <= C.WIDTH - C.MARGIN && m.R3.y <= C.HEIGHT - C.MARGIN;
  })());
  check("an unknown option and an unknown radio choice are refused",
    C.setOption(s, "nonesuch", true) === s && C.setWhichLine(s, 9) === s);
  check("the panel choices each take effect and can be undone", (() => {
    let t = C.setOption(s, "showHint", true);
    t = C.setOption(t, "showNames", true);
    t = C.setWhichLine(t, 2);
    return t.showHint && t.showNames && t.whichLine === 2 &&
      !C.setWhichLine(t, 1).showHint === false && C.setWhichLine(t, 1).whichLine === 1;
  })());
  check("reset restores the opening handles and keeps the panel", (() => {
    let t = C.movePoint(s, "R3", pt(500, 200));
    t = C.setOption(t, "showHint", true);
    t = C.setWhichLine(t, 1);
    const r = C.reset(t);
    return same(r.R3, pt(504, 322)) && r.L === 260 && r.showHint &&
      r.whichLine === 1 && r.moves === 0 && !r.explored;
  })());
  check("short length and tiny circles stop the drawing", (() => {
    const short = C.start({ A: pt(100, 57.5), B: pt(101, 57.5) });
    const tiny = C.start({ R1: pt(229, 322) });
    return C.compute(short).noDraw && C.compute(tiny).noDraw &&
      /at least 2 units/.test(C.describe(short));
  })());
  check("circles that do not meet are reported, not drawn", (() => {
    const apart = C.start({ C1: pt(100, 322), R1: pt(40, 322),
      C3: pt(560, 322), R3: pt(620, 322) });
    const g2 = C.compute(apart);
    return g2.noSolution && !g2.P && /have to meet/.test(C.describe(apart));
  })());
  check("centres too close for the length are reported", (() => {
    const close = C.start({ A: pt(100, 57.5), B: pt(500, 57.5),
      C1: pt(250, 300), R1: pt(150, 300), C3: pt(290, 300), R3: pt(390, 300) });
    const g2 = C.compute(close);
    return g2.noSolution && !!g2.P && /too close/.test(C.describe(close));
  })());
}

/* ---------------- 2. a second, literal transcription of the applet bytecode */

/* GeoSDoub.IntersectCirclesX(c0,c1), javap names m,b,h,a,k,c,disc. */
function apCirclesX(c0, c1) {
  const m = -(c0.y - c1.y) / (c0.x - c1.x);
  const b = (c0.x ** 2 - c1.x ** 2 + c0.y ** 2 - c1.y ** 2 -
    c0.r ** 2 + c1.r ** 2) / 2 / (c0.x - c1.x);
  const h = b - c0.x;
  const a = m * m + 1;
  const k = m * h - c0.y;
  const c = h * h + c0.y * c0.y - c0.r * c0.r;
  const disc = k * k - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y1 = (-k + root) / a, y2 = (-k - root) / a;
  return [pt(m * y1 + b, y1), pt(m * y2 + b, y2)];
}

/* GeoSDoub.IntersectCirclesY(c0,c1). */
function apCirclesY(c0, c1) {
  const m = -(c0.x - c1.x) / (c0.y - c1.y);
  const b = (c0.y ** 2 - c1.y ** 2 + c0.x ** 2 - c1.x ** 2 -
    c0.r ** 2 + c1.r ** 2) / 2 / (c0.y - c1.y);
  const h = b - c0.y;
  const a = m * m + 1;
  const k = m * h - c0.x;
  const c = h * h + c0.x * c0.x - c0.r * c0.r;
  const disc = k * k - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x1 = (-k + root) / a, x2 = (-k - root) / a;
  return [pt(x1, m * x1 + b), pt(x2, m * x2 + b)];
}

function apCircleCircle(c0, c1) {
  if (Math.abs(c0.x - c1.x) > 1) return apCirclesX(c0, c1);
  if (Math.abs(c0.y - c1.y) > 1) return apCirclesY(c0, c1);
  return [pt(c0.x, c0.y), pt(c0.x, c0.y)];
}

/* GeoSDoub.Intersect(DoubLine,DoubCircle) and IntersectX / IntersectY. */
function apLineX(p, q, c) {
  const m = (p.x - q.x) / (p.y - q.y);
  const b = q.x - m * q.y;
  const a = m * m + 1;
  const k = m * (b - c.x) - c.y;
  const c0 = c.y * c.y + (b - c.x) * (b - c.x) - c.r * c.r;
  const disc = k * k - a * c0;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y1 = (-k + root) / a, y2 = (-k - root) / a;
  return [pt(m * y1 + b, y1), pt(m * y2 + b, y2)];
}
function apLineY(p, q, c) {
  const m = (p.y - q.y) / (p.x - q.x);
  const b = q.y - m * q.x;
  const a = m * m + 1;
  const k = m * (b - c.y) - c.x;
  const c0 = c.x * c.x + (b - c.y) * (b - c.y) - c.r * c.r;
  const disc = k * k - a * c0;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x1 = (-k + root) / a, x2 = (-k - root) / a;
  return [pt(x1, m * x1 + b), pt(x2, m * x2 + b)];
}
function apLineCircle(p, q, c) {
  if (Math.abs(p.y - q.y) > 1) return apLineX(p, q, c);
  if (Math.abs(p.x - q.x) > 1) return apLineY(p, q, c);
  return null;
}

/* GivenCommonChordCanvas.Other: hits[0] unless it is less than 1 from P. */
function apOther(hits, p) {
  if (!hits) return null;
  if (Math.hypot(hits[0].x - p.x, hits[0].y - p.y) >= 1) return hits[0];
  return hits[1] || null;
}

/* GeoSDoub.NearestPoint(p,a,b). */
function apFoot(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  if ((p.x - a.x) ** 2 + (p.y - a.y) ** 2 < 0.1) return pt(p.x, p.y);
  const t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy);
  return pt(a.x + t * vx, a.y + t * vy);
}

/** The whole of GivenCommonChordCanvas.Compute, following the bytecode order. */
function apCompute(s) {
  const out = {
    noDraw: false, noSolution: false, P: null, Q: null, T: null,
    M: [null, null], N: [null, null], feet: [null, null],
    chord1: NaN, chord2: NaN, solutionCount: 0,
    cOO: null, cL: null, half: Math.floor(s.L / 2),
  };
  const r1 = Math.hypot(s.C1.x - s.R1.x, s.C1.y - s.R1.y);
  const r2 = Math.hypot(s.C3.x - s.R3.x, s.C3.y - s.R3.y);
  if (s.L < 2 || r1 < 2 || r2 < 2) { out.noDraw = true; return out; }
  const c1 = { x: s.C1.x, y: s.C1.y, r: r1 };
  const c2 = { x: s.C3.x, y: s.C3.y, r: r2 };
  const d = Math.hypot(c1.x - c2.x, c1.y - c2.y);
  out.cOO = { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2, r: d / 2 };
  out.cL = { x: c1.x, y: c1.y, r: out.half };
  const hits = apCircleCircle(c1, c2);
  if (hits) {
    out.Q = hits[0];
    out.P = hits[1] || hits[0];
  }
  /* The branch at bytecode 243: if hits === null or floor(L/2) > d, return. */
  if (!hits || out.half > d) { out.noSolution = true; return out; }
  out.T = apCircleCircle(out.cOO, out.cL);
  const p = out.P;
  const l0 = pt(p.x + 100 * (c1.x - out.T[0].x), p.y + 100 * (c1.y - out.T[0].y));
  const l1 = pt(p.x + 100 * (c1.x - out.T[1].x), p.y + 100 * (c1.y - out.T[1].y));
  out.M[0] = apOther(apLineCircle(l0, p, c1), p);
  out.M[1] = apOther(apLineCircle(l0, p, c2), p);
  out.N[0] = apOther(apLineCircle(l1, p, c1), p);
  out.N[1] = apOther(apLineCircle(l1, p, c2), p);
  if (s.whichLine === 0) out.feet = [apFoot(c1, l0, p), apFoot(c2, l0, p)];
  else if (s.whichLine === 1) out.feet = [apFoot(c1, l1, p), apFoot(c2, l1, p)];
  if (out.M[0] && out.M[1]) out.chord1 = dist(out.M[0], out.M[1]);
  if (out.N[0] && out.N[1]) out.chord2 = dist(out.N[0], out.N[1]);
  out.solutionCount = dist(out.T[0], out.T[1]) < 1e-6 ? 1 : 2;
  return out;
}

/** What the page's construction means, without GeoSDoub's branch formulas. */
function independent(s) {
  const a = { x: s.C1.x, y: s.C1.y }, b = { x: s.C3.x, y: s.C3.y };
  const ra = dist(a, s.R1), rb = dist(b, s.R3);
  const d = dist(a, b), h = Math.floor(s.L / 2);
  if (s.L < 2 || ra < 2 || rb < 2 || h > d ||
      d > ra + rb || d < Math.abs(ra - rb)) return null;
  const u = { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  const base = { x: a.x + u.x * d / 2, y: a.y + u.y * d / 2 };
  /* Points at distance h from a on the circle with diameter ab satisfy
     dot(t-a, u) = h^2/d, hence these two offsets along the perpendicular. */
  const along = h * h / d;
  const side = Math.sqrt(Math.max(0, h * h - along * along));
  const v = { x: -u.y, y: u.x };
  const T = [
    pt(base.x - u.x * (d / 2 - along) + v.x * side,
       base.y - u.y * (d / 2 - along) + v.y * side),
    pt(base.x - u.x * (d / 2 - along) - v.x * side,
       base.y - u.y * (d / 2 - along) - v.y * side),
  ];
  /* Circles c(O1,ra) and c(O2,rb) meet at P,Q. Use the radical axis. */
  const t = (ra * ra - rb * rb + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, ra * ra - t * t));
  const P = pt(a.x + u.x * t + v.x * hh, a.y + u.y * t + v.y * hh);
  return { T, P, u, v, base, ra, rb, d, h,
    count: side < 1e-7 ? 1 : 2, chord: 2 * h };
}

/* The set of layouts compared in section 2: a grid plus seeded random ones. */
const layouts = [];
for (const lx of [100, 200, 320]) {
  for (let L = 4; L <= 500; L += 37) {
    for (const gap of [40, 100, 156, 260]) {
      layouts.push(C.start({
        A: pt(40, C.ROW), B: pt(40 + L, C.ROW),
        C1: pt(lx, 300), R1: pt(lx + 150, 300),
        C3: pt(lx + gap, 300), R3: pt(lx + gap + 120, 300),
        whichLine: L % 3,
      }));
    }
  }
}
const rand = rng(20261127);
for (let i = 0; i < 2000; i++) {
  const x1 = 50 + rand() * 300, y1 = 180 + rand() * 200;
  const x2 = 50 + rand() * 500, y2 = 180 + rand() * 200;
  const ra = 30 + rand() * 170, rb = 30 + rand() * 170;
  const L = 2 + Math.floor(rand() * 500);
  layouts.push(C.start({
    A: pt(20, C.ROW), B: pt(20 + L, C.ROW),
    C1: pt(x1, y1), R1: pt(x1 + ra, y1),
    C3: pt(x2, y2), R3: pt(x2 - rb, y2),
    whichLine: i % 3,
  }));
}

{
  let flag = true, detail = "";
  for (const s of layouts) {
    const a = C.compute(s), b = apCompute(s);
    const cmp = (label, x, y) => {
      if (!flag) return;
      if (Number.isNaN(x) && Number.isNaN(y)) return;
      if (typeof x === "number") {
        if (!near(x, y, 1e-6)) { flag = false; detail = `${label}: ${x} vs ${y}`; }
      } else if (x !== y) { flag = false; detail = `${label}: ${x} vs ${y}`; }
    };
    cmp("noDraw", a.noDraw, b.noDraw);
    cmp("noSolution", a.noSolution, b.noSolution);
    cmp("half", a.half, b.half);
    cmp("solutionCount", a.solutionCount, b.solutionCount);
    for (const key of ["P", "Q"]) {
      if (!a[key] && !b[key]) continue;
      if (!same(a[key], b[key])) { flag = false; detail = `${key} differs`; }
    }
    for (const key of ["M", "N", "T"]) {
      const left = key === "T" && a[key].length === 0 ? null : a[key];
      const right = key === "T" && (!b[key] || !b[key].length) ? null : b[key];
      if (!left && !right) continue;
      if (!left || !right) { flag = false; detail = `${key} missing in transcription`; break; }
      for (let i = 0; i < right.length; i++) {
        if (!left[i] && !right[i]) continue;
        if (!same(left[i], right[i])) {
          flag = false;
          detail = `${key}[${i}] differs at ${JSON.stringify(s)}: ${JSON.stringify(left[i])} vs ${JSON.stringify(right[i])}`;
          break;
        }
      }
    }
    for (const key of ["cOO", "cL"]) {
      if (a[key] && b[key] && !same(a[key], b[key])) { flag = false; detail = `${key} centre differs`; }
      if (a[key] && b[key] && !near(a[key].r, b[key].r)) { flag = false; detail = `${key} radius differs`; }
    }
    cmp("chord1", a.chord1, b.chord1);
    cmp("chord2", a.chord2, b.chord2);
    for (let i = 0; i < 2; i++) {
      if (!a.feet[i] && !b.feet[i]) continue;
      if (!same(a.feet[i], b.feet[i])) { flag = false; detail = `foot ${i} differs`; }
    }
  }
  check(`the core matches the applet's own Compute on ${layouts.length} layouts`, flag, detail);
}

/* --------------------------------------------------- 3. the page's claims */

{
  let two = 0, one = 0, none = 0, chordOK = true, parallelOK = true;
  let midOK = true, onCircles = true, countOK = true, tangentChord = true;
  let oddOK = true, diff = "";
  for (let gap = 60; gap <= 200; gap += 4) {
    for (const half of [30, 60, gap / 2, gap - 2, gap, gap + 2]) {
      const L = 2 * half;
      const s = C.start({
        A: pt(20, C.ROW), B: pt(20 + L, C.ROW),
        C1: pt(100, 300), R1: pt(220, 300),
        C3: pt(100 + gap, 300), R3: pt(100 + gap + 90, 300),
        whichLine: 0,
      });
      const g = C.compute(s), m = independent(s);
      const expected = half < gap ? 2 : half === gap ? 1 : 0;
      if (g.solutionCount !== expected) { countOK = false; diff = `gap ${gap}, half ${half}`; }
      if (half < gap) {
        two++;
        if (g.solutionCount !== 2 || dist(g.T[0], g.T[1]) < 1e-6) countOK = false;
      } else if (half === gap) {
        one++;
        if (!near(g.T[0].x, g.T[1].x) || !near(g.T[0].y, g.T[1].y)) countOK = false;
        if (!near(g.chord1, L) || !near(g.chord2, L)) tangentChord = false;
      } else {
        none++;
        if (!g.noSolution) countOK = false;
      }
      if (g.noSolution || !m) continue;
      /* The chord through P parallel to O1T has the given length. */
      if (!near(g.chord1, 2 * half, 1e-5) || !near(g.chord2, 2 * half, 1e-5)) {
        chordOK = false; diff = `chord at gap ${gap}, half ${half}`;
      }
      for (let i = 0; i < g.lines.length; i++) {
        /* A line through P in the direction C1 -> T[i]. */
        if (Math.abs(vecCross(g.T[i], s.C1, g.lines[i].p, g.lines[i].q)) > 1e-4) {
          parallelOK = false;
        }
      }
      /* C1 and C2 are the midpoints of PM1 and PM2 (the page's proof). */
      const mid0 = { x: (g.P.x + g.M[0].x) / 2, y: (g.P.y + g.M[0].y) / 2 };
      const mid1 = { x: (g.P.x + g.M[1].x) / 2, y: (g.P.y + g.M[1].y) / 2 };
      if (!same(g.feet[0], mid0, 1e-5) || !same(g.feet[1], mid1, 1e-5)) midOK = false;
      if (!near(dist(m.T[0], s.C1), half, 1e-4) ||
          !near(dist(m.T[0], m.base), m.d / 2, 1e-4)) onCircles = false;
      if (dist(g.P, s.C1) > m.ra + 1e-5 || dist(g.P, s.C3) > m.rb + 1e-5) onCircles = false;
    }
  }
  check(`crossing auxiliary circles give two solutions (${two} layouts)`, countOK, diff);
  check(`tangent auxiliary circles give one solution (${one} layouts)`,
    countOK && tangentChord, diff);
  check(`no intersection gives no solution (${none} layouts)`, countOK, diff);
  check("both lines cut a chord of the given length", chordOK, diff);
  check("both lines are parallel to O1T", parallelOK);
  check("the feet under the centres are the chord midpoints", midOK);
  check("T lies on both auxiliary circles and P on both given circles", onCircles);

  /* An odd integer L is truncated by the applet before it becomes a radius. */
  const odd = C.start({ A: pt(100, C.ROW), B: pt(341, C.ROW),
    C1: pt(150, 300), R1: pt(270, 300), C3: pt(300, 300), R3: pt(390, 300) });
  const og = C.compute(odd);
  check("an odd length cuts L-1, the applet's floor(L/2) quirk",
    odd.L === 241 && og.half === 120 && near(og.chord1, 240, 1e-5));
  /* The second auxiliary point here is P itself, so the second line is
     tangent to circle 2 at P and has no other crossing. The page's "two
     solutions" assumes this degeneracy does not occur. */
  check("a degenerate second line can touch a circle at P and cut no chord",
    og.solutionCount === 2 && og.N[1] === null && !Number.isFinite(og.chord2) &&
    apCompute(odd).N[1] === null);
}

/* Independent geometry over the seeded random layouts too. */
{
  let ok = true, n = 0, detail = "";
  for (const s of layouts) {
    const g = C.compute(s), m = independent(s);
    if (g.noDraw) continue;
    if (g.noSolution) {
      if (m && !g.noSolution) { ok = false; detail = "missed a solution"; }
      continue;
    }
    n++;
    if (dist(g.T[0], m.T[0]) > 1e-5 && dist(g.T[0], m.T[1]) > 1e-5) {
      ok = false; detail = "T is not a crossing of the auxiliary circles";
    }
    /* The applet's Other() picks the crossing at least one unit from P. When
       a line almost touches a circle at P, both computed crossings are within
       that unit and it can pick P itself: that quirk is kept by the core and
       checked against the transcription in section 2, so it is skipped here. */
    const separated = (u, v) => !u || !v || dist(u, g.P) >= 1 - 1e-9 && dist(v, g.P) >= 1 - 1e-9;
    if (Number.isFinite(g.chord1) && separated(g.M[0], g.M[1]) &&
        Math.abs(g.chord1 - 2 * g.half) > 1e-5) {
      ok = false;
      detail = `chord 1 is not twice floor(L/2) at ${JSON.stringify(s)}: ${g.chord1}, half ${g.half}`;
    }
    if (Number.isFinite(g.chord2) && separated(g.N[0], g.N[1]) &&
        Math.abs(g.chord2 - 2 * g.half) > 1e-5) {
      ok = false;
      detail = `chord 2 is not twice floor(L/2) at ${JSON.stringify(s)}: ${g.chord2}, half ${g.half}`;
    }
    if (Math.abs(vecCross(g.T[0], s.C1, g.lines[0].p, g.lines[0].q)) > 1e-4) {
      ok = false; detail = "chord is not parallel to O1T";
    }
  }
  check(`independent construction agrees on ${n} solvable layouts`, ok, detail);
}

done("given-common-chord");
