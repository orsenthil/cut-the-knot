"use strict";

/*
 * Squares, Circles, and Triangles, from Alexander Bogomolny's applet sct.
 *
 * A row of shapes (1 square, 2 circle, 3 triangle). Pick two different kinds:
 * with elimination they become one of the third kind; without, both become the
 * third kind. Invariants: differences of counts mod 2 (elimination) or mod 3
 * (no elimination). Solo puzzle — finish when one shape remains (eliminate)
 * or every live shape matches (no eliminate).
 */
const SctCore = (() => {
  const SQUARE = 1, CIRCLE = 2, TRIANGLE = 3, EMPTY = 0;
  const MIN_N = 3, MAX_N = 20, DEFAULT_N = 5;
  const NAMES = { 1: "square", 2: "circle", 3: "triangle" };

  function clampN(n) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = DEFAULT_N;
    return Math.max(MIN_N, Math.min(MAX_N, n));
  }

  function third(a, b) {
    return 6 - a - b;
  }

  function counts(shapes) {
    let s = 0, c = 0, t = 0;
    for (const v of shapes) {
      if (v === SQUARE) s++;
      else if (v === CIRCLE) c++;
      else if (v === TRIANGLE) t++;
    }
    return { s, c, t };
  }

  function deal(n, rnd) {
    const shapes = [];
    for (let i = 0; i < n; i++) shapes.push(1 + Math.floor(rnd() * 3));
    return shapes;
  }

  function start(options = {}) {
    const n = clampN(options.n ?? DEFAULT_N);
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    const eliminate = options.eliminate !== undefined ? !!options.eliminate : false;
    const shapes = options.shapes ? options.shapes.slice() : deal(n, rnd);
    return {
      n: shapes.length,
      shapes,
      spare: shapes.slice(),
      eliminate,
      selected: [],
      history: [],
      over: false,
      remaining: null,
    };
  }

  function liveIndices(state) {
    const out = [];
    for (let i = 0; i < state.shapes.length; i++) {
      if (state.shapes[i] !== EMPTY) out.push(i);
    }
    return out;
  }

  function allSame(state) {
    let first = 0;
    for (const v of state.shapes) {
      if (v === EMPTY) continue;
      if (!first) first = v;
      else if (v !== first) return false;
    }
    return first !== 0;
  }

  function isFinished(state) {
    if (state.eliminate) {
      const live = liveIndices(state);
      if (live.length <= 1) return true;
      return allSame(state);
    }
    return allSame(state);
  }

  function whatRemains(state) {
    for (const v of state.shapes) if (v !== EMPTY) return v;
    return EMPTY;
  }

  function select(state, index) {
    if (state.over) return state;
    if (index < 0 || index >= state.shapes.length) return state;
    if (state.shapes[index] === EMPTY) return { ...state, note: "gone" };
    const selected = state.selected.slice();
    const at = selected.indexOf(index);
    if (at >= 0) {
      selected.splice(at, 1);
      return { ...state, selected, note: null };
    }
    if (selected.length === 0) {
      return { ...state, selected: [index], note: null };
    }
    if (selected.length === 1) {
      if (state.shapes[selected[0]] === state.shapes[index]) {
        return { ...state, note: "different" };
      }
      return play(Object.assign({}, state, { selected: [selected[0], index] }));
    }
    return state;
  }

  function play(state) {
    const [i1, i2] = state.selected;
    const a = state.shapes[i1];
    const b = state.shapes[i2];
    const t = third(a, b);
    const shapes = state.shapes.slice();
    shapes[i1] = t;
    if (state.eliminate) shapes[i2] = EMPTY;
    else shapes[i2] = t;
    const next = {
      ...state,
      shapes,
      selected: [],
      note: null,
      history: state.history.concat([state.shapes.slice()]),
    };
    if (isFinished(next)) {
      next.over = true;
      next.remaining = whatRemains(next);
    }
    return next;
  }

  /**
   * Singleton of `target` under elimination after n−1 moves: each count flips
   * parity every move, so start_x + (n−1) ≡ end_x (mod 2). The page’s “s≡c
   * (mod 2)” for a lone triangle is necessary but not always sufficient —
   * this checks the full parity condition.
   */
  function canReachEliminate(shapes, target) {
    const n = shapes.length;
    const { s, c, t } = counts(shapes);
    const cnt = { 1: s, 2: c, 3: t };
    // Any finished all-target board has k≥1 live targets; each move flips every count.
    for (let k = 1; k <= n; k++) {
      const moves = n - k;
      let ok = true;
      for (const type of [1, 2, 3]) {
        const end = type === target ? k : 0;
        if ((cnt[type] + moves) % 2 !== end % 2) ok = false;
      }
      if (ok) return true;
    }
    return false;
  }

  /**
   * All-`target` under no-elimination: differences mod 3 are invariant.
   * Ending (N,0,0) for squares needs the other two counts ≡ 0 (mod 3) and
   * matching the start’s pairwise residues — equivalent to the two non-target
   * counts being congruent mod 3 (the page’s necessary condition for
   * triangles), plus the total length fitting. For a full row of one shape,
   * non-targets must be 0 mod 3 at the end, hence start non-targets ≡ 0 mod 3
   * after accounting for +2/−1 moves… pairwise diffs: start s−c ≡ end s−c.
   */
  function canReachNoEliminate(shapes, target) {
    const { s, c, t } = counts(shapes);
    const cnt = { 1: s, 2: c, 3: t };
    const n = shapes.length;
    // End: target=n, others=0. Diffs: target−other ≡ n (mod 3), other−other ≡ 0.
    for (const type of [1, 2, 3]) {
      if (type === target) continue;
      if ((cnt[target] - cnt[type] - n) % 3 !== 0) return false;
    }
    const others = [1, 2, 3].filter((x) => x !== target);
    if ((cnt[others[0]] - cnt[others[1]]) % 3 !== 0) return false;
    return true;
  }

  function undo(state) {
    if (!state.history.length) return state;
    const history = state.history.slice();
    const shapes = history.pop();
    return {
      ...state,
      shapes,
      history,
      selected: [],
      over: false,
      remaining: null,
      note: null,
    };
  }

  function repeat(state) {
    return {
      ...state,
      shapes: state.spare.slice(),
      selected: [],
      history: [],
      over: false,
      remaining: null,
      note: null,
    };
  }

  function result(state) {
    return state.over ? "done" : null;
  }

  function snapshot(state) {
    return {
      n: state.n,
      shapes: state.shapes.slice(),
      eliminate: state.eliminate,
      over: state.over,
      remaining: state.remaining,
      historyLength: state.history.length,
    };
  }

  function restore(snap) {
    const shapes = snap.shapes ? snap.shapes.slice() : deal(DEFAULT_N, Math.random);
    return {
      n: shapes.length,
      shapes,
      spare: shapes.slice(),
      eliminate: !!snap.eliminate,
      selected: [],
      history: [],
      over: !!snap.over,
      remaining: snap.remaining || null,
      note: null,
    };
  }

  return {
    SQUARE, CIRCLE, TRIANGLE, EMPTY, MIN_N, MAX_N, DEFAULT_N, NAMES,
    third, counts, deal, start, liveIndices, allSame, isFinished, whatRemains,
    select, play, canReachEliminate, canReachNoEliminate, undo, repeat,
    result, snapshot, restore,
  };
})();
