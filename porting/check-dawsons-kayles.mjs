#!/usr/bin/env node
"use strict";

/*
 * Logic test for dawsons-kayles/dk-core.js.
 *
 * The port recomputes the Grundy values that the applet hard-codes, so the
 * first thing to check is that it gets the applet's own 137 numbers back. After
 * that the real question is whether the Sprague-Grundy decomposition - treat
 * each arc as an independent row and XOR - actually describes the circular
 * game. That is settled by brute force: every one of the 2^n boards for n up to
 * 14 is solved outright and compared with the core's verdict.
 *
 * The comparison finds the one position where the decomposition is wrong, and
 * it is wrong in the applet too: a *full* circle is not a row, because removing
 * any pair leaves a single arc of n-2 rather than two pieces. Every opening
 * move on a full circle leads to the same place, so it costs the opponent
 * nothing, but the test pins the behaviour down rather than letting it slide.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const D = loadCore("dawsons-kayles/dk-core.js", "DawsonKaylesCore");

/* ------------------------------- 1. the applet's own hard-coded 137 values */

// DawsonKaylesGame's `Value` array, read out of the bytecode with javap.
const APPLET = [
  0, 0, 1, 1, 2, 0, 3, 1, 1, 0, 3, 3, 2, 2, 4, 0, 5, 2, 2, 3, 3, 0, 1, 1, 3, 0,
  2, 1, 1, 0, 4, 5, 2, 7, 4, 0, 1, 1, 2, 0, 3, 1, 1, 0, 3, 3, 2, 2, 4, 4, 5, 5,
  2, 3, 3, 0, 1, 1, 3, 0, 2, 1, 1, 0, 4, 5, 3, 7, 4, 8, 1, 1, 2, 0, 3, 1, 1, 0,
  3, 3, 2, 2, 4, 4, 5, 5, 9, 3, 3, 0, 1, 1, 3, 0, 2, 1, 1, 0, 4, 5, 3, 7, 4, 8,
  1, 1, 2, 0, 3, 1, 1, 0, 3, 3, 2, 2, 4, 4, 5, 5, 9, 3, 3, 0, 1, 1, 3, 0, 2, 1,
  1, 0, 4, 5, 3, 7, 4,
];

{
  equal("the applet's table has 137 entries", APPLET.length, 137);
  for (let n = 0; n < APPLET.length; n++) {
    equal(`G(${n}) matches the applet`, D.G(n), APPLET[n]);
  }
  // And the recurrence itself, recomputed independently of the core.
  const g = [0, 0];
  for (let m = 2; m <= 300; m++) {
    const seen = new Set();
    for (let a = 0; a <= m - 2; a++) seen.add(g[a] ^ g[m - 2 - a]);
    let v = 0;
    while (seen.has(v)) v++;
    g[m] = v;
  }
  for (let n = 0; n <= 300; n++) equal(`G(${n}) obeys the mex rule`, D.G(n), g[n]);
}

/* ------------------------------------------- 2. the sequence's period of 34 */

{
  const breaks = [];
  for (let n = 0; n + 34 <= 400; n++) if (D.G(n) !== D.G(n + 34)) breaks.push(n);
  equal("G(n) = G(n+34) except at six places", breaks, [0, 15, 17, 32, 35, 52]);
  // 52 is the last exception, so from 87 on every value is a copy of the one
  // 34 places back and the sequence is purely periodic.
  for (let n = 87; n <= 400; n++) equal(`G(${n}) repeats G(${n - 34})`, D.G(n), D.G(n - 34));
  // The P-positions a player actually aims for, low down.
  const p = [];
  for (let n = 0; n <= 60; n++) if (D.G(n) === 0) p.push(n);
  equal("the rows with G = 0", p, [0, 1, 5, 9, 15, 21, 25, 29, 35, 39, 43, 55, 59]);
}

/* ------------------------------------------------------ 3. reading a board */

const boards = function* (n) {
  for (let mask = 0; mask < 1 << n; mask++) {
    const dots = [];
    for (let i = 0; i < n; i++) dots.push((mask >> i) & 1);
    yield { mask, dots };
  }
};

