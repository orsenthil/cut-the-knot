#!/usr/bin/env node
"use strict";

/*
 * Logic test for ellipse-focal/ellipse-focal-core.js.
 *
 *   node porting/check-ellipse-focal.mjs
 *
 * The applet's geometry comes from four classes: EllipseFocalCanvas.Compute,
 * CTKEllipse.Foci / MaintainRect / KeepOnEllipse, and GeoSDoub.ComputeSignedAngle.
 * Section 3 re-transcribes those bytecode methods literally and compares them
 * with the core over a grid of rectangles, all four corner drags and many
 * drags of P. Section 2 checks the page's claim (PF + PF' = const) exhaustively
 * over that grid and every sampled point of the curve, and checks the constant
 * really is twice the longer semi-axis, including the circle case.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("ellipse-focal/ellipse-focal-core.js", "EllipseFocalCore");

const near = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol;
const samePoint = (a, b, tol = 1e-8) =>
  (Number.isNaN(a.x) && Number.isNaN(b.x) && Number.isNaN(a.y) && Number.isNaN(b.y)) ||
  (near(a.x, b.x, tol) && near(a.y, b.y, tol));

/* ------------------------------------------------------------------ start */

{
  const s = C.start();
  equal("init makes the applet's four rectangle corners", s.corners, [
    { x: 100, y: 225 }, { x: 300, y: 225 }, { x: 300, y: 75 }, { x: 100, y: 75 },
  ]);
  const g = C.geometry(s);
  check("init centre is (200,150)", g.center.x === 200 && g.center.y === 150);
  check("init half-widths are 100 and 75", g.A === 100 && g.B === 75);
  check("init P is EllipseAt(-3*pi/4)", samePoint(s.p, C.ellipseAt(g, -3 * Math.PI / 4)));
  equal("init foci lie on the horizontal major axis", C.foci(g), [
    { x: 200 - Math.sqrt(100 * 100 - 75 * 75), y: 150 },
    { x: 200 + Math.sqrt(100 * 100 - 75 * 75), y: 150 },
  ]);
  check("init focal sum is 200 = 2A", near(C.analyse(s).sum, 200));
}

/* ------------------------------- the page's claim, over every rectangle */

/* Nine widths by nine heights, in both handednesses: 324 ellipses. */
function rectangles() {
  const out = [];
  for (const halfX of [20, 40, 60, 80, 100, 120, 140, 160, 180]) {
    for (const halfY of [10, 25, 40, 55, 75, 95, 115, 130, 145]) {
      for (const sx of [1, -1]) {
        for (const sy of [1, -1]) {
          out.push([
            { x: 200 - sx * halfX, y: 150 + sy * halfY },
            { x: 200 + sx * halfX, y: 150 + sy * halfY },
            { x: 200 + sx * halfX, y: 150 - sy * halfY },
            { x: 200 - sx * halfX, y: 150 - sy * halfY },
          ]);
        }
      }
    }
  }
  return out;
}
const RECTS = rectangles();
const ANGLES = Array.from({ length: 36 }, (_, i) => (2 * Math.PI * i) / 36 - Math.PI);

{
  let worst = 0, worstAt = null, finiteCount = 0;
  for (const corners of RECTS) {
    const state = { corners, p: null };
    const g = C.geometry(state);
    const constant = 2 * Math.max(Math.abs(g.A), Math.abs(g.B));
    for (const t of ANGLES) {
      const p = C.ellipseAt(g, t);
      const a = C.analyse({ corners, p });
      const err = Math.abs(a.sum - constant);
      finiteCount++;
      if (err > worst) { worst = err; worstAt = { A: g.A, B: g.B, t }; }
    }
  }
  check(`PF + PF' = 2*longer half-axis for all ${finiteCount} ellipse/point pairs`,
    worst < 1e-8, `worst ${worst} at ${JSON.stringify(worstAt)}`);
}

{
  let worst = 0;
  for (const corners of RECTS) {
    const g = C.geometry({ corners });
    const f = C.foci(g);
    const aa = Math.abs(g.A), bb = Math.abs(g.B);
    const c = Math.sqrt(Math.max(aa, bb) ** 2 - Math.min(aa, bb) ** 2);
    const expected = aa > bb
      ? [{ x: g.center.x - c, y: g.center.y }, { x: g.center.x + c, y: g.center.y }]
      : [{ x: g.center.x, y: g.center.y - c }, { x: g.center.x, y: g.center.y + c }];
    worst = Math.max(worst, ...f.map((q, i) => C.dist(q, expected[i])));
  }
  check("foci are c = sqrt(a^2-b^2) from the centre on the major axis, all rectangles",
    worst < 1e-9, `worst ${worst}`);
}

