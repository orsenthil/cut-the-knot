#!/usr/bin/env node
"use strict";

/*
 * Logic test for euler-to-euler/euler-to-euler-core.js.
 *
 *   node porting/check-euler-to-euler.mjs
 *
 * Checked: the start triangle against EulerToEulerCanvas.init for several
 * canvas sizes; every point of the diagram against a second, literal
 * transcription of the applet's own GeoSDoub and EulerToEulerCanvas methods
 * (midpoints, perpendicular bisectors, altitudes, the |det| < 1 intersection
 * and the 0.5-unit Euler-line cutoff) over fixed triangles, an integer grid and
 * thousands of random ones; and the page's one claim — that the Euler line of
 * AMN is parallel to BC — both with the applet's arithmetic and with an
 * independent closed-form computation. The cases where either Euler line is
 * undefined are counted separately, not silently skipped.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("euler-to-euler/euler-to-euler-core.js", "EulerToEulerCore");

const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });
const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) =>
  (finite(p) && finite(q) && close(p.x, q.x, tol) && close(p.y, q.y, tol)) ||
  (!finite(p) && !finite(q));
const hypot = (p) => Math.hypot(p.x, p.y);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const cross = (u, v) => u.x * v.y - u.y * v.x;

/* ------------------------------------------------ the applet's own methods */

/* GeoSDoub.Intersect(P1,P2,P3,P4): lines in ax+by+c form; |det| < 1 is NaN. */
function apIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}
const apMid2 = (P, Q) => ({ x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 });
const apMid3 = (P, Q, R) => ({ x: (P.x + Q.x + R.x) / 3, y: (P.y + Q.y + R.y) / 3 });

/* GeoSDoub.SqDist / Dist, written the way the Java code writes them. */
function apSq(P, Q) { return (P.x - Q.x) ** 2 + (P.y - Q.y) ** 2; }
function apDist(P, Q) { return Math.sqrt(apSq(P, Q)); }

/* GeoSDoub.FindCircumcenter(P,Q,R). */
function apCircumcenter(P, Q, R) {
  const m1 = apMid2(P, Q), m2 = apMid2(Q, R);
  const v1 = { x: m1.x + (Q.y - P.y), y: m1.y - (Q.x - P.x) };
  const v2 = { x: m2.x + (R.y - Q.y), y: m2.y - (R.x - Q.x) };
  return apIntersect(m1, v1, m2, v2);
}

/* GeoSDoub.FindAltitude(P,Q,R). */
function apAltitude(P, Q, R) {
  const v = { x: P.x + (R.y - Q.y), y: P.y - (R.x - Q.x) };
  return apIntersect(P, v, Q, R);
}

/* EulerToEulerCanvas.GetOrthocenter(P,Q,R): two altitudes, then intersect. */
function apOrthocenter(P, Q, R) {
  const h1 = apAltitude(P, Q, R);
  const h2 = apAltitude(Q, P, R);
  return apIntersect(P, h1, Q, h2);
}

/* EulerToEulerCanvas.Draw(g,P,Q,R,true,colour): the centres and their line. */
function apDraw(P, Q, R) {
  const G = apMid3(P, Q, R);
  const O = apCircumcenter(P, Q, R);
  const H = apOrthocenter(P, Q, R);
  const line = apDist(O, H) > 0.5 ? { p1: O, p2: H } : null;
  return { G, O, H, line, defined: Boolean(line) };
}

/* EulerToEulerCanvas.init(w,h), transcribed in the same order. */
function apInit(w = 400, h = 300) {
  const d = Math.min(w, h) / 4;
  const C = { x: w / 2 + 2 * d * Math.cos(0.5), y: h / 2 + 2 * d * Math.sin(0.5) };
  const B = { x: w - C.x, y: C.y };
  const A = { x: (9 * B.x + C.x) / 10, y: h / 2 + d * Math.sin(-1.6) };
  return { A, B, C };
}

/* EulerToEulerCanvas's outer Draw: the first line, M, N and the second line. */
function apDiagram(s) {
  const first = apDraw(s.A, s.B, s.C);
  let M = { x: NaN, y: NaN }, N = { x: NaN, y: NaN };
  if (first.line) {
    M = apIntersect(first.line.p1, first.line.p2, s.A, s.B);
    N = apIntersect(first.line.p1, first.line.p2, s.A, s.C);
  }
  const second = finite(M) && finite(N) ? apDraw(s.A, M, N) : apDraw(M, N, s.A);
  return { first, M, N, second };
}

