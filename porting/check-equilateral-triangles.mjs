#!/usr/bin/env node
"use strict";

/*
 * Logic test for equilateral-triangles/equilateral-triangles-core.js.
 *
 *   node porting/check-equilateral-triangles.mjs
 *
 * The applet's Draw() is transcribed a second, independent way straight from
 * GeoSDoub.Rotate() and DrawMidPoint() and compared with the core over a grid
 * of placements and a thousand random placements on and off the circle. The
 * page's claim (the three midpoints form an equilateral triangle) is checked
 * exhaustively over a grid of angle triples on the circle, over random
 * off-circle triples (the Explanation says the circle is not needed), and with
 * the complex-number criterion from that Explanation. Dragging, the circle
 * restriction, the start position and a JSON round trip are checked too.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equilateral-triangles/equilateral-triangles-core.js", "EquilateralTrianglesCore");
const P = C.pt;
const nearNum = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol;
const near = (p, q, tol = 1e-8) =>
  p && q && nearNum(p.x, q.x, tol) && nearNum(p.y, q.y, tol);

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start();
  check("the canvas is the applet's 400 by 300", s.width === 400 && s.height === 300);
  check("the circle has centre (200,150) and radius 100",
    near(s.center, P(200, 150)) && nearNum(s.radius, 100));
  check("a new picture has three draggable points", s.points.length === 3 &&
    C.legalMoves(s).join(",") === "0,1,2");
  check("the start points lie on the circle", s.points.every((p) =>
    nearNum(C.distance(s.center, p), s.radius)));
  check("points start restricted to the circle as the applet's parameter does", s.restrict === true);
  check("there is nothing to win or lose", C.result(s) === null);

  const angles = [0.1, 2.2, 4.4];
  const fixed = C.start({ angles });
  check("explicit angles reproduce the applet's (sin t, -cos t) placement",
    fixed.points.every((p, i) => near(p,
      P(200 + 100 * Math.sin(angles[i]), 150 - 100 * Math.cos(angles[i])))));
  equal("starting does not change the given angles", angles, [0.1, 2.2, 4.4]);
}

/* -------------------------- 2. the three coloured triangles are equilateral */

{
  let bad = 0, worst = 0;
  for (let t = 0; t < 360; t++) {
    const a = (t * Math.PI) / 180;
    const s = C.start({ angles: [a, a + 0.7, a + 2.9] });
    for (const [o, p, q] of C.triangleSides(C.configuration(s))) {
      const err = Math.max(o, p, q) - Math.min(o, p, q);
      worst = Math.max(worst, err);
      if (err > 1e-9 * s.radius || !nearNum(o, s.radius, 1e-9)) bad++;
    }
  }
  check(`each coloured triangle is equilateral for 360 starting angles`, bad === 0,
    `${bad} failures, worst side difference ${worst.toExponential(2)}`);
}

{
  // GeoSDoub.Rotate(O, P, angle, dir) from its bytecode, written out afresh.
  function rotate2(center, p, angle, dir) {
    const S5 = Math.cos(angle), S7 = Math.sin(angle);
    const S9 = center.x + S5 * (p.x - center.x) - dir * S7 * (p.y - center.y);
    const S11 = center.y + dir * S7 * (p.x - center.x) + S5 * (p.y - center.y);
    return P(S9, S11);
  }
  const rand = rng(2116);
  let bad = 0;
  for (let i = 0; i < 2000; i++) {
    const O = P(rand() * 600 - 300, rand() * 600 - 300);
    const p = P(rand() * 800 - 400, rand() * 800 - 400);
    const a = rand() * 12 - 6;
    const dir = i % 2 ? 1 : -1;
    if (!near(C.rotate(O, p, a, dir), rotate2(O, p, a, dir), 1e-12)) bad++;
  }
  check("rotate() matches a fresh transcription of GeoSDoub.Rotate", bad === 0,
    `${bad} differences in 2000 turns`);
}

/* --------------- 3. a second transcription of the applet's Draw() method */

/*
 * Literal reading of the bytecode: ComputeTriangle(i) rotates m_Points[i]
 * about Circle by 1.0471975511965976 with dir=1; Draw() then calls
 * DrawMidPoint(B[0], A[1]), (B[1], A[2]), (B[2], A[0]).
 */
