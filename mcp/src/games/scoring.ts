/*
 * run_game_logic actions and saved-position reader for Scoring. The core lives in scoring/ and is
 * copied into src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["scoring"].ScoringCore;

function build(towers: number[], maxStep: number, length: number) {
  const C = core();
  if (maxStep < C.STEP.min || maxStep > C.STEP.max) throw new Error(`maxStep must be ${C.STEP.min}..${C.STEP.max}`);
  if (length < C.LENGTH.min || length > C.LENGTH.max) throw new Error(`length must be ${C.LENGTH.min}..${C.LENGTH.max}`);
  if (!towers.length || towers.some((t) => !Number.isInteger(t) || t < 0 || t >= length)) throw new Error("towers: the squares of the counters, 0..length-1");
  const count = new Array(length).fill(0);
  towers.forEach((t) => count[t]++);
  return C.start({ maxStep, length, count });
}

function analyse(s: { towers: number[]; maxStep: number }) {
  const C = core();
  const x = C.nimSum(s);
  const values = s.towers.map((t: number) => C.value(t, s.maxStep));
  const out: Record<string, unknown> = { counters: s.towers, values, nimSum: x, toMove: x === 0 ? "losing for the player to move" : "winning for the player to move" };
  if (x !== 0 && !C.finished(s)) {
    const m = C.rightMove(s, x);
    out.winningMove = { from: m.from, to: m.to };
  }
  return out;
}

export function actions(): GameActions {
  return {
    analyse: {
      describe: "For counters on squares (0 = home) with a Max Step, each counter's Grundy value t mod (MaxStep+1), the nim-sum, whether the position is won for the player to move, and the move the computer would make to a nim-sum of 0.",
      args: '{ "towers": [5, 7], "maxStep": 3, "length": 8 }',
      run: (args) => analyse(build(numArray(args, "towers").map(Math.round), Math.round(num(args, "maxStep", 3)), Math.round(num(args, "length", 20)))),
    },
  };
}

export function position(state: Json): unknown {
  const towers = numArray(state, "towers").map(Math.round);
  const s = build(towers, Math.round(num(state, "maxStep", 3)), Math.round(num(state, "length", 8)));
  const over = state.over === true;
  return {
    ...analyse(s), maxStep: s.maxStep, length: s.length,
    turn: over ? null : state.turn === "computer" ? "computer" : "you",
    over, winner: over ? (state.winner === "you" ? "you" : "computer") : null,
  };
}
