#!/usr/bin/env node
"use strict";

/*
 * Logic test for malfatti/malfatti-core.js.
 *
 *   node porting/check-malfatti.mjs
 *
 * 1. A second, literal transcription of the applet's bytecode (GeoSDoub,
 *    Inversion.Tangent, Tangents.GetInternalTangents and MalfattiCanvas.Compute)
 *    compared with the core over a grid of triangles, including symmetric,
 *    right, obtuse, thin and randomly chosen ones.
 * 2. The page's claims: the three circles touch each other and two sides each,
 *    the second tangents concur, the quadrilaterals are tangential (Pitot),
 *    and the equilateral incircle packing beats the Malfatti circles.
 * 3. The illustration's own rules: initial point layout, drags, options,
 *    clamping, reset, and what happens for a collapsed triangle.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("malfatti/malfatti-core.js", "MalfattiCore");

/* ------------------------------------------------ 1. second transcription */
/*
 * Written straight from javap of the original classes, deliberately in a
 * different style from the core (arrays of two coordinates, explicit local
 * variables, the applet's own branch order) so a shared mistake is less likely.
 */

const R = {};
R.d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
R.len = (p, q) => Math.sqrt(R.d2(p, q));
R.P = (x, y) => [x, y];
R.orient = (a, b, c) => (c[0] * (a[1] - b[1]) + c[1] * (b[0] - a[0])
  + a[0] * b[1] - b[0] * a[1] > 0 ? 1 : -1);
