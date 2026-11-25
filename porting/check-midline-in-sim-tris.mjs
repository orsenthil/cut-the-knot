#!/usr/bin/env node
"use strict";

/*
 * Logic test for midline-in-sim-tris/midline-in-sim-tris-core.js.
 *
 *   node porting/check-midline-in-sim-tris.mjs
 *
 * The page's proposition on 200,000 random triangles and random third
 * triangles (outward and inward, any size, any turn): DE is parallel to CN and
 * DE = CN / 2 (indeed D - E = (N - C) / 2), and the hint's EF is parallel to
 * AN and half as long, DF to AC (the midline), so DEF is similar to CNA with
 * ratio 1/2. The applet's own construction (the angles of triangle BLC
 * rotated at A and B and intersected) is written a second time and compared
 * with the spiral similarity for K and N on 50,000 cases. The three triangles are
 * similar and similarly turned. The starting picture's points are the
 * applet's.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("midline-in-sim-tris/midline-in-sim-tris-core.js", "MidlineCore");
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const len = (p) => Math.hypot(p.x, p.y);
const cross = (p, q) => p.x * q.y - p.y * q.x;
const dot = (p, q) => p.x * q.x + p.y * q.y;
const close = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/* ------------------------------------------------------------ 1. the starting picture */
{
  const s = C.start();
  equal("the board is 400 by 300", [C.WIDTH, C.HEIGHT], [400, 300]);
  equal("the applet's first positions: C and B along the top at 1/5 and 4/5, A at 2/3 and 7/8 (whole pixels), L above BC", [s.C, s.B, s.A, s.L], [{ x: 80, y: 75 }, { x: 320, y: 75 }, { x: 266, y: 262 }, { x: 200, y: 37 }]);
  check("the first picture draws the triangles outward", C.outward(s));
  const c = C.compute(s), cl = C.claim(c);
  equal("the first picture: DE parallel to CN and half as long", [cl.parallel, close(cl.ratio, 0.5), cl.vectorHalf], [true, true, true]);
  equal("D, E, F are midpoints of AB, KL, BC", [c.D, c.F], [{ x: (s.A.x + s.B.x) / 2, y: (s.A.y + s.B.y) / 2 }, { x: 200, y: 75 }]);
  const m = C.move(s, "A", -50, 999);
  equal("move keeps a point on the board", [m.A, s.A.x], [{ x: 0, y: 300 }, 266]);
  equal("move refuses nonsense", [C.move(s, "Q", 1, 1), C.move(s, "A", NaN, 1)], [null, null]);
  equal("with B = C there is no construction", C.compute({ ...s, C: s.B }), null);
}

/* ------------------------------------------------------------ 2. the proposition, 200,000 triangles */
{
  const r = rng(2001);
  let n = 0, bad = { vec: 0, par: 0, ef: 0, df: 0, sim: 0, tri: 0, sym: 0 }, outward = 0, inward = 0;
  for (let t = 0; t < 200000; t++) {
    const P = () => ({ x: r() * 400, y: r() * 300 });
    const s = { A: P(), B: P(), C: P(), L: P() };
    const c = C.compute(s);
    if (!c) continue;
    n++;
    if (C.outward(s)) outward++; else inward++;
    const cl = C.claim(c);
    if (!cl.vectorHalf) bad.vec++;
    if (!cl.parallel) bad.par++;
    // the hint: EF parallel to AN, half as long; DF is the midline AC / 2
    const ef = sub(c.E, c.F), an = sub(c.N, c.A), df = sub(c.D, c.F), ac = sub(c.C, c.A);
    if (len(ef) > 1e-6 && !(Math.abs(cross(ef, an)) <= 1e-7 * Math.max(1, len(an) ** 2) && close(len(ef), len(an) / 2, 1e-7))) bad.ef++;
    if (!(Math.abs(cross(df, ac)) <= 1e-7 * Math.max(1, len(ac) ** 2) && close(len(df), len(ac) / 2, 1e-7))) bad.df++;
    // DEF similar to CNA with ratio 1/2 (D to C, E to N, F to A): sides in ratio 1/2
    const dFE = len(sub(c.D, c.E)), dEF = len(sub(c.E, c.F)), dDF = len(sub(c.D, c.F));
    if (!(close(dFE * 2, len(sub(c.N, c.C)), 1e-7) && close(dEF * 2, len(sub(c.N, c.A)), 1e-7) && close(dDF * 2, len(sub(c.C, c.A)), 1e-7))) bad.sim++;
    // the three triangles are similar and similarly turned: the same z carries each base to its apex
    const z = c.z, mulz = (p) => ({ x: z.x * p.x - z.y * p.y, y: z.x * p.y + z.y * p.x });
    const chk = (base1, base2, apex) => { const d = sub(base2, base1), w = mulz(d); return close(base1.x + w.x, apex.x, 1e-7) && close(base1.y + w.y, apex.y, 1e-7); };
    if (!(chk(c.A, c.B, c.K) && chk(c.B, c.C, c.L) && chk(c.C, c.A, c.N))) bad.tri++;
  }
  console.log(`  (${n.toLocaleString()} random cases: ${outward.toLocaleString()} outward, ${inward.toLocaleString()} inward)`);
  equal("D - E = (N - C) / 2 for every case, outward and inward", bad.vec, 0);
  equal("DE parallel to CN", bad.par, 0);
  equal("EF parallel to AN and half as long", bad.ef, 0);
  equal("DF parallel to AC and half as long (the midline of ABC)", bad.df, 0);
  equal("DEF similar to CNA with ratio 1/2", bad.sim, 0);
  equal("AKB, BLC and CNA are the same spiral similarity of their bases", bad.tri, 0);
  check("both outward and inward cases were tried", outward > 20000 && inward > 20000);
}

