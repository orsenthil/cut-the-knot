"use strict";

/*
 * Plus or Minus (pm), from Alexander Bogomolny's applet pm.
 *
 * Numbers 1, 2, …, N sit in a row. Players take turns placing + or − in an
 * empty gap. When every gap is filled, the expression is evaluated: you win
 * if the total is odd, the computer wins if it is even.
 *
 * The computer's MyMove is random: a random empty gap and a random sign. That
 * does not matter — every complete signing of 1±2±…±N has the same parity as
 * the triangular number N(N+1)/2, because negating a term never changes its
 * parity. So for a given N the winner is fixed before anyone moves.
 *
 * Options: N from 2 to 20 (default 5); Random size (default on) picks N in
 * 2..20 on Reset; the pending sign is + or − (default +).
 */
const PmCore = (() => {
  const MIN_N = 2;
  const MAX_N = 20;
  const DEFAULT_N = 5;
  const PLUS = 1;
  const MINUS = 2;

  function clampN(n) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = DEFAULT_N;
    return Math.max(MIN_N, Math.min(MAX_N, n));
  }

  /** Applet Reset with Random: N = 2 + (int)(Math.random() * 19). */
  function randomN(rnd = Math.random) {
    return 2 + Math.trunc(rnd() * 19);
  }

  function start(options = {}, rnd = Math.random) {
    let n;
    if (options.random) n = randomN(rnd);
    else n = clampN(options.n ?? DEFAULT_N);
    const signs = Array.isArray(options.signs)
      ? options.signs.slice(0, n - 1)
      : null;
    const gaps = n - 1;
    return {
      n,
      random: !!options.random,
      pendingSign: options.pendingSign === MINUS ? MINUS : PLUS,
      signs: signs && signs.length === gaps ? signs.map((s) => (s === PLUS || s === MINUS ? s : 0)) : Array(gaps).fill(0),
      turn: "you",
      over: false,
      winner: null,
      total: null,
      wins: options.wins | 0,
      losses: options.losses | 0,
      announce: null,
      error: null,
    };
  }

  /** Evaluate 1 ± 2 ± … ± N from the filled signs (Total). */
  function total(state) {
    let t = 1;
    for (let i = 1; i < state.n; i++) {
      const s = state.signs[i - 1];
      if (s === PLUS) t += i + 1;
      else t -= i + 1;
    }
    return t;
  }

  /** Triangular number — the parity every signing shares. */
  function triangular(n) {
    return (n * (n + 1)) / 2;
  }

  function isOdd(x) {
    return x % 2 !== 0;
  }

  function emptyCount(state) {
    let c = 0;
    for (const s of state.signs) if (s === 0) c++;
    return c;
  }

  function finish(state) {
    const t = total(state);
    const next = Object.assign({}, state, {
      signs: state.signs.slice(),
      over: true,
      total: t,
      turn: state.turn,
      error: null,
    });
    const even = !isOdd(t);
    if (even) {
      next.wins = state.wins + 1;
      next.winner = "computer";
      next.announce =
        "The total is " + t + " which is even. Hence I won! It's now " + next.wins + ":" + next.losses;
    } else {
      next.losses = state.losses + 1;
      next.winner = "you";
      next.announce =
        "The total is " + t + " which is odd. Hence you won! It's now " + next.wins + ":" + next.losses;
    }
    return next;
  }

  /**
   * Place the pending sign in gap `index` (0 .. n-2). Returns the new state,
   * or the same state with an error announce if the gap is taken / out of range.
   */
  function place(state, index) {
    if (state.over || state.turn !== "you") return state;
    if (index < 0 || index >= state.signs.length) {
      return Object.assign({}, state, {
        announce: "Click between numbers, please!",
        error: "miss",
      });
    }
    if (state.signs[index] !== 0) {
      return Object.assign({}, state, {
        announce: "There is a sign here, silly!",
        error: "occupied",
      });
    }
    const signs = state.signs.slice();
    signs[index] = state.pendingSign;
    let next = Object.assign({}, state, {
      signs,
      announce: null,
      error: null,
    });
    if (emptyCount(next) === 0) return finish(next);
    next = Object.assign({}, next, { turn: "computer" });
    return next;
  }

  /**
   * MyMove: pick a random empty gap and a random sign (1 or 2).
   * Returns { index, sign }.
   */
  function chooseComputerMove(state, rnd = Math.random) {
    let empty = 0;
    for (const s of state.signs) if (s === 0) empty++;
    if (empty === 0) return null;
    const pick = Math.trunc(rnd() * empty);
    const sign = Math.trunc(rnd() * 2) + 1;
    let seen = 0;
    for (let i = 0; i < state.signs.length; i++) {
      if (state.signs[i] !== 0) continue;
      if (seen === pick) return { index: i, sign };
      seen++;
    }
    return null;
  }

  function computerMove(state, rnd = Math.random) {
    if (state.over || state.turn !== "computer") return null;
    const pick = chooseComputerMove(state, rnd);
    if (!pick) return null;
    const signs = state.signs.slice();
    signs[pick.index] = pick.sign;
    let next = Object.assign({}, state, {
      signs,
      announce: null,
      error: null,
    });
    if (emptyCount(next) === 0) return finish(next);
    return Object.assign({}, next, { turn: "you" });
  }

  function result(state) {
    if (!state.over) return null;
    return state.winner === "you" ? "win" : "lose";
  }

  function snapshot(state) {
    return {
      n: state.n,
      random: state.random,
      pendingSign: state.pendingSign,
      signs: state.signs.slice(),
      turn: state.turn,
      over: state.over,
      winner: state.winner,
      total: state.total,
      wins: state.wins,
      losses: state.losses,
    };
  }

  function restore(snap) {
    const n = clampN(snap.n);
    const signs = (snap.signs || []).slice(0, n - 1);
    while (signs.length < n - 1) signs.push(0);
    return {
      n,
      random: !!snap.random,
      pendingSign: snap.pendingSign === MINUS ? MINUS : PLUS,
      signs: signs.map((s) => (s === PLUS || s === MINUS ? s : 0)),
      turn: snap.turn === "computer" ? "computer" : "you",
      over: !!snap.over,
      winner: snap.winner || null,
      total: snap.total == null ? null : Number(snap.total),
      wins: snap.wins | 0,
      losses: snap.losses | 0,
      announce: null,
      error: null,
    };
  }

  return {
    MIN_N,
    MAX_N,
    DEFAULT_N,
    PLUS,
    MINUS,
    clampN,
    randomN,
    start,
    total,
    triangular,
    isOdd,
    emptyCount,
    place,
    chooseComputerMove,
    computerMove,
    result,
    snapshot,
    restore,
  };
})();
