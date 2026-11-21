"use strict";

/*
 * Fair Division: Method of Lone Divider, from Bogomolny's applet LoneDivider.
 *
 * One player divides the goods into n pieces. Each of the other n-1 players
 * marks the pieces they would accept. Any piece nobody marks goes to the
 * divider; the rest are matched to the choosers who accept them. A perfect
 * matching gives every chooser an acceptable piece, and the divider keeps the
 * leftovers. If no matching exists, the method needs a partial division.
 *
 * The key idea is that the divider values every piece equally, so giving them
 * the unclaimed pieces is fair to them. The logic test checks the matching on
 * many preference tables and confirms that every assigned piece is acceptable
 * and that no chooser receives two pieces.
 *
 * No document, no window, no storage: one global, LoneDividerCore. The position
 * is plain data, so it can be saved and handed to the tutor.
 */
const LoneDividerCore = (() => {
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 6;

  const clamp = (v, lo, hi, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
  };

  function start(options) {
    const opts = options || {};
    const n = clamp(opts.n === undefined ? 4 : opts.n, MIN_PLAYERS, MAX_PLAYERS, 4);
    // Each chooser accepts a spread of pieces, so a solution usually exists.
    const table = Array.from({ length: n - 1 }, (_, i) =>
      Array.from({ length: n }, (_, j) => j === (i % n) || j === ((i + 1) % n)));
    return { n, table, divider: 0 };
  }

  function toggle(state, chooser, piece) {
    if (chooser < 0 || chooser >= state.table.length || piece < 0 || piece >= state.n) return state;
    const table = state.table.map((row) => row.slice());
    table[chooser][piece] = !table[chooser][piece];
    return { ...state, table };
  }

  /** Maximum bipartite matching by augmenting paths. */
  function match(table) {
    const choosers = table.length;
    const pieces = table[0].length;
    const owner = Array(pieces).fill(-1);
    function augment(c, seen) {
      for (let p = 0; p < pieces; p++) {
        if (!table[c][p] || seen.has(p)) continue;
        seen.add(p);
        if (owner[p] < 0 || augment(owner[p], seen)) {
          owner[p] = c;
          return true;
        }
      }
      return false;
    }
    let matched = 0;
    for (let c = 0; c < choosers; c++) if (augment(c, new Set())) matched++;
    const assignment = {};
    owner.forEach((c, p) => { if (c >= 0) assignment[c] = p; });
    return { matched, owner, assignment, complete: matched === choosers };
  }

  function solve(state) {
    const m = match(state.table);
    const assignedToChoosers = new Set(Object.values(m.assignment));
    const dividerPieces = [];
    for (let p = 0; p < state.n; p++) if (!assignedToChoosers.has(p)) dividerPieces.push(p);
    return {
      n: state.n,
      assignments: m.assignment,
      dividerPieces,
      solved: m.complete,
      matched: m.matched,
      choosers: state.table.length,
      note: m.complete
        ? "Every chooser receives an acceptable piece; the divider takes the rest."
        : "No complete matching exists — a partial division is needed.",
    };
  }

  function setN(state, value) {
    const n = clamp(value, MIN_PLAYERS, MAX_PLAYERS, state.n);
    return start({ n });
  }

  function randomize(state, random) {
    const rnd = random || Math.random;
    const table = state.table.map(() => Array.from({ length: state.n }, () => rnd() < 0.5));
    // Give every chooser at least one acceptable piece.
    table.forEach((row) => {
      if (!row.some(Boolean)) row[Math.floor(rnd() * state.n)] = true;
    });
    return { ...state, table };
  }

  function analyze(state) {
    const result = solve(state);
    return {
      n: state.n, table: state.table.map((r) => r.slice()),
      ...result,
    };
  }

  return { MIN_PLAYERS, MAX_PLAYERS, clamp, start, toggle, match, solve, setN, randomize, analyze };
})();
