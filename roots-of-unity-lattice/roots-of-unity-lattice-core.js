"use strict";

/*
 * Roots of Unity Lattice: a toy of "lift to many dimensions, then project".
 *
 * Let z = e^(2 pi i / m) and d = phi(m) (the number of primitive m-th roots
 * of unity). The d numbers 1, z, ..., z^(d-1) are independent over the whole
 * numbers, so the combinations a0 + a1 z + ... + a(d-1) z^(d-1), with each
 * coefficient 0..r, are (r+1)^d different points of the plane: a d-dimensional
 * grid flattened onto the plane. Two such points that differ by a power of z
 * are exactly 1 apart, and each point has up to m such neighbours. This module
 * builds the points, counts the unit pairs (by looking up the m root vectors,
 * and by comparing every pair of points), and compares with a square grid of
 * about the same size.
 *
 * It is a toy: it shows the mechanism of packing more unit pairs by living in
 * more dimensions, not the construction behind the 2026 disproof.
 */

const RootsCore = (function () {
  const MAX_POINTS = 2400;
  const key = (a) => a.join(",");

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  const phi = (m) => { let t = 0; for (let i = 1; i <= m; i++) if (gcd(i, m) === 1) t++; return t; };

  /* Integer polynomials, coefficient arrays low degree first. */
  function polyDivide(num, den) { // exact division, den monic
    const q = Array(num.length - den.length + 1).fill(0), r = num.slice();
    for (let i = q.length - 1; i >= 0; i--) {
      q[i] = r[i + den.length - 1];
      for (let j = 0; j < den.length; j++) r[i + j] -= q[i] * den[j];
    }
    return q;
  }

  /** The cyclotomic polynomial Phi_m as integer coefficients. */
  function cyclotomic(m) {
    let p = Array(m + 1).fill(0); p[0] = -1; p[m] = 1; // x^m - 1
    for (let e = 1; e < m; e++) if (m % e === 0) p = polyDivide(p, cyclotomic(e));
    return p;
  }

  /** x^j reduced modulo Phi_m: d integers, the root z^j in the basis 1, z, .. z^(d-1). */
  function rootVector(m, j) {
    const ph = cyclotomic(m), d = ph.length - 1;
    let v = Array(d).fill(0);
    let cur = Array(d).fill(0); cur[0] = 1;
    for (let s = 0; s < (j % m); s++) { // multiply by x and reduce
      const top = cur[d - 1];
      cur = [0, ...cur.slice(0, d - 1)];
      for (let t = 0; t < d; t++) cur[t] -= top * ph[t];
    }
    return cur;
  }

  /** The point of the plane for coefficients a (length d). */
  function toPlane(m, a) {
    let x = 0, y = 0;
    for (let i = 0; i < a.length; i++) { x += a[i] * Math.cos((2 * Math.PI * i) / m); y += a[i] * Math.sin((2 * Math.PI * i) / m); }
    return { x, y };
  }

  /** How many points: (r+1)^phi(m). */
  const sizeOf = (m, r) => Math.pow(r + 1, phi(m));

  /** Every point of the lattice piece as {a, x, y}. */
  function build(m, r) {
    const d = phi(m), n = Math.pow(r + 1, d);
    if (n > MAX_POINTS) throw new RangeError("too many points");
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = []; let t = i;
      for (let k = 0; k < d; k++) { a.push(t % (r + 1)); t = Math.floor(t / (r + 1)); }
      pts.push({ a, ...toPlane(m, a) });
    }
    return pts;
  }

  /** Every unit vector +-z^j in the integer basis, each once (m of them for even m, 2m for odd m). */
  function unitVectors(m) {
    const seen = new Map();
    for (let j = 0; j < m; j++) {
      const v = rootVector(m, j);
      seen.set(key(v), v); const w = v.map((x) => -x); seen.set(key(w), w);
    }
    return [...seen.values()];
  }

  /** Unit pairs that differ by a power of z (up to sign), counted with a lookup. */
  function countByRoots(m, pts) {
    const roots = unitVectors(m);
    const set = new Set(pts.map((p) => key(p.a)));
    let t = 0;
    for (const p of pts) for (const u of roots) if (set.has(key(p.a.map((v, i) => v + u[i])))) t++;
    return t / 2;
  }

  /** Unit pairs by looking at every pair of points: |p - q| = 1. */
  function countByDistance(pts) {
    let t = 0;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.abs(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) - 1) < 1e-9) t++;
    return t;
  }

  /** How many different points of the plane there are (the lift loses nothing if this is the full count). */
  function distinctInPlane(pts) {
    return new Set(pts.map((p) => p.x.toFixed(7) + "," + p.y.toFixed(7))).size;
  }

  /** The neighbours (indices) of the point at index i. */
  function neighbours(pts, i) {
    const out = [];
    for (let j = 0; j < pts.length; j++) if (j !== i && Math.abs(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) - 1) < 1e-9) out.push(j);
    return out;
  }

  /** The best square grid with no more points than n: {k, n, c2, count}, by the grid formula. */
  function bestSquareGrid(n) {
    const k = Math.max(2, Math.floor(Math.sqrt(n)));
    let c2 = 1, count = -1;
    for (let c = 1; c <= 2 * (k - 1) * (k - 1); c++) {
      let t = 0;
      for (let a = -(k - 1); a <= k - 1; a++) {
        const rest = c - a * a; if (rest < 0) continue;
        const b = Math.round(Math.sqrt(rest)); if (b * b !== rest || b > k - 1) continue;
        t += (k - Math.abs(a)) * (k - b) * (b === 0 ? 1 : 2);
      }
      t /= 2;
      if (t > count) { count = t; c2 = c; }
    }
    return { k, n: k * k, c2, count };
  }

  const MS = [5, 7, 8, 9, 12];
  /** The largest r with (r+1)^phi(m) <= MAX_POINTS. */
  function maxR(m) { let r = 1; while (sizeOf(m, r + 1) <= MAX_POINTS) r++; return r; }
  const clampM = (m) => (MS.includes(Number(m)) ? Number(m) : 12);

  return { MAX_POINTS, MS, phi, cyclotomic, rootVector, toPlane, sizeOf, maxR, build, unitVectors, countByRoots, countByDistance, distinctInPlane, neighbours, bestSquareGrid, clampM };
})();
