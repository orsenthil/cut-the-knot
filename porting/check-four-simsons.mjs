#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-simsons/four-simsons-core.js.
 *
 *   node porting/check-four-simsons.mjs
 *
 * FourSimsons is a demonstration, so there is no win, loss or computer move.
 * What has to be verified is the page's geometry:
 *
 *   "provided the quadrilateral ABCD is cyclic, the eight aforementioned
 *    elements all concur in a point" — four nine-point circles and four
 *    Simson lines; the four nine-point centres form a quadrilateral similar
 *    to ABCD with factor 1/2; each nine-point circle has radius R/2; their
 *    common point is the circumcentre of the centres and the midpoint of
 *    each of AH_A, BH_B, CH_C, DH_D; each Simson passes through that point.
 *   "if the quadrilateral is not cyclic, the simsons convert into circles,
 *    and the eight circles involved are still concurrent in a point."
 *
 * Section 3 transcribes GeoSDoub.FindAltitude/FindCircumcenter/Intersect and
 * the canvas's FindOrthocenter/FindNinepointscenter/DrawNCircle/DrawSimsonLine
 * a second time from javap output and compares every derived point with the
 * core.  Sections 4 and 5 check the page's two claims independently of the
 * core's own `claims` flags: over fixed shapes, thousands of cyclic
 * quadrilaterals and hundreds of non-cyclic ones.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-simsons/four-simsons-core.js", "FourSimsonsCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closePoint = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);
const finitePoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const TAU = 2 * Math.PI;
const onCircle = (a) => P(C.CENTER.x + C.RADIUS * Math.cos(a), C.CENTER.y + C.RADIUS * Math.sin(a));
function distToLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy);
  return n ? Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / n : dist(p, a);
}
function scaleOf(pts) {
  let s = 1;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) s = Math.max(s, dist(pts[i], pts[j]));
  }
  return s;
}

/* ----------------------------------------- the applet's arithmetic, javap */

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), slots 4..26. */
function apIntersect(a, b, c, d) {
  const a1 = a.y - b.y, a2 = b.x - a.x, a3 = a.x * b.y - a.y * b.x;
  const b1 = c.y - d.y, b2 = d.x - c.x, b3 = c.x * d.y - c.y * d.x;
  const den = a1 * b2 - b1 * a2;
  if (Math.abs(den) < 1) return P(NaN, NaN);
  return P((a2 * b3 - b2 * a3) / den, (a3 * b1 - b3 * a1) / den);
}

/* GeoSDoub.FindAltitude(p,a,b): new DoubPoint(p.x+b.y-a.y, p.y-b.x+a.x),
 * then Intersect(p, thatPoint, a, b). */
function apFoot(p, a, b) {
  const q = P(p.x + b.y - a.y, p.y - b.x + a.x);
  return apIntersect(p, q, a, b);
}

/* GeoSDoub.FindCircumcenter(a,b,c): two midpoints, two offset points, then
 * Intersect(m1,q1,m2,q2). */
function apCircumcenter(a, b, c) {
  const m1 = mid(a, b), m2 = mid(b, c);
  const q1 = P(m1.x + b.y - a.y, m1.y - (b.x - a.x));
  const q2 = P(m2.x + c.y - b.y, m2.y - (c.x - b.x));
  return apIntersect(m1, q1, m2, q2);
}

/* FourSimsonsCanvas.FindOrthocenter(a,b,c) / FindNinepointscenter(a,b,c). */
function apOrthocenter(a, b, c) {
  return apIntersect(a, apFoot(a, b, c), b, apFoot(b, a, c));
}
function apNineCenter(a, b, c) {
  return mid(apOrthocenter(a, b, c), apCircumcenter(b, a, c));
}

/* DrawNCircle(g,p,a,b,c,N): N is the passed-in nine-point centre; the radius
 * is the mean of N's distances to the three side midpoints. */
function apNineCircle(a, b, c, n) {
  return { center: n, radius: (dist(n, mid(a, b)) + dist(n, mid(a, c)) + dist(n, mid(b, c))) / 3 };
}

