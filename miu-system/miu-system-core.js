"use strict";

/*
 * The MIU system, from Alexander Bogomolny's applet MIUsystem (Douglas
 * Hofstadter's puzzle from Godel, Escher, Bach).
 *
 * Words are strings of M, I and U. The one axiom is MI. Four rules turn a
 * theorem into a new one (x and y stand for any strings):
 *   1  xI   -> xIU        a theorem ending in I may take a U
 *   2  Mx   -> Mxx        what follows the M may be doubled
 *   3  xIIIy -> xUy       three I's may become a U
 *   4  xUUy -> xy         two U's may be dropped
 * The applet applies a rule to the newest theorem; if rule 3 or 4 could be
 * applied in more than one place the player picks the place. Theorems longer
 * than 10,000 letters are not added. "Remove last" takes back the newest
 * theorem, but never the axiom.
 *
 * The position is plain data: { theorems, pending } with the newest theorem
 * first, and pending null or { rule, text } while the player picks a place.
 */
const MIUCore = (() => {
  const AXIOM = "MI", MAX_LENGTH = 10000;
  const LABELS = ["MxI  => MxIU", "Mx  => Mxx", "MxIIIy  => MxUy", "MxUUy  => Mxy"];

  const start = () => ({ theorems: [AXIOM], pending: null });

  /** Every place (index of the first letter) where a rule 3 (III) or rule 4 (UU) pattern starts. */
  function places(text, rule) {
    const pat = rule === 3 ? "III" : "UU", out = [];
    for (let i = text.indexOf(pat); i >= 0; i = text.indexOf(pat, i + 1)) out.push(i);
    return out;
  }

  /** Is the rule applicable to this word? */
  function applicable(text, rule) {
    if (rule === 1) return text.endsWith("I");
    if (rule === 2) return true;
    return places(text, rule).length > 0;
  }

  /** The word after the rule is applied at one place (index of the pattern for rules 3 and 4). */
  function applyAt(text, rule, at) {
    if (rule === 1) return text + "U";
    if (rule === 2) return text + text.slice(1);
    if (rule === 3) return text.slice(0, at) + "U" + text.slice(at + 3);
    return text.slice(0, at) + text.slice(at + 2);
  }

  const top = (state) => state.theorems[0];

  /** Add a theorem unless it is too long. */
  const add = (state, text) => (text.length < MAX_LENGTH ? { theorems: [text].concat(state.theorems), pending: null } : { ...state, pending: null });

  /**
   * Press a rule button. Rules 1 and 2 apply at once. Rules 3 and 4 apply at once
   * when there is one place, wait for the player's choice when there are several
   * (state.pending), and do nothing when there is none. null if not allowed now.
   */
  function press(state, rule) {
    if (state.pending || ![1, 2, 3, 4].includes(rule) || !applicable(top(state), rule)) return null;
    if (rule <= 2) return add(state, applyAt(top(state), rule, 0));
    const p = places(top(state), rule);
    if (p.length === 1) return add(state, applyAt(top(state), rule, p[0]));
    return { ...state, pending: { rule, text: top(state) } };
  }

  /** The player clicks the letter at index i of the pending word: applies the rule there if a pattern starts there. */
  function choose(state, i) {
    if (!state.pending) return null;
    const { rule, text } = state.pending;
    if (!places(text, rule).includes(i)) return null;
    return add(state, applyAt(text, rule, i));
  }

  /** Give up the choice (not in the applet, which keeps the buttons off until a place is clicked). */
  const cancel = (state) => (state.pending ? { ...state, pending: null } : null);

  /** Remove last: not the axiom, and not while choosing. */
  function removeLast(state) {
    if (state.pending || state.theorems.length <= 1) return null;
    return { theorems: state.theorems.slice(1), pending: null };
  }

  /** Which buttons are available now: rules 1..4 and Remove last. */
  function available(state) {
    if (state.pending) return { rules: [false, false, false, false], remove: false };
    const t = top(state);
    return { rules: [1, 2, 3, 4].map((r) => applicable(t, r)), remove: state.theorems.length > 1 };
  }

  /** Is this word MU? (The puzzle: it never is a theorem.) */
  const isMU = (state) => state.theorems.includes("MU");

  return { AXIOM, MAX_LENGTH, LABELS, start, places, applicable, applyAt, press, choose, cancel, removeLast, available, isMU };
})();
