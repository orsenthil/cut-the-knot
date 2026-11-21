"use strict";

/*
 * Compare Fractions — the logic behind Alexander Bogomolny's applet
 * "CompareFractions" (cut-the-knot.org/Curriculum/Arithmetic/CompareFractions.shtml).
 *
 * The applet shows two fractions N1/D1 and N2/D2 and draws each as rows of
 * equal boxes: a row has D boxes, N of them are filled, and the fraction needs
 * ceil(N/D) rows. A digit can be nudged up or down by clicking its right or
 * left half. Two buttons rewrite the fractions: "Common denominator" gives both
 * the denominator D1*D2/gcd(D1,D2) (the least common multiple), and "Simplify
 * fractions" divides each fraction's top and bottom by their gcd. The page's
 * key idea is the cross-multiplication rule: N1/D1 > N2/D2 exactly when
 * N1*D2 > N2*D1 (all numbers being positive).
 *
 * Quirks kept from the applet: a typed-in number is kept between 1 and 99; the
 * pictures are only drawn while all four numbers are at most 99 (otherwise the
 * applet writes "Please Simplify!" and disables the common-denominator
 * button, which comes back after a simplify); a new applet starts with four
 * random one-digit numbers from 1 to 9.
 *
 * No document, no window, no storage. The position is plain data
 * { n1, d1, n2, d2, moves, explored }; every function returns a new one.
 */
const CompareFractionsCore = (() => {
  const MIN = 1; // GetInt: a value of 0 or less becomes 1
  const MAX = 99; // GetInt: a value above 99 becomes 99
  const BIG = 99; // AreBig: any of the four numbers above this is "big"
  const FIELDS = ["n1", "d1", "n2", "d2"];

  function gcd(a, b) {
    // GCD.gcd(int,int): the Euclidean algorithm, exactly as the applet has it.
    return b === 0 ? a : gcd(b, a % b);
  }

  function clamp(v) {
    return v <= 0 ? MIN : v > MAX ? MAX : v;
  }

  function fix(s) {
    return {
      n1: Math.trunc(s.n1), d1: Math.trunc(s.d1), n2: Math.trunc(s.n2), d2: Math.trunc(s.d2),
      moves: s.moves || 0, explored: !!s.explored,
    };
  }

  /** A new position. The applet's own start is random one-digit numbers; pass values to fix them. */
  function start(options) {
    const o = options || {};
    const pick = (key, dflt) => clamp(Number.isFinite(Number(o[key])) && o[key] !== undefined ? Math.trunc(Number(o[key])) : dflt);
    return { n1: pick("n1", 3), d1: pick("d1", 4), n2: pick("n2", 2), d2: pick("d2", 3), moves: 0, explored: false };
  }

  /** How many digits a number is written with. */
  function digits(v) {
    return String(v).length;
  }

  /** The numbers whose digit k (0 = units) can be nudged: every digit that is written. */
  function legalMoves(state) {
    const moves = [];
    for (const f of FIELDS) for (let k = 0; k < digits(state[f]); k++) for (const dir of [1, -1]) moves.push({ type: "digit", field: f, k, dir });
    moves.push({ type: "common" }, { type: "simplify" });
    return moves;
  }

  /** Is this the applet's "too big to draw" case? */
  function areBig(state) {
    return FIELDS.some((f) => state[f] > BIG);
  }

  /** Common denominator: the applet's SetCommonDenominator. */
  function commonDenominator(state) {
    const g = gcd(state.d1, state.d2);
    const lcm = (state.d1 * state.d2) / g;
    const m1 = lcm / state.d1;
    const m2 = lcm / state.d2;
    return { ...state, n1: state.n1 * m1, d1: state.d1 * m1, n2: state.n2 * m2, d2: state.d2 * m2 };
  }

  /** Simplify: the applet's SimplifyFractions (each fraction on its own, only when gcd > 1). */
  function simplify(state) {
    const g1 = gcd(state.n1, state.d1);
    const g2 = gcd(state.n2, state.d2);
    const out = { ...state };
    if (g1 > 1) { out.n1 = state.n1 / g1; out.d1 = state.d1 / g1; }
    if (g2 > 1) { out.n2 = state.n2 / g2; out.d2 = state.d2 / g2; }
    return out;
  }

  /** Change one digit by one step: the value moves by 10^k, then is kept in range, as GetInt does. */
  function nudge(state, field, k, dir) {
    if (!FIELDS.includes(field) || !(k >= 0 && k < digits(state[field])) || (dir !== 1 && dir !== -1)) return null;
    return { ...state, [field]: clamp(state[field] + dir * Math.pow(10, k)) };
  }

  /** The position after a move, or null if it is not allowed. */
  function move(state, m) {
    if (!m) return null;
    let next = null;
    if (m.type === "digit") next = nudge(state, m.field, m.k, m.dir);
    else if (m.type === "common") next = areBig(state) ? null : commonDenominator(state);
    else if (m.type === "simplify") next = simplify(state);
    if (!next) return null;
    return { ...fix(next), moves: (state.moves || 0) + 1, explored: true };
  }

  /** A set value (typed in), kept in range like the applet's GetInt. */
  function setValue(state, field, v) {
    if (!FIELDS.includes(field) || !Number.isFinite(Number(v))) return null;
    return { ...state, [field]: clamp(Math.trunc(Number(v))), moves: (state.moves || 0) + 1, explored: true };
  }

  /** Cross-multiplication: 1 if N1/D1 > N2/D2, -1 if less, 0 if equal. */
  function compare(state) {
    const a = state.n1 * state.d2;
    const b = state.n2 * state.d1;
    return a > b ? 1 : a < b ? -1 : 0;
  }

  /** The boxes of one fraction: ceil(N/D) rows, the last holding N mod D filled boxes (or D when it divides). */
  function rows(n, d) {
    const count = Math.floor(n / d) + (n % d !== 0 ? 1 : 0);
    const out = [];
    for (let r = 0; r < count; r++) out.push({ width: d, filled: r === count - 1 ? (n % d === 0 ? d : n % d) : d });
    return out;
  }

  /** A demo: nothing to win, so "done" once the player has changed something. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  return { MIN, MAX, BIG, FIELDS, start, legalMoves, move, setValue, result, gcd, areBig, commonDenominator, simplify, compare, rows, digits };
})();
