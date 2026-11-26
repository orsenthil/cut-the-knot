"use strict";

/*
 * Distance Between Strings, from Alexander Bogomolny's applet Strings.
 *
 * Two ways to measure how different two strings are:
 *   Hamming distance H(s, t): for strings of the same length, the number of
 *     places where they differ.
 *   Levenshtein (edit) distance L(s, t): the fewest insertions, deletions
 *     and replacements of single characters that turn s into t, found by
 *     filling a table: d(i, 0) = i, d(0, j) = j and
 *     d(i, j) = min(d(i-1, j) + 1, d(i, j-1) + 1, d(i-1, j-1) + r(s_i, t_j)),
 *     where r is 0 for equal characters and 1 otherwise.
 * Both are metrics; for equal lengths L <= H, and they can differ:
 * H("abc", "bca") = 3 but L("abc", "bca") = 2.
 *
 * Transcribed from StringsList: unless "Case sensitive" is ticked both
 * strings are lowered first (the report shows them as typed), and each "Do
 * it!" adds a line to the list. For strings of different lengths Hamming
 * reports "Strings are of different lengths!" and "Please use
 * Levenshtein's distance!" (the applet then goes on comparing and fails if
 * the second string is the shorter; here it stops after the messages).
 *
 * This file is the game's logic and nothing else. It defines one global,
 * StringDistanceCore. The position is plain data.
 */
const StringDistanceCore = (() => {
  const fold = (s, caseSensitive) => (caseSensitive ? s : s.toLowerCase());

  function hamming(s, t, caseSensitive = false) {
    if (s.length !== t.length) return null;
    const a = fold(s, caseSensitive), b = fold(t, caseSensitive);
    let h = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) h++;
    return h;
  }

  /** The whole table d, (n + 1) x (m + 1). */
  function table(s, t, caseSensitive = false) {
    const a = fold(s, caseSensitive), b = fold(t, caseSensitive), n = a.length, m = b.length;
    const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let j = 1; j <= m; j++) for (let i = 1; i <= n; i++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d;
  }

  const levenshtein = (s, t, caseSensitive = false) => { const d = table(s, t, caseSensitive); return d[s.length][t.length]; };

  /**
   * One optimal alignment read back from the table: steps [kind, from, to]
   * with kind "keep", "replace", "delete" or "insert", left to right.
   */
  function alignment(s, t, caseSensitive = false) {
    const d = table(s, t, caseSensitive), a = fold(s, caseSensitive), b = fold(t, caseSensitive);
    const out = [];
    let i = s.length, j = t.length;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
        out.push([a[i - 1] === b[j - 1] ? "keep" : "replace", s[i - 1], t[j - 1]]);
        i--; j--;
      } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { out.push(["delete", s[i - 1], ""]); i--; }
      else { out.push(["insert", "", t[j - 1]]); j--; }
    }
    return out.reverse();
  }

  /** The edits of that alignment, in words. */
  function edits(s, t, caseSensitive = false) {
    return alignment(s, t, caseSensitive).filter((x) => x[0] !== "keep").map(([k, f, to]) =>
      k === "replace" ? `replace "${f}" with "${to}"` : k === "delete" ? `delete "${f}"` : `insert "${to}"`);
  }

  /** The lines "Do it!" adds to the list. */
  function report(s, t, method, caseSensitive = false) {
    if (method === "hamming") {
      if (s.length !== t.length) return ["Strings are of different lengths!", "Please use Levenshtein's distance!"];
      return [`H("${s}", "${t}") = ${hamming(s, t, caseSensitive)}`];
    }
    return [`L("${s}", "${t}") = ${levenshtein(s, t, caseSensitive)}`];
  }

  function start() { return { s: "", t: "", method: "hamming", caseSensitive: false, lines: [] }; }

  /** Do it! */
  function doIt(state, s, t) {
    return { ...state, s, t, lines: state.lines.concat(report(s, t, state.method, state.caseSensitive)) };
  }

  return { hamming, levenshtein, table, alignment, edits, report, start, doIt };
})();
