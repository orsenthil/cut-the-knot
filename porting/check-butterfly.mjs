#!/usr/bin/env node
"use strict";

/*
 * Logic test for butterfly/butterfly-core.js.
 *
 *   node porting/check-butterfly.mjs
 *
 * Checked: ButterflyCanvas.Reset's radii, nexus and spike ends are reproduced
 * from the bytecode for every N from 1 to 10 and many seeds; the wing points
 * and their intersections are compared with a second, literal transcription of
 * GeoSDoub.Intersect / IntersectX / IntersectY and ButterflyCanvas.Draw over
 * hundreds of diagrams; the page's equality of reciprocal lengths (the
 * midpoint of XY when N = 1) is checked on every one; the sum's independence
 * of the permutation is checked exhaustively up to N = 6; and the break-down
 * when M is dragged off the perpendicular through O is verified.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("butterfly/butterfly-core.js", "ButterflyCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const isPermutation = (p, n) => p.length === n &&
  p.slice().sort((a, b) => a - b).every((v, i) => v === i + 1);

/* ---------------------------------- the applet's own methods, transcribed */

/** GeoSDoub.Intersect(P1,P2,P3,P4) — the ax+by+c form from the bytecode. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.IntersectX(DoubLine,DoubCircle): x = k*y + b. */
function appletIntersectX(p, q, c, r) {
  const k = (p.x - q.x) / (p.y - q.y);
  const b = q.x - k * q.y;
  const A = k * k + 1;
  const B = k * (b - c.x) - c.y;
  const Cc = c.y * c.y + (b - c.x) * (b - c.x) - r * r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-B + s) / A, t2 = (-B - s) / A;
  return [{ x: k * t1 + b, y: t1 }, { x: k * t2 + b, y: t2 }];
}

/** GeoSDoub.IntersectY(DoubLine,DoubCircle): y = k*x + b. */
function appletIntersectY(p, q, c, r) {
  const k = (p.y - q.y) / (p.x - q.x);
  const b = q.y - k * q.x;
  const A = k * k + 1;
  const B = k * (b - c.y) - c.x;
  const Cc = c.x * c.x + (b - c.y) * (b - c.y) - r * r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-B + s) / A, t2 = (-B - s) / A;
  return [{ x: t1, y: k * t1 + b }, { x: t2, y: k * t2 + b }];
}

function appletIntersectLineCircle(p, q, c, r) {
  if (Math.abs(p.y - q.y) > 1) return appletIntersectX(p, q, c, r);
  if (Math.abs(p.x - q.x) > 1) return appletIntersectY(p, q, c, r);
  return null;
}

/** ButterflyCanvas.Reset with the applet's Math.random replaced by a sequence. */
function appletReset(n, seq, width = 400, height = 300) {
  let k = 0;
  const random = () => seq[k++];
  const base = Math.min(width, height) / 4;
  const step = base / n;
  const jitter = step / 4;
  const center = { x: width / 2, y: height / 2 };
  const radii = [base];
  for (let i = 1; i < n; i++) radii.push(step * (n - i) + (random() * 2 - 1) * jitter);
  const M = { x: center.x, y: center.y + radii[n - 1] / 2 };
  const angleA = Math.PI * 3 / 4 + random() * Math.PI / 4;
  const angleC = Math.PI / 6 + random() * Math.PI / 8;
  const A = { x: center.x + base * Math.cos(angleA), y: center.y + base * Math.sin(angleA) };
  const C = { x: center.x + base * Math.cos(angleC), y: center.y - base * Math.sin(angleC) };
  return { n, width, height, center, radii, M, A, C, randomUsed: k };
}

