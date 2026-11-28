#!/usr/bin/env node
"use strict";

/*
 * Logic test for inversion-in-circle-and-isosceles-2/...-core.js.
 *
 *   node porting/check-inversion-in-circle-and-isosceles-2.mjs
 *
 * Part 1 checks the page's claims over 240 configurations of A, B and C:
 * BECF is a rhombus, B is the incenter of CKL, the two tangent circles sit
 * where the page says, the negative-power inversion about B fixes (O) and
 * swaps A and C, (P) goes to the vertical through C, and (Q') is the excircle
 * of BI_kI_l tangent to (O). Part 2 writes the applet's Compute() a second
 * time, literally following GeoSDoub's bytecode (determinant intersections,
 * its slope-based circle-line intersections, ComputeAngle/Rotate/FindExcenter),
 * and compares every constructed point and radius with the core in all 240
 * configurations. Part 3 covers the degenerate and option edges.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "inversion-in-circle-and-isosceles-2/inversion-in-circle-and-isosceles-2-core.js",
  "InversionInCircleAndIsosceles2Core",
);

const near = (value, limit = 1e-6) => Number.isFinite(value) && value < limit;
const pt = (x, y) => ({ x, y });
const d = C.dist;

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  check("a new illustration has three finite points", [s.A, s.B, s.C].every(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  check("the start has A < B < C on one line", s.A.x < s.B.x && s.B.x < s.C.x &&
    s.A.y === s.B.y && s.B.y === s.C.y);
  check("the start's diameter is min(W,H)*2/3.5", near(Math.abs((s.C.x - s.A.x) -
    2 * Math.min(C.VIEW.width, C.VIEW.height) / 3.5), 1e-9));
  check("an illustration has no win or loss", C.result(s) === null);
  equal("the applet's five controls start as it does", s.options,
    { names: false, premise: false, statement: false, step: 0 });

  const moved = C.movePoint(s, "C", { x: 9000, y: -20 });
  check("dragging clamps to the board and moves all three to one line",
    moved.C.x === C.VIEW.width - C.MARGIN && moved.A.y === C.MARGIN &&
    moved.B.y === C.MARGIN && moved.C.y === C.MARGIN);
  check("dragging does not change the old position",
    s.C.x === C.START.C.x && s.touches === 0 && moved.touches === 1);
  check("an unknown handle or a bad point is ignored",
    C.movePoint(s, "Z", pt(1, 1)) === s && C.movePoint(s, "A", pt(NaN, 3)) === s);
  check("step is clamped to the applet's 0..4 range",
    C.setOption(s, "step", 99).options.step === 4 &&
    C.setOption(s, "step", -3).options.step === 0);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  check("toggling names does not move the points",
    C.setOption(s, "names", true).options.names === true &&
    C.setOption(s, "names", true).A === s.A);
  check("collapsed points make the drawing invalid",
    !C.geometry({ ...s, B: { ...s.A } }).valid &&
    !C.geometry({ ...s, C: { ...s.A } }).valid);
}

/* ------------------------------------------- 2. the page's claims, in bulk */

/* 240 configurations: many B positions, several lengths, heights and even
   reversed A/C (the applet's ArrangeABC sorts them for us). */
const rand = rng(20261127);
const configs = [];
for (let i = 0; i < 240; i++) {
  const t = 0.04 + 0.92 * (i + 0.37) / 240;
  const cx = 180 + 40 * Math.sin(i * 0.61);
  const half = 70 + 22 * Math.cos(i * 0.29);
  const y = 70 + 40 * (1 + Math.sin(i * 0.83)) / 2;
  const A0 = pt(cx - half, y), C0 = pt(cx + half, y);
  const B = pt(cx - half + 2 * half * t, y);
  configs.push(i % 11 === 0 ? { A: C0, B, C: A0 } : { A: A0, B, C: C0 });
}
for (let i = 0; i < 60; i++) {
  const y = 40 + rand() * 250;
  const A0 = pt(60 + rand() * 80, y), C0 = pt(280 + rand() * 60, y);
  configs.push({ A: A0, B: pt(A0.x + rand() * (C0.x - A0.x), y), C: C0 });
}

const drawings = configs.map((p) => C.geometry({ ...p, options: C.start().options, touches: 0 }));
check("every configuration gives a valid construction", drawings.every((g) => g.valid));

