"use strict";

/*
 * Voting, from Alexander Bogomolny's applet Voting (Voting.zip). The applet
 * was made for Peter Tannenbaum's Excursions in Modern Mathematics and is on
 * cut-the-knot.org with permission; only its rules are taken here. The counting
 * below is written from scratch, following the applet's four engines:
 *   PluralityTab$ProcessedSelections.FirstPlaceCount - top places only;
 *   BordaTab$ProcessedSelections.CountScore - first place worth n points,
 *     last place 1, with the exact 'n x voters' breakdown it prints;
 *   EliminationTab.ReportHierarchy - each round the highest still-running
 *     candidate on each ballot collects that column's voters; the weakest is
 *     struck out; at two candidates the survivor wins, or 'nobody' on a tie;
 *   ComparisonTab.AddFrameText - a head-to-head win is 1 point, a tie .5 each,
 *     every unordered pair compared once.
 *
 * Ties in the applet's sorted results keep insertion order (SortedVector).
 * For elimination the candidates enter that sort in java.util.Hashtable key
 * order, so hashtableOrder() reproduces that order rather than inventing a
 * new tie-break. The position is plain data; no document, no window.
 */
const VotingCore = (() => {
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const RANGE = { candidates: [2, 40], ballots: [2, 40], voters: [0, 9999] };
  const METHODS = ["plurality", "borda", "elimination", "pairwise"];
  const DEFAULT = {
    candidates: ["A", "B", "C"],
    ballots: [
      { count: 5, order: ["A", "B", "C"] },
      { count: 4, order: ["B", "C", "A"] },
    ],
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  const namesFrom = (input) => {
    const raw = Array.isArray(input) ? input : String(input).split(/[\s,]+/);
    return raw.map((x) => String(x).trim()).filter(Boolean);
  };
  const letterName = (i) => String.fromCharCode(65 + i); // A..Z, then the applet's punctuation

  function normaliseCandidates(input) {
    const names = namesFrom(input);
    if (names.length < RANGE.candidates[0] || names.length > RANGE.candidates[1]) return null;
    const seen = new Set(), out = [];
    for (const name of names) {
      if (seen.has(name)) return null;
      seen.add(name);
      out.push(name);
    }
    return out;
  }

  function normaliseBallots(names, input, counts) {
    const list = Array.isArray(input) ? input : [];
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const raw = list[i];
      const order = namesFrom(Array.isArray(raw) ? raw : raw.order);
      const clean = [];
      for (const n of order) if (names.includes(n) && !clean.includes(n)) clean.push(n);
      for (const n of names) if (!clean.includes(n)) clean.push(n);
      const count = clamp(Array.isArray(raw) ? (counts ? counts[i] : 0) : raw.count, RANGE.voters[0], RANGE.voters[1]);
      out.push({ count, order: clean });
    }
    if (out.length < RANGE.ballots[0]) {
      while (out.length < RANGE.ballots[0]) out.push({ count: 0, order: names.slice() });
    }
    if (out.length > RANGE.ballots[1]) out.length = RANGE.ballots[1];
    return out;
  }

  /** The position a new game starts from. */
  function start(options = {}) {
    const names = options.candidates ? normaliseCandidates(options.candidates) || DEFAULT.candidates.slice()
      : DEFAULT.candidates.slice();
    const ballots = options.ballots
      ? normaliseBallots(names, options.ballots, options.counts)
      : DEFAULT.ballots.map((b) => ({ count: b.count, order: b.order.slice() }));
    return {
      candidates: names,
      ballots,
      method: METHODS.includes(options.method) ? options.method : "plurality",
      revealed: [],
      comparisons: [],
      round: 0,
      namesText: names.join(","),
    };
  }

  const cleared = (s) => ({ ...s, revealed: [], comparisons: [], round: 0 });
  const voters = (s) => s.ballots.reduce((a, b) => a + b.count, 0);

  /* ------------------------------------------------------- editing the table */

  function setCandidates(s, n) {
    const N = clamp(n, RANGE.candidates[0], RANGE.candidates[1]);
    const names = s.candidates.slice(0, N);
    for (let i = names.length; i < N; i++) names.push(letterName(i));
    const ballots = s.ballots.map((b) => {
      const order = b.order.filter((x) => names.includes(x));
      for (const x of names) if (!order.includes(x)) order.push(x);
      return { count: b.count, order };
    });
    return cleared({ ...s, candidates: names, namesText: names.join(","), ballots });
  }

  function setBallots(s, n) {
    const N = clamp(n, RANGE.ballots[0], RANGE.ballots[1]);
    const ballots = s.ballots.map((b) => ({ ...b, order: b.order.slice() }));
    while (ballots.length < N) ballots.push({ count: 0, order: s.candidates.slice() });
    ballots.length = N;
    return cleared({ ...s, ballots });
  }

  function setNames(s, text) {
    const names = normaliseCandidates(text);
    if (!names) return null;
    const ballots = s.ballots.map((b, i) => {
      const order = [];
      b.order.forEach((old, k) => { if (k < names.length && !order.includes(names[k])) order.push(names[k]); });
      for (const n of names) if (!order.includes(n)) order.push(n);
      return { count: b.count, order };
    });
    return cleared({ ...s, candidates: names, namesText: names.join(","), ballots });
  }

  function setCount(s, ballot, value) {
    if (!(ballot >= 0 && ballot < s.ballots.length)) return null;
    const ballots = s.ballots.map((b) => ({ ...b, order: b.order.slice() }));
    ballots[ballot].count = clamp(value, RANGE.voters[0], RANGE.voters[1]);
    return cleared({ ...s, ballots });
  }

  /** Move a candidate one place up its ballot (0-based index 1..n-1). */
  function moveUp(s, ballot, index) {
    if (!(ballot >= 0 && ballot < s.ballots.length)) return null;
    if (!(index >= 1 && index < s.candidates.length)) return null;
    const ballots = s.ballots.map((b) => ({ ...b, order: b.order.slice() }));
    const order = ballots[ballot].order;
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    return cleared({ ...s, ballots });
  }

  function setMethod(s, method) {
    if (!METHODS.includes(method)) return null;
    return cleared({ ...s, method });
  }

  /* ------------------------------------------------------------ the engines */

  /** Plurality: only the first row of each ballot counts. */
  function plurality(s) {
    const out = {};
    s.candidates.forEach((c) => { out[c] = 0; });
    s.ballots.forEach((b) => { if (b.order[0] in out) out[b.order[0]] += b.count; });
    return out;
  }

  /** BordaTab.CountScore: rank 0 is worth n, rank n-1 is worth 1. */
  function borda(s) {
    const out = {}, n = s.candidates.length;
    s.candidates.forEach((c) => { out[c] = 0; });
    s.ballots.forEach((b) => b.order.forEach((c, rank) => { if (c in out) out[c] += b.count * (n - rank); }));
    return out;
  }

  /** The applet's 'name: 3x5 + 1x4 = 19' score line. */
  function scoreLine(s, name, method) {
    if (!(s.candidates.includes(name))) return "";
    if (method === "plurality") {
      const parts = s.ballots.filter((b) => b.order[0] === name).map((b) => String(b.count));
      const total = parts.reduce((a, b) => a + Number(b), 0);
      return `${name}: ${parts.join(" + ") || "0"} first place votes`;
    }
    if (method === "borda") {
      const n = s.candidates.length, parts = [];
      s.ballots.forEach((b) => {
        const rank = b.order.indexOf(name);
        if (rank >= 0) parts.push(`${n - rank}\u00d7${b.count}`);
      });
      const total = borda(s)[name];
      return `${name}: ${parts.join(" + ") || "0"} = ${total}`;
    }
    return "";
  }

  /** ComparisonTab: every unordered pair, one point split between the two. */
  function pairwise(s) {
    const scores = {}, duels = [];
    s.candidates.forEach((c) => { scores[c] = 0; });
    for (let i = 0; i < s.candidates.length; i++) {
      for (let j = i + 1; j < s.candidates.length; j++) {
        const a = s.candidates[i], b = s.candidates[j];
        let forA = 0, forB = 0;
        s.ballots.forEach((ballot) => {
          const pa = ballot.order.indexOf(a), pb = ballot.order.indexOf(b);
          if (pa < pb) forA += ballot.count; else forB += ballot.count;
        });
        if (forA > forB) { scores[a] += 1; duels.push({ a, b, forA, forB, award: a }); }
        else if (forB > forA) { scores[b] += 1; duels.push({ a, b, forA, forB, award: b }); }
        else { scores[a] += 0.5; scores[b] += 0.5; duels.push({ a, b, forA, forB, award: null }); }
      }
    }
    return { scores, duels };
  }

  const pairKey = (a, b) => (a <= b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

  /* ------------------------------- java.util.Hashtable's key order, for ties */

  function javaHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (31 * h + str.charCodeAt(i)) | 0;
    return h;
  }

  /** Keys as EliminationTab's Hashtable enumerates them: buckets high to low. */
  function hashtableOrder(names) {
    let capacity = 11, threshold = 8, buckets = Array.from({ length: capacity }, () => []);
    let order = []; // current enumeration order (bucket index descending)
    const rebuild = (list) => {
      buckets = Array.from({ length: capacity }, () => []);
      for (const name of list) buckets[(javaHash(name) & 0x7fffffff) % capacity].unshift(name);
      order = [];
      for (let i = capacity - 1; i >= 0; i--) order = order.concat(buckets[i]);
    };
    for (const name of names) {
      if (order.length >= threshold) {
        capacity = capacity * 2 + 1;
        threshold = Math.floor(capacity * 0.75);
        rebuild(order);
      }
      buckets[(javaHash(name) & 0x7fffffff) % capacity].unshift(name);
      order = [];
      for (let i = capacity - 1; i >= 0; i--) order = order.concat(buckets[i]);
    }
    return order;
  }

  /** SortedVector.addElement: descending, equal scores keep insertion order. */
  function ranked(scores, insertOrder) {
    return insertOrder.slice().filter((n) => n in scores).sort((a, b) => scores[b] - scores[a]);
  }

  /** Every round of EliminationTab.ReportHierarchy, up to the winner. */
  function eliminationRounds(s) {
    const eliminated = [], rounds = [];
    for (let r = 1; r <= s.candidates.length - 1; r++) {
      const active = s.candidates.filter((c) => !eliminated.includes(c));
      const scores = {};
      active.forEach((c) => { scores[c] = 0; });
      s.ballots.forEach((b) => {
        const top = b.order.find((c) => active.includes(c));
        if (top) scores[top] += b.count;
      });
      const order = ranked(scores, hashtableOrder(active));
      const weakest = order[order.length - 1];
      let winner;
      if (active.length === 2) {
        winner = scores[active[0]] === scores[active[1]] ? null : order[0];
      }
      rounds.push({ number: r, active, scores, ranked: order, weakest, winner });
      if (active.length === 2) break;
      eliminated.push(weakest);
    }
    return rounds;
  }

  function eliminationRound(s) {
    const rounds = eliminationRounds(s);
    return rounds[s.round === 0 ? 0 : Math.min(s.round, rounds.length) - 1];
  }

  /** The final scores for a method (elimination: the current round). */
  function scores(s, method = s.method) {
    if (method === "plurality") return plurality(s);
    if (method === "borda") return borda(s);
    if (method === "pairwise") return pairwise(s).scores;
    if (method === "elimination") return eliminationRound(s).scores;
    return null;
  }

  /** Candidates sharing the top score; a tie has more than one. */
  function winners(s, method = s.method) {
    if (method === "elimination") {
      const round = eliminationRounds(s).slice().pop();
      if (round.winner !== undefined) return round.winner ? [round.winner] : round.active.slice();
    }
    const sc = scores(s, method);
    if (!sc) return [];
    const top = Math.max(...Object.values(sc));
    return s.candidates.filter((c) => sc[c] === top);
  }
  const tie = (s, method = s.method) => winners(s, method).length > 1;

  /* ------------------------------------------------------------- play moves */

  function reveal(s, name) {
    if (!METHODS.includes(s.method) || !s.candidates.includes(name) || s.revealed.includes(name)) return null;
    return { ...s, revealed: s.revealed.concat(name) };
  }

  function compare(s, a, b) {
    if (s.method !== "pairwise" || !s.candidates.includes(a) || !s.candidates.includes(b) || a === b) return null;
    if (s.comparisons.some((p) => pairKey(p[0], p[1]) === pairKey(a, b))) return null;
    const pair = pairKey(a, b).split("\u0000");
    return { ...s, comparisons: s.comparisons.concat([pair]) };
  }

  /** One press of the applet's Eliminate / Restore button. */
  function eliminate(s) {
    if (s.method !== "elimination") return null;
    const rounds = eliminationRounds(s);
    if (s.round >= rounds.length) return { ...s, round: 0 }; // Restore
    return { ...s, round: s.round + 1 };
  }

  function pairCount(s) { return s.candidates.length * (s.candidates.length - 1) / 2; }

  /** "done" marks a finished exploration of this demo; never win or lose. */
  function result(s) {
    if (s.method === "plurality" || s.method === "borda") return s.revealed.length >= s.candidates.length ? "done" : null;
    if (s.method === "elimination") {
      const rounds = eliminationRounds(s);
      return s.round >= rounds.length && s.round > 0 ? "done" : null;
    }
    if (s.method === "pairwise") return s.comparisons.length >= pairCount(s) ? "done" : null;
    return null;
  }

  function legalMoves(s) {
    if (s.method === "plurality" || s.method === "borda") {
      return s.candidates.filter((c) => !s.revealed.includes(c)).map((name) => ({ type: "reveal", name }));
    }
    if (s.method === "pairwise") {
      const out = [];
      s.candidates.forEach((a, i) => s.candidates.slice(i + 1).forEach((b) => {
        if (!s.comparisons.some((p) => pairKey(p[0], p[1]) === pairKey(a, b))) out.push({ type: "compare", a, b });
      }));
      return out;
    }
    return [{ type: "eliminate" }];
  }

  function move(s, m) {
    if (!m) return null;
    switch (m.type) {
      case "reveal": return reveal(s, m.name);
      case "compare": return compare(s, m.a, m.b);
      case "eliminate": return eliminate(s);
      case "method": return setMethod(s, m.method);
      case "count": return setCount(s, m.ballot, m.value);
      case "swap": return moveUp(s, m.ballot, m.index);
      case "candidates": return setCandidates(s, m.n);
      case "ballots": return setBallots(s, m.n);
      case "names": return setNames(s, m.text);
      case "reset": return cleared(s);
      default: return null;
    }
  }

  return {
    LETTERS, RANGE, METHODS, DEFAULT, start, voters,
    setCandidates, setBallots, setNames, setCount, moveUp, setMethod,
    plurality, borda, pairwise, scoreLine, hashtableOrder, ranked, eliminationRounds, eliminationRound,
    scores, winners, tie, reveal, compare, eliminate, pairCount, result, legalMoves, move,
  };
})();
