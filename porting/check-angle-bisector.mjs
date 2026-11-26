#!/usr/bin/env node
"use strict";

/*
 * Logic test for angle-bisector/angle-bisector-core.js.
 *
 *   node porting/check-angle-bisector.mjs
 *
 * Checked: the starting diagram against AngleBisectorCanvas.init; the core's
 * construction (E on ray AC with AE = AD, the two equal circles, F the farther
 * intersection, the bisector and the chord fallback) on fixed and on 400 random
 * configurations; every claim on the applet's page — AD = AE, DF = EF, the
 * common chord through A, equal angles at A, F and the whole bisector locus
 * equidistant from the two rays, Euclid's r = DE case, and the page's "a radius
 * greater than AD is sure to work" (with the true bound DE/2 given as well).
 *
 * The last group is a second, literal transcription of the applet's own
 * Compute() from the bytecode — including GeoSDoub.FindOrientation, the
 * circle/line and circle/circle intersections solved by different formulas,
 * Between, GetPerp and the >3 fallback — compared with the core throughout.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("angle-bisector/angle-bisector-core.js", "AngleBisectorCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const angleAt = (v, p, q) => C.angleAt(v, p, q);
const config = (A, B, Cc, coefD = 0.4, radius = 80) => ({ A, B, C: Cc, coefD, radius, R: { x: 0, y: 0 } });
const allClaims = (s) => C.claims(s);
const everyClaim = (s) => Object.values(allClaims(s)).every(Boolean);

/* --------------------------------- the applet's construction, transcribed twice */

