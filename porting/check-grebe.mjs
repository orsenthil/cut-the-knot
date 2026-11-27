#!/usr/bin/env node
"use strict";

/*
 * Logic test for grebe/grebe-core.js.
 *
 *   node porting/check-grebe.mjs
 *
 * The page's explanation (the Bride's Chair column linked from Grebe.shtml)
 * claims that extending the outer sides of the squares gives a triangle
 * homothetic to ABC at the symmedian point K, whose distances to the sides
 * are proportional to the sides; it also claims that the circumcentres of
 * the flanks and K are friends. Those claims are checked on the opening
 * triangle, eight hand-picked shapes and 500 random triangles. Every
 * constructed point is compared with a second, literal transcription of
 * GrebeCanvas and GeoSDoub from javap, using a different algebraic route for
 * the intersections. The state/options edge cases are checked as well.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("grebe/grebe-core.js", "GrebeCore");

const pt = (a) => ({ x: a[0], y: a[1] });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a, b, c, d) => (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
const near = (v, limit = 1e-6) => Number.isFinite(v) && v < limit;
const worst = (items, fn) => items.reduce((m, x) => Math.max(m, fn(x)), 0);
const onLine = (p, a, b) => Math.abs(cross(a, b, a, p)) / Math.max(1, dist(a, b));
const equalPt = (p, q, scale = 1) => dist(p, q) / scale;
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const HALF = Math.PI / 2;

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  check("the opening triangle has three finite corners inside the board",
    [s.A, s.B, s.C].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= 0 && p.x <= C.VIEW.width && p.y >= 0 && p.y <= C.VIEW.height));
  check("the opening triangle follows GrebeCanvas.init()",
    equalPt(s.A, pt([200, 285]), 1e-9) === 0 &&
    equalPt(s.B, pt([300, 285]), 1e-9) === 0 &&
    equalPt(s.C, pt([225, 550 / 2 - 50 * Math.sin(Math.PI / 3) - 20]), 1e-9) === 0);
  check("an illustration has no win or loss", C.result(s) === null && C.result({}) === null);
  check("Show names is off and Grebe is the selected radio button by default",
    s.options.names === false && s.options.mode === "grebe" && s.touches === 0 &&
    C.MODES.join(",") === "grebe,OK,KO");
  check("the three mode buttons can be selected and a bad one is ignored",
    C.setOption(s, "mode", "OK").options.mode === "OK" &&
    C.setOption(s, "mode", "KO").options.mode === "KO" &&
    C.setOption(s, "mode", "nonsense") === s &&
    C.setOption(s, "names", true).options.names === true &&
    C.setOption(s, "unknown", true) === s);

  const moved = C.moveVertex(s, "A", { x: 9000, y: -20 });
  check("dragging a corner clamps it to the board, as BetterMover does",
    moved.A.x === C.VIEW.width - 14 && moved.A.y === 14);
  check("moving a corner does not change the old position",
    s.A.x === C.START.A.x && s.touches === 0 && moved.touches === 1);
  check("an unknown corner or a non-finite point is ignored",
    C.moveVertex(s, "Z", pt([1, 1])) === s && C.moveVertex(s, "A", pt([NaN, 3])) === s);
  const shifted = C.moveAll(s, 12, -7);
  check("the whole triangle can be dragged",
    dist(shifted.A, pt([s.A.x + 12, s.A.y - 7])) < 1e-12 &&
    dist(shifted.B, pt([s.B.x + 12, s.B.y - 7])) < 1e-12 &&
    dist(shifted.C, pt([s.C.x + 12, s.C.y - 7])) < 1e-12 && shifted.touches === 1);
  check("a whole-triangle drag also clamps to the board", C.moveAll(s, 1e4, -1e4).A.y === 14);
  check("Show names and the mode change no geometry",
    (() => {
      const g1 = C.construct(s.A, s.B, s.C);
      const o = C.setOption(C.setOption(s, "names", true), "mode", "KO");
      const g2 = C.construct(o.A, o.B, o.C);
      return dist(g1.K, g2.K) === 0 && dist(g1.primes[0], g2.primes[0]) === 0 &&
        dist(g1.O, g2.O) === 0;
    })());
  check("GeoSDoub.Intersect returns NaN for parallel lines, as in the applet",
    Number.isNaN(C.intersect(pt([0, 0]), pt([10, 0]), pt([0, 3]), pt([10, 3])).x));
  check("a degenerate triangle has no finite construction",
    C.construct(pt([0, 0]), pt([10, 0]), pt([20, 0])).valid === false);
  check("the status line describes each mode and the degenerate case",
    C.label(C.construct(s.A, s.B, s.C), "grebe").includes("A–A") &&
    C.label(C.construct(s.A, s.B, s.C), "OK").includes("circumcentres") &&
    C.label(C.construct(s.A, s.B, s.C), "KO").includes("Lemoine points") &&
    C.label({ valid: false }, "grebe").includes("corners apart"));

  const rand0 = rng(2718);
  const starts = [];
  for (let i = 0; i < 2000 && starts.length < 200; i++) {
    const t = [0, 1, 2].map(() => pt([20 + rand0() * 560, 20 + rand0() * 510]));
    if (C.construct(...t).valid && Math.abs(C.twiceArea(...t)) > 2000) starts.push(t);
  }
  check("200 random triangles are non-degenerate and finite", starts.length === 200);
}

/* --------------------------- 2. the page's claims, over many triangles */

