#!/usr/bin/env node
"use strict";

/*
 * Logic test for inversion-in-circle-and-isosceles-core.js.
 *
 *   node porting/check-inversion-in-circle-and-isosceles.mjs
 *
 * The applet's exact claim (and the cut-the-knot page's): circle W, inscribed
 * in the gap between S (diameter AC), G (diameter AB) and the side BE of the
 * isosceles triangle BCE, has its centre Q on the perpendicular to AC at B.
 * The page's Step 5 additionally says that after inversion at B the image W'
 * is tangent to S', i.e. LV = R + r, and Steps 1-4 claim two isosceles
 * triangles C'BE', A'UE' and BVU.
 *
 * Everything is checked at 1001 draggable positions of B plus 400 random
 * ones. A second transcription of the applet's Compute() (bytecode order,
 * including sqrt(2(1-t)) * t/(1+t) * AC) and of Inversion.Invert's
 * three-point circumcircle is compared with the core across that whole range.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "inversion-in-circle-and-isosceles/inversion-in-circle-and-isosceles-core.js",
  "InversionInCircleAndIsoscelesCore");
const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const angle = (v, p, q) => {
  const a = { x: p.x - v.x, y: p.y - v.y }, b = { x: q.x - v.x, y: q.y - v.y };
  return Math.acos(Math.max(-1, Math.min(1,
    C.dot(a, b) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)))));
};

/* --------------------------------- a second transcription of the bytecode -- */

/** InversionInCircleAndIsoscelesCanvas.init / Compute, taken from javap -c. */
function appletCompute(width, height, bx) {
  const cx = width / 2, cy = height / 2;
  const R = Math.min(width, height) / 2.5;
  const A = { x: cx - R, y: cy };
  const B = { x: bx, y: cy };
  const Cc = { x: cx + R, y: cy };
  const midR = Math.abs(B.x - A.x) / 2;
  const mid = { center: { x: A.x + midR, y: A.y }, radius: midR };
  const D = { x: (B.x + Cc.x) / 2, y: B.y };
  // The vertical line x = D.x meets S twice; the drawing uses the upper one.
  const E = { x: D.x, y: cy - Math.sqrt(Math.max(0, R * R - (D.x - cx) ** 2)) };
  const p = midR / R;
  // 297: dload p; 303: ddiv p/(1+p); 312: sqrt(2*(1-p)); 315: dmul; 331: * AC.
  const drop = Math.sqrt(2 * (1 - p)) * (p / (1 + p)) * (Cc.x - A.x);
  const q = p * (1 - p) / (1 + p) * (Cc.x - A.x);
  const small = { center: { x: B.x, y: B.y - drop }, radius: q };
  const inv = { center: { x: B.x, y: B.y }, radius: R / 1.5 };
  return { A: A, B: B, C: Cc, O: { x: cx, y: cy }, D: D, E: E,
    mid: mid, small: small, inv: inv, R: R, drop: drop, q: q, p: p };
}

/** Inversion.Invert(DoubCircle,DoubCircle): invert three points, take their
 *  circumcentre (a separate transcription from the core's analytic formula). */
function appletInvertedCircle(inv, circle) {
  const pts = [
    { x: circle.center.x - circle.radius, y: circle.center.y },
    { x: circle.center.x + circle.radius, y: circle.center.y },
    { x: circle.center.x, y: circle.center.y + circle.radius },
  ].map((p) => {
    const dx = p.x - inv.center.x, dy = p.y - inv.center.y;
    const k = inv.radius * inv.radius / (dx * dx + dy * dy);
    return { x: inv.center.x + k * dx, y: inv.center.y + k * dy };
  });
  const [a, b, c] = pts;
  const d0 = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) +
    (b.x * b.x + b.y * b.y) * (c.y - a.y) +
    (c.x * c.x + c.y * c.y) * (a.y - b.y)) / d0;
  const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) +
    (b.x * b.x + b.y * b.y) * (a.x - c.x) +
    (c.x * c.x + c.y * c.y) * (b.x - a.x)) / d0;
  const center = { x: ux, y: uy };
  return { center: center, radius: d(center, a) };
}