function appletDraw(state) {
  const angle = 1.0471975511965976, dir = 1;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const rotate = (p) => P(
    state.center.x + cos * (p.x - state.center.x) - dir * sin * (p.y - state.center.y),
    state.center.y + dir * sin * (p.x - state.center.x) + cos * (p.y - state.center.y),
  );
  const B = state.points.map(rotate);
  const mid = (p, q) => P((p.x + q.x) / 2.0, (p.y + q.y) / 2.0);
  return { B, M: [mid(B[0], state.points[1]), mid(B[1], state.points[2]),
    mid(B[2], state.points[0])] };
}

{
  const cases = [];
  // A grid on the circle, including coincident and evenly spaced points.
  const grid = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI,
    5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4];
  for (const a of grid) for (const b of grid) for (const c of grid) {
    cases.push(C.start({ angles: [a, b, c] }));
  }
  // Off-circle placements: the Explanation's remark says these work as well.
  const rand = rng(4482);
  for (let i = 0; i < 1000; i++) {
    cases.push({
      width: 400, height: 300, center: P(200, 150), radius: 100,
      restrict: false,
      points: [0, 1, 2].map(() => P(200 + (rand() - 0.5) * 350,
        150 + (rand() - 0.5) * 250)),
    });
  }
  let badB = 0, badM = 0;
  for (const s of cases) {
    const ours = C.configuration(s);
    const theirs = appletDraw(s);
    ours.B.forEach((p, i) => { if (!near(p, theirs.B[i], 1e-9)) badB++; });
    ours.M.forEach((p, i) => { if (!near(p, theirs.M[i], 1e-9)) badM++; });
  }
  check(`${cases.length} configurations have the applet's exact B points`, badB === 0,
    `${badB} differences`);
  check(`${cases.length} configurations have the applet's exact midpoints`, badM === 0,
    `${badM} differences`);

  const sample = C.start({ angles: [0, 1, 2] });
  const ref = appletDraw(sample);
  check("the midpoints cross B1-A2, B2-A3 and B3-A1",
    near(ref.M[0], P((ref.B[0].x + sample.points[1].x) / 2,
      (ref.B[0].y + sample.points[1].y) / 2)) &&
    near(ref.M[1], P((ref.B[1].x + sample.points[2].x) / 2,
      (ref.B[1].y + sample.points[2].y) / 2)) &&
    near(ref.M[2], P((ref.B[2].x + sample.points[0].x) / 2,
      (ref.B[2].y + sample.points[0].y) / 2)));
}

/* ------------------------------------------- 4. the page's claim: equilateral */

{
  const grid = [];
  for (let i = 0; i < 12; i++) grid.push((i * 2 * Math.PI) / 12);
  let bad = 0, trials = 0, worst = 0;
  for (const a of grid) for (const b of grid) for (const c of grid) {
    const cfg = C.configuration(C.start({ angles: [a, b, c] }));
    const s = C.sides(cfg);
    const err = Math.max(...s) - Math.min(...s);
    // Three points 120 degrees apart make M collapse to a single point: both
    // the error and the sides are then pure rounding noise, so use both a
    // relative and a small absolute tolerance.
    worst = Math.max(worst, err / Math.max(...s, 1));
    if (!C.equilateral(cfg) || err > 1e-9 * Math.max(...s) + 1e-8) bad++;
    trials++;
  }
  check(`M1M2M3 is equilateral for all ${trials} angle triples on the circle`, bad === 0,
    `${bad} failures, worst relative error ${worst.toExponential(2)}`);
}

{
  // The Explanation explicitly says the circle condition was never used.
  const rand = rng(20160121);
  let bad = 0, worst = 0;
  for (let i = 0; i < 3000; i++) {
    const state = {
      width: 400, height: 300, center: P(200, 150), radius: 100, restrict: false,
      points: [0, 1, 2].map(() => P(200 + (rand() - 0.5) * 600,
        150 + (rand() - 0.5) * 600)),
    };
    const cfg = C.configuration(state);
    const s = C.sides(cfg);
    const err = Math.max(...s) - Math.min(...s);
    worst = Math.max(worst, err / Math.max(...s, 1));
    if (!C.equilateral(cfg, 1e-9)) bad++;
  }
  check("the midpoint triangle is equilateral for 3000 random off-circle triples", bad === 0,
    `${bad} failures, worst relative error ${worst.toExponential(2)}`);
}

/* ---------------------- 5. the Explanation's complex-number criterion */