R.turn = (c, p, t, s) => {
  const co = Math.cos(t), si = Math.sin(t);
  return R.P(c[0] + co * (p[0] - c[0]) - s * si * (p[1] - c[1]),
    c[1] + s * si * (p[0] - c[0]) + co * (p[1] - c[1]));
};
R.corner = (a, b, c) => {
  const side = (R.d2(a, b) + R.d2(a, c) - R.d2(b, c)) / 2;
  return Math.acos(Math.max(-1, Math.min(1, side / (R.len(a, b) * R.len(a, c)))));
};
R.cross = (a, b, c, d) => {
  const u = a[1] - b[1], v = b[0] - a[0], w = a[0] * b[1] - a[1] * b[0];
  const x = c[1] - d[1], y = d[0] - c[0], z = c[0] * d[1] - c[1] * d[0];
  const det = u * y - x * v;
  if (Math.abs(det) < 1) return [NaN, NaN];
  return [(v * z - y * w) / det, (w * x - z * u) / det];
};
R.near = (p, a, b) => {
  const vx = b[0] - a[0], vy = b[1] - a[1], den = R.d2(a, b);
  if (den < 0.1) return p;
  const t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / den;
  return R.P(a[0] + vx * t, a[1] + vy * t);
};
R.pLine = (p, l) => R.len(p, R.near(p, l[0], l[1]));
R.inC = (a, b, c) => {
  const t1 = R.corner(a, b, c) / 2, t2 = R.corner(b, c, a) / 2;
  const s = R.orient(a, b, c);
  const u = R.turn(a, b, t1, s), v = R.turn(b, c, t2, s);
  return R.cross(a, u, b, v);
};
R.bis = (a, b, c) => R.cross(a, R.turn(a, b, R.corner(a, b, c) / 2, R.orient(a, b, c)), b, c);
R.circleCuts = (c, e) => {
  const dx = Math.abs(c[0] - e[0]), dy = Math.abs(c[1] - e[1]);
  if (dx > 1) {
    const m = -(c[1] - e[1]) / (c[0] - e[0]);
    const b = (c[0] ** 2 - e[0] ** 2 + c[1] ** 2 - e[1] ** 2 - c[2] ** 2 + e[2] ** 2) / 2 / (c[0] - e[0]);
    const off = b - c[0], A = m * m + 1;
    const p = m * off - c[1], q = off * off + c[1] ** 2 - c[2] ** 2;
    const disc = p * p - A * q;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    return [R.P(m * ((-p + s) / A) + b, (-p + s) / A),
      R.P(m * ((-p - s) / A) + b, (-p - s) / A)];
  }
  if (dy > 1) {
    const m = -(c[0] - e[0]) / (c[1] - e[1]);
    const b = (c[1] ** 2 - e[1] ** 2 + c[0] ** 2 - e[0] ** 2 - c[2] ** 2 + e[2] ** 2) / 2 / (c[1] - e[1]);
    const off = b - c[1], A = m * m + 1;
    const p = m * off - c[0], q = off * off + c[0] ** 2 - c[2] ** 2;
    const disc = p * p - A * q;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    return [R.P((-p + s) / A, m * ((-p + s) / A) + b),
      R.P((-p - s) / A, m * ((-p - s) / A) + b)];
  }
  return [[NaN, NaN], [NaN, NaN]];
};
R.fromPoint = (c, p) => {
  const d2 = R.d2(c, p) - c[2] ** 2;
  if (d2 < 0) return null;
  const cuts = R.circleCuts(c, [p[0], p[1], Math.sqrt(d2)]);
  if (!cuts) return null;
  return [cuts[0], cuts[1]];
};
R.inner = (c, e) => {
  const r1 = c[2], r2 = e[2], sum = r1 + r2;
  const ts = R.fromPoint([c[0], c[1], sum], e);
  if (!ts) return null;
  return ts.map((q) => [R.P(c[0] + (q[0] - c[0]) * r1 / sum,
    c[1] + (q[1] - c[1]) * r1 / sum),
  R.P(e[0] - (q[0] - c[0]) * r2 / sum,
    e[1] - (q[1] - c[1]) * r2 / sum)]);
};
R.homo = (c, e) => {
  const sum = c[2] + e[2], t1 = c[2] / sum, t2 = e[2] / sum;
  return R.P(t2 * c[0] + t1 * e[0], t2 * c[1] + t1 * e[1]);
};
R.shared = (c, e) => {
  const h = R.homo(c, e);
  return [h, R.P(h[0] + c[1] - e[1], h[1] - c[0] + e[0])];
};
R.second = (c, e, inc) => {
  if (!c || !e) return null;
  let ts = null;
  try { ts = R.inner(c, e); } catch (err) { ts = null; }
  if (!ts) return Math.abs(R.len(c, e) - c[2] - e[2]) < 1 ? R.shared(c, e) : null;
  if (R.len(ts[0][0], ts[0][1]) < 2) return R.shared(c, e);
  for (let i = 0; i < 2; i++) if (inc && R.pLine(inc, ts[i]) > 1) return ts[i];
  return R.shared(c, e);
};
R.meet3 = (lines) => {
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    if (!lines[i] || !lines[j]) continue;
    const p = R.cross(lines[i][0], lines[i][1], lines[j][0], lines[j][1]);
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    sx += p[0]; sy += p[1]; n++;
  }
  return n ? R.P(sx / n, sy / n) : [NaN, NaN];
};
R.triCircle = (a, b, c) => {
  const i = R.inC(a, b, c);
  const r = (R.len(i, R.near(i, b, c)) + R.len(i, R.near(i, c, a))
    + R.len(i, R.near(i, a, b))) / 3;
  return [i[0], i[1], r];
};
R.fourCircle = (a, b, c, d) => {
  // MalfattiCanvas.BisectorCandidate: intersect the two bisectors themselves.
  const bc = (p, q, r, s) => {
    const u = R.bis(q, p, r), v = R.bis(p, q, s);
    return R.cross(q, u, p, v);
  };
  const k = [bc(b, c, d, a), bc(c, d, a, b), bc(d, a, b, c), bc(a, b, c, d)];
  const x = (k[0][0] + k[1][0] + k[2][0] + k[3][0]) / 4;
  const y = (k[0][1] + k[1][1] + k[2][1] + k[3][1]) / 4;
  const m = R.P(x, y);
  const r = (R.pLine(m, [c, d]) + R.pLine(m, [d, a]) + R.pLine(m, [a, b])
    + R.pLine(m, [b, c])) / 4;
  return [x, y, r];
};
R.compute = (s) => {
  const a = [s.A.x, s.A.y], b = [s.B.x, s.B.y], c = [s.C.x, s.C.y];
  const I = R.triCircle(a, b, c);
  const IAB = R.triCircle(I, a, b), IBC = R.triCircle(I, b, c), ICA = R.triCircle(I, c, a);
  const lAB = R.second(IBC, ICA, I), lBC = R.second(ICA, IAB, I), lCA = R.second(IAB, IBC, I);
  const M = R.near(IBC, b, c), T = R.near(ICA, c, a), P = R.near(IAB, a, b);
  const L = R.meet3([lAB, lBC, lCA]);
  const A = R.fourCircle(L, T, a, P), B = R.fourCircle(L, P, b, M), Cc = R.fourCircle(L, M, c, T);
  return { A, B, C: Cc, L, M, T, P, I, IAB, IBC, ICA, lAB, lBC, lCA };
};

