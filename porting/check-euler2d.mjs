#!/usr/bin/env node
"use strict";

/*
 * Logic test for euler2d/euler2d-core.js, the port of xscreensaver's euler2d.c.
 *
 * This is a simulation rather than a puzzle, so there is no win condition to
 * check. What can be checked is that the physics stays physical, which is
 * exactly what goes wrong first in an ODE port: a sign error in the
 * Biot-Savart kernel, or a mis-ordered Adams-Bashforth step, shows up as
 * coordinates drifting to NaN or points escaping the domain.
 *
 * So: run long simulations across the whole power range and assert that every
 * coordinate stays finite, that live points stay inside the boundary, and that
 * the solver is deterministic given the same random draw.
 *
 * The containment check is the real physics test. The kernel includes a mirror
 * image for every vortex precisely so the flow never crosses the boundary; if
 * that term were wrong, points would leak out.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const E = loadCore("euler2d/euler2d-core.js", "Euler2DCore");

const WIDTH = 600;
const HEIGHT = 400;

function withSeed(seed, fn) {
  const realRandom = Math.random;
  Math.random = rng(seed);
  try {
    return fn();
  } finally {
    Math.random = realRandom;
  }
}

/* ----------------------------------------------------------- 1. the knobs */

{
  check("the power range is the hack's", E.MIN_POWER === 0.5 && E.MAX_POWER === 3.0, `${E.MIN_POWER}..${E.MAX_POWER}`);
  equal("there are 20 vortex points", E.NUM_VORTEX_POINTS, 20);

  const sp = withSeed(1, () => E.create(WIDTH, HEIGHT, { power: 99, particles: 50, cycles: 1 }));
  check("an out-of-range power is clamped", sp.power <= E.MAX_POWER && sp.power >= E.MIN_POWER, `got ${sp.power}`);
  const low = withSeed(1, () => E.create(WIDTH, HEIGHT, { power: -5, particles: 50, cycles: 1 }));
  check("a negative power is clamped too", low.power >= E.MIN_POWER, `got ${low.power}`);
}

/* ------------------------- 2. long runs stay finite and inside the boundary */

for (const power of [0.5, 1, 1.5, 2, 3]) {
  const result = withSeed(1000 + power * 10, () => {
    // cycles is the budget before the UI restarts with a fresh flow; set it
    // high so the integrator really is exercised for 300 steps.
    const sp = E.create(WIDTH, HEIGHT, { power, particles: 120, cycles: 100000 });
    const boundary = E.getBoundary(sp);

    let nan = 0;
    let escaped = 0;
    let frames = 0;
    let lastAlive = null;

    for (let i = 0; i < 300; i++) {
      const out = E.step(sp);
      frames++;
      lastAlive = out.aliveParticles + out.aliveVortices;
      for (const seg of [...out.particles, ...out.vortices]) {
        if (!Number.isFinite(seg.x2) || !Number.isFinite(seg.y2)) nan++;
      }
      if (out.finished) break;
    }

    // Domain coordinates: every live point must stay in the open unit disk,
    // which is what the mirror-image term in the kernel guarantees.
    for (let i = 0; i < sp.N; i++) {
      if (sp.dead[i]) continue;
      const x = sp.x[2 * i];
      const y = sp.x[2 * i + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) nan++;
      else if (Math.hypot(x, y) > 1.0000001) escaped++;
    }
    return { nan, escaped, frames, lastAlive, boundary };
  });

  equal(`power ${power}: no coordinate goes NaN or infinite`, result.nan, 0);
  equal(`power ${power}: no point escapes the unit disk`, result.escaped, 0);
  check(`power ${power}: the simulation actually ran`, result.frames > 10, `only ${result.frames} frames`);
  check(`power ${power}: points are still alive`, result.lastAlive > 0, `${result.lastAlive} alive`);

  const b = result.boundary;
  check(`power ${power}: the boundary is described`, b && (b.kind === "circle" || b.kind === "polygon"));
  if (b.kind === "circle") {
    check(`power ${power}: the circle has a positive radius`, b.r > 0, `r=${b.r}`);
  } else {
    check(`power ${power}: the polygon has points`, Array.isArray(b.points) && b.points.length > 10);
    for (const p of b.points.slice(0, 20)) {
      check(`power ${power}: boundary points are finite`, Number.isFinite(p[0] ?? p.x));
    }
  }
}

/* ---------------------------------- 3. power 1 gives the shaped boundary */

{
  const circle = withSeed(3, () => E.create(WIDTH, HEIGHT, { power: 2, particles: 20, cycles: 1 }));
  equal("power != 1 uses a plain disk", E.getBoundary(circle).kind, "circle");
  const shaped = withSeed(3, () => E.create(WIDTH, HEIGHT, { power: 1, particles: 20, cycles: 1 }));
  equal("power 1 uses the polynomial boundary", E.getBoundary(shaped).kind, "polygon");
}

/* -------------------------------------------------- 4. the solver is stable */

{
  // Same seed, same trajectory: catches accidental reliance on wall-clock time
  // or on uninitialised state carried between runs.
  const run = (seed) =>
    withSeed(seed, () => {
      const sp = E.create(WIDTH, HEIGHT, { power: 2, particles: 30, cycles: 1 });
      for (let i = 0; i < 50; i++) E.step(sp);
      return Array.from(sp.x.slice(0, 20));
    });
  equal("the same seed gives the same trajectory", run(42), run(42));
  check("a different seed gives a different one", JSON.stringify(run(42)) !== JSON.stringify(run(43)));
}

/* --------------------------------------------- 5. randomize() resets cleanly */

{
  withSeed(11, () => {
    const sp = E.create(WIDTH, HEIGHT, { power: 2, particles: 40, cycles: 1 });
    for (let i = 0; i < 30; i++) E.step(sp);
    E.randomize(sp);
    equal("randomize resets the step count", sp.count, 0);
    let bad = 0;
    for (let i = 0; i < sp.N; i++) {
      if (sp.dead[i]) continue;
      if (!Number.isFinite(sp.x[2 * i]) || Math.hypot(sp.x[2 * i], sp.x[2 * i + 1]) > 1.0000001) bad++;
    }
    equal("randomize leaves every point inside the disk", bad, 0);
    const out = E.step(sp);
    check("the simulation keeps running after a reset", out.aliveParticles > 0);
  });
}

done("check-euler2d");
