"use strict";

/*
 * The Farey series, from Alexander Bogomolny's applet Farey.
 *
 * F(N) is the list of fractions m/n in lowest terms with 0 <= m/n <= 1 and n <= N, in
 * increasing order. The applet shows them as lattice points: the point (q, p) for p/q in
 * lowest terms is the one point on its ray from the origin nearest to the origin (the
 * point you can "see" from there), on an N by N board. Two facts make the series work:
 *   (1) successive terms m1/n1 < m2/n2 have m2 n1 - m1 n2 = 1,
 *   (2) the middle one of three successive terms is the mediant of the other two:
 *       m2/n2 = (m1 + m3)/(n1 + n3).
 * Geometrically (1) says the triangle from the origin to two neighbouring points has area 1/2.
 *
 * The applet: N from 2 to 70 (opening on 5) by the buttons or a typed number; checkboxes
 * "One half" (opening on) and "Lines" (opening on). Its list is UpdateSeries: the points
 * (q = 0, p = 1) and (1, 1) first, then every (q, p) with 1 <= p, q <= N and gcd = 1; "Lines"
 * draws a ray from the origin to each point, and with "One half" off each point is also
 * drawn mirrored (p and q exchanged). The position is plain data.
 */
const FareyCore = (() => {
  const MIN_N = 2;
  const MAX_N = 70;
  const START_N = 5;

  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

  const fit = (v) => Math.max(MIN_N, Math.min(MAX_N, Math.trunc(Number(v))));

  /** A new position. */
  function start(options) {
    const o = options || {};
    return { n: Number.isFinite(Number(o.n)) ? fit(o.n) : START_N, lines: o.lines !== false, oneHalf: o.oneHalf !== false, selected: -1, moves: 0, explored: false };
  }

  /** The points of the applet's list (UpdateSeries): [p, q] pairs, the two special ones first. */
  function points(n) {
    const out = [[1, 0], [1, 1]];
    for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) if (gcd(i, j) === 1) out.push([j, i]); // Q gets i, P gets j
    return out;
  }

  /** The Farey series F(n) as [m, n] pairs in increasing order, by the next-term recurrence. */
  function farey(n) {
    const out = [[0, 1]];
    let a = 0, b = 1, c = 1, d = n;
    while (c <= n) {
      const k = Math.floor((n + b) / d);
      [a, b, c, d] = [c, d, k * c - a, k * d - b];
      out.push([a, b]);
      if (a === 1 && b === 1) break;
    }
    return out;
  }

  /** The same series by brute force: every fraction in lowest terms, sorted by cross products. */
  function fareyBrute(n) {
    const out = [];
    for (let q = 1; q <= n; q++) for (let p = 0; p <= q; p++) if (gcd(p, q) === 1) out.push([p, q]);
    return out.sort((x, y) => x[0] * y[1] - y[0] * x[1]);
  }

  /** What there is to know about the i-th term: its neighbours, the determinants and the mediant. */
  function around(n, i) {
    const f = farey(n);
    if (!(i >= 0 && i < f.length)) return null;
    const cur = f[i], prev = i > 0 ? f[i - 1] : null, next = i < f.length - 1 ? f[i + 1] : null;
    const det = (a, b) => b[0] * a[1] - a[0] * b[1];
    return {
      index: i, count: f.length, term: cur, prev, next,
      detPrev: prev ? det(prev, cur) : null, detNext: next ? det(cur, next) : null,
      mediantOfNeighbours: prev && next ? [prev[0] + next[0], prev[1] + next[1]] : null,
      isMediant: !!(prev && next && (prev[0] + next[0]) * cur[1] === cur[0] * (prev[1] + next[1])),
    };
  }

  /** Moves: {type:"n", value}, {type:"step", dir}, {type:"lines"|"oneHalf", value}, {type:"select", index}, {type:"reset"}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "n") { const v = Math.trunc(Number(m.value)); if (!(v >= MIN_N && v <= MAX_N)) return null; return { ...s, n: v, selected: -1, moves: s.moves + 1, explored: true }; }
    if (m.type === "step") { const v = s.n + (m.dir < 0 ? -1 : 1); if (v < MIN_N || v > MAX_N) return null; return { ...s, n: v, selected: -1, moves: s.moves + 1, explored: true }; }
    if (m.type === "lines" || m.type === "oneHalf") return { ...s, [m.type]: !!m.value, moves: s.moves + 1, explored: true };
    if (m.type === "select") { const k = farey(s.n).length; if (!(m.index >= -1 && m.index < k)) return null; return { ...s, selected: m.index, moves: s.moves + 1, explored: true }; }
    if (m.type === "reset") return start({});
    return null;
  }

  const legalMoves = (s) => [s.n > MIN_N ? { type: "step", dir: -1 } : null, s.n < MAX_N ? { type: "step", dir: 1 } : null].filter(Boolean);
  const result = (s) => (s.explored ? "done" : null);

  return { MIN_N, MAX_N, START_N, start, gcd, points, farey, fareyBrute, around, move, legalMoves, result };
})();
