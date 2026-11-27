#!/usr/bin/env node
"use strict";

/*
 * Logic test for cyclic-incenters/cyclic-incenters-core.js.
 *
 *   node porting/check-cyclic-incenters.mjs
 *
 * Checks the applet's start position and all sixteen checkboxes, then, on
 * fixed and ~1200 generated circumscribed quadrilaterals, every claim on the
 * cut-the-knot page: the four tangents are at distance r from the centre;
 * the diagonal intersection of the tangential quadrilateral is the diagonal
 * intersection of the inscribed one; XZ and YW pass through it; X, Y, Z, W
 * lie on one circle whose centre is A'C' ∩ B'D'; the exsimilicenters R and Q
 * lie on XY/ZW and YZ/WX with RX·RY = RZ·RW; and 1/x + 1/z = 1/y + 1/w.
 * Finally the whole construction is written a second time, literally from
 * the applet's bytecode (GeoSDoub.FindIncenter / NearestPoint / FindCircumcenter
 * / Intersect and the canvas's GetCircle / GetIncircle / GetTangent /
 * Properties), and compared with the core over hundreds of configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cyclic-incenters/cyclic-incenters-core.js", "CyclicIncentersCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tolOf = (q) => 1e-6 * Math.max(1, ...q.flatMap((p, i) =>
  q.slice(i + 1).map((r) => dist(p, r))));

/* Four tangent points, in order, with every gap under a half turn: that is
 * exactly when the applet's tangential quadrilateral is convex. */
function tangentPoints(angles, radius = C.RADIUS) {
  return angles.map((t) => P(C.CENTER.x + radius * Math.cos(t), C.CENTER.y - radius * Math.sin(t)));
}
function generatedQuad(rand) {
  const gaps = [0.35 + rand() * 2.2, 0.35 + rand() * 2.2, 0.35 + rand() * 2.2];
  gaps.push(2 * Math.PI - gaps.reduce((a, b) => a + b, 0));
  if (gaps[3] < 0.35 || gaps[3] > 2.6) return null;
  let t = 0;
  const angles = gaps.slice(0, 3).map((g) => { const a = t; t += g; return a; });
  angles.push(t);
  return tangentPoints(angles);
}

/* --------------------------------- the applet's own arithmetic, from bytecode */

/* GeoSDoub.ComputeAngle — acos of the cosine law, no clamping. */
function apAngle(a, b, c) {
  const sq = (u, v) => (u.x - v.x) ** 2 + (u.y - v.y) ** 2;
  const cos = (sq(a, b) + sq(a, c) - sq(b, c)) / (2 * Math.sqrt(sq(a, b)) * Math.sqrt(sq(a, c)));
  return Math.acos(cos);
}
/* GeoSDoub.FindOrientation. */
function apOrientation(a, b, c) {
  const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return s > 0 ? 1 : -1;
}
/* GeoSDoub.Rotate. */
function apRotate(a, b, t, o) {
  const cs = Math.cos(t), sn = Math.sin(t);
  return P(a.x + cs * (b.x - a.x) - o * sn * (b.y - a.y),
    a.y + o * sn * (b.x - a.x) + cs * (b.y - a.y));
}
/* GeoSDoub.FindIncenter: two rotated rays, then their intersection. */
function apIncenter(a, b, c) {
  const o = apOrientation(a, b, c);
  return apIntersect(a, apRotate(a, b, apAngle(a, b, c) / 2, o),
    b, apRotate(b, c, apAngle(b, c, a) / 2, o));
}
/* GeoSDoub.Intersect — the |det| < 1 fallback to NaN, as in the class file. */
function apIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}
/* GeoSDoub.NearestPoint. */
function apNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * dx + dy * dy < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + dx * t, a.y + dy * t);
}
/* Canvas GetIncircle: FindIncenter, then the mean of three side distances. */
function apIncircle(a, b, c) {
  const I = apIncenter(a, b, c);
  return {
    c: I,
    r: (dist(I, apNearest(I, a, b)) + dist(I, apNearest(I, b, c))
      + dist(I, apNearest(I, c, a))) / 3,
  };
}
/* GeoSDoub.FindCircumcenter and the canvas's GetCircle mean radius. */
function apCircle(a, b, c) {
  const m1 = P((a.x + b.x) / 2, (a.y + b.y) / 2);
  const m2 = P((b.x + c.x) / 2, (b.y + c.y) / 2);
  const o = apIntersect(
    m1, P(m1.x + b.y - a.y, m1.y + a.x - b.x),
    m2, P(m2.x + c.y - b.y, m2.y + b.x - c.x),
  );
  return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
}
/* Canvas GetTangent(circle, point): a line through p at right angles to
 * the radius; the second point is p + (-dy, dx). */
