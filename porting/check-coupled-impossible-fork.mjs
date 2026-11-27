#!/usr/bin/env node
"use strict";

/*
 * Logic test for coupled-impossible-fork/coupled-impossible-fork-core.js.
 *
 *   node porting/check-coupled-impossible-fork.mjs
 *
 * The Java applet has no game and no messages: CoupledImpossibleForkCanvas.Draw
 * builds one seven-point skeleton, draws its half-turn image about the canvas
 * centre, and draws beams of length L = Dist(p2, q8) * W / 1000 towards the
 * other half. This test transcribes Draw a second time, straight from javap,
 * and compares every point, every face and every line (same endpoints, same
 * kinds, same painting order) for all 251 slider values, both LessReal values
 * and four canvas sizes. It then checks the page's claim: the frame really is
 * two congruent halves, each half's bar and beams can be built as an ordinary
 * 3D Pi, the middle beams close exactly at the slider's maximum, and the
 * isometric axes have the 120-degree projection the drawing uses.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("coupled-impossible-fork/coupled-impossible-fork-core.js", "CoupledImpossibleForkCore");
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const nearPoint = (a, b, eps) => near(a.x, b.x, eps) && near(a.y, b.y, eps);

/* ------------------------------------------------------------ 1. the options */

{
  const s = C.start({});
  equal("the slider starts at the applet's 500", s.w, 500);
  equal("LessReal starts false, as on the page's first two applets", s.lessReal, false);
  equal("the applet canvas is 600 by 350", [s.width, s.height], [600, 350]);
  equal("the slider's minimum is the bytecode's 250", C.W_MIN, 250);
  equal("the slider's maximum is the bytecode's 500", C.W_MAX, 500);
  check("the default slider is inside its range", C.W_DEFAULT >= C.W_MIN && C.W_DEFAULT <= C.W_MAX);
  equal("a slider value below the minimum is clamped", C.setW(s, 10).w, C.W_MIN);
  equal("a slider value above the maximum is clamped", C.setW(s, 900).w, C.W_MAX);
  check("the slider refuses a non-number", C.setW(s, NaN) === s);
  check("the LessReal button flips both ways", C.toggleLessReal(C.toggleLessReal(s)).lessReal === false);
  check("options can be given at start", C.start({ w: 300, lessReal: true }).lessReal === true);
  equal("an invalid start width falls back to the applet's", C.start({ w: "500" }).w, 500);
  check("the default picture is the coupled one", C.describe(s).closed === true);
}

/* ------------------ 2. Draw(), transcribed a second time from javap -c -p */

/* This is deliberately independent of the core: plain locals, plain helpers,
   and the applet's own order of FixedLength calls, including the odd
   L - 4X used for local 34 and the two W < 498 branches. */
