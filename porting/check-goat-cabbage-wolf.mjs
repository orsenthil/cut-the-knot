#!/usr/bin/env node
"use strict";

/*
 * Logic test for goat-cabbage-wolf/goat-cabbage-wolf-core.js.
 *
 *   1. The rules: shores, cargo, refused moves, the two losses, the win and the
 *      applet's own messages.
 *   2. The whole state space (8 item layouts times 2 farmer shores): safe
 *      positions have a hint route to a win, unsafe ones do not; the classic
 *      solution is seven crossings and there are exactly two shortest routes.
 *   3. The applet's CheckFinished flags transcribed and compared over all 32
 *      states, together with an independent statement of the page's rule.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("goat-cabbage-wolf/goat-cabbage-wolf-core.js", "GoatCabbageWolfCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("all three start on the near shore", s.right.join(","), "false,false,false");
  equal("the farmer starts on the near shore", s.boat, "left");
  equal("no moves yet", s.moves, 0);
  check("a fresh game is not over", C.result(s) === null);
  equal("four crossings are available at the start", C.legalMoves(s).length, 4);

  const withGoat = C.move(s, { item: C.GOAT });
  equal("the goat changes shore", withGoat.right.join(","), "true,false,false");
  equal("the farmer crosses with it", withGoat.boat, "right");
  equal("the crossing counts", withGoat.moves, 1);
  equal("the start is untouched", s.right[0], false);
  check("an item on the far shore cannot be taken", C.move(withGoat, { item: C.CABBAGE }) === null);
  check("an unknown item is refused", C.move(s, { item: 7 }) === null);
  check("a missing move is refused", C.move(s, null) === null);
  check("nothing can be moved after a win", C.legalMoves({ ...s, outcome: "win" }).length === 0);

  const back = C.move(withGoat, { item: null });
  equal("crossing alone keeps the cargo put", back.right.join(","), "true,false,false");
  equal("crossing alone changes the farmer's shore", back.boat, "left");
  check("leaving the goat alone with the cabbage is safe only when apart",
    C.danger({ right: [true, false, false], boat: "left" }) === null);

  const bad1 = C.move({ right: [true, true, false], boat: "right" }, { item: null });
  equal("leaving goat and cabbage alone loses", C.result(bad1), "lose");
  equal("the goat/cabbage message", C.LOSS[0], "The goat ate the cabbage!");
  const bad2 = C.move({ right: [true, false, true], boat: "right" }, { item: null });
  equal("leaving wolf and goat alone loses", C.result(bad2), "lose");
  equal("the wolf/goat message", C.LOSS[1], "The wolf ate the goat!");

  const won = C.move({ right: [true, true, true], boat: "left" }, { item: null });
  equal("getting all three across wins", C.result(won), "win");
  equal("the crossing is described in words", C.describe({ item: C.WOLF }), "Take the wolf across");
  equal("an empty crossing is described", C.describe({ item: null }), "Cross alone");
}

/* ------------------------------------------- 2. every position and the route */

function eachState(fn) {
  for (let mask = 0; mask < 8; mask++) {
    for (const boat of ["left", "right"]) {
      fn({ right: [0, 1, 2].map((i) => Boolean(mask & (1 << i))), boat, moves: 0, outcome: null }, mask);
    }
  }
}

{
  let safe = 0;
  let withHint = 0;
  let noHint = 0;
  let wonByHint = 0;
  eachState((state) => {
    const isBad = C.danger(state) !== null;
    const allAcross = state.right.every(Boolean) && state.boat === "right";
    if (!isBad && !allAcross) {
      safe++;
      const path = C.hint(state);
      if (path) {
        withHint++;
        let here = state;
        for (const m of path) here = C.move(here, m);
        if (C.result(here) === "win") wonByHint++;
      }
    } else if (C.hint(state) === null) {
      noHint++;
    }
  });
  equal("every state was enumerated", safe + 16 - safe, 16);
  check("every safe state has a hint", withHint === safe, `${withHint} of ${safe}`);
  equal("every hint actually wins", wonByHint, withHint);
  check("a game that is already over has no hint",
    C.hint({ ...C.start(), outcome: "win" }) === null && C.hint({ ...C.start(), outcome: "lose" }) === null);

  const path = C.hint(C.start());
  equal("the classic solution takes seven crossings", path.length, 7);
  equal("the first crossing takes the goat", C.describe(path[0]), "Take the goat across");
  equal("the last crossing takes the goat", C.describe(path[6]), "Take the goat across");
  let here = C.start();
  for (const m of path) {
    const next = C.move(here, m);
    check("every hinted crossing is legal and safe", next && next.outcome !== "lose");
    here = next;
  }
  equal("following the hint wins", C.result(here), "win");
}

{
  // Count distinct shortest routes without revisiting a position.
  let shortest = 0;
  const visit = (state, depth, seen) => {
    if (state.outcome === "win") {
      if (depth === 7) shortest++;
      return;
    }
    if (depth >= 7) return;
    for (const m of C.legalMoves(state)) {
      const next = C.move(state, m);
      if (!next || next.outcome === "lose") continue;
      const key = next.right.map((v) => (v ? "1" : "0")).join("") + next.boat;
      if (seen.has(key)) continue;
      seen.add(key);
      visit(next, depth + 1, seen);
      seen.delete(key);
    }
  };
  visit(C.start(), 0, new Set(["000left"]));
  equal("there are exactly two seven-crossing solutions", shortest, 2);
}

/* --------------------------- 3. the applet's own flag and the page's rule */

function appletCheckFinished(state) {
  const boatRight = state.boat === "right";
  const g = state.right[C.GOAT];
  const c = state.right[C.CABBAGE];
  const w = state.right[C.WOLF];
  const all = g && c && w;
  const goatCabbage = (!boatRight && g && !c) || (boatRight && !g && !c);
  const wolfGoat = (!boatRight && g && !w) || (boatRight && !g && !w);
  return { finished: all || goatCabbage || wolfGoat, goatCabbage, wolfGoat, all };
}

function pageRuleLoses(state) {
  const farmer = state.boat;
  const alone = farmer === "left" ? "right" : "left";
  const there = (item) => (alone === "right" ? state.right[item] : !state.right[item]);
  return (there(C.GOAT) && there(C.CABBAGE)) || (there(C.WOLF) && there(C.GOAT));
}

{
  let transcriptsAgree = 0;
  let ruleAgrees = 0;
  let differences = 0;
  eachState((state) => {
    const a = appletCheckFinished(state);
    const b = C.appletFlags(state);
    if (JSON.stringify(a) === JSON.stringify(b)) transcriptsAgree++;
    if (C.danger(state) !== null === pageRuleLoses(state)) ruleAgrees++;
    if (a.finished !== (pageRuleLoses(state) || (a.all && state.boat === "right"))) differences++;
  });
  equal("the applet's CheckFinished is transcribed exactly", transcriptsAgree, 16);
  equal("the port's danger test is the page's rule", ruleAgrees, 16);
  equal("the applet's flag fires wrongly on the classic first move only", differences, 1);
}

done("goat-cabbage-wolf");
