#!/usr/bin/env node
"use strict";

/*
 * Logic test for equal-circles-orthocenter/equal-circles-orthocenter-core.js.
 *
 *   node porting/check-equal-circles-orthocenter.mjs
 *
 * The article's claim is that each circle through two vertices and the
 * orthocenter has the same radius as the circumcircle of ABC. It also reports
 * that the three diameters (HA', HB', HC') are equal to the circumdiameter,
 * that A'B'C' is the anticomplementary triangle of ABC with H as its
 * circumcenter, that A'BC', C'AB' and B'CA' are straight lines, and that the
 * four triangles ABC, A'BC, AB'C and ABC' are congruent. All of these are
 * checked on the opening triangle, on 10 hand-picked shapes, a 20x20 grid of
 * corner positions and 700 random triangles.
 *
 * Every computed point is compared twice: (1) with a second, literal
 * transcription of the applet's own bytecode (NearestPoint, Intersect,
 * FindCircumcenter, GetCircle, Prorate, Average) and (2) with an independent
 * closed form H = A + B + C - 2O, A' = B + C - A, circle centres
 * B + C - O (cyclically) and radius R. Flat and right triangles where the
 * applet's own guard returns NaN are checked as unusable, not skipped.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "equal-circles-orthocenter/equal-circles-orthocenter-core.js",
  "EqualCirclesOrthocenterCore"
);

const pt = (a) => ({ x: a[0], y: a[1] });
const near = (v, tol = 1e-6) => Number.isFinite(v) && Math.abs(v) < tol;
const worst = (items, fn) => items.reduce((m, x) => Math.max(m, fn(x)), 0);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const cross = (p, q) => p.x * q.y - p.y * q.x;
const area2 = (a, b, c) => cross(sub(b, a), sub(c, a));
const reflectOverLine = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  const f = { x: a.x + dx * t, y: a.y + dy * t };
  return { x: 2 * f.x - p.x, y: 2 * f.y - p.y };
};
const angleAt = (v, p, q) => {
  const a = sub(p, v), b = sub(q, v);
  const d = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  return d < 1e-12 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot(a, b) / d)));
};

/* -------------------------------------------------------- 1. the position */

{
  const s = C.start({});
  check("a new diagram has three finite corners inside the board",
    [s.A, s.B, s.C].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= C.MARGIN && p.x <= C.VIEW.width - C.MARGIN &&
      p.y >= C.MARGIN && p.y <= C.VIEW.height - C.MARGIN));
  check("the opening triangle is the applet's 60°, 144°, 36° triangle",
    Math.abs(s.A.y - C.START.A.y) < 0.001 && s.B.x < s.A.x && s.A.x < s.C.x &&
    Math.abs(s.B.y - s.C.y) < 1e-9);
  check("an illustration has no win or loss", C.result(s) === null);
  check("the applet's four checkboxes start unchecked",
    C.OPTION_KEYS.length === 4 &&
    C.OPTION_KEYS.every((k) => s[k] === false));
  check("the opening diagram can be drawn", C.compute(s).valid === true);

  const moved = C.moveVertex(s, "A", { x: 9000, y: -40 });
  check("dragging a corner clamps it to the board",
    moved.A.x === C.VIEW.width - C.MARGIN && moved.A.y === C.MARGIN,
    JSON.stringify(moved.A));
  check("moving a corner copies the state", s.A.x === C.START.A.x &&
    s.moves === 0 && moved.moves === 1 && moved.explored === true);
  check("exploring an illustration ends it as done, never as a win or a loss",
    C.result(moved) === "done" && !["win", "lose"].includes(C.result(moved)));
  check("an unknown corner or a non-finite point is refused",
    C.moveVertex(s, "Z", pt([1, 1])) === s &&
    C.moveVertex(s, "A", pt([NaN, 3])) === s);
  check("a checkbox can be switched without moving or resizing the picture",
    C.setOption(s, "showHint", true).showHint === true &&
    C.setOption(s, "showHint", true).A === s.A &&
    C.setOption(s, "missing", true) === s);
  check("a diagram with a missing corner cannot be drawn",
    C.compute({ A: s.A, B: s.B, C: null }).valid === false);
  check("the status line reports the equal radii on the opening diagram",
    C.describe(C.compute(s)).includes("The three circles each have radius") &&
    C.describe(C.compute(s)).includes("160.0"));
  check("label is another name for describe", C.label === C.describe);

  const rand = rng(117);
  const starts = Array.from({ length: 300 }, () => C.randomStart(rand));
  check("300 new diagrams are finite, non-flat triangles with fresh options",
    starts.every((r) => [r.A, r.B, r.C].every((p) =>
      Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= C.MARGIN && p.x <= C.VIEW.width - C.MARGIN &&
      p.y >= C.MARGIN && p.y <= C.VIEW.height - C.MARGIN) &&
      Math.abs(area2(r.A, r.B, r.C)) > 100 &&
      C.OPTION_KEYS.every((k) => r[k] === false) &&
      C.compute(r).valid));
}

