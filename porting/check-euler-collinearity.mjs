#!/usr/bin/env node
"use strict";

/*
 * Logic test for euler-collinearity/euler-collinearity-core.js.
 *
 *   node porting/check-euler-collinearity.mjs
 *
 * Covers the applet's initial triangle and point P, its slider range, the
 * midpoint and homothety construction, the one-pixel drawing/intersection
 * quirks, and the page's two claims: for each t the three cevians concur,
 * and their common point runs on GP (the Euler line when P is the
 * circumcenter). Every case is checked over a dense grid of triangles,
 * points P and slider values, and the core is compared field by field with
 * a second, literal transcription of Compute() over all those cases.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("euler-collinearity/euler-collinearity-core.js", "EulerCollinearityCore");
const P = C.pt;
const nearNum = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const near = (p, q, tol = 1e-7) =>
  p && q && nearNum(p.x, q.x, tol) && nearNum(p.y, q.y, tol);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (p, q) => p.x * q.y - p.y * q.x;

/** Distance from a point to the infinite line through a and b. */
function lineDistance(p, a, b) {
  const d = C.sub(b, a);
  return Math.abs(cross(d, C.sub(p, a))) / Math.hypot(d.x, d.y);
}

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start();
  const cx = 250, cy = 250, r = 500 / 3;
  const expected = [0, 1, 2].map((k) =>
    P(cx + r * Math.sin((2 * Math.PI * k) / 3), cy - r * Math.cos((2 * Math.PI * k) / 3)));
  check("the three vertices start on a circle of radius width/3 around the canvas center",
    s.V.every((v, k) => near(v, expected[k])));
  check("P starts 100 right and 20 above the center", near(s.P, P(350, 230)));
  check("the unused Q keeps the applet's -20,+30 offset", near(s.Q, P(230, 280)));
  check("the scrollbar starts at 15, i.e. t = 1.5", nearNum(C.sliderT(15), 1.5) && nearNum(s.t, 1.5));
  check("the two checkboxes start unchecked", !s.showHint && !s.showNames);
  check("dragging points and changing the slider leaves the flags alone",
    C.withFlag(C.withT(C.withPoint(s, "V1", P(10, 10)), 40), "showHint", true).showNames === false);
}

/* ------------------------------------------------- 2. options and limits */

{
  check("the slider maps the applet's -10..505 to t = -1..50.5",
    C.sliderT(C.APPLET.sliderMin) === -1 && C.sliderT(C.APPLET.sliderMax) === 50.5);
  check("the applet's slider never reaches the translation case t = -2",
    C.APPLET.sliderMin > -20 && C.claimPoint(P(3, 4), P(1, 2), -2) === null);
  const s = C.start();
  const moved = C.withPoint(s, "P", P(-500, 9999));
  check("a dragged point is clamped inside the canvas", moved.P.x === 4 && moved.P.y === 496);
  check("an unknown handle is refused", C.withPoint(s, "Q", P(1, 2)) === s);
  const v2 = C.withPoint(s, "V2", P(120, 410));
  check("moving V2 changes only V2", near(v2.V[2], P(120, 410)) && near(v2.V[0], s.V[0]) && near(v2.P, s.P));
  check("inputs are never mutated", near(s.P, P(350, 230)) && near(s.V[2], expectedV2(s)));
}
function expectedV2(s) {
  const r = 500 / 3;
  return P(250 + r * Math.sin((4 * Math.PI) / 3), 250 - r * Math.cos((4 * Math.PI) / 3));
}

/* ------------------------- 3. the midpoint and homothety construction */

{
  const s = C.start();
  const c = C.compute(s);
  const M = [
    P((s.V[1].x + s.V[2].x) / 2, (s.V[1].y + s.V[2].y) / 2),
    P((s.V[0].x + s.V[2].x) / 2, (s.V[0].y + s.V[2].y) / 2),
    P((s.V[0].x + s.V[1].x) / 2, (s.V[0].y + s.V[1].y) / 2),
  ];
  check("M1, M2, M3 are the midpoints of the opposite sides", c.M.every((m, k) => near(m, M[k])));
  const Mt = M.map((m) => P(s.P.x + s.t * (m.x - s.P.x), s.P.y + s.t * (m.y - s.P.y)));
  check("Mtk = P + t(Mk - P) at the starting t", c.Mt.every((m, k) => near(m, Mt[k])));
  check("the centroid is the average of the vertices",
    near(c.G, P((s.V[0].x + s.V[1].x + s.V[2].x) / 3, (s.V[0].y + s.V[1].y + s.V[2].y) / 3)));
  check("U = P + t(G - P)", near(c.U, P(s.P.x + s.t * (c.G.x - s.P.x), s.P.y + s.t * (c.G.y - s.P.y))));
  check("the starting case draws three cevians and three vectors",
    c.lines.every(Boolean) && c.vectors.every(Boolean) && Boolean(c.S) && Boolean(c.L));
}

/* --------------------------- 4. the applet's one-pixel drawing quirks */

