#!/usr/bin/env node
"use strict";

/*
 * Logic test for adjacent-incircles/adjacent-incircles-core.js.
 *
 *   node porting/check-adjacent-incircles.mjs
 *
 * The exact claim on the cut-the-knot page is about radii, not base segments:
 * if triangles Mi A M(i+1) have equal incircles, then so do Mi A M(i+k) for
 * every k. The page also states Demir's pairwise version (r_i = r_(i+2) gives
 * equal level-2 circles) and the sangaku answer AM_mid = sqrt(s(s-a)). All
 * three are tested here over many exact and random configurations, together
 * with a second transcription of the applet's own GetIncircle: it finds the
 * incenter from two angle bisectors and averages the three distances to the
 * sides. The applet wraps its point index modulo N when drawing; that extra
 * spanning triangle is checked and deliberately not copied.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("adjacent-incircles/adjacent-incircles-core.js", "AdjacentIncirclesCore");

const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

/* --------------------------------------------- a fan with equal level-1 radii
 * g(i) = (AMi + signed offset from the altitude's foot) / h. Equal radii mean
 * g(i) = g0 * q^i. With the apex at (0,0) and the base at y = h, the point for
 * g is x = h/2 * (g - 1/g); for q = 2 and h = 4 these are exact rationals.
 */
function fan(g0, q, h, n) {
  const points = [];
  for (let i = 0; i < n; i++) {
    const g = g0 * Math.pow(q, i);
    points.push({ x: h * (g - 1 / g) / 2, y: h });
  }
  return {
    n: n, width: 2 * h, height: h, left: points[0].x,
    right: points[n - 1].x, baseY: h,
    apex: { x: 0, y: 0 }, points: points, showNames: false,
  };
}

function fanWithRatios(g0, ratios, h) {
  const points = [];
  let g = g0;
  for (const ratio of [...ratios, null]) {
    points.push({ x: h * (g - 1 / g) / 2, y: h });
    if (ratio !== null) g *= ratio;
  }
  return {
    n: points.length, width: 2 * h, height: h,
    left: points[0].x, right: points[points.length - 1].x, baseY: h,
    apex: { x: 0, y: 0 }, points: points, showNames: false,
  };
}

/* ----------- a second, literal transcription of the applet's GetIncircle --- */
const unit = (p, q) => {
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
};
function bisectorRay(vertex, p, q) {
  const a = unit(vertex, p), b = unit(vertex, q);
  const x = a.x + b.x, y = a.y + b.y;
  const d = Math.hypot(x, y) || 1;
  const length = C.distance(vertex, p) + C.distance(vertex, q);
  return { x: vertex.x + x / d * length, y: vertex.y + y / d * length };
}
function intersect(a, b, c, d) {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const cross = rx * sy - ry * sx;
  if (Math.abs(cross) < 1e-12) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
  return { x: a.x + rx * t, y: a.y + ry * t };
}
function pointToLine(p, a, b) {
  const u = unit(a, b), v = { x: p.x - a.x, y: p.y - a.y };
  return Math.abs(v.x * u.y - v.y * u.x);
}
/** Bytecode: FindIncenter, then the mean of its distances to the three sides. */
function appletIncircle(A, B, Cc) {
  const I = intersect(A, bisectorRay(A, B, Cc), B, bisectorRay(B, Cc, A));
  const radius = (pointToLine(I, A, B) + pointToLine(I, B, Cc) + pointToLine(I, Cc, A)) / 3;
  return { center: I, radius: radius };
}

/* ------------------------------------------------------------ 1. the basics */

{
  equal("the applet's defaults", [C.N_MIN, C.N_MAX, C.N_DEFAULT, C.MATCH], [3, 10, 4, 1]);
  const s = C.start({ rng: () => 0.5 });
  check("start has the applet's 4 points", s.n === 4 && s.points.length === 4);
  check("start has the applet's apex and base line",
    near(s.apex.x, s.width / 3) && near(s.apex.y, s.height / 3) &&
    s.points.every((p) => near(p.y, s.height - Math.min(s.width, s.height) / 10)));
  const again = C.start({ rng: () => 0.5 });
  check("start is driven only by its options", JSON.stringify(s) === JSON.stringify(again));
  check("reset keeps the settings and changes the points",
    (() => {
      let k = 0;
      const r = C.reset(s, { rng: () => (k++ % 7) / 7 });
      return r.n === s.n && r.width === s.width && r.showNames === s.showNames &&
        JSON.stringify(r.points) !== JSON.stringify(s.points);
    })());
}

/* ------------------------------- 2. the number control, over its whole range */

