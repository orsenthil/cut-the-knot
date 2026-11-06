"use strict";

/*
 * Euclid's Game on a Square Grid (Bogomolny's JEuclidGame applet).
 *
 * The numbers 1 .. N*N fill an N by N grid (N from 4 to 12, 6 to start). Two
 * of them, chosen at random, start marked. Players take turns marking a new
 * number that is the difference of two marked ones; whoever cannot move loses.
 *
 * The key idea is Euclid's algorithm. Repeated differences of a and b reach
 * their greatest common divisor g, and then every multiple of g up to the
 * larger number: the game always ends with exactly those marked, however it is
 * played. So it always lasts max/g - 2 moves, and the winner is decided before
 * it starts: the first player wins exactly when that number is odd.
 *
 * Read off the bytecode (JEuclidGameGame): RecordMove() accepts a number only
 * if it is unmarked, a multiple of g, and the difference of two marked numbers
 * no bigger than the maximum; Play() is the computer, which has no strategy (it
 * marks the first new difference it finds, scanning pairs of multiples of g in
 * order); IsOver() is "every multiple of g up to the maximum is marked". The
 * applet's "You start" button makes the computer move first.
 */

var EuclidGameCore = (function () {
  const MIN_N = 4;
  const MAX_N = 12;
  const DEFAULT_N = 6;

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  /** NewGame(): two different numbers in 1 .. n*n. */
  function start(n, rnd = Math.random) {
    const cells = n * n;
    const a = Math.trunc(rnd() * cells) + 1;
    let b = a;
    while (b === a) b = Math.trunc(rnd() * cells) + 1;
    return fromPair(n, a, b);
  }

  function fromPair(n, a, b) {
    const marked = new Array(n * n + 1).fill(null); // marked[x]: who marked x
    marked[a] = "start";
    marked[b] = "start";
    return { n, a, b, max: Math.max(a, b), g: gcd(a, b), marked, moves: 0, turn: "you", winner: null };
  }

  const isMarked = (s, x) => x >= 1 && x <= s.n * s.n && s.marked[x] !== null;

  /** RecordMove(): may x be marked now? */
  function legal(s, x) {
    if (s.winner || x < 1 || x > s.n * s.n || isMarked(s, x) || x % s.g !== 0) return false;
    for (let i = s.g; i < s.max; i += s.g) {
      if (!isMarked(s, i)) continue;
      for (let j = i + s.g; j <= s.max; j += s.g) if (isMarked(s, j) && j - i === x) return true;
    }
    return false;
  }

  /** IsOver(): every multiple of g up to the maximum is marked. */
  function over(s) {
    for (let x = s.g; x <= s.max; x += s.g) if (!isMarked(s, x)) return false;
    return true;
  }

  function mark(s, x, who) {
    s.marked[x] = who;
    s.moves++;
    if (over(s)) s.winner = who;
    else s.turn = who === "you" ? "computer" : "you";
  }

  /** Play(): the first new difference, scanning pairs of multiples of g in order. */
  function computerMove(s) {
    for (let i = s.g; i <= s.n * s.n; i += s.g) {
      if (!isMarked(s, i)) continue;
      for (let j = i + s.g; j <= s.n * s.n; j += s.g) {
        if (isMarked(s, j) && !isMarked(s, j - i)) return j - i;
      }
    }
    return -1;
  }

  /** How many moves the game will take, whatever is played, and who wins it. */
  function forecast(s) {
    const total = s.max / s.g - 2;
    return { total, firstPlayerWins: total % 2 === 1 };
  }

  return { MIN_N, MAX_N, DEFAULT_N, gcd, start, fromPair, isMarked, legal, over, mark, computerMove, forecast };
})();
