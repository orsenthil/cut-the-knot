#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-square-circle/circle-square-circle-core.js.
 *
 *   node porting/check-circle-square-circle.mjs
 *
 * Two different sources are checked here.
 *
 * 1. The applet's own computation, transcribed a second time straight from
 *    CircleSquareCircleCanvas.init and Compute: R = min(width,height)/3 by
 *    integer division, A and M from init, B[i] = Corner(cx,cy,R,
 *    angle*pi/180 + i*pi/2 + pi/4), and C2's radius R/sqrt(2). Every size and
 *    every scroll-bar angle 0..50 is compared with the core. The tangency of
 *    both squares' sides to the inner circle, the equal area ratio and the
 *    two special angles are then tested over the same whole range.
 *
 * 2. The sangaku on the cut-the-knot page filed under this applet's name:
 *    with a big square of side S, the small square has side 3S/5 and the
 *    circle on top has radius 39S/320. Both are re-derived from the page's
 *    quadratic and linear equations and checked for many S, along with the
 *    two Pythagorean tangencies they are supposed to satisfy.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circle-square-circle/circle-square-circle-core.js", "CircleSquareCircleCore");
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const pt = (p) => ({ x: p.x, y: p.y });
const samePt = (a, b, tol = 1e-7) => near(a.x, b.x, tol) && near(a.y, b.y, tol);

