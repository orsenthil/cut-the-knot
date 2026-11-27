#!/usr/bin/env node
"use strict";

/*
 * Logic test for centroids-in-polygon/centroids-in-polygon-core.js.
 *
 *   node porting/check-centroids-in-polygon.mjs
 *
 * Checks the three claims on the applet's page, for every N the panel allows
 * (3..20) and many configurations:
 *
 *   Q[i] is the barycenter of the (N-1)-gon left by dropping P[i];
 *   the N lines P[i]Q[i] meet at G = (P1+...+PN)/N with P[i]G/GQ[i] = N-1;
 *   and Q is homothetic to P at G with coefficient 1/(1-N) (so, for N = 3,
 *   the medians are split 2:1).
 *
 * The applet's own BaryCenter(int), Cycle button and Hint enabling are written
 * a second time straight from the bytecode and compared over the whole option
 * range and hundreds of random polygons.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("centroids-in-polygon/centroids-in-polygon-core.js", "CentroidsInPolygonCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const add = (p, q) => P(p.x + q.x, p.y + q.y);
const mul = (p, k) => P(p.x * k, p.y * k);
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closeP = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);

function distToLine(p, a, b) {
  const d = dist(a, b);
  return d > 0
    ? Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / d
    : dist(p, a);
}

/* ------------------------------ the applet's arithmetic, from the bytecode */

/* CentroidsInPolygonCanvas.BaryCenter(int i):
 *   x=y=0; for j=0..N-1: if j!=i { x += P[j].x; y += P[j].y }
 *   return new DoubPoint(x/(N-1), y/(N-1)) */
function appletBaryCenter(poly, i) {
  let x = 0, y = 0;
  for (let j = 0; j < poly.length; j++) {
    if (j === i) continue;
    x += poly[j].x;
    y += poly[j].y;
  }
  return P(x / (poly.length - 1), y / (poly.length - 1));
}

/* BaryCenter(DoubPoint, DoubPoint), used by DrawHint. */
function appletMidpoint(a, b) {
  return P((a.x + b.x) / 2.0, (a.y + b.y) / 2.0);
}

/* CentroidsInPolygonCanvas.Reset(): with W=400, H=300 the bytecode uses
 * centre (W/2,H/2), radius min(W,H)/4, angle 2*PI*i/N + (PI/N)*random(). */
function appletResetLayout(n, W = 400, H = 300) {
  const r = Math.min(W, H) / 4;
  return Array.from({ length: n }, (_, i) => {
    const angle = ((2 * Math.PI) / n) * i + (Math.PI / n) * 0.5; // any jitter in [0,PI/n]
    return P(W / 2 + r * Math.cos(angle), H / 2 + r * Math.sin(angle));
  });
}

/* CentroidsInPolygonPanel.actionPerformed(): Cycle = (Cycle + 1) % (N + 1);
 * ProcessNumberChange()/actionPerformed() enable Hint only for N==4 and
 * Cycle != 0.  Changing N calls Reset(), which does not touch Cycle or Hint. */
function appletCycle(cycle, n) { return (cycle + 1) % (n + 1); }
function appletHintEnabled(n, cycle) { return cycle !== 0 && n === 4; }
function appletClampN(v) { return Math.max(3, Math.min(20, Math.round(v))); }

