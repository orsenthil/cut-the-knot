"use strict";

/*
 * Odd Scoring, from Alexander Bogomolny's applet OddScoring (a problem from
 * Kvant, 1970, no. 2, M8).
 *
 * A chip starts at the right end of a band of cells. You and the computer
 * take turns sliding it 1, 2 or 3 cells to the left, you first. When it
 * reaches the leftmost cell, each player adds up the steps they made. The
 * number of steps on the band is odd, so exactly one total is even, and that
 * player wins.
 *
 * The key idea: what matters is how many steps are left and whether your own
 * total so far is even or odd. Working back from the left end, the lost
 * positions for the player about to move repeat every 8 steps: with an even
 * total, 1 or 4 steps left (mod 8); with an odd total, 0 or 5 steps left.
 *
 * The applet's computer knows this only for the last 7 steps. Further out it
 * plays plain Scoring (leave a multiple of 4), which is not always right, so
 * it can be beaten from 17 and 25 steps, where perfect play would win for it.
 * That is the applet's game and is kept; moverWins() is the true answer.
 *
 * The position is plain data:
 *   { steps, left, you, computer, turn: "you" | "computer", over, winner }
 * `steps` is the length of the band in steps, `left` the steps still to go,
 * `you` and `computer` the steps each has made.
 */
const OddScoringCore = (() => {
  const MIN_STEPS = 1, MAX_STEPS = 25, DEFAULT_STEPS = 11; // the applet's spinner, in twos
  const MAX_MOVE = 3;

  /** A new game: the chip at the right end, the player to move. */
  function start(options = {}) {
    let steps = Math.trunc(Number(options.steps)) || DEFAULT_STEPS;
    steps = Math.max(MIN_STEPS, Math.min(MAX_STEPS, steps));
    if (steps % 2 === 0) steps -= 1; // always odd, so nobody draws
    return { steps, left: steps, you: 0, computer: 0, turn: "you", over: false, winner: null };
  }

  /** The numbers of steps the chip may be moved now. */
  function legalMoves(s) {
    const out = [];
    if (!s.over) for (let d = 1; d <= Math.min(MAX_MOVE, s.left); d++) out.push(d);
    return out;
  }

  function apply(s, d, turn) {
    if (s.over || s.turn !== turn || !Number.isInteger(d) || d < 1 || d > MAX_MOVE || d > s.left) return null;
    const next = { ...s, left: s.left - d, [turn]: s[turn] + d, turn: turn === "you" ? "computer" : "you" };
    if (next.left === 0) {
      next.over = true;
      next.winner = next.you % 2 === 0 ? "you" : "computer";
    }
    return next;
  }

  /*
   * The applet's PileEvaluation: the number of steps the computer wants to
   * make, or 0 when it sees nothing good. Far from the end it plays plain
   * Scoring (leave a multiple of 4). With 7 steps or fewer left it looks at
   * whether its own total so far is even.
   */
  function evaluation(left, computerSteps) {
    if (left > 8) return left % (MAX_MOVE + 1);
    const even = computerSteps % 2 === 0;
    switch (left) {
      case 1: return 1;
      case 2: return even ? 2 : 1;
      case 3: return even ? 2 : 3;
      case 4: return even ? 0 : 3;
      case 5: return even ? 1 : 0;
      case 6: return even ? 1 : 2;
      case 7: return even ? 3 : 2;
      default: return 0; // 0 and 8
    }
  }

  /** The computer's step count here: its evaluation, or 1 to 3 at random. */
  function computerChoice(s, rnd = Math.random) {
    if (s.over || s.turn !== "computer") return null;
    const e = evaluation(s.left, s.computer);
    if (e !== 0) return e;
    return Math.trunc(Math.min(MAX_MOVE * rnd() + 1, s.left));
  }

  function computerMove(s, rnd = Math.random) {
    const d = computerChoice(s, rnd);
    return d === null ? null : apply(s, d, "computer");
  }

  /*
   * The true answer, by working back from the end: can the player about to
   * move, whose own total so far is `mine` and the other's `theirs`, force
   * an even total?
   */
  const memo = new Map();
  function moverWins(left, mine, theirs) {
    const m = mine % 2, t = theirs % 2, key = left * 4 + m * 2 + t;
    if (memo.has(key)) return memo.get(key);
    let win = false;
    // After my move the other player is the mover; I win if they cannot.
    for (let d = 1; d <= Math.min(MAX_MOVE, left) && !win; d++) {
      win = left - d === 0 ? (m + d) % 2 === 0 : !moverWins(left - d, t, m + d);
    }
    memo.set(key, win);
    return win;
  }

  /** The step counts that win for the player to move (empty if there are none). */
  function winningMoves(s) {
    if (s.over) return [];
    const mine = s.turn === "you" ? s.you : s.computer;
    const theirs = s.turn === "you" ? s.computer : s.you;
    return legalMoves(s).filter((d) =>
      s.left - d === 0 ? (mine + d) % 2 === 0 : !moverWins(s.left - d, theirs, mine + d));
  }

  function snapshot(s) {
    return { steps: s.steps, left: s.left, you: s.you, computer: s.computer, turn: s.turn, over: s.over, winner: s.winner };
  }

  function restore(d) {
    const whole = (n) => Number.isInteger(n) && n >= 0;
    if (!d || !whole(d.steps) || d.steps < MIN_STEPS || d.steps > MAX_STEPS || d.steps % 2 === 0 ||
        !whole(d.left) || !whole(d.you) || !whole(d.computer) || d.left + d.you + d.computer !== d.steps ||
        !["you", "computer"].includes(d.turn)) throw new Error("not an Odd Scoring position");
    const over = d.left === 0;
    return { steps: d.steps, left: d.left, you: d.you, computer: d.computer, turn: d.turn,
      over, winner: over ? (d.you % 2 === 0 ? "you" : "computer") : null };
  }

  return { MIN_STEPS, MAX_STEPS, DEFAULT_STEPS, MAX_MOVE,
    start, legalMoves, move: (s, d) => apply(s, d, "you"), evaluation, computerChoice, computerMove,
    moverWins, winningMoves, snapshot, restore };
})();