/* GeoSDoub.FindOrientation, as in AngleBisectorCanvas.Compute. */
function appletOrientation(A, B, D) {
  const s = D.x * (A.y - B.y) + D.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* A circle/line intersection via the parametric quadratic (not the core's foot). */
function appletCircleLine(M, r, P, Q) {
  const dx = Q.x - P.x, dy = Q.y - P.y;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return [];
  const b = 2 * ((P.x - M.x) * dx + (P.y - M.y) * dy);
  const c = (P.x - M.x) ** 2 + (P.y - M.y) ** 2 - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  return [
    { x: P.x + ((-b + sq) / (2 * a)) * dx, y: P.y + ((-b + sq) / (2 * a)) * dy },
    { x: P.x + ((-b - sq) / (2 * a)) * dx, y: P.y + ((-b - sq) / (2 * a)) * dy },
  ];
}

/* A circle/circle intersection via the radical axis (not the core's midpoint). */
function appletCircleCircle(c1, r1, c2, r2) {
  const a = 2 * (c2.x - c1.x), b = 2 * (c2.y - c1.y);
  const c = (c1.x ** 2 + c1.y ** 2 - r1 * r1) - (c2.x ** 2 + c2.y ** 2 - r2 * r2);
  const den = a * a + b * b;
  if (den < 1e-12) return [];
  const t = -c / den;
  const base = { x: a * t, y: b * t };
  return appletCircleLine(c1, r1, base, { x: base.x - b, y: base.y + a });
}

function appletIntersectLines(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) return null;
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindAngleBisector: rotate AB by half the angle, then intersect AC. */
function appletBisectorFoot(A, B, C) {
  const num = dist(A, B) ** 2 + dist(A, C) ** 2 - dist(B, C) ** 2;
  const ang = Math.acos(Math.max(-1, Math.min(1, num / (2 * dist(A, B) * dist(A, C))))) / 2;
  const orient = appletOrientation(A, B, C);
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const ray = {
    x: A.x + cs * (B.x - A.x) - orient * sn * (B.y - A.y),
    y: A.y + orient * sn * (B.x - A.x) + cs * (B.y - A.y),
  };
  return appletIntersectLines(A, ray, A, C);
}

/* AngleBisectorCanvas.Between: is A on segment BC? */
function appletBetween(A, B, D) {
  return dist(B, A) + dist(D, A) - dist(B, D) < 2;
}

/* AngleBisectorCanvas.GetPerp: line through A perpendicular to AB. */
function appletGetPerp(A, B) {
  return { P: A, Q: { x: A.x + (A.y - B.y), y: A.y - (A.x - B.x) } };
}

function pointLineDist(p, l) {
  const dx = l.Q.x - l.P.x, dy = l.Q.y - l.P.y;
  const n = Math.hypot(dx, dy);
  return n < 1e-12 ? Infinity : Math.abs(dy * (p.x - l.P.x) - dx * (p.y - l.P.y)) / n;
}

/* AngleBisectorCanvas.Compute, in the order the bytecode executes it. */
function appletCompute(s) {
  const { A, B, C } = s;
  const D = { x: A.x + s.coefD * (B.x - A.x), y: A.y + s.coefD * (B.y - A.y) };
  const AD = dist(A, D);
  if (AD < 1) return { ok: false, F: null };
  const q = appletCircleLine(A, AD, A, C); // circle A ∩ line AC
  if (q.length < 2) return { ok: false, F: null };
  const orient = appletOrientation(A, B, C);
  const E = appletOrientation(A, B, q[0]) === orient ? q[0] : q[1];
  const r = s.radius;
  const P = appletCircleCircle(D, r, E, r);
  const flat = appletBetween(A, B, C) || dist(B, C) < 1;
  let bis = flat ? appletGetPerp(A, B) : { P: A, Q: appletBisectorFoot(A, B, C) };
  const F = P.length < 2 ? null : (dist(A, P[0]) > dist(A, P[1]) ? P[0] : P[1]);
  if (F && pointLineDist(F, bis) > 3 && P.length === 2) bis = { P: P[0], Q: P[1] };
  return { ok: true, D, E, P, F, bis, flat };
}

/* --------------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  equal("start A is (W/3, H/2)", s.A, { x: 400 / 3, y: 150 });
  check("start B is (W - W/3, A.y)", closePoint(s.B, { x: 800 / 3, y: 150 }, 1e-9));
  equal("start C is (A.x + 30, A.y - H/6 - W/6)", s.C,
    { x: 400 / 3 + 30, y: 150 - 50 - 400 / 6 });
  equal("start D is 0.4 of the way from A to B", C.pointD(s), { x: 560 / 3, y: 150 });
  equal("start R is D + (60, 60)", s.R, { x: 560 / 3 + 60, y: 210 });
  check("start radius is 60 sqrt(2)", close(s.radius, 60 * Math.SQRT2, 1e-9));
  check("a fresh illustration has no result", C.result(s) === null);
  check("the starting configuration is not degenerate", !C.construction(s).degenerate);
  check("withPoint does not change the old position", (() => {
    const n = C.withPoint(s, "C", { x: 10, y: 20 });
    return s.C.x === 400 / 3 + 30 && n.C.x === 10 && n.A.x === s.A.x;
  })());
  check("withPoint ignores an unknown handle", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === s.A.x);
  check("setRadius keeps the radius inside the applet's range", (() => {
    const a = C.setRadius(s, 1e6), b = C.setRadius(s, -5);
    return a.radius === C.MAX_R && b.radius === C.MIN_R;
  })());
}

/* ---------------------------------------- 2. fixed configurations, all claims */

const fixed = [
  ["the applet's start", C.start()],
  ["a wider angle", config({ x: 120, y: 170 }, { x: 350, y: 170 }, { x: 160, y: 30 })],
  ["a narrow angle", config({ x: 200, y: 200 }, { x: 370, y: 200 }, { x: 250, y: 150 })],
  ["an obtuse angle", config({ x: 200, y: 200 }, { x: 60, y: 200 }, { x: 300, y: 60 })],
  ["a small radius", config({ x: 120, y: 170 }, { x: 350, y: 170 }, { x: 160, y: 30 }, 0.4, 60)],
  ["D near A", config({ x: 120, y: 170 }, { x: 350, y: 170 }, { x: 160, y: 30 }, 0.08, 80)],
  ["D near B", config({ x: 120, y: 170 }, { x: 350, y: 170 }, { x: 160, y: 30 }, 0.92, 140)],
];

for (const [name, s] of fixed) {
  const c = C.construction(s);
  const cl = allClaims(s);
  check(`${name}: E is on the ray AC with AE = AD`, c.ok && cl.adEqualsAe);
  check(`${name}: the circles meet in two points`, c.ok && c.P.length === 2);
  check(`${name}: DF = EF = the common radius`, cl.dfEqualsEf);
  check(`${name}: the common chord passes through A`, cl.chordThroughA);
  check(`${name}: F lies on the chord`, cl.fOnChord);
  check(`${name}: the two halves of the angle are equal`, cl.equalAngles);
  check(`${name}: F is equally far from both rays`, cl.equidistant);
  check(`${name}: the whole bisector is the equidistant locus`, cl.locus);
  check(`${name}: F is the farther intersection`, cl.fartherPoint);
  check(`${name}: every claim holds at once`, everyClaim(s));
}

/* ------------------------------------- 3. the page's two radius claims */

{
  const rand = rng(2142);
  let tested = 0;
  for (let i = 0; i < 400; i++) {
    const A = { x: 120 + rand() * 160, y: 150 + rand() * 40 };
    const B = { x: A.x + 100 + rand() * 140, y: A.y };
    const Cc = { x: A.x + 10 + rand() * 80, y: A.y - 30 - rand() * 140 };
    const s = config(A, B, Cc, 0.15 + rand() * 0.7, 80);
    const c = C.construction(s);
    if (!c.ok || c.degenerate) continue;
    tested++;
    const m = C.measurements(s);
    /* The true minimum is DE/2 = AD sin(angle/2). */
    if (!close(m.minRadius, m.AD * Math.sin(m.angleBAC / 2), 1e-6 * m.scale)) {
      check(`trial ${i}: min radius is DE/2 = AD sin(A/2)`, false);
    }
    /* Page: "A sure way to achieve [intersection] is to choose a radius
       greater than AD." Strictly, r = AD already works whenever A < 180°. */
    const safe = C.setRadius(s, m.AD * 1.01);
    if (C.construction(safe).P.length !== 2) {
      check(`trial ${i}: r > AD makes the circles intersect`, false);
    }
    const tooSmall = C.setRadius(s, Math.max(C.MIN_R, m.minRadius * 0.85));
    const justEnough = C.setRadius(s, m.minRadius * 1.15);
    if (C.construction(tooSmall).P.length === 2 || C.construction(justEnough).P.length !== 2) {
      check(`trial ${i}: the intersection threshold is DE/2`, false);
    }
  }
  check(`the radius claims hold on ${tested} random angles`, tested > 350);

  const s = C.start();
  const euclid = C.setRadius(s, C.euclidRadius(s));
  check("r = DE reproduces Euclid's equilateral triangle DEF",
    close(C.measurements(euclid).DF, C.measurements(euclid).DE, 1e-9) &&
    close(C.measurements(euclid).EF, C.measurements(euclid).DE, 1e-9));
  check("the equilateral case still bisects the angle", everyClaim(euclid));
}

/* --------------- 4. the applet's own Compute() vs the core, all the way through */

{
  const rand = rng(942);
  let compared = 0;
  const cases = [...fixed.map(([, s]) => s)];
  for (let i = 0; i < 400; i++) {
    cases.push(config(
      { x: 30 + rand() * 300, y: 30 + rand() * 200 },
      { x: 30 + rand() * 300, y: 30 + rand() * 200 },
      { x: 30 + rand() * 300, y: 30 + rand() * 200 },
      0.05 + rand() * 0.9, 5 + rand() * 120,
    ));
  }
  for (const s of cases) {
    const core = C.construction(s);
    const applet = appletCompute(s);
    if (!core.ok || !applet.ok || !core.F || !applet.F) {
      check("applet and core agree that F does not exist", !core.F && !applet.F);
      continue;
    }
    const tol = 1e-7 * Math.max(dist(s.A, s.B), dist(s.A, s.C), s.radius, 1);
    if (!closePoint(core.D, applet.D, tol)) check("D matches applet UpgradeD", false);
    if (!closePoint(core.E, applet.E, tol)) check("E matches applet circle A ∩ AC", false,
      `core ${JSON.stringify(core.E)}, applet ${JSON.stringify(applet.E)}`);
    if (!core.F || !applet.F || !closePoint(core.F, applet.F, tol)) {
      check("F matches the applet's farther intersection", false,
        `core ${JSON.stringify(core.F)}, applet ${JSON.stringify(applet.F)}`);
    }
    /* The two P arrays may be in a different order; compare as a set. */
    const okP = core.P.length === applet.P.length &&
      core.P.every((p) => applet.P.some((q) => closePoint(p, q, tol)));
    if (!okP) check("the two circle intersections match the applet", false);
    /* The applet itself tolerates 3 units before changing its bisector, so two
       different numerical routes to the same line count as equal below that. */
    if (core.F && pointLineDist(core.F, applet.bis) > 3 + tol) {
      check("the core's bisector is the applet's bisector", false,
        `off by ${pointLineDist(core.F, applet.bis).toFixed(4)}, ` +
        `core fallback ${core.fallback}, applet flat ${applet.flat}, ` +
        `config ${JSON.stringify(s)}`);
    }
    compared++;
  }
  check(`applet and core agree on ${compared} configurations`, compared > 300);

  /* The fallback branch: when the drawn bisector is off by >3, Compute uses
     the common chord. Move R until the chord is far from the incenter line. */
  const s = C.start();
  const chord = C.construction(C.setRadius(s, 200));
  check("the fallback keeps F on the drawn bisector",
    !chord.F || C.distToLine(chord.F, chord.bisector) <= 3 + 1e-6);
}

/* ------------------------------------------- 5. degenerate input is safe */

{
  const flat = config({ x: 100, y: 100 }, { x: 0, y: 100 }, { x: 200, y: 100 });
  check("a straight angle is reported degenerate", C.construction(flat).degenerate);
  check("a straight angle still has E and two circles", C.construction(flat).ok);
  const same = config({ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 300, y: 100 });
  check("A = B gives no construction", !C.construction(same).ok);
  check("degenerate claims are all false", !Object.values(allClaims(same)).some(Boolean));
  check("angleAt with coincident points is zero", angleAt(same.A, same.B, same.C) === 0);
  check("a point on segment BC is Between", C.between({ x: 150, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }));
  check("a point outside segment BC is not Between",
    !C.between({ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }));
  const start = C.start();
  check("coef agrees with UpgradeD on the start", close(C.coef(start.B, C.pointD(start), start.A), 0.4, 1e-12));
}

done("angle-bisector");