/* An independent check of the page's claims, written without the core. */
function pageClaim(poly) {
  const n = poly.length;
  const G = P(
    poly.reduce((s, p) => s + p.x, 0) / n,
    poly.reduce((s, p) => s + p.y, 0) / n,
  );
  const Q = poly.map((_, i) => {
    const others = poly.filter((_, j) => j !== i);
    return P(
      others.reduce((s, p) => s + p.x, 0) / (n - 1),
      others.reduce((s, p) => s + p.y, 0) / (n - 1),
    );
  });
  const scale = Math.max(1, ...poly.map((p) => dist(p, G)));
  const tol = 1e-9 * scale;
  let lineError = 0, ratioError = 0, homothetyError = 0, sideError = 0, between = true;
  for (let i = 0; i < n; i++) {
    lineError = Math.max(lineError, distToLine(G, poly[i], Q[i]));
    const v = sub(Q[i], poly[i]);
    const t = dotP(sub(G, poly[i]), v) / Math.max(dotP(v, v), Number.MIN_VALUE);
    if (t < -1e-9 || t > 1 + 1e-9) between = false;
    const pg = dist(poly[i], G), gq = dist(G, Q[i]);
    if (gq > tol && pg > tol) ratioError = Math.max(ratioError, Math.abs(pg / gq - (n - 1)));
    homothetyError = Math.max(homothetyError, dist(Q[i], add(G, mul(sub(G, poly[i]), 1 / (n - 1)))));
    const j = (i + 1) % n;
    sideError = Math.max(sideError,
      Math.abs(dist(Q[i], Q[j]) * (n - 1) - dist(poly[i], poly[j])));
  }
  return {
    G, Q, lineError, ratioError, homothetyError, sideError, tol,
    concurrent: lineError <= tol && between,
    ratio: ratioError <= 1e-7 * (n - 1),
    homothety: homothetyError <= tol,
    similar: sideError <= tol,
  };
}
function dotP(p, q) { return p.x * q.x + p.y * q.y; }

/* ------------------------------------------------------- 1. start and rules */

{
  const s = C.start({});
  equal("the applet starts with N = 4", s.n, 4);
  equal("Cycle starts at 0", s.cycle, 0);
  check("Hint starts unchecked", !s.hint);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  check("the start diagram has a construction", !!C.geometry(s));
  check("the start diagram satisfies every claim", (() => {
    const c = pageClaim(s.points);
    return c.concurrent && c.ratio && c.homothety && c.similar;
  })());
  const radius = C.RADIUS;
  check("the starting vertices lie on the applet's circle of radius min(W,H)/4",
    s.points.every((p) => close(dist(p, C.CENTER), radius, 1e-9)));
  check("the starting polygon is not empty", s.points.length === 4
    && new Set(s.points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)).size === 4);
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

/* --------------------------------- 2. options: N range, Cycle, Hint, moves */

{
  for (const v of [-100, -1, 0, 1, 2, 2.9, 3, 4, 19, 20, 20.4, 21, 99, NaN, Infinity, -Infinity]) {
    const expected = Number.isFinite(v) ? appletClampN(v) : 4;
    equal(`N ${v} is clamped to ${expected}`, C.setN(C.start(), v).n, expected);
  }
  const unchangedState = C.start();
  check("an unchanged N leaves the state alone", C.setN(unchangedState, 4) === unchangedState);
  const four = C.setHint(C.cycle(C.start()), true);
  const changed = C.setN(four, 7);
  check("changing N keeps Cycle and Hint as the applet does",
    changed.cycle === four.cycle && changed.hint === four.hint && changed.n === 7 && changed.explored);
  check("changing N rebuilds the vertices", changed.points.length === 7
    && changed.points.every((p) => close(dist(p, C.CENTER), C.RADIUS, 1e-9)));
  check("changing N back rebuilds four vertices", C.setN(changed, 4).points.length === 4);
  const r = C.reset(changed);
  check("Reset keeps Cycle and Hint but rebuilds the vertices",
    r.cycle === changed.cycle && r.hint === changed.hint && r.points.length === 7);
}

{
  /* Exhaustively: every starting Cycle for every N, two full turns of the
   * button, against the panel's own (Cycle+1) % (N+1). */
  let cycles = 0, mismatches = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (let from = 0; from <= n + 2; from++) {
      let s = C.setN(C.start(), n);
      s = Object.assign({}, s, { cycle: from });
      for (let k = 0; k < 2 * (n + 1); k++) {
        s = C.cycle(s);
        cycles++;
        if (s.cycle < 0 || s.cycle > n) mismatches++;
      }
    }
  }
  check(`the Cycle button stays in 0..N over ${cycles} presses`, mismatches === 0);

  /* Now an exact step-by-step comparison, including the wrap from N back to 0. */
  let bad = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (let from = 0; from <= n + 1; from++) {
      let s = Object.assign({}, C.setN(C.start(), n), { cycle: from });
      let expected = from;
      for (let k = 0; k < n + 3; k++) {
        s = C.cycle(s);
        expected = appletCycle(expected, n);
        if (s.cycle !== expected) bad++;
      }
    }
  }
  check("Cycle advances exactly as (Cycle+1) % (N+1) for every N and start", bad === 0);
}