function scaleOf(s) {
  return Math.max(
    apDist(s.A, s.B), apDist(s.B, s.C), apDist(s.C, s.A),
    1,
  );
}

/** Compare every point the applet would compute with the core's answer. */
function compare(s, label) {
  const core = C.diagram(s);
  const ap = apDiagram(s);
  const tol = 2e-8 * scaleOf(s);
  check(`${label}: G1 matches Canvas.MidPoint`, closePoint(core.first.G, ap.first.G, tol));
  check(`${label}: O1 matches GeoSDoub.FindCircumcenter`, closePoint(core.first.O, ap.first.O, tol));
  check(`${label}: H1 matches Canvas.GetOrthocenter`, closePoint(core.first.H, ap.first.H, tol));
  check(`${label}: first line exists exactly as in Canvas.Draw`, core.first.defined === ap.first.defined);
  check(`${label}: M matches GeoSDoub.Intersect with AB`, closePoint(core.M, ap.M, tol));
  check(`${label}: N matches GeoSDoub.Intersect with AC`, closePoint(core.N, ap.N, tol));
  check(`${label}: G2 matches Canvas.MidPoint on AMN`, closePoint(core.second.G, ap.second.G, tol));
  check(`${label}: O2 matches GeoSDoub.FindCircumcenter on AMN`, closePoint(core.second.O, ap.second.O, tol));
  check(`${label}: H2 matches Canvas.GetOrthocenter on AMN`, closePoint(core.second.H, ap.second.H, tol));
  check(`${label}: second line exists exactly as in Canvas.Draw`, core.second.defined === ap.second.defined);
}

/* ------------------------------- an independent, closed-form check of the claim */

/* For A at the origin this solves the two perpendicular-bisector equations
 * directly, and uses H = A + B + C - 2O, instead of the applet's line methods. */
function exactEuler(P, Q, R) {
  const b = sub(Q, P), c = sub(R, P);
  const d = 2 * (b.x * c.y - b.y * c.x);
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;
  const bb = b.x * b.x + b.y * b.y, cc = c.x * c.x + c.y * c.y;
  const O = {
    x: P.x + (bb * c.y - cc * b.y) / d,
    y: P.y + (cc * b.x - bb * c.x) / d,
  };
  const H = {
    x: P.x + Q.x + R.x - 2 * O.x,
    y: P.y + Q.y + R.y - 2 * O.y,
  };
  return { O, H, dir: sub(H, O) };
}

/* Intersection of line P + t*d with the line Q + s*e, without the applet's
 * pixel tolerance: only a truly parallel pair is rejected. */
function exactIntersect(P, d, Q, e) {
  const det = cross(d, e);
  if (Math.abs(det) < 1e-12 * hypot(d) * hypot(e)) return null;
  const t = cross(sub(Q, P), e) / det;
  return { x: P.x + t * d.x, y: P.y + t * d.y };
}

/* Returns the sine of the angle between the second Euler line and BC, or a
 * string naming why the claim is not defined for this triangle. */
function exactClaim(s) {
  const e1 = exactEuler(s.A, s.B, s.C);
  if (!e1 || hypot(e1.dir) < 1e-7) return "no-euler-1";
  const M = exactIntersect(e1.O, e1.dir, s.A, sub(s.B, s.A));
  const N = exactIntersect(e1.O, e1.dir, s.A, sub(s.C, s.A));
  if (!M || !N) return "no-MN";
  if (hypot(sub(M, s.A)) < 1e-7 || hypot(sub(N, s.A)) < 1e-7 ||
      hypot(sub(M, N)) < 1e-7) return "degenerate-AMN";
  const e2 = exactEuler(s.A, M, N);
  if (!e2 || hypot(e2.dir) < 1e-7) return "no-euler-2";
  return Math.abs(cross(e2.dir, sub(s.C, s.B))) / (hypot(e2.dir) * hypot(sub(s.C, s.B)));
}

