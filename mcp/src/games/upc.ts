/*
 * run_game_logic actions and saved-position reader for UPC.
 *
 * A UPC-A code has twelve digits: eleven chosen ones and a check digit with
 * 3*d1 + d2 + 3*d3 + ... + 3*d11 + d12 = 0 (mod 10). Every answer below comes
 * from the game's real core, copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["upc"].UpcCore;

/** Eleven chosen digits, or a full twelve-digit code; each entry must be a digit. */
function readDigits(args: Json, key: string): number[] {
  const digits = numArray(args, key);
  if (digits.length !== 11 && digits.length !== 12) {
    throw new Error(`"${key}" needs 11 chosen digits or a full 12-digit code, got ${digits.length}`);
  }
  digits.forEach((d, i) => {
    if (!Number.isInteger(d) || d < 0 || d > 9) {
      throw new Error(`${key}[${i}] must be a digit from 0 to 9, got ${JSON.stringify(d)}`);
    }
  });
  return digits;
}

export function actions(): GameActions {
  return {
    complete: {
      describe:
        "Complete a UPC-A code from its first eleven digits, or check a full twelve-digit code: the computed check digit, the odd/even sums and 3*S_odd + S_even, the 95 barcode modules decoded back to digits, and the EAN-13 obtained by prefixing 0. The check digit is the only value 0-9 that makes the weighted sum a multiple of ten.",
      args: '{ "digits": [0,3,6,0,0,0,2,9,1,4,5] }',
      run: (args) => {
        const C = core();
        const given = readDigits(args, "digits");
        const digits = C.complete(given.slice(0, 11));
        const s = C.sums(digits);
        const total = s.weighted + digits[11];
        const modules = C.modules(C.start({ digits }));
        return {
          code: digits.join(""),
          checkDigit: digits[11],
          givenCheckDigit: given.length === 12 ? given[11] : null,
          valid: C.valid(given.length === 12 ? given : digits),
          oddPositionsSum: s.odd,
          evenPositionsSum: s.even,
          weightedSum: s.weighted,
          totalIncludingCheckDigit: total,
          barcodeModules: modules.join(""),
          decodedFromBars: C.decode(modules)?.join("") ?? null,
          ean13WithLeadingZero: `0${digits.join("")}`,
          why:
            `3×${s.odd} + ${s.even} = ${s.weighted}, and ${s.weighted} + ${digits[11]} = ${total}, a multiple of 10. ` +
            "The weights 3 and 1 alternate; the check digit is the only value from 0 to 9 that makes the sum work.",
        };
      },
    },
    error_check: {
      describe:
        "Exercise a valid UPC-A code with the game's core: change every digit to every other value, and swap every pair of neighbours. Any single-digit error is caught; a swap of neighbours differing by 5 is not.",
      args: '{ "code": [0,1,2,3,4,5,6,7,8,9,0,5] }',
      run: (args) => {
        const C = core();
        const code = readDigits(args, "code");
        if (code.length !== 12) throw new Error('"code" must be a full 12-digit UPC-A code');
        if (!C.valid(code)) {
          throw new Error(`"code" is not a valid UPC-A code; its check digit should be ${C.fixCheckDigit(code.slice(0, 11))}`);
        }
        let tested = 0, caught = 0, missed = 0;
        for (let i = 0; i < code.length; i++) {
          for (let v = 0; v < 10; v++) {
            if (v === code[i]) continue;
            const changed = code.slice();
            changed[i] = v;
            tested++;
            if (C.valid(changed)) missed++;
            else caught++;
          }
        }
        const undetectedAdjacentSwaps: { positions: number[]; digits: number[]; difference: number }[] = [];
        for (let i = 0; i < code.length - 1; i++) {
          const swapped = code.slice();
          swapped[i] = code[i + 1];
          swapped[i + 1] = code[i];
          if (C.valid(swapped)) {
            undetectedAdjacentSwaps.push({
              positions: [i + 1, i + 2],
              digits: [code[i], code[i + 1]],
              difference: Math.abs(code[i] - code[i + 1]),
            });
          }
        }
        return {
          code: code.join(""),
          valid: C.valid(code),
          singleDigitChangesTested: tested,
          singleDigitErrorsCaught: caught,
          singleDigitErrorsMissed: missed,
          adjacentSwapsTested: code.length - 1,
          undetectedAdjacentSwaps,
          why:
            "Every digit has weight 1 or 3, and both are coprime to 10, so changing one digit by c changes the sum by c or 3c - never a multiple of 10 unless c is 0. " +
            "Swapping neighbours a and b changes the sum by ±2(a − b), which is 0 mod 10 when the two digits differ by 5.",
        };
      },
    },
  };
}

/** What the core says about the code the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported UPC state version ${stateVersion}`);
  const C = core();
  const savedDigits = numArray(state, "digits");
  const here = C.start({ digits: savedDigits });
  const s = C.sums(here.digits);
  const explored = C.result({ ...here, changed: state.changed === true }) !== null;
  return {
    digits: savedDigits,
    cursor: num(state, "cursor", 0),
    moves: num(state, "moves", 0),
    changed: state.changed === true,
    code: here.digits.join(""),
    checkDigit: here.digits[C.LENGTH - 1],
    valid: C.valid(savedDigits),
    oddPositionsSum: s.odd,
    evenPositionsSum: s.even,
    weightedSum: s.weighted,
    totalIncludingCheckDigit: s.weighted + here.digits[C.LENGTH - 1],
    modules: C.modules(here).length,
    explored,
    note: `3×${s.odd} + ${s.even} + ${here.digits[C.LENGTH - 1]} = ${s.weighted + here.digits[C.LENGTH - 1]}, a multiple of 10; ${explored ? "the player has changed a digit" : "no digit has been changed yet"}.`,
  };
}
