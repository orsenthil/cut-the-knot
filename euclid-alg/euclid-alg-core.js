"use strict";

/*
 * Euclid's Game with typed numbers, from Alexander Bogomolny's applet EuclidAlg
 * (the page's applet is named "euclid"; the grid version is the other port,
 * euclid-game).
 *
 * The board starts with two different numbers, N and M with M < N, both from 5 to
 * 99. A player types a positive number that is the difference of two numbers already
 * on the board and is not on it yet; players alternate and whoever cannot move loses.
 * Differences are all multiples of g = gcd(N, M), and every multiple of g up to N
 * eventually appears, however the game is played. So the board ends with exactly
 * N/g numbers, the game lasts N/g - 2 moves, and the first player wins when that is
 * odd.
 *
 * Read off the bytecode: PutNum(n, report) accepts n only if it is a multiple of g, not
 * above N, and a difference of two numbers on the board ("Please check your
 * calculations..." when n is not a multiple of g or too large, "How come? Please try
 * again..." when it is not a difference, "The number is already on the board" when it
 * is there); MakeStep, the computer, puts the smallest multiple of g (from g, below N)
 * that PutNum accepts; the game is over when the board holds N/g numbers: the player who
 * made the last move wins ("You won! Congratulations!" or "It's now over, I won"). The
 * "Please start" box makes the computer move first; it is available until the first move.
 *
 * The applet's board size comes from its canvas (100 slots here: numbers below 100).
 * The position is plain data; functions return new objects.
 */
const EuclidAlgCore = (() => {
  const MAX = 100;

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  function rng(seed) {
    let s = (Math.trunc(Number(seed)) || 1) >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  /** A new game: options a, b (two different numbers from 5 to 99) or a seed for random ones (the applet's Reset). */
  function start(options) {
    const o = options || {};
    const next = rng(o.seed === undefined ? 2024 : o.seed);
    const ok = (v) => Number.isInteger(v) && v >= 5 && v < MAX;
    let a = ok(o.a) ? o.a : Math.trunc(next() * (MAX - 5) + 5);
    let b = ok(o.b) && o.b !== a ? o.b : a;
    while (b === a) b = Math.trunc(next() * (MAX - 5) + 5);
    const hi = Math.max(a, b), lo = Math.min(a, b);
    const g = gcd(hi, lo);
    return { n1: hi, n2: lo, board: [lo, hi], total: hi / g, turn: "you", started: false, last: null, moves: 0, message: "" };
  }

  const g = (s) => gcd(s.n1, s.n2);
  const finished = (s) => s.board.length === s.total;

  /** Is n the difference of two numbers on the board? */
  function isDifference(s, n) {
    for (let i = 0; i < s.board.length; i++) for (let j = 0; j < s.board.length; j++) if (s.board[i] - s.board[j] === n) return true;
    return false;
  }

  /** What the applet's PutNum(n, true) says about n: "ok", or one of its three messages. */
  function check(s, n) {
    const gg = g(s);
    if (!Number.isInteger(n) || Math.trunc(n / gg) * gg !== n || n > s.n1 || n < 0) return "Please check your calculations...";
    if (n === 0 || !isDifference(s, n)) return "How come? Please try again...";
    if (s.board.includes(n)) return "The number is already on the board";
    return "ok";
  }

  const add = (s, n) => ({ ...s, board: s.board.concat(n).sort((x, y) => x - y) });

  /** The computer's number: the smallest multiple of g below N that is a new difference (MakeStep). */
  function computerPick(s) {
    const gg = g(s);
    for (let k = gg; k < s.n1; k += gg) if (!s.board.includes(k) && isDifference(s, k)) return k;
    return null;
  }

  /** "win" when you made the last move, "lose" when the computer did, null while the game goes on. */
  function result(s) {
    if (!finished(s)) return null;
    return s.last === "you" ? "win" : "lose";
  }

  /**
   * Moves: {type:"put", n}: your number (then it is the computer's turn); {type:"computer"}: the
   * computer's number, when it is its turn (also the "Please start" move, before any number was put);
   * {type:"reset", seed}.
   */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "put") {
      if (s.turn !== "you" || finished(s)) return null;
      const n = Number(m.n);
      const why = check(s, n);
      if (why !== "ok") return { ...s, message: why, rejected: true };
      const t = add(s, n);
      const over = t.board.length === t.total;
      return { ...t, turn: over ? "you" : "computer", started: true, last: "you", moves: s.moves + 1, message: over ? "You won! Congratulations!" : "", rejected: false };
    }
    if (m.type === "computer") {
      if (finished(s)) return null;
      if (s.turn !== "computer" && !(s.turn === "you" && !s.started && s.moves === 0)) return null;
      const k = computerPick(s);
      if (k === null) return null;
      const t = add(s, k);
      const over = t.board.length === t.total;
      return { ...t, turn: "you", started: true, last: "computer", moves: s.moves + 1, message: over ? "It's now over, I won" : "", rejected: false, computerNumber: k };
    }
    if (m.type === "reset") return start({ seed: m.seed });
    return null;
  }

  /** Numbers the player may type now: a new multiple of g that is a difference. */
  function legalMoves(s) {
    if (s.turn !== "you" || finished(s)) return [];
    const out = [];
    for (let k = g(s); k < s.n1; k += g(s)) if (check(s, k) === "ok") out.push({ type: "put", n: k });
    return out;
  }

  return { MAX, start, gcd, check, isDifference, computerPick, move, result, legalMoves, finished };
})();
