"use strict";

/*
 * Counting Triangles II, from Alexander Bogomolny's applet TriangleChain
 * (a problem from V. V. Prasolov).
 *
 * Lines parallel to the sides cut a triangle into n^2 small triangles. Pick
 * one, then keep stepping to a triangle that shares a side with the last,
 * never visiting one twice. How many can you count? Not all of them: at most
 * n^2 - n + 1.
 *
 * The idea: colour the small triangles like a chessboard. The n(n+1)/2
 * pointing up get one colour, the n(n-1)/2 pointing down the other, and
 * every step changes colour. So a chain has at most one more "up" than
 * "down": at most 2 n(n-1)/2 + 1 = n^2 - n + 1 triangles. A snake through
 * the rows, leaving out one corner triangle in every row but the first,
 * reaches that number.
 *
 * Triangles are numbered by row k = 0 (the top) .. n-1 and place p = 0 ..
 * 2k in the row; even places point up. Two triangles are adjacent when
 * they are neighbours in a row, or when an up triangle (k, 2j) sits on the
 * down triangle (k+1, 2j+1) below it.
 *
 * As in TriangleChainCanvas.MouseClicked, a click on a triangle that is not
 * next to the last one marks it with an X, which also goes on the list;
 * "Remove last" takes back the newest entry. The applet let a chain step
 * into a triangle it had already counted; the page forbids it, so here that
 * is an X too. N is 2..16 (5 to start).
 *
 * This file is the game's logic and nothing else. It defines one global,
 * TriangleChainCore. The position is plain data.
 */
const TriangleChainCore = (() => {
  const N_RANGE = { min: 2, max: 16, def: 5 };

  function start(options = {}) {
    const v = Math.round(Number(options.n ?? N_RANGE.def));
    const n = Number.isFinite(v) ? Math.max(N_RANGE.min, Math.min(N_RANGE.max, v)) : N_RANGE.def;
    return { n, stack: [] }; // stack entries: {k, p, x: boolean}
  }

  const isUp = (t) => t.p % 2 === 0;
  const valid = (n, t) => Number.isInteger(t.k) && Number.isInteger(t.p) && t.k >= 0 && t.k < n && t.p >= 0 && t.p <= 2 * t.k;

  function adjacent(a, b) {
    if (a.k === b.k) return Math.abs(a.p - b.p) === 1;
    const [u, d] = a.k < b.k ? [a, b] : [b, a];
    return d.k === u.k + 1 && isUp(u) && d.p === u.p + 1;
  }

  /** The counted chain: the stack without the X marks. */
  const chain = (s) => s.stack.filter((t) => !t.x);
  const last = (s) => { const c = chain(s); return c.length ? c[c.length - 1] : null; };

  /** MouseClicked on triangle (k, p). */
  function click(s, k, p) {
    const t = { k, p };
    if (!valid(s.n, t)) return null;
    const c = chain(s), prev = last(s);
    const visited = c.some((q) => q.k === k && q.p === p);
    const ok = !visited && (prev === null || adjacent(prev, t));
    return { ...s, stack: s.stack.concat([{ k, p, x: !ok }]) };
  }

  /** Remove last (Pop). */
  function removeLast(s) {
    if (!s.stack.length) return null;
    return { ...s, stack: s.stack.slice(0, -1) };
  }

  const best = (n) => n * n - n + 1;
  const count = (s) => chain(s).length;
  const result = (s) => (count(s) === best(s.n) ? "win" : null);

  /** All triangles of the grid. */
  function triangles(n) {
    const out = [];
    for (let k = 0; k < n; k++) for (let p = 0; p <= 2 * k; p++) out.push({ k, p });
    return out;
  }

  /** A longest chain: a snake through the rows, missing one corner per row after the first. */
  function longestChain(n) {
    const out = [{ k: 0, p: 0 }];
    for (let k = 1; k < n; k++) {
      if (k % 2 === 1) for (let p = 2 * k - 1; p >= 0; p--) out.push({ k, p }); // leaves out (k, 2k)
      else for (let p = 1; p <= 2 * k; p++) out.push({ k, p });               // leaves out (k, 0)
    }
    return out;
  }

  return { N_RANGE, start, isUp, adjacent, chain, last, click, removeLast, best, count, result, triangles, longestChain };
})();
