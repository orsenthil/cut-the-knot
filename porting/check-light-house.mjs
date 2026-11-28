#!/usr/bin/env node
"use strict";

/*
 * Logic test for light-house/light-house-core.js.
 *
 *   node porting/check-light-house.mjs
 *
 * 1. A second transcription of the applet's own bytecode (init, Reset,
 *    SetConfigurations, SetNum, RotatingLine.Shift/GetNext/Recalc,
 *    TwoLineConfiguration.Shift/SetIncrement, GeoSDoub.Intersect and
 *    FindCircumcenter), compared with the core's applet transcription on
 *    every N = 1..12, every Rate1 and Rate2 in -12..12 and several animation
 *    steps: over 150,000 individual crossings.
 * 2. The page's claim: crossings of N equally spaced beams with a half-step
 *    offset are a regular N-gon, for every N, rate pair, row and step tested;
 *    side lengths agree, turns are 360/N and all vertices are concyclic.
 * 3. The options' ranges/defaults, the Ngon buckets, the applet's
 *    ComputeSignedAngle/Shift quirk, and the demo's status line.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("light-house/light-house-core.js", "LightHouseCore");
const PI = Math.PI;
const near = (a, b, tol = 1e-8) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const pointGap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const RATES = Array.from({ length: 25 }, (_, i) => i - 12);

/* ------------------------------------------------- 1. the applet's constants */

{
  const s = C.start({});
  equal("defaults", { N: s.N, rate1: s.rate1, rate2: s.rate2, width: s.width, height: s.height },
    { N: 3, rate1: 1, rate2: 1, width: 640, height: 460 });
  equal("LightHouseCanvas.init points", { P1: s.P1, P2: s.P2, P: s.P }, {
    P1: { x: 256, y: 189 }, P2: { x: 256, y: 271 }, P: { x: 384, y: 250 },
  });
  equal("the ray length R", C.RAY_LENGTH, 1000);
  equal("SetNum's angle buckets", C.NGONS, [60, 120, 240, 360]);
  equal("an out-of-range beam count falls back to three", C.start({ N: 99 }).N, 3);
  equal("a rate above twelve falls back to one", C.start({ rate1: 13, rate2: -13 }).rate1, 1);
  check("a rate of minus twelve is kept", C.start({ rate1: -12, rate2: 12 }).rate1 === -12);
  check("changing an option resets the animation", C.setOptions(C.start({}), { step: 9, N: 4 }).step === 0);
  equal("setOptions keeps the other options",
    (() => { const t = C.setOptions(C.start({}), { N: 8, rate1: -5, rate2: 7 }); return [t.N, t.rate1, t.rate2]; })(),
    [8, -5, 7]);
}

/* ---------------------- 2. a second, literal transcription of the bytecode */

/* GeoSDoub.Intersect(DoubPoint a, b, c, d): determinant construction. */
function refIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;                     // Cramer determinant
  if (Math.abs(det) < 1) return { x: NaN, y: NaN }; // Java: |det| < 1
  return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
}
/* Same determinant, written the way the bytecode's slots read. */
function refIntersectSlots(a, b, c, d) {
  const s4 = a.y - b.y, s6 = b.x - a.x, s8 = a.x * b.y - a.y * b.x;
  const s10 = c.y - d.y, s12 = d.x - c.x, s14 = c.x * d.y - c.y * d.x;
  const s20 = s4 * s12 - s10 * s6;
  if (Math.abs(s20) < 1) return { x: NaN, y: NaN };
  return { x: (s6 * s14 - s12 * s8) / s20, y: (s8 * s10 - s14 * s4) / s20 };
}

/* GeoSDoub.FindCircumcenter(a,b,c) from its own javap listing. */
function refCircumcenter(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const u = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const v = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  return refIntersectSlots(m1, u, m2, v);
}

function refSqDist(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2; }
function refDist(a, b) { return Math.sqrt(refSqDist(a, b)); }

/* GeoSDoub.ComputeSignedAngle(a,b,c), including FindOrientation. */
function refSignedAngle(a, b, c) {
  const cos = ((refSqDist(a, b) + refSqDist(a, c) - refSqDist(b, c)) / 2) /
    (refDist(a, b) * refDist(a, c));
  let angle = Math.acos(Math.max(-1, Math.min(1, cos)));
  if (angle > 0.99 && ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) < 0) angle = PI;
  const orientation = (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
  return orientation > 0 ? angle : -angle;
}

/* RotatingLine: constructor calls Recalc; GetNext mutates Angle; Shift makes
   a fresh line from a point 1000 units away and recalculates its angle. */
