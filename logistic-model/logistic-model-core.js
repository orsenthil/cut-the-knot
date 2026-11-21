"use strict";

/*
 * Logistic Model, from Bogomolny's applet LogisticModel.
 *
 * The population p_{n+1} = r p_n (1 - p_n) is the classic model for growth
 * with limited resources. As r increases the long-term behaviour changes from
 * a fixed point to cycles of doubling length and then to chaos. The applet
 * plots the orbit for a chosen r and starting value p0.
 *
 * The key idea is that a map of an interval into itself cannot leave it, so
 * the orbit is bounded; its tail reveals the attractor. The logic test checks
 * the recurrence, the invariant interval, known fixed points and period-two
 * and chaotic regimes, and a Lyapunov estimate.
 *
 * No document, no window, no storage: one global, LogisticModelCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const LogisticModelCore = (() => {
  const MIN_ITER = 8;
  const MAX_ITER = 400;

  const clamp = (v, lo, hi, fb) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
  };

  function start() {
    return { r: 3.2, p0: 0.25, iterations: 120 };
  }

  function next(r, p) {
    return r * p * (1 - p);
  }

  function orbit(state, count) {
    const n = count === undefined ? state.iterations : clamp(count, MIN_ITER, MAX_ITER, state.iterations);
    const values = [state.p0];
    let p = state.p0;
    for (let i = 1; i < n; i++) {
      p = next(state.r, p);
      values.push(p);
    }
    return values;
  }

  /** Approximate the eventual period by comparing the tail with itself. */
  function period(values, tolerance = 1e-6) {
    const tail = values.slice(Math.floor(values.length / 2));
    for (let k = 1; k <= Math.min(32, Math.floor(tail.length / 2)); k++) {
      let ok = true;
      for (let i = 0; i + k < tail.length; i++) {
        if (Math.abs(tail[i] - tail[i + k]) > tolerance) { ok = false; break; }
      }
      if (ok) return k;
    }
    return null;
  }

  /** Average log |f'| over the tail; positive suggests chaos. */
  function lyapunov(state, count = 600) {
    const values = orbit({ ...state, iterations: count }, count);
    const startAt = Math.floor(count / 3);
    let sum = 0;
    let used = 0;
    for (let i = startAt; i < values.length - 1; i++) {
      const derivative = state.r * (1 - 2 * values[i]);
      if (Math.abs(derivative) < 1e-12) continue;
      sum += Math.log(Math.abs(derivative));
      used++;
    }
    return used ? sum / used : 0;
  }

  function analyze(state) {
    const values = orbit(state);
    const p = period(values);
    return {
      r: state.r,
      p0: state.p0,
      iterations: state.iterations,
      values,
      last: values[values.length - 1],
      min: Math.min(...values),
      max: Math.max(...values),
      inInterval: values.every((v) => v >= 0 && v <= 1),
      period: p,
      lyapunov: lyapunov(state),
    };
  }

  function setR(state, value) { return { ...state, r: clamp(value, 0, 4, state.r) }; }
  function setP0(state, value) { return { ...state, p0: clamp(value, 0, 1, state.p0) }; }
  function setIterations(state, value) {
    return { ...state, iterations: clamp(value, MIN_ITER, MAX_ITER, state.iterations) };
  }

  return {
    MIN_ITER, MAX_ITER, clamp, start, next, orbit, period, lyapunov,
    analyze, setR, setP0, setIterations,
  };
})();
