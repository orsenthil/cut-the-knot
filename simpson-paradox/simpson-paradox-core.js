"use strict";

/*
 * Simpson's paradox as vector slopes, from Bogomolny's SimpsonParadox applet.
 *
 * There are four points A1, A2, B1, B2, each joined to the origin. The slope
 * of a point is y/x. It can happen that B1 is steeper than A1 and B2 is
 * steeper than A2, yet the two B vectors together are shallower than the two
 * A vectors together: the combined slope is (y1+y2)/(x1+x2), a weighted
 * average of the two slopes, not their ordinary average.
 *
 * The starting coordinates are the applet's. Pure logic: one global, plain
 * JSON positions, no DOM and no storage.
 */
const SimpsonParadoxCore = (() => {
  const MIN_X = 1;
  const MAX_X = 300;
  const MIN_Y = 1;
  const MAX_Y = 200;
  const KEYS = ["a1", "a2", "b1", "b2"];
  const DEFAULTS = {
    a1: { x: 50, y: 10 },
    a2: { x: 60, y: 80 },
    b1: { x: 200, y: 70 },
    b2: { x: 50, y: 100 },
  };

  function clamp(n, lo, hi) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  }

  function start(options = {}) {
    const points = {};
    for (const key of KEYS) {
      const given = options[key] ?? DEFAULTS[key];
      points[key] = {
        x: clamp(given.x, MIN_X, MAX_X),
        y: clamp(given.y, MIN_Y, MAX_Y),
      };
    }
    return {
      points,
      showNames: options.showNames !== false,
      message: "Move the points and compare each pair of slopes with the combined slopes.",
    };
  }

  const slope = (p) => p.y / p.x;

  function slopes(state) {
    const { a1, a2, b1, b2 } = state.points;
    return {
      a1: slope(a1),
      a2: slope(a2),
      b1: slope(b1),
      b2: slope(b2),
      a: slope({ x: a1.x + a2.x, y: a1.y + a2.y }),
      b: slope({ x: b1.x + b2.x, y: b1.y + b2.y }),
    };
  }

  /** True when both B slopes exceed their A slopes but the total does not. */
  function paradox(state) {
    const s = slopes(state);
    return s.b1 > s.a1 && s.b2 > s.a2 && s.b < s.a;
  }

  function setPoint(state, key, x, y) {
    if (!KEYS.includes(key)) return state;
    const points = { ...state.points, [key]: {
      x: clamp(x, MIN_X, MAX_X),
      y: clamp(y, MIN_Y, MAX_Y),
    } };
    const next = { ...state, points };
    const s = slopes(next);
    return {
      ...next,
      message: `${key.toUpperCase()} is now (${points[key].x}, ${points[key].y}); ` +
        `its slope is ${s[key].toFixed(2)}. Combined: A ${s.a.toFixed(2)}, B ${s.b.toFixed(2)}.`,
    };
  }

  function toggleNames(state) {
    return { ...state, showNames: !state.showNames, message: state.message };
  }

  function reset(state) {
    return { ...start({ showNames: state.showNames }), message: "Back to the applet's four points." };
  }

  /** "done" once a point has been moved. */
  function result(state) {
    return state.message.startsWith("Move the") ? null : "done";
  }

  return {
    KEYS, DEFAULTS, MIN_X, MAX_X, MIN_Y, MAX_Y, start, slope, slopes,
    paradox, setPoint, toggleNames, reset, result,
  };
})();