/** ButterflyCanvas.Draw: the wing points, X_i, Y_i and their lengths. */
function appletDraw(s) {
  const cls = { p: s.M, q: { x: s.M.x + 200, y: s.M.y } };
  const A = [], B = [], C = [], D = [];
  for (let i = 0; i < s.n; i++) {
    const u = appletIntersectLineCircle(s.M, s.A, s.center, s.radii[i]);
    if (!u) return null;
    A.push(u[0].y > u[1].y ? u[0] : u[1]);
    B.push(u[0].y > u[1].y ? u[1] : u[0]);
    const v = appletIntersectLineCircle(s.M, s.C, s.center, s.radii[i]);
    if (!v) return null;
    C.push(v[0].y > v[1].y ? v[0] : v[1]);
    D.push(v[0].y > v[1].y ? v[1] : v[0]);
  }
  const X = [], Y = [], mx = [], my = [];
  let sumX = 0, sumY = 0;
  for (let i = 0; i < s.n; i++) {
    const j = s.perm[i] - 1;
    const x = appletIntersect(A[i], D[j], cls.p, cls.q);
    const y = appletIntersect(C[i], B[j], cls.p, cls.q);
    X.push(x); Y.push(y);
    mx.push(dist(s.M, x)); my.push(dist(s.M, y));
    sumX += 1 / dist(s.M, x); sumY += 1 / dist(s.M, y);
  }
  return { A, B, C, D, X, Y, mx, my, sumX, sumY };
}

/* -------------------------------------------- 1. Reset against the bytecode */

{
  const rand = rng(2912);
  for (let n = 1; n <= 10; n++) {
    for (let trial = 0; trial < 6; trial++) {
      const seq = Array.from({ length: 2 * n + 4 }, () => rand());
      let k = 0;
      const s = C.start({ n, random: () => seq[k++] });
      const applet = appletReset(n, seq);
      const tol = 1e-9;
      check(`Reset n=${n} trial=${trial}: centre`, closePoint(s.center, applet.center, tol));
      check(`Reset n=${n} trial=${trial}: radii`, s.radii.length === n &&
        s.radii.every((r, i) => close(r, applet.radii[i], tol)));
      check(`Reset n=${n} trial=${trial}: nexus M`, closePoint(s.M, applet.M, tol));
      check(`Reset n=${n} trial=${trial}: spike end A`, closePoint(s.A, applet.A, tol));
      check(`Reset n=${n} trial=${trial}: spike end C`, closePoint(s.C, applet.C, tol));
      check(`Reset n=${n} trial=${trial}: permutation`, isPermutation(s.perm, n));
      check(`Reset n=${n} trial=${trial}: both spikes cross every circle`,
        s.radii.every((r) => C.lineCircle(s.M, s.A, s.center, r).length === 2 &&
          C.lineCircle(s.M, s.C, s.center, r).length === 2));
    }
  }
}

/* ------------------------------ 2. Draw: a second transcription of the code */

{
  const rand = rng(19205);
  let compared = 0;
  for (let n = 1; n <= 10; n++) {
    for (let trial = 0; trial < 20; trial++) {
      const s = C.start({ n, seed: 1000 * n + trial, random: rand });
      if (!isPermutation(s.perm, n)) continue; // start's own shuffle is checked above
      const draw = appletDraw(s);
      const m = C.measurements(s);
      if (!draw || !m.defined) continue;
      const tol = 1e-7 * s.radii[0];
      let same = true;
      for (let i = 0; i < n; i++) {
        same = same &&
          closePoint(m.A[i], draw.A[i], tol) && closePoint(m.B[i], draw.B[i], tol) &&
          closePoint(m.C[i], draw.C[i], tol) && closePoint(m.D[i], draw.D[i], tol) &&
          closePoint(m.X[i], draw.X[i], tol) && closePoint(m.Y[i], draw.Y[i], tol) &&
          close(m.mx[i], draw.mx[i], tol) && close(m.my[i], draw.my[i], tol);
      }
      same = same && close(m.sumX, draw.sumX, tol) && close(m.sumY, draw.sumY, tol);
      if (!same) {
        check(`Draw n=${n} trial=${trial}: every wing point matches the applet`, false,
          `core ${JSON.stringify([m.A, m.X])}, applet ${JSON.stringify([draw.A, draw.X])}`);
      }
      compared++;
    }
  }
  check(`Draw and the core agree on ${compared} diagrams`, compared >= 190);
}

/* ------------------------------------- 3. the theorem on the applet's setup */

