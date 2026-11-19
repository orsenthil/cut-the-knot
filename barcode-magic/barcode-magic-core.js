"use strict";

/*
 * Barcode Magic, ported from Alexander Bogomolny's applet BarCodeMagic.
 *
 * The applet shows the 12 decimal digits of a UPC-A code. Eleven of them are
 * chosen by the player; the last one is a check digit. A UPC-A code is valid
 * when 3*(d0+d2+d4+d6+d8+d10) + (d1+d3+d5+d7+d9+d11) is a multiple of 10.
 * Because the weights 3 and 1 are both coprime to 10, any one missing digit
 * can be recovered from the other eleven: the applet's "magic" is just this
 * modular equation. Every cell starts as "?" and a click steps it through
 * 0..9 and back to "?" (modulo 11); the right half of a cell steps up, the
 * left half steps down. Check() reports a valid code, an invalid code, too
 * many blanks, or the recovered digit.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, BarcodeMagicCore, so the page loads it with a
 * plain <script> and porting/check-barcode-magic.mjs loads it in Node.
 *
 * The position is plain data (numbers, strings, arrays, plain objects), so
 * it can be saved and handed to the tutor as it is. Functions take a
 * position and return a new one; they do not change what they are given.
 */
const BarcodeMagicCore = (() => {
  // The applet's own constants, read from BarCodeMagicCode / ModBlankNum.
  const LENGTH = 12; // twelve digits in a UPC-A code
  const MOD = 11; // the cells hold 0..9 plus the blank value
  const BLANK = 10; // ModBlankNum: value == Mod-1 draws "?" and counts as blank

  // BarCodeEncoding.Odds: the seven-module patterns for the left six digits.
  // Evens[d] is the bitwise complement of Odds[d], as in the applet's static
  // initialiser. The right six digits use these "even" patterns in UPC-A.
  const ODD = [
    "0001101", // 0
    "0011001", // 1
    "0010011", // 2
    "0111101", // 3
    "0100011", // 4
    "0110001", // 5
    "0101111", // 6
    "0111011", // 7
    "0110111", // 8
    "0001011", // 9
  ];
  const EVEN = ODD.map((bits) =>
    bits
      .split("")
      .map((b) => (b === "0" ? "1" : "0"))
      .join("")
  );

  /** The position a new game starts from: twelve question marks. */
  function start() {
    return { digits: new Array(LENGTH).fill(BLANK), message: "", outcome: null };
  }

  /** ModBlankNum.toString(): a blank prints "?", a digit prints itself. */
  function digitText(value) {
    return value === BLANK ? "?" : String(value);
  }

  /** The applet's weight for position i: 3 at even indices, 1 at odd ones. */
  function weight(i) {
    return i % 2 === 0 ? 3 : 1;
  }

  /** One click: CTKNumberMod.UpdateSlow adds +1 or -1 modulo 11. */
  function cycle(state, i, direction) {
    if (!Number.isInteger(i) || i < 0 || i >= LENGTH) return state;
    if (direction !== 1 && direction !== -1) return state;
    const digits = state.digits.slice();
    digits[i] = (((digits[i] + direction) % MOD) + MOD) % MOD;
    // update() clears the announcement on the next repaint in the applet.
    return { digits, message: "", outcome: null };
  }

  /** IsCorrect(): weighted sum of all twelve digits, modulo ten. */
  function checksum(digits) {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) sum += weight(i) * digits[i];
    return ((sum % 10) + 10) % 10;
  }

  /** IsCorrect(), with the applet's length and range assumptions made safe. */
  function isValid(digits) {
    return (
      digits.length === LENGTH &&
      digits.every((d) => Number.isInteger(d) && d >= 0 && d <= 9) &&
      checksum(digits) === 0
    );
  }

  /** NumOfBlanks(): count the cells whose value is Mod-1. */
  function blankCount(digits) {
    let count = 0;
    for (const d of digits) if (d === BLANK) count++;
    return count;
  }

  /*
   * GetMissingDigit(), transcribed from the bytecode:
   *   find the blank p; sum weight(j)*value(j) over j != p;
   *   res = 10 - sum%10; if p is even, res *= 7 (7 is 3's inverse mod 10);
   *   return res % 10.  With no blank the applet returns -1.
   */
  function missingDigit(digits) {
    let p = -1;
    for (let i = 0; i < digits.length; i++) {
      if (digits[i] === BLANK) {
        p = i;
        break;
      }
    }
    if (p === -1) return -1;
    let sum = 0;
    for (let j = 0; j < digits.length; j++) {
      if (j === p) continue;
      sum += weight(j) * digits[j];
    }
    let res = 10 - (((sum % 10) + 10) % 10);
    if (p % 2 === 0) res *= 7;
    return ((res % 10) + 10) % 10;
  }

  /** Check(): the four announcements, as the applet words them. */
  function check(digits) {
    const blanks = blankCount(digits);
    if (blanks === 0) {
      return isValid(digits)
        ? { outcome: "valid", message: "This is a valid code", digit: null }
        : { outcome: "invalid", message: "Invalid code", digit: null };
    }
    if (blanks > 1) {
      return { outcome: "too-many", message: "Too many blanks!", digit: null };
    }
    const digit = missingDigit(digits);
    // The original builds this string with string + int: no space before n.
    return { outcome: "missing", message: "The missing digit is" + digit, digit };
  }

  /** Press Check: keeps the answer in the position so the page can show it. */
  function pressCheck(state) {
    const r = check(state.digits);
    return { digits: state.digits.slice(), message: r.message, outcome: r.outcome };
  }

  /*
   * The UPC-A barcode as a string of 95 modules: '1' is a bar, '0' a space,
   * '?' a blank cell (the applet paints a solid block seven modules wide).
   * Guard bars: start 101, centre 01010, end 101 — the extra 11 modules.
   */
  function moduleString(digits) {
    let s = "101";
    for (let i = 0; i < LENGTH; i++) {
      const d = digits[i];
      s += d === BLANK ? "???????" : i < LENGTH / 2 ? ODD[d] : EVEN[d];
      if (i === LENGTH / 2 - 1) s += "01010";
    }
    return s + "101";
  }

  return {
    LENGTH,
    MOD,
    BLANK,
    ODD,
    EVEN,
    start,
    digitText,
    weight,
    cycle,
    checksum,
    isValid,
    blankCount,
    missingDigit,
    check,
    pressCheck,
    moduleString,
  };
})();
