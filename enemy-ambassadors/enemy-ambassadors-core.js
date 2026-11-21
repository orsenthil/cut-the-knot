"use strict";

/*
 * Ambassadors at a round table, from Alexander Bogomolny's applet EnemyAmbassadors
 * (the problem is from Engel, Problem-Solving Strategies).
 *
 * 2n ambassadors, each with at most n-1 enemies, can always be seated round a table
 * with no two enemies side by side. The page's proof is an algorithm: seat them
 * anyhow; if A and B are hostile neighbours, walk on from B and find a pair B', A'
 * of neighbours with B' not an enemy of A and A' not an enemy of B. Turning the
 * whole arc from B to B' round puts A next to B' and B next to A', and the
 * number of hostile neighbours drops by at least one. Such a pair always exists
 * (A has at least n friends, they have n right-hand neighbours, and B has at most
 * n-1 enemies).
 *
 * The applet: N dots (5 to 30) on a circle, enemy pairs drawn as chords, a click
 * on one dot and then another turns the arc between them (counterclockwise, both
 * ends included) over, which is floor((d+1)/2) swaps for a gap d. The game ends when
 * no enemy pair sits side by side. Its random graph: each of the N ambassadors in
 * turn picks floor(N/4) others from a random permutation and the chord is drawn both
 * ways (CreateEdges). That does not promise the page's condition (at most n-1 enemies
 * each), so some boards may have no solution; the page's procedure is offered as a
 * hint and says so when its condition fails.
 *
 * The position is plain data: N, the enemy pairs, the seating (the ambassador at
 * each place) and the first selected place. Functions return new objects.
 */
const EnemyAmbassadorsCore = (() => {
  const MIN_N = 5;
  const MAX_N = 30;
  const START_N = 10;

  function rng(seed) {
    let s = (Math.trunc(Number(seed)) || 1) >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  /** The applet's CreateEdges: each ambassador picks floor(N/4) from a random permutation; chords are symmetric. */
  function randomEnemies(n, seed) {
    const next = rng(seed);
    const has = Array.from({ length: n }, () => new Array(n).fill(false));
    for (let i = 0; i < n; i++) {
      const perm = Array.from({ length: n }, (_, k) => k);
      for (let k = n - 1; k > 0; k--) { const j = Math.floor(next() * (k + 1)); [perm[k], perm[j]] = [perm[j], perm[k]]; }
      for (let k = 0; k < Math.floor(n / 4); k++) { has[i][perm[k]] = true; has[perm[k]][i] = true; }
    }
    const pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (has[i][j]) pairs.push([i, j]);
    return pairs;
  }

  /** A new position. options: n (5..30, default 10), seed, or enemies (pairs) and seating. */
  function start(options) {
    const o = options || {};
    const n = Number.isFinite(Number(o.n)) ? Math.max(MIN_N, Math.min(MAX_N, Math.trunc(Number(o.n)))) : START_N;
    const enemies = Array.isArray(o.enemies) ? o.enemies.map((p) => [Math.min(p[0], p[1]), Math.max(p[0], p[1])]).filter((p) => p[0] !== p[1] && p[0] >= 0 && p[1] < n) : randomEnemies(n, o.seed === undefined ? 777 : o.seed);
    const seat = Array.isArray(o.seat) && o.seat.length === n ? o.seat.slice() : Array.from({ length: n }, (_, i) => i);
    return { n, enemies, seat, selected: -1, moves: 0 };
  }

  /** Are ambassadors a and b enemies? */
  function areEnemies(s, a, b) {
    return s.enemies.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
  }

  /** The places whose clockwise... next-place neighbour is an enemy: place p and p+1 (mod N). */
  function mishaps(s) {
    const out = [];
    const set = new Set(s.enemies.map((p) => p[0] * s.n + p[1]));
    for (let p = 0; p < s.n; p++) {
      const a = s.seat[p], b = s.seat[(p + 1) % s.n];
      if (set.has(Math.min(a, b) * s.n + Math.max(a, b))) out.push(p);
    }
    return out;
  }

  const degrees = (s) => { const d = new Array(s.n).fill(0); for (const [a, b] of s.enemies) { d[a]++; d[b]++; } return d; };
  /** The page's condition: N = 2n and nobody has more than n-1 enemies. */
  const meetsCondition = (s) => s.n % 2 === 0 && Math.max(0, ...degrees(s)) <= s.n / 2 - 1;

  /** Turn the arc from place `from` to place `to` (counterclockwise, both included) over, as the applet's Swap does. */
  function reverseArc(seat, from, to) {
    const n = seat.length;
    const out = seat.slice();
    let d = to - from; if (d < 0) d += n;
    const swaps = Math.floor((d + 1) / 2);
    for (let k = 0; k < swaps; k++) {
      const x = (to - k + n * 2) % n, y = (from + k) % n;
      const t = out[x]; out[x] = out[y]; out[y] = t;
    }
    return out;
  }

  /**
   * The page's procedure: find a hostile pair A, B (A at place p, B at p+1) and a pair B', A' on
   * further round, B' not an enemy of A and A' not an enemy of B, and turn the arc B..B'.
   * Returns {from, to, a, b, b2, a2} or null when there is no hostile pair or no such pair.
   */
  function lucky(s) {
    const n = s.n;
    for (const p of mishaps(s)) {
      const A = s.seat[p], B = s.seat[(p + 1) % n];
      for (let k = 2; k <= n - 2; k++) {
        const q = (p + k) % n, B2 = s.seat[q], A2 = s.seat[(q + 1) % n];
        if (!areEnemies(s, A, B2) && !areEnemies(s, B, A2)) return { from: (p + 1) % n, to: q, a: A, b: B, b2: B2, a2: A2 };
      }
    }
    return null;
  }

  /**
   * Moves: {type:"pick", place}: select a place, deselect it, or with one selected, turn the arc
   * to this place; {type:"reverse", from, to}; {type:"hint"}: the page's procedure once;
   * {type:"size", value, seed}, {type:"reset", seed}.
   */
  function move(s, m) {
    if (!m) return null;
    const n = s.n;
    if (m.type === "pick") {
      if (!(m.place >= 0 && m.place < n)) return null;
      if (s.selected === -1) return { ...s, selected: m.place };
      if (s.selected === m.place) return { ...s, selected: -1 };
      return { ...s, seat: reverseArc(s.seat, s.selected, m.place), selected: -1, moves: s.moves + 1 };
    }
    if (m.type === "reverse") {
      if (!(m.from >= 0 && m.from < n && m.to >= 0 && m.to < n)) return null;
      return { ...s, seat: reverseArc(s.seat, m.from, m.to), selected: -1, moves: s.moves + 1 };
    }
    if (m.type === "hint") {
      const l = lucky(s);
      if (!l) return null;
      return { ...s, seat: reverseArc(s.seat, l.from, l.to), selected: -1, moves: s.moves + 1 };
    }
    if (m.type === "size") {
      const v = Math.trunc(Number(m.value));
      if (!(v >= MIN_N && v <= MAX_N)) return null;
      return start({ n: v, seed: m.seed });
    }
    if (m.type === "reset") return start({ n, seed: m.seed });
    return null;
  }

  const legalMoves = (s) => Array.from({ length: s.n }, (_, place) => ({ type: "pick", place }));
  /** "win" when no two enemies sit side by side. */
  const result = (s) => (mishaps(s).length === 0 ? "win" : null);

  return { MIN_N, MAX_N, START_N, start, randomEnemies, areEnemies, mishaps, degrees, meetsCondition, reverseArc, lucky, move, legalMoves, result };
})();
