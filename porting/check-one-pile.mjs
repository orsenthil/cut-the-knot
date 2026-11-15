#!/usr/bin/env node
"use strict";

/*
 * Logic test for one-pile/one-pile-core.js.
 *
 *   node porting/check-one-pile.mjs
 *
 * Checks the rules, the page's P-position formula and Grundy table for
 * Min=3 Max=5, and a second transcription of the applet's MakeMove against
 * the core over many piles and (Min, Max) pairs.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("one-pile/one-pile-core.js", "OnePileCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ min: 8, max: 40, n: 100 });
  equal("page defaults for Min and Max", `${C.DEFAULT_MIN},${C.DEFAULT_MAX}`, "8,40");
  equal("AbsoluteMax from the page param", C.ABSOLUTE_MAX, 45);
  check("a new game with n ≥ Min is your turn and not over", s.n === 100 && s.turn === "you" && !s.over && C.result(s) === null);
  equal("legal takes are every integer from Min to Max", C.legalMoves(s).join(","), Array.from({ length: 33 }, (_, i) => i + 8).join(","));
  equal("below Min is refused", C.move(s, 7), null);
  equal("above Max is refused", C.move(s, 41), null);
  equal("a half take is refused", C.move(s, 8.5), null);

  const t = C.move(s, 10);
  check("a take subtracts and passes the turn", t.n === 90 && t.turn === "computer" && t.history.length === 1);
  equal("you cannot move on the computer's turn", C.move(t, 8), null);

  const win = C.move(C.start({ min: 3, max: 5, n: 5 }), 5);
  check("leaving fewer than Min wins", win.over && win.winner === "you" && C.result(win) === "win");
  equal("from 2 with Min=3 there are no moves", C.legalMoves(C.start({ min: 3, max: 5, n: 2 })).join(","), "");

  const seeded = C.start({ min: 3, max: 5 }, () => 0.25);
  equal("Reset pile is Min+Max+(int)(rnd*Max*4)", seeded.n, 3 + 5 + Math.trunc(0.25 * 5 * 4));

  const back = C.takeBack(t);
  check("take-back restores the pile and whose turn", back.n === 100 && back.turn === "you" && back.history.length === 0);
  equal("take-back with an empty history is null", C.takeBack(s), null);

  // A take can be no bigger than the pile (a deliberate change: the applet showed a negative pile).
  const small = C.start({ min: 3, max: 12, n: 5 });
  equal("with a pile of 5 the takes are 3, 4 and 5", C.legalMoves(small).join(","), "3,4,5");
  equal("a take of 12 from a pile of 5 is refused", C.move(small, 12), null);
  equal("taking exactly the pile wins", C.move(small, 5).winner, "you");
  equal("from a pile of 3 only 3 can be taken", C.legalMoves(C.start({ min: 3, max: 12, n: 3 })).join(","), "3");

  // "Make move": the turn passes to the computer, once, and never after the end.
  const passed = C.skip(s);
  check("skip passes the turn and nothing else", passed.turn === "computer" && passed.n === s.n && passed.history.length === 0);
  equal("skip on the computer's turn does nothing", C.skip(passed), null);
  equal("skip after the end does nothing", C.skip(win), null);
  const reply = C.computerMove(passed, () => 0.5);
  check("after skip the computer moves and the turn comes back", reply && reply.turn === "you" && reply.history.length === 1);
  const undone = C.takeBack(reply);
  check("Take back after the computer's reply returns to the pile and the computer's turn", undone.n === s.n && undone.turn === "computer" && undone.history.length === 0);
  equal("and there is nothing more to take back", C.takeBack(undone), null);

  // The applet's NumberChange handler: Min above Max lifts Max, Max below Min lowers Min.
  equal("Max 5 with Min 8 lowers Min to 5", JSON.stringify(C.setMax({ min: 8, max: 40 }, 5)), JSON.stringify({ min: 5, max: 5 }));
  equal("Max 4 with Min 12 lowers Min to 4", JSON.stringify(C.setMax({ min: 12, max: 40 }, 4)), JSON.stringify({ min: 4, max: 4 }));
  equal("Min 9 with Max 5 lifts Max to 9", JSON.stringify(C.setMin({ min: 3, max: 5 }, 9)), JSON.stringify({ min: 9, max: 9 }));
  equal("Min below Max leaves Max alone", JSON.stringify(C.setMin({ min: 8, max: 40 }, 3)), JSON.stringify({ min: 3, max: 40 }));
  equal("Max above Min leaves Min alone", JSON.stringify(C.setMax({ min: 8, max: 40 }, 20)), JSON.stringify({ min: 8, max: 20 }));

  let refused = 0;
  for (const bad of [{ n: -1, min: 3, max: 5 }, { n: 10, min: 0, max: 5 }, { n: 10, min: 6, max: 5 }, { n: 10, min: 3, max: 46 }]) {
    try { C.restore({ ...bad, turn: "you", history: [] }); } catch { refused++; }
  }
  equal("positions outside the applet's ranges are refused", refused, 4);
  equal("Min is clamped to 1..12", C.clampPair(0, 40).min, 1);
  equal("Max is clamped to 4..45", C.clampPair(3, 99).max, 45);
  equal("Min above Max bumps Max up", C.clampPair(10, 5).max, 10);

  equal("a saved position reads back",
    JSON.stringify(C.snapshot(C.restore(C.snapshot(t)))),
    JSON.stringify(C.snapshot(t)));
}

/* ------------------------------------------- 2. page claims, exhaustively */

