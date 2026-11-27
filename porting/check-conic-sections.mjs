#!/usr/bin/env node
"use strict";

/*
 * Logic test for conic-sections/conic-sections-core.js.
 *
 *   node porting/check-conic-sections.mjs
 *
 * The Java applet did not classify anything: it drew Cone(6, 12, 37) twice,
 * rotated the two copies by +/- pi/2 about z and translated them by +/- 6
 * along x (both apexes land at the origin), and put a CTKPlane(20) at the
 * origin for the mouse to rotate and translate. So this test transcribes that
 * geometry a second time from the bytecode and derives the family in two
 * independent ways: the sign of the quadratic coefficient in the cutting
 * plane, and which generators of the double cone the plane actually meets.
 * Both are compared with the core over the whole slider range (0..80 degrees
 * and -12..12 in unit steps), the exact parabola angle and random positions.
 * The page's four claims (ellipse / parabola / hyperbola / circle) and its
 * three vertex cases are then checked over the same parameter space; every
 * sampled point of the drawn curve is checked against the cone and plane.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("conic-sections/conic-sections-core.js", "ConicSectionsCore");
const rad = (d) => (d * Math.PI) / 180;
const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;

/* ---------------------------------------------------- 1. the picture's rules */

{
  const s = C.start({});
  equal("the new picture uses the applet's default tilt", s.beta, C.DEFAULT_BETA);
  equal("the new picture uses the applet's default offset", s.offset, C.DEFAULT_OFFSET);
  check("the plane starts transparent, as in the applet", s.transparent === true);
  check("the two objects start separate, as in the applet", s.linked === false);
  check("the default tilt is acute", s.beta >= C.MIN_BETA && s.beta < 90);
  check("the default section is an ellipse", C.analyse(s).family === "ellipse");
  check("the slider refuses a tilt below zero", C.setBeta(s, -40).beta === C.MIN_BETA);
  check("the slider refuses a tilt above the acute range", C.setBeta(s, 120).beta === C.MAX_BETA);
  check("the offset stops at the finite cone's far end", C.setOffset(s, 99).offset === C.MAX_OFFSET);
  check("the offset stops at the other far end", C.setOffset(s, -99).offset === C.MIN_OFFSET);
  check("a non-number leaves the tilt alone", C.setBeta(s, NaN) === s);
  check("a non-number leaves the offset alone", C.setOffset(s, undefined) === s);
  check("transparency flips both ways", C.toggleTransparent(C.toggleTransparent(s)).transparent === s.transparent);
  check("combining the objects flips both ways", C.toggleLinked(C.toggleLinked(s)).linked === s.linked);
  equal("the circle preset", [C.preset(s, "circle").beta, C.preset(s, "circle").offset], [0, C.DEFAULT_OFFSET]);
  equal("the parabola preset uses alpha exactly", C.preset(s, "parabola").beta, C.ALPHA);
  equal("the vertex preset puts the plane through the apex", C.preset(s, "vertex").offset, 0);
  check("an unknown preset changes nothing", C.preset(s, "nonsense") === s);
}

/* ---------------------- 2. the cone and plane rebuilt from the bytecode */

/*
 * javap -c: fstore 9 = 6.0f; new Cone(fload 9, fconst_2 * fload 9, 37, app)
 * gives radius 6 and height 12. rotZ(+pi/2) with translation (+6,0,0) and
 * rotZ(-pi/2) with translation (-6,0,0) put both local apexes (0,+6,0) and
 * (0,+6,0) at the world origin. The page's alpha is generator vs base, i.e.
 * atan(height/radius), not the half-angle from the axis.
 */
function appletCone() {
  const radius = 6.0;
  const height = 2 * 6.0; // fconst_2 * fload 9
  const apexLocalY = height / 2;
  // rotZ(+pi/2) sends (0,y) to (-y,0); adding +6 cancels it. rotZ(-pi/2)
  // sends (0,y) to (y,0); adding -6 cancels it too.
  const apexA = radius - apexLocalY;
  const apexB = apexLocalY - radius;
  return {
    radius: radius,
    height: height,
    flags: 37,
    apexA: apexA,
    apexB: apexB,
    slope: radius / height,
    alpha: (Math.atan2(height, radius) * 180) / Math.PI,
  };
}

const bytecodeCone = appletCone();