const worst = (fn) => drawings.reduce((m, g) => Math.max(m, fn(g)), 0);
const lineDist = (p, a, b) => {
  const f = C.foot(p, a, b);
  return f ? d(p, f) : Infinity;
};
const cross = (u, v) => Math.abs(u.x * v.y - u.y * v.x);

{
  /* Page: the perpendicular bisector of BC cuts (O) at E and F, so BECF is
     a rhombus (BE = EC = CF = FB), and EB, FB cut (O) again at K, L with
     EL = EC = EB, so B is the incenter of triangle CKL. */
  const rhombus = worst((g) => {
    const s = [d(g.B, g.E), d(g.E, g.C), d(g.C, g.F), d(g.F, g.B)];
    return Math.max(...s) - Math.min(...s);
  });
  check("BECF is a rhombus in every configuration", near(rhombus, 1e-8), `spread ${rhombus}`);
  check("E and F lie on the perpendicular bisector of BC", worst((g) =>
    Math.abs(g.E.x - (g.B.x + g.C.x) / 2) + Math.abs(g.F.x - (g.B.x + g.C.x) / 2)) < 1e-8);
  const el = worst((g) => Math.max(
    Math.abs(d(g.E, g.L) - d(g.E, g.C)), Math.abs(d(g.E, g.L) - d(g.E, g.B))));
  check("EL = EC = EB as the page says", near(el, 1e-8), `largest error ${el}`);
  const incenter = worst((g) => {
    const a = lineDist(g.B, g.C, g.K), b = lineDist(g.B, g.K, g.L), c = lineDist(g.B, g.L, g.C);
    return Math.max(a, b, c) - Math.min(a, b, c);
  });
  check("B is the incenter of CKL", near(incenter, 1e-8), `spread ${incenter}`);

  /* Page: FE bisects angle CFB (= CFL). */
  const bisect = worst((g) => {
    const u = { x: g.C.x - g.F.x, y: g.C.y - g.F.y };
    const v = { x: g.E.x - g.F.x, y: g.E.y - g.F.y };
    const w = { x: g.B.x - g.F.x, y: g.B.y - g.F.y };
    const ang = (p, q) => Math.abs(cross(p, q)) / (Math.hypot(p.x, p.y) * Math.hypot(q.x, q.y));
    return Math.abs(ang(u, v) - ang(v, w));
  });
  check("FE bisects angle CFB", near(bisect, 1e-8), `largest error ${bisect}`);

  /* Page: circle (Q), centre on the perpendicular at B, tangent to (O),
     (P) and BE; that is exactly the conclusion QB perpendicular to AC. */
  check("Q lies on the perpendicular at B (QB is perpendicular to AC)",
    worst((g) => Math.abs(g.Q.x - g.B.x)) < 1e-9);
  const tangO = worst((g) => Math.abs(d(g.O, g.Q) - (g.R - g.rQ)));
  const tangP = worst((g) => Math.abs(d(g.P, g.Q) - (g.rP + g.rQ)));
  const tangBE = worst((g) => Math.abs(lineDist(g.Q, g.B, g.E) - g.rQ));
  check("(Q) is internally tangent to (O)", near(tangO), `largest error ${tangO}`);
  check("(Q) is externally tangent to (P)", near(tangP), `largest error ${tangP}`);
  check("(Q) is tangent to BE", near(tangBE), `largest error ${tangBE}`);

  /* Page: the perpendicular at B cuts (O) at M and N, and the circle centred
     at B through M meets (O) at diametrically opposite points, so inversion
     with power -BM^2 = -BA*BC fixes (O). */
  const power = worst((g) => Math.abs(g.power - g.circleMN.r * g.circleMN.r));
  check("BM squared is BA times BC", near(power, 1e-8), `largest error ${power}`);
  check("M and N are on (O) and opposite on circle (B)", worst((g) =>
    Math.abs(d(g.O, g.M) - g.R) + Math.abs(d(g.O, g.N) - g.R) +
    Math.abs(g.M.x + g.N.x - 2 * g.B.x) + Math.abs(g.M.y + g.N.y - 2 * g.B.y)) < 1e-7);
  const swapA = worst((g) => d(C.inverse(g, g.A), g.C));
  const swapC = worst((g) => d(C.inverse(g, g.C), g.A));
  check("the negative inversion takes A to C and C to A",
    near(swapA) && near(swapC), `errors ${swapA}, ${swapC}`);
  const fixesO = worst((g) => {
    let err = 0;
    for (let i = 0; i < 16; i++) {
      const a = 2 * Math.PI * i / 16;
      const X = pt(g.O.x + g.R * Math.cos(a), g.O.y + g.R * Math.sin(a));
      err = Math.max(err, Math.abs(d(C.inverse(g, X), g.O) - g.R));
    }
    return err;
  });
  check("the inversion with power -BM^2 takes (O) into itself", near(fixesO),
    `largest error ${fixesO}`);
  const smallToLine = worst((g) => {
    let err = 0;
    for (let i = 1; i < 16; i++) { // i=0 is B itself, the centre of inversion
      const a = 2 * Math.PI * i / 16;
      const X = pt(g.P.x + g.rP * Math.cos(a), g.P.y + g.rP * Math.sin(a));
      err = Math.max(err, Math.abs(C.inverse(g, X).x - g.C.x));
    }
    return err;
  });
  check("(P) goes to the line perpendicular to AC at C", near(smallToLine),
    `largest error ${smallToLine}`);
  check("EBK passes through the inversion centre B", worst((g) =>
    Math.abs(cross(pt(g.E.x - g.B.x, g.E.y - g.B.y), pt(g.K.x - g.B.x, g.K.y - g.B.y)))) < 1e-7);

  /* Page: Q' is the inverse image of Q, tangent to IkIl, to BE and, by
     Feuerbach, externally tangent to the nine-point circle (O) of BI_kI_l.
     Its centre is on the external bisector at B, so BQQ' is perpendicular. */
  const inverseQ = worst((g) => {
    const k = -g.power / (d(g.B, g.Q) ** 2 - g.rQ ** 2);
    const expected = pt(g.B.x + k * (g.Q.x - g.B.x), g.B.y + k * (g.Q.y - g.B.y));
    const radius = Math.abs(k) * g.rQ;
    return d(expected, pt(g.Qp.x, g.Qp.y)) + Math.abs(radius - g.Qp.r);
  });
  check("(Q') really is the negative inverse of (Q)", near(inverseQ), `error ${inverseQ}`);
  check("the centre of (Q') is also on the perpendicular at B",
    worst((g) => Math.abs(g.Qp.x - g.B.x)) < 1e-8);
  const exDist = worst((g) => {
    const c = pt(g.Qp.x, g.Qp.y);
    const ds = [lineDist(c, g.Ik, g.B), lineDist(c, g.B, g.Il), lineDist(c, g.Il, g.Ik)];
    return Math.max(ds[0], ds[1], ds[2]) - Math.min(ds[0], ds[1], ds[2]) +
      Math.abs(ds[0] - g.Qp.r);
  });
  check("(Q') is the excircle of BI_kI_l, equidistant from its three sides",
    near(exDist), `largest error ${exDist}`);
  check("(Q') touches the image line I_k I_l at C", worst((g) =>
    Math.abs(Math.abs(g.Qp.x - g.C.x) - g.Qp.r)) < 1e-8);
  check("(Q') touches BE", worst((g) =>
    Math.abs(lineDist(pt(g.Qp.x, g.Qp.y), g.B, g.E) - g.Qp.r)) < 1e-8);
  const nine = worst((g) => {
    const U = g.Ik, V = g.B, W = g.Il;
    const cc = C.intersect(
      pt((U.x + V.x) / 2, (U.y + V.y) / 2),
      pt((U.x + V.x) / 2 + V.y - U.y, (U.y + V.y) / 2 - (V.x - U.x)),
      pt((V.x + W.x) / 2, (V.y + W.y) / 2),
      pt((V.x + W.x) / 2 + W.y - V.y, (V.y + W.y) / 2 - (W.x - V.x)));
    const h = pt(U.x + V.x + W.x - 2 * cc.x, U.y + V.y + W.y - 2 * cc.y);
    const centre = pt((cc.x + h.x) / 2, (cc.y + h.y) / 2);
    return d(centre, g.O) + Math.abs(d(cc, U) / 2 - g.R) +
      Math.abs(d(pt(g.Qp.x, g.Qp.y), g.O) - (g.Qp.r + g.R));
  });
  check("(O) is the nine-point circle of BI_kI_l and (Q') touches it", near(nine),
    `largest error ${nine}`);
  check("B, Q and Q' are collinear (BQQ' perpendicular to AC)", worst((g) =>
    Math.abs((g.Qp.x - g.B.x) * (g.Q.y - g.B.y) -
      (g.Qp.y - g.B.y) * (g.Q.x - g.B.x))) < 1e-8);
}

