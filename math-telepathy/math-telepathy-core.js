"use strict";

/*
 * Math Telepathy, from Alexander Bogomolny's applet MathTelepathy.
 *
 * The player picks a number, shuffles its digits to make a second number,
 * subtracts the smaller from the larger and circles one non-zero digit of the
 * difference. They then give the computer all the other digits, one button
 * press each, and the computer names the circled digit.
 *
 * Why: shuffling does not change the digit sum, so the two numbers have the
 * same remainder mod 9, and their difference is a multiple of 9. The digits of
 * a multiple of 9 add up to a multiple of 9, so the circled digit is what the
 * other digits need to reach the next multiple: 9 minus their sum mod 9. (A
 * circled 9 makes the rest a multiple of 9 already, so the answer is 9, never 0,
 * since a circled digit is non-zero.)
 *
 * The position is plain data: { digits: [the digits given, in order], guessed }
 * with guessed null until the player presses Guess.
 */
const MathTelepathyCore = (() => {
  const INSTRUCTIONS = [
    "Pick up a multidigit number.",
    "Reshuffle its digits to get a second number.",
    "Subtract the smaller number from the larger one.",
    "Circle one non-zero digit of the difference.",
    "Think hard about this digit.",
    "Click on the buttons below: once for every digit,",
    "but the selected one.",
    'Click "Guess" when finished.',
    "See what happens ...",
  ];

  const start = () => ({ digits: [], guessed: null });

  /** The player gives one more digit (0..9). Giving a digit clears any guess. */
  function add(state, d) {
    if (!Number.isInteger(d) || d < 0 || d > 9) return null;
    return { digits: state.digits.concat([d]), guessed: null };
  }

  /** Take back the last digit given; null when there is nothing to take back. */
  function takeBack(state) {
    if (state.digits.length === 0) return null;
    return { digits: state.digits.slice(0, -1), guessed: null };
  }

  /** The digit the computer names: 9 minus the digits' sum mod 9. */
  const read = (digits) => 9 - (digits.reduce((t, d) => t + d, 0) % 9);

  /** Press Guess: the position with the computer's answer. */
  const guess = (state) => ({ digits: state.digits, guessed: read(state.digits) });

  /** Is Take back allowed? (The applet disables it with nothing entered.) */
  const canTakeBack = (state) => state.digits.length > 0;

  /** The digits of a whole number, as a list. */
  const digitsOf = (n) => String(n).split("").map(Number);

  return { INSTRUCTIONS, start, add, takeBack, read, guess, canTakeBack, digitsOf };
})();
