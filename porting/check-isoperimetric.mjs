#!/usr/bin/env node
"use strict";

/*
 * Logic test for isoperimetric/isoperimetric-core.js.
 *
 *   node porting/check-isoperimetric.mjs
 *
 * The exact claim on the applet's page (and on its Explanation page,
 * ctk/GeometrySampling.shtml#isoperimetric) is that a semicircle and a family
 * of abutting semicircles on its diameter are isoperimetric: their arc
 * lengths are equal. The page adds that the applet offers two other families
 * of isometric curves, with "an independent proof in case of two sets of
 * parallel lines" left to the reader.
 *
 * This test checks all three families for every break-point count 1..15,
 * with deterministic random break points, apexes and spline control points.
 * It transcribes the applet's own methods a second time, straight from the
 * bytecode: PointMover.Reset's order[j]=j+2 table, CircularPointMover's arc
 * parameters, LinearPointMover.Parallel's GetParallelTo + GeoSDoub.Intersect,
 * and CubicSpline.Resolve/Compute/Value with VPoint's inverse scales. A dense
 * Gaussian solve is used there, against the core's Thomas solve.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("isoperimetric/isoperimetric-core.js", "IsoperimetricCore");
const near = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const sizes = [[600, 400], [500, 300], [800, 600], [375, 250]];
const rand = rng(20261127);

function stateFor(mode, n, size = [600, 400]) {
  return C.start({ width: size[0], height: size[1], mode, n });
}

function scatter(s, factor = 0.5) {
  const { A, B } = C.endpoints(s);
  const xs = C.cuts(s);
  const points = [];
  for (let i = 1; i < xs.length - 1; i++) {
    const gap = xs[i + 1] - xs[i - 1];
    points.push({
      x: xs[i] + (rand() - 0.5) * gap * factor,
      y: A.y,
    });
  }
  const apex = { x: A.x + (B.x - A.x) * (0.15 + 0.7 * rand()), y: A.y - (20 + 160 * rand()) };
  const spline = s.spline.map((p) => ({ x: p.x, y: p.y + (rand() - 0.5) * 120 }));
  return { ...s, points, apex, spline };
}

/* ----------------------------- 1. a second transcription of Reset's table */

function appletPoints(n, width, height) {
  const margin = 30;
  const a = { x: margin, y: Math.floor((height * 3) / 4) };
  const b = { x: width - margin, y: a.y };
  const order = [];
  let sum = 0;
  for (let j = 0; j <= n; j++) {
    order[j] = j + 2;
    sum += order[j];
  }
  const points = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    x += order[n - i];
    points.push({ x: a.x + ((b.x - a.x) * x) / sum, y: a.y });
  }
  return { a, b, points };
}

{
  let worst = 0;
  for (const [w, h] of sizes) {
    for (let n = C.N_MIN; n <= C.N_MAX; n++) {
      const expected = appletPoints(n, w, h);
      const s = stateFor("arcs", n, [w, h]);
      const ends = C.endpoints(s);
      if (!near(ends.A.x, expected.a.x) || !near(ends.A.y, expected.a.y) ||
          !near(ends.B.x, expected.b.x) || !near(ends.B.y, expected.b.y)) {
        check(`endpoints w=${w} h=${h}`, false);
      }
      for (let i = 0; i < n; i++) {
        worst = Math.max(worst, Math.abs(s.points[i].x - expected.points[i].x));
      }
    }
  }
  check("PointMover.Reset endpoints and break points match the bytecode", worst < 1e-9, `worst ${worst}`);
  check("the applet's break points stay strictly between A and B", sizes.every(([w, h]) =>
    Array.from({ length: C.N_MAX }, (_, k) => k + 1).every((n) => {
      const s = stateFor("arcs", n, [w, h]);
      const { A, B } = C.endpoints(s);
      return s.points.every((p, i) =>
        p.x > (i ? s.points[i - 1].x : A.x) && p.x < (i + 1 < n ? s.points[i + 1].x : B.x));
    })));
}

/* --------------------- 2. the semicircle formula and the page's exact claim */