{
  check("the bytecode makes two cones of radius 6 and height 12",
    bytecodeCone.radius === C.CONE_RADIUS && bytecodeCone.height === C.CONE_HEIGHT);
  check("the cone primitive flags are 37", bytecodeCone.flags === C.CONE_FLAGS);
  check("both nappes share the vertex at the origin",
    near(bytecodeCone.apexA, 0, 1e-12) && near(bytecodeCone.apexB, 0, 1e-12));
  check("the core's cot(alpha) is the bytecode radius/height", near(C.SLOPE, bytecodeCone.slope, 1e-15));
  check("the core's alpha is the generator/base angle from the bytecode",
    near(C.ALPHA, bytecodeCone.alpha, 1e-12));
  check("alpha is acute, as the page says", C.ALPHA > 0 && C.ALPHA < 90);
  check("alpha is about 63.4 degrees", near(C.ALPHA, 63.43494882292201, 1e-10));
  check("the plane in the bytecode is a square of side 20", C.PLANE_SIZE === 20);
}

/* A second, literal derivation of the quadratic in the cutting plane.
   Plane coordinates from the vertex intercept: x = d + u sin(beta),
   y = u cos(beta), z = v. Substitute in y^2 + z^2 = m^2 x^2. */
function appletQuadratic(beta, d) {
  const b = rad(beta);
  const sb = Math.sin(b), cb = Math.cos(b);
  const m = 6 / 12;
  return {
    A: cb * cb - m * m * sb * sb,
    B: -2 * m * m * d * sb,
    C: -m * m * d * d,
    disc: m * m * d * d * cb * cb,
  };
}

/* Which generators does the plane x - y tan(beta) = d really meet?
   Generator (n, q): (x, y) = (n*12*t, q*6*t), t >= 0. Solve t from
   n*12*t - q*6*t*tan(beta) = d and look at the sign of t. */
function appletFamilyFromGenerators(beta, d) {
  if (d === 0) return "vertex";
  const s = Math.tan(rad(beta));
  const hits = [];
  for (const n of [1, -1]) {
    for (const q of [1, -1]) {
      const denominator = n * 12 - s * q * 6;
      if (Math.abs(denominator) < 1e-12) continue; // parallel to this generator
      const t = d / denominator;
      if (t > 0) hits.push(n);
    }
  }
  const nappes = new Set(hits);
  if (nappes.size === 2) return "hyperbola";
  if (hits.length === 2) return "ellipse";
  if (hits.length === 1) return "parabola";
  return "none";
}

{
  const rand = rng(20261126);
  const betas = [];
  for (let b = 0; b <= 80; b++) betas.push(b);
  betas.push(C.ALPHA, C.ALPHA - 1e-6, C.ALPHA + 1e-6);
  for (let i = 0; i < 80; i++) betas.push(rand() * 80);
  const offsets = [];
  for (let d = -12; d <= 12; d++) offsets.push(d);
  for (let i = 0; i < 40; i++) offsets.push((rand() * 2 - 1) * 12);
  let wrongQuadratic = 0, wrongGenerators = 0, wrongDisc = 0, badSegment = 0, count = 0;
  for (const beta of betas) {
    for (const d of offsets) {
      const state = C.start({ beta: beta, offset: d });
      const a = C.analyse(state);
      const q = appletQuadratic(beta, d);
      const hitFamily = appletFamilyFromGenerators(beta, d);
      count++;
      if (C.relation(beta) !== -Math.sign(q.A) && Math.abs(q.A) > 1e-12) wrongQuadratic++;
      if (d !== 0 && a.family !== hitFamily) wrongGenerators++;
      if (!near(a.disc, q.disc, 1e-7 * Math.max(1, Math.abs(q.disc)))) wrongDisc++;
      const seg = C.planeSegment(state, { xMin: -14, xMax: 14, yMin: -8, yMax: 8 });
      if (!seg) badSegment++;
      else {
        for (const pt of seg) {
          if (!near(pt.x - Math.tan(rad(beta)) * pt.y, d, 1e-9)) badSegment++;
        }
      }
    }
  }
  check(`${count} tilts and offsets agree with the bytecode quadratic`, wrongQuadratic === 0, `${wrongQuadratic} wrong`);
  check(`${count} tilts and offsets agree with generator intersections`, wrongGenerators === 0, `${wrongGenerators} wrong`);
  check("the discriminant p^2 m^2 matches the second transcription", wrongDisc === 0, `${wrongDisc} wrong`);
  check("every drawn plane segment stays on the plane", badSegment === 0, `${badSegment} wrong`);
}

/* --------------------------------------------------- 3. the page's claims */

