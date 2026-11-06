#!/usr/bin/env node
"use strict";

/*
 * Logic test for kayles/kayles-core.js.
 *
 *   1. The mex rule reproduces the applet's hard-coded table KaylesGame.Value
 *      (84 values), and the known long-run behaviour: from n = 71 on the
 *      values repeat with period 12 (Guy and Smith), checked up to n = 400.
 *   2. heaps() and play() against KaylesGame's constructor, Play, GoodMove and
 *      MakeRandomMove, transcribed again from the bytecode with the applet's
 *      own table and the random number fed in, on positions from random games
 *      for every board size from 10 to 60.
 *   3. Sprague-Grundy holds: brute-force win/loss search over every position
 *      of a circle of up to 14 skittles agrees with "XOR of arcs is 0".
 *   4. The computer, from any position whose XOR is not 0, always moves to one
 *      whose XOR is 0 (for positions that are not an unbroken circle).
 *   5. The page's claim (Gardner): on a full circle the second player always
 *      wins - the first move leaves a row of n-1 or n-2, neither of which is a
 *      lost position, for every n from 10 to 60; and the mirror strategy really
 *      is available: the second player can always split that row into two
 *      equal rows.
 *   6. newBoard(): the gaps it knocks out, and the full circle.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const K = loadCore("kayles/kayles-core.js", "KaylesCore");

const APPLET_VALUE = [0,1,2,3,1,4,3,2,1,4,2,6,4,1,2,7,1,4,3,2,1,4,6,7,4,1,2,8,5,4,7,2,1,8,6,7,4,1,2,3,1,4,7,2,1,8,2,7,4,1,2,8,1,4,7,2,1,4,2,7,4,1,2,8,1,4,7,2,1,8,6,7,4,1,2,8,1,4,7,2,1,8,2,7];

/* --------------------------------------------------------- 1. the table */

equal("the mex rule gives the applet's 84 values", APPLET_VALUE.map((_, n) => K.G(n)), APPLET_VALUE);
{
  let bad = 0;
  for (let n = 71; n + 12 <= 400; n++) if (K.G(n) !== K.G(n + 12)) bad++;
  equal("from 71 on, the values repeat every 12 (checked to 400)", bad, 0);
  check("but not from 70", K.G(70) !== K.G(82));
  check("the table covers every board size", K.MAX_N < APPLET_VALUE.length);
}

/* ---------------------------------------------------- 2. the applet itself */

function appletHeaps(sk) {
  const heaps = [];
  let i = 0;
  while (i < sk.length) {
    while (i < sk.length && sk[i] === 0) i++;
    if (i === sk.length) break;
    let j = i;
    while (j < sk.length && sk[j] === 1) j++;
    heaps.push([i, j - 1]);
    i = j;
  }
  if (heaps.length > 1) {
    const a = heaps[0];
    const b = heaps[heaps.length - 1];
    if (b[1] === sk.length - 1 && a[0] === 0) {
      b[1] = b[1] + (a[1] + 1);
      heaps.shift();
    }
  }
  return heaps;
}
function appletPlay(sk, rnd) {
  const V = APPLET_VALUE;
  const heaps = appletHeaps(sk);
  let x = 0;
  for (const [a, b] of heaps) x ^= V[b - a + 1];
  const good = (start, len, target) => {
    for (let k = 0; k < len; k++) if ((V[k] ^ V[len - k - 1]) === target) return [(start + k) % sk.length, 0];
    for (let k = 0; k < len - 1; k++) if ((V[k] ^ V[len - k - 2]) === target) return [(start + k) % sk.length, 1];
    return null;
  };
  const random = () => {
    const [a, b] = heaps[Math.trunc(rnd() * heaps.length)];
    const len = b - a + 1;
    if (len === 1) return [a, 0];
    const t = Math.trunc(rnd() * 2);
    const off = Math.trunc(rnd() * (len - t));
    return [(a + off) % sk.length, t];
  };
  if (x === 0) return random();
  for (const [a, b] of heaps) {
    const m = good(a, b - a + 1, x ^ V[b - a + 1]);
    if (m) return m;
  }
  return random();
}

