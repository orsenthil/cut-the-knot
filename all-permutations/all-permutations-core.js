"use strict";

/*
 * Counting And Listing All Permutations, from Bogomolny's applet AllPerm.
 *
 * The board lists every permutation of 1..n, each also written as a product of
 * cycles. Three generators are offered, following the applet's three radio
 * buttons: a Recursive visit (R), the Lexicographic next-permutation step (L)
 * and B. Heap's algorithm (H). The cycle string is built the way CTKAlgebra's
 * Permutation.toCycles does: walk from each unvisited index until it repeats.
 *
 * The key idea is that all three produce exactly n! rows, all different, even
 * though their orders differ. The logic test checks that on every n up to 7,
 * compares each order with a second transcription of the applet's method, and
 * counts derangements from the listed rows.
 *
 * No document, no window, no storage: one global, AllPermutationsCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const AllPermutationsCore = (() => {
  const MIN_N = 1;
  const MAX_N = 8;
  const ALGORITHMS = ["recursive", "lexicographic", "heap"];

  function factorial(n) {
    let result = 1;
    for (let k = 2; k <= n; k++) result *= k;
    return result;
  }

  function clampN(value) {
    const v = Math.trunc(Number(value));
    return Number.isFinite(v) ? Math.max(MIN_N, Math.min(MAX_N, v)) : 3;
  }

  /** Recursive visit(k): fill the first unused slot, then recurse. */
  function recursive(n) {
    const out = [];
    const value = Array(n).fill(0);
    let level = -1;
    const visit = (k) => {
      level++;
      value[k] = level;
      // The applet's visit runs to level == N, so its raw values are 1..N;
      // adding one (as it does) would print 2..N+1, contradicting the page.
      if (level === n) out.push(value.slice());
      else for (let i = 0; i < n; i++) if (value[i] === 0) visit(i);
      level--;
      value[k] = 0;
    };
    if (n > 0) visit(0);
    return out;
  }

  /** Dijkstra's next-permutation, starting at the identity. */
  function lexicographic(n) {
    const out = [];
    if (n === 0) return [[]];
    const value = Array.from({ length: n }, (_, i) => i + 1);
    const swap = (a, b) => {
      const t = value[a];
      value[a] = value[b];
      value[b] = t;
    };
    out.push(value.slice());
    for (let remaining = factorial(n) - 1; remaining > 0; remaining--) {
      let i = n - 1;
      while (value[i - 1] >= value[i]) i--;
      let j = n;
      while (value[j - 1] <= value[i - 1]) j--;
      swap(i - 1, j - 1);
      for (let a = i, b = n - 1; a < b; a++, b--) swap(a, b);
      out.push(value.slice());
    }
    return out;
  }

  /** B. Heap's algorithm: recurse, then swap(0, n-1) or swap(i, n-1). */
  function heap(n) {
    const out = [];
    const value = Array.from({ length: n }, (_, i) => i + 1);
    const swap = (a, b) => {
      const t = value[a];
      value[a] = value[b];
      value[b] = t;
    };
    const permute = (size) => {
      if (size === 1) {
        out.push(value.slice());
        return;
      }
      for (let i = 0; i < size; i++) {
        permute(size - 1);
        if (size % 2 === 1) swap(0, size - 1);
        else swap(i, size - 1);
      }
    };
    if (n > 0) permute(n);
    return out;
  }

  function generate(n, algorithm) {
    const size = clampN(n);
    if (algorithm === "lexicographic") return lexicographic(size);
    if (algorithm === "heap") return heap(size);
    return recursive(size);
  }

  /** Cycle notation, including fixed points, as the applet prints it. */
  function cycles(permutation) {
    const n = permutation.length;
    const used = Array(n).fill(false);
    let text = "";
    while (true) {
      let i = -1;
      for (let k = 0; k < n; k++) if (!used[k]) { i = k; break; }
      if (i < 0) break;
      text += "(";
      let at = i;
      let first = true;
      while (!used[at]) {
        const label = at + 1;
        text += first ? String(label) : " " + String(label);
        first = false;
        used[at] = true;
        at = permutation[at] - 1;
      }
      text += ")";
    }
    return text;
  }

  function isDerangement(permutation) {
    return permutation.every((value, i) => value !== i + 1);
  }

  function formatRow(permutation, showCycles) {
    const numbers = permutation.join(" ");
    return showCycles ? `${numbers}  ${cycles(permutation)}` : numbers;
  }

  return {
    MIN_N, MAX_N, ALGORITHMS, factorial, clampN, recursive, lexicographic, heap,
    generate, cycles, isDerangement, formatRow,
  };
})();