/* ------------------------- 3. the applet's own construction of K and N, from angles */
{
  // Signed angle from ray P->Q to ray P->R, in (-pi, pi]
  const ang = (P, Q, R) => Math.atan2(cross(sub(Q, P), sub(R, P)), dot(sub(Q, P), sub(R, P)));
  const rotate = (centre, p, a) => { const d = sub(p, centre), c = Math.cos(a), s = Math.sin(a); return { x: centre.x + d.x * c - d.y * s, y: centre.y + d.x * s + d.y * c }; };
  const intersect = (p1, q1, p2, q2) => {
    const d1 = sub(q1, p1), d2 = sub(q2, p2), den = cross(d1, d2);
    const t = cross(sub(p2, p1), d2) / den;
    return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
  };
  const r = rng(77);
  let bad = 0, n = 0;
  for (let t = 0; t < 50000; t++) {
    const P = () => ({ x: r() * 400, y: r() * 300 });
    const s = { A: P(), B: P(), C: P(), L: P() };
    const c = C.compute(s);
    if (!c) continue;
    const { A, B, C: Cc, L } = s;
    const a1 = ang(B, Cc, L), a3 = ang(Cc, B, L);        // the applet's two signed angles of triangle BLC
    // K: rotate B about A by a1 and A about B by a3 (the angles of BLC carried to AKB), intersect the two rays
    const k = intersect(A, rotate(A, B, a1), B, rotate(B, A, a3));
    const nn = intersect(Cc, rotate(Cc, A, a1), A, rotate(A, Cc, a3));
    if (!Number.isFinite(k.x) || !Number.isFinite(nn.x)) continue;
    n++;
    if (Math.hypot(k.x - c.K.x, k.y - c.K.y) > 1e-5 * Math.max(1, len(c.K)) || Math.hypot(nn.x - c.N.x, nn.y - c.N.y) > 1e-5 * Math.max(1, len(c.N))) bad++;
  }
  equal(`the applet's angle-and-intersection construction gives the same K and N on ${n.toLocaleString()} cases`, bad, 0);
}

/* ------------------------------------------------------------ 4. special cases */
{
  // equilateral triangles built outward on a unit square-ish: ABC right isoceles, z = e^(i pi/3)
  const s = { A: { x: 0, y: 0 }, B: { x: 100, y: 0 }, C: { x: 0, y: 100 }, L: { x: 100 + (-100 * 0.5 - 100 * Math.sqrt(3) / 2) * 0 , y: 0 } };
  // z = 1: L = C, triangles degenerate (K = B, N = A): DE = midpoint of AB to mid of BC
  const z1 = { ...s, L: s.C };
  const c = C.compute(z1), cl = C.claim(c);
  equal("z = 1 (L = C): K = B, N = A, and DE = CN / 2 still", [c.K, c.N, cl.vectorHalf], [{ x: 100, y: 0 }, { x: 0, y: 0 }, true]);
  // L on the line BC (z real): flat triangles, the proposition still holds
  const flat = { ...s, L: { x: 50, y: 50 } };
  equal("L on the line BC: flat triangles, DE still half of CN", C.claim(C.compute(flat)).vectorHalf, true);
  // z = 0 (L = B): all three apexes coincide with the base start, K = A, N = C: E = mid(A, B) = D, so DE = 0 = CN / ... N = C
  const zero = C.compute({ ...s, L: s.B });
  equal("z = 0 (L = B): K = A, N = C, so D = E and CN = 0", [zero.K, zero.N, zero.D, zero.E], [s.A, s.C, { x: 50, y: 0 }, { x: 50, y: 0 }]);
  equal("the ratio |DE|/|CN| is undefined when CN = 0", C.claim(zero).ratio, null);
}

done("midline-in-sim-tris");
