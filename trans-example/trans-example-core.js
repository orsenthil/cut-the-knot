"use strict";

/*
 * Trans Example, from Alexander Bogomolny's applet TransExample: Martin
 * Gardner's shuttle puzzle (Scientific American, Dec 1959). Vertical lines
 * are joined by horizontal shuttles; a walk that starts at the top of a line
 * goes down, crosses every shuttle it meets, and ends at some bottom.
 *
 * The idea the code relies on: each shuttle, read top to bottom, swaps the
 * two labels travelling down its lines, so the top-to-bottom map is a
 * product of transpositions — always a permutation. Different tops always
 * reach different bottoms, and every shuttle is crossed by exactly two
 * walks, once in each direction.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, TransExampleCore. The position is plain
 * data; functions take a position and return a new one.
 *
 * Heights are numbers in (0, 1): 0 is the top of the lines, 1 the bottom.
 * Poles are indexed 0..n-1 but labelled 1..n, as in the applet (Pole.Num =
 * id + 1). A pole may not hold two shuttles at the same height (the applet
 * keys its Bars hashtable by height).
 */
const TransExampleCore = (() => {
  const MIN_POLES = 2;
  const MAX_POLES = 20;
  const DEFAULT_POLES = 5;

  function clampPoles(n) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n)) n = DEFAULT_POLES;
    return Math.min(MAX_POLES, Math.max(MIN_POLES, n));
  }

  /** The position a new game starts from: n bare lines, in Draw mode. */
  function start(options) {
    const n = clampPoles(options && options.n !== undefined ? options.n : DEFAULT_POLES);
    return {
      n,
      mode: "draw",
      bars: [],
      labels: new Array(n).fill(0),
      itinerary: null
    };
  }

  /** Changing the number of lines clears the board (the applet's reset()). */
  function setPoles(state, n) {
    const fresh = start({ n });
    fresh.mode = state.mode;
    return fresh;
  }

  /** The Reset button: back to Draw with no shuttles and no labels. */
  function reset(state) {
    return start({ n: state.n });
  }

  /**
   * Draw mode hides the numbers and clears every bottom label and the
   * itinerary (SetDrawingMode); Verify mode shows the top numbers.
   */
  function setMode(state, mode) {
    if (mode !== "draw" && mode !== "verify") return null;
    if (mode === state.mode) return state;
    const next = Object.assign({}, state, { mode });
    if (mode === "draw") {
      next.labels = new Array(state.n).fill(0);
      next.itinerary = null;
    }
    return next;
  }

  /** Does this pole already hold a shuttle at exactly this height? */
  function occupied(state, pole, h) {
    return state.bars.some(b => (b.a === pole || b.b === pole) && b.h === h);
  }

  function poleOk(state, pole) {
    return Number.isInteger(pole) && pole >= 0 && pole < state.n;
  }

  /**
   * Add a shuttle between two poles at height h, as a finished drag does.
   * Returns the new position, or null when the applet would refuse it:
   * same pole, off the lines, or a height already taken on either pole.
   */
  function addBar(state, a, b, h) {
    if (!poleOk(state, a) || !poleOk(state, b) || a === b) return null;
    if (!(h > 0 && h < 1)) return null;
    if (occupied(state, a, h) || occupied(state, b, h)) return null;
    return Object.assign({}, state, {
      bars: state.bars.concat([{ a, b, h }])
    });
  }

  /** Remove last: drop the newest shuttle. Null when there is none. */
  function removeLast(state) {
    if (state.bars.length === 0) return null;
    return Object.assign({}, state, { bars: state.bars.slice(0, -1) });
  }

  /**
   * The next shuttle below height h on this pole: the applet's GetNext,
   * which scans bars ordered by height and takes the first with H > h.
   */
  function nextBar(state, pole, h) {
    let best = null;
    for (const b of state.bars) {
      if ((b.a === pole || b.b === pole) && b.h > h && (best === null || b.h < best.h)) {
        best = b;
      }
    }
    return best;
  }

  /**
   * CollectItinerary: walk down from the top of a pole, crossing each
   * shuttle to its other pole, until no shuttle is left below. Points are
   * {pole, h}; the walk starts at h = 0 and ends at h = 1.
   */
  function itineraryOf(state, pole) {
    if (!poleOk(state, pole)) return null;
    const points = [{ pole, h: 0 }];
    let p = pole;
    let h = 0;
    for (;;) {
      const bar = nextBar(state, p, h);
      if (bar === null) break;
      points.push({ pole: p, h: bar.h });
      const other = bar.a === p ? bar.b : bar.a;
      points.push({ pole: other, h: bar.h });
      p = other;
      h = bar.h;
    }
    points.push({ pole: p, h: 1 });
    return { from: pole, to: p, points };
  }

  /**
   * Verify a pole: trace it and write the starting number at the bottom
   * reached (Pole.SetBottom). Earlier labels stay, as in the applet.
   */
  function trace(state, pole) {
    const walk = itineraryOf(state, pole);
    if (walk === null) return null;
    const labels = state.labels.slice();
    labels[walk.to] = pole + 1;
    return Object.assign({}, state, { labels, itinerary: walk });
  }

  /** Where every top ends up: the permutation the shuttles define. */
  function permutation(state) {
    const out = [];
    for (let p = 0; p < state.n; p++) out.push(itineraryOf(state, p).to);
    return out;
  }

  /**
   * The play ends, with nobody winning or losing, once every bottom carries
   * a number — every line has been verified.
   */
  function result(state) {
    if (state.labels.length > 0 && state.labels.every(l => l > 0)) return "done";
    return null;
  }

  return {
    MIN_POLES, MAX_POLES, DEFAULT_POLES,
    start, setPoles, reset, setMode,
    occupied, addBar, removeLast,
    itineraryOf, trace, permutation, result
  };
})();