#!/usr/bin/env node
"use strict";

/*
 * Logic test for flavius/flavius-core.js.
 *
 *   node porting/check-flavius.mjs
 *
 * The page's game, for EVERY number of people N from 3 to 50 and every "every which" K from 1 to 50
 * (2,400 games): the applet's counting (the core) removes every K-th person in turn and ends with a
 * single survivor; the survivor and the whole order of removals agree with a second, independent
 * count (a plain list of people, removing the person at index (i + K - 1) mod size each time); the
 * survivor's place agrees with the recurrence J(m) = (J(m-1) + K) mod m of Concrete Mathematics; for
 * K = 2 it agrees with the closed form J(n) = 2L + 1 where n = 2^m + L (1-based); and for the
 * page's story, 40 soldiers killing every third, the safe place is found. Through the game's own
 * moves: a player on every place survives exactly when it is the safe place, and the messages
 * follow the applet.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("flavius/flavius-core.js", "FlaviusCore");

{
  const s = C.start({});
  check("the game opens with 30 people, every third, nobody picked", s.n === 30 && s.k === 3 && s.selected === -1 && s.status.every((v) => v === 0) && C.message(s) === "Please select a smiley" && C.result(s) === null);
  check("N runs from 3 to 50 and K from 1 to 50", C.start({ n: 2 }).n === 3 && C.start({ n: 99 }).n === 50 && C.start({ k: 0 }).k === 1 && C.start({ k: 99 }).k === 50 && C.move(s, { type: "n", value: 51 }) === null && C.move(s, { type: "k", value: 0 }) === null);
  const p = C.move(s, { type: "pick", place: 7 });
  check("a press picks a place (state 2) and the prompt changes", p.status[7] === 2 && p.selected === 7 && C.message(p) === "You can select another fellow or press Slow/Fast");
  check("picking another place moves the pick; pressing your own place takes it back", C.move(p, { type: "pick", place: 3 }).status[7] === 0 && C.move(p, { type: "pick", place: 3 }).status[3] === 2 && C.move(p, { type: "pick", place: 7 }).selected === -1);
  check("counting cannot start before a place is picked", C.move(s, { type: "step" }) === null && C.move(s, { type: "run" }).hits === 0);
  const q = C.move(p, { type: "step" });
  check("one step removes the K-th person from the top: place K - 1 = 2 (state 1), and the pick can no longer be changed", q.status[2] === 1 && q.order.join() === "2" && q.hits === 1 && C.move(q, { type: "pick", place: 9 }) === null);
  check("changing N or K, or Reset, starts again", C.move(q, { type: "n", value: 10 }).n === 10 && C.move(q, { type: "n", value: 10 }).hits === 0 && C.move(q, { type: "k", value: 5 }).k === 5 && C.move(q, { type: "reset" }).selected === -1);
  check("the old position is untouched", s.selected === -1 && p.hits === 0 && s.moves === 0);
}

{
  let n = 0, bad = null;
  for (let size = 3; size <= 50; size++) for (let k = 1; k <= 50; k++) {
    const r = C.simulate(size, k);
    // a second count: a list of people, removing index (i + k - 1) mod length each time
    const people = Array.from({ length: size }, (_, i) => i), order = [];
    let i = 0;
    while (people.length) { i = (i + k - 1) % people.length; order.push(people.splice(i, 1)[0]); }
    if (r.order.join() !== order.join()) bad = `order N=${size} K=${k}`;
    if (r.survivor !== order[order.length - 1]) bad = `survivor N=${size} K=${k}`;
    if (new Set(r.order).size !== size) bad = `not everybody once N=${size} K=${k}`;
    if (C.safePlace(size, k) !== r.survivor) bad = `recurrence N=${size} K=${k}: ${C.safePlace(size, k)} != ${r.survivor}`;
    n++;
  }
  check(`the applet's counting equals a plain list count and the recurrence J(m) = (J(m-1) + K) mod m, for every N from 3 to 50 and every K from 1 to 50 (${n} games)`, bad === null, String(bad));
  let ok = true;
  for (let size = 3; size <= 50; size++) {
    let m = 1; while (m * 2 <= size) m *= 2;
    const J = 2 * (size - m) + 1; // 1-based, counting from 1 at the top
    if (C.simulate(size, 2).survivor + 1 !== J) ok = false;
  }
  check("for K = 2 the survivor is 2L + 1 where N = 2^m + L (1-based), the page's reference, Concrete Mathematics", ok);
  const soldiers = C.simulate(40, 3);
  check(`the page's story: with 40 soldiers killing every third, the safe place is number ${soldiers.survivor + 1} from the top (counting 1 at the top)`, C.safePlace(40, 3) === soldiers.survivor && soldiers.order.length === 40);
  const cave = C.simulate(41, 3);
  equal("the classic legend with 41 people (Josephus and a friend): places 31 and 16 are the last two", `${cave.order[40] + 1} ${cave.order[39] + 1}`, "31 16");
}

{
  // through the game's own moves: a player on every place
  let bad = null, survivors = 0, total = 0;
  for (const [n, k] of [[3, 2], [10, 3], [30, 3], [41, 3], [50, 7], [12, 1], [20, 20]]) {
    const safe = C.simulate(n, k).survivor;
    let won = 0;
    for (let place = 0; place < n; place++) {
      let g = C.move(C.move(C.start({ n, k }), { type: "pick", place }), { type: "run" });
      if (!g.finished) { bad = `not finished ${n},${k},${place}`; break; }
      const win = C.result(g) === "win";
      if (win) won++;
      if (win !== (place === safe)) bad = `result ${n},${k},${place}`;
      if (win && C.message(g) !== "Hooray. You survived. Please try again. Press Reset.") bad = `win message ${n},${k}`;
      if (!win && C.message(g) !== "You got killed. Please get another life. Press Reset.") bad = `lose message ${n},${k}`;
      // the game ends the moment you are removed
      if (!win && g.hits !== g.order.indexOf(place) + 1) bad = `stopped when removed ${n},${k},${place}`;
      total++;
    }
    survivors += won;
    if (won !== 1) bad = bad || `exactly one safe place for ${n},${k}`;
  }
  check(`exactly one place survives, the safe place, in every game tried (${total} players); a player who is removed ends the game there`, bad === null, String(bad));
  check("the last person counted is marked as the survivor (state 5) and cannot be moved on", C.move(C.move(C.start({ n: 3, k: 2 }), { type: "pick", place: C.simulate(3, 2).survivor }), { type: "run" }).status.includes(5));
}

done("flavius");