{
  const rand = rng(73521);
  const betas = [];
  for (let i = 0; i <= 800; i++) betas.push((80 * i) / 800);
  betas.push(C.ALPHA, C.ALPHA - 1e-9, C.ALPHA + 1e-9);
  for (let i = 0; i < 120; i++) betas.push(rand() * 80);
  let below = 0, equal = 0, above = 0, vertexBad = 0, circleBad = 0, ovalNotCircle = 0;
  for (const beta of betas) {
    if (beta >= 80) continue;
    for (const d of [-12, -7, -1, 1, 7, 12]) {
      const a = C.analyse(C.start({ beta: beta, offset: d }));
      if (beta < C.ALPHA && a.family !== "ellipse") below++;
      if (beta > C.ALPHA && a.family !== "hyperbola") above++;
      if (beta === C.ALPHA && a.family !== "parabola") equal++;
      // Ultra-near the parabola the coefficients cancel to zero in floating
      // point; test the closed ovals away from that boundary.
      if (beta < C.ALPHA - 1e-6 && beta > 0 && near(a.scaleU, a.scaleV, 1e-9)) ovalNotCircle++;
      if (beta === 0 && (!near(a.scaleU, a.scaleV, 1e-12) ||
          !near(a.scaleU, Math.abs(d) * C.SLOPE, 1e-12))) circleBad++;
    }
    for (const d of [0, -0]) {
      const a = C.analyse(C.start({ beta: beta, offset: d }));
      const want = beta < C.ALPHA ? "point" : beta === C.ALPHA ? "line" : "lines";
      if (a.detail !== want || !a.degenerate || a.disc !== 0) vertexBad++;
    }
  }
  check("for every beta below alpha the section is an ellipse", below === 0, `${below} wrong`);
  check("for beta equal to alpha the section is a parabola", equal === 0, `${equal} wrong`);
  check("for every beta above alpha the section is a hyperbola", above === 0, `${above} wrong`);
  check("for every tilt through the vertex: point, line or pair of lines", vertexBad === 0, `${vertexBad} wrong`);
  check("beta = 0 gives a circle with radius |d| * radius/height", circleBad === 0, `${circleBad} wrong`);
  check("a tilted ellipse is not a circle", ovalNotCircle === 0, `${ovalNotCircle} wrong`);
  check("the circle preset is an ellipse whose detail says circle",
    C.analyse(C.preset(C.start({}), "circle")).detail === "circle");
  check("the vertex preset is degenerate", C.analyse(C.preset(C.start({}), "vertex")).degenerate);
}

/* --------------------------------------- 4. every drawn point is on both surfaces */

{
  const rand = rng(918273);
  let coneBad = 0, planeBad = 0, sampled = 0, wrongBranches = 0;
  for (let i = 0; i < 260; i++) {
    const beta = i % 7 === 0 ? C.ALPHA : rand() * 80;
    const d = i % 11 === 0 ? 0 : (rand() * 2 - 1) * 12;
    const state = C.start({ beta: beta, offset: d });
    const a = C.analyse(state);
    const lines = C.sectionPoints(a, 24);
    if (a.family === "hyperbola" && !a.degenerate && lines.length !== 2) wrongBranches++;
    if (a.family !== "hyperbola" && !a.degenerate && lines.length !== 1) wrongBranches++;
    for (const line of lines) {
      for (const uv of line) {
        const p = C.toSpace(state, uv);
        const cone = p.y * p.y + p.z * p.z - C.SLOPE * C.SLOPE * p.x * p.x;
        const plane = p.x - Math.tan(rad(state.beta)) * p.y - state.offset;
        const scale = Math.max(1, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
        if (Math.abs(cone) > 1e-7 * scale * scale) coneBad++;
        if (Math.abs(plane) > 1e-7 * scale) planeBad++;
        sampled++;
      }
    }
  }
  check(`${sampled} curve points satisfy the cone equation`, coneBad === 0, `${coneBad} wrong`);
  check(`${sampled} curve points satisfy the plane equation`, planeBad === 0, `${planeBad} wrong`);
  check("a hyperbola has two branches and the other families one", wrongBranches === 0, `${wrongBranches} wrong`);
}

/* ------------------------------- 5. the status words follow the comparison */

{
  let bad = 0;
  for (const beta of [0, 12, C.ALPHA - 0.001, C.ALPHA, C.ALPHA + 0.001, 79]) {
    for (const d of [-9, -1, 1, 9]) {
      const s = C.start({ beta: beta, offset: d });
      const a = C.analyse(s);
      const label = C.describe(s);
      if (label.title !== (a.detail === "circle" ? "Circle" :
        a.family === "ellipse" ? "Ellipse" : a.family === "parabola" ? "Parabola" : "Hyperbola")) bad++;
      if (!/\d/.test(label.text) || label.text.length < 20) bad++;
    }
  }
  const atVertex = C.describe(C.start({ beta: C.ALPHA, offset: 0 }));
  check("24 status lines name the right family", bad === 0, `${bad} wrong`);
  check("the parabola through the vertex is reported as a line", atVertex.title === "Line");
  check("the status is a sentence, not a win or a loss",
    C.describe(C.start({})).text.endsWith("."));
}

done("conic-sections");