/** Canvas.CommonPoint(c1,c2), literally: the point on c1 towards c2. */
function appletCommonPoint(c1, c2) {
  const dd = d(c1.center, c2.center);
  const s = dd >= c1.radius ? -1 : 1;
  const k = (dd + s * c2.radius) / dd;
  return {
    x: c1.center.x + (c2.center.x - c1.center.x) * k,
    y: c1.center.y + (c2.center.y - c1.center.y) * k,
  };
}

/* -------------------------------------------------------- 1. the constants */

{
  check("board is the applet's 400 by 250", C.WIDTH === 400 && C.HEIGHT === 250);
  check("R = min(w,h)/2.5 = 100, centre (200,125)",
    C.R === 100 && C.CX === 200 && C.CY === 125);
  const s = C.start({});
  check("init() puts B at cx + R/5, i.e. t = 0.6",
    C.START_T === 0.6 && s.t === 0.6 && C.geometry(s).B.x === 220);
  const g = C.geometry(s);
  check("A, B, C and S start where init() puts them",
    g.A.x === 100 && g.B.x === 220 && g.C.x === 300 &&
    g.O.x === 200 && g.big.radius === 100);
  check("the inversion circle starts at B with radius R/1.5",
    g.inversion.center.x === 220 && near(g.inversion.radius, 100 / 1.5));
}

/* ------------------------------------- 2. plain data, clamps, saved position */

{
  const s = C.start({});
  equal("a position is just {t:0.6}", s, { t: 0.6 });
  const moved = C.setT(s, 0.2);
  check("setT returns new data and leaves the old state alone",
    s.t === 0.6 && moved.t === 0.2 && moved !== s);
  check("clampT refuses the endpoints, NaN and out-of-range values",
    C.clampT(0) === C.MIN_T && C.clampT(1) === C.MAX_T &&
    C.clampT(NaN) === C.START_T && C.clampT(9) === C.MAX_T);
  check("fractionAtX is the inverse of B.x = A.x + 2R*t",
    near(C.fractionAtX(100 + 2 * 100 * 0.37), 0.37));
  const p = C.position(s);
  check("the saved position is JSON-safe and reports the claim",
    JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))) &&
    p.t === 0.6 && p.B.x === 220 && p.Q.x === 220 && p.offset === 0);
}

/* --------------- 3. the core against a second transcription of Compute() --- */

{
  let places = 0, all = true;
  for (let i = 0; i <= 1000; i++) {
    const t = C.MIN_T + (C.MAX_T - C.MIN_T) * i / 1000;
    const bx = 100 + 200 * t;
    const g = C.geometry(C.setT({}, t));
    const a = appletCompute(400, 250, bx);
    places++;
    all = all && near(g.A.x, a.A.x) && near(g.B.x, a.B.x) && near(g.C.x, a.C.x) &&
      near(g.O.x, a.O.x) && near(g.R, a.R) &&
      near(g.mid.center.x, a.mid.center.x) && near(g.mid.radius, a.mid.radius) &&
      near(g.D.x, a.D.x) && near(g.E.x, a.E.x) && near(g.E.y, a.E.y) &&
      near(g.drop, a.drop) && near(g.radius, a.q) &&
      near(g.inversion.radius, a.inv.radius);
  }
  check(`Compute() matches at ${places} draggable positions`, all);

  const rand = rng(5842);
  let scaled = true;
  for (let i = 0; i < 400; i++) {
    const w = 320 + rand() * 500, h = 200 + rand() * 300;
    const R = Math.min(w, h) / 2.5;
    const t = 0.02 + rand() * 0.96;
    const a = appletCompute(w, h, w / 2 - R + 2 * R * t);
    // The core's board is fixed at 400x250, so compare the same fraction's
    // blueprints: every formula is homogeneous in R.
    const g = C.geometry(C.setT({}, t));
    const s = (v) => v * R / 100;
    scaled = scaled && near(a.mid.radius, s(g.mid.radius)) &&
      near(a.q, s(g.radius)) && near(a.drop, s(g.drop)) &&
      near(a.inv.radius, s(g.inversion.radius)) && near(a.E.y - a.O.y, s(g.E.y - g.O.y));
  }
  check("the same formulas scale with R over 400 random canvas sizes", scaled);
}