{
  let ok = true, spacing = true, jitter = true;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    const random = rng(n * 17);
    const s = C.start({ n: n, rng: random });
    ok = ok && s.n === n && s.points.length === n;
    const step = (s.right - s.left) / (n - 1);
    for (let i = 0; i < n; i++) {
      const offset = s.points[i].x - (s.left + step * i);
      jitter = jitter && offset >= -5 && offset < 5;
      spacing = spacing && (i === 0 || s.points[i].x > s.points[i - 1].x);
    }
  }
  check("the point count works from 3 to 10", ok);
  check("points are in order along the base", spacing);
  check("the applet's -5..4 jitter is kept", jitter);
  check("a number outside the range is clamped",
    C.start({ n: 100, rng: () => 0.5 }).n === 10 && C.start({ n: 1, rng: () => 0.5 }).n === 3);
}

/* ------------------------------------- 3. inradius, incenter and the applet */

{
  check("a 3-4-5 triangle has inradius 1",
    near(C.inradius({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }), 1));
  check("an equilateral triangle of side 2 has inradius 1/sqrt(3)",
    near(C.inradius({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: Math.sqrt(3) }), 1 / Math.sqrt(3)));
  check("the incenter is the same distance from all three sides",
    (() => {
      const A = { x: 1, y: 7 }, B = { x: 9, y: 2 }, D = { x: 4, y: 11 };
      const I = C.incenter(A, B, D);
      const d = [C.distance(C.foot(I, A, B), I), C.distance(C.foot(I, B, D), I), C.distance(C.foot(I, D, A), I)];
      return near(d[0], d[1], 1e-9) && near(d[1], d[2], 1e-9);
    })());
}

{
  let exact = true, centers = true;
  for (const q of [1.5, 2, 3]) {
    for (const h of [4, 20, 137]) {
      for (let n = 4; n <= 9; n++) {
        const s = fan(1, q, h, n);
        for (let i = 0; i + 1 < n; i++) {
          const mine = C.incircle(s.apex, s.points[i], s.points[i + 1]);
          const theirs = appletIncircle(s.apex, s.points[i], s.points[i + 1]);
          exact = exact && near(mine.radius, theirs.radius, 1e-7 * Math.max(1, h));
          centers = centers && near(mine.center.x, theirs.center.x, 1e-7 * Math.max(1, h)) &&
            near(mine.center.y, theirs.center.y, 1e-7 * Math.max(1, h));
        }
      }
    }
  }
  check("the core's radii match the applet's averaged-distance radii", exact);
  check("the core's centers match the applet's two-bisector incenter", centers);
}

{
  const random = rng(20261126);
  let ok = true;
  for (let t = 0; t < 2000; t++) {
    const A = { x: random() * 100 - 50, y: random() * 100 + 1 };
    const B = { x: random() * 200 - 100, y: random() * 20 };
    const D = { x: random() * 200 - 100, y: random() * 20 };
    if (C.distance(B, D) < 1e-6) continue;
    const r1 = C.inradius(A, B, D), r2 = appletIncircle(A, B, D).radius;
    ok = ok && near(r1, r2, 1e-7 * Math.max(1, r1));
  }
  check("2000 random triangles agree with the applet's construction", ok);
}

/* ------------------------------- 4. the page's theorem: every level, not 2^n */

{
  let radii = true, allLevels = true, closed = true;
  for (const q of [1.4, 1.6, 2, 2.5, 3]) {
    for (const h of [4, 100]) {
      for (let n = 4; n <= 10; n++) {
        const s = fan(1, q, h, n);
        for (let k = 1; k < n; k++) {
          const rs = C.radii(s, k);
          radii = radii && C.spread(rs) < 1e-7 * Math.max(1, h);
          closed = closed && near(rs[0], h / 2 * (1 - Math.pow(q, -k)), 1e-7 * Math.max(1, h));
        }
        const tol = 1e-7 * Math.max(1, h);
        allLevels = allLevels && C.equalFirstLevel(s, tol) && C.theoremHolds(s, tol);
      }
    }
  }
  check("all 35 equal-incircle fans have equal radii at every level", radii);
  check("the measured radii equal h/2 * (1 - q^-k)", closed);
  check("equal level 1 implies the page's full conclusion", allLevels);
}

{
  let pairs = true, second = true;
  const random = rng(72);
  for (let t = 0; t < 500; t++) {
    const a = 1.1 + random(), b = 1.1 + random();
    const ratios = [];
    for (let i = 0; i < 9; i++) ratios.push(i % 2 ? b : a);
    const s = fanWithRatios(1, ratios, 100);
    const first = C.radii(s, 1);
    for (let i = 0; i + 2 < first.length; i++) pairs = pairs && near(first[i], first[i + 2], 1e-7);
    const next = C.radii(s, 2);
    second = second && C.spread(next) < 1e-7;
  }
  check("Demir's equal-in-pairs hypothesis holds in 500 fans", pairs);
  check("Demir/Tabov: pairwise level 1 gives equal level 2 circles", second);
}

