#!/usr/bin/env node
"use strict";

/*
 * Logic test for plain-monty-hall/plain-monty-hall-core.js.
 *
 *   node porting/check-plain-monty-hall.mjs
 *
 * 1. The steps of a round and the doors that may be clicked.
 * 2. Every case: car x first pick x the host's coin x the second click, against
 *    a second transcription of the applet's mouseClicked, counts and all.
 * 3. The page's claims: the counts come in equal pairs, and over the equally
 *    likely cases staying wins 1/3 and switching 2/3.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("plain-monty-hall/plain-monty-hall-core.js", "PlainMontyHallCore");
const fixed = (x) => () => x;

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ prize: 0 });
  check("a new round is at the first pick", C.stage(s) === "pick" && C.result(s) === null);
  equal("any door can be picked first", C.legalMoves(s), [0, 1, 2]);
  equal("the counts start at zero", [s.trials, s.stayedWon, s.stayedLost, s.switchedWon, s.switchedLost], [0, 0, 0, 0, 0]);
  check("no such door is refused", C.click(s, 3) === null && C.click(s, -1) === null && C.click(s, 1.5) === null);
  const a = C.click(s, 1);
  check("after the first pick the host has opened a door", C.stage(a) === "choose" && a.opened === 2);
  check("the open door cannot be chosen", C.click(a, 2) === null);
  equal("the two closed doors can be chosen", C.legalMoves(a), [0, 1]);
  const b = C.click(a, 0);
  check("the second click opens everything and ends the round", C.stage(b) === "reveal" && C.result(b) === "win");
  const c = C.click(b, 2, fixed(0.9));
  check("a click after the reveal is the next round's first pick", c.first === 2 && c.final === null && c.prize === 2 && c.trials === 1);
  check("a random start hides the car behind a real door", [0, 0.5, 0.999].every((r) => C.start({ random: fixed(r) }).prize === Math.floor(r * 3)));
}

/* --------------------- 2. every case, against the applet's own mouseClicked */

// The applet: ISpecial is the car. Step 0 sets FirstSelected and opens
// (ISpecial + 1 + 2*random) % 3 when the pick is the car, else 3 - ISpecial - pick.
// Step 1 changes two counts, by which door was clicked.
function applet(car, first, coin, second) {
  const opened = first === car ? Math.trunc(car + 1 + coin * 2) % 3 : 3 - car - first;
  const n = { SwitchedAndWon: 0, SwitchedAndLost: 0, StayedAndWon: 0, StayedAndLost: 0 };
  if (second === first) {
    if (second === car) { n.StayedAndWon++; n.SwitchedAndLost++; } else { n.StayedAndLost++; n.SwitchedAndWon++; }
  } else if (second === car) { n.SwitchedAndWon++; n.StayedAndLost++; } else { n.SwitchedAndLost++; n.StayedAndWon++; }
  return { opened, n };
}

{
  let cases = 0, agree = 0, goatsOpened = 0, coinUsed = new Set();
  for (let car = 0; car < 3; car++) for (let first = 0; first < 3; first++) for (const coin of [0, 0.49, 0.5, 0.99]) {
    const s = C.click(C.start({ prize: car }), first, fixed(coin));
    const ref = applet(car, first, coin, first);
    if (s.opened !== car && s.opened !== first) goatsOpened++;
    if (s.opened === ref.opened) agree++;
    if (car === first) coinUsed.add(`${car}:${s.opened}`);
    for (const second of C.legalMoves(s)) {
      cases++;
      const t = C.click(s, second);
      const r = applet(car, first, coin, second);
      if (t.switchedWon === r.n.SwitchedAndWon && t.switchedLost === r.n.SwitchedAndLost &&
          t.stayedWon === r.n.StayedAndWon && t.stayedLost === r.n.StayedAndLost && t.trials === 1) agree++;
      check(`car ${car}, first ${first}, second ${second}: won exactly when the second door is the car`,
        (C.result(t) === "win") === (second === car));
    }
  }
  check("the host always opens a goat door that is not the pick (36 cases)", goatsOpened === 36);
  check("the core and the applet agree on every door opened and every count", agree === 36 + cases);
  check("with the car picked, the host's coin can open either goat", coinUsed.size === 6);
}

/* ------------------------------------------------ 3. the page's claims */

{
  // Weighted: car and first pick uniform (9 cases); the coin picks either goat.
  let stayWin = 0, switchWin = 0, total = 0;
  for (let car = 0; car < 3; car++) for (let first = 0; first < 3; first++) for (const coin of [0.25, 0.75]) {
    const s = C.click(C.start({ prize: car }), first, fixed(coin));
    const other = C.legalMoves(s).find((d) => d !== first);
    total += 1;
    if (C.result(C.click(s, first)) === "win") stayWin += 1;
    if (C.result(C.click(s, other)) === "win") switchWin += 1;
  }
  check("staying wins 6 of 18 equally likely cases (1/3)", stayWin * 3 === total);
  check("switching wins 12 of 18 equally likely cases (2/3)", switchWin * 3 === total * 2);

  // Many rounds with a seeded generator and a player who does anything at all.
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let s = C.start({ random: rnd });
  for (let i = 0; i < 60000; i++) {
    s = C.click(s, Math.floor(rnd() * 3), rnd);
    const choices = C.legalMoves(s);
    s = C.click(s, choices[Math.floor(rnd() * choices.length)]);
    if (s.switchedLost !== s.stayedWon || s.switchedWon !== s.stayedLost) break;
  }
  check("switched-and-lost always equals stayed-and-won", s.switchedLost === s.stayedWon);
  check("switched-and-won always equals stayed-and-lost", s.switchedWon === s.stayedLost);
  check("every round changes exactly two counts", s.trials === 60000 && s.switchedWon + s.switchedLost === s.trials);
  const r = C.rates(s);
  check(`60,000 rounds: switching wins near 2/3 (${r.switch.toFixed(4)})`, Math.abs(r.switch - 2 / 3) < 0.01);
  check("rates are null with no rounds", C.rates(C.start({ prize: 0 })) === null);
}

done("plain-monty-hall");
