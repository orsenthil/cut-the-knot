"use strict";

/*
 * The Reflection Lemma, from Bogomolny's ReflectionPrinciple applet.
 *
 * A walk goes from A = (0,a) to B = (n,b) in n steps, each step one place
 * right and one place up or down. For a walk starting above the axis that
 * touches it, reflect every step up to and including the first touch: the
 * result is a walk from A' = (0,-a) to B. Conversely every walk from A' to B
 * must cross the axis and reflects back to one that touches it. Hence
 * M_n(a,b) = N_n(-a,b).
 *
 * The step rule and the reflection update are transcribed from the applet's
 * MakeOneStep and UpdateReflection. Pure logic: one global, plain JSON.
 */
const ReflectionPrincipleCore = (() => {
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

  /** The applet shortens by one step when the parity cannot work. */
  function steps(state) {
    const d = state.b - state.a;
    return ((state.n - d) % 2 + 2) % 2 === 1 ? state.n - 1 : state.n;
  }

  function reachable(state) {
    return steps(state) >= Math.abs(state.b - state.a);
  }

  function countWalks(state) {
    const n = steps(state);
    return binomial(n, (n + state.b - state.a) / 2);
  }

  /** MakeOneStep: steer towards the goal only once the end is close. */
  function makeStep(y, target, remaining, random) {
    const diff = target - y;
    return Math.abs(diff) >= remaining - 1
      ? (diff < 0 ? -1 : 1)
      : (random() < 0.5 ? 1 : -1);
  }

  /** Both walks, step by step, as the applet's two threads draw them. */
  function pair(state, random = Math.random) {
    const n = steps(state);
    const path = [state.a];
    const reflected = [-state.a];
    let passedZero = false;
    for (let s = 0; s < n; s++) {
      const step = makeStep(path[s], state.b, n - s, random);
      path.push(path[s] + step);
      // UpdateReflection notices the zero one step after it is reached.
      if (s !== 0 && !passedZero && reflected[s] === 0) passedZero = true;
      reflected.push(reflected[s] + (passedZero ? step : -step));
    }
    return { path, reflected, passedZero };
  }

  /** The ideal reflection of a finished walk, used by the logic test. */
  function reflect(path) {
    const first = path.findIndex((y) => y === 0);
    const upto = first < 0 ? path.length - 1 : first;
    return path.map((y, i) => (i <= upto ? -y : y));
  }

  function start(options = {}) {
    return {
      a: clamp(options.a ?? DEFAULTS.a, LIMITS.a),
      b: clamp(options.b ?? DEFAULTS.b, LIMITS.b),
      n: clamp(options.n ?? DEFAULTS.n, LIMITS.n),
      showNames: !!options.showNames,
      path: null,
      reflected: null,
      passedZero: false,
      explored: false,
      message: "Press One walk to draw a walk from A to B and its reflection from A' to B.",
    };
  }

  function setParam(state, key, value) {
    if (!(key in LIMITS)) return state;
    const next = { ...state, [key]: clamp(value, LIMITS[key]), path: null, reflected: null };
    return {
      ...next,
      explored: true,
      message: `Start ${next.a}, finish ${next.b}, ${steps(next)} steps. Press One walk again.`,
    };
  }

  function toggleNames(state) {
    return { ...state, showNames: !state.showNames, explored: true, message: state.message };
  }

  function addWalk(state, random = Math.random) {
    const { path, reflected, passedZero } = pair(state, random);
    return {
      ...state,
      path,
      reflected,
      passedZero,
      explored: true,
      message: reachable(state)
        ? `A walk reaches B from height ${state.a}; its reflection starts at ${-state.a}. ` +
          `There are ${countWalks(state)} walks from A to B.`
        : "These endpoints cannot be joined by up-and-down steps; try other values.",
    };
  }

  function result(state) {
    return state.explored ? "done" : null;
  }

  return {
    LIMITS, DEFAULTS, start, steps, reachable, countWalks, makeStep, pair,
    reflect, setParam, toggleNames, addWalk, result, binomial,
  };
})();
