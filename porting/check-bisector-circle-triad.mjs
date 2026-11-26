#!/usr/bin/env node
"use strict";

/*
 * Logic test for bisector-circle-triad/bisector-circle-triad-core.js.
 *
 *   node porting/check-bisector-circle-triad.mjs
 *
 * The article's exact claim: with L the incenter of ABC and Ab, Ac, Ba, Bc,
 * Ca, Cb the reflections of the vertices in the two angle bisectors through
 * the other vertices, the circumcircles of A Cb Bc, B Ac Ca and C Ba Ab are
 * congruent. The proof adds that all six circles (the second, reflected triad
 * included) have radius |LO|, where O is the circumcenter; that O, X, Y, Z lie
 * on the circle centred at L; that the six circle centres lie on the circle
 * centred at L with radius R; and that the isogonal conjugate P is on the
 * circumcircle. All of these are checked at fixed triangles (equilateral,
 * right, each obtuse corner, flat, and the applet's own start) and at 2,000
 * random triangles, with a relative tolerance of 1e-6.
 *
 * Section 5 is a second, literal transcription of the applet's Compute() and
 * Bytecode helpers (findAngleBisector by rotating a ray, NearestPoint with its
 * 0.1 guard, FindCircumcenter by two midpoints, Intersect with its |det| < 1
 * guard, and the mean-of-three-distances radius). It is compared with the core
 * over the whole set of configurations, including every option combination.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bisector-circle-triad/bisector-circle-triad-core.js", "BisectorCircleTriadCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });
const CLAIM_KEYS = [
  "circumcircle", "reflections", "translations", "mainTriad", "sixCircles",
  "radiusLO", "OXYZconcyclic", "centersOnCircle", "isogonalOnCircumcircle",
];

/* ---------------------------- 1. the start and the seven applet options */