{
  /* Hint enabling is exhaustive too: N x Cycle x both checkbox states. */
  let tested = 0, bad = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (let cycle = 0; cycle <= n + 2; cycle++) {
      const s = Object.assign({}, C.setN(C.start(), n), { cycle: cycle });
      const want = appletHintEnabled(n, cycle);
      if (C.hintEnabled(s) !== want) bad++;
      const on = C.setHint(s, true);
      if (on.hint !== (want ? true : false)) bad++;
      const off = C.setHint(on, false);
      if (want && off.hint) bad++;
      tested++;
    }
  }
  check(`Hint enabling matches the panel on all ${tested} N/Cycle pairs`, bad === 0);
  check("Hint is off at Cycle 0 even for a 4-gon", !C.setHint(C.start(), true).hint);
  check("Hint is off for a triangle with Cycle on",
    !C.setHint(Object.assign({}, C.start(), { n: 3, cycle: 1 }), true).hint);
  check("Cycle and Hint both mark the diagram explored",
    C.cycle(C.start()).explored && C.setHint(C.cycle(C.start()), true).explored);
}

{
  const s = C.start();
  const moved = C.movePoint(s, 0, P(9999, -9999));
  check("a dragged vertex is clamped inside the board",
    moved.points[0].x === C.VIEW.width - C.PAD && moved.points[0].y === C.PAD);
  check("a drag marks the diagram explored and leaves the old one alone",
    moved.explored && !s.explored && s.points[0].x !== moved.points[0].x);
  check("an unknown vertex is ignored", C.movePoint(s, 99, P(5, 5)) === s);
  check("a non-finite vertex is ignored", C.movePoint(s, 0, P(NaN, 4)) === s);
  check("a drag still satisfies the page's claim", (() => {
    const g = pageClaim(moved.points);
    return g.concurrent && g.ratio && g.homothety && g.similar;
  })());
  check("the status tells the player what the picture shows",
    /4 lines meet at one dot/.test(C.describe(s)) && /3 to 1/.test(C.describe(s)));
  check("the status names the picked vertex when Cycle is on",
    /Vertex 1 is picked out/.test(C.describe(C.cycle(s))));
  check("the status mentions the medians when Hint is on",
    /medians/.test(C.describe(C.setHint(C.cycle(s), true))));
  const collapsed = Object.assign({}, s, {
    points: s.points.map(() => P(C.CENTER.x, C.CENTER.y)),
  });
  check("a collapsed diagram gets a helpful status", /Pull a corner/.test(C.describe(collapsed)));
}

/* ---------------------------- 3. N = 3: the medians of a triangle, 2:1 */

{
  const tri = [P(60, 230), P(340, 210), P(180, 40)];
  const s = Object.assign({}, C.setN(C.start(), 3), { points: tri });
  const g = C.geometry(s);
  const claim = pageClaim(tri);
  check("a triangle has three Q points", g.Q.length === 3);
  check("each Q is the midpoint of the opposite side",
    g.Q.every((q, i) => closeP(q, mid(tri[(i + 1) % 3], tri[(i + 2) % 3]), 1e-9)));
  check("a triangle's three medians are concurrent", g.claims.concurrent && claim.concurrent);
  check("a triangle's medians are split 2:1", g.claims.ratio && claim.ratio
    && close(g.measures.ratioError, 0, 1e-9));
  check("the triangle's centroid is the mean of its corners", closeP(g.G, claim.G, 1e-9));
  check("the independent page claim holds for the triangle",
    claim.concurrent && claim.ratio && claim.homothety && claim.similar);
}

