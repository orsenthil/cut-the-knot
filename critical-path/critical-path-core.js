"use strict";

/*
 * Critical Path and Scheduling Using Priority Lists — the logic behind
 * Alexander Bogomolny's applet "CriticalPath"
 * (cut-the-knot.org/Curriculum/Combinatorics/CriticalPath.shtml).
 *
 * A project is a list of tasks. Each task has a name, a duration (a whole
 * number of at least 1) and the tasks that must come immediately before it
 * ("Comes after"; empty means it follows Start). Two more nodes are added: Start
 * before every task with no predecessor, and End after every task that nobody
 * waits for. The critical path is the chain from Start to End with the greatest
 * total duration: the project cannot finish sooner, however many people work.
 * A schedule hands the tasks to P processors using a priority list: whenever a
 * processor is free, it takes the first task in the list whose predecessors are
 * all done.
 *
 * The applet's method, kept literally: BackFlow lists every path from Start to
 * End by walking back from End through each node's predecessors (a path is only
 * extended by a node it does not already contain); the critical path is the first
 * path in that list with strictly the largest total (a tie keeps the earlier
 * path). The scheduler (ProjectSchedule.RoutineStep) works at one moment t: first
 * every processor whose work ends at t finishes its task; then the ready tasks
 * (all predecessors finished, not yet started) are queued; the first queued task
 * in priority-list order goes to the lowest-numbered idle processor and the
 * moment stays t until no idle processor or no ready task is left; then t jumps
 * to the earliest end among the busy processors. It stops at a StopTime (100) or
 * when nothing can run. Tasks not named in the list are never run, and the applet
 * draws no schedule unless the list names every task.
 *
 * Applet facts kept: the processors are 2 to 5 (opening 2); the opening project
 * is the page's: A3 B4 C2 D4 E12 F5 G12 H8 I4 with Start -> A, B; A -> C, D;
 * B -> E, F; C -> G; D -> H; E -> H; F -> I; H -> C; G, H, I -> End. Where the
 * applet leaves an order to a Java hash table (the order of End's predecessors) the
 * port uses the order of the table.
 *
 * No document, no window, no storage. The position is plain data.
 */
