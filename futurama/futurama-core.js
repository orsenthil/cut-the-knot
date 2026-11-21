"use strict";

/*
 * The Futurama theorem game, from Alexander Bogomolny's applet Futurama ("Futuramautations Explorer").
 *
 * In the episode "The Prisoner of Benda" a machine swaps the minds of two bodies, but no two bodies can
 * swap with each other more than once. N people have had their minds mixed up (a random permutation).
 * Two clean people, X and Y, who have swapped with nobody, help: every swap must involve X or Y, and no
 * pair may swap twice. The Futurama theorem (Ken Keeler) says that every permutation of any finite set
 * can be undone this way, whatever the mixing was.
 *
 * Read off the bytecode: N people (opening on 7) and the extras X and Y (indices N and N + 1); a click
 * on a body and then another swaps their minds, unless the pair has swapped before ("Already swapped")
 * or the swap involves neither X nor Y ("Only swap with X or Y"); "Take back" undoes the last swap and
 * frees the pair; the puzzle is done when every mind is back in its own body ("Fantasic!"). The permutation is random
 * (the applet's helper class is not in the files I read; this port draws a random one that is not already
 * straight). The range of N is not in the bytecode I read: here 3 to 12. The position is plain data.
 */
const FuturamaCore = (() => {
  const MIN_N = 3, MAX_N = 12, START_N = 7;
  const MESSAGES = { used: "Already swapped", xy: "Only swap with X or Y", done: "Fantasic!" };

  function rng(seed) {
    let s = (Math.imul(Math.trunc(Number(seed)) || 1, 2654435761) ^ 0x5bd1e995) >>> 0;
    const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    next(); next(); next();
    return next;
  }

  /** A new game: n people (3 to 12) with a random mix-up, and the clean X and Y. perm[i] is the mind now in body i. */
  function start(options) {
    const o = options || {};
    const n = Number.isFinite(Number(o.n)) ? Math.max(MIN_N, Math.min(MAX_N, Math.trunc(Number(o.n)))) : START_N;
    let perm;
    if (Array.isArray(o.perm) && o.perm.length === n + 2) perm = o.perm.slice();
    else {
      const next = rng(o.seed === undefined ? 777 : o.seed);
      do {
        perm = Array.from({ length: n }, (_, i) => i);
        for (let k = n - 1; k > 0; k--) { const j = Math.floor(next() * (k + 1)); [perm[k], perm[j]] = [perm[j], perm[k]]; }
      } while (perm.every((v, i) => v === i));
      perm.push(n, n + 1);
    }
    return { n, perm, usedX: [], usedY: [], stack: [], message: "", moves: 0, explored: false };
  }

  const isX = (s, i) => i === s.n, isY = (s, i) => i === s.n + 1;
  const straight = (s) => s.perm.every((v, i) => v === i);

  /** What stops a swap of bodies i and j, or "" if it is allowed. */
  function why(s, i, j) {
    if (!(i >= 0 && j >= 0 && i < s.n + 2 && j < s.n + 2) || i === j) return "bad";
    let mask = 0;
    if (isX(s, i) && s.usedX.includes(j)) return MESSAGES.used;
    if (isX(s, j) && s.usedX.includes(i)) return MESSAGES.used;
    if (isY(s, i) && s.usedY.includes(j)) return MESSAGES.used;
    if (isY(s, j) && s.usedY.includes(i)) return MESSAGES.used;
    if (isX(s, i) || isX(s, j)) mask |= 1;
    if (isY(s, i) || isY(s, j)) mask |= 2;
    return mask === 0 ? MESSAGES.xy : "";
  }

  /** The swap of bodies i and j; returns the new position, a position with a message when it is refused, or null for a bad index. */
  function swap(s, i, j) {
    const w = why(s, i, j);
    if (w === "bad") return null;
    if (w) return { ...s, message: w };
    const perm = s.perm.slice(); [perm[i], perm[j]] = [perm[j], perm[i]];
    const usedX = s.usedX.slice(), usedY = s.usedY.slice();
    let mask = 0;
    if (isX(s, i)) { usedX.push(j); mask |= 1; }
    if (isX(s, j)) { usedX.push(i); mask |= 1; }
    if (isY(s, i)) { usedY.push(j); mask |= 2; }
    if (isY(s, j)) { usedY.push(i); mask |= 2; }
    const t = { ...s, perm, usedX, usedY, stack: s.stack.concat([[i, j, mask]]), moves: s.moves + 1, explored: true };
    return { ...t, message: straight(t) ? MESSAGES.done : "" };
  }

  /** Moves: {type:"swap", i, j}, {type:"back"}, {type:"n", value, seed}, {type:"reset", seed}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "swap") return swap(s, m.i, m.j);
    if (m.type === "back") {
      if (!s.stack.length) return null;
      const [i, j] = s.stack[s.stack.length - 1];
      const perm = s.perm.slice(); [perm[i], perm[j]] = [perm[j], perm[i]];
      const drop = (list, k) => { const c = list.slice(); const at = c.lastIndexOf(k); if (at >= 0) c.splice(at, 1); return c; };
      let usedX = s.usedX, usedY = s.usedY;
      for (const [a, b] of [[i, j], [j, i]]) { if (isX(s, a)) usedX = drop(usedX, b); if (isY(s, a)) usedY = drop(usedY, b); }
      return { ...s, perm, usedX, usedY, stack: s.stack.slice(0, -1), message: "" };
    }
    if (m.type === "n") { const v = Math.trunc(Number(m.value)); if (!(v >= MIN_N && v <= MAX_N)) return null; return start({ n: v, seed: m.seed }); }
    if (m.type === "reset") return start({ n: s.n, seed: m.seed });
    return null;
  }

  function legalMoves(s) {
    const out = [];
    for (let i = 0; i < s.n + 2; i++) for (let j = i + 1; j < s.n + 2; j++) if (why(s, i, j) === "") out.push({ type: "swap", i, j });
    return out;
  }
  const result = (s) => (s.explored && straight(s) ? "win" : null);

  /** The fewest swaps any permutation needs: its size minus its number of cycles. */
  const dist = (perm) => { const seen = new Array(perm.length).fill(false); let cycles = 0; for (let i = 0; i < perm.length; i++) if (!seen[i]) { cycles++; for (let j = i; !seen[j]; j = perm[j]) seen[j] = true; } return perm.length - cycles; };

  /**
   * A way to undo the mix-up: a list of swaps [i, j], each involving X or Y and no pair twice (the Futurama theorem says
   * one always exists). Found by iterative deepening on the length: a sequence of L swaps can only exist if L is the
   * distance (size minus cycles) plus twice the number of swaps that join cycles, so budgets D + 2, D + 4, ... are tried in turn, and a swap is
   * only allowed when the distance from the identity can still be covered. Returns null if none is found within the node limit.
   */
  function solve(s, limit) {
    let nodes = 0; const max = limit || 400000;
    const start0 = { ...s, stack: [], message: "" };
    const d0 = dist(start0.perm);
    if (d0 === 0) return [];
    for (let budget = d0 + 2; budget <= d0 + 12; budget += 2) {
      const failed = new Set();
      const dfs = (t, path) => {
        const left = budget - path.length;
        if (straight(t)) return path;
        const d = dist(t.perm);
        if (d > left || nodes > max) return null;
        const key = t.perm.join() + "|" + t.usedX.slice().sort().join() + "|" + t.usedY.slice().sort().join() + "|" + left;
        if (failed.has(key)) return null;
        nodes++;
        const options = legalMoves(t).map((m) => { const t2 = swap(t, m.i, m.j); return { m, t2, d2: dist(t2.perm) }; }).filter((o) => o.d2 <= left - 1).sort((a, b) => a.d2 - b.d2);
        for (const o of options) { const r = dfs(o.t2, path.concat([[o.m.i, o.m.j]])); if (r) return r; }
        failed.add(key);
        return null;
      };
      const r = dfs(start0, []);
      if (r) return r;
      if (nodes > max) return null;
    }
    return null;
  }

  return { MIN_N, MAX_N, START_N, MESSAGES, start, straight, why, swap, move, legalMoves, result, solve };
})();