/* ------------------- 4. the whole claim, for every N and many polygons */

{
  const rand = rng(3062);
  const families = [];
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    families.push([`regular ${n}-gon`, C.setN(C.start(), n).points]);
    families.push([`applet Reset layout ${n}`, appletResetLayout(n)]);
    // A regular polygon scaled/translated: the claim is affine.
    const base = C.setN(C.start(), n).points;
    families.push([`scaled ${n}-gon`, base.map((p) => P(1.7 * p.x - 80, 0.6 * p.y + 45))]);
    // A deliberately lopsided polygon.
    families.push([`lopsided ${n}-gon`, base.map((p, i) => P(p.x + 40 * Math.sin(i), p.y + 22 * Math.cos(2 * i)))]);
  }
  let cases = 0, bad = 0;
  const verify = (label, poly, cycle = 0, hint = false) => {
    const s = Object.assign({}, C.setN(C.start(), poly.length), {
      points: poly, cycle: cycle, hint: hint,
    });
    const g = C.geometry(s);
    const claim = pageClaim(poly);
    cases++;
    if (!g) { bad++; check(`${label}: core builds a geometry`, false); return; }
    if (!(g.claims.concurrent && g.claims.ratio && g.claims.homothety)) {
      bad++; check(`${label}: core claims hold`, false, JSON.stringify(g.claims));
    }
    if (!(claim.concurrent && claim.ratio && claim.homothety && claim.similar)) {
      bad++; check(`${label}: independent page claims hold`, false, JSON.stringify(claim));
    }
    if (!closeP(g.G, claim.G, claim.tol)) { bad++; check(`${label}: G agrees`, false); }
    if (!g.Q.every((q, i) => closeP(q, claim.Q[i], claim.tol))) {
      bad++; check(`${label}: Q agrees`, false);
    }
    if (!close(g.measures.homothetyError, 0, claim.tol)) {
      bad++; check(`${label}: homothety error`, false);
    }
  };
  for (const [label, poly] of families) verify(label, poly);
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (let trial = 0; trial < 60; trial++) {
      const poly = Array.from({ length: n }, () => P(20 + rand() * 360, 20 + rand() * 260));
      verify(`random ${n}-gon ${trial}`, poly, trial % (n + 1), trial % 2 === 0);
    }
  }
  check(`the page's three claims hold on ${cases} polygons, N = 3..20`, bad === 0);

  /* An independent, direct test of the similarity statement: corresponding
   * sides of P and Q differ by exactly the factor 1/(N-1). */
  let worst = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    const poly = C.setN(C.start(), n).points;
    const q = poly.map((_, i) => appletBaryCenter(poly, i));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const error = Math.abs(dist(q[i], q[j]) * (n - 1) - dist(poly[i], poly[j]));
      worst = Math.max(worst, error);
    }
  }
  check("Q is similar to P in every N, with scale 1/(N-1)", worst < 1e-9, `worst ${worst}`);

  /* The fixed point of the homothety is G, and its coefficient is 1/(1-N). */
  let coefficientError = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    const poly = C.setN(C.start(), n).points;
    const G = P(
      poly.reduce((s, p) => s + p.x, 0) / n,
      poly.reduce((s, p) => s + p.y, 0) / n,
    );
    for (let i = 0; i < n; i++) {
      const q = appletBaryCenter(poly, i);
      const v = sub(poly[i], G), w = sub(q, G);
      const k = Math.abs(v.x) > Math.abs(v.y) ? w.x / v.x : w.y / v.y;
      coefficientError = Math.max(coefficientError, Math.abs(k + 1 / (n - 1)));
    }
  }
  check("the homothety is about G with coefficient 1/(1-N) for every N",
    coefficientError < 1e-9, `worst ${coefficientError}`);
}

/* ------------------- 5. second transcription of the applet's computation */

