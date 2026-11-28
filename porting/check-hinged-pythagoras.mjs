#!/usr/bin/env node
"use strict";

/*
 * Logic test for hinged-pythagoras/hinged-pythagoras-core.js.
 *
 *   node porting/check-hinged-pythagoras.mjs
 *
 * Checks the applet's init() arithmetic (including its truncating integer
 * division), its mouse strip and 0..95-degree scrollbar, and every whole
 * hinge position of the real 640x460 canvas. The page's claim is the hinged
 * dissection of Proof #9: four right triangles of legs a and b leave a
 * tilted square of area c² on the left, and when the two hinges have turned
 * 90° they leave a square of side a and a square of side b on the right.
 * That is tested exhaustively in a, in the angle, and at 90° for every a,
 * including a point-by-point comparison with a second, literal transcription
 * of DrawLPyth() and DrawRPyth() from HingedPythagorasCanvas.class.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hinged-pythagoras/hinged-pythagoras-core.js", "HingedPythagorasCore");
const P = C.pt;
const near = (p, q, tol = 1e-7) =>
  !!p && !!q && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const nearNum = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const dot = (p, q, r) => (p.x - q.x) * (r.x - q.x) + (p.y - q.y) * (r.y - q.y);
const area = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
};
const corners = (x, y, s) => [P(x, y + s), P(x + s, y + s), P(x + s, y), P(x, y)];
const sameTri = (t, u) => [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
  .some((perm) => perm.every((p, i) => near(t[i], u[p])));

/* ------------------------------------------------- a second transcription */

// init() of HingedPythagorasCanvas: every number is an int in Java.
function refInit(w, h) {
  const margin = 60, half = Math.trunc(w / 2);
  const side = Math.min(half, h) - 2 * margin;
  const dx = Math.trunc((half - side) / 2), dy = Math.trunc((h - side) / 2);
  const L = corners(dx, dy, side);
  const R = corners(dx + half, dy, side);
  const M = P(Math.trunc((L[0].x + L[1].x) / 3), L[0].y);
  const B = L[1].x - M.x;
  return { side, dx, dy, L, R, M, B, Angle: 0 };
}

// The AWT calls translate() then rotate(theta); apply them to a relative
// polygon vertex the same way Graphics2D does (y grows downwards).
function refTransform(rel, origin, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return P(origin.x + rel.x * c - rel.y * s, origin.y + rel.x * s + rel.y * c);
}

// DrawLPyth / DrawRPyth, transcribed statement by statement. Polygons 6 and
// 7 are filled before any transform; polygon 9 around V turns by +Angle and
// polygon 10 around F by -Angle.
function refPieces(ref, a, degrees) {
  const { L, R } = ref;
  // mouseDragged assigns M.x = x and B = L1.x - M.x; reconstruct that M.
  const M = P(L[1].x - a, L[0].y);
  const p2 = P(L[0].x, L[0].y - a);
  const p3 = P(L[3].x + a, L[3].y);
  const p4 = P(L[2].x, L[2].y + a);
  const left = [[L[0], M, p2], [p2, L[3], p3], [p3, L[2], p4], [p4, L[1], M]];

  const F = P(M.x + R[0].x - L[0].x, M.y);
  const q1 = P(R[0].x, R[0].y - a);
  const q2 = P(R[3].x + a, R[3].y);
  const q3 = P(R[2].x, R[2].y + a);
  const poly6 = [F, R[0], q1];
  const poly7 = [q1, R[3], q2];
  const rel9 = [P(0, 0), P(R[2].x - q2.x, R[2].y - q2.y),
    P(q3.x - q2.x, q3.y - q2.y)];
  const rel10 = [P(0, 0), P(R[1].x - F.x, R[1].y - F.y),
    P(q3.x - F.x, q3.y - F.y)];
  const theta = degrees * Math.PI / 180;
  const poly9 = rel9.map((p) => refTransform(p, q2, theta));
  const poly10 = rel10.map((p) => refTransform(p, F, -theta));
  let guide = null;
  if (theta > Math.PI / 2 - 0.01) {
    guide = { x1: Math.max(R[3].x + a, R[2].x - a), x2: R[2].x, y: R[0].y - a };
  }
  return { left, fixed: [poly6, poly7], turned: [poly9, poly10], F, U: q1, V: q2, W: q3, guide };
}