/* ------------------- 2. a second, literal transcription of the bytecode */

function jFinite(p) { return !!p && Number.isFinite(p.x) && Number.isFinite(p.y); }
function jSqDist(p, q) { return (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y); }
function jDist(p, q) { return Math.sqrt(jSqDist(p, q)); }

/** GeoSDoub.Intersect(a,b,c,d) from javap: the |den| < 1 guard included. */
function jIntersect(a, b, c, d) {
  const aa = a.y - b.y;
  const bb = b.x - a.x;
  const cc = a.x * b.y - a.y * b.x;
  const dd = c.y - d.y;
  const ee = d.x - c.x;
  const ff = c.x * d.y - c.y * d.x;
  const den = aa * ee - dd * bb;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (bb * ff - ee * cc) / den, y: (cc * dd - ff * aa) / den };
}

/** GeoSDoub.NearestPoint(p,a,b): SqDist(a,p) < 0.1 returns p itself. */
function jNearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (jSqDist(a, p) < 0.1) return { x: p.x, y: p.y };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function jFindCircumcenter(a, b, c) {
  const ab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const bc = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const p = { x: ab.x + b.y - a.y, y: ab.y - b.x + a.x };
  const q = { x: bc.x + c.y - b.y, y: bc.y - c.x + b.x };
  return jIntersect(ab, p, bc, q);
}

function jGetCircle(a, b, c) {
  const centre = jFindCircumcenter(a, b, c);
  if (!jFinite(centre)) return null;
  return { c: centre, r: (jDist(centre, a) + jDist(centre, b) + jDist(centre, c)) / 3 };
}

/** CTKGeometryPlus.Prorate: distance < 0.1 returns the starting point. */
function jProrate(from, to, length) {
  const d = jDist(from, to);
  if (d < 0.1) return { x: from.x, y: from.y };
  const k = length / d;
  return { x: from.x + k * (to.x - from.x), y: from.y + k * (to.y - from.y) };
}

/** Canvas.Compute(), transcribed method by method. */
function jCompute(A, B, Cc) {
  const Ha = jNearestPoint(A, B, Cc);
  const Hb = jNearestPoint(B, Cc, A);
  const Hc = jNearestPoint(Cc, A, B);
  const h1 = jIntersect(A, Ha, B, Hb);
  const h2 = jIntersect(B, Hb, Cc, Hc);
  const h3 = jIntersect(Cc, Hc, A, Ha);
  if (![h1, h2, h3].every(jFinite)) return null;
  const H = {
    x: (h1.x + h2.x + h3.x) / 3,
    y: (h1.y + h2.y + h3.y) / 3,
  };
  if (!jFinite(H)) return null;
  const circleA = jGetCircle(B, Cc, H);
  const circleB = jGetCircle(Cc, A, H);
  const circleC = jGetCircle(A, B, H);
  const circle = jGetCircle(A, B, Cc);
  if (!circleA || !circleB || !circleC || !circle) return null;
  const Oa = jProrate(H, circleA.c, 2 * circleA.r);
  const Ob = jProrate(H, circleB.c, 2 * circleB.r);
  const Oc = jProrate(H, circleC.c, 2 * circleC.r);
  if (![Oa, Ob, Oc].every(jFinite)) return null;
  return { Ha, Hb, Hc, H, circleA, circleB, circleC, circle, Oa, Ob, Oc };
}

/* --------------------- 3. an independent closed form for the same picture */