{
  // P-positions: 0 ≤ S mod (Min+Max) < Min, for every Min, Max the UI offers
  // and every pile size up to a few periods.
  let wrongP = 0, checked = 0;
  for (let min = C.MIN_MIN; min <= C.MAX_MIN; min++) {
    for (let max = Math.max(C.MIN_MAX, min); max <= C.ABSOLUTE_MAX; max++) {
      const period = min + max;
      for (let n = 0; n < period * 3; n++) {
        checked++;
        const losing = C.isPPosition(n, min, max);
        // A position is losing iff every legal take (with take ≤ n) leaves a
        // non-P, or there are no moves. Check by definition against mex-free
        // recursion would be heavy; instead: from a P, no move to a P; from
        // an N, some move to a P — under take ≤ n.
        const moves = [];
        for (let t = min; t <= max && t <= n; t++) moves.push(t);
        if (n < min) {
          if (!losing) wrongP++;
          continue;
        }
        const canLeaveP = moves.some((t) => C.isPPosition(n - t, min, max));
        if (losing === canLeaveP) wrongP++; // losing ⇒ no move to P; N ⇒ some move to P
      }
    }
  }
  check(`P-position formula matches perfect play (${checked} positions)`, wrongP === 0);

  // The page's Grundy table for Min=3, Max=5.
  const table = [0, 0, 0, 1, 1, 1, 2, 2, 0, 0, 0, 1, 1, 1, 2, 2, 0, 0, 0, 1, 1];
  let gWrong = 0;
  for (let n = 0; n < table.length; n++) {
    if (C.grundy(n, 3, 5) !== table[n]) gWrong++;
  }
  check("Grundy numbers for Min=3 Max=5 match the page", gWrong === 0);

  // With perfect replies the computer never loses from an N-position, and
  // never wins from a P-position, for small Min/Max.
  let games = 0, upset = 0;
  for (let min = 1; min <= 5; min++) {
    for (let max = Math.max(4, min); max <= 8; max++) {
      for (let n = min; n <= (min + max) * 2; n++) {
        games++;
        let s = C.start({ min, max, n });
        const firstWins = !C.isPPosition(n, min, max);
        // Perfect play: always pick a winning move when there is one.
        while (!s.over) {
          const picks = C.winningMoves(s);
          const take = picks.length ? picks[0] : C.legalMoves(s)[0];
          s = C.apply(s, take, s.turn);
        }
        if ((s.winner === "you") !== firstWins) upset++;
      }
    }
  }
  check(`perfect play follows the P-formula (${games} starts)`, upset === 0);
}

