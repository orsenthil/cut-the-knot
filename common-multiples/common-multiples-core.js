"use strict";

/*
 * Common Multiples — the logic behind Alexander Bogomolny's applet
 * "CommonMultiples" (cut-the-knot.org/Curriculum/Arithmetic/CommonMultiples.shtml).
 *
 * The applet draws a number line with two hollow, draggable dots. The upper
 * dot P starts (on the applet's page) at 2 and the lower dot Q at 3. Above the
 * line sit red dots at P, 2P, 3P, ...; below it sit red dots at Q, 2Q, 3Q, ...
 * Blue dots on the line itself mark the numbers in both rows, and the leftmost
 * blue dot is the least common multiple. The applet finds that leftmost dot
 * with the single formula  p * q / GCD.gcd(p, q)  straight from its Draw()
 * method, and it snaps a dragged dot to a whole number, never below 1 (Snap).
 *
 * So the whole idea is: multiples are k*n, the common multiples of P and Q are
 * exactly the multiples of their least common multiple, and lcm(P,Q) is
 * P*Q/gcd(P,Q). This file computes those things and nothing else: no document,
 * no window, no storage. It defines one global, CommonMultiplesCore, so the
 * page loads it with a plain <script> and the Node test loads it with loadCore.
 * The position is plain JSON; every function returns new data.
 */

const CommonMultiplesCore = (() => {
  const DEFAULT_P = 2; // the page's opening values (the applet actually draws 3 above, 2 below)
  const DEFAULT_Q = 3;
  const MIN_VALUE = 1; // the applet's Snap never allows a value below 1
  const MAX_VALUE = 50; // this port's control range; the applet had no upper cap

  /* ---------------------------------------------------------- the arithmetic */

  /** Euclid's algorithm, as in the applet's GCD.gcd(int, int). */
  function gcd(a, b) {
    let x = Math.abs(Math.trunc(a));
    let y = Math.abs(Math.trunc(b));
    while (y) {
      const t = x % y;
      x = y;
      y = t;
    }
    return x;
  }

  /** The applet's blue-dot formula, verbatim: p*q / GCD.gcd(p,q). */
  function lcm(p, q) {
    if (!(p >= 1) || !(q >= 1)) return 0;
    return (p * q) / gcd(p, q);
  }

  /** a > 0 divides b when b is a whole number of copies of a. */
  function divides(a, b) {
    return a > 0 && b % a === 0;
  }

  /** k is a multiple of n (negative k and n are allowed, as on the page). */
  function isMultiple(k, n) {
    return n !== 0 && k % n === 0;
  }

  /**
   * The applet's Snap(MoveablePoint): Math.round((x - O)/DX), then the value 1
   * when that is less than 1. Here it works on the grid value itself.
   */
  function snap(raw) {
    const n = Math.round(Number(raw));
    return Number.isFinite(n) && n >= 1 ? n : MIN_VALUE;
  }

  /** snap, with the upper end of this port's on-screen controls. */
  function clampValue(raw) {
    return Math.min(MAX_VALUE, snap(raw));
  }

  /* --------------------------------------------------------------- position */

  /** The position a new run starts from. Options: { p, q }. */
  function start(options = {}) {
    const o = options || {};
    return {
      p: o.p == null ? DEFAULT_P : clampValue(o.p),
      q: o.q == null ? DEFAULT_Q : clampValue(o.q),
      moves: 0,
      explored: false,
    };
  }

  /** Every new value either dot may be snapped to. */
  function legalMoves(state) {
    const out = [];
    for (let v = MIN_VALUE; v <= MAX_VALUE; v++) {
      if (v !== state.p) out.push({ which: "p", value: v });
      if (v !== state.q) out.push({ which: "q", value: v });
    }
    return out;
  }

  /** Move one dot to a whole number. Returns null for an unknown dot or value. */
  function move(state, m) {
    if (!m || (m.which !== "p" && m.which !== "q")) return null;
    if (!Number.isFinite(Number(m.value))) return null;
    const value = clampValue(m.value);
    if (value === state[m.which]) return state;
    return {
      p: state.p,
      q: state.q,
      [m.which]: value,
      moves: state.moves + 1,
      explored: true,
    };
  }

  const setP = (state, value) => move(state, { which: "p", value });
  const setQ = (state, value) => move(state, { which: "q", value });

  /** A demo: null before player, "done" once the picture has been changed. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  function explored(state) {
    return !!state.explored;
  }

  /* ------------------------------------------------------ what gets displayed */

  /** Positive multiples of n up to and including limit. */
  function multiples(n, limit) {
    const base = snap(n);
    const out = [];
    for (let k = 1; k * base <= limit; k++) out.push(k * base);
    return out;
  }

  /** The blue dots: numbers in both rows, i.e. multiples of their lcm. */
  function commonMultiples(p, q, limit) {
    const L = lcm(snap(p), snap(q));
    return L ? multiples(L, limit) : [];
  }

  /**
   * How far the drawn number line reaches. It always shows several multiples
   * of both dots and at least two blue dots, so the lcm can be read off.
   */
  function axisMax(state) {
    const L = lcm(state.p, state.q);
    return Math.max(12, 4 * Math.max(state.p, state.q), 3 * L);
  }

  /** A "nice" tick spacing (1, 2, 5, 10, ...) giving roughly a dozen labels. */
  function tickStep(max) {
    const target = Math.max(1, Math.round(max / 12));
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
    for (const s of steps) if (s >= target) return s;
    return 10000;
  }

  /** A sentence in words for #status, saying which blue dot appeared. */
  function describe(action, state) {
    const p = state.p;
    const q = state.q;
    const L = lcm(p, q);
    const lead = action === "reset" ? "Back to the start: " : "";
    let tail;
    if (divides(p, q)) tail = q + " is already in P's row, so the first blue dot is Q itself (" + q + ").";
    else if (divides(q, p)) tail = p + " is already in Q's row, so the first blue dot is P itself (" + p + ").";
    else tail = "The first blue dot is at " + L + " — the smallest number in both rows.";
    return lead + "P = " + p + ", Q = " + q + ". " + tail;
  }

  return {
    DEFAULT_P, DEFAULT_Q, MIN_VALUE, MAX_VALUE,
    gcd, lcm, divides, isMultiple, snap, clampValue,
    start, legalMoves, move, setP, setQ, result, explored,
    multiples, commonMultiples, axisMax, tickStep, describe,
  };
})();
