"use strict";

/*
 * Base Converter — a browser port of Alexander Bogomolny's BaseConversion
 * applet (cut-the-knot.org/Curriculum/Algorithms/BaseConversion.shtml).
 *
 * Four boxes show the same number written in four bases at once. Each base
 * can be any whole number from 2 to 36. Type a number into a box (that box's
 * base is the one to read it in) and press Enter, or turn one of the four base
 * spinners, and the boxes update. There is nothing to win or lose: this is a
 * demonstration, and it counts as "done" once the player has tried it.
 *
 * Key idea: the value does not change when the base changes. We store it as
 * an exact integer part N plus a fractional part F over radix^L (L digits
 * after the point), so writing it in another base is the same value with
 * different digit symbols. The fraction is generated exactly the way the
 * applet's BigRational.ConvertFraction did — repeated multiply-and-floor in
 * double precision, at most 36 digits, then "..." for a repeating tail.
 * Officially the page says bases run 2..36, accept negatives and fractions,
 * and show the number in four bases at once; the logic test checks all of it.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, BaseConversionCore. The position is
 * plain JSON (numbers, strings, arrays, plain objects).
 */
const BaseConversionCore = (() => {
  const NROWS = 4;
  const MIN_BASE = 2;
  const MAX_BASE = 36;
  const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
  const MAX_FRACTION_DIGITS = 36;
  const ELLIPSES = "...";
  const DECIMAL_SEPARATOR = ".";
  const BAD = "BAD NUMBER";
  const START_BASES = [10, 2, 8, 16];

  /** Value of one character as a digit, or -1 if it is not a digit. */
  function digitValue(ch) {
    const c = ch.charCodeAt(0);
    if (c >= 48 && c <= 57) return c - 48; // '0'..'9'
    if (c >= 97 && c <= 122) return c - 97 + 10; // 'a'..'z'
    if (c >= 65 && c <= 90) return c - 65 + 10; // 'A'..'Z'
    return -1;
  }

  /* Java's BigInteger(String, radix): optional +/- then digits below radix,
   * using a..z (either case) for values ten and up. null means it would have
   * thrown NumberFormatException, which the applet caught as a bad number. */
  function parseBigInt(text, radix) {
    if (typeof text !== "string" || text.length === 0) return null;
    let sign = 1n;
    let s = text;
    if (s[0] === "-" || s[0] === "+") {
      if (s[0] === "-") sign = -1n;
      s = s.slice(1);
    }
    if (s.length === 0) return null;
    let value = 0n;
    const base = BigInt(radix);
    for (const ch of s) {
      const d = digitValue(ch);
      if (d < 0 || d >= radix) return null;
      value = value * base + BigInt(d);
    }
    return sign * value;
  }

  /** Java's BigInteger.toString(radix): lowercase digits, "-" for negative. */
  function formatBigInt(value, radix) {
    if (value === 0n) return "0";
    const negative = value < 0n;
    let n = negative ? -value : value;
    const base = BigInt(radix);
    let out = "";
    while (n > 0n) {
      out = DIGITS[Number(n % base)] + out;
      n /= base;
    }
    return (negative ? "-" : "") + out;
  }

  /**
   * The applet's BigRational(String, radix). RemoveEllipses() chops the text
   * at its last "..." first. A decimal point splits integer and fraction;
   * the fraction digits are read as an integer F and their count L gives the
   * denominator radix^L. Bad input is flagged rather than thrown.
   */
  function parseRational(text, radix) {
    try {
      const ellipses = text.lastIndexOf(ELLIPSES);
      const s = ellipses > -1 ? text.substring(0, ellipses) : text;
      const point = s.indexOf(DECIMAL_SEPARATOR);
      let n;
      let f = null;
      let denominator = null;
      if (point > -1) {
        if (point > 0) {
          n = parseBigInt(s.substring(0, point), radix);
          if (n === null) return { bad: true };
        } else {
          n = 0n; // the applet uses BigInteger("0") when the point is first
        }
        const fractionText = s.substring(point + 1);
        f = parseBigInt(fractionText, radix);
        if (f === null) return { bad: true };
        denominator = BigInt(radix) ** BigInt(fractionText.length);
      } else {
        n = parseBigInt(s, radix);
        if (n === null) return { bad: true };
      }
      return { bad: false, n, f, denominator };
    } catch (e) {
      return { bad: true };
    }
  }

  /** The applet's BigRational.ConvertFraction: double-precision expansion. */
  function convertFraction(f, denominator, radix) {
    let d = Number(f) / Number(denominator);
    let digits = 0;
    let out = DECIMAL_SEPARATOR;
    while (d > 0 && digits < MAX_FRACTION_DIGITS) {
      d = d * radix;
      const digit = Math.floor(d);
      out += DIGITS[digit];
      d = d - digit;
      digits++;
    }
    if (digits === MAX_FRACTION_DIGITS) out += ELLIPSES;
    return out;
  }

  /** The applet's BigRational.toString(radix), with the caller's toUpperCase(). */
  function formatRational(r, radix) {
    let out = formatBigInt(r.n, radix);
    if (r.f !== null) out += convertFraction(r.f, r.denominator, radix);
    return out.toUpperCase();
  }

  function clampBase(value) {
    const b = Math.round(Number(value));
    if (!Number.isFinite(b)) return MIN_BASE;
    return Math.min(MAX_BASE, Math.max(MIN_BASE, b));
  }

  /** The position a new converter starts from (the applet's initial values). */
  function start(options) {
    const opts = options || {};
    const bases = Array.isArray(opts.bases) && opts.bases.length === NROWS
      ? opts.bases.map(clampBase)
      : START_BASES.slice();
    const texts = Array.isArray(opts.texts) && opts.texts.length === NROWS
      ? opts.texts.slice()
      : ["0", "0", "0", "0"];
    return {
      bases,
      texts,
      activeRow: 0,
      explored: false,
      message: "Type a number in any box and press Enter, or change a base.",
    };
  }

  /**
   * The applet's actionListener: read row `row` in that row's base and show
   * the value in every base. A bad number fills all four boxes with BAD
   * NUMBER. The typed box is rewritten too (the page mentions only the other
   * three, but the applet rewrites all four).
   */
  function convert(state, row, overrideText) {
    const i = ((row % NROWS) + NROWS) % NROWS;
    const text = overrideText === undefined ? state.texts[i] : String(overrideText);
    const from = state.bases[i];
    const r = parseRational(text, from);
    const texts = r.bad
      ? new Array(NROWS).fill(BAD)
      : state.bases.map((base) => formatRational(r, base));
    const phrase = r.bad
      ? `That is not a number in base ${from}. All four boxes now say ${BAD}.`
      : `Entered ${text} in base ${from}. The same number now reads ${texts[0]} in base ${state.bases[0]}, ${texts[1]} in base ${state.bases[1]}, ${texts[2]} in base ${state.bases[2]}, and ${texts[3]} in base ${state.bases[3]}.`;
    return { ...state, texts, activeRow: i, explored: true, message: phrase };
  }

  /**
   * The applet's ChangeBase: re-read row `row` in its old base, write that
   * same value in the new base, and relabel the row. Bases stay in 2..36.
   */
  function changeBase(state, row, newBase) {
    const i = ((row % NROWS) + NROWS) % NROWS;
    const oldBase = state.bases[i];
    const base = clampBase(newBase);
    const r = parseRational(state.texts[i], oldBase);
    const text = r.bad ? BAD : formatRational(r, base);
    const bases = state.bases.slice();
    const texts = state.texts.slice();
    bases[i] = base;
    texts[i] = text;
    const phrase = r.bad
      ? `Box ${i + 1} moved from base ${oldBase} to base ${base}, but its text was not a number, so it says ${BAD}.`
      : `Box ${i + 1} moved from base ${oldBase} to base ${base}: ${state.texts[i]} became ${text}.`;
    return { ...state, bases, texts, activeRow: i, explored: true, message: phrase };
  }

  /** A demo has no winner: it is finished once the player has explored it. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  return {
    NROWS, MIN_BASE, MAX_BASE, BAD,
    parseBigInt, formatBigInt,
    parseRational, formatRational,
    start, convert, changeBase, result,
  };
})();
