#!/usr/bin/env node
"use strict";

/*
 * Logic test for general-napoleon/general-napoleon-core.js.
 *
 *   node porting/check-general-napoleon.mjs
 *
 * Checks the page's exact claim — isotomic pairs on the three sides with the
 * same barycentric coordinates, similar similarly oriented isosceles triangles
 * on KL, PQ, MN, and concurrent AA', BB', CC' — over a sweep of every slider
 * value the applet offers and many triangles.  It also transcribes the
 * applet's Compute() a second time, literally from the bytecode (InSegment,
 * GeoSDoub.Rotate, GeoSDoub.Intersect), and compares every generated point.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("general-napoleon/general-napoleon-core.js", "GeneralNapoleonCore");
const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);

const TRIANGLES = [
  [P(120, 200), P(310, 190), P(190, 60)],
  [P(90, 240), P(350, 210), P(210, 40)],
  [P(110, 100), P(330, 250), P(250, 55)],
];

/* ------------- a second, literal transcription of the applet's bytecode */

/* InSegment(A, B, t) = t*A + (1-t)*B. */
function appSegment(a, b, t) {
  return P(t * a.x + (1 - t) * b.x, t * a.y + (1 - t) * b.y);
}

/* GeoSDoub.Rotate(P1, P2, angle, orientation): rotate P2 about P1. */
function appRotate(p, c, r, orientation) {
  const co = Math.cos(r), si = Math.sin(r);
  return P(
    p.x + co * (c.x - p.x) - orientation * si * (c.y - p.y),
    p.y + orientation * si * (c.x - p.x) + co * (c.y - p.y),
  );
}

/* GeoSDoub.Intersect: lines ax+by+c=0, |det| < 1 gives NaN coordinates. */
function appIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* GeneralNapoleonCanvas.Compute, including its (i+2)%3 store index and the
 * bytecode check of Double.isNaN(y) twice before storing an apex. */
function appCompute(V, up, down, angleDeg) {
  const Up = [], Down = [], Napoleons = [null, null, null];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    Up[i] = appSegment(V[i], V[j], up);
    Down[i] = appSegment(V[i], V[j], down);
  }
  const r = angleDeg * Math.PI / 180;
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    const turnedUp = appRotate(Up[i], V[i], r, 1);
    const turnedDown = appRotate(Down[i], V[j], r, -1);
    const apex = appIntersect(Up[i], turnedUp, Down[i], turnedDown);
    if (!Number.isNaN(apex.y) && !Number.isNaN(apex.y)) Napoleons[(i + 2) % 3] = apex;
  }
  return { Up, Down, Napoleons };
}

