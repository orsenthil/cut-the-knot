"use strict";

/*
 * Very Tiles — Alexander Bogomolny's applet VeryTiles.
 *
 * Twelve sums have one number rubbed out. The answer tiles 1..12 sit in order
 * in the upper two rows; pick a tile and then its problem to place the answer,
 * or pick a problem and then a blank tile to take the answer back. The Pattern
 * button shows both rows as six-pointed stars: a number n is drawn in one of
 * three colours (from n mod 6) in one of four corners (from n). The top row
 * uses each tile's hidden number and the lower row uses the answer in each
 * problem, so they agree exactly when every match is right.
 *
 * The 21 permutations, the three problem forms, the two ordering-dependent
 * moves and the pattern encoding are transcribed from VeryTilesCanvas.class,
 * VeryTilesExpression.class and VeryTilesBox.class. This file is only the
 * logic: no document, no window, and one global, VeryTilesCore. A position is
 * plain data; every function takes a position and returns a new one.
 */
const VeryTilesCore = (() => {
  const NROWS = 2, NCOLS = 6, COUNT = NROWS * NCOLS, NPERMS = 21;

  // The applet's 21 fixed shuffles. perm[i] is the board cell that holds the
  // problem and answer numbered i + 1.
  const PERMS = [
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    [4, 5, 0, 1, 2, 3, 10, 11, 6, 7, 8, 9],
    [10, 11, 6, 7, 8, 9, 4, 5, 0, 1, 2, 3],
    [2, 0, 1, 4, 5, 3, 8, 6, 7, 10, 11, 9],
    [8, 6, 7, 10, 11, 9, 2, 0, 1, 4, 5, 3],
    [0, 1, 8, 9, 4, 5, 6, 7, 2, 3, 10, 11],
    [6, 7, 2, 3, 10, 11, 0, 1, 8, 9, 4, 5],
    [1, 0, 2, 3, 5, 4, 7, 6, 8, 9, 11, 10],
    [7, 6, 8, 9, 11, 10, 1, 0, 2, 3, 5, 4],
    [1, 6, 2, 3, 11, 4, 7, 0, 8, 9, 5, 10],
    [7, 0, 8, 9, 5, 10, 1, 6, 2, 3, 11, 4],
    [1, 0, 3, 2, 5, 4, 7, 6, 9, 8, 11, 10],
    [7, 6, 9, 8, 11, 10, 1, 0, 3, 2, 5, 4],
    [1, 0, 3, 2, 5, 4, 7, 6, 9, 8, 11, 10],
    [7, 6, 9, 8, 11, 10, 1, 0, 3, 2, 5, 4],
    [4, 5, 1, 0, 3, 2, 10, 11, 7, 6, 9, 8],
    [10, 11, 7, 6, 9, 8, 4, 5, 1, 0, 3, 2],
    [11, 4, 9, 8, 1, 6, 5, 10, 3, 2, 7, 0],
    [9, 4, 11, 6, 1, 8, 3, 10, 5, 0, 7, 2],
    [5, 4, 6, 7, 2, 3, 11, 10, 0, 1, 8, 9],
    [11, 10, 0, 1, 8, 9, 5, 4, 6, 7, 2, 3],
  ];

  /** The applet uses Math.random; a seeded generator lets a position be replayed. */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** FillBoxes picks a new shuffle, never the one it just used. */
  function randomPattern(previous) {
    let p;
    do { p = Math.floor(Math.random() * NPERMS); } while (p === previous);
    return p;
  }

  /*
   * VeryTilesExpression.SetId / MakeSum(0) / MakeDiff(flag). For answers 1-3
   * only a difference is made; larger answers are half sum, half difference.
   * Every form has answer exactly n. The order in which rand() is called
   * matters and follows the bytecode (choice first, then A or B).
   */
  function problemFor(answer, rand) {
    let op;
    if (answer <= 3) op = rand() < 0.5 ? 1 : 2;             // MakeDiff(flag)
    else if (rand() < 0.5) op = 0;                           // MakeSum(0)
    else op = rand() < 0.5 ? 1 : 2;                          // MakeDiff(flag)
    if (op === 0) {
      const a = Math.floor(rand() * answer), b = answer - a;
      return { answer, op, a, b, text: `${a} + ${b} = ?` };
    }
    const b = Math.floor(rand() * 8), a = answer + b;
    return {
      answer, op, a, b,
      text: op === 1 ? `${b} + ? = ${a}` : `? + ${b} = ${a}`,
    };
  }

  /** The position a new game starts from. Options: `pattern` (0..20), `seed`. */
  function start(options = {}) {
    const pattern = Number.isInteger(options.pattern) && options.pattern >= 0 && options.pattern < NPERMS
      ? options.pattern : 0;
    const seed = Number.isInteger(options.seed) && options.seed > 0 ? options.seed : 1;
    const rand = rng(seed), perm = PERMS[pattern];
    const problems = new Array(COUNT), keys = new Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      problems[perm[i]] = problemFor(i + 1, rand);
      keys[perm[i]] = i + 1;
    }
    return {
      pattern, seed,
      perm: perm.slice(), keys, problems,
      tiles: Array.from({ length: COUNT }, (_, p) => ({ value: p + 1, show: true })),
      answers: new Array(COUNT).fill(null),
      selected: null,
      mode: "tiles",
    };
  }

  const valid = (kind, pos) =>
    (kind === "tile" || kind === "problem") && Number.isInteger(pos) && pos >= 0 && pos < COUNT;

  function allAnswered(s) { return s.answers.every((v) => v !== null); }

  /**
   * One click. A selected tile followed by a problem places that tile's
   * number; a selected problem followed by a blank tile takes the answer back
   * and renumbers the tile to it, as ReturnTile does in the applet. Clicking
   * the selected thing again unselects it. An answered problem is never
   * overwritten, and a visible (unused) tile cannot take an answer back.
   */
  function activate(s, kind, pos) {
    if (!valid(kind, pos)) return s;
    const sel = s.selected;
    if (sel && sel.kind === kind && sel.pos === pos) return { ...s, selected: null };

    if (sel && sel.kind === "tile" && kind === "problem") {       // PassAnswerToBox
      if (s.answers[pos] !== null) return { ...s, selected: null };
      const answers = s.answers.slice();
      answers[pos] = s.tiles[sel.pos].value;
      const tiles = s.tiles.slice();
      tiles[sel.pos] = { ...tiles[sel.pos], show: false };
      return { ...s, answers, tiles, selected: null };
    }

    if (sel && sel.kind === "problem" && kind === "tile") {       // ReturnTile
      const old = s.answers[sel.pos];
      if (old === null || s.tiles[pos].show) return { ...s, selected: null };
      const answers = s.answers.slice();
      answers[sel.pos] = null;
      const tiles = s.tiles.slice();
      tiles[pos] = { value: old, show: true };
      return { ...s, answers, tiles, selected: null };
    }

    return { ...s, selected: { kind, pos } };
  }

  /** Pattern is disabled until all twelve problems have an answer. */
  function setMode(s, mode) {
    if (mode !== "tiles" && mode !== "pattern") return s;
    if (mode === "pattern" && !allAnswered(s)) return s;
    return { ...s, mode };
  }

  /** The Reset button picks a new shuffle, different from the last one. */
  function restart(s) {
    return start({ pattern: randomPattern(s.pattern), seed: (s.seed + 1) >>> 0 });
  }

  /** "done" once every gap is filled; a demo has no win or loss. */
  function result(s) { return allAnswered(s) ? "done" : null; }

  const upperKey = (s, pos) => (s.answers[pos] === null ? s.problems[pos].answer : s.answers[pos]);
  const lowerKey = (s, pos) => s.keys[pos];

  /** VeryTilesBox.DrawBack: colour from key mod 6, star corner from key. */
  function shape(key) {
    const v = key % 6;
    const color = v === 1 || v === 2 ? "blue" : (v === 3 || v === 4 ? "green" : "red");
    const n = ((key - 1) % 12 + 12) % 12 + 1;
    let corner;
    if (n <= 6) corner = n % 2 ? "tr" : "tl";
    else corner = n % 2 ? "br" : "bl";
    return { color, corner };
  }

  /** Both twelve-star rows, as plain data for the page to draw. */
  function pattern(s, side) {
    return Array.from({ length: COUNT }, (_, pos) => {
      const key = side === "tiles" ? lowerKey(s, pos) : upperKey(s, pos);
      return { key, ...shape(key) };
    });
  }

  function patternsAgree(s) {
    for (let pos = 0; pos < COUNT; pos++) if (upperKey(s, pos) !== lowerKey(s, pos)) return false;
    return true;
  }

  /** The equation as shown: `?` when empty, the placed number when filled. */
  function equation(s, pos) {
    const p = s.problems[pos], a = s.answers[pos];
    if (a === null) return p.text;
    if (p.op === 0) return `${p.a} + ${p.b} = ${a}`;
    if (p.op === 1) return `${p.b} + ${a} = ${p.a}`;
    return `${a} + ${p.b} = ${p.a}`;
  }

  /** Every problem number and every shape key, for the record and the tutor. */
  function snapshot(s) {
    return {
      pattern: s.pattern, seed: s.seed, mode: s.mode, selected: s.selected,
      answers: s.answers.slice(),
      intended: s.problems.map((p) => p.answer),
      keys: s.keys.slice(),
      tiles: s.tiles.map((t) => ({ ...t })),
    };
  }

  return {
    NROWS, NCOLS, COUNT, NPERMS, PERMS,
    rng, randomPattern, problemFor, start, allAnswered, activate, setMode,
    restart, result, upperKey, lowerKey, shape, pattern, patternsAgree,
    equation, snapshot,
  };
})();
