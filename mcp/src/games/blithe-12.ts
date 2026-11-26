/*
 * run_game_logic actions and saved-position reader for Blithe 12.
 *
 * Twelve counters sit on three overlapping circles, six on each. Two knobs on
 * each circle turn it one step clockwise or anticlockwise (six turns in all).
 * The real core is blithe-12/blithe-12-core.js, copied into
 * src/generated/cores/ at build time. The page's theorem, checked exhaustively
 * in porting/check-blithe-12.mjs with a stabilizer chain, is that those six
 * turns generate every one of the 12! orders, so any arrangement can be put
 * back. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

interface BlitheState {
  mode: number;
  home: number[];
  values: number[];
  moves: number;
  hint: boolean;
}

/** The part of Blithe12Core this reader uses (the JS core is untyped). */
interface BlitheCoreShape {
  N: number;
  CIRCLES: number[][];
  CONTROLLERS: Array<{ counter: number; circle: number; dir: number }>;
  MODE_NAMES: string[];
  PALETTE: string[];
  homeValues: (mode: number) => number[];
  start: (options?: { mode?: number; hint?: boolean }) => BlitheState;
  legalMoves: () => Array<{ circle: number; dir: number }>;
  move: (state: BlitheState, m: { circle: number; dir: number }) => BlitheState | null;
  turn: (values: number[], circle: number, dir: number) => number[];
  isHome: (state: BlitheState) => boolean;
  cycles: (values: number[]) => string;
}

const core = () => cores["blithe-12"].Blithe12Core as unknown as BlitheCoreShape;
const CIRCLE_NAMES = ["left", "right", "bottom"];

/** The menu has five puzzles, numbered 0..4 as in the applet. */
function modeOf(args: Json, key: string): number {
  const v = num(args, key, 4);
  const m = Math.trunc(v);
  if (!Number.isInteger(m) || m < 0 || m > 4) {
    throw new Error(`"${key}" must be a puzzle mode from 0 to 4, got ${JSON.stringify(args[key])}`);
  }
  return m;
}

function isNumbered(values: number[]): boolean {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted.every((v, i) => v === i + 1);
}

/** Twelve counters: counter numbers 1..12 in the last puzzle, colour indices elsewhere. */
function counterValues(args: Json, key: string, mode: number): number[] {
  const C = core();
  const v = numArray(args, key);
  if (v.length !== C.N) throw new Error(`"${key}" must list ${C.N} counters, got ${v.length}`);
  if (!v.every(Number.isInteger)) throw new Error(`"${key}" must be whole counter numbers`);
  if (mode === 4) {
    if (!isNumbered(v)) throw new Error(`"${key}" must be a permutation of 1..12 in the 12 Numbers puzzle`);
  } else if (!v.every((x) => x >= 0 && x < C.PALETTE.length)) {
    throw new Error(`"${key}" must be colour indices from 0 to ${C.PALETTE.length - 1} in this puzzle`);
  }
  return v;
}

/** Which of the applet's six knobs makes a given turn. */
function knobFor(circle: number, dir: number): string {
  const h = core().CONTROLLERS.find((c) => c.circle === circle && c.dir === dir);
  return h ? `counter ${h.counter + 1}` : "no knob";
}

