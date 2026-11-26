"use strict";

/*
 * Build an Arithmetic Circuit: an original game for the VP vs VNP path.
 *
 * An arithmetic circuit starts from variables and the constant 1, and
 * each gate adds, subtracts or multiplies two earlier results. Its size
 * is the number of gates. VP is the class of polynomial families that
 * circuits of polynomial size can compute (with polynomial degree); VNP
 * holds families like the permanent whose coefficients are "easy to
 * describe". VP = VNP would mean every such family, the permanent
 * included, has small circuits.
 *
 * The game: compute a target polynomial with as few gates as possible.
 * Each puzzle's par is the true minimum: the logic test searches every
 * circuit with fewer gates and finds none that works. Reusing a result is
 * what makes circuits strong: x^8 takes only 3 gates, x*x, then squared,
 * then squared again.
 *
 * Polynomials are maps from exponent strings ("2,0" for x^2) to integer
 * coefficients. This file defines one global, ArithmeticCircuitsCore.
 */
const ArithmeticCircuitsCore = (() => {
  /* ------------------------------------------------------- polynomials */
  const mono = (nv, i) => { const e = new Array(nv).fill(0); if (i >= 0) e[i] = 1; return new Map([[e.join(","), 1]]); };
  function add(p, q, sign = 1) {
    const r = new Map(p);
    for (const [k, c] of q) { const v = (r.get(k) || 0) + sign * c; if (v) r.set(k, v); else r.delete(k); }
    return r;
  }
  function mul(p, q) {
    const r = new Map();
    for (const [a, c] of p) for (const [b, d] of q) {
      const ea = a.split(",").map(Number), eb = b.split(",").map(Number);
      const k = ea.map((v, i) => v + eb[i]).join(",");
      const v = (r.get(k) || 0) + c * d;
      if (v) r.set(k, v); else r.delete(k);
    }
    return r;
  }
  const key = (p) => [...p].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, c]) => `${k}:${c}`).join(" ");
  const degree = (p) => Math.max(0, ...[...p.keys()].map((k) => k.split(",").reduce((s, v) => s + Number(v), 0)));
  const apply = (op, p, q) => (op === "+" ? add(p, q) : op === "-" ? add(p, q, -1) : mul(p, q));

  /** Pretty text: x²y − 2x + 1. */
  function format(p, vars) {
    if (!p.size) return "0";
    const sup = (n) => (n === 1 ? "" : String(n).split("").map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]).join(""));
    const terms = [...p].map(([k, c]) => ({ e: k.split(",").map(Number), c }));
    terms.sort((a, b) => b.e.reduce((s, v) => s + v, 0) - a.e.reduce((s, v) => s + v, 0) || b.e.join() .localeCompare(a.e.join()));
    return terms.map(({ e, c }, i) => {
      const m = e.map((v, j) => (v ? vars[j] + sup(v) : "")).join("");
      const a = Math.abs(c);
      const body = m ? (a === 1 ? m : a + m) : String(a);
      return (i === 0 ? (c < 0 ? "−" : "") : c < 0 ? " − " : " + ") + body;
    }).join("");
  }

  /* --------------------------------------------------------- puzzles */
  // Each puzzle: variables, a reference circuit (its last gate is the target), and par = its length.
  // A gate is [op, a, b] where a, b index the wires: 0 is the constant 1, then the variables, then gates.
  const PUZZLES = [
    { id: "x4", name: "x⁴", vars: ["x"], ref: [["*", 1, 1], ["*", 2, 2]] },
    { id: "x8", name: "x⁸", vars: ["x"], ref: [["*", 1, 1], ["*", 2, 2], ["*", 3, 3]] },
    { id: "sq", name: "x² + 2xy + y²", vars: ["x", "y"], ref: [["+", 1, 2], ["*", 3, 3]] },
    { id: "cube", name: "x³ + 3x² + 3x + 1", vars: ["x"], ref: [["+", 1, 0], ["*", 2, 2], ["*", 3, 2]] },
    { id: "diff", name: "x² − y²", vars: ["x", "y"], ref: [["+", 1, 2], ["-", 1, 2], ["*", 3, 4]] },
    { id: "det2", name: "2 × 2 determinant ad − bc", vars: ["a", "b", "c", "d"], ref: [["*", 1, 4], ["*", 2, 3], ["-", 5, 6]] },
    { id: "perm2", name: "2 × 2 permanent ad + bc", vars: ["a", "b", "c", "d"], ref: [["*", 1, 4], ["*", 2, 3], ["+", 5, 6]] },
    { id: "e2", name: "xy + yz + zx", vars: ["x", "y", "z"], ref: [["+", 1, 2], ["*", 4, 3], ["*", 1, 2], ["+", 5, 6]] },
  ];

  function inputs(nv) { return [mono(nv, -1), ...Array.from({ length: nv }, (_, i) => mono(nv, i))]; }

  /** The polynomials on all wires of a circuit (inputs first). */
  function wires(vars, gates) {
    const w = inputs(vars.length);
    for (const [op, a, b] of gates) w.push(apply(op, w[a], w[b]));
    return w;
  }

  const puzzle = (id) => PUZZLES.find((p) => p.id === id) || PUZZLES[0];
  function target(id) { const P = puzzle(id), w = wires(P.vars, P.ref); return w[w.length - 1]; }
  const par = (id) => puzzle(id).ref.length;

  function start(options = {}) {
    const P = puzzle(options.puzzle);
    const gates = Array.isArray(options.gates) ? options.gates.filter((g) => Array.isArray(g) && g.length === 3).map((g) => g.slice()) : [];
    return { puzzle: P.id, gates };
  }

  const MAX_GATES = 12;
  function addGate(s, op, a, b) {
    const P = puzzle(s.puzzle), n = 1 + P.vars.length + s.gates.length;
    if (!["+", "-", "*"].includes(op) || ![a, b].every((k) => Number.isInteger(k) && k >= 0 && k < n) || s.gates.length >= MAX_GATES) return null;
    return { ...s, gates: s.gates.concat([[op, a, b]]) };
  }
  const undo = (s) => (s.gates.length ? { ...s, gates: s.gates.slice(0, -1) } : null);

  /** The first gate that computes the target, or -1. */
  function reached(s) {
    const P = puzzle(s.puzzle), w = wires(P.vars, s.gates), t = key(target(s.puzzle)), k0 = 1 + P.vars.length;
    for (let i = k0; i < w.length; i++) if (key(w[i]) === t) return i - k0;
    return -1;
  }
  const result = (s) => { const r = reached(s); return r >= 0 && s.gates.length <= par(s.puzzle) ? "win" : null; };

  /** Search: is there a circuit with at most k gates computing the target? */
  function solvable(id, k) {
    const P = puzzle(id), t = key(target(id));
    const w = inputs(P.vars.length), keys = w.map(key);
    // a gate that repeats an existing wire never helps, so it is skipped
    const go = (left) => {
      if (!left) return false;
      const n = w.length;
      const tryPoly = (p) => {
        const kp = key(p);
        if (kp === t) return true;
        if (left === 1 || keys.includes(kp)) return false;
        w.push(p); keys.push(kp);
        const r = go(left - 1);
        w.pop(); keys.pop();
        return r;
      };
      for (let a = 0; a < n; a++) for (let b = a; b < n; b++) {
        if (tryPoly(add(w[a], w[b])) || tryPoly(mul(w[a], w[b]))) return true;
        if (a !== b && (tryPoly(add(w[a], w[b], -1)) || tryPoly(add(w[b], w[a], -1)))) return true;
      }
      return false;
    };
    return keys.slice(1 + P.vars.length).includes(t) || go(k);
  }

  return { PUZZLES, MAX_GATES, mono, add, mul, key, degree, apply, format, inputs, wires, puzzle, target, par, start, addGate, undo, reached, result, solvable };
})();
