"use strict";

/*
 * S1089, from Alexander Bogomolny's cut-the-knot applet S1089.
 *
 * Write a number, reverse its digits, subtract the smaller from the larger,
 * then reverse and add. For three digits in base ten the answer is always
 * 1089 (unless the number is a palindrome). The same trick works in any
 * base: the answer is 10uv, where u and v are the two largest digits.
 *
 * The code follows the applet digit by digit: it keeps the number as an array
 * of digit values in writing order, reverses with the applet's SmartReverse
 * (which drops leading zeroes after the reversal), pads the difference to the
 * chosen length before reversing it, and carries or borrows through the other
 * digits when "Autonomous digits" is off. It is pure logic: no DOM, no
 * storage, one global, and a position that is plain JSON.
 */
const S1089Core = (() => {
  const MIN_BASE = 2;
  const MAX_BASE = 36;
  const MIN_DIGITS = 1;
  const MAX_DIGITS = 15; // the applet's MaxLength parameter defaults to 15
  const GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  // Long.parseLong in SetNumOfDigits fails silently on a number this big,
  // leaving the old digits in place. Reproduce that quirk.
  const LONG_MAX = BigInt("9223372036854775807");

  function clamp(n, lo, hi) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  }

  function digitsToText(digits, base) {
    return digits.map((d) => GLYPHS[d] ?? "0").join("");
  }

  /** BaseSys.Check over one character: -1 when it is not a digit of `base`. */
  function digitValue(ch, base) {
    const u = String(ch).toUpperCase();
    const v = u >= "0" && u <= "9" ? u.charCodeAt(0) - 48
      : u >= "A" && u <= "Z" ? u.charCodeAt(0) - 55 : -1;
    return v >= 0 && v < base ? v : -1;
  }

  /** BaseSys.ConvertTo10(text, base), with the applet's -1 for bad text. */
  function textToValue(text, base) {
    if (!text.length) return -1n;
    let v = 0n;
    for (const ch of text) {
      const d = digitValue(ch, base);
      if (d < 0) return -1n;
      v = v * BigInt(base) + BigInt(d);
    }
    return v;
  }

  /** BaseSys.ConvertNum(value, base). Values here are always nonnegative. */
  function valueToText(value, base) {
    let v = BigInt(value);
    if (v === 0n) return "0";
    let out = "";
    while (v > 0n) {
      out = GLYPHS[Number(v % BigInt(base))] + out;
      v /= BigInt(base);
    }
    return out;
  }

  /* StringBuffer.reverse() followed by deleting every leading '0'. If every
   * digit was a zero the applet deletes past the end and throws; the page says
   * the sum is 0, so keep one zero instead (see "Look for the math"). */
  function smartReverse(text) {
    const reversed = text.split("").reverse().join("").replace(/^0+/, "");
    return reversed === "" ? "0" : reversed;
  }

  function padWithZeros(text, count) {
    return text.length >= count ? text : "0".repeat(count - text.length) + text;
  }

  /** The five numbers the applet prints, in order: A, A', B, B', C. */
  function compute(state) {
    const base = state.base;
    const a = digitsToText(state.digits, base);
    const aRev = smartReverse(a);
    const va = textToValue(a, base);
    const vr = textToValue(aRev, base);
    const b = va >= vr ? va - vr : vr - va;
    const bText = valueToText(b, base);
    const bPad = padWithZeros(bText, state.digitCount);
    const bRev = smartReverse(bPad);
    const c = b + textToValue(bRev, base);
    return {
      a,
      aPrime: aRev,
      b: bText,
      bPrime: bRev,
      c: valueToText(c, base),
      value: c,
    };
  }

  /** SetNumOfDigits: a random number with a nonzero leading digit. */
  function randomDigits(base, count, random, previous) {
    const next = [Math.floor(random() * (base - 1)) + 1];
    for (let i = 1; i < count; i++) next.push(Math.floor(random() * base));
    let value = 0n;
    for (const d of next) value = value * BigInt(base) + BigInt(d);
    return value > LONG_MAX ? previous.slice() : next;
  }

  /** The position a new demo starts from. Pass digits/random to choose it. */
  function start(options = {}) {
    const base = clamp(options.base ?? 10, MIN_BASE, MAX_BASE);
    const digitCount = clamp(options.digitCount ?? 3, MIN_DIGITS, MAX_DIGITS);
    let digits;
    if (Array.isArray(options.digits)) {
      digits = options.digits.map((d) => clamp(d, 0, base - 1)).slice(0, digitCount);
    } else if (typeof options.digits === "string") {
      digits = [...options.digits.toUpperCase()].map((ch) => digitValue(ch, base))
        .filter((d) => d >= 0).slice(-digitCount);
    } else {
      digits = randomDigits(base, digitCount, options.random ?? Math.random, [1]);
    }
    while (digits.length < digitCount) digits.unshift(0);
    return {
      base,
      digitCount,
      digits,
      autonomous: !!options.autonomous,
      explored: false,
      message: "Tap a blue digit to change it, then watch the answer at the bottom.",
    };
  }

  /** Change one digit as a click on its left (down) or right (up) half does. */
  function changeDigit(state, index, up) {
    if (index < 0 || index >= state.digits.length) return state;
    const base = state.base;
    const digits = state.digits.slice();
    const old = digits[index];
    digits[index] = up ? (old + 1) % base : (old + base - 1) % base;

    /* IntegerString.Update: it enters only when the NEW digit is 0 or the
     * largest digit, but chooses the direction from the OLD one. So in base
     * two clicking UP on a zero borrows from the left; in base ten it does
     * not. That quirk is kept here, as it is in the original. */
    if (!state.autonomous && (digits[index] === 0 || digits[index] === base - 1)) {
      const step = old === base - 1 ? 1 : old === 0 ? -1 : 0;
      for (let i = index - 1; step !== 0 && i >= 0; i--) {
        let next = digits[i] + step;
        if (next === base) next = 0;
        else if (next === -1) next = base - 1;
        digits[i] = next;
        if (next !== (step === 1 ? 0 : base - 1)) break;
      }
    }
    const out = compute({ ...state, digits });
    const place = ["ones", "tens", "hundreds", "thousands"][index] ?? `place ${index + 1}`;
    return {
      ...state,
      digits,
      explored: true,
      message: `The ${place} digit went from ${GLYPHS[old]} to ${GLYPHS[digits[index]]}. ` +
        `The answer is now ${out.c}.`,
    };
  }

  /** ProcessNumberChange for either spinner: both changes pick a new number. */
  function setBase(state, base, random = Math.random) {
    const next = clamp(base, MIN_BASE, MAX_BASE);
    return {
      ...state,
      base: next,
      digits: randomDigits(next, state.digitCount, random, state.digits),
      explored: true,
      message: `Base ${next}: a fresh ${state.digitCount}-digit number to try.`,
    };
  }

  function setDigitCount(state, count, random = Math.random) {
    const next = clamp(count, MIN_DIGITS, MAX_DIGITS);
    return {
      ...state,
      digitCount: next,
      digits: randomDigits(state.base, next, random, state.digits),
      explored: true,
      message: `Now ${next} ${next === 1 ? "digit" : "digits"}: a fresh number to try.`,
    };
  }

  function setAutonomous(state, autonomous) {
    return {
      ...state,
      autonomous: !!autonomous,
      explored: true,
      message: autonomous
        ? "Autonomous digits: each digit changes on its own, with no carry."
        : "Linked digits: a wrapped digit passes carry into the one on its left.",
    };
  }

  /** The New number button: the applet regenerates when an option changes. */
  function randomize(state, random = Math.random) {
    return {
      ...state,
      digits: randomDigits(state.base, state.digitCount, random, state.digits),
      explored: true,
      message: `A new ${state.digitCount}-digit number in base ${state.base}.`,
    };
  }

  /** "done" once the player has explored, as for every demo on the site. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  return {
    MIN_BASE, MAX_BASE, MIN_DIGITS, MAX_DIGITS, GLYPHS,
    start, compute, changeDigit, setBase, setDigitCount, setAutonomous,
    randomize, result, textToValue, valueToText, smartReverse, padWithZeros,
  };
})();
