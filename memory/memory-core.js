"use strict";

/*
 * Memory, from Alexander Bogomolny's applet Memory.
 *
 * Twenty cards (5 columns by 4 rows) lie face down. You turn two at a time; a
 * pair that matches stays face up, one that does not turns back. Ten pairs are
 * dealt, each pair two cards with the same hidden number Id (0 to 29, dealt
 * with replacement, so two pairs may share an Id). What "match" means depends on
 * the mode, the applet's "which":
 *
 *   0 Count 1    the same number of shapes, Id % 5 + 1 (1 to 5)
 *   1 Count 2    the same count and the same colour, Id div 12
 *   2 Shape      the same Id: the same shape (Id % 12) and colour (Id div 12)
 *   3 Number     the same Id, shown as a number
 *   4 Count 3    the same Id, shown as a count of shapes: shape, colour and count
 *   5 Addition   the same sum: Id + 3 as a sum of two numbers
 *   6 Add/Sub    the same result Id, as a sum or a difference
 *   7 All Ops    the same result Id, as a sum, difference, product or quotient
 *
 * The position is plain data:
 *   { which, cols, rows, ids, texts, matched, showing, turns }
 *   ids[i] the card's Id, texts[i] its expression (modes 5 to 7, else null),
 *   matched[i] true once found, showing the (at most two) cards turned up now.
 */
const MemoryCore = (() => {
  const COLS = 5, ROWS = 4, MAX_NUMBER = 30;
  const NSHAPES = 12, NCOLOURS = 6, ABS_MAX = NSHAPES * NCOLOURS;
  const MODES = [
    { which: 0, id: "count1", button: "Count 1", caption: "Match Count" },
    { which: 1, id: "count2", button: "Count 2", caption: "Match Count and Color" },
    { which: 2, id: "shape", button: "Shape", caption: "Match Shape and Color" },
    { which: 3, id: "number", button: "Number", caption: "Match Numbers" },
    { which: 4, id: "count3", button: "Count 3", caption: "Match Shape, Color and Count" },
    { which: 5, id: "addition", button: "Addition", caption: "Match Sums" },
    { which: 6, id: "addsub", button: "Add/Sub", caption: "Match Result of Operations" },
    { which: 7, id: "allops", button: "All Ops", caption: "Match Result of Operations" },
  ];
  const DEFAULT_WHICH = 2;

  const clampWhich = (w) => (Number.isInteger(w) && w >= 0 && w <= 7 ? w : DEFAULT_WHICH);

  /** Shape number, colour number and count of dots/shapes for an Id. */
  const shapeOf = (id) => id % NSHAPES;
  const colourOf = (id) => Math.floor(id / NSHAPES);
  const countOf = (id) => (id % 5) + 1;

  /** The applet's Equals: do two cards with these Ids match in this mode? */
  function equals(which, a, b) {
    if (which === 0) return countOf(a) === countOf(b);
    if (which === 1) return countOf(a) === countOf(b) && colourOf(a) === colourOf(b);
    return a === b;
  }

  /* ---- the expression cards: each is made from the Id, as the applet's MemoryExpression */

  /** The smallest divisor of id from 2 up to (not including) the integer square root, else 1. */
  function aFactor(id) {
    if (id === 0 || id === 1) return 1;
    const root = Math.floor(Math.sqrt(id));
    for (let d = 2; d < root; d++) if (id % d === 0) return d;
    return 1;
  }

  /** The card's expression for an Id in the given mode: { text, value, a, b, op }. */
  function expression(which, id, random) {
    const sum = (plus) => {
      const total = id + plus, a = Math.floor(random() * total), b = total - a;
      return { a, b, op: "+", value: total, text: `${a}+${b}` };
    };
    const diff = () => {
      const b = Math.floor((random() * id) / 2), a = id + b;
      return { a, b, op: "-", value: id, text: `${a}-${b}` };
    };
    const product = () => {
      let a = aFactor(id), b = Math.floor(id / a);
      if (random() < 0.5) [a, b] = [b, a];
      return { a, b, op: "*", value: id, text: `${a}*${b}` };
    };
    const quotient = () => {
      const b = Math.floor(random() * 10 + 1), a = id * b;
      return { a, b, op: "/", value: id, text: `${a}/${b}` };
    };
    if (which === 5) return sum(3);
    if (which === 6) return Math.floor(random() * 2) === 0 ? sum(0) : diff();
    const k = Math.floor(random() * 4);
    return [() => sum(0), diff, product, quotient][k]();
  }

  /** A fresh deal. options: { which, random }. */
  function start(options) {
    const o = options || {}, random = o.random || Math.random, which = clampWhich(o.which === undefined ? DEFAULT_WHICH : o.which);
    const n = COLS * ROWS, half = n / 2;
    // a random permutation of the 20 places (Fisher-Yates)
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const ids = Array(n).fill(0);
    for (let j = 0; j < half; j++) {
      const id = Math.floor(random() * MAX_NUMBER);
      ids[perm[j]] = id; ids[perm[half + j]] = id;
    }
    const texts = ids.map((id) => (which >= 5 ? expression(which, id, random).text : null));
    return { which, cols: COLS, rows: ROWS, ids, texts, matched: Array(n).fill(false), showing: [], turns: 0 };
  }

  /** A card's shown value for modes 5..7 (the number its expression comes to). */
  function valueOf(text) {
    const m = /^(\d+)([+\-*/])(\d+)$/.exec(text);
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[3]);
    return { "+": a + b, "-": a - b, "*": a * b, "/": a / b }[m[2]];
  }

  /**
   * Turn card i face up. Refused (null) when it is already up or matched, when
   * two cards are already up, or when there is no such card.
   */
  function flip(state, i) {
    if (!Number.isInteger(i) || i < 0 || i >= state.ids.length) return null;
    if (state.matched[i] || state.showing.includes(i) || state.showing.length >= 2) return null;
    return { ...state, showing: state.showing.concat([i]) };
  }

  /** Two cards are up and waiting to be judged. */
  const needsJudging = (state) => state.showing.length === 2;

  /** Judge the two cards that are up: a match stays, otherwise both turn back. One turn is counted. */
  function judge(state) {
    if (state.showing.length !== 2) return null;
    const [a, b] = state.showing;
    const ok = equals(state.which, state.ids[a], state.ids[b]);
    const matched = state.matched.slice();
    if (ok) { matched[a] = true; matched[b] = true; }
    return { ...state, matched, showing: [], turns: state.turns + 1 };
  }

  const finished = (state) => state.matched.every(Boolean);
  const result = (state) => (finished(state) ? "win" : null);

  return { COLS, ROWS, MAX_NUMBER, NSHAPES, NCOLOURS, ABS_MAX, MODES, DEFAULT_WHICH, clampWhich, shapeOf, colourOf, countOf, equals, aFactor, expression, start, valueOf, flip, needsJudging, judge, finished, result };
})();