{
  let worstSum = 0;
  let worstPi = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (let k = 0; k < 40; k++) {
      const s = scatter(stateFor("arcs", n));
      const g = C.arcs(s);
      const diameters = C.cuts(s).slice(1).map((x, i) => x - C.cuts(s)[i]);
      worstSum = Math.max(worstSum, Math.abs(diameters.reduce((a, b) => a + b, 0) - C.endpoints(s).L));
      worstPi = Math.max(worstPi, Math.abs(g.blueLength / C.endpoints(s).L - Math.PI / 2));
      if (!near(g.redLength, g.blueLength, 1e-12)) {
        check(`arc lengths equal for n=${n} sample=${k}`, false, `${g.redLength} vs ${g.blueLength}`);
      }
    }
  }
  check("abutting diameters add to the big diameter, for every n", worstSum < 1e-9, `worst ${worstSum}`);
  check("blue arc length / diameter is pi/2 (P = pi D), for every n", worstPi < 1e-12, `worst ${worstPi}`);
  check("red semicircle and blue semicircles are isoperimetric, 600 cases", true);
}

/* ---------------- 3. a second transcription of CircularPointMover.DrawArc */

function appletArcs(n, width, height, alternate, points) {
  const { a, b } = appletPoints(n, width, height);
  const xs = [a.x, ...points.map((p) => p.x), b.x];
  const round = Math.round;
  const big = { x: round(a.x), y: round(a.y - (b.x - a.x) / 2), w: round(b.x - a.x), start: 0 };
  const small = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const r = (xs[i + 1] - xs[i]) / 2;
    small.push({
      x: round(xs[i]), y: round(a.y - r), w: round(xs[i + 1] - xs[i]),
      start: alternate && i % 2 === 1 ? 180 : 0,
    });
  }
  return { big, small };
}

{
  let worst = 0;
  let mismatch = 0;
  for (const [w, h] of sizes) {
    for (let n = C.N_MIN; n <= C.N_MAX; n++) {
      for (const alt of [false, true]) {
        const s = scatter(stateFor("arcs", n, [w, h]));
        const expected = appletArcs(n, w, h, alt, s.points);
        const g = C.arcs({ ...s, alternate: alt });
        const r = Math.round;
        const big = g.red[0];
        if (r(big.p.x) !== expected.big.x || r(big.p.y - big.r) !== expected.big.y ||
            r(2 * big.r) !== expected.big.w || big.below) mismatch++;
        for (let i = 0; i < g.blue.length; i++) {
          const p = g.blue[i];
          worst = Math.max(worst, Math.abs(r(p.p.x) - expected.small[i].x),
            Math.abs(r(p.p.y - p.r) - expected.small[i].y), Math.abs(r(2 * p.r) - expected.small[i].w));
          if ((p.below ? 180 : 0) !== expected.small[i].start) mismatch++;
        }
      }
    }
  }
  check("CircularPointMover.drawArc parameters match the bytecode", mismatch === 0 && worst === 0);
  check("X-alternate lifts exactly the odd blue semicircles", [3, 4, 15].every((n) => {
    const g = C.arcs({ ...stateFor("arcs", n), alternate: true });
    return g.blue.every((p, i) => p.below === (i % 2 === 1));
  }));
}

/* --------------- 4. a second transcription of the parallel-line construction */

/** GeoSDoub.GetParallelTo(p,a,m): p + 100*(a-m). */
const getParallelTo = (p, a, m) => ({ x: p.x + 100 * (a.x - m.x), y: p.y + 100 * (a.y - m.y) });

/** GeoSDoub.Intersect(p,q,r,s), with its determinant guard, from the bytecode. */
function appletIntersect(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const d = b1 * a2 - b2 * a1;
  if (Math.abs(d) < 1) return { x: NaN, y: NaN };
  return { x: (c1 * b2 - c2 * b1) / d, y: (a1 * c2 - a2 * c1) / d };
}

function appletApexes(n, points, apex, alternate) {
  const { a, b } = appletPoints(n, 600, 400);
  const M = apex;
  const xs = [a.x, ...points.map((p) => p.x), b.x];
  const line1 = [], line0 = [];
  for (let i = 0; i < n; i++) {
    const p = { x: xs[i + 1], y: a.y };
    const q1 = getParallelTo(p, a, M);
    const q0 = getParallelTo(p, b, M);
    line1.push({ p, q: appletIntersect(p, q1, M, b) });
    line0.push({ p, q: appletIntersect(p, q0, M, a) });
  }
  const apexes = [appletIntersect(a, M, line0[0].p, line0[0].q)];
  let flag = false;
  for (let i = 0; i < n - 1; i++) {
    flag = !flag;
    const j1 = flag && alternate ? i + 1 : i;
    const j2 = flag && alternate ? i : i + 1;
    apexes.push(appletIntersect(line1[j1].p, line1[j1].q, line0[j2].p, line0[j2].q));
  }
  flag = !flag;
  if (flag && alternate) {
    const q = getParallelTo(b, line1[n - 1].p, line1[n - 1].q);
    apexes.push(appletIntersect(b, q, line0[n - 1].p, line0[n - 1].q));
  } else {
    apexes.push(appletIntersect(b, M, line1[n - 1].p, line1[n - 1].q));
  }
  return apexes;
}