{
  const rand = rng(1994);
  let compared = 0, mismatches = 0;
  const compare = (label, poly, cycle) => {
    const s = Object.assign({}, C.setN(C.start(), poly.length), { points: poly, cycle: cycle });
    const g = C.geometry(s);
    if (!g) return;
    const tol = 1e-9 * Math.max(1, ...poly.map((p) => dist(p, g.G)));
    for (let i = 0; i < poly.length; i++) {
      const want = appletBaryCenter(poly, i); // straight from BaryCenter(int)
      if (!closeP(g.Q[i], want, tol)) {
        mismatches++;
        check(`${label}: Q[${i}] matches the applet's BaryCenter`, false,
          `applet ${JSON.stringify(want)}, core ${JSON.stringify(g.Q[i])}`);
      }
    }
    // DrawPolys(Cycle-1) skips that vertex; DrawHint uses three midpoints.
    if (cycle !== 0) {
      const skip = (cycle - 1) % poly.length;
      const rest = [];
      for (let k = 1; k < poly.length; k++) rest.push(poly[(skip + k) % poly.length]);
      if (!g.highlighted || g.highlighted.index !== skip
        || g.highlighted.polygon.length !== rest.length
        || !rest.every((p, k) => closeP(p, g.highlighted.polygon[k], tol))) {
        mismatches++;
        check(`${label}: the highlighted (N-1)-gon matches DrawPolys`, false);
      }
      if (poly.length === 4) {
        const a = (skip + 1) % 4, b = (skip + 2) % 4, c = (skip + 3) % 4;
        const want = [
          [appletMidpoint(poly[a], poly[b]), poly[c]],
          [appletMidpoint(poly[b], poly[c]), poly[a]],
          [appletMidpoint(poly[c], poly[a]), poly[b]],
        ];
        const got = g.highlighted.hintLines || [];
        if (got.length !== 3 || !want.every((line, k) =>
          closeP(line[0], got[k][0], tol) && closeP(line[1], got[k][1], tol))) {
          mismatches++;
          check(`${label}: the Hint medians match DrawHint`, false);
        }
      }
    } else if (g.highlighted) {
      mismatches++;
      check(`${label}: Cycle 0 highlights nothing`, false);
    }
    compared++;
  };
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    const poly = C.setN(C.start(), n).points;
    for (let cycle = 0; cycle <= n; cycle++) compare(`Reset layout ${n}, Cycle ${cycle}`, poly, cycle);
  }
  for (let trial = 0; trial < 400; trial++) {
    const n = 3 + (trial % 18);
    const poly = Array.from({ length: n }, () => P(20 + rand() * 360, 20 + rand() * 260));
    compare(`random ${trial}`, poly, trial % (n + 1));
  }
  check(`core and applet bytecode agree on ${compared} configurations`, mismatches === 0);

  /* The core's snapshot keeps plain data, including G and every Q. */
  const snap = C.snapshot(C.cycle(C.start()));
  check("a snapshot is plain data for Track.state()",
    snap.n === 4 && snap.points.length === 4 && snap.Q.length === 4
    && closeP(snap.G, C.geometry(C.cycle(C.start())).G, 1e-9)
    && JSON.stringify(snap.claims) === JSON.stringify(C.geometry(C.cycle(C.start())).claims));
}

/* ------------------------------- 6. safe handling of degenerate positions */

{
  check("non-finite vertices give no geometry",
    C.geometry(Object.assign({}, C.start(), { points: [P(NaN, 1), P(2, 3), P(4, 5), P(6, 7)] })) === null);
  check("a wrong number of vertices gives no geometry",
    C.geometry(Object.assign({}, C.start(), { points: [P(1, 1)] })) === null);
  const coincident = Object.assign({}, C.start(), {
    points: [P(200, 150), P(100, 100), P(300, 100), P(200, 250)],
  });
  const g = C.geometry(coincident);
  check("one vertex at the centre is reported as degenerate", g && g.degenerate);
  check("a degenerate diagram still has no result", C.result(coincident) === null);
  check("describe works without a geometry", typeof C.describe({}) === "string");
}

done("centroids-in-polygon");
