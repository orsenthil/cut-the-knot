"use strict";

/*
 * Pure logic for Four Knights (no DOM), ported from Alexander Bogomolny's
 * Horse.class applet (cut-the-knot.org/Curriculum/Games/FourKnights.shtml,
 * explanation at .../SimpleGames/Horse.shtml). Decompiled with CFR (run
 * under Homebrew's ARM openjdk@21, since the system Java 8 is x86-only and
 * can't execute here) straight to readable source -- no obfuscation this
 * time, so the port follows HorseCanvas.class's board layout and move rule
 * exactly, just re-derived on a real knight-move graph instead of trusting
 * its particular (arbitrary but equivalent) index labelling.
 *
 * The board is the 3x3 corner of a chessboard. A knight can reach only two
 * of the other 8 outer squares from any outer square (the centre square is
 * unreachable by a knight entirely) -- and tracing those connections visits
 * all 8 outer squares in a single cycle:
 *
 *   TL -> MR -> BL -> TM -> BR -> ML -> TR -> BM -> (back to TL)
 *
 * That's the applet's "unfolded" right-hand view: a ring of 8 positions
 * where only stepping to a cycle-neighbour is a legal move, which is
 * exactly a legal knight move on the left-hand board. This module numbers
 * those ring positions 1-8 in cycle order and lets the UI render both views
 * from the same state.
 *
 * Start: four knights on the board's four corners -- red on the left pair,
 * blue on the right pair, each colour already two ring-steps apart so every
 * knight has an empty square to move into. Goal: swap sides, with every
 * knight back on one of those same four "home" ring positions (the corners)
 * -- not just anywhere the colours end up separated.
 */
const KnightsCore = (() => {
  // Ring position -> {row, col} on the 3x3 board (0-indexed), in cycle order.
  const RING_TO_CELL = [
    null, // unused index 0
    { row: 0, col: 0 }, // 1 = top-left
    { row: 1, col: 2 }, // 2 = middle-right
    { row: 2, col: 0 }, // 3 = bottom-left
    { row: 0, col: 1 }, // 4 = top-middle
    { row: 2, col: 2 }, // 5 = bottom-right
    { row: 1, col: 0 }, // 6 = middle-left
    { row: 0, col: 2 }, // 7 = top-right
    { row: 2, col: 1 }, // 8 = bottom-middle
  ];

  const HOME = { 1: "red", 3: "red", 5: "blue", 7: "blue" };

  function cellOf(ring) {
    return RING_TO_CELL[ring];
  }

  function ringAt(row, col) {
    for (let r = 1; r <= 8; r++) {
      const c = RING_TO_CELL[r];
      if (c.row === row && c.col === col) return r;
    }
    return null; // the centre square
  }

  function neighbors(ring) {
    const prev = ((ring - 2 + 8) % 8) + 1;
    const next = (ring % 8) + 1;
    return [prev, next];
  }

  function start() {
    const occupied = {};
    for (const ring of Object.keys(HOME)) occupied[ring] = HOME[ring];
    return { occupied, moves: 0 };
  }

  // Legal destinations (empty cycle-neighbours) for the knight at `ring`.
  function legalMoves(state, ring) {
    if (!state.occupied[ring]) return [];
    return neighbors(ring).filter((n) => !state.occupied[n]);
  }

  // Returns the new state, or null if the move isn't legal.
  function move(state, from, to) {
    if (!state.occupied[from]) return null;
    if (state.occupied[to]) return null;
    if (!neighbors(from).includes(to)) return null;
    const occupied = { ...state.occupied };
    occupied[to] = occupied[from];
    delete occupied[from];
    return { occupied, moves: state.moves + 1 };
  }

  function isSolved(state) {
    return Object.keys(HOME).every((ring) => state.occupied[ring] === (HOME[ring] === "red" ? "blue" : "red"));
  }

  // Breadth-first search over the full state graph: used only to confirm
  // (in Node, not shipped to the page) that the puzzle is solvable and to
  // find the true shortest solution, which the original page leaves as an
  // open question rather than answering.
  function shortestSolution() {
    const key = (occ) =>
      Object.keys(occ)
        .map((r) => r + ":" + occ[r])
        .sort()
        .join(",");
    const s0 = start();
    const seen = new Set([key(s0.occupied)]);
    let frontier = [s0];
    let depth = 0;
    while (frontier.length) {
      for (const s of frontier) if (isSolved(s)) return depth;
      const next = [];
      for (const s of frontier) {
        for (const ring of Object.keys(s.occupied)) {
          for (const dest of legalMoves(s, Number(ring))) {
            const n = move(s, Number(ring), dest);
            const k = key(n.occupied);
            if (!seen.has(k)) {
              seen.add(k);
              next.push(n);
            }
          }
        }
      }
      frontier = next;
      depth++;
      if (depth > 100) return -1; // safety valve; should never trigger
    }
    return -1; // unsolvable
  }

  return { cellOf, ringAt, neighbors, start, legalMoves, move, isSolved, shortestSolution, HOME };
})();

if (typeof module !== "undefined" && module.exports) module.exports = KnightsCore;
