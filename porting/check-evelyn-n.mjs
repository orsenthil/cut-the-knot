#!/usr/bin/env node
"use strict";

/*
 * Logic test for evelyn-n/evelyn-n-core.js.
 *
 *   node porting/check-evelyn-n.mjs
 *
 * The cut-the-knot page says: for odd n a chain of circles touching its
 * neighbours and two successive sides has at most 2n circles; for even n the
 * distance between the 1st and the 2n-th circle does not depend on the first
 * radius; some polygons (inscriptible n=4 among them) close after n circles;
 * regular polygons give chains of length N, N+1 or 2N.
 *
 * Section 2 writes Reset(), CreateBisector(), ComputeCircles() and
 * GetTouchingCircle() a second time, straight from the applet's bytecode and
 * its GeoSDoub / QuadraticEquation helpers, then compares them with the core
 * on every N (3..21) and 19 starting-point positions, plus irregular convex
 * polygons and dragged corners.  Section 3 checks the page's claims against
 * that transcription.  The page's even-n distance claim and its N+1 case are
 * not reproduced by the applet's own arithmetic; the test says so plainly
 * instead of changing the core to make the prose true.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("evelyn-n/evelyn-n-core.js", "EvelynNCore");
const R = C.RADIUS;
const TOL = 1e-7 * R;
const P = (x, y) => ({ x: x, y: y });
const close = (a, b, t = TOL) => Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= t;
const closeP = (a, b, t = TOL) => !!a && !!b && close(a.x, b.x, t) && close(a.y, b.y, t);
const TS = [];
for (let k = 1; k <= 19; k++) TS.push(k / 20); // t = 0.05 ... 0.95

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("the applet starts at N = 3", s.n, 3);
  equal("the applet starts with pair #6", s.which, 6);
  equal("the pair spinner also starts at 6", s.whichSpinner, 6);
  check("m_Ta starts at 0.7", close(s.ta, 0.7, 1e-12));
  equal("three corners", s.vertices.length, 3);
  check("corners lie on the circumcircle", s.vertices.every((v) =>
    close(Math.hypot(v.x - C.CENTER.x, v.y - C.CENTER.y), R)));
  check("a demonstration has no win, loss or finish", C.result(s) === null);
  check("the start picture is not yet explored", !s.explored);
  equal("the regular triangle draws six circles", C.geometry(s).chainLength, 6);
  check("N is clamped to the spinner's 3..21 range",
    C.setN(s, -4).n === 3 && C.setN(s, 50).n === 21);
  check("the pair spinner is clamped to 0..2N",
    C.setWhich(s, -9).which === 0 && C.setWhich(s, 99).which === 6);
  const wide = C.setN(C.start({ n: 21 }), 4);
  check("changing N lowers an out-of-range pair value to 2N",
    wide.n === 4 && wide.which === 8 && wide.whichSpinner === 8);
  const reset = C.reset(C.setWhich(s, 2));
  check("Reset restores the regular polygon and colours all circles",
    reset.which === 6 && reset.whichSpinner === 2 && close(reset.ta, 0.7, 1e-12));
  check("there is no DOM in the core", typeof globalThis.document === "undefined");
}

/* --------------------------- 2. a second transcription of the applet code */

/* GeoSDoub.SqDist / Dist, as used by the canvas. */
const sq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const dst = (a, b) => Math.sqrt(sq(a, b));

/* GeoSDoub.NearestPoint(P,A,B), with its 0.1 shortcut. */
function appletNearest(p, a, b) {
  if (sq(a, p) < 0.1) return P(p.x, p.y);
  const vx = b.x - a.x, vy = b.y - a.y;
  const t = (vx * (p.x - a.x) + vy * (p.y - a.y)) / (vx * vx + vy * vy);
  return P(a.x + vx * t, a.y + vy * t);
}

/* GeoSDoub.Dist(P,DoubLine(A,B)). */
function appletDistLine(p, a, b) {
  if (sq(a, p) < 0.1) return 0;
  const vx = b.x - a.x, vy = b.y - a.y;
  const t = (vx * (p.x - a.x) + vy * (p.y - a.y)) / (vx * vx + vy * vy);
  return Math.hypot(a.x - p.x + vx * t, a.y - p.y + vy * t);
}