/* ------------------------------------------- 4. the page's exact geometry --- */

{
  let tangent = true, claim = true, isosceles = true, onCircle = true, closed = true;
  for (let i = 0; i <= 1000; i++) {
    const g = C.geometry(C.setT({}, C.MIN_T + (C.MAX_T - C.MIN_T) * i / 1000));
    const m = C.measurements(C.setT({}, g.t));
    const q = g.small.center;
    tangent = tangent && m.sGap < 1e-8 && m.gGap < 1e-8 && m.lineGap < 1e-8;
    claim = claim && Math.abs(m.offset) < 1e-10;
    isosceles = isosceles && m.eGap < 1e-8;
    onCircle = onCircle && near(d(g.E, g.O), g.R) &&
      near(Math.abs(g.E.x - (g.B.x + g.C.x) / 2), 0);
    // Independent closed form from tangency: r = (R^2 - d^2)/(3R + d).
    const u = (g.B.x - g.O.x) / g.R;
    closed = closed && near(g.radius, g.R * (1 - u * u) / (3 + u)) &&
      near(g.drop, Math.sqrt(g.radius * (g.radius + g.a)));
  }
  check("W touches S internally, G externally, and BE (1001 positions)", tangent);
  check("the exact claim: QB is perpendicular to AC (1001 positions)", claim);
  check("BCE is isosceles, BE = CE (1001 positions)", isosceles);
  check("E really lies on S over the midpoint of BC", onCircle);
  check("r = R(1-u^2)/(3+u) and drop^2 = r(r+AB)", closed);
}

/* -------------------------- 5. inversion against a circumcircle transcription */

{
  const s = C.start({});
  const g = C.geometry(s), v = C.inversion(s);
  const via3 = appletInvertedCircle(g.inversion, g.big);
  check("S' from the analytic formula equals the applet's three-point image",
    near(v.bigImage.center.x, via3.center.x) && near(v.bigImage.center.y, via3.center.y) &&
    near(v.bigImage.radius, via3.radius));
  const via3w = appletInvertedCircle(g.inversion, g.small);
  check("W' from the analytic formula equals the applet's three-point image",
    near(v.smallImage.center.x, via3w.center.x) &&
    near(v.smallImage.center.y, via3w.center.y) &&
    near(v.smallImage.radius, via3w.radius));

  let invPoints = true;
  for (let i = 0; i <= 1000; i++) {
    const st = C.setT({}, C.MIN_T + (C.MAX_T - C.MIN_T) * i / 1000);
    const gg = C.geometry(st), vv = C.inversion(st);
    for (const [orig, image] of [[gg.A, vv.Ap], [gg.C, vv.Cp], [gg.E, vv.Ep]]) {
      const inv = gg.inversion;
      invPoints = invPoints &&
        near(d(orig, inv.center) * d(image, inv.center), inv.radius * inv.radius, 1e-6) &&
        near((orig.x - inv.center.x) * (image.y - inv.center.y) -
          (orig.y - inv.center.y) * (image.x - inv.center.x), 0, 1e-6);
    }
  }
  check("A, C, E invert to A', C', E' on the same rays (3003 pairs)", invPoints);
}

/* ------------------------------------- 6. Steps 1 to 5, at every position --- */

