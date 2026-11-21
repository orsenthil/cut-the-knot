#!/usr/bin/env node
"use strict";

/*
 * Logic test for critical-path/critical-path-core.js.
 *
 *   node porting/check-critical-path.mjs
 *
 * Exhaustive: every project of up to 4 tasks (every set of "comes after"
 * relations that point backwards in the list, durations 1 to 3): the applet's
 * BackFlow critical path has the same length as a longest-path computation by
 * dynamic programming, and it is a real chain from Start to End. Every priority
 * list (all n! orders) of every project of up to 5 tasks on 2 to 5 processors
 * (a seeded sample of projects): the schedule from the applet's recursive
 * method equals a second, time-stepped list-scheduling simulation, respects the
 * precedence relations, never overlaps on a processor, never finishes before
 * the critical path or before total/processors, and meets the critical path when
 * there are as many processors as tasks.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("critical-path/critical-path-core.js", "CriticalPathCore");

const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// A second implementation of list scheduling: integer time steps, free processors take ready tasks in list order.
function simulate(tasks, np, list) {
  const dur = new Map(tasks.map((t) => [t.name, t.duration]));
  const after = new Map(tasks.map((t) => [t.name, t.after]));
  const start = new Map(), end = new Map(), proc = new Map();
  const busyUntil = new Array(np).fill(0);
  for (let t = 0; t <= C.STOP_TIME && start.size < tasks.length; t++) {
    for (;;) {
      const free = busyUntil.findIndex((b) => b <= t);
      if (free < 0) break;
      const next = list.find((n) => !start.has(n) && after.get(n).every((a) => end.has(a) && end.get(a) <= t));
      if (!next) break;
      start.set(next, t); end.set(next, t + dur.get(next)); proc.set(next, free); busyUntil[free] = t + dur.get(next);
    }
  }
  return { start, end, proc };
}

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  check("a new game is not over", C.result(s) === null);
  equal("opens on the page's project with 2 processors", [s.tasks.length, s.procs, s.showCritical], [9, 2, false]);
  check("the page's project is valid", C.check(s.tasks).length === 0);
  const cp = C.criticalPath(s.tasks, s.endAfter);
  equal("the page's critical path is B E H C G, 38 long", [cp.path.join(" "), cp.length], ["Start B E H C G End", 38]);
  equal("the page's project has the same longest path by dynamic programming", C.longestPath(s.tasks, s.endAfter), 38);
  equal("End follows G, H and I on the page's graph", C.graph(s.tasks, s.endAfter).preds.get("End"), ["G", "H", "I"]);
  equal("built from the table, End follows only G and I", C.graph(s.tasks).preds.get("End"), ["G", "I"]);
  equal("applying the table drops the page's extra H -> End", C.move(s, { type: "tasks", tasks: s.tasks }).endAfter, null);
  const m = C.move(s, { type: "critical", value: true });
  check("showing the critical path is a move", m.showCritical && m.moves === 1 && C.result(m) === null);
  check("the old position is untouched", s.moves === 0 && !s.showCritical);
  const l = C.move(m, { type: "list", value: "B E A D F I H C G" });
  equal("a complete priority list finishes the demo", C.result(l), "done");
  equal("an incomplete list does not", C.result(C.move(m, { type: "list", value: "A B" })), null);
  check("bad moves are refused", C.move(s, null) === null && C.move(s, { type: "procs", value: 1 }) === null && C.move(s, { type: "procs", value: 6 }) === null && C.move(s, { type: "procs", value: 2.5 }) === null && C.move(s, { type: "critical", value: 1 }) === null && C.move(s, { type: "nope" }) === null && C.move(s, { type: "list", value: 5 }) === null);
  equal("processors 2 to 5 are allowed", [2, 3, 4, 5].map((v) => C.move(s, { type: "procs", value: v }).procs), [2, 3, 4, 5]);
  equal("a new project is empty", C.move(s, { type: "new" }).tasks, []);
  check("example restores the page's project", C.move(C.move(s, { type: "new" }), { type: "example" }).tasks.length === 9);
  // The table's checks.
  const bad = (tasks) => C.check(tasks).map((p) => p.field + ":" + p.row).join(",");
  equal("an empty name is a problem", bad([{ name: "", duration: 1, after: [] }]), "name:0");
  equal("Start and End are reserved", bad([{ name: "Start", duration: 1, after: [] }, { name: "End", duration: 1, after: [] }]), "name:0,name:1");
  equal("a repeated name is a problem", bad([{ name: "A", duration: 1, after: [] }, { name: "A", duration: 1, after: [] }]), "name:1");
  equal("durations are whole numbers of at least 1", bad([{ name: "A", duration: 0, after: [] }, { name: "B", duration: 1.5, after: [] }, { name: "C", duration: -2, after: [] }]), "duration:0,duration:1,duration:2");
  equal("a missing predecessor is a problem", bad([{ name: "A", duration: 1, after: ["Z"] }]), "after:0");
  equal("a task cannot follow itself", bad([{ name: "A", duration: 1, after: ["A"] }]), "after:0");
  equal("a cycle is a problem", bad([{ name: "A", duration: 1, after: ["B"] }, { name: "B", duration: 1, after: ["A"] }]), "after:-1");
  check("a refused task list is not applied", C.move(s, { type: "tasks", tasks: [{ name: "X", duration: 0, after: [] }] }) === null);
  const ok = C.move(s, { type: "tasks", tasks: [{ name: " X ", duration: 2, after: [] }, { name: "Y", duration: 3, after: [" X"] }] });
  equal("an applied task list is trimmed", ok.tasks.map((t) => [t.name, t.duration, t.after.join()].join(":")), ["X:2:", "Y:3:X"]);
  const sch = C.schedule(s.tasks, 2, ["B", "E", "A", "D", "F", "I", "H", "C", "G"]);
  equal("the page's project on 2 processors with a good list finishes at the critical path, 38", [sch.finish, sch.complete], [38, true]);
  equal("tasks not in the list never run", C.schedule(s.tasks, 2, ["A", "B"]).tasks.map((t) => t.name), ["A", "B"]);
  check("Start and End in a list are ignored", C.parseList("Start A, B End", s.tasks).list.join("") === "AB");
  equal("a list must name every task", [C.parseList("A B C D E F G H I", s.tasks).ok, C.parseList("A B C D E F G H", s.tasks).missing], [true, ["I"]]);
}

/* -------------------------------------------------- 2. every case, where small */
{
  // Every project of up to 4 tasks: the critical path length equals the DP longest path.
  let projects = 0, bad = 0;
  const names = ["A", "B", "C", "D"];
  for (let n = 1; n <= 4; n++) {
    const pairs = [];
    for (let j = 1; j < n; j++) for (let i = 0; i < j; i++) pairs.push([i, j]);
    for (let mask = 0; mask < 1 << pairs.length; mask++) {
      const durs = n === 4 ? [1, 2, 3] : [1, 2, 3, 4];
      const total = Math.pow(durs.length, n);
      for (let d = 0; d < total; d++) {
        const tasks = names.slice(0, n).map((name, i) => ({ name, duration: durs[Math.floor(d / Math.pow(durs.length, i)) % durs.length], after: [] }));
        pairs.forEach(([i, j], k) => { if (mask >> k & 1) tasks[j].after.push(names[i]); });
        projects++;
        if (C.check(tasks).length) { bad++; continue; }
        const cp = C.criticalPath(tasks);
        if (cp.length !== C.longestPath(tasks)) bad++;
        // a real chain: starts at Start, ends at End, each step is a "comes after" relation
        const p = cp.path;
        if (p[0] !== "Start" || p[p.length - 1] !== "End") bad++;
        for (let k = 1; k < p.length - 1; k++) {
          const t = tasks.find((x) => x.name === p[k]);
          if (k === 1 ? t.after.length !== 0 : !t.after.includes(p[k - 1])) bad++;
        }
        const last = tasks.find((x) => x.name === p[p.length - 2]);
        if (tasks.some((x) => x.after.includes(last.name))) bad++; // nobody waits for the last task
        if (p.slice(1, -1).reduce((s, nm) => s + tasks.find((x) => x.name === nm).duration, 0) !== cp.length) bad++;
      }
    }
  }
  equal(`BackFlow's critical path is a longest chain in every project of up to 4 tasks (${projects})`, bad, 0);

  // A tie keeps the earlier path in the applet's enumeration order.
  const tie = [{ name: "A", duration: 3, after: [] }, { name: "B", duration: 3, after: [] }];
  equal("a tie between two paths keeps the first in the applet's order", C.criticalPath(tie).path.join(" "), "Start A End");

  // Schedules: every priority list of a sample of projects on 2..5 processors.
  const rand = lcg(7);
  let runs = 0; bad = 0;
  for (let trial = 0; trial < 60; trial++) {
    const n = 2 + Math.floor(rand() * 4); // 2..5 tasks
    const tasks = Array.from({ length: n }, (_, i) => ({ name: "ABCDE"[i], duration: 1 + Math.floor(rand() * 5), after: [] }));
    for (let j = 1; j < n; j++) for (let i = 0; i < j; i++) if (rand() < 0.4) tasks[j].after.push(tasks[i].name);
    const cpLen = C.longestPath(tasks);
    const sum = tasks.reduce((s, t) => s + t.duration, 0);
    for (const list of perms(tasks.map((t) => t.name))) {
      for (let np = 2; np <= 5; np++) {
        runs++;
        const s = C.schedule(tasks, np, list);
        const sim = simulate(tasks, np, list);
        if (!s.complete) { bad++; continue; }
        for (const t of s.tasks) {
          if (sim.start.get(t.name) !== t.start || sim.end.get(t.name) !== t.end) bad++;
          const task = tasks.find((x) => x.name === t.name);
          if (t.end - t.start !== task.duration) bad++;
          for (const a of task.after) if (s.tasks.find((x) => x.name === a).end > t.start) bad++; // precedence
        }
        s.processors.forEach((row, p) => {
          row.forEach((t, i) => { if (i && row[i - 1].end > t.start) bad++; if (sim.proc.get(t.name) !== p) bad++; }); // no overlap, same processor
        });
        if (s.finish < cpLen || s.finish < Math.ceil(sum / np)) bad++;
        if (np >= n && s.finish !== cpLen) bad++; // enough processors: the critical path is the limit
      }
    }
  }
  equal(`the applet's recursive scheduler equals the time-stepped simulation, respects precedence and bounds (${runs} schedules)`, bad, 0);

  // States at a moment.
  const tasks = C.START_TASKS;
  const sch = C.schedule(tasks, 2, ["B", "E", "A", "D", "F", "I", "H", "C", "G"]);
  const st = (t) => Object.fromEntries(C.statesAt(tasks, sch, t).map((x) => [x.name, x.state]));
  equal("at time 0 A and B are ready or running", [st(0).A, st(0).B, st(0).C], ["running", "running", "waiting"]);
  check("at the end everything is done", Object.values(st(sch.finish)).every((x) => x === "done"));
  check("a task is never running before its predecessors are done", Array.from({ length: sch.finish + 1 }, (_, t) => t).every((t) => C.statesAt(tasks, sch, t).every((x) => x.state !== "running" || tasks.find((y) => y.name === x.name).after.every((a) => st(t)[a] === "done"))));

  // Stopping early (a click on the timeline) leaves a prefix of the full schedule.
  let prefixOk = true;
  for (let t = 0; t <= 45; t++) {
    const early = C.schedule(tasks, 2, ["B", "E", "A", "D", "F", "I", "H", "C", "G"], t);
    for (const e of early.tasks) { const f = sch.tasks.find((x) => x.name === e.name); if (!f || f.start !== e.start || e.start > t) prefixOk = false; }
  }
  check("a schedule stopped at time t agrees with the full schedule up to t", prefixOk);
}

