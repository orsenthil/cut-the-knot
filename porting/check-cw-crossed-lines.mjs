#!/usr/bin/env node
"use strict";

/*
 * Logic test for cw-crossed-lines/cw-crossed-lines-core.js.
 *
 *   node porting/check-cw-crossed-lines.mjs
 *
 * 1. A second transcription of the applet's Compute(), Rotate(),
 *    ComputeSignedAngle(), FindOrientation() and UpgradePoints(), compared with
 *    the core over a grid of triangles and point positions.
 * 2. The page's claims, checked over that whole grid: after six rotations the
 *    curve closes; the six radii can all differ; the curve has constant width
 *    when it is convex, and does not when the point is between two vertices
 *    (the page's own warning).
 * 3. The controls: P stays on BC, the coefficient follows the applet's
 *    projection, option ranges, animation, and the demo's "done" state.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("cw-crossed-lines/cw-crossed-lines-core.js", "CwCrossedLinesCore");

/* ------------------------------- the applet's own method, transcribed again */

const clampCos = (v) => Math.max(-1, Math.min(1, v));
const sq = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
const len = (a, b) => Math.sqrt(sq(a, b));

// GeoSDoub.FindOrientation: the cross product, +1 when positive, -1 otherwise.
function javaOrientation(a, b, c) {
  // The same cross product written as the three-term determinant.
  const z = a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y);
  return z > 0 ? 1 : -1;
}

// GeoSDoub.ComputeSignedAngle: law of cosines, signed by FindOrientation.
function javaSignedAngle(a, b, c) {
  const ab = len(a, b), ac = len(a, c);
  if (!ab || !ac) return 0;
  const cos = (sq(a, b) + sq(a, c) - sq(b, c)) / (2 * ab * ac);
  return javaOrientation(a, b, c) * Math.acos(clampCos(cos));
}

// GeoSDoub.Rotate(c, p, angle, 1).
function javaRotate(c, p, angle) {
  const co = Math.cos(angle), si = Math.sin(angle);
  const x = p.x - c.x, y = p.y - c.y;
  return { x: c.x + co * x - si * y, y: c.y + si * x + co * y };
}

// CWCrossedLinesRotation.Rotate(o, second, third, point).
function javaSwing(o, second, third, point) {
  return javaRotate(o, point, javaSignedAngle(o, second, third));
}

// CWCrossedLinesRotation.Compute() plus the starting P = coef*B + (1-coef)*C.
function javaCompute(A, B, Cc, coef) {
  const P = { x: coef * B.x + (1 - coef) * Cc.x, y: coef * B.y + (1 - coef) * Cc.y };
  const Q = javaSwing(B, Cc, A, P);
  const R = javaSwing(A, B, Cc, Q);
  const Pp = javaSwing(Cc, A, B, R);
  const Qp = javaSwing(B, Cc, A, Pp);
  const Rp = javaSwing(A, B, Cc, Qp);
  const P6 = javaSwing(Cc, A, B, Rp);
  return { P, Q, R, Pp, Qp, Rp, P6 };
}

// CWCrossedLinesCanvas.UpgradePoints() for a dragged P.
function javaCoef(p, B, Cc) {
  return ((p.x - Cc.x) * (B.x - Cc.x) + (p.y - Cc.y) * (B.y - Cc.y)) / sq(B, Cc);
}

/* ----------------------------------------------------------------- the grid */

const xs = [40, 110, 200, 290, 370];
const ys = [25, 90, 160, 230];
const vertices = [];
for (const ax of xs) for (const ay of ys)
  for (const bx of xs) for (const by of ys)
    for (const cx of xs) for (const cy of ys) {
      if (sq({ x: ax, y: ay }, { x: bx, y: by }) < 900) continue;
      if (sq({ x: bx, y: by }, { x: cx, y: cy }) < 900) continue;
      if (sq({ x: cx, y: cy }, { x: ax, y: ay }) < 900) continue;
      vertices.push([{ x: ax, y: ay }, { x: bx, y: by }, { x: cx, y: cy }]);
    }
const coefs = [-1.4, -0.8, -0.2, 0, 0.35, 0.5, 0.85, 1.3, 2.1];
const configs = [];
for (const [A, B, Cc] of vertices) {
  if (Math.abs((B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x)) < 3000) continue;
  for (const coef of coefs) {
    const s = C.start({ A, B, C: Cc, coefP: coef });
    if (Math.min(...C.compute(s).radii) < 1e-6) continue;
    configs.push({ A, B, C: Cc, coef });
  }
}

