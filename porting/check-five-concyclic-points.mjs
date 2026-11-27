#!/usr/bin/env node
"use strict";

/*
 * Logic test for five-concyclic-points/five-concyclic-points-core.js.
 *
 *   node porting/check-five-concyclic-points.mjs
 *
 * The page's exact claim is that Q, M3, N3 (where circle (O) meets MN) and
 * M4, N4 (the second intersections of circles MQX, NQX with QLm, QLn) are
 * concyclic. Its preliminary claim is that M1, M2, N1, N2 are concyclic on
 * (O). Both are checked at the start position, on a sweep of each handle and
 * on 1600 jittered configurations. The radical-axis statement in the page's
 * proof is checked too: Y = MN n QLm and Z = MN n QLn have equal powers with
 * respect to circles (O) and the five-point circle.
 *
 * The second half is an independent transcription of the applet's bytecode:
 * line crossing by vector parameters, the circumcenter from two bisector
 * equations, circle-line cuts by projecting the centre onto the line, and
 * Compute's exact order of operations. It is compared with the core at every
 * configuration in the sweep and the random family.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("five-concyclic-points/five-concyclic-points-core.js", "FiveConcyclicPointsCore");
const W = C.WIDTH, H = C.HEIGHT;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a, b) => a.x * b.y - a.y * b.x;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, t) => ({ x: t * a.x, y: t * a.y });
const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const samePoint = (p, q, tol = 1e-6) => finite(p) && finite(q) &&
  Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const onCircle = (p, c, tol = 1e-6) => finite(p) && finite(c.center) &&
  near(dist(p, c.center), c.radius, tol);
const power = (p, c) => dist(p, c.center) ** 2 - c.radius ** 2;

/* ------------------------- a second, independent transcription of the applet */

/** Vector-parameter version of GeoSDoub.Intersect(p1,p2,p3,p4). */
function refIntersect(p1, p2, p3, p4) {
  const r = sub(p2, p1), s = sub(p4, p3);
  const denominator = cross(r, s);
  if (Math.abs(denominator) < 1) return { x: NaN, y: NaN };
  const t = cross(sub(p3, p1), s) / denominator;
  return add(p1, mul(r, t));
}

/** The circumcenter from the two perpendicular-bisector equations. */
function refCircumcenter(a, b, c) {
  const r = sub(b, a), s = sub(c, b);
  const rhs1 = (b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y) / 2;
  const rhs2 = (c.x * c.x + c.y * c.y - b.x * b.x - b.y * b.y) / 2;
  const det = cross(r, s);
  if (Math.abs(det) < 1e-12) return { x: NaN, y: NaN };
  return {
    x: (rhs1 * s.y - rhs2 * r.y) / det,
    y: (r.x * rhs2 - s.x * rhs1) / det,
  };
}

/** FiveConcyclicPointsCanvas.GetCircle. */
function refCircle(a, b, c) {
  const center = refCircumcenter(a, b, c);
  return { center, radius: (dist(center, a) + dist(center, b) + dist(center, c)) / 3 };
}

/** GeoSDoub.Intersect(circle,line), via foot of the perpendicular; same root order. */
function refCircleLine(circle, a, b) {
  const centre = circle.center;
  const d = sub(b, a);
  const len = Math.hypot(d.x, d.y);
  if (len < 1e-12 || !Number.isFinite(circle.radius)) return null;
  const unit = { x: d.x / len, y: d.y / len };
  const along = (centre.x - a.x) * unit.x + (centre.y - a.y) * unit.y;
  const foot = add(a, mul(unit, along));
  const perpendicular = (centre.x - foot.x) ** 2 + (centre.y - foot.y) ** 2;
  const halfChordSq = circle.radius * circle.radius - perpendicular;
  if (halfChordSq < 0) return null;
  const h = Math.sqrt(halfChordSq);
  const candidates = [add(foot, mul(unit, h)), add(foot, mul(unit, -h))];
  // IntersectX lists the root with the larger y first; IntersectY the larger
  // x. The applet's line endpoints need not point that way.
  const key = Math.abs(a.y - b.y) > 1 ? "y" : "x";
  return candidates[0][key] >= candidates[1][key] ? candidates : candidates.reverse();
}

function refOther(hits, known) {
  if (!hits) return null;
  return dist(hits[0], known) >= 1 ? hits[0] : hits[1];
}

