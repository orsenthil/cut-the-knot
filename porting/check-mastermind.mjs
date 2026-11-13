#!/usr/bin/env node
"use strict";

/*
 * Logic test for mastermind/mastermind-core.js.
 *
 *   1. ExactMatches / ColorMatches transcribed a second time from MMCode and
 *      compared on every code/guess pair for small (P,C), plus Knuth's formula
 *      near = colorMatches - exact.
 *   2. The page's claims: guess 1123 vs code 0145 scores (1,0); 3 exact + 1
 *      near is impossible; for P=4,C=6 there are 6^4 = 1296 codes.
 *   3. Game rules: win, loss after P+C-1 rows, no-repetitions rejection.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const H = loadCore("mastermind/mastermind-core.js", "MastermindCore");

/* -------------------- 1. MMCode scoring, again from the bytecode ---------- */

function appletExact(code, guess) {
  let n = 0;
  for (let i = 0; i < code.length; i++) if (code[i] === guess[i]) n++;
  return n;
}
function appletColor(code, guess, colors) {
  const count = (arr) => {
    const c = Array(colors).fill(0);
    for (const x of arr) c[x]++;
    return c;
  };
  const a = count(code);
  const b = count(guess);
  let n = 0;
  for (let i = 0; i < colors; i++) n += Math.min(a[i], b[i]);
  return n;
}

function allCodes(pegs, colors) {
  const out = [];
  const cur = Array(pegs).fill(0);
  function rec(i) {
    if (i === pegs) { out.push(cur.slice()); return; }
    for (let c = 0; c < colors; c++) { cur[i] = c; rec(i + 1); }
  }
  rec(0);
  return out;
}

for (const [P, C] of [[2, 3], [3, 3], [2, 4]]) {
  const codes = allCodes(P, C);
  let differ = 0;
  let impossible = 0;
  for (const code of codes) {
    for (const guess of codes) {
      const aE = appletExact(code, guess);
      const aC = appletColor(code, guess, C);
      const s = H.score(code, guess, C);
      if (s.exact !== aE || s.near !== aC - aE) differ++;
      if (s.exact === P - 1 && s.near >= 1) impossible++;
      if (s.exact + s.near > P) impossible++;
    }
  }
  check(`P=${P},C=${C}: score() = MMCode Exact/ColorMatches`, differ === 0, `${differ} differ`);
  check(`P=${P},C=${C}: never (P-1 exact and ≥1 near), never exact+near > P`, impossible === 0);
}

/* -------------------------------- 2. the page's claims -------------------- */

{
  const s = H.score([0, 1, 4, 5], [1, 1, 2, 3], 6);
  equal("page example: 1123 vs 0145 → 1 exact, 0 near", s, { exact: 1, near: 0 });
}

equal("classic Mastermind has 6^4 = 1296 codes", allCodes(4, 6).length, 1296);

{
  // Knuth note: 3 red + 1 pink never happens for P=4.
  let bad = 0;
  for (const code of allCodes(4, 6)) {
    // sample 200 guesses per code would be huge; check all is 1296^2 ≈ 1.6e6 — fine.
  }
  // Full check for 3+1 on a slice of codes, and a dedicated search.
  const codes = allCodes(4, 6);
  for (let i = 0; i < codes.length; i += 7) {
    for (let j = 0; j < codes.length; j += 11) {
      const s = H.score(codes[i], codes[j], 6);
      if (s.exact === 3 && s.near === 1) bad++;
    }
  }
  // And exhaustively for a fixed code against every guess.
  for (const guess of codes) {
    const s = H.score([0, 1, 2, 3], guess, 6);
    if (s.exact === 3 && s.near === 1) bad++;
  }
  check("3 exact + 1 near is impossible (Knuth / Weber note)", bad === 0);
}

{
  // near = colorMatches - exact, always, for random pairs.
  const rand = rng(7);
  let bad = 0;
  for (let t = 0; t < 2000; t++) {
    const P = 2 + Math.floor(rand() * 5);
    const C = 2 + Math.floor(rand() * 6);
    const code = H.randomCode(P, C, true, rand);
    const guess = H.randomCode(P, C, true, rand);
    const s = H.score(code, guess, C);
    if (s.near !== H.colorMatches(code, guess, C) - s.exact) bad++;
    if (s.exact + s.near > P) bad++;
  }
  check("near = colorMatches - exact on 2000 random pairs", bad === 0);
}

/* -------------------------------- 3. game rules --------------------------- */

{
  const s = H.start(4, 6, true, () => 0); // code all 0s
  equal("secret is length 4", s.code.length, 4);
  equal("rows = P+C-1 = 9", s.rows, 9);
  const r = H.guess(s, [0, 0, 0, 0]);
  equal("perfect guess scores 4 exact", r, { exact: 4, near: 0 });
  check("and the game is won", s.won && !s.lost);
}

{
  const s = H.start(2, 2, true, () => 0.99); // code [1,1]
  equal("rows for 2+2-1", s.rows, 3);
  H.guess(s, [0, 0]);
  H.guess(s, [0, 1]);
  H.guess(s, [1, 0]);
  check("used up all rows without solving → lost", s.lost && !s.won);
  equal("no more guesses accepted", H.guess(s, [1, 1]), null);
}

{
  const s = H.start(4, 6, false, rng(1));
  check("no-repeats secret has distinct colours", !H.hasDuplicates(s.code));
  const err = H.guess(s, [0, 0, 1, 2]);
  equal("duplicate guess rejected when repeats off", err, { error: "No repetitions, please." });
  equal("guess list unchanged", s.guesses.length, 0);
}

{
  // Continuous scoring identity: score is symmetric in the Knuth total-count sense
  // for the page's worked static 2-peg 3-colour example responses.
  const responses = {};
  for (const code of allCodes(2, 3)) {
    const key = code.join("");
    responses[key] =
      H.score(code, [0, 2], 3).exact + "" + H.score(code, [0, 2], 3).near +
      H.score(code, [1, 2], 3).exact + "" + H.score(code, [1, 2], 3).near;
  }
  // Page lists 9 distinct response vectors for guesses (0,2) and (1,2).
  equal("static example: 9 codes give 9 distinct response pairs", new Set(Object.values(responses)).size, 9);
}

equal("defaults are classic 4 pegs, 6 colours", [H.DEFAULT_PEGS, H.DEFAULT_COLORS], [4, 6]);

done("mastermind");
