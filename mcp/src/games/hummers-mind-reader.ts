/*
 * run_game_logic actions and saved-position reader for Hummer's Mind Reader.
 * The core lives in hummers-mind-reader/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["hummers-mind-reader"].HummersCore;

export function actions(): GameActions {
  return {
    announce_after_swaps: {
      describe: "Start with penny, nickel, dime in order (coins 0, 1, 2), apply the announced swaps (pairs of coin numbers) and say which coin the computer names: the one left in its own place, or null when none or all three are. A play ending in the original order after the secret swap always names the thought.",
      args: '{ "swaps": [[2, 0], [1, 2], [2, 0]] }',
      run: (args) => {
        const sw = args.swaps;
        if (!Array.isArray(sw)) throw new Error('"swaps" must be a list of [a, b] pairs of coins 0..2');
        let s = core().start();
        for (const p of sw as number[][]) { const a = Number(p?.[0]), b = Number(p?.[1]); if (![0, 1, 2].includes(a) || ![0, 1, 2].includes(b) || a === b) throw new Error("each swap needs two different coins 0..2"); s = core().swap(s, a, b); }
        const w = core().whichOne(s);
        return { places: s.pos, named: w === -1 ? null : core().NAMES[w], inPlace: w === -1 ? null : w };
      },
    },
  };
}

export function position(state: Json): unknown {
  const pos = state.pos as number[];
  const s = { pos, selected: state.selected as number[], announcement: null };
  const w = core().whichOne(s);
  return {
    places: pos, coinInItsOwnPlace: w === -1 ? null : core().NAMES[w], announced: state.announcement !== null && state.announcement !== undefined,
    note: "The announced swaps multiply to the inverse of the secret first swap, which is that swap: the one coin left in its place is the one thought of.",
  };
}
