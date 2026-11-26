"use strict";

/*
 * The Two Men of Tibet, from Alexander Bogomolny's applet TwoMonks (a
 * problem in Zeitz, The Art and Craft of Problem Solving).
 *
 * Two men stand at the two ends of a mountain range, at the same height,
 * and the range never dips below that height. Can they walk along it and
 * swap places, always at the same height as each other? Yes, if they may
 * turn back now and then.
 *
 * The idea (the page's graph proof): draw a level line through every
 * corner of the range and mark where the levels meet it: the named points
 * A, ..., Z in order along the range. A position is an ordered pair of
 * named points at the same height. A step moves both men to a neighbouring
 * named point, both up or both down. (A, Z) and (Z, A) have one step each;
 * every other pair has an even number (0, 2 or 4). A walk from (A, Z) that
 * goes as far as it can must end at the only other odd node: (Z, A).
 *
 * The applet draws the range as a broken line of 7 corners, evenly spaced,
 * the ends at height 0 and the five inner corners at random heights
 * between 1/5 and 4/5 of the picture; inner corners are dragged up and
 * down. "Start journey" refuses plateaus (two neighbouring corners at one
 * height). Its own walking routine stepped pixel by pixel; here the walk is
 * the shortest path in the page's graph, found by breadth-first search.
 *
 * Heights are numbers in [0, 1] (0 at the ends). This file is the game's
 * logic and nothing else. It defines one global, TwoMenOfTibetCore.
 */
const TwoMenOfTibetCore = (() => {
  const CORNERS = 7;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** init(): ends at 0, inner corners between 1/5 and 4/5 at random. */
  function start(options = {}) {
    if (Array.isArray(options.heights) && options.heights.length >= 3) {
      const h = options.heights.map((v) => Math.max(0, Math.min(1, Number(v) || 0)));
      h[0] = 0; h[h.length - 1] = 0;
      return { heights: h };
    }
    const r = rng(Number.isInteger(options.seed) ? options.seed : 3);
    return { heights: Array.from({ length: CORNERS }, (_, i) => (i === 0 || i === CORNERS - 1 ? 0 : Math.round((0.2 + 0.6 * r()) * 1000) / 1000)) };
  }

  /** Drag an inner corner to height h (kept above the ends' height). */
  function setHeight(s, i, h) {
    if (!Number.isInteger(i) || i <= 0 || i >= s.heights.length - 1 || !Number.isFinite(h)) return null;
    const heights = s.heights.slice();
    heights[i] = Math.max(0.02, Math.min(1, Math.round(h * 1000) / 1000));
    return { ...s, heights };
  }

  /** HasPlateau: two neighbouring corners at one height. */
  const plateau = (s) => s.heights.some((h, i) => i > 0 && h === s.heights[i - 1]);

  /** The named points in order along the range: {x, h, corner} with x in corner units. */
  function named(s) {
    const H = s.heights, levels = [...new Set(H)].sort((a, b) => a - b), out = [];
    for (let i = 0; i < H.length; i++) {
      out.push({ x: i, h: H[i], corner: i });
      if (i === H.length - 1) break;
      const a = H[i], b = H[i + 1];
      const inside = levels.filter((L) => (L - a) * (L - b) < 0);
      inside.sort((p, q) => (b > a ? p - q : q - p));
      for (const L of inside) out.push({ x: i + (L - a) / (b - a), h: L, corner: null });
    }
    return out;
  }

  /** The page's graph on pairs (p, q) of named points at one height; edges move both one place, to one new height. */
  function graph(s) {
    const P = named(s), n = P.length, key = (p, q) => p * n + q;
    const nodes = [];
    for (let p = 0; p < n; p++) for (let q = 0; q < n; q++) if (P[p].h === P[q].h) nodes.push([p, q]);
    const adj = new Map(nodes.map(([p, q]) => [key(p, q), []]));
    for (const [p, q] of nodes) {
      for (const dp of [-1, 1]) for (const dq of [-1, 1]) {
        const p2 = p + dp, q2 = q + dq;
        if (p2 < 0 || q2 < 0 || p2 >= n || q2 >= n || P[p2].h !== P[q2].h) continue;
        if (p === q && p2 === q2) continue; // walking side by side is not allowed
        adj.get(key(p, q)).push([p2, q2]);
      }
    }
    return { P, nodes, adj, key };
  }

  /** The walk: a shortest path from (A, Z) to (Z, A), as a list of pairs of named points. */
  function journey(s) {
    if (plateau(s)) return null;
    const { P, adj, key } = graph(s), n = P.length;
    const from = [0, n - 1], to = [n - 1, 0];
    const prev = new Map([[key(...from), null]]), queue = [from];
    while (queue.length) {
      const u = queue.shift();
      if (u[0] === to[0] && u[1] === to[1]) break;
      for (const v of adj.get(key(...u))) if (!prev.has(key(...v))) { prev.set(key(...v), u); queue.push(v); }
    }
    if (!prev.has(key(...to))) return null;
    const path = [];
    for (let u = to; u; u = prev.get(key(...u))) path.unshift(u);
    return path.map(([p, q]) => ({ white: P[p], black: P[q] }));
  }

  /** How many times a man turns back along the walk. */
  function turns(path, who) {
    let t = 0;
    for (let k = 2; k < path.length; k++) {
      const a = path[k - 2][who].x, b = path[k - 1][who].x, c = path[k][who].x;
      if ((b - a) * (c - b) < 0) t++;
    }
    return t;
  }

  const result = () => null;

  return { CORNERS, rng, start, setHeight, plateau, named, graph, journey, turns, result };
})();