/* ------------------------------------------------------------- comparison */

const toArr = (p) => [p.x, p.y];
const toC = (c) => [c.x, c.y, c.r];
const same = (a, b, tol = 1e-6) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Number.isNaN(a[i]) || Number.isNaN(b[i])) {
      if (!(Number.isNaN(a[i]) && Number.isNaN(b[i]))) return false;
    } else if (!Number.isFinite(a[i]) || !Number.isFinite(b[i]) || Math.abs(a[i] - b[i]) > tol) {
      return false;
    }
  }
  return true;
};

let seed = 20261128;
const rand = () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 4294967296;
};
const point = () => ({ x: 30 + rand() * 340, y: 30 + rand() * 300 });
const setups = [C.start()];
setups.push(C.move(C.start(), "C", { x: 200, y: 300 - 280 * Math.sqrt(3) / 2 })); // equilateral
setups.push(C.move(C.start(), "C", { x: 333, y: 34 }));                             // right-ish
setups.push(C.move(C.start(), "C", { x: 200, y: 280 }));                            // squat
setups.push(C.move(C.start(), "C", { x: 60, y: 40 }));                              // sharp
setups.push(C.move(C.start(), "C", { x: 67, y: 299 }));                             // thin
for (let i = 0; i < 160; i++) {
  let s = C.move(C.start(), "A", point());
  s = C.move(s, "B", point());
  s = C.move(s, "C", point());
  setups.push(s);
}

let compared = 0;
let worst = 0;
let mismatches = 0;
for (const s of setups) {
  const g = C.geometry(s), ref = R.compute(s);
  const pairs = [
    [g.I, ref.I], [g.IAB, ref.IAB], [g.IBC, ref.IBC], [g.ICA, ref.ICA],
    [g.circleA, ref.A], [g.circleB, ref.B], [g.circleC, ref.C],
    [g.L, ref.L], [g.M, ref.M], [g.P, ref.P], [g.T, ref.T],
    [g.lineAB && g.lineAB[0], ref.lAB && ref.lAB[0]],
    [g.lineAB && g.lineAB[1], ref.lAB && ref.lAB[1]],
    [g.lineBC && g.lineBC[0], ref.lBC && ref.lBC[0]],
    [g.lineBC && g.lineBC[1], ref.lBC && ref.lBC[1]],
    [g.lineCA && g.lineCA[0], ref.lCA && ref.lCA[0]],
    [g.lineCA && g.lineCA[1], ref.lCA && ref.lCA[1]],
  ];
  pairs.forEach(([a, b], i) => {
    const av = a ? (a.r === undefined ? toArr(a) : toC(a)) : null;
    const bv = b ? (b.length === 3 ? b : b.slice(0, 2)) : null;
    if (!same(av || [], bv || [], 1e-6)) {
      mismatches++;
      check(`transcription case ${compared} field ${i}`, false,
        `core ${JSON.stringify(av)} vs bytecode ${JSON.stringify(bv)}`);
    }
    if (av && bv && av.every(Number.isFinite) && bv.every(Number.isFinite)) {
      for (let k = 0; k < av.length; k++) worst = Math.max(worst, Math.abs(av[k] - bv[k]));
    }
  });
  compared++;
}
check(`second transcription matches the core on all ${compared} configurations`, mismatches === 0);
check("transcription agreement is exact to 1e-6 (worst " + worst.toExponential(2) + ")", worst < 1e-6);

