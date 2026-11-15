"use strict";

/*
 * The Silver Dollar Game With No Silver Dollar (Bogus Nim), from Alexander
 * Bogomolny's NoSilverDollar applet.
 *
 * Counters sit on a row of squares numbered from 0. A move slides one counter
 * to the left onto an empty square; it may not pass or share a square with
 * another counter. Both players move the same counters. Whoever makes the
 * last move wins, so the player who cannot move loses.
 *
 * The key idea: count the empty squares just to the left of the rightmost
 * counter, skip the next gap, count the one after, and so on. Those gaps are
 * Nim heaps. If their XOR (the Nim-sum) is not zero, some gap can be made
 * smaller so that it becomes zero, and that is a winning move.
 *
 * The position is plain data:
 *   { length, positions (ascending), turn: "you" | "computer", over, winner, moves }
 */
const NoSilverDollarCore = (() => {
  const MIN_LENGTH = 5, MAX_LENGTH = 30, DEFAULT_LENGTH = 25;
  const MIN_CHIPS = 1, MAX_CHIPS = 12, DEFAULT_CHIPS = 3;

  /** The applet's chip spinner takes a value up to three less than the length. */
  function maxChips(length) { return Math.min(MAX_CHIPS, length - 3); }

  /** A new game: counters at random on squares 2 to length-1, the player first. */
  function start(options = {}, rnd = Math.random) {
    const length = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, Number(options.length) || DEFAULT_LENGTH));
    const count = Math.max(MIN_CHIPS, Math.min(maxChips(length), Number(options.chips) || DEFAULT_CHIPS));
    const positions = [];
    while (positions.length < count) {
      const p = Math.trunc(rnd() * (length - 2)) + 2;
      if (!positions.includes(p)) positions.push(p);
    }
    positions.sort((a, b) => a - b);
    return { length, positions, turn: "you", over: false, winner: null, moves: 0 };
  }

  /** The empty squares directly to the left of counter i. */
  function gap(positions, i) {
    return i === 0 ? positions[0] : positions[i] - positions[i - 1] - 1;
  }

  function legalMoves(s) {
    const out = [];
    for (let i = 0; i < s.positions.length; i++) {
      const floor = i ? s.positions[i - 1] + 1 : 0;
      for (let to = floor; to < s.positions[i]; to++) out.push({ chip: i, from: s.positions[i], to });
    }
    return out;
  }

  /** "Set up": put a counter on any empty square. The turn does not change. */
  function setupMove(s, chip, to) {
    if (!Number.isInteger(chip) || !Number.isInteger(to) || chip < 0 || chip >= s.positions.length ||
        to < 0 || to >= s.length || s.positions.includes(to)) return null;
    const positions = s.positions.slice();
    positions[chip] = to;
    positions.sort((a, b) => a - b);
    return { ...s, positions };
  }

  function apply(s, m, turn) {
    if (s.over || s.turn !== turn || !m || !Number.isInteger(m.chip) || !Number.isInteger(m.to)) return null;
    if (!legalMoves(s).some(x => x.chip === m.chip && x.to === m.to)) return null;
    const positions = s.positions.slice();
    positions[m.chip] = m.to;
    const next = { ...s, positions, moves: s.moves + 1, turn: turn === "you" ? "computer" : "you" };
    if (!legalMoves(next).length) {
      next.over = true;
      next.winner = turn;
    }
    return next;
  }

  /** The Nim heaps: every other gap, starting left of the rightmost counter. */
  function heaps(s) {
    const h = [];
    for (let i = s.positions.length - 1; i >= 0; i -= 2) h.push(gap(s.positions, i));
    return h;
  }

  function nimSum(s) { return heaps(s).reduce((x, v) => x ^ v, 0); }

  // The applet's MakeRightMove: of the heaps, take the first (from the right)
  // with the largest (heap AND Nim-sum) and shrink it to (heap XOR Nim-sum).
  function winningMove(s) {
    const x = nimSum(s);
    if (!x) return null;
    let chosen = 0, best = 0;
    for (let i = s.positions.length - 1; i >= 0; i -= 2) {
      const g = gap(s.positions, i);
      if (g !== 0 && best < (g & x)) { best = g & x; chosen = i; }
    }
    const target = gap(s.positions, chosen) ^ x;
    const to = chosen === 0 ? target : s.positions[chosen - 1] + target + 1;
    return { chip: chosen, from: s.positions[chosen], to };
  }

  // The applet's MakeRandomMove: pick one of the empty squares left of the
  // rightmost counter, take the first counter to its right, and slide it a
  // random distance into its own gap. Every legal move is equally likely.
  function randomMove(s, rnd) {
    const pos = s.positions, n = pos.length;
    const pick = Math.trunc((pos[n - 1] - n + 1) * rnd() + 1);
    let chip = n - 1;
    for (let i = 0; i < n; i++) if (pick <= pos[i] - i) { chip = i; break; }
    const distance = Math.trunc(gap(pos, chip) * rnd() + 1);
    return { chip, from: pos[chip], to: Math.max(0, pos[chip] - distance) };
  }

  /** The move the computer makes here, or null when it is not its turn. */
  function computerChoice(s, rnd = Math.random) {
    if (s.over || s.turn !== "computer" || !legalMoves(s).length) return null;
    return winningMove(s) || randomMove(s, rnd);
  }

  function computerMove(s, rnd = Math.random) {
    const m = computerChoice(s, rnd);
    return m ? apply(s, m, "computer") : null;
  }

  function snapshot(s) {
    return { length: s.length, positions: s.positions.slice(), turn: s.turn, over: s.over, winner: s.winner, moves: s.moves };
  }

  function restore(data) {
    if (!data || !Number.isInteger(data.length) || data.length < MIN_LENGTH || data.length > MAX_LENGTH ||
        !Array.isArray(data.positions) || data.positions.length < MIN_CHIPS || data.positions.length > maxChips(data.length) ||
        !data.positions.every((p, i, a) => Number.isInteger(p) && p >= 0 && p < data.length && (!i || p > a[i - 1])) ||
        !["you", "computer"].includes(data.turn)) throw new Error("not a No Silver Dollar position");
    return { length: data.length, positions: data.positions.slice(), turn: data.turn,
      over: Boolean(data.over), winner: data.winner === "you" || data.winner === "computer" ? data.winner : null,
      moves: Number.isInteger(data.moves) ? data.moves : 0 };
  }

  return { MIN_LENGTH, MAX_LENGTH, DEFAULT_LENGTH, MIN_CHIPS, MAX_CHIPS, DEFAULT_CHIPS, maxChips,
    start, legalMoves, setupMove, move: (s, m) => apply(s, m, "you"), computerChoice, computerMove,
    heaps, nimSum, winningMove, snapshot, restore };
})();
