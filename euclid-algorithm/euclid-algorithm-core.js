"use strict";

/*
 * Euclid's algorithm, from Alexander Bogomolny's applet EuclidAlgorithm.
 *
 * For N >= M > 0 write N = M s + R with 0 <= R < M. A common divisor of N and M divides
 * R, and a common divisor of M and R divides N, so gcd(N, M) = gcd(M, R). The remainders
 * decrease, so after finitely many steps one is 0, and the last divisor is the gcd.
 *
 * The applet shows two numbers of 1 to 4 digits (opening on 2, random with a non-zero
 * first digit), changed by clicking their digits ("Autonomous digits": a digit changes by
 * itself, otherwise the whole number goes up by its place value) and lists the division
 * steps "N = M x s + R", down to "N = M x s", and "gcd(N, M) = g". If the first number is
 * smaller they are swapped before the steps (Compute), and with a 0 it shows "?".
 * The position is plain data; functions return new objects.
 */
const EuclidAlgorithmCore = (() => {
  const MIN_DIGITS = 1;
  const MAX_DIGITS = 4;

  function rng(seed) {
    let s = (Math.trunc(Number(seed)) || 1) >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function randomNumber(n, next) {
    let v = 1 + Math.floor(next() * 9);
    for (let i = 1; i < n; i++) v = v * 10 + Math.floor(next() * 10);
    return v;
  }

  /** A new position: `digits` digits (1..4, opening on 2) and two random numbers, or a and b given. */
  function start(options) {
    const o = options || {};
    const digits = Number.isFinite(Number(o.digits)) ? Math.max(MIN_DIGITS, Math.min(MAX_DIGITS, Math.trunc(Number(o.digits)))) : 2;
    const next = rng(o.seed === undefined ? 31337 : o.seed);
    const lim = 10 ** digits - 1;
    const fit = (v, d) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(lim, Math.trunc(Number(v)))) : d);
    return { digits, a: fit(o.a, randomNumber(digits, next)), b: fit(o.b, randomNumber(digits, next)), autonomous: o.autonomous !== false, moves: 0, explored: false };
  }

  /** The division steps for the two numbers (larger first): [{n, m, q, r}], and the gcd (null when a number is 0). */
  function steps(a, b) {
    let n = Math.max(a, b), m = Math.min(a, b);
    const out = [];
    if (m === 0) return { steps: out, gcd: null, big: n, small: m };
    while (true) {
      const q = Math.floor(n / m), r = n % m;
      out.push({ n, m, q, r });
      if (r === 0) return { steps: out, gcd: m, big: Math.max(a, b), small: Math.min(a, b) };
      n = m; m = r;
    }
  }

  /** The lines as the applet writes them: "N = M x s + R", ..., and the gcd line. */
  function lines(s) {
    const t = steps(s.a, s.b);
    const text = t.steps.map((x) => `${x.n} = ${x.m} x ${x.q}` + (x.r === 0 ? "" : ` + ${x.r}`));
    text.push(`gcd(${t.big}, ${t.small}) = ${t.gcd === null ? "?" : t.gcd}`);
    return text;
  }

  /**
   * Moves: {type:"digit", which:"a"|"b", place} (place 0 = units), {type:"set", which, value},
   * {type:"digits", value, seed}, {type:"autonomous", value}, {type:"reset", seed}.
   */
  function move(s, m) {
    if (!m) return null;
    const lim = 10 ** s.digits - 1;
    if (m.type === "digit") {
      if ((m.which !== "a" && m.which !== "b") || !(m.place >= 0 && m.place < s.digits)) return null;
      const unit = 10 ** m.place, cur = s[m.which];
      const v = s.autonomous ? cur - (Math.floor(cur / unit) % 10) * unit + ((Math.floor(cur / unit) % 10 + 1) % 10) * unit : (cur + unit) % (lim + 1);
      return { ...s, [m.which]: v, moves: s.moves + 1, explored: true };
    }
    if (m.type === "set") {
      const v = Math.trunc(Number(m.value));
      if ((m.which !== "a" && m.which !== "b") || !(v >= 0 && v <= lim)) return null;
      return { ...s, [m.which]: v, moves: s.moves + 1, explored: true };
    }
    if (m.type === "digits") {
      const n = Math.trunc(Number(m.value));
      if (!(n >= MIN_DIGITS && n <= MAX_DIGITS)) return null;
      return { ...start({ digits: n, seed: m.seed, autonomous: s.autonomous }), moves: s.moves + 1, explored: s.explored };
    }
    if (m.type === "autonomous") return { ...s, autonomous: !!m.value };
    if (m.type === "reset") return start({ digits: s.digits, seed: m.seed, autonomous: s.autonomous });
    return null;
  }

  const legalMoves = (s) => ["a", "b"].flatMap((which) => Array.from({ length: s.digits }, (_, place) => ({ type: "digit", which, place })));
  const result = (s) => (s.explored ? "done" : null);

  return { MIN_DIGITS, MAX_DIGITS, start, steps, lines, move, legalMoves, result };
})();
