"use strict";

/*
 * Number Guessing — Alexander Bogomolny's applet "Cards".
 *
 * The computer shows a card full of numbers. You think of a number from 1 to
 * 99 and say whether it is on the card. The trick is that each card is one
 * binary digit: card k lists exactly the numbers whose k-th bit (counting
 * from the right, starting at 0) equals a randomly chosen bit. Saying "Yes"
 * tells the computer that bit is the one on the card; saying "No" tells it the
 * bit is the other one. Seven answers fix seven bits, and seven bits can hold
 * every number below 100 ((1111111)2 = 127).
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, CardsCore, so the page loads it with a
 * plain <script> and porting/check-cards.mjs loads it in Node. Every function
 * takes a plain-data position and returns a new one; none mutates its input.
 */

const CardsCore = (() => {
  // The applet's own constants (CardsCanvas constructor and Reset).
  const MAX = 100; // cards list i with 1 <= i < MAX ("positive integer less than 100")
  const BITS = 7; // cards for positions 0..6: after answer 7 the number is announced
  const COLS = 10; // m_N: ten numbers per row on the printed card

  /** Faithful to (int)(Math.random() * 2) in DrawCard: a fresh bit, 0 or 1. */
  function chooseBit(random) {
    return Math.floor((random || Math.random)() * 2) & 1;
  }

  /** The bit of n at position k, counting from the right. */
  function bitAt(n, k) {
    return (n >> k) & 1;
  }

  /**
   * A new game. `options.bit` fixes the first card's bit (for tests);
   * otherwise a random source in `options.random` (or Math.random) deals it.
   */
  function start(options) {
    const o = options || {};
    const bit = o.bit !== undefined ? o.bit : chooseBit(o.random);
    return { cardNo: 0, result: 0, bit, done: false, guess: null };
  }

  /**
   * The numbers printed on the current card, transcribed literally from
   * DrawCard's two conditions:
   *   ((i & (1 << k)) > 0 && bit === 1) || ((i & (1 << k)) == 0 && bit === 0)
   * for every i from 1 up to (but not including) max.
   */
  function cardNumbers(state, options) {
    const max = (options && options.max) || MAX;
    if (state.done || state.cardNo >= BITS) return [];
    const k = state.cardNo;
    const bit = state.bit;
    const out = [];
    for (let i = 1; i < max; i++) {
      const mask = i & (1 << k);
      if (mask > 0 && bit === 1) {
        out.push(i);
      } else if (mask === 0 && bit === 0) {
        out.push(i);
      }
    }
    return out;
  }

  /** The moves allowed now: the applet's Yes and No buttons, or none at the end. */
  function legalMoves(state) {
    return state.done ? [] : ["Yes", "No"];
  }

  /** How much an answer adds to the answer, faithful to Yes() and No(). */
  function contribution(answer, bit, cardNo) {
    const weight = 1 << cardNo;
    if (answer === "Yes") return bit === 1 ? weight : 0;
    if (answer === "No") return bit === 0 ? weight : 0;
    return null;
  }

  /**
   * The position after an answer. An answer of "Yes" keeps the bit shown on
   * the card; "No" takes the other bit. After the seventh answer (cardNo 7)
   * the applet announces "Your number is <result>" and disables Yes and No.
   * A fresh, random bit is dealt for the next card, as repaint -> update ->
   * DrawCard does.
   */
  function answer(state, answerValue, options) {
    if (state.done || (answerValue !== "Yes" && answerValue !== "No")) return null;
    const o = options || {};
    const add = contribution(answerValue, state.bit, state.cardNo);
    const result = state.result + add;
    const cardNo = state.cardNo + 1;
    const done = cardNo > BITS - 1;
    const bit = done
      ? state.bit
      : o.bit !== undefined
        ? o.bit
        : chooseBit(o.random);
    return { cardNo, result, bit, done, guess: done ? result : null };
  }

  /** "done" once the number has been announced; null while cards are showing. */
  function result(state) {
    return state.done ? "done" : null;
  }

  /** The applet's exact closing message, or null while the game is running. */
  function reveal(state) {
    return state.done ? "Your number is " + state.guess : null;
  }

  /** The honest answer for someone holding `secret`: is it on this card? */
  function correctAnswer(secret, state, options) {
    return cardNumbers(state, options).indexOf(secret) >= 0 ? "Yes" : "No";
  }

  return {
    MAX, BITS, COLS,
    chooseBit, bitAt, start, cardNumbers, legalMoves,
    contribution, answer, result, reveal, correctAnswer,
  };
})();
