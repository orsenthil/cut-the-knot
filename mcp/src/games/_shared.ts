/*
 * What a game module (src/games/<slug>.ts) provides, and the argument
 * helpers they share.
 *
 * A game module exports:
 *
 *   actions()                       named operations run_game_logic can call,
 *                                   each on the game's real core
 *   position(state, stateVersion)?  optional: what the core can say about a
 *                                   position the page saved with Track.state
 *                                   (see docs/contracts.md), for my_position
 *
 * To add a game: add its core to CORE_GLOBALS in scripts/build-index.mjs and
 * write src/games/<slug>.ts. The registry is generated; nothing else changes.
 */

export type Json = Record<string, unknown>;

export interface ActionSpec {
  /** One or two sentences, shown to the client's model. */
  describe: string;
  /** An example of the arguments, as JSON text. */
  args: string;
  run: (args: Json) => unknown;
}

export type GameActions = Record<string, ActionSpec>;

export interface GameModule {
  actions(): GameActions;
  position?(state: Json, stateVersion: number): unknown;
}

export const num = (args: Json, key: string, fallback?: number): number => {
  const v = args[key];
  if (v === undefined || v === null) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing required argument "${key}"`);
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`argument "${key}" must be a number, got ${JSON.stringify(v)}`);
  return n;
};

export const numArray = (args: Json, key: string): number[] => {
  const v = args[key];
  if (!Array.isArray(v)) throw new Error(`argument "${key}" must be an array of numbers`);
  return v.map((x, i) => {
    const n = Number(x);
    if (!Number.isFinite(n)) throw new Error(`${key}[${i}] is not a number`);
    return n;
  });
};
