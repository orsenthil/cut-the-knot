/*
 * run_game_logic actions and saved-position reader for Heads and Tails.
 *
 * n pins in a ring, each with a head and a tail; at every corner two pins meet head to head (HH),
 * head to tail (HT) or tail to tail (TT). For any n, HH = TT. Every answer comes from the game's
 * real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["first-proof"].FirstProofCore;

/** An orientation list from the arguments: "pins" is a string or list of 0/1 (1 = pointing round the ring, 0 = against it). */
function pinsOf(args: Json): boolean[] {
  const raw = args.pins;
  const list = Array.isArray(raw) ? (raw as unknown[]).map((x) => Number(x)) : String(raw ?? "000").replace(/[^01]/g, "").split("").map(Number);
  if (list.length < 3 || list.length > 50 || list.some((v) => v !== 0 && v !== 1)) throw new Error("pins is 3 to 50 values, each 0 or 1 (1 means the pin points round the ring, 0 against it)");
  return list.map((v) => v === 1);
}

export function actions(): GameActions {
  return {
    count: {
      describe: "Count the corners of a ring of pins. pins lists each pin's direction (1 = pointing round the ring, 0 = against it; the applet starts with all pins pointing the same way). Gives HH, HT, TT, the kind of every corner, and checks HH = TT.",
      args: '{ "pins": "11010110" }',
      run: (args) => {
        const C = core();
        const direct = pinsOf(args);
        const s = { ...C.start({ n: direct.length }), direct };
        const c = C.counts(s);
        return { pins: direct.length, HH: c.hh, HT: c.ht, TT: c.tt, corners: C.vertices(s), HHequalsTT: c.hh === c.tt, HTequalsNMinus2HH: c.ht === direct.length - 2 * c.hh, triangleNote: direct.length === 3 ? (c.ht === 3 ? "all three corners are the same (head to tail)" : "all three corners are different") : undefined };
      },
    },
    flip: {
      describe: "What turning one pin (1 to n) does to the counts, for the ring given by pins, with the page's rule: nothing changes when the two neighbouring pins point opposite ways; when they point the same way HH and TT both change by one and HT by two the other way.",
      args: '{ "pins": "11010110", "pin": 3 }',
      run: (args) => {
        const C = core();
        const direct = pinsOf(args);
        const pin = Math.trunc(num(args, "pin", 1)) - 1;
        if (pin < 0 || pin >= direct.length) throw new Error(`pin runs from 1 to ${direct.length}`);
        const s = { ...C.start({ n: direct.length }), direct };
        const before = C.counts(s), after = C.counts(C.move(s, { type: "flip", pin }));
        const L = direct[(pin + direct.length - 1) % direct.length], R = direct[(pin + 1) % direct.length];
        return { before, after, change: { HH: after.hh - before.hh, HT: after.ht - before.ht, TT: after.tt - before.tt }, neighbours: L === R ? "point the same way: the counts change" : "point opposite ways: the counts do not change" };
      },
    },
  };
}

/** What the core says about the ring as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const direct = Array.isArray(state.direct) ? (state.direct as unknown[]).map(Boolean) : null;
  const n = Math.max(3, Math.min(50, direct ? direct.length : Math.trunc(num(state, "n", 3))));
  const s = C.start({ n, direct: direct && direct.length === n ? direct : undefined });
  const c = C.counts(s);
  return {
    pins: n,
    HH: c.hh, HT: c.ht, TT: c.tt,
    HHequalsTT: c.hh === c.tt,
    allCornersAlike: c.ht === n,
    allThreeKindsPresent: c.hh > 0 && c.ht > 0 && c.tt > 0,
    hintShowing: state.hint === true,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
