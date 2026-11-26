#!/usr/bin/env node
"use strict";

/*
 * Logic test for apmo-2009-3/apmo-2009-3-core.js.
 *
 *   node porting/check-apmo-2009-3.mjs
 *
 * 1. The four handles, three switches and Reset obey the applet's rules.
 * 2. The page's claims are checked over a grid of base lengths and heights and
 *    450 positions each: S is at or above T (equality at AB = AC), the product
 *    of the altitudes is 4a^2 h^3/(AB*AC) and is largest where AB*AC is
 *    smallest. That last claim is TRUE only while the base is at most twice
 *    the height; when it is longer the right-angle position wins, and the
 *    isosceles point the page names is the worst of its neighbours. The test
 *    checks both regimes and fails if either disappears.
 * 3. APMO2009_3Canvas.Compute is transcribed a second time from the bytecode
 *    (NearestPoint, Intersect, Barycenter, FindCircumcenter, GetCircle, the
 *    midpoints, T and S) and compared with the core on every sample position.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("apmo-2009-3/apmo-2009-3-core.js", "Apmo20093Core");

/* ------------------------------------------- a second transcription of the applet */

const half = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const length = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/** GeoSDoub.Intersect(a,b,c,d), the determinant form in the bytecode. */
function appletIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.NearestPoint(p,a,b) — the perpendicular foot on line ab. */
function appletNearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** GeoSDoub.FindCircumcenter: intersect the bisectors of AB and BC. */
function appletCircumcenter(a, b, c) {
  const m1 = half(a, b), m2 = half(b, c);
  const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  return appletIntersect(m1, p, m2, q);
}

/** APMO2009_3Canvas.GetCircle(a,b,c): centre + mean of the three radii. */
function appletCircle(a, b, c) {
  const center = appletCircumcenter(a, b, c);
  return { center, radius: (length(center, a) + length(center, b) + length(center, c)) / 3 };
}

/** CTKGeometryPlus.Barycenter of the three pairwise altitude intersections. */
function appletBarycenter(a, b, c) {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

/** APMO2009_3Canvas.Compute(), literally, for a triangle with horizontal BC. */
function appletCompute(A, B, Cc) {
  const Ah = appletNearestPoint(A, B, Cc);
  const Bh = appletNearestPoint(B, Cc, A);
  const Ch = appletNearestPoint(Cc, A, B);
  const H = appletBarycenter(
    appletIntersect(A, Ah, B, Bh),
    appletIntersect(B, Bh, Cc, Ch),
    appletIntersect(Cc, Ch, A, Ah),
  );
  const circle = appletCircle(A, B, Cc);
  const Am = half(B, Cc), Bm = half(Cc, A), Cm = half(A, B);
  const A0m = { x: Am.x, y: 0 };
  const T = { x: Am.x, y: A.y };
  const S = { x: Am.x, y: circle.center.y - circle.radius };
  const circle1 = appletCircle(T, B, Cc);
  return {
    Ah, Bh, Ch, H, circle, circle1, Am, Bm, Cm, A0m, T, S,
    Tb: half(T, Cc), Tc: half(T, B), Sb: half(S, Cc), Sc: half(S, B),
  };
}

/* ------------------------------------------------------------- the sample grid */

const states = [];
for (const a of [30, 45, 60, 80, 100, 120, 150, 180]) {
  for (const h of [25, 40, 60, 80, 100, 120, 150, 170]) {
    for (const frac of [-1, -0.6, -0.25, 0, 0.25, 0.6, 1]) {
      const mid = 200, u = frac * a;
      states.push({
        A: { x: mid + u, y: C.BASE_Y - h },
        B: { x: mid - a, y: C.BASE_Y },
        C: { x: mid + a, y: C.BASE_Y },
        showNames: true, showHint1: false, showHint2: false, moves: 0, explored: false,
      });
    }
  }
}
const rnd = rng(20090403);
for (let i = 0, added = 0; i < 2000 && added < 450; i++) {
  const mid = 200;
  const a = 35 + rnd() * 145, h = 25 + rnd() * 145;
  const u = (rnd() * 2 - 1) * a * 1.2;
  if (mid + u < C.EDGE || mid + u > C.WIDTH - C.EDGE) continue;
  states.push({
    A: { x: mid + u, y: C.BASE_Y - h },
    B: { x: mid - a, y: C.BASE_Y },
    C: { x: mid + a, y: C.BASE_Y },
    showNames: false, showHint1: true, showHint2: true, moves: 0, explored: false,
  });
  added++;
}

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  check("the opening picture has three distinct points", [s.A, s.B, s.C].every(C.finite)
    && C.dist(s.B, s.C) > C.MIN_BASE && s.A.y < s.B.y);
  check("B and C sit on the fixed base line, A on its own line",
    s.B.y === C.BASE_Y && s.C.y === C.BASE_Y && s.A.y === C.compute(s).T.y);
  check("names start on and the two hints start off",
    s.showNames === true && s.showHint1 === false && s.showHint2 === false);
  equal("counters start at zero", [s.moves, s.explored], [0, false]);
  check("the demo has not been explored yet", C.result(s) === null);
  equal("four handles, three switches and Reset are legal", C.legalMoves(s).length, 8);
  check("legal moves name every handle and switch",
    C.legalMoves(s).slice(0, 4).map((m) => m.name).join(",") === "A,B,C,height"
    && C.legalMoves(s).slice(4, 7).map((m) => m.key).join(",") === C.OPTION_KEYS.join(","));
}