function apTangent(circle, p) {
  return { a: p, b: P(p.x - (p.y - circle.c.y), p.y + (p.x - circle.c.x)) };
}
function apLineIntersection(l1, l2) {
  return apIntersect(l1.a, l1.b, l2.a, l2.b);
}
/* DrawConfiguration + Properties, in the bytecode's own order. */
function apConfiguration(A, B, Cc, D) {
  const main = apCircle(A, B, Cc);
  const tangents = [A, B, Cc, D].map((p) => apTangent(main, p));
  const quad = tangents.map((line, i) =>
    apLineIntersection(line, tangents[(i + 1) % 4]));
  const [AB, BC, CD, DA] = quad;
  const P0 = apIntersect(AB, CD, BC, DA);
  const Q = apIntersect(A, Cc, B, D);
  const small = [apIncircle(P0, AB, BC), apIncircle(P0, BC, CD),
    apIncircle(P0, CD, DA), apIncircle(P0, DA, AB)];
  const claim = apCircle(small[0].c, small[1].c, small[2].c);
  const big = [apIncircle(DA, CD, BC), apIncircle(DA, AB, BC),
    apIncircle(AB, CD, BC), apIncircle(AB, CD, DA)];
  const center = apIntersect(big[1].c, big[0].c, big[3].c, big[2].c);
  return { main, tangents, quad, P: P0, Q, small, claim, big, center };
}

/* ------------------------------------------------ 1. start position and rules */

