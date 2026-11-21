"use strict";

/*
 * Collatz, from Alexander Bogomolny's applet Collatz.
 *
 * Start with a whole number. If it is even, halve it; if it is odd, replace it
 * by 3n + 1. Repeat. The conjecture says every start ends in the loop 4, 2, 1,
 * 4. The applet also offers two switches: "Strip of 2" removes every factor of
 * two in one step (giving the shorter 4, 1, 4 loop), and "(3n + 1)/2" uses the
 * economical rule for odd numbers.
 *
 * The one idea the code relies on is the applet's own Func + RunIterations:
 * walk the rule, keeping every value in a list and a hash set, and stop as
 * soon as a value repeats (a cycle) or MaxIter steps have been taken. The
 * repeated value is appended before stopping, just as the applet does.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CollatzCore, so the page loads it with a
 * plain <script> and porting/check-collatz.mjs loads it in Node. The position
 * is plain JSON (numbers, booleans, arrays, plain objects).
 */
const CollatzCore = (() => {
  const FACTOR = 3; // the applet's Factor field; it has no control on the panel
  const MAX_ITER = 150; // the applet's MaxIter field (an applet parameter)
  const DEFAULT_DIGITS = 2; // the applet's NumOfDigits field
  const MAX_DIGITS = 15; // the applet's MaxLength: the #Digits input's range
  const MAX_NUMBER = 999999999999999; // 15 digits, the largest the input allows

  function clampDigits(digits) {
    const d = Number(digits);
    return Number.isFinite(d) && d >= 1 && d <= MAX_DIGITS ? Math.floor(d) : DEFAULT_DIGITS;
  }

  function clampIter(maxIter) {
    const m = Number(maxIter);
    return Number.isFinite(m) && m >= 1 ? Math.floor(m) : MAX_ITER;
  }

  /**
   * SetNumOfDigits in the applet: a first digit 1..9 followed by `digits - 1`
   * digits 0..9, then parsed as a number. `rand` is injectable for tests.
   * Returns null where Long.parseLong would have failed ("too long").
   */
  function randomNumber(digits, rand) {
    const d = clampDigits(digits);
    const r = typeof rand === "function" ? rand : Math.random;
    let text = String(Math.floor(r() * 9) + 1);
    for (let i = 1; i < d; i++) text += String(Math.floor(r() * 10));
    const n = Number(text);
    return Number.isSafeInteger(n) && n <= MAX_NUMBER ? n : null;
  }

  /** A start must be a positive whole number the input can hold. */
  function normalizeNumber(value, digits, rand) {
    const n = Number(value);
    if (Number.isSafeInteger(n) && n >= 1 && n <= MAX_NUMBER) return n;
    return randomNumber(digits, rand) || 1;
  }

  /**
   * Func(long) from CollatzCanvas, with the applet's fields made explicit:
   * OriginalCollatz = (mode === "divide"), Shorten = shorten, Factor = factor.
   * `Math.trunc` is the applet's integer division (Java long truncates to 0).
   */
  function func(n, options) {
    const o = options || {};
    const factor = Number.isFinite(o.factor) ? o.factor : FACTOR;
    if (n % 2 === 0) {
      if (o.mode !== "strip") return n / 2;
      let x = n;
      while (x !== 0 && x % 2 === 0) x /= 2; // the guard keeps 0 from hanging
      return x;
    }
    return o.shorten ? Math.trunc((factor * n + 1) / 2) : factor * n + 1;
  }

  /**
   * RunIterations from the applet, transcribed: seed Vec/Hash with the start,
   * apply Func until a value is already in Hash or MaxIter is reached, and
   * append the repeated value before stopping. An arithmetic overflow is the
   * applet's Exception path ("<start> is problematic.").
   */
  function iterate(options) {
    const o = options || {};
    const number = normalizeNumber(o.number, o.digits, o.rand);
    const mode = o.mode === "strip" ? "strip" : "divide";
    const shorten = !!o.shorten;
    const factor = Number.isFinite(o.factor) ? o.factor : FACTOR;
    const maxIter = clampIter(o.maxIter);
    const cfg = { mode, shorten, factor };

    const sequence = [number];
    const seen = new Set([String(number)]);
    let n = number;
    let cycleFrom = null;
    let stop = "max";
    let announce = null;

    for (let i = 0; i < maxIter; i++) {
      n = func(n, cfg);
      if (!Number.isSafeInteger(n) || n < 0) {
        stop = "error";
        announce = String(number) + " is problematic.";
        break;
      }
      const key = String(n);
      sequence.push(n);
      if (seen.has(key)) {
        cycleFrom = sequence.indexOf(n);
        stop = "cycle";
        break;
      }
      seen.add(key);
    }
    return { number, mode, shorten, factor, maxIter, sequence, cycleFrom, stop, announce };
  }

  /** The position a new trail starts from. `options` can set number, digits,
   * mode ("divide" | "strip"), shorten, factor and maxIter. */
  function start(options) {
    const o = options || {};
    const t = iterate(o);
    return {
      number: t.number,
      digits: clampDigits(o.digits),
      mode: t.mode,
      shorten: t.shorten,
      factor: t.factor,
      maxIter: t.maxIter,
      sequence: t.sequence,
      cycleFrom: t.cycleFrom,
      stop: t.stop,
      announce: t.announce,
      index: 0,
    };
  }

  /** Recompute from the same start with some options changed. */
  function rebuild(state, changes) {
    return start(Object.assign({}, state, changes));
  }

  const atEnd = (state) => state.index >= state.sequence.length - 1;

  function step(state) {
    return atEnd(state) ? state : Object.assign({}, state, { index: state.index + 1 });
  }

  function back(state) {
    return state.index <= 0 ? state : Object.assign({}, state, { index: state.index - 1 });
  }

  function showAll(state) {
    return atEnd(state) ? state : Object.assign({}, state, { index: state.sequence.length - 1 });
  }

  /** "done" once the whole trail has been revealed, null while it goes on. */
  function result(state) {
    return atEnd(state) ? "done" : null;
  }

  function legalMoves(state) {
    return atEnd(state) ? [] : ["step"];
  }

  function move(state, m) {
    return m === "step" ? step(state) : null;
  }

  /** Number of Func applications used to make the trail. */
  function steps(state) {
    return state.sequence.length - 1;
  }

  /** The values that repeat, in order (without the appended copy). */
  function cycle(state) {
    return state.stop === "cycle" && state.cycleFrom !== null
      ? state.sequence.slice(state.cycleFrom, -1)
      : [];
  }

  /** Steps until the trail first reaches 1, or null if it never does. */
  function stoppingTime(number, options) {
    const seq = iterate(Object.assign({ number }, options || {})).sequence;
    const at = seq.indexOf(1);
    return at < 0 ? null : at;
  }

  /** A closing sentence for the trail, in words. */
  function summary(state) {
    if (state.stop === "error") return state.announce;
    if (state.stop === "cycle") {
      return "Reached the " + cycle(state).join(", ") + " loop after " + steps(state) + " steps.";
    }
    return "After " + steps(state) + " steps the numbers had not closed a loop yet.";
  }

  /** What to say in #status after an action. */
  function describe(action, state) {
    const n = state.sequence[state.index];
    switch (action) {
      case "start":
        return "Starting at " + state.number + ". Press Next step to follow the trail.";
      case "number":
        return "New start: " + state.number + ".";
      case "mode":
        return state.mode === "strip"
          ? "Even numbers are stripped of all their twos in one step."
          : "Even numbers are divided by two, one step at a time.";
      case "shorten":
        return state.shorten
          ? "Odd numbers now use (3n + 1)/2."
          : "Odd numbers now use 3n + 1.";
      case "new":
        return "A new " + state.digits + "-digit number: " + state.number + ".";
      case "reset":
        return "Trail reset to " + state.number + ".";
      case "step":
        if (state.index === 0) return "Starting at " + n + ".";
        return (n % 2 === 0 ? "even" : "odd") + " " + state.sequence[state.index - 1] +
          " became " + n + " (step " + state.index + ").";
      case "back":
        return "Back to step " + state.index + ": " + n + ".";
      case "all":
        return summary(state);
      default:
        return "";
    }
  }

  return {
    FACTOR, MAX_ITER, DEFAULT_DIGITS, MAX_DIGITS, MAX_NUMBER,
    func, iterate, randomNumber, normalizeNumber, start, rebuild,
    step, back, showAll, result, legalMoves, move,
    steps, cycle, stoppingTime, summary, describe,
  };
})();
