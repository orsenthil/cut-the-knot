/*
 * run_game_logic actions and saved-position reader for Two Numbers. The core
 * lives in two-numbers/ and is copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["two-numbers"].TwoNumbersCore;
type Core = ReturnType<typeof core>;

/** A whole-number seed; the page draws its two numbers from one at random. */
function seedOf(args: Json): number {
  const seed = num(args, "seed", 1);
  if (!Number.isSafeInteger(seed)) throw new Error("seed must be a whole number");
  return seed;
}

type Puzzle = { n: number; m: number; odd1: boolean; odd2: boolean };

/** The two lines the applet draws, which tell the player where the odd multiplier goes. */
function instructionText(C: Core, s: Puzzle): string {
  const words = C.instruction(s);
  return `Multiply your number by an ${words.chosenWord} number and the other by an ${words.otherWord} number.`;
}

/**
 * Everything the core can read from a sum for a given puzzle. The instruction
 * (odd2) says whether the player's number gets the odd multiplier. If so, the
 * sum has the player's number's parity; otherwise it has the other number's
 * parity. The even product is always even, so it cannot change that parity.
 */
function reading(C: Core, s: Puzzle, sum: number) {
  const words = C.instruction(s);
  const announced = C.announce(s, sum);
  const remainder = C.javaRem(sum, 2);
  const parity = remainder === 0 ? "even" : "odd";
  const evenNumber = s.n % 2 === 0 ? s.n : s.m;
  const oddNumber = s.n % 2 === 0 ? s.m : s.n;
  // An even honest sum reveals the even number when your own multiplier is
  // odd, and the odd number when the other number's multiplier is odd.
  const honestPick = words.chosenWord === "odd"
    ? (parity === "even" ? evenNumber : oddNumber)
    : (parity === "even" ? oddNumber : evenNumber);
  return {
    n: s.n, m: s.m, evenNumber, oddNumber,
    instruction: instructionText(C, s),
    sum, remainder, parity,
    announced: announced.number, matches: announced.matches, text: announced.text,
    honestPick,
  };
}

export function actions(): GameActions {
  return {
    puzzle: {
      describe: "Generate the two numbers for a seed (the same draw the page makes) and show the multiplication instruction. Using odd multiplier 3 and even multiplier 2, it works out the honest sum for picking each number and the number the real Guess announces for that sum: an even number times anything is even, the odd number is odd only with an odd multiplier, so the sum's parity identifies which number got the odd multiplier.",
      args: '{ "seed": 207057721 }',
      run: (args) => {
        const C = core();
        const seed = seedOf(args);
        const s = C.start({ seed });
        const words = C.instruction(s);
        const examples = [s.n, s.m].map((pick) => {
          const other = pick === s.n ? s.m : s.n;
          const pickMultiplier = words.chosenWord === "odd" ? 3 : 2;
          const otherMultiplier = words.otherWord === "odd" ? 3 : 2;
          const sum = pick * pickMultiplier + other * otherMultiplier;
          const r = reading(C, s, sum);
          return {
            pick, other, pickMultiplier, otherMultiplier, sum,
            parity: r.parity, announced: r.announced, right: r.announced === pick,
          };
        });
        return {
          seed, n: s.n, m: s.m,
          evenNumber: s.n % 2 === 0 ? s.n : s.m,
          oddNumber: s.n % 2 === 0 ? s.m : s.n,
          instruction: instructionText(C, s),
          examples,
          why: "An even number times any whole number is even, and the odd number turns even when multiplied by an even number. Adding an even product cannot change the other product's parity, so the sum is odd exactly when the odd number received the odd multiplier. The instruction tells you whether that was your number or the other one; the applet itself reads only the sum's parity, never its size or which card you marked.",
        };
      },
    },
    check_sum: {
      describe: "For the puzzle made by `seed`, validate a typed `sum` and, if given, the number `pick` the player meant. Returns the sum's parity, the number the real Guess announces, which number an honest sum of that parity reveals, and whether the pick agrees. With 'your number × odd' an honest sum has your number's parity; with 'your number × even' it has the other number's parity. The applet ignores the sum's size, and Java's remainder sends a negative odd sum down the even branch.",
      args: '{ "seed": 207057721, "sum": 12, "pick": 8 }',
      run: (args) => {
        const C = core();
        const seed = seedOf(args);
        const sum = Math.trunc(num(args, "sum"));
        if (!Number.isSafeInteger(sum)) throw new Error("sum must be a whole number");
        const s = C.start({ seed });
        const after = C.guess(s, sum);
        const r = reading(C, s, sum);
        const pick = args.pick === undefined || args.pick === null
          ? null : Math.trunc(num(args, "pick"));
        if (pick !== null && pick !== s.n && pick !== s.m) {
          throw new Error(`pick must be one of the two numbers, ${s.n} or ${s.m}`);
        }
        const expectedParity = pick === null ? null : (pick % 2 === 0 ? "even" : "odd");
        // If your own multiplier is odd the sum shares your number's parity;
        // if it is even the sum shares the other number's opposite parity.
        const honestParity = expectedParity === null ? null
          : C.instruction(s).chosenWord === "odd" ? expectedParity
          : (expectedParity === "even" ? "odd" : "even");
        return {
          ...r,
          guesses: after.guesses,
          pick,
          honestParity,
          plausible: honestParity === null ? null : honestParity === r.parity,
          appletNamesYourPick: pick === null ? null : r.announced === pick,
          note: "Type a sum of the opposite parity and Guess will confidently name the other number: it reads what you typed, not your working.",
        };
      },
    },
  };
}

/** What the core says about a position the page saved with Track.state. */
export function position(state: Json, _stateVersion: number): unknown {
  const C = core();
  const seed = seedOf({ seed: state.seed ?? 1 });
  const base = C.start({ seed });
  const s: Puzzle = {
    n: Math.trunc(num(state, "n", base.n)),
    m: Math.trunc(num(state, "m", base.m)),
    odd1: state.odd1 === undefined ? base.odd1 : state.odd1 === true,
    odd2: state.odd2 === undefined ? base.odd2 : state.odd2 === true,
  };
  const sum = state.sum === undefined || state.sum === null ? null : num(state, "sum");
  const r = sum === null ? null : reading(C, s, sum);
  const announced = state.announced === undefined || state.announced === null
    ? null : num(state, "announced");
  const announcement = state.announcement === undefined || state.announcement === null
    ? null : String(state.announcement);
  return {
    // The fields the page saved.
    seed, n: s.n, m: s.m, odd1: s.odd1, odd2: s.odd2,
    sum, announcement, announced, guesses: Math.trunc(num(state, "guesses", 0)),
    // What the core makes of them.
    evenNumber: s.n % 2 === 0 ? s.n : s.m,
    oddNumber: s.n % 2 === 0 ? s.m : s.n,
    instruction: instructionText(C, s),
    reading: r,
    agreesWithSaved: r !== null && announced !== null ? r.announced === announced : null,
    finished: C.result({ ...s, announcement }) === "done",
    note: "The saved sum's parity alone drives the announcement: an odd sum names the odd number, an even sum the even number, read through the instruction about which number got the odd multiplier. The size of the sum and the marked card are never consulted.",
  };
}
