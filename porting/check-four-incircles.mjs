#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-incircles/four-incircles-core.js.
 *
 *   node porting/check-four-incircles.mjs
 *
 * The exact claim on the cut-the-knot page is the Five Incircles Theorem:
 * in triangle ABE with cevians AC and AD, the incircles of ABC and ADE are
 * equal iff the incircles of ABD and ACE are. Its statement (B) only assumes
 * the stronger condition that ABC, ACD and ADE all have equal incircles.
 * Here both are checked over grids of exact geometric-progression fans and
 * thousands of random fans, together with the page's semiperimeter algebra
 * and a second, literal transcription of the applet's own GetIncircle
 * (FindIncenter by rotated half-angle rays, radius as the mean of the three
 * distances to the sides), its DrawCircles "Finished" test and its C/D drag
 * coupling. The FourIncirclesInTriangle page is a different sangaku; it is
 * not the claim being tested here.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-incircles/four-incircles-core.js", "FourIncirclesCore");
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const P = (x, y) => ({ x: x, y: y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* ------------------------- a fan whose g-values are under our control ------ *
 * With A at (ax, 0) and the base at y = h, writing a point at signed offset
 * s from the altitude's foot as g = (sqrt(s^2+h^2)+s)/h gives s = h(g-1/g)/2.
 * The inradius of A plus the points for g_i and g_j is h/2 * (1 - g_i/g_j).
 */
function fan(gs, h, ax = 0) {
  return {
    n: 4, width: 400, height: h + 20, left: ax - 2 * h, right: ax + 2 * h,
    baseY: h, apex: P(ax, 0),
    points: gs.map((g) => P(ax + h * (g - 1 / g) / 2, h)),
    showNames: false,
  };
}

function randomFan(random, h) {
  const ax = random() * 60 - 30;
  const gs = [0.4 + random()];
  for (let i = 1; i < 4; i++) gs.push(gs[i - 1] * (1.1 + random() * 1.8));
  return fan(gs, h, ax);
}

/* -------------- a second, literal transcription of the applet's bytecode --- */

function apAngle(a, b, c) {
  const sq = (u, v) => (u.x - v.x) ** 2 + (u.y - v.y) ** 2;
  const cos = (sq(a, b) + sq(a, c) - sq(b, c)) /
    (2 * Math.sqrt(sq(a, b)) * Math.sqrt(sq(a, c)));
  return Math.acos(cos);
}

/** GeoSDoub.FindOrientation: c.x*(a.y-b.y) + c.y*(b.x-a.x) + a.x*b.y - a.y*b.x. */
function apOrientation(a, b, c) {
  return c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y > 0 ? 1 : -1;
}

/** GeoSDoub.Rotate(about, p, t, o). */
function apRotate(about, p, t, o) {
  const co = Math.cos(t), si = Math.sin(t);
  return P(about.x + co * (p.x - about.x) - o * si * (p.y - about.y),
    about.y + o * si * (p.x - about.x) + co * (p.y - about.y));
}

/** GeoSDoub.Intersect of two lines, with the bytecode's |det| < 1 fallback. */
function apIntersect(a, b, c, d) {
  const s4 = a.y - b.y, s6 = b.x - a.x, s8 = a.x * b.y - a.y * b.x;
  const s10 = c.y - d.y, s12 = d.x - c.x, s14 = c.x * d.y - c.y * d.x;
  const s20 = s4 * s12 - s10 * s6;
  if (Math.abs(s20) < 1) return P(NaN, NaN);
  return P((s6 * s14 - s12 * s8) / s20, (s8 * s10 - s14 * s4) / s20);
}

/** GeoSDoub.FindIncenter: rotate two half-angle rays, then intersect. */
function apIncenter(a, b, c) {
  const o = apOrientation(a, b, c);
  return apIntersect(a, apRotate(a, b, apAngle(a, b, c) / 2, o),
    b, apRotate(b, c, apAngle(b, c, a) / 2, o));
}

/** GeoSDoub.NearestPoint(p,a,b): the foot of the perpendicular on side ab. */
function apNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * dx + dy * dy < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + dx * t, a.y + dy * t);
}

/** Canvas GetIncircle: FindIncenter, then the mean of its three side distances. */
function apIncircle(a, b, c) {
  const I = apIncenter(a, b, c);
  return {
    center: I,
    radius: (dist(I, apNearest(I, a, b)) + dist(I, apNearest(I, b, c)) +
      dist(I, apNearest(I, c, a))) / 3,
  };
}

