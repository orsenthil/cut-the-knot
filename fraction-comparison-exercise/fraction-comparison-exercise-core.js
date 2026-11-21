"use strict";

/*
 * Compare fractions, interactive practice: Alexander Bogomolny's applet FractionComparisonExercise.
 *
 * Two random fractions are shown; press <, = or > to say how the first compares with the second. The pair
 * is generated exactly as in the sibling applet FCExercise (read off the bytecode): denominators 5 to 9;
 * numerators 5 to 9, or, half the time, from half the denominator up to just under it (proper fractions); one
 * time in ten the second is the first multiplied top and bottom by 2 or 3 (equal values); half the time both
 * are reduced; the two always differ as written. Problems counts each pair shown, Correct Answers each right
 * answer; one answer is allowed per pair. Right: "Correct!"; wrong: "Oops... a/b sign c/d!" with the true
 * relation. "Show graphics" draws each fraction as a bar, and "Use common denominator" (only with the graphics)
 * cuts both bars into the least common denominator's parts. The position is plain data.
 */
const FractionComparisonExerciseCore = (() => {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const lcm = (a, b) => (a * b) / gcd(a, b);
  const SIGNS = ["<", "=", ">"];

  function rng(seed) {
    let s = (Math.imul(Math.trunc(Number(seed)) || 1, 2654435761) ^ 0x5bd1e995) >>> 0; // spread nearby seeds apart
    const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    next(); next(); next();
    return next;
  }

  /** GetProblem: the pair. */
  function problem(next) {
    const base = 10;
    const proper = next() < 0.5;
    let n1 = 0, d1 = 0, n2 = 0, d2 = 0;
    while (n1 === n2 && d1 === d2) {
      d1 = Math.trunc(next() * base / 2 + Math.trunc(base / 2));
      n1 = proper ? Math.trunc(next() * d1 / 2 + Math.trunc(d1 / 2)) : Math.trunc(next() * base / 2 + Math.trunc(base / 2));
      if (next() < 0.9) {
        d2 = Math.trunc(next() * base / 2 + Math.trunc(base / 2));
        n2 = proper ? Math.trunc(next() * d2 / 2 + Math.trunc(d2 / 2)) : Math.trunc(next() * base / 2 + Math.trunc(base / 2));
      } else {
        const k = next() < 0.5 ? 2 : 3;
        n2 = n1 * k; d2 = d1 * k;
      }
      if (next() < 0.5) {
        const g1 = gcd(n1, d1); n1 /= g1; d1 /= g1;
        const g2 = gcd(n2, d2); n2 /= g2; d2 /= g2;
      }
    }
    return { n1, d1, n2, d2 };
  }

  /** The true relation: 0 for <, 1 for =, 2 for >. */
  const relation = (p) => (p.n1 * p.d2 === p.n2 * p.d1 ? 1 : p.n1 * p.d2 > p.n2 * p.d1 ? 2 : 0);

  /** A new exercise (the first pair counts as problem 1). Options: seed, or a pair n1 d1 n2 d2. */
  function start(options) {
    const o = options || {};
    const seed = o.seed === undefined ? 4711 : o.seed;
    const p = o.n1 ? { n1: o.n1, d1: o.d1, n2: o.n2, d2: o.d2 } : problem(rng(seed));
    return { ...p, problems: 1, solved: 0, answered: -1, graphics: !!o.graphics, common: false, seed, moves: 0 };
  }

  /** The message after answering. */
  function remark(s) {
    if (s.answered < 0) return "";
    return s.answered === relation(s) ? "Correct!" : `Oops... ${s.n1}/${s.d1} ${SIGNS[relation(s)]} ${s.n2}/${s.d2}!`;
  }

  /** Moves: {type:"answer", sign:0|1|2}, {type:"next", seed}, {type:"restart", seed}, {type:"graphics", value}, {type:"common", value}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "answer") {
      if (s.answered >= 0 || !(m.sign === 0 || m.sign === 1 || m.sign === 2)) return null;
      return { ...s, answered: m.sign, solved: s.solved + (m.sign === relation(s) ? 1 : 0), moves: s.moves + 1 };
    }
    if (m.type === "next") return { ...s, ...problem(rng(m.seed)), problems: s.problems + 1, answered: -1, seed: m.seed };
    if (m.type === "restart") return start({ seed: m.seed, graphics: s.graphics });
    if (m.type === "graphics") return { ...s, graphics: !!m.value, common: m.value ? s.common : false };
    if (m.type === "common") return s.graphics ? { ...s, common: !!m.value } : null;
    return null;
  }

  const legalMoves = (s) => (s.answered >= 0 ? [{ type: "next" }] : [0, 1, 2].map((sign) => ({ type: "answer", sign })));
  /** "win" after a right answer, "lose" after a wrong one. */
  const result = (s) => (s.answered < 0 ? null : s.answered === relation(s) ? "win" : "lose");

  return { SIGNS, gcd, lcm, rng, problem, relation, start, remark, move, legalMoves, result };
})();
