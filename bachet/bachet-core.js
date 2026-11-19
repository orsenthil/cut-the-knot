"use strict";

/*
 * Bachet's Magic Trick, from Alexander Bogomolny's applet Bachet.
 *
 * The performer writes the numbers 1..M (M = N(N+1)) on cards. Consecutive
 * cards (P[0],P[1]), (P[2],P[3]), ... form the M/2 "pairs" shown in the first
 * stage; a spectator remembers one displayed pair of numbers. Proceed lays all
 * M cards out in an N by (N+1) grid. The spectator names the two ROWS holding
 * their two numbers (the same row twice if both are there), and the computer
 * names the numbers back.
 *
 * The key idea is the arrangement: the two cards of pair {a,b} (0-based, a<=b)
 * are always placed in rows a and b of the grid. Naming the two rows therefore
 * recovers the pair of cards. Straight mode uses the natural card order;
 * Randomize shuffles the cards within each row and may swap the two cards of a
 * pair between their rows -- neither changes which two rows a pair occupies.
 *
 * This file is the game's logic and nothing else: no document, no window, no
 * storage. It defines one global, BachetCore, so the page loads it with a plain
 * <script> and porting/check-bachet.mjs loads it in Node. The position is plain
 * data, so it can be saved and handed to the tutor as it is.
 */