{
  const corners = [
    { x: 150, y: 250 }, { x: 250, y: 250 }, { x: 250, y: 150 }, { x: 150, y: 150 },
  ];
  const g = C.geometry({ corners });
  const f = C.foci(g);
  check("a circle's two foci coincide at its centre", C.dist(f[0], f[1]) === 0 &&
    samePoint(f[0], g.center));
  check("a circle's focal sum is twice its radius", near(C.analyse({
    corners, p: C.ellipseAt(g, 0.7),
  }).sum, 100));
  check("a vertical ellipse puts its foci above and below the centre", (() => {
    const tall = [
      { x: 170, y: 260 }, { x: 230, y: 260 }, { x: 230, y: 40 }, { x: 170, y: 40 },
    ];
    const gg = C.geometry({ corners: tall });
    const ff = C.foci(gg);
    return ff[0].x === 200 && ff[1].x === 200 &&
      near(ff[0].y, 150 - Math.sqrt(110 * 110 - 30 * 30)) &&
      near(ff[1].y, 150 + Math.sqrt(110 * 110 - 30 * 30));
  })());
}

/* The bar that the applet draws: AS = PF, SB = PF', in the right direction. */
{
  let worst = 0, wrongDirection = 0, wrongOrder = 0;
  for (const corners of RECTS) {
    const g = C.geometry({ corners });
    for (const t of ANGLES) {
      const a = C.analyse({ corners, p: C.ellipseAt(g, t) });
      worst = Math.max(worst,
        Math.abs(C.dist(a.bar.start, a.bar.join) - a.d1),
        Math.abs(C.dist(a.bar.join, a.bar.end) - a.d2),
        Math.abs(C.dist(a.bar.start, a.bar.end) - a.sum));
      const horizontal = Math.abs(g.B) < Math.abs(g.A);
      if (a.horizontal !== horizontal) wrongDirection++;
      if (horizontal) {
        if (a.bar.start.y !== C.MARGIN || a.bar.join.y !== C.MARGIN) wrongOrder++;
      } else if (a.bar.start.x !== C.MARGIN || a.bar.join.x !== C.MARGIN) wrongOrder++;
    }
  }
  check("the drawn bar copies both focal distances, AS + SB = PF + PF'", worst < 1e-8);
  check("the bar lies along the top for wide ellipses and the left for tall ones",
    wrongDirection === 0 && wrongOrder === 0, `${wrongDirection}/${wrongOrder}`);
}

/* ------------------------------------------- second bytecode transcription */