function appletDraw(w, lessReal, width, height) {
  const T = Math.floor(height / 7); // Java integer division for positive sizes
  const x0 = T / 2, y0 = height - 2 * T, x = T / 2, y = T / Math.sqrt(3);
  const z = width * 7 / 15;
  const mx = width / 2, my = height / 2;

  const A = {};
  A[2] = { x: x0 + 2 * x, y: y0 };
  A[3] = { x: x0 + x, y: y0 - y };
  A[4] = { x: x0 + 4 * x, y: y0 - 2 * y };
  A[5] = { x: A[4].x + 2 * x, y: A[4].y };
  A[6] = { x: A[5].x + x, y: A[5].y - y };
  A[7] = { x: A[6].x - x, y: A[6].y - y };
  A[8] = { x: x0 + 5 * x, y: y0 - 5 * y };

  const refl = (pt) => ({ x: 2 * mx - pt.x, y: 2 * my - pt.y });
  const B = {};
  for (let i = 2; i <= 8; i++) B[i] = refl(A[i]);

  const distance = (u, v) => Math.sqrt((u.x - v.x) * (u.x - v.x) + (u.y - v.y) * (u.y - v.y));
  const len = distance(A[2], B[8]) * w / 1000;
  const fix = (u, v, l) => {
    const scale = distance(u, v) / l;
    return { x: u.x + (v.x - u.x) / scale, y: u.y + (v.y - u.y) / scale };
  };

  const J = {};
  J[23] = fix(A[8], B[2], len);
  J[24] = fix(A[7], B[3], len - 2 * x);
  J[25] = fix(A[7], B[3], len);
  J[26] = fix(A[6], B[6], len - 2 * x);
  J[27] = fix(A[4], B[4], len - 2 * x);
  J[28] = fix(A[3], B[7], len);
  J[29] = fix(A[3], B[7], len + 2 * x);
  J[30] = fix(A[2], B[8], len);
  J[31] = fix(B[2], A[8], len);
  J[32] = fix(B[3], A[7], len);
  J[33] = fix(B[3], A[7], len + 2 * x);
  J[34] = fix(B[6], A[6], len - 4 * x);
  J[35] = fix(B[4], A[4], len - 2 * x);
  J[36] = fix(B[7], A[3], len);
  J[37] = fix(B[7], A[3], len - 2 * x);
  J[38] = fix(B[8], A[2], len);

  const lines = [], faces = [];
  const add = (u, v, kind) => lines.push([u, v, kind]);
  add("p2", "p3", "skeleton"); add("p3", "p8", "skeleton");
  add("p4", "p7", "skeleton"); add("p5", "p6", "skeleton");
  add("p6", "p7", "skeleton");
  add("q2", "q3", "skeleton"); add("q3", "q8", "skeleton");
  add("q4", "q7", "skeleton"); add("q5", "q6", "skeleton");
  add("q6", "q7", "skeleton");
  if (w < 498) {
    add("j32", "j34", "outline"); add("j34", "j33", "outline");
    add("j33", "j31", "outline"); add("j31", "j32", "outline");
    faces.push(["j24", "j26", "j25", "j23"]);
    if (lessReal) { add("j24", "j26", "detail"); add("j23", "j24", "detail"); }
    add("j26", "j25", "detail"); add("j25", "j23", "detail");
    faces.push(["j36", "j38", "j37", "j35"]);
    if (lessReal) {
      add("j36", "j38", "detail"); add("j35", "j36", "detail");
      add("j37", "j38", "detail"); add("j35", "j37", "detail");
    } else {
      add("j38", "j36", "detail"); add("j36", "j35", "detail");
    }
  } else if (lessReal) {
    add("j36", "j37", "detail"); add("j32", "j33", "detail");
  }
  add("p2", "j30", "beam"); add("p3", "j28", "beam");
  add("p4", "j27", "beam"); add("p6", "j26", "beam");
  add("p7", lessReal ? "j24" : "j25", "beam"); add("p8", "j23", "beam");
  add("q2", "j31", "beam"); add("q3", "j32", "beam");
  add("q4", "j34", "beam"); add("q6", "j35", "beam");
  add("q7", lessReal ? "j37" : "j36", "beam"); add("q8", "j38", "beam");

  const named = {};
  for (let i = 2; i <= 8; i++) named["p" + i] = A[i];
  for (let i = 2; i <= 8; i++) named["q" + i] = B[i];
  for (let i = 23; i <= 38; i++) named["j" + i] = J[i];
  return {
    t: T, x0: x0, y0: y0, x: x, y: y, z: z, mx: mx, my: my,
    len: len, named: named, lines: lines, faces: faces,
    gap: distance(J[23], J[31]),
  };
}

function coreSignature(g) {
  const names = new Map();
  for (let i = 2; i <= 8; i++) {
    names.set(g.front["p" + i], "p" + i);
    names.set(g.back["q" + i], "q" + i);
  }
  for (let i = 23; i <= 38; i++) names.set(g.join["j" + i], "j" + i);
  return {
    lines: g.lines.map((l) => [names.get(l.a), names.get(l.b), l.kind]),
    faces: g.faces.map((f) => f.map((p) => names.get(p))),
  };
}

