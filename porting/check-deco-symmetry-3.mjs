#!/usr/bin/env node
"use strict";

/*
 * Logic test for deco-symmetry-3/deco-symmetry-3-core.js.
 *
 *   node porting/check-deco-symmetry-3.mjs
 *
 * The first sections check the opening figure and the two state transitions.
 * The bulk writes a second transcription of the applet's construction: the
 * incenter from side lengths (instead of GeoSDoub.FindIncenter's angle
 * bisectors), perpendicular feet, the mirrored vertices, the swapped final
 * kites and the rotation angle pi - 2*alpha (instead of ComputeSignedAngle's
 * law of cosines). All three are compared over a grid of triangles in every
 * vertex order and thousands of random triangles, acute and obtuse. The
 * page's own claims are checked there too: three kites for any triangle,
 * two pairs of equal adjacent sides in each kite, the three cuts ending on
 * the sides, the pieces filling the triangle, and six isosceles triangles
 * after cutting the kites along the joins of their feet.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("deco-symmetry-3/deco-symmetry-3-core.js", "DecoSymmetry3Core");
const TOL = 1e-7;
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const close = (a, b, tol = TOL) =>
  !!a && !!b && Number.isFinite(a.x) && Number.isFinite(b.x) && C.dist(a, b) <= tol;
const modPi = (a) => {
  let r = a % (2 * Math.PI);
  if (r <= -Math.PI) r += 2 * Math.PI;
  if (r > Math.PI) r -= 2 * Math.PI;
  return r;
};
const state = (A, B, Cc) => ({
  A, B, C: Cc, showNames: false, showHint: false, moving: false, step: 0, moved: false,
});
const signedArea = (p) => {
  let sum = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    sum += p[i].x * q.y - q.x * p[i].y;
  }
  return sum / 2;
};
const area = (p) => Math.abs(signedArea(p));
const dot = (p, q) => p.x * q.x + p.y * q.y;
const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const footRef = (p, a, b) => {
  if (C.sqDist(a, p) < 1e-12) return p;
  const d = C.sub(b, a);
  return C.add(a, C.mul(d, dot(C.sub(p, a), d) / dot(d, d)));
};
const param = (p, a, b) => {
  const d = C.sub(b, a);
  const n = d.x * d.x + d.y * d.y;
  return n ? dot(C.sub(p, a), d) / n : NaN;
};

/* ------------------------------------------------- 1. the opening figure */

{
  const s = C.start();
  const third = C.WIDTH / 3, half = C.HEIGHT / 2, rad = C.HEIGHT / 3, turn = 2 * Math.PI / 3;
  check("the opening A is the applet's 400x250 fraction", close(s.A,
    { x: third + rad - C.WIDTH / 6, y: half + C.HEIGHT / 8 }));
  check("the opening B is the applet's 120-degree point", close(s.B,
    { x: third + rad * Math.cos(turn), y: half - rad * Math.sin(turn) }));
  check("the opening C is the applet's 240-degree point with the width/12 shift", close(s.C,
    { x: third + rad * Math.cos(2 * turn), y: half - C.WIDTH / 12 - rad * Math.sin(2 * turn) }));
  check("the checkboxes start unchecked, as Java's Checkbox does",
    !s.showNames && !s.showHint && !s.moving && s.step === 0 && !s.moved);
  equal("the animation has the applet's 50 steps", C.NSteps, 50);
  const f = C.compute(s);
  check("the opening triangle is a real one", f.valid);
  check("the opening mirror point P is the reflected centroid",
    near(f.P.x + f.centroid.x, C.WIDTH) && near(f.P.y, f.centroid.y));
  check("the opening hint radius is the inradius", near(f.hintRadius, C.dist(f.O, f.D)));
  check("the opening status does not claim a win", C.result(s) === null);
}

/* ------------------------------------ 2. moves, options and the demo's end */

