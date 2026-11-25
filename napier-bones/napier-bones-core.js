"use strict";

/*
 * Napier's Bones in Various Bases, from Alexander Bogomolny's applet Napier.
 *
 * Each bone is the multiplication table of one digit d: for k = 1, 2, ..., B-1 a
 * cell holds the product d * k written in base B as two digits, the tens
 * above the diagonal and the units below. To multiply a number by k, lay the bones
 * of its digits side by side and look at row k: adding along the diagonals,
 * from the right, gives the digits of the product, with a carry whenever a
 * diagonal adds to B or more. The applet shows the bones for a number written
 * in a base from 3 to 20 (the number 187, in base 10, to begin with) and
 * converts the number when the base changes. Digits above 9 are letters A, B, C...
 *
 * The position is plain data: { base, number } with number the value as an
 * integer, written in the chosen base on the page.
 */
const NapierCore = (() => {
  const MIN_BASE = 3, MAX_BASE = 20, DEFAULT_BASE = 10, DEFAULT_NUMBER = 187, MAX_DIGITS = 12;
  const DIGITS = "0123456789ABCDEFGHIJ";

  const clampBase = (b) => Math.min(MAX_BASE, Math.max(MIN_BASE, Math.round(Number(b)) || DEFAULT_BASE));

  const start = () => ({ base: DEFAULT_BASE, number: DEFAULT_NUMBER });

  /** The number as a string in the base. */
  function toString(n, base) {
    if (n === 0) return "0";
    let s = "";
    while (n > 0) { s = DIGITS[n % base] + s; n = Math.floor(n / base); }
    return s;
  }

  /** The number a string stands for in the base, or null if it is empty, too long or has a digit that is not allowed. */
  function fromString(str, base) {
    const t = String(str).trim().toUpperCase();
    if (t === "" || t.length > MAX_DIGITS) return null;
    let n = 0;
    for (const ch of t) { const v = DIGITS.indexOf(ch); if (v < 0 || v >= base) return null; n = n * base + v; }
    return n;
  }

  /** The digits of the number in the base, as a list of numbers. */
  const digitsOf = (n, base) => [...toString(n, base)].map((ch) => DIGITS.indexOf(ch));

  /** The bone of digit d: for k = 1..B-1, { tens, units } of d * k in the base. */
  function bone(d, base) {
    return Array.from({ length: base - 1 }, (_, i) => { const p = d * (i + 1); return { tens: Math.floor(p / base), units: p % base, product: p }; });
  }

  /** Type a number: the string (in the current base) is read; null if it is not allowed. */
  function setText(state, text) {
    const n = fromString(text, state.base);
    return n === null ? null : { ...state, number: n };
  }

  /** Change the base: the number stays the same and is written anew. */
  const setBase = (state, base) => ({ ...state, base: clampBase(base) });

  /**
   * Multiply by k (1..B-1) with the bones: the diagonal sums from the right and the product's digits.
   * Returns { cells, diagonals, carries, digits, value } where cells[i] is the bone cell of digit i, row k.
   */
  function multiply(state, k) {
    const { base } = state;
    if (!Number.isInteger(k) || k < 1 || k >= base) return null;
    const ds = digitsOf(state.number, base);
    const cells = ds.map((d) => bone(d, base)[k - 1]);
    const n = cells.length;
    // diagonal j (j = 0 is the rightmost): units of cell n-1-j and tens of cell n-j
    const diagonals = [];
    for (let j = 0; j <= n; j++) {
      const units = j < n ? cells[n - 1 - j].units : 0, tens = j >= 1 ? cells[n - j].tens : 0;
      diagonals.push({ units, tens, sum: units + tens });
    }
    const digits = [], carries = []; let carry = 0;
    for (const dgl of diagonals) { const total = dgl.sum + carry; digits.unshift(total % base); carries.push(carry); carry = Math.floor(total / base); }
    while (carry > 0) { digits.unshift(carry % base); carry = Math.floor(carry / base); }
    while (digits.length > 1 && digits[0] === 0) digits.shift();
    const value = digits.reduce((v, d) => v * base + d, 0);
    return { cells, diagonals, carries, digits, value, text: digits.map((d) => DIGITS[d]).join("") };
  }

  return { MIN_BASE, MAX_BASE, DEFAULT_BASE, DEFAULT_NUMBER, MAX_DIGITS, DIGITS, clampBase, start, toString, fromString, digitsOf, bone, setText, setBase, multiply };
})();
