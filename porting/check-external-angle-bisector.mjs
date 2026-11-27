#!/usr/bin/env node
"use strict";

/*
 * Logic test for external-angle-bisector/external-angle-bisector-core.js.
 *
 *   node porting/check-external-angle-bisector.mjs
 *
 * The page's exact claims are: "If, in ABC, AD is an angle bisector of angle
 * A, then AB/AC = DB/DC", "the same is true of the external angle bisectors",
 * the line through C parallel to AD meets AB in E with AE = AC, triangles BEC
 * and BAD are similar, and one internal and two external bisectors meet in a
 * point. It also prints an angle calculation ending "= 90° = BAC/2": that
 * literal equality is false, and the true identity is
 * angle AEC = angle ACE = 90° - BAC/2. All of that is checked on fixed
 * triangles, on a polar grid of shapes and on hundreds of random ones in
 * both drawing orders.
 *
 * The last section is a second, literal transcription of the applet's own
 * arithmetic from the bytecode: GeoSDoub.ComputeAngle, FindOrientation,
 * Rotate, Intersect, FindAngleBisector and GetParallelTo, then
 * ExternalAngleBisectorCanvas.Draw's perpendicular construction, its
 * far-away fallback, the reflection, InsideTest and the Hint's parallels.
 * It is compared with the core on fixed and random triangles.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "external-angle-bisector/external-angle-bisector-core.js",
  "ExternalAngleBisectorCore",
);

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });
const claimsPass = (cl) => Object.values(cl).every(Boolean);
const trueClaims = (s) => {
  const cl = C.claims(s);
  const { printedAngle, ...rest } = cl;
  return { ok: Object.values(rest).every(Boolean), printedAngle, cl };
};
const tolFor = (s) => 5e-6 * Math.max(C.sides(s).a, C.sides(s).b, C.sides(s).c);

/* --------------- the applet's own computation, transcribed from bytecode */

function sq(P, Q) {
  const dx = P.x - Q.x, dy = P.y - Q.y;
  return dx * dx + dy * dy;
}

/* GeoSDoub.ComputeAngle: law of cosines at P, no clamping, as compiled. */
function appletComputeAngle(P, Q, R) {
  const num = sq(P, Q) + sq(P, R) - sq(Q, R);
  return Math.acos(num / (2 * Math.sqrt(sq(P, Q)) * Math.sqrt(sq(P, R))));
}

