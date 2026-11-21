"use strict";

/*
 * Egyptian multiplication, from Alexander Bogomolny's applet EgyptianMultiplication.
 *
 * To multiply a by b: write 1 in a left column and b in a right column, and keep
 * doubling both, stopping when the next power of two would pass a (the applet's
 * row count is floor(log2 a) + 1). Then pick the powers of two that add up to a,
 * found as the Rhind papyrus does it: take the largest power not above what is
 * left, subtract it, and repeat. The right-hand entries beside the chosen powers
 * add up to a*b, because a = 2^i + 2^j + ... gives a*b = 2^i b + 2^j b + ...
 *
 * The applet's numbers have 1 to 4 digits (opening on 2), and a click on a digit
 * changes it. Position is plain data; functions return new objects.
 */
const EgyptianMultiplicationCore = (() => {
  const MIN_DIGITS = 1;
  const MAX_DIGITS = 4;

  function rng(seed) {
    let s = (Math.trunc(Number(seed)) || 1) >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  /** A random number with exactly `n` digits and a non-zero first digit (GetRandomNumber). */
  function randomNumber(n, next) {
    let v = 1 + Math.floor(next() * 9);
    for (let i = 1; i < n; i++) v = v * 10 + Math.floor(next() * 10);
    return v;
  }

  /** A new position: `digits` digits (1..4, the applet opens on 2), two random numbers, or a and b given. */
  function start(options) {
    const o = options || {};
    const digits = Number.isFinite(Number(o.digits)) ? Math.max(MIN_DIGITS, Math.min(MAX_DIGITS, Math.trunc(Number(o.digits)))) : 2;
    const next = rng(o.seed === undefined ? 4242 : o.seed);
    const lim = 10 ** digits - 1;
    const fit = (v, d) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(lim, Math.trunc(Number(v)))) : d);
    const a = Math.max(1, fit(o.a, randomNumber(digits, next)));
    const b = fit(o.b, randomNumber(digits, next));
    return { digits, a, b, autonomous: o.autonomous !== false, binary: !!o.binary, moves: 0, explored: false };
  }

  /** The table for a * b: rows of {power, double, chosen}, the chosen powers, their sum and the product. */
  function table(a, b) {
    const n = Math.floor(Math.log2(a)) + 1;
    const rows = [];
    let p = 1, d = b;
    for (let i = 0; i < n; i++) { rows.push({ power: p, double: d, chosen: false }); p *= 2; d *= 2; }
    let left = a;
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].power <= left) { rows[i].chosen = true; left -= rows[i].power; }
    const chosen = rows.filter((r) => r.chosen);
    return { rows, chosen: chosen.map((r) => r.power), sumOfPowers: chosen.reduce((s, r) => s + r.power, 0), product: chosen.reduce((s, r) => s + r.double, 0), leftOver: left };
  }

  const view = (s) => ({ ...table(s.a, s.b), binary: s.a.toString(2) });

  /**
   * Moves: {type:"digit", which:"a"|"b", place} where place 0 is the units digit: in
   * autonomous mode that digit goes up by 1 (9 to 0); otherwise the whole number goes up by
   * that digit's place value, round the top;
   * {type:"set", which, value}, {type:"digits", value, seed}, {type:"autonomous"|"binary", value}, {type:"reset", seed}.
   */
  function move(s, m) {
    if (!m) return null;
    const lim = 10 ** s.digits - 1;
    if (m.type === "digit") {
      if ((m.which !== "a" && m.which !== "b") || !(m.place >= 0 && m.place < s.digits)) return null;
      const unit = 10 ** m.place, cur = s[m.which];
      let v;
      if (s.autonomous) { const dgt = Math.floor(cur / unit) % 10; v = cur - dgt * unit + ((dgt + 1) % 10) * unit; }
      else v = (cur + unit) % (lim + 1);
      if (m.which === "a" && v < 1) return null; // the first multiplicand must be at least 1
      return { ...s, [m.which]: v, moves: s.moves + 1, explored: true };
    }
    if (m.type === "set") {
      const v = Math.trunc(Number(m.value));
      if ((m.which !== "a" && m.which !== "b") || !(v >= (m.which === "a" ? 1 : 0) && v <= lim)) return null;
      return { ...s, [m.which]: v, moves: s.moves + 1, explored: true };
    }
    if (m.type === "digits") {
      const n = Math.trunc(Number(m.value));
      if (!(n >= MIN_DIGITS && n <= MAX_DIGITS)) return null;
      return { ...start({ digits: n, seed: m.seed, autonomous: s.autonomous, binary: s.binary }), moves: s.moves + 1, explored: s.explored };
    }
    if (m.type === "autonomous" || m.type === "binary") return { ...s, [m.type]: !!m.value };
    if (m.type === "reset") return start({ digits: s.digits, seed: m.seed, autonomous: s.autonomous, binary: s.binary });
    return null;
  }

  const legalMoves = (s) => ["a", "b"].flatMap((which) => Array.from({ length: s.digits }, (_, place) => ({ type: "digit", which, place })));
  const result = (s) => (s.explored ? "done" : null);

  return { MIN_DIGITS, MAX_DIGITS, start, table, view, move, legalMoves, result };
})();