/** DrawCircles(g,1)'s Finished flag, using the applet's own radii. */
function apFinished(state) {
  const rs = [];
  for (let i = 0; i + 1 < state.n; i++) {
    rs.push(apIncircle(state.apex, state.points[i], state.points[i + 1]).radius);
  }
  let first = -1, finished = false;
  for (let i = 0; i < rs.length; i++) {
    if (i === 0) first = rs[i];
    if (i === state.n - 2 && Math.abs(first - rs[i]) <= 1) finished = true;
  }
  return finished;
}

/** mousePressed/mouseDragged's C-D coupling, for a horizontal move of x. */
function apDrag(points, name, x) {
  const out = points.map((p) => P(p.x, p.y));
  const i = C.NAMES.indexOf(name);
  let delta = -1;
  if (name === "C") delta = points[2].x - points[1].x;
  if (name === "D") delta = points[1].x - points[2].x;
  out[i] = P(x, points[i].y); // VerifyPoint's clamp, then projection on the base
  if (name === "C") out[2] = P(x + delta, points[2].y);
  if (name === "D") out[1] = P(x + delta, points[1].y);
  return out;
}

/* ------------------------------------------------------------ 1. the basics */

{
  equal("the applet's four points and one-pixel tolerance",
    [C.N, C.NAMES, C.MATCH], [4, ["B", "C", "D", "E"], 1]);
  const s = C.start({ rng: () => 0.5 });
  check("start has the applet's apex and base line",
    near(s.apex.x, 133) && near(s.apex.y, 60) &&
    s.points.every((p) => near(p.y, 270)) &&
    near(s.left, 60) && near(s.right, 340));
  check("start spaces four points with the applet's -10..9 jitter",
    s.points.every((p, i) => {
      const offset = p.x - (60 + 280 * i / 3);
      return offset >= -10 && offset < 10;
    }));
  check("start is driven only by its options",
    JSON.stringify(s) === JSON.stringify(C.start({ rng: () => 0.5 })));
  const r = C.reset(s, { rng: (() => { let k = 0; return () => (k++ % 7) / 7; })() });
  check("reset restores the applet's apex and scatters the points again",
    near(r.apex.x, 133) && near(r.apex.y, 60) &&
    JSON.stringify(r.points) !== JSON.stringify(s.points) &&
    r.points.every((p) => near(p.y, 270)));
}

/* ------------------------------ 2. the applet's GetIncircle, transcribed --- */

{
  let centers = 0, radii = 0, cases = 0;
  const random = rng(20261127);
  for (const h of [40, 100, 260]) {
    for (const g0 of [0.5, 1, 2]) {
      for (const q of [1.2, 1.6, 2.5]) {
        const s = fan([g0, g0 * q, g0 * q * q, g0 * q ** 3], h);
        for (let level = 1; level <= 3; level++) {
          for (let i = 0; i + level < 4; i++) {
            const mine = C.incircle(s.apex, s.points[i], s.points[i + level]);
            const theirs = apIncircle(s.apex, s.points[i], s.points[i + level]);
            const tol = 1e-7 * h;
            if (!near(mine.radius, theirs.radius, tol)) radii++;
            if (!near(mine.center.x, theirs.center.x, tol) ||
                !near(mine.center.y, theirs.center.y, tol)) centers++;
            cases++;
          }
        }
      }
    }
  }
  check(`${cases} fan circles agree with the applet's averaged distances`, radii === 0);
  check(`${cases} fan centers agree with the applet's FindIncenter`, centers === 0);
}

{
  const random = rng(91734);
  let bad = 0;
  for (let t = 0; t < 2000; t++) {
    const A = P(random() * 400, random() * 200 + 1);
    const B = P(random() * 400 - 40, 270);
    const D = P(random() * 400 - 40, 270);
    if (dist(B, D) < 1e-6) continue;
    if (!near(C.inradius(A, B, D), apIncircle(A, B, D).radius, 1e-7 * 270)) bad++;
  }
  check("2000 random triangles agree with the applet's construction", bad === 0);
}

/* ------------------------------------ 3. the page's formula and level counts */

