#!/usr/bin/env node
"use strict";

/*
 * Logic test for directly-similar-2/directly-similar-2-core.js.
 *
 *   node porting/check-directly-similar-2.mjs
 *
 * (1) The applet's init(), CompleteTriangle() and TranslateLines() are
 * compared with second, literal transcriptions of their bytecode: init over
 * hundreds of canvas sizes, CompleteTriangle over 2,025 structured and 5,000
 * random five-point configurations, TranslateLines over thousands more.
 * (2) The page's exact claim ("A1B1C1 is similar to ABC and A'B'C'") is
 * checked over 6,075 structured configurations with three positions of P and
 * 5,000 independently generated directly similar pairs, using complex ratios
 * and matching corner angles. (3) The limits are checked too: the page's
 * sign convention differs from the canvas by a half-turn about P, a translate
 * of ABC collapses the new triangle to a point, an opposite similarity does
 * not give a directly similar copy, and a collinear or collapsed input makes
 * the canvas return no third vertex at all.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("directly-similar-2/directly-similar-2-core.js", "DirectlySimilar2Core");

const near = (a, b, eps = 1e-9) =>
  (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= eps;
const samePoint = (a, b, eps = 1e-9) => a && b && near(a.x, b.x, eps) && near(a.y, b.y, eps);
const samePoints = (a, b, eps = 1e-9) =>
  Boolean(a) && Boolean(b) && a.length === b.length && a.every((p, i) => samePoint(p, b[i], eps));
const nullOrPoint = (a, b, eps = 1e-9) =>
  (a === null && b === null) || samePoint(a, b, eps);

/* ------------------------------------------------ 1. init() against bytecode */

/* Literal DirectlySimilar2Canvas.init(): Java int division, then i2d. */
function appletInit(w, h) {
  const t = Math.trunc;
  return [
    { x: t(w / 10), y: t(h / 3) },
    { x: t((5 * w) / 9), y: t((3 * h) / 5) },
    { x: t(w / 3), y: t(h / 5) },
    { x: t(w / 8), y: t((2 * h) / 3) },
    { x: t((3 * w) / 8), y: t((3 * h) / 4) },
    { x: t((3 * w) / 4), y: t((2 * h) / 3) },
  ];
}

{
  const s = C.start({});
  check("the page embedded a 500 by 500 canvas", s.width === 500 && s.height === 500);
  check("the position holds six draggable points", s.points.length === 6);
  equal("A from init()", s.points[0], { x: 50, y: 166 });
  equal("B from init()", s.points[1], { x: 277, y: 300 });
  equal("C from init()", s.points[2], { x: 166, y: 100 });
  equal("A' (D) from init()", s.points[3], { x: 62, y: 333 });
  equal("B' (E) from init()", s.points[4], { x: 187, y: 375 });
  equal("P from init()", s.points[5], { x: 375, y: 333 });
  check("all starting dots lie on the board", s.points.every((p) =>
    p.x >= 0 && p.x <= 500 && p.y >= 0 && p.y <= 500));
  check("an illustration has no result to report", C.result(s) === null);
  check("the status line measures the new triangle",
    /A1B1C1/.test(C.describe(s)) && /degrees/.test(C.describe(s)));

  let bad = 0, sizes = 0;
  for (let w = 1; w <= 640; w += 7) {
    for (const h of [1, 2, 7, 63, 250, 500, 777]) {
      sizes++;
      if (!samePoints(C.start({ width: w, height: h }).points, appletInit(w, h), 0)) bad++;
    }
  }
  check("init() matches the bytecode for 644 canvas sizes", sizes === 644 && bad === 0,
    `${bad} of ${sizes} layouts wrong`);

  const moved = C.movePoint(s, 5, { x: 12, y: 34 });
  check("moving P keeps the other five dots", samePoints(moved.points.slice(0, 5), s.points.slice(0, 5), 0));
  check("moving P changes only P", moved.points[5].x === 12 && moved.points[5].y === 34);
  check("the old position is not mutated", s.points[5].x === 375);
  check("an invalid point index is refused", C.movePoint(s, 6, { x: 1, y: 1 }) === s);
  check("a non-finite point is refused", C.movePoint(s, 0, { x: NaN, y: 1 }) === s);
}

/* ------------------------------- 2. the drawing methods against bytecode */