/* GeoSDoub.FindOrientation, ComputeAngle, Rotate, Intersect. */
const appletOrient = (a, b, c) =>
  c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y > 0 ? 1 : -1;
function appletAngle(a, b, c) {
  const k = (sq(a, b) + sq(a, c) - sq(b, c)) / (2 * dst(a, b) * dst(a, c));
  return Math.acos(k);
}
function appletRotate(p, q, theta, dir) {
  const co = Math.cos(theta), si = Math.sin(theta);
  return P(p.x + co * (q.x - p.x) - dir * si * (q.y - p.y),
           p.y + dir * si * (q.x - p.x) + co * (q.y - p.y));
}
function appletIntersect(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const det = b1 * a2 - b2 * a1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det);
}
function appletBisector(a, b, c) {
  /* GeoSDoub.FindAngleBisector(A,B,C): half the angle at A, rotated from AB
   * in the triangle's orientation, intersected with line BC. */
  const arm = appletRotate(a, b, appletAngle(a, b, c) / 2, appletOrient(a, b, c));
  return appletIntersect(a, arm, b, c);
}

/* QuadraticEquation.Solve2(A,B,C) solves A*t*t + 2*B*t + C = 0. */
function appletSolve2(a, b, c) {
  if (Math.abs(a) < 0.01) return null;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  return [(-b + root) / a, (-b - root) / a];
}

/* EvelynNCanvas.GetTouchingCircle(q, circle, a, foot), with a trace of the
 * applet's odd root choice. */
function appletTouching(q, circle, a, foot, trace) {
  const d = dst(foot, appletNearest(foot, a, q));
  const u = sq(foot, a) - d * d;
  const v = (foot.x - a.x) * (a.x - circle.x) +
            (foot.y - a.y) * (a.y - circle.y) - circle.r * d;
  const w = sq(a, circle) - circle.r * circle.r;
  const roots = appletSolve2(u, v, w);
  if (!roots || Number.isNaN(roots[0]) || Number.isNaN(roots[1])) return null;
  let t = -1;
  if (roots[0] >= 0 && roots[0] <= 1) t = roots[0];
  if (t < 0) {
    t = roots[1]; // even when the second root lies outside [0,1]
    if (trace) trace.fallback++;
  }
  return { x: a.x + t * (foot.x - a.x), y: a.y + t * (foot.y - a.y), r: d * t };
}

/* EvelynNCanvas.Reset() + ComputeCircles(), with an optional extension past
 * 2N so the page's closure and length claims can be measured. */