/* ----------------------------------------- 2. dragging, switches and reset */

{
  const s = C.start();
  const moved = C.move(s, { type: "point", name: "A", point: { x: 210, y: 12 } });
  check("dragging A moves it sideways but keeps the height fixed",
    moved && moved.A.x === 210 && moved.A.y === s.A.y && moved.B.x === s.B.x && moved.C.x === s.C.x);
  check("dragging A off the board is kept inside it",
    C.move(s, { type: "point", name: "A", point: { x: 9999, y: -999 } }).A.x <= C.WIDTH - C.EDGE);
  const height = C.move(s, { type: "point", name: "height", point: { x: C.LINE_X, y: 155 } });
  check("dragging the altitude line changes A's height and nothing else",
    height.A.y === 155 && height.A.x === s.A.x && height.B.y === s.B.y && height.C.y === s.C.y);
  check("the height cannot collapse or leave the board",
    C.move(s, { type: "point", name: "height", point: { y: C.BASE_Y } }).A.y <= C.BASE_Y - C.MIN_ALT
    && C.move(s, { type: "point", name: "height", point: { y: -999 } }).A.y >= C.BASE_Y - C.MAX_ALT);
  const c = C.move(s, { type: "point", name: "C", point: { x: s.B.x + 5, y: C.BASE_Y } });
  check("C cannot be dragged closer than the smallest base",
    c && c.C.x - c.B.x >= C.MIN_BASE && c.C.y === C.BASE_Y);
  check("an unknown handle is refused", C.move(s, { type: "point", name: "Z", point: s.A }) === null);
  check("an unknown switch is refused", C.move(s, { type: "option", key: "wrong", value: true }) === null);
  check("a non-boolean switch is refused", C.move(s, { type: "option", key: "showHint1", value: 1 }) === null);
  check("a bad move is refused", C.move(s, null) === null && C.move(null, { type: "reset" }) === null);
  let t = s;
  for (const key of C.OPTION_KEYS) t = C.move(t, { type: "option", key, value: true });
  check("all three applet switches can be ticked without moving the corners",
    C.OPTION_KEYS.every((k) => t[k] === true) && t.moves === 3
    && [s.A, s.B, s.C].every((p, i) => C.dist(p, [t.A, t.B, t.C][i]) === 0));
  const reset = C.move(t, { type: "reset" });
  check("Reset restores the opening points and keeps the switches",
    [s.A, s.B, s.C].every((p, i) => C.dist(p, [reset.A, reset.B, reset.C][i]) === 0)
    && C.OPTION_KEYS.every((k) => reset[k] === true));
  check("moves do not change the position they were given",
    s.moves === 0 && !s.explored && s.A.x === 140 && t.showHint1 === true && resultOf(t) === "done");
  check("any move finishes this picture once it was explored",
    C.result(t) === "done" && C.result(reset) === "done");
  check("three points on a line make a degenerate picture",
    C.compute({ ...s, A: { x: 200, y: C.BASE_Y - 1 } }).degenerate === true);
}

function resultOf(state) { return C.result(state); }

/* ------------------------------------------- 3. the page's claims, over the grid */

