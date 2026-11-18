"use strict";

/*
 * Five Methods of Apportionment, from Bogomolny's applet ApportionmentApplet.
 *
 * The applet combines Hamilton, Jefferson, Adams, Webster and Huntington-Hill
 * in one calculator. Seats are shared among states in proportion to their
 * populations. Hamilton rounds quotas down and hands the surplus to the
 * largest remainders. The other four are divisor methods: choose a divisor D
 * and round each quota population/D by a rule (down, up, nearest, or by the
 * geometric mean) until the rounded values add to the number of seats.
 *
 * The key idea is that the rounded total is a non-increasing step function of
 * D, so a divisor can be found by binary search. The logic test checks that
 * every method apportions exactly, that the four divisor methods use their own
 * rounding rules, and that Hamilton and Adams agree with the earlier ports.
 *
 * This applet was written for Peter Tannenbaum's textbook and reproduced with
 * permission; this is an independent implementation of the published methods.
 *
 * No document, no window, no storage: one global, ApportionmentMethodsCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const ApportionmentMethodsCore = (() => {
  const MIN_STATES = 1;
  const MAX_STATES = 26;
  const MIN_SEATS = 1;
  const MAX_SEATS = 1000;
  const MAX_POP = 1000;
  const METHODS = ["hamilton", "jefferson", "adams", "webster", "huntington-hill"];
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const clamp = (v, low, high, fallback) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
  };

  function start(options) {
    const opts = options || {};
    const seats = clamp(opts.seats === undefined ? 23 : opts.seats, MIN_SEATS, MAX_SEATS, 23);
    const states = clamp(opts.states === undefined ? 3 : opts.states, MIN_STATES, MAX_STATES, 3);
    const random = opts.random || Math.random;
    const populations = opts.populations
      ? opts.populations.slice(0, states).map((p) => clamp(p, 0, MAX_POP, 0))
      : Array.from({ length: states }, () => Math.floor(random() * 300));
    return { seats, states, populations };
  }

  function total(state) {
    return state.populations.reduce((a, b) => a + b, 0);
  }

  function standardDivisor(state) {
    return state.seats > 0 ? total(state) / state.seats : 0;
  }

  /** The rounding rule that defines a divisor method. */
  function round(method, quota, n) {
    if (method === "jefferson") return Math.floor(quota);
    if (method === "adams") return Math.ceil(quota);
    if (method === "webster") return Math.floor(quota + 0.5);
    // Huntington-Hill: round up past the geometric mean of n and n+1.
    return quota > Math.sqrt(n * (n + 1)) ? n + 1 : n;
  }

  function sum(a) {
    return a.reduce((x, y) => x + y, 0);
  }

  /**
   * The divisor method's priority for the next seat at a state with s seats.
   * A seat goes to the state whose rounding threshold pop/threshold is largest.
   */
  function priority(pop, seats, method) {
    if (pop === 0) return -Infinity; // a state with no people gets no seats
    if (method === "jefferson") return pop / (seats + 1);
    if (method === "adams") return seats === 0 ? Infinity : pop / seats;
    if (method === "webster") return pop / (seats + 0.5);
    return seats === 0 ? Infinity : pop / Math.sqrt(seats * (seats + 1));
  }

  /**
   * Allocate seats one at a time by priority. This is the same rule as picking
   * a modified divisor, but always fills the house exactly even when several
   * states cross a rounding threshold together.
   */
  function allocate(state, method) {
    const seats = state.populations.map(() => 0);
    const n = seats.length;
    if (method === "adams" && state.seats < n) {
      // Adams rounds up, so the largest states get the first seats.
      const order = state.populations.map((_, i) => i)
        .filter((i) => state.populations[i] > 0)
        .sort((a, b) => state.populations[b] - state.populations[a]);
      for (const i of order.slice(0, state.seats)) seats[i] = 1;
      return seats;
    }
    for (let k = 0; k < state.seats; k++) {
      let best = 0;
      let value = -Infinity;
      for (let i = 0; i < n; i++) {
        const p = priority(state.populations[i], seats[i], method);
        if (p > value) { value = p; best = i; }
      }
      seats[best]++;
    }
    return seats;
  }

  function allocationAt(state, method, divisor) {
    if (divisor <= 0) return state.populations.map(() => 0);
    return state.populations.map((pop) => {
      const quota = pop / divisor;
      return round(method, quota, Math.floor(quota));
    });
  }

  function hamilton(state) {
    const d = standardDivisor(state);
    const quotas = state.populations.map((p) => (d > 0 ? p / d : 0));
    const lower = quotas.map(Math.floor);
    const leftover = quotas.map((q, i) => q - lower[i]);
    const surplus = state.seats - sum(lower);
    const order = leftover.map((_, i) => i).sort((a, b) => (leftover[b] - leftover[a]) || (a - b));
    const winners = new Set(order.slice(0, Math.max(0, surplus)));
    const final = lower.map((n, i) => n + (winners.has(i) ? 1 : 0));
    return { divisor: d, method: "hamilton", quotas, lower, final, surplus, winners: [...winners] };
  }

  function apportion(state, method) {
    if (method === "hamilton") return hamilton(state);
    if (!METHODS.includes(method)) throw new Error(`unknown method ${method}`);
    const final = allocate(state, method);
    const divisor = standardDivisor(state);
    return {
      divisor,
      method,
      quotas: state.populations.map((p) => (divisor ? p / divisor : 0)),
      final,
      surplus: state.seats - sum(final),
      winners: [],
    };
  }

  function setPopulation(state, index, value) {
    if (index < 0 || index >= state.populations.length) return state;
    const populations = state.populations.slice();
    populations[index] = clamp(value, 0, MAX_POP, 0);
    return { ...state, populations };
  }

  function setSeats(state, value) {
    return { ...state, seats: clamp(value, MIN_SEATS, MAX_SEATS, state.seats) };
  }

  function setStates(state, value) {
    const states = clamp(value, MIN_STATES, MAX_STATES, state.states);
    const populations = state.populations.slice(0, states);
    while (populations.length < states) populations.push(Math.floor(Math.random() * 300));
    return { ...state, states, populations };
  }

  return {
    MIN_STATES, MAX_STATES, MIN_SEATS, MAX_SEATS, MAX_POP, METHODS, LETTERS,
    start, total, standardDivisor, round, priority, allocate, allocationAt, hamilton,
    apportion, setPopulation, setSeats, setStates,
  };
})();
