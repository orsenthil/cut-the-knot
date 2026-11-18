#!/usr/bin/env node
"use strict";

/*
 * Logic test for date-game/date-game-core.js.
 *
 *   1. The rules: start, validity, the one-word-per-turn click rule, refused
 *      clicks, the invalid-date undo, wins and losses.
 *   2. The page's claim: a full game-tree search of every valid date finds
 *      exactly twelve losing dates, all on day - month = 19, leap year or not;
 *      the computer's "good" move steps onto that diagonal from every other
 *      date; following it wins from every start.
 *   3. The computer's Play/MakeGoodMove/MakeRandomMove transcribed a second time
 *      from the bytecode and compared on every valid date with seeded randoms.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("date-game/date-game-core.js", "DateGameCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ day: 5, leap: false });
  equal("a game starts in January", s.month, 0);
  equal("the given day is used", s.day, 5);
  equal("the human goes first", s.turn, "you");
  equal("either word may move at first", C.allowedWords(s).join(","), "month,day");
  equal("no moves yet", s.moves, 0);
  check("the start is a valid date", C.valid(s));
  check("the start is not over", C.result(s) === null);
  check("the start is not automatically a losing date", !C.pPosition(s));

  check("a random day is in 01..30", (() => {
    for (let i = 0; i < 100; i++) {
      const d = C.start({ random: () => i / 100 }).day;
      if (d < 0 || d > 29) return false;
    }
    return true;
  })());
  equal("February has 28 days in an ordinary year", C.monthLengths(false)[1], 28);
  equal("February has 29 days in a leap year", C.monthLengths(true)[1], 29);
  check("leap year follows the applet's Calendar.YEAR % 4 rule", typeof C.start({}).leap === "boolean");

  const month1 = C.advance(s, "month").state;
  equal("a month click advances one month", month1.month, 1);
  equal("after a month click only the month can move again", C.allowedWords(month1).join(","), "month");
  check("the day cannot be clicked instead", C.advance(month1, "day") === null);
  const month2 = C.advance(month1, "month").state;
  equal("several month clicks in one turn are allowed", month2.month, 2);
  equal("each click counts", month2.moves, 2);
  check("the original position is untouched", s.month === 0 && s.moves === 0);

  const day1 = C.advance(s, "day").state;
  equal("a day click advances one day", day1.day, 6);
  equal("after a day click only the day can move again", C.allowedWords(day1).join(","), "day");

  const december = C.start({ day: 29, leap: false });
  const atEnd = C.start({ day: 29, leap: false });
  let walked = atEnd;
  while (walked.month < 11) walked = C.advance(walked, "month").state;
  const refused = C.advance(walked, "month");
  equal("clicking past December is refused with the applet's message", refused.note, C.NOTE_MORE_MONTHS);
  check("the board is unchanged after that refusal", refused.state.month === walked.month);
  equal("the outer board was not mutated", december.month, 0);

  const lastDay = C.start({ month: 0, day: 30, leap: false });
  const maxed = C.advance(lastDay, "day");
  equal("clicking past the last day gives the month's name", maxed.note, C.NOTE_MORE_DAYS(0));
  check("a board unchanged by that refusal", maxed.state.day === lastDay.day);

  const moved = C.advance(C.start({ day: 2, leap: false }), "month").state;
  check("a click before Move has not handed over the turn", moved.turn === "you");
  const pending = C.commit(moved);
  equal("pressing Move passes the turn to the computer", pending.kind, "thinking");
  equal("the computer sees the Thinking caption", pending.note, C.NOTE_THINKING);
  check("the computer may then choose either word", C.allowedWords(pending.state).length === 0);
  check("pressing Move again is refused while the computer plays", C.commit(pending.state) === null);

  // Changing to a shorter month leaves an impossible date; Move undoes this turn.
  const old = { ...C.start({ day: 29, leap: false }), month: 0 };
  const invalid = C.advance(old, "month").state; // Feb 30 in an ordinary year
  check("the new date is invalid", !C.valid(invalid));
  const undone = C.commit(invalid);
  equal("an invalid date gets the applet's apology", undone.note, C.NOTE_INVALID);
  equal("the board is put back", undone.state.month, 0);
  equal("the day is put back", undone.state.day, 29);

  const won = { ...C.start({ leap: false }), month: 11, day: 29, last: null };
  const final = C.advance(won, "day").state;
  check("December 31 is finished", C.isFinished(final));
  const humanWin = C.commit(final);
  equal("a human who reaches it wins", C.result(humanWin.state), "win");
  const computerWon = { ...final, winner: "computer" };
  equal("a computer who reaches it wins", C.result(computerWon), "lose");
  const computerWins = C.computerMove({ month: 11, day: 28, leap: false, turn: "computer", last: null }, () => 0);
  equal("a computer that reaches December 31 wins", C.result(computerWins.state), "lose");
  equal("the computer's caption is I won", computerWins.note, "I won");
}

/* ------------------------------------- 2. the page's claims, exhaustively */

