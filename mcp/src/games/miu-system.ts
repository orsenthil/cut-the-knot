/*
 * run_game_logic actions and saved-position reader for The MIU System.
 * The core lives in miu-system/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["miu-system"].MIUCore;

export function actions(): GameActions {
  return {
    apply_rule: {
      describe: "Apply a rule (1: xI -> xIU, 2: Mx -> Mxx, 3: III -> U, 4: UU -> nothing) to a word, listing every result (rules 3 and 4 may fit in several places). MU is not a theorem: the number of I's is never a multiple of 3.",
      args: '{ "word": "MIIII", "rule": 3 }',
      run: (args) => {
        const word = String(args.word ?? "MI"), rule = Math.floor(num(args, "rule"));
        if (!/^M[IU]*$/.test(word)) throw new Error('"word" must be M followed by I and U letters');
        if (![1, 2, 3, 4].includes(rule)) throw new Error("rule must be 1..4");
        if (!core().applicable(word, rule)) return { word, rule, applicable: false, results: [] };
        const results = rule <= 2 ? [core().applyAt(word, rule, 0)] : core().places(word, rule).map((i: number) => core().applyAt(word, rule, i));
        return { word, rule, applicable: true, results: [...new Set(results)] };
      },
    },
    i_count: {
      describe: "The number of I's in a word and whether it is a multiple of 3 (a theorem never has that).",
      args: '{ "word": "MIIU" }',
      run: (args) => { const w = String(args.word ?? ""); const n = [...w].filter((c) => c === "I").length; return { word: w, iCount: n, multipleOfThree: n % 3 === 0, couldBeATheorem: n % 3 !== 0 && /^M[IU]*$/.test(w) }; },
    },
  };
}

export function position(state: Json): unknown {
  const top = String(state.top);
  const n = [...top].filter((c) => c === "I").length;
  return { theorems: state.count, newest: top, iCountOfNewest: n, iCountIsMultipleOfThree: n % 3 === 0, note: "The number of I's is never a multiple of 3, so MU can never be made." };
}