function analytic(A, B, Cc) {
  const d = 2 * (A.x * (B.y - Cc.y) + B.x * (Cc.y - A.y) + Cc.x * (A.y - B.y));
  if (Math.abs(d) < 1e-9) return null;
  const aa = A.x * A.x + A.y * A.y;
  const bb = B.x * B.x + B.y * B.y;
  const cc = Cc.x * Cc.x + Cc.y * Cc.y;
  const O = {
    x: (aa * (B.y - Cc.y) + bb * (Cc.y - A.y) + cc * (A.y - B.y)) / d,
    y: (aa * (Cc.x - B.x) + bb * (A.x - Cc.x) + cc * (B.x - A.x)) / d,
  };
  const R = dist(O, A);
  const H = { x: A.x + B.x + Cc.x - 2 * O.x, y: A.y + B.y + Cc.y - 2 * O.y };
  return {
    O, R, H,
    circleA: { c: { x: B.x + Cc.x - O.x, y: B.y + Cc.y - O.y }, r: R },
    circleB: { c: { x: Cc.x + A.x - O.x, y: Cc.y + A.y - O.y }, r: R },
    circleC: { c: { x: A.x + B.x - O.x, y: A.y + B.y - O.y }, r: R },
    Oa: { x: B.x + Cc.x - A.x, y: B.y + Cc.y - A.y },
    Ob: { x: Cc.x + A.x - B.x, y: Cc.y + A.y - B.y },
    Oc: { x: A.x + B.x - Cc.x, y: A.y + B.y - Cc.y },
  };
}

/* --------------------------------------------- 4. the triangles to sweep */

const exact = [
  [C.START.A, C.START.B, C.START.C],                                    // applet opening
  [pt([220, 60]), pt([90, 250]), pt([350, 250])],                       // acute isosceles
  [pt([220, 60]), pt([120, 210]), pt([320, 210])],                      // nearly equilateral
  [pt([220, 90]), pt([110, 230]), pt([335, 230])],                      // wide, flattened
  [pt([120, 70]), pt([320, 80]), pt([250, 250])],                       // obtuse at C
  [pt([350, 70]), pt([110, 120]), pt([280, 250])],                      // scalene, obtuse
  [pt([100, 250]), pt([330, 70]), pt([330, 250])],                      // right angle at C
  [pt([30, 40]), pt([410, 280]), pt([40, 280])],                        // corners near the edges
  [pt([220, 260]), pt([100, 80]), pt([340, 100])],                      // reversed orientation
  [pt([220, 70]), pt([215, 250]), pt([400, 160])],                      // almost vertical side
];
const grid = [];
for (const bx of [60, 140, 220, 300, 380]) {
  for (const by of [60, 130, 200, 270]) {
    for (const cx of [70, 150, 230, 310, 390]) {
      for (const cy of [70, 140, 210, 280]) {
        grid.push([pt([210, 160]), pt([bx, by]), pt([cx, cy])]);
      }
    }
  }
}
const rnd = rng(20261127);
const random = Array.from({ length: 700 }, () => [
  pt([20 + rnd() * 400, 20 + rnd() * 280]),
  pt([20 + rnd() * 400, 20 + rnd() * 280]),
  pt([20 + rnd() * 400, 20 + rnd() * 280]),
]);
const all = [...exact, ...grid, ...random];
check(`the sweep has ${all.length} triangles (10 hand-picked, 400 grid, 700 random)`,
  all.length === 1110);

const cases = [];
for (const [A, B, Cc] of all) cases.push({ A, B, C: Cc, g: C.compute({ A, B, C: Cc }) });
const good = cases.filter((x) => x.g.valid);
check("most of the swept triangles, including the opening one, are drawable",
  good.length > 900 && cases[0].g.valid, `${good.length} of ${cases.length}`);

/* ---------------------- 5. core against the applet's second transcription */

{
  let bad = 0, jBad = 0;
  let feet = 0, orthos = 0, centers = 0, radii = 0, antipodes = 0;
  for (const x of cases) {
    const A = x.A, B = x.B, Cc = x.C;
    const j = jCompute(A, B, Cc);
    if (!x.g.valid) {
      // Where the applet's guards fail, the port must refuse to draw too.
      if (j === null) bad++;
      continue;
    }
    if (!j) { jBad++; continue; }
    feet = Math.max(feet, dist(x.g.Ha, j.Ha), dist(x.g.Hb, j.Hb), dist(x.g.Hc, j.Hc));
    orthos = Math.max(orthos, dist(x.g.H, j.H));
    for (const key of ["circleA", "circleB", "circleC", "circle"]) {
      centers = Math.max(centers, dist(x.g[key].c, j[key].c));
      radii = Math.max(radii, Math.abs(x.g[key].r - j[key].r));
    }
    antipodes = Math.max(antipodes,
      dist(x.g.Oa, j.Oa), dist(x.g.Ob, j.Ob), dist(x.g.Oc, j.Oc));
  }
  check("every triangle the applet cannot draw is refused by the port", bad > 0,
    `${bad} unusable triangles`);
  check("every triangle the port draws is also drawn by the applet's bytecode",
    jBad === 0, `${jBad} disagreements`);
  check("the three altitude feet match the bytecode NearestPoint", near(feet, 1e-7), `max ${feet}`);
  check("H matches the bytecode's average of three Intersects", near(orthos, 1e-6), `max ${orthos}`);
  check("all four circle centres match the bytecode FindCircumcenter", near(centers, 1e-5), `max ${centers}`);
  check("all four radii match the bytecode GetCircle", near(radii, 1e-7), `max ${radii}`);
  check("A′, B′ and C′ match the bytecode Prorate", near(antipodes, 1e-5), `max ${antipodes}`);
}