const handPicked = [
  [[200, 285], [300, 285], [225, 211.69872981077808]], // the opening triangle
  [[100, 80], [500, 80], [300, 400]],                   // nearly equilateral
  [[80, 480], [520, 480], [80, 60]],                    // right angle at A
  [[90, 470], [510, 470], [300, 60]],                   // isosceles
  [[40, 280], [560, 280], [300, 296]],                  // very flat
  [[60, 60], [480, 140], [180, 470]],                   // scalene, obtuse
  [[240, 30], [215, 520], [560, 180]],                  // nearly vertical side
  [[20, 20], [580, 520], [20, 520]],                    // corners near the edges
];
const rand = rng(19521127);
const triangles = handPicked.map(([a, b, c]) => [pt(a), pt(b), pt(c)]);
for (let i = 0; i < 5000 && triangles.length < 508; i++) {
  const t = [0, 1, 2].map(() => pt([20 + rand() * 560, 20 + rand() * 510]));
  if (C.construct(...t).valid && Math.abs(C.twiceArea(...t)) > 2000) triangles.push(t);
}
check("the sample has 508 triangles, including the eight hand-picked shapes", triangles.length === 508);

const gs = triangles.map((t) => C.construct(...t));
check("every sampled triangle gives finite points for all three modes",
  gs.every((g) => g.valid && [g.K, g.O, ...g.primes, ...g.flankCentres, ...g.flankK]
    .every(C.finitePoint)));