const CriticalPathCore = (() => {
  const START = "Start";
  const END = "End";
  const STOP_TIME = 100; // ProjectSchedule's default StopTime
  const MIN_PROCS = 2;
  const MAX_PROCS = 5;
  const START_PROCS = 2;

  /** The page's own project, from the applet's node[] and edge[] parameters. */
  const START_TASKS = [
    { name: "A", duration: 3, after: [] },
    { name: "B", duration: 4, after: [] },
    { name: "C", duration: 2, after: ["A", "H"] },
    { name: "D", duration: 4, after: ["A"] },
    { name: "E", duration: 12, after: ["B"] },
    { name: "F", duration: 5, after: ["B"] },
    { name: "G", duration: 12, after: ["C"] },
    { name: "H", duration: 8, after: ["D", "E"] },
    { name: "I", duration: 4, after: ["F"] },
  ];

  /**
   * The page's own graph also draws H -> End (edge[8] is "H,C,End"), so End's
   * predecessors are G, H, I there; a project built from the table has only
   * the tasks nobody waits for (G and I here).
   */
  const START_END_AFTER = ["G", "H", "I"];

  const clone = (tasks) => tasks.map((t) => ({ name: t.name, duration: t.duration, after: t.after.slice() }));

  /* ------------------------------------------------------------- checking */

  /** Problems with a task list, as the applet's checks find them: [] when fine. */
  function check(tasks) {
    const problems = [];
    const seen = new Set();
    tasks.forEach((t, i) => {
      const name = typeof t.name === "string" ? t.name.trim() : "";
      if (!name) problems.push({ row: i, field: "name", text: "Every task needs a name." });
      else if (name === START || name === END) problems.push({ row: i, field: "name", text: `"${name}" is reserved.` });
      else if (seen.has(name)) problems.push({ row: i, field: "name", text: `The name "${name}" is used twice.` });
      seen.add(name);
      if (!Number.isInteger(t.duration) || t.duration < 1) problems.push({ row: i, field: "duration", text: "A duration is a whole number, 1 or more." });
    });
    tasks.forEach((t, i) => {
      for (const a of t.after) {
        if (!seen.has(a)) problems.push({ row: i, field: "after", text: `"${a}" is not a task.` });
        else if (a === t.name) problems.push({ row: i, field: "after", text: "A task cannot come after itself." });
      }
    });
    if (problems.length === 0 && hasCycle(tasks)) problems.push({ row: -1, field: "after", text: "The tasks form a cycle: something must come first." });
    return problems;
  }

  function hasCycle(tasks) {
    const after = new Map(tasks.map((t) => [t.name, t.after]));
    const state = new Map(); // 1 = on the stack, 2 = done
    const visit = (n) => {
      if (state.get(n) === 2) return false;
      if (state.get(n) === 1) return true;
      state.set(n, 1);
      for (const a of after.get(n) || []) if (visit(a)) return true;
      state.set(n, 2);
      return false;
    };
    return tasks.some((t) => visit(t.name));
  }

  /* -------------------------------------------------------------- the graph */

  /** The graph with Start and End: each node's predecessors in the applet's order. */
  function graph(tasks, endAfter) {
    const names = tasks.map((t) => t.name);
    const hasChild = new Set();
    for (const t of tasks) for (const a of t.after) hasChild.add(a);
    const preds = new Map();
    const duration = new Map([[START, 0], [END, 0]]);
    preds.set(START, []);
    for (const t of tasks) {
      preds.set(t.name, t.after.length ? t.after.slice() : [START]); // empty "Comes after" means Start
      duration.set(t.name, t.duration);
    }
    preds.set(END, Array.isArray(endAfter) ? endAfter.slice() : names.filter((n) => !hasChild.has(n))); // Childless: nobody waits for them
    return { names, preds, duration };
  }

  /** The applet's BackFlow: all Start-to-End paths, built back from End, in its order. */
  function paths(tasks, endAfter) {
    const g = graph(tasks, endAfter);
    const hash = new Map();
    const value = (p) => p.reduce((s, n) => s + g.duration.get(n), 0);
    hash.set(END, [[END]]);
    const prepend = (pred, node) => {
      const from = hash.get(node);
      if (!from) return;
      const mine = hash.get(pred) || [];
      for (const bf of from) {
        if (!bf.includes(pred)) mine.push([pred, ...bf]); // Clone, Append (inserted at the front)
      }
      hash.set(pred, mine);
    };
    const compute = (node) => {
      if (node === START) return;
      for (const p of g.preds.get(node)) {
        prepend(p, node);
        compute(p);
      }
    };
    compute(END);
    return { all: hash.get(START) || [], value, g };
  }

  /** The critical path: the first path with strictly the largest total duration. */
  function criticalPath(tasks, endAfter) {
    const { all, value } = paths(tasks, endAfter);
    let best = null, bestValue = 0;
    for (const p of all) {
      const v = value(p);
      if (v > bestValue) { bestValue = v; best = p; }
    }
    return best ? { path: best, length: bestValue, pathsFound: all.length } : { path: [START, END], length: 0, pathsFound: all.length };
  }

  /** The longest path by dynamic programming: a second way to the same length. */
  function longestPath(tasks, endAfter) {
    const g = graph(tasks, endAfter);
    const memo = new Map();
    const finish = (n) => {
      if (n === START) return 0;
      if (memo.has(n)) return memo.get(n);
      let m = 0;
      for (const p of g.preds.get(n)) m = Math.max(m, finish(p));
      const v = m + g.duration.get(n);
      memo.set(n, v);
      return v;
    };
    return finish(END);
  }

  /* ----------------------------------------------------------- the schedule */

  /** Does a priority list name every task? (CheckPriorityList sets OK false otherwise.) */
  function parseList(text, tasks) {
    const names = new Set(tasks.map((t) => t.name));
    const tokens = String(text).split(/[ ,]+/).filter((s) => s.length);
    const list = tokens.filter((s) => s !== START && s !== END);
    const missing = tasks.map((t) => t.name).filter((n) => !list.includes(n));
    return { list, ok: missing.length === 0, missing, unknown: list.filter((n) => !names.has(n)), repeated: list.filter((n, i) => list.indexOf(n) !== i) };
  }

  /**
   * The applet's ProjectSchedule: np processors, a priority list (names), run until stopTime.
   * Returns each processor's tasks [{name, start, end}] and every task's start and end.
   */
  function schedule(tasks, np, list, stopTime) {
    const stop = stopTime === undefined ? STOP_TIME : stopTime;
    const g = graph(tasks);
    const byName = new Map(tasks.map((t) => [t.name, t]));
    // One symbol per list entry; a repeat or unknown name has no node and never runs.
    const used = new Set();
    const syms = list.map((name) => {
      const known = byName.has(name) && !used.has(name);
      used.add(name);
      return { name, node: known, duration: known ? byName.get(name).duration : 0, start: -1, end: -1, state: 0 }; // 0 ineligible, 1 ready, 2 executing, 3 completed
    });
    const symOf = new Map(syms.filter((s) => s.node).map((s) => [s.name, s]));
    const processors = Array.from({ length: np }, () => []);
    const timeReady = new Array(np).fill(0);
    const queue = [];
    const stateAt = (s, t) => (s.state === 0 ? 0 : s.state === 1 || s.state === 2 ? (t >= s.end ? 3 : t >= s.start ? 2 : 1) : s.state);
    const ready = (s) => {
      if (!s.node) return false;
      for (const p of g.preds.get(s.name)) {
        if (p === START) continue;
        const ps = symOf.get(p);
        if (!ps || ps.state !== 3) return false;
      }
      s.state = 1;
      queue.push(s);
      return true;
    };
    // The applet's recursion becomes a loop; the steps are the same.
    let t = 0;
    for (;;) {
      if (t > stop) break;
      for (let p = 0; p < np; p++) {
        if (timeReady[p] === t && processors[p].length) {
          const last = processors[p][processors[p].length - 1];
          if (stateAt(last, t) === 3) {
            last.state = 3;
            const i = queue.indexOf(last);
            if (i >= 0) queue.splice(i, 1);
          }
        }
      }
      for (const s of syms) if (s.state !== 3 && s.state !== 2 && !queue.includes(s)) ready(s);
      const next = syms.find((s) => queue.includes(s) && s.state !== 2);
      if (!next) {
        let m = t;
        for (let p = 0; p < np; p++) if (timeReady[p] !== t) { m = timeReady[p]; break; }
        for (let p = 0; p < np; p++) if (timeReady[p] !== t && timeReady[p] < m) m = timeReady[p];
        if (m > stop || m === t) break;
        for (let p = 0; p < np; p++) if (timeReady[p] === t) timeReady[p] = m;
        t = m;
        continue;
      }
      for (let p = 0; p < np; p++) {
        if (timeReady[p] === t) {
          next.start = t;
          next.end = t + next.duration;
          processors[p].push(next);
          timeReady[p] += next.duration;
          next.state = 2;
          break;
        }
      }
      let m = timeReady[0];
      for (let p = 1; p < np; p++) if (m > timeReady[p]) m = timeReady[p];
      t = m;
    }
    const run = syms.filter((s) => s.start >= 0);
    return {
      np,
      processors: processors.map((row) => row.map((s) => ({ name: s.name, start: s.start, end: s.end }))),
      tasks: run.map((s) => ({ name: s.name, start: s.start, end: s.end })),
      finish: run.reduce((m, s) => Math.max(m, s.end), 0),
      complete: run.length === tasks.length,
    };
  }

  /** What each task is doing at time t: "done", "running", "ready" (could start) or "waiting". */
  function statesAt(tasks, sched, t) {
    const g = graph(tasks);
    const when = new Map(sched.tasks.map((x) => [x.name, x]));
    return tasks.map((task) => {
      const w = when.get(task.name);
      if (w && t >= w.end) return { name: task.name, state: "done" };
      if (w && t >= w.start) return { name: task.name, state: "running" };
      const predsDone = g.preds.get(task.name).every((p) => p === START || (when.get(p) && t >= when.get(p).end));
      return { name: task.name, state: predsDone ? "ready" : "waiting" };
    });
  }

  /* ------------------------------------------------------------- the moves */

  function start(options) {
    const o = options || {};
    return {
      tasks: Array.isArray(o.tasks) ? clone(o.tasks) : clone(START_TASKS),
      endAfter: Array.isArray(o.tasks) ? null : START_END_AFTER.slice(), // the page's graph also has H -> End
      procs: Number.isInteger(o.procs) && o.procs >= MIN_PROCS && o.procs <= MAX_PROCS ? o.procs : START_PROCS,
      list: typeof o.list === "string" ? o.list : "",
      showCritical: o.showCritical === true,
      moves: 0, explored: false,
    };
  }

  /** The moves: edit the project, show the critical path, change the processors, set a list. */
  function legalMoves() {
    return [{ type: "tasks" }, { type: "critical", value: true }, { type: "procs", value: START_PROCS }, { type: "list", value: "" }, { type: "new" }, { type: "example" }];
  }

  function move(state, m) {
    if (!m) return null;
    let next = null;
    if (m.type === "tasks") {
      if (!Array.isArray(m.tasks)) return null;
      const tasks = m.tasks.map((t) => ({ name: String(t.name).trim(), duration: Number(t.duration), after: (t.after || []).map((a) => String(a).trim()).filter((a) => a) }));
      if (check(tasks).length) return null;
      next = { ...state, tasks, endAfter: null, list: "" };
    } else if (m.type === "critical") {
      if (typeof m.value !== "boolean") return null;
      next = { ...state, showCritical: m.value };
    } else if (m.type === "procs") {
      if (!Number.isInteger(m.value) || m.value < MIN_PROCS || m.value > MAX_PROCS) return null;
      next = { ...state, procs: m.value };
    } else if (m.type === "list") {
      if (typeof m.value !== "string") return null;
      next = { ...state, list: m.value };
    } else if (m.type === "new") {
      next = { ...state, tasks: [], endAfter: null, list: "" };
    } else if (m.type === "example") {
      next = { ...state, tasks: clone(START_TASKS), endAfter: START_END_AFTER.slice(), list: "" };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A demo: nothing to win; "done" once a schedule has been made from a valid list. */
  function result(state) {
    if (!state.tasks.length || !state.list) return null;
    return parseList(state.list, state.tasks).ok && state.explored ? "done" : null;
  }

  return {
    START, END, STOP_TIME, MIN_PROCS, MAX_PROCS, START_PROCS, START_TASKS, START_END_AFTER,
    start, legalMoves, move, result, check, graph, paths, criticalPath, longestPath, parseList, schedule, statesAt,
  };
})();