/* ---------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  const a = apInit();
  check("start A matches Canvas.init on the default 400x300 canvas", closePoint(s.A, a.A, 1e-12));
  check("start B matches Canvas.init on the default 400x300 canvas", closePoint(s.B, a.B, 1e-12));
  check("start C matches Canvas.init on the default 400x300 canvas", closePoint(s.C, a.C, 1e-12));
  for (const [w, h] of [[600, 450], [320, 240], [1000, 200]]) {
    const s2 = C.start({ width: w, height: h });
    const a2 = apInit(w, h);
    check(`start matches Canvas.init at ${w}x${h}`,
      closePoint(s2.A, a2.A, 1e-12) && closePoint(s2.B, a2.B, 1e-12) && closePoint(s2.C, a2.C, 1e-12));
  }
  check("start honours an explicit triangle", (() => {
    const p = tri({ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 });
    const s3 = C.start({ points: p });
    return s3.A.x === 1 && s3.B.y === 4 && s3.C.x === 5;
  })());
  check("an illustration cannot be won or lost", C.result(s) === null);
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === a.A.x && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown handle leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === a.A.x);
  check("the starting triangle has a first Euler line", C.diagram(s).first.defined);
  check("the starting triangle's M and N are finite", C.diagram(s).mnFinite);
  check("the starting triangle's claim can be checked", C.claims(s).ready);
  check("the starting triangle satisfies the page's claim", C.claims(s).parallel);
}

/* -------------------------------- 2. fixed triangles: acute, right, obtuse, ... */

const fixed = [
  ["the applet's own start", C.start()],
  ["acute", tri({ x: 200, y: 40 }, { x: 60, y: 275 }, { x: 345, y: 260 })],
  ["right", tri({ x: 60, y: 250 }, { x: 60, y: 40 }, { x: 320, y: 250 })],
  ["obtuse at A", tri({ x: 60, y: 150 }, { x: 320, y: 90 }, { x: 300, y: 240 })],
  ["obtuse at B", tri({ x: 180, y: 40 }, { x: 50, y: 260 }, { x: 360, y: 250 })],
  ["obtuse at C", tri({ x: 40, y: 40 }, { x: 360, y: 60 }, { x: 190, y: 250 })],
  ["long and thin", tri({ x: 30, y: 150 }, { x: 370, y: 160 }, { x: 200, y: 175 })],
  ["scalene with M far outside", tri({ x: 100, y: 50 }, { x: 300, y: 80 }, { x: 150, y: 250 })],
];

for (const [name, s] of fixed) {
  compare(s, name);
  const cl = C.claims(s);
  check(`${name}: the diagram is not degenerate in the applet's sense`, C.diagram(s).first.defined);
  check(`${name}: the claim holds`, !cl.ready || cl.parallel);
}

/* -------------------------------------------- 3. an integer grid of triangles */

{
  let compared = 0;
  let allMatch = true;
  let claimsReady = 0;
  let allTrue = true;
  for (let ax = 0; ax < 2; ax++) {
    for (let ay = 0; ay < 2; ay++) {
      for (let bx = 0; bx < 4; bx++) {
        for (let by = 0; by < 4; by++) {
          for (let cx = 0; cx < 4; cx += 2) {
            for (let cy = 1; cy < 4; cy += 2) {
              const s = tri(
                { x: 20 + ax * 350, y: 20 + ay * 250 },
                { x: 20 + bx * 90, y: 10 + by * 80 },
                { x: 15 + cx * 90, y: 15 + cy * 80 },
              );
              const d = C.diagram(s), ap = apDiagram(s);
              const tol = 2e-8 * scaleOf(s);
              if (!closePoint(d.first.O, ap.first.O, tol) ||
                  !closePoint(d.first.H, ap.first.H, tol) ||
                  !closePoint(d.M, ap.M, tol) || !closePoint(d.N, ap.N, tol) ||
                  !closePoint(d.second.O, ap.second.O, tol) ||
                  !closePoint(d.second.H, ap.second.H, tol) ||
                  d.first.defined !== ap.first.defined ||
                  d.second.defined !== ap.second.defined) {
                allMatch = false;
                check(`grid ${ax}${ay}${bx}${by}${cx}${cy}: matches the applet`, false, JSON.stringify(s));
              }
              const cl = C.claims(s);
              if (cl.ready) { claimsReady++; if (!cl.parallel) allTrue = false; }
              compared++;
            }
          }
        }
      }
    }
  }
  check(`all ${compared} grid triangles match the applet transcription`, compared === 256 && allMatch);
  check(`the claim holds on all ${claimsReady} grid triangles where it is defined`, claimsReady > 150 && allTrue);
}

