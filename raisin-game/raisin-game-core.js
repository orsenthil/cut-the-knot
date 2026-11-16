"use strict";

/*
 * A Game of Candy Squares (RaisinGame), from Alexander Bogomolny's applet.
 *
 * Two heaps of squares. A move eats one heap and splits the other into two
 * non-empty heaps. The player who faces (1, 1) — nothing left to split — loses.
 *
 * Strategy (the page's theorem, transcribed as Play / MakeGoodMove): a position
 * is winning iff at least one heap is even. From an even heap, split it into two
 * odds (leave an odd–odd position). From odd–odd, every split leaves an even.
 *
 * Options: Max heap size 5–30 (default 15); Random sizes (default on) deals the
 * second heap as 3 + (int)(random * (max−2)); otherwise both heaps equal max.
 * "You start" lets the computer move first.
 */
const RaisinGameCore = (() => {
  const MIN_MAX = 5;
  const MAX_MAX = 30;
  const DEFAULT_MAX = 15;

  function clampMax(n) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = DEFAULT_MAX;
    return Math.max(MIN_MAX, Math.min(MAX_MAX, n));
  }

  function start(options = {}, rnd = Math.random) {
    const max = clampMax(options.max ?? DEFAULT_MAX);
    const random = options.random !== false;
    let a = max;
    let b = max;
    if (random) b = 3 + Math.trunc(rnd() * (max - 2));
    if (Array.isArray(options.heaps) && options.heaps.length === 2) {
      a = Math.max(1, Math.trunc(Number(options.heaps[0])) || 1);
      b = Math.max(1, Math.trunc(Number(options.heaps[1])) || 1);
    }
    return {
      max,
      random,
      heaps: [a, b],
      turn: options.turn === "computer" ? "computer" : "you",
      over: false,
      winner: null,
      wins: options.wins | 0,
      losses: options.losses | 0,
      note: null,
    };
  }

  function canMove(state) {
    return state.heaps.some((h) => h > 1);
  }

  /** Split heap `which` (0 or 1) after `k` squares (1 .. size−1). */
  function move(state, which, k) {
    if (state.over || state.turn !== "you") return state;
    which = which | 0;
    if (which !== 0 && which !== 1) {
      return Object.assign({}, state, { note: "This move is not allowed!" });
    }
    const size = state.heaps[which];
    k = Math.trunc(Number(k));
    if (!Number.isInteger(k) || k < 1 || k >= size) {
      return Object.assign({}, state, { note: "This move is not allowed!" });
    }
    const heaps = [k, size - k];
    const next = Object.assign({}, state, {
      heaps,
      note: null,
      turn: "computer",
    });
    if (!canMove(next)) {
      next.over = true;
      next.winner = "you";
      next.turn = "you";
      next.losses = state.losses + 1;
    }
    return next;
  }

  /** True when at least one heap is even (page: winning for the player to move). */
  function isWinning(heaps) {
    return heaps[0] % 2 === 0 || heaps[1] % 2 === 0;
  }

  /**
   * MakeGoodMove: split an even heap into two odds.
   * k = 2 * (int)(random * (width/2)) + 1.
   */
  function makeGoodMove(size, rnd) {
    let k = 2 * Math.trunc(rnd() * Math.floor(size / 2)) + 1;
    if (k < 1) k = 1;
    if (k >= size) k = size - 1;
    // Ensure both halves odd when size is even: odd k does that.
    return k;
  }

  /** MakeRandomMove: random heap with size>1, random k in 1..size−1. */
  function makeRandomMove(heaps, rnd) {
    const candidates = [];
    if (heaps[0] > 1) candidates.push(0);
    if (heaps[1] > 1) candidates.push(1);
    if (!candidates.length) return null;
    let which = candidates[0];
    if (candidates.length === 2 && rnd() < 0.5) which = candidates[1];
    const size = heaps[which];
    let k = Math.trunc(rnd() * size);
    if (k === 0 || k === size - 0) k = 1; // applet: if 0 or width-1… wait
    // Applet: k = (int)(random * width); if k==0 || k==width-1 then k=1.
    // Actually: ifeq→101 for k==0; if k == width-1 goto 104 else; @101: k=1; @104 use k.
    // So both 0 and width-1 become 1. For width=2, width-1=1, so k=1 always. Good.
    k = Math.trunc(rnd() * size);
    if (k === 0 || k === size - 1) k = 1;
    return { which, k };
  }

  /**
   * Play(): prefer an even heap (random if both even); else random move.
   */
  function chooseComputerMove(state, rnd = Math.random) {
    const [a, b] = state.heaps;
    let which = null;
    if (a % 2 === 0) which = 0;
    if (b % 2 === 0) {
      if (which === null) which = 1;
      else if (rnd() < 0.5) which = 0;
      else which = 1;
    }
    if (which !== null && state.heaps[which] >= 2) {
      return { which, k: makeGoodMove(state.heaps[which], rnd) };
    }
    return makeRandomMove(state.heaps, rnd);
  }

  function computerMove(state, rnd = Math.random) {
    if (state.over || state.turn !== "computer") return null;
    if (!canMove(state)) {
      return Object.assign({}, state, {
        over: true,
        winner: "you",
        losses: state.losses + 1,
        turn: "you",
      });
    }
    const pick = chooseComputerMove(state, rnd);
    if (!pick) return null;
    const size = state.heaps[pick.which];
    const heaps = [pick.k, size - pick.k];
    const next = Object.assign({}, state, {
      heaps,
      note: null,
      turn: "you",
    });
    if (!canMove(next)) {
      next.over = true;
      next.winner = "computer";
      next.wins = state.wins + 1;
      next.turn = "computer";
    }
    return next;
  }

  /** Pass the first move to the computer ("You start"). */
  function youStart(state) {
    if (state.over || state.turn !== "you") return state;
    if (!canMove(state)) return state;
    return Object.assign({}, state, { turn: "computer", note: null });
  }

  function result(state) {
    if (!state.over) return null;
    return state.winner === "you" ? "win" : "lose";
  }

  function legalMoves(state) {
    if (state.over) return [];
    const out = [];
    for (let which = 0; which < 2; which++) {
      const size = state.heaps[which];
      for (let k = 1; k < size; k++) out.push({ which, k });
    }
    return out;
  }

  /** Moves that leave both heaps odd. */
  function winningMoves(state) {
    return legalMoves(state).filter((m) => {
      const heaps = [m.k, state.heaps[m.which] - m.k];
      return !isWinning(heaps); // leave both odd
    });
  }

  function snapshot(state) {
    return {
      max: state.max,
      random: state.random,
      heaps: state.heaps.slice(),
      turn: state.turn,
      over: state.over,
      winner: state.winner,
      wins: state.wins,
      losses: state.losses,
    };
  }

  function restore(snap) {
    return {
      max: clampMax(snap.max ?? DEFAULT_MAX),
      random: snap.random !== false,
      heaps: [Math.max(1, snap.heaps[0] | 0), Math.max(1, snap.heaps[1] | 0)],
      turn: snap.turn === "computer" ? "computer" : "you",
      over: !!snap.over,
      winner: snap.winner || null,
      wins: snap.wins | 0,
      losses: snap.losses | 0,
      note: null,
    };
  }

  return {
    MIN_MAX,
    MAX_MAX,
    DEFAULT_MAX,
    clampMax,
    start,
    canMove,
    move,
    isWinning,
    makeGoodMove,
    chooseComputerMove,
    computerMove,
    youStart,
    result,
    legalMoves,
    winningMoves,
    snapshot,
    restore,
  };
})();
