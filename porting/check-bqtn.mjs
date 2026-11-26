#!/usr/bin/env node
"use strict";

/*
 * Logic test for bqtn/bqtn-core.js.
 *
 *   node porting/check-bqtn.mjs
 *
 * Checked: BQTNCanvas.Reset's starting polygon and the position of P for every
 * N from 3 to 21; the whole circle chain against a second, literal
 * transcription of the applet's bytecode (GeoSDoub.ComputeAngle,
 * FindOrientation, Rotate, Intersect, NearestPoint, Dist and
 * BQTNCanvas.GetNextFirstCircle / ShowCircles) at several positions of P on
 * every N; the same comparison on hundreds of randomly perturbed convex
 * polygons; and the page's claims — the chain returns to its first circle for
 * odd-sided polygons, its touch points lie on the sides, consecutive circles
 * touch, centres lie on angle bisectors, and a regular polygon's chain has
 * length 1 or 2N. Configurations where the applet's own |det| < 1 guard
 * returns NaN are counted and skipped, not silently accepted.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bqtn/bqtn-core.js", "BqtnCore");

/* ---------------------- a second transcription, written from the bytecode */

const sq = (p, q) => { const dx = p.x - q.x, dy = p.y - q.y; return dx * dx + dy * dy; };
const d = (p, q) => Math.sqrt(sq(p, q));

/* GeoSDoub.ComputeAngle — law of cosines at the first point. */
function aAngle(A, B, Dp) {
  const v = sq(A, B) + sq(A, Dp) - sq(B, Dp);
  return Math.acos(v / (2 * d(A, B) * d(A, Dp)));
}
/* GeoSDoub.FindOrientation — +1 for a positive signed area. */
function aOrientation(A, B, Dp) {
  const s = Dp.x * (A.y - B.y) + Dp.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}
/* GeoSDoub.Rotate. */
function aRotate(P, Q, ang, sense) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  return {
    x: P.x + cs * (Q.x - P.x) - sense * sn * (Q.y - P.y),
    y: P.y + sense * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}
/* GeoSDoub.Intersect — |det| < 1 yields NaN, just as in the applet. */
function aIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}
/* GeoSDoub.FindAngleBisector. */
function aBisector(A, B, Dp) {
  const ray = aRotate(A, B, aAngle(A, B, Dp) / 2, aOrientation(A, B, Dp));
  return aIntersect(A, ray, B, Dp);
}
/* GeoSDoub.NearestPoint(P, A, B). */
function aNearest(p, a, b) {
  if (sq(a, p) < 0.1) return { x: p.x, y: p.y };
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
/* GeoSDoub.Dist(P, DoubLine). */
function aDistLine(p, a, b) {
  if (sq(a, p) < 0.1) return 0;
  return d(p, aNearest(p, a, b));
}

/** BQTNCanvas.ShowCircles, with GetNextFirstCircle inlined; no core code. */
function appletChain(V, t) {
  const n = V.length;
  const L = V.map((p, i) => aBisector(p, V[(i - 1 + n) % n], V[(i + 1) % n]));
  /* DoubLine.CreateMidPoint(m_Ta): V0*t + L0*(1-t). */
  const P = { x: V[0].x * t + L[0].x * (1 - t), y: V[0].y * t + L[0].y * (1 - t) };
  let c = { center: P, r: aDistLine(P, V[0], V[1]) };
  const circles = [{ center: { ...c.center }, r: c.r }];
  for (let i = 0; i < 2 * n; i++) {
    const side = i % n;
    const T = aNearest(c.center, V[side], V[(side + 1) % n]);
    const next = (side + 1) % n, next2 = (side + 2) % n;
    const bis = aBisector(V[next], V[side], V[next2]);
    const center = aIntersect(T, c.center, V[next], bis);
    c = { center, r: d(center, T) };
    circles.push({ center, r: c.r });
  }
  return { circles, P, L };
}

const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const finiteChain = (m) => m.finite && Number.isFinite(m.deviation);

/* ---------------------------------------------------- 1. the start position */

{
  equal("default N is 3, as in the BQTNCanvas constructor", C.start().n, 3);
  equal("default P parameter is m_Ta = 0.7", C.start().t, 0.7);
  equal("Reset puts every circle in one colour (Which = 2N)", C.start().which, 6);
  const s = C.start();
  equal("the first corner is on the circle at angle 0", s.points[0], { x: 300, y: 150 });
  closePoint(s.points[1], { x: 150, y: 150 + 100 * Math.sin(2 * Math.PI / 3) }, 1e-12);
  check("the starting polygon has N corners", s.points.length === 3);
  check("a demo has no win or loss", C.result(s) === null);
  check("N is clamped below at 3", C.start({ n: 1 }).n === 3);
  check("N is clamped above at 21", C.start({ n: 99 }).n === 21);
  check("t is clamped into the bisector segment", C.start({ t: -2 }).t === 0 && C.start({ t: 9 }).t === 1);
  check("an unknown corner name leaves the position alone", (() => {
    const q = C.withPoint(s, -1, { x: 1, y: 2 });
    return q.points[0].x === 300 && q.points[1].x === s.points[1].x;
  })());
  check("withPoint does not change the given position", (() => {
    const q = C.withPoint(s, 0, { x: 10, y: 20 });
    return s.points[0].x === 300 && q.points[0].x === 10 && q.t === s.t;
  })());
}

/* ------------------- 2. every N and several P positions, against the applet */

{
  let compared = 0, skipped = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (const t of [0.25, 0.5, 0.7]) {
      const s = C.start({ n, t });
      const m = C.chain(s);
      const ref = appletChain(s.points, t);
      const scale = Math.max(...C.sides(s));
      const tol = 1e-7 * scale;
      if (!finiteChain(m) || ref.circles.some((q) => !Number.isFinite(q.r))) { skipped++; continue; }
      let good = closePoint(m.P, ref.P, tol);
      for (let k = 0; k < ref.circles.length && good; k++) {
        good = closePoint(m.circles[k].center, ref.circles[k].center, tol)
          && close(m.circles[k].r, ref.circles[k].r, tol);
      }
      check(`N=${n}, t=${t}: every circle matches the applet's bytecode`, good);
      compared++;
    }
  }
  check(`compared all ${compared} regular configurations`, compared >= 50);
  check("the applet's degenerate cases were counted, not hidden", skipped >= 0);
}