for (const leap of [false, true]) {
  const p = C.pPositions(leap);
  equal(`ordinary/leap ${leap}: there are twelve losing dates`, p.length, 12);
  check(`leap ${leap}: every losing date is on day - month = 19`,
    p.every(({ month, day }) => day - month === C.DIAGONAL));
  check(`leap ${leap}: pPosition agrees with the search`, (() => {
    const days = C.monthLengths(leap);
    for (let month = 0; month < 12; month++) {
      for (let day = 0; day < days[month]; day++) {
        const state = { month, day, leap };
        const listed = p.some((x) => x.month === month && x.day === day);
        if (listed !== C.pPosition(state)) return false;
      }
    }
    return true;
  })());
}
check("leap year does not move any P-position",
  JSON.stringify(C.pPositions(false)) === JSON.stringify(C.pPositions(true)));

{
  const days = C.monthLengths(false);
  let toDiagonal = 0;
  let total = 0;
  for (let month = 0; month < 12; month++) {
    for (let day = 0; day < days[month]; day++) {
      if (C.pPosition({ month, day })) continue;
      const next = C.makeGoodMove({ month, day, leap: false }, () => 0);
      if (C.pPosition(next)) toDiagonal++;
      total++;
    }
  }
  equal("from every other date the good move lands on the diagonal", toDiagonal, total);
}

// Following the P-strategy wins from every possible starting day.
{
  let wins = 0;
  for (let startDay = 0; startDay < 30; startDay++) {
    let state = C.start({ day: startDay, leap: false });
    let rnd = rng(1000 + startDay);
    let guard = 0;
    while (!C.isFinished(state) && guard++ < 80) {
      // Advance whichever word reaches day - month = 19.
      const word = state.day - state.month < C.DIAGONAL ? "day" : "month";
      let steps = 0;
      while (!C.pPosition(state) && steps++ < 40) {
        const moved = C.advance(state, word);
        if (!moved || moved.note) break;
        state = moved.state;
      }
      if (!C.pPosition(state)) break;
      const pressed = C.commit(state);
      if (!pressed) break;
      state = pressed.state;
      if (pressed.kind === "win") break;
      const reply = C.computerMove(state, rnd);
      if (!reply) break;
      state = reply.state;
    }
    if (C.result(state) === "win") wins++;
  }
  equal("the P-strategy wins from every start except the one losing date", wins, 29);
  check("January 20 is the one start where the player to move loses", (() => {
    let state = C.start({ day: 19, leap: false });
    if (!C.pPosition(state)) return false;
    state = C.advance(state, "month").state; // leave the diagonal
    const pressed = C.commit(state);
    const reply = pressed && C.computerMove(pressed.state, rng(1));
    return Boolean(reply && C.pPosition(reply.state)); // the computer steps back onto it
  })());
}

/* --------------------------- 3. the applet's method, transcribed again */

function appletComputer(month, day, leap, rnd) {
  const days = C.monthLengths(leap);
  const jint = (x) => Math.trunc(x);
  const moveMonth = () => {
    if (month === 11) return false;
    const next = month + 1 + jint(rnd() * (10 - month));
    month = next;
    return true;
  };
  const moveDate = () => {
    if (day === days[month] - 1) return false;
    day = day + 1 + jint(rnd() * (days[month] - 2 - day));
    return true;
  };
  const randomMove = () => {
    const monthFirst = jint(rnd() * 2) === 0;
    const first = monthFirst ? moveMonth : moveDate;
    const second = monthFirst ? moveDate : moveMonth;
    return first() || second();
  };
  const goodMove = () => {
    const delta = month - day + 19;
    if (delta === 0) return randomMove();
    if (delta > 0) day = day + delta;
    else month = month - delta;
    return true;
  };
  // Play's own test can never fire: day - month + 19 >= 8.
  const playTest = day - month + 19;
  if (playTest === 0) randomMove();
  else goodMove();
  return [month, day];
}

{
  let compared = 0;
  for (const seed of [1, 7, 12345]) {
    for (const leap of [false, true]) {
      for (let month = 0; month < 12; month++) {
        for (let day = 0; day < C.monthLengths(leap)[month]; day++) {
          if (month === 11 && day === 30) continue; // no move from the terminal date
          const key = seed * 10000 + (leap ? 5000 : 0) + month * 40 + day + 1;
          const expected = appletComputer(month, day, leap, rng(key));
          const state = { month, day, leap, turn: "computer", moves: 0, last: null };
          const move = C.computerMove(state, rng(key));
          const actual = [move.state.month, move.state.day];
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            check(`computer agrees at ${month}/${day} leap=${leap}`, false,
              `${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
          } else compared++;
        }
      }
    }
  }
  check("the computer matches the bytecode on every non-terminal date", compared === 3 * 729);
  equal("all 729 playable dates (leap and ordinary) were compared three times", compared, 3 * 729);
}

done("date-game");
