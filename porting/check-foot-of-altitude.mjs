#!/usr/bin/env node
"use strict";

/*
 * Logic test for foot-of-altitude/foot-of-altitude-core.js.
 *
 *   node porting/check-foot-of-altitude.mjs
 *
 * The first section checks the move/option rules. The second transcribes the
 * applet's own GeoSDoub.NearestPoint / FindCircumcenter / Intersect, Compute,
 * ComputeMinimum and CheckFinished a second time straight from the bytecode and
 * compares them with the core over a grid of triangles and D positions plus a
 * seeded random sample. The third section tests every claim on the cut-the-knot
 * page: the minimum at the foot of the altitude, EF = AD sin(angle EDF), the
 * fixed angle, the circle with diameter AD, the right-angle case, and the page's
 * rejection of Honsberger's obtuse-base exception.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("foot-of-altitude/foot-of-altitude-core.js", "FootOfAltitudeCore");

/* --------------------------------------- a second transcription of the applet */

const A = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const S = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const M = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const L = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const SQ = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const H = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/** GeoSDoub.NearestPoint(DoubPoint p, a, b), from the raw bytecode. */
function apNearest(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (SQ(a, p) < 0.1) return { x: p.x, y: p.y };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** GeoSDoub.Intersect(p1,p2,p3,p4): |det| < 1 gives (NaN, NaN). */
function apIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y;
  const b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y;
  const b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.FindCircumcenter(a,b,c) — two perpendicular bisectors. */
function apCenter(a, b, c) {
  const m1 = H(a, b), m2 = H(b, c);
  const u = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const v = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  return apIntersect(m1, u, m2, v);
}

/** The applet's Compute(), ComputeMinimum() and GetCircumcircle() in one go. */
function apCompute(A0, B0, C0, D0) {
  const E = apNearest(D0, A0, C0);
  const F = apNearest(D0, A0, B0);
  const foot = apNearest(A0, B0, C0);                // ComputeMinimum's local 1
  const Emin = apNearest(foot, A0, C0);              // local 2
  const Fmin = apNearest(foot, A0, B0);              // local 3
  const minimum = L(Emin, Fmin);
  const current = L(E, F);
  const center = apCenter(A0, E, F);
  const ok = Number.isFinite(center.x) && Number.isFinite(center.y);
  const circle = ok
    ? { center, radius: (L(center, A0) + L(center, E) + L(center, F)) / 3 }
    : null;
  return {
    E, F, foot, Emin, Fmin, minimum, current, circle,
    finished: L(foot, D0) < 1,                       // CheckFinished
    center: { x: Math.round((A0.x + B0.x + C0.x) / 3), y: Math.round((A0.y + B0.y + C0.y) / 3) },
  };
}

function same(p, q, tol = 1e-9) {
  return !!p && !!q && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
}
function sameNum(a, b, tol = 1e-9) {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

/* ------------------------------------------------------- configurations tested */

const tri = (a, b, cx) => ({
  ...C.start(),
  A: { x: a.x, y: a.y },
  B: { x: b, y: (C.HEIGHT * 5) / 6 },
  C: { x: cx, y: (C.HEIGHT * 5) / 6 },
  D: { x: b + (cx - b) * 0.37, y: (C.HEIGHT * 5) / 6 },
});

const triangles = [];
for (const ax of [20, 60, 100, 150, 200, 250, 300, 350, 390]) {
  for (const ay of [15, 40, 80, 120, 160, 195]) {
    for (const bx of [20, 90, 170, 250, 380]) {
      for (const cx of [20, 90, 170, 250, 380]) {
        if (Math.abs(cx - bx) < 25) continue;
        triangles.push(tri({ x: ax, y: ay }, bx, cx));
      }
    }
  }
}
const next = rng(20261127);
for (let i = 0; i < 1200; i++) {
  const bx = 15 + next() * 370, cx = 15 + next() * 370;
  if (Math.abs(cx - bx) < 30) continue;
  triangles.push(tri({ x: 15 + next() * 370, y: 12 + next() * 190 }, bx, cx));
}
const positions = [];
for (const s of triangles) {
  for (const dx of [8, 40, 90, 150, 220, 300, 370, 392]) {
    positions.push({ ...s, D: { x: dx, y: s.D.y } });
  }
}

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  check("the opening A is at width/1.8 and height/5",
    same(s.A, { x: C.WIDTH / 1.8, y: C.HEIGHT / 5 }));
  check("the opening B is at width/6 and 5*height/6",
    same(s.B, { x: C.WIDTH / 6, y: (C.HEIGHT * 5) / 6 }));
  check("the opening C is at 5*width/6, level with B",
    same(s.C, { x: (5 * C.WIDTH) / 6, y: s.B.y }));
  check("the opening D is halfway along BC", same(s.D, H(s.B, s.C)));
  check("names are on and the other two switches are off at the start",
    s.showNames === true && s.showPremise === false && s.showHint === false);
  check("the demo has not been explored yet", C.result(s) === null);
  equal("legal moves cover four points, three switches and reset", C.legalMoves(s).length, 8);

  const moved = C.move(s, { type: "point", name: "A", point: { x: 300, y: 70 } });
  check("dragging A moves only A",
    moved && same(moved.A, { x: 300, y: 70 }) && same(moved.B, s.B) && same(moved.C, s.C));
  check("a horizontal handle keeps its y as B, C and D did in the applet",
    C.move(s, { type: "point", name: "D", point: { x: 250, y: 40 } }).D.y === s.D.y);
  const outside = C.move(s, { type: "point", name: "A", point: { x: 9999, y: -9999 } });
  check("a point dragged off the board is kept inside it",
    outside && outside.A.x === C.WIDTH - C.MARGIN && outside.A.y === C.MARGIN);
  check("a drag onto another handle is refused",
    C.move(s, { type: "point", name: "D", point: s.B }) === null);
  check("an unknown option is refused", C.move(s, { type: "option", key: "wrong", value: true }) === null);
  let t = s;
  for (const key of C.OPTION_KEYS) t = C.move(t, { type: "option", key, value: true });
  check("all three applet switches can be ticked without moving the picture",
    C.OPTION_KEYS.every((k) => t[k] === true) && t.moves === 3
    && [s.A, s.B, s.C, s.D].every((p, i) => L(p, [t.A, t.B, t.C, t.D][i]) === 0));
  const reset = C.move(t, { type: "reset" });
  check("reset brings back the opening points and keeps the switches",
    [s.A, s.B, s.C, s.D].every((p, i) => L(p, [reset.A, reset.B, reset.C, reset.D][i]) === 0)
    && C.OPTION_KEYS.every((k) => reset[k] === true));
  check("a changed picture counts as explored (a demo, with no win or loss)",
    C.result(t) === "done" && reset.moves === 4);
  check("moves do not change the position they were given",
    s.moves === 0 && !s.explored && s.showPremise === false);
  check("three collinear corners are reported as degenerate",
    C.compute({ ...s, A: { x: 200, y: s.B.y } }).degenerate === true);
}

/* ------------------------ 2. the same answers as the applet's own bytecode */

{
  let worstPoint = 0, worstNumber = 0, bad = 0;
  for (const s of positions) {
    const g = C.compute(s);
    const a = apCompute(s.A, s.B, s.C, s.D);
    for (const key of ["E", "F", "D0", "E0", "F0", "center"]) {
      const keyMap = { D0: "foot", E0: "Emin", F0: "Fmin" };
      const q = a[keyMap[key] || key];
      worstPoint = Math.max(worstPoint, L(g[key], q));
      if (!same(g[key], q, 1e-8)) bad++;
    }
    for (const [x, y] of [[g.minLength, a.minimum], [g.ef, a.current]]) {
      worstNumber = Math.max(worstNumber, Math.abs(x - y));
      if (!sameNum(x, y, 1e-9)) bad++;
    }
    if (g.finished !== a.finished) bad++;
    if (!g.circle !== !a.circle) bad++;
    if (g.circle && a.circle) {
      worstPoint = Math.max(worstPoint, L(g.circle.center, a.circle.center));
      worstNumber = Math.max(worstNumber, Math.abs(g.circle.radius - a.circle.radius));
      if (!same(g.circle.center, a.circle.center, 1e-8) || !sameNum(g.circle.radius, a.circle.radius, 1e-9)) bad++;
    }
  }
  check(`the core matches the bytecode at ${positions.length} positions`,
    bad === 0, `${bad} mismatches; worst point ${worstPoint}, worst length ${worstNumber}`);

  const opening = C.start();
  const near = { ...opening, D: { x: C.compute(opening).D0.x + 0.4, y: opening.D.y } };
  check("the applet's finished test is dist(D, foot) < 1",
    C.compute(near).finished === true && apCompute(near.A, near.B, near.C, near.D).finished === true
    && C.compute(opening).finished === false);
}

/* --------------------------- 3. the claims on the cut-the-knot page */

{
  let identity = 0, fixedAngle = 0, minimum = 0, atFoot = 0, circle = 0;
  let obtuse = 0, obtuseCount = 0, rightCases = 0, counted = 0, angleCases = 0;
  for (const s of triangles) {
    const g = C.compute(s);
    const a = apCompute(s.A, s.B, s.C, s.D);
    if (g.degenerate || !g.circle) continue;
    counted++;

    // EF = AD * sin(EDF) for this D, and the angle at the foot is the same
    // (or its supplement, as the page notes) for every D on the base line.
    identity = Math.max(identity, Math.abs(g.ef - g.ad * Math.sin(g.angle)));
    // At D = B or C one of the rays DE, DF has zero length, so the angle at
    // D is undefined; that is why the page's "fixed angle" excludes corners.
    if (L(g.D0, s.B) > 1e-6 && L(g.D0, s.C) > 1e-6) {
      angleCases++;
      fixedAngle = Math.max(fixedAngle,
        Math.min(Math.abs(g.angle - g.angle0), Math.abs(g.angle + g.angle0 - Math.PI)));
    }

    // The minimum from the bytecode equals a dense independent search along
    // the whole line BC, and the altitude foot is where it occurs.
    const t0 = (g.D0.x - s.B.x) / (s.C.x - s.B.x);
    let best = Infinity;
    for (let k = -300; k <= 300; k++) {
      const t = t0 + k * 0.01;
      const d = { x: s.B.x + t * (s.C.x - s.B.x), y: s.B.y };
      best = Math.min(best, apCompute(s.A, s.B, s.C, d).current);
    }
    minimum = Math.max(minimum, Math.abs(best - a.minimum));
    atFoot = Math.max(atFoot, Math.max(0, g.ef >= a.minimum - 1e-8 ? 0 : a.minimum - g.ef));
    if (a.current + 1e-8 < a.minimum) atFoot = Infinity;

    // AEDF has AD as its circumdiameter: its centre is the midpoint of AD,
    // its radius is AD/2, and E and F lie on it.
    const mid = H(s.A, s.D), half = g.ad / 2;
    circle = Math.max(circle, L(g.circle.center, mid), Math.abs(g.circle.radius - half),
      Math.abs(L(g.circle.center, g.E) - half), Math.abs(L(g.circle.center, g.F) - half));

    // Honsberger's supposed exception: at an obtuse base angle the foot lies
    // outside the side; EF at the foot is still smaller than at the vertex.
    if (t0 < 0 || t0 > 1) {
      const vertex = t0 < 0 ? s.B : s.C;
      const ve = apNearest(vertex, s.A, s.C), vf = apNearest(vertex, s.A, s.B);
      obtuseCount++;
      if (L(ve, vf) > a.minimum + 1e-7) obtuse++;
    }
  }
  check(`EF = AD sin(EDF) for all ${counted} non-degenerate configurations`,
    identity < 1e-7, `worst error ${identity}`);
  check(`angle EDF is fixed as D slides (up to the supplement), ${angleCases} non-corner cases`,
    angleCases > 100 && fixedAngle < 1e-7, `worst difference ${fixedAngle}`);
  check("the applet's minimum agrees with a dense search over the whole base line",
    minimum < 1e-6, `worst difference ${minimum}`);
  check("EF is never shorter than the value at the altitude foot",
    Number.isFinite(atFoot) && atFoot < 1e-7, `worst shortfall ${atFoot}`);
  check("AEDF is cyclic with AD as its diameter", circle < 1e-6, `worst residual ${circle}`);
  check(`the page's rejection of Honsberger's obtuse-vertex exception holds in all ${obtuseCount} obtuse cases`,
    obtuseCount > 100 && obtuse === obtuseCount, `${obtuse}/${obtuseCount}`);

  // With a right angle at A, AEDF is a rectangle: EDF is a right angle and
  // its diagonal EF has exactly the length of the other diagonal AD.
  const by = (C.HEIGHT * 5) / 6;
  const b = { x: 60, y: by }, cx = { x: 340, y: by };
  const midBC = H(b, cx), r = L(b, cx) / 2;
  for (const theta of [-2.6, -2.1, -1.6, -1.1, -0.6]) {
    const apex = { x: midBC.x + r * Math.cos(theta), y: midBC.y + r * Math.sin(theta) };
    for (const t of [0.1, 0.35, 0.5, 0.8, 1.2]) {
      const d = { x: b.x + t * (cx.x - b.x), y: by };
      const s = { ...C.start(), A: apex, B: b, C: cx, D: d };
      const g = C.compute(s);
      rightCases++;
      if (Math.abs(g.angle - Math.PI / 2) > 1e-7 || !sameNum(g.ef, g.ad, 1e-9)) rightCases = Infinity;
    }
  }
  check("when angle A is right, AEDF is a rectangle and EF = AD",
    rightCases === 25, `${rightCases} cases`);
}

done("foot-of-altitude");