/** Canvas.Compute, rearranged but using only the reference helpers. */
function refGeometry(s) {
  const { M, N, P, Q, Lm, Ln } = s;
  const X = refIntersect(M, N, P, Q);
  const MPX = refCircle(M, P, X);
  const NPX = refCircle(N, P, X);
  const MQX = refCircle(M, Q, X);
  const NQX = refCircle(N, Q, X);
  const Mm = refCircleLine(MPX, Q, Lm);
  const Nn = refCircleLine(NPX, Q, Ln);
  if (!Mm || !Nn || !finite(X) || !finite(MPX.center) || !finite(NPX.center) ||
      !finite(MQX.center) || !finite(NQX.center)) {
    return { X, MPX, NPX, MQX, NQX, Mm, Nn, valid: false };
  }
  const CircleO = dist(Mm[0], Mm[1]) > 2
    ? refCircle(Mm[0], Mm[1], Nn[0])
    : refCircle(Nn[0], Nn[1], Mm[0]);
  const S = refCircleLine(CircleO, M, N);
  const U = refOther(refCircleLine(MQX, Q, Lm), Q);
  const V = refOther(refCircleLine(NQX, Q, Ln), Q);
  const CircleQ = S ? refCircle(Q, S[0], S[1]) : null;
  return {
    X, MPX, NPX, MQX, NQX, Mm, Nn, CircleO, CircleQ, S,
    M3: S && S[0], N3: S && S[1], M4: U, N4: V,
    Y: refIntersect(Q, Lm, M, N), Z: refIntersect(Q, Ln, M, N),
    valid: !!S && !!CircleQ && finite(U) && finite(V),
  };
}

function compare(g, r, label) {
  const pts = ["X", "M3", "N3", "M4", "N4", "Mm0", "Mm1", "Nn0", "Nn1", "Y", "Z",
    "MPX.c", "NPX.c", "MQX.c", "NQX.c", "CircleO.c", "CircleQ.c"];
  const gp = {
    X: g.X, M3: g.M3, N3: g.N3, M4: g.M4, N4: g.N4, Mm0: g.Mm && g.Mm[0],
    Mm1: g.Mm && g.Mm[1], Nn0: g.Nn && g.Nn[0], Nn1: g.Nn && g.Nn[1],
    Y: g.Y, Z: g.Z, "MPX.c": g.MPX.center, "NPX.c": g.NPX.center,
    "MQX.c": g.MQX.center, "NQX.c": g.NQX.center,
    "CircleO.c": g.CircleO && g.CircleO.center, "CircleQ.c": g.CircleQ && g.CircleQ.center,
  };
  const rp = {
    X: r.X, M3: r.M3, N3: r.N3, M4: r.M4, N4: r.N4, Mm0: r.Mm && r.Mm[0],
    Mm1: r.Mm && r.Mm[1], Nn0: r.Nn && r.Nn[0], Nn1: r.Nn && r.Nn[1],
    Y: r.Y, Z: r.Z, "MPX.c": r.MPX.center, "NPX.c": r.NPX.center,
    "MQX.c": r.MQX.center, "NQX.c": r.NQX.center,
    "CircleO.c": r.CircleO && r.CircleO.center, "CircleQ.c": r.CircleQ && r.CircleQ.center,
  };
  for (const key of pts) {
    if ((!gp[key] && !rp[key]) ||
        (gp[key] && rp[key] && samePoint(gp[key], rp[key], 2e-6))) continue;
    return `${label}: ${key} differs`;
  }
  const radii = ["MPX", "NPX", "MQX", "NQX", "CircleO", "CircleQ"];
  for (const key of radii) {
    if (!g[key] || !r[key]) {
      if (!!g[key] !== !!r[key]) return `${label}: ${key} presence differs`;
      continue;
    }
    if (!near(g[key].radius, r[key].radius, 2e-6)) return `${label}: ${key}.radius differs`;
  }
  if (g.valid !== r.valid) return `${label}: validity differs`;
  return null;
}

/* --------------------------------------------- 1. the applet's own constants */

{
  equal("the board matches the page's 500 x 420 drawing area", [W, H], [500, 420]);
  equal("the six draggable points are the applet's", C.NAMES,
    ["M", "N", "P", "Q", "Lm", "Ln"]);
  const s = C.start();
  check("M is (3W/5, 4H/5), N is (W/5, H/5)",
    samePoint(s.M, { x: 300, y: 336 }) && samePoint(s.N, { x: 100, y: 84 }));
  check("P is (3W/5, H/4), Q is (W/4, 4H/5)",
    samePoint(s.P, { x: 300, y: 105 }) && samePoint(s.Q, { x: 125, y: 336 }));
  check("Lm is (5W/6, H/6), Ln is (W/2, H/6)",
    samePoint(s.Lm, { x: 416.6666666667, y: 70 }) && samePoint(s.Ln, { x: 250, y: 70 }));
  check("the six starting points are plain, distinct, finite data",
    C.NAMES.every((n) => finite(s[n])) &&
    new Set(C.NAMES.map((n) => `${s[n].x},${s[n].y}`)).size === 6);
}

/* ------------------------------------------- 2. state changes and the record */

