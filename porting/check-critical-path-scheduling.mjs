#!/usr/bin/env node
"use strict";

/*
 * Logic test for critical-path-scheduling/critical-path-scheduling-core.js.
 *
 *   1. Critical path length and route on the three presets, zero slack on it,
 *      and the earliest-start values.
 *   2. Schedules: every precedence respected, no processor double-booked, and
 *      the makespan never below the critical path; the lower bound is reached
 *      with as many processors as the widest level.
 *   3. Priority reordering and processor controls; one processor gives the sum
 *      of the task durations (for the merge graph).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("critical-path-scheduling/critical-path-scheduling-core.js", "CriticalPathSchedulingCore");

{
  const merge = C.start("merge");
  const c = C.critical(merge);
  equal("merge critical length", c.length, 7);
  equal("merge critical path", c.path.join("-"), "Start-A-C-End");
  equal("earliest start of C", c.earliest.C, 3);
  const t = C.times(merge);
  equal("A has zero slack", t.A.slack, 0);
  equal("C has zero slack", t.C.slack, 0);
  equal("B has slack one", t.B.slack, 1);

  const parallel = C.critical(C.start("parallel"));
  equal("parallel critical length", parallel.length, 5);
  equal("parallel critical path", parallel.path.join("-"), "Start-B-End");
  const branches = C.critical(C.start("branches"));
  equal("branches critical length", branches.length, 7);
  equal("branches critical path", branches.path.join("-"), "Start-A-C-End");
}

{
  for (const name of ["merge", "parallel", "branches"]) {
    for (const p of [1, 2, 3, 4]) {
      const state = C.setProcessors(C.start(name), p);
      const r = C.analyze(state);
      const s = r.schedule;
      const c = r.critical;
      const label = `${name} with ${p} processors`;
      let precedenceOk = true;
      let noOverlap = true;
      for (const a of s.assignments) {
        for (const pred of C.preds(state, a.task)) {
          const before = s.assignments.find((b) => b.task === pred);
          if (before && a.start < before.finish) precedenceOk = false;
        }
      }
      for (let i = 0; i < s.assignments.length; i++) {
        for (let j = i + 1; j < s.assignments.length; j++) {
          const a = s.assignments[i]; const b = s.assignments[j];
          if (a.processor === b.processor && a.start < b.finish && b.start < a.finish) noOverlap = false;
        }
      }
      check(`${label}: precedence holds`, precedenceOk);
      check(`${label}: one task per processor`, noOverlap);
      check(`${label}: makespan at least the critical path`, s.makespan >= c.length);
      check(`${label}: every non-special task scheduled`, s.assignments.length === state.tasks.length - 2);
    }
  }
  const wide = C.schedule(C.start("parallel"), ["A", "B", "C"], 3);
  equal("three processors reach the critical path for parallel tasks", wide.makespan, 5);
  const one = C.schedule(C.start("merge"), ["A", "B", "C"], 1);
  equal("one processor takes the total duration", one.makespan, 9);
}

{
  const reordered = C.reorderPriority(C.start("merge"), 0, 1);
  equal("swapping priorities changes the list", reordered.priority.join(","), "B,A,C");
  equal("an invalid swap is ignored", C.reorderPriority(reordered, 0, -1), reordered);
  equal("processors clamped high", C.setProcessors(C.start(), 99).processors, 4);
  equal("a bad preset is ignored", C.setPreset(C.start(), "nope").preset, "merge");
  const a = C.schedule(C.start("branches"), ["A", "B", "C", "D"], 2);
  const b = C.schedule(C.start("branches"), ["D", "C", "B", "A"], 2);
  check("a different priority list gives a valid schedule", b.makespan >= C.critical(C.start("branches")).length && b.assignments.length === a.assignments.length);
}

done("critical-path-scheduling");
