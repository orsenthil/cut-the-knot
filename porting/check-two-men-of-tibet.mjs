#!/usr/bin/env node
"use strict";

/*
 * Logic test for two-men-of-tibet/two-men-of-tibet-core.js.
 *
 *   node porting/check-two-men-of-tibet.mjs
 *
 * 1. The page's degree claims, on thousands of random ranges (no plateaus,
 *    3 to 9 corners): in the graph of equal-height pairs, (A, Z) and (Z, A)
 *    have odd degree (1) and every other node even degree.
 * 2. So a walk always exists: the search finds one every time, and along
 *    it the two men are always at the same height, move one named point at
 *    a time, and end swapped.
 * 3. Ranges where one man must turn back exist (the applet's default does
 *    not always need it; a range is built where it does).
 * 4. Plateaus are refused; the applet's random range; dragging.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("two-men-of-tibet/two-men-of-tibet-core.js", "TwoMenOfTibetCore");

const random = (seed, corners) => {
  const r = C.rng(seed);
  return C.start({ heights: Array.from({ length: corners }, (_, i) => (i === 0 || i === corners - 1 ? 0 : Math.round((0.05 + 0.95 * r()) * 20) / 20)) });
};

{
  let degrees = true, found = true, sameHeight = true, steps = true, swapped = true, tried = 0, maxTurns = 0;
  for (let seed = 1; seed <= 4000; seed++) {
    const s = random(seed, 3 + (seed % 7));
    if (C.plateau(s)) continue;
    tried++;
    const g = C.graph(s), n = g.P.length;
    for (const [p, q] of g.nodes) {
      const d = g.adj.get(g.key(p, q)).length;
      const end = (p === 0 && q === n - 1) || (p === n - 1 && q === 0);
      if (end ? d !== 1 : d % 2 !== 0) degrees = false;
    }
    // the edge relation is symmetric, as the handshake lemma needs
    for (const [p, q] of g.nodes) for (const [a, b] of g.adj.get(g.key(p, q))) if (!g.adj.get(g.key(a, b)).some(([x, y]) => x === p && y === q)) degrees = false;
    const path = C.journey(s);
    if (!path) { found = false; continue; }
    if (path.some((st) => st.white.h !== st.black.h)) sameHeight = false;
    const idx = (pt) => g.P.findIndex((x) => x.x === pt.x && x.h === pt.h);
    for (let k = 1; k < path.length; k++) {
      if (Math.abs(idx(path[k].white) - idx(path[k - 1].white)) !== 1 || Math.abs(idx(path[k].black) - idx(path[k - 1].black)) !== 1) steps = false;
    }
    const last = path[path.length - 1];
    if (path[0].white.x !== 0 || last.white.x !== s.heights.length - 1 || last.black.x !== 0) swapped = false;
    maxTurns = Math.max(maxTurns, C.turns(path, "white"), C.turns(path, "black"));
  }
  check(`${tried} random ranges: (A, Z) and (Z, A) have degree 1, every other pair even degree`, degrees);
  check("so a journey always exists, and the search finds it", found);
  check("along it the men are always at the same height", sameHeight);
  check("each moves one named point at every step", steps);
  check("and they end on each other's starting places", swapped);
  check(`some ranges make a man turn back (up to ${maxTurns} times)`, maxTurns >= 2);
}

{
  // the white man must turn back: a low hill near him, a high one near the other
  const s = C.start({ heights: [0, 0.3, 0.1, 0.9, 0] });
  const path = C.journey(s);
  check("on 0, .3, .1, .9, 0 the first man must go back down before he can go on", path && C.turns(path, "white") >= 1);
  equal("its named points: corners and level crossings", C.named(s).map((p) => p.h).join(" "), "0 0.1 0.3 0.1 0.3 0.9 0.3 0.1 0");
}

{
  const s = C.start();
  check("the applet's range: 7 corners, ends at 0, inner corners between 1/5 and 4/5", s.heights.length === 7 && s.heights[0] === 0 && s.heights[6] === 0 && s.heights.slice(1, 6).every((h) => h >= 0.2 && h <= 0.8));
  const p = C.setHeight(C.setHeight(s, 2, 0.5), 3, 0.5);
  check("two neighbouring corners at one height: a plateau, and no journey", C.plateau(p) && C.journey(p) === null);
  check("the ends cannot be dragged; inner corners stay above the ends", C.setHeight(s, 0, 0.5) === null && C.setHeight(s, 1, -3).heights[1] > 0);
  const before = JSON.stringify(s);
  C.setHeight(s, 1, 0.9);
  equal("dragging leaves the old position alone", JSON.stringify(s), before);
}

done("two-men-of-tibet");
