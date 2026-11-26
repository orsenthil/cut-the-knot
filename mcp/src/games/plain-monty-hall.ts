/*
 * run_game_logic actions and saved-position reader for Plain Monty Hall. The core lives in
 * plain-monty-hall/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["plain-monty-hall"].PlainMontyHallCore;

export function actions(): GameActions {
  return {
    odds: {
      describe: "Count every case (car, first pick, the host's coin when he has two goats) and simulate rounds of the two-click game: staying wins 1/3, switching 2/3, and the four counts come in equal pairs.",
      args: '{ "rounds": 30000 }',
      run: (args) => {
        const C = core();
        let stay = 0, sw = 0, total = 0;
        for (let car = 0; car < 3; car++) for (let first = 0; first < 3; first++) for (const coin of [0.25, 0.75]) {
          const s = C.click(C.start({ prize: car }), first, () => coin);
          const other = C.legalMoves(s).find((d: number) => d !== first);
          total++;
          if (C.result(C.click(s, first)) === "win") stay++;
          if (C.result(C.click(s, other)) === "win") sw++;
        }
        const rounds = Math.min(200000, Math.max(1, Math.floor(num(args, "rounds", 30000))));
        let s = C.start({});
        for (let i = 0; i < rounds; i++) {
          s = C.click(s, Math.floor(Math.random() * 3));
          const choices = C.legalMoves(s);
          s = C.click(s, choices[Math.floor(Math.random() * choices.length)]);
        }
        return { exactStayWins: `${stay}/${total}`, exactSwitchWins: `${sw}/${total}`, rounds, counts: { stayedWon: s.stayedWon, stayedLost: s.stayedLost, switchedWon: s.switchedWon, switchedLost: s.switchedLost }, simulated: C.rates(s) };
      },
    },
    host: {
      describe: "Given the car's door and the first pick (0..2): the door the host opens (a coin decides between two goats when the pick is the car) and the door to switch to.",
      args: '{ "car": 0, "first": 1 }',
      run: (args) => {
        const C = core();
        const car = Math.floor(num(args, "car")), first = Math.floor(num(args, "first"));
        if (![car, first].every((d) => d >= 0 && d <= 2)) throw new Error("doors are 0, 1, 2");
        const opens = first === car ? [0, 1, 2].filter((d) => d !== car) : [C.hostOpens(car, first)];
        return { hostMayOpen: opens, switchWins: first !== car };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = state as { prize: number | null; first: number | null; opened: number | null; final: number | null; trials: number; stayedWon: number; stayedLost: number; switchedWon: number; switchedLost: number };
  const stage = s.first === null ? "pick a door" : s.final === null ? "stay or switch" : "doors open";
  const r = C.rates({ trials: Number(s.trials), stayedWon: Number(s.stayedWon), switchedWon: Number(s.switchedWon) });
  return {
    stage, firstPick: s.first, hostOpened: s.opened, finalChoice: s.final, car: s.final === null ? "hidden" : s.prize,
    rounds: s.trials, stayedWon: s.stayedWon, stayedLost: s.stayedLost, switchedWon: s.switchedWon, switchedLost: s.switchedLost,
    shareSwitchWon: r ? r.switch : null,
    note: "Switching wins exactly when the first pick was a goat: 2 times in 3. Switched-and-lost always equals stayed-and-won.",
  };
}