{
  const s = C.start();
  const zero = C.withT(s, 0);
  const c0 = C.compute(zero);
  check("at t = 0 every Mt is P, so no vector is drawn",
    c0.vectors.every((v) => v === null) && c0.lines.every(Boolean));
  check("at t = 0 the concurrence point is P itself", near(c0.S, zero.P, 1e-6));
  check("at t = 0 the locus line PS is skipped", c0.L === null);
  const onVertex = C.withPoint(C.withT(s, 0), "P", s.V[0]);
  const conVertex = C.compute(onVertex);
  check("a cevian whose ends coincide is skipped", conVertex.lines[0] === null);
  check("intersections with a determinant below one pixel are suppressed",
    C.intersect(P(0, 0), P(10, 0), P(0, 0.3), P(10, 0.3)) === null &&
    near(C.intersect(P(0, 0), P(10, 0), P(5, 2), P(5, 4)), P(5, 0)));
}

/* ---------------- 5. the page's claims over triangles, points and t */

const triangles = [C.start().V];
{
  const rand = rng(1814);
  const base = C.start().V;
  // Deliberately varied shapes, including a right triangle and a flat one.
  triangles.push([P(80, 420), P(430, 420), P(90, 90)]);
  triangles.push([P(100, 100), P(400, 120), P(220, 430)]);
  triangles.push([P(60, 300), P(440, 305), P(250, 310)]);
  for (let i = 0; i < 40; i++) {
    triangles.push([P(30 + rand() * 440, 30 + rand() * 440),
      P(30 + rand() * 440, 30 + rand() * 440),
      P(30 + rand() * 440, 30 + rand() * 440)]);
  }
}
const points = [P(350, 230), P(250, 250), P(20, 20), P(480, 480), P(250, 30), P(30, 250),
  P(400, 200), P(120, 400), P(250, 250)];
const ts = [-1, -0.8, -0.5, -0.1, 0, 0.1, 0.5, 0.9, 1, 1.1, 1.5, 2, 3, 5, 10, 25.5, 50.5];

{
  let bad = 0, tested = 0, skipped = 0;
  for (const V of triangles) {
    const G = C.barycenter(V[0], V[1], V[2]);
    for (const Q of points) {
      for (const t of ts) {
        const st = { V, P: Q, Q, t, showHint: false, showNames: false };
        const c = C.compute(st);
        if (!c.S) { skipped++; continue; } // the applet's NaN intersection rule
        const tol = 1e-5 * Math.max(1, C.distance(c.S, Q));
        // All three cevians pass through S.
        for (const line of c.lines) {
          if (line && lineDistance(c.S, line.p, line.q) > tol) bad++;
        }
        // S is on GP, and equals the product-of-homotheties formula.
        if (C.distance(Q, G) > 1e-9 &&
            Math.abs(cross(C.sub(c.S, Q), C.sub(G, Q))) / C.distance(Q, G) >
              1e-5 * Math.max(1, C.distance(c.S, Q))) bad++;
        if (!near(c.S, C.claimPoint(Q, G, t), 1e-6 * Math.max(1, C.distance(c.S, Q)))) bad++;
        if (!near(c.U, C.add(Q, C.mul(C.sub(G, Q), t)), 1e-7)) bad++;
        tested++;
      }
    }
  }
  check(`${tested} configurations: the cevians concur at S, which lies on GP`, bad === 0, `${bad} failures`);
  check("the applet's degenerate cases are skipped, leaving thousands tested", tested > 6000,
    `skipped ${skipped} (no cevian or a one-pixel intersection), tested ${tested}`);

  let special = 0;
  for (const V of triangles) {
    const G = C.barycenter(V[0], V[1], V[2]);
    for (const Q of points) {
      for (const t of [0, 1]) {
        const c = C.compute({ V, P: Q, Q, t });
        if (!c.S) continue;
        if (!near(c.S, t === 0 ? Q : G, 1e-5)) special++;
      }
    }
  }
  check("t = 0 gives P and t = 1 gives the centroid G for every configuration", special === 0);
}

/* -------------------- 6. the Euler-line case P = circumcenter O */

{
  let bad = 0, tested = 0;
  for (const V of triangles) {
    const O = C.circumcenter(V);
    const G = C.barycenter(V[0], V[1], V[2]);
    const H = C.orthocenter(V);
    if (!O || !H || !Number.isFinite(O.x) || !Number.isFinite(H.x)) continue;
    for (const t of ts) {
      const c = C.compute({ V, P: O, Q: O, t });
      if (!c.S) continue;
      const tol = 1e-5 * Math.max(1, C.distance(c.S, G));
      if (Math.abs(cross(C.sub(c.S, G), C.sub(O, G))) / C.distance(O, G) > tol) bad++;
      if (!near(C.limitPoint(O, G), H, 1e-7)) bad++; // H = 3G - 2O
      if (!nearNum(2 * C.distance(G, H), 4 * C.distance(G, O), 1e-6 * Math.max(1, C.distance(G, O)))) bad++;
      tested++;
    }
  }
  check(`${tested} triangles with P = O: S lies on GO and the limit is the orthocenter H`,
    bad === 0 && tested > 500, `${bad} failures`);
  check("GH = 2GO on every non-degenerate triangle",
    triangles.every((V) => {
      const O = C.circumcenter(V);
      return !O || nearNum(2 * C.distance(C.barycenter(V[0], V[1], V[2]), C.orthocenter(V)),
        4 * C.distance(C.barycenter(V[0], V[1], V[2]), O), 1e-6);
    }));
}