{
  // The squares: FormSquare(A,B,CA,CB), FormSquare(B,C,AB,AC),
  // FormSquare(C,A,BC,BA) with GeoSDoub.Rotate's +Pi/2 and -Pi/2 turns.
  const squares = worst(gs, (g) => {
    const T = [g.A, g.B, g.C];
    const square = [g.corners.CA, g.corners.CB, g.corners.AB, g.corners.AC,
      g.corners.BC, g.corners.BA];
    let e = 0;
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      const u = T[i], v = T[j];
      const x = square[2 * i], y = square[2 * i + 1];
      const side = dist(u, v);
      e = Math.max(e,
        Math.abs(dist(u, x) - side) / side,
        Math.abs(dist(v, y) - side) / side,
        Math.abs(dist(x, y) - side) / side,
        Math.abs(cross(u, v, x, y)) / (side * side),
        Math.abs(Math.abs(cross(u, x, x, y)) / (side * side) - 1));
    }
    return e;
  });
  check("the three squares are squares with the applet's fixed quarter turn",
    near(squares, 1e-7), `largest relative error ${squares}`);

  // The page says K is the common (Lemoine) point of AA', BB', CC'.
  const concurrency = worst(gs, (g) => {
    const T = [g.A, g.B, g.C];
    const cev = [0, 1, 2].map((i) => C.intersect(T[i], g.primes[i],
      T[(i + 1) % 3], g.primes[(i + 1) % 3]));
    return Math.max(...cev.map((p) => onLine(p, T[0], g.K))) / Math.max(1, dist(g.A, g.B)) +
      Math.max(dist(cev[0], cev[1]), dist(cev[1], cev[2])) / Math.max(1, dist(g.A, g.B));
  });
  check("AA', BB' and CC' concur at K in all 508 triangles (Grebe's theorem)",
    near(concurrency, 1e-6), `largest relative gap ${concurrency}`);

  // K is the symmedian point: barycentrics a^2 : b^2 : c^2.
  const lemoine = worst(gs, (g) => {
    const b = C.barycentric(g.K, g.A, g.B, g.C);
    if (!b) return Infinity;
    const w = [C.sideSquares(g.B, g.C), C.sideSquares(g.C, g.A), C.sideSquares(g.A, g.B)];
    const sum = w.reduce((x, y) => x + y, 0);
    return Math.max(...b.map((v, i) => Math.abs(v - w[i] / sum)));
  });
  check("K has barycentric coordinates a^2:b^2:c^2, the Lemoine point",
    near(lemoine, 1e-6), `largest error ${lemoine}`);

  const closed = worst(gs, (g) =>
    dist(g.K, C.lemoineClosed(g.A, g.B, g.C)) / Math.max(1, dist(g.A, g.B)));
  check("the applet's reflected-median construction agrees with the closed form",
    near(closed, 1e-7), `largest relative error ${closed}`);

  // The outer sides' triangle is homothetic to ABC about K, with one fixed
  // factor r = (D - S)/D = 1 + S/(2*area) for the exterior winding.
  const homotheties = worst(gs, (g) => {
    const T = [g.A, g.B, g.C];
    const r = C.factor(g.A, g.B, g.C);
    let e = 0;
    for (let i = 0; i < 3; i++) {
      e = Math.max(e, equalPt(g.primes[i], {
        x: g.K.x + r * (T[i].x - g.K.x),
        y: g.K.y + r * (T[i].y - g.K.y),
      }, Math.max(1, dist(g.K, T[i]))));
    }
    return e;
  });
  check("A'B'C' = K + r(ABC - K) with r = (D - S)/D, for every triangle",
    near(homotheties, 1e-6), `largest relative error ${homotheties}`);

  const exterior = worst(gs.filter((g) => C.twiceArea(g.A, g.B, g.C) < 0), (g) => {
    const S = C.sideSquares(g.B, g.C) + C.sideSquares(g.C, g.A) + C.sideSquares(g.A, g.B);
    const area = Math.abs(C.twiceArea(g.A, g.B, g.C)) / 2;
    return Math.abs(C.factor(g.A, g.B, g.C) - (1 + S / (2 * area)));
  });
  check("for outer squares the scale is 1 + (a^2+b^2+c^2)/(2*area)",
    near(exterior, 1e-12), `largest error ${exterior}`);

  // "For K the distances to the sides are proportional to the sides."
  const distances = worst(gs, (g) => {
    const sides = [dist(g.B, g.C), dist(g.C, g.A), dist(g.A, g.B)];
    const ds = [C.distanceToSide(g.K, g.B, g.C), C.distanceToSide(g.K, g.C, g.A),
      C.distanceToSide(g.K, g.A, g.B)];
    const ss = sides.reduce((a, b) => a + b, 0);
    const dd = ds.reduce((a, b) => a + b, 0);
    return Math.max(...ds.map((d, i) => Math.abs(d / dd - sides[i] / ss)));
  });
  check("distances from K to the three sides are proportional to those sides",
    near(distances, 1e-7), `largest error ${distances}`);

  // van Lamoen (OK): the midlines of the squares meet at the circumcentres
  // of the flanks A,CA,BA; B,CB,AB; C,AC,BC, and A-Oa, B-Ob, C-Oc meet at K.
  const centres = worst(gs, (g) => {
    const flanks = [[g.A, g.corners.CA, g.corners.BA],
      [g.B, g.corners.CB, g.corners.AB],
      [g.C, g.corners.AC, g.corners.BC]];
    const scale = Math.max(1, dist(g.A, g.B));
    return Math.max(...flanks.map((f, i) =>
      dist(C.circumcenter(...f), g.flankCentres[i]) / scale));
  });
  check("Oa, Ob, Oc really are the circumcentres of the three flanks",
    near(centres, 1e-6), `largest relative error ${centres}`);

  const okConcur = worst(gs, (g) => {
    const T = [g.A, g.B, g.C];
    return Math.max(...[0, 1, 2].map((i) =>
      onLine(g.flankCentres[i], T[i], g.K) / Math.max(1, dist(T[i], g.K))));
  });
  check("A-Oa, B-Ob and C-Oc pass through K (O and K are friends)",
    near(okConcur, 1e-6), `largest relative error ${okConcur}`);

  const okHomothety = worst(gs, (g) => {
    const T = [g.A, g.B, g.C];
    const f = (1 + C.factor(g.A, g.B, g.C)) / 2;
    return Math.max(...[0, 1, 2].map((i) => equalPt(g.flankCentres[i], {
      x: g.K.x + f * (T[i].x - g.K.x),
      y: g.K.y + f * (T[i].y - g.K.y),
    }, Math.max(1, dist(g.K, T[i])))));
  });
  check("OaObOc is homothetic to ABC about K with factor (1+r)/2",
    near(okHomothety, 1e-6), `largest relative error ${okHomothety}`);

  // van Lamoen (KO): friendship is symmetric, so A-Ka, B-Kb, C-Kc meet at O.
  const koConcur = worst(gs, (g) => {
    const T = [g.A, g.B, g.C];
    return Math.max(...[0, 1, 2].map((i) =>
      onLine(g.flankK[i], T[i], g.O) / Math.max(1, dist(T[i], g.O))));
  });
  check("A-Ka, B-Kb and C-Kc pass through O (friendship is symmetric)",
    near(koConcur, 1e-6), `largest relative error ${koConcur}`);

  // Geometry, not a drawing trick: rigid motions and scaling behave.
  const e = gs[0];
  const shift = pt([37, -19]);
  const moved = C.construct(pt([e.A.x + shift.x, e.A.y + shift.y]),
    pt([e.B.x + shift.x, e.B.y + shift.y]), pt([e.C.x + shift.x, e.C.y + shift.y]));
  check("a translation moves every constructed point by the same amount",
    dist(moved.K, pt([e.K.x + shift.x, e.K.y + shift.y])) < 1e-7 &&
    moved.primes.every((p, i) => dist(p,
      pt([e.primes[i].x + shift.x, e.primes[i].y + shift.y])) < 1e-7) &&
    moved.flankCentres.every((p, i) => dist(p,
      pt([e.flankCentres[i].x + shift.x, e.flankCentres[i].y + shift.y])) < 1e-7));

  const scaled = C.construct(pt([e.A.x * 1.7, e.A.y * 1.7]),
    pt([e.B.x * 1.7, e.B.y * 1.7]), pt([e.C.x * 1.7, e.C.y * 1.7]));
  check("scaling the triangle scales K, A'B'C', O and the flank points too",
    dist(scaled.K, pt([e.K.x * 1.7, e.K.y * 1.7])) < 1e-7 &&
    Math.abs(C.factor(scaled.A, scaled.B, scaled.C) - C.factor(e.A, e.B, e.C)) < 1e-12 &&
    scaled.primes.every((p, i) => dist(p, pt([e.primes[i].x * 1.7, e.primes[i].y * 1.7])) < 1e-7) &&
    scaled.flankK.every((p, i) => dist(p, pt([e.flankK[i].x * 1.7, e.flankK[i].y * 1.7])) < 1e-7));

  const winding = gs.filter((g) => C.twiceArea(g.A, g.B, g.C) > 0);
  check("both windings occur in the sample, so the applet's fixed turn is exercised",
    winding.length > 0 && gs.length - winding.length > 0 &&
    winding.every((g) => C.factor(g.A, g.B, g.C) < 0));
}

