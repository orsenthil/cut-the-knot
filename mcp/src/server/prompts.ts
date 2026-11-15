/*
 * Prompts: ready-made ways to start a conversation about a game.
 *
 * The server does not teach; these tell the client's model how to, and which
 * tools to ground itself in first.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import { z } from "zod";

import { games, tags, findGame, findTag, nearGames, gameMarkdown } from "../core/content.js";
import { ACTIONS } from "../games/registry.js";

export function registerPrompts(server: McpServer): void {
  // A person types into these boxes, so a client that supports it offers the
  // matching games as they type, and a title works as well as a slug.
  // The argument may be left empty, and the SDK looks for the suggestions on
  // the optional wrapper when asked and inside it when registering: mark both.
  const suggest = (schema: z.ZodString, complete: (value: string | undefined) => string[]) =>
    completable(completable(schema, complete).optional(), complete);

  const slugEnum = suggest(
    z.string().describe('A game: its slug or its title, e.g. "hourglass" or "Coins in a Row".'),
    (value) => (value ? nearGames(value, 20) : games.slice(0, 20)).map((g) => g.slug),
  );
  const tagEnum = suggest(
    z.string().describe(`A concept: its tag or its name. One of: ${Object.keys(tags).join(", ")}`),
    (value) => {
      const v = String(value ?? "").toLowerCase();
      return Object.keys(tags).filter((t) => t.includes(v) || tags[t].toLowerCase().includes(v));
    },
  );

  /**
   * What a prompt answers when the game is not on the site. A prompt that
   * throws leaves the person with an error and nothing to do; this hands the
   * model the request and the nearest games, so the conversation goes on.
   */
  const noSuchGame = (typed: string, wanted: string) => {
    const near = nearGames(typed);
    if (!typed.trim()) {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `I would like coolmaths to ${wanted} a game, but I have not said which one.\n\n` +
                `Call list_games and offer me a few to choose from, or ask what kind of puzzle I like. ` +
                `Once I have chosen, call get_game for it and carry on from its own text, not from memory.`,
            },
          },
        ],
      };
    }
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `I asked coolmaths to ${wanted} the game "${typed}", but there is no game by that name on the site.\n\n` +
              (near.length
                ? `The closest are:\n${near.map((g) => `- ${g.title} (${g.slug}): ${g.blurb}`).join("\n")}\n\n` +
                  `Ask me which of these I meant.`
                : `Call search with what I typed, or list_games, and offer me a few games to choose from.`) +
              ` Once I have chosen, call get_game for it and carry on from its own text, not from memory.`,
          },
        },
      ],
    };
  };

  server.registerPrompt(
    "tutor",
    {
      title: "Tutor me on a game",
      description: "Socratic: play first, then hints, then the invariant.",
      argsSchema: { slug: slugEnum },
    },
    ({ slug }) => {
      const g = findGame(slug ?? "");
      if (!g) return noSuchGame(slug ?? "", "tutor me on");
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Be my tutor for this puzzle. Work in three stages and do not skip ahead.\n\n` +
                `1. Give me the rules and send me to ${g.url} to play. Ask what I notice. Stop and wait.\n` +
                `2. When I report back, ask questions that lead me toward the pattern. Give one small hint at a ` +
                `time. If I am stuck, use run_game_logic to compute a concrete example and show it to me, rather ` +
                `than telling me the rule.\n` +
                `3. Only once I have guessed the pattern, or asked outright, name the underlying idea and explain ` +
                `why it works.\n\n` +
                `Here is the material. Use this rather than your own memory of the puzzle.\n\n` +
                gameMarkdown(g),
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "quiz_me",
    {
      title: "Quiz me on a concept",
      description: "Questions drawn from the games that use a concept.",
      argsSchema: { tag: tagEnum },
    },
    ({ tag: given }) => {
      const typed = given ?? "";
      const tag = findTag(typed) ?? typed;
      const matching = games.filter((g) => g.tags.includes(tag));
      const label = tags[tag] ?? tag;
      if (!matching.length) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  `I asked coolmaths to quiz me on "${typed}", but no games are filed under that concept.\n\n` +
                  `The concepts it has are: ${Object.values(tags).join(", ")}.\n\n` +
                  `Ask me which of these is closest to what I meant, then call explain_concept for it and quiz me from that.`,
              },
            },
          ],
        };
      }
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Quiz me on ${label}, using these ${matching.length} puzzles.\n\n` +
                `Ask one question at a time and wait for my answer before the next. Start easy and get harder. ` +
                `Mix recall with "what would happen if" questions. Where a question has a computable answer, ` +
                `check mine with run_game_logic before telling me whether I am right. After each answer, say ` +
                `briefly why, and point me at the game it comes from.\n\n` +
                matching.map((g) => gameMarkdown(g)).join("\n\n---\n\n"),
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "explain_like_im",
    {
      title: "Explain at a level",
      description: "The same puzzle explained for a 10-year-old, a high schooler or an undergraduate.",
      argsSchema: {
        slug: slugEnum,
        level: z.string().describe('Audience: "10", "high school" or "undergraduate".'),
      },
    },
    ({ slug, level }) => {
      const g = findGame(slug ?? "");
      if (!g) return noSuchGame(slug ?? "", "explain");
      const guidance: Record<string, string> = {
        "10": "No algebra and no jargon. Short sentences, concrete objects, and a picture in words. One idea only.",
        "high school":
          "Algebra is fine. Name the idea properly, show the formula, and say what it would take to prove it.",
        undergraduate:
          "Be precise: state the invariant or theorem exactly, sketch the proof, and say where the argument generalises or fails.",
      };
      const key = Object.keys(guidance).find((k) => level.toLowerCase().includes(k)) ?? "high school";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Explain this puzzle and the mathematics behind it for: ${level}.\n\n${guidance[key]}\n\n` +
                `End with one question to check I followed. Base it on the material below, not on your own ` +
                `recollection, and use run_game_logic if a worked example would help.\n\n` +
                gameMarkdown(g),
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "review_port",
    {
      title: "Review a port",
      description: "Compare the JavaScript port against the original applet's rules and suggest improvements.",
      argsSchema: { slug: slugEnum },
    },
    ({ slug }) => {
      const g = findGame(slug ?? "");
      if (!g) return noSuchGame(slug ?? "", "review the port of");
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Review this port for faithfulness and quality.\n\n` +
                `Check in this order:\n` +
                `1. Faithfulness. Read ${g.ctkUrl ?? "the original cut-the-knot page"} and call get_original(${JSON.stringify(
                  g.slug,
                )}) for the applet. Do the rules, win condition, opponent strategy, board sizes and option ranges match? CLAUDE.md requires a deliberate change to be stated in the commit message, so flag anything that differs silently.\n` +
                `2. The maths section. Is it correct, is it the site's own words rather than Bogomolny's, and does it build in 2-5 steps?\n` +
                `3. The code. Is the logic in a DOM-free core, and does run_game_logic agree with what the page claims?\n` +
                `4. The page against CLAUDE.md: section order, two-line rules, accessibility, 375px, both themes.\n\n` +
                `Be specific and say what you would change. Here is the port:\n\n` +
                gameMarkdown(g, { withSource: true }),
            },
          },
        ],
      };
    },
  );
}