function inside(p, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/* ------------------------------------------------------ 1. the start state */

{
  const ref = refInit(640, 460);
  const s = C.start();
  check("init() gives a square of side 200 on the 640x460 canvas", ref.side === 200 && s.side === 200);
  check("init() puts M at x=106, so the starting a is 154 and b is 46",
    ref.M.x === 106 && ref.B === 154 && s.a === 154 && s.side - s.a === 46);
  check("init() centres the squares: dx=60, dy=130", ref.dx === 60 && ref.dy === 130);
  check("the scrollbar starts at 0 degrees", s.angle === 0 && ref.Angle === 0);
  check("the starting corners match a literal init() transcription",
    near(C.layout(s).L[0], ref.L[0]) && near(C.layout(s).R[2], ref.R[2]));
}

/* ------------------------------- 2. init() over the whole canvas range */

{
  let bad = 0, n = 0;
  for (let w = 320; w <= 1000; w += 7) {
    for (let h = 180; h <= 700; h += 13) {
      const ref = refInit(w, h);
      const got = C.initial(w, h);
      const L = C.layout(got, w, h);
      if (got.side !== ref.side || got.a !== ref.B ||
          !near(L.L[0], ref.L[0]) || !near(L.L[3], ref.L[3]) ||
          !near(L.R[1], ref.R[1]) || !near(L.M, ref.M)) bad++;
      n++;
    }
  }
  check(`init arithmetic agrees with the bytecode for ${n} canvas sizes`, bad === 0, `${bad} failures`);
}

/* --------------------------------------- 3. hinge dragging and the slider */

{
  const s = C.start();
  const g = C.layout(s);
  check("a press on M inside the 20px strip moves the hinge",
    C.dragHinge(s, P(120, 330)).a === 260 - 120);
  check("a press on the bottom edge 21px away is ignored by the applet",
    C.dragHinge(s, P(120, 351)) === null);
  check("a press above the strip is ignored", C.dragHinge(s, P(120, 308)) === null);
  check("a press left of the square is ignored", C.dragHinge(s, P(59, 330)) === null);
  check("a press right of the square is ignored", C.dragHinge(s, P(261, 330)) === null);
  check("the keyboard clamp keeps M on the bottom side",
    C.setHinge(s, -50).a === 200 && C.setHinge(s, 999).a === 0);
  check("hinge positions are whole pixels, as java.awt.Point is",
    C.setHinge(s, 123.7).a === 260 - 124);
  check("changing the hinge keeps a + b = s",
    [0, 1, 77, 199, 200].every((x) => {
      const q = C.setHinge(s, x);
      return q.a + (q.side - q.a) === q.side;
    }));
  check("the scrollbar is clamped to 0..95 whole degrees",
    C.setAngle(s, -4).angle === 0 && C.setAngle(s, 999).angle === 95 &&
    C.setAngle(s, 37.6).angle === 38);
  check("the alignment line appears from 90 degrees, matching PI/2 - 0.01",
    C.guide(C.setAngle(s, 89)) === null && C.guide(C.setAngle(s, 90)) !== null);
}

/* --------------------- 4. the four triangles, for every whole hinge spot */

{
  let bad = 0, n = 0;
  const s = C.start();
  for (let x = 60; x <= 260; x++) {
    const q = C.setHinge(s, x);
    const d = C.pieces(q);
    const { a, b } = d;
    if (a + b !== 200 || a !== 260 - x) bad++;
    for (const tri of d.left.concat(d.fixed)) {
      const sides = [dist(tri[0], tri[1]), dist(tri[1], tri[2]), dist(tri[2], tri[0])].sort((u, v) => u - v);
      if (!nearNum(sides[0], Math.min(a, b)) ||
          !nearNum(sides[1], Math.max(a, b)) ||
          !nearNum(sides[2], Math.hypot(a, b)) ||
          !nearNum(area(tri), a * b / 2)) bad++;
    }
    n++;
  }
  check(`all eight triangles are right-angled with area ab/2 at ${n} hinge spots`, bad === 0, `${bad} failures`);

  const d0 = C.pieces(C.setAngle(C.start(), 0));
  check("at 0 degrees the right pieces are the left pieces shifted by width/2",
    d0.fixed.concat(d0.turned).every((tri) =>
      d0.left.some((other) => sameTri(tri, other.map((p) => P(p.x + 320, p.y))))));
}

/* ------------------ 5. the page's claim: c² on the left, a²+b² on the right */

{
  const s = C.start();
  let bad = 0, n = 0;
  for (let x = 60; x <= 260; x++) {
    const q = C.setHinge(s, x);
    const d = C.pieces(q);
    const id = C.identity(q);
    const square = d.tilted;
    const sides = [0, 1, 2, 3].map((i) => dist(square[i], square[(i + 1) % 4]));
    if (sides.some((v) => !nearNum(v, id.c))) bad++;
    if (Math.abs(dot(square[0], square[1], square[2])) > 1e-7) bad++;
    if (!nearNum(area(square), id.c2) || !nearNum(id.c2, 40000 - 2 * id.a * id.b) ||
        !id.holds) bad++;
    n++;
  }
  check(`the middle square has side c and area c² = s² - 2ab at ${n} hinge spots`, bad === 0, `${bad} failures`);

  // At exactly 90 degrees the two swinging triangles close into two squares.
  bad = 0;
  for (let x = 61; x < 260; x++) {
    const q = C.setAngle(C.setHinge(s, x), 90);
    const d = C.pieces(q);
    const id = C.identity(q);
    if (!near(d.turned[0][2], d.U) || !near(d.turned[1][2], d.U)) bad++;
    if (!near(d.turned[0][1], P(d.V.x, d.V.y + id.b))) bad++;
    if (!near(d.turned[1][1], P(d.F.x, d.F.y - id.a))) bad++;
    if (!C.formed(q)) bad++;
    const squares = C.legSquares(q);
    if (!nearNum(area(squares[0]), id.b * id.b) ||
        !nearNum(area(squares[1]), id.a * id.a) ||
        !nearNum(area(squares[0]) + area(squares[1]), area(d.tilted))) bad++;
    // No triangle covers the inside of either leg-square.
    let overlap = 0;
    for (const square of squares) {
      const mid = P((square[0].x + square[2].x) / 2, (square[0].y + square[2].y) / 2);
      for (const tri of d.fixed.concat(d.turned)) if (inside(mid, tri)) overlap++;
    }
    if (overlap) bad++;
  }
  check(`at 90° the pieces leave disjoint squares of areas a² and b² (${198} hinge spots)`, bad === 0, `${bad} failures`);

  bad = 0;
  for (let deg = 0; deg <= 95; deg++) {
    if (deg === 90) continue;
    const q = C.setAngle(C.setHinge(s, 137), deg);
    if (C.formed(q) || near(C.pieces(q).turned[0][2], C.pieces(q).U, 1e-6)) bad++;
  }
  check("no other scrollbar setting closes the two leg-squares", bad === 0, `${bad} failures`);

  bad = 0;
  for (let x = 60; x <= 260; x++) {
    const q = C.setHinge(s, x);
    const id = C.identity(q);
    if (!nearNum(id.a2 + id.b2, id.s2 - id.triangles2) ||
        !nearNum(id.c * id.c, id.a2 + id.b2)) bad++;
  }
  check("a² + b² = c² holds for all 201 whole hinge spots", bad === 0, `${bad} failures`);

  const rand = rng(36036);
  bad = 0;
  for (let i = 0; i < 2000; i++) {
    const side = 20 + Math.floor(rand() * 500);
    const a = Math.floor(rand() * (side + 1));
    if (!C.identity({ side, a, angle: 0 }).holds) bad++;
  }
  check("a² + b² = c² holds for 2000 random square sizes", bad === 0, `${bad} failures`);
}

/* ---------------------- 6. rotating never changes a triangle's shape */

{
  let bad = 0, n = 0;
  for (const x of [62, 106, 130, 187, 259]) {
    const base = C.setHinge(C.start(), x);
    const reference = C.pieces(base);
    for (let deg = 0; deg <= 95; deg += 5) {
      const d = C.pieces(C.setAngle(base, deg));
      for (const [k, tri] of d.turned.entries()) {
        const src = k === 0 ? [reference.V, reference.g.R[2], reference.W]
          : [reference.F, reference.g.R[1], reference.W];
        // The hinged vertex is fixed; the other two keep their distances.
        if (!nearNum(dist(tri[0], tri[1]), dist(src[0], src[1])) ||
            !nearNum(dist(tri[0], tri[2]), dist(src[0], src[2])) ||
            !nearNum(dist(tri[1], tri[2]), dist(src[1], src[2]))) bad++;
      }
      n++;
    }
  }
  check(`the hinged triangles stay rigid at ${n} configurations`, bad === 0, `${bad} failures`);
}

/* ------------- 7. agreement with the bytecode, over every setting */

{
  let bad = 0, n = 0;
  const s = C.start();
  for (let x = 60; x <= 260; x += 2) {
    const q = C.setHinge(s, x);
    const got = C.pieces(q);
    const ref = refPieces(refInit(640, 460), q.a, q.angle);
    for (let deg = 0; deg <= 95; deg++) {
      const d = deg === 0 ? got : C.pieces(C.setAngle(q, deg));
      const r = deg === 0 ? ref : refPieces(refInit(640, 460), q.a, deg);
      for (const key of ["left", "fixed", "turned"]) {
        if (d[key].length !== r[key].length) bad++;
        for (let i = 0; i < r[key].length; i++) {
          for (let j = 0; j < 3; j++) if (!near(d[key][i][j], r[key][i][j])) bad++;
        }
      }
      const g = C.guide(C.setAngle(q, deg));
      if (!!g !== !!r.guide || (g && !near(P(g.x1, g.y), P(r.guide.x1, r.guide.y)))) bad++;
      n++;
    }
  }
  check(`every point matches a second bytecode transcription at ${n} configurations`, bad === 0, `${bad} failures`);

  bad = 0;
  let canvases = 0;
  for (let w = 340; w <= 960; w += 31) {
    for (let h = 200; h <= 640; h += 37) {
      const ref = refInit(w, h);
      const q = C.initial(w, h);
      const d = C.pieces(q, w, h);
      const r = refPieces(ref, q.a, 0);
      for (const key of ["left", "fixed", "turned"]) {
        for (let i = 0; i < r[key].length; i++) {
          for (let j = 0; j < 3; j++) if (!near(d[key][i][j], r[key][i][j])) bad++;
        }
      }
      canvases++;
    }
  }
  check(`the pieces match the bytecode at ${canvases} other canvas sizes`, bad === 0, `${bad} failures`);
}

done("hinged-pythagoras");
