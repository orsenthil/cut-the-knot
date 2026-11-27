#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-circle-sangaku/four-circle-sangaku-core.js.
 *
 *   node porting/check-four-circle-sangaku.mjs
 *
 * The cut-the-knot page claims that the incircle radius is the arithmetic mean
 * of the two outer radii, that the vertical lines through their centres touch
 * the incircle, and gives r_R = -(R+d) + sqrt(2R(R+d)) and its left twin. All
 * three are checked here at hundreds of positions on circles of several
 * sizes, not at a few hand-picked samples. There is also a second, literal
 * transcription of the applet's own methods (Reset, Compute, GetMongrelCircle,
 * GetIncircle via GeoSDoub.FindIncenter) compared with the core everywhere.
 * The live page embeds the Java applet, so no Wayback copy is needed.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("four-circle-sangaku/four-circle-sangaku-core.js", "FourCircleSangakuCore");
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const EPS = 1e-7;

/* ---------------------------------------------------------------------------
 * A second transcription, following the bytecode's own order of operations.
 * GeoSDoub.FindIncenter uses the law-of-cosines angle at A and B, rotates each
 * side ray by half that angle in the triangle's orientation, and intersects
 * the two rays. GetIncircle then averages the three distances to the sides.
 */

const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const dst = (p, q) => Math.sqrt(sq(p, q));

function nearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (sq(a, p) < 0.1) return { x: p.x, y: p.y };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
function angleAt(v, p, q) {
  const cosine = (sq(v, p) + sq(v, q) - sq(p, q)) / (2 * dst(v, p) * dst(v, q));
  return Math.acos(Math.max(-1, Math.min(1, cosine)));
}
function orientation(a, b, c) {
  const cross = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return cross > 0 ? 1 : -1;
}
function rotate(from, to, theta, orient) {
  const co = Math.cos(theta), si = Math.sin(theta);
  const dx = to.x - from.x, dy = to.y - from.y;
  return {
    x: from.x + co * dx - orient * si * dy,
    y: from.y + orient * si * dx + co * dy,
  };
}
function lineCross(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = b1 * a2 - b2 * a1;
  if (Math.abs(det) < 1e-12) return { x: NaN, y: NaN };
  return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
}
function findIncenter(a, b, c) {
  const halfA = angleAt(a, b, c) / 2;
  const halfB = angleAt(b, c, a) / 2;
  const rayA = rotate(a, b, halfA, orientation(a, b, c));
  const rayB = rotate(b, c, halfB, orientation(b, c, a));
  return lineCross(a, rayA, b, rayB);
}
/** The applet's Reset followed by one Compute at a chosen angle. */
function applet(width, height, theta) {
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
  const R = Math.min(Math.floor(width / 3), Math.floor(height / 3));
  const A = { x: cx - R, y: cy }, B = { x: cx + R, y: cy };
  const Cc = { x: cx + R * Math.cos(theta), y: cy + R * Math.sin(theta) };
  if (dst(A, Cc) <= 1) return null;
  const K = { x: Cc.x, y: cy };
  const D = { x: 2 * K.x - Cc.x, y: 2 * K.y - Cc.y };
  const I = findIncenter(A, B, Cc);
  const r = (
    dst(I, nearest(I, A, B)) + dst(I, nearest(I, B, Cc)) + dst(I, nearest(I, Cc, A))
  ) / 3;
  function mongrel(side) {
    const dx = K.x - cx;
    const rr = -(R + side * dx) + Math.sqrt(2 * R * (R + side * dx));
    const sign = Cc.y < K.y ? 1 : -1;
    return { center: { x: K.x + side * rr, y: K.y + sign * rr }, radius: rr };
  }
  const right = mongrel(1), left = mongrel(-1);
  return {
    A, B, C: Cc, K, D, O: { x: cx, y: cy },
    upper: { center: I, radius: r }, right, left,
    uPoint: { x: I.x - r, y: I.y },
    vPoint: { x: I.x + r, y: I.y },
    wPoint: { x: I.x, y: A.y },
    sPoint: { x: left.center.x, y: A.y },
    tPoint: { x: right.center.x, y: A.y },
  };
}

/* ------------------------------- 1. the opening position and the one quirk */