{
  for (let n = 2; n <= 12; n++) {
    for (const { dots } of boards(n)) {
      // heaps against a plainly-written circular run finder
      const hs = D.heaps(dots);
      const covered = new Set();
      for (const h of hs) {
        check(`arc length >= 2 on ${dots.join("")}`, h.len >= 2);
        for (let k = 0; k < h.len; k++) {
          const at = (h.start + k) % n;
          check(`arc covers a live skittle (${dots.join("")})`, dots[at] === 1);
          check(`arcs do not overlap (${dots.join("")})`, !covered.has(at));
          covered.add(at);
        }
        // maximal: the skittles just outside the arc are dead (or it is the whole ring)
        if (h.len < n) {
          check(`arc is maximal left (${dots.join("")})`, dots[(h.start - 1 + n) % n] === 0);
          check(`arc is maximal right (${dots.join("")})`, dots[(h.start + h.len) % n] === 0);
        }
      }
      // every live skittle with a live neighbour is in some arc
      for (let i = 0; i < n; i++) {
        const paired = dots[i] && (dots[(i + 1) % n] || dots[(i - 1 + n) % n]);
        if (paired) check(`skittle ${i} of ${dots.join("")} is in an arc`, covered.has(i));
      }
      // finished, no legal move and no arc are the same thing
      const fin = D.isFinished(dots);
      equal(`isFinished agrees with legalMoves on ${dots.join("")}`, fin, D.legalMoves(dots).length === 0);
      equal(`isFinished agrees with heaps on ${dots.join("")}`, fin, hs.length === 0);
    }
  }

  // The applet's own bug, repaired here: a pair that wraps past index 0 when
  // both halves are lone skittles. The applet dropped them and read the board
  // as finished.
  const wrap = [1, 0, 0, 0, 0, 1];
  equal("a wrap-around pair is one arc", D.heaps(wrap), [{ start: 5, len: 2 }]);
  check("a wrap-around pair is not finished", !D.isFinished(wrap));
  equal("the opponent finds the wrap-around pair", D.play(wrap, () => 0), 5);
}

/* -------------------------- 4. does the XOR rule really describe the game? */

{
  for (let n = 4; n <= 14; n++) {
    const solved = new Map(); // mask -> true if the player to move wins
    const toMask = (dots) => dots.reduce((m, d, i) => m | (d << i), 0);
    function wins(dots) {
      const mask = toMask(dots);
      if (solved.has(mask)) return solved.get(mask);
      let w = false;
      for (const m of D.legalMoves(dots)) {
        if (!wins(D.applyMove(dots, m))) { w = true; break; }
      }
      solved.set(mask, w);
      return w;
    }

    const full = new Array(n).fill(1);
    for (const { dots } of boards(n)) {
      const truth = wins(dots);
      const byXor = D.nimSum(dots) !== 0;
      const isFull = dots.every((d) => d);
      if (!isFull) {
        equal(`n=${n}: XOR rule decides ${dots.join("")}`, byXor, truth);
      }
      // The opponent must convert a won position into a lost one.
      if (truth) {
        const mv = D.play(dots, () => 0);
        check(`n=${n}: play() returns a legal move from ${dots.join("")}`, D.legalMoves(dots).includes(mv));
        if (!isFull) {
          check(`n=${n}: play() wins from ${dots.join("")}`, !wins(D.applyMove(dots, mv)));
        }
      } else if (D.legalMoves(dots).length) {
        // Lost, but the game is not over: it must still play something legal.
        const mv = D.play(dots, () => 0);
        check(`n=${n}: play() still moves legally from the lost ${dots.join("")}`, D.legalMoves(dots).includes(mv));
      } else {
        equal(`n=${n}: a finished board has no move`, D.play(dots, () => 0), -1);
      }
    }

    // The full circle is the exception, and its value is settled by G(n-2):
    // every opening move leaves the same arc of n-2.
    equal(`n=${n}: the full circle is won iff G(n-2) = 0`, wins(full), D.G(n - 2) === 0);
    const after = D.legalMoves(full).map((m) => D.heaps(D.applyMove(full, m)));
    for (const hs of after) {
      equal(`n=${n}: every opening move leaves one arc of ${n - 2}`, hs, [hs[0]].map((h) => ({ start: h.start, len: n - 2 })));
    }
    // and whatever play() picks, the outcome is the forced one
    const mv = D.play(full, () => 0);
    check(`n=${n}: play() opens legally on a full circle`, D.legalMoves(full).includes(mv));
    equal(`n=${n}: the opening leaves an arc of ${n - 2}`, D.heaps(D.applyMove(full, mv)).map((h) => h.len), n - 2 >= 2 ? [n - 2] : []);
  }
}