/* DrawSimsonLine(g,a,b,c,p): the first two pedal feet are joined; the third
 * is used only by Highlight()/DrawPerps(). */
function apSimson(a, b, c, p) {
  const f1 = apFoot(p, b, c), f2 = apFoot(p, a, c), f3 = apFoot(p, a, b);
  return { feet: [f1, f2, f3], first: f1, second: f2, third: f3 };
}

function apPedalCircle(a, b, c, p) {
  const s = apSimson(a, b, c, p);
  const o = apCircumcenter(s.feet[0], s.feet[1], s.feet[2]);
  return { center: o, radius: dist(o, s.feet[0]) };
}

/** Rebuild the whole eight-element picture from the four vertices alone. */
function appletPicture(q) {
  const ix = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]];
  const tris = ix.map((row) => row.map((i) => q[i]));
  const centers = tris.map((t) => apNineCenter(t[0], t[1], t[2]));
  const circles = centers.map((n, i) => apNineCircle(tris[i][0], tris[i][1], tris[i][2], n));
  const orthos = tris.map((t) => apOrthocenter(t[0], t[1], t[2]));
  const simsons = tris.map((t, i) => apSimson(t[0], t[1], t[2], q[i]));
  const pedalCircles = tris.map((t, i) => apPedalCircle(t[0], t[1], t[2], q[i]));
  return {
    tris, centers, circles, orthos, simsons, pedalCircles,
    circum: apCircumcenter(q[0], q[1], q[2]), radius: dist(q[0], apCircumcenter(q[0], q[1], q[2])),
    H: apCircumcenter(centers[0], centers[1], centers[2]),
    H2: apCircumcenter(centers[1], centers[2], centers[3]),
    mids: q.map((p, i) => mid(p, orthos[i])),
  };
}

/** Independent test of the page's concurrence claim (does not use C.compute). */
function pageClaim(q) {
  const ap = appletPicture(q);
  const tol = 1e-7 * scaleOf(q);
  if (!finitePoint(ap.H) || !finitePoint(ap.circum) || !Number.isFinite(ap.radius)
    || !ap.centers.every(finitePoint) || !ap.orthos.every(finitePoint)
    || ap.circles.some((c) => !finitePoint(c.center) || !Number.isFinite(c.radius))
    || ap.simsons.some((s) => !s.first || !s.feet.every(finitePoint))) return null;
  const errors = {
    circle: Math.max(...ap.circles.map((c) => Math.abs(dist(c.center, ap.H) - c.radius))),
    simson: Math.max(...ap.simsons.map((s) => distToLine(ap.H, s.first, s.second))),
    homothety: Math.max(...ap.mids.map((m) => dist(m, ap.H))),
    radius: Math.max(...ap.circles.map((c) => Math.abs(c.radius - ap.radius / 2))),
    nQuad: dist(ap.H, ap.H2),
    collinear: Math.max(...ap.simsons.map((s) => distToLine(s.third, s.first, s.second))),
    similar: 0,
  };
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      errors.similar = Math.max(errors.similar,
        Math.abs(dist(ap.centers[i], ap.centers[j]) - dist(q[i], q[j]) / 2));
    }
  }
  const ok = Object.keys(errors).every((k) => errors[k] <= tol);
  return { ok, errors, tol, ap };
}

/* ---------------------------------------------------- 1. start and rules */

{
  const s = C.start({});
  equal("Reset uses the four angles from the class file", s.angles, [
    0.5235987755982988, 2.6179938779914944, 3.765191430678208, 5.235987755982989,
  ]);
  check("the three checkboxes start unchecked", !s.options.centers && !s.options.circles && !s.options.simsons);
  check("nothing is highlighted at the start", s.selected === -1);
  check("a fresh diagram has not been explored", !s.explored);
  check("a demonstration has no result", C.result(s) === null);
  check("the core has no DOM", typeof globalThis.document === "undefined");
  check("the starting vertices lie on the applet's circle",
    s.angles.every((a) => close(dist(onCircle(a), C.CENTER), C.RADIUS, 1e-9)));
  const g = C.geometry(s);
  check("the start diagram has a construction", !!g);
  check("every page claim holds at the start", !!g && Object.keys(g.claims).every((k) => g.claims[k]));
  check("geometry of a missing state is null", C.geometry(null) === null);
}