/* --------------- 7. a second transcription of the applet's Compute() */

/* GeoSDoub.Intersect solved with 2x2 determinants; NaN becomes null. */
function meet(p, q, r, s) {
  const ux = q.x - p.x, uy = q.y - p.y;
  const vx = s.x - r.x, vy = s.y - r.y;
  const den = ux * vy - uy * vx;
  if (!(Math.abs(den) >= 1)) return null;
  const t = ((r.x - p.x) * vy - (r.y - p.y) * vx) / den;
  return P(p.x + ux * t, p.y + uy * t);
}

/** Locals S1 (P), S3, S4, arrays M/Mt/Line/Mv and fields S/G/U, from bytecode. */
function appletCompute(V, P0, T) {
  const M = [], Mt = [], Line = [], Mv = [];
  for (let k = 0; k < 3; k++) {
    const j = (k + 1) % 3, l = (k + 2) % 3;
    M.push(P((V[j].x + V[l].x) / 2, (V[j].y + V[l].y) / 2));
    Mt.push(P(P0.x + T * (M[k].x - P0.x), P0.y + T * (M[k].y - P0.y)));
    if (dist(Mt[k], P0) > 1) Mv.push({ p: P0, q: Mt[k] }); else Mv.push(null);
    if (dist(V[k], Mt[k]) > 1) Line.push({ p: V[k], q: Mt[k] }); else Line.push(null);
  }
  const xs = [], ys = [];
  const pairs = [[0, 1], [1, 2], [2, 0]];
  for (const [a, b] of pairs) {
    const x = Line[a] && Line[b] ? meet(Line[a].p, Line[a].q, Line[b].p, Line[b].q) : null;
    if (!x) return { M, Mt, Line, Mv, S: null, G: null, U: null, L: null };
    xs.push(x.x); ys.push(x.y);
  }
  const S = P((xs[0] + xs[1] + xs[2]) / 3, (ys[0] + ys[1] + ys[2]) / 3);
  const G = P((V[0].x + V[1].x + V[2].x) / 3, (V[0].y + V[1].y + V[2].y) / 3);
  const U = P(P0.x + T * (G.x - P0.x), P0.y + T * (G.y - P0.y));
  const L = dist(S, P0) > 1 ? { p: P0, q: S } : null;
  return { M, Mt, Line, Mv, S, G, U, L };
}

{
  let bad = 0, cases = 0, segments = 0;
  const sameSeg = (a, b) => {
    segments++;
    return (a === null && b === null) || (a && b && near(a.p, b.p) && near(a.q, b.q));
  };
  for (const V of triangles) {
    for (const Q of points) {
      for (const t of ts) {
        const st = { V, P: Q, Q, t, showHint: false, showNames: false };
        const core = C.compute(st);
        const ref = appletCompute(V, Q, t);
        if (!core.M.every((m, k) => near(m, ref.M[k])) ||
            !core.Mt.every((m, k) => near(m, ref.Mt[k])) ||
            !near(core.G, ref.G) || !near(core.U, ref.U) ||
            !near(core.S, ref.S, 1e-6) ||
            !core.lines.every((v, k) => sameSeg(v, ref.Line[k])) ||
            !core.vectors.every((v, k) => sameSeg(v, ref.Mv[k])) ||
            !sameSeg(core.L, ref.L)) bad++;
        cases++;
      }
    }
  }
  check(`${cases} configurations agree with a second transcription of Compute() (${segments} segments)`,
    bad === 0, `${bad} failures`);

  // The slider's whole integer range, not just the sampled t values.
  bad = 0;
  for (let value = C.APPLET.sliderMin; value <= C.APPLET.sliderMax; value += 5) {
    const s = C.withT(C.start(), value);
    const core = C.compute(s);
    const ref = appletCompute(s.V, s.P, s.t);
    if (!near(core.S, ref.S, 1e-6) || !near(core.Mt[0], ref.Mt[0])) bad++;
  }
  check("all 104 slider positions match the applet's method", bad === 0, `${bad} failures`);
}

/* ----------------------------- 8. equality of the core's plain data */

{
  const s = C.start();
  const copy = C.withT(s, 25);
  equal("withT keeps the plain-data fields", { P: copy.P, Q: copy.Q, t: copy.t },
    { P: s.P, Q: s.Q, t: 2.5 });
  check("the core exposes neither DOM nor storage",
    typeof globalThis.document === "undefined" && typeof C.compute === "function");
}

done("euler-collinearity");
