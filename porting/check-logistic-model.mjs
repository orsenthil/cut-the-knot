#!/usr/bin/env node
"use strict";

/*
 * Logic test for logistic-model/logistic-model-core.js.
 *
 *   1. The recurrence, the invariant interval [0,1] and known fixed points.
 *   2. The bifurcation cascade: period 1, 2, 4 at representative r values,
 *      and chaotic behaviour near r = 4.
 *   3. Slider clamping and the Lyapunov estimate.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("logistic-model/logistic-model-core.js", "LogisticModelCore");

{
  equal("next value", C.next(2, 0.25), 0.375);
  const s = C.start();
  equal("default r", s.r, 3.2);
  equal("default p0", s.p0, 0.25);
  equal("orbit length", C.orbit(s, 10).length, 10);
  equal("orbit starts at p0", C.orbit(s, 10)[0], 0.25);
  equal("r clamped high", C.setR(s, 99).r, 4);
  equal("p0 clamped low", C.setP0(s, -1).p0, 0);
  equal("iterations clamped", C.setIterations(s, 999).iterations, 400);
}

{
  let invariant = 0;
  const rnd = rng(1976);
  for (let t = 0; t < 300; t++) {
    const r = rnd() * 4;
    const p0 = rnd();
    const a = C.analyze({ r, p0, iterations: 200 });
    if (a.inInterval) invariant++;
  }
  equal("the orbit stays in [0,1] for all tested parameters", invariant, 300);

  const fixed = C.analyze({ r: 2, p0: 0.25, iterations: 200 });
  check("r = 2 converges to 1/2", Math.abs(fixed.last - 0.5) < 1e-6);
  equal("r = 2 has period 1", fixed.period, 1);

  const two = C.analyze({ r: 3.2, p0: 0.25, iterations: 400 });
  equal("r = 3.2 has period 2", two.period, 2);
  const four = C.analyze({ r: 3.5, p0: 0.2, iterations: 500 });
  check("r = 3.5 enters a longer cycle", four.period !== null && four.period > 2, `${four.period}`);

  const chaos = C.analyze({ r: 4, p0: 0.1234567, iterations: 400 });
  check("r = 4 does not settle into a short cycle", chaos.period === null || chaos.period > 16, `${chaos.period}`);
  check("r = 4 has a positive Lyapunov exponent", chaos.lyapunov > 0.1, `${chaos.lyapunov}`);
}

done("logistic-model");
