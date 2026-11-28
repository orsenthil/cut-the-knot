#!/usr/bin/env node
"use strict";

/*
 * Logic test for isogonal-tangents/isogonal-tangents-core.js.
 *
 *   node porting/check-isogonal-tangents.mjs
 *
 * The page (cut-the-knot.org/Curriculum/Geometry/IsogonalTangents.shtml) says:
 * three rays from O carry three circles, one in each angle, and the rays are
 * common internal tangents of the pairs of circles. Reflect a ray in the line
 * joining the centres of its pair: the three reflected "second" tangents are
 * concurrent. It also states Mannheim's theorem in the general form.
 *
 * Checked here:
 *  - init's starting points and every drag (ray points rebuild the centres
 *    through FindAngleBisector; centres slide along their bisector line);
 *  - a second, literal transcription of the applet's own bytecode (init,
 *    GetRadius, GetInternalTangents, Inversion.Tangent, IntersectCirclesX/Y,
 *    GetSecondTangents, Compute, DrawIntersection) compared with the core on
 *    every sampled configuration;
 *  - the page's claims themselves, measured with independent formulas: the
 *    rays touch both circles of their pair, each second line is the reflection
 *    of the ray in the centre line, and the three second lines meet in one
 *    point. The sample walks 360 non-degenerate configurations across the
 *    width/height parameter range; degenerate ones are reported as such.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("isogonal-tangents/isogonal-tangents-core.js", "IsogonalTangentsCore");

const P = (x, y) => ({ x, y });
const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closeP = (a, b, tol) => finite(a) && finite(b) &&
  Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
const wrap = (t) => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const cross2 = (a, b) => a.x * b.y - a.y * b.x;
const len = (v) => Math.hypot(v.x, v.y);

/* ---------------- a second transcription, straight from the applet's bytecode */

/* GeoSDoub.FindAngleBisector(a,b,c): ComputeAngle is at a, Rotate turns b
 * around a, then the line a->rotated cuts the line b->c. */
function AP_angle(a, b, c) {
  const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  return Math.acos(((sq(a, b) + sq(a, c) - sq(b, c)) / 2) /
    (Math.sqrt(sq(a, b)) * Math.sqrt(sq(a, c))));
}
function AP_orientation(a, b, c) {
  return c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y > 0 ? 1 : -1;
}
function AP_rotate(a, b, theta, sense) {
  const cs = Math.cos(theta), sn = Math.sin(theta);
  return P(a.x + cs * (b.x - a.x) - sense * sn * (b.y - a.y),
    a.y + sense * sn * (b.x - a.x) + cs * (b.y - a.y));
}
function AP_intersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}
function AP_bisector(a, b, c) {
  const r = AP_rotate(a, b, AP_angle(a, b, c) / 2, AP_orientation(a, b, c));
  return AP_intersect(a, r, b, c);
}

/* GeoSDoub.Dist(P, DoubLine): projection onto the infinite line through a,b. */
function AP_distToLine(p, a, b) {
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return 0;
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
}

/* IsogonalTangentsCanvas.init, with the applet's WIDTH/HEIGHT parameters. */
function AP_start(width, height) {
  const w2 = width / 2, h2 = height / 2, w3 = width / 3, shoulder = 120;
  const pt = {
    O: P(w2, h2), U: P(w2 - w3, h2 + shoulder), V: P(w2 + w3, h2 + shoulder),
    W: P(w2 + w3 * Math.cos(Math.PI / 3),
      h2 - w3 * Math.sin(Math.PI / 3) - shoulder / 2),
  };
  const out = { ...pt };
  for (const [name, a, b] of [["R", pt.U, pt.V], ["P", pt.V, pt.W], ["Q", pt.W, pt.U]]) {
    const foot = AP_bisector(pt.O, a, b);
    out[name] = P(pt.O.x + 5 * (foot.x - pt.O.x), pt.O.y + 5 * (foot.y - pt.O.y));
  }
  return out;
}

/* Compute's GetRadius(P, ray1, ray2): the mean of two line distances. */
function AP_circles(pt) {
  const make = (name, ray1, ray2) => {
    const c = pt[name];
    const r = (AP_distToLine(c, pt.O, pt[ray1]) + AP_distToLine(c, pt.O, pt[ray2])) / 2;
    return { x: c.x, y: c.y, r };
  };
  return {
    P: make("P", "V", "W"), Q: make("Q", "W", "U"), R: make("R", "U", "V"),
  };
}