/* ------------------------------------------- 2. moves, options, messages */

{
  const s = C.start();
  const m = C.move(s, "B", P(5, 5));
  check("moving a vertex leaves the old position alone", s.angles[1] !== m.angles[1]);
  check("a move marks the diagram explored", m.explored && !s.explored);
  check("a moved vertex is put back on the circle", close(dist(onCircle(m.angles[1]), C.CENTER), C.RADIUS, 1e-9));
  check("an unknown vertex is ignored", C.move(s, "Z", 1) === s);
  check("a non-finite angle is ignored", C.move(s, "A", NaN) === s);
  check("a point exactly at the centre stays valid", finitePoint(onCircle(C.angleOf(C.CENTER))));

  const c1 = C.setOption(s, "centers", true);
  const c2 = C.setOption(c1, "circles", true);
  const c3 = C.setOption(c2, "simsons", true);
  check("each checkbox toggles independently",
    c1.options.centers && !c1.options.circles && c2.options.circles && c3.options.simsons);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  check("turning the Simson lines off clears the highlight",
    C.setOption(C.select(c3, 2), "simsons", false).selected === -1);
  check("a highlight is kept while the Simson lines are on", C.select(c3, 2).selected === 2);
  check("a highlight outside the four lines clears it", C.select(c3, 9).selected === -1);

  const g = C.geometry(c3);
  const near = mid(g.simsons[1].first, g.simsons[1].second);
  check("clicking near a Simson line picks that line", C.clickSimson(c3, near) === 1);
  check("clicking in empty space picks nothing", C.clickSimson(c3, P(5, 5)) === -1);
  check("clicking a line while they are hidden picks nothing", C.clickSimson(s, near) === -1);

  const r = C.reset(c3);
  check("Reset restores the start angles", r.angles.every((a, i) => a === C.START_ANGLES[i]));
  check("Reset keeps the checkboxes and the explored flag",
    r.options.centers && r.options.circles && r.options.simsons && r.explored);
  check("the status names the shared point when the lines are shown",
    /meet at one point/.test(C.describe(c3)));
  check("the status explains the highlighted feet",
    /three feet/.test(C.describe(C.select(c3, 0))));
  check("the status invites a click on the lines",
    /Click a Simson line/.test(C.describe(c3)));
  check("a non-finite state has a helpful status", typeof C.describe({}) === "string");
  check("the result stays null after moves and options", C.result(m) === null && C.result(c3) === null);
}

/* ----------------------------------- 3. the core against the applet bytecode */

