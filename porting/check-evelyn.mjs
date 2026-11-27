#!/usr/bin/env node
"use strict";

/*
 * Logic test for evelyn/evelyn-core.js.
 *
 *   node porting/check-evelyn.mjs
 *
 * Checks the start position and option ranges, then compares the core with a
 * second, literal transcription of EvelynCanvas / GeoSDoub / QuadraticEquation
 * over a grid of canvas sizes, starting-point parameters and pair selections.
 * It then checks the cut-the-knot page's claim — "any chain ... counts at most
 * six circles" — over the same grid plus random triangles: every drawn circle
 * touches its two sides and its neighbours, and the seventh circle is the
 * first one again whenever the chain uses the two sides as segments. The
 * applet's Solve2 root preference is pinned separately, including the cases
 * where it picks a circle tangent to a side's extension instead.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("evelyn/evelyn-core.js", "EvelynCore");
const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;
const SIZES = [
  [120, 160], [160, 360], [200, 160], [300, 320], [320, 500], [400, 300],
  [500, 250], [500, 450], [500, 800], [700, 400], [800, 450], [800, 800],
];
const TAS = [0, 0.02, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.98, 1];

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start({});
  check("start width is the applet's 500", s.w === C.WIDTH);
  check("start height is the applet's 450", s.h === C.HEIGHT);
  check("start Ta is the applet's 0.7", s.Ta === 0.7);
  check("start shows all circles (Which=6)", s.which === 6);
  check("start vertices use the applet's integer division",
    JSON.stringify(s.V) === JSON.stringify([{ x: 250, y: 20 }, { x: 62, y: 430 }, { x: 437, y: 360 }]));
  const changed = C.withOptions(s, { Ta: 9, which: 99 });
  check("Ta is clamped to 1", changed.Ta === 1);
  check("Which is clamped to 6", changed.which === 6);
  check("start does not mutate its options", s.Ta === 0.7 && s.V[0].x === 250);
  const dragged = C.withOptions(s, { V: [{ x: 300, y: 50 }, { x: 80, y: 400 }, { x: 450, y: 350 }] });
  check("dragged vertices are stored as plain points", dragged.V[1].x === 80 && dragged.V[1].y === 400);
  check("dragged vertices stay inside the board", C.withOptions(s, { V: [{ x: -50, y: 999 }, { x: 0, y: 0 }, { x: 0, y: 0 }] }).V[0].x === 0);
  check("the default chain draws six circles", C.chain(s).length === 6);
}

/* ------------------------ 2. a second transcription of the applet's method */

/*
 * Written independently from javap -c -p of EvelynCanvas.class,
 * GeoSDoub.class and QuadraticEquation.class. Points are [x,y] arrays here so
 * that the comparison does not share the core's point representation. Local
 * slot names (L5, L7, L9, L11, m_Ta) are the applet's own.
 */
