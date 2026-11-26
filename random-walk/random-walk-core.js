"use strict";

/*
 * Random walks on a square lattice, from Bogomolny's RandomWalk applet.
 *
 * A walk takes n steps; each step moves one place right and either one place
 * up or one place down. From height a to height b there are C(n, (n+b-a)/2)
 * walks when that number makes sense. The applet picks the step direction at
 * random, except that near the end it steers towards the target so the walk
 * always arrives. If n and b-a have different parity it quietly uses one
 * fewer step, as the original does. The reflection of a walk in the x-axis
 * up to its first touch of the axis is also provided, for the lemma.
 *
 * Pure logic: no DOM, no storage, one global and plain JSON positions.
 */
const RandomWalkCore = (() => {
  const LIMITS = { a: [-10, 10], b: [-10, 10], n: [1, 20] };
  const DEFAULTS = { a: 3, b: 4, n: 9 };

  function clamp(value, [lo, hi]) {
    const v = Math.round(Number(value));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  }

  function binomial(n, k) {
    if (k < 0 || k > n) return 0;
    const small = Math.min(k, n - k);
    let out = 1;
    for (let i = 1; i <= small; i++) out = (out * (n - small + i)) / i;
    return Math.round(out);
  }

  /** The applet shortens the walk by one when the parity cannot work. */
  function steps(state) {
    const d = state.b - state.a;
    return ((state.n - d) % 2 + 2) % 2 === 1 ? state.n - 1 : state.n;
  }

  function reachable(state) {
    return steps(state) >= Math.abs(state.b - state.a);
  }

  /** The number of distinct walks from (0,a) to (n,b). */
  function countWalks(state) {
    const n = steps(state);
    const d = state.b - state.a;
    return binomial(n, (n + d) / 2);
  }

  /** One walk, with the applet's random choice and end-of-walk steering. */
  function walk(state, random = Math.random) {
    const n = steps(state);
    const path = [state.a];
    for (let s = 0; s < n; s++) {
      const remaining = n - s;
      const diff = state.b - path[path.length - 1];
      const step = Math.abs(diff) >= remaining - 1
        ? (diff < 0 ? -1 : 1)
        : (random() < 0.5 ? 1 : -1);
      path.push(path[path.length - 1] + step);
    }
    return path;
  }

  /** Reflect the part of a walk before its first touch of the x-axis. */
  function reflect(path) {
    const first = path.findIndex((y) => y === 0);
    const upto = first < 0 ? path.length : first;
    return path.map((y, i) => (i <= upto ? -y : y));
  }

  /** The position a new demo starts from. */
  function start(options = {}) {
    return {
      a: clamp(options.a ?? DEFAULTS.a, LIMITS.a),
      b: clamp(options.b ?? DEFAULTS.b, LIMITS.b),
      n: clamp(options.n ?? DEFAULTS.n, LIMITS.n),
      showNames: !!options.showNames,
      walks: [],
      explored: false,
      message: "Press One walk or Ten walks to send walkers from A to B.",
    };
  }

  function setParam(state, key, value) {
    if (!(key in LIMITS)) return state;
    return {
      ...state,
      [key]: clamp(value, LIMITS[key]),
      walks: [],
      explored: true,
      message: `A starts at ${key === "a" ? clamp(value, LIMITS[key]) : state.a}, ` +
        `B ends at ${key === "b" ? clamp(value, LIMITS[key]) : state.b}, ` +
        `${steps({ ...state, [key]: clamp(value, LIMITS[key]) })} steps.`,
    };
  }

  function toggleNames(state) {
    return { ...state, showNames: !state.showNames, explored: true, message: state.message };
  }

  function addWalks(state, count, random = Math.random) {
    const fresh = Array.from({ length: count }, () => walk(state, random));
    const walks = state.walks.concat(fresh);
    return {
      ...state,
      walks,
      explored: true,
      message: reachable(state)
        ? `${count === 1 ? "One walk" : "Ten walks"} arrived at B. ` +
          `There are ${countWalks(state)} walks from A to B in all.`
        : "A and B cannot be joined by this many up-and-down steps; try other values.",
    };
  }

  /** "done" once the player has generated a walk or changed a value. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  return {
    LIMITS, DEFAULTS, start, steps, reachable, countWalks, walk, reflect,
    setParam, toggleNames, addWalks, result, binomial,
  };
})();
