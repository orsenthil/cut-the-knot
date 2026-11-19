#!/usr/bin/env node
"use strict";

/*
 * Logic test for cards/cards-core.js.
 *
 * 1. The core is compared with a second, literal transcription of the
 *    applet's own DrawCard(), Yes() and No() over every card, every card bit
 *    and every accumulated result in a representative range.
 * 2. Honest play is checked exhaustively: every secret 1..99 against all 128
 *    possible sequences of randomly chosen card bits (12,672 games).
 * 3. Every claim on the cut-the-knot page is checked: seven bits are enough,
 *    54 = 110110, the two example groups, and that each answer fixes one bit.
 * 4. The applet's quirks are kept: inconsistent answers can announce a number
 *    outside 1..99 (0 through 127), and 0 is never printed on a card.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("cards/cards-core.js", "CardsCore");

/* ---- a second transcription, straight from CardsCanvas bytecode ---- */

// DrawCard: for i = 1; i < m_Max; i++, print i when the i-th bit equals m_Bit.
function appletDrawCard(cardNo, bit, max) {
  const printed = [];
  for (let i = 1; i < max; i++) {
    if ((i & (1 << cardNo)) > 0 && bit === 1) {
      printed.push(i);
    } else if ((i & (1 << cardNo)) !== 0) {
      // bytecode: ifne -> skip this number
    } else if (bit !== 0) {
      // bytecode: ifne -> skip this number
    } else {
      // bytecode: (i & mask) == 0 and bit == 0 -> print
      if ((i & (1 << cardNo)) === 0 && bit === 0) printed.push(i);
    }
  }
  return printed;
}

// Yes(): result += (m_Bit == 1) ? (1 << m_CardNo) : 0
function appletYes(result, bit, cardNo) {
  if (bit === 1) return result + (1 << cardNo);
  return result + 0;
}

// No(): result += (m_Bit == 0) ? (1 << m_CardNo) : 0
function appletNo(result, bit, cardNo) {
  if (bit === 0) return result + (1 << cardNo);
  return result + 0;
}

/* ---------------------------------------- 1. the rules against the bytecode */

equal("constants: cards count numbers below 100", C.MAX, 100);
equal("constants: seven cards", C.BITS, 7);
equal("constants: ten numbers per row", C.COLS, 10);

for (let k = 0; k < 7; k++) {
  for (const bit of [0, 1]) {
    for (const max of [100, 10, 64]) {
      const s = { cardNo: k, bit, done: false };
      equal(`DrawCard k=${k} bit=${bit} max=${max}`,
        C.cardNumbers(s, { max }), appletDrawCard(k, bit, max));
    }
  }
}

for (let k = 0; k < 7; k++) {
  for (const bit of [0, 1]) {
    for (const result of [0, 1, 54, 127]) {
      equal(`Yes k=${k} bit=${bit} r=${result}`,
        C.contribution("Yes", bit, k), appletYes(result, bit, k) - result);
      equal(`No k=${k} bit=${bit} r=${result}`,
        C.contribution("No", bit, k), appletNo(result, bit, k) - result);
    }
  }
}

/* ------------------------- 2. exhaustive honest play over all bit sequences */

const PATTERNS = 1 << 7; // 128 randomly chosen card-bit sequences
let games = 0;
for (let secret = 1; secret < 100; secret++) {
  let allFound = true;
  for (let pattern = 0; pattern < PATTERNS; pattern++) {
    let s = C.start({ bit: pattern & 1 });
    for (let round = 0; round < 7; round++) {
      const a = C.correctAnswer(secret, s);
      const opts = round < 6 ? { bit: (pattern >> (round + 1)) & 1 } : {};
      const next = C.answer(s, a, opts);
      if (!next) { allFound = false; break; }
      s = next;
    }
    games++;
    if (!s.done || s.guess !== secret || C.result(s) !== "done") allFound = false;
  }
  check(`every bit sequence finds secret ${secret}`, allFound);
}
equal("exhaustive games played", games, 99 * 128);

/* ------------------------------------------ 3. every claim on the page */

equal("(1111111)2 = 127", (1 << 7) - 1, 127);
check("127 > 100", 127 > 100);
check("six bits only reach 63, so seven are needed for 99",
  (1 << 6) - 1 === 63 && 63 < 99 && (1 << 7) - 1 >= 99);
let sevenEnough = true;
for (let n = 1; n < 100; n++) if (C.bitAt(n, 7) !== 0 || n >= 128) sevenEnough = false;
check("every number 1..99 needs at most seven bits", sevenEnough);

let binary54 = "";
for (let k = 5; k >= 0; k--) binary54 += C.bitAt(54, k);
equal("54 in binary is 110110", binary54, "110110");
equal("54's rightmost digit is 0", C.bitAt(54, 0), 0);
equal("54's third digit from the right is 1", C.bitAt(54, 2), 1);
check("54 fits in six digits, though the applet still asks seven",
  54 < (1 << 6) && C.bitAt(54, 6) === 0 && C.BITS === 7);