const Applet = (() => {
  const SqDist = (a, b) => (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]);
  const Dist = (a, b) => Math.sqrt(SqDist(a, b));
  const P = (x, y) => [x, y];

  function FindOrientation(a, b, c) {
    const cross = c[0] * (a[1] - b[1]) + c[1] * (b[0] - a[0]) + a[0] * b[1] - b[0] * a[1];
    return cross > 0 ? 1 : -1;
  }
  function Rotate(a, b, theta, s) {
    const co = Math.cos(theta), si = Math.sin(theta);
    return P(a[0] + co * (b[0] - a[0]) - s * si * (b[1] - a[1]),
      a[1] + s * si * (b[0] - a[0]) + co * (b[1] - a[1]));
  }
  function Intersect(a, b, c, d) {
    const a4 = a[1] - b[1], b4 = b[0] - a[0], c4 = a[0] * b[1] - a[1] * b[0];
    const a5 = c[1] - d[1], b5 = d[0] - c[0], c5 = c[0] * d[1] - c[1] * d[0];
    const n1 = b4 * c5 - b5 * c4, n2 = c4 * a5 - c5 * a4, den = a4 * b5 - a5 * b4;
    return Math.abs(den) < 1 ? P(NaN, NaN) : P(n1 / den, n2 / den);
  }
  function ComputeAngle(a, b, c) {
    const numerator = (SqDist(a, b) + SqDist(a, c) - SqDist(b, c)) / 2;
    return Math.acos(numerator / Dist(a, b) / Dist(a, c));
  }
  function FindAngleBisector(a, b, c) {
    const half = ComputeAngle(a, b, c) / 2;
    return Intersect(a, Rotate(a, b, half, FindOrientation(a, b, c)), b, c);
  }
  function NearestPoint(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (SqDist(a, p) < 0.1) return p;
    const t = (dx * (p[0] - a[0]) + dy * (p[1] - a[1])) / (dx * dx + dy * dy);
    return P(a[0] + dx * t, a[1] + dy * t);
  }
  function DistPointLine(p, line) {
    const dx = line[1][0] - line[0][0], dy = line[1][1] - line[0][1];
    if (SqDist(line[0], p) < 0.1) return 0;
    const t = (dx * (p[0] - line[0][0]) + dy * (p[1] - line[0][1])) / (dx * dx + dy * dy);
    return Math.hypot(line[0][0] - p[0] + dx * t, line[0][1] - p[1] + dy * t);
  }
  function Solve2(a, b, c) {
    if (Math.abs(a) < 0.01) return null;
    const D = b * b - a * c;
    if (D < 0) return null;
    return [(-b + Math.sqrt(D)) / a, (-b - Math.sqrt(D)) / a];
  }
  function GetTouchingCircle(A, c, B, C) {
    const L5 = Dist(C, NearestPoint(C, B, A));
    const L7 = SqDist(C, B) - L5 * L5;
    const L9 = (C[0] - B[0]) * (B[0] - c[0]) + (C[1] - B[1]) * (B[1] - c[1]) - c[2] * L5;
    const L11 = SqDist(B, c) - c[2] * c[2];
    const roots = Solve2(L7, L9, L11);
    if (!roots || Number.isNaN(roots[0]) || Number.isNaN(roots[1])) return null;
    let L14 = -1;
    if (roots[0] >= 0 && roots[0] <= 1) L14 = roots[0];
    if (L14 < 0 && roots[1] >= 0 && roots[1] <= 1) L14 = roots[1];
    if (L14 < 0) return null;
    return [B[0] + L14 * (C[0] - B[0]), B[1] + L14 * (C[1] - B[1]), L5 * L14, L14, L5];
  }
  function IsRed(which, k) {
    if (which === 6) return true;
    if (k === 0) return which === 0 || which === 5;
    return k === which || (k + 5) % 6 === which;
  }

  /** EvelynCanvas.Reset + CreateBisector + ShowCircles, in one pass. */
  return function run(w, h, m_Ta, Which) {
    const margin = 20;
    const V = [P(Math.trunc(w / 2), margin), P(Math.trunc(w / 8), h - margin),
      P(Math.trunc((7 * w) / 8), Math.trunc((4 * h) / 5))];
    const L = [FindAngleBisector(V[0], V[2], V[1]), FindAngleBisector(V[1], V[0], V[2]),
      FindAngleBisector(V[2], V[1], V[0])];
    const sides = [[V[0], V[1]], [V[1], V[2]], [V[2], V[0]]];
    const midpoint = P(V[0][0] * m_Ta + L[0][0] * (1 - m_Ta), V[0][1] * m_Ta + L[0][1] * (1 - m_Ta));
    let c = [midpoint[0], midpoint[1], DistPointLine(midpoint, sides[0])];
    const out = [{ x: c[0], y: c[1], r: c[2], k: 0, red: IsRed(Which, 0) }];
    for (let k = 1; k < 6; k++) {
      const i = k % 3, j = (i + 2) % 3;
      const next = GetTouchingCircle(V[j], c, V[i], L[i]);
      if (!next) break;
      c = next;
      out.push({ x: c[0], y: c[1], r: c[2], k, red: IsRed(Which, k), t: c[3], d: c[4] });
    }
    return { V, L, P: midpoint, circles: out };
  };
})();

