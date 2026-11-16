#!/usr/bin/env node
"use strict";

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("sct/sct-core.js", "SctCore");

{
  let s = C.start({ shapes: [1, 2, 1, 2], eliminate: true });
  s = C.select(s, 0);
  s = C.select(s, 1); // → [3,0,1,2]
  equal("elim move", s.shapes, [3, 0, 1, 2]);
  check("not finished yet", !s.over);
}

{
  let s = C.start({ shapes: [1, 2, 1, 2], eliminate: true });
  s = C.select(s, 0);
  s = C.select(s, 2); // two squares — rejected
  check("same shapes rejected", s.note === "different");
}

{
  let s = C.start({ shapes: [1, 2], eliminate: true });
  s = C.select(s, 0);
  s = C.select(s, 1);
  equal("to one triangle", s.shapes, [3, 0]);
  check("finished", s.over && s.remaining === 3);
}

{
  let s = C.start({ shapes: [1, 2], eliminate: false });
  s = C.select(s, 0);
  s = C.select(s, 1);
  equal("no-elim both triangles", s.shapes, [3, 3]);
  check("all same done", s.over && s.remaining === 3);
}

{
  for (let n = 3; n <= 6; n++) {
    for (let mask = 0; mask < 3 ** n; mask++) {
      const shapes = [];
      let m = mask;
      for (let i = 0; i < n; i++) {
        shapes.push(1 + (m % 3));
        m = Math.floor(m / 3);
      }
      const before = C.counts(shapes);
      let s = C.start({ shapes, eliminate: true });
      if (s.over) continue;
      outer: for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (shapes[i] && shapes[j] && shapes[i] !== shapes[j]) {
            s = C.select(s, i);
            s = C.select(s, j);
            break outer;
          }
        }
      }
      if (s.history.length === 0) continue;
      const after = C.counts(s.shapes);
      check("mod2 s-c", (before.s - before.c + 100) % 2 === (after.s - after.c + 100) % 2);
      check("mod2 s-t", (before.s - before.t + 100) % 2 === (after.s - after.t + 100) % 2);
    }
  }
}

{
  check("parity allows △ from two pairs + one", C.canReachEliminate([1, 1, 2, 2, 3], 3));
  check("parity blocks △ from (1,2,1)", C.canReachEliminate([1, 2, 1], 3) === false);
  // (1,2) no-elim → (3,3) all triangles — reachable
  check("can all-△ from (1,2)", C.canReachNoEliminate([1, 2], 3));
}

{
  // Counterexample to “parity ⇒ reachable”: n=2, shapes [1,1] (two squares).
  // Parity allows a lone circle (k=1,moves=1) but no move exists (same shapes).
  check("parity not sufficient for [1,1]→○", C.canReachEliminate([1, 1], 2) === true);
  let reached = false;
  {
    const sh = [1, 1];
    // no legal move
    reached = C.isFinished(C.start({ shapes: sh, eliminate: true })) && C.whatRemains(C.start({ shapes: sh, eliminate: true })) === 2;
  }
  check("but [1,1] cannot become a circle", reached === false);
}

{
  // Necessity: every reachable finished target satisfies the parity filter.
  // (The page’s s≡c mod 2 is necessary for a lone triangle; full parity is
  // still not always sufficient — the math section says so.)
  function finishedAs(shapes, target) {
    const key = (sh) => sh.join(",");
    const q = [shapes.slice()];
    const seen = new Set([key(shapes)]);
    while (q.length) {
      const cur = q.shift();
      if (C.isFinished(C.start({ shapes: cur, eliminate: true })) && C.whatRemains(C.start({ shapes: cur, eliminate: true })) === target) {
        return true;
      }
      for (let i = 0; i < cur.length; i++) {
        if (!cur[i]) continue;
        for (let j = i + 1; j < cur.length; j++) {
          if (!cur[j] || cur[i] === cur[j]) continue;
          const next = cur.slice();
          next[i] = C.third(next[i], next[j]);
          next[j] = 0;
          const k = key(next);
          if (seen.has(k)) continue;
          seen.add(k);
          q.push(next);
        }
      }
    }
    return false;
  }
  for (let n = 2; n <= 5; n++) {
    for (let mask = 0; mask < 3 ** n; mask++) {
      const shapes = [];
      let m = mask;
      for (let i = 0; i < n; i++) {
        shapes.push(1 + (m % 3));
        m = Math.floor(m / 3);
      }
      for (const target of [1, 2, 3]) {
        if (finishedAs(shapes, target)) {
          check("parity necessary n=" + n + " t=" + target, C.canReachEliminate(shapes, target));
        }
      }
    }
  }
}

done("sct");
