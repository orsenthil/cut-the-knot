"use strict";

/*
 * Plain Monty Hall, from Alexander Bogomolny's applet PlainMontyHall.
 *
 * A car is behind one of three doors and goats are behind the other two. You
 * click a door. The host, who knows where the car is, opens another door with
 * a goat: if your door has the car he has two goats to choose from and picks
 * one at random, otherwise he has only one. You click again, on your first
 * door (stay) or on the other closed door (switch), and all three doors open.
 *
 * The applet keeps four counts and changes two of them on every round, so it
 * hardly matters what you do: if your first door had the car, staying won and
 * switching lost; otherwise switching won and staying lost. Whatever you click
 * second only decides which of the two outcomes was yours. So "switched and
 * lost" always equals "stayed and won", and "switched and won" equals "stayed
 * and lost". A click after the reveal closes the doors, hides a new car, and
 * (as in the applet) a click that lands on a door is also the next first pick.
 *
 * The position is plain data:
 *   { prize, first, opened, final, trials,
 *     switchedWon, switchedLost, stayedWon, stayedLost }
 * first, opened and final are null until that step has happened.
 */
const PlainMontyHallCore = (() => {
  const DOORS = 3;
  const zero = { trials: 0, switchedWon: 0, switchedLost: 0, stayedWon: 0, stayedLost: 0 };

  const hide = (random) => Math.floor(random() * DOORS);

  /** A new round and zero counts (the applet's Restart). */
  function start(options) {
    const o = options || {};
    const random = o.random || Math.random;
    const prize = Number.isInteger(o.prize) && o.prize >= 0 && o.prize < DOORS ? o.prize : hide(random);
    return { prize, first: null, opened: null, final: null, ...zero };
  }

  /** The doors closed and a new car hidden, keeping the counts (the applet's Reset). */
  function nextRound(s, random = Math.random) {
    return { ...s, prize: hide(random), first: null, opened: null, final: null };
  }

  /**
   * The door the host opens after the first pick. With the car behind the
   * pick, the applet takes (prize + 1 + floor(2 * random)) mod 3, one of the
   * two goats at random; otherwise the one door that is neither.
   */
  function hostOpens(prize, first, random = Math.random) {
    if (first === prize) return Math.trunc(prize + 1 + 2 * random()) % DOORS;
    return DOORS - prize - first;
  }

  /** "pick" (first click), "choose" (second click) or "reveal" (all doors open). */
  function stage(s) {
    if (s.first === null) return "pick";
    if (s.final === null) return "choose";
    return "reveal";
  }

  /** The doors that may be clicked now. The host's open door cannot be chosen. */
  function legalMoves(s) {
    if (stage(s) === "choose") return [0, 1, 2].filter((d) => d !== s.opened);
    return [0, 1, 2];
  }

  /**
   * Click a door. Returns the new position, or null if the click is not
   * allowed. After the reveal the click starts a new round and is its first pick.
   */
  function click(s, door, random = Math.random) {
    if (!Number.isInteger(door) || door < 0 || door >= DOORS) return null;
    if (stage(s) === "reveal") s = nextRound(s, random);
    if (stage(s) === "pick") return { ...s, first: door, opened: hostOpens(s.prize, door, random) };
    if (door === s.opened) return null;
    const carFirst = s.first === s.prize;
    return {
      ...s, final: door, trials: s.trials + 1,
      stayedWon: s.stayedWon + (carFirst ? 1 : 0), switchedLost: s.switchedLost + (carFirst ? 1 : 0),
      switchedWon: s.switchedWon + (carFirst ? 0 : 1), stayedLost: s.stayedLost + (carFirst ? 0 : 1),
    };
  }

  /** After the reveal: { switched, won }; before it, null. */
  function outcome(s) {
    if (s.final === null) return null;
    return { switched: s.final !== s.first, won: s.final === s.prize };
  }

  /** "win" or "lose" for the round just shown, or null while it goes on. */
  function result(s) {
    const o = outcome(s);
    return o ? (o.won ? "win" : "lose") : null;
  }

  /** The share of rounds each strategy won, or null with no rounds. */
  const rates = (s) => (s.trials === 0 ? null : { stay: s.stayedWon / s.trials, switch: s.switchedWon / s.trials });

  return { DOORS, start, nextRound, hostOpens, stage, legalMoves, click, outcome, result, rates };
})();
