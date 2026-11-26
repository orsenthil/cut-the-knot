"use strict";

/*
 * Social Choice, from Alexander Bogomolny's applet SocialChoice.
 *
 * Each column is a preference ballot: an ordering of the choices A, B, C, ...
 * with the number of voters who cast it on top. Four ways of turning the
 * ballots into a result, as in VoteCount:
 *   1 Plurality: each choice scores the voters who put it first.
 *   2 Borda: on a ballot of n choices, first place is worth n points, the
 *     last 1.
 *   3 Plurality with elimination (Hare): count first places; if nobody has
 *     more than half the voters, drop the choice with the fewest (the
 *     earliest letter among equals) and count again; the scores shown are
 *     the last round's.
 *   4 Pairwise comparison: every pair of choices meets head to head; the
 *     winner of a meeting scores 2, a tie 1 each.
 * The same ballots can give a different winner under each method.
 *
 * Transcribed from VoteCount and Ballot. The applet's own elimination has a
 * slip: it starts its search for the fewest votes at choice A whether or not
 * A is already out, so once A is eliminated it stops early, with no
 * majority. The page describes the real method, so this port follows the
 * page (appletHare keeps the applet's version for the test).
 *
 * Choices 2..10 and ballots 2..10; voters per ballot 0..1000. The page
 * starts from 7 ABC, 8 BCA, 10 CBA, 4 ACB, with no method ticked. A swap
 * moves a choice one place up its ballot; "Reverse swap" undoes the last.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SocialChoiceCore. The position is plain data.
 */