/* GeoSDoub.IntersectCirclesX / IntersectCirclesY, by their slope formula. */
function AP_circleIntersections(a, b) {
  if (Math.abs(a.x - b.x) > 1) {
    const k = -(a.y - b.y) / (a.x - b.x);
    const t = (a.x ** 2 - b.x ** 2 + a.y ** 2 - b.y ** 2 - a.r ** 2 + b.r ** 2) /
      (2 * (a.x - b.x));
    const d = t - a.x, A = k * k + 1, B = k * d - a.y;
    const Cc = d * d + a.y ** 2 - a.r ** 2;
    const disc = B * B - A * Cc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    return [P(k * (( -B + root) / A) + t, (-B + root) / A),
      P(k * ((-B - root) / A) + t, (-B - root) / A)];
  }
  if (Math.abs(a.y - b.y) > 1) {
    const k = -(a.x - b.x) / (a.y - b.y);
    const t = (a.y ** 2 - b.y ** 2 + a.x ** 2 - b.x ** 2 - a.r ** 2 + b.r ** 2) /
      (2 * (a.y - b.y));
    const d = t - a.y, A = k * k + 1, B = k * d - a.x;
    const Cc = d * d + a.x ** 2 - a.r ** 2;
    const disc = B * B - A * Cc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    return [P((-B + root) / A, k * ((-B + root) / A) + t),
      P((-B - root) / A, k * ((-B - root) / A) + t)];
  }
  return [P(a.x, a.y), P(a.x, a.y)];
}

/* Inversion.Tangent(circle,p) and Tangents.GetInternalTangents(c1,c2). */
function AP_tangentsFrom(circle, p) {
  const power = (p.x - circle.x) ** 2 + (p.y - circle.y) ** 2 - circle.r ** 2;
  if (power < 0) return null;
  const aux = { x: p.x, y: p.y, r: Math.sqrt(power) };
  const hits = AP_circleIntersections(circle, aux);
  if (!hits) return null;
  return [{ a: P(p.x, p.y), b: hits[0] }, { a: P(p.x, p.y), b: hits[1] }];
}
function AP_internalTangents(c1, c2) {
  const aux = { x: c1.x, y: c1.y, r: c1.r + c2.r };
  const from = AP_tangentsFrom(aux, c2);
  if (!from) return null;
  return from.map((ln) => {
    const dx = ln.b.x - c1.x, dy = ln.b.y - c1.y;
    return {
      a: P(c1.x + dx * c1.r / aux.r, c1.y + dy * c1.r / aux.r),
      b: P(c2.x - dx * c2.r / aux.r, c2.y - dy * c2.r / aux.r),
    };
  });
}

/* CommonPoint and CommonTangent: the coalesced tangent when circles touch. */
function AP_commonTangent(c1, c2) {
  const den = c1.r + c2.r;
  const s = P((c2.r * c1.x + c1.r * c2.x) / den, (c2.r * c1.y + c1.r * c2.y) / den);
  return { a: s, b: P(s.x + c1.y - c2.y, s.y - c1.x + c2.x) };
}
function AP_secondTangent(pt, c1, c2) {
  let tangents = null;
  try { tangents = AP_internalTangents(c1, c2); } catch (e) { tangents = null; }
  if (!tangents) {
    return Math.abs(Math.hypot(c2.x - c1.x, c2.y - c1.y) - c1.r - c2.r) < 1
      ? AP_commonTangent(c1, c2) : null;
  }
  if (Math.hypot(tangents[0].a.x - tangents[1].a.x,
    tangents[0].a.y - tangents[1].a.y) < 2) return AP_commonTangent(c1, c2);
  for (let i = 0; i < 2; i++) {
    if (AP_distToLine(pt.O, tangents[i].a, tangents[i].b) > 1) return tangents[i];
  }
  return AP_commonTangent(c1, c2);
}

/* Compute followed by DrawIntersection's average of the three line cuts. */
function AP_compute(state) {
  const pt = state.points || state;
  const cs = AP_circles(pt);
  const QR = AP_secondTangent(pt, cs.Q, cs.R);
  const RP = AP_secondTangent(pt, cs.R, cs.P);
  const PQ = AP_secondTangent(pt, cs.P, cs.Q);
  const cut = (ray, ln) => ln ? AP_intersect(pt.O, pt[ray], ln.a, ln.b) : P(NaN, NaN);
  const lines = [QR, RP, PQ];
  let sx = 0, sy = 0, n = 0;
  const cuts = [];
  for (let i = 0; i < 3; i++) {
    const a = lines[i], b = lines[(i + 1) % 3];
    if (!a || !b) continue;
    const q = AP_intersect(a.a, a.b, b.a, b.b);
    cuts.push(q); sx += q.x; sy += q.y; n++;
  }
  return {
    circles: cs, lines: { PQ, QR, RP },
    crossings: { A: cut("U", QR), B: cut("V", RP), C: cut("W", PQ) },
    cuts, X: n ? P(sx / n, sy / n) : null,
  };
}

