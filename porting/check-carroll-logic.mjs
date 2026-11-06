#!/usr/bin/env node
"use strict";

/*
 * Logic test for carroll-logic/carroll-logic-core.js.
 *
 * The question that matters for a logic tool: are its conclusions right?
 *
 *   1. Soundness and completeness, by brute force. For every pair of
 *      premise diagrams with counters in their cells (3^4 x 3^4 = 6,561
 *      pairs) that are consistent, and for each of the conclusion's four
 *      cells: Carroll's method makes it red exactly when, in every world (a
 *      choice of which of the 8 kinds of thing exist) where both premises
 *      hold, something of that kind exists; and grey exactly when nothing of
 *      that kind exists in any of them.
 *   2. The bilateral rules: grey never on a line, grey in a cell pushes a red
 *      line counter across, red on a line beside a grey cell lands in the
 *      other cell, between two greys it is refused - and every placement the
 *      rules accept keeps the diagram's meaning: whatever a counter says, the
 *      diagram after the move allows exactly the worlds the counters say.
 *   3. Classic syllogisms come out right, worded as Carroll would: Barbara
 *      (all m are x, all y are m: all y are x), and Celarent (no m are x,
 *      all y are m: no y are x).
 *   4. Contradictory premises are recognised.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const L = loadCore("carroll-logic/carroll-logic-core.js", "CarrollLogicCore");
const { EMPTY, RED, GREY } = L;

const fromCells = (cells) => [...cells, 0, 0, 0, 0];

/* ------------------------------------ 1. the method against brute force */

{
  let pairs = 0;
  let consistent = 0;
  let wrongRed = 0;
  let wrongGrey = 0;
  let missedRed = 0;
  let missedGrey = 0;
  for (let a = 0; a < 81; a++) {
    for (let b = 0; b < 81; b++) {
      const pa = fromCells([0, 1, 2, 3].map((i) => Math.floor(a / 3 ** i) % 3));
      const pb = fromCells([0, 1, 2, 3].map((i) => Math.floor(b / 3 ** i) % 3));
      pairs++;
      if (!L.consistent(pa, pb)) continue;
      consistent++;
      const concl = L.conclusion(L.trilateral(pa, pb));
      for (let c = 0; c < 4; c++) {
        const [k1, k2] = L.CONCLUSION_CELLS[c];
        let alwaysSome = true;
        let alwaysNone = true;
        for (let world = 0; world < 256; world++) {
          if (!L.satisfies(world, pa, L.PREMISE_CELLS[0]) || !L.satisfies(world, pb, L.PREMISE_CELLS[1])) continue;
          const some = ((world >> k1) & 1) || ((world >> k2) & 1);
          if (some) alwaysNone = false;
          else alwaysSome = false;
        }
        if (concl[c] === RED && !alwaysSome) wrongRed++;
        if (concl[c] === GREY && !alwaysNone) wrongGrey++;
        if (alwaysSome && concl[c] !== RED) missedRed++;
        if (alwaysNone && concl[c] !== GREY) missedGrey++;
      }
    }
  }
  equal("premise pairs tried", pairs, 6561);
  console.log(`  ${consistent} consistent pairs`);
  equal("every red conclusion cell is forced by the premises", wrongRed, 0);
  equal("every grey conclusion cell is forced by the premises", wrongGrey, 0);
  equal("every forced 'some' shows as red", missedRed, 0);
  equal("every forced 'none' shows as grey", missedGrey, 0);
}

/* ------------------------------------------------ 2. bilateral rules */

{
  const d = L.blank(8);
  equal("grey on a line does not make sense", L.biPlace(d, 5, GREY), { ok: false, note: "Does not make sense" });
  check("red on the top line", L.biPlace(d, 5, RED).ok);
  const r = L.biPlace(d, 0, GREY);
  check("grey in cell 0 pushes the red line counter into cell 1", r.ok && d[1] === RED && d[5] === EMPTY && r.note === "Moved red chip");
  const e = L.blank(8);
  L.biPlace(e, 0, GREY);
  L.biPlace(e, 1, GREY);
  equal("red between two greys causes conflict", L.biPlace(e, 5, RED), { ok: false, note: "Causes conflict" });
  const f = L.blank(8);
  L.biPlace(f, 0, GREY);
  const g = L.biPlace(f, 5, RED);
  check("red on a line beside a grey cell lands in the other cell", !g.ok && f[1] === RED && f[5] === EMPTY);

  // Every accepted placement keeps the meaning: worlds allowed after = worlds allowed by
  // the counters before plus the new one.
  const worlds = (pos) => {
    const s = [];
    for (let w = 0; w < 256; w++) if (L.satisfies(w, pos, L.PREMISE_CELLS[0])) s.push(w);
    return s.join(",");
  };
  let bad = 0;
  let tried = 0;
  const all = (pos, depth) => {
    if (depth === 0) return;
    for (let p = 0; p < 8; p++) {
      for (const chip of [RED, GREY]) {
        if (pos[p] !== EMPTY) continue;
        const intended = pos.slice();
        intended[p] = chip; // what the player said, without any rule applied
        const after = pos.slice();
        const res = L.biPlace(after, p, chip);
        tried++;
        if (res.ok || after.join() !== pos.join()) {
          if (worlds(after) !== worlds(intended)) bad++;
          all(after, depth - 1);
        }
      }
    }
  };
  all(L.blank(8), 3);
  equal(`every placement the rules carry out keeps its meaning (${tried} tried)`, bad, 0);
}

/* ------------------------------------------------ 3. classic syllogisms */

{
  // Premise A rows x/x', columns m/m'. All m are x: some x m (cell 0 red), no x' m (cell 3 grey).
  const allMareX = fromCells([RED, 0, 0, GREY]);
  // Premise B rows y/y', columns m/m'. All y are m: some y m (cell 0 red), no y m' (cell 1 grey).
  const allYareM = fromCells([RED, GREY, 0, 0]);
  const barbara = L.conclusion(L.trilateral(allMareX, allYareM));
  const sb = L.sentences(barbara, "x", "y");
  check(`Barbara: all y are x (${sb.join("; ")})`, sb.includes("All y are x"));
  const noMareX = fromCells([GREY, 0, 0, 0]);
  const celarent = L.conclusion(L.trilateral(noMareX, allYareM));
  const sc = L.sentences(celarent, "x", "y");
  check(`Celarent: no y are x, said as "No x are y" (${sc.join("; ")})`, sc.includes("No x are y"));
  equal("sentences of a lone red cell", L.sentences([RED, 0, 0, 0], "a", "b"), ["Some a are b"]);
  equal("All a are b needs some a b and no a b'", L.sentences([RED, GREY, 0, 0], "a", "b"), ["Some a are b", "No a are non-b", "All a are b"]);
}

/* -------------------------------------------- 4. contradictory premises */

{
  // No x m, yet (from B) some y m and some y' m, with everything m being x? Simpler: A says no x m and no x' m
  // (so no m at all), B says some y m.
  const a = fromCells([GREY, 0, 0, GREY]);
  const b = fromCells([RED, 0, 0, 0]);
  check("'no m exist' and 'some y are m' contradict each other", !L.consistent(a, b));
}

done("carroll-logic");
