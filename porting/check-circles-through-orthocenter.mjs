#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-through-orthocenter/circles-through-orthocenter-core.js.
 *
 *   node porting/check-circles-through-orthocenter.mjs
 *
 * Section 2 transcribes the applet's own GeoSDoub.FindAltitude,
 * GeoSDoub.Intersect, GeoSDoub.FindCircumcenter, Canvas.Midpoint,
 * Canvas.GetCircle and GeoSDoub.Intersect(DoubCircle,DoubLine) (with its
 * IntersectX / IntersectY branches) a second time, straight from javap -c, and
 * compares every output with the core on thousands of triangles.
 *
 * Section 3 checks the page's claims: the six crossings are concyclic about
 * the circumcenter O; equations (1) and (3) hold; H is the radical center and
 * the altitudes are the pairwise radical axes; and "acute-angled" is a red
 * herring (obtuse and right triangles are checked too).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circles-through-orthocenter/circles-through-orthocenter-core.js",
  "CirclesThroughOrthocenterCore");
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const cross = (p, q) => p.x * q.y - p.y * q.x;

/* ------------------------- a second transcription of the applet's bytecode */

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), from javap -c. */
function appletIntersect(a, b, c, e) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - e.y, b2 = e.x - c.x, c2 = c.x * e.y - c.y * e.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}

/** GeoSDoub.FindAltitude(a,b,c): the point q is a.x+c.y-b.y, a.y-c.x+b.x. */
function appletAltitude(a, b, c) {
  const q = { x: a.x + c.y - b.y, y: a.y - c.x + b.x };
  return appletIntersect(a, q, b, c);
}

/** GeoSDoub.FindCircumcenter(a,b,c), from javap -c. */
function appletCircumcenter(a, b, c) {
  const m1 = mid(a, b), m2 = mid(b, c);
  const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  return appletIntersect(m1, p, m2, q);
}

/** CirclesThroughOrthocenterCanvas.GetCircle(a,b,c), from javap -c. */
function appletCircle(a, b, c) {
  const centre = appletCircumcenter(a, b, c);
  return { c: centre, r: (d(centre, a) + d(centre, b) + d(centre, c)) / 3 };
}

/** GeoSDoub.Intersect(DoubCircle,DoubLine), through IntersectX/IntersectY. */
function appletCircleLine(circle, p, q) {
  if (Math.abs(p.y - q.y) > 1) {
    const m = (p.x - q.x) / (p.y - q.y);
    const b = q.x - m * q.y;
    const aa = m * m + 1;
    const bb = 2 * (m * (b - circle.c.x) - circle.c.y);
    const cc = circle.c.y ** 2 + (b - circle.c.x) ** 2 - circle.r ** 2;
    const disc = bb * bb - 4 * aa * cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const y1 = (-bb + s) / (2 * aa), y2 = (-bb - s) / (2 * aa);
    return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
  }
  if (Math.abs(p.x - q.x) > 1) {
    const m = (p.y - q.y) / (p.x - q.x);
    const b = q.y - m * q.x;
    const aa = m * m + 1;
    const bb = 2 * (m * (b - circle.c.y) - circle.c.x);
    const cc = circle.c.x ** 2 + (b - circle.c.y) ** 2 - circle.r ** 2;
    const disc = bb * bb - 4 * aa * cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const x1 = (-bb + s) / (2 * aa), x2 = (-bb - s) / (2 * aa);
    return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
  }
  return null;
}

/** Canvas.Other(points, known): the point that is not within a pixel of H. */
function appletOther(points, known) {
  return d(points[0], known) >= 1 ? points[0] : points[1];
}

