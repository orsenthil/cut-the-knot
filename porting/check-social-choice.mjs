#!/usr/bin/env node
"use strict";

/*
 * Logic test for social-choice/social-choice-core.js.
 *
 *   node porting/check-social-choice.mjs
 *
 * 1. The page's own ballots (7 ABC, 8 BCA, 10 CBA, 4 ACB): the four methods'
 *    scores worked by hand, and three different winners.
 * 2. COMAP's Math Club election (For All Practical Purposes): four methods,
 *    four different winners.
 * 3. Over 3,000 random elections (2..10 choices, 2..10 ballots): plurality
 *    scores add up to the voters, Borda to voters * n(n+1)/2, pairwise to
 *    n(n-1); elimination ends with a majority or one choice left, and agrees
 *    with the applet's own Hare whenever choice A survives; a Condorcet
 *    winner always tops the pairwise scores.
 * 4. Editing: swaps and Reverse swap, the number of choices and ballots,
 *    voter counts 0..1000, ticking methods.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("social-choice/social-choice-core.js", "SocialChoiceCore");

{
  const s = C.start();
  equal("the page's ballots: plurality 11, 8, 10", C.scores(s, 1).join(), "11,8,10");
  equal("Borda 51, 62, 61", C.scores(s, 2).join(), "51,62,61");
  equal("elimination drops B and C wins 18 to 11", C.scores(s, 3).join(), "11,0,18");
  equal("pairwise: B beats both, C beats A", C.scores(s, 4).join(), "0,4,2");
  equal("winners A, B, C, B", [1, 2, 3, 4].map((m) => C.winners(s, m).join("")).join(","), "A,B,C,B");
  equal("no method is ticked at the start", s.methods.length, 0);
}

{
  const t = C.start({ ballots: [["A", "B", "C", "D", "E"], ["C", "B", "D", "E", "A"], ["D", "C", "B", "E", "A"], ["B", "D", "C", "E", "A"], ["E", "C", "D", "B", "A"]], counts: [14, 10, 8, 4, 1] });
  equal("COMAP's Math Club: plurality A, Borda B, elimination D, pairwise C", [1, 2, 3, 4].map((m) => C.winners(t, m).join("")).join(","), "A,B,D,C");
}

{
  const R = rng(9);
  let sums = true, ends = true, same = true, condorcet = true, quirk = 0, n = 0;
  for (let k = 0; k < 3000; k++) {
    const nc = 2 + Math.floor(R() * 9), ns = 2 + Math.floor(R() * 9);
    const s = C.start({ nc, ns, random: R });
    n++;
    const V = C.voters(s);
    if (C.scores(s, 1).reduce((a, b) => a + b, 0) !== V) sums = false;
    if (C.scores(s, 2).reduce((a, b) => a + b, 0) !== V * nc * (nc + 1) / 2) sums = false;
    if (C.scores(s, 4).reduce((a, b) => a + b, 0) !== nc * (nc - 1)) sums = false;
    const e = C.elimination(s);
    if (!(C.majority(e.scores) || e.eliminated.length === nc - 1)) ends = false;
    if (!e.eliminated.includes("A")) { if (C.appletHare(s).join() !== e.scores.join()) same = false; }
    else if (C.appletHare(s).join() !== e.scores.join()) quirk++;
    // Condorcet winner: beats every other head to head
    for (let i = 0; i < nc; i++) {
      let beatsAll = true;
      for (let j = 0; j < nc && beatsAll; j++) {
        if (i === j) continue;
        let fi = 0, fj = 0;
        s.ballots.forEach((b, v) => { if (b.indexOf(C.LETTERS[i]) < b.indexOf(C.LETTERS[j])) fi += s.counts[v]; else fj += s.counts[v]; });
        if (fi <= fj) beatsAll = false;
      }
      if (beatsAll && (C.scores(s, 4)[i] !== 2 * (nc - 1) || C.winners(s, 4).join() !== C.LETTERS[i])) condorcet = false;
    }
  }
  check(`score totals: plurality = voters, Borda = voters x n(n+1)/2, pairwise = n(n-1) (${n} elections)`, sums);
  check("elimination ends with a majority or a single choice left", ends);
  check("it agrees with the applet's Hare whenever A is not eliminated", same);
  check("where A is eliminated the applet's Hare can stop early; seen in some elections", quirk > 0, String(quirk));
  check("a Condorcet winner always tops the pairwise scores", condorcet);
}

{
  let s = C.start();
  const t = C.swapUp(s, 0, 2);
  equal("a swap moves a choice one place up", t.ballots[0].join(""), "ACB");
  equal("Reverse swap undoes it", C.reverseSwap(t).ballots[0].join(""), "ABC");
  check("nothing to reverse at the start; no swap above the top", C.reverseSwap(s) === null && C.swapUp(s, 0, 0) === null);
  equal("four choices: D added at the bottom of every ballot", C.setChoices(s, 4).ballots.map((b) => b.join("")).join(","), "ABCD,BCAD,CBAD,ACBD");
  equal("two choices: C removed everywhere", C.setChoices(s, 2).ballots.map((b) => b.join("")).join(","), "AB,BA,BA,AB");
  const u = C.setBallots(s, 6, rng(2));
  check("more ballots: random new ones with 0..19 voters", u.ballots.length === 6 && u.counts.slice(4).every((c) => c >= 0 && c < 20) && u.ballots[5].slice().sort().join("") === "ABC");
  equal("fewer ballots drop the last", C.setBallots(s, 2).counts.join(), "7,8");
  equal("choices and ballots are held to 2..10", [C.setChoices(s, 20).ballots[0].length, C.setBallots(s, 1).ballots.length].join(), "10,2");
  equal("voter counts are held to 0..1000", [C.setCount(s, 0, 5000).counts[0], C.setCount(s, 0, -3).counts[0]].join(), "1000,0");
  equal("ticking methods", C.setMethod(C.setMethod(s, 4, true), 2, true).methods.join(), "2,4");
  const before = JSON.stringify(s);
  C.swapUp(s, 1, 1);
  equal("edits leave the old position alone", JSON.stringify(s), before);
}

done("social-choice");
