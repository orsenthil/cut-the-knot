/*
 * run_game_logic: calls the games' real cores.
 *
 * The point of the tool is that a tutor can *show* a strategy instead of
 * describing one from memory. Every answer comes from the same file the live
 * page runs, copied into src/generated/cores/ at build time, so the server
 * cannot drift from the site.
 *
 * Each game's actions live in its own file, src/games/<slug>.ts; this module
 * only gathers them (through the generated src/generated/games.ts) and
 * dispatches.
 */

import { gameModules } from "../generated/games.js";
import type { GameActions, Json } from "./_shared.js";

export const ACTIONS: Record<string, GameActions> = Object.fromEntries(
  Object.entries(gameModules).map(([slug, mod]) => [slug, mod.actions()]),
);

/** A short catalogue of what run_game_logic can do, for the tool description. */
export function actionCatalogue(): string {
  return Object.entries(ACTIONS)
    .map(([slug, actions]) => {
      const list = Object.entries(actions)
        .map(([name, spec]) => `    ${name} ${spec.args}\n      ${spec.describe}`)
        .join("\n");
      return `  ${slug}:\n${list}`;
    })
    .join("\n");
}

export function runGameLogic(slug: string, action: string, args: Json): unknown {
  const game = ACTIONS[slug];
  if (!game) {
    throw new Error(
      `No runnable logic for "${slug}". Games with a core: ${Object.keys(ACTIONS).join(", ")}.`,
    );
  }
  const spec = game[action];
  if (!spec) {
    throw new Error(`"${slug}" has no action "${action}". Available: ${Object.keys(game).join(", ")}.`);
  }
  return spec.run(args ?? {});
}

/**
 * What a game's core can say about a saved position, or null when the game
 * has no core or its module does not read positions.
 */
export function describePosition(slug: string, state: Json, stateVersion: number): unknown {
  const mod = gameModules[slug];
  return mod?.position ? mod.position(state, stateVersion) : null;
}
