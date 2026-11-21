"use strict";

/*
 * Scheduling and Critical Path Algorithm, from Bogomolny's applet
 * JCriticalPath (Tannenbaum, Excursions in Modern Mathematics).
 *
 * A project is a directed acyclic graph of tasks with durations, from Start
 * to End. The critical path is the longest route to End by total duration; it
 * gives the shortest possible completion time for one processor per task and
 * the tasks on it have zero slack. A priority list and a number of processors
 * turn the graph into a schedule: at each moment the ready tasks are assigned
 * to free processors in priority order.
 *
 * The key idea is that the longest path is a lower bound on any schedule and
 * that list scheduling respects every precedence constraint. The logic test
 * checks the critical path on known graphs, zero slack on it, and that
 * schedules obey precedence, keep one task per processor and never finish
 * before the critical path length.
 *
 * No document, no window, no storage: one global, CriticalPathSchedulingCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const CriticalPathSchedulingCore = (() => {
  const PRESETS = {
    merge: {
      tasks: [
        { id: "Start", duration: 0 }, { id: "A", duration: 3 }, { id: "B", duration: 2 },
        { id: "C", duration: 4 }, { id: "End", duration: 0 },
      ],
      edges: [["Start", "A"], ["Start", "B"], ["A", "C"], ["B", "C"], ["C", "End"]],
      priority: ["A", "B", "C"],
    },
    parallel: {
      tasks: [
        { id: "Start", duration: 0 }, { id: "A", duration: 2 }, { id: "B", duration: 5 },
        { id: "C", duration: 3 }, { id: "End", duration: 0 },
      ],
      edges: [["Start", "A"], ["Start", "B"], ["Start", "C"], ["A", "End"], ["B", "End"], ["C", "End"]],
      priority: ["A", "B", "C"],
    },
    branches: {
      tasks: [
        { id: "Start", duration: 0 }, { id: "A", duration: 4 }, { id: "B", duration: 2 },
        { id: "C", duration: 3 }, { id: "D", duration: 5 }, { id: "End", duration: 0 },
      ],
      edges: [["Start", "A"], ["Start", "B"], ["A", "C"], ["B", "D"], ["C", "End"], ["D", "End"]],
      priority: ["A", "B", "C", "D"],
    },
  };

  function start(preset) {
    const g = PRESETS[preset] || PRESETS.merge;
    return {
      preset: PRESETS[preset] ? preset : "merge",
      tasks: g.tasks.map((t) => ({ ...t })),
      edges: g.edges.map((e) => e.slice()),
      priority: g.priority.slice(),
      processors: 2,
    };
  }

  function taskById(graph, id) {
    return graph.tasks.find((t) => t.id === id);
  }

  function preds(graph, id) {
    return graph.edges.filter((e) => e[1] === id).map((e) => e[0]);
  }
  function succs(graph, id) {
    return graph.edges.filter((e) => e[0] === id).map((e) => e[1]);
  }

  function topological(graph) {
    const indeg = new Map(graph.tasks.map((t) => [t.id, preds(graph, t.id).length]));
    const queue = graph.tasks.filter((t) => indeg.get(t.id) === 0).map((t) => t.id);
    const out = [];
    while (queue.length) {
      const id = queue.shift();
      out.push(id);
      for (const next of succs(graph, id)) {
        indeg.set(next, indeg.get(next) - 1);
        if (indeg.get(next) === 0) queue.push(next);
      }
    }
    return out;
  }

  /** Longest duration path from Start to End, and earliest start times. */
  function critical(graph) {
    const order = topological(graph);
    const earliest = {};
    const previous = {};
    for (const id of order) earliest[id] = id === "Start" ? 0 : -Infinity;
    for (const id of order) {
      const t = taskById(graph, id);
      for (const next of succs(graph, id)) {
        const candidate = earliest[id] + (t ? t.duration : 0);
        if (candidate > earliest[next]) {
          earliest[next] = candidate;
          previous[next] = id;
        }
      }
    }
    for (const id of order) if (!Number.isFinite(earliest[id])) earliest[id] = 0;
    const length = earliest.End || 0;
    const path = ["End"];
    while (previous[path[0]]) path.unshift(previous[path[0]]);
    return { length, path, earliest };
  }

  /** Latest start/finish and slack for each task (critical tasks have slack 0). */
  function times(graph) {
    const c = critical(graph);
    const order = topological(graph).slice().reverse();
    const latestFinish = { End: c.length };
    for (const id of order) {
      if (id === "End") continue;
      const outgoing = succs(graph, id);
      latestFinish[id] = outgoing.length
        ? Math.min(...outgoing.map((next) => (latestFinish[next] ?? c.length) - (taskById(graph, next)?.duration || 0)))
        : c.length;
    }
    const out = {};
    for (const t of graph.tasks) {
      const es = c.earliest[t.id] || 0;
      const lf = latestFinish[t.id] ?? c.length;
      const ls = lf - t.duration;
      out[t.id] = { earliestStart: es, earliestFinish: es + t.duration, latestStart: ls, latestFinish: lf, slack: ls - es };
    }
    return out;
  }

  /** List scheduling: at each event time, assign ready tasks by priority. */
  function schedule(graph, priority, processors) {
    const list = priority && priority.length ? priority.slice() : graph.tasks.filter((t) => t.id !== "Start" && t.id !== "End").map((t) => t.id);
    const rank = (id) => {
      const at = list.indexOf(id);
      return at < 0 ? list.length : at;
    };
    const pending = new Set(graph.tasks.filter((t) => t.id !== "Start" && t.id !== "End").map((t) => t.id));
    const completion = {};
    const freeAt = Array(processors).fill(0);
    const assignments = [];
    let now = 0;

    while (pending.size) {
      const ready = [...pending]
        .filter((id) => preds(graph, id).every((p) => p === "Start" || (completion[p] !== undefined && completion[p] <= now)))
        .sort((a, b) => rank(a) - rank(b));
      for (const id of ready) {
        const processor = freeAt.findIndex((at) => at <= now);
        if (processor < 0) break;
        const finish = now + taskById(graph, id).duration;
        freeAt[processor] = finish;
        completion[id] = finish;
        assignments.push({ task: id, processor, start: now, finish });
        pending.delete(id);
      }
      const next = Math.min(...freeAt.filter((at) => at > now));
      if (!Number.isFinite(next)) break; // nothing can run: cyclic or missing predecessor
      now = next;
    }
    const makespan = assignments.reduce((m, a) => Math.max(m, a.finish), 0);
    return { assignments, makespan, priority: list, processors };
  }

  function reorderPriority(state, index, direction) {
    const priority = state.priority.slice();
    const j = index + direction;
    if (index < 0 || j < 0 || j >= priority.length) return state;
    [priority[index], priority[j]] = [priority[j], priority[index]];
    return { ...state, priority };
  }

  function setProcessors(state, value) {
    return { ...state, processors: Math.max(1, Math.min(4, Math.trunc(Number(value)) || 1)) };
  }

  function setPreset(state, name) {
    if (!PRESETS[name]) return state;
    return start(name);
  }

  function analyze(state) {
    return {
      critical: critical(state),
      times: times(state),
      schedule: schedule(state, state.priority, state.processors),
      preset: state.preset,
      processors: state.processors,
      priority: state.priority.slice(),
    };
  }

  return {
    PRESETS, start, taskById, preds, succs, topological, critical, times,
    schedule, reorderPriority, setProcessors, setPreset, analyze,
  };
})();
