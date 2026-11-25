"use strict";

/*
 * Hummer's Mind Reader, from Alexander Bogomolny's applet MindReader.
 *
 * Three objects (a penny, a nickel and a dime) lie in a row. The player thinks
 * of one and, in the real world, swaps the other two. Then they keep swapping
 * any two, telling the computer each swap, until the real objects are back in
 * their first order. The computer has only seen the announced swaps. Those swaps
 * multiplied together are the inverse of the secret first swap, which is that
 * swap itself, so the computer's own coins end up with exactly one coin in its
 * own place: the one the player thought of.
 *
 * The position is plain data: { pos, selected, announcement }
 *   pos[c]  the place (0, 1 or 2) of coin c (coin 0 penny, 1 nickel, 2 dime)
 *   selected  the coins the player has clicked on, at most one at a time
 *   announcement  null, or { line1, line2 } after Announce
 */
const HummersCore = (() => {
  const NAMES = ["penny", "nickel", "dime"];
  const MESSAGES = { thinking: "You thought of", pressReset: "Try again. Press Reset.", tryAgain1: "Hmm, do you have them", tryAgain2: "in the original order?" };

  const start = () => ({ pos: [0, 1, 2], selected: [], announcement: null });

  /** The two coins swap places. */
  function swap(state, a, b) {
    const pos = state.pos.slice();
    [pos[a], pos[b]] = [pos[b], pos[a]];
    return { ...state, pos, selected: [], announcement: null };
  }

  /** Click on a coin: select it, or unselect it; the second coin selected swaps the two. */
  function click(state, coin) {
    if (!Number.isInteger(coin) || coin < 0 || coin > 2) return null;
    if (state.announcement) return null; // after Announce nothing happens until Reset
    if (state.selected.includes(coin)) return { ...state, selected: state.selected.filter((c) => c !== coin) };
    if (state.selected.length === 1) return swap(state, state.selected[0], coin);
    return { ...state, selected: [coin] };
  }

  /** The coin that is in its own place, when exactly one is; else -1. */
  function whichOne(state) {
    const fixed = [0, 1, 2].filter((c) => state.pos[c] === c);
    return fixed.length === 1 ? fixed[0] : -1;
  }

  /**
   * Press Announce. One coin in its own place: the computer names it and puts the
   * other two back (as the applet does). Otherwise it asks whether the coins are in
   * the original order.
   */
  function announce(state, showNumbers = false) {
    if (state.announcement) return null;
    const w = whichOne(state);
    if (w === -1) return { ...state, selected: [], announcement: { line1: MESSAGES.tryAgain1, line2: MESSAGES.tryAgain2, thought: null } };
    const back = swap(state, (w + 1) % 3, (w + 2) % 3);
    const what = showNumbers ? String(w + 1) : NAMES[w];
    return { ...back, announcement: { line1: `${MESSAGES.thinking} ${what}.`, line2: MESSAGES.pressReset, thought: w } };
  }

  /** Is the result a successful announcement? */
  const result = (state) => (state.announcement && state.announcement.thought !== null ? "done" : null);

  return { NAMES, MESSAGES, start, swap, click, whichOne, announce, result };
})();