{
  // The page's own project, every one of the 9! = 362,880 priority lists on 2..5 processors.
  const tasks = C.START_TASKS;
  const hist = { 2: {}, 3: {}, 4: {}, 5: {} };
  for (const list of perms(tasks.map((t) => t.name))) {
    for (let np = 2; np <= 5; np++) {
      const f = C.schedule(tasks, np, list).finish;
      hist[np][f] = (hist[np][f] || 0) + 1;
    }
  }
  equal("on 2 processors half of all orders finish at 38 and half at 41", hist[2], { 38: 181440, 41: 181440 });
  equal("on 3, 4 and 5 processors every order finishes at the critical path, 38", [hist[3], hist[4], hist[5]], [{ 38: 362880 }, { 38: 362880 }, { 38: 362880 }]);
  equal("swapping E and F costs 3 on two processors", [C.schedule(tasks, 2, [..."ABCDEFGHI"]).finish, C.schedule(tasks, 2, [..."ABCDFEGHI"]).finish], [38, 41]);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // BackFlow enumerates every path (some more than once: the applet re-walks shared predecessors).
  const diamond = [{ name: "A", duration: 1, after: [] }, { name: "B", duration: 2, after: ["A"] }, { name: "C", duration: 3, after: ["A"] }, { name: "D", duration: 1, after: ["B", "C"] }];
  const { all } = C.paths(diamond);
  const distinct = new Set(all.map((p) => p.join(" ")));
  equal("the diamond has two distinct paths", [...distinct].sort(), ["Start A B D End", "Start A C D End"]);
  check("every distinct path is found (duplicates allowed, as in the applet)", all.length >= 2);
  equal("the diamond's critical path goes through C", C.criticalPath(diamond).path.join(" "), "Start A C D End");
  check("the page's graph has 6 distinct paths (4 from the table plus A D H End and B E H End)", new Set(C.paths(C.START_TASKS, C.START_END_AFTER).all.map((p) => p.join(" "))).size === 6 && new Set(C.paths(C.START_TASKS).all.map((p) => p.join(" "))).size === 4);
}

done("critical-path");
