/*
 * run_game_logic actions and saved-position reader for the Abacus demo.
 *
 * The core (abacus/ in the site, copied into src/generated/cores/ at build
 * time) knows the place-value model, carries, borrows and Sync. See _shared.ts
 * for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["abacus"].AbacusCore;

function readWires(args: Json): { radix: number; wires: number; digits: number[] } {
  const C = core();
  const radix = num(args, "radix", 10);
  const digits = numArray(args, "digits");
  if (!Number.isInteger(radix) || radix < C.MIN_RADIX || radix > C.MAX_RADIX) {
    throw new Error(`radix must be ${C.MIN_RADIX} to ${C.MAX_RADIX}`);
  }
  const wires = Number.isFinite(args.wires) ? num(args, "wires") : digits.length;
  if (!Number.isInteger(wires) || wires < C.MIN_WIRES || wires > C.MAX_WIRES) {
    throw new Error(`wires must be ${C.MIN_WIRES} to ${C.MAX_WIRES}`);
  }
  if (digits.length !== wires || digits.some((d) => !Number.isInteger(d) || d < 0 || d >= radix)) {
    throw new Error(`digits must have ${wires} whole numbers from 0 to ${radix - 1}`);
  }
  return { radix, wires, digits };
}

export function actions(): GameActions {
  return {
    read_abacus: {
      describe:
        "For a set of wire digits and a radix, report the decimal value, the written base-radix number and each wire's counters.",
      args: '{ "radix": 10, "digits": [1, 2, 3, 4] }',
      run: (args) => {
        const C = core();
        const a = readWires(args);
        const wires = a.digits.map((digit, i) => ({
          wire: i, digit, lowerCounters: digit, upperCounters: a.radix - digit, place: a.radix ** (a.wires - 1 - i),
        }));
        return {
          radix: a.radix,
          wires: a.wires,
          digits: a.digits,
          value: C.value(a),
          written: C.format(a),
          wiresDetail: wires,
          note: "Wire 0 is the leftmost, most significant wire.",
        };
      },
    },
    convert: {
      describe:
        "Write a decimal number in a chosen base, using digits 0-9 then A-Z, padded to the given number of wires.",
      args: '{ "number": 48879, "radix": 16, "wires": 4 }',
      run: (args) => {
        const C = core();
        const number = num(args, "number");
        if (!Number.isInteger(number) || number < 0) throw new Error("number must be a non-negative integer");
        const a = C.setValue(C.abacus(num(args, "radix", 16), num(args, "wires", 4)), number);
        return {
          number,
          radix: a.radix,
          wires: a.wires,
          digits: a.digits,
          written: C.format(a),
          value: C.value(a),
          fits: !a.overflow,
          note: a.overflow ? "That number is too big for these wires." : "Round-trips exactly.",
        };
      },
    },
    add_subtract: {
      describe:
        "Add or subtract an amount on one wire of an abacus, carrying or borrowing to the left, and report the resulting digits and any warning.",
      args: '{ "radix": 10, "digits": [0, 9, 0, 0], "wire": 1, "amount": 1, "operation": "add" }',
      run: (args) => {
        const C = core();
        const a = readWires(args);
        const wire = num(args, "wire");
        const amount = num(args, "amount");
        if (!Number.isInteger(wire) || wire < 0 || wire >= a.wires) throw new Error("wire is out of range");
        if (!Number.isInteger(amount) || amount <= 0) throw new Error("amount must be a positive integer");
        const result = args.operation === "subtract" ? C.subtract(a, wire, amount) : C.add(a, wire, amount);
        return {
          operation: args.operation === "subtract" ? "subtract" : "add",
          before: C.format(a),
          after: C.format(result.abacus),
          digits: result.abacus.digits,
          valueBefore: C.value(a),
          valueAfter: C.value(result.abacus),
          message: result.message || "",
        };
      },
    },
  };
}

/** What the core says about a saved abacus board. */
export function position(state: Json): unknown {
  const C = core();
  const radix = num(state, "radix", 10);
  const wires = num(state, "wires", 7);
  const raw = state.abaci;
  if (!Array.isArray(raw)) throw new Error("abaci must be an array");
  const abaci = raw.map((entry) => {
    const a = entry as Json;
    const digits = numArray(a, "digits");
    return { radix, wires, digits, value: C.value({ radix, wires, digits }), written: C.format({ radix, wires, digits }) };
  });
  return {
    radix,
    wires,
    count: abaci.length,
    sync: state.sync === true,
    abaci: abaci.map((a) => ({ value: a.value, written: a.written, digits: a.digits })),
    note: abaci.length === 2 && state.sync === true
      ? "Sync is on: a change on one abacus is mirrored on the other."
      : "Each wire's counters are its digit in this base.",
  };
}