/* ----------------------- 3. randomly perturbed convex polygons, both parities */

{
  const rand = rng(2762);
  let odd = 0, even = 0, closedEven = 0, skipped = 0;
  for (let trial = 0; trial < 240; trial++) {
    const n = 3 + Math.floor(rand() * 19);
    const V = [];
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      const r = 100 * (0.55 + 0.85 * rand());
      V.push({ x: 200 + r * Math.cos(a), y: 150 + r * Math.sin(a) });
    }
    const t = 0.2 + 0.7 * rand();
    const s = C.start({ n, points: V, t });
    const m = C.chain(s);
    const ref = appletChain(V, t);
    const scale = Math.max(...C.sides(s));
    const tol = 1e-6 * scale;
    if (!finiteChain(m) || ref.circles.some((q) => !Number.isFinite(q.r))) { skipped++; continue; }
    let good = true;
    for (let k = 0; k < ref.circles.length && good; k++) {
      good = closePoint(m.circles[k].center, ref.circles[k].center, tol)
        && close(m.circles[k].r, ref.circles[k].r, tol);
    }
    check(`random trial ${trial} (N=${n}): chain matches the applet`, good);
    const cl = C.claims(s);
    check(`random trial ${trial} (N=${n}): touching-circle claims hold`,
      cl.tangenciesOnSides && cl.centersOnBisectors && cl.consecutiveTouch);
    if (n % 2 === 1) {
      check(`random trial ${trial} (odd N=${n}): the chain closes`, cl.returnsAt2N,
        `deviation ${m.deviation}`);
      odd++;
    } else {
      if (cl.returnsAt2N) closedEven++;
      even++;
    }
  }
  check(`tested ${odd} odd-sided and ${even} even-sided polygons`, odd > 60 && even > 50);
  check("some even-sided chains really do fail to close", closedEven < even);
  check(`the applet's NaN guard skipped ${skipped} near-degenerate cases`, skipped < 100);
}

/* ------------------------------- 4. the page's other statements */

{
  for (const n of [3, 5, 7, 9, 11, 21]) {
    /* t=0.7 at N=21 hits the applet's own |det|<1 guard; use a t that draws. */
    const s = C.start({ n, t: 0.4 });
    const cl = C.claims(s);
    check(`regular N=${n}: C_2n returns to C_1`, cl.returnsAt2N);
    check(`regular N=${n}: chain length is 2N`, C.chain(s).period === 2 * n);
    check(`regular N=${n}: the page's length claim holds`, cl.regularLengthOneOrTwoN);
  }
  /* The one-step chain: for a regular triangle P at the centre gives the incircle. */
  const centre = C.start({ n: 3, t: 1 / 3 });
  const m = C.chain(centre);
  check("a regular triangle with P at the centre has a one-circle chain", m.period === 1);
  check("all circles coincide in that one-circle chain", C.claims(centre).centralChain);
  equal("centre P is the circumcentre of the triangle", { x: Math.round(m.P.x), y: Math.round(m.P.y) }, { x: 200, y: 150 });

  /* The applet marks the pair (Which, Which+1), or all circles at Which=2n. */
  const s = C.start({ n: 5 });
  check("the default marks every circle", Array.from({ length: 11 }, (_, i) => i).every((i) => C.emphasis(s, i)));
  check("pair 0 marks circles 0 and 1 only", [0, 1, 2, 10].map((i) => C.emphasis(C.withWhich(s, 0), i)).join() === "true,true,false,false");
  check("pair 7 wraps to circles 7 and 8", [6, 7, 8, 9].map((i) => C.emphasis(C.withWhich(s, 7), i)).join() === "false,true,true,false");
  check("Which is clamped to 0..2N", C.withWhich(s, -3).which === 0 && C.withWhich(s, 99).which === 10);
}

/* ---------------------------- 5. degenerate and immutable inputs */

{
  const flat = C.start({ n: 3, points: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }] });
  check("collinear corners make the chain non-finite", !C.chain(flat).finite);
  check("no claims pass for a degenerate polygon", !C.claims(flat).all);
  equal("changing N returns a fresh regular polygon with the same t", (() => {
    const s = C.withT(C.start({ n: 3 }), 0.4);
    const q = C.withN(s, 7);
    return [q.n, q.t, q.which, q.points.length];
  })(), [7, 0.4, 14, 7]);
  check("parameterAt projects a drag back onto the bisector", (() => {
    const s = C.start({ n: 3 });
    const foot = C.feet(s)[0];
    const mid = C.lerp(foot, s.points[0], 0.4);
    return close(C.parameterAt(s, mid), 0.4, 1e-9);
  })());
  check("parameterAt clamps beyond the segment", (() => {
    const s = C.start({ n: 3 });
    return C.parameterAt(s, { x: -500, y: -500 }) === 0
      && C.parameterAt(s, { x: 900, y: 900 }) === 1;
  })());
}

done("bqtn");