{
  let worst = 0;
  let count = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (const alt of [false, true]) {
      for (let k = 0; k < 30; k++) {
        const s = scatter(stateFor("lines", n));
        const expected = appletApexes(n, s.points, s.apex, alt);
        const got = C.lines({ ...s, alternate: alt }).apexes;
        if (expected.length !== got.length) check(`apex count n=${n}`, false);
        for (let i = 0; i < got.length; i++) {
          worst = Math.max(worst, Math.abs(got[i].x - expected[i].x), Math.abs(got[i].y - expected[i].y));
          if (!Number.isFinite(expected[i].x)) check("non-finite applet apex", false);
          count++;
        }
      }
    }
  }
  check("every line apex matches GetParallelTo + Intersect", worst < 1e-6, `worst ${worst} over ${count}`);
  check("the first apex sits where the Java trace drew it, near (54, 246)", (() => {
    const x = C.lines(stateFor("lines", 3)).apexes[0];
    return Math.abs(x.x - 54) < 0.5 && Math.abs(x.y - 246.67) < 0.5;
  })());
  check("the default break points are x = 222.86, 377.14, 492.86", C.start({ n: 3 }).points.every((p, i) =>
    near(p.x, [222.85714285714286, 377.14285714285717, 492.85714285714283][i], 1e-9)));
  check("the default apex is at x=97.5, y=150", (() => {
    const M = C.start({ mode: "lines", n: 3 }).apex;
    return near(M.x, 97.5) && near(M.y, 150);
  })());
}

/* ------------------------ 5. the page's claim for the broken-line family */

{
  let worst = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (const alt of [false, true]) {
      for (let k = 0; k < 30; k++) {
        const s = scatter(stateFor("lines", n));
        const g = C.lines({ ...s, alternate: alt });
        worst = Math.max(worst, Math.abs(g.redLength - g.blueLength));
      }
    }
  }
  check("the blue broken line is as long as the red one, 900 configurations", worst < 1e-8, `worst ${worst}`);
  check("X-alternate mirrors pieces without changing their lengths", (() => {
    const s = stateFor("lines", 6);
    return near(C.lines(s).blueLength, C.lines({ ...s, alternate: true }).blueLength);
  })());
}

/* ------------- 6. a second transcription of the spline control points */

function appletSpline(w, h) {
  const margin = 30;
  const a = { x: margin, y: Math.floor((h * 3) / 4) };
  const b = { x: w - margin, y: a.y };
  const xScale = { a: (b.x - a.x) / 20, b: (a.x + b.x) / 2 };
  const yScale = { a: (h / 2) / 4000, b: a.y };
  const doScale = (s, v) => s.a * v + s.b;
  const pts = [];
  for (let k = 0; k < 21; k++) {
    const u = k - 10;
    const v = (u * u - 100) * (u * u + 40);
    pts.push({ x: Math.round(doScale(xScale, u)), y: Math.round(doScale(yScale, v)) });
  }
  return { a, b, pts, xScale, yScale };
}

{
  let worst = 0;
  for (const [w, h] of sizes) {
    const expected = appletSpline(w, h);
    const got = C.initialSpline({ width: w, height: h });
    for (let i = 0; i < 21; i++) {
      worst = Math.max(worst, Math.abs(got[i].x - expected.pts[i].x), Math.abs(got[i].y - expected.pts[i].y));
    }
  }
  check("SplinePointMover.Reset's 21 control points match the bytecode", worst === 0, `worst ${worst}`);
  check("the spline dips symmetrically to y=56 at u=±5 and y=100 at u=0", (() => {
    const p = C.initialSpline({ width: 600, height: 400 });
    return p[10].y === 100 && p[5].y === 56 && p[15].y === 56 && p[0].y === 300 && p[20].y === 300;
  })());
}

/* --- 7. a second transcription of CubicSpline.Resolve / Compute / Value --- */