/* CTKEllipse.Foci(CTKEllipse), from javap of CTKEllipse.class. */
function javaFoci(v) {
  const A = Math.abs((v[1].x - v[0].x) / 2);
  const B = Math.abs((v[1].y - v[2].y) / 2);
  const big = A > B ? A : B;
  const small = A > B ? B : A;
  const horizontal = A > B;
  const c = Math.sqrt(big * big - small * small);
  if (Number.isNaN(c)) return null;
  const cx = (v[0].x + v[1].x) / 2;
  const cy = (v[1].y + v[2].y) / 2;
  if (horizontal) return [{ x: cx - c, y: cy }, { x: cx + c, y: cy }];
  return [{ x: cx, y: cy - c }, { x: cx, y: cy + c }];
}
function javaCenter(v) {
  return { x: (v[0].x + v[1].x) / 2, y: (v[1].y + v[2].y) / 2 };
}
/* CTKEllipse.EllipseAt(double). */
function javaEllipseAt(v, t) {
  const c = javaCenter(v);
  const A = (v[1].x - v[0].x) / 2;
  const B = (v[1].y - v[2].y) / 2;
  return { x: c.x + A * Math.cos(t), y: c.y + B * Math.sin(t) };
}
/* GeoSDoub.FindOrientation, then ComputeSignedAngle. */
function javaOrientation(a, b, c) {
  const turn = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return turn > 0 ? 1 : -1;
}
function javaSignedAngle(a, b, c) {
  const sq = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const root = (p, q) => Math.sqrt(sq(p, q));
  const cosine = (sq(a, b) + sq(a, c) - sq(b, c)) / 2 / root(a, b) / root(a, c);
  const theta = Math.acos(cosine);
  return javaOrientation(a, b, c) === 1 ? theta : -theta;
}
/* CTKEllipse.KeepOnEllipse(MoveablePoint). */
function javaKeep(v, p) {
  const c = javaCenter(v);
  const A = (v[1].x - v[0].x) / 2;
  const B = (v[1].y - v[2].y) / 2;
  const q = { x: (p.x - c.x) / A, y: (p.y - c.y) / B };
  const inf = { x: c.x + 200, y: c.y };
  return javaEllipseAt(v, javaSignedAngle(c, inf, q));
}
/* CTKEllipse.MaintainRect(MoveablePoint), with the selected corner already moved. */
function javaMaintainRect(v, index, target) {
  const c = javaCenter(v);
  const dx = c.x - target.x;
  const dy = c.y - target.y;
  const w = v.map((p) => ({ x: p.x, y: p.y }));
  w[index] = { x: target.x, y: target.y };
  if (index === 0) {
    w[1] = { x: c.x + dx, y: c.y - dy };
    w[2] = { x: c.x + dx, y: c.y + dy };
    w[3] = { x: c.x - dx, y: c.y + dy };
  } else if (index === 1) {
    w[0] = { x: c.x + dx, y: c.y - dy };
    w[2] = { x: c.x - dx, y: c.y + dy };
    w[3] = { x: c.x + dx, y: c.y + dy };
  } else if (index === 2) {
    w[0] = { x: c.x + dx, y: c.y + dy };
    w[1] = { x: c.x - dx, y: c.y + dy };
    w[3] = { x: c.x - dx, y: c.y - dy };
  } else if (index === 3) {
    w[0] = { x: c.x - dx, y: c.y + dy };
    w[1] = { x: c.x + dx, y: c.y + dy };
    w[2] = { x: c.x + dx, y: c.y - dy };
  }
  return w;
}
/* EllipseFocalCanvas.Compute(). */
function javaCompute(v, p) {
  const F = javaFoci(v);
  const d = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  const a = d(F[0], p), b = d(F[1], p);
  const horizontal = Math.abs(v[0].y - v[3].y) < Math.abs(v[1].x - v[0].x);
  const base = horizontal
    ? { x: (C.WIDTH - a - b) / 2, y: C.MARGIN }
    : { x: C.MARGIN, y: (C.HEIGHT - a - b) / 2 };
  const join = horizontal ? { x: base.x + a, y: base.y } : { x: base.x, y: base.y + a };
  const end = horizontal ? { x: join.x + b, y: join.y } : { x: join.x, y: join.y + b };
  return { a, b, horizontal, start: base, join, end };
}

/* Foci and the ellipse itself, over all 324 rectangles. */
{
  let worstF = 0, worstE = 0;
  for (const corners of RECTS) {
    const f = javaFoci(corners);
    const g = C.geometry({ corners });
    const cf = C.foci(g);
    worstF = Math.max(worstF, ...f.map((q, i) => C.dist(q, cf[i])));
    for (const t of ANGLES) {
      const a = javaEllipseAt(corners, t), b = C.ellipseAt(g, t);
      worstE = Math.max(worstE, C.dist(a, b));
    }
  }
  check("core Foci match a literal CTKEllipse.Foci transcription", worstF < 1e-9);
  check("core EllipseAt matches a literal CTKEllipse.EllipseAt transcription", worstE < 1e-9);
}

/* Compute(): the two lengths and the broken bar, point by point. */
{
  let worst = 0, badFlags = 0;
  for (const corners of RECTS) {
    const g = C.geometry({ corners });
    for (const t of ANGLES) {
      const p = C.ellipseAt(g, t);
      const j = javaCompute(corners, p);
      const core = C.analyse({ corners, p });
      worst = Math.max(worst, Math.abs(j.a - core.d1), Math.abs(j.b - core.d2),
        C.dist(j.start, core.bar.start), C.dist(j.join, core.bar.join),
        C.dist(j.end, core.bar.end));
      if (j.horizontal !== core.horizontal) badFlags++;
    }
  }
  check("core Compute matches the applet's lengths and bar over all cases",
    worst < 1e-8 && badFlags === 0, `worst ${worst}, flags ${badFlags}`);
}

/* KeepOnEllipse: the applet's signed-angle snap, including its odd reference. */
{
  let worst = 0, nanMatches = 0, badNaN = 0, count = 0;
  for (const corners of RECTS) {
    const g = C.geometry({ corners });
    for (const t of ANGLES) {
      const raw = { x: g.center.x + g.A * Math.cos(t) * 1.4, y: g.center.y + g.B * Math.sin(t) * 1.4 };
      const j = javaKeep(corners, raw);
      const core = C.keepOnEllipse(g, raw);
      const jBad = !Number.isFinite(j.x) || !Number.isFinite(j.y);
      const cBad = !Number.isFinite(core.x) || !Number.isFinite(core.y);
      if (jBad || cBad) {
        if (jBad && cBad) nanMatches++; else badNaN++;
      } else {
        worst = Math.max(worst, C.dist(j, core));
      }
      count++;
    }
  }
  check(`core KeepOnEllipse matches the bytecode snap for all ${count} drags`,
    worst < 1e-8, `worst ${worst}`);
  check("both transcriptions agree on every undefined snap", badNaN === 0,
    `${nanMatches} undefined, ${badNaN} mismatches`);
}