function appletCompute(n, V, ta, which, extra = 0, trace) {
  const L = V.map((v, i) => appletBisector(v, V[(i + n - 1) % n], V[(i + 1) % n]));
  const p = P(V[0].x * ta + L[0].x * (1 - ta), V[0].y * ta + L[0].y * (1 - ta));
  const first = { x: p.x, y: p.y, r: appletDistLine(p, V[0], V[1 % n]) };
  const circles = [first];
  let cur = first;
  for (let i = 1; i < 2 * n + extra; i++) {
    const j = i % n;
    const next = appletTouching(V[(j + 1) % n], cur, V[j], L[j], trace);
    if (!next) break;
    circles.push(next);
    cur = next;
  }
  const total = 2 * n;
  const red = circles.map((_, i) => which === total || i === which ||
    (i + total - 1) % total === which);
  return { V: V, L: L, p: p, first: first, circles: circles, red: red };
}
const regular = (n) => Array.from({ length: n }, (_, i) => {
  const a = 2 * Math.PI * i / n;
  return P(C.CENTER.x + R * Math.cos(a), C.CENTER.y + R * Math.sin(a));
});
const convex = (V) => {
  let sign = 0;
  for (let i = 0; i < V.length; i++) {
    const a = V[i], b = V[(i + 1) % V.length], c = V[(i + 2) % V.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    if (sign && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return true;
};

{
  let bad = 0, cases = 0;
  const trace = { fallback: 0 };
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (const t of TS) {
      const state = Object.assign({}, C.start({ n: n }), { ta: t });
      const g = C.geometry(state);
      const a = appletCompute(n, state.vertices, t, state.which, 0, trace);
      cases++;
      if (!g || g.circles.length !== a.circles.length ||
          !closeP(g.p, a.p) || !close(g.firstRadius, a.first.r)) { bad++; continue; }
      for (let i = 0; i < n; i++) {
        if (!closeP(g.vertices[i], a.V[i]) || !closeP(g.bisectors[i], a.L[i])) bad++;
      }
      for (let i = 0; i < a.circles.length; i++) {
        if (!closeP(g.circles[i], a.circles[i]) || !close(g.circles[i].r, a.circles[i].r) ||
            g.circles[i].red !== a.red[i]) bad++;
      }
    }
  }
  check(`core equals the bytecode transcription on all ${cases} regular configurations`,
    bad === 0, `${bad} differences`);
  check("the applet's fallback-to-second-root branch really occurs", trace.fallback > 0,
    `${trace.fallback} times`);
  check("Solve2's |a| < 0.01 and negative-discriminant guards agree",
    C.solve2(0.001, 1, 1) === null && appletSolve2(0.001, 1, 1) === null &&
    C.solve2(1, 0, 1) === null && appletSolve2(1, 0, 1) === null &&
    close(C.solve2(1, 0, -1)[0], appletSolve2(1, 0, -1)[0]));
  check("the distance-to-side shortcut at the first corner agrees",
    close(C.distanceToLine(P(3, 4), P(3, 4), P(10, 4)),
      appletDistLine(P(3, 4), P(3, 4), P(10, 4))));
}

{
  /* Irregular convex polygons and dragged corners: the same comparison. */
  let bad = 0, cases = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const n = 3 + seed % 19;
    const step = 2 * Math.PI / n;
    const V = Array.from({ length: n }, (_, i) => {
      const a = i * step + Math.sin(seed * 3.1 + i * 1.7) * step * 0.12;
      const r = R * (0.78 + 0.2 * (0.5 + 0.5 * Math.sin(seed * 0.7 + i * 2.3)));
      return P(C.CENTER.x + r * Math.cos(a), C.CENTER.y + r * Math.sin(a));
    });
    if (!convex(V)) continue;
    for (const t of [0.2, 0.5, 0.8]) {
      const state = Object.assign({}, C.start({ n: n }), { vertices: V, ta: t });
      const g = C.geometry(state);
      const a = appletCompute(n, V, t, state.which);
      cases++;
      if (!g || g.circles.length !== a.circles.length ||
          g.bisectors.some((p, i) => !closeP(p, a.L[i])) ||
          g.circles.some((c, i) => !closeP(c, a.circles[i]) || !close(c.r, a.circles[i].r))) bad++;
    }
  }
  check(`core equals the transcription on ${cases} irregular convex polygons`,
    cases > 100 && bad === 0, `${bad} differences`);

  let dragBad = 0;
  for (const n of [3, 5, 8, 13, 21]) {
    let state = C.start({ n: n });
    state = C.moveVertex(state, 0, P(C.CENTER.x + R * 0.55, C.CENTER.y - R * 0.35));
    state = C.moveVertex(state, Math.floor(n / 2), P(C.CENTER.x - R * 0.6, C.CENTER.y + R * 0.2));
    const g = C.geometry(state);
    const a = appletCompute(n, state.vertices, state.ta, state.which);
    if (g.bisectors.some((p, i) => !closeP(p, a.L[i])) ||
        g.circles.some((c, i) => !closeP(c, a.circles[i]) || !close(c.r, a.circles[i].r))) dragBad++;
  }
  check("dragged corners recalculate bisectors and circles as the applet does", dragBad === 0);

  let pointBad = 0;
  for (const n of [3, 4, 7, 12, 21]) {
    const state = C.start({ n: n });
    const L = state.vertices.map((v, i) => appletBisector(v,
      state.vertices[(i + n - 1) % n], state.vertices[(i + 1) % n]));
    const a0 = state.vertices[0], b0 = L[0];
    const raw = P(a0.x * 2 + 300, a0.y * 2 - 200);
    const dx = a0.x - b0.x, dy = a0.y - b0.y;
    const want = Math.max(0, Math.min(1,
      -(dx * (b0.x - raw.x) + dy * (b0.y - raw.y)) / (dx * dx + dy * dy)));
    const moved = C.movePoint(state, raw);
    if (!close(moved.ta, want, 1e-12) || moved.ta !== 1) pointBad++;
  }
  check("dragging the point clamps m_Ta to the bisector segment [0,1]", pointBad === 0);
}

/* ------------------------------------------------- 3. the page's claims */

{
  let over = 0, regularShort = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (const t of TS) {
      const g = C.geometry(Object.assign({}, C.start({ n: n }), { ta: t }));
      if (g.chainLength > 2 * n) over++;
      if (g.chainLength !== 2 * n) regularShort++;
    }
  }
  check("the applet never draws more than 2N circles, for every N and start", over === 0);
  equal("the odd-n bound 2n is reached, not exceeded, for regular polygons", regularShort, 0);

  let fallbacks = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    const V = regular(n);
    const trace = { fallback: 0 };
    appletCompute(n, V, 0.7, 2 * n, 2, trace);
    fallbacks += trace.fallback;
  }
  check("the recurrence can be continued past 2N: the bound is a loop cap here",
    fallbacks > 0);
}