function denseSolve(rows, rhs) {
  const n = rhs.length;
  const a = rows.map((r, i) => [...r, rhs[i]]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(a[k][i]) > Math.abs(a[pivot][i])) pivot = k;
    const tmp = a[i]; a[i] = a[pivot]; a[pivot] = tmp;
    for (let k = i + 1; k < n; k++) {
      const f = a[k][i] / a[i][i];
      for (let j = i; j <= n; j++) a[k][j] -= f * a[i][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = a[i][n];
    for (let j = i + 1; j < n; j++) s -= a[i][j] * x[j];
    x[i] = s / a[i][i];
  }
  return x;
}

function appletSplineValue(pts, w, h, x) {
  const margin = 30;
  const a = { x: margin, y: Math.floor((h * 3) / 4) };
  const b = { x: w - margin, y: a.y };
  const xi = { a: 1 / ((b.x - a.x) / 20), b: -(a.x + b.x) / 2 / ((b.x - a.x) / 20) };
  const yi = { a: 1 / ((h / 2) / 4000), b: -a.y / ((h / 2) / 4000) };
  const sx = (p) => xi.a * p.x + xi.b;
  const sy = (p) => yi.a * p.y + yi.b;
  const n = pts.length;
  const hh = [], alpha = [];
  for (let i = 0; i < n - 1; i++) {
    hh[i] = sx(pts[i + 1]) - sx(pts[i]);
    alpha[i] = (sy(pts[i + 1]) - sy(pts[i])) / hh[i];
  }
  const size = n - 2; // CubicSpline sets N = n-1, then solves N-1 equations
  const rows = Array.from({ length: size }, () => new Array(size).fill(0));
  const rhs = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    rows[i][i] = (hh[i] + hh[i + 1]) / 3;
    if (i > 0) rows[i][i - 1] = hh[i] / 6;
    if (i < size - 1) rows[i][i + 1] = hh[i + 1] / 6;
    rhs[i] = alpha[i + 1] - alpha[i];
  }
  const m = denseSolve(rows, rhs);
  const u = xi.a * x + xi.b;
  let interval = 0;
  for (let i = 0; i < n - 1; i++) if (pts[i].x <= x) interval = i;
  const i = interval;
  const dx = hh[i];
  const t1 = (sx(pts[i + 1]) - u) / dx;
  const t2 = (u - sx(pts[i])) / dx;
  const ml = i === 0 ? 0 : m[i - 1];
  const mr = i > n - 3 ? 0 : m[i];
  const internal = t1 * sy(pts[i]) + t2 * sy(pts[i + 1]) +
    ((t1 ** 3 - t1) * ml + (t2 ** 3 - t2) * mr) * (dx * dx) / 6;
  return (internal - yi.b) / yi.a;
}

{
  let worst = 0;
  for (const [w, h] of sizes) {
    const base = { width: w, height: h, mode: "spline", n: 3, alternate: false, reflect: false,
      points: C.initialPoints(3, { width: w, height: h }), apex: C.initialApex(3, { width: w, height: h }),
      spline: C.initialSpline({ width: w, height: h }) };
    for (let k = 0; k < 12; k++) {
      const s = k === 0 ? base : {
        ...base,
        spline: base.spline.map((p, i) => ({
          x: p.x,
          y: p.y + (i === 0 || i === 20 ? 0 : (rand() - 0.5) * 90),
        })),
      };
      for (let x = 30; x <= w - 30; x += 7) {
        worst = Math.max(worst, Math.abs(C.splineValue(s, x) - appletSplineValue(s.spline, w, h, x)));
      }
      worst = Math.max(worst, Math.abs(C.splineValue(s, w - 30) - appletSplineValue(s.spline, w, h, w - 30)));
    }
  }
  check("CubicSpline.Value matches Resolve/Compute for default and moved points", worst < 1e-6, `worst ${worst}`);
  check("the spline goes through its control points", (() => {
    const s = stateFor("spline", 3);
    return s.spline.every((p) => near(C.splineValue(s, p.x), p.y, 1e-8));
  })());
}

/* ------------------- 8. the freehand copies and the isoperimetric claim */