const rand3 = rng(20261127);
{
  const fixed = [
    C.START_ANGLES,
    [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2],
    [0.12, 1.25, 2.94, 4.61],
    [5.235987755982989, 3.765191430678208, 2.6179938779914944, 0.5235987755982988],
    [0, 0.83, 1.69, 2.61],
  ];
  const configs = fixed.slice();
  for (let i = 0; i < 800; i++) {
    let a = 0.3 + rand3() * 0.8;
    const angles = [a];
    for (let k = 0; k < 3; k++) { a += 0.7 + rand3() * 0.9; angles.push(a); }
    configs.push(angles);
  }
  let compared = 0, mismatches = 0, worst = 0;
  for (const angles of configs) {
    const q = angles.map(onCircle);
    const g = C.compute(...q);
    const ap = appletPicture(q);
    const tol = 1e-8 * scaleOf(q);
    if (!g) { mismatches++; continue; }
    const pairs = [
      ["nine-point centre A", g.centers[0], ap.centers[0]],
      ["nine-point centre B", g.centers[1], ap.centers[1]],
      ["nine-point centre C", g.centers[2], ap.centers[2]],
      ["nine-point centre D", g.centers[3], ap.centers[3]],
      ["orthocentre A", g.orthocenters[0], ap.orthos[0]],
      ["orthocentre B", g.orthocenters[1], ap.orthos[1]],
      ["orthocentre C", g.orthocenters[2], ap.orthos[2]],
      ["orthocentre D", g.orthocenters[3], ap.orthos[3]],
      ["common point H", g.H, ap.H],
      ["circumcentre", g.circumcenter, ap.circum],
    ];
    for (let i = 0; i < 4; i++) {
      pairs.push([`circle ${i} centre`, g.circles[i].center, ap.circles[i].center]);
      pairs.push([`Simson ${i} first foot`, g.simsons[i].first, ap.simsons[i].first]);
      pairs.push([`Simson ${i} second foot`, g.simsons[i].second, ap.simsons[i].second]);
      pairs.push([`Simson ${i} third foot`, g.simsons[i].third, ap.simsons[i].third]);
    }
    for (const [what, got, want] of pairs) {
      const err = dist(got, want);
      worst = Math.max(worst, err);
      if (!closePoint(got, want, tol)) {
        mismatches++;
        check(`core matches the applet's ${what}`, false, `error ${err}`);
      }
    }
    for (let i = 0; i < 4; i++) {
      if (!close(g.circles[i].radius, ap.circles[i].radius, tol)) {
        mismatches++;
        check(`core matches the applet's circle ${i} radius`, false);
      }
      /* The pedal circles are not compared here: for a cyclic quadrilateral
       * the three feet are collinear, so the pedal circle degenerates to a
       * line and its circumcentre is at infinity (NaN in the applet).  They
       * are compared in section 5, on non-cyclic quadrilaterals. */
    }
    compared++;
  }
  check(`core equals a second transcription of the bytecode on ${compared} cyclic quadrilaterals`,
    compared === configs.length && mismatches === 0, `worst error ${worst.toExponential(2)}`);
}

/* ------------------------------- 4. the page's cyclic claim, independently */

const fixedCyclic = [
  ["the applet's start", C.START_ANGLES],
  ["a square", [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]],
  ["a tilted quadrilateral", [0.1, 1.3, 2.7, 4.9]],
  ["a quadrilateral with a short side", [0.0, 0.8, 1.6, 3.0]],
  ["the vertices in reverse order", [5.235987755982989, 3.765191430678208, 2.6179938779914944, 0.5235987755982988]],
];
for (const [name, angles] of fixedCyclic) {
  const q = angles.map(onCircle);
  const claim = pageClaim(q);
  const g = C.compute(...q);
  check(`${name}: the independent eight-element concurrence holds`, !!claim && claim.ok,
    claim ? JSON.stringify(claim.errors) : "degenerate");
  check(`${name}: the core reproduces the independent result`, !!g && Object.keys(g.claims).every((k) => g.claims[k]));
  check(`${name}: the core's H is the independently computed H`, !!g && !!claim && closePoint(g.H, claim.ap.H, 1e-8 * scaleOf(q)));
}
{
  const rand4 = rng(314159);
  let tested = 0, claimFailures = 0, coreFailures = 0;
  for (let trial = 0; trial < 2000; trial++) {
    let a = 0.2 + rand4() * 1.0;
    const angles = [a];
    for (let k = 0; k < 3; k++) { a += 0.6 + rand4() * 1.0; angles.push(a); }
    const q = angles.map(onCircle);
    const claim = pageClaim(q);
    const g = C.compute(...q);
    if (!claim || !g) continue;
    tested++;
    if (!claim.ok) { claimFailures++; check(`cyclic random ${trial}: page claim`, false, JSON.stringify(claim.errors)); }
    if (!Object.keys(g.claims).every((k) => g.claims[k])) {
      coreFailures++;
      check(`cyclic random ${trial}: core claim`, false, JSON.stringify(g.claims));
    }
  }
  check(`the cyclic concurrence holds on ${tested} generated quadrilaterals`,
    tested >= 1900 && claimFailures === 0);
  check(`the core agrees with the independent claim on all ${tested} quadrilaterals`, coreFailures === 0);
  // Similarity must survive scaling: halve the drawing and test again.
  const base = fixedCyclic[2][1].map(onCircle);
  const half = base.map((p) => P(C.CENTER.x + (p.x - C.CENTER.x) / 2, C.CENTER.y + (p.y - C.CENTER.y) / 2));
  const halfClaim = pageClaim(half);
  check("the half-size quadrilateral still has a common point", !!halfClaim && halfClaim.ok);
}