/* --------------------- formulas independent of the applet's implementation */

function distLine(p, a, b) {
  const v = { x: b.x - a.x, y: b.y - a.y };
  return Math.abs(cross2(v, { x: p.x - a.x, y: p.y - a.y })) / len(v);
}
function detIntersect(a, b, c, d) {
  const u = { x: b.x - a.x, y: b.y - a.y };
  const v = { x: d.x - c.x, y: d.y - c.y };
  const den = cross2(u, v);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross2({ x: c.x - a.x, y: c.y - a.y }, v) / den;
  return P(a.x + t * u.x, a.y + t * u.y);
}
function mirror(p, a, b) {
  const u = { x: b.x - a.x, y: b.y - a.y };
  const t = ((p.x - a.x) * u.x + (p.y - a.y) * u.y) / (u.x * u.x + u.y * u.y);
  const f = P(a.x + t * u.x, a.y + t * u.y);
  return P(2 * f.x - p.x, 2 * f.y - p.y);
}
function anglesAroundO(s) {
  return ["U", "V", "W"].map((n) => wrap(Math.atan2(s.points[n].y - s.points.O.y,
    s.points[n].x - s.points.O.x))).sort((a, b) => a - b);
}
function raysSpread(s) {
  const a = anglesAroundO(s);
  return [a[1] - a[0], a[2] - a[1], a[0] + 2 * Math.PI - a[2]];
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("init uses the applet's 600x500 default", [s.width, s.height], [600, 500]);
  check("O is the rectangle centre", closeP(s.points.O, P(300, 250), 1e-12));
  check("U is width/3 left and 120 down from O",
    closeP(s.points.U, P(100, 370), 1e-12));
  check("V is width/3 right and 120 down from O",
    closeP(s.points.V, P(500, 370), 1e-12));
  check("W uses cos(60) and sin(60) with a 60 unit lift",
    closeP(s.points.W, P(400, 250 - 200 * Math.sin(Math.PI / 3) - 60), 1e-12));
  check("R is five times along the UV bisector",
    closeP(s.points.R, P(300, 850), 1e-9));
  check("P sits beyond the VW angle bisector",
    C.dist(s.points.O, s.points.P) > 500);
  check("Q sits beyond the WU angle bisector",
    C.dist(s.points.O, s.points.Q) > 200);
  check("ShowNames starts on, as the page's ShowNames=1 parameter asks", s.showNames === true);
  check("an illustration has no win, loss or finish", C.result(s) === null);

  const small = C.start({ width: 400, height: 300 });
  check("the applet's advertised 400x300 parameters work",
    closeP(small.points.O, P(200, 150), 1e-12) &&
    closeP(small.points.U, P(200 - 400 / 3, 270), 1e-12));
}

/* ------------------------------------------------------------ 2. the moves */

{
  const s = C.start({});
  const target = P(120, 200);
  const moved = C.withPoint(s, "U", target);
  check("a dragged ray point lands where it was dropped",
    closeP(moved.points.U, target, 1e-12));
  check("the two centres of the moved ray are rebuilt after a ray drag",
    ["Q", "R"].every((n) => C.dist(moved.points[n], s.points[n]) > 1) &&
    closeP(moved.points.P, s.points.P, 1e-12));
  check("the rebuilt centres lie on their new bisectors",
    ["P", "Q", "R"].every((n) => {
      const pairs = { P: ["V", "W"], Q: ["W", "U"], R: ["U", "V"] };
      const [a, b] = pairs[n];
      return close(C.distToLine(moved.points[n], moved.points.O, moved.points[a]),
        C.distToLine(moved.points[n], moved.points.O, moved.points[b]), 1e-8);
    }));
  check("a centre drag slides it along its bisector",
    (() => {
      const q = C.withPoint(s, "P", P(s.points.P.x + 30, s.points.P.y + 70));
      const foot = C.bisectors(s).P;
      return close(C.distToLine(q.points.P, s.points.O, foot), 0, 1e-8);
    })());
  check("an unknown handle is refused", C.withPoint(s, "Z", target) === s);
  check("a non-finite drag is refused", C.withPoint(s, "U", P(NaN, 4)) === s);
  check("the Show names checkbox toggles",
    C.withNames(s, false).showNames === false &&
    C.withNames(C.withNames(s, false), true).showNames === true);
  check("the original position is never changed", s.points.U.x === 100);
  check("no drag can win or lose an illustration", C.result(moved) === null);
}