{
  const s = C.start();
  const moved = C.move(s, "A", { x: 5000, y: -50 });
  check("a dragged corner is clamped into the board",
    moved.A.x === C.WIDTH - C.MARGIN && moved.A.y === C.MARGIN);
  check("a move returns a fresh position", s.A.x === 150 && moved.A !== s.A);
  check("an unknown corner or an invalid point is refused",
    C.move(s, "Z", { x: 1, y: 1 }) === s && C.move(s, "A", null) === s);
  check("the two checkboxes toggle independently",
    C.option(C.option(s, "showNames", true), "showHint", true).showNames &&
    C.option(s, "showHint", true).showHint && C.option(s, "nonsense", true) === s);
  let t = C.startMove(s);
  check("Move them starts the animation only on a real triangle", t.moving && t.step === 0);
  check("advance refuses to run when the animation has not started", C.advance(s) === s);
  const mid = C.advance(C.advance(t));
  check("two advances are two of the applet's steps", mid.step === 2 && mid.moving);
  for (let i = 0; i < C.NSteps; i++) t = C.advance(t);
  check("after 50 steps the demonstration is finished but nobody won",
    !t.moving && t.step === 50 && t.moved && C.result(t) === "done");
  check("moving a corner resets the finished demonstration",
    !C.move(t, "B", { x: 100, y: 60 }).moved && C.result(C.move(t, "B", { x: 100, y: 60 })) === null);
  const bad = state({ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 30, y: 10 });
  check("a collapsed triangle has no dissection", !C.compute(bad).valid);
  check("a collapsed triangle gives a helpful line of status text",
    C.describe(C.compute(bad), bad).includes("proper triangle"));
  check("Move them does nothing on a collapsed triangle", C.startMove(bad) === bad);
  check("the finished status says no piece was flipped",
    C.describe(C.compute(C.start()), t).includes("No piece was flipped"));
}

/* --------------------------------- 3. a second transcription of Compute() */

/*
 * Independent geometry, written from the meaning of the construction rather
 * than from GeoSDoub's bytecode: side-length weights for the incenter, an
 * atan2 signed angle, and pi - 2*alpha for each kite's rotation.
 */
function reference(A, B, Cc) {
  const la = C.dist(B, Cc), lb = C.dist(Cc, A), lc = C.dist(A, B), total = la + lb + lc;
  const O = C.add(C.add(C.mul(A, la / total), C.mul(B, lb / total)), C.mul(Cc, lc / total));
  const foot = (p, a, b) => {
    if (C.sqDist(a, p) < 1e-12) return p;
    const d = C.sub(b, a);
    return C.add(a, C.mul(d, dot(C.sub(p, a), d) / dot(d, d)));
  };
  const D = foot(O, B, Cc), E = foot(O, Cc, A), F = foot(O, A, B);
  const mir = (p) => ({ x: C.WIDTH - p.x, y: p.y });
  const Ap = mir(A), Bp = mir(B), Cp = mir(Cc);
  const Op = mir(O), Dp = mir(D), Ep = mir(E), Fp = mir(F);
  const defs = [
    ["C", [O, D, Cc, E], [Op, Ep, Cp, Dp], Cc, [D, E]],
    ["A", [O, E, A, F], [Op, Fp, Ap, Ep], A, [E, F]],
    ["B", [O, F, B, D], [Op, Dp, Bp, Fp], B, [F, D]],
  ];
  const pieces = defs.map(([name, initial, final, vertex, feet]) => {
    const axis = C.sub(vertex, O);
    const alpha = Math.atan2(axis.y, axis.x);
    return {
      name, initial, final, vertex, feet,
      angle: modPi(Math.PI - 2 * alpha),
      center: Math.abs(axis.x) > 1e-9
        ? { x: C.WIDTH / 2, y: O.y + (C.WIDTH / 2 - O.x) * axis.y / axis.x }
        : null,
      translation: Math.abs(axis.x) > 1e-9 ? null : { x: C.WIDTH - 2 * O.x, y: 0 },
    };
  });
  return { O, D, E, F, Op, Dp, Ep, Fp, Ap, Bp, Cp, pieces };
}