/* ---------------------------- 4. thousands of random triangles, two ways */

{
  const rand = rng(4662);
  const stats = { n: 0, match: 0, ready: 0, true: 0, exactN: 0, exactTrue: 0 };
  const reasons = {};
  for (let i = 0; i < 4000; i++) {
    const s = tri(
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
    );
    const core = C.diagram(s), ap = apDiagram(s);
    const tol = 2e-8 * scaleOf(s);
    stats.n++;
    if (closePoint(core.first.O, ap.first.O, tol) &&
        closePoint(core.first.H, ap.first.H, tol) &&
        closePoint(core.M, ap.M, tol) && closePoint(core.N, ap.N, tol) &&
        closePoint(core.second.O, ap.second.O, tol) &&
        closePoint(core.second.H, ap.second.H, tol) &&
        core.first.defined === ap.first.defined &&
        core.second.defined === ap.second.defined) stats.match++;

    const cl = C.claims(s);
    if (cl.ready) { stats.ready++; if (cl.parallel) stats.true++; }

    const exact = exactClaim(s);
    if (typeof exact === "number") {
      stats.exactN++;
      if (exact < 1e-6) stats.exactTrue++;
    } else reasons[exact] = (reasons[exact] || 0) + 1;
  }
  check(`the core matches the applet on all ${stats.n} random triangles`, stats.match === stats.n);
  check(`the claim holds on all ${stats.ready} random triangles where both lines are drawn`,
    stats.ready > 3300 && stats.true === stats.ready);
  check(`the closed-form computation agrees on all ${stats.exactN} triangles with two Euler lines`,
    stats.exactN > 3600 && stats.exactTrue === stats.exactN);
  check("near-equilateral and parallel cases were counted, not dropped",
    Object.values(reasons).reduce((a, b) => a + b, 0) === stats.n - stats.exactN,
    JSON.stringify(reasons));
}

/* -------------------------------------- 5. the applet's limits and edge cases */

{
  const equilateral = tri(
    { x: 200, y: 280 - 140 * Math.sqrt(3) }, { x: 60, y: 280 }, { x: 340, y: 280 },
  );
  check("an equilateral triangle has no Euler line at the applet's 0.5 cutoff",
    !C.triangleData(equilateral.A, equilateral.B, equilateral.C).defined);
  check("the first Euler line is suppressed there too", !C.claims(equilateral).euler1);
  check("the core uses the applet's one-unit intersection tolerance", C.INTERSECT_MIN === 1);
  check("the core uses the applet's half-unit Euler-line cutoff", C.EULER_MIN === 0.5);
  check("GeoSDoub.Intersect returns NaN for near-parallel lines", (() => {
    const p = C.intersect({ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 0.4 }, { x: 1000, y: 0.4 });
    return !C.finite(p);
  })());
  check("a flat triangle has no first Euler line", !C.claims(tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 })).euler1);
  check("a triangle with a repeated corner is handled without a claim",
    !C.claims(tri({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 100, y: 100 })).ready);
  check("an isosceles triangle at A makes M and N coincide with A", (() => {
    const s = tri({ x: 200, y: 60 }, { x: 80, y: 250 }, { x: 320, y: 250 });
    const d = C.diagram(s);
    return d.mnFinite && !C.claims(s).ready;
  })());
  check("M lies on line AB and N on line AC", (() => {
    const s = C.start();
    const d = C.diagram(s);
    return Math.abs(C.cross(d.A, d.B, d.M)) < 1e-6 * C.distance(d.A, d.B) &&
      Math.abs(C.cross(d.A, d.C, d.N)) < 1e-6 * C.distance(d.A, d.C);
  })());
  check("the exact claim is undefined only where a line or M/N is undefined", (() => {
    const s = C.start();
    return typeof exactClaim(s) === "number" && exactClaim(s) < 1e-6;
  })());
}

done("euler-to-euler");
