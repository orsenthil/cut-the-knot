"use strict";

/*
 * One Pile, from Alexander Bogomolny's applet OnePile (October 2002).
 *
 * A single pile of objects. On each turn a player removes between Min and Max
 * of them (inclusive). The player who leaves fewer than Min — so the other
 * cannot move — wins.
 *
 * The key idea: the P-positions (losing if it is your turn and both play
 * well) are exactly those whose size S satisfies
 *   0 ≤ S mod (Min + Max) < Min.
 * The computer leaves such a remainder whenever it can.
 *
 * The position is plain data:
 *   { n, min, max, turn: "you" | "computer", over, winner, history }
 * `n` is the pile size; `history` is the takes so far (for take-back).
 */
const OnePileCore = (() => {
  // From the page's <param>s (the Java field defaults are 3, 5, 55).
  const ABSOLUTE_MAX = 45;
  const MIN_MIN = 1, MAX_MIN = 12;
  const MIN_MAX = 4;
  const DEFAULT_MIN = 8, DEFAULT_MAX = 40;

  function clampMin(m) {
    m = Math.trunc(Number(m));
    if (!Number.isFinite(m)) m = DEFAULT_MIN;
    return Math.max(MIN_MIN, Math.min(MAX_MIN, m));
  }

  function clampMax(m) {
    m = Math.trunc(Number(m));
    if (!Number.isFinite(m)) m = DEFAULT_MAX;
    return Math.max(MIN_MAX, Math.min(ABSOLUTE_MAX, m));
  }

  /** Keep Min ≤ Max the way the applet's NumberChange handler does. */
  function clampPair(min, max) {
    min = clampMin(min);
    max = clampMax(max);
    if (min > max) max = Math.min(ABSOLUTE_MAX, Math.max(MIN_MAX, min));
    if (max < min) min = Math.max(MIN_MIN, Math.min(MAX_MIN, max));
    return { min, max };
  }

  /**
   * The applet's Reset pile size:
   *   N = Min + Max + (int)(Math.random() * Max * 4)
   */
  function randomPile(min, max, rnd = Math.random) {
    return min + max + Math.trunc(rnd() * max * 4);
  }

  function start(options = {}, rnd = Math.random) {
    const { min, max } = clampPair(options.min ?? DEFAULT_MIN, options.max ?? DEFAULT_MAX);
    let n = options.n;
    if (n == null) n = randomPile(min, max, rnd);
    else n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = randomPile(min, max, rnd);
    return {
      n, min, max,
      turn: "you",
      over: n < min,
      winner: n < min ? "computer" : null, // starting already stuck: you cannot move
      history: [],
    };
  }

  /** Takes allowed now: every integer from min to max (the applet does not cap at n). */
  function legalMoves(s) {
    if (s.over || s.n < s.min) return [];
    const out = [];
    for (let t = s.min; t <= s.max; t++) out.push(t);
    return out;
  }

  function apply(s, take, turn) {
    if (s.over || s.turn !== turn) return null;
    take = Number(take);
    if (!Number.isInteger(take) || take < s.min || take > s.max) return null;
    const n = s.n - take;
    const over = n < s.min;
    return {
      n, min: s.min, max: s.max,
      turn: over ? turn : (turn === "you" ? "computer" : "you"),
      over,
      winner: over ? turn : null,
      history: s.history.concat([take]),
    };
  }

  function move(s, take) {
    return apply(s, take, "you");
  }

  /** S mod (Min + Max); for the page's P-position test. */
  function remainder(n, min, max) {
    const period = min + max;
    const r = n % period;
    return r < 0 ? r + period : r;
  }

  function isPPosition(n, min, max) {
    return remainder(n, min, max) < min;
  }

  /**
   * The applet's OnePileGame.MakeMove, transcribed.
   *   r = N % (Min + Max)
   *   if 0 ≤ r < Min:  random take in [Min, Max)  (Max itself is never rolled)
   *   else if r ≤ Max: take = r
   *   else:            random take in [Min, Max] that leaves a P-remainder;
   *                    if somehow none, take Min
   */
  function computerChoice(s, rnd = Math.random) {
    if (s.over || s.turn !== "computer") return null;
    const { n, min, max } = s;
    const r = remainder(n, min, max);
    if (r < min) {
      if (max === min) return min;
      return min + Math.trunc(rnd() * (max - min));
    }
    if (r <= max) return r;
    const good = [];
    for (let t = min; t <= max; t++) {
      const left = r - t;
      if (left >= 0 && left < min) good.push(t);
    }
    if (good.length === 0) return min;
    return good[Math.trunc(rnd() * good.length)];
  }

  function computerMove(s, rnd = Math.random) {
    const t = computerChoice(s, rnd);
    return t === null ? null : apply(s, t, "computer");
  }

  /** Undo the last take (player or computer). Returns null if nothing to undo. */
  function takeBack(s) {
    if (s.history.length === 0) return null;
    const history = s.history.slice(0, -1);
    const take = s.history[s.history.length - 1];
    const n = s.n + take;
    // Whose turn it is after undoing: the player who just took.
    const turn = s.over ? s.winner : (s.turn === "you" ? "computer" : "you");
    return {
      n, min: s.min, max: s.max,
      turn,
      over: false,
      winner: null,
      history,
    };
  }

  /**
   * Grundy / nimber for a pile of size n under subtraction set {min..max},
   * with the usual rule that you may not take more than are there. Used to
   * check the page's table; the live game follows the applet (no take ≤ n).
   */
  function grundy(n, min, max, memo = new Map()) {
    if (n < min) return 0;
    const key = n + ":" + min + ":" + max;
    if (memo.has(key)) return memo.get(key);
    const seen = new Set();
    for (let t = min; t <= max && t <= n; t++) {
      seen.add(grundy(n - t, min, max, memo));
    }
    let g = 0;
    while (seen.has(g)) g++;
    memo.set(key, g);
    return g;
  }

  /** Takes that leave a P-position (winning moves under perfect play). */
  function winningMoves(s) {
    return legalMoves(s).filter((t) => isPPosition(s.n - t, s.min, s.max));
  }

  function result(s) {
    if (!s.over) return null;
    return s.winner === "you" ? "win" : "lose";
  }

  function snapshot(s) {
    return {
      n: s.n, min: s.min, max: s.max, turn: s.turn,
      over: s.over, winner: s.winner, history: s.history.slice(),
    };
  }

  function restore(d) {
    if (!d || !Number.isInteger(d.n) || !Number.isInteger(d.min) || !Number.isInteger(d.max) ||
        !["you", "computer"].includes(d.turn) || !Array.isArray(d.history)) {
      throw new Error("not a One Pile position");
    }
    const { min, max } = clampPair(d.min, d.max);
    if (min !== d.min || max !== d.max) throw new Error("not a One Pile position");
    const over = d.n < min;
    return {
      n: d.n, min, max, turn: d.turn,
      over,
      winner: over ? (d.winner === "you" || d.winner === "computer" ? d.winner : null) : null,
      history: d.history.map((t) => Math.trunc(t)),
    };
  }

  return {
    ABSOLUTE_MAX, MIN_MIN, MAX_MIN, MIN_MAX, DEFAULT_MIN, DEFAULT_MAX,
    clampPair, randomPile, start, legalMoves, move, apply,
    remainder, isPPosition, computerChoice, computerMove,
    takeBack, grundy, winningMoves, result, snapshot, restore,
  };
})();