equal("numbers with a 0 in the 3rd place start as the page says",
  C.cardNumbers({ cardNo: 2, bit: 0 }).slice(0, 9),
  [1, 2, 3, 8, 9, 10, 11, 16, 17]);
equal("numbers with a 1 in the 3rd place start as the page says",
  C.cardNumbers({ cardNo: 2, bit: 1 }).slice(0, 10),
  [4, 5, 6, 7, 12, 13, 14, 15, 20, 21]);

let cardsExact = true;
for (let k = 0; k < 7; k++) {
  for (const bit of [0, 1]) {
    const shown = C.cardNumbers({ cardNo: k, bit });
    const expected = [];
    for (let n = 1; n < 100; n++) if (C.bitAt(n, k) === bit) expected.push(n);
    if (JSON.stringify(shown) !== JSON.stringify(expected)) cardsExact = false;
  }
}
check("each card shows exactly the numbers with that binary digit", cardsExact);

let answersFixOneBit = true;
for (let k = 0; k < 7; k++) {
  for (const bit of [0, 1]) {
    const yes = C.contribution("Yes", bit, k);
    const no = C.contribution("No", bit, k);
    if (yes + no !== (1 << k)) answersFixOneBit = false;
    if (yes !== ((bit === 1) ? (1 << k) : 0)) answersFixOneBit = false;
    if (no !== ((bit === 0) ? (1 << k) : 0)) answersFixOneBit = false;
  }
}
check("each Yes/No answer fixes exactly one bit of the secret", answersFixOneBit);

let noZeroOrHundred = true;
for (let k = 0; k < 7; k++) {
  for (const bit of [0, 1]) {
    const shown = C.cardNumbers({ cardNo: k, bit });
    if (shown.indexOf(0) >= 0 || shown.indexOf(100) >= 0) noZeroOrHundred = false;
  }
}
check("0 and 100 are never printed: only positives below 100", noZeroOrHundred);

/* --------------------------------- 4. end states, edge cases and the quirks */

{
  const s = C.start({ bit: 1 });
  check("a new game is not over", C.result(s) === null);
  equal("a new game's moves", C.legalMoves(s), ["Yes", "No"]);
  equal("a new game's reveal", C.reveal(s), null);
  equal("a new game starts at card 0", s.cardNo, 0);
  equal("a new game starts with no bits collected", s.result, 0);
}

{
  const s = C.start({ bit: 0 });
  const next = C.answer(s, "Yes", { bit: 0 });
  equal("Yes on bit 0 sets no bit", next.result, 0);
  equal("the next card is card 1", next.cardNo, 1);
  check("still playing after one answer", C.result(next) === null);
  equal("No on bit 0 sets the bit", C.answer(s, "No", { bit: 0 }).result, 1);
  equal("Yes on bit 1 sets the bit", C.answer({ ...s, bit: 1 }, "Yes").result, 1);
  equal("No on bit 1 sets no bit", C.answer({ ...s, bit: 1 }, "No").result, 0);
}

{
  let s = C.start({ bit: 1 });
  for (let i = 0; i < 7; i++) s = C.answer(s, "Yes", { bit: 1 });
  check("the game ends after seven answers", s.done && C.result(s) === "done");
  equal("all Yes with all bits 1 announces 127 (applet quirk)", C.reveal(s), "Your number is 127");
  equal("no moves after the end", C.legalMoves(s), []);
  check("answers are refused after the end", C.answer(s, "Yes") === null);
}

{
  let s = C.start({ bit: 1 });
  for (let i = 0; i < 7; i++) s = C.answer(s, "No", { bit: 1 });
  equal("all No with all bits 1 announces 0 (applet quirk)", C.reveal(s), "Your number is 0");
}

{
  const s = C.start({ bit: 0 });
  check("an unknown answer is refused", C.answer(s, "maybe") === null);
  check("a missing answer is refused", C.answer(s) === null);
}

{
  const s = C.start({ bit: 0 });
  const roundTrip = JSON.parse(JSON.stringify(s));
  equal("the position is plain JSON", roundTrip, s);
  const restarted = C.start({ bit: 0 });
  check("reset returns to card 0", restarted.cardNo === 0 && !restarted.done && restarted.result === 0);
}

{
  const bits = [];
  for (let seed = 1; seed <= 100; seed++) {
    bits.push(C.chooseBit(() => (seed * 0.6180339887) % 1));
  }
  check("chooseBit only ever deals 0 or 1", bits.every((b) => b === 0 || b === 1));
  check("chooseBit deals both values", bits.indexOf(0) >= 0 && bits.indexOf(1) >= 0);
}

done("cards");