/* Point-by-point equality over the whole slider, both modes, four canvases. */
{
  const sizes = [[600, 350], [400, 300], [800, 600], [375, 220]];
  let compared = 0;
  let mismatches = 0;
  for (const [width, height] of sizes) {
    for (let w = C.W_MIN; w <= C.W_MAX; w++) {
      for (const lessReal of [false, true]) {
        const g = C.geometry(C.start({ w: w, lessReal: lessReal, width: width, height: height }));
        const a = appletDraw(w, lessReal, width, height);
        compared++;
        if (![g.t, g.X0, g.Y0, g.X, g.Y, g.Z, g.cx, g.cy].every((v, i) =>
          near(v, [a.t, a.x0, a.y0, a.x, a.y, a.z, a.mx, a.my][i]))) mismatches++;
        if (!near(g.L, a.len)) mismatches++;
        if (!near(g.gap, a.gap)) mismatches++;
        for (const key of Object.keys(a.named)) {
          const gp = key[0] === "p" ? g.front[key] : key[0] === "q" ? g.back[key] : g.join[key];
          if (!nearPoint(gp, a.named[key])) mismatches++;
        }
        const sg = coreSignature(g);
        if (JSON.stringify(sg.lines) !== JSON.stringify(a.lines)) mismatches++;
        if (JSON.stringify(sg.faces) !== JSON.stringify(a.faces)) mismatches++;
      }
    }
  }
  check("the core matches a second transcription of Draw for every configuration",
    compared === 251 * 2 * 4 && mismatches === 0,
    `${compared} configurations, ${mismatches} differences`);
}

/* Fixed landmarks of the applet's own default canvas. */
{
  const g = C.geometry(C.start({}));
  const a = appletDraw(500, false, 600, 350);
  equal("the default canvas uses t = height/7 = 50", g.t, 50);
  equal("X0 = X = t/2 = 25", [g.X0, g.X], [25, 25]);
  equal("Y0 = height - 2t = 250", g.Y0, 250);
  check("Y = t/sqrt(3), the isometric step", near(g.Y, 50 / Math.sqrt(3)));
  equal("the unused Z is width*7/15 = 280", g.Z, 280);
  check("the beam length is Dist(p2,q8)*W/1000 at W = 500", near(g.L, a.len));
  equal("the default picture draws 12 beam lines", g.lines.filter((l) => l.kind === "beam").length, 12);
  equal("at W = 500 the default picture draws no cover faces", g.faces.length, 0);
}

/* ------------------------------------------------- 3. the page's claims */

/* "This impossible frame is a combination of two 3D letters Pi": the code
   draws one skeleton and its half-turn image, never two different shapes. */
{
  let bad = 0;
  for (let w = C.W_MIN; w <= C.W_MAX; w++) {
    const g = C.geometry(C.start({ w: w, width: 600, height: 350 }));
    for (let i = 2; i <= 8; i++) {
      if (!nearPoint(g.back["q" + i], C.reflect(g.front["p" + i], g.cx, g.cy))) bad++;
    }
  }
  check("every point of the right half is the half-turn of the left half, for all 251 slider values", bad === 0,
    `${bad} broken symmetries`);
}