{
  let worst = 0;
  let worstMap = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (const alt of [false, true]) {
      for (const refl of [false, true]) {
        const s = { ...scatter(stateFor("spline", n)), alternate: alt, reflect: refl };
        const g = C.spline(s);
        worst = Math.max(worst, Math.abs(g.redLength - g.blueLength));
        const { A } = C.endpoints(s);
        const xs = C.cuts(s);
        for (let i = 0; i < g.blue.length; i++) {
          const first = g.blue[i][0], last = g.blue[i][g.blue[i].length - 1];
          const wantFirst = refl ? xs[i + 1] : xs[i];
          const wantLast = refl ? xs[i] : xs[i + 1];
          const sign = alt && i % 2 === 1 ? -1 : 1;
          const scale = C.endpoints(s).L / (xs[i + 1] - xs[i]);
          worstMap = Math.max(worstMap,
            Math.abs(first.x - wantFirst), Math.abs(last.x - wantLast),
            Math.abs(first.y - (A.y + sign * (C.splineValue(s, A.x) - A.y) / scale)));
        }
      }
    }
  }
  check("scaled freehand replicas have the red curve's length, 240 cases", worst < 1e-7, `worst ${worst}`);
  check("every replica sits inside its gap, reversed by Y-alternate", worstMap < 1e-8, `worst ${worstMap}`);
  check("alternate and reflect preserve the total length", (() => {
    const s = stateFor("spline", 5);
    const base = C.spline(s).blueLength;
    return [C.spline({ ...s, alternate: true }).blueLength,
      C.spline({ ...s, reflect: true }).blueLength,
      C.spline({ ...s, alternate: true, reflect: true }).blueLength].every((v) => near(v, base));
  })());
}

/* ------------------------------- 9. options, dragging and a safe position */

{
  check("break-point count is clamped to the applet's 1..15 range",
    C.start({ n: 0 }).n === 1 && C.start({ n: 99 }).n === 15 && C.start({ n: 7 }).n === 7);
  check("switching family or count resets like IsoperimetricCanvas.Reset", (() => {
    const s = { ...stateFor("arcs", 3), points: C.initialPoints(3, { width: 600, height: 400 }).map((p) => ({ x: 250, y: 300 })) };
    const a = C.reset(s, { mode: "lines" });
    const b = C.reset(s, { n: 5 });
    return a.mode === "lines" && a.points.every((p, i) => near(p.x, C.initialPoints(3, { width: 600, height: 400 })[i].x)) &&
      b.n === 5 && b.points.every((p, i) => near(p.x, C.initialPoints(5, { width: 600, height: 400 })[i].x));
  })());
  check("Y-alternate is off outside the freehand family", (() => {
    const s = { ...stateFor("arcs", 3), reflect: true };
    return !C.setFlag(s, "reflect", true).reflect && C.setFlag({ ...s, mode: "spline" }, "reflect", true).reflect;
  })());
  check("dragging a break point keeps the dots in order on AB", (() => {
    let s = stateFor("arcs", 5);
    for (let i = 0; i < 5; i++) {
      s = C.move(s, "point", i, { x: i % 2 ? -1000 : 1000, y: 17 });
      if (s.points[i].y !== 300) return false;
    }
    return s.points.every((p, i) => i === 0 || p.x > s.points[i - 1].x);
  })());
  check("spline handles move vertically only, like VPoint.UpdateLocation", (() => {
    const s = stateFor("spline", 3);
    const moved = C.move(s, "spline", 7, { x: 12, y: 40 });
    return moved.spline[7].x === s.spline[7].x && moved.spline[7].y === 40 &&
      moved.spline.every((p, i) => i === 7 || p.y === s.spline[i].y);
  })());
  check("the tutor's saved position is plain JSON data", (() => {
    const s = { ...stateFor("spline", 4), alternate: true };
    const p = C.position(s);
    return JSON.parse(JSON.stringify(p)).points.length === 4 && p.mode === "spline" && p.alternate === true &&
      p.spline.length === 21 && p.apex.x === 84;
  })());
  check("a demo has no win, loss or ending move", [C.start({}), stateFor("lines", 4), stateFor("spline", 6)]
    .every((s) => C.result(s) === null));
  check("lengths() agrees with the family it reports", (() => {
    return ["arcs", "lines", "spline"].every((mode) => {
      const s = stateFor(mode, 4);
      const l = C.lengths(s);
      const g = mode === "arcs" ? C.arcs(s) : mode === "lines" ? C.lines(s) : C.spline(s);
      return near(l.red, g.redLength) && near(l.blue, g.blueLength);
    });
  })());
}

done("isoperimetric");
