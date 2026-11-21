#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-and-limit/circles-and-limit-core.js.
 *
 *   node porting/check-circles-and-limit.mjs
 *
 * Three parts:
 *  1. The applet's own geometry transcribed a second time, straight from
 *     javap: GeoSDoub.IntersectCirclesX (the branch used when the circle
 *     centres share a y coordinate) and GeoSDoub.Intersect(p0,p1,p2,p3)
 *     (the homogeneous-line formula), assembled the way
 *     CirclesAndLimitCanvas.Compute/Compute1/2/3 assemble them. Compared with
 *     the core over a fine grid of radii for five different fixed circles.
 *  2. Every claim on the cut-the-knot page, exhaustively over that grid: the
 *     fixed circle of radius 3 at (3,0), A on the positive y-axis, B the upper
 *     crossing, E on the x-axis and on line AB, the closed form
 *     x_E = 2a(1 + sqrt(1 - (r/2a)^2)), the limit (12,0) for a = 3, and the
 *     general "four times farther from the origin than the centre" claim
 *     limit = 4a for several a.
 *  3. The rules' edges: the drawable range 0 < r <= 2a, the invalid cases,
 *     each geometric proof, the applet's own "four times the radius" fallback,
 *     plain-JSON positions, and the words shown in #status.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("circles-and-limit/circles-and-limit-core.js", "CirclesAndLimitCore");