/* ------------------- 3. a second transcription of the applet's bytecode */

/*
 * javap -c -p on GrebeCanvas.class and /tmp/coolmaths-geom/x/GeoSDoub.class:
 *
 * FormSquare(p, q, out0, out1):
 *   out0 = Rotate(p, q, +PI/2, +1); out1 = Rotate(q, p, +PI/2, -1).
 * Rotate(centre, point, angle, dir):
 *   x = centre.x + cos*(point.x-centre.x) - dir*sin*(point.y-centre.y)
 *   y = centre.y + dir*sin*(point.x-centre.x) + cos*(point.y-centre.y)
 * Intersect(p,q,r,s): a1=p.y-q.y, b1=q.x-p.x, c1=p.x*q.y-p.y*q.x,
 *   det=b1*a2-b2*a1; NaN if |det| < 1; x=(c1*b2-c2*b1)/det, y=(a1*c2-a2*c1)/det.
 * FindAngleBisector(p,q,r):
 *   t = acos(((pq^2+pr^2-qr^2)/2)/(pq*pr))/2;
 *   u = Rotate(p,q,t,orientation(p,q,r)); return Intersect(p,u,q,r).
 * FindAltitude(p,q,r): u=(p.x+r.y-q.y, p.y-r.x+q.x); Intersect(p,u,q,r).
 * ComputeLemoine(p,q,r):
 *   b1=bis(p,q,r), b2=bis(q,p,r), b3=bis(r,q,p);
 *   m1=mid(q,r), m2=mid(p,r), m3=mid(p,q);
 *   refl(p1,p2,p3) = 2*FindAltitude(p1,p2,p3) - p1;
 *   s1=Intersect(refl(m1,b1,p),p,q,r), s2=Intersect(refl(m2,b2,q),q,p,r),
 *   s3=Intersect(refl(m3,b3,r),r,p,q); return Intersect(s1,p,s2,q).
 * DrawOK: CO=Intersect(L2,L3), AO=Intersect(L3,L4), BO=Intersect(L4,L2),
 *   L2 through mid(B,AB),mid(C,AC), L3 through mid(C,BC),mid(A,BA),
 *   L4 through mid(A,CA),mid(B,CB).
 * DrawKO: O=FindCircumcenter(A,B,C); AK=ComputeLemoine(A,BA,CA),
 *   BK=ComputeLemoine(B,CB,AB), CK=ComputeLemoine(C,AC,BC).
 */