/* ------------------------------------------------- 1. the rules and start */

{
  const s = C.start();
  equal("the applet's starting coefficient", s.coefP, -0.2);
  equal("the applet's starting speed", s.speed, 10);
  check("lines and dots start on", s.showLines && s.showDots);
  check("the animation starts stopped", !s.running);
  equal("an illustration has no win or loss", C.result(s), null);
  const v = C.controls(s);
  check("P starts beyond C on the line BC",
    Math.abs((v.P.x - v.C.x) * (v.B.y - v.C.y) - (v.P.y - v.C.y) * (v.B.x - v.C.x)) < 1e-9 &&
      v.P.x > v.C.x);
}

/* ----------------------- 2. the core against the applet's own computation */

{
  let worst = 0, worstAt = null;
  for (const { A, B, C: Cc, coef } of configs) {
    const got = C.compute(C.start({ A, B, C: Cc, coefP: coef }));
    const ref = javaCompute(A, B, Cc, coef);
    for (const name of ["P", "Q", "R", "Pp", "Qp", "Rp", "P6"]) {
      const e = Math.max(Math.abs(got[name].x - ref[name].x), Math.abs(got[name].y - ref[name].y));
      if (e > worst) { worst = e; worstAt = { A, B, Cc, coef, name }; }
    }
  }
  check(`${configs.length} configurations match the bytecode's Compute() exactly`,
    worst < 1e-8, `worst ${worst} at ${JSON.stringify(worstAt)}`);
}

/* --------------------------------------- 3. the page's claims, exhaustively */

{
  let worst = 0;
  for (const { A, B, C: Cc, coef } of configs) {
    worst = Math.max(worst, C.compute(C.start({ A, B, C: Cc, coefP: coef })).closureError);
  }
  check(`after six rotations the curve closes in all ${configs.length} configurations`,
    worst < 1e-8, `worst gap ${worst}`);

  // "For three lines ... the number of different radii may be six."
  let sixes = 0, over = 0;
  for (const { A, B, C: Cc, coef } of configs) {
    const radii = C.compute(C.start({ A, B, C: Cc, coefP: coef })).radii;
    const distinct = new Set(radii.map((r) => r.toFixed(6))).size;
    if (distinct === 6) sixes++;
    if (distinct > 6) over++;
  }
  check("the six arc radii can all be different (the page's 'may be six')", sixes > 0);
  check("there are never more than six radii with three lines", over === 0);
  check("the starting picture has six different radii",
    new Set(C.compute(C.start()).radii.map((r) => r.toFixed(6))).size === 6);

  // The width claim: the constructed curve has constant width exactly when it
  // is convex. The page does not give a simple test for convexity (it warns
  // that moving the controls can break it), so check the relation itself over
  // the whole grid rather than assuming a coefficient interval.
  let convexCount = 0, nonconvexCount = 0, wrongConvex = 0, wrongNonconvex = 0;
  let worstConvexSpread = 0;
  for (const { A, B, C: Cc, coef } of configs) {
    const s = C.start({ A, B, C: Cc, coefP: coef });
    const spread = C.widthRange(s, 180).spread;
    if (C.isConvex(s, 120)) {
      convexCount++;
      worstConvexSpread = Math.max(worstConvexSpread, spread);
      if (spread > 1e-7) wrongConvex++;
    } else {
      nonconvexCount++;
      if (spread < 1e-4) wrongNonconvex++;
    }
  }
  check(`convex always means constant width (${convexCount} configurations)`,
    wrongConvex === 0, `worst spread ${worstConvexSpread}`);
  check(`non-convex always means the width varies (${nonconvexCount} configurations)`,
    wrongNonconvex === 0, `${wrongNonconvex} exceptions`);
  check("both convex and non-convex constructions occur in the grid",
    convexCount > 0 && nonconvexCount > 0);

  const start = C.start();
  check("the starting curve is convex and has constant width",
    C.isConvex(start, 120) && C.widthRange(start, 720).spread < 1e-8);
  const inside = [0.25, 0.5, 0.8].map((coef) => C.start({ coefP: coef }));
  check("a point between B and C gives a non-convex curve here", inside.every((s) => !C.isConvex(s, 120)));
  check("and its width is not constant, as the page warns",
    inside.every((s) => C.widthRange(s, 360).spread > 1));
  check("the starting curve's width is 147.09 in board units",
    Math.abs(C.widthRange(start, 720).min - 147.0899537598651) < 1e-6);
}