/* ----------------------------- 3. the applet's own construction, again */

/* Literal transcription of InversionInCircleAndIsosceles2Canvas.Compute()
   with GeoSDoub's helper methods (javap -c -p on classes.zip). It deliberately
   keeps the bytecode's determinant formulas, slope-based circle intersections
   and angle-bisector excenter instead of the core's vector geometry. */
function sq(p, q) {
  return (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
}
function dd(p, q) {
  return Math.sqrt(sq(p, q));
}
function jIntersect(a, b, c, e) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - e.y, b2 = e.x - c.x, c2 = c.x * e.y - c.y * e.x;
  const den = a1 * b2 - a2 * b1;
  const x = Math.abs(den) < 1 ? NaN : (b1 * c2 - b2 * c1) / den;
  const y = Math.abs(den) < 1 ? NaN : (c1 * a2 - c2 * a1) / den;
  return pt(x, y);
}
function jCircleLine(line, circle) {
  const [p, q] = line;
  const useX = Math.abs(p.y - q.y) > 1;
  if (!useX && Math.abs(p.x - q.x) <= 1) return null;
  const m = useX ? (p.x - q.x) / (p.y - q.y) : (p.y - q.y) / (p.x - q.x);
  const b = useX ? q.x - m * q.y : q.y - m * q.x;
  const a = useX ? m * (b - circle.x) - circle.y : m * (b - circle.y) - circle.x;
  const cc = useX
    ? circle.y * circle.y + (b - circle.x) ** 2 - circle.r * circle.r
    : circle.x * circle.x + (b - circle.y) ** 2 - circle.r * circle.r;
  const disc = a * a - (1 + m * m) * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t1 = (-a + root) / (1 + m * m), t2 = (-a - root) / (1 + m * m);
  return useX ? [pt(m * t1 + b, t1), pt(m * t2 + b, t2)]
    : [pt(t1, m * t1 + b), pt(t2, m * t2 + b)];
}
function jAngle(p, q, r) {
  const c = (sq(p, q) + sq(p, r) - sq(q, r)) / (2 * dd(p, q) * dd(p, r));
  return Math.acos(c);
}
function jOrientation(p, q, r) {
  const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return v > 0 ? 1 : -1;
}
function jRotate(p, q, angle, dir) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return pt(p.x + c * (q.x - p.x) - dir * s * (q.y - p.y),
    p.y + dir * s * (q.x - p.x) + c * (q.y - p.y));
}
function jNearest(p, a, b) {
  if (sq(a, p) < 0.1) return p;
  const dx = b.x - a.x, dy = b.y - a.y;
  const u = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return pt(a.x + dx * u, a.y + dy * u);
}
function jExcenter(U, V, W) {
  const alpha = (Math.PI - jAngle(V, U, W)) / 2;
  const beta = (Math.PI - jAngle(W, U, V)) / 2;
  const dir = jOrientation(V, U, W);
  return jIntersect(V, jRotate(V, W, alpha, dir), W, jRotate(W, V, beta, -dir));
}
function jOther(points, ref) {
  return dd(points[0], ref) < dd(points[1], ref) ? points[1] : points[0];
}
function appletCompute(raw) {
  /* ArrangeABC, then the exact sequence of fields assigned by Compute(). */
  let A = raw.A.x <= raw.C.x ? raw.A : raw.C;
  let Cc = raw.A.x <= raw.C.x ? raw.C : raw.A;
  let B = raw.B;
  if (raw.B.x < A.x) { B = A; A = raw.B; }
  else if (raw.B.x > Cc.x) { B = Cc; Cc = raw.B; }

  const big = { x: (A.x + Cc.x) / 2, y: (A.y + Cc.y) / 2, r: (Cc.x - A.x) / 2 };
  const rP = Math.abs(B.x - A.x) / 2;
  const mid = { x: A.x + rP, y: A.y, r: rP };
  const D = pt((B.x + Cc.x) / 2, B.y);
  const pts = jCircleLine([D, pt(D.x, D.y + 200)], big);
  if (!pts) return null;
  const E = pts[0].y < D.y ? pts[0] : pts[1];
  const F = jOther(pts, E);
  const K = jOther(jCircleLine([E, B], big), E);
  const L = jOther(jCircleLine([F, B], big), F);
  const vert = jCircleLine([pt(B.x, B.y - 200), B], big);
  if (!vert) return null;
  const M = vert[0].y <= vert[1].y ? vert[0] : vert[1];
  const N = jOther(vert, M);

  const t = mid.r / big.r;
  const h = (t / (1 + t)) * Math.sqrt(2 * (1 - t)) * (Cc.x - A.x);
  const small = { x: B.x, y: B.y - h,
    r: t * (1 - t) / (1 + t) * (Cc.x - A.x) };
  const Ik = jIntersect(K, E, pt(Cc.x, Cc.y), pt(Cc.x, Cc.y - 200));
  const Il = jIntersect(L, F, pt(Cc.x, Cc.y), pt(Cc.x, Cc.y - 200));
  const ex = jExcenter(Ik, B, Il);
  const exR = (dd(ex, jNearest(ex, Ik, B)) + dd(ex, jNearest(ex, B, Il)) +
    dd(ex, jNearest(ex, Il, Ik))) / 3;
  return {
    A, B, C: Cc, D, E, F, K, L, M, N,
    O: pt(big.x, big.y), R: big.r, P: pt(mid.x, mid.y), rP: mid.r,
    Q: pt(small.x, small.y), rQ: small.r,
    Ik, Il, Qp: pt(ex.x, ex.y), rQp: exR,
    rBM: dd(B, M), rB: Math.abs(B.x - K.x),
  };
}