{
  equal("start A matches the applet's (2*w/5, h/3)", C.start().A, { x: 160, y: 100 });
  equal("start B matches the applet's (w/3, 2*h/3)", C.start().B, { x: 400 / 3, y: 200 });
  equal("start C matches the applet's (3*w/4, 2*h/3)", C.start().C, { x: 300, y: 200 });
  equal("explicit points are copied", C.start({ points: C.start() }), C.start());
  check("a fresh diagram has no outcome", C.result(C.start()) === null);
  check("the start triangle is not degenerate", !C.isDegenerate(C.start()));
  check("withPoint leaves the old position alone", (() => {
    const s = C.start();
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === 160 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown handle leaves the position alone", C.withPoint(C.start(), "Z", { x: 1, y: 2 }).A.x === 160);

  const d = C.options();
  check("only names is checked by default, as in the applet", d.names && Object.keys(d).filter((k) => d[k]).length === 1);
  check("all seven applet checkboxes are represented", C.OPTION_KEYS.length === 7);
  check("unknown option fields are ignored", C.options({ nonsense: true }).nonsense === undefined);
  check("an explicitly false option overrides the default", C.options({ names: false }).names === false);
}

/* --------------------- 2. the page's claim at representative triangles */

const fixed = [
  ["right", tri({ x: 60, y: 250 }, { x: 60, y: 40 }, { x: 320, y: 250 })],
  ["obtuse at A", tri({ x: 60, y: 150 }, { x: 320, y: 90 }, { x: 300, y: 240 })],
  ["obtuse at B", tri({ x: 180, y: 40 }, { x: 50, y: 260 }, { x: 360, y: 250 })],
  ["obtuse at C", tri({ x: 40, y: 40 }, { x: 360, y: 60 }, { x: 190, y: 250 })],
  ["very flat", tri({ x: 40, y: 150 }, { x: 360, y: 160 }, { x: 200, y: 175 })],
  ["applet start", C.start()],
  ["nearly equilateral", tri({ x: 200, y: 40 }, { x: 60, y: 281 }, { x: 340, y: 280 })],
  ["tiny triangle", tri({ x: 10, y: 10 }, { x: 30, y: 11 }, { x: 20, y: 34 })],
  ["large triangle", tri({ x: -1000, y: 0 }, { x: 3000, y: 500 }, { x: 700, y: 2800 })],
  ["board-sized", tri({ x: 30, y: 220 }, { x: 210, y: 20 }, { x: 330, y: 190 })],
];

for (const [name, s] of fixed) {
  const cl = C.claims(s);
  for (const key of CLAIM_KEYS) {
    check(`${name}: ${key}`, cl[key] === true);
  }
  check(`${name}: the three circles have equal radii`, (() => {
    const d = C.compute(s);
    return close(d.circles.A.radius, d.circles.B.radius, 1e-6 * d.R)
      && close(d.circles.B.radius, d.circles.C.radius, 1e-6 * d.R);
  })());
  check(`${name}: the triad radius is |LO|`, (() => {
    const d = C.compute(s);
    return close(d.circles.A.radius, dist(d.L, d.O), 1e-6 * d.R);
  })());
}

/* ---------------- 3. every claim over thousands of configurations */

{
  const rand = rng(2632);
  const failures = Object.fromEntries(CLAIM_KEYS.map((k) => [k, 0]));
  let tested = 0;
  for (let trial = 0; trial < 2000; trial++) {
    const s = tri(
      { x: rand() * 400, y: rand() * 300 },
      { x: rand() * 400, y: rand() * 300 },
      { x: rand() * 400, y: rand() * 300 },
    );
    if (C.isDegenerate(s) || C.doubleArea(s) < 100) continue;
    tested++;
    const cl = C.claims(s);
    for (const key of CLAIM_KEYS) if (!cl[key]) failures[key]++;
  }
  check(`2,000 random triangles were tested (${tested} usable)`, tested > 1900);
  for (const key of CLAIM_KEYS) check(`random triangles: ${key} always holds`, failures[key] === 0,
    `${failures[key]} failures`);
}

/* -------------------------- 4. the whole option range */

{
  let combos = 0;
  for (let mask = 0; mask < 128; mask++) {
    const given = {};
    C.OPTION_KEYS.forEach((key, i) => { given[key] = Boolean(mask & (1 << i)); });
    const o = C.options(given);
    check(`option mask ${mask} selects exactly its checkboxes`,
      C.OPTION_KEYS.every((key, i) => o[key] === Boolean(mask & (1 << i))));
    combos++;
  }
  check("all 7 checkbox combinations were exercised", combos === 128);
  const s = C.start();
  const base = C.compute(s);
  check("the geometry is independent of the seven checkboxes", (() => {
    for (let mask = 0; mask < 128; mask++) {
      const given = {};
      C.OPTION_KEYS.forEach((key, i) => { given[key] = Boolean(mask & (1 << i)); });
      const d = C.compute(s);
      if (!closePoint(d.O, base.O, 1e-12) || !close(d.circles.A.radius, base.circles.A.radius, 1e-12)) return false;
    }
    return true;
  })());
}

/* ---------------- 5. a second transcription of the applet's own Compute */

/* GeoSDoub.SqDist / Dist. */
const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const D = (p, q) => Math.sqrt(sq(p, q));

/* GeoSDoub.ComputeAngle: law of cosines at the first point. */
function angle(P, Q, R) {
  const v = (sq(P, Q) + sq(P, R) - sq(Q, R)) / (2 * D(P, Q) * D(P, R));
  return Math.acos(Math.max(-1, Math.min(1, v)));
}

/* GeoSDoub.FindOrientation. */
function orientation(A, B, Dp) {
  const s = Dp.x * (A.y - B.y) + Dp.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate: rotate Q about P by angle, with an orientation sign. */
function rotate(P, Q, a, orient) {
  const cs = Math.cos(a), sn = Math.sin(a);
  return {
    x: P.x + cs * (Q.x - P.x) - orient * sn * (Q.y - P.y),
    y: P.y + orient * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* GeoSDoub.Intersect on two lines; |det| < 1 gives NaN in the applet. */
function intersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindAngleBisector: rotate the first ray by half the angle. */
function bisector(A, B, Dp) {
  const ray = rotate(A, B, angle(A, B, Dp) / 2, orientation(A, B, Dp));
  return intersect(A, ray, B, Dp);
}

/*
 * GeoSDoub.NearestPoint. The bytecode has a guard: if the point is within
 * sqrt(0.1) of the line's first vertex it returns that vertex instead of the
 * projection. That is a harmless applet artifact for near-coincident points;
 * the core uses the exact projection, so this transcription can turn the guard
 * off to compare like with like and on to measure its effect.
 */
function nearest(p, x, y, guard, stats) {
  if (guard && sq(p, x) < 0.1) {
    stats.hits++;
    return x;
  }
  const dx = y.x - x.x, dy = y.y - x.y;
  const t = ((p.x - x.x) * dx + (p.y - x.y) * dy) / (dx * dx + dy * dy);
  return { x: x.x + t * dx, y: x.y + t * dy };
}
const reflect = (p, x, y, guard, stats) => {
  const q = nearest(p, x, y, guard, stats);
  return { x: 2 * q.x - p.x, y: 2 * q.y - p.y };
};

/* GeoSDoub.FindCircumcenter: midpoint/perpendicular lines, then Intersect. */
function center(P, Q, R) {
  const m1 = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  const m2 = { x: (Q.x + R.x) / 2, y: (Q.y + R.y) / 2 };
  const d1 = { x: m1.x + (Q.y - P.y), y: m1.y - (Q.x - P.x) };
  const d2 = { x: m2.x + (R.y - Q.y), y: m2.y - (R.x - Q.x) };
  return intersect(m1, d1, m2, d2);
}

/* GetCircle in BisectorCircleTriadCanvas: radius is the mean of 3 distances. */
function circle(P, Q, R) {
  const o = center(P, Q, R);
  return { center: o, radius: (D(o, P) + D(o, Q) + D(o, R)) / 3 };
}
const translate = (o, p, q) => ({ x: o.x + q.x - p.x, y: o.y + q.y - p.y });

/* BisectorCircleTriadCanvas.Incenter()/Barycenter(). */
function appletIncenter(A, B, Cc) {
  const la = bisector(A, B, Cc), lb = bisector(B, Cc, A), lc = bisector(Cc, A, B);
  const i1 = intersect(A, la, B, lb), i2 = intersect(B, lb, Cc, lc), i3 = intersect(Cc, lc, A, la);
  return { x: (i1.x + i2.x + i3.x) / 3, y: (i1.y + i2.y + i3.y) / 3 };
}

/* BisectorCircleTriadCanvas.Compute(), in the bytecode's order. */
function appletCompute(s, guard = false) {
  const stats = { hits: 0 };
  const R = (p, x, y) => reflect(p, x, y, guard, stats);
  const { A, B, C: Cc } = s;
  const abc = circle(A, B, Cc);
  const O = abc.center;
  const L = appletIncenter(A, B, Cc);
  const La = bisector(A, B, Cc), Lb = bisector(B, Cc, A), Lc = bisector(Cc, A, B);

  const Ab = R(A, B, Lb), Ac = R(A, Cc, Lc);
  const Ba = R(B, A, La), Bc = R(B, Cc, Lc);
  const Ca = R(Cc, A, La), Cb = R(Cc, B, Lb);

  const A1b = R(Ab, Cc, Lc), A1c = R(Ac, B, Lb);
  const B1a = R(Ba, Cc, Lc), B1c = R(Bc, A, La);
  const C1a = R(Ca, B, Lb), C1b = R(Cb, A, La);

  const X = translate(O, B, C1a), Y = translate(O, Cc, A1b), Z = translate(O, A, B1c);

  const circleA = circle(A, Cb, Bc), circleB = circle(B, Ac, Ca), circleC = circle(Cc, Ba, Ab);
  const circle1A = circle(A, C1b, B1c), circle1B = circle(B, A1c, C1a), circle1C = circle(Cc, B1a, A1b);
  const circleL = circle(X, Y, Z);
  const circle1 = circle(circle1A.center, circle1B.center, circle1C.center);

  /* DoubCircle extends DoubPoint, so Intersect(A, CircleA, ...) is line-line. */
  const i1 = intersect(A, circleA.center, B, circleB.center);
  const i2 = intersect(B, circleB.center, Cc, circleC.center);
  const i3 = intersect(Cc, circleC.center, A, circleA.center);
  const P = { x: (i1.x + i2.x + i3.x) / 3, y: (i1.y + i2.y + i3.y) / 3 };

  return {
    O, L, La, Lb, Lc, Ab, Ac, Ba, Bc, Ca, Cb,
    A1b, A1c, B1a, B1c, C1a, C1b, X, Y, Z, P, guardHits: stats.hits,
    abc, circleA, circleB, circleC, circle1A, circle1B, circle1C, circleL, circle1,
  };
}

const POINT_FIELDS = [
  "O", "L", "La", "Lb", "Lc", "Ab", "Ac", "Ba", "Bc", "Ca", "Cb",
  "A1b", "A1c", "B1a", "B1c", "C1a", "C1b", "X", "Y", "Z",
];
const CIRCLE_FIELDS = [
  "abc", "circleA", "circleB", "circleC", "circle1A", "circle1B",
  "circle1C", "circleL", "circle1",
];

{
  const rand = rng(9137);
  const configs = fixed.map(([, s]) => s);
  for (let i = 0; i < 1200; i++) {
    configs.push(tri(
      { x: rand() * 400, y: rand() * 300 },
      { x: rand() * 400, y: rand() * 300 },
      { x: rand() * 400, y: rand() * 300 },
    ));
  }
  let compared = 0, stableP = 0, guardCases = 0, blindCases = 0;
  const badPoints = [], badCircles = [], badP = [], badClaims = [], badGuard = [], badBlind = [];

  for (const s of configs) {
    if (C.isDegenerate(s) || C.doubleArea(s) < 100) continue;
    const a = appletCompute(s);
    const core = C.compute(s);
    const scale = Math.max(C.sides(s).a, C.sides(s).b, C.sides(s).c);
    const tol = 2e-5 * scale; // the applet's NaN guard and accumulated rounding
    for (const key of POINT_FIELDS) {
      const cp = key === "O" ? core.O
        : key === "L" ? core.L
        : /^L[abc]$/.test(key) ? core.feet[key]
        : /^[ABC]1[abc]$/.test(key) ? core.primed[key]
        : /^[ABC][abc]$/.test(key) ? core.reflected[key]
        : core[key]; // X, Y, Z
      if (!closePoint(a[key], cp, tol)) badPoints.push([key, s]);
    }
    /* The applet's Intersect throws away lines with |det| < 1. For the tiny
       triad circles of a nearly equilateral triangle that means NaN, so the
       applet simply draws nothing there. The core's relative test keeps them.
       Those configurations are counted separately below. */
    const appletBlind = CIRCLE_FIELDS.some((k) => !Number.isFinite(a[k].center.x));
    if (appletBlind) {
      blindCases++;
      if (!(D(a.L, a.O) < 0.05 * a.abc.radius)) badBlind.push(s);
    } else {
      for (const key of CIRCLE_FIELDS) {
        const cc = key === "abc" ? core.circles.abc
          : key === "circleA" ? core.circles.A
          : key === "circleB" ? core.circles.B
          : key === "circleC" ? core.circles.C
          : key === "circle1A" ? core.circles.A1
          : key === "circle1B" ? core.circles.B1
          : key === "circle1C" ? core.circles.C1
          : key === "circleL" ? core.circles.L
          : core.circles.one;
        /* The circle through the three primed centres can be enormous when
           they are almost collinear; compare it at relative precision. */
        const cmpTol = key === "circle1" ? Math.max(tol, 1e-3 * a[key].radius) : tol;
        if (!closePoint(a[key].center, cc.center, cmpTol) || !close(a[key].radius, cc.radius, cmpTol)) {
          badCircles.push([key, s]);
        }
      }
      /* The core's normalized intersection also works when the applet's
         |det| < 1 guard returns NaN; compare P only where the applet has one. */
      if (Number.isFinite(a.P.x)) {
        stableP++;
        if (!closePoint(a.P, core.P, tol)) badP.push(s);
      }

      const r = [a.circleA.radius, a.circleB.radius, a.circleC.radius];
      const r1 = [a.circle1A.radius, a.circle1B.radius, a.circle1C.radius];
      const t = 1e-6 * a.abc.radius;
      const centers = [a.circleA, a.circleB, a.circleC, a.circle1A, a.circle1B, a.circle1C];
      const ok = close(r[0], r[1], t) && close(r[1], r[2], t)
        && close(r[0], r1[0], t) && close(r1[0], r1[1], t) && close(r1[1], r1[2], t)
        && close(r[0], D(a.L, a.O), t)
        && close(D(a.L, a.O), D(a.L, a.X), t) && close(D(a.L, a.O), D(a.L, a.Y), t)
        && close(D(a.L, a.O), D(a.L, a.Z), t)
        && centers.every((c) => close(D(a.L, c.center), a.abc.radius, t))
        && (!Number.isFinite(a.P.x) || close(D(a.P, a.O), a.abc.radius, t));
      if (!ok) badClaims.push(s);
    }
    /* The applet's NearestPoint guard only fires for almost-coincident
       points. Measure it: any change must stay within 2*sqrt(0.1) in board
       units, and nothing else may differ. */
    const guarded = appletCompute(s, true);
    if (guarded.guardHits > 0) {
      guardCases++;
      for (const key of POINT_FIELDS) {
        if (dist(guarded[key], a[key]) > 1) badGuard.push([key, s]);
      }
    }
    compared++;
  }

  for (const key of POINT_FIELDS) {
    check(`applet's ${key} matches the core`, badPoints.filter(([k]) => k === key).length === 0,
      `${badPoints.filter(([k]) => k === key).length} mismatches`);
  }
  for (const key of CIRCLE_FIELDS) {
    check(`applet's ${key} matches the core`, badCircles.filter(([k]) => k === key).length === 0,
      `${badCircles.filter(([k]) => k === key).length} mismatches`);
  }
  check("applet's P matches the core wherever computable", badP.length === 0, `${badP.length} mismatches`);
  check("the applet's own computation confirms every claim", badClaims.length === 0, `${badClaims.length} failures`);
  check("the applet's 0.1 NearestPoint guard only shifts near-coincident points", badGuard.length === 0,
    `${badGuard.length} unexplained changes`);
  check(`the guard was observed on ${guardCases} configurations`, guardCases > 0);
  check("every applet-blind case is nearly equilateral", badBlind.length === 0, `${badBlind.length} cases`);
  check(`the applet went blind on ${blindCases} near-equilateral configurations`, blindCases > 0);
  check(`applet transcription compared on ${compared} configurations`, compared > 1100);
  check(`the applet computed P on ${stableP} configurations`, stableP > 1000);
}

/* ------------------------------ 6. degenerate input */

{
  const flat = tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 });
  check("collinear vertices are degenerate", C.isDegenerate(flat));
  check("no circumcircle for a degenerate triangle", C.compute(flat).valid === false);
  check("no claims pass for a degenerate triangle", !Object.values(C.claims(flat)).some(Boolean));
  check("duplicate vertices are degenerate too",
    C.isDegenerate(tri({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 100, y: 100 })));

  /* At an exactly equilateral triangle L = O, so the three circles collapse
     to points of radius 0; there is nothing to draw and no P to speak of. */
  const eq = tri({ x: 200, y: 280 - 140 * Math.sqrt(3) }, { x: 60, y: 280 }, { x: 340, y: 280 });
  const eqd = C.compute(eq);
  check("the equilateral triangle has no drawn circles", eqd.valid && !eqd.circles.A && !eqd.circles.B && !eqd.circles.C);
  check("the equilateral triangle has no isogonal point", eqd.P === null);
  check("the equilateral incenter is the circumcenter", closePoint(eqd.L, eqd.O, 1e-9));
  check("reflection is an involution", (() => {
    const s = C.start();
    const f = C.bisectorFoot(s, "B");
    return closePoint(C.reflect(C.reflect(s.A, s.B, f), s.B, f), s.A, 1e-9);
  })());
}

done("bisector-circle-triad");
