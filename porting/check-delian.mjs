#!/usr/bin/env node
"use strict";

/*
 * Logic test for delian/delian-core.js.
 *
 *   node porting/check-delian.mjs
 *
 * For every N the applet offers (2..20) and every division k: the points the
 * construction gives on AB (the radial through the k-th division of BC, its
 * intersections with DF and BF, and the two parallels) lie exactly on the
 * projective function (1 + (sqrt 2 - 1) t) / (1 - (1 - sqrt 2/2) t) at t = k/N,
 * found by a second, independent route (homogeneous coordinates), and the two
 * families of points mirror each other (AS_i = AT_(N-i)). The reader's claims are
 * then tested against it: AX = sqrt 2 exactly (a compass arc of length AE), the
 * midpoint division is exactly sqrt 2 when N is even, the points are NOT 2^(k/N)
 * (the worst gap over N = 2..20 and k, and over all of [0, 1], is under 0.0024),
 * for N = 3 the "cube root of 2" point is 1.26120, not 1.25992, and consecutive
 * ratios are not constant; and the reason no construction can succeed:
 * x^3 - 2 has no rational root.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("delian/delian-core.js", "DelianCore");
const near = (a, b, e = 1e-12) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));

// A second route to the same points, by homogeneous coordinates (cross products of lines and points).
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const pt = (x, y) => [x, y, 1];
const line = (p, q) => cross(p, q);
const meet = (l, m) => { const p = cross(l, m); return [p[0] / p[2], p[1] / p[2]]; };
function viaHomogeneous(n, i) {
  const s = Math.SQRT2;
  const A = pt(0, 2), B = pt(0, 0), D = pt(0, 1), F = pt(-s / 2, 2 - s);
  const P = pt(-1 + i / n, 0);
  const radial = line(A, P);
  const Q = pt(...meet(radial, line(D, F))), R = pt(...meet(radial, line(B, F)));
  // the line through Q parallel to BF: the line Q + (F - B) direction, built as the join of Q and the point at infinity of BF
  const inf = (p, q) => [q[0] / q[2] - p[0] / p[2], q[1] / q[2] - p[1] / p[2], 0];
  const S = meet(line(Q, inf(B, F)), line(A, B)), T = meet(line(R, inf(D, F)), line(A, B));
  return { S: 2 - S[1], T: 2 - T[1] };
}

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  check("a new game is not over", C.result(s) === null);
  equal("opens at N = 2", [s.n, s.moves], [2, 0]);
  const m = C.move(s, { type: "n", dir: 1 });
  check("a move changes N and marks the demo explored", m.n === 3 && m.explored && m.moves === 1);
  check("the old position is untouched", s.n === 2 && s.moves === 0);
  equal("N runs from 2 to 20", [C.move(s, { type: "n", dir: -1 }), C.move(C.move(s, { type: "n", value: 20 }), { type: "n", dir: 1 }), C.move(s, { type: "n", value: 21 }), C.move(s, { type: "n", value: 1 })], [null, null, null, null]);
  check("bad moves are refused", C.move(s, null) === null && C.move(s, { type: "n", value: "x" }) === null && C.move(s, { type: "nope" }) === null && C.move(s, { type: "n", value: 20 }).n === 20);
  const f = C.frame();
  equal("the frame: AB = 2, BC = 1, D the midpoint of AB", [f.A[1] - f.B[1], f.B[0] - f.C[0], f.D[1]], [2, 1, 1]);
  check("AE = sqrt 2 where DE is perpendicular to AB at D with DE = AD = 1", f.E[1] === f.D[1] && near(Math.abs(f.E[0] - f.D[0]), 1) && near(Math.hypot(f.E[0] - f.A[0], f.E[1] - f.A[1]), Math.hypot(1, 1)));
  check("AX = sqrt 2: the arc of radius AE about A meets AB at X", near(C.fromA(f.X), Math.SQRT2));
  check("F lies on AC and on the parallel to BC through X", near((f.F[1] - f.A[1]) * (f.C[0] - f.A[0]) - (f.F[0] - f.A[0]) * (f.C[1] - f.A[1]), 0) && near(f.F[1], f.X[1]));
  const g = C.cubeRootOfTwoIsNotConstructible();
  check("x^3 - 2 has no rational root, so no ruler-and-compass doubling of the cube", g.roots.length === 0 && g.irreducibleCubic);
}

/* -------------------------------------------------- 2. every case, where small */
{
  let bad = 0, n = 0, worstGap = 0, worstAt = null;
  for (let N = C.MIN_N; N <= C.MAX_N; N++) {
    const c = C.construct(N);
    for (const d of c.divisions) {
      n++;
      const t = d.i / N;
      const h = viaHomogeneous(N, d.i);
      if (!near(d.fromAS, h.S) || !near(d.fromAT, h.T)) bad++; // two routes agree
      if (!near(d.fromAT, C.projective(t))) bad++; // the closed form
      if (!near(d.fromAS, C.projective(1 - t))) bad++; // the mirrored family: AS_i = AT_(N-i) = f(1 - t)
      if (d.fromAT < 1 - 1e-12 || d.fromAT > 2 + 1e-12) bad++; // the points lie on BD
    }
    for (const r of C.positions(N)) if (Math.abs(r.error) > worstGap) { worstGap = Math.abs(r.error); worstAt = [N, r.k]; }
  }
  equal(`the construction is exactly the projective function f(k/N), by two independent routes (${n} divisions, N = 2..20)`, bad, 0);
  check(`the points are within ${worstGap.toFixed(5)} of 2^(k/N) at worst (N = ${worstAt[0]}, k = ${worstAt[1]}): close, but not equal`, worstGap > 1e-4 && worstGap < 0.0024);

  // Equality only at t = 0, 1/2, 1.
  equal("f(0) = 1, f(1/2) = sqrt 2 and f(1) = 2 exactly", [C.projective(0), near(C.projective(0.5), Math.SQRT2), near(C.projective(1), 2)], [1, true, true]);
  let equalAt = [];
  for (let i = 0; i <= 1000; i++) { const t = i / 1000; if (Math.abs(C.projective(t) - Math.pow(2, t)) < 1e-9) equalAt.push(t); }
  equal("f(t) and 2^t agree at t = 0, 1/2 and 1 only (on a grid of 1001 points)", equalAt, [0, 0.5, 1]);
  const w = C.worstAnywhere(100000);
  check(`the greatest gap anywhere is ${w.max.toFixed(5)} near t = ${w.at.toFixed(2)}: under 0.14% of the length`, w.max < 0.0024 && w.max > 0.002 && w.max / Math.pow(2, w.at) < 0.0014);

  // The claims on the page.
  // 1. The midpoint division is exactly sqrt 2 for even N.
  let midOk = true;
  for (let N = 2; N <= 20; N += 2) if (!near(C.construct(N).divisions[N / 2].fromAT, Math.SQRT2)) midOk = false;
  check("for even N the middle radial gives exactly sqrt 2 (the one point that works)", midOk);
  // 2. For N = 3 (the cube root): the point is 1.26120, not 1.25992.
  const three = C.positions(3);
  equal("N = 3: the 'cube root of 2' point is 1.26120, the cube root is 1.25992", [three[1].got.toFixed(5), three[1].claimed.toFixed(5)], ["1.26120", "1.25992"]);
  check("and its cube is not 2 (it is 2.0061...)", Math.abs(Math.pow(three[1].got, 3) - 2) > 0.005 && Math.pow(three[1].got, 3) > 2);
  // 3. Consecutive ratios are not constant (they would be 2^(1/N) in a geometric progression).
  let nonGeometric = true;
  for (let N = 3; N <= 20; N++) {
    const r = C.positions(N).map((x) => x.got);
    const ratios = r.slice(1).map((v, i) => v / r[i]);
    if (Math.max(...ratios) - Math.min(...ratios) < 1e-5) nonGeometric = false;
  }
  check("the successive ratios are not all equal for any N from 3 to 20: not a geometric progression", nonGeometric);
  // N = 2 is the one case that does work (the single mean proportional is the geometric mean sqrt 2).
  equal("N = 2 works: the one mean proportional is sqrt 2", C.positions(2).map((r) => near(r.got, r.claimed)), [true, true, true]);
  // The reader's identity: AX^2 = AD * AB (the geometric mean) holds for X.
  check("AX^2 = AD x AB (the page's claim for the middle point)", near(C.fromA(C.frame().X) ** 2, 1 * 2));
  // The mirror: the points from the DF family and the BF family are reflections k <-> N - k.
  let mirror = true;
  for (let N = 3; N <= 20; N++) { const c = C.construct(N); for (let i = 1; i < N; i++) if (!near(c.divisions[i].fromAS, c.divisions[N - i].fromAT)) mirror = false; }
  check("the two families of points mirror each other (AS_i = AT_(N-i))", mirror);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // The applet's own pixel arithmetic: u = min(W - 2*20, H/2 - 20) or so; the geometry is similar to ours at any scale.
  const u = 100;
  const toPx = (p, B) => [B[0] + p[0] * u, B[1] - p[1] * u];
  const B = [250, 280];
  const f = C.frame();
  const A = toPx(f.A, B), D = toPx(f.D, B), F = toPx(f.F, B);
  const dd = Math.hypot(A[0] - B[0], A[1] - B[1]);
  equal("scaled to pixels, AB is twice BC", [dd / u, Math.hypot(toPx(f.C, B)[0] - B[0], 0) / u], [2, 1]);
  // The applet's F: x = C.x + (1 - sqrt2/2) u, y = A.y + sqrt2 u  (screen y down, C at the left).
  const applet = [toPx(f.C, B)[0] + (1 - Math.SQRT2 / 2) * u, A[1] + Math.SQRT2 * u];
  check("the applet's F (C.x + (1 - sqrt2/2) u, A.y + sqrt2 u) is our F", near(applet[0], F[0], 1e-9) && near(applet[1], F[1], 1e-9));
  check("the applet's D is the midpoint of AB", near(D[1], (A[1] + B[1]) / 2));
  // The applet draws N radials: to the points C + (i/N) u for i = 0..N-1, and the point i = N (B) is AB itself.
  equal("N radials for N divisions, N = 2 and 20", [C.construct(2).divisions.length, C.construct(20).divisions.length], [2, 20]);
}

done("delian");
