#!/usr/bin/env node
"use strict";

/*
 * Logic test for jam/jam-core.js.
 *
 *   1. The map: every city sits on exactly three roads, and those three roads
 *      are one of the applet's eight winning masks; together the cities give
 *      all eight. Roads through the most cities: the middle one (4 cities),
 *      then the four "corner" roads (3), then the four "edge" roads (2) - the
 *      centre, corners and edges of tic-tac-toe.
 *   2. The applet's magic table plus 1 is a magic square, and the eight lines
 *      are exactly the triples of different numbers 1..9 adding up to 15
 *      (the page's "Fif" is the same game again).
 *   3. bestMove() against a second transcription of the bytecode, with the
 *      random number fed in, on every position that can arise.
 *   4. The game itself, solved: with best play Jam (tic-tac-toe) is a
 *      stalemate. Yet the computer even without its "benevolent mistakes" can
 *      be beaten - its one-move look-ahead does not see forks: always when you
 *      move first, and when it opens, after two of its nine openings (roads 1
 *      and 3). The test finds such a win and replays it.
 *   5. Rules: a taken road cannot be taken again; the game ends at a city or
 *      a full board; Start opens on a random road.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const J = loadCore("jam/jam-core.js", "JamCore");
const { LINES, bit, isWon, FULL } = J;

/* ------------------------------------------------------------ 1. the map */

{
  const onSeg = (p, a, b) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(cross) / d > 1e-9) return false;
    const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (d * d);
    return t > -1e-9 && t < 1 + 1e-9;
  };
  const found = J.CITIES.map((c) => {
    let m = 0;
    J.ROAD_ENDS.forEach(([a, b], i) => { if (onSeg(c, J.CITIES[a], J.CITIES[b])) m |= bit(i); });
    return m;
  });
  equal("each city's roads are the line the core says", found, J.CITY_LINE);
  equal("the cities are all eight winning lines", [...found].sort((a, b) => a - b), [...LINES].sort((a, b) => a - b));
  const per = Array.from({ length: 9 }, (_, i) => LINES.filter((l) => l & bit(i)).length);
  equal("cities per road: middle 4, corners 3, edges 2", per, [3, 2, 3, 2, 4, 2, 3, 2, 3]);
}

/* ---------------------------------------------------- 2. the magic square */

{
  const n = J.MAGIC.map((m) => m + 1);
  equal("magic + 1 is the Lo Shu square", n, [4, 9, 2, 3, 5, 7, 8, 1, 6]);
  const fifteen = [];
  for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) for (let c = b + 1; c < 9; c++) {
    if (n[a] + n[b] + n[c] === 15) fifteen.push(bit(a) | bit(b) | bit(c));
  }
  equal("lines = triples of squares whose numbers add to 15", [...fifteen].sort((a, b) => a - b), [...LINES].sort((a, b) => a - b));
}

/* --------------------------------------------- 3. bestMove, transcribed */

function appletBestMove(white, black, rnd) {
  let bestmove = -1;
  for (let i = 0; i < 9; i++) {
    const mw = J.ORDER[i];
    if (((white & (1 << mw)) === 0) && ((black & (1 << mw)) === 0)) {
      if (Math.trunc(rnd() * 10.0) === 7) return mw;
      const pw = white | (1 << mw);
      if (isWon(pw)) return mw;
      let loses = false;
      for (let mb = 0; mb < 9; mb++) {
        if (((pw & (1 << mb)) === 0) && ((black & (1 << mb)) === 0)) {
          const pb = black | (1 << mb);
          if (isWon(pb)) { loses = true; break; }
        }
      }
      if (!loses && bestmove === -1) bestmove = mw;
    }
  }
  if (bestmove !== -1) return bestmove;
  for (let i = 0; i < 9; i++) {
    const mw = J.ORDER[i];
    if (((white & (1 << mw)) === 0) && ((black & (1 << mw)) === 0)) return mw;
  }
  return -1;
}

