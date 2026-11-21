/*
 * run_game_logic actions and saved-position reader for the Life-like
 * automaton. The core lives in life-like-automaton/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["life-like-automaton"].LifeLikeAutomatonCore;
function read(args: Json) {
  const birth = Array.isArray(args.birth) ? args.birth.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 8) : [3];
  const survival = Array.isArray(args.survival) ? args.survival.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 8) : [2, 3];
  const size = Number.isFinite(args.size) ? num(args, "size") : 20;
  return { size, birth, survival, preset: typeof args.preset === "string" ? args.preset : null };
}

export function actions(): GameActions {
  return {
    step: {
      describe: "Apply one generation of a Life-like rule B.../S... to an encoded board.",
      args: '{ "encoded": "00000/11100/00000/00000/00000", "birth": [3], "survival": [2,3] }',
      run: (args) => {
        const C = core();
        const input = read(args);
        let state = C.start(input);
        if (typeof args.encoded === "string") {
          const rows = args.encoded.split("/").map((r) => r.split("").map((c) => c === "1"));
          if (rows.length && rows[0].length === rows.length) {
            state = C.start({ size: rows.length, cells: rows, birth: input.birth, survival: input.survival });
          }
        }
        const next = C.step(state);
        return {
          rule: C.ruleString(next), generation: next.generation,
          population: C.population(next),
          cells: next.cells.map((row: boolean[]) => row.map((v) => v ? 1 : 0).join("")).join("/"),
          note: "An empty cell is born when its count is in B; a live cell survives when it is in S.",
        };
      },
    },
    preset: {
      describe: "Report the birth and survival sets of a named Life-like rule.",
      args: '{ "name": "highlife" }',
      run: (args) => {
        const name = String(args.name || "conway");
        const presets = core().PRESETS as Record<string, { birth: number[]; survival: number[]; label: string }>;
        const preset = presets[name];
        if (!preset) throw new Error("unknown preset");
        return { name, label: preset.label, birth: preset.birth, survival: preset.survival, rule: `B${preset.birth.join("")}/S${preset.survival.join("")}` };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const input = read(state);
  return {
    birth: input.birth, survival: input.survival,
    rule: `B${input.birth.join("")}/S${input.survival.join("")}`,
    size: input.size,
    note: "Life-like rule read from the saved position.",
  };
}