/* ------------------- 3. the applet's own bytecode, transcribed a second time */

{
  const rand = rng(5872);
  let compared = 0, maxPointError = 0, maxLineError = 0;
  /* NaN crossings agree with NaN crossings; anything else must be close. */
  const err = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) ? 0 : Math.abs(a - b);
  for (let i = 0; i < 180; i++) {
    const width = 400 + Math.floor(rand() * 240);
    const height = 300 + Math.floor(rand() * 200);
    let s = C.start({ width, height });
    for (const name of ["U", "V", "W"]) {
      s = C.withPoint(s, name, P(20 + rand() * (width - 40), 20 + rand() * (height - 40)));
    }
    const coreInit = C.start({ width, height });
    const apInit = AP_start(width, height);
    for (const name of C.NAMES) {
      maxPointError = Math.max(maxPointError,
        err(coreInit.points[name].x, apInit[name].x),
        err(coreInit.points[name].y, apInit[name].y));
    }
    const g = C.compute(s), ap = AP_compute(s);
    for (const name of ["P", "Q", "R"]) {
      maxPointError = Math.max(maxPointError,
        err(g.circles[name].x, ap.circles[name].x),
        err(g.circles[name].y, ap.circles[name].y),
        err(g.circles[name].r, ap.circles[name].r));
    }
    for (const name of ["PQ", "QR", "RP"]) {
      const a = g.lines[name], b = ap.lines[name];
      if (Boolean(a) !== Boolean(b)) { maxLineError = Infinity; continue; }
      if (a) {
        maxLineError = Math.max(maxLineError,
          err(a.a.x, b.a.x), err(a.a.y, b.a.y),
          err(a.b.x, b.b.x), err(a.b.y, b.b.y));
      }
    }
    for (const name of ["A", "B", "C"]) {
      maxPointError = Math.max(maxPointError,
        err(g.crossings[name].x, ap.crossings[name].x),
        err(g.crossings[name].y, ap.crossings[name].y));
    }
    if (g.X && ap.X) {
      maxPointError = Math.max(maxPointError, err(g.X.x, ap.X.x), err(g.X.y, ap.X.y));
    }
    compared++;
  }
  check("180 configurations compared with the second transcription", compared === 180);
  check("init, circles and every crossing agree with the bytecode", maxPointError < 1e-7,
    `max error ${maxPointError}`);
  check("the three second tangents agree with the bytecode", maxLineError < 1e-7,
    `max error ${maxLineError}`);
  check("CommonPoint divides PQ in the ratio of the radii", (() => {
    const a = { x: 10, y: 0, r: 1 }, b = { x: 40, y: 0, r: 2 };
    return closeP(C.commonPoint(a, b), P(20, 0), 1e-12) &&
      closeP(AP_commonTangent(a, b).a, P(20, 0), 1e-12);
  })());
  check("the coalesced tangent is perpendicular to the centre line", (() => {
    const a = { x: 10, y: 0, r: 1 }, b = { x: 40, y: 0, r: 2 };
    const ln = C.commonTangent(a, b);
    return close(ln.a.x, 20, 1e-12) && close(ln.a.x - ln.b.x, 0, 1e-12);
  })());
  check("the Y branch of circle intersection agrees with the X branch", (() => {
    const a = { x: 5, y: 5, r: 10 }, b = { x: 5.2, y: 20, r: 10 };
    const q = AP_circleIntersections(a, b);
    return Boolean(q) && q.every((p) => close(Math.hypot(p.x - a.x, p.y - a.y), 10, 1e-8)) &&
      q.every((p) => closeP(p, C.circleIntersectionsY(a, b)[q.indexOf(p)], 1e-8));
  })());
}

/* ---------------------- 4. the page's claims, over the parameter space */

