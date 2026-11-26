"use strict";

/*
 * Product of simple fractions, from Alexander Bogomolny's applet
 * ProductOfFractions.
 *
 * Two fractions p/q and r/s, each drawn in a square: p/q as q rows with p of
 * them coloured, r/s as s columns with r coloured. Laid over each other the
 * rows and columns cut the square into q*s small cells, and the cells
 * coloured both ways, p*r of them, are the product:
 *
 *     p/q * r/s = pr / qs.
 *
 * The applet starts with a random denominator from 1 to 9 for each fraction
 * and a numerator from 1 to one less (1 when the denominator is 1). Every
 * number steps from 1 to 99, and a numerator never passes its denominator:
 * raising p above q sets it to q, lowering q below p sets it to p. "Simplify
 * fractions" divides each fraction by the greatest common divisor of its two
 * numbers.
 *
 * The position is plain data: { p, q, r, s }.
 */
const ProductOfFractionsCore = (() => {
  const MIN = 1, MAX = 99;

  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  /** The applet's GetInt: below 1 becomes 1, above 99 becomes 99. */
  const clampNum = (v) => (v <= 0 ? MIN : v > MAX ? MAX : v);

  /** GetRandomNumber(): a first digit 1..9 (one digit). GetRandomNumber(d): 1 + (int)((d - 1) random). */
  function start(options) {
    const o = options || {};
    if ([o.p, o.q, o.r, o.s].every(Number.isInteger)) {
      let s = { p: 1, q: 1, r: 1, s: 1 };
      for (const k of ["q", "s", "p", "r"]) s = set(s, k, o[k]);
      return s;
    }
    const random = o.random || Math.random;
    const q = Math.trunc(random() * 9 + 1), s = Math.trunc(random() * 9 + 1);
    const p = Math.trunc(random() * (q - 1) + 1), r = Math.trunc(random() * (s - 1) + 1);
    return { p, q, r, s };
  }

  /** Set one of p, q, r, s, as the applet's WorkOutValues does. */
  function set(state, which, value) {
    if (!["p", "q", "r", "s"].includes(which) || !Number.isFinite(value)) return null;
    const v = clampNum(Math.round(value));
    const next = { ...state, [which]: v };
    if (which === "p" && next.p > next.q) next.p = next.q;
    if (which === "r" && next.r > next.s) next.r = next.s;
    if (which === "q" && next.p > next.q) next.q = next.p;
    if (which === "s" && next.r > next.s) next.s = next.r;
    return next;
  }

  /** The product as the applet writes it: pr / qs, not reduced. */
  const product = (st) => ({ n: st.p * st.r, d: st.q * st.s });

  /** The applet's SimplifyFractions on the two fractions. */
  function simplify(st) {
    const g1 = gcd(st.p, st.q), g2 = gcd(st.r, st.s);
    return { p: st.p / g1, q: st.q / g1, r: st.r / g2, s: st.s / g2 };
  }

  /** The product reduced to lowest terms. */
  function reducedProduct(st) {
    const { n, d } = product(st), g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  /** Cell (row i of q, column j of s): coloured by the rows, the columns, or both. */
  const cell = (st, i, j) => ({ row: i < st.p, col: j < st.r, both: i < st.p && j < st.r });

  return { MIN, MAX, gcd, start, set, product, simplify, reducedProduct, cell };
})();
