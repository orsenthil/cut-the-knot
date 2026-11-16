#!/usr/bin/env node
"use strict";

/*
 * Logic test for pick-label/pick-label-core.js.
 *
 * Derange() is checked exhaustively against the applet's six content
 * permutations and two label derangements; every deal has all labels wrong.
 * The classic strategy (open the WB-labelled box) is checked: the revealed
 * colour forces a unique correct labelling.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("pick-label/pick-label-core.js", "PickLabelCore");

equal("six content permutations", C.CONTENT_PERMS.length, 6);
equal("two label derangements", C.LABEL_DERANGEMENTS.length, 2);

{
  // Every (perm, derangement) pair: labels are a derangement of contents.
  let pairs = 0;
  for (const perm of C.CONTENT_PERMS) {
    for (const d of C.LABEL_DERANGEMENTS) {
      const labels = [perm[d[0]], perm[d[1]], perm[d[2]]];
      check(`labels wrong for ${perm} via ${d}`, labels.every((lab, i) => lab !== perm[i]));
      equal(`labels are {0,1,2}`, labels.slice().sort().join(","), "0,1,2");
      pairs++;
    }
  }
  equal("12 labelling pairs checked", pairs, 12);
}

{
  // derange() with a fixed RNG matches picking perm[r] and derangement[0|1].
  const random = rng(42);
  const a = C.derange(random);
  const random2 = rng(42);
  const r = Math.floor(random2() * 6);
  const dIdx = random2() < 0.5 ? 0 : 1;
  const perm = C.CONTENT_PERMS[r];
  const d = C.LABEL_DERANGEMENTS[dIdx];
  equal("derange contents", a.contents, perm);
  equal("derange labels", a.labels, [perm[d[0]], perm[d[1]], perm[d[2]]]);
}

{
  const s0 = C.start({ random: rng(1) });
  check("fresh deal has all labels wrong", C.labelsWrong(s0));
  equal("starts in SELECT", s0.phase, C.SELECT);
  const wbBox = s0.labels.indexOf(C.WB);
  check("exactly one box labelled WB", wbBox >= 0);

  // Strategy from the page: open the WB-labelled box.
  const s1 = C.pickBox(s0, wbBox, rng(99));
  equal("after pick, LABEL phase", s1.phase, C.LABEL);
  check("revealed a colour", s1.revealed && (s1.revealed.color === 0 || s1.revealed.color === 1));
  // That box cannot be WB (label is wrong), so it is WW or BB matching the colour.
  const mustBe = s1.revealed.color === 0 ? C.WW : C.BB;
  equal("WB-labelled box content matches the ball", s1.contents[wbBox], mustBe);

  // Remaining two boxes: the other same-colour label goes on the mixed box,
  // and the leftover label on the leftover box — unique completion.
  const otherSame = mustBe === C.WW ? C.BB : C.WW;
  const boxes = [0, 1, 2].filter((i) => i !== wbBox);
  // The box currently labelled otherSame cannot be otherSame, so it is WB.
  const labelledOther = boxes.find((i) => s1.labels[i] === otherSame);
  const last = boxes.find((i) => i !== labelledOther);
  let s = C.assignGuess(s1, wbBox, mustBe);
  s = C.assignGuess(s, labelledOther, C.WB);
  s = C.assignGuess(s, last, otherSame);
  equal("three guesses ready to verify", s.phase, C.VERIFY);
  check("classic strategy is correct", C.allCorrect(s));
  const doneState = C.verify(s);
  check("verify marks a win", doneState.won);
  equal("win caption", doneState.announce, C.CAPTIONS[3]);
}

{
  // Wrong labelling loses.
  let s = C.start({ random: rng(7) });
  s = C.pickBox(s, 0, rng(8));
  s = C.assignGuess(s, 0, s.labels[0]); // guess equals the (wrong) printed label — never right
  s = C.assignGuess(s, 1, s.labels[1]);
  s = C.assignGuess(s, 2, s.labels[2]);
  // May accidentally be right if... no, labels are always wrong, so guessing the printed labels is always all wrong.
  check("guessing the printed labels is never all correct", !C.allCorrect(s));
  const lost = C.verify(s);
  check("verify marks a loss", !lost.won);
  equal("loss caption", lost.announce, C.CAPTIONS[4]);
}

{
  // PopOne colour rules.
  const white = C.pickBox({
    ...C.start({ random: () => 0 }),
    contents: [C.WW, C.WB, C.BB],
    labels: [C.WB, C.BB, C.WW],
    phase: C.SELECT,
  }, 0, () => 0.9);
  equal("WW always pops white", white.revealed.color, 0);
  const black = C.pickBox({
    ...C.start({ random: () => 0 }),
    contents: [C.WW, C.WB, C.BB],
    labels: [C.WB, C.BB, C.WW],
    phase: C.SELECT,
  }, 2, () => 0.1);
  equal("BB always pops black", black.revealed.color, 1);
}

done("pick-label");
