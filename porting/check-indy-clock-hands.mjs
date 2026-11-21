#!/usr/bin/env node
"use strict";

/*
 * Logic test for indy-clock-hands/indy-clock-hands-core.js.
 *
 *   1. Angle wrapping, red-arc membership and the red fraction.
 *   2. Translation invariance: sampling many angles, both hands hit red with
 *      the same probability (the red fraction), for several arcs and shifts.
 *   3. The joint probability is computed by an independent grid scan and is
 *      at most each individual probability.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("indy-clock-hands/indy-clock-hands-core.js", "IndyClockHandsCore");

{
  equal("wrap a negative angle", C.normalize(-Math.PI / 2), 3 * Math.PI / 2);
  equal("wrap a large angle", C.normalize(2 * Math.PI + 0.5), 0.5);
  const arcs = [{ start: 0, length: Math.PI / 3 }];
  check("an angle inside the red arc", C.inRed(arcs, 0.2));
  check("an angle outside", !C.inRed(arcs, Math.PI));
  check("the wrapped arc works", C.inRed(arcs, 2 * Math.PI + 0.2));
  equal("one sixth of the circle", Math.round(C.redFraction(arcs) * 1000), 167);
  const s = C.start();
  equal("no trials initially", s.trials, 0);
  const t = C.trial(s, 0.2);
  equal("one trial counted", t.trials, 1);
}

{
  const rnd = rng(1994);
  let invariance = 0;
  let jointOk = 0;
  let cases = 0;
  for (const length of [Math.PI / 6, Math.PI / 3, Math.PI / 2, Math.PI]) {
    for (const alpha of [0, Math.PI / 6, Math.PI / 3, 2 * Math.PI / 3]) {
      const arcs = [{ start: 0, length }];
      const state = { ...C.start(), redArcs: arcs, alpha };
      let first = 0;
      let second = 0;
      const samples = 20000;
      for (let i = 0; i < samples; i++) {
        const theta = rnd() * C.TAU;
        if (C.inRed(arcs, theta)) first++;
        if (C.inRed(arcs, theta + alpha)) second++;
      }
      cases++;
      const p = C.redFraction(arcs);
      if (Math.abs(first / samples - p) < 0.02 && Math.abs(second / samples - p) < 0.02) invariance++;
      const j = C.joint(state, samples);
      if (j <= first / samples + 0.02 && j <= second / samples + 0.02) jointOk++;
    }
  }
  equal("all configurations checked", cases, 16);
  equal("both hands hit red with the same probability", invariance, cases);
  equal("the joint probability is consistent", jointOk, cases);

  // For alpha = 0 both hands are identical, so the joint equals one hand.
  const same = { ...C.start(), redArcs: [{ start: 0, length: Math.PI / 3 }], alpha: 0 };
  check("identical hands agree perfectly", Math.abs(C.joint(same) - C.redFraction(same.redArcs)) < 0.001);
}

done("indy-clock-hands");