{
  const s = C.start();
  const moved = C.setPoint(s, "P", { x: 220, y: 130 });
  check("setPoint moves only the named point and leaves the old state alone",
    samePoint(moved.P, { x: 220, y: 130 }) && samePoint(s.P, { x: 300, y: 105 }) &&
    C.NAMES.filter((n) => n !== "P").every((n) => samePoint(s[n], moved[n])) && moved !== s);
  check("dragging past the edge clamps into the board",
    samePoint(C.setPoint(s, "Q", { x: -50, y: 999 }).Q, { x: C.EDGE, y: H - C.EDGE }) &&
    samePoint(C.setPoint(s, "Q", { x: 999, y: -50 }).Q, { x: W - C.EDGE, y: C.EDGE }));
  check("an unknown handle name restarts the diagram",
    samePoint(C.setPoint(s, "Z", { x: 1, y: 1 }).M, C.START.M));
  const p = C.position(s);
  check("the saved position is JSON-safe and holds all six points",
    JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))) &&
    C.NAMES.every((n) => finite(p[n]) && samePoint(p[n], s[n], 1e-4)));
}

/* --------------------------------------- 3. the start diagram and its claims */

{
  const g = C.geometry(C.start());
  check("the starting configuration is non-degenerate", g.valid && finite(g.X) &&
    finite(g.CircleO.center) && finite(g.CircleQ.center));
  check("X lies on both MN and PQ",
    Math.abs(cross(sub(g.X, C.START.M), sub(C.START.N, C.START.M))) < 1e-6 &&
    Math.abs(cross(sub(g.X, C.START.P), sub(C.START.Q, C.START.P))) < 1e-6);
  check("the four auxiliary circles pass through their three defining points",
    [g.MPX, g.NPX, g.MQX, g.NQX].every((c) => c.radius > 0) &&
    onCircle(C.START.M, g.MPX) && onCircle(C.START.P, g.MPX) && onCircle(g.X, g.MPX) &&
    onCircle(C.START.N, g.NPX) && onCircle(C.START.P, g.NPX) && onCircle(g.X, g.NPX) &&
    onCircle(C.START.M, g.MQX) && onCircle(C.START.Q, g.MQX) && onCircle(g.X, g.MQX) &&
    onCircle(C.START.N, g.NQX) && onCircle(C.START.Q, g.NQX) && onCircle(g.X, g.NQX));
  check("M1, M2, N1, N2 lie on circle (O) at the start (page's 'of course')",
    g.auxGap < 1e-8);
  check("M3 and N3 lie on both MN and circle (O)",
    Math.abs(cross(sub(g.M3, C.START.M), sub(C.START.N, C.START.M))) < 1e-6 &&
    Math.abs(cross(sub(g.N3, C.START.M), sub(C.START.N, C.START.M))) < 1e-6 &&
    onCircle(g.M3, g.CircleO) && onCircle(g.N3, g.CircleO));
  check("M4 is on QLm and circle MQX but is not Q",
    Math.abs(cross(sub(g.M4, C.START.Q), sub(C.START.Lm, C.START.Q))) < 1e-6 &&
    onCircle(g.M4, g.MQX) && dist(g.M4, C.START.Q) > 1);
  check("N4 is on QLn and circle NQX but is not Q",
    Math.abs(cross(sub(g.N4, C.START.Q), sub(C.START.Ln, C.START.Q))) < 1e-6 &&
    onCircle(g.N4, g.NQX) && dist(g.N4, C.START.Q) > 1);
  check("the five named points Q, M3, N3, M4, N4 are concyclic at the start",
    [C.START.Q, g.M3, g.N3, g.M4, g.N4].every((p) => onCircle(p, g.CircleQ)) &&
    g.gap < 1e-8);
  check("Y and Z lie on MN, and have equal powers for (O) and the five-point circle",
    Math.abs(cross(sub(g.Y, C.START.M), sub(C.START.N, C.START.M))) < 1e-6 &&
    Math.abs(cross(sub(g.Z, C.START.M), sub(C.START.N, C.START.M))) < 1e-6 &&
    near(power(g.Y, g.CircleO), power(g.Y, g.CircleQ), 1e-9) &&
    near(power(g.Z, g.CircleO), power(g.Z, g.CircleQ), 1e-9));
}

/* ------------------------------- 4. each handle swept over its own range */