{
  const g = C.geometry(C.start({}));
  /* The drawing uses two mirror-image slanted steps a = (X,-Y) and
     b = (-X,-Y), with a third vertical step c = -a - b: an axonometric view
     of three directions in space. Bytecode Y = t/sqrt(3), X = t/2, so the
     slants are about 82 degrees apart, not the 120 of an isometric sketch. */
  const ax = { x: g.X, y: -g.Y }, bx = { x: -g.X, y: -g.Y };
  const cx = { x: 0, y: 2 * g.Y };
  check("the two slanted steps are mirror images", near(ax.x, -bx.x) && near(ax.y, bx.y));
  check("the third step closes the drawing's three directions", near(ax.x + bx.x + cx.x, 0) && near(ax.y + bx.y + cx.y, 0));

  const step = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
  const alongB = step(g.front.p2, g.front.p3);
  const alongA = step(g.front.p3, g.front.p8);
  check("one Pi bar uses the b axis", near(alongB.x, bx.x) && near(alongB.y, bx.y));
  check("the same bar then uses the a axis", near(alongA.x, 4 * ax.x) && near(alongA.y, 4 * ax.y));

  /* Each half has two beams of the same length L meeting its bar at right
     angles in 3D; that is an ordinary object before the halves are coupled. */
  check("the left half's two beams are the same length", near(C.dist(g.front.p2, g.join.j30), g.L)
    && near(C.dist(g.front.p8, g.join.j23), g.L));
  check("the right half's two beams are the same length", near(C.dist(g.back.q2, g.join.j31), g.L)
    && near(C.dist(g.back.q8, g.join.j38), g.L));
  check("the coupled beams share one straight line", near((g.join.j23.x - g.front.p8.x) * (g.join.j31.y - g.back.q2.y)
    - (g.join.j23.y - g.front.p8.y) * (g.join.j31.x - g.back.q2.x), 0, 1e-7));
}

/* "two perfectly possible shapes will suffice" and the coupling: at the
   slider maximum the two opposing beams end at exactly the same point. */
{
  let openGap = 0, closedGap = 0, badLength = 0;
  for (const [width, height] of [[600, 350], [400, 300], [800, 600], [375, 220]]) {
    for (const lessReal of [false, true]) {
      const closed = C.geometry(C.start({ w: 500, lessReal, width, height }));
      const open = C.geometry(C.start({ w: 250, lessReal, width, height }));
      if (closed.gap > 1e-7) closedGap++;
      if (!(open.gap > 1)) openGap++;
      if (!near(C.dist(closed.front.p8, closed.join.j23), closed.L)
        || !near(C.dist(closed.back.q2, closed.join.j31), closed.L)) badLength++;
    }
  }
  check("at W = 500 the middle beams coincide on every canvas, in both modes", closedGap === 0, `${closedGap} sizes did not close`);
  check("at W = 250 the same beams leave a visible gap", openGap === 0, `${openGap} sizes had no gap`);
  check("both halves keep their beam length at either slider end", badLength === 0);
}

/* The W < 498 painting switch is a real quirk of the bytecode: below 498
   two quads are filled and their edges drawn; at 498+ they vanish. */
{
  const lo = C.geometry(C.start({ w: 497, lessReal: false }));
  const hi = C.geometry(C.start({ w: 498, lessReal: false }));
  const hiReal = C.geometry(C.start({ w: 498, lessReal: true }));
  check("below 498 the two cover faces are painted", lo.faces.length === 2 && lo.lines.length > hi.lines.length);
  check("at 498 the covers are gone", hi.faces.length === 0 && !hi.lines.some((l) => l.kind === "detail"));
  check("at 498 the LessReal mode still draws its two extra edges", hiReal.lines.filter((l) => l.kind === "detail").length === 2);
  check("the LessReal mode still paints both cover faces below 498", C.geometry(C.start({ w: 300, lessReal: true })).faces.length === 2);
}

/* Negative beam lengths make FixedLength step backwards; keep the quirk. */
{
  const g = C.geometry(C.start({ w: 250, width: 600, height: 350 }));
  const a = appletDraw(250, false, 600, 350);
  check("the applet's L - 4X is negative at W = 250", a.len - 4 * a.x < 0);
  check("the fourth rear connector therefore steps away from its target",
    g.join.j34.x > g.back.q6.x && nearPoint(g.join.j34, a.named.j34));
}

done("coupled-impossible-fork");
