"use strict";

/*
 * The Abacus, from Bogomolny's applet of the same name.
 *
 * Each wire holds `radix` counters. Counters pushed towards the bar count as
 * the digit on that wire; wire 0 is the units wire. Clicking a counter on the
 * lower (digit) side moves it and every counter above it away, so the number
 * left is the one you clicked. Clicking on the upper side moves counters down
 * to the bar, adding to the digit; carrying to the left is automatic, as the
 * applet's page says. Borrowing works the other way on subtraction.
 *
 * Two abaci can be shown; with Sync on, removing counters from one adds the
 * same amount to the other at the same wire, and vice versa. The logic test
 * checks base conversion, carries, borrows, clicks and the Sync invariant.
 *
 * No document, no window, no storage: one global, AbacusCore. The position is
 * plain data, so it can be saved and handed to the tutor.
 */
const AbacusCore = (() => {
  const MIN_RADIX = 2;
  const MAX_RADIX = 16;
  const MIN_WIRES = 1;
  const MAX_WIRES = 10;
  const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const TOO_SHORT = "This Abacus is too short!";
  const TOO_BIG = "Sorry, the number's too big!";

  const clamp = (value, low, high, fallback) => {
    const v = Math.trunc(Number(value));
    if (!Number.isFinite(v)) return fallback;
    return Math.max(low, Math.min(high, v));
  };

  function abacus(radix, wires, digits) {
    return {
      radix: clamp(radix, MIN_RADIX, MAX_RADIX, 10),
      wires: clamp(wires, MIN_WIRES, MAX_WIRES, 7),
      digits: digits || [],
    };
  }

  /** A fresh set of abaci with every wire at zero. */
  function start(options) {
    const opts = options || {};
    const radix = clamp(opts.radix === undefined ? 10 : opts.radix, MIN_RADIX, MAX_RADIX, 10);
    const wires = clamp(opts.wires === undefined ? 7 : opts.wires, MIN_WIRES, MAX_WIRES, 7);
    const count = opts.count === 2 ? 2 : 1;
    const digits = Array(wires).fill(0);
    return {
      radix, wires, count, sync: Boolean(opts.sync),
      abaci: [abacus(radix, wires, digits.slice())].concat(
        count === 2 ? [abacus(radix, wires, digits.slice())] : []),
      message: "",
    };
  }

  // Wire 0 is drawn leftmost, so it holds the most significant digit.
  function value(a) {
    let total = 0;
    for (let i = 0; i < a.wires; i++) total = total * a.radix + (a.digits[i] || 0);
    return total;
  }

  function format(a) {
    let out = "";
    for (let i = 0; i < a.wires; i++) out += CHARS[a.digits[i] || 0];
    return out;
  }

  /** Load a decimal number into the wires, most significant first. */
  function setValue(a, number) {
    const rest = Math.max(0, Math.floor(number));
    const digits = Array(a.wires).fill(0);
    let place = a.radix ** (a.wires - 1);
    let left = rest;
    for (let i = 0; i < a.wires; i++) {
      digits[i] = Math.floor(left / place) % a.radix;
      left %= place;
      place /= a.radix;
    }
    return { ...a, digits, overflow: rest >= a.radix ** a.wires };
  }

  function copy(a) {
    return abacus(a.radix, a.wires, a.digits.slice());
  }

  /** Add `amount` units to one wire, carrying leftwards automatically. */
  function add(a, wire, amount) {
    if (wire < 0 || wire >= a.wires || amount <= 0) return { abacus: copy(a), message: "" };
    const digits = a.digits.slice();
    let carry = amount;
    let at = wire;
    let message = "";
    while (carry > 0 && at >= 0) {
      const sum = digits[at] + carry;
      digits[at] = sum % a.radix;
      carry = Math.floor(sum / a.radix);
      at--;
    }
    if (carry > 0) message = TOO_SHORT;
    return { abacus: abacus(a.radix, a.wires, digits), message };
  }

  /**
   * Subtract `amount` units from one wire. The applet borrows from the wires
   * to the left: a wire with more than one counter loses one, while a wire
   * with one or none becomes radix-1 and the borrow continues.
   */
  function subtract(a, wire, amount) {
    if (wire < 0 || wire >= a.wires || amount <= 0) return { abacus: copy(a), message: "" };
    const digits = a.digits.slice();
    let message = "";
    if (digits[wire] >= amount) {
      digits[wire] -= amount;
    } else {
      digits[wire] = digits[wire] + a.radix - amount;
      let j = wire - 1;
      let borrowed = false;
      while (j >= 0) {
        if (digits[j] > 1) {
          digits[j] -= 1;
          borrowed = true;
          break;
        }
        digits[j] = a.radix - 1;
        j--;
      }
      if (!borrowed) message = TOO_BIG;
    }
    return { abacus: abacus(a.radix, a.wires, digits), message };
  }

  /**
   * Click the lower counter at height `leave` (0 = lowest): all counters from
   * there up move away, leaving `leave` counters on this wire.
   */
  function clickLower(a, wire, leave) {
    if (wire < 0 || wire >= a.wires || leave < 0 || leave >= (a.digits[wire] || 0)) {
      return { abacus: copy(a), message: "" };
    }
    return subtract(a, wire, a.digits[wire] - leave);
  }

  /**
   * Click the upper counter at height `fromBar`: that counter and all above
   * it move down, adding radix - digits[wire] - fromBar counters to the wire.
   */
  function clickUpper(a, wire, fromBar) {
    if (wire < 0 || wire >= a.wires) return { abacus: copy(a), message: "" };
    const upper = a.radix - (a.digits[wire] || 0);
    if (fromBar < 0 || fromBar >= upper) return { abacus: copy(a), message: "" };
    return add(a, wire, upper - fromBar);
  }

  /** Apply a click to one abacus, mirroring it on the other when Sync is on. */
  function click(state, which, wire, part, index) {
    const current = state.abaci[which];
    const amount = part === "upper"
      ? current.radix - (current.digits[wire] || 0) - index
      : (current.digits[wire] || 0) - index;
    const first = part === "upper" ? clickUpper(current, wire, index) : clickLower(current, wire, index);
    const abaci = state.abaci.slice();
    abaci[which] = first.abacus;
    let message = first.message;
    if (state.sync && state.count === 2) {
      const other = 1 - which;
      const mirrored = part === "upper"
        ? subtract(abaci[other], wire, amount)
        : add(abaci[other], wire, amount);
      abaci[other] = mirrored.abacus;
      message = message || mirrored.message;
    }
    return { ...state, abaci, message };
  }

  function setRadix(state, radix) {
    const r = clamp(radix, MIN_RADIX, MAX_RADIX, 10);
    const digits = Array(state.wires).fill(0);
    return {
      ...state, radix: r,
      abaci: state.abaci.map((a) => abacus(r, state.wires, digits.slice())),
      message: "",
    };
  }

  function setWires(state, wires) {
    const w = clamp(wires, MIN_WIRES, MAX_WIRES, 7);
    const digits = Array(w).fill(0);
    return {
      ...state, wires: w,
      abaci: state.abaci.map((a) => abacus(state.radix, w, digits.slice())),
      message: "",
    };
  }

  function setCount(state, count) {
    const c = count === 2 ? 2 : 1;
    const digits = Array(state.wires).fill(0);
    return {
      ...state, count: c,
      abaci: [abacus(state.radix, state.wires, digits.slice())].concat(
        c === 2 ? [abacus(state.radix, state.wires, digits.slice())] : []),
      message: "",
    };
  }

  return {
    MIN_RADIX, MAX_RADIX, MIN_WIRES, MAX_WIRES, CHARS, TOO_SHORT, TOO_BIG,
    abacus, start, value, format, setValue, copy, add, subtract, clickLower,
    clickUpper, click, setRadix, setWires, setCount,
  };
})();