{
  let maxGap = -Infinity, minGapAway = Infinity, maxGapAtT = 0;
  let maxProductError = 0, maxRadiusError = 0, maxBcError = 0;
  let maxResidual = 0, holdsCases = 0, failsCases = 0, badClaim = 0;
  let sawStrict = 0, sawEquality = 0;
  for (const s of states) {
    const g = C.compute(s);
    if (g.degenerate) continue;
    const u = g.offset, a = g.a, h = g.height;
    maxGap = Math.max(maxGap, g.gap);
    if (Math.abs(u) < 1e-9) {
      maxGapAtT = Math.max(maxGapAtT, Math.abs(g.gap));
      sawEquality++;
    } else {
      minGapAway = Math.min(minGapAway, g.gap);
      sawStrict++;
    }
    const direct = C.metricsAt(a, h, u);
    maxBcError = Math.max(maxBcError, Math.abs(direct.bc - g.b * g.c));
    maxProductError = Math.max(maxProductError,
      Math.abs(direct.product - g.product), Math.abs(g.product - h * g.altitudeB * g.altitudeC));
    maxRadiusError = Math.max(maxRadiusError, Math.abs(direct.radius - g.r));

    const r = C.residuals(s, g);
    for (const key of Object.keys(r)) maxResidual = Math.max(maxResidual, r[key]);

    const b = C.bestFor(g.base, h);
    if (b.holds !== (a <= h + 1e-9)) badClaim++;
    if (b.holds) {
      holdsCases++;
      if (g.product > b.isosceles.product * (1 + 1e-9)) badClaim++;
    } else {
      failsCases++;
      if (!(b.right.product > b.isosceles.product)) badClaim++;
      if (g.product > b.right.product * (1 + 1e-9)) badClaim++;
    }
  }
  check("S is never below T over every base, height and A position",
    maxGap >= -1e-7, `lowest gap ${maxGap}`);
  check("S meets T exactly at the isosceles position",
    sawEquality > 50 && maxGapAtT < 1e-7, `at T ${maxGapAtT}, ${sawEquality} cases`);
  check("S is strictly above T everywhere else",
    sawStrict > 300 && minGapAway > 1e-6, `closest ${minGapAway}, ${sawStrict} cases`);
  check("the altitude product equals 4a^2h^3/(AB*AC) on every position",
    maxProductError < 1e-5, `max ${maxProductError}`);
  check("the closed form for AB*AC matches the drawn sides",
    maxBcError < 1e-8, `max ${maxBcError}`);
  check("the circumradius formula matches the applet's GetCircle radius",
    maxRadiusError < 1e-8, `max ${maxRadiusError}`);
  check("feet, orthocenter, circle and the hint circle are geometrically exact",
    maxResidual < 1e-7, `max ${maxResidual}`);
  check("bestFor agrees with the base-versus-height condition on every case", badClaim === 0,
    `${badClaim} mismatches`);
  check("both regimes were exercised: claim holds and claim fails",
    holdsCases > 100 && failsCases > 100, `${holdsCases} hold, ${failsCases} fail`);

  // A precise extremum check on three representative shapes.
  const tall = C.compute(C.start());
  check("on the tall start the isosceles product is the largest",
    tall.best.holds && tall.best.best.kind === "isosceles"
    && tall.product <= tall.best.best.product * (1 + 1e-9));
  const wide = C.compute(C.start({ height: 40 }));
  check("with a wide base the right-angle position beats the isosceles one",
    !wide.best.holds && wide.best.best.kind === "right-angle"
    && wide.best.best.product > wide.best.isosceles.product + 1);
  const a = wide.a, h = wide.height, u = wide.best.best.u;
  const right = C.compute({
    A: { x: 200 + u, y: C.BASE_Y - h }, B: { x: 200 - a, y: C.BASE_Y },
    C: { x: 200 + a, y: C.BASE_Y }, showNames: true, showHint1: false, showHint2: false,
  });
  check("the true maximum has a right angle at A",
    Math.abs(right.angleA - Math.PI / 2) < 1e-7 && Math.abs(right.r - a) < 1e-7);
  check("at a wide base the isosceles point is the worst of its neighbours",
    C.metricsAt(a, h, 0).product < C.metricsAt(a, h, 5).product - 1e-3
    && C.metricsAt(a, h, 0).product < C.metricsAt(a, h, -5).product - 1e-3);
  const iso = C.compute(C.start({ A: { x: 200, y: C.BASE_Y - 120 } }));
  check("at T the sides AB and AC are equal and S touches T",
    Math.abs(iso.b - iso.c) < 1e-9 && Math.abs(iso.gap) < 1e-7);
  equal("a base of exactly twice the height is the boundary case",
    [C.bestFor(240, 120).holds, C.bestFor(241, 120).holds], [true, false]);
}

/* --------------------------- 4. the applet's own bytecode, transcribed twice */

{
  let feet = 0, centers = 0, circles = 0, ortho = 0;
  let mids = 0, points = 0;
  for (const s of states) {
    const g = C.compute(s);
    if (g.degenerate) continue;
    const q = appletCompute(s.A, s.B, s.C);
    feet = Math.max(feet, length(q.Ah, g.Ah), length(q.Bh, g.Bh), length(q.Ch, g.Ch));
    centers = Math.max(centers, length(q.circle.center, g.O));
    circles = Math.max(circles, Math.abs(q.circle.radius - g.r));
    ortho = Math.max(ortho, length(q.H, g.H));
    mids = Math.max(mids, length(q.Am, g.Am), length(q.Bm, g.Bm), length(q.Cm, g.Cm),
      length(q.Tb, g.Tb), length(q.Tc, g.Tc), length(q.Sb, g.Sb), length(q.Sc, g.Sc));
    points = Math.max(points, length(q.A0m, g.A0m), length(q.T, g.T), length(q.S, g.S),
      length(q.circle1.center, g.circle1.center), Math.abs(q.circle1.radius - g.circle1.radius));
  }
  check("GeoSDoub.NearestPoint matches the core's three feet", feet < 1e-7, `max ${feet}`);
  check("GeoSDoub.FindCircumcenter matches the core's center", centers < 1e-7, `max ${centers}`);
  check("GetCircle's averaged radius matches the core on every position", circles < 1e-7, `max ${circles}`);
  check("Intersect plus Barycenter give the same orthocenter", ortho < 1e-7, `max ${ortho}`);
  check("all applet midpoints match the core's Am, Bm, Cm, Tb, Tc, Sb, Sc", mids < 1e-7, `max ${mids}`);
  check("applet T, S, A0m and the circle of TBC match the core", points < 1e-7, `max ${points}`);
}

done("apmo-2009-3");