{
  const names = ["A", "B", "C", "D", "E", "F", "K", "L", "M", "N", "O", "P", "Q", "Ik", "Il", "Qp"];
  const errors = Object.fromEntries(names.concat(["R", "rP", "rQ", "rQp", "rBM", "rB"]).map((k) => [k, 0]));
  let compared = 0;
  for (let i = 0; i < configs.length; i++) {
    const a = appletCompute(configs[i]);
    const g = drawings[i];
    if (!a || !g.valid) continue;
    for (const n of names) {
      errors[n] = Math.max(errors[n], d(g[n] ?? (n === "A" || n === "B" || n === "C" ? g[n] : null),
        pt(a[n].x, a[n].y)));
    }
    errors.O = Math.max(errors.O, d(g.O, a.O));
    errors.P = Math.max(errors.P, d(g.P, a.P));
    errors.Q = Math.max(errors.Q, d(g.Q, a.Q));
    errors.Ik = Math.max(errors.Ik, d(g.Ik, a.Ik));
    errors.Il = Math.max(errors.Il, d(g.Il, a.Il));
    errors.Qp = Math.max(errors.Qp, d(pt(g.Qp.x, g.Qp.y), a.Qp));
    errors.R = Math.max(errors.R, Math.abs(g.R - a.R));
    errors.rP = Math.max(errors.rP, Math.abs(g.rP - a.rP));
    errors.rQ = Math.max(errors.rQ, Math.abs(g.rQ - a.rQ));
    errors.rQp = Math.max(errors.rQp, Math.abs(g.Qp.r - a.rQp));
    errors.rBM = Math.max(errors.rBM, Math.abs(g.circleMN.r - a.rBM));
    errors.rB = Math.max(errors.rB, Math.abs(g.Circleb.r - a.rB));
    compared++;
  }
  check("every configuration was compared with the applet's method", compared === configs.length,
    `${compared} of ${configs.length}`);
  for (const n of names) {
    check(`applet's ${n} matches the core in all ${compared} configurations`,
      near(errors[n], 1e-6), `largest error ${errors[n]}`);
  }
  for (const n of ["R", "rP", "rQ", "rQp", "rBM", "rB"]) {
    check(`applet's ${n} matches the core`, near(errors[n], 1e-6), `largest error ${errors[n]}`);
  }
}

done("inversion-in-circle-and-isosceles-2");