{
  let bad = 0;
  let positions = 0;
  for (let w = 0; w <= FULL; w++) {
    for (let b = 0; b <= FULL; b++) {
      if (w & b || (w | b) === FULL || isWon(w) || isWon(b)) continue;
      positions++;
      for (const seq of [[0.5], [0.75], [0.1, 0.75, 0.5], [0.5, 0.5, 0.75]]) {
        let i1 = 0;
        let i2 = 0;
        const r1 = () => seq[Math.min(i1++, seq.length - 1)];
        const r2 = () => seq[Math.min(i2++, seq.length - 1)];
        if (J.bestMove({ computer: w, you: b }, r1) !== appletBestMove(w, b, r2)) bad++;
      }
    }
  }
  check(`bestMove matches the applet on ${positions} positions, with and without its random mistakes`, bad === 0, `${bad} differ`);
}

/* --------------------------------------------------- 4. the game, solved */

// Perfect play by both: value for the side to move (1 win, 0 draw, -1 loss).
const memo = new Map();
function value(mine, theirs) {
  const k = mine * 1024 + theirs;
  if (memo.has(k)) return memo.get(k);
  let best = -1;
  if ((mine | theirs) === FULL) best = 0;
  else {
    for (let i = 0; i < 9; i++) {
      if ((mine | theirs) & bit(i)) continue;
      const m = mine | bit(i);
      const v = isWon(m) ? 1 : -value(theirs, m);
      if (v > best) best = v;
      if (best === 1) break;
    }
  }
  memo.set(k, best);
  return best;
}
equal("with best play Jam is a stalemate", value(0, 0), 0);

// You against the computer with no mistakes (rnd never gives 7): can you force a win?
const noMistake = () => 0.5;
function canWin(s, yourTurn) {
  const r = J.status(s);
  if (r) return r === "you";
  if (!yourTurn) {
    const m = J.bestMove(s, noMistake);
    return canWin({ ...s, computer: s.computer | bit(m) }, true);
  }
  for (let i = 0; i < 9; i++) {
    if (!J.free(s, i)) continue;
    if (canWin({ ...s, you: s.you | bit(i) }, false)) return true;
  }
  return false;
}
check("moving first, you can beat the mistake-free computer", canWin({ you: 0, computer: 0 }, true));
{
  const beatable = [];
  for (let open = 0; open < 9; open++) if (canWin({ you: 0, computer: bit(open) }, true)) beatable.push(open);
  // Its search order (centre, corners, edges) breaks the board's symmetry: of the four
  // edge roads it can open on, only two leave it beatable.
  equal("when the computer opens, it can be beaten only after roads 1 and 3", beatable, [1, 3]);
  // Find and replay one winning line, so the claim is concrete.
  function line(s) {
    const r = J.status(s);
    if (r) return r === "you" ? [] : null;
    for (let i = 0; i < 9; i++) {
      if (!J.free(s, i)) continue;
      const t = { ...s, you: s.you | bit(i) };
      if (J.status(t) === "you") return [i];
      if (J.status(t)) continue;
      const m = J.bestMove(t, noMistake);
      const rest = line({ ...t, computer: t.computer | bit(m) });
      if (rest) return [i, ...rest];
    }
    return null;
  }
  const win = line({ you: 0, computer: 0 });
  const g = J.start();
  for (const road of win) J.playYou(g, road, noMistake);
  equal(`replaying the win ${win.join(", ")} through playYou()`, g.result, "you");
  console.log(`  a win against the mistake-free computer: roads ${win.join(", ")}`);
}

/* ------------------------------------------------------------ 5. rules */

{
  const s = J.start();
  check("a free road", J.playYou(s, 4, noMistake) !== null);
  equal("taken roads cannot be taken again", J.playYou(s, 4, noMistake), null);
  const random = rng(5);
  const opens = new Set();
  for (let t = 0; t < 500; t++) opens.add(J.computerOpens(J.start(), random));
  equal("Start opens on any of the nine roads", opens.size, 9);
  let unfinished = 0;
  for (let g = 0; g < 300; g++) {
    const st = J.start();
    while (!st.over) {
      const free = [...Array(9).keys()].filter((i) => J.free(st, i));
      J.playYou(st, free[Math.floor(random() * free.length)], random);
    }
    if (!st.result) unfinished++;
  }
  equal("every game ends with a city or a stalemate", unfinished, 0);
}

done("jam");
