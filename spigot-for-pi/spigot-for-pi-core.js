"use strict";

/*
 * The Spigot Algorithm for Pi, from Alexander Bogomolny's applet
 * SpigotForPi: the algorithm of Rabinowitz and Wagon.
 *
 * pi = 2 + 1/3 (2 + 2/5 (2 + 3/7 (2 + ...))): in the mixed-radix system with
 * "digits" worth 1/3, 2/5, 3/7, ..., pi is written 2.2222... The algorithm
 * converts that to base 10, one digit at a time, the way you convert any
 * number between bases: multiply every place by 10, carry from right to left
 * (place i holds less than 2i + 1 and carries (i - 1)/(2i - 1) of what
 * overflows), and the leftmost place yields the next decimal digit. A digit
 * of 10 now and then means a carry into digits already found, so digits are
 * held back while they are 9s ("predigits") and released once it is safe.
 *
 * Transcribed from PiSpigotAlgorithm.runSlow: the array has [10n/3] + 1
 * places (Arndt and Haenel's correction of [10n/3]), each starting at 2. The
 * applet computes 1000 digits to start and at most 50,000, printing them in
 * chunks of Chunk digits (1..20, 5 to start) in a font of 9..40 points.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SpigotForPiCore. The position is plain data (the array of places, while
 * it runs, is plain numbers).
 */
const SpigotForPiCore = (() => {
  const DIGITS = { min: 1, max: 50000, def: 1000 };
  const CHUNK = { min: 1, max: 20, def: 5 };
  const FONT = { min: 9, max: 40, def: 15 };

  const clamp = (v, r) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(r.min, Math.min(r.max, n)) : r.def; };

  /** InitSlowRun. `extra` changes the array length, to test the length rule. */
  function start(n, extra = 1) {
    const N = clamp(n, DIGITS);
    const len = Math.floor((10 * N) / 3) + extra;
    return { n: N, toGo: N, len, a: new Array(len).fill(2), nines: 0, p: -1, digits: "", iterations: 0, done: false };
  }

  /** One pass of runSlow's loop. Mutates `s` (the caller owns it); returns s. */
  function iterate(s) {
    if (s.toGo < 0) { s.done = true; return s; }
    const a = s.a;
    let q = 0;
    for (let i = s.len - 1; i >= 1; i--) {
      q = q + 10 * a[i];
      const d = 2 * i + 1;
      a[i] = q % d;
      q = Math.floor(q / d) * i;
    }
    q = q + 10 * a[0];
    a[0] = q % 10;
    q = Math.floor(q / 10);
    if (q === 9) s.nines++;
    else {
      if (s.p >= 0) s.digits += String(s.p + Math.floor(q / 10));
      if (s.toGo < s.nines) s.nines = s.toGo;
      s.toGo -= s.nines + 1;
      for (; s.nines > 0; s.nines--) s.digits += q === 10 ? "0" : "9";
      s.nines = 0;
      s.p = q === 10 ? 0 : q;
    }
    s.iterations++;
    if (s.toGo < 0) s.done = true;
    return s;
  }

  /** Run to the end (for tests and the tutor). */
  function run(n, extra = 1) {
    const s = start(n, extra);
    while (!s.done) iterate(s);
    return s.digits;
  }

  /** The applet's output layout: the digits in chunks. */
  function chunks(digits, size) {
    const c = clamp(size, CHUNK), out = [];
    for (let i = 0; i < digits.length; i += c) out.push(digits.slice(i, i + c));
    return out;
  }

  return { DIGITS, CHUNK, FONT, clamp, start, iterate, run, chunks };
})();
