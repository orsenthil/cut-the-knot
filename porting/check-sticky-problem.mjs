#!/usr/bin/env node
"use strict";

/*
 * Logic checks for Sticky Problem (StickyProblem applet).
 * Exhaustive P-set verification for small count ranges, and the applet's
 * Play() replies against a second transcription of the same rules.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, "..", "sticky-problem", "sticky-problem-core.js"), "utf8");
const S = new Function(src + "; return StickyProblemCore;")();

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  }
}

// --- Standard start is a P-position (page claim) ---
{
  const st = S.start({});
  assert(JSON.stringify(st.sticks) === JSON.stringify([1, 4, 4, 4, 4]), "standard sticks");
  assert(S.isP(st.sticks), "standard (1,0,0,4) is P");
  const c = S.countsOf(st.sticks);
  assert(c[0] === 1 && c[1] === 0 && c[2] === 0 && c[3] === 4, "counts (1,0,0,4)");
}

// --- Empty is P; last mover wins ---
{
  assert(S.isP([]), "(0,0,0,0) is P");
  let st = S.start({ sticks: [1] });
  st = S.removeN(st, 0);
  assert(st.over && st.winner === "you", "taking last length-1 wins");
}

// --- Break and remove legality ---
{
  let st = S.start({ sticks: [4] });
  const b = S.breakAt(st, 0, 1);
  assert(b && JSON.stringify(b.sticks.sort()) === JSON.stringify([1, 3]), "break 4→1+3");
  assert(S.breakAt(st, 0, 0) === null, "break left=0 illegal");
  assert(S.breakAt(st, 0, 4) === null, "break left=len illegal");

  st = S.start({ sticks: [2, 2] });
  const r = S.removeN(st, 0);
  assert(r && r.sticks.length === 0, "remove 2 of length 2");
  st = S.start({ sticks: [2] });
  assert(S.removeN(st, 0) === null, "one length-2 cannot remove-2");
}

// --- Exhaustive: every move from a P-position leaves an N-position;
//     every N-position has a move to a P-position. Counts 0..5 each. ---
{
  function sticksFromCounts(c) {
    const out = [];
    for (let len = 1; len <= 4; len++) {
      for (let i = 0; i < c[len - 1]; i++) out.push(len);
    }
    return out;
  }

  function allMoves(sticks) {
    const moves = [];
    sticks.forEach((len, index) => {
      for (let left = 1; left < len; left++) {
        const next = sticks.slice();
        next.splice(index, 1, left, len - left);
        moves.push(next);
      }
    });
    const c = S.countsOf(sticks);
    for (let len = 1; len <= 4; len++) {
      if (c[len - 1] >= len) {
        let left = len;
        const next = [];
        for (const x of sticks) {
          if (x === len && left > 0) {
            left--;
            continue;
          }
          next.push(x);
        }
        moves.push(next);
      }
    }
    return moves;
  }

  const LIM = 5;
  let checked = 0;
  for (let k = 0; k <= LIM; k++) {
    for (let l = 0; l <= LIM; l++) {
      for (let m = 0; m <= LIM; m++) {
        for (let n = 0; n <= LIM; n++) {
          const sticks = sticksFromCounts([k, l, m, n]);
          const p = S.isP(sticks);
          const moves = allMoves(sticks);
          if (sticks.length === 0) {
            assert(p, "empty is P");
            checked++;
            continue;
          }
          if (p) {
            for (const next of moves) {
              assert(!S.isP(next), `P (${k},${l},${m},${n}) move → still P? ${next}`);
            }
          } else {
            const hasP = moves.some((next) => S.isP(next));
            assert(hasP, `N (${k},${l},${m},${n}) has no move to P`);
          }
          checked++;
        }
      }
    }
  }
  assert(checked === (LIM + 1) ** 4, `checked ${checked} positions`);
  console.log(`exhaustive P-set: ${checked} positions OK`);
}

// --- Second transcription of Play() vs computerChoice ---
{
  function secondPlay(sticks, rnd) {
    const c = S.countsOf(sticks);
    const r = (c[0] + c[2]) % 2;
    const s = (c[1] + c[3]) % 3;
    const diff = s - r;
    const findRemove = (size) => {
      let need = size;
      return sticks.filter((x) => {
        if (x === size && need > 0) {
          need--;
          return false;
        }
        return true;
      });
    };
    const split = (len, a, b) => {
      const i = sticks.findIndex((x) => x === len);
      if (i < 0) return sticks;
      const left = rnd() < 0.5 ? a : b;
      const next = sticks.slice();
      next.splice(i, 1, left, len - left);
      return next;
    };
    if (diff === -1) {
      if (c[0] > 0) return findRemove(1);
      if (c[2] > 0) return split(3, 1, 2);
    } else if (diff === 1) {
      if (c[1] > 0) return split(2, 1, 1);
      if (c[3] > 0) return split(4, 1, 3);
    } else if (diff === 2) {
      if (c[1] > 1) return findRemove(2);
      if (c[3] > 0) return split(4, 2, 2);
    }
    // MakeRandomMove path: use a fixed seed that forces fallback take-1.
    return null; // defer to seeded runs below
  }

  // Deterministic branch comparisons with fixed RNG (always pick first half).
  const rnd0 = () => 0;
  const samples = [
    [1, 4, 4, 4, 4], // P → random path
    [1], // N, diff: s=0 r=1 → -1 → remove 1
    [2], // N
    [3],
    [4],
    [2, 2],
    [1, 1, 1],
    [4, 4, 4],
    [1, 2, 3],
  ];
  for (const sticks of samples) {
    const st = S.start({ sticks });
    if (S.isP(sticks) && sticks.length) continue; // random path
    const a = S.computerChoice(st, rnd0);
    const b = secondPlay(sticks, rnd0);
    if (b === null) continue;
    assert(
      JSON.stringify([...a].sort((x, y) => x - y)) ===
        JSON.stringify([...b].sort((x, y) => x - y)),
      `Play mismatch on ${sticks}: ${a} vs ${b}`,
    );
  }

  // From standard P, after any human move, computer should restore P when
  // the deterministic branch applies (or leave a P via random fallback often).
  const st0 = S.start({});
  for (const m of S.legalMoves(st0)) {
    let st = S.move(st0, m);
    assert(st && !S.isP(st.sticks), "move from P is N");
    // Prefer deterministic RNG that always takes left half / low random.
    st = S.playComputer(st, () => 0);
    // Applet's MakeRandomMove can fail to restore P; only assert when
    // the N-position has a deterministic (s-r) reply.
    const c = S.countsOf(
      S.move(st0, m).sticks,
    );
    const diff = S.sOf(c) - S.rOf(c);
    if (diff === -1 || diff === 1 || diff === 2) {
      assert(S.isP(st.sticks) || st.over, `computer restores P after ${JSON.stringify(m)}`);
    }
  }
}

// --- Computer can open ("Make move") from standard and human can still play ---
{
  let st = S.start({});
  st = S.playComputer(st, () => 0);
  assert(!st.over, "computer first move does not end standard");
  assert(st.turn === "you", "your turn after computer opens");
}

if (failed) {
  console.error(`${failed} failure(s)`);
  process.exit(1);
}
console.log("sticky-problem: all checks passed");
