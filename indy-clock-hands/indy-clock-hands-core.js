"use strict";

/*
 * Indy's Clock Hands, from Bogomolny's applet Indy.
 *
 * Red arcs are marked on a circle. A hand is thrown at random: its direction
 * is a uniformly random angle. A second hand is rigidly attached at a fixed
 * angle alpha, so when the first points at theta the second points at
 * theta + alpha. The page's point is that shifting the red set around the
 * circle does not change its size, so each hand hits red with the same
 * probability — the fraction of the circle painted red — whatever alpha is.
 *
 * The key idea is translation invariance of measure on the circle. The logic
 * test checks the hit probabilities and the exact joint probability (found by
 * integrating the overlap of the red set and its shift).
 *
 * No document, no window, no storage: one global, IndyClockHandsCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const IndyClockHandsCore = (() => {
  const TAU = 2 * Math.PI;

  function start() {
    return { redArcs: [{ start: 0, length: Math.PI / 3 }], alpha: Math.PI / 4, trials: 0, firstHits: 0, secondHits: 0, bothHits: 0 };
  }

  function normalize(angle) {
    return ((angle % TAU) + TAU) % TAU;
  }

  function inRed(redArcs, angle) {
    const a = normalize(angle);
    return redArcs.some((arc) => normalize(a - arc.start) < arc.length);
  }

  /** Exact fraction of the circle painted red. */
  function redFraction(redArcs) {
    const length = redArcs.reduce((s, arc) => s + arc.length, 0);
    return Math.min(1, length / TAU);
  }

  /** One random throw: record whether each hand hits red. */
  function trial(state, theta) {
    const first = inRed(state.redArcs, theta);
    const second = inRed(state.redArcs, theta + state.alpha);
    return {
      ...state,
      trials: state.trials + 1,
      firstHits: state.firstHits + (first ? 1 : 0),
      secondHits: state.secondHits + (second ? 1 : 0),
      bothHits: state.bothHits + (first && second ? 1 : 0),
    };
  }

  /** Joint probability: measure of angles where theta and theta+alpha are red. */
  function joint(state, samples = 20000) {
    let both = 0;
    for (let i = 0; i < samples; i++) {
      const theta = (i + 0.5) * TAU / samples;
      if (inRed(state.redArcs, theta) && inRed(state.redArcs, theta + state.alpha)) both++;
    }
    return both / samples;
  }

  return { TAU, start, normalize, inRed, redFraction, trial, joint };
})();
