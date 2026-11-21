"use strict";

/*
 * GCD and LCM by plain factorization, from Alexander Bogomolny's applet Factorization.
 *
 * Factor each number into primes. For every prime, the lcm takes the larger of its two
 * exponents and the gcd the smaller. Since max(a, b) + min(a, b) = a + b for every pair
 * of exponents, gcd(M, N) x lcm(M, N) = M x N.
 *
 * The applet has two text fields; each takes a number or a product typed with "*"
 * ("12*5*7": MultiplicationParser), and Compute factors both and shows the factorizations
 * (short: 2^3 x 3, or long: 2 x 2 x 2 x 3), the exponents of every prime of either number
 * side by side, and the lcm and the gcd. A text that does not parse becomes 0. The page
 * says numbers up to 7,000,000,000 are fine. The position is plain data.
 */
const FactorizationCore = (() => {
  const LIMIT = 7000000000;

  /** The value of a text such as "12", "12*5" or " 2 * 3 * 7 ", or 0 if it is not a product of whole numbers (or too big). */
  function parse(text) {
    const t = String(text).replace(/\s+/g, "");
    if (t === "") return 0;
    let value = 1;
    for (const part of t.split("*")) {
      if (!/^\d+$/.test(part)) return 0;
      value *= Number(part);
      if (value > LIMIT) return 0;
    }
    return value;
  }

  /** The prime factors of n >= 2 as [[prime, exponent], ...] in increasing order; [] for 0 and 1. */
  function factor(n) {
    const out = [];
    if (!Number.isInteger(n) || n < 2) return out;
    for (let p = 2; p * p <= n; p += p === 2 ? 1 : 2) {
      if (n % p === 0) { let e = 0; while (n % p === 0) { n /= p; e++; } out.push([p, e]); }
    }
    if (n > 1) out.push([n, 1]);
    return out;
  }

  /** The text of a factorization: short "2^3 x 3", long "2 x 2 x 2 x 3"; "1" for 1, "0" for 0 (the applet's "0"). */
  function show(n, brief) {
    if (n === 0) return "0";
    if (n === 1) return "1";
    const f = factor(n);
    return f.map(([p, e]) => (brief ? (e > 1 ? `${p}^${e}` : `${p}`) : new Array(e).fill(p).join(" x "))).join(" x ");
  }

  /** gcd and lcm from the exponents of the primes of both numbers, and the table of exponents. */
  function compare(n1, n2) {
    const f1 = factor(n1), f2 = factor(n2);
    const primes = Array.from(new Set(f1.map((x) => x[0]).concat(f2.map((x) => x[0])))).sort((a, b) => a - b);
    const e = (f, p) => { const x = f.find((y) => y[0] === p); return x ? x[1] : 0; };
    const rows = primes.map((p) => ({ prime: p, e1: e(f1, p), e2: e(f2, p), min: Math.min(e(f1, p), e(f2, p)), max: Math.max(e(f1, p), e(f2, p)) }));
    // BigInt: the lcm of two numbers near 7e9 is far beyond what a double holds exactly
    const productBig = (key) => rows.reduce((acc, r) => acc * BigInt(r.prime) ** BigInt(r[key]), 1n);
    const valid = n1 >= 1 && n2 >= 1;
    const g = valid ? productBig("min") : null, l = valid ? productBig("max") : null;
    return { rows, gcd: g === null ? null : Number(g), lcm: l === null ? null : Number(l), gcdBig: g, lcmBig: l };
  }

  /** A new position, with the two texts (the page opens on 360 and 84). */
  function start(options) {
    const o = options || {};
    const t1 = o.t1 !== undefined ? String(o.t1) : "360", t2 = o.t2 !== undefined ? String(o.t2) : "84";
    return { t1, t2, n1: parse(t1), n2: parse(t2), brief: o.brief !== false, computed: false, moves: 0 };
  }

  /** Moves: {type:"compute", t1, t2}, {type:"format", brief}, {type:"reset"}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "compute") {
      const t1 = String(m.t1), t2 = String(m.t2);
      return { ...s, t1: String(parse(t1)), t2: String(parse(t2)), n1: parse(t1), n2: parse(t2), computed: true, moves: s.moves + 1 };
    }
    if (m.type === "format") return { ...s, brief: !!m.brief };
    if (m.type === "reset") return start({});
    return null;
  }

  const legalMoves = (s) => [{ type: "compute", t1: s.t1, t2: s.t2 }];
  const result = (s) => (s.computed ? "done" : null);

  return { LIMIT, parse, factor, show, compare, start, move, legalMoves, result };
})();
