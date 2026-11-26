/*
 * run_game_logic actions and saved-position reader for The 1089 Trick.
 * The core lives in s1089/ and is copied into src/generated/cores/ at build
 * time. It keeps the number as digits in writing order, so the same code
 * handles any base. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["s1089"].S1089Core;
const GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Base and digit length, checked against the applet's option ranges. */
function options(args: Json, fallbackDigits: number) {
  const C = core();
  const base = Math.round(num(args, "base", 10));
  if (base < C.MIN_BASE || base > C.MAX_BASE) throw new Error(`base must be ${C.MIN_BASE}..${C.MAX_BASE}`);
  const digitCount = Math.round(num(args, "digitCount", fallbackDigits));
  if (digitCount < C.MIN_DIGITS || digitCount > C.MAX_DIGITS) {
    throw new Error(`digitCount must be ${C.MIN_DIGITS}..${C.MAX_DIGITS}`);
  }
  return { base, digitCount };
}

/** The constant answer for one, two or three digits in base b (null beyond). */
function constantAnswer(C: ReturnType<typeof core>, base: number, digitCount: number): string | null {
  const b = BigInt(base);
  if (digitCount === 1) return "0";
  if (digitCount === 2) return C.valueToText(b * b - 1n, base); // (b-1)(b-1), i.e. 99 in base ten
  if (digitCount === 3) return C.valueToText((b + 1n) * (b + 1n) * (b - 1n), base); // 10uv, 1089 in base ten
  return null;
}

/** One or two sentences a tutor can say about why the answer came out so. */
function explain(base: number, digitCount: number, palindrome: boolean, expected: string | null): string {
  if (palindrome) {
    return "The number reads the same backwards, so the subtraction gives zero; the constant answer needs a nonzero difference.";
  }
  if (digitCount === 3) {
    return `Reversing the number cancels its middle digit, so the difference is x${GLYPHS[base - 1]}y with the two outside digits adding to ${base - 1}. Adding that to its own reversal gives 10uv in base ${base}, which is ${expected}${base === 10 ? "" : " (1089 in base ten)"}.`;
  }
  if (digitCount === 2) {
    return `With two digits the difference is a multiple of ${GLYPHS[base - 1]}, and padding it before reversing makes the sum ${expected}${base === 10 ? "" : " (99 in base ten)"}.`;
  }
  if (digitCount === 1) return "With one digit the reversal is the same digit, so the difference and the answer are both zero.";
  return `The constant answer belongs to one, two or three digits; with ${digitCount} digits the answer depends on the number chosen.`;
}

/** Read the number to try: a string of digits (letters work past 9) or an array of digit values. */
function readDigits(args: Json, base: number, digitCount: number): number[] | string {
  const C = core();
  const raw = args.digits;
  if (raw === undefined || raw === null) throw new Error('missing required argument "digits"');
  if (Array.isArray(raw)) {
    const all = numArray(args, "digits").map(Math.round);
    if (all.some((d) => d < 0 || d >= base)) throw new Error(`digits must be in 0..${base - 1} for base ${base}`);
    return all.slice(-digitCount);
  }
  const text = String(raw).trim().toUpperCase();
  if (C.textToValue(text, base) === -1n) throw new Error(`digits must be written in base ${base}`);
  return text;
}

export function actions(): GameActions {
  return {
    trick: {
      describe:
        "Run the reverse-subtract-reverse-add trick on a number and show all five lines: the start, its reversal, their difference, that difference's reversal, and the answer. For three digits the difference has the form x(b-1)y with x+y=b-1, so the answer is always (b+1)^2(b-1) — 1089 in base ten, 10uv in base b — unless the number is a palindrome, which gives zero.",
      args: '{ "digits": "732", "base": 10, "digitCount": 3 }',
      run: (args) => {
        const C = core();
        const raw = args.digits;
        const fallback = Array.isArray(raw) ? raw.length : String(raw ?? "").trim().length || 3;
        const { base, digitCount } = options(args, fallback);
        const digits = readDigits(args, base, digitCount);
        const s = C.start({ base, digitCount, digits, autonomous: args.autonomous === true });
        const lines = C.compute(s);
        const palindrome = lines.b === C.valueToText(0n, base);
        const expected = palindrome ? "0" : constantAnswer(C, base, s.digitCount);
        return {
          base: s.base,
          digitCount: s.digitCount,
          digits: s.digits,
          autonomous: s.autonomous,
          start: lines.a,
          reversedStart: lines.aPrime,
          difference: lines.b,
          reversedDifference: lines.bPrime,
          answer: lines.c,
          answerValue: lines.value.toString(),
          palindrome,
          expected,
          why: explain(base, s.digitCount, palindrome, expected),
        };
      },
    },
    check_all: {
      describe:
        "Try every one-, two- or three-digit number in a base from 2 to 36 and report whether one answer holds for all of them. Palindromes give zero; every other three-digit number gives (b+1)^2(b-1), written 10uv in base b (1089 in base ten).",
      args: '{ "base": 10, "digitCount": 3 }',
      run: (args) => {
        const C = core();
        const { base, digitCount } = options(args, 3);
        if (digitCount > 3) throw new Error("check_all supports one to three digits");
        const expected = constantAnswer(C, base, digitCount) as string;
        const counts = new Map<string, number>();
        let palindromes = 0;
        const total = base ** digitCount;
        for (let n = 0; n < total; n++) {
          const text = C.valueToText(BigInt(n), base);
          const padded = "0".repeat(Math.max(0, digitCount - text.length)) + text;
          const lines = C.compute(C.start({ base, digitCount, digits: padded }));
          counts.set(lines.c, (counts.get(lines.c) ?? 0) + 1);
          if (lines.b === "0") palindromes++;
        }
        const distinctAnswers = [...counts.keys()].sort();
        return {
          base,
          digitCount,
          tested: total,
          distinctAnswers,
          expected,
          palindromes,
          exceptions: distinctAnswers.filter((a) => a !== expected && a !== "0"),
          holds: distinctAnswers.every((a) => a === expected || a === "0"),
          note: `Every answer is ${expected} except for the ${palindromes} palindromes, which give 0.`,
        };
      },
    },
  };
}

/** Explain the position the page saved with Track.state (see s1089/s1089.js). */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported S1089 state version ${stateVersion}`);
  const C = core();
  const { base, digitCount } = options(state, 3);
  let digits: number[];
  if (Array.isArray(state.digits)) digits = numArray(state, "digits").map(Math.round);
  else if (Array.isArray(state.lines) && typeof state.lines[0] === "string") {
    digits = [...state.lines[0].toUpperCase()].map((ch) => Number(C.textToValue(ch, base))).filter((d) => d >= 0);
  } else digits = [1];
  const s = C.start({ base, digitCount, digits, autonomous: state.autonomous === true });
  const lines = C.compute(s);
  const palindrome = lines.b === C.valueToText(0n, base);
  const expected = palindrome ? "0" : constantAnswer(C, base, s.digitCount);
  return {
    base: s.base,
    digitCount: s.digitCount,
    digits: s.digits,
    autonomous: s.autonomous,
    lines: [lines.a, lines.aPrime, lines.b, lines.bPrime, lines.c],
    explored: state.explored === true,
    result: C.result({ ...s, explored: state.explored === true }),
    answer: lines.c,
    palindrome,
    expected,
    why: explain(base, s.digitCount, palindrome, expected),
  };
}