/** Canvas.Compute(a,b,c), transcribed statement by statement. */
function appletCompute(A, B, Cc) {
  const Ha = appletAltitude(A, B, Cc);
  const Hb = appletAltitude(B, Cc, A);
  const Hc = appletAltitude(Cc, A, B);
  const H = appletIntersect(A, Ha, B, Hb);
  if (![Ha, Hb, Hc, H].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  const Ma = mid(B, Cc), Mb = mid(Cc, A), Mc = mid(A, B);
  const circles = {
    a: { c: Ma, r: d(Ma, H) },
    b: { c: Mb, r: d(Mb, H) },
    c: { c: Mc, r: d(Mc, H) },
  };
  const pairs = {
    A: appletCircleLine(circles.a, B, Cc),
    B: appletCircleLine(circles.b, Cc, A),
    C: appletCircleLine(circles.c, A, B),
  };
  if (!pairs.A || !pairs.B || !pairs.C) return null;
  const six = [pairs.A[0], pairs.A[1], pairs.B[0], pairs.B[1], pairs.C[0], pairs.C[1]];
  if (!six.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  const circle = appletCircle(pairs.A[0], pairs.B[0], pairs.C[0]);
  const circumcircle = appletCircle(A, B, Cc);
  // The three chosen crossings can coincide (in a right triangle), which
  // leaves the applet's big circle undefined; the six points are still there.
  if (![circumcircle.c].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  return { Ha, Hb, Hc, H, Ma, Mb, Mc, circles, pairs, six, circle, circumcircle };
}

/* ------------------------------------------------------------- triangle set */

const exact = [
  ["opening", C.start()],
  ["equilateral", C.start({
    A: { x: 180, y: 40 }, B: { x: 180 - 40 * Math.sqrt(3), y: 160 },
    C: { x: 180 + 40 * Math.sqrt(3), y: 160 },
  })],
  ["right", C.start({ A: { x: 60, y: 200 }, B: { x: 300, y: 200 }, C: { x: 60, y: 40 } })],
  ["obtuse", C.start({ A: { x: 40, y: 120 }, B: { x: 320, y: 120 }, C: { x: 180, y: 135 } })],
  ["isosceles", C.start({ A: { x: 180, y: 20 }, B: { x: 70, y: 205 }, C: { x: 290, y: 205 } })],
  ["thin", C.start({ A: { x: 40, y: 40 }, B: { x: 320, y: 45 }, C: { x: 190, y: 60 } })],
];
const rand = rng(20081126);
const sample = exact.map(([, s]) => s);
for (let i = 0; i < 6000 && sample.length < 4006; i++) {
  const A = { x: 10 + rand() * 340, y: 10 + rand() * 220 };
  const B = { x: 10 + rand() * 340, y: 10 + rand() * 220 };
  const Cc = { x: 10 + rand() * 340, y: 10 + rand() * 220 };
  if (Math.min(d(A, B), d(B, Cc), d(Cc, A)) < 30) continue;
  if (Math.abs(C.twiceArea(A, B, Cc)) < 400) continue;
  sample.push(C.start({ A, B, C: Cc }));
}

/* ------------------------------------------------ 1. the rules of the demo */

{
  const s = C.start();
  check("the opening picture has three finite corners", [s.A, s.B, s.C].every(C.finite));
  check("the opening triangle is not degenerate", !C.compute(s).degenerate);
  equal("a fresh demo is unexplored", [s.moves, s.explored, C.result(s)], [0, false, null]);
  check("names start on and the hint starts off", s.showNames === true && s.showHint === false);
  check("legal moves cover three corners, two options and reset", C.legalMoves(s).length === 6);
  const moved = C.move(s, { type: "point", name: "C", point: { x: 300, y: 60 } });
  check("dragging a corner moves only that corner",
    moved && moved.C.x === 300 && moved.C.y === 60
      && moved.A.x === s.A.x && moved.B.y === s.B.y && moved.moves === 1);
  check("the demo is done once explored, with no win or loss", C.result(moved) === "done");
  check("corners closer than a fingertip are refused",
    C.move(s, { type: "point", name: "C", point: s.A }) === null);
  check("a corner dragged off the board is kept inside it",
    C.move(s, { type: "point", name: "A", point: { x: -99, y: 999 } }).A.x === C.MARGIN);
  check("unknown moves and non-finite corners are refused",
    C.move(s, { type: "point", name: "X", point: s.A }) === null
      && C.move(s, { type: "point", name: "A", point: { x: NaN, y: 1 } }) === null
      && C.move(s, { type: "option", key: "wrong", value: true }) === null);
  const t = C.move(C.move(s, { type: "option", key: "showHint", value: true }),
    { type: "option", key: "showNames", value: false });
  check("both applet switches can be ticked and unticked", !t.showNames && t.showHint && t.moves === 2);
  const reset = C.move(t, { type: "reset" });
  check("Reset restores the corners but keeps the switches",
    d(reset.A, C.DEFAULT.A) === 0 && d(reset.B, C.DEFAULT.B) === 0
      && d(reset.C, C.DEFAULT.C) === 0 && reset.showHint && !reset.showNames);
  check("a nudge moves a corner by one arrow-key step",
    d(C.nudge(s, "A", 3, -4).A, { x: s.A.x + 3, y: s.A.y - 4 }) < 1e-9);
  check("a move never changes the position it was given", s.moves === 0 && !s.explored);
}

/* -------------------------- 2. the core against the applet's own bytecode */

{
  let n = 0;
  let feet = 0, orth = 0, mids = 0, radii = 0, crossings = 0;
  let circleC = 0, circleR = 0, circumC = 0, circumR = 0;
  for (const s of sample) {
    const g = C.geometry(s);
    if (g.degenerate) continue;
    const a = appletCompute(s.A, s.B, s.C);
    if (!a) continue;
    n++;
    feet = Math.max(feet, d(a.Ha, g.feet.a), d(a.Hb, g.feet.b), d(a.Hc, g.feet.c));
    orth = Math.max(orth, d(a.H, g.H));
    mids = Math.max(mids, d(a.Ma, g.mids.a), d(a.Mb, g.mids.b), d(a.Mc, g.mids.c));
    for (const k of ["a", "b", "c"]) {
      radii = Math.max(radii, Math.abs(a.circles[k].r - g.radii[k]));
      crossings = Math.max(crossings,
        d(a.pairs[k === "a" ? "A" : k === "b" ? "B" : "C"][0], g.pairs[k === "a" ? "A" : k === "b" ? "B" : "C"][0]),
        d(a.pairs[k === "a" ? "A" : k === "b" ? "B" : "C"][1], g.pairs[k === "a" ? "A" : k === "b" ? "B" : "C"][1]));
    }
    if (Number.isFinite(a.circle.c.x) && Number.isFinite(a.circle.c.y)) {
      circleC = Math.max(circleC, d(a.circle.c, g.circle.c));
      circleR = Math.max(circleR, Math.abs(a.circle.r - g.circle.r));
    } else if (g.circle !== null) {
      throw new Error("the core drew a circle where the applet's GetCircle degenerated");
    }
    circumC = Math.max(circumC, d(a.circumcircle.c, g.circumcircle.c));
    circumR = Math.max(circumR, Math.abs(a.circumcircle.r - g.circumcircle.r));
  }
  check("the bytecode comparison really covered thousands of triangles", n > 3000, `${n}`);
  check("GeoSDoub.FindAltitude matches the core's feet", feet < 1e-6, `max ${feet}`);
  check("GeoSDoub.Intersect gives the same orthocenter H", orth < 1e-6, `max ${orth}`);
  check("Canvas.Midpoint matches the three circle centres", mids < 1e-6, `max ${mids}`);
  check("Dist(M_a,H) matches the three radii", radii < 1e-6, `max ${radii}`);
  check("IntersectX/IntersectY give the same six crossings", crossings < 1e-5, `max ${crossings}`);
  check("Canvas.GetCircle gives the same centre for the six-point circle", circleC < 1e-5, `max ${circleC}`);
  check("Canvas.GetCircle gives the same radius for the six-point circle", circleR < 1e-5, `max ${circleR}`);
  check("the circumcircle matches Canvas.GetCircle(A,B,C)", circumC < 1e-5 && circumR < 1e-5,
    `centre ${circumC}, radius ${circumR}`);
}

/* ------------------------------------------- 3. the page's claims, checked */

{
  let concyclic = 0, eq3 = 0, eq1 = 0, radicalCenter = 0, altitudes = 0;
  let crossings = 0, circleCentre = 0, radiusFormula = 0, symmetric = 0;
  let acute = 0, right = 0, obtuse = 0, valid = 0;
  let crossPower = 0, axis = 0, axesChecked = 0;
  for (const s of sample) {
    const g = C.geometry(s);
    if (g.degenerate) continue;
    valid++;
    const r = C.residuals(s, g);
    concyclic = Math.max(concyclic, r.concyclic);
    eq3 = Math.max(eq3, r.equalRadii);
    eq1 = Math.max(eq1, r.equalPowers);
    radicalCenter = Math.max(radicalCenter, r.radicalCenter);
    altitudes = Math.max(altitudes, r.altitudes);
    crossings = Math.max(crossings, r.crossings);
    circleCentre = Math.max(circleCentre, r.circleCentre);

    // The geometric reason for concyclicity: rho^2 = r_a^2 + OM_a^2, since
    // OM_a is perpendicular to BC and M_aA1 has length r_a.
    const rho = Math.sqrt(g.radii.a ** 2 + C.dot(C.sub(g.mids.a, g.O), C.sub(g.mids.a, g.O)));
    radiusFormula = Math.max(radiusFormula, Math.abs(rho - g.theoremCircle.r));
    symmetric = Math.max(symmetric,
      Math.abs(d(g.pairs.A[0], g.mids.a) - g.radii.a),
      Math.abs(d(g.pairs.B[0], g.mids.b) - g.radii.b),
      Math.abs(d(g.pairs.C[0], g.mids.c) - g.radii.c));

    // The pairwise radical axes are the altitudes: each "other" intersection
    // lies on the altitude through the opposite vertex, and has equal powers.
    const axes = [
      [g.radical.ab, g.feet.c, s.C, g.circles.a, g.circles.b],
      [g.radical.bc, g.feet.a, s.A, g.circles.b, g.circles.c],
      [g.radical.ca, g.feet.b, s.B, g.circles.c, g.circles.a],
    ];
    for (const [p, foot, vertex, c1, c2] of axes) {
      if (!p) continue;
      axesChecked++;
      if (d(foot, g.H) > 1e-9) {
        axis = Math.max(axis, Math.abs(cross(sub(p, g.H), sub(foot, g.H))) / d(foot, g.H));
      }
      if (d(foot, vertex) > 1e-9) {
        axis = Math.max(axis, Math.abs(cross(sub(p, vertex), sub(foot, vertex))) / d(foot, vertex));
      }
      crossPower = Math.max(crossPower,
        Math.abs(d(c1.c, p) ** 2 - c1.r ** 2 - (d(c2.c, p) ** 2 - c2.r ** 2)));
    }

    const angles = [
      C.dot(C.sub(s.B, s.A), C.sub(s.C, s.A)),
      C.dot(C.sub(s.A, s.B), C.sub(s.C, s.B)),
      C.dot(C.sub(s.A, s.C), C.sub(s.B, s.C)),
    ];
    if (angles.some((v) => v < -1e-9)) obtuse++;
    else if (angles.some((v) => Math.abs(v) < 1e-9)) right++;
    else acute++;
  }
  check("the claim checks really covered thousands of triangles", valid > 3000, `${valid}`);
  check("all six points lie on one circle, for every triangle", concyclic < 1e-5, `max ${concyclic}`);
  check("r_a^2 + s_a^2 = r_b^2 + s_b^2 = r_c^2 + s_c^2 (page equation 3)", eq3 < 1e-5, `max ${eq3}`);
  check("(a/2)^2 - r_a^2 = (b/2)^2 - r_b^2 = (c/2)^2 - r_c^2 (page equation 1)",
    eq1 < 1e-5, `max ${eq1}`);
  check("H has zero power in all three circles: the orthocenter is the radical center",
    radicalCenter < 1e-5, `max ${radicalCenter}`);
  check("the feet are on the sides and H is on all three altitudes", altitudes < 1e-5, `max ${altitudes}`);
  check("each pair of crossings lies on its side, symmetric about the midpoint",
    crossings < 1e-5, `max ${crossings}`);
  check("each crossing is exactly one radius from its circle's midpoint", symmetric < 1e-5, `max ${symmetric}`);
  check("the circle drawn by the applet is centred at the circumcenter",
    circleCentre < 1e-5, `max ${circleCentre}`);
  check("its radius is sqrt(r_a^2 + OM_a^2)", radiusFormula < 1e-5, `max ${radiusFormula}`);
  check("the pairwise radical axes are the altitudes (checked on every sample)",
    axesChecked > 3000 && axis < 1e-5, `${axesChecked} axes, max ${axis}`);
  check("points on the radical axes have equal powers in the two circles",
    crossPower < 1e-5, `max ${crossPower}`);
  check("the sample contains acute, right and obtuse triangles",
    acute > 100 && right > 0 && obtuse > 100, `${acute} acute, ${right} right, ${obtuse} obtuse`);
  check("the page's 'acute is spurious' claim holds on right and obtuse triangles",
    obtuse > 100 && concyclic < 1e-5);
}

/* ------------------------------------------- 4. the right-triangle quirk */

{
  const right = exact[2][1];
  const g = C.geometry(right);
  check("a right triangle keeps its six points and its circle", !g.degenerate);
  check("the applet's GetCircle can fail when its three chosen crossings coincide",
    g.circle === null, `${g.circle}`);
  check("the page's circle is still the circumcircle of the right triangle",
    d(g.theoremCircle.c, g.circumcircle.c) < 1e-5
      && C.residuals(right, g).concyclic < 1e-5);
  const acute = C.geometry(exact[1][1]);
  check("for an ordinary triangle the applet's circle and the proved circle agree",
    acute.circle !== null && d(acute.circle.c, acute.theoremCircle.c) < 1e-5
      && Math.abs(acute.circle.r - acute.theoremCircle.r) < 1e-5);
}

/* ------------------------------------------------------- 5. degeneracies */

{
  const flat = C.move(C.move(C.move(C.start(),
    { type: "point", name: "B", point: { x: 340, y: 100 } }),
  { type: "point", name: "C", point: { x: 20, y: 100 } }),
  { type: "point", name: "A", point: { x: 200, y: 100 } });
  const g = C.geometry(flat);
  check("three corners in a line give a well-formed degenerate picture",
    g && g.degenerate === true && g.reason === "line");
  check("residuals of a degenerate picture are null", C.residuals(flat, g) === null);
  const fallback = C.start({ A: { x: NaN, y: 0 } });
  check("non-finite corner input falls back to the opening position",
    d(fallback.A, C.DEFAULT.A) === 0);
  check("a tiny triangle still has a construction when it is not perfectly flat",
    !C.compute(C.start({
      A: { x: 100, y: 100 }, B: { x: 112, y: 100 }, C: { x: 106, y: 111 },
    })).degenerate);
}

done("circles-through-orthocenter");
