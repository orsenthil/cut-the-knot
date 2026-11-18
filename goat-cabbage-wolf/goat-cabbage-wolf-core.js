"use strict";

/*
 * Goat, Cabbage and Wolf, from Bogomolny's OldPuzzle applet.
 *
 * A farmer must ferry a goat, a cabbage and a wolf across a river. The boat
 * carries the farmer and at most one item, and only items on the farmer's
 * shore can be loaded. Left alone, the goat eats the cabbage and the wolf eats
 * the goat, so a move that leaves either pair on the far shore from the farmer
 * loses the game. Getting all three across wins.
 *
 * The key idea is to search the tiny state space: three yes/no item positions
 * and the farmer's shore make 16 times 2 states. The hint does a breadth-first
 * search over the safe ones, which also proves the classic seven-crossing
 * solution is shortest. The logic test checks the whole space and compares the
 * port's win/loss rule with the applet's own (quirky) CheckFinished flags.
 *
 * No document, no window, no storage: one global, GoatCabbageWolfCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const GoatCabbageWolfCore = (() => {
  const GOAT = 0;
  const CABBAGE = 1;
  const WOLF = 2;
  const NAMES = ["the goat", "the cabbage", "the wolf"];
  const LOSS = ["The goat ate the cabbage!", "The wolf ate the goat!"];

  /** A new game: everything on the near shore, farmer on the near shore. */
  function start() {
    return { right: [false, false, false], boat: "left", moves: 0, outcome: null };
  }

  function sideOf(state, item) {
    return state.right[item] ? "right" : "left";
  }

  function farSide(side) {
    return side === "left" ? "right" : "left";
  }

  function onFar(state, side, item) {
    return (state.right[item] === (side === "right"));
  }

  /** The pair that is unattended, if any: 0 = goat/cabbage, 1 = wolf/goat. */
  function danger(state) {
    const alone = farSide(state.boat);
    if (onFar(state, alone, GOAT) && onFar(state, alone, CABBAGE)) return 0;
    if (onFar(state, alone, WOLF) && onFar(state, alone, GOAT)) return 1;
    return null;
  }

  /** Crossing alone, or taking one item that is on the farmer's shore. */
  function legalMoves(state) {
    if (state.outcome) return [];
    const moves = [{ item: null }];
    for (let item = 0; item < 3; item++) {
      if (sideOf(state, item) === state.boat) moves.push({ item });
    }
    return moves;
  }

  /** The position after a crossing, or null if the item is on the wrong shore. */
  function move(state, m) {
    if (!m || state.outcome) return null;
    if (m.item !== null && m.item !== undefined) {
      if (!Number.isInteger(m.item) || m.item < 0 || m.item > 2) return null;
      if (sideOf(state, m.item) !== state.boat) return null;
    }
    const right = state.right.slice();
    if (m.item !== null && m.item !== undefined) right[m.item] = !right[m.item];
    const next = {
      right,
      boat: farSide(state.boat),
      moves: state.moves + 1,
      outcome: null,
    };
    const bad = danger(next);
    if (bad !== null) next.outcome = "lose";
    else if (right.every(Boolean) && next.boat === "right") next.outcome = "win";
    return next;
  }

  function result(state) {
    return state.outcome;
  }

  function describe(m) {
    return m.item === null || m.item === undefined ? "Cross alone" : `Take ${NAMES[m.item]} across`;
  }

  function key(state) {
    return state.right.map((v) => (v ? "1" : "0")).join("") + state.boat;
  }

  /** Shortest safe route from this position to a win, as a list of moves. */
  function hint(state) {
    const startKey = key(state);
    const seen = new Map([[startKey, null]]);
    const queue = [state];
    while (queue.length) {
      const here = queue.shift();
      for (const m of legalMoves(here)) {
        const next = move(here, m);
        if (!next || next.outcome === "lose") continue;
        const k = key(next);
        if (seen.has(k)) continue;
        seen.set(k, { from: key(here), move: m });
        if (next.outcome === "win") {
          const path = [];
          let cursor = k;
          while (cursor !== startKey) {
            const step = seen.get(cursor);
            path.unshift(step.move);
            cursor = step.from;
          }
          return path;
        }
        queue.push(next);
      }
    }
    return null;
  }

  /** The applet's CheckFinished flags, transcribed from the bytecode. */
  function appletFlags(state) {
    const boatRight = state.boat === "right";
    const g = state.right[GOAT];
    const c = state.right[CABBAGE];
    const w = state.right[WOLF];
    const all = state.right.every(Boolean);
    const goatCabbage = (!boatRight && g && !c) || (boatRight && !g && !c);
    const wolfGoat = (!boatRight && g && !w) || (boatRight && !g && !w);
    return { finished: all || goatCabbage || wolfGoat, goatCabbage, wolfGoat, all };
  }

  return {
    GOAT, CABBAGE, WOLF, NAMES, LOSS, start, sideOf, farSide, onFar, danger,
    legalMoves, move, result, describe, hint, appletFlags,
  };
})();