/* -------------------------- 6. core against the closed-form proof */

{
  let count = 0, hErr = 0, rErr = 0, antiErr = 0, cErr = 0;
  for (const x of good) {
    const ref = analytic(x.A, x.B, x.C);
    if (!ref) continue;
    count++;
    hErr = Math.max(hErr, dist(x.g.H, ref.H));
    rErr = Math.max(rErr, Math.abs(x.g.circle.r - ref.R));
    cErr = Math.max(cErr,
      dist(x.g.circleA.c, ref.circleA.c),
      dist(x.g.circleB.c, ref.circleB.c),
      dist(x.g.circleC.c, ref.circleC.c));
    antiErr = Math.max(antiErr,
      dist(x.g.Oa, ref.Oa), dist(x.g.Ob, ref.Ob), dist(x.g.Oc, ref.Oc));
  }
  check("the closed form applies to the whole sweep", count === good.length,
    `${count} of ${good.length}`);
  check("H = A + B + C - 2O in every triangle", near(hErr, 1e-6), `max ${hErr}`);
  check("the circumradius agrees with the closed form", near(rErr, 1e-6), `max ${rErr}`);
  check("the three other circle centres are the reflections of O in the side midpoints",
    near(cErr, 1e-5), `max ${cErr}`);
  check("A′ = B + C - A, and cyclically", near(antiErr, 1e-5), `max ${antiErr}`);
}

/* --------------------------- 7. every claim on the page */

