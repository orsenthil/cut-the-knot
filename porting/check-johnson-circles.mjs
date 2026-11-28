#!/usr/bin/env node
"use strict";

/*
 * Logic test for johnson-circles/johnson-circles-core.js.
 *
 *   node porting/check-johnson-circles.mjs
 *
 * The page's exact claim is "If three equal circles pass through a point, the
 * circle through their other three intersections is equal to them". Alongside
 * it the page lists the orthocentric system, the rhombi, the two homotheties
 * and the anticomplementary triangle; all are checked on a 12x12x12 grid of
 * centre positions plus 400 seeded random positions.
 *
 * Every derived point is also computed by a second, independent transcription
 * of the applet's own bytecode: GeoSDoub.Intersect(DoubCircle,DoubCircle) with
 * its X/Y branches, Other(), FindCircumcenter(), GetCircle(), Prorate() and
 * CTKGeometryPlus.Barycenter(), including Canvas.Compute()'s two-pixel guard.
 * The core instead uses the closed forms A = b + c, Q = a + b + c and so on.
 * Finally the page's "largest perimeter" claim is checked over every sampled
 * direction of each sideline, not just the winning configuration.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("johnson-circles/johnson-circles-core.js", "JohnsonCirclesCore");

const R = C.RADIUS;
const O = C.O;
const near = (v, limit = 1e-6) => Number.isFinite(v) && v < limit;
const worst = (items, fn) => items.reduce((m, x) => Math.max(m, fn(x)), 0);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const copy = (p) => ({ x: p.x, y: p.y });
const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/* ------------------------------------------- 1. the state and its edge cases */

{
  const s = C.start({});
  const angles = [C.ANGLES.Oa, C.ANGLES.Ob, C.ANGLES.Oc];
  const at = (a) => ({ x: O.x + R * Math.cos(a), y: O.y + R * Math.sin(a) });
  check("Canvas.init() opens with radius min(width,height)/5", R === 60 && C.VIEW.width === 420);
  check("the opening centres sit at 45°, 135° and -72° on the guide circle",
    ["Oa", "Ob", "Oc"].every((n, i) => dist(s[n], at(angles[i])) < 1e-9 &&
      near(Math.abs(dist(s[n], O) - R), 1e-9)));
  check("Canvas.Compute() uses the same two-pixel separation guard", C.separated(s) === true &&
    C.separated({ Oa: s.Oa, Ob: s.Oa, Oc: s.Oc }) === false);
  check("all five applet checkboxes start unchecked and an untouched demo has no result",
    C.OPTION_KEYS.length === 5 && C.OPTION_KEYS.every((k) => s.options[k] === false) &&
    C.result(s) === null);
  check("a degenerate configuration cannot be computed",
    C.compute({ Oa: s.Oa, Ob: s.Oa, Oc: s.Oc }).valid === false);

  const moved = C.moveCenter(s, "Oa", { x: O.x + 500, y: O.y + 500 });
  check("a dragged centre is restricted to the guide circle",
    near(Math.abs(dist(moved.Oa, O) - R), 1e-9) && moved.Oa.x > O.x && moved.Oa.y > O.y);
  check("moving a centre records an explored demo, without changing the old state",
    s.moves === 0 && s.explored === false && moved.moves === 1 && moved.explored === true &&
    C.result(moved) === "done");
  check("an unknown centre or a non-finite point is ignored",
    C.moveCenter(s, "Q", at(1)) === s && C.moveCenter(s, "Oa", { x: NaN, y: 1 }) === s);
  const toggled = C.setOption(s, "hint", true);
  check("a checkbox changes only the overlay, not the geometry",
    toggled.options.hint === true && toggled.explored === true &&
    ["Oa", "Ob", "Oc"].every((n) => dist(toggled[n], s[n]) === 0) &&
    C.setOption(s, "unknown", true) === s);
  const back = C.reset(toggled);
  check("Reset restores the opening centres and keeps the options",
    ["Oa", "Ob", "Oc"].every((n) => dist(back[n], s[n]) < 1e-9) &&
    back.options.hint === true && back.moves === 0 && C.result(back) === null);
  const rand = rng(7);
  const random = Array.from({ length: 50 }, () => C.randomStart(rand));
  check("50 new diagrams stay on the guide circle and are drawable",
    random.every((r) => ["Oa", "Ob", "Oc"].every((n) =>
      near(Math.abs(dist(r[n], O) - R), 1e-9)) && C.compute(r).valid));
}