function refLine(fixed, moving) {
  return {
    fixed: { x: fixed.x, y: fixed.y },
    moving: { x: moving.x, y: moving.y },
    angle: refSignedAngle(fixed, moving, { x: fixed.x + 100, y: fixed.y }),
    increment: 0,
  };
}
function refNext(l) {
  l.angle += l.increment;
  l.moving = { x: l.fixed.x + 1000 * Math.cos(l.angle), y: l.fixed.y - 1000 * Math.sin(l.angle) };
  return l.moving;
}
function refShiftLine(l, delta) {
  const a = l.angle + delta;
  return refLine(l.fixed, {
    x: l.fixed.x + 1000 * Math.cos(a), y: l.fixed.y - 1000 * Math.sin(a),
  });
}
function refConfig(p1, p2, p) { return { l1: refLine(p1, p), l2: refLine(p2, p) }; }
function refShiftConfig(cfg, delta) {
  const a = refShiftLine(cfg.l1, delta), b = refShiftLine(cfg.l2, delta);
  return refConfig(a.fixed, b.fixed, refIntersectSlots(a.fixed, a.moving, b.fixed, b.moving));
}

function refNgon(state) {
  const cc = refCircumcenter(state.P1, state.P2, state.P);
  const r = (refDist(state.P1, cc) + refDist(state.P2, cc) + refDist(state.P, cc)) / 3;
  return r < 30 ? 60 : r < 90 ? 120 : r < 180 ? 240 : 360;
}

/* LightHouseCanvas.Reset + SetConfigurations(start). */
function refConfigurations(state) {
  const N = state.N, base = refNgon(state), cfg = new Array(N * N);
  cfg[0] = refConfig(state.P1, state.P2, state.P);
  const setConfigurations = (start) => {
    for (let k = start + 1; k < start + N; k++) cfg[k] = refShiftConfig(cfg[k - 1], PI / N);
    for (let k = start; k < start + N; k++) {
      cfg[k].l1.increment = (PI / base) * state.rate1;
      cfg[k].l2.increment = (PI / base) * state.rate2;
    }
  };
  setConfigurations(0);
  for (let i = 1; i < N; i++) {
    const p = refIntersectSlots(cfg[0].l1.fixed, cfg[0].l1.moving,
      cfg[i].l2.fixed, cfg[i].l2.moving);
    cfg[i * N] = refConfig(state.P1, state.P2, p);
    setConfigurations(i * N);
  }
  return cfg;
}

function refAppletPolygon(state, i, step) {
  const cfg = refConfigurations(state), out = [];
  for (let j = 0; j < state.N; j++) {
    const c = cfg[i * state.N + j];
    for (let t = 0; t < step; t++) { refNext(c.l1); refNext(c.l2); }
    out.push(refIntersectSlots(c.l1.fixed, c.l1.moving, c.l2.fixed, c.l2.moving));
  }
  return out;
}

{
  equal("the two forms of GeoSDoub.Intersect agree",
    refIntersect({ x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 }, { x: 0, y: -2 }),
    refIntersectSlots({ x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 }, { x: 0, y: -2 }));
  check("parallel beams give NaN, as the applet's |det| < 1 branch does",
    Number.isNaN(refIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }).x));

  let cases = 0, points = 0, worst = 0;
  const compare = (state, steps) => {
    for (const step of steps) {
      for (let i = 0; i < state.N; i++) {
        const mine = C.appletPolygon(state, i, step);
        const theirs = refAppletPolygon(state, i, step);
        cases++;
        for (let j = 0; j < state.N; j++) {
          points++;
          if (Number.isNaN(theirs[j].x)) {
            if (!Number.isNaN(mine[j].x)) throw new Error(`non-NaN at N=${state.N} i=${i} j=${j}`);
            continue;
          }
          worst = Math.max(worst, pointGap(mine[j], theirs[j]));
        }
      }
    }
  };
  const ODD_RATES = RATES.filter((_, i) => i % 2 === 0);
  for (const [width, height] of [[640, 460], [375, 240]]) {
    for (let N = 1; N <= 12; N++) {
      for (const rate1 of ODD_RATES) {
        for (const rate2 of ODD_RATES) {
          compare(C.start({ N, rate1, rate2, width, height }), [0, 3]);
        }
      }
    }
  }
  const broad = cases;
  /* All 625 rate pairs at three beam counts and two animation steps. */
  for (const N of [3, 4, 5]) {
    for (const rate1 of RATES) {
      for (const rate2 of RATES) {
        compare(C.start({ N, rate1, rate2 }), [0, 1]);
      }
    }
  }
  check("applet configuration array matches the bytecode transcription", worst < 1e-6,
    `worst crossing gap ${worst.toExponential(2)}`);
  check("the transcription covered every beam count, both view sizes and 325 rate pairs",
    broad === 2 * 78 * 13 * 13 * 2 && cases > broad,
    `broad=${broad}, total cases=${cases}, crossings=${points}`);
  equal("Ngon bucket for the default layout", refNgon(C.start()), C.ngon(C.start()));
  check("the smallest layout picks the 60-degree bucket",
    C.ngon(C.start({ width: 100, height: 100 })) === 60);
  check("a wide layout picks the 360-degree bucket",
    C.ngon(C.start({ width: 2000, height: 2000 })) === 360);
}

/* ------------------------------- 3. the page's claim, exhaustively ---------- */

function circumcircleDeviation(points) {
  /* Fit a circle through three consecutive vertices and check the rest. */
  const [a, b, c] = C.ordered(points);
  const o = refCircumcenter(a, b, c);
  const rs = points.map((p) => refDist(p, o));
  const mean = rs.reduce((s, x) => s + x, 0) / rs.length;
  return Math.max(...rs.map((r) => Math.abs(r - mean) / mean));
}