function jpRotate(centre, point, angle, dir) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = point.x - centre.x, dy = point.y - centre.y;
  return {
    x: centre.x + cos * dx - dir * sin * dy,
    y: centre.y + dir * sin * dx + cos * dy,
  };
}

// The core uses line coefficients; this transcription solves the parameric
// form rx*t + sx*u = c-a, which is a different algebraic route.
function jpIntersect(a, b, c, d) {
  const rx = b.x - a.x, ry = b.y - a.y;
  const sx = d.x - c.x, sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
  return { x: a.x + t * rx, y: a.y + t * ry };
}

function jpOrientation(p, q, r) {
  const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return s > 0 ? 1 : -1;
}

function jpBisect(p, q, r) {
  const pq = dist(p, q), pr = dist(p, r), qr = dist(q, r);
  const cos = ((pq * pq + pr * pr - qr * qr) / 2) / pq / pr;
  const u = jpRotate(p, q, Math.acos(cos) / 2, jpOrientation(p, q, r));
  return jpIntersect(p, u, q, r);
}

function jpAltitude(p, q, r) {
  const u = { x: p.x + r.y - q.y, y: p.y - r.x + q.x };
  return jpIntersect(p, u, q, r);
}

function jpReflect(p, q, r) {
  const foot = jpAltitude(p, q, r);
  return { x: 2 * foot.x - p.x, y: 2 * foot.y - p.y };
}

function jpLemoine(p, q, r) {
  const b1 = jpBisect(p, q, r), b2 = jpBisect(q, p, r), b3 = jpBisect(r, q, p);
  const m1 = mid(q, r), m2 = mid(p, r), m3 = mid(p, q);
  const s1 = jpIntersect(jpReflect(m1, b1, p), p, q, r);
  const s2 = jpIntersect(jpReflect(m2, b2, q), q, p, r);
  const s3 = jpIntersect(jpReflect(m3, b3, r), r, p, q);
  if (!Number.isFinite(s3.x)) return { x: NaN, y: NaN };
  return jpIntersect(s1, p, s2, q);
}

function jpCircumcenter(p, q, r) {
  const m1 = mid(p, q), m2 = mid(q, r);
  const a1 = { x: m1.x + q.y - p.y, y: m1.y - q.x + p.x };
  const a2 = { x: m2.x + r.y - q.y, y: m2.y - r.x + q.x };
  return jpIntersect(m1, a1, m2, a2);
}