/* ---- a second, literal transcription of the applet's init() and Compute() -- */
function bytecode(width, height, angle) {
  // init(): double cx = width/2, cy = height/2, r = Math.min(w,h)/3 (int division).
  const cx = width / 2, cy = height / 2;
  const r = Math.floor(Math.min(width, height) / 3);
  const A = [
    { x: cx - r, y: cy - r }, { x: cx - r, y: cy + r },
    { x: cx + r, y: cy + r }, { x: cx + r, y: cy - r },
  ];
  const M = [
    { x: cx - r, y: cy }, { x: cx, y: cy + r },
    { x: cx + r, y: cy }, { x: cx, y: cy - r },
  ];
  // Compute(): Corner(cx, cy, R, theta + i*pi/2 + pi/4).
  const theta = Math.PI * angle / 180;
  const B = [];
  for (let i = 0; i < 4; i++) {
    const t = theta + i * Math.PI / 2 + Math.PI / 4;
    B.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  // The local h that Compute() fills in and then never uses.
  const h = (A[1].y - A[0].y) / 2 / Math.sqrt(2);
  return { cx, cy, r, A, M, B, h, C: { x: cx, y: cy, r: r }, C2: { x: cx, y: cy, r: r / Math.sqrt(2) } };
}

const WIDTHS = [300, 331, 360, 401, 500];
const HEIGHTS = [200, 241, 260, 320];

/* ---- a second derivation of the sangaku's two equations from the page ---- */
function pageAnswer(side) {
  // 1 = (1/2 + x/2)^2 + x^2  ->  5x^2 + 2*S*x - 3*S^2 = 0.
  const disc = (2 * side) ** 2 + 4 * 5 * 3 * side * side;
  const x = (-2 * side + Math.sqrt(disc)) / (2 * 5);
  // (S-r)^2 = (S/2)^2 + (x+r)^2  ->  2(S+x) r = 3S^2/4 - x^2.
  const r = (3 * side * side / 4 - x * x) / (2 * (side + x));
  return { x, r };
}

/* ------------------------------------------- 1. the applet's own constants */
{
  equal("the scroll bar's range and start", [C.ANGLE_MIN, C.ANGLE_MAX, C.ANGLE_DEFAULT], [0, 50, 5]);
  const s = C.appletStart({});
  check("the applet starts on a 360 by 260 board at angle 5",
    s.width === 360 && s.height === 260 && s.angle === 5);
  check("the radius uses Java's integer division",
    C.appletStart({ width: 360, height: 260 }).R === 86 &&
    C.appletStart({ width: 361, height: 260 }).R === 86 &&
    C.appletStart({ width: 400, height: 400 }).R === 133);
  check("an out-of-range angle is clamped to 0..50",
    C.appletStart({ angle: -12 }).angle === 0 && C.appletStart({ angle: 900 }).angle === 50);
}

/* ---------------- 2. init() and Compute(), over every size and every angle */
{
  let a = true, m = true, b = true, circles = true, h = true, cases = 0;
  for (const width of WIDTHS) {
    for (const height of HEIGHTS) {
      for (let angle = C.ANGLE_MIN; angle <= C.ANGLE_MAX; angle++) {
        cases++;
        const core = C.appletStart({ width, height, angle });
        const bytes = bytecode(width, height, angle);
        a = a && core.cx === bytes.cx && core.cy === bytes.cy && core.R === bytes.r &&
          C.appletA(core).every((p, i) => samePt(p, bytes.A[i], 1e-12));
        m = m && C.appletM(core).every((p, i) => samePt(p, bytes.M[i], 1e-12));
        b = b && C.appletB(core).every((p, i) => samePt(p, bytes.B[i], 1e-12));
        const cs = C.appletCircles(core);
        circles = circles && near(cs.outer.radius, bytes.C.r, 1e-12) &&
          near(cs.inner.radius, bytes.C2.r, 1e-12) &&
          samePt(cs.outer.center, bytes.C, 1e-12);
        h = h && near(C.apothem(core), bytes.h, 1e-12);
      }
    }
  }
  check(`A, M and the centre match the bytecode in all ${cases} configurations`, a);
  check(`B matches the bytecode's Corner formula in all ${cases} configurations`, b);
  check("C and C2 match the bytecode's radii in all configurations", circles);
  check("the unused local h is R/sqrt(2), as in Compute", h);
}

/* ----------------------------- 3. what the turning squares always satisfy */
{
  let onCircle = true, side = true, area = true, tangent = true, aSide = true, aCorner = true;
  for (const width of WIDTHS) {
    for (const height of HEIGHTS) {
      for (let angle = C.ANGLE_MIN; angle <= C.ANGLE_MAX; angle++) {
        const s = C.appletStart({ width, height, angle });
        const cs = C.appletCircles(s);
        const B = C.appletB(s), A = C.appletA(s);
        for (let k = 0; k < 2; k++) {
          side = side && near(C.distance(B[k], B[k + 1]), s.R * Math.SQRT2, 1e-9);
          aSide = aSide && near(C.distance(A[k], A[k + 2]), 2 * s.R * Math.SQRT2, 1e-9);
        }
        side = side && near(C.distance(B[3], B[0]), s.R * Math.SQRT2, 1e-9);
        area = area && near(2 * s.R * s.R, (s.R * Math.SQRT2) ** 2, 1e-7);
        for (let i = 0; i < 4; i++) {
          onCircle = onCircle && near(C.distance(cs.outer.center, B[i]), s.R, 1e-9);
          // A's corners lie sqrt(2)R from the centre: A circumscribes C.
          aCorner = aCorner && near(C.distance(cs.outer.center, A[i]), s.R * Math.SQRT2, 1e-9);
          tangent = tangent && near(
            C.distanceToLine(cs.inner.center, B[i], B[(i + 1) % 4]), cs.inner.radius, 1e-9);
          aSide = aSide && near(
            C.distanceToLine(cs.outer.center, A[i], A[(i + 1) % 4]), cs.outer.radius, 1e-9);
        }
      }
    }
  }
  check("all four corners of B stay on C; A's corners are sqrt(2)R away", onCircle && aCorner);
  check("both squares keep side R*sqrt(2) and area 2R^2", side && area);
  check("every side of the turning square touches the inner circle", tangent);
  check("every side of the fixed square touches the outer circle", aSide);
  check("the inner circle's area is exactly half the outer circle's",
    WIDTHS.every((w) => {
      const s = C.appletStart({ width: w, height: 300 });
      const cs = C.appletCircles(s);
      return near(Math.PI * cs.inner.radius ** 2, Math.PI * cs.outer.radius ** 2 / 2, 1e-7);
    }));
}

{
  const zero = C.appletStart({ angle: 0 });
  const A = C.appletA(zero), B = C.appletB(zero);
  // At zero degrees B's sides are parallel to A's; its corners sit on A's
  // diagonals, at radius R rather than A's sqrt(2)R.
  const parallel = near(B[1].y - B[0].y, 0, 1e-9) && near(B[2].x - B[1].x, 0, 1e-9) &&
    near(B[3].y - B[2].y, 0, 1e-9) && near(B[0].x - B[3].x, 0, 1e-9);
  let onDiagonals = true;
  for (const p of B) onDiagonals = onDiagonals &&
    near(Math.abs(p.x - zero.cx), Math.abs(p.y - zero.cy), 1e-9);
  let at45 = true;
  const fortyFive = C.appletStart({ angle: 45 });
  const M = C.appletM(fortyFive);
  const B45 = C.appletB(fortyFive);
  for (let i = 0; i < 4; i++) at45 = at45 && B45.some((p) => samePt(p, M[i], 1e-9));
  check("at angle 0 B is parallel to A with its corners on the diagonals", parallel && onDiagonals);
  check("the applet's angle-45 quirk puts B's corners on A's side midpoints", at45);
  let roundTrip = true;
  for (let angle = C.ANGLE_MIN; angle <= C.ANGLE_MAX; angle++) {
    const s = C.appletStart({ angle });
    for (const p of C.appletB(s)) roundTrip = roundTrip && C.angleFromPoint(s, p) === angle;
  }
  check("dragging any corner of B gives back the same scroll-bar angle", roundTrip);
}

/* --------------------------- 4. the sangaku on the linked cut-the-knot page */
{
  let xCheck = true, rCheck = true, corner = true, tangent = true, derived = true;
  const sideRandom = rng(20261126);
  const sides = [1, 17, 64, 100, 137, 260, 1000].concat(
    Array.from({ length: 200 }, () => 1 + sideRandom() * 500));
  for (const side of sides) {
    const fit = C.fit(side);
    const page = pageAnswer(side);
    const s = C.cupolaStart({ side });
    const p = C.cupolaPoints(s);
    const err = C.cupolaErrors(s);
    xCheck = xCheck && near(fit.x, 3 * side / 5, 1e-9) && near(s.x, fit.x, 1e-9);
    rCheck = rCheck && near(fit.r, 39 * side / 320, 1e-9) && near(s.r, fit.r, 1e-9);
    derived = derived && near(fit.x, page.x, 1e-8 * side) && near(fit.r, page.r, 1e-8 * side);
    corner = corner && near(C.distance(p.A, p.G), side, 1e-8 * side) && near(err.corner, 0, 1e-8 * side);
    tangent = tangent && near(C.distance(p.A, p.O), side - s.r, 1e-8 * side) &&
      near(err.tangent, 0, 1e-8 * side);
  }
  check("the small square is 3/5 of the big square for every size", xCheck);
  check("the circle's radius is 39/320 of the big square for every size", rCheck);
  check("both sizes agree with a fresh solve of the page's equations", derived);
  check("the small square's corner lies on the left quarter circle", corner);
  check("the circle is tangent to the left quarter circle", tangent);
}

{
  const random = rng(77213);
  let radius = true, unique = true, positive = true;
  for (let t = 0; t < 2000; t++) {
    const side = 20 + random() * 500;
    const x = random() * side * 0.8; // beyond sqrt(3)/2 * side the circle cannot fit
    const r = C.radiusFor(side, x);
    const s = C.cupolaStart({ side, x, r });
    const err = C.cupolaErrors(s);
    radius = radius && near(err.tangent, 0, 1e-7 * side);
    positive = positive && r > 0;
    // Move r a little either way: the tangency error changes sign.
    const less = C.cupolaErrors(C.cupolaStart({ side, x, r: r * 0.97 })).tangent;
    const more = C.cupolaErrors(C.cupolaStart({ side, x, r: r * 1.03 })).tangent;
    unique = unique && less < 0 && more > 0;
  }
  check("radiusFor makes the circle tangent for 2000 random configurations", radius);
  check("that tangent radius is always positive", positive);
  check("the tangency radius is the unique root of the page's equation", unique);
  check("a non-positive side or a too-wide square has no radius",
    C.radiusFor(0, 0) === 0 && C.radiusFor(100, 100) === 0);
}

/* ------------------------------------- 5. dragging and the saved position */
{
  const s = C.cupolaStart({ side: 200, left: 30, baseY: 210 });
  const moved = C.moveCorner(s, { x: s.left + (s.side + 100) / 2, y: 100 });
  check("dragging G sets the small square's side", near(moved.x, 100, 1e-9) && s.x === 120);
  const higher = C.moveCircle(s, { x: s.left + s.side / 2, y: s.baseY - s.x - 25 });
  check("dragging O sets the circle's radius", near(higher.r, 25, 1e-9));
  const bigger = C.resize(s, 300);
  const before = C.fit(s.side), after = C.fit(bigger.side);
  check("resizing the big square keeps the picture similar",
    bigger.side === 300 && near(bigger.x / 300, before.x / 200, 1e-9) &&
    near(bigger.r / 300, before.r / 200, 1e-9) && near(after.r, 39 * 300 / 320, 1e-9));
  const shifted = C.translate(s, { x: 12, y: 180 });
  check("translating moves the whole cupola", shifted.left === 12 && shifted.baseY === 180 &&
    shifted.x === s.x && shifted.r === s.r);
  const snapped = C.makeFit({ ...s, x: 40, r: 10 });
  check("the exact-fit button restores both page answers",
    near(snapped.x, 3 * s.side / 5, 1e-12) && near(snapped.r, 39 * s.side / 320, 1e-12));
  check("makeFit and the other moves never change their input",
    JSON.stringify(s) === JSON.stringify(C.cupolaStart({ side: 200, left: 30, baseY: 210 })));
  const applet = C.appletStart({});
  const movedCentre = C.moveCentre(applet, { x: 100, y: 90 });
  check("moving the applet's centre keeps its radii and angle",
    movedCentre.cx === 100 && movedCentre.cy === 90 && movedCentre.R === applet.R &&
    movedCentre.angle === applet.angle);
  const biggerApplet = C.resizeApplet(applet, { x: applet.cx + 100, y: applet.cy + 100 }, 2);
  check("dragging A2 grows both circles together", biggerApplet.R > applet.R);
}

{
  const saved = C.position(C.cupolaStart({}), C.appletStart({}));
  check("the saved position is plain data for the tutor",
    JSON.parse(JSON.stringify(saved)).applet.angle === 5 &&
    typeof saved.cupola.error.corner === "number" && saved.cupola.side === 200);
  check("the cupola's tangency errors vanish at the exact fit",
    near(saved.cupola.error.corner, 0, 1e-9) && near(saved.cupola.error.tangent, 0, 1e-9));
}

done("circle-square-circle");