/* ------------------ 2. a second transcription of the applet's own bytecode */

// javap -c -p on classes/JohnsonCircles.zip and classes/CTKGeometry.zip:
//   if (|x1-x2| > 1) IntersectCirclesX, else if (|y1-y2| > 1) IntersectCirclesY,
//   else return {center1, center1}.  Both branches solve a quadratic in the
//   varying coordinate; a negative discriminant returns null.
function intersectCirclesX(c1, c2) {
  const m = -(c1.y - c2.y) / (c1.x - c2.x);
  const b = (c1.x * c1.x - c2.x * c2.x + c1.y * c1.y - c2.y * c2.y -
    c1.r * c1.r + c2.r * c2.r) / (2 * (c1.x - c2.x));
  const x0 = b - c1.x;
  const aa = m * m + 1;
  const bb = m * x0 - c1.y;
  const cc = x0 * x0 + c1.y * c1.y - c1.r * c1.r;
  const disc = bb * bb - aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-bb + s) / aa, t2 = (-bb - s) / aa;
  return [{ x: m * t1 + b, y: t1 }, { x: m * t2 + b, y: t2 }];
}

// The Y branch solves a quadratic in x: y = m*x + b, and the two returned
// DoubPoints are (root, m*root + b) — the coordinates are swapped compared
// with the X branch, exactly as in the applet's bytecode.
function intersectCirclesY(c1, c2) {
  const m = -(c1.x - c2.x) / (c1.y - c2.y);
  const b = (c1.y * c1.y - c2.y * c2.y + c1.x * c1.x - c2.x * c2.x -
    c1.r * c1.r + c2.r * c2.r) / (2 * (c1.y - c2.y));
  const y0 = b - c1.y;
  const aa = m * m + 1;
  const bb = m * y0 - c1.x;
  const cc = y0 * y0 + c1.x * c1.x - c1.r * c1.r;
  const disc = bb * bb - aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-bb + s) / aa, t2 = (-bb - s) / aa;
  return [{ x: t1, y: m * t1 + b }, { x: t2, y: m * t2 + b }];
}

function intersectCircles(c1, c2) {
  if (Math.abs(c1.x - c2.x) > 1) return intersectCirclesX(c1, c2);
  if (Math.abs(c1.y - c2.y) > 1) return intersectCirclesY(c1, c2);
  return [copy(c1), copy(c1)];
}

// Canvas.Other(DoubPoint[], DoubPoint): the point at least one pixel from O.
function other(points, circle) {
  if (!points) return null;
  return dist(points[0], circle) < 1 ? points[1] : points[0];
}

// GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint).
function lineIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}

function findCircumcenter(a, b, c) {
  const ab = midpoint(a, b), bc = midpoint(b, c);
  const p = { x: ab.x + (b.y - a.y), y: ab.y - (b.x - a.x) };
  const q = { x: bc.x + (c.y - b.y), y: bc.y - (c.x - b.x) };
  return lineIntersect(ab, p, bc, q);
}

