#!/usr/bin/env node
"use strict";

/*
 * Logic test for pm/pm-core.js.
 *
 *   node porting/check-pm.mjs
 *
 * Checks placement rules, scoring, that every complete signing of 1±…±N has
 * the same parity as N(N+1)/2, and that MyMove matches a second transcription
 * of the applet's random choice.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("pm/pm-core.js", "PmCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ n: 5, random: false });
  check("a new game of length 5 has 4 empty gaps", s.n === 5 && C.emptyCount(s) === 4 && C.result(s) === null);
  check("N is clamped to 2..20", C.start({ n: 1 }).n === 2 && C.start({ n: 99 }).n === 20);
}

{
  let s = C.start({ n: 3, random: false, pendingSign: C.PLUS });
  s = C.place(s, 0);
  check("after one + the turn is the computer's", s.turn === "computer" && s.signs[0] === C.PLUS);
  const again = C.place(s, 1);
  check("cannot place on the computer's turn", again.turn === "computer" && again.signs[1] === 0);

  s = C.start({ n: 3, random: false, pendingSign: C.PLUS });
  const occ = C.place(C.place(s, 0), 0);
  // first place moved to computer — need a you-turn state with a filled gap
  s = C.start({ n: 4, random: false, pendingSign: C.PLUS, signs: [C.PLUS, 0, 0] });
  const silly = C.place(s, 0);
  check("occupied gap is refused", silly.error === "occupied" && /silly/i.test(silly.announce));
  const miss = C.place(s, 99);
  check("a miss is refused", miss.error === "miss" && /Click between/i.test(miss.announce));
}

{
  // N=2: one gap. Human places + → total 1+2=3 odd → human wins.
  let s = C.start({ n: 2, random: false, pendingSign: C.PLUS });
  s = C.place(s, 0);
  check("N=2 with + : odd, you win", s.over && C.result(s) === "win" && s.total === 3);

  s = C.start({ n: 2, random: false, pendingSign: C.MINUS });
  s = C.place(s, 0);
  check("N=2 with − : total −1, still odd, you win", s.over && C.result(s) === "win" && s.total === -1);

  // N=3: triangular 6 even — whoever fills, result even, computer wins.
  s = C.start({ n: 3, random: false, pendingSign: C.PLUS, signs: [C.PLUS, 0] });
  s = C.place(s, 1);
  check("N=3 ends even for the computer", s.over && C.result(s) === "lose" && s.total % 2 === 0);
}

/* ------------------------------------------- 2. every case, where it is small */

{
  // Every complete signing has the triangular parity.
  let checked = 0;
  for (let n = 2; n <= 12; n++) {
    const gaps = n - 1;
    const limit = 1 << gaps;
    const triOdd = C.isOdd(C.triangular(n));
    for (let mask = 0; mask < limit; mask++) {
      const signs = [];
      for (let i = 0; i < gaps; i++) signs.push((mask >> i) & 1 ? C.PLUS : C.MINUS);
      const s = C.start({ n, random: false, signs });
      const t = C.total(s);
      check("parity matches triangular n=" + n + " mask=" + mask, C.isOdd(t) === triOdd);
      checked++;
    }
  }
  // 2^1 + 2^2 + ... + 2^11 = 2^12 − 2 = 4094
  check("signing count is 4094", checked === 4094);
}

{
  // Winner by N alone: odd triangular ⇒ you always win; even ⇒ computer.
  for (let n = 2; n <= 20; n++) {
    const odd = C.isOdd(C.triangular(n));
    const signs = Array(n - 1).fill(C.PLUS);
    signs[n - 2] = 0; // leave the last gap for the human
    const finished = C.place(C.start({ n, random: false, pendingSign: C.PLUS, signs }), n - 2);
    check(
      "N=" + n + " predetermined winner",
      finished.over && (odd ? C.result(finished) === "win" : C.result(finished) === "lose"),
    );
  }
}

{
  // Random N on Reset is in 2..20.
  for (let i = 0; i < 40; i++) {
    const s = C.start({ random: true }, () => i / 40);
    check("random N in range", s.n >= 2 && s.n <= 20);
  }
}

/* ----------------------------- 3. the same answers as the applet's own method */

{
  function appletMyMove(signs, rnd) {
    let empty = 0;
    for (const s of signs) if (s === 0) empty++;
    const pick = Math.trunc(rnd() * empty);
    const sign = Math.trunc(rnd() * 2) + 1;
    let seen = 0;
    for (let i = 0; i < signs.length; i++) {
      if (signs[i] !== 0) continue;
      if (seen === pick) return { index: i, sign };
      seen++;
    }
    return null;
  }

  let compared = 0;
  for (let gaps = 1; gaps <= 8; gaps++) {
    for (let mask = 0; mask < 1 << gaps; mask++) {
      if (mask === (1 << gaps) - 1) continue; // no empties
      const signs = [];
      for (let i = 0; i < gaps; i++) signs.push((mask >> i) & 1 ? C.PLUS : 0);
      // ensure at least one empty already by skip; also need some empty — if all plus skip
      if (signs.every((s) => s !== 0)) continue;
      const s = C.start({ n: gaps + 1, random: false, signs });
      s.turn = "computer";
      const rnd = () => 0.37;
      const core = C.chooseComputerMove(s, rnd);
      const ref = appletMyMove(signs, rnd);
      check("MyMove matches applet", core.index === ref.index && core.sign === ref.sign);
      compared++;
    }
  }
  check("compared many MyMove positions", compared > 100);
}

{
  // Computer fills the last gap: scoring uses the same Total.
  let s = C.start({ n: 3, random: false, signs: [C.PLUS, 0] });
  s = Object.assign({}, s, { turn: "computer" });
  const next = C.computerMove(s, () => 0); // pick index 0 of empties → gap 1, sign 1 (+)
  check("computer finishes N=3", next.over && next.winner === "computer");
}

done("pm");
