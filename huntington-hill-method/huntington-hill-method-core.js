"use strict";

/*
 * Huntington-Hill Apportionment Method, from Bogomolny's applet HH.
 *
 * Seats are shared among states by rounding each quota population/D by the
 * "method of equal proportions": round up past sqrt(L(L+1)) rather than the
 * midpoint L + 1/2 used by Webster. The divisor D is adjusted until the
 * rounded allocations fill the house.
 *
 * The key idea is that the priority for the next seat at a state with s seats
 * is population / sqrt(s(s+1)); giving each seat to the largest priority is
 * equivalent to finding the right divisor. The logic test checks that rule,
 * the geometric-mean cutoff, and that the allocation always fills the house.
 *
 * No document, no window, no storage: one global, HuntingtonHillMethodCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const HuntingtonHillMethodCore = (() => {
  const MIN_STATES = 1;
  const MAX_STATES = 26;
  const MIN_SEATS = 1;
  const MAX_SEATS = 1000;
  const MAX_POP = 1000;
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const clamp = (v, lo, hi, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
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

  /** The geometric-mean cutoff between L and L+1. */
  function cutoff(lower) {
    return Math.sqrt(lower * (lower + 1));
  }

  /** Round a quota by the method of equal proportions. */
  function round(quota) {
    const lower = Math.floor(quota);
    return quota > cutoff(lower) ? lower + 1 : lower;
  }

  function priority(pop, seats) {
    if (pop === 0) return -Infinity;
    return seats === 0 ? Infinity : pop / Math.sqrt(seats * (seats + 1));
  }

  /** Give each seat to the state with the largest priority. */
  function allocate(state) {
    const seats = state.populations.map(() => 0);
    if (state.seats < seats.length) {
      const order = state.populations.map((_, i) => i)
        .filter((i) => state.populations[i] > 0)
        .sort((a, b) => state.populations[b] - state.populations[a]);
      for (const i of order.slice(0, state.seats)) seats[i] = 1;
      return seats;
    }
    for (let k = 0; k < state.seats; k++) {
      let best = 0;
      let value = -Infinity;
      for (let i = 0; i < seats.length; i++) {
        const p = priority(state.populations[i], seats[i]);
        if (p > value) { value = p; best = i; }
      }
      seats[best]++;
    }
    return seats;
  }

  function analyze(state, divisor) {
    const d = divisor || standardDivisor(state);
    const final = allocate(state);
    const quotas = state.populations.map((p) => (d > 0 ? p / d : 0));
    return {
      divisor: d, quotas, final,
      rounded: quotas.map(round),
      lower: quotas.map(Math.floor),
      cutoffs: quotas.map((q) => cutoff(Math.floor(q))),
      total: final.reduce((a, b) => a + b, 0),
      letters: state.populations.map((_, i) => LETTERS[i]),
    };
  }

  function setPopulation(state, i, value) {
    if (i < 0 || i >= state.populations.length) return state;
    const populations = state.populations.slice();
    populations[i] = clamp(value, 0, MAX_POP, 0);
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
    MIN_STATES, MAX_STATES, MIN_SEATS, MAX_SEATS, MAX_POP, LETTERS,
    start, total, standardDivisor, cutoff, round, priority, allocate, analyze,
    setPopulation, setSeats, setStates,
  };
})();