{
  const rand = rng(1864);
  let samples = 0, regular = 0, degenerate = 0;
  let rayTouch = 0, tangentTouch = 0, mirrored = 0, concurrent = 0;
  let independentConcurrent = 0;
  let worstSpread = 0;

  for (let attempt = 0; attempt < 12000 && samples < 360; attempt++) {
    const width = 400 + Math.floor(rand() * 240);
    const height = 300 + Math.floor(rand() * 200);
    let s = C.start({ width, height });
    for (const name of ["U", "V", "W"]) {
      s = C.withPoint(s, name, P(15 + rand() * (width - 30), 15 + rand() * (height - 30)));
    }
    if (rand() < 0.35) {
      s = C.withPoint(s, "O", P(width * 0.3 + rand() * width * 0.4,
        height * 0.3 + rand() * height * 0.4));
    }
    /* The page assumes that no angle at O exceeds 180 degrees. */
    if (!raysSpread(s).every((g) => g > 0.5 && g < Math.PI - 0.12)) continue;
    const cl = C.claims(s);
    if (!cl.regular) continue;
    if (cl.degenerate) { degenerate++; continue; }
    samples++;
    regular++;

    /* Independently: touch means the radius is perpendicular to the line. */
    let touchRays = true, touchLines = true, mirrorOK = true;
    for (const pair of C.PAIRS) {
      for (const nm of [pair.first, pair.second]) {
        const c = cl.circles[nm];
        const ray = C.CIRCLE_RAYS[nm].find((n) => n !== pair.ray);
        if (!close(distLine(c, s.points.O, s.points[ray]), c.r, 1e-6)) touchRays = false;
        const ln = cl.lines[pair.name];
        if (ln && !close(distLine(c, ln.a, ln.b), c.r, 1e-6)) touchLines = false;
      }
      const c1 = cl.circles[pair.first], c2 = cl.circles[pair.second];
      const q1 = mirror(s.points.O, c1, c2);
      const q2 = mirror(s.points[pair.ray], c1, c2);
      const ln = cl.lines[pair.name];
      const reflected = { x: q2.x - q1.x, y: q2.y - q1.y };
      const actual = { x: ln.b.x - ln.a.x, y: ln.b.y - ln.a.y };
      const sin = Math.abs(cross2(reflected, actual)) / (len(reflected) * len(actual));
      if (!(sin < 1e-7)) mirrorOK = false;
    }
    if (touchRays) rayTouch++;
    if (touchLines) tangentTouch++;
    if (mirrorOK && cl.mirrored) mirrored++;
    if (cl.concurrent) concurrent++;

    /* A second, determinant-based concurrency check, independent of the
     * applet's Intersect and DrawIntersection average. */
    const [qr, rp, pq] = [cl.lines.QR, cl.lines.RP, cl.lines.PQ];
    const cuts = [detIntersect(qr.a, qr.b, rp.a, rp.b),
      detIntersect(rp.a, rp.b, pq.a, pq.b),
      detIntersect(pq.a, pq.b, qr.a, qr.b)];
    if (cuts.every(Boolean)) {
      const sp = Math.max(Math.hypot(cuts[0].x - cuts[1].x, cuts[0].y - cuts[1].y),
        Math.hypot(cuts[1].x - cuts[2].x, cuts[1].y - cuts[2].y),
        Math.hypot(cuts[0].x - cuts[2].x, cuts[0].y - cuts[2].y));
      worstSpread = Math.max(worstSpread, sp);
      if (sp < 1e-6 * Math.max(width, height)) independentConcurrent++;
    }
  }

  check("360 non-degenerate configurations were sampled", regular === 360);
  check("the sample includes degenerate ones, reported honestly", degenerate > 0);
  check("each ray touches both circles of its pair in all 360 configurations",
    rayTouch === 360);
  check("each second tangent touches both circles of its pair", tangentTouch === 360);
  check("the second tangent is the mirror of the ray in the centre line",
    mirrored === 360);
  check("claims() reports concurrency in every configuration", concurrent === 360);
  check("an independent determinant check finds the same concurrency",
    independentConcurrent === 360, `worst spread ${worstSpread}`);
  check("the applet's averaged X is very close to the true common point",
    worstSpread < 1e-6);

  /* Near-tangent circles make the applet's "distance from O > 1" choice
   * unstable; the core must say so instead of claiming a false concurrency. */
  let seenUnstable = 0;
  const r2 = rng(164);
  for (let i = 0; i < 500 && seenUnstable < 6; i++) {
    let s = C.start({});
    for (const n of ["U", "V", "W"]) {
      s = C.withPoint(s, n, P(20 + r2() * 560, 20 + r2() * 460));
    }
    const cl = C.claims(s);
    if (cl.regular && cl.degenerate && !cl.concurrent) seenUnstable++;
  }
  check("ill-conditioned pictures are flagged, not called concurrent", seenUnstable > 0);
  check("an illustration still has no result after many moves", C.result(C.start({})) === null);
}

done("isogonal-tangents");
