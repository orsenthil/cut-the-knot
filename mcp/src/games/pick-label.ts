/*
 * run_game_logic actions and saved-position reader for Box Labels (PickLabel).
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const P = cores["pick-label"].PickLabelCore;
  return {
    classic_solve: {
      describe:
        "Solve a Box Labels deal with the page's strategy: open the WB-labelled box, then place the three labels. Pass a seed via random values by omitting args for a fresh deal.",
      args: "{}",
      run: () => {
        let state = P.start({});
        const wb = state.labels.indexOf(P.WB);
        state = P.pickBox(state, wb);
        const revealed = state.revealed;
        if (!revealed) throw new Error("expected a revealed ball after opening a box");
        const mustBe = revealed.color === 0 ? P.WW : P.BB;
        const otherSame = mustBe === P.WW ? P.BB : P.WW;
        const boxes = [0, 1, 2].filter((i) => i !== wb);
        const labelledOther = boxes.find((i) => state.labels[i] === otherSame)!;
        const last = boxes.find((i) => i !== labelledOther)!;
        state = P.assignGuess(state, wb, mustBe);
        state = P.assignGuess(state, labelledOther, P.WB);
        state = P.assignGuess(state, last, otherSame);
        const verified = P.verify(state);
        return {
          openedBox: wb,
          revealed: revealed.color === 0 ? "white" : "black",
          guesses: verified.guesses.map((g: number) => P.NAMES[g]),
          won: verified.won,
        };
      },
    },
    derangement_count: {
      describe: "How many wrong-label assignments the three-box puzzle has (derangements of 3).",
      args: "{}",
      run: () => ({
        contentPermutations: P.CONTENT_PERMS.length,
        labelDerangements: P.LABEL_DERANGEMENTS.length,
        deals: P.CONTENT_PERMS.length * P.LABEL_DERANGEMENTS.length,
      }),
    },
  };
}

export function position(state: Json): unknown {
  const P = cores["pick-label"].PickLabelCore;
  const phase = num(state, "phase", 0);
  const names = ["select", "label", "verify", "done"];
  return {
    phase: names[phase] ?? String(phase),
    announce: String(state.announce ?? ""),
    picked: state.picked,
    revealed: state.revealed ?? null,
    guesses: Array.isArray(state.guesses)
      ? (state.guesses as (number | null)[]).map((g) => (g === null || g === undefined ? null : P.NAMES[g as number]))
      : [],
    open: Boolean(state.open),
    won: Boolean(state.won),
    score: { wins: num(state, "wins", 0), games: num(state, "games", 0) },
    note: String(state.announce ?? P.CAPTIONS[phase] ?? ""),
  };
}
