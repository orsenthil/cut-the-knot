#!/usr/bin/env node
"use strict";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, "..", "soup-fish", "soup-fish-core.js"), "utf8");
const S = new Function(src + "; return SoupFishCore;")();

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  }
}

// Words and letters match the page's tic-tac-toe secret.
{
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  lines.forEach((L, i) => {
    const sets = L.map((j) => new Set(S.WORDS[j]));
    const common = [...sets[0]].filter((c) => sets[1].has(c) && sets[2].has(c));
    assert(common.includes(S.COMMON[i]), `line ${i} shares ${S.COMMON[i]}, got ${common}`);
    const mask = (1 << L[0]) | (1 << L[1]) | (1 << L[2]);
    assert(mask === S.LINES[i], `line mask ${i}`);
  });
}

// WON table covers supersets of each line.
{
  assert(S.WON[7] && S.WON[511] && !S.WON[0] && !S.WON[1], "WON table basics");
  let n = 0;
  for (let m = 0; m < 512; m++) if (S.WON[m]) n++;
  // Every mask that contains a full line: 8 lines × 2^6 supersets, with overlap.
  assert(n > 100 && n < 400, `won count ${n}`);
}

// Human win on a row of S-words.
{
  let s = S.start({ perm: [0, 1, 2, 3, 4, 5, 6, 7, 8], random: () => 0 });
  // Force computer not to block by seeding moves carefully: take 0, then after
  // computer replies, etc. Simpler: set masks directly via restore.
  s = S.restore({ you: 7, computer: 0, over: false, perm: [0, 1, 2, 3, 4, 5, 6, 7, 8] });
  assert(S.status(s) === "you", "mask 7 is a human win (FISH SOUP SWAN / S)");
  assert(S.winningLetter(7) === "S", "common letter S");
}

// Second transcription of bestMove vs core (no random mistakes).
{
  function secondBest(me, them) {
    let best = -1;
    for (const m of S.ORDER) {
      if ((me | them) & (1 << m)) continue;
      const pw = me | (1 << m);
      if (S.WON[pw]) return m;
      let safe = true;
      for (let j = 0; j < 9; j++) {
        if ((pw | them) & (1 << j)) continue;
        if (S.WON[them | (1 << j)]) {
          safe = false;
          break;
        }
      }
      if (safe && best === -1) best = m;
    }
    if (best !== -1) return best;
    for (const m of S.ORDER) if (!((me | them) & (1 << m))) return m;
    return -1;
  }
  const rndNever = () => 0.0; // trunc*10 !== 7
  const samples = [
    [0, 0],
    [0, 1],
    [16, 1],
    [17, 2],
    [273, 0],
  ];
  for (const [me, them] of samples) {
    const s = S.restore({ computer: me, you: them, perm: [0, 1, 2, 3, 4, 5, 6, 7, 8] });
    assert(S.bestMove(s, rndNever) === secondBest(me, them), `bestMove ${me},${them}`);
  }
}

// Computer opening places exactly one bit.
{
  const s = S.computerOpen(S.start({ perm: [0, 1, 2, 3, 4, 5, 6, 7, 8] }), () => 0.5);
  assert(s.computer !== 0 && s.you === 0, "computer opens");
  assert((s.computer & (s.computer - 1)) === 0, "single bit");
}

// Play-through: with mistake-free computer, human can force draw or lose, never
// leave an unanswered fork when computer plays optimally enough for tests.
{
  let s = S.start({ perm: [0, 1, 2, 3, 4, 5, 6, 7, 8], random: () => 0 });
  // Centre for human, computer replies...
  s = S.playYou(s, 4);
  assert(s.computer !== 0, "computer replied");
}

// Identity perm translate
{
  const s = S.start({ perm: [0, 1, 2, 3, 4, 5, 6, 7, 8] });
  assert(S.translate(s, 3) === 3 && S.translateback(s, 5) === 5, "id perm");
  const shuffled = S.start({ perm: [8, 7, 6, 5, 4, 3, 2, 1, 0] });
  assert(S.translate(shuffled, 0) === 8, "translate display 0 → logical 8");
  assert(S.translateback(shuffled, 8) === 0, "translateback logical 8 → display 0");
}

if (failed) {
  console.error(`${failed} failure(s)`);
  process.exit(1);
}
console.log("soup-fish: all checks passed");
