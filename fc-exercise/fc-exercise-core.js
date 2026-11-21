"use strict";

/*
 * Fraction comparison, sped up: Alexander Bogomolny's exercise applet FCExercise.
 *
 * Two fractions a/c and b/d are shown with a third, middle fraction n/d that you change
 * digit by digit. The task: make the middle fraction lie between the two, which is the
 * page's trick: compare two fractions by finding an obvious fraction (the simpler the
 * better) that sits between them, say 7/12 > 1/2 > 4/9. When you press Check, the applet
 * shows the two comparison signs and says "Correct!" or "Oops...".
 *
 * Read off the bytecode:
 *   GetProblem: with probability 1/2 the numerators are between half the denominator and the
 *   denominator (proper fractions), otherwise 5..9; denominators are 5..9; with probability 1/10
 *   the second fraction is the first one multiplied by 2 or 3 top and bottom (equal values);
 *   with probability 1/2 both are then reduced; and the pair must differ as written. The first
 *   guess for the middle fraction is always just outside the pair (it moves one of the fractions
 *   by 1 or 2 in numerator and the opposite way in the denominator).
 *   CheckAnswer: right when the middle fraction is not outside the pair (the two cross products
 *   N1 D0 - N0 D1 and N0 D2 - N2 D0 do not have the signs of an outsider).
 *   "Use common denominator" writes both fractions over the least common denominator, "Simplify"
 *   reduces all three. Problems counts every pair shown, Correct Answers every right check.
 * The applet lets a middle fraction with denominator 0 be checked; here Check refuses it. The
 * digits go from 0 to 99 in both middle numbers. The position is plain data.
 */
const FcExerciseCore = (() => {
  const MAX_VALUE = 99;

  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

  function rng(seed) {
    let s = (Math.imul(Math.trunc(Number(seed)) || 1, 2654435761) ^ 0x5bd1e995) >>> 0; // spread nearby seeds apart
    const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    next(); next(); next();
    return next;
  }

  /** GetProblem: the pair and the first (wrong) guess for the middle fraction. */
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
    let n0, d0;
    const pick = () => (next() < 0.5 ? 1 : 2);
    if (n1 * d2 > n2 * d1) {
      if (next() < 0.5) { n0 = n1 + pick(); d0 = d1 - pick(); if (d0 <= 0) d0 = 1; }
      else { n0 = n2 - pick(); d0 = d2 + pick(); if (n0 <= 0) n0 = 1; }
    } else if (next() < 0.5) { n0 = n1 - pick(); d0 = d1 + pick(); if (n0 <= 0) n0 = 1; }
    else { n0 = n2 + pick(); d0 = d2 - pick(); if (d0 <= 0) d0 = 1; }
    return { n1, d1, n2, d2, n0, d0 };
  }

  /** A new exercise (the first pair counts as problem 1). Options: seed, or a pair and guess to start from. */
  function start(options) {
    const o = options || {};
    const p = o.n1 ? { n1: o.n1, d1: o.d1, n2: o.n2, d2: o.d2, n0: o.n0 === undefined ? 1 : o.n0, d0: o.d0 === undefined ? 1 : o.d0 } : problem(rng(o.seed === undefined ? 8080 : o.seed));
    return { ...p, problems: 1, solved: 0, checked: false, response: "", seed: o.seed === undefined ? 8080 : o.seed, moves: 0 };
  }

  /** The sign (-1, 0, 1) of a/b against c/d for positive b, d. */
  const cmp = (a, b, c, d) => Math.sign(a * d - c * b);

  /** The two signs shown after Check: first fraction against the middle, middle against the second. */
  const signs = (s) => ({ first: cmp(s.n1, s.d1, s.n0, s.d0), second: cmp(s.n0, s.d0, s.n2, s.d2) });

  /** CheckAnswer, branch by branch as in the bytecode. */
  function correct(s) {
    const a = s.n1 * s.d0 - s.n0 * s.d1, b = s.n0 * s.d2 - s.n2 * s.d0;
    if (a >= 0 && b > 0) return true;
    if (a <= 0 && b < 0) return true;
    if (a > 0 && b >= 0) return true;
    if (a < 0 && b <= 0) return true;
    return a === 0 && b === 0;
  }

  const lcm = (a, b) => (a * b) / gcd(a, b);

  /** Moves: {type:"digit", which:"n0"|"d0", place:0|1}, {type:"check"}, {type:"next", seed}, {type:"restart", seed}, {type:"common"}, {type:"simplify"}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "digit") {
      if ((m.which !== "n0" && m.which !== "d0") || (m.place !== 0 && m.place !== 1) || s.checked) return null;
      const unit = 10 ** m.place, cur = s[m.which], dgt = Math.floor(cur / unit) % 10;
      return { ...s, [m.which]: cur - dgt * unit + ((dgt + 1) % 10) * unit, moves: s.moves + 1 };
    }
    if (m.type === "set") {
      const v = Math.trunc(Number(m.value));
      if ((m.which !== "n0" && m.which !== "d0") || !(v >= 0 && v <= MAX_VALUE) || s.checked) return null;
      return { ...s, [m.which]: v, moves: s.moves + 1 };
    }
    if (m.type === "check") {
      if (s.checked || s.d0 < 1) return null;
      const ok = correct(s);
      return { ...s, checked: true, response: ok ? "Correct!" : "Oops...", solved: s.solved + (ok ? 1 : 0), moves: s.moves + 1 };
    }
    if (m.type === "next") {
      const p = problem(rng(m.seed));
      return { ...s, ...p, problems: s.problems + 1, checked: false, response: "", seed: m.seed };
    }
    if (m.type === "restart") return { ...start({ seed: m.seed }) };
    if (m.type === "common") {
      if (s.checked) return null;
      const l = lcm(s.d1, s.d2);
      return { ...s, n1: s.n1 * (l / s.d1), d1: l, n2: s.n2 * (l / s.d2), d2: l, moves: s.moves + 1 };
    }
    if (m.type === "simplify") {
      if (s.checked) return null;
      const r = (n, d) => { const g = n > 0 && d > 0 ? gcd(n, d) : 1; return g > 1 ? [n / g, d / g] : [n, d]; };
      const [n1, d1] = r(s.n1, s.d1), [n2, d2] = r(s.n2, s.d2), [n0, d0] = r(s.n0, s.d0);
      return { ...s, n1, d1, n2, d2, n0, d0, moves: s.moves + 1 };
    }
    return null;
  }

  const legalMoves = (s) => (s.checked ? [{ type: "next" }] : [{ type: "check" }, { type: "common" }, { type: "simplify" }]);
  /** "win" once a pair has been answered correctly, "lose" once it has been answered wrongly (the page lets you go on to the next pair). */
  const result = (s) => (s.checked ? (s.response === "Correct!" ? "win" : "lose") : null);

  return { MAX_VALUE, start, problem, rng, correct, signs, cmp, gcd, lcm, move, legalMoves, result };
})();