/* Independent concurrency reading, from the applet's own transcription. */
function appConcurrency(V, Napoleons) {
  const [A, B, Cc] = V;
  const t = appIntersect(Napoleons[0], A, Napoleons[1], B);
  const u = appIntersect(Napoleons[1], B, Napoleons[2], Cc);
  const v = appIntersect(Napoleons[2], Cc, Napoleons[0], A);
  if (![t, u, v].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return Infinity;
  return Math.max(dist(t, u), dist(u, v), dist(t, v));
}

/* ------------------------------------------- 1. the starting configuration */

{
  const s = C.start();
  equal("the default up slider is 30/100", s.options.up, 0.3);
  equal("the default down slider is 70/100", s.options.down, 0.7);
  equal("the default angle is 60 degrees", s.options.angle, 60);
  check("names are shown by default, as on the page's second applet", s.options.names === true);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("the fresh diagram is not marked explored", s.explored === false);

  const drawn = C.initialTriangle(0.25);
  check("the starting vertices follow the applet's circle formula",
    closePoint(s.A, drawn[0], 1e-9) && closePoint(s.B, drawn[1], 1e-9) && closePoint(s.C, drawn[2], 1e-9));
  check("the starting vertices lie on a circle of radius min(w,h)/3", (() => {
    const centre = P(C.VIEW.width / 2, C.VIEW.height / 2), r = C.VIEW.height / 3;
    return [s.A, s.B, s.C].every((p) => close(dist(p, centre), r, 1e-9));
  })());
  check("the starting vertices are 120 degrees apart, as the applet's random init always makes them",
    close(dist(s.A, s.B), dist(s.B, s.C), 1e-9) && close(dist(s.B, s.C), dist(s.C, s.A), 1e-9));

  const g = C.geometry(s);
  check("the default diagram is computable", !!g && g.valid);
  check("K and L are at 0.3 and 0.7 of AB from A", close(dist(s.A, g.K) / dist(s.A, s.B), 0.3, 1e-9)
    && close(dist(s.A, g.L) / dist(s.A, s.B), 0.7, 1e-9));
  check("P and Q are at 0.3 and 0.7 of BC from B", close(dist(s.B, g.P) / dist(s.B, s.C), 0.3, 1e-9)
    && close(dist(s.B, g.Q) / dist(s.B, s.C), 0.7, 1e-9));
  check("M and N are at 0.3 and 0.7 of CA from C", close(dist(s.C, g.M) / dist(s.C, s.A), 0.3, 1e-9)
    && close(dist(s.C, g.N) / dist(s.C, s.A), 0.7, 1e-9));
  check("AK/AB = BP/BC = CM/CA, the page's barycentric condition",
    close(dist(s.A, g.K) / dist(s.A, s.B), dist(s.B, g.P) / dist(s.B, s.C), 1e-9)
    && close(dist(s.B, g.P) / dist(s.B, s.C), dist(s.C, g.M) / dist(s.C, s.A), 1e-9));
  check("AK = LB: the points on each side are isotomic at the defaults",
    close(dist(s.A, g.K), dist(s.B, g.L), 1e-9));
  check("the three erected triangles have equal base angles of 60 degrees",
    g.baseAngles.every((pair) => pair.every((v) => close(v, 60, 1e-8))));
  check("the three erected triangles are similar and isosceles",
    g.claims.isosceles && g.claims.similar);
  check("the page's concurrency claim holds on the starting triangle",
    g.claims.concurrent && g.measures.concurrencyError <= g.measures.tol);
  check("the applet would draw the three cevians and their meeting dot", g.showCevians && !!g.torricelli);
  check("the status describes the meeting point", /meet at one point/.test(C.describe(s)));
}

/* ------------------------------ 2. moves, options, resets and safe input */

{
  const s = C.start();
  const next = C.move(s, "B", P(999, -999));
  check("dragging leaves the old position alone", s.B.x !== next.B.x);
  check("dragging marks the diagram explored", next.explored && !s.explored);
  check("a corner is clamped inside the board",
    next.B.x === C.VIEW.width - C.PAD && next.B.y === C.PAD);
  check("an unknown corner is ignored", C.move(s, "D", P(5, 5)) === s);
  check("a non-finite corner is ignored", C.move(s, "A", P(NaN, 4)) === s);
  check("a dragged corner still has no win or loss", C.result(next) === null);

  const lo = C.setOption(s, "up", -2), hi = C.setOption(s, "angle", 500);
  check("the up slider cannot go below 0 / 0", lo.options.up === 0);
  check("the angle slider cannot pass 95", hi.options.angle === 95);
  check("slider values are read in hundredths and whole degrees",
    C.setOption(s, "up", 0.456).options.up === 0.46
    && C.setOption(s, "angle", 12.9).options.angle === 13);
  check("an unknown option is ignored", C.setOption(s, "nope", 1) === s);
  const changed = C.setOption(C.setOption(s, "names", false), "down", 0.4);
  const reset = C.reset(changed);
  check("Reset restores the applet's three sliders and the name box",
    reset.options.up === 0.3 && reset.options.down === 0.7
    && reset.options.angle === 60 && reset.options.names === false);
  check("Reset keeps the explored mark", reset.explored === true);
  check("the status still works without a state", typeof C.describe({}) === "string");
  check("the core does not touch the DOM", typeof globalThis.document === "undefined");
}

/* --------------------- 3. the page's claim over the whole option range */

{
  const rand = rng(3107);
  const triangles = TRIANGLES.concat([0, 1, 2].map(() =>
    [P(30 + rand() * 360, 30 + rand() * 360),
      P(30 + rand() * 360, 30 + rand() * 360),
      P(30 + rand() * 360, 30 + rand() * 360)]));
  const ups = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const angles = [-85, -60, -40, -15, 5, 30, 45, 60, 75, 85];
  let isotomic = 0, nonIsotomic = 0, failures = 0, counterexamples = 0;
  for (const V of triangles) {
    for (const up of ups) {
      // up = down makes K = L on every side: there is no base to erect on.
      if (up === 0.5) continue;
      const down = Math.round((1 - up) * 100) / 100;
      for (const angle of angles) {
        const g = C.compute(V[0], V[1], V[2], up, down, angle);
        if (!g || !g.valid) continue;
        isotomic++;
        if (!g.claims.isotomic || !g.claims.sameBarycentric
          || !g.claims.isosceles || !g.claims.similar || !g.claims.concurrent
          || g.measures.concurrencyError > g.measures.tol) {
          failures++;
          check(`isotomic up=${up} angle=${angle}: every claim`, false, JSON.stringify(g.measures));
        }
      }
      // A non-isotomic pair: all the small triangles stay similar, but the
      // hypothesis of the page's theorem is gone, and concurrency can fail.
      const wrong = C.compute(V[0], V[1], V[2], up, Math.min(1.05, down + 0.1), 60);
      if (wrong && wrong.valid) {
        nonIsotomic++;
        if (!wrong.claims.isotomic && wrong.measures.concurrencyError > 10 * wrong.measures.tol) {
          counterexamples++;
        }
        if (!wrong.claims.sameBarycentric || !wrong.claims.isosceles || !wrong.claims.similar) {
          failures++;
          check(`non-isotomic up=${up}: bases still similar`, false, JSON.stringify(wrong.measures));
        }
      }
    }
  }
  check(`${isotomic} isotomic configurations satisfy the page's claim`, isotomic > 400 && failures === 0);
  check(`${counterexamples} non-isotomic configurations break concurrency`, counterexamples > 5);
  check("the page's theorem needs its hypothesis (non-isotomic cases were tried)", nonIsotomic > 30);

  // The full side is the applet's Kiepert limit: K=A, L=B, and so on.
  const kiepert = C.compute(TRIANGLES[0][0], TRIANGLES[0][1], TRIANGLES[0][2], 0, 1, 60);
  check("up=0, down=1 gives Kiepert's whole-side bases",
    closePoint(kiepert.K, TRIANGLES[0][0], 1e-9) && closePoint(kiepert.L, TRIANGLES[0][1], 1e-9)
    && closePoint(kiepert.P, TRIANGLES[0][1], 1e-9) && closePoint(kiepert.Q, TRIANGLES[0][2], 1e-9));
  check("the Kiepert limit is still concurrent", kiepert.claims.concurrent);

  // The angles the applet cannot draw: det = 0 at 0 and 90 degrees.
  for (const angle of [0, 90, -90]) {
    const g = C.compute(TRIANGLES[0][0], TRIANGLES[0][1], TRIANGLES[0][2], 0.3, 0.7, angle);
    check(`${angle} degrees has no apex, as in the applet`, g && !g.valid && g.apexes.every((p) => p === null));
  }
  const flat = C.move(C.move(C.start(), "A", P(20, 150)), "B", P(100, 150));
  check("a nearly flat triangle still returns a usable status", typeof C.describe(flat) === "string");
  const coincident = C.compute(TRIANGLES[0][0], TRIANGLES[0][1], TRIANGLES[0][2], 0.5, 0.5, 60);
  check("coincident base points are reported honestly",
    !!coincident && coincident.degenerateBase
    && /no base/.test(C.describe({
      A: TRIANGLES[0][0], B: TRIANGLES[0][1], C: TRIANGLES[0][2],
      options: { up: 0.5, down: 0.5, angle: 60 },
    })));
  check("non-finite input gives no geometry", C.compute(P(NaN, 1), P(2, 3), P(4, 5), 0.3, 0.7, 60) === null);
}

/* ------------------- 4. the same points as the applet's own Compute() */

{
  const rand = rng(1996);
  const ups = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1, 1.05];
  const downs = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1, 1.05];
  const angles = [-90, -75, -60, -45, -30, -15, -5, 0, 5, 15, 30, 45, 60, 75, 85, 90, 95];
  let compared = 0, mismatches = 0, appConcur = 0;
  const compare = (V, up, down, angle) => {
    const g = C.compute(V[0], V[1], V[2], up, down, angle);
    const ap = appCompute(V, up, down, angle);
    if (!g) { mismatches++; return; }
    const tol = 1e-7 * Math.max(1, dist(V[0], V[1]), dist(V[1], V[2]), dist(V[2], V[0]));
    for (let i = 0; i < 3; i++) {
      if (!closePoint(g.Up[i], ap.Up[i], tol) || !closePoint(g.Down[i], ap.Down[i], tol)) {
        mismatches++;
        check(`base point ${i} matches the applet`, false, `up=${up} down=${down} angle=${angle}`);
      }
    }
    for (let i = 0; i < 3; i++) {
      const a = g.apexes[i], b = ap.Napoleons[i];
      if (b && Number.isFinite(b.x) && Number.isFinite(b.y)) {
        if (!closePoint(a, b, tol)) {
          mismatches++;
          check(`apex ${i} matches the applet`, false,
            `applet ${JSON.stringify(b)}, core ${JSON.stringify(a)}`);
        }
      } else if (a !== null) {
        mismatches++;
        check(`apex ${i} is absent when the applet stores NaN`, false);
      }
    }
    if (g.valid && g.showCevians) {
      const t = appIntersect(ap.Napoleons[0], V[0], ap.Napoleons[1], V[1]);
      if (Number.isFinite(t.x) && !closePoint(g.torricelli, t, tol)) {
        mismatches++;
        check("the meeting dot matches the applet's Torricelli point", false);
      }
      if (Math.abs(g.sum - 1) < 1e-9 && Number.isFinite(t.x)) {
        const err = appConcurrency(V, ap.Napoleons);
        if (err <= g.measures.tol) appConcur++;
        else {
          mismatches++;
          check("the applet's own lines are concurrent", false, `error ${err}`);
        }
      }
    }
    compared++;
  };

  for (const V of TRIANGLES) {
    for (const up of ups) {
      for (const down of downs) {
        for (const angle of angles) compare(V, up, down, angle);
      }
    }
  }
  for (let trial = 0; trial < 400; trial++) {
    const V = [P(20 + rand() * 380, 20 + rand() * 260),
      P(20 + rand() * 380, 20 + rand() * 260),
      P(20 + rand() * 380, 20 + rand() * 260)];
    const angle = Math.round(-90 + rand() * 185);
    compare(V, Math.round(rand() * 105) / 100, Math.round(rand() * 105) / 100, angle);
  }
  check(`core and applet agree on ${compared} configurations`, compared > 10000 && mismatches === 0);
  check(`the applet's own transcription is concurrent ${appConcur} times`, appConcur > 400);
  const s0 = C.start();
  const ap = appCompute([s0.A, s0.B, s0.C], 0.3, 0.7, 60);
  const [na, nb, nc] = ap.Napoleons;
  check("the second transcription puts the three apexes on an equilateral triangle at 60 degrees",
    [na, nb, nc].every((p) => Number.isFinite(p.x))
    && close(dist(na, nb), dist(nb, nc), 1e-6) && close(dist(nb, nc), dist(nc, na), 1e-6));
  const dot = appIntersect(na, s0.A, nb, s0.B);
  check("the applet's meeting dot is the centre of the starting circle",
    close(dot.x, C.VIEW.width / 2, 1e-6) && close(dot.y, C.VIEW.height / 2, 1e-6));
}

done("general-napoleon");