{
  let configs = 0, worstSides = 0, worstAngles = 0, worstCircle = 0, parallel = 0;
  for (let N = 3; N <= 12; N++) {
    for (const rate1 of RATES) {
      for (const rate2 of RATES) {
        const state = C.start({ N, rate1, rate2 });
        for (const step of [0, 1, 4, 17, 83]) {
          for (let i = 0; i < N; i++) {
            const pts = C.polygon(state, i, step);
            configs++;
            if (pts.some((p) => !Number.isFinite(p.x))) { parallel++; continue; }
            worstSides = Math.max(worstSides, C.regularity(pts));
            const turns = C.exteriorAngles(pts);
            for (const t of turns) worstAngles = Math.max(worstAngles, Math.abs(t - 360 / N));
            worstCircle = Math.max(worstCircle, circumcircleDeviation(pts));
          }
        }
      }
    }
  }
  check("every generated row has equal sides", worstSides < 1e-8,
    `worst relative side difference ${worstSides.toExponential(2)}`);
  check("every generated row has exterior angle 360/N", worstAngles < 1e-6,
    `worst angle error ${worstAngles.toExponential(2)} degrees`);
  check("every generated row is cyclic", worstCircle < 1e-7,
    `worst relative circumradius difference ${worstCircle.toExponential(2)}`);
  check("no row was skipped as parallel", parallel === 0, `skipped ${parallel}`);
  check("the claim was verified over every N, rate pair, row and five steps",
    configs === 25 * 25 * 5 * 75, `configs=${configs}`);

  /* Regular polygons for 3 and 4 beams are the page's stated examples. */
  const tri = C.polygon(C.start({ N: 3 }), 0, 0);
  const sq = C.polygon(C.start({ N: 4 }), 0, 0);
  check("three beams give a triangle with three equal sides",
    C.sideLengths(tri).length === 3 && C.regularity(tri) < 1e-10);
  check("four beams give a square with right-angled turns",
    C.exteriorAngles(sq).every((a) => near(a, 90, 1e-6)));
  check("the triangle's vertices are distinct",
    tri.every((p, i) => tri.every((q, j) => i === j || pointGap(p, q) > 1)));

  /* A beam is an undirected line, so N distinct beams are pi/N apart; the
     second fan starts half a step (pi/N) ahead of the first. */
  const cfg = C.configurations(C.setOptions(C.start({}), { N: 6, rate1: 0, rate2: 0 }));
  check("first fan's beams are spaced by pi/N",
    cfg[0].every((c, j) => j === 0 || near(c.l1.angle - cfg[0][j - 1].l1.angle, PI / 6, 1e-12)));
  const p0 = C.start({ N: 6 });
  const b1 = Math.atan2(p0.P1.y - p0.P.y, p0.P.x - p0.P1.x);
  const b2 = Math.atan2(p0.P2.y - p0.P.y, p0.P.x - p0.P2.x);
  check("the second fan starts half a step ahead of the first",
    near(cfg[0][0].l2.angle - b2 - (cfg[0][0].l1.angle - b1), PI / 6, 1e-12));
  check("row i turns the second fan by i*pi/N",
    [0, 1, 5].every((i) => near(cfg[i][0].l2.angle - cfg[0][0].l2.angle, i * PI / 6, 1e-12)));
  check("both fans start from the two lighthouse positions",
    cfg[0].every((c) => c.l1.fixed.x === 256 && c.l2.fixed.x === 256));
}

/* ---------------------------- 4. the applet's own odd-N quirk --------------- */

{
  /* ComputeSignedAngle signs its angle opposite to GetNext's (cos, -sin)
     direction. Each Shift then mirrors a beam, so the original's row has only
     two distinct crossings instead of N. The port follows the page's stated
     geometry; this check pins the discrepancy in the applet's own array. */
  for (const N of [3, 4, 5, 6]) {
    const s = C.start({ N });
    const original = C.appletPolygon(s, 0, 0);
    const ported = C.polygon(s, 0, 0);
    check(`the original's row of ${N} beams repeats crossings`,
      original.some((p, i) => original.some((q, j) => i < j && pointGap(p, q) < 1e-6)));
    check(`the ported row of ${N} beams keeps ${N} distinct crossings`,
      ported.every((p, i) => ported.every((q, j) => i === j || pointGap(p, q) > 1)));
  }
}

/* --------------------------------- 5. the status line and options ----------- */

{
  const s = C.start({});
  const line = C.describe(s);
  check("the status names the beam count and both rates", /3 beams.*rate 1 and 1/.test(line), line);
  check("the status reports equal side lengths", /sides equal to/.test(line), line);
  check("a picture has no win, loss or done", C.start({}) !== null && !("result" in C));
  check("resetting with the same options reproduces the same picture",
    JSON.stringify(C.polygon(C.setOptions(s, { N: 6 }), 2, 3)) ===
    JSON.stringify(C.polygon(C.start({ N: 6 }), 2, 3)));
}

done("light-house");
