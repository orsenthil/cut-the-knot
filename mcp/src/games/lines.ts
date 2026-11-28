/*
 * run_game_logic actions for lines (disappearing lines).
 *
 * Each action calls the game's real core (lines/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

/** The saved position is exactly what lines.js hands to Track.state: { n, dx, dy }. */
const positionOf = (L: typeof cores.lines.LinesCore, args: Json) => {
  const n = L.start({ n: num(args, "n", L.DEFAULT_N) }).n; // clamp through the core (5..25)
  return { n, dx: num(args, "dx", 0), dy: num(args, "dy", 0) };
};

export function actions(): GameActions {
  const L = cores.lines.LinesCore;

  return {
    slide: {
      describe:
        "The disappearing-lines trick for `n` vertical strokes: slide the upper triangle one notch right and one notch up. Shows the visible-line count falling from n to n-1, the total drawn length staying fixed, and that the eyes open only at the exact offset (the count drops whenever the sideways shift is one full notch, but the eyes stay shut unless the height is right too).",
      args: '{ "n": 10 }',
      run: (args) => {
        const st = positionOf(L, args);
        const g = L.geometry(st);
        const rest = L.start({ n: st.n });
        const look = (p: { n: number; dx: number; dy: number }) => {
          const r = L.status(p);
          return {
            dx: p.dx,
            dy: p.dy,
            visibleLines: r.count,
            totalDrawnLength: r.length,
            eyesOpen: r.finished,
          };
        };
        return {
          n: st.n,
          notch: g.s,
          atRest: look(rest),
          slidOneNotchUpAndRight: look(L.slide(rest)),
          sidewaysOnly: look(L.nudge(rest, g.s, 0)),
          oneNotchTooHigh: look(L.nudge(rest, g.s, -2 * g.s)),
          why: `With ${st.n} strokes in each triangle the total drawn length is fixed: sliding only moves the pieces, so it never changes. At a sideways shift of exactly one notch (${g.s}px) the touching strokes merge and you see ${st.n - 1} instead of ${st.n}, each one notch longer. The eyes open only at (dx=${g.s}, dy=${-g.s}) — shift sideways alone and the ${st.n - 1} appear but the eyes stay shut.`,
        };
      },
    },
    measure: {
      describe:
        "Read a lines position `{ n, dx, dy }` (the same fields the page saves): the notch size, how many distinct vertical lines you actually see, the total length drawn, and whether the eyes are open. Also reports the exact offset that opens the eyes.",
      args: '{ "n": 10, "dx": 20, "dy": -20 }',
      run: (args) => {
        const st = positionOf(L, args);
        const g = L.geometry(st);
        const r = L.status(st);
        const target = L.slide(st);
        return {
          ...st,
          notch: g.s,
          visibleLines: r.count,
          totalDrawnLength: r.length,
          eyesOpen: r.finished,
          opensEyesAt: { dx: target.dx, dy: target.dy, up: -target.dy },
          toTarget: { dx: target.dx - st.dx, dy: target.dy - st.dy },
          why: `Length is conserved (${r.length}px here) whatever the offset. Counting strokes that touch as one line gives ${r.count}; at the sideways notch it falls by one. The eyes need the exact corner (dx=${target.dx}, dy=${target.dy}).`,
        };
      },
    },
  };
}

/**
 * What the core says about a position saved by the page: the saved n/dx/dy,
 * the notch size, the strokes actually visible, the conserved total length,
 * and how far the upper triangle is from the offset that opens the eyes.
 */
export function position(state: Json, stateVersion: number): unknown {
  const L = cores.lines.LinesCore;
  const st = positionOf(L, state);
  const g = L.geometry(st);
  const r = L.status(st);
  const target = L.slide(st);
  return {
    ...state,
    n: st.n,
    dx: st.dx,
    dy: st.dy,
    stateVersion,
    notch: g.s,
    visibleLines: r.count,
    totalDrawnLength: r.length,
    eyesOpen: r.finished,
    opensEyesAt: { dx: target.dx, dy: target.dy, up: -target.dy },
    notchesToTarget: {
      right: (target.dx - st.dx) / g.s,
      up: (st.dy - target.dy) / g.s,
    },
    why: `Total drawn length is an invariant (${r.length}px); the strokes only seem to merge. You see ${r.count} lines now; one full notch to the right makes ${st.n - 1}. The eyes open only at (dx=${target.dx}, dy=${target.dy}) — an exact up-right offset, not merely the right count.`,
  };
}
