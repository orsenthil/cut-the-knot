"use strict";

/*
 * The Monty Hall problem, from Alexander Bogomolny's applet MontyHall.
 *
 * A car is behind one of three doors and goats behind the other two. You pick a
 * door. The host, who knows where the car is, then opens a door that is not
 * yours and has a goat; you may stay with your door or switch to the other
 * closed door. The applet plays one trial per click: your click is the first
 * pick, the doors open, and both outcomes are counted at once: if the door you
 * picked has the car, staying would have won and switching would have lost;
 * otherwise switching would have won and staying lost. So switching wins exactly
 * when the first pick was wrong, two times in three.
 *
 * The position is plain data:
 *   { car, picked, trials, switchedWon, switchedLost, stayedWon, stayedLost }
 * with picked null before the first click of a trial (the car is hidden) and
 * the door's number 0..2 after.
 */
const MontyCore = (() => {
  const DOORS = 3;

  const door = (random) => Math.floor(random() * DOORS);

  const emptyTallies = { trials: 0, switchedWon: 0, switchedLost: 0, stayedWon: 0, stayedLost: 0 };

  /** A new trial and zero counts (the applet's Restart). */
  function start(options) {
    const random = (options && options.random) || Math.random;
    return { car: door(random), picked: null, ...emptyTallies };
  }

  /** A fresh car for the next trial, keeping the counts (the applet's Reset). */
  const nextTrial = (state, random = Math.random) => ({ ...state, car: door(random), picked: null });

  /**
   * Click a door. If the last trial has been shown, a new one starts first. The pick
   * counts one trial and both outcomes. Returns the new position, or null for no such door.
   */
  function pick(state, d, random = Math.random) {
    if (!Number.isInteger(d) || d < 0 || d >= DOORS) return null;
    const s = state.picked === null ? state : nextTrial(state, random);
    const won = d === s.car;
    return {
      ...s, picked: d, trials: s.trials + 1,
      stayedWon: s.stayedWon + (won ? 1 : 0), switchedLost: s.switchedLost + (won ? 1 : 0),
      switchedWon: s.switchedWon + (won ? 0 : 1), stayedLost: s.stayedLost + (won ? 0 : 1),
    };
  }

  /** The door the host opens after a pick: a goat door that is not the pick (the lower one if there are two). */
  function hostOpens(car, picked) {
    for (let d = 0; d < DOORS; d++) if (d !== picked && d !== car) return d;
    return -1;
  }

  /** The door you would switch to. */
  function switchTo(car, picked) {
    const open = hostOpens(car, picked);
    for (let d = 0; d < DOORS; d++) if (d !== picked && d !== open) return d;
    return -1;
  }

  /** What happened, for the trial just shown: { stay: "won"|"lost", switch: "won"|"lost" }. */
  const outcome = (state) => (state.picked === null ? null : { stay: state.picked === state.car ? "won" : "lost", switch: state.picked === state.car ? "lost" : "won" });

  /** The percentage of the counted trials in which each strategy won (null with no trials). */
  const rates = (state) => (state.trials === 0 ? null : { stay: state.stayedWon / state.trials, switch: state.switchedWon / state.trials });

  return { DOORS, start, nextTrial, pick, hostOpens, switchTo, outcome, rates };
})();