const SocialChoiceCore = (() => {
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const RANGE = { min: 2, max: 10 };
  const MAX_COUNT = 1000, MAX_START_COUNT = 20;
  const METHODS = { 1: "Plurality", 2: "Borda", 3: "Elimination", 4: "Pairwise" };
  const PAGE = { ballots: [["A", "B", "C"], ["B", "C", "A"], ["C", "B", "A"], ["A", "C", "B"]], counts: [7, 8, 10, 4] };

  /** Permutation.CreateRandom (mode 0 values 1..n shuffled) as letters. */
  function randomBallot(n, rnd) {
    const v = [];
    for (let i = 0; i < n; i++) v.push(i + 1);
    for (let k = n; k > 1; k--) { const j = Math.trunc(rnd() * k); [v[k - 1], v[j]] = [v[j], v[k - 1]]; }
    return v.map((x) => LETTERS[x - 1]);
  }

  function start(options = {}) {
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    let ballots, counts;
    if (Array.isArray(options.ballots) && Array.isArray(options.counts)) {
      ballots = options.ballots.map((b) => b.slice());
      counts = options.counts.slice();
    } else if (options.nc || options.ns) {
      const nc = clampN(options.nc ?? 3), ns = clampN(options.ns ?? 3);
      ballots = []; counts = [];
      for (let i = 0; i < ns; i++) { ballots.push(randomBallot(nc, rnd)); counts.push(Math.trunc(rnd() * MAX_START_COUNT)); }
    } else {
      ballots = PAGE.ballots.map((b) => b.slice());
      counts = PAGE.counts.slice();
    }
    return { ballots, counts, methods: (options.methods || []).filter((m) => METHODS[m]).sort(), stack: [] };
  }

  function clampN(v) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(RANGE.min, Math.min(RANGE.max, n)) : 3; }
  const nChoices = (s) => s.ballots[0].length;

  /** The number of choices: every ballot gains or loses the last letter (AddChoice / RemoveChoice). Clears the swap history. */
  function setChoices(s, n) {
    const N = clampN(n), cur = nChoices(s);
    let ballots = s.ballots.map((b) => b.slice());
    if (N > cur) ballots = ballots.map((b) => { for (let k = cur; k < N; k++) b.push(LETTERS[k]); return b; });
    else if (N < cur) ballots = ballots.map((b) => b.filter((x) => LETTERS.indexOf(x) < N));
    return { ...s, ballots, stack: [] };
  }

  /** The number of ballots: a new random ballot with 0..19 voters, or the last one dropped. */
  function setBallots(s, n, rnd = Math.random) {
    const N = clampN(n);
    const ballots = s.ballots.map((b) => b.slice()), counts = s.counts.slice();
    while (ballots.length < N) { counts.push(Math.trunc(rnd() * MAX_START_COUNT)); ballots.push(randomBallot(nChoices(s), rnd)); }
    while (ballots.length > N) { ballots.pop(); counts.pop(); }
    return { ...s, ballots, counts, stack: [] };
  }

  function setCount(s, i, v) {
    if (!(i >= 0 && i < s.counts.length)) return null;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return null;
    const counts = s.counts.slice();
    counts[i] = Math.max(0, Math.min(MAX_COUNT, n));
    return { ...s, counts };
  }

  /** PerformClick(index, -1): the choice at `index` moves one place up its ballot. */
  function swapUp(s, b, index, record = true) {
    if (!(b >= 0 && b < s.ballots.length) || !(index >= 1 && index < nChoices(s))) return null;
    const ballots = s.ballots.map((x) => x.slice());
    const t = ballots[b][index]; ballots[b][index] = ballots[b][index - 1]; ballots[b][index - 1] = t;
    return { ...s, ballots, stack: record ? s.stack.concat([[b, index]]) : s.stack };
  }

  /** Reverse swap: Pop() repeats the last swap, which undoes it. */
  function reverseSwap(s) {
    if (!s.stack.length) return null;
    const [b, index] = s.stack[s.stack.length - 1];
    return { ...swapUp(s, b, index, false), stack: s.stack.slice(0, -1) };
  }

  function setMethod(s, m, on) {
    if (!METHODS[m]) return null;
    const methods = s.methods.filter((x) => x !== m);
    if (on) methods.push(m);
    return { ...s, methods: methods.sort() };
  }

  const idx = (x) => LETTERS.indexOf(x);

  function plurality(s) {
    const out = new Array(nChoices(s)).fill(0);
    s.ballots.forEach((b, i) => { out[idx(b[0])] += s.counts[i]; });
    return out;
  }

  function borda(s) {
    const n = nChoices(s), out = new Array(n).fill(0);
    s.ballots.forEach((b, i) => b.forEach((x, k) => { out[idx(x)] += s.counts[i] * (n - k); }));
    return out;
  }

  function pairwise(s) {
    const n = nChoices(s), out = new Array(n).fill(0);
    const pos = s.ballots.map((b) => { const h = []; b.forEach((x, k) => { h[idx(x)] = k + 1; }); return h; });
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let forJ = 0, forI = 0;
      s.ballots.forEach((_, v) => { if (pos[v][i] > pos[v][j]) forJ += s.counts[v]; else forI += s.counts[v]; });
      if (forJ > forI) out[j] += 2;
      else if (forJ < forI) out[i] += 2;
      else { out[i] += 1; out[j] += 1; }
    }
    return out;
  }

  /** FatMax: somebody has more than half. */
  function majority(v) {
    const t = v.reduce((a, b) => a + b, 0);
    return v.some((x) => 2 * x > t);
  }

  function firstRound(s, out) {
    const n = nChoices(s), v = new Array(n).fill(0);
    s.ballots.forEach((b, i) => { const top = b.find((x) => !out.has(x)); if (top) v[idx(top)] += s.counts[i]; });
    return v;
  }

  /** Plurality with elimination, as the page describes it. Also returns the order of elimination. */
  function elimination(s) {
    const out = new Set(), order = [];
    for (;;) {
      const v = firstRound(s, out);
      if (majority(v) || out.size >= nChoices(s) - 1) return { scores: v, eliminated: order };
      let k = -1;
      for (let i = 0; i < v.length; i++) if (!out.has(LETTERS[i]) && (k < 0 || v[i] < v[k])) k = i;
      out.add(LETTERS[k]); order.push(LETTERS[k]);
    }
  }

  /** VoteCount.Hare as the applet runs it (the minimum search starts at A even when A is out). */
  function appletHare(s) {
    const out = new Set();
    for (;;) {
      const v = firstRound(s, out);
      if (majority(v)) return v;
      let L7 = 0, L8 = v[0];
      for (let i = 1; i < v.length; i++) if (!out.has(LETTERS[i]) && L8 > v[i]) { L7 = i; L8 = v[i]; }
      if (out.has(LETTERS[L7])) return v; // RemoveChoice finds no such letter left
      out.add(LETTERS[L7]);
    }
  }

  function scores(s, m) {
    if (m === 1) return plurality(s);
    if (m === 2) return borda(s);
    if (m === 3) return elimination(s).scores;
    if (m === 4) return pairwise(s);
    return null;
  }

  /** The letters with the top score under a method. */
  function winners(s, m) {
    const v = scores(s, m), top = Math.max(...v);
    return v.map((x, i) => (x === top ? LETTERS[i] : null)).filter(Boolean);
  }

  const voters = (s) => s.counts.reduce((a, b) => a + b, 0);

  return {
    LETTERS, RANGE, MAX_COUNT, METHODS, PAGE, randomBallot, start, setChoices, setBallots, setCount,
    swapUp, reverseSwap, setMethod, plurality, borda, pairwise, elimination, appletHare, majority,
    scores, winners, voters,
  };
})();