{
  let cases = 0, circles = 0, fields = 0;
  for (const [w, h] of SIZES) {
    for (const Ta of TAS) {
      for (let which = 0; which <= 6; which++) {
        const state = C.start({ w, h, Ta, which });
        const theirs = Applet(w, h, Ta, which);
        const g = C.geometry(state);
        const ours = C.chain(state);
        cases++;
        for (let i = 0; i < 3; i++) {
          if (near(g.V[i].x, theirs.V[i][0]) && near(g.V[i].y, theirs.V[i][1])) fields++;
          else check(`vertex ${i} at ${w}x${h}`, false);
          if (near(g.L[i].x, theirs.L[i][0]) && near(g.L[i].y, theirs.L[i][1])) fields++;
          else check(`bisector foot ${i} at ${w}x${h}`, false, `${JSON.stringify(g.L[i])}, ${JSON.stringify(theirs.L[i])}`);
        }
        if (near(g.P.x, theirs.P[0]) && near(g.P.y, theirs.P[1])) fields++;
        else check(`starting point at ${w}x${h}, Ta=${Ta}`, false);
        if (ours.length !== theirs.circles.length) {
          check(`same chain length at ${w}x${h}, Ta=${Ta}`, false, `${ours.length} vs ${theirs.circles.length}`);
          continue;
        }
        for (let k = 0; k < ours.length; k++) {
          const a = ours[k], b = theirs.circles[k];
          circles++;
          if (a.k === b.k && C.isRed(which, k) === b.red && near(a.x, b.x) && near(a.y, b.y) && near(a.r, b.r)) fields++;
          else check(`circle ${k} at ${w}x${h}, Ta=${Ta}, Which=${which}`, false,
            `${JSON.stringify(a)}, ${JSON.stringify(b)}`);
          if (k > 0 && near(a.t, b.t) && near(a.d, b.d)) fields++;
          else if (k > 0) check(`circle ${k} tangency parameters at ${w}x${h}, Ta=${Ta}`, false);
        }
      }
    }
  }
  check(`all ${cases} configurations compared with the applet`, cases === SIZES.length * TAS.length * 7);
  check(`all ${circles} circles match centre, radius, index and colour`, circles > 1000);
  check(`all ${fields} transcribed fields agree`, fields > cases * 12);
}

/* ------------------- 3. the page's claim over the whole grid, plus samples */

function feetInside(state, drawn) {
  const g = C.geometry(state);
  return drawn.every((c) => {
    if (![c.x, c.y, c.r].every(Number.isFinite)) return false;
    const i = c.k % 3, j = (i + 2) % 3;
    const u = C.footParameter(c, g.V[i], g.V[(i + 1) % 3]);
    const v = C.footParameter(c, g.V[i], g.V[j]);
    return u >= -1e-7 && u <= 1 + 1e-7 && v >= -1e-7 && v <= 1 + 1e-7;
  });
}

