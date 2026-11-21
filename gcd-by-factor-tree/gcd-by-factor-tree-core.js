"use strict";

/*
 * GCD and LCM via Factor Tree, from Bogomolny's applet GCDByBTree.
 *
 * The applet factors two composite numbers into primes by repeated splitting,
 * then treats the prime factors as multisets. The gcd is the product of the
 * multiset intersection (take the smaller multiplicity of each prime) and the
 * lcm is the product of the multiset union (take the larger multiplicity).
 *
 * The key idea is min(a,b) + max(a,b) = a + b, so the exponent of each prime
 * in gcd * lcm equals the exponent in N * M. The logic test checks that
 * identity, the multiset operations and the factor trees over a wide range.
 *
 * No document, no window, no storage: one global, GcdByFactorTreeCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const GcdByFactorTreeCore = (() => {
  const MIN_N = 2;
  const MAX_N = 1000;

  function clamp(value, fallback) {
    const v = Math.trunc(Number(value));
    return Number.isFinite(v) ? Math.max(MIN_N, Math.min(MAX_N, v)) : fallback;
  }

  /** Trial division into prime factors, sorted, as a multiset. */
  function factors(n) {
    let rest = Math.max(1, Math.trunc(n));
    const out = [];
    for (let p = 2; p * p <= rest; p++) {
      while (rest % p === 0) { out.push(p); rest /= p; }
    }
    if (rest > 1) out.push(rest);
    return out.sort((a, b) => a - b);
  }

  /** Multiplicity map of a prime multiset. */
  function multiplicities(list) {
    const map = new Map();
    for (const p of list) map.set(p, (map.get(p) || 0) + 1);
    return map;
  }

  function product(list) {
    return list.reduce((a, b) => a * b, 1);
  }

  /** Multiset intersection: min of multiplicities. */
  function intersection(a, b) {
    const ma = multiplicities(a);
    const mb = multiplicities(b);
    const out = [];
    for (const [p, count] of ma) {
      const n = Math.min(count, mb.get(p) || 0);
      for (let i = 0; i < n; i++) out.push(p);
    }
    return out.sort((x, y) => x - y);
  }

  /** Multiset union: max of multiplicities. */
  function union(a, b) {
    const ma = multiplicities(a);
    const mb = multiplicities(b);
    const out = [];
    for (const p of new Set([...ma.keys(), ...mb.keys()])) {
      const n = Math.max(ma.get(p) || 0, mb.get(p) || 0);
      for (let i = 0; i < n; i++) out.push(p);
    }
    return out.sort((x, y) => x - y);
  }

  /** A factor tree: the root is n; a composite node splits into two factors. */
  function factorTree(n) {
    const fs = factors(n);
    const node = { value: n, children: [] };
    if (fs.length <= 1) return node;
    // Split off the smallest prime, as the applet's recursive tree does.
    const first = fs[0];
    const other = n / first;
    node.children = [factorTree(first), factorTree(other)];
    return node;
  }

  function gcd(a, b) {
    while (b !== 0) { [a, b] = [b, a % b]; }
    return Math.abs(a);
  }

  function analyze(n, m) {
    const a = factors(n);
    const b = factors(m);
    const common = intersection(a, b);
    const all = union(a, b);
    return {
      n, m,
      factorsN: a, factorsM: b,
      gcdFactors: common, lcmFactors: all,
      gcd: product(common), lcm: product(all),
      productNM: n * m,
      productGcdLcm: product(common) * product(all),
    };
  }

  /** Two random composite numbers, as the applet's Reset does. */
  function start(options) {
    const opts = options || {};
    const random = opts.random || Math.random;
    const pick = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
    const n = opts.n === undefined ? pick(4, 60) : clamp(opts.n, 4);
    const m = opts.m === undefined ? pick(4, 60) : clamp(opts.m, 4);
    return { n, m };
  }

  return { MIN_N, MAX_N, clamp, factors, multiplicities, product, intersection, union, factorTree, gcd, analyze, start };
})();