{
  // j = exp(2πi/3), j³ = 1. The page says M1 + jM2 + j²M3 = 0 characterises
  // an equilateral triangle. Work in the applet's screen coordinates; its
  // rotation by +60 degrees also satisfies the identity.
  const j = { re: -0.5, im: Math.sqrt(3) / 2 };
  const mul = (z, w) => ({ re: z.re * w.re - z.im * w.im, im: z.re * w.im + z.im * w.re });
  const complex = (p) => ({ re: p.x - 200, im: p.y - 150 });
  const combo = (M) => {
    const j2 = mul(j, j);
    const terms = [complex(M[0]), mul(j, complex(M[1])), mul(j2, complex(M[2]))];
    return Math.hypot(terms.reduce((a, z) => a + z.re, 0),
      terms.reduce((a, z) => a + z.im, 0));
  };
  const rand = rng(1999);
  let bad = 0, worst = 0;
  for (let i = 0; i < 1200; i++) {
    const s = C.start({
      angles: [rand() * 2 * Math.PI, rand() * 2 * Math.PI, rand() * 2 * Math.PI],
    });
    const r = combo(C.configuration(s).M);
    worst = Math.max(worst, r);
    if (r > 1e-8) bad++;
  }
  check("M1 + jM2 + j²M3 = 0 for 1200 configurations, as the page proves", bad === 0,
    `${bad} failures, largest residue ${worst.toExponential(2)}`);

  const skewed = C.configuration(C.start({ angles: [0, 0.5, 1] }));
  skewed.M[0] = P(skewed.M[0].x + 30, skewed.M[0].y - 10);
  check("moving one midpoint off the construction breaks the criterion",
    combo(skewed.M) > 1 && !C.equilateral(skewed));
}

/* ------------------------------------- 6. dragging and the circle restriction */

{
  const s = C.start({ angles: [0, 1, 2] });
  const original = JSON.parse(JSON.stringify(s));
  let bad = 0;
  for (let i = 0; i < 500; i++) {
    const target = P(200 + (Math.cos(i) * 260), 150 + (Math.sin(i) * 190));
    const moved = C.withPoint(s, i % 3, target);
    const d = C.distance(moved.center, moved.points[i % 3]);
    const scale = d / C.distance(moved.center, target);
    const expected = P(
      moved.center.x + (target.x - moved.center.x) * scale,
      moved.center.y + (target.y - moved.center.y) * scale,
    );
    if (!nearNum(d, s.radius, 1e-9) || !near(moved.points[i % 3], expected, 1e-9)) bad++;
  }
  check("restricted drags land on the circle at the applet's projected point", bad === 0,
    `${bad} failures`);
  check("dragging leaves the input position untouched",
    JSON.stringify(s) === JSON.stringify(original));

  const free = C.withRestrict(s, false);
  const target = P(42, 271);
  check("unrestricted drags keep the pointer's exact position",
    near(C.withPoint(free, 1, target).points[1], target, 0));
  check("an unknown handle is refused without changing the position",
    C.withPoint(s, 7, target) === s && C.move(s, { index: 1, point: { x: NaN, y: 0 } }) === null);
  const moved = C.move(s, { index: 2, point: target });
  check("move() applies the same circle projection", nearNum(C.distance(s.center, moved.points[2]), 100));

  const off = C.withPoint(free, 0, target);
  check("turning the restriction back on projects every point onto the circle",
    C.withRestrict(off, true).points.every((p) => nearNum(C.distance(s.center, p), 100, 1e-9)) &&
    !nearNum(C.distance(off.center, off.points[0]), 100));
}

{
  const s = C.start({ angles: [0, 1, 2] });
  let bad = 0;
  for (let i = 0; i < 360; i++) {
    const t = C.turn(s, 0, (i * Math.PI) / 180);
    if (!nearNum(C.distance(t.center, t.points[0]), s.radius, 1e-9)) bad++;
  }
  check("keyboard turns keep a point on the circle for every whole degree", bad === 0,
    `${bad} failures`);
  const other = C.turn(s, 1, Math.PI / 3);
  check("a turn changes only the chosen point",
    near(other.points[0], s.points[0], 0) && near(other.points[2], s.points[2], 0));
}

/* --------------------------------------- 7. the saved position is plain data */

{
  const s = C.withPoint(C.withRestrict(C.start({ angles: [0.3, 2.7, 4.9] }), false), 1, P(61, 88));
  equal("the player's position survives JSON unchanged", JSON.parse(JSON.stringify(s)), s);
  const cfg = C.configuration(s);
  check("the displayed midpoint triangle can still be measured after a round trip",
    C.equilateral(C.configuration(JSON.parse(JSON.stringify(s)))) &&
    C.sides(cfg).length === 3);
}

done("equilateral-triangles");
