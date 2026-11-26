/*
 * run_game_logic actions and saved-position reader for Very Tiles. The core lives in
 * very-tiles/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 *
 * The page saves the whole core state with Track.state(state): twelve problems, each with one
 * number rubbed out, and the answers the player has placed in them. The applet's shuffle sends
 * answer k to cell perm[k-1]+1, and that cell's hidden answer (its key) is also the answer the
 * problem there needs. The two star rows are the applet's check: the upper one shows each cell's
 * hidden key, the lower one the number placed in the cell, so they line up exactly when every
 * match is right.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["very-tiles"].VeryTilesCore;
type State = ReturnType<ReturnType<typeof core>["start"]>;

/** Validate the seed and the applet's shuffle index, then build that board. */
function board(args: Json): State {
  const C = core();
  const seed = Math.trunc(num(args, "seed", 1));
  if (seed < 1) throw new Error("seed must be a positive whole number");
  const pattern = Math.trunc(num(args, "pattern", 0));
  if (pattern < 0 || pattern >= C.NPERMS) throw new Error(`pattern must be a whole number from 0 to ${C.NPERMS - 1}`);
  return C.start({ seed, pattern });
}

/** A proposed answer row: one entry per cell, a number 1..12 or null for a gap. */
function proposedAnswers(args: Json): (number | null)[] {
  const n = core().COUNT;
  const raw = args.answers;
  if (!Array.isArray(raw)) throw new Error("answers must be an array of twelve entries (numbers 1..12 or null)");
  if (raw.length !== n) throw new Error(`answers must have ${n} entries, one per problem cell`);
  return raw.map((x, i) => {
    if (x === null || x === undefined) return null;
    const v = Number(x);
    if (!Number.isInteger(v) || v < 1 || v > n) {
      throw new Error(`answers[${i}] must be a whole number from 1 to ${n}, or null`);
    }
    return v;
  });
}

/** The saved answer row, where a gap in the real state is null rather than 0. */
function savedAnswers(state: Json, count: number): (number | null)[] {
  if (!Array.isArray(state.answers)) return new Array(count).fill(null);
  return state.answers.map((x) => (x === null || x === undefined ? null : Number(x)));
}

export function actions(): GameActions {
  return {
    problems: {
      describe:
        "The twelve equations on the board for a seed and one of the applet's 21 fixed shuffles, each with its hidden answer. The answers 1..12 occur exactly once each, scattered among the cells; shuffle[i] gives the cell (1..12) that hides answer i+1. Every equation really has that number as its missing value.",
      args: '{ "seed": 70706, "pattern": 0 }',
      run: (args) => {
        const C = core();
        const s = board(args);
        return {
          seed: s.seed,
          pattern: s.pattern,
          shuffle: (s.perm as number[]).map((cell) => cell + 1),
          problems: (s.problems as { text: string; answer: number }[]).map((p, pos) => ({
            cell: pos + 1,
            equation: p.text,
            answer: p.answer,
            glyph: C.shape(p.answer),
          })),
          note: "Each answer 1..12 is used once. Pick the tile with that number and then the problem it completes; press Pattern to compare the hidden answers with the ones you placed.",
        };
      },
    },
    pattern: {
      describe:
        "The two rows of stars the Pattern button draws for a proposed set of answers: a number n gets a colour from n mod 6 (1,2 blue; 3,4 green; 5,0 red) and a corner from n (1..6 on top, 7..12 below, odd on the right and even on the left). The upper row shows the hidden answer belonging to each problem cell; the lower row shows the answer proposed there, or the hidden answer while the cell is blank. They agree exactly when every placed answer is right.",
      args: '{ "seed": 70706, "pattern": 0, "answers": [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] }',
      run: (args) => {
        const C = core();
        const s = board(args) as unknown as Json;
        const answers = proposedAnswers(args);
        const proposed = { ...s, answers, mode: "pattern" } as unknown as State;
        const upper = C.pattern(proposed, "tiles") as { key: number; color: string; corner: string }[];
        const lower = C.pattern(proposed, "problems") as { key: number; color: string; corner: string }[];
        const wrong: { cell: number; placed: number; hidden: number }[] = [];
        for (let pos = 0; pos < C.COUNT; pos++) {
          const placed = answers[pos], hidden = upper[pos].key;
          if (placed !== null && placed !== hidden) wrong.push({ cell: pos + 1, placed, hidden });
        }
        const agree = C.patternsAgree(proposed);
        return {
          seed: proposed.seed,
          pattern: proposed.pattern,
          tilesPattern: upper,
          problemsPattern: lower,
          agree,
          wrong,
          note: agree
            ? "The rows match: every answer you placed is the one hidden in its problem."
            : `${wrong.length} of the placed answers do not match the hidden number, so the stars differ at those cells.`,
        };
      },
    },
  };
}

/** Describe the position the page saved with Track.state(state). */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Very Tiles state version ${stateVersion}`);
  const C = core();
  const seed = Math.trunc(num(state, "seed", 1));
  if (seed < 1) throw new Error("saved seed must be a positive whole number");
  const pattern = Math.trunc(num(state, "pattern", 0));
  if (pattern < 0 || pattern >= C.NPERMS) throw new Error(`saved pattern must be a whole number from 0 to ${C.NPERMS - 1}`);
  const fresh = C.start({ seed, pattern });

  const saved = {
    ...fresh,
    perm: Array.isArray(state.perm) ? numArray(state, "perm") : fresh.perm,
    keys: Array.isArray(state.keys) ? numArray(state, "keys") : fresh.keys,
    problems: Array.isArray(state.problems) ? state.problems : fresh.problems,
    tiles: Array.isArray(state.tiles) ? state.tiles : fresh.tiles,
    answers: savedAnswers(state, C.COUNT),
    selected: (state.selected && typeof state.selected === "object" ? state.selected : null) as State["selected"],
    mode: state.mode === "pattern" ? "pattern" : "tiles",
  } as unknown as State;

  const intended = (saved.keys as number[]).slice();
  const answers = saved.answers as (number | null)[];
  const blanks: number[] = [], wrong: { cell: number; placed: number; hidden: number }[] = [];
  for (let pos = 0; pos < C.COUNT; pos++) {
    if (answers[pos] === null) blanks.push(pos + 1);
    else if (answers[pos] !== intended[pos]) wrong.push({ cell: pos + 1, placed: answers[pos]!, hidden: intended[pos] });
  }
  const all = C.allAnswered(saved);
  const agree = C.patternsAgree(saved);
  return {
    // The fields the page saved, with the same names.
    pattern: saved.pattern,
    seed: saved.seed,
    perm: saved.perm,
    keys: saved.keys,
    problems: saved.problems,
    tiles: saved.tiles,
    answers,
    selected: saved.selected,
    mode: saved.mode,
    // What the core says about them.
    equations: (saved.problems as { text: string }[]).map((_, pos) => C.equation(saved, pos)),
    intended,
    answersPlaced: C.COUNT - blanks.length,
    blankCells: blanks,
    wrong,
    patternsAgree: agree,
    tilesPattern: C.pattern(saved, "tiles"),
    problemsPattern: C.pattern(saved, "problems"),
    result: C.result(saved),
    note: !all
      ? `${blanks.length} problems are still blank; fill all twelve, then press Pattern to compare the two rows of stars.`
      : agree
        ? "All twelve answers match the hidden numbers, so the two rows of stars are the same."
        : "All answers are placed, but some do not match the hidden numbers; the stars show which cells to check.",
  };
}