{
  /* Period of the chain for regular polygons; the page mentions N, N+1, 2N. */
  let badEven = 0, badOdd = 0, gotNplus1 = 0;
  const seen = new Set();
  for (let n = 3; n <= 21; n++) {
    for (const t of TS) {
      const cs = appletCompute(n, regular(n), t, 2 * n, 2).circles;
      if (cs[0].r < 1e-9) continue; // the applet's 0.1 shortcut gives a zero first circle
      let period = 0;
      for (let k = 1; k < cs.length; k++) {
        if (dst(cs[0], cs[k]) < 1e-6 * R && Math.abs(cs[0].r - cs[k].r) < 1e-6 * R) {
          period = k;
          break;
        }
      }
      seen.add(period);
      if (period === n + 1) gotNplus1++;
      if (n % 2 === 0 && period !== n) badEven++;
      if (n % 2 === 1 && period !== 2 * n) badOdd++;
    }
  }
  check("regular even N: the chain closes with exactly N circles", badEven === 0);
  check("regular odd N: the chain closes with exactly 2N circles", badOdd === 0);
  check("the page's N+1 length never occurs in any tested regular polygon",
    gotNplus1 === 0, `periods seen: ${[...seen].sort((a, b) => a - b).join(", ")}`);
}

{
  /* Even n: distance between circle 1 and circle 2n, against the first radius. */
  let constant = 0, smallestSpread = Infinity;
  for (let n = 4; n <= 20; n += 2) {
    const ds = [], rs = [];
    for (const t of TS) {
      const cs = appletCompute(n, regular(n), t, 2 * n).circles;
      rs.push(cs[0].r);
      ds.push(dst(cs[0], cs[cs.length - 1]));
    }
    const spread = Math.max(...ds) - Math.min(...ds);
    smallestSpread = Math.min(smallestSpread, spread);
    if (spread < 1 || Math.max(...rs) - Math.min(...rs) < 1) constant++;
  }
  check("the page's even-n independence claim fails in the applet: the distance varies",
    constant === 0, `smallest spread ${smallestSpread.toFixed(2)} board units`);
}

{
  /* Tangency and emphasis: the chain really is a chain, and the pair colours. */
  let tangencyBad = 0;
  for (const n of [3, 4, 5, 8, 13, 21]) {
    for (const t of TS) {
      const cs = appletCompute(n, regular(n), t, 2 * n).circles;
      for (let i = 1; i < cs.length; i++) {
        const gap = dst(cs[i], cs[i - 1]) - Math.abs(cs[i].r + cs[i - 1].r);
        if (Math.abs(gap) > 1e-6 * R) tangencyBad++;
      }
    }
  }
  check("each drawn circle touches its predecessor to within rounding", tangencyBad === 0);

  let colourBad = 0;
  for (const n of [3, 4, 7, 21]) {
    for (let w = 0; w <= 2 * n; w++) {
      const g = C.geometry(C.setWhich(C.start({ n: n }), w));
      if (g.circles.length !== 2 * n) colourBad++;
      g.circles.forEach((c, i) => {
        const want = w === 2 * n || i === w || (i + 2 * n - 1) % (2 * n) === w;
        if (c.red !== want) colourBad++;
      });
    }
  }
  check("emphasis colours pair #k and #k+1, and 2N colours every circle", colourBad === 0);
}

