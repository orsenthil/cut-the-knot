/*
 * run_game_logic actions and saved-position reader for The Monty Hall Problem.
 * The core lives in monty-hall/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["monty-hall"].MontyCore;

export function actions(): GameActions {
  return {
    odds: {
      describe: "The exact odds by counting the 9 equally likely (car, first pick) cases, and a simulation of rounds: staying wins 1/3, switching 2/3 when the host knows and always opens a goat door.",
      args: '{ "rounds": 100000 }',
      run: (args) => {
        const rounds = Math.min(1000000, Math.max(1, Math.floor(num(args, "rounds", 100000))));
        let stay = 0, sw = 0;
        for (let car = 0; car < 3; car++) for (let p = 0; p < 3; p++) { if (p === car) stay++; if (core().switchTo(car, p) === car) sw++; }
        let s = core().start();
        for (let i = 0; i < rounds; i++) s = core().pick(s, Math.floor(Math.random() * 3));
        const r = core().rates(s) as { stay: number; switch: number };
        return { exactStayWins: `${stay}/9`, exactSwitchWins: `${sw}/9`, rounds, simulatedStay: r.stay, simulatedSwitch: r.switch };
      },
    },
    host_and_switch: {
      describe: "Given the car's door and your pick (0..2): the door the host opens and the door you would switch to.",
      args: '{ "car": 0, "pick": 1 }',
      run: (args) => { const car = Math.floor(num(args, "car")), p = Math.floor(num(args, "pick")); return { hostOpens: core().hostOpens(car, p), switchTo: core().switchTo(car, p), switchWins: core().switchTo(car, p) === car }; },
    },
  };
}

export function position(state: Json): unknown {
  const trials = Number(state.trials);
  return {
    rounds: trials, stayedWon: state.stayedWon, stayedLost: state.stayedLost, switchedWon: state.switchedWon, switchedLost: state.switchedLost,
    shareStayWon: trials ? Number(state.stayedWon) / trials : null, shareSwitchWon: trials ? Number(state.switchedWon) / trials : null,
    note: "Switching wins exactly when the first pick was wrong: 2 times in 3.",
  };
}