{
  let formula = 0, counts = true;
  for (const h of [4, 20, 137]) {
    for (const q of [1.4, 2, 3]) {
      const s = fan([0.8, 0.8 * q, 0.8 * q * q, 0.8 * q ** 3], h);
      for (let k = 1; k <= 3; k++) {
        const rs = C.radii(s, k);
        counts = counts && rs.length === 4 - k;
        for (let i = 0; i + k < 4; i++) {
          const expected = h / 2 * (1 - Math.pow(q, -k));
          if (!near(rs[i], expected, 1e-9 * h)) formula++;
        }
      }
    }
  }
  check("levels 1, 2 and 3 hold 3, 2 and 1 circles", counts);
  check("level-k radii equal h/2 * (1 - q^-k)", formula === 0);
  check("a 3-4-5 triangle has inradius 1",
    near(C.inradius(P(0, 0), P(4, 0), P(0, 3)), 1));
}

/* ------------------------------ 4. statement (A): the exact iff, every case */

{
  let outer = 0, inner = 0, converse = 0, seen = 0;
  for (const h of [10, 100, 500]) {
    for (const g0 of [0.4, 1, 2]) {
      for (const r12 of [1.2, 1.7, 2.5]) {
        for (const r23 of [1.2, 1.7, 2.5]) {
          const g1 = g0 * r12, g2 = g1 * r23, g3 = g1 * g2 / g0;
          const s = fan([g0, g1, g2, g3], h);
          const tol = 1e-8 * h;
          const l1 = C.radii(s, 1), l2 = C.radii(s, 2);
          if (!near(l1[0], l1[2], tol)) outer++;
          if (!near(l2[0], l2[1], tol)) inner++;
          check(`exact outer circles match at h=${h} g0=${g0} r12=${r12} r23=${r23}`,
            near(l1[0], l1[2], tol)); // 81 checks of the constructed family
          seen++;
        }
      }
    }
  }
  const random = rng(510912);
  for (let t = 0; t < 5000; t++) {
    const s = randomFan(random, 100);
    const l1 = C.radii(s, 1), l2 = C.radii(s, 2);
    const d1 = l1[0] - l1[2], d2 = l2[0] - l2[1];
    const scale = 1e-8 * 100;
    // The two differences have the same sign, hence vanish together.
    if (Math.abs(d1) > scale && Math.abs(d2) > scale && Math.sign(d1) !== Math.sign(d2)) converse++;
    if (Math.abs(d1) <= scale && Math.abs(d2) > scale) converse++;
  }
  check("every constructed outer match also matches the level-2 pair", inner === 0);
  check(`${seen} constructed families have equal outer level-1 radii`, outer === 0);
  check("5000 random fans: the outer and level-2 equalities are equivalent", converse === 0);
}

/* ---------------------------------------- 5. statement (B), the stronger one */

{
  let bad = 0;
  for (const h of [25, 100, 400]) {
    for (const g0 of [0.5, 1, 1.5]) {
      for (const q of [1.2, 1.5, 2, 3]) {
        const s = fan([g0, g0 * q, g0 * q * q, g0 * q ** 3], h);
        const l1 = C.radii(s, 1), l2 = C.radii(s, 2);
        if (!near(l1[0], l1[1], 1e-8 * h) || !near(l1[1], l1[2], 1e-8 * h) ||
            !near(l2[0], l2[1], 1e-8 * h)) bad++;
      }
    }
  }
  check("statement (B): three equal level-1 circles force the level-2 pair", bad === 0);
}

/* -------------------------- 6. the page's semiperimeter algebra, (1)-(3) ---- */

{
  const random = rng(31127);
  let algebra = 0, semiperimeters = 0, sign = 0;
  for (let t = 0; t < 3000; t++) {
    const s = randomFan(random, 100);
    const [Bp, Cp, Dp, Ep] = s.points, A = s.apex;
    const a = dist(Cp, Dp), b = dist(A, Bp), c = dist(A, Cp);
    const d = dist(A, Dp), e = dist(A, Ep);
    const BC = dist(Bp, Cp), DE = dist(Dp, Ep);
    const s1 = (b + BC + c) / 2, sMid = (c + a + d) / 2, s2 = (d + DE + e) / 2;
    const sPrime = (b + d + BC + a) / 2, sDouble = (c + a + DE + e) / 2;
    const left = (sMid - d) * (s1 - b) - (sMid - c) * (s2 - e);
    const right = (sMid - d) * (sPrime - b) - (sMid - c) * (sDouble - e);
    if (!near(left, right, 1e-7)) algebra++;
    if (!near(sPrime, sMid + s1 - c, 1e-7) || !near(sDouble, sMid + s2 - d, 1e-7)) semiperimeters++;
    const d1 = C.radii(s, 1)[0] - C.radii(s, 1)[2];
    if (Math.abs(left) > 1e-6 && Math.sign(left) !== Math.sign(d1)) sign++;
  }
  check("the page's identities s'=s+s1-c and s''=s+s2-d hold", semiperimeters === 0);
  check("equations (2) and (3) have the same left side", algebra === 0);
  check("the sign of the page's expression matches the outer-radius difference", sign === 0);
}