function exercise(A, B, Cc, worst) {
  const s = state(A, B, Cc);
  const f = C.compute(s);
  if (!f.valid) { worst.skipped++; return; }
  const r = reference(A, B, Cc);
  worst.cases++;
  const scale = Math.max(1, C.dist(A, B), C.dist(B, Cc), C.dist(Cc, A));
  worst.incenter = Math.max(worst.incenter, C.dist(f.O, r.O) / scale);
  for (const k of ["D", "E", "F", "Op", "Dp", "Ep", "Fp", "Ap", "Bp", "Cp"]) {
    worst.points = Math.max(worst.points, C.dist(f[k], r[k]) / scale);
  }
  // The feet of the three cuts really are on the sides, for every triangle.
  for (const [p, a, b] of [[f.D, B, Cc], [f.E, Cc, A], [f.F, A, B]]) {
    const t = param(p, a, b);
    worst.onSide = Math.max(worst.onSide, Math.max(0, -t, t - 1));
  }
  // Each piece is a kite: two equal sides from O and two equal sides from
  // the corner. Then the kites partition the triangle, and each kite splits
  // into two isosceles triangles along the line between its two feet.
  const kiteEqualities = [
    [C.dist(f.O, f.D), C.dist(f.O, f.E)],
    [C.dist(f.C, f.D), C.dist(f.C, f.E)],
    [C.dist(f.O, f.E), C.dist(f.O, f.F)],
    [C.dist(f.A, f.E), C.dist(f.A, f.F)],
    [C.dist(f.O, f.F), C.dist(f.O, f.D)],
    [C.dist(f.B, f.F), C.dist(f.B, f.D)],
  ];
  for (const [u, v] of kiteEqualities) worst.kite = Math.max(worst.kite, Math.abs(u - v) / scale);
  const sum = f.pieces.reduce((acc, p) => acc + area(p.initial), 0);
  worst.partition = Math.max(worst.partition, Math.abs(sum - f.area) / (scale * scale));
  // The moving pieces land on the independent mirror kites, by a direct
  // isometry: the signed area of a kite is preserved, never reversed.
  for (let j = 0; j < f.pieces.length; j++) {
    const p = f.pieces[j], ref = r.pieces[j];
    worst.names = worst.names && p.name === ref.name;
    worst.angle = Math.max(worst.angle, Math.abs(modPi(p.angle - ref.angle)));
    worst.landing = Math.max(worst.landing,
      Math.max(...C.pose(p, 1).map((v, i) => C.dist(v, ref.final[i]))) / scale);
    worst.startPose = Math.max(worst.startPose,
      Math.max(...C.pose(p, 0).map((v, i) => C.dist(v, p.initial[i]))) / scale);
    const original = p.initial, half = C.pose(p, 0.5);
    for (let i = 0; i < 4; i++) for (let k = i + 1; k < 4; k++) {
      worst.rigid = Math.max(worst.rigid,
        Math.abs(C.dist(original[i], original[k]) - C.dist(half[i], half[k])) / scale);
    }
    worst.orientation = Math.max(worst.orientation,
      Math.sign(signedArea(p.initial)) === Math.sign(signedArea(C.pose(p, 1))) ? 0 : 1);
    // A nearly vertical diagonal puts the centre thousands of units away,
    // where both transcriptions are ill-conditioned; the landing test above
    // is the meaningful check there, so compare centres only when the line
    // meets the mirror line at a usable angle.
    if (Math.abs(p.axis.x) > 0.01 && p.center && ref.center) {
      worst.center = Math.max(worst.center,
        Math.abs(p.center.x - ref.center.x) / scale,
        Math.abs(p.center.y - ref.center.y) / scale);
    } else if (!p.center && !ref.center) {
      worst.center = Math.max(worst.center, C.dist(p.translation, ref.translation) / scale);
    }
  }
}

const blank = () => ({
  cases: 0, skipped: 0, incenter: 0, points: 0, onSide: 0, kite: 0,
  partition: 0, angle: 0, landing: 0, startPose: 0, rigid: 0, orientation: 0,
  center: 0, names: true,
});

