/*
 * Puts the server together.
 *
 * The public server (no user in the context) has the resources, the public
 * tools and the prompts. With a signed-in user and a store it also gets the
 * personal tools, which read that player's record.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { User, UserStore } from "../core/store.js";
import { registerResources } from "./resources.js";
import { registerPublicTools } from "./tools-public.js";
import { registerPersonalTools } from "./tools-personal.js";
import { registerPrompts } from "./prompts.js";

export interface ServerContext {
  /** The signed-in player, when the request came through the personal endpoint. */
  user?: User;
  /** Where players' records are read from. Required when `user` is set. */
  store?: UserStore;
  /** The clock, replaceable in tests. */
  now?: () => number;
}

const INSTRUCTIONS =
  "Grounded material for tutoring the coolmaths puzzles at " +
  "https://orsenthil.github.io/cut-the-knot/ — browser ports of Alexander " +
  "Bogomolny's cut-the-knot.org applets. Prefer get_game and explain_concept " +
  "over your own recollection of a puzzle: the text they return is the site's " +
  "own explanation. Use run_game_logic to compute a real answer from the " +
  "game's actual code rather than working one out in prose, and show the " +
  "result. The tutor prompt is Socratic by design: let the learner play and " +
  "guess before naming the invariant.";

const PERSONAL_INSTRUCTIONS =
  " This connection is signed in as one player: my_position shows the game " +
  "they have open right now, my_progress what they have played, and " +
  "recommend_next what to try next. Start from my_position when they ask for " +
  "help with \"this game\".";

export function buildServer(context: ServerContext = {}): McpServer {
  const personal = Boolean(context.user && context.store);
  const server = new McpServer(
    { name: "coolmaths-tutor", version: "1.0.0" },
    { instructions: personal ? INSTRUCTIONS + PERSONAL_INSTRUCTIONS : INSTRUCTIONS },
  );

  registerResources(server);
  registerPublicTools(server);
  registerPrompts(server);
  if (context.user && context.store) {
    registerPersonalTools(server, { user: context.user, store: context.store, now: context.now ?? Date.now });
  }
  return server;
}
