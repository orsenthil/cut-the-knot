"use strict";

/*
 * Counting — the logic behind Alexander Bogomolny's applet "Counting"
 * (its own Name string: "Dot patterns & modular arithmetic"). The manifest's
 * page, cut-the-knot.org/arithmetic/counting.shtml, is only a reader's letter
 * about counting and does not embed the applet, so the rules here come from the
 * applet's bytecode alone.
 *
 * A scatter of N dots lies on a board, one dot in each cell of a grid. You count
 * them by pressing each in turn: the k-th dot pressed is given the number k
 * (pressing a numbered dot does nothing). A tally under the board draws one
 * stroke for each dot counted so far, in groups of g, with a wider gap after
 * every full group. When all N dots are counted the tally becomes an equation:
 * with q = floor(N / g) full groups and r = N mod g left over,
 *     g + g + ... + g + r = N   or   q * g + r = N.
 * The idea is division with remainder: N = q g + r with 0 <= r < g, the
 * residue of N modulo g.
 *
 * Applet facts kept: the number of dots is drawn at random as
 * max/2 + random*max/2 (so between max/2 and max); "Maximum" steps through
 * 5, 6, ..., 10, 20, 50, 100; "Group by" cannot go below 1 (2 once the maximum
 * is 20 or more); the dots are laid out in floor(sqrt N) rows of
 * floor(N / rows) + 1 columns, each dot at a random spot in its cell; the
 * equation's additive form is left out when there is at most one full group, and
 * also for groups of 1 when N is 20 or more. The opening group size is 5 and
 * the opening maximum is 10 (the values in the applet's text boxes).
 *
 * No document, no window, no storage. The position is plain data; random
 * choices are made once, when the dots are laid out, and kept in the position.
 */
