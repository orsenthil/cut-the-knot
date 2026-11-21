"use strict";

/*
 * Jefferson's Apportionment Method, from Bogomolny's applet Jefferson.
 *
 * Seats are shared among states proportionally to their populations. The
 * standard divisor is total population divided by seats; Jefferson lowers it
 * until the floors of the quotas add exactly to the house size. Equivalently
 * each successive seat goes to the state with the largest pop/(seats+1), the
 * D'Hondt priority — the same rule Jefferson used in 1791.
 *
 * The key idea is that lowering the divisor raises every quota, so a divisor
 * exists that makes the floors fill the house. The logic test checks the
 * divisor interval, the D'Hondt priorities, the house total and agreement
 * with the site's combined apportionment calculator.
 *
 * No document, no window, no storage: one global, JeffersonApportionmentCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const JeffersonApportionmentCore = (() => {
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
    return total(state) / state.seats;
  }

  function priority(pop, seats) {
    return pop === 0 ? -Infinity : pop / (seats + 1);
  }

  /** Give each seat to the largest D'Hondt priority. */
  function allocate(state) {
    const seats = state.populations.map(() => 0);
    for (let k = 0; k < state.seats; k++) {
      let best = 0;
      let value = -Infinity;
      for (let i = 0; i < seats.length; i++) {
        const p = state.populations[i] === 0 ? -Infinity : priority(state.populations[i], seats[i]);
        if (p > value) { value = p; best = i; }
      }
      seats[best]++;
    }
    return seats;
  }

  /**
   * A divisor that realizes the allocation by rounding down: for state i,
   * p/(a+1) < D <= p/a. Take the midpoint of the resulting interval.
   */
  function findDivisor(state) {
    const allocation = allocate(state);
    let lower = 0;
    let upper = Infinity;
    state.populations.forEach((p, i) => {
      if (p === 0) return;
      lower = Math.max(lower, p / (allocation[i] + 1));
      if (allocation[i] > 0) upper = Math.min(upper, p / allocation[i]);
    });
    if (!Number.isFinite(upper)) upper = lower * 2 || 1;
    if (lower >= upper) return upper * (1 - 1e-12);
    return (lower + upper) / 2;
  }

  function analyze(state, divisor) {
    const final = allocate(state);
    const d = divisor || findDivisor(state);
    const quotas = state.populations.map((p) => (d > 0 ? p / d : 0));
    return {
      divisor: d,
      standardDivisor: standardDivisor(state),
      quotas,
      lower: quotas.map(Math.floor),
      final,
      total: final.reduce((a, b) => a + b, 0),
      letters: state.populations.map((_, i) => LETTERS[i]),
      priority: state.populations.map((p, i) => priority(p, final[i])),
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
    start, total, standardDivisor, priority, allocate, findDivisor, analyze,
    setPopulation, setSeats, setStates,
  };
})();