// The deliberate change: capping a take at the pile does not change who wins.
// Played out with the applet's rules (a take may overshoot, leaving a pile
// below Min) and with ours, for every Min, Max and pile size up to three periods.
{
  let differ = 0, formulaWrong = 0, positions = 0;
  for (let min = C.MIN_MIN; min <= C.MAX_MIN; min++) {
    for (let max = Math.max(C.MIN_MAX, min); max <= C.ABSOLUTE_MAX; max++) {
      const top = (min + max) * 3;
      const capped = [], uncapped = [];   // true: the player to move wins
      for (let n = 0; n <= top; n++) {
        let c = false, u = false;
        if (n >= min) {
          for (let t = min; t <= max; t++) {
            if (t <= n && (n - t < min || !capped[n - t])) c = true;
            if (n - t < min || !uncapped[n - t]) u = true;   // applet: n - t may be negative
          }
        }
        capped[n] = c; uncapped[n] = u;
        positions++;
        if (c !== u) differ++;
        if (u === C.isPPosition(n, min, max)) formulaWrong++;
      }
    }
  }
  check(`capped and uncapped takes give the same winner (${positions} piles)`, differ === 0, `${differ} differ`);
  check("the P-position formula also holds with the applet's uncapped takes", formulaWrong === 0, `${formulaWrong} wrong`);

  // The computer, which never overshoots: its take is always at most the pile.
  let over = 0, tried = 0;
  for (let min = 1; min <= 12; min++) for (let max = Math.max(4, min); max <= 45; max++) {
    for (let n = min; n <= (min + max) * 2; n++) for (const r of [0, 0.3, 0.6, 0.99]) {
      tried++;
      const next = C.computerMove({ n, min, max, turn: "computer", over: false, winner: null, history: [] }, () => r);
      if (!next) { over++; continue; }
      if (next.n < 0) over++;
    }
  }
  check(`the computer never takes more than the pile (${tried} positions)`, over === 0, `${over} did`);
}

/* ----------------------------- 3. the same answers as the applet's method */

{
  // Second transcription of OnePileGame.MakeMove, straight from the bytecode.
  function appletMakeMove(N, Min, Max, rnd) {
    let take;
    const r = N % (Min + Max);
    if (r >= 0 && r < Min) {
      take = Min + Math.trunc(rnd() * (Max - Min));
    } else if (r <= Max) {
      take = r;
    } else {
      const v = [];
      for (let t = Min; t <= Max; t++) {
        if (0 <= r - t && r - t < Min) v.push(t);
      }
      take = v.length ? v[Math.trunc(rnd() * v.length)] : Min;
    }
    return take;
  }

  let differ = 0, trials = 0;
  for (let min = 1; min <= 8; min++) {
    for (let max = Math.max(4, min); max <= 12; max++) {
      for (let n = min; n <= (min + max) * 3; n++) {
        for (let seed = 0; seed < 5; seed++) {
          trials++;
          let i = 0;
          const seq = [0.0, 0.17, 0.49, 0.73, 0.99];
          const rnd = () => seq[(i++) % seq.length];
          const s = { n, min, max, turn: "computer", over: false, winner: null, history: [] };
          const a = appletMakeMove(n, min, max, rnd);
          i = 0;
          const b = C.computerChoice(s, rnd);
          if (a !== b) differ++;
        }
      }
    }
  }
  check(`computerChoice matches a second MakeMove transcription (${trials} trials)`, differ === 0);

  // From an N-position the computer always leaves a P-position.
  let leftP = 0, nPos = 0;
  for (let n = 8; n <= 200; n++) {
    if (C.isPPosition(n, 8, 40)) continue;
    nPos++;
    const s = { n, min: 8, max: 40, turn: "computer", over: false, winner: null, history: [] };
    const next = C.computerMove(s, () => 0.3);
    if (C.isPPosition(next.n, 8, 40)) leftP++;
  }
  check(`from every N-position with Min=8 Max=40 the computer leaves a P (${nPos})`, leftP === nPos);
}

done("one-pile");
