/*
 * Tutor actions and saved-position reader for Lucky 7.
 *
 * Both use the same core as the browser page (lucky7/lucky7-core.js), copied
 * into src/generated/cores/ at build time. See _shared.ts for the shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

interface State {
  n: number;
  values: number[];
  solved: boolean;
  moves: number;
}

const core = () => cores.lucky7.Lucky7Core;

const factorial = (n: number): number => {
  let out = 1;
  for (let k = 2; k <= n; k++) out *= k;
  return out;
};

/** Ordinary cycle notation; the core's cycles() is the applet's IgnoreZero view. */
function plainCycles(values: number[]): string {
  const n = values.length - 1;
  const seen = new Array<boolean>(n + 1).fill(false);
  let out = "";
  for (let i = 1; i <= n; i++) {
    if (seen[i]) continue;
    let k = i;
    let first = true;
    out += "(";
    do {
      out += (first ? "" : " ") + k;
      first = false;
      seen[k] = true;
      k = values[k];
    } while (!seen[k] && k >= 1 && k <= n);
    out += ")";
  }
  return out;
}

/** Parity of the arrangement of counters 1..n (place 0 is the empty place). */
function inversionParity(values: number[]): "even" | "odd" {
  let inversions = 0;
  for (let i = 1; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (values[i] > values[j]) inversions++;
    }
  }
  return inversions % 2 === 0 ? "even" : "odd";
}

/** How many of the six shifts it takes to come back home: its order as a cycle. */
function generatorOrder(n: number, id: string): number {
  const S = core();
  let state = S.start({ n }) as State;
  for (let k = 1; k <= 200; k++) {
    const next = S.move(state, id) as State | null;
    if (!next) throw new Error(`unknown Lucky 7 shift "${id}"`);
    state = next;
    if (S.isHome(state.values)) return k;
  }
  throw new Error(`shift "${id}" did not return home at n=${n}`);
}

const componentCache = new Map<number, number>();

/** Exhaustive BFS over arrangements, using only the page's own shift core. */
function componentSize(n: number): number {
  const cached = componentCache.get(n);
  if (cached !== undefined) return cached;
  const S = core();
  const home = S.start({ n }) as State;
  const seen = new Set<string>([home.values.slice(1).join(",")]);
  const queue: number[][] = [home.values.slice()];
  for (let at = 0; at < queue.length; at++) {
    for (const id of S.MOVE_IDS as string[]) {
      const next = S.move({ n, values: queue[at], solved: false, moves: 0 }, id) as State | null;
      if (!next) continue;
      const key = next.values.slice(1).join(",");
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next.values.slice());
      }
    }
  }
  componentCache.set(n, seen.size);
  return seen.size;
}