{
  const s = C.start({});
  equal("the applet's canvas centre and radius", [s.center, s.radius], [{ x: 200, y: 130 }, 86]);
  check("C starts at the applet's -3*pi/8 angle",
    near(s.angle, C.START_ANGLE, 1e-12) &&
    near(s.C.x, 200 + 86 * Math.cos(-3 * Math.PI / 8), EPS) &&
    near(s.C.y, 130 + 86 * Math.sin(-3 * Math.PI / 8), EPS));
  check("the draggable point starts on the circle",
    near(C.distance(s.C, s.center), s.radius, EPS));
  const sol = C.compute(s);
  check("the opening diagram has three circles", !!sol && sol.r > 0 && sol.rL > 0 && sol.rR > 0);
  check("both checkboxes start off", !s.showNames && !s.showHint);
  check("C at A is the applet's no-update case", C.compute(C.start({ angle: Math.PI })) === null);
  const changed = C.compute(C.turn(s, 0.2));
  check("turning C changes the picture", !!changed && Math.abs(changed.r - sol.r) > 1e-4);
}

/* --------------------------------- 2. the interface between pointer and core */

{
  const s = C.start({});
  const outside = C.moveC(s, { x: 1000, y: 130 });
  check("a pointer far outside the circle is projected onto it",
    near(C.distance(outside.C, s.center), s.radius, EPS) &&
    outside.C.x > s.center.x && near(outside.C.y, s.center.y, EPS));
  const sideways = C.moveC(s, { x: s.center.x, y: s.center.y });
  check("the zero-distance projection falls back instead of dividing by zero",
    C.distance(sideways.C, s.center) > 0);
  const turned = C.turn(s, Math.PI / 2);
  check("turn keeps C on the circle and records the new angle",
    near(C.distance(turned.C, turned.center), turned.radius, EPS) &&
    near(turned.angle, C.START_ANGLE + Math.PI / 2, EPS));
  const again = C.reset(C.turn(s, 1.3));
  check("reset restores the opening angle but keeps the options",
    near(again.angle, C.START_ANGLE, EPS) && again.width === s.width &&
    again.showNames === s.showNames && again.showHint === s.showHint);
}

/* ----------------------------------------- 3. the page's claims, exhaustively */

{
  let meanOk = true, tangentOk = true, formulaOk = true, stOk = true;
  let inradiusOk = true, touchOk = true, cdOk = true;
  let symmetricOk = true, centreOk = true, count = 0;
  const sizes = [[300, 210], [400, 260], [460, 400], [601, 397], [720, 480]];
  for (const [w, h] of sizes) {
    for (let i = 0; i <= 360; i++) {
      const angle = -Math.PI + (i * 2 * Math.PI) / 360;
      // Near A the applet deliberately stops recomputing; at B the triangle
      // degenerates and its angle-bisector incenter becomes NaN.
      if (Math.abs(angle) < 0.04 || Math.abs(angle - Math.PI) < 0.04 ||
          Math.abs(angle + Math.PI) < 0.04) continue;
      const state = C.start({ width: w, height: h, angle });
      const g = C.compute(state);
      if (!g) continue;
      count++;
      const R = state.radius, tol = 2e-8 * R;

      // (2) The incircle radius is the average of the two outer radii.
      meanOk = meanOk && near(g.r, (g.rL + g.rR) / 2, tol);
      // The page's two formulas, with d the (unsigned) distance O to CD.
      const d = Math.abs(g.d);
      const pageR = -(R + d) + Math.sqrt(2 * R * (R + d));
      const pageL = -(R - d) + Math.sqrt(2 * R * (R - d));
      formulaOk = formulaOk &&
        near(Math.min(g.rL, g.rR), Math.min(pageL, pageR), tol) &&
        near(Math.max(g.rL, g.rR), Math.max(pageL, pageR), tol);
      // (3) r = (a + b - 2R)/2 for the right triangle ABC.
      const a = C.distance(g.A, g.C), b = C.distance(g.B, g.C);
      inradiusOk = inradiusOk && near(g.r, (a + b - 2 * R) / 2, tol);
      // The hint lines through P and Q touch the incircle.
      tangentOk = tangentOk &&
        near(g.left.center.x, g.upper.center.x - g.r, tol) &&
        near(g.right.center.x, g.upper.center.x + g.r, tol);
      // ST = 2r and its midpoint is the incircle's touch point W.
      stOk = stOk &&
        near(g.tPoint.x - g.sPoint.x, 2 * g.r, tol) &&
        near(g.wPoint.x, (g.sPoint.x + g.tPoint.x) / 2, tol) &&
        near(g.wPoint.x, g.upper.center.x, tol);
      // Tangency of the small circles to AB and to the large circle.
      touchOk = touchOk &&
        near(Math.abs(g.left.center.y - g.K.y), g.rL, tol) &&
        near(Math.abs(g.right.center.y - g.K.y), g.rR, tol) &&
        near(C.distance(g.O, g.left.center) + g.rL, R, tol) &&
        near(C.distance(g.O, g.right.center) + g.rR, R, tol) &&
        near(Math.abs(g.upper.center.y - g.K.y), g.r, tol);
      // CD is perpendicular to the diameter AB; D is on the large circle.
      cdOk = cdOk &&
        near(g.K.x, g.C.x, tol) && near(g.K.y, state.center.y, tol) &&
        near(g.D.x, 2 * g.C.x - g.K.x, tol) &&
        near(C.distance(g.D, g.O), R, tol);
      centreOk = centreOk &&
        near(g.uPoint.x, g.upper.center.x - g.r, tol) &&
        near(g.vPoint.x, g.upper.center.x + g.r, tol);
      // When CD passes through the centre, all three radii agree.
      if (near(g.d, 0, 1e-10)) {
        symmetricOk = symmetricOk &&
          near(g.rL, g.rR, tol) && near(g.r, g.rL, tol) &&
          near(g.left.center.x + g.right.center.x, 2 * state.center.x, tol);
      }
    }
  }
  check(`checked every claim at ${count} positions`, count > 1700);
  check("the incircle radius is always the mean of the other two", meanOk);
  check("the page's two explicit radius formulas hold", formulaOk);
  check("the incircle radius is (a + b - hypotenuse)/2", inradiusOk);
  check("the lines through P and Q are tangent to the incircle", tangentOk);
  check("ST = 2r and W is its midpoint", stOk);
  check("all three circles touch the lines they should", touchOk);
  check("CD is perpendicular to AB and D lies on the circle", cdOk);
  check("the hint's U and V are the ends of the incircle's horizontal diameter", centreOk);
  check("at d = 0 the three radii coincide", symmetricOk);
}

