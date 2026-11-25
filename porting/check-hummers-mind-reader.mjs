#!/usr/bin/env node
"use strict";

/*
 * Logic test for hummers-mind-reader/hummers-mind-reader-core.js.
 *
 *   node porting/check-hummers-mind-reader.mjs
 *
 * The trick, on every play it is meant for: for each of the three thoughts,
 * every sequence of announced swaps (each swap one of the 3 pairs) of length 1 to
 * 8 which brings the real objects back to the original order (after the secret
 * first swap of the other two): the computer names the thought, always. That is
 * 3 * 3^k sequences per length, tried in full. Then the failures the page warns
 * about: if the real objects are not back in the original order the answer is
 * right only by luck or the computer asks, and after Announce the coins are in the
 * original order again.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("hummers-mind-reader/hummers-mind-reader-core.js", "HummersCore");
const pairs = [[0, 1], [0, 2], [1, 2]];

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  equal("a new game: penny, nickel, dime in their places, nothing selected", [s.pos, s.selected, s.announcement], [[0, 1, 2], [], null]);
  equal("names", C.NAMES, ["penny", "nickel", "dime"]);
  const a = C.click(s, 0);
  equal("the first click selects", [a.selected, a.pos], [[0], [0, 1, 2]]);
  equal("clicking it again unselects it", C.click(a, 0).selected, []);
  const b = C.click(a, 2);
  equal("the second coin selected swaps the two and clears the selection", [b.pos, b.selected], [[2, 1, 0], []]);
  equal("a bad coin", [C.click(s, 3), C.click(s, -1), C.click(s, 1.5)], [null, null, null]);
  equal("the old position is unchanged", s.pos, [0, 1, 2]);
  equal("in the start position all three coins are in place, so Announce asks", [C.whichOne(s), C.announce(s).announcement.line1, C.announce(s).announcement.line2], [-1, "Hmm, do you have them", "in the original order?"]);
  const t = C.swap(C.start(), 1, 2);
  const an = C.announce(t);
  equal("after one swap of nickel and dime the penny is the one", [C.whichOne(t), an.announcement.line1, an.announcement.line2], [0, "You thought of penny.", "Try again. Press Reset."]);
  equal("with numbers instead of coins: You thought of 1.", C.announce(t, true).announcement.line1, "You thought of 1.");
  equal("Announce puts the other two back, as the applet does", an.pos, [0, 1, 2]);
  equal("after Announce nothing else happens", [C.click(an, 0), C.announce(an)], [null, null]);
  equal("result: done after a name, none after a question", [C.result(an), C.result(C.announce(s)), C.result(s)], ["done", null, null]);
  const cyc = { ...C.start(), pos: [1, 2, 0] };
  equal("a three-cycle puts no coin in its place: the computer asks", [C.whichOne(cyc), C.announce(cyc).announcement.thought], [-1, null]);
}

/* ---------- 2. the trick, every announced sequence that restores the order */
{
  const compose = (arr, [a, b]) => { const r = arr.slice(); [r[a], r[b]] = [r[b], r[a]]; return r; };
  let plays = 0, right = 0, wrongName = 0;
  const byLength = {};
  for (let thought = 0; thought < 3; thought++) {
    const others = [0, 1, 2].filter((x) => x !== thought);       // the two to swap secretly
    for (let len = 1; len <= 8; len++) {
      const total = Math.pow(3, len);
      for (let m = 0; m < total; m++) {
        // real objects: positions as a list, start in original order, then the secret swap
        let real = compose([0, 1, 2], others), s = C.start(), x = m;
        for (let i = 0; i < len; i++) { const p = pairs[x % 3]; x = Math.floor(x / 3); real = compose(real, p); s = C.swap(s, p[0], p[1]); }
        if (real.join() !== "0,1,2") continue;                    // the player is not back in the original order
        plays++; byLength[len] = (byLength[len] || 0) + 1;
        const r = C.announce(s);
        if (r.announcement.thought === thought) right++; else wrongName++;
      }
    }
  }
  console.log("  (plays that end in the original order, by number of announced swaps:", JSON.stringify(byLength) + ")");
  equal(`all ${plays.toLocaleString()} plays that end in the original order name the thought`, [right, wrongName], [plays, 0]);
  equal("only an odd number of announced swaps can end in the original order (parity: the secret swap is odd), and all odd lengths 1..7 occur", [1, 3, 5, 7].every((l) => byLength[l] > 0) && [2, 4, 6, 8].every((l) => !byLength[l]), true);
}

/* --------- 3. not in the original order: the page's warning */
{
  // the same sequences but the real objects end NOT in the original order
  let off = 0, answered = 0, askedAgain = 0, correct = 0;
  const compose = (arr, [a, b]) => { const r = arr.slice(); [r[a], r[b]] = [r[b], r[a]]; return r; };
  for (let thought = 0; thought < 3; thought++) {
    const others = [0, 1, 2].filter((x) => x !== thought);
    for (let len = 1; len <= 6; len++) for (let m = 0; m < Math.pow(3, len); m++) {
      let real = compose([0, 1, 2], others), s = C.start(), x = m;
      for (let i = 0; i < len; i++) { const p = pairs[x % 3]; x = Math.floor(x / 3); real = compose(real, p); s = C.swap(s, p[0], p[1]); }
      if (real.join() === "0,1,2") continue;
      off++;
      const r = C.announce(s);
      if (r.announcement.thought === null) askedAgain++; else { answered++; if (r.announcement.thought === thought) correct++; }
    }
  }
  console.log(`  (${off} plays not ending in the original order: ${answered} answered, ${correct} of them right; ${askedAgain} asked again)`);
  equal("when the order is wrong the computer never names the thought (it answers wrongly or asks again)", correct, 0);
}

done("hummers-mind-reader");
