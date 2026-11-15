/*
 * The tools anyone may call, signed in or not: the catalogue, a game's own
 * explanation, search, a concept across games, the games' real logic, and
 * the state of the porting campaign.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { games, tags, applets, bySlug, json, fail, gameMarkdown, haystack, manifest, unknownGame } from "../core/content.js";
import { ACTIONS, runGameLogic } from "../games/registry.js";

/** list_games returns this many unless asked for another number. */
const PAGE = 25;
const MAX_PAGE = 100;

export function registerPublicTools(server: McpServer): void {
  server.registerTool(
    "list_games",
    {
      title: "List games",
      description:
        `The games on the site, a page at a time (${PAGE} unless you ask for more), optionally only those with one concept or of one kind. ` +
        "`total` says how many match; when `nextOffset` is not null there are more. To find one game, search is quicker.",
      inputSchema: {
        tag: z.string().optional().describe(`Concept tag. One of: ${Object.keys(tags).join(", ")}`),
        kind: z.enum(["game", "demo"]).optional().describe('"game" can be won or lost; "demo" is something to explore.'),
        limit: z.number().int().min(1).max(MAX_PAGE).optional().describe(`How many to return (default ${PAGE}, at most ${MAX_PAGE}).`),
        offset: z.number().int().min(0).optional().describe("How many to skip; pass the previous answer's nextOffset."),
      },
    },
    async ({ tag, kind, limit, offset }) => {
      if (tag && !(tag in tags)) {
        return fail(`No tag "${tag}". Known tags: ${Object.keys(tags).join(", ")}`);
      }
      const matching = games.filter((g) => (!tag || g.tags.includes(tag)) && (!kind || g.kind === kind));
      const from = offset ?? 0;
      const page = matching.slice(from, from + (limit ?? PAGE));
      const end = from + page.length;
      return json({
        total: matching.length,
        offset: from,
        nextOffset: end < matching.length ? end : null,
        games: page.map((g) => ({
          slug: g.slug,
          title: g.title,
          blurb: g.blurb,
          tags: g.tags,
          kind: g.kind,
          level: g.level,
          url: g.url,
          hasRunnableLogic: Boolean(ACTIONS[g.slug]),
        })),
      });
    },
  );

  server.registerTool(
    "get_game",
    {
      title: "Get a game",
      description:
        "The rules, the site's own 'Look for the math' explanation, the named concepts and optionally the source. Read this before explaining a puzzle.",
      inputSchema: {
        slug: z.string().describe('Game slug, e.g. "hourglass". Find one with search or list_games.'),
        includeSource: z.boolean().optional().describe("Include the game's JavaScript. Defaults to false."),
      },
    },
    async ({ slug, includeSource }) => {
      const g = bySlug.get(slug);
      if (!g) return fail(unknownGame(slug));
      return { content: [{ type: "text" as const, text: gameMarkdown(g, { withSource: includeSource === true }) }] };
    },
  );

  server.registerTool(
    "search",
    {
      title: "Search the site",
      description: "Keyword search over titles, blurbs, rules, maths text and tags.",
      inputSchema: {
        query: z.string().describe("Words to look for, e.g. 'parity' or 'why does the chocolate bar always take the same number of breaks'"),
        limit: z.number().int().min(1).max(20).optional().describe("Maximum results (default 5)."),
      },
    },
    async ({ query, limit }) => {
      const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
      if (!words.length) return fail("Give at least one word of three letters or more.");
      const scored = games
        .map((g) => {
          const hay = haystack(g);
          let score = 0;
          for (const w of words) {
            const hits = hay.split(w).length - 1;
            score += hits;
            if (g.title.toLowerCase().includes(w)) score += 10;
            if (g.slug.includes(w)) score += 10;
            if (g.tags.some((t) => t.includes(w))) score += 5;
          }
          return { g, score };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit ?? 5);

      if (!scored.length) return fail(`Nothing matched "${query}".`);
      return json(
        scored.map(({ g, score }) => ({
          slug: g.slug,
          title: g.title,
          blurb: g.blurb,
          tags: g.tags,
          url: g.url,
          score,
          matchedIn:
            g.math?.sections
              .filter((s) => words.some((w) => `${s.heading} ${s.body}`.toLowerCase().includes(w)))
              .map((s) => s.heading) ?? [],
        })),
      );
    },
  );

  server.registerTool(
    "explain_concept",
    {
      title: "Explain a concept",
      description:
        "Every game that uses a concept, with the maths paragraphs that explain it and the Wikipedia link. Takes a tag slug or a free-text term.",
      inputSchema: {
        concept: z.string().describe(`A tag (${Object.keys(tags).join(", ")}) or a term like "invariant" or "Bezout".`),
      },
    },
    async ({ concept }) => {
      const key = concept.toLowerCase().trim();
      const asTag = Object.keys(tags).find((t) => t === key || tags[t].toLowerCase() === key);

      const matching = asTag
        ? games.filter((g) => g.tags.includes(asTag))
        : games.filter(
            (g) =>
              haystack(g).includes(key) ||
              g.wikiTerms.some((w) => w.label.toLowerCase().includes(key) || w.page.toLowerCase().includes(key)),
          );

      if (!matching.length) {
        return fail(
          `Nothing on "${concept}". Try a tag (${Object.keys(tags).join(", ")}) or search() for free text.`,
        );
      }

      const label = asTag ? tags[asTag] : concept;
      const out: string[] = [`# ${label}`, ""];

      const links = new Map<string, string>();
      for (const g of matching) {
        for (const w of g.wikiTerms) {
          if (asTag ? true : w.label.toLowerCase().includes(key) || w.page.toLowerCase().includes(key)) {
            links.set(w.label, w.url);
          }
        }
      }
      if (links.size) {
        out.push("## Background", "");
        for (const [l, u] of links) out.push(`- ${l} — ${u}`);
        out.push("");
      }

      out.push(`## Where it shows up (${matching.length} game${matching.length === 1 ? "" : "s"})`, "");
      for (const g of matching) {
        out.push(`### ${g.title} (${g.slug})`, "", g.blurb, "");
        const relevant =
          g.math?.sections.filter((s) =>
            asTag ? true : `${s.heading} ${s.body}`.toLowerCase().includes(key),
          ) ?? [];
        for (const s of relevant.length ? relevant : (g.math?.sections ?? []).slice(0, 1)) {
          out.push(`**${s.heading}**`, "", s.body, "");
        }
        out.push(`Play: ${g.url}`, "");
      }
      return { content: [{ type: "text" as const, text: out.join("\n") }] };
    },
  );

  server.registerTool(
    "list_actions",
    {
      title: "List a game's runnable actions",
      description:
        "What run_game_logic can do. With a slug: that game's actions, each with what it does and an example of its arguments. Without: which games have runnable logic at all.",
      inputSchema: {
        slug: z.string().optional().describe("Game slug. Leave out to list the games that have runnable logic."),
      },
    },
    async ({ slug }) => {
      if (!slug) {
        return json({
          gamesWithRunnableLogic: Object.entries(ACTIONS).map(([s, actions]) => ({
            slug: s,
            title: bySlug.get(s)?.title ?? s,
            actions: Object.keys(actions),
          })),
        });
      }
      if (!bySlug.has(slug)) return fail(unknownGame(slug));
      const actions = ACTIONS[slug];
      if (!actions) {
        return json({ slug, actions: [], note: "This game has no runnable logic on the server. Use get_game for its rules and explanation." });
      }
      return json({
        slug,
        actions: Object.entries(actions).map(([name, spec]) => ({
          action: name,
          does: spec.describe,
          exampleArgs: JSON.parse(spec.args),
        })),
      });
    },
  );

  server.registerTool(
    "run_game_logic",
    {
      title: "Run a game's real logic",
      description:
        "Calls the game's actual code — the same file the live page runs — so you can show a worked answer instead of describing one. " +
        "Call list_actions first to see which games have runnable logic, and each action's arguments.",
      inputSchema: {
        slug: z.string().describe('Game slug, e.g. "hourglass". list_actions says which games have runnable logic.'),
        action: z.string().describe("Action name, from list_actions."),
        // passthrough() rather than z.record(z.any()): the arguments differ per
        // action, so this really is a free-form object, and passthrough says so
        // as `additionalProperties: true` instead of an empty schema that
        // strict clients flag as constraining nothing.
        args: z
          .object({})
          .passthrough()
          .optional()
          .describe("Arguments for the action, as JSON. list_actions shows an example for each action."),
      },
    },
    async ({ slug, action, args }) => {
      try {
        return json(runGameLogic(slug, action, args ?? {}));
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.registerTool(
    "porting_status",
    {
      title: "Porting status",
      description: "How the porting campaign stands, from porting/manifest.json.",
      inputSchema: {
        kind: z.enum(["game", "demo", "illustration", "helper"]).optional().describe("Only this kind of applet."),
        status: z.enum(["todo", "in-progress", "ported", "failed", "skip"]).optional(),
        limit: z.number().int().min(1).max(100).optional().describe("Entries to list (default 20)."),
      },
    },
    async ({ kind, status, limit }) => {
      let list = applets;
      if (kind) list = list.filter((a) => a.kind === kind);
      if (status) list = list.filter((a) => a.status === status);
      const counts: Record<string, number> = {};
      for (const a of list) counts[a.status] = (counts[a.status] ?? 0) + 1;
      return json({
        overall: manifest.counts,
        matching: { total: list.length, byStatus: counts },
        entries: list.slice(0, limit ?? 20),
      });
    },
  );

  server.registerTool(
    "next_to_port",
    {
      title: "Next applet to port",
      description:
        "The next applets to work through: lowest priority number first, which means games before demos before illustrations.",
      inputSchema: {
        count: z.number().int().min(1).max(25).optional().describe("How many to suggest (default 1)."),
        kind: z.enum(["game", "demo", "illustration"]).optional(),
      },
    },
    async ({ count, kind }) => {
      const todo = applets
        .filter((a) => a.status === "todo" && a.kind !== "helper" && (!kind || a.kind === kind))
        .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
      if (!todo.length) return json({ done: true, message: "Nothing left to port in that category." });
      return json({
        done: false,
        remaining: todo.length,
        next: todo.slice(0, count ?? 1).map((a) => ({
          ...a,
          extract: `unzip classes.zip 'classes/${a.name}*' -d /tmp/applet`,
        })),
      });
    },
  );

  server.registerTool(
    "get_original",
    {
      title: "Get the original applet",
      description:
        "The manifest entry and cut-the-knot page for an applet, plus the port's source when it has been ported. Use it to check whether a port is faithful.",
      inputSchema: {
        name: z.string().describe('Applet name as it appears in classes.zip, e.g. "RFWH", or a game slug.'),
      },
    },
    async ({ name }) => {
      const key = name.toLowerCase();
      const entry =
        applets.find((a) => a.name.toLowerCase() === key) ??
        applets.find((a) => a.slug === key) ??
        applets.find((a) => a.name.toLowerCase().includes(key));
      if (!entry) return fail(`No applet matching "${name}" in the manifest.`);

      const port = entry.slug ? bySlug.get(entry.slug) : undefined;
      return json({
        applet: entry,
        extract: entry.archive ? `unzip classes.zip '${entry.archive}' -d /tmp/applet` : null,
        inspect: entry.archive
          ? "jar xf <Name>.jar && javap -c -p <Name>.class   # no decompiler is installed"
          : null,
        javaSource:
          "Decompiled *_src/ folders are not in the repo; read the bytecode with javap, or the cut-the-knot page for the rules.",
        port: port
          ? {
              slug: port.slug,
              url: port.url,
              scripts: port.scripts.map((s) => ({ path: s.path, isCore: s.isCore, source: s.source })),
            }
          : null,
      });
    },
  );
}