/* GeoSDoub, transcribed independently from its javap output. */
const sq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const dd = (a, b) => Math.sqrt(sq(a, b));
function ori(a, b, c) {
  return c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y > 0 ? 1 : -1;
}
function angleAt(a, b, c) {
  const co = (sq(a, b) + sq(a, c) - sq(b, c)) / 2 / dd(a, b) / dd(a, c);
  const ang = Math.acos(co);
  if (ang > 0.99 && (b.x - a.x) ** 2 + (b.y - a.y) ** 2 < 0) return Math.PI;
  return ori(a, b, c) === 1 ? ang : -ang;
}
function rotated(a, b, t, sign) {
  const cs = Math.cos(t), sn = Math.sin(t);
  return {
    x: a.x + cs * (b.x - a.x) - sign * sn * (b.y - a.y),
    y: a.y + sign * sn * (b.x - a.x) + cs * (b.y - a.y),
  };
}
function crossing(a, b, c, d) {
  const A = a.y - b.y, B = b.x - a.x, Cc = a.x * b.y - a.y * b.x;
  const A2 = c.y - d.y, B2 = d.x - c.x, C2 = c.x * d.y - c.y * d.x;
  const det = A * B2 - A2 * B;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (B * C2 - B2 * Cc) / det, y: (A2 * Cc - A * C2) / det };
}
/* DirectlySimilar2Canvas.CompleteTriangle(), step for step. */
function appletComplete(a, b, c, d, e) {
  if (dd(d, e) < 0.1 || dd(a, b) < 0.1) return null;
  const u = rotated(d, e, angleAt(a, b, c), 1);
  const v = rotated(e, d, angleAt(b, a, c), 1);
  const f = crossing(d, u, e, v);
  if (f.x === 0 && f.y === 0) return null;
  if (Number.isNaN(f.x) || Number.isNaN(f.y)) return null;
  return f;
}
/* DirectlySimilar2Canvas.TranslateLines(), step for step. */
function appletTranslated(P, A, B, Cc, D, E, F) {
  return [
    { x: P.x + A.x - D.x, y: P.y + A.y - D.y },
    { x: P.x + B.x - E.x, y: P.y + B.y - E.y },
    { x: P.x + Cc.x - F.x, y: P.y + Cc.y - F.y },
  ];
}

/* Structured five-point configurations: 45 triangles x 45 primed pairs. */
const triangles = [], pairs = [];
for (const cx of [0, 100, 200]) {
  for (const cy of [0, 100, 200]) {
    for (const [vx, vy] of [[60, 0], [0, 60], [40, 50], [-30, 40], [70, -20]]) {
      triangles.push([
        { x: cx, y: cy }, { x: cx + vx, y: cy + vy },
        { x: cx - vy / 2, y: cy + vx / 2 },
      ]);
    }
  }
}
for (const dx of [50, 250, 400]) {
  for (const dy of [50, 250, 400]) {
    for (const [kx, ky] of [[1, 0], [0, 1], [2, 1], [-1, 1], [0.5, -1.5]]) {
      pairs.push([{ x: dx, y: dy }, { x: dx + 60 * kx, y: dy + 60 * ky }]);
    }
  }
}
check("the structured grid holds 45 triangles and 45 primed pairs",
  triangles.length === 45 && pairs.length === 45);

{
  check("a completed triangle with D=A, E=B reproduces C",
    samePoint(C.completed({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 },
      { x: 0, y: 0 }, { x: 10, y: 0 }), { x: 0, y: 10 }, 1e-9));

  let wrong = 0, total = 0, missing = 0;
  for (const [a, b, c] of triangles) {
    for (const [d, e] of pairs) {
      total++;
      const want = appletComplete(a, b, c, d, e);
      if (!want) missing++;
      if (!nullOrPoint(C.completed(a, b, c, d, e), want, 1e-7)) wrong++;
    }
  }
  check("2,025 structured completions match the bytecode", total === 2025 && wrong === 0,
    `${wrong} of ${total} wrong`);
  check("every structured configuration builds a second triangle", missing === 0,
    `${missing} missing`);

  const rand = rng(2718);
  let randomWrong = 0;
  for (let i = 0; i < 5000; i++) {
    const p = [0, 1, 2, 3, 4].map(() => ({
      x: (rand() - 0.5) * 2000, y: (rand() - 0.5) * 2000,
    }));
    const want = appletComplete(...p);
    if (!nullOrPoint(C.completed(...p), want, 1e-7)) randomWrong++;
  }
  check("5,000 random completions match the bytecode", randomWrong === 0,
    `${randomWrong} wrong`);

  let translatedWrong = 0;
  for (let i = 0; i < 5000; i++) {
    const q = [0, 1, 2, 3, 4, 5].map(() => ({
      x: (rand() - 0.5) * 4000, y: (rand() - 0.5) * 4000,
    }));
    const state = C.start({});
    state.points = q;
    const want = appletTranslated(q[5], q[0], q[1], q[2], q[3], q[4], q[0]);
    const got = C.translated(state, q[0]);
    if (!samePoints(got, want, 1e-9)) translatedWrong++;
  }
  check("5,000 translations match TranslateLines", translatedWrong === 0,
    `${translatedWrong} wrong`);

  const state = C.start({});
  const f = C.complete(state);
  const p = state.points;
  check("figures() uses the completed C' from the canvas",
    samePoint(C.figures(state).f, appletComplete(p[0], p[1], p[2], p[3], p[4]), 1e-9));
  check("figures() uses the translated corners from the canvas",
    samePoints(C.figures(state).third,
      appletTranslated(p[5], p[0], p[1], p[2], p[3], p[4], f), 1e-9));
}

