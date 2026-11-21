/*
 * run_game_logic actions and saved-position reader for the Josephus Flavius game.
 *
 * N people in a circle; counting from the top, every k-th is removed until one is left. The survivor's
 * place follows J(m) = (J(m - 1) + k) mod m; for k = 2 it is 2L + 1 where n = 2^m + L (1-based).
 * Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["flavius"].FlaviusCore;
const nk = (args: Json) => {
  const n = Math.trunc(num(args, "n", 40)), k = Math.trunc(num(args, "k", 3));
  if (n < 3 || n > 50) throw new Error("n (how many people) runs from 3 to 50");
  if (k < 1 || k > 50) throw new Error("k (every which) runs from 1 to 50");
  return { n, k };
};

export function actions(): GameActions {
  return {
    safe_place: {
      describe: "The safe place in the Josephus game with n people (3 to 50) when every k-th is removed (k 1 to 50): the survivor's place counted from 1 at the top, going round, the order in which the others are removed, and the recurrence and (for k = 2) the closed form that give the same answer. The page's story is n = 40, k = 3 (or 41 with a friend).",
      args: '{ "n": 40, "k": 3 }',
      run: (args) => {
        const C = core();
        const { n, k } = nk(args);
        const r = C.simulate(n, k);
        const out: Record<string, unknown> = {
          n, k,
          safePlaceFromTop: r.survivor + 1,
          removedInOrder: r.order.slice(0, n - 1).map((p: number) => p + 1),
          recurrenceAgrees: C.safePlace(n, k) === r.survivor,
          recurrence: "J(1) = 0, J(m) = (J(m - 1) + k) mod m, counting places from 0 at the top",
        };
        if (k === 2) { let m = 1; while (m * 2 <= n) m *= 2; out.closedForm = `n = ${m} + ${n - m}, so the survivor is 2 x ${n - m} + 1 = ${2 * (n - m) + 1}`; }
        return out;
      },
    },
    when_removed: {
      describe: "When the person in a given place (1 to n, counted from the top) is removed, for n people and every k-th: how many people were removed before them, or that they are the survivor.",
      args: '{ "n": 40, "k": 3, "place": 1 }',
      run: (args) => {
        const C = core();
        const { n, k } = nk(args);
        const place = Math.trunc(num(args, "place", 1));
        if (place < 1 || place > n) throw new Error(`place runs from 1 to ${n}`);
        const r = C.simulate(n, k);
        const at = r.order.indexOf(place - 1) + 1;
        return at === n ? { place, survives: true, note: "this is the safe place: the last person counted, who is not removed" } : { place, survives: false, removedNumber: at, peopleLeftThen: n - at, note: `the ${at}${at === 1 ? "st" : at === 2 ? "nd" : at === 3 ? "rd" : "th"} person to go` };
      },
    },
  };
}

/** What the core says about the game as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 30), k: num(state, "k", 3) });
  const r = C.simulate(s.n, s.k);
  const sel = Math.trunc(num(state, "selected", -1));
  const picked = sel >= 0 && sel < s.n ? sel : null;
  return {
    people: s.n,
    everyWhich: s.k,
    safePlaceFromTop: r.survivor + 1,
    yourPlaceFromTop: picked === null ? null : picked + 1,
    youWouldSurvive: picked === null ? null : picked === r.survivor,
    youAreRemovedNumber: picked === null || picked === r.survivor ? null : r.order.indexOf(picked) + 1,
    removedSoFar: num(state, "hits", 0),
    finished: state.finished === true,
    survived: state.survived === true,
    moves: num(state, "moves", 0),
  };
}