/* ------------------------------------------------------- 2. the page's claims */

let good = 0, degenerate = 0;
for (const s of setups) {
  const cl = C.claims(s);
  if (!cl.valid || !Number.isFinite(cl.maltattiArea)) { degenerate++; continue; }
  if (cl.touchesEachOther.every(Boolean) && cl.touchesSides.every(Boolean)
    && cl.quadIncircle.every(Boolean) && cl.pitot.every(Boolean) && cl.concurrent) good++;
  else check("construction claims for one triangle", false, JSON.stringify(cl));
}
check(`Malfatti circles and tangential quadrilaterals (${good} triangles, ${degenerate} skipped)`, good > 120);

// Equilateral: exact radii and the Lob & Richmond counterexample.
const side = 280, hgt = side * Math.sqrt(3) / 2;
const eq = { A: { x: 60, y: 300 }, B: { x: 340, y: 300 }, C: { x: 200, y: 300 - hgt },
  options: {}, explored: true };
const eqGeom = C.geometry(eq), equalClaims = C.claims(eq);
const predicted = side * (Math.sqrt(3) - 1) / 4;
check("equilateral Malfatti radius is s(sqrt(3)-1)/4",
  [eqGeom.circleA.r, eqGeom.circleB.r, eqGeom.circleC.r].every((r) => Math.abs(r - predicted) < 1e-6));
check("equilateral Malfatti radii satisfy the page's pairwise tangency claim",
  equalClaims.touchesEachOther.every(Boolean));
const rin = side * Math.sqrt(3) / 6, corner = rin / 3;
const maltArea = Math.PI * 3 * predicted ** 2;
const packedArea = Math.PI * (rin ** 2 + 2 * corner ** 2);
check("the incircle plus two corner circles beat Malfatti in an equilateral triangle",
  packedArea > maltArea, `packed ${packedArea.toFixed(1)} vs Malfatti ${maltArea.toFixed(1)}`);
check("the core reports the same equilateral areas",
  Math.abs(equalClaims.maltattiArea - maltArea) < 0.01);
check("the equilateral gain is about 1.36 percent",
  Math.abs((packedArea / maltArea - 1) * 100 - 1.36) < 0.05);

// A survey of the strong "Malfatti circles never solve the marble problem"
// claim: use the incircle and the two sharpest corners when those corner
// circles are disjoint. This supports the theorem; it cannot prove it.
let packedWins = 0, packable = 0;
for (const s of setups.slice(1)) {
  const g = C.geometry(s), cl = C.claims(s);
  if (!cl.valid) continue;
  const cc = g.I;
  const angles = [g.A, g.B, g.C].map((v) => {
    const other = [g.A, g.B, g.C].filter((p) => p !== v);
    const sn = Math.sin(C.util.angle(v, cc, other[0]));
    return { v: v, r: cc.r * (1 - sn) / (1 + sn), s: sn };
  }).sort((p, q) => p.s - q.s);
  const c1 = angles[0], c2 = angles[1];
  if (!(c1.r > 0 && c2.r > 0)) continue;
  const center = (o) => {
    // The centre of a corner circle lies on the bisector from the vertex to
    // the incenter, at distance r/sin(half-angle) from the vertex.
    const dv = { x: cc.x - o.v.x, y: cc.y - o.v.y }, nv = Math.hypot(dv.x, dv.y);
    return { x: o.v.x + dv.x / nv * (o.r / o.s), y: o.v.y + dv.y / nv * (o.r / o.s) };
  };
  const p1 = center(c1), p2 = center(c2);
  if (C.util.dist(p1, p2) <= c1.r + c2.r + 0.01) continue;
  packable++;
  const alt = Math.PI * (cc.r ** 2 + c1.r ** 2 + c2.r ** 2);
  if (alt > cl.maltattiArea) packedWins++;
}
check(`incircle packing beats Malfatti in ${packedWins} of ${packable} packable triangles`,
  packable > 80 && packedWins === packable);

