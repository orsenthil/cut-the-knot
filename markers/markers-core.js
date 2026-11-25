"use strict";

/*
 * Fair Division: Method of Markers, from Alexander Bogomolny's applet Markers.
 *
 * The goods lie along a line from 0 to RAIL. Each of the N players places N-1
 * markers, cutting the goods into N pieces that are all worth the same to
 * that player, and will accept any piece between two of their own consecutive
 * markers (the ends of the goods count as markers). The division:
 *
 *   Round k = 0 .. N-2: among the players not yet served, the one whose k-th
 *   marker is leftmost (the earlier player on a tie; positions are whole
 *   numbers, as the applet compares rounded pixels) is served. They get the
 *   piece from their own previous marker (the left end in round 0) to that
 *   marker; their other markers are dropped.
 *   The one player left gets the piece from their last marker to the right end.
 *
 * Some of the goods may be left over: the gaps between the pieces.
 *
 * The position is plain data: { n, rail, markers } with markers[p] the N-1
 * whole-number positions of player p, in order.
 */
const MarkersCore = (() => {
  const MIN_N = 2, MAX_N = 10, DEFAULT_N = 3, RAIL = 400;

  const clampN = (n) => Math.min(MAX_N, Math.max(MIN_N, Math.round(Number(n)) || DEFAULT_N));

  /** Random markers as the applet deals them: marker i of a player is at (r/3 + 1/3 + i) / (N-1) of the rail. */
  function start(options) {
    const o = options || {};
    const n = clampN(o.n === undefined ? DEFAULT_N : o.n), random = o.random || Math.random, rail = o.rail || RAIL;
    const s = 1 / (n - 1);
    const markers = Array.from({ length: n }, () => Array.from({ length: n - 1 }, (_, i) => Math.round(rail * ((random() * s) / 3 + s / 3 + s * i))));
    return { n, rail, markers };
  }

  /** The leftmost k-th marker among players not in `done`: the player's number, or -1 if none. */
  function leastCompetitor(state, k, done) {
    let best = -1, bestX = Infinity;
    for (let p = 0; p < state.n; p++) {
      if (done.has(p)) continue;
      const x = state.markers[p][k];
      if (x < bestX) { bestX = x; best = p; }
    }
    return best;
  }

  /**
   * The division: { awards, left } where awards are in the order served,
   * [{ player, from, to, round }], and left lists the leftover gaps [from, to]
   * (the black parts of the bar) in order of position.
   */
  function divide(state) {
    const { n, rail, markers } = state;
    const done = new Set(), awards = [];
    for (let k = 0; k < n - 1; k++) {
      const p = leastCompetitor(state, k, done);
      const from = k === 0 ? 0 : markers[p][k - 1], to = markers[p][k];
      awards.push({ player: p, from, to, round: k });
      done.add(p);
    }
    let last = 0;
    while (done.has(last)) last++;
    awards.push({ player: last, from: markers[last][n - 2], to: rail, round: n - 1 });
    const sorted = awards.filter((a) => a.to > a.from).sort((a, b) => a.from - b.from);
    const left = []; let pos = 0;
    for (const a of sorted) { if (a.from > pos) left.push([pos, a.from]); pos = Math.max(pos, a.to); }
    if (pos < rail) left.push([pos, rail]);
    return { awards, left };
  }

  /** The leftover length. */
  const leftover = (d) => d.left.reduce((t, [a, b]) => t + (b - a), 0);

  /** Move marker j of player p to x, kept between its neighbours (or the ends of the rail). New position, same shape. */
  function move(state, p, j, x) {
    if (p < 0 || p >= state.n || j < 0 || j >= state.n - 1 || !Number.isFinite(x)) return null;
    const m = state.markers[p];
    const lo = j === 0 ? 0 : m[j - 1], hi = j === state.n - 2 ? state.rail : m[j + 1];
    const markers = state.markers.map((r) => r.slice());
    markers[p][j] = Math.max(lo, Math.min(hi, Math.round(x)));
    return { ...state, markers };
  }

  /** "done" always: there is nothing to win, the division is simply shown. */
  const result = () => "done";

  return { MIN_N, MAX_N, DEFAULT_N, RAIL, clampN, start, leastCompetitor, divide, leftover, move, result };
})();