// Canvas.GetCircle(): circumcentre, then the average of the three radii.
function getCircle(a, b, c) {
  const centre = findCircumcenter(a, b, c);
  return { c: centre, r: (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3 };
}

// CTKGeometryPlus.Prorate(from, to, length).
function prorate(from, to, length) {
  const d = dist(from, to);
  if (d < 0.1) return copy(from);
  const k = length / d;
  return { x: from.x + k * (to.x - from.x), y: from.y + k * (to.y - from.y) };
}

// CTKGeometryPlus.Barycenter(a, b, c).
function barycenter(a, b, c) {
  return {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3,
  };
}

// Canvas.Compute(), in the bytecode's own order.
function bytecodeCompute(Oa, Ob, Oc) {
  if (dist(Oa, Ob) < 2 || dist(Ob, Oc) < 2 || dist(Oc, Oa) < 2) return null;
  const guide = { x: O.x, y: O.y, r: R };
  const circleA = { x: Oa.x, y: Oa.y, r: R };
  const circleB = { x: Ob.x, y: Ob.y, r: R };
  const circleC = { x: Oc.x, y: Oc.y, r: R };
  const A = other(intersectCircles(circleB, circleC), guide);
  const B = other(intersectCircles(circleC, circleA), guide);
  const Cc = other(intersectCircles(circleA, circleB), guide);
  if (![A, B, Cc].every(finite)) return null;
  const circle = getCircle(A, B, Cc);
  if (!finite(circle.c) || !Number.isFinite(circle.r)) return null;
  const antiCircle = { c: copy(O), r: 2 * R };
  const Ap = prorate(O, circleA, 2 * R);
  const Bp = prorate(O, circleB, 2 * R);
  const Cp = prorate(O, circleC, 2 * R);
  const N = barycenter(
    lineIntersect(A, circleA, B, circleB),
    lineIntersect(B, circleB, Cc, circleC),
    lineIntersect(Cc, circleC, A, circleA),
  );
  return { A, B, C: Cc, circle, antiCircle, Ap, Bp, Cp, N };
}

/* ------------------------------------- 3. the sampled centre configurations */

const onGuide = C.onGuide;
const grid = Array.from({ length: 12 }, (_, i) => (i * 2 * Math.PI) / 12);
const centres = grid.flatMap((aa) => grid.flatMap((bb) => grid.map((cc) =>
  [onGuide(aa), onGuide(bb), onGuide(cc)])));
centres.push([C.START.Oa, C.START.Ob, C.START.Oc]);
const rand = rng(20261127);
for (let i = 0; i < 400; i++) {
  centres.push([onGuide(rand() * 2 * Math.PI), onGuide(rand() * 2 * Math.PI),
    onGuide(rand() * 2 * Math.PI)]);
}

const cases = [];
for (const [Oa, Ob, Oc] of centres) {
  const state = { Oa, Ob, Oc };
  const g = C.compute(state);
  const ref = bytecodeCompute(Oa, Ob, Oc);
  if (!g.valid || !ref || !finite(ref.N)) continue;
  // The applet's own one-pixel test cannot pick the "other" intersection when
  // two circles are tangent at O; those near-degenerate layouts are skipped.
  if (Math.min(dist(g.A, O), dist(g.B, O), dist(g.C, O)) <= 3) continue;
  cases.push({ state, g, ref });
}
check("2129 layouts were sampled and 1000+ non-degenerate ones can be drawn",
  centres.length === 2129 && cases.length > 1000, `${cases.length} usable, ${centres.length} sampled`);

const gs = cases.map((x) => x.g);

{
  // Both branches of the applet's circle intersection must be exercised: the
  // Y branch returns (root, m*root + b), not the X branch's (m*root + b, root).
  const vertical = intersectCircles({ x: 210, y: 100, r: R }, { x: 210, y: 220, r: R });
  check("the bytecode's Y branch finds the tangent point of vertically aligned circles",
    near(dist(vertical[0], { x: 210, y: 160 }), 1e-9));
  const horizontal = intersectCircles({ x: 150, y: 150, r: R }, { x: 270, y: 150, r: R });
  check("the bytecode's X branch finds the tangent point of sideways aligned circles",
    near(dist(horizontal[0], { x: 210, y: 150 }), 1e-9));

  const err = worst(cases, ({ g, ref }) => Math.max(
    dist(g.A, ref.A), dist(g.B, ref.B), dist(g.C, ref.C)));
  check("A, B, C match GeoSDoub.Intersect and Other() at every sampled layout",
    near(err, 1e-5), `largest error ${err}`);

  const centreErr = worst(cases, ({ g, ref }) => dist(g.circle.c, ref.circle.c));
  const radiusErr = worst(cases, ({ g, ref }) => Math.abs(g.circle.r - ref.circle.r));
  check("Canvas.GetCircle() finds circumcentre Q = a + b + c in every layout",
    near(centreErr, 1e-5), `largest error ${centreErr}`);
  check("Canvas.GetCircle()'s mean radius equals the analytic radius r",
    near(radiusErr, 1e-5), `largest error ${radiusErr}`);

  const antiErr = worst(cases, ({ g, ref }) => dist(g.antiCircle.c, ref.antiCircle.c) +
    Math.abs(g.antiCircle.r - ref.antiCircle.r));
  check("the anticomplementary circle matches the applet's DoubCircle(O,2r)",
    near(antiErr, 1e-9));

  const prorateErr = worst(cases, ({ g, ref }) => Math.max(
    dist(g.Ap, ref.Ap), dist(g.Bp, ref.Bp), dist(g.Cp, ref.Cp)));
  check("CTKGeometryPlus.Prorate() gives A'=2a, B'=2b, C'=2c",
    near(prorateErr, 1e-9), `largest error ${prorateErr}`);

  const nErr = worst(cases, ({ g, ref }) => dist(g.N, ref.N));
  check("CTKGeometryPlus.Barycenter() of the three centre lines is N = Q/2",
    near(nErr, 1e-4), `largest error ${nErr}`);
}

/* ----------------------------------- 4. every claim made by the article */

{
  // The main theorem, verbatim: the fourth circle has the same radius.
  const claim = worst(gs, (g) => Math.max(
    Math.abs(g.circle.r - g.r),
    Math.abs(dist(g.circle.c, g.A) - g.r),
    Math.abs(dist(g.circle.c, g.B) - g.r),
    Math.abs(dist(g.circle.c, g.C) - g.r),
  ));
  check("If three equal circles pass through a point, the circle through their other three intersections is equal to them",
    near(claim, 1e-9), `largest error ${claim}`);

  const orth = worst(gs, (g) => Math.max(
    Math.abs(dot(sub(g.A, O), sub(g.C, g.B))),
    Math.abs(dot(sub(g.B, O), sub(g.A, g.C))),
    Math.abs(dot(sub(g.C, O), sub(g.B, g.A))),
  ));
  check("O is the orthocenter of ABC: OA ⟂ BC, OB ⟂ CA, OC ⟂ AB",
    near(orth, 1e-8), `largest dot product ${orth}`);

  const centresOn = worst(gs, (g) => {
    let e = 0;
    for (const [centre, p, q] of [[g.Oa, O, g.B], [g.Oa, O, g.C],
      [g.Ob, O, g.C], [g.Ob, O, g.A], [g.Oc, O, g.A], [g.Oc, O, g.B]]) {
      e = Math.max(e, Math.abs(dist(centre, p) - g.r), Math.abs(dist(centre, q) - g.r));
    }
    return e;
  });
  check("Oa, Ob, Oc are the circumcentres of OBC, OCA and OAB", near(centresOn, 1e-9));

  const rhombi = worst(gs, (g) => {
    let e = 0;
    for (const quad of g.rhombi) {
      for (let i = 0; i < 4; i++) e = Math.max(e, Math.abs(dist(quad[i], quad[(i + 1) % 4]) - g.r));
    }
    return e;
  });
  check("A-Ob-O-Oc, C-Oa-O-Ob and B-Oc-O-Oa are adjacent rhombi of side r",
    near(rhombi, 1e-8), `largest side error ${rhombi}`);

  const parallel = worst(gs, (g) => {
    const ab = sub(g.B, g.A), oaob = sub(g.Oa, g.Ob);
    return dist(ab, oaob);
  });
  check("AB has the same length and direction as OaOb", near(parallel, 1e-9),
    `largest vector error ${parallel}`);

  // Keep Oa and Ob fixed: moving Oc may not change AB at all.
  const fixed = [onGuide(0.3), onGuide(2.1)];
  const abFor = (angle) => {
    const g = C.compute({ Oa: fixed[0], Ob: fixed[1], Oc: onGuide(angle) });
    return sub(g.B, g.A);
  };
  const firstAB = abFor(0.9);
  check("AB is unchanged for every position of Oc with Oa and Ob fixed",
    [2.4, 3.5, 4.8, 5.9].every((a) => dist(abFor(a), firstAB) < 1e-9));

  const congruent = worst(gs, (g) => {
    const s1 = [dist(g.A, g.B), dist(g.B, g.C), dist(g.C, g.A)];
    const s2 = [dist(g.Oa, g.Ob), dist(g.Ob, g.Oc), dist(g.Oc, g.Oa)];
    return Math.max(...s1.map((v, i) => Math.abs(v - s2[i])));
  });
  check("triangles ABC and OaObOc are equal (congruent)", near(congruent, 1e-9));

  const homothety = worst(gs, (g) => Math.max(
    dist(sub(g.Q, g.Oa), sub(g.A, O)),
    dist(sub(g.Q, g.Ob), sub(g.B, O)),
    dist(sub(g.Q, g.Oc), sub(g.C, O)),
    dist(sub(g.N, O), sub(g.Q, g.N)),
  ));
  check("homothety with coefficient -1 about the midpoint of OQ maps Oa→A, Ob→B, Oc→C",
    near(homothety, 1e-9));

  const nine = worst(gs, (g) => {
    const mids = [midpoint(g.Oa, g.Ob), midpoint(g.Ob, g.Oc), midpoint(g.Oc, g.Oa)];
    return Math.max(...mids.map((m) => Math.abs(dist(g.N, m) - g.r / 2)));
  });
  check("N is the nine-point centre of OaObOc: its midpoints are r/2 away", near(nine, 1e-9));

  const euler = worst(gs, (g) => {
    // Q = a+b+c is the orthocenter of OaObOc, so OQ is its Euler line;
    // O is the circumcentre, and ABC has Q as circumcentre and O as orthocenter.
    return Math.max(
      Math.abs(dot(sub(g.Oa, g.Q), sub(g.Ob, g.Oc))),
      Math.abs(dot(sub(g.Ob, g.Q), sub(g.Oc, g.Oa))),
      Math.abs(dot(sub(g.Oc, g.Q), sub(g.Oa, g.Ob))),
      Math.abs(dist(g.Q, g.A) - g.r),
      Math.abs(dist(g.Q, g.B) - g.r),
      Math.abs(dist(g.Q, g.C) - g.r),
    );
  });
  check("Q is the orthocenter of OaObOc and the circumcenter of ABC (Euler line OQ)",
    near(euler, 1e-8));

  const anti = worst(gs, (g) => Math.max(
    dist(g.Ap, { x: O.x + 2 * (g.Oa.x - O.x), y: O.y + 2 * (g.Oa.y - O.y) }),
    dist(g.Bp, { x: O.x + 2 * (g.Ob.x - O.x), y: O.y + 2 * (g.Ob.y - O.y) }),
    dist(g.Cp, { x: O.x + 2 * (g.Oc.x - O.x), y: O.y + 2 * (g.Oc.y - O.y) }),
    Math.abs(dist(g.Ap, O) - 2 * g.r),
    Math.abs(dist(g.Oa, g.Ap) - g.r),
  ));
  check("the anticomplementary triangle has OA', OB', OC' as diameters of the three circles",
    near(anti, 1e-9));

  const antiHomothety = worst(gs, (g) => Math.max(
    dist(sub(g.Ap, O), { x: 2 * (g.Oa.x - O.x), y: 2 * (g.Oa.y - O.y) }),
    dist(sub(g.Bp, O), { x: 2 * (g.Ob.x - O.x), y: 2 * (g.Ob.y - O.y) }),
    dist(sub(g.Cp, O), { x: 2 * (g.Oc.x - O.x), y: 2 * (g.Oc.y - O.y) }),
  ));
  check("A'B'C' and OaObOc are homothetic with coefficient 2 and centre O",
    near(antiHomothety, 1e-9));

  // A'B'C' is the anticomplementary triangle of ABC: its side midpoints are
  // A, B and C, and each of its sides is parallel to the matching side of ABC.
  const anticomplementary = worst(gs, (g) => Math.max(
    dist(midpoint(g.Bp, g.Cp), g.A),
    dist(midpoint(g.Cp, g.Ap), g.B),
    dist(midpoint(g.Ap, g.Bp), g.C),
  ));
  check("A, B, C are the midpoints of B'C', C'A' and A'B'", near(anticomplementary, 1e-9));
}

/* ----------------------- 5. the page's "largest perimeter" claim, exhaustively */

// A line through C (which lies on both the a- and b-circles) meets those
// circles again at C - 2((C-a)·u)u and C - 2((C-b)·u)u. Their separation is
// 2|(b-a)·u|, never more than the distance between the two centres, with
// equality only when the line is parallel to OaOb. The same holds cyclically,
// so no triangle with sides through A, B, C can outgrow A'B'C'.
function sidelineEnds(through, centre1, centre2, u) {
  const p = sub(through, centre1), q = sub(through, centre2);
  return [
    { x: through.x - 2 * dot(p, u) * u.x, y: through.y - 2 * dot(p, u) * u.y },
    { x: through.x - 2 * dot(q, u) * u.x, y: through.y - 2 * dot(q, u) * u.y },
  ];
}

{
  const K = 96;
  const directions = Array.from({ length: K }, (_, i) => ({
    x: Math.cos((2 * Math.PI * i) / K), y: Math.sin((2 * Math.PI * i) / K),
  }));
  let violations = 0;
  let maxOver = 0;
  for (const g of gs) {
    const specs = [
      [g.C, g.Oa, g.Ob, dist(g.Oa, g.Ob)],
      [g.A, g.Ob, g.Oc, dist(g.Ob, g.Oc)],
      [g.B, g.Oc, g.Oa, dist(g.Oc, g.Oa)],
    ];
    for (const [through, c1, c2, centresApart] of specs) {
      for (const u of directions) {
        const [p, q] = sidelineEnds(through, c1, c2, u);
        const excess = dist(p, q) - 2 * centresApart;
        if (excess > 1e-8) violations++;
        maxOver = Math.max(maxOver, excess);
      }
    }
  }
  check(`no sideline direction beats twice the centre distance (${gs.length * K * 3} sides)`,
    violations === 0, `${violations} violations, largest excess ${maxOver}`);

  const attained = worst(gs, (g) => {
    const target = [dist(g.Ob, g.Oc), dist(g.Oc, g.Oa), dist(g.Oa, g.Ob)];
    const sides = [dist(g.Bp, g.Cp), dist(g.Cp, g.Ap), dist(g.Ap, g.Bp)];
    return Math.max(...sides.map((s, i) => Math.abs(s - 2 * target[i])));
  });
  check("A'B'C' attains the bound: each side is twice the matching line of centres",
    near(attained, 1e-8), `largest error ${attained}`);

  const perimeters = worst(gs, (g) => {
    const antiPerimeter = dist(g.Bp, g.Cp) + dist(g.Cp, g.Ap) + dist(g.Ap, g.Bp);
    const centrePerimeter = dist(g.Oa, g.Ob) + dist(g.Ob, g.Oc) + dist(g.Oc, g.Oa);
    return Math.abs(antiPerimeter - 2 * centrePerimeter);
  });
  check("the perimeter of A'B'C' is twice that of OaObOc", near(perimeters, 1e-8));
}

/* --------------------------------------------- 6. the page and the demo state */

{
  const s = C.start({});
  const g = C.compute(s);
  check("the status line reports the radius invariant on the opening diagram",
    C.describe(g).includes("60") && C.describe(g).includes("same radius"));
  check("a broken diagram gets a helpful status line instead of NaN coordinates",
    C.describe(C.compute({ Oa: s.Oa, Ob: s.Oa, Oc: s.Oc })).includes("centres apart"));
  const explored = C.setOption(C.setOption(s, "names", true), "hint", true);
  const plain = C.compute(explored);
  check("showing the five overlays never changes a single computed point",
    ["A", "B", "C", "Q", "N", "Ap", "Bp", "Cp"].every((n) => dist(plain[n], g[n]) === 0));
}

done("johnson-circles");
