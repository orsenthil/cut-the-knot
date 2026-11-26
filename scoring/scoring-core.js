"use strict";

/*
 * Scoring, from Alexander Bogomolny's applet Scoring.
 *
 * A strip of Length squares, numbered 0 (left) to Length-1, holds a few
 * counters. Players take turns sliding one counter left by 1 to MaxStep
 * squares (not past 0). The player who moves the last counter onto square 0
 * makes the last move and wins. You move first; the computer replies.
 *
 * The idea the code relies on is the Sprague-Grundy theory the page
 * explains: a counter on square t is worth g(t) = t mod (MaxStep + 1), and
 * a position is lost for the player to move exactly when the nim-sum (xor)
 * of those values is 0. The computer, transcribed from ScoreCanvas's
 * CreateItinerary: if the nim-sum is 0 it moves the first movable counter
 * a random 1..MaxStep squares (MakeRandomMove); otherwise it takes the
 * counter whose value shares the most with the nim-sum (MakeRightMove) and
 * moves it so that the nim-sum becomes 0.
 *
 * Counters keep the identities the applet gives them (numbered by square,
 * bottom to top, when dealt), and only the top counter of a pile can move,
 * because the applet's choices go through them in that order.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * ScoringCore. The position is plain data.
 */
const ScoringCore = (() => {
  const COUNTERS = { min: 1, max: 5, def: 1 };
  const STEP = { min: 2, max: 6, def: 3 };
  const LENGTH = { min: 5, max: 20, def: 8 };
  const HINTS = ["Empty", "Forward", "Backward", "Modular"];

  function clamp(v, r) {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(r.min, Math.min(r.max, n)) : r.def;
  }

  /**
   * ScoreCanvas.Reset's deal, with rnd in [0, 1): one counter goes somewhere
   * in the last max(3, Length mod (MaxStep+1)) squares; several go anywhere
   * from square MaxStep-1 on. (For Length 5 and MaxStep 6 the applet's range
   * starts past the strip's end; here it is held to the last square.)
   */
  function deal(nRings, maxStep, length, rnd) {
    const count = new Array(length).fill(0);
    if (nRings > 1) {
      for (let i = 0; i < nRings; i++) {
        const t = Math.trunc(rnd() * (length - (maxStep - 1))) + (maxStep - 1);
        count[Math.min(length - 1, t)]++;
      }
    } else {
      const span = Math.max(3, length % (maxStep + 1));
      count[Math.trunc(rnd() * span + (length - span))] = 1;
    }
    return count;
  }

  /** Positions from pile sizes: counters numbered by square, bottom to top. */
  function fromCounts(count) {
    const towers = [];
    const stacks = count.map(() => []);
    count.forEach((k, t) => {
      for (let j = 0; j < k; j++) { stacks[t].push(towers.length); towers.push(t); }
    });
    return { towers, stacks };
  }

  function start(options = {}) {
    const nRings = clamp(options.nRings ?? COUNTERS.def, COUNTERS);
    const maxStep = clamp(options.maxStep ?? STEP.def, STEP);
    const length = clamp(options.length ?? LENGTH.def, LENGTH);
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    const count = Array.isArray(options.count) && options.count.length === length
      ? options.count.slice() : deal(nRings, maxStep, length, rnd);
    const { towers, stacks } = fromCounts(count);
    return {
      nRings: towers.length, maxStep, length, towers, stacks,
      turn: "you", over: false, winner: null, last: null,
      wins: options.wins | 0, losses: options.losses | 0,
    };
  }

  const value = (t, maxStep) => t % (maxStep + 1);

  /** The nim-sum the page talks about: xor of t mod (MaxStep + 1). */
  function nimSum(state) {
    return state.towers.reduce((x, t) => x ^ value(t, state.maxStep), 0);
  }

  const finished = (state) => state.towers.every((t) => t === 0);

  /** The squares a top counter may move to from square `from`. */
  function targets(state, from) {
    const out = [];
    if (!state.stacks[from] || !state.stacks[from].length) return out;
    for (let k = 1; k <= state.maxStep && from - k >= 0; k++) out.push(from - k);
    return out;
  }

  function legalMoves(state) {
    if (state.over) return [];
    const moves = [];
    state.stacks.forEach((s, from) => { if (from > 0 && s.length) for (const to of targets(state, from)) moves.push({ from, to }); });
    return moves;
  }

  /** CanSettle: the top counter of square `from` to square `to`, 1..MaxStep to the left. */
  function move(state, m) {
    if (!m || state.over) return null;
    const { from, to } = m;
    if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
    if (from < 0 || from >= state.length || to < 0 || !state.stacks[from].length) return null;
    const d = from - to;
    if (d < 1 || d > state.maxStep) return null;
    const stacks = state.stacks.map((s) => s.slice());
    const id = stacks[from].pop();
    stacks[to].push(id);
    const towers = state.towers.slice();
    towers[id] = to;
    const next = { ...state, towers, stacks, last: { id, from, to, by: state.turn } };
    // CheckFinished: whoever made the last move wins.
    if (finished(next)) {
      next.over = true;
      next.winner = state.turn;
      if (state.turn === "computer") next.wins = state.wins + 1;
      else next.losses = state.losses + 1;
      return next;
    }
    next.turn = state.turn === "you" ? "computer" : "you";
    return next;
  }

  const isTop = (state, id) => {
    const s = state.stacks[state.towers[id]];
    return s[s.length - 1] === id;
  };

  /** MakeRandomMove: the first top counter off square 0, int(min(MaxStep*r + 1, t)) squares. */
  function randomMove(state, rnd) {
    let id = -1, t = 0;
    for (let i = 0; i < state.towers.length; i++) {
      if (state.towers[i] !== 0 && isTop(state, i)) { id = i; t = state.towers[i]; break; }
    }
    const step = Math.trunc(Math.min(state.maxStep * rnd() + 1, t));
    return { from: t, to: Math.max(0, t - step), id };
  }

  /** MakeRightMove(x): the top counter maximising x & g(t), moved g(t) -> g(t) ^ x. */
  function rightMove(state, x) {
    let best = 0, id = 0;
    for (let i = 0; i < state.towers.length; i++) {
      const t = state.towers[i];
      if (t === 0 || !isTop(state, i)) continue;
      const v = x & value(t, state.maxStep);
      if (best < v) { best = v; id = i; }
    }
    const t = state.towers[id];
    return { from: t, to: Math.max(0, t - (best - (x ^ best))), id };
  }

  /** CreateItinerary: the computer's choice. */
  function computerMove(state, rnd = Math.random) {
    const x = nimSum(state);
    const m = x === 0 ? randomMove(state, rnd) : rightMove(state, x);
    return { from: m.from, to: m.to };
  }

  function playComputer(state, rnd = Math.random) {
    if (state.over || state.turn !== "computer") return state;
    return move(state, computerMove(state, rnd)) || state;
  }

  /** "win" when you made the last move, "lose" when the computer did. */
  function result(state) {
    if (!state.over) return null;
    return state.winner === "you" ? "win" : "lose";
  }

  /** The applet's closing line, with its running score (computer's wins : yours). */
  function message(state) {
    if (!state.over) return "";
    const score = `${state.wins}:${state.losses}`;
    return state.winner === "computer" ? `I won! It's now ${score}.` : `Congratulations! You won! It's now ${score}.`;
  }

  /** The Hint row under square i: Forward Length - i, Backward i + 1, Modular i mod (MaxStep+1) dots. */
  function hintLabel(state, hint, i) {
    if (hint === 1) return String(state.length - i);
    if (hint === 2) return String(i + 1);
    if (hint === 3) return "•".repeat(value(i, state.maxStep));
    return "";
  }

  return {
    COUNTERS, STEP, LENGTH, HINTS,
    deal, start, value, nimSum, finished, targets, legalMoves, move,
    randomMove, rightMove, computerMove, playComputer, result, message, hintLabel,
  };
})();
