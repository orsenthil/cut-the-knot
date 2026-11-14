/*
 * The tools for a signed-in player. They read that player's record through
 * a UserStore and never write to it.
 *
 *   whoami           who this connection is signed in as
 *   my_progress      what they have played, and which concepts are practised
 *   recommend_next   what to play next, by the site's own recommender
 *   my_position      the game they have open, as the page last saved it
 *
 * and the coach_me prompt, which starts from my_position.
 *
 * The recommender is assets/recommend.js, the same file the profile page
 * runs, so the server and the site always agree on what comes next.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { games, tags, concepts, bySlug, json, fail } from "../core/content.js";
import type { User, UserStore } from "../core/store.js";
import { ACTIONS, describePosition } from "../games/registry.js";
import { Recommend } from "../generated/recommend.js";

export interface PersonalContext {
  user: User;
  store: UserStore;
  now: () => number;
}

const NO_ACCESS =
  "This player has turned off the tutor's access to their record. They can turn it back on from their coolmaths profile.";

const iso = (ms: number) => new Date(ms).toISOString();
const label = (tag: string) => tags[tag] ?? tag;

export function registerPersonalTools(server: McpServer, { user, store, now }: PersonalContext): void {
  /** The player's profile, or null when they have switched access off. */
  async function allowedProfile() {
    const profile = (await store.getProfile(user.uid)) ?? {};
    return profile.settings?.mcpAccess === false ? null : profile;
  }

  server.registerTool(
    "whoami",
    { title: "Who is signed in", description: "The coolmaths player this connection is signed in as.", inputSchema: {} },
    async () => {
      const profile = await allowedProfile();
      if (!profile) return fail(NO_ACCESS);
      return json({ signedIn: true, displayName: profile.displayName ?? null });
    },
  );

  server.registerTool(
    "my_progress",
    {
      title: "My progress",
      description:
        "The games this player has played (visits, plays, wins, time) and, per concept, how many of its games they have tried and whether it counts as practised.",
      inputSchema: {},
    },
    async () => {
      if (!(await allowedProfile())) return fail(NO_ACCESS);
      const progress = await store.getProgress(user.uid);
      const played = Object.values(progress)
        .filter((doc) => bySlug.has(doc.slug))
        .sort((a, b) => b.lastAt - a.lastAt)
        .map((doc) => ({
          slug: doc.slug,
          title: bySlug.get(doc.slug)!.title,
          visits: doc.opens,
          plays: doc.plays,
          wins: doc.wins,
          losses: doc.losses,
          finished: doc.completed > 0,
          minutes: Math.round(doc.activeSeconds / 60),
          lastPlayed: iso(doc.lastAt),
          best: doc.best ?? null,
        }));

      const mastery = Recommend.mastery(progress, games, concepts) as Record<
        string,
        { total: number; tried: number; completed: number; practised: boolean }
      >;
      const conceptRows = (Recommend.topoOrder(concepts) as string[])
        .filter((name) => mastery[name].total > 0)
        .map((name) => ({
          concept: name,
          label: label(name),
          gamesTried: mastery[name].tried,
          gamesFinished: mastery[name].completed,
          gamesOnSite: mastery[name].total,
          practised: mastery[name].practised,
        }));

      return json({ gamesPlayed: played.length, gamesOnSite: games.length, played, concepts: conceptRows });
    },
  );

  server.registerTool(
    "recommend_next",
    {
      title: "What to play next",
      description:
        "Games this player has not tried, best first: those whose prerequisite concepts they have practised, easiest first. Each comes with a one-line reason.",
      inputSchema: {
        count: z.number().int().min(1).max(10).optional().describe("How many to suggest (default 3)."),
      },
    },
    async ({ count }) => {
      if (!(await allowedProfile())) return fail(NO_ACCESS);
      const progress = await store.getProgress(user.uid);
      const picks = Recommend.next(progress, games, concepts, count ?? 3) as {
        game: { slug: string };
        missing: string[];
        why: string;
      }[];
      return json(
        picks.map((pick) => {
          const game = bySlug.get(pick.game.slug)!;
          return {
            slug: game.slug,
            title: game.title,
            blurb: game.blurb,
            url: game.url,
            level: game.level,
            concepts: game.tags.map(label),
            reason: Recommend.explain(pick, label) as string,
            practiseFirst: pick.missing.map(label),
          };
        }),
      );
    },
  );

  server.registerTool(
    "my_position",
    {
      title: "The game I have open",
      description:
        "The game this player is playing right now and the position on their screen, as the page last saved it. For games with runnable logic it includes what the game's own code says about the position. Check `savedMinutesAgo`: an old position may be a game they have left.",
      inputSchema: {},
    },
    async () => {
      if (!(await allowedProfile())) return fail(NO_ACCESS);
      const live = await store.getLive(user.uid);
      if (!live) {
        return json({
          playing: false,
          note: "No position has been saved for this player. Not every game reports its position yet; ask which game they are on, then use get_game.",
        });
      }
      const game = bySlug.get(live.slug);
      if (!game) return fail(`The saved position is for "${live.slug}", which is not a game on the site.`);

      let analysis: unknown = null;
      let analysisError: string | null = null;
      try {
        analysis = describePosition(live.slug, live.state, live.stateVersion);
      } catch (err) {
        analysisError = err instanceof Error ? err.message : String(err);
      }

      return json({
        playing: true,
        game: { slug: game.slug, title: game.title, url: game.url, concepts: game.tags.map(label) },
        savedAt: iso(live.updatedAt),
        savedMinutesAgo: Math.max(0, Math.round((now() - live.updatedAt) / 60000)),
        onScreen: live.status,
        stateVersion: live.stateVersion,
        state: live.state,
        analysis,
        ...(analysisError ? { analysisError } : {}),
        next: [
          `get_game("${game.slug}") for the rules and the site's own explanation.`,
          ...(ACTIONS[game.slug]
            ? [`run_game_logic("${game.slug}", ...) to try a line of play. Actions: ${Object.keys(ACTIONS[game.slug]).join(", ")}.`]
            : ["This game has no runnable logic on the server: reason from the rules, the state and what is on screen."]),
        ],
      });
    },
  );

  server.registerPrompt(
    "coach_me",
    {
      title: "Coach me on the game I am playing",
      description: "Looks at the position on the player's screen and coaches from there, with hints before answers.",
      argsSchema: {},
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Coach me on the coolmaths game I have open.",
              "",
              "1. Call my_position to see the game and the position on my screen. If nothing is saved, ask me which game I am playing.",
              "2. Call get_game for that game, and ground everything in its rules and its own explanation.",
              "3. Start from my actual position. Ask what I am trying to do, then give one small hint about the next move, not the move itself.",
              "4. If I ask outright, or stay stuck after two hints, show the move, and use run_game_logic where the game has it so the answer comes from the game's real code.",
              "5. Name the idea behind the game (the invariant, the parity, the strategy) only after I have had a chance to notice it.",
              "",
              "Keep each reply short. I am in the middle of a game.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
