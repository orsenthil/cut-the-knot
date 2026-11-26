"use strict";

/*
 * Zeros and Nines, from Alexander Bogomolny's applet ZerosAndNines.
 *
 * Write a number S and the multiples 2S, 3S, ... up to base*S beneath it.
 * Read any column (padding the short rows with leading zeros): among the
 * ten rows S, 2S, ..., 10S it always holds a 0 or a 9. The applet's blue
 * digits can be nudged up or down; with "Autonomous digits" off the edit
 * carries or borrows through the other digits, as in ordinary arithmetic.
 *
 * Transcribed from ZerosAndNinesCanvas.Compute/DrawString (the rows),
 * BaseSys.ConvertNum (the base-r digits), IntegerString.Update and
 * IntegerStringVariedLength.Update (the connected digit edits). The one
 * deliberate difference is that rows are computed with BigInt, so the
 * applet's longValue() truncation for very large numbers cannot happen.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, ZerosAndNinesCore. The position is
 * plain data, so it can be saved and handed to the tutor as it is.
 */
const ZerosAndNinesCore = (() => {
  const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const BASE = { min: 3, max: 36, def: 10 };
  const LENGTH = { min: 1, max: 18, def: 6 };

  function intIn(x, min, max, def) {
    const n = Math.round(Number(x));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
  }

  /** GetRandomNumber: a leading digit 1..base-1 and the rest 0..base-1. */
  function randomDigits(base, length, rng) {
    const rand = typeof rng === "function" ? rng : Math.random;
    const ds = [1 + Math.floor(rand() * (base - 1))]; // the leading digit
    // The applet builds the string left to right, then Init(long) peels its
    // digits off from the right: Nums holds them least significant first.
    for (let i = 1; i < length; i++) ds.unshift(Math.floor(rand() * base));
    return ds;
  }

  /** IntegerString(String, base): most significant digit first in, least first out. */
  function parseDigits(str, base) {
    const text = String(str).toUpperCase();
    const ds = [];
    for (let i = text.length - 1; i >= 0; i--) {
      const v = DIGITS.indexOf(text[i]);
      ds.push(v >= 0 && v < base ? v : 0); // BaseSys.Check falls back to 0
    }
    while (ds.length > 1 && ds[ds.length - 1] === 0) ds.pop();
    return ds;
  }

  /** BaseSys.ConvertNum: n (a BigInt or a safe integer) written in base. */
  function convert(n, base) {
    let x = BigInt(n);
    const b = BigInt(base);
    if (x === 0n) return "0";
    let s = "";
    while (x > 0n) {
      s = DIGITS[Number(x % b)] + s;
      x /= b;
    }
    return s;
  }

  /** A new position: the applet starts in base 10 with six digits. */
  function start(options = {}) {
    const base = intIn(options.base ?? BASE.def, BASE.min, BASE.max, BASE.def);
    const length = intIn(options.digits ?? LENGTH.def, LENGTH.min, LENGTH.max, LENGTH.def);
    const digits = options.value === undefined
      ? randomDigits(base, length, options.rng)
      : parseDigits(options.value, base);
    return {
      base,
      digits,
      autonomous: !!options.autonomous,
      showColumns: !!options.showColumns,
      checkedColumn: null,
    };
  }

  /** Change an option; changing the base or the length makes a new number. */
  function withOptions(state, options = {}) {
    const base = options.base === undefined ? state.base : intIn(options.base, BASE.min, BASE.max, BASE.def);
    const length = options.digits === undefined ? state.digits.length : intIn(options.digits, LENGTH.min, LENGTH.max, LENGTH.def);
    const renew = options.newNumber === true || base !== state.base || length !== state.digits.length;
    return {
      base,
      digits: renew ? randomDigits(base, length, options.rng) : state.digits.slice(),
      autonomous: options.autonomous === undefined ? state.autonomous : !!options.autonomous,
      showColumns: options.showColumns === undefined ? state.showColumns : !!options.showColumns,
      checkedColumn: null,
    };
  }

  const format = (state) => state.digits.slice().reverse().map((d) => DIGITS[d]).join("");

  function value(state) {
    let n = 0n;
    for (let i = state.digits.length - 1; i >= 0; i--) n = n * BigInt(state.base) + BigInt(state.digits[i]);
    return n;
  }

  // CTKNumber.IsHit: the right half of a digit increments it, the left half
  // decrements it. IntegerStringVariedLength.Update then propagates a carry
  // or a borrow when "Autonomous digits" is off (Connected is on).
  function editDigit(state, index, direction) {
    const ds = state.digits.slice();
    const b = state.base;
    const n = ds.length;
    if (!Number.isInteger(index) || index < 0 || index >= n) return state;
    const old = ds[index];
    const next = (old + (direction >= 0 ? 1 : -1) + b) % b;
    ds[index] = next;

    if (!state.autonomous) {
      if (old === 1 && next === 0 && index === n - 1 && n > 1) {
        // A leading 1 reduced to 0 disappears (PrependOne's opposite).
        ds.pop();
      } else if ((old === 0 && next === b - 1) || (old === b - 1 && next === 0)) {
        if (old === b - 1 && index < n) {
          if (index === n - 1) {
            ds.push(1);
          } else {
            let prepend = false;
            for (let j = index + 1; j < n; j++) {
              const v = ds[j] + 1;
              if (v === b) {
                ds[j] = 0;
                if (j === n - 1) prepend = true;
              } else {
                ds[j] = v;
                break;
              }
            }
            if (prepend) ds.push(1);
          }
        } else if (old === 0 && index < n) {
          for (let j = index + 1; j < n; j++) {
            if (ds[j] === 0) {
              ds[j] = b - 1;
              if (j === n - 1 && ds.length > 1) {
                ds.pop();
                break;
              }
            } else {
              ds[j] -= 1;
              break;
            }
          }
        }
      }
    }
    return { ...state, digits: ds, checkedColumn: null };
  }

  /** Compute: [S, 2S, ..., base*S], each written in the current base. */
  function rows(state) {
    const s = value(state);
    const out = [format(state)];
    for (let k = 2; k <= state.base; k++) out.push(convert(s * BigInt(k), state.base));
    return out;
  }

  /**
   * One column of the table, read from the right (0 = units). Rows shorter
   * than the column are padded with the zero the page allows. The applet's
   * table shows S in blue and the multiples beneath it; includeSource:false
   * looks only at the multiples, which is where the page's warning lives.
   */
  function columnDigits(state, column, options = {}) {
    const rs = rows(state);
    const from = options.includeSource === false ? 1 : 0;
    const out = [];
    for (let r = from; r < rs.length; r++) {
      const s = rs[r];
      const i = s.length - 1 - column;
      out.push(i >= 0 ? DIGITS.indexOf(s[i]) : 0);
    }
    return out;
  }

  /** Check ten figures (or nine, without S) for a 0 or the largest digit. */
  function checkColumn(state, column, options = {}) {
    const digits = columnDigits(state, column, options);
    const top = state.base - 1;
    const hasZero = digits.includes(0);
    const hasTop = digits.includes(top);
    return { column, digits, base: state.base, hasZero, hasTop, ok: hasZero || hasTop };
  }

  const columnName = (column) => ["units", "tens", "hundreds", "thousands"][column] ?? `10^${column}`;

  /** A demo: checking a column finishes the exploration, nobody wins. */
  const result = (state) => (state.checkedColumn === null ? null : "done");

  return {
    DIGITS, BASE, LENGTH, intIn, randomDigits, parseDigits, convert, start,
    withOptions, format, value, editDigit, rows, columnDigits, checkColumn,
    columnName, result,
  };
})();
