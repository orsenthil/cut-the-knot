#!/usr/bin/env node
"use strict";

/*
 * Logic test for monty-hall/monty-hall-core.js.
 *
 *   node porting/check-monty-hall.mjs
 *
 * The rules and the counters (as the applet's mouseClicked does). Then the
 * mathematics, by exact counting over every equally likely case (car behind
 * door c, first pick p, 9 cases): staying wins in 3, switching in 6, so 1/3
 * and 2/3, and a simulation of 600,000 trials agrees. The page's remarks on the
 * host's mindset, also by exact counting: a host who opens one of the other
 * two doors at random (and may show the car) leaves stay and switch at 1/2 each
 * once a goat is shown; a host who opens a door only when the player picked the
 * car makes switching always lose; one who offers the switch only when the
 * player picked a goat makes it always win.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("monty-hall/monty-hall-core.js", "MontyCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start({ random: () => 0.5 });
  equal("a new game: car behind door 1 (index), nothing picked, no counts", [s.car, s.picked, s.trials, s.switchedWon, s.switchedLost, s.stayedWon, s.stayedLost], [1, null, 0, 0, 0, 0, 0]);
  const won = C.pick(s, 1);
  equal("picking the car door: stay would have won, switching lost, one trial", [won.trials, won.stayedWon, won.switchedLost, won.switchedWon, won.stayedLost], [1, 1, 1, 0, 0]);
  const lost = C.pick(s, 0);
  equal("picking a goat door: switching would have won, staying lost", [lost.trials, lost.switchedWon, lost.stayedLost, lost.stayedWon, lost.switchedLost], [1, 1, 1, 0, 0]);
  equal("a bad door", [C.pick(s, 3), C.pick(s, -1), C.pick(s, 0.5)], [null, null, null]);
  const again = C.pick(lost, 2, () => 0.0);
  equal("the next click starts a new trial with a new car (here door 0) and adds to the counts", [again.car, again.picked, again.trials, again.switchedWon, again.stayedLost, again.stayedWon, again.switchedLost], [0, 2, 2, 2, 2, 0, 0]);
  equal("the host opens a goat door that is not the pick: car 0, pick 1 -> door 2", [C.hostOpens(0, 1), C.hostOpens(0, 2), C.hostOpens(1, 1)], [2, 1, 0]);
  equal("switching goes to the remaining closed door: car 0, pick 1 -> 0", [C.switchTo(0, 1), C.switchTo(0, 2), C.switchTo(1, 1)], [0, 0, 2]);
  equal("outcome of the trial just shown", [C.outcome(won), C.outcome(lost), C.outcome(s)], [{ stay: "won", switch: "lost" }, { stay: "lost", switch: "won" }, null]);
  equal("rates are the shares of trials; none before a trial", [C.rates(s), C.rates(won), C.rates(lost)], [null, { stay: 1, switch: 0 }, { stay: 0, switch: 1 }]);
  equal("the old position is unchanged", [s.trials, s.picked], [0, null]);
}

/* -------- 2. exact counting: the standard host, all 9 equally likely cases */
{
  let stay = 0, sw = 0, cases = 0;
  for (let car = 0; car < 3; car++) for (let p = 0; p < 3; p++) {
    cases++;
    const open = C.hostOpens(car, p), target = C.switchTo(car, p);
    if (open === car || open === p) throw new Error("host opened a bad door");
    if (p === car) stay++;
    if (target === car) sw++;
  }
  equal(`of ${cases} equally likely cases staying wins in 3 and switching in 6 (1/3 and 2/3)`, [stay, sw], [3, 6]);
  // the host's door is always a goat door that is not the pick, and the switch is the third door
  let ok = true;
  for (let car = 0; car < 3; car++) for (let p = 0; p < 3; p++) {
    const open = C.hostOpens(car, p), t = C.switchTo(car, p);
    if (!(open !== p && open !== car && t !== p && t !== open && new Set([p, open, t]).size === 3)) ok = false;
  }
  equal("pick, host's door and switch door are always three different doors", ok, true);
  // simulation
  const r = rng(314), N = 600000;
  let s = C.start({ random: r }); for (let i = 0; i < N; i++) s = C.pick(s, Math.floor(r() * 3), r);
  const rate = C.rates(s);
  console.log(`  (${N.toLocaleString()} simulated trials: staying ${(100 * rate.stay).toFixed(2)}%, switching ${(100 * rate.switch).toFixed(2)}%)`);
  check("the simulation: staying wins about 1/3 of the time", Math.abs(rate.stay - 1 / 3) < 0.005, String(rate.stay));
  check("the simulation: switching wins about 2/3 of the time", Math.abs(rate.switch - 2 / 3) < 0.005, String(rate.switch));
  equal("the four counters add up: stay+switch won = trials = stay+switch lost", [s.stayedWon + s.switchedWon, s.stayedLost + s.switchedLost, s.trials], [N, N, N]);
  equal("staying won exactly when switching lost", [s.stayedWon, s.switchedLost], [s.switchedLost, s.stayedWon]);
}

/* ------------- 3. the page's host's mindset, by exact counting */
{
  // Host B: opens one of the other two doors at random, whatever is behind it.
  // Condition on a goat being shown. Cases (car, pick, opened) with probability (1/9) * (1/2).
  let goatShown = 0, stayWins = 0, switchWins = 0;
  for (let car = 0; car < 3; car++) for (let p = 0; p < 3; p++) for (const open of [0, 1, 2].filter((d) => d !== p)) {
    if (open === car) continue;               // the car was shown: that round does not count
    goatShown++;
    const t = [0, 1, 2].find((d) => d !== p && d !== open);
    if (p === car) stayWins++;
    if (t === car) switchWins++;
  }
  equal("a host who opens a random other door and happens to show a goat: stay and switch are 6 in 12 each (1/2)", [goatShown, stayWins, switchWins], [12, 6, 6]);
  // Host C (malevolent): offers the switch only when the player picked the car.
  let c = { n: 0, switchWins: 0 };
  for (let car = 0; car < 3; car++) for (let p = 0; p < 3; p++) if (p === car) { c.n++; if (C.switchTo(car, p) === car) c.switchWins++; }
  equal("a host who opens a door only when the player picked the car: switching always loses", c, { n: 3, switchWins: 0 });
  // Host D (benevolent): offers the switch only when the player picked a goat.
  let d = { n: 0, switchWins: 0 };
  for (let car = 0; car < 3; car++) for (let p = 0; p < 3; p++) if (p !== car) { d.n++; if (C.switchTo(car, p) === car) d.switchWins++; }
  equal("a host who opens a door only when the player picked a goat: switching always wins", d, { n: 6, switchWins: 6 });
  // The page's quoted reasoning ("2 doors, 50-50") fails: with the standard host the remaining two doors are not equally likely.
  equal("with the standard host the two doors left are 1/3 (your pick) and 2/3 (the other)", [3 / 9, 6 / 9], [1 / 3, 2 / 3]);
}

done("monty-hall");
