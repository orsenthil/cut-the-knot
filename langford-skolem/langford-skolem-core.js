"use strict";

/*
 * Langford and Skolem Sequences, from Bogomolny's applet LangfordSequence.
 *
 * Place M copies of each number k from D to N in a row so that consecutive
 * copies are k + (1 for Langford, 0 for Skolem) positions apart. Holes are
 * empty cells; a hooked sequence has one hole just before the last cell.
 * Solving is done by backtracking, placing the largest numbers first.
 *
 * The key idea is that the spacing condition pins each copy once the first
 * position is chosen, so a depth-first search quickly finds or rules out an
 * arrangement. The logic test checks the classic examples, the existence
 * congruence (Langford n ≡ 0,3 mod 4; Skolem n ≡ 0,1 mod 4) and that every
 * sequence the solver returns really satisfies the spacing rule.
 *
 * No document, no window, no storage: one global, LangfordSkolemCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const LangfordSkolemCore = (() => {
  const MIN_N = 1;
  const MAX_N = 12;

  const clamp = (v, lo, hi, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
  };

  function start() {
    return { N: 4, D: 1, M: 2, H: 0, kind: "langford" };
  }

  function spacing(k, kind) {
    return k + (kind === "langford" ? 1 : 0);
  }

  function totalLength(params) {
    return params.M * (params.N - params.D + 1) + params.H;
  }

  function holePositions(params) {
    const len = totalLength(params);
    if (params.H === 0) return [];
    if (params.H === 1) return [len - 2]; // hooked: next to last
    return Array.from({ length: params.H }, (_, i) => len - 1 - i);
  }

  /** Depth-first search for an arrangement, largest value first. */
  function solve(params, limit = 200000) {
    const N = clamp(params.N, MIN_N, MAX_N, 4);
    const D = clamp(params.D, 1, N, 1);
    const M = params.M === 3 ? 3 : 2;
    const H = clamp(params.H, 0, 2, 0);
    const kind = params.kind === "skolem" ? "skolem" : "langford";
    const p = { N, D, M, H, kind };
    const len = totalLength(p);
    const cells = Array(len).fill(0);
    holePositions(p).forEach((i) => { if (i >= 0 && i < len) cells[i] = -1; });
    const values = [];
    for (let k = N; k >= D; k--) values.push(k);
    let visited = 0;

    function place(index) {
      if (index === values.length) return true;
      const k = values[index];
      const gap = spacing(k, kind); // positions differ by gap for consecutive copies
      const positions = Array.from({ length: M }, (_, j) => j * gap);
      const last = positions[M - 1];
      for (let at = 0; at + last < len; at++) {
        visited++;
        if (visited > limit) return false;
        const slots = positions.map((d) => at + d);
        if (slots.some((s) => cells[s] !== 0)) continue;
        slots.forEach((s) => { cells[s] = k; });
        if (place(index + 1)) return true;
        slots.forEach((s) => { cells[s] = 0; });
      }
      return false;
    }

    const found = place(0);
    return { params: p, length: len, sequence: found ? cells.slice() : null, visited };
  }

  function validate(sequence, params) {
    if (!sequence || sequence.length !== totalLength(params)) return { valid: false, why: "wrong length" };
    const gapFor = (k) => spacing(k, params.kind);
    for (let k = params.D; k <= params.N; k++) {
      const at = [];
      sequence.forEach((v, i) => { if (v === k) at.push(i); });
      if (at.length !== params.M) return { valid: false, why: `number ${k} appears ${at.length} times` };
      for (let i = 1; i < at.length; i++) {
        if (at[i] - at[i - 1] !== gapFor(k)) return { valid: false, why: `spacing of ${k} is wrong` };
      }
    }
    const holes = sequence.filter((v) => v === -1).length;
    return { valid: holes === params.H, why: holes === params.H ? "ok" : "wrong number of holes" };
  }

  /** n mod 4 existence condition for perfect defect-1 pairs. */
  function exists(n, kind) {
    const r = ((n % 4) + 4) % 4;
    return kind === "langford" ? (r === 0 || r === 3) : (r === 0 || r === 1);
  }

  function decode(text) {
    return text.split("").map((c) => (c === "*" || c === "_" ? -1 : Number(c)));
  }
  function encode(sequence) {
    return sequence.map((v) => (v === -1 ? "*" : String(v))).join("");
  }

  function setParam(state, key, value) {
    const next = { ...state, [key]: value };
    if (key === "N") next.N = clamp(value, MIN_N, MAX_N, state.N);
    if (key === "D") next.D = clamp(value, 1, next.N, state.D);
    if (key === "M") next.M = value === 3 ? 3 : 2;
    if (key === "H") next.H = clamp(value, 0, 2, state.H);
    return next;
  }

  function analyze(state) {
    const solution = solve(state);
    return {
      params: solution.params,
      solution: solution.sequence,
      text: solution.sequence ? encode(solution.sequence) : "",
      validation: validate(solution.sequence, solution.params),
      visited: solution.visited,
      exists: exists(state.N, state.kind),
    };
  }

  return { MIN_N, MAX_N, clamp, start, spacing, totalLength, holePositions, solve, validate, exists, decode, encode, setParam, analyze };
})();
