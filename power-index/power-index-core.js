"use strict";

/*
 * Weighted voting and power indices, from Alexander Bogomolny's applet
 * PowerIndex.
 *
 * A weighted voting system [q: w1, ..., wn]: player i has wi votes, and a
 * coalition (a non-empty set of players) wins when its votes reach the quota
 * q. A player is critical to a winning coalition if leaving makes it lose.
 *   Banzhaf: count, for each player, the winning coalitions it is critical
 *   to; its index is that count over the total of all the counts.
 *   Shapley-Shubik: in each of the n! orders the players can join, the
 *   pivotal player is the one whose arrival first reaches the quota; its
 *   index is the number of orders it is pivotal in, over n!.
 *
 * The applet lists all 2^n coalitions and all n! orders. That is hopeless for
 * 13 or more players (13! does not even fit its int), so this core counts the
 * orders by coalition instead: player i is pivotal in |S|! (n-1-|S|)! orders
 * for each coalition S without i that loses on its own and wins with i. The
 * test checks this against the applet's own enumeration for small n.
 *
 * As on the applet's page: 2 to 15 players; the page's applet starts at
 * [6: 4, 3, 2, 1]; a player added later gets 1 to 20 votes at random. Votes
 * are 0 to 1000 and the quota 1 to 1000.
 *
 * The position is plain data: { quota, votes: [w1, ..., wn], compute }.
 */
const PowerIndexCore = (() => {
  const N_MIN = 2, N_MAX = 15, VOTES_MAX = 1000, QUOTA_MIN = 1, QUOTA_MAX = 1000, START_VOTES = 20;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

  function start(options) {
    const o = options || {};
    if (Array.isArray(o.votes) && o.votes.length >= N_MIN && o.votes.length <= N_MAX && o.votes.every(Number.isFinite) && Number.isFinite(o.quota)) {
      return { quota: clamp(o.quota, QUOTA_MIN, QUOTA_MAX), votes: o.votes.map((w) => clamp(w, 0, VOTES_MAX)), compute: !!o.compute };
    }
    return { quota: 6, votes: [4, 3, 2, 1], compute: false };
  }

  const factorials = [1];
  for (let k = 1; k <= N_MAX; k++) factorials[k] = factorials[k - 1] * k;

  const total = (s) => s.votes.reduce((a, b) => a + b, 0);

  /** Banzhaf counts: critical[i] and their sum. */
  function banzhaf(s) {
    const n = s.votes.length, q = s.quota;
    const critical = new Array(n).fill(0);
    for (let mask = 1; mask < 1 << n; mask++) {
      let sum = 0;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) sum += s.votes[i];
      if (sum < q) continue;
      for (let i = 0; i < n; i++) if (mask & (1 << i) && sum - s.votes[i] < q) critical[i]++;
    }
    return { counts: critical, total: critical.reduce((a, b) => a + b, 0) };
  }

  /** Shapley-Shubik counts: pivotal[i] out of n! orders (exact up to 15! < 2^53). */
  function shapley(s) {
    const n = s.votes.length, q = s.quota;
    const pivotal = new Array(n).fill(0);
    for (let mask = 0; mask < 1 << n; mask++) {
      let sum = 0, size = 0;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) { sum += s.votes[i]; size++; }
      if (sum >= q) continue;
      const orders = factorials[size] * factorials[n - 1 - size];
      for (let i = 0; i < n; i++) if (!(mask & (1 << i)) && sum + s.votes[i] >= q) pivotal[i] += orders;
    }
    return { counts: pivotal, total: factorials[n] };
  }

  /** Both indices, or null when no coalition reaches the quota (the definitions then say nothing). */
  function indices(s) {
    if (total(s) < s.quota) return null;
    const b = banzhaf(s), ss = shapley(s);
    const dummies = s.votes.map((_, i) => i).filter((i) => b.counts[i] === 0);
    const dictators = s.votes.map((_, i) => i).filter((i) => s.votes[i] >= s.quota && total(s) - s.votes[i] < s.quota);
    return { banzhaf: b, shapley: ss, dummies, dictators };
  }

  /** Moves: { type: "players", value }, { type: "quota", value }, { type: "votes", index, value }, { type: "compute", value }. */
  function move(s, m, random = Math.random) {
    if (!m) return null;
    if (m.type === "players" && Number.isFinite(m.value)) {
      const n = clamp(m.value, N_MIN, N_MAX);
      const votes = s.votes.slice(0, n);
      // The applet adds a player with 1 + (int)(20 * random) votes, and drops the last one.
      while (votes.length < n) votes.push(1 + Math.trunc(random() * START_VOTES));
      return { ...s, votes };
    }
    if (m.type === "quota" && Number.isFinite(m.value)) return { ...s, quota: clamp(m.value, QUOTA_MIN, QUOTA_MAX) };
    if (m.type === "votes" && Number.isInteger(m.index) && m.index >= 0 && m.index < s.votes.length && Number.isFinite(m.value)) {
      const votes = s.votes.slice(); votes[m.index] = clamp(m.value, 0, VOTES_MAX);
      return { ...s, votes };
    }
    if (m.type === "compute") return { ...s, compute: !!m.value };
    return null;
  }

  return { N_MIN, N_MAX, VOTES_MAX, QUOTA_MIN, QUOTA_MAX, start, total, banzhaf, shapley, indices, move, factorials };
})();