{
  let allValid = true, fiveOk = true, fourOk = true, radicalsOk = true;
  let worstFive = 0, worstFour = 0, comparisons = 0, mismatch = null;
  for (const name of C.NAMES) {
    for (let dx = -30; dx <= 30; dx += 5) {
      const state = C.setPoint(C.start(), name, { x: C.START[name].x + dx, y: C.START[name].y + dx / 2 });
      const g = C.geometry(state);
      const r = refGeometry(state);
      mismatch = mismatch || compare(g, r, `${name} dx=${dx}`);
      comparisons++;
      if (!g.valid) { allValid = false; continue; }
      const s = state;
      worstFive = Math.max(worstFive, g.gap);
      worstFour = Math.max(worstFour, g.auxGap);
      fiveOk = fiveOk && [s.Q, g.M3, g.N3, g.M4, g.N4].every((p) => onCircle(p, g.CircleQ, 1e-5));
      fourOk = fourOk && [g.Mm[0], g.Mm[1], g.Nn[0], g.Nn[1]]
        .every((p) => onCircle(p, g.CircleO, 1e-5));
      radicalsOk = radicalsOk &&
        near(power(g.Y, g.CircleO), power(g.Y, g.CircleQ), 1e-7) &&
        near(power(g.Z, g.CircleO), power(g.Z, g.CircleQ), 1e-7);
    }
  }
  check("every single-handle sweep configuration stays non-degenerate", allValid);
  check("the second transcription agrees with the core along all 78 sweeps",
    !mismatch && comparisons === 78, mismatch || "");
  check("the five-point claim holds along every single-handle sweep", fiveOk,
    `worst gap ${worstFive.toExponential(2)}`);
  check("the four first intersections stay concyclic along every sweep", fourOk,
    `worst gap ${worstFour.toExponential(2)}`);
  check("Y and Z remain on the radical axis of the two key circles", radicalsOk);
}

/* --------------------------------- 5. 1600 configurations, random but reproducible */

{
  const random = rng(4882);
  let valid = 0, comparisons = 0, mismatch = null;
  let worstFive = 0, worstFour = 0, fiveOk = true, fourOk = true, radicalsOk = true;
  let crossedO = 0;
  for (let i = 0; i < 1600; i++) {
    const spread = i < 1400 ? 30 : 60;
    const state = C.start();
    for (const name of C.NAMES) {
      state[name] = {
        x: C.START[name].x + (random() - 0.5) * 2 * spread,
        y: C.START[name].y + (random() - 0.5) * 2 * spread,
      };
    }
    const g = C.geometry(state);
    const r = refGeometry(state);
    mismatch = mismatch || compare(g, r, `random ${i}`);
    comparisons++;
    if (!g.valid) continue;
    valid++;
    worstFive = Math.max(worstFive, g.gap);
    worstFour = Math.max(worstFour, g.auxGap);
    fiveOk = fiveOk && [state.Q, g.M3, g.N3, g.M4, g.N4]
      .every((p) => onCircle(p, g.CircleQ, 1e-5));
    fourOk = fourOk && [g.Mm[0], g.Mm[1], g.Nn[0], g.Nn[1]]
      .every((p) => onCircle(p, g.CircleO, 1e-5));
    radicalsOk = radicalsOk &&
      near(power(g.Y, g.CircleO), power(g.Y, g.CircleQ), 1e-7) &&
      near(power(g.Z, g.CircleO), power(g.Z, g.CircleQ), 1e-7);
    // The page says M3, N3 are the intersections of (O) with L1; the applet
    // actually chooses (O) from the longer of the two secants. Count both.
    crossedO = crossedO + (onCircle(g.M3, g.CircleO, 1e-5) &&
      onCircle(g.N3, g.CircleO, 1e-5) ? 1 : 0);
  }
  check("the second transcription matches the core in all 1600 configurations",
    !mismatch && comparisons === 1600, mismatch || "");
  check("the page's concyclic claim holds at every valid random configuration",
    valid > 1550 && fiveOk, `${valid} valid configurations, worst gap ${worstFive.toExponential(2)}`);
  check("M1, M2, N1, N2 stay concyclic on (O) in every valid case",
    fourOk, `worst gap ${worstFour.toExponential(2)}`);
  check("M3, N3 are where (O) cuts MN in every valid case", crossedO === valid);
  check("the radical-axis claim of the proof holds in every valid case", radicalsOk);
}

/* ---------------------------------------------------- 6. degenerate diagrams */

{
  const flat = {
    M: { x: 100, y: 100 }, N: { x: 400, y: 100 },
    P: { x: 100, y: 300 }, Q: { x: 400, y: 300 },
    Lm: { x: 300, y: 50 }, Ln: { x: 200, y: 350 },
  };
  const g = C.geometry(flat);
  check("parallel lines MN and PQ give no finite X and are reported invalid",
    !finite(g.X) && !g.valid);
  const same = C.start();
  for (const name of C.NAMES) same[name] = { x: 200, y: 200 };
  check("six coincident handles are reported invalid without throwing",
    C.geometry(same).valid === false);
  check("the core exposes no winning or losing result: this is a demo",
    !("result" in C) && !("move" in C));
}

done("five-concyclic-points");
