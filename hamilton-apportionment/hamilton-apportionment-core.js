"use strict";

/*
 * Hamilton's apportionment method, from Bogomolny's applet AHamilton.
 *
 * Seats are shared out in proportion to populations. Each state's standard
 * quota is its population divided by total-population-over-seats. Every state
 * first receives the whole-number part of its quota; the leftover seats then
 * go one each to the states with the largest fractional leftovers, smallest
 * state index winning a tie (as the applet's GetMax scan does).
 *
 * The key idea is that the fractional parts always add to a whole number of
 * seats, so the surplus is well defined. The logic test checks that property,
 * the quota rule, and the paradoxes the page mentions — a state can lose a
 * seat when the house grows, or to a slower-growing state.
 *
 * No document, no window, no storage: one global, HamiltonApportionmentCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const HamiltonApportionmentCore = (() => {
  const MIN_STATES = 1;
  const MAX_STATES = 26;
  const MIN_SEATS = 1;
  const MAX_SEATS = 1000;
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
    return { seats, states, populations };
  }

  function total(state) {
    return state.populations.reduce((a, b) => a + b, 0);
  }

  function standardDivisor(state) {
    return state.seats > 0 ? total(state) / state.seats : 0;
  }

  /** The columns the applet draws: Standard Q, Lower Q, Leftover, Surplus, Final. */
  function apportion(state) {
    const d = standardDivisor(state);
    const quotas = state.populations.map((p) => (d > 0 ? p / d : 0));
    const lower = quotas.map((q) => Math.floor(q));
    const leftover = quotas.map((q, i) => q - lower[i]);
    const surplus = state.seats - lower.reduce((a, b) => a + b, 0);
    // GetMax scans from index 0 with a strict '>' and skips already chosen
    // states, so ties go to the smaller index.
    const order = leftover.map((_, i) => i).sort((a, b) => (leftover[b] - leftover[a]) || (a - b));
    const winners = new Set(order.slice(0, Math.max(0, surplus)));
    const final = lower.map((n, i) => n + (winners.has(i) ? 1 : 0));
    return { divisor: d, quotas, lower, leftover, surplus, order, winners: [...winners], final };
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
    MIN_STATES, MAX_STATES, MIN_SEATS, MAX_SEATS, MAX_POP, LETTERS,
    start, total, standardDivisor, apportion, setPopulation, setSeats, setStates,
  };
})();
