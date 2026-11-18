"use strict";

/*
 * Adams' apportionment method, from Bogomolny's applet Adams.
 *
 * Seats are divided among states in proportion to their populations. The
 * standard divisor is total population divided by the number of seats. Adams
 * rounds every quota UP, so the sum is too large; a slightly larger divisor
 * reduces the upward quotas until they add up to exactly the number of seats.
 *
 * The key idea is that the sum of ceil(population / d) falls as d grows, so a
 * divisor can be found by binary search. The logic test checks, over many
 * random countries, that such a divisor exists whenever there are at least as
 * many seats as states, and that every column agrees with the applet's own
 * floor/ceil operations.
 *
 * No document, no window, no storage: one global, AdamsApportionmentCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const AdamsApportionmentCore = (() => {
  const MIN_STATES = 1;
  const MAX_STATES = 26;
  const MIN_SEATS = 1;
  const MAX_SEATS = 1000;
  const MIN_DIVISOR = 1;
  const MAX_DIVISOR = 1000;
  const MAX_POP = 1000;
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const clamp = (value, low, high, fallback) => {
    const v = Math.trunc(Number(value));
    return Number.isFinite(v) ? Math.max(low, Math.min(high, v)) : fallback;
  };

  function start(options) {
    const opts = options || {};
    const seats = clamp(opts.seats === undefined ? 23 : opts.seats, MIN_SEATS, MAX_SEATS, 23);
    const states = clamp(opts.states === undefined ? 3 : opts.states, MIN_STATES, MAX_STATES, 3);
    const random = opts.random || Math.random;
    const populations = opts.populations
      ? opts.populations.slice(0, states).map((p) => clamp(p, 0, MAX_POP, 0))
      : Array.from({ length: states }, () => Math.floor(random() * 300));
    const state = { seats, states, populations, divisor: null };
    return { ...state, divisor: findDivisor(state) || (1000 / seats) };
  }

  function total(state) {
    return state.populations.reduce((sum, p) => sum + p, 0);
  }

  function standardDivisor(state) {
    return state.seats > 0 ? total(state) / state.seats : 0;
  }

  function quotas(state, divisor) {
    const std = standardDivisor(state);
    return state.populations.map((pop) => ({
      population: pop,
      standard: std > 0 ? pop / std : 0,
      lower: Math.floor(std > 0 ? pop / std : 0),
      modified: divisor > 0 ? pop / divisor : 0,
      upward: Math.ceil(divisor > 0 ? pop / divisor : 0),
    }));
  }

  /** The smallest divisor (at least the standard one) whose up-quotas fit. */
  function findDivisor(state) {
    if (!state.populations.length || state.seats < 1) return null;
    const at = (d) => quotas(state, d).reduce((sum, q) => sum + q.upward, 0);
    const std = standardDivisor(state);
    let low = Math.max(MIN_DIVISOR, std);
    let high = Math.max(low + 1, Math.max(...state.populations) + 1);
    if (at(high) > state.seats) {
      // Even a huge divisor leaves too many positive states; no solution.
      return null;
    }
    for (let i = 0; i < 80; i++) {
      const mid = (low + high) / 2;
      if (at(mid) <= state.seats) high = mid;
      else low = mid;
    }
    return at(high) === state.seats ? high : null;
  }

  function allocation(state, divisor) {
    return quotas(state, divisor).map((q) => q.upward);
  }

  function sumOf(state, divisor) {
    return allocation(state, divisor).reduce((a, b) => a + b, 0);
  }

  function setPopulation(state, index, value) {
    if (index < 0 || index >= state.populations.length) return state;
    const populations = state.populations.slice();
    populations[index] = clamp(value, 0, MAX_POP, 0);
    const next = { ...state, populations };
    return { ...next, divisor: findDivisor(next) || state.divisor };
  }

  function setSeats(state, value) {
    const seats = clamp(value, MIN_SEATS, MAX_SEATS, state.seats);
    const next = { ...state, seats };
    return { ...next, divisor: findDivisor(next) || state.divisor };
  }

  function setStates(state, value) {
    const states = clamp(value, MIN_STATES, MAX_STATES, state.states);
    const populations = state.populations.slice(0, states);
    while (populations.length < states) populations.push(Math.floor(Math.random() * 300));
    const next = { ...state, states, populations };
    return { ...next, divisor: findDivisor(next) || state.divisor };
  }

  return {
    MIN_STATES, MAX_STATES, MIN_SEATS, MAX_SEATS, MIN_DIVISOR, MAX_DIVISOR, MAX_POP, LETTERS,
    start, total, standardDivisor, quotas, findDivisor, allocation, sumOf,
    setPopulation, setSeats, setStates,
  };
})();
