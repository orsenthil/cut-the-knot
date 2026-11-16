"use strict";

/*
 * Scoring Misère, from Alexander Bogomolny's applet ScoringMisere.
 *
 * Counters sit on a strip of cells 0 … Length−1. A move slides one counter
 * left by 1 … MaxStep cells (not past 0). When every counter is at 0, the
 * player who just moved loses — misère of the usual Scoring game.
 *
 * Each counter at cell t is a subtraction-game heap of size t. The computer
 * mixes the applet's MisereStrategy / NormalStrategy / xor "right move" /
 * random policy from CreateItinerary, including the 50% coin-flip when several
 * heaps are larger than 1.
 */
const ScoringMisereCore = (() => {
  const MIN_COUNTERS = 1, MAX_COUNTERS = 5, DEFAULT_COUNTERS = 1;
  const MIN_STEP = 2, MAX_STEP = 6, DEFAULT_STEP = 3;
  const MIN_LENGTH = 5, MAX_LENGTH = 20, DEFAULT_LENGTH = 8;

  function clamp(n, lo, hi, fallback) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = fallback;
    return Math.max(lo, Math.min(hi, n));
  }

  function copyPos(pos) {
    return pos.slice();
  }

  /** Applet Reset placement with a supplied RNG in [0,1). */
  function deal(nRings, maxStep, length, rnd) {
    const pos = [];
    if (nRings <= 1) {
      const floor = Math.max(3, length % (maxStep + 1));
      const p = Math.floor(rnd() * floor + (length - floor));
      pos.push(Math.max(0, Math.min(length - 1, p)));
    } else {
      // Applet: index = random*(Length-(MaxStep-1))+(MaxStep-1). When
      // MaxStep-1 >= Length the span is non-positive; clamp so chips stay on the strip.
      const lo = Math.min(Math.max(0, maxStep - 1), length - 1);
      const span = Math.max(1, length - lo);
      for (let i = 0; i < nRings; i++) {
        pos.push(lo + Math.floor(rnd() * span));
      }
    }
    return pos;
  }

  function start(options = {}) {
    const nRings = clamp(options.nRings ?? DEFAULT_COUNTERS, MIN_COUNTERS, MAX_COUNTERS, DEFAULT_COUNTERS);
    const maxStep = clamp(options.maxStep ?? DEFAULT_STEP, MIN_STEP, MAX_STEP, DEFAULT_STEP);
    const length = clamp(options.length ?? DEFAULT_LENGTH, MIN_LENGTH, MAX_LENGTH, DEFAULT_LENGTH);
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    const positions = options.positions ? copyPos(options.positions) : deal(nRings, maxStep, length, rnd);
    return {
      nRings: positions.length,
      maxStep,
      length,
      positions,
      turn: "you",
      over: false,
      winner: null,
      history: [],
      wins: 0,
      losses: 0,
      hint: options.hint ?? 0,
    };
  }

  function finished(state) {
    return state.positions.every((p) => p === 0);
  }

  function legalMoves(state) {
    if (state.over) return [];
    const moves = [];
    for (let i = 0; i < state.positions.length; i++) {
      const p = state.positions[i];
      for (let k = 1; k <= Math.min(state.maxStep, p); k++) {
        moves.push({ index: i, from: p, to: p - k, steps: k });
      }
    }
    return moves;
  }

  function applyMove(state, index, to) {
    if (state.over) return state;
    if (index < 0 || index >= state.positions.length) return state;
    const from = state.positions[index];
    if (to < 0 || to >= from) return state;
    const steps = from - to;
    if (steps < 1 || steps > state.maxStep) return state;

    const positions = copyPos(state.positions);
    positions[index] = to;
    const next = {
      ...state,
      positions,
      history: state.history.concat([{ index, from, to, turn: state.turn }]),
    };
    if (finished(next)) {
      // Last mover loses (misère).
      next.over = true;
      next.winner = state.turn === "you" ? "computer" : "you";
      next.wins = state.wins + (next.winner === "you" ? 1 : 0);
      next.losses = state.losses + (next.winner === "computer" ? 1 : 0);
      return next;
    }
    next.turn = state.turn === "you" ? "computer" : "you";
    return next;
  }

  function rem(tower, maxStep) {
    return tower % (maxStep + 1);
  }

  /** NormalStrategy for one counter: leave a multiple of (MaxStep+1). */
  function normalSteps(tower, maxStep, rnd) {
    let r = rem(tower, maxStep);
    if (r === 0) r = 1 + Math.floor(rnd() * maxStep);
    return Math.min(r, tower);
  }

  /** MisereStrategy: (tower + MaxStep) % (MaxStep+1). */
  function misereSteps(tower, maxStep, rnd) {
    let r = (tower + maxStep) % (maxStep + 1);
    if (r === 0) r = 1 + Math.floor(rnd() * maxStep);
    return Math.min(r, tower);
  }

  function highestAt(positions, tower) {
    let best = -1;
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] === tower) best = i;
    }
    return best;
  }

  function chooseOne(indices, positions, rnd) {
    const pick = indices[Math.floor(rnd() * indices.length)];
    return highestAt(positions, positions[pick]);
  }

  /** MakeRightMove: pick counter maximizing (xor & rem), subtract xor. */
  function makeRightMove(positions, maxStep, xorVal) {
    let bestAnd = -1;
    let bestIdx = -1;
    let bestTower = 0;
    for (let i = 0; i < positions.length; i++) {
      const t = positions[i];
      if (t === 0) continue;
      const r = rem(t, maxStep);
      const a = xorVal & r;
      if (bestAnd >= a) continue;
      bestAnd = a;
      bestIdx = i;
      bestTower = t;
    }
    if (bestIdx < 0) return null;
    const to = Math.max(0, bestTower - bestAnd - (xorVal ^ bestAnd));
    return { index: bestIdx, to };
  }

  function makeRandomMove(positions, maxStep, rnd) {
    const candidates = [];
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] > 0) candidates.push(i);
    }
    if (!candidates.length) return null;
    const index = candidates[Math.floor(rnd() * candidates.length)];
    const tower = positions[index];
    const steps = Math.min(maxStep, Math.max(1, Math.floor(rnd() * maxStep) + 1));
    return { index, to: Math.max(0, tower - steps) };
  }

  /**
   * CreateItinerary's choice of (index, to), transcribed from the bytecode.
   * Returns null only when no legal move exists.
   */
  function computerMove(state, rnd = Math.random) {
    const { positions, maxStep } = state;
    const at1 = [];
    const above1 = [];
    for (let i = 0; i < positions.length; i++) {
      const t = positions[i];
      if (t === 1) at1.push(i);
      else if (t > 1) above1.push(i);
    }

    let index = -1;
    let to = -1;

    if (above1.length === 1) {
      index = above1[0];
      const tower = positions[index];
      const steps = at1.length % 2 === 0
        ? misereSteps(tower, maxStep, rnd)
        : normalSteps(tower, maxStep, rnd);
      to = Math.max(0, tower - steps);
    } else if (above1.length > 1) {
      if (rnd() < 0.5) {
        index = chooseOne(above1, positions, rnd);
        const tower = positions[index];
        to = Math.max(0, tower - misereSteps(tower, maxStep, rnd));
      } else {
        let xorVal = 0;
        for (let i = 0; i < positions.length; i++) {
          xorVal ^= rem(positions[i], maxStep);
        }
        if (xorVal === 0) {
          const m = makeRandomMove(positions, maxStep, rnd);
          if (!m) return null;
          return m;
        }
        const m = makeRightMove(positions, maxStep, xorVal);
        if (!m) return makeRandomMove(positions, maxStep, rnd);
        return m;
      }
    } else if (at1.length > 0) {
      index = chooseOne(at1, positions, rnd);
      const tower = positions[index];
      to = Math.max(0, tower - misereSteps(tower, maxStep, rnd));
    } else {
      return makeRandomMove(positions, maxStep, rnd);
    }

    if (index < 0 || to < 0 || to >= positions[index]) {
      return makeRandomMove(positions, maxStep, rnd);
    }
    return { index, to };
  }

  function playComputer(state, rnd = Math.random) {
    if (state.over || state.turn !== "computer") return state;
    const m = computerMove(state, rnd);
    if (!m) return state;
    return applyMove(state, m.index, m.to);
  }

  function undo(state) {
    if (!state.history.length) return state;
    // Take back a full round when possible (your move + computer reply).
    let history = state.history.slice();
    const last = history.pop();
    let positions = copyPos(state.positions);
    positions[last.index] = last.from;
    if (last.turn === "computer" && history.length) {
      const prev = history.pop();
      positions[prev.index] = prev.from;
    }
    return {
      ...state,
      positions,
      history,
      turn: "you",
      over: false,
      winner: null,
      // Keep scoreboard; applet only adjusts on CheckFinished.
    };
  }

  function result(state) {
    if (!state.over) return null;
    return state.winner === "you" ? "win" : "lose";
  }

  function snapshot(state) {
    return {
      nRings: state.nRings,
      maxStep: state.maxStep,
      length: state.length,
      positions: copyPos(state.positions),
      turn: state.turn,
      over: state.over,
      winner: state.winner,
      historyLength: state.history.length,
      wins: state.wins,
      losses: state.losses,
      hint: state.hint,
    };
  }

  function restore(snap) {
    return {
      nRings: snap.nRings || (snap.positions && snap.positions.length) || DEFAULT_COUNTERS,
      maxStep: clamp(snap.maxStep, MIN_STEP, MAX_STEP, DEFAULT_STEP),
      length: clamp(snap.length, MIN_LENGTH, MAX_LENGTH, DEFAULT_LENGTH),
      positions: snap.positions ? copyPos(snap.positions) : [0],
      turn: snap.turn === "computer" ? "computer" : "you",
      over: !!snap.over,
      winner: snap.winner || null,
      history: [],
      wins: Number(snap.wins) || 0,
      losses: Number(snap.losses) || 0,
      hint: Number(snap.hint) || 0,
    };
  }

  return {
    MIN_COUNTERS, MAX_COUNTERS, DEFAULT_COUNTERS,
    MIN_STEP, MAX_STEP, DEFAULT_STEP,
    MIN_LENGTH, MAX_LENGTH, DEFAULT_LENGTH,
    start, deal, finished, legalMoves, applyMove,
    normalSteps, misereSteps, rem, computerMove, playComputer,
    makeRightMove, undo, result, snapshot, restore, copyPos,
  };
})();
