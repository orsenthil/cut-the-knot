"use strict";

/*
 * Water, Alexander Bogomolny's three-jugs applet (no DOM, no storage).
 *
 * Three glasses A, B, C start empty, empty and full: the applet's defaults
 * are capacities 3, 5, 8 and amounts 0, 0, 8. Pick up one glass and pour it
 * into another: the amount moved is the smaller of what is in the source and
 * the space left in the destination, so the source ends empty or the
 * destination ends full. Clicking a glass again puts it down. The applet also
 * lets you edit the three capacities (0..20) and the three amounts (0..the
 * capacity) and undo with Back or Reset; editing clears the undo stack.
 *
 * The whole game is the triple (x, y, z), whose sum is the big jug's capacity
 * while you play. This file defines one global, WaterCore, so a browser page
 * loads it with a plain <script> and porting/check-water.mjs evaluates it in
 * Node. Functions take a position and return a new one; they never change
 * the position they are given.
 */
const WaterCore = (() => {
  const CAP_MIN = 0;
  const CAP_MAX = 20; // CTKNumberCanvas.SetRange(0, 20) in the applet
  const DEFAULT_CAPS = [3, 5, 8]; // GlassPanel: g1=3, g2=5, g3=8
  const NAMES = ["A", "B", "C"];

  function gcd(a, b) {
    while (b) [a, b] = [b, a % b];
    return a;
  }

  function intIn(value, lo, hi, fallback) {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
  }

  function normalizeCaps(caps) {
    const given = Array.isArray(caps) ? caps : [];
    return DEFAULT_CAPS.map((d, i) => intIn(given[i], CAP_MIN, CAP_MAX, d));
  }

  function normalizeValues(values, caps) {
    const given = Array.isArray(values) ? values : [];
    return caps.map((cap, i) => intIn(given[i], 0, cap, i === 2 ? cap : 0));
  }

  /** A new position. The default target, 4, is the question on the page. */
  function start(options = {}) {
    const caps = normalizeCaps(options.capacities);
    const values = normalizeValues(options.values, caps);
    const fallback = caps[0] === 3 && caps[1] === 5 && caps[2] === 8 ? 4 : Math.floor(caps[2] / 2);
    const target = intIn(options.target === undefined ? fallback : options.target, 0, caps[2], fallback);
    return { caps, values, target, moves: 0, history: [] };
  }

  /** A plain, comparable key for a position: history and moves do not matter. */
  function key(state) {
    return state.values.join(",");
  }

  /*
   * One pour, transcribed from WaterGlass.mouseClicked and ProcessPourEvent:
   *   howMuch = min(destination.capacity - destination.value, source.value)
   *   if howMuch <= 0, nothing happens (the glass is put back down)
   *   destination.value += howMuch; source.value -= howMuch
   * The pre-pour amounts go on the undo stack, as the applet's PUSH_STATE
   * event does. Pouring into the same glass is a no-op but is still a move,
   * just as clicking a partly full glass twice is in the applet.
   */
  function pour(state, from, to) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 2 || to < 0 || to > 2) return null;
    const amount = Math.min(state.values[from], state.caps[to] - state.values[to]);
    if (amount <= 0) return null;
    const values = state.values.slice();
    values[to] += amount;
    values[from] -= amount;
    return {
      caps: state.caps.slice(),
      values,
      target: state.target,
      moves: state.moves + 1,
      history: [...state.history, state.values.slice()],
      amount,
    };
  }

  /** The six useful pours; a pour that would move nothing is not a move. */
  function legalMoves(state) {
    const moves = [];
    for (let from = 0; from < 3; from++) {
      for (let to = 0; to < 3; to++) {
        if (from === to) continue;
        const amount = Math.min(state.values[from], state.caps[to] - state.values[to]);
        if (amount > 0) moves.push({ from, to, amount });
      }
    }
    return moves;
  }

  /** Back: restore the amounts from before the last pour. */
  function undo(state) {
    if (!state.history.length) return null;
    const history = state.history.slice(0, -1);
    return {
      caps: state.caps.slice(),
      values: state.history[state.history.length - 1].slice(),
      target: state.target,
      moves: Math.max(0, state.moves - 1),
      history,
    };
  }

  /** Reset: restore the oldest amounts on the stack and clear it. */
  function reset(state) {
    if (!state.history.length) return null;
    return {
      caps: state.caps.slice(),
      values: state.history[0].slice(),
      target: state.target,
      moves: 0,
      history: [],
    };
  }

  /** Editing capacities or amounts clears the applet's undo stack. */
  function setCapacities(state, caps) {
    const next = normalizeCaps(caps);
    return start({
      capacities: next,
      values: state.values.map((v, i) => Math.min(v, next[i])),
      target: state.target,
    });
  }

  function setValues(state, values) {
    return start({ capacities: state.caps, values, target: state.target });
  }

  function setTarget(state, target) {
    return start({ capacities: state.caps, values: state.values, target });
  }

  /** "done" when some jug holds exactly the wanted amount. There is no loss. */
  function result(state) {
    return state.values.includes(state.target) ? "done" : null;
  }

  /** Can any jug ever hold the target? Every amount is a multiple of gcd(A,B,C). */
  function impossible(state) {
    const g = gcd(gcd(state.caps[0], state.caps[1]), state.caps[2]);
    return g === 0 ? state.target !== 0 : state.target % g !== 0;
  }

  /*
   * Breadth-first search for a shortest pour sequence from (0, 0, C).
   * Returns null when the target cannot be measured. The state graph has at
   * most (C+1)^2 positions (z is forced by x + y + z = C), so this is cheap
   * even for the applet's largest capacities (0..20).
   */
  function solve(caps, target) {
    const s0 = start({ capacities: caps, target });
    const seen = new Set([key(s0)]);
    let frontier = [s0];
    for (;;) {
      const found = frontier.find((s) => result(s) === "done");
      if (found) {
        const steps = [];
        let s = found;
        while (s.history.length) {
          const before = s.history[s.history.length - 1];
          const from = before.findIndex((v, i) => v > s.values[i]);
          const to = before.findIndex((v, i) => v < s.values[i]);
          steps.push({
            from,
            to,
            amount: s.values[to] - before[to],
            before: before.slice(),
            after: s.values.slice(),
          });
          s = undo(s);
        }
        steps.reverse();
        return { steps, length: steps.length };
      }
      const next = [];
      for (const s of frontier) {
        for (const m of legalMoves(s)) {
          const n = pour(s, m.from, m.to);
          const k = key(n);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(n);
        }
      }
      if (!next.length) return null;
      frontier = next;
    }
  }

  /** A sentence for the solution list: "Pour 3 from C into B." */
  function describe(step) {
    return `Pour ${step.amount} from ${NAMES[step.from]} into ${NAMES[step.to]}.`;
  }

  return {
    CAP_MIN, CAP_MAX, DEFAULT_CAPS, NAMES,
    gcd, start, key, pour, legalMoves, undo, reset,
    setCapacities, setValues, setTarget, result, impossible, solve, describe,
  };
})();
