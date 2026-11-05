"use strict";

/*
 * Contorted Fractions - the game from Alexander Bogomolny's applet
 * (classes/FractionGame.zip: FractionGame, FractionGameCanvas, ClickableFraction,
 * ContinuedFraction), after Conway. See Winning Ways, "Contorted Fractions".
 *
 * Several fractions lie on the table. A move replaces one of them by another
 * number whose denominator is strictly smaller - or, if the denominator is
 * already 1, whose numerator is strictly smaller in absolute value. Left may
 * only ever make a number smaller, Right may only ever make it larger. Whoever
 * cannot move has lost.
 *
 * Two facts drive everything:
 *
 *   1. Of all the numbers Left may move to, the best is the largest one below
 *      x with a smaller denominator - and that is exactly x's left parent on
 *      the Stern-Brocot tree. Right's best is the right parent. Every other
 *      option is worse for the player making it, so the game at x behaves like
 *      { lower parent | upper parent }.
 *   2. An integer is the end of the road in one direction: from a positive
 *      integer Right has no move at all, and from a negative one Left has none.
 *      On the tree that is the parent "1/0", infinity, which does not exist.
 *
 * The applet's opponent is greedy, exactly as the cut-the-knot page describes
 * it: it takes each fraction's parent and plays the one that shifts the total
 * least in its own direction (FractionGameCanvas.SuggestMove and
 * FractionGameGroup.IsThereWorthyMoveUp / IsThereWorthyMoveDown). That is a
 * heuristic, not perfect play - see porting/check-fraction-game.mjs, which
 * measures how often it is right.
 *
 * value() computes what the position is really worth, by the simplicity rule
 * on { lower | upper }. Those values are the dyadic numbers of combinatorial
 * game theory, and they are what decides the game properly.
 */