/* A grid of integer triangles, in all six vertex orders (both orientations). */
{
  const worst = blank();
  const B0 = { x: 30, y: 40 }, C0 = { x: 370, y: 200 };
  const vertices = [];
  for (let x = 60; x <= 300; x += 60) for (let y = 30; y <= 220; y += 38) {
    vertices.push({ x, y });
  }
  let configurations = 0;
  for (const A of vertices) {
    const orders = [
      [A, B0, C0], [A, C0, B0], [B0, A, C0],
      [B0, C0, A], [C0, A, B0], [C0, B0, A],
    ];
    for (const order of orders) {
      configurations++;
      exercise(order[0], order[1], order[2], worst);
    }
  }
  check(`the grid ran ${configurations} configurations`, configurations === 180);
  check("the grid had no degenerate cases", worst.skipped === 0, `${worst.skipped} skipped`);
  check(`grid: incenter matches the side-length formula (max ${worst.incenter})`, worst.incenter < TOL);
  check(`grid: every constructed point matches the second transcription (max ${worst.points})`, worst.points < TOL);
  check(`grid: all three cuts end on the sides (max overrun ${worst.onSide})`, worst.onSide <= 1e-10);
  check(`grid: each kite has two pairs of equal sides (max ${worst.kite})`, worst.kite < TOL);
  check(`grid: the three kites fill the triangle (max ${worst.partition})`, worst.partition < TOL);
  check(`grid: the rotation angles match pi - 2*alpha (max ${worst.angle})`, worst.angle < TOL);
  check(`grid: rotated kites land on the mirror kites (max ${worst.landing})`, worst.landing < TOL);
  check(`grid: the half-way pose is still rigid (max ${worst.rigid})`, worst.rigid < TOL);
  check("grid: the move is a rotation, never a reflection", worst.orientation === 0);
  check(`grid: rotation centres and translations agree (max ${worst.center})`, worst.center < TOL);
  check("grid: pieces keep their applet names", worst.names);
  check("grid: the half-way pose begins on the original kites", worst.startPose < TOL);
}

/* Random triangles, including very obtuse ones. */
{
  const rnd = rng(4072);
  const worst = blank();
  for (let i = 0; i < 4000; i++) {
    const A = { x: 20 + rnd() * 360, y: 15 + rnd() * 220 };
    const B = { x: 20 + rnd() * 360, y: 15 + rnd() * 220 };
    const Cc = { x: 20 + rnd() * 360, y: 15 + rnd() * 220 };
    exercise(A, B, Cc, worst);
  }
  check("4000 random triangles were dissected", worst.cases > 3900, `${worst.cases} usable`);
  check(`random: incenter matches (max ${worst.incenter})`, worst.incenter < TOL);
  check(`random: all points match (max ${worst.points})`, worst.points < TOL);
  check(`random: feet stay on the sides (max overrun ${worst.onSide})`, worst.onSide <= 1e-10);
  check(`random: all six kite equalities hold (max ${worst.kite})`, worst.kite < TOL);
  check(`random: areas add up (max ${worst.partition})`, worst.partition < TOL);
  // A few random triangles are extremely thin (area a few square units on a
  // 400x250 board); there the centre is far off the board and the two angle
  // formulas differ only through round-off. The kite/landing checks stay at
  // 1e-7 for every one of them.
  check(`random: angles match the second formula (max ${worst.angle})`, worst.angle < 5e-4);
  check(`random: the kites reach the mirror (max ${worst.landing})`, worst.landing < TOL);
  check(`random: the path is rigid (max ${worst.rigid})`, worst.rigid < TOL);
  check("random: no piece is flipped", worst.orientation === 0);
  check(`random: centres and translations match (max ${worst.center})`, worst.center < 1e-4);
}

