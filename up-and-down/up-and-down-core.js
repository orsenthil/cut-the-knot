"use strict";

/*
 * UpAndDown: a permutation of 1..10 hides all but six of its numbers. The
 * hidden cards are a monotone run — four numbers that climb (red) or four
 * that fall (blue). The training round uses 1..5 and hides a run of three.
 *
 * The applet (UpAndDownCanvas) builds a random permutation, then asks
 * ProcessVector for an increasing run first or a decreasing run first, chosen
 * by Math.random() < 0.5. Its FindStraight is a depth-first scan that keeps
 * the first run it finds of the wanted length. The same scan is the key idea
 * here; the maths behind why a run always exists is in the page's "Look for
 * the math" section. Erdős and Szekeres: (r-1)(s-1)+1 distinct numbers force
 * an increasing run of r or a decreasing run of s; for 10, r = s = 4.
 *
 * No DOM, no storage: this file defines one global, UpAndDownCore. Positions
 * are plain data so they can be saved and handed to the tutor.
 */
const UpAndDownCore = (() => {
  const FULL = 10, TRAINING = 5;
  const VIEWS = ["visible", "hidden", "all"];

  /** The applet's Permutation.CreateRandom: 1..n shuffled by a Fisher-Yates pass. */
  function permutation(n, random) {
    const v = [];
    for (let i = 0; i < n; i++) v.push(i + 1);
    const rnd = random || Math.random;
    for (let k = n; k > 1; k--) {
      const j = Math.min(k - 1, Math.floor(rnd() * k));
      const t = v[k - 1]; v[k - 1] = v[j]; v[j] = t;
    }
    return v;
  }

  /*
   * Literal transcription of the applet's FindStraight(i, vector, target, asc):
   * it grows `vector` along strictly monotone positions after i, and returns
   * as soon as vector has `target` entries. `vector` is mutated, as in Java.
   */
  function findStraight(values, i, vector, target, asc) {
    if (vector.length + values.length - i < target) return;
    const keep = vector.length;
    for (let j = i + 1; j < values.length; j++) {
      const ok = asc ? values[j] > values[i] : values[j] < values[i];
      if (ok) {
        vector.push(j);
        findStraight(values, j, vector, target, asc);
        if (vector.length >= target) return;
        while (vector.length > keep) vector.pop();
      }
    }
  }

  /*
   * Literal transcription of ProcessVector(vector, L, asc). L is floor(sqrt(n));
   * FindStraight is asked for L+1 cards, and success means the vector is
   * longer than L. On success the vector holds the hidden positions; on
   * failure it is emptied and null is returned.
   */
  function processVector(values, L, asc) {
    const vector = [];
    for (let i = 0; i < values.length; i++) {
      vector.push(i);
      findStraight(values, i, vector, L + 1, asc);
      if (vector.length > L) return vector;
      vector.length = 0;
    }
    return null;
  }

  /** Length of the run the applet hides for a board of n cards: floor(sqrt(n)) + 1. */
  const target = (n) => Math.floor(Math.sqrt(n)) + 1;

  /*
   * The choice in UpAndDownCanvas.Reset. Which direction is tried first is a
   * coin toss; the other direction is the fallback. The card colour is set by
   * whichever direction was tried (the last one on a fallback), so a red run
   * means "rising" and a blue run means "falling".
   */
  function deal(values, random) {
    const rnd = random || Math.random;
    const L = Math.floor(Math.sqrt(values.length));
    let upFirst = rnd() < 0.5;
    let hidden = processVector(values, L, upFirst);
    if (hidden === null) {
      upFirst = !upFirst;
      hidden = processVector(values, L, upFirst);
    }
    return { hidden: hidden || [], direction: upFirst ? "up" : "down" };
  }

  /** True when the positions form a strictly rising or falling run, in board order. */
  function monotone(values, indices, direction) {
    const up = direction !== "down";
    for (let k = 1; k < indices.length; k++) {
      const a = values[indices[k - 1]], b = values[indices[k]];
      if (up ? !(b > a) : !(b < a)) return false;
    }
    return true;
  }

  function start(options) {
    const o = options || {};
    const n = o.training ? TRAINING : FULL;
    const values = Array.isArray(o.values) && o.values.length === n &&
      o.values.every((v, i) => Number.isInteger(v) && v >= 1 && v <= n) &&
      new Set(o.values).size === n ? o.values.slice() : permutation(n, o.random);
    const { hidden, direction } = deal(values, o.random);
    return {
      n, values, hidden, direction,
      view: VIEWS.includes(o.view) ? o.view : "visible",
      revealed: [],
    };
  }

  /** Change which part of the permutation is drawn; the cards do not move. */
  function setView(state, view) {
    if (!VIEWS.includes(view) || view === state.view) return null;
    return { ...state, view };
  }

  /** The Reset button: back to the visible part, new cards (training stays as it is). */
  function reset(state, options) {
    const o = options || {};
    return start({ training: o.training !== undefined ? o.training : state.n === TRAINING, random: o.random });
  }

  /*
   * A small modern affordance the AWT applet did not have: press a blank card
   * to reveal its number. Only a hidden, not-yet-revealed card can be opened.
   */
  function reveal(state, index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.n) return null;
    if (!state.hidden.includes(index) || state.revealed.includes(index)) return null;
    return { ...state, revealed: state.revealed.concat(index).sort((a, b) => a - b) };
  }

  /** A demo: there is no win or loss. It is finished once the secret is seen. */
  function result(state) {
    return state.view !== "visible" || state.revealed.length > 0 ? "done" : null;
  }

  /** Position data, as handed to Track.state and to the tutor. */
  function position(state) {
    return {
      n: state.n, values: state.values, hidden: state.hidden,
      direction: state.direction, view: state.view, revealed: state.revealed,
    };
  }

  return {
    FULL, TRAINING, VIEWS, target, permutation, findStraight, processVector,
    deal, monotone, start, setView, reset, reveal, result, position,
  };
})();