const FractionGameCore = (() => {
  const LEFT = "left";   // moves numbers down
  const RIGHT = "right"; // moves numbers up

  const MIN_COUNT = 2;
  const MAX_COUNT = 6;
  const DEFAULT_COUNT = 4;
  const MIN_MAX = 4;
  const MAX_MAX = 20;
  const DEFAULT_MAX = 9;

  /* ---------------------------------------------------------- fractions */

  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

  /** A fraction as { p, q } with q > 0 and gcd(|p|, q) = 1. */
  function frac(p, q) {
    if (q < 0) { p = -p; q = -q; }
    const g = gcd(Math.abs(p), q) || 1;
    return { p: p / g, q: q / g };
  }

  /** Sign of a - b, exactly. */
  const cmp = (a, b) => Math.sign(a.p * b.q - b.p * a.q);
  const eq = (a, b) => a.p === b.p && a.q === b.q;
  const num = (a) => a.p / a.q;
  const isInt = (a) => a.q === 1;
  const neg = (a) => ({ p: -a.p, q: a.q });
  const text = (a) => (a.q === 1 ? String(a.p) : `${a.p}/${a.q}`);

  /* ------------------------------------------------- Stern-Brocot parents */

  /**
   * The parents of a non-negative p/q on the Stern-Brocot tree: the closest
   * fractions below and above it that have a smaller denominator. `upper` is
   * null for an integer, whose right parent is 1/0.
   *
   * For q > 1 they are the unique a/b and c/d with b + d = q, a + c = p and
   * p*b - q*a = q*c - p*d = 1; b is the inverse of p modulo q.
   */
  function parents(x) {
    const { p, q } = x;
    if (p < 0) throw new Error("parents() takes a non-negative fraction");
    if (q === 1) {
      return { lower: p > 0 ? frac(p - 1, 1) : null, upper: null };
    }
    let b = 1;
    while ((p * b) % q !== 1) b++;
    const a = (p * b - 1) / q;
    const d = q - b;
    const c = (p * d + 1) / q;
    return { lower: frac(a, b), upper: frac(c, d) };
  }

  /**
   * FractionGameCanvas.SuggestMove: the move the applet would make on this one
   * fraction, or null when it has none. The applet works on |x| and puts the
   * sign back, so a negative number mirrors a positive one.
   */
  function suggest(x, who) {
    if (x.p === 0) return null; // nobody can move from 0
    const abs = x.p < 0 ? neg(x) : x;
    const { lower, upper } = parents(abs);
    const wantSmaller = who === LEFT;
    // For a positive x, "smaller" is the lower parent; for a negative x the
    // sign flips the tree over.
    const pick = x.p > 0 === wantSmaller ? lower : upper;
    if (!pick) return null;
    return x.p < 0 ? neg(pick) : pick;
  }

  /* ---------------------------------------------------------- legality */

  /**
   * y replaces x only if the denominator strictly drops - or, when x is
   * already an integer, y is an integer of strictly smaller absolute value -
   * and the number moves the right way for this player.
   *
   * FractionGameCanvas.Legal checks only the numerators in the integer case
   * and forgets to require that y be an integer too, so the applet lets you
   * answer 3 with 2/5 and the denominators climb back up again. With the rule
   * as Conway states it, (denominator, |numerator|) drops lexicographically on
   * every move and the game has to end.
   */
  function isLegal(x, y, who) {
    if (!Number.isInteger(y.p) || !Number.isInteger(y.q) || y.q < 1) return false;
    const direction = who === LEFT ? cmp(y, x) < 0 : cmp(y, x) > 0;
    if (!direction) return false;
    return isInt(x) ? isInt(y) && Math.abs(y.p) < Math.abs(x.p) : y.q < x.q;
  }

  /** Every legal replacement of x within the board's limit, ascending. */
  function legalMoves(x, who, max) {
    const out = [];
    for (let q = 1; q <= max; q++) {
      for (let p = -max; p <= max; p++) {
        const y = { p, q };
        if (y.q !== frac(p, q).q || y.p !== frac(p, q).p) continue; // reduced only
        if (isLegal(x, y, who)) out.push(y);
      }
    }
    out.sort(cmp);
    return out;
  }

  const canMove = (x, who) => suggest(x, who) !== null;
  const isStuck = (board, who) => !board.some((x) => canMove(x, who));

  /* ----------------------------------------------------------- opponent */

  /**
   * FractionGameGroup.IsThereWorthyMoveUp / IsThereWorthyMoveDown: of the
   * fractions that can move, take the one whose parent shifts it least.
   * Returns { index, to } or null when nothing can move.
   */
  function pickMove(board, who) {
    let best = null;
    for (let i = 0; i < board.length; i++) {
      const to = suggest(board[i], who);
      if (!to) continue;
      const shift = Math.abs(num(to) - num(board[i]));
      if (!best || shift < best.shift) best = { index: i, to, shift };
    }
    return best ? { index: best.index, to: best.to } : null;
  }

  /* -------------------------------------------------------------- value */

  const vcache = new Map();

  /** The simplest dyadic strictly between a and b, which is the value of {a|b}. */
  function simplest(a, b) {
    const m = Math.floor(a.p / a.q);
    const firstInt = frac(m + 1, 1);
    if (cmp(firstInt, b) < 0) {
      // Some whole number fits; the simplest is the one nearest zero.
      const lo = m + 1;                                        // smallest whole number above a
      const hi = b.p % b.q === 0 ? b.p / b.q - 1 : Math.floor(b.p / b.q); // largest below b
      if (lo <= 0 && 0 <= hi) return frac(0, 1);
      return frac(hi < 0 ? hi : lo, 1);
    }
    // No whole number fits: bisect the unit interval above m.
    let loN = 0;
    let hiN = 1;
    let den = 1;
    for (let step = 0; step < 64; step++) {
      den *= 2;
      loN *= 2;
      hiN *= 2;
      const midN = (loN + hiN) / 2;
      const cand = { p: m * den + midN, q: den };
      if (cmp(a, cand) < 0 && cmp(cand, b) < 0) return frac(cand.p, cand.q);
      if (cmp(cand, a) <= 0) loN = midN;
      else hiN = midN;
    }
    throw new Error(`simplest(${text(a)}, ${text(b)}) did not converge`);
  }

  /**
   * What the single-fraction game at x is worth, as a dyadic number. Integers
   * are worth themselves; otherwise the value is the simplest number between
   * the values of the two parents.
   */
  function value(x) {
    const key = `${x.p}/${x.q}`;
    if (vcache.has(key)) return vcache.get(key);
    let v;
    if (x.p < 0) v = neg(value(neg(x)));
    else if (isInt(x)) v = frac(x.p, 1);
    else {
      const { lower, upper } = parents(x);
      v = simplest(value(lower), value(upper));
    }
    vcache.set(key, v);
    return v;
  }

  /** The value of a whole board: the sum of its fractions' values. */
  function boardValue(board) {
    let s = frac(0, 1);
    for (const x of board) {
      const v = value(x);
      s = frac(s.p * v.q + v.p * s.q, s.q * v.q);
    }
    return s;
  }

  /**
   * Who should win, by the theory of sums of numbers: positive means Left wins
   * whoever moves, negative means Right does, and 0 means the player who moves
   * second wins.
   */
  function winner(board, toMove) {
    const v = boardValue(board);
    if (v.p > 0) return LEFT;
    if (v.p < 0) return RIGHT;
    return toMove === LEFT ? RIGHT : LEFT;
  }

  /* ---------------------------------------------------------- new board */

  /** ClickableFraction.Reset: numerator in [-max, max), denominator in [1, max]. */
  function newBoard(count, max, rand) {
    const rnd = rand || Math.random;
    const board = [];
    for (let i = 0; i < count; i++) {
      const p = Math.floor(rnd() * 2 * max - max);
      const q = Math.floor(rnd() * max) + 1;
      board.push(frac(p, q));
    }
    return board;
  }

  return {
    LEFT,
    RIGHT,
    MIN_COUNT,
    MAX_COUNT,
    DEFAULT_COUNT,
    MIN_MAX,
    MAX_MAX,
    DEFAULT_MAX,
    frac,
    cmp,
    eq,
    num,
    isInt,
    neg,
    text,
    parents,
    suggest,
    isLegal,
    legalMoves,
    canMove,
    isStuck,
    pickMove,
    simplest,
    value,
    boardValue,
    winner,
    newBoard,
  };
})();
