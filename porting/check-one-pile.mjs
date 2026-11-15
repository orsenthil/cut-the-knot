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
