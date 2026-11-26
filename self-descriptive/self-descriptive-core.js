"use strict";

/*
 * Self-descriptive sentences, from Bogomolny's SelfDescriptive applet.
 *
 * "This sentence contains _ 0's, _ 1's, ..." is filled with the counts of
 * each digit written in some base. Each count is written in that base, and
 * the digit labels themselves are part of the sentence: every digit 0..b-1
 * occurs once as a label. So one iteration replaces every count by 1 plus
 * the number of times that digit appears in the written counts. A fixed
 * point is a true sentence. Iterations sometimes settle into cycles, and
 * some true sentences cannot be reached by iteration.
 *
 * Pure logic: one global, plain JSON positions, no DOM and no storage.
 */
const SelfDescriptiveCore = (() => {
  const MIN_BASE = 2;
  const MAX_BASE = 10; // the applet's base slider runs from 2 to 10
  const MAX_COUNT = 99;
  const GLYPHS = "0123456789";

  function clamp(n, lo, hi) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  }

  /** BaseSys.ConvertNum for bases up to ten. */
  function write(value, base) {
    let v = value;
    if (v === 0) return "0";
    let out = "";
    while (v > 0) {
      out = GLYPHS[v % base] + out;
      v = Math.floor(v / base);
    }
    return out;
  }

  /** SelfDescriptiveSentence.Count: digit labels contribute one each. */
  function countDigits(counts, base) {
    const result = new Array(base).fill(1);
    for (const value of counts) {
      for (const ch of write(value, base)) {
        const d = GLYPHS.indexOf(ch);
        if (d >= 0 && d < base) result[d]++;
      }
    }
    return result;
  }

  function trueCounts(counts, base) {
    const want = countDigits(counts, base);
    return counts.length === base && counts.every((v, i) => v === want[i]);
  }

  function start(options = {}) {
    const base = clamp(options.base ?? 10, MIN_BASE, MAX_BASE);
    const counts = Array.isArray(options.counts)
      ? options.counts.slice(0, base).map((v) => clamp(v, 0, MAX_COUNT))
      : new Array(base).fill(1);
    while (counts.length < base) counts.push(1);
    return {
      base,
      counts,
      history: [],
      iterations: 0,
      message: "Press Iterate to replace every count by the digits it produces.",
    };
  }

  function setCount(state, index, delta) {
    if (index < 0 || index >= state.counts.length) return state;
    const counts = state.counts.slice();
    counts[index] = clamp(counts[index] + delta, 0, MAX_COUNT);
    return {
      ...state,
      counts,
      message: `Digit ${index} now appears ${counts[index]} ${counts[index] === 1 ? "time" : "times"}.`,
    };
  }

  function setBase(state, base) {
    const next = clamp(base, MIN_BASE, MAX_BASE);
    return {
      ...start({ base: next }),
      message: `Base ${next}: ${next} digits to count, from 0 to ${next - 1}.`,
    };
  }

  /** One pass of Count + Iterate, with the line recorded in the orbit. */
  function iterate(state) {
    const next = countDigits(state.counts, state.base);
    const line = next.map((v) => write(v, state.base)).join(" ");
    const iterations = state.iterations + 1;
    return {
      ...state,
      counts: next,
      history: state.history.concat(line),
      iterations,
      message: trueCounts(next, state.base)
        ? `True after ${iterations} ${iterations === 1 ? "step" : "steps"}: ${line}.`
        : `Step ${iterations}: ${line}.`,
    };
  }

  function clearHistory(state) {
    return { ...state, history: [], message: "The list of previous rows is cleared." };
  }

  /** "done" once a true sentence is reached. */
  function result(state) {
    return trueCounts(state.counts, state.base) ? "done" : null;
  }

  return {
    MIN_BASE, MAX_BASE, MAX_COUNT, GLYPHS, start, write, countDigits,
    trueCounts, setCount, setBase, iterate, clearHistory, result,
  };
})();
