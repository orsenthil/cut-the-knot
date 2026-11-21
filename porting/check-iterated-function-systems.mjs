#!/usr/bin/env node
"use strict";

/*
 * Logic test for iterated-function-systems/iterated-function-systems-core.js.
 *
 *   1. Affine application on known points and the contraction scales of the
 *      predefined systems.
 *   2. The chaos game orbit stays bounded and converges into the attractor box;
 *      each system's maps are contractions (except the fern's degenerate stem,
 *      which is still non-expanding).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("iterated-function-systems/iterated-function-systems-core.js", "IteratedFunctionSystemsCore");

{
  const t = { a: 2, b: 0, c: 0, d: 3, e: 1, f: -1 };
  const p = C.apply(t, { x: 1, y: 1 });
  equal("affine x", p.x, 3);
  equal("affine y", p.y, 2);
  equal("scaling of that map", C.scale(t), 3);
  equal("three predefined systems", Object.keys(C.SYSTEMS).length, 3);
  equal("default system", C.start().system, "Sierpinski gasket");
  equal("Sierpinski has three maps", C.SYSTEMS["Sierpinski gasket"].length, 3);
  const s = C.start();
  const next = C.step(s, 1);
  equal("one step counts", next.iterations, 1);
  equal("the first Sierpinski map halves", next.point.x, 0.5);
  equal("an out-of-range map is ignored", C.step(s, 9), s);
}

{
  const rnd = rng(1988);
  let bounded = 0;
  let contracting = 0;
  let systems = 0;
  for (const [name, transforms] of Object.entries(C.SYSTEMS)) {
    systems++;
    if (transforms.every((t) => C.scale(t) <= 1.0000001)) contracting++;
    let state = C.start();
    state = { ...state, system: name };
    const indices = Array.from({ length: 2000 }, () => Math.floor(rnd() * transforms.length));
    state = C.run(state, indices);
    // Plot the last 500 points and check they stay in a bounded box.
    let at = state;
    let ok = true;
    for (let k = 0; k < 500; k++) {
      at = C.step(at, Math.floor(rnd() * transforms.length));
      if (!Number.isFinite(at.point.x) || !Number.isFinite(at.point.y) || Math.abs(at.point.x) > 10 || Math.abs(at.point.y) > 10) ok = false;
    }
    if (ok) bounded++;
  }
  equal("all systems run", systems, 3);
  equal("all maps are non-expanding", contracting, 3);
  equal("the chaos game stays bounded", bounded, 3);

  const box = C.attractorBounds("Sierpinski gasket");
  check("the gasket attractor lies in the unit square", box.minX >= 0 && box.maxX <= 1 && box.minY >= 0 && box.maxY <= 1);
}

done("iterated-function-systems");
