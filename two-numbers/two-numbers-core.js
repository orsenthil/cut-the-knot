"use strict";

/*
 * Two Numbers, from Alexander Bogomolny's applet TwoNumbers.
 *
 * The computer shows two numbers, one even and one odd, and tells you to
 * multiply the one you pick by an odd (or even) number and the other by an
 * even (or odd) number. The even number always gives an even product; the
 * odd number gives an odd product only when it gets the odd multiplier. So
 * the parity of the sum tells which number had the odd multiplier, and hence
 * which one you picked.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, TwoNumbersCore, so the page loads it
 * with a plain <script> and porting/check-two-numbers.mjs loads it in Node.
 * The position is plain data and every function returns a new position.
 *
 * Transcribed from TwoNumbersCanvas.NewGuess / Draw / Guess / TryAgain.
 */
const TwoNumbersCore = (() => {
  // NewGuess: (int)(Math.random()*5)*2+2 is even 2..10; *2+1 is odd 1..9.
  const EVENS = [2, 4, 6, 8, 10];
  const ODDS = [1, 3, 5, 7, 9];

  /** The applet's three random draws, made reproducible for the tests. */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Java's int remainder: -3 % 2 is -1, not 1. JavaScript's % agrees. */
  const javaRem = (a, b) => a - Math.trunc(a / b) * b;

  /** TwoNumbersCanvas.NewGuess(), with the random draws injected. */
  function newPuzzle(seed, rand = rng(seed)) {
    const odd1 = rand() < 0.5; // dcmpg/ifge: random >= 0.5 gives false
    const odd2 = rand() < 0.5;
    let n = Math.floor(rand() * 5) * 2 + 2;
    let m = Math.floor(rand() * 5) * 2 + 1;
    if (odd1) { const t = n; n = m; m = t; }
    return { seed, n, m, odd1, odd2 };
  }

  /** A fresh position. `rand` is only ever used by the logic test. */
  function start(options = {}) {
    const seed = Number.isSafeInteger(Number(options.seed)) ? Number(options.seed) : 1;
    const rand = typeof options.rand === "function" ? options.rand : rng(seed);
    return {
      ...newPuzzle(seed, rand),
      sum: null,
      announcement: null,
      announced: null,
      guesses: Number.isSafeInteger(options.guesses) ? options.guesses : 0,
    };
  }

  /** The two lines the applet draws about which multiplier goes where. */
  const instruction = (state) => ({
    chosenWord: state.odd2 ? "odd" : "even",
    otherWord: state.odd2 ? "even" : "odd",
  });

  /*
   * TwoNumbersCanvas.Guess(sum), without the repaint. The bytecode compares
   * `sum % 2` with (odd2 ? 1 : 0): equal names odd1 ? n : m (the odd number),
   * otherwise odd1 ? m : n (the even number). It never looks at the size of
   * the sum, nor at which number the player meant to pick.
   */
  function announce(state, sum) {
    const value = Number(sum);
    const matches = javaRem(value, 2) === (state.odd2 ? 1 : 0);
    const number = matches ? (state.odd1 ? state.n : state.m) : (state.odd1 ? state.m : state.n);
    return { number, matches, text: `You chose ${number}.` };
  }

  /** Enter a sum: the applet sets its announcement and stops asking. */
  function guess(state, sum) {
    if (!/^-?\d+$/.test(String(sum).trim())) return state; // the text field only accepts digits
    const value = Number(sum);
    if (!Number.isSafeInteger(value)) return state;
    const a = announce(state, value);
    return { ...state, sum: value, announcement: a.text, announced: a.number, guesses: state.guesses + 1 };
  }

  /** TwoNumbersCanvas.TryAgain(): clear the answer; the next draw is a new puzzle. */
  function tryAgain(state) {
    return start({ seed: state.seed + 1, guesses: state.guesses });
  }

  const again = tryAgain;
  const result = (state) => (state.announcement === null ? null : "done");

  return { EVENS, ODDS, rng, javaRem, newPuzzle, start, instruction, announce, guess, tryAgain, again, result };
})();
