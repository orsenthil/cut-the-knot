"use strict";

/*
 * The Date Game, from Alexander Bogomolny's DateGame applet (Date Game).
 *
 * The board is a calendar date. A turn advances either the month or the day by
 * any number of steps, but the date must still be valid; the player who reaches
 * December 31 wins. The applet insists that once you have started clicking one
 * of the two words you keep clicking that same word until you press Move.
 *
 * The key idea is the P-position. Number months and days from 0, so December 31
 * is (11, 30). Every losing position has day - month = 19, and from any other
 * valid date there is one move to that diagonal. The computer's MakeGoodMove
 * does exactly that; on the diagonal it moves at random. The logic test checks
 * those claims against a full game-tree search of every valid date.
 *
 * No document, no window, no storage: one global, DateGameCore. The position is
 * plain data so it can be saved and handed to the tutor.
 */
const DateGameCore = (() => {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const LONG_MONTHS = [
    "January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December",
  ];
  const DATES = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
  const BASE_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  /** The applet's invariant: losing dates have day - month = 30 - 11 = 19. */
  const DIAGONAL = 19;

  const NOTE_MORE_MONTHS = "Are there any more months?";
  const NOTE_MORE_DAYS = (month) => `How many days are in ${LONG_MONTHS[month]}?`;
  const NOTE_INVALID = "The date was not valid! Sorry ...";
  const NOTE_THINKING = "Thinking ...";
  const NOTE_PRESS_RESET = "Press Reset!";

  function monthLengths(leap) {
    const days = BASE_DAYS.slice();
    if (leap) days[1] += 1;
    return days;
  }

  /** The position a new game starts from: January, with a random day 01..30. */
  function start(options) {
    const opts = options || {};
    const leap = opts.leap !== undefined
      ? Boolean(opts.leap)
      : new Date().getFullYear() % 4 === 0; // the applet uses Calendar.YEAR % 4
    const day = Number.isInteger(opts.day)
      ? opts.day
      : Math.floor((opts.random || Math.random)() * 30);
    return {
      month: 0,
      day,
      leap,
      turn: "you",
      winner: null,
      moves: 0,
      last: null, // null at the start and after the computer: either word may move
      oldDate: { month: 0, day },
    };
  }

  function valid(state) {
    return state.day < monthLengths(state.leap)[state.month];
  }

  function isFinished(state) {
    return state.month === 11 && state.day === 30;
  }

  function result(state) {
    return state.winner === "you" ? "win" : state.winner === "computer" ? "lose" : null;
  }

  /** The words the player may still advance this turn (the applet's HIT rule). */
  function allowedWords(state) {
    if (state.turn !== "you" || isFinished(state)) return [];
    return state.last === null ? ["month", "day"] : [state.last];
  }

  /** One click on a word. Returns null when that word is not available. */
  function advance(state, word) {
    if (!allowedWords(state).includes(word)) return null;
    if (word === "month") {
      if (state.month >= 11) return { state, note: NOTE_MORE_MONTHS };
      return {
        state: { ...state, month: state.month + 1, last: "month", moves: state.moves + 1 },
        note: "",
      };
    }
    if (state.day >= monthLengths(state.leap)[state.month] - 1) {
      return { state, note: NOTE_MORE_DAYS(state.month) };
    }
    return {
      state: { ...state, day: state.day + 1, last: "day", moves: state.moves + 1 },
      note: "",
    };
  }

  /**
   * Pressing Move. An invalid date is undone to the date recorded before this
   * turn; a finished board wins for the player who just moved; otherwise the
   * computer is due to play.
   */
  function commit(state) {
    if (state.turn !== "you" || state.last === null || state.winner) return null;
    if (!valid(state)) {
      return {
        kind: "invalid",
        note: NOTE_INVALID,
        state: { ...state, month: state.oldDate.month, day: state.oldDate.day, last: null },
      };
    }
    if (isFinished(state)) {
      return { kind: "win", note: "You won", state: { ...state, winner: "you" } };
    }
    return {
      kind: "thinking",
      note: NOTE_THINKING,
      state: { ...state, turn: "computer", last: null },
    };
  }

  /** Losing positions of the full game, computed from the rules. */
  function pPositions(leap) {
    const days = monthLengths(leap);
    const losing = new Set();
    // Moves only increase a coordinate, so work backwards from December 31.
    for (let sum = 0; sum <= 11 + 30; sum++) {
      for (let month = 0; month < 12; month++) {
        for (let day = 0; day < days[month]; day++) {
          if (11 - month + 30 - day !== sum) continue;
          let isP = true;
          for (let m = month + 1; m < 12 && isP; m++) {
            if (days[m] > day && losing.has(`${m},${day}`)) isP = false;
          }
          for (let d = day + 1; d < days[month] && isP; d++) {
            if (losing.has(`${month},${d}`)) isP = false;
          }
          if (isP) losing.add(`${month},${day}`);
        }
      }
    }
    return [...losing].map((key) => {
      const [month, day] = key.split(",").map(Number);
      return { month, day };
    });
  }

  function pPosition(state) {
    return state.day - state.month === DIAGONAL;
  }

  /** The applet's MoveMonth: jump to a later month, never quite at random. */
  function moveMonth(state, random) {
    if (state.month >= 11) return null;
    const jump = Math.floor(random() * (10 - state.month));
    const month = state.month + 1 + jump;
    return { ...state, month, moves: state.moves + 1 };
  }

  /** The applet's MoveDate: jump to a later day of the current month. */
  function moveDate(state, random) {
    const days = monthLengths(state.leap)[state.month];
    if (state.day >= days - 1) return null;
    const jump = Math.floor(random() * (days - 2 - state.day));
    const day = state.day + 1 + jump;
    return { ...state, day, moves: state.moves + 1 };
  }

  /** MakeRandomMove, transcribed: try one word first, then the other. */
  function makeRandomMove(state, random) {
    const monthFirst = Math.floor(random() * 2) === 0;
    const first = monthFirst ? moveMonth : moveDate;
    const second = monthFirst ? moveDate : moveMonth;
    return first(state, random) || second(state, random);
  }

  /** MakeGoodMove: step onto the diagonal day - month = 19, or at random. */
  function makeGoodMove(state, random) {
    const delta = state.month - state.day + DIAGONAL;
    if (delta === 0) return makeRandomMove(state, random);
    if (delta > 0) return { ...state, day: state.day + delta, moves: state.moves + 1 };
    return { ...state, month: state.month - delta, moves: state.moves + 1 };
  }

  /**
   * The computer's Play and the panel's ticker action. Play's own test of
   * day - month + 19 == 0 can never fire; the real cold test is in MakeGoodMove.
   */
  function computerMove(state, random) {
    const rnd = random || Math.random;
    const deadTest = state.day - state.month + DIAGONAL;
    const next = deadTest === 0 ? makeRandomMove(state, rnd) : makeGoodMove(state, rnd);
    if (!next) return null;
    const played = {
      ...next,
      turn: "you",
      winner: isFinished(next) ? "computer" : null,
      last: null,
      oldDate: { month: next.month, day: next.day },
    };
    return {
      state: played,
      note: isFinished(played) ? "I won" : "",
      description: next.month !== state.month
        ? `The computer advanced the month to ${LONG_MONTHS[next.month]}.`
        : `The computer advanced the day to ${next.day + 1}.`,
    };
  }

  function label(state) {
    return `${LONG_MONTHS[state.month]} ${state.day + 1}`;
  }

  return {
    MONTHS, LONG_MONTHS, DATES, BASE_DAYS, DIAGONAL, monthLengths, start, valid,
    isFinished, result, allowedWords, advance, commit, pPositions, pPosition,
    moveMonth, moveDate, makeRandomMove, makeGoodMove, computerMove, label,
    NOTE_MORE_MONTHS, NOTE_MORE_DAYS, NOTE_INVALID, NOTE_THINKING, NOTE_PRESS_RESET,
  };
})();
