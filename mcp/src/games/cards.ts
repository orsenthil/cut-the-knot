/*
 * run_game_logic actions and saved-position reader for the number-guessing
 * cards. Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cards"].CardsCore;

function readState(args: Json) {
  const C = core();
  const bit = num(args, "bit", 1) === 0 ? 0 : 1;
  return { ...C.start({ bit }), cardNo: Math.max(0, Math.min(C.BITS, Math.trunc(num(args, "cardNo", 0)))) };
}

export function actions(): GameActions {
  return {
    card_numbers: {
      describe:
        "List the numbers printed on one of the seven cards, where each card is one binary digit and `bit` chooses which of the two groups it shows.",
      args: '{ "cardNo": 0, "bit": 1 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        return {
          cardNo: state.cardNo,
          bit: state.bit,
          digit: 1 << state.cardNo,
          numbers: C.cardNumbers(state),
          note: `Card ${state.cardNo + 1} lists the numbers whose ${state.cardNo + 1}st binary digit is ${state.bit}.`,
        };
      },
    },
    guess_number: {
      describe:
        "Play the whole seven-card trick honestly for a chosen secret number and show that the seven yes/no answers recover it.",
      args: '{ "secret": 54, "bit": 1 }',
      run: (args) => {
        const C = core();
        const secret = Math.trunc(num(args, "secret", 54));
        if (secret < 1 || secret >= C.MAX) throw new Error(`secret must be 1 to ${C.MAX - 1}`);
        let state = readState({ bit: args.bit === 0 ? 0 : 1 });
        const answers: { card: number; answer: string; numbers: number[] }[] = [];
        while (!state.done) {
          const numbers = C.cardNumbers(state);
          const reply = C.correctAnswer(secret, state);
          answers.push({ card: state.cardNo + 1, answer: reply, numbers });
          const next = C.answer(state, reply);
          if (!next) break;
          state = next;
        }
        return {
          secret,
          answers,
          guess: state.guess,
          correct: state.guess === secret,
          message: C.reveal(state),
          note: state.guess === secret
            ? `Seven answers rebuilt the binary digits of ${secret}.`
            : "The answers were inconsistent, so the announced number is not the secret.",
        };
      },
    },
  };
}

/** What the core says about the card currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readState(state);
  return {
    cardNo: here.cardNo,
    bit: here.bit,
    result: Number(state.result) || 0,
    done: state.done === true,
    guess: state.guess === null || state.guess === undefined ? null : state.guess,
    numbers: Array.isArray(state.card) ? state.card : C.cardNumbers(here),
    note: here.done
      ? `The seven answers announce ${state.guess}.`
      : `Card ${here.cardNo + 1} of ${C.BITS} shows the numbers with binary digit ${here.cardNo + 1} equal to ${here.bit}.`,
  };
}
