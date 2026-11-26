"use strict";

/*
 * Turning Turtles, from Alexander Bogomolny's applet tt (a game from
 * Berlekamp, Conway and Guy's Winning Ways).
 *
 * A row of 11 squares shows O or X. A move turns one O into an X and may
 * also flip one square to its left, either way. Whoever makes the last
 * move (turns the last O) wins.
 *
 * The key idea: it is Nim in disguise. Square k (1..11) with an O is a Nim
 * heap of k counters; an X is an empty heap. Turning O at k into X empties
 * heap k; also flipping square j < k leaves, in Nim-sum terms, a heap of j
 * in its place, so the move is "take k - j from heap k". The position is
 * lost for the player to move exactly when the Nim-sum (XOR) of the
 * numbers of the O squares is 0.
 *
 * Transcribed from ttcanvas: the squares start O or X at random; you move
 * first. The computer (ShouldIMove) finds the Nim-sum s; if it is 0 it
 * turns an O near a random square (MakeRandomMove), otherwise it picks a
 * heap L with an O, turns it and flips square L xor s if that is not 0.
 * The applet took the last L going up from 1 for which (L & s) exceeded the
 * L chosen so far; in 9 of the 1,920 winning rows that L has L xor s > L, a
 * flip to the right, which the rules forbid. Here L is the largest O heap
 * with L xor s < L, the Nim move, which always exists. Scores are kept
 * across games. The applet would accept two O squares turned at once (its
 * second pick could lie to the right); the page says the second square is
 * to the left, so that is enforced here. A starting row of all X's has no
 * move and is dealt again.
 *
 * Squares are numbered 0..10 in the code, k = index + 1 on the page. This
 * file is the game's logic and nothing else. It defines one global,
 * TurningTurtlesCore. The position is plain data.
 */
const TurningTurtlesCore = (() => {
  const N = 11;

  function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return { next, seed: () => a };
  }

  /** reset(): each square O or X with chance 1/2 (dealt again if all X). */
  function start(options = {}) {
    let seed = Number.isInteger(options.seed) ? options.seed >>> 0 : 1;
    let x;
    if (Array.isArray(options.x) && options.x.length === N) x = options.x.map(Boolean);
    else {
      const r = rng(seed);
      do x = Array.from({ length: N }, () => r.next() * 2 < 1); while (x.every(Boolean));
      seed = r.seed();
    }
    const score = options.score && Number.isFinite(options.score.me) && Number.isFinite(options.score.you) ? { me: options.score.me, you: options.score.you } : { me: 0, you: 0 };
    return { x, turn: "you", winner: null, score, seed, last: null };
  }

  const over = (s) => s.x.every(Boolean);
  /** The Nim-sum of the O squares (heap k for square k). */
  const nimSum = (x) => x.reduce((acc, isX, i) => (isX ? acc : acc ^ (i + 1)), 0);

  /** A move: turn O at i into X, and flip j < i if j is given. */
  function legal(s, i, j) {
    if (s.winner || !Number.isInteger(i) || i < 0 || i >= N || s.x[i]) return false;
    return j === null || j === undefined || (Number.isInteger(j) && j >= 0 && j < i);
  }

  function apply(s, i, j, who) {
    const x = s.x.slice();
    x[i] = true;
    if (j !== null && j !== undefined) x[j] = !x[j];
    const done = x.every(Boolean);
    const score = done ? { ...s.score, [who]: s.score[who] + 1 } : s.score;
    return { ...s, x, turn: who === "you" ? "me" : "you", winner: done ? who : null, score, last: { who, i, j: j ?? null } };
  }

  /** The player's move (Make Move). */
  function play(s, i, j = null) {
    if (s.turn !== "you" || !legal(s, i, j)) return null;
    return apply(s, i, j, "you");
  }

  /** ShouldIMove: the computer's choice {i, j}, and the generator's new seed. */
  function choose(s) {
    const x = s.x, sum = nimSum(x);
    if (sum === 0) {
      // MakeRandomMove: from a random square, look right and left for an O
      const r = rng(s.seed);
      const start = Math.floor(r.next() * N);
      let a = 0, b = 0;
      for (;;) {
        if (start + a > 0 && start + a <= N && !x[start + a - 1]) return { i: start + a - 1, j: null, seed: r.seed() };
        a++;
        if (start - b > 0 && !x[start - b - 1]) return { i: start - b - 1, j: null, seed: r.seed() };
        b++;
      }
    }
    let L = 0;
    for (let k = 1; k <= N; k++) if (!x[k - 1] && (k ^ sum) < k) L = k;
    return { i: L - 1, j: L === sum ? null : (L ^ sum) - 1, seed: s.seed };
  }

  /** The applet's own heap rule, kept to show where it fails (see the logic test). */
  function appletHeap(x) {
    const sum = nimSum(x);
    let L = 0;
    for (let k = 1; k <= N; k++) if ((k & sum) > L && !x[k - 1]) L = k;
    return L;
  }

  /** The computer's move. */
  function reply(s) {
    if (s.turn !== "me" || s.winner) return null;
    const c = choose(s);
    return { ...apply(s, c.i, c.j, "me"), seed: c.seed };
  }

  /** Reset: a new random row; scores stay. */
  const again = (s) => start({ seed: s.seed, score: s.score });

  const result = (s) => (s.winner === "you" ? "win" : s.winner === "me" ? "lose" : null);

  return { N, rng, start, over, nimSum, legal, play, choose, appletHeap, reply, again, result };
})();
