"use strict";

/*
 * Shuttle Puzzle Practice, from Alexander Bogomolny's applet ShortShuttle
 * (Shuttle Puzzle Practice II).
 *
 * N vertical poles, numbered 1..N at the top. A horizontal shuttle joins two
 * poles at some height. Walking down from the top of a pole, you cross every
 * shuttle you meet to the other pole, and end at the bottom of some pole. A
 * random target is shown under the poles: under pole j, the number of the
 * top that should arrive there. Draw shuttles until every top arrives where
 * the target says, then press Verify.
 *
 * The idea: a shuttle swaps whatever is travelling down its two poles, so
 * the shuttles read from the top down are a product of transpositions, and
 * every permutation is one. A permutation with c cycles (fixed points
 * included) needs at least N - c shuttles, and any two products for it have
 * the same parity.
 *
 * Transcribed from ShortShuttleCanvas, Pole and TransBar (ShuttleLib) and
 * CTKAlgebra's Permutation in mode 2 (values 1..N): the target is a
 * Fisher-Yates shuffle (CreateRandom), top i must reach pole Goal.at(i), and
 * no two shuttles may share a height anywhere on the board (the applet keeps
 * one transposition per pixel row: "This height is occupied! Select
 * another."). Heights here are whole rows 1..ROWS-1 from the top.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * ShuttlePracticeCore. The position is plain data.
 */
const ShuttlePracticeCore = (() => {
  const MIN_N = 2, MAX_N = 20, DEFAULT_N = 5;
  const ROWS = 240;
  const MSG = {
    height: "This height is occupied! Select another.",
    location: "This location is occupied! Select another.",
    yes: "Great! You did it!",
    no: "Nope, not yet. Please continue ...",
  };

  function clampN(n) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.max(MIN_N, Math.min(MAX_N, v)) : DEFAULT_N;
  }

  /** Permutation.CreateRandom in mode 2: 1..N, then swap down from the end. */
  function randomGoal(n, rnd) {
    const v = [];
    for (let i = 0; i < n; i++) v.push(i + 1);
    for (let k = n; k > 1; k--) {
      const j = Math.trunc(rnd() * k);
      const t = v[k - 1]; v[k - 1] = v[j]; v[j] = t;
    }
    return v;
  }

  function start(options = {}) {
    const n = clampN(options.n ?? DEFAULT_N);
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    const goal = Array.isArray(options.goal) && options.goal.length === n ? options.goal.slice() : randomGoal(n, rnd);
    return { n, goal, bars: [], verdict: null };
  }

  const poleOk = (s, p) => Number.isInteger(p) && p >= 0 && p < s.n;

  /**
   * A finished drag: a shuttle from pole a to pole b at row h. Returns
   * {state} or {refused: message}. The same pole, or no pole, cancels
   * silently (refused: null), as in mouseReleased.
   */
  function addBar(s, a, b, h) {
    if (!Number.isInteger(h) || h < 1 || h >= ROWS) return { refused: null };
    if (s.bars.some((x) => x.h === h)) return { refused: MSG.height };
    if (!poleOk(s, a) || !poleOk(s, b) || a === b) return { refused: null };
    return { state: { ...s, bars: s.bars.concat([{ a, b, h }]), verdict: null } };
  }

  /** Remove last: the newest shuttle. */
  function removeLast(s) {
    if (!s.bars.length) return null;
    return { ...s, bars: s.bars.slice(0, -1), verdict: null };
  }

  /** Pole.GetNext: the first shuttle on this pole strictly below row h. */
  function nextBar(s, pole, h) {
    let best = null;
    for (const b of s.bars) if ((b.a === pole || b.b === pole) && b.h > h && (!best || b.h < best.h)) best = b;
    return best;
  }

  /** CollectItinerary: the walk down from the top of a pole. */
  function itinerary(s, pole) {
    const pts = [{ pole, h: 0 }];
    let p = pole, h = 0;
    for (;;) {
      const b = nextBar(s, p, h);
      if (!b) break;
      pts.push({ pole: p, h: b.h });
      p = b.a === p ? b.b : b.a;
      pts.push({ pole: p, h: b.h });
      h = b.h;
    }
    pts.push({ pole: p, h: ROWS });
    return { from: pole, to: p, points: pts };
  }

  /** ComputePermutation's Result: the pole (1..N) each top (0..N-1) reaches. */
  function result(s) {
    const out = [];
    for (let i = 0; i < s.n; i++) out.push(itinerary(s, i).to + 1);
    return out;
  }

  /** What is written under pole j: Goal.InverseAt(j + 1), the top that should arrive. */
  function bottomLabels(s) {
    return s.goal.map((_, j) => s.goal.indexOf(j + 1) + 1);
  }

  /** MakeTransposition: "(i,j)" with i < j, poles numbered from 1. */
  function transposition(b) {
    const i = Math.min(b.a, b.b) + 1, j = Math.max(b.a, b.b) + 1;
    return `(${i},${j})`;
  }

  /** Product: the shuttles from the top down. */
  function product(s) {
    return s.bars.slice().sort((x, y) => x.h - y.h).map(transposition).join("");
  }

  /** Permutation.toCyclesNonSpec in mode 2: every cycle, fixed points too. */
  function cycles(values) {
    const seen = new Array(values.length).fill(false);
    let out = "";
    for (;;) {
      const i0 = seen.indexOf(false);
      if (i0 < 0) return out;
      let i = i0, first = true;
      out += "(";
      while (!seen[i]) {
        out += (first ? "" : ",") + (i + 1);
        first = false;
        seen[i] = true;
        i = values[i] - 1;
      }
      out += ")";
    }
  }

  /** Verify: every top reaches the pole the target says. */
  function verify(s) {
    const r = result(s);
    const ok = r.every((v, i) => v === s.goal[i]);
    return { ...s, verdict: ok ? "yes" : "no" };
  }

  const message = (s) => (s.verdict ? MSG[s.verdict] : "");
  /** "win" once Verify has said yes; there is no losing. */
  const outcome = (s) => (s.verdict === "yes" ? "win" : null);

  /** The fewest shuttles for the target: N minus its number of cycles. */
  function fewest(goal) {
    return goal.length - (cycles(goal).match(/\(/g) || []).length;
  }

  return {
    MIN_N, MAX_N, DEFAULT_N, ROWS, MSG,
    randomGoal, start, addBar, removeLast, itinerary, result, bottomLabels,
    transposition, product, cycles, verify, message, outcome, fewest,
  };
})();