{
  /* The page's inscriptible-quadrilateral example against irregular cyclic
   * quadrilaterals: the regular square closes, sampled irregular ones do not. */
  const square = C.geometry(C.start({ n: 4 }));
  equal("an inscriptible regular quadrilateral closes with n circles", square.closureAt, 4);
  let open = 0, cases = 0;
  for (let k = 0; k < 24; k++) {
    const angles = [0.15, 1.5 + 0.25 * Math.sin(k), 3.0 + 0.3 * Math.sin(k * 1.7),
      4.5 + 0.25 * Math.cos(k * 0.8)];
    const V = angles.map((a) => P(C.CENTER.x + R * Math.cos(a), C.CENTER.y + R * Math.sin(a)));
    const cs = appletCompute(4, V, 0.25 + 0.5 * ((k % 7) / 7), 8).circles;
    cases++;
    if (!cs.some((c, i) => i > 0 && dst(cs[0], c) < 1e-6 * R &&
      Math.abs(cs[0].r - c.r) < 1e-6 * R)) open++;
  }
  check(`sampled cyclic quadrilaterals stay open (${open}/${cases}), so the page's example is not general`,
    open > cases / 2);
}

/* ------------------------------------------- 4. positions, moves, messages */

{
  const s = C.start({ n: 6 });
  const moved = C.moveVertex(s, 1, P(50, 60));
  check("moveVertex returns a new state and leaves the old one alone",
    moved !== s && !closeP(moved.vertices[1], s.vertices[1]) &&
    closeP(s.vertices[1], regular(6)[1]));
  check("a drag outside the board is clamped inside it",
    closeP(C.moveVertex(s, 0, P(-1000, 9999)).vertices[0], P(8, 312)));
  check("an out-of-range corner is ignored",
    C.moveVertex(s, 6, P(1, 2)) === s && C.moveVertex(s, -1, P(1, 2)) === s);

  const off = C.movePoint(s, P(s.vertices[0].x + 17, s.vertices[0].y - 11));
  const g = C.geometry(off);
  const L = s.vertices.map((v, i) => appletBisector(v, s.vertices[(i + 6 - 1) % 6],
    s.vertices[(i + 1) % 6]));
  const projected = P(s.vertices[0].x * off.ta + L[0].x * (1 - off.ta),
                      s.vertices[0].y * off.ta + L[0].y * (1 - off.ta));
  check("movePoint keeps P on the first bisector", closeP(g.p, projected) && off.explored);
  check("setN, setWhich and reset never mutate their input",
    s.n === 6 && s.which === 12 && !s.explored);

  const snap = C.snapshot(C.setWhich(C.moveVertex(s, 0, P(300, 100)), 3));
  check("a snapshot is plain data, including the circles, for Track.state()",
    snap.n === 6 && snap.which === 3 && snap.vertices.length === 6 &&
    snap.circles.length === 12 && !Object.values(snap).some((v) => typeof v === "function"));
  check("a snapshot survives JSON serialisation", !!JSON.parse(JSON.stringify(snap)).p);
  check("describe reports the N, the circle count and the pair",
    /N = 6, 12 circles; pair #3/.test(C.describe(C.setWhich(s, 3))));
  check("a bad state has no geometry and an honest description",
    C.geometry({ vertices: [P(0, 0)] }) === null &&
    typeof C.describe({}) === "string");
  check("a demonstration has no result in any configuration",
    [s, moved, off, C.reset(s), C.setN(s, 21)].every((x) => C.result(x) === null));
}

done("evelyn-n");