{
  let sangaku = true;
  for (const q of [1.3, 1.6, 2, 3, 5]) {
    for (const g0 of [0.6, 1, 1.7]) {
      for (const h of [1, 4, 250]) {
        const s = fan(g0, q, h, 3);
        const outerBase = C.distance(s.points[0], s.points[2]);
        const semiperimeter = (outerBase + C.distance(s.apex, s.points[0]) + C.distance(s.apex, s.points[2])) / 2;
        sangaku = sangaku && near(C.distance(s.apex, s.points[1]),
          Math.sqrt(semiperimeter * (semiperimeter - outerBase)), 1e-7 * Math.max(1, h));
      }
    }
  }
  check("the sangaku answer AM_mid = sqrt(s(s-a)) is true", sangaku);
}

{
  // g(i) is a geometric progression exactly when level 1 has equal radii.
  const s = fan(1, 2, 4, 5), g = C.gValues(s);
  let geometric = true;
  for (let i = 1; i + 1 < g.length; i++) geometric = geometric && near(g[i] * g[i], g[i - 1] * g[i + 1], 1e-9);
  check("equal radii make g(i) a geometric progression", geometric);
  check("g(i) = (AMi + offset from the altitude's foot) / h",
    near(g[1], (C.distance(s.apex, s.points[1]) + s.points[1].x) / 4, 1e-9));
}

/* --------------------- 5. the applet's tolerance and its wrapping leftover */

{
  const s = fan(1, 2, 4, 4);
  const moved = JSON.parse(JSON.stringify(s));
  moved.points[1].x += 0.05;
  const small = C.spread(C.radii(moved, 1));
  const smallEqual = C.equalFirstLevel(moved);
  moved.points[1].x += 4;
  const large = C.spread(C.radii(moved, 1));
  check("a small difference is still 'equal' at the applet's 1-pixel tolerance",
    small < C.MATCH && smallEqual === true);
  check("a large difference is not equal", large > C.MATCH && !C.equalFirstLevel(moved));
  const tiny = JSON.parse(JSON.stringify(s));
  tiny.points[1].x += 0.02;
  check("a 0.02-unit nudge stays equal", C.equalFirstLevel(tiny));

  // Bytecode DrawCircles uses M[(i + level) % M.length], so it also draws
  // M(n-1) A M0. That spanning circle cannot match the level-1 circles; the
  // applet's Finished flag would never light up. We follow the page's fan.
  const big = fan(1, 2, 100, 4);
  const wrap = C.inradius(big.apex, big.points[3], big.points[0]);
  check("the applet's wrapped circle really is different", wrap > C.radii(big, 1)[0] + C.MATCH);
  check("our levels do not wrap", C.radii(s, 2).length === s.n - 2 && C.radii(s, 3).length === 1);
}

{
  // The parenthetical brief mentions a sum of adjacent base segments. It is
  // not on the page, and it is false: the base segments grow geometrically.
  const s = fan(1, 2, 4, 4);
  const base = s.points.slice(1).map((p, i) => p.x - s.points[i].x);
  check("adjacent sums of base segments are NOT equal (a useful counterexample)",
    Math.abs((base[0] + base[1]) - (base[1] + base[2])) > 1);
}

/* --------------------------------- 6. making equal circles, and degenerate cases */

{
  const random = rng(6007);
  let ok = true, inside = true, unchangedApex = true;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (let t = 0; t < 30; t++) {
      const original = C.start({ n: n, rng: random });
      const before = JSON.stringify(original);
      const made = C.makeEqual(original, 1.3 + random());
      ok = ok && C.equalFirstLevel(made, 1e-7) && C.theoremHolds(made, 1e-7);
      inside = inside && made.points.every((p) => p.x >= made.left - 1e-7 && p.x <= made.right + 1e-7);
      unchangedApex = unchangedApex && JSON.stringify(made.apex) === JSON.stringify(original.apex);
      if (t === 0) check("makeEqual leaves its input alone", JSON.stringify(original) === before);
    }
  }
  check("makeEqual produces equal radii for every n from 3 to 10", ok);
  check("makeEqual keeps the points on the base segment", inside);
  check("makeEqual leaves the apex where the player put it", unchangedApex);
}

{
  const flat = C.start({ n: 4, rng: () => 0.5 });
  flat.apex = { x: flat.apex.x, y: flat.baseY };
  check("an apex on the base line has no g values", C.gValues(flat) === null);
  check("makeEqual leaves a flat diagram alone",
    JSON.stringify(C.makeEqual(flat)) === JSON.stringify(flat));
  const p = C.position(C.start({ n: 4, rng: () => 0.5 }));
  check("the saved position is plain data for the tutor",
    p.n === 4 && p.points.length === 4 && p.level1.length === 3 && typeof p.equal === "boolean");
  check("spreads are measured, not assumed", C.spread([2, 2, 2]) === 0 && C.spread([2, 3, 2]) === 1);
}

done("adjacent-incircles");
