/*
 * run_game_logic actions and saved-position reader for Proizvolov's Identity.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const P = cores["proizvolov-game"].ProizvolovGameCore;
  return {
    verify_split: {
      describe:
        "For a pick of N numbers from 1..2N, return the decreasing and increasing columns, each absolute difference, and whether the sum equals N².",
      args: '{ "n": 4, "picked": [8, 1, 5, 3] }',
      run: (args) => {
        const n = num(args, "n", 4);
        const picked = numArray(args, "picked");
        if (picked.length !== n) throw new Error(`picked must have exactly ${n} numbers`);
        let s = P.start({ n });
        for (const v of picked) s = P.pick(s, v);
        if (!P.complete(s)) throw new Error("could not complete the pick (duplicates or out of range?)");
        const sum = P.pairSum(s);
        const pairs = P.pairsSplitLowHigh(s);
        return {
          n,
          left: P.left(s),
          right: P.right(s),
          pairs,
          sum,
          expected: P.expected(n),
          holds: sum === P.expected(n),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const P = cores["proizvolov-game"].ProizvolovGameCore;
  const game = P.restore(state);
  const base = {
    n: game.n,
    picked: game.picked.slice(),
    left: P.left(game),
    remainingToPick: Math.max(0, game.n - game.picked.length),
  };
  if (!P.complete(game)) {
    return { finished: false, ...base, note: "Pick " + (game.n - game.picked.length) + " more numbers." };
  }
  const sum = P.pairSum(game);
  return {
    finished: true,
    ...base,
    right: P.right(game),
    sum,
    expected: P.expected(game.n),
    holds: sum === P.expected(game.n),
    pairs: P.pairsSplitLowHigh(game),
    note: "Proizvolov's identity: the sum of absolute paired differences is N².",
  };
}
