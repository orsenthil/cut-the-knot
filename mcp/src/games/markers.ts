/*
 * run_game_logic actions and saved-position reader for Fair Division: Method of Markers.
 * The core lives in markers/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["markers"].MarkersCore;

export function actions(): GameActions {
  return {
    divide: {
      describe: "The Method of Markers: each player gives n-1 whole-number marker positions on a rail 0..400; round by round the leftmost k-th marker among the players not yet served wins the stretch from its owner's previous marker. Returns who gets what and the leftover.",
      args: '{ "rail": 400, "markers": [[100, 250], [120, 200], [90, 300]] }',
      run: (args) => {
        const m = args.markers;
        if (!Array.isArray(m) || m.length < 2) throw new Error('"markers" must be a list with one list of n-1 numbers per player (at least 2 players)');
        const markers = m.map((r) => (r as unknown[]).map(Number));
        const n = markers.length;
        if (!markers.every((r) => r.length === n - 1)) throw new Error("each player needs exactly n-1 markers");
        const state = { n, rail: num(args, "rail", 400), markers };
        const d = core().divide(state);
        return { awards: d.awards.map((a: { player: number; from: number; to: number }) => ({ player: a.player + 1, from: a.from, to: a.to })), leftover: core().leftover(d), gaps: d.left };
      },
    },
  };
}

export function position(state: Json): unknown {
  const markers = (state.markers as number[][]).map((r) => r.map(Number));
  const s = { n: markers.length, rail: 400, markers };
  const d = core().divide(s);
  return {
    players: s.n, awards: d.awards.map((a: { player: number; from: number; to: number }) => ({ player: a.player + 1, from: a.from, to: a.to })), leftover: core().leftover(d),
    note: "Each award is one of the player's own n pieces, so each gets a piece worth 1/n to them; the leftover is the gaps between the pieces.",
  };
}
