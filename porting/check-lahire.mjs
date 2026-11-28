#!/usr/bin/env node
"use strict";

/*
 * Logic test for lahire/lahire-core.js.
 *
 *   node porting/check-lahire.mjs
 *
 * Three kinds of check. First, the core is compared with a second, literal
 * transcription of the applet's own bytecode (init, Inversion.Invert,
 * GetPolar, GeoSDoub.Dist/Intersect, ConnectToCenter and CheckTouch) over
 * thousands of generated pictures. Second, the page's claims are searched
 * over a grid: if A is on B's polar then B is on A's polar, the two inverse
 * points satisfy OA*OD = OB*OC = R^2, and the collinear case still obeys the
 * product even though the page says its triangle proof fails there. Third,
 * the drags, the Show names option and the applet's 1.5-unit tolerance are
 * checked, including the fact that the tolerance is not symmetric.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("lahire/lahire-core.js", "LahireCore");
const EPS = 1e-7;
const near = (a, b, tol = EPS) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const pointNear = (a, b, tol = EPS) =>
  !!a && !!b && near(a.x, b.x, tol) && near(a.y, b.y, tol);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const len = (p) => Math.hypot(p.x, p.y);
const onCircle = (c, r, angle) => ({ x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) });

/* ------------------------------------------- the applet, written from javap */

/* GeoSDoub.Dist(DoubPoint, DoubPoint) = sqrt(SqDist). */
function bytecodeDist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/* LaHireCanvas.init() at a canvas size w by h. */
function bytecodeInit(w, h) {
  const k = 5;
  const f = 0.6666666666666666;
  const O = { x: Math.trunc(w / k), y: h * f };
  const step = (h / 2) / 4; // (height/2)/4, stored in local 9
  const R = { x: O.x - step, y: O.y };
  const A = { x: O.x + 4 * step, y: O.y };
  const B = { x: O.x, y: O.y - 2 * step };
  return { O, R, A, B, circle: { center: O, radius: bytecodeDist(O, R) } };
}

/* Inversion.Invert(DoubCircle, DoubPoint). */
function bytecodeInvert(circ, p) {
  const d = bytecodeDist(circ.center, p);
  const factor = ((circ.radius * circ.radius) / d) / d;
  return {
    x: circ.center.x + factor * (p.x - circ.center.x),
    y: circ.center.y + factor * (p.y - circ.center.y),
  };
}

/* LaHireCanvas.GetPolar(DoubPoint). */
function bytecodeGetPolar(circ, p) {
  if (p === null || bytecodeDist(p, circ.center) < 0.5) return null;
  const inv = bytecodeInvert(circ, p);
  const second = {
    x: inv.x + (p.y - circ.center.y),
    y: inv.y - (p.x - circ.center.x),
  };
  return { a: inv, b: second, inverse: inv };
}

/* GeoSDoub.Dist(DoubPoint, DoubLine). */
function bytecodeDistLine(p, line) {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  if ((line.b.x - line.a.x) ** 2 + (line.b.y - line.a.y) ** 2 < 0.1) return 0;
  const numerator = dx * (p.x - line.a.x) + dy * (p.y - line.a.y);
  const t = numerator / (dx * dx + dy * dy);
  const rx = (line.a.x - p.x) + dx * t;
  const ry = (line.a.y - p.y) + dy * t;
  return Math.sqrt(rx * rx + ry * ry);
}

/* GeoSDoub.Intersect(a, b, c, d): four points, two lines. */
function bytecodeIntersect(a, b, c, d) {
  const p = a.y - b.y;
  const q = b.x - a.x;
  const r = a.x * b.y - a.y * b.x;
  const s = c.y - d.y;
  const t = d.x - c.x;
  const u = c.x * d.y - c.y * d.x;
  const bottom = p * t - s * q;
  if (Math.abs(bottom) < 1) return { x: NaN, y: NaN };
  return { x: (q * u - t * r) / bottom, y: (r * s - u * p) / bottom };
}

/* LaHireCanvas.ConnectToCenter: ray OP crossed with the polar of P. */
function bytecodeConnect(circ, p, line) {
  return bytecodeIntersect(circ.center, p, line.a, line.b);
}