function jpConstruct(A, B, Cc) {
  const corner = {};
  corner.CA = jpRotate(A, B, HALF, 1);
  corner.CB = jpRotate(B, A, HALF, -1);
  corner.AB = jpRotate(B, Cc, HALF, 1);
  corner.AC = jpRotate(Cc, B, HALF, -1);
  corner.BC = jpRotate(Cc, A, HALF, 1);
  corner.BA = jpRotate(A, Cc, HALF, -1);
  const K = jpLemoine(A, B, Cc);
  const outer = [jpIntersect(corner.AB, corner.AC, corner.BA, corner.BC),
    jpIntersect(corner.BA, corner.BC, corner.CA, corner.CB),
    jpIntersect(corner.CA, corner.CB, corner.AB, corner.AC)];
  const l2 = jpIntersect(mid(B, corner.AB), mid(Cc, corner.AC),
    mid(Cc, corner.BC), mid(A, corner.BA));
  const l3 = jpIntersect(mid(Cc, corner.BC), mid(A, corner.BA),
    mid(A, corner.CA), mid(B, corner.CB));
  const l4 = jpIntersect(mid(A, corner.CA), mid(B, corner.CB),
    mid(B, corner.AB), mid(Cc, corner.AC));
  const O = jpCircumcenter(A, B, Cc);
  const flankK = [jpLemoine(A, corner.BA, corner.CA),
    jpLemoine(B, corner.CB, corner.AB),
    jpLemoine(Cc, corner.AC, corner.BC)];
  return { K, corner, outer, centres: [l2, l3, l4],
    primes: [outer[1], outer[2], outer[0]],
    flankCentres: [l3, l4, l2], O, flankK,
    points: [K, corner.CA, corner.CB, corner.AB, corner.AC, corner.BC, corner.BA,
      outer[0], outer[1], outer[2], l2, l3, l4, O, ...flankK] };
}

{
  const err = worst(gs, (g) => {
    const j = jpConstruct(g.A, g.B, g.C);
    const mine = [g.K, g.corners.CA, g.corners.CB, g.corners.AB, g.corners.AC,
      g.corners.BC, g.corners.BA, g.outer[0], g.outer[1], g.outer[2],
      g.centreLines[0], g.centreLines[1], g.centreLines[2], g.O, ...g.flankK];
    return mine.reduce((m, p, i) => Math.max(m, equalPt(p, j.points[i],
      Math.max(1, dist(g.A, g.B)))), 0);
  });
  check("the core matches the javap transcription on all 508 triangles, point for point",
    near(err, 1e-6), `largest relative error ${err}`);

  const independent = worst(gs, (g) => {
    const j = jpConstruct(g.A, g.B, g.C);
    const scale = Math.max(1, dist(g.A, g.B));
    const kClosed = C.lemoineClosed(g.A, g.B, g.C);
    const r = C.factor(g.A, g.B, g.C);
    const T = [g.A, g.B, g.C];
    return Math.max(equalPt(j.K, kClosed, scale),
      ...j.primes.map((p, i) => equalPt(p, {
        x: kClosed.x + r * (T[i].x - kClosed.x),
        y: kClosed.y + r * (T[i].y - kClosed.y),
      }, scale)));
  });
  check("the transcription agrees with the closed form for K and A'B'C'",
    near(independent, 1e-6), `largest relative error ${independent}`);

  const example = jpConstruct(pt([200, 285]), pt([300, 285]), pt([225, 211.69872981077808]));
  check("the transcription reproduces hand-computed corners of the opening triangle",
    near(dist(example.primes[0], pt([84.0664535633, 385])), 1e-7) &&
    near(dist(example.K, pt([231.4788421635, 257.8475121041])), 1e-7) &&
    near(dist(example.flankCentres[0], pt([142.0332267816, 335])), 1e-7),
    `AP=${JSON.stringify(example.primes[0])}, K=${JSON.stringify(example.K)}`);

  check("both transcriptions return NaN on parallel lines",
    Number.isNaN(jpIntersect(pt([0, 0]), pt([10, 0]), pt([0, 3]), pt([10, 3])).x) &&
    Number.isNaN(jpLemoine(pt([0, 0]), pt([10, 0]), pt([20, 0])).x));
}

done("grebe");