/* The four corner drags, each against MaintainRect + KeepAllOnEllipse. */
{
  const rnd = rng(7);
  let worstCorners = 0, worstP = 0, count = 0, refused = 0;
  for (let k = 0; k < 140; k++) {
    const corners = RECTS[k % RECTS.length];
    const index = k % 4;
    const raw = { x: 20 + rnd() * 360, y: 20 + rnd() * 260 };
    const state = { corners, p: C.ellipseAt(C.geometry({ corners }), 0.4) };
    const target = { x: Math.round(raw.x), y: Math.round(raw.y) };
    const good = C.pointIsGood(target);
    const next = C.moveCorner(state, index, target);
    if (!good) {
      refused++;
      if (next !== state) { worstCorners = Infinity; worstP = Infinity; }
      continue;
    }
    const w = javaMaintainRect(corners, index, target);
    const jp = javaKeep(w, state.p);
    worstCorners = Math.max(worstCorners, ...w.map((p, i) => C.dist(p, next.corners[i])));
    worstP = Math.max(worstP, C.dist(jp, next.p));
    count++;
  }
  check(`${count} corner drags match MaintainRect on all four corners`,
    worstCorners < 1e-8, `worst ${worstCorners}`);
  check(`${count} corner drags also keep P on the new ellipse`,
    worstP < 1e-8, `worst ${worstP}`);
  check(`${refused} corner drags into the middle square were refused like PointIsGood`,
    refused > 0 && worstCorners < 1e-8);
}

/* Dragging P itself, same snapping as the applet. */
{
  const rnd = rng(11);
  let worst = 0, count = 0;
  for (let k = 0; k < 220; k++) {
    const corners = RECTS[k % RECTS.length];
    const g = C.geometry({ corners });
    const raw = { x: 10 + rnd() * 380, y: 10 + rnd() * 280 };
    const next = C.movePoint({ corners, p: C.ellipseAt(g, 0) }, raw);
    const j = javaKeep(corners, raw);
    if (Number.isFinite(j.x) && Number.isFinite(j.y)) {
      worst = Math.max(worst, C.dist(j, next.p));
      count++;
    }
  }
  check(`${count} drags of P match a literal KeepOnEllipse transcription`,
    worst < 1e-8, `worst ${worst}`);
}

/* A snapped P is still on the curve; the invariant survives every drag. */
{
  const rnd = rng(13);
  let worstCurve = 0, worstSum = 0, count = 0;
  for (let k = 0; k < 120; k++) {
    const corners = RECTS[k % RECTS.length];
    const g = C.geometry({ corners });
    let s = { corners, p: C.ellipseAt(g, rnd() * 7) };
    s = C.movePoint(s, { x: 15 + rnd() * 370, y: 15 + rnd() * 270 });
    s = C.moveCorner(s, k % 4, { x: 15 + rnd() * 370, y: 15 + rnd() * 270 });
    const gg = C.geometry(s);
    const px = (s.p.x - gg.center.x) / gg.A;
    const py = (s.p.y - gg.center.y) / gg.B;
    worstCurve = Math.max(worstCurve, Math.abs(px * px + py * py - 1));
    const a = C.analyse(s);
    worstSum = Math.max(worstSum, Math.abs(a.sum - a.constant));
    count++;
  }
  check(`P remains on the ellipse after ${count} mixed drags`, worstCurve < 1e-7);
  check(`the sum stays equal to 2*major half-axis after ${count} mixed drags`,
    worstSum < 1e-7, `worst ${worstSum}`);
}

/* Edge cases the page's claim does not mention but the port must survive. */
{
  const s = C.start();
  check("a non-finite corner drag is refused", C.moveCorner(s, 1, { x: NaN, y: 20 }) === s);
  check("a non-finite P drag is refused", C.movePoint(s, { x: Infinity, y: 20 }) === s);
  check("an out-of-range corner index is refused", C.moveCorner(s, 4, { x: 30, y: 30 }) === s);
  check("reset returns the exact initial position", (() => {
    const t = C.moveCorner(s, 2, { x: 120, y: 60 });
    const r = C.start();
    return r !== t && samePoint(r.p, s.p) &&
      r.corners.every((p, i) => samePoint(p, s.corners[i]));
  })());
  check("the status line reports the three numbers", /PF = 53\.23/.test(C.describe(s)) &&
    /PF \+ PF' = 200\.00/.test(C.describe(s)));
}

done("ellipse-focal");