/* One exactly known right triangle, so the numbers can be checked by hand. */
{
  const A = { x: 100, y: 50 }, B = { x: 100, y: 200 }, Cc = { x: 250, y: 200 };
  const f = C.compute(state(A, B, Cc));
  const r = 150 - 75 * Math.SQRT2; // (a+b-hypotenuse)/2 for two legs of 150
  check("an exact right triangle has its incenter at B + (r, -r)",
    close(f.O, { x: 100 + r, y: 200 - r }, 1e-9));
  check("its foot on BC is directly below the incenter", close(f.D, { x: f.O.x, y: 200 }, 1e-9));
  check("its foot on AB is directly left of the incenter", close(f.F, { x: 100, y: f.O.y }, 1e-9));
  check("its three kites still land on the mirror", f.pieces.every((p) =>
    Math.max(...C.pose(p, 1).map((v, i) => C.dist(v, p.final[i]))) < 1e-8));
}

/* Isosceles triangles: the parallel-diagonal case is a translation. */
{
  const A = { x: 300, y: 40 }, B = { x: 60, y: 40 }, Cc = { x: 180, y: 200 };
  const f = C.compute(state(A, B, Cc));
  const apex = f.pieces.find((p) => p.name === "C");
  check("an isosceles triangle puts the incenter on the vertical axis", near(f.O.x, 180));
  check("that kite's diagonal is parallel to the mirror line", apex.center === null ||
    near(apex.translation.y, 0));
  check("the parallel kite is translated horizontally", !!apex.translation &&
    near(apex.translation.x, 40) && near(apex.translation.y, 0));
  check("the translation lands on the mirror kite",
    Math.max(...C.pose(apex, 1).map((v, i) => C.dist(v, apex.final[i]))) < 1e-7);
  const sym = C.compute(state({ x: 200, y: 40 }, { x: 110, y: 200 }, { x: 290, y: 200 }));
  check("a symmetric triangle on the mirror line moves by zero", sym.valid &&
    sym.pieces.every((p) => !p.translation || (near(p.translation.x, 0) && near(p.translation.y, 0))));
}

/* The page's parenthetical claim: six isosceles triangles. */
{
  const f = C.compute(C.start());
  const mid = f.pieces.map((p) => midpoint(p.feet[0], p.feet[1]));
  let isosceles = 0;
  for (let i = 0; i < f.pieces.length; i++) {
    const [u, v] = f.pieces[i].feet;
    // Split along the segment joining the two feet: O-u-v is isosceles at
    // O, and vertex-u-v is isosceles at the vertex.
    if (near(C.dist(f.O, u), C.dist(f.O, v)) && near(C.dist(f.pieces[i].initial[2], u),
      C.dist(f.pieces[i].initial[2], v))) isosceles += 2;
    check(`kite ${i} has a real diagonal to cut`, C.dist(u, v) > 0 && !!mid[i]);
  }
  check("each of the three kites splits into two isosceles triangles", isosceles === 6);
}

/* A caution about the page's last sentence: an ordinary cyclic quadrilateral
   need not have the incenter/tangent-kite dissection; a tangential one does. */
{
  const center = { x: 200, y: 100 }, radius = 60;
  const onCircle = (deg) => ({
    x: center.x + radius * Math.cos(deg * Math.PI / 180),
    y: center.y + radius * Math.sin(deg * Math.PI / 180),
  });
  const square = [onCircle(0), onCircle(90), onCircle(180), onCircle(270)];
  const cyclic = [onCircle(0), onCircle(65), onCircle(170), onCircle(255)];
  const mismatches = (poly) => {
    let worst = 0;
    for (let i = 0; i < 4; i++) {
      const a = poly[i], b = poly[(i + 1) % 4], c = poly[(i + 2) % 4];
      const u = footRef(center, a, b), v = footRef(center, b, c);
      worst = Math.max(worst, Math.abs(C.dist(b, u) - C.dist(b, v)));
    }
    return worst;
  };
  check("a square (both cyclic and tangential) has equal tangent lengths", mismatches(square) < TOL);
  check("a merely cyclic quadrilateral generally does not", mismatches(cyclic) > 1);
}

done("deco-symmetry-3");