{
  let wellFormed = 0, closes = 0, drawn = 0, short = 0;
  for (const [w, h] of SIZES) {
    for (const Ta of TAS) {
      const state = C.start({ w, h, Ta });
      const c = C.claims(state);
      const chain = C.chain(state);
      drawn += chain.length;
      if (chain.length < 6) short++;
      check(`at most six circles at ${w}x${h}, Ta=${Ta}`, c.atMostSix && chain.length <= 6);
      const all = C.extend(state, 7);
      if (chain.length < 6 || !feetInside(state, all)) continue;
      wellFormed++;
      if (c.finite && c.touchesBothSides && c.neighboursTouch && c.feetOnSides && c.repeatsOrStops) closes++;
      else check(`well-formed chain is tangent and repeats/stops at ${w}x${h}, Ta=${Ta}`, false, JSON.stringify(c));
      if (chain.length === 6 && !near(chain[5].r, chain[5].d * chain[5].t, 1e-6)) {
        check(`radius is d*t at ${w}x${h}, Ta=${Ta}`, false);
      }
    }
  }
  check(`some chains stop early (no root in [0,1])`, short > 0, `${short} of ${SIZES.length * TAS.length}`);
  check(`all ${wellFormed} well-formed chains repeat or stop by six`, wellFormed > 100 && closes === wellFormed);
  check(`over ${drawn} drawn circles, none exceeded the six-circle bound`, drawn > 600);

  /* Random triangles, not just the applet's three preset vertices. */
  const rand = rng(20261127);
  let samples = 0, randomClosed = 0;
  for (let n = 0; n < 600; n++) {
    const V = [
      { x: 60 + rand() * 380, y: 20 + rand() * 60 },
      { x: 10 + rand() * 120, y: 300 + rand() * 140 },
      { x: 380 + rand() * 110, y: 260 + rand() * 160 },
    ];
    const Ta = 0.03 + rand() * 0.94;
    const state = C.start({ w: 500, h: 450, V, Ta });
    const chain = C.chain(state);
    samples++;
    check(`random triangle ${n} has at most six circles`, chain.length <= 6);
    const all = C.extend(state, 7);
    if (chain.length < 6 || !feetInside(state, all)) continue;
    const c = C.claims(state);
    if (c.touchesBothSides && c.neighboursTouch && c.repeatsOrStops) randomClosed++;
    else check(`random triangle ${n} closes after six`, false, JSON.stringify(c));
  }
  check(`all well-formed random triangles repeat or stop (${randomClosed}/${samples})`, randomClosed > 250);
}

/* --------------------------- 4. the default picture, pinned exactly */

{
  const s = C.start({});
  const cs = C.chain(s);
  const g = C.geometry(s);
  check("default first circle is centred at P", near(cs[0].x, g.P.x) && near(cs[0].y, g.P.y));
  check("default first radius is the distance to side V0V1", near(cs[0].r, C.distToLine(g.P, g.sides[0]), 1e-9));
  check("default radii match the applet's", [50.2658, 106.2629, 36.9645, 106.4600, 49.1712, 103.9094]
    .every((r, i) => near(cs[i].r, r, 1e-3)), cs.map((c) => c.r.toFixed(4)).join(","));
  const seventh = C.extend(s, 7)[6];
  check("the seventh circle is the first", near(seventh.x, cs[0].x, 1e-6)
    && near(seventh.y, cs[0].y, 1e-6) && near(seventh.r, cs[0].r, 1e-6));
  check("the closing parameter is 1 - Ta", near(seventh.t, 0.3, 1e-9));
  for (let pair = 0; pair < 6; pair++) {
    const reds = cs.filter((c) => C.isRed(pair, c.k)).map((c) => c.k);
    const expected = [pair, (pair + 1) % 6];
    check(`pair ${pair + 1} highlights circles ${expected.join(" and ")}`,
      reds.length === 2 && expected.every((k) => reds.includes(k)), reds.join(","));
  }
  check("Which=6 makes every circle red", cs.every((c) => C.isRed(6, c.k)));
}

/* ----------------- 5. the applet's Solve2 root preference, pinned */

{
  /* With an oversized starting circle both roots may lie in [0,1]. The
     applet keeps roots[0], the farther solution, instead of the one that
     would close the chain; the picture still draws at most six circles. */
  const s = C.start({ w: 120, h: 360, Ta: 0.1 });
  const cs = C.chain(s);
  check("the narrow triangle still draws six circles", cs.length === 6);
  const all = C.extend(s, 7);
  check("the applet's root choice does not close this chain", all.length === 7
    && !(near(all[6].x, cs[0].x, 1e-6) && near(all[6].r, cs[0].r, 1e-6)));
  const g = C.geometry(s);
  const foot = C.footParameter(all[6], g.V[0], g.V[2]);
  check("the extra circle touches a side extension, not the side", foot > 1 || foot < 0,
    `foot parameter ${foot}`);
  const wellFormedClaims = C.claims(C.start({}));
  check("the default position satisfies every claim", Object.entries(wellFormedClaims)
    .filter(([name]) => name !== "circles").every(([, ok]) => ok === true),
  JSON.stringify(wellFormedClaims));
}

done("evelyn");
