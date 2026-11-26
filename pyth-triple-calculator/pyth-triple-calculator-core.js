"use strict";

/*
 * Pythagorean triples calculator, from Alexander Bogomolny's applet
 * PythTripleCalculator.
 *
 * Three whole numbers N, M, k from 1 to 1000 (the applet starts at 2, 1, 1)
 * give the triple
 *
 *     a = (N^2 - M^2) k,   b = 2NM k,   c = (N^2 + M^2) k,
 *
 * and a^2 + b^2 = c^2 because (N^2 - M^2)^2 + (2NM)^2 = (N^2 + M^2)^2. N should
 * be bigger than M: raising M to N or more pushes N up to M + 1, and lowering
 * N to M or less pulls M down to N - 1 (when N > 1). With N = 1 and M > 1 the
 * applet swaps the legs (a = 2NMk, b = (M^2 - N^2)k), and with N = M there is
 * no triangle. The triple is primitive when a and b have no common factor;
 * that happens exactly when k = 1, N and M have no common factor, and one of
 * them is even.
 *
 * The position is plain data: { n, m, k, showLengths }.
 */
const PythTripleCalculatorCore = (() => {
  const MIN = 1, MAX = 1000;

  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  const clamp = (v) => Math.max(MIN, Math.min(MAX, Math.round(v)));

  function start(options) {
    const o = options || {};
    if ([o.n, o.m, o.k].every(Number.isFinite)) return { n: clamp(o.n), m: clamp(o.m), k: clamp(o.k), showLengths: o.showLengths !== false };
    return { n: 2, m: 1, k: 1, showLengths: true };
  }

  /** The applet's actionPerformed: set N, M or k, keeping N > M where it can. */
  function set(s, which, value) {
    if (!["n", "m", "k"].includes(which) || !Number.isFinite(value)) return null;
    const v = clamp(value);
    if (which === "k") return { ...s, k: v };
    if (which === "n") return { ...s, n: v, m: s.m >= v && v > 1 ? v - 1 : s.m };
    return { ...s, m: v, n: v >= s.n ? Math.min(MAX, v + 1) : s.n };
  }

  /** The triple the applet's Reset computes: legs a (horizontal) and b (vertical), hypotenuse c; null when N = M. */
  function triple(s) {
    const { n, m, k } = s;
    if (n === m) return null;
    const a = k * (n > m ? n * n - m * m : 2 * n * m);
    const b = k * (n > m ? 2 * n * m : m * m - n * n);
    const c = k * (n * n + m * m);
    const g = gcd(a, b);
    return { a, b, c, gcd: g, primitive: !(g > 1 && c % g === 0) };
  }

  return { MIN, MAX, gcd, start, set, triple };
})();
