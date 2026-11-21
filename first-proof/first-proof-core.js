"use strict";

/*
 * Heads and tails, from Alexander Bogomolny's applet FirstProof.
 *
 * n pins form a polygon (a triangle for n = 3). Each pin has a blunt end, the head, and a pointed
 * end, the tail. Where two pins meet they meet head to head (HH), head to tail (HT) or tail to tail
 * (TT). For a triangle: either all three vertices are the same (all HT) or all are different (one of
 * each). The generalisation the page asks for: for any n, the numbers of HH and TT vertices are
 * always equal (so HT = n - 2 HH). Flipping one pin changes HH and TT together, by one each way, and
 * HT by two the other way, or not at all; and flipping pins from the all-the-same start reaches every
 * pattern.
 *
 * The applet: n from 3 to 50 (opening on 3), changed by pressing the number; every pin starts
 * "direct" (all head to tail: HT = n, HH = TT = 0); a click on a pin flips it; the counts are shown
 * only when the "Hint" box is ticked. Vertex i joins pin i and pin i + 1 (mod n); with direct(i) the
 * pin's head is at vertex i + 1 and its tail at vertex i. The vertex is
 *   HT when both pins are direct or both are flipped,
 *   HH when pin i is direct and pin i + 1 is flipped (two heads meet),
 *   TT when pin i is flipped and pin i + 1 is direct (two tails meet).
 * The position is plain data.
 */
const FirstProofCore = (() => {
  const MIN_N = 3;
  const MAX_N = 50;

  /** A new position: n pins, all direct. */
  function start(options) {
    const o = options || {};
    const n = Number.isFinite(Number(o.n)) ? Math.max(MIN_N, Math.min(MAX_N, Math.trunc(Number(o.n)))) : MIN_N;
    const direct = Array.isArray(o.direct) && o.direct.length === n ? o.direct.map(Boolean) : new Array(n).fill(true);
    return { n, direct, hint: !!o.hint, moves: 0, explored: false };
  }

  /** What each vertex is: for vertex i, "HT", "HH" or "TT" (the pins i and i + 1). */
  function vertices(s) {
    return s.direct.map((d1, i) => {
      const d2 = s.direct[(i + 1) % s.n];
      return d1 === d2 ? "HT" : d1 ? "HH" : "TT";
    });
  }

  /** The counts HH, HT, TT. */
  function counts(s) {
    const c = { hh: 0, ht: 0, tt: 0 };
    for (const v of vertices(s)) c[v.toLowerCase()]++;
    return c;
  }

  /** Moves: {type:"flip", pin} (0-based), {type:"n", value}, {type:"hint", value}, {type:"reset"}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "flip") {
      if (!(m.pin >= 0 && m.pin < s.n)) return null;
      const direct = s.direct.slice(); direct[m.pin] = !direct[m.pin];
      return { ...s, direct, moves: s.moves + 1, explored: true };
    }
    if (m.type === "n") {
      const v = Math.trunc(Number(m.value));
      if (!(v >= MIN_N && v <= MAX_N)) return null;
      return { ...start({ n: v, hint: s.hint }), moves: s.moves + 1, explored: s.explored };
    }
    if (m.type === "hint") return { ...s, hint: !!m.value };
    if (m.type === "reset") return start({ n: s.n, hint: s.hint });
    return null;
  }

  const legalMoves = (s) => s.direct.map((_, pin) => ({ type: "flip", pin }));
  const result = (s) => (s.explored ? "done" : null);

  return { MIN_N, MAX_N, start, vertices, counts, move, legalMoves, result };
})();