{
  const rand = rng(525);
  let n1 = 0, nN = 0;
  for (let trial = 0; trial < 300; trial++) {
    const n = 1 + (trial % 10);
    const s = C.start({ n, seed: 9000 + trial, random: rand });
    const m = C.measurements(s);
    const cl = C.claims(s);
    check(`diagram ${trial}: all intersections are defined`, m.defined);
    if (!m.defined) continue;
    check(`diagram ${trial}: M is the midpoint of every circle's chord`, cl.chordMidpoints);
    check(`diagram ${trial}: the power of M is the same on both spikes`, cl.powerOfPoint);
    check(`diagram ${trial}: M is aligned with O`, cl.aligned);
    if (n === 1) {
      check(`diagram ${trial}: N=1 makes M the midpoint of XY`, cl.midpoint,
        `MX=${m.mx[0]} MY=${m.my[0]}`);
      n1++;
    } else {
      const tol = 1e-6 * Math.max(1, Math.abs(m.sumX), Math.abs(m.sumY));
      check(`diagram ${trial}: N=${n} gives equal sums of reciprocals`, close(m.sumX, m.sumY, tol),
        `sumX=${m.sumX} sumY=${m.sumY}`);
      check(`diagram ${trial}: the claim agrees with the measured sums`, cl.reciprocal);
      nN++;
    }
  }
  check(`the plain butterfly theorem was checked on ${n1} circles`, n1 >= 30);
  check(`the 2N-wing equality was checked on ${nN} diagrams`, nN >= 260);
}

/* ---------------------- 4. Lemma 2: the sum does not depend on the ordering */

{
  function permutations(arr) {
    if (arr.length <= 1) return [arr];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      for (const p of permutations(rest)) out.push([arr[i]].concat(p));
    }
    return out;
  }
  let checkedPerms = 0;
  for (const n of [2, 3, 4, 5, 6]) {
    for (const seed of [11, 87, 421]) {
      const s = C.start({ n, seed });
      const perms = permutations(Array.from({ length: n }, (_, i) => i + 1));
      const base = C.measurements({ ...s, perm: perms[0] });
      for (const p of perms) {
        const m = C.measurements({ ...s, perm: p });
        const tol = 1e-6 * Math.max(1, Math.abs(base.sumX), Math.abs(m.sumX));
        if (!close(base.sumX, m.sumX, tol) || !close(m.sumX, m.sumY, tol)) {
          check(`n=${n} seed=${seed} perm=${p}: the sum is independent of p`, false,
            `${base.sumX} vs ${m.sumX} vs ${m.sumY}`);
        }
        checkedPerms++;
      }
    }
  }
  check(`the permutation sum was checked on ${checkedPerms} permutations`, checkedPerms >= 1000);
}

/* ---------------- 5. moving M off the perpendicular breaks the equality --- */

{
  const s = C.start({ n: 3, seed: 77 });
  const bad = C.withPoint(s, "M", { x: s.M.x + 5, y: s.M.y });
  const m = C.measurements(bad);
  check("a moved nexus is no longer aligned with O", !m.aligned);
  check("a moved nexus fails the midpoint-of-chord claim", !C.claims(bad).chordMidpoints);
  check("a moved nexus still gives finite intersections", m.defined);
  check("a moved nexus breaks the reciprocal equality", Math.abs(m.sumX - m.sumY) > 1e-3,
    `sumX=${m.sumX} sumY=${m.sumY}`);
  check("moving M does not change the original position", s.M.x === 200);
}

/* ----------------------------------- 6. options, handles and the demo result */

{
  check("a fresh diagram has no result", C.result(C.start({})) === null);
  check("N is clamped to the applet's range 1..10", C.withN(C.start({ n: 4 }), 99).n === 10 &&
    C.withN(C.start({ n: 4 }), -3).n === 1);
  const s = C.start({ n: 3, seed: 12 });
  const moved = C.withPoint(s, "A", { x: 0, y: 0 });
  check("dragging A keeps it on the outer circle",
    close(dist(moved.A, moved.center), moved.radii[0], 1e-9));
  check("dragging A leaves the old position alone", s.A.x !== moved.A.x || s.A.y !== moved.A.y);
  check("dragging C keeps it on the outer circle",
    close(dist(C.withPoint(s, "C", { x: 400, y: 10 }).C, s.center), s.radii[0], 1e-9));
  check("an unknown handle is ignored", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
  const p = C.permute(s);
  check("Permute keeps a valid permutation", isPermutation(p.perm, p.n));
  check("Permute leaves the drawing alone", p.A === s.A && p.C === s.C && p.radii === s.radii);
  check("changing N resets the nexus onto the new smallest circle", (() => {
    const t = C.withN(s, 6);
    return t.n === 6 && close(t.M.y - t.center.y, t.radii[5] / 2, 1e-9);
  })());
}

done("butterfly");