const near = (a, b, eps = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
const ptNear = (p, q, eps = 1e-9) => !!p && !!q && near(p.x, q.x, eps) && near(p.y, q.y, eps);

/* --------------------------------------- 1. the core vs the applet's methods */

// GeoSDoub.IntersectCirclesX, transcribed literally from javap. It solves
// x = k*y + b for the radical axis and returns the two intersections.
function appletIntersectCirclesX(c0, r0, c1, r1) {
  const k = -(c0.y - c1.y) / (c0.x - c1.x);
  const b = (c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c0.y * c0.y -
    r0 * r0 + r1 * r1) / (2 * (c0.x - c1.x));
  const d = b - c0.x;
  const A = k * k + 1;
  const B = k * d - c0.y;
  const Cc = d * d + c0.y * c0.y - r0 * r0;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y0 = (-B + root) / A;
  const y1 = (-B - root) / A;
  return [{ x: k * y0 + b, y: y0 }, { x: k * y1 + b, y: y1 }];
}

// GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), literally the
// homogeneous-line coefficients and Cramer's rule from the bytecode.
function appletLineIntersect(p0, p1, p2, p3) {
  const a1 = p0.y - p1.y;
  const b1 = p1.x - p0.x;
  const c1 = p0.x * p1.y - p0.y * p1.x;
  const a2 = p2.y - p3.y;
  const b2 = p3.x - p2.x;
  const c2 = p2.x * p3.y - p2.y * p3.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

// Where a ray from p0 through p1 meets a circle: an independent solve of
// |p0 + t*(p1-p0) - centre|^2 = radius^2, used for proof 3's point D.
function appletRayCircle(p0, p1, centre, radius) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const fx = p0.x - centre.x;
  const fy = p0.y - centre.y;
  const qa = dx * dx + dy * dy;
  const qb = 2 * (fx * dx + fy * dy);
  const qc = fx * fx + fy * fy - radius * radius;
  const disc = qb * qb - 4 * qa * qc;
  if (qa === 0 || disc < 0) return null;
  const r1 = (-qb + Math.sqrt(disc)) / (2 * qa);
  const r2 = (-qb - Math.sqrt(disc)) / (2 * qa);
  return [
    { x: p0.x + r1 * dx, y: p0.y + r1 * dy },
    { x: p0.x + r2 * dx, y: p0.y + r2 * dy },
  ];
}
const appletDist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const appletMid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
function appletOther(points, ref) {
  return appletDist(points[0], ref) >= appletDist(points[1], ref) ? points[0] : points[1];
}

// CirclesAndLimitCanvas.Compute() + Compute1/2/3(), in mathematical
// coordinates (y up). The applet works in screen coordinates (y down), which
// only flips the sign of every y; picking the upper B is the same decision.
function appletCompute(a, r, proof) {
  const O = { x: 0, y: 0 };
  const S = { x: a, y: 0 };
  const A = { x: O.x, y: r }; // applet: O.y - radius, i.e. above O on screen
  let C = { x: O.x, y: -r };
  const limit = { x: O.x + 4 * a, y: O.y };
  const pts = appletIntersectCirclesX(O, r, S, a);
  if (!pts || !Number.isFinite(pts[0].x) || !Number.isFinite(pts[1].x)) {
    return { valid: false, O, S, A, B: null, C, E: limit, D: null, F: null, limit };
  }
  const B = pts[0].y >= pts[1].y ? pts[0] : pts[1];
  let E = appletLineIntersect(A, B, O, S); // line AB with the line of centres
  if (!Number.isFinite(E.x)) E = { x: O.x + 4 * a, y: O.y }; // the applet's fallback
  let D = null;
  let F = null;
  if (proof === 1) {
    D = appletLineIntersect(B, C, O, S);
    F = { x: S.x + a, y: O.y };
  } else if (proof === 2) {
    D = appletMid(O, B);
    F = appletMid(A, B);
  } else if (proof === 3) {
    F = appletMid(A, B);
    D = appletOther(appletRayCircle(O, F, S, a), O);
    C = { x: S.x + a, y: O.y }; // Compute3 relabels this point as C
  }
  return { valid: true, O, S, A, B, C, E, D, F, limit };
}

{
  const radii = (a) => Array.from({ length: 201 }, (_, i) =>
    +(a / 50 + i * (2 * a - a / 50) / 200).toFixed(8));
  for (const a of [1.5, 2, 3, 4, 5]) {
    for (const proof of [1, 2, 3]) {
      for (const r of radii(a)) {
        const s = C.start({ a, r, proof, showNames: true, showHint: true });
        const mine = C.compute(s);
        const ref = appletCompute(a, r, proof);
        const tag = `applet a=${a} r=${r} proof=${proof}`;
        check(`${tag}: valid`, mine.valid === ref.valid);
        check(`${tag}: O`, ptNear(mine.O, ref.O));
        check(`${tag}: S`, ptNear(mine.S, ref.S));
        check(`${tag}: A`, ptNear(mine.A, ref.A));
        check(`${tag}: B`, ptNear(mine.B, ref.B));
        check(`${tag}: C`, ptNear(mine.C, ref.C));
        check(`${tag}: E`, ptNear(mine.E, ref.E));
        check(`${tag}: limit`, ptNear(mine.limit, ref.limit));
        check(`${tag}: D`, ptNear(mine.D, ref.D));
        check(`${tag}: F`, ptNear(mine.F, ref.F));
      }
    }
  }
}

/* ------------------------------------------- 2. the page's claims, exhaustively */

{
  // The page: a stationary circle of radius 3 centred at (3,0).
  const s = C.start({});
  check("the fixed circle has radius 3", s.a === 3);
  const pic = C.compute(s);
  check("the fixed centre is (3,0)", ptNear(pic.S, { x: 3, y: 0 }));
  check("the origin lies on the fixed circle", near(appletDist(pic.S, pic.O), pic.S.x));

  for (const a of [1, 1.5, 2, 3, 4, 5, 10]) {
    for (let i = 1; i <= 400; i++) {
      const r = (2 * a) * i / 400;
      const p = C.compute(C.start({ a, r }));
      const sFactor = C.sOf(r, a);
      // B sits on both circles, above the axis, at the predicted coordinates.
      check(`a=${a} r=${r}: B.x = r^2/(2a)`, near(p.B.x, r * r / (2 * a)));
      check(`a=${a} r=${r}: B.y = r*sqrt(1-(r/2a)^2)`, near(p.B.y, r * sFactor));
      check(`a=${a} r=${r}: B on the small circle`, near(appletDist(p.O, p.B), r));
      check(`a=${a} r=${r}: B on the fixed circle`, near(appletDist(p.S, p.B), a));
      // A is the meeting with the positive y-axis, r from the origin.
      check(`a=${a} r=${r}: A = (0,r)`, ptNear(p.A, { x: 0, y: r }));
      // E is on the x-axis and on the closed-form line through A and B.
      check(`a=${a} r=${r}: E on the x-axis`, near(p.E.y, 0));
      check(`a=${a} r=${r}: E = 2a(1+sqrt(1-(r/2a)^2))`,
        near(p.E.x, C.xOfE(r, a), 1e-8));
      const cross = (p.B.x - p.A.x) * (p.E.y - p.A.y) - (p.B.y - p.A.y) * (p.E.x - p.A.x);
      check(`a=${a} r=${r}: A, B, E are collinear`, near(cross, 0, 1e-7));
      check(`a=${a} r=${r}: E lies beyond B on the axis`, p.E.x >= p.B.x - 1e-9);
    }
  }

  // The heart of the page: E tends to (12,0) for a = 3, not to infinity.
  check("limit for a=3 is x=12", C.limitX(3) === 12);
  for (const r of [0.5, 0.2, 0.1, 0.05, 0.01, 0.001, 1e-4]) {
    const e = C.compute(C.start({ r })).E;
    check(`r=${r}: E is near 12`, near(e.x, 12, Math.max(1e-6, 0.06 * r)));
  }
  check("E never passes the limit", [0.01, 0.1, 1, 2, 3, 4, 5, 6]
    .every((r) => C.compute(C.start({ r })).E.x <= 12 + 1e-9));
  check("E at r=2a equals 2a", near(C.compute(C.start({ r: 6 })).E.x, 6));

  // General claim: the limit is four times farther from the origin than the
  // centre of the fixed circle, i.e. 4a for any radius a.
  for (const a of [1, 2, 3, 5, 10]) {
    const e = C.compute(C.start({ a, r: a / 1000 })).E;
    check(`a=${a}: limit = 4a = ${4 * a}`, near(C.limitX(a), 4 * a) && near(e.x, 4 * a, 4 * a * 1e-6));
    check(`a=${a}: closed form tends to 4a`, near(C.xOfE(a / 10000, a), 4 * a, 4 * a * 1e-6));
  }

  // The applet's own degenerate fallback writes E.x = O.x + 4*(fixed radius),
  // which is exactly the limit — so code and page agree.
  const degenerate = appletLineIntersect({ x: 0, y: 1 }, { x: 1e-13, y: 1 }, { x: 0, y: 0 }, { x: 3, y: 0 });
  check("the applet returns NaN for a line parallel to the axis", Number.isNaN(degenerate.x));
  check("the fallback x equals four times the fixed radius", near(0 + 4 * 3, C.limitX(3)));
}

/* ----------------------------- 3. the same answers as the applet's own method */

{
  const s = C.start({});
  check("start radius is 2", s.r === C.DEFAULT_R);
  check("start is not explored", s.explored === false && C.result(s) === null);
  check("start names and hint are off", !s.showNames && !s.showHint && s.proof === 1);
  check("start honours options", C.start({ r: 4, showNames: true, showHint: true, proof: 3 }).r === 4);
  check("start({r:4}) keeps the options", (() => {
    const o = C.start({ r: 4, showNames: true, showHint: true, proof: 3 });
    return o.showNames && o.showHint && o.proof === 3;
  })());

  for (const bad of [0, -1, 6.0001, NaN, Infinity]) {
    check(`setR refuses ${bad}`, C.setR(s, bad) === s);
  }
  check("setR accepts the smallest slider value", C.setR(s, C.R_MIN).r === C.R_MIN);
  check("setR accepts the tangency r=2a", C.setR(s, 6).r === 6);
  check("setR does not mutate", s.r === 2 && C.setR(s, 1).r === 1);
  check("an explored position is done", C.result(C.setR(s, 1)) === "done");

  const forced = (r) => Object.assign({}, s, { r }); // start() clamps bad radii
  check("circles do not meet beyond r=2a", C.compute(forced(6.5)).valid === false);
  check("at r=0 the circles are tangent at the origin", (() => {
    const p = C.compute(forced(0));
    return p.valid && ptNear(p.B, { x: 0, y: 0 });
  })());
  check("at r=0 E falls back to the limit", ptNear(C.compute(forced(0)).E, { x: 12, y: 0 }));
  check("the invalid case still reports the limit", ptNear(C.compute(forced(7)).E, { x: 12, y: 0 }));

  for (const proof of [1, 2, 3]) {
    for (const r of [0.2, 1, 2, 4, 6]) {
      const p = C.compute(C.start({ r, proof }));
      check(`proof ${proof} at r=${r}: D is finite`, !!p.D && Number.isFinite(p.D.x) && Number.isFinite(p.D.y));
      check(`proof ${proof} at r=${r}: F is finite`, !!p.F && Number.isFinite(p.F.x) && Number.isFinite(p.F.y));
      if (r < 6) check(`proof ${proof} at r=${r}: D and F differ`, appletDist(p.D, p.F) > 1e-6);
    }
  }
  const p3 = C.compute(C.start({ r: 2, proof: 3 }));
  check("proof 3 relabels C at the right end of the fixed circle", ptNear(p3.C, { x: 6, y: 0 }));
  check("proof 2 puts F at the midpoint of A and B", (() => {
    const p = C.compute(C.start({ r: 2, proof: 2 }));
    return ptNear(p.F, appletMid(p.A, p.B));
  })());

  const toggled = C.setProof(C.setShowHint(C.setShowNames(s, true), true), 2);
  check("toggles set explored", toggled.explored === true);
  check("setProof refuses an unknown proof", C.setProof(s, 4) === s);
  check("setShowNames(value) is boolean", C.setShowNames(s, 1).showNames === false);

  const round = JSON.parse(JSON.stringify(toggled));
  equal("a position survives a JSON round-trip", round, toggled);

  check("reset sentence names the radius", /r = 2\.00/.test(C.describe("reset", s)));
  check("r sentence names E and the limit 12", /radius r = 2\.00/.test(C.describe("r", s)) &&
    /limit at 12/.test(C.describe("r", s)));
  check("names sentence says shown", /shown/.test(C.describe("names", C.setShowNames(s, true))));
  check("hint sentence names D and F", /D and F/.test(C.describe("hint", C.setShowHint(s, true))));
  check("proof sentence names the proof", /proof 3/.test(C.describe("proof", C.setProof(s, 3))));
}

done("circles-and-limit");