/* GeoSDoub.FindOrientation: sign of the compiled expression. */
function appletOrientation(A, B, D) {
  const s = D.x * (A.y - B.y) + D.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate: turn Q about P by orientation * angle. */
function appletRotate(P, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* GeoSDoub.Intersect: ax+by+c = 0 form; the applet refuses |det| < 1. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindAngleBisector: rotate AB by half of angle A, intersect BC. */
function appletInternalFoot(A, B, Cc) {
  const half = appletComputeAngle(A, B, Cc) / 2;
  const orient = appletOrientation(A, B, Cc);
  const ray = appletRotate(A, B, half, orient);
  return appletIntersect(A, ray, B, Cc);
}

/* GeoSDoub.GetParallelTo(P,Q,R) = P + 100*(Q-R). */
function appletGetParallelTo(P, Q, R) {
  return { x: P.x + 100 * (Q.x - R.x), y: P.y + 100 * (Q.y - R.y) };
}

/* GeoSDoub.ReflectPointInLine(point, line through m_1=A, m_2=D). */
function appletReflect(point, A, D) {
  const angle = 2 * appletComputeAngle(D, point, A);
  const orientation = appletOrientation(D, point, A);
  return appletRotate(D, point, angle, orientation);
}

/* ExternalAngleBisectorCanvas.Draw, in the bytecode's order. */
function appletDraw(A, B, Cc) {
  const Q = appletInternalFoot(A, B, Cc);
  // new DoubPoint(A.x + (A.y-Q.y), A.y - (A.x-Q.x)): a ray from A at right
  // angles to the internal bisector AQ, i.e. the external bisector.
  const perp = { x: A.x + (A.y - Q.y), y: A.y - (A.x - Q.x) };
  let D = appletIntersect(A, perp, B, Cc);
  let fallback = false;
  let far = null;
  if (!D || Number.isNaN(D.x) || Number.isNaN(D.y) ||
      Math.abs(D.x) > 10000 || Math.abs(D.y) > 10000) {
    far = appletGetParallelTo(A, B, Cc);
    D = far;
    fallback = true;
  }
  const parallel = appletGetParallelTo(Cc, A, D);
  const E = appletIntersect(B, A, Cc, parallel);
  const inside = (B.x - Cc.x) * (B.x - D.x) + (B.y - Cc.y) * (B.y - D.y) <= 0;
  const chosen = inside ? B : Cc;
  return { Q, perp, D, far, fallback, parallel, E, inside, chosen,
    reflected: appletReflect(chosen, A, D) };
}

/* The Hint's Parallels(g, p, q, r, u, scale): count = (int)(|pq|/scale). */
function appletParallels(p, q, r, u, scale, bisector) {
  const length = dist(p, q);
  const count = Math.trunc(length / scale);
  if (!Number.isFinite(count) || count <= 0 || length < 2 * count) return [];
  const out = [];
  for (let i = 0; i < count; i++) {
    const P = { x: p.x + (i * (q.x - p.x)) / count, y: p.y + (i * (q.y - p.y)) / count };
    const direction = appletGetParallelTo(P, bisector.A, bisector.D);
    const Q = appletIntersect(P, direction, r, u);
    out.push([P, Q]);
  }
  return out;
}

/* Both branches of Draw's Hint, exactly as the bytecode computes them. */
function appletHint(A, B, Cc, D, E, inside, extra) {
  if (Number.isNaN(D.x) || Number.isNaN(D.y)) return [];
  const BD = dist(B, D), CD = dist(Cc, D), BC = dist(B, Cc), AC = dist(A, Cc);
  const base = Math.trunc(((inside ? AC : BD) / 15));
  if (base <= 0) return [];
  let first, second;
  if (inside) {
    const n1 = Math.trunc((base * dist(Cc, B)) / CD);
    const n2 = Math.trunc((base * BD) / CD);
    first = appletParallels(extra ? E : Cc, B, Cc, A, dist(B, extra ? E : Cc) / n1, { A, D });
    second = appletParallels(B, D, Cc, A, BD / n2, { A, D });
  } else {
    const n1 = Math.trunc((base * BC) / BD);
    const n2 = Math.trunc((base * CD) / BD);
    first = appletParallels(D, Cc, A, B, CD / n2, { A, D });
    second = appletParallels(Cc, B, A, B, BC / n1, { A, D });
  }
  return first.concat(second);
}

/* --------------------------------------------- 1. the start and the options */

{
  const s = C.start({});
  equal("start A matches Canvas.init for a 400x300 applet", s.A, { x: 200, y: 230 });
  equal("start B matches Canvas.init for a 400x300 applet", s.B, { x: 300, y: 230 });
  check("start C x matches Canvas.init", close(s.C.x, 225, 1e-12), `got ${s.C.x}`);
  check("start C y matches Canvas.init",
    close(s.C.y, 180 - 50 * Math.sin(Math.PI / 3) - 75, 1e-12), `got ${s.C.y}`);
  check("ShowNames starts on, as the page's second applet sets", s.showNames === true);
  check("Hint and Extra construction start off", s.hint === false && s.extra === false);
  check("an illustration has no result", C.result(s) === null);
  check("the starting triangle is not degenerate", !C.isDegenerate(s));
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === 200 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("withOption changes only the named option", (() => {
    const next = C.withOption(s, "extra", true);
    return next.extra === true && next.hint === false && s.extra === false;
  })());
  check("the start's page claims all hold", trueClaims(s).ok, JSON.stringify(trueClaims(s).cl));
  check("the start does not satisfy the page's printed angle equality",
    !trueClaims(s).printedAngle);
}

/* -------------------------------------- 2. a hand-checkable right triangle */

{
  // A=(0,0), B=(4,0), C=(0,3): c=4, b=3, a=5, so DB/DC must be 4/3.
  const s = tri({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 });
  const m = C.measurements(s);
  check("right triangle: sides are 5, 3, 4",
    close(m.sides.a, 5, 1e-12) && close(m.sides.b, 3, 1e-12) && close(m.sides.c, 4, 1e-12));
  check("right triangle: AB/AC is 4/3", close(m.ratios.AB_AC, 4 / 3, 1e-12));
  check("right triangle: the internal foot is (12/7, 12/7)",
    closePoint(m.F, { x: 12 / 7, y: 12 / 7 }, 1e-12));
  check("right triangle: the external foot is (-12, 12)",
    closePoint(m.D, { x: -12, y: 12 }, 1e-12), JSON.stringify(m.D));
  check("right triangle: DB/DC is 4/3 for the external foot (the page's claim)",
    close(m.ratios.externalDB_DC, 4 / 3, 1e-12), `got ${m.ratios.externalDB_DC}`);
  check("right triangle: E is (3, 0)", closePoint(m.E, { x: 3, y: 0 }, 1e-12));
  check("right triangle: AE = AC = 3", close(m.ratios.AE_AC, 1, 1e-12));
  check("right triangle: BE/BA = BC/BD = CE/AD = 1/4",
    close(m.ratios.BE_BA, 0.25, 1e-12) && close(m.ratios.BC_BD, 0.25, 1e-12) &&
    close(m.ratios.CE_AD, 0.25, 1e-12));
  check("right triangle: angle AEC = angle ACE = 45° = 90° - A/2",
    close(m.angles.AEC, Math.PI / 4, 1e-12) && close(m.angles.ACE, Math.PI / 4, 1e-12));
  check("right triangle: the printed '90° = BAC/2' is false (90° vs 45°)",
    close(m.angles.BAC / 2, Math.PI / 4, 1e-12) && !trueClaims(s).printedAngle);
  check("right triangle: every true claim passes", trueClaims(s).ok,
    JSON.stringify(trueClaims(s).cl));
}

/* ------------------------------- 3. fixed triangles, both orientations */

const fixed = [
  ["applet start", C.start()],
  ["equilateral at A", tri({ x: 200, y: 40 }, { x: 60, y: 285 }, { x: 340, y: 285 })],
  ["isosceles at A", tri({ x: 200, y: 40 }, { x: 70, y: 250 }, { x: 330, y: 250 })],
  ["right at A", tri({ x: 60, y: 250 }, { x: 60, y: 45 }, { x: 330, y: 250 })],
  ["obtuse at A", tri({ x: 60, y: 150 }, { x: 330, y: 95 }, { x: 305, y: 245 })],
  ["obtuse at B", tri({ x: 185, y: 40 }, { x: 45, y: 265 }, { x: 360, y: 250 })],
  ["obtuse at C", tri({ x: 40, y: 45 }, { x: 360, y: 65 }, { x: 190, y: 255 })],
  ["clockwise order", tri({ x: 200, y: 250 }, { x: 60, y: 60 }, { x: 340, y: 70 })],
  ["long thin", tri({ x: 35, y: 150 }, { x: 365, y: 160 }, { x: 200, y: 178 })],
  ["AB much longer than AC", tri({ x: 120, y: 150 }, { x: 380, y: 150 }, { x: 150, y: 170 })],
  ["AC much longer than AB", tri({ x: 120, y: 150 }, { x: 150, y: 170 }, { x: 380, y: 150 })],
  ["tiny triangle", tri({ x: 30, y: 150 }, { x: 75, y: 155 }, { x: 45, y: 185 })],
];

for (const [name, s] of fixed) {
  const t = trueClaims(s);
  check(`${name}: the page's true claims all hold`, t.ok, JSON.stringify(t.cl));
  check(`${name}: the printed angle equality is false`, !t.printedAngle);
  const m = C.measurements(s);
  check(`${name}: the external foot is off the segment BC when it exists`,
    !m.D || Math.abs(dist(s.B, m.D) + dist(s.C, m.D) - m.sides.a) > 1e-6);
  check(`${name}: E lies on the ray AB at distance AC`, !m.E ||
    close(dist(s.A, m.E), m.sides.b, tolFor(s)));
  check(`${name}: the internal and external bisectors at A are perpendicular`,
    t.cl.perpendicular);
  check(`${name}: one internal and two external bisectors concur`, t.cl.concurrence);
  check(`${name}: hint lines are parallel to the external bisector`, (() => {
    const segs = C.hintSegments(s, { ...m, hint: true, extra: true });
    return segs.every(([p, q]) => Math.abs(C.vecCross(
      { x: q.x - p.x, y: q.y - p.y }, m.direction,
    )) <= 1e-5 * tolFor(s));
  })());
}

/* -------------------- 4. the page's claims over a grid and random cases */

{
  const grid = [];
  for (const sign of [1, -1]) {
    for (const degrees of [15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 165]) {
      for (const b of [40, 70, 100, 140, 200, 280]) {
        for (const c of [50, 80, 120, 180, 260]) {
          const theta = (sign * degrees * Math.PI) / 180;
          grid.push(tri({ x: 200, y: 150 },
            { x: 200 + c, y: 150 },
            { x: 200 + b * Math.cos(theta), y: 150 + b * Math.sin(theta) }));
        }
      }
    }
  }
  let gridTested = 0;
  for (const s of grid) {
    if (C.isDegenerate(s) || C.doubleArea(s) < 900) continue;
    gridTested++;
    const t = trueClaims(s);
    if (!t.ok || t.printedAngle) {
      check(`grid triangle ${JSON.stringify(s)}: claims`, false, JSON.stringify(t.cl));
    }
  }
  check(`all true claims hold on ${gridTested} grid triangles`, gridTested > 400);
  check("the grid covered both drawing orders", grid.some((s) => C.cross(s.A, s.B, s.C) > 0) &&
    grid.some((s) => C.cross(s.A, s.B, s.C) < 0));

  const rand = rng(4752);
  let randomTested = 0;
  for (let trial = 0; trial < 900; trial++) {
    const s = tri(
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
    );
    if (C.isDegenerate(s) || C.doubleArea(s) < 1200) continue;
    randomTested++;
    const t = trueClaims(s);
    if (!t.ok || t.printedAngle) {
      check(`random ${trial}: claims`, false, JSON.stringify(t.cl));
    }
  }
  check(`all true claims hold on ${randomTested} random triangles`, randomTested > 550);

  // The excenter formula is independent of the bisector-foot code. Compare
  // it with the concurrence point the core computes for every grid triangle.
  let excenters = 0;
  for (const s of grid) {
    if (C.isDegenerate(s) || C.doubleArea(s) < 900) continue;
    const X = C.excenter(s);
    if (!X) continue;
    const { a, b, c } = C.sides(s);
    const area = C.doubleArea(s) / 2;
    // Distances from the A-excenter to the three side lines are all the
    // same: the exradius r_a = area/(s-a), with s the semiperimeter.
    const semiperimeter = (a + b + c) / 2;
    const r = area / (semiperimeter - a);
    const lineDist = (p, u, v) => Math.abs(C.cross(u, v, p)) / dist(u, v);
    if (close(lineDist(X, s.A, s.B), r, tolFor(s)) &&
        close(lineDist(X, s.A, s.C), r, tolFor(s)) &&
        close(lineDist(X, s.B, s.C), r, tolFor(s))) excenters++;
  }
  check(`the concurrence point is the A-excenter on ${excenters} triangles`,
    excenters === gridTested);
}

/* ------------- 5. the core against the applet's own bytecode arithmetic */

{
  for (const [name, s] of fixed) {
    const a = appletDraw(s.A, s.B, s.C);
    const m = C.measurements(s);
    const tol = tolFor(s);
    if (Number.isNaN(a.Q.x)) continue; // the bytecode's acos can leave [0,1]
    check(`${name}: applet internal foot matches the core's F`,
      closePoint(a.Q, m.F, tol), `applet ${JSON.stringify(a.Q)}, core ${JSON.stringify(m.F)}`);
    check(`${name}: applet external foot / fallback matches the core's D`,
      a.fallback ? m.D === null : closePoint(a.D, m.D, tol),
      `applet fallback ${a.fallback}, core ${JSON.stringify(m.D)}`);
    check(`${name}: applet parallel point matches the core's`, a.fallback
      ? Math.abs(C.vecCross(
          { x: a.parallel.x - s.C.x, y: a.parallel.y - s.C.y },
          { x: m.parallel.x - s.C.x, y: m.parallel.y - s.C.y },
        )) <= tol * Math.hypot(a.parallel.x - s.C.x, a.parallel.y - s.C.y) * 1e-3
      : closePoint(a.parallel, m.parallel, tol));
    check(`${name}: applet E matches the core's E`,
      closePoint(a.E, m.E, tol), `applet ${JSON.stringify(a.E)}, core ${JSON.stringify(m.E)}`);
    check(`${name}: applet InsideTest matches the core's`, a.inside === m.inside);
    check(`${name}: applet reflected point matches the core's`,
      closePoint(a.reflected, m.reflected, tol),
      `applet ${JSON.stringify(a.reflected)}, core ${JSON.stringify(m.reflected)}`);
  }

  const rand = rng(9137);
  let compared = 0;
  for (let trial = 0; trial < 600; trial++) {
    const s = tri(
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
    );
    if (C.isDegenerate(s) || C.doubleArea(s) < 2000) continue;
    const a = appletDraw(s.A, s.B, s.C);
    if (Number.isNaN(a.Q.x)) continue;
    const m = C.measurements(s);
    const tol = tolFor(s);
    if (a.fallback) {
      // The applet constructs a point millions of units away, so its E and
      // reflection lose a little precision; only the branch choice is exact.
      if (m.D !== null || a.inside !== m.inside) {
        check(`random ${trial}: the applet's far fallback matches the core`, false,
          `applet fallback ${a.fallback}/${a.inside}, core D ${JSON.stringify(m.D)}/${m.inside}`);
      }
    } else if (!closePoint(a.Q, m.F, tol) || !closePoint(a.E, m.E, tol) ||
        !closePoint(a.D, m.D, tol) ||
        !closePoint(a.reflected, m.reflected, tol) || a.inside !== m.inside) {
      check(`random ${trial}: the applet and core agree`, false,
        `applet ${JSON.stringify(a)}, core ${JSON.stringify(m.D)}/${JSON.stringify(m.E)}`);
    }
    compared++;
  }
  check(`applet and core agree on ${compared} random triangles`, compared > 400);

  // The Hint's tick families: counts and endpoints from the bytecode.
  let hintCompared = 0;
  for (const [name, s] of fixed.slice(2)) {
    const a = appletDraw(s.A, s.B, s.C);
    if (Number.isNaN(a.D.x)) continue;
    for (const extra of [false, true]) {
      const withOptions = { ...s, hint: true, extra };
      const m = C.measurements(withOptions);
      const expected = appletHint(s.A, s.B, s.C, a.D, a.E, a.inside, extra);
      const actual = C.hintSegments(withOptions, m);
      // The page caps its hint at 80 lines; the applet may draw more.
      if (Math.min(expected.length, 80) !== actual.length ||
          actual.some(([p, q], i) => !closePoint(expected[i][0], p, tolFor(s)) ||
            !closePoint(expected[i][1], q, tolFor(s)))) {
        check(`${name} (extra=${extra}): hint ticks match the applet`, false,
          `applet ${expected.length}, core ${actual.length}`);
      }
      hintCompared++;
    }
  }
  check(`the Hint construction agrees on ${hintCompared} configurations`, hintCompared >= 20);
}

/* ------------------------------------ 6. degenerate input is handled safely */

{
  const flat = tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 });
  check("collinear points are degenerate", C.isDegenerate(flat));
  check("no internal foot for a degenerate triangle", !C.claims(flat).internalRatio);
  check("no external foot for a degenerate triangle", C.externalFoot(flat) === null);
  check("no auxiliary construction for a degenerate triangle", C.auxiliary(flat).E === null);
  check("no claims pass for a degenerate triangle", !claimsPass(C.claims(flat)));
  check("duplicate points are degenerate too",
    C.isDegenerate(tri({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 100, y: 100 })));
  check("intersect returns null for parallel lines",
    C.intersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }) === null);
  const iso = tri({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4 * Math.cos(0.8), y: 4 * Math.sin(0.8) });
  check("an isosceles triangle has no finite external foot", C.externalFoot(iso) === null);
  check("its external bisector is parallel to BC", (() => {
    const d = C.externalDirection(iso);
    return Math.abs(C.vecCross(d, { x: iso.C.x - iso.B.x, y: iso.C.y - iso.B.y })) < 1e-9;
  })());
}

done("external-angle-bisector");