{
  const radii = worst(good, (x) => Math.max(
    Math.abs(x.g.circleA.r - x.g.circle.r),
    Math.abs(x.g.circleB.r - x.g.circle.r),
    Math.abs(x.g.circleC.r - x.g.circle.r)));
  check("the page's main claim: BCH, CAH and ABH have ABC's circumradius",
    near(radii, 1e-6), `max ${radii}`);

  const diameters = worst(good, (x) => Math.max(
    Math.abs(dist(x.g.H, x.g.Oa) - 2 * x.g.circle.r),
    Math.abs(dist(x.g.H, x.g.Ob) - 2 * x.g.circle.r),
    Math.abs(dist(x.g.H, x.g.Oc) - 2 * x.g.circle.r)));
  check("all three diameters equal the circumdiameter of ABC",
    near(diameters, 1e-5), `max ${diameters}`);

  const circumcentre = worst(good, (x) => Math.max(
    Math.abs(dist(x.g.H, x.g.Oa) - dist(x.g.H, x.g.Ob)),
    Math.abs(dist(x.g.H, x.g.Ob) - dist(x.g.H, x.g.Oc))));
  check("H is the circumcenter of A′B′C′", near(circumcentre, 1e-5), `max ${circumcentre}`);

  const straight = worst(good, (x) => Math.max(
    Math.abs(cross(sub(x.g.B, x.g.Oa), sub(x.g.Oc, x.g.Oa))),
    Math.abs(cross(sub(x.g.C, x.g.Ob), sub(x.g.Oa, x.g.Ob))),
    Math.abs(cross(sub(x.g.A, x.g.Oc), sub(x.g.Ob, x.g.Oc)))));
  check("A′BC′, C′AB′ and B′CA′ are straight lines", near(straight, 1e-4), `max ${straight}`);

  const mids = worst(good, (x) => Math.max(
    dist(x.g.A, mid(x.g.Ob, x.g.Oc)),
    dist(x.g.B, mid(x.g.Oc, x.g.Oa)),
    dist(x.g.C, mid(x.g.Oa, x.g.Ob))));
  check("A, B and C are the midpoints of B′C′, C′A′ and A′B′", near(mids, 1e-5), `max ${mids}`);

  const sides = (a, b, c) => [dist(a, b), dist(b, c), dist(c, a)].sort((u, v) => u - v);
  const sideError = (v, want) => {
    let e = 0;
    for (let i = 0; i < 3; i++) e = Math.max(e, Math.abs(v[i] - want[i]));
    return e;
  };
  const congruent = worst(good, (x) => {
    const want = sides(x.A, x.B, x.C);
    const variants = [sides(x.g.Oa, x.B, x.C), sides(x.A, x.g.Ob, x.C), sides(x.A, x.B, x.g.Oc)];
    return worst(variants, (v) => sideError(v, want));
  });
  check("ABC, A′BC, AB′C and ABC′ are congruent", near(congruent, 1e-5), `max ${congruent}`);

  const areas = worst(good, (x) => Math.abs(
    area2(x.g.Oa, x.g.Ob, x.g.Oc) / area2(x.A, x.B, x.C) - 4));
  check("A′B′C′ has four times the area of ABC", near(areas, 1e-5), `max ${areas}`);

  const right = worst(good, (x) => Math.max(
    Math.abs(dot(sub(x.g.H, x.B), sub(x.g.Oa, x.B))),
    Math.abs(dot(sub(x.g.H, x.B), sub(x.g.Oc, x.B))),
    Math.abs(dot(sub(x.g.H, x.C), sub(x.g.Oa, x.C))),
    Math.abs(dot(sub(x.g.H, x.C), sub(x.g.Ob, x.C))),
    Math.abs(dot(sub(x.g.H, x.A), sub(x.g.Ob, x.A))),
    Math.abs(dot(sub(x.g.H, x.A), sub(x.g.Oc, x.A)))));
  check("the six right angles the hint draws are right", near(right, 1e-4), `max ${right}`);

  const reflected = worst(good, (x) => {
    const ref = analytic(x.A, x.B, x.C);
    if (!ref) return Infinity;
    const p = reflectOverLine(x.g.H, x.B, x.C);
    const q = reflectOverLine(x.g.H, x.C, x.A);
    const r = reflectOverLine(x.g.H, x.A, x.B);
    return Math.max(
      Math.abs(dist(p, ref.O) - ref.R),
      Math.abs(dist(q, ref.O) - ref.R),
      Math.abs(dist(r, ref.O) - ref.R),
      dist(x.g.Ha, mid(x.g.H, p)),
      dist(x.g.Hb, mid(x.g.H, q)),
      dist(x.g.Hc, mid(x.g.H, r)));
  });
  check("the reflection of H in a side lies on the circumcircle and the foot bisects it",
    near(reflected, 1e-5), `max ${reflected}`);

  const angles = worst(good, (x) => Math.max(
    Math.abs(angleAt(x.C, x.g.Ob, x.g.H) - angleAt(x.C, x.g.Oa, x.g.H)),
    Math.abs(angleAt(x.A, x.g.Oc, x.g.H) - angleAt(x.A, x.g.Ob, x.g.H))));
  check("the page's angle chain gives ∠CB′H = ∠CA′H (and cyclically)",
    near(angles, 1e-5), `max ${angles}`);

  const bisectors = worst(good, (x) => Math.max(
    Math.abs(dot(sub(x.g.H, x.C), sub(x.g.Oa, x.g.Ob))),
    Math.abs(dot(sub(x.g.H, x.B), sub(x.g.Oa, x.g.Oc))),
    Math.abs(dot(sub(x.g.H, x.A), sub(x.g.Ob, x.g.Oc)))));
  check("HA, HB and HC are the perpendicular bisectors of the outer triangle's sides",
    near(bisectors, 1e-4), `max ${bisectors}`);

  // The right triangle in the sweep has H on a corner: one of the three
  // circles degenerates, and the applet's Intersect guard returns NaN.
  const rightCase = exact[6];
  check("a right triangle is refused where the applet's circle degenerates",
    C.compute({ A: rightCase[0], B: rightCase[1], C: rightCase[2] }).valid === false);
  const flat = [pt([100, 100]), pt([200, 100]), pt([300, 100])];
  check("three corners in a straight line cannot be drawn",
    C.compute({ A: flat[0], B: flat[1], C: flat[2] }).valid === false);
  check("the status line says what to do when a diagram is unusable",
    C.describe(C.compute({ A: flat[0], B: flat[1], C: flat[2] })).includes("proper triangle"));
}

done("equal-circles-orthocenter");