/* -------------------------------------- 5. a full game always runs to an end */

{
  // Deterministic PRNG so a failure is reproducible.
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);

  for (let n = D.MIN_N; n <= D.MAX_N; n++) {
    for (const full of [true, false]) {
      const dots0 = D.newBoard(n, full, rnd);
      equal(`newBoard(${n}, ${full}) has ${n} places`, dots0.length, n);
      if (full) {
        check(`newBoard(${n}, true) is a full circle`, dots0.every((d) => d === 1));
      } else {
        const gaps = dots0.filter((d) => d === 0).length;
        check(`newBoard(${n}, false) knocks out 2-4 skittles`, gaps >= 2 && gaps <= 4, `${gaps}`);
        check(`newBoard(${n}, false) knocks out skittle 0`, dots0[0] === 0);
      }
      // play it out: both sides use the opponent's own move chooser
      let dots = dots0;
      let turns = 0;
      while (!D.isFinished(dots)) {
        const mv = D.play(dots, rnd);
        check(`n=${n} full=${full}: move ${mv} is legal`, D.legalMoves(dots).includes(mv));
        dots = D.applyMove(dots, mv);
        if (++turns > n) break;
      }
      check(`n=${n} full=${full}: the game ends`, D.isFinished(dots));
      equal(`n=${n} full=${full}: nothing is left to take`, D.legalMoves(dots), []);
      equal(`n=${n} full=${full}: a finished board has no arcs`, D.heaps(dots), []);
    }
  }
}

/* ------------------- 6. the full-circle claim the page makes, for real sizes */

{
  // The page says the ring of n is won by the player who moves first exactly
  // when G(n-2) = 0, and names the sizes. Section 4 proved the rule by brute
  // force up to n = 14; here it is applied across the whole offered range.
  const firstPlayerWins = [];
  for (let n = D.MIN_N; n <= D.MAX_N; n++) if (D.G(n - 2) === 0) firstPlayerWins.push(n);
  equal("the rings the opener wins", firstPlayerWins, [7, 11, 17, 23, 27, 31, 37]);

  // Play those rings out. After the forced opening it is an ordinary row game,
  // so a player who always restores a XOR of 0 must make the last move.
  const perfect = (dots) => {
    for (const m of D.legalMoves(dots)) if (D.nimSum(D.applyMove(dots, m)) === 0) return m;
    return D.legalMoves(dots)[0];
  };
  // The perfect player always takes the side the theory says wins: opening when
  // G(n-2) = 0, replying when it does not. Either way it must make the last move.
  for (const n of [...firstPlayerWins, 18, 20, 24, 30, 36]) {
    let dots = D.newBoard(n, true, Math.random);
    const perfectOpens = D.G(n - 2) === 0;
    let perfectTurn = perfectOpens;
    let last = null;
    let guard = 0;
    while (!D.isFinished(dots) && guard++ <= n) {
      const mv = perfectTurn ? perfect(dots) : D.play(dots, Math.random);
      check(`ring ${n}: the ${perfectTurn ? "perfect" : "applet"} move is legal`, D.legalMoves(dots).includes(mv));
      dots = D.applyMove(dots, mv);
      last = perfectTurn ? "perfect" : "applet";
      perfectTurn = !perfectTurn;
    }
    check(`ring ${n} finishes`, D.isFinished(dots));
    equal(`ring ${n}: the side the theory favours (${perfectOpens ? "opener" : "replier"}) wins`, last, "perfect");
  }
}

done("check-dawsons-kayles");
