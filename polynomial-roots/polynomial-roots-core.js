"use strict";

/*
 * Graph of a polynomial defined by its roots, from Alexander Bogomolny's
 * applet PolynomialRoots.
 *
 * P(x) = A (x - r1)(x - r2)...(x - rn). The degree n is from 0 to 10 (the
 * applet starts at 3). Choosing a degree makes a new polynomial: A a whole
 * number from 1 to 5 and each root (int)(11 * random - 5), a whole number from
 * -4 to 5 (0 twice as likely, as Java's cast rounds towards zero). Every
 * number can then be stepped up or down by 1.
 *
 * What the page says, and the test checks: far out, P has the sign of A on the
 * right and of A * (-1)^n on the left; at a root of even multiplicity the
 * graph touches the axis and stays on one side, at an odd one it crosses; at
 * a repeated root the graph is tangent to the axis.
 *
 * The position is plain data: { a, roots: [r1, ..., rn] }.
 */
const PolynomialRootsCore = (() => {
  const DEG_MIN = 0, DEG_MAX = 10, DEG_START = 3, NUM_MIN = -99, NUM_MAX = 99;

  const clampNum = (v) => (Number.isInteger(v) ? Math.max(NUM_MIN, Math.min(NUM_MAX, v)) : 0);

  /** The applet's Reset(true): a new random polynomial of degree n. */
  function start(options) {
    const o = options || {};
    if (Number.isInteger(o.a) && Array.isArray(o.roots) && o.roots.length <= DEG_MAX && o.roots.every(Number.isInteger)) {
      return { a: clampNum(o.a), roots: o.roots.map(clampNum) };
    }
    const random = o.random || Math.random;
    const n = Number.isInteger(o.degree) ? Math.max(DEG_MIN, Math.min(DEG_MAX, o.degree)) : DEG_START;
    const roots = [];
    for (let i = 0; i < n; i++) roots.push(Math.trunc(random() * 11 - 5));
    const a = Math.trunc(random() * 5 + 1);
    return { a, roots };
  }

  /** P(x), as the applet's Value: start from A and multiply by (x - r) for each root. */
  function value(state, x) {
    let v = state.a;
    for (let k = state.roots.length - 1; k >= 0; k--) v *= x - state.roots[k];
    return v;
  }

  /** Each distinct root with its multiplicity, in increasing order. */
  function multiplicities(state) {
    const m = new Map();
    for (const r of state.roots) m.set(r, (m.get(r) || 0) + 1);
    return [...m.entries()].sort((p, q) => p[0] - q[0]).map(([root, times]) => ({ root, times, crosses: times % 2 === 1 }));
  }

  /** The sign of P far to the left and far to the right (0 for P = 0). */
  function ends(state) {
    const s = Math.sign(state.a);
    return { left: state.roots.length % 2 === 0 ? s : -s, right: s };
  }

  /** Moves: { type: "degree", value } (a new random polynomial), { type: "a", value }, { type: "root", index, value }. */
  function move(state, m, random) {
    if (!m) return null;
    if (m.type === "degree" && Number.isInteger(m.value)) return start({ degree: m.value, random });
    if (m.type === "a" && Number.isInteger(m.value)) return { ...state, a: clampNum(m.value) };
    if (m.type === "root" && Number.isInteger(m.index) && m.index >= 0 && m.index < state.roots.length && Number.isInteger(m.value)) {
      const roots = state.roots.slice(); roots[m.index] = clampNum(m.value);
      return { ...state, roots };
    }
    return null;
  }

  /** The formula as the applet writes it: "P(x) = 2(x − 1)(x + 3)(x − 0)". */
  function formula(state) {
    const factors = state.roots.map((r) => (r >= 0 ? `(x − ${r})` : `(x + ${-r})`));
    const a = state.a;
    const lead = factors.length === 0 ? String(a).replace("-", "−") : a === 1 ? "" : a === -1 ? "−" : String(a).replace("-", "−");
    return `P(x) = ${lead}${factors.join("")}`;
  }

  return { DEG_MIN, DEG_MAX, DEG_START, NUM_MIN, NUM_MAX, start, value, multiplicities, ends, move, formula };
})();