{
  const s = C.start();
  const expected = tangentPoints([0, 1.2, 2.9, 4.5]);
  C.POINT_KEYS.forEach((key, i) => equal(`init() puts ${key} at the applet's angle`, s[key], expected[i]));
  equal("the applet's circle has centre (200,125)", C.CENTER, P(200, 125));
  check("the applet's radius is min(width,height)/4", C.RADIUS === 62.5);
  check("all sixteen checkboxes start unchecked",
    C.OPTION_KEYS.length === 16 && C.OPTION_KEYS.every((key) => !s.options[key]));
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  const moved = C.move(s, "A", P(1, 1));
  check("dragging a point keeps it on the circle", close(dist(moved.A, C.CENTER), C.RADIUS, 1e-9));
  check("dragging marks the diagram explored", moved.explored && !s.explored);
  check("an unknown point is ignored", C.move(s, "Z", P(1, 1)) === s);
  check("a non-finite point is ignored", closePoint(C.move(s, "B", P(NaN, 4)).B, s.B, 1e-12)
    && !C.move(s, "B", P(NaN, 4)).explored);
  check("the centre itself is not a legal position",
    closePoint(C.move(s, "B", C.CENTER).B, s.B, 1e-12));
  check("snapping onto the centre keeps the last point", closePoint(C.snap(C.CENTER, s.B), s.B, 1e-12));
  const opts = C.setOption(C.setOption(s, "circle", true), "tangents", true);
  check("checkboxes change independently", opts.options.circle && opts.options.tangents
    && !opts.options.names);
  check("an unknown checkbox is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(opts);
  check("Reset restores all four points", C.POINT_KEYS.every((key) =>
    closePoint(r[key], s[key], 1e-12)));
  check("Reset keeps the checkboxes", r.options.circle && r.options.tangents && r.explored);
  check("the status speaks about the incenters", /X, Y, Z, W/.test(C.describe(s)));
}

/* ---------------------------------- 2. fixed configurations and page claims */

const fixed = [
  ["the applet's start", tangentPoints([0, 1.2, 2.9, 4.5])],
  ["four even quarters", tangentPoints([0, Math.PI / 2, Math.PI, 3 * Math.PI / 2])],
  ["a narrow first gap", tangentPoints([0, 0.5, 2.0, 4.0])],
  ["a wide third gap", tangentPoints([0, 0.8, 1.6, 4.1])],
  ["a tilted circle", tangentPoints([0.3, 1.4, 3.1, 5.0])],
];

function claimBundle(label, q) {
  const g = C.compute(...q);
  const tol = tolOf(q);
  check(`${label}: the construction exists`, !!g);
  if (!g) return;
  check(`${label}: all four tangents stay at distance r from the centre`,
    g.claims.tangentSides, `error ${g.measures.tangentError}`);
  check(`${label}: the tangential and inscribed diagonals meet at one point`,
    g.claims.sameDiagonals, `distance ${g.measures.diagonalError}`);
  check(`${label}: XZ and YW pass through the diagonal point`,
    g.claims.throughP, `${g.measures.xzError}, ${g.measures.ywError}`);
  check(`${label}: X, Y, Z, W are concyclic (the page's main claim)`,
    g.claims.concyclic, `W off by ${g.measures.circleError}`);
  check(`${label}: the circle's centre is A'C' ∩ B'D'`,
    g.claims.centerOfCircle, `distance ${g.measures.centerError}`);
  check(`${label}: R lies on XY and ZW, Q on YZ and WX`,
    g.claims.exsimilicenter, JSON.stringify(g.measures));
  check(`${label}: RX·RY = RZ·RW`, g.claims.power, `error ${g.measures.powerError}`);
  check(`${label}: 1/x + 1/z = 1/y + 1/w`, g.claims.radii);
  check(`${label}: the second iteration is concyclic too`, g.claims.secondConcyclic);
  check(`${label}: the status reports no error`, /are on one circle/.test(
    C.describe({ A: q[0], B: q[1], C: q[2], D: q[3], options: {}, explored: true })));
}

for (const [label, q] of fixed) claimBundle(label, q);

/* --------------------------------- 3. hundreds of generated configurations */

{
  const rand = rng(3992);
  let tested = 0, failures = 0, worst = 0;
  for (let trial = 0; trial < 1800; trial++) {
    const q = generatedQuad(rand);
    if (!q) continue;
    const g = C.compute(...q);
    if (!g) continue;
    tested++;
    worst = Math.max(worst, g.measures.circleError);
    const bad = Object.entries(g.claims).filter(([, ok]) => !ok).map(([k]) => k);
    if (bad.length) {
      failures++;
      check(`generated ${trial}: every claim holds`, false, `${bad.join(",")} ${JSON.stringify(g.measures)}`);
    }
  }
  check(`all page claims hold on ${tested} generated quadrilaterals`,
    tested > 1000 && failures === 0, `${failures} failures, worst circle error ${worst}`);
  check("the worst W error is far below a drawing pixel", worst < 1e-6, `worst ${worst}`);

  // Make the same four points at a different radius: the theorem is scale free.
  const rand2 = rng(777);
  let scaled = 0;
  for (let trial = 0; trial < 200; trial++) {
    const q = generatedQuad(rand2);
    if (!q) continue;
    const k = 0.5 + rand2() * 2;
    const about = tangentPoints([0.2, 1.3, 2.8, 4.6], C.RADIUS * k);
    const g = C.compute(...about);
    if (!g) continue;
    scaled++;
    if (!g.claims.concyclic) check(`scaled ${trial}: still concyclic`, false);
  }
  check(`the claim survives ${scaled} changes of scale`, scaled > 100);
}

/* --------------------- 4. the same points from the applet's own bytecode method */

{
  const compare = (label, q) => {
    const g = C.compute(...q);
    const ap = apConfiguration(...q);
    if (!g || !Number.isFinite(ap.claim.c.x)) return false;
    const tol = 2e-6 * tolOf(q);
    const pairs = [
      ["main circle centre", g.main.c, ap.main.c],
      ["tangential vertex AB", g.quad[0], ap.quad[0]],
      ["tangential vertex BC", g.quad[1], ap.quad[1]],
      ["tangential vertex CD", g.quad[2], ap.quad[2]],
      ["tangential vertex DA", g.quad[3], ap.quad[3]],
      ["tangential diagonals' point", g.P, ap.P],
      ["inscribed diagonals' point", g.Q, ap.Q],
      ["X", g.X, ap.small[0].c],
      ["Y", g.Y, ap.small[1].c],
      ["Z", g.Z, ap.small[2].c],
      ["W", g.W, ap.small[3].c],
      ["the claimed circle's centre", g.claim.c, ap.claim.c],
      ["A' (big circle U)", g.big[1].c, ap.big[1].c],
      ["B' (big circle t)", g.big[2].c, ap.big[2].c],
      ["C' (big circle u)", g.big[0].c, ap.big[0].c],
      ["D' (big circle T)", g.big[3].c, ap.big[3].c],
      ["O', the centre from the big circles", g.center, ap.center],
    ];
    let ok = true;
    for (const [name, a, b] of pairs) {
      if (!closePoint(a, b, tol)) {
        check(`${label}: core ${name} matches the applet's bytecode`, false,
          `applet ${JSON.stringify(b)}, core ${JSON.stringify(a)}`);
        ok = false;
      }
    }
    const numbers = [
      ["main radius", g.main.r, ap.main.r],
      ["claim radius", g.claim.r, ap.claim.r],
      ["inradius x", g.small[0].r, ap.small[0].r],
      ["inradius y", g.small[1].r, ap.small[1].r],
      ["inradius z", g.small[2].r, ap.small[2].r],
      ["inradius w", g.small[3].r, ap.small[3].r],
    ];
    for (const [name, a, b] of numbers) {
      if (!close(a, b, tol)) {
        check(`${label}: core ${name} matches the applet's bytecode`, false, `${a} vs ${b}`);
        ok = false;
      }
    }
    return ok;
  };

  let compared = 0, mismatches = 0;
  for (const [label, q] of fixed) {
    if (!compare(label, q)) mismatches++;
    compared++;
  }
  const rand = rng(1999);
  for (let trial = 0; trial < 1200; trial++) {
    const q = generatedQuad(rand);
    if (!q) continue;
    if (!compare(`generated ${trial}`, q)) mismatches++;
    compared++;
  }
  check(`core and applet bytecode agree on ${compared} configurations`,
    compared > 500 && mismatches === 0, `${mismatches} mismatches`);

  // Two spot values from the applet's own transcription, independent of core.
  const ap = apConfiguration(...tangentPoints([0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]));
  check("the applet's own four quarter-turn tangents make a square",
    closePoint(ap.quad[0], P(262.5, 62.5), 1e-9)
    && closePoint(ap.quad[2], P(137.5, 187.5), 1e-9));
  check("the applet's own W lies on its own circle through X, Y, Z",
    close(dist(ap.small[3].c, ap.claim.c), ap.claim.r, 1e-6));
}

/* ------------------------------------------------ 5. degenerate input is safe */

{
  const flat = [P(262.5, 125), P(262.5, 125), P(137.5, 125), P(200, 187.5)];
  check("coincident tangent points give no construction", C.compute(...flat) === null);
  check("a non-finite point gives no construction",
    C.compute(P(NaN, 1), P(2, 2), P(3, 3), P(4, 4)) === null);
  check("a degenerate state has a helpful status", /Move a point/.test(C.describe({})));
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("cyclic-incenters");