/* ----------------------------------------- 4. the controls and their ranges */

{
  // Dragging P: UpgradePoints() sets the coefficient by projection on BC.
  let worst = 0;
  for (const [A, B, Cc] of vertices.slice(0, 200)) {
    for (const q of [{ x: 50, y: 50 }, { x: 350, y: 200 }, { x: 200, y: 125 }]) {
      const s = C.start({ A, B, C: Cc });
      const got = C.move(s, { type: "point", name: "P", point: q });
      if (!sq(B, Cc)) continue;
      worst = Math.max(worst, Math.abs(got.coefP - C.clampCoef(javaCoef(C.clampBoard(q), B, Cc))));
      const p = C.controls(got).P;
      check("P remains on the line BC",
        Math.abs((p.x - Cc.x) * (B.y - Cc.y) - (p.y - Cc.y) * (B.x - Cc.x)) < 1e-7);
    }
  }
  check("the dragged coefficient is the applet's projection", worst < 1e-8, `worst ${worst}`);

  const s = C.start({ coefP: -0.2 });
  const movedB = C.move(s, { type: "point", name: "B", point: { x: 180, y: 220 } });
  equal("dragging B keeps the coefficient", movedB.coefP, -0.2);
  check("and moves P with it",
    Math.abs(C.controls(movedB).P.x - (movedB.coefP * movedB.B.x + (1 - movedB.coefP) * movedB.C.x)) < 1e-9);
  equal("the given state is not changed", s.B, C.START_B);

  equal("the speed cannot go above the applet's 20", C.move(s, { type: "speed", value: 99 }).speed, 20);
  equal("the speed cannot go below 0", C.move(s, { type: "speed", value: -9 }).speed, 0);
  equal("the slider's low end", C.move(s, { type: "coef", value: -99 }).coefP, C.COEF_MIN);
  equal("the slider's high end", C.move(s, { type: "coef", value: 99 }).coefP, C.COEF_MAX);
  check("unknown options are refused",
    C.move(s, { type: "point", name: "X", point: { x: 1, y: 2 } }) === null &&
      C.move(s, { type: "speed", value: "fast" }) === null &&
      C.move(s, { type: "coef", value: NaN }) === null && C.move(s, null) === null);

  const toggled = C.move(C.move(s, { type: "showLines", value: false }), { type: "showDots", value: false });
  check("lines and dots toggle independently", !toggled.showLines && !toggled.showDots && toggled.showDots === false);
}

/* ------------------------------------------------ 5. the illustrated swings */

{
  let s = C.start({ coefP: -0.2, speed: 20 });
  const p0 = C.controls(s).P;
  s = C.move(s, { type: "play", value: true });
  check("Play starts the tracer at P", C.dist(p0, s.tracer) < 1e-9);
  const first = C.move(s, { type: "tick" });
  const arc0 = C.compute(s).arcs[0];
  const expected = C.rotate(arc0.centre, p0, Math.sign(arc0.angle) * 20 * C.RAD / 5, 1);
  check("one tick is the applet's AngleIncrement*pi/180/5", C.dist(first.tracer, expected) < 1e-9);
  let back = 0;
  for (let i = 0; i < 4000; i++) {
    s = C.move(s, { type: "tick" });
    if (i > 100 && s.arc === 0 && s.done === 0 && C.dist(s.tracer, p0) < 1e-6) back++;
  }
  check("the tracer returns to P after six swings", back > 0);
  check("the control P never leaves its line during the animation",
    Math.abs((C.controls(s).P.x - s.C.x) * (s.B.y - s.C.y) -
      (C.controls(s).P.y - s.C.y) * (s.B.x - s.C.x)) < 1e-9);
  check("a stopped animation does not advance", C.move(C.move(s, { type: "play", value: false }), { type: "tick" }) === null);
  equal("reset restores the starting coefficient", C.move(s, { type: "reset" }).coefP, C.START_COEF);
}

/* -------------------------------------------- 6. the demo's finishing state */

{
  let s = C.start();
  equal("a fresh illustration is not finished", C.result(s), null);
  s = C.move(s, { type: "play", value: true });
  equal("watching the animation alone is not exploration", C.result(s), null);
  s = C.move(s, { type: "coef", value: 0.5 });
  equal("playing and changing a control finishes the exploration", C.result(s), "done");
  check("the record can see that done state, with no win or loss",
    !["win", "lose"].includes(C.result(s)) && C.result(s) === "done");
}

done("cw-crossed-lines");