const BachetCore = (() => {
  const MIN_N = 3;
  const MAX_N = 6;

  // BachetConfig.Rows: how many displayed pairs sit in each row of stage 1.
  const STAGE1_ROWS = {
    3: [3, 3],
    4: [4, 3, 3],
    5: [5, 5, 5],
    6: [6, 5, 5, 5],
  };

  const FIRST = 0;
  const SECOND = 1;
  const FINAL = 2;

  // The three two-line announcements, transcribed from BachetOb's constructor.
  const ANNOUNCEMENT = {
    0: ["Select a pair of numbers.", "Click Proceed!"],
    1: ["Click on the left of the rows", "that contain your numbers."],
    2: ["Your numbers are", "Press Reset!"],
  };

  const clamp = (value, low, high, fallback) => {
    const v = Math.trunc(Number(value));
    return Number.isFinite(v) ? Math.max(low, Math.min(high, v)) : fallback;
  };

  /** Small deterministic PRNG (xorshift32) so a position is reproducible. */
  function prng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17; s >>>= 0;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  const identity = (size) => Array.from({ length: size }, (_, i) => i + 1);

  /** A Fisher-Yates shuffle of 1..size, matching Permutation.CreateRandom. */
  function shuffled(size, rand) {
    const a = identity(size);
    for (let i = size - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /*
   * The heart of the applet: BachetOb.Reset's big loop, as pure data.
   *
   *   P[i]      label on card i (a permutation of 1..M)
   *   Aux[r][c] column permutation for row r (a permutation of 1..N+1)
   *   swaps[t]  whether pair t swaps its two cards between its rows
   *
   * Returns the N by (N+1) grid, the row-pair -> labels table, and the ordered
   * list of displayed pairs. Once built, no randomness is needed again.
   */
  function buildGrid(n, P, Aux, swaps) {
    const M = n * (n + 1);
    const rows = Array.from({ length: n }, () => new Array(n + 1).fill(0));
    const table = Object.create(null);
    const pairs = [];
    let a = 0;
    let b = 0;

    for (let k = 0; k < M; k += 2) {
      const L = P[k];
      const R = P[k + 1];
      const sw = !!(swaps && swaps[k / 2]);
      const x = sw ? R : L; // first card placed (applet's swap ? y : x)
      const y = sw ? L : R; // second card placed (applet's swap ? x : y)
      let key;
      let pairB; // the second index of the pair {a, pairB}

      if (a === b) {
        pairB = a;
        key = String(a) + String(a);
        table[key] = [L, R];
        rows[a][Aux[a][b] - 1] = x;
        b++;
        rows[a][Aux[a][b] - 1] = y;
        b++;
      } else if (b < n + 1) {
        pairB = b - 1;
        key = String(a) + String(pairB);
        table[key] = [L, R];
        rows[a][Aux[a][b] - 1] = x;
        rows[b - 1][Aux[b - 1][a] - 1] = y;
        b++;
      } else {
        a++;
        b = a;
        pairB = a;
        key = String(a) + String(a);
        table[key] = [L, R];
        rows[a][Aux[a][b] - 1] = x;
        b++;
        rows[a][Aux[a][b] - 1] = y;
        b++;
      }

      pairs.push({ a, b: pairB, labels: [L, R], key });
    }

    return { rows, table, pairs };
  }

  /** The generated random choices, kept in the position for reproducibility. */
  function makeOptions(raw) {
    const o = raw || {};
    const n = clamp(o.n === undefined ? 4 : o.n, MIN_N, MAX_N, 4);
    return {
      n,
      straight: !!o.straight,
      randomized: o.randomized === undefined ? true : !!o.randomized,
      seed: clamp(o.seed === undefined ? 1 : o.seed, 0, 0xffffffff, 1),
    };
  }

  function start(raw) {
    const opt = makeOptions(raw);
    const { n, straight, randomized, seed } = opt;
    const M = n * (n + 1);
    const rand = prng(seed);

    // Reset fixes P first, then the Aux row permutations, then each swap.
    const P = straight ? identity(M) : shuffled(M, rand);
    const Aux = [];
    for (let r = 0; r < n; r++) Aux.push(randomized ? shuffled(n + 1, rand) : identity(n + 1));
    const swaps = [];
    for (let t = 0; t < M / 2; t++) swaps.push(randomized ? rand() > 0.5 : false);

    const grid = buildGrid(n, P, Aux, swaps);
    return {
      n, straight, randomized, seed,
      stage: FIRST,
      labels: P.slice(),
      aux: Aux.map((row) => row.slice()),
      swaps: swaps.slice(),
      rows: grid.rows,
      table: grid.table,
      pairs: grid.pairs,
      answer: null,
      chosen: null,
      reportedRows: null,
    };
  }

  /** Proceed: move from the pair list to the N by (N+1) array. */
  function play(state) {
    return { ...state, stage: SECOND, answer: null, reportedRows: null };
  }

  /** Reset: a fresh trick with the same options but a new seed. */
  function restart(state) {
    return start({ n: state.n, straight: state.straight, randomized: state.randomized, seed: state.seed + 1 });
  }

  /** Choose one of the displayed pairs in the first stage (by its index). */
  function choosePair(state, index) {
    if (state.stage !== FIRST || !Number.isInteger(index) || index < 0 || index >= state.pairs.length) return state;
    return { ...state, chosen: index };
  }

  /**
   * The spectator points to two rows. BachetOb.ReportSelection sorts them,
   * looks up the row-pair and reveals the two card numbers (BachetOb.Answer).
   */
  function reportSelection(state, r1, r2) {
    if (state.stage !== SECOND) return state;
    if (r1 === -1 || r2 === -1) return { ...state, stage: FINAL, answer: null, reportedRows: [r1, r2] };
    let lo = r1;
    let hi = r2;
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    const found = state.table[String(lo) + String(hi)];
    const answer = found ? found.slice() : null;
    return { ...state, stage: FINAL, answer, reportedRows: [lo, hi] };
  }

  const finished = (state) => state.stage === FINAL;
  const justStarted = (state) => state.stage === FIRST;

  /** The two text lines shown under the title, for the current stage. */
  function announcement(state) {
    if (state.stage === FINAL && state.answer) {
      return [`Your numbers are ${state.answer[0]} and ${state.answer[1]}`, ANNOUNCEMENT[2][1]];
    }
    return ANNOUNCEMENT[state.stage].slice();
  }

  /** Label on the card at grid cell (row, column). */
  const at = (state, row, col) => state.rows[row][col];
  /** Label on card number `index` (BachetOb.at(int)). */
  const labelAt = (state, index) => state.labels[index];

  /** Where a card sits in the grid: [row, column], or null. */
  function locate(state, label) {
    for (let r = 0; r < state.n; r++) {
      const c = state.rows[r].indexOf(label);
      if (c !== -1) return [r, c];
    }
    return null;
  }

  /** The displayed pairs, grouped into the applet's stage-1 rows. */
  function stage1Rows(state) {
    const lengths = STAGE1_ROWS[state.n];
    const out = [];
    let i = 0;
    for (const len of lengths) {
      const row = [];
      for (let c = 0; c < len && i < state.pairs.length; c++, i++) {
        row.push({ index: i, labels: state.pairs[i].labels.slice() });
      }
      out.push(row);
    }
    return out;
  }

  return {
    MIN_N, MAX_N, FIRST, SECOND, FINAL, STAGE1_ROWS,
    clamp, prng, identity, shuffled, buildGrid, makeOptions, start,
    play, restart, choosePair, reportSelection, finished, justStarted,
    announcement, at, labelAt, locate, stage1Rows,
  };
})();
