/*
 * Tutor actions and position reader for Fish Soup.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const S = cores["soup-fish"].SoupFishCore;
  return {
    best_move: {
      describe: "The applet's bestMove for a position (optional seed suppresses the 1-in-10 mistake when 0).",
      args: '{ "you": 1, "computer": 16, "seed": 0 }',
      run: (args) => {
        const state = S.restore({
          you: num(args, "you", 0),
          computer: num(args, "computer", 0),
          perm: (args.perm as number[]) || [0, 1, 2, 3, 4, 5, 6, 7, 8],
        });
        const seed = Number(args.seed);
        const rnd = Number.isFinite(seed) ? () => seed : Math.random;
        const move = S.bestMove(state, rnd);
        return {
          move,
          word: move >= 0 ? S.WORDS[move] : null,
          status: S.status(state),
        };
      },
    },
    line_letter: {
      describe: "Shared letter for a winning mask, or null.",
      args: '{ "mask": 7 }',
      run: (args) => {
        const mask = num(args, "mask", 7);
        return { mask, letter: S.winningLetter(mask), isWon: S.isWon(mask) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const S = cores["soup-fish"].SoupFishCore;
  const you = num(state, "you", 0);
  const computer = num(state, "computer", 0);
  const game = S.restore({ ...state, you, computer });
  const st = S.status(game);
  return {
    finished: Boolean(state.over) || Boolean(st),
    you,
    computer,
    result: state.result ?? st,
    winLetter: state.winLetter ?? (st && st !== "stalemate" ? S.winningLetter(st === "you" ? you : computer) : null),
    legalMoves: S.legalMoves(game).length,
    note: st
      ? st === "stalemate"
        ? "Stalemate."
        : `${st === "you" ? "You" : "Computer"} won${game.winLetter ? ` (${game.winLetter})` : ""}.`
      : `Your bits ${you}, computer ${computer}.`,
  };
}
