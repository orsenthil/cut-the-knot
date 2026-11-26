"use strict";

/*
 * Archimedes' Law of the Lever — Alexander Bogomolny's ArchimedesLever applet.
 *
 * The applet draws two weights NP and NQ (3 and 4 to start, each 1..25) on a
 * beam. Each is replaced by unit weights spread evenly along the row: NP/g
 * copies of one unit centred on the first weight and NQ/g on the second,
 * where g is the greatest common divisor when "Use GCD/LCM" is ticked and 1
 * otherwise. The red fulcrum sits at the middle unit of the row. That point
 * is also the common centre of gravity: NP times its distance to the left
 * weight equals NQ times its distance to the right one. Nothing is won or
 * lost here; this is an illustration.
 *
 * This file is the picture's logic and nothing else: no document, no window,
 * no storage. It defines one global, ArchimedesLeverCore, so the page loads it
 * with a plain <script> and porting/check-archimedes-lever.mjs loads it in
 * Node. Positions are plain data (numbers, strings, arrays, plain objects).
 */
const ArchimedesLeverCore = (() => {
  const MIN_WEIGHT = 1;
  const MAX_WEIGHT = 25;
  const INITIAL_NP = 3;
  const INITIAL_NQ = 4;
  const WIDTH = 400;          // the applet's suggested WIDTH, in board units
  const HEIGHT = 260;
  const R_UNIT = 10;          // DoubCircle radius of one unit weight
  const X_MARGIN = 20;
  const EPS = 1e-6;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const near = (a, b, scale = Math.max(1, Math.abs(a), Math.abs(b))) =>
    Math.abs(a - b) <= EPS * scale;

  /** GCD.gcd, Euclid's algorithm, as used by ArchimedesLeverCanvas.Reset. */
  function gcd(a, b) {
    let x = Math.abs(Math.trunc(a)), y = Math.abs(Math.trunc(b));
    while (y) { const t = x % y; x = y; y = t; }
    return x || 1;
  }

  function clampInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return clamp(Math.round(n), MIN_WEIGHT, MAX_WEIGHT);
  }

  /**
   * The applet's Reset layout, in board units. L11 is the integer division
   * (width - 2 * margin) / (total - 1); it is the gap between two unit weights.
   * The two original weights are centred on their own blocks of units, and
   * the fulcrum sits halfway between the end units of the whole row.
   */
  function layout(NP, NQ, useGCD, width) {
    const w = Number.isFinite(width) && width > 120 ? width : WIDTH;
    const common = gcd(NP, NQ);
    const unit = useGCD && common > 1 ? common : 1;
    const np = NP / unit, nq = NQ / unit;
    const total = np + nq;
    const rUnit = Math.sqrt(unit) * R_UNIT;
    const margin = Math.trunc(rUnit > X_MARGIN ? rUnit + 3 : X_MARGIN);
    const span = Math.max(total - 1, 1);
    const spacing = Math.max(1, Math.floor((w - 2 * margin) / span));
    const xP = margin + (spacing * (np - 1)) / 2;
    const xQ = margin + spacing * (total - (nq + 1) / 2);
    const balance = margin + (spacing / 2) * (total - 1);
    return {
      unit: unit, np: np, nq: nq, total: total, spacing: spacing,
      margin: margin, xP: xP, xQ: xQ, balance: balance, xF: balance,
      rP: Math.sqrt(NP) * R_UNIT, rQ: Math.sqrt(NQ) * R_UNIT, rUnit: rUnit,
    };
  }

  /** A fresh diagram. The three x positions are draggable. */
  function start(options) {
    const o = options || {};
    const NP = clampInt(o.NP === undefined ? INITIAL_NP : o.NP, INITIAL_NP);
    const NQ = clampInt(o.NQ === undefined ? INITIAL_NQ : o.NQ, INITIAL_NQ);
    const useGCD = !!o.useGCD;
    const width = Number.isFinite(o.width) ? o.width : WIDTH;
    const L = layout(NP, NQ, useGCD, width);
    return {
      NP: NP, NQ: NQ, useGCD: useGCD, width: width,
      height: Number.isFinite(o.height) ? o.height : HEIGHT,
      spacing: L.spacing, xP: L.xP, xQ: L.xQ, xF: L.xF,
    };
  }

  /** Everything the page draws, recomputed from the current positions. */
  function measure(state) {
    const common = gcd(state.NP, state.NQ);
    const unit = state.useGCD && common > 1 ? common : 1;
    const np = state.NP / unit, nq = state.NQ / unit;
    const total = np + nq;
    const rUnit = Math.sqrt(unit) * R_UNIT;
    const margin = Math.trunc(rUnit > X_MARGIN ? rUnit + 3 : X_MARGIN);
    const s = state.spacing;
    const units = [];
    for (let i = 0; i < total; i++) {
      units.push(state.xP + (i - (np - 1) / 2) * s);
    }
    /* Halfway between the first and last unit is the centre of the row. */
    const balance = state.xP + (nq * s) / 2;
    const pivot = state.xF;
    const moment = state.NP * (state.xP - pivot) + state.NQ * (state.xQ - pivot);
    const unitMoment = unit * units.reduce((sum, x) => sum + (x - pivot), 0);
    let leftArea = 0, rightArea = 0;
    for (const x of units) {
      if (x < pivot) leftArea += unit * (pivot - x);
      if (x > pivot) rightArea += unit * (x - pivot);
    }
    return {
      unit: unit, np: np, nq: nq, total: total, gcdAvailable: common > 1,
      spacing: s, margin: margin, units: units, balance: balance, pivot: pivot,
      rP: Math.sqrt(state.NP) * R_UNIT, rQ: Math.sqrt(state.NQ) * R_UNIT,
      rUnit: rUnit,
      xP: state.xP, xQ: state.xQ, xF: state.xF,
      leftDistance: balance - state.xP, rightDistance: state.xQ - balance,
      leftTurn: state.NP * (balance - state.xP),
      rightTurn: state.NQ * (state.xQ - balance),
      moment: moment, unitMoment: unitMoment, leftArea: leftArea, rightArea: rightArea,
      tilt: near(moment, 0, 1) ? 0 : (moment > 0 ? 1 : -1),
      balanced: near(moment, 0, 1),
    };
  }

  /** The CTKNumberLim controls: whole weights in 1..25, then Reset. */
  function setWeights(state, NP, NQ, useGCD) {
    const nextNP = clampInt(NP === undefined ? state.NP : NP, state.NP);
    const nextNQ = clampInt(NQ === undefined ? state.NQ : NQ, state.NQ);
    const nextUseGCD = useGCD === undefined ? state.useGCD : !!useGCD;
    const L = layout(nextNP, nextNQ, nextUseGCD, state.width);
    return Object.assign({}, state, {
      NP: nextNP, NQ: nextNQ, useGCD: nextUseGCD,
      spacing: L.spacing, xP: L.xP, xQ: L.xQ, xF: L.xF,
    });
  }

  /** Same rule as the applet's checkbox: only tickable when a common factor exists. */
  function toggleGCD(state) {
    if (gcd(state.NP, state.NQ) <= 1) return state;
    return setWeights(state, state.NP, state.NQ, !state.useGCD);
  }

  function reset(state) {
    return start({ width: state.width, height: state.height });
  }

  /** Move one of the three draggable dots. Only its horizontal position counts. */
  function moveHandle(state, name, p) {
    if (!p || !Number.isFinite(p.x)) return state;
    const m = measure(state);
    const margin = m.margin;
    const right = state.width - margin;
    const x = clamp(p.x, margin, right);
    if (name === "P") {
      const minGap = Math.max(4, 2 * state.spacing);
      const xp = clamp(x, margin + minGap, state.xQ - minGap);
      return Object.assign({}, state, {
        xP: xp, spacing: (2 * (state.xQ - xp)) / m.total,
      });
    }
    if (name === "Q") {
      const minGap = Math.max(4, 2 * state.spacing);
      const xq = clamp(x, state.xP + minGap, right);
      return Object.assign({}, state, {
        xQ: xq, spacing: (2 * (xq - state.xP)) / m.total,
      });
    }
    if (name === "F") return Object.assign({}, state, { xF: x });
    return state;
  }

  /** The button that puts the red marker back at the common centre of gravity. */
  function snapFulcrum(state) {
    return Object.assign({}, state, { xF: measure(state).balance });
  }

  const fmt = (v) => (Math.abs(v) < 0.05 ? "0" : v.toFixed(1));

  /** The line under the picture. An illustration has no win or loss to report. */
  function label(state) {
    const m = measure(state);
    if (m.balanced) {
      return `Balanced: ${state.NP} on the left and ${state.NQ} on the right, ` +
        `${fmt(m.leftTurn)} and ${fmt(m.rightTurn)}. The fulcrum cuts the gap ` +
        `${state.NQ}:${state.NP}.`;
    }
    const down = m.tilt > 0 ? "Right side down" : "Left side down";
    return `${down}: turning effect ${fmt(m.leftArea)} left against ` +
      `${fmt(m.rightArea)} right. Move the red fulcrum to balance them.`;
  }

  return {
    MIN_WEIGHT: MIN_WEIGHT, MAX_WEIGHT: MAX_WEIGHT,
    INITIAL_NP: INITIAL_NP, INITIAL_NQ: INITIAL_NQ,
    WIDTH: WIDTH, HEIGHT: HEIGHT, R_UNIT: R_UNIT, X_MARGIN: X_MARGIN,
    clamp: clamp, gcd: gcd, layout: layout, start: start, measure: measure,
    setWeights: setWeights, toggleGCD: toggleGCD, reset: reset,
    moveHandle: moveHandle, snapFulcrum: snapFulcrum, label: label,
  };
})();