{
  const random = rng(17);
  let bad = 0;
  let positions = 0;
  for (let n = K.MIN_N; n <= K.MAX_N; n++) {
    for (let g = 0; g < 4; g++) {
      let dots = K.newBoard(n, g % 2 === 0, random);
      while (!K.isFinished(dots)) {
        positions++;
        const mine = K.heaps(dots).map((h) => [h.start, h.start + h.len - 1]);
        if (JSON.stringify(mine) !== JSON.stringify(appletHeaps(dots))) bad++;
        const seq = [random(), random(), random()];
        let i1 = 0;
        let i2 = 0;
        const m = K.play(dots, () => seq[i1++ % 3]);
        const a = appletPlay(dots, () => seq[i2++ % 3]);
        if (m.at !== a[0] || m.pair !== (a[1] === 1)) bad++;
        if (!K.legal(dots, m)) bad++;
        dots = K.applyMove(dots, m);
      }
    }
  }
  check(`heaps() and play() match the applet on ${positions} positions`, bad === 0, `${bad} differ`);
}

/* ------------------------------------------- 3 and 4. Sprague-Grundy */

function allMoves(dots) {
  const out = [];
  for (let i = 0; i < dots.length; i++) {
    if (!dots[i]) continue;
    out.push({ at: i, pair: false });
    if (dots[(i + 1) % dots.length]) out.push({ at: i, pair: true });
  }
  return out;
}
const xorOf = (dots) => K.heaps(dots).reduce((x, h) => x ^ K.G(h.len), 0);
const fullCircle = (dots) => dots.every((d) => d);
for (let n = 3; n <= 14; n++) {
  const memo = new Map();
  const toMoveWins = (dots) => {
    const k = dots.join("");
    if (memo.has(k)) return memo.get(k);
    const w = allMoves(dots).some((m) => !toMoveWins(K.applyMove(dots, m)));
    memo.set(k, w);
    return w;
  };
  let mismatch = 0;
  let badPlay = 0;
  for (let mask = 0; mask < 2 ** n; mask++) {
    const dots = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
    if (fullCircle(dots)) continue; // a circle is not a row: handled in section 5
    const x = xorOf(dots);
    if (toMoveWins(dots) !== (x !== 0)) mismatch++;
    if (x !== 0) {
      const after = K.applyMove(dots, K.play(dots, () => 0.5));
      if (xorOf(after) !== 0 && !K.isFinished(after)) badPlay++;
    }
  }
  if (mismatch || badPlay) check(`n=${n}: Sprague-Grundy and the computer`, false, `${mismatch} mismatches, ${badPlay} bad moves`);
}
check("Sprague-Grundy matches brute force on every broken circle of 3 to 14 skittles", true);

/* --------------------------------------- 5. the full circle is lost */

{
  let bad = 0;
  for (let n = 3; n <= K.MAX_N; n++) {
    // The first move leaves a row of n-1 (one skittle) or n-2 (a pair); both must be wins
    // for the player who then moves, i.e. non-zero.
    if (K.G(n - 1) === 0 || K.G(n - 2) === 0) bad++;
  }
  equal("on a full circle of 3 to 60, every first move leaves a won position for the second player", bad, 0);
  let noMirror = 0;
  for (let len = 1; len <= K.MAX_N; len++) {
    // A row of len: knock down the middle one (len odd) or middle two (len even) to leave two equal rows.
    const left = len % 2 ? (len - 1) / 2 : (len - 2) / 2;
    const right = len - left - (len % 2 ? 1 : 2);
    if (left !== right || left < 0) noMirror++;
  }
  equal("the second player can always split the row into two equal rows", noMirror, 0);
}

/* --------------------------------------------------------- 6. boards */

{
  const random = rng(3);
  equal("full circle: every skittle up", K.newBoard(18, true).every((d) => d === 1), true);
  for (const [n, gaps] of [[18, 2], [30, 3], [50, 4]]) {
    let wrong = 0;
    for (let t = 0; t < 300; t++) if (K.newBoard(n, false, random).filter((d) => !d).length !== gaps) wrong++;
    equal(`${n} skittles: ${gaps} gaps knocked out`, wrong, 0);
  }
  equal("10 to 60 skittles, 18 to start", [K.MIN_N, K.MAX_N, K.DEFAULT_N], [10, 60, 18]);
}

done("kayles");