export function actions(): GameActions {
  const S = core();
  // The applet's names: a = left ring, b = right ring, c = everything;
  // b^-1 = rightP and c^-1 = circM.
  const a = "leftM";
  const b = "rightM";
  const bi = "rightP";
  const c = "circP";
  const ci = "circM";
  const nWord = [a, a, bi, a, a, bi, a, a, b, a, a, b]; // aab^-1 aab^-1 aabaab
  const mWord = [a, a, b, a, a, b, a, a, b, a, a, b, a, a, b]; // (aab)^5

  const play = (ids: string[]): State => {
    let state = S.start({ n: 7 }) as State;
    for (const id of ids) {
      const next = S.move(state, id) as State | null;
      if (!next) throw new Error(`unknown Lucky 7 shift "${id}"`);
      state = next;
    }
    return state;
  };

  const reading = (label: string, word: string, ids: string[]) => {
    const state = play(ids);
    return {
      label,
      word,
      shifts: ids.length,
      values: state.values.slice(),
      cycles: plainCycles(state.values),
      appletCycles: S.cycles(state),
    };
  };

  const pairOf = (values: number[]): number[] => {
    const moved: number[] = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i] !== i) {
        moved.push(i, values[i]);
      }
    }
    return [...new Set(moved)].sort((x, y) => x - y);
  };

  return {
    parity_components: {
      describe:
        "Wilson's parity split for Lucky 7 at 3, 5, 7 and 9 counters: the order and parity of each of the six ring shifts, and how many of the n! arrangements are reachable from home (an exhaustive search through the real core). At 5 and 9 every shift is even, so turning the rings reaches only the even half; at 3 and 7 an odd shift exists and all arrangements are reachable.",
      args: '{ "sizes": [3, 5, 7, 9] }',
      run: (args) => {
        const raw = args.sizes === undefined ? [3, 5, 7, 9] : args.sizes;
        if (!Array.isArray(raw) || raw.length === 0 || raw.length > 4) {
          throw new Error("sizes must be an array of one to four odd sizes from 3 to 9");
        }
        const sizes = raw.map((value, i) => {
          const n = Number(value);
          if (!Number.isInteger(n) || n < 3 || n > 9 || n % 2 === 0) {
            throw new Error(`sizes[${i}] must be one of 3, 5, 7, 9`);
          }
          return n;
        });
        const sizesRead = sizes.map((n) => {
          const generators: Record<string, { order: number; parity: string }> = {};
          let allEven = true;
          for (const id of S.MOVE_IDS as string[]) {
            const order = generatorOrder(n, id);
            // A k-cycle has parity k-1, so an odd order is an even permutation.
            const parity = order % 2 === 1 ? "even" : "odd";
            generators[id] = { order, parity };
            if (parity === "odd") allEven = false;
          }
          const reachable = componentSize(n);
          const total = factorial(n);
          return {
            n,
            generators,
            reachableFromHome: reachable,
            totalArrangements: total,
            reachableClass: allEven ? "even permutations only" : "all permutations",
            halfOrAll: reachable === total ? "all" : "half",
            note: allEven
              ? `n=${n}: all six shifts are even permutations, so the rings reach ${total / 2} of the ${total} arrangements — Wilson's parity split.`
              : `n=${n}: at least one shift is odd, so its conjugate can swap two counters and all ${total} arrangements are reachable.`,
          };
        });
        return {
          sizes: sizesRead,
          summary:
            "The size decides the answer: when n is 1 modulo 4 every shift is even and only half the arrangements are reachable (5 gives 60 of 120, 9 gives 181440 of 362880); when n is 3 modulo 4 an odd shift exists and every arrangement is reachable (3 gives 6, 7 gives 5040). Seven is the lucky size.",
        };
      },
    },

    swap_word: {
      describe:
        "Bogomolny's permutation proof at seven counters, run through the real shifts: n = aab⁻¹aab⁻¹aabaab and m = (aab)^5 give two transpositions, cmc⁻¹ moves one, and ncmc⁻¹ is the single adjacent swap (6 7). Conjugating by c^k moves that swap around the ring. Each step shows ordinary cycles alongside the applet's IgnoreZero cycles, where the highest counter stands in for the empty place and a cycle closes early.",
      args: '{ "k": 0 }',
      run: (args) => {
        const k = num(args, "k", 0);
        if (!Number.isInteger(k) || k < 0 || k > 6) throw new Error("k must be an integer from 0 to 6");
        const conjugate = [...Array(k).fill(c), ...nWord, c, ...mWord, ci, ...Array(k).fill(ci)];
        const swapped = play(conjugate);
        const allPairs = Array.from({ length: 7 }, (_, kk) => ({
          k: kk,
          pair: pairOf(
            play([...Array(kk).fill(c), ...nWord, c, ...mWord, ci, ...Array(kk).fill(ci)]).values,
          ),
        }));
        return {
          n: 7,
          k,
          steps: [
            reading("n", "aab^-1 aab^-1 aabaab", nWord),
            reading("m", "(aab)^5", mWord),
            reading("cmc^-1", "c (aab)^5 c^-1", [c, ...mWord, ci]),
            reading("ncmc^-1", "n c (aab)^5 c^-1", [...nWord, c, ...mWord, ci]),
          ],
          conjugatedSwap: {
            k,
            pair: pairOf(swapped.values),
            values: swapped.values.slice(),
            cycles: plainCycles(swapped.values),
            appletCycles: S.cycles(swapped),
          },
          allAdjacentPairs: allPairs,
          note:
            `n = (1)(2 4)(3)(5)(6 7) and m = (1 3)(2)(4)(5)(6)(7); ncmc^-1 is the single swap (6 7), and conjugating by c^${k} gives the pair (${pairOf(swapped.values).join(" ")}). ` +
            "A transposition generates every permutation, which is why all 5040 arrangements are reachable at seven counters. The Cycles box prints IgnoreZero cycles: counter 7 stands in for the empty top place, so a cycle that reaches 7 closes there and may print differently from ordinary cycle notation.",
        };
      },
    },
  };
}

/**
 * Echo the fields Track.state saved ({ n, values, solved, moves }) plus the
 * core's reading of that arrangement: home test, both cycle views, the parity
 * of the permutation and whether the ring shifts can reach it.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Lucky 7 state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Lucky 7 position must be an object");
  }
  const S = core();
  const n = S.normalizeN(num(state, "n", 7));
  const values = numArray(state, "values");
  if (values.length !== n + 1) {
    throw new Error(`Lucky 7 values must have ${n + 1} entries (place 0 and ${n} counters), got ${values.length}`);
  }
  const seen = new Set<number>();
  for (let i = 0; i < values.length; i++) {
    if (!Number.isInteger(values[i]) || values[i] < 0 || values[i] > n || seen.has(values[i])) {
      throw new Error(`Lucky 7 values must be a permutation of 0..${n}`);
    }
    seen.add(values[i]);
  }
  const game: State = {
    n,
    values: values.slice(),
    solved: state.solved === true,
    moves: num(state, "moves", 0),
  };
  const atHome = S.isHome(game.values);
  const cycles = S.cycles(game);
  const ordinaryCycles = plainCycles(game.values);
  const parity = inversionParity(game.values);
  const reachableByTurning = n % 4 === 1 ? parity === "even" : true;

  return {
    ...state,
    n: game.n,
    values: game.values.slice(),
    solved: game.solved,
    moves: game.moves,
    stateVersion,
    atHome,
    result: S.result(game),
    cycles,
    ordinaryCycles,
    cycleViewDiffers: cycles !== ordinaryCycles,
    inversionParity: parity,
    reachableByTurning,
    shifts: S.legalMoves(game),
    controlPlaces: (S.MOVE_IDS as string[]).map((id) => {
      const index = S.controlIndex(n, id) as number;
      return { shift: id, place: S.placeName(n, index), index };
    }),
    note:
      `Track.state saved n, the ${n + 1} counter values (place 0 is the empty top place), whether the counters are home, and the move count. ` +
      `The core reads this arrangement as ${ordinaryCycles} (${parity} permutation); the Cycles box uses the applet's IgnoreZero rule, printing ${cycles}` +
      (cycles !== ordinaryCycles
        ? ", which closes a cycle early because the highest counter stands in for the empty place."
        : ".") +
      (reachableByTurning
        ? ` At n=${n}, ${n % 4 === 1 ? "this even arrangement lies in the reachable half" : "an odd shift is available, so every arrangement is reachable"}.`
        : ` At n=${n}, all six shifts are even, so this odd arrangement cannot be reached by turning the rings — only Cheat can produce it.`),
  };
}