{
  let step1 = true, step2 = true, step3 = true, step4 = true, step5 = true;
  let diameter = true, tangentPrime = true, common = true;
  for (let i = 0; i <= 1000; i++) {
    const st = C.setT({}, C.MIN_T + (C.MAX_T - C.MIN_T) * i / 1000);
    const g = C.geometry(st), v = C.inversion(st), B = g.B;
    // Step 1: C'BE' has the same angles as EBC and is isosceles.
    step1 = step1 && near(d(B, v.Cp), d(B, v.Ep) * d(g.B, g.E) / d(g.B, g.C), 1e-6) &&
      near(angle(B, v.Cp, v.Ep), angle(B, g.C, g.E), 1e-7) &&
      near(d(B, v.Cp) / d(v.Cp, v.Ep), d(g.B, g.E) / d(g.E, g.C), 1e-6);
    // Step 2: S' has diameter A'C', and G' is its tangent at A'.
    diameter = diameter && near(d(v.Ap, v.Cp), 2 * v.bigImage.radius, 1e-7) &&
      near((v.Ap.x + v.Cp.x) / 2, v.L.x, 1e-7);
    const midLine = v.midImage;
    step2 = step2 && midLine.kind === "line" &&
      near(Math.abs(midLine.a.x - v.Ap.x), 0, 1e-7) &&
      near(Math.abs(midLine.a.y - midLine.b.y) > 0, true) &&
      near(Math.abs(v.L.x - v.Ap.x), v.bigImage.radius, 1e-7);
    // Step 3: U lies on E'B and G'; A'UE' is isosceles (A'U = A'E').
    step3 = step3 && near(v.U.x, v.Ap.x, 1e-7) &&
      near((v.U.y - B.y) * (g.E.x - B.x), (g.E.y - B.y) * (v.U.x - B.x), 1e-6) &&
      near(d(v.Ap, v.U), d(v.Ap, v.Ep), 1e-6);
    // Step 4: V is on the perpendicular through B; BV = BU.
    step4 = step4 && near(v.V.x, B.x, 1e-7) && near(d(B, v.V), d(B, v.U), 1e-6);
    // Step 5: LV^2 = LB^2 + BV^2 = (R' + r')^2; W' touches S' internally.
    const LV = d(v.L, v.V), LB = d(v.L, B), BV = d(B, v.V);
    const sum = v.bigImage.radius + v.smallImage.radius;
    step5 = step5 && near(LV * LV, LB * LB + BV * BV, 1e-6) &&
      near(LV, sum, 1e-6);
    tangentPrime = tangentPrime &&
      near(d(v.L, v.V), v.bigImage.radius + v.smallImage.radius, 1e-6);
    // CommonPoint (used for the angle marks) really lies on its first circle.
    const cp1 = appletCommonPoint(g.mid, g.small);
    const cp2 = appletCommonPoint(g.big, g.small);
    common = common && near(d(cp1, g.mid.center), g.mid.radius, 1e-7) &&
      near(d(cp2, g.big.center), g.big.radius, 1e-7);
  }
  check("Step 1: C'BE' keeps the isosceles shape after inversion", step1);
  check("Step 2: S' is the circle on A'C', G' touches it at A'", step2 && diameter);
  check("Step 3: U = G' meet E'B, and A'U = A'E'", step3);
  check("Step 4: V is above B and BV = BU", step4);
  check("Step 5: LV^2 = LB^2 + BV^2 = (R+r)^2", step5);
  check("the inverted W' is internally tangent to S'", tangentPrime);
  check("CommonPoint's marks lie on the original circles", common);
}

/* -------------------------------- 7. the line CE and its inverted circle --- */

{
  const st = C.start({});
  const g = C.geometry(st), v = C.inversion(st);
  const ce = v.ceImage;
  check("the image of CE is a circle through B, C' and E'",
    ce.kind === "circle" && near(d(ce.center, g.B), ce.radius) &&
    near(d(ce.center, v.Cp), ce.radius) && near(d(ce.center, v.Ep), ce.radius));
  let all = true;
  for (let i = 0; i <= 200; i++) {
    const s2 = C.setT({}, C.MIN_T + (C.MAX_T - C.MIN_T) * i / 200);
    const gg = C.geometry(s2), vv = C.inversion(s2), im = vv.ceImage;
    all = all && im.kind === "circle" && near(d(im.center, gg.B), im.radius, 1e-7) &&
      near(d(im.center, vv.Cp), im.radius, 1e-7) &&
      near(d(im.center, vv.Ep), im.radius, 1e-7);
  }
  check("the image of CE passes through B, C', E' at 201 positions", all);
}

done("inversion-in-circle-and-isosceles");