const CountingCore = (() => {
  const MAX_STEPS = [5, 6, 7, 8, 9, 10, 20, 50, 100];
  const START_MAX = 10;
  const START_GROUP = 5;
  const COUNT_LIMIT = 500; // this port's cap on a typed count (the applet had none)

  const lowGroup = (max) => (max >= 20 ? 2 : 1);

  /** The applet's layout: floor(sqrt N) rows, floor(N / rows) + 1 columns. */
  function layout(n) {
    const rows = Math.floor(Math.sqrt(n));
    return { rows, cols: Math.floor(n / rows + 0.5 + 0.5) }; // Math.round(n / rows + 0.5)
  }

  /** Lay out n dots with a random spot in each cell (rand() gives numbers in [0, 1)). */
  function makeDots(n, rand) {
    const { rows, cols } = layout(n);
    const dots = [];
    for (let r = 0; r < rows && dots.length < n; r++) {
      for (let c = 0; c < cols && dots.length < n; c++) {
        dots.push({ row: r, col: c, jx: rand(), jy: rand(), num: 0 });
      }
    }
    return dots;
  }

  /** The applet's Reset(): a random count between max/2 and max. */
  function randomCount(max, rand) {
    return Math.floor(max / 2 + (max * rand()) / 2);
  }

  /** A new position. options: max, group, count, numbers (show the numbers), rand. */
  function start(options) {
    const o = options || {};
    const rand = typeof o.rand === "function" ? o.rand : Math.random;
    const max = MAX_STEPS.includes(o.max) ? o.max : START_MAX;
    const count = Number.isInteger(o.count) && o.count > 0 ? Math.min(o.count, COUNT_LIMIT) : Math.max(1, randomCount(max, rand));
    const group = Number.isInteger(o.group) && o.group >= lowGroup(max) ? o.group : Math.max(START_GROUP, lowGroup(max));
    return {
      max, group, count, numbers: o.numbers === true,
      dots: makeDots(count, rand), counted: 0,
      moves: 0, finished: false,
    };
  }

  /** The max steps: the applet's IncreaseMaxNum / DecreaseMaxNum. */
  function nextMax(max, dir) {
    const i = MAX_STEPS.indexOf(max);
    if (i < 0) return START_MAX;
    return MAX_STEPS[Math.max(0, Math.min(MAX_STEPS.length - 1, i + dir))];
  }

  /** The moves: count a dot, start counting again, new dots, and the options. */
  function legalMoves(state) {
    const moves = [];
    state.dots.forEach((d, i) => { if (d.num === 0) moves.push({ type: "count", index: i }); });
    moves.push({ type: "again" }, { type: "new" });
    if (state.group > lowGroup(state.max)) moves.push({ type: "group", value: state.group - 1 });
    moves.push({ type: "group", value: state.group + 1 });
    return moves;
  }

  /** The position after a move, or null if it is not allowed. rand is only used by "new". */
  function move(state, m, rand) {
    if (!m) return null;
    const r = typeof rand === "function" ? rand : Math.random;
    let next = null;
    if (m.type === "count") {
      const d = state.dots[m.index];
      if (!d || d.num !== 0) return null;
      const counted = state.counted + 1;
      next = { ...state, counted, dots: state.dots.map((x, i) => (i === m.index ? { ...x, num: counted } : x)) };
    } else if (m.type === "again") {
      // Undo: the same dots, counted from the start.
      next = { ...state, counted: 0, dots: state.dots.map((x) => ({ ...x, num: 0 })) };
    } else if (m.type === "new") {
      next = { ...start({ max: state.max, group: state.group, numbers: state.numbers, rand: r }) };
    } else if (m.type === "count-to") {
      // The "Count" box: a fresh scatter of exactly this many dots.
      if (!Number.isInteger(m.value) || m.value <= 0) return null;
      next = { ...start({ max: state.max, group: state.group, numbers: state.numbers, count: m.value, rand: r }) };
    } else if (m.type === "group") {
      if (!Number.isInteger(m.value) || m.value < lowGroup(state.max)) return null;
      next = { ...state, group: m.value };
    } else if (m.type === "max") {
      // Stepping the maximum: +1 or -1 along 5..10, 20, 50, 100; typing 5..100 is allowed too.
      let max = state.max;
      if (m.dir === 1 || m.dir === -1) max = nextMax(state.max, m.dir);
      else if (Number.isInteger(m.value) && m.value >= 5 && m.value <= 100) max = m.value;
      else return null;
      // CheckGroupSize: the smallest group follows the maximum.
      const group = Math.max(state.group, lowGroup(max));
      next = { ...state, max, group };
    } else if (m.type === "numbers") {
      if (typeof m.value !== "boolean") return null;
      next = { ...state, numbers: m.value };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, finished: next.counted === next.dots.length };
  }

  /** The group boundaries of the tally for n strokes of size g: the applet's ShowNumber loop. */
  function tally(n, g) {
    const groups = [];
    for (let i = 0; i < n; i++) {
      if (i % g === 0) groups.push(0);
      groups[groups.length - 1]++;
    }
    return groups; // e.g. [5, 5, 2]
  }

  /** The equation shown once everything is counted: the applet's DrawEquation. */
  function equation(n, g) {
    const q = Math.floor(n / g);
    const r = n % g;
    let s = "";
    if (q > 1 && !(n >= 20 && g === 1)) {
      for (let k = 0; k < q; k++) s += k === q - 1 ? g : g + " + ";
      if (r > 0) s += " + " + r;
      s += " = " + n + "  or  ";
    }
    if (q > 1) s += q + " × ";
    if (q > 0) s += g;
    if (r > 0) {
      if (q > 0) s += " + ";
      s += r;
    }
    s += " = " + n;
    return s;
  }

  /** A demo: nothing to win; "done" when every dot has been counted. */
  function result(state) {
    return state.finished ? "done" : null;
  }

  return { MAX_STEPS, START_MAX, START_GROUP, COUNT_LIMIT, start, legalMoves, move, result, layout, makeDots, randomCount, nextMax, tally, equation, lowGroup };
})();
