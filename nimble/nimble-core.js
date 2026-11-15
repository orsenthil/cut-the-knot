"use strict";

/*
 * Nimble, from Alexander Bogomolny's applet Nimble.
 *
 * A row of numbered positions (0 to length-1) with coloured chips placed on
 * them. Two players take turns moving any one chip to the left, any number of
 * squares (it must move at least one). A chip that lands on position 0 is
 * "home" and off the board. The player who moves the last chip home wins.
 *
 * Nimble is Nim in disguise: each chip's position is the size of its Nim
 * heap, and moving a chip left is reducing a heap. Position 0 means the heap
 * is gone. The Sprague-Grundy value of the whole game is the XOR of all
 * chip positions, and the player to move loses exactly when that XOR is 0.
 *
 * The computer's strategy is the applet's CreateItinerary / MakeRightMove /
 * MakeRandomMove, transcribed from the bytecode: XOR all positions; if the
 * result is not 0, find the chip whose position AND the XOR is largest and
 * move it to position XOR position; if it is 0, pick a random chip not at 0
 * and move it to a random lower position (or 0).
 *
 * Options: Length (5-30, default 7) and # Chips (1-12, default 1).
 * The applet places chips at random positions 2 .. length-1.
 */
const NimbleCore = (() => {
  const MIN_LENGTH = 5;
  const MAX_LENGTH = 30;
  const DEFAULT_LENGTH = 7;
  const MIN_CHIPS = 1;
  const MAX_CHIPS = 12;
  const DEFAULT_CHIPS = 1;

  /**
   * Start a new game. Chips are placed at random positions 2 .. length-1,
   * matching the applet's Reset(): Math.random() * (length - 2) + 2, floored.
   */
  function start(length, nChips, rnd) {
    if (rnd === undefined) rnd = Math.random;
    const chips = [];
    for (let i = 0; i < nChips; i++) {
      const pos = Math.trunc(rnd() * (length - 2)) + 2;
      chips.push({ id: i, pos });
    }
    return {
      length,
      chips,
      turn: "you",
      over: false,
      winner: null,
      wins: 0,
      losses: 0,
    };
  }

  /** XOR of all chip positions (the Nim-sum). */
  function nimSum(s) {
    return s.chips.reduce((x, c) => x ^ c.pos, 0);
  }

  /** True when every chip is at position 0. */
  function finished(s) {
    return s.chips.every((c) => c.pos === 0);
  }

  /**
   * Player's move: move chip with the given id to `dest`.
   * Returns "ok", "illegal" (not a leftward move), or "none" (wrong turn/over).
   */
  function playerMove(s, chipId, dest) {
    if (s.over || s.turn !== "you") return "none";
    const chip = s.chips.find((c) => c.id === chipId);
    if (!chip) return "none";
    if (dest < 0 || dest >= chip.pos) return "illegal";
    chip.pos = dest;
    if (finished(s)) {
      s.over = true;
      s.winner = "you";
      s.losses++;
    } else {
      s.turn = "computer";
    }
    return "ok";
  }

  /**
   * MakeRightMove(xor): find the chip with the largest (pos & xor), then
   * move it to (pos ^ xor). This always reduces the position (when xor != 0
   * and the chosen chip has the highest bit of xor set, pos ^ xor < pos).
   */
  function rightMove(s) {
    const x = nimSum(s);
    if (x === 0) return null;
    let best = -1;
    let bestChip = null;
    for (const c of s.chips) {
      if (c.pos === 0) continue;
      const v = c.pos & x;
      if (v > best) {
        best = v;
        bestChip = c;
      }
    }
    if (!bestChip) return null;
    return { chip: bestChip, dest: bestChip.pos ^ x };
  }

  /**
   * MakeRandomMove(): pick the first chip not at 0 and move it to a random
   * position in 0 .. pos-1. The applet picks the first non-zero chip
   * (scanning in order), then dest = max(0, pos - floor(random * pos + 1)).
   * This means dest can be 0 (home).
   */
  function randomMove(s, rnd) {
    let chip = null;
    for (const c of s.chips) {
      if (c.pos !== 0) { chip = c; break; }
    }
    if (!chip) return null;
    const dest = Math.max(0, chip.pos - Math.trunc(rnd() * chip.pos + 1));
    return { chip, dest };
  }

  /** The computer's turn. Returns { chipId, from, dest }. */
  function computerMove(s, rnd) {
    if (rnd === undefined) rnd = Math.random;
    if (s.over || s.turn !== "computer") return null;
    const x = nimSum(s);
    const m = x !== 0 ? rightMove(s) : randomMove(s, rnd);
    if (!m) return null;
    const from = m.chip.pos;
    m.chip.pos = m.dest;
    if (finished(s)) {
      s.over = true;
      s.winner = "computer";
      s.wins++;
    } else {
      s.turn = "you";
    }
    return { chipId: m.chip.id, from, dest: m.dest };
  }

  return {
    MIN_LENGTH, MAX_LENGTH, DEFAULT_LENGTH,
    MIN_CHIPS, MAX_CHIPS, DEFAULT_CHIPS,
    start, nimSum, finished, playerMove, rightMove, randomMove, computerMove,
  };
})();
