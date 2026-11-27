#!/usr/bin/env node
"use strict";

/*
 * Logic test for chasles-tangents/chasles-tangents-core.js.
 *
 *   node porting/check-chasles-tangents.mjs
 *
 * Checked: the start position against ChaslesTangentsCanvas.Reset; every move
 * (a point pushed back onto the circle as CorrectPoint does, centre and radius
 * drags, both checkboxes); then 240 configurations sampled across the whole
 * parameter space. The exact claim printed on the applet's page,
 *
 *   K(ABCD) = (A'B'C'D')   for every K on the conic,
 *
 * is checked at the current K and at 12 other K's in each configuration,
 * together with the Page's Note: Eves' angle step A'OT = 1/2 AOT = AKT holds
 * at O but not at every K on the circle (the inscribed angle is then the
 * supplement), while the cross-ratio still agrees.
 *
 * The last group is a second, literal transcription of the applet's own
 * bytecode: DoubCircle.Tangent (P.x - dy, P.y + dx, or null when P is more
 * than one unit off the circle), GeoSDoub.Intersect (det < 1 -> NaN), and
 * ChaslesTangentsCanvas.Compute (A' = t ^ tangent at A, ...). It is compared
 * with the core over every sampled configuration, not just a few examples.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("chasles-tangents/chasles-tangents-core.js", "ChaslesTangentsCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => finite(p) && finite(q) &&
  Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const wrap = (t) => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const sep = (a, b) => Math.min(wrap(a - b), wrap(b - a));

/* ---------------------- the applet's own methods, transcribed from bytecode */

/* DoubCircle.Tangent(P): second point of the tangent through P, or null. */
function appletTangent(circle, p) {
  const dx = p.x - circle.center.x, dy = p.y - circle.center.y;
  if (Math.abs(Math.hypot(dx, dy) - circle.r) > 1) return null;
  return { x: p.x - dy, y: p.y + dx };
}

/* GeoSDoub.Intersect(P1P2, P3P4), in the applet's determinant formulation. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* ChaslesTangentsCanvas.Compute, with GetTangent and the four crossings. */
function appletCompute(s) {
  const circle = s.circle, p = s.points;
  const tangent = (x) => {
    const q = appletTangent(circle, p[x]);
    if (!q) return null;
    return { a: p[x], b: q };
  };
  const t = tangent("T");
  const lines = { T: t, A: tangent("A"), B: tangent("B"), C: tangent("C"), D: tangent("D") };
  const cross = {};
  for (const name of ["A", "B", "C", "D"]) {
    cross[name + "p"] = t && lines[name]
      ? appletIntersect(t.a, t.b, lines[name].a, lines[name].b)
      : { x: NaN, y: NaN };
  }
  return { lines, cross };
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("start circle centre is (w/3, 2h/3)", s.circle.center, { x: 400 / 3, y: 200 });
  check("start radius is min(w,h)/6", close(s.circle.r, 50, 1e-12));
  for (const name of C.NAMES) {
    check(`start point ${name} sits on the circle`,
      close(dist(s.points[name], s.circle.center), s.circle.r, 1e-9));
    check(`start point ${name} is at Reset's angle`,
      close(wrap(C.angleOn(s.circle, s.points[name])), wrap(C.ANGLES[name]), 1e-9));
  }
  check("Show names starts unchecked", s.showNames === false);
  check("Allow hint starts unchecked", s.allowHint === false);
  check("an illustration has no win, loss or end", C.result(s) === null);

  const big = C.start({ width: 500, height: 400 });
  check("the applet's embedded 500x400 size is supported",
    close(big.circle.center.x, 500 / 3, 1e-12) && close(big.circle.r, 400 / 6, 1e-12));
}

/* ------------------------------------------------------------ 2. the moves */

