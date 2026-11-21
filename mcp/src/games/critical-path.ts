/*
 * run_game_logic actions and saved-position reader for Critical Path and
 * Scheduling.
 *
 * A project is tasks with durations and "comes after" lists. The critical
 * path is the longest Start-to-End chain; a priority list schedules the tasks
 * on 2 to 5 processors. Every answer below comes from the game's real core
 * (critical-path/ in the site). See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["critical-path"].CriticalPathCore;

type Task = { name: string; duration: number; after: string[] };

/** Tasks from the arguments (an array of {name, duration, after}), or the page's own project. */
function readTasks(args: Json): { tasks: Task[]; endAfter: string[] | null } {
  const C = core();
  if (!Array.isArray(args.tasks)) return { tasks: C.START_TASKS, endAfter: C.START_END_AFTER };
  const tasks = (args.tasks as Json[]).map((t) => ({
    name: String(t.name ?? "").trim(),
    duration: Number(t.duration),
    after: Array.isArray(t.after) ? (t.after as unknown[]).map((a) => String(a).trim()).filter((a) => a) : String(t.after ?? "").split(/[ ,]+/).filter((a) => a),
  }));
  return { tasks, endAfter: null };
}

export function actions(): GameActions {
  return {
    critical_path: {
      describe:
        "Find the critical path of a project: the applet's BackFlow enumeration of Start-to-End paths, the first one with the largest total duration, with a dynamic-programming check of its length. Omit tasks for the page's own project.",
      args: '{ "tasks": [ { "name": "A", "duration": 3, "after": [] }, { "name": "B", "duration": 4, "after": ["A"] } ] }',
      run: (args) => {
        const C = core();
        const { tasks, endAfter } = readTasks(args);
        const problems = C.check(tasks);
        if (problems.length) return { valid: false, problems };
        const cp = C.criticalPath(tasks, endAfter);
        const p = C.paths(tasks, endAfter);
        return {
          valid: true,
          criticalPath: cp.path.filter((n: string) => n !== "Start" && n !== "End"),
          length: cp.length,
          longestPathByDynamicProgramming: C.longestPath(tasks, endAfter),
          distinctPathsStartToEnd: new Set(p.all.map((x: string[]) => x.join(" "))).size,
          note: "No schedule, on any number of processors, can finish before the critical path. If two chains tie, the applet keeps the first it finds.",
        };
      },
    },
    schedule: {
      describe:
        "Schedule a project on 2 to 5 processors with a priority list (task names in order), exactly as the applet's recursive scheduler does: each free processor takes the first task in the list whose predecessors are done. Returns each processor's timeline and the finishing time against the critical path and the work bound. The list must name every task. Omit tasks for the page's project.",
      args: '{ "processors": 2, "list": "B E A D F I H C G" }',
      run: (args) => {
        const C = core();
        const { tasks, endAfter } = readTasks(args);
        const problems = C.check(tasks);
        if (problems.length) return { valid: false, problems };
        const np = Math.max(2, Math.min(5, Math.trunc(num(args, "processors", 2))));
        const parsed = C.parseList(String(args.list ?? tasks.map((t: Task) => t.name).join(" ")), tasks);
        if (!parsed.ok) return { valid: false, note: `The priority list must name every task. Missing: ${parsed.missing.join(", ")}.` };
        const s = C.schedule(tasks, np, parsed.list);
        const cp = C.criticalPath(tasks, endAfter).length;
        const work = tasks.reduce((a: number, t: Task) => a + t.duration, 0);
        return {
          valid: true,
          processors: np,
          priorityList: parsed.list,
          timelines: s.processors,
          finish: s.finish,
          criticalPathLength: cp,
          workBound: Math.ceil(work / np),
          meetsCriticalPath: s.finish === cp,
          note: `Finishes at ${s.finish}. No schedule can beat max(critical path ${cp}, ceil(total work ${work} / ${np}) = ${Math.ceil(work / np)}).`,
        };
      },
    },
  };
}

/** What the core says about the project as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const tasks = (Array.isArray(state.tasks) ? (state.tasks as Json[]) : []).map((t) => ({
    name: String(t.name ?? ""), duration: Number(t.duration), after: Array.isArray(t.after) ? (t.after as unknown[]).map(String) : [],
  }));
  const endAfter = Array.isArray(state.endAfter) ? (state.endAfter as unknown[]).map(String) : null;
  const procs = Math.max(2, Math.min(5, Math.trunc(num(state, "procs", 2))));
  const problems = tasks.length ? C.check(tasks) : [];
  const out: Record<string, unknown> = {
    tasks: tasks.length,
    processors: procs,
    showCritical: state.showCritical === true,
    priorityList: typeof state.list === "string" ? state.list : "",
    valid: problems.length === 0,
    problems,
    scheduled: state.scheduled === true,
    finish: typeof state.finish === "number" ? state.finish : null,
    moves: num(state, "moves", 0),
  };
  if (tasks.length && !problems.length) {
    const cp = C.criticalPath(tasks, endAfter);
    out.criticalPath = cp.path.filter((n: string) => n !== "Start" && n !== "End");
    out.criticalPathLength = cp.length;
    out.totalWork = tasks.reduce((a, t) => a + t.duration, 0);
    out.lowerBoundOnFinish = Math.max(cp.length, Math.ceil((out.totalWork as number) / procs));
    out.note = out.finish === null
      ? `The critical path is ${(out.criticalPath as string[]).join(" -> ")} (${cp.length}); no schedule can finish before ${out.lowerBoundOnFinish}.`
      : `The schedule finishes at ${out.finish}; the critical path is ${cp.length}${out.finish === cp.length ? ", so it cannot be improved" : ""}.`;
  }
  return out;
}
