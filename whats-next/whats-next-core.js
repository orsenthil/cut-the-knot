"use strict";

/*
 * What's Next? (Bogomolny's guess applet) - the sequences.
 *
 * The applet picks one of nine rules at random, picks that rule's numbers
 * at random, shows six terms and asks for the seventh. Each rule here is
 * the matching guesscanvas method read off the bytecode, with the same
 * random ranges, written as (int)(random * k) - offset exactly as the Java
 * does, and the same fix-ups (a ratio of 0 becomes -2, and so on).
 *
 * Every rule is a function of a few small integer parameters, so each one
 * is split into params(rnd), which draws them, and build(p), which makes
 * the six terms and the answer. That lets porting/check-whats-next.mjs
 * enumerate every sequence the applet can show.
 *
 * Two things the bytecode does that the cut-the-knot page does not say:
 * the arithmetic progression's start and difference are both drawn from
 * -11 .. 0, and "Shifted powers" always uses a shift of 0, so it is really
 * a geometric progression too. The port keeps both.
 */

var GuessCore = (function () {
  const TERMS = 6; // m_nTerms

  const draw = (rnd, k, offset) => Math.trunc(rnd() * k) + offset;

  /** Look-and-say: read the digits of s in runs, "count then digit". */
  function lookAndSay(s) {
    let out = "";
    let run = 1;
    for (let j = 1; j <= s.length; j++) {
      if (j < s.length && s[j] === s[j - 1]) {
        run++;
      } else {
        out += String(run) + s[j - 1];
        run = 1;
      }
    }
    return out;
  }

  /** Six terms of t(n) for n = 0..5 and the answer t(6). */
  function fromFormula(t) {
    const terms = [];
    for (let n = 0; n < TERMS; n++) terms.push(String(t(n)));
    return { terms, answer: String(t(TERMS)) };
  }

  /** Six terms of a recurrence started from `first`, and the next one. */
  function fromRecurrence(first, next) {
    const seq = first.slice();
    while (seq.length <= TERMS) seq.push(next(seq));
    return { terms: seq.slice(0, TERMS).map(String), answer: String(seq[TERMS]) };
  }

  const RULES = [
    {
      // AProgression(): a0 and d both (int)(random*12) - 11.
      name: "Arithmetic progression",
      params: (rnd) => ({ a: draw(rnd, 12, -11), d: draw(rnd, 12, -11) }),
      build: ({ a, d }) => fromFormula((n) => a + n * d),
    },
    {
      // GProgression(): a0 in -3..4 (0 -> -1); q in -3..3 (0 -> -2, 1 -> -1).
      name: "Geometric progression",
      params: (rnd) => {
        let a = draw(rnd, 8, -3);
        let q = draw(rnd, 7, -3);
        if (a === 0) a = -1;
        if (q === 0) q = -2;
        if (q === 1) q = -1;
        return { a, q };
      },
      build: ({ a, q }) => fromRecurrence([a], (s) => s[s.length - 1] * q),
    },
    {
      // Fibonacci(): a0 in -3..3, a1 in 1..7.
      name: "Sum of preceding two",
      params: (rnd) => ({ a: draw(rnd, 7, -3), b: draw(rnd, 7, 1) }),
      build: ({ a, b }) => fromRecurrence([a, b], (s) => s[s.length - 1] + s[s.length - 2]),
    },
    {
      // SumOfThree(): a0 in -3..3, a1 and a2 in 1..7.
      name: "Three terms sum sequence",
      params: (rnd) => ({ a: draw(rnd, 7, -3), b: draw(rnd, 7, 1), c: draw(rnd, 7, 1) }),
      build: ({ a, b, c }) =>
        fromRecurrence([a, b, c], (s) => s[s.length - 1] + s[s.length - 2] + s[s.length - 3]),
    },
    {
      // SelfReference(): a digit 1..3, and half the time a second one.
      name: "Self-descriptive sequence",
      params: (rnd) => {
        let seed = String(draw(rnd, 3, 1));
        if (Math.trunc(rnd() * 2) === 0) seed += String(draw(rnd, 3, 1));
        return { seed };
      },
      build: ({ seed }) => {
        const seq = [seed];
        while (seq.length <= TERMS) seq.push(lookAndSay(seq[seq.length - 1]));
        return { terms: seq.slice(0, TERMS), answer: seq[TERMS] };
      },
    },
    {
      // Powers(): q in -5..3 (0 -> -2, 1 -> 2); b in -5..5 (0 -> -1); the shift is 0.
      name: "Shifted powers",
      params: (rnd) => {
        let q = draw(rnd, 9, -5);
        let b = draw(rnd, 11, -5);
        if (q === 0) q = -2;
        if (q === 1) q = 2;
        if (b === 0) b = -1;
        return { b, q };
      },
      build: ({ b, q }) => fromFormula((n) => 0 + b * q ** n),
    },
    {
      // Alternate(): d in -5..3 (0 -> -1), q in -3..2, a0 in -6..4; add on odd steps.
      name: "Alternate addition and multiplication",
      params: (rnd) => {
        let d = draw(rnd, 9, -5);
        const q = draw(rnd, 6, -3);
        const a = draw(rnd, 11, -6);
        if (d === 0) d = -1;
        return { a, d, q };
      },
      build: ({ a, d, q }) =>
        fromRecurrence([a], (s) => (s.length % 2 === 1 ? s[s.length - 1] + d : s[s.length - 1] * q)),
    },
    {
      // Alternate2(): da in -5..3 (0 -> -1), db in -7..5, a0 in -6..4.
      name: "Alternate addition of two different quantities",
      params: (rnd) => {
        let da = draw(rnd, 9, -5);
        const db = draw(rnd, 13, -7);
        const a = draw(rnd, 11, -6);
        if (da === 0) da = -1;
        return { a, da, db };
      },
      build: ({ a, da, db }) =>
        fromRecurrence([a], (s) => s[s.length - 1] + (s.length % 2 === 1 ? da : db)),
    },
    {
      // Degree2(): a in -5..3 (0 -> -1), b in -3..2, c in -6..4; t(n) = c + (b + a n) n.
      name: "Second degree polynomial",
      params: (rnd) => {
        let a = draw(rnd, 9, -5);
        const b = draw(rnd, 6, -3);
        const c = draw(rnd, 11, -6);
        if (a === 0) a = -1;
        return { a, b, c };
      },
      build: ({ a, b, c }) => fromFormula((n) => c + (b + a * n) * n),
    },
  ];

  /** New(): a random rule, random numbers, six terms and the answer. */
  function generate(rnd = Math.random) {
    const rule = RULES[Math.trunc(rnd() * RULES.length)];
    const p = rule.params(rnd);
    return { rule: rule.name, ...rule.build(p) };
  }

  /** Check(): the applet compares the typed text with the answer exactly; spaces are trimmed here. */
  function isRight(round, typed) {
    return typed.trim() === round.answer;
  }

  return { TERMS, RULES, lookAndSay, generate, isRight };
})();