/* ------------------------------ 4. the same numbers as the applet's methods */

{
  let allOk = true, cases = 0, worst = 0;
  const sizes = [[300, 210], [400, 260], [460, 400], [601, 397], [720, 480]];
  for (const [w, h] of sizes) {
    for (let i = 0; i <= 360; i++) {
      const theta = -Math.PI + (i * 2 * Math.PI) / 360;
      if (Math.abs(theta) < 0.04 || Math.abs(theta - Math.PI) < 0.04 ||
          Math.abs(theta + Math.PI) < 0.04) continue;
      const ours = C.compute(C.start({ width: w, height: h, angle: theta }));
      const theirs = applet(w, h, theta);
      cases++;
      if (!ours || !theirs) { allOk = false; continue; }
      for (const key of ["A", "B", "C", "K", "D", "uPoint", "vPoint", "wPoint", "sPoint", "tPoint"]) {
        const e = Math.max(Math.abs(ours[key].x - theirs[key].x), Math.abs(ours[key].y - theirs[key].y));
        worst = Math.max(worst, e);
        if (e > 1e-5) allOk = false;
      }
      for (const key of [["r", "upper"], ["rL", "left"], ["rR", "right"]]) {
        const e = Math.abs(ours[key[0]] - theirs[key[1]].radius);
        worst = Math.max(worst, e);
        if (e > 1e-7) allOk = false;
      }
      for (const key of ["upper", "left", "right"]) {
        const e = Math.max(
          Math.abs(ours[key].center.x - theirs[key].center.x),
          Math.abs(ours[key].center.y - theirs[key].center.y),
          Math.abs(ours[key].radius - theirs[key].radius),
        );
        worst = Math.max(worst, e);
        if (e > 1e-5) allOk = false;
      }
    }
  }
  check(`core matches the applet's bytecode at ${cases} configurations`, allOk, `worst difference ${worst}`);
  check("the second transcription agrees to better than a pixel", worst < 1e-5, `${worst}`);
}

/* ------------------------------------------------ 5. data the tutor can read */

{
  const s = C.turn(C.start({}), -0.4);
  const p = C.position(s);
  check("the saved position is plain JSON board data",
    JSON.stringify(p) === JSON.stringify({
      C: { x: s.C.x, y: s.C.y }, angle: s.angle, radius: s.radius,
      showNames: false, showHint: false,
    }));
  check("the saved point is still on the circle", near(C.distance(p.C, s.center), s.radius, EPS));
}

done("four-circle-sangaku");
