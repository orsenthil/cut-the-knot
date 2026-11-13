"use strict";

/*
 * Mastermind (Bogomolny's MastermindGame applet) - the scoring rule and game.
 *
 * The codemaker picks a secret code of P pegs from C colours (repeats allowed
 * by default). The codebreaker guesses; each guess scores two numbers, from
 * MMCode.ExactMatches / ColorMatches in the bytecode:
 *
 *   exact  = how many pegs are the right colour in the right place
 *   total  = sum over colours i of min(count_in_code(i), count_in_guess(i))
 *   near   = total - exact   (right colour, wrong place)
 *
 * That is Knuth's formulation on the cut-the-knot page: exact matches are
 * counted first, and each peg of the code/guess is used at most once.
 *
 * Defaults are the classic game the article discusses (P=4, C=6). The applet
 * allows 1..10 for each; the number of guess rows is P+C-1, as in
 * MastermindGameCanvas.Reset. Optional "no repeats" matches UseRepetitions=false.
 *
 * porting/check-mastermind.mjs checks the scoring against a second
 * transcription, the page's 1123/0145 example, and that 3 exact + 1 near is
 * impossible.
 */

var MastermindCore = (function () {
  const MIN = 1;
  const MAX = 10;
  const DEFAULT_PEGS = 4;
  const DEFAULT_COLORS = 6;

  function clamp(n) {
    n = n | 0;
    if (n < MIN) return MIN;
    if (n > MAX) return MAX;
    return n;
  }

  function colorCounts(code, colors) {
    const counts = Array(colors).fill(0);
    for (const c of code) counts[c]++;
    return counts;
  }

  /** ExactMatches(code, guess): positions where both agree. */
  function exactMatches(code, guess) {
    let n = 0;
    for (let i = 0; i < code.length; i++) if (code[i] === guess[i]) n++;
    return n;
  }

  /** ColorMatches: sum_i min(n_i, m_i). Includes the exact matches. */
  function colorMatches(code, guess, colors) {
    const a = colorCounts(code, colors);
    const b = colorCounts(guess, colors);
    let n = 0;
    for (let i = 0; i < colors; i++) n += Math.min(a[i], b[i]);
    return n;
  }

  /** The (exact, near) pair shown as red and pink dots in the applet. */
  function score(code, guess, colors) {
    const exact = exactMatches(code, guess);
    const near = colorMatches(code, guess, colors) - exact;
    return { exact, near };
  }

  function hasDuplicates(code) {
    for (let i = 0; i < code.length; i++) {
      for (let j = 0; j < i; j++) if (code[i] === code[j]) return true;
    }
    return false;
  }

  function randomCode(pegs, colors, allowRepeats, rng) {
    const rand = rng || Math.random;
    if (!allowRepeats && pegs > colors) return null;
    const code = [];
    if (allowRepeats) {
      for (let i = 0; i < pegs; i++) code.push(Math.floor(rand() * colors));
      return code;
    }
    const pool = Array.from({ length: colors }, (_, i) => i);
    for (let i = 0; i < pegs; i++) {
      const j = i + Math.floor(rand() * (pool.length - i));
      const t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
      code.push(pool[i]);
    }
    return code;
  }

  function maxRows(pegs, colors) {
    return pegs + colors - 1;
  }

  function start(pegs, colors, allowRepeats, rng) {
    const P = clamp(pegs == null ? DEFAULT_PEGS : pegs);
    const C = clamp(colors == null ? DEFAULT_COLORS : colors);
    const reps = allowRepeats !== false;
    const code = randomCode(P, C, reps, rng);
    return {
      pegs: P,
      colors: C,
      allowRepeats: reps,
      code,
      guesses: [], // { guess, exact, near }
      rows: maxRows(P, C),
      won: false,
      lost: false,
    };
  }

  /**
   * Submit a guess. Returns null if incomplete / illegal under no-repeats;
   * otherwise the new state fields for this guess (and won/lost flags).
   */
  function guess(state, pegs) {
    if (state.won || state.lost) return null;
    if (!pegs || pegs.length !== state.pegs) return null;
    if (pegs.some((c) => c < 0 || c >= state.colors || c !== (c | 0))) return null;
    if (!state.allowRepeats && hasDuplicates(pegs)) return { error: "No repetitions, please." };
    if (state.guesses.length >= state.rows) return null;

    const s = score(state.code, pegs, state.colors);
    state.guesses.push({ guess: pegs.slice(), exact: s.exact, near: s.near });
    if (s.exact === state.pegs) state.won = true;
    else if (state.guesses.length >= state.rows) state.lost = true;
    return s;
  }

  return {
    MIN, MAX, DEFAULT_PEGS, DEFAULT_COLORS,
    exactMatches, colorMatches, score, hasDuplicates,
    randomCode, maxRows, start, guess, colorCounts,
  };
})();