{
  const s = C.start({});
  const target = { x: 180, y: 180 };
  const after = C.withPoint(s, "A", target);
  check("a dragged point lands back on the circle",
    close(dist(after.points.A, s.circle.center), s.circle.r, 1e-9));
  check("a dragged point keeps the angle the player chose",
    close(wrap(C.angleOn(s.circle, after.points.A)), wrap(Math.atan2(180 - 200, 180 - 400 / 3)), 1e-9));
  check("a drag leaves the other points alone",
    C.NAMES.filter((n) => n !== "A").every((n) => closePoint(s.points[n], after.points[n], 0)));
  check("a drag does not change the circle", after.circle === s.circle);
  check("an unknown point is refused", C.withPoint(s, "Z", target) === s);
  check("a non-finite drag is refused", C.withPoint(s, "A", { x: NaN, y: 0 }) === s);
  check("a drag onto the centre is refused",
    C.withPoint(s, "A", { x: s.circle.center.x, y: s.circle.center.y }) === s);

  const moved = C.withCenter(s, { x: s.circle.center.x + 30, y: s.circle.center.y - 12 });
  check("a centre drag moves the centre", closePoint(moved.circle.center, { x: s.circle.center.x + 30, y: 188 }, 1e-9));
  check("a centre drag carries every point with it",
    C.NAMES.every((n) => closePoint(moved.points[n],
      { x: s.points[n].x + 30, y: s.points[n].y - 12 }, 1e-9)));
  check("a centre drag leaves the radius alone", close(moved.circle.r, s.circle.r, 1e-12));

  const resized = C.withRadius(s, { x: s.circle.center.x + 90, y: s.circle.center.y });
  check("a radius drag changes the radius", close(resized.circle.r, 90, 1e-9));
  check("a radius drag keeps the five angles",
    C.NAMES.every((n) => close(wrap(C.angleOn(resized.circle, resized.points[n])),
      wrap(C.angleOn(s.circle, s.points[n])), 1e-9)));
  check("a radius drag keeps every point on the circle",
    C.NAMES.every((n) => close(dist(resized.points[n], resized.circle.center), 90, 1e-9)));

  check("Show names toggles", C.withNames(s, true).showNames === true &&
    C.withNames(C.withNames(s, true), false).showNames === false);
  check("Allow hint toggles", C.withHint(s, true).allowHint === true &&
    C.withHint(C.withHint(s, true), false).allowHint === false);
  check("the original position is never changed", s.points.A.x === (400 / 3) + 50 * Math.cos(Math.PI / 4));
}

/* ----------------------------- 3. the same answers as the applet's own code */

{
  const s = C.start({});
  check("parallel lines have no crossing under GeoSDoub.Intersect",
    Number.isNaN(C.intersect({ x: 0, y: 1 }, { x: 10, y: 1 }, { x: 0, y: 3 }, { x: 10, y: 3 }).x));
  check("a non-finite line end has no crossing",
    Number.isNaN(C.intersect({ x: 0, y: 1 }, { x: NaN, y: 1 }, { x: 0, y: 3 }, { x: 10, y: 3 }).x));
  const g = C.compute(s);
  check("the start position has all four tangent crossings",
    ["Ap", "Bp", "Cp", "Dp"].every((k) => finite(g.primes[k])));
  check("the four crossings lie on the tangent at T",
    ["Ap", "Bp", "Cp", "Dp"].every((k) => close(g.primes[k].y, s.points.T.y, 1e-9)));

  for (const name of ["T", "A", "B", "C", "D"]) {
    const line = g.tangents[name];
    const p = s.points[name];
    const ap = appletTangent(s.circle, p);
    check(`DoubCircle.Tangent at ${name} agrees with the core`,
      closePoint(line.b, ap, 1e-9));
    const r = { x: p.x - s.circle.center.x, y: p.y - s.circle.center.y };
    const d = { x: line.b.x - p.x, y: line.b.y - p.y };
    check(`the tangent at ${name} touches the circle at ${name}`,
      Math.abs(r.x * d.x + r.y * d.y) < 1e-8);
  }
  check("DoubCircle.Tangent rejects a point more than 1 unit off the circle",
    C.tangentAt(s.circle, { x: s.points.A.x + 2, y: s.points.A.y }) === null);
  check("DoubCircle.Tangent accepts a point within 1 unit of the circle",
    C.tangentAt(s.circle, { x: s.points.A.x + 0.5, y: s.points.A.y }) !== null);
}

