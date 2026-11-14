/*
 * Prompts: ready-made ways to start a conversation about a game.
 *
 * The server does not teach; these tell the client's model how to, and which
 * tools to ground itself in first.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { games, tags, bySlug, gameMarkdown } from "../core/content.js";
import { ACTIONS } from "../games/registry.js";

export function registerPrompts(server: McpServer): void {
  const slugEnum = z.string().describe(`Game slug. One of: ${games.map((g) => g.slug).join(", ")}`);

  server.registerPrompt(
    "tutor",
    {
      title: "Tutor me on a game",
      description: "Socratic: play first, then hints, then the invariant.",
      argsSchema: { slug: slugEnum },
    },
    ({ slug }) => {
      const g = bySlug.get(slug);
      if (!g) throw new Error(`No game "${slug}".`);
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
      argsSchema: { tag: z.string().describe(`Concept tag. One of: ${Object.keys(tags).join(", ")}`) },
    },
    ({ tag }) => {
      const matching = games.filter((g) => g.tags.includes(tag));
      const label = tags[tag] ?? tag;
      if (!matching.length) throw new Error(`No games tagged "${tag}". Known: ${Object.keys(tags).join(", ")}`);
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
      const g = bySlug.get(slug);
      if (!g) throw new Error(`No game "${slug}".`);
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
      const g = bySlug.get(slug);
      if (!g) throw new Error(`No game "${slug}".`);
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