/* ------------------------------------------------- 3. the page's exact claim */

{
  const Ps = [{ x: 0, y: 0 }, { x: 123, y: 456 }, { x: 500, y: 500 }];
  let checked = 0, collapsed = 0, bad = 0, primedBad = 0, collapsedBad = 0;
  for (const [a, b, c] of triangles) {
    for (const [d, e] of pairs) {
      const f = appletComplete(a, b, c, d, e);
      if (!f) continue;
      const primed = [d, e, f];
      if (!C.isDirectlySimilar(primed, [a, b, c], 1e-7)) primedBad++;
      for (const P of Ps) {
        const third = appletTranslated(P, a, b, c, d, e, f);
        if (dd(third[0], third[1]) < 1e-6) {
          collapsed++;
          const at = { x: P.x + a.x - d.x, y: P.y + a.y - d.y };
          if (!third.every((q) => samePoint(q, at, 1e-7))) collapsedBad++;
          continue;
        }
        checked++;
        if (!C.isDirectlySimilar(third, [a, b, c], 1e-7) ||
            !C.isDirectlySimilar(third, primed, 1e-7)) bad++;
      }
    }
  }
  check("the completed primed triangle is similar to ABC in every case",
    primedBad === 0, `${primedBad} wrong`);
  check("the page's claim holds in thousands of configurations",
    checked > 5000 && bad === 0, `${bad} of ${checked} failed`);
  check("a translate of ABC is counted separately, not called a failure",
    collapsed > 0 && collapsedBad === 0,
    `${collapsed} collapses, ${collapsedBad} wrong`);

  /* Independent directly similar figures, built from a complex multiplier
   * rather than from the canvas's angle construction. Includes a five-point
   * figure, which is the page's general "traces a figure" claim. */
  const rand = rng(314159);
  let genericBad = 0;
  for (let i = 0; i < 5000; i++) {
    const z = [0, 1, 2, 3, 4].map(() => ({
      x: (rand() - 0.5) * 500, y: (rand() - 0.5) * 500,
    }));
    let q = { x: (rand() - 0.5) * 6, y: (rand() - 0.5) * 6 };
    if (Math.hypot(q.x - 1, q.y) < 0.01) q = { x: 1.7, y: 2.3 };
    const base = { x: 40 + rand() * 200, y: 40 + rand() * 200 };
    const w = z.map((v) => {
      const dx = v.x - z[0].x, dy = v.y - z[0].y;
      return { x: base.x + q.x * dx - q.y * dy, y: base.y + q.y * dx + q.x * dy };
    });
    const P = { x: (rand() - 0.5) * 900, y: (rand() - 0.5) * 900 };
    const s = z.map((v, k) => ({ x: P.x + v.x - w[k].x, y: P.y + v.y - w[k].y }));
    const r0 = C.complexDiv({ x: s[1].x - s[0].x, y: s[1].y - s[0].y },
      { x: z[1].x - z[0].x, y: z[1].y - z[0].y });
    for (let k = 2; k < 5; k++) {
      const rk = C.complexDiv({ x: s[k].x - s[0].x, y: s[k].y - s[0].y },
        { x: z[k].x - z[0].x, y: z[k].y - z[0].y });
      if (Math.hypot(r0.x - rk.x, r0.y - rk.y) > 1e-7) genericBad++;
    }
    if (!C.isDirectlySimilar(s.slice(0, 3), z.slice(0, 3), 1e-7)) genericBad++;
  }
  check("the general claim holds for 5,000 arbitrary directly similar figures",
    genericBad === 0, `${genericBad} failures`);
}