/* ------------------- 5. the page's non-cyclic generalisation independently */

function circleIntersection(c0, c1) {
  const dx = c1.center.x - c0.center.x, dy = c1.center.y - c0.center.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9 || d > c0.radius + c1.radius || d < Math.abs(c0.radius - c1.radius)) return null;
  const a = (c0.radius * c0.radius - c1.radius * c1.radius + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, c0.radius * c0.radius - a * a));
  const x = c0.center.x + (dx * a) / d, y = c0.center.y + (dy * a) / d;
  return [P(x - (dy * h) / d, y + (dx * h) / d), P(x + (dy * h) / d, y - (dx * h) / d)];
}

{
  const rand5 = rng(271828);
  let tested = 0, failures = 0, worst = 0;
  for (let trial = 0; trial < 1200; trial++) {
    const q = [0, 1, 2, 3].map(() => P(30 + rand5() * 340, 30 + rand5() * 240));
    const ap = appletPicture(q);
    if (![ap.H, ap.circum].every(finitePoint) || !ap.circles.every((c) => finitePoint(c.center) && Number.isFinite(c.radius))
      || !ap.pedalCircles.every((c) => finitePoint(c.center) && Number.isFinite(c.radius))
      || ap.circles.concat(ap.pedalCircles).some((c) => c.radius > 1e5)) continue;
    // The core's pedal-circle utility must equal the bytecode transcription.
    for (let i = 0; i < 4; i++) {
      const got = C.pedalCircle(q[i], ...ap.tris[i]);
      const want = ap.pedalCircles[i];
      if (!closePoint(got.center, want.center, 1e-8 * scaleOf(q))
        || !close(got.radius, want.radius, 1e-8 * scaleOf(q))) {
        failures++;
        check(`non-cyclic random ${trial}: core pedal circle ${i}`, false);
      }
    }
    const all = ap.circles.concat(ap.pedalCircles);
    const pts = circleIntersection(all[0], all[1]);
    if (!pts) continue;
    let best = Infinity;
    for (const pt of pts) {
      let err = 0;
      for (const c of all) err = Math.max(err, Math.abs(dist(pt, c.center) - c.radius));
      best = Math.min(best, err);
    }
    tested++;
    worst = Math.max(worst, best);
    if (best > 1e-7 * scaleOf(q)) {
      failures++;
      check(`non-cyclic random ${trial}: eight circles meet`, false, `error ${best}`);
    }
  }
  check(`the non-cyclic generalisation holds on ${tested} generated quadrilaterals`,
    tested >= 600 && failures === 0, `worst error ${worst.toExponential(2)}`);
  check("the applet's own Simson feet are collinear only in the cyclic case",
    pageClaim(fixedCyclic[1][1].map(onCircle)).errors.collinear < 1e-7
      && pageClaim([P(40, 40), P(320, 60), P(290, 240), P(70, 210)]).errors.collinear > 1);
}

/* --------------------------------------------------- 6. degenerate input */

{
  check("coincident vertices give no construction",
    C.compute(P(10, 10), P(10, 10), P(90, 20), P(40, 80)) === null);
  check("a non-finite vertex gives no construction",
    C.compute(P(NaN, 10), P(50, 10), P(90, 20), P(40, 80)) === null);
  check("two vertices at the same angle give no construction",
    C.geometry(C.move(C.start(), "B", C.START_ANGLES[0])) === null);
  check("the core exposes one global and no DOM", typeof C.compute === "function"
    && typeof globalThis.document === "undefined");
  check("the applet's Reset third angle is 7*PI/6 plus a float 0.1",
    close(C.START_ANGLES[2], 7 * Math.PI / 6 + Math.fround(0.1), 1e-13));
}

done("four-simsons");