/* ----------------------- 7. the applet's Finished test and its one-pixel rule */

{
  let bad = 0;
  const random = rng(74173);
  for (let t = 0; t < 600; t++) {
    const s = randomFan(random, 100);
    if (C.matched(s) !== apFinished(s)) bad++;
  }
  check("600 random fans: the Finished flag matches the applet's own test", bad === 0);

  const equalFan = fan([1, 1.5, 2.25, 3.375], 100);
  check("the applet signals Finished on a geometric-progression fan",
    C.matched(equalFan) && apFinished(equalFan) &&
    C.visibleLevels(equalFan).join(",") === "1,2,3");
  const unequal = fan([1, 1.5, 2.25, 4], 100);
  check("the applet does not signal Finished on unequal outer circles",
    !C.matched(unequal) && !apFinished(unequal) &&
    C.visibleLevels(unequal).join(",") === "1");

  // Walk the real tolerance boundary: outer-radius gaps from -2 to +2 pixels.
  let boundary = 0;
  const outerRadius = 50 * (1 - 1 / 1.5);
  for (let k = -20; k <= 20; k++) {
    const gap = k / 10;
    if (Math.abs(Math.abs(gap) - 1) < 0.05) continue; // float-noise at the edge
    const g3 = 2.25 / (1 - (outerRadius + gap) / 50);
    const s = fan([1, 1.5, 2.25, g3], 100);
    if (C.matched(s) !== apFinished(s) || C.matched(s) !== (Math.abs(gap) <= 1)) boundary++;
  }
  check("the one-pixel boundary agrees with the applet on both sides", boundary === 0);
}

/* ---------------------------- 8. the C-D drag coupling and the apex --------- */

{
  let bad = 0;
  const random = rng(20261127);
  for (let t = 0; t < 500; t++) {
    const s = randomFan(random, 100);
    for (const name of ["B", "C", "D", "E"]) {
      const x = 5 + random() * 390;
      const i = C.NAMES.indexOf(name);
      const mine = C.movePoint(s, name, P(x, 100)).points;
      const theirs = apDrag(s.points, name, x);
      for (let k = 0; k < 4; k++) {
        if (!near(mine[k].x, theirs[k].x, 1e-9) || !near(mine[k].y, theirs[k].y, 1e-9)) bad++;
      }
      const gap = mine[2].x - mine[1].x;
      if ((name === "C" || name === "D") &&
          !near(gap, s.points[2].x - s.points[1].x, 1e-9)) bad++;
    }
  }
  check("2000 drags match the applet's point projection and C-D coupling", bad === 0);
  const s = C.start({ rng: () => 0.5 });
  const moved = C.movePoint(s, "A", P(999, -999));
  check("the apex is clamped to the applet's visible rectangle",
    near(moved.apex.x, s.width - 3) && near(moved.apex.y, 3));
  check("dragging B leaves the other points alone",
    JSON.stringify(C.movePoint(s, "B", P(120, 1)).points.slice(1)) ===
    JSON.stringify(s.points.slice(1)));
}

/* ------------------------------------- 9. the convenience button and record */

{
  let bad = 0;
  const random = rng(5353);
  for (let t = 0; t < 300; t++) {
    const s = C.start({ rng: random });
    const apex = P(50 + random() * 300, 20 + random() * 150);
    const input = { ...s, apex: apex };
    const made = C.makeEqual(input, 1.2 + random() * 0.8);
    const l1 = C.radii(made, 1), l2 = C.radii(made, 2);
    if (!C.matched(made) || C.spread(l1) > 1e-7 || C.spread(l2) > 1e-7 ||
        made.points.some((p, i) => i > 0 && p.x <= made.points[i - 1].x)) bad++;
  }
  check("Make outer circles match works from 300 start diagrams", bad === 0);

  const s = C.start({ rng: () => 0.5 });
  const pos = C.position(s);
  check("the saved position is plain data with the radii and the flag",
    JSON.stringify(pos) === JSON.stringify(JSON.parse(JSON.stringify(pos))) &&
    pos.points.length === 4 && pos.level1.length === 3 && pos.level2.length === 2 &&
    pos.matched === C.matched(s));
  check("a demo has no win or loss: nothing in the core declares one",
    !("result" in C) && !("win" in C) && !("lose" in C));
}

done("four-incircles");
