/*
 * run_game_logic actions and saved-position reader for Scheduling and
 * Critical Path. The core lives in critical-path-scheduling/ and is copied
 * into src/generated/cores/ at build time. See _shared.ts for the module
 * shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["critical-path-scheduling"].CriticalPathSchedulingCore;
function read(args: Json) {
  const presets = core().PRESETS as Record<string, unknown>;
  const preset = typeof args.preset === "string" && presets[args.preset] ? args.preset : "merge";
  const state = core().start(preset);
  return {
    ...state,
    processors: Number.isFinite(args.processors) ? num(args, "processors") : state.processors,
    priority: Array.isArray(args.priority) ? args.priority.map(String) : state.priority,
  };
}

export function actions(): GameActions {
  return {
    critical_path: {
      describe: "Find the longest-duration route from Start to End and the slack of each task.",
      args: '{ "preset": "merge" }',
      run: (args) => {
        const C = core();
        const state = read(args);
        const c = C.critical(state);
        const times = C.times(state);
        return {
          length: c.length, path: c.path, earliest: c.earliest,
          slack: Object.fromEntries(Object.entries(times).map(([id, v]) => [id, v.slack])),
          note: "Critical tasks have zero slack; the path length is a lower bound on any schedule.",
        };
      },
    },
    schedule: {
      describe: "List-schedule the tasks on a number of processors using a priority list.",
      args: '{ "preset": "merge", "processors": 2, "priority": ["A","B","C"] }',
      run: (args) => {
        const C = core();
        const state = read(args);
        const s = C.schedule(state, state.priority, state.processors);
        return {
          priority: s.priority, processors: s.processors, makespan: s.makespan,
          assignments: s.assignments, criticalLength: C.critical(state).length,
          note: "Ready tasks go to free processors in priority order, respecting all precedences.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const input = read(state);
  const r = C.analyze(input);
  return {
    preset: input.preset, processors: input.processors, priority: input.priority,
    criticalLength: r.critical.length, criticalPath: r.critical.path,
    makespan: r.schedule.makespan,
    note: `Critical path ${r.critical.length}; schedule ${r.schedule.makespan}.`,
  };
}