/* -------------------------------------- 4. 240 configurations, every claim */

{
  const rand = rng(3132);
  let configs = 0, computed = 0, equal = 0, independent = 0;
  let primeStep = 0, kHolds = 0, kFails = 0, kAgrees = 0, kSamples = 0;

  /* A configuration with enough room: no two points on top of each other and
   * no tangent parallel to t (the applet's Intersect would return NaN). */
  function makeState() {
    let angles;
    for (;;) {
      angles = [rand() * 2 * Math.PI];
      for (let i = 1; i < 5; i++) angles.push(rand() * 2 * Math.PI);
      const ok = angles.every((t) => Math.abs(Math.cos(t)) > 0.08) &&
        angles.every((t, i) => angles.slice(i + 1).every((u) => sep(t, u) > 0.12));
      if (ok) break;
    }
    let s = C.start({ width: 400 + Math.floor(rand() * 200), height: 300 + Math.floor(rand() * 160) });
    const names = ["T", "A", "B", "C", "D"];
    names.forEach((name, i) => {
      s = C.withPoint(s, name, C.circleAt(s.circle, angles[i]));
    });
    if (s.circle.r < 20) s = C.withRadius(s, { x: s.circle.center.x + 40, y: s.circle.center.y });
    return s;
  }

  for (let i = 0; i < 240; i++) {
    const s = makeState();
    configs++;
    const core = C.compute(s);
    const applet = appletCompute(s);
    for (const name of ["A", "B", "C", "D"]) {
      computed++;
      if (closePoint(core.primes[name + "p"], applet.cross[name + "p"], 1e-6)) computed++;
    }
    const cl = C.claims(s);
    if (cl.regular) equal++;
    if (cl.independent) independent++;
    if (cl.atPrime) primeStep++;

    for (let j = 0; j < 12; j++) {
      const k = C.circleAt(s.circle, 0.21 + (j * 2 * Math.PI) / 12);
      const ks = { ...s, points: { ...s.points, K: k } };
      const crK = C.crossRatioPencil(k, s.points.A, s.points.B, s.points.C, s.points.D);
      const crT = C.crossRatioLine(cl.primes.Ap, cl.primes.Bp, cl.primes.Cp, cl.primes.Dp);
      kSamples++;
      if (close(crK, crT, 1e-6)) kAgrees++;
      /* Eves' step (1): the angle at O is always half the central angle, but
       * at K it is the supplement for half of the circle. */
      const half = C.signedAngle(s.circle.center, s.points.A, s.points.T) / 2;
      const atK = C.signedAngle(k, s.points.A, s.points.T);
      const d = Math.abs(C.angleDifference(atK, half));
      if (d < 1e-7) kHolds++;
      else if (Math.abs(d - Math.PI) < 1e-7) kFails++;
    }
  }

  check("240 configurations were built", configs === 240);
  check("the core's four crossings match the applet's Compute everywhere",
    computed === 240 * 4 * 2, `${computed} of ${240 * 4 * 2}`);
  check("all four crossings are regular in every sampled configuration", equal === configs);
  check("the cross-ratio K(ABCD) equals (A'B'C'D') in every configuration", kAgrees === kSamples);
  check("claims() reports the page's equality in every configuration", equal === independent);
  check("Eves' angle step at O holds in every configuration", primeStep === configs);
  check("the inscribed-angle step holds for K on one arc", kHolds > 100);
  check("the inscribed-angle step fails for K on the other arc", kFails > 100);
  check("the page's Note is honest: both arcs occur in the same configurations",
    kHolds + kFails === kSamples);

  const degenerates = C.withPoint(C.withPoint(C.start({}), "A", C.circleAt(C.start({}).circle, Math.PI / 4)), "B",
    C.circleAt(C.start({}).circle, Math.PI / 4));
  check("two equal points make the page's construction degenerate, reported honestly",
    C.claims(degenerates).regular === false);
  check("an illustration still has no result after a drag", C.result(degenerates) === null);
}

done("chasles-tangents");
