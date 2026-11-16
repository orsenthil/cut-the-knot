"use strict";

/*
 * Sticky Problem, from Alexander Bogomolny's applet StickyProblem
 * (AMM #569 / Sung Soo Kim; solution by Li Zhou).
 *
 * Sticks of lengths 1…4. A move either breaks one stick of length ≥ 2 into
 * two shorter positive lengths, or removes n sticks of length n. Last move
 * wins. Positions are counted as (k,l,m,n) = counts of lengths 1,2,3,4; the
 * P-positions are those with (k+m) mod 2 = (l+n) mod 3. The computer follows
 * the applet's Play() replies that steer toward that set.
 */
const StickyProblemCore = (() => {
  const MAX_LEN = 4;
  /** Standard AMM start: one length-1 and four length-4 sticks. */
  const STANDARD = [1, 4, 4, 4, 4];

  function copySticks(sticks) {
    return sticks.slice();
  }

  function countsOf(sticks) {
    const c = [0, 0, 0, 0];
    for (const len of sticks) {
      if (len >= 1 && len <= MAX_LEN) c[len - 1]++;
    }
    return c;
  }

  function rOf(c) {
    return (c[0] + c[2]) % 2;
  }

  function sOf(c) {
    return (c[1] + c[3]) % 3;
  }

  /** True iff (k+m) mod 2 equals (l+n) mod 3 — the page's P-set. */
  function isP(sticks) {
    const c = countsOf(sticks);
    return rOf(c) === sOf(c);
  }

  function start(options = {}) {
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    let sticks;
    if (options.sticks) {
      sticks = copySticks(options.sticks);
    } else if (options.randomStart) {
      // Applet Reset: NY rows, each length 1+floor(random*NX) with NX=4, NY=5.
      const nx = options.nx ?? 4;
      const ny = options.ny ?? 5;
      sticks = [];
      for (let i = 0; i < ny; i++) {
        sticks.push(1 + Math.floor(rnd() * nx));
      }
    } else {
      sticks = copySticks(STANDARD);
    }
    return {
      sticks,
      turn: "you",
      over: false,
      winner: null,
      mode: options.mode === "remove" ? "remove" : "break",
      wins: 0,
      losses: 0,
      note: null,
    };
  }

  function restore(partial) {
    return start({
      sticks: partial.sticks || STANDARD,
      mode: partial.mode,
    });
  }

  function finished(state) {
    return state.sticks.length === 0;
  }

  function result(state) {
    if (!state.over) return null;
    if (state.winner === "you") return "win";
    if (state.winner === "computer") return "lose";
    return "done";
  }

  /** Break stick at index into left + (len-left); left in 1..len-1. */
  function breakAt(state, index, left) {
    if (state.over || state.turn !== "you") return null;
    const sticks = state.sticks;
    if (index < 0 || index >= sticks.length) return null;
    const len = sticks[index];
    if (len < 2 || left < 1 || left >= len) return null;
    const next = copySticks(sticks);
    next.splice(index, 1, left, len - left);
    return afterHuman(state, next);
  }

  /**
   * Remove `len` sticks of length `len`, including the stick at `index`
   * when possible (applet FindAndRemove).
   */
  function removeN(state, index) {
    if (state.over || state.turn !== "you") return null;
    const sticks = state.sticks;
    if (index < 0 || index >= sticks.length) return null;
    const len = sticks[index];
    if (len < 1 || len > MAX_LEN) return null;
    const idxs = [];
    for (let i = 0; i < sticks.length; i++) {
      if (sticks[i] === len) idxs.push(i);
    }
    if (idxs.length < len) return null; // NOTALLOWED
    // Prefer keeping the clicked stick among those removed.
    const pick = new Set();
    pick.add(index);
    for (const i of idxs) {
      if (pick.size >= len) break;
      pick.add(i);
    }
    const next = sticks.filter((_, i) => !pick.has(i));
    return afterHuman(state, next);
  }

  function afterHuman(state, sticks) {
    const next = {
      ...state,
      sticks,
      note: null,
      wins: state.wins,
      losses: state.losses,
    };
    if (sticks.length === 0) {
      next.over = true;
      next.winner = "you";
      next.wins = state.wins + 1;
      next.turn = "you";
      return next;
    }
    next.turn = "computer";
    return next;
  }

  function applyComputerMove(state, sticks) {
    const next = {
      ...state,
      sticks,
      note: null,
      turn: "you",
    };
    if (sticks.length === 0) {
      next.over = true;
      next.winner = "computer";
      next.losses = state.losses + 1;
      next.turn = "computer";
      return next;
    }
    return next;
  }

  function findIndexOfLength(sticks, len) {
    return sticks.findIndex((x) => x === len);
  }

  /** Remove `size` sticks of length `size` (FindAndRemoveSize). */
  function findAndRemoveSize(sticks, size) {
    const idxs = [];
    for (let i = 0; i < sticks.length; i++) {
      if (sticks[i] === size) idxs.push(i);
    }
    if (idxs.length < size) return sticks;
    const drop = new Set(idxs.slice(0, size));
    return sticks.filter((_, i) => !drop.has(i));
  }

  /** Split one stick of length `len` into `a`+`b` (a+b=len). */
  function splitOne(sticks, len, a, b, rnd) {
    if (a + b !== len) return sticks;
    const i = findIndexOfLength(sticks, len);
    if (i < 0) return sticks;
    const left = rnd() < 0.5 ? a : b;
    const right = len - left;
    const next = copySticks(sticks);
    next.splice(i, 1, left, right);
    return next;
  }

  function makeRandomMove(sticks, counts, rnd) {
    // Prefer removing a complete "n of length n" with 25% each.
    for (let i = 0; i < MAX_LEN; i++) {
      if (counts[i] === i + 1 && rnd() < 0.25) {
        return findAndRemoveSize(sticks, i + 1);
      }
    }
    // Prefer a random break of a stick whose count equals its length.
    for (let i = 0; i < MAX_LEN; i++) {
      if (counts[i] === i + 1 && rnd() < 0.25) {
        const len = i + 1;
        if (len < 2) continue;
        const left = 1 + Math.floor(rnd() * (len - 1));
        return splitOne(sticks, len, left, len - left, rnd);
      }
    }
    // Fallback: remove as many of some present length as FindAndRemoveSize allows.
    for (let i = 0; i < MAX_LEN; i++) {
      if (counts[i] > 0) {
        const next = findAndRemoveSize(sticks, i + 1);
        if (next.length !== sticks.length) return next;
      }
    }
    // Last resort: break any stick of length ≥ 2.
    for (let i = 0; i < sticks.length; i++) {
      if (sticks[i] >= 2) {
        const len = sticks[i];
        const left = 1;
        const next = copySticks(sticks);
        next.splice(i, 1, left, len - left);
        return next;
      }
    }
    // Only length-1 sticks: take one.
    if (sticks.length) return findAndRemoveSize(sticks, 1);
    return sticks;
  }

  /**
   * Applet Play(): reply from (s−r) toward a P-position, else MakeRandomMove.
   * Returns the new sticks array.
   */
  function computerChoice(state, rnd = Math.random) {
    const sticks = copySticks(state.sticks);
    const c = countsOf(sticks);
    const r = rOf(c);
    const s = sOf(c);
    const diff = s - r;
    if (diff === -1) {
      if (c[0] > 0) return findAndRemoveSize(sticks, 1);
      if (c[2] > 0) return splitOne(sticks, 3, 1, 2, rnd);
    } else if (diff === 1) {
      if (c[1] > 0) return splitOne(sticks, 2, 1, 1, rnd);
      if (c[3] > 0) return splitOne(sticks, 4, 1, 3, rnd);
    } else if (diff === 2) {
      if (c[1] > 1) return findAndRemoveSize(sticks, 2);
      if (c[3] > 0) return splitOne(sticks, 4, 2, 2, rnd);
    }
    return makeRandomMove(sticks, c, rnd);
  }

  function playComputer(state, rnd = Math.random) {
    if (state.over) return state;
    // Allow computer to move on its turn, or when forced first ("Make move").
    const sticks = computerChoice({ ...state, turn: "computer" }, rnd);
    return applyComputerMove(state, sticks);
  }

  function legalBreaks(state) {
    const moves = [];
    if (state.over) return moves;
    state.sticks.forEach((len, index) => {
      for (let left = 1; left < len; left++) {
        moves.push({ type: "break", index, left, right: len - left });
      }
    });
    return moves;
  }

  function legalRemoves(state) {
    const moves = [];
    if (state.over) return moves;
    const c = countsOf(state.sticks);
    for (let len = 1; len <= MAX_LEN; len++) {
      if (c[len - 1] >= len) {
        const index = state.sticks.findIndex((x) => x === len);
        moves.push({ type: "remove", length: len, index });
      }
    }
    return moves;
  }

  function legalMoves(state) {
    return legalBreaks(state).concat(legalRemoves(state));
  }

  function move(state, m) {
    if (!m) return null;
    if (m.type === "break") return breakAt(state, m.index, m.left);
    if (m.type === "remove") {
      const idx =
        m.index != null ? m.index : state.sticks.findIndex((x) => x === m.length);
      return removeN(state, idx);
    }
    return null;
  }

  return {
    MAX_LEN,
    STANDARD,
    start,
    restore,
    finished,
    result,
    countsOf,
    isP,
    rOf,
    sOf,
    breakAt,
    removeN,
    legalMoves,
    legalBreaks,
    legalRemoves,
    move,
    computerChoice,
    playComputer,
  };
})();