/* ------------------------------------- 4. sign, limits and status messages */

{
  /* The page writes AA' = A' - A; TranslateLines writes A - A'. Both give a
   * similar triangle: one is the image of the other under a half-turn at P. */
  const state = C.start({});
  const p = state.points, f = C.complete(state);
  const canvas = C.translated(state, f);
  const pageDirect = [
    { x: p[5].x + p[3].x - p[0].x, y: p[5].y + p[3].y - p[0].y },
    { x: p[5].x + p[4].x - p[1].x, y: p[5].y + p[4].y - p[1].y },
    { x: p[5].x + f.x - p[2].x, y: p[5].y + f.y - p[2].y },
  ];
  check("the page's own sign also gives a triangle similar to ABC",
    C.isDirectlySimilar(pageDirect, C.figures(state).abc, 1e-7));
  check("the page's figure and the canvas figure are half-turns of each other",
    samePoints(canvas, pageDirect.map((q) => ({
      x: 2 * p[5].x - q.x, y: 2 * p[5].y - q.y,
    })), 1e-9));

  /* Sliding P translates every new corner by the same step. */
  const shifted = C.movePoint(state, 5, { x: p[5].x + 37, y: p[5].y - 21 });
  const before = C.translated(state, f), after = C.translated(shifted, f);
  check("moving P moves all three new corners by the same amount",
    after.every((q, k) => samePoint(q, { x: before[k].x + 37, y: before[k].y - 21 }, 1e-9)));
  check("moving P leaves the new triangle's shape alone",
    C.angleError(before, after) < 1e-9);

  /* A translate of ABC (q = 1) collapses both the primed completion and the
   * new triangle; the canvas refuses a second triangle when its two dragged
   * corners are too close, or when A and B are too close. */
  const shiftedState = C.start({});
  shiftedState.points = [
    { x: 10, y: 10 }, { x: 70, y: 40 }, { x: 30, y: 80 },
    { x: 50, y: 60 }, { x: 110, y: 90 }, { x: 5, y: 5 },
  ];
  const sf = C.complete(shiftedState);
  check("a translate of ABC rebuilds C' as C shifted by the same step",
    samePoint(sf, { x: 70, y: 130 }, 1e-7), JSON.stringify(sf));
  const sc = C.translated(shiftedState, sf);
  check("a translate of ABC collapses A1B1C1 to the point P - AA'",
    sc.every((q) => samePoint(q, { x: 5 - 40, y: 5 - 50 }, 1e-7)), JSON.stringify(sc));
  check("the status line names the collapse", /collapsed/.test(C.describe(shiftedState)));

  const closeState = C.start({});
  closeState.points[3] = { x: 100, y: 100 };
  closeState.points[4] = { x: 100.02, y: 100 };
  check("C' is not built from two nearly coincident A' and B'",
    C.complete(closeState) === null && C.figures(closeState).third === null);
  const closeAB = C.start({});
  closeAB.points[0] = { x: 100, y: 100 };
  closeAB.points[1] = { x: 100.04, y: 100 };
  check("C' is not built from two nearly coincident A and B",
    C.complete(closeAB) === null && /Move A' away/.test(C.describe(closeAB)));
  const collinear = { points: [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 },
    { x: 40, y: 10 }, { x: 60, y: 10 }, { x: 0, y: 0 },
  ] };
  check("a collinear ABC has no completed third vertex",
    nullOrPoint(C.complete(collinear), appletComplete(...collinear.points), 1e-9));

  /* Directly similar means orientation-preserving: a mirror copy does not
   * give a directly similar new triangle in the same correspondence. */
  const mirror = [{ x: 40, y: 10 }, { x: 50, y: 20 }, { x: 50, y: 6 }];
  const original = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 3, y: 7 }];
  const mirrorThird = original.map((v, k) => ({
    x: v.x - mirror[k].x, y: v.y - mirror[k].y,
  }));
  check("an oppositely similar copy is not directly similar",
    C.similarityError(mirrorThird, original) > 0.1,
    `ratio error ${C.similarityError(mirrorThird, original)}`);
  check("the mirror copy itself is not directly similar to ABC",
    !C.isDirectlySimilar(mirror, original, 1e-6));
}

done("directly-similar-2");
