"use strict";

/*
 * Scoring Misère: Two Heaps, from Alexander Bogomolny's applet ScoringMisere2.
 *
 * Two heaps; remove 1 … MaxMove chips from one heap. The player who takes the
 * last chip loses. Kalman–Keynes “Double Take”: second player wins iff the
 * sizes mod (M+1) are (0,1)/(1,0) or equal to some k with 2 ≤ k ≤ M. The
 * computer’s MakeMoveFromEqual / MakeMoveFromDifferent follow the bytecode.
 */
const ScoringMisere2Core = (() => {
  const MIN_MOVE = 2, MAX_MOVE = 10, DEFAULT_MOVE = 3;
  const MIN_HEAP = 2, MAX_HEAP = 36, DEFAULT_HEAP = 15;

  function clamp(n, lo, hi, fb) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = fb;
    return Math.max(lo, Math.min(hi, n));
  }

  function rem(n, M) {
    return ((n % (M + 1)) + (M + 1)) % (M + 1);
  }

  /** Page formula: second-player win with best play. */
  function secondPlayerWins(a, b, M) {
    const ra = rem(a, M);
    const rb = rem(b, M);
    if ((ra === 0 && rb === 1) || (ra === 1 && rb === 0)) return true;
    if (ra === rb && ra >= 2 && ra <= M) return true;
    return false;
  }

  function deal(maxHeap, rnd) {
    const span = Math.max(1, maxHeap - 2);
    return [
      3 + Math.floor(rnd() * span),
      3 + Math.floor(rnd() * span),
    ];
  }

  function start(options = {}) {
    const maxMove = clamp(options.maxMove ?? DEFAULT_MOVE, MIN_MOVE, MAX_MOVE, DEFAULT_MOVE);
    const maxHeap = clamp(options.maxHeap ?? DEFAULT_HEAP, MIN_HEAP, MAX_HEAP, DEFAULT_HEAP);
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    const heaps = options.heaps ? options.heaps.slice() : deal(maxHeap, rnd);
    return {
      maxMove,
      maxHeap,
      heaps: [Math.max(0, heaps[0] | 0), Math.max(0, heaps[1] | 0)],
      turn: "you",
      over: false,
      winner: null,
      history: [],
      note: null,
    };
  }

  function legalMoves(state) {
    if (state.over) return [];
    const out = [];
    for (let h = 0; h < 2; h++) {
      const n = state.heaps[h];
      for (let t = 1; t <= Math.min(state.maxMove, n); t++) {
        out.push({ heap: h, take: t });
      }
    }
    return out;
  }

  function applyMove(state, heap, take) {
    if (state.over) return state;
    if (heap !== 0 && heap !== 1) return state;
    if (take < 1 || take > state.maxMove || take > state.heaps[heap]) {
      return { ...state, note: "This move is not allowed!" };
    }
    const heaps = state.heaps.slice();
    heaps[heap] -= take;
    const next = {
      ...state,
      heaps,
      note: null,
      history: state.history.concat([{ heap, take, turn: state.turn, before: state.heaps.slice() }]),
    };
    if (heaps[0] === 0 && heaps[1] === 0) {
      next.over = true;
      // Last mover loses
      next.winner = state.turn === "you" ? "computer" : "you";
      return next;
    }
    next.turn = state.turn === "you" ? "computer" : "you";
    return next;
  }

  /**
   * Bytecode MakeMoveFromEqual(larger-or-eq heap L1, other L2, idx1, idx2).
   * Returns { heap, take }.
   */
  function moveFromEqual(a, b, M, rnd) {
    // Caller passes heaps so a.size >= b.size when sizes equal rem; Play swaps.
    const ra = rem(a, M);
    if (ra === 1) {
      if (rnd() < 0.5) return { heap: 0, take: 1 };
      return { heap: 1, take: 1 };
    }
    if (ra === 0) {
      if (b > 0) return { heap: 1, take: Math.min(M, b) };
      return { heap: 0, take: Math.min(M, a) };
    }
    // else random legal take on one heap
    if (rnd() < 0.5) {
      const take = 1 + Math.floor(rnd() * Math.min(M, a));
      return { heap: 0, take };
    }
    const take = 1 + Math.floor(rnd() * Math.min(M, b));
    return { heap: 1, take };
  }

  /**
   * MakeMoveFromDifferent(L1, L2) with rem r1, r2 — L1 is the larger heap.
   * Indices: heap0 = L1 side, heap1 = L2 side in the ordered pair passed in.
   */
  function moveFromDifferent(a, b, M, rnd) {
    const r1 = rem(a, M);
    const r2 = rem(b, M);
    if (r1 === 0) {
      if (r2 === 1) {
        if (a > 0 || rnd() < 0.5) {
          const take = 1 + Math.floor(rnd() * M);
          return { heap: 0, take: Math.min(take, a) || 1 };
        }
        const take = 1 + Math.floor(rnd() * r2);
        return { heap: 1, take: Math.min(take, b) };
      }
      // r2 !== 1: cut b by r2-1
      return { heap: 1, take: Math.max(1, r2 - 1) };
    }
    if (r1 === 1) {
      if (r2 === 0) {
        if (b !== 0) {
          if (rnd() < 0.5) {
            const take = 1 + Math.floor(rnd() * M);
            return { heap: 1, take: Math.min(take, b) };
          }
          if (a === 1) return { heap: 0, take: 1 };
          const take = 1 + Math.floor(rnd() * M);
          return { heap: 0, take: Math.min(take, a) };
        }
        // b === 0
        if (a === 1) return { heap: 0, take: 1 };
        const take = 1 + Math.floor(rnd() * M);
        return { heap: 0, take: Math.min(take, a) };
      }
      // r2 !== 0: cut b by r2
      return { heap: 1, take: Math.min(r2, b) };
    }
    // r1 >= 2
    if (r2 === 0) return { heap: 0, take: Math.max(1, r1 - 1) };
    if (r2 === 1) return { heap: 0, take: r1 };
    const d = r1 - r2;
    if (d > 0) return { heap: 0, take: d };
    return { heap: 1, take: Math.max(1, -d) };
  }

  function computerMove(state, rnd = Math.random) {
    const M = state.maxMove;
    let a = state.heaps[0];
    let b = state.heaps[1];
    const ra = rem(a, M);
    const rb = rem(b, M);
    let move;
    if (ra === rb) {
      if (a >= b) {
        move = moveFromEqual(a, b, M, rnd);
        // move.heap 0→a, 1→b already
      } else {
        move = moveFromEqual(b, a, M, rnd);
        move = { heap: move.heap === 0 ? 1 : 0, take: move.take };
      }
    } else if (a >= b) {
      move = moveFromDifferent(a, b, M, rnd);
    } else {
      move = moveFromDifferent(b, a, M, rnd);
      move = { heap: move.heap === 0 ? 1 : 0, take: move.take };
    }
    // Clamp to a legal take
    const n = state.heaps[move.heap];
    if (n <= 0) {
      const other = 1 - move.heap;
      if (state.heaps[other] > 0) {
        return { heap: other, take: Math.min(M, state.heaps[other]) };
      }
      return null;
    }
    move.take = Math.max(1, Math.min(M, n, move.take));
    return move;
  }

  function playComputer(state, rnd = Math.random) {
    if (state.over || state.turn !== "computer") return state;
    const m = computerMove(state, rnd);
    if (!m) return state;
    return applyMove(state, m.heap, m.take);
  }

  function undo(state) {
    if (!state.history.length) return state;
    let history = state.history.slice();
    const last = history.pop();
    let heaps = last.before.slice();
    if (last.turn === "computer" && history.length) {
      const prev = history.pop();
      heaps = prev.before.slice();
    }
    return {
      ...state,
      heaps,
      history,
      turn: "you",
      over: false,
      winner: null,
      note: null,
    };
  }

  function result(state) {
    if (!state.over) return null;
    return state.winner === "you" ? "win" : "lose";
  }

  function snapshot(state) {
    return {
      maxMove: state.maxMove,
      maxHeap: state.maxHeap,
      heaps: state.heaps.slice(),
      turn: state.turn,
      over: state.over,
      winner: state.winner,
      historyLength: state.history.length,
    };
  }

  function restore(snap) {
    return {
      maxMove: clamp(snap.maxMove, MIN_MOVE, MAX_MOVE, DEFAULT_MOVE),
      maxHeap: clamp(snap.maxHeap, MIN_HEAP, MAX_HEAP, DEFAULT_HEAP),
      heaps: Array.isArray(snap.heaps) ? [snap.heaps[0] | 0, snap.heaps[1] | 0] : [0, 0],
      turn: snap.turn === "computer" ? "computer" : "you",
      over: !!snap.over,
      winner: snap.winner || null,
      history: [],
      note: null,
    };
  }

  return {
    MIN_MOVE, MAX_MOVE, DEFAULT_MOVE,
    MIN_HEAP, MAX_HEAP, DEFAULT_HEAP,
    rem, secondPlayerWins, deal, start, legalMoves, applyMove,
    computerMove, playComputer, undo, result, snapshot, restore,
  };
})();
