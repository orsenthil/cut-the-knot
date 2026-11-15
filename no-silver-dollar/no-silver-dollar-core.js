"use strict";

/*
 * The Silver Dollar Game With No Silver Dollar (Bogus Nim), from Alexander
 * Bogomolny's NoSilverDollar applet. Counters move left into empty spaces and
 * may not pass or share. Alternate gaps between counters are Nim heaps. Their
 * sizes are XORed; a nonzero XOR can be reduced to zero with a legal move.
 */
const NoSilverDollarCore = (() => {
  const MIN_LENGTH = 5, MAX_LENGTH = 30, DEFAULT_LENGTH = 25;
  const MIN_CHIPS = 1, MAX_CHIPS = 12, DEFAULT_CHIPS = 3;

  function start(options = {}, rnd = Math.random) {
    const length = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, Number(options.length) || DEFAULT_LENGTH));
    const count = Math.max(MIN_CHIPS, Math.min(Math.min(MAX_CHIPS, length - 4), Number(options.chips) || DEFAULT_CHIPS));
    const positions = [];
    while (positions.length < count) {
      const p = Math.trunc(rnd() * (length - 2)) + 2;
      if (!positions.includes(p)) positions.push(p);
    }
    positions.sort((a, b) => a - b);
    return { length, positions, turn: "you", over: false, winner: null, moves: 0 };
  }

  function legalMoves(s) {
    const out = [];
    for (let i = 0; i < s.positions.length; i++) {
      const floor = i ? s.positions[i - 1] + 1 : 0;
      for (let to = floor; to < s.positions[i]; to++) out.push({ chip: i, from: s.positions[i], to });
    }
    return out;
  }

  /** Move a counter freely while arranging a custom starting position. */
  function setupMove(s, chip, to) {
    if (!Number.isInteger(chip) || !Number.isInteger(to) || chip < 0 || chip >= s.positions.length ||
        to < 0 || to >= s.length || s.positions.includes(to)) return null;
    const positions = s.positions.slice();
    positions[chip] = to;
    positions.sort((a, b) => a - b);
    return { ...s, positions };
  }

  function result(s) {
    if (!s.over && legalMoves(s).length) return null;
    return s.winner === "you" ? "win" : "lose";
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

  function heaps(s) {
    const h = [];
    for (let i = s.positions.length - 1; i >= 0; i -= 2) {
      h.push(i === 0 ? s.positions[0] : s.positions[i] - s.positions[i - 1] - 1);
    }
    return h;
  }

  function nimSum(s) { return heaps(s).reduce((x, v) => x ^ v, 0); }

  // Mirrors CreateItinerary/MakeRightMove: inspect alternating gaps from
  // right to left and lower the first largest (gap & nim-sum) heap.
  function winningMove(s) {
    const x = nimSum(s);
    if (!x) return null;
    let chosen = -1, best = -1;
    for (let i = s.positions.length - 1; i >= 0; i -= 2) {
      const gap = i === 0 ? s.positions[0] : s.positions[i] - s.positions[i - 1] - 1;
      const score = gap & x;
      if (score > best) { best = score; chosen = i; }
    }
    if (chosen < 0) return null;
    const gap = chosen === 0 ? s.positions[0] : s.positions[chosen] - s.positions[chosen - 1] - 1;
    const targetGap = gap ^ x;
    const to = chosen === 0 ? targetGap : s.positions[chosen - 1] + targetGap + 1;
    return { chip: chosen, from: s.positions[chosen], to };
  }

  function computerMove(s, rnd = Math.random) {
    if (s.over || s.turn !== "computer") return null;
    let m = winningMove(s);
    if (!m) {
      const choices = legalMoves(s);
      if (!choices.length) return null;
      m = choices[Math.trunc(rnd() * choices.length)];
    }
    return apply(s, m, "computer");
  }

  function snapshot(s) { return { length: s.length, positions: s.positions.slice(), turn: s.turn, over: s.over, winner: s.winner, moves: s.moves }; }
  function restore(data) {
    if (!data || !Number.isInteger(data.length) || data.length < MIN_LENGTH || data.length > MAX_LENGTH ||
        !Array.isArray(data.positions) || data.positions.length < MIN_CHIPS || data.positions.length > Math.min(MAX_CHIPS, data.length - 4) ||
        !data.positions.every((p, i, a) => Number.isInteger(p) && p >= 0 && p < data.length && (!i || p > a[i - 1])) ||
        !["you", "computer"].includes(data.turn)) throw new Error("not a No Silver Dollar position");
    return { length: data.length, positions: data.positions.slice(), turn: data.turn,
      over: Boolean(data.over), winner: data.winner === "you" || data.winner === "computer" ? data.winner : null,
      moves: Number.isInteger(data.moves) ? data.moves : 0 };
  }
  return { MIN_LENGTH, MAX_LENGTH, DEFAULT_LENGTH, MIN_CHIPS, MAX_CHIPS, DEFAULT_CHIPS,
    start, legalMoves, setupMove, move: (s, m) => apply(s, m, "you"), computerMove, heaps, nimSum, winningMove, result, snapshot, restore };
})();