/* ------------------------------------------- 3. the illustration's own rules */

const fresh = C.start();
check("the applet starts at A=(w/2-w/3, h/2+120)", fresh.A.x === 400 / 2 - 400 / 3 && fresh.A.y === 180 + 120);
check("the applet starts at B=(w/2+w/3, h/2+120)", fresh.B.x === 400 / 2 + 400 / 3 && fresh.B.y === 180 + 120);
check("the applet's C uses cos(60), sin(60) and the 120/2 offset",
  Math.abs(fresh.C.x - (200 + (400 / 3) * 0.5)) < 1e-9
  && Math.abs(fresh.C.y - (180 - (400 / 3) * Math.sin(Math.PI / 3) - 60)) < 1e-9);
check("all four applet checkboxes start unchecked", C.OPTION_KEYS.every((k) => !fresh.options[k]));
const moved = C.move(fresh, "A", { x: 100, y: 250 });
check("a drag moves only the named corner", moved.A.x === 100 && moved.A.y === 250
  && moved.B.x === fresh.B.x && moved.C.y === fresh.C.y);
check("a drag is a new object and marks the picture explored",
  moved !== fresh && !fresh.explored && moved.explored);
check("an illegal corner or a non-finite point is refused",
  C.move(moved, "D", { x: 1, y: 2 }) === moved && C.move(moved, "A", { x: NaN, y: 1 }) === moved);
const toggled = C.setOption(moved, "secondTangents", true);
check("a checkbox changes only that option", toggled.options.secondTangents
  && !toggled.options.names && moved.options.secondTangents === false);
check("an unknown checkbox is refused", C.setOption(toggled, "hint", true) === toggled);
check("reset restores the corners but keeps the options",
  C.reset(toggled).A.x === fresh.A.x && C.reset(toggled).options.secondTangents === true);
check("clamp keeps a dragged handle inside the board", C.clamp({ x: -5, y: 500 }).x === 14
  && C.clamp({ x: -5, y: 500 }).y === 344);
const pos = C.position(moved);
check("the saved position is plain board data, not screen pixels",
  pos.A.x === 100 && pos.A.y === 250 && Array.isArray(pos.circles) && pos.circles.length === 3);
const collapsed = C.move(fresh, "C", { x: 200, y: 300 });
check("a collapsed triangle is reported instead of drawn",
  !C.claims(collapsed).valid && /too thin/.test(C.describe(collapsed)));
check("the status text of a good triangle names all three radii",
  (C.describe(fresh).match(/Malfatti circle radii:/g) || []).length === 1);
// Angles must really be bisected before the two auxiliary incircles are built.
let bisected = 0;
for (const s of setups.slice(0, 20)) {
  const g = C.geometry(s);
  const at = (v, p, q) => C.util.angle(v, p, C.util.rotate(v, p, C.util.angle(v, p, q) / 2,
    C.util.orient(v, p, q)));
  if (Math.abs(at(g.I, g.A, g.B) - C.util.angle(g.I, g.B, g.A) / 2) < 1e-9) bisected++;
}
check("the incenter angle bisectors agree with the geometry helpers", bisected === 20);

done("malfatti");
