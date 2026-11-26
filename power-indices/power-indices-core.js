"use strict";

/*
 * Fast power indices, from Alexander Bogomolny's applet PowerIndices.
 *
 * A weighted voting system: named players with weights and a quota q. The
 * Banzhaf and Shapley-Shubik indices are defined by counting coalitions and
 * orders (see Weighted Voting and Power Indices), far too many to list for the
 * 51 members of the Electoral College. The applet counts them with generating
 * polynomials instead:
 *
 *   Banzhaf (IntPoly): the coefficient of x^s in the product over the other
 *   players of (1 + x^w) is the number of coalitions of the others weighing
 *   s. Player i swings exactly those with q - w_i <= s < q.
 *
 *   Shapley-Shubik (IndexedIntPoly): the same with a second variable for the
 *   size, so c[k][s] counts coalitions of k others weighing s. Each swing of
 *   size k is pivotal in k! (n - 1 - k)! of the n! orders.
 *
 * Only coefficients below q are kept. The data sets are the four the applet's
 * page lists: two Electoral Colleges, the European Union (Council of
 * Ministers, 15 members) and the UN Security Council.
 *
 * The position is plain data: { set, quota, players: [[name, weight], ...] };
 * set is the data set's name, or "Custom" once anything is changed.
 */
const PowerIndicesCore = (() => {
  const DATA = [
    {"name": "Electoral College (1990)", "quota": 270, "players": [["California", 54], ["New York", 33], ["Texas", 32], ["Florida", 25], ["Pennsylvania", 23], ["Illinois", 22], ["Ohio", 21], ["Michigan", 18], ["New Jersey", 15], ["N. Carolina", 14], ["Georgia", 13], ["Virginia", 13], ["Massachusetts", 12], ["Indiana", 12], ["Missouri", 11], ["Wisconsin", 11], ["Tennessee", 11], ["Washington", 11], ["Maryland", 10], ["Minnesota", 10], ["Louisiana", 9], ["Alabama", 9], ["Kentucky", 8], ["Arizona", 8], ["S. Carolina", 8], ["Colorado", 8], ["Connecticut", 8], ["Oklahoma", 8], ["Oregon", 7], ["Iowa", 7], ["Mississippi", 7], ["Kansas", 6], ["Arkansas", 6], ["W. Virginia", 5], ["Utah", 5], ["Nebraska", 5], ["New Mexico", 5], ["Maine", 4], ["Nevada", 4], ["New Hampshire", 4], ["Hawaii", 4], ["Idaho", 4], ["Rhode Island", 4], ["Montana", 3], ["S. Dakota", 3], ["Delaware", 3], ["N. Dakota", 3], ["Vermont", 3], ["Alaska", 3], ["Wyoming", 3], ["D.C.", 3]]}, 
    {"name": "Electoral College (2000)", "quota": 270, "players": [["California", 55], ["Texas", 34], ["New York", 31], ["Florida", 27], ["Pennsylvania", 21], ["Illinois", 21], ["Ohio", 20], ["Michigan", 17], ["Georgia", 15], ["New Jersey", 15], ["N. Carolina", 15], ["Virginia", 13], ["Massachusetts", 12], ["Indiana", 11], ["Missouri", 11], ["Tennessee", 11], ["Washington", 11], ["Arizona", 10], ["Maryland", 10], ["Minnesota", 10], ["Wisconsin", 10], ["Alabama", 9], ["Colorado", 9], ["Louisiana", 9], ["Kentucky", 8], ["S. Carolina", 8], ["Connecticut", 7], ["Iowa", 7], ["Oklahoma", 7], ["Oregon", 7], ["Arkansas", 6], ["Kansas", 6], ["Mississippi", 6], ["Nebraska", 5], ["Nevada", 5], ["New Mexico", 5], ["Utah", 5], ["W. Virginia", 5], ["Maine", 4], ["New Hampshire", 4], ["Hawaii", 4], ["Idaho", 4], ["Rhode Island", 4], ["Montana", 3], ["S. Dakota", 3], ["Delaware", 3], ["N. Dakota", 3], ["Vermont", 3], ["Alaska", 3], ["Wyoming", 3], ["D.C.", 3]]}, 
    {"name": "European Union", "quota": 62, "players": [["France", 10], ["Germany", 10], ["Italy", 10], ["United Kingdom", 10], ["Spain", 8], ["Belgium", 5], ["Greece", 5], ["Netherlands", 5], ["Portugal", 5], ["Austria", 4], ["Sweden", 4], ["Denmark", 3], ["Finland", 3], ["Ireland", 3], ["Luxemburg", 2]]}, 
    {"name": "Security Council", "quota": 39, "players": [["United States", 7], ["Russia", 7], ["China", 7], ["United Kingdom", 7], ["France", 7], ["Nonpermanent member 1", 1], ["Nonpermanent member 2", 1], ["Nonpermanent member 3", 1], ["Nonpermanent member 4", 1], ["Nonpermanent member 5", 1], ["Nonpermanent member 6", 1], ["Nonpermanent member 7", 1], ["Nonpermanent member 8", 1], ["Nonpermanent member 9", 1], ["Nonpermanent member 10", 1]]}];
  const MAX_PLAYERS = 60, MAX_WEIGHT = 1000, MAX_QUOTA = 60000;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

  function start(options) {
    const o = options || {};
    if (Array.isArray(o.players) && Number.isFinite(o.quota)) {
      const players = o.players.slice(0, MAX_PLAYERS).filter((p) => Array.isArray(p) && Number.isFinite(p[1]))
        .map(([name, w]) => [String(name).slice(0, 40), clamp(w, 0, MAX_WEIGHT)]);
      return { set: typeof o.set === "string" ? o.set : "Custom", quota: clamp(o.quota, 1, MAX_QUOTA), players };
    }
    const d = DATA.find((x) => x.name === o.set) || DATA[0];
    return { set: d.name, quota: d.quota, players: d.players.map((p) => p.slice()) };
  }

  const total = (s) => s.players.reduce((a, p) => a + p[1], 0);

  /** Coefficients below q of the product over j != skip of (1 + x^w_j). */
  function poly(weights, skip, q) {
    const c = new Float64Array(q); c[0] = 1;
    weights.forEach((w, j) => {
      if (j === skip || w >= q) return; // a factor x^w with w >= q only adds terms of degree >= q
      for (let s = q - 1 - w; s >= 0; s--) if (c[s]) c[s + w] += c[s];
    });
    return c;
  }

  /** c[k][s] below q: coalitions of k players other than skip, weighing s. */
  function poly2(weights, skip, q) {
    const n = weights.length;
    const c = Array.from({ length: n }, () => new Float64Array(q));
    c[0][0] = 1;
    weights.forEach((w, j) => {
      if (j === skip) return;
      for (let k = n - 2; k >= 0; k--) {
        const row = c[k], up = c[k + 1];
        for (let s = q - 1 - w; s >= 0; s--) if (row[s]) up[s + w] += row[s];
      }
    });
    return c;
  }

  const fact = [1];
  for (let k = 1; k <= MAX_PLAYERS; k++) fact[k] = fact[k - 1] * k;

  /**
   * Both indices: { banzhaf: [swings...], banzhafTotal (a BigInt, exact),
   * banzhafShare: [...], shapley: [...] (shares of n!) }, or null when no
   * coalition reaches the quota. Players of equal weight are computed once.
   */
  function compute(s) {
    const n = s.players.length, q = s.quota;
    if (n === 0 || total(s) < q) return null;
    const weights = s.players.map((p) => p[1]);
    const memo = new Map();
    const banzhaf = [], shapley = [];
    weights.forEach((w, i) => {
      if (!memo.has(w)) {
        const lo = Math.max(0, q - w);
        const c = poly(weights, i, q);
        let swings = 0;
        for (let t = lo; t < q; t++) swings += c[t];
        const c2 = poly2(weights, i, q);
        let ss = 0;
        for (let k = 0; k < n; k++) {
          let count = 0;
          for (let t = lo; t < q; t++) count += c2[k][t];
          if (count) ss += count * (fact[k] * fact[n - 1 - k] / fact[n]);
        }
        memo.set(w, { swings, ss });
      }
      banzhaf.push(memo.get(w).swings);
      shapley.push(memo.get(w).ss);
    });
    const banzhafTotal = banzhaf.reduce((a, b) => a + BigInt(b), 0n);
    const banzhafShare = banzhaf.map((b) => (banzhafTotal ? b / Number(banzhafTotal) : 0));
    return { banzhaf, banzhafTotal, banzhafShare, shapley };
  }

  /** Moves: { type: "set", name }, { type: "quota", value }, { type: "weight", index, value }, { type: "add" }, { type: "remove", index }. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "set") return DATA.some((d) => d.name === m.name) ? start({ set: m.name }) : null;
    const custom = (x) => ({ ...x, set: "Custom" });
    if (m.type === "quota" && Number.isFinite(m.value)) return custom({ ...s, quota: clamp(m.value, 1, MAX_QUOTA) });
    if (m.type === "weight" && Number.isInteger(m.index) && m.index >= 0 && m.index < s.players.length && Number.isFinite(m.value)) {
      const players = s.players.map((p) => p.slice()); players[m.index][1] = clamp(m.value, 0, MAX_WEIGHT);
      return custom({ ...s, players });
    }
    if (m.type === "add" && s.players.length < MAX_PLAYERS) {
      let k = s.players.length + 1;
      while (s.players.some((p) => p[0] === `Player ${k}`)) k++;
      return custom({ ...s, players: [...s.players.map((p) => p.slice()), [`Player ${k}`, 1]] });
    }
    if (m.type === "remove" && Number.isInteger(m.index) && m.index >= 0 && m.index < s.players.length && s.players.length > 1) {
      return custom({ ...s, players: s.players.filter((_, i) => i !== m.index).map((p) => p.slice()) });
    }
    return null;
  }

  return { DATA, MAX_PLAYERS, MAX_WEIGHT, MAX_QUOTA, start, total, poly, poly2, compute, move };
})();