export function actions(): GameActions {
  return {
    puzzles_and_turns: {
      describe:
        "The five puzzles in the menu and the six turns that move the counters. Each puzzle only relabels the same twelve seats: 2 colours, 4 colours (middle or border), 6 colours, and 12 numbered counters. Three overlapping circles hold six counters each; two knobs per circle spin it clockwise (dir 1) or anticlockwise (dir -1), giving six turns in all. Each turn is a 6-cycle, such as (148962) for a clockwise turn of the left circle, so six turns of a circle bring it back; one 6-cycle is odd, so no parity trap blocks an arrangement, and the six turns generate all 12! orders.",
      args: "{}",
      run: () => {
        const C = core();
        const numbered = Array.from({ length: C.N }, (_, i) => i + 1);
        const modes = C.MODE_NAMES.map((name, i) => {
          const home = C.homeValues(i);
          return {
            index: i,
            name,
            home,
            homeOnBoard: home.map((v) => (i === 4 ? v : C.PALETTE[v])),
          };
        });
        const circles = C.CIRCLES.map((seats, i) => ({
          circle: i,
          name: CIRCLE_NAMES[i],
          counters: seats.map((s) => s + 1),
        }));
        const knobs = C.CONTROLLERS.map((h) => ({
          counter: h.counter + 1,
          circle: CIRCLE_NAMES[h.circle],
          dir: h.dir,
          way: h.dir > 0 ? "clockwise" : "anticlockwise",
        }));
        const sixTurns = C.legalMoves().map((m) => {
          let repeated = numbered;
          for (let k = 0; k < 6; k++) repeated = C.turn(repeated, m.circle, m.dir);
          return {
            circle: CIRCLE_NAMES[m.circle],
            dir: m.dir,
            way: m.dir > 0 ? "clockwise" : "anticlockwise",
            knob: knobFor(m.circle, m.dir),
            cycle: C.cycles(C.turn(numbered, m.circle, m.dir)),
            backAfterSixTurns: repeated.every((v, i) => v === numbered[i]),
          };
        });
        return {
          modes,
          circles,
          knobs,
          sixTurns,
          note:
            "The menu changes only the labels, not the geometry: counter numbers 1..12 in mode 4 stand for the colours of the other modes, so a numbered solution solves every colour puzzle. In cycle notation (148962) means counter 1 has taken counter 4's old seat, 4 has taken 8's, and so on. A 6-cycle is an odd permutation, so both odd and even orders can be reached; the six turns generate the full symmetric group on twelve counters, and every starting order can be put back.",
        };
      },
    },

    turn: {
      describe:
        "Apply one of the six turns to a board and say where its six counters go, whether all twelve are home afterwards, and what order the board reads in cycle notation. circle is 0 (left), 1 (right) or 2 (bottom); dir is 1 (clockwise) or -1 (anticlockwise). In the 12 Numbers puzzle values must be the twelve counter numbers 1..12 in seat order (leave values out to start from home); in the colour puzzles they are colour indices.",
      args: '{ "mode": 4, "values": [4,1,3,8,5,2,7,9,6,10,11,12], "circle": 0, "dir": -1 }',
      run: (args) => {
        const C = core();
        const mode = modeOf(args, "mode");
        const fresh = C.start({ mode });
        const values = args.values === undefined || args.values === null
          ? fresh.home
          : counterValues(args, "values", mode);
        const circle = Math.trunc(num(args, "circle"));
        if (!Number.isInteger(circle) || circle < 0 || circle > 2) {
          throw new Error('"circle" must be 0 (left), 1 (right) or 2 (bottom)');
        }
        const dir = num(args, "dir");
        if (dir !== 1 && dir !== -1) throw new Error('"dir" must be 1 (clockwise) or -1 (anticlockwise)');
        const moves = Math.trunc(num(args, "moves", 0));
        if (!Number.isInteger(moves) || moves < 0) throw new Error('"moves" must be a whole number of turns, 0 or more');
        const next = C.move({ mode, home: fresh.home, values, moves, hint: false }, { circle, dir });
        if (!next) throw new Error("the core rejected that turn");
        const numbered = mode === 4 && isNumbered(values);
        return {
          mode,
          modeName: C.MODE_NAMES[mode],
          turn: {
            circle,
            circleName: CIRCLE_NAMES[circle],
            dir,
            way: dir > 0 ? "clockwise" : "anticlockwise",
            knob: knobFor(circle, dir),
          },
          before: values,
          after: next.values,
          moves: next.moves,
          allHome: C.isHome(next),
          cyclesBefore: numbered ? C.cycles(values) : null,
          cyclesAfter: numbered ? C.cycles(next.values) : null,
          sixSeats: C.CIRCLES[circle].map((i) => ({
            counter: i + 1,
            before: values[i],
            after: next.values[i],
          })),
          note:
            `Turning the ${CIRCLE_NAMES[circle]} circle ${dir > 0 ? "clockwise" : "anticlockwise"} shifts its six counters one seat; knob ${knobFor(circle, dir)} makes exactly this turn. ` +
            (numbered
              ? `The board reads ${C.cycles(values)} before and ${C.cycles(next.values)} after (a lone (n) means counter n is on its own seat). `
              : "Cycle notation is only meaningful for the numbered puzzle, where every counter has a different label. ") +
            (C.isHome(next) ? "All twelve counters are home." : "The counters are not all home yet."),
        };
      },
    },
  };
}

/** What the core says about the board the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Blithe 12 state version ${stateVersion}`);
  const C = core();
  const mode = modeOf(state, "mode");
  const home = counterValues(state, "home", mode);
  const values = counterValues(state, "values", mode);
  const moves = Math.trunc(num(state, "moves", 0));
  if (!Number.isInteger(moves) || moves < 0) throw new Error('"moves" must be a whole number of turns, 0 or more');
  const s: BlitheState = { mode, home, values, moves, hint: state.hint === true };
  const numbered = mode === 4 && isNumbered(values);
  const misplaced = values
    .map((v, i) => ({ counter: i + 1, shows: v, homeSeat: home[i] }))
    .filter((x) => x.shows !== x.homeSeat);
  const finishingTurns = C.legalMoves().flatMap((m) => {
    const next = C.move(s, m);
    return next && C.isHome(next)
      ? [{ circle: CIRCLE_NAMES[m.circle], dir: m.dir, knob: knobFor(m.circle, m.dir) }]
      : [];
  });
  const cycles = numbered ? C.cycles(values) : null;
  const turnText = finishingTurns.length
    ? ` One turn can put every counter home: ${finishingTurns.map((t) => `${t.circle} circle ${t.dir > 0 ? "clockwise" : "anticlockwise"} (knob ${t.knob})`).join("; ")}.`
    : " No single turn puts everything home.";
  return {
    stateVersion,
    mode,
    modeName: C.MODE_NAMES[mode],
    home,
    values,
    moves,
    hint: s.hint,
    homeMatchesMode: home.every((v, i) => v === C.homeValues(mode)[i]),
    allHome: C.isHome(s),
    misplaced,
    cycles,
    circles: C.CIRCLES.map((seats, i) => ({
      circle: i,
      name: CIRCLE_NAMES[i],
      seats: seats.map((j) => ({ counter: j + 1, shows: values[j], homeSeat: home[j] })),
    })),
    finishingTurns,
    note:
      `Saved in ${C.MODE_NAMES[mode]} after ${moves} turns. ` +
      (C.isHome(s) ? "All twelve counters are home." : `${misplaced.length} counters are off their home seats. `) +
      (cycles ? `The order reads ${cycles} in cycle notation.` : "Cycle notation applies to the numbered puzzle only.") +
      turnText,
  };
}
