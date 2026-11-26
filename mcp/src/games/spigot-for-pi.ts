/*
 * run_game_logic actions and saved-position reader for The Spigot Algorithm for Pi. The core
 * lives in spigot-for-pi/ and is copied into src/generated/cores/ at build time. See _shared.ts
 * for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["spigot-for-pi"].SpigotForPiCore;

/** Runs the spigot for n digits, noting the steps where 9s were held and where a 10 carried back. */
function trace(n: number) {
  const C = core();
  const s = C.start(n);
  const held: number[] = [], carries: number[] = [];
  while (!s.done) {
    const nines = s.nines, before = s.digits.length, p = s.p;
    C.iterate(s);
    if (s.nines > nines) held.push(s.iterations);
    if (p >= 0 && s.p === 0 && s.digits.length > before && s.digits[before] === String(p + 1)) carries.push(s.iterations);
  }
  return { digits: s.digits, places: s.len, iterations: s.iterations, passesThatHeldA9: held.slice(0, 20), passesWhereA10Carried: carries.slice(0, 20), note: "pass k computes the k-th digit of the mixed-radix conversion; held digits are printed later" };
}

export function actions(): GameActions {
  return {
    digits: {
      describe: "Runs the Rabinowitz-Wagon spigot for the first n digits of pi (1..3000) as the page does, with [10n/3] + 1 places: the digits, the number of passes, and the passes at which a 9 was held back or a digit 10 carried into the held digits.",
      args: '{ "n": 40 }',
      run: (args) => {
        const n = Math.round(num(args, "n", 40));
        if (n < 1 || n > 3000) throw new Error("n must be 1..3000 here (the page goes to 50,000)");
        return trace(n);
      },
    },
  };
}

export function position(state: Json): unknown {
  const n = Math.round(num(state, "n", 1000)), soFar = Math.round(num(state, "digitsSoFar", 0));
  const shown = Math.min(soFar, 3000);
  return {
    asked: n, digitsSoFar: soFar, finished: state.done === true,
    chunk: num(state, "chunk", 5), font: num(state, "font", 15),
    lastDigits: shown ? core().run(shown).slice(-20) : "",
    placesInTheArray: Math.floor((10 * n) / 3) + 1,
  };
}