/* LaHireCanvas.CheckTouch: PolarA must exist and Dist(A, PolarB) < 1.5. */
function bytecodeTouch(circ, A, B, polarA, polarB) {
  if (!polarA) return false;
  try {
    return bytecodeDistLine(A, polarB) < 1.5;
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------- 1. the opening picture */

{
  const s = C.start();
  const b = bytecodeInit(C.VIEW.width, C.VIEW.height);
  check("start is the applet's 600 by 450 init",
    pointNear(s.O, b.O, 0) && pointNear(s.R, b.R, 0) &&
    pointNear(s.A, b.A, 0) && pointNear(s.B, b.B, 0));
  check("the circle has radius h/8, A is 4 radii out and B is 2 radii out",
    near(C.circleOf(s).radius, 450 / 8, 1e-9) &&
    near(C.dist(s.O, s.A), 450 / 2, 1e-9) &&
    near(C.dist(s.O, s.B), 450 / 4, 1e-9));
  const small = C.start({ width: 400, height: 300 });
  const smallBytecode = bytecodeInit(400, 300);
  check("start honours the applet's width and height formula at 400 by 300",
    pointNear(small.O, smallBytecode.O, 0) &&
    pointNear(small.R, smallBytecode.R, 0) &&
    pointNear(small.A, smallBytecode.A, 0) &&
    pointNear(small.B, smallBytecode.B, 0));
  check("the opening picture does not touch and shows no inverse points",
    C.geometry(s).touching === false && C.geometry(s).C === null && C.geometry(s).D === null);
  check("Show names is on by default, as the page's param sets it to 1", s.showNames === true);
  check("a droodle has no result", C.result(s) === null && C.result(small) === null);
}

/* ------------------------------------------------------------ 2. drags and options */

{
  const s = C.start();
  const moved = C.moveVertex(s, "A", { x: 10, y: 20 });
  check("moving A leaves the other three points and their old states alone",
    pointNear(moved.A, { x: 10, y: 20 }, 0) &&
    pointNear(moved.O, s.O, 0) && pointNear(moved.R, s.R, 0) &&
    pointNear(moved.B, s.B, 0) && pointNear(s.A, { x: 345, y: 300 }, 0));
  check("an unknown handle or a non-finite point is refused",
    C.moveVertex(s, "Q", { x: 1, y: 2 }) === s &&
    C.moveVertex(s, "A", { x: NaN, y: 2 }) === s &&
    C.moveVertex(s, "A", null) === s);
  const shifted = C.moveCircle(s, { x: 300, y: 123 });
  check("dragging the circle translates O and R together",
    pointNear(shifted.O, { x: 300, y: 123 }, 0) &&
    pointNear(shifted.R, { x: s.R.x + 180, y: s.R.y - 177 }, 0) &&
    pointNear(shifted.A, s.A, 0) && pointNear(shifted.B, s.B, 0));
  check("the Show names checkbox changes only the flag",
    C.setShowNames(s, false).showNames === false &&
    C.setShowNames(s, false).A === s.A &&
    C.setShowNames(s, true).showNames === true);
  check("a circle drag with a bad point is refused", C.moveCircle(s, null) === s);

  /* Five Shift+ArrowUp steps and three ArrowUp steps on A: 300 -> 272. */
  const nudged = C.moveVertex(s, "A", { x: s.A.x, y: s.A.y - 28 });
  const g = C.geometry(nudged);
  check("28 keyboard units upward put A inside the applet's touch distance",
    g.touching === true && g.distA < 1.5 && near(g.distA, 0.125, 1e-9));
  check("the touch reveals both inverse points",
    !!g.C && !!g.D && /Touch!/.test(C.status(nudged, g)));
  check("the reciprocal distance is small in this exact-layout nudged case",
    g.distB !== null && g.distB < 1.5);
}

/* ------------------------------------------------- 3. formulae against the bytecode */

{
  const circ = { center: { x: 120, y: 300 }, radius: 56.25 };
  const p = { x: 345, y: 300 };
  const inv = C.invert(circ, p);
  check("Inversion.Invert puts the image on the ray at R squared over OP",
    pointNear(inv, bytecodeInvert(circ, p), 0) &&
    near(C.dist(circ.center, inv) * C.dist(circ.center, p), circ.radius ** 2, 1e-8));
  check("a point within 0.5 of O has no polar in either transcription",
    C.polar(circ, { x: 120.3, y: 300.2 }) === null &&
    bytecodeGetPolar(circ, { x: 120.3, y: 300.2 }) === null &&
    C.polar(circ, circ.center) === null);
  const veryNear = C.polar(circ, { x: 120.6, y: 300 });
  check("just outside the cut-off the inverse is far away but finite",
    !!veryNear && near(C.dist(circ.center, veryNear.inverse), circ.radius ** 2 / 0.6, 1e-7));

  const tiny = { a: { x: 10, y: 10 }, b: { x: 10.1, y: 10 } };
  check("GeoSDoub.Dist returns zero for a line shorter than its cut-off",
    C.distToLine({ x: 500, y: 500 }, tiny) === 0 &&
    bytecodeDistLine({ x: 500, y: 500 }, tiny) === 0);
  const horiz = { a: { x: 0, y: 5 }, b: { x: 10, y: 5 } };
  check("distance to a horizontal line matches the bytecode formula",
    near(C.distToLine({ x: 3, y: 9 }, horiz), 4, 1e-9) &&
    near(C.distToLine({ x: 3, y: 9 }, horiz), bytecodeDistLine({ x: 3, y: 9 }, horiz), 0));
  check("parallel lines are treated as having no crossing",
    C.intersectLines({ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 0, y: 8 }, { x: 10, y: 8 }) === null &&
    Number.isNaN(bytecodeIntersect({ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 0, y: 8 }, { x: 10, y: 8 }).x));
}

/* ---------------------------- 4. thousands of pictures against the applet's methods */

{
  const random = rng(451);
  let polarMismatch = 0;
  let distMismatch = 0;
  let touchMismatch = 0;
  let connectMismatch = 0;
  let cases = 0;
  for (const [w, h] of [[600, 450], [400, 300], [720, 540]]) {
    for (let i = 0; i < 700; i++) {
      const O = { x: w * (0.25 + random() * 0.5), y: h * (0.25 + random() * 0.5) };
      const r = 10 + random() * (h / 5);
      const R = onCircle(O, r, random() * Math.PI * 2);
      const A = i % 17 === 0
        ? { x: O.x + random() * 0.4, y: O.y + random() * 0.4 } // inside GetPolar's cut-off
        : onCircle(O, 0.6 + random() * (w / 2), random() * Math.PI * 2);
      const B = i % 23 === 0
        ? { x: O.x + random() * 0.4, y: O.y + random() * 0.4 }
        : onCircle(O, 0.6 + random() * (h / 2), random() * Math.PI * 2);
      const s = { O, R, A, B, showNames: i % 2 === 0 };
      const g = C.geometry(s);
      const circ = { center: O, radius: bytecodeDist(O, R) };
      const bpA = bytecodeGetPolar(circ, A);
      const bpB = bytecodeGetPolar(circ, B);
      cases++;
      if ((g.polarA === null) !== (bpA === null) ||
          (g.polarB === null) !== (bpB === null) ||
          (bpA && (!pointNear(g.polarA.a, bpA.a, 1e-7) || !pointNear(g.polarA.b, bpA.b, 1e-7))) ||
          (bpB && (!pointNear(g.polarB.a, bpB.a, 1e-7) || !pointNear(g.polarB.b, bpB.b, 1e-7)))) {
        polarMismatch++;
      }
      if (bpB && !near(g.distA, bytecodeDistLine(A, bpB), 1e-7)) distMismatch++;
      if (g.touching !== bytecodeTouch(circ, A, B, bpA, bpB)) touchMismatch++;
      if (g.touching) {
        const bcC = bytecodeConnect(circ, B, bpB);
        const bcD = bytecodeConnect(circ, A, bpA);
        if (!pointNear(g.C, bcC, 1e-6) || !pointNear(g.D, bcD, 1e-6)) connectMismatch++;
      }
    }
  }
  check(`GetPolar matches the bytecode on all ${cases} pictures`, polarMismatch === 0,
    `${polarMismatch} mismatches`);
  check("GeoSDoub.Dist-to-polar matches the bytecode on all pictures", distMismatch === 0,
    `${distMismatch} mismatches`);
  check("CheckTouch's 1.5 cut-off matches the bytecode on all pictures", touchMismatch === 0,
    `${touchMismatch} mismatches`);
  check("the marked C and D are the bytecode's ConnectToCenter crossings", connectMismatch === 0,
    `${connectMismatch} mismatches`);
}

/* ------------------------------------------------- 5. the page's theorem, by grid */

{
  const O = { x: 0, y: 0 };
  const r = 50;
  let asymmetric = 0;
  let productFail = 0;
  let collinearFail = 0;
  let cases = 0;
  for (const rB of [60, 80, 125, 200, 320]) {
    for (let k = 0; k < 16; k++) {
      const B = onCircle(O, rB, (k * Math.PI) / 8);
      const circ = { center: O, radius: r };
      const polarB = C.polar(circ, B);
      for (const t of [-180, -60, -12, 0, 12, 60, 180]) {
        /* Every A on polarB is of the form inverse(B) + t * perpendicular(OB). */
        const A = {
          x: polarB.a.x + (t * B.y) / rB,
          y: polarB.a.y - (t * B.x) / rB,
        };
        const polarA = C.polar(circ, A);
        const resid = dot(A, B) - r * r;
        const distA = C.distToLine(A, polarB);
        const distB = C.distToLine(B, polarA);
        const D = C.connectToCenter(circ, A, polarA);
        const Cc = C.connectToCenter(circ, B, polarB);
        cases++;
        /* The page's exact claim: symmetry of the pole/polar relation. */
        if (!near(resid, 0, 1e-6) || !near(distB * len(A), distA * len(B), 1e-5)) asymmetric++;
        /* The page's equation (1): OA*OD = OB*OC = R^2. */
        if (!near(len(A) * len(D), r * r, 1e-6) || !near(len(B) * len(Cc), r * r, 1e-6)) productFail++;
        /* The collinear case t = 0: A is C, D is B, so (1) still holds. */
        if (t === 0) {
          if (!pointNear(A, Cc, 1e-6) || !pointNear(B, D, 1e-6)) collinearFail++;
        }
      }
    }
  }
  check(`the theorem holds on all ${cases} grid positions with A on B's polar`,
    asymmetric === 0, `${asymmetric} failures`);
  check("(1) OA*OD = OB*OC = R squared always holds on the grid", productFail === 0,
    `${productFail} failures`);
  check("the page's collinear exception keeps A = C, D = B and (1)", collinearFail === 0,
    `${collinearFail} failures`);

  /* The applet's touch test is a distance in board units, so it is not
     symmetric when OA and OB differ; the exact theorem above still is. */
  const B2 = { x: 0, y: -200 };
  const invB2 = C.invert({ center: O, radius: r }, B2);
  const circ = { center: O, radius: r };
  const nearA = { x: invB2.x + 10, y: invB2.y + 1.4 };
  const g = C.geometry({ O, R: { x: r, y: 0 }, A: nearA, B: B2, showNames: true });
  check("the applet can report a touch with A slightly off B's polar",
    g.touching === true && near(g.distA, 1.4, 1e-9));
  check("with the same 1.5 units B can still be far from A's polar",
    g.distB !== null && g.distB > 1.5 && g.distB > 10,
    `distB = ${g.distB}`);
  const exactA = { x: invB2.x + 10, y: invB2.y };
  const exact = C.geometry({ O, R: { x: r, y: 0 }, A: exactA, B: B2, showNames: true });
  check("placing A exactly on the polar makes both distances zero",
    exact.touching && near(exact.distA, 0, 1e-9) && near(exact.distB, 0, 1e-8));
  check("the picture's status describes both directions once they touch",
    /polar of B, and B is on the polar of A/.test(C.status(
      { O, R: { x: r, y: 0 }, A: exactA, B: B2, showNames: true }, exact)));
  const farA = { x: 400, y: 400 };
  const far = C.geometry({ O, R: { x: r, y: 0 }, A: farA, B: B2, showNames: true });
  check("a far-away A reports its distance and does not touch",
    far.touching === false && !/Touch!/.test(C.status(
      { O, R: { x: r, y: 0 }, A: farA, B: B2, showNames: true }, far)));
}

done("lahire");
