"use strict";

/*
 * Pure logic for Torque (no DOM), inspired by Alexander Bogomolny's
 * "Achieve the Equilibrium" (cut-the-knot.org/Games/Torque.shtml), originally
 * a Flash widget by Umapalata. The Flash itself couldn't be ported faithfully
 * -- its ActionScript is control-flow-flattened (every script collapses into
 * one opaque numeric dispatch loop, a deliberate anti-decompile scheme) so no
 * algorithm survives decompilation -- but strings pulled from the SWF before
 * giving up on that confirm the physics this rebuild is built from: a beam
 * balanced on a pivot ("lungBar", "oporaBar"), items hung at marked positions
 * ("moment", "signMomenta"), a result readout reading "the sum of the
 * torques: ", and a constant-value reference piece, the "joker", worth
 * exactly one unit and present in every round.
 *
 * The physics: a weight (or a lifting "balloon", a negative weight) hung at
 * distance d from the pivot exerts a torque (moment) of value * d -- positive
 * clockwise, say. A beam is in equilibrium exactly when the signed torques
 * over every hung item sum to zero. Each round gives a tray of items (always
 * including one +1 joker) and a row of marked peg positions on the beam; the
 * player must hang every item on some peg so the total torque is zero. There
 * may be more than one way to do it -- only one is generated, but the
 * checker accepts any placement that balances.
 */
const TorqueCore = (() => {
  const HALF_LENGTH = 6; // pegs at +-1 .. +-HALF_LENGTH
  const MAX_ITEM_WEIGHT = 9;
  const MIN_ITEMS = 4;
  const MAX_ITEMS = 6;
  const MAX_ATTEMPTS = 200;

  function allPegs() {
    const pegs = [];
    for (let i = HALF_LENGTH; i >= 1; i--) pegs.push(-i);
    for (let i = 1; i <= HALF_LENGTH; i++) pegs.push(i);
    return pegs;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function randNonZero(min, max) {
    let v;
    do {
      v = randInt(min, max);
    } while (v === 0);
    return v;
  }

  // Build one solvable round: pick k pegs and k-1 item values freely (the
  // joker is always one of them, fixed at +1), then solve for the final
  // item's value so the whole set balances at those pegs. Retries with a
  // fresh random draw whenever that value isn't a usable integer.
  function tryGenerate() {
    const pegs = allPegs();
    const k = randInt(MIN_ITEMS, MAX_ITEMS);
    const chosenPegs = shuffle(pegs).slice(0, k);

    const values = [1]; // the joker, always present, always worth 1
    for (let i = 1; i < k - 1; i++) {
      values.push(randNonZero(-MAX_ITEM_WEIGHT, MAX_ITEM_WEIGHT));
    }
    // last value is still unassigned; solve for it below
    let partialSum = 0;
    for (let i = 0; i < values.length; i++) partialSum += values[i] * chosenPegs[i];

    const finalPeg = chosenPegs[k - 1];
    const remainder = -partialSum;
    if (remainder % finalPeg !== 0) return null;
    const finalValue = remainder / finalPeg;
    if (finalValue === 0 || Math.abs(finalValue) > MAX_ITEM_WEIGHT) return null;

    values.push(finalValue);

    const items = values.map((value, i) => ({
      id: "item" + i,
      value,
      isJoker: i === 0,
    }));

    return { pegs, items: shuffle(items) };
  }

  function generate() {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const round = tryGenerate();
      if (round) return round;
    }
    // Astronomically unlikely fallback: a trivial always-solvable round.
    return {
      pegs: allPegs(),
      items: shuffle([
        { id: "item0", value: 1, isJoker: true },
        { id: "item1", value: 1, isJoker: false },
        { id: "item2", value: -2, isJoker: false },
      ]),
    };
  }

  // placements: { [itemId]: pegPosition } for items currently hung.
  function evaluate(items, placements) {
    let sum = 0;
    let placedCount = 0;
    for (const item of items) {
      const pos = placements[item.id];
      if (pos === undefined || pos === null) continue;
      sum += item.value * pos;
      placedCount++;
    }
    const allPlaced = placedCount === items.length;
    return { sum, allPlaced, balanced: allPlaced && sum === 0 };
  }

  function pegIsFree(placements, pos) {
    return !Object.values(placements).some((p) => p === pos);
  }

  return { allPegs, generate, evaluate, pegIsFree, HALF_LENGTH, MAX_ITEM_WEIGHT, MIN_ITEMS, MAX_ITEMS };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TorqueCore;
